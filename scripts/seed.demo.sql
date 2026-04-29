-- SEED: DEMO TENANTS
-- ============================================================

-- Tenant 1: Alendei Green RE
INSERT INTO tenants (id, name, slug, status, plan, settings) VALUES
(
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Alendei Green RE Pvt Ltd',
    'alendei-green',
    'active',
    'enterprise',
    '{"currency":"INR","timezone":"Asia/Kolkata","fiscal_year_start":"04-01"}'
);

-- Tenant 2: Demo Corp (for isolation testing)
INSERT INTO tenants (id, name, slug, status, plan, settings) VALUES
(
    'bbbbbbbb-0000-0000-0000-000000000002',
    'Demo Solar Corp',
    'demo-solar',
    'active',
    'standard',
    '{"currency":"INR","timezone":"Asia/Kolkata","fiscal_year_start":"04-01"}'
);

-- ============================================================
-- SEED: SYSTEM ROLES FOR TENANT 1
-- ============================================================
-- Permission matrix structure:
-- { "module": ["action", ...] }
-- Modules: tenants, users, roles, vendors, rfqs, boms, quotes, pos, reports, audit, backup

INSERT INTO roles (id, tenant_id, name, description, is_system, permissions) VALUES
(
    'r1000000-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Super Admin',
    'Full system access. All modules, all actions.',
    true,
    '{"*":["*"]}'
),
(
    'r1000000-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Procurement Manager',
    'Manage RFQs, vendors, BOMs, quotes, and POs.',
    true,
    '{"vendors":["read","create","update","approve","delete"],"rfqs":["read","create","update","delete","send"],"bidding":["read","create","update"],"evaluations":["read","create","update"],"boms":["read","create","update","delete"],"quotes":["read","create","update","evaluate"],"pos":["read","create","update"],"reports":["read"],"backup":["read","create"],"ai":["read","use"],"audit":["read"]}'
),
(
    'r1000000-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Finance Approver',
    'Approve POs and view financial reports.',
    true,
    '{"pos":["read","approve","create","update"],"quotes":["read","evaluate"],"evaluations":["read","create","update"],"reports":["read"],"rfqs":["read"],"backup":["read","create","restore"],"ai":["read","use","manage"],"audit":["read"]}'
),
(
    'r1000000-0000-0000-0000-000000000004',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Viewer',
    'Read-only access to non-sensitive modules.',
    true,
    '{"vendors":["read"],"rfqs":["read"],"quotes":["read"],"reports":["read"],"ai":["read"]}'
);

-- System roles for Tenant 2
INSERT INTO roles (id, tenant_id, name, description, is_system, permissions) VALUES
(
    'r2000000-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'Super Admin',
    'Full system access.',
    true,
    '{"*":["*"]}'
),
(
    'r2000000-0000-0000-0000-000000000002',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'Procurement Manager',
    'Manage RFQs, vendors, BOMs, quotes, and POs.',
    true,
    '{"vendors":["read","create","update","approve","delete"],"rfqs":["read","create","update","delete","send"],"bidding":["read","create","update"],"evaluations":["read","create","update"],"boms":["read","create","update","delete"],"quotes":["read","create","update","evaluate"],"pos":["read","create","update"],"reports":["read"],"backup":["read","create"],"ai":["read","use"],"audit":["read"]}'
);

-- ============================================================
-- SEED: USERS
-- Password for ALL seed users: Admin@1234
-- bcrypt hash (12 rounds) of "Admin@1234"
-- ============================================================

-- Tenant 1 users
INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, status, email_verified) VALUES
(
    'u1000000-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'admin@alendei-green.com',
    '$2a$12$bIsZw9guUzU/FTl92OuPauDG/VjlSdj6jYwwQYj1xNQOkRzz/lHuS',
    'System',
    'Admin',
    'active',
    true
),
(
    'u1000000-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'procurement@alendei-green.com',
    '$2a$12$bIsZw9guUzU/FTl92OuPauDG/VjlSdj6jYwwQYj1xNQOkRzz/lHuS',
    'Procurement',
    'Manager',
    'active',
    true
),
(
    'u1000000-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'finance@alendei-green.com',
    '$2a$12$bIsZw9guUzU/FTl92OuPauDG/VjlSdj6jYwwQYj1xNQOkRzz/lHuS',
    'Finance',
    'Approver',
    'active',
    true
);

