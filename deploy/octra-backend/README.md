# Octra Backend - VPS Deployment Guide

## Prerequisites

- Ubuntu VPS with Node.js 18+ installed
- PM2 installed globally (`npm install -g pm2`)

## Quick Deploy

### 1. Upload files to VPS

```bash
# On your local machine, from the project root:
scp -r deploy/octra-backend/* user@your-vps-ip:/root/octra/octra-backend/
```

### 2. SSH into VPS and install dependencies

```bash
ssh user@your-vps-ip
cd /root/octra/octra-backend
npm install
```

### 3. Start with PM2

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup  # Follow instructions to enable auto-start on reboot
```

### 4. Check status

```bash
pm2 status
pm2 logs octra-backend
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/balance/:address` | GET | Get balance |
| `/api/send-tx` | POST | Send transaction |
| `/api/tx/:hash` | GET | Get transaction status |
| `/api/txs?addr=...` | GET | Get transaction history |
| `/api/encrypted-balance?addr=...` | GET | Get encrypted balance |
| `/api/encrypt-balance` | POST | Encrypt balance |
| `/api/decrypt-balance` | POST | Decrypt balance |

## Environment Variables

- `PORT` - Server port (default: 3001)

## Nginx Reverse Proxy (Optional)

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Commands

```bash
pm2 restart octra-backend  # Restart
pm2 stop octra-backend     # Stop
pm2 delete octra-backend   # Remove from PM2
pm2 logs octra-backend     # View logs
```
