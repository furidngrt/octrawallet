import type { VercelRequest, VercelResponse } from '@vercel/node';

const OCTRA_RPC_URL = process.env.OCTRA_RPC_URL || 'https://octra.network';

/**
 * GET /api/tx/:hash
 * Get transaction status by hash
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
    const hash = req.query.hash as string;
    
    if (!hash) {
      return res.status(400).json({
        error: 'Missing hash parameter'
      });
    }

    const response = await fetch(`${OCTRA_RPC_URL}/tx/${hash}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ status: 'not_found' });
      }
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: errorText || response.statusText 
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ 
      error: `Failed to fetch transaction: ${error.message}` 
    });
  }
}


