#!/bin/bash
# Test suite: skills/unikit-architecture/scripts/architecture-layout.mjs — the mechanical half of
# `/unikit-architecture optimise`. Runs the real script with node over the fixture projects in
# scripts/test-fixtures/architecture-layout/ (legacy / flat / topics / empty / fence-open) and proves
# what it exists for: every item survives a reorganization word for word, and nothing is written when
# the plan is wrong or stale. Works on copies only (a nested suite never edits a tracked file); the
# CRLF case and the "no Detailed Rules" case are built at run time — .gitattributes forces LF on checkout.
# Guards TAL-1…TAL-15; each prints how many objects it checked, and a guard that checked none fails.
# Usage: ./scripts/test-architecture-layout.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LAYOUT="$ROOT_DIR/skills/unikit-architecture/scripts/architecture-layout.mjs"
ARCH_SKILL="$ROOT_DIR/skills/unikit-architecture/SKILL.md"
FIXTURES="$SCRIPT_DIR/test-fixtures/architecture-layout"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'
PASSED=0
FAILED=0
TOTAL=0
CUR=0
declare -A GUARD_N
pass() { PASSED=$((PASSED + 1)); TOTAL=$((TOTAL + 1)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { FAILED=$((FAILED + 1)); TOTAL=$((TOTAL + 1)); echo -e "  ${RED}✗${NC} $1"; }
check() { GUARD_N[$CUR]=$(( ${GUARD_N[$CUR]:-0} + 1 )); if eval "$2"; then pass "$1"; else fail "$1${3:+ — $3}"; fi; }
guard() { CUR="$1"; echo -e "\n${BOLD}TAL-$1: $2${NC}"; }
counted() { echo "  TAL-$CUR: ${GUARD_N[$CUR]:-0} objects checked"; }

# setup <fixture> → a fresh copy of the fixture project in its own directory; prints its path
setup() { local d; d="$(mktemp -d "$TMP_ROOT/$1.XXXXXX")"; cp -r "$FIXTURES/$1/." "$d/"; echo "$d"; }
# run <args...> → LAST_OUT / LAST_CODE, never aborts the suite
run() { LAST_CODE=0; LAST_OUT="$(node "$LAYOUT" "$@" 2>&1)" || LAST_CODE=$?; }
# parse fields, read from the text `parse` prints
state() { node "$LAYOUT" parse --root "$1" | sed -n '1s/.*state: \([a-z]*\).*/\1/p'; }
fp() { node "$LAYOUT" parse --root "$1" | sed -n '1s/.*fingerprint: \([0-9a-f]*\).*/\1/p'; }
nitems() { node "$LAYOUT" parse --root "$1" | sed -n '2s/^items: \([0-9]*\) .*/\1/p'; }
kinds() { node "$LAYOUT" parse --root "$1" | sed -n '2s/^items: [0-9]* (\([^)]*\)).*/\1/p'; }
tree_sha() { (cd "$1" && find .unikit -type f | sort | xargs sha256sum | sha256sum | cut -c1-16); }
# plan <project> <json with @FP@> → writes the plan with the project's current fingerprint
plan() { local fp_now; fp_now="$(fp "$1")"; printf '%s' "${2//@FP@/$fp_now}" > "$1/.unikit/architecture-layout.plan.json"; }
# lost <before .unikit dir> <after .unikit dir> → how many source text lines are missing after.
# Headings, separators, table delimiters, the header quote, the marker and the topics table are
# layout, not content; every other line must survive at least as often as it was there.
lost() {
    node -e '
const fs = require("fs"), path = require("path");
const layout = /^(#|-{3,}$|\|[-|: ]+\|$|\|\s*Topic\s*\||\|\s*\[[^\]]*\]\(architecture\/|> This file is the root|<!-- unikit:architecture-layout)/;
const norm = (t) => t.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter((l) => l && !layout.test(l))
  .map((l) => l.replace(/^([-*+]|\d{1,3}[.)])\s+/, ""));
const read = (dir) => { let all = []; const walk = (p) => { for (const f of fs.readdirSync(p)) { const q = path.join(p, f);
  if (fs.statSync(q).isDirectory()) walk(q); else if (f.endsWith(".md")) all = all.concat(norm(fs.readFileSync(q, "utf8"))); } }; walk(dir); return all; };
const after = new Map(); for (const l of read(process.argv[2])) after.set(l, (after.get(l) || 0) + 1);
let lost = 0; for (const l of read(process.argv[1])) { const c = after.get(l) || 0; if (c > 0) after.set(l, c - 1); else lost++; }
console.log(lost);' "$1" "$2"
}
# The header quote SKILL.md defines — the script must write exactly this line.
SKILL_QUOTE="$(awk '/^> This file is the root:/{print; exit}' "$ARCH_SKILL")"

# The plans. Item ids of the `legacy` fixture: P1 Project · T1-T3 Tech Stack · P2 Documentation Sources ·
# P3 P4 L1 L2 Architecture Overview · C1 Folder Structure · L3-L7 Dependency Rules (L7 is the save edge) ·
# T4-T7 Cross-Module Communication (T6 T7 are the save rows) · P5-P7 Module Boundary Strategy ·
# P8 C2 L8 L9 L10 P9 Save System · L11-L13 Key Principles · L14 Anti-Patterns · P10 L15 L16 Detailed Rules.
SAVE_PLAN='{"version":1,"fingerprint":"@FP@","topics":[{"slug":"save","title":"Save system","loadWhen":"saving and loading, save data, migrations"}],"assign":{"root":["P1-P7","P10","T1-T5","L1-L6","L11-L16","C1"],"save":["L7","T6-T7","P8-P9","C2","L8-L10"]}}'
ALL_ROOT='{"version":1,"fingerprint":"@FP@","topics":[],"assign":{"root":["P1-P10","L1-L16","T1-T7","C1-C2"]}}'

echo -e "${BOLD}=== architecture-layout.mjs Tests ===${NC}"

guard 1 "parse: the four states, usage"
check "the script exists" '[[ -s "$LAYOUT" ]]'
check "the script is at most 500 lines" '[[ "$(wc -l < "$LAYOUT")" -le 500 ]]'
check "SKILL.md header quote found" '[[ -n "$SKILL_QUOTE" ]]'
check "the script HEADER_QUOTE equals the SKILL.md quote, byte for byte" 'grep -qF -- "$SKILL_QUOTE" "$LAYOUT"'
check "the script flat marker equals the SKILL.md marker" 'grep -qF -- "<!-- unikit:architecture-layout flat -->" "$LAYOUT" && grep -qF -- "<!-- unikit:architecture-layout flat -->" "$ARCH_SKILL"'
run --help
check "--help exits 0" '[[ $LAST_CODE -eq 0 ]]'
run bogus
check "an unknown command exits 1" '[[ $LAST_CODE -eq 1 ]]'
for fx in legacy:legacy flat:flat topics:topics empty:empty fence-open:legacy; do
    P="$(setup "${fx%%:*}")"
    check "${fx%%:*}: state ${fx##*:}" '[[ "$(state "$P")" == "${fx##*:}" ]]'
done
counted

guard 2 "parse: counters, ids, shapes that must stay whole"
P="$(setup legacy)"
check "legacy: 35 items (P=10, L=16, T=7, C=2)" '[[ "$(nitems "$P")" -eq 35 && "$(kinds "$P")" == "P=10, L=16, T=7, C=2" ]]'
run parse --root "$P"
check "the section table counts the Save System section: 6 items, 341 bytes" 'grep -qF "| Save System | 6 | 341 |" <<< "$LAST_OUT"'
check "the Tech Stack table gives 3 rows, not 5 lines (the head is structure)" 'grep -qF "| Tech Stack | 3 | 85 |" <<< "$LAST_OUT"'
check "a section with no item (Reserved For Later) is not in the table" '! grep -qF "Reserved For Later" <<< "$LAST_OUT"'
check "numbered steps under a bullet that ends with a colon stay inside it (L9, 71 bytes)" 'grep -qF "L9 | Save System | 71 |" <<< "$LAST_OUT"'
check "a blank line followed by an indented continuation stays inside its item (L10, 104 bytes)" 'grep -qF "L10 | Save System | 104 |" <<< "$LAST_OUT"'
check "a nested item stays inside its parent (L6, 81 bytes)" 'grep -qF "L6 | Dependency Rules | 81 |" <<< "$LAST_OUT"'
check "a fenced block with a blank line inside is one item (C2, 44 bytes)" 'grep -qF "C2 | Save System | 44 |" <<< "$LAST_OUT"'
check "the subsection of an item is shown (P6 under Naming)" 'grep -qF "P6 | Module Boundary Strategy / Naming |" <<< "$LAST_OUT"'
check "the --- line is reported as dropped structure" 'grep -qF "1 \"---\" separator lines" <<< "$LAST_OUT"'
check "an escaped pipe inside a row does not split it (T6 is one item)" 'grep -qF "T6 | Cross-Module Communication |" <<< "$LAST_OUT"'
X="$(setup fence-open)"
run parse --root "$X"
check "an unclosed fence is one item plus a WARN" 'grep -qF "WARN [architecture] parse: .unikit/ARCHITECTURE.md:9 code fence is never closed" <<< "$LAST_OUT" && [[ "$(kinds "$X")" == "P=1, L=0, T=0, C=1" ]]'
E="$(setup empty)"
check "empty: no items, whatever the file holds" '[[ "$(nitems "$E")" -eq 0 ]]'
counted

guard 3 "apply: a legacy file into a root and one topic"
P="$(setup legacy)"
plan "$P" "$SAVE_PLAN"
run apply --root "$P"
check "apply exits 0 with the summary line" '[[ $LAST_CODE -eq 0 ]] && grep -qF "INFO [architecture] optimise: topics=1 root=26 items=35" <<< "$LAST_OUT"'
check "the plan file is deleted after a successful write" '[[ ! -e "$P/.unikit/architecture-layout.plan.json" ]]'
check "the result reads back as topics with the same 35 items" '[[ "$(state "$P")" == topics && "$(nitems "$P")" -eq 35 && "$(kinds "$P")" == "P=10, L=16, T=7, C=2" ]]'
check "no source line is lost" '[[ "$(lost "$FIXTURES/legacy/.unikit" "$P/.unikit")" -eq 0 ]]'
check "the root no longer holds a moved item" '! grep -qF "migration steps registered in" "$P/.unikit/ARCHITECTURE.md" && ! grep -qF "background thread" "$P/.unikit/ARCHITECTURE.md"'
check "the topic holds the moved items under their old section names" 'grep -qxF "## Dependency Rules" "$P/.unikit/architecture/save.md" && grep -qxF "## Cross-Module Communication" "$P/.unikit/architecture/save.md" && grep -qxF "## Save System" "$P/.unikit/architecture/save.md"'
check "the topic file starts with the title prefix" '[[ "$(head -1 "$P/.unikit/architecture/save.md")" == "# Architecture — Save system" ]]'
check "table rows land under a copy of their table head" 'grep -qxF "| From | To | Mechanism |" "$P/.unikit/architecture/save.md" && grep -qxF "| From | To | Mechanism |" "$P/.unikit/ARCHITECTURE.md"'
check "a section whose items all left is omitted (Save System)" '! grep -qxF "## Save System" "$P/.unikit/ARCHITECTURE.md"'
check "a section that was empty from the start stays (Reserved For Later)" 'grep -qxF "## Reserved For Later" "$P/.unikit/ARCHITECTURE.md"'
check "a subsection heading survives with its item" 'grep -qxF "### Naming" "$P/.unikit/ARCHITECTURE.md"'
check "the --- line is not carried over" '! grep -qxF -- "---" "$P/.unikit/ARCHITECTURE.md"'
counted

guard 4 "apply refuses a wrong plan — nothing written"
refuses() { # <label> <plan json> <expected exit>
    local d; d="$(setup legacy)"; plan "$d" "$2"; local before; before="$(tree_sha "$d")"
    run apply --root "$d"
    check "$1 → exit $3, files unchanged" '[[ $LAST_CODE -eq '"$3"' ]] && [[ "$(tree_sha "$d")" == "$before" ]]' "exit $LAST_CODE: ${LAST_OUT:0:200}"
}
refuses "an item left out" '{"version":1,"fingerprint":"@FP@","topics":[],"assign":{"root":["P1-P10","L1-L15","T1-T7","C1-C2"]}}' 2
refuses "an item assigned twice" '{"version":1,"fingerprint":"@FP@","topics":[],"assign":{"root":["P1-P10","L1-L16","T1-T7","C1-C2","P3"]}}' 2
refuses "an unknown id" '{"version":1,"fingerprint":"@FP@","topics":[],"assign":{"root":["P1-P10","L1-L16","T1-T7","C1-C2","P99"]}}' 2
refuses "a destination that is not a topic of the plan" '{"version":1,"fingerprint":"@FP@","topics":[],"assign":{"root":["P1-P10","L1-L15","T1-T7","C1-C2"],"misc":["L16"]}}' 2
refuses "an invalid slug" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"Save System","title":"Save","loadWhen":"saving"}],"assign":{"root":["P1-P10","L1-L16","T1-T7","C1-C2"]}}' 2
refuses "a topic that receives no item" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"save","title":"Save","loadWhen":"saving"}],"assign":{"root":["P1-P10","L1-L16","T1-T7","C1-C2"]}}' 2
refuses "a Load when with a pipe" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"save","title":"Save","loadWhen":"saving | loading"}],"assign":{"root":["P1-P7","P10","T1-T5","L1-L6","L11-L16","C1"],"save":["L7","T6-T7","P8-P9","C2","L8-L10"]}}' 2
refuses "the reserved slug root" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"root","title":"Root","loadWhen":"all"}],"assign":{"root":["P1-P10","L1-L16","T1-T7","C1"],"root2":["C2"]}}' 2
refuses "a section rename that names no source section" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"save","title":"Save","loadWhen":"saving"}],"assign":{"root":["P1-P7","P10","T1-T5","L1-L6","L11-L16","C1"],"save":["L7","T6-T7","P8-P9","C2","L8-L10"]},"sections":{"save":{"No Such Section":"X"}}}' 2
counted

