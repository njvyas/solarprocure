import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { settingsAPI } from '../../utils/api';

/* ── shared helpers ─────────────────────────────────────────── */
function Alert({ type, msg, onClose }) {
  if (!msg) return null;
  const ok = type === 'success';
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'10px 14px', borderRadius:'var(--radius-md)', fontSize:'13px', marginBottom:'16px',
      background: ok ? 'var(--color-success-light)' : 'var(--color-danger-light)',
      color: ok ? 'var(--color-success)' : 'var(--color-danger)',
      border:`1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
      <span>{msg}</span>
      {onClose && <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer',
        fontSize:'16px', lineHeight:1, color:'inherit', padding:'0 0 0 12px' }}>×</button>}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="form-group" style={{ marginBottom:'16px' }}>
      <label className="form-label">{label}</label>
      {children}
      {hint && <span style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px', display:'block' }}>{hint}</span>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background:'var(--color-bg-elevated)', borderRadius:'var(--radius-md)',
      border:'1px solid var(--color-border)', padding:'20px', marginBottom:'16px' }}>
      <h3 style={{ fontSize:'12px', fontWeight:'600', color:'var(--text-muted)', textTransform:'uppercase',
        letterSpacing:'0.06em', marginBottom:'16px' }}>{title}</h3>
      {children}
    </div>
  );
}

/* ── Email tab ──────────────────────────────────────────────── */
function EmailTab({ can }) {
  const [form, setForm]     = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg]       = useState(null);

  useEffect(() => {
    settingsAPI.get('email').then(({ data }) => setForm(data.data?.settings || {}));
  }, []);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const setCheck = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.checked ? 'true' : 'false' }));

  const save = async (e) => {
    e.preventDefault(); setSaving(true); setMsg(null);
    try {
      await settingsAPI.update('email', form);
      setMsg({ type:'success', text:'Email settings saved.' });
    } catch (err) { setMsg({ type:'error', text: err.response?.data?.error || 'Save failed.' }); }
    finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true); setMsg(null);
    try {
      const { data } = await settingsAPI.testEmail();
      setMsg({ type:'success', text: data.data?.message || 'Test email sent!' });
    } catch (err) { setMsg({ type:'error', text: err.response?.data?.error || 'Test failed.' }); }
    finally { setTesting(false); }
  };

  if (!form) return <p style={{ color:'var(--text-muted)', fontSize:'13px' }}>Loading…</p>;

  return (
    <form onSubmit={save}>
      <Alert type={msg?.type} msg={msg?.text} onClose={() => setMsg(null)} />

      <Section title="SMTP Server">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 120px', gap:'12px' }}>
          <Field label="SMTP Host" hint="e.g. smtp.gmail.com or smtp.sendgrid.net">
            <input className="form-input" value={form.host || ''} onChange={set('host')}
              placeholder="smtp.gmail.com" disabled={!can('settings','manage')} />
          </Field>
          <Field label="Port">
            <input className="form-input" type="number" value={form.port || '587'} onChange={set('port')}
              placeholder="587" disabled={!can('settings','manage')} />
          </Field>
        </div>
        <Field label="Encryption">
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'4px' }}>
            <input type="checkbox" id="smtp-secure" checked={form.secure === 'true'}
              onChange={setCheck('secure')} disabled={!can('settings','manage')}
              style={{ width:'16px', height:'16px', accentColor:'var(--color-primary)' }} />
            <label htmlFor="smtp-secure" style={{ fontSize:'13px', color:'var(--text-primary)', cursor:'pointer' }}>
              Use SSL/TLS (port 465). Uncheck for STARTTLS (port 587).
            </label>
          </div>
        </Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <Field label="SMTP Username">
            <input className="form-input" type="email" value={form.user || ''} onChange={set('user')}
              placeholder="your@email.com" disabled={!can('settings','manage')} />
          </Field>
          <Field label="SMTP Password" hint="Shown as •••••••• if already set">
            <input className="form-input" type="password" value={form.password || ''} onChange={set('password')}
              placeholder="App password or SMTP password" disabled={!can('settings','manage')}
              autoComplete="new-password" />
          </Field>
        </div>
      </Section>

      <Section title="Sender Identity">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <Field label="From Name" hint="Appears in recipient's inbox">
            <input className="form-input" value={form.from_name || ''} onChange={set('from_name')}
              placeholder="SolarProcure" disabled={!can('settings','manage')} />
          </Field>
          <Field label="From Email" hint="Must be verified with your SMTP provider">
            <input className="form-input" type="email" value={form.from_email || ''} onChange={set('from_email')}
              placeholder="noreply@yourdomain.com" disabled={!can('settings','manage')} />
          </Field>
        </div>
      </Section>

      <Section title="Status">
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <input type="checkbox" id="email-enabled" checked={form.enabled === 'true'}
            onChange={setCheck('enabled')} disabled={!can('settings','manage')}
            style={{ width:'16px', height:'16px', accentColor:'var(--color-primary)' }} />
          <label htmlFor="email-enabled" style={{ fontSize:'13px', color:'var(--text-primary)', cursor:'pointer' }}>
            Enable email notifications (RFQ invites, vendor registration alerts, PO notifications)
          </label>
        </div>
      </Section>

      {can('settings','manage') && (
        <div style={{ display:'flex', gap:'10px', marginTop:'8px' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Email Settings'}
          </button>
          <button type="button" className="btn btn-secondary" disabled={testing} onClick={test}>
            {testing ? 'Sending…' : '✉ Send Test Email'}
          </button>
        </div>
      )}
    </form>
  );
}

/* ── Security tab ───────────────────────────────────────────── */
function SecurityTab({ can }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    settingsAPI.get('security').then(({ data }) => setForm(data.data?.settings || {}));
  }, []);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault(); setSaving(true); setMsg(null);
    try {
      await settingsAPI.update('security', form);
      setMsg({ type:'success', text:'Security settings saved. Restart backend to apply rate-limit changes.' });
    } catch (err) { setMsg({ type:'error', text: err.response?.data?.error || 'Save failed.' }); }
    finally { setSaving(false); }
  };

  if (!form) return <p style={{ color:'var(--text-muted)', fontSize:'13px' }}>Loading…</p>;

  const Row = ({ label, k, hint, min=1, max=9999 }) => (
    <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', alignItems:'start', gap:'16px', marginBottom:'12px' }}>
      <div>
        <div style={{ fontSize:'13px', color:'var(--text-primary)', fontWeight:'500' }}>{label}</div>
        {hint && <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>{hint}</div>}
      </div>
      <input className="form-input" type="number" min={min} max={max} value={form[k] || ''}
        onChange={set(k)} disabled={!can('settings','manage')} style={{ maxWidth:'120px' }} />
    </div>
  );

  return (
    <form onSubmit={save}>
      <Alert type={msg?.type} msg={msg?.text} onClose={() => setMsg(null)} />
      <Section title="Login Protection">
        <Row label="Max failed logins" k="login_max_attempts" hint="Before account lockout" min={1} max={50} />
        <Row label="Login window (mins)" k="login_window_mins" hint="Time window for failed attempts" min={1} max={1440} />
        <Row label="Lockout duration (mins)" k="lockout_mins" hint="How long account stays locked" min={1} max={1440} />
        <Row label="Session timeout (mins)" k="session_timeout_mins" hint="Idle logout time" min={5} max={1440} />
      </Section>
      <Section title="API Rate Limiting">
        <Row label="Global API limit" k="api_rate_limit" hint="Max requests per window" min={10} max={10000} />
        <Row label="API window (mins)" k="api_rate_window_mins" hint="Rate limit window" min={1} max={60} />
        <Row label="Registration limit" k="reg_rate_limit" hint="Max vendor registrations per window" min={1} max={500} />
        <Row label="Registration window (mins)" k="reg_rate_window_mins" hint="Per IP" min={1} max={1440} />
      </Section>
      {can('settings','manage') && (
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Security Settings'}
        </button>
      )}
    </form>
  );
}

/* ── Storage tab ────────────────────────────────────────────── */
function StorageTab({ can }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    settingsAPI.get('storage').then(({ data }) => setForm(data.data?.settings || {}));
  }, []);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault(); setSaving(true); setMsg(null);
    try {
      await settingsAPI.update('storage', form);
      setMsg({ type:'success', text:'Storage settings saved.' });
    } catch (err) { setMsg({ type:'error', text: err.response?.data?.error || 'Save failed.' }); }
    finally { setSaving(false); }
  };

  if (!form) return <p style={{ color:'var(--text-muted)', fontSize:'13px' }}>Loading…</p>;

  return (
    <form onSubmit={save}>
      <Alert type={msg?.type} msg={msg?.text} onClose={() => setMsg(null)} />
      <Section title="File Uploads">
        <Field label="Max file size (MB)" hint="Applies to vendor document uploads. Default: 10 MB.">
          <input className="form-input" type="number" min={1} max={100}
            value={form.max_file_size_mb || '10'} onChange={set('max_file_size_mb')}
            disabled={!can('settings','manage')} style={{ maxWidth:'120px' }} />
        </Field>
        <Field label="Allowed MIME types" hint="Comma-separated. Default: PDF, JPEG, PNG, WebP.">
          <input className="form-input" value={form.allowed_mime_types || ''}
            onChange={set('allowed_mime_types')} disabled={!can('settings','manage')}
            placeholder="application/pdf,image/jpeg,image/png" />
        </Field>
      </Section>
      <Section title="Backups">
        <Field label="Backup retention (days)" hint="Backups older than this are automatically deleted.">
          <input className="form-input" type="number" min={1} max={365}
            value={form.backup_retention_days || '30'} onChange={set('backup_retention_days')}
            disabled={!can('settings','manage')} style={{ maxWidth:'120px' }} />
        </Field>
      </Section>
      {can('settings','manage') && (
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Storage Settings'}
        </button>
      )}
    </form>
  );
}

/* ── Branding tab ───────────────────────────────────────────── */
function BrandingTab({ can }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    settingsAPI.get('branding').then(({ data }) => setForm(data.data?.settings || {}));
  }, []);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault(); setSaving(true); setMsg(null);
    try {
      await settingsAPI.update('branding', form);
      setMsg({ type:'success', text:'Branding settings saved. Reload the page to see name changes.' });
    } catch (err) { setMsg({ type:'error', text: err.response?.data?.error || 'Save failed.' }); }
    finally { setSaving(false); }
  };

  if (!form) return <p style={{ color:'var(--text-muted)', fontSize:'13px' }}>Loading…</p>;

  return (
    <form onSubmit={save}>
      <Alert type={msg?.type} msg={msg?.text} onClose={() => setMsg(null)} />
      <Section title="Application Identity">
        <Field label="Application Name" hint="Shown in the sidebar header, page titles, and outbound emails.">
          <input className="form-input" value={form.app_name || ''} onChange={set('app_name')}
            placeholder="SolarProcure" disabled={!can('settings','manage')} />
        </Field>
        <Field label="Support Email" hint="Shown to vendors on bid pages and error messages.">
          <input className="form-input" type="email" value={form.support_email || ''} onChange={set('support_email')}
            placeholder="support@yourdomain.com" disabled={!can('settings','manage')} />
        </Field>
        <Field label="Logo URL" hint="HTTPS URL to your logo image. Leave blank to use app name text.">
          <input className="form-input" type="url" value={form.logo_url || ''} onChange={set('logo_url')}
            placeholder="https://yourdomain.com/logo.png" disabled={!can('settings','manage')} />
        </Field>
        <Field label="Primary Colour">
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <input type="color" value={form.primary_color || '#3B82F6'} onChange={set('primary_color')}
              disabled={!can('settings','manage')}
              style={{ width:'44px', height:'36px', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', cursor:'pointer', padding:'2px' }} />
            <input className="form-input" value={form.primary_color || '#3B82F6'} onChange={set('primary_color')}
              placeholder="#3B82F6" disabled={!can('settings','manage')} style={{ maxWidth:'120px', fontFamily:'var(--font-mono)' }} />
            <div style={{ width:'32px', height:'32px', borderRadius:'var(--radius-md)', background: form.primary_color || '#3B82F6', border:'1px solid var(--color-border)' }} />
          </div>
        </Field>
      </Section>
      {can('settings','manage') && (
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Branding Settings'}
        </button>
      )}
    </form>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
const TABS = [
  { id:'email',    label:'Email & Notifications', icon:'✉' },
  { id:'security', label:'Security',               icon:'🔒' },
  { id:'storage',  label:'Storage & Backup',       icon:'💾' },
  { id:'branding', label:'Branding',               icon:'🎨' },
];

export default function SystemSettingsPage() {
  const { can } = useAuth();
  const [activeTab, setActiveTab] = useState('email');

  if (!can('settings', 'read')) {
    return (
      <div className="card" style={{ padding:'32px', textAlign:'center' }}>
        <div style={{ fontSize:'32px', marginBottom:'12px' }}>🔒</div>
        <p style={{ color:'var(--text-muted)', fontSize:'14px' }}>
          You need <code>settings:read</code> permission to view system settings.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth:'860px' }}>
      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'600', margin:'0 0 4px', color:'var(--text-primary)' }}>
          System Settings
        </h1>
        <p style={{ fontSize:'13px', color:'var(--text-muted)', margin:0 }}>
          Runtime configuration — no server restart needed. Changes take effect immediately.
        </p>
      </div>

      <div style={{ display:'flex', gap:'4px', borderBottom:'1px solid var(--color-border)', marginBottom:'24px' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding:'10px 18px', border:'none', cursor:'pointer', fontSize:'13px',
              fontWeight: activeTab === tab.id ? '600' : '400', fontFamily:'var(--font-sans)',
              background:'transparent', borderBottom: activeTab === tab.id
                ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-secondary)',
              marginBottom:'-1px', transition:'all 0.15s', display:'flex', alignItems:'center', gap:'6px' }}>
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding:'24px' }}>
        {activeTab === 'email'    && <EmailTab    can={can} />}
        {activeTab === 'security' && <SecurityTab can={can} />}
        {activeTab === 'storage'  && <StorageTab  can={can} />}
        {activeTab === 'branding' && <BrandingTab can={can} />}
      </div>
    </div>
  );
}
