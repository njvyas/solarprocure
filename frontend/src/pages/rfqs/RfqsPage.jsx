import React, { useState, useEffect, useCallback } from 'react';
import { rfqsAPI, apiCall} from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ST_C = {draft:{bg:'var(--color-background-secondary)',c:'var(--color-text-secondary)'},sent:{bg:'var(--color-background-info)',c:'var(--color-text-info)'},open:{bg:'var(--color-background-success)',c:'var(--color-text-success)'},closed:{bg:'var(--color-background-warning)',c:'var(--color-text-warning)'},cancelled:{bg:'var(--color-background-danger)',c:'var(--color-text-danger)'},awarded:{bg:'var(--color-background-success)',c:'var(--color-text-success)'}};

export default function RfqsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [rfqs,setRfqs]=useState([]); const [stats,setStats]=useState({}); const [total,setTotal]=useState(0);
  const [page,setPage]=useState(1); const [sf,setSf]=useState(''); const [loading,setLoading]=useState(true);
  const [creating,setCreating]=useState(false);
  const [form,setForm]=useState({title:'',projectName:'',validityDays:30,submissionDeadline:'',deliveryLocation:''});

  const load = useCallback(async()=>{
    setLoading(true);
    const params=new URLSearchParams({page,limit:20}); if(sf) params.set('status',sf);
    const [r,s]=await Promise.all([apiCall(`/rfqs?${params}`),f('/rfqs/stats')]);
    setRfqs(r.data||[]); setTotal(r.meta?.pagination?.total||0); setStats(s.data||{}); setLoading(false);
  },[page,sf]);

  useEffect(()=>{load();},[load]);

  const create = async()=>{ const res=await apiCall('/rfqs',{method:'POST',body:JSON.stringify(form)}); if(res.success) navigate(`/rfqs/${res.data.id}`); };

  if (!can('rfqs','read')) return <p style={{color:'var(--color-text-danger)'}}>Access denied</p>;
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem'}}>
        <div><h1 style={{fontSize:'22px',fontWeight:500,margin:'0 0 4px'}}>RFQs</h1><p style={{color:'var(--color-text-secondary)',fontSize:'14px',margin:0}}>{total} total</p></div>
        {can('rfqs','create')&&<button onClick={()=>setCreating(true)}>+ New RFQ</button>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:'8px',marginBottom:'1.5rem'}}>
        {['draft','sent','open','closed','cancelled','awarded'].map(s=>(
          <div key={s} onClick={()=>{setSf(p=>p===s?'':s);setPage(1);}} style={{background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',padding:'0.75rem',cursor:'pointer',border:`0.5px solid ${sf===s?'var(--color-border-secondary)':'transparent'}`,textAlign:'center'}}>
            <p style={{fontSize:'11px',color:'var(--color-text-secondary)',margin:'0 0 4px',textTransform:'capitalize'}}>{s}</p>
            <p style={{fontSize:'20px',fontWeight:500,margin:0}}>{stats[s]||0}</p>
          </div>
        ))}
      </div>
      <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'14px',tableLayout:'fixed'}}>
          <thead><tr style={{background:'var(--color-background-secondary)'}}>
            {['RFQ #','Title','Vendors','Items','Deadline','Status'].map(h=>(<th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>{h}</th>))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={6} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)'}}>Loading...</td></tr>
            :rfqs.map(r=>{const s=ST_C[r.status]||ST_C.draft; return(
              <tr key={r.id} style={{borderBottom:'0.5px solid var(--color-border-tertiary)',cursor:'pointer'}} onClick={()=>navigate(`/rfqs/${r.id}`)}>
                <td style={{padding:'10px 14px',fontFamily:'monospace',fontSize:'12px'}}>{r.rfq_number}</td>
                <td style={{padding:'10px 14px',fontWeight:500}}>{r.title}</td>
                <td style={{padding:'10px 14px'}}>{r.vendor_count||0}</td>
                <td style={{padding:'10px 14px'}}>{r.item_count||0}</td>
                <td style={{padding:'10px 14px',fontSize:'13px',color:'var(--color-text-secondary)'}}>{r.submission_deadline?new Date(r.submission_deadline).toLocaleDateString():'—'}</td>
                <td style={{padding:'10px 14px'}}><span style={{background:s.bg,color:s.c,fontSize:'12px',padding:'2px 8px',borderRadius:'var(--border-radius-md)'}}>{r.status}</span></td>
              </tr>);
            })}
          </tbody>
        </table>
      </div>
      {creating&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1.5rem',width:480}}>
            <h3 style={{fontSize:'16px',fontWeight:500,margin:'0 0 1rem'}}>New RFQ</h3>
            {[['title','Title *','text'],['projectName','Project','text'],['deliveryLocation','Delivery location','text'],['validityDays','Validity days','number'],['submissionDeadline','Deadline','datetime-local']].map(([k,l,t])=>(
              <div key={k} style={{marginBottom:'0.75rem'}}>
                <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>{l}</label>
                <input value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} type={t} style={{width:'100%',boxSizing:'border-box'}} />
              </div>
            ))}
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'1rem'}}>
              <button onClick={()=>setCreating(false)}>Cancel</button>
              <button onClick={create} disabled={!form.title} style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer',opacity:!form.title?0.5:1}}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
