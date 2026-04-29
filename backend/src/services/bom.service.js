const { query, withTransaction } = require('../config/database');

async function getBoms(tenantId, { status, search, page=1, limit=25 }) {
  const offset = (page-1)*limit;
  let where = 'WHERE b.tenant_id=$1 AND b.deleted_at IS NULL';
  const params = [tenantId]; let idx=2;
  if (status) { where+=` AND b.status=$${idx++}`; params.push(status); }
  if (search) { where+=` AND (b.name ILIKE $${idx} OR b.project_name ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
  const [countRes, rowsRes] = await Promise.all([
    query(`SELECT COUNT(*) FROM boms b ${where}`, params),
    query(`SELECT b.id,b.name,b.project_name,b.project_type,b.capacity_mw,b.location,b.status,
                  b.version,b.total_estimated_cost,b.currency,b.created_at,b.published_at,
                  u.first_name||' '||u.last_name as created_by_name,
                  COUNT(i.id) as item_count
           FROM boms b
           LEFT JOIN users u ON u.id=b.created_by
           LEFT JOIN bom_items i ON i.bom_id=b.id
           ${where} GROUP BY b.id,u.first_name,u.last_name
           ORDER BY b.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, limit, offset])
  ]);
  return { rows: rowsRes.rows, total: parseInt(countRes.rows[0].count) };
}

async function getBomById(tenantId, bomId) {
  const [bomRes, itemsRes] = await Promise.all([
    query(`SELECT b.*,u.first_name||' '||u.last_name as created_by_name
           FROM boms b LEFT JOIN users u ON u.id=b.created_by
           WHERE b.id=$1 AND b.tenant_id=$2 AND b.deleted_at IS NULL`, [bomId, tenantId]),
    query(`SELECT * FROM bom_items WHERE bom_id=$1 AND tenant_id=$2 ORDER BY sort_order,line_number`, [bomId, tenantId])
  ]);
  if (!bomRes.rows.length) return null;
  return { ...bomRes.rows[0], items: itemsRes.rows };
}

async function createBom(tenantId, userId, data) {
  const { name, projectName, projectType, capacityMw, location, description, currency, items=[] } = data;
  return withTransaction(async (client) => {
    const bomRes = await client.query(
      `INSERT INTO boms (tenant_id,name,project_name,project_type,capacity_mw,location,description,currency,status,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9) RETURNING *`,
      [tenantId, name, projectName||null, projectType||'solar_epc', capacityMw||null, location||null, description||null, currency||'INR', userId]
    );
    const bom = bomRes.rows[0];
    if (items.length > 0) await _insertItems(client, tenantId, bom.id, items);
    await _recalcTotal(client, bom.id);
    return bom;
  });
}

async function updateBom(tenantId, bomId, userId, data) {
  const bom = await getBomById(tenantId, bomId);
  if (!bom) throw Object.assign(new Error('BOM not found'), { status: 404 });
  if (bom.status === 'archived') throw Object.assign(new Error('Cannot edit archived BOM'), { status: 400, code: 'BOM_ARCHIVED' });
  const { name, projectName, projectType, capacityMw, location, description, currency } = data;
  const res = await query(
    `UPDATE boms SET name=COALESCE($1,name),project_name=COALESCE($2,project_name),
     project_type=COALESCE($3,project_type),capacity_mw=COALESCE($4,capacity_mw),
     location=COALESCE($5,location),description=COALESCE($6,description),
     currency=COALESCE($7,currency),updated_by=$8,updated_at=NOW()
     WHERE id=$9 AND tenant_id=$10 RETURNING *`,
    [name||null,projectName||null,projectType||null,capacityMw||null,location||null,description||null,currency||null,userId,bomId,tenantId]
  );
  return res.rows[0];
}

async function publishBom(tenantId, bomId, userId) {
  const bom = await getBomById(tenantId, bomId);
  if (!bom) throw Object.assign(new Error('BOM not found'), { status: 404 });
  if (bom.status !== 'draft') throw Object.assign(new Error('Only draft BOMs can be published'), { status: 400, code: 'NOT_DRAFT' });
  if (!bom.items || bom.items.length === 0) throw Object.assign(new Error('Cannot publish BOM with no items'), { status: 400, code: 'NO_ITEMS' });
  const res = await query(
    `UPDATE boms SET status='published',published_at=NOW(),version=version+1,updated_by=$1,updated_at=NOW()
     WHERE id=$2 AND tenant_id=$3 RETURNING *`,
    [userId, bomId, tenantId]
  );
  return res.rows[0];
}

async function archiveBom(tenantId, bomId, userId) {
  const res = await query(
    `UPDATE boms SET status='archived',updated_by=$1,updated_at=NOW() WHERE id=$2 AND tenant_id=$3 AND deleted_at IS NULL RETURNING *`,
    [userId, bomId, tenantId]
  );
  if (!res.rows.length) throw Object.assign(new Error('BOM not found'), { status: 404 });
  return res.rows[0];
}

async function deleteBom(tenantId, bomId) {
  const res = await query(
    `UPDATE boms SET deleted_at=NOW(),updated_at=NOW() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL RETURNING id`,
    [bomId, tenantId]
  );
  if (!res.rows.length) throw Object.assign(new Error('BOM not found'), { status: 404 });
  return res.rows[0];
}

