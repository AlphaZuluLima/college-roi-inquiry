// charts.jsx — Custom SVG charts in editorial-data-journalism style.
const { useMemo, useRef, useState, useEffect } = React;

const C = {
  ink: "var(--ink)",
  ink2: "var(--ink-2)",
  rule: "var(--rule)",
  paper: "var(--paper)",
  paper2: "var(--paper-2)",
  accent: "var(--accent)",
  warn: "var(--warn)",
  pos: "var(--pos)",
  neg: "var(--neg)",
  hs: "var(--hs)",
  alt: "var(--alt)",
};

function EarningsChart({ result, height = 360, width = 760 }) {
  const m = { l: 70, r: 24, t: 24, b: 44 };
  const W = width - m.l - m.r;
  const H = height - m.t - m.b;
  const series = result.series;
  const xMax = series[series.length - 1].age;
  const xMin = 18;
  const allVals = series.flatMap(s => [s.degreeNet, s.hsNet, s.investAlt]);
  const yMin = Math.min(0, ...allVals);
  const yMax = Math.max(...allVals);
  const yPad = (yMax - yMin) * 0.05;

  const x = (age) => ((age - xMin) / (xMax - xMin)) * W;
  const y = (v) => H - ((v - yMin) / (yMax - yMin + 2 * yPad)) * H;

  const path = (key) =>
    series.map((s, i) => `${i === 0 ? "M" : "L"} ${x(s.age).toFixed(1)} ${y(s[key]).toFixed(1)}`).join(" ");

  const yTicks = niceTicks(yMin, yMax, 5);
  const xTicks = [22, 30, 40, 50, 60, 68];

  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);

  function onMove(e) {
    const r = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width - m.l;
    if (px < 0 || px > W) { setHover(null); return; }
    const ageF = xMin + (px / W) * (xMax - xMin);
    const idx = Math.max(0, Math.min(series.length - 1, Math.round(ageF - 18)));
    setHover(idx);
  }

  return (
    <div className="chart-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="chart-svg"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <g transform={`translate(${m.l},${m.t})`}>
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={0} x2={W} y1={y(t)} y2={y(t)} stroke={C.rule} strokeWidth={t === 0 ? 1 : 0.5} strokeDasharray={t === 0 ? "" : "2 3"} />
              <text x={-8} y={y(t) + 3.5} textAnchor="end" className="ax-label">
                {fmtAxis(t)}
              </text>
            </g>
          ))}
          <line x1={0} x2={W} y1={H} y2={H} stroke={C.ink2} strokeWidth={0.8} />
          {xTicks.map((t, i) => (
            <g key={i}>
              <line x1={x(t)} x2={x(t)} y1={H} y2={H + 4} stroke={C.ink2} strokeWidth={0.8} />
              <text x={x(t)} y={H + 18} textAnchor="middle" className="ax-label">{t}</text>
            </g>
          ))}
          <text x={W / 2} y={H + 36} textAnchor="middle" className="ax-title">Age</text>

          <rect x={0} y={0} width={x(18 + result.yearsCount)} height={H}
                fill={C.paper2} opacity="0.7" />
          <text x={x(18 + result.yearsCount) / 2} y={14} textAnchor="middle" className="annot">
            in school
          </text>

          <path d={path("investAlt")} fill="none" stroke={C.alt} strokeWidth={1.4} strokeDasharray="3 4" />
          <path d={path("hsNet")} fill="none" stroke={C.hs} strokeWidth={1.6} />
          <path d={path("degreeNet")} fill="none" stroke={C.accent} strokeWidth={2.4} />

          {result.principal > 0 && (() => {
            const payoffAge = 18 + result.yearsCount + result.loanTerm;
            const payoffIdx = result.yearsCount + result.loanTerm;
            const payoffY = payoffIdx < result.series.length ? y(result.series[payoffIdx].degreeNet) : H;
            return (
              <g>
                <line x1={x(payoffAge)} x2={x(payoffAge)}
                      y1={0} y2={H} stroke={C.accent} strokeWidth={0.8} strokeDasharray="2 3" opacity="0.7" />
                <circle cx={x(payoffAge)} cy={payoffY} r={4} fill={C.accent} />
                <text x={x(payoffAge) + 6} y={payoffY - 8} className="annot accent">
                  loan paid off at {payoffAge}
                </text>
              </g>
            );
          })()}

          <EndLabel x={W} y={y(series[series.length-1].degreeNet)} text={`Degree path · ${fmtAxis(series[series.length-1].degreeNet)}`} color={C.accent} bold />
          <EndLabel x={W} y={y(series[series.length-1].hsNet)} text={`HS only · ${fmtAxis(series[series.length-1].hsNet)}`} color={C.hs} />
          <EndLabel x={W} y={y(series[series.length-1].investAlt)} text={`HS + invest cost · ${fmtAxis(series[series.length-1].investAlt)}`} color={C.alt} />

          {hover != null && (
            <g pointerEvents="none">
              <line x1={x(series[hover].age)} x2={x(series[hover].age)} y1={0} y2={H}
                    stroke={C.ink} strokeWidth={0.5} opacity={0.4} />
              {["degreeNet", "hsNet", "investAlt"].map((k) => (
                <circle key={k} cx={x(series[hover].age)} cy={y(series[hover][k])} r={3.5}
                        fill={k === "degreeNet" ? C.accent : k === "hsNet" ? C.hs : C.alt} stroke="white" strokeWidth={1} />
              ))}
            </g>
          )}
        </g>
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{
          left: `${((m.l + (hover * W / (series.length - 1))) / width * 100)}%`,
        }}>
          <div className="tip-h">Age {series[hover].age}</div>
          <div className="tip-row"><span className="dot" style={{ background: "var(--accent)" }} />Degree<b>{fmtAxis(series[hover].degreeNet)}</b></div>
          <div className="tip-row"><span className="dot" style={{ background: "var(--hs)" }} />HS only<b>{fmtAxis(series[hover].hsNet)}</b></div>
          <div className="tip-row"><span className="dot" style={{ background: "var(--alt)" }} />Invest alt.<b>{fmtAxis(series[hover].investAlt)}</b></div>
        </div>
      )}
    </div>
  );
}

