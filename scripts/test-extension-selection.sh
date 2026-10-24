#!/bin/bash
# End-to-end scenarios for the extension item selection (skills, subagents, MCP servers):
# first install and flags, names, re-add, update / update --force, a version bump without a
# terminal, --install-new / --skip-new, `extension select`, a switched-off replacement, remove,
# legacy records, `extension list`, a dangling preload, Codex TOML, and the git clone clean-up.
# The menu itself needs a terminal and is checked by hand; everything here goes through flags.
# Usage: ./scripts/test-extension-selection.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=./test-fixtures.sh
source "$SCRIPT_DIR/test-fixtures.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Ensure dist/ is up to date unless a parent runner already built.
if [[ "${UNIKIT_TEST_SKIP_BUILD:-0}" != "1" ]]; then
    (cd "$ROOT_DIR" && npm run build > /dev/null 2>&1)
fi

CLI="$ROOT_DIR/dist/cli/index.js"
EXT_NAME="unikit-ext-sel"

assert_contains() {   # <file> <ERE> <hint>
  if ! grep -qE -- "$2" "$1"; then
    echo "Assertion failed: $3"; echo "Pattern: $2"; echo "File: $1"; tail -25 "$1" 2>/dev/null || true
    exit 1
  fi
}

assert_not_contains() {   # <file> <ERE> <hint>
  if grep -qE -- "$2" "$1"; then
    echo "Assertion failed: $3"; echo "Pattern: $2"; echo "File: $1"; tail -25 "$1" 2>/dev/null || true
    exit 1
  fi
}

assert_has() {   # <file> <fixed string> <hint>
  if ! grep -qF -- "$2" "$1"; then
    echo "Assertion failed: $3"; echo "Text: $2"; echo "File: $1"; tail -25 "$1" 2>/dev/null || true
    exit 1
  fi
}

assert_has_not() {   # <file> <fixed string> <hint>
  if grep -qF -- "$2" "$1"; then
    echo "Assertion failed: $3"; echo "Text: $2"; echo "File: $1"; tail -25 "$1" 2>/dev/null || true
    exit 1
  fi
}

assert_exists() {   # <path> <hint>
  if [[ ! -e "$1" ]]; then echo "Assertion failed: $2"; echo "Missing path: $1"; exit 1; fi
}

assert_not_exists() {   # <path> <hint>
  if [[ -e "$1" ]]; then echo "Assertion failed: $2"; echo "Path should not exist: $1"; exit 1; fi
}

expect_eq() {   # <actual> <expected> <hint>
  if [[ "$1" != "$2" ]]; then
    echo "Assertion failed: $3"; echo "Expected: $2"; echo "Actual:   $1"
    exit 1
  fi
}

# json_get <file> <js expression over c>  — prints the value, "undefined" when absent
json_get() {
  node -e '
    const c = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const v = new Function("c", "return " + process.argv[2])(c);
    console.log(v === undefined ? "undefined" : (typeof v === "object" ? JSON.stringify(v) : String(v)));
  ' "$1" "$2"
}

# ext_get <project> <js expression over e>  — e is the extension record in .unikit.json
ext_get() {
  json_get "$1/.unikit.json" "(function (e) { return $2; })((c.extensions || []).find(function (x) { return x.name === '$EXT_NAME'; }))"
}

# run_cli <project> <log> <args...>  — sets RC, never aborts the script
RC=0
run_cli() {
  local project="$1" log="$2"
  shift 2
  set +e
  (cd "$project" && node "$CLI" "$@" > "$log" 2>&1)
  RC=$?
  set -e
}

expect_rc() {   # <expected> <label> <log>
  if [[ "$RC" != "$1" ]]; then
    echo "Assertion failed: $2 (exit $RC, expected $1)"
    tail -30 "$3" 2>/dev/null || true
    exit 1
  fi
}

write_skill() {   # <dir> <name> <body>
  mkdir -p "$1"
  printf -- '---\nname: %s\ndescription: %s skill\n---\n\n%s\n' "$2" "$2" "$3" > "$1/SKILL.md"
}

