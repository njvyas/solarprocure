import React, { useState, useEffect, useCallback, useRef } from 'react';
import { biddingAPI, apiCall} from '../utils/api';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const fmtINR = n => n!=null ? `₹${parseFloat(n).toLocaleString('en-IN',{maximumFractionDigits:0})}` : '—';

function Countdown({ endTime }) {
  const [secs,setSecs]=useState(0);
  useEffect(()=>{
    const calc=()=>{ const d=Math.max(0,Math.floor((new Date(endTime)-Date.now())/1000)); setSecs(d); };
    calc(); const t=setInterval(calc,1000); return ()=>clearInterval(t);
  },[endTime]);
  if(!secs) return <span style={{color:'var(--color-text-danger)'}}>Time expired</span>;
  const m=Math.floor(secs/60), s=secs%60;
  const color = secs<300?'var(--color-text-danger)':secs<600?'var(--color-text-warning)':'var(--color-text-success)';
  return <span style={{fontFamily:'monospace',fontWeight:500,color}}>{m}:{String(s).padStart(2,'0')}</span>;
}

export default function BiddingDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [sess,setSess]=useState(null); const [leaderboard,setLb]=useState(null);
  const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  const pollRef=useRef(null);

  const load=useCallback(async()=>{
    const [s,lb]=await Promise.all([apiCall(`/bidding/${id}`),f(`/bidding/${id}/leaderboard`)]);
    setSess(s.data); setLb(lb.data); setLoading(false);
  },[id]);

  useEffect(()=>{
    load();
    pollRef.current=setInterval(load, 5000); // poll every 5s
    return ()=>clearInterval(pollRef.current);
  },[load]);

  const action=async(endpoint)=>{
    setErr('');
    const res=await apiCall(`/bidding/${id}${endpoint}`,{method:'POST'});
    if(!res.success){setErr(res.error);return;}
    load();
  };

  if(loading) return <p style={{padding:'2rem',color:'var(--color-text-secondary)'}}>Loading...</p>;
  if(!sess) return <p style={{color:'var(--color-text-danger)'}}>Session not found</p>;

  const activeRound=sess.rounds?.find(r=>r.status==='active');
  const ST_C={scheduled:'var(--color-text-secondary)',active:'var(--color-text-success)',paused:'var(--color-text-warning)',completed:'var(--color-text-info)',cancelled:'var(--color-text-danger)'};

  return (
    <div>
      <Link to="/bidding" style={{fontSize:'13px',color:'var(--color-text-secondary)',textDecoration:'none',display:'block',marginBottom:'0.5rem'}}>← Bidding sessions</Link>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1.5rem'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:500,margin:'0 0 4px'}}>{sess.title}</h1>
          <div style={{display:'flex',gap:'12px',fontSize:'13px',color:'var(--color-text-secondary)'}}>
            <span style={{color:ST_C[sess.status]||'var(--color-text-secondary)',textTransform:'capitalize'}}>{sess.status}</span>
            <span>Round {sess.current_round}/{sess.max_rounds}</span>
            <code>{sess.rfq_number}</code>
          </div>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          {['scheduled','paused'].includes(sess.status)&&can('rfqs','update')&&sess.current_round<sess.max_rounds&&(
            <button onClick={()=>action('/start-round')} style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer'}}>
              {sess.current_round===0?'Start Round 1':`Start Round ${sess.current_round+1}`}
            </button>
          )}
          {sess.status==='active'&&can('rfqs','update')&&(
            <button onClick={()=>action('/end-round')} style={{color:'var(--color-text-warning)'}}>End round</button>
          )}
        </div>
      </div>

      {err&&<div style={{padding:'10px',marginBottom:'1rem',background:'var(--color-background-danger)',color:'var(--color-text-danger)',borderRadius:'var(--border-radius-md)',fontSize:'13px'}}>{err}</div>}

      {/* Session config */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'1.5rem'}}>
        {[
          ['Status',<span style={{textTransform:'capitalize',color:ST_C[sess.status]}}>{sess.status}</span>],
          ['Current round',`${sess.current_round} / ${sess.max_rounds}`],
          ['Round duration',`${sess.round_duration_mins} min`],
          ['Min decrement',`${sess.min_decrement}${sess.decrement_type==='percentage'?'%':' ₹'}`],
        ].map(([l,v])=>(
          <div key={l} style={{background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',padding:'1rem'}}>
            <p style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:'0 0 4px'}}>{l}</p>
            <p style={{fontSize:'16px',fontWeight:500,margin:0}}>{v}</p>
          </div>
        ))}
      </div>

      {/* Active round timer */}
      {activeRound&&sess.current_round_end&&(
        <div style={{marginBottom:'1.5rem',padding:'1rem 1.5rem',background:'var(--color-background-success)',border:'0.5px solid var(--color-border-success)',borderRadius:'var(--border-radius-lg)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <p style={{fontSize:'14px',fontWeight:500,margin:'0 0 2px',color:'var(--color-text-success)'}}>Round {sess.current_round} active</p>
            <p style={{fontSize:'13px',color:'var(--color-text-success)',margin:0}}>Accepting bids</p>
          </div>
          <div style={{textAlign:'right'}}>
            <p style={{fontSize:'12px',color:'var(--color-text-success)',margin:'0 0 2px'}}>Time remaining</p>
            <div style={{fontSize:'24px'}}><Countdown endTime={sess.current_round_end} /></div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div style={{marginBottom:'1.5rem'}}>
        <h2 style={{fontSize:'16px',fontWeight:500,marginBottom:'0.75rem'}}>
          Leaderboard {leaderboard?.round?`— Round ${leaderboard.round.round_number}`:''}
        </h2>
        {!leaderboard?.bids?.length
          ?<p style={{color:'var(--color-text-secondary)',fontSize:'14px'}}>No bids yet in this session.</p>
          :(
            <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'14px'}}>
                <thead><tr style={{background:'var(--color-background-secondary)'}}>
                  {['Rank','Vendor','Bid amount','Bid time'].map(h=>(<th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>{h}</th>))}
                </tr></thead>
                <tbody>
                  {leaderboard.bids.map((b,i)=>(
                    <tr key={i} style={{borderBottom:'0.5px solid var(--color-border-tertiary)',background:i===0?'var(--color-background-success)':'transparent'}}>
                      <td style={{padding:'10px 14px',fontWeight:500,color:i===0?'var(--color-text-success)':'var(--color-text-secondary)'}}>{i===0?'🥇':`#${b.rank||i+1}`}</td>
                      <td style={{padding:'10px 14px',fontWeight:i===0?500:400}}>{b.vendor_name}</td>
                      <td style={{padding:'10px 14px',fontWeight:500,color:i===0?'var(--color-text-success)':'var(--color-text-primary)'}}>{fmtINR(b.amount)}</td>
                      <td style={{padding:'10px 14px',fontSize:'13px',color:'var(--color-text-secondary)'}}>{new Date(b.bid_time).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Round history */}
      <div>
        <h2 style={{fontSize:'16px',fontWeight:500,marginBottom:'0.75rem'}}>Round history</h2>
        {(!sess.rounds||sess.rounds.length===0)
          ?<p style={{color:'var(--color-text-secondary)',fontSize:'14px'}}>No rounds started yet.</p>
          :(
            <div style={{display:'grid',gap:'8px'}}>
              {sess.rounds.map(r=>(
                <div key={r.id} style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-md)',padding:'1rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <p style={{fontWeight:500,margin:'0 0 2px'}}>Round {r.round_number}</p>
                    <p style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:0}}>
                      {r.started_at&&`Started ${new Date(r.started_at).toLocaleTimeString()}`}
                      {r.ended_at&&` · Ended ${new Date(r.ended_at).toLocaleTimeString()}`}
                    </p>
                  </div>
                  <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                    <span style={{fontSize:'13px',color:'var(--color-text-secondary)'}}>{r.bid_count||0} bids</span>
                    <span style={{fontSize:'12px',textTransform:'capitalize',color:r.status==='active'?'var(--color-text-success)':r.status==='completed'?'var(--color-text-info)':'var(--color-text-secondary)'}}>{r.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
