#!/usr/bin/env bash
#
# Shared test fixtures for the three bash smoke tests:
#   - scripts/test-install.sh
#   - scripts/test-update.sh
#   - scripts/test-skills.sh
#
# Everything that identifies a rule by name lives here. If the bundled
# rules-registry snapshot or the registry manifest adds/removes/renames
# a rule, change it in ONE place and every test picks it up on next run.
#
# Convention: all rule ids are in the canonical lowercase-hyphen form
# (the on-disk filename without `.md`). Append `.md` at the call site
# when a filename is needed.
#
# shellcheck disable=SC2034  # consumers source this file; vars look unused here

# ─────────────────────────────────────────────
# Engine: unity
# ─────────────────────────────────────────────

# Core rules — whitelisted set shared across all engines.
CORE_RULE_UNITY_CODE_STYLE="code-style"
CORE_RULE_UNITY_DESIGN_PRINCIPLES="design-principles"
CORE_RULE_UNITY_FOLDERS_STRUCTURE="folders-structure"
CORE_RULE_UNITY_PERFORMANCE="performance"
CORE_RULE_UNITY_TESTING="testing"

EXPECTED_CORE_RULES=(
    "$CORE_RULE_UNITY_CODE_STYLE"
    "$CORE_RULE_UNITY_DESIGN_PRINCIPLES"
    "$CORE_RULE_UNITY_FOLDERS_STRUCTURE"
    "$CORE_RULE_UNITY_PERFORMANCE"
    "$CORE_RULE_UNITY_TESTING"
)

# Stack rules — Unity snapshot in rules-registry/unity/stack.
STACK_RULE_UNITY_ASPID_MVVM="aspid-mvvm"
STACK_RULE_UNITY_IMGUI_EDITOR_TOOLS="imgui-editor-tools"
STACK_RULE_UNITY_NODE_CANVAS="node-canvas"
STACK_RULE_UNITY_ODIN="odin"
STACK_RULE_UNITY_ODIN_EDITOR_TOOLS="odin-editor-tools"
STACK_RULE_UNITY_R3="r3"
STACK_RULE_UNITY_RNGNEEDS="rngneeds"
STACK_RULE_UNITY_UNITASK="unitask"

EXPECTED_UNITY_STACK_RULES=(
    "$STACK_RULE_UNITY_ASPID_MVVM"
    "$STACK_RULE_UNITY_IMGUI_EDITOR_TOOLS"
    "$STACK_RULE_UNITY_NODE_CANVAS"
    "$STACK_RULE_UNITY_ODIN_EDITOR_TOOLS"
    "$STACK_RULE_UNITY_ODIN"
    "$STACK_RULE_UNITY_R3"
    "$STACK_RULE_UNITY_RNGNEEDS"
    "$STACK_RULE_UNITY_UNITASK"
)

# ─────────────────────────────────────────────
# Engine: godot (and godot-net — uses the same core whitelist)
# ─────────────────────────────────────────────

CORE_RULE_GODOT_CODE_STYLE="code-style"
CORE_RULE_GODOT_DESIGN_PRINCIPLES="design-principles"
CORE_RULE_GODOT_FOLDERS_STRUCTURE="folders-structure"
CORE_RULE_GODOT_PERFORMANCE="performance"
CORE_RULE_GODOT_TESTING="testing"

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

# Join an array into a JSON array of strings:
#   join_json_strings "a" "b" "c"  →  ["a","b","c"]
join_json_strings() {
    local IFS=','
    local quoted=()
    local item
    for item in "$@"; do
        quoted+=("\"$item\"")
    done
    echo "[${quoted[*]}]"
}

# Build an `installed.core` / `installed.stack` JSON array.
# Each argument becomes one entry:
#   { "name": "<rule>", "source": "registry", "version": "1.0.0", "installed_hash": "deadbeef" }
#
# Usage:
#   json_installed_entries "code-style" "design-principles"
json_installed_entries() {
    local parts=()
    local rule
    for rule in "$@"; do
        parts+=("{\"name\":\"$rule\",\"source\":\"registry\",\"version\":\"1.0.0\",\"installed_hash\":\"deadbeef\"}")
    done
    local IFS=','
    echo "[${parts[*]}]"
}