-- Tenant 2 users
INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, status, email_verified) VALUES
(
    'u2000000-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'admin@demo-solar.com',
    '$2a$12$bIsZw9guUzU/FTl92OuPauDG/VjlSdj6jYwwQYj1xNQOkRzz/lHuS',
    'Demo',
    'Admin',
    'active',
    true
),
(
    'u2000000-0000-0000-0000-000000000002',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'procurement@demo-solar.com',
    '$2a$12$bIsZw9guUzU/FTl92OuPauDG/VjlSdj6jYwwQYj1xNQOkRzz/lHuS',
    'Demo',
    'Procurement',
    'active',
    true
);

-- ============================================================
-- SEED: USER ROLE ASSIGNMENTS
-- ============================================================
INSERT INTO user_roles (tenant_id, user_id, role_id) VALUES
-- Tenant 1
('aaaaaaaa-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000001', 'r1000000-0000-0000-0000-000000000001'),
('aaaaaaaa-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000002', 'r1000000-0000-0000-0000-000000000002'),
('aaaaaaaa-0000-0000-0000-000000000001', 'u1000000-0000-0000-0000-000000000003', 'r1000000-0000-0000-0000-000000000003'),
-- Tenant 2
('bbbbbbbb-0000-0000-0000-000000000002', 'u2000000-0000-0000-0000-000000000001', 'r2000000-0000-0000-0000-000000000001'),
('bbbbbbbb-0000-0000-0000-000000000002', 'u2000000-0000-0000-0000-000000000002', 'r2000000-0000-0000-0000-000000000002');

-- ============================================================
-- STAGE 2: VENDOR SELF-REGISTRATION
-- ============================================================

CREATE TABLE vendors (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_name        VARCHAR(255) NOT NULL,
    contact_name        VARCHAR(255) NOT NULL,
    contact_email       VARCHAR(255) NOT NULL,
    contact_phone       VARCHAR(20),
    gst_number          VARCHAR(20),
    pan_number          VARCHAR(10),
    website             VARCHAR(255),
    address             JSONB,
    product_categories  TEXT[]        NOT NULL DEFAULT '{}',
    certifications      TEXT[]        NOT NULL DEFAULT '{}',
    status              VARCHAR(30)   NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected','changes_requested')),
    rejection_reason    TEXT,
    change_request_note TEXT,
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    approved_at         TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    UNIQUE(tenant_id, contact_email),
    UNIQUE(tenant_id, gst_number)
);

CREATE INDEX idx_vendors_tenant       ON vendors(tenant_id);
CREATE INDEX idx_vendors_status       ON vendors(tenant_id, status);
CREATE INDEX idx_vendors_email        ON vendors(tenant_id, contact_email);

CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Vendor documents (uploaded files)
CREATE TABLE vendor_documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    doc_type        VARCHAR(50) NOT NULL
                    CHECK (doc_type IN ('gst_certificate','pan_card','iec_certificate','cancelled_cheque','incorporation_cert','other')),
    original_name   VARCHAR(255) NOT NULL,
    stored_name     VARCHAR(255) NOT NULL,
    mime_type       VARCHAR(100) NOT NULL,
    size_bytes      BIGINT NOT NULL,
    storage_path    TEXT NOT NULL,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendor_docs_vendor ON vendor_documents(vendor_id);
CREATE INDEX idx_vendor_docs_tenant ON vendor_documents(tenant_id);

-- Seed: one approved vendor per tenant for testing
INSERT INTO vendors (id, tenant_id, company_name, contact_name, contact_email, contact_phone,
  gst_number, product_categories, certifications, status, approved_at)
VALUES
(
  'v1000000-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Rayzon Solar Pvt Ltd',
  'Rajesh Kumar',
  'rajesh@rayzon.com',
  '+919876543210',
  '24AABCR1234A1Z5',
  ARRAY['Solar Panels','Inverters'],
  ARRAY['IEC 61215','ISO 9001'],
  'approved',
  NOW()
),
(
  'v1000000-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Solex Energy Ltd',
  'Priya Sharma',
  'priya@solex.com',
  '+919123456780',
  '24AABCS5678B1Z3',
  ARRAY['Solar Panels','Structure'],
  ARRAY['IEC 61215'],
  'pending',
  NULL
),
(
  'v2000000-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000002',
  'Demo Vendor Corp',
  'Demo Contact',
  'contact@demovendor.com',
  '+919000000001',
  '27AABCD1234E1Z1',
  ARRAY['Cables','BOS'],
  ARRAY[],
  'approved',
  NOW()
);

-- ============================================================
-- STAGE 3: VENDOR MANAGEMENT (compliance tracking)
-- ============================================================

