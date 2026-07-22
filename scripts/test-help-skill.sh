#!/bin/bash
# Guard: validates the unikit-help navigator skill.
#
# unikit-help routes the user to other skills from a hand-maintained catalog in
# references/skill-map.md. The main risk is STALENESS: a skill added/removed under
# skills/ without updating the map would make the navigator point at a wrong or
# missing set. This guard locks the contract:
#
#   1. Structure   — SKILL.md + the four reference files exist, and SKILL.md wires
#                    every reference file via its {{skills_dir}}/{{self_name}} path.
#   2. Behaviour   — the no-args diagnostic + read-only stance are present.
#   3. Completeness— EVERY unikit skill on disk has a `### <name>` heading in
#                    skill-map.md, and the map references no phantom (non-existent)
#                    skill. This is the staleness guarantee.
#
# Frontmatter validity (name/description/length), the Language Awareness block,
# YAML-list tools, engine stop words, and the skill-group assignment are already
# covered by test-skills.sh Parts 1/7b/7c/11/15 — not duplicated here.
#
# Usage: ./scripts/test-help-skill.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Shared helpers: pass/fail counters + print_summary_and_exit + colors.
# shellcheck source=./test-fixtures.sh
source "$SCRIPT_DIR/test-fixtures.sh"

echo -e "${BOLD}=== unikit-help navigator guard ===${NC}"

HELP_DIR="$ROOT_DIR/skills/unikit-help"
SKILL_FILE="$HELP_DIR/SKILL.md"
REFS_DIR="$HELP_DIR/references"
SKILL_MAP="$REFS_DIR/skill-map.md"

REF_FILES=(skill-map.md pipelines.md scenarios.md knowledge-base.md)

# ── 1. Structure ─────────────────────────────────────────────────────────────
if [[ -f "$SKILL_FILE" ]]; then
    pass "skills/unikit-help/SKILL.md exists"
else
    fail "skills/unikit-help/SKILL.md missing"
    print_summary_and_exit "unikit-help navigator guard"
fi

for ref in "${REF_FILES[@]}"; do
    if [[ -f "$REFS_DIR/$ref" ]]; then
        pass "reference present: references/$ref"
    else
        fail "reference missing: references/$ref"
    fi
done

# SKILL.md must wire every reference file via the install-template path idiom so
# the loader paths survive install-time substitution.
for ref in "${REF_FILES[@]}"; do
    if grep -qF "{{skills_dir}}/{{self_name}}/references/$ref" "$SKILL_FILE"; then
        pass "SKILL.md wires references/$ref"
    else
        fail "SKILL.md does not reference {{skills_dir}}/{{self_name}}/references/$ref"
    fi
done

# ── 2. Behaviour ─────────────────────────────────────────────────────────────
# No-args must open with the short diagnostic, not a manual dump.
if grep -qiE 'diagnostic' "$SKILL_FILE"; then
    pass "SKILL.md describes the diagnostic (no-args) behaviour"
else
    fail "SKILL.md missing the diagnostic / no-args behaviour"
fi

if grep -qF 'AskUserQuestion' "$SKILL_FILE"; then
    pass "SKILL.md uses AskUserQuestion for the diagnostic"
else
    fail "SKILL.md does not use AskUserQuestion"
fi

# Read-only stance: the navigator must not carry write tools in allowed-tools.
FM="$(sed -n '/^---$/,/^---$/p' "$SKILL_FILE" | sed '1d;$d')"
ALLOWED_BLOCK="$(printf '%s\n' "$FM" | sed -n '/^allowed-tools:/,/^[a-zA-Z]/p')"
if printf '%s\n' "$ALLOWED_BLOCK" | grep -qE '^[[:space:]]*-[[:space:]]*(Write|Edit|Agent)\b'; then
    fail "unikit-help is read-only — allowed-tools must not include Write/Edit/Agent"
else
    pass "unikit-help allowed-tools is read-only (no Write/Edit/Agent)"
fi

# ── 3. Completeness (staleness guard) ────────────────────────────────────────
# Collect every unikit skill on disk (same filter as test-skills.sh Part 1).
DISK_SKILLS=()
for skill_dir in "$ROOT_DIR"/skills/*/; do
    name="$(basename "$skill_dir")"
    [[ "$name" != "unikit" && "$name" != unikit-* ]] && continue
    [[ -f "$skill_dir/SKILL.md" ]] || continue
    DISK_SKILLS+=("$name")
done

MISSING_FROM_MAP=()
for name in "${DISK_SKILLS[@]}"; do
    if ! grep -qE "^### ${name}\$" "$SKILL_MAP"; then
        MISSING_FROM_MAP+=("$name")
    fi
done

if [[ ${#MISSING_FROM_MAP[@]} -eq 0 ]]; then
    pass "every skill on disk has a '### <name>' heading in skill-map.md (${#DISK_SKILLS[@]} skills)"
else
    fail "skill-map.md is stale — missing headings for: ${MISSING_FROM_MAP[*]}"
fi

# Reverse: every '### <name>' heading in the map must resolve to a real skill dir.
PHANTOM=()
while IFS= read -r heading; do
    name="$(printf '%s' "$heading" | sed 's/^### //')"
    [[ -z "$name" ]] && continue
    if [[ ! -d "$ROOT_DIR/skills/$name" ]]; then
        PHANTOM+=("$name")
    fi
done < <(grep -E '^### unikit' "$SKILL_MAP" || true)

if [[ ${#PHANTOM[@]} -eq 0 ]]; then
    pass "skill-map.md references no phantom (non-existent) skills"
else
    fail "skill-map.md references skills that do not exist: ${PHANTOM[*]}"
fi

print_summary_and_exit "unikit-help navigator guard"
