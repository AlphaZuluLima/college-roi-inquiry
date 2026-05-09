#!/usr/bin/env python3
"""
fetch_program_earnings.py — Fetch field-of-study earnings from College Scorecard.

Queries the same /v1/schools endpoint using latest.programs.cip_4_digit fields,
maps CIP 4-digit codes to our program IDs, and writes earnings.js.

Usage:
  python fetch_program_earnings.py --key YOUR_API_KEY [--states AL,AK,...] [--out earnings.js]
"""

import argparse
import json
import re
import sys
import time
import urllib.request
import urllib.parse

BASE_URL = "https://api.data.gov/ed/collegescorecard/v1/schools"

ALL_STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
    "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
    "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
    "VT","VA","WA","WV","WI","WY",
]

# (cip4_code_int, credential_level) → [program_ids]
# credential_level: 1=cert, 2=associate, 3=bachelor
CIP4_MAP = {
    (1101, 3): ["computer-science"],
    (1104, 3): ["data-science"],
    (1107, 3): ["data-science"],
    (2705, 3): ["data-science"],
    (1419, 3): ["engineering-mech"],
    (1410, 3): ["engineering-elec"],
    (1408, 3): ["engineering-civil"],
    (1403, 3): ["engineering-civil"],
    (2601, 3): ["biology", "pre-med"],
    (4005, 3): ["chemistry"],
    (2701, 3): ["mathematics"],
    (5138, 3): ["nursing"],
    (5110, 3): ["pre-med"],
    (5122, 3): ["public-health"],
    (5202, 3): ["business"],
    (5208, 3): ["finance"],
    (5203, 3): ["accounting"],
    (4506, 3): ["economics"],
    (5214, 3): ["marketing"],
    (2401, 3): ["liberal-arts"],
    (2301, 3): ["english"],
    (5401, 3): ["history"],
    (3801, 3): ["philosophy"],
    (4201, 3): ["psychology"],
    (4511, 3): ["sociology"],
    (4510, 3): ["poli-sci"],
    (901,  3): ["communications"],
    (1301, 3): ["education"],
    (4407, 3): ["social-work"],
    (5007, 3): ["fine-arts"],
    (5009, 3): ["music"],
    (5006, 3): ["film"],
    (402,  3): ["architecture"],
    # 2-yr / trade (associate level)
    (4701, 2): ["hvac"],
    (4701, 1): ["hvac"],
    (4603, 2): ["electrician"],
    (4603, 1): ["electrician"],
    (4605, 2): ["plumbing"],
    (4605, 1): ["plumbing"],
    (4805, 2): ["welding"],
    (4805, 1): ["welding"],
    (4706, 2): ["automotive"],
    (4706, 1): ["automotive"],
    (5106, 2): ["dental-hyg"],
    (5106, 1): ["dental-hyg"],
    (5109, 2): ["radiology-tech"],
    (5109, 1): ["radiology-tech"],
    (5138, 2): ["nursing-rn"],
}

FIELDS = ",".join([
    "id",
    "school.name",
    "school.state",
    "latest.programs.cip_4_digit.code",
    "latest.programs.cip_4_digit.credential.level",
    "latest.programs.cip_4_digit.earnings.highest.2_yr.overall_median_earnings",
    "latest.programs.cip_4_digit.earnings.highest.3_yr.overall_median_earnings",
])

TARGET_CIPS = {code for (code, _) in CIP4_MAP}


def slugify(name):
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")[:40]


def fetch_page(key, state, page):
    params = {
        "school.state": state,
        "school.operating": 1,
        "fields": FIELDS,
        "per_page": 100,
        "page": page,
        "api_key": key,
    }
    url = BASE_URL + "?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:300]
            if e.code == 429:
                print("  Rate limited, waiting 5s…", file=sys.stderr)
                time.sleep(5)
                continue
            print(f"HTTP {e.code} for {state} page {page}: {body}", file=sys.stderr)
            return None
        except Exception as e:
            print(f"Error fetching {state} page {page}: {e}", file=sys.stderr)
            if attempt < 2:
                time.sleep(2)
            else:
                return None
    return None


