// results.jsx — Results / verdict / charts section.
if (!window.ROI_CALC) throw new Error("ROI_CALC must load before results.jsx");
if (!window.ROI_DATA) throw new Error("ROI_DATA must load before results.jsx");
const { fmt$, fmt$Full, fmtPct } = window.ROI_CALC;
const D = window.ROI_DATA;

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
        value={fmt$(r.netCost + r.totalAid)}
        sublabel={`Net of aid: ${fmt$(r.netCost)} · ${r.yearsCount} years`}
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

function ResultsView({ result }) {
  if (!result) return null;
  const r = result;
  return (
    <div className="results">
      <VerdictCard result={r} />
      <HeroRow result={r} />

      <Section
        kicker="Section 01"
        title="Earnings vs. debt over a lifetime"
        dek={`Cumulative net cash position by age, comparing the ${r.program.name} path at ${r.school.short} against finishing high school and either working or investing the cost of college in the S&P 500.`}
      >
        <EarningsChart result={r} width={760} height={380} />
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
        <Sankey result={r} width={760} height={300} />
      </Section>

      <Section
        kicker="Section 03"
        title="Compared to the alternatives"
        dek="Lifetime cumulative cash by age 68 across three paths. The 'invest the cost' path assumes someone with a HS diploma works while putting equivalent dollars into the S&P 500 at long-run real returns."
      >
        <CompareBars result={r} width={680} height={220} />
        <p className="footnote">
          Baselines: <Info source={D.SOURCES.hsBaseline} label="HS earnings" detail="Median weekly earnings × 52, BLS Current Population Survey" /> · S&P 500 long-run real return ~7%.
        </p>
      </Section>
    </div>
  );
}

Object.assign(window, { VerdictCard, HeroRow, Section, Legend, ResultsView });
