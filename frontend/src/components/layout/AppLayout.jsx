import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const NAV = [
  { path:'/dashboard',       label:'Dashboard',     icon:'⬛', perm:null },
  { path:'/vendors',         label:'Vendors',       icon:'🏭', perm:['vendors','read'] },
  { path:'/boms',            label:'BOMs',          icon:'📄', perm:['boms','read'] },
  { path:'/rfqs',            label:'RFQs',          icon:'📋', perm:['rfqs','read'] },
  { path:'/quotes',          label:'Quotes',        icon:'💬', perm:['quotes','read'] },
  { path:'/bidding',         label:'Bidding',       icon:'⚡', perm:['rfqs','read'] },
  { path:'/evaluations',     label:'Evaluations',   icon:'📊', perm:['quotes','read'] },
  { path:'/purchase-orders', label:'Purchase Orders',icon:'🧾', perm:['pos','read'] },
  { path:'/ai/insights',     label:'AI Insights',   icon:'🤖', perm:['ai','read'] },
  { path:'/ai/chat',         label:'AI Chat',       icon:'🗨️',  perm:['ai','use'] },
  { path:'/ai/settings',     label:'AI Settings',   icon:'⚙️', perm:['ai','manage'] },
  { path:'/backup',          label:'Backup',        icon:'💾', perm:['backup','read'] },
  { path:'/reports',         label:'Reports',       icon:'📈', perm:['reports','read'] },
  { path:'/users',           label:'Users',         icon:'👤', perm:['users','read'] },
  { path:'/audit-logs',      label:'Audit logs',    icon:'🔍', perm:['audit','read'] },
  { path:'/system-settings', label:'System Settings', icon:'⚙️', perm:['settings','read'] },
  { path:'/tenant-settings', label:'Tenant Settings',icon:'🏢', perm:['tenants','read'] },
  { path:'/profile',         label:'My Profile',    icon:'👤', perm:null },
];

export default function AppLayout({ children }) {
  const { user, logout, can } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => { await logout(); navigate('/login'); };
  const visible = NAV.filter(item => !item.perm || can(item.perm[0], item.perm[1]));

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--color-background-tertiary)' }}>
      <aside style={{ width:collapsed?60:230, flexShrink:0, transition:'width 0.2s', background:'var(--color-background-primary)', borderRight:'0.5px solid var(--color-border-tertiary)', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'1rem', borderBottom:'0.5px solid var(--color-border-tertiary)', display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'var(--color-background-info)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-info)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          {!collapsed && <span style={{ fontWeight:500, fontSize:'14px', overflow:'hidden', whiteSpace:'nowrap' }}>eProcurement</span>}
        </div>
        <nav style={{ flex:1, padding:'0.75rem 0', overflowY:'auto' }}>
          {visible.map(({ path, label, icon }) => {
            const active = path === '/dashboard'
              ? location.pathname === '/dashboard'
              : location.pathname === path || location.pathname.startsWith(path + '/');
            return (
              <Link key={path} to={path} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'7px 14px', margin:'1px 8px', borderRadius:'var(--border-radius-md)', textDecoration:'none', fontSize:'13px', background:active?'var(--color-background-secondary)':'transparent', color:active?'var(--color-text-primary)':'var(--color-text-secondary)', fontWeight:active?500:400, transition:'background 0.15s' }}>
                <span style={{ fontSize:'13px', flexShrink:0 }}>{icon}</span>
                {!collapsed && <span style={{ overflow:'hidden', whiteSpace:'nowrap' }}>{label}</span>}
              </Link>
            );
          })}
        </nav>
        <div style={{ padding:'0.75rem', borderTop:'0.5px solid var(--color-border-tertiary)' }}>
          {!collapsed && user && (
            <Link to="/profile" style={{ display:'block', marginBottom:'8px', padding:'8px', background:'var(--color-background-secondary)', borderRadius:'var(--border-radius-md)', textDecoration:'none', transition:'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--color-background-tertiary)'}
              onMouseLeave={e => e.currentTarget.style.background='var(--color-background-secondary)'}>
              <p style={{ fontSize:'13px', fontWeight:500, margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--color-text-primary)' }}>{user.firstName} {user.lastName}</p>
              <p style={{ fontSize:'11px', color:'var(--color-text-secondary)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</p>
            </Link>
          )}
          <button onClick={handleLogout} style={{ width:'100%', padding:'6px 8px', fontSize:'13px', color:'var(--color-text-danger)', display:'flex', alignItems:'center', gap:'6px', justifyContent:collapsed?'center':'flex-start', background:'none', border:'none', cursor:'pointer' }}>
            <span>⏻</span>{!collapsed && <span>Sign out</span>}
          </button>
        </div>
        <button onClick={()=>setCollapsed(c=>!c)} style={{ padding:'6px', borderTop:'0.5px solid var(--color-border-tertiary)', fontSize:'11px', color:'var(--color-text-secondary)', background:'none', border:'none', cursor:'pointer' }}>{collapsed?'→':'←'}</button>
      </aside>
      <main style={{ flex:1, overflow:'auto' }}>
        <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'2rem' }}>{children}</div>
      </main>
    </div>
  );
}
