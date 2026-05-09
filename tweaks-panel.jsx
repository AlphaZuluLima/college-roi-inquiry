// tweaks-panel.jsx — Right-side tweaks panel + useTweaks hook.
const { useState: tUseState, useCallback: tUseCallback } = React;

function useTweaks(defaults) {
  const [tweaks, setTweaks] = tUseState({ ...defaults });
  const setTweak = tUseCallback((key, val) => {
    setTweaks(prev => ({ ...prev, [key]: val }));
  }, []);
  return [tweaks, setTweak];
}

function TweaksPanel({ children }) {
  const [collapsed, setCollapsed] = tUseState(false);
  return (
    <div className={"tweaks-panel" + (collapsed ? " collapsed" : "")}>
      <button className="tweaks-toggle" onClick={() => setCollapsed(c => !c)}>
        <span className="tweaks-toggle-icon">{collapsed ? "⊕" : "⊗"}</span>
        <span className="tweaks-toggle-label">{collapsed ? "" : "Tweaks"}</span>
      </button>
      {!collapsed && (
        <div className="tweaks-body">
          {children}
        </div>
      )}
    </div>
  );
}

function TweakSection({ label }) {
  return <div className="tweak-section">{label}</div>;
}

function TweakColor({ label, value, options, onChange }) {
  return (
    <div className="tweak-row">
      <div className="tweak-lbl">{label}</div>
      <div className="tweak-colors">
        {options.map(c => (
          <button
            key={c}
            className={"tweak-swatch" + (c === value ? " on" : "")}
            style={{ background: c }}
            onClick={() => onChange(c)}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}

function TweakRadio({ label, value, options, onChange }) {
  return (
    <div className="tweak-row">
      <div className="tweak-lbl">{label}</div>
      <div className="tweak-seg">
        {options.map(([v, l]) => (
          <button
            key={v}
            className={"tweak-seg-opt" + (v === value ? " on" : "")}
            onClick={() => onChange(v)}
          >{l}</button>
        ))}
      </div>
    </div>
  );
}

function TweakSlider({ label, value, min, max, step, unit, onChange }) {
  return (
    <div className="tweak-row tweak-row-slider">
      <div className="tweak-lbl">{label}</div>
      <div className="tweak-slider-wrap">
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="tweak-slider"
        />
        <span className="tweak-slider-val">{value.toFixed(step < 1 ? 1 : 0)}{unit}</span>
      </div>
    </div>
  );
}

Object.assign(window, { useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakSlider });
