#!/usr/bin/env python3
"""
fetch_all_states.py — Fetch all US schools from College Scorecard and merge into data.js.

Usage:
  python fetch_all_states.py --key YOUR_API_KEY [--states AL,AK,...] [--skip-existing]

By default fetches all 50 states + DC, skips IDs already in data.js.
"""

import argparse
import json
import re
import sys
import time
import urllib.request
import urllib.parse
import os

BASE_URL = "https://api.data.gov/ed/collegescorecard/v1/schools"

ALL_STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
    "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
    "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
    "VT","VA","WA","WV","WI","WY",
]

CIP_FIELDS = [
    "latest.academics.program_percentage.computer",
    "latest.academics.program_percentage.mathematics",
    "latest.academics.program_percentage.engineering",
    "latest.academics.program_percentage.engineering_technology",
    "latest.academics.program_percentage.biological",
    "latest.academics.program_percentage.physical_science",
    "latest.academics.program_percentage.health",
    "latest.academics.program_percentage.business_marketing",
    "latest.academics.program_percentage.social_science",
    "latest.academics.program_percentage.psychology",
    "latest.academics.program_percentage.education",
    "latest.academics.program_percentage.public_administration_social_service",
    "latest.academics.program_percentage.english",
    "latest.academics.program_percentage.history",
    "latest.academics.program_percentage.humanities",
    "latest.academics.program_percentage.philosophy_religious",
    "latest.academics.program_percentage.communication",
    "latest.academics.program_percentage.visual_performing",
    "latest.academics.program_percentage.architecture",
    "latest.academics.program_percentage.mechanic_repair_technology",
    "latest.academics.program_percentage.construction",
    "latest.academics.program_percentage.precision_production",
    "latest.academics.program_percentage.language",
]

# Which CIP categories (any > 0) indicate a program is offered
PROG_TO_CIP = {
    "computer-science":    ["computer"],
    "data-science":        ["computer", "mathematics"],
    "engineering-mech":    ["engineering", "engineering_technology"],
    "engineering-elec":    ["engineering", "engineering_technology"],
    "engineering-civil":   ["engineering", "engineering_technology"],
    "biology":             ["biological"],
    "chemistry":           ["physical_science"],
    "mathematics":         ["mathematics"],
    "nursing":             ["health"],
    "pre-med":             ["biological", "health"],
    "public-health":       ["health"],
    "business":            ["business_marketing"],
    "finance":             ["business_marketing"],
    "accounting":          ["business_marketing"],
    "economics":           ["social_science", "business_marketing"],
    "marketing":           ["business_marketing"],
    "liberal-arts":        ["humanities", "english", "history", "philosophy_religious", "language"],
    "english":             ["english", "language"],
    "history":             ["history"],
    "philosophy":          ["philosophy_religious", "humanities"],
    "psychology":          ["psychology"],
    "sociology":           ["social_science"],
    "poli-sci":            ["social_science"],
    "communications":      ["communication"],
    "education":           ["education"],
    "social-work":         ["public_administration_social_service"],
    "fine-arts":           ["visual_performing"],
    "music":               ["visual_performing"],
    "film":                ["visual_performing", "communication"],
    "architecture":        ["architecture"],
    "hvac":                ["mechanic_repair_technology"],
    "electrician":         ["mechanic_repair_technology", "construction"],
    "plumbing":            ["mechanic_repair_technology", "construction"],
    "welding":             ["precision_production"],
    "automotive":          ["mechanic_repair_technology"],
    "dental-hyg":          ["health"],
    "radiology-tech":      ["health"],
    "nursing-rn":          ["health"],
}

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
] + CIP_FIELDS)


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
                print(f"  Rate limited, waiting 5s…", file=sys.stderr)
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


def slugify(name):
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")[:40]