# Write a synthetic `.unikit.json` into the target project directory.
#
# Contract:
#   write_unikit_config <project_dir> <engine> <core_rules_json> <stack_rules_json> [agents_override]
#
# Where:
#   <project_dir>        absolute path to the project root
#   <engine>             engine id (unity, godot, ...)
#   <core_rules_json>    JSON array of entries (use json_installed_entries)
#   <stack_rules_json>   JSON array of entries (use json_installed_entries)
#   [agents_override]    optional raw JSON for the `agents` array; defaults
#                        to a single claude entry
#
# This is intentionally a thin helper — tests that need a very specific
# shape should fall back to a heredoc. The 15+ identical blocks in
# test-update.sh all fit this contract.
write_unikit_config() {
    local project_dir="$1"
    local engine="$2"
    local core_json="$3"
    local stack_json="$4"
    local agents_override="${5:-}"

    local agents_json
    if [[ -n "$agents_override" ]]; then
        agents_json="$agents_override"
    else
        agents_json='[{"id":"claude","installedSkills":[],"installedSubagents":[]}]'
    fi

    mkdir -p "$project_dir"
    cat > "$project_dir/.unikit.json" <<JSON
{
  "version": "1.0.0",
  "engine": "$engine",
  "agents": $agents_json,
  "rules": {
    "installed": {
      "core": $core_json,
      "stack": $stack_json
    }
  },
  "managedSkills": {}
}
JSON
}

# ─────────────────────────────────────────────
# Style A assertions (exit on failure)
# Used by test-install.sh / test-update.sh which rely on `set -e`
# aborting the run on the first failure.
# ─────────────────────────────────────────────

assert_contains() {
    local file="$1"
    local pattern="$2"
    local hint="$3"
    if ! grep -qE "$pattern" "$file"; then
        echo "Assertion failed: $hint"
        echo "Pattern: $pattern"
        echo "File: $file"
        exit 1
    fi
}

assert_not_contains() {
    local file="$1"
    local pattern="$2"
    local hint="$3"
    if grep -qE "$pattern" "$file"; then
        echo "Assertion failed: $hint"
        echo "Pattern: $pattern"
        echo "File: $file"
        echo "--- matching lines ---"
        grep -E "$pattern" "$file" | head -5
        echo "----------------------"
        exit 1
    fi
}

assert_exists() {
    local path="$1"
    local hint="$2"
    if [[ ! -e "$path" ]]; then
        echo "Assertion failed: $hint"
        echo "Missing path: $path"
        exit 1
    fi
}

assert_not_exists() {
    local path="$1"
    local hint="$2"
    if [[ -e "$path" ]]; then
        echo "Assertion failed: $hint"
        echo "Path should not exist: $path"
        exit 1
    fi
}

assert_file_content() {
    local file="$1"
    local expected="$2"
    local hint="$3"
    local actual
    actual=$(cat "$file")
    if [[ "$actual" != "$expected" ]]; then
        echo "Assertion failed: $hint"
        echo "Expected: $expected"
        echo "Actual:   $actual"
        exit 1
    fi
}

# ─────────────────────────────────────────────
# Style B counters + helpers (pass/fail)
# Each script that sources this file gets its own script-local counters
# because sourcing re-executes the initialization. Call
# `init_pass_fail_counters` at the top of a test script when you want
# counter-based reporting without inheriting counters from a dependency.
# ─────────────────────────────────────────────

init_pass_fail_counters() {
    PASSED=0
    FAILED=0
    TOTAL=0
}

init_pass_fail_counters

# Build the TypeScript sources unless a parent test runner already did so.
# Call this at the top of any script that needs `dist/cli/index.js` to be
# current. The parent runner sets `UNIKIT_TEST_SKIP_BUILD=1` after its
# own build completes so nested test scripts reuse the freshly-compiled
# artifacts instead of rebuilding N times in a row. Setting the env var
# externally (e.g. in a watch mode) also works.
ensure_build() {
    if [[ "${UNIKIT_TEST_SKIP_BUILD:-0}" == "1" ]]; then
        return 0
    fi
    (cd "$ROOT_DIR" && npm run build > /dev/null 2>&1)
}

# ANSI color codes reused by pass/fail. Safe to re-export if a script
# defined its own variant — `declare -r` is avoided so the script can
# override colors or disable them.
RED="${RED:-\033[0;31m}"
GREEN="${GREEN:-\033[0;32m}"
YELLOW="${YELLOW:-\033[1;33m}"
BOLD="${BOLD:-\033[1m}"
NC="${NC:-\033[0m}"

pass() {
    PASSED=$((PASSED + 1))
    TOTAL=$((TOTAL + 1))
    echo -e "  ${GREEN}✓${NC} $1"
}

