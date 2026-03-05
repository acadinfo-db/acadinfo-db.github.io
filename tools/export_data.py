"""
Export students.db + teacher data → JSON for the dashboard.

    python tools/export_data.py
"""

import json
import sqlite3
import os
from datetime import datetime, date

# ── Paths ─────────────────────────────────────────────
DB_PATH = "/home/anirudh/Downloads/AcadAlly User Info/dpshar and cygnus/students.db"
TEACHERS_PATH = "/home/anirudh/Projects/Project ACAD_info/acadally-scraper/output/cracked_teachers.txt"
EXPLORED_PATH = "/home/anirudh/Projects/Project ACAD_info/acadally-scraper/output/teacher_accounts_explored.json"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


def export_students():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM students ORDER BY username").fetchall()
    students = []

    for row in rows:
        s = dict(row)

        # Age
        s["age"] = None
        if s.get("dob"):
            try:
                born = datetime.strptime(s["dob"], "%Y-%m-%d").date()
                today = date.today()
                s["age"] = today.year - born.year - (
                    (today.month, today.day) < (born.month, born.day)
                )
            except (ValueError, TypeError):
                pass

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
        s["school_prefix"] = (
            "dpshar" if u.startswith("dpshar") else
            "cygnus" if u.startswith("cygnus") else "unknown"
        )

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
                        "name": parts[2],
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
    m = {"last_updated": datetime.now().isoformat(), "total_students": len(students)}

    # Schools
    schools = {}
    for s in students:
        p = s["school_prefix"]
        if p not in schools:
            schools[p] = {"name": s.get("school_name", p), "code": p, "count": 0}
        schools[p]["count"] += 1
    m["schools"] = list(schools.values())

    # Classes / sections
    cc, sc = {}, {}
    for s in students:
        cn = s.get("class_num")
        sn = (s.get("section_name") or "").replace("Class ", "")
        if cn is not None:
            cc[str(cn)] = cc.get(str(cn), 0) + 1
        if sn:
            sc[sn] = sc.get(sn, 0) + 1
    m["class_counts"] = dict(sorted(cc.items()))
    m["section_counts"] = dict(sorted(sc.items()))

    # Gender
    gc = {}
    for s in students:
        g = (s.get("gender") or "").strip().lower() or "not_set"
        gc[g] = gc.get(g, 0) + 1
    m["gender_counts"] = gc

    # Age
    ages = [s["age"] for s in students if s.get("age") is not None]
    m["students_with_dob"] = len(ages)
    if ages:
        m["age_min"] = min(ages)
        m["age_max"] = max(ages)
        m["age_avg"] = round(sum(ages) / len(ages), 1)

    # Contact
    m["students_with_phone"] = sum(1 for s in students if (s.get("phone_number") or "").strip())
    m["students_with_email"] = sum(1 for s in students if (s.get("email") or "").strip())

    # Gems / coins
    gems = [s.get("gems") or 0 for s in students]
    coins = [s.get("coins") or 0 for s in students]
    m["gems_total"] = sum(gems)
    m["gems_avg"] = round(sum(gems) / len(gems), 1) if gems else 0
    m["gems_max"] = max(gems) if gems else 0
    m["coins_total"] = sum(coins)
    m["coins_avg"] = round(sum(coins) / len(coins), 1) if coins else 0
    m["zero_gems_count"] = sum(1 for g in gems if g == 0)

    # Teachers
    m["total_teachers_found"] = len(teachers)
    m["total_teachers_cracked"] = sum(1 for t in teachers if t.get("password_found"))
    m["total_teachers_locked"] = sum(1 for t in teachers if not t.get("password_found"))
    m["total_teachers_in_list"] = 52

    return m


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("\n  Exporting data for dashboard...\n")

    students = export_students()
    p = os.path.join(OUTPUT_DIR, "students.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(students, f, ensure_ascii=False)
    print(f"  students.json  → {len(students):,} records  ({os.path.getsize(p) / 1024:.0f} KB)")

    teachers = export_teachers()
    p = os.path.join(OUTPUT_DIR, "teachers.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(teachers, f, indent=2, ensure_ascii=False)
    print(f"  teachers.json  → {len(teachers)} records")

    meta = compute_meta(students, teachers)
    p = os.path.join(OUTPUT_DIR, "meta.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print(f"  meta.json      → stats computed")

    print(f"\n  Total: {meta['total_students']:,} students across {len(meta['schools'])} schools")
    for school in meta["schools"]:
        print(f"    {school['name']}: {school['count']:,}")
    print()


if __name__ == "__main__":
    main()
