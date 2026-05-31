// results.jsx — Results / verdict / charts section.
if (!window.ROI_CALC) throw new Error("ROI_CALC must load before results.jsx");
if (!window.ROI_DATA) throw new Error("ROI_DATA must load before results.jsx");
const { fmt$, fmt$Full, fmtPct } = window.ROI_CALC;
const D = window.ROI_DATA;
const { useState, useEffect, useCallback } = React;

// Wraps a chart so that clicking it opens a full-screen modal.
// The SVG uses viewBox (no explicit width/height attrs) so CSS scaling to 100% works perfectly.
function ExpandableChart({ children, label }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, close]);
  return (
    <>
      <div className="chart-expand-wrap" onClick={() => setOpen(true)} title="Click to expand">
        {children}
        <span className="chart-expand-hint" aria-hidden="true">⤢</span>
      </div>
      {open && ReactDOM.createPortal(
        <div className="chart-modal-backdrop" onClick={close}>
          <div className="chart-modal" onClick={e => e.stopPropagation()}>
            {label && <div className="chart-modal-label">{label}</div>}
            <button className="chart-modal-close" onClick={close} aria-label="Close">✕</button>
            <div className="chart-modal-body">{children}</div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function VerdictCard({ result }) {
  const r = result;
  const v = r.verdict;
  const txt = ({
    strong:   { kicker: "STRONG ROI", line: "This degree pays off many times over.", tone: "pos" },
    moderate: { kicker: "POSITIVE ROI", line: "Earnings comfortably exceed the cost.", tone: "pos" },
    marginal: { kicker: "MARGINAL ROI", line: "The math works out, but barely.", tone: "warn" },
    negative: { kicker: "NEGATIVE ROI", line: "The investment doesn't pay back over a working life.", tone: "neg" },
  })[v] || { kicker: "ROI UNKNOWN", line: "Not enough data to determine the payoff.", tone: "warn" };
  return (
    <div className={"verdict v-" + v}>
      <div className="verdict-mark">
        <span className={"verdict-kicker " + txt.tone}>{txt.kicker}</span>
        {r.pslf && <span className="pslf-badge">PSLF</span>}
        <span className="verdict-line">{txt.line}</span>
      </div>
      <div className="verdict-grid">
        <div>
          <div className="vg-lbl">Net lifetime gain vs. HS only</div>
          <div className={"vg-num mono " + (r.netRoi >= 0 ? "pos" : "neg")}>
            {r.netRoi >= 0 ? "+" : ""}{fmt$(r.netRoi)}
          </div>
        </div>
        <div>
          <div className="vg-lbl">{r.pslf ? "Forgiveness age" : "Est. loan payoff age"}</div>
          <div className="vg-num mono">
            {r.loanPaidOffAge != null ? `Age ${r.loanPaidOffAge}` : "No loan"}
          </div>
        </div>
        <div>
          <div className="vg-lbl">{r.pslf ? "Est. forgiven" : "Years of payments"}</div>
          <div className="vg-num mono">
            {r.pslf
              ? (r.pslfForgiven > 0 ? fmt$(r.pslfForgiven) : "—")
              : (r.principal > 0 ? `${r.loanTerm} yrs` : "—")}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroRow({ result }) {
  const r = result;
  return (
    <div className="hero-row">
      <HeroStat
        label="Total cost of attendance"
        value={fmt$(r.totalSticker)}
        sublabel={r.totalAotc > 0
          ? `Aid: −${fmt$(r.totalAid)} · AOTC: −${fmt$(r.totalAotc)} → Net: ${fmt$(r.netCost)} · ${r.yearsCount} yr`
          : `Net of aid: ${fmt$(r.netCost)} · ${r.yearsCount} years`}
        source={D.SOURCES.tuition}
        big
      />
      <HeroStat
        label={r.pslf ? "Total IBR payments (10 yr)" : "Net cost incl. interest"}
        value={fmt$(r.totalAllIn)}
        sublabel={r.pslf
          ? `Principal borrowed: ${fmt$(r.principal)} · Est. forgiven: ${fmt$(r.pslfForgiven)}`
          : `Principal: ${fmt$(r.principal)} · Interest: ${fmt$(r.totalInterest)}`}
        source={D.SOURCES.loanRate}
        big
      />
      <HeroStat
        label={r.pslf ? "Monthly IBR payment" : "Monthly loan payment"}
        value={fmt$Full(r.monthlyPay)}
        sublabel={r.pslf
          ? `${(r.debtBurden * 100).toFixed(0)}% of yr-1 income · forgiven after 10 yrs`
          : `${(r.debtBurden * 100).toFixed(0)}% of expected yr-1 income (emp.-adj.)`}
        big mono
      />
      <HeroStat
        label="Median starting salary"
        value={fmt$(r.salStart)}
        sublabel={`School/program/scenario adj. ×${r.salaryMult.toFixed(2)}`}
        source={D.SOURCES.salary}
        big
      />
      <HeroStat
        label="Mid-career salary"
        value={fmt$(r.salMid)}
        sublabel="~10 years post-grad, real $"
        source={D.SOURCES.salary}
        big
      />
      <HeroStat
        label="Employment in field"
        value={fmtPct(r.empRate, 0)}
        sublabel="6 mo. post-grad, school × program"
        source={D.SOURCES.employment}
        big
      />
    </div>
  );
}

function Section({ kicker, title, dek, children }) {
  return (
    <div className="rs-sec">
      <div className="rs-head">
        <div className="rs-kicker">{kicker}</div>
        <h2 className="rs-title">{title}</h2>
        <p className="rs-dek">{dek}</p>
      </div>
      <div className="rs-body">{children}</div>
    </div>
  );
}

function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((it, i) => (
        <div key={i} className="legend-item">
          <span
            className={"legend-swatch" + (it.dashed ? " dashed" : "")}
            style={it.dashed
              ? { borderColor: it.color, color: it.color }
              : { background: it.color }}
          />
          {it.label}
        </div>
      ))}
    </div>
  );
}

const FOUR_YR_TYPES = new Set(["Public 4-yr", "Private 4-yr", "Liberal Arts"]);
const TWO_YR_TYPES  = new Set(["Public 2-yr", "Trade"]);

function SchoolProgramMismatchFlag({ result }) {
  const r = result;
  if (!r || r.school?._is2plus2) return null;
  const schoolIs4yr = FOUR_YR_TYPES.has(r.school?.type);
  const schoolIs2yr = TWO_YR_TYPES.has(r.school?.type);
  if (schoolIs4yr && r.program?.isTrade) {
    return (
      <div className="mismatch-flag">
        <span className="mf-kicker">Program availability — verify</span>
        <span className="mf-body">
          <strong>{r.program.name}</strong> is a trade/vocational credential typically offered at
          community colleges or trade schools, not 4-year universities. Confirm that{" "}
          {r.school.short} actually offers this program before planning around these numbers.
        </span>
      </div>
    );
  }
  if (schoolIs2yr && !r.program?.isTrade) {
    return (
      <div className="mismatch-flag">
        <span className="mf-kicker">Program availability — verify</span>
        <span className="mf-body">
          <strong>{r.program.name}</strong> is typically a 4-year bachelor's program. If you plan
          to transfer after this school, use the <strong>⇢ 2+2 Transfer Path</strong> tab for a
          more accurate projection.
        </span>
      </div>
    );
  }
  return null;
}

// Programs that commonly pipeline into graduate or professional school.
// tier:'pro' = medicine/law/dentistry ($50k/yr, $200k lifetime cap under OBBBA)
// tier:'grad' = master's/PhD ($20.5k/yr, $100k lifetime cap under OBBBA)
// funded:true = PhD programs in this field are typically stipend-funded (waiver + $25-37k/yr)
const GRAD_PATHS = {
  'pre-med':         { tier:'pro',  label:'medical school (MD/DO)',          typical:'$60–80k/yr tuition', alt:'NHSC scholarship · Military HPSP · PSLF on IBR payments' },
  'biology':         { tier:'pro',  label:'medical school or a funded PhD',   typical:'$60–80k/yr (MD)',    alt:'NHSC scholarship · Military HPSP · PSLF on IBR payments' },
  'chemistry':       { tier:'pro',  label:'medical school or a funded PhD',   typical:'$60–80k/yr (MD)',    alt:'NHSC scholarship · Military HPSP · PSLF on IBR payments' },
  'poli-sci':        { tier:'pro',  label:'law school (JD)',                  typical:'$55–75k/yr tuition', alt:'Law school LRAPs (Harvard/Yale/NYU) · PSLF for public interest law' },
  'psychology':      { tier:'grad', label:'clinical/research PhD or PsyD',   typical:'$25–50k/yr',  funded:false },
  'mathematics':     { tier:'grad', label:'PhD or MS programs',               typical:'often funded', funded:true  },
  'economics':       { tier:'grad', label:'PhD or MBA programs',              typical:'$65–80k/yr (MBA); PhD often funded', funded:false },
  'computer-science':{ tier:'grad', label:'MS programs',                      typical:'$25–55k/yr',  funded:false },
  'data-science':    { tier:'grad', label:'MS programs',                      typical:'$25–55k/yr',  funded:false },
  'engineering-mech':{ tier:'grad', label:'MS or PhD programs',               typical:'often funded', funded:true  },
  'engineering-elec':{ tier:'grad', label:'MS or PhD programs',               typical:'often funded', funded:true  },
  'engineering-civil':{ tier:'grad',label:'MS or PhD programs',               typical:'often funded', funded:true  },
  'public-health':   { tier:'grad', label:'MPH or DrPH programs',             typical:'$25–45k/yr',  funded:false },
  'social-work':     { tier:'grad', label:'MSW programs',                     typical:'$20–40k/yr',  funded:false },
  'nursing':         { tier:'grad', label:'MSN or DNP programs',              typical:'$20–35k/yr',  funded:false },
};

function GradSchoolFlag({ result }) {
  const r = result;
  if (!r) return null;
  const path = GRAD_PATHS[r.program?.id];
  if (!path) return null;
  const isPro = path.tier === 'pro';
  return (
    <div className={"grad-flag" + (isPro ? " gf-pro" : " gf-grad")}>
      <div className="gf-kicker">
        {isPro ? "Professional school pathway · OBBBA July 2026" : "Graduate school pathway · OBBBA July 2026"}
      </div>
      <div className="gf-body">
        <span className="gf-prog">{r.program.name}</span> commonly leads to {path.label} ({path.typical}).{" "}
        As of July 1, 2026, <strong>Grad PLUS loans are eliminated</strong>. New federal limit:{" "}
        {isPro
          ? <strong>$50,000/yr · $200,000 lifetime</strong>
          : <strong>$20,500/yr · $100,000 lifetime</strong>}.
        {isPro && " Any gap above the federal cap requires private loans at 10–23% APR."}
        {!isPro && path.funded && " PhD programs in this field are typically fully funded — tuition waiver plus a $25–37k/yr stipend — making the cap largely irrelevant if you pursue research rather than a coursework-only MS."}
      </div>
      {isPro && (
        <div className="gf-alt">Alternatives: {path.alt}.</div>
      )}
    </div>
  );
}

function RepaymentPanel({ result }) {
  const r = result;
  if (!r || r.pslf || r.principal <= 0) return null;
  const { repayment: rp, salStart } = r;
  const plans = [
    { label: "Standard",   sub: `${rp.standard.termYears}-yr payoff`, monthly: rp.standard.monthly, active: true  },
    { label: "IBR (new)",  sub: `20-yr → forgiven†`,              monthly: rp.ibr.monthly,      active: false },
    { label: "RAP",        sub: `30-yr → forgiven†`,              monthly: rp.rap.monthly,      active: false },
  ];
  return (
    <div className="rp-panel">
      <div className="rp-head">
        <span className="rp-title">Monthly payment at {fmt$(salStart)} starting salary</span>
        <span className="rp-note">Qualifying for IBR or RAP requires enrolling with your servicer after graduation</span>
      </div>
      <div className="rp-rows">
        {plans.map(p => (
          <div key={p.label} className={"rp-row" + (p.active ? " rp-active" : "")}>
            <span className="rp-plan">{p.label}{p.active && <span className="rp-tag">this calc</span>}</span>
            <span className="rp-mo mono">{fmt$Full(p.monthly)}<span className="rp-mounit">/mo</span></span>
            <span className="rp-sub">{p.sub}</span>
          </div>
        ))}
      </div>
      <div className="rp-foot">† IDR forgiveness is taxable income (ARPA exemption expired Jan 2026). Enable PSLF toggle for tax-free forgiveness.</div>
    </div>
  );
}

function ResultsView({ result }) {
  if (!result) return null;
  const r = result;
  return (
    <div className="results">
      <VerdictCard result={r} />
      <SchoolProgramMismatchFlag result={r} />
      <HeroRow result={r} />
      <RepaymentPanel result={r} />
      <GradSchoolFlag result={r} />

      <Section
        kicker="Section 01"
        title="Earnings vs. debt over a lifetime"
        dek={`Cumulative net cash position by age, comparing the ${r.program.name} path at ${r.school.short} against finishing high school and either working or investing the cost of college in the S&P 500.`}
      >
        <ExpandableChart label="Earnings vs. debt over a lifetime">
          <EarningsChart result={r} width={760} height={380} />
        </ExpandableChart>
        <Legend items={[
          { label: "Degree path (this calc)", color: "var(--accent)" },
          { label: "HS-only worker", color: "var(--hs)" },
          { label: "HS + invest the cost in S&P 500", color: "var(--alt)", dashed: true },
        ]} />
      </Section>

      <Section
        kicker="Section 02"
        title="Where the money goes"
        dek={`Your net cost with interest is ${fmt$Full(r.totalAllIn)} — principal ${fmt$Full(r.principal)} plus ${fmt$Full(r.totalInterest)} in interest. ${r.totalAid > 0 ? `Of the ${fmt$Full(r.yearly.gross * r.yearsCount)} sticker price, ${fmt$Full(r.totalAid)} comes back as aid.` : `Sticker price comes to ${fmt$Full(r.yearly.gross * r.yearsCount)}.`}`}
      >
        <div className="cost-row">
          <CostStack result={r} width={760} height={120} />
        </div>
        <ExpandableChart label="Where the money goes">
          <Sankey result={r} width={760} height={300} />
        </ExpandableChart>
      </Section>

      <Section
        kicker="Section 03"
        title="Compared to the alternatives"
        dek="Lifetime cumulative cash by age 68 across three paths. The 'invest the cost' path assumes someone with a HS diploma works while putting equivalent dollars into the S&P 500 at long-run real returns."
      >
        <ExpandableChart label="Compared to the alternatives">
          <CompareBars result={r} width={680} height={220} />
        </ExpandableChart>
        <p className="footnote">
          Baselines: <Info source={D.SOURCES.hsBaseline} label="HS earnings" detail="Median weekly earnings × 52, BLS Current Population Survey" /> · S&P 500 long-run real return ~7%.
        </p>
      </Section>
    </div>
  );
}

Object.assign(window, { VerdictCard, HeroRow, RepaymentPanel, GradSchoolFlag, SchoolProgramMismatchFlag, Section, Legend, ResultsView });
