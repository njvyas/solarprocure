import React, { useState, useEffect } from 'react';
import { vendorsAPI, apiCall} from '../utils/api';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';


export default function VendorDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [vendor, setVendor] = useState(null);
  const [compliance, setCompliance] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [addCert, setAddCert] = useState(false);
  const [certForm, setCertForm] = useState({ certName:'', certNumber:'', issuedBy:'', issuedDate:'', expiryDate:'' });

  const load = async () => {
    setLoading(true);
    const [v,c,p] = await Promise.all([
      apiCall(`/vendors/${id}`),
      apiCall(`/vendors/${id}/compliance`),
      apiCall(`/vendors/${id}/performance`),
    ]);
    setVendor(v.data); setCompliance(c.data||[]); setPerformance(p.data||[]);
    setLoading(false);
  };
  useEffect(()=>{load();},[id]);

  const saveCert = async () => {
    await apiCall(`/vendors/${id}/compliance`,{method:'POST',body:JSON.stringify(certForm)});
    setAddCert(false); setCertForm({certName:'',certNumber:'',issuedBy:'',issuedDate:'',expiryDate:''});
    load();
  };

  if (loading) return <div style={{padding:'2rem',color:'var(--color-text-secondary)'}}>Loading...</div>;
  if (!vendor) return <div style={{padding:'2rem',color:'var(--color-text-danger)'}}>Vendor not found</div>;

  const statusColor = {approved:'var(--color-text-success)',pending:'var(--color-text-warning)',rejected:'var(--color-text-danger)',changes_requested:'var(--color-text-info)'};
  const certStatusColor = {valid:'var(--color-text-success)',expiring_soon:'var(--color-text-warning)',expired:'var(--color-text-danger)',pending:'var(--color-text-secondary)'};

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1.5rem'}}>
        <div>
          <Link to="/vendors" style={{fontSize:'13px',color:'var(--color-text-secondary)',textDecoration:'none'}}>← Vendors</Link>
          <h1 style={{fontSize:'22px',fontWeight:500,margin:'4px 0'}}>{vendor.company_name}</h1>
          <span style={{fontSize:'13px',color:statusColor[vendor.status]||'var(--color-text-secondary)'}}>{vendor.status.replace('_',' ')}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:'4px',marginBottom:'1.5rem',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
        {['overview','compliance','performance'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'8px 16px',background:'none',border:'none',borderBottom:`2px solid ${tab===t?'var(--color-text-primary)':'transparent'}`,color:tab===t?'var(--color-text-primary)':'var(--color-text-secondary)',cursor:'pointer',fontSize:'14px',textTransform:'capitalize'}}>
            {t}
          </button>
        ))}
      </div>

      {tab==='overview' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
          <Card title="Contact"><InfoRow label="Name" val={vendor.contact_name}/><InfoRow label="Email" val={vendor.contact_email}/><InfoRow label="Phone" val={vendor.contact_phone}/></Card>
          <Card title="Registration"><InfoRow label="GST" val={vendor.gst_number}/><InfoRow label="PAN" val={vendor.pan_number}/><InfoRow label="Website" val={vendor.website}/></Card>
          <Card title="Categories">{(vendor.product_categories||[]).map(c=><span key={c} style={{display:'inline-block',margin:'2px',padding:'3px 8px',background:'var(--color-background-info)',color:'var(--color-text-info)',borderRadius:'var(--border-radius-md)',fontSize:'12px'}}>{c}</span>)}</Card>
          <Card title="Certifications">{(vendor.certifications||[]).map(c=><span key={c} style={{display:'inline-block',margin:'2px',padding:'3px 8px',background:'var(--color-background-success)',color:'var(--color-text-success)',borderRadius:'var(--border-radius-md)',fontSize:'12px'}}>{c}</span>)}</Card>
        </div>
      )}

      {tab==='compliance' && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'1rem'}}>
            <h2 style={{fontSize:'16px',fontWeight:500,margin:0}}>Compliance records ({compliance.length})</h2>
            {can('vendors','update') && <button onClick={()=>setAddCert(true)}>+ Add certificate</button>}
          </div>
          {compliance.length===0 ? <p style={{color:'var(--color-text-secondary)'}}>No compliance records</p> : (
            <div style={{display:'grid',gap:'8px'}}>
              {compliance.map(c=>(
                <div key={c.id} style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-md)',padding:'1rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <p style={{fontWeight:500,margin:'0 0 2px'}}>{c.cert_name}</p>
                    <p style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:0}}>{c.cert_number} • {c.issued_by}</p>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <span style={{fontSize:'12px',color:certStatusColor[c.status]||'var(--color-text-secondary)'}}>{c.status.replace('_',' ')}</span>
                    {c.expiry_date && <p style={{fontSize:'12px',color:'var(--color-text-tertiary)',margin:'2px 0 0'}}>Expires {new Date(c.expiry_date).toLocaleDateString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {addCert && (
            <div style={{marginTop:'1rem',background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1.5rem'}}>
              <h3 style={{fontSize:'14px',fontWeight:500,margin:'0 0 1rem'}}>Add certificate</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
                {[['certName','Certificate name'],['certNumber','Cert number'],['issuedBy','Issued by'],['issuedDate','Issue date'],['expiryDate','Expiry date']].map(([k,l])=>(
                  <div key={k}>
                    <label style={{display:'block',fontSize:'12px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>{l}</label>
                    <input value={certForm[k]} onChange={e=>setCertForm(p=>({...p,[k]:e.target.value}))} type={k.includes('Date')?'date':'text'} style={{width:'100%',boxSizing:'border-box'}} />
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={saveCert} disabled={!certForm.certName} style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer'}}>Save</button>
                <button onClick={()=>setAddCert(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab==='performance' && (
        <div>
          <h2 style={{fontSize:'16px',fontWeight:500,marginBottom:'1rem'}}>Performance history</h2>
          {performance.length===0 ? <p style={{color:'var(--color-text-secondary)'}}>No performance records</p> : (
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'14px'}}>
              <thead><tr style={{background:'var(--color-background-secondary)'}}>
                {['Period','On-time %','Quality','Price','Responsiveness','Overall'].map(h=>(
                  <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{performance.map(p=>(
                <tr key={p.id} style={{borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                  <td style={{padding:'10px 14px'}}>{p.period_year} Q{p.period_quarter||'—'}</td>
                  <td style={{padding:'10px 14px'}}>{p.on_time_delivery_pct||'—'}</td>
                  <td style={{padding:'10px 14px'}}>{p.quality_score||'—'}</td>
                  <td style={{padding:'10px 14px'}}>{p.price_competitiveness||'—'}</td>
                  <td style={{padding:'10px 14px'}}>{p.responsiveness_score||'—'}</td>
                  <td style={{padding:'10px 14px',fontWeight:500}}>{p.overall_score||'—'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function Card({title,children}){return <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1rem'}}><h3 style={{fontSize:'13px',fontWeight:500,color:'var(--color-text-secondary)',margin:'0 0 0.75rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>{title}</h3>{children}</div>;}
function InfoRow({label,val}){return <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:'14px'}}><span style={{color:'var(--color-text-secondary)'}}>{label}</span><span>{val||'—'}</span></div>;}
