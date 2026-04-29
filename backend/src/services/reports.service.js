const { query } = require('../config/database');

async function getDashboardKpis(tenantId, { dateFrom, dateTo } = {}) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30*24*60*60*1000).toISOString();
  const from = dateFrom || thirtyDaysAgo;
  const to   = dateTo   || now.toISOString();

  const [kpis, rfqTrend, spendByVendor, poStatus, quoteActivity] = await Promise.all([
    query(`SELECT * FROM vw_tenant_kpis WHERE tenant_id=$1`, [tenantId]),

    query(`SELECT
             DATE_TRUNC('week', r.created_at) as week,
             COUNT(*) as rfq_count,
             COUNT(*) FILTER (WHERE r.status='awarded') as awarded_count
           FROM rfqs r
           WHERE r.tenant_id=$1 AND r.created_at BETWEEN $2 AND $3
           GROUP BY week ORDER BY week`, [tenantId, from, to]),

    query(`SELECT v.company_name, SUM(po.total_amount) as total_spend, COUNT(po.id) as po_count
           FROM purchase_orders po JOIN vendors v ON v.id=po.vendor_id
           WHERE po.tenant_id=$1 AND po.status IN ('approved','issued','closed')
             AND po.created_at BETWEEN $2 AND $3
           GROUP BY v.id, v.company_name ORDER BY total_spend DESC LIMIT 10`,
      [tenantId, from, to]),

    query(`SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount),0) as value
           FROM purchase_orders WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY status`,
      [tenantId]),

    query(`SELECT DATE_TRUNC('day', q.created_at) as day, COUNT(*) as quote_count,
                  COALESCE(SUM(q.total_amount),0) as total_value
           FROM quotes q
           WHERE q.tenant_id=$1 AND q.created_at BETWEEN $2 AND $3
           GROUP BY day ORDER BY day`, [tenantId, from, to]),
  ]);

  return {
    kpis: kpis.rows[0] || {},
    rfqTrend: rfqTrend.rows,
    spendByVendor: spendByVendor.rows,
    poStatus: poStatus.rows,
    quoteActivity: quoteActivity.rows,
    period: { from, to },
  };
}

async function getVendorReport(tenantId, { dateFrom, dateTo } = {}) {
  const from = dateFrom || new Date(Date.now() - 365*24*60*60*1000).toISOString();
  const to   = dateTo   || new Date().toISOString();
  const res = await query(
    `SELECT v.id, v.company_name, v.contact_email, v.status, v.approved_at,
            v.product_categories, v.certifications,
            COUNT(DISTINCT q.id) as quote_count,
            COUNT(DISTINCT q.id) FILTER (WHERE q.status='awarded') as awards,
            COALESCE(SUM(q.total_amount) FILTER (WHERE q.status='awarded'),0) as awarded_value,
            COUNT(DISTINCT po.id) as po_count,
            AVG(vp.overall_score) as avg_performance
     FROM vendors v
     LEFT JOIN quotes q ON q.vendor_id=v.id AND q.tenant_id=v.tenant_id
       AND q.created_at BETWEEN $2 AND $3
     LEFT JOIN purchase_orders po ON po.vendor_id=v.id AND po.tenant_id=v.tenant_id
       AND po.status IN ('approved','issued','closed')
     LEFT JOIN vendor_performance vp ON vp.vendor_id=v.id AND vp.tenant_id=v.tenant_id
     WHERE v.tenant_id=$1 AND v.deleted_at IS NULL
     GROUP BY v.id ORDER BY awarded_value DESC`,
    [tenantId, from, to]
  );
  return { vendors: res.rows, period: { from, to } };
}