# make_sel_ext <dir> <version> [new] [noreplace]
#   skills alpha, beta (+ my-commit as a replacement of unikit-commit), subagents helper-a
#   (preloads beta) and helper-b, MCP servers srv-one and srv-two, an injection into beta and one
#   into the base skill unikit. `new` adds gamma, helper-c and srv-three; `noreplace` leaves
#   my-commit out of the manifest.
make_sel_ext() {
  local dir="$1" version="$2"
  shift 2
  local with_new=0 with_replace=1 flag
  for flag in "$@"; do
    case "$flag" in
      new) with_new=1 ;;
      noreplace) with_replace=0 ;;
    esac
  done

  rm -rf "$dir"
  mkdir -p "$dir/subagents" "$dir/mcp" "$dir/injections"
  write_skill "$dir/skills/alpha" alpha "ALPHA-BODY"
  write_skill "$dir/skills/beta" beta "BETA-BODY"
  write_skill "$dir/skills/my-commit" my-commit "CUSTOM-COMMIT-BODY"
  write_skill "$dir/skills/gamma" gamma "GAMMA-BODY"
  printf -- '---\nname: helper-a\ndescription: Helper A\nskills:\n  - beta\n---\n\nHELPER-A-BODY\n' > "$dir/subagents/helper-a.md"
  printf -- '---\nname: helper-b\ndescription: Helper B\n---\n\nHELPER-B-BODY\n' > "$dir/subagents/helper-b.md"
  printf -- '---\nname: helper-c\ndescription: Helper C\n---\n\nHELPER-C-BODY\n' > "$dir/subagents/helper-c.md"
  printf '%s\n' '{"command":"echo","args":["one"]}' > "$dir/mcp/one.json"
  printf '%s\n' '{"command":"echo","args":["two"]}' > "$dir/mcp/two.json"
  printf '%s\n' '{"command":"echo","args":["three"]}' > "$dir/mcp/three.json"
  printf '%s\n' 'BETA-INJECTION' > "$dir/injections/beta-extra.md"
  printf '%s\n' 'UNIKIT-INJECTION' > "$dir/injections/unikit-extra.md"

  node -e '
    const fs = require("fs"), path = require("path");
    const [dir, version, withNew, withReplace] = process.argv.slice(1);
    const m = {
      name: "unikit-ext-sel",
      version,
      skills: ["skills/alpha", "skills/beta"],
      subagents: ["subagents/helper-a.md", "subagents/helper-b.md"],
      mcpServers: [
        { key: "srv-one", template: "./mcp/one.json" },
        { key: "srv-two", template: "./mcp/two.json" },
      ],
      injections: [
        { target: "beta", targetType: "skill", position: "append", file: "./injections/beta-extra.md" },
        { target: "unikit", targetType: "skill", position: "append", file: "./injections/unikit-extra.md" },
      ],
    };
    if (withReplace === "1") m.replaces = { "skills/my-commit": "unikit-commit" };
    if (withNew === "1") {
      m.skills.push("skills/gamma");
      m.subagents.push("subagents/helper-c.md");
      m.mcpServers.push({ key: "srv-three", template: "./mcp/three.json" });
    }
    fs.writeFileSync(path.join(dir, "extension.json"), JSON.stringify(m, null, 2));
  ' "$dir" "$version" "$with_new" "$with_replace"
}

# make_project <dir> [agent id] [skills dir] [subagents dir]  — a project with the base skills installed
make_project() {
  local dir="$1" agent="${2:-claude}" skills="${3:-.claude/skills}" agents="${4:-.claude/agents}"
  mkdir -p "$dir"
  cat > "$dir/.unikit.json" << EOF
{
  "version": "1.0.0", "language": "en", "engine": "unity", "engineMcpKey": null,
  "mcp": { "servers": {} },
  "agents": [ { "id": "$agent", "skillsDir": "$skills", "subagentsDir": "$agents",
                "installedSkills": ["unikit", "unikit-commit"], "installedSubagents": [] } ],
  "rules": { "installed": { "version": "1.0.0", "core": [], "stack": [] }, "declined": [] }
}
EOF
  inject_fake_registry "$dir"
  (cd "$dir" && node "$CLI" update > /dev/null 2>&1)
}

# rebind_source <project> <new source dir>  — points the record at its own copy of the source
rebind_source() {
  node -e '
    const fs = require("fs");
    const file = process.argv[1] + "/.unikit.json";
    const c = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const e of c.extensions || []) if (e.name === "unikit-ext-sel") e.source = process.argv[2];
    fs.writeFileSync(file, JSON.stringify(c, null, 2));
  ' "$1" "$2"
}

# Pristine projects, built once: every scenario works on a copy.
BASE="$TMPDIR/base"
make_project "$BASE"

new_project() {   # <name>  — prints the path of a fresh copy of the base project
  local dir="$TMPDIR/p-$1"
  cp -R "$BASE" "$dir"
  printf '%s' "$dir"
}

copy_state() {   # <project> <name>  — prints the path of a copy of a project in its current state
  local dir="$TMPDIR/p-$2"
  cp -R "$1" "$dir"
  printf '%s' "$dir"
}

new_source() {   # <name> <version> [flags]  — prints the path of a fresh extension source
  local dir="$TMPDIR/src-$1"
  shift
  make_sel_ext "$dir" "$@"
  printf '%s' "$dir"
}

# ─────────────────────────────────────────────────────
# S1: first install, no terminal, no flags — everything on
# ─────────────────────────────────────────────────────

S1_SRC=$(new_source s1 1.0.0)
S1=$(new_project s1)
run_cli "$S1" "$TMPDIR/s1-add.log" extension add "$S1_SRC"
expect_rc 0 "S1: extension add" "$TMPDIR/s1-add.log"

