import type { VercelRequest, VercelResponse } from '@vercel/node';

const OCTRA_RPC_URL = process.env.OCTRA_RPC_URL || 'https://octra.network';

/**
 * GET /api/balance/:address
 * Path param: address
 * Get balance for an address
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
    // Vercel uses req.query for dynamic route segments
    const address = req.query.address as string;
    
    if (!address) {
      return res.status(400).json({
        error: 'Missing address parameter'
      });
    }

    const response = await fetch(`${OCTRA_RPC_URL}/balance/${address}`, {
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


