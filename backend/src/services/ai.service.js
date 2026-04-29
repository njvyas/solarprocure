const crypto = require('crypto');
const https = require('https');
const { query, withTransaction } = require('../config/database');
const logger = require('../utils/logger');

// ── Encryption helpers ──────────────────────────────────────
// AI_ENCRYPTION_KEY is a dedicated secret for encrypting stored API keys.
// It is intentionally separate from JWT_SECRET so rotating JWTs does not
// invalidate all stored provider credentials.
// Generate with: openssl rand -hex 32   (use first 32 chars → 256-bit key)
const ENC_KEY = Buffer.from(
  (process.env.AI_ENCRYPTION_KEY || process.env.JWT_SECRET || 'fallback-key-32-chars-minimum!!').slice(0, 32).padEnd(32, '0')
);
const IV_LEN = 16;

function encryptKey(plaintext) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptKey(ciphertext) {
  const [ivHex, encHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, iv);
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
}

// ── Provider management ─────────────────────────────────────
async function listProviders(tenantId) {
  const res = await query(
    `SELECT id, provider, name, api_key_hint, base_url, model, is_active, is_default,
            settings, created_at, last_used_at
     FROM ai_providers WHERE tenant_id=$1 ORDER BY is_default DESC, created_at ASC`,
    [tenantId]
  );
  return res.rows;
}

async function addProvider(tenantId, userId, data) {
  const { provider, name, apiKey, baseUrl, model, settings = {}, isDefault = false } = data;
  const enc = encryptKey(apiKey);
  const hint = apiKey.slice(-4);

  return withTransaction(async (client) => {
    if (isDefault) {
      await client.query('UPDATE ai_providers SET is_default=false WHERE tenant_id=$1', [tenantId]);
    }
    const res = await client.query(
      `INSERT INTO ai_providers (tenant_id, provider, name, api_key_enc, api_key_hint,
        base_url, model, is_default, settings, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,provider,name,api_key_hint,model,is_default,is_active`,
      [tenantId, provider, name, enc, hint, baseUrl||null, model||null, isDefault, JSON.stringify(settings), userId]
    );
    return res.rows[0];
  });
}

async function updateProvider(tenantId, providerId, data) {
  const { name, apiKey, baseUrl, model, settings, isActive, isDefault } = data;
  let enc = null, hint = null;
  if (apiKey) { enc = encryptKey(apiKey); hint = apiKey.slice(-4); }

  return withTransaction(async (client) => {
    if (isDefault) {
      await client.query('UPDATE ai_providers SET is_default=false WHERE tenant_id=$1', [tenantId]);
    }
    const res = await client.query(
      `UPDATE ai_providers SET
         name=COALESCE($1,name), api_key_enc=COALESCE($2,api_key_enc),
         api_key_hint=COALESCE($3,api_key_hint), base_url=COALESCE($4,base_url),
         model=COALESCE($5,model), is_active=COALESCE($6,is_active),
         is_default=COALESCE($7,is_default),
         settings=CASE WHEN $8::jsonb IS NOT NULL THEN settings||$8::jsonb ELSE settings END,
         updated_at=NOW()
       WHERE id=$9 AND tenant_id=$10 RETURNING id,provider,name,api_key_hint,model,is_default,is_active`,
      [name||null, enc, hint, baseUrl||null, model||null,
       isActive!=null?isActive:null, isDefault!=null?isDefault:null,
       settings?JSON.stringify(settings):null, providerId, tenantId]
    );
    if (!res.rows.length) throw Object.assign(new Error('Provider not found'), { status:404 });
    return res.rows[0];
  });
}

async function deleteProvider(tenantId, providerId) {
  const res = await query(
    'DELETE FROM ai_providers WHERE id=$1 AND tenant_id=$2 RETURNING id',
    [providerId, tenantId]
  );
  if (!res.rows.length) throw Object.assign(new Error('Provider not found'), { status:404 });
}

