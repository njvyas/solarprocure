import React, { useState, useEffect, useCallback } from 'react';
import { vendorsAPI, apiCall} from '../utils/api';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_STYLE = {
  approved:          { bg:'var(--color-background-success)', color:'var(--color-text-success)' },
  pending:           { bg:'var(--color-background-warning)', color:'var(--color-text-warning)' },
  rejected:          { bg:'var(--color-background-danger)',  color:'var(--color-text-danger)'  },
  changes_requested: { bg:'var(--color-background-info)',    color:'var(--color-text-info)'    },
};

}

export default function VendorsPage() {
  const { can } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [reviewing, setReviewing] = useState(null); // { vendor, action }
  const [reviewNote, setReviewNote] = useState('');
  const [reviewErr, setReviewErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit:20 });
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('search', search);
    const [vRes, sRes] = await Promise.all([
      apiCall(`/vendors?${params}`),
      apiCall('/vendors/stats'),
    ]);
    setVendors(vRes.data || []);
    setTotal(vRes.meta?.pagination?.total || 0);
    setStats(sRes.data || {});
    setLoading(false);
  }, [page, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const handleReview = async () => {
    setReviewErr('');
    const { vendor, action } = reviewing;
    const body = { action };
    if (action === 'reject') body.reason = reviewNote;
    if (action === 'request_changes') body.note = reviewNote;
    const res = await apiCall(`/vendors/${vendor.id}/review`, { method:'POST', body:JSON.stringify(body) });
    if (!res.success) { setReviewErr(res.error); return; }
    setReviewing(null); setReviewNote('');
    load();
  };

  if (!can('vendors','read')) return <div style={{ color:'var(--color-text-danger)' }}>Access denied</div>;

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:500, margin:'0 0 4px' }}>Vendors</h1>
          <p style={{ color:'var(--color-text-secondary)', fontSize:'14px', margin:0 }}>{total} total</p>
        </div>
        <a href="/vendor-register" target="_blank" style={{ padding:'8px 16px', textDecoration:'none', border:'0.5px solid var(--color-border-secondary)', borderRadius:'var(--border-radius-md)', fontSize:'14px', color:'var(--color-text-primary)' }}>
          Registration link ↗
        </a>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'12px', marginBottom:'1.5rem' }}>
        {['pending','approved','rejected','changes_requested'].map(s => (
          <div key={s} onClick={() => { setStatusFilter(p=>p===s?'':s); setPage(1); }} style={{ background:'var(--color-background-secondary)', borderRadius:'var(--border-radius-md)', padding:'1rem', cursor:'pointer', border:`0.5px solid ${statusFilter===s?'var(--color-border-secondary)':'transparent'}` }}>
            <p style={{ fontSize:'13px', color:'var(--color-text-secondary)', margin:'0 0 4px', textTransform:'capitalize' }}>{s.replace('_',' ')}</p>
            <p style={{ fontSize:'24px', fontWeight:500, margin:0 }}>{stats[s]||0}</p>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'8px', marginBottom:'1rem' }}>
        <input placeholder="Search company, email, GST..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} style={{ flex:1 }} />
        <select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1);}} style={{ width:180 }}>
          <option value="">All statuses</option>
          {['pending','approved','rejected','changes_requested'].map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
      </div>

      <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'14px', tableLayout:'fixed' }}>
          <thead>
            <tr style={{ background:'var(--color-background-secondary)' }}>
              {['Company','Contact','Categories','GST','Status','Actions'].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:500, fontSize:'12px', color:'var(--color-text-secondary)', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding:'2rem', textAlign:'center', color:'var(--color-text-secondary)' }}>Loading...</td></tr>
            ) : vendors.map(v=>{
              const st = STATUS_STYLE[v.status]||STATUS_STYLE.pending;
              return (
                <tr key={v.id} style={{ borderBottom:'0.5px solid var(--color-border-tertiary)', cursor:'pointer' }} onClick={()=>navigate(`/vendors/${v.id}`)}>
                  <td style={{ padding:'10px 14px', fontWeight:500 }}>{v.company_name}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <p style={{ margin:'0 0 2px', fontSize:'13px' }}>{v.contact_name}</p>
                    <p style={{ margin:0, fontSize:'12px', color:'var(--color-text-secondary)' }}>{v.contact_email}</p>
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:'12px', color:'var(--color-text-secondary)' }}>
                    {(v.product_categories||[]).join(', ')||'—'}
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:'12px', fontFamily:'monospace' }}>{v.gst_number||'—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ ...st, fontSize:'12px', padding:'2px 8px', borderRadius:'var(--border-radius-md)' }}>{v.status.replace('_',' ')}</span>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    {can('vendors','approve') && v.status==='pending' && (
                      <div style={{ display:'flex', gap:'4px' }}>
                        <button onClick={()=>{setReviewing({vendor:v,action:'approve'});setReviewNote('');}} style={{ padding:'4px 8px', fontSize:'12px', color:'var(--color-text-success)' }}>Approve</button>
                        <button onClick={()=>{setReviewing({vendor:v,action:'reject'});setReviewNote('');}} style={{ padding:'4px 8px', fontSize:'12px', color:'var(--color-text-danger)' }}>Reject</button>
                        <button onClick={()=>{setReviewing({vendor:v,action:'request_changes'});setReviewNote('');}} style={{ padding:'4px 8px', fontSize:'12px' }}>Changes</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total>20 && (
        <div style={{ display:'flex', gap:'8px', marginTop:'1rem', justifyContent:'flex-end' }}>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>Previous</button>
          <span style={{ padding:'8px 12px', fontSize:'13px', color:'var(--color-text-secondary)' }}>Page {page} of {Math.ceil(total/20)}</span>
          <button onClick={()=>setPage(p=>p+1)} disabled={page*20>=total}>Next</button>
        </div>
      )}

      {/* Review modal */}
      {reviewing && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', padding:'1.5rem', width:420, maxWidth:'90vw' }}>
            <h3 style={{ fontSize:'16px', fontWeight:500, margin:'0 0 1rem', textTransform:'capitalize' }}>
              {reviewing.action.replace('_',' ')}: {reviewing.vendor.company_name}
            </h3>
            {reviewErr && <p style={{ color:'var(--color-text-danger)', fontSize:'13px', marginBottom:'0.5rem' }}>{reviewErr}</p>}
            {(reviewing.action==='reject'||reviewing.action==='request_changes') && (
              <div style={{ marginBottom:'1rem' }}>
                <label style={{ display:'block', fontSize:'13px', color:'var(--color-text-secondary)', marginBottom:'4px' }}>
                  {reviewing.action==='reject' ? 'Rejection reason *' : 'Change request note *'}
                </label>
                <textarea value={reviewNote} onChange={e=>setReviewNote(e.target.value)} rows={3} style={{ width:'100%', boxSizing:'border-box', resize:'vertical' }} />
              </div>
            )}
            {reviewing.action==='approve' && (
              <p style={{ fontSize:'14px', color:'var(--color-text-secondary)', marginBottom:'1rem' }}>
                Approve this vendor? They will be able to receive RFQs.
              </p>
            )}
            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
              <button onClick={()=>setReviewing(null)}>Cancel</button>
              <button onClick={handleReview}
                disabled={reviewing.action!=='approve' && !reviewNote}
                style={{ background:'var(--color-text-primary)', color:'var(--color-background-primary)', border:'none', borderRadius:'var(--border-radius-md)', padding:'8px 16px', cursor:'pointer', opacity:reviewing.action!=='approve'&&!reviewNote?0.5:1 }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