def extract_school_earnings(r):
    name = r.get("school.name") or ""
    if not name:
        return None, {}

    school_id = slugify(name)
    programs_raw = r.get("latest.programs.cip_4_digit")
    if not isinstance(programs_raw, list) or not programs_raw:
        return school_id, {}

    # Accumulate best (highest) earnings per program_id
    best = {}
    for prog in programs_raw:
        if not isinstance(prog, dict):
            continue
        code = prog.get("code")
        cred = (prog.get("credential") or {}).get("level")
        if code is None or cred is None:
            continue

        try:
            code = int(code)
            cred = int(cred)
        except (TypeError, ValueError):
            continue

        # Only process CIP codes we care about
        if code not in TARGET_CIPS:
            continue

        prog_ids = CIP4_MAP.get((code, cred))
        if not prog_ids:
            continue

        highest = (prog.get("earnings") or {}).get("highest") or {}
        sal2yr = (highest.get("2_yr") or {}).get("overall_median_earnings")
        sal3yr = (highest.get("3_yr") or {}).get("overall_median_earnings")

        if sal2yr is None and sal3yr is None:
            continue

        for pid in prog_ids:
            prev = best.get(pid)
            # Keep entry with higher 2yr earnings (or 3yr if 2yr is None)
            new_2yr = sal2yr or 0
            prev_2yr = (prev or {}).get("sal2yr") or 0
            if prev is None or new_2yr > prev_2yr:
                best[pid] = {
                    "sal2yr": int(sal2yr) if sal2yr else None,
                    "sal3yr": int(sal3yr) if sal3yr else None,
                }

    # Remove entries where all values are None
    return school_id, {pid: v for pid, v in best.items() if v.get("sal2yr") or v.get("sal3yr")}


def fetch_state(key, state):
    results = {}
    page = 0
    total_fetched = 0
    while True:
        data = fetch_page(key, state, page)
        if not data:
            break
        rows = data.get("results", [])
        if not rows:
            break
        for r in rows:
            school_id, earnings = extract_school_earnings(r)
            if school_id and earnings:
                # Merge: keep best across pages (shouldn't happen but just in case)
                if school_id in results:
                    for pid, v in earnings.items():
                        existing = results[school_id].get(pid)
                        if not existing or (v.get("sal2yr") or 0) > (existing.get("sal2yr") or 0):
                            results[school_id][pid] = v
                else:
                    results[school_id] = earnings
        total_meta = data.get("metadata", {}).get("total", 0)
        total_fetched = min((page + 1) * 100, total_meta)
        if total_fetched >= total_meta:
            break
        page += 1
        time.sleep(0.1)
    return results


def write_earnings_js(all_earnings, out_path):
    lines = ["// earnings.js — School × program earnings from College Scorecard field-of-study API."]
    lines.append("// Auto-generated by fetch_program_earnings.py — do not edit by hand.")
    lines.append("// calc.js uses these to override BLS-based salStart when available.")
    lines.append("window.ROI_EARNINGS = {")

    for school_id in sorted(all_earnings):
        progs = all_earnings[school_id]
        if not progs:
            continue
        prog_parts = []
        for pid in sorted(progs):
            v = progs[pid]
            s2 = v.get("sal2yr")
            s3 = v.get("sal3yr")
            s2_js = str(s2) if s2 is not None else "null"
            s3_js = str(s3) if s3 is not None else "null"
            prog_parts.append(f'    "{pid}":{{sal2yr:{s2_js},sal3yr:{s3_js}}}')
        lines.append(f'  "{school_id}":{{\n' + ",\n".join(prog_parts) + "\n  },")

    lines.append("};")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"Wrote {out_path} ({len(all_earnings)} schools)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--key",    required=True)
    parser.add_argument("--states", default=None, help="Comma-separated states (default: all)")
    parser.add_argument("--out",    default="earnings.js")
    args = parser.parse_args()

    states = args.states.split(",") if args.states else ALL_STATES
    states = [s.strip().upper() for s in states]

    all_earnings = {}
    for i, state in enumerate(states):
        print(f"[{i+1}/{len(states)}] Fetching {state}…", file=sys.stderr)
        state_earnings = fetch_state(args.key, state)
        merged = 0
        for school_id, progs in state_earnings.items():
            if school_id in all_earnings:
                for pid, v in progs.items():
                    existing = all_earnings[school_id].get(pid)
                    if not existing or (v.get("sal2yr") or 0) > (existing.get("sal2yr") or 0):
                        all_earnings[school_id][pid] = v
                merged += 1
            else:
                all_earnings[school_id] = progs
        new = len(state_earnings) - merged
        print(f"  → {new} new schools, {merged} merged, running total: {len(all_earnings)}", file=sys.stderr)

    write_earnings_js(all_earnings, args.out)


if __name__ == "__main__":
    main()
