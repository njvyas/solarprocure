import React, { useState, useEffect, useCallback } from 'react';
import { aiAPI, apiCall} from '../utils/api';
import { useParams, Link } from 'react-router-dom';

const fmtINR = n => n!=null ? `₹${parseFloat(n).toLocaleString('en-IN',{maximumFractionDigits:0})}` : '—';

const INSIGHT_LABELS = { spend_forecast:'Spend Forecast', vendor_risk:'Vendor Risk', rfq_optimization:'RFQ Optimization', price_benchmark:'Price Benchmark', po_anomaly:'PO Anomaly', vendor_recommendation:'Vendor Recommendations', savings_opportunity:'Savings Opportunities', compliance_risk:'Compliance Risk' };

export default function AiInsightDetailPage() {
  const { id } = useParams();
  const [ins, setIns] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await apiCall(`/ai/insights/${id}`);
    setIns(res.data); setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!ins || !['pending','running'].includes(ins?.status)) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [ins, load]);

  if (loading) return <p style={{padding:'2rem',color:'var(--color-text-secondary)'}}>Loading...</p>;
  if (!ins) return <p style={{color:'var(--color-text-danger)'}}>Insight not found</p>;

  const result = ins.result;
  const ST = {pending:'var(--color-text-secondary)',running:'var(--color-text-info)',completed:'var(--color-text-success)',failed:'var(--color-text-danger)'};

  return (
    <div>
      <Link to="/ai/insights" style={{fontSize:'13px',color:'var(--color-text-secondary)',textDecoration:'none',display:'block',marginBottom:'0.5rem'}}>← AI Insights</Link>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1.5rem'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:500,margin:'0 0 4px'}}>{INSIGHT_LABELS[ins.insight_type]||ins.insight_type}</h1>
          <div style={{display:'flex',gap:'12px',fontSize:'13px',color:'var(--color-text-secondary)'}}>
            <span style={{color:ST[ins.status]||'var(--color-text-secondary)',textTransform:'capitalize'}}>{ins.status}</span>
            <span>{new Date(ins.created_at).toLocaleString()}</span>
            {ins.provider_name && <span>{ins.provider_name}</span>}
            {ins.tokens_used>0 && <span>{ins.tokens_used.toLocaleString()} tokens</span>}
          </div>
        </div>
      </div>

      {ins.status==='running'&&<div style={{padding:'1rem',background:'var(--color-background-info)',borderRadius:'var(--border-radius-md)',marginBottom:'1rem',fontSize:'14px',color:'var(--color-text-info)'}}>⟳ AI is analyzing your data... Auto-refreshing</div>}
      {ins.status==='failed'&&<div style={{padding:'1rem',background:'var(--color-background-danger)',borderRadius:'var(--border-radius-md)',marginBottom:'1rem',fontSize:'14px',color:'var(--color-text-danger)'}}>{ins.error_message}</div>}

      {ins.summary && (
        <div style={{padding:'1rem 1.25rem',background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-lg)',marginBottom:'1.5rem',borderLeft:'3px solid var(--color-border-info)'}}>
          <p style={{fontSize:'14px',margin:0,lineHeight:1.6}}>{ins.summary}</p>
        </div>
      )}

      {result && ins.status==='completed' && <ResultRenderer type={ins.insight_type} result={result} />}
    </div>
  );
}

