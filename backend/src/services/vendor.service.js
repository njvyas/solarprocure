const { query, withTransaction } = require('../config/database');
const { audit } = require('./audit.service');
const logger = require('../utils/logger');

async function getVendors(tenantId, { status, search, page = 1, limit = 25 }) {
  const offset = (page - 1) * limit;
  let where = 'WHERE v.tenant_id = $1 AND v.deleted_at IS NULL';
  const params = [tenantId];
  let idx = 2;

  if (status) { where += ` AND v.status = $${idx++}`; params.push(status); }
  if (search) {
    where += ` AND (v.company_name ILIKE $${idx} OR v.contact_email ILIKE $${idx} OR v.gst_number ILIKE $${idx})`;
    params.push(`%${search}%`); idx++;
  }

  const [countRes, rowsRes] = await Promise.all([
    query(`SELECT COUNT(*) FROM vendors v ${where}`, params),
    query(
      `SELECT v.id, v.company_name, v.contact_name, v.contact_email, v.contact_phone,
              v.gst_number, v.pan_number, v.product_categories, v.certifications,
              v.status, v.reviewed_at, v.approved_at, v.created_at,
              COALESCE(json_agg(json_build_object('id',d.id,'doc_type',d.doc_type,'original_name',d.original_name,'uploaded_at',d.uploaded_at))
                FILTER (WHERE d.id IS NOT NULL), '[]') as documents
       FROM vendors v
       LEFT JOIN vendor_documents d ON d.vendor_id = v.id
       ${where}
       GROUP BY v.id
       ORDER BY v.created_at DESC
       LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, limit, offset]
    ),
  ]);

  return { rows: rowsRes.rows, total: parseInt(countRes.rows[0].count) };
}

async function getVendorById(tenantId, vendorId) {
  const res = await query(
    `SELECT v.*,
            COALESCE(json_agg(json_build_object('id',d.id,'doc_type',d.doc_type,'original_name',d.original_name,'mime_type',d.mime_type,'size_bytes',d.size_bytes,'uploaded_at',d.uploaded_at))
              FILTER (WHERE d.id IS NOT NULL), '[]') as documents
     FROM vendors v
     LEFT JOIN vendor_documents d ON d.vendor_id = v.id
     WHERE v.id = $1 AND v.tenant_id = $2 AND v.deleted_at IS NULL
     GROUP BY v.id`,
    [vendorId, tenantId]
  );
  return res.rows[0] || null;
}

async function registerVendor(tenantId, data, uploadedFiles = []) {
  const { companyName, contactName, contactEmail, contactPhone, gstNumber, panNumber,
          website, address, productCategories, certifications } = data;

  // Duplicate checks
  if (gstNumber) {
    const dup = await query('SELECT id FROM vendors WHERE tenant_id=$1 AND gst_number=$2 AND deleted_at IS NULL', [tenantId, gstNumber]);
    if (dup.rows.length > 0) throw Object.assign(new Error('GST number already registered'), { status: 409, code: 'DUPLICATE_GST' });
  }
  const dupEmail = await query('SELECT id FROM vendors WHERE tenant_id=$1 AND contact_email=$2 AND deleted_at IS NULL', [tenantId, contactEmail]);
  if (dupEmail.rows.length > 0) throw Object.assign(new Error('Email already registered'), { status: 409, code: 'DUPLICATE_EMAIL' });

  return withTransaction(async (client) => {
    const vRes = await client.query(
      `INSERT INTO vendors (tenant_id, company_name, contact_name, contact_email, contact_phone,
        gst_number, pan_number, website, address, product_categories, certifications, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')
       RETURNING *`,
      [tenantId, companyName, contactName, contactEmail, contactPhone||null,
       gstNumber||null, panNumber||null, website||null,
       address ? JSON.stringify(address) : null,
       productCategories || [], certifications || []]
    );
    const vendor = vRes.rows[0];

    for (const file of uploadedFiles) {
      const docType = file.fieldname.replace('doc_', '') || 'other';
      await client.query(
        `INSERT INTO vendor_documents (tenant_id, vendor_id, doc_type, original_name, stored_name, mime_type, size_bytes, storage_path)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [tenantId, vendor.id, docType, file.originalName, file.storedName, file.mimeType, file.sizeBytes, file.relPath]
      );
    }

    return vendor;
  });
}

async function reviewVendor(tenantId, vendorId, reviewerId, action, { reason, note } = {}) {
  const vendor = await getVendorById(tenantId, vendorId);
  if (!vendor) throw Object.assign(new Error('Vendor not found'), { status: 404 });
  if (vendor.status === 'approved') throw Object.assign(new Error('Vendor already approved'), { status: 400, code: 'ALREADY_APPROVED' });

  const statusMap = { approve: 'approved', reject: 'rejected', request_changes: 'changes_requested' };
  const newStatus = statusMap[action];
  if (!newStatus) throw Object.assign(new Error('Invalid action'), { status: 400 });

  const res = await query(
    `UPDATE vendors SET
       status = $1,
       reviewed_by = $2, reviewed_at = NOW(),
       approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE NULL END,
       rejection_reason = CASE WHEN $1 = 'rejected' THEN $3 ELSE rejection_reason END,
       change_request_note = CASE WHEN $1 = 'changes_requested' THEN $4 ELSE change_request_note END,
       updated_at = NOW()
     WHERE id = $5 AND tenant_id = $6
     RETURNING *`,
    [newStatus, reviewerId, reason||null, note||null, vendorId, tenantId]
  );

  return res.rows[0];
}

async function updateVendor(tenantId, vendorId, data) {
  const vendor = await getVendorById(tenantId, vendorId);
  if (!vendor) throw Object.assign(new Error('Vendor not found'), { status: 404 });

  const { companyName, contactName, contactPhone, website, address, productCategories, certifications } = data;
  const res = await query(
    `UPDATE vendors SET
       company_name = COALESCE($1, company_name),
       contact_name = COALESCE($2, contact_name),
       contact_phone = COALESCE($3, contact_phone),
       website = COALESCE($4, website),
       address = COALESCE($5, address),
       product_categories = COALESCE($6, product_categories),
       certifications = COALESCE($7, certifications),
       status = CASE WHEN status = 'changes_requested' THEN 'pending' ELSE status END,
       updated_at = NOW()
     WHERE id = $8 AND tenant_id = $9 RETURNING *`,
    [companyName||null, contactName||null, contactPhone||null, website||null,
     address?JSON.stringify(address):null,
     productCategories||null, certifications||null, vendorId, tenantId]
  );
  return res.rows[0];
}

async function deleteVendor(tenantId, vendorId) {
  const res = await query(
    'UPDATE vendors SET deleted_at=NOW(), updated_at=NOW() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL RETURNING id',
    [vendorId, tenantId]
  );
  if (res.rows.length === 0) throw Object.assign(new Error('Vendor not found'), { status: 404 });
  return res.rows[0];
}

async function serveDocument(tenantId, docId) {
  const res = await query(
    `SELECT d.* FROM vendor_documents d
     JOIN vendors v ON v.id = d.vendor_id
     WHERE d.id = $1 AND d.tenant_id = $2 AND v.deleted_at IS NULL`,
    [docId, tenantId]
  );
  return res.rows[0] || null;
}

module.exports = { getVendors, getVendorById, registerVendor, reviewVendor, updateVendor, deleteVendor, serveDocument };
