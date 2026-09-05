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

# Core rules — full core-tier set shared across all engines.
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
# Engine: godot (and godot-net — uses the same core-tier set)
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
      "version": "1.0.0",
      "modules": {
        "code": {
          "core": $core_json,
          "stack": $stack_json
        }
      }
    }
  },
  "managedSkills": {}
}
JSON
}

# Build a `genres.installed` JSON array. Each argument is a profile id and
# becomes `{ "id": "<id>", "version": 1 }`:
#   json_genre_entries "tycoon" "match3"  →  [{"id":"tycoon","version":1},{"id":"match3","version":1}]
json_genre_entries() {
    local parts=()
    local id
    for id in "$@"; do
        parts+=("{\"id\":\"$id\",\"version\":1}")
    done
    local IFS=','
    echo "[${parts[*]}]"
}

# Write a synthetic, registry-free `.unikit.json` carrying a `genres.installed`
# list. Distinct from `write_unikit_config`: genres are ORTHOGONAL to knowledge
# modules — `config.genres.installed` is a flat id list, NOT
# `rules.installed.modules.gamedesign`. The intentional `_genres` suffix (not
# `_gamedesign`) marks that orthogonality.
#
# Contract:
#   write_unikit_config_genres <project_dir> <engine> [genres_installed_json]
#
#   <genres_installed_json>  JSON array (use json_genre_entries); default `[]`.
write_unikit_config_genres() {
    local project_dir="$1"
    local engine="$2"
    local genres_json="${3:-[]}"

    mkdir -p "$project_dir"
    cat > "$project_dir/.unikit.json" <<JSON
{
  "version": "$(current_project_version)",
  "engine": "$engine",
  "engineMcpKey": null,
  "mcp": { "servers": {} },
  "agents": [{"id":"claude","installedSkills":[],"installedSubagents":[]}],
  "rules": {
    "installed": {
      "version": "1.1.0",
      "modules": {}
    }
  },
  "genres": {
    "installed": $genres_json
  }
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

# ─────────────────────────────────────────────
# Failure diagnostics for the engine-MCP surface
# ─────────────────────────────────────────────
# Dumps the two states no assertion message can carry: what the engine-mcp tree actually
# holds, and which findings-log files exist. `Missing path: .../INDEX.md` cannot tell an
# empty tree from a partially delivered one from a file delivered under another name, and
# the temp projects are removed by the very next line of the trap that calls this — so a
# failing run has exactly one moment in which the evidence still exists.
#
# Driven by what is on disk rather than by a variable each test has to remember to set:
# bookkeeping that must be kept in sync is bookkeeping that goes stale without failing.
# The ABSENCE branches print too — half the diagnoses here are "the directory was never
# created", and a silent dump would be indistinguishable from a dump that found nothing
# because it looked in the wrong place.
dump_mcp_state() {
    local root="$1" found entry
    [[ -d "$root" ]] || return 0

    found=0
    while IFS= read -r entry; do
        [[ -n "$entry" ]] || continue
        found=1
        echo "--- engine-mcp tree: ${entry#"$root"/} ---"
        ls -la "$entry" 2>&1 || true
    done < <(find "$root" -type d -name engine-mcp 2>/dev/null || true)
    [[ $found -eq 1 ]] || echo "--- engine-mcp tree: none under the test root (absence is half the diagnosis) ---"

    found=0
    while IFS= read -r entry; do
        [[ -n "$entry" ]] || continue
        found=1
        echo "--- findings log: ${entry#"$root"/} ---"
    done < <(find "$root" -name 'MCP-RECHECK-NOTES*' 2>/dev/null || true)
    [[ $found -eq 1 ]] || echo "--- findings log: no MCP-RECHECK-NOTES* file under the test root ---"
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
    # schema:2 sources nest engines under code/<engine>/<tier>/; legacy schema:1
    # sources keep the flat <engine>/<tier>/ layout. Prefer the schema:2 path and
    # fall back to flat so both the bundled snapshot and schema:1 fixtures work.
    local src="$source_root/code/$engine/$category/$rule.md"
    if [[ ! -f "$src" ]]; then
        src="$source_root/$engine/$category/$rule.md"
    fi
    local dest_dir="$project/.unikit/memory/code/$category"
    mkdir -p "$dest_dir"
    if [[ -f "$src" ]]; then
        cp "$src" "$dest_dir/$rule.md"
    else
        echo "seed_rule: source rule for $engine/$category/$rule not found under $source_root (tried code/ and flat); test setup is broken" >&2
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

# ─────────────────────────────────────────────
# Hermetic `official` registry level
# ─────────────────────────────────────────────
# Every CLI invocation builds a registry chain whose `official` level is a
# GitRegistry pointed at raw.githubusercontent.com, so an un-redirected `update`
# or `rules *` makes a live HTTP round-trip — ~0.8s each on a good link and up
# to the 10s fetch timeout on a bad one. A full run makes hundreds of those
# calls: the network was by far the largest single cost in `npm test`, and a
# green run silently depended on GitHub being reachable.
#
# Point the level at `test-fixtures/offline-official/` — a manifest that is
# VALID but carries no modules. The official level then resolves instantly and
# contributes nothing, so every chain falls through to the bundled snapshot,
# which is the offline path every fixture-based expectation is already written
# against. (The per-scenario `DEAD_OFFICIAL` overrides scattered through the
# rules tests are the same trick applied one call at a time; they still set
# their own value and still win.) A valid-but-empty manifest is used rather
# than a non-existent path on purpose: a missing manifest makes FsRegistry emit
# `[WARN] manifest not found` on stderr, and `assert_cmd_exit` folds stderr into
# the same log the `--json` asserts parse — the warning would break them.
#
# An externally exported value also wins, so a deliberate live-network run stays
# one variable away:
#   UNIKIT_OFFICIAL_REGISTRY_URL=https://raw.githubusercontent.com/NintendaDev/unikit-ai-rules/main npm test
if [[ -z "${UNIKIT_OFFICIAL_REGISTRY_URL:-}" ]]; then
    _UNIKIT_FIXTURES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/test-fixtures"
    UNIKIT_OFFICIAL_REGISTRY_URL="$(normalize_path_for_json "$_UNIKIT_FIXTURES_DIR/offline-official")"
    export UNIKIT_OFFICIAL_REGISTRY_URL
    unset _UNIKIT_FIXTURES_DIR
fi

# Resolve a fake-registry fixture name to its absolute path. The fixture
# tree lives under `scripts/test-fixtures/<name>/` and ships a root
# manifest.json plus at least one engine subdirectory.
#
#   fake_registry_path minimal-valid
#   → <ROOT_DIR>/scripts/test-fixtures/minimal-valid (Node-resolvable form)
# The `version` a fixture stamps when it means "a current, fully migrated
# project". Read from package.json rather than pinned to a literal: the
# migration chain's version half compares this against each step's `since`, so
# a hardcoded number silently turns every release that ships a migration into a
# project that "never ran update" — and every `rules sync` / `rules install`
# fixture into an exit 8. Fixtures that must look OLD (use_unmigrated_registry)
# keep an explicit old literal; that is the one place a number belongs.
current_project_version() {
    # `cd` first: $ROOT_DIR is an MSYS path under Git Bash, and Windows node
    # cannot `require` it verbatim.
    (cd "$ROOT_DIR" && node -p "require('./package.json').version" 2>/dev/null) || echo "1.1.0"
}

fake_registry_path() {
    local name="$1"
    normalize_path_for_json "$ROOT_DIR/scripts/test-fixtures/$name"
}

fake_mcp_catalog_path() {
    local name="$1"
    normalize_path_for_json "$ROOT_DIR/scripts/test-fixtures/mcp/$name"
}

# use_fake_mcp_catalog <fixture_name>
#
# Exports UNIKIT_MCP_DIR at the fixture catalog so the installer discovers fixture
# servers rather than the shipped ones. Behaviour tests of the installer use this;
# the STRUCTURE of the shipped catalog stays the object of Part 5 / 5b / 7e3, which
# read `mcp/` directly. Callers that need the shipped catalog back call
# `unuse_fake_mcp_catalog` — the variable is process-wide, not per-project.
#
# Deliberately NOT exported suite-wide, unlike UNIKIT_OFFICIAL_REGISTRY_URL: that one
# is redirected everywhere because no test wants a live network round-trip, while the
# MCP catalog is wanted REAL by almost every test. This one switches on for a named
# scenario and off again immediately after. Do not add a suite-wide export by analogy.
use_fake_mcp_catalog() {
    local fixture_name="$1"
    local fixture_path
    fixture_path="$(fake_mcp_catalog_path "$fixture_name")"
    if [[ ! -d "$fixture_path" ]]; then
        echo "use_fake_mcp_catalog: fixture '$fixture_name' missing at $fixture_path" >&2
        exit 1
    fi
    export UNIKIT_MCP_DIR="$fixture_path"
}

unuse_fake_mcp_catalog() {
    unset UNIKIT_MCP_DIR
}

# use_fake_registry <project_dir> <engine> <fixture_name> [agents_override]
#
# Creates a minimal .unikit.json inside <project_dir> with:
#   - engine pinned to <engine>
#   - rules.installed.modules.code.core / stack empty
#   - rulesRegistry pointing at the fixture fake registry
#   - .unikit/memory/code/{core,stack} created
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

    mkdir -p "$project_dir/.unikit/memory/code/core" "$project_dir/.unikit/memory/code/stack"
    cat > "$project_dir/.unikit.json" <<JSON
{
  "version": "$(current_project_version)",
  "engine": "$engine",
  "engineMcpKey": null,
  "mcp": { "servers": {} },
  "agents": $agents_json,
  "rulesRegistry": "$fixture_path",
  "rules": {
    "installed": {
      "version": "1.0.0",
      "modules": {
        "code": {
          "core": [],
          "stack": []
        }
      }
    }
  },
  "managedSkills": {}
}
JSON
}

# use_unmigrated_registry <project_dir> <engine> <fixture_name>
#
# Like `use_fake_registry`, but seeds a project that PREDATES the modular
# memory migration — the exact shape the exit-8 staleness guard refuses on:
#   - legacy flat layout `.unikit/memory/{core,stack}` (NO `memory/code/`),
#     so the project memory migration chain still reports pending work
#     (diskPending);
#   - top-level `version: "1.0.1"` (< MEMORY_MODULAR_MIN_VERSION), so the
#     version signal also fires (versionStale);
#   - `rules.installed.modules.code.core` lists `code-style` with a real file
#     on disk under the flat `memory/core/`, so a wipe (sync reconciling
#     against the empty `memory/code/`) would be observable in state.
#
# A project in this state must make `rules sync` / `rules install` exit 8 and
# leave `.unikit.json` byte-for-byte unchanged.
use_unmigrated_registry() {
    local project_dir="$1"
    local engine="$2"
    local fixture_name="$3"

    local fixture_path
    fixture_path="$(fake_registry_path "$fixture_name")"
    if [[ ! -f "$fixture_path/manifest.json" ]]; then
        echo "use_unmigrated_registry: fixture '$fixture_name' missing manifest.json at $fixture_path" >&2
        exit 1
    fi

    # Legacy flat layout — deliberately NO memory/code/ wrapper.
    mkdir -p "$project_dir/.unikit/memory/core" "$project_dir/.unikit/memory/stack"
    cat > "$project_dir/.unikit/memory/core/code-style.md" <<'MD'
# code-style

> **Scope**: project
> **Load when**: writing code in an un-migrated project fixture.
MD

    cat > "$project_dir/.unikit.json" <<JSON
{
  "version": "1.0.1",
  "engine": "$engine",
  "engineMcpKey": null,
  "mcp": { "servers": {} },
  "agents": [{"id":"claude","installedSkills":[],"installedSubagents":[]}],
  "rulesRegistry": "$fixture_path",
  "rules": {
    "installed": {
      "version": "1.0.1",
      "modules": {
        "code": {
          "core": [
            { "name": "code-style", "source": "registry", "origin": "primary", "version": "1.0.0", "installed_hash": "deadbeef" }
          ],
          "stack": []
        }
      }
    }
  },
  "managedSkills": {}
}
JSON
}

# inject_fake_registry <project_dir> [fixture_name]
#
# Merges `rulesRegistry: "<fake-fixture-path>"` into an existing
# `<project_dir>/.unikit.json`. Unlike `use_fake_registry`, this helper
# does NOT create the config from scratch — it assumes the caller (e.g.
# a smoke-test heredoc) already wrote `.unikit.json`.
#
# Default fixture is `minimal-valid`. The fixture path is resolved via
# `fake_registry_path` so it gets the same cygpath-mixed-slash treatment
# and passes Node.js path validation on Git Bash / WSL.
#
# Point: reroutes `GitRegistry` fetches to the local fixture, removing
# `raw.githubusercontent.com/NintendaDev/unikit-ai-rules` from the smoke
# hot-path. This makes smoke tests offline-hermetic without touching src/.
inject_fake_registry() {
    local project_dir="$1"
    local fixture_name="${2:-minimal-valid}"

    local config_file="$project_dir/.unikit.json"
    if [[ ! -f "$config_file" ]]; then
        echo "inject_fake_registry: $config_file does not exist (call after the .unikit.json heredoc)" >&2
        exit 1
    fi

    local fixture_path
    fixture_path="$(fake_registry_path "$fixture_name")"
    if [[ ! -f "$fixture_path/manifest.json" ]]; then
        echo "inject_fake_registry: fixture '$fixture_name' missing manifest.json at $fixture_path" >&2
        exit 1
    fi

    CONFIG="$config_file" FIXTURE="$fixture_path" node -e "
        const fs = require('fs');
        const file = process.env.CONFIG;
        const c = JSON.parse(fs.readFileSync(file, 'utf8'));
        c.rulesRegistry = process.env.FIXTURE;
        fs.writeFileSync(file, JSON.stringify(c, null, 2));
    "
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
#   rules.installed.modules.code.core.0.name    -> rules.installed.modules.code.core[0].name
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
