#!/usr/bin/env node
/**
 * Test de charge minimal (sans dépendance) pour core-api.
 *
 * Usage :
 *   node scripts/loadtest.mjs [url] [concurrency] [durationSec]
 * Exemple :
 *   node scripts/loadtest.mjs http://localhost:4000/api/health 50 10
 *
 * Mesure le débit (req/s) et les latences p50/p95/p99. Cible par défaut : la
 * sonde /health (sans authentification). Pour des routes protégées, adapter les
 * en-têtes ci-dessous.
 */
import http from 'node:http';
import https from 'node:https';
import { performance } from 'node:perf_hooks';

const url = process.argv[2] ?? 'http://localhost:4000/api/health';
const concurrency = parseInt(process.argv[3] ?? '50', 10);
const durationSec = parseInt(process.argv[4] ?? '10', 10);
const client = url.startsWith('https') ? https : http;

const latencies = [];
let ok = 0;
let errors = 0;
let running = true;

function once() {
  return new Promise((resolve) => {
    const start = performance.now();
    const req = client.get(url, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        latencies.push(performance.now() - start);
        if (res.statusCode && res.statusCode < 400) ok += 1;
        else errors += 1;
        resolve();
      });
    });
    req.on('error', () => {
      errors += 1;
      resolve();
    });
  });
}

async function worker() {
  while (running) {
    await once();
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  console.log(`Charge : ${concurrency} clients pendant ${durationSec}s -> ${url}`);
  const workers = Array.from({ length: concurrency }, () => worker());
  setTimeout(() => {
    running = false;
  }, durationSec * 1000);
  await Promise.all(workers);

  const sorted = latencies.slice().sort((a, b) => a - b);
  const total = ok + errors;
  console.log(`Requêtes : ${total} (ok=${ok}, erreurs=${errors})`);
  console.log(`Débit    : ${(total / durationSec).toFixed(1)} req/s`);
  console.log(`Latence  : p50=${percentile(sorted, 50).toFixed(1)}ms ` +
    `p95=${percentile(sorted, 95).toFixed(1)}ms p99=${percentile(sorted, 99).toFixed(1)}ms`);
}

void main();
