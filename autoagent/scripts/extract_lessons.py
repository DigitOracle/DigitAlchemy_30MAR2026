#!/usr/bin/env python3
"""
Lesson Extractor — AutoAgent Hybrid Architecture
Reads results.tsv, identifies winning experiments, and generates
Lesson documents for human review and TypeScript translation.

Usage:
    python autoagent/scripts/extract_lessons.py
    python autoagent/scripts/extract_lessons.py --threshold 0.05 --limit 3
"""

import argparse
import csv
import json
import subprocess
import sys
from pathlib import Path

AUTOAGENT_DIR = Path(__file__).resolve().parent.parent
RESULTS_FILE = AUTOAGENT_DIR / "results.tsv"
LESSONS_DIR = AUTOAGENT_DIR / "lessons"
TEMPLATE_FILE = LESSONS_DIR / "LESSON_TEMPLATE.md"


def parse_args():
    parser = argparse.ArgumentParser(description="Extract lessons from winning experiments")
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.02,
        help="Minimum score delta to generate a lesson (default: 0.02)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Maximum number of lessons to generate per run (default: 5)",
    )
    return parser.parse_args()


def read_results() -> list[dict]:
    """Read results.tsv and return list of row dicts."""
    if not RESULTS_FILE.exists():
        print("No results.tsv found. Nothing to extract.")
        return []

    rows = []
    with open(RESULTS_FILE, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            rows.append(row)
    return rows


def find_winning_experiments(rows: list[dict], threshold: float) -> list[dict]:
    """Filter for keep experiments with meaningful score deltas."""
    if len(rows) < 2:
        print(f"Only {len(rows)} row(s) in results.tsv. Need at least 2 to compute deltas.")
        return []

    winners = []
    baseline_score = None

    for row in rows:
        score = float(row.get("weighted_score", 0))
        status = row.get("status", "").strip()

        if baseline_score is None:
            baseline_score = score
            continue

        if status != "keep":
            continue

        delta = score - baseline_score
        if delta >= threshold:
            row["_delta"] = delta
            row["_baseline"] = baseline_score
            winners.append(row)

    # Sort by delta descending
    winners.sort(key=lambda r: r["_delta"], reverse=True)
    return winners


def get_existing_lesson_ids() -> set[str]:
    """Return set of existing lesson commit hashes to avoid duplicates."""
    existing = set()
    for f in LESSONS_DIR.glob("LESSON-*.md"):
        if f.name == "LESSON_TEMPLATE.md":
            continue
        content = f.read_text(encoding="utf-8")
        for line in content.splitlines():
            if "Source Experiment Commit" in line and "`" in line:
                # Extract commit hash between backticks
                parts = line.split("`")
                if len(parts) >= 2:
                    existing.add(parts[1].strip())
    return existing


def get_git_diff(commit: str) -> str:
    """Get the git diff for a commit vs its parent."""
    try:
        result = subprocess.run(
            ["git", "diff", f"{commit}^", commit, "--", "autoagent/agents/"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.stdout if result.returncode == 0 else "(diff unavailable)"
    except Exception as e:
        return f"(diff error: {e})"


def read_template() -> str:
    """Read the lesson template."""
    if not TEMPLATE_FILE.exists():
        print(f"WARNING: Template not found at {TEMPLATE_FILE}")
        return ""
    return TEMPLATE_FILE.read_text(encoding="utf-8")


def next_lesson_number() -> int:
    """Find the next available lesson number."""
    existing = [
        f.stem for f in LESSONS_DIR.glob("LESSON-*.md")
        if f.name != "LESSON_TEMPLATE.md"
    ]
    numbers = []
    for name in existing:
        # Handle LESSON-001, LESSON-001-example, etc.
        parts = name.replace("LESSON-", "").split("-")
        try:
            numbers.append(int(parts[0]))
        except ValueError:
            continue
    return max(numbers, default=0) + 1


def generate_lesson(row: dict, lesson_num: int, template: str) -> str:
    """Generate a populated lesson document from a winning experiment."""
    commit = row.get("commit", "unknown").strip()
    score = row.get("weighted_score", "0")
    baseline = row.get("_baseline", 0)
    delta = row.get("_delta", 0)
    description = row.get("description", "").strip()
    task_scores = row.get("task_scores", "{}")

    diff = get_git_diff(commit)

    num_str = f"{lesson_num:03d}"

    lesson = template
    lesson = lesson.replace("{NNN}", num_str)
    lesson = lesson.replace("{Short title describing the optimization}", description)
    lesson = lesson.replace("{YYYY-MM-DD}", "2026-04-07")
    lesson = lesson.replace("{short git hash}", commit)

    # Replace score placeholders
    lines = lesson.splitlines()
    new_lines = []
    for line in lines:
        if "**Baseline Score**" in line:
            line = f"| **Baseline Score** | {baseline:.4f} |"
        elif "**Improved Score**" in line:
            line = f"| **Improved Score** | {float(score):.4f} |"
        elif "**Delta**" in line:
            line = f"| **Delta** | +{delta:.4f} |"
        elif "**Approval Status**" in line:
            line = "| **Approval Status** | DRAFT |"
        new_lines.append(line)
    lesson = "\n".join(new_lines)

    # Append the diff as context
    lesson += f"\n\n---\n\n## Git Diff (auto-extracted)\n\n```diff\n{diff}\n```\n"
    lesson += f"\n## Task Scores\n\n```json\n{task_scores}\n```\n"

    return lesson


def main():
    args = parse_args()

    print(f"Lesson Extractor — threshold: {args.threshold}, limit: {args.limit}")
    print(f"Reading: {RESULTS_FILE}")

    rows = read_results()
    if not rows:
        return

    print(f"Found {len(rows)} result row(s)")

    winners = find_winning_experiments(rows, args.threshold)
    print(f"Found {len(winners)} winning experiment(s) above threshold {args.threshold}")

    if not winners:
        print("No lessons to generate.")
        return

    existing_commits = get_existing_lesson_ids()
    template = read_template()
    if not template:
        print("ERROR: Cannot generate lessons without template.")
        sys.exit(1)

    generated = 0
    skipped = 0

    for row in winners[:args.limit]:
        commit = row.get("commit", "").strip()

        if commit in existing_commits:
            print(f"  SKIP: Lesson for commit {commit} already exists")
            skipped += 1
            continue

        lesson_num = next_lesson_number() + generated
        lesson_content = generate_lesson(row, lesson_num, template)
        lesson_path = LESSONS_DIR / f"LESSON-{lesson_num:03d}.md"
        lesson_path.write_text(lesson_content, encoding="utf-8")
        print(f"  GENERATED: {lesson_path.name} (commit: {commit}, delta: +{row['_delta']:.4f})")
        generated += 1

    print(f"\nSummary: {generated} generated, {skipped} already exist")

    if winners:
        print("\nTop 3 by delta:")
        for i, w in enumerate(winners[:3], 1):
            print(f"  {i}. commit={w['commit']} delta=+{w['_delta']:.4f} — {w.get('description', '')}")


if __name__ == "__main__":
    main()
