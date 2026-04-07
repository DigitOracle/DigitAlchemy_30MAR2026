"""
Concept Card Classification Verifier
Computes macro-averaged F1 score and writes to /logs/reward.txt
"""

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

VALID_CATEGORIES = [
    "TREND_ALERT",
    "BRAND_SIGNAL",
    "CULTURAL_MOMENT",
    "CREATOR_SPOTLIGHT",
    "AUDIO_VIRAL",
    "REGIONAL_PULSE",
    "TECH_INNOVATION",
]

PASS_THRESHOLD = 0.85


def compute_f1(ground_truth: list[dict], predictions: list[dict]) -> float:
    """Compute macro-averaged F1 score across all categories."""
    # Build lookup from predictions
    pred_map = {p["id"]: p["predicted_category"] for p in predictions}

    # Per-category counts
    tp = defaultdict(int)
    fp = defaultdict(int)
    fn = defaultdict(int)

    for gt in ground_truth:
        true_label = gt["category"]
        pred_label = pred_map.get(gt["id"])

        if pred_label is None:
            # Missing prediction counts as false negative
            fn[true_label] += 1
            continue

        if pred_label not in VALID_CATEGORIES:
            # Invalid category counts as false negative for true + false positive for invalid
            fn[true_label] += 1
            continue

        if pred_label == true_label:
            tp[true_label] += 1
        else:
            fp[pred_label] += 1
            fn[true_label] += 1

    # Macro-averaged F1
    f1_scores = []
    for cat in VALID_CATEGORIES:
        precision = tp[cat] / (tp[cat] + fp[cat]) if (tp[cat] + fp[cat]) > 0 else 0.0
        recall = tp[cat] / (tp[cat] + fn[cat]) if (tp[cat] + fn[cat]) > 0 else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
        f1_scores.append(f1)

    # Only average over categories that appear in ground truth
    active_categories = [cat for cat in VALID_CATEGORIES if any(g["category"] == cat for g in ground_truth)]
    active_f1 = [f1_scores[VALID_CATEGORIES.index(cat)] for cat in active_categories]

    return sum(active_f1) / len(active_f1) if active_f1 else 0.0


def main():
    parser = argparse.ArgumentParser(description="Concept card classification verifier")
    parser.add_argument("--ground-truth", required=True, help="Path to ground_truth.json")
    parser.add_argument("--predictions", required=True, help="Path to output.json with predictions")
    parser.add_argument("--output", required=True, help="Path to write reward score")
    args = parser.parse_args()

    gt_path = Path(args.ground_truth)
    pred_path = Path(args.predictions)
    output_path = Path(args.output)

    if not gt_path.exists():
        print(f"ERROR: Ground truth not found at {gt_path}", file=sys.stderr)
        output_path.write_text("0.0")
        sys.exit(1)

    if not pred_path.exists():
        print(f"ERROR: Predictions not found at {pred_path}", file=sys.stderr)
        output_path.write_text("0.0")
        sys.exit(1)

    ground_truth = json.loads(gt_path.read_text(encoding="utf-8"))
    predictions = json.loads(pred_path.read_text(encoding="utf-8"))

    score = compute_f1(ground_truth, predictions)

    print(f"F1 Score: {score:.4f}")
    print(f"Pass threshold: {PASS_THRESHOLD}")
    print(f"Result: {'PASS' if score >= PASS_THRESHOLD else 'FAIL'}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(f"{score:.4f}")


if __name__ == "__main__":
    main()
