#!/usr/bin/env node

/**
 * Octra Wallet Backend API
 * Proxy server that calls octra.network RPC
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;
const OCTRA_RPC_URL = 'https://octra.network';

// Middleware
app.use(cors());
app.use(express.json());

/**
 * GET /api/balance (query param: addr)
 * or GET /api/balance/:address (path param)
 * Get balance for an address
 */
app.get('/api/balance/:address?', async (req, res) => {
  try {
    // Support both query param (?addr=) and path param (/:address)
    const address = req.query.addr || req.params.address;

    if (!address) {
      return res.status(400).json({
        error: 'Missing address. Use ?addr=<address> or /api/balance/<address>'
      });
    }

    const response = await fetch(`${OCTRA_RPC_URL}/balance/${address}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `RPC error: ${response.status} ${response.statusText}`
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: `Failed to fetch balance: ${error.message}`
    });
  }
});

/**
 * POST /api/send-tx
 * Send transaction to octra.network
 */
app.post('/api/send-tx', async (req, res) => {
  try {
    const txData = req.body;

    // Validate required fields
    if (!txData.from || !txData.to_ || !txData.amount || !txData.signature || !txData.public_key) {
      return res.status(400).json({
        error: 'Missing required fields'
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

    // Log request/response for debugging
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
  } catch (error) {
    res.status(500).json({
      error: `Failed to send transaction: ${error.message}`
    });
  }
});

/**
 * GET /api/tx/:hash
 * Get transaction status by hash
 */
app.get('/api/tx/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    const response = await fetch(`${OCTRA_RPC_URL}/tx/${hash}`);
    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ status: 'not_found' });
      }
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText || response.statusText });
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch transaction: ${error.message}` });
  }
});

/**
 * GET /api/txs
 * Query params: addr (address), limit (number, default 10)
 * Get transaction history for an address
 */
app.get('/api/txs', async (req, res) => {
  try {
    const address = req.query.addr;
    const limit = parseInt(req.query.limit || '10', 10);

    if (!address) {
      return res.status(400).json({
        error: 'Missing addr parameter. Use ?addr=oct...&limit=10'
      });
    }

    // Query Octra RPC for transactions
    // Note: We fetch more than limit to ensure we have enough after filtering
    const fetchLimit = Math.max(limit * 3, 50); // Fetch 3x to account for filtering
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

    const rpcData = await response.json();

    // Parse and filter transactions by address (STRICT: only from or to matches)
    const matchingTxs = [];
    let totalScanned = 0;

    for (const tx of (rpcData.transactions || [])) {
      totalScanned++;
      try {
        const txData = JSON.parse(tx.data);

        // STRICT FILTER: Include ONLY if from == address OR to == address
        if (txData.from !== address && txData.to_ !== address) {
          continue; // Skip this transaction
        }

        // Convert amount from microOCT to OCT
        const amountOCT = (parseInt(txData.amount, 10) / 1_000_000).toFixed(6);

        matchingTxs.push({
          hash: tx.hash,
          epoch: tx.epoch,
          from: txData.from,
          to: txData.to_,
          amount: amountOCT,
          timestamp: txData.timestamp,
          priority: txData.priority || (txData.ou && parseInt(txData.ou) > 10000 ? 'express' : 'normal'),
          nonce: txData.nonce,
        });

        // Stop once we have enough matching transactions
        if (matchingTxs.length >= limit) {
          break;
        }
      } catch (err) {
        // Skip transactions that fail to parse
        continue;
      }
    }

    // Debug logging (dev only)
    console.log('\n=== TRANSACTION FILTERING DEBUG ===');
    console.log('Wallet Address:', address);
    console.log('Total Txs Scanned:', totalScanned);
    console.log('Total Txs Matched:', matchingTxs.length);
    console.log('Requested Limit:', limit);
    console.log('===================================\n');

    res.json({
      total: matchingTxs.length,
      transactions: matchingTxs,
    });
  } catch (error) {
    res.status(500).json({
      error: `Failed to fetch transactions: ${error.message}`
    });
  }
});

/**
 * GET /api/encrypted-balance
 * Get encrypted (private) balance for an address
 * Query params: addr (address)
 * Headers: X-Private-Key (optional)
 */
app.get('/api/encrypted-balance', async (req, res) => {
  try {
    const address = req.query.addr;
    const privateKey = req.headers['x-private-key'];

    if (!address) {
      return res.status(400).json({
        error: 'Missing addr parameter'
      });
    }

    const headers = {
      'Content-Type': 'application/json',
    };

    if (privateKey) {
      headers['X-Private-Key'] = privateKey;
    }

    const response = await fetch(`${OCTRA_RPC_URL}/view_encrypted_balance/${address}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `RPC error: ${response.status} ${errorText}`
      });
    }

    const data = await response.json();

    // Parse and format the response
    const result = {
      public_balance: parseFloat(data.public_balance?.split(' ')[0] || '0'),
      public_balance_raw: parseInt(data.public_balance_raw || '0', 10),
      encrypted_balance: parseFloat(data.encrypted_balance?.split(' ')[0] || '0'),
      encrypted_balance_raw: parseInt(data.encrypted_balance_raw || '0', 10),
      total_balance: parseFloat(data.total_balance?.split(' ')[0] || '0'),
    };

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: `Failed to fetch encrypted balance: ${error.message}`
    });
  }
});

/**
 * POST /api/encrypt-balance
 * Encrypt public balance to private balance
 */
app.post('/api/encrypt-balance', async (req, res) => {
  try {
    const { address, amount, private_key, encrypted_data } = req.body;

    if (!address || !amount || !private_key || !encrypted_data) {
      return res.status(400).json({
        error: 'Missing required parameters: address, amount, private_key, encrypted_data'
      });
    }

    const response = await fetch(`${OCTRA_RPC_URL}/encrypt_balance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address,
        amount: String(amount),
        private_key,
        encrypted_data,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `RPC error: ${response.status} ${errorText}`
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: `Failed to encrypt balance: ${error.message}`
    });
  }
});

/**
 * POST /api/decrypt-balance
 * Decrypt private balance to public balance
 */
app.post('/api/decrypt-balance', async (req, res) => {
  try {
    const { address, amount, private_key, encrypted_data } = req.body;

    if (!address || !amount || !private_key || !encrypted_data) {
      return res.status(400).json({
        error: 'Missing required parameters: address, amount, private_key, encrypted_data'
      });
    }

    const response = await fetch(`${OCTRA_RPC_URL}/decrypt_balance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address,
        amount: String(amount),
        private_key,
        encrypted_data,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `RPC error: ${response.status} ${errorText}`
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: `Failed to decrypt balance: ${error.message}`
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', rpc: OCTRA_RPC_URL });
});

app.listen(PORT, () => {
  console.log(`Octra Wallet Backend running on http://localhost:${PORT}`);
  console.log(`RPC URL: ${OCTRA_RPC_URL}`);
});