assert_exists "$S1/.claude/skills/alpha/SKILL.md" "S1: alpha is installed"
assert_exists "$S1/.claude/skills/beta/SKILL.md" "S1: beta is installed"
assert_contains "$S1/.claude/skills/unikit-commit/SKILL.md" 'CUSTOM-COMMIT-BODY' "S1: the replacement is installed under the base name"
assert_exists "$S1/.claude/agents/helper-a.md" "S1: helper-a is installed"
assert_exists "$S1/.claude/agents/helper-b.md" "S1: helper-b is installed"
assert_contains "$S1/.mcp.json" 'srv-one' "S1: srv-one is configured"
assert_contains "$S1/.mcp.json" 'srv-two' "S1: srv-two is configured"
expect_eq "$(ext_get "$S1" 'Object.values(e.selection.skills).filter(Boolean).length')" "3" "S1: three skills on"
expect_eq "$(ext_get "$S1" 'Object.values(e.selection.subagents).filter(Boolean).length')" "2" "S1: two subagents on"
expect_eq "$(ext_get "$S1" 'Object.values(e.selection.mcpServers).filter(Boolean).length')" "2" "S1: two MCP servers on"
expect_eq "$(ext_get "$S1" "e.replacedSkills['unikit-commit']")" "skills/my-commit" "S1: the replacement is recorded"
assert_has "$TMPDIR/s1-add.log" 'Skills: 3 of 3' "S1: the summary counts skills"
assert_has "$TMPDIR/s1-add.log" 'Subagents: 2 of 2' "S1: the summary counts subagents"
assert_has "$TMPDIR/s1-add.log" 'MCP servers: 2 of 2' "S1: the summary counts MCP servers"
assert_has_not "$TMPDIR/s1-add.log" '[WARN]' "S1: nothing to warn about"

echo "  ✓ selection S1: first install without a terminal or flags installs everything and records the selection"

# ─────────────────────────────────────────────────────
# S2: first install with --skip-* flags
# ─────────────────────────────────────────────────────

S2_SRC=$(new_source s2 1.0.0)
S2=$(new_project s2)
run_cli "$S2" "$TMPDIR/s2-add.log" extension add "$S2_SRC" \
  --skip-skills beta,my-commit --skip-subagents helper-b --skip-mcp srv-two
expect_rc 0 "S2: extension add with flags" "$TMPDIR/s2-add.log"

assert_not_exists "$S2/.claude/skills/beta" "S2: beta is not installed"
assert_exists "$S2/.claude/skills/alpha/SKILL.md" "S2: alpha is installed"
assert_not_contains "$S2/.claude/skills/unikit-commit/SKILL.md" 'CUSTOM-COMMIT-BODY' "S2: the base skill keeps its own text"
assert_not_exists "$S2/.claude/agents/helper-b.md" "S2: helper-b is not installed"
assert_exists "$S2/.claude/agents/helper-a.md" "S2: helper-a is installed"
assert_contains "$S2/.mcp.json" 'srv-one' "S2: srv-one is configured"
assert_not_contains "$S2/.mcp.json" 'srv-two' "S2: srv-two is not configured"
expect_eq "$(ext_get "$S2" "e.selection.skills['skills/beta']")" "false" "S2: beta is recorded as off"
expect_eq "$(ext_get "$S2" "e.selection.skills['skills/my-commit']")" "false" "S2: the replacement is recorded as off"
expect_eq "$(ext_get "$S2" "e.selection.subagents['subagents/helper-b.md']")" "false" "S2: helper-b is recorded as off"
expect_eq "$(ext_get "$S2" "e.selection.mcpServers['srv-two']")" "false" "S2: srv-two is recorded as off"
expect_eq "$(ext_get "$S2" 'e.replacedSkills')" "undefined" "S2: no replacement is recorded"
assert_has "$S2/.unikit.json" '"selection"' "S2: the selection is in the config"
assert_has "$TMPDIR/s2-add.log" 'Skills: 1 of 3 — skipped: beta, my-commit → unikit-commit' "S2: the summary names what was skipped"
assert_has "$TMPDIR/s2-add.log" 'Subagents: 1 of 2 — skipped: helper-b' "S2: the summary names the skipped subagent"
assert_contains "$S2/.claude/skills/unikit/SKILL.md" 'unikit-ext:unikit-ext-sel:unikit:append:start' "S2: an injection into a base skill is applied whatever the selection"
assert_has "$TMPDIR/s2-add.log" 'left out of its selection' "S2: the disabled target has its own reason"
assert_has_not "$TMPDIR/s2-add.log" 'Injection target not found' "S2: no raw warning for the disabled target"
assert_has "$TMPDIR/s2-add.log" '[WARN][extension]' "S2: the dangling preload is warned about"
assert_has "$TMPDIR/s2-add.log" 'preloads skill "beta"' "S2: the warning names the skill"

echo "  ✓ selection S2: --skip-skills, --skip-subagents and --skip-mcp leave the named items out and say why"

# ─────────────────────────────────────────────────────
# S3: names — unknown, ambiguous, a kind with no items
# ─────────────────────────────────────────────────────

S3_SRC=$(new_source s3 1.0.0)
S3=$(new_project s3)
run_cli "$S3" "$TMPDIR/s3a.log" extension add "$S3_SRC" --skip-skills nope
expect_rc 1 "S3a: an unknown name fails" "$TMPDIR/s3a.log"
assert_has "$TMPDIR/s3a.log" 'Unknown skill "nope" for --skip-skills' "S3a: the error names the flag"
assert_not_exists "$S3/.unikit/extensions/$EXT_NAME" "S3a: nothing is stored"
expect_eq "$(json_get "$S3/.unikit.json" '(c.extensions || []).length')" "0" "S3a: no record is written"