guard 5 "apply refuses a stale plan — exit 3"
S="$(setup legacy)"
plan "$S" "$ALL_ROOT"
echo "- A block added after parse" >> "$S/.unikit/ARCHITECTURE.md"
BEFORE="$(tree_sha "$S")"
run apply --root "$S"
check "a file changed after parse → exit 3, files unchanged" '[[ $LAST_CODE -eq 3 ]] && [[ "$(tree_sha "$S")" == "$BEFORE" ]]'
run discard --root "$S"
check "discard deletes the plan" '[[ $LAST_CODE -eq 0 ]] && [[ ! -e "$S/.unikit/architecture-layout.plan.json" ]]'
counted

guard 6 "apply --dry-run: the outline, nothing written"
P="$(setup legacy)"
plan "$P" "$SAVE_PLAN"
BEFORE="$(tree_sha "$P")"
run apply --dry-run --root "$P"
check "dry-run exits 0 and prints the heading line" '[[ $LAST_CODE -eq 0 ]] && grep -qF "## Proposed layout — 1 topics, 26 root items, 35 items" <<< "$LAST_OUT"'
check "dry-run prints the topic row with its Change" 'grep -qF "| [Save system](architecture/save.md) | saving and loading, save data, migrations | 9 |" <<< "$LAST_OUT" && grep -qF "| new |" <<< "$LAST_OUT"'
check "dry-run lists the items of a destination with id, size and first words" 'grep -qE "^L7 +[0-9]+ B  - ❌ The save module" <<< "$LAST_OUT"'
check "dry-run writes nothing" '[[ "$(tree_sha "$P")" == "$BEFORE" ]]'
counted

