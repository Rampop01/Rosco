/**
 * Nimiq Pay Mini App SDK Wrapper
 * 
 * Provides a typed interface to the Nimiq Pay SDK injected as window.nimiqPay.
 * The Mini App runs inside Nimiq Pay's webview — the SDK is injected by the host.
 * 
 * Key APIs:
 * - init(): Initialize the Mini App
 * - listAccounts(): Get user's Nimiq wallet addresses
 * - requestPayment(): Trigger the native payment dialog
 * - language: User's preferred language
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
  onThemeChange?: (theme: 'light' | 'dark') => void;
}

declare global {
  interface Window {
    nimiqPay?: NimiqPaySDK;
  }
}

// ─── SDK State ──────────────────────────────────────────────────────────────

let initialized = false;
let devMode = false;

// ─── Dev Mode Mock (for development outside Nimiq Pay) ──────────────────────

const mockSDK: NimiqPaySDK = {
  async init() {
    console.log('[Rosco Dev] Nimiq Pay SDK initialized (mock)');
  },
  async listAccounts() {
    // Return a mock testnet address for development
    return [{
      address: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
      label: 'Dev Wallet',
      balance: 1000,
    }];
  },
  async requestPayment(request: PaymentRequest) {
    console.log('[Rosco Dev] Payment requested (mock):', request);
    // Simulate a successful payment in dev mode
    const mockTxHash = `mock_tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    return {
      success: true,
      txHash: mockTxHash,
    };
  },
  language: 'en',
  theme: 'dark',
};

// ─── Public API ─────────────────────────────────────────────────────────────

function getSDK(): NimiqPaySDK {
  if (typeof window !== 'undefined' && window.nimiqPay) {
    return window.nimiqPay;
  }
  devMode = true;
  return mockSDK;
}

export async function initNimiqPay(): Promise<void> {
  if (initialized) return;
  const sdk = getSDK();
  await sdk.init();
  initialized = true;
  if (devMode) {
    console.log('[Rosco] Running in dev mode — Nimiq Pay SDK is mocked');
  }
}

export async function listAccounts(): Promise<NimiqAccount[]> {
  const sdk = getSDK();
  return sdk.listAccounts();
}

export async function requestPayment(request: PaymentRequest): Promise<PaymentResult> {
  const sdk = getSDK();
  return sdk.requestPayment(request);
}

export function getLanguage(): string {
  const sdk = getSDK();
  return sdk.language;
}

export function getTheme(): 'light' | 'dark' {
  const sdk = getSDK();
  return sdk.theme;
}

export function isDevMode(): boolean {
  return devMode;
}
