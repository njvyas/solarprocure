import React, { useState } from 'react';

const CATEGORIES = ['Solar Panels','Inverters','Structure','Cables','BOS','Batteries','Transformers','Switchgear','Civil Works','Other'];
const CERTS = ['IEC 61215','IEC 61730','ISO 9001','ISO 14001','BIS','ALMM','IEC 62109','Other'];
const DOC_TYPES = [
  { key:'gst_certificate', label:'GST Certificate' },
  { key:'pan_card', label:'PAN Card' },
  { key:'iec_certificate', label:'IEC Certificate' },
  { key:'cancelled_cheque', label:'Cancelled Cheque' },
  { key:'incorporation_cert', label:'Incorporation Certificate' },
];

export default function VendorRegisterPage() {
  const [form, setForm] = useState({ tenantSlug:'', companyName:'', contactName:'', contactEmail:'', contactPhone:'', gstNumber:'', panNumber:'', website:'', productCategories:[], certifications:[] });
  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const toggleArr = (field, val) => setForm(p => ({ ...p, [field]: p[field].includes(val) ? p[field].filter(x=>x!==val) : [...p[field], val] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k,v]) => fd.append(k, Array.isArray(v) ? v.join(',') : v));
      Object.entries(files).forEach(([docType, file]) => { if (file) fd.append(`doc_${docType}`, file); });
      const res = await fetch('/api/vendors/register', { method:'POST', body:fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setResult(data.data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  if (result) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--color-background-tertiary)' }}>
      <div style={{ maxWidth:480, width:'100%', padding:'0 1rem' }}>
        <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', padding:'2rem', textAlign:'center' }}>
          <div style={{ width:48, height:48, borderRadius:'50%', background:'var(--color-background-success)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem', fontSize:22 }}>✓</div>
          <h2 style={{ fontSize:'18px', fontWeight:500, marginBottom:'0.5rem' }}>Registration submitted</h2>
          <p style={{ color:'var(--color-text-secondary)', fontSize:'14px', marginBottom:'1rem' }}>{result.message}</p>
          <p style={{ fontSize:'13px', color:'var(--color-text-tertiary)' }}>Reference ID: <code>{result.id}</code></p>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'var(--color-background-tertiary)', padding:'2rem 1rem' }}>
      <div style={{ maxWidth:640, margin:'0 auto' }}>
        <div style={{ marginBottom:'1.5rem' }}>
          <h1 style={{ fontSize:'22px', fontWeight:500, margin:'0 0 4px' }}>Vendor Registration</h1>
          <p style={{ color:'var(--color-text-secondary)', fontSize:'14px', margin:0 }}>Submit your details for approval. You'll be able to participate in RFQs once approved.</p>
        </div>

        {error && <div style={{ padding:'12px', marginBottom:'1rem', background:'var(--color-background-danger)', border:'0.5px solid var(--color-border-danger)', borderRadius:'var(--border-radius-md)', color:'var(--color-text-danger)', fontSize:'14px' }}>{error}</div>}

        <form onSubmit={handleSubmit} encType="multipart/form-data">
          {/* Company info */}
          <Section title="Company details">
            <Field label="Organisation ID *" help="The procurement org you're registering with">
              <input value={form.tenantSlug} onChange={e=>setForm(p=>({...p,tenantSlug:e.target.value}))} placeholder="alendei-green" required style={{ width:'100%', boxSizing:'border-box' }} />
            </Field>
            <Field label="Company name *">
              <input value={form.companyName} onChange={e=>setForm(p=>({...p,companyName:e.target.value}))} placeholder="Rayzon Solar Pvt Ltd" required style={{ width:'100%', boxSizing:'border-box' }} />
            </Field>
            <Row>
              <Field label="GST number">
                <input value={form.gstNumber} onChange={e=>setForm(p=>({...p,gstNumber:e.target.value.toUpperCase()}))} placeholder="24AABCR1234A1Z5" style={{ width:'100%', boxSizing:'border-box' }} />
              </Field>
              <Field label="PAN number">
                <input value={form.panNumber} onChange={e=>setForm(p=>({...p,panNumber:e.target.value.toUpperCase()}))} placeholder="AABCR1234A" style={{ width:'100%', boxSizing:'border-box' }} />
              </Field>
            </Row>
            <Field label="Website">
              <input value={form.website} onChange={e=>setForm(p=>({...p,website:e.target.value}))} placeholder="https://example.com" type="url" style={{ width:'100%', boxSizing:'border-box' }} />
            </Field>
          </Section>

          {/* Contact */}
          <Section title="Contact person">
            <Row>
              <Field label="Name *">
                <input value={form.contactName} onChange={e=>setForm(p=>({...p,contactName:e.target.value}))} required style={{ width:'100%', boxSizing:'border-box' }} />
              </Field>
              <Field label="Phone">
                <input value={form.contactPhone} onChange={e=>setForm(p=>({...p,contactPhone:e.target.value}))} type="tel" style={{ width:'100%', boxSizing:'border-box' }} />
              </Field>
            </Row>
            <Field label="Email *">
              <input value={form.contactEmail} onChange={e=>setForm(p=>({...p,contactEmail:e.target.value}))} type="email" required style={{ width:'100%', boxSizing:'border-box' }} />
            </Field>
          </Section>

          {/* Categories */}
          <Section title="Product categories *">
            <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
              {CATEGORIES.map(c => (
                <button key={c} type="button" onClick={()=>toggleArr('productCategories',c)}
                  style={{ padding:'6px 12px', fontSize:'13px', borderRadius:'var(--border-radius-md)', border:`0.5px solid ${form.productCategories.includes(c)?'var(--color-border-info)':'var(--color-border-secondary)'}`, background:form.productCategories.includes(c)?'var(--color-background-info)':'transparent', color:form.productCategories.includes(c)?'var(--color-text-info)':'var(--color-text-secondary)', cursor:'pointer' }}>{c}</button>
              ))}
            </div>
          </Section>

          {/* Certifications */}
          <Section title="Certifications">
            <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
              {CERTS.map(c => (
                <button key={c} type="button" onClick={()=>toggleArr('certifications',c)}
                  style={{ padding:'6px 12px', fontSize:'13px', borderRadius:'var(--border-radius-md)', border:`0.5px solid ${form.certifications.includes(c)?'var(--color-border-success)':'var(--color-border-secondary)'}`, background:form.certifications.includes(c)?'var(--color-background-success)':'transparent', color:form.certifications.includes(c)?'var(--color-text-success)':'var(--color-text-secondary)', cursor:'pointer' }}>{c}</button>
              ))}
            </div>
          </Section>

          {/* Documents */}
          <Section title="Documents (PDF, JPG, PNG — max 10MB each)">
            {DOC_TYPES.map(({ key, label }) => (
              <Field key={key} label={label}>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                  onChange={e => setFiles(p=>({...p,[key]:e.target.files[0]||null}))}
                  style={{ width:'100%', boxSizing:'border-box' }} />
                {files[key] && <p style={{ fontSize:'12px', color:'var(--color-text-success)', margin:'4px 0 0' }}>✓ {files[key].name}</p>}
              </Field>
            ))}
          </Section>

          <button type="submit" disabled={loading || !form.companyName || !form.contactEmail || !form.tenantSlug || form.productCategories.length===0}
            style={{ width:'100%', padding:'12px', background:'var(--color-text-primary)', color:'var(--color-background-primary)', border:'none', borderRadius:'var(--border-radius-md)', fontSize:'14px', fontWeight:500, cursor:'pointer', opacity:(loading||!form.companyName||!form.contactEmail||!form.tenantSlug||form.productCategories.length===0)?0.6:1 }}>
            {loading ? 'Submitting...' : 'Submit registration'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', padding:'1.5rem', marginBottom:'1rem' }}>
      <h3 style={{ fontSize:'14px', fontWeight:500, margin:'0 0 1rem', color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, help, children }) {
  return (
    <div style={{ marginBottom:'0.75rem' }}>
      <label style={{ display:'block', fontSize:'13px', color:'var(--color-text-secondary)', marginBottom:'4px' }}>{label}{help && <span style={{ marginLeft:4, color:'var(--color-text-tertiary)' }}>— {help}</span>}</label>
      {children}
    </div>
  );
}

function Row({ children }) {
  return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>{children}</div>;
}