fail() {
    FAILED=$((FAILED + 1))
    TOTAL=$((TOTAL + 1))
    echo -e "  ${RED}✗${NC} $1"
}

# Summary + exit wrapper. Call at the end of a Style B script to print
# counts and exit non-zero when any assertion failed.
#
#   print_summary_and_exit "rules list Smoke Tests"
print_summary_and_exit() {
    local label="${1:-Smoke Tests}"
    echo -e "\n${BOLD}=== Results (${label}) ===${NC}"
    echo -e "  Total:    $TOTAL"
    echo -e "  Passed:   ${GREEN}$PASSED${NC}"
    echo -e "  Failed:   ${RED}$FAILED${NC}"
    if [[ $FAILED -gt 0 ]]; then
        echo -e "\n${RED}${label} FAILED${NC}\n"
        exit 1
    fi
    echo -e "\n${GREEN}${label} PASSED${NC}\n"
    exit 0
}

# ─────────────────────────────────────────────
# seed_rule: copy a rule file from the bundled registry snapshot into a
# test project's .unikit/memory/. Used by test-install.sh / test-update.sh
# to exercise syncRulesState's Phase 1 disk-reconciliation path.
#
# Usage:
#   seed_rule <project_dir> <engine> <core|stack> <rule_basename>
#
# The source root defaults to $ROOT_DIR/rules-registry but can be
# overridden by exporting SEED_RULE_SOURCE_ROOT — useful when seeding
# from a fake fixture under scripts/test-fixtures/.
# ─────────────────────────────────────────────

seed_rule() {
    local project="$1"
    local engine="$2"
    local category="$3"
    local rule="$4"
    local source_root="${SEED_RULE_SOURCE_ROOT:-$ROOT_DIR/rules-registry}"
    local src="$source_root/$engine/$category/$rule.md"
    local dest_dir="$project/.unikit/memory/$category"
    mkdir -p "$dest_dir"
    if [[ -f "$src" ]]; then
        cp "$src" "$dest_dir/$rule.md"
    else
        echo "seed_rule: source rule $src is missing; test setup is broken" >&2
        exit 1
    fi
}

# ─────────────────────────────────────────────
# Task 4 — fake-registry + exit-code helpers
# ─────────────────────────────────────────────

# Normalize a bash/POSIX path to a form Node.js can resolve on both Linux
# and Windows (Git Bash). On Git Bash `cygpath -m` converts POSIX paths
# (/d/GameDev/...) to mixed-slash form (D:/GameDev/...) that:
#   - passes `path.isAbsolute` on Windows
#   - survives `path.normalize` without being mistaken for a drive-root
#     path like \d\GameDev\...
#   - stays valid JSON without backslash-escaping
# On Linux (no cygpath) the path is already POSIX-native and returned as is.
normalize_path_for_json() {
    local p="$1"
    if command -v cygpath > /dev/null 2>&1; then
        cygpath -m "$p"
    else
        echo "$p"
    fi
}

# Resolve a fake-registry fixture name to its absolute path. The fixture
# tree lives under `scripts/test-fixtures/<name>/` and ships a root
# manifest.json plus at least one engine subdirectory.
#
#   fake_registry_path minimal-valid
#   → <ROOT_DIR>/scripts/test-fixtures/minimal-valid (Node-resolvable form)
fake_registry_path() {
    local name="$1"
    normalize_path_for_json "$ROOT_DIR/scripts/test-fixtures/$name"
}

# use_fake_registry <project_dir> <engine> <fixture_name> [agents_override]
#
# Creates a minimal .unikit.json inside <project_dir> with:
#   - engine pinned to <engine>
#   - rules.installed.core / stack empty
#   - rulesRegistry pointing at the fixture fake registry
#   - .unikit/memory/{core,stack} created
#
# The fixture path is written verbatim so FsRegistry picks it as the
# primary registry source. Tests that need a seeded state entry should
# chain `use_fake_registry` with `write_unikit_config` or the raw
# `.unikit.json` overwrite used by test-rules-registry-switch.sh.
use_fake_registry() {
    local project_dir="$1"
    local engine="$2"
    local fixture_name="$3"
    local agents_override="${4:-}"

    local fixture_path
    fixture_path="$(fake_registry_path "$fixture_name")"
    if [[ ! -f "$fixture_path/manifest.json" ]]; then
        echo "use_fake_registry: fixture '$fixture_name' missing manifest.json at $fixture_path" >&2
        exit 1
    fi

    local agents_json
    if [[ -n "$agents_override" ]]; then
        agents_json="$agents_override"
    else
        agents_json='[{"id":"claude","installedSkills":[],"installedSubagents":[]}]'
    fi

    mkdir -p "$project_dir/.unikit/memory/core" "$project_dir/.unikit/memory/stack"
    cat > "$project_dir/.unikit.json" <<JSON
{
  "version": "1.0.0",
  "engine": "$engine",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": $agents_json,
  "rulesRegistry": "$fixture_path",
  "rules": {
    "installed": {
      "version": "1.0.0",
      "core": [],
      "stack": []
    }
  },
  "managedSkills": {}
}
JSON
}

