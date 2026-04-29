const { query, withTransaction } = require('../config/database');

async function createEvaluation(tenantId, userId, data) {
  const { rfqId, title, evaluationType='weighted', criteria=[], notes } = data;
  const rfqCheck = await query(
    'SELECT id FROM rfqs WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL', [rfqId, tenantId]
  );
  if (!rfqCheck.rows.length) throw Object.assign(new Error('RFQ not found'), { status:404 });

  return withTransaction(async (client) => {
    const evRes = await client.query(
      `INSERT INTO evaluations (tenant_id,rfq_id,title,evaluation_type,notes,status,created_by)
       VALUES ($1,$2,$3,$4,$5,'draft',$6) RETURNING *`,
      [tenantId,rfqId,title,evaluationType,notes||null,userId]
    );
    const ev = evRes.rows[0];

    // Default criteria based on type
    const defaultCriteria = evaluationType === 'l1'
      ? [{ name:'Price', weight:100, criterion_type:'price' }]
      : evaluationType === 'technical_commercial'
      ? [{ name:'Technical', weight:60, criterion_type:'technical' },{ name:'Commercial / Price', weight:40, criterion_type:'commercial' }]
      : criteria.length ? criteria
      : [{ name:'Price', weight:50, criterion_type:'price' },{ name:'Technical Compliance', weight:25, criterion_type:'technical' },{ name:'Delivery Schedule', weight:15, criterion_type:'delivery' },{ name:'Experience & References', weight:10, criterion_type:'manual' }];

    // Validate weights sum to 100
    const total = defaultCriteria.reduce((s,c) => s + (parseFloat(c.weight)||0), 0);
    if (Math.abs(total - 100) > 0.01) throw Object.assign(new Error(`Criteria weights must sum to 100 (got ${total})`), { status:400, code:'WEIGHT_SUM_INVALID' });

    for (let i=0; i<defaultCriteria.length; i++) {
      const c = defaultCriteria[i];
      await client.query(
        `INSERT INTO evaluation_criteria (tenant_id,evaluation_id,name,description,weight,criterion_type,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [tenantId,ev.id,c.name,c.description||null,c.weight,c.criterion_type||'manual',i*10]
      );
    }
    return ev;
  });
}

async function getEvaluation(tenantId, evaluationId) {
  const [evRes, criteriaRes, scoresRes, quotesRes] = await Promise.all([
    query(`SELECT e.*,r.rfq_number,r.title as rfq_title FROM evaluations e
           JOIN rfqs r ON r.id=e.rfq_id WHERE e.id=$1 AND e.tenant_id=$2`, [evaluationId, tenantId]),
    query(`SELECT * FROM evaluation_criteria WHERE evaluation_id=$1 ORDER BY sort_order`, [evaluationId]),
    query(`SELECT es.*,v.company_name FROM evaluation_scores es JOIN vendors v ON v.id=es.vendor_id
           WHERE es.evaluation_id=$1`, [evaluationId]),
    query(`SELECT q.id,q.vendor_id,q.total_amount,q.status,v.company_name FROM quotes q
           JOIN vendors v ON v.id=q.vendor_id
           WHERE q.rfq_id=(SELECT rfq_id FROM evaluations WHERE id=$1) AND q.tenant_id=$2
           AND q.status IN ('submitted','shortlisted','awarded')`, [evaluationId, tenantId])
  ]);
  if (!evRes.rows.length) return null;

  const ev = evRes.rows[0];
  const criteria = criteriaRes.rows;
  const scores = scoresRes.rows;
  const quotes = quotesRes.rows;

  // Build score matrix + weighted scores
  const matrix = quotes.map(vendor => {
    let totalWeighted = 0;
    const criteriaScores = criteria.map(c => {
      let score = null;
      // Auto-score price criteria from quote amounts
      if (c.criterion_type === 'price' && vendor.total_amount) {
        const amounts = quotes.map(q => parseFloat(q.total_amount||0)).filter(a=>a>0);
        const minAmt = Math.min(...amounts);
        score = amounts.length > 0 ? Math.round((minAmt / parseFloat(vendor.total_amount)) * 100) : null;
      } else {
        const s = scores.find(s => s.criterion_id === c.id && s.vendor_id === vendor.vendor_id);
        score = s ? parseFloat(s.raw_score) : null;
      }
      const weighted = score != null ? (score * parseFloat(c.weight)) / 100 : null;
      if (weighted != null) totalWeighted += weighted;
      return { criterionId:c.id, criterionName:c.name, weight:c.weight, rawScore:score, weightedScore:weighted };
    });
    const allScored = criteriaScores.every(cs => cs.rawScore != null);
    return { vendorId:vendor.vendor_id, vendorName:vendor.company_name, quoteId:vendor.id, totalAmount:vendor.total_amount, criteriaScores, totalWeightedScore: allScored ? Math.round(totalWeighted*100)/100 : null };
  }).sort((a,b) => (b.totalWeightedScore||0) - (a.totalWeightedScore||0));

  return { ...ev, criteria, matrix, quotes };
}

async function scoreVendor(tenantId, evaluationId, scorerId, vendorId, criterionId, rawScore, notes) {
  const ev = await getEvaluation(tenantId, evaluationId);
  if (!ev) throw Object.assign(new Error('Evaluation not found'), { status:404 });
  if (ev.status === 'finalized') throw Object.assign(new Error('Evaluation is finalized'), { status:400, code:'EVAL_FINALIZED' });

  // Validate criterion belongs to eval
  const crit = ev.criteria.find(c => c.id === criterionId);
  if (!crit) throw Object.assign(new Error('Criterion not found on this evaluation'), { status:404 });
  if (crit.criterion_type === 'price') throw Object.assign(new Error('Price criterion is auto-scored'), { status:400, code:'AUTO_SCORED' });

  const res = await query(
    `INSERT INTO evaluation_scores (tenant_id,evaluation_id,criterion_id,vendor_id,raw_score,notes,scored_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (evaluation_id,criterion_id,vendor_id)
     DO UPDATE SET raw_score=$5,notes=$6,scored_by=$7,scored_at=NOW()
     RETURNING *`,
    [tenantId,evaluationId,criterionId,vendorId,rawScore,notes||null,scorerId]
  );
  return res.rows[0];
}

async function finalizeEvaluation(tenantId, evaluationId, userId) {
  const ev = await getEvaluation(tenantId, evaluationId);
  if (!ev) throw Object.assign(new Error('Evaluation not found'), { status:404 });
  if (ev.status === 'finalized') throw Object.assign(new Error('Already finalized'), { status:400 });

  const res = await query(
    `UPDATE evaluations SET status='finalized',finalized_by=$1,finalized_at=NOW(),updated_at=NOW()
     WHERE id=$2 AND tenant_id=$3 RETURNING *`,
    [userId,evaluationId,tenantId]
  );
  return res.rows[0];
}

async function getEvaluations(tenantId, { rfqId, page=1, limit=25 }) {
  const offset=(page-1)*limit;
  let where='WHERE e.tenant_id=$1'; const params=[tenantId]; let idx=2;
  if (rfqId) { where+=` AND e.rfq_id=$${idx++}`; params.push(rfqId); }
  const [cnt,rows]=await Promise.all([
    query(`SELECT COUNT(*) FROM evaluations e ${where}`, params),
    query(`SELECT e.*,r.rfq_number,r.title as rfq_title FROM evaluations e JOIN rfqs r ON r.id=e.rfq_id ${where} ORDER BY e.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params,limit,offset])
  ]);
  return { rows:rows.rows, total:parseInt(cnt.rows[0].count) };
}

module.exports = { createEvaluation, getEvaluation, scoreVendor, finalizeEvaluation, getEvaluations };
