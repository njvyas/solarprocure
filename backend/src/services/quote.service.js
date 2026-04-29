const { query, withTransaction } = require('../config/database');

async function getQuotes(tenantId, { rfqId, vendorId, status, page=1, limit=25 }) {
  const offset = (page-1)*limit;
  let where = 'WHERE q.tenant_id=$1';
  const params = [tenantId]; let idx=2;
  if (rfqId)   { where+=` AND q.rfq_id=$${idx++}`; params.push(rfqId); }
  if (vendorId){ where+=` AND q.vendor_id=$${idx++}`; params.push(vendorId); }
  if (status)  { where+=` AND q.status=$${idx++}`; params.push(status); }
  const [cnt,rows] = await Promise.all([
    query(`SELECT COUNT(*) FROM quotes q ${where}`, params),
    query(`SELECT q.id,q.rfq_id,q.vendor_id,q.quote_number,q.status,q.total_amount,q.currency,
                  q.validity_days,q.delivery_weeks,q.submitted_at,q.created_at,
                  v.company_name as vendor_name,r.rfq_number,r.title as rfq_title
           FROM quotes q
           JOIN vendors v ON v.id=q.vendor_id
           JOIN rfqs r ON r.id=q.rfq_id
           ${where} ORDER BY q.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, limit, offset])
  ]);
  return { rows:rows.rows, total:parseInt(cnt.rows[0].count) };
}

async function getQuoteById(tenantId, quoteId) {
  const [qRes, itemsRes] = await Promise.all([
    query(`SELECT q.*,v.company_name as vendor_name,r.rfq_number,r.title as rfq_title
           FROM quotes q
           JOIN vendors v ON v.id=q.vendor_id
           JOIN rfqs r ON r.id=q.rfq_id
           WHERE q.id=$1 AND q.tenant_id=$2`, [quoteId, tenantId]),
    query(`SELECT qi.*,ri.category,ri.description as rfq_description
           FROM quote_items qi JOIN rfq_items ri ON ri.id=qi.rfq_item_id
           WHERE qi.quote_id=$1 AND qi.tenant_id=$2 ORDER BY qi.line_number`, [quoteId, tenantId])
  ]);
  if (!qRes.rows.length) return null;
  return { ...qRes.rows[0], items: itemsRes.rows };
}

// Called by vendor via token (public endpoint)
async function submitQuoteByToken(accessToken, data) {
  const { query: dbQuery, withTransaction: wt } = require('../config/database');

  // Validate token
  const tvRes = await dbQuery(
    `SELECT rv.*,v.tenant_id FROM rfq_vendors rv JOIN vendors v ON v.id=rv.vendor_id
     WHERE rv.access_token=$1 AND (rv.token_expires_at IS NULL OR rv.token_expires_at>NOW())`,
    [accessToken]
  );
  if (!tvRes.rows.length) throw Object.assign(new Error('Invalid or expired token'), { status: 401, code: 'INVALID_TOKEN' });
  const rv = tvRes.rows[0];
  const tenantId = rv.tenant_id;

  // Check RFQ is still open/sent
  const rfqRes = await dbQuery(`SELECT * FROM rfqs WHERE id=$1 AND status IN ('sent','open')`, [rv.rfq_id]);
  if (!rfqRes.rows.length) throw Object.assign(new Error('RFQ is not accepting quotes'), { status: 400, code: 'RFQ_NOT_OPEN' });

  return wt(async (client) => {
    // Upsert quote header
    const seq = await client.query(`SELECT 'Q-'||TO_CHAR(NOW(),'YYYYMMDD')||'-'||nextval('rfq_seq') as qn`);
    const qn = seq.rows[0].qn;

    const qRes = await client.query(
      `INSERT INTO quotes (tenant_id,rfq_id,vendor_id,rfq_vendor_id,quote_number,status,
       total_amount,currency,validity_days,delivery_weeks,payment_terms,notes,submitted_at)
       VALUES ($1,$2,$3,$4,$5,'submitted',$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (rfq_id,vendor_id) DO UPDATE SET
         status='submitted',total_amount=$6,currency=$7,validity_days=$8,
         delivery_weeks=$9,payment_terms=$10,notes=$11,submitted_at=NOW(),updated_at=NOW()
       RETURNING *`,
      [tenantId,rv.rfq_id,rv.vendor_id,rv.id,qn,
       data.totalAmount||null,data.currency||'INR',
       data.validityDays||30,data.deliveryWeeks||null,
       data.paymentTerms||null,data.notes||null]
    );
    const quote = qRes.rows[0];

    // Upsert line items
    if (data.items && data.items.length) {
      await client.query('DELETE FROM quote_items WHERE quote_id=$1', [quote.id]);
      for (const item of data.items) {
        await client.query(
          `INSERT INTO quote_items (tenant_id,quote_id,rfq_item_id,line_number,description,unit,quantity,unit_rate,make_model,delivery_weeks,notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [tenantId,quote.id,item.rfqItemId,item.lineNumber,item.description,item.unit,item.quantity,item.unitRate,item.makeModel||null,item.deliveryWeeks||null,item.notes||null]
        );
      }
      // Auto-calc total from items
      await client.query(
        `UPDATE quotes SET total_amount=(SELECT COALESCE(SUM(total_amount),0) FROM quote_items WHERE quote_id=$1) WHERE id=$1`,
        [quote.id]
      );
    }

    // Update rfq_vendors status
    await client.query(`UPDATE rfq_vendors SET status='submitted',responded_at=NOW() WHERE id=$1`, [rv.id]);

    return quote;
  });
}

