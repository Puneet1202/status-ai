import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  name: string;
  email: string;
  [key: string]: any;
}

interface AppStateContextType {
  user: User | null;
  token: string | null;
  login: (userData: User, token: string) => void;
  logout: () => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export const AppStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('keyss_user');
    const storedToken = localStorage.getItem('keyss_token');
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch (e) {
        console.error("Failed to parse stored user", e);
      }
    }
  }, []);

  const login = (userData: User, tokenData: string) => {
    setUser(userData);
    setToken(tokenData);
    localStorage.setItem('keyss_user', JSON.stringify(userData));
    localStorage.setItem('keyss_token', tokenData);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('keyss_user');
    localStorage.removeItem('keyss_token');
  };

  return (
    <AppStateContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