KNOWN_SHORT = {
    # Virginia
    "university of virginia": "UVA",
    "virginia polytechnic": "VT",
    "virginia commonwealth university": "VCU",
    "george mason university": "GMU",
    "james madison university": "JMU",
    "old dominion university": "ODU",
    "college of william": "W&M",
    "university of richmond": "Richmond",
    # National flagship / well-known
    "university of michigan": "U Mich",
    "university of north carolina": "UNC",
    "university of texas at austin": "UT Austin",
    "university of california, berkeley": "UC Berkeley",
    "university of california, los angeles": "UCLA",
    "university of washington": "UW",
    "pennsylvania state university": "Penn State",
    "ohio state university": "Ohio State",
    "arizona state university": "ASU",
    "university of florida": "UF",
    "university of miami": "Miami",
    "harvard university": "Harvard",
    "stanford university": "Stanford",
    "massachusetts institute of technology": "MIT",
    "princeton university": "Princeton",
    "yale university": "Yale",
    "university of pennsylvania": "UPenn",
    "new york university": "NYU",
    "university of southern california": "USC",
    "duke university": "Duke",
    "carnegie mellon university": "CMU",
    "columbia university": "Columbia",
    "dartmouth college": "Dartmouth",
    "brown university": "Brown",
    "cornell university": "Cornell",
    "georgetown university": "Georgetown",
    "notre dame": "Notre Dame",
    "vanderbilt university": "Vanderbilt",
    "emory university": "Emory",
    "rice university": "Rice",
    "wake forest university": "Wake Forest",
    "tufts university": "Tufts",
    "boston university": "Boston U",
    "boston college": "BC",
    "northeastern university": "Northeastern",
    "university of chicago": "UChicago",
    "northwestern university": "Northwestern",
    "university of notre dame": "Notre Dame",
    "university of virginia": "UVA",
    "georgia institute of technology": "Georgia Tech",
    "georgia tech": "Georgia Tech",
    "university of georgia": "UGA",
    "university of illinois": "UIUC",
    "university of wisconsin": "UW-Madison",
    "university of minnesota": "UMN",
    "university of iowa": "Iowa",
    "iowa state university": "Iowa State",
    "purdue university": "Purdue",
    "indiana university": "IU",
    "michigan state university": "MSU",
    "rutgers university": "Rutgers",
    "temple university": "Temple",
    "drexel university": "Drexel",
    "university of pittsburgh": "Pitt",
    "carnegie mellon": "CMU",
    "university of maryland": "UMD",
    "johns hopkins university": "JHU",
    "university of colorado": "CU Boulder",
    "colorado state university": "CSU",
    "university of utah": "Utah",
    "brigham young university": "BYU",
    "university of arizona": "UA",
    "university of new mexico": "UNM",
    "university of nevada": "UNLV",
    "university of hawaii": "UH",
    "university of alaska": "UAF",
    "university of north dakota": "UND",
    "north dakota state university": "NDSU",
    "south dakota state university": "SDSU",
    "university of south dakota": "USD",
    "university of nebraska": "Nebraska",
    "university of kansas": "KU",
    "kansas state university": "K-State",
    "university of oklahoma": "OU",
    "oklahoma state university": "OSU",
    "university of arkansas": "UA",
    "university of missouri": "Mizzou",
    "saint louis university": "SLU",
    "washington university in st. louis": "WashU",
    "washington university in st louis": "WashU",
    "university of kentucky": "UK",
    "university of louisville": "Louisville",
    "university of tennessee": "UTK",
    "vanderbilt": "Vanderbilt",
    "university of mississippi": "Ole Miss",
    "mississippi state university": "MSU",
    "louisiana state university": "LSU",
    "tulane university": "Tulane",
    "university of alabama": "Alabama",
    "auburn university": "Auburn",
    "clemson university": "Clemson",
    "university of south carolina": "USC",
    "college of charleston": "CofC",
    "university of north carolina at chapel hill": "UNC",
    "north carolina state university": "NC State",
    "wake forest": "Wake Forest",
    "davidson college": "Davidson",
    "university of connecticut": "UConn",
    "yale": "Yale",
    "wesleyan university": "Wesleyan",
    "trinity college": "Trinity",
    "dartmouth": "Dartmouth",
    "university of vermont": "UVM",
    "middlebury college": "Middlebury",
    "university of maine": "UMaine",
    "university of new hampshire": "UNH",
    "university of rhode island": "URI",
    "brown": "Brown",
    "providence college": "Providence",
    "university of delaware": "Delaware",
    "university of massachusetts": "UMass",
    "amherst college": "Amherst",
    "williams college": "Williams",
    "smith college": "Smith",
    "mount holyoke college": "Mt Holyoke",
    "wellesley college": "Wellesley",
    "colgate university": "Colgate",
    "hamilton college": "Hamilton",
    "colby college": "Colby",
    "bowdoin college": "Bowdoin",
    "bates college": "Bates",
    "swarthmore college": "Swarthmore",
    "haverford college": "Haverford",
    "bryn mawr college": "Bryn Mawr",
    "lehigh university": "Lehigh",
    "bucknell university": "Bucknell",
    "gettysburg college": "Gettysburg",
    "dickinson college": "Dickinson",
    "lafayette college": "Lafayette",
    "villanova university": "Villanova",
    "fordham university": "Fordham",
    "hofstra university": "Hofstra",
    "stony brook university": "Stony Brook",
    "suny": "SUNY",
    "city university of new york": "CUNY",
    "baruch college": "Baruch",
    "hunter college": "Hunter",
    "oberlin college": "Oberlin",
    "kenyon college": "Kenyon",
    "ohio wesleyan university": "OWU",
    "denison university": "Denison",
    "case western reserve university": "Case Western",
    "university of dayton": "Dayton",
    "xavier university": "Xavier",
    "depaul university": "DePaul",
    "loyola university chicago": "Loyola Chicago",
    "marquette university": "Marquette",
    "university of notre dame": "Notre Dame",
    "DePauw university": "DePauw",
    "wabash college": "Wabash",
    "hope college": "Hope",
    "calvin university": "Calvin",
    "kalamazoo college": "Kalamazoo",
    "grinnell college": "Grinnell",
    "carleton college": "Carleton",
    "macalester college": "Macalester",
    "st. olaf college": "St Olaf",
    "gustavus adolphus college": "Gustavus",
    "university of st. thomas": "St Thomas",
    "hamline university": "Hamline",
    "university of denver": "Denver",
    "colorado college": "CC",
    "whitman college": "Whitman",
    "reed college": "Reed",
    "lewis & clark college": "L&C",
    "willamette university": "Willamette",
    "university of oregon": "UO",
    "oregon state university": "Oregon State",
    "portland state university": "PSU",
    "gonzaga university": "Gonzaga",
    "seattle university": "Seattle U",
    "university of puget sound": "Puget Sound",
    "pacific lutheran university": "PLU",
    "university of san francisco": "USF",
    "santa clara university": "SCU",
    "loyola marymount university": "LMU",
    "pepperdine university": "Pepperdine",
    "claremont mckenna college": "CMC",
    "pomona college": "Pomona",
    "harvey mudd college": "Harvey Mudd",
    "scripps college": "Scripps",
    "pitzer college": "Pitzer",
    "occidental college": "Occidental",
    "uc san diego": "UCSD",
    "university of california, san diego": "UCSD",
    "university of california, davis": "UC Davis",
    "university of california, santa barbara": "UCSB",
    "university of california, irvine": "UC Irvine",
    "university of california, santa cruz": "UCSC",
    "university of california, riverside": "UCR",
    "california institute of technology": "Caltech",
    "cal poly": "Cal Poly",
    "san diego state university": "SDSU",
    "san francisco state university": "SFSU",
    "california state university": "CSU",
    "northern virginia community college": "NOVA",
    "community college": "CC",
}