guard 7 "regroup a topics file: move both ways, merge, split, drop"
T="$(setup topics)"
plan "$T" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"client","title":"Client","loadWhen":"UI screens, saving and loading"}],"assign":{"root":["P1","L1-L3","T1","L4"],"client":["L5-L7","T2-T3","P2-P3"]}}'
run apply --dry-run --root "$T"
check "the preview says merged from save, ui and marks the old rows removed" 'grep -qF "merged from save, ui" <<< "$LAST_OUT" && grep -qF "| [UI views](architecture/ui.md) | UI screens, HUD, view models | 0 | 0 | removed |" <<< "$LAST_OUT"'
run apply --root "$T"
check "merge writes client.md and deletes ui.md and save.md" '[[ $LAST_CODE -eq 0 && -s "$T/.unikit/architecture/client.md" && ! -e "$T/.unikit/architecture/ui.md" && ! -e "$T/.unikit/architecture/save.md" ]]'
check "the unlisted old.md is left untouched" 'cmp -s "$FIXTURES/topics/.unikit/architecture/old.md" "$T/.unikit/architecture/old.md"'
check "the row of the missing net.md is dropped" '! grep -qF "architecture/net.md" "$T/.unikit/ARCHITECTURE.md"'
check "the merge loses no line and no item" '[[ "$(lost "$FIXTURES/topics/.unikit" "$T/.unikit")" -eq 0 && "$(nitems "$T")" -eq 13 ]]'
T="$(setup topics)"
plan "$T" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"save","title":"Save system","loadWhen":"saving and loading, save data, migrations"},{"slug":"ui","title":"UI views","loadWhen":"UI screens, HUD, view models"}],"assign":{"root":["P1","L1-L2","T1","L4","L5"],"save":["T2-T3","P2"],"ui":["L3","L6","P3","L7"]}}'
run apply --root "$T"
check "moves both ways: a topic item to the root, a root item to a topic" '[[ $LAST_CODE -eq 0 ]] && grep -qF "The save module must NOT call the network layer" "$T/.unikit/ARCHITECTURE.md" && grep -qF "Views never reference the storage layer" "$T/.unikit/architecture/ui.md" && ! grep -qF "Views never reference the storage layer" "$T/.unikit/ARCHITECTURE.md"'
check "both kept topics keep their files and rows, the net row is gone" '[[ -s "$T/.unikit/architecture/save.md" && -s "$T/.unikit/architecture/ui.md" ]] && grep -qF "[Save system](architecture/save.md)" "$T/.unikit/ARCHITECTURE.md" && ! grep -qF "net.md" "$T/.unikit/ARCHITECTURE.md"'
check "the move loses no line and keeps 13 items" '[[ "$(lost "$FIXTURES/topics/.unikit" "$T/.unikit")" -eq 0 && "$(nitems "$T")" -eq 13 ]]'
T="$(setup topics)"
plan "$T" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"save","title":"Save system","loadWhen":"saving and loading"},{"slug":"ui","title":"UI views","loadWhen":"UI screens"},{"slug":"net","title":"Networking","loadWhen":"sockets"}],"assign":{"root":["P1","L1-L4","T1"],"save":["L5","T2-T3"],"ui":["L6-L7","P3"],"net":["P2"]}}'
run apply --dry-run --root "$T"
check "a split is named in the preview (save is split into save and net)" 'grep -qF "split from save" <<< "$LAST_OUT"'
counted

