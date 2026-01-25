import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, success } from './types';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS preflight
  if (handleCors(req, res)) return;

  success(res, {
    service: 'Octra Wallet API',
    version: '2.0.0',
    description: 'Comprehensive proxy API for Octra Network blockchain',
    endpoints: {
      // Wallet Endpoints
      health: {
        method: 'GET',
        path: '/api/health',
        description: 'API health check with uptime info'
      },
      balance: {
        method: 'GET',
        path: '/api/balance?addr=<address>',
        description: 'Get balance and nonce for an address'
      },
      account: {
        method: 'GET',
        path: '/api/account?addr=<address>',
        description: 'Get detailed account information'
      },
      transactions: {
        method: 'GET',
        path: '/api/txs?addr=<address>&limit=10',
        description: 'Get transaction history for an address'
      },
      sendTransaction: {
        method: 'POST',
        path: '/api/send-tx',
        description: 'Submit a signed transaction'
      },

      // Blockchain Explorer Endpoints
      epochs: {
        method: 'GET',
        path: '/api/epochs?limit=20&offset=0',
        description: 'Get list of finalized epochs'
      },
      validators: {
        method: 'GET',
        path: '/api/validators?limit=50&offset=0',
        description: 'Get list of network validators with performance metrics'
      },
      stats: {
        method: 'GET',
        path: '/api/stats',
        description: 'Get network-wide statistics (TPS, volume, accounts)'
      },
      stagingPool: {
        method: 'GET',
        path: '/api/staging-pool?limit=50',
        description: 'Get pending transactions in mempool'
      }
    },
    rpcEndpoint: process.env.OCTRA_RPC_URL || 'https://octra.network'
  });
}
