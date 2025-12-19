import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
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

