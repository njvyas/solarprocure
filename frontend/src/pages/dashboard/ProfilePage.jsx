import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../utils/api';

const MODULES = ['vendors','boms','rfqs','quotes','bidding','evaluations','pos','reports','backup','ai','audit','users','tenants','roles'];

function Section({ title, children }) {
  return (
    <div className="card" style={{ padding: '24px', marginBottom: '16px' }}>
      <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '20px',
        paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', letterSpacing: '-0.01em' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Alert({ type, msg }) {
  if (!msg) return null;
  const ok = type === 'success';
  return (
    <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px',
      background: ok ? 'var(--color-success-light)' : 'var(--color-danger-light)',
      color: ok ? 'var(--color-success)' : 'var(--color-danger)',
      border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
      marginTop: '12px' }}>
      {msg}
    </div>
  );
}

export default function ProfilePage() {
  const { user, can } = useAuth();

  // Profile edit
  const [editForm, setEditForm]     = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '', phone: user?.phone || '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg]       = useState(null);

  // Password change
  const [pwForm, setPwForm]         = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading]   = useState(false);
  const [pwMsg, setPwMsg]           = useState(null);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setEditLoading(true); setEditMsg(null);
    try {
      await authAPI.updateMe({ firstName: editForm.firstName, lastName: editForm.lastName, phone: editForm.phone || null });
      setEditMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setEditMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update profile.' });
    } finally { setEditLoading(false); }
  };

  const handlePwChange = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg({ type: 'error', text: 'New passwords do not match.' }); return;
    }
    setPwLoading(true); setPwMsg(null);
    try {
      await authAPI.changePassword(pwForm.currentPassword, pwForm.newPassword);
      setPwMsg({ type: 'success', text: 'Password changed successfully.' });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.error || 'Failed to change password.' });
    } finally { setPwLoading(false); }
  };

  if (!user) return null;

  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
  const roleNames = Array.isArray(user.roles)
    ? user.roles.map(r => (typeof r === 'object' ? r.name : r)).join(', ')
    : '—';

  // Collect permissions from all roles
  const permsSummary = (() => {
    if (!user.permissions) return [];
    if (user.permissions['*']) return [{ module: '*', actions: ['Full access'] }];
    return Object.entries(user.permissions).map(([mod, actions]) => ({ module: mod, actions }));
  })();

  return (
    <div style={{ maxWidth: '860px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '600', margin: '0 0 4px', color: 'var(--text-primary)' }}>My Profile</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Manage your personal information and account security</p>
      </div>

      {/* Identity card */}
      <Section title="Account Overview">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-info))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', fontWeight: '700', color: 'white', letterSpacing: '-0.02em' }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
              {user.firstName} {user.lastName}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>{user.email}</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(Array.isArray(user.roles) ? user.roles : []).map((r, i) => (
                <span key={i} className="badge badge-info">
                  {typeof r === 'object' ? r.name : r}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {[
            { label: 'Tenant', value: user.tenantName },
            { label: 'Phone', value: user.phone || '—' },
            { label: 'Tenant ID', value: user.tenantId?.slice(0, 8) + '…' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)',
              padding: '12px 16px', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
            </div>
          ))}
        </div>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Edit profile */}
        <Section title="Edit Profile">
          <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: 'First Name', key: 'firstName', type: 'text', required: true },
              { label: 'Last Name',  key: 'lastName',  type: 'text', required: true },
              { label: 'Phone',      key: 'phone',     type: 'tel',  required: false, placeholder: '+91 98765 43210' },
            ].map(({ label, key, type, required, placeholder }) => (
              <div className="form-group" key={key}>
                <label className="form-label">{label}</label>
                <input className="form-input" type={type} required={required} placeholder={placeholder}
                  value={editForm[key]}
                  onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
            <Alert type={editMsg?.type} msg={editMsg?.text} />
            <button type="submit" className="btn btn-primary" disabled={editLoading} style={{ marginTop: '4px' }}>
              {editLoading ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </Section>

        {/* Change password */}
        <Section title="Change Password">
          <form onSubmit={handlePwChange} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: 'Current Password', key: 'currentPassword' },
              { label: 'New Password',     key: 'newPassword' },
              { label: 'Confirm Password', key: 'confirmPassword' },
            ].map(({ label, key }) => (
              <div className="form-group" key={key}>
                <label className="form-label">{label}</label>
                <input className="form-input" type="password" required
                  autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'}
                  placeholder={key === 'newPassword' ? 'Min 8 chars, A-Z a-z 0-9 @$!' : ''}
                  value={pwForm[key]}
                  onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
            <Alert type={pwMsg?.type} msg={pwMsg?.text} />
            <button type="submit" className="btn btn-primary" disabled={pwLoading} style={{ marginTop: '4px' }}>
              {pwLoading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </Section>
      </div>

      {/* Permissions matrix */}
      {permsSummary.length > 0 && (
        <Section title="Your Permissions">
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Effective permissions across all assigned roles.
          </p>
          {permsSummary[0]?.module === '*' ? (
            <span className="badge badge-solar" style={{ fontSize: '13px', padding: '4px 12px' }}>
              ⭐ Super Admin — full system access
            </span>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
              {MODULES.map(mod => {
                const entry = permsSummary.find(p => p.module === mod);
                if (!entry) return (
                  <div key={mod} style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
                    opacity: 0.4 }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase',
                      letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '4px' }}>{mod}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No access</div>
                  </div>
                );
                const isFull = entry.actions.includes('*');
                return (
                  <div key={mod} style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)',
                    background: 'var(--color-primary-light)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase',
                      letterSpacing: '0.04em', color: 'var(--color-primary)', marginBottom: '4px' }}>{mod}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {isFull ? '★ all actions' : entry.actions.join(' · ')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
