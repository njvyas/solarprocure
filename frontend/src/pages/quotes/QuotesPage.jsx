import React, { useState, useEffect, useCallback } from 'react';
import { quotesAPI, apiCall} from '../utils/api';
import { useAuth } from '../../contexts/AuthContext';


const ST_C={submitted:{bg:'var(--color-background-info)',c:'var(--color-text-info)'},shortlisted:{bg:'var(--color-background-success)',c:'var(--color-text-success)'},rejected:{bg:'var(--color-background-danger)',c:'var(--color-text-danger)'},awarded:{bg:'var(--color-background-success)',c:'var(--color-text-success)'},withdrawn:{bg:'var(--color-background-secondary)',c:'var(--color-text-secondary)'},draft:{bg:'var(--color-background-secondary)',c:'var(--color-text-secondary)'},revised:{bg:'var(--color-background-warning)',c:'var(--color-text-warning)'}};

export default function QuotesPage() {
  const { can } = useAuth();
  const [quotes,setQuotes]=useState([]); const [total,setTotal]=useState(0);
  const [page,setPage]=useState(1); const [sf,setSf]=useState(''); const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    setLoading(true);
    const params=new URLSearchParams({page,limit:25}); if(sf) params.set('status',sf);
    const r=await apiCall(`/quotes?${params}`);
    setQuotes(r.data||[]); setTotal(r.meta?.pagination?.total||0); setLoading(false);
  },[page,sf]);

  useEffect(()=>{load();},[load]);

  if(!can('quotes','read')) return <p style={{color:'var(--color-text-danger)'}}>Access denied</p>;

  return (
    <div>
      <div style={{marginBottom:'1.5rem'}}>
        <h1 style={{fontSize:'22px',fontWeight:500,margin:'0 0 4px'}}>Quotes</h1>
        <p style={{color:'var(--color-text-secondary)',fontSize:'14px',margin:0}}>{total} total</p>
      </div>
      <div style={{marginBottom:'1rem',display:'flex',gap:'8px',flexWrap:'wrap'}}>
        {['','submitted','shortlisted','rejected','awarded','withdrawn'].map(s=>(
          <button key={s||'all'} onClick={()=>{setSf(s);setPage(1);}} style={{padding:'6px 12px',fontSize:'13px',borderRadius:'var(--border-radius-md)',border:`0.5px solid ${sf===s?'var(--color-border-secondary)':'var(--color-border-tertiary)'}`,background:sf===s?'var(--color-background-secondary)':'transparent',color:sf===s?'var(--color-text-primary)':'var(--color-text-secondary)',cursor:'pointer',textTransform:'capitalize'}}>{s||'All'}</button>
        ))}
      </div>
      <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'14px',tableLayout:'fixed'}}>
          <thead><tr style={{background:'var(--color-background-secondary)'}}>
            {['RFQ','Vendor','Quote #','Total','Submitted','Status'].map(h=>(<th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>{h}</th>))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={6} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)'}}>Loading...</td></tr>
            :quotes.length===0?<tr><td colSpan={6} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)'}}>No quotes found</td></tr>
            :quotes.map(q=>{const s=ST_C[q.status]||ST_C.draft; return(
              <tr key={q.id} style={{borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                <td style={{padding:'10px 14px',fontSize:'13px',color:'var(--color-text-secondary)'}}>{q.rfq_number}</td>
                <td style={{padding:'10px 14px',fontWeight:500}}>{q.vendor_name}</td>
                <td style={{padding:'10px 14px',fontFamily:'monospace',fontSize:'12px'}}>{q.quote_number||'—'}</td>
                <td style={{padding:'10px 14px'}}>₹{parseFloat(q.total_amount||0).toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                <td style={{padding:'10px 14px',fontSize:'13px',color:'var(--color-text-secondary)'}}>{q.submitted_at?new Date(q.submitted_at).toLocaleDateString():'—'}</td>
                <td style={{padding:'10px 14px'}}><span style={{background:s.bg,color:s.c,fontSize:'12px',padding:'2px 8px',borderRadius:'var(--border-radius-md)'}}>{q.status}</span></td>
              </tr>);})}
          </tbody>
        </table>
      </div>
    </div>
  );
}
