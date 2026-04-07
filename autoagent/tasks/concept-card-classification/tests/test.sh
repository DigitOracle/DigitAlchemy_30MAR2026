#!/bin/bash
# Harbor test entry point for concept-card-classification
# Runs the F1 score verifier and writes result to /logs/reward.txt

set -e

mkdir -p /logs

echo "Running concept-card-classification verifier..."
python /app/tests/test.py \
  --ground-truth /files/ground_truth.json \
  --predictions /logs/output.json \
  --output /logs/reward.txt

echo "Verifier complete. Score:"
cat /logs/reward.txt
