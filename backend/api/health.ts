import type { VercelRequest, VercelResponse } from '@vercel/node';

const OCTRA_RPC_URL = process.env.OCTRA_RPC_URL || 'https://octra.network';
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

  res.json({ 
    status: 'ok', 
    rpc: OCTRA_RPC_URL,
    timestamp: new Date().toISOString()
  });
}