CREATE TABLE vendor_compliance (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    cert_name       VARCHAR(100) NOT NULL,
    cert_number     VARCHAR(100),
    issued_by       VARCHAR(255),
    issued_date     DATE,
    expiry_date     DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'valid'
                    CHECK (status IN ('valid','expiring_soon','expired','pending')),
    document_id     UUID REFERENCES vendor_documents(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_compliance_vendor ON vendor_compliance(vendor_id);
CREATE INDEX idx_compliance_tenant ON vendor_compliance(tenant_id);
CREATE INDEX idx_compliance_expiry ON vendor_compliance(tenant_id, expiry_date);
CREATE TRIGGER compliance_updated_at BEFORE UPDATE ON vendor_compliance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE vendor_performance (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    period_year     SMALLINT NOT NULL,
    period_quarter  SMALLINT CHECK (period_quarter BETWEEN 1 AND 4),
    on_time_delivery_pct  NUMERIC(5,2),
    quality_score         NUMERIC(5,2),
    price_competitiveness NUMERIC(5,2),
    responsiveness_score  NUMERIC(5,2),
    overall_score         NUMERIC(5,2) GENERATED ALWAYS AS (
        ROUND((COALESCE(on_time_delivery_pct,0) + COALESCE(quality_score,0) +
               COALESCE(price_competitiveness,0) + COALESCE(responsiveness_score,0)) / 4, 2)
    ) STORED,
    notes           TEXT,
    evaluated_by    UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, vendor_id, period_year, period_quarter)
);
CREATE INDEX idx_perf_vendor ON vendor_performance(tenant_id, vendor_id);

-- Seed compliance data
INSERT INTO vendor_compliance (tenant_id, vendor_id, cert_name, cert_number, issued_by, issued_date, expiry_date, status)
VALUES
('aaaaaaaa-0000-0000-0000-000000000001','v1000000-0000-0000-0000-000000000001','IEC 61215','IEC-2023-001','Bureau Veritas','2023-01-15','2026-01-15','valid'),
('aaaaaaaa-0000-0000-0000-000000000001','v1000000-0000-0000-0000-000000000001','ISO 9001','ISO-2022-456','TUV','2022-06-01','2025-06-01','expiring_soon'),
('aaaaaaaa-0000-0000-0000-000000000001','v1000000-0000-0000-0000-000000000002','IEC 61215','IEC-2024-002','SGS','2024-03-01','2027-03-01','pending');

-- ============================================================
-- STAGE 4: BOM ENGINE
-- ============================================================

CREATE TABLE boms (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    project_name    VARCHAR(255),
    project_type    VARCHAR(50) DEFAULT 'solar_epc'
                    CHECK (project_type IN ('solar_epc','bess','hybrid','other')),
    capacity_mw     NUMERIC(10,3),
    location        VARCHAR(255),
    description     TEXT,
    version         INTEGER NOT NULL DEFAULT 1,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','archived')),
    total_estimated_cost NUMERIC(15,2),
    currency        VARCHAR(3) NOT NULL DEFAULT 'INR',
    created_by      UUID NOT NULL REFERENCES users(id),
    updated_by      UUID REFERENCES users(id),
    published_at    TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_boms_tenant  ON boms(tenant_id);
CREATE INDEX idx_boms_status  ON boms(tenant_id, status);
CREATE TRIGGER boms_updated_at BEFORE UPDATE ON boms FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE bom_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bom_id          UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    line_number     INTEGER NOT NULL,
    category        VARCHAR(100) NOT NULL,
    sub_category    VARCHAR(100),
    item_code       VARCHAR(100),
    description     VARCHAR(500) NOT NULL,
    make_model      VARCHAR(255),
    unit            VARCHAR(20) NOT NULL DEFAULT 'Nos',
    quantity        NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
    unit_rate       NUMERIC(15,2),
    total_amount    NUMERIC(15,2) GENERATED ALWAYS AS (
        CASE WHEN unit_rate IS NOT NULL THEN ROUND(quantity * unit_rate, 2) ELSE NULL END
    ) STORED,
    specifications  JSONB NOT NULL DEFAULT '{}',
    notes           TEXT,
    is_optional     BOOLEAN NOT NULL DEFAULT false,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(bom_id, line_number)
);
CREATE INDEX idx_bom_items_bom    ON bom_items(bom_id);
CREATE INDEX idx_bom_items_tenant ON bom_items(tenant_id);
CREATE TRIGGER bom_items_updated_at BEFORE UPDATE ON bom_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed: one BOM for tenant 1
INSERT INTO boms (id, tenant_id, name, project_name, project_type, capacity_mw, location, status, created_by, currency)
VALUES (
  'b1000000-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Bhandara 100MW — Main BOM',
  'Bhandara Solar Project',
  'solar_epc', 100.000, 'Bhandara, Maharashtra', 'draft',
  'u1000000-0000-0000-0000-000000000001', 'INR'
);

INSERT INTO bom_items (tenant_id, bom_id, line_number, category, sub_category, item_code, description, unit, quantity, unit_rate, specifications, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001',1,'Solar Modules','Monocrystalline','SM-550','550Wp Mono PERC Solar Module','Nos',181819,12500.00,'{"watt_peak":550,"efficiency":21.3,"warranty_years":25}',10),
('aaaaaaaa-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001',2,'Inverters','String Inverter','INV-110K','110kW String Inverter','Nos',910,185000.00,'{"power_kw":110,"efficiency":98.8,"mppt_channels":12}',20),
('aaaaaaaa-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001',3,'Mounting Structure','Fixed Tilt','MS-FT30','GI Hot-Dip Galvanised Fixed Tilt 30° Structure','MT',2200,85000.00,'{"tilt_angle":30,"wind_speed_kmh":150,"galvanising":"hot_dip"}',30),
('aaaaaaaa-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001',4,'DC Cables','Array Cable','DC-4SQ','4 sq.mm DC Solar Cable (UV resistant)','KM',850,22000.00,'{"cross_section_sqmm":4,"voltage_v":1500,"uv_resistant":true}',40),
('aaaaaaaa-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001',5,'AC Cables','MV Cable','AC-33KV','33kV XLPE Underground Cable','KM',12,1850000.00,'{"voltage_kv":33,"insulation":"XLPE","armoured":true}',50),
('aaaaaaaa-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001',6,'Switchgear','Combiner Box','CB-16S','16-String DC Combiner Box','Nos',454,18500.00,'{"strings":16,"voltage_v":1500,"surge_protection":true}',60),
('aaaaaaaa-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001',7,'Monitoring','SCADA','SCADA-100MW','Plant SCADA & Monitoring System','LS',1,4500000.00,'{"protocol":"Modbus_TCP","data_loggers":10,"remote_monitoring":true}',70),
('aaaaaaaa-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001',8,'Civil','Foundation','CIVIL-MODULE','Module Foundation (PCC)','CUM',3500,4500.00,'{"concrete_grade":"M20","type":"pcc"}',80);

-- ============================================================
-- STAGE 5: RFQ SYSTEM
-- ============================================================

CREATE TABLE rfqs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rfq_number          VARCHAR(50) NOT NULL,
    title               VARCHAR(255) NOT NULL,
    project_name        VARCHAR(255),
    bom_id              UUID REFERENCES boms(id),
    description         TEXT,
    status              VARCHAR(30) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','sent','open','closed','cancelled','awarded')),
    submission_deadline TIMESTAMPTZ,
    validity_days       INTEGER NOT NULL DEFAULT 30,
    delivery_location   VARCHAR(255),
    payment_terms       TEXT,
    special_instructions TEXT,
    created_by          UUID NOT NULL REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    closed_at           TIMESTAMPTZ,
    awarded_at          TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    UNIQUE(tenant_id, rfq_number)
);
CREATE INDEX idx_rfqs_tenant ON rfqs(tenant_id);
CREATE INDEX idx_rfqs_status ON rfqs(tenant_id, status);
CREATE TRIGGER rfqs_updated_at BEFORE UPDATE ON rfqs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE rfq_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rfq_id          UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
    bom_item_id     UUID REFERENCES bom_items(id),
    line_number     INTEGER NOT NULL,
    category        VARCHAR(100) NOT NULL,
    description     VARCHAR(500) NOT NULL,
    unit            VARCHAR(20) NOT NULL DEFAULT 'Nos',
    quantity        NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
    specifications  JSONB NOT NULL DEFAULT '{}',
    UNIQUE(rfq_id, line_number)
);
CREATE INDEX idx_rfq_items_rfq ON rfq_items(rfq_id);

