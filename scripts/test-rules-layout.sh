#!/bin/bash
# Test suite: skills/unikit-rules/scripts/rules-layout.mjs — the mechanical half of
# `/unikit-rules optimise`. Runs the real script with node over the fixture projects in
# scripts/test-fixtures/rules-layout/ (legacy / flat / topics / empty) and proves what it exists
# for: every rule survives a reorganization word for word, and nothing is written when the plan
# is wrong or stale. The CRLF case is built at run time — .gitattributes forces LF on checkout.
# Usage: ./scripts/test-rules-layout.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LAYOUT="$ROOT_DIR/skills/unikit-rules/scripts/rules-layout.mjs"
RULES_SKILL="$ROOT_DIR/skills/unikit-rules/SKILL.md"
FIXTURES="$SCRIPT_DIR/test-fixtures/rules-layout"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'
PASSED=0
FAILED=0
TOTAL=0
pass() { PASSED=$((PASSED + 1)); TOTAL=$((TOTAL + 1)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { FAILED=$((FAILED + 1)); TOTAL=$((TOTAL + 1)); echo -e "  ${RED}✗${NC} $1"; }
check() { if eval "$2"; then pass "$1"; else fail "$1${3:+ — $3}"; fi; }

# setup <fixture> → a fresh copy of the fixture project; prints its path
SETUP_N=0
setup() { SETUP_N=$((SETUP_N + 1)); local d="$TMP_ROOT/$1-$SETUP_N"; mkdir -p "$d"; cp -r "$FIXTURES/$1/." "$d/"; echo "$d"; }
# run <args...> → LAST_OUT / LAST_CODE, never aborts the suite
run() { LAST_CODE=0; LAST_OUT="$(node "$LAYOUT" "$@" 2>&1)" || LAST_CODE=$?; }
# field <project> <js expression over `inv`> → value from `parse --json`
field() { node "$LAYOUT" parse --json --root "$1" | node -e "const inv = JSON.parse(require('fs').readFileSync(0, 'utf8')); console.log($2)"; }
tree_sha() { (cd "$1" && find .unikit -type f | sort | xargs sha256sum | sha256sum | cut -c1-16); }
# plan <project> <json with @FP@> → writes the plan with the project's current fingerprint
plan() { local fp; fp="$(field "$1" inv.fingerprint)"; printf '%s' "${2//@FP@/$fp}" > "$1/.unikit/rules-layout.plan.json"; }
# lost <before .unikit dir> <after .unikit dir> → how many source text lines are missing after.
# Markers, headings, separators, table delimiters and UniKit's own header template lines are
# layout, not content; everything else must survive at least as often as it was there.
lost() {
    node -e '
const fs = require("fs"), path = require("path");
const layout = /^(#|-{3,}$|\|[-|: ]+\|$|\|\s*Topic\s*\||\|\s*\[[^\]]*\]\(rules\/|Project-specific rules that override|One rule per line|For base code style)/;
const norm = (t) => t.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter((l) => l && !layout.test(l))
  .map((l) => l.replace(/^([-*+]|\d{1,3}[.)])\s+/, ""));
const read = (dir) => { let all = []; const walk = (p) => { for (const f of fs.readdirSync(p)) { const q = path.join(p, f);
  if (fs.statSync(q).isDirectory()) walk(q); else if (f.endsWith(".md")) all = all.concat(norm(fs.readFileSync(q, "utf8"))); } }; walk(dir); return all; };
const after = new Map(); for (const l of read(process.argv[2])) after.set(l, (after.get(l) || 0) + 1);
let lost = 0; for (const l of read(process.argv[1])) { const c = after.get(l) || 0; if (c > 0) after.set(l, c - 1); else lost++; }
console.log(lost);' "$1" "$2"
}
# The header paragraph SKILL.md defines — the script must write exactly these two lines.
SKILL_HEADER="$(awk '/The header paragraph is the same in both shapes/{f=1; next} f && /^```markdown/{g=1; next} g && /^```/{exit} g{print}' "$RULES_SKILL")"

echo -e "${BOLD}=== rules-layout.mjs Tests ===${NC}"

echo -e "\n${BOLD}Part 1: parse${NC}"
check "the script exists" '[[ -s "$LAYOUT" ]]'
check "SKILL.md header paragraph found (2 lines)" '[[ "$(printf "%s\n" "$SKILL_HEADER" | wc -l)" -eq 2 ]]'
while IFS= read -r header_line; do
    check "script HEADER carries SKILL.md line: ${header_line:0:50}…" 'grep -qF -- "$header_line" "$LAYOUT"'
done <<< "$SKILL_HEADER"
run --help
check "--help exits 0" '[[ $LAST_CODE -eq 0 ]]'
run bogus
check "an unknown command exits 1" '[[ $LAST_CODE -eq 1 ]]'
P="$(setup legacy)"
check "legacy: state legacy" '[[ "$(field "$P" inv.state)" == legacy ]]'
check "legacy: 9 rules (- * + 1. 2) markers, a fenced example, numbered steps, a blank-line continuation)" \
    '[[ "$(field "$P" "inv.items.filter((i) => i.kind === \"rule\").length")" -eq 9 ]]'
check "legacy: 2 blocks (a prose paragraph, a table) — unknown shapes surface, never vanish" \
    '[[ "$(field "$P" "inv.items.filter((i) => i.kind === \"block\").map((i) => i.id).join()")" == "B1,B2" ]]'
check "legacy: the fenced example and the numbered steps stay inside their rules" \
    '[[ "$(field "$P" "inv.items.filter((i) => i.id === \"R7\" || i.id === \"R8\").map((i) => i.to - i.from + 1).join()")" == "6,3" ]]'
check "legacy: the old template header is recognised" '[[ "$(field "$P" "inv.header.split(\"\\n\").length")" -eq 2 ]]'
H="$(setup legacy)"
sed -i '4a Our team keeps these short.' "$H/.unikit/RULES.md"
check "a line the user added to the header becomes a block, not a dropped header line" \
    '[[ "$(field "$H" "inv.items.filter((i) => i.kind === \"block\").length")" -eq 3 ]]'
T="$(setup topics)"
run parse --root "$T"
check "topics: state topics" '[[ "$(field "$T" inv.state)" == topics ]]'
check "topics: a listed file that is missing is warned about" 'grep -qF "WARN [rules] topic file missing: .unikit/rules/net.md" <<< "$LAST_OUT"'
check "topics: an unlisted file is warned about and left out" 'grep -qF ".unikit/rules/old.md is not listed under ## Topics" <<< "$LAST_OUT" && [[ "$(field "$T" "inv.items.length")" -eq 5 ]]'
E="$(setup empty)"
check "empty: state empty" '[[ "$(field "$E" inv.state)" == empty ]]'

echo -e "\n${BOLD}Part 2: apply — a legacy file into topics${NC}"
P="$(setup legacy)"
LEGACY_PLAN='{"version":1,"fingerprint":"@FP@","topics":[{"slug":"ui","title":"UI views","loadWhen":"UI screens, views, navigator"},{"slug":"save-system","title":"Save system","loadWhen":"saving and loading, save data, migrations"}],"assign":{"common":["R1","R2"],"ui":["R3-R6","B1"],"save-system":["R7-R9"]},"attach":["B2"]}'
plan "$P" "$LEGACY_PLAN"
BEFORE="$(tree_sha "$P")"
run apply --dry-run --root "$P"
check "dry-run exits 0 and prints the preview" '[[ $LAST_CODE -eq 0 ]] && grep -qF "## Proposed layout — 2 topics, 2 common rules, 10 rules" <<< "$LAST_OUT"'
check "dry-run names the promoted block and the attached one" 'grep -qF "Blocks turned into rule items" <<< "$LAST_OUT" && grep -qF "B2 stay inside R8" <<< "$LAST_OUT"'
check "dry-run writes nothing" '[[ "$(tree_sha "$P")" == "$BEFORE" ]]'
run apply --root "$P"
check "apply exits 0 with the summary line" '[[ $LAST_CODE -eq 0 ]] && grep -qF "INFO [rules] optimise: topics=2 common=2 rules=10" <<< "$LAST_OUT"'
check "the plan file is deleted after a successful write" '[[ ! -e "$P/.unikit/rules-layout.plan.json" ]]'
check "the result reads back as topics: 10 rules, 0 blocks" \
    '[[ "$(field "$P" "inv.state + \" \" + inv.items.filter((i) => i.kind === \"rule\").length + \" \" + inv.items.filter((i) => i.kind === \"block\").length")" == "topics 10 0" ]]'
check "no source line is lost" '[[ "$(lost "$FIXTURES/legacy/.unikit" "$P/.unikit")" -eq 0 ]]'
check "the root carries the SKILL.md header paragraph" 'grep -qF -- "$SKILL_HEADER" "$P/.unikit/RULES.md"'
check "the root lists both topics, alphabetically, then ## Common" \
    'grep -A4 "^| Topic | Load when |" "$P/.unikit/RULES.md" | grep -n "rules/" | tr "\n" " " | grep -q "save-system.*ui" && grep -q "^## Common$" "$P/.unikit/RULES.md"'
check "legacy section headings and separators are gone" '! grep -qE "^(## (Architecture|UI|Save system)|---)$" "$P/.unikit/RULES.md"'
check "the @no-migrate tag survives verbatim" 'grep -qF -- "- Views never reference services directly <!-- @no-migrate -->" "$P/.unikit/rules/ui.md"'
check "the attached table stays inside its rule, indented" 'grep -qF "  | Key | Value |" "$P/.unikit/rules/save-system.md"'

echo -e "\n${BOLD}Part 3: apply refuses a wrong or stale plan — nothing written${NC}"
refuses() { # <label> <plan json> <expected exit>
    local d; d="$(setup legacy)"; plan "$d" "$2"; local before; before="$(tree_sha "$d")"
    run apply --root "$d"
    check "$1 → exit $3, files unchanged" '[[ $LAST_CODE -eq '"$3"' ]] && [[ "$(tree_sha "$d")" == "$before" ]]' "exit $LAST_CODE: ${LAST_OUT:0:160}"
}
refuses "an unassigned rule" '{"version":1,"fingerprint":"@FP@","topics":[],"assign":{"common":["R2-R9","B1","B2"]}}' 2
refuses "a rule assigned twice" '{"version":1,"fingerprint":"@FP@","topics":[],"assign":{"common":["R1-R9","B1","B2","R3"]}}' 2
refuses "a destination that is not a topic" '{"version":1,"fingerprint":"@FP@","topics":[],"assign":{"common":["R1-R9","B1"],"misc":["B2"]}}' 2
refuses "an invalid slug" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"UI Views","title":"UI","loadWhen":"UI"}],"assign":{"common":["R1-R9","B1","B2"]}}' 2
refuses "a topic that receives no rule" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"ui","title":"UI","loadWhen":"UI"}],"assign":{"common":["R1-R9","B1","B2"]}}' 2
refuses "a Load when with a pipe" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"ui","title":"UI","loadWhen":"UI | HUD"}],"assign":{"common":["R1","R2","R7-R9","B2"],"ui":["R3-R6","B1"]}}' 2
refuses "an attached block that is also assigned" '{"version":1,"fingerprint":"@FP@","topics":[],"assign":{"common":["R1-R9","B1","B2"]},"attach":["B2"]}' 2
refuses "attaching a rule" '{"version":1,"fingerprint":"@FP@","topics":[],"assign":{"common":["R1-R8","B1","B2"]},"attach":["R9"]}' 2
S="$(setup legacy)"
plan "$S" '{"version":1,"fingerprint":"@FP@","topics":[],"assign":{"common":["R1-R9","B1","B2"]}}'
echo "- A rule added after parse" >> "$S/.unikit/RULES.md"
BEFORE="$(tree_sha "$S")"
run apply --root "$S"
check "a file changed after parse → exit 3, files unchanged" '[[ $LAST_CODE -eq 3 ]] && [[ "$(tree_sha "$S")" == "$BEFORE" ]]'
run discard --root "$S"
check "discard deletes the plan" '[[ $LAST_CODE -eq 0 ]] && [[ ! -e "$S/.unikit/rules-layout.plan.json" ]]'

