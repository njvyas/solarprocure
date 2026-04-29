import React, { useState, useEffect, useCallback } from 'react';
import { backupAPI, apiCall} from '../utils/api';
import { useAuth } from '../../contexts/AuthContext';


const ST_C = {
  pending:   {bg:'var(--color-background-secondary)', c:'var(--color-text-secondary)'},
  running:   {bg:'var(--color-background-info)',      c:'var(--color-text-info)'},
  completed: {bg:'var(--color-background-success)',   c:'var(--color-text-success)'},
  failed:    {bg:'var(--color-background-danger)',    c:'var(--color-text-danger)'},
  expired:   {bg:'var(--color-background-secondary)', c:'var(--color-text-tertiary)'},
};

const fmtSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes > 1073741824) return `${(bytes/1073741824).toFixed(1)} GB`;
  if (bytes > 1048576)    return `${(bytes/1048576).toFixed(1)} MB`;
  return `${(bytes/1024).toFixed(0)} KB`;
};

export default function BackupPage() {
  const { can } = useAuth();
  const [backups, setBackups] = useState([]);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState('backups');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [backupType, setBackupType] = useState('full');
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');
  const [restoring, setRestoring] = useState(null); // { backupId, jobId, token }
  const [confirmToken, setConfirmToken] = useState('');
  const [validations, setValidations] = useState({});
  const [restoreHistory, setRestoreHistory] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiCall('/backup?limit=25');
    setBackups(r.data || []); setTotal(r.meta?.pagination?.total || 0);
    setLoading(false);
  }, []);

  const loadRestores = useCallback(async () => {
    const r = await apiCall('/backup/restores');
    setRestoreHistory(r.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'restores') loadRestores(); }, [tab, loadRestores]);

  // Poll running backups
  useEffect(() => {
    const running = backups.filter(b => ['pending','running'].includes(b.status));
    if (!running.length) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [backups, load]);

  const triggerBackup = async () => {
    setErr(''); setSuccess('');
    setCreating(true);
    const res = await apiCall('/backup', { method:'POST', body:JSON.stringify({ backupType }) });
    setCreating(false);
    if (!res.success) { setErr(res.error); return; }
    setSuccess(`Backup job ${res.data.id.slice(0,8)}... started. Refreshing...`);
    setTimeout(load, 2000);
  };

  const validateBackup = async (id) => {
    const res = await apiCall(`/backup/${id}/validate`);
    if (res.success) setValidations(v => ({ ...v, [id]: res.data }));
  };

  const initiateRestore = async (backupId) => {
    setErr('');
    const res = await apiCall(`/backup/${backupId}/restore`, { method:'POST', body:JSON.stringify({ restoreScope:'full' }) });
    if (!res.success) { setErr(res.error); return; }
    setRestoring({ backupId, jobId: res.data.restoreJobId, token: res.data.confirmationToken });
  };

  const confirmRestore = async () => {
    if (!confirmToken) { setErr('Enter confirmation token'); return; }
    setErr('');
    const res = await apiCall(`/backup/restore/${restoring.jobId}/confirm`, {
      method:'POST',
      body: JSON.stringify({ confirmationToken: confirmToken })
    });
    if (!res.success) { setErr(res.error); return; }
    setRestoring(null); setConfirmToken('');
    setSuccess('Restore started. Monitor status in the Restores tab.');
    setTab('restores');
  };

  if (!can('backup','read')) return <p style={{color:'var(--color-text-danger)'}}>Access denied: requires backup:read</p>;

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:500,margin:'0 0 4px'}}>Backup & Restore</h1>
          <p style={{color:'var(--color-text-secondary)',fontSize:'14px',margin:0}}>{total} backup records</p>
        </div>
        {can('backup','create') && (
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            <select value={backupType} onChange={e=>setBackupType(e.target.value)} style={{fontSize:'13px',padding:'6px 8px'}}>
              <option value="full">Full (DB + Files)</option>
              <option value="database">Database only</option>
              <option value="files">Files only</option>
            </select>
            <button onClick={triggerBackup} disabled={creating}
              style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer',opacity:creating?0.6:1}}>
              {creating ? 'Starting...' : '+ New backup'}
            </button>
          </div>
        )}
      </div>

      {err && <div style={{padding:'10px',marginBottom:'1rem',background:'var(--color-background-danger)',color:'var(--color-text-danger)',borderRadius:'var(--border-radius-md)',fontSize:'13px'}}>{err}</div>}
      {success && <div style={{padding:'10px',marginBottom:'1rem',background:'var(--color-background-success)',color:'var(--color-text-success)',borderRadius:'var(--border-radius-md)',fontSize:'13px'}}>{success}</div>}

      {/* Info banner */}
      <div style={{padding:'12px 16px',marginBottom:'1.5rem',background:'var(--color-background-info)',border:'0.5px solid var(--color-border-info)',borderRadius:'var(--border-radius-md)',fontSize:'13px',color:'var(--color-text-info)'}}>
        Backups run automatically every 24 hours. Manual backups can be triggered any time. Backups are retained for {30} days.
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:'4px',marginBottom:'1.5rem',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
        {['backups','restores'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'8px 16px',background:'none',border:'none',borderBottom:`2px solid ${tab===t?'var(--color-text-primary)':'transparent'}`,color:tab===t?'var(--color-text-primary)':'var(--color-text-secondary)',cursor:'pointer',fontSize:'14px',textTransform:'capitalize'}}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'backups' && (
        <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px',tableLayout:'fixed'}}>
            <thead><tr style={{background:'var(--color-background-secondary)'}}>
              {['ID','Type','Trigger','DB size','Files size','Created','Status','Actions'].map(h=>(
                <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)'}}>Loading...</td></tr>
              : backups.length === 0 ? <tr><td colSpan={8} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)'}}>No backups yet. Trigger one above.</td></tr>
              : backups.map(b => {
                const sc = ST_C[b.status] || ST_C.pending;
                const val = validations[b.id];
                const totalSize = (b.db_size_bytes||0) + (b.files_size_bytes||0);
                return (
                  <tr key={b.id} style={{borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                    <td style={{padding:'10px 12px',fontFamily:'monospace',fontSize:'11px',color:'var(--color-text-secondary)'}}>{b.id.slice(0,8)}...</td>
                    <td style={{padding:'10px 12px',textTransform:'capitalize'}}>{b.backup_type}</td>
                    <td style={{padding:'10px 12px',fontSize:'12px',color:'var(--color-text-secondary)',textTransform:'capitalize'}}>{b.trigger_type}</td>
                    <td style={{padding:'10px 12px',fontSize:'12px'}}>{fmtSize(b.db_size_bytes)}</td>
                    <td style={{padding:'10px 12px',fontSize:'12px'}}>{fmtSize(b.files_size_bytes)}</td>
                    <td style={{padding:'10px 12px',fontSize:'12px',color:'var(--color-text-secondary)',whiteSpace:'nowrap'}}>{new Date(b.created_at).toLocaleString()}</td>
                    <td style={{padding:'10px 12px'}}>
                      <span style={{...sc,fontSize:'11px',padding:'2px 6px',borderRadius:'var(--border-radius-md)'}}>{b.status}</span>
                      {val && <span style={{display:'block',fontSize:'11px',marginTop:'2px',color:val.valid?'var(--color-text-success)':'var(--color-text-danger)'}}>{val.valid?'✓ Valid':'✗ Corrupt'}</span>}
                    </td>
                    <td style={{padding:'10px 12px'}}>
                      {b.status === 'completed' && (
                        <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                          <button onClick={()=>validateBackup(b.id)} style={{padding:'3px 8px',fontSize:'11px'}}>Validate</button>
                          {can('backup','restore') && (
                            <button onClick={()=>initiateRestore(b.id)} style={{padding:'3px 8px',fontSize:'11px',color:'var(--color-text-warning)'}}>Restore</button>
                          )}
                        </div>
                      )}
                      {['pending','running'].includes(b.status) && (
                        <span style={{fontSize:'11px',color:'var(--color-text-info)'}}>⟳ Running...</span>
                      )}
                      {b.status === 'failed' && b.error_message && (
                        <span style={{fontSize:'11px',color:'var(--color-text-danger)',display:'block',maxWidth:'120px',overflow:'hidden',textOverflow:'ellipsis'}} title={b.error_message}>{b.error_message}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'restores' && (
        <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px',tableLayout:'fixed'}}>
            <thead><tr style={{background:'var(--color-background-secondary)'}}>
              {['Restore ID','Backup','Scope','Triggered by','Status','Completed'].map(h=>(
                <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {restoreHistory.length === 0
                ? <tr><td colSpan={6} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)'}}>No restore history</td></tr>
                : restoreHistory.map(r => {
                  const sc = ST_C[r.status] || ST_C.pending;
                  return (
                    <tr key={r.id} style={{borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                      <td style={{padding:'10px 12px',fontFamily:'monospace',fontSize:'11px',color:'var(--color-text-secondary)'}}>{r.id.slice(0,8)}...</td>
                      <td style={{padding:'10px 12px',fontFamily:'monospace',fontSize:'11px'}}>{r.backup_job_id.slice(0,8)}...</td>
                      <td style={{padding:'10px 12px',textTransform:'capitalize',fontSize:'12px'}}>{r.restore_scope}</td>
                      <td style={{padding:'10px 12px',fontSize:'12px'}}>{r.triggered_by_name || '—'}</td>
                      <td style={{padding:'10px 12px'}}><span style={{...sc,fontSize:'11px',padding:'2px 6px',borderRadius:'var(--border-radius-md)'}}>{r.status}</span></td>
                      <td style={{padding:'10px 12px',fontSize:'12px',color:'var(--color-text-secondary)'}}>{r.completed_at ? new Date(r.completed_at).toLocaleString() : '—'}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Restore confirmation modal */}
      {restoring && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-danger)',borderRadius:'var(--border-radius-lg)',padding:'1.5rem',width:480,maxWidth:'90vw'}}>
            <h3 style={{fontSize:'16px',fontWeight:500,margin:'0 0 0.5rem',color:'var(--color-text-danger)'}}>⚠ Confirm restore</h3>
            <p style={{fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'1rem'}}>
              This will overwrite current database and files with backup <code>{restoring.backupId.slice(0,8)}...</code>.
              <strong> This action cannot be undone.</strong>
            </p>
            <div style={{marginBottom:'1rem',padding:'12px',background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)'}}>
              <p style={{fontSize:'12px',color:'var(--color-text-secondary)',margin:'0 0 6px'}}>Confirmation token (copy this):</p>
              <code style={{fontSize:'12px',wordBreak:'break-all'}}>{restoring.token}</code>
            </div>
            <div style={{marginBottom:'1rem'}}>
              <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'4px'}}>Paste confirmation token to proceed:</label>
              <input value={confirmToken} onChange={e=>setConfirmToken(e.target.value)}
                placeholder="Paste token here..." style={{width:'100%',boxSizing:'border-box'}} />
            </div>
            {err && <p style={{color:'var(--color-text-danger)',fontSize:'13px',margin:'0 0 0.75rem'}}>{err}</p>}
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>{setRestoring(null);setConfirmToken('');setErr('');}}>Cancel</button>
              <button onClick={confirmRestore} disabled={!confirmToken}
                style={{background:'var(--color-text-danger)',color:'#fff',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer',opacity:!confirmToken?0.5:1}}>
                Confirm restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
