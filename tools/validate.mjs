// story graph validator — run with: node tools/validate.mjs
import { readFileSync, existsSync } from 'node:fs';
const src = readFileSync(new URL('../web/story.js', import.meta.url), 'utf8');
const win = {};
new Function('window', src)(win);
const S = win.STORY;
if (!S) { console.error('FAIL: story.js did not set window.STORY'); process.exit(1); }
const labels = S.labels, errors = [];

for (const [name, nodes] of Object.entries(labels)) {
  nodes.forEach((n, i) => {
    const chk = (t, what) => { if (t && t !== 'ROUTE' && t !== 'end_true' && !labels[t]) errors.push(`${name}[${i}] ${what}->missing ${t}`); };
    if (n.n === 'jump') chk(n.to, 'jump');
    if (n.n === 'menu') n.c.forEach(o => chk(o.go, 'menu'));
    if (n.n === 'cond') { chk(n.go, 'cond.go'); chk(n.skip, 'cond.skip'); }
    if ((n.n === 's' || n.n === 'n') && !n.t) errors.push(`${name}[${i}] empty text`);
  });
}

// reachability from start label
const start = 'ch1', seen = new Set(), stack = [start];
while (stack.length) {
  const cur = stack.pop();
  if (seen.has(cur) || !labels[cur]) continue;
  seen.add(cur);
  for (const n of labels[cur]) {
    if (n.to) stack.push(n.to);
    if (n.go) stack.push(n.go);
    if (n.skip) stack.push(n.skip);
    if (n.n === 'menu') n.c.forEach(o => stack.push(o.go));
  }
}
const unreach = Object.keys(labels).filter(l => !seen.has(l));
if (unreach.length) errors.push('unreachable: ' + unreach.join(', '));

// endings coverage
const need = ['be1','be2','normal','good','truee','h1','h2'];
for (const e of need) if (!S.ENDINGS[e]) errors.push('missing ending ' + e);

console.log(`labels=${Object.keys(labels).length} nodes=${Object.values(labels).reduce((t,l)=>t+l.length,0)} endings=${Object.keys(S.ENDINGS).length}`);
if (errors.length) { console.error('FAIL:\n' + errors.join('\n')); process.exit(1); }
console.log('STORY GRAPH OK');
