// app.jsx — Input components: Combobox, Info, HeroStat, InputsPanel.
const { useState, useMemo, useEffect, useRef, useId } = React;
const D = window.ROI_DATA;

// Aid for a given income bracket index (0-4), falling back to avg_aid when no data.
window.aidForBracket = function(school, bracketIdx) {
  if (bracketIdx == null) return school.avg_aid;
  const nets = (window.ROI_INCOME || {})[school.id];
  if (!nets) return school.avg_aid;
  const net = nets[bracketIdx];
  if (net == null) return school.avg_aid;
  const sticker =
    Number(school.tuition_in  || 0) +
    Number(school.room_board  || 0) +
    Number(school.books       || 0);
  return Math.max(0, sticker - Math.max(0, net));
};

const INCOME_BRACKETS = [
  [null, "Manual"],
  [0,    "< $30k"],
  [1,    "$30–48k"],
  [2,    "$48–75k"],
  [3,    "$75–110k"],
];

function IncomeSel({ value, onChange }) {
  return (
    <select className="income-sel" value={value ?? ""} onChange={e => {
      const v = e.target.value;
      onChange(v === "" ? null : Number(v));
    }}>
      {INCOME_BRACKETS.map(([v, l]) => (
        <option key={v ?? "avg"} value={v ?? ""}>{l}</option>
      ))}
    </select>
  );
}

const TWEAK_DEFAULTS = {
  "accent": "#1F5E55",
  "loanRateOverride": null,
  "salaryGrowth": null,
  "discountRate": 0.03,
  "scenario": "base",
  "showTweaks": true
};

const SCHOOL_TYPES = ["Public 4-yr", "Private 4-yr", "Liberal Arts", "Public 2-yr", "Trade"];

function schoolState(school) {
  const city = school?.city || "";
  if (!city.includes(", ")) return null;
  const s = city.split(", ").pop();
  return s.length === 2 ? s : null;
}