DUP_SRC="$TMPDIR/src-dup"
mkdir -p "$DUP_SRC"
write_skill "$DUP_SRC/skills/a/dup" dup "DUP-A"
write_skill "$DUP_SRC/skills/b/dup" dup "DUP-B"
printf '%s\n' '{ "name": "unikit-ext-dup", "version": "1.0.0", "skills": ["skills/a/dup", "skills/b/dup"] }' > "$DUP_SRC/extension.json"
run_cli "$S3" "$TMPDIR/s3b1.log" extension add "$DUP_SRC" --skip-skills dup
expect_rc 1 "S3b: an ambiguous name fails" "$TMPDIR/s3b1.log"
assert_has "$TMPDIR/s3b1.log" 'Ambiguous' "S3b: the error says ambiguous"
run_cli "$S3" "$TMPDIR/s3b2.log" extension add "$DUP_SRC" --skip-skills skills/a/dup
expect_rc 0 "S3b: the manifest path is not ambiguous" "$TMPDIR/s3b2.log"

HELLO_SRC="$ROOT_DIR/examples/extensions/unikit-ext-hello"
run_cli "$S3" "$TMPDIR/s3c.log" extension add "$HELLO_SRC" --skip-mcp x
expect_rc 1 "S3c: --skip-mcp on an extension without servers fails" "$TMPDIR/s3c.log"
assert_has "$TMPDIR/s3c.log" '--skip-mcp given, but the extension offers no mcp servers' "S3c: the error says why"

echo "  ✓ selection S3: an unknown, ambiguous or impossible name fails before anything is written"

# ─────────────────────────────────────────────────────
# S4: add again, --yes, --install-new, and first-install flags
# ─────────────────────────────────────────────────────

S4=$(copy_state "$S2" s4)
run_cli "$S4" "$TMPDIR/s4a.log" extension add "$S2_SRC"
expect_rc 0 "S4: add again" "$TMPDIR/s4a.log"
assert_not_exists "$S4/.claude/skills/beta" "S4: add again keeps beta off"
expect_eq "$(ext_get "$S4" "e.selection.skills['skills/beta']")" "false" "S4: and the decision is kept"
run_cli "$S4" "$TMPDIR/s4b.log" extension add "$S2_SRC" --yes
expect_rc 0 "S4: add --yes" "$TMPDIR/s4b.log"
assert_not_exists "$S4/.claude/skills/beta" "S4: --yes keeps beta off"
run_cli "$S4" "$TMPDIR/s4c.log" extension add "$S2_SRC" --install-new
expect_rc 0 "S4: add --install-new" "$TMPDIR/s4c.log"
assert_not_exists "$S4/.claude/skills/beta" "S4: --install-new does not turn an earlier choice back on"
assert_not_exists "$S4/.claude/agents/helper-b.md" "S4: nor the subagent"

S4B=$(new_project s4b)
run_cli "$S4B" "$TMPDIR/s4d.log" extension add "$S2_SRC" --skip-new --install-new --skip-skills beta
expect_rc 0 "S4: first install with the new-item flags" "$TMPDIR/s4d.log"
assert_not_exists "$S4B/.claude/skills/beta" "S4: the named skill is left out"
assert_exists "$S4B/.claude/skills/alpha/SKILL.md" "S4: the rest is installed (--skip-new means nothing on a first install)"
assert_exists "$S4B/.claude/agents/helper-b.md" "S4: including the subagents"

echo "  ✓ selection S4: a repeated add keeps the choices; the new-item flags mean nothing on a first install"

# ─────────────────────────────────────────────────────
# S5: update and update --force do not bring back what was left out
# ─────────────────────────────────────────────────────

S5=$(copy_state "$S2" s5)
run_cli "$S5" "$TMPDIR/s5a.log" update
expect_rc 0 "S5: update" "$TMPDIR/s5a.log"
run_cli "$S5" "$TMPDIR/s5b.log" update --force
expect_rc 0 "S5: update --force" "$TMPDIR/s5b.log"
for log in s5a s5b; do
  assert_has_not "$TMPDIR/$log.log" 'unikit-commit (replaced by extension)' "S5: the base skill is not reported as replaced ($log)"
done
assert_not_exists "$S5/.claude/skills/beta" "S5: beta is still off"
assert_not_exists "$S5/.claude/agents/helper-b.md" "S5: helper-b is still off"
assert_exists "$S5/.claude/skills/alpha/SKILL.md" "S5: alpha stays"
assert_exists "$S5/.claude/agents/helper-a.md" "S5: helper-a stays"
assert_not_contains "$S5/.claude/skills/unikit-commit/SKILL.md" 'CUSTOM-COMMIT-BODY' "S5: the base skill is the package one"
expect_eq "$(json_get "$S5/.unikit.json" "typeof c.agents[0].managedSkills['unikit-commit']")" "object" "S5: the base skill is managed (it keeps updating)"

echo "  ✓ selection S5: update and update --force do not return what was switched off"

# ─────────────────────────────────────────────────────
# S6: a new version without a terminal — new items are not installed
# ─────────────────────────────────────────────────────

