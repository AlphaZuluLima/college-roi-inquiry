// pathway.jsx — 2+2 transfer path inputs and results
const { useState, useMemo } = React;
const { fmt$, fmt$Full } = window.ROI_CALC;
const D = window.ROI_DATA;

const FOUR_YR_TYPES = new Set(["Public 4-yr", "Private 4-yr", "Liberal Arts"]);
const CC_TYPES      = new Set(["Public 2-yr"]);

function PathwayPanel({
  inputs, setInput,
  customSchools = [], customPrograms = [],
  incomeBracket, onIncomeBracketChange,
}) {
  const [showAll, setShowAll] = useState(false);

  const allSchools = useMemo(
    () => [...D.SCHOOLS, ...customSchools],
    [customSchools]
  );
  const ccSchools = useMemo(
    () => allSchools.filter(s => CC_TYPES.has(s.type)),
    [allSchools]
  );
  const all4yr = useMemo(
    () => allSchools.filter(s => FOUR_YR_TYPES.has(s.type)),
    [allSchools]
  );

  const cc = useMemo(
    () => allSchools.find(s => s.id === inputs.ccId),
    [allSchools, inputs.ccId]
  );
  const ccState    = cc ? window.schoolState(cc) : null;
  const hasPartners = cc?.transfer_partners?.length > 0;

  const univSchools = useMemo(() => {
    if (showAll || !cc) return all4yr;
    if (hasPartners) return all4yr.filter(s => cc.transfer_partners.includes(s.id));
    if (ccState) return all4yr.filter(s => window.schoolState(s) === ccState);
    return all4yr;
  }, [all4yr, cc, ccState, hasPartners, showAll]);

  const filterLabel = useMemo(() => {
    if (showAll || !cc) return null;
    if (hasPartners) return `${univSchools.length} known transfer partners`;
    if (ccState) return `${univSchools.length} in-state schools (${ccState})`;
    return null;
  }, [showAll, cc, hasPartners, ccState, univSchools.length]);

  const univ = useMemo(
    () => allSchools.find(s => s.id === inputs.univId),
    [allSchools, inputs.univId]
  );
  const programs = useMemo(() => {
    return [...D.PROGRAMS, ...customPrograms].filter(p => {
      if (p.typical_years === 2) return false;
      if (univ?.offered) return univ.offered.includes(p.id);
      return true;
    });
  }, [customPrograms, univ]);

  const handleCCChange = v => {
    setInput("ccId", v);
    setInput("univId", null);
    setInput("programId", null);
    setShowAll(false);
  };
  const handleUnivChange = v => {
    setInput("univId", v);
    setInput("programId", null);
  };

  return (
    <div className="inputs pwy-inputs">
      <div className="pwy-phases">

        <div className="pwy-phase">
          <div className="pwy-phase-label">Phase 1 — Community College <span className="pwy-phase-years">2 years</span></div>
          <div className="ipt-grp ipt-school">
            <label className="ipt-lbl">Community college</label>
            <Combobox items={ccSchools} value={inputs.ccId}
                      onChange={handleCCChange}
                      placeholder="Choose a CC…" iconType="school" />
          </div>
          <div className="ipt-grid">
            <Field label="Residency">
              <Segment value={inputs.residencyCC} onChange={v => setInput("residencyCC", v)}
                       options={[["in","In-state"],["out","Out-of-state"]]} />
            </Field>
            <Field label="Living">
              <Segment value={inputs.livingCC} onChange={v => setInput("livingCC", v)}
                       options={[["with-parents","Parents"],["off-campus","Off"],["on-campus","On"]]} />
              {inputs.livingCC === "with-parents" && (
                <NumInput value={inputs.livingExpensesCC ?? 0} onChange={v => setInput("livingExpensesCC", v)}
                          prefix="$" step={100} sublabel="personal expenses / yr" />
              )}
            </Field>
            <Field label="Annual aid">
              <NumInput value={inputs.aidCC} onChange={v => setInput("aidCC", v)} prefix="$" step={500} />
            </Field>
          </div>
        </div>

        <div className="pwy-connector">
          <div className="pwy-arrow-line" />
          <div className="pwy-arrow-label">transfer</div>
          <div className="pwy-arrow-line" />
        </div>

        <div className="pwy-phase">
          <div className="pwy-phase-label">Phase 2 — Transfer University <span className="pwy-phase-years">2 years</span></div>
          <div className="ipt-row">
            <div className="ipt-grp ipt-school">
              <div className="pwy-school-hdr">
                <span className="ipt-lbl">Transfer school</span>
                <span className="pwy-filter-note">
                  {filterLabel ? (
                    <>{filterLabel} · <button type="button" className="pwy-filter-toggle" onClick={() => setShowAll(true)}>show all</button></>
                  ) : cc && (hasPartners || ccState) ? (
                    <>All schools · <button type="button" className="pwy-filter-toggle" onClick={() => setShowAll(false)}>filter</button></>
                  ) : null}
                </span>
              </div>
              <Combobox items={univSchools} value={inputs.univId}
                        onChange={handleUnivChange}
                        placeholder="Choose a university…" iconType="school" />
            </div>
            <div className="ipt-grp ipt-program">
              <label className="ipt-lbl">Degree program</label>
              <Combobox items={programs} value={inputs.programId}
                        onChange={v => setInput("programId", v)}
                        placeholder="Choose a program…" iconType="program" />
            </div>
          </div>
          <div className="ipt-grid">
            <Field label="Residency">
              <Segment value={inputs.residencyUniv} onChange={v => setInput("residencyUniv", v)}
                       options={[["in","In-state"],["out","Out-of-state"]]} />
            </Field>
            <Field label="Living">
              <Segment value={inputs.livingUniv} onChange={v => setInput("livingUniv", v)}
                       options={[["on-campus","On"],["off-campus","Off"],["with-parents","Parents"]]} />
              {inputs.livingUniv === "with-parents" && (
                <NumInput value={inputs.livingExpensesUniv ?? 0} onChange={v => setInput("livingExpensesUniv", v)}
                          prefix="$" step={100} sublabel="personal expenses / yr" />
              )}
            </Field>
            <Field label="Annual aid">
              <NumInput value={inputs.aidUniv} onChange={v => setInput("aidUniv", v)} prefix="$" step={500} />
            </Field>
          </div>
        </div>

      </div>

      <div className="ipt-grid pwy-finance-inputs">
        <Field label="Family income">
          <IncomeSel value={incomeBracket} onChange={onIncomeBracketChange} />
        </Field>
        <Field label="Loan term">
          <Segment value={inputs.loanTerm} onChange={v => setInput("loanTerm", v)}
                   options={[[10,"10y"],[15,"15y"],[20,"20y"],[25,"25y"]]} />
        </Field>
        <Field label="Loan rate">
          <NumInput
            value={inputs.loanRate === "" ? "" : Math.round(inputs.loanRate * 10000) / 100}
            onChange={v => setInput("loanRate", v === "" ? "" : v / 100)}
            suffix="%" step={0.1} />
        </Field>
      </div>
    </div>
  );
}

