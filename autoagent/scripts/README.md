# AutoAgent Scripts

Utility scripts for the AutoAgent hybrid optimization workflow.

## extract_lessons.py

Reads `autoagent/results.tsv`, identifies winning experiments (status=keep with meaningful score improvements), and generates Lesson documents for human review and production translation.

### Usage

```bash
# Default: threshold 0.02, limit 5
python autoagent/scripts/extract_lessons.py

# Custom threshold and limit
python autoagent/scripts/extract_lessons.py --threshold 0.05 --limit 3
```

### Behavior

1. Reads `autoagent/results.tsv`
2. Filters rows where `status == "keep"` and score delta >= threshold
3. Skips commits that already have a lesson document (idempotent)
4. For each qualifying experiment, reads the git diff of agent files
5. Generates a populated `LESSON-NNN.md` from the template
6. Reports summary: generated count, skipped count, top 3 by delta

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--threshold` | 0.02 | Minimum score improvement to generate a lesson |
| `--limit` | 5 | Maximum lessons to generate per run |