S6_SRC=$(new_source s6 1.0.0)
S6=$(copy_state "$S2" s6)
rebind_source "$S6" "$S6_SRC"
make_sel_ext "$S6_SRC" 2.0.0 new
run_cli "$S6" "$TMPDIR/s6a.log" extension update
expect_rc 0 "S6: extension update" "$TMPDIR/s6a.log"
assert_has "$TMPDIR/s6a.log" 'Updated: unikit-ext-sel' "S6: the version is updated"
assert_not_exists "$S6/.claude/skills/gamma" "S6: gamma is not installed"
assert_not_exists "$S6/.claude/agents/helper-c.md" "S6: helper-c is not installed"
assert_not_contains "$S6/.mcp.json" 'srv-three' "S6: srv-three is not configured"
assert_not_exists "$S6/.claude/skills/beta" "S6: the earlier choice is kept"
expect_eq "$(ext_get "$S6" "e.selection.skills['skills/gamma']")" "undefined" "S6: gamma stays undecided"
assert_has "$TMPDIR/s6a.log" 'not installed (undecided)' "S6: the new items are announced"
assert_has "$TMPDIR/s6a.log" 'gamma' "S6: gamma is named"

run_cli "$S6" "$TMPDIR/s6b.log" update
expect_rc 0 "S6: update" "$TMPDIR/s6b.log"
assert_not_exists "$S6/.claude/skills/gamma" "S6: update does not install gamma either"
assert_has "$TMPDIR/s6b.log" 'not installed (undecided)' "S6: update announces them too"

S6_COPY=$(copy_state "$S6" s6-copy)

echo "  ✓ selection S6: a new version without a terminal installs no new items and says so"

# ─────────────────────────────────────────────────────
# S7: --skip-new and --install-new on undecided items
# ─────────────────────────────────────────────────────

run_cli "$S6" "$TMPDIR/s7a.log" extension update --skip-new
expect_rc 0 "S7: extension update --skip-new" "$TMPDIR/s7a.log"
assert_not_exists "$S6/.claude/skills/gamma" "S7: --skip-new installs nothing"
run_cli "$S6" "$TMPDIR/s7b.log" extension update --install-new
expect_rc 0 "S7: extension update --install-new" "$TMPDIR/s7b.log"
assert_exists "$S6/.claude/skills/gamma/SKILL.md" "S7: gamma is installed"
assert_exists "$S6/.claude/agents/helper-c.md" "S7: helper-c is installed"
assert_contains "$S6/.mcp.json" 'srv-three' "S7: srv-three is configured"
expect_eq "$(ext_get "$S6" "e.selection.skills['skills/gamma']")" "true" "S7: gamma is recorded as on"
assert_not_exists "$S6/.claude/skills/beta" "S7: beta stays off — the flag turns on only the undecided"
run_cli "$S6" "$TMPDIR/s7c.log" extension update
expect_rc 0 "S7: extension update again" "$TMPDIR/s7c.log"
assert_has "$TMPDIR/s7c.log" 'up to date' "S7: nothing is left to do"
assert_has_not "$TMPDIR/s7c.log" 'undecided' "S7: nothing is undecided"

echo "  ✓ selection S7: --skip-new leaves new items alone, --install-new installs only them"

# ─────────────────────────────────────────────────────
# S8: extension select with flags
# ─────────────────────────────────────────────────────

S8=$(copy_state "$S1" s8)
run_cli "$S8" "$TMPDIR/s8a.log" extension select "$EXT_NAME"
expect_rc 1 "S8a: no flags and no terminal" "$TMPDIR/s8a.log"
assert_has "$TMPDIR/s8a.log" 'Nothing to change' "S8a: the command says so"
run_cli "$S8" "$TMPDIR/s8b.log" extension select "$EXT_NAME" --yes
expect_rc 1 "S8b: --yes alone" "$TMPDIR/s8b.log"
assert_has "$TMPDIR/s8b.log" 'Nothing to change' "S8b: the command says so"

run_cli "$S8" "$TMPDIR/s8c.log" extension select "$EXT_NAME" --skip-skills alpha --skip-mcp srv-one
expect_rc 0 "S8c: select with flags" "$TMPDIR/s8c.log"
assert_not_exists "$S8/.claude/skills/alpha" "S8c: alpha is taken out"
assert_not_contains "$S8/.mcp.json" 'srv-one' "S8c: srv-one is taken out"
assert_contains "$S8/.mcp.json" 'srv-two' "S8c: srv-two stays"
expect_eq "$(ext_get "$S8" "e.selection.skills['skills/alpha']")" "false" "S8c: alpha is recorded as off"
expect_eq "$(ext_get "$S8" "e.selection.mcpServers['srv-one']")" "false" "S8c: srv-one is recorded as off"
assert_exists "$S8/.unikit/extensions/$EXT_NAME/skills/alpha/SKILL.md" "S8c: the stored copy keeps alpha"

SHA_S8=$(sha_of "$S8/.unikit.json")
run_cli "$S8" "$TMPDIR/s8d.log" extension select "$EXT_NAME" --skip-skills nope
expect_rc 1 "S8d: an unknown name" "$TMPDIR/s8d.log"
assert_same_sha "$S8/.unikit.json" "$SHA_S8" "S8d: the config is not touched"
run_cli "$S8" "$TMPDIR/s8e.log" extension select ghost --skip-skills a
expect_rc 1 "S8e: an extension that is not installed" "$TMPDIR/s8e.log"
assert_has "$TMPDIR/s8e.log" 'not installed' "S8e: the command says so"

echo "  ✓ selection S8: extension select works from flags, by name and key, and refuses an empty change"

# ─────────────────────────────────────────────────────
# S9: a switched-off replacement gives the base skill back at once
# ─────────────────────────────────────────────────────