async function testProvider(tenantId, providerId) {
  const provRes = await query('SELECT * FROM ai_providers WHERE id=$1 AND tenant_id=$2', [providerId, tenantId]);
  if (!provRes.rows.length) throw Object.assign(new Error('Provider not found'), { status:404 });
  const prov = provRes.rows[0];
  const apiKey = decryptKey(prov.api_key_enc);
  try {
    const result = await callAI(prov, apiKey, [{ role:'user', content:'Say "OK" and nothing else.' }], 50);
    await query('UPDATE ai_providers SET last_used_at=NOW() WHERE id=$1', [providerId]);
    return { success: true, response: result.content?.slice(0,50), model: result.model };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Core AI caller ──────────────────────────────────────────
async function callAI(provider, apiKey, messages, maxTokens = 2000) {
  const p = typeof provider === 'object' ? provider : { provider };
  const prov = p.provider;

  if (prov === 'anthropic') {
    return callAnthropic(apiKey, p.model || 'claude-haiku-4-5-20251001', messages, maxTokens);
  } else if (prov === 'openai') {
    return callOpenAI(apiKey, p.model || 'gpt-4o-mini', messages, maxTokens);
  } else if (prov === 'gemini') {
    return callGemini(apiKey, p.model || 'gemini-1.5-flash', messages, maxTokens);
  } else if (prov === 'mistral') {
    return callOpenAICompat(apiKey, p.model || 'mistral-small', messages, maxTokens,
      'https://api.mistral.ai/v1/chat/completions');
  } else if (prov === 'cohere') {
    return callCohere(apiKey, p.model || 'command-r', messages, maxTokens);
  } else if (prov === 'custom' && p.base_url) {
    return callOpenAICompat(apiKey, p.model || 'local-model', messages, maxTokens, p.base_url);
  }
  throw new Error(`Unsupported provider: ${prov}`);
}

function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname, path: pathname + (search||''), method: 'POST',
      headers: { 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(data), ...headers }
    }, (res) => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(buf);
          if (res.statusCode >= 400) reject(Object.assign(new Error(parsed.error?.message || parsed.message || `HTTP ${res.statusCode}`), { statusCode: res.statusCode }));
          else resolve(parsed);
        } catch (e) { reject(new Error('Invalid JSON response: ' + buf.slice(0,200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Request timed out')); });
    req.write(data);
    req.end();
  });
}

async function callAnthropic(apiKey, model, messages, maxTokens) {
  const res = await httpsPost('https://api.anthropic.com/v1/messages',
    { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    { model, max_tokens: maxTokens, messages }
  );
  return {
    content: res.content?.[0]?.text || '',
    model: res.model,
    tokensUsed: (res.usage?.input_tokens || 0) + (res.usage?.output_tokens || 0)
  };
}

async function callOpenAI(apiKey, model, messages, maxTokens) {
  return callOpenAICompat(apiKey, model, messages, maxTokens, 'https://api.openai.com/v1/chat/completions');
}

async function callOpenAICompat(apiKey, model, messages, maxTokens, baseUrl) {
  const res = await httpsPost(baseUrl,
    { 'Authorization': `Bearer ${apiKey}` },
    { model, max_tokens: maxTokens, messages }
  );
  return {
    content: res.choices?.[0]?.message?.content || '',
    model: res.model || model,
    tokensUsed: (res.usage?.total_tokens || 0)
  };
}

async function callGemini(apiKey, model, messages, maxTokens) {
  const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const res = await httpsPost(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {},
    { contents, generationConfig: { maxOutputTokens: maxTokens } }
  );
  return {
    content: res.candidates?.[0]?.content?.parts?.[0]?.text || '',
    model,
    tokensUsed: (res.usageMetadata?.totalTokenCount || 0)
  };
}

async function callCohere(apiKey, model, messages, maxTokens) {
  const chatHistory = messages.slice(0,-1).map(m => ({ role: m.role === 'assistant' ? 'CHATBOT' : 'USER', message: m.content }));
  const lastMsg = messages[messages.length - 1];
  const res = await httpsPost('https://api.cohere.ai/v1/chat',
    { 'Authorization': `Bearer ${apiKey}` },
    { model, message: lastMsg.content, chat_history: chatHistory, max_tokens: maxTokens }
  );
  return {
    content: res.text || '',
    model,
    tokensUsed: (res.meta?.tokens?.input_tokens || 0) + (res.meta?.tokens?.output_tokens || 0)
  };
}

// ── Get default provider for tenant ────────────────────────
async function getDefaultProvider(tenantId) {
  const res = await query(
    'SELECT * FROM ai_providers WHERE tenant_id=$1 AND is_active=true AND is_default=true LIMIT 1',
    [tenantId]
  );
  if (!res.rows.length) {
    const fallback = await query(
      'SELECT * FROM ai_providers WHERE tenant_id=$1 AND is_active=true ORDER BY created_at ASC LIMIT 1',
      [tenantId]
    );
    return fallback.rows[0] || null;
  }
  return res.rows[0];
}

// ── Context builder — gathers real DB data for AI ──────────
async function buildProcurementContext(tenantId) {
  const [kpis, topVendors, recentRfqs, spendTrend, pendingPos, vendorPerf] = await Promise.all([
    query(`SELECT * FROM vw_tenant_kpis WHERE tenant_id=$1`, [tenantId]),
    query(`SELECT v.company_name, v.status, v.product_categories,
                  COUNT(DISTINCT q.id) as quotes, COUNT(DISTINCT po.id) as pos,
                  COALESCE(SUM(q.total_amount) FILTER (WHERE q.status='awarded'),0) as awarded_value,
                  AVG(vp.overall_score) as avg_score
           FROM vendors v
           LEFT JOIN quotes q ON q.vendor_id=v.id AND q.tenant_id=v.tenant_id
           LEFT JOIN purchase_orders po ON po.vendor_id=v.id AND po.tenant_id=v.tenant_id AND po.status IN ('approved','issued','closed')
           LEFT JOIN vendor_performance vp ON vp.vendor_id=v.id
           WHERE v.tenant_id=$1 AND v.deleted_at IS NULL AND v.status='approved'
           GROUP BY v.id ORDER BY awarded_value DESC LIMIT 10`, [tenantId]),
    query(`SELECT rfq_number, title, status, submission_deadline,
                  (SELECT COUNT(*) FROM rfq_vendors rv WHERE rv.rfq_id=rfqs.id) as vendor_count,
                  (SELECT COUNT(*) FROM quotes q WHERE q.rfq_id=rfqs.id) as quote_count,
                  (SELECT MIN(total_amount) FROM quotes q WHERE q.rfq_id=rfqs.id AND q.status IN ('submitted','shortlisted','awarded')) as l1_price
           FROM rfqs WHERE tenant_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10`, [tenantId]),
    query(`SELECT DATE_TRUNC('month',created_at) as month,
                  COUNT(*) as po_count, COALESCE(SUM(total_amount),0) as spend
           FROM purchase_orders WHERE tenant_id=$1 AND deleted_at IS NULL
             AND status IN ('approved','issued','closed')
             AND created_at > NOW() - INTERVAL '12 months'
           GROUP BY month ORDER BY month`, [tenantId]),
    query(`SELECT COUNT(*) as pending FROM purchase_orders WHERE tenant_id=$1 AND status='pending_approval'`, [tenantId]),
    query(`SELECT v.company_name, vp.period_year, vp.period_quarter, vp.overall_score,
                  vp.on_time_delivery_pct, vp.quality_score, vp.price_competitiveness
           FROM vendor_performance vp JOIN vendors v ON v.id=vp.vendor_id
           WHERE vp.tenant_id=$1 ORDER BY vp.period_year DESC, vp.period_quarter DESC LIMIT 20`, [tenantId]),
  ]);

  return {
    kpis: kpis.rows[0] || {},
    topVendors: topVendors.rows,
    recentRfqs: recentRfqs.rows,
    spendTrend: spendTrend.rows,
    pendingPos: parseInt(pendingPos.rows[0]?.pending || 0),
    vendorPerformance: vendorPerf.rows,
  };
}

// ── Insight generators ──────────────────────────────────────
const INSIGHT_PROMPTS = {
  spend_forecast: (ctx) => `You are a procurement analytics expert for a Solar EPC company. Analyze this spend data and provide a 3-month spend forecast with confidence intervals.

Spend trend (last 12 months): ${JSON.stringify(ctx.spendTrend)}
KPIs: Total PO value=${ctx.kpis.total_po_value}, Total POs=${ctx.kpis.total_pos}, Total vendors=${ctx.kpis.total_vendors}

Respond in JSON: {"forecast":[{"month":"YYYY-MM","predicted_spend":N,"low":N,"high":N}],"trend":"up|down|stable","key_drivers":["..."],"confidence":N,"summary":"..."}`,

  vendor_risk: (ctx) => `Analyze vendor risk for a Solar EPC procurement team.

Vendor data: ${JSON.stringify(ctx.topVendors)}
Performance history: ${JSON.stringify(ctx.vendorPerformance)}

Identify vendors with concentration risk, compliance gaps, or performance issues.
Respond in JSON: {"risk_matrix":[{"vendor":"..","risk_level":"high|medium|low","factors":[".."],"score":N}],"concentration_risk":"..","recommendations":[".."],"summary":".."}`,

  rfq_optimization: (ctx) => `Analyze these recent RFQs and suggest optimizations to get better quotes and savings.

Recent RFQs: ${JSON.stringify(ctx.recentRfqs)}
Top vendors: ${JSON.stringify(ctx.topVendors.map(v=>({name:v.company_name,categories:v.product_categories,score:v.avg_score})))}

Respond in JSON: {"suggestions":[{"rfq":"..","issue":"..","action":"..","estimated_saving_pct":N}],"avg_vendor_participation":N,"best_practices":[".."],"summary":".."}`,

  price_benchmark: (ctx) => `Based on quote data from recent RFQs, provide price benchmarking insights for Solar EPC materials.

RFQ data: ${JSON.stringify(ctx.recentRfqs)}
Spend by vendor: ${JSON.stringify(ctx.topVendors.map(v=>({name:v.company_name,value:v.awarded_value})))}

Respond in JSON: {"benchmarks":[{"category":"..","l1_vs_average_pct":N,"negotiation_potential_pct":N}],"total_savings_opportunity":N,"overpriced_categories":[".."],"summary":".."}`,

  po_anomaly: (ctx) => `Detect anomalies in purchase orders.

PO count pending approval: ${ctx.pendingPos}
Spend trend: ${JSON.stringify(ctx.spendTrend)}
Vendor concentration: ${JSON.stringify(ctx.topVendors.map(v=>({name:v.company_name,pos:v.pos,value:v.awarded_value})))}

Respond in JSON: {"anomalies":[{"type":"..","description":"..","severity":"high|medium|low","action":".."}],"bottlenecks":[".."],"summary":".."}`,

  vendor_recommendation: (ctx) => `Recommend the best vendors for new RFQs based on performance and history.

Performance data: ${JSON.stringify(ctx.vendorPerformance)}
Vendor list: ${JSON.stringify(ctx.topVendors)}

Respond in JSON: {"recommendations":[{"category":"..","top_vendors":[{"name":"..","score":N,"reason":".."}],"avoid":["..","reason"]}],"summary":".."}`,

  savings_opportunity: (ctx) => `Identify procurement savings opportunities.

Spend trend: ${JSON.stringify(ctx.spendTrend)}
Vendor data: ${JSON.stringify(ctx.topVendors)}
RFQ data: ${JSON.stringify(ctx.recentRfqs)}
KPIs: ${JSON.stringify(ctx.kpis)}

Respond in JSON: {"opportunities":[{"category":"..","current_spend":N,"potential_saving":N,"saving_pct":N,"method":"consolidation|negotiation|alternative_vendor|timing"}],"total_annual_saving":N,"priority_actions":[".."],"summary":".."}`,

  compliance_risk: (ctx) => `Analyze vendor compliance and certification risks.

Vendor data: ${JSON.stringify(ctx.topVendors)}
Performance: ${JSON.stringify(ctx.vendorPerformance)}

Respond in JSON: {"risks":[{"vendor":"..","issue":"..","risk":"expiry|missing_cert|performance","severity":"high|medium|low","action":".."}],"overall_compliance_score":N,"immediate_actions":[".."],"summary":".."}`,
};

// ── Run an insight ──────────────────────────────────────────
async function runInsight(tenantId, userId, insightType, providerId) {
  const provider = providerId
    ? (await query('SELECT * FROM ai_providers WHERE id=$1 AND tenant_id=$2 AND is_active=true', [providerId, tenantId])).rows[0]
    : await getDefaultProvider(tenantId);

  if (!provider) throw Object.assign(new Error('No active AI provider configured. Add one in AI Settings.'), { status: 400, code: 'NO_PROVIDER' });

  const ctx = await buildProcurementContext(tenantId);
  const promptFn = INSIGHT_PROMPTS[insightType];
  if (!promptFn) throw Object.assign(new Error(`Unknown insight type: ${insightType}`), { status: 400 });

  // Create job record
  const jobRes = await query(
    `INSERT INTO ai_insights (tenant_id, provider_id, insight_type, status, input_context, triggered_by, trigger_type, expires_at)
     VALUES ($1,$2,$3,'running',$4,$5,'manual', NOW()+INTERVAL '24 hours') RETURNING *`,
    [tenantId, provider.id, insightType, JSON.stringify({ timestamp: new Date().toISOString() }), userId]
  );
  const job = jobRes.rows[0];

  // Run async
  (async () => {
    try {
      const apiKey = decryptKey(provider.api_key_enc);
      const prompt = promptFn(ctx);
      const result = await callAI(provider, apiKey, [{ role: 'user', content: prompt }], 1500);

      // Parse JSON response
      let parsed;
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: result.content };
      } catch {
        parsed = { raw: result.content };
      }

      await query(
        `UPDATE ai_insights SET status='completed', result=$1, summary=$2,
         tokens_used=$3, completed_at=NOW() WHERE id=$4`,
        [JSON.stringify(parsed), parsed.summary || result.content.slice(0,300), result.tokensUsed || 0, job.id]
      );
      await query('UPDATE ai_providers SET last_used_at=NOW() WHERE id=$1', [provider.id]);
    } catch (err) {
      logger.error('AI insight failed', { jobId: job.id, error: err.message });
      await query(
        `UPDATE ai_insights SET status='failed', error_message=$1, completed_at=NOW() WHERE id=$2`,
        [err.message, job.id]
      );
    }
  })();

  return job;
}

