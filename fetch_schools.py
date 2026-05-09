#!/usr/bin/env python3
"""
fetch_schools.py — Pull school data from the College Scorecard API.

Usage:
  python fetch_schools.py --key YOUR_API_KEY --state VA
  python fetch_schools.py --key YOUR_API_KEY --state VA --out va_schools.js

Outputs JS snippet ready to paste into (or merge with) data.js.
"""

import argparse
import json
import re
import sys
import urllib.request
import urllib.parse

BASE_URL = "https://api.data.gov/ed/collegescorecard/v1/schools"

FIELDS = ",".join([
    "id",
    "school.name",
    "school.city",
    "school.state",
    "school.ownership",
    "school.degrees_awarded.highest",
    "school.carnegie_basic",
    "school.locale",
    "latest.cost.tuition.in_state",
    "latest.cost.tuition.out_of_state",
    "latest.cost.roomboard.oncampus",
    "latest.cost.booksupply",
    "latest.cost.avg_net_price.overall",
    "latest.admissions.admission_rate.overall",
    "latest.student.retention_rate.four_year.full_time",
    "latest.student.retention_rate.lt_four_year.full_time",
    "latest.completion.completion_rate_4yr_150nt",
    "latest.completion.completion_rate_less_than_4yr_150nt",
    "latest.earnings.6_yrs_after_entry.working_not_enrolled.mean_earnings",
    "latest.student.size",
])


def fetch_page(key, state, page):
    params = {
        "school.state": state,
        "school.operating": 1,          # currently operating only
        "fields": FIELDS,
        "per_page": 100,
        "page": page,
        "api_key": key,
    }
    url = BASE_URL + "?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:300]
        print(f"HTTP {e.code}: {body}", file=sys.stderr)
        sys.exit(1)


def slugify(name):
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")[:40]


# Attempt a readable short name from the full name.
KNOWN_SHORT = {
    "university of virginia": "UVA",
    "virginia polytechnic institute and state university": "VT",
    "virginia tech": "VT",
    "virginia commonwealth university": "VCU",
    "george mason university": "GMU",
    "james madison university": "JMU",
    "old dominion university": "ODU",
    "college of william & mary": "William & Mary",
    "william & mary": "William & Mary",
    "university of richmond": "Richmond",
    "virginia military institute": "VMI",
    "washington and lee university": "W&L",
    "radford university": "Radford",
    "longwood university": "Longwood",
    "liberty university": "Liberty",
    "regent university": "Regent",
    "hampton university": "Hampton",
    "norfolk state university": "Norfolk State",
    "virginia state university": "VA State",
    "christopher newport university": "CNU",
    "mary baldwin university": "Mary Baldwin",
    "roanoke college": "Roanoke",
    "shenandoah university": "Shenandoah",
    "sweet briar college": "Sweet Briar",
    "hollins university": "Hollins",
    "bridgewater college": "Bridgewater",
    "emory & henry college": "E&H",
    "lynchburg university": "Lynchburg",
    "randolph college": "Randolph",
    "randolph-macon college": "R-MC",
    "virginia wesleyan university": "VWU",
    "eastern mennonite university": "EMU",
    "ferrum college": "Ferrum",
    "bluefield university": "Bluefield",
    "averett university": "Averett",
    "marymount university": "Marymount",
    "northern virginia community college": "NOVA",
    "tidewater community college": "TCC",
    "reynolds community college": "Reynolds",
    "piedmont virginia community college": "PVCC",
    "blue ridge community college": "BRCC",
    "new river community college": "NRCC",
    "virginia western community college": "VWCC",
    "rappahannock community college": "RCC",
    "central virginia community college": "CVCC",
    "lord fairfax community college": "LFCC",
    "germanna community college": "Germanna",
    "patrick henry community college": "PHCC",
    "southside virginia community college": "SVCC",
    "wytheville community college": "WCC",
    "mountain empire community college": "MECC",
    "virginia highlands community college": "VHCC",
    "dabney s. lancaster community college": "DSLCC",
    "paul d. camp community college": "PDCCC",
}


def short_name(name):
    key = name.lower().strip()
    for k, v in KNOWN_SHORT.items():
        if k in key:
            return v
    # Acronym from significant words
    stop = {"of", "the", "at", "and", "&", "a", "in", "for", "its"}
    words = [w for w in name.split() if w.lower() not in stop]
    if len(words) >= 3:
        return "".join(w[0] for w in words[:4]).upper()
    return words[0][:14] if words else name[:14]


def classify_type(ownership, highest_degree, carnegie_basic, size):
    """Map Scorecard codes to the four type strings used in data.js."""
    # ownership: 1=Public 2=Private nonprofit 3=Private for-profit
    # highest_degree: 0=non-degree 1=cert 2=assoc 3=bach 4=grad
    is_public = ownership == 1
    is_nonprofit = ownership == 2
    hd = highest_degree or 0

    if hd >= 3:
        if is_public:
            return "Public 4-yr"
        # Carnegie 22=Bac/A&S: Arts & Sciences Focus — traditional liberal arts colleges
        if is_nonprofit and carnegie_basic == 22 and (size or 9999) < 5000:
            return "Liberal Arts"
        return "Private 4-yr"
    elif hd == 2:
        return "Public 2-yr" if is_public else "Trade"
    else:
        return "Trade"


