import React, { useState, useEffect, useCallback } from 'react';
import { evaluationsAPI, apiCall} from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';


export default function EvaluationsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [evals,setEvals]=useState([]); const [total,setTotal]=useState(0);
  const [rfqs,setRfqs]=useState([]); const [loading,setLoading]=useState(true);
  const [creating,setCreating]=useState(false);
  const [form,setForm]=useState({rfqId:'',title:'',evaluationType:'weighted'});
  const [err,setErr]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    const [e,r]=await Promise.all([apiCall('/evaluations'),f('/rfqs?limit=100')]);
    setEvals(e.data||[]); setTotal(e.meta?.pagination?.total||0); setRfqs(r.data||[]); setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  const create=async()=>{
    setErr('');
    const res=await apiCall('/evaluations',{method:'POST',body:JSON.stringify(form)});
    if(!res.success){setErr(res.error);return;}
    setCreating(false); navigate(`/evaluations/${res.data.id}`);
  };

  if(!can('quotes','read')) return <p style={{color:'var(--color-text-danger)'}}>Access denied</p>;
  const ST_C={draft:'var(--color-text-secondary)',in_progress:'var(--color-text-warning)',finalized:'var(--color-text-success)'};

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem'}}>
        <div><h1 style={{fontSize:'22px',fontWeight:500,margin:'0 0 4px'}}>Evaluations</h1><p style={{color:'var(--color-text-secondary)',fontSize:'14px',margin:0}}>{total} total</p></div>
        {can('quotes','evaluate')&&<button onClick={()=>setCreating(true)}>+ New evaluation</button>}
      </div>
      <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'14px',tableLayout:'fixed'}}>
          <thead><tr style={{background:'var(--color-background-secondary)'}}>
            {['Title','RFQ','Type','Status','Created'].map(h=>(<th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>{h}</th>))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={5} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)'}}>Loading...</td></tr>
            :evals.length===0?<tr><td colSpan={5} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)'}}>No evaluations</td></tr>
            :evals.map(e=>(
              <tr key={e.id} style={{borderBottom:'0.5px solid var(--color-border-tertiary)',cursor:'pointer'}} onClick={()=>navigate(`/evaluations/${e.id}`)}>
                <td style={{padding:'10px 14px',fontWeight:500}}>{e.title}</td>
                <td style={{padding:'10px 14px',fontSize:'13px',color:'var(--color-text-secondary)'}}><code>{e.rfq_number}</code></td>
                <td style={{padding:'10px 14px',fontSize:'13px',textTransform:'capitalize'}}>{e.evaluation_type?.replace('_',' ')}</td>
                <td style={{padding:'10px 14px'}}><span style={{fontSize:'12px',color:ST_C[e.status]||'var(--color-text-secondary)',textTransform:'capitalize'}}>{e.status?.replace('_',' ')}</span></td>
                <td style={{padding:'10px 14px',fontSize:'13px',color:'var(--color-text-secondary)'}}>{new Date(e.created_at).toLocaleDateString()}</td>
              </tr>))}
          </tbody>
        </table>
      </div>
      {creating&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1.5rem',width:480}}>
            <h3 style={{fontSize:'16px',fontWeight:500,margin:'0 0 1rem'}}>New evaluation</h3>
            {err&&<p style={{color:'var(--color-text-danger)',fontSize:'13px',margin:'0 0 0.75rem'}}>{err}</p>}
            <div style={{marginBottom:'0.75rem'}}>
              <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>RFQ *</label>
              <select value={form.rfqId} onChange={e=>setForm(p=>({...p,rfqId:e.target.value}))} style={{width:'100%'}}>
                <option value="">Select RFQ...</option>
                {rfqs.map(r=><option key={r.id} value={r.id}>{r.rfq_number} — {r.title}</option>)}
              </select>
            </div>
            <div style={{marginBottom:'0.75rem'}}>
              <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>Title *</label>
              <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} style={{width:'100%',boxSizing:'border-box'}} placeholder="e.g. Technical-Commercial Evaluation Q1 2025" />
            </div>
            <div style={{marginBottom:'1rem'}}>
              <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>Method</label>
              <select value={form.evaluationType} onChange={e=>setForm(p=>({...p,evaluationType:e.target.value}))} style={{width:'100%'}}>
                <option value="weighted">Weighted scoring (custom criteria)</option>
                <option value="l1">L1 (lowest price wins)</option>
                <option value="technical_commercial">Technical + Commercial (60/40)</option>
              </select>
            </div>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>setCreating(false)}>Cancel</button>
              <button onClick={create} disabled={!form.rfqId||!form.title} style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer',opacity:!form.rfqId||!form.title?0.5:1}}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