// Internal: admin submits on behalf (rare), or vendor re-submits
async function evaluateQuote(tenantId, quoteId, evaluatorId, { status, evaluationNotes }) {
  const validStatuses = ['shortlisted','rejected','awarded'];
  if (!validStatuses.includes(status)) throw Object.assign(new Error('Invalid evaluation status'), { status: 400 });

  const res = await query(
    `UPDATE quotes SET status=$1,evaluation_notes=$2,evaluated_by=$3,evaluated_at=NOW(),updated_at=NOW()
     WHERE id=$4 AND tenant_id=$5 AND status IN ('submitted','shortlisted')
     RETURNING *`,
    [status, evaluationNotes||null, evaluatorId, quoteId, tenantId]
  );
  if (!res.rows.length) throw Object.assign(new Error('Quote not found or cannot be evaluated'), { status: 400 });

  // If awarding, update RFQ status
  if (status === 'awarded') {
    const q = res.rows[0];
    await query(`UPDATE rfqs SET status='awarded',awarded_at=NOW() WHERE id=$1 AND tenant_id=$2`, [q.rfq_id, tenantId]);
  }
  return res.rows[0];
}

async function getComparisonMatrix(tenantId, rfqId) {
  // Build comparison: rows = RFQ items, cols = vendors
  const rfqItems = await query(
    'SELECT * FROM rfq_items WHERE rfq_id=$1 AND tenant_id=$2 ORDER BY line_number',
    [rfqId, tenantId]
  );
  const quotes = await query(
    `SELECT q.id,q.vendor_id,q.total_amount,q.status,v.company_name,
            json_agg(json_build_object('rfqItemId',qi.rfq_item_id,'lineNumber',qi.line_number,'unitRate',qi.unit_rate,'totalAmount',qi.total_amount,'makeModel',qi.make_model) ORDER BY qi.line_number) as items
     FROM quotes q
     JOIN vendors v ON v.id=q.vendor_id
     LEFT JOIN quote_items qi ON qi.quote_id=q.id
     WHERE q.rfq_id=$1 AND q.tenant_id=$2 AND q.status IN ('submitted','shortlisted','awarded')
     GROUP BY q.id,v.company_name`,
    [rfqId, tenantId]
  );
  return { rfqItems: rfqItems.rows, quotes: quotes.rows };
}

async function withdrawQuote(tenantId, quoteId) {
  const res = await query(
    `UPDATE quotes SET status='withdrawn',updated_at=NOW() WHERE id=$1 AND tenant_id=$2 AND status IN ('draft','submitted') RETURNING *`,
    [quoteId, tenantId]
  );
  if (!res.rows.length) throw Object.assign(new Error('Quote not found or cannot be withdrawn'), { status: 400 });
  return res.rows[0];
}

module.exports = { getQuotes, getQuoteById, submitQuoteByToken, evaluateQuote, getComparisonMatrix, withdrawQuote };