def map_school(r):
    name = r.get("school.name") or ""
    city = r.get("school.city") or ""
    state = r.get("school.state") or "VA"
    ownership = r.get("school.ownership")
    highest_degree = r.get("school.degrees_awarded.highest")
    carnegie_basic = r.get("school.carnegie_basic")
    size = r.get("latest.student.size")

    t_in  = r.get("latest.cost.tuition.in_state")
    t_out = r.get("latest.cost.tuition.out_of_state")
    rb    = r.get("latest.cost.roomboard.oncampus")
    bk    = r.get("latest.cost.booksupply")
    avg_net = r.get("latest.cost.avg_net_price.overall")

    accept       = r.get("latest.admissions.admission_rate.overall")
    ret_4yr      = r.get("latest.student.retention_rate.four_year.full_time")
    ret_2yr      = r.get("latest.student.retention_rate.lt_four_year.full_time")
    grad_4yr     = r.get("latest.completion.completion_rate_4yr_150nt")
    grad_2yr     = r.get("latest.completion.completion_rate_less_than_4yr_150nt")
    earn_6yr     = r.get("latest.earnings.6_yrs_after_entry.working_not_enrolled.mean_earnings")

    # Skip schools with no tuition data at all (non-Title-IV, unusual programs)
    if t_in is None and t_out is None:
        return None

    t_in  = round(t_in  or t_out or 0)
    t_out = round(t_out or t_in  or 0)
    rb    = round(rb or 10500)
    bk    = round(bk or 1200)

    # avg_aid = sticker (in-state) − avg net price
    total_sticker = t_in + rb + bk
    avg_aid = max(0, round(total_sticker - avg_net)) if avg_net else 0

    retention = round(ret_4yr or ret_2yr or 0.72, 2)
    grad_rate = round(grad_4yr or grad_2yr or 0.50, 2)

    # Proxy employ_6mo from 6-yr earnings
    if earn_6yr:
        if   earn_6yr >= 60000: employ = 0.93
        elif earn_6yr >= 50000: employ = 0.90
        elif earn_6yr >= 40000: employ = 0.85
        elif earn_6yr >= 32000: employ = 0.79
        else:                   employ = 0.73
    else:
        employ = 0.82   # fallback

    stype = classify_type(ownership, highest_degree, carnegie_basic, size)

    return {
        "id":         slugify(name),
        "name":       name,
        "short":      short_name(name),
        "type":       stype,
        "city":       f"{city}, {state}",
        "tuition_in": t_in,
        "tuition_out":t_out,
        "room_board": rb,
        "books":      bk,
        "avg_aid":    avg_aid,
        "accept":     round(accept, 2) if accept is not None else 1.00,
        "retention":  retention,
        "grad_rate":  grad_rate,
        "employ_6mo": employ,
    }


def to_js(schools, state):
    lines = [f"  // ─── {state} schools from College Scorecard ({'—'.join([str(len(schools)), 'schools'])}) ────"]
    for s in schools:
        lines.append(
            f'  {{ id:"{s["id"]}", name:"{s["name"]}", short:"{s["short"]}", '
            f'type:"{s["type"]}", city:"{s["city"]}",\n'
            f'    tuition_in:{s["tuition_in"]}, tuition_out:{s["tuition_out"]}, '
            f'room_board:{s["room_board"]}, books:{s["books"]},\n'
            f'    avg_aid:{s["avg_aid"]}, accept:{s["accept"]}, '
            f'retention:{s["retention"]}, grad_rate:{s["grad_rate"]}, '
            f'employ_6mo:{s["employ_6mo"]} }},'
        )
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Fetch school data from College Scorecard API")
    parser.add_argument("--key",   required=True, help="api.data.gov API key")
    parser.add_argument("--state", default="VA",  help="Two-letter state code (default: VA)")
    parser.add_argument("--out",   default=None,  help="Output file (default: stdout)")
    parser.add_argument("--json",  action="store_true", help="Output raw JSON instead of JS")
    args = parser.parse_args()

    all_schools = []
    page = 0
    while True:
        data = fetch_page(args.key, args.state, page)
        results = data.get("results", [])
        if not results:
            break
        for r in results:
            s = map_school(r)
            if s:
                all_schools.append(s)
        total   = data.get("metadata", {}).get("total", 0)
        fetched = min((page + 1) * 100, total)
        print(f"  {fetched}/{total} schools fetched…", file=sys.stderr)
        if fetched >= total:
            break
        page += 1

    # Sort: 4-yr first, then 2-yr, then Trade; alpha within group
    order = {"Public 4-yr": 0, "Private 4-yr": 1, "Liberal Arts": 2, "Public 2-yr": 3, "Trade": 4}
    all_schools.sort(key=lambda s: (order.get(s["type"], 9), s["name"]))

    print(f"\nDone — {len(all_schools)} schools with usable data.", file=sys.stderr)

    if args.json:
        output = json.dumps(all_schools, indent=2)
    else:
        output = to_js(all_schools, args.state)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"Written to {args.out}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
