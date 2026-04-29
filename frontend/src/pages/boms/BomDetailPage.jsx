import React, { useState, useEffect, useCallback } from 'react';
import { bomsAPI, apiCall} from '../utils/api';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const fmt = (n) => n!=null ? parseFloat(n).toLocaleString('en-IN',{maximumFractionDigits:2}) : '—';
const fmtINR = (n) => n!=null ? `₹${parseFloat(n).toLocaleString('en-IN',{maximumFractionDigits:0})}` : '—';

export default function BomDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [bom, setBom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingItem, setAddingItem] = useState(false);
  const [importMode, setImportMode] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [newItem, setNewItem] = useState({ category:'Solar Modules', description:'', unit:'Nos', quantity:'', unitRate:'', lineNumber:'' });
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiCall(`/boms/${id}`);
    setBom(res.data); setLoading(false);
  },[id]);
  useEffect(()=>{load();},[load]);

  const publish = async () => {
    const res = await apiCall(`/boms/${id}/publish`,{method:'POST'});
    if (!res.success) { setErr(res.error); return; }
    load();
  };

  const archive = async () => {
    if (!confirm('Archive this BOM?')) return;
    await apiCall(`/boms/${id}/archive`,{method:'POST'}); load();
  };

  const addItem = async () => {
    const res = await apiCall(`/boms/${id}/items`,{method:'POST',body:JSON.stringify({items:[{...newItem,quantity:parseFloat(newItem.quantity),unitRate:newItem.unitRate?parseFloat(newItem.unitRate):null,lineNumber:parseInt(newItem.lineNumber)||(bom?.items?.length+1||1)}]})});
    if (!res.success){setErr(res.error);return;}
    setAddingItem(false); setNewItem({category:'Solar Modules',description:'',unit:'Nos',quantity:'',unitRate:'',lineNumber:''});
    load();
  };

  const deleteItem = async (itemId) => {
    await apiCall(`/boms/${id}/items/${itemId}`,{method:'DELETE'}); load();
  };

  const runImport = async () => {
    try {
      const rows = JSON.parse(importJson);
      const res = await apiCall(`/boms/${id}/import`,{method:'POST',body:JSON.stringify({rows})});
      if (!res.success){setErr(res.error);return;}
      setImportMode(false); setImportJson(''); load();
    } catch(e){setErr('Invalid JSON: '+e.message);}
  };

  if (loading) return <div style={{padding:'2rem',color:'var(--color-text-secondary)'}}>Loading...</div>;
  if (!bom) return <div style={{padding:'2rem',color:'var(--color-text-danger)'}}>BOM not found</div>;

  const isDraft = bom.status==='draft';
  const STATUS_COLOR = {draft:'var(--color-text-warning)',published:'var(--color-text-success)',archived:'var(--color-text-secondary)'};

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1.5rem'}}>
        <div>
          <Link to="/boms" style={{fontSize:'13px',color:'var(--color-text-secondary)',textDecoration:'none'}}>← BOMs</Link>
          <h1 style={{fontSize:'22px',fontWeight:500,margin:'4px 0'}}>{bom.name}</h1>
          <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
            <span style={{fontSize:'13px',color:STATUS_COLOR[bom.status]}}>{bom.status}</span>
            {bom.project_name && <span style={{fontSize:'13px',color:'var(--color-text-secondary)'}}>{bom.project_name}</span>}
            {bom.capacity_mw && <span style={{fontSize:'13px',color:'var(--color-text-secondary)'}}>{bom.capacity_mw} MW</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          {isDraft && can('boms','update') && (
            <>
              <button onClick={()=>setAddingItem(true)}>+ Add item</button>
              <button onClick={()=>setImportMode(true)}>Import JSON</button>
              <button onClick={publish} style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer'}}>Publish</button>
            </>
          )}
          {bom.status==='published' && can('boms','update') && (
            <button onClick={archive} style={{color:'var(--color-text-secondary)'}}>Archive</button>
          )}
        </div>
      </div>

      {err && <div style={{padding:'10px',marginBottom:'1rem',background:'var(--color-background-danger)',color:'var(--color-text-danger)',borderRadius:'var(--border-radius-md)',fontSize:'13px'}}>{err}</div>}

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'1.5rem'}}>
        {[['Total items',bom.items?.length||0,''],['Total cost',fmtINR(bom.total_estimated_cost),''],['Version',`v${bom.version}`,''],['Currency',bom.currency,'']].map(([l,v])=>(
          <div key={l} style={{background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',padding:'1rem'}}>
            <p style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:'0 0 4px'}}>{l}</p>
            <p style={{fontSize:'18px',fontWeight:500,margin:0}}>{v}</p>
          </div>
        ))}
      </div>

      {/* Items table */}
      <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px',tableLayout:'auto',minWidth:900}}>
          <thead><tr style={{background:'var(--color-background-secondary)'}}>
            {['#','Category','Description','Make/Model','Unit','Qty','Unit Rate','Total',''].map(h=>(
              <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)',whiteSpace:'nowrap'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {(!bom.items||bom.items.length===0) ? (
              <tr><td colSpan={9} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)'}}>No items yet. Add items or import from JSON.</td></tr>
            ) : bom.items.map(item=>(
              <tr key={item.id} style={{borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                <td style={{padding:'8px 12px',color:'var(--color-text-secondary)'}}>{item.line_number}</td>
                <td style={{padding:'8px 12px'}}><span style={{fontSize:'11px',background:'var(--color-background-info)',color:'var(--color-text-info)',padding:'2px 6px',borderRadius:'var(--border-radius-md)'}}>{item.category}</span></td>
                <td style={{padding:'8px 12px',maxWidth:280}}>{item.description}</td>
                <td style={{padding:'8px 12px',color:'var(--color-text-secondary)',fontSize:'12px'}}>{item.make_model||'—'}</td>
                <td style={{padding:'8px 12px'}}>{item.unit}</td>
                <td style={{padding:'8px 12px',textAlign:'right'}}>{fmt(item.quantity)}</td>
                <td style={{padding:'8px 12px',textAlign:'right'}}>{fmtINR(item.unit_rate)}</td>
                <td style={{padding:'8px 12px',textAlign:'right',fontWeight:500}}>{fmtINR(item.total_amount)}</td>
                <td style={{padding:'8px 12px'}}>
                  {isDraft && can('boms','delete') && (
                    <button onClick={()=>deleteItem(item.id)} style={{padding:'2px 8px',fontSize:'12px',color:'var(--color-text-danger)'}}>✕</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {bom.total_estimated_cost && (
            <tfoot><tr style={{background:'var(--color-background-secondary)'}}>
              <td colSpan={7} style={{padding:'10px 12px',textAlign:'right',fontWeight:500,fontSize:'13px'}}>Total Estimated Cost</td>
              <td style={{padding:'10px 12px',textAlign:'right',fontWeight:500}}>{fmtINR(bom.total_estimated_cost)}</td>
              <td></td>
            </tr></tfoot>
          )}
        </table>
      </div>

      {/* Add item panel */}
      {addingItem && (
        <div style={{marginTop:'1rem',background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1.5rem'}}>
          <h3 style={{fontSize:'14px',fontWeight:500,margin:'0 0 1rem'}}>Add item</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:'8px'}}>
            {[['lineNumber','Line #','number'],['category','Category','text'],['description','Description','text'],['makeModel','Make/Model','text'],['unit','Unit','text'],['quantity','Quantity','number'],['unitRate','Unit rate (₹)','number']].map(([k,l,t])=>(
              <div key={k}>
                <label style={{display:'block',fontSize:'12px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>{l}</label>
                <input value={newItem[k]||''} onChange={e=>setNewItem(p=>({...p,[k]:e.target.value}))} type={t} style={{width:'100%',boxSizing:'border-box'}} />
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={addItem} disabled={!newItem.description||!newItem.quantity} style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer',opacity:!newItem.description||!newItem.quantity?0.5:1}}>Add</button>
            <button onClick={()=>setAddingItem(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Import JSON panel */}
      {importMode && (
        <div style={{marginTop:'1rem',background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1.5rem'}}>
          <h3 style={{fontSize:'14px',fontWeight:500,margin:'0 0 0.5rem'}}>Import items from JSON</h3>
          <p style={{fontSize:'12px',color:'var(--color-text-secondary)',marginBottom:'0.75rem'}}>Paste array of objects with: line_number, category, description, unit, quantity, unit_rate</p>
          <textarea value={importJson} onChange={e=>setImportJson(e.target.value)} rows={8} style={{width:'100%',boxSizing:'border-box',fontFamily:'monospace',fontSize:'12px',resize:'vertical'}} placeholder='[{"line_number":1,"category":"Solar Modules","description":"550Wp Module","unit":"Nos","quantity":1000,"unit_rate":12500}]' />
          <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
            <button onClick={runImport} disabled={!importJson} style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer'}}>Import</button>
            <button onClick={()=>{setImportMode(false);setImportJson('');}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
