const { query, withTransaction } = require('../config/database');

async function getRfqs(tenantId, { status, search, page=1, limit=25 }) {
  const offset = (page-1)*limit;
  let where = 'WHERE r.tenant_id=$1 AND r.deleted_at IS NULL';
  const params = [tenantId]; let idx=2;
  if (status) { where+=` AND r.status=$${idx++}`; params.push(status); }
  if (search) { where+=` AND (r.rfq_number ILIKE $${idx} OR r.title ILIKE $${idx} OR r.project_name ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
  const [cnt, rows] = await Promise.all([
    query(`SELECT COUNT(*) FROM rfqs r ${where}`, params),
    query(`SELECT r.id,r.rfq_number,r.title,r.project_name,r.status,r.submission_deadline,
                  r.validity_days,r.delivery_location,r.created_at,
                  u.first_name||' '||u.last_name as created_by_name,
                  COUNT(DISTINCT rv.vendor_id) as vendor_count,
                  COUNT(DISTINCT qi.id) as item_count
           FROM rfqs r
           LEFT JOIN users u ON u.id=r.created_by
           LEFT JOIN rfq_vendors rv ON rv.rfq_id=r.id
           LEFT JOIN rfq_items qi ON qi.rfq_id=r.id
           ${where} GROUP BY r.id,u.first_name,u.last_name
           ORDER BY r.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, limit, offset])
  ]);
  return { rows: rows.rows, total: parseInt(cnt.rows[0].count) };
}

async function getRfqById(tenantId, rfqId) {
  const [rfqRes, itemsRes, vendorsRes] = await Promise.all([
    query(`SELECT r.*,u.first_name||' '||u.last_name as created_by_name
           FROM rfqs r LEFT JOIN users u ON u.id=r.created_by
           WHERE r.id=$1 AND r.tenant_id=$2 AND r.deleted_at IS NULL`, [rfqId, tenantId]),
    query('SELECT * FROM rfq_items WHERE rfq_id=$1 AND tenant_id=$2 ORDER BY line_number', [rfqId, tenantId]),
    query(`SELECT rv.*,v.company_name,v.contact_email,v.contact_name
           FROM rfq_vendors rv JOIN vendors v ON v.id=rv.vendor_id
           WHERE rv.rfq_id=$1 AND rv.tenant_id=$2`, [rfqId, tenantId])
  ]);
  if (!rfqRes.rows.length) return null;
  return { ...rfqRes.rows[0], items: itemsRes.rows, vendors: vendorsRes.rows };
}

async function createRfq(tenantId, userId, data) {
  const { title, projectName, bomId, description, submissionDeadline, validityDays=30,
          deliveryLocation, paymentTerms, specialInstructions, items=[] } = data;
  return withTransaction(async (client) => {
    // Generate RFQ number
    const numRes = await client.query('SELECT gen_rfq_number($1) as num', [tenantId]);
    const rfqNumber = numRes.rows[0].num;

    // If BOM attached, validate it's in this tenant
    if (bomId) {
      const bomCheck = await client.query('SELECT id FROM boms WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL', [bomId, tenantId]);
      if (!bomCheck.rows.length) throw Object.assign(new Error('BOM not found'), { status: 404 });
    }

    const rfqRes = await client.query(
      `INSERT INTO rfqs (tenant_id,rfq_number,title,project_name,bom_id,description,submission_deadline,
       validity_days,delivery_location,payment_terms,special_instructions,status,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft',$12) RETURNING *`,
      [tenantId,rfqNumber,title,projectName||null,bomId||null,description||null,
       submissionDeadline||null,validityDays,deliveryLocation||null,
       paymentTerms||null,specialInstructions||null,userId]
    );
    const rfq = rfqRes.rows[0];

    // Add items
    for (let i=0; i<items.length; i++) {
      const it = items[i];
      await client.query(
        `INSERT INTO rfq_items (tenant_id,rfq_id,bom_item_id,line_number,category,description,unit,quantity,specifications)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [tenantId,rfq.id,it.bomItemId||null,(it.lineNumber||i+1),it.category||'General',
         it.description,it.unit||'Nos',it.quantity,JSON.stringify(it.specifications||{})]
      );
    }
    return rfq;
  });
}

async function importItemsFromBom(tenantId, rfqId, bomId) {
  // Copy items from BOM into RFQ
  const rfq = await getRfqById(tenantId, rfqId);
  if (!rfq) throw Object.assign(new Error('RFQ not found'), { status: 404 });
  if (rfq.status !== 'draft') throw Object.assign(new Error('RFQ not in draft'), { status: 400, code: 'NOT_DRAFT' });

  const bomItems = await query('SELECT * FROM bom_items WHERE bom_id=$1 AND tenant_id=$2 ORDER BY sort_order,line_number', [bomId, tenantId]);
  if (!bomItems.rows.length) throw Object.assign(new Error('BOM has no items'), { status: 400, code: 'BOM_EMPTY' });

  return withTransaction(async (client) => {
    await client.query('DELETE FROM rfq_items WHERE rfq_id=$1 AND tenant_id=$2', [rfqId, tenantId]);
    const inserted = [];
    for (const item of bomItems.rows) {
      const r = await client.query(
        `INSERT INTO rfq_items (tenant_id,rfq_id,bom_item_id,line_number,category,sub_category,description,unit,quantity,specifications)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [tenantId,rfqId,item.id,item.line_number,item.category,item.sub_category,item.description,item.unit,item.quantity,item.specifications]
      );
      inserted.push(r.rows[0]);
    }
    return inserted;
  });
}

