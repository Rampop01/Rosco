/**
 * Nimiq Wallet SDK Wrapper for Rosco
 * 
 * Supports two real wallet modes:
 * 1. Nimiq Pay Mobile App: Uses @nimiq/mini-app-sdk (official Nimiq Pay Mini App SDK)
 * 2. Standard Web Browsers: Uses @nimiq/hub-api (official Nimiq Hub browser pop-up)
 */

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

let savedAccount: NimiqAccount | null = null;
let miniAppProviderInstance: any = null;
let hubApiInstance: any = null;

const HUB_URL = process.env.NEXT_PUBLIC_NIMIQ_HUB_URL || 'https://hub.nimiq.com';

function unwrap<T>(value: T | { error?: { message?: string } }, label: string): T {
  if (typeof value === 'object' && value !== null && 'error' in value) {
    const msg = (value as { error?: { message?: string } }).error?.message ?? `${label} failed`;
    throw new Error(msg);
  }
  return value as T;
}

export async function getMiniAppProvider(): Promise<any> {
  if (typeof window === 'undefined') return null;
  if ((window as any).nimiq) {
    return (window as any).nimiq;
  }
  if (!miniAppProviderInstance) {
    try {
      const { init } = await import('@nimiq/mini-app-sdk');
      miniAppProviderInstance = await init({ timeout: 5000 });
    } catch (e) {
      console.log('[Rosco] Not running inside Nimiq Pay Mini App host context');
      return (window as any).nimiq || null;
    }
  }
  return miniAppProviderInstance || (window as any).nimiq || null;
}

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
  return (window as any).nimiq || (window as any).nimiqPay;
}

export async function initNimiqPay(): Promise<void> {
  try {
    await getMiniAppProvider();
  } catch {
    // Non-blocking
  }
}

export async function listAccounts(): Promise<NimiqAccount[]> {
  // 1. Check cached session account
  if (savedAccount) {
    return [savedAccount];
  }

  const stored = getAccountFromStorage();
  if (stored) {
    savedAccount = stored;
    return [stored];
  }

  // 2. Official Nimiq Mini App SDK (triggers native bottom consent sheet in Nimiq Pay)
  try {
    const miniApp = await getMiniAppProvider();
    if (miniApp) {
      console.log('[Rosco] Requesting accounts via @nimiq/mini-app-sdk...');
      const res = await miniApp.listAccounts();

      let accountList: any[] = [];
      if (Array.isArray(res)) {
        accountList = res;
      } else if (res && typeof res === 'object') {
        if ('error' in res && (res as any).error) {
          throw new Error((res as any).error?.message || 'Nimiq account access denied');
        }
        if (Array.isArray((res as any).result)) {
          accountList = (res as any).result;
        } else if (Array.isArray((res as any).accounts)) {
          accountList = (res as any).accounts;
        } else if (Array.isArray((res as any).data)) {
          accountList = (res as any).data;
        } else if (typeof (res as any).address === 'string') {
          accountList = [(res as any).address];
        }
      }

      if (accountList.length > 0) {
        const first = accountList[0];
        let addr = '';
        let lbl = 'Nimiq Mobile Wallet';
        if (typeof first === 'string') {
          addr = first;
        } else if (first && typeof first === 'object') {
          addr = first.address || first.userFriendlyAddress || '';
          lbl = first.label || lbl;
        }

        if (addr && addr.trim().toUpperCase().startsWith('NQ')) {
          const acc: NimiqAccount = { address: addr.trim(), label: lbl };
          saveAccountToStorage(acc);
          return [acc];
        }
      }
    }
  } catch (err: any) {
    console.warn('[Rosco] Mini App SDK listAccounts error:', err);
    throw err;
  }

  // 3. Desktop Browser Fallback: Nimiq Hub API
  try {
    const hub = await getHubApi();
    if (hub) {
      let chosen: any = null;
      try {
        chosen = await hub.chooseAddress({ appName: 'Rosco' });
      } catch {
        const accounts = await hub.onboard({ appName: 'Rosco' });
        if (accounts?.[0]?.addresses?.[0]) {
          chosen = accounts[0].addresses[0];
        }
      }

      if (chosen && chosen.address) {
        const acc: NimiqAccount = {
          address: chosen.address,
          label: chosen.label || 'Nimiq Wallet',
        };
        saveAccountToStorage(acc);
        return [acc];
      }
    }
  } catch (err: any) {
    console.warn('[Rosco] Hub API account selection cancelled or failed:', err);
    throw err;
  }

  return [];
}

export async function requestPayment(request: PaymentRequest): Promise<PaymentResult> {
  // 1. Try Nimiq Mini App SDK (Nimiq Pay Mobile App)
  try {
    const miniApp = await getMiniAppProvider();
    if (miniApp) {
      const lunaAmount = Math.round(request.amount * 100000);
      const res = await miniApp.sendBasicTransactionWithData({
        recipient: request.recipient,
        value: lunaAmount,
        data: request.message || 'Rosco Group Savings',
      });
      const txHash = unwrap<string>(res, 'Payment');
      if (txHash) {
        return { success: true, txHash };
      }
    }
  } catch (e: any) {
    console.warn('[Rosco] Mini App payment failed or rejected:', e);
    return { success: false, error: e?.message || 'Payment cancelled by user' };
  }

  // 2. Desktop Browser Hub API Checkout Pop-up
  try {
    const hub = await getHubApi();
    if (!hub) {
      return { success: false, error: 'Hub API not available' };
    }
    
    const lunaAmount = Math.round(request.amount * 100000);
    const result = await hub.checkout({
      appName: 'Rosco',
      recipient: request.recipient,
      value: lunaAmount,
    });

    if (result && result.hash) {
      return { success: true, txHash: result.hash };
    } else {
      return { success: false, error: 'Transaction hash missing from response' };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Payment cancelled by user' };
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

export function resetWalletAccount(): void {
  savedAccount = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('rosco_wallet_address');
    localStorage.removeItem('rosco_wallet_label');
  }
}
