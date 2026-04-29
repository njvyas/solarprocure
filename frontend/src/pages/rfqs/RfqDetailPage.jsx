import React, { useState, useEffect, useCallback } from 'react';
import { rfqsAPI, apiCall} from '../utils/api';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';


export default function RfqDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [rfq,setRfq]=useState(null); const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState('items'); const [err,setErr]=useState('');
  const [approvedVendors,setApprovedVendors]=useState([]);
  const [publishedBoms,setPublishedBoms]=useState([]);
  const [selectedVids,setSelectedVids]=useState([]);
  const [selectedBomId,setSelectedBomId]=useState('');

  const load = useCallback(async()=>{
    setLoading(true);
    const [r,v,b]=await Promise.all([
      f(`/rfqs/${id}`),
      f('/vendors?status=approved&limit=100'),
      f('/boms?status=published&limit=100'),
    ]);
    setRfq(r.data);
    setApprovedVendors(v.data||[]);
    setPublishedBoms(b.data||[]);
    if (b.data?.length) setSelectedBomId(b.data[0].id);
    setLoading(false);
  },[id]);
  useEffect(()=>{load();},[load]);

  const action = async(endpoint,method='POST',body={})=>{
    setErr('');
    const res=await apiCall(`/rfqs/${id}${endpoint}`,{method,body:Object.keys(body).length?JSON.stringify(body):undefined});
    if(!res.success){setErr(res.error||'Action failed');return;}
    load();
  };

  const addVendors = async()=>{
    if(!selectedVids.length) return;
    await action('/vendors','POST',{vendorIds:selectedVids});
    setSelectedVids([]);
  };

  const importFromBom = async()=>{
    if(!selectedBomId){setErr('No published BOM available');return;}
    await action('/import-bom','POST',{bomId:selectedBomId});
  };

  if(loading) return <p style={{padding:'2rem',color:'var(--color-text-secondary)'}}>Loading...</p>;
  if(!rfq) return <p style={{color:'var(--color-text-danger)'}}>RFQ not found</p>;

  const isDraft=rfq.status==='draft';
  const canSend=rfq.status==='draft'&&(rfq.items?.length||0)>0&&(rfq.vendors?.length||0)>0;
  const existingVids=new Set((rfq.vendors||[]).map(v=>v.vendor_id));

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1.5rem'}}>
        <div>
          <Link to="/rfqs" style={{fontSize:'13px',color:'var(--color-text-secondary)',textDecoration:'none'}}>← RFQs</Link>
          <h1 style={{fontSize:'22px',fontWeight:500,margin:'4px 0'}}>{rfq.title}</h1>
          <div style={{display:'flex',gap:'12px',fontSize:'13px',color:'var(--color-text-secondary)'}}>
            <code>{rfq.rfq_number}</code>
            <span style={{textTransform:'capitalize'}}>{rfq.status}</span>
            {rfq.project_name&&<span>{rfq.project_name}</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          {isDraft&&can('rfqs','update')&&publishedBoms.length>0&&(
            <div style={{display:'flex',gap:'4px'}}>
              <select value={selectedBomId} onChange={e=>setSelectedBomId(e.target.value)} style={{fontSize:'13px',padding:'6px 8px'}}>
                {publishedBoms.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <button onClick={importFromBom} style={{fontSize:'13px',padding:'6px 10px'}}>Import BOM items</button>
            </div>
          )}
          {can('rfqs','send')&&isDraft&&canSend&&(
            <button onClick={()=>action('/send')} style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer',fontSize:'14px'}}>Send to vendors</button>
          )}
          {['sent','open'].includes(rfq.status)&&can('rfqs','update')&&<button onClick={()=>action('/close')}>Close</button>}
          {!['cancelled','awarded'].includes(rfq.status)&&can('rfqs','update')&&<button onClick={()=>action('/cancel')} style={{color:'var(--color-text-danger)'}}>Cancel</button>}
        </div>
      </div>

      {err&&<div style={{padding:'10px',marginBottom:'1rem',background:'var(--color-background-danger)',color:'var(--color-text-danger)',borderRadius:'var(--border-radius-md)',fontSize:'13px'}}>{err}</div>}

      <div style={{display:'flex',gap:'4px',marginBottom:'1.5rem',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
        {['items','vendors','quotes'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'8px 16px',background:'none',border:'none',borderBottom:`2px solid ${tab===t?'var(--color-text-primary)':'transparent'}`,color:tab===t?'var(--color-text-primary)':'var(--color-text-secondary)',cursor:'pointer',fontSize:'14px',textTransform:'capitalize'}}>
            {t}{t==='items'?` (${rfq.items?.length||0})`:t==='vendors'?` (${rfq.vendors?.length||0})`:''}
          </button>
        ))}
      </div>

      {tab==='items'&&(
        <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
            <thead><tr style={{background:'var(--color-background-secondary)'}}>
              {['#','Category','Description','Unit','Qty'].map(h=>(<th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>{h}</th>))}
            </tr></thead>
            <tbody>
              {(!rfq.items||rfq.items.length===0)
                ?<tr><td colSpan={5} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)'}}>No items. Select a published BOM and click "Import BOM items".</td></tr>
                :rfq.items.map(i=>(<tr key={i.id} style={{borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                  <td style={{padding:'8px 12px',color:'var(--color-text-secondary)'}}>{i.line_number}</td>
                  <td style={{padding:'8px 12px'}}><span style={{fontSize:'11px',background:'var(--color-background-info)',color:'var(--color-text-info)',padding:'2px 6px',borderRadius:'var(--border-radius-md)'}}>{i.category}</span></td>
                  <td style={{padding:'8px 12px'}}>{i.description}</td>
                  <td style={{padding:'8px 12px'}}>{i.unit}</td>
                  <td style={{padding:'8px 12px',textAlign:'right'}}>{i.quantity}</td>
                </tr>))}
            </tbody>
          </table>
        </div>
      )}

      {tab==='vendors'&&(
        <div>
          {isDraft&&can('rfqs','update')&&(
            <div style={{marginBottom:'1rem',padding:'1rem',background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)'}}>
              <p style={{fontSize:'13px',fontWeight:500,margin:'0 0 8px'}}>Add approved vendors ({approvedVendors.filter(v=>!existingVids.has(v.id)).length} available)</p>
              <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'8px'}}>
                {approvedVendors.filter(v=>!existingVids.has(v.id)).map(v=>(
                  <button key={v.id} onClick={()=>setSelectedVids(p=>p.includes(v.id)?p.filter(x=>x!==v.id):[...p,v.id])}
                    style={{padding:'4px 10px',fontSize:'12px',borderRadius:'var(--border-radius-md)',border:`0.5px solid ${selectedVids.includes(v.id)?'var(--color-border-info)':'var(--color-border-secondary)'}`,background:selectedVids.includes(v.id)?'var(--color-background-info)':'transparent',color:selectedVids.includes(v.id)?'var(--color-text-info)':'var(--color-text-secondary)',cursor:'pointer'}}>
                    {v.company_name}
                  </button>
                ))}
                {approvedVendors.filter(v=>!existingVids.has(v.id)).length===0&&<p style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:0}}>All approved vendors already added.</p>}
              </div>
              {selectedVids.length>0&&<button onClick={addVendors} style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'6px 14px',cursor:'pointer',fontSize:'13px'}}>Add {selectedVids.length} vendor{selectedVids.length>1?'s':''}</button>}
            </div>
          )}
          <div style={{display:'grid',gap:'8px'}}>
            {(!rfq.vendors||rfq.vendors.length===0)?<p style={{color:'var(--color-text-secondary)'}}>No vendors added.</p>
            :rfq.vendors.map(v=>(
              <div key={v.id} style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-md)',padding:'1rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div><p style={{fontWeight:500,margin:'0 0 2px'}}>{v.company_name}</p><p style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:0}}>{v.contact_email}</p></div>
                <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                  <span style={{fontSize:'12px',color:'var(--color-text-secondary)',textTransform:'capitalize'}}>{v.status}</span>
                  {v.access_token&&<code style={{fontSize:'11px',color:'var(--color-text-tertiary)'}}>/rfq-respond/{v.access_token.substring(0,8)}...</code>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==='quotes'&&<QuotesTab rfqId={rfq.id} />}
    </div>
  );
}