// ── BOM Items ───────────────────────────────────────────────
async function addItems(tenantId, bomId, items) {
  const bom = await getBomById(tenantId, bomId);
  if (!bom) throw Object.assign(new Error('BOM not found'), { status: 404 });
  if (bom.status === 'archived') throw Object.assign(new Error('Cannot edit archived BOM'), { status: 400 });
  return withTransaction(async (client) => {
    const inserted = await _insertItems(client, tenantId, bomId, items);
    await _recalcTotal(client, bomId);
    return inserted;
  });
}

async function updateItem(tenantId, bomId, itemId, data) {
  const { description, makeModel, unit, quantity, unitRate, specifications, notes, isOptional } = data;
  const res = await query(
    `UPDATE bom_items SET
     description=COALESCE($1,description),make_model=COALESCE($2,make_model),
     unit=COALESCE($3,unit),quantity=COALESCE($4,quantity),unit_rate=COALESCE($5,unit_rate),
     specifications=COALESCE($6::jsonb,specifications),notes=COALESCE($7,notes),
     is_optional=COALESCE($8,is_optional),updated_at=NOW()
     WHERE id=$9 AND bom_id=$10 AND tenant_id=$11 RETURNING *`,
    [description||null,makeModel||null,unit||null,quantity||null,unitRate||null,
     specifications?JSON.stringify(specifications):null,notes||null,
     isOptional!=null?isOptional:null,itemId,bomId,tenantId]
  );
  if (!res.rows.length) throw Object.assign(new Error('Item not found'), { status: 404 });
  await _recalcTotalDirect(bomId);
  return res.rows[0];
}

async function deleteItem(tenantId, bomId, itemId) {
  const res = await query(
    'DELETE FROM bom_items WHERE id=$1 AND bom_id=$2 AND tenant_id=$3 RETURNING id',
    [itemId, bomId, tenantId]
  );
  if (!res.rows.length) throw Object.assign(new Error('Item not found'), { status: 404 });
  await _recalcTotalDirect(bomId);
  return res.rows[0];
}

// ── BOM import from JSON rows (Excel upload replacement) ────
async function importItems(tenantId, bomId, userId, rows) {
  const bom = await getBomById(tenantId, bomId);
  if (!bom) throw Object.assign(new Error('BOM not found'), { status: 404 });

  const parsed = rows.map((r, i) => ({
    lineNumber: r.line_number || r.lineNumber || (i+1),
    category: r.category || 'General',
    subCategory: r.sub_category || r.subCategory || null,
    itemCode: r.item_code || r.itemCode || null,
    description: String(r.description || '').trim(),
    makeModel: r.make_model || r.makeModel || null,
    unit: r.unit || 'Nos',
    quantity: parseFloat(r.quantity) || 0,
    unitRate: r.unit_rate || r.unitRate ? parseFloat(r.unit_rate || r.unitRate) : null,
    specifications: r.specifications || {},
    notes: r.notes || null,
    sortOrder: r.sort_order || r.sortOrder || (i+1)*10,
  })).filter(r => r.description && r.quantity > 0);

  if (parsed.length === 0) throw Object.assign(new Error('No valid items in import data'), { status: 400, code: 'NO_VALID_ITEMS' });

  return withTransaction(async (client) => {
    // Clear existing items on re-import
    await client.query('DELETE FROM bom_items WHERE bom_id=$1 AND tenant_id=$2', [bomId, tenantId]);
    const inserted = await _insertItems(client, tenantId, bomId, parsed);
    await _recalcTotal(client, bomId);
    return inserted;
  });
}

// ── Helpers ─────────────────────────────────────────────────
async function _insertItems(client, tenantId, bomId, items) {
  const inserted = [];
  for (const item of items) {
    const res = await client.query(
      `INSERT INTO bom_items (tenant_id,bom_id,line_number,category,sub_category,item_code,description,make_model,unit,quantity,unit_rate,specifications,notes,is_optional,sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (bom_id,line_number) DO UPDATE SET
         description=EXCLUDED.description,quantity=EXCLUDED.quantity,unit_rate=EXCLUDED.unit_rate,
         unit=EXCLUDED.unit,updated_at=NOW()
       RETURNING *`,
      [tenantId,bomId,item.lineNumber||inserted.length+1,item.category||'General',item.subCategory||null,
       item.itemCode||null,item.description,item.makeModel||null,item.unit||'Nos',
       item.quantity,item.unitRate||null,JSON.stringify(item.specifications||{}),
       item.notes||null,item.isOptional||false,item.sortOrder||(inserted.length+1)*10]
    );
    inserted.push(res.rows[0]);
  }
  return inserted;
}

async function _recalcTotal(client, bomId) {
  await client.query(
    `UPDATE boms SET total_estimated_cost=(SELECT COALESCE(SUM(total_amount),0) FROM bom_items WHERE bom_id=$1) WHERE id=$1`,
    [bomId]
  );
}

async function _recalcTotalDirect(bomId) {
  await query(
    `UPDATE boms SET total_estimated_cost=(SELECT COALESCE(SUM(total_amount),0) FROM bom_items WHERE bom_id=$1) WHERE id=$1`,
    [bomId]
  );
}

module.exports = { getBoms, getBomById, createBom, updateBom, publishBom, archiveBom, deleteBom, addItems, updateItem, deleteItem, importItems };
