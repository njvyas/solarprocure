import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { setupAPI } from '../../utils/api';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', tenantSlug: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // On mount: if system not yet initialized, redirect to setup wizard
  useEffect(() => {
    setupAPI.status().then(({ data }) => {
      if (!data?.data?.initialized) navigate('/setup', { replace: true });
    }).catch(() => {}); // silently ignore — API may not be up yet
  }, []);

  const handleChange = (e) => { setForm((p) => ({ ...p, [e.target.name]: e.target.value })); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try { await login(form.email, form.password, form.tenantSlug); navigate('/dashboard'); }
    catch (err) { setError(err.response?.data?.error || 'Login failed. Please check your credentials.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--color-background-tertiary)' }}>
      <div style={{ width:'100%', maxWidth:'420px', margin:'0 auto', padding:'0 1rem' }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:48, height:48, borderRadius:'12px', background:'var(--color-background-info)', marginBottom:'1rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-info)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <h1 style={{ fontSize:'22px', fontWeight:500, margin:0 }}>eProcurement</h1>
          <p style={{ color:'var(--color-text-secondary)', fontSize:'14px', marginTop:'4px' }}>Solar EPC Procurement Platform</p>
        </div>

        <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', padding:'2rem' }}>
          <h2 style={{ fontSize:'18px', fontWeight:500, marginBottom:'1.5rem' }}>Sign in to your account</h2>

          {error && (
            <div style={{ padding:'12px', marginBottom:'1rem', background:'var(--color-background-danger)', border:'0.5px solid var(--color-border-danger)', borderRadius:'var(--border-radius-md)', color:'var(--color-text-danger)', fontSize:'14px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {[
              { name:'tenantSlug', label:'Organisation ID', type:'text', placeholder:'alendei-green' },
              { name:'email', label:'Email address', type:'email', placeholder:'admin@alendei-green.com' },
              { name:'password', label:'Password', type:'password', placeholder:'••••••••' },
            ].map(({ name, label, type, placeholder }) => (
              <div key={name} style={{ marginBottom:'1rem' }}>
                <label style={{ display:'block', fontSize:'14px', color:'var(--color-text-secondary)', marginBottom:'6px' }}>{label}</label>
                <input name={name} type={type} placeholder={placeholder} value={form[name]} onChange={handleChange} required style={{ width:'100%', boxSizing:'border-box' }} />
              </div>
            ))}

            <button type="submit" disabled={loading || !form.email || !form.password || !form.tenantSlug}
              style={{ width:'100%', padding:'10px', background:'var(--color-text-primary)', color:'var(--color-background-primary)', border:'none', borderRadius:'var(--border-radius-md)', fontSize:'14px', fontWeight:500, cursor:'pointer', marginTop:'0.5rem', opacity:(loading||!form.email||!form.password||!form.tenantSlug)?0.6:1 }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <div style={{ marginTop:'1.5rem', padding:'1rem', background:'var(--color-background-secondary)', borderRadius:'var(--border-radius-md)', fontSize:'13px', color:'var(--color-text-secondary)' }}>
          <p style={{ fontWeight:500, marginBottom:'8px', color:'var(--color-text-primary)' }}>Demo credentials</p>
          <p style={{ margin:'2px 0' }}>Org: <code>alendei-green</code></p>
          <p style={{ margin:'2px 0' }}>Email: <code>admin@alendei-green.com</code></p>
          <p style={{ margin:'2px 0' }}>Password: <code>Admin@1234</code></p>
        </div>
      </div>
    </div>
  );
}
