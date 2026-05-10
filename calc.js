// calc.js — Financial math for the ROI calculator.
// All money values in nominal USD, rates as decimal (0.07 = 7%).

(function () {
  const D = window.ROI_DATA;

  const HORIZON_YEARS = 50;

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  function monthlyPayment(principal, annualRate, termYears) {
    if (principal <= 0) return 0;
    const n = Number(termYears) * 12;
    if (!Number.isFinite(n) || n <= 0) return 0;
    const r = Number(annualRate) / 12;
    if (!Number.isFinite(r) || r < 0) return 0;
    if (r === 0) return principal / n;
    return (principal * r) / (1 - Math.pow(1 + r, -n));
  }

  function totalLoanInterest(principal, annualRate, termYears) {
    const m = monthlyPayment(principal, annualRate, termYears);
    return Math.max(0, m * termYears * 12 - principal);
  }

  function getSchool(id) { return D.SCHOOLS.find(s => s.id === id); }
  function getProgram(id) { return D.PROGRAMS.find(p => p.id === id); }
  function getMultiplier(schoolId, programId) {
    const m = D.SCHOOL_MULT[schoolId];
    if (!m) return 1.0;
    return m[programId] ?? m.default ?? 1.0;
  }

  function annualCost(school, opts) {
    const tuition = opts.residency === "in" ? school.tuition_in : school.tuition_out;
    let rb = school.room_board;
    if (opts.living === "with-parents") rb = opts.livingExpenses ?? 0;
    else if (opts.living === "off-campus") rb = Math.round(rb * 0.85);
    const books = school.books;
    const aid = opts.aid;
    return {
      tuition,
      roomBoard: rb,
      books,
      gross: tuition + rb + books,
      aid,
      net: Math.max(0, tuition + rb + books - aid),
    };
  }

  function projectedSalary(school, program, opts) {
    const mult = getMultiplier(school.id, program.id) * (opts.scenarioMult ?? 1.0);
    const start = program.salary_start * mult;
    const mid = program.salary_mid * mult;
    return { start, mid, mult };
  }

  function salaryAtYear(start, mid, growth, year) {
    const s = Math.max(1, start);
    const m = Math.max(1, mid);
    if (year <= 0) return s;
    if (year <= 10) {
      const t = year / 10;
      return Math.exp(Math.log(s) * (1 - t) + Math.log(m) * t);
    }
    return m * Math.pow(1 + growth, year - 10);
  }

  function computeROI(opts) {
    const school = window.ROI_CALC.getSchool(opts.schoolId);
    const program = window.ROI_CALC.getProgram(opts.programId);
    if (!school || !program) return null;

    const scenarioMult = opts.scenario === "optimistic" ? 1.12
                       : opts.scenario === "pessimistic" ? 0.85
                       : 1.0;

    const yearly = annualCost(school, { residency: opts.residency, living: opts.living, aid: opts.aid, livingExpenses: opts.livingExpenses ?? 0 });
    const yearsCount = opts.years;
    const totalSticker = yearly.gross * yearsCount;
    const totalAid = yearly.aid * yearsCount;
    const netCost = yearly.net * yearsCount;

    // Simplified model: treats the full net cost as a single lump loan taken at graduation.
    // In practice, students borrow incrementally and subsidized loans defer interest while in school.
    const principal = netCost;
    const monthlyPay = monthlyPayment(principal, opts.loanRate, opts.loanTerm);
    const totalInterest = totalLoanInterest(principal, opts.loanRate, opts.loanTerm);
    const totalAllIn = principal + totalInterest;

    const sal = projectedSalary(school, program, { scenarioMult });
    const scorecard = (window.ROI_EARNINGS || {})[school.id]?.[program.id];
    const salStart = scorecard?.sal2yr ? scorecard.sal2yr * scenarioMult : sal.start;
    const salMid = sal.mid;
    const rawEmpRate = school.employ_6mo * Math.pow(program.employ_field, 0.7) * scenarioMult;
    const empRate = Number.isFinite(rawEmpRate) ? clamp(rawEmpRate, 0, 0.99) : 0;
    const expectedAnnual = (yr) => salaryAtYear(salStart, salMid, opts.salaryGrowth ?? program.growth, yr) * empRate;

    const hsAnnual = (yr) => salaryAtYear(D.HS_GRAD_SALARY_START, D.HS_GRAD_SALARY_MID, D.HS_GRAD_GROWTH, yr);

    const horizon = HORIZON_YEARS;
    const series = [];
    let cumDegreeNet = 0;
    let cumHsNet = 0;
    let cumInvestAlt = 0;
    let breakEvenYear = null;
    let beatHsYear = null;
    let workYear = 0;

    for (let y = 0; y < horizon; y++) {
      let degreeIncome = 0;
      let degreeExpense = 0;
      let hsIncome = hsAnnual(y);

      if (y < yearsCount) {
        degreeExpense = yearly.net;
      } else {
        degreeIncome = expectedAnnual(workYear);
        if (workYear < opts.loanTerm) {
          degreeExpense = monthlyPay * 12;
        }
        workYear++;
      }

      cumDegreeNet += (degreeIncome - degreeExpense);
      cumHsNet += hsIncome;

      if (y < yearsCount) {
        cumInvestAlt = cumInvestAlt * (1 + D.SP500_REAL_RETURN) + yearly.net;
      } else {
        cumInvestAlt = cumInvestAlt * (1 + D.SP500_REAL_RETURN);
      }

      if (breakEvenYear === null && y >= yearsCount && cumDegreeNet >= 0) breakEvenYear = y;
      if (beatHsYear === null && cumDegreeNet >= cumHsNet && y >= yearsCount) beatHsYear = y;

      series.push({
        year: y,
        age: 18 + y,
        degreeNet: cumDegreeNet,
        hsNet: cumHsNet,
        investAlt: cumInvestAlt + cumHsNet,
        degreeIncome,
        degreeExpense,
        hsIncome,
      });
    }

    const lifetimeDegree = series[series.length - 1].degreeNet;
    const lifetimeHs = series[series.length - 1].hsNet;
    const lifetimeInvest = series[series.length - 1].investAlt;
    const netRoi = lifetimeDegree - lifetimeHs;
    const lifetimeEarningsGross = series.reduce((a, s) => a + s.degreeIncome, 0);

    const discount = opts.discountRate ?? 0.03;
    let npv = 0;
    for (const s of series) {
      npv += (s.degreeIncome - s.degreeExpense - s.hsIncome) / Math.pow(1 + discount, s.year);
    }

    const monthlyIncomeYr1 = expectedAnnual(0) / 12;
    const debtBurden = monthlyPay / Math.max(1, monthlyIncomeYr1);

    let verdict;
    if (netRoi > 800000 && (breakEvenYear ?? 99) - yearsCount <= 10) verdict = "strong";
    else if (netRoi > 250000) verdict = "moderate";
    else if (netRoi > 0) verdict = "marginal";
    else verdict = "negative";

    return {
      school, program,
      yearly, yearsCount,
      totalSticker, totalAid, netCost,
      principal, monthlyPay, totalInterest, totalAllIn,
      loanTerm: opts.loanTerm,
      salStart, salMid, empRate, salaryMult: sal.mult,
      series,
      breakEvenYear, beatHsYear,
      lifetimeDegree, lifetimeHs, lifetimeInvest, netRoi, lifetimeEarningsGross,
      npv, debtBurden, verdict,
      monthlyIncomeYr1,
    };
  }

  function compute2plus2(opts) {
    const cc    = window.ROI_CALC.getSchool(opts.ccId);
    const univ  = window.ROI_CALC.getSchool(opts.univId);
    const program = window.ROI_CALC.getProgram(opts.programId);
    if (!cc || !univ || !program) return null;

    const scenarioMult = opts.scenario === "optimistic" ? 1.12
                       : opts.scenario === "pessimistic" ? 0.85
                       : 1.0;

    const ccYearly   = annualCost(cc,   { residency: opts.residencyCC   ?? "in", living: opts.livingCC   ?? "with-parents", aid: opts.aidCC   ?? 0, livingExpenses: opts.livingExpensesCC   ?? 0 });
    const univYearly = annualCost(univ, { residency: opts.residencyUniv ?? "in", living: opts.livingUniv ?? "on-campus",    aid: opts.aidUniv ?? 0, livingExpenses: opts.livingExpensesUniv ?? 0 });

    const ccNetCost   = Math.max(0, ccYearly.net)   * 2;
    const univNetCost = Math.max(0, univYearly.net) * 2;
    const principal   = ccNetCost + univNetCost;
    const monthlyPay  = monthlyPayment(principal, opts.loanRate, opts.loanTerm);
    const totalInterest = totalLoanInterest(principal, opts.loanRate, opts.loanTerm);
    const totalAid    = (ccYearly.aid + univYearly.aid) * 2;
    const totalAllIn  = principal + totalInterest;

    // Direct 4-year at transfer school for comparison (same residency/living/aid as univ phase)
    const directYearly      = univYearly;
    const directNetCost     = Math.max(0, directYearly.net) * 4;
    const directPrincipal   = directNetCost;
    const directMonthlyPay  = monthlyPayment(directPrincipal, opts.loanRate, opts.loanTerm);
    const directTotalInterest = totalLoanInterest(directPrincipal, opts.loanRate, opts.loanTerm);
    const savings = directNetCost - (ccNetCost + univNetCost);

    const sal      = projectedSalary(univ, program, { scenarioMult });
    const scorecard2p2 = (window.ROI_EARNINGS || {})[univ.id]?.[program.id];
    const salStart = scorecard2p2?.sal2yr ? scorecard2p2.sal2yr * scenarioMult : sal.start;
    const salMid   = sal.mid;
    const rawEmpRate2 = univ.employ_6mo * Math.pow(program.employ_field, 0.7) * scenarioMult;
    const empRate  = Number.isFinite(rawEmpRate2) ? clamp(rawEmpRate2, 0, 0.99) : 0;
    const expectedAnnual = (yr) => salaryAtYear(salStart, salMid, opts.salaryGrowth ?? program.growth, yr) * empRate;

    const hsAnnual = (yr) => salaryAtYear(D.HS_GRAD_SALARY_START, D.HS_GRAD_SALARY_MID, D.HS_GRAD_GROWTH, yr);

    const series = [];
    let cumDegreeNet = 0, cumHsNet = 0, cumInvestAlt = 0;
    let breakEvenYear = null, beatHsYear = null, workYear = 0;

    for (let y = 0; y < HORIZON_YEARS; y++) {
      let degreeIncome = 0, degreeExpense = 0;
      const hsIncome = hsAnnual(y);

      if (y < 2) {
        degreeExpense = ccYearly.net;
        cumInvestAlt  = cumInvestAlt * (1 + D.SP500_REAL_RETURN) + ccYearly.net;
      } else if (y < 4) {
        degreeExpense = univYearly.net;
        cumInvestAlt  = cumInvestAlt * (1 + D.SP500_REAL_RETURN) + univYearly.net;
      } else {
        degreeIncome = expectedAnnual(workYear);
        if (workYear < opts.loanTerm) degreeExpense = monthlyPay * 12;
        workYear++;
        cumInvestAlt = cumInvestAlt * (1 + D.SP500_REAL_RETURN);
      }

      cumDegreeNet += (degreeIncome - degreeExpense);
      cumHsNet     += hsIncome;
      if (breakEvenYear === null && y >= 4 && cumDegreeNet >= 0) breakEvenYear = y;
      if (beatHsYear    === null && y >= 4 && cumDegreeNet >= cumHsNet) beatHsYear = y;

      series.push({
        year: y, age: 18 + y,
        degreeNet: cumDegreeNet, hsNet: cumHsNet,
        investAlt: cumInvestAlt + cumHsNet,
        degreeIncome, degreeExpense, hsIncome,
        phase: y < 2 ? "cc" : y < 4 ? "univ" : "work",
      });
    }

    const last                  = series[series.length - 1];
    const lifetimeDegree        = last.degreeNet;
    const lifetimeHs            = last.hsNet;
    const lifetimeInvest        = last.investAlt;
    const lifetimeEarningsGross = series.reduce((a, s) => a + s.degreeIncome, 0);
    const netRoi                = lifetimeDegree - lifetimeHs;
    const totalNetCost          = ccNetCost + univNetCost;
    const totalSticker          = ccYearly.gross * 2 + univYearly.gross * 2;
    const netCost               = totalNetCost;
    const yearsCount            = 4;

    // Synthetic blended yearly so all chart components (CostStack, Sankey) work unchanged:
    // yearly.X * yearsCount == actual 4-year total for each cost category
    const yearly = {
      tuition:   (ccYearly.tuition   * 2 + univYearly.tuition   * 2) / 4,
      roomBoard: (ccYearly.roomBoard * 2 + univYearly.roomBoard * 2) / 4,
      books:     (ccYearly.books     * 2 + univYearly.books     * 2) / 4,
      gross:     totalSticker / 4,
      aid:       totalAid / 4,
      net:       netCost / 4,
    };

    // Synthetic school with combined short name so ResultsView labels read correctly
    const school = { ...univ, short: `${cc.short}→${univ.short}`, _is2plus2: true };

    const discount = opts.discountRate ?? 0.03;
    let npv = 0;
    for (const s of series)
      npv += (s.degreeIncome - s.degreeExpense - s.hsIncome) / Math.pow(1 + discount, s.year);

    const monthlyIncomeYr1 = expectedAnnual(0) / 12;
    const debtBurden = monthlyPay / Math.max(1, monthlyIncomeYr1);
    const verdict = netRoi > 800000 && (breakEvenYear ?? 99) - 4 <= 10 ? "strong"
                  : netRoi > 250000 ? "moderate"
                  : netRoi > 0 ? "marginal" : "negative";

    return {
      // 2+2-specific
      cc, univ, ccYearly, univYearly, ccNetCost, univNetCost, totalNetCost,
      directNetCost, directPrincipal, directMonthlyPay, directTotalInterest, savings,
      // computeROI-compatible shape (consumed by ResultsView + all charts)
      school, program, yearly, yearsCount,
      totalSticker, totalAid, netCost, totalAllIn,
      principal, monthlyPay, totalInterest,
      loanTerm: opts.loanTerm,
      salStart, salMid, empRate, salaryMult: sal.mult,
      series, breakEvenYear, beatHsYear,
      lifetimeDegree, lifetimeHs, lifetimeInvest, lifetimeEarningsGross, netRoi,
      npv, debtBurden, verdict, monthlyIncomeYr1,
    };
  }

  async function fetchUnknownEntity(query, kind) {
    const prompt = kind === "school"
      ? `Return ONLY valid JSON for the US college named "${query}". Use this exact shape:
{"id":"slug","name":"Full Name","short":"ShortName","type":"Public 4-yr|Private 4-yr|Public 2-yr|Liberal Arts|Trade","city":"City, ST","tuition_in":number,"tuition_out":number,"room_board":number,"books":number,"avg_aid":number,"accept":number_0_to_1,"retention":number_0_to_1,"grad_rate":number_0_to_1,"employ_6mo":number_0_to_1,"_estimated":true}
Use realistic 2024 figures. If unsure of in-state vs out-of-state, set them equal. No prose, no markdown, just JSON.`
      : `Return ONLY valid JSON for the academic program "${query}". Use this exact shape:
{"id":"slug","name":"Display Name","group":"STEM|Health|Business|Education|Arts & Humanities|Social Sci.|Trade","salary_start":number_USD,"salary_mid":number_USD,"growth":number_decimal,"employ_field":number_0_to_1,"_estimated":true}
salary_start = median earnings 1 yr post-grad, salary_mid = ~10 yr post-grad. growth = annual real wage growth (e.g. 0.025). No prose, just JSON.`;

    if (!window.claude?.complete) {
      console.warn("AI fallback unavailable: window.claude not found");
      return null;
    }
    try {
      const text = await window.claude.complete(prompt);
      const cleaned = text.trim().replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, "").trim();
      const obj = JSON.parse(cleaned);
      if (!obj.id) obj.id = "ai_" + query.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30);
      obj._estimated = true;
      return obj;
    } catch (e) {
      console.warn("AI fallback failed:", e);
      return null;
    }
  }

  const fmt$ = (n, opts = {}) => {
    if (n == null || isNaN(n)) return "—";
    const abs = Math.abs(n);
    if (opts.compact !== false && abs >= 1e6) return (n < 0 ? "−" : "") + "$" + (abs / 1e6).toFixed(abs < 1e7 ? 2 : 1) + "M";
    if (opts.compact !== false && abs >= 1e4) return (n < 0 ? "−" : "") + "$" + Math.round(abs / 1e3) + "K";
    return (n < 0 ? "−" : "") + "$" + Math.round(abs).toLocaleString();
  };
  const fmt$Full = (n) => (n < 0 ? "−" : "") + "$" + Math.round(Math.abs(n)).toLocaleString();
  const fmtPct = (n, digits=0) => (n * 100).toFixed(digits) + "%";

  window.ROI_CALC = {
    monthlyPayment, totalLoanInterest,
    getSchool, getProgram, getMultiplier,
    annualCost, projectedSalary, salaryAtYear,
    computeROI, compute2plus2, fetchUnknownEntity,
    fmt$, fmt$Full, fmtPct,
  };
})();
