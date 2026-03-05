"""
Export students.db + teacher data → JSON for the dashboard.
v4.0 — Aggressive sanitization + school separation.

    python tools/export_data.py
"""

import json
import sqlite3
import os
import re
from datetime import datetime

# ── Paths ─────────────────────────────────────────────
DB_PATH = "/home/anirudh/Downloads/AcadAlly User Info/dpshar and cygnus/students.db"
TEACHERS_PATH = "/home/anirudh/Projects/Project ACAD_info/acadally-scraper/output/cracked_teachers.txt"
EXPLORED_PATH = "/home/anirudh/Projects/Project ACAD_info/acadally-scraper/output/teacher_accounts_explored.json"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

# ── Fields to DROP (useless) ─────────────────────────
DROP_FIELDS = {"whatsapp_number", "profile_url", "dob", "age"}

# ── Dummy patterns ───────────────────────────────────
DUMMY_EMAIL_RE = re.compile(r"dummy", re.IGNORECASE)
DUMMY_PHONE_PREFIXES = ("59999",)


def sanitize_name(name):
    """Title-case a name. Handle '.' and empty gracefully."""
    if not name or not isinstance(name, str):
        return None
    name = name.strip()
    if name in (".", "..", "-", "_", ""):
        return name  # preserve as-is, handle in frontend
    # Title case: "ANIRUDH" -> "Anirudh", "john DOE" -> "John Doe"
    return " ".join(w.capitalize() for w in name.lower().split())


def sanitize_phone(phone):
    """Nullify dummy/invalid phone numbers."""
    if not phone or not isinstance(phone, str):
        return None
    phone = phone.strip()
    if not phone:
        return None
    # Remove common prefixes/spaces
    cleaned = re.sub(r"[\s\-\+]", "", phone)
    # Dummy prefix check
    for prefix in DUMMY_PHONE_PREFIXES:
        if cleaned.startswith(prefix):
            return None
    # Must be 10-13 digits (Indian mobile, with or without country code)
    digits_only = re.sub(r"\D", "", cleaned)
    if len(digits_only) < 10 or len(digits_only) > 13:
        return None
    return phone


def sanitize_email(email):
    """Nullify dummy emails."""
    if not email or not isinstance(email, str):
        return None
    email = email.strip()
    if not email:
        return None
    if DUMMY_EMAIL_RE.search(email):
        return None
    return email


def sanitize_gender(gender):
    """Normalize gender values."""
    if not gender or not isinstance(gender, str):
        return "not_set"
    g = gender.strip().lower()
    if g == "other":
        return "prefer_not_to_say"
    if g in ("male", "female", "prefer_not_to_say"):
        return g
    if not g:
        return "not_set"
    return g


def derive_display_name(student):
    """Build a display name, falling back to username parsing if names are '.'."""
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

    # Fallback: parse username
    username = student.get("username", "")
    # Strip school prefix
    for prefix in ("dpshar", "cygnus"):
        if username.startswith(prefix):
            remainder = username[len(prefix):]
            # Often format: prefixFirstLast or prefix.first.last
            # Try to extract something readable
            if remainder:
                # Remove leading numbers/dots
                cleaned = re.sub(r"^[\d._]+", "", remainder)
                if cleaned:
                    # Insert spaces before uppercase letters
                    spaced = re.sub(r"([a-z])([A-Z])", r"\1 \2", cleaned)
                    return " ".join(w.capitalize() for w in spaced.split())

    return username or "Unknown"


def export_students():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM students ORDER BY username").fetchall()
    students = []

    for row in rows:
        s = dict(row)

        # Drop useless fields
        for field in DROP_FIELDS:
            s.pop(field, None)

        # Sanitize names
        s["first_name"] = sanitize_name(s.get("first_name"))
        s["last_name"] = sanitize_name(s.get("last_name"))

        # Build display_name
        s["display_name"] = derive_display_name(s)

        # Sanitize contact info
        s["email"] = sanitize_email(s.get("email"))
        s["phone_number"] = sanitize_phone(s.get("phone_number"))

        # Sanitize gender
        s["gender"] = sanitize_gender(s.get("gender"))

        # Parse "Class 8-A" → class_num=8, section_letter="A"
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

        # School prefix
        u = s.get("username", "")
        s["school"] = (
            "dpshar" if u.startswith("dpshar") else
            "cygnus" if u.startswith("cygnus") else "unknown"
        )

        # Remove old field if present
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
                    username = parts[0]
                    school = (
                        "dpshar" if username.startswith("dpshar") else
                        "cygnus" if username.startswith("cygnus") else "unknown"
                    )
                    teachers.append({
                        "username": username,
                        "password": parts[1] if parts[1] != "password_not_found" else None,
                        "password_found": parts[1] != "password_not_found",
                        "name": sanitize_name(parts[2]) or parts[2],
                        "school": school,
                    })

    if os.path.exists(EXPLORED_PATH):
        with open(EXPLORED_PATH) as f:
            explored = json.load(f)
        for exp in explored:
            for t in teachers:
                if t["username"] == exp.get("username"):
                    t["profile"] = exp.get("profile", {})
                    t["classes"] = exp.get("classes", {})
                    break

    return teachers


