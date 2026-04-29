import React, { useState, useEffect, useCallback } from 'react';
import { bomsAPI, apiCall} from '../utils/api';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';


const STATUS_STYLE = {
  draft:     {bg:'var(--color-background-warning)',color:'var(--color-text-warning)'},
  published: {bg:'var(--color-background-success)',color:'var(--color-text-success)'},
  archived:  {bg:'var(--color-background-secondary)',color:'var(--color-text-secondary)'},
};

export default function BomsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [boms, setBoms] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newBom, setNewBom] = useState({ name:'', projectName:'', projectType:'solar_epc', capacityMw:'', location:'' });

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit:20 });
    if (statusFilter) params.set('status',statusFilter);
    const [b,s] = await Promise.all([apiCall(`/boms?${params}`),apiCall('/boms/stats')]);
    setBoms(b.data||[]); setTotal(b.meta?.pagination?.total||0); setStats(s.data||{});
    setLoading(false);
  },[page,statusFilter]);

  useEffect(()=>{load();},[load]);

  const createBom = async () => {
    const res = await apiCall('/boms',{method:'POST',body:JSON.stringify(newBom)});
    if (res.success) { navigate(`/boms/${res.data.id}`); }
  };

  if (!can('boms','read')) return <div style={{color:'var(--color-text-danger)'}}>Access denied</div>;

  const fmt = (n) => n!=null ? `₹${parseFloat(n).toLocaleString('en-IN',{maximumFractionDigits:0})}` : '—';

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem'}}>
        <div><h1 style={{fontSize:'22px',fontWeight:500,margin:'0 0 4px'}}>Bill of Materials</h1><p style={{color:'var(--color-text-secondary)',fontSize:'14px',margin:0}}>{total} BOMs</p></div>
        {can('boms','create') && <button onClick={()=>setCreating(true)}>+ New BOM</button>}
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'1.5rem'}}>
        {['draft','published','archived'].map(s=>(
          <div key={s} onClick={()=>{setStatusFilter(p=>p===s?'':s);setPage(1);}} style={{background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',padding:'1rem',cursor:'pointer',border:`0.5px solid ${statusFilter===s?'var(--color-border-secondary)':'transparent'}`}}>
            <p style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:'0 0 4px',textTransform:'capitalize'}}>{s}</p>
            <p style={{fontSize:'24px',fontWeight:500,margin:'0 0 2px'}}>{stats[s]?.count||0}</p>
            <p style={{fontSize:'12px',color:'var(--color-text-tertiary)',margin:0}}>{fmt(stats[s]?.value)}</p>
          </div>
        ))}
      </div>

      <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'14px',tableLayout:'fixed'}}>
          <thead><tr style={{background:'var(--color-background-secondary)'}}>
            {['BOM Name','Project','Capacity','Items','Est. Cost','Status'].map(h=>(
              <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)'}}>Loading...</td></tr>
            : boms.map(b=>{
              const st = STATUS_STYLE[b.status]||STATUS_STYLE.draft;
              return (
                <tr key={b.id} style={{borderBottom:'0.5px solid var(--color-border-tertiary)',cursor:'pointer'}} onClick={()=>navigate(`/boms/${b.id}`)}>
                  <td style={{padding:'10px 14px'}}><span style={{color:'var(--color-text-info)',fontWeight:500}}>{b.name}</span></td>
                  <td style={{padding:'10px 14px',color:'var(--color-text-secondary)',fontSize:'13px'}}>{b.project_name||'—'}</td>
                  <td style={{padding:'10px 14px',fontSize:'13px'}}>{b.capacity_mw ? `${b.capacity_mw} MW` : '—'}</td>
                  <td style={{padding:'10px 14px'}}>{b.item_count||0}</td>
                  <td style={{padding:'10px 14px',fontSize:'13px'}}>{fmt(b.total_estimated_cost)}</td>
                  <td style={{padding:'10px 14px'}}><span style={{...st,fontSize:'12px',padding:'2px 8px',borderRadius:'var(--border-radius-md)'}}>{b.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {creating && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1.5rem',width:480,maxWidth:'90vw'}}>
            <h3 style={{fontSize:'16px',fontWeight:500,margin:'0 0 1rem'}}>New BOM</h3>
            {[['name','BOM name *','text'],['projectName','Project name','text'],['location','Location','text'],['capacityMw','Capacity (MW)','number']].map(([k,l,t])=>(
              <div key={k} style={{marginBottom:'0.75rem'}}>
                <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>{l}</label>
                <input value={newBom[k]} onChange={e=>setNewBom(p=>({...p,[k]:e.target.value}))} type={t} style={{width:'100%',boxSizing:'border-box'}} />
              </div>
            ))}
            <div style={{marginBottom:'0.75rem'}}>
              <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>Project type</label>
              <select value={newBom.projectType} onChange={e=>setNewBom(p=>({...p,projectType:e.target.value}))} style={{width:'100%'}}>
                {['solar_epc','bess','hybrid','other'].map(v=><option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'1rem'}}>
              <button onClick={()=>setCreating(false)}>Cancel</button>
              <button onClick={createBom} disabled={!newBom.name} style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer',opacity:!newBom.name?0.5:1}}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
