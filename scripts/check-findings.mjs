#!/usr/bin/env node
/* JS twin of scripts/check-findings.py, printing the identical format so the two can be
   diffed. Contract §3 requires api/* to agree with the Python reference on fixtures/*.json.

   Usage: node scripts/check-findings.mjs fixtures/locks-v1.json [--server]
   --server also applies PII_DETECTED, which the Python reference does not implement
   (contract §3 marks it server-only), so diff without the flag. */
import { readFileSync } from 'node:fs';
import { check, checkServer } from '../api/_locks.js';

const args = process.argv.slice(2);
const server = args.includes('--server');
const path = args.find(a => !a.startsWith('--'));
const verdict = server ? checkServer : check;

const data = JSON.parse(readFileSync(path, 'utf8'));
let acc = 0, rej = 0;
data.forEach((f, i) => {
  const w = verdict(f);
  if (w.length) { rej++; console.log(`REJECT #${i} ${f.term_raw}: ${w.join(', ')}`); }
  else acc++;
});
console.log(`accepted ${acc} / rejected ${rej} / total ${data.length}`);
