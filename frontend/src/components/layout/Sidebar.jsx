import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Sun, LayoutDashboard, Users, Building2, ShieldCheck,
  FileText, Package, TrendingDown, BarChart3,
  LogOut, ClipboardList, ChevronRight, Settings2
} from 'lucide-react';
const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/users', icon: Users, label: 'Users', permission: ['users', 'read'] },
  { to: '/vendors', icon: Building2, label: 'Vendors', badge: 'Stage 2' },
  { to: '/boms', icon: Package, label: 'BOM Engine', badge: 'Stage 4' },
  { to: '/rfqs', icon: FileText, label: 'RFQs', badge: 'Stage 5' },
  { to: '/bidding', icon: TrendingDown, label: 'Reverse Bidding', badge: 'Stage 7' },
  { to: '/reports', icon: BarChart3, label: 'Reports', badge: 'Stage 11' },
  { divider: true, label: 'Administration' },
  { to: '/system-settings', icon: Settings2, label: 'System Settings', permission: ['settings', 'read'] },
  { to: '/tenant-settings', icon: ShieldCheck, label: 'Tenant Settings', permission: ['tenants', 'read'] },
  { to: '/audit', icon: ClipboardList, label: 'Audit Logs', permission: ['audit', 'read'] },

];

export default function Sidebar() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside style={{
      width: '240px', flexShrink: 0, background: 'var(--color-bg-card)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column', height: '100vh',
      position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px', display: 'flex', alignItems: 'center', gap: '10px',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Sun size={18} color="white" />
        </div>
        <div>
          <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>eProcure</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {user?.tenantName?.slice(0, 20) || 'Solar EPC'}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        {navItems.map((item, i) => {
          if (item.divider) {
            return (
              <div key={i} style={{ padding: '16px 12px 8px', fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {item.label}
              </div>
            );
          }

          const isLocked = !!item.badge;
          const canAccess = !item.permission || hasPermission(item.permission[0], item.permission[1]);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 12px', borderRadius: 'var(--radius-md)',
                color: isActive ? 'var(--color-primary)' : isLocked ? 'var(--text-muted)' : 'var(--text-secondary)',
                background: isActive ? 'var(--color-primary-light)' : 'transparent',
                fontSize: '13px', fontWeight: isActive ? '500' : '400',
                textDecoration: 'none', transition: 'all 0.12s',
                marginBottom: '2px',
                opacity: (!canAccess && !isLocked) ? 0.4 : 1,
                pointerEvents: isLocked ? 'none' : 'auto',
              })}
            >
              <item.icon size={16} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span style={{
                  fontSize: '9px', fontWeight: '600', color: 'var(--text-muted)',
                  background: 'var(--color-border)', padding: '2px 6px', borderRadius: '99px',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>{item.badge}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User profile */}
      <div style={{
        padding: '12px', borderTop: '1px solid var(--color-border)',
      }}>
        <NavLink
          to="/profile"
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 12px', borderRadius: 'var(--radius-md)',
            background: isActive ? 'var(--color-primary-light)' : 'var(--color-bg-elevated)',
            border: isActive ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
            marginBottom: '8px', textDecoration: 'none',
            transition: 'all 0.12s', cursor: 'pointer',
          })}
        >
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'var(--color-primary-light)', border: '1px solid var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: '600', color: 'var(--color-primary)', flexShrink: 0,
          }}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.firstName} {user?.lastName}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.roles?.[0]?.name || user?.roles?.[0] || 'User'}
            </div>
          </div>
        </NavLink>
        <button
          onClick={handleLogout}
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'center', fontSize: '12px', color: 'var(--text-muted)' }}
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  );
}
