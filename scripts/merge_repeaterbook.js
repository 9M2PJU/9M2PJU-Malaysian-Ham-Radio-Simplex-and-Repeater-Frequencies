#!/usr/bin/env node
/**
 * scripts/merge_repeaterbook.js
 *
 * Merges a RepeaterBook CSV export into 9M2PJU.csv (CHIRP format).
 *
 * What it does:
 *   - Updates existing repeater rows (frequency, offset, duplex, CTCSS tone,
 *     location) from the RepeaterBook data.
 *   - Adds new repeaters not yet present in 9M2PJU.csv.
 *   - Treats any RepeaterBook entry with no offset (input == output) as
 *     simplex (empty Duplex, no offset).
 *   - Preserves all simplex V-channels, PMR446 channels, state placeholder
 *     rows, existing coordinates, and comment suffixes (e.g. "MARTS Linking",
 *     "ASTRA Transnasional").
 *   - Renumbers the Location column sequentially.
 *
 * Usage:
 *   node scripts/merge_repeaterbook.js <repeaterbook_csv> [output_csv]
 *
 * If output_csv is omitted, defaults to ./9M2PJU.csv (in repo root).
 *
 * Exit codes:
 *   0 — success (changes may or may not have been made)
 *   1 — usage error / file not found / invalid RepeaterBook CSV
 *
 * Used by .github/workflows/update-repeaterbook.yml for automated monthly
 * updates, but can also be run locally:
 *   node scripts/merge_repeaterbook.js ~/Downloads/RB_*.csv
 */

const fs = require('fs');
const path = require('path');

// ── Argument parsing ──────────────────────────────────────────────────────
const rbFile = process.argv[2];
const csvFile = process.argv[3] || path.join(__dirname, '..', '9M2PJU.csv');

if (!rbFile) {
  console.error('Usage: node scripts/merge_repeaterbook.js <repeaterbook_csv> [output_csv]');
  process.exit(1);
}

if (!fs.existsSync(rbFile)) {
  console.error(`Error: RepeaterBook CSV not found: ${rbFile}`);
  process.exit(1);
}

if (!fs.existsSync(csvFile)) {
  console.error(`Error: 9M2PJU.csv not found: ${csvFile}`);
  process.exit(1);
}

