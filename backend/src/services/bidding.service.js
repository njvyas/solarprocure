const { query, withTransaction } = require('../config/database');

// ── Session CRUD ────────────────────────────────────────────
async function createSession(tenantId, userId, data) {
  const { rfqId, title, maxRounds=3, roundDurationMins=30, decrementType='percentage',
          minDecrement=1.0, floorPrice, reservePrice, showRank=true, showBestPrice=false } = data;

  // Validate RFQ belongs to tenant and is sent/closed
  const rfqCheck = await query(
    `SELECT id,status FROM rfqs WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
    [rfqId, tenantId]
  );
  if (!rfqCheck.rows.length) throw Object.assign(new Error('RFQ not found'), { status:404 });
  if (!['sent','open','closed'].includes(rfqCheck.rows[0].status))
    throw Object.assign(new Error('RFQ must be sent/open/closed to start bidding'), { status:400, code:'RFQ_NOT_READY' });

  // One session per RFQ
  const existing = await query('SELECT id FROM bid_sessions WHERE rfq_id=$1', [rfqId]);
  if (existing.rows.length) throw Object.assign(new Error('Bidding session already exists for this RFQ'), { status:409, code:'SESSION_EXISTS' });

  const res = await query(
    `INSERT INTO bid_sessions (tenant_id,rfq_id,title,max_rounds,round_duration_mins,
      decrement_type,min_decrement,floor_price,reserve_price,show_rank,show_best_price,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [tenantId,rfqId,title,maxRounds,roundDurationMins,decrementType,minDecrement,
     floorPrice||null,reservePrice||null,showRank,showBestPrice,userId]
  );
  return res.rows[0];
}

async function getSession(tenantId, sessionId) {
  const [sessRes, roundsRes, bidsRes] = await Promise.all([
    query(`SELECT bs.*,r.rfq_number,r.title as rfq_title
           FROM bid_sessions bs JOIN rfqs r ON r.id=bs.rfq_id
           WHERE bs.id=$1 AND bs.tenant_id=$2`, [sessionId, tenantId]),
    query(`SELECT br.*,COUNT(b.id) as bid_count
           FROM bid_rounds br LEFT JOIN bids b ON b.round_id=br.id
           WHERE br.session_id=$1 GROUP BY br.id ORDER BY br.round_number`,
      [sessionId]),
    query(`SELECT b.*,v.company_name FROM bids b JOIN vendors v ON v.id=b.vendor_id
           WHERE b.session_id=$1 ORDER BY b.round_id,b.amount ASC`, [sessionId])
  ]);
  if (!sessRes.rows.length) return null;
  return { ...sessRes.rows[0], rounds: roundsRes.rows, bids: bidsRes.rows };
}

async function getSessionByRfq(tenantId, rfqId) {
  const res = await query(
    `SELECT bs.*,r.rfq_number,r.title as rfq_title FROM bid_sessions bs JOIN rfqs r ON r.id=bs.rfq_id
     WHERE bs.rfq_id=$1 AND bs.tenant_id=$2`, [rfqId, tenantId]
  );
  if (!res.rows.length) return null;
  const s = res.rows[0];
  const [rounds,bids] = await Promise.all([
    query(`SELECT br.*,COUNT(b.id) as bid_count FROM bid_rounds br LEFT JOIN bids b ON b.round_id=br.id
           WHERE br.session_id=$1 GROUP BY br.id ORDER BY br.round_number`, [s.id]),
    query(`SELECT b.*,v.company_name FROM bids b JOIN vendors v ON v.id=b.vendor_id
           WHERE b.session_id=$1 ORDER BY b.round_id,b.amount ASC`, [s.id])
  ]);
  return { ...s, rounds, bids };
}

async function startRound(tenantId, sessionId, userId) {
  const session = await getSession(tenantId, sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { status:404 });
  if (session.status === 'completed') throw Object.assign(new Error('Session completed'), { status:400, code:'SESSION_COMPLETE' });
  if (session.status === 'cancelled') throw Object.assign(new Error('Session cancelled'), { status:400, code:'SESSION_CANCELLED' });

  const nextRound = session.current_round + 1;
  if (nextRound > session.max_rounds) throw Object.assign(new Error('Max rounds reached'), { status:400, code:'MAX_ROUNDS' });

  // Check no active round
  const activeRound = session.rounds.find(r => r.status === 'active');
  if (activeRound) throw Object.assign(new Error('A round is already active'), { status:400, code:'ROUND_ACTIVE' });

  const roundEnd = new Date(Date.now() + session.round_duration_mins * 60000);

  return withTransaction(async (client) => {
    // Complete any pending previous round
    await client.query(
      `UPDATE bid_rounds SET status='completed',ended_at=NOW() WHERE session_id=$1 AND status='active'`,
      [sessionId]
    );

    // Create new round
    const rRes = await client.query(
      `INSERT INTO bid_rounds (tenant_id,session_id,round_number,status,started_at) VALUES ($1,$2,$3,'active',NOW()) RETURNING *`,
      [tenantId, sessionId, nextRound]
    );

    // Update session
    const sRes = await client.query(
      `UPDATE bid_sessions SET status='active',current_round=$1,current_round_end=$2,
       start_time=COALESCE(start_time,NOW()),updated_at=NOW()
       WHERE id=$3 AND tenant_id=$4 RETURNING *`,
      [nextRound, roundEnd, sessionId, tenantId]
    );

    return { session: sRes.rows[0], round: rRes.rows[0] };
  });
}

async function endRound(tenantId, sessionId) {
  const session = await getSession(tenantId, sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { status:404 });

  const activeRound = session.rounds.find(r => r.status === 'active');
  if (!activeRound) throw Object.assign(new Error('No active round'), { status:400, code:'NO_ACTIVE_ROUND' });

  return withTransaction(async (client) => {
    // Rank bids in this round (lower amount = better rank)
    const bidsInRound = await client.query(
      `SELECT id,amount FROM bids WHERE round_id=$1 AND is_valid=true ORDER BY amount ASC`,
      [activeRound.id]
    );
    for (let i = 0; i < bidsInRound.rows.length; i++) {
      await client.query('UPDATE bids SET rank=$1 WHERE id=$2', [i+1, bidsInRound.rows[i].id]);
    }

    await client.query(
      `UPDATE bid_rounds SET status='completed',ended_at=NOW() WHERE id=$1`, [activeRound.id]
    );

    const isLastRound = session.current_round >= session.max_rounds;
    const newStatus = isLastRound ? 'completed' : 'paused';
    const sRes = await client.query(
      `UPDATE bid_sessions SET status=$1,end_time=CASE WHEN $1='completed' THEN NOW() ELSE end_time END,
       current_round_end=NULL,updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING *`,
      [newStatus, sessionId, tenantId]
    );

    return { session: sRes.rows[0], round: { ...activeRound, status:'completed' } };
  });
}

// Vendor places bid via access token
async function placeBid(accessToken, amount, ipAddress) {
  // Validate token
  const tvRes = await query(
    `SELECT rv.*,v.tenant_id,v.company_name FROM rfq_vendors rv JOIN vendors v ON v.id=rv.vendor_id
     WHERE rv.access_token=$1 AND (rv.token_expires_at IS NULL OR rv.token_expires_at>NOW())`,
    [accessToken]
  );
  if (!tvRes.rows.length) throw Object.assign(new Error('Invalid or expired token'), { status:401, code:'INVALID_TOKEN' });
  const rv = tvRes.rows[0];

  // Get active session for this RFQ
  const sessRes = await query(
    `SELECT bs.*,br.id as round_id,br.round_number
     FROM bid_sessions bs JOIN bid_rounds br ON br.session_id=bs.id AND br.status='active'
     WHERE bs.rfq_id=$1 AND bs.status='active' AND bs.tenant_id=$2`,
    [rv.rfq_id, rv.tenant_id]
  );
  if (!sessRes.rows.length) throw Object.assign(new Error('No active bidding round'), { status:400, code:'NO_ACTIVE_ROUND' });
  const sess = sessRes.rows[0];

  // Validate amount
  if (isNaN(amount) || amount <= 0) throw Object.assign(new Error('Invalid bid amount'), { status:400, code:'INVALID_AMOUNT' });
  if (sess.floor_price && amount < sess.floor_price)
    throw Object.assign(new Error(`Bid below floor price of ₹${sess.floor_price}`), { status:400, code:'BELOW_FLOOR' });

  // Check decrement vs previous round best bid
  if (sess.round_number > 1) {
    const prevBest = await query(
      `SELECT MIN(b.amount) as best FROM bids b
       JOIN bid_rounds br ON br.id=b.round_id
       WHERE b.session_id=$1 AND br.round_number=$2 AND b.vendor_id=$3 AND b.is_valid=true`,
      [sess.id, sess.round_number - 1, rv.vendor_id]
    );
    if (prevBest.rows[0].best) {
      const prev = parseFloat(prevBest.rows[0].best);
      if (sess.decrement_type === 'percentage') {
        const minBid = prev * (1 - sess.min_decrement / 100);
        if (amount > minBid)
          throw Object.assign(new Error(`Must reduce by at least ${sess.min_decrement}% from your last bid (max ₹${minBid.toFixed(2)})`), { status:400, code:'INSUFFICIENT_DECREMENT' });
      } else {
        if (amount > prev - sess.min_decrement)
          throw Object.assign(new Error(`Must reduce by at least ₹${sess.min_decrement}`), { status:400, code:'INSUFFICIENT_DECREMENT' });
      }
    }
  }

  // Upsert bid (one per vendor per round)
  const res = await query(
    `INSERT INTO bids (tenant_id,session_id,round_id,vendor_id,rfq_vendor_id,amount,ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (round_id,vendor_id) DO UPDATE SET amount=$6,bid_time=NOW(),ip_address=$7
     RETURNING *`,
    [rv.tenant_id, sess.id, sess.round_id, rv.vendor_id, rv.id, amount, ipAddress||null]
  );

  const bid = res.rows[0];
  let rank = null;
  if (sess.show_rank) {
    const rankRes = await query(
      `SELECT COUNT(*)+1 as rank FROM bids WHERE round_id=$1 AND amount<$2 AND is_valid=true`,
      [sess.round_id, amount]
    );
    rank = parseInt(rankRes.rows[0].rank);
  }

  return { bid, rank, showBestPrice: sess.show_best_price };
}

async function getBidLeaderboard(tenantId, sessionId, roundNumber) {
  const sess = await getSession(tenantId, sessionId);
  if (!sess) throw Object.assign(new Error('Session not found'), { status:404 });

  const round = roundNumber
    ? sess.rounds.find(r => r.round_number === parseInt(roundNumber))
    : sess.rounds.slice().reverse().find(r => ['active','completed'].includes(r.status));

  if (!round) return { round:null, bids:[] };

  const bids = await query(
    `SELECT b.amount,b.rank,b.bid_time,b.is_valid,
            CASE WHEN $2 THEN v.company_name ELSE 'Vendor '||b.rank END as vendor_name
     FROM bids b JOIN vendors v ON v.id=b.vendor_id
     WHERE b.round_id=$1 ORDER BY b.amount ASC`,
    [round.id, sess.show_rank || tenantId === sess.tenant_id]
  );

  return { round, bids: bids.rows, showBestPrice: sess.show_best_price };
}

async function getSessions(tenantId, { rfqId, status, page=1, limit=25 }) {
  const offset = (page-1)*limit;
  let where = 'WHERE bs.tenant_id=$1';
  const params = [tenantId]; let idx=2;
  if (rfqId)  { where+=` AND bs.rfq_id=$${idx++}`; params.push(rfqId); }
  if (status) { where+=` AND bs.status=$${idx++}`; params.push(status); }
  const [cnt,rows] = await Promise.all([
    query(`SELECT COUNT(*) FROM bid_sessions bs ${where}`, params),
    query(`SELECT bs.*,r.rfq_number,r.title as rfq_title,
                  COUNT(DISTINCT b.vendor_id) as participating_vendors
           FROM bid_sessions bs JOIN rfqs r ON r.id=bs.rfq_id
           LEFT JOIN bids b ON b.session_id=bs.id
           ${where} GROUP BY bs.id,r.rfq_number,r.title
           ORDER BY bs.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, limit, offset])
  ]);
  return { rows:rows.rows, total:parseInt(cnt.rows[0].count) };
}

module.exports = { createSession, getSession, getSessionByRfq, startRound, endRound, placeBid, getBidLeaderboard, getSessions };
