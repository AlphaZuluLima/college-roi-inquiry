// freshness.js — College Scorecard API freshness check.

(function () {
  const LS_KEY = "scorecard_api_key";
  const ENDPOINT = "https://api.data.gov/ed/collegescorecard/v1/schools";

  function getApiKey() { return localStorage.getItem(LS_KEY) || ""; }
  function setApiKey(k) { localStorage.setItem(LS_KEY, k); }
  function clearApiKey() { localStorage.removeItem(LS_KEY); }

  async function checkFreshness() {
    const key = getApiKey();
    if (!key) throw new Error("No API key set");

    const fields = [
      "id", "school.name",
      "latest.cost.tuition.in_state",
      "latest.cost.tuition.out_of_state",
      "latest.aid.federal_loan_rate",
      "latest.completion.completion_rate_4yr_150nt",
      "latest.earnings.10_yrs_after_entry.median",
      "2023.cost.tuition.in_state",
      "2022.cost.tuition.in_state",
      "2021.cost.tuition.in_state",
    ].join(",");

    const url = `${ENDPOINT}?id=234076&fields=${fields}&api_key=${encodeURIComponent(key)}`;
    const t0 = performance.now();
    const res = await fetch(url);
    const ms = Math.round(performance.now() - t0);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${body.slice(0, 120)}`);
    }
    const json = await res.json();
    const r = json.results?.[0];
    if (!r) throw new Error("No school data returned");

    const yearKeys = Object.keys(r).filter(k => /^\d{4}\.cost\.tuition\.in_state$/.test(k));
    let freshestYear = null;
    for (const k of yearKeys) {
      const yr = parseInt(k.slice(0, 4), 10);
      if (r[k] != null && (freshestYear == null || yr > freshestYear)) freshestYear = yr;
    }

    return {
      ok: true,
      latencyMs: ms,
      freshestYear,
      latestTuitionIn:  r["latest.cost.tuition.in_state"],
      latestTuitionOut: r["latest.cost.tuition.out_of_state"],
      latestEarnings:   r["latest.earnings.10_yrs_after_entry.median"],
      schoolName:       r["school.name"],
      bundledYear: 2023,
      isStale: freshestYear != null && freshestYear > 2023,
      checkedAt: new Date().toISOString(),
      raw: r,
    };
  }

  window.ROI_FRESHNESS = { getApiKey, setApiKey, clearApiKey, checkFreshness };
})();
