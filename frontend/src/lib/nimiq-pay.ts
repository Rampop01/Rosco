/**
 * Nimiq Wallet SDK Wrapper for Rosco
 * 
 * Supports two real wallet modes:
 * 1. Nimiq Pay Mobile App: Uses window.nimiqPay injected by the mobile webview host.
 * 2. Standard Web Browsers (Desktop/Mobile Chrome/Safari): Uses @nimiq/hub-api to trigger 
 *    the official Nimiq Hub browser pop-up vault (https://hub.nimiq-testnet.com or https://hub.nimiq.com).
 */

// ─── Type Definitions ───────────────────────────────────────────────────────

export interface NimiqAccount {
  address: string;
  label?: string;
  balance?: number;
}

export interface PaymentRequest {
  recipient: string;
  amount: number; // in NIM
  message?: string;
}

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

interface NimiqPaySDK {
  init(): Promise<void>;
  listAccounts(): Promise<NimiqAccount[]>;
  requestPayment(request: PaymentRequest): Promise<PaymentResult>;
  language: string;
  theme: 'light' | 'dark';
}

declare global {
  interface Window {
    nimiqPay?: NimiqPaySDK;
  }
}

// ─── State ──────────────────────────────────────────────────────────────

let initialized = false;
let hubApiInstance: any = null;
let savedAccount: NimiqAccount | null = null;

// Default to Nimiq Hub (or configurable via env)
const HUB_URL = process.env.NEXT_PUBLIC_NIMIQ_HUB_URL || 'https://hub.nimiq.com';

async function getHubApi(): Promise<any> {
  if (typeof window === 'undefined') return null;
  if (!hubApiInstance) {
    try {
      const HubModule = await import('@nimiq/hub-api');
      const HubClass = HubModule.default || (HubModule as any);
      const PopupBehavior = HubModule.PopupRequestBehavior || (HubModule as any).PopupRequestBehavior;
      const behavior = PopupBehavior ? new PopupBehavior(undefined, { overlay: false }) : undefined;
      hubApiInstance = new HubClass(HUB_URL, behavior);
    } catch (err) {
      console.error('[Rosco] Failed to load @nimiq/hub-api:', err);
      throw err;
    }
  }
  return hubApiInstance;
}

