import React, { useState, useEffect, useCallback } from 'react';
import { evaluationsAPI, apiCall} from '../utils/api';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const fmtINR=n=>n?`₹${parseFloat(n).toLocaleString('en-IN',{maximumFractionDigits:0})}`:'—';

export default function EvaluationDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [ev,setEv]=useState(null); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  const [scoringVendor,setScoringVendor]=useState(null);
  const [scoreForm,setScoreForm]=useState({ criterionId:'', rawScore:'', notes:'' });

  const load=useCallback(async()=>{
    const res=await apiCall(`/evaluations/${id}`);
    setEv(res.data); setLoading(false);
  },[id]);
  useEffect(()=>{load();},[load]);

  const saveScore=async()=>{
    setErr('');
    const res=await apiCall(`/evaluations/${id}/score`,{method:'POST',body:JSON.stringify({vendorId:scoringVendor.vendorId,criterionId:scoreForm.criterionId,rawScore:parseFloat(scoreForm.rawScore),notes:scoreForm.notes})});
    if(!res.success){setErr(res.error);return;}
    setScoringVendor(null); load();
  };

  const finalize=async()=>{
    if(!confirm('Finalize this evaluation? No further changes can be made.')) return;
    const res=await apiCall(`/evaluations/${id}/finalize`,{method:'POST'});
    if(!res.success){setErr(res.error);return;}
    load();
  };

  if(loading) return <p style={{padding:'2rem',color:'var(--color-text-secondary)'}}>Loading...</p>;
  if(!ev) return <p style={{color:'var(--color-text-danger)'}}>Evaluation not found</p>;

  const isFinalized=ev.status==='finalized';
  const manualCriteria=(ev.criteria||[]).filter(c=>c.criterion_type!=='price');

  return (
    <div>
      <Link to="/evaluations" style={{fontSize:'13px',color:'var(--color-text-secondary)',textDecoration:'none',display:'block',marginBottom:'0.5rem'}}>← Evaluations</Link>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1.5rem'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:500,margin:'0 0 4px'}}>{ev.title}</h1>
          <div style={{display:'flex',gap:'12px',fontSize:'13px',color:'var(--color-text-secondary)'}}>
            <code>{ev.rfq_number}</code>
            <span style={{textTransform:'capitalize'}}>{ev.evaluation_type?.replace('_',' ')}</span>
            <span style={{textTransform:'capitalize',color:isFinalized?'var(--color-text-success)':'var(--color-text-warning)'}}>{ev.status}</span>
          </div>
        </div>
        {!isFinalized&&can('quotes','evaluate')&&(ev.matrix||[]).length>0&&(
          <button onClick={finalize} style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer',fontSize:'14px'}}>Finalize</button>
        )}
      </div>

      {err&&<div style={{padding:'10px',marginBottom:'1rem',background:'var(--color-background-danger)',color:'var(--color-text-danger)',borderRadius:'var(--border-radius-md)',fontSize:'13px'}}>{err}</div>}

      {/* Criteria weights */}
      <div style={{marginBottom:'1.5rem',display:'flex',flexWrap:'wrap',gap:'8px'}}>
        {(ev.criteria||[]).map(c=>(
          <div key={c.id} style={{background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',padding:'6px 12px',fontSize:'13px'}}>
            <span>{c.name}</span>
            <span style={{marginLeft:'6px',fontWeight:500,color:'var(--color-text-secondary)'}}>{c.weight}%</span>
            {c.criterion_type==='price'&&<span style={{marginLeft:'4px',fontSize:'11px',color:'var(--color-text-info)'}}>(auto)</span>}
          </div>
        ))}
      </div>

      {/* Scoring matrix */}
      {(!ev.matrix||ev.matrix.length===0)
        ?<p style={{color:'var(--color-text-secondary)'}}>No submitted quotes found for this RFQ.</p>
        :(
          <div style={{overflowX:'auto'}}>
            <table style={{borderCollapse:'collapse',fontSize:'13px',minWidth:700,width:'100%'}}>
              <thead>
                <tr style={{background:'var(--color-background-secondary)'}}>
                  <th style={{padding:'10px 12px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)',minWidth:150}}>Vendor</th>
                  <th style={{padding:'10px 12px',textAlign:'right',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>Quote</th>
                  {(ev.criteria||[]).map(c=>(<th key={c.id} style={{padding:'10px 12px',textAlign:'right',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)',whiteSpace:'nowrap'}}>{c.name}<br/><span style={{fontWeight:400}}>({c.weight}%)</span></th>))}
                  <th style={{padding:'10px 12px',textAlign:'right',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>Weighted score</th>
                  {!isFinalized&&can('quotes','evaluate')&&<th style={{padding:'10px 12px',borderBottom:'0.5px solid var(--color-border-tertiary)'}}></th>}
                </tr>
              </thead>
              <tbody>
                {ev.matrix.map((vendor,idx)=>{
                  const isTop=idx===0&&vendor.totalWeightedScore!=null;
                  return (
                    <tr key={vendor.vendorId} style={{borderBottom:'0.5px solid var(--color-border-tertiary)',background:isTop?'var(--color-background-success)':'transparent'}}>
                      <td style={{padding:'10px 12px',fontWeight:isTop?500:400}}>{isTop&&'🏆 '}{vendor.vendorName}</td>
                      <td style={{padding:'10px 12px',textAlign:'right'}}>{fmtINR(vendor.totalAmount)}</td>
                      {vendor.criteriaScores.map(cs=>(
                        <td key={cs.criterionId} style={{padding:'10px 12px',textAlign:'right'}}>
                          {cs.rawScore!=null
                            ?<span style={{fontWeight:500}}>{cs.rawScore.toFixed(1)}<span style={{fontWeight:400,color:'var(--color-text-secondary)',fontSize:'11px'}}> → {(cs.weightedScore||0).toFixed(1)}</span></span>
                            :<span style={{color:'var(--color-text-tertiary)'}}>—</span>}
                        </td>
                      ))}
                      <td style={{padding:'10px 12px',textAlign:'right',fontWeight:500,color:isTop?'var(--color-text-success)':'var(--color-text-primary)'}}>
                        {vendor.totalWeightedScore!=null?vendor.totalWeightedScore.toFixed(2):'Incomplete'}
                      </td>
                      {!isFinalized&&can('quotes','evaluate')&&(
                        <td style={{padding:'10px 12px'}}>
                          {manualCriteria.length>0&&<button onClick={()=>{setScoringVendor(vendor);setScoreForm({criterionId:manualCriteria[0]?.id||'',rawScore:'',notes:''}); }} style={{padding:'4px 10px',fontSize:'12px'}}>Score</button>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      {/* Score modal */}
      {scoringVendor&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1.5rem',width:400}}>
            <h3 style={{fontSize:'16px',fontWeight:500,margin:'0 0 1rem'}}>Score — {scoringVendor.vendorName}</h3>
            <div style={{marginBottom:'0.75rem'}}>
              <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>Criterion</label>
              <select value={scoreForm.criterionId} onChange={e=>setScoreForm(p=>({...p,criterionId:e.target.value}))} style={{width:'100%'}}>
                {manualCriteria.map(c=><option key={c.id} value={c.id}>{c.name} ({c.weight}%)</option>)}
              </select>
            </div>
            <div style={{marginBottom:'0.75rem'}}>
              <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>Score (0–100) *</label>
              <input type="number" min="0" max="100" value={scoreForm.rawScore} onChange={e=>setScoreForm(p=>({...p,rawScore:e.target.value}))} style={{width:'100%',boxSizing:'border-box'}} />
            </div>
            <div style={{marginBottom:'1rem'}}>
              <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>Notes</label>
              <textarea value={scoreForm.notes} onChange={e=>setScoreForm(p=>({...p,notes:e.target.value}))} rows={2} style={{width:'100%',boxSizing:'border-box',resize:'vertical'}} />
            </div>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>setScoringVendor(null)}>Cancel</button>
              <button onClick={saveScore} disabled={!scoreForm.criterionId||scoreForm.rawScore===''} style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer'}}>Save score</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
