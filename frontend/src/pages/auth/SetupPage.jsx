import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setupAPI } from '../../utils/api';

export default function SetupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: '', email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [done, setDone]       = useState(null);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.'); return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.'); return;
    }
    setLoading(true);
    try {
      const { data } = await setupAPI.initialize({
        companyName: form.companyName,
        email:       form.email,
        password:    form.password,
        firstName:   form.firstName,
        lastName:    form.lastName,
      });
      setDone(data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────
  if (done) {
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign:'center', marginBottom:'24px' }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>✅</div>
            <h1 style={{ fontSize:'22px', fontWeight:'700', color:'var(--text-primary)', margin:'0 0 8px' }}>
              Setup Complete!
            </h1>
            <p style={{ fontSize:'14px', color:'var(--text-muted)', margin:0 }}>
              Your SolarProcure instance is ready.
            </p>
          </div>
          <div style={{ background:'var(--color-bg-elevated)', borderRadius:'var(--radius-md)',
            border:'1px solid var(--color-border)', padding:'16px', marginBottom:'24px' }}>
            <div style={{ fontSize:'12px', fontWeight:'600', color:'var(--text-muted)',
              textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'12px' }}>Login Credentials</div>
            {[
              ['Organisation Slug', done.tenantSlug],
              ['Email',            done.email],
              ['Password',         '(as entered)'],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ display:'flex', justifyContent:'space-between',
                padding:'6px 0', borderBottom:'1px solid var(--color-border)', fontSize:'13px' }}>
                <span style={{ color:'var(--text-muted)' }}>{lbl}</span>
                <span style={{ fontFamily:'var(--font-mono)', color:'var(--text-primary)', fontWeight:'500' }}>{val}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ width:'100%' }}
            onClick={() => navigate('/login')}>
            Go to Login →
          </button>
        </div>
      </div>
    );
  }

  // ── Setup form ────────────────────────────────────────────────
  return (
    <div style={outerStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign:'center', marginBottom:'28px' }}>
          <div style={{ fontSize:'36px', marginBottom:'10px' }}>☀️</div>
          <h1 style={{ fontSize:'24px', fontWeight:'700', color:'var(--text-primary)', margin:'0 0 6px', letterSpacing:'-0.03em' }}>
            Welcome to SolarProcure
          </h1>
          <p style={{ fontSize:'13px', color:'var(--text-muted)', margin:0 }}>
            Set up your account to get started. This only runs once.
          </p>
        </div>

        {error && (
          <div style={{ padding:'10px 14px', borderRadius:'var(--radius-md)', fontSize:'13px',
            background:'var(--color-danger-light)', color:'var(--color-danger)',
            border:'1px solid rgba(239,68,68,0.3)', marginBottom:'16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'0' }}>
          {/* Company */}
          <div style={{ fontSize:'11px', fontWeight:'700', color:'var(--text-muted)',
            textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 12px' }}>Company</div>
          <div className="form-group" style={{ marginBottom:'14px' }}>
            <label className="form-label">Company Name</label>
            <input className="form-input" value={form.companyName} onChange={set('companyName')}
              placeholder="Alendei Green RE Pvt Ltd" required />
            <span style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'3px', display:'block' }}>
              Used as your organisation slug for login (e.g. alendei-green-re)
            </span>
          </div>

          {/* Admin */}
          <div style={{ fontSize:'11px', fontWeight:'700', color:'var(--text-muted)',
            textTransform:'uppercase', letterSpacing:'0.08em', margin:'14px 0 12px' }}>Administrator Account</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'14px' }}>
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input className="form-input" value={form.firstName} onChange={set('firstName')} required placeholder="First" />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input className="form-input" value={form.lastName} onChange={set('lastName')} required placeholder="Last" />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom:'14px' }}>
            <label className="form-label">Email Address</label>
            <input className="form-input" type="email" value={form.email} onChange={set('email')}
              required placeholder="admin@yourcompany.com" />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'24px' }}>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={form.password} onChange={set('password')}
                required minLength={8} placeholder="Min 8 characters" autoComplete="new-password" />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input className="form-input" type="password" value={form.confirmPassword} onChange={set('confirmPassword')}
                required placeholder="Repeat password" autoComplete="new-password" />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width:'100%', padding:'12px' }} disabled={loading}>
            {loading ? 'Setting up…' : 'Create Account & Launch'}
          </button>
        </form>

        <p style={{ fontSize:'11px', color:'var(--text-muted)', textAlign:'center', marginTop:'16px', lineHeight:1.5 }}>
          This page is only shown on a fresh install. Once complete, it will not appear again.
        </p>
      </div>
    </div>
  );
}

const outerStyle = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--color-bg)', padding: '24px',
};
const cardStyle = {
  width: '100%', maxWidth: '480px',
  background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-xl)', padding: '36px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};
