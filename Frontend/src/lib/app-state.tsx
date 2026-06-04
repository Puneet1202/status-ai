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

  // Chat history + any half-finished AI action are per-browser. They MUST be
  // wiped whenever the logged-in identity changes, otherwise a new/different user
  // on the same browser would see the previous user's chat (privacy bug).
  const clearChatState = () => {
    localStorage.removeItem('keyss_chat_history');
    localStorage.removeItem('keyss_pending_action');
  };

  const login = (userData: User, tokenData: string) => {
    clearChatState(); // fresh session → never inherit a prior user's chat
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
    clearChatState(); // so the next user on this browser can't see this chat
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