guard 8 "a plan with no topic on a topics file: everything back into the root"
T="$(setup topics)"
plan "$T" '{"version":1,"fingerprint":"@FP@","topics":[],"assign":{"root":["P1-P3","L1-L7","T1-T3"]}}'
run apply --root "$T"
R="$T/.unikit/ARCHITECTURE.md"
check "exit 0, 13 items" '[[ $LAST_CODE -eq 0 && "$(nitems "$T")" -eq 13 ]]'
check "no table, no topics heading, no header quote" '! grep -qxF "## Topics" "$R" && ! grep -qF "| Topic | Load when |" "$R" && ! grep -qF "This file is the root" "$R"'
check "the listed topic files are deleted" '[[ ! -e "$T/.unikit/architecture/save.md" && ! -e "$T/.unikit/architecture/ui.md" ]]'
check "items return to the root sections with their names; unknown names are added before Detailed Rules" 'grep -qxF "## Contracts" "$R" && grep -qxF "## Mechanism" "$R" && [[ "$(grep -n "^## Mechanism$" "$R" | cut -d: -f1)" -lt "$(grep -n "^## Detailed Rules$" "$R" | cut -d: -f1)" ]]'
check "no line is lost" '[[ "$(lost "$FIXTURES/topics/.unikit" "$T/.unikit")" -eq 0 ]]'
check "the unlisted old.md is untouched, so the directory stays" 'cmp -s "$FIXTURES/topics/.unikit/architecture/old.md" "$T/.unikit/architecture/old.md"'
counted

