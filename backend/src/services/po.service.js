const { query, withTransaction } = require('../config/database');

async function getPos(tenantId, { status, vendorId, search, page=1, limit=25 }) {
  const offset=(page-1)*limit;
  let where='WHERE po.tenant_id=$1 AND po.deleted_at IS NULL';
  const params=[tenantId]; let idx=2;
  if (status)   { where+=` AND po.status=$${idx++}`;            params.push(status); }
  if (vendorId) { where+=` AND po.vendor_id=$${idx++}`;         params.push(vendorId); }
  if (search)   { where+=` AND (po.po_number ILIKE $${idx} OR po.title ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
  const [cnt,rows]=await Promise.all([
    query(`SELECT COUNT(*) FROM purchase_orders po ${where}`, params),
    query(`SELECT po.id,po.po_number,po.title,po.status,po.total_amount,po.currency,
                  po.current_level,po.approval_levels,po.delivery_date,po.created_at,
                  v.company_name as vendor_name,
                  u.first_name||' '||u.last_name as created_by_name,
                  r.rfq_number
           FROM purchase_orders po
           JOIN vendors v ON v.id=po.vendor_id
           JOIN users u ON u.id=po.created_by
           LEFT JOIN rfqs r ON r.id=po.rfq_id
           ${where} ORDER BY po.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
      [...params,limit,offset])
  ]);
  return { rows:rows.rows, total:parseInt(cnt.rows[0].count) };
}

async function getPoById(tenantId, poId) {
  const [poRes,itemsRes,approvalsRes]=await Promise.all([
    query(`SELECT po.*,v.company_name as vendor_name,v.contact_email as vendor_email,
                  u.first_name||' '||u.last_name as created_by_name,r.rfq_number,q.quote_number
           FROM purchase_orders po
           JOIN vendors v ON v.id=po.vendor_id
           JOIN users u ON u.id=po.created_by
           LEFT JOIN rfqs r ON r.id=po.rfq_id
           LEFT JOIN quotes q ON q.id=po.quote_id
           WHERE po.id=$1 AND po.tenant_id=$2 AND po.deleted_at IS NULL`, [poId,tenantId]),
    query('SELECT * FROM po_items WHERE po_id=$1 ORDER BY line_number', [poId]),
    query(`SELECT pa.*,u.first_name||' '||u.last_name as approver_name,u.email as approver_email
           FROM po_approvals pa JOIN users u ON u.id=pa.approver_id
           WHERE pa.po_id=$1 ORDER BY pa.level,pa.acted_at`, [poId])
  ]);
  if (!poRes.rows.length) return null;
  return { ...poRes.rows[0], items:itemsRes.rows, approvals:approvalsRes.rows };
}