CREATE TABLE rfq_vendors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rfq_id          UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
    vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    access_token    UUID NOT NULL DEFAULT uuid_generate_v4(),
    token_expires_at TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'invited'
                    CHECK (status IN ('invited','viewed','submitted','declined')),
    invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    viewed_at       TIMESTAMPTZ,
    responded_at    TIMESTAMPTZ,
    UNIQUE(rfq_id, vendor_id)
);
CREATE INDEX idx_rfq_vendors_rfq    ON rfq_vendors(rfq_id);
CREATE INDEX idx_rfq_vendors_token  ON rfq_vendors(access_token);
CREATE INDEX idx_rfq_vendors_vendor ON rfq_vendors(vendor_id);

-- Auto-generate RFQ number
CREATE SEQUENCE IF NOT EXISTS rfq_seq START 1000;
CREATE OR REPLACE FUNCTION gen_rfq_number(p_tenant_id UUID) RETURNS VARCHAR AS $$
DECLARE
  slug VARCHAR;
  seq  BIGINT;
BEGIN
  SELECT UPPER(LEFT(REPLACE(t.slug,'-',''),4)) INTO slug FROM tenants t WHERE t.id = p_tenant_id;
  seq := nextval('rfq_seq');
  RETURN slug || '-RFQ-' || LPAD(seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STAGE 6: QUOTE SUBMISSION
-- ============================================================

CREATE TABLE quotes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rfq_id          UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
    vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    rfq_vendor_id   UUID NOT NULL REFERENCES rfq_vendors(id) ON DELETE CASCADE,
    quote_number    VARCHAR(50),
    status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','submitted','revised','withdrawn','shortlisted','rejected','awarded')),
    total_amount    NUMERIC(15,2),
    currency        VARCHAR(3) NOT NULL DEFAULT 'INR',
    validity_days   INTEGER,
    delivery_weeks  INTEGER,
    payment_terms   TEXT,
    notes           TEXT,
    submitted_at    TIMESTAMPTZ,
    evaluated_by    UUID REFERENCES users(id),
    evaluated_at    TIMESTAMPTZ,
    evaluation_notes TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(rfq_id, vendor_id)
);
CREATE INDEX idx_quotes_rfq    ON quotes(rfq_id);
CREATE INDEX idx_quotes_vendor ON quotes(vendor_id);
CREATE INDEX idx_quotes_tenant ON quotes(tenant_id);
CREATE INDEX idx_quotes_status ON quotes(tenant_id, status);
CREATE TRIGGER quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE quote_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    rfq_item_id     UUID NOT NULL REFERENCES rfq_items(id),
    line_number     INTEGER NOT NULL,
    description     VARCHAR(500) NOT NULL,
    unit            VARCHAR(20) NOT NULL,
    quantity        NUMERIC(12,3) NOT NULL,
    unit_rate       NUMERIC(15,2) NOT NULL,
    total_amount    NUMERIC(15,2) GENERATED ALWAYS AS (ROUND(quantity * unit_rate, 2)) STORED,
    make_model      VARCHAR(255),
    delivery_weeks  INTEGER,
    notes           TEXT,
    UNIQUE(quote_id, rfq_item_id)
);
CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);