# assert_exit <expected> <actual> <label> [<log_file>]
# Reports pass/fail on a captured exit code and dumps the log on failure.
assert_exit() {
    local expected="$1"
    local actual="$2"
    local label="$3"
    local log_file="${4:-}"
    if [[ "$actual" == "$expected" ]]; then
        pass "$label (exit $expected)"
    else
        fail "$label: expected exit $expected, got $actual"
        if [[ -n "$log_file" && -f "$log_file" ]]; then
            echo "--- log: $log_file ---"
            cat "$log_file"
            echo "----------------------"
        fi
    fi
}

# assert_cmd_exit <expected> <label> <log_file> -- <cmd...>
# Runs <cmd...> with stdout/stderr captured to <log_file>, then asserts
# the exit code equals <expected>. The `--` separator is literal so the
# helper can spot the boundary between the label/log args and the
# command argv. Example:
#   assert_cmd_exit 0 "rules list runs" "$TMPDIR/s.log" -- \
#     node "$CLI" rules list
assert_cmd_exit() {
    local expected="$1"
    local label="$2"
    local log_file="$3"
    local separator="${4:-}"
    if [[ "$separator" != "--" ]]; then
        echo "assert_cmd_exit: missing '--' separator before command argv" >&2
        exit 1
    fi
    shift 4
    set +e
    "$@" > "$log_file" 2>&1
    local code=$?
    set -e
    assert_exit "$expected" "$code" "$label" "$log_file"
}

# capture_stdout_exit <out_file> <cmd...>
# Runs <cmd...>, captures stdout+stderr to <out_file>, returns the exit
# code via $CAPTURED_EXIT. Callers then read $CAPTURED_EXIT for branching.
capture_stdout_exit() {
    local out_file="$1"
    shift
    set +e
    "$@" > "$out_file" 2>&1
    CAPTURED_EXIT=$?
    set -e
}

# ─────────────────────────────────────────────
# Task 5 — JSON assertions (node-based with optional jq fast-path)
# ─────────────────────────────────────────────

# Prefer jq when available — it is ~10x faster on small files and keeps
# the assertion scripts readable. Fall back to `node -e` otherwise,
# matching the style used by test-rules-registry-switch.sh's json_field
# helper. The fixtures file does NOT declare jq a required dependency.
HAS_JQ=""
_detect_jq() {
    if [[ -n "$HAS_JQ" ]]; then return; fi
    if command -v jq > /dev/null 2>&1; then
        HAS_JQ="yes"
    else
        HAS_JQ="no"
    fi
}

# Convert a dotted field path (node-fallback shape) into jq-compatible syntax:
#   rules.0.id                     -> rules[0].id
#   rules.installed.core.0.name    -> rules.installed.core[0].name
#   rules.1                        -> rules[1]
# jq rejects bare numeric identifiers (`.rules.0.id` is a syntax error); it needs
# `.rules[0].id` for array access. Node-fallback uses `obj[p]` which works with
# string "0" on arrays, so the call-sites can keep the dotted shape everywhere.
_to_jq_path() {
    echo "$1" | sed -E 's/\.([0-9]+)(\.|$)/[\1]\2/g'
}

