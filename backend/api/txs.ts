import type { VercelRequest, VercelResponse } from '@vercel/node';

const OCTRA_RPC_URL = process.env.OCTRA_RPC_URL || 'https://octra.network';

interface OctraTx {
  hash: string;
  epoch: number;
  data: string;
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

const ALLOWED_ORIGIN = 'https://octra-key.vercel.app';

function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
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

    const fetchLimit = Math.max(limit * 3, 50);
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

    const rpcData = await response.json() as OctraTxResponse;

    const matchingTxs: FormattedTx[] = [];
    let totalScanned = 0;
    
    for (const tx of (rpcData.transactions || [])) {
      totalScanned++;
      try {
        const txData: ParsedTxData = JSON.parse(tx.data);
        
        if (txData.from !== address && txData.to_ !== address) {
          continue;
        }
        
        const amountOCT = (parseInt(txData.amount, 10) / 1_000_000).toFixed(6);
        
        matchingTxs.push({
          hash: tx.hash,
          epoch: tx.epoch,
          from: txData.from,
          to: txData.to_,
          amount: amountOCT,
          timestamp: txData.timestamp,
          priority: txData.priority as 'normal' | 'express' || (txData.ou && parseInt(txData.ou) > 10000 ? 'express' : 'normal'),
          nonce: txData.nonce,
        });
        
        if (matchingTxs.length >= limit) {
          break;
        }
      } catch (err) {
        continue;
      }
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


