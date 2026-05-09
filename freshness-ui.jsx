// freshness-ui.jsx — UI component for the API freshness badge.
const { useState: fUseState, useEffect: fUseEffect } = React;
const D = window.ROI_DATA;

function FreshnessBadge() {
  const [key, setKey] = fUseState(window.ROI_FRESHNESS.getApiKey());
  const [status, setStatus] = fUseState(null);
  const [showKeyInput, setShowKeyInput] = fUseState(!window.ROI_FRESHNESS.getApiKey());

  const snap = D.SNAPSHOT_DATE;
  const snapDate = new Date(snap);
  const ageMo = Math.round((Date.now() - snapDate) / (1000 * 60 * 60 * 24 * 30));

  async function runCheck() {
    setStatus("checking");
    try {
      const r = await window.ROI_FRESHNESS.checkFreshness();
      setStatus({ kind: "ok", ...r });
    } catch (e) {
      setStatus({ kind: "err", message: e.message });
    }
  }

  function saveKey() {
    window.ROI_FRESHNESS.setApiKey(key);
    setShowKeyInput(false);
  }
  function clearKey() {
    window.ROI_FRESHNESS.clearApiKey();
    setKey("");
    setShowKeyInput(true);
    setStatus(null);
  }

  let dotClass = "";
  if (status === "checking") dotClass = "checking";
  else if (status?.kind === "ok") dotClass = status.isStale ? "stale" : "ok";
  else if (status?.kind === "err") dotClass = "stale";

  return (
    <div className="freshness">
      <span className={"freshness-dot " + dotClass} />
      <div className="freshness-vintage">
        <b>Bundled snapshot:</b> {snap} · <b>Vintage:</b> 2023–24 academic year · <b>Age:</b> ~{ageMo} mo
        {status?.kind === "ok" && (
          <div className="fr-msg ok">
            ✓ Live API: freshest data available is <b>{status.freshestYear ?? "n/a"}</b>
            {status.isStale
              ? <span className="warn"> — bundled data is behind. Refresh recommended.</span>
              : <span> — bundled data is current.</span>}
            <span className="fr-meta"> · checked {new Date(status.checkedAt).toLocaleTimeString()} · {status.latencyMs}ms</span>
          </div>
        )}
        {status?.kind === "err" && (
          <div className="fr-msg err">✗ {status.message}</div>
        )}
      </div>
      <div className="freshness-actions">
        {showKeyInput ? (
          <>
            <input
              type="password"
              className="fr-key-input"
              placeholder="api.data.gov key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <button className="fr-btn" onClick={saveKey} disabled={!key}>Save</button>
          </>
        ) : (
          <>
            <button className="fr-btn" onClick={runCheck} disabled={status === "checking"}>
              {status === "checking" ? "Checking…" : "Check freshness"}
            </button>
            <button className="fr-btn" onClick={clearKey} title="Clear API key">⊘</button>
          </>
        )}
      </div>
    </div>
  );
}

window.FreshnessBadge = FreshnessBadge;
