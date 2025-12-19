import type { VercelRequest, VercelResponse } from '@vercel/node';

const OCTRA_RPC_URL = process.env.OCTRA_RPC_URL || 'https://octra.network';

interface OctraTx {
  hash: string;
  epoch: number;
  data: string; // JSON string
  url: string;
}

interface OctraTxResponse {
  total_found: number;
  transactions: OctraTx[];
}

interface ParsedTxData {
  from: string;
  to_: string;
  amount: string;
  nonce: number;
  ou: string;
  timestamp: number;
  signature: string;
  public_key?: string;
  priority?: string;
  op_type?: string;
}

/**
 * GET /api/txs
 * Query params: addr (address), limit (number, default 10)
 * Get transaction history for an address
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const address = req.query.addr as string;
    const limit = parseInt((req.query.limit as string) || '10', 10);
    
    if (!address) {
      return res.status(400).json({
        error: 'Missing addr parameter. Use ?addr=oct...&limit=10'
      });
    }

    // Query Octra RPC for transactions
    // Note: We fetch more than limit to ensure we have enough after filtering
    const fetchLimit = Math.max(limit * 3, 50); // Fetch 3x to account for filtering
    const rpcUrl = `${OCTRA_RPC_URL}/txs?addr=${encodeURIComponent(address)}&limit=${fetchLimit}`;
    const response = await fetch(rpcUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `RPC error: ${response.status} ${errorText || response.statusText}`
      });
    }

    const rpcData: OctraTxResponse = await response.json();

    // Parse and filter transactions by address (STRICT: only from or to matches)
    interface FormattedTx {
      hash: string;
      epoch: number;
      from: string;
      to: string;
      amount: string;
      timestamp: number;
      priority: 'normal' | 'express';
      nonce: number;
    }
    const matchingTxs: FormattedTx[] = [];
    let totalScanned = 0;
    
    for (const tx of (rpcData.transactions || [])) {
      totalScanned++;
      try {
        const txData: ParsedTxData = JSON.parse(tx.data);
        
        // STRICT FILTER: Include ONLY if from == address OR to == address
        if (txData.from !== address && txData.to_ !== address) {
          continue; // Skip this transaction
        }
        
        // Convert amount from microOCT to OCT
        const amountOCT = (parseInt(txData.amount, 10) / 1_000_000).toFixed(6);
        
        matchingTxs.push({
          hash: tx.hash,
          epoch: tx.epoch,
          from: txData.from,
          to: txData.to_,
          amount: amountOCT,
          timestamp: txData.timestamp,
          priority: txData.priority || (txData.ou && parseInt(txData.ou) > 10000 ? 'express' : 'normal'),
          nonce: txData.nonce,
        });
        
        // Stop once we have enough matching transactions
        if (matchingTxs.length >= limit) {
          break;
        }
      } catch (err) {
        // Skip transactions that fail to parse
        continue;
      }
    }

    // Debug logging (dev only)
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n=== TRANSACTION FILTERING DEBUG ===');
      console.log('Wallet Address:', address);
      console.log('Total Txs Scanned:', totalScanned);
      console.log('Total Txs Matched:', matchingTxs.length);
      console.log('Requested Limit:', limit);
      console.log('===================================\n');
    }

    res.json({
      total: matchingTxs.length,
      transactions: matchingTxs,
    });
  } catch (error: any) {
    res.status(500).json({
      error: `Failed to fetch transactions: ${error.message}`
    });
  }
}

