import React, { useState, useEffect, useCallback } from 'react';
import { posAPI, apiCall} from '../utils/api';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const fmtINR=n=>n?`₹${parseFloat(n).toLocaleString('en-IN',{maximumFractionDigits:0})}`:'—';
const ST_C={draft:'var(--color-text-secondary)',pending_approval:'var(--color-text-warning)',approved:'var(--color-text-success)',rejected:'var(--color-text-danger)',issued:'var(--color-text-info)',closed:'var(--color-text-secondary)',cancelled:'var(--color-text-danger)'};

export default function PoDetailPage() {
  const { id }=useParams(); const { can }=useAuth();
  const [po,setPo]=useState(null); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  const [comments,setComments]=useState('');

  const load=useCallback(async()=>{ const res=await apiCall(`/purchase-orders/${id}`); setPo(res.data); setLoading(false); },[id]);
  useEffect(()=>{load();},[load]);

  const action=async(endpoint,body={})=>{
    setErr('');
    const res=await apiCall(`/purchase-orders/${id}${endpoint}`,{method:'POST',body:JSON.stringify(body)});
    if(!res.success){setErr(res.error);return;}
    setComments(''); load();
  };

  if(loading) return <p style={{padding:'2rem',color:'var(--color-text-secondary)'}}>Loading...</p>;
  if(!po) return <p style={{color:'var(--color-text-danger)'}}>PO not found</p>;

  const isDraft=po.status==='draft';
  const isPending=po.status==='pending_approval';
  const isApproved=po.status==='approved';

  return (
    <div>
      <Link to="/purchase-orders" style={{fontSize:'13px',color:'var(--color-text-secondary)',textDecoration:'none',display:'block',marginBottom:'0.5rem'}}>← Purchase Orders</Link>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1.5rem'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:500,margin:'0 0 4px'}}>{po.title}</h1>
          <div style={{display:'flex',gap:'12px',fontSize:'13px',color:'var(--color-text-secondary)'}}>
            <code>{po.po_number}</code>
            <span style={{color:ST_C[po.status]||'var(--color-text-secondary)',textTransform:'capitalize'}}>{po.status.replace('_',' ')}</span>
            <span>Approval: {po.current_level}/{po.approval_levels}</span>
          </div>
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          {isDraft&&can('pos','create')&&<button onClick={()=>action('/submit')} style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer',fontSize:'14px'}}>Submit for approval</button>}
          {isPending&&can('pos','approve')&&<>
            <button onClick={()=>action('/approve',{comments})} style={{color:'var(--color-text-success)'}}>Approve</button>
            <button onClick={()=>action('/reject',{comments:'Rejected'})} style={{color:'var(--color-text-danger)'}}>Reject</button>
            <button onClick={()=>action('/request-changes',{comments:'Changes requested'})}>Request changes</button>
          </>}
          {isApproved&&can('pos','update')&&<button onClick={()=>action('/issue')} style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer',fontSize:'14px'}}>Issue PO</button>}
          {!['issued','closed','cancelled'].includes(po.status)&&can('pos','update')&&<button onClick={()=>action('/cancel',{reason:'Cancelled by user'})} style={{color:'var(--color-text-danger)'}}>Cancel</button>}
        </div>
      </div>

      {err&&<div style={{padding:'10px',marginBottom:'1rem',background:'var(--color-background-danger)',color:'var(--color-text-danger)',borderRadius:'var(--border-radius-md)',fontSize:'13px'}}>{err}</div>}

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'1.5rem'}}>
        {[['Vendor',po.vendor_name],['Total',fmtINR(po.total_amount)],['Delivery',po.delivery_date?new Date(po.delivery_date).toLocaleDateString():'—']].map(([l,v])=>(
          <div key={l} style={{background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',padding:'1rem'}}>
            <p style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:'0 0 4px'}}>{l}</p>
            <p style={{fontSize:'16px',fontWeight:500,margin:0}}>{v}</p>
          </div>
        ))}
      </div>

      {/* Line items */}
      <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'auto',marginBottom:'1.5rem'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px',minWidth:700}}>
          <thead><tr style={{background:'var(--color-background-secondary)'}}>
            {['#','Description','Unit','Qty','Unit Rate','Total','HSN','GST%'].map(h=>(<th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>{h}</th>))}
          </tr></thead>
          <tbody>
            {(!po.items||po.items.length===0)?<tr><td colSpan={8} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)'}}>No items</td></tr>
            :po.items.map(i=>(<tr key={i.id} style={{borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
              <td style={{padding:'8px 12px',color:'var(--color-text-secondary)'}}>{i.line_number}</td>
              <td style={{padding:'8px 12px'}}>{i.description}</td>
              <td style={{padding:'8px 12px'}}>{i.unit}</td>
              <td style={{padding:'8px 12px',textAlign:'right'}}>{i.quantity}</td>
              <td style={{padding:'8px 12px',textAlign:'right'}}>{fmtINR(i.unit_rate)}</td>
              <td style={{padding:'8px 12px',textAlign:'right',fontWeight:500}}>{fmtINR(i.total_amount)}</td>
              <td style={{padding:'8px 12px',fontSize:'12px',color:'var(--color-text-secondary)'}}>{i.hsn_code||'—'}</td>
              <td style={{padding:'8px 12px'}}>{i.gst_rate}%</td>
            </tr>))}
          </tbody>
        </table>
      </div>

      {/* Approval trail */}
      <div>
        <h2 style={{fontSize:'16px',fontWeight:500,marginBottom:'0.75rem'}}>Approval trail</h2>
        {(!po.approvals||po.approvals.length===0)?<p style={{color:'var(--color-text-secondary)',fontSize:'14px'}}>No approval actions yet.</p>
        :(
          <div style={{display:'grid',gap:'8px'}}>
            {po.approvals.map(a=>(
              <div key={a.id} style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-md)',padding:'1rem',display:'flex',justifyContent:'space-between'}}>
                <div>
                  <p style={{fontWeight:500,margin:'0 0 2px'}}>{a.approver_name}<span style={{marginLeft:'8px',fontSize:'12px',color:'var(--color-text-secondary)'}}>({a.role_name})</span></p>
                  {a.comments&&<p style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:0}}>{a.comments}</p>}
                </div>
                <div style={{textAlign:'right'}}>
                  <span style={{fontSize:'12px',textTransform:'capitalize',color:a.action==='approved'?'var(--color-text-success)':a.action==='rejected'?'var(--color-text-danger)':'var(--color-text-warning)'}}>{a.action.replace('_',' ')}</span>
                  <p style={{fontSize:'12px',color:'var(--color-text-secondary)',margin:'2px 0 0'}}>{new Date(a.acted_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
