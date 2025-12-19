import type { VercelRequest, VercelResponse } from '@vercel/node';

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
  res.setHeader('Content-Type', 'application/json');
  
  res.json({
    service: 'Octra Wallet API',
    status: 'ok',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      balance: '/api/balance?addr=<address>',
      transactions: '/api/txs?addr=<address>&limit=10',
      sendTransaction: '/api/send-tx (POST)',
    },
    documentation: 'Use /api/health to check API status'
  });
}