export function getNativeNimiqPaySDK(): any {
  if (typeof window === 'undefined') return null;
  return window.nimiqPay || 
         (window as any).NimiqPay || 
         (window as any).nimiq || 
         (window as any).Nimiq || 
         (window as any).nimiqPaySDK || 
         (window as any).NimiqPaySDK;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function initNimiqPay(): Promise<void> {
  if (initialized) return;

  const nativeSdk = getNativeNimiqPaySDK();
  if (nativeSdk) {
    try {
      if (typeof nativeSdk.init === 'function') {
        await nativeSdk.init();
      }
      console.log('[Rosco] Connected via Native Nimiq Pay Mobile App Webview');
    } catch (e) {
      console.warn('[Rosco] Native init warning:', e);
    }
  } else if (typeof window !== 'undefined') {
    // Initialize Nimiq Hub Web API on client side safely
    try {
      await getHubApi();
      console.log(`[Rosco] Connected via Nimiq Hub Web API (${HUB_URL})`);
    } catch (err) {
      console.warn('[Rosco] Hub API initialization deferred:', err);
    }
  }
  initialized = true;
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 820 || !!getNativeNimiqPaySDK();
}

function findNimiqAddressOnWindow(): string | null {
  if (typeof window === 'undefined') return null;

  const knownKeys = [
    'address', 'nimiqAddress', 'walletAddress', 'userAddress', 'account', 'nimiqAccount',
    'nimiqPay', 'NimiqPay', 'nimiq', 'Nimiq', 'nimiqWallet', 'NimiqWallet',
    'nimiqUser', 'NimiqUser', 'nimiqPaySDK', 'NimiqPaySDK'
  ];

  for (const key of knownKeys) {
    const obj = (window as any)[key];
    if (!obj) continue;

    if (typeof obj === 'string' && obj.trim().startsWith('NQ') && obj.trim().length >= 24) {
      return obj.trim();
    }

    if (typeof obj === 'object') {
      const addr = obj.address || obj.currentAddress || obj.account?.address || obj.userAddress || obj.selectedAddress || obj.publicAddress || (typeof obj.account === 'string' ? obj.account : null);
      if (addr && typeof addr === 'string' && addr.trim().startsWith('NQ') && addr.trim().length >= 24) {
        return addr.trim();
      }
    }
  }

  try {
    for (const key of Object.keys(window)) {
      if (/nimiq|wallet|account|pay/i.test(key)) {
        const obj = (window as any)[key];
        if (!obj) continue;
        if (typeof obj === 'string' && obj.trim().startsWith('NQ') && obj.trim().length >= 24) {
          return obj.trim();
        }
        if (typeof obj === 'object') {
          const addr = obj.address || obj.currentAddress || obj.account?.address || obj.userAddress || obj.selectedAddress || (typeof obj.account === 'string' ? obj.account : null);
          if (addr && typeof addr === 'string' && addr.trim().startsWith('NQ') && addr.trim().length >= 24) {
            return addr.trim();
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Rosco] Window scan error:', e);
  }

  return null;
}

function findNimiqAddressFromBrowserState(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (/nimiq|wallet|account|address|hub/i.test(key)) {
        const val = localStorage.getItem(key);
        if (!val) continue;

        if (val.includes('NQ')) {
          const match = val.match(/NQ\d{2}(?:\s?[0-9A-Z]{4}){8}/i) || val.match(/NQ[0-9A-Z]{32,40}/i);
          if (match && match[0]) {
            return match[0].trim();
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Rosco] localStorage search error:', e);
  }

  return null;
}

export async function listAccounts(): Promise<NimiqAccount[]> {
  // Purge legacy generated synthetic addresses if any exist in storage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('rosco_generated_address');
  }

  // 1. Check URL query parameters (Nimiq Pay mobile app & deep-links pass address in URL)
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlAddr = params.get('address') || 
                      params.get('account') || 
                      params.get('nimiq_address') || 
                      params.get('user_address') ||
                      params.get('nimiq') ||
                      params.get('wallet');

      if (urlAddr && typeof urlAddr === 'string' && urlAddr.trim().length > 10) {
        const acc = { address: urlAddr.trim(), label: 'Nimiq Mobile Wallet' };
        saveAccountToStorage(acc);
        return [acc];
      }
    } catch (e) {
      console.warn('[Rosco] Error parsing URL address params:', e);
    }
  }

  // 2. Comprehensive Window & Native Mobile SDK Auto-Scan
  const windowAddr = findNimiqAddressOnWindow();
  if (windowAddr) {
    const acc = { address: windowAddr, label: 'Nimiq Mobile Wallet' };
    saveAccountToStorage(acc);
    return [acc];
  }

  // 3. Native Nimiq Pay Webview Method Inspection (Triggers Native Bottom Permission Sheet)
  const nativeSdk = getNativeNimiqPaySDK();
  if (nativeSdk) {
    try {
      if (typeof nativeSdk.init === 'function') {
        await nativeSdk.init();
      }
      const methodNames = [
        'connect', 'requestAccounts', 'eth_requestAccounts', 'login', 'connectWallet', 
        'enable', 'listAccounts', 'getAccounts', 'getAccount', 'getAddress', 'getWallet', 'getNimiqAddress'
      ];
      for (const fnName of methodNames) {
        if (typeof nativeSdk[fnName] === 'function') {
          try {
            console.log(`[Rosco] Calling nativeSdk.${fnName}() to open Nimiq Pay permission sheet...`);
            const res = await nativeSdk[fnName]();
            if (Array.isArray(res) && res.length) {
              const item = res[0];
              const addr = typeof item === 'string' ? item : item?.address || item?.account;
              if (addr && typeof addr === 'string') {
                const acc = { address: addr, label: item?.label || 'Nimiq Mobile Wallet' };
                saveAccountToStorage(acc);
                return [acc];
              }
            } else if (res && (typeof res === 'object' || typeof res === 'string')) {
              const addr = typeof res === 'string' ? res : res.address || res.account;
              if (addr && typeof addr === 'string') {
                const acc = { address: addr, label: res.label || 'Nimiq Mobile Wallet' };
                saveAccountToStorage(acc);
                return [acc];
              }
            }
          } catch (e) {
            console.warn(`[Rosco] nativeSdk.${fnName}() attempt failed:`, e);
          }
        }
      }
    } catch (nativeErr) {
      console.warn('[Rosco] Native Nimiq Pay listAccounts error:', nativeErr);
    }
  }

  // 4. Return cached account if user already connected in this session or browser state
  if (savedAccount) {
    return [savedAccount];
  }

  const stored = getAccountFromStorage();
  if (stored) {
    savedAccount = stored;
    return [stored];
  }

  const browserStateAddr = findNimiqAddressFromBrowserState();
  if (browserStateAddr) {
    const acc = { address: browserStateAddr, label: 'Nimiq Mobile Wallet' };
    saveAccountToStorage(acc);
    return [acc];
  }

  // 5. ON MOBILE DEVICES: Try window.ethereum / window.nimiq connect methods to trigger native sheet
  if (isMobileDevice()) {
    console.log('[Rosco] Mobile device detected. Executing native connect RPCs...');
    const fnsToTry = [
      () => (window as any).nimiqPay?.connect?.(),
      () => (window as any).nimiqPay?.requestAccounts?.(),
      () => (window as any).nimiq?.connect?.(),
      () => (window as any).nimiq?.requestAccounts?.(),
      () => (window as any).ethereum?.request?.({ method: 'eth_requestAccounts' }),
      () => (window as any).ethereum?.request?.({ method: 'requestAccounts' }),
      () => (window as any).ethereum?.enable?.()
    ];

    for (const fn of fnsToTry) {
      try {
        const res = await fn();
        if (Array.isArray(res) && res.length) {
          const item = res[0];
          const addr = typeof item === 'string' ? item : item?.address || item?.account;
          if (addr && typeof addr === 'string') {
            const acc = { address: addr, label: 'Nimiq Mobile Wallet' };
            saveAccountToStorage(acc);
            return [acc];
          }
        } else if (res && (typeof res === 'object' || typeof res === 'string')) {
          const addr = typeof res === 'string' ? res : res.address || res.account;
          if (addr && typeof addr === 'string') {
            const acc = { address: addr, label: 'Nimiq Mobile Wallet' };
            saveAccountToStorage(acc);
            return [acc];
          }
        }
      } catch (e) {
        console.warn('[Rosco] Mobile connect try error:', e);
      }
    }
    return [];
  }

  // 6. DESKTOP BROWSERS ONLY: Trigger Nimiq Hub Choose Address Pop-up
  try {
    const hub = await getHubApi();
    if (!hub) return [];
    
    let chosen: any = null;
    try {
      chosen = await hub.chooseAddress({ appName: 'Rosco' });
    } catch (err: any) {
      console.log('[Rosco] chooseAddress fallback to onboard/login:', err);
      try {
        const accounts = await hub.onboard({ appName: 'Rosco' });
        if (accounts && accounts.length && accounts[0].addresses && accounts[0].addresses.length) {
          chosen = accounts[0].addresses[0];
        }
      } catch (onboardErr) {
        console.warn('[Rosco] Onboard error:', onboardErr);
      }
    }

    if (chosen && chosen.address) {
      savedAccount = {
        address: chosen.address,
        label: chosen.label || 'Nimiq Wallet',
      };
      saveAccountToStorage(savedAccount);
      return [savedAccount];
    }
    return [];
  } catch (err: any) {
    console.warn('[Rosco] Nimiq Hub account selection cancelled or failed:', err);
    throw new Error(err?.message || 'Wallet connection was cancelled');
  }
}

function saveAccountToStorage(acc: NimiqAccount): void {
  savedAccount = acc;
  if (typeof window !== 'undefined') {
    localStorage.setItem('rosco_wallet_address', acc.address);
    if (acc.label) localStorage.setItem('rosco_wallet_label', acc.label);
  }
}

function getAccountFromStorage(): NimiqAccount | null {
  if (typeof window === 'undefined') return null;
  const address = localStorage.getItem('rosco_wallet_address');
  if (address) {
    const label = localStorage.getItem('rosco_wallet_label') || 'Nimiq Wallet';
    return { address, label };
  }
  return null;
}

export async function requestPayment(request: PaymentRequest): Promise<PaymentResult> {
  // 1. Native Nimiq Pay Webview
  if (typeof window !== 'undefined' && window.nimiqPay) {
    return window.nimiqPay.requestPayment(request);
  }

  // 2. Nimiq Hub Web API Checkout Pop-up
  try {
    const hub = await getHubApi();
    if (!hub) {
      return { success: false, error: 'Hub API not available on server' };
    }
    
    // Nimiq Hub expects amount in Luna (1 NIM = 100,000 Luna)
    const lunaAmount = Math.round(request.amount * 100000);

    const result = await hub.checkout({
      appName: 'Rosco',
      recipient: request.recipient,
      value: lunaAmount,
    });

    if (result && result.hash) {
      return {
        success: true,
        txHash: result.hash,
      };
    } else {
      return {
        success: false,
        error: 'Transaction hash missing from Nimiq Hub response',
      };
    }
  } catch (err: any) {
    console.error('[Rosco] Nimiq Hub payment failed:', err);
    return {
      success: false,
      error: err?.message || 'Payment cancelled by user',
    };
  }
}

export function getLanguage(): string {
  if (typeof window !== 'undefined' && window.nimiqPay) {
    return window.nimiqPay.language;
  }
  return typeof navigator !== 'undefined' ? navigator.language : 'en';
}

export function getTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.nimiqPay) {
    return window.nimiqPay.theme;
  }
  return 'light';
}

export function resetWalletAccount(): void {
  savedAccount = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('rosco_wallet_address');
    localStorage.removeItem('rosco_wallet_label');
    localStorage.removeItem('rosco_generated_address');
  }
}

export function isDevMode(): boolean {
  return !(typeof window !== 'undefined' && (window.nimiqPay || true));
}
