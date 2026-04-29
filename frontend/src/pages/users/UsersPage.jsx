import React, { useState, useEffect, useCallback } from 'react';
import { usersAPI } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

function Badge({ status }) {
  const colors = {
    active:   { bg:'var(--color-background-success)', color:'var(--color-text-success)' },
    inactive: { bg:'var(--color-background-warning)', color:'var(--color-text-warning)' },
    locked:   { bg:'var(--color-background-danger)',  color:'var(--color-text-danger)'  },
    pending:  { bg:'var(--color-background-info)',    color:'var(--color-text-info)'    },
  };
  const s = colors[status] || colors.inactive;
  return (
    <span style={{ ...s, fontSize:'12px', padding:'2px 8px', borderRadius:'var(--border-radius-md)' }}>{status}</span>
  );
}

export default function UsersPage() {
  const { can } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await usersAPI.list({ page, limit: 20, search: search || undefined });
      setUsers(data.data);
      setTotal(data.meta.pagination.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  if (!can('users', 'read')) {
    return <div style={{ color:'var(--color-text-danger)' }}>Access denied: requires users:read permission</div>;
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:500, margin:'0 0 4px' }}>Users</h1>
          <p style={{ color:'var(--color-text-secondary)', fontSize:'14px', margin:0 }}>{total} total users</p>
        </div>
        {can('users','create') && (
          <button style={{ padding:'8px 16px' }} onClick={() => alert('User creation form — coming in full implementation')}>
            + Add user
          </button>
        )}
      </div>

      <div style={{ marginBottom:'1rem' }}>
        <input placeholder="Search by name or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ width:'300px', boxSizing:'border-box' }} />
      </div>

      <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'14px', tableLayout:'fixed' }}>
          <thead>
            <tr style={{ background:'var(--color-background-secondary)' }}>
              {['Name','Email','Roles','Status','Last login'].map((h) => (
                <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontWeight:500, fontSize:'13px', color:'var(--color-text-secondary)', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding:'2rem', textAlign:'center', color:'var(--color-text-secondary)' }}>Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} style={{ padding:'2rem', textAlign:'center', color:'var(--color-text-secondary)' }}>No users found</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} style={{ borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
                <td style={{ padding:'12px 16px' }}>{u.first_name} {u.last_name}</td>
                <td style={{ padding:'12px 16px', color:'var(--color-text-secondary)' }}>{u.email}</td>
                <td style={{ padding:'12px 16px' }}>
                  {(u.roles||[]).map((r) => (
                    <span key={r.id} style={{ display:'inline-block', marginRight:'4px', fontSize:'12px', background:'var(--color-background-info)', color:'var(--color-text-info)', padding:'2px 6px', borderRadius:'var(--border-radius-md)' }}>{r.name}</span>
                  ))}
                </td>
                <td style={{ padding:'12px 16px' }}><Badge status={u.status} /></td>
                <td style={{ padding:'12px 16px', color:'var(--color-text-secondary)', fontSize:'13px' }}>
                  {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div style={{ display:'flex', gap:'8px', marginTop:'1rem', justifyContent:'flex-end' }}>
          <button onClick={() => setPage((p) => Math.max(1, p-1))} disabled={page===1}>Previous</button>
          <span style={{ padding:'8px 12px', fontSize:'13px', color:'var(--color-text-secondary)' }}>Page {page}</span>
          <button onClick={() => setPage((p) => p+1)} disabled={page*20 >= total}>Next</button>
        </div>
      )}
    </div>
  );
}