async function getRfqReport(tenantId, { dateFrom, dateTo } = {}) {
  const from = dateFrom || new Date(Date.now() - 365*24*60*60*1000).toISOString();
  const to   = dateTo   || new Date().toISOString();
  const res = await query(
    `SELECT r.id, r.rfq_number, r.title, r.project_name, r.status, r.created_at,
            COUNT(DISTINCT rv.vendor_id) as vendor_count,
            COUNT(DISTINCT q.id) as quote_count,
            MIN(q.total_amount) as l1_price,
            MAX(q.total_amount) as h1_price,
            AVG(q.total_amount) as avg_price
     FROM rfqs r
     LEFT JOIN rfq_vendors rv ON rv.rfq_id=r.id
     LEFT JOIN quotes q ON q.rfq_id=r.id AND q.status IN ('submitted','shortlisted','awarded')
     WHERE r.tenant_id=$1 AND r.created_at BETWEEN $2 AND $3 AND r.deleted_at IS NULL
     GROUP BY r.id ORDER BY r.created_at DESC`,
    [tenantId, from, to]
  );
  return { rfqs: res.rows, period: { from, to } };
}

async function getSpendReport(tenantId, { dateFrom, dateTo } = {}) {
  const from = dateFrom || new Date(Date.now() - 365*24*60*60*1000).toISOString();
  const to   = dateTo   || new Date().toISOString();
  const [byMonth, byVendor, byStatus] = await Promise.all([
    query(`SELECT DATE_TRUNC('month', po.created_at) as month,
                  COUNT(*) as po_count, SUM(po.total_amount) as total_spend
           FROM purchase_orders po
           WHERE po.tenant_id=$1 AND po.status IN ('approved','issued','closed')
             AND po.created_at BETWEEN $2 AND $3 AND po.deleted_at IS NULL
           GROUP BY month ORDER BY month`, [tenantId, from, to]),
    query(`SELECT v.company_name, SUM(po.total_amount) as spend, COUNT(po.id) as pos
           FROM purchase_orders po JOIN vendors v ON v.id=po.vendor_id
           WHERE po.tenant_id=$1 AND po.status IN ('approved','issued','closed')
             AND po.created_at BETWEEN $2 AND $3 AND po.deleted_at IS NULL
           GROUP BY v.id,v.company_name ORDER BY spend DESC LIMIT 20`, [tenantId, from, to]),
    query(`SELECT status, COUNT(*) count, COALESCE(SUM(total_amount),0) value
           FROM purchase_orders WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY status`, [tenantId]),
  ]);
  return { byMonth: byMonth.rows, byVendor: byVendor.rows, byStatus: byStatus.rows, period: { from, to } };
}

async function getAuditSummary(tenantId, { dateFrom, dateTo } = {}) {
  const from = dateFrom || new Date(Date.now() - 30*24*60*60*1000).toISOString();
  const to   = dateTo   || new Date().toISOString();
  const [byAction, byUser, byStatus, recentCritical] = await Promise.all([
    query(`SELECT action, COUNT(*) count FROM audit_logs WHERE tenant_id=$1 AND created_at BETWEEN $2 AND $3 GROUP BY action ORDER BY count DESC LIMIT 20`, [tenantId,from,to]),
    query(`SELECT user_email, COUNT(*) count FROM audit_logs WHERE tenant_id=$1 AND created_at BETWEEN $2 AND $3 AND user_email IS NOT NULL GROUP BY user_email ORDER BY count DESC LIMIT 10`, [tenantId,from,to]),
    query(`SELECT status, COUNT(*) count FROM audit_logs WHERE tenant_id=$1 AND created_at BETWEEN $2 AND $3 GROUP BY status`, [tenantId,from,to]),
    query(`SELECT action,resource_type,resource_id,user_email,status,ip_address,created_at FROM audit_logs WHERE tenant_id=$1 AND status IN ('failure','unauthorized') AND created_at BETWEEN $2 AND $3 ORDER BY created_at DESC LIMIT 20`, [tenantId,from,to]),
  ]);
  return { byAction:byAction.rows, byUser:byUser.rows, byStatus:byStatus.rows, recentCritical:recentCritical.rows, period:{from,to} };
}

module.exports = { getDashboardKpis, getVendorReport, getRfqReport, getSpendReport, getAuditSummary };
