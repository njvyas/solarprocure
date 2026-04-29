import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null); setPermissions({}); setRoles([]);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      authAPI.me()
        .then(({ data }) => { setUser(data.data); setPermissions(data.data.permissions||{}); setRoles(data.data.roles||[]); })
        .catch(() => clearAuth())
        .finally(() => setLoading(false));
    } else { setLoading(false); }
  }, [clearAuth]);

  useEffect(() => {
    const h = () => clearAuth();
    window.addEventListener('auth:logout', h);
    return () => window.removeEventListener('auth:logout', h);
  }, [clearAuth]);

  const login = useCallback(async (email, password, tenantSlug) => {
    const { data } = await authAPI.login(email, password, tenantSlug);
    const { accessToken, refreshToken, user: u } = data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(u); setPermissions(u.permissions||{}); setRoles(u.roles||[]);
    return u;
  }, []);

  const logout = useCallback(async (logoutAll = false) => {
    try { await authAPI.logout(logoutAll); } catch (_) {}
    finally { clearAuth(); }
  }, [clearAuth]);

  const can = useCallback((module, action) => {
    if (!permissions) return false;
    if (permissions['*']?.includes('*')) return true;
    if (permissions[module]?.includes('*')) return true;
    return permissions[module]?.includes(action) ?? false;
  }, [permissions]);

  const hasRole = useCallback((roleName) => roles.some((r) => r.name === roleName || r === roleName), [roles]);

  return (
    <AuthContext.Provider value={{ user, permissions, roles, loading, isAuthenticated: !!user, login, logout, can, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
