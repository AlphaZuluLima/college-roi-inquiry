// main.jsx — Top-level App, state, comparison mode, AI fallback, root render.
const { useState: mUseState, useEffect: mUseEffect, useMemo: mUseMemo } = React;
const { fmt$, fmt$Full, fmtPct, computeROI, compute2plus2, fetchUnknownEntity } = window.ROI_CALC;
const D = window.ROI_DATA;

const DEFAULT_CC   = D.SCHOOLS.find(s => s.type === "Public 2-yr")?.id ?? "northern-virginia-community-college";
const DEFAULT_UNIV = "university-of-virginia-main-campus";

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [mode, setMode] = mUseState("standard"); // "standard" | "pathway"
  const [incomeBracket, setIncomeBracketState] = mUseState(0);

  const [customSchools, setCustomSchools] = mUseState([]);
  const [customPrograms, setCustomPrograms] = mUseState([]);
  const [aiBusy, setAiBusy] = mUseState(null);

  const [inputs, setInputs] = mUseState({
    schoolId: "university-of-virginia-main-campus",
    programId: "liberal-arts",
    residency: "in",
    years: 4,
    living: "on-campus",
    aid: window.aidForBracket(D.SCHOOLS.find(s => s.id === "university-of-virginia-main-campus"), 0),
    aidTouched: false,
    loanTerm: 10,
    loanRate: 0.0653,
  });
  const [compareOn, setCompareOn] = mUseState(false);
  const [inputsB, setInputsB] = mUseState({
    schoolId: "university-of-virginia-main-campus", programId: "computer-science",
    residency: "in", years: 4, living: "on-campus",
    aid: window.aidForBracket(D.SCHOOLS.find(s => s.id === "university-of-virginia-main-campus"), 0), aidTouched: false,
    loanTerm: 10, loanRate: 0.0653,
  });
  const [pathwayInputs, setPathwayInputs] = mUseState(() => {
    const cc   = D.SCHOOLS.find(s => s.id === DEFAULT_CC);
    const univ = D.SCHOOLS.find(s => s.id === DEFAULT_UNIV);
    return {
      ccId: DEFAULT_CC, univId: DEFAULT_UNIV, programId: "computer-science",
      residencyCC: "in",   livingCC: "with-parents", aidCC:   window.aidForBracket(cc,   0) ?? 0,
      residencyUniv: "in", livingUniv: "on-campus",  aidUniv: window.aidForBracket(univ, 0) ?? 0,
      loanTerm: 10, loanRate: 0.0653,
    };
  });

  const onIncomeBracketChange = (bracket) => {
    setIncomeBracketState(bracket);
    const findSch = (id) => D.SCHOOLS.find(x => x.id === id) || customSchools.find(x => x.id === id);
    const schA = findSch(inputs.schoolId);
    const schB = findSch(inputsB.schoolId);
    const cc   = findSch(pathwayInputs.ccId);
    const univ = findSch(pathwayInputs.univId);
    if (schA) setInputs(s => ({ ...s, aid: window.aidForBracket(schA, bracket), aidTouched: false }));
    if (schB) setInputsB(s => ({ ...s, aid: window.aidForBracket(schB, bracket), aidTouched: false }));
    setPathwayInputs(s => ({
      ...s,
      ...(cc   ? { aidCC:   window.aidForBracket(cc,   bracket) } : {}),
      ...(univ  ? { aidUniv: window.aidForBracket(univ, bracket) } : {}),
    }));
  };

  const makeSetInput = (setter) => (k, v) => setter(s => {
    const next = { ...s, [k]: v };
    if (k === "schoolId") {
      const sch = D.SCHOOLS.find(x => x.id === v) || customSchools.find(x => x.id === v);
      if (sch && !s.aidTouched) next.aid = window.aidForBracket(sch, incomeBracket);
      if (sch) {
        const isTwoYr = ["Public 2-yr", "Trade"].includes(sch.type);
        const prog = D.PROGRAMS.find(p => p.id === s.programId);
        const progOffered = !sch.offered || sch.offered.includes(s.programId);
        if (isTwoYr !== (prog?.typical_years === 2) || !progOffered) {
          const fallback = D.PROGRAMS.find(p =>
            (isTwoYr ? p.typical_years === 2 : p.typical_years !== 2) &&
            (!sch.offered || sch.offered.includes(p.id))
          );
          if (fallback) { next.programId = fallback.id; next.years = fallback.typical_years; }
        }
      }
    }
    if (k === "programId") {
      const prog = D.PROGRAMS.find(p => p.id === v) || customPrograms.find(p => p.id === v);
      if (prog?.typical_years) next.years = prog.typical_years;
    }
    if (k === "aid") next.aidTouched = true;
    return next;
  });
  const setInput  = makeSetInput(setInputs);
  const setInputB = makeSetInput(setInputsB);
  const setPathwayInput = (k, v) => setPathwayInputs(s => {
    const next = { ...s, [k]: v };
    if (k === "ccId") {
      const cc = D.SCHOOLS.find(x => x.id === v) || customSchools.find(x => x.id === v);
      if (cc) next.aidCC = window.aidForBracket(cc, incomeBracket);
    }
    if (k === "univId") {
      const univ = D.SCHOOLS.find(x => x.id === v) || customSchools.find(x => x.id === v);
      if (univ) next.aidUniv = window.aidForBracket(univ, incomeBracket);
    }
    return next;
  });

  const addCustomSchool = async (q) => {
    setAiBusy({ kind: "school", q });
    const obj = await fetchUnknownEntity(q, "school");
    setAiBusy(null);
    if (obj) {
      setCustomSchools(s => [...s, obj]);
      setInputs(s => ({ ...s, schoolId: obj.id, aid: s.aidTouched ? s.aid : window.aidForBracket(obj, incomeBracket) }));
    }
  };
  const addCustomProgram = async (q) => {
    setAiBusy({ kind: "program", q });
    const obj = await fetchUnknownEntity(q, "program");
    setAiBusy(null);
    if (obj) { setCustomPrograms(s => [...s, obj]); setInput("programId", obj.id); }
  };

  mUseEffect(() => {
    const origGetSchool  = ROI_CALC.getSchool;
    const origGetProgram = ROI_CALC.getProgram;
    ROI_CALC.getSchool  = (id) => D.SCHOOLS.find(s => s.id === id)  || customSchools.find(s => s.id === id);
    ROI_CALC.getProgram = (id) => D.PROGRAMS.find(p => p.id === id) || customPrograms.find(p => p.id === id);
    return () => { ROI_CALC.getSchool = origGetSchool; ROI_CALC.getProgram = origGetProgram; };
  }, [customSchools, customPrograms]);

  const opts = mUseMemo(() => ({
    ...inputs, salaryGrowth: t.salaryGrowth, discountRate: t.discountRate, scenario: t.scenario,
  }), [inputs, t.salaryGrowth, t.discountRate, t.scenario]);

  const optsB = mUseMemo(() => ({
    ...inputsB, salaryGrowth: t.salaryGrowth, discountRate: t.discountRate, scenario: t.scenario,
  }), [inputsB, t.salaryGrowth, t.discountRate, t.scenario]);

  const pathwayOpts = mUseMemo(() => ({
    ...pathwayInputs, salaryGrowth: t.salaryGrowth, discountRate: t.discountRate, scenario: t.scenario,
  }), [pathwayInputs, t.salaryGrowth, t.discountRate, t.scenario]);

  const result = mUseMemo(
    () => mode === "standard" ? computeROI(opts) : compute2plus2(pathwayOpts),
    [mode, opts, pathwayOpts, customSchools, customPrograms]
  );
  const resultB = mUseMemo(
    () => mode === "standard" && compareOn ? computeROI(optsB) : null,
    [optsB, mode, compareOn, customSchools, customPrograms]
  );

  mUseEffect(() => {
    document.documentElement.style.setProperty("--accent", t.accent);
  }, [t.accent]);

  const isEstimated = result?.school?._estimated || result?.program?._estimated;

  return (
    <div className="page">
      <header className="page-header">
        <div className="brand">
          <div className="brand-mark">§</div>
          <div className="brand-text">
            <div className="brand-line">The College ROI Inquiry</div>
            <div className="brand-sub">A data-driven look at whether your degree pays back</div>
          </div>
        </div>
        <div className="header-meta">
          <span>Vol. I · Issue 1</span>
          <span className="hsep" />
          <span>{new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
        </div>
      </header>

      <main className="lede">
        <h1 className="lede-h1">Was the degree<br/>worth it?</h1>
        <p className="lede-dek">
          Pick a US college and a program. We'll combine published cost-of-attendance, federal loan terms,
          and graduate-outcome data to estimate the true lifetime return — including the loans you'll repay,
          the salary you'll likely earn, and what you'd have made instead.
        </p>
      </main>

      <div className="rule double" />

      <section className="ipt-section">
        <div className="rs-kicker">Inputs</div>

        <div className="mode-tabs">
          <button className={"mode-tab" + (mode === "standard" ? " on" : "")}
                  onClick={() => setMode("standard")}>Standard</button>
          <button className={"mode-tab" + (mode === "pathway" ? " on" : "")}
                  onClick={() => setMode("pathway")}>⇢ 2+2 Transfer Path</button>
        </div>

        {mode === "standard"
          ? <InputsPanel inputs={inputs} setInput={setInput}
                         customSchools={customSchools} customPrograms={customPrograms}
                         addCustomSchool={addCustomSchool} addCustomProgram={addCustomProgram}
                         incomeBracket={incomeBracket} onIncomeBracketChange={onIncomeBracketChange} />
          : <PathwayPanel inputs={pathwayInputs} setInput={setPathwayInput}
                          customSchools={customSchools} customPrograms={customPrograms}
                          incomeBracket={incomeBracket} onIncomeBracketChange={onIncomeBracketChange} />
        }

        <div className="ipt-footer">
          {mode === "standard" && (
            <button className={"compare-btn" + (compareOn ? " on" : "")}
                    onClick={() => setCompareOn(c => !c)}>
              {compareOn ? "✕ Remove comparison" : "+ Compare with another school / program"}
            </button>
          )}
          {aiBusy && (
            <div className="ai-busy">
              <span className="spinner" /> Estimating data for "{aiBusy.q}"…
            </div>
          )}
          {isEstimated && (
            <div className="ai-disclaimer">
              <b>AI-estimated data in use.</b> Some figures were estimated by AI rather than pulled
              from official sources. Treat with appropriate skepticism.
            </div>
          )}
        </div>
      </section>

      <div className="rule" />

      {mode === "pathway" && result && <PathwaySummary result={result} />}

      <ResultsView result={result} />

      {result && !isEstimated && <FreshnessBadge />}

      {mode === "standard" && compareOn && resultB && (
        <>
          <div className="rule double" />
          <section className="compare-section">
            <div className="rs-kicker">Comparison</div>
            <h2 className="rs-title">vs. {resultB.school.short} · {resultB.program.name}</h2>
            <p className="rs-dek">A second path, side-by-side. Adjust its inputs below.</p>
            <div className="compare-inputs-wrap">
              <InputsPanel inputs={inputsB} setInput={setInputB}
                           customSchools={customSchools} customPrograms={customPrograms}
                           addCustomSchool={addCustomSchool} addCustomProgram={addCustomProgram}
                           incomeBracket={incomeBracket} onIncomeBracketChange={onIncomeBracketChange} />
            </div>
            <CompareTable a={result} b={resultB} />
          </section>
        </>
      )}

      <footer className="page-footer">
        <div className="footer-cols">
          <div>
            <h4>Sources & methodology</h4>
            <ul>
              <li>Tuition, room/board, aid, retention, graduation: U.S. Dept. of Ed <i>College Scorecard</i>, 2023–24 reporting year</li>
              <li>Earnings by program: BLS <i>Occupational Employment Statistics</i> + College Scorecard graduate earnings</li>
              <li>Federal loan rate: Federal Student Aid, 2024–25 award year (6.53% direct subsidized)</li>
              <li>HS-only baseline: BLS <i>Current Population Survey</i>, median weekly earnings by education, 2024</li>
              <li>Investment alternative: S&amp;P 500 historical real return, ~7%/yr (1928–2024)</li>
            </ul>
          </div>
          <div>
            <h4>Caveats</h4>
            <ul>
              <li>All figures are <i>estimates</i>. School-by-program prestige multipliers approximate published earnings spreads but are not exact.</li>
              <li>Salary curves are real (inflation-adjusted) and assume continuous employment after school.</li>
              <li>Schools or programs not in our dataset are filled in by AI and clearly labeled.</li>
              <li>This tool ignores graduate school, qualitative gains, social mobility, and many other factors a real decision should consider.</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>The College ROI Inquiry · {new Date().getFullYear()}</span>
          <span>Built as a public-interest demonstration. Not financial advice.</span>
        </div>
      </footer>

      {t.showTweaks !== false && (
        <TweaksPanel>
          <TweakSection label="Theme" />
          <TweakColor label="Accent" value={t.accent}
            options={["#1F5E55", "#2A4D8F", "#8C2D2A", "#5C3D1A", "#1A1A1A"]}
            onChange={(v) => setTweak("accent", v)} />
          <TweakSection label="Assumptions" />
          <TweakRadio label="Scenario" value={t.scenario}
            options={[["pessimistic","Bear"], ["base","Base"], ["optimistic","Bull"]]}
            onChange={(v) => setTweak("scenario", v)} />
          <TweakSlider label="Discount rate (NPV)" value={(t.discountRate ?? 0.03) * 100}
            min={0} max={10} step={0.5} unit="%"
            onChange={(v) => setTweak("discountRate", v / 100)} />
          <TweakSlider label="Salary growth override" value={(t.salaryGrowth ?? 0) * 100}
            min={0} max={6} step={0.1} unit="%"
            onChange={(v) => setTweak("salaryGrowth", v === 0 ? null : v / 100)} />
        </TweaksPanel>
      )}
    </div>
  );
}

