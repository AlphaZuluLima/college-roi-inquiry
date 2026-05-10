#!/usr/bin/env python3
"""
update_employ.py — Re-derive employ_6mo in data.js from College Scorecard
6-year earnings using a smooth continuous formula instead of 5 coarse buckets.

Usage:
  python update_employ.py --key YOUR_API_KEY [--dry-run]

What it does:
  1. Fetches every active school from the Scorecard API (name + state + earn_6yr).
  2. Builds a lookup: (normalized_name, state) → earn_6yr.
  3. Walks data.js line-by-line, finding employ_6mo fields.
  4. For matched schools, replaces the value with the smooth formula result.
  5. Writes the updated data.js (or prints stats with --dry-run).

Smooth formula:
  employ = clamp(0.65 + (earn_6yr - 20000) / 55000 * 0.30,  0.60, 0.95)
  Anchors: $20k → 0.65,  $40k → 0.76,  $57.5k → 0.87,  $75k → 0.95
  No-data fallback: 0.75 (kept as-is; no regression from old 0.82 default).
"""

import argparse
import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request

BASE = "https://api.data.gov/ed/collegescorecard/v1/schools"
EARN_FIELD = "latest.earnings.6_yrs_after_entry.working_not_enrolled.mean_earnings"
FETCH_FIELDS = ",".join(["school.name", "school.state", EARN_FIELD])


# ── Fetch all Scorecard schools ───────────────────────────────────────────────

def fetch_all(key):
    lookup = {}   # (norm_name, state) → earn_6yr
    page = 0
    total_fetched = 0
    while True:
        params = {
            "school.operating": 1,
            "fields": FETCH_FIELDS,
            "per_page": 100,
            "page": page,
            "api_key": key,
        }
        url = BASE + "?" + urllib.parse.urlencode(params)
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                data = json.loads(r.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:300]
            print(f"HTTP {e.code} on page {page}: {body}", file=sys.stderr)
            sys.exit(1)

        results = data.get("results", [])
        if not results:
            break

        for r in results:
            name  = r.get("school.name") or ""
            state = r.get("school.state") or ""
            earn  = r.get(EARN_FIELD)
            key_t = (normalize(name), state)
            # keep the higher-earning record when duplicates exist (branch campuses)
            if key_t not in lookup or (earn and (lookup[key_t] is None or earn > lookup[key_t])):
                lookup[key_t] = earn

        total_fetched += len(results)
        metadata = data.get("metadata", {})
        total = metadata.get("total", 0)
        print(f"  page {page}: fetched {total_fetched}/{total}", flush=True)

        if total_fetched >= total:
            break
        page += 1
        time.sleep(0.12)   # ~8 req/s — well within rate limits

    return lookup


# ── Name normalization (mirrors slugify logic but keeps words) ────────────────

def normalize(name):
    n = name.lower().strip()
    # drop common suffixes that vary in Scorecard vs our data
    for suffix in [", the", " - main campus", " main campus", " at ", "-"]:
        n = n.replace(suffix, " ")
    n = re.sub(r"[^a-z0-9 ]", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


# ── Smooth earnings → employ_6mo formula ─────────────────────────────────────

def earn_to_employ(earn):
    if not earn or earn <= 0:
        return None   # no data — leave existing value unchanged
    rate = 0.65 + (earn - 20_000) / 55_000 * 0.30
    return round(max(0.60, min(0.95, rate)), 2)


# ── Parse data.js school blocks to build (name, state) index ─────────────────

def parse_schools(lines):
    """
    Returns list of dicts:
      { name, state, employ_line_idx, old_employ }
    where employ_line_idx is the index of the line containing employ_6mo:.
    """
    schools = []
    cur_state = ""
    cur_name  = None
    cur_name_line = None

    for i, line in enumerate(lines):
        m = re.search(r"─── ([A-Z]{2}) \(", line)
        if m:
            cur_state = m.group(1)
            continue

        if line.strip().startswith('{ id:'):
            nm = re.search(r'name:"([^"]+)"', line)
            cur_name = nm.group(1) if nm else None
            cur_name_line = i
            continue

        m2 = re.search(r'\bemploy_6mo:([\d.]+)', line)
        if m2 and cur_name:
            schools.append({
                "name":            cur_name,
                "state":           cur_state,
                "employ_line_idx": i,
                "old_employ":      float(m2.group(1)),
            })
            cur_name = None

    return schools


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Update employ_6mo in data.js")
    parser.add_argument("--key",     required=True, help="api.data.gov API key")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print stats only; do not modify data.js")
    args = parser.parse_args()

    print("Fetching Scorecard earnings data…")
    scorecard = fetch_all(args.key)
    print(f"  → {len(scorecard)} schools in lookup\n")

    with open("data.js", "r", encoding="utf-8") as f:
        lines = f.readlines()

    schools = parse_schools(lines)
    print(f"data.js contains {len(schools)} school employ_6mo fields\n")

    matched = 0
    no_earn = 0
    unchanged = 0
    changes   = {}   # line_idx → new_value

    for s in schools:
        key = (normalize(s["name"]), s["state"])
        earn = scorecard.get(key)

        # fallback: try without state (handles flagship schools at top of file
        # that have state='' because they precede the first state header)
        if earn is None:
            for (n, _), e in scorecard.items():
                if n == key[0]:
                    earn = e
                    break

        new_val = earn_to_employ(earn)
        if new_val is None:
            no_earn += 1
            continue

        matched += 1
        if new_val == s["old_employ"]:
            unchanged += 1
        else:
            changes[s["employ_line_idx"]] = (s["old_employ"], new_val)

    print(f"Matched:   {matched}")
    print(f"No earn data (kept as-is): {no_earn}")
    print(f"Values changing: {len(changes)}")
    print(f"Values already correct: {unchanged}")

    if args.dry_run:
        # Show a sample of changes
        sample = list(changes.items())[:20]
        print("\nSample changes:")
        for idx, (old, new) in sample:
            name_m = re.search(r'name:"([^"]+)"', lines[idx - 1])
            name = name_m.group(1) if name_m else "?"
            print(f"  {name}: {old} → {new}")
        return

    # Apply changes
    for idx, (old, new) in changes.items():
        lines[idx] = re.sub(
            r'\bemploy_6mo:[\d.]+',
            f'employ_6mo:{new}',
            lines[idx],
        )

    with open("data.js", "w", encoding="utf-8", newline="\n") as f:
        f.writelines(lines)

    print(f"\ndata.js updated — {len(changes)} employ_6mo values recomputed.")

    # Distribution of new values
    new_vals = {}
    for idx, (_, new) in changes.items():
        k = f"{new:.2f}"
        new_vals[k] = new_vals.get(k, 0) + 1
    print("\nNew employ_6mo distribution (changed values only, top 15):")
    for v, c in sorted(new_vals.items(), key=lambda x: -x[1])[:15]:
        print(f"  {v}: {c}  {'█' * max(1, round(c/10))}")


if __name__ == "__main__":
    main()
