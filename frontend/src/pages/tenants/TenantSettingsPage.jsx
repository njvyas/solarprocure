import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { tenantsAPI } from '../../utils/api';

/* ── helpers ──────────────────────────────────────────────── */
function Alert({ type, msg, onClose }) {
  if (!msg) return null;
  const ok = type === 'success';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '16px',
      background: ok ? 'var(--color-success-light)' : 'var(--color-danger-light)',
      color: ok ? 'var(--color-success)' : 'var(--color-danger)',
      border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
      <span>{msg}</span>
      {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
        fontSize: '16px', lineHeight: 1, color: 'inherit', padding: '0 0 0 12px' }}>×</button>}
    </div>
  );
}

const ALL_MODULES = ['vendors','boms','rfqs','quotes','bidding','evaluations','pos','reports','backup','ai','audit','users','tenants','roles'];
const ALL_ACTIONS = ['read','create','update','delete','approve','send','evaluate','use','manage','restore'];

/* ── Tab: Company Info ──────────────────────────────────────── */
function CompanyInfoTab({ can }) {
  const [tenant, setTenant]   = useState(null);
  const [form, setForm]       = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState(null);

  useEffect(() => {
    tenantsAPI.current()
      .then(({ data }) => {
        const t = data.data;
        setTenant(t);
        setForm({
          name:      t.name || '',
          gstNumber: t.gst_number || '',
          panNumber: t.pan_number || '',
          line1:     t.address?.line1 || '',
          line2:     t.address?.line2 || '',
          city:      t.address?.city || '',
          state:     t.address?.state || '',
          pincode:   t.address?.pincode || '',
          country:   t.address?.country || 'India',
        });
      })
      .catch(() => setMsg({ type: 'error', text: 'Failed to load tenant details.' }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      await tenantsAPI.update({
        name:      form.name,
        gstNumber: form.gstNumber || undefined,
        panNumber: form.panNumber || undefined,
        address: {
          line1:   form.line1,
          line2:   form.line2,
          city:    form.city,
          state:   form.state,
          pincode: form.pincode,
          country: form.country,
        },
      });
      setMsg({ type: 'success', text: 'Company details saved successfully.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Save failed.' });
    } finally { setSaving(false); }
  };

  const set = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</p>;

  const canEdit = can('tenants', 'update');

  return (
    <form onSubmit={handleSave}>
      <Alert type={msg?.type} msg={msg?.text} onClose={() => setMsg(null)} />

      {/* Tenant meta */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'start', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div className="form-label" style={{ marginBottom: '4px' }}>Plan</div>
          <span className="badge badge-solar" style={{ textTransform: 'capitalize' }}>
            {tenant?.plan || 'starter'}
          </span>
        </div>
        <div>
          <div className="form-label" style={{ marginBottom: '4px' }}>Status</div>
          <span className={`badge badge-${tenant?.status === 'active' ? 'success' : 'warning'}`} style={{ textTransform: 'capitalize' }}>
            {tenant?.status}
          </span>
        </div>
      </div>

      {/* Company name */}
      <div className="form-group" style={{ marginBottom: '20px' }}>
        <label className="form-label">Company Name *</label>
        <input className="form-input" value={form.name} onChange={set('name')} required disabled={!canEdit} />
      </div>

      {/* GST + PAN */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div className="form-group">
          <label className="form-label">GST Number</label>
          <input className="form-input" value={form.gstNumber} onChange={set('gstNumber')} disabled={!canEdit}
            placeholder="22AAAAA0000A1Z5" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Format: 15-char GSTIN</span>
        </div>
        <div className="form-group">
          <label className="form-label">PAN Number</label>
          <input className="form-input" value={form.panNumber} onChange={set('panNumber')} disabled={!canEdit}
            placeholder="AAAAA0000A" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Format: 10-char PAN</span>
        </div>
      </div>

      {/* Address */}
      <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: '16px' }}>Registered Address</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label">Address Line 1</label>
            <input className="form-input" value={form.line1} onChange={set('line1')} disabled={!canEdit} placeholder="Building, Street" />
          </div>
          <div className="form-group">
            <label className="form-label">Address Line 2</label>
            <input className="form-input" value={form.line2} onChange={set('line2')} disabled={!canEdit} placeholder="Area, Landmark (optional)" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            {[['City','city'],['State','state'],['Pincode','pincode']].map(([lbl, key]) => (
              <div className="form-group" key={key}>
                <label className="form-label">{lbl}</label>
                <input className="form-input" value={form[key]} onChange={set(key)} disabled={!canEdit} />
              </div>
            ))}
          </div>
          <div className="form-group">
            <label className="form-label">Country</label>
            <input className="form-input" value={form.country} onChange={set('country')} disabled={!canEdit} />
          </div>
        </div>
      </div>

      {canEdit && (
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Company Details'}
        </button>
      )}
      {!canEdit && (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          You need <code>tenants:update</code> permission to edit company details.
        </p>
      )}
    </form>
  );
}

/* ── Tab: Roles & Permissions ───────────────────────────────── */
function RolesTab({ can }) {
  const [roles, setRoles]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [msg, setMsg]             = useState(null);
  const [creating, setCreating]   = useState(false);
  const [newRole, setNewRole]     = useState({ name: '', description: '', permissions: {} });
  const [expanded, setExpanded]   = useState(null);

  const load = useCallback(() => {
    tenantsAPI.roles()
      .then(({ data }) => setRoles(data.data || []))
      .catch(() => setMsg({ type: 'error', text: 'Failed to load roles.' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleAction = (mod, action) => {
    setNewRole(prev => {
      const cur = prev.permissions[mod] || [];
      const has = cur.includes(action);
      const next = has ? cur.filter(a => a !== action) : [...cur, action];
      const perms = { ...prev.permissions };
      if (next.length === 0) delete perms[mod]; else perms[mod] = next;
      return { ...prev, permissions: perms };
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newRole.name.trim()) return;
    if (Object.keys(newRole.permissions).length === 0) {
      setMsg({ type: 'error', text: 'Assign at least one permission before creating the role.' }); return;
    }
    setCreating(true); setMsg(null);
    try {
      await tenantsAPI.createRole({ name: newRole.name, description: newRole.description, permissions: newRole.permissions });
      setMsg({ type: 'success', text: `Role "${newRole.name}" created.` });
      setNewRole({ name: '', description: '', permissions: {} });
      setExpanded(null);
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to create role.' });
    } finally { setCreating(false); }
  };

  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</p>;

  return (
    <div>
      <Alert type={msg?.type} msg={msg?.text} onClose={() => setMsg(null)} />

      {/* Existing roles */}
      <div style={{ marginBottom: '24px' }}>
        {roles.map(role => (
          <div key={role.id} className="card" style={{ marginBottom: '8px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', cursor: 'pointer' }}
              onClick={() => setExpanded(expanded === role.id ? null : role.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{role.name}</span>
                  {role.is_system && <span className="badge badge-muted">system</span>}
                  <span className="badge badge-info">{role.user_count} user{role.user_count !== 1 ? 's' : ''}</span>
                </div>
                {role.description && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{role.description}</div>
                )}
              </div>
              <span style={{ fontSize: '18px', color: 'var(--text-muted)', userSelect: 'none', flexShrink: 0 }}>
                {expanded === role.id ? '▲' : '▼'}
              </span>
            </div>

            {expanded === role.id && (
              <div style={{ borderTop: '1px solid var(--color-border)', padding: '16px 18px' }}>
                {role.permissions?.['*'] ? (
                  <span className="badge badge-solar">⭐ Super Admin — all permissions</span>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                    {ALL_MODULES.map(mod => {
                      const actions = role.permissions?.[mod] || [];
                      if (actions.length === 0) return null;
                      return (
                        <div key={mod} style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)',
                          background: 'var(--color-primary-light)', border: '1px solid rgba(59,130,246,0.2)' }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase',
                            letterSpacing: '0.04em', color: 'var(--color-primary)', marginBottom: '4px' }}>{mod}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {actions.includes('*') ? '★ all' : actions.join(' · ')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create new role */}
      {can('roles', 'create') && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
            Create New Role
          </h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">Role Name *</label>
                <input className="form-input" value={newRole.name} required
                  onChange={e => setNewRole(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Site Engineer" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" value={newRole.description}
                  onChange={e => setNewRole(p => ({ ...p, description: e.target.value }))}
                  placeholder="What this role can do" />
              </div>
            </div>

            {/* Permission builder matrix */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                Permissions
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '6px 12px 6px 0', color: 'var(--text-muted)',
                        fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em',
                        borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap', width: '110px' }}>
                        Module
                      </th>
                      {ALL_ACTIONS.map(a => (
                        <th key={a} style={{ textAlign: 'center', padding: '6px 8px',
                          color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase',
                          letterSpacing: '0.04em', borderBottom: '1px solid var(--color-border)',
                          whiteSpace: 'nowrap', fontSize: '10px' }}>
                          {a}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_MODULES.map((mod, ri) => (
                      <tr key={mod} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '7px 12px 7px 0', color: 'var(--text-secondary)',
                          fontWeight: '500', borderBottom: '1px solid var(--color-border)',
                          whiteSpace: 'nowrap' }}>
                          {mod}
                        </td>
                        {ALL_ACTIONS.map(action => {
                          const has = (newRole.permissions[mod] || []).includes(action);
                          return (
                            <td key={action} style={{ textAlign: 'center', padding: '7px 8px',
                              borderBottom: '1px solid var(--color-border)' }}>
                              <input type="checkbox" checked={has}
                                onChange={() => toggleAction(mod, action)}
                                style={{ width: '14px', height: '14px', cursor: 'pointer',
                                  accentColor: 'var(--color-primary)' }} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? 'Creating…' : 'Create Role'}
              </button>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {Object.keys(newRole.permissions).length} module{Object.keys(newRole.permissions).length !== 1 ? 's' : ''} configured
              </span>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
const TABS = [
  { id: 'company', label: 'Company Info',      perm: null },
  { id: 'roles',   label: 'Roles & Permissions', perm: ['roles', 'read'] },
];

export default function TenantSettingsPage() {
  const { can } = useAuth();
  const [activeTab, setActiveTab] = useState('company');

  const visibleTabs = TABS.filter(t => !t.perm || can(t.perm[0], t.perm[1]));

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '600', margin: '0 0 4px', color: 'var(--text-primary)' }}>
          Tenant Settings
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          Manage company information, GST/PAN details, and role-based access control
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--color-border)',
        marginBottom: '24px' }}>
        {visibleTabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: '13px',
              fontWeight: activeTab === tab.id ? '600' : '400', fontFamily: 'var(--font-sans)',
              background: 'transparent', borderBottom: activeTab === tab.id
                ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-secondary)',
              marginBottom: '-1px', transition: 'all 0.15s' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card" style={{ padding: '24px' }}>
        {activeTab === 'company' && <CompanyInfoTab can={can} />}
        {activeTab === 'roles'   && <RolesTab can={can} />}
      </div>
    </div>
  );
}