function EndLabel({ x, y, text, color, bold }) {
  return (
    <text x={x + 4} y={y + 3.5} className={"end-label" + (bold ? " bold" : "")} fill={color}>
      {text}
    </text>
  );
}

function Sankey({ result, height = 280, width = 760 }) {
  const r = result;
  const tuitionTot = r.yearly.tuition * r.yearsCount;
  const rbTot = r.yearly.roomBoard * r.yearsCount;
  const booksTot = r.yearly.books * r.yearsCount;
  const aidTot = r.totalAid;
  const loaned = r.principal;
  const interest = r.totalInterest;

  const m = { l: 0, r: 0, t: 22, b: 22 };
  const W = width - m.l - m.r;
  const H = height - m.t - m.b;
  const colW = W / 3;

  const left = [
    { label: "Tuition & fees", value: tuitionTot, color: "var(--accent)" },
    { label: "Room & board", value: rbTot, color: "var(--accent-2)" },
    { label: "Books & supplies", value: booksTot, color: "var(--accent-3)" },
    ...(interest > 0 ? [{ label: "Loan interest", value: interest, color: "var(--warn)" }] : []),
  ];
  const middle = [
    { label: "Grants & aid", value: aidTot, color: "var(--pos)" },
    { label: "Borrowed (principal)", value: loaned, color: "var(--ink-2)" },
    { label: "Loan interest", value: interest, color: "var(--warn)" },
  ].filter(d => d.value > 0);

  const layoutCol = (items, total, x) => {
    const gap = 6;
    const totGap = gap * (items.length - 1);
    let yc = 0;
    return items.map((it) => {
      const h = total > 0 ? (it.value / total) * (H - totGap) : 0;
      const node = { ...it, x, y: yc, w: 14, h };
      yc += h + gap;
      return node;
    });
  };

  const totalLeft = left.reduce((a, n) => a + n.value, 0);
  const totalMid = middle.reduce((a, n) => a + n.value, 0);
  const leftNodes = layoutCol(left, totalLeft, colW * 0.95 - 14);
  const midNodes = layoutCol(middle, totalMid, colW * 1.6);

  const flows = [];
  const aidShare = aidTot / (aidTot + loaned || 1);
  const principalShare = loaned / (aidTot + loaned || 1);
  let leftYAccum = leftNodes.map(n => n.y);
  let midYAid = midNodes.find(n => n.label === "Grants & aid")?.y ?? 0;
  let midYPrin = midNodes.find(n => n.label === "Borrowed (principal)")?.y ?? 0;

  const costItems = leftNodes.filter(n => n.label !== "Loan interest");
  for (const c of costItems) {
    const idx = leftNodes.indexOf(c);
    const toAid = c.h * aidShare;
    const toPrin = c.h * principalShare;
    if (aidTot > 0 && toAid > 0.5) {
      flows.push({ x1: c.x + 14, y1Top: leftYAccum[idx], y1Bot: leftYAccum[idx] + toAid,
                   x2: midNodes[0].x, y2Top: midYAid, y2Bot: midYAid + toAid, color: c.color });
      midYAid += toAid;
      leftYAccum[idx] += toAid;
    }
    if (toPrin > 0.5) {
      const prinIdx = midNodes.findIndex(n => n.label === "Borrowed (principal)");
      flows.push({ x1: c.x + 14, y1Top: leftYAccum[idx], y1Bot: leftYAccum[idx] + toPrin,
                   x2: midNodes[prinIdx].x, y2Top: midYPrin, y2Bot: midYPrin + toPrin, color: c.color });
      midYPrin += toPrin;
      leftYAccum[idx] += toPrin;
    }
  }
  const intLeft = leftNodes.find(n => n.label === "Loan interest");
  const intMid = midNodes.find(n => n.label === "Loan interest");
  if (intLeft && intMid) {
    flows.push({ x1: intLeft.x + 14, y1Top: intLeft.y, y1Bot: intLeft.y + intLeft.h,
                 x2: intMid.x, y2Top: intMid.y, y2Bot: intMid.y + intMid.h, color: intLeft.color });
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg sankey">
      <g transform={`translate(${m.l},${m.t})`}>
        {flows.map((f, i) => (
          <path key={i}
                d={sankeyCurve(f.x1, f.y1Top, f.x1, f.y1Bot, f.x2, f.y2Top, f.x2, f.y2Bot)}
                fill={f.color} opacity={0.22} />
        ))}
        {[...leftNodes, ...midNodes].map((n, i) => (
          <g key={i}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} fill={n.color} />
            <text x={n.x < width / 2 ? n.x - 6 : n.x + n.w + 6}
                  y={n.y + n.h / 2 + 3.5}
                  textAnchor={n.x < width / 2 ? "end" : "start"}
                  className="sk-label">
              <tspan className="sk-name">{n.label}</tspan>
              <tspan x={n.x < width / 2 ? n.x - 6 : n.x + n.w + 6} dy={13} className="sk-val">{ROI_CALC.fmt$(n.value)}</tspan>
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function sankeyCurve(x1a, y1a, x1b, y1b, x2a, y2a, x2b, y2b) {
  const cx1 = (x1a + x2a) / 2;
  const cx2 = (x1a + x2a) / 2;
  return `M ${x1a} ${y1a}
          C ${cx1} ${y1a}, ${cx2} ${y2a}, ${x2a} ${y2a}
          L ${x2b} ${y2b}
          C ${cx2} ${y2b}, ${cx1} ${y1b}, ${x1b} ${y1b}
          Z`;
}

function CompareBars({ result, height = 220, width = 600 }) {
  const items = [
    { label: "This degree", value: result.lifetimeDegree, color: "var(--accent)", primary: true },
    { label: "Compounded scholarship offer + HS-only earnings, no degree", short: "HS + invest the cost", value: result.lifetimeInvest, color: "var(--alt)" },
    { label: "HS diploma only", value: result.lifetimeHs, color: "var(--hs)" },
  ];
  const max = Math.max(...items.map(i => i.value), 1);
  const m = { l: 200, r: 80, t: 8, b: 8 };
  const W = width - m.l - m.r;
  const rowH = (height - m.t - m.b) / items.length;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg cmp">
      <g transform={`translate(${m.l},${m.t})`}>
        {items.map((it, i) => {
          const w = (it.value / max) * W;
          const y = i * rowH + 8;
          return (
            <g key={i}>
              <text x={-8} y={y + 16} textAnchor="end" className={"cmp-label" + (it.primary ? " bold" : "")}>
                {it.short ?? it.label}
              </text>
              <rect x={0} y={y} width={Math.max(0, w)} height={rowH - 16}
                    fill={it.color} opacity={it.primary ? 1 : 0.7} />
              <text x={w + 6} y={y + 16} className={"cmp-val" + (it.primary ? " bold" : "")}>
                {ROI_CALC.fmt$(it.value)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function CostStack({ result, height = 110, width = 760 }) {
  const r = result;
  const items = [
    { label: "Tuition & fees", value: r.yearly.tuition * r.yearsCount, color: "var(--accent)" },
    { label: "Room & board", value: r.yearly.roomBoard * r.yearsCount, color: "var(--accent-2)" },
    { label: "Books & supplies", value: r.yearly.books * r.yearsCount, color: "var(--accent-3)" },
    { label: "Aid (offset)", value: -r.totalAid, color: "var(--pos)" },
    { label: "Loan interest", value: r.totalInterest, color: "var(--warn)" },
  ];
  const positives = items.filter(i => i.value > 0);
  const total = positives.reduce((a, n) => a + n.value, 0);
  const m = { l: 0, r: 0, t: 36, b: 26 };
  const W = width;
  const barH = 28;

  let xc = 0;
  const segs = positives.map((it) => {
    const w = (it.value / total) * W;
    const seg = { ...it, x: xc, w };
    xc += w;
    return seg;
  });

  const MIN_GAP = 95;
  let lastX = -Infinity, lastRow = 1;
  for (const s of segs) {
    const anchor = s.x + 4;
    if (anchor - lastX < MIN_GAP) {
      s.row = lastRow === 0 ? 1 : 0;
    } else {
      s.row = 0;
    }
    lastX = anchor;
    lastRow = s.row;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height + 22}`} className="chart-svg stack">
      <text x={0} y={16} className="stack-h">Total cost over {r.yearsCount} years</text>
      <text x={W} y={16} textAnchor="end" className="stack-h bold">{ROI_CALC.fmt$Full(total)}</text>
      <g transform={`translate(${m.l},${m.t})`}>
        {segs.map((s, i) => (
          <rect key={"r"+i} x={s.x} y={0} width={s.w} height={barH} fill={s.color} />
        ))}
        {segs.map((s, i) => {
          const labelY = barH + 14 + (s.row * 28);
          const tickEndY = labelY - 11;
          const anchorX = Math.min(s.x + 4, W - 80);
          return (
            <g key={"l"+i}>
              {s.row > 0 && (
                <line x1={s.x + 2} y1={barH} x2={s.x + 2} y2={tickEndY}
                      stroke="var(--rule)" strokeWidth={0.8} />
              )}
              <text x={anchorX} y={labelY} className="stack-lbl">{s.label}</text>
              <text x={anchorX} y={labelY + 12} className="stack-num">{ROI_CALC.fmt$(s.value)}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function Spark({ data, color = "var(--ink-2)", width = 110, height = 28 }) {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const x = (i) => (i / (data.length - 1)) * width;
  const y = (v) => height - ((v - min) / (max - min || 1)) * height;
  const d = data.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} className="spark">
      <path d={d} fill="none" stroke={color} strokeWidth={1.4} />
    </svg>
  );
}

function niceTicks(min, max, n) {
  const range = max - min;
  const step = niceStep(range / n);
  if (!step) return [min];
  const start = Math.ceil(min / step) * step;
  const end = Math.floor(max / step) * step;
  const out = [];
  for (let v = start; v <= end + 1e-9; v += step) out.push(Math.round(v));
  return out;
}
function niceStep(raw) {
  if (!raw) return 0;
  const exp = Math.floor(Math.log10(Math.abs(raw)));
  const f = raw / Math.pow(10, exp);
  let nf;
  if (f < 1.5) nf = 1; else if (f < 3) nf = 2; else if (f < 7) nf = 5; else nf = 10;
  return nf * Math.pow(10, exp);
}
function fmtAxis(n) {
  if (Math.abs(n) >= 1e6) return (n < 0 ? "−" : "") + "$" + (Math.abs(n) / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n < 0 ? "−" : "") + "$" + Math.round(Math.abs(n) / 1e3) + "K";
  return (n < 0 ? "−" : "") + "$" + Math.round(Math.abs(n));
}

Object.assign(window, { EarningsChart, Sankey, CompareBars, CostStack, Spark });