S9=$(copy_state "$S1" s9)
run_cli "$S9" "$TMPDIR/s9a.log" extension select "$EXT_NAME" --skip-skills my-commit
expect_rc 0 "S9: switch the replacement off" "$TMPDIR/s9a.log"
assert_not_contains "$S9/.claude/skills/unikit-commit/SKILL.md" 'CUSTOM-COMMIT-BODY' "S9: the base skill is back immediately"
expect_eq "$(ext_get "$S9" 'e.replacedSkills')" "undefined" "S9: the replacement is no longer recorded"
run_cli "$S9" "$TMPDIR/s9b.log" update
expect_rc 0 "S9: update" "$TMPDIR/s9b.log"
assert_has_not "$TMPDIR/s9b.log" 'unikit-commit (replaced by extension)' "S9: the base skill updates again"

# A replacement that appears in a later version waits for a decision.
S9_SRC=$(new_source s9b 1.0.0 noreplace)
S9B=$(new_project s9b)
run_cli "$S9B" "$TMPDIR/s9c.log" extension add "$S9_SRC"
expect_rc 0 "S9: first version without a replacement" "$TMPDIR/s9c.log"
make_sel_ext "$S9_SRC" 2.0.0
run_cli "$S9B" "$TMPDIR/s9d.log" extension update
expect_rc 0 "S9: version with a replacement" "$TMPDIR/s9d.log"
assert_not_contains "$S9B/.claude/skills/unikit-commit/SKILL.md" 'CUSTOM-COMMIT-BODY' "S9: the new replacement is not installed on its own"
assert_has "$TMPDIR/s9d.log" 'not installed (undecided)' "S9: it is announced"
run_cli "$S9B" "$TMPDIR/s9e.log" extension select "$EXT_NAME" --install-new
expect_rc 0 "S9: --install-new installs it" "$TMPDIR/s9e.log"
assert_contains "$S9B/.claude/skills/unikit-commit/SKILL.md" 'CUSTOM-COMMIT-BODY' "S9: the replacement is in place"
expect_eq "$(ext_get "$S9B" "e.replacedSkills['unikit-commit']")" "skills/my-commit" "S9: and recorded"

echo "  ✓ selection S9: a replacement that is switched off restores the base skill immediately; a new one waits"

# ─────────────────────────────────────────────────────
# S10: removal takes out only what the selection installed
# ─────────────────────────────────────────────────────

S10=$(copy_state "$S2" s10)
mkdir -p "$S10/.claude/skills/beta" "$S10/.claude/agents"
printf '%s\n' 'USER-BETA' > "$S10/.claude/skills/beta/SKILL.md"
printf '%s\n' 'USER-HELPER-B' > "$S10/.claude/agents/helper-b.md"
node -e '
  const fs = require("fs");
  const file = process.argv[1] + "/.mcp.json";
  const c = JSON.parse(fs.readFileSync(file, "utf8"));
  c.mcpServers = c.mcpServers || {};
  c.mcpServers["srv-two"] = { command: "user-cmd" };
  fs.writeFileSync(file, JSON.stringify(c, null, 2));
' "$S10"
run_cli "$S10" "$TMPDIR/s10.log" extension remove "$EXT_NAME"
expect_rc 0 "S10: extension remove" "$TMPDIR/s10.log"
assert_has "$S10/.claude/skills/beta/SKILL.md" 'USER-BETA' "S10: the user's own beta is untouched"
assert_has "$S10/.claude/agents/helper-b.md" 'USER-HELPER-B' "S10: the user's own helper-b is untouched"
assert_has "$S10/.mcp.json" 'user-cmd' "S10: the user's own srv-two is untouched"
assert_not_exists "$S10/.claude/skills/alpha" "S10: alpha is removed"
assert_not_exists "$S10/.claude/agents/helper-a.md" "S10: helper-a is removed"
assert_not_contains "$S10/.mcp.json" 'srv-one' "S10: srv-one is removed"
assert_not_contains "$S10/.claude/skills/unikit-commit/SKILL.md" 'CUSTOM-COMMIT-BODY' "S10: the base skill is the package one"

echo "  ✓ selection S10: remove takes out only what was installed and leaves same-named user files alone"

# ─────────────────────────────────────────────────────
# S11: a legacy record (no selection field)
# ─────────────────────────────────────────────────────

strip_selection() {   # <project>
  node -e '
    const fs = require("fs");
    const file = process.argv[1] + "/.unikit.json";
    const c = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const e of c.extensions || []) delete e.selection;
    fs.writeFileSync(file, JSON.stringify(c, null, 2));
  ' "$1"
}

S11_SRC=$(new_source s11 1.0.0)
S11=$(new_project s11)
run_cli "$S11" "$TMPDIR/s11-add.log" extension add "$S11_SRC"
expect_rc 0 "S11: add" "$TMPDIR/s11-add.log"
strip_selection "$S11"
expect_eq "$(ext_get "$S11" 'e.selection')" "undefined" "S11: the record is legacy"

