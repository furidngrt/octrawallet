# Octra Backend - Panduan Deploy VPS dengan Nginx

## 📦 File ZIP
File: `octra-backend.zip` (sudah tersedia di folder `deploy/`)

---

## 🚀 Step-by-Step Deployment

### Step 1: Upload ZIP ke VPS

```bash
# Dari komputer lokal
scp /Users/furi/Downloads/VSCODE/octra-wallet/deploy/octra-backend.zip root@43.173.30.252:/root/octra/
```

### Step 2: SSH ke VPS

```bash
ssh root@43.173.30.252
```

### Step 3: Install Node.js 20 (jika belum)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v  # Pastikan v20.x
```

### Step 4: Install PM2 Global

```bash
npm install -g pm2
```

### Step 5: Extract dan Setup Backend

```bash
cd /root/octra
unzip octra-backend.zip
cd octra-backend
npm install
```

### Step 6: Jalankan dengan PM2

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup  # Ikuti instruksi yang muncul
```

### Step 7: Test Backend

```bash
curl http://localhost:3001/api/health
# Output: {"status":"ok","rpc":"https://octra.network"}
```

---

## 🔧 Setup Nginx Reverse Proxy

### Step 8: Install Nginx

```bash
sudo apt update
sudo apt install nginx -y
```

### Step 9: Buat Config Nginx

```bash
sudo nano /etc/nginx/sites-available/octra-backend
```

**Paste config ini:**

```nginx
server {
    listen 80;
    server_name 43.173.30.252;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, X-Private-Key";
    }
}
```

Simpan: `Ctrl+O`, Enter, `Ctrl+X`

### Step 10: Enable Site dan Restart Nginx

```bash
sudo ln -s /etc/nginx/sites-available/octra-backend /etc/nginx/sites-enabled/
sudo nginx -t  # Test config
sudo systemctl restart nginx
```

### Step 11: Buka Firewall (jika aktif)

```bash
sudo ufw allow 80
sudo ufw allow 443
```

---

## ✅ Test Final

```bash
# Dari VPS
curl http://43.173.30.252/api/health

# Dari browser/komputer lain
# Buka: http://43.173.30.252/api/health
```

---

## 📋 Perintah PM2 Berguna

```bash
pm2 status              # Lihat status
pm2 logs octra-backend  # Lihat logs
pm2 restart octra-backend  # Restart
pm2 stop octra-backend     # Stop
```

---

## 🌐 Update Frontend

Update file frontend untuk menggunakan API VPS:
- Ubah `VITE_API_URL` di `.env.production` menjadi `http://43.173.30.252`
