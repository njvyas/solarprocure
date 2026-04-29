import React, { useState, useEffect, useRef } from 'react';
import { biddingAPI } from '../utils/api';
import { useParams } from 'react-router-dom';

function Countdown({ endTime }) {
  const [secs,setSecs]=useState(0);
  useEffect(()=>{
    const calc=()=>setSecs(Math.max(0,Math.floor((new Date(endTime)-Date.now())/1000)));
    calc(); const t=setInterval(calc,1000); return ()=>clearInterval(t);
  },[endTime]);
  if(!secs) return <span style={{color:'var(--color-text-danger)',fontFamily:'monospace',fontSize:'20px',fontWeight:500}}>Closed</span>;
  const m=Math.floor(secs/60),s=secs%60;
  const color=secs<120?'var(--color-text-danger)':secs<300?'var(--color-text-warning)':'var(--color-text-success)';
  return <span style={{fontFamily:'monospace',fontSize:'32px',fontWeight:500,color}}>{m}:{String(s).padStart(2,'0')}</span>;
}

export default function BidPage() {
  const { token } = useParams();
  const [rfqData,setRfqData]=useState(null);
  const [amount,setAmount]=useState('');
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [err,setErr]=useState('');
  const [result,setResult]=useState(null);
  const [sessionData,setSessionData]=useState(null);
  const pollRef=useRef(null);

  const loadSession=async()=>{
    // Get RFQ info via vendor token
    const rfqRes=await fetch(`${API}/rfqs/token/${token}`).then(r=>r.json());
    if(rfqRes.success) setRfqData(rfqRes.data);
    setLoading(false);
  };

  useEffect(()=>{
    loadSession();
    pollRef.current=setInterval(loadSession, 10000);
    return ()=>clearInterval(pollRef.current);
  },[token]);

  const placeBid=async()=>{
    if(!amount||parseFloat(amount)<=0){setErr('Enter a valid amount');return;}
    setSubmitting(true); setErr('');
    const res=await fetch(`${API}/bidding/bid/${token}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:parseFloat(amount)})}).then(r=>r.json());
    setSubmitting(false);
    if(!res.success){setErr(res.error||'Bid failed');return;}
    setResult(res.data); setAmount('');
  };

  if(loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--color-text-secondary)'}}>Loading...</div>;
  if(!rfqData) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--color-text-danger)'}}>Invalid or expired link</div>;

  const rfq=rfqData.rfq;

  return (
    <div style={{minHeight:'100vh',background:'var(--color-background-tertiary)',padding:'2rem 1rem'}}>
      <div style={{maxWidth:480,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:'2rem'}}>
          <p style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:'0 0 4px'}}>{rfq?.tenant_name}</p>
          <h1 style={{fontSize:'22px',fontWeight:500,margin:'0 0 4px'}}>{rfq?.title}</h1>
          <code style={{fontSize:'13px',color:'var(--color-text-secondary)'}}>{rfq?.rfq_number}</code>
        </div>

        {result&&(
          <div style={{padding:'1rem',marginBottom:'1rem',background:'var(--color-background-success)',border:'0.5px solid var(--color-border-success)',borderRadius:'var(--border-radius-lg)',textAlign:'center'}}>
            <p style={{fontWeight:500,margin:'0 0 4px',color:'var(--color-text-success)'}}>Bid submitted — ₹{parseFloat(result.bid?.amount||0).toLocaleString('en-IN',{maximumFractionDigits:0})}</p>
            {result.rank!=null&&<p style={{fontSize:'13px',color:'var(--color-text-success)',margin:0}}>Your current rank: #{result.rank}</p>}
          </div>
        )}

        {err&&<div style={{padding:'10px',marginBottom:'1rem',background:'var(--color-background-danger)',color:'var(--color-text-danger)',borderRadius:'var(--border-radius-md)',fontSize:'13px'}}>{err}</div>}

        <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'2rem',textAlign:'center'}}>
          <p style={{fontSize:'14px',color:'var(--color-text-secondary)',margin:'0 0 1rem'}}>Enter your bid amount (total project value)</p>
          <div style={{display:'flex',gap:'8px',marginBottom:'1rem'}}>
            <span style={{padding:'10px 12px',background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',fontSize:'14px',fontWeight:500}}>₹</span>
            <input type="number" min="1" step="1" value={amount} onChange={e=>setAmount(e.target.value)}
              placeholder="0" style={{flex:1,fontSize:'18px',textAlign:'right',boxSizing:'border-box'}}
              onKeyDown={e=>e.key==='Enter'&&placeBid()} />
          </div>
          <button onClick={placeBid} disabled={submitting||!amount}
            style={{width:'100%',padding:'12px',background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',fontSize:'14px',fontWeight:500,cursor:'pointer',opacity:submitting||!amount?0.6:1}}>
            {submitting?'Placing bid...':'Place bid'}
          </button>
          <p style={{fontSize:'12px',color:'var(--color-text-tertiary)',marginTop:'1rem'}}>Lower bids rank higher. You can revise your bid within the round.</p>
        </div>
      </div>
    </div>
  );
}
