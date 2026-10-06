import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types/index.js';
import { api } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean | null;
  mustChangePassword: boolean;
  login: (credentials: { username: string; password: string }) => Promise<void>;
  setupAdmin: (data: { username?: string; password?: string; email?: string }) => Promise<void>;
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isOperator: boolean;
  refreshUser: () => Promise<void>;
  checkSetupStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSetupStatus = async (): Promise<boolean> => {
    try {
      const res = await api.getSetupStatus();
      setIsInitialized(res.initialized);
      return res.initialized;
    } catch (err) {
      console.error('Failed to check setup status:', err);
      // Default to initialized if error to avoid locking out unexpectedly
      setIsInitialized(true);
      return true;
    }
  };

  const refreshUser = async () => {
    try {
      const currentUser = await api.getMe();
      setUser(currentUser);
    } catch {
      setUser(null);
      api.clearToken();
    }
  };

  const initAuth = async () => {
    try {
      setIsLoading(true);
      const initialized = await checkSetupStatus();
      if (!initialized) {
        setIsLoading(false);
        return;
      }

      const token = localStorage.getItem('elys_token');
      if (token) {
        await refreshUser();
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initAuth();

    const handleUnauthorized = () => {
      setUser(null);
    };

    window.addEventListener('elys:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('elys:unauthorized', handleUnauthorized);
  }, []);

  const login = async (credentials: { username: string; password: string }) => {
    const res = await api.login(credentials);
    setUser(res.user);
    setIsInitialized(true);
  };

  const setupAdmin = async (data: { username?: string; password?: string; email?: string }) => {
    const res = await api.setupAdmin(data);
    setUser(res.user);
    setIsInitialized(true);
  };

  const changePassword = async (data: { currentPassword: string; newPassword: string }) => {
    const res = await api.changePassword(data);
    if (res.user) {
      setUser(res.user);
    } else {
      await refreshUser();
    }
  };

  const logout = () => {
    api.clearToken();
    setUser(null);
  };

  const mustChangePassword = Boolean(
    user?.mustChangePassword || user?.must_change_password === 1 || user?.must_change_password === true
  );

  const isAdmin = user?.role === 'admin';
  const isOperator = user?.role === 'admin' || user?.role === 'operator';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isInitialized,
        mustChangePassword,
        login,
        setupAdmin,
        changePassword,
        logout,
        isAdmin,
        isOperator,
        refreshUser,
        checkSetupStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