function CompareTable({ a, b }) {
  const rows = [
    { lbl: "Total cost (incl. interest)", val: r => fmt$(r.totalAllIn), better: "lower" },
    { lbl: "Monthly loan payment", val: r => fmt$Full(r.monthlyPay), better: "lower" },
    { lbl: "Starting salary", val: r => fmt$(r.salStart), better: "higher" },
    { lbl: "Mid-career salary", val: r => fmt$(r.salMid), better: "higher" },
    { lbl: "Employment in field", val: r => fmtPct(r.empRate), better: "higher" },
    { lbl: "Break-even age", val: r => r.breakEvenYear != null ? 18 + r.breakEvenYear : "never", better: "lower" },
    { lbl: "Net lifetime gain (vs HS)", val: r => fmt$(r.netRoi), better: "higher" },
  ];
  function which(row) {
    const get = (r) =>
      row.lbl.includes("Total")      ? r.totalAllIn :
      row.lbl.includes("Monthly")    ? r.monthlyPay :
      row.lbl.includes("Starting")   ? r.salStart :
      row.lbl.includes("Mid")        ? r.salMid :
      row.lbl.includes("Employment") ? r.empRate :
      row.lbl.includes("Break")      ? (r.breakEvenYear ?? 999) :
      r.netRoi;
    const ra = get(a), rb = get(b);
    if (row.better === "higher") return ra > rb ? "a" : rb > ra ? "b" : null;
    return ra < rb ? "a" : rb < ra ? "b" : null;
  }
  return (
    <div className="cmp-table">
      <div className="cmp-table-head">
        <div></div>
        <div className="cmp-th">
          <div className="cmp-th-school">{a.school.short}</div>
          <div className="cmp-th-prog">{a.program.name}</div>
        </div>
        <div className="cmp-th">
          <div className="cmp-th-school">{b.school.short}</div>
          <div className="cmp-th-prog">{b.program.name}</div>
        </div>
      </div>
      {rows.map((row, i) => {
        const w = which(row);
        return (
          <div key={i} className="cmp-table-row">
            <div className="cmp-row-lbl">{row.lbl}</div>
            <div className={"cmp-row-val mono" + (w === "a" ? " win" : "")}>{row.val(a)}</div>
            <div className={"cmp-row-val mono" + (w === "b" ? " win" : "")}>{row.val(b)}</div>
          </div>
        );
      })}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
