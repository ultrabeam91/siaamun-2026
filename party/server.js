/**
 * LFL Listening Party — Local Server
 * Run: node party/server.js
 * Then open http://localhost:3000 on your screen
 * Guests scan the QR code and connect over WiFi
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── State ────────────────────────────────────────────────────────────────────
let phase = 'bingo';
let words = []; // [{ word, ts }]
let lastUpdate = Date.now();

// ── Local IP ─────────────────────────────────────────────────────────────────
function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

const PORT     = 3000;
const LOCAL_IP = getLocalIP();
const GUEST_URL = `http://${LOCAL_IP}:${PORT}/guest`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve({}); } });
    req.on('error', reject);
  });
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(fs.readFileSync(filePath, 'utf8'));
}

// ── Server ────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url  = new URL(req.url, `http://${req.headers.host}`);
  const p    = url.pathname;
  const meth = req.method;

  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (meth === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // ── API ──────────────────────────────────────────────────────────────────
  if (p === '/api/info') {
    return json(res, { guestUrl: GUEST_URL });
  }

  if (p === '/api/status') {
    return json(res, { phase, wordCount: words.length, lastUpdate });
  }

  if (p === '/api/words' && meth === 'GET') {
    return json(res, { phase, words, lastUpdate });
  }

  if (p === '/api/word' && meth === 'POST') {
    const body = await readBody(req);
    const word = String(body.word || '').trim().toUpperCase().replace(/[^A-Z0-9 ']/g, '');
    if (word) {
      words.push({ word, ts: Date.now() });
      lastUpdate = Date.now();
      console.log(`  Word: "${word}"  (${words.length} total)`);
    }
    return json(res, { ok: true });
  }

  if (p === '/api/phase' && meth === 'POST') {
    const body = await readBody(req);
    if (body.phase === 'bingo' || body.phase === 'submit') {
      phase = body.phase;
      lastUpdate = Date.now();
      console.log(`  Phase → ${phase}`);
    }
    return json(res, { ok: true });
  }

  if (p === '/api/clear' && meth === 'POST') {
    words = [];
    lastUpdate = Date.now();
    console.log('  Words cleared');
    return json(res, { ok: true });
  }

  // ── Pages ─────────────────────────────────────────────────────────────────
  if (p === '/' || p === '/host' || p === '/host.html') {
    return serveFile(res, path.join(__dirname, 'host.html'));
  }
  if (p === '/guest' || p === '/guest.html') {
    return serveFile(res, path.join(__dirname, 'guest.html'));
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   LFL LISTENING PARTY  —  LIVE       ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`\n  Host screen → http://localhost:${PORT}`);
  console.log(`  Guest link  → ${GUEST_URL}`);
  console.log('\n  Open the host screen on your laptop.');
  console.log('  Guests scan the QR code on screen.');
  console.log('\n  Press Ctrl+C to stop.\n');
});
