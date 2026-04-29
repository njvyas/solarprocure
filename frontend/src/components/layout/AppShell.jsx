import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const NAV = [
  { to:'/dashboard', label:'Dashboard', icon:'▦' },
  { to:'/users', label:'Users', icon:'👥', perm:['users','read'] },
  { to:'/profile', label:'Profile', icon:'⚙' },
];

export default function AppShell() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarW = collapsed ? 56 : 220;

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f8fafc' }}>
      {/* Sidebar */}
      <aside style={{ width:sidebarW, background:'white', borderRight:'1px solid #e2e8f0',
        display:'flex', flexDirection:'column', position:'fixed', top:0, bottom:0, left:0, zIndex:50,
        transition:'width 0.2s ease', overflow:'hidden' }}>

        {/* Logo */}
        <div style={{ padding:'16px 14px', borderBottom:'1px solid #f1f5f9', display:'flex',
          alignItems:'center', gap:10, minHeight:56 }}>
          <div style={{ width:32, height:32, background:'linear-gradient(135deg,#22c55e,#15803d)',
            borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M12 2v20M3 7l9 5 9-5" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          {!collapsed && <span style={{ fontSize:15, fontWeight:600, color:'#0f172a', whiteSpace:'nowrap' }}>eProcure</span>}
        </div>

        {/* Nav links */}
        <nav style={{ flex:1, padding:'12px 8px', display:'flex', flexDirection:'column', gap:2 }}>
          {NAV.map(({ to, label, icon, perm }) => {
            if (perm && !hasPermission(perm[0], perm[1])) return null;
            return (
              <NavLink key={to} to={to}
                style={({ isActive }) => ({
                  display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8,
                  textDecoration:'none', fontSize:13, fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#15803d' : '#475569',
                  background: isActive ? '#f0fdf4' : 'transparent',
                  transition:'all 0.15s', whiteSpace:'nowrap', overflow:'hidden',
                })}>
                <span style={{ fontSize:16, width:22, textAlign:'center', flexShrink:0 }}>{icon}</span>
                {!collapsed && label}
              </NavLink>
            );
          })}
        </nav>

        {/* User + collapse */}
        <div style={{ padding:'12px 8px', borderTop:'1px solid #f1f5f9' }}>
          {!collapsed && user && (
            <div style={{ padding:'8px 10px', marginBottom:4 }}>
              <div style={{ fontSize:13, fontWeight:500, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {user.firstName} {user.lastName}
              </div>
              <div style={{ fontSize:11, color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {user.tenantName}
              </div>
            </div>
          )}
          <button onClick={handleLogout}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', width:'100%',
              background:'none', border:'none', cursor:'pointer', borderRadius:8, fontSize:13,
              color:'#ef4444', fontFamily:'inherit', transition:'background 0.15s' }}>
            <span style={{ fontSize:15 }}>⎋</span>
            {!collapsed && 'Logout'}
          </button>
          <button onClick={() => setCollapsed(p => !p)}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', width:'100%',
              background:'none', border:'none', cursor:'pointer', borderRadius:8, fontSize:12,
              color:'#94a3b8', fontFamily:'inherit', marginTop:2 }}>
            <span>{collapsed ? '→' : '←'}</span>
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft:sidebarW, flex:1, minHeight:'100vh', transition:'margin-left 0.2s ease' }}>
        {/* Top bar */}
        <header style={{ height:56, background:'white', borderBottom:'1px solid #e2e8f0',
          display:'flex', alignItems:'center', padding:'0 24px', gap:12, position:'sticky', top:0, zIndex:40 }}>
          <div style={{ flex:1 }} />
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:11, padding:'3px 8px', borderRadius:9999, background:'#f0fdf4',
              color:'#15803d', fontWeight:500, border:'1px solid #bbf7d0' }}>
              Stage 1
            </span>
            {user && (
              <div style={{ width:32, height:32, background:'linear-gradient(135deg,#22c55e,#15803d)',
                borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, fontWeight:600, color:'white' }}>
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
            )}
          </div>
        </header>

        <div style={{ padding:24 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