function PathwaySummary({ result }) {
  const [open, setOpen] = useState(false);
  if (!result) return null;
  if (!result.cc || !result.univ || !result.ccYearly || !result.univYearly) return null;
  const {
    cc, univ,
    ccYearly, univYearly, ccNetCost, univNetCost,
    principal, monthlyPay, totalInterest,
    directNetCost, directMonthlyPay, directTotalInterest,
    savings,
  } = result;

  const n = v => Number(v) || 0;
  const costRows = [
    { lbl: "Tuition",       cc: n(ccYearly.tuition)   * 2, univ: n(univYearly.tuition)   * 2, direct: n(univYearly.tuition)   * 4 },
    { lbl: "Room & board",  cc: n(ccYearly.roomBoard)  * 2, univ: n(univYearly.roomBoard)  * 2, direct: n(univYearly.roomBoard)  * 4 },
    { lbl: "Books",         cc: n(ccYearly.books)      * 2, univ: n(univYearly.books)      * 2, direct: n(univYearly.books)      * 4 },
    { lbl: "Aid received",  cc: -n(ccYearly.aid)       * 2, univ: -n(univYearly.aid)       * 2, direct: -n(univYearly.aid)       * 4, neg: true },
    { lbl: "Net cost",      cc: ccNetCost,                   univ: univNetCost,                   direct: directNetCost, bold: true },
    { lbl: "Loan interest", cc: null, univ: null, direct: null,
      total: totalInterest, directTotal: directTotalInterest },
    { lbl: "Total all-in",  cc: null, univ: null, direct: null,
      total: principal + totalInterest, directTotal: directNetCost + directTotalInterest, bold: true },
  ];

  return (
    <div className="pwy-results">

      <button type="button" className="pwy-toggle" aria-expanded={open} aria-controls="pwy-cost-breakdown"
              onClick={() => setOpen(o => !o)}>
        <span className="pwy-toggle-label">2+2 Cost Breakdown</span>
        <span className="pwy-toggle-caret" aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>

      <div id="pwy-cost-breakdown" hidden={!open}>
        <div className={"pwy-savings-banner" + (savings >= 0 ? "" : " over")}>
          <div className="pwy-savings-num mono">{fmt$(Math.abs(savings))}</div>
          <div className="pwy-savings-lbl">
            {savings >= 0
              ? <>saved on net cost vs. 4 years straight at <b>{univ.short}</b></>
              : <>more expensive than 4 years straight at <b>{univ.short}</b></>}
          </div>
          <div className="pwy-savings-sub mono">{fmt$Full(monthlyPay)}/mo vs. {fmt$Full(directMonthlyPay)}/mo direct</div>
        </div>

        <div className="pwy-cost-table">
          <div className="pwy-cost-head">
            <div className="pwy-col-lbl"></div>
            <div className="pwy-col-hd">{cc.short}<br/><span className="pwy-col-sub">2 yrs</span></div>
            <div className="pwy-col-hd">{univ.short}<br/><span className="pwy-col-sub">2 yrs</span></div>
            <div className="pwy-col-hd">2+2 Total</div>
            <div className="pwy-col-hd pwy-direct-col">{univ.short} direct<br/><span className="pwy-col-sub">4 yrs</span></div>
          </div>
          {costRows.map((row, i) => (
            <div key={i} className={"pwy-cost-row" + (row.bold ? " bold" : "")}>
              <div className="pwy-col-lbl">{row.lbl}</div>
              <div className={"pwy-col-val mono" + (row.neg ? " pos" : "")}>
                {row.cc != null ? fmt$(row.cc) : "—"}
              </div>
              <div className={"pwy-col-val mono" + (row.neg ? " pos" : "")}>
                {row.univ != null ? fmt$(row.univ) : "—"}
              </div>
              <div className="pwy-col-val mono">
                {row.total != null ? fmt$(row.total)
                 : row.cc != null ? fmt$(row.cc + row.univ) : "—"}
              </div>
              <div className="pwy-col-val mono pwy-direct-col">
                {row.directTotal != null ? fmt$(row.directTotal)
                 : row.direct != null ? fmt$(row.direct) : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

window.PathwayPanel   = PathwayPanel;
window.PathwaySummary = PathwaySummary;
