// Exporta o visualizer como MP4 (frame a frame, determinístico) + áudio.
//
//   npm install            (instala o playwright)
//   npx playwright install chromium
//   node render.mjs --audio hennessy.mp3 --inicio 2.084 --bpm 116 --compassos 8
//
// Opções: --saida video.mp4  --fps 60  --vertical  --repeticoes 4
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const audio = opt('audio');
if (!audio) {
  console.error('Uso: node render.mjs --audio musica.mp3 [--inicio 2.084] [--bpm 116] [--compassos 8]');
  process.exit(1);
}
const inicio = +opt('inicio', 2.084);
const bpm = +opt('bpm', 116);
const bars = +opt('compassos', 8);
const fps = +opt('fps', 60);
const vertical = !!opt('vertical', false);
const reps = Math.max(1, +opt('repeticoes', 1));
const saida = path.resolve(opt('saida', vertical ? 'visualizer-9x16.mp4' : 'visualizer-16x9.mp4'));
const seconds = (bars * 4 * 60) / bpm;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vis-'));
const clip = path.join(tmp, 'trecho.wav');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(inicio), '-t', String(seconds), '-i', path.resolve(audio), '-ac', '2', '-ar', '44100', clip]);

// servidor estático mínimo (módulos ES não carregam via file://)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = url === '/__trecho.wav' ? clip : path.join(here, url === '/' ? 'index.html' : url);
  if (!file.startsWith(here) && file !== clip) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(data);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[página]', e.message));
await page.goto(`http://127.0.0.1:${port}/?render${vertical ? '&vertical' : ''}`);
await page.waitForFunction(() => window.vis);
const info = await page.evaluate((o) => window.vis.init(o), { audioUrl: '/__trecho.wav', bpm, bars, fps, vertical });
console.log(`${info.frames} frames, ${info.seconds.toFixed(2)} s, ${info.w}x${info.h} -> ${saida}`);

const once = reps > 1 ? path.join(tmp, 'loop.mp4') : saida;
const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  '-i', clip,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', once,
], { stdio: ['pipe', 'inherit', 'inherit'] });

for (let i = 0; i < info.frames; i++) {
  const url = await page.evaluate((n) => window.vis.renderFrame(n), i);
  const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 30 === 0) process.stdout.write(`\rframe ${i}/${info.frames}`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
server.close();

if (reps > 1) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-stream_loop', String(reps - 1), '-i', once, '-c', 'copy', '-movflags', '+faststart', saida]);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\npronto: ${saida}`);