guard 9 "flat → topics removes the marker; zero topics keeps it"
F="$(setup flat)"
plan "$F" "$SAVE_PLAN"
run apply --root "$F"
check "flat: apply with a topic removes the marker and gives state topics" '[[ $LAST_CODE -eq 0 ]] && ! grep -qF "unikit:architecture-layout flat" "$F/.unikit/ARCHITECTURE.md" && [[ "$(state "$F")" == topics ]]'
F="$(setup flat)"
plan "$F" "$ALL_ROOT"
run apply --root "$F"
check "flat: a plan with zero topics keeps the marker, writes no quote and no table" '[[ $LAST_CODE -eq 0 && "$(state "$F")" == flat ]] && ! grep -qF "This file is the root" "$F/.unikit/ARCHITECTURE.md" && ! grep -qxF "## Topics" "$F/.unikit/ARCHITECTURE.md"'
check "flat: the marker stays directly under the title" '[[ "$(sed -n 2p "$F/.unikit/ARCHITECTURE.md")" == "<!-- unikit:architecture-layout flat -->" ]]'
L="$(setup legacy)"
plan "$L" "$ALL_ROOT"
run apply --root "$L"
check "legacy: a plan with zero topics writes no marker (the marker is the user's refusal, written by the skill)" '[[ $LAST_CODE -eq 0 && "$(state "$L")" == legacy ]] && ! grep -qF "unikit:architecture-layout" "$L/.unikit/ARCHITECTURE.md"'
check "flat: no line lost either way" '[[ "$(lost "$FIXTURES/legacy/.unikit" "$L/.unikit")" -eq 0 && "$(lost "$FIXTURES/flat/.unikit" "$F/.unikit")" -eq 0 ]]'
counted