async function addVendors(tenantId, rfqId, vendorIds) {
  const rfq = await getRfqById(tenantId, rfqId);
  if (!rfq) throw Object.assign(new Error('RFQ not found'), { status: 404 });
  if (!['draft','sent'].includes(rfq.status)) throw Object.assign(new Error('Cannot add vendors to this RFQ status'), { status: 400 });

  // Validate all vendors are approved and belong to tenant
  const vRes = await query(
    `SELECT id FROM vendors WHERE id=ANY($1) AND tenant_id=$2 AND status='approved' AND deleted_at IS NULL`,
    [vendorIds, tenantId]
  );
  const validIds = vRes.rows.map(r => r.id);
  if (validIds.length === 0) throw Object.assign(new Error('No approved vendors found in provided IDs'), { status: 400, code: 'NO_APPROVED_VENDORS' });

  const added = [];
  for (const vid of validIds) {
    const tokenExpiry = new Date(Date.now() + 30*24*60*60*1000); // 30 days
    const r = await query(
      `INSERT INTO rfq_vendors (tenant_id,rfq_id,vendor_id,token_expires_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (rfq_id,vendor_id) DO UPDATE SET token_expires_at=$4
       RETURNING *`,
      [tenantId, rfqId, vid, tokenExpiry]
    );
    added.push(r.rows[0]);
  }
  return { added: added.length, vendors: added };
}

async function removeVendor(tenantId, rfqId, vendorId) {
  const res = await query(
    'DELETE FROM rfq_vendors WHERE rfq_id=$1 AND vendor_id=$2 AND tenant_id=$3 RETURNING id',
    [rfqId, vendorId, tenantId]
  );
  if (!res.rows.length) throw Object.assign(new Error('Vendor not on this RFQ'), { status: 404 });
}

async function sendRfq(tenantId, rfqId, userId) {
  const rfq = await getRfqById(tenantId, rfqId);
  if (!rfq) throw Object.assign(new Error('RFQ not found'), { status: 404 });
  if (rfq.status !== 'draft') throw Object.assign(new Error('Only draft RFQs can be sent'), { status: 400, code: 'NOT_DRAFT' });
  if (!rfq.items.length) throw Object.assign(new Error('RFQ has no items'), { status: 400, code: 'NO_ITEMS' });
  if (!rfq.vendors.length) throw Object.assign(new Error('RFQ has no vendors'), { status: 400, code: 'NO_VENDORS' });

  const res = await query(
    `UPDATE rfqs SET status='sent',updated_by=$1,updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING *`,
    [userId, rfqId, tenantId]
  );
  // Mark vendors as invited
  await query(`UPDATE rfq_vendors SET status='invited',invited_at=NOW() WHERE rfq_id=$1`, [rfqId]);
  return res.rows[0];
}

async function closeRfq(tenantId, rfqId, userId) {
  const res = await query(
    `UPDATE rfqs SET status='closed',closed_at=NOW(),updated_by=$1,updated_at=NOW()
     WHERE id=$2 AND tenant_id=$3 AND status IN ('sent','open') RETURNING *`,
    [userId, rfqId, tenantId]
  );
  if (!res.rows.length) throw Object.assign(new Error('RFQ not found or cannot be closed'), { status: 400, code: 'CANNOT_CLOSE' });
  return res.rows[0];
}