-- Seed: one RFQ for T1
INSERT INTO rfqs (id, tenant_id, rfq_number, title, project_name, bom_id, status, submission_deadline, validity_days, delivery_location, created_by)
VALUES (
  'r1000000-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'ALEN-RFQ-01000',
  'Bhandara 100MW — Solar Modules Supply',
  'Bhandara Solar Project',
  'b1000000-0000-0000-0000-000000000001',
  'draft',
  NOW() + INTERVAL '30 days',
  30, 'Bhandara, Maharashtra',
  'u1000000-0000-0000-0000-000000000001'
);

INSERT INTO rfq_items (tenant_id, rfq_id, bom_item_id, line_number, category, description, unit, quantity, specifications)
SELECT
  'aaaaaaaa-0000-0000-0000-000000000001',
  'r1000000-0000-0000-0000-000000000001',
  i.id, i.line_number, i.category, i.description, i.unit, i.quantity, i.specifications
FROM bom_items i
WHERE i.bom_id = 'b1000000-0000-0000-0000-000000000001'
  AND i.line_number IN (1,2,3);

-- ============================================================
-- STAGE 7: REVERSE BIDDING (MULTI-ROUND)
-- ============================================================

CREATE TABLE bid_sessions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rfq_id              UUID NOT NULL REFERENCES rfqs(id),
    title               VARCHAR(255) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','active','paused','completed','cancelled')),
    current_round       INTEGER NOT NULL DEFAULT 0,
    max_rounds          INTEGER NOT NULL DEFAULT 3,
    round_duration_mins INTEGER NOT NULL DEFAULT 30,
    decrement_type      VARCHAR(20) NOT NULL DEFAULT 'percentage'
                        CHECK (decrement_type IN ('percentage','fixed')),
    min_decrement       NUMERIC(10,4) NOT NULL DEFAULT 1.0,
    start_time          TIMESTAMPTZ,
    end_time            TIMESTAMPTZ,
    current_round_end   TIMESTAMPTZ,
    floor_price         NUMERIC(15,2),
    reserve_price       NUMERIC(15,2),
    show_rank           BOOLEAN NOT NULL DEFAULT true,
    show_best_price     BOOLEAN NOT NULL DEFAULT false,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(rfq_id)
);
CREATE INDEX idx_bid_sessions_tenant ON bid_sessions(tenant_id);
CREATE INDEX idx_bid_sessions_rfq    ON bid_sessions(rfq_id);
CREATE TRIGGER bid_sessions_updated_at BEFORE UPDATE ON bid_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE bid_rounds (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id      UUID NOT NULL REFERENCES bid_sessions(id) ON DELETE CASCADE,
    round_number    INTEGER NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','active','completed')),
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    UNIQUE(session_id, round_number)
);
CREATE INDEX idx_bid_rounds_session ON bid_rounds(session_id);