guard 10 "idempotency: a second apply of the same plan is stale"
P="$(setup legacy)"
plan "$P" "$SAVE_PLAN"
cp "$P/.unikit/architecture-layout.plan.json" "$TMP_ROOT/saved-plan.json"
run apply --root "$P"
N_AFTER="$(nitems "$P")"
check "parse after apply: state topics, the same item count" '[[ "$(state "$P")" == topics && "$N_AFTER" -eq 35 ]]'
cp "$TMP_ROOT/saved-plan.json" "$P/.unikit/architecture-layout.plan.json"
BEFORE="$(tree_sha "$P")"
run apply --root "$P"
check "the same plan again → exit 3, files unchanged" '[[ $LAST_CODE -eq 3 && "$(tree_sha "$P")" == "$BEFORE" ]]'
plan "$P" "$ALL_ROOT"
run apply --root "$P"
check "the layout round-trips: topics back into one root keeps 35 items and loses no line" '[[ $LAST_CODE -eq 0 && "$(nitems "$P")" -eq 35 && "$(state "$P")" == legacy && "$(lost "$FIXTURES/legacy/.unikit" "$P/.unikit")" -eq 0 ]]'
counted

guard 11 "drift between the table and the files is reported, never fixed"
T="$(setup topics)"
run parse --root "$T"
check "a listed file that is missing is warned about" 'grep -qF "WARN [architecture] topic table: net is listed, .unikit/architecture/net.md does not exist" <<< "$LAST_OUT"'
check "an unlisted file is warned about and left out of the items" 'grep -qF "WARN [architecture] topic table: .unikit/architecture/old.md is not listed under ## Topics — no reader loads it" <<< "$LAST_OUT" && [[ "$(nitems "$T")" -eq 13 ]]'
M="$(setup topics)"
sed -i '1a <!-- unikit:architecture-layout flat -->' "$M/.unikit/ARCHITECTURE.md"
run parse --root "$M"
check "a marker next to a table is warned about and ignored (state stays topics)" 'grep -qF "WARN [architecture] layout: flat marker ignored — the file already has a ## Topics table" <<< "$LAST_OUT" && [[ "$(state "$M")" == topics ]]'
counted

guard 12 "line endings: a CRLF root is written back as CRLF everywhere"
C="$(setup legacy)"
sed -i 's/$/\r/' "$C/.unikit/ARCHITECTURE.md"
plan "$C" "$SAVE_PLAN"
run apply --root "$C"
check "apply exits 0 and keeps 35 items" '[[ $LAST_CODE -eq 0 && "$(nitems "$C")" -eq 35 ]]'
check "the topic file is CRLF on every line" '[[ "$(grep -c $'"'"'\r$'"'"' "$C/.unikit/architecture/save.md")" -eq "$(wc -l < "$C/.unikit/architecture/save.md")" ]]'
check "the root is CRLF on every line" '[[ "$(grep -c $'"'"'\r$'"'"' "$C/.unikit/ARCHITECTURE.md")" -eq "$(wc -l < "$C/.unikit/ARCHITECTURE.md")" ]]'
counted

