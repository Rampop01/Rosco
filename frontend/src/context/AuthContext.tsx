'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { initNimiqPay, listAccounts, resetWalletAccount, NimiqAccount } from '../lib/nimiq-pay';
import { createSession, getToken, clearToken, User } from '../lib/api';

interface AuthContextType {
  user: User | null;
  wallet: NimiqAccount | null;
  token: string | null;
  isLoading: boolean;
  connectWallet: (displayName?: string) => Promise<void>;
  disconnect: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  wallet: null,
  token: null,
  isLoading: true,
  connectWallet: async () => {},
  disconnect: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<NimiqAccount | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      try {
        await initNimiqPay();
        const storedToken = getToken();
        if (storedToken) {
          // If we had a stored token from an old mock session, clear it if no account is explicitly chosen
          clearToken();
          resetWalletAccount();
        }
      } catch (err) {
        console.error('Failed to initialize Nimiq Pay auth:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const connectWallet = async (displayName?: string) => {
    setIsLoading(true);
    try {
      await initNimiqPay();
      const accounts = await listAccounts();
      if (!accounts || !accounts.length) {
        throw new Error('No Nimiq account selected');
      }
      const primary = accounts[0];
      setWallet(primary);

      const res = await createSession(primary.address, displayName || primary.label || 'Rosco User');
      setUser(res.user);
      setTokenState(res.token);
    } catch (err: any) {
      console.warn('Wallet connection cancelled or failed:', err);
      disconnect();
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = () => {
    clearToken();
    resetWalletAccount();
    setUser(null);
    setWallet(null);
    setTokenState(null);
  };

  return (
    <AuthContext.Provider value={{ user, wallet, token, isLoading, connectWallet, disconnect }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