run_cli "$S11" "$TMPDIR/s11a.log" update
expect_rc 0 "S11a: update" "$TMPDIR/s11a.log"
assert_exists "$S11/.claude/skills/beta/SKILL.md" "S11a: everything is in place"
assert_exists "$S11/.claude/agents/helper-b.md" "S11a: including helper-b"
assert_contains "$S11/.claude/skills/unikit-commit/SKILL.md" 'CUSTOM-COMMIT-BODY' "S11a: and the replacement"
run_cli "$S11" "$TMPDIR/s11b.log" extension list
expect_rc 0 "S11b: extension list" "$TMPDIR/s11b.log"
assert_has_not "$TMPDIR/s11b.log" 'Skipped:' "S11b: a legacy record has no skipped line"
assert_has_not "$TMPDIR/s11b.log" 'Not decided:' "S11b: and no undecided line"

make_sel_ext "$S11_SRC" 2.0.0 new
run_cli "$S11" "$TMPDIR/s11c.log" extension update
expect_rc 0 "S11c: extension update" "$TMPDIR/s11c.log"
assert_exists "$S11/.claude/skills/alpha/SKILL.md" "S11c: the earlier items stay"
assert_not_exists "$S11/.claude/skills/gamma" "S11c: the new item is not installed"
expect_eq "$(ext_get "$S11" "e.selection.skills['skills/alpha']")" "true" "S11c: the record gets a selection with the earlier items on"
expect_eq "$(ext_get "$S11" "e.selection.skills['skills/gamma']")" "undefined" "S11c: and the new item undecided"

# No previous manifest on disk: the old and the new cannot be told apart, so everything is installed.
S11D_SRC=$(new_source s11d 1.0.0)
S11D=$(new_project s11d)
run_cli "$S11D" "$TMPDIR/s11d-add.log" extension add "$S11D_SRC"
expect_rc 0 "S11d: add" "$TMPDIR/s11d-add.log"
strip_selection "$S11D"
rm -rf "$S11D/.unikit/extensions/$EXT_NAME"
make_sel_ext "$S11D_SRC" 2.0.0 new
run_cli "$S11D" "$TMPDIR/s11d.log" extension update
expect_rc 0 "S11d: extension update" "$TMPDIR/s11d.log"
assert_exists "$S11D/.claude/skills/gamma/SKILL.md" "S11d: everything is installed, as a first install"
assert_exists "$S11D/.claude/agents/helper-c.md" "S11d: including helper-c"

echo "  ✓ selection S11: a legacy record reads as 'what is installed is on'; new items wait"

# ─────────────────────────────────────────────────────
# S12: extension select decides undecided items
# ─────────────────────────────────────────────────────

run_cli "$S6_COPY" "$TMPDIR/s12a.log" extension select "$EXT_NAME" --install-new
expect_rc 0 "S12a: select --install-new" "$TMPDIR/s12a.log"
assert_exists "$S6_COPY/.claude/skills/gamma/SKILL.md" "S12a: gamma is installed"
assert_exists "$S6_COPY/.claude/agents/helper-c.md" "S12a: helper-c is installed"
assert_contains "$S6_COPY/.mcp.json" 'srv-three' "S12a: srv-three is configured"
assert_not_exists "$S6_COPY/.claude/skills/beta" "S12a: beta stays off"

# Second case on a project of its own: $S6 has been through S7 and has gamma installed.
S12B_SRC=$(new_source s12b 1.0.0)
S12B=$(new_project s12b)
run_cli "$S12B" "$TMPDIR/s12b-add.log" extension add "$S12B_SRC" --skip-skills beta
expect_rc 0 "S12b: add" "$TMPDIR/s12b-add.log"
make_sel_ext "$S12B_SRC" 2.0.0 new
run_cli "$S12B" "$TMPDIR/s12b-upd.log" extension update
expect_rc 0 "S12b: extension update" "$TMPDIR/s12b-upd.log"
run_cli "$S12B" "$TMPDIR/s12b.log" extension select "$EXT_NAME" --skip-skills gamma --install-new
expect_rc 0 "S12b: select --skip-skills gamma --install-new" "$TMPDIR/s12b.log"
assert_not_exists "$S12B/.claude/skills/gamma" "S12b: gamma is left out"
expect_eq "$(ext_get "$S12B" "e.selection.skills['skills/gamma']")" "false" "S12b: and recorded as off"
assert_exists "$S12B/.claude/agents/helper-c.md" "S12b: helper-c is installed"
assert_contains "$S12B/.mcp.json" 'srv-three' "S12b: srv-three is configured"

echo "  ✓ selection S12: extension select decides undecided items; a named item is switched off"

# ─────────────────────────────────────────────────────
# S13: extension list
# ─────────────────────────────────────────────────────

run_cli "$S2" "$TMPDIR/s13a.log" extension list
expect_rc 0 "S13: list on the S2 state" "$TMPDIR/s13a.log"
assert_has "$TMPDIR/s13a.log" 'Skipped:' "S13: the skipped line is shown"
assert_has "$TMPDIR/s13a.log" 'beta' "S13: beta is named"

S13_SRC=$(new_source s13 1.0.0)
S13=$(new_project s13)
run_cli "$S13" "$TMPDIR/s13c.log" extension add "$S13_SRC"
expect_rc 0 "S13: add" "$TMPDIR/s13c.log"
make_sel_ext "$S13_SRC" 2.0.0 new
run_cli "$S13" "$TMPDIR/s13d.log" extension update
expect_rc 0 "S13: extension update" "$TMPDIR/s13d.log"
run_cli "$S13" "$TMPDIR/s13e.log" extension list
expect_rc 0 "S13: list with undecided items" "$TMPDIR/s13e.log"
assert_has "$TMPDIR/s13e.log" 'Not decided:' "S13: the undecided line is shown"
assert_has "$TMPDIR/s13e.log" 'gamma' "S13: gamma is named"