guard 13 "the quote once; the table directly above Detailed Rules, or last when there is none"
P="$(setup legacy)"
plan "$P" "$SAVE_PLAN"
run apply --root "$P"
R="$P/.unikit/ARCHITECTURE.md"
check "the header quote stands exactly once, directly under the title" '[[ "$(grep -c "^> This file is the root" "$R")" -eq 1 && "$(sed -n 3p "$R")" == "$SKILL_QUOTE" ]]'
check "## Topics is directly above ## Detailed Rules" '[[ "$(awk "/^## /{print}" "$R" | grep -A1 "^## Topics$" | tail -1)" == "## Detailed Rules" ]]'
check "the table has the header row, the delimiter row and the topic row" 'grep -qxF "| Topic | Load when |" "$R" && grep -qxF "|-------|-----------|" "$R" && grep -qxF "| [Save system](architecture/save.md) | saving and loading, save data, migrations |" "$R"'
N="$(setup legacy)"
sed -i '/^## Detailed Rules$/,$d' "$N/.unikit/ARCHITECTURE.md"
plan "$N" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"save","title":"Save system","loadWhen":"saving and loading"}],"assign":{"root":["P1-P7","T1-T5","L1-L6","L11-L14","C1"],"save":["L7","T6-T7","P8-P9","C2","L8-L10"]}}'
run apply --root "$N"
check "without Detailed Rules the table is the last section" '[[ $LAST_CODE -eq 0 && "$(awk "/^## /{print}" "$N/.unikit/ARCHITECTURE.md" | tail -1)" == "## Topics" ]]'
counted

guard 14 "sections: a source section renamed inside one topic"
P="$(setup legacy)"
plan "$P" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"save","title":"Save system","loadWhen":"saving and loading, save data, migrations"}],"assign":{"root":["P1-P7","P10","T1-T5","L1-L6","L11-L16","C1"],"save":["L7","T6-T7","P8-P9","C2","L8-L10"]},"sections":{"save":{"Save System":"Mechanism","Cross-Module Communication":"Contracts"}}}'
run apply --root "$P"
check "the topic carries the new names and not the old ones" '[[ $LAST_CODE -eq 0 ]] && grep -qxF "## Mechanism" "$P/.unikit/architecture/save.md" && grep -qxF "## Contracts" "$P/.unikit/architecture/save.md" && ! grep -qxF "## Save System" "$P/.unikit/architecture/save.md"'
check "the root keeps its own section names" 'grep -qxF "## Cross-Module Communication" "$P/.unikit/ARCHITECTURE.md"'
check "the rename loses no line" '[[ "$(lost "$FIXTURES/legacy/.unikit" "$P/.unikit")" -eq 0 && "$(nitems "$P")" -eq 35 ]]'
counted

guard 15 "defects found by the verification audit: C# headings, repeated sections, unlisted files, bad plan files, repeated rows, open fences, mixed ranges"
mkproj() { local d; d="$(mktemp -d "$TMP_ROOT/$1.XXXXXX")"; mkdir -p "$d/.unikit"; cat > "$d/.unikit/ARCHITECTURE.md"; echo "$d"; }
line_of() { grep -nxF -- "$2" "$1" | cut -d: -f1 | sed -n "${3:-1}p"; }
S="$(mkproj sharp <<'EOF'
# Architecture: T

## Using C#

First item about C#.

## Plain

Second item.
EOF
)"
plan "$S" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"cs","title":"C sharp","loadWhen":"c sharp"}],"assign":{"root":["P2"],"cs":["P1"]}}'
run apply --root "$S"
check "a section name that ends with # is written whole into the topic file" '[[ $LAST_CODE -eq 0 ]] && grep -qxF "## Using C#" "$S/.unikit/architecture/cs.md"'
D="$(mkproj dup <<'EOF'
# Architecture: T

## Dup

### S

item1

## Dup

item2

## Other

