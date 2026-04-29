const { query, withTransaction } = require('../config/database');

// ── Compliance ─────────────────────────────────────────────
async function getCompliance(tenantId, vendorId) {
  const res = await query(
    `SELECT c.*, d.original_name as doc_name
     FROM vendor_compliance c
     LEFT JOIN vendor_documents d ON d.id = c.document_id
     WHERE c.vendor_id=$1 AND c.tenant_id=$2 ORDER BY c.expiry_date ASC NULLS LAST`,
    [vendorId, tenantId]
  );
  return res.rows;
}

async function upsertCompliance(tenantId, vendorId, data) {
  const { id, certName, certNumber, issuedBy, issuedDate, expiryDate, status, documentId, notes } = data;

  // auto-compute status from expiry date if not provided
  let computedStatus = status || 'valid';
  if (expiryDate && !status) {
    const daysLeft = Math.floor((new Date(expiryDate) - new Date()) / 86400000);
    if (daysLeft < 0) computedStatus = 'expired';
    else if (daysLeft <= 90) computedStatus = 'expiring_soon';
    else computedStatus = 'valid';
  }

  if (id) {
    const res = await query(
      `UPDATE vendor_compliance SET cert_name=$1, cert_number=$2, issued_by=$3, issued_date=$4,
       expiry_date=$5, status=$6, document_id=$7, notes=$8, updated_at=NOW()
       WHERE id=$9 AND tenant_id=$10 AND vendor_id=$11 RETURNING *`,
      [certName, certNumber||null, issuedBy||null, issuedDate||null, expiryDate||null, computedStatus, documentId||null, notes||null, id, tenantId, vendorId]
    );
    return res.rows[0];
  } else {
    const res = await query(
      `INSERT INTO vendor_compliance (tenant_id,vendor_id,cert_name,cert_number,issued_by,issued_date,expiry_date,status,document_id,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [tenantId, vendorId, certName, certNumber||null, issuedBy||null, issuedDate||null, expiryDate||null, computedStatus, documentId||null, notes||null]
    );
    return res.rows[0];
  }
}

async function deleteCompliance(tenantId, certId) {
  const res = await query('DELETE FROM vendor_compliance WHERE id=$1 AND tenant_id=$2 RETURNING id', [certId, tenantId]);
  if (!res.rows.length) throw Object.assign(new Error('Compliance record not found'), { status: 404 });
  return res.rows[0];
}

// ── Performance ────────────────────────────────────────────
async function getPerformance(tenantId, vendorId) {
  const res = await query(
    'SELECT * FROM vendor_performance WHERE vendor_id=$1 AND tenant_id=$2 ORDER BY period_year DESC, period_quarter DESC',
    [vendorId, tenantId]
  );
  return res.rows;
}

async function upsertPerformance(tenantId, vendorId, evaluatorId, data) {
  const { periodYear, periodQuarter, onTimeDeliveryPct, qualityScore, priceCompetitiveness, responsivenessScore, notes } = data;
  const res = await query(
    `INSERT INTO vendor_performance (tenant_id,vendor_id,period_year,period_quarter,on_time_delivery_pct,quality_score,price_competitiveness,responsiveness_score,notes,evaluated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (tenant_id,vendor_id,period_year,period_quarter)
     DO UPDATE SET on_time_delivery_pct=$5,quality_score=$6,price_competitiveness=$7,responsiveness_score=$8,notes=$9,evaluated_by=$10
     RETURNING *`,
    [tenantId, vendorId, periodYear, periodQuarter||null, onTimeDeliveryPct||null, qualityScore||null, priceCompetitiveness||null, responsivenessScore||null, notes||null, evaluatorId]
  );
  return res.rows[0];
}

// ── Expiry alerts (tenancy-wide) ───────────────────────────
async function getExpiringCerts(tenantId, days = 90) {
  const res = await query(
    `SELECT c.*, v.company_name, v.contact_email
     FROM vendor_compliance c JOIN vendors v ON v.id=c.vendor_id
     WHERE c.tenant_id=$1 AND c.expiry_date IS NOT NULL
       AND c.expiry_date <= NOW() + ($2 || ' days')::INTERVAL
       AND c.expiry_date >= NOW()
     ORDER BY c.expiry_date ASC`,
    [tenantId, days]
  );
  return res.rows;
}

module.exports = { getCompliance, upsertCompliance, deleteCompliance, getPerformance, upsertPerformance, getExpiringCerts };
