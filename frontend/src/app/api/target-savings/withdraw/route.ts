import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_MAINNET_RPC = 'https://rpc.nimiqwatch.com';
const DEFAULT_TESTNET_RPC = 'https://v2.nimiq-testnet.nuxt.dev';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recipientAddress, amount, grossAmount, feeAmount, goalId, goalTitle, network } = body;

    // Detect network: 'testnet' (NetworkId 1) or 'mainnet' (NetworkId 42)
    const requestedNetwork = network || process.env.NIMIQ_NETWORK || process.env.NEXT_PUBLIC_NIMIQ_NETWORK || 'mainnet';
    const isTestnet = requestedNetwork.toLowerCase().includes('test');
    const networkId = isTestnet ? 1 : 42;
    const rpcUrl = process.env.NIMIQ_RPC_URL || (isTestnet ? DEFAULT_TESTNET_RPC : DEFAULT_MAINNET_RPC);

    if (!recipientAddress || typeof recipientAddress !== 'string') {
      return NextResponse.json({ error: 'Valid recipient Nimiq address is required' }, { status: 400 });
    }

    const payoutAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    if (isNaN(payoutAmount) || payoutAmount <= 0) {
      return NextResponse.json({ error: 'Payout amount must be greater than 0 NIM' }, { status: 400 });
    }

    const seedWords = process.env.VAULT_SEED_WORDS;
    if (!seedWords) {
      return NextResponse.json({ 
        error: 'VAULT_SEED_WORDS environment variable is not configured on the server' 
      }, { status: 500 });
    }

    // Dynamically import @nimiq/core to ensure server-side wasm compatibility
    const N = await import('@nimiq/core');

    // 1. Derive Vault KeyPair from Mnemonic (BIP39 + Ed25519 is identical on Mainnet & Testnet)
    const words = seedWords.trim().split(/\s+/);
    const extPrivKey = N.MnemonicUtils.mnemonicToExtendedPrivateKey(words);
    const derived = extPrivKey.derivePath("m/44'/242'/0'/0'");
    const vaultKey = N.KeyPair.derive(derived.privateKey);
    const vaultAddress = vaultKey.toAddress();
    const vaultAddressFriendly = vaultAddress.toUserFriendlyAddress();

    // 2. Validate and parse recipient address
    let recipient: any;
    try {
      recipient = N.Address.fromUserFriendlyAddress(recipientAddress.trim());
    } catch (e: any) {
      return NextResponse.json({ 
        error: `Invalid recipient Nimiq address format: ${e.message || 'Check address checksum'}` 
      }, { status: 400 });
    }

    if (vaultAddressFriendly.replace(/\s+/g, '') === recipientAddress.replace(/\s+/g, '')) {
      return NextResponse.json({
        error: 'Recipient address cannot be the vault address itself'
      }, { status: 400 });
    }

    // 3. Query current block height and vault balance from Nimiq RPC
    let blockNumber = isTestnet ? 1000 : 61830000;
    let vaultBalanceLuna = BigInt(0);

    try {
      const blockRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBlockNumber', params: [] }),
      });
      if (blockRes.ok) {
        const blockData = await blockRes.json();
        if (blockData?.result?.data) {
          blockNumber = blockData.result.data;
        }
      }

      const accRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'getAccountByAddress', params: [vaultAddressFriendly] }),
      });
      if (accRes.ok) {
        const accData = await accRes.json();
        if (accData?.result?.data?.balance !== undefined) {
          vaultBalanceLuna = BigInt(accData.result.data.balance);
        }
      }
    } catch (rpcErr) {
      console.warn(`[Rosco Vault] RPC query failed on ${rpcUrl}, using fallback parameters:`, rpcErr);
    }

    // 4. Build and sign the transaction with the appropriate Network ID
    const lunaAmount = BigInt(Math.round(payoutAmount * 100000));
    const tx = N.TransactionBuilder.newBasic(
      vaultAddress,
      recipient,
      lunaAmount,
      BigInt(0), // 0 fee for basic tx
      blockNumber,
      networkId
    );

    tx.sign(vaultKey, undefined);
    const txHash = tx.hash();
    const rawTxHex = tx.toHex();

    // 5. If vault has sufficient on-chain balance, broadcast to Nimiq network
    let onChainSuccess = false;
    let broadcastHash = txHash;
    let broadcastError: string | null = null;

    if (vaultBalanceLuna >= lunaAmount) {
      try {
        const broadcastRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 3,
            method: 'sendRawTransaction',
            params: [rawTxHex],
          }),
        });

        if (broadcastRes.ok) {
          const bData = await broadcastRes.json();
          if (bData.result?.data) {
            onChainSuccess = true;
            broadcastHash = bData.result.data;
          } else if (bData.error) {
            broadcastError = bData.error.message || JSON.stringify(bData.error);
          }
        } else {
          broadcastError = `RPC HTTP ${broadcastRes.status}`;
        }
      } catch (err: any) {
        broadcastError = err.message || 'Network error broadcasting transaction';
      }
    } else {
      broadcastError = `Vault balance (${Number(vaultBalanceLuna) / 100000} NIM on ${isTestnet ? 'Testnet' : 'Mainnet'}) is insufficient for on-chain payout of ${payoutAmount} NIM`;
    }

    return NextResponse.json({
      success: true,
      txHash: broadcastHash,
      onChain: onChainSuccess,
      network: isTestnet ? 'testnet' : 'mainnet',
      networkId,
      warning: onChainSuccess ? null : broadcastError,
      payoutAmount,
      grossAmount: grossAmount ?? payoutAmount,
      feeAmount: feeAmount ?? 0,
      recipient: recipientAddress,
      vaultAddress: vaultAddressFriendly,
      blockNumber,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Rosco Vault Payout Error]:', err);
    return NextResponse.json({ 
      error: err.message || 'Failed to process vault payout' 
    }, { status: 500 });
  }
}
