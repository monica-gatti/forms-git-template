// Applies a Yeeso Coffee issue form to data/events.json, then regenerates EVENTS.md.
// Run without ISSUE_BODY to only regenerate EVENTS.md.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DATA = 'data/events.json';
const OUT = 'EVENTS.md';

const FIELDS = {
  'Action': 'action',
  'Date': 'date',
  'Special Guest Speech': 'speech',
  'Special Guest': 'guest',
  'Yeeso Team': 'team',
  'Status Special Guest': 'status',
  'Icebreaker': 'icebreaker',
  'COM link': 'com',
};

function result(msg, ok = true) {
  writeFileSync('result.txt', msg);
  console.log(msg);
  if (!ok) process.exit(1);
}

// Issue forms produce: "### Label\n\nvalue\n\n### Next label ..."
function parseIssue(body) {
  const out = {};
  for (const block of body.split(/^### /m).slice(1)) {
    const [label, ...rest] = block.split('\n');
    const key = FIELDS[label.trim()];
    if (!key) continue;
    const value = rest.join('\n').trim();
    out[key] = value === '_No response_' ? '' : value;
  }
  return out;
}

const clean = (s) => s.replace(/\r?\n+/g, ' ').replace(/\|/g, '\\|').trim();

const events = existsSync(DATA) ? JSON.parse(readFileSync(DATA, 'utf8')) : [];

if (process.env.ISSUE_BODY) {
  const f = parseIssue(process.env.ISSUE_BODY);
  const date = (f.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + 'T00:00:00Z'))) {
    result(`Invalid date "${date}". Please use the format YYYY-MM-DD and submit the form again.`, false);
  }
  const idx = events.findIndex((e) => e.date === date);

  if (f.action === 'Delete') {
    if (idx === -1) result(`No event found on ${date}, nothing deleted.`, false);
    events.splice(idx, 1);
    result(`Event of ${date} deleted.`);
  } else {
    const ev = idx === -1
      ? { date, speech: '', guest: '', team: '', status: '🟡', icebreaker: '', com: '' }
      : events[idx];
    for (const key of ['speech', 'guest', 'team', 'icebreaker', 'com']) {
      if (f[key] === '-') ev[key] = '';
      else if (f[key]) ev[key] = clean(f[key]);
    }
    if (f.status) ev.status = f.status.split(' ')[0]; // keep only the emoji
    if (idx === -1) events.push(ev);
    result(`Event of ${date} ${idx === -1 ? 'created' : 'updated'}. See EVENTS.md.`);
  }
}

// ---- Render EVENTS.md ----
events.sort((a, b) => a.date.localeCompare(b.date));
writeFileSync(DATA, JSON.stringify(events, null, 2) + '\n');

const d = (s) => new Date(s + 'T00:00:00Z');
const monthTitle = (s) =>
  d(s).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const weekday = (s) => d(s).toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' });
const com = (v) => (!v ? '' : /^https?:\/\//.test(v) ? `[✅](${v})` : v);

const months = new Map();
for (const e of events) {
  const key = e.date.slice(0, 7); // YYYY-MM, already sorted
  if (!months.has(key)) months.set(key, []);
  months.get(key).push(e);
}

const header =
  '| Date | Special Guest Speech | Special Guest | Yeeso Team | Status Special Guest | Icebreaker | COM lnk |\n' +
  '|------|-------|---------------|------------|--------|---|---|';

const sections = [...months.values()].map((list) => {
  const rows = list.map((e) =>
    `| ${weekday(e.date)} ${e.date} | ${e.speech} | ${e.guest} | ${e.team} | ${e.status} | ${e.icebreaker} | ${com(e.com)} |`
  );
  return `## ${monthTitle(list[0].date)}\n\n${header}\n${rows.join('\n')}`;
});

const md =
  '# Yeeso Coffee events\n\n' +
  '> This file is generated automatically. To add or edit an event, use the ' +
  '[event form](../../issues/new/choose).\n\n' +
  'Legend: 🟢 confirmed · 🟡 to confirm · 🔴 cancelled\n\n' +
  sections.join('\n\n---\n\n') + '\n';

writeFileSync(OUT, md);
console.log(`${OUT} regenerated with ${events.length} events.`);