def compute_meta(students, teachers):
    m = {
        "last_updated": datetime.now().isoformat(),
        "total_students": len(students),
    }

    # ── Per-school stats ──────────────────────────
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

        # Class counts
        cc = {}
        for s in ss:
            cn = s.get("class_num")
            if cn is not None:
                cc[str(cn)] = cc.get(str(cn), 0) + 1

        # Section counts
        sc = {}
        for s in ss:
            sn = (s.get("section_name") or "").replace("Class ", "")
            if sn:
                sc[sn] = sc.get(sn, 0) + 1

        # Gender
        gc = {}
        for s in ss:
            g = s.get("gender", "not_set")
            gc[g] = gc.get(g, 0) + 1

        # Contact
        with_phone = sum(1 for s in ss if s.get("phone_number"))
        with_email = sum(1 for s in ss if s.get("email"))

        # Gems / coins
        gems = [s.get("gems") or 0 for s in ss]
        coins = [s.get("coins") or 0 for s in ss]

        # Teachers for this school
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
            "zero_gems_count": sum(1 for g in gems if g == 0),
            "total_teachers_found": len(school_teachers),
            "total_teachers_cracked": sum(1 for t in school_teachers if t.get("password_found")),
            "total_teachers_locked": sum(1 for t in school_teachers if not t.get("password_found")),
        }

    # Global aggregates
    m["total_teachers_found"] = len(teachers)
    m["total_teachers_cracked"] = sum(1 for t in teachers if t.get("password_found"))
    m["total_teachers_in_list"] = 52

    gems_all = [s.get("gems") or 0 for s in students]
    m["gems_total"] = sum(gems_all)
    m["gems_avg"] = round(sum(gems_all) / len(gems_all), 1) if gems_all else 0
    m["gems_max"] = max(gems_all) if gems_all else 0
    m["zero_gems_count"] = sum(1 for g in gems_all if g == 0)
    m["students_with_phone"] = sum(1 for s in students if s.get("phone_number"))
    m["students_with_email"] = sum(1 for s in students if s.get("email"))

    return m


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("\n  ╭─────────────────────────────────────╮")
    print("  │  ACADALLY DATA EXPORT v4.0          │")
    print("  │  Sanitization + School Separation   │")
    print("  ╰─────────────────────────────────────╯\n")

    students = export_students()
    p = os.path.join(OUTPUT_DIR, "students.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(students, f, ensure_ascii=False)
    size_kb = os.path.getsize(p) / 1024
    print(f"  ✓ students.json  → {len(students):,} records  ({size_kb:.0f} KB)")

    # Sanitization report
    dot_names = sum(1 for s in students if s.get("first_name") in (".", "..", "-", "_"))
    nulled_emails = sum(1 for s in students if s.get("email") is None)
    nulled_phones = sum(1 for s in students if s.get("phone_number") is None)
    print(f"    ├─ Dot/placeholder names: {dot_names}")
    print(f"    ├─ Nullified emails (dummy): {nulled_emails}")
    print(f"    ├─ Nullified phones (dummy/invalid): {nulled_phones}")
    print(f"    └─ Fields dropped: {', '.join(sorted(DROP_FIELDS))}")

    teachers = export_teachers()
    p = os.path.join(OUTPUT_DIR, "teachers.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(teachers, f, indent=2, ensure_ascii=False)
    print(f"  ✓ teachers.json  → {len(teachers)} records")

    meta = compute_meta(students, teachers)
    p = os.path.join(OUTPUT_DIR, "meta.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print(f"  ✓ meta.json      → stats computed")

    print(f"\n  Total: {meta['total_students']:,} students across {len(meta['schools'])} schools")
    for school in meta["schools"]:
        code = school["code"]
        stats = meta["school_stats"].get(code, {})
        print(f"    {school['name']}")
        print(f"      Students: {school['count']:,}")
        print(f"      With phone: {stats.get('students_with_phone', 0)}")
        print(f"      With email: {stats.get('students_with_email', 0)}")
        print(f"      Teachers: {stats.get('total_teachers_found', 0)}")
    print()


if __name__ == "__main__":
    main()