async function getInsights(tenantId, { insightType, status, page=1, limit=20 } = {}) {
  const offset = (page-1)*limit;
  let where = 'WHERE ai.tenant_id=$1';
  const params = [tenantId]; let idx=2;
  if (insightType) { where+=` AND ai.insight_type=$${idx++}`; params.push(insightType); }
  if (status)      { where+=` AND ai.status=$${idx++}`;       params.push(status); }
  const [cnt, rows] = await Promise.all([
    query(`SELECT COUNT(*) FROM ai_insights ai ${where}`, params),
    query(`SELECT ai.id, ai.insight_type, ai.status, ai.summary, ai.confidence, ai.tokens_used,
                  ai.created_at, ai.completed_at, ai.error_message,
                  ap.provider, ap.name as provider_name
           FROM ai_insights ai LEFT JOIN ai_providers ap ON ap.id=ai.provider_id
           ${where} ORDER BY ai.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, limit, offset])
  ]);
  return { rows: rows.rows, total: parseInt(cnt.rows[0].count) };
}

async function getInsightById(tenantId, insightId) {
  const res = await query(
    `SELECT ai.*, ap.provider, ap.name as provider_name
     FROM ai_insights ai LEFT JOIN ai_providers ap ON ap.id=ai.provider_id
     WHERE ai.id=$1 AND ai.tenant_id=$2`,
    [insightId, tenantId]
  );
  return res.rows[0] || null;
}

// ── Chat ─────────────────────────────────────────────────────
async function chat(tenantId, userId, sessionId, userMessage, providerId) {
  const provider = providerId
    ? (await query('SELECT * FROM ai_providers WHERE id=$1 AND tenant_id=$2 AND is_active=true', [providerId, tenantId])).rows[0]
    : await getDefaultProvider(tenantId);
  if (!provider) throw Object.assign(new Error('No active AI provider configured'), { status:400, code:'NO_PROVIDER' });

  const ctx = await buildProcurementContext(tenantId);
  const systemMsg = `You are an expert procurement analyst AI for a Solar EPC company. 
You have access to the company's real procurement data:
- Total vendors: ${ctx.kpis.total_vendors} (${ctx.kpis.approved_vendors} approved)
- Total RFQs: ${ctx.kpis.total_rfqs} (${ctx.kpis.awarded_rfqs} awarded)
- Total PO value: ₹${parseFloat(ctx.kpis.total_po_value||0).toLocaleString('en-IN')}
- Pending approvals: ${ctx.pendingPos}

Answer questions about procurement performance, vendor analysis, cost optimization, and forecasting. Be specific and data-driven. Format numbers in Indian style (₹ for currency). Keep responses concise.`;

  // Load or create session
  let session;
  if (sessionId) {
    const sr = await query('SELECT * FROM ai_chat_sessions WHERE id=$1 AND tenant_id=$2 AND user_id=$3', [sessionId, tenantId, userId]);
    session = sr.rows[0];
  }

  const history = session?.messages || [];
  const messages = [
    { role: 'user', content: systemMsg + '\n\nUser question: ' + userMessage },
    ...history.slice(-10), // keep last 10 messages for context
    { role: 'user', content: userMessage }
  ];
  // For providers that support system messages, structure differently
  const cleanMessages = history.length > 0
    ? [...history.slice(-10), { role:'user', content: userMessage }]
    : [{ role:'user', content: systemMsg + '\n\n' + userMessage }];

  const apiKey = decryptKey(provider.api_key_enc);
  const result = await callAI(provider, apiKey, cleanMessages, 800);
  await query('UPDATE ai_providers SET last_used_at=NOW() WHERE id=$1', [provider.id]);

  const newHistory = [...history, { role:'user', content:userMessage }, { role:'assistant', content:result.content }];
  const totalTokens = (session?.total_tokens || 0) + (result.tokensUsed || 0);

  if (session) {
    await query(
      'UPDATE ai_chat_sessions SET messages=$1, total_tokens=$2, updated_at=NOW() WHERE id=$3',
      [JSON.stringify(newHistory), totalTokens, session.id]
    );
    return { sessionId: session.id, reply: result.content, tokensUsed: result.tokensUsed };
  } else {
    const title = userMessage.slice(0, 60) + (userMessage.length > 60 ? '...' : '');
    const newSession = await query(
      `INSERT INTO ai_chat_sessions (tenant_id, user_id, provider_id, title, messages, total_tokens)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [tenantId, userId, provider.id, title, JSON.stringify(newHistory), totalTokens]
    );
    return { sessionId: newSession.rows[0].id, reply: result.content, tokensUsed: result.tokensUsed };
  }
}

async function getChatSessions(tenantId, userId) {
  const res = await query(
    `SELECT id, title, total_tokens, created_at, updated_at,
            jsonb_array_length(messages) as message_count
     FROM ai_chat_sessions WHERE tenant_id=$1 AND user_id=$2 ORDER BY updated_at DESC LIMIT 50`,
    [tenantId, userId]
  );
  return res.rows;
}

async function getChatSession(tenantId, sessionId, userId) {
  const res = await query(
    'SELECT * FROM ai_chat_sessions WHERE id=$1 AND tenant_id=$2 AND user_id=$3',
    [sessionId, tenantId, userId]
  );
  return res.rows[0] || null;
}

module.exports = {
  listProviders, addProvider, updateProvider, deleteProvider, testProvider,
  runInsight, getInsights, getInsightById,
  chat, getChatSessions, getChatSession,
  getDefaultProvider, buildProcurementContext
};
