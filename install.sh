#!/usr/bin/env bash
set -euo pipefail

SKILLS_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-}"

if [[ -z "$TARGET" ]]; then
  echo "Usage: ./install.sh /path/to/target-project"
  exit 1
fi

if [[ ! -d "$TARGET" ]]; then
  echo "Error: target directory does not exist: $TARGET"
  exit 1
fi

echo "Installing easydeploy skills into: $TARGET"

# ── Copy each skill ────────────────────────────────────────────────────────────
SKILLS_SRC="$SKILLS_DIR/.claude/skills"
SKILLS_DST="$TARGET/.claude/skills"
mkdir -p "$SKILLS_DST"

for skill_dir in "$SKILLS_SRC"/*/; do
  skill_name="$(basename "$skill_dir")"
  echo "  → Copying skill: $skill_name"
  rm -rf "$SKILLS_DST/$skill_name"
  cp -r "$skill_dir" "$SKILLS_DST/$skill_name"
done

# ── Merge permissions ──────────────────────────────────────────────────────────
SRC_SETTINGS="$SKILLS_DIR/.claude/settings.json"
DST_SETTINGS="$TARGET/.claude/settings.json"

mkdir -p "$TARGET/.claude"
node "$SKILLS_DIR/merge-settings.js" "$SRC_SETTINGS" "$DST_SETTINGS"

echo ""
echo "Done. Skills installed:"
for skill_dir in "$SKILLS_SRC"/*/; do
  echo "  /$(basename "$skill_dir")"
done
echo ""
echo "Open a Claude Code session in $TARGET and type /docker-setup to get started."