CREATE TABLE bids (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id      UUID NOT NULL REFERENCES bid_sessions(id) ON DELETE CASCADE,
    round_id        UUID NOT NULL REFERENCES bid_rounds(id) ON DELETE CASCADE,
    vendor_id       UUID NOT NULL REFERENCES vendors(id),
    rfq_vendor_id   UUID REFERENCES rfq_vendors(id),
    amount          NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    rank            INTEGER,
    is_valid        BOOLEAN NOT NULL DEFAULT true,
    invalid_reason  TEXT,
    bid_time        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address      INET,
    UNIQUE(round_id, vendor_id)
);
CREATE INDEX idx_bids_session ON bids(session_id);
CREATE INDEX idx_bids_round   ON bids(round_id);
CREATE INDEX idx_bids_vendor  ON bids(vendor_id);

-- ============================================================
-- STAGE 8: COMPARISON ENGINE
-- ============================================================

CREATE TABLE evaluations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rfq_id          UUID NOT NULL REFERENCES rfqs(id),
    title           VARCHAR(255) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','in_progress','finalized')),
    evaluation_type VARCHAR(20) NOT NULL DEFAULT 'weighted'
                    CHECK (evaluation_type IN ('weighted','l1','technical_commercial')),
    created_by      UUID NOT NULL REFERENCES users(id),
    finalized_by    UUID REFERENCES users(id),
    finalized_at    TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_evaluations_rfq    ON evaluations(rfq_id);