// ── CSV parser (handles quoted fields with commas) ────────────────────────
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inQuotes) {
      if (c === '"' && n === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else { field += c; }
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function toObjects(rows) {
  if (rows.length < 2) return [];
  const h = rows[0];
  return rows.slice(1).filter(r => r.length === h.length).map(r => {
    const o = {};
    h.forEach((k, i) => { o[k] = r[i]; });
    return o;
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtFreq(v) {
  const f = parseFloat(v);
  if (isNaN(f)) return '';
  // CHIRP CSV style: drop trailing zeros (e.g. 145.6, 147.9875, 439.6)
  let s = f.toFixed(5);
  s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

function fmtOffset(diff) {
  // Round to 4 decimals to kill FP noise, then drop trailing zeros
  let s = (Math.round(diff * 10000) / 10000).toFixed(4);
  s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

function isRepeaterName(name) {
  return /^9[A-Z]/.test(name || '');
}

// Extract the suffix after "None OPEN" from an existing comment, e.g.
// "9M4RXX near FOO, None OPEN MARTS Linking" -> "MARTS Linking"
function extractSuffix(comment) {
  if (!comment) return '';
  const m = comment.match(/None OPEN\s*(.*)$/i);
  return m ? m[1].trim() : '';
}

function buildComment(call, rbLoc, suffix) {
  const base = `${call} near ${rbLoc}, None OPEN`;
  return suffix ? `${base} ${suffix}` : base;
}

// Determine mode from RepeaterBook Modes + Digital Access fields
function rbMode(e) {
  const m = (e.modes + ' ' + e.digital).toUpperCase();
  if (m.includes('DMR')) return 'DMR';
  return 'FM';
}

// Choose TStep for a new entry
function tstepFor(freq) {
  const f = parseFloat(freq);
  if (isNaN(f)) return '5';
  if (f >= 300) return '5'; // UHF
  // VHF: 12.5 if on 12.5kHz grid but not 25kHz grid
  const hz = Math.round(f * 1000000);
  if (hz % 12500 === 0 && hz % 25000 !== 0) return '12.5';
  return '5';
}

// ── Load and validate RepeaterBook CSV ────────────────────────────────────
const rbText = fs.readFileSync(rbFile, 'utf-8');
const rbParsed = parseCSV(rbText);

// Validate: RepeaterBook CSV header must contain "Output Freq" and "Call"
const rbHeader = rbParsed[0] || [];
const hasOutputFreq = rbHeader.some(h => h.trim() === 'Output Freq');
const hasCall = rbHeader.some(h => h.trim() === 'Call');
if (!hasOutputFreq || !hasCall) {
  console.error('Error: Input does not look like a RepeaterBook CSV.');
  console.error('  Expected header to contain "Output Freq" and "Call".');
  console.error('  Got: ' + rbHeader.join(', '));
  console.error('');
  console.error('This can happen if RepeaterBook returned an error page (HTML)');
  console.error('instead of a CSV download. Check the euid / URL.');
  process.exit(1);
}

const rbRows = toObjects(rbParsed);
const rbEntries = rbRows.map(r => ({
  call: (r['Call'] || '').trim(),
  output: parseFloat(r['Output Freq']),
  input: parseFloat(r['Input Freq']),
  uplinkTone: (r['Uplink Tone'] || '').trim(),
  downlinkTone: (r['Downlink Tone'] || '').trim(),
  location: (r['Location'] || '').trim(),
  modes: (r['Modes'] || '').trim(),
  digital: (r['Digital Access'] || '').trim(),
})).filter(e => e.call && !isNaN(e.output));

console.log(`Loaded ${rbEntries.length} RepeaterBook entries from ${rbFile}`);

// Group RB entries by call sign
const rbByCall = {};
for (const e of rbEntries) {
  if (!rbByCall[e.call]) rbByCall[e.call] = [];
  rbByCall[e.call].push(e);
}

// ── Load 9M2PJU.csv ───────────────────────────────────────────────────────
const csvText = fs.readFileSync(csvFile, 'utf-8');
const csvRows = parseCSV(csvText);
const header = csvRows[0];
const H = {};
header.forEach((h, i) => { H[h] = i; });
const dataRows = csvRows.slice(1);

// Column indices
const cLoc = H['Location'], cName = H['Name'], cFreq = H['Frequency'],
      cDup = H['Duplex'], cOff = H['Offset'], cTone = H['Tone'],
      cRtone = H['rToneFreq'], cCtone = H['cToneFreq'], cMode = H['Mode'],
      cTStep = H['TStep'], cPower = H['Power'], cComment = H['Comment'],
      cLat = H['Latitude'], cLon = H['Longitude'];

// Track which RB entries get consumed by an existing row update
const usedRb = new Set();
function rbKey(e) { return e.call + '|' + e.output; }

// Extract the base call sign from a possibly-suffixed name.
// e.g. "9M4RPH-DMR" -> "9M4RPH", "9M2RKL-L1" -> "9M2RKL", "9M4RJR-C4FM" -> "9M4RJR"
function baseCall(name) {
  return (name || '').replace(/-[A-Z0-9]+$/, '');
}

// ── Update existing repeater rows ─────────────────────────────────────────
const existingNames = new Set();
let updatedCount = 0;
let unchangedCount = 0;

for (const row of dataRows) {
  const name = (row[cName] || '').trim();
  existingNames.add(name);
  if (!isRepeaterName(name)) continue;
  // Only treat as repeater if Duplex is + or - (skip state placeholders)
  const dup = (row[cDup] || '').trim();
  if (dup !== '+' && dup !== '-') continue;

  // Match by exact name first, then by base call (for -DMR, -L, -L1, -C4FM suffixes)
  let candidates = rbByCall[name];
  if (!candidates) {
    const base = baseCall(name);
    if (base !== name) candidates = rbByCall[base];
  }
  if (!candidates || candidates.length === 0) continue;

  // Filter out already-used RB entries
  const available = candidates.filter(e => !usedRb.has(rbKey(e)));
  if (available.length === 0) continue;

  // Pick best candidate: prefer same mode, then closest output freq
  const curFreq = parseFloat(row[cFreq]);
  const curMode = (row[cMode] || '').trim().toUpperCase();
  const targetFreq = isNaN(curFreq) ? 0 : curFreq;

  let best = available[0];
  let bestScore = Infinity;
  for (const e of available) {
    const freqDiff = Math.abs(e.output - targetFreq);
    const modeMismatch = (rbMode(e) !== curMode) ? 1000 : 0;
    const score = modeMismatch + freqDiff;
    if (score < bestScore) { bestScore = score; best = e; }
  }

  // Mark this RB entry used
  usedRb.add(rbKey(best));

  // Compute new values
  const newFreq = fmtFreq(best.output);
  const diff = Math.abs(best.input - best.output);
  const isSimplex = diff === 0; // no offset -> simplex
  const newOff = isSimplex ? '' : fmtOffset(diff);
  const newDup = isSimplex ? '' : (best.input > best.output ? '+' : '-');
  const suffix = extractSuffix(row[cComment]);
  const newComment = buildComment(name, best.location, suffix);

  const before = [row[cFreq], row[cDup], row[cOff], row[cComment]].join('|');
  row[cFreq] = newFreq;
  row[cDup] = newDup;
  row[cOff] = newOff;
  if (!isSimplex && best.uplinkTone) {
    row[cRtone] = best.uplinkTone;
    if (!row[cTone] || row[cTone] === '') row[cTone] = 'Tone';
  }
  row[cComment] = newComment;
  // Mode: upgrade to DMR if RB says DMR, else keep existing
  if (rbMode(best) === 'DMR') row[cMode] = 'DMR';
  const after = [row[cFreq], row[cDup], row[cOff], row[cComment]].join('|');

  if (before !== after) updatedCount++;
  else unchangedCount++;
}

// ── Add new repeaters from RB not present in 9M2PJU ───────────────────────
const newRows = [];
let addedCount = 0;
const addedNames = new Set();

for (const e of rbEntries) {
  if (usedRb.has(rbKey(e))) continue;
  if (!e.call) continue;

  // Determine the name to use for this new entry
  let name = e.call;
  if (existingNames.has(name) || addedNames.has(name)) {
    // Duplicate call with a different freq/mode — derive a suffix
    const mode = rbMode(e);
    if (mode === 'DMR') {
      const dmrName = `${e.call}-DMR`;
      if (!existingNames.has(dmrName) && !addedNames.has(dmrName)) name = dmrName;
    }
    if (name === e.call) {
      // Fall back to a -L (linked/alternate) suffix
      const lName = `${e.call}-L`;
      if (existingNames.has(lName) || addedNames.has(lName)) continue; // skip if even -L taken
      name = lName;
    }
  }

  const freq = fmtFreq(e.output);
  const diff = Math.abs(e.input - e.output);
  const isSimplex = diff === 0; // no offset -> simplex
  const off = isSimplex ? '' : fmtOffset(diff);
  const dup = isSimplex ? '' : (e.input > e.output ? '+' : '-');
  const mode = rbMode(e);
  const tone = (!isSimplex && e.uplinkTone) ? 'Tone' : '';
  const rtone = (!isSimplex && e.uplinkTone) ? e.uplinkTone : '88.5';
  const ctone = '88.5';
  const comment = buildComment(name, e.location, '');
  const tstep = tstepFor(freq);

  const row = new Array(header.length).fill('');
  row[cName] = name;
  row[cFreq] = freq;
  row[cDup] = dup;
  row[cOff] = off;
  row[cTone] = tone;
  row[cRtone] = rtone;
  row[cCtone] = ctone;
  row[cMode] = mode;
  row[cTStep] = tstep;
  row[cPower] = '50W';
  row[cComment] = comment;
  // Defaults to match existing CHIRP-style rows
  row[H['DtcsCode']] = '23';
  row[H['DtcsPolarity']] = 'NN';
  row[H['RxDtcsCode']] = '23';
  row[H['CrossMode']] = 'Tone->Tone';

  newRows.push(row);
  addedNames.add(name);
  addedCount++;
}

// ── Reassemble: insert new repeater rows after the last existing repeater ─
let lastRepeaterIdx = -1;
for (let i = 0; i < dataRows.length; i++) {
  const name = (dataRows[i][cName] || '').trim();
  const dup = (dataRows[i][cDup] || '').trim();
  if (isRepeaterName(name) && (dup === '+' || dup === '-')) lastRepeaterIdx = i;
}

const finalData = dataRows.slice();
if (lastRepeaterIdx === -1) {
  finalData.push(...newRows);
} else {
  finalData.splice(lastRepeaterIdx + 1, 0, ...newRows);
}

// ── Renumber Location column sequentially ─────────────────────────────────
for (let i = 0; i < finalData.length; i++) {
  finalData[i][cLoc] = String(i + 1);
}

// ── Write CSV ─────────────────────────────────────────────────────────────
function csvField(v) {
  v = v == null ? '' : String(v);
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

const out = [header.map(csvField).join(',')];
for (const row of finalData) {
  out.push(row.map(csvField).join(','));
}
fs.writeFileSync(csvFile, out.join('\n') + '\n', 'utf-8');

console.log(`✓ Updated ${updatedCount} existing repeater rows (${unchangedCount} unchanged)`);
console.log(`✓ Added ${addedCount} new repeater rows`);
console.log(`✓ Total rows now: ${finalData.length}`);
if (addedCount > 0) {
  console.log('New entries:');
  for (const r of newRows) {
    console.log(`  - ${r[cName]} @ ${r[cFreq]} MHz (${r[cComment]})`);
  }
}

// Exit 0 regardless — the workflow checks git diff to decide whether to commit
process.exit(0);
