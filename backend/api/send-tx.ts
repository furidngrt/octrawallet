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
  // Handle OPTIONS preflight FIRST, before any imports or logic
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.status(204).end();
    return;
  }

  // Set CORS headers for actual requests
  setCorsHeaders(res);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Dynamic import validation only for POST requests
  let validateTransactionData: any;
  let validatePayloadSize: any;
  try {
    const validationModule = await import('./validation.js');
    validateTransactionData = validationModule.validateTransactionData;
    validatePayloadSize = validationModule.validatePayloadSize;
  } catch (importError: any) {
    console.error('Failed to import validation module:', importError);
    // Fallback: inline basic validation
    validatePayloadSize = (payload: string, maxSize: number) => {
      return payload.length > maxSize ? { valid: false, error: `Payload too large` } : { valid: true };
    };
    validateTransactionData = (txData: any) => {
      if (!txData.from || !txData.to_ || !txData.amount || typeof txData.nonce !== 'number') {
        return { valid: false, error: 'Missing required fields' };
      }
      return { valid: true };
    };
  }

  try {
    // Validate payload size
    let txData: any;
    try {
      const bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const sizeCheck = validatePayloadSize(bodyString, 10000);
      if (!sizeCheck.valid) {
        return res.status(400).json({ error: sizeCheck.error });
      }

      txData = typeof req.body === 'object' ? req.body : JSON.parse(bodyString);
    } catch (parseError: any) {
      return res.status(400).json({ error: `Invalid JSON payload: ${parseError.message}` });
    }
    
    // Validate transaction data structure and types
    const validation = validateTransactionData(txData);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Forward to RPC
    let response: any;
    try {
      response = await fetch(`${OCTRA_RPC_URL}/send-tx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(txData),
      });
    } catch (fetchError: any) {
      console.error('Fetch error:', fetchError);
      return res.status(502).json({
        error: `Failed to connect to RPC: ${fetchError.message || 'Network error'}`
      });
    }

    const responseText = await response.text();
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { error: responseText || `RPC error: ${response.status} ${response.statusText}` };
      }
      return res.status(response.status >= 400 && response.status < 600 ? response.status : 502).json(errorData);
    }

    try {
      const data = JSON.parse(responseText);
      res.json(data);
    } catch {
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
    console.error('Send transaction error:', error);
    // Ensure CORS headers are set even on error
    setCorsHeaders(res);
    res.status(500).json({
      error: `Failed to send transaction: ${error.message || 'Unknown error'}`
    });
  }
}


