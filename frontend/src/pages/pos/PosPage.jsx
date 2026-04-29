import React, { useState, useEffect, useCallback } from 'react';
import { posAPI, apiCall} from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const fmtINR=n=>n?`₹${parseFloat(n).toLocaleString('en-IN',{maximumFractionDigits:0})}`:'—';
const ST={draft:{bg:'var(--color-background-secondary)',c:'var(--color-text-secondary)'},pending_approval:{bg:'var(--color-background-warning)',c:'var(--color-text-warning)'},approved:{bg:'var(--color-background-success)',c:'var(--color-text-success)'},rejected:{bg:'var(--color-background-danger)',c:'var(--color-text-danger)'},issued:{bg:'var(--color-background-info)',c:'var(--color-text-info)'},closed:{bg:'var(--color-background-secondary)',c:'var(--color-text-secondary)'},cancelled:{bg:'var(--color-background-danger)',c:'var(--color-text-danger)'}};

export default function PosPage() {
  const { can }=useAuth(); const navigate=useNavigate();
  const [pos,setPos]=useState([]); const [stats,setStats]=useState({}); const [total,setTotal]=useState(0);
  const [page,setPage]=useState(1); const [sf,setSf]=useState(''); const [loading,setLoading]=useState(true);
  const [creating,setCreating]=useState(false); const [vendors,setVendors]=useState([]);
  const [form,setForm]=useState({vendorId:'',title:'',totalAmount:'',currency:'INR',deliveryLocation:'',deliveryDate:'',paymentTerms:''}); const [err,setErr]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    const params=new URLSearchParams({page,limit:20}); if(sf) params.set('status',sf);
    const [p,s,v]=await Promise.all([apiCall(`/purchase-orders?${params}`),f('/purchase-orders/stats'),f('/vendors?status=approved&limit=100')]);
    setPos(p.data||[]); setTotal(p.meta?.pagination?.total||0); setStats(s.data||{}); setVendors(v.data||[]); setLoading(false);
  },[page,sf]);
  useEffect(()=>{load();},[load]);

  const create=async()=>{
    setErr('');
    const res=await apiCall('/purchase-orders',{method:'POST',body:JSON.stringify({...form,totalAmount:parseFloat(form.totalAmount)})});
    if(!res.success){setErr(res.error);return;}
    setCreating(false); navigate(`/purchase-orders/${res.data.id}`);
  };

  if(!can('pos','read')) return <p style={{color:'var(--color-text-danger)'}}>Access denied</p>;
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem'}}>
        <div><h1 style={{fontSize:'22px',fontWeight:500,margin:'0 0 4px'}}>Purchase Orders</h1><p style={{color:'var(--color-text-secondary)',fontSize:'14px',margin:0}}>{total} total</p></div>
        {can('pos','create')&&<button onClick={()=>setCreating(true)}>+ New PO</button>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'1.5rem'}}>
        {[['pending_approval','Pending'],['approved','Approved'],['issued','Issued'],['total','Total']].map(([k,l])=>(
          <div key={k} onClick={()=>k!=='total'&&(setSf(p=>p===k?'':k),setPage(1))} style={{background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',padding:'1rem',cursor:k!=='total'?'pointer':'default',border:`0.5px solid ${sf===k?'var(--color-border-secondary)':'transparent'}`}}>
            <p style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:'0 0 4px'}}>{l}</p>
            <p style={{fontSize:'24px',fontWeight:500,margin:'0 0 2px'}}>{stats[k]?.count||0}</p>
            {stats[k]?.value>0&&<p style={{fontSize:'12px',color:'var(--color-text-tertiary)',margin:0}}>{fmtINR(stats[k].value)}</p>}
          </div>
        ))}
      </div>
      <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'14px',tableLayout:'fixed'}}>
          <thead><tr style={{background:'var(--color-background-secondary)'}}>
            {['PO #','Title','Vendor','Amount','Approval','Status'].map(h=>(<th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>{h}</th>))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={6} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)'}}>Loading...</td></tr>
            :pos.length===0?<tr><td colSpan={6} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)'}}>No POs found</td></tr>
            :pos.map(p=>{const s=ST[p.status]||ST.draft; return(
              <tr key={p.id} style={{borderBottom:'0.5px solid var(--color-border-tertiary)',cursor:'pointer'}} onClick={()=>navigate(`/purchase-orders/${p.id}`)}>
                <td style={{padding:'10px 14px',fontFamily:'monospace',fontSize:'12px'}}>{p.po_number}</td>
                <td style={{padding:'10px 14px',fontWeight:500}}>{p.title}</td>
                <td style={{padding:'10px 14px',fontSize:'13px',color:'var(--color-text-secondary)'}}>{p.vendor_name}</td>
                <td style={{padding:'10px 14px',fontWeight:500}}>{fmtINR(p.total_amount)}</td>
                <td style={{padding:'10px 14px',fontSize:'13px'}}>{p.current_level}/{p.approval_levels}</td>
                <td style={{padding:'10px 14px'}}><span style={{background:s.bg,color:s.c,fontSize:'12px',padding:'2px 8px',borderRadius:'var(--border-radius-md)'}}>{p.status.replace('_',' ')}</span></td>
              </tr>);})}
          </tbody>
        </table>
      </div>
      {creating&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1.5rem',width:520}}>
            <h3 style={{fontSize:'16px',fontWeight:500,margin:'0 0 1rem'}}>New Purchase Order</h3>
            {err&&<p style={{color:'var(--color-text-danger)',fontSize:'13px',margin:'0 0 0.75rem'}}>{err}</p>}
            <div style={{marginBottom:'0.75rem'}}>
              <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>Vendor *</label>
              <select value={form.vendorId} onChange={e=>setForm(p=>({...p,vendorId:e.target.value}))} style={{width:'100%'}}><option value="">Select...</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.company_name}</option>)}</select>
            </div>
            {[['title','Title *','text'],['totalAmount','Total amount (₹) *','number'],['deliveryLocation','Delivery location','text'],['deliveryDate','Delivery date','date'],['paymentTerms','Payment terms','text']].map(([k,l,t])=>(
              <div key={k} style={{marginBottom:'0.75rem'}}><label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>{l}</label><input value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} type={t} style={{width:'100%',boxSizing:'border-box'}} /></div>
            ))}
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'1rem'}}>
              <button onClick={()=>setCreating(false)}>Cancel</button>
              <button onClick={create} disabled={!form.vendorId||!form.title||!form.totalAmount} style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer',opacity:!form.vendorId||!form.title||!form.totalAmount?0.5:1}}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