async function cancelRfq(tenantId, rfqId, userId) {
  const res = await query(
    `UPDATE rfqs SET status='cancelled',updated_by=$1,updated_at=NOW()
     WHERE id=$2 AND tenant_id=$3 AND status NOT IN ('awarded','cancelled') RETURNING *`,
    [userId, rfqId, tenantId]
  );
  if (!res.rows.length) throw Object.assign(new Error('RFQ not found or already in terminal state'), { status: 400 });
  return res.rows[0];
}

async function deleteRfq(tenantId, rfqId) {
  const res = await query(
    `UPDATE rfqs SET deleted_at=NOW() WHERE id=$1 AND tenant_id=$2 AND status='draft' AND deleted_at IS NULL RETURNING id`,
    [rfqId, tenantId]
  );
  if (!res.rows.length) throw Object.assign(new Error('RFQ not found or not in draft'), { status: 400, code: 'CANNOT_DELETE' });
  return res.rows[0];
}

// Vendor-facing: get RFQ by access token (public endpoint)
async function getRfqByToken(accessToken) {
  const tokenRes = await query(
    `SELECT rv.*,v.company_name,v.contact_name,v.contact_email
     FROM rfq_vendors rv JOIN vendors v ON v.id=rv.vendor_id
     WHERE rv.access_token=$1 AND (rv.token_expires_at IS NULL OR rv.token_expires_at > NOW())`,
    [accessToken]
  );
  if (!tokenRes.rows.length) return null;
  const rv = tokenRes.rows[0];

  // Mark as viewed
  await query(`UPDATE rfq_vendors SET status=CASE WHEN status='invited' THEN 'viewed' ELSE status END,viewed_at=COALESCE(viewed_at,NOW()) WHERE id=$1`, [rv.id]);

  const [rfqRes, itemsRes] = await Promise.all([
    query(`SELECT r.id,r.rfq_number,r.title,r.project_name,r.description,r.submission_deadline,
                  r.validity_days,r.delivery_location,r.payment_terms,r.special_instructions,
                  t.name as tenant_name
           FROM rfqs r JOIN tenants t ON t.id=r.tenant_id
           WHERE r.id=$1 AND r.status IN ('sent','open')`, [rv.rfq_id]),
    query('SELECT * FROM rfq_items WHERE rfq_id=$1 ORDER BY line_number', [rv.rfq_id])
  ]);
  if (!rfqRes.rows.length) return null;
  return { rfq: rfqRes.rows[0], items: itemsRes.rows, vendor: { id:rv.vendor_id, name:rv.company_name, rfqVendorId:rv.id, status:rv.status } };
}

async function updateRfq(tenantId, rfqId, userId, data) {
  const rfq = await getRfqById(tenantId, rfqId);
  if (!rfq) throw Object.assign(new Error('RFQ not found'), { status: 404 });
  if (rfq.status !== 'draft') throw Object.assign(new Error('Only draft RFQs can be edited'), { status: 400, code: 'NOT_DRAFT' });
  const { title, projectName, description, submissionDeadline, validityDays, deliveryLocation, paymentTerms, specialInstructions } = data;
  const res = await query(
    `UPDATE rfqs SET title=COALESCE($1,title),project_name=COALESCE($2,project_name),
     description=COALESCE($3,description),submission_deadline=COALESCE($4,submission_deadline),
     validity_days=COALESCE($5,validity_days),delivery_location=COALESCE($6,delivery_location),
     payment_terms=COALESCE($7,payment_terms),special_instructions=COALESCE($8,special_instructions),
     updated_by=$9,updated_at=NOW() WHERE id=$10 AND tenant_id=$11 RETURNING *`,
    [title||null,projectName||null,description||null,submissionDeadline||null,
     validityDays||null,deliveryLocation||null,paymentTerms||null,specialInstructions||null,
     userId,rfqId,tenantId]
  );
  return res.rows[0];
}

module.exports = { getRfqs, getRfqById, createRfq, updateRfq, importItemsFromBom, addVendors, removeVendor, sendRfq, closeRfq, cancelRfq, deleteRfq, getRfqByToken };
