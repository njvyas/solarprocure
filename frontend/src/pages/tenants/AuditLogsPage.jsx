import React, { useState, useEffect, useCallback } from 'react';
import { tenantsAPI } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

const ACTION_COLORS = {
  'auth.login': 'var(--color-text-success)',
  'auth.login_failed': 'var(--color-text-danger)',
  'auth.logout': 'var(--color-text-secondary)',
};

export default function AuditLogsPage() {
  const { can } = useAuth();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tenantsAPI.auditLogs({ page, limit:25, status: statusFilter||undefined });
      setLogs(data.data); setTotal(data.meta.pagination.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  if (!can('audit','read')) return <div style={{ color:'var(--color-text-danger)' }}>Access denied</div>;

  return (
    <div>
      <div style={{ marginBottom:'1.5rem' }}>
        <h1 style={{ fontSize:'22px', fontWeight:500, margin:'0 0 4px' }}>Audit logs</h1>
        <p style={{ color:'var(--color-text-secondary)', fontSize:'14px', margin:0 }}>{total} entries</p>
      </div>
      <div style={{ marginBottom:'1rem' }}>
        <select value={statusFilter} onChange={(e)=>{ setStatusFilter(e.target.value); setPage(1); }} style={{ width:'160px' }}>
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="unauthorized">Unauthorized</option>
        </select>
      </div>
      <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px', tableLayout:'fixed' }}>
          <thead>
            <tr style={{ background:'var(--color-background-secondary)' }}>
              {['Timestamp','User','Action','Resource','IP','Status'].map((h)=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:500, fontSize:'12px', color:'var(--color-text-secondary)', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding:'2rem', textAlign:'center', color:'var(--color-text-secondary)' }}>Loading...</td></tr>
            ) : logs.map((log)=>(
              <tr key={log.id} style={{ borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
                <td style={{ padding:'10px 14px', color:'var(--color-text-secondary)', whiteSpace:'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                <td style={{ padding:'10px 14px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{log.user_email||'—'}</td>
                <td style={{ padding:'10px 14px' }}><code style={{ fontSize:'12px', color:ACTION_COLORS[log.action]||'var(--color-text-primary)' }}>{log.action}</code></td>
                <td style={{ padding:'10px 14px', color:'var(--color-text-secondary)' }}>{log.resource_type}</td>
                <td style={{ padding:'10px 14px', color:'var(--color-text-secondary)', fontFamily:'monospace', fontSize:'12px' }}>{log.ip_address||'—'}</td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ fontSize:'11px', padding:'2px 6px', borderRadius:'var(--border-radius-md)', background:log.status==='success'?'var(--color-background-success)':log.status==='failure'?'var(--color-background-danger)':'var(--color-background-warning)', color:log.status==='success'?'var(--color-text-success)':log.status==='failure'?'var(--color-text-danger)':'var(--color-text-warning)' }}>{log.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > 25 && (
        <div style={{ display:'flex', gap:'8px', marginTop:'1rem', justifyContent:'flex-end' }}>
          <button onClick={()=>setPage((p)=>Math.max(1,p-1))} disabled={page===1}>Previous</button>
          <span style={{ padding:'8px 12px', fontSize:'13px', color:'var(--color-text-secondary)' }}>Page {page} of {Math.ceil(total/25)}</span>
          <button onClick={()=>setPage((p)=>p+1)} disabled={page*25>=total}>Next</button>
        </div>
      )}
    </div>
  );
}