def short_name(name):
    key = name.lower().strip()
    for k, v in KNOWN_SHORT.items():
        if k in key:
            return v
    stop = {"of", "the", "at", "and", "&", "a", "in", "for", "its"}
    words = [w for w in name.split() if w.lower() not in stop]
    if len(words) >= 3:
        return "".join(w[0] for w in words[:4]).upper()
    return words[0][:14] if words else name[:14]


def classify_type(ownership, highest_degree, carnegie_basic, size):
    is_public = ownership == 1
    is_nonprofit = ownership == 2
    hd = highest_degree or 0
    if hd >= 3:
        if is_public:
            return "Public 4-yr"
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
    state = r.get("school.state") or ""
    ownership = r.get("school.ownership")
    highest_degree = r.get("school.degrees_awarded.highest")
    carnegie_basic = r.get("school.carnegie_basic")
    size = r.get("latest.student.size")

    t_in  = r.get("latest.cost.tuition.in_state")
    t_out = r.get("latest.cost.tuition.out_of_state")
    rb    = r.get("latest.cost.roomboard.oncampus")
    bk    = r.get("latest.cost.booksupply")
    avg_net = r.get("latest.cost.avg_net_price.overall")

    accept   = r.get("latest.admissions.admission_rate.overall")
    ret_4yr  = r.get("latest.student.retention_rate.four_year.full_time")
    ret_2yr  = r.get("latest.student.retention_rate.lt_four_year.full_time")
    grad_4yr = r.get("latest.completion.completion_rate_4yr_150nt")
    grad_2yr = r.get("latest.completion.completion_rate_less_than_4yr_150nt")
    earn_6yr = r.get("latest.earnings.6_yrs_after_entry.working_not_enrolled.mean_earnings")

    if t_in is None and t_out is None:
        return None

    t_in  = round(t_in  or t_out or 0)
    t_out = round(t_out or t_in  or 0)
    rb    = round(rb or 10500)
    bk    = round(bk or 1200)

    total_sticker = t_in + rb + bk
    avg_aid = max(0, round(total_sticker - avg_net)) if avg_net else 0

    retention = round(ret_4yr or ret_2yr or 0.72, 2)
    grad_rate = round(grad_4yr or grad_2yr or 0.50, 2)

    if earn_6yr:
        if   earn_6yr >= 60000: employ = 0.93
        elif earn_6yr >= 50000: employ = 0.90
        elif earn_6yr >= 40000: employ = 0.85
        elif earn_6yr >= 32000: employ = 0.79
        else:                   employ = 0.73
    else:
        employ = 0.82

    stype = classify_type(ownership, highest_degree, carnegie_basic, size)

    # Build offered-programs list from CIP percentages
    cip = {}
    for f in CIP_FIELDS:
        key = f.split("program_percentage.")[1]
        cip[key] = r.get(f) or 0

    has_cip = any(v > 0 for v in cip.values())
    if has_cip:
        offered = [pid for pid, keys in PROG_TO_CIP.items()
                   if any(cip.get(k, 0) > 0 for k in keys)]
    else:
        offered = None  # no CIP data — UI falls back to type-based filter

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
        "offered":    offered,
    }