CREATE INDEX idx_evaluations_tenant ON evaluations(tenant_id);
CREATE TRIGGER evaluations_updated_at BEFORE UPDATE ON evaluations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE evaluation_criteria (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    evaluation_id   UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    weight          NUMERIC(5,2) NOT NULL CHECK (weight > 0 AND weight <= 100),
    criterion_type  VARCHAR(20) NOT NULL DEFAULT 'manual'
                    CHECK (criterion_type IN ('manual','price','delivery','technical','commercial')),
    sort_order      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_eval_criteria_eval ON evaluation_criteria(evaluation_id);

CREATE TABLE evaluation_scores (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    evaluation_id   UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    criterion_id    UUID NOT NULL REFERENCES evaluation_criteria(id) ON DELETE CASCADE,
    vendor_id       UUID NOT NULL REFERENCES vendors(id),
    quote_id        UUID REFERENCES quotes(id),
    raw_score       NUMERIC(5,2) NOT NULL CHECK (raw_score >= 0 AND raw_score <= 100),
    notes           TEXT,
    scored_by       UUID REFERENCES users(id),
    scored_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(evaluation_id, criterion_id, vendor_id)
);
CREATE INDEX idx_eval_scores_eval    ON evaluation_scores(evaluation_id);
CREATE INDEX idx_eval_scores_vendor  ON evaluation_scores(vendor_id);

-- ============================================================
-- STAGE 9: APPROVAL WORKFLOW + PURCHASE ORDERS
-- ============================================================

CREATE TABLE purchase_orders (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    po_number           VARCHAR(50) NOT NULL,
    rfq_id              UUID REFERENCES rfqs(id),
    quote_id            UUID REFERENCES quotes(id),
    vendor_id           UUID NOT NULL REFERENCES vendors(id),
    evaluation_id       UUID REFERENCES evaluations(id),
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    status              VARCHAR(30) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','pending_approval','approved','rejected','cancelled','issued','closed')),
    total_amount        NUMERIC(15,2) NOT NULL CHECK (total_amount > 0),
    currency            VARCHAR(3) NOT NULL DEFAULT 'INR',
    delivery_date       DATE,
    delivery_location   VARCHAR(255),
    payment_terms       TEXT,
    special_conditions  TEXT,
    current_level       INTEGER NOT NULL DEFAULT 0,
    approval_levels     INTEGER NOT NULL DEFAULT 2,
    created_by          UUID NOT NULL REFERENCES users(id),
    issued_by           UUID REFERENCES users(id),
    issued_at           TIMESTAMPTZ,
    cancelled_by        UUID REFERENCES users(id),
    cancelled_at        TIMESTAMPTZ,
    cancellation_reason TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    UNIQUE(tenant_id, po_number)
);
CREATE INDEX idx_pos_tenant  ON purchase_orders(tenant_id);
CREATE INDEX idx_pos_status  ON purchase_orders(tenant_id, status);
CREATE INDEX idx_pos_vendor  ON purchase_orders(vendor_id);
CREATE TRIGGER pos_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE po_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    po_id           UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    line_number     INTEGER NOT NULL,
    description     VARCHAR(500) NOT NULL,
    unit            VARCHAR(20) NOT NULL DEFAULT 'Nos',
    quantity        NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
    unit_rate       NUMERIC(15,2) NOT NULL CHECK (unit_rate >= 0),
    total_amount    NUMERIC(15,2) GENERATED ALWAYS AS (ROUND(quantity * unit_rate, 2)) STORED,
    hsn_code        VARCHAR(20),
    gst_rate        NUMERIC(5,2) DEFAULT 18.0,
    notes           TEXT,
    UNIQUE(po_id, line_number)
);
CREATE INDEX idx_po_items_po ON po_items(po_id);

CREATE TABLE po_approvals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    po_id           UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    level           INTEGER NOT NULL,
    approver_id     UUID NOT NULL REFERENCES users(id),
    role_name       VARCHAR(100),
    action          VARCHAR(20) NOT NULL
                    CHECK (action IN ('approved','rejected','requested_changes')),
    comments        TEXT,
    acted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_po_approvals_po ON po_approvals(po_id);

