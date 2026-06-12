# 💧 Humidity Monitor — IoT Smart Monitoring System

Dashboard monitoring real-time berbasis ESP32 + DHT11 dengan Node.js backend dan WebSocket.

---

## 📁 Struktur Project

```
humidity-monitor/
├── server.js            ← Backend Node.js (Express + Socket.IO + SQLite)
├── package.json
├── render.yaml          ← Konfigurasi deploy ke Render.com
├── .gitignore
├── ESP32_DHT11.ino      ← Kode Arduino untuk ESP32 + DHT11
└── public/
    └── index.html       ← Dashboard frontend (light theme)
```

---

## 🔌 Wiring ESP32 + DHT11

```
DHT11           ESP32
─────────────────────
VCC (pin 1) --> 3.3V
DATA(pin 2) --> GPIO 4
GND (pin 4) --> GND
```
> Pasang resistor 10kΩ antara VCC dan DATA (pull-up).

---

## 🛠️ Setup Library Arduino

1. Buka Arduino IDE
2. **Tools → Manage Libraries**
3. Instal:
   - `DHT sensor library` by Adafruit
   - `Adafruit Unified Sensor` by Adafruit
   - `ArduinoJson` by Benoit Blanchon
4. **Tools → Board → ESP32 Arduino → ESP32 Dev Module**

---

## 💻 Menjalankan Server Lokal

```bash
# 1. Install dependencies
npm install

# 2. Jalankan server
npm start
# atau untuk development:
npm run dev

# 3. Buka browser
# http://localhost:3000
```

---

## 🌐 Deploy ke Render.com (Tutorial Lengkap)

### Langkah 1: Upload ke GitHub

```bash
# Di folder project
git init
git add .
git commit -m "Initial commit: Humidity Monitor IoT"

# Buat repo baru di github.com → New Repository
# Nama: humidity-monitor
# Visibility: Public

git remote add origin https://github.com/USERNAME/humidity-monitor.git
git branch -M main
git push -u origin main
```

### Langkah 2: Daftar & Login Render.com

1. Buka https://render.com
2. Klik **Get Started for Free**
3. Sign up dengan akun GitHub kamu
4. Klik **Authorize render**

### Langkah 3: Buat Web Service

1. Di dashboard Render, klik **+ New → Web Service**
2. Klik **Connect a repository**
3. Pilih repo `humidity-monitor` dari daftar
4. Klik **Connect**

### Langkah 4: Konfigurasi Deployment

Isi form berikut:

| Field | Value |
|-------|-------|
| **Name** | `humidity-monitor` |
| **Region** | Singapore (paling dekat dengan Indonesia) |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | `Free` |

5. Scroll ke bawah → **Advanced → Add Environment Variable**:
   - Key: `NODE_ENV` → Value: `production`

6. Klik **Create Web Service**

### Langkah 5: Tunggu Deploy

- Render akan build otomatis (~2-3 menit)
- Status berubah dari **Building** → **Live**
- URL kamu: `https://humidity-monitor-xxxx.onrender.com`

### Langkah 6: Update URL di ESP32

Setelah mendapat URL Render, update `ESP32_DHT11.ino`:

```cpp
// Ganti baris ini:
const char* serverURL = "http://192.168.1.X:3000/api/data";

// Dengan URL Render kamu:
const char* serverURL = "https://humidity-monitor-xxxx.onrender.com/api/data";
```

Upload ulang ke ESP32.

---

## 📡 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/data` | ESP32 kirim data sensor |
| `GET`  | `/api/data` | Ambil riwayat data |
| `GET`  | `/api/data/latest` | Data terbaru |
| `GET`  | `/api/stats` | Statistik keseluruhan |
| `GET`  | `/api/export` | Download CSV |

### Contoh POST dari ESP32:
```json
{
  "temperature": 28.5,
  "humidity": 72.3,
  "device_id": "ESP32-01"
}
```

---

## ⚠️ Catatan Render Free Plan

- Server **tidur** setelah 15 menit tidak ada request
- ESP32 mungkin perlu kirim beberapa request dulu sebelum server bangun (~30 detik)
- Untuk production, pertimbangkan plan berbayar atau UptimeRobot untuk keep-alive

---

## 🎯 Fitur Dashboard

- ✅ Monitoring real-time via WebSocket
- ✅ Gauge suhu dan kelembaban
- ✅ Grafik tren (30 data terakhir)
- ✅ Distribusi status (pie chart)
- ✅ Tabel riwayat pembacaan
- ✅ Alert otomatis (warning & danger)
- ✅ Export data ke CSV
- ✅ Statistik rata-rata/min/max
