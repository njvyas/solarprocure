import React, { useState, useEffect, useCallback } from 'react';
import { aiAPI, apiCall} from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';


const INSIGHT_TYPES = [
  { value:'spend_forecast',      label:'Spend Forecast',          icon:'📈', desc:'3-month procurement spend prediction with confidence intervals' },
  { value:'vendor_risk',         label:'Vendor Risk Analysis',    icon:'⚠️',  desc:'Identify high-risk vendors: concentration, compliance, performance' },
  { value:'rfq_optimization',    label:'RFQ Optimization',        icon:'🎯', desc:'Improve vendor participation and quote quality in RFQs' },
  { value:'price_benchmark',     label:'Price Benchmarking',      icon:'💰', desc:'Compare your prices against norms, find negotiation opportunities' },
  { value:'po_anomaly',          label:'PO Anomaly Detection',    icon:'🔍', desc:'Detect unusual patterns in purchase orders and approvals' },
  { value:'vendor_recommendation',label:'Vendor Recommendations', icon:'⭐', desc:'Best-fit vendor suggestions by category and performance' },
  { value:'savings_opportunity', label:'Savings Opportunities',   icon:'💡', desc:'Identify consolidation, timing, and negotiation savings' },
  { value:'compliance_risk',     label:'Compliance Risk',         icon:'🛡️',  desc:'Certification expiry risks and vendor compliance gaps' },
];

const ST_C = {
  pending:   {bg:'var(--color-background-secondary)', c:'var(--color-text-secondary)'},
  running:   {bg:'var(--color-background-info)',      c:'var(--color-text-info)'},
  completed: {bg:'var(--color-background-success)',   c:'var(--color-text-success)'},
  failed:    {bg:'var(--color-background-danger)',    c:'var(--color-text-danger)'},
};

function InsightCard({ insight, onView }) {
  const it = INSIGHT_TYPES.find(t => t.value === insight.insight_type);
  const sc = ST_C[insight.status] || ST_C.pending;
  return (
    <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1rem',cursor:'pointer'}} onClick={()=>onView(insight.id)}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'8px'}}>
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
          <span style={{fontSize:'18px'}}>{it?.icon||'🤖'}</span>
          <div>
            <p style={{fontWeight:500,margin:'0 0 2px',fontSize:'14px'}}>{it?.label || insight.insight_type}</p>
            <p style={{fontSize:'12px',color:'var(--color-text-secondary)',margin:0}}>{new Date(insight.created_at).toLocaleString()}</p>
          </div>
        </div>
        <span style={{...sc,fontSize:'11px',padding:'2px 6px',borderRadius:'var(--border-radius-md)',flexShrink:0}}>{insight.status}</span>
      </div>
      {insight.summary && <p style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:0,lineHeight:1.5}}>{insight.summary.slice(0,150)}{insight.summary.length>150?'...':''}</p>}
      {insight.status==='running' && <p style={{fontSize:'12px',color:'var(--color-text-info)',margin:'6px 0 0'}}>⟳ Generating... Auto-refreshes</p>}
      {insight.status==='failed' && <p style={{fontSize:'12px',color:'var(--color-text-danger)',margin:'6px 0 0'}}>{insight.error_message}</p>}
    </div>
  );
}

export default function AiInsightsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [insights, setInsights] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(null);
  const [err, setErr] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit:20 });
    if (typeFilter) params.set('type', typeFilter);
    const res = await apiCall(`/ai/insights?${params}`);
    setInsights(res.data || []);
    setTotal(res.meta?.pagination?.total || 0);
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  // Poll if any are running
  useEffect(() => {
    const hasRunning = insights.some(i => ['pending','running'].includes(i.status));
    if (!hasRunning) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [insights, load]);

  const generate = async (insightType) => {
    if (!can('ai','use')) { setErr('No permission to use AI'); return; }
    setErr(''); setRunning(insightType);
    const res = await apiCall('/ai/insights', { method:'POST', body:JSON.stringify({ insightType }) });
    setRunning(null);
    if (!res.success) { setErr(res.error); return; }
    load();
  };

  return (
    <div>
      <div style={{marginBottom:'1.5rem'}}>
        <h1 style={{fontSize:'22px',fontWeight:500,margin:'0 0 4px'}}>AI Insights</h1>
        <p style={{color:'var(--color-text-secondary)',fontSize:'14px',margin:0}}>AI-powered predictions and analytics based on your procurement data</p>
      </div>

      {err && <div style={{padding:'10px',marginBottom:'1rem',background:'var(--color-background-danger)',color:'var(--color-text-danger)',borderRadius:'var(--border-radius-md)',fontSize:'13px'}}>{err}</div>}

      {/* Insight type cards */}
      {can('ai','use') && (
        <div style={{marginBottom:'2rem'}}>
          <h2 style={{fontSize:'15px',fontWeight:500,marginBottom:'1rem',color:'var(--color-text-secondary)'}}>Generate new insight</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'10px'}}>
            {INSIGHT_TYPES.map(it => (
              <button key={it.value} onClick={()=>generate(it.value)} disabled={running===it.value}
                style={{padding:'1rem',background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',cursor:'pointer',textAlign:'left',transition:'border-color 0.15s',opacity:running&&running!==it.value?0.6:1}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
                  <span style={{fontSize:'20px'}}>{it.icon}</span>
                  {running===it.value && <span style={{fontSize:'11px',color:'var(--color-text-info)'}}>⟳ Running</span>}
                </div>
                <p style={{fontSize:'13px',fontWeight:500,margin:'0 0 4px'}}>{it.label}</p>
                <p style={{fontSize:'12px',color:'var(--color-text-secondary)',margin:0,lineHeight:1.4}}>{it.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
        <h2 style={{fontSize:'15px',fontWeight:500,margin:0,color:'var(--color-text-secondary)'}}>History ({total})</h2>
        <select value={typeFilter} onChange={e=>{setTypeFilter(e.target.value);}} style={{width:200,fontSize:'13px'}}>
          <option value="">All insight types</option>
          {INSIGHT_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {loading ? <p style={{color:'var(--color-text-secondary)'}}>Loading...</p>
      : insights.length===0 ? <p style={{color:'var(--color-text-secondary)',textAlign:'center',padding:'2rem'}}>No insights generated yet. Click any card above to generate your first insight.</p>
      : (
        <div style={{display:'grid',gap:'10px'}}>
          {insights.map(ins => <InsightCard key={ins.id} insight={ins} onView={id=>navigate(`/ai/insights/${id}`)} />)}
        </div>
      )}
    </div>
  );
}
