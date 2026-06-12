const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const Datastore = require('nedb');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── NeDB Database (pure JS, no build needed) ────────────────────────────────
const db = new Datastore({
  filename: path.join(__dirname, 'sensor_data.db'),
  autoload: true
});

// Seed demo data jika kosong
db.count({}, (err, count) => {
  if (count === 0) {
    const docs = [];
    for (let i = 60; i >= 1; i--) {
      const temp = +(24 + Math.random() * 8).toFixed(1);
      const hum  = +(55 + Math.random() * 30).toFixed(1);
      const hi   = +(temp + (hum / 100) * 3).toFixed(1);
      const status = hum > 80 ? 'warning' : temp > 30 ? 'caution' : 'normal';
      const ts = new Date(Date.now() - i * 60000);
      docs.push({ temperature: temp, humidity: hum, heat_index: hi, device_id: 'ESP32-01', status, timestamp: ts.toISOString(), createdAt: ts });
    }
    db.insert(docs, (e, newDocs) => {
      console.log(`✅ Seeded ${newDocs.length} demo data points`);
    });
  }
});

// ── Helper ──────────────────────────────────────────────────────────────────
let autoId = 1000;
function nextId() { return ++autoId; }

function calcHeatIndex(T, H) {
  return +(T - 0.55 * (1 - H / 100) * (T - 14.5)).toFixed(2);
}

function classify(temp, hum) {
  if (hum > 85 || temp > 35) return 'danger';
  if (hum > 75 || temp > 30) return 'warning';
  return 'normal';
}

function formatRow(doc, idx) {
  return { ...doc, id: doc._id ? doc._id.slice(-6) : idx };
}

// ── Routes ──────────────────────────────────────────────────────────────────

// POST /api/data  ← ESP32 mengirim ke sini
app.post('/api/data', (req, res) => {
  const { temperature, humidity, device_id } = req.body;
  if (temperature === undefined || humidity === undefined) {
    return res.status(400).json({ error: 'temperature and humidity are required' });
  }

  const hi     = calcHeatIndex(+temperature, +humidity);
  const status = classify(+temperature, +humidity);
  const devId  = device_id || 'ESP32-01';
  const now    = new Date();

  const doc = {
    temperature: +temperature,
    humidity:    +humidity,
    heat_index:  hi,
    device_id:   devId,
    status,
    timestamp:   now.toISOString(),
    createdAt:   now
  };

  db.insert(doc, (err, newDoc) => {
    if (err) return res.status(500).json({ error: err.message });

    const row = formatRow(newDoc);
    io.emit('new-reading', row);

    if (status !== 'normal') {
      io.emit('alert', {
        level: status,
        message: status === 'danger'
          ? `⚠️ BAHAYA! Suhu ${temperature}°C, Kelembaban ${humidity}%`
          : `⚡ Peringatan: Suhu ${temperature}°C, Kelembaban ${humidity}%`,
        timestamp: now.toISOString()
      });
    }

    console.log(`📡 [${devId}] T:${temperature}°C H:${humidity}% HI:${hi}°C → ${status}`);
    res.status(201).json({ success: true, data: row });
  });
});

// GET /api/data
app.get('/api/data', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  db.find({}).sort({ createdAt: 1 }).limit(limit * 2).exec((err, docs) => {
    if (err) return res.status(500).json({ error: err.message });
    const rows = docs.slice(-limit).map((d, i) => formatRow(d, i));
    res.json(rows);
  });
});

// GET /api/data/latest
app.get('/api/data/latest', (req, res) => {
  db.find({}).sort({ createdAt: -1 }).limit(1).exec((err, docs) => {
    res.json(docs.length ? formatRow(docs[0]) : null);
  });
});

// GET /api/stats
app.get('/api/stats', (req, res) => {
  db.find({}, (err, docs) => {
    if (err || !docs.length) return res.json({});
    const temps = docs.map(d => d.temperature);
    const hums  = docs.map(d => d.humidity);
    const avg = arr => +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);
    res.json({
      avg_temp: avg(temps),
      max_temp: Math.max(...temps),
      min_temp: Math.min(...temps),
      avg_hum:  avg(hums),
      max_hum:  Math.max(...hums),
      min_hum:  Math.min(...hums),
      total_readings: docs.length,
      danger_count:  docs.filter(d => d.status === 'danger').length,
      warning_count: docs.filter(d => d.status === 'warning').length,
      normal_count:  docs.filter(d => d.status === 'normal').length
    });
  });
});

// GET /api/export
app.get('/api/export', (req, res) => {
  db.find({}).sort({ createdAt: 1 }).exec((err, docs) => {
    const csv = ['id,temperature,humidity,heat_index,device_id,status,timestamp']
      .concat(docs.map((d, i) =>
        `${d._id},${d.temperature},${d.humidity},${d.heat_index},${d.device_id},${d.status},${d.timestamp}`
      )).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="sensor_data.csv"');
    res.send(csv);
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── WebSocket ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Browser terhubung: ${socket.id}`);
  db.find({}).sort({ createdAt: -1 }).limit(30).exec((err, docs) => {
    const rows = docs.reverse().map((d, i) => formatRow(d, i));
    socket.emit('initial-data', rows);
  });
  socket.on('disconnect', () => {
    console.log(`❌ Browser disconnect: ${socket.id}`);
  });
});

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Humidity Monitor berjalan di port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`📡 ESP32 POST ke: http://localhost:${PORT}/api/data\n`);
});
