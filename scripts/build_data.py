#!/usr/bin/env python3
"""Fetch the etspring/pdd_russia dataset and build public/data/ for the app.

Usage: python3 scripts/build_data.py [--src PATH]

Without --src the dataset is cloned into .cache/pdd_russia (or updated with
git pull if the clone already exists). Output: public/data/questions.json and
public/data/img/*.jpg. See the "Данные" section of docs/SPEC.md.
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO_URL = "https://github.com/etspring/pdd_russia.git"
EXPECTED_COMMIT = "fa37933"

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / ".cache" / "pdd_russia"
OUT_DIR = ROOT / "public" / "data"

TICKETS = 40
QUESTIONS_PER_TICKET = 20
NO_IMAGE = "./images/no_image.jpg"
IMAGE_PREFIX = "./images/A_B/"
ENUM_MARK = "перечисл"

# Reconciliation targets from SPEC.md; a mismatch is a warning, not an error.
EXPECTED = {
    "records": 800,
    "unique ids": 794,
    "2 options": 18,
    "3 options": 651,
    "4 options": 123,
    "5 options": 2,
    "twin groups": 35,
    "twin questions": 109,
    "options with «перечисл»": 77,
    "images": 541,
}


class DataError(Exception):
    pass


# --- fetching -------------------------------------------------------------

def git(*args: str, cwd: Path | None = None) -> str:
    try:
        res = subprocess.run(
            ["git", *args], cwd=cwd, check=True, capture_output=True, text=True
        )
    except FileNotFoundError:
        sys.exit("error: git is not installed")
    except subprocess.CalledProcessError as e:
        sys.exit(f"error: git {' '.join(args)} failed:\n{e.stderr.strip()}")
    return res.stdout.strip()


def fetch() -> Path:
    if (CACHE_DIR / ".git").is_dir():
        print(f"Updating {CACHE_DIR.relative_to(ROOT)} ...")
        git("pull", "--ff-only", "--quiet", cwd=CACHE_DIR)
    else:
        print(f"Cloning {REPO_URL} into {CACHE_DIR.relative_to(ROOT)} ...")
        CACHE_DIR.parent.mkdir(parents=True, exist_ok=True)
        git("clone", "--depth", "1", "--quiet", REPO_URL, str(CACHE_DIR))
    return CACHE_DIR


def source_commit(src: Path) -> str:
    if (src / ".git").exists():
        return git("rev-parse", "HEAD", cwd=src)
    return "unknown"


# --- loading --------------------------------------------------------------

def number_in(s: str, field: str, where: str) -> int:
    m = re.fullmatch(r"\S+ (\d+)", s.strip())
    if not m:
        raise DataError(f"{where}: cannot parse number from {field} {s!r}")
    return int(m.group(1))


def load(src: Path) -> list[dict]:
    """Return raw records, each extended with 'ticket' and 'num'."""
    tickets_dir = src / "questions" / "A_B" / "tickets"
    records = []
    errors = []
    for t in range(1, TICKETS + 1):
        path = tickets_dir / f"Билет {t}.json"
        if not path.is_file():
            errors.append(f"missing file {path}")
            continue
        with path.open(encoding="utf-8") as f:
            items = json.load(f)
        if len(items) != QUESTIONS_PER_TICKET:
            errors.append(f"{path.name}: {len(items)} questions, expected {QUESTIONS_PER_TICKET}")
        for i, r in enumerate(items, 1):
            where = f"{path.name} #{i}"
            ticket = number_in(r["ticket_number"], "ticket_number", where)
            num = number_in(r["title"], "title", where)
            if ticket != t:
                errors.append(f"{where}: ticket_number {r['ticket_number']!r} does not match file")
            records.append({**r, "ticket": ticket, "num": num})
    if errors:
        raise DataError("\n".join(errors))
    return records


# --- validation -----------------------------------------------------------

def correct_index(r: dict) -> int:
    return [a["is_correct"] for a in r["answers"]].index(True)


def signature(r: dict) -> tuple:
    return (
        r["question"],
        tuple(a["answer_text"] for a in r["answers"]),
        correct_index(r),
        r["image"],
    )


def is_enum(option: str) -> bool:
    return ENUM_MARK in option.lower()


def validate(records: list[dict], images_dir: Path) -> None:
    """Hard checks; raise DataError listing every violation."""
    errors = []
    for r in records:
        where = f"ticket {r['ticket']} q{r['num']} ({r['id']})"
        n_correct = sum(1 for a in r["answers"] if a["is_correct"])
        if n_correct != 1:
            errors.append(f"{where}: {n_correct} correct answers, expected exactly 1")
            continue
        options = [a["answer_text"] for a in r["answers"]]
        for i, opt in enumerate(options[:-1]):
            if is_enum(opt):
                errors.append(f"{where}: option {i + 1} of {len(options)} contains «{ENUM_MARK}» but is not last")
        img = r["image"]
        if img != NO_IMAGE:
            if not img.startswith(IMAGE_PREFIX):
                errors.append(f"{where}: unexpected image path {img!r}")
            elif not (images_dir / img.removeprefix(IMAGE_PREFIX)).is_file():
                errors.append(f"{where}: image file {img!r} not found")

    if not errors:
        by_id = defaultdict(list)
        for r in records:
            by_id[r["id"]].append(r)
        for qid, group in by_id.items():
            if len({signature(r) for r in group}) > 1:
                refs = ", ".join(f"ticket {r['ticket']} q{r['num']}" for r in group)
                errors.append(f"id {qid}: duplicates differ in text/options/correct/image ({refs})")

    if errors:
        raise DataError(f"{len(errors)} problem(s):\n" + "\n".join(errors))


# --- building -------------------------------------------------------------

def image_name(img: str) -> str | None:
    return None if img == NO_IMAGE else img.removeprefix(IMAGE_PREFIX)


def build_questions(records: list[dict]) -> list[dict]:
    by_id: dict[str, dict] = {}
    for r in records:
        q = by_id.get(r["id"])
        if q is None:
            name = image_name(r["image"])
            q = by_id[r["id"]] = {
                "id": r["id"],
                "refs": [],
                "topics": list(r["topic"]),
                "text": r["question"],
                "img": f"img/{name}" if name else None,
                "options": [a["answer_text"] for a in r["answers"]],
                "correct": correct_index(r),
                "tip": r["answer_tip"],
                "twins": [],
            }
        q["refs"].append([r["ticket"], r["num"]])

    questions = list(by_id.values())
    for q in questions:
        q["refs"].sort()
    questions.sort(key=lambda q: q["refs"][0])

    # Twins: same text, different position of the correct answer.
    by_text = defaultdict(list)
    for q in questions:
        by_text[q["text"]].append(q)
    for group in by_text.values():
        for q in group:
            q["twins"] = [o["id"] for o in group if o["correct"] != q["correct"]]
    return questions


def twin_groups(questions: list[dict]) -> list[list[str]]:
    """Connected components of the twin relation."""
    by_id = {q["id"]: q for q in questions}
    seen = set()
    groups = []
    for q in questions:
        if not q["twins"] or q["id"] in seen:
            continue
        stack, group = [q["id"]], []
        seen.add(q["id"])
        while stack:
            cur = stack.pop()
            group.append(cur)
            for t in by_id[cur]["twins"]:
                if t not in seen:
                    seen.add(t)
                    stack.append(t)
        groups.append(group)
    return groups


def reconcile(records: list[dict], questions: list[dict]) -> dict:
    n_options = Counter(len(q["options"]) for q in questions)
    groups = twin_groups(questions)
    actual = {
        "records": len(records),
        "unique ids": len(questions),
        "twin groups": len(groups),
        "twin questions": sum(len(g) for g in groups),
        "options with «перечисл»": sum(is_enum(o) for q in questions for o in q["options"]),
        "images": len({q["img"] for q in questions if q["img"]}),
    }
    for n in sorted(set(n_options) | {2, 3, 4, 5}):
        actual[f"{n} options"] = n_options[n]
    return actual


# --- output ---------------------------------------------------------------

def write(questions: list[dict], commit: str, images_dir: Path) -> None:
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    img_out = OUT_DIR / "img"
    img_out.mkdir(parents=True)
    for name in sorted({q["img"].removeprefix("img/") for q in questions if q["img"]}):
        shutil.copy2(images_dir / name, img_out / name)
    with (OUT_DIR / "questions.json").open("w", encoding="utf-8") as f:
        json.dump(
            {"source": commit, "questions": questions},
            f,
            ensure_ascii=False,
            separators=(",", ":"),
        )


def dir_size(path: Path) -> int:
    return sum(p.stat().st_size for p in path.rglob("*") if p.is_file())


def report(actual: dict, commit: str) -> int:
    print(f"\nSource commit: {commit}")
    if not commit.startswith(EXPECTED_COMMIT):
        print(f"  note: SPEC.md describes snapshot {EXPECTED_COMMIT}")
    keys = list(EXPECTED) + [k for k in actual if k not in EXPECTED]
    width = max(len(k) for k in keys)
    print(f"\n{'check':<{width}}  expected  actual")
    mismatches = 0
    for k in keys:
        exp, got = EXPECTED.get(k, 0), actual.get(k, 0)
        mark = "" if exp == got else "  <-- MISMATCH"
        mismatches += exp != got
        print(f"{k:<{width}}  {exp:>8}  {got:>6}{mark}")
    for k in keys:
        exp, got = EXPECTED.get(k, 0), actual.get(k, 0)
        if exp != got:
            print(f"warning: {k}: expected {exp}, got {got}", file=sys.stderr)
    return mismatches


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--src", type=Path, help="use an existing dataset copy instead of git")
    args = parser.parse_args()

    src = args.src.resolve() if args.src else fetch()
    commit = source_commit(src)
    images_dir = src / "images" / "A_B"
    try:
        records = load(src)
        validate(records, images_dir)
    except DataError as e:
        sys.exit(f"error: dataset check failed: {e}")

    questions = build_questions(records)
    actual = reconcile(records, questions)
    write(questions, commit, images_dir)
    mismatches = report(actual, commit)

    qjson = OUT_DIR / "questions.json"
    print(f"\nWrote {qjson.relative_to(ROOT)} ({qjson.stat().st_size / 1024:.0f} KB), "
          f"{actual['images']} images ({dir_size(OUT_DIR / 'img') / 2**20:.1f} MB)")
    if mismatches:
        print(f"{mismatches} reconciliation warning(s), see above")


if __name__ == "__main__":
    main()
