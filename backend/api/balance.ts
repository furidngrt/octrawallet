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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const addr = req.query.addr as string;
    
    if (!addr) {
      return res.status(400).json({
        error: 'Missing addr parameter. Use ?addr=oct...'
      });
    }

    const response = await fetch(`${OCTRA_RPC_URL}/balance/${addr}`, {
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

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({
      error: `Failed to fetch balance: ${error.message}`
    });
  }
}