function ResultRenderer({ type, result }) {
  if (!result || result.raw) {
    return <pre style={{background:'var(--color-background-secondary)',padding:'1rem',borderRadius:'var(--border-radius-md)',fontSize:'13px',whiteSpace:'pre-wrap',overflow:'auto'}}>{result?.raw || JSON.stringify(result,null,2)}</pre>;
  }

  const Card = ({title,children}) => (
    <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1.25rem',marginBottom:'1rem'}}>
      <h3 style={{fontSize:'14px',fontWeight:500,margin:'0 0 1rem',color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'0.05em'}}>{title}</h3>
      {children}
    </div>
  );
  const RiskBadge = ({level}) => {
    const c = level==='high'?'var(--color-text-danger)':level==='medium'?'var(--color-text-warning)':'var(--color-text-success)';
    const bg = level==='high'?'var(--color-background-danger)':level==='medium'?'var(--color-background-warning)':'var(--color-background-success)';
    return <span style={{background:bg,color:c,fontSize:'11px',padding:'2px 6px',borderRadius:'var(--border-radius-md)',textTransform:'capitalize'}}>{level}</span>;
  };

  if (type==='spend_forecast') return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'1rem'}}>
        {(result.forecast||[]).map((m,i)=>(
          <div key={i} style={{background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',padding:'1rem',textAlign:'center'}}>
            <p style={{fontSize:'12px',color:'var(--color-text-secondary)',margin:'0 0 4px'}}>{m.month}</p>
            <p style={{fontSize:'20px',fontWeight:500,margin:'0 0 4px'}}>{fmtINR(m.predicted_spend)}</p>
            <p style={{fontSize:'11px',color:'var(--color-text-tertiary)',margin:0}}>{fmtINR(m.low)} – {fmtINR(m.high)}</p>
          </div>
        ))}
      </div>
      {result.key_drivers?.length>0 && <Card title="Key drivers">{result.key_drivers.map((d,i)=><p key={i} style={{fontSize:'13px',margin:'4px 0',color:'var(--color-text-secondary)'}}>• {d}</p>)}</Card>}
    </div>
  );

  if (type==='vendor_risk') return (
    <Card title={`Vendor risk matrix (${(result.risk_matrix||[]).length} vendors)`}>
      <div style={{display:'grid',gap:'8px'}}>
        {(result.risk_matrix||[]).map((v,i)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'10px',background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)'}}>
            <div><p style={{fontWeight:500,margin:'0 0 4px',fontSize:'14px'}}>{v.vendor}</p>{(v.factors||[]).map((f,j)=><span key={j} style={{fontSize:'12px',color:'var(--color-text-secondary)',display:'inline-block',marginRight:8}}>• {f}</span>)}</div>
            <div style={{textAlign:'right',flexShrink:0,marginLeft:12}}><RiskBadge level={v.risk_level}/>{v.score!=null&&<p style={{fontSize:'12px',color:'var(--color-text-secondary)',margin:'4px 0 0'}}>Score: {v.score}</p>}</div>
          </div>
        ))}
      </div>
      {result.recommendations?.length>0&&<div style={{marginTop:'1rem'}}><p style={{fontSize:'13px',fontWeight:500,marginBottom:'6px'}}>Recommendations</p>{result.recommendations.map((r,i)=><p key={i} style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:'3px 0'}}>→ {r}</p>)}</div>}
    </Card>
  );

  if (type==='savings_opportunity') return (
    <div>
      <div style={{padding:'1rem',background:'var(--color-background-success)',borderRadius:'var(--border-radius-lg)',marginBottom:'1rem',textAlign:'center'}}>
        <p style={{fontSize:'12px',color:'var(--color-text-success)',margin:'0 0 4px'}}>Total annual savings potential</p>
        <p style={{fontSize:'28px',fontWeight:500,margin:0,color:'var(--color-text-success)'}}>{fmtINR(result.total_annual_saving)}</p>
      </div>
      <Card title="Opportunities">
        <div style={{display:'grid',gap:'8px'}}>
          {(result.opportunities||[]).map((o,i)=>(
            <div key={i} style={{padding:'10px',background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><p style={{fontWeight:500,margin:'0 0 2px',fontSize:'13px'}}>{o.category}</p><p style={{fontSize:'12px',color:'var(--color-text-secondary)',margin:0,textTransform:'capitalize'}}>{o.method?.replace('_',' ')}</p></div>
              <div style={{textAlign:'right'}}><p style={{fontWeight:500,margin:0,color:'var(--color-text-success)'}}>{fmtINR(o.potential_saving)}</p><p style={{fontSize:'12px',color:'var(--color-text-secondary)',margin:0}}>{o.saving_pct}% savings</p></div>
            </div>
          ))}
        </div>
        {result.priority_actions?.length>0&&<div style={{marginTop:'1rem'}}>{result.priority_actions.map((a,i)=><p key={i} style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:'3px 0'}}>→ {a}</p>)}</div>}
      </Card>
    </div>
  );

  // Generic renderer for all other types
  return (
    <div>
      {Object.entries(result).filter(([k])=>k!=='summary').map(([key,val])=>(
        <Card key={key} title={key.replace(/_/g,' ')}>
          {Array.isArray(val) ? (
            val.map((item,i)=>(
              <div key={i} style={{padding:'8px 10px',background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',marginBottom:'6px',fontSize:'13px'}}>
                {typeof item==='object' ? Object.entries(item).map(([k,v])=>(
                  <span key={k} style={{marginRight:16,color:'var(--color-text-secondary)'}}><strong style={{color:'var(--color-text-primary)'}}>{k.replace(/_/g,' ')}:</strong> {String(v)}</span>
                )) : String(item)}
              </div>
            ))
          ) : typeof val==='object' ? (
            <pre style={{fontSize:'12px',margin:0,whiteSpace:'pre-wrap'}}>{JSON.stringify(val,null,2)}</pre>
          ) : (
            <p style={{fontSize:'14px',margin:0}}>{String(val)}</p>
          )}
        </Card>
      ))}
    </div>
  );
}
