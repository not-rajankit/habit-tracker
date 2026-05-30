import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, login as loginRequest, logout as logoutRequest, signup as signupRequest } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await getCurrentUser();
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (payload) => {
    const data = await loginRequest(payload);
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (payload) => {
    const data = await signupRequest(payload);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest().catch(() => {});
    setUser(null);
  }, []);

  const hasPermission = useCallback((permission) => (
    Boolean(user?.permissions?.includes(permission))
  ), [user]);

  const hasAnyPermission = useCallback((permissions) => (
    permissions.some((permission) => user?.permissions?.includes(permission))
  ), [user]);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    signup,
    logout,
    refreshUser,
    setUser,
    hasPermission,
    hasAnyPermission,
  }), [user, loading, login, signup, logout, refreshUser, hasPermission, hasAnyPermission]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