CREATE SEQUENCE IF NOT EXISTS po_seq START 1000;
CREATE OR REPLACE FUNCTION gen_po_number(p_tenant_id UUID) RETURNS VARCHAR AS $$
DECLARE slug VARCHAR; seq BIGINT;
BEGIN
  SELECT UPPER(LEFT(REPLACE(t.slug,'-',''),4)) INTO slug FROM tenants t WHERE t.id = p_tenant_id;
  seq := nextval('po_seq');
  RETURN slug || '-PO-' || LPAD(seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STAGE 11: REPORTS (materialized views + helper functions)
-- ============================================================

-- KPI summary view (refreshed on read for simplicity)
CREATE OR REPLACE VIEW vw_tenant_kpis AS
SELECT
  t.id as tenant_id,
  t.name as tenant_name,
  (SELECT COUNT(*) FROM vendors v WHERE v.tenant_id=t.id AND v.deleted_at IS NULL) as total_vendors,
  (SELECT COUNT(*) FROM vendors v WHERE v.tenant_id=t.id AND v.status='approved' AND v.deleted_at IS NULL) as approved_vendors,
  (SELECT COUNT(*) FROM boms b WHERE b.tenant_id=t.id AND b.deleted_at IS NULL) as total_boms,
  (SELECT COUNT(*) FROM rfqs r WHERE r.tenant_id=t.id AND r.deleted_at IS NULL) as total_rfqs,
  (SELECT COUNT(*) FROM rfqs r WHERE r.tenant_id=t.id AND r.status='awarded' AND r.deleted_at IS NULL) as awarded_rfqs,
  (SELECT COUNT(*) FROM quotes q WHERE q.tenant_id=t.id) as total_quotes,
  (SELECT COALESCE(SUM(po.total_amount),0) FROM purchase_orders po WHERE po.tenant_id=t.id AND po.status IN ('approved','issued','closed') AND po.deleted_at IS NULL) as total_po_value,
  (SELECT COUNT(*) FROM purchase_orders po WHERE po.tenant_id=t.id AND po.deleted_at IS NULL) as total_pos,
  (SELECT COUNT(*) FROM ai_providers ap WHERE ap.tenant_id=t.id AND ap.is_active=true) as active_ai_providers,
  (SELECT COUNT(*) FROM ai_insights ai WHERE ai.tenant_id=t.id AND ai.status='completed') as total_ai_insights
FROM tenants t WHERE t.deleted_at IS NULL;

-- ============================================================
-- STAGE 10: BACKUP & RESTORE SYSTEM
-- ============================================================

CREATE TABLE backup_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
    backup_type     VARCHAR(20) NOT NULL DEFAULT 'full'
                    CHECK (backup_type IN ('full','database','files')),
    scope           VARCHAR(20) NOT NULL DEFAULT 'system'
                    CHECK (scope IN ('system','tenant')),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','running','completed','failed')),
    triggered_by    UUID REFERENCES users(id),
    trigger_type    VARCHAR(20) NOT NULL DEFAULT 'manual'
                    CHECK (trigger_type IN ('manual','scheduled')),
    db_file         TEXT,
    files_archive   TEXT,
    db_size_bytes   BIGINT,
    files_size_bytes BIGINT,
    error_message   TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_backup_jobs_tenant ON backup_jobs(tenant_id);
CREATE INDEX idx_backup_jobs_status ON backup_jobs(status);
CREATE INDEX idx_backup_jobs_created ON backup_jobs(created_at DESC);

CREATE TABLE restore_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    backup_job_id   UUID NOT NULL REFERENCES backup_jobs(id),
    triggered_by    UUID REFERENCES users(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','running','completed','failed')),
    restore_scope   VARCHAR(20) NOT NULL DEFAULT 'full'
                    CHECK (restore_scope IN ('full','database','files')),
    confirmed       BOOLEAN NOT NULL DEFAULT false,
    confirmation_token TEXT,
    error_message   TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_restore_jobs_backup ON restore_jobs(backup_job_id);

-- ============================================================
-- AI ANALYTICS MODULE
-- ============================================================

-- AI provider configurations (per tenant, encrypted key storage)
CREATE TABLE ai_providers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider        VARCHAR(50) NOT NULL
                    CHECK (provider IN ('anthropic','openai','gemini','cohere','mistral','custom')),
    name            VARCHAR(100) NOT NULL,
    api_key_enc     TEXT NOT NULL,          -- AES-256 encrypted
    api_key_hint    VARCHAR(10),            -- last 4 chars for display
    base_url        TEXT,                   -- for custom/self-hosted
    model           VARCHAR(100),           -- e.g. claude-sonnet-4-5
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    settings        JSONB NOT NULL DEFAULT '{}',
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ,
    UNIQUE(tenant_id, provider, name)
);
CREATE INDEX idx_ai_providers_tenant ON ai_providers(tenant_id);
CREATE TRIGGER ai_providers_updated_at BEFORE UPDATE ON ai_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- AI insight jobs (cached results, tenant-scoped)
CREATE TABLE ai_insights (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_id     UUID REFERENCES ai_providers(id) ON DELETE SET NULL,
    insight_type    VARCHAR(50) NOT NULL
                    CHECK (insight_type IN (
                        'spend_forecast','vendor_risk','rfq_optimization',
                        'price_benchmark','po_anomaly','vendor_recommendation',
                        'savings_opportunity','compliance_risk'
                    )),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','running','completed','failed')),
    input_context   JSONB NOT NULL DEFAULT '{}',
    result          JSONB,
    summary         TEXT,
    confidence      NUMERIC(5,2),       -- 0-100
    tokens_used     INTEGER,
    error_message   TEXT,
    triggered_by    UUID REFERENCES users(id),
    trigger_type    VARCHAR(20) NOT NULL DEFAULT 'manual'
                    CHECK (trigger_type IN ('manual','scheduled','event')),
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_ai_insights_tenant  ON ai_insights(tenant_id);
CREATE INDEX idx_ai_insights_type    ON ai_insights(tenant_id, insight_type);
CREATE INDEX idx_ai_insights_status  ON ai_insights(tenant_id, status);

-- AI chat history (per-session, for conversational analytics)
CREATE TABLE ai_chat_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    provider_id     UUID REFERENCES ai_providers(id) ON DELETE SET NULL,
    title           VARCHAR(255),
    messages        JSONB NOT NULL DEFAULT '[]',
    total_tokens    INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_chat_tenant ON ai_chat_sessions(tenant_id, user_id);
CREATE TRIGGER ai_chat_updated_at BEFORE UPDATE ON ai_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
