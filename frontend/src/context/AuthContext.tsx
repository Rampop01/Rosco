'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { initNimiqPay, listAccounts, resetWalletAccount, getNativeNimiqPaySDK, NimiqAccount } from '../lib/nimiq-pay';
import { authenticateUser, getToken, clearToken, User } from '../lib/api';

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
        const stored = typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') : null;
        if (stored) {
          const primary = { address: stored, label: localStorage.getItem('rosco_wallet_label') || 'Nimiq Wallet' };
          setWallet(primary);
          setUser({
            id: primary.address,
            nimiq_address: primary.address,
            display_name: primary.label,
            language: 'en',
            created_at: new Date().toISOString(),
          });
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
      if (typeof window !== 'undefined') {
        localStorage.setItem('rosco_wallet_address', primary.address);
        if (primary.label) localStorage.setItem('rosco_wallet_label', primary.label);
      }
      const fallbackUser: User = {
        id: primary.address,
        nimiq_address: primary.address,
        display_name: displayName || primary.label || 'Nimiq Member',
        language: 'en',
        created_at: new Date().toISOString(),
      };
      setUser(fallbackUser);

      try {
        const res = await authenticateUser(primary.address, displayName || primary.label || 'Nimiq Member');
        setUser(res.user);
        setTokenState(res.token);
      } catch (apiErr) {
        console.warn('[Rosco] Backend API session creation skipped (using client wallet):', apiErr);
      }
    } catch (err: any) {
      console.warn('[Rosco] Wallet connection failed:', err);
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
