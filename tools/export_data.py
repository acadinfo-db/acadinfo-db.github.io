"""
Export students.db + teacher data → JSON for the dashboard.
v4.4 — Supports CI path overrides via environment variables.

    # Local usage:
    python tools/export_data.py

    # CI usage (paths set via env vars):
    DB_PATH=/path/to/students.db python tools/export_data.py
"""

import json
import sqlite3
import os
import re
from datetime import datetime, timezone

# ── Paths (env vars override for CI) ──────────────────
DB_PATH = os.environ.get(
    "DB_PATH",
    "/home/anirudh/Downloads/AcadAlly User Info/dpshar and cygnus/students.db"
)
TEACHERS_PATH = os.environ.get(
    "TEACHERS_PATH",
    "/home/anirudh/Projects/Project ACAD_info/acadally-scraper/output/cracked_teachers.txt"
)
EXPLORED_PATH = os.environ.get(
    "EXPLORED_PATH",
    "/home/anirudh/Projects/Project ACAD_info/acadally-scraper/output/teacher_accounts_explored.json"
)
OUTPUT_DIR = os.environ.get(
    "OUTPUT_DIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
)

DROP_FIELDS = {"whatsapp_number", "profile_url", "dob", "age"}
DUMMY_EMAIL_RE = re.compile(r"dummy", re.IGNORECASE)
DUMMY_PHONE_PREFIXES = ("59999",)


def sanitize_name(name):
    if not name or not isinstance(name, str):
        return None
    name = name.strip()
    if name in (".", "..", "-", "_", ""):
        return name
    return " ".join(w.capitalize() for w in name.lower().split())


def sanitize_phone(phone):
    if not phone or not isinstance(phone, str):
        return None
    phone = phone.strip()
    if not phone:
        return None
    cleaned = re.sub(r"[\s\-\+]", "", phone)
    for prefix in DUMMY_PHONE_PREFIXES:
        if cleaned.startswith(prefix):
            return None
    digits_only = re.sub(r"\D", "", cleaned)
    if len(digits_only) < 10 or len(digits_only) > 13:
        return None
    return phone


def sanitize_email(email):
    if not email or not isinstance(email, str):
        return None
    email = email.strip()
    if not email:
        return None
    if DUMMY_EMAIL_RE.search(email):
        return None
    return email


def sanitize_gender(gender):
    if not gender or not isinstance(gender, str):
        return "not_set"
    g = gender.strip().lower()
    if g == "other":
        return "prefer_not_to_say"
    if g in ("male", "female", "prefer_not_to_say"):
        return g
    return "not_set" if not g else g


def derive_display_name(student):
    first = student.get("first_name")
    last = student.get("last_name")
    first_valid = first and first not in (".", "..", "-", "_")
    last_valid = last and last not in (".", "..", "-", "_")
    if first_valid and last_valid:
        return f"{first} {last}"
    if first_valid:
        return first
    if last_valid:
        return last
    username = student.get("username", "")
    for prefix in ("dpshar", "cygnus"):
        if username.startswith(prefix):
            remainder = username[len(prefix):]
            if remainder:
                cleaned = re.sub(r"^[\d._]+", "", remainder)
                if cleaned:
                    spaced = re.sub(r"([a-z])([A-Z])", r"\1 \2", cleaned)
                    return " ".join(w.capitalize() for w in spaced.split())
    return username or "Unknown"


def detect_teacher_school(teacher):
    profile = teacher.get("profile", {})
    if profile:
        school_code = profile.get("school_code", "")
        if school_code:
            if "dpshar" in school_code.lower():
                return "dpshar"
            if "cygnus" in school_code.lower():
                return "cygnus"
        school_name = profile.get("school_name", "")
        if school_name:
            sn = school_name.lower()
            if "dps" in sn or "harni" in sn or "delhi public" in sn:
                return "dpshar"
            if "cygnus" in sn:
                return "cygnus"
    password = teacher.get("password") or ""
    if password:
        pl = password.lower()
        if pl.startswith("dpshar"):
            return "dpshar"
        if pl.startswith("cygnus"):
            return "cygnus"
    return "unknown"