def fetch_state(key, state):
    schools = []
    page = 0
    while True:
        data = fetch_page(key, state, page)
        if not data:
            break
        results = data.get("results", [])
        if not results:
            break
        for r in results:
            s = map_school(r)
            if s:
                schools.append(s)
        total   = data.get("metadata", {}).get("total", 0)
        fetched = min((page + 1) * 100, total)
        if fetched >= total:
            break
        page += 1
        time.sleep(0.1)  # gentle rate limiting
    return schools


def get_existing_ids(data_js_path):
    ids = set()
    try:
        with open(data_js_path, encoding="utf-8") as f:
            content = f.read()
        for m in re.finditer(r'id:"([^"]+)"', content):
            ids.add(m.group(1))
    except FileNotFoundError:
        pass
    return ids


def to_js_block(schools, state):
    lines = [f"  // ─── {state} ({len(schools)} schools) ───"]
    for s in schools:
        name_esc  = s["name"].replace('"', '\\"')
        short_esc = s["short"].replace('"', '\\"')
        city_esc  = s["city"].replace('"', '\\"')
        offered = s.get("offered")
        offered_js = ('["' + '","'.join(offered) + '"]') if offered else "null"
        lines.append(
            f'  {{ id:"{s["id"]}", name:"{name_esc}", short:"{short_esc}", '
            f'type:"{s["type"]}", city:"{city_esc}",\n'
            f'    tuition_in:{s["tuition_in"]}, tuition_out:{s["tuition_out"]}, '
            f'room_board:{s["room_board"]}, books:{s["books"]},\n'
            f'    avg_aid:{s["avg_aid"]}, accept:{s["accept"]}, '
            f'retention:{s["retention"]}, grad_rate:{s["grad_rate"]}, '
            f'employ_6mo:{s["employ_6mo"]}, offered:{offered_js} }},'
        )
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--key",    required=True)
    parser.add_argument("--states", default=None,  help="Comma-separated states (default: all)")
    parser.add_argument("--out",    default="all_schools.js")
    parser.add_argument("--json",   action="store_true")
    parser.add_argument("--no-skip", action="store_true", help="Don't skip IDs already in data.js")
    args = parser.parse_args()

    states = args.states.split(",") if args.states else ALL_STATES

    data_js = os.path.join(os.path.dirname(__file__), "data.js")
    existing_ids = set() if args.no_skip else get_existing_ids(data_js)
    print(f"Skipping {len(existing_ids)} existing IDs from data.js", file=sys.stderr)

    order = {"Public 4-yr": 0, "Private 4-yr": 1, "Liberal Arts": 2, "Public 2-yr": 3, "Trade": 4}

    all_new_schools = []
    seen_ids = set(existing_ids)
    total_skipped = 0

    for state in states:
        print(f"\nFetching {state}…", file=sys.stderr)
        schools = fetch_state(args.key, state)
        new_for_state = []
        for s in schools:
            if s["id"] in seen_ids:
                total_skipped += 1
            else:
                seen_ids.add(s["id"])
                new_for_state.append(s)
        new_for_state.sort(key=lambda s: (order.get(s["type"], 9), s["name"]))
        all_new_schools.extend(new_for_state)
        print(f"  {state}: {len(new_for_state)} new schools ({len(schools) - len(new_for_state)} skipped)", file=sys.stderr)

    print(f"\nTotal: {len(all_new_schools)} new schools, {total_skipped} duplicates skipped", file=sys.stderr)

    if args.json:
        output = json.dumps(all_new_schools, indent=2)
    else:
        # Group by state for readability
        from collections import defaultdict
        by_state = defaultdict(list)
        for s in all_new_schools:
            st = s["city"].split(", ")[-1] if ", " in s["city"] else "??"
            by_state[st].append(s)
        blocks = []
        for st in sorted(by_state.keys()):
            blocks.append(to_js_block(by_state[st], st))
        output = "\n".join(blocks)

    with open(args.out, "w", encoding="utf-8") as f:
        f.write(output)
    print(f"Written to {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
