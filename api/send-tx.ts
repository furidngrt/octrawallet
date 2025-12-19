import type { VercelRequest, VercelResponse } from '@vercel/node';

const OCTRA_RPC_URL = process.env.OCTRA_RPC_URL || 'https://octra.network';

/**
 * POST /api/send-tx
 * Send transaction to octra.network
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS - allow all origins (or specify frontend domain)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const txData = req.body;
    
    // Validate required fields
    if (!txData.from || !txData.to_ || !txData.amount || !txData.signature || !txData.public_key) {
      return res.status(400).json({
        error: 'Missing required fields: from, to_, amount, signature, public_key'
      });
    }

    const response = await fetch(`${OCTRA_RPC_URL}/send-tx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(txData),
    });

    const responseText = await response.text();
    
    // Log request/response for debugging (in Vercel logs)
    console.log('\n=== RPC REQUEST ===');
    console.log('URL:', `${OCTRA_RPC_URL}/send-tx`);
    console.log('Payload:', JSON.stringify(txData, null, 2));
    console.log('\n=== RPC RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Response:', responseText);
    console.log('==================\n');
    
    if (!response.ok) {
      // Try to parse error response
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { error: responseText };
      }
      return res.status(response.status).json(errorData);
    }

    // Parse response
    try {
      const data = JSON.parse(responseText);
      res.json(data);
    } catch {
      // If not JSON, might be plain text "ok <hash>"
      if (responseText.toLowerCase().startsWith('ok')) {
        const parts = responseText.trim().split(/\s+/);
        res.json({
          status: 'accepted',
          tx_hash: parts[parts.length - 1]
        });
      } else {
        res.json({ response: responseText });
      }
    }
  } catch (error: any) {
    res.status(500).json({
      error: `Failed to send transaction: ${error.message}`
    });
  }
}