def export_students():
    if not os.path.exists(DB_PATH):
        print(f"  ✗ Database not found: {DB_PATH}")
        return []
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM students ORDER BY username").fetchall()
    students = []
    for row in rows:
        s = dict(row)
        for field in DROP_FIELDS:
            s.pop(field, None)
        s["first_name"] = sanitize_name(s.get("first_name"))
        s["last_name"] = sanitize_name(s.get("last_name"))
        s["display_name"] = derive_display_name(s)
        s["email"] = sanitize_email(s.get("email"))
        s["phone_number"] = sanitize_phone(s.get("phone_number"))
        s["gender"] = sanitize_gender(s.get("gender"))
        s["class_num"] = None
        s["section_letter"] = None
        sn = s.get("section_name") or ""
        if sn.startswith("Class "):
            parts = sn.replace("Class ", "").split("-")
            if len(parts) == 2:
                try:
                    s["class_num"] = int(parts[0])
                    s["section_letter"] = parts[1]
                except ValueError:
                    pass
        u = s.get("username", "")
        s["school"] = (
            "dpshar" if u.startswith("dpshar") else
            "cygnus" if u.startswith("cygnus") else "unknown"
        )
        s.pop("school_prefix", None)
        students.append(s)
    conn.close()
    return students


def export_teachers():
    teachers = []
    if os.path.exists(TEACHERS_PATH):
        with open(TEACHERS_PATH) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split(":", 2)
                if len(parts) >= 3:
                    teachers.append({
                        "username": parts[0],
                        "password": parts[1] if parts[1] != "password_not_found" else None,
                        "password_found": parts[1] != "password_not_found",
                        "name": sanitize_name(parts[2]) or parts[2],
                        "school": "unknown",
                    })
    else:
        print(f"  ⚠ Teachers file not found: {TEACHERS_PATH}")

    if os.path.exists(EXPLORED_PATH):
        with open(EXPLORED_PATH) as f:
            explored = json.load(f)
        for exp in explored:
            for t in teachers:
                if t["username"] == exp.get("username"):
                    t["profile"] = exp.get("profile", {})
                    t["classes"] = exp.get("classes", {})
                    break
    else:
        print(f"  ⚠ Explored file not found: {EXPLORED_PATH}")

    for t in teachers:
        t["school"] = detect_teacher_school(t)
        if "mahesh" in t["username"].lower() or "mahesh" in t["name"].lower():
            t["school"] = "dpshar"
            if "profile" not in t:
                t["profile"] = {}
            if "school_name" not in t["profile"]:
                t["profile"]["school_name"] = "DPS Harni"

    known_schools = set(t["school"] for t in teachers if t["school"] != "unknown")
    unknowns = [t for t in teachers if t["school"] == "unknown"]
    if len(known_schools) == 1 and unknowns:
        target = known_schools.pop()
        for t in unknowns:
            t["school"] = target
    return teachers


