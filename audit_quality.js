// audit_quality.js — comprehensive data quality checks for data.js school records
const fs = require('fs');

const content = fs.readFileSync('data.js', 'utf8');
const lines   = content.split('\n');

// ── Parse school records (each spans 3 lines, some have extra lines) ─────────
const schools = [];
let curState = '';
let buf = [], inRecord = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const stateM = line.match(/─── ([A-Z]{2}) \(/);
  if (stateM) { curState = stateM[1]; continue; }

  if (line.trim().startsWith('{ id:')) { buf = [line]; inRecord = true; continue; }
  if (inRecord) {
    buf.push(line);
    if (line.includes('},') || line.includes('} ]') || line.trimEnd().endsWith('},')) {
      const raw = buf.join(' ');
      const g = (re) => { const m = raw.match(re); return m ? m[1] : null; };
      const gn = (re) => { const v = g(re); return v != null ? Number(v) : null; };
      schools.push({
        state: curState,
        id:          g(/id:"([^"]+)"/),
        name:        g(/name:"([^"]+)"/),
        type:        g(/type:"([^"]+)"/),
        city:        g(/city:"([^"]+)"/),
        tuition_in:  gn(/tuition_in:(\d+)/),
        tuition_out: gn(/tuition_out:(\d+)/),
        room_board:  gn(/room_board:(\d+)/),
        books:       gn(/books:(\d+)/),
        avg_aid:     gn(/avg_aid:(\d+)/),
        accept:      gn(/accept:([\d.]+)/),
        retention:   gn(/retention:([\d.]+)/),
        grad_rate:   gn(/grad_rate:([\d.]+)/),
        employ_6mo:  gn(/employ_6mo:([\d.]+)/),
        offeredNull: raw.includes('offered:null'),
      });
      buf = []; inRecord = false;
    }
  }
}

const PUBLIC_TYPES = new Set(['Public 4-yr','Public 2-yr']);
const PRIVATE_TYPES = new Set(['Private 4-yr','Liberal Arts']);
const RATES = ['accept','retention','grad_rate','employ_6mo'];

const issues = {
  tuitionFlipped:   [],
  aidExceedsCost:   [],
  rateOutOfRange:   [],
  suspiciousOne:    [],
  zeroAidHighTuit:  [],
  privateTuitionMismatch: [],
  publicTuitionSame: [],
  stateMismatch:    [],
  duplicateIds:     [],
};

const idMap = {};
for (const s of schools) {
  if (!s.id) continue;
  idMap[s.id] = (idMap[s.id] || 0) + 1;
}

const rateCounts = {};

for (const s of schools) {
  const label = `[${s.state}] ${s.name} (${s.type})`;
  const totalCost = (s.tuition_in||0) + (s.room_board||0) + (s.books||0);

  if (PUBLIC_TYPES.has(s.type) && s.tuition_in > s.tuition_out)
    issues.tuitionFlipped.push(`${label}: in=${s.tuition_in} out=${s.tuition_out}`);

  if (s.avg_aid > totalCost && totalCost > 0)
    issues.aidExceedsCost.push(`${label}: aid=${s.avg_aid} vs cost=${totalCost} (in=${s.tuition_in}+rb=${s.room_board}+bk=${s.books})`);

  for (const r of RATES) {
    const v = s[r];
    if (v != null && (v < 0 || v > 1))
      issues.rateOutOfRange.push(`${label}: ${r}=${v}`);
  }

  if (s.grad_rate === 1) issues.suspiciousOne.push(`${label}: grad_rate=1`);
  if (s.retention === 1) issues.suspiciousOne.push(`${label}: retention=1`);

  if (PRIVATE_TYPES.has(s.type) && s.avg_aid === 0 && s.tuition_in > 20000)
    issues.zeroAidHighTuit.push(`${label}: tuition=${s.tuition_in}, aid=0`);

  if (PRIVATE_TYPES.has(s.type) && s.tuition_in !== s.tuition_out)
    issues.privateTuitionMismatch.push(`${label}: in=${s.tuition_in} out=${s.tuition_out}`);

  if (PUBLIC_TYPES.has(s.type) && s.tuition_in === s.tuition_out && s.tuition_in > 0)
    issues.publicTuitionSame.push(`${label}: both=${s.tuition_in}`);

  if (s.city && s.city.includes(', ')) {
    const cityState = s.city.split(', ').pop().trim();
    if (cityState.length === 2 && cityState !== s.state)
      issues.stateMismatch.push(`${label}: section=${s.state} city="${s.city}"`);
  }

  if (idMap[s.id] > 1)
    issues.duplicateIds.push(`${label}: id="${s.id}" appears ${idMap[s.id]}x`);

  const emp = s.employ_6mo;
  if (emp != null) {
    const key = emp.toFixed(2);
    rateCounts[key] = (rateCounts[key]||0) + 1;
  }
}

function section(title, arr) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`${title} (${arr.length})`);
  console.log('═'.repeat(60));
  if (!arr.length) console.log('  None.');
  else arr.forEach(x => console.log(' ', x));
}

section('1. TUITION FLIPPED (public in > out)', issues.tuitionFlipped);
section('2. AID EXCEEDS COST OF ATTENDANCE', issues.aidExceedsCost);
section('3. RATE OUT OF RANGE (outside 0–1)', issues.rateOutOfRange);
section('4. SUSPICIOUS grad_rate/retention = 1.0', issues.suspiciousOne);
section('5. ZERO AID ON HIGH-TUITION PRIVATE (>$20k)', issues.zeroAidHighTuit);
section('6. PRIVATE SCHOOL tuition_in ≠ tuition_out', issues.privateTuitionMismatch);
section('7. PUBLIC SCHOOL tuition_in = tuition_out', issues.publicTuitionSame);
section('8. STATE MISMATCH (city ≠ section)', issues.stateMismatch);
section('9. DUPLICATE IDs', issues.duplicateIds);

console.log('\n' + '═'.repeat(60));
console.log('10. employ_6mo DISTRIBUTION (top values)');
console.log('═'.repeat(60));
Object.entries(rateCounts)
  .sort((a,b) => b[1]-a[1])
  .slice(0, 15)
  .forEach(([v,c]) => console.log(`  ${v}: ${c} schools  ${'█'.repeat(Math.round(c/10))}`));

console.log(`\nTotal schools parsed: ${schools.length}`);
