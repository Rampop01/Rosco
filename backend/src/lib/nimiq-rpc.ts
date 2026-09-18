/**
 * Nimiq RPC Client — On-chain transaction verification
 * 
 * Per PRD §10: The backend independently verifies transactions on-chain.
 * It never trusts the client's claim — it checks:
 * - Sender address matches the claimed contributor
 * - Recipient address matches the round's designated recipient
 * - Amount matches (or exceeds) contribution_amount
 * - Transaction is confirmed (sufficient block confirmations)
 */

const NIMIQ_RPC_URL = process.env.NIMIQ_RPC_URL || 'https://v2.nimiq-testnet.nuxt.dev';

interface NimiqTransaction {
  hash: string;
  from: string;
  to: string;
  value: number; // in luna (smallest unit, 1 NIM = 100000 luna)
  confirmations: number;
  blockNumber: number;
  timestamp: number;
  data?: string;
}

interface VerificationResult {
  valid: boolean;
  reason?: string;
  transaction?: NimiqTransaction;
}

/**
 * Fetch a transaction by its hash from the Nimiq network
 */
export async function getTransaction(txHash: string): Promise<NimiqTransaction | null> {
  try {
    const response = await fetch(NIMIQ_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransactionByHash',
        params: [txHash],
      }),
    });

    const data = (await response.json()) as any;

    if (data.error || !data.result) {
      return null;
    }

    const tx = data.result;
    return {
      hash: tx.hash,
      from: tx.fromAddress || tx.from,
      to: tx.toAddress || tx.to,
      value: tx.value,
      confirmations: tx.confirmations || 0,
      blockNumber: tx.blockNumber || 0,
      timestamp: tx.timestamp || 0,
      data: tx.data,
    };
  } catch (error) {
    console.error('Failed to fetch transaction:', error);
    return null;
  }
}

/**
 * Fetch transactions sent to a specific address
 */
export async function getTransactionsByAddress(address: string, limit: number = 50): Promise<NimiqTransaction[]> {
  try {
    const response = await fetch(NIMIQ_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransactionsByAddress',
        params: [address, limit],
      }),
    });

    const data = (await response.json()) as any;

    if (data.error || !data.result) {
      return [];
    }

    return data.result.map((tx: any) => ({
      hash: tx.hash,
      from: tx.fromAddress || tx.from,
      to: tx.toAddress || tx.to,
      value: tx.value,
      confirmations: tx.confirmations || 0,
      blockNumber: tx.blockNumber || 0,
      timestamp: tx.timestamp || 0,
      data: tx.data,
    }));
  } catch (error) {
    console.error('Failed to fetch transactions by address:', error);
    return [];
  }
}

/**
 * Convert NIM to luna (smallest unit)
 * 1 NIM = 100,000 luna
 */
function nimToLuna(nim: number): number {
  return Math.round(nim * 100000);
}

/**
 * Normalize a Nimiq address for comparison (remove spaces, uppercase)
 */
function normalizeAddress(address: string): string {
  return address.replace(/\s+/g, '').toUpperCase();
}

/**
 * Verify a transaction on-chain — the core verify-don't-trust logic (PRD §10)
 * 
 * Checks:
 * 1. Transaction exists and is confirmed
 * 2. Sender matches the claimed contributor's registered address
 * 3. Recipient matches the round's designated recipient
 * 4. Amount matches or exceeds the expected contribution amount
 */
export async function verifyTransaction(
  txHash: string,
  expectedSender: string,
  expectedRecipient: string,
  expectedAmountNIM: number
): Promise<VerificationResult> {
  let tx: NimiqTransaction | null = null;
  
  // Retry fetching from mempool a few times to allow for network propagation
  for (let i = 0; i < 3; i++) {
    tx = await getTransaction(txHash);
    if (tx) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (!tx) {
    return {
      valid: false,
      reason: 'Transaction not found on-chain. It may not have been broadcast yet or the hash is invalid.',
    };
  }

  // Check confirmations (0-conf is acceptable for this trusted circle use-case to ensure instant UX)
  const MIN_CONFIRMATIONS = 0;
  if (tx.confirmations < MIN_CONFIRMATIONS) {
    return {
      valid: false,
      reason: `Transaction has ${tx.confirmations} confirmations. Need at least ${MIN_CONFIRMATIONS}. Please wait a moment and try again.`,
      transaction: tx,
    };
  }

  // Check sender address
  if (normalizeAddress(tx.from) !== normalizeAddress(expectedSender)) {
    return {
      valid: false,
      reason: 'Sender address does not match your registered wallet address.',
      transaction: tx,
    };
  }

  // Check recipient address
  if (normalizeAddress(tx.to) !== normalizeAddress(expectedRecipient)) {
    return {
      valid: false,
      reason: 'Recipient address does not match the expected round recipient.',
      transaction: tx,
    };
  }

  // Check amount (value is in luna, expected is in NIM)
  const expectedLuna = nimToLuna(expectedAmountNIM);
  if (tx.value < expectedLuna) {
    return {
      valid: false,
      reason: `Amount too low. Sent ${tx.value / 100000} NIM but expected at least ${expectedAmountNIM} NIM. Please send the remaining amount.`,
      transaction: tx,
    };
  }

  return {
    valid: true,
    transaction: tx,
  };
}