def compute_meta(students, teachers):
    m = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "total_students": len(students),
    }

    schools_map = {}
    for s in students:
        code = s["school"]
        if code not in schools_map:
            schools_map[code] = {
                "name": s.get("school_name", code),
                "code": code,
                "count": 0,
                "students": [],
            }
        schools_map[code]["count"] += 1
        schools_map[code]["students"].append(s)

    m["schools"] = []
    m["school_stats"] = {}

    for code, info in schools_map.items():
        m["schools"].append({
            "name": info["name"],
            "code": code,
            "count": info["count"],
        })

        ss = info["students"]
        cc, sc, gc = {}, {}, {}

        for s in ss:
            cn = s.get("class_num")
            if cn is not None:
                cc[str(cn)] = cc.get(str(cn), 0) + 1
            sn = (s.get("section_name") or "").replace("Class ", "")
            if sn:
                sc[sn] = sc.get(sn, 0) + 1
            g = s.get("gender", "not_set")
            gc[g] = gc.get(g, 0) + 1

        with_phone = sum(1 for s in ss if s.get("phone_number"))
        with_email = sum(1 for s in ss if s.get("email"))
        gems = [s.get("gems") or 0 for s in ss]
        coins = [s.get("coins") or 0 for s in ss]
        school_teachers = [t for t in teachers if t.get("school") == code]

        m["school_stats"][code] = {
            "total_students": len(ss),
            "class_counts": dict(sorted(cc.items())),
            "section_counts": dict(sorted(sc.items())),
            "gender_counts": gc,
            "students_with_phone": with_phone,
            "students_with_email": with_email,
            "gems_total": sum(gems),
            "gems_avg": round(sum(gems) / len(gems), 1) if gems else 0,
            "gems_max": max(gems) if gems else 0,
            "coins_total": sum(coins),
            "coins_avg": round(sum(coins) / len(coins), 1) if coins else 0,
            "coins_max": max(coins) if coins else 0,
            "zero_gems_count": sum(1 for g in gems if g == 0),
            "total_teachers_found": len(school_teachers),
            "total_teachers_cracked": sum(1 for t in school_teachers if t.get("password_found")),
            "total_teachers_locked": sum(1 for t in school_teachers if not t.get("password_found")),
        }

    m["total_teachers_found"] = len(teachers)
    m["total_teachers_cracked"] = sum(1 for t in teachers if t.get("password_found"))
    m["total_teachers_in_list"] = 52

    gems_all = [s.get("gems") or 0 for s in students]
    coins_all = [s.get("coins") or 0 for s in students]
    m["gems_total"] = sum(gems_all)
    m["gems_avg"] = round(sum(gems_all) / len(gems_all), 1) if gems_all else 0
    m["gems_max"] = max(gems_all) if gems_all else 0
    m["coins_total"] = sum(coins_all)
    m["coins_avg"] = round(sum(coins_all) / len(coins_all), 1) if coins_all else 0
    m["coins_max"] = max(coins_all) if coins_all else 0
    m["zero_gems_count"] = sum(1 for g in gems_all if g == 0)
    m["students_with_phone"] = sum(1 for s in students if s.get("phone_number"))
    m["students_with_email"] = sum(1 for s in students if s.get("email"))

    total_sections = 0
    for code in m["school_stats"]:
        total_sections += len(m["school_stats"][code].get("section_counts", {}))
    m["total_sections"] = total_sections

    return m


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("\n  ╭─────────────────────────────────────╮")
    print("  │  acad_INFO DATA EXPORT v4.4         │")
    print("  ╰─────────────────────────────────────╯\n")
    print(f"  DB:       {DB_PATH}")
    print(f"  Teachers: {TEACHERS_PATH}")
    print(f"  Explored: {EXPLORED_PATH}")
    print(f"  Output:   {OUTPUT_DIR}\n")

    students = export_students()
    if not students:
        print("  ✗ No students exported. Check DB_PATH.")
        return

    p = os.path.join(OUTPUT_DIR, "students.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(students, f, ensure_ascii=False)
    size_kb = os.path.getsize(p) / 1024
    print(f"  ✓ students.json  → {len(students):,} records  ({size_kb:.0f} KB)")

    dot_names = sum(1 for s in students if s.get("first_name") in (".", "..", "-", "_"))
    nulled_emails = sum(1 for s in students if s.get("email") is None)
    nulled_phones = sum(1 for s in students if s.get("phone_number") is None)
    print(f"    ├─ Dot/placeholder names: {dot_names}")
    print(f"    ├─ Nullified emails: {nulled_emails}")
    print(f"    ├─ Nullified phones: {nulled_phones}")
    print(f"    └─ Dropped fields: {', '.join(sorted(DROP_FIELDS))}")

    teachers = export_teachers()
    p = os.path.join(OUTPUT_DIR, "teachers.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(teachers, f, indent=2, ensure_ascii=False)
    print(f"  ✓ teachers.json  → {len(teachers)} records")
    for t in teachers:
        marker = "✓" if t["password_found"] else "✗"
        print(f"    {marker} {t['name']} → {t['school']}")

    meta = compute_meta(students, teachers)
    p = os.path.join(OUTPUT_DIR, "meta.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print(f"  ✓ meta.json      → computed\n")

    for school in meta["schools"]:
        code = school["code"]
        stats = meta["school_stats"][code]
        print(f"  {school['name']}")
        print(f"    Students: {school['count']:,}  Teachers: {stats['total_teachers_found']}")
        print(f"    Sections: {len(stats['section_counts'])}")
    print(f"\n  Total sections: {meta['total_sections']}\n")


if __name__ == "__main__":
    main()
