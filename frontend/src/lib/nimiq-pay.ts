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

// Default to Nimiq Testnet Hub (or Mainnet based on env)
const HUB_URL = process.env.NEXT_PUBLIC_NIMIQ_HUB_URL || 'https://hub.nimiq-testnet.com';

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

// ─── Public API ─────────────────────────────────────────────────────────────

export async function initNimiqPay(): Promise<void> {
  if (initialized) return;

  if (typeof window !== 'undefined' && window.nimiqPay) {
    await window.nimiqPay.init();
    console.log('[Rosco] Connected via Nimiq Pay Mobile App Native Webview');
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
  // 1. Native Nimiq Pay Webview
  if (typeof window !== 'undefined' && window.nimiqPay) {
    return window.nimiqPay.listAccounts();
  }

  // 2. Return cached account if user already connected in this session
  if (savedAccount) {
    return [savedAccount];
  }

  // 3. Trigger Nimiq Hub Choose Address Pop-up
  try {
    const hub = await getHubApi();
    if (!hub) return [];
    
    const chosen = await hub.chooseAddress({
      appName: 'Rosco',
    });

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