function Combobox({ items, value, onChange, placeholder, displayKey = "name", iconType = "school", onCustom }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState(null);
  const [stateFilter, setStateFilter] = useState("");
  const ref = useRef(null);
  const listboxId = useId();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const states = useMemo(() => {
    if (iconType !== "school") return [];
    const set = new Set();
    for (const x of items) { const s = schoolState(x); if (s) set.add(s); }
    return [...set].sort();
  }, [items, iconType]);

  const selected = items.find(x => x.id === value);
  const filt = useMemo(() => {
    let pool = items;
    if (iconType === "school" && typeFilter) pool = pool.filter(x => x.type === typeFilter);
    if (iconType === "school" && stateFilter) pool = pool.filter(x => schoolState(x) === stateFilter);
    const Q = q.toLowerCase();
    const matched = q
      ? pool.filter(x =>
          x[displayKey]?.toLowerCase().includes(Q) ||
          (x.short || "").toLowerCase().includes(Q) ||
          (x.group || "").toLowerCase().includes(Q)
        )
      : pool;
    return iconType === "program" ? matched : matched.slice(0, 50);
  }, [q, items, displayKey, iconType, typeFilter, stateFilter]);

  const grouped = useMemo(() => {
    if (iconType !== "program") return null;
    const g = {};
    for (const it of filt) { (g[it.group] ??= []).push(it); }
    return g;
  }, [filt, iconType]);

  return (
    <div className="cb" ref={ref}>
      <button type="button" aria-expanded={open} aria-haspopup="listbox"
              aria-controls={listboxId}
              className={"cb-trigger" + (open ? " open" : "")} onClick={() => setOpen(o => !o)}>
        <span className="cb-icon">{iconType === "school" ? "◇" : "◊"}</span>
        <span className="cb-text">{selected ? selected[displayKey] : <em>{placeholder}</em>}</span>
        <span className="cb-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="cb-pop">
          {iconType === "school" && (
            <div className="cb-type-filters">
              <button type="button" className={"cb-type-btn" + (!typeFilter ? " on" : "")}
                      onClick={() => setTypeFilter(null)}>All</button>
              {SCHOOL_TYPES.map(t => (
                <button type="button" key={t} className={"cb-type-btn" + (typeFilter === t ? " on" : "")}
                        onClick={() => setTypeFilter(f => f === t ? null : t)}>
                  {t}
                </button>
              ))}
              <select className="cb-state-sel" value={stateFilter}
                      onChange={e => setStateFilter(e.target.value)}>
                <option value="">All states</option>
                {states.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div className="cb-search">
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={iconType === "school" ? "Search school or type any college…" : "Search program or type a major…"}
            />
          </div>
          <div id={listboxId} className="cb-list" role="listbox">
            {grouped ? (
              Object.entries(grouped).map(([g, lst]) => (
                <div key={g}>
                  <div className="cb-group">{g}</div>
                  {lst.map(x => (
                    <button type="button" key={x.id} role="option" aria-selected={x.id === value}
                            className={"cb-item" + (x.id === value ? " sel" : "")}
                            onClick={() => { onChange(x.id); setOpen(false); setQ(""); }}>
                      <span className="cb-item-name">{x[displayKey]}</span>
                      {x.typical_years && <span className="badge-yrs">{x.typical_years}yr</span>}
                      {x._estimated && <span className="badge-ai">AI est.</span>}
                    </button>
                  ))}
                </div>
              ))
            ) : (
              filt.map(x => (
                <button type="button" key={x.id} role="option" aria-selected={x.id === value}
                        className={"cb-item" + (x.id === value ? " sel" : "")}
                        onClick={() => { onChange(x.id); setOpen(false); setQ(""); }}>
                  <span className="cb-item-name">{x[displayKey]}</span>
                  <span className="cb-item-meta">
                    {x.type || x.group}
                    {x._estimated && <span className="badge-ai">AI est.</span>}
                  </span>
                </button>
              ))
            )}
            {q && onCustom && filt.length < 5 && (
              <button type="button" className="cb-item cb-custom"
                      onClick={() => { onCustom(q); setOpen(false); setQ(""); }}>
                <span className="cb-item-name"><b>+ Use "{q}"</b></span>
                <span className="cb-item-meta">AI estimate</span>
              </button>
            )}
            {filt.length === 0 && !onCustom && <div className="cb-empty">No matches.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, source, detail }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned]   = useState(false);
  const open = hovered || pinned;
  const isObj = source && typeof source === "object";
  const ariaLabel = typeof label === "string" ? `More info about ${label}` : "More info";
  return (
    <span className="info-wrap"
          onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button type="button" className="info-btn" aria-label={ariaLabel}
              onClick={() => setPinned(o => !o)}>
        <svg width="11" height="11" viewBox="0 0 11 11"><circle cx="5.5" cy="5.5" r="4.6" fill="none" stroke="currentColor" strokeWidth="0.9"/><text x="5.5" y="8.2" textAnchor="middle" fontSize="7" fontFamily="serif" fontStyle="italic">i</text></svg>
      </button>
      {open && (
        <span className="info-pop">
          {label && <b>{label}</b>}
          {detail && <span className="info-detail">{detail}</span>}
          {source && (isObj ? (
            <>
              <span className="info-src"><em>Source</em> {source.src}</span>
              <span className="info-meta">
                <span><em>Vintage</em> {source.vintage}</span>
                <span><em>Released</em> {source.released}</span>
                <span><em>Cadence</em> {source.cadence}</span>
              </span>
            </>
          ) : (
            <span className="info-src">Source: {source}</span>
          ))}
        </span>
      )}
    </span>
  );
}

function HeroStat({ label, value, sublabel, source, accent, big, mono = true, sign }) {
  return (
    <div className={"hero-stat" + (big ? " big" : "")}>
      <div className="hero-label">
        {label} {source && <Info label={label} source={source} />}
      </div>
      <div className={"hero-num" + (accent ? " " + accent : "") + (mono ? " mono" : "")}>
        {sign === "neg" ? <span className="neg">{value}</span> :
         sign === "pos" ? <span className="pos">{value}</span> : value}
      </div>
      {sublabel && <div className="hero-sub">{sublabel}</div>}
    </div>
  );
}

const TWO_YR_TYPES = new Set(["Public 2-yr", "Trade"]);

function InputsPanel({ inputs, setInput, customSchools, customPrograms, addCustomSchool, addCustomProgram, incomeBracket, onIncomeBracketChange }) {
  const allSchools = useMemo(
    () => [...D.SCHOOLS, ...customSchools],
    [customSchools]
  );
  const school = useMemo(
    () => allSchools.find(s => s.id === inputs.schoolId),
    [allSchools, inputs.schoolId]
  );
  const allPrograms = useMemo(() => {
    const isTwoYr = school && TWO_YR_TYPES.has(school.type);
    return [...D.PROGRAMS, ...customPrograms].filter(p => {
      if (isTwoYr ? p.typical_years !== 2 : p.typical_years === 2) return false;
      if (school?.offered) return school.offered.includes(p.id);
      return true;
    });
  }, [customPrograms, school]);
  return (
    <div className="inputs">
      <div className="ipt-row">
        <div className="ipt-grp ipt-school">
          <label className="ipt-lbl">School</label>
          <Combobox items={allSchools} value={inputs.schoolId}
                    onChange={(v) => setInput("schoolId", v)}
                    placeholder="Choose a school…" iconType="school"
                    onCustom={addCustomSchool} />
        </div>
        <div className="ipt-grp ipt-program">
          <label className="ipt-lbl">Program / major</label>
          <Combobox items={allPrograms} value={inputs.programId}
                    onChange={(v) => setInput("programId", v)}
                    placeholder="Choose a program…" iconType="program"
                    onCustom={addCustomProgram} />
        </div>
      </div>

      <div className="ipt-grid">
        <Field label="Residency">
          <Segment value={inputs.residency} onChange={(v) => setInput("residency", v)}
                   options={[["in", "In-state"], ["out", "Out-of-state"]]} />
        </Field>
        <Field label="Years to complete">
          <Segment value={inputs.years} onChange={(v) => setInput("years", v)}
                   options={[[2, "2"], [4, "4"], [5, "5"], [6, "6"]]} />
        </Field>
        <Field label="Living">
          <Segment value={inputs.living} onChange={(v) => setInput("living", v)}
                   options={[["on-campus", "On"], ["off-campus", "Off"], ["with-parents", "Parents"]]} />
          {inputs.living === "with-parents" && (
            <NumInput value={inputs.livingExpenses} onChange={(v) => setInput("livingExpenses", v)}
                      prefix="$" step={100} sublabel="personal expenses / yr" />
          )}
        </Field>
        <Field label="Family income">
          <IncomeSel value={incomeBracket} onChange={onIncomeBracketChange} />
        </Field>
        <Field label="Annual aid / scholarships">
          <NumInput value={inputs.aid} onChange={(v) => setInput("aid", v)} prefix="$" step={500} />
        </Field>
        <Field label="Loan term">
          <Segment value={inputs.loanTerm} onChange={(v) => setInput("loanTerm", v)}
                   options={[[10, "10y"], [15, "15y"], [20, "20y"], [25, "25y"]]} />
        </Field>
        <Field label={<span>Loan rate <Info source={D.SOURCES.loanRate} detail="2024–25 federal direct subsidized rate is 6.53%. Override below." /></span>}>
          <NumInput
            value={inputs.loanRate === "" ? "" : Math.round(inputs.loanRate * 10000) / 100}
            onChange={(v) => setInput("loanRate", v === "" ? "" : v / 100)}
            suffix="%" step={0.1} />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="field"><label className="ipt-lbl">{label}</label>{children}</div>;
}

function Segment({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => (
        <button type="button" key={v} className={"seg-opt" + (v === value ? " on" : "")}
                onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

function NumInput({ value, onChange, prefix, suffix, step = 1, sublabel }) {
  return (
    <div className="numinp-wrap">
      {sublabel && <span className="numinp-sublabel">{sublabel}</span>}
      <div className="numinp">
        {prefix && <span className="numinp-pre">{prefix}</span>}
        <input type="number" value={value} step={step}
               onChange={(e) => {
                 const raw = e.target.value;
                 onChange(raw === "" ? "" : Number(raw));
               }} />
        {suffix && <span className="numinp-suf">{suffix}</span>}
      </div>
    </div>
  );
}

Object.assign(window, { Combobox, Info, HeroStat, InputsPanel, Field, Segment, NumInput, IncomeSel, TWEAK_DEFAULTS });
