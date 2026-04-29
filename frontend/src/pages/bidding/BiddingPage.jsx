import React, { useState, useEffect, useCallback, useRef } from 'react';
import { biddingAPI, apiCall} from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';


const ST_C={scheduled:{bg:'var(--color-background-secondary)',c:'var(--color-text-secondary)'},active:{bg:'var(--color-background-success)',c:'var(--color-text-success)'},paused:{bg:'var(--color-background-warning)',c:'var(--color-text-warning)'},completed:{bg:'var(--color-background-info)',c:'var(--color-text-info)'},cancelled:{bg:'var(--color-background-danger)',c:'var(--color-text-danger)'}};

export default function BiddingPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [sessions,setSessions]=useState([]); const [total,setTotal]=useState(0);
  const [rfqs,setRfqs]=useState([]); const [loading,setLoading]=useState(true);
  const [creating,setCreating]=useState(false);
  const [form,setForm]=useState({rfqId:'',title:'',maxRounds:3,roundDurationMins:30,decrementType:'percentage',minDecrement:1.0,showRank:true,showBestPrice:false});
  const [err,setErr]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    const [s,r]=await Promise.all([apiCall('/bidding'),f('/rfqs?status=sent&limit=100')]);
    setSessions(s.data||[]); setTotal(s.meta?.pagination?.total||0);
    setRfqs(r.data||[]);
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  const create=async()=>{
    setErr('');
    const res=await apiCall('/bidding',{method:'POST',body:JSON.stringify(form)});
    if(!res.success){setErr(res.error);return;}
    setCreating(false); load(); navigate(`/bidding/${res.data.id}`);
  };

  if(!can('rfqs','read')) return <p style={{color:'var(--color-text-danger)'}}>Access denied</p>;
  const fmtINR=n=>n?`₹${parseFloat(n).toLocaleString('en-IN',{maximumFractionDigits:0})}`:'—';

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem'}}>
        <div><h1 style={{fontSize:'22px',fontWeight:500,margin:'0 0 4px'}}>Reverse Bidding</h1><p style={{color:'var(--color-text-secondary)',fontSize:'14px',margin:0}}>{total} sessions</p></div>
        {can('rfqs','update')&&<button onClick={()=>setCreating(true)}>+ New session</button>}
      </div>

      <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'14px',tableLayout:'fixed'}}>
          <thead><tr style={{background:'var(--color-background-secondary)'}}>
            {['Title','RFQ','Round','Vendors','Duration','Status'].map(h=>(<th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>{h}</th>))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={6} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)'}}>Loading...</td></tr>
            :sessions.length===0?<tr><td colSpan={6} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)'}}>No sessions yet</td></tr>
            :sessions.map(s=>{const sc=ST_C[s.status]||ST_C.scheduled;return(
              <tr key={s.id} style={{borderBottom:'0.5px solid var(--color-border-tertiary)',cursor:'pointer'}} onClick={()=>navigate(`/bidding/${s.id}`)}>
                <td style={{padding:'10px 14px',fontWeight:500}}>{s.title}</td>
                <td style={{padding:'10px 14px',fontSize:'13px',color:'var(--color-text-secondary)'}}><code>{s.rfq_number}</code></td>
                <td style={{padding:'10px 14px'}}>{s.current_round}/{s.max_rounds}</td>
                <td style={{padding:'10px 14px'}}>{s.participating_vendors||0}</td>
                <td style={{padding:'10px 14px',fontSize:'13px'}}>{s.round_duration_mins}m</td>
                <td style={{padding:'10px 14px'}}><span style={{background:sc.bg,color:sc.c,fontSize:'12px',padding:'2px 8px',borderRadius:'var(--border-radius-md)'}}>{s.status}</span></td>
              </tr>);})}
          </tbody>
        </table>
      </div>

      {creating&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1.5rem',width:520,maxHeight:'90vh',overflowY:'auto'}}>
            <h3 style={{fontSize:'16px',fontWeight:500,margin:'0 0 1rem'}}>New bidding session</h3>
            {err&&<p style={{color:'var(--color-text-danger)',fontSize:'13px',margin:'0 0 1rem'}}>{err}</p>}
            <div style={{marginBottom:'0.75rem'}}>
              <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>RFQ (sent status) *</label>
              <select value={form.rfqId} onChange={e=>setForm(p=>({...p,rfqId:e.target.value}))} style={{width:'100%'}}>
                <option value="">Select RFQ...</option>
                {rfqs.map(r=><option key={r.id} value={r.id}>{r.rfq_number} — {r.title}</option>)}
              </select>
            </div>
            {[['title','Session title *','text'],['maxRounds','Max rounds','number'],['roundDurationMins','Round duration (mins)','number'],['minDecrement','Min decrement','number']].map(([k,l,t])=>(
              <div key={k} style={{marginBottom:'0.75rem'}}>
                <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>{l}</label>
                <input value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} type={t} style={{width:'100%',boxSizing:'border-box'}} />
              </div>
            ))}
            <div style={{marginBottom:'0.75rem'}}>
              <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>Decrement type</label>
              <select value={form.decrementType} onChange={e=>setForm(p=>({...p,decrementType:e.target.value}))} style={{width:'100%'}}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed amount (₹)</option>
              </select>
            </div>
            <div style={{display:'flex',gap:'12px',marginBottom:'0.75rem'}}>
              {[['showRank','Show rank to vendors'],['showBestPrice','Show best price']].map(([k,l])=>(
                <label key={k} style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',cursor:'pointer'}}>
                  <input type="checkbox" checked={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.checked}))} />
                  {l}
                </label>
              ))}
            </div>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'1rem'}}>
              <button onClick={()=>setCreating(false)}>Cancel</button>
              <button onClick={create} disabled={!form.rfqId||!form.title} style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer',opacity:!form.rfqId||!form.title?0.5:1}}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
