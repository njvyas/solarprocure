import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../utils/api';
import { useAuth } from '../../contexts/AuthContext';

const fmtINR=n=>n?`₹${parseFloat(n).toLocaleString('en-IN',{maximumFractionDigits:0})}`:'—';
const fmt=n=>n!=null?parseFloat(n).toLocaleString('en-IN',{maximumFractionDigits:0}):'0';

function StatCard({label,value,sub,color}) {
  return (
    <div style={{background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',padding:'1rem'}}>
      <p style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:'0 0 6px'}}>{label}</p>
      <p style={{fontSize:'24px',fontWeight:500,margin:'0 0 2px',color:color||'var(--color-text-primary)'}}>{value}</p>
      {sub&&<p style={{fontSize:'12px',color:'var(--color-text-tertiary)',margin:0}}>{sub}</p>}
    </div>
  );
}

export default function ReportsDashboard() {
  const { can }=useAuth();
  const [tab,setTab]=useState('overview');
  const [data,setData]=useState({});
  const [vendorData,setVendorData]=useState(null);
  const [rfqData,setRfqData]=useState(null);
  const [spendData,setSpendData]=useState(null);
  const [auditData,setAuditData]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!can('reports','read')) return;
    setLoading(true);
    f('/reports/dashboard').then(r=>{ setData(r.data||{}); setLoading(false); });
  },[]);

  const loadTab=async(t)=>{
    setTab(t);
    if(t==='vendors'&&!vendorData)   f('/reports/vendors').then(r=>setVendorData(r.data));
    if(t==='rfqs'&&!rfqData)         f('/reports/rfqs').then(r=>setRfqData(r.data));
    if(t==='spend'&&!spendData)      f('/reports/spend').then(r=>setSpendData(r.data));
    if(t==='audit'&&!auditData)      f('/reports/audit-summary').then(r=>setAuditData(r.data));
  };

  if(!can('reports','read')) return <p style={{color:'var(--color-text-danger)'}}>Access denied</p>;
  if(loading) return <p style={{padding:'2rem',color:'var(--color-text-secondary)'}}>Loading...</p>;

  const kpis=data.kpis||{};

  return (
    <div>
      <div style={{marginBottom:'1.5rem'}}>
        <h1 style={{fontSize:'22px',fontWeight:500,margin:'0 0 4px'}}>Reports & Analytics</h1>
        <p style={{color:'var(--color-text-secondary)',fontSize:'14px',margin:0}}>Procurement intelligence dashboard</p>
      </div>

      <div style={{display:'flex',gap:'4px',marginBottom:'1.5rem',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
        {['overview','vendors','rfqs','spend','audit'].map(t=>(
          <button key={t} onClick={()=>loadTab(t)} style={{padding:'8px 16px',background:'none',border:'none',borderBottom:`2px solid ${tab===t?'var(--color-text-primary)':'transparent'}`,color:tab===t?'var(--color-text-primary)':'var(--color-text-secondary)',cursor:'pointer',fontSize:'14px',textTransform:'capitalize'}}>{t}</button>
        ))}
      </div>

      {tab==='overview'&&(
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'2rem'}}>
            <StatCard label="Total vendors"  value={fmt(kpis.total_vendors)}   sub={`${fmt(kpis.approved_vendors)} approved`} />
            <StatCard label="Total RFQs"     value={fmt(kpis.total_rfqs)}      sub={`${fmt(kpis.awarded_rfqs)} awarded`} />
            <StatCard label="Total quotes"   value={fmt(kpis.total_quotes)} />
            <StatCard label="PO value"       value={fmtINR(kpis.total_po_value)} sub={`${fmt(kpis.total_pos)} POs`} color="var(--color-text-success)" />
          </div>
          {data.spendByVendor?.length>0&&(
            <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1.5rem',marginBottom:'1.5rem'}}>
              <h2 style={{fontSize:'16px',fontWeight:500,marginBottom:'1rem'}}>Top vendors by spend (30 days)</h2>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
                <thead><tr style={{background:'var(--color-background-secondary)'}}>
                  {['Vendor','POs','Total spend'].map(h=>(<th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>{h}</th>))}
                </tr></thead>
                <tbody>{data.spendByVendor.map((v,i)=>(
                  <tr key={i} style={{borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                    <td style={{padding:'8px 12px'}}>{v.company_name}</td>
                    <td style={{padding:'8px 12px'}}>{v.po_count}</td>
                    <td style={{padding:'8px 12px',fontWeight:500}}>{fmtINR(v.total_spend)}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab==='vendors'&&vendorData&&(
        <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px',minWidth:800}}>
            <thead><tr style={{background:'var(--color-background-secondary)'}}>
              {['Vendor','Status','Quotes','Awards','Awarded value','POs','Avg performance'].map(h=>(<th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>{h}</th>))}
            </tr></thead>
            <tbody>{(vendorData.vendors||[]).map(v=>(
              <tr key={v.id} style={{borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                <td style={{padding:'10px 12px',fontWeight:500}}>{v.company_name}</td>
                <td style={{padding:'10px 12px',fontSize:'12px',textTransform:'capitalize',color:v.status==='approved'?'var(--color-text-success)':'var(--color-text-secondary)'}}>{v.status}</td>
                <td style={{padding:'10px 12px'}}>{v.quote_count||0}</td>
                <td style={{padding:'10px 12px'}}>{v.awards||0}</td>
                <td style={{padding:'10px 12px'}}>{fmtINR(v.awarded_value)}</td>
                <td style={{padding:'10px 12px'}}>{v.po_count||0}</td>
                <td style={{padding:'10px 12px'}}>{v.avg_performance?parseFloat(v.avg_performance).toFixed(1):'—'}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}

      {tab==='rfqs'&&rfqData&&(
        <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px',minWidth:900}}>
            <thead><tr style={{background:'var(--color-background-secondary)'}}>
              {['RFQ #','Title','Status','Vendors','Quotes','L1 Price','H1 Price','Savings %'].map(h=>(<th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>{h}</th>))}
            </tr></thead>
            <tbody>{(rfqData.rfqs||[]).map(r=>{
              const savings=r.h1_price&&r.l1_price?((r.h1_price-r.l1_price)/r.h1_price*100).toFixed(1):null;
              return(<tr key={r.id} style={{borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                <td style={{padding:'10px 12px',fontFamily:'monospace',fontSize:'12px'}}>{r.rfq_number}</td>
                <td style={{padding:'10px 12px'}}>{r.title}</td>
                <td style={{padding:'10px 12px',textTransform:'capitalize',fontSize:'12px'}}>{r.status}</td>
                <td style={{padding:'10px 12px'}}>{r.vendor_count||0}</td>
                <td style={{padding:'10px 12px'}}>{r.quote_count||0}</td>
                <td style={{padding:'10px 12px'}}>{fmtINR(r.l1_price)}</td>
                <td style={{padding:'10px 12px'}}>{fmtINR(r.h1_price)}</td>
                <td style={{padding:'10px 12px',color:savings>0?'var(--color-text-success)':'var(--color-text-secondary)'}}>{savings?`${savings}%`:'—'}</td>
              </tr>);})}</tbody>
          </table>
        </div>
      )}

      {tab==='spend'&&spendData&&(
        <div>
          <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1.5rem',marginBottom:'1rem'}}>
            <h2 style={{fontSize:'16px',fontWeight:500,marginBottom:'1rem'}}>PO status summary</h2>
            <div style={{display:'flex',flexWrap:'wrap',gap:'12px'}}>
              {(spendData.byStatus||[]).map(s=>(
                <div key={s.status} style={{background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',padding:'0.75rem 1rem',minWidth:120}}>
                  <p style={{fontSize:'12px',color:'var(--color-text-secondary)',margin:'0 0 4px',textTransform:'capitalize'}}>{s.status.replace('_',' ')}</p>
                  <p style={{fontSize:'18px',fontWeight:500,margin:'0 0 2px'}}>{s.count}</p>
                  <p style={{fontSize:'12px',color:'var(--color-text-tertiary)',margin:0}}>{fmtINR(s.value)}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
              <thead><tr style={{background:'var(--color-background-secondary)'}}>
                {['Vendor','POs','Total spend'].map(h=>(<th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>{h}</th>))}
              </tr></thead>
              <tbody>{(spendData.byVendor||[]).map((v,i)=>(
                <tr key={i} style={{borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                  <td style={{padding:'10px 12px'}}>{v.company_name}</td>
                  <td style={{padding:'10px 12px'}}>{v.pos}</td>
                  <td style={{padding:'10px 12px',fontWeight:500}}>{fmtINR(v.spend)}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab==='audit'&&auditData&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
          <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1.5rem'}}>
            <h2 style={{fontSize:'14px',fontWeight:500,marginBottom:'1rem'}}>Top actions (30 days)</h2>
            {(auditData.byAction||[]).slice(0,10).map(a=>(
              <div key={a.action} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:'13px',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                <code style={{fontSize:'12px'}}>{a.action}</code>
                <span style={{fontWeight:500}}>{a.count}</span>
              </div>
            ))}
          </div>
          <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1.5rem'}}>
            <h2 style={{fontSize:'14px',fontWeight:500,marginBottom:'1rem'}}>Security events</h2>
            {(auditData.recentCritical||[]).length===0
              ?<p style={{color:'var(--color-text-secondary)',fontSize:'14px'}}>No failures or unauthorized events.</p>
              :(auditData.recentCritical||[]).map(e=>(
                <div key={e.created_at} style={{padding:'6px 0',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px'}}>
                    <code style={{fontSize:'12px',color:'var(--color-text-danger)'}}>{e.action}</code>
                    <span style={{fontSize:'12px',color:'var(--color-text-secondary)'}}>{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                  <p style={{fontSize:'12px',color:'var(--color-text-secondary)',margin:'2px 0 0'}}>{e.user_email||'anonymous'} • {e.ip_address||'—'}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