echo -e "\n${BOLD}Part 4: regroup, flatten, the flat marker, CRLF, an empty file${NC}"
T="$(setup topics)"
plan "$T" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"client","title":"Client","loadWhen":"UI screens, HUD, saving and loading"}],"assign":{"common":["R1","R2"],"client":["R3-R5"]}}'
run apply --dry-run --root "$T"
check "regroup preview: the new topic is merged from ui and save, the old ones are removed" \
    'grep -qF "merged from save, ui" <<< "$LAST_OUT" &&grep -qF "| [UI views](rules/ui.md) | UI screens, HUD, view models | 0 | removed |" <<< "$LAST_OUT"'
run apply --root "$T"
check "regroup writes client.md and deletes ui.md and save.md" '[[ $LAST_CODE -eq 0 && -s "$T/.unikit/rules/client.md" && ! -e "$T/.unikit/rules/ui.md" && ! -e "$T/.unikit/rules/save.md" ]]'
check "regroup leaves the unlisted old.md untouched" 'cmp -s "$FIXTURES/topics/.unikit/rules/old.md" "$T/.unikit/rules/old.md"'
check "regroup drops the row of the missing net.md" '! grep -qF "rules/net.md" "$T/.unikit/RULES.md"'
check "regroup loses no line" '[[ "$(lost "$FIXTURES/topics/.unikit" "$T/.unikit")" -eq 0 ]]'
T="$(setup topics)"
plan "$T" '{"version":1,"fingerprint":"@FP@","topics":[],"assign":{"common":["R1-R5"]}}'
run apply --root "$T"
check "zero topics: the root goes flat, the listed topic files are deleted" \
    '[[ $LAST_CODE -eq 0 ]] && ! grep -qE "^## (Topics|Common)$" "$T/.unikit/RULES.md" && [[ ! -e "$T/.unikit/rules/ui.md" && ! -e "$T/.unikit/rules/save.md" ]] && [[ "$(field "$T" inv.items.length)" -eq 5 ]]'