item3
EOF
)"
plan "$D" '{"version":1,"fingerprint":"@FP@","topics":[],"assign":{"root":["P1-P3"]}}'
run apply --root "$D"
DUP_FILE="$D/.unikit/ARCHITECTURE.md"
check "an item that was not under a ### heading is not written under one: the repeated ## Dup heading is written again" \
    '[[ $LAST_CODE -eq 0 && "$(grep -cxF "## Dup" "$DUP_FILE")" -eq 2 && "$(line_of "$DUP_FILE" "### S")" -lt "$(line_of "$DUP_FILE" "## Dup" 2)" && "$(line_of "$DUP_FILE" "## Dup" 2)" -lt "$(line_of "$DUP_FILE" "item2")" ]]'
U="$(mkproj unl <<'EOF'
# Architecture: T

## One

item1

## Two

item2
EOF
)"
mkdir -p "$U/.unikit/architecture"
echo "USER FILE keep me" > "$U/.unikit/architecture/mine.md"
plan "$U" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"mine","title":"Mine","loadWhen":"x"}],"assign":{"root":["P1"],"mine":["P2"]}}'
BEFORE="$(tree_sha "$U")"
run apply --root "$U"
check "a topic slug whose file exists and no row lists is refused, the file stays" '[[ $LAST_CODE -eq 2 && "$(tree_sha "$U")" == "$BEFORE" ]] && grep -qF "no row lists it" <<< "$LAST_OUT" && grep -qxF "USER FILE keep me" "$U/.unikit/architecture/mine.md"'
for body in 'not json' 'null' '[]' '{"version":1}'; do
    printf '%s' "$body" > "$U/.unikit/architecture-layout.plan.json"
    BEFORE="$(tree_sha "$U")"
    run apply --root "$U"
    check "a plan file that reads \"$body\" is invalid: exit 2, nothing written" '[[ $LAST_CODE -eq 2 && "$(tree_sha "$U")" == "$BEFORE" ]]'
done
R="$(mkproj rows <<'EOF'
# Architecture: T

## One

item1

## Topics

| Topic | Load when |
|-------|-----------|
| [T](architecture/t.md) | a |
| [T again](architecture/t.md) | b |
EOF
)"
mkdir -p "$R/.unikit/architecture"
printf '# Architecture — T\n\n## S\n\nx\n\ny\n' > "$R/.unikit/architecture/t.md"
run parse --root "$R"
check "two table rows with one slug read the file once and warn about the second row" '[[ "$(nitems "$R")" -eq 3 ]] && grep -qF "t is listed twice" <<< "$LAST_OUT"'
F="$(mkproj fence <<'EOF'
# Architecture: Small

## Project

A short project.

## Folder Structure

```
Game/
EOF
)"
plan "$F" '{"version":1,"fingerprint":"@FP@","topics":[{"slug":"a","title":"A","loadWhen":"x"}],"assign":{"root":["C1"],"a":["P1"]}}'
BEFORE="$(tree_sha "$F")"
run apply --root "$F"
check "an open code fence makes apply refuse and name the cause, nothing written" '[[ $LAST_CODE -eq 2 && "$(tree_sha "$F")" == "$BEFORE" ]] && grep -qF "is never closed" <<< "$LAST_OUT" && grep -qF "close it in the source first" <<< "$LAST_OUT"'
M="$(mkproj range <<'EOF'
# Architecture: T

## One

item1

- item2
EOF
)"
plan "$M" '{"version":1,"fingerprint":"@FP@","topics":[],"assign":{"root":["P1-L1","L1"]}}'
BEFORE="$(tree_sha "$M")"
run apply --root "$M"
check "a range that mixes two kinds is refused" '[[ $LAST_CODE -eq 2 && "$(tree_sha "$M")" == "$BEFORE" ]] && grep -qF "is not an item id" <<< "$LAST_OUT"'
counted

echo -e "\n${BOLD}Every guard checked at least one object${NC}"
for n in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    check "TAL-$n counted objects" '[[ "${GUARD_N[$n]:-0}" -gt 0 ]]'
done

echo -e "\n${BOLD}=== Results ===${NC}"
echo -e "  Total:    $TOTAL"
echo -e "  Passed:   ${GREEN}$PASSED${NC}"
echo -e "  Failed:   ${RED}$FAILED${NC}"
if [[ $FAILED -gt 0 ]]; then
    echo -e "\n${RED}TESTS FAILED${NC}\n"
    exit 1
fi
echo -e "\n${GREEN}ALL TESTS PASSED${NC}\n"
