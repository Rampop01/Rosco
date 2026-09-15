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
        // If running inside Nimiq Pay Mobile Webview, automatically pick up native wallet address!
        if (typeof window !== 'undefined' && window.nimiqPay) {
          try {
            const accounts = await listAccounts();
            if (accounts && accounts.length && accounts[0].address) {
              const primary = accounts[0];
              setWallet(primary);
              setUser({
                id: primary.address,
                nimiq_address: primary.address,
                display_name: primary.label || 'Nimiq Pay Member',
                language: 'en',
                created_at: new Date().toISOString(),
              });
              console.log('[Rosco] Auto-connected native Nimiq Pay wallet:', primary.address);
            }
          } catch (e) {
            console.warn('[Rosco] Auto native wallet fetch deferred:', e);
          }
        } else {
          const storedToken = getToken();
          if (storedToken) {
            clearToken();
            resetWalletAccount();
          }
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

      try {
        const res = await createSession(primary.address, displayName || primary.label || 'Nimiq Member');
        setUser(res.user);
        setTokenState(res.token);
      } catch (apiErr) {
        console.warn('[Rosco] Backend API session creation failed (offline/unreachable), falling back to client wallet session:', apiErr);
        // Fallback user object so the wallet address is always displayed even if backend is offline on Vercel
        setUser({
          id: primary.address,
          nimiq_address: primary.address,
          display_name: displayName || primary.label || 'Nimiq Member',
          language: 'en',
          created_at: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.warn('[Rosco] Wallet connection cancelled:', err);
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
