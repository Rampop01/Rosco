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

export async function listAccounts(): Promise<NimiqAccount[]> {
  const nativeSdk = getNativeNimiqPaySDK();

  // 1. Native Nimiq Pay Webview — Use Native SDK ONLY (do not fall back to Hub web wallet)
  if (nativeSdk) {
    try {
      if (typeof nativeSdk.init === 'function') {
        await nativeSdk.init();
      }
      if (typeof nativeSdk.listAccounts === 'function') {
        const nativeAccounts = await nativeSdk.listAccounts();
        if (nativeAccounts && nativeAccounts.length) {
          console.log('[Rosco] Retrieved accounts from native Nimiq Pay listAccounts:', nativeAccounts);
          return nativeAccounts;
        }
      }
      if (typeof nativeSdk.getAccounts === 'function') {
        const nativeAccounts = await nativeSdk.getAccounts();
        if (nativeAccounts && nativeAccounts.length) {
          console.log('[Rosco] Retrieved accounts from native Nimiq Pay getAccounts:', nativeAccounts);
          return nativeAccounts;
        }
      }
      if (typeof nativeSdk.requestAccounts === 'function') {
        const nativeAccounts = await nativeSdk.requestAccounts();
        if (nativeAccounts && nativeAccounts.length) {
          console.log('[Rosco] Retrieved accounts from native Nimiq Pay requestAccounts:', nativeAccounts);
          return nativeAccounts;
        }
      }
      const directAddr = nativeSdk.address || nativeSdk.currentAddress || nativeSdk.account?.address || nativeSdk.currentAccount?.address;
      if (directAddr && typeof directAddr === 'string') {
        return [{ address: directAddr, label: nativeSdk.account?.label || 'Nimiq Mobile Wallet' }];
      }
    } catch (nativeErr) {
      console.warn('[Rosco] Native Nimiq Pay listAccounts error:', nativeErr);
    }
    // Return empty array when inside native app webview so it NEVER pops up Nimiq Hub web wallet
    return [];
  }

  // 2. Return cached account if user already connected in this session
  if (savedAccount) {
    return [savedAccount];
  }

  // 3. Standard Web Browser: Trigger Nimiq Hub Choose Address / Onboard Pop-up
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
      return [savedAccount];
    }
    return [];
  } catch (err: any) {
    console.warn('[Rosco] Nimiq Hub account selection cancelled or failed:', err);
    throw new Error(err?.message || 'Wallet connection was cancelled');
  }
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
}

export function isDevMode(): boolean {
  // Now returns false for web browsers because real Nimiq Hub API is active!
  return !(typeof window !== 'undefined' && (window.nimiqPay || true));
}