F="$(setup flat)"
plan "$F" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"ui","title":"UI","loadWhen":"UI screens, toggles"}],"assign":{"common":["R1","R3"],"ui":["R2"]}}'
run apply --root "$F"
check "flat: optimise removes the marker and writes topics" '[[ $LAST_CODE -eq 0 ]] && ! grep -qF "unikit:rules-layout flat" "$F/.unikit/RULES.md" && [[ "$(field "$F" inv.state)" == topics ]]'
C="$(setup legacy)"
sed -i 's/$/\r/' "$C/.unikit/RULES.md"
plan "$C" "$LEGACY_PLAN"
run apply --root "$C"
check "CRLF: a CRLF root is written back as CRLF, topic files too" \
    '[[ $LAST_CODE -eq 0 ]] && [[ "$(grep -c $'"'"'\r$'"'"' "$C/.unikit/rules/ui.md")" -eq "$(wc -l < "$C/.unikit/rules/ui.md")" ]] && [[ "$(field "$C" "inv.items.length")" -eq 10 ]]'
E="$(setup empty)"
plan "$E" '{"version":1,"fingerprint":"@FP@","topics":[],"assign":{}}'
BEFORE="$(sha256sum "$E/.unikit/RULES.md")"
run apply --root "$E"
check "empty: apply reports no rules and writes nothing" '[[ $LAST_CODE -eq 0 ]] && grep -qF "no rules — file unchanged" <<< "$LAST_OUT" && [[ "$(sha256sum "$E/.unikit/RULES.md")" == "$BEFORE" ]]'

echo -e "\n${BOLD}=== Results ===${NC}"
echo -e "  Total:    $TOTAL"
echo -e "  Passed:   ${GREEN}$PASSED${NC}"
echo -e "  Failed:   ${RED}$FAILED${NC}"
if [[ $FAILED -gt 0 ]]; then
    echo -e "\n${RED}TESTS FAILED${NC}\n"
    exit 1
fi
echo -e "\n${GREEN}ALL TESTS PASSED${NC}\n"
