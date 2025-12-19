# Octra Wallet (Mainnet)

MVP wallet for Octra mainnet: import wallet, view balance, send OCT transactions.

## Architecture

- **Frontend**: React + TypeScript (Vite)
- **Backend**: Express.js proxy server (calls octra.network RPC)
- **RPC**: https://octra.network

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Start backend server
```bash
npm run server
```
Backend runs on http://localhost:3001

### 3. Start frontend (in another terminal)
```bash
npm run dev
```
Frontend runs on http://localhost:5173

## Environment Variables

Create `.env` file (optional):
```
VITE_API_URL=http://localhost:3001/api
```

If not set, frontend will try backend proxy first, then fallback to direct RPC.

## Features

- Import wallet via private key or wallet.json (pre-client compatible)
- View balance from mainnet RPC
- Send OCT transactions (locally signed)
- Compatible with Octra pre-client wallet format

## Wallet Format

Compatible with Octra pre-client wallet.json:
```json
{
  "priv": "your-private-key",
  "addr": "octx...",
  "rpc": "https://octra.network"
}
```

## API Endpoints (Backend)

- `GET /api/balance/:address` - Get balance and nonce
- `POST /api/send-tx` - Send transaction
- `GET /api/health` - Health check

## RPC Endpoint

Mainnet: `https://octra.network`# Updated
