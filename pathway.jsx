// pathway.jsx — 2+2 transfer path inputs and results
const { useState, useMemo } = React;
const { fmt$, fmt$Full, fmtPct } = window.ROI_CALC;
const D = window.ROI_DATA;

const FOUR_YR_TYPES = new Set(["Public 4-yr", "Private 4-yr", "Liberal Arts"]);
const CC_TYPES      = new Set(["Public 2-yr"]);

function getState(city) {
  if (!city || !city.includes(", ")) return null;
  const s = city.split(", ").pop();
  return s.length === 2 ? s : null;
}

function PathwayPanel({ inputs, setInput, customSchools, customPrograms, incomeBracket, onIncomeBracketChange }) {
  const [showAll, setShowAll] = useState(false);
  const allSchools  = [...D.SCHOOLS, ...customSchools];
  const ccSchools   = allSchools.filter(s => CC_TYPES.has(s.type));
  const all4yr      = allSchools.filter(s => FOUR_YR_TYPES.has(s.type));

  const cc = allSchools.find(s => s.id === inputs.ccId);
  const ccState = getState(cc?.city);
  const hasPartners = cc?.transfer_partners?.length > 0;

  const univSchools = useMemo(() => {
    if (showAll || !cc) return all4yr;
    if (hasPartners) return all4yr.filter(s => cc.transfer_partners.includes(s.id));
    if (ccState) return all4yr.filter(s => getState(s.city) === ccState);
    return all4yr;
  }, [all4yr, cc, ccState, hasPartners, showAll]);

  const filterLabel = useMemo(() => {
    if (showAll || !cc) return null;
    if (hasPartners) return `${univSchools.length} known transfer partners`;
    if (ccState) return `${univSchools.length} in-state schools (${ccState})`;
    return null;
  }, [showAll, cc, hasPartners, ccState, univSchools.length]);

  const univ = allSchools.find(s => s.id === inputs.univId);
  const programs = [...D.PROGRAMS, ...customPrograms].filter(p => {
    if (p.typical_years === 2) return false;
    if (univ?.offered) return univ.offered.includes(p.id);
    return true;
  });

  return (
    <div className="inputs pwy-inputs">
      <div className="pwy-phases">

        <div className="pwy-phase">
          <div className="pwy-phase-label">Phase 1 — Community College <span className="pwy-phase-years">2 years</span></div>
          <div className="ipt-row">
            <div className="ipt-grp ipt-school">
              <label className="ipt-lbl">Community college</label>
              <Combobox items={ccSchools} value={inputs.ccId}
                        onChange={v => { setInput("ccId", v); setShowAll(false); }}
                        placeholder="Choose a CC…" iconType="school" />
            </div>
          </div>
          <div className="ipt-grid">
            <Field label="Residency">
              <Segment value={inputs.residencyCC} onChange={v => setInput("residencyCC", v)}
                       options={[["in","In-state"],["out","Out-of-state"]]} />
            </Field>
            <Field label="Living">
              <Segment value={inputs.livingCC} onChange={v => setInput("livingCC", v)}
                       options={[["with-parents","Parents"],["off-campus","Off"],["on-campus","On"]]} />
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
                    <>{filterLabel} · <button className="pwy-filter-toggle" onClick={() => setShowAll(true)}>show all</button></>
                  ) : cc && (hasPartners || ccState) ? (
                    <>All schools · <button className="pwy-filter-toggle" onClick={() => setShowAll(false)}>filter</button></>
                  ) : null}
                </span>
              </div>
              <Combobox items={univSchools} value={inputs.univId}
                        onChange={v => setInput("univId", v)}
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
            </Field>
            <Field label="Annual aid">
              <NumInput value={inputs.aidUniv} onChange={v => setInput("aidUniv", v)} prefix="$" step={500} />
            </Field>
          </div>
        </div>

      </div>

      <div className="ipt-grid" style={{marginTop:"14px", borderTop:"1px solid var(--rule)", paddingTop:"14px"}}>
        <Field label="Family income">
          <IncomeSel value={incomeBracket} onChange={onIncomeBracketChange} />
        </Field>
        <Field label="Loan term">
          <Segment value={inputs.loanTerm} onChange={v => setInput("loanTerm", v)}
                   options={[[10,"10y"],[15,"15y"],[20,"20y"],[25,"25y"]]} />
        </Field>
        <Field label="Loan rate">
          <NumInput value={Math.round(inputs.loanRate * 10000) / 100}
                    onChange={v => setInput("loanRate", v / 100)} suffix="%" step={0.1} decimals={2} />
        </Field>
      </div>
    </div>
  );
}

function PathwaySummary({ result }) {
  if (!result) return null;
  const {
    cc, univ,
    ccYearly, univYearly, ccNetCost, univNetCost,
    principal, monthlyPay, totalInterest,
    directNetCost, directMonthlyPay, directTotalInterest,
    savings,
  } = result;

  const costRows = [
    { lbl: "Tuition",       cc: ccYearly.tuition   * 2, univ: univYearly.tuition   * 2, direct: univYearly.tuition   * 4 },
    { lbl: "Room & board",  cc: ccYearly.roomBoard  * 2, univ: univYearly.roomBoard  * 2, direct: univYearly.roomBoard  * 4 },
    { lbl: "Books",         cc: ccYearly.books      * 2, univ: univYearly.books      * 2, direct: univYearly.books      * 4 },
    { lbl: "Aid received",  cc: -ccYearly.aid       * 2, univ: -univYearly.aid       * 2, direct: -univYearly.aid       * 4, neg: true },
    { lbl: "Net cost",      cc: ccNetCost,               univ: univNetCost,               direct: directNetCost, bold: true },
    { lbl: "Loan interest", cc: null, univ: null, direct: null,
      total: totalInterest, directTotal: directTotalInterest },
    { lbl: "Total all-in",  cc: null, univ: null, direct: null,
      total: principal + totalInterest, directTotal: directNetCost + directTotalInterest, bold: true },
  ];

  return (
    <div className="pwy-results">

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
  );
}

window.PathwayPanel   = PathwayPanel;
window.PathwaySummary = PathwaySummary;