function QuotesTab({ rfqId }) {
  const [quotes,setQuotes]=useState([]); const [matrix,setMatrix]=useState(null); const [loading,setLoading]=useState(true);

  useEffect(()=>{
    Promise.all([f2(`/quotes?rfqId=${rfqId}`),f2(`/quotes/compare/${rfqId}`)])
      .then(([q,m])=>{setQuotes(q.data||[]);setMatrix(m.data);setLoading(false);});
  },[rfqId]);

  const evaluate=async(qid,status)=>{
    await f2(`/quotes/${qid}/evaluate`,{method:'POST',body:JSON.stringify({status})});
    const q=await f2(`/quotes?rfqId=${rfqId}`);setQuotes(q.data||[]);
    const m=await f2(`/quotes/compare/${rfqId}`);setMatrix(m.data);
  };

  if(loading) return <p style={{color:'var(--color-text-secondary)'}}>Loading...</p>;
  const fmtINR=n=>n?`₹${parseFloat(n).toLocaleString('en-IN',{maximumFractionDigits:0})}`:'—';

  return (
    <div>
      <h3 style={{fontSize:'14px',fontWeight:500,margin:'0 0 1rem'}}>Submitted quotes ({quotes.length})</h3>
      {quotes.length===0?<p style={{color:'var(--color-text-secondary)'}}>No quotes yet.</p>:(
        <div style={{display:'grid',gap:'8px',marginBottom:'2rem'}}>
          {quotes.map(q=>(
            <div key={q.id} style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-md)',padding:'1rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><p style={{fontWeight:500,margin:'0 0 2px'}}>{q.vendor_name}</p><p style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:0}}>{fmtINR(q.total_amount)} • {q.status}</p></div>
              <div style={{display:'flex',gap:'4px'}}>
                {q.status==='submitted'&&<><button onClick={()=>evaluate(q.id,'shortlisted')} style={{padding:'4px 10px',fontSize:'12px',color:'var(--color-text-success)'}}>Shortlist</button><button onClick={()=>evaluate(q.id,'rejected')} style={{padding:'4px 10px',fontSize:'12px',color:'var(--color-text-danger)'}}>Reject</button></>}
                {q.status==='shortlisted'&&<button onClick={()=>evaluate(q.id,'awarded')} style={{padding:'4px 10px',fontSize:'12px',background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',cursor:'pointer'}}>Award</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {matrix&&matrix.quotes.length>0&&(
        <div>
          <h3 style={{fontSize:'14px',fontWeight:500,margin:'0 0 1rem'}}>L1 comparison matrix</h3>
          <div style={{overflowX:'auto'}}>
            <table style={{borderCollapse:'collapse',fontSize:'12px',minWidth:600}}>
              <thead><tr style={{background:'var(--color-background-secondary)'}}>
                <th style={{padding:'8px 12px',textAlign:'left',fontWeight:500,borderBottom:'0.5px solid var(--color-border-tertiary)',minWidth:200}}>Item</th>
                {matrix.quotes.map(q=>(<th key={q.id} style={{padding:'8px 12px',textAlign:'right',fontWeight:500,borderBottom:'0.5px solid var(--color-border-tertiary)',minWidth:120}}>{q.company_name}</th>))}
              </tr></thead>
              <tbody>
                {matrix.rfqItems.map(ri=>{
                  const rates=matrix.quotes.map(q=>{const it=(q.items||[]).find(i=>i.rfqItemId===ri.id);return it?parseFloat(it.unitRate):null;});
                  const minRate=Math.min(...rates.filter(r=>r!==null));
                  return(
                    <tr key={ri.id} style={{borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                      <td style={{padding:'8px 12px',color:'var(--color-text-secondary)'}}>{ri.description}</td>
                      {matrix.quotes.map((q,qi)=>{
                        const r=rates[qi]; const isL1=r===minRate&&r!==null;
                        return <td key={q.id} style={{padding:'8px 12px',textAlign:'right',fontWeight:isL1?500:400,color:isL1?'var(--color-text-success)':'var(--color-text-primary)'}}>{r?fmtINR(r):'—'}</td>;
                      })}
                    </tr>);
                })}
                <tr style={{background:'var(--color-background-secondary)',fontWeight:500}}>
                  <td style={{padding:'8px 12px'}}>Total</td>
                  {matrix.quotes.map(q=>(<td key={q.id} style={{padding:'8px 12px',textAlign:'right'}}>{fmtINR(q.total_amount)}</td>))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