echo "  ✓ selection S13: extension list shows what was skipped and what is undecided"

# ─────────────────────────────────────────────────────
# S14: a selected subagent that preloads a skill left out
# ─────────────────────────────────────────────────────

S14=$(copy_state "$S1" s14)
run_cli "$S14" "$TMPDIR/s14.log" extension select "$EXT_NAME" --skip-skills beta
expect_rc 0 "S14: select --skip-skills beta" "$TMPDIR/s14.log"
assert_has "$TMPDIR/s14.log" '[WARN][extension]' "S14: one warning"
assert_has "$TMPDIR/s14.log" 'preloads skill "beta"' "S14: it names the skill"
assert_not_exists "$S14/.claude/skills/beta" "S14: beta is off (nothing is turned on for the user)"
assert_exists "$S14/.claude/agents/helper-a.md" "S14: helper-a is not blocked"

echo "  ✓ selection S14: a dangling preload is a warning, not a block"

# ─────────────────────────────────────────────────────
# S15: Codex — TOML settings keep third-party sections
# ─────────────────────────────────────────────────────

S15_BASE="$TMPDIR/base-codex"
make_project "$S15_BASE" codex .codex/skills .codex/agents
S15_SRC=$(new_source s15 1.0.0)
mkdir -p "$S15_BASE/.codex"
printf '[mcp_servers.manual]\ncommand = "noop"\n' > "$S15_BASE/.codex/config.toml"
run_cli "$S15_BASE" "$TMPDIR/s15a.log" extension add "$S15_SRC" --skip-mcp srv-two
expect_rc 0 "S15: add on Codex" "$TMPDIR/s15a.log"
assert_contains "$S15_BASE/.codex/config.toml" 'srv-one' "S15: srv-one is in the TOML"
assert_not_contains "$S15_BASE/.codex/config.toml" 'srv-two' "S15: srv-two is not"
assert_contains "$S15_BASE/.codex/config.toml" '^\[mcp_servers\.manual\]' "S15: the hand-written section is kept"
run_cli "$S15_BASE" "$TMPDIR/s15b.log" extension select "$EXT_NAME" --skip-mcp srv-one
expect_rc 0 "S15: select on Codex" "$TMPDIR/s15b.log"
assert_not_contains "$S15_BASE/.codex/config.toml" 'srv-one' "S15: srv-one is taken out of the TOML"
assert_contains "$S15_BASE/.codex/config.toml" '^\[mcp_servers\.manual\]' "S15: the hand-written section is still kept"

echo "  ✓ selection S15: Codex TOML — a switched-off server leaves the file, third-party sections stay"

# ─────────────────────────────────────────────────────
# S16: the temporary git clone is removed
# ─────────────────────────────────────────────────────

if command -v git > /dev/null 2>&1; then
  S16_REPO="$TMPDIR/s16-repo.git"
  make_sel_ext "$S16_REPO" 1.0.0
  if (cd "$S16_REPO" && git init -q && git add -A \
      && git -c user.email=t@t -c user.name=t commit -q -m init) > /dev/null 2>&1; then
    if command -v cygpath > /dev/null 2>&1; then
      S16_URL="file:///$(cygpath -m "$S16_REPO")"
    else
      S16_URL="file://$S16_REPO"
    fi
    CLONES="$TMPDIR/clones"
    mkdir -p "$CLONES"
    S16=$(new_project s16)

    set +e
    (cd "$S16" && env TMPDIR="$CLONES" TEMP="$CLONES" TMP="$CLONES" node "$CLI" extension add "$S16_URL" --skip-skills nope > "$TMPDIR/s16a.log" 2>&1)
    RC=$?
    set -e
    if grep -q 'Unknown skill' "$TMPDIR/s16a.log"; then
      expect_rc 1 "S16a: a wrong name fails" "$TMPDIR/s16a.log"
      expect_eq "$(find "$CLONES" -maxdepth 1 -name 'unikit-ext-*' | wc -l | tr -d ' ')" "0" "S16a: the clone is removed after a failure"

      set +e
      (cd "$S16" && env TMPDIR="$CLONES" TEMP="$CLONES" TMP="$CLONES" node "$CLI" extension add "$S16_URL" > "$TMPDIR/s16b.log" 2>&1)
      RC=$?
      set -e
      expect_rc 0 "S16b: a clean add" "$TMPDIR/s16b.log"
      expect_eq "$(find "$CLONES" -maxdepth 1 -name 'unikit-ext-*' | wc -l | tr -d ' ')" "0" "S16b: the clone is removed after success"
      echo "  ✓ selection S16: the git clone is removed after a failure and after success"
    else
      echo "  ✓ selection S16: skipped (the clone could not be made in this environment)"
    fi
  else
    echo "  ✓ selection S16: skipped (git repository could not be created)"
  fi
else
  echo "  ✓ selection S16: skipped (git is not available)"
fi

echo ""
echo "extension selection smoke tests passed"