# assert_json_field <json_file> <dot.path> <expected> <label>
# Extracts a field from a JSON file using jq (when available) or node -e
# (fallback), compares to <expected>, and reports pass/fail.
#
#   assert_json_field $TMPDIR/status.json registryKind local "kind is local"
assert_json_field() {
    local json_file="$1"
    local field_path="$2"
    local expected="$3"
    local label="$4"

    _detect_jq
    local actual
    if [[ "$HAS_JQ" == "yes" ]]; then
        local jq_path
        jq_path=$(_to_jq_path "$field_path")
        actual=$(jq -r ".${jq_path}" "$json_file" 2> /dev/null || echo "__JQ_ERR__")
    else
        actual=$(node -e "
            let d='';
            process.stdin.on('data', c => d += c);
            process.stdin.on('end', () => {
                try {
                    const j = JSON.parse(d);
                    const parts = process.argv[1].split('.');
                    let v = j;
                    for (const p of parts) {
                        if (v == null) { v = undefined; break; }
                        v = v[p];
                    }
                    console.log(v === null ? 'null' : v === undefined ? '__MISSING__' : String(v));
                } catch (e) {
                    console.log('__PARSE_ERR__ ' + e.message);
                }
            });
        " "$field_path" < "$json_file")
    fi

    if [[ "$actual" == "$expected" ]]; then
        pass "$label ($field_path=$expected)"
    else
        fail "$label: expected $field_path=$expected, got '$actual'"
        echo "--- $json_file ---"
        cat "$json_file"
        echo "------------------"
    fi
}

# assert_json_array_length <json_file> <dot.path> <expected_length> <label>
assert_json_array_length() {
    local json_file="$1"
    local field_path="$2"
    local expected="$3"
    local label="$4"

    _detect_jq
    local actual
    if [[ "$HAS_JQ" == "yes" ]]; then
        local jq_path
        jq_path=$(_to_jq_path "$field_path")
        actual=$(jq -r ".${jq_path} | length" "$json_file" 2> /dev/null || echo "__JQ_ERR__")
    else
        actual=$(node -e "
            let d='';
            process.stdin.on('data', c => d += c);
            process.stdin.on('end', () => {
                try {
                    const j = JSON.parse(d);
                    const parts = process.argv[1].split('.');
                    let v = j;
                    for (const p of parts) {
                        if (v == null) { v = undefined; break; }
                        v = v[p];
                    }
                    if (!Array.isArray(v)) {
                        console.log('__NOT_ARRAY__');
                    } else {
                        console.log(v.length);
                    }
                } catch (e) {
                    console.log('__PARSE_ERR__ ' + e.message);
                }
            });
        " "$field_path" < "$json_file")
    fi

    if [[ "$actual" == "$expected" ]]; then
        pass "$label (${field_path}.length=$expected)"
    else
        fail "$label: expected ${field_path}.length=$expected, got '$actual'"
    fi
}

# ─────────────────────────────────────────────
# Task 6 — stdout + file hash helpers
# ─────────────────────────────────────────────

# assert_stdout_contains <file> <pattern> <label>
# Substring (fixed-string) search through <file>; dumps the file on
# failure. Use `grep -E` upstream if you need regex semantics.
assert_stdout_contains() {
    local file="$1"
    local pattern="$2"
    local label="$3"
    if grep -qF -- "$pattern" "$file"; then
        pass "$label"
    else
        fail "$label: pattern '$pattern' not found in $file"
        echo "--- $file ---"
        cat "$file"
        echo "-------------"
    fi
}

# sha_of <file>
# Print the lowercase sha256 hex of a file's contents. Works on Git Bash
# (sha256sum) and macOS (shasum -a 256), with a node -e fallback for
# minimal CI images.
sha_of() {
    local file="$1"
    if command -v sha256sum > /dev/null 2>&1; then
        sha256sum "$file" | awk '{ print $1 }'
    elif command -v shasum > /dev/null 2>&1; then
        shasum -a 256 "$file" | awk '{ print $1 }'
    else
        node -e "
            const crypto = require('crypto');
            const fs = require('fs');
            const buf = fs.readFileSync(process.argv[1]);
            console.log(crypto.createHash('sha256').update(buf).digest('hex'));
        " "$file"
    fi
}

# assert_file_unchanged <file> <saved_hash> <label>
# Re-computes sha_of(file) and compares it to a previously captured
# hash. Used by regression guards that must prove a command left a file
# byte-identical (e.g. `rules registry set` must NOT rewrite rule files).
assert_file_unchanged() {
    local file="$1"
    local saved_hash="$2"
    local label="$3"
    if [[ ! -f "$file" ]]; then
        fail "$label: file $file disappeared"
        return
    fi
    local current_hash
    current_hash="$(sha_of "$file")"
    if [[ "$current_hash" == "$saved_hash" ]]; then
        pass "$label"
    else
        fail "$label: file $file changed (was $saved_hash, now $current_hash)"
    fi
}