async function createPo(tenantId, userId, data) {
  const { rfqId, quoteId, vendorId, evaluationId, title, description, totalAmount,
          currency='INR', deliveryDate, deliveryLocation, paymentTerms, specialConditions,
          approvalLevels=2, items=[] } = data;

  // Validate vendor
  const vCheck=await query('SELECT id,status FROM vendors WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL',[vendorId,tenantId]);
  if (!vCheck.rows.length) throw Object.assign(new Error('Vendor not found'),{ status:404 });
  if (vCheck.rows[0].status !== 'approved') throw Object.assign(new Error('Vendor must be approved'),{ status:400, code:'VENDOR_NOT_APPROVED' });

  return withTransaction(async (client) => {
    const numRes=await client.query('SELECT gen_po_number($1) as num',[tenantId]);
    const poNumber=numRes.rows[0].num;
    const poRes=await client.query(
      `INSERT INTO purchase_orders (tenant_id,po_number,rfq_id,quote_id,vendor_id,evaluation_id,
       title,description,total_amount,currency,delivery_date,delivery_location,payment_terms,
       special_conditions,approval_levels,status,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'draft',$16) RETURNING *`,
      [tenantId,poNumber,rfqId||null,quoteId||null,vendorId,evaluationId||null,
       title,description||null,totalAmount,currency,deliveryDate||null,
       deliveryLocation||null,paymentTerms||null,specialConditions||null,approvalLevels,userId]
    );
    const po=poRes.rows[0];
    for (let i=0;i<items.length;i++) {
      const it=items[i];
      await client.query(
        `INSERT INTO po_items (tenant_id,po_id,line_number,description,unit,quantity,unit_rate,hsn_code,gst_rate,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [tenantId,po.id,(it.lineNumber||i+1),it.description,it.unit||'Nos',it.quantity,it.unitRate,it.hsnCode||null,it.gstRate||18.0,it.notes||null]
      );
    }
    return po;
  });
}

async function updatePo(tenantId, poId, userId, data) {
  const po=await getPoById(tenantId,poId);
  if (!po) throw Object.assign(new Error('PO not found'),{ status:404 });
  if (!['draft','pending_approval'].includes(po.status))
    throw Object.assign(new Error('Cannot edit PO in current status'),{ status:400, code:'CANNOT_EDIT' });
  const { title,description,deliveryDate,deliveryLocation,paymentTerms,specialConditions } = data;
  const res=await query(
    `UPDATE purchase_orders SET title=COALESCE($1,title),description=COALESCE($2,description),
     delivery_date=COALESCE($3,delivery_date),delivery_location=COALESCE($4,delivery_location),
     payment_terms=COALESCE($5,payment_terms),special_conditions=COALESCE($6,special_conditions),
     updated_at=NOW() WHERE id=$7 AND tenant_id=$8 RETURNING *`,
    [title||null,description||null,deliveryDate||null,deliveryLocation||null,paymentTerms||null,specialConditions||null,poId,tenantId]
  );
  return res.rows[0];
}

async function submitForApproval(tenantId, poId, userId) {
  const po=await getPoById(tenantId,poId);
  if (!po) throw Object.assign(new Error('PO not found'),{ status:404 });
  if (po.status !== 'draft') throw Object.assign(new Error('Only draft POs can be submitted'),{ status:400, code:'NOT_DRAFT' });
  if (!po.items.length) throw Object.assign(new Error('PO must have at least one item'),{ status:400, code:'NO_ITEMS' });
  const res=await query(
    `UPDATE purchase_orders SET status='pending_approval',current_level=1,updated_at=NOW()
     WHERE id=$1 AND tenant_id=$2 RETURNING *`,
    [poId,tenantId]
  );
  return res.rows[0];
}

async function approveOrReject(tenantId, poId, approverId, action, comments) {
  const po=await getPoById(tenantId,poId);
  if (!po) throw Object.assign(new Error('PO not found'),{ status:404 });
  if (po.status !== 'pending_approval')
    throw Object.assign(new Error('PO is not pending approval'),{ status:400, code:'NOT_PENDING' });

  // Get approver role info
  const roleRes=await query(
    `SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id=r.id
     WHERE ur.user_id=$1 AND ur.tenant_id=$2 ORDER BY r.name LIMIT 1`,
    [approverId,tenantId]
  );
  const roleName=roleRes.rows[0]?.name||'Unknown';

  return withTransaction(async (client) => {
    // Record approval action
    await client.query(
      `INSERT INTO po_approvals (tenant_id,po_id,level,approver_id,role_name,action,comments)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [tenantId,poId,po.current_level,approverId,roleName,action,comments||null]
    );

    let newStatus, newLevel;
    if (action==='rejected') {
      newStatus='rejected'; newLevel=po.current_level;
    } else if (action==='requested_changes') {
      newStatus='draft'; newLevel=0;
    } else {
      // approved
      if (po.current_level >= po.approval_levels) {
        newStatus='approved'; newLevel=po.current_level;
      } else {
        newStatus='pending_approval'; newLevel=po.current_level+1;
      }
    }

    const res=await client.query(
      `UPDATE purchase_orders SET status=$1,current_level=$2,updated_at=NOW()
       WHERE id=$3 AND tenant_id=$4 RETURNING *`,
      [newStatus,newLevel,poId,tenantId]
    );
    return res.rows[0];
  });
}

async function issuePo(tenantId, poId, userId) {
  const res=await query(
    `UPDATE purchase_orders SET status='issued',issued_by=$1,issued_at=NOW(),updated_at=NOW()
     WHERE id=$2 AND tenant_id=$3 AND status='approved' RETURNING *`,
    [userId,poId,tenantId]
  );
  if (!res.rows.length) throw Object.assign(new Error('PO not found or not approved'),{ status:400, code:'NOT_APPROVED' });
  return res.rows[0];
}

async function cancelPo(tenantId, poId, userId, reason) {
  const po=await getPoById(tenantId,poId);
  if (!po) throw Object.assign(new Error('PO not found'),{ status:404 });
  if (['issued','closed'].includes(po.status))
    throw Object.assign(new Error('Cannot cancel issued or closed PO'),{ status:400, code:'CANNOT_CANCEL' });
  const res=await query(
    `UPDATE purchase_orders SET status='cancelled',cancelled_by=$1,cancelled_at=NOW(),
     cancellation_reason=$2,updated_at=NOW() WHERE id=$3 AND tenant_id=$4 RETURNING *`,
    [userId,reason||null,poId,tenantId]
  );
  return res.rows[0];
}

async function getStats(tenantId) {
  const res=await query(
    `SELECT status,COUNT(*) count,COALESCE(SUM(total_amount),0) value
     FROM purchase_orders WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY status`,
    [tenantId]
  );
  const stats={draft:{count:0,value:0},pending_approval:{count:0,value:0},approved:{count:0,value:0},
               rejected:{count:0,value:0},issued:{count:0,value:0},closed:{count:0,value:0},
               cancelled:{count:0,value:0},total:{count:0,value:0}};
  for (const r of res.rows) {
    stats[r.status]={ count:parseInt(r.count), value:parseFloat(r.value) };
    stats.total.count+=parseInt(r.count);
    stats.total.value+=parseFloat(r.value);
  }
  return stats;
}

module.exports = { getPos, getPoById, createPo, updatePo, submitForApproval, approveOrReject, issuePo, cancelPo, getStats };
