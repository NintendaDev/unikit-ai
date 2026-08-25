#!/bin/bash
# Test suite: validates all unikit skills
# Usage: ./scripts/test-skills.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure the bundled rules snapshot exists (rules-registry/ is not tracked in
# git; it is cloned on demand by scripts/download-rules.sh).
if [ ! -f "$ROOT_DIR/rules-registry/manifest.json" ]; then
  bash "$SCRIPT_DIR/download-rules.sh"
fi

# Shared fixtures — rule-id source of truth. Adds: EXPECTED_CORE_RULES,
# EXPECTED_UNITY_STACK_RULES (canonical lowercase-hyphen ids without .md).
# shellcheck source=./test-fixtures.sh
source "$SCRIPT_DIR/test-fixtures.sh"

# Build once at the top of the chain, then tell every nested test
# script to reuse the compiled output. Children call `ensure_build`
# which is a no-op when this variable is set.
ensure_build
export UNIKIT_TEST_SKIP_BUILD=1

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0
TOTAL=0

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

warn() {
    WARNINGS=$((WARNINGS + 1))
    echo -e "    ${YELLOW}WARNING:${NC} $1"
}

# Helper: validate JSON file using node (pass path as argv to avoid shell escaping issues)
validate_json() {
    node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$1" 2>/dev/null
}

json_field() {
    node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log($2)" "$1" 2>/dev/null
}

# Compute YAML frontmatter `description:` length after folding continuation
# lines into a single string (matches Codex CLI's parser, which rejects
# descriptions exceeding 1024 characters).
skill_description_length() {
    node -e "
        const fs = require('fs');
        const c = fs.readFileSync(process.argv[1], 'utf8');
        const m = c.match(/^---\n([\\s\\S]*?)\n---/);
        if (!m) { console.log(0); process.exit(0); }
        const lines = m[1].split('\n');
        let desc = '';
        let inDesc = false;
        for (const line of lines) {
            if (!inDesc && /^description:/.test(line)) {
                inDesc = true;
                const tail = line.replace(/^description:\\s*(?:>-?|>|\\|-?|\\|)?\\s*/, '').trim();
                if (tail) desc = tail;
                continue;
            }
            if (inDesc) {
                if (/^[a-zA-Z][a-zA-Z0-9_-]*:/.test(line)) break;
                desc += (desc ? ' ' : '') + line.trim();
            }
        }
        console.log(desc.trim().length);
    " "$1" 2>/dev/null
}

# ─────────────────────────────────────────────
# Part 1: Validate all skills
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== Validate all skills ===${NC}\n"

for skill_dir in "$ROOT_DIR"/skills/*/; do
    skill_name=$(basename "$skill_dir")

    # Only validate unikit-* skills (and unikit itself)
    if [[ "$skill_name" != "unikit" && "$skill_name" != unikit-* ]]; then
        continue
    fi

    SKILL_FILE="$skill_dir/SKILL.md"
    SKILL_ERRORS=0

    # Check SKILL.md exists
    if [[ ! -f "$SKILL_FILE" ]]; then
        fail "$skill_name — missing SKILL.md"
        continue
    fi

    # Extract frontmatter (between first two ---)
    FRONTMATTER=$(sed -n '/^---$/,/^---$/p' "$SKILL_FILE" | sed '1d;$d')

    # Check name field exists
    FM_NAME=$(echo "$FRONTMATTER" | grep -E '^name:' | head -1 | sed 's/^name:[[:space:]]*//')
    if [[ -z "$FM_NAME" ]]; then
        fail "$skill_name — missing 'name' in frontmatter"
        continue
    fi

    # Check name matches directory
    if [[ "$FM_NAME" != "$skill_name" ]]; then
        fail "$skill_name — name '$FM_NAME' does not match directory '$skill_name'"
        SKILL_ERRORS=$((SKILL_ERRORS + 1))
    fi

    # Check description field exists
    FM_DESC=$(echo "$FRONTMATTER" | grep -E '^description:' | head -1)
    if [[ -z "$FM_DESC" ]]; then
        fail "$skill_name — missing 'description' in frontmatter"
        SKILL_ERRORS=$((SKILL_ERRORS + 1))
    else
        # Codex CLI rejects skills whose description exceeds 1024 characters
        # (folded-scalar continuation lines are concatenated with single spaces).
        DESC_LEN=$(skill_description_length "$SKILL_FILE")
        if [[ "$DESC_LEN" -gt 1024 ]]; then
            fail "$skill_name — description length $DESC_LEN exceeds 1024 chars (Codex CLI limit)"
            SKILL_ERRORS=$((SKILL_ERRORS + 1))
        fi
    fi

    # Check name is lowercase with hyphens only
    if [[ "$FM_NAME" =~ [A-Z] ]]; then
        fail "$skill_name — name contains uppercase characters"
        SKILL_ERRORS=$((SKILL_ERRORS + 1))
    fi

    # Check no dots in name
    if [[ "$FM_NAME" == *.* ]]; then
        fail "$skill_name — name contains dots"
        SKILL_ERRORS=$((SKILL_ERRORS + 1))
    fi

    # Check no consecutive hyphens
    if [[ "$FM_NAME" == *--* ]]; then
        fail "$skill_name — name contains consecutive hyphens"
        SKILL_ERRORS=$((SKILL_ERRORS + 1))
    fi

    # Check SKILL.md has content after frontmatter (not just metadata)
    BODY_LINES=$(awk '/^---$/{n++; next} n>=2' "$SKILL_FILE" | grep -c '[^[:space:]]' || true)
    if [[ "$BODY_LINES" -lt 5 ]]; then
        warn "$skill_name — SKILL.md body has only $BODY_LINES non-empty lines"
    fi

    if [[ $SKILL_ERRORS -eq 0 ]]; then
        pass "$skill_name"
    fi
done

# ─────────────────────────────────────────────
# Part 2: Validate subagents
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== Validate subagents ===${NC}\n"

EXPECTED_AGENTS=(
    "unikit-architecture-sidecar.md"
    "unikit-commit-sidecar.md"
    "unikit-docs-sidecar.md"
    "unikit-implement-coordinator.md"
    "unikit-implement-worker.md"
    "unikit-plan-coordinator.md"
    "unikit-plan-polisher.md"
    "unikit-review-sidecar.md"
)

for agent_file in "${EXPECTED_AGENTS[@]}"; do
    agent_path="$ROOT_DIR/subagents/$agent_file"
    agent_name="${agent_file%.md}"

    if [[ ! -f "$agent_path" ]]; then
        fail "$agent_name — missing $agent_file"
        continue
    fi

    # Check file is not empty
    if [[ ! -s "$agent_path" ]]; then
        fail "$agent_name — file is empty"
        continue
    fi

    # Check has frontmatter
    if ! head -1 "$agent_path" | grep -q '^---$'; then
        fail "$agent_name — missing frontmatter"
        continue
    fi

    # Check frontmatter name matches filename (without .md)
    AGENT_FM=$(sed -n '/^---$/,/^---$/p' "$agent_path" | sed '1d;$d')
    AGENT_FM_NAME=$(echo "$AGENT_FM" | grep -E '^name:' | head -1 | sed 's/^name:[[:space:]]*//')
    if [[ -n "$AGENT_FM_NAME" && "$AGENT_FM_NAME" != "$agent_name" ]]; then
        fail "$agent_name — frontmatter name '$AGENT_FM_NAME' does not match filename '$agent_name'"
        continue
    fi

    pass "$agent_name"
done

# ─────────────────────────────────────────────
# Part 2a: Validate delegation-alias connectivity
# ─────────────────────────────────────────────
# Every `*-agent` token referenced in the body of a skill that carries a
# `## Delegation agents` section MUST be defined in that section. This ensures aliases are
# not drift-prone — if a narrative mentions `docs-agent`, that alias must be declared.
#
# A skill that names an alias only to FORBID it (`unikit-improve`, `unikit-plan` on
# `develop-agent`) still owes the reader a lookup: the alias is recorded in that skill's
# section as not-used-here. The guard's contract is "mentioned in the section", which is
# what the awk already measures — no exemption shape is introduced.
echo -e "\n${BOLD}=== Validate delegation-alias connectivity ===${NC}\n"

DELEGATION_SKILLS=(
    "unikit-implement" "unikit-fix" "unikit-verify"
    "unikit-docs" "unikit-explore" "unikit-improve" "unikit-plan" "unikit-review"
    "unikit-gd-explore" "unikit-gd-recon" "unikit-gd-review"
)

for skill in "${DELEGATION_SKILLS[@]}"; do
    skill_path="$ROOT_DIR/skills/$skill/SKILL.md"
    if [[ ! -f "$skill_path" ]]; then
        fail "$skill — SKILL.md missing"
        continue
    fi

    # Collect aliases defined in `## Delegation agents` section.
    defined=$(awk '
        /^## Delegation agents[[:space:]]*$/ { in_section = 1; next }
        /^## / && in_section { in_section = 0 }
        in_section {
            while (match($0, /[a-z][a-z0-9-]*-agent/)) {
                print substr($0, RSTART, RLENGTH)
                $0 = substr($0, RSTART + RLENGTH)
            }
        }
    ' "$skill_path" | sort -u)

    # Collect aliases referenced anywhere in the body (including the section).
    referenced=$(awk '
        {
            line = $0
            while (match(line, /[a-z][a-z0-9-]*-agent/)) {
                print substr(line, RSTART, RLENGTH)
                line = substr(line, RSTART + RLENGTH)
            }
        }
    ' "$skill_path" | sort -u)

    missing=""
    for alias in $referenced; do
        if ! echo "$defined" | grep -qx "$alias"; then
            missing+="$alias "
        fi
    done

    if [[ -n "$missing" ]]; then
        fail "$skill — aliases referenced but not declared in '## Delegation agents': ${missing% }"
        echo "      (if a token above is an ordinary word and not a delegation alias, reword it —"
        echo "       the guard matches any [a-z][a-z0-9-]*-agent token and cannot tell them apart)"
    elif [[ -z "$defined" ]]; then
        fail "$skill — no aliases declared in '## Delegation agents'"
    else
        pass "$skill — delegation aliases consistent ($(echo "$defined" | tr '\n' ' '))"
    fi
done

# ─────────────────────────────────────────────
# Part 3: Validate per-engine memory rules
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== Validate per-engine memory rules ===${NC}\n"

ENGINES=("unity" "godot" "godot-net" "unreal-engine-5")

for engine in "${ENGINES[@]}"; do
    # schema:2 bundled layout: engines live under code/<engine>/.
    ENGINE_REGISTRY="$ROOT_DIR/rules-registry/code/$engine"

    # Check engine directory exists inside the cloned registry snapshot
    if [[ ! -d "$ENGINE_REGISTRY" ]]; then
        fail "$engine — rules-registry directory missing"
        continue
    fi

    # Check core rules per engine (ids sourced from test-fixtures.sh).
    for rule_id in "${EXPECTED_CORE_RULES[@]}"; do
        rule_path="$ENGINE_REGISTRY/core/${rule_id}.md"
        rule_name="$engine/core/${rule_id}"
        if [[ -f "$rule_path" && -s "$rule_path" ]]; then
            pass "$rule_name"
        else
            fail "$rule_name — missing or empty"
        fi
    done
done

# Unity-specific: check stack rules and references (ids from test-fixtures.sh).
for rule_id in "${EXPECTED_UNITY_STACK_RULES[@]}"; do
    rule_path="$ROOT_DIR/rules-registry/code/unity/stack/${rule_id}.md"
    rule_name="unity/stack/${rule_id}"
    if [[ -f "$rule_path" && -s "$rule_path" ]]; then
        pass "$rule_name"
    else
        fail "$rule_name — missing or empty"
    fi
done

# Unity stack references
REF_COUNT=$(find "$ROOT_DIR/rules-registry/code/unity/stack/references/" -name '*.md' -type f 2>/dev/null | wc -l | tr -d ' ')
if [[ "$REF_COUNT" -ge 9 ]]; then
    pass "unity/stack/references ($REF_COUNT files)"
else
    fail "unity/stack/references — expected >= 9, found $REF_COUNT"
fi

# ─────────────────────────────────────────────
# Part 4: Validate engine templates
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== Validate engine templates ===${NC}\n"

TEMPLATES_DIR="$ROOT_DIR/data/engine-templates/skills"

# Check unikit templates
for tpl in "UNITY_RULES.md" "GODOT_RULES.md" "GODOT_NET_RULES.md" "UNREAL_ENGINE_5_RULES.md"; do
    tpl_path="$TEMPLATES_DIR/unikit/$tpl"
    if [[ -f "$tpl_path" && -s "$tpl_path" ]]; then
        pass "engine-templates/skills/unikit/$tpl"
    else
        fail "engine-templates/skills/unikit/$tpl — missing or empty"
    fi
done

# Check unikit-architecture templates
for tpl in "UNITY_RULES.md" "GODOT_RULES.md" "GODOT_NET_RULES.md" "UNREAL_ENGINE_5_RULES.md"; do
    tpl_path="$TEMPLATES_DIR/unikit-architecture/$tpl"
    if [[ -f "$tpl_path" && -s "$tpl_path" ]]; then
        pass "engine-templates/skills/unikit-architecture/$tpl"
    else
        fail "engine-templates/skills/unikit-architecture/$tpl — missing or empty"
    fi
done

# Check unikit-docs templates
for tpl in "UNITY_RULES.md" "GODOT_RULES.md" "UNREAL_ENGINE_5_RULES.md"; do
    tpl_path="$TEMPLATES_DIR/unikit-docs/$tpl"
    if [[ -f "$tpl_path" && -s "$tpl_path" ]]; then
        pass "engine-templates/skills/unikit-docs/$tpl"
    else
        fail "engine-templates/skills/unikit-docs/$tpl — missing or empty"
    fi
done

# Check unikit-verify templates
for tpl in "UNITY_RULES.md" "GODOT_RULES.md" "GODOT_NET_RULES.md" "UNREAL_ENGINE_5_RULES.md"; do
    tpl_path="$TEMPLATES_DIR/unikit-verify/$tpl"
    if [[ -f "$tpl_path" && -s "$tpl_path" ]]; then
        pass "engine-templates/skills/unikit-verify/$tpl"
    else
        fail "engine-templates/skills/unikit-verify/$tpl — missing or empty"
    fi
done

# Check unikit-plan templates
# DELIBERATELY Unity-only: the Godot / UE5 planning vocabularies land in
# phases 3-4. Listing all four here would fail immediately and for the wrong
# reason. Precedent: unikit-docs above checks 3 of 4 (no GODOT_NET_RULES.md).
# Their ABSENCE is asserted in test-install.sh Test 8 — see the note there.
for tpl in "UNITY_RULES.md"; do
    tpl_path="$TEMPLATES_DIR/unikit-plan/$tpl"
    if [[ -f "$tpl_path" && -s "$tpl_path" ]]; then
        pass "engine-templates/skills/unikit-plan/$tpl"
    else
        fail "engine-templates/skills/unikit-plan/$tpl — missing or empty"
    fi
done

# ─────────────────────────────────────────────
# Part 4a2: Validate `<!-- unikit-additional-sections -->` tags are balanced
# Engine templates in data/engine-templates/skills/unikit/ MAY declare an
# optional block of Stack Selection subsections wrapped in
# `<!-- unikit-additional-sections -->` ... `<!-- /unikit-additional-sections -->`
# HTML comments. The /unikit SKILL.md step 8 scans for that exact pair —
# unbalanced tags would make step 8 silently consume the rest of the file.
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== Validate unikit-additional-sections tag balance ===${NC}\n"

for tpl_path in "$TEMPLATES_DIR/unikit"/*.md; do
    [[ -f "$tpl_path" ]] || continue
    tpl_name=$(basename "$tpl_path")
    # grep -c outputs the count on stdout AND exits 1 when count is 0,
    # so `|| true` only swallows the exit code while still capturing "0".
    OPEN_COUNT=$(grep -c '<!-- unikit-additional-sections -->' "$tpl_path" 2>/dev/null || true)
    CLOSE_COUNT=$(grep -c '<!-- /unikit-additional-sections -->' "$tpl_path" 2>/dev/null || true)

    if [[ "$OPEN_COUNT" == "0" && "$CLOSE_COUNT" == "0" ]]; then
        # No tags at all — block is absent, skill skips step 8 silently. OK.
        pass "$tpl_name — no additional-sections block (step 8 skipped silently)"
    elif [[ "$OPEN_COUNT" == "1" && "$CLOSE_COUNT" == "1" ]]; then
        pass "$tpl_name — additional-sections tags balanced (1 open / 1 close)"
    else
        fail "$tpl_name — unbalanced tags (open=$OPEN_COUNT, close=$CLOSE_COUNT, expected 0/0 or 1/1)"
    fi
done

# ─────────────────────────────────────────────
# Part 4b: Validate each engine has MCP with is_engine flag
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== Validate engine is_engine MCP presence ===${NC}\n"

declare -A ENGINE_MCP_DIRS=(["unity"]="unity" ["godot"]="godot" ["godot-net"]="godot" ["unreal-engine-5"]="unreal-engine-5")

for engine_id in "unity" "godot" "godot-net" "unreal-engine-5"; do
    mcp_dir="$ROOT_DIR/mcp/${ENGINE_MCP_DIRS[$engine_id]}"
    ENGINE_MCP_RESULT=$(node -e "
      const fs = require('fs');
      const path = require('path');
      const dir = process.argv[1];
      let found = false;
      if (fs.existsSync(dir)) {
        for (const f of fs.readdirSync(dir)) {
          if (!f.endsWith('.json')) continue;
          try {
            const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
            if (m.is_engine === true) { found = true; break; }
          } catch {}
        }
      }
      console.log(found ? 'ok' : 'fail');
    " "$mcp_dir" 2>/dev/null)

    if [[ "$ENGINE_MCP_RESULT" == "ok" ]]; then
        pass "engine $engine_id has MCP with is_engine=true"
    else
        fail "engine $engine_id - no MCP file with is_engine=true in mcp/${ENGINE_MCP_DIRS[$engine_id]}/"
    fi
done

# ─────────────────────────────────────────────
# Part 5: Validate MCP structure
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== Validate MCP structure ===${NC}\n"

MCP_DIR="$ROOT_DIR/mcp"

# universal/ must have context7.json
if [[ -f "$MCP_DIR/universal/context7.json" ]]; then
    if validate_json "$MCP_DIR/universal/context7.json"; then
        # Validate required fields
        HAS_FIELDS=$(json_field "$MCP_DIR/universal/context7.json" \
          "m.key && m.displayName && (m.config || m.configByPlatform) ? 'ok' : 'missing'" 2>/dev/null || echo "missing")
        if [[ "$HAS_FIELDS" == "ok" ]]; then
            KEY_VAL=$(json_field "$MCP_DIR/universal/context7.json" "m.key" 2>/dev/null)
            if [[ "$KEY_VAL" == "context7" ]]; then
                pass "mcp/universal/context7.json (valid structure, key=context7)"
            else
                fail "mcp/universal/context7.json — expected key 'context7', got '$KEY_VAL'"
            fi
        else
            fail "mcp/universal/context7.json — missing key, displayName, or config/configByPlatform"
        fi
    else
        fail "mcp/universal/context7.json — invalid JSON"
    fi
else
    fail "mcp/universal/context7.json — missing"
fi

# unity/ — validate all MCP JSON files
UNITY_MCP_COUNT=0
for mcp_file in "$MCP_DIR"/unity/*.json; do
    [[ -f "$mcp_file" ]] || continue
    UNITY_MCP_COUNT=$((UNITY_MCP_COUNT + 1))
    fname=$(basename "$mcp_file")
    if validate_json "$mcp_file"; then
        HAS_FIELDS=$(json_field "$mcp_file" \
          "m.key && m.displayName && (m.config || m.configByPlatform) ? 'ok' : 'missing'" 2>/dev/null || echo "missing")
        if [[ "$HAS_FIELDS" == "ok" ]]; then
            KEY_VAL=$(json_field "$mcp_file" "m.key" 2>/dev/null)
            pass "mcp/unity/$fname (valid structure, key=$KEY_VAL)"
        else
            fail "mcp/unity/$fname — missing key, displayName, or config/configByPlatform"
        fi
    else
        fail "mcp/unity/$fname — invalid JSON"
    fi
done
if [[ "$UNITY_MCP_COUNT" -eq 0 ]]; then
    fail "mcp/unity/ — no MCP JSON files found"
fi

# godot/ — validate all MCP JSON files
GODOT_MCP_COUNT=0
for mcp_file in "$MCP_DIR"/godot/*.json; do
    [[ -f "$mcp_file" ]] || continue
    GODOT_MCP_COUNT=$((GODOT_MCP_COUNT + 1))
    fname=$(basename "$mcp_file")
    if validate_json "$mcp_file"; then
        HAS_FIELDS=$(json_field "$mcp_file" \
          "m.key && m.displayName && (m.config || m.configByPlatform) ? 'ok' : 'missing'" 2>/dev/null || echo "missing")
        if [[ "$HAS_FIELDS" == "ok" ]]; then
            KEY_VAL=$(json_field "$mcp_file" "m.key" 2>/dev/null)
            pass "mcp/godot/$fname (valid structure, key=$KEY_VAL)"
        else
            fail "mcp/godot/$fname — missing key, displayName, or config/configByPlatform"
        fi
    else
        fail "mcp/godot/$fname — invalid JSON"
    fi
done
if [[ "$GODOT_MCP_COUNT" -eq 0 ]]; then
    fail "mcp/godot/ — no MCP JSON files found"
fi

# unreal-engine-5/ must have chir24-unreal-mcp.json
if [[ -f "$MCP_DIR/unreal-engine-5/chir24-unreal-mcp.json" ]]; then
    if validate_json "$MCP_DIR/unreal-engine-5/chir24-unreal-mcp.json"; then
        HAS_FIELDS=$(json_field "$MCP_DIR/unreal-engine-5/chir24-unreal-mcp.json" \
          "m.key && m.displayName && (m.config || m.configByPlatform) ? 'ok' : 'missing'" 2>/dev/null || echo "missing")
        if [[ "$HAS_FIELDS" == "ok" ]]; then
            KEY_VAL=$(json_field "$MCP_DIR/unreal-engine-5/chir24-unreal-mcp.json" "m.key" 2>/dev/null)
            IS_ENGINE=$(json_field "$MCP_DIR/unreal-engine-5/chir24-unreal-mcp.json" "m.is_engine === true ? 'true' : 'false'" 2>/dev/null)
            if [[ -n "$KEY_VAL" && "$IS_ENGINE" == "true" ]]; then
                pass "mcp/unreal-engine-5/chir24-unreal-mcp.json (valid structure, key=$KEY_VAL, is_engine=true)"
            else
                fail "mcp/unreal-engine-5/chir24-unreal-mcp.json — key='$KEY_VAL', is_engine=$IS_ENGINE (expected non-empty key + is_engine=true)"
            fi
        else
            fail "mcp/unreal-engine-5/chir24-unreal-mcp.json — missing key, displayName, or config/configByPlatform"
        fi
    else
        fail "mcp/unreal-engine-5/chir24-unreal-mcp.json — invalid JSON"
    fi
else
    fail "mcp/unreal-engine-5/chir24-unreal-mcp.json — missing"
fi

# ─────────────────────────────────────────────
# Part 5b: schema fields across ALL MCP configs (one cross-file pass)
# ─────────────────────────────────────────────
# Deliberately NOT folded into the four checks above. Each of those validates a
# single file in isolation (two by directory loop, two by pinned filename) and
# keeps no accumulator between files, so `order` uniqueness within a `key` group
# is not expressible there at all, and the structural checks would have to be
# written out four times. One node pass over mcp/*/*.json covers both.
#
# Checks:
#   - `order`, when present, is a number
#   - `configByPlatform`, when present, keys ⊆ {win32,darwin,linux} and each
#     entry has `command` or `url`
#   - `order` is unique among is_engine=true entries of one DIRECTORY — without
#     that the wizard's radio sort degenerates back to non-deterministic, which
#     is the exact bug the field exists to fix
#   - `docs.context7`, when present, is a Context7 library id (leading slash)
#   - `docs.repo`, when present, is a URL — and is REQUIRED on is_engine entries:
#     it is the only thing the `init` summary can generate an install line from,
#     so without it the user is never told a plugin has to go into the editor
#   - `rules`, when present, points at an existing directory holding an INDEX.md
#   - the keys `shards`, `instruction` and `verified` are ABSENT everywhere. All three
#     are retired, and all three would come back the same way: someone adds a server
#     six months from now, copies the nearest config as a template, and reintroduces a
#     mechanism nothing else reads (`shards`), a slab of restated vendor prose that goes
#     stale claim by claim (`instruction`), or a hand-maintained measurement date whose
#     last consumer was deleted (`verified`). An absent-key guard is stricter than
#     any check on their contents.
#
# Errors accumulate rather than exiting on the first one, and every message names
# its file and field: fixing ten configs should take one run, not ten.
MCP_SCHEMA_RESULT=$(node -e "
  const fs=require('fs'), path=require('path');
  const root=process.argv[1];
  const KNOWN_PLATFORMS=['win32','darwin','linux'];
  const why=[];
  const orderByKey=new Map();   // directory -> Map<order, fileId>

  for (const dir of fs.readdirSync(root)) {
    const dirPath=path.join(root, dir);
    if (!fs.statSync(dirPath).isDirectory()) continue;
    for (const f of fs.readdirSync(dirPath)) {
      if (!f.endsWith('.json')) continue;
      const rel=dir+'/'+f;
      let m;
      try { m=JSON.parse(fs.readFileSync(path.join(dirPath,f),'utf8')); }
      catch { why.push('parse-error:'+rel); continue; }

      if (m.order !== undefined && typeof m.order !== 'number') why.push('order-not-number:'+rel);

      for (const dead of ['shards','instruction','verified'])
        if (m[dead] !== undefined) why.push('retired-key-'+dead+':'+rel);

      if (m.docs !== undefined) {
        const d=m.docs;
        if (typeof d!=='object'||d===null||Array.isArray(d)) why.push('docs-not-object:'+rel);
        else {
          if (d.context7 !== undefined && (typeof d.context7!=='string'||!d.context7.startsWith('/')))
            why.push('docs-context7-not-library-id:'+rel);
          if (d.repo !== undefined && (typeof d.repo!=='string'||!/^https?:\/\//.test(d.repo)))
            why.push('docs-repo-not-url:'+rel);
        }
      }
      if (m.is_engine === true && !(m.docs && typeof m.docs.repo==='string' && m.docs.repo))
        why.push('engine-without-docs-repo:'+rel);

      if (m.rules !== undefined) {
        if (typeof m.rules!=='string'||!m.rules) why.push('rules-not-string:'+rel);
        else {
          const rulesDir=path.resolve(dirPath, m.rules);
          if (!fs.existsSync(rulesDir)||!fs.statSync(rulesDir).isDirectory())
            why.push('rules-dir-missing:'+m.rules+':'+rel);
          else if (!fs.existsSync(path.join(rulesDir,'INDEX.md')))
            why.push('rules-dir-without-index:'+m.rules+':'+rel);
        }
      }

      if (m.configByPlatform !== undefined) {
        const c=m.configByPlatform;
        if (typeof c!=='object'||c===null||Array.isArray(c)) why.push('cbp-not-object:'+rel);
        else for (const [p,cfg] of Object.entries(c)) {
          if (!KNOWN_PLATFORMS.includes(p)) { why.push('cbp-unknown-platform:'+p+':'+rel); continue; }
          if (typeof cfg!=='object'||cfg===null) { why.push('cbp-entry-not-object:'+p+':'+rel); continue; }
          if (!cfg.command && !cfg.url) why.push('cbp-entry-no-command-or-url:'+p+':'+rel);
        }
      }

      // Order uniqueness is scoped to the engine group, and since 2.0.0 the
      // group is the DIRECTORY, not the key: the radio renders the is_engine
      // entries of one \`mcp/<dir>/\` folder, and universal servers never compete
      // with them. Keying this on \`m.key\` would now be vacuous — every JSON
      // carries its own basename there, so each group would hold one entry and
      // no collision could ever be expressed.
      if (m.is_engine === true && typeof m.order === 'number') {
        if (!orderByKey.has(dir)) orderByKey.set(dir, new Map());
        const seen=orderByKey.get(dir);
        if (seen.has(m.order)) why.push('duplicate-order:'+dir+':'+m.order+':'+seen.get(m.order)+'+'+rel);
        else seen.set(m.order, rel);
      }
    }
  }

  console.log(why.length ? why.join(' ') : 'ok');
" "$MCP_DIR" 2>/dev/null || echo "pass-error")

if [[ "$MCP_SCHEMA_RESULT" == "ok" ]]; then
    pass "MCP schema fields valid across all configs (order/configByPlatform/docs/rules + order unique, shards+instruction+verified gone)"
else
    fail "MCP schema fields invalid: $MCP_SCHEMA_RESULT"
fi

# Part 5b guard: the hint key inside mcp/universal/context7.json is pinned to the
# MCP_COMMENT_KEY constant in the source tree.
#
# The literal lives in two places at once — in the data and in the OpenCode
# writer, which assembles its output from a whitelist and therefore carries the
# hint through BY NAME. Rename one half and the other breaks in silence: nothing
# else here would notice, because Part 5 and 5b keep no whitelist of keys inside
# `config`, and the absent-key guards above are top-level only.
#
# It insures Codex as well, from the other side. Its TOML writer carries the key
# through BY ACCIDENT — it copies fields it does not recognise — and the day
# that writer is refactored onto a whitelist, the hint would vanish from one
# agent with nothing to say so.
#
# The constant is read from `src/core/constants.ts`, never from `dist/`. Not a
# question of step order (CI builds before it tests) but the convention of this
# suite — Part 7i greps `src/core/*.ts` the same way: the source tree is what is
# under test, and `dist/` may lag the working tree.
#
# The `^export const` anchor is load-bearing rather than cosmetic. The constant
# carries TSDoc explaining why it is a constant and not a literal, and the
# natural way to write that quotes the declaration itself; with no anchor
# `grep -oE` returns two lines, COMMENT_KEY goes multi-line, and the comparison
# fails with a message whose cause cannot be read off it. The anchor is also the
# declaration form the constant promised, so the two check each other.
#
# An empty COMMENT_KEY — constant renamed or deleted — is a fail and not a skip,
# on the convention already in force in ED-14 and RT-1.
COMMENT_KEY=$(grep -oE "^export const MCP_COMMENT_KEY = '[^']+'" "$ROOT_DIR/src/core/constants.ts" | sed "s/.*'\(.*\)'/\1/")
if [[ -z "$COMMENT_KEY" ]]; then
    fail "MCP hint key: MCP_COMMENT_KEY not found in src/core/constants.ts (expected form: export const MCP_COMMENT_KEY = '<key>')"
else
    CONTEXT7_COMMENT=$(node -e "
      const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
      const cfg = m.config || {};
      const key = process.argv[2];
      console.log(key in cfg ? 'ok' : (Object.keys(cfg).join(',') || '(empty config)'));
    " "$MCP_DIR/universal/context7.json" "$COMMENT_KEY" 2>/dev/null || echo "read-error")
    if [[ "$CONTEXT7_COMMENT" == "ok" ]]; then
        pass "MCP hint key: mcp/universal/context7.json config carries '$COMMENT_KEY' (pinned to MCP_COMMENT_KEY)"
    else
        fail "MCP hint key: constant MCP_COMMENT_KEY = '$COMMENT_KEY', but mcp/universal/context7.json config has keys: $CONTEXT7_COMMENT"
    fi
fi

# TomlMcpWriter unit-style smoke:
#   - upsert → serialize → readExisting round-trips stdio + HTTP configs
#   - `type` stripped, `headers` renamed to http_headers, null env dropped
#   - remove() returns true/false correctly
#   - env sanitizer emits console.warn on null/undefined keys
TOML_WRITER_TMP=$(mktemp -d)
TOML_WRITER_RESULT=$(cd "$ROOT_DIR" && TMP_FILE="$TOML_WRITER_TMP/config.toml" \
    node --input-type=module -e "
  const fs = await import('node:fs');
  const { TomlMcpWriter } = await import('./dist/core/mcp-writers/toml-writer.js');
  const file = process.env.TMP_FILE;
  const writer = new TomlMcpWriter();
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => { warnings.push(args.join(' ')); };

  // Seed a third-party section manually; writer must preserve it.
  fs.writeFileSync(file, '[mcp_servers.manual]\\ncommand = \"noop\"\\n');
  const settings = await writer.readExisting(file);

  writer.upsert(settings, 'context7', {
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'context7@latest'],
    env: { GOOD: 'x', DROP_ME: null, OTHER: undefined },
  });
  writer.upsert(settings, 'UnityMCP', {
    type: 'http',
    url: 'http://localhost:8085/mcp',
    headers: { Authorization: 'Bearer x' },
  });
  fs.writeFileSync(file, writer.serialize(settings));

  const round = await writer.readExisting(file);
  const ctx = round.mcp_servers.context7;
  const unity = round.mcp_servers.UnityMCP;
  const manual = round.mcp_servers.manual;
  const checks = {
    stdioCommand: ctx.command === 'npx',
    stdioTypeStripped: ctx.type === undefined,
    envDropped: ctx.env.DROP_ME === undefined && ctx.env.OTHER === undefined,
    envPreserved: ctx.env.GOOD === 'x',
    httpUrl: unity.url === 'http://localhost:8085/mcp',
    httpHeadersRenamed: unity.http_headers && unity.http_headers.Authorization === 'Bearer x' && unity.headers === undefined,
    manualPreserved: manual && manual.command === 'noop',
    removeTrue: writer.remove(round, 'context7') === true,
    removeFalse: writer.remove(round, 'nonexistent') === false,
    warnDropMe: warnings.some(w => w.includes('DROP_ME')),
    warnOther: warnings.some(w => w.includes('OTHER')),
  };
  console.warn = origWarn;
  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  console.log(failed.length === 0 ? 'ok' : 'fail:' + failed.join(','));
" 2>&1)
rm -rf "$TOML_WRITER_TMP"

if [[ "$TOML_WRITER_RESULT" == "ok" ]]; then
    pass "TomlMcpWriter unit smoke (round-trip, type strip, headers rename, null env, remove, warn)"
else
    fail "TomlMcpWriter unit smoke: $TOML_WRITER_RESULT"
fi

# ─────────────────────────────────────────────
# Part 6: Validate data files
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== Validate data files ===${NC}\n"

# rules-manifest.json — after the registry refactor this file holds only a
# `requiredBy` map that `loadRequiredByMap()` consumes to colorise RULES_INDEX.md.
# Core/stack rule descriptions live in the remote rules registry
# (NintendaDev/unikit-ai-rules), not here.
MANIFEST="$ROOT_DIR/data/rules-manifest.json"
if [[ -f "$MANIFEST" ]]; then
    if validate_json "$MANIFEST"; then
        REQUIRED_BY_KEYS=$(node -e "
          const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
          const keys=Object.keys(m.requiredBy||{});
          console.log(keys.length);
        " "$MANIFEST" 2>/dev/null)
        if [[ "$REQUIRED_BY_KEYS" -ge 5 ]]; then
            pass "rules-manifest.json — requiredBy map ($REQUIRED_BY_KEYS entries)"
        else
            fail "rules-manifest.json — expected requiredBy entries >= 5, got $REQUIRED_BY_KEYS"
        fi

        # Legacy per-engine core/stack arrays must be gone (if present,
        # someone reintroduced the old bundled-manifest format).
        LEGACY_KEYS=$(node -e "
          const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
          const keys=Object.keys(m).filter(k=>k!=='requiredBy');
          console.log(keys.length);
        " "$MANIFEST" 2>/dev/null)
        if [[ "$LEGACY_KEYS" -eq 0 ]]; then
            pass "rules-manifest.json — no legacy engine-keyed sections"
        else
            fail "rules-manifest.json — unexpected top-level keys beside requiredBy ($LEGACY_KEYS)"
        fi
    else
        fail "rules-manifest.json — invalid JSON"
    fi
else
    fail "rules-manifest.json — missing"
fi

# cli-contract.md regression: the `declined` field was removed from
# `rules status` output format in the registry refactor (Task 4) — make sure
# the generated contract no longer mentions it.
CLI_CONTRACT="$ROOT_DIR/data/cli-contract.md"
if [[ -f "$CLI_CONTRACT" ]]; then
    if grep -q '\bdeclined\b' "$CLI_CONTRACT"; then
        fail "cli-contract.md still mentions 'declined' (run npm run generate:contract)"
    else
        pass "cli-contract.md — no 'declined' references (post-refactor contract)"
    fi

    # After the CLI redesign `rules install` documents three forms: bare prints
    # help, `defaults` bootstraps every module whose skills are installed (the
    # /unikit Step 9.2 entry point), and the variadic `<ids...>` installs
    # specific rules. The contract MUST document the `[defaults | ids...]`
    # signature AND MUST NOT mention the obsolete `rules core-install` or
    # `rules registry-init` commands.
    if grep -q 'unikit-ai rules install \[defaults | ids\.\.\.\]' "$CLI_CONTRACT"; then
        pass "cli-contract.md — documents 'rules install [defaults | ids...]' signature"
    else
        fail "cli-contract.md — missing 'rules install [defaults | ids...]' signature"
    fi

    if grep -q 'unikit-ai rules core-install' "$CLI_CONTRACT"; then
        fail "cli-contract.md — still documents obsolete 'rules core-install' subcommand"
    else
        pass "cli-contract.md — no 'rules core-install' references (merged into variadic install)"
    fi

    if grep -q 'unikit-ai rules registry-init' "$CLI_CONTRACT"; then
        fail "cli-contract.md — still documents obsolete top-level 'rules registry-init' subcommand"
    else
        pass "cli-contract.md — no top-level 'rules registry-init' references (moved under 'registry init')"
    fi

    if grep -q 'unikit-ai rules registry init' "$CLI_CONTRACT"; then
        pass "cli-contract.md — documents nested 'rules registry init' subcommand"
    else
        fail "cli-contract.md — missing nested 'rules registry init' subcommand"
    fi
else
    fail "cli-contract.md — missing (run npm run generate:contract)"
fi

# ─────────────────────────────────────────────────────
# dev-principles.md source content validation
# ─────────────────────────────────────────────────────
DEV_PRINCIPLES="$ROOT_DIR/data/dev-principles.md"
if [ ! -f "$DEV_PRINCIPLES" ]; then
    fail "dev-principles.md — missing in data/"
else
    if grep -q '## Layer A' "$DEV_PRINCIPLES"; then
        pass "dev-principles.md — has the Layer A evidence-contract section"
    else
        fail "dev-principles.md — missing the Layer A evidence-contract section"
    fi
    if grep -q '## Engine workflow' "$DEV_PRINCIPLES"; then
        pass "dev-principles.md — has Engine workflow section"
    else
        fail "dev-principles.md — missing Engine workflow section"
    fi
    if grep -q '## Code conventions' "$DEV_PRINCIPLES"; then
        pass "dev-principles.md — has Code conventions section"
    else
        fail "dev-principles.md — missing Code conventions section"
    fi
    # Guard against agent-specific vars leaking back in
    if grep -q '{{settings_file}}\|{{skills_dir}}' "$DEV_PRINCIPLES"; then
        fail "dev-principles.md — contains agent-specific vars (must use generic phrasing for shared system file)"
    else
        pass "dev-principles.md — no agent-specific vars (system-file safe)"
    fi
fi

# unikit-memory SKILL.md argument-hint must advertise --skip-registry so that
# /unikit Step 9.8 can invoke it for registry-bypassed stack rule generation.
UNIKIT_MEMORY_SKILL="$ROOT_DIR/skills/unikit-memory/SKILL.md"
if [[ -f "$UNIKIT_MEMORY_SKILL" ]]; then
    if grep -q '^argument-hint:.*--skip-registry' "$UNIKIT_MEMORY_SKILL"; then
        pass "unikit-memory — argument-hint advertises --skip-registry"
    else
        fail "unikit-memory — argument-hint does not list --skip-registry"
    fi
else
    fail "unikit-memory/SKILL.md — missing"
fi

# iso-639-1.json
ISO_FILE="$ROOT_DIR/data/iso-639-1.json"
if [[ -f "$ISO_FILE" ]]; then
    if validate_json "$ISO_FILE"; then
        pass "iso-639-1.json"
    else
        fail "iso-639-1.json — invalid JSON"
    fi
else
    fail "iso-639-1.json — missing"
fi

# Every requiredBy key should name an actual core rule id that exists in the
# cloned rules-registry/<engine>/core/ snapshot (at least one engine).
#
# Key format (post lowercase-hyphen refactor): `id` with NO `.md` extension,
# always canonical lowercase-hyphen. Filesystem entries still have `.md`, so
# we strip it before the comparison.
#
# Regression guards in addition to orphan detection:
#   - every key MUST match ^[a-z0-9][a-z0-9-]*$ (canonical shape)
#   - no key may carry the legacy `.md` suffix (accidental copy-paste)
if [[ -f "$MANIFEST" ]]; then
    ORPHAN_REPORT=$(node -e "
      const fs = require('fs');
      const path = require('path');
      const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
      const registryRoot = process.argv[2];
      const engines = ['unity', 'godot', 'godot-net', 'unreal-engine-5'];
      const allCoreIds = new Set();
      for (const e of engines) {
        // schema:2 bundled layout: engines live under code/<engine>/.
        const dir = path.join(registryRoot, 'code', e, 'core');
        if (!fs.existsSync(dir)) continue;
        for (const f of fs.readdirSync(dir)) {
          if (!f.endsWith('.md')) continue;
          allCoreIds.add(f.replace(/\\.md\$/, ''));
        }
      }
      const rb = m.requiredBy || {};
      const canonical = /^[a-z0-9][a-z0-9-]*\$/;
      const problems = [];
      for (const k of Object.keys(rb)) {
        if (k.endsWith('.md')) {
          problems.push('legacy-.md-suffix:' + k);
          continue;
        }
        if (!canonical.test(k)) {
          problems.push('non-canonical-shape:' + k);
          continue;
        }
        if (!allCoreIds.has(k)) {
          problems.push('orphan:' + k);
        }
      }
      if (problems.length) console.log(problems.join(', '));
    " "$MANIFEST" "$ROOT_DIR/rules-registry" 2>/dev/null)
    if [[ -z "$ORPHAN_REPORT" ]]; then
        pass "requiredBy keys: canonical lowercase-hyphen, no .md suffix, no orphans"
    else
        fail "requiredBy keys validation failed: $ORPHAN_REPORT"
    fi
fi

# ─────────────────────────────────────────────────────
# data/gamedesign — GDD authoring templates + gd-principles system asset
# ─────────────────────────────────────────────────────
GD_DATA="$ROOT_DIR/data/gamedesign"

# The 9 GDD authoring templates (Phase C / #9) must exist and be non-empty.
# GD-IDS ships as .yaml (machine truth); the rest are .md. CONTENT-TYPE joined in the
# Content axis (the 4th authoring zone).
for tpl in CONCEPT CONTENT-TYPE FLOW GAME GD-IDS GD_RULES_INDEX PITCH REVIEW SYSTEM; do
    ext=md
    [[ "$tpl" == "GD-IDS" ]] && ext=yaml
    if [[ -s "$GD_DATA/templates/$tpl.$ext" ]]; then
        pass "data/gamedesign/templates/$tpl.$ext"
    else
        fail "data/gamedesign/templates/$tpl.$ext — missing or empty"
    fi
done

# gd-principles.md (core) + 6 shards — the cross-skill working contract installed as
# system assets under .unikit/system/gamedesign/. It is PROCESS, not domain. After the
# shard split (feature/gd-principles-shard-split) the slim core keeps the always-loaded
# sections (zone model, routing, collaboration, one-way boundary, facts registry,
# language, anti-patterns); the rest live in 6 sibling shards each skill loads on demand.
# Every shard, like the core (and dev-principles.md), is flat-copied WITHOUT
# substitution, so none may carry agent/engine template vars.
GD_PRINCIPLES="$GD_DATA/gd-principles.md"
GD_AUTHORING="$GD_DATA/gd-authoring.md"
GD_LIFECYCLE="$GD_DATA/gd-lifecycle.md"
GD_FLOW_AXIS="$GD_DATA/gd-flow-axis.md"
GD_CONTENT_AXIS="$GD_DATA/gd-content-axis.md"
GD_PROVENANCE="$GD_DATA/gd-provenance.md"
GD_CRITIQUE="$GD_DATA/gd-critique.md"
GD_SHARDS=("$GD_PRINCIPLES" "$GD_AUTHORING" "$GD_LIFECYCLE" "$GD_FLOW_AXIS" "$GD_CONTENT_AXIS" "$GD_PROVENANCE" "$GD_CRITIQUE")

# (split-1) Core slim + all 6 shards present.
GD_SHARD_MISSING=""
for shard in "${GD_SHARDS[@]}"; do
    [[ -f "$shard" ]] || GD_SHARD_MISSING+=" $(basename "$shard")"
done
if [[ -z "$GD_SHARD_MISSING" ]]; then
    pass "gd-principles — core + 6 shards present (gd-authoring/gd-lifecycle/gd-flow-axis/gd-content-axis/gd-provenance/gd-critique)"
else
    fail "gd-principles — missing core/shard file(s):$GD_SHARD_MISSING"
fi

# (split-2) Section ownership — each moved section lives in EXACTLY its shard; the slim
# core keeps only the always-loaded sections (decomposed from the pre-split 8-section
# core check). 'Lifecycle & Status' → gd-lifecycle is asserted in its own block below.
gd_section_in() {  # <label> <file> <heading>
    if grep -qF "## $3" "$2"; then pass "$1 — has '## $3'"; else fail "$1 — missing '## $3'"; fi
}
for section in "Zone Ownership" "Routing" "Collaborative Protocol" "One-Way Boundary" "Facts Registry & ID Conventions" "Language" "Anti-patterns"; do
    gd_section_in "gd-principles(core)" "$GD_PRINCIPLES" "$section"
done
gd_section_in "gd-authoring"  "$GD_AUTHORING"  "Section-Cycle Contract"
gd_section_in "gd-authoring"  "$GD_AUTHORING"  "Delta Discipline"
gd_section_in "gd-flow-axis"  "$GD_FLOW_AXIS"  "Flow Axis"
gd_section_in "gd-content-axis" "$GD_CONTENT_AXIS" "Content Axis"
gd_section_in "gd-provenance" "$GD_PROVENANCE" "Provenance"
gd_section_in "gd-critique"   "$GD_CRITIQUE"   "Critique Stance"
gd_section_in "gd-critique"   "$GD_CRITIQUE"   "Severity Rubric"

# (split-3) The slim core must NOT still carry a section that moved into a shard
# (a botched split that duplicated content into both files).
GD_CORE_LEAK=""
for moved in "Section-Cycle Contract" "Delta Discipline" "Lifecycle & Status" "Flow Axis" "Content Axis" "Provenance" "Critique Stance" "Severity Rubric"; do
    grep -qF "## $moved" "$GD_PRINCIPLES" && GD_CORE_LEAK+=" '$moved'"
done
if [[ -z "$GD_CORE_LEAK" ]]; then
    pass "gd-principles(core) — slim: no moved shard section leaked back into the core"
else
    fail "gd-principles(core) — moved section(s) still present in the slim core:$GD_CORE_LEAK"
fi

# (split-4) Substitution-free — every delivered shard (and the core) stays free of
# agent/engine template vars (mirror of the dev-principles guard, applied per shard).
GD_SUBST_BAD=""
for shard in "${GD_SHARDS[@]}"; do
    grep -qE '\{\{settings_file\}\}|\{\{skills_dir\}\}|\{\{engine_' "$shard" && GD_SUBST_BAD+=" $(basename "$shard")"
done
if [[ -z "$GD_SUBST_BAD" ]]; then
    pass "gd-principles core + 6 shards — no agent/engine vars (system-file safe)"
else
    fail "gd-principles core/shard contains agent/engine vars (must be substitution-free):$GD_SUBST_BAD"
fi

# (split-5) Skill→shard binding (the load matrix) — each gd-skill's files reference the
# shards it loads on Bootstrap. File-scoped grep over the skill dir (SKILL.md + references).
gd_check_skill_shards() {  # <skill> <shard-stem>...
    local skill="$1"; shift
    local dir="$ROOT_DIR/skills/$skill"
    local missing=""
    for shard in "$@"; do grep -rqF "$shard" "$dir" 2>/dev/null || missing+=" $shard"; done
    if [[ -z "$missing" ]]; then pass "skill→shard binding — $skill → $*"; else fail "skill→shard binding — $skill missing:$missing"; fi
}
gd_check_skill_shards "unikit-gd-spec"    "gd-authoring" "gd-lifecycle"
gd_check_skill_shards "unikit-gd-system"  "gd-authoring" "gd-lifecycle" "gd-provenance"
gd_check_skill_shards "unikit-gd-flow"    "gd-authoring" "gd-lifecycle" "gd-flow-axis" "gd-provenance"
gd_check_skill_shards "unikit-gd-content" "gd-authoring" "gd-lifecycle" "gd-content-axis"
gd_check_skill_shards "unikit-gd-verify"  "gd-lifecycle" "gd-flow-axis" "gd-content-axis" "gd-critique"
gd_check_skill_shards "unikit-gd-explore" "gd-critique" "gd-provenance"
gd_check_skill_shards "unikit-gd-review"  "gd-flow-axis" "gd-content-axis" "gd-provenance" "gd-critique"
gd_check_skill_shards "unikit-gd-apply"   "gd-authoring" "gd-lifecycle"
# brainstorm loads core ONLY — assert it references none of the 6 shards.
GD_BRAINSTORM_LEAK=""
for shard in gd-authoring gd-lifecycle gd-flow-axis gd-content-axis gd-provenance gd-critique; do
    grep -rqF "$shard" "$ROOT_DIR/skills/unikit-gd-brainstorm" 2>/dev/null && GD_BRAINSTORM_LEAK+=" $shard"
done
if [[ -z "$GD_BRAINSTORM_LEAK" ]]; then
    pass "skill→shard binding — unikit-gd-brainstorm references no shard (core only)"
else
    fail "skill→shard binding — unikit-gd-brainstorm references shard(s):$GD_BRAINSTORM_LEAK (should load core only)"
fi

# (Content Stage 0) Per-shard content-contract ownership — each content contract lands in
# its owning shard and nowhere else (the shard-split discipline, applied to the Content
# axis): core (gd-principles) = the content zone + the CT-/CU- id prefixes; gd-authoring =
# the content delta discipline (schema vs values); gd-lifecycle = the content_status spine
# + belongs_to. The leak check mirrors split-3 (the content delta must not bleed into core).
GD_CT_OWN_WHY=""
grep -qF 'unikit-gd-content' "$GD_PRINCIPLES" || GD_CT_OWN_WHY+=" core(no-content-zone)"
grep -qF 'CT-<slug>' "$GD_PRINCIPLES"         || GD_CT_OWN_WHY+=" core(no-CT-prefix)"
grep -qF 'CU-<ct>-<n>' "$GD_PRINCIPLES"        || GD_CT_OWN_WHY+=" core(no-CU-prefix)"
grep -qF 'Content delta' "$GD_AUTHORING"      || GD_CT_OWN_WHY+=" gd-authoring(no-content-delta)"
grep -qF 'belongs_to' "$GD_LIFECYCLE"         || GD_CT_OWN_WHY+=" gd-lifecycle(no-belongs_to)"
grep -qF 'Content delta' "$GD_PRINCIPLES"     && GD_CT_OWN_WHY+=" core-leak(content-delta)"
if [[ -z "$GD_CT_OWN_WHY" ]]; then
    pass "Content Stage 0 — per-shard content ownership (core: zone+CT/CU · gd-authoring: delta · gd-lifecycle: belongs_to)"
else
    fail "Content Stage 0 — content-contract shard ownership drift:$GD_CT_OWN_WHY"
fi

# Status spine (Tier 1) — a system's doc_status lives on TWO authored surfaces that
# must agree: the GD-IDS `doc_status` (machine truth, 3-value enum) and the SYSTEM.md
# header `> **Status**:` legend (2-value, no `not-started`). The `unikit-gd-verify`
# `Status coherence` CHECK legend describes the same design-writable enum. The enum was
# collapsed 5->3 in this PR: status records READINESS only (`not-started · skeleton ·
# detailed`, `detailed` terminal); the dropped `reviewed`/`revised` were the quality /
# pending axes (quality is now an ephemeral review verdict, "changed" is the version +
# changelog). GD-INDEX.md was dropped in v2: the generated GAME.md `## System Map [gen]`
# RENDERS status read-only — a freshness surface (verify prints, owner re-renders),
# never a coherence one (asserted separately below). So this guard asserts the shared
# MERGE invariant: `detailed` PRESENT and `reviewed`/`revised`/`approved`-as-status
# ABSENT on each of the 5 legend lines. Each grep targets the one status legend line per
# surface — never the whole file — so GAME.md/CONCEPT.md (their own `drafted | approved`
# lifecycle enums) stay out.
GD_IDS_TPL="$GD_DATA/templates/GD-IDS.yaml"
GD_SYSTEM_TPL="$GD_DATA/templates/SYSTEM.md"
GD_FLOW_TPL="$GD_DATA/templates/FLOW.md"
GD_CONTENT_TPL="$GD_DATA/templates/CONTENT-TYPE.md"
GD_GAME_TPL="$GD_DATA/templates/GAME.md"
GD_VERIFY_SKILL="$ROOT_DIR/skills/unikit-gd-verify/SKILL.md"
# Extracted gd-verify axis-check bodies (flow + content) — guard target for the check
# tables moved out of SKILL.md (context-cost refactor, 2026-06-26).
GD_VERIFY_AXIS="$ROOT_DIR/skills/unikit-gd-verify/references/axis-checks.md"
SPINE_IDS_LINE=$(grep -F 'doc_status:' "$GD_IDS_TPL" 2>/dev/null | head -1 || true)
SPINE_SYSTEM_LINE=$(grep -F '> **Status**:' "$GD_SYSTEM_TPL" 2>/dev/null | head -1 || true)
# Flow axis (PR#6): a flow's doc_status lives on the SAME 2-place spine — the FLOW.md
# header `> **Status**:` legend ↔ the GD-IDS `flows[].doc_status` (the shared enum the
# SPINE_IDS_LINE above already covers). Add the FLOW.md surface so the merge invariant
# (detailed present, no reviewed/revised/approved-as-status) holds across the flow zone too.
SPINE_FLOW_LINE=$(grep -F '> **Status**:' "$GD_FLOW_TPL" 2>/dev/null | head -1 || true)
# Content axis (Stage 0): a content type's doc_status lives on the SAME 2-place spine —
# the CONTENT-TYPE.md header `> **Status**:` legend ↔ the GD-IDS `content_types[].doc_status`
# (the shared enum SPINE_IDS_LINE covers). Add the CONTENT-TYPE.md surface so the merge
# invariant (detailed present, no reviewed/revised/approved-as-status) holds across the content zone.
SPINE_CONTENT_LINE=$(grep -F '> **Status**:' "$GD_CONTENT_TPL" 2>/dev/null | head -1 || true)
# the verify CHECK legend carries the design-writable enum on its single table row; the
# GAME.md/CONCEPT.md `approved` carve-out lives in separate prose, so head -1 anchors
# the row, not the explanation.
SPINE_VERIFY_LINE=$(grep -F 'Status coherence' "$GD_VERIFY_SKILL" 2>/dev/null | head -1 || true)
SPINE_OK=1
SPINE_WHY=""
# the 4 authored surfaces (GD-IDS + SYSTEM + FLOW + CONTENT-TYPE) + the verify check legend
for pair in "GD-IDS.yaml:$SPINE_IDS_LINE" "SYSTEM.md:$SPINE_SYSTEM_LINE" "FLOW.md:$SPINE_FLOW_LINE" "CONTENT-TYPE.md:$SPINE_CONTENT_LINE" "gd-verify:$SPINE_VERIFY_LINE"; do
    name="${pair%%:*}"
    line="${pair#*:}"
    if [[ -z "$line" ]]; then
        SPINE_OK=0; SPINE_WHY+=" $name(no-status-legend)"; continue
    fi
    if ! echo "$line" | grep -q "detailed"; then SPINE_OK=0; SPINE_WHY+=" $name(no-detailed)"; fi
    if echo "$line" | grep -q "reviewed"; then SPINE_OK=0; SPINE_WHY+=" $name(reviewed-still-present)"; fi
    if echo "$line" | grep -q "revised";  then SPINE_OK=0; SPINE_WHY+=" $name(revised-still-present)"; fi
    if echo "$line" | grep -q "approved";   then SPINE_OK=0; SPINE_WHY+=" $name(approved-as-status)"; fi
done
if [[ "$SPINE_OK" -eq 1 ]]; then
    pass "status spine — detailed (terminal) on the 4 authored surfaces (GD-IDS/SYSTEM/FLOW/CONTENT-TYPE) + verify legend; no reviewed/revised/approved-as-status"
else
    fail "status spine enum drift:$SPINE_WHY"
fi
# v2 render surface — GAME.md `## System Map [gen]` renders doc_status read-only (the
# freshness surface unikit-gd-verify PRINTS as stale; the owner re-renders on its next
# write — never a coherence one). Assert the template ships the generated block with a
# Status column.
GD_RENDER_WHY=""
grep -qF '## System Map [gen]' "$GD_GAME_TPL" || GD_RENDER_WHY+=" no-system-map-block"
grep -qF 'gen:system-map' "$GD_GAME_TPL"      || GD_RENDER_WHY+=" no-gen-marker"
grep -qE '\| *Status *\|' "$GD_GAME_TPL"       || GD_RENDER_WHY+=" no-status-column"
if [[ -z "$GD_RENDER_WHY" ]]; then
    pass "GAME.md template — ## System Map [gen] renders a read-only Status column (v2 render surface)"
else
    fail "GAME.md template — System Map render surface incomplete:$GD_RENDER_WHY"
fi
# (Content Stage 0) GAME.md `## Content Map [gen]` renders content_types read-only — the
# 4th [gen] surface, owned by unikit-gd-content. Assert the template ships the block with
# its gen marker and an expected column (Scale, the content axis's grouping field).
GD_CONTENT_RENDER_WHY=""
grep -qF '## Content Map [gen]' "$GD_GAME_TPL" || GD_CONTENT_RENDER_WHY+=" no-content-map-block"
grep -qF 'gen:content-map' "$GD_GAME_TPL"      || GD_CONTENT_RENDER_WHY+=" no-gen-marker"
grep -qE '\| *Scale *\|' "$GD_GAME_TPL"        || GD_CONTENT_RENDER_WHY+=" no-scale-column"
if [[ -z "$GD_CONTENT_RENDER_WHY" ]]; then
    pass "GAME.md template — ## Content Map [gen] renders a read-only Scale column (Content axis render surface)"
else
    fail "GAME.md template — Content Map render surface incomplete:$GD_CONTENT_RENDER_WHY"
fi
# The status state machine moved to the gd-lifecycle shard (#2); skills reference it
# by name ("Lifecycle & Status"). Guard a re-clone/split that drops the section.
if grep -q '^## Lifecycle & Status' "$GD_LIFECYCLE"; then
    pass "gd-lifecycle.md — has 'Lifecycle & Status' section"
else
    fail "gd-lifecycle.md — missing 'Lifecycle & Status' section"
fi

# Regression (#R3) — gamedesign CORE rules carry domain knowledge ONLY. Phase R
# stripped the process hook from the relocated library→core rules; severity and
# section-letter semantics live in gd-principles, never in a rule. Guard the
# bundled snapshot so a re-clone of process-laden rules fails loudly, and assert
# every core rule still exposes its Scope / Load when header.
GD_CORE_DIR="$ROOT_DIR/rules-registry/gamedesign/core"
if [[ -d "$GD_CORE_DIR" ]]; then
    GD_CORE_PROCESS=$(grep -lE '^## (Authoring|Process|Documenting)|recorded delta' "$GD_CORE_DIR"/*.md 2>/dev/null || true)
    if [[ -z "$GD_CORE_PROCESS" ]]; then
        pass "gamedesign core rules — no process sections (domain knowledge only, #R3)"
    else
        fail "gamedesign core rules carry process content (belongs in gd-principles): $GD_CORE_PROCESS"
    fi
    GD_CORE_HEADERLESS=""
    for f in "$GD_CORE_DIR"/*.md; do
        grep -q '^> \*\*Scope\*\*:' "$f" && grep -q '^> \*\*Load when\*\*:' "$f" || GD_CORE_HEADERLESS+=" $(basename "$f")"
    done
    if [[ -z "$GD_CORE_HEADERLESS" ]]; then
        pass "gamedesign core rules — every rule has Scope + Load when header"
    else
        fail "gamedesign core rules missing Scope/Load when header:$GD_CORE_HEADERLESS"
    fi
else
    fail "rules-registry/gamedesign/core — missing (run download-rules.sh)"
fi

# Defective GDD fixture — test data for the agent-driven /unikit-gd-verify and
# /unikit-gd-review smoke (Phase H #19). No bash assertion can run an LLM skill,
# so only validate the fixture is present and well-formed (canonical v2 schema, three
# system docs); its README.md carries the planted-defect → verify-check ground
# truth a reviewer checks skill output against. v2 dropped GD-INDEX.md — the roster
# lives in GD-IDS + GAME.md `## System Map [gen]`.
GD_DEFECTIVE="$ROOT_DIR/scripts/test-fixtures/gamedesign/defective-gdd"
GD_DEFECTIVE_OK=1
# systems/{boost,hud}.md are FIXED literal paths the multi-doc defects hang off
# (unregistered cross-doc fact, Depends 3-way, status coherence) — README §map and
# this guard both pin them; systems/loot.md is intentionally ABSENT (roster↔disk defect).
for f in README.md GAME.md GD-IDS.yaml systems/combat.md systems/boost.md systems/hud.md; do
    [[ -s "$GD_DEFECTIVE/$f" ]] || GD_DEFECTIVE_OK=0
done
if [[ "$GD_DEFECTIVE_OK" -eq 1 ]]; then
    pass "defective-gdd fixture present (GAME.md, GD-IDS.yaml, systems/{combat,boost,hud}.md, README ground truth)"
else
    fail "defective-gdd fixture incomplete under scripts/test-fixtures/gamedesign/defective-gdd"
fi
# Soft schema check: the fixture GD-IDS.yaml uses the canonical schema keys the new
# verify checks grep (doc_status / depends_on / forbidden_aliases). A re-clone that
# reverts to the old ad-hoc shape (version/status/depends/facts) fails loudly here.
GD_DEFECTIVE_IDS="$GD_DEFECTIVE/GD-IDS.yaml"
GD_DEFECTIVE_KEYS_OK=1
GD_DEFECTIVE_KEYS_WHY=""
for key in 'doc_status:' 'depends_on:' 'forbidden_aliases:'; do
    grep -q "$key" "$GD_DEFECTIVE_IDS" 2>/dev/null || { GD_DEFECTIVE_KEYS_OK=0; GD_DEFECTIVE_KEYS_WHY+=" $key"; }
done
if [[ "$GD_DEFECTIVE_KEYS_OK" -eq 1 ]]; then
    pass "defective-gdd GD-IDS.yaml — canonical schema keys present (doc_status/depends_on/forbidden_aliases)"
else
    fail "defective-gdd GD-IDS.yaml — missing canonical schema key(s):$GD_DEFECTIVE_KEYS_WHY"
fi

# Market-research delegation upgrade — explore-owned delegation contract + strict
# market-scan. The brainstorm→explore contract moved OUT of gd-principles into
# unikit-gd-explore/references/delegation-contract.md (provider-owns-spec); the
# CONCEPT machine-block grew 2→6 fields. Guard the wiring so a re-introduced
# dangling gd-principles→delegation pointer, a shrunk machine-block, a dropped
# verdict enum, or a contract missing its canonical marker fails loudly.
GD_CONTRACT="$ROOT_DIR/skills/unikit-gd-explore/references/delegation-contract.md"
GD_CONCEPT_TPL="$GD_DATA/templates/CONCEPT.md"
GD_CANONICAL_MARKER='Return the brief into this session as text; do not save any files.'

# (1) CONCEPT machine-block carries all 6 machine fields lifted from the brief.
GD_CONCEPT_FIELDS_OK=1
for field in market_signal validation_confidence clone_density trend_fit monetization_fit recommendation; do
    grep -qE "^> \*\*$field\*\*:" "$GD_CONCEPT_TPL" || GD_CONCEPT_FIELDS_OK=0
done
if [[ "$GD_CONCEPT_FIELDS_OK" -eq 1 ]]; then
    pass "CONCEPT.md — 6 machine fields present (market_signal…recommendation)"
else
    fail "CONCEPT.md — machine-block missing one of the 6 fields (market_signal/validation_confidence/clone_density/trend_fit/monetization_fit/recommendation)"
fi
# A 6-field count would not catch a dropped enum value, so also assert the
# recommendation verdict keeps its 5th value (the brief does not lift without it).
if grep -qE '^> \*\*recommendation\*\*:.*proceed-with-differentiation' "$GD_CONCEPT_TPL"; then
    pass "CONCEPT.md — recommendation keeps the proceed-with-differentiation verdict"
else
    fail "CONCEPT.md — recommendation enum dropped proceed-with-differentiation"
fi

# (2) gd-principles is silent on delegation (case-insensitive — a stray lowercase
#     mention in the intro must also fail).
if grep -qi "cross-skill delegation" "$GD_PRINCIPLES"; then
    fail "gd-principles.md — still mentions 'cross-skill delegation' (contract moved to unikit-gd-explore)"
else
    pass "gd-principles.md — no 'cross-skill delegation' (delegation is explore-owned)"
fi

# (3) The explore-owned contract exists and carries the canonical marker verbatim.
#     'contains', NOT 'sole home' — the marker is duplicated verbatim by design in
#     brainstorm's delegate prompt, explore's detector, and market-scan.
if [[ ! -s "$GD_CONTRACT" ]]; then
    fail "delegation-contract.md — missing or empty (skills/unikit-gd-explore/references/)"
elif grep -qF "$GD_CANONICAL_MARKER" "$GD_CONTRACT"; then
    pass "delegation-contract.md — present + carries the canonical marker"
else
    fail "delegation-contract.md — missing the canonical marker verbatim"
fi

# (4) Permanent orphan assert: nothing in skills/ or data/ couples gd-principles to
#     the delegation contract anymore — both the section-name form and rephrased
#     forms. A re-introduced dangling pointer fails here, not only at commit time.
GD_DELEG_ORPHANS=$(grep -rniE "gd-principles[^.]{0,40}(cross-skill )?delegation|delegation contract.{0,20}gd-principles" "$ROOT_DIR/skills" "$ROOT_DIR/data" 2>/dev/null || true)
if [[ -z "$GD_DELEG_ORPHANS" ]]; then
    pass "no gd-principles→delegation orphan references in skills/ + data/"
else
    fail "gd-principles→delegation orphan reference(s) found: $GD_DELEG_ORPHANS"
fi

# T5/T6 content guards — the FIRST content asserts on skill REFERENCE files. The
# templates/* + fixture greps above do not cover section-packs.md / lenses.md /
# the gd-review|gd-verify SKILL bodies, so re-key/lens drift would pass silently.
# These are cheap grep invariants on the keying + lens edits; the lenses actually
# FIRING is checked by the manual smoke (bash cannot run an LLM skill).
GD_SECTION_PACKS="$ROOT_DIR/skills/unikit-gd-system/references/section-packs.md"
GD_LENSES="$ROOT_DIR/skills/unikit-gd-review/references/lenses.md"
GD_REVIEW_SKILL="$ROOT_DIR/skills/unikit-gd-review/SKILL.md"
GD_SYSTEM_SKILL="$ROOT_DIR/skills/unikit-gd-system/SKILL.md"
# (gd-improve was removed in P1 — create+revise unified in gd-system; gd-detail renamed
# to gd-system. $GD_VERIFY_SKILL is defined above in the status-spine block.)

# (1) Both new section-packs exist (T5: SP2 ai-behavior, SP3 persistence).
GD_PACKS_WHY=""
if ! grep -qF '## Pack: ai-behavior' "$GD_SECTION_PACKS"; then GD_PACKS_WHY+=" ai-behavior"; fi
if ! grep -qF '## Pack: persistence' "$GD_SECTION_PACKS"; then GD_PACKS_WHY+=" persistence"; fi
if [[ -z "$GD_PACKS_WHY" ]]; then
    pass "section-packs.md — ai-behavior + persistence packs present (T5)"
else
    fail "section-packs.md — missing pack block(s):$GD_PACKS_WHY"
fi

# (2) fantasy-delivery core lens landed in lenses.md (T6: L1).
if grep -qF 'fantasy-delivery' "$GD_LENSES"; then
    pass "lenses.md — fantasy-delivery core lens present (T6)"
else
    fail "lenses.md — missing fantasy-delivery core lens"
fi

# (3) The dead /unikit-evolve cross-skill ref is gone from gd-review + gd-verify
#     (R3, both sides). FILE-SCOPED on purpose: the literal '/unikit-evolve' lives
#     in ~11 files under skills/ (the unikit-evolve skill itself + others), so a
#     repo-wide `grep -r "$ROOT_DIR/skills"` would always be red. Expect 0 matches
#     in EACH of the two skill bodies.
GD_EVOLVE_WHY=""
if grep -qF '/unikit-evolve' "$GD_REVIEW_SKILL"; then GD_EVOLVE_WHY+=" gd-review"; fi
if grep -qF '/unikit-evolve' "$GD_VERIFY_SKILL"; then GD_EVOLVE_WHY+=" gd-verify"; fi
if [[ -z "$GD_EVOLVE_WHY" ]]; then
    pass "gd-review + gd-verify — no dead /unikit-evolve reference (R3)"
else
    fail "stale /unikit-evolve reference still in:$GD_EVOLVE_WHY (R3 — route to /unikit-memory --module gamedesign)"
fi

# (4) Keying vocabulary: the unified gd-system Phase 0 table carries the two new
#     domains (T5 goal — create+revise share one keying table now that gd-improve is
#     folded in).
GD_KEYING_WHY=""
for f in "$GD_SYSTEM_SKILL"; do
    bn=$(basename "$(dirname "$f")")
    if ! grep -qF 'ai-behavior' "$f"; then GD_KEYING_WHY+=" $bn(ai-behavior)"; fi
    if ! grep -qF 'persistence' "$f"; then GD_KEYING_WHY+=" $bn(persistence)"; fi
done
if [[ -z "$GD_KEYING_WHY" ]]; then
    pass "gd-system Phase 0 — ai-behavior + persistence domains present (T5 keying — unified zone)"
else
    fail "Phase 0 keying drift:$GD_KEYING_WHY"
fi

# T7/T8 content guards (provenance contract + implemented wire-back). All greps are
# FILE-SCOPED (like the T5/T6 absence-grep above), never repo-wide. The writer/reader
# actually FIRING is checked by the manual smoke (bash cannot run an LLM skill); these
# assert the contract text is present on each surface. New path vars: the GAME.md and
# GD-IDS templates, the *code-module* unikit-verify / unikit-plan skills ($GD_VERIFY_SKILL
# above is the *design* gd-verify — a different file), and the canonical unikit-verify
# ownership contract.
GD_GAME_TPL="$GD_DATA/templates/GAME.md"
GD_IDS_TPL="$GD_DATA/templates/GD-IDS.yaml"
UNIKIT_VERIFY_SKILL="$ROOT_DIR/skills/unikit-verify/SKILL.md"
UNIKIT_PLAN_SKILL="$ROOT_DIR/skills/unikit-plan/SKILL.md"
UNIKIT_VERIFY_CONTRACT="$ROOT_DIR/skills/unikit-verify/references/CONTEXT-GATES-AND-OWNERSHIP.md"

# (T7-1) Provenance contract section in the gd-provenance shard (GP2).
if grep -q '^## Provenance' "$GD_PROVENANCE"; then
    pass "gd-provenance — ## Provenance (imports) section present (T7 GP2)"
else
    fail "gd-provenance — missing ## Provenance (imports) section (T7 GP2)"
fi

# (T7-2) Provenance lens in lenses.md (L2).
if grep -qF 'Provenance lens' "$GD_LENSES"; then
    pass "lenses.md — Provenance lens present (T7 L2)"
else
    fail "lenses.md — missing Provenance lens (T7 L2)"
fi

# (T7-3) GAME.md template carries a ## Changelog section (closes the T2 hole).
if grep -q '^## Changelog' "$GD_GAME_TPL"; then
    pass "GAME.md template — ## Changelog section present (T7)"
else
    fail "GAME.md template — missing ## Changelog section (T7)"
fi

# (T7-4) GAME.md Delta-Discipline carve-out in the gd-authoring shard (#16) —
#        file-scoped on the unique marker phrase inside ## Delta Discipline.
if grep -qF 'GAME.md exception (not a system)' "$GD_AUTHORING"; then
    pass "gd-authoring — GAME.md Delta-Discipline carve-out present (#16)"
else
    fail "gd-authoring — missing GAME.md Delta-Discipline carve-out (#16)"
fi

# (T8-5) implemented_version field in the GD-IDS template (#9).
if grep -qF 'implemented_version' "$GD_IDS_TPL"; then
    pass "GD-IDS template — implemented_version field present (T8)"
else
    fail "GD-IDS template — missing implemented_version field (T8)"
fi

# (P0-T3) GD-IDS template is schema v2 and carries the systems `category` field
#         (unikit-plan matches the plan brief on category) plus the new flows/events
#         sections of the Flow axis.
GD_IDS_V2_WHY=""
grep -qE '^version: 2$' "$GD_IDS_TPL"        || GD_IDS_V2_WHY+=" version:2"
grep -qF 'category:' "$GD_IDS_TPL"           || GD_IDS_V2_WHY+=" category"
grep -qE '^flows: \[\]' "$GD_IDS_TPL"        || GD_IDS_V2_WHY+=" flows"
grep -qE '^events: \[\]' "$GD_IDS_TPL"       || GD_IDS_V2_WHY+=" events"
# Content axis (Stage 0) — the 5 additive sections ship empty (non-empty-gate, the
# flows/events precedent). version stays 2 (additive, no schema bump).
grep -qE '^content_types: \[\]' "$GD_IDS_TPL" || GD_IDS_V2_WHY+=" content_types"
grep -qE '^content: \[\]' "$GD_IDS_TPL"       || GD_IDS_V2_WHY+=" content"
grep -qE '^resources: \[\]' "$GD_IDS_TPL"     || GD_IDS_V2_WHY+=" resources"
grep -qE '^tracks: \[\]' "$GD_IDS_TPL"        || GD_IDS_V2_WHY+=" tracks"
grep -qE '^knobs: \[\]' "$GD_IDS_TPL"         || GD_IDS_V2_WHY+=" knobs"
if [[ -z "$GD_IDS_V2_WHY" ]]; then
    pass "GD-IDS template — schema v2 + category + flows/events + content_types/content/resources/tracks/knobs sections (P0-T3 + Content Stage 0)"
else
    fail "GD-IDS template — missing:$GD_IDS_V2_WHY (P0-T3 + Content Stage 0)"
fi

# (T8-6) Both the writer (unikit-verify) and the reader (unikit-plan) name
#        implemented_version. The reader half moved into the extracted
#        references/design-context.md (the mode-extraction refactor pulled Step 4.5
#        out of unikit-plan/SKILL.md); the writer half stays in unikit-verify/SKILL.md.
UNIKIT_PLAN_DESIGN_CONTEXT="$ROOT_DIR/skills/unikit-plan/references/design-context.md"
GD_IMPL_WHY=""
grep -qF 'implemented_version' "$UNIKIT_VERIFY_SKILL"        || GD_IMPL_WHY+=" unikit-verify(writer)"
grep -qF 'implemented_version' "$UNIKIT_PLAN_DESIGN_CONTEXT" || GD_IMPL_WHY+=" unikit-plan(reader→design-context.md)"
if [[ -z "$GD_IMPL_WHY" ]]; then
    pass "unikit-verify + unikit-plan — implemented_version wired (T8 writer/reader)"
else
    fail "implemented_version missing in:$GD_IMPL_WHY (T8)"
fi

# (T8-7) v2 SINGLE-surface writeback: the implemented marker is `implemented_version`
#        in GD-IDS ONLY; GAME.md `## System Map [gen]` renders `implemented` read-only.
#        The old GD-INDEX Status second surface is gone — assert unikit-verify no longer
#        documents it (the systemic no-GD-INDEX guard below also covers this file).
if grep -qF 'GD-INDEX Status=implemented' "$UNIKIT_VERIFY_SKILL"; then
    fail "unikit-verify — still documents a GD-INDEX Status writeback (T8 must be single-surface in v2)"
else
    pass "unikit-verify — implemented writeback is single-surface, no GD-INDEX second surface (T8 v2)"
fi

# (T8-8) Sanctioned code→design exception in the gd-principles One-Way Boundary (#8).
# NOTE: the count grew "two" → "three" when the brownfield research-verb exception landed
# (gd-recon/explore code lens); the RD-3 guard below asserts the third bullet's content.
if grep -qF 'Sanctioned exceptions (three, narrow)' "$GD_PRINCIPLES"; then
    pass "gd-principles — One-Way Boundary code→design exception present (T8 #8)"
else
    fail "gd-principles — missing One-Way Boundary code→design exception (T8 #8)"
fi

# (T8-9) MANDATORY: the canonical ownership contract carries the sanctioned write.
#        This file overrides the SKILL body (unikit-verify Step 0.0), yet it is the
#        surface most likely to silently regress the carve-out — and until now it was
#        never grepped by this runner.
if grep -qF 'Single sanctioned design write' "$UNIKIT_VERIFY_CONTRACT"; then
    pass "CONTEXT-GATES-AND-OWNERSHIP — sanctioned design-write exception present (T8 canonical)"
else
    fail "CONTEXT-GATES-AND-OWNERSHIP — missing sanctioned design-write exception (T8 canonical)"
fi

# Internal-design-lens content guards (gd-explore internal lens + downstream wiring —
# the feature-internal-design-lens plan, Tasks 1-9). All greps are FILE-SCOPED and
# case-sensitive `-qF` (MSYS grep aborts on `-iF`). bash cannot run an LLM skill; these
# assert the contract text is present on each surface. New path vars (absent until now):
# the gd-spec / gd-explore SKILLs and the new lens engine reference. Reuses
# GD_SYSTEM_SKILL (defined above; the renamed gd-detail that also absorbed gd-improve),
# GD_VERIFY_SKILL (the *design* gd-verify) and GD_IDS_TPL.
GD_SPEC_SKILL="$ROOT_DIR/skills/unikit-gd-spec/SKILL.md"
GD_EXPLORE_SKILL="$ROOT_DIR/skills/unikit-gd-explore/SKILL.md"
# Extracted gd-explore reference bodies (input modes + save-research) — guard targets
# for content moved out of SKILL.md (context-cost refactor, 2026-06-26).
GD_EXPLORE_SAVE_RESEARCH="$ROOT_DIR/skills/unikit-gd-explore/references/save-research.md"
GD_EXPLORE_RESEARCH_BUCKET="$ROOT_DIR/skills/unikit-gd-explore/references/mode-research-bucket.md"
GD_EXPLORE_RECON_INPUT="$ROOT_DIR/skills/unikit-gd-explore/references/mode-recon-input.md"
GD_INTERNAL_LENS="$ROOT_DIR/skills/unikit-gd-explore/references/internal-design-lens.md"

# (IL-1) The new engine reference exists, carries both mode-aware brief blocks, and
#        mirrors the shared domain keying vocabulary (parity, NOT byte-identity — this
#        table loads rules to ground options, gd-system to author sections).
IL_LENS_WHY=""
[[ -s "$GD_INTERNAL_LENS" ]]                        || IL_LENS_WHY+=" missing-file"
grep -qF '## Improvement Plan' "$GD_INTERNAL_LENS"  || IL_LENS_WHY+=" improvement-plan-block"
grep -qF '## New Feature Plan' "$GD_INTERNAL_LENS"  || IL_LENS_WHY+=" new-feature-plan-block"
grep -qF 'ai-behavior' "$GD_INTERNAL_LENS"          || IL_LENS_WHY+=" ai-behavior(keying-parity)"
grep -qF 'persistence' "$GD_INTERNAL_LENS"          || IL_LENS_WHY+=" persistence(keying-parity)"
if [[ -z "$IL_LENS_WHY" ]]; then
    pass "internal-design-lens.md — present + both brief blocks + domain keying parity (IL T1)"
else
    fail "internal-design-lens.md — missing:$IL_LENS_WHY"
fi

# (IL-2) gd-explore SKILL carries the lens switch: the section, its decision rule, the
#        3-way doc_status routing, the read-only warning, and the Target/Kind tags.
IL_EXPLORE_WHY=""
grep -qF '## Internal design lens' "$GD_EXPLORE_SKILL"          || IL_EXPLORE_WHY+=" lens-section"
grep -qF 'Internal-design signals present' "$GD_EXPLORE_SKILL"  || IL_EXPLORE_WHY+=" decision-rule"
grep -qF '3-way handoff routing' "$GD_EXPLORE_SKILL"            || IL_EXPLORE_WHY+=" 3-way-routing"
grep -qF "I won't edit the GDD" "$GD_EXPLORE_SKILL"             || IL_EXPLORE_WHY+=" read-only-warning"
grep -qF 'Kind: feature | improvement' "$GD_EXPLORE_SAVE_RESEARCH" || IL_EXPLORE_WHY+=" kind-tag"
grep -qF 'Target: SYS-<slug>' "$GD_EXPLORE_SAVE_RESEARCH"          || IL_EXPLORE_WHY+=" target-tag"
if [[ -z "$IL_EXPLORE_WHY" ]]; then
    pass "gd-explore SKILL — lens section + decision rule + 3-way routing + read-only + Target/Kind (IL T2)"
else
    fail "gd-explore SKILL — missing:$IL_EXPLORE_WHY"
fi

# (IL-3) gd-spec Add-System mode + the active seam onward to the system zone.
# The Add-System body moved to references/mode-add-system.md (mode-extraction refactor);
# retarget both literals there. The mode dispatch stays in gd-spec/SKILL.md.
GD_SPEC_ADD_SYSTEM="$ROOT_DIR/skills/unikit-gd-spec/references/mode-add-system.md"
IL_SPEC_WHY=""
grep -qF '## Add-System Mode' "$GD_SPEC_ADD_SYSTEM"  || IL_SPEC_WHY+=" add-system-mode"
grep -qF 'Active seam' "$GD_SPEC_ADD_SYSTEM"         || IL_SPEC_WHY+=" active-seam"
if [[ -z "$IL_SPEC_WHY" ]]; then
    pass "gd-spec — Add-System mode + active seam to gd-system (IL T3, → mode-add-system.md)"
else
    fail "gd-spec — missing:$IL_SPEC_WHY (→ mode-add-system.md)"
fi

# (IL-4) Research-discovery wired into BOTH downstream consumers (the `research:`
#        pointer + the `Target:` INDEX fallback — the backtick token `Target:` is unique
#        to the discovery bullet; the Final-report `Target:` line has no backticks, and a
#        single token cannot be split by a line-wrap), and gd-system instructs leaving
#        explore-seeded drafts UNTAGGED (the Task-4 carve-out: not extracted/generated —
#        those markers are imports-only). One consumer now (gd-system owns both the
#        New-Feature create path and the Improvement revise path).
IL_DISC_WHY=""
for f in "$GD_SYSTEM_SKILL"; do
    bn=$(basename "$(dirname "$f")")
    grep -qF 'research:' "$f"     || IL_DISC_WHY+=" $bn(research-pointer)"
    grep -qF '`Target:`' "$f"     || IL_DISC_WHY+=" $bn(target-fallback)"
done
grep -qF 'explore-seeded drafts' "$GD_SYSTEM_SKILL" || IL_DISC_WHY+=" gd-system(untagged-carveout)"
if [[ -z "$IL_DISC_WHY" ]]; then
    pass "gd-system — research-discovery (research:/Target) + untagged carve-out (IL T4)"
else
    fail "research-discovery wiring missing:$IL_DISC_WHY"
fi

# (IL-5) The `research:` field is canonical: present in the GD-IDS template, and carved
#        out of gd-verify coherence/id-resolution (Task 9). The carve-out hangs on the
#        value's FORM (a path, not an id), so no special-case check logic is added.
IL_FIELD_WHY=""
grep -qF 'research:' "$GD_IDS_TPL"             || IL_FIELD_WHY+=" gd-ids-template"
grep -qF 'Non-id metadata' "$GD_VERIFY_SKILL"  || IL_FIELD_WHY+=" gd-verify-carveout"
if [[ -z "$IL_FIELD_WHY" ]]; then
    pass "research: field — GD-IDS template + gd-verify carve-out present (IL T9)"
else
    fail "research: field canonicalization missing:$IL_FIELD_WHY"
fi

# (P1 clean break) unikit-gd-improve is GONE — its create+revise lifecycle folded into
# unikit-gd-system (systems) and GAME.md content edits into unikit-gd-spec. Assert the
# skill dir is absent AND no live `gd-improve` reference survives in the design skills
# (unikit-gd-*, SKILL bodies + references) or the code-side / cross-cutting files that
# routed to it (unikit-explore routing, unikit-plan status note, the gamedesign module
# contract). FILE-SCOPED -qF (MSYS grep aborts on -iF). NOT in scope: .claude/CLAUDE.md
# / README / docs (their deep narrative is a later phase) and scripts/ test guards.
NOIMP_WHY=""
[[ -d "$ROOT_DIR/skills/unikit-gd-improve" ]] && NOIMP_WHY+=" skill-dir-present"
NOIMP_FILES=$(find "$ROOT_DIR/skills" -path '*/unikit-gd-*/*.md' 2>/dev/null)
NOIMP_FILES="$NOIMP_FILES $ROOT_DIR/skills/unikit-explore/SKILL.md $ROOT_DIR/skills/unikit-plan/SKILL.md $ROOT_DIR/skills/unikit-memory/references/module-gamedesign.md"
for f in $NOIMP_FILES; do
    [[ -f "$f" ]] || continue
    grep -qF 'gd-improve' "$f" && NOIMP_WHY+=" ${f#$ROOT_DIR/}"
done
if [[ -z "$NOIMP_WHY" ]]; then
    pass "no unikit-gd-improve — skill removed + zero gd-improve refs in design/code skills (P1 clean break)"
else
    fail "unikit-gd-improve leftover:$NOIMP_WHY"
fi

# (P1 clean break) Systemic no-GD-INDEX guard (parity with the no-improve guard; this
# is the ONLY mechanical net under the hand-cleaned design+code skills — leftover
# GD-INDEX refs there are otherwise uncaught). v2 dropped the standalone markdown
# system-index: the roster renders into GAME.md `## System Map [gen]`. Assert ZERO
# literal `GD-INDEX` in the design skills (unikit-gd-*), the code-side skills that
# read/write design (unikit-{plan,verify,explore}, incl. references), and the design
# data (data/gamedesign/ templates + gd-principles + GD-IDS.yaml). FILE-SCOPED -qF.
# NOT in scope: .claude/CLAUDE.md / README / docs/skills.md (deep narrative deferred).
NOIDX_WHY=""
NOIDX_FILES=$(find "$ROOT_DIR/skills" -path '*/unikit-gd-*/*.md' 2>/dev/null)
NOIDX_FILES="$NOIDX_FILES $(find "$ROOT_DIR/skills/unikit-plan" "$ROOT_DIR/skills/unikit-verify" "$ROOT_DIR/skills/unikit-explore" -name '*.md' 2>/dev/null)"
NOIDX_FILES="$NOIDX_FILES $(find "$ROOT_DIR/data/gamedesign" -name '*.md' 2>/dev/null) $ROOT_DIR/data/gamedesign/templates/GD-IDS.yaml"
for f in $NOIDX_FILES; do
    [[ -f "$f" ]] || continue
    grep -qF 'GD-INDEX' "$f" && NOIDX_WHY+=" ${f#$ROOT_DIR/}"
done
if [[ -z "$NOIDX_WHY" ]]; then
    pass "systemic no-GD-INDEX — zero GD-INDEX in gd-* + plan/verify/explore + data/gamedesign (P1 v2)"
else
    fail "stale GD-INDEX reference(s):$NOIDX_WHY"
fi

# ── Flow-axis content guards (FL-1…FL-8) ─────────────────────────────────────
# PR#6 (feature/gd-flow-axis Phase 2/3) added the FLOW axis: the unikit-gd-flow zone
# skill, the flow checks in unikit-gd-verify, the flow lenses in unikit-gd-review, the
# Flow-axis process contracts in gd-principles, the code-side flow-read
# (unikit-plan / unikit-explore), the upstream brief surface (gd-brainstorm / gd-explore
# / internal-design-lens), and the defective-gdd flow fixture. bash cannot run an LLM
# skill, so these are grep invariants on the contract text. New path vars
# GD_FLOW_SKILL / GD_BRAINSTORM_SKILL / UNIKIT_EXPLORE_SKILL (GD_FLOW_TPL is defined in
# the status-spine block above) + reuse of GD_GAME_TPL / GD_PRINCIPLES / GD_VERIFY_SKILL
# / GD_REVIEW_SKILL / GD_LENSES / GD_EXPLORE_SKILL / GD_INTERNAL_LENS / GD_SPEC_SKILL /
# UNIKIT_PLAN_SKILL (all defined earlier in Part 6). All greps FILE-SCOPED -qF; the
# negative checks use `grep -qF … && WHY+=…` (same set-e-safe idiom as the no-improve
# guard). MSYS grep aborts on -iF, so every anchor is case-sensitive.
GD_FLOW_SKILL="$ROOT_DIR/skills/unikit-gd-flow/SKILL.md"
GD_BRAINSTORM_SKILL="$ROOT_DIR/skills/unikit-gd-brainstorm/SKILL.md"
UNIKIT_EXPLORE_SKILL="$ROOT_DIR/skills/unikit-explore/SKILL.md"
GD_DEFECTIVE_DIR="$ROOT_DIR/scripts/test-fixtures/gamedesign/defective-gdd"

# (FL-1) The flow-zone skill exists, and the FLOW.md template carries the mode-aware
# structure both authoring forms need (objective-flow table for linear/conditional,
# affordance template + pacing envelope for emergent), the funnel Events section, and
# the GOAL-delta changelog line.
FL_SKILL_WHY=""
[[ -s "$GD_FLOW_SKILL" ]]                              || FL_SKILL_WHY+=" missing-skill"
grep -qF 'flow zone' "$GD_FLOW_SKILL"                  || FL_SKILL_WHY+=" no-flow-zone-anchor"
grep -qF 'Objective-flow table' "$GD_FLOW_TPL"         || FL_SKILL_WHY+=" tpl-objective-table"
grep -qF 'Affordance / goal-template' "$GD_FLOW_TPL"   || FL_SKILL_WHY+=" tpl-affordance"
grep -qF 'pacing envelope' "$GD_FLOW_TPL"              || FL_SKILL_WHY+=" tpl-pacing-envelope"
grep -qF '## E. Events (Funnel)' "$GD_FLOW_TPL"        || FL_SKILL_WHY+=" tpl-events"
grep -qF 'GOAL: + GOAL-' "$GD_FLOW_TPL"                || FL_SKILL_WHY+=" tpl-goal-delta"
if [[ -z "$FL_SKILL_WHY" ]]; then
    pass "FL-1 gd-flow skill present + FLOW.md template mode-aware content (table/affordance/envelope, Events, GOAL-delta)"
else
    fail "FL-1 gd-flow skill / FLOW.md template incomplete:$FL_SKILL_WHY"
fi

# (FL-2) GAME.md ships both [gen] render surfaces, and the F1 attribution is aligned:
# the Flow Map + Funnel are rendered by unikit-gd-flow while the System Map stays
# unikit-gd-spec. F2: ZERO "aggregated in `## Funnel`" in the GAME.md template OR the
# gd-spec body — the contradictory L132 line was removed in P2-T1 (per-flow funnel lives
# in ## Funnel; global/meta goals live in ## Monetization Stance, not aggregated here).
FL_MAP_WHY=""
grep -qF '## Flow Map [gen]' "$GD_GAME_TPL"                 || FL_MAP_WHY+=" no-flow-map-block"
grep -qF '## Funnel [gen]' "$GD_GAME_TPL"                   || FL_MAP_WHY+=" no-funnel-block"
grep -qF '`flows` by `unikit-gd-flow`' "$GD_GAME_TPL"       || FL_MAP_WHY+=" flow-map-not-gd-flow"
grep -qF '`events` by `unikit-gd-flow`' "$GD_GAME_TPL"      || FL_MAP_WHY+=" funnel-not-gd-flow"
grep -qF '`systems` by `unikit-gd-spec`' "$GD_GAME_TPL"     || FL_MAP_WHY+=" system-map-not-gd-spec"
grep -qF 'aggregated in `## Funnel`' "$GD_GAME_TPL"         && FL_MAP_WHY+=" F2-game-tpl-funnel-aggregation"
grep -qF 'aggregated in `## Funnel`' "$GD_SPEC_SKILL"       && FL_MAP_WHY+=" F2-gd-spec-funnel-aggregation"
if [[ -z "$FL_MAP_WHY" ]]; then
    pass "FL-2 GAME.md ## Flow Map/## Funnel by unikit-gd-flow + ## System Map by unikit-gd-spec (F1); zero funnel-aggregation in monetization (F2)"
else
    fail "FL-2 GAME.md flow render-surface / attribution drift:$FL_MAP_WHY"
fi

# (Content Stage 0, mirror of FL-2) GAME.md ships the ## Content Map [gen] render surface
# attributed to unikit-gd-content, while the System Map stays unikit-gd-spec — the content
# zone owns its own [gen] render, not gd-spec (no add-content in gd-spec).
CT_MAP_WHY=""
grep -qF '## Content Map [gen]' "$GD_GAME_TPL"                    || CT_MAP_WHY+=" no-content-map-block"
grep -qF '`content_types` by `unikit-gd-content`' "$GD_GAME_TPL"  || CT_MAP_WHY+=" content-map-not-gd-content"
grep -qF '`systems` by `unikit-gd-spec`' "$GD_GAME_TPL"           || CT_MAP_WHY+=" system-map-not-gd-spec"
if [[ -z "$CT_MAP_WHY" ]]; then
    pass "Content Stage 0 — GAME.md ## Content Map [gen] by unikit-gd-content + ## System Map by unikit-gd-spec (attribution aligned)"
else
    fail "Content Stage 0 — GAME.md content render-surface / attribution drift:$CT_MAP_WHY"
fi

# (Content Stage 1) The unikit-gd-content zone skill carries its contract: the CT-/CU- codes,
# the scale selection (bulk|curated), self-registration of content_types/content + the
# ## Content Map [gen] re-render, the RES/TRACK/KNOB fact registration, belongs_to + the
# re-entry seam to gd-spec add-system, and the ref<> universality lever. (The skeleton-level
# Language Awareness + shard binding are covered by Part 11 + the split-5 binding above.)
GD_CONTENT_SKILL="$ROOT_DIR/skills/unikit-gd-content/SKILL.md"
CT_SKILL_WHY=""
[[ -f "$GD_CONTENT_SKILL" ]] || CT_SKILL_WHY+=" no-skill-file"
grep -qF 'CT-<slug>' "$GD_CONTENT_SKILL"            || CT_SKILL_WHY+=" no-CT-code"
grep -qF 'CU-<ct>-<n>' "$ROOT_DIR/skills/unikit-gd-content/references/mode-author.md" || CT_SKILL_WHY+=" no-CU-code"
grep -qF 'bulk | curated' "$GD_CONTENT_SKILL"       || CT_SKILL_WHY+=" no-scale"
grep -qF 'content_types' "$GD_CONTENT_SKILL"        || CT_SKILL_WHY+=" no-self-register"
grep -qF '## Content Map [gen]' "$GD_CONTENT_SKILL" || CT_SKILL_WHY+=" no-content-map-render"
grep -qF 'belongs_to' "$GD_CONTENT_SKILL"           || CT_SKILL_WHY+=" no-belongs_to"
grep -qF 'RES-' "$GD_CONTENT_SKILL"                 || CT_SKILL_WHY+=" no-RES"
grep -qF 'TRACK-' "$GD_CONTENT_SKILL"               || CT_SKILL_WHY+=" no-TRACK"
grep -qF 'KNOB-' "$GD_CONTENT_SKILL"                || CT_SKILL_WHY+=" no-KNOB"
grep -qF 'ref<' "$GD_CONTENT_SKILL"                 || CT_SKILL_WHY+=" no-ref"
grep -qF 'add-system' "$GD_CONTENT_SKILL"           || CT_SKILL_WHY+=" no-reentry-seam"
if [[ -z "$CT_SKILL_WHY" ]]; then
    pass "Content Stage 1 — unikit-gd-content carries CT/CU codes, scale, self-register+map render, RES/TRACK/KNOB, belongs_to+seam, ref<>"
else
    fail "Content Stage 1 — unikit-gd-content skill contract incomplete:$CT_SKILL_WHY"
fi

# (FL-3) unikit-gd-verify carries the flow-check family — the mirror of the system
# checks plus the flow-specific ones (mode↔structure, Win/Lose↔terminal GOAL, funnel
# continuity, cross-axis impact). Arrows are matched byte-for-byte (-qF, not -iF).
FL_VERIFY_WHY=""
grep -qF 'Flow checks (axis-aware' "$GD_VERIFY_AXIS"        || FL_VERIFY_WHY+=" flow-checks-section"
grep -qF 'GOAL id validity' "$GD_VERIFY_AXIS"               || FL_VERIFY_WHY+=" goal-id-validity"
grep -qF 'Dangling `GOAL' "$GD_VERIFY_AXIS"                 || FL_VERIFY_WHY+=" dangling-goal"
grep -qF 'mode ↔ structure' "$GD_VERIFY_AXIS"               || FL_VERIFY_WHY+=" mode-structure"
grep -qF 'Win/Lose ↔ terminal GOAL' "$GD_VERIFY_AXIS"       || FL_VERIFY_WHY+=" win-lose-terminal"
grep -qF 'Funnel continuity' "$GD_VERIFY_AXIS"              || FL_VERIFY_WHY+=" funnel-continuity"
grep -qF 'Flow Depends 3-way' "$GD_VERIFY_AXIS"             || FL_VERIFY_WHY+=" flow-depends-3way"
grep -qF 'Flow / Funnel map freshness' "$GD_VERIFY_AXIS"    || FL_VERIFY_WHY+=" flow-map-freshness"
grep -qF 'Cross-axis impact' "$GD_VERIFY_SKILL"             || FL_VERIFY_WHY+=" cross-axis-impact"
if [[ -z "$FL_VERIFY_WHY" ]]; then
    pass "FL-3 unikit-gd-verify flow checks present (3-surface, dangling GOAL, mode↔structure, win/lose, funnel, GOAL-id, depends-3way, cross-axis)"
else
    fail "FL-3 unikit-gd-verify flow checks missing:$FL_VERIFY_WHY"
fi

# (FL-4) unikit-gd-review flow lenses are present AND activated — the three flow lenses
# carry real adversarial prompts in lenses.md, the SKILL body marks them active, and
# ZERO "stub — Flow axis" gating survives in EITHER file (P2-T4 removed the Phase-2
# stubs in both — a residual stub in lenses.md would leave them gated under a green test).
FL_REVIEW_WHY=""
grep -qF '**pacing**' "$GD_LENSES"                  || FL_REVIEW_WHY+=" lenses-pacing"
grep -qF '**guidance**' "$GD_LENSES"                || FL_REVIEW_WHY+=" lenses-guidance"
grep -qF '**funnel**' "$GD_LENSES"                  || FL_REVIEW_WHY+=" lenses-funnel"
grep -qF 'Flow lenses (active)' "$GD_REVIEW_SKILL"  || FL_REVIEW_WHY+=" skill-flow-active"
grep -qF 'stub — Flow axis' "$GD_LENSES"            && FL_REVIEW_WHY+=" residual-stub-lenses"
grep -qF 'stub — Flow axis' "$GD_REVIEW_SKILL"      && FL_REVIEW_WHY+=" residual-stub-skill"
if [[ -z "$FL_REVIEW_WHY" ]]; then
    pass "FL-4 gd-review flow lenses present (pacing/guidance/funnel) + activated (zero 'stub — Flow axis' in SKILL+lenses)"
else
    fail "FL-4 gd-review flow lenses incomplete/gated:$FL_REVIEW_WHY"
fi

# (FL-5) the gd-flow-axis shard carries the Flow-axis process contracts (the
# AC · GOAL · event grammar, the Flow Axis + Cross-axis staleness sections, FLOW/GOAL
# codes, the wiring mode rule, C5 Win/Lose↔terminal GOAL). The F1 ownership alignment
# stays on the CORE (Zone Ownership): unikit-gd-flow registers the flow (there is no
# add-flow in unikit-gd-spec), so ZERO "registers a flow" is attributed to gd-spec —
# in either the slim core or the gd-spec body.
FL_PRINC_WHY=""
grep -qF 'AC · GOAL · event' "$GD_FLOW_AXIS"             || FL_PRINC_WHY+=" grammar"
grep -qF '## Flow Axis' "$GD_FLOW_AXIS"                  || FL_PRINC_WHY+=" flow-axis-section"
grep -qF 'Cross-axis staleness' "$GD_FLOW_AXIS"          || FL_PRINC_WHY+=" cross-axis-staleness"
grep -qF 'FLOW-<slug>' "$GD_FLOW_AXIS"                   || FL_PRINC_WHY+=" flow-code"
grep -qF 'GOAL-<flow>-<n>' "$GD_FLOW_AXIS"               || FL_PRINC_WHY+=" goal-code"
grep -qF 'Wiring mode' "$GD_FLOW_AXIS"                   || FL_PRINC_WHY+=" wiring-mode"
grep -qF 'Win / Lose ↔ terminal GOAL' "$GD_FLOW_AXIS"    || FL_PRINC_WHY+=" c5-win-lose"
grep -qF 'there is no add-flow in' "$GD_PRINCIPLES"      || FL_PRINC_WHY+=" no-add-flow-contract"
grep -qF 'registers a flow' "$GD_PRINCIPLES"             && FL_PRINC_WHY+=" F1-core-registers-flow"
grep -qF 'registers a flow' "$GD_SPEC_SKILL"             && FL_PRINC_WHY+=" F1-gd-spec-registers-flow"
if [[ -z "$FL_PRINC_WHY" ]]; then
    pass "FL-5 gd-flow-axis flow contracts (grammar/codes/Flow Axis/cross-axis/wiring/C5) + F1 (no add-flow in core; zero 'registers a flow' at gd-spec)"
else
    fail "FL-5 flow contract drift:$FL_PRINC_WHY"
fi

# (FL-6) The code side reads BOTH axes: unikit-plan emits the optional ## Flow Context
# brief (flow-targeting), unikit-explore grounds on the flow axis. The explore-side
# flow-grounding contract moved behind the shared design-read contract + a first-class
# flow input (the inline "`flows` for grounding" literal was replaced); retarget the
# explore half to the new "First-class flow input" marker. The plan half (## Flow
# Context, outside the extracted Step 4.5) is unchanged. Read-only — the derived
# Realized state is never written back (one-way boundary stays systems-only).
FL_CODE_WHY=""
grep -qF '## Flow Context' "$UNIKIT_PLAN_SKILL"            || FL_CODE_WHY+=" plan-flow-context"
grep -qF 'First-class flow input' "$UNIKIT_EXPLORE_SKILL"  || FL_CODE_WHY+=" explore-flow-grounding(first-class)"
if [[ -z "$FL_CODE_WHY" ]]; then
    pass "FL-6 code flow-read present (unikit-plan ## Flow Context + unikit-explore first-class flow input)"
else
    fail "FL-6 code flow-read missing:$FL_CODE_WHY"
fi

# (FL-7) Upstream Maximal surface: the internal-design lens carries both flow brief
# blocks, gd-explore tags flow research (Target … FLOW-<slug>), and gd-brainstorm has
# the scenario/flow-seeds phase that feeds the dynamics axis downstream.
FL_UP_WHY=""
grep -qF '## Flow Improvement Plan' "$GD_INTERNAL_LENS"   || FL_UP_WHY+=" lens-improvement-block"
grep -qF '## Flow Feature Plan' "$GD_INTERNAL_LENS"       || FL_UP_WHY+=" lens-feature-block"
grep -qF 'FLOW-<slug>' "$GD_EXPLORE_SAVE_RESEARCH"        || FL_UP_WHY+=" explore-flow-target-tag"
grep -qF 'Scenario / Flow seeds' "$GD_BRAINSTORM_SKILL"   || FL_UP_WHY+=" brainstorm-flow-phase"
if [[ -z "$FL_UP_WHY" ]]; then
    pass "FL-7 upstream flow surface (internal-design-lens flow blocks, gd-explore FLOW target tag, gd-brainstorm flow phase)"
else
    fail "FL-7 upstream flow surface incomplete:$FL_UP_WHY"
fi

# (FL-8) The defective-gdd fixture grew the flow axis (P2-T5): a flows/FLOW-first-run.md
# on disk + non-empty GD-IDS flows/goals/events with one seeded defect per flow check
# (the README §"Flow-axis mechanical defects" documents each). bash cannot run the LLM
# smoke — assert the flow surface is present + well-formed; the agent-driven
# /unikit-gd-verify + /unikit-gd-review smoke reads the README ground truth.
FL_FIX_WHY=""
[[ -s "$GD_DEFECTIVE_DIR/flows/FLOW-first-run.md" ]]                  || FL_FIX_WHY+=" no-flow-doc"
grep -qF 'FLOW-first-run' "$GD_DEFECTIVE_DIR/GD-IDS.yaml"             || FL_FIX_WHY+=" no-flows-entry"
grep -qF 'goals:' "$GD_DEFECTIVE_DIR/GD-IDS.yaml"                     || FL_FIX_WHY+=" no-goals"
grep -qF 'GOAL-first-run-' "$GD_DEFECTIVE_DIR/GD-IDS.yaml"            || FL_FIX_WHY+=" no-goal-rows"
grep -qF 'flow: FLOW-first-run' "$GD_DEFECTIVE_DIR/GD-IDS.yaml"       || FL_FIX_WHY+=" no-event-flow-pointer"
grep -qF 'Flow-axis mechanical defects' "$GD_DEFECTIVE_DIR/README.md" || FL_FIX_WHY+=" no-readme-flow-defects"
if [[ -z "$FL_FIX_WHY" ]]; then
    pass "FL-8 defective-gdd fixture — flows/FLOW-first-run.md + GD-IDS flows/goals/events + README flow-defect ground truth"
else
    fail "FL-8 defective-gdd flow fixture incomplete:$FL_FIX_WHY"
fi

# ── Content-axis Stage 2 guards (CS2-1…CS2-5) ────────────────────────────────
# Stage 2 made the cross-cutting verbs axis-aware on Content (the mirror of the Flow
# axis, FL-3…FL-7): the gd-content-axis shard, the content checks in unikit-gd-verify,
# the content lenses in unikit-gd-review, and the content briefs/routing in
# unikit-gd-explore. bash cannot run an LLM skill — these are grep invariants on the
# contract text. All FILE-SCOPED -qF; the negative checks use the set-e-safe
# `grep -qF … && WHY+=…` idiom. MSYS grep aborts on -iF, so anchors are case-sensitive.
# (Skill→shard binding for the new shard is covered by the split-5 gd_check_skill_shards
# calls above; the deep/live defective-gdd CT/RES smoke is deferred to Stage 5.)

# (CS2-1) the gd-content-axis shard carries the content-axis process contracts the
# cross-cutting verbs load — the canonically-new sections (CT/CU model, scale↔structure,
# cross-axis staleness, RES/TRACK/KNOB, code-reads-content), plus the CT/CU codes.
CS2_SHARD_WHY=""
grep -qF '## Content Axis' "$GD_CONTENT_AXIS"           || CS2_SHARD_WHY+=" content-axis-section"
grep -qF 'The CT / CU model' "$GD_CONTENT_AXIS"         || CS2_SHARD_WHY+=" ct-cu-model"
grep -qF 'ref<PREFIX>' "$GD_CONTENT_AXIS"               || CS2_SHARD_WHY+=" ref-prefix"
grep -qF '↔ structure' "$GD_CONTENT_AXIS"               || CS2_SHARD_WHY+=" scale-structure"
grep -qF 'Cross-axis staleness' "$GD_CONTENT_AXIS"      || CS2_SHARD_WHY+=" cross-axis-staleness"
grep -qF 'Code reads content' "$GD_CONTENT_AXIS"        || CS2_SHARD_WHY+=" code-reads-content"
grep -qF 'CT-<slug>' "$GD_CONTENT_AXIS"                 || CS2_SHARD_WHY+=" ct-code"
grep -qF 'CU-<ct>-<n>' "$GD_CONTENT_AXIS"               || CS2_SHARD_WHY+=" cu-code"
if [[ -z "$CS2_SHARD_WHY" ]]; then
    pass "CS2-1 gd-content-axis shard content contracts (Content Axis/CT-CU model/ref<>/scale↔structure/cross-axis/code-reads-content + CT/CU codes)"
else
    fail "CS2-1 gd-content-axis shard contract drift:$CS2_SHARD_WHY"
fi

# (CS2-2) unikit-gd-verify carries the content-check family — the 9 checks of T4 (the
# mirror of the system/flow checks plus the content-specific ones), non-empty gated on
# content_types, with the research: carve-out extended to all three axes.
CS2_VERIFY_WHY=""
grep -qF 'Content checks (axis-aware' "$GD_VERIFY_AXIS"         || CS2_VERIFY_WHY+=" content-checks-section"
grep -qF 'CT/CU id validity' "$GD_VERIFY_AXIS"                  || CS2_VERIFY_WHY+=" ct-cu-id-validity"
grep -qF 'CU.fields ⊆ CT.fields' "$GD_VERIFY_AXIS"              || CS2_VERIFY_WHY+=" cu-subset-ct"
grep -qF 'ref<ENT/CU/FORM/SYS/RES>' "$GD_VERIFY_AXIS"           || CS2_VERIFY_WHY+=" ref-resolution"
grep -qF 'scale ↔ structure' "$GD_VERIFY_AXIS"                  || CS2_VERIFY_WHY+=" scale-structure"
grep -qF 'belongs_to 3-way' "$GD_VERIFY_AXIS"                   || CS2_VERIFY_WHY+=" belongs_to-3way"
grep -qF 'Content status/version 2-place' "$GD_VERIFY_AXIS"     || CS2_VERIFY_WHY+=" content-status-version"
grep -qF 'Content map freshness (3-surface)' "$GD_VERIFY_AXIS"  || CS2_VERIFY_WHY+=" content-map-freshness"
grep -qF 'RES/TRACK/KNOB coherence' "$GD_VERIFY_AXIS"           || CS2_VERIFY_WHY+=" res-track-knob"
grep -qF 'Cross-axis impact (system → content type' "$GD_VERIFY_SKILL" || CS2_VERIFY_WHY+=" cross-axis-sys-ct"
grep -qF 'skip this block silently' "$GD_VERIFY_AXIS"           || CS2_VERIFY_WHY+=" non-empty-gating"
grep -qF 'on all three axes' "$GD_VERIFY_SKILL"                 || CS2_VERIFY_WHY+=" research-carveout-3axes"
if [[ -z "$CS2_VERIFY_WHY" ]]; then
    pass "CS2-2 unikit-gd-verify content checks present (9: id/CU⊆CT/ref<>/scale/belongs_to/status/map-freshness/RES-TRACK-KNOB/cross-axis) + non-empty gating + research carve-out"
else
    fail "CS2-2 unikit-gd-verify content checks missing:$CS2_VERIFY_WHY"
fi

# (CS2-3) unikit-gd-review content lenses present AND activated — the three content
# lenses carry real prompts in lenses.md, the SKILL body marks them active, and ZERO
# "stub — Content axis" survives in EITHER file (mirror of FL-4). The genre carve-out is
# a DIFFERENT marker ("stub — genre, Stage 4"); content lenses must be active now.
CS2_REVIEW_WHY=""
grep -qF '**schema-coherence**' "$GD_LENSES"            || CS2_REVIEW_WHY+=" lenses-schema-coherence"
grep -qF '**catalog-scale**' "$GD_LENSES"               || CS2_REVIEW_WHY+=" lenses-catalog-scale"
grep -qF '**content-fantasy-delivery**' "$GD_LENSES"    || CS2_REVIEW_WHY+=" lenses-content-fantasy"
grep -qF 'Content lenses (active)' "$GD_REVIEW_SKILL"   || CS2_REVIEW_WHY+=" skill-content-active"
grep -qF 'stub — Content axis' "$GD_LENSES"             && CS2_REVIEW_WHY+=" residual-stub-lenses"
grep -qF 'stub — Content axis' "$GD_REVIEW_SKILL"       && CS2_REVIEW_WHY+=" residual-stub-skill"
if [[ -z "$CS2_REVIEW_WHY" ]]; then
    pass "CS2-3 gd-review content lenses present (schema-coherence/catalog-scale/content-fantasy-delivery) + activated (zero 'stub — Content axis' in SKILL+lenses)"
else
    fail "CS2-3 gd-review content lenses incomplete/gated:$CS2_REVIEW_WHY"
fi

# (CS2-4) unikit-gd-explore content surface: the internal-design lens carries both content
# brief blocks (closing the seed loop unikit-gd-content already reads), and gd-explore tags
# content research (Target … CONTENT-<slug>) + routes content to /unikit-gd-content.
CS2_EXPLORE_WHY=""
grep -qF '## Content Improvement Plan' "$GD_INTERNAL_LENS"  || CS2_EXPLORE_WHY+=" lens-improvement-block"
grep -qF '## Content Feature Plan' "$GD_INTERNAL_LENS"      || CS2_EXPLORE_WHY+=" lens-feature-block"
grep -qF 'CONTENT-<slug>' "$GD_INTERNAL_LENS"               || CS2_EXPLORE_WHY+=" lens-content-target-tag"
grep -qF 'CONTENT-<slug>' "$GD_EXPLORE_SAVE_RESEARCH"       || CS2_EXPLORE_WHY+=" explore-content-target-tag"
grep -qF 'no add-content' "$GD_EXPLORE_SKILL"               || CS2_EXPLORE_WHY+=" explore-content-route"
if [[ -z "$CS2_EXPLORE_WHY" ]]; then
    pass "CS2-4 upstream content surface (internal-design-lens content blocks + CONTENT target tag, gd-explore CONTENT target + content route)"
else
    fail "CS2-4 upstream content surface incomplete:$CS2_EXPLORE_WHY"
fi

# (CS2-5) the GD-IDS.yaml template carries the commented research: pointer on content_types
# (T3) — the seed pointer unikit-gd-content writes, the non-id path the T4 carve-out excludes.
if grep -qF 'when the CT was seeded from an explore brief' "$GD_IDS_TPL"; then
    pass "CS2-5 GD-IDS template — content_types research: pointer present (seed loop + verify carve-out closed)"
else
    fail "CS2-5 GD-IDS template — content_types research: pointer missing"
fi

# ── Content-axis Stage 4 genre guards (G1…G5) ────────────────────────────────
# Stage 4 added the bundled genre-profile catalog + CLI (exercised in test-genres*.sh
# / test-skills.sh Part 13b) and wired 3 skills (brainstorm hint / spec resolve+seed /
# review lens). bash cannot run an LLM skill — these are grep invariants on the contract
# text. All file-scoped -qF (MSYS grep aborts on -iF). Reuses GD_SPEC_SKILL/GD_REVIEW_SKILL/
# GD_LENSES/GD_VERIFY_SKILL/GD_GAME_TPL defined above; adds GD_BRAINSTORM_SKILL/GD_CONCEPT_TPL.
GD_BRAINSTORM_SKILL="$ROOT_DIR/skills/unikit-gd-brainstorm/SKILL.md"
GD_CONCEPT_TPL="$GD_DATA/templates/CONCEPT.md"

# (G1) brainstorm writes a descriptive genre: hint, CLI-free. POSITIVE presence — NOT an
# absence-grep on "genres install": the CLI-free body legitimately NAMES those commands in
# the negative ("never runs ... genres list / genres install"), which an absence-grep would
# trip. Assert the CLI-free claim + the descriptive-hint instruction instead.
G1_WHY=""
grep -qF 'CLI-free' "$GD_BRAINSTORM_SKILL"                 || G1_WHY+=" no-CLI-free-claim"
grep -qF 'descriptive `genre:` hint' "$GD_BRAINSTORM_SKILL" || G1_WHY+=" no-descriptive-genre-hint"
if [[ -z "$G1_WHY" ]]; then
    pass "G1 brainstorm writes descriptive genre: hint (CLI-free, positive-presence guard)"
else
    fail "G1 brainstorm genre-hint drift:$G1_WHY"
fi

# (G2) gd-spec carries the resolve surface: genres list → best-fit → genres install +
# seed interview + universal baseline + genre_profile: write to GAME.md.
G2_WHY=""
grep -qF 'genres list' "$GD_SPEC_SKILL"        || G2_WHY+=" no-genres-list"
grep -qF 'genres install' "$GD_SPEC_SKILL"     || G2_WHY+=" no-genres-install"
grep -qF 'best-fit' "$GD_SPEC_SKILL"           || G2_WHY+=" no-best-fit"
grep -qF 'genre_profile' "$GD_SPEC_SKILL"      || G2_WHY+=" no-genre_profile"
grep -qF 'Seed interview' "$GD_SPEC_SKILL"     || G2_WHY+=" no-seed-interview"
grep -qF 'Universal baseline' "$GD_SPEC_SKILL" || G2_WHY+=" no-universal-baseline"
if [[ -z "$G2_WHY" ]]; then
    pass "G2 gd-spec genre resolve (genres list→best-fit→install + seed interview + baseline + genre_profile)"
else
    fail "G2 gd-spec genre resolve drift:$G2_WHY"
fi

# (G3) gd-review genre lens ACTIVATED: zero "stub — genre, Stage 4" in BOTH SKILL.md and
# lenses.md (mirror of CS2-3's content carve-out), profile-completeness + critical_sections/
# review_emphasis present.
G3_WHY=""
grep -qF 'stub — genre, Stage 4' "$GD_REVIEW_SKILL" && G3_WHY+=" residual-stub-skill"
grep -qF 'stub — genre, Stage 4' "$GD_LENSES"       && G3_WHY+=" residual-stub-lenses"
grep -qF 'profile-completeness' "$GD_REVIEW_SKILL"  || G3_WHY+=" no-lens-skill"
grep -qF 'profile-completeness' "$GD_LENSES"        || G3_WHY+=" no-lens-lenses"
grep -qF 'critical_sections' "$GD_LENSES"           || G3_WHY+=" no-critical_sections"
grep -qF 'review_emphasis' "$GD_LENSES"             || G3_WHY+=" no-review_emphasis"
if [[ -z "$G3_WHY" ]]; then
    pass "G3 gd-review genre lens activated (zero 'stub — genre, Stage 4' in SKILL+lenses, profile-completeness + critical_sections/review_emphasis)"
else
    fail "G3 gd-review genre lens drift:$G3_WHY"
fi

# (G4) verify stays GENRE-BLIND: it never reads the profile (critical_sections) NOR the
# GAME genre field (genre_profile) — both absent from unikit-gd-verify/SKILL.md.
G4_WHY=""
grep -qF 'critical_sections' "$GD_VERIFY_SKILL" && G4_WHY+=" critical_sections-present"
grep -qF 'genre_profile' "$GD_VERIFY_SKILL"     && G4_WHY+=" genre_profile-present"
if [[ -z "$G4_WHY" ]]; then
    pass "G4 unikit-gd-verify genre-blind (no critical_sections, no genre_profile read)"
else
    fail "G4 unikit-gd-verify NOT genre-blind:$G4_WHY"
fi

# (G5) template fields with DISTINCT semantics: genre: (descriptive hint) in CONCEPT.md,
# genre_profile: (resolved id) in GAME.md. Both bare non-id slugs outside GD-IDS.
G5_WHY=""
grep -qF '**genre**:' "$GD_CONCEPT_TPL"        || G5_WHY+=" no-genre-in-CONCEPT"
grep -qF '**genre_profile**:' "$GD_GAME_TPL"   || G5_WHY+=" no-genre_profile-in-GAME"
if [[ -z "$G5_WHY" ]]; then
    pass "G5 template genre fields (genre: in CONCEPT, genre_profile: in GAME)"
else
    fail "G5 template genre fields missing:$G5_WHY"
fi

# (CF-1) Content-axis Stage 5 fixture — the defective-gdd grew the content axis (T13):
# content-types/CT-*.md on disk + non-empty GD-IDS content_types/content/resources/
# tracks/knobs with one seeded defect per content check + the README content-defect
# ground truth (9 checks) + the genre-blind ground-truth note (T14b). bash cannot run
# the LLM smoke — assert the surface is present + well-formed (mirror of FL-8); the
# agent-driven /unikit-gd-verify + /unikit-gd-review smoke reads the README ground truth.
# Reuses GD_DEFECTIVE_DIR.
CF_FIX_WHY=""
[[ -s "$GD_DEFECTIVE_DIR/content-types/CT-item.md" ]]  || CF_FIX_WHY+=" no-CT-item"
[[ -s "$GD_DEFECTIVE_DIR/content-types/CT-card.md" ]]  || CF_FIX_WHY+=" no-CT-card"
[[ -s "$GD_DEFECTIVE_DIR/content-types/CT-spawn.md" ]] || CF_FIX_WHY+=" no-CT-spawn"
# content-types/CT-ghost.md must be ABSENT — the phantom Content-Map-freshness row.
[[ -e "$GD_DEFECTIVE_DIR/content-types/CT-ghost.md" ]] && CF_FIX_WHY+=" CT-ghost-should-be-absent"
for key in 'content_types:' 'CT-item' 'content:' 'CU-item-' 'resources:' 'RES-scrap' 'tracks:' 'TRACK-rank' 'knobs:' 'KNOB-'; do
    grep -qF "$key" "$GD_DEFECTIVE_DIR/GD-IDS.yaml" || CF_FIX_WHY+=" no-key-$key"
done
grep -qF 'Content-axis mechanical defects' "$GD_DEFECTIVE_DIR/README.md" || CF_FIX_WHY+=" no-readme-content-defects"
grep -qF 'genre-blind' "$GD_DEFECTIVE_DIR/README.md"                     || CF_FIX_WHY+=" no-genre-blind-note"
if [[ -z "$CF_FIX_WHY" ]]; then
    pass "CF-1 defective-gdd content fixture — content-types/CT-* + GD-IDS content keys + README content-defect + genre-blind ground truth"
else
    fail "CF-1 defective-gdd content fixture incomplete:$CF_FIX_WHY"
fi

# ── unikit-gd-apply dispatcher guards (GA-1…GA-5) ────────────────────────────
# unikit-gd-apply is the multi-zone DISPATCHER: it owns nothing and writes nothing —
# it resolves each delta to its zone owner, fixes the system-before-sinks dispatch
# order, and closes with one verify. bash cannot run the LLM dispatch, so assert the
# contract surface on the SKILL.md: it references all four zone owners + the explore
# route + the apply-phase3 verify handoff, fixes the order, and (the load-bearing invariant)
# carries NO Write/Edit in allowed-tools. Mostly -qF file-scoped; the allowed-tools
# scan extracts the YAML list so the prose mention of `Write`/`Edit` cannot false-match.
GD_APPLY_SKILL="$ROOT_DIR/skills/unikit-gd-apply/SKILL.md"
if [[ ! -f "$GD_APPLY_SKILL" ]]; then
    fail "unikit-gd-apply/SKILL.md — missing (dispatcher guards GA-1…GA-5 cannot run)"
else
    # (GA-1) references all 4 zone owners (the dispatch targets).
    GA1_WHY=""
    for owner in unikit-gd-spec unikit-gd-system unikit-gd-content unikit-gd-flow; do
        grep -qF "/$owner" "$GD_APPLY_SKILL" || GA1_WHY+=" no-$owner"
    done
    if [[ -z "$GA1_WHY" ]]; then
        pass "GA-1 gd-apply references all 4 zone owners (spec/system/content/flow)"
    else
        fail "GA-1 gd-apply missing zone-owner reference(s):$GA1_WHY"
    fi

    # (GA-2) dispatch order — systems before the content/flow sinks (the carrying invariant).
    GA2_WHY=""
    grep -qF 'system dispatch lands BEFORE any content or flow' "$GD_APPLY_SKILL" || GA2_WHY+=" no-before-invariant"
    grep -qF 'system-before-sinks' "$GD_APPLY_SKILL"                              || GA2_WHY+=" no-order-token"
    if [[ -z "$GA2_WHY" ]]; then
        pass "GA-2 gd-apply fixes the dispatch order (systems → content/flow sinks)"
    else
        fail "GA-2 gd-apply dispatch-order invariant missing:$GA2_WHY"
    fi

    # (GA-3) closes with one unikit-gd-verify pass carrying the apply-phase3 loop-guard
    # sentinel — the single reserved arg (NOT a union of touched ids); verify recognises it
    # and suppresses its standalone handoff offer, so apply→verify→apply cannot loop.
    if grep -qF 'Skill(skill: "unikit-gd-verify", args: "apply-phase3")' "$GD_APPLY_SKILL"; then
        pass "GA-3 gd-apply closes with one Skill(unikit-gd-verify, apply-phase3) loop-guard pass"
    else
        fail "GA-3 gd-apply missing the final unikit-gd-verify apply-phase3 handoff"
    fi

    # (GA-4) explore route for open questions (GATE 1 — research, not dispatch).
    if grep -qF '/unikit-gd-explore' "$GD_APPLY_SKILL"; then
        pass "GA-4 gd-apply routes open questions to /unikit-gd-explore"
    else
        fail "GA-4 gd-apply missing the /unikit-gd-explore route"
    fi

    # (GA-5) load-bearing invariant — NO Write/Edit in allowed-tools (a dispatcher cannot
    # write), Skill present. Scope to the YAML list so the prose mention of `Write`/`Edit`
    # in the Ownership section does not false-match.
    GD_APPLY_TOOLS=$(awk '/^allowed-tools:/{f=1;next} f&&/^[a-zA-Z]/{f=0} f' "$GD_APPLY_SKILL")
    GA5_WHY=""
    grep -qE '^[[:space:]]*-[[:space:]]*Skill$' <<< "$GD_APPLY_TOOLS" || GA5_WHY+=" no-Skill-tool"
    grep -qE '^[[:space:]]*-[[:space:]]*Write$' <<< "$GD_APPLY_TOOLS" && GA5_WHY+=" has-Write"
    grep -qE '^[[:space:]]*-[[:space:]]*Edit$'  <<< "$GD_APPLY_TOOLS" && GA5_WHY+=" has-Edit"
    if [[ -z "$GA5_WHY" ]]; then
        pass "GA-5 gd-apply allowed-tools has Skill, no Write/Edit (dispatcher writes nothing)"
    else
        fail "GA-5 gd-apply allowed-tools invariant violated:$GA5_WHY"
    fi
fi

# ── Brownfield recon / explore code-lens / gd-docs guards (RD-1…RD-8) ─────────
# The brownfield-adoption upgrade added three READ-ONLY verbs at the module edges:
# unikit-gd-recon (cold-start, code → RECON.md), the unikit-gd-explore code-grounded
# lens (post-GDD slice), and unikit-gd-docs (workspace → docs/design/). Code reading is
# quarantined to the two research verbs; the authoring zones + apply never read code
# (RD-8). bash cannot run an LLM skill — these are grep invariants on the contract text +
# allowed-tools checks. All file-scoped -qF (MSYS grep aborts on -iF, and Unicode arrows /
# em-dashes are avoided in anchors); the no-Skill / Write checks reuse the GA-5 awk
# allowed-tools extraction. The T8-8 guard above was retargeted "two" → "three".
GD_RECON_SKILL="$ROOT_DIR/skills/unikit-gd-recon/SKILL.md"
GD_RECON_ENGINE="$ROOT_DIR/skills/unikit-gd-recon/references/code-recon.md"
GD_DOCS_SKILL="$ROOT_DIR/skills/unikit-gd-docs/SKILL.md"
GD_DOCS_TOOL="$ROOT_DIR/skills/unikit-docs/SKILL.md"

# (RD-1) unikit-gd-recon present + cold-start research-verb contract: writes RECON.md as an
# import-seed (Intent Gap + per-fact code-provenance), recommends gd-spec import, and is
# mechanically "calls no one" — NO Skill in allowed-tools (mirror GA-5), Write + Bash(mkdir *)
# present (cold-start workspace).
if [[ ! -f "$GD_RECON_SKILL" ]]; then
    fail "unikit-gd-recon/SKILL.md — missing (recon guards RD-1…RD-2 cannot run)"
else
    RD1_WHY=""
    grep -qF 'RECON.md' "$GD_RECON_SKILL"                       || RD1_WHY+=" no-RECON.md"
    grep -qF '## Intent Gap' "$GD_RECON_SKILL"                  || RD1_WHY+=" no-intent-gap"
    grep -qF 'provenance: extracted from code' "$GD_RECON_SKILL" || RD1_WHY+=" no-code-provenance"
    grep -qF 'import-seed' "$GD_RECON_SKILL"                    || RD1_WHY+=" no-import-seed"
    grep -qF '/unikit-gd-spec' "$GD_RECON_SKILL"                || RD1_WHY+=" no-spec-recommend"
    grep -qF 'cold-start' "$GD_RECON_SKILL"                     || RD1_WHY+=" no-cold-start"
    RD_RECON_TOOLS=$(awk '/^allowed-tools:/{f=1;next} f&&/^[a-zA-Z]/{f=0} f' "$GD_RECON_SKILL")
    grep -qE '^[[:space:]]*-[[:space:]]*Skill$' <<< "$RD_RECON_TOOLS" && RD1_WHY+=" has-Skill"
    grep -qE '^[[:space:]]*-[[:space:]]*Write$' <<< "$RD_RECON_TOOLS" || RD1_WHY+=" no-Write"
    grep -qF 'Bash(mkdir *)' <<< "$RD_RECON_TOOLS"                    || RD1_WHY+=" no-mkdir"
    if [[ -z "$RD1_WHY" ]]; then
        pass "RD-1 unikit-gd-recon cold-start import-seed (RECON.md/Intent Gap/code-provenance/spec import; no Skill, Write+mkdir)"
    else
        fail "RD-1 unikit-gd-recon contract drift:$RD1_WHY"
    fi
fi

# (RD-2) the shared code-recon.md engine: P0 systems + P1 content, flows EXCLUDED, engine-
# agnostic, the per-fact confidence + source-pointer + provenance record. Owned by recon,
# read by the explore code lens — auto-delivered under references/ (no shard-cycle edit).
if [[ ! -f "$GD_RECON_ENGINE" ]]; then
    fail "unikit-gd-recon/references/code-recon.md — missing (the shared extraction engine)"
else
    RD2_WHY=""
    grep -qF 'design-fact' "$GD_RECON_ENGINE"                   || RD2_WHY+=" no-engine-title"
    grep -qF 'provenance: extracted from code' "$GD_RECON_ENGINE" || RD2_WHY+=" no-provenance"
    grep -qF 'CT.fields' "$GD_RECON_ENGINE"                     || RD2_WHY+=" no-ct-fields"
    grep -qF 'EXCLUDED' "$GD_RECON_ENGINE"                      || RD2_WHY+=" no-flows-excluded"
    grep -qF 'confidence' "$GD_RECON_ENGINE"                    || RD2_WHY+=" no-confidence"
    grep -qF 'source pointer' "$GD_RECON_ENGINE"                || RD2_WHY+=" no-source-pointer"
    grep -qF 'engine-agnostic' "$GD_RECON_ENGINE"               || RD2_WHY+=" no-engine-agnostic"
    if [[ -z "$RD2_WHY" ]]; then
        pass "RD-2 code-recon.md engine (P0 systems/P1 content/flows-excluded/engine-agnostic + confidence+source+provenance)"
    else
        fail "RD-2 code-recon.md engine drift:$RD2_WHY"
    fi
fi

# (RD-2a) engine-list sync — the LOAD-BEARING guard behind RD-2b. The test's ENGINES array
# (defined ~line 283, also mirrored in the per-engine loops ~line 408 and the JS snippet
# ~line 747) is a MANUAL copy of the canonical ENGINE_REGISTRY in src/core/engines.ts. If a
# new engine is added to the installer but not to this test, every engine-driven check —
# RD-2b included — silently runs on the stale list and never notices. Derive the canonical
# ids straight from engines.ts and assert the test array matches, so a new engine fails HERE
# first; the dev then updates ENGINES (which cascades into RD-2b's RECON_ENGINE_TOKENS map +
# the code-recon.md matrix). engines.ts is the source of truth; this is its single mirror-check.
CANON_ENGINE_IDS=$(grep -oE "id: '[^']+'" "$ROOT_DIR/src/core/engines.ts" | sed "s/^id: '//; s/'$//" | sort | tr '\n' ' ')
TEST_ENGINE_IDS=$(printf '%s\n' "${ENGINES[@]}" | sort | tr '\n' ' ')
if [[ "$CANON_ENGINE_IDS" == "$TEST_ENGINE_IDS" ]]; then
    pass "RD-2a engine-list sync: test ENGINES matches src/core/engines.ts ENGINE_REGISTRY ($CANON_ENGINE_IDS)"
else
    fail "RD-2a engine-list DRIFT — engines.ts=[$CANON_ENGINE_IDS] vs test ENGINES=[$TEST_ENGINE_IDS]; update the ENGINES array (~line 283) + RD-2b RECON_ENGINE_TOKENS + the code-recon.md matrix"
fi

# (RD-2b) the code-recon.md engine matrix MUST cover EVERY canonical UniKit engine. The
# recon SKILL.md is deliberately engine-agnostic (no stop-words, Part 7c) and defers the
# per-engine asset forms to this reference; so when a NEW engine is added to the canonical
# ENGINES list (and the code module), its asset-form row must be added here too, or recon
# silently cannot reconstruct that engine's content. Driven by the canonical ENGINES array,
# so a new engine fails the test twice over: once if no token is mapped, once if the matrix
# lacks it. Adding an engine ⇒ update BOTH RECON_ENGINE_TOKENS and code-recon.md.
if [[ -f "$GD_RECON_ENGINE" ]]; then
    declare -A RECON_ENGINE_TOKENS=(
        ["unity"]="Unity"
        ["godot"]="Godot 4 (GDScript)"
        ["godot-net"]="Godot 4 (.NET)"
        ["unreal-engine-5"]="Unreal 5"
    )
    RD2B_WHY=""
    for engine_id in "${ENGINES[@]}"; do
        token="${RECON_ENGINE_TOKENS[$engine_id]:-}"
        if [[ -z "$token" ]]; then
            RD2B_WHY+=" no-token-for-$engine_id(map it in RECON_ENGINE_TOKENS + add a row to code-recon.md)"
        elif ! grep -qF "$token" "$GD_RECON_ENGINE"; then
            RD2B_WHY+=" matrix-missing-$engine_id(token:'$token')"
        fi
    done
    if [[ -z "$RD2B_WHY" ]]; then
        pass "RD-2b code-recon.md engine matrix covers every canonical engine (${ENGINES[*]})"
    else
        fail "RD-2b code-recon.md engine matrix incomplete:$RD2B_WHY"
    fi
fi

# (RD-3) gd-principles THIRD One-Way Boundary exception — the read-only research verbs read
# code; the brownfield carve-out is named; authoring zones + apply are explicitly excluded.
RD3_WHY=""
grep -qF 'brownfield-bootstrap carve-out' "$GD_PRINCIPLES" || RD3_WHY+=" no-brownfield-carveout"
grep -qF 'read-only research verbs' "$GD_PRINCIPLES"       || RD3_WHY+=" no-research-verbs"
grep -qF 'extracted from code' "$GD_PRINCIPLES"            || RD3_WHY+=" no-code-provenance"
grep -qF 'are **never** in' "$GD_PRINCIPLES"               || RD3_WHY+=" no-authoring-exclusion"
if [[ -z "$RD3_WHY" ]]; then
    pass "RD-3 gd-principles third exception (research verbs read code; brownfield carve-out; authoring/apply excluded)"
else
    fail "RD-3 gd-principles third exception drift:$RD3_WHY"
fi

# (RD-4) code-extraction provenance contract (Task 2): gd-provenance defines the
# `extracted from code` marker (distinct from trusted SOURCE.md) + the durable banner /
# import-membrane anti-laundering rule; the gd-review provenance lens detects a code-
# reconstructed import and holds its extracted-from-SOURCE sections at ≥ Major.
RD4_WHY=""
grep -qF 'extracted from code' "$GD_PROVENANCE"     || RD4_WHY+=" provenance-no-marker"
grep -qF 'durable code-provenance' "$GD_PROVENANCE" || RD4_WHY+=" provenance-no-banner"
grep -qF 'import membrane' "$GD_PROVENANCE"         || RD4_WHY+=" provenance-no-membrane"
grep -qF 'code-reconstructed import' "$GD_LENSES"   || RD4_WHY+=" lens-no-detection"
grep -qF 'extracted from code' "$GD_LENSES"         || RD4_WHY+=" lens-no-marker"
if [[ -z "$RD4_WHY" ]]; then
    pass "RD-4 code-extraction provenance contract (gd-provenance marker+banner+membrane; lens detects code-reconstructed import)"
else
    fail "RD-4 code-extraction provenance contract drift:$RD4_WHY"
fi

# (RD-5) explore code-grounded lens: the 4th lens section is present, it reads the recon-
# owned code-recon.md (cross-skill), tags facts `extracted from code`, the Bootstrap one-way
# carries the code-lens exception, and the internal-design lens's absolute "never reads code"
# is SOFTENED to the design/code carve-out (positive guards on the new text).
RD5_WHY=""
grep -qF '## Code-grounded lens' "$GD_EXPLORE_SKILL"                    || RD5_WHY+=" no-code-lens-section"
grep -qF 'unikit-gd-recon/references/code-recon.md' "$GD_EXPLORE_SKILL" || RD5_WHY+=" no-cross-skill-read"
grep -qF 'extracted from code' "$GD_EXPLORE_SKILL"                      || RD5_WHY+=" no-code-provenance"
grep -qF 'code-lens exception' "$GD_EXPLORE_SKILL"                      || RD5_WHY+=" no-bootstrap-carveout"
grep -qF 'reasons about *design*, not code' "$GD_INTERNAL_LENS"        || RD5_WHY+=" no-lens-carveout"
if [[ -z "$RD5_WHY" ]]; then
    pass "RD-5 explore code-grounded lens (4th lens + cross-skill code-recon read + code-provenance + softened one-way)"
else
    fail "RD-5 explore code-lens drift:$RD5_WHY"
fi

# (RD-6) unikit-gd-docs present + render contract: the six Variant-B chapters, the draft
# banner, the --web template path + graceful WARN, the docs/design output, and the leaf-
# renderer guarantee — NO Skill in allowed-tools (mirror GA-5).
if [[ ! -f "$GD_DOCS_SKILL" ]]; then
    fail "unikit-gd-docs/SKILL.md — missing (docs guards RD-6…RD-7 cannot run)"
else
    RD6_WHY=""
    for ch in index systems flows content economy glossary; do
        grep -qF "$ch.md" "$GD_DOCS_SKILL" || RD6_WHY+=" no-chapter-$ch"
    done
    grep -qF 'docs/design/' "$GD_DOCS_SKILL"       || RD6_WHY+=" no-output-dir"
    grep -qF 'draft banner' "$GD_DOCS_SKILL"       || RD6_WHY+=" no-draft-banner"
    grep -qF 'html-template.html' "$GD_DOCS_SKILL" || RD6_WHY+=" no-web-template"
    grep -qF 'WARN [--web]' "$GD_DOCS_SKILL"       || RD6_WHY+=" no-web-warn"
    RD_DOCS_TOOLS=$(awk '/^allowed-tools:/{f=1;next} f&&/^[a-zA-Z]/{f=0} f' "$GD_DOCS_SKILL")
    grep -qE '^[[:space:]]*-[[:space:]]*Skill$' <<< "$RD_DOCS_TOOLS" && RD6_WHY+=" has-Skill"
    if [[ -z "$RD6_WHY" ]]; then
        pass "RD-6 unikit-gd-docs render (6 chapters + draft banner + --web template/WARN + docs/design; no Skill)"
    else
        fail "RD-6 unikit-gd-docs contract drift:$RD6_WHY"
    fi
fi

# (RD-7) docs/ ownership split — unikit-docs carves out docs/design/** (owned by
# unikit-gd-docs): the --web glob is non-recursive, the ownership boundary names the split.
RD7_WHY=""
grep -qF 'docs/design/**' "$GD_DOCS_TOOL" || RD7_WHY+=" docs-no-design-carveout"
grep -qF 'unikit-gd-docs' "$GD_DOCS_TOOL" || RD7_WHY+=" docs-no-gd-docs-ref"
grep -qF 'docs/design/' "$GD_DOCS_SKILL"  || RD7_WHY+=" gddocs-no-owned-subtree"
if [[ -z "$RD7_WHY" ]]; then
    pass "RD-7 docs/ ownership split (unikit-docs carves out docs/design/**; gd-docs owns it)"
else
    fail "RD-7 docs/ ownership split drift:$RD7_WHY"
fi

# (RD-8) NEGATIVE — the authoring zones (spec/system/content/flow) and the apply dispatcher
# do NOT read code: none reference the recon-owned code-recon.md engine, and gd-apply keeps
# its one-way "never read ... project source" prohibition. Code reading is quarantined to
# the two research verbs (recon + the explore lens), never the authoring/dispatch side.
RD8_WHY=""
for z in spec system content flow; do
    grep -qF 'code-recon.md' "$ROOT_DIR/skills/unikit-gd-$z/SKILL.md" && RD8_WHY+=" $z-reads-code-recon"
done
grep -qF 'code-recon.md' "$GD_APPLY_SKILL" && RD8_WHY+=" apply-reads-code-recon"
grep -qF 'project source' "$GD_APPLY_SKILL" || RD8_WHY+=" apply-no-one-way"
if [[ -z "$RD8_WHY" ]]; then
    pass "RD-8 NEGATIVE — authoring zones + apply do not read code (no code-recon.md ref; apply keeps one-way)"
else
    fail "RD-8 code-read capability leaked into authoring/apply:$RD8_WHY"
fi

# ── Decision-First authoring guards (DF-1…DF-6) ──────────────────────────────
# The Decision-First refactor rewrote the gd-authoring Section-Cycle Contract BODY
# (heading anchor preserved), made `detailed · partial` an INFERRED status in
# gd-lifecycle (no stored field, no enum change), and reshaped Phase 3+4 of the three
# zone skills into a depth-picked, fork-scanned, group-reviewed flow carrying the new
# `<!-- deferred -->` marker. The render suffix `· partial (n/m)` is emitted from ONE
# canonical rule (gd-lifecycle) by all FOUR renderers (verify + spec/flow/content maps).
# These are grep invariants on the contract text + the consumer renderers. All -qF
# file-scoped (MSYS grep aborts on -iF).
GD_SECTION_PACKS="$ROOT_DIR/skills/unikit-gd-system/references/section-packs.md"

# (DF-1) gd-authoring carries the Decision-First contract under the PRESERVED anchors
# (`## Section-Cycle Contract` + `## Delta Discipline`): the depth picker, the
# `<!-- deferred -->` marker, the card source, the structural group gate, the phase names;
# the reader-list gained content+apply; the old linear "per section, in order" cycle is GONE.
DF1_WHY=""
grep -qF '## Section-Cycle Contract' "$GD_AUTHORING" || DF1_WHY+=" no-anchor(Section-Cycle)"
grep -qF '## Delta Discipline' "$GD_AUTHORING"       || DF1_WHY+=" no-anchor(Delta-Discipline)"
grep -qF 'Decision-First' "$GD_AUTHORING"            || DF1_WHY+=" no-decision-first"
grep -qF 'core/standard/full' "$GD_AUTHORING"        || DF1_WHY+=" no-depth-picker"
grep -qF '<!-- deferred -->' "$GD_AUTHORING"          || DF1_WHY+=" no-deferred-marker"
grep -qF 'structural group gate' "$GD_AUTHORING"     || DF1_WHY+=" no-group-gate"
grep -qF 'Fork scan' "$GD_AUTHORING"                 || DF1_WHY+=" no-fork-scan"
grep -qF 'Decision interview' "$GD_AUTHORING"        || DF1_WHY+=" no-decision-interview"
grep -qF 'Group review' "$GD_AUTHORING"              || DF1_WHY+=" no-group-review"
grep -qF 'drawn from the template' "$GD_AUTHORING"   || DF1_WHY+=" no-card-source"
grep -qF 'unikit-gd-content' "$GD_AUTHORING"         || DF1_WHY+=" reader-list-no-content"
grep -qF 'unikit-gd-apply' "$GD_AUTHORING"           || DF1_WHY+=" reader-list-no-apply"
grep -qF 'per section, in order' "$GD_AUTHORING"     && DF1_WHY+=" OLD-linear-cycle-present"
if [[ -z "$DF1_WHY" ]]; then
    pass "DF-1 gd-authoring Decision-First contract (depth-picker · <!-- deferred --> · card source · group gate · 6 phases; anchors preserved; reader-list +content/apply; linear cycle gone)"
else
    fail "DF-1 gd-authoring Decision-First contract drift:$DF1_WHY"
fi

# (DF-2) gd-lifecycle is the CANONICAL HOME of the inferred partial status: the
# `detailed · partial` rule + `· partial (n/m)` render format + per-zone core-set +
# partial is a render-time annotation (not a status value) + never stored; reader-list
# +content/apply. (The enum was collapsed 5->3 this PR — `· partial` adds no status.)
DF2_WHY=""
grep -qF 'detailed · partial' "$GD_LIFECYCLE"  || DF2_WHY+=" no-partial-status"
grep -qF '· partial (n/m)' "$GD_LIFECYCLE"      || DF2_WHY+=" no-partial-format"
grep -qF 'per-zone core-set' "$GD_LIFECYCLE"   || DF2_WHY+=" no-core-set"
grep -qF 'A/B/C/D/H' "$GD_LIFECYCLE"           || DF2_WHY+=" no-system-core-listing"
grep -qF 'canonical home' "$GD_LIFECYCLE"      || DF2_WHY+=" no-canonical-home"
grep -qF 'never stored' "$GD_LIFECYCLE"        || DF2_WHY+=" partiality-not-marked-inferred"
grep -qF 'render-time annotation' "$GD_LIFECYCLE" || DF2_WHY+=" partial-not-marked-render-annotation"
grep -qF 'not-started, skeleton, detailed' "$GD_LIFECYCLE" || DF2_WHY+=" enum-membership-missing"
grep -qF 'unikit-gd-content' "$GD_LIFECYCLE"   || DF2_WHY+=" reader-list-no-content"
grep -qF 'unikit-gd-apply' "$GD_LIFECYCLE"     || DF2_WHY+=" reader-list-no-apply"
if [[ -z "$DF2_WHY" ]]; then
    pass "DF-2 gd-lifecycle canonical partial rule (detailed · partial inferred/never-stored · · partial (n/m) format · per-zone core-set · partial = render annotation, not a status value; reader-list +content/apply)"
else
    fail "DF-2 gd-lifecycle partial rule drift:$DF2_WHY"
fi

# (DF-3) the three zone skills each carry the Decision-First flow: the depth gate
# (core/standard/full), section names not bare letters, the silent fork-scan, the
# seeded-vs-greenfield split (real fork), and the depth INFO marker.
DF3_WHY=""
for s in system flow content; do
    f="$ROOT_DIR/skills/unikit-gd-$s/SKILL.md"
    # The Decision-First authoring body moved to references/mode-author.md (context-cost
    # refactor); Phase-2 depth gate stays in the SKILL switch. DF-3 split-grep accordingly.
    fa="$ROOT_DIR/skills/unikit-gd-$s/references/mode-author.md"
    grep -qF 'Decision-First' "$fa"        || DF3_WHY+=" $s:no-decision-first"
    grep -qF 'Depth gate' "$f"             || DF3_WHY+=" $s:no-depth-gate"
    grep -qF 'core/standard/full' "$f"     || DF3_WHY+=" $s:no-picker"
    grep -qF 'never by a bare letter' "$fa" || DF3_WHY+=" $s:no-names-rule"
    grep -qF 'Fork-scan' "$fa"             || DF3_WHY+=" $s:no-fork-scan"
    grep -qF 'real fork' "$fa"             || DF3_WHY+=" $s:no-seeded-vs-greenfield"
    grep -qF "depth=<tier>" "$fa"          || DF3_WHY+=" $s:no-depth-marker"
done
if [[ -z "$DF3_WHY" ]]; then
    pass "DF-3 zone skills Decision-First (system/flow/content: depth gate core/standard/full · names-not-letters · fork-scan · seeded-vs-greenfield · depth marker)"
else
    fail "DF-3 zone skills Decision-First drift:$DF3_WHY"
fi

# (DF-4) unikit-gd-verify: the `<!-- deferred -->` marker is INTENTIONAL (not a leak),
# the `· partial (n/m)` render, the marker⟺render self-check, the NEW core-floor
# coherence check; the `[To be designed]` placeholder-leak regression still holds.
DF4_WHY=""
grep -qF '<!-- deferred -->' "$GD_VERIFY_SKILL" || DF4_WHY+=" no-deferred"
grep -qF 'intentional' "$GD_VERIFY_SKILL"       || DF4_WHY+=" deferred-not-intentional"
grep -qF '· partial (n/m)' "$GD_VERIFY_SKILL"   || DF4_WHY+=" no-partial-render"
grep -qF 'Self-check (marker' "$GD_VERIFY_SKILL" || DF4_WHY+=" no-self-check"
grep -qF 'Core-floor coherence' "$GD_VERIFY_SKILL" || DF4_WHY+=" no-core-floor-check"
grep -qF '[To be designed]' "$GD_VERIFY_SKILL"  || DF4_WHY+=" placeholder-leak-regression-lost"
if [[ -z "$DF4_WHY" ]]; then
    pass "DF-4 unikit-gd-verify (<!-- deferred -->=intentional · · partial (n/m) render · marker⟺render self-check · core-floor coherence; [To be designed] leak still guarded)"
else
    fail "DF-4 unikit-gd-verify deferred/partial drift:$DF4_WHY"
fi

# (DF-5) consumer parity — the `· partial (n/m)` suffix is emitted by ALL FOUR renderers
# from the one canonical gd-lifecycle rule (verify + the spec System Map + the flow Flow
# Map + the content Content Map); the gd-review completeness lens treats the marker as
# intentional (no misfire); section-packs.md is reframed Decision-First (linear cycle gone).
DF5_WHY=""
for f in "$GD_VERIFY_SKILL" "$GD_SPEC_SKILL" "$GD_FLOW_SKILL" "$GD_CONTENT_SKILL"; do
    grep -qF 'partial (n/m)' "$f" || DF5_WHY+=" $(basename "$(dirname "$f")"):no-partial-render"
done
grep -qF '<!-- deferred -->' "$GD_LENSES" || DF5_WHY+=" review-lens-no-deferred"
grep -qF 'intentional' "$GD_LENSES"        || DF5_WHY+=" review-lens-not-intentional"
grep -qF 'Decision-First' "$GD_SECTION_PACKS" || DF5_WHY+=" section-packs-not-decision-first"
grep -qF 'Draft+Approval' "$GD_SECTION_PACKS"  && DF5_WHY+=" section-packs-OLD-linear-cycle"
if [[ -z "$DF5_WHY" ]]; then
    pass "DF-5 consumer parity (· partial (n/m) on all 4 renderers verify/spec/flow/content · review completeness no-misfire · section-packs Decision-First)"
else
    fail "DF-5 consumer parity drift:$DF5_WHY"
fi

# (DF-6) the three templates document the `<!-- deferred -->` marker (distinct from the
# `[To be designed]` skeleton placeholder) and name the per-zone core sections — the card
# source the Phase 5 group review draws from.
DF6_WHY=""
for t in SYSTEM FLOW CONTENT-TYPE; do
    f="$GD_DATA/templates/$t.md"
    grep -qF '<!-- deferred -->' "$f" || DF6_WHY+=" $t:no-deferred-doc"
    grep -qF '[To be designed]' "$f"  || DF6_WHY+=" $t:no-placeholder-distinction"
    grep -qF 'Core sections' "$f"     || DF6_WHY+=" $t:no-core-sections"
    grep -qF 'Decision-First' "$f"    || DF6_WHY+=" $t:no-decision-first"
done
if [[ -z "$DF6_WHY" ]]; then
    pass "DF-6 templates document the deferred marker + core sections (SYSTEM/FLOW/CONTENT-TYPE: <!-- deferred --> vs [To be designed] · Core sections · Decision-First)"
else
    fail "DF-6 template marker/card drift:$DF6_WHY"
fi

# ============================================================================
# Context-optimization guards (mode-extraction + flow-first + P4/P5 + design-read).
# The flow-first/mode-extraction refactor pulled mode bodies and Step 4.5 out of
# unikit-plan / unikit-gd-spec into references/, introduced the shared design-read
# system asset, the GD_RULES_INDEX Rule-Loading Discipline + per-skill anchors, and
# the precise no-GDD gate hints. bash cannot run an LLM skill — these are grep
# invariants on the contract text + presence checks on the extracted references.
# ============================================================================

GD_DESIGN_READ="$GD_DATA/design-read.md"
PLAN_REFS="$ROOT_DIR/skills/unikit-plan/references"
GD_SPEC_REFS="$ROOT_DIR/skills/unikit-gd-spec/references"
GD_RULES_INDEX_TPL="$GD_DATA/templates/GD_RULES_INDEX.md"

# (DR-1) design-read.md source-guard — mirror of the gd-principles block: the shared
# READ contract installed flat (no engine vars) at
# .unikit/system/gamedesign/design-read.md. Assert the READ markers (flow-first rule +
# one-way boundary + read surfaces), that the plan-only ## Flow Context OUTPUT brief is
# ABSENT (read-only scope), and that it is substitution-free.
if [[ ! -f "$GD_DESIGN_READ" ]]; then
    fail "data/gamedesign/design-read.md — missing"
else
    DR_WHY=""
    grep -qF 'intent decides the door' "$GD_DESIGN_READ" || DR_WHY+=" flow-first-rule"
    grep -qF '## One-Way Boundary' "$GD_DESIGN_READ"     || DR_WHY+=" one-way-boundary"
    grep -qF 'Read the **registry**' "$GD_DESIGN_READ"   || DR_WHY+=" read-surfaces"
    if [[ -z "$DR_WHY" ]]; then
        pass "design-read.md — READ markers present (flow-first rule + one-way boundary + read surfaces)"
    else
        fail "design-read.md — missing READ markers:$DR_WHY"
    fi
    if grep -qF '## Flow Context' "$GD_DESIGN_READ"; then
        fail "design-read.md — ## Flow Context OUTPUT brief must NOT be here (plan-only, read-only scope)"
    else
        pass "design-read.md — no ## Flow Context output brief (read-only scope held)"
    fi
    if grep -qE '\{\{settings_file\}\}|\{\{skills_dir\}\}|\{\{engine_' "$GD_DESIGN_READ"; then
        fail "design-read.md — contains agent/engine vars (must be substitution-free like gd-principles)"
    else
        pass "design-read.md — no agent/engine vars (system-file safe)"
    fi
fi

# (MX-1) Mode-extraction: unikit-plan's five mode bodies live in references/mode-*.md and
# the inline mode sections are gone from SKILL.md (the Step 0 / Step 1.5 dispatch loads them).
MX_PLAN_WHY=""
for m in list add full fast ultra; do
    [[ -s "$PLAN_REFS/mode-$m.md" ]] || MX_PLAN_WHY+=" mode-$m.md-missing"
done
! grep -qF '## List Mode' "$UNIKIT_PLAN_SKILL"        || MX_PLAN_WHY+=" list-still-inline"
! grep -qF '## Add Mode — Modify' "$UNIKIT_PLAN_SKILL" || MX_PLAN_WHY+=" add-still-inline"
if [[ -z "$MX_PLAN_WHY" ]]; then
    pass "unikit-plan — mode bodies extracted to references/mode-*.md (bodies not inline)"
else
    fail "unikit-plan — mode-extraction incomplete:$MX_PLAN_WHY"
fi

# (UX-1) argument-hint ↔ mode-*.md set equality. Until this guard, the two sets
# matched by coincidence: `argument-hint` is checked nowhere for unikit-plan (the
# only argument-hint asserts in this suite are unikit-memory's and CK-1's), so a
# mode could be added to one and forgotten in the other in either direction —
# a hint that offers a mode with no body, or a body no one can reach.
# The FIRST `[...]` group of the hint is the mode group; `--base <branch>` is a
# separate group and never reaches the parser. Leading dashes are STRIPPED rather
# than filtered: the hint writes `--list` while the body is `mode-list.md`, so
# dropping dashed tokens would discard `list` and make the sets differ by
# construction. Both sides degenerate to `fail` when empty (NN-4 / RT-7
# convention) — an empty side means the parse broke, not that the sets agree.
# A duplicated token is checked SEPARATELY, before the sets are compared: `sort -u` on
# both sides makes `[fast | fast | full …]` compare equal to the body list, so set
# equality alone cannot see it. The dedup assert is what turns that into a red run.
UX1_HINT="$(grep -m1 '^argument-hint:' "$UNIKIT_PLAN_SKILL")"
UX1_RAW="$(printf '%s' "$UX1_HINT" | sed -n 's/^[^[]*\[\([^]]*\)\].*/\1/p' | tr '|' '\n' \
    | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s/^--*//' | grep -v '^$' | sort)"
UX1_TOKENS="$(printf '%s' "$UX1_RAW" | sort -u)"
UX1_BODIES="$(cd "$PLAN_REFS" && ls mode-*.md 2>/dev/null | sed 's/^mode-//; s/\.md$//' | sort -u)"
UX1_WHY=""
[[ -n "$UX1_TOKENS" ]] || UX1_WHY+=" hint-parse-empty"
[[ -n "$UX1_BODIES" ]] || UX1_WHY+=" no-mode-bodies"
if [[ -z "$UX1_WHY" ]] && [[ "$UX1_RAW" != "$UX1_TOKENS" ]]; then
    UX1_WHY+=" duplicate-token-in-hint"
fi
if [[ -z "$UX1_WHY" ]] && [[ "$UX1_TOKENS" != "$UX1_BODIES" ]]; then
    UX1_WHY+=" hint≠bodies"
fi
if [[ -z "$UX1_WHY" ]]; then
    pass "UX-1 unikit-plan argument-hint modes == references/mode-*.md bodies ($(echo "$UX1_TOKENS" | tr '\n' ' '))"
else
    fail "UX-1 unikit-plan argument-hint ↔ mode bodies:$UX1_WHY"
    echo "      hint tokens: $(echo "$UX1_RAW" | tr '\n' ' ')"
    echo "      mode bodies: $(echo "$UX1_BODIES" | tr '\n' ' ')"
fi

# (UX-2) A mode must stay REACHABLE, not merely exist. MX-1 checks that a mode body is on
# disk and UX-1 that the hint offers it; neither notices that the dispatch can still throw
# the mode away. It did: Step 0.2 carried a second, hand-maintained copy of the mode-keyword
# set — "**If no mode keyword** (`full`/`fast`/`add`) is found:" — which went stale the
# moment `ultra` was added, so `/unikit-plan ultra` with no description fell through to the
# Full/Fast question and silently became a different mode. The fix was to delete the copy,
# not to extend it, so the guard is anchored on the ABSENCE of a restated set: any backticked
# token on that line is a second source of truth for the Step 0 parsing rules and will go
# stale on the next mode exactly as this one did. Degenerates to `fail` when the line is gone
# (NN-4 / RT-7 convention) — a missing anchor means the guard lost its object, not that the
# invariant holds.
UX2_LINE="$(grep -n 'If no mode keyword' "$UNIKIT_PLAN_SKILL" || true)"
UX2_WHY=""
if [[ -z "$UX2_LINE" ]]; then
    UX2_WHY+=" gate-line-missing"
elif printf '%s' "$UX2_LINE" | grep -q '`'; then
    UX2_WHY+=" gate-restates-the-mode-keyword-set"
fi
if [[ -z "$UX2_WHY" ]]; then
    pass "UX-2 unikit-plan Step 0.2 mode gate defers to the Step 0 parsing rules (no second keyword list)"
else
    fail "UX-2 unikit-plan Step 0.2 mode gate:$UX2_WHY"
    [[ -n "$UX2_LINE" ]] && echo "      $UX2_LINE"
fi

# ─────────────────────────────────────────────
# UP: the ultra PRODUCER. Phase 1 and Phase 2 of the port fix repaired the paths on which
# `/unikit-plan ultra` silently produced an ordinary full plan — no error, no orphan, no
# integrity violation, nothing to notice. These guards are the only thing that would turn
# red if any of it came back. Anchors sit on the ABSENCE of the old formulation or on a
# counter wherever possible (the UX-2 / RT-6 convention): a returning sentence is a likelier
# regression than an un-made edit, and a positive anchor breaks on cosmetics.
# Path vars are taken LOCALLY: UNIKIT_IMPROVE_SKILL and friends are declared further down
# and `set -u` makes a forward reference fatal (the MF family does the same).
UP_TASKFMT="$ROOT_DIR/skills/unikit-plan/references/TASK-FORMAT.md"
UP_MODE_ULTRA="$ROOT_DIR/skills/unikit-plan/references/mode-ultra.md"
UP_MODE_ADD="$ROOT_DIR/skills/unikit-plan/references/mode-add.md"
UP_IMPLEMENT="$ROOT_DIR/skills/unikit-implement/SKILL.md"

# The graceful-degradation sentence is DERIVED from `unikit-implement/SKILL.md`, never held
# as a literal here. A copy in the test would be a third source of truth of exactly the class
# these guards exist to forbid.
UP_DEGRADATION="$(grep -h 'ultra-plan-read.md' "$UP_IMPLEMENT" \
    | grep 'is missing or unreadable, do not block' \
    | sed 's/^[[:space:]]*//' | head -1)"

UP_WHY=""
[[ -f "$UP_TASKFMT"     ]] || UP_WHY+=" no-task-format"
[[ -f "$UP_MODE_ULTRA"  ]] || UP_WHY+=" no-mode-ultra"
[[ -f "$UP_MODE_ADD"    ]] || UP_WHY+=" no-mode-add"
[[ -n "$UP_DEGRADATION" ]] || UP_WHY+=" no-degradation-source"

if [[ -z "$UP_WHY" ]]; then
    # (UP-1) BOTH sides of the redirect, in one guard. TASK-FORMAT.md declared itself
    # canonical for ultra while its manifest template carries neither the marker nor
    # `## Phase Index`; Step 5 sent the reader there unconditionally. A half-applied fix is
    # the likeliest outcome, and it must not pass: repairing one side leaves the other
    # standing and the contradiction survives.
    [[ "$(grep -cF 'ULTRA-PLAN-FORMAT.md' "$UP_TASKFMT")" == "1" ]] \
        || UP_WHY+=" UP-1:task-format-redirect-count"
    if grep -qF 'Full/Ultra' "$UP_TASKFMT"; then UP_WHY+=" UP-1:placement-still-claims-ultra"; fi
    if grep -qF 'Use the canonical templates from' "$UNIKIT_PLAN_SKILL"; then
        UP_WHY+=" UP-1:step5-unconditional-template-source"
    fi
    awk '/^### Step 5: Create the Plan/{f=1} /^### Step 6/{f=0} f' "$UNIKIT_PLAN_SKILL" \
        | grep -qF 'ULTRA-PLAN-FORMAT.md' || UP_WHY+=" UP-1:step5-missing-ultra-branch"

    # (UP-2) Step 0.5 must not name the modes one by one. Same defect class as UX-2 one step
    # over: the heading already carries the whole rule, and any enumeration in the body is a
    # second source of truth that goes stale on the next mode — as it did, losing `ultra`
    # and with it the `engine_rules_loaded` flag that `mode-ultra.md` Step C depends on.
    UP2_BODY="$(awk '/^### Step 0.5: Bootstrap Context/{f=1;next} /^#### /{f=0} f' "$UNIKIT_PLAN_SKILL")"
    if [[ -z "$UP2_BODY" ]]; then
        UP_WHY+=" UP-2:step-0.5-body-missing"
    elif printf '%s' "$UP2_BODY" | grep -qE '(fast|full|add|ultra), (and )?(fast|full|add|ultra)'; then
        UP_WHY+=" UP-2:body-enumerates-modes"
    fi

    # (UP-3) Two claims that are false in ultra and pull the task-scoped subsections back
    # into the manifest. Guarded by absence: both were unconditional sentences, and an
    # unconditional sentence is restored far more easily than a branch is invented.
    if grep -qF 'always included, in every mode' "$UNIKIT_PLAN_SKILL"; then
        UP_WHY+=" UP-3:nine-subsections-unconditional"
    fi
    if grep -qF 'within the one manifest' "$UNIKIT_PLAN_SKILL"; then
        UP_WHY+=" UP-3:self-check-single-file"
    fi

    # (UP-4) POSITIONAL, not merely present. The ultra reconnaissance depth gate is useless
    # below Phase C: by then the synthesis has already happened. Same reasoning as LA-7 —
    # a section that drifts past its reader is read at the wrong moment.
    UP4_ULTRA_LINE="$(awk '/^### Step 4: Explore the Codebase/{f=1} /^### Step 4.5/{f=0} f && /^#### /{print NR": "$0}' "$UNIKIT_PLAN_SKILL" | grep -i 'ultra' | head -1 | cut -d: -f1)"
    UP4_PHASEC_LINE="$(grep -n '^#### Phase C: Additional context' "$UNIKIT_PLAN_SKILL" | head -1 | cut -d: -f1)"
    if [[ -z "$UP4_ULTRA_LINE" || -z "$UP4_PHASEC_LINE" ]]; then
        UP_WHY+=" UP-4:ultra-depth-subsection-missing"
    elif (( UP4_ULTRA_LINE > UP4_PHASEC_LINE )); then
        UP_WHY+=" UP-4:ultra-depth-below-phase-c"
    fi

    # (UP-5) `replace` was the single word that let an honest executor throw away the whole
    # Step 5 section contract — Guard B included, which is what keeps an editor phase alone
    # in its execution layer. Guard B is named twice on purpose: once in Step D, once in the
    # corrected relationship sentence.
    if grep -qF 'replace Step 5 and Step 6' "$UP_MODE_ULTRA"; then
        UP_WHY+=" UP-5:steps-d-h-still-replace-step-5"
    fi
    (( "$(grep -cF 'Guard B' "$UP_MODE_ULTRA")" >= 2 )) || UP_WHY+=" UP-5:guard-b-under-named"
    awk '/^## Not part of ultra/{f=1} f' "$UP_MODE_ULTRA" | grep -qF 'mode is routed from Step 0' \
        || UP_WHY+=" UP-5:add-not-placed"

    # (UP-6) Expressed as a COUNTER, so it survives a rewording of the return instruction
    # while the invariant it protects does not move: every step that delegates into
    # `mode-full.md` must say to come back. `mode-full.md` legitimately ends its Step C with
    # a terminal "continue to the Shared Steps", which in an ultra run walks past Steps D-H.
    UP6_DELEGATING=0
    UP6_RETURNING=0
    for st in 'Step A' 'Step B' 'Step C'; do
        UP6_SEC="$(awk -v s="^### $st" '$0 ~ s{f=1;next} /^#+ Step /{f=0} f' "$UP_MODE_ULTRA")"
        if printf '%s' "$UP6_SEC" | grep -qF 'mode-full.md'; then
            UP6_DELEGATING=$((UP6_DELEGATING + 1))
            if printf '%s' "$UP6_SEC" | grep -qF 'return here'; then
                UP6_RETURNING=$((UP6_RETURNING + 1))
            fi
        fi
    done
    (( UP6_DELEGATING >= 3 )) || UP_WHY+=" UP-6:delegating-steps-lost($UP6_DELEGATING)"
    (( UP6_DELEGATING == UP6_RETURNING )) \
        || UP_WHY+=" UP-6:delegating($UP6_DELEGATING)-returning($UP6_RETURNING)"

    # (UP-7) `add` on a bundle used to append to the manifest alone, breaking it three
    # different ways depending on what it wrote. The fix is a refusal that names its owner;
    # a silent stop is indistinguishable from "there was nothing to add".
    [[ "$(grep -cF 'unikit:plan-mode:ultra' "$UP_MODE_ADD")" == "1" ]] \
        || UP_WHY+=" UP-7:marker-count"
    grep -qF 'unikit-improve' "$UP_MODE_ADD" || UP_WHY+=" UP-7:no-routing"
    grep -qF "$UP_DEGRADATION" "$UP_MODE_ADD" || UP_WHY+=" UP-7:degradation-wording-drifted"
fi

if [[ -z "$UP_WHY" ]]; then
    pass "UP-1..UP-7 ultra producer: the redirect holds on both sides, Step 0.5 keeps no mode list, the manifest claims are branched, the depth gate is in place and add refuses a bundle"
else
    fail "UP ultra producer:$UP_WHY"
fi

# ─────────────────────────────────────────────
# US: the SUBAGENTS and the plan consumers. These are exactly the files `markerConsumers` in
# scripts/test-ultra-plan-contract.mjs does not list, and that test's own comment warns that
# a consumer which forgets ultra degrades silently with nothing else in the suite noticing.
# The gap is closed here rather than by widening that list, so the contract test keeps one
# owner. Values owned by it — the seven task subsections, the `Phase Index` threshold — are
# READ from it, never copied.
US_POLISHER="$ROOT_DIR/subagents/unikit-plan-polisher.md"
US_PLAN_COORD="$ROOT_DIR/subagents/unikit-plan-coordinator.md"
US_IMPL_COORD="$ROOT_DIR/subagents/unikit-implement-coordinator.md"
US_WORKER="$ROOT_DIR/subagents/unikit-implement-worker.md"
US_IMPROVE="$ROOT_DIR/skills/unikit-improve/SKILL.md"
US_CONTRACT_TEST="$ROOT_DIR/scripts/test-ultra-plan-contract.mjs"

US_WHY=""
for f in "$US_POLISHER" "$US_PLAN_COORD" "$US_IMPL_COORD" "$US_WORKER" "$US_IMPROVE" "$US_CONTRACT_TEST"; do
    [[ -f "$f" ]] || US_WHY+=" missing:$(basename "$f")"
done

if [[ -z "$US_WHY" ]]; then
    # Derived from the contract test — the owner of both values.
    US_SUBSECTIONS="$(awk '/^const TASK_SUBSECTIONS = \[/{f=1;next} /^\];/{f=0} f' "$US_CONTRACT_TEST" \
        | sed -e "s/^[[:space:]]*'//" -e "s/',*[[:space:]]*$//")"
    US_MAX_PI="$(sed -n 's/^const MAX_PHASE_INDEX_MENTIONS = \([0-9][0-9]*\);.*/\1/p' "$US_CONTRACT_TEST" | head -1)"
    [[ -n "$US_SUBSECTIONS" ]] || US_WHY+=" US-4:subsection-list-unreadable"
    [[ -n "$US_MAX_PI"      ]] || US_WHY+=" US-7:threshold-unreadable"
fi

if [[ -z "$US_WHY" ]]; then
    # (US-1) The one actively destructive hole of the port: the polisher wrote the manifest
    # with `Write`, which drops `## Phase Index` wholesale and orphans every phase file.
    # Checked through a WINDOW over Phase C, because `Write` is legitimate in the create
    # branch — a whole-file grep could not tell the two apart.
    [[ "$(grep -cF 'unikit:plan-mode:ultra' "$US_POLISHER")" == "1" ]] || US_WHY+=" US-1:marker-count"
    US1_PHASE_C="$(awk '/^### Phase C/{f=1;next} /^### Phase D/{f=0} f' "$US_POLISHER")"
    if [[ -z "$US1_PHASE_C" ]]; then
        US_WHY+=" US-1:phase-c-missing"
    else
        printf '%s' "$US1_PHASE_C" | grep -qF 'Edit' || US_WHY+=" US-1:no-edit-branch"
        printf '%s' "$US1_PHASE_C" | grep -qF 'forbidden' || US_WHY+=" US-1:no-write-ban"
    fi

    # (US-2) A key that is written and never read is a dead key, so both sides are one guard.
    # The coordinator half is scoped to the PARSING PROCEDURE: a key named in the validation
    # prose but absent from the list of keys extracted by literal name is never read at all,
    # and a whole-file grep cannot tell those two states apart.
    grep -qF 'plan_mode' "$US_POLISHER" || US_WHY+=" US-2:polisher-does-not-report-plan_mode"
    US2_KEYS="$(awk '/extract these keys by literal name/{f=1} f{print} /^3\. Validate/{f=0}' "$US_PLAN_COORD")"
    if [[ -z "$US2_KEYS" ]]; then
        US_WHY+=" US-2:key-extraction-step-missing"
    else
        printf '%s' "$US2_KEYS" | grep -qF 'plan_mode' || US_WHY+=" US-2:plan_mode-not-extracted"
    fi

    # (US-3) The implement coordinator is a SECOND, independent entry point: the detection in
    # unikit-implement/SKILL.md never runs for it. The negative half is the load-bearing one —
    # "no second read" was the sentence asserting one read is enough, which is false for a
    # bundle whose task detail lives in the phase files.
    [[ "$(grep -cF 'unikit:plan-mode:ultra' "$US_IMPL_COORD")" == "1" ]] || US_WHY+=" US-3:marker-count"
    if grep -qF 'no second read' "$US_IMPL_COORD"; then US_WHY+=" US-3:no-second-read-returned"; fi

    # (US-4) The hand-off is closed, so reading the phase file is worthless unless the
    # coordinator PASSES it on. The seven names come from the contract test; adding an eighth
    # subsection there makes this guard demand it too, instead of silently ignoring it.
    # Scoped to the DISPATCH RULES, not the whole file: the example dispatch below them names
    # the same subsections, so a whole-file grep stays green while the rule that actually
    # governs the hand-off has lost one.
    US4_RULES="$(awk '/^### Dispatch rules/{f=1;next} /^### /{f=0} f' "$US_IMPL_COORD")"
    if [[ -z "$US4_RULES" ]]; then
        US_WHY+=" US-4:dispatch-rules-missing"
    else
        while IFS= read -r sub; do
            [[ -z "$sub" ]] && continue
            printf '%s' "$US4_RULES" | grep -qF "$sub" || US_WHY+=" US-4:not-passed:${sub// /-}"
        done <<< "$US_SUBSECTIONS"
    fi

    # (US-5) The worker's WRITE contract was already right (`never a phase file`); its READ
    # contract did not exist. Both halves are asserted so the pair reads as one contract.
    grep -qF 'never a phase file' "$US_WORKER" || US_WHY+=" US-5:write-rule-lost"
    grep -qF 'read-only' "$US_WORKER"          || US_WHY+=" US-5:no-read-only-rule"

    # (US-6) M1: a closed hand-off that sends the delegate to the manifest for rows which,
    # in a bundle, live in a phase file. Anchored on the ABSENCE of the bare pairing rather
    # than on the presence of the fix: any line naming both must also name ultra.
    US6_BAD="$(awk '/EDITOR TARGETS/ && /from the manifest/ && !/ultra/{printf "%s,", NR}' "$UP_IMPLEMENT")"
    [[ -z "$US6_BAD" ]] || US_WHY+=" US-6:editor-targets-sourced-from-manifest(lines:$US6_BAD)"

    # (US-7) The sentence M1 and M2 were both derived from, plus the improve-side rule that
    # contradicted its own umbrella rule 40 lines above it. The threshold is the contract
    # test's: a consumer restating the reader contract instead of pointing at it.
    for f in "$UP_IMPLEMENT" "$UNIKIT_VERIFY_SKILL" "$US_IMPROVE"; do
        if grep -qF 'One file carries everything' "$f"; then
            US_WHY+=" US-7:one-file-claim-returned:$(basename "$(dirname "$f")")"
        fi
    done
    if grep -qF 'There is no second file to sync with' "$US_IMPROVE"; then
        US_WHY+=" US-7:improve-single-file-sync-returned"
    fi
    US7_PI="$(grep -cF 'Phase Index' "$US_IMPROVE")"
    (( US7_PI <= US_MAX_PI )) || US_WHY+=" US-7:improve-phase-index-mentions($US7_PI-max-$US_MAX_PI)"

    # (US-8) Three NEW readers of the reader contract now carry the degradation sentence. It
    # is compared against `unikit-implement/SKILL.md` derivatively — the same discipline the
    # contract test applies to its four, extended to the readers it does not know about.
    for f in "$US_POLISHER" "$US_IMPL_COORD" "$UP_MODE_ADD"; do
        grep -qF "$UP_DEGRADATION" "$f" || US_WHY+=" US-8:degradation-drifted:$(basename "$f")"
    done
fi

if [[ -z "$US_WHY" ]]; then
    pass "US-1..US-8 ultra consumers: the polisher cannot Write over a bundle, plan_mode is read as well as written, the coordinator passes the task spec, and no consumer claims one file carries everything"
else
    fail "US ultra consumers:$US_WHY"
fi

# ─────────────────────────────────────────────
# CG: the research coherence gate, and what is left of the research spec that UR-3 does not
# watch. A gate that is written but never called is the likeliest outcome of adding one, so
# CG-3 checks its POSITION, not merely its presence: called before the write, it re-reads
# files that do not exist yet.
CG_REF="$ROOT_DIR/skills/unikit-explore/references/coherence-gate.md"
CG_SKILL="$ROOT_DIR/skills/unikit-explore/SKILL.md"
CG_RESEARCH_SPEC="$ROOT_DIR/skills/unikit-explore/references/ULTRA-RESEARCH-FORMAT.md"

CG_WHY=""
# (CG-1) It must exist, be non-empty, and NOT carry frontmatter — a reference with `name:`
# and `description:` is picked up by the Part 1 skill validation and fails it.
if [[ ! -s "$CG_REF" ]]; then
    CG_WHY+=" CG-1:reference-missing-or-empty"
else
    if [[ "$(head -1 "$CG_REF")" == "---" ]]; then CG_WHY+=" CG-1:reference-has-frontmatter"; fi

    # (CG-2) The gate's substance. Criterion 4 — quoting both sides — is what stops the gate
    # from becoming a formality, and the durable-scope rule is what makes it check the thing
    # that survives a /clear rather than what the session still remembers.
    (( "$(grep -cE '^[0-9]+\. ' "$CG_REF")" >= 4 )) || CG_WHY+=" CG-2:fewer-than-four-criteria"
    grep -qF 'not evidence' "$CG_REF"                  || CG_WHY+=" CG-2:no-durable-scope-rule"
    # The durable scope must NAME the manifest section it judges. The gate's object moved
    # from two prose documents to one hashed section, and a scope that forgot to say so
    # would send the pass looking for files that no longer exist.
    grep -qF '## Active Summary' "$CG_REF"             || CG_WHY+=" CG-2:no-active-summary-in-scope"
    grep -qF 'the `check-agent` alias' "$CG_REF"      || CG_WHY+=" CG-2:no-fresh-context-pass"
    grep -qF 'WARN [coherence]' "$CG_REF"              || CG_WHY+=" CG-2:no-inline-fallback"
    grep -qF 'Integrity' "$CG_REF"                     || CG_WHY+=" CG-2:no-boundary-with-integrity"
fi

if [[ ! -f "$CG_SKILL" ]]; then
    CG_WHY+=" CG-3:explore-skill-missing"
else
    # (CG-3) Position, not presence. The gate re-reads the durable files from disk, so a call
    # placed before the write re-reads files that do not exist yet, and a call placed after
    # the confirmation tells the user the save succeeded while it may still be incoherent.
    # Both landmarks are structural and both degenerate to `fail` when missing: the write
    # step it must follow, and the confirmation step it must precede.
    #
    # The lower landmark used to be the `## Init` maintenance command. That command is gone —
    # the registry is re-rendered on every save — and an explicit `### Step 5: Confirm the
    # save` heading took its place. It is the better bound in any case: it names the thing
    # the gate must not run *after*, where `## Init` only happened to sit below it.
    #
    # `|| true` on all three is load-bearing under `set -euo pipefail`: a non-matching grep
    # inside a command substitution fails the assignment and aborts the WHOLE suite, which
    # makes the "degenerate to fail" ladder below unreachable. Renaming a landmark used to
    # kill the run 150 checks early instead of failing this guard with a named reason.
    CG3_WRITE="$(grep -n '^### Step 4: Re-render the Researches Index' "$CG_SKILL" | head -1 | cut -d: -f1 || true)"
    CG3_CONFIRM="$(grep -n '^### Step 5: Confirm the save' "$CG_SKILL" | head -1 | cut -d: -f1 || true)"
    # Anchored on the invocation formulation, not on the first mention of the reference
    # path: the `## Delegation agents` block names that path as a POINTER (the alias's
    # fallback), and a pointer is not a call. `head -1` on the path made the declaration
    # block — which must sit above its call sites, i.e. above the write step — read as the
    # gate itself. CG-3 watches the call.
    CG3_GATE="$(grep -n 'run the gate it specifies' "$CG_SKILL" | head -1 | cut -d: -f1 || true)"
    if [[ -z "$CG3_GATE" ]]; then
        CG_WHY+=" CG-3:gate-never-called"
    elif [[ -z "$CG3_WRITE" ]]; then
        CG_WHY+=" CG-3:index-rerender-step-missing"
    elif [[ -z "$CG3_CONFIRM" ]]; then
        CG_WHY+=" CG-3:confirm-step-missing"
    elif (( CG3_GATE < CG3_WRITE )); then
        CG_WHY+=" CG-3:gate-called-before-the-write($CG3_GATE-before-$CG3_WRITE)"
    elif (( CG3_GATE > CG3_CONFIRM )); then
        CG_WHY+=" CG-3:gate-runs-after-the-confirmation($CG3_GATE-after-$CG3_CONFIRM)"
    fi

    # (CG-4) A missing reference must not lose an exploration that already happened — the
    # same trade the ultra reference makes one section above. The no-auto-save rule is
    # asserted alongside it: the gate runs after the user agreed, and must never be read as
    # replacing the question.
    grep -qF 'WARN [coherence] reference missing' "$CG_SKILL" || CG_WHY+=" CG-4:no-reference-degradation"
    grep -qF 'auto-save' "$CG_SKILL"                          || CG_WHY+=" CG-4:auto-save-rule-lost"

    # (CG-5) ultra is the natural next step after an ultra research and was not offered.
    if grep -qF '/unikit-plan [fast|full] <' "$CG_SKILL"; then CG_WHY+=" CG-5:next-steps-omit-ultra"; fi
fi

# (CG-6) The research spec must carry the manifest contract and must not take back the one
# container this repository still does not have.
# Overlaps UR-3 deliberately: UR-3 watches the vocabulary and the owner rule, CG-6 watches
# the lift obligation and the count of the checks. An overlap is cheaper here than a gap.
#
# `Active Summary` INVERTED — it used to be a negative assert here and in UR-3, on the
# grounds that the container "was never ported". It is now the machine input itself, so the
# assert flips to a positive: its absence, not its presence, is the defect. `Traceability`
# stays negative for the original reason — its work is done by Integrity checks 5 and 6, and
# the next edit copied from the source format is what would bring it back.
#
# The lift obligation keeps its own assert, and it is anchored on the FORMULATION rather than
# on the container name. Asserting it as `## Active Summary` — the obvious translation of the
# retired `RESEARCH_BRIEF.md` assert — would have been a second assert that cannot fail
# independently of the positive above it: the string occurs a dozen times in a file whose
# whole subject is that section. This file's own rule (see UR-3) is that a guard which cannot
# go red is worse than no guard, so the anchor sits on the sentence that states the duty. The
# landing site changed; the duty did not.
if [[ ! -f "$CG_RESEARCH_SPEC" ]]; then
    CG_WHY+=" CG-6:research-spec-missing"
else
    grep -qF 'Active Summary' "$CG_RESEARCH_SPEC"   || CG_WHY+=" CG-6:active-summary-missing"
    if grep -qF 'Traceability' "$CG_RESEARCH_SPEC"; then CG_WHY+=" CG-6:traceability-returned"; fi
    grep -qF 'the lift as an obligation' "$CG_RESEARCH_SPEC" || CG_WHY+=" CG-6:no-lift-obligation"
    CG6_CHECKS="$(awk '/^## Integrity/{f=1;next} /^## /{f=0} f' "$CG_RESEARCH_SPEC" | grep -cE '^[0-9]+\. ' || true)"
    (( CG6_CHECKS == 7 )) || CG_WHY+=" CG-6:integrity-checks($CG6_CHECKS-expected-7)"
fi

if [[ -z "$CG_WHY" ]]; then
    pass "CG-1..CG-6 the coherence gate exists, is called after the write, degrades without losing work, and the research spec keeps no container it does not have"
else
    fail "CG research coherence gate:$CG_WHY"
fi

# (MX-2) Mode-extraction: unikit-gd-spec six mode bodies live in references/mode-*.md and
# the inline mode sections are gone from SKILL.md (Step 2 dispatch loads them). The shared
# Regen-on-Write contract stays in SKILL.md.
MX_SPEC_WHY=""
for m in create import edit remap add-system pitch; do
    [[ -s "$GD_SPEC_REFS/mode-$m.md" ]] || MX_SPEC_WHY+=" mode-$m.md-missing"
done
! grep -qF '## Create Mode' "$GD_SPEC_SKILL"  || MX_SPEC_WHY+=" create-still-inline"
! grep -qF '## Pitch Mode' "$GD_SPEC_SKILL"   || MX_SPEC_WHY+=" pitch-still-inline"
grep -qF 'Regen-on-Write' "$GD_SPEC_SKILL"    || MX_SPEC_WHY+=" regen-not-shared"
if [[ -z "$MX_SPEC_WHY" ]]; then
    pass "unikit-gd-spec — six mode bodies extracted to references/mode-*.md (bodies not inline; Regen-on-Write shared)"
else
    fail "unikit-gd-spec — mode-extraction incomplete:$MX_SPEC_WHY"
fi

# (DC-1) Plan design-context.md: the extracted Step 4.5 body that loads the shared
# design-read contract, applies Flow-First Resolution, and carries the implemented_version
# reader (the T8-reader half, asserted at T8-6 above).
DC_WHY=""
[[ -s "$UNIKIT_PLAN_DESIGN_CONTEXT" ]]                          || DC_WHY+=" no-file"
grep -qF 'design-read.md' "$UNIKIT_PLAN_DESIGN_CONTEXT"         || DC_WHY+=" no-design-read-load"
grep -qF 'Flow-First Resolution' "$UNIKIT_PLAN_DESIGN_CONTEXT"  || DC_WHY+=" no-flow-first"
if [[ -z "$DC_WHY" ]]; then
    pass "unikit-plan/references/design-context.md — loads design-read + applies Flow-First Resolution (P3)"
else
    fail "unikit-plan design-context.md incomplete:$DC_WHY"
fi

# (FF-1) Flow-first input markers: explore loads design-read + has the first-class flow
# input; the plan dispatch names the design-context body.
FF_WHY=""
grep -qF 'design-read.md' "$UNIKIT_EXPLORE_SKILL"         || FF_WHY+=" explore-design-read"
grep -qF 'First-class flow input' "$UNIKIT_EXPLORE_SKILL" || FF_WHY+=" explore-first-class"
grep -qF 'design-context.md' "$UNIKIT_PLAN_SKILL"         || FF_WHY+=" plan-design-context-dispatch"
if [[ -z "$FF_WHY" ]]; then
    pass "flow-first input present (explore design-read + first-class flow input; plan design-context dispatch)"
else
    fail "flow-first input incomplete:$FF_WHY"
fi

# ── Content-read guards (Stage 3: CR-1…CR-3) ─────────────────────────────────
# Stage 3 delivered the Content axis to the code side READ-ONLY (the mirror of the
# flow-read, FL-6 + FF-1): the shared design-read content surface + 3-axis door, the
# unikit-plan ## Content Context brief (design-context.md §4.5.6 + the SKILL.md assembly
# step), and unikit-explore first-class content grounding. No new writeback — content has
# no implemented_version (One-Way Boundary stays systems-only). All FILE-SCOPED -qF.

# (CR-1) design-read.md carries the content read-surface + the 3-axis content door in the
# Flow-First Resolution ladder (the shared contract both code consumers apply).
CR_DR_WHY=""
grep -qF 'content_types' "$GD_DESIGN_READ"            || CR_DR_WHY+=" no-content-surface"
grep -qF 'content-types/*.md' "$GD_DESIGN_READ"       || CR_DR_WHY+=" no-content-doc-surface"
grep -qF '## Content Map [gen]' "$GD_DESIGN_READ"     || CR_DR_WHY+=" no-content-map-render"
grep -qF 'system | flow | content' "$GD_DESIGN_READ"  || CR_DR_WHY+=" no-3axis-door"
if [[ -z "$CR_DR_WHY" ]]; then
    pass "CR-1 design-read.md content surface (content_types/content-types docs/Content Map) + 3-axis door (system | flow | content)"
else
    fail "CR-1 design-read.md content surface/door incomplete:$CR_DR_WHY"
fi

# (CR-2) unikit-plan emits the ## Content Context brief: the §4.5.6 mechanics live in
# design-context.md AND the assembly step in SKILL.md references the block (without the
# SKILL.md half the brief is described but never assembled into the manifest).
CR_PLAN_WHY=""
grep -qF '4.5.6' "$UNIKIT_PLAN_DESIGN_CONTEXT"               || CR_PLAN_WHY+=" no-4.5.6"
grep -qF '## Content Context' "$UNIKIT_PLAN_DESIGN_CONTEXT"  || CR_PLAN_WHY+=" no-content-context-context"
grep -qF '## Content Context' "$UNIKIT_PLAN_SKILL"           || CR_PLAN_WHY+=" no-content-context-skill"
if [[ -z "$CR_PLAN_WHY" ]]; then
    pass "CR-2 unikit-plan ## Content Context (design-context.md §4.5.6 mechanics + SKILL.md assembly step)"
else
    fail "CR-2 unikit-plan content brief incomplete:$CR_PLAN_WHY"
fi

# (CR-3) unikit-explore grounds first-class on the content axis (reads content_types via
# the design-read content door; One-Way Boundary — read-only).
CR_EXP_WHY=""
grep -qF 'content_types' "$UNIKIT_EXPLORE_SKILL"              || CR_EXP_WHY+=" no-content-grounding"
grep -qF 'First-class content input' "$UNIKIT_EXPLORE_SKILL"  || CR_EXP_WHY+=" no-first-class-content"
if [[ -z "$CR_EXP_WHY" ]]; then
    pass "CR-3 unikit-explore content grounding (content_types read + first-class content input)"
else
    fail "CR-3 unikit-explore content grounding incomplete:$CR_EXP_WHY"
fi

# (P5-1) Rule-Loading Discipline: canon in the GD_RULES_INDEX template + anchored in the
# six rule-loading gd-skills; gd-verify is exempt (mechanical, loads no rules).
P5_WHY=""
grep -qF '## Rule-Loading Discipline' "$GD_RULES_INDEX_TPL" || P5_WHY+=" index-canon"
for s in brainstorm explore spec system flow review; do
    grep -qF 'Rule-Loading Discipline' "$ROOT_DIR/skills/unikit-gd-$s/SKILL.md" || P5_WHY+=" anchor:$s"
done
! grep -qF 'Rule-Loading Discipline' "$GD_VERIFY_SKILL" || P5_WHY+=" verify-not-exempt"
if [[ -z "$P5_WHY" ]]; then
    pass "P5 Rule-Loading Discipline — index canon + 6 skill anchors + gd-verify exempt"
else
    fail "P5 Rule-Loading Discipline incomplete:$P5_WHY"
fi

# (P4-1) No-GDD gate hints: gd-system + gd-flow read concepts/INDEX.md when GAME.md is
# absent and route concept→spec / no-concept→brainstorm.
P4_WHY=""
for s in system flow; do
    grep -qF 'concepts/INDEX.md' "$ROOT_DIR/skills/unikit-gd-$s/SKILL.md"             || P4_WHY+=" $s-no-concepts-read"
    grep -qF '/unikit-gd-brainstorm` first' "$ROOT_DIR/skills/unikit-gd-$s/SKILL.md" || P4_WHY+=" $s-no-brainstorm-route"
done
if [[ -z "$P4_WHY" ]]; then
    pass "P4 no-GDD gate hints — gd-system + gd-flow read concepts/INDEX.md + route to brainstorm/spec"
else
    fail "P4 no-GDD gate hints incomplete:$P4_WHY"
fi

# unikit-memory distillation-behavior content guards (PLAN.md T1–T10). The router
# distilled the aif-distillation protocol into unikit-memory as BEHAVIOR; bash cannot
# run an LLM skill, so these are grep invariants on the contract text + a probe-gated
# compile smoke for the ported helper. Load-bearing asserts (nothing else catches the
# regression): (a) Source Map present in BOTH module contracts — the only defense
# against T6↔T7 drift (guard #2 checks structural completeness, NOT section parity);
# (b) the ported material-prep.py is delivered (also asserted installed in
# test-install.sh — unikit-memory is the first skill shipping a scripts/ subdir);
# (c) zero aif-distillation/ai-factory literal survived the rebrand; (d) the helper
# actually parses (npm test is bash and never runs the script).
UM_SKILL="$ROOT_DIR/skills/unikit-memory/SKILL.md"
UM_PIPELINE="$ROOT_DIR/skills/unikit-memory/references/research-pipeline.md"
UM_MOD_CODE="$ROOT_DIR/skills/unikit-memory/references/module-code.md"
UM_MOD_GD="$ROOT_DIR/skills/unikit-memory/references/module-gamedesign.md"
UM_LARGE="$ROOT_DIR/skills/unikit-memory/references/large-sources.md"
UM_PREP="$ROOT_DIR/skills/unikit-memory/scripts/material-prep.py"

# (UM-1) research-pipeline carries the pipeline-behavior edits: Source Inventory (#1),
#        distill-don't-copy (#8), example coverage (#2), merge guard (#9).
UM_PIPE_WHY=""
grep -qF 'Source Inventory' "$UM_PIPELINE"      || UM_PIPE_WHY+=" source-inventory(#1)"
grep -qF "Distill, don't copy" "$UM_PIPELINE"   || UM_PIPE_WHY+=" distill-dont-copy(#8)"
grep -qF 'Example coverage' "$UM_PIPELINE"       || UM_PIPE_WHY+=" example-coverage(#2)"
grep -qF 'Merge guard' "$UM_PIPELINE"            || UM_PIPE_WHY+=" merge-guard(#9)"
if [[ -z "$UM_PIPE_WHY" ]]; then
    pass "research-pipeline.md — Source Inventory + distill + example coverage + merge guard (T1/T2)"
else
    fail "research-pipeline.md — missing:$UM_PIPE_WHY"
fi

# (UM-2) SKILL.md router carries the Quality Gate (#3), gap-list default (#5), and the
#        retroactive optimise/Branch E wiring (the inline branch + the bare `optimise`
#        keyword in the argument-hint). The hint grep anchors on " optimise" (space-led)
#        so a regression to the dropped `--optimise` flag form fails the guard. The legacy
#        --into argument-hint assert was removed when WS4 deleted the flag — do NOT
#        reintroduce a `--into` grep here.
UM_SKILL_WHY=""
grep -qF '## Quality Gate' "$UM_SKILL"               || UM_SKILL_WHY+=" quality-gate(#3)"
grep -qF 'gap list' "$UM_SKILL"                      || UM_SKILL_WHY+=" gap-list(#5)"
grep -qF '## Branch E: Optimise' "$UM_SKILL"         || UM_SKILL_WHY+=" branch-e(optimise)"
grep -qE '^argument-hint:.* optimise' "$UM_SKILL"    || UM_SKILL_WHY+=" optimise(hint)"
if [[ -z "$UM_SKILL_WHY" ]]; then
    pass "unikit-memory SKILL.md — Quality Gate + gap list + Branch E/optimise wiring (T3/T4/WS3)"
else
    fail "unikit-memory SKILL.md — missing:$UM_SKILL_WHY"
fi

# (UM-2b) WS2/WS3 content surface: references for ALL tiers (core/references) + the unified
#         Candidate Analyzer with Tier 1 / Tier 2 confidence buckets in module-code.md and the
#         on-add B.3.5 (research-pipeline.md), plus the minimal Analyzer deferral mirrored in
#         module-gamedesign.md. bash cannot run the skill, so these are grep invariants on the
#         contract text.
UM_OPT_WHY=""
grep -qF 'core/references' "$UM_MOD_CODE"        || UM_OPT_WHY+=" modc:core-references"
grep -qF 'Candidate Analyzer' "$UM_MOD_CODE"     || UM_OPT_WHY+=" modc:analyzer"
grep -qF 'Tier 1' "$UM_MOD_CODE"                 || UM_OPT_WHY+=" modc:tier1"
grep -qF 'Tier 2' "$UM_MOD_CODE"                 || UM_OPT_WHY+=" modc:tier2"
grep -qF 'Tier 1' "$UM_PIPELINE"                 || UM_OPT_WHY+=" pipe:tier1"
grep -qF 'Candidate Analyzer' "$UM_MOD_GD"       || UM_OPT_WHY+=" modgd:analyzer"
if [[ -z "$UM_OPT_WHY" ]]; then
    pass "module-code + research-pipeline + module-gamedesign — core/references + Candidate Analyzer Tier1/Tier2 (WS2/WS3)"
else
    fail "core-references / Candidate Analyzer Tier1/Tier2 — missing:$UM_OPT_WHY"
fi

# (UM-3) LOAD-BEARING (a): the ## Source Map provenance format lives in BOTH module
#        contracts. One assert — the sole guard against T6↔T7 symmetry drift, since
#        guard #2 (test-module-contract.sh) checks structural completeness, not the
#        parity of internal format sections.
UM_SRCMAP_WHY=""
grep -qF '## Source Map' "$UM_MOD_CODE" || UM_SRCMAP_WHY+=" module-code"
grep -qF '## Source Map' "$UM_MOD_GD"   || UM_SRCMAP_WHY+=" module-gamedesign"
if [[ -z "$UM_SRCMAP_WHY" ]]; then
    pass "module-code + module-gamedesign — ## Source Map format in BOTH (#6 symmetry, T6↔T7)"
else
    fail "## Source Map missing in:$UM_SRCMAP_WHY (#6 — guard #2 does NOT check section parity)"
fi

# (UM-4) module-code carries example coverage (#2) + stable filenames / anti-frag (#7).
UM_MODC_WHY=""
grep -qF 'Example coverage' "$UM_MOD_CODE"  || UM_MODC_WHY+=" example-coverage(#2)"
grep -qF 'Stable filenames' "$UM_MOD_CODE"  || UM_MODC_WHY+=" stable-filenames(#7)"
if [[ -z "$UM_MODC_WHY" ]]; then
    pass "module-code.md — example coverage + stable filenames (T6 #2/#7)"
else
    fail "module-code.md — missing:$UM_MODC_WHY"
fi

# (UM-5) large-sources.md exists, references the helper via the install-template path
#        (NOT the aif-distillation source tree), and points back at the pipeline.
if [[ ! -s "$UM_LARGE" ]]; then
    fail "large-sources.md — missing or empty (T8)"
elif ! grep -qF '{{skills_dir}}/{{self_name}}/scripts/material-prep.py' "$UM_LARGE"; then
    fail "large-sources.md — helper not referenced via install-template path (T8)"
elif grep -qF '.claude/skills/aif-distillation' "$UM_LARGE"; then
    fail "large-sources.md — still points at the aif-distillation source path (T8)"
else
    pass "large-sources.md — present + install-template helper path, no source-tree path (T8)"
fi

# (UM-6) LOAD-BEARING (b): the ported helper is present in source as a SINGLE self-contained
#        material-prep.py — no sibling modules, no package. (The WS1 split into
#        mp_config/mp_safety/mp_chunk/mp_books/mp_extract/mp_output was reverted to one file;
#        all tunables/literals now live in its CONSTANTS section.) This block asserts both the
#        single file is present AND that no mp_*.py orphan survived the revert. Delivery into an
#        installed project is asserted in test-install.sh.
UM_SCRIPTS_DIR="$ROOT_DIR/skills/unikit-memory/scripts"
UM_MP_WHY=""
[[ -s "$UM_PREP" ]] || UM_MP_WHY+=" material-prep.py(missing)"
for m in mp_config mp_safety mp_chunk mp_books mp_extract mp_output; do
    [[ -e "$UM_SCRIPTS_DIR/$m.py" ]] && UM_MP_WHY+=" $m.py(orphan)"
done
if [[ -z "$UM_MP_WHY" ]]; then
    pass "material-prep.py — single self-contained helper present, no mp_*.py orphans (T1)"
else
    fail "material-prep helper layout — issues:$UM_MP_WHY"
fi

# (UM-7) LOAD-BEARING (c): the rebrand is complete in the single-file helper — no
#        aif-distillation/ai-factory literal survived (marker constants, docstrings,
#        User-Agent, argparse desc, SENSITIVE_DIR_NAMES, temp prefixes).
if grep -qiE 'aif-distillation|ai-factory' "$UM_PREP"; then
    fail "material-prep.py — stale aif-distillation/ai-factory literal remains (T1 rebrand)"
    grep -niE 'aif-distillation|ai-factory' "$UM_PREP"
else
    pass "material-prep.py — fully rebranded, no aif-distillation/ai-factory literal (T1)"
fi

# (UM-8) LOAD-BEARING (d): probe-gated parse smoke. T9 rewrote the argparse surface and
#        marker constants; npm test is bash and never executes the script, so a
#        non-parsing port would otherwise ship green. Run behind the same Python 3 probe
#        the script/large-sources.md use; warn (not fail) when no Python 3 is present.
UM_PY=""
for c in "python3" "python" "py -3" "py"; do
    if $c --version 2>/dev/null | grep -q "Python 3"; then UM_PY="$c"; break; fi
done
if [[ -n "$UM_PY" ]]; then
    if $UM_PY "$UM_PREP" --help >/dev/null 2>&1; then
        pass "material-prep.py — parses + --help OK ($UM_PY) (T10 compile smoke)"
    else
        fail "material-prep.py — parse/--help FAILED ($UM_PY) (T10 compile smoke)"
    fi
else
    warn "material-prep.py — no Python 3 interpreter found; compile smoke skipped (probe-gated)"
fi

# (UM-9) FB2/EPUB extraction smoke + MOBI rejection + heading-less fallback (T9). bash
#        cannot exercise the extractors, so this drives the real CLI through a Python 3
#        helper that builds FB2/EPUB/.txt/.py/.mobi fixtures in a temp dir (EPUB zipped on
#        the fly — no binaries in git), runs material-prep.py, and asserts: chunks made,
#        source-index.md carries a ## TOC (heading→chunk) + a Headings: breadcrumb, the
#        FB2/EPUB headings reach the TOC, a Python `#` comment is NOT misparsed as a
#        heading, a single .mobi fails concretely, a folder .mobi is warned-by-name+skipped,
#        and a heading-less folder still chunks with NO ## TOC. Same Python 3 probe as
#        UM-8; warn (not fail) when no interpreter is present. The temp dir is removed.
if [[ -n "$UM_PY" ]]; then
    if UM_T9_OUT="$($UM_PY - "$UM_PREP" 2>&1 <<'PY'
import sys, os, subprocess, tempfile, zipfile, shutil
PREP = sys.argv[1]
PY = sys.executable
fails = []

def run(args):
    return subprocess.run([PY, PREP] + args, capture_output=True, text=True, encoding="utf-8")

work = tempfile.mkdtemp(prefix="um-t9-")
try:
    books = os.path.join(work, "books")
    os.makedirs(books)
    fb2 = ('<?xml version="1.0" encoding="utf-8"?>'
           '<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'
           '<description><title-info><book-title>FB2 Demo</book-title></title-info></description>'
           '<body><section><title><p>Intro</p></title><p>Intro body about design.</p>'
           '<section><title><p>Deep</p></title><p>Nested body.</p></section></section></body></FictionBook>')
    open(os.path.join(books, "demo.fb2"), "w", encoding="utf-8").write(fb2)
    with zipfile.ZipFile(os.path.join(books, "demo.epub"), "w") as z:
        z.writestr("mimetype", "application/epub+zip")
        z.writestr("META-INF/container.xml",
                   '<?xml version="1.0"?><container version="1.0" '
                   'xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles>'
                   '<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>'
                   '</rootfiles></container>')
        z.writestr("OEBPS/content.opf",
                   '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" '
                   'unique-identifier="b"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'
                   '<dc:title>EPUB Demo</dc:title></metadata><manifest>'
                   '<item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest>'
                   '<spine><itemref idref="c1"/></spine></package>')
        z.writestr("OEBPS/c1.xhtml",
                   '<html><body><h1>Chapter One</h1><p>Body paragraph.</p>'
                   '<h2>Sub</h2><p>More.</p></body></html>')
    open(os.path.join(books, "notes.txt"), "w", encoding="utf-8").write("Plain text, no headings.\n\nSecond paragraph.\n")
    open(os.path.join(books, "code.py"), "w", encoding="utf-8").write("# comment not heading\nx=1\n\n# another comment\ny=2\n")

    out = os.path.join(work, "out")
    r = run(["--out", out, books])
    if r.returncode != 0:
        fails.append("folder extraction exited %d: %s" % (r.returncode, r.stderr[-300:]))
    idx = os.path.join(out, "source-index.md")
    index_text = open(idx, encoding="utf-8").read() if os.path.exists(idx) else ""
    chunks_dir = os.path.join(out, "chunks")
    chunk_files = os.listdir(chunks_dir) if os.path.isdir(chunks_dir) else []
    if not chunk_files:
        fails.append("no chunk files produced")
    if "## TOC" not in index_text:
        fails.append("source-index.md missing ## TOC")
    has_breadcrumb = any("Headings:" in open(os.path.join(chunks_dir, f), encoding="utf-8").read() for f in chunk_files)
    if not has_breadcrumb:
        fails.append("no chunk carries a Headings: breadcrumb")
    if "Intro" not in index_text or "Chapter One" not in index_text:
        fails.append("TOC missing FB2/EPUB headings (Intro / Chapter One)")
    if "comment not heading" in index_text:
        fails.append("python # comment leaked into ## TOC (misparsed as heading)")

    mobi = os.path.join(work, "book.mobi")
    open(mobi, "wb").write(b"\x00MOBI")
    rm = run(["--out", os.path.join(work, "out2"), mobi])
    if rm.returncode == 0:
        fails.append("single .mobi did not fail (expected non-zero exit)")
    if "MOBI" not in (rm.stderr + rm.stdout):
        fails.append("single .mobi message not concrete (no MOBI mention)")

    mixed = os.path.join(work, "mixed")
    os.makedirs(mixed)
    open(os.path.join(mixed, "keep.md"), "w", encoding="utf-8").write("# Keep\n\ntext\n")
    open(os.path.join(mixed, "skip.mobi"), "wb").write(b"\x00")
    rf = run(["--out", os.path.join(work, "out3"), mixed])
    if rf.returncode != 0:
        fails.append("mixed folder with .mobi failed (should warn+skip+continue)")
    if "skip.mobi" not in rf.stderr:
        fails.append("folder .mobi not warned by name on stderr")

    headless = os.path.join(work, "headless")
    os.makedirs(headless)
    open(os.path.join(headless, "a.txt"), "w", encoding="utf-8").write("no headings here\n\nmore text\n")
    open(os.path.join(headless, "b.py"), "w", encoding="utf-8").write("# not heading\nz=1\n")
    out4 = os.path.join(work, "out4")
    rfb = run(["--out", out4, headless])
    if rfb.returncode != 0:
        fails.append("heading-less folder failed to chunk")
    idx4 = os.path.join(out4, "source-index.md")
    t4 = open(idx4, encoding="utf-8").read() if os.path.exists(idx4) else ""
    if "## TOC" in t4:
        fails.append("heading-less source produced a ## TOC (should be omitted)")
finally:
    shutil.rmtree(work, ignore_errors=True)

if fails:
    print("T9 FAIL:")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print("T9 OK: FB2/EPUB extraction + ## TOC + breadcrumb + MOBI reject + heading-less fallback")
sys.exit(0)
PY
)"; then
        pass "material-prep.py — FB2/EPUB extraction + ## TOC + breadcrumb + MOBI reject + fallback ($UM_PY) (T9)"
    else
        fail "material-prep.py — FB2/EPUB extraction smoke FAILED ($UM_PY) (T9)"
        echo "$UM_T9_OUT"
    fi
else
    warn "material-prep.py — no Python 3 interpreter found; FB2/EPUB extraction smoke skipped (probe-gated)"
fi

# (UM-10) Static book-format content guards (T10). These run unconditionally (no Python 3
#         needed), so the book-format surface is pinned even on a machine that skips the
#         UM-9 runtime smoke. After the single-file revert all symbols live back in
#         material-prep.py: format constants (BOOK_EXTENSIONS/REJECTED_BOOK_EXTENSIONS), the
#         FB2/EPUB extractors, the ## TOC writer, and the loud pdftotext warning. large-sources.md
#         documents the book formats + MOBI rejection + the pypdf recommendation; SKILL.md
#         Phase A lists the new extensions.
UM_T10_WHY=""
grep -qF 'BOOK_EXTENSIONS' "$UM_PREP"              || UM_T10_WHY+=" prep:BOOK_EXTENSIONS"
grep -qF 'REJECTED_BOOK_EXTENSIONS' "$UM_PREP"     || UM_T10_WHY+=" prep:REJECTED_BOOK_EXTENSIONS"
grep -qF 'def extract_fb2' "$UM_PREP"              || UM_T10_WHY+=" prep:extract_fb2"
grep -qF 'def extract_epub' "$UM_PREP"             || UM_T10_WHY+=" prep:extract_epub"
grep -qF '## TOC' "$UM_PREP"                       || UM_T10_WHY+=" prep:toc-writer"
grep -qF 'WARN: Python PDF extractors' "$UM_PREP"  || UM_T10_WHY+=" prep:pdftotext-warning"
grep -qF 'Supported book formats' "$UM_LARGE"      || UM_T10_WHY+=" large:book-formats"
grep -qF 'MOBI' "$UM_LARGE"                        || UM_T10_WHY+=" large:mobi"
grep -qF 'pypdf' "$UM_LARGE"                       || UM_T10_WHY+=" large:pypdf"
grep -qF '.fb2' "$UM_SKILL"                        || UM_T10_WHY+=" skill:.fb2"
grep -qF '.epub' "$UM_SKILL"                       || UM_T10_WHY+=" skill:.epub"
if [[ -z "$UM_T10_WHY" ]]; then
    pass "book-format static guards — material-prep.py + large-sources.md + SKILL.md (T10)"
else
    fail "book-format static guards — missing:$UM_T10_WHY"
fi

# +check / gate-result / decorative-checkpoint content guards (PLAN.md: gate-result system
# asset + +check validator on improve/review + unikit-gate-result on verify/review +
# decorative checkpoint markers in unikit-plan). bash cannot run an LLM skill, so these are
# grep invariants on the skill/reference contract text. Reuse UNIKIT_VERIFY_SKILL /
# UNIKIT_PLAN_SKILL defined in the T7/T8 block above. Case-sensitive -qF/-qE (MSYS grep
# caveat: -iF crashes).
UNIKIT_IMPROVE_SKILL="$ROOT_DIR/skills/unikit-improve/SKILL.md"
UNIKIT_REVIEW_SKILL="$ROOT_DIR/skills/unikit-review/SKILL.md"

# (CK-1) +check in BOTH improve + review argument-hints. Anchor on `\+check` (precedent:
#        the `optimise` hint grep UM-2) so a regression to a bare `check` fails.
CK_HINT_WHY=""
grep -qE '^argument-hint:.*\+check' "$UNIKIT_IMPROVE_SKILL" || CK_HINT_WHY+=" improve"
grep -qE '^argument-hint:.*\+check' "$UNIKIT_REVIEW_SKILL"  || CK_HINT_WHY+=" review"
if [[ -z "$CK_HINT_WHY" ]]; then
    pass "unikit-improve + unikit-review — +check in argument-hint"
else
    fail "+check missing from argument-hint:$CK_HINT_WHY"
fi

# (CK-2) the NEW references/{CHECK-MODE,VALIDATOR}.md exist (non-empty) for both skills.
CK_REF_WHY=""
for f in \
  "skills/unikit-improve/references/CHECK-MODE.md" \
  "skills/unikit-improve/references/VALIDATOR.md" \
  "skills/unikit-review/references/CHECK-MODE.md" \
  "skills/unikit-review/references/VALIDATOR.md"; do
    [[ -s "$ROOT_DIR/$f" ]] || CK_REF_WHY+=" $f"
done
if [[ -z "$CK_REF_WHY" ]]; then
    pass "unikit-improve + unikit-review — references/{CHECK-MODE,VALIDATOR}.md present"
else
    fail "+check reference files missing:$CK_REF_WHY"
fi

# (CK-3) the whole-dispatch skip-fallback WARN wording is pinned in BOTH CHECK-MODE.md
#        files (locked decision: skip, never inline-analyze).
CK_IMPROVE_CM="$ROOT_DIR/skills/unikit-improve/references/CHECK-MODE.md"
CK_REVIEW_CM="$ROOT_DIR/skills/unikit-review/references/CHECK-MODE.md"
CK_FB_WHY=""
grep -qF 'WARN [+check]: validator failed' "$CK_IMPROVE_CM" || CK_FB_WHY+=" improve"
grep -qF 'WARN [+check]: validator failed' "$CK_REVIEW_CM"  || CK_FB_WHY+=" review"
if [[ -z "$CK_FB_WHY" ]]; then
    pass "CHECK-MODE.md (improve+review) — skip-fallback WARN wording pinned"
else
    fail "WARN [+check]: validator failed wording missing:$CK_FB_WHY"
fi

# (CK-4) the unikit-gate-result fence + the gate-result-contract.md Bootstrap read present
#        in BOTH unikit-verify + unikit-review.
CK_GATE_WHY=""
grep -qF '```unikit-gate-result'   "$UNIKIT_VERIFY_SKILL" || CK_GATE_WHY+=" verify:fence"
grep -qF '```unikit-gate-result'   "$UNIKIT_REVIEW_SKILL" || CK_GATE_WHY+=" review:fence"
grep -qF 'gate-result-contract.md' "$UNIKIT_VERIFY_SKILL" || CK_GATE_WHY+=" verify:contract-read"
grep -qF 'gate-result-contract.md' "$UNIKIT_REVIEW_SKILL" || CK_GATE_WHY+=" review:contract-read"
if [[ -z "$CK_GATE_WHY" ]]; then
    pass "unikit-verify + unikit-review — unikit-gate-result fence + contract Bootstrap read"
else
    fail "gate-result fence/contract-read missing:$CK_GATE_WHY"
fi

# (CK-5) SHARED graceful-degradation wording — ONE -qF string applied to BOTH verify +
#        review. Locks the Task 3.1 canonical-template <-> Task 2.4(b) mirror contract:
#        drift in either file's degradation wording fails this guard. ASCII-only substring
#        (avoids the em-dash in the full sentence) so MSYS grep matches reliably.
CK_SHARED='emit the block from the inline schema in this section'
CK_DEGRADE_WHY=""
grep -qF "$CK_SHARED" "$UNIKIT_VERIFY_SKILL" || CK_DEGRADE_WHY+=" verify"
grep -qF "$CK_SHARED" "$UNIKIT_REVIEW_SKILL" || CK_DEGRADE_WHY+=" review"
if [[ -z "$CK_DEGRADE_WHY" ]]; then
    pass "unikit-verify + unikit-review — shared gate-result graceful-degradation wording identical"
else
    fail "shared gate-result degradation wording missing/drifted:$CK_DEGRADE_WHY"
fi

# (CK-6) unikit-review +check-enabling frontmatter intact — TWO asserts. Without either,
#        review's +check validator is DEAD ON ARRIVAL, and the suite has no other
#        allowed-tools CONTENT guard (Part 7b checks list FORMAT only, not tool names).
CK_RV_FM_WHY=""
grep -qE '^  - Agent$' "$UNIKIT_REVIEW_SKILL"                  || CK_RV_FM_WHY+=" allowed-tools:Agent"
grep -qF '<!-- unikit:agents codex -->' "$UNIKIT_REVIEW_SKILL" || CK_RV_FM_WHY+=" subagent-delegation-marker"
if [[ -z "$CK_RV_FM_WHY" ]]; then
    pass "unikit-review — Agent in allowed-tools + Subagent Delegation marker (Task 2.4d)"
else
    fail "unikit-review +check frontmatter DEAD ON ARRIVAL — missing:$CK_RV_FM_WHY"
fi

# (CK-7) decorative commit-checkpoint marker in the unikit-plan TASK-FORMAT.md Checklist.
CK_TASKFMT="$ROOT_DIR/skills/unikit-plan/references/TASK-FORMAT.md"
if grep -qF '<!-- Commit checkpoint' "$CK_TASKFMT"; then
    pass "unikit-plan TASK-FORMAT.md — decorative <!-- Commit checkpoint marker present (Task 4.1)"
else
    fail "unikit-plan TASK-FORMAT.md — missing decorative <!-- Commit checkpoint marker (Task 4.1)"
fi

# ─────────────────────────────────────────────
# PL: the plan manifest is ONE file, and it stays one.
# RISK-007 in the plan bundle stated the gap in full: the suite could not detect a
# half-applied rename. Zero asserts existed on the names of the files inside a plan
# folder — `TASKS.md` appeared nowhere in this script, `PLAN-BRIEF` only in a comment,
# and the five `TASKS.md` seeds in test-golden-guard.sh are opaque relocation fixtures
# that would have stayed green through the whole rename. That is worse than no coverage:
# it is false confidence. Five guards close five distinct ways to get it wrong — bring
# an old name back, leave a name unqualified, reorder the manifest, resurrect the second
# file, resurrect the machinery that kept two files in step.
# Placed AFTER the CK block on purpose: PL reuses UNIKIT_PLAN_SKILL, UNIKIT_IMPROVE_SKILL
# and CK_TASKFMT, all declared above, and `set -u` makes a forward reference fatal.
PL_TASKFMT="$CK_TASKFMT"                                  # skills/unikit-plan/references/TASK-FORMAT.md
PL_SCAN_ROOTS=("$ROOT_DIR/skills" "$ROOT_DIR/subagents")
PL_VOCAB_ALLOW="$ROOT_DIR/skills/unikit-plan/references/TASK-FORMAT.md"

# (PL-1) The naming vocabulary. After the merge two different files are called
# PLAN.md: the flat fast plan (.unikit/code/PLAN.md) and the folder manifest
# (.unikit/code/plans/<folder>/PLAN.md). Paths tell them apart; prose does not.
# A bare backtick-delimited `PLAN.md` is therefore forbidden everywhere in
# skills/** and subagents/*, with ONE measured allowlist entry:
#   skills/unikit-plan/references/TASK-FORMAT.md — the file that DECLARES the
#   vocabulary and must be able to name the file it is naming.
# Every legitimate reference is qualified and so cannot match: `.unikit/code/PLAN.md`,
# `.unikit/code/plans/<folder>/PLAN.md`, `plans/*/PLAN.md` all carry a path prefix
# inside the same backticks, which puts a `/` where the opening backtick would have to be.
# Extending this allowlist is a signal that the vocabulary was broken, not that the
# guard is strict — every entry must carry its reason in this comment.
PL1_HITS="$({ grep -rn -- '`PLAN\.md`' "${PL_SCAN_ROOTS[@]}" --include='*.md' 2>/dev/null || true; } | { grep -vF "$PL_VOCAB_ALLOW" || true; })"
if [[ -z "$PL1_HITS" ]]; then
    pass "PL-1 no bare \`PLAN.md\` in skills/** or subagents/* (every mention is path-qualified)"
else
    fail "PL-1 a bare \`PLAN.md\` is ambiguous — qualify it with its path:"
    echo "$PL1_HITS" | head -5
fi

# (PL-2) Zero occurrences of the pre-merge file names anywhere in the delivered
# surfaces. This is the guard RISK-007 says the suite never had: before it, a
# half-applied rename left 17 files broken silently and nothing turned red.
# Scope is skills/**, subagents/* and data/** (UNITY_RULES.md lives there). docs/**
# is deliberately OUT of scope — the documentation is rewritten by tasks 15-16, and a
# second guard over it would be a second owner of one fact; those tasks carry an
# explicit grep in their acceptance criteria instead.
# ONE measured allowlist entry: the pre-merge detection branch in
# skills/unikit-improve/SKILL.md. That branch exists to recognise an
# un-migrated plan folder and send the user to `unikit-ai update`; a branch that
# DESCRIBES the old shape instead of naming it cannot be executed reliably, so
# this is the one place where the retired name is load-bearing rather than stale.
# The entry is pinned to the marker `(a pre-merge plan)` on that same line, not
# to the file — exempting the whole file would re-open the 27 occurrences the
# merge removed from it.
PL2_ALLOW='(a pre-merge plan)'
PL2_HITS="$({ grep -rn -e 'TASKS\.md' -e 'PLAN-BRIEF' "${PL_SCAN_ROOTS[@]}" "$ROOT_DIR/data" --include='*.md' 2>/dev/null || true; } | { grep -vF "$PL2_ALLOW" || true; })"
if [[ -z "$PL2_HITS" ]]; then
    pass "PL-2 the pre-merge names (TASKS.md / PLAN-BRIEF) are gone from skills/**, subagents/*, data/**"
else
    fail "PL-2 a pre-merge plan file name survived the merge:"
    echo "$PL2_HITS" | head -5
fi

# (PL-3) Degenerate-to-fail, on the NN-4 convention: if the scan finds no object
# at all — no skills/, no subagents/ — PL-1 and PL-2 would pass vacuously, and a
# vacuous pass on a rename guard is exactly the false confidence RISK-007 named.
PL3_SCANNED="$({ grep -rl -- '`' "${PL_SCAN_ROOTS[@]}" --include='*.md' 2>/dev/null || true; })"
if [[ -n "$PL3_SCANNED" ]]; then
    pass "PL-3 the vocabulary scan has an object ($(echo "$PL3_SCANNED" | wc -l | tr -d ' ') markdown files under skills/ + subagents/)"
else
    fail "PL-3 nothing scanned — PL-1 and PL-2 would pass vacuously"
fi

# (PL-4) The manifest section order is a contract, not layout. /unikit-mcp-trap reads
# its section as "the `## MCP Findings` heading down to the next `##`", so where that
# heading sits decides what the trap transfers into the project's notes. Three
# assertions over the template block in TASK-FORMAT.md, by LINE ORDER inside the
# fence rather than by grep -c — a heading named in prose elsewhere in the file must
# not be able to satisfy this:
#   1. `## MCP Findings` stands ABOVE `## Technical Context`. Below it, the nine
#      `###` subsections of the technical brief fall inside the findings window.
#   2. The findings window is CLOSED by a following `##` — it never runs to the end
#      of the template. The canonical tail (A4) is `## Dependency Graph` →
#      `## Total Estimated Effort` → `## Technical Context`, so the window shuts on
#      the first of them.
#   3. After `## Technical Context` there is either nothing or exactly ONE heading —
#      `## Open Questions`, which the planning pass fills. Stated as a pair invariant
#      rather than as "Technical Context is last", because the positional form would
#      turn red on the very tail section this delivery introduces.
# The existence probe is not decoration: the awk below runs inside an assignment,
# and under `set -e` a command substitution that exits non-zero kills the whole
# suite with a bash message instead of a readable verdict. NN-1 / NN-4 / PL-3 all
# degenerate to `fail` when their object is gone; this keeps PL-4 on the same
# convention. The trailing `|| true` covers every other awk exit path.
if [[ ! -f "$PL_TASKFMT" ]]; then
    fail "PL-4 TASK-FORMAT.md missing — the guard has no object left"
else
    PL4_WHY="$(awk '
    /^## Plan Manifest Template/ { seek = 1; next }
    seek && /^```/               { infence = 1; seek = 0; next }
    infence && /^```/            { infence = 0; exit }
    infence && /^## /            { n++; head[n] = $0 }
    END {
        mcp = 0; tech = 0
        for (i = 1; i <= n; i++) {
            if (head[i] == "## MCP Findings")      mcp  = i
            if (head[i] == "## Technical Context") tech = i
        }
        if (mcp  == 0) printf " no-MCP-Findings-heading-in-template"
        if (tech == 0) printf " no-Technical-Context-heading-in-template"
        if (mcp == 0 || tech == 0) exit
        if (mcp > tech) printf " findings-below-technical-context"
        if (mcp == n)   printf " findings-window-runs-to-end-of-template"
        for (i = tech + 1; i <= n; i++)
            if (head[i] != "## Open Questions") printf " unexpected-tail-section(%s)", head[i]
    }
' "$PL_TASKFMT" || true)"
    if [[ -z "$PL4_WHY" ]]; then
        pass "PL-4 manifest section order — MCP Findings above Technical Context, findings window closed, only Open Questions may follow"
    else
        fail "PL-4 manifest section order broken in $PL_TASKFMT:$PL4_WHY"
    fi
fi

# (PL-5) The three sync mechanisms the merge removed. Each existed ONLY because a
# plan was two files; a copy-paste from an old revision brings any of them back
# without any other guard noticing. The middle assert is POSITIVE on purpose —
# without it, deleting the two-file sync rule is indistinguishable from deleting
# the rule that replaced it.
# The third anchor quotes the retired rule 11 in full rather than the two words
# `Always create`. Two words are a phrase anyone might write about anything —
# `Always created` on the neighbouring line already matches them as a substring —
# and the guard would then turn red with a message naming a second file that does
# not exist, sending the reader after a fault nobody introduced. This literal is a
# regression detector; scripts/ is outside PL-2's scan roots, so it can name the
# retired file without contradicting the guard three blocks above.
PL5_WHY=""
if grep -qF 'Keep files in sync' "$UNIKIT_IMPROVE_SKILL"; then PL5_WHY+=" improve-still-syncs-two-files"; fi
grep -qF '`Write` over a plan manifest is forbidden' "$UNIKIT_IMPROVE_SKILL" || PL5_WHY+=" improve-missing-Write-ban"
if grep -qF 'Always create PLAN-BRIEF.md' "$UNIKIT_PLAN_SKILL"; then PL5_WHY+=" plan-still-creates-a-second-file"; fi
if [[ -z "$PL5_WHY" ]]; then
    pass "PL-5 two-file sync machinery stays retired (no Keep-files-in-sync, no Always-create; the Write ban is in place)"
else
    fail "PL-5 a two-file mechanism came back:$PL5_WHY"
fi

# ─────────────────────────────────────────────
# RD: research drift is a CONTENT signal, and one procedure computes it in four files.
# `## Based on` used to carry a link timestamp compared against a research index
# timestamp — two clocks written by the same class of agent with the same care. The
# field is now the SHA256 of a REGION — the bytes between the `## Active Summary`
# markers of the linked `RESEARCH.md` — and three consumers recompute it. Four guards
# close the four ways that goes wrong: the procedure diverges, the grant that makes it
# runnable is missing, the label and the writer/reader split drift apart, or the
# machine input silently reverts from a region back to a file.
# Placed next to the PL family and reusing UNIKIT_PLAN_SKILL / UNIKIT_IMPROVE_SKILL /
# UNIKIT_VERIFY_SKILL declared above; UNIKIT_IMPLEMENT_SKILL has no earlier declaration
# (the MF block below takes its own path var locally), so it is declared here — `set -u`
# makes a forward reference fatal.
UNIKIT_IMPLEMENT_SKILL="$ROOT_DIR/skills/unikit-implement/SKILL.md"
# RD-E asserts the marker pair is DECLARED by its owner, so it needs the path to the
# research-format spec. That path belongs to the UR family below; it is declared here
# instead of copied, because `set -u` makes a forward reference fatal and a second
# literal of the same path is exactly the drift these guards exist to catch.
UR_REF="$ROOT_DIR/skills/unikit-explore/references/ULTRA-RESEARCH-FORMAT.md"

# (RD-A) The recorded field and the normalization procedure, in all FOUR files.
# unikit-plan writes the hash; unikit-{improve,implement,verify} recompute it. If the
# normalization diverges by a single rule in ONE of them, that skill reports drift that
# did not happen — and the failure reads as "the research changed", not as "the guard is
# missing". The tokens are chosen, not sampled: `UTF-8 BOM` and `one final newline` are
# the two rules whose divergence produces a FALSE drift on byte-identical content (and
# the BOM rule exists because this project's primary platform is Windows);
# `never a temp file` is the stdin rule; `RESEARCH.md` is the file the hashed region
# lives in, and `unikit:active-summary:start` is rule 0 — the rule that makes the object
# a REGION rather than the whole file. Rule 0 is asserted separately from the other five
# for one measured reason: it is the only one that can vanish alone. Drop it and the five
# survivors still describe a coherent procedure, over the wrong object — the whole
# manifest, whose `## Sessions` grows on every save, so every append would report drift
# that did not happen. The negative half is load-bearing:
# without it a half-applied replacement leaves both mechanisms standing and a consumer
# reads a field /unikit-plan no longer writes. That half is anchored on the FIELD form
# `**Attached**`, never on the bare word: `Attached` is ordinary English and a sentence
# beginning "Attached research folders are…" would turn the guard red with nothing
# regressed — a false positive on a negative assert teaches people to delete it.
RDA_READERS=("$UNIKIT_IMPROVE_SKILL" "$UNIKIT_IMPLEMENT_SKILL" "$UNIKIT_VERIFY_SKILL")
RDA_ALL=("$UNIKIT_PLAN_SKILL" "${RDA_READERS[@]}")
RDA_ATTACHED_ALLOW='(the retired link-timestamp field)'
RDA_BRIEF_ALLOW='the retired brief field'
RDA_WHY=""
for f in "${RDA_ALL[@]}"; do
    n="$(basename "$(dirname "$f")")"
    grep -qF 'Summary SHA256'    "$f" || RDA_WHY+=" $n-no-field"
    grep -qF 'UTF-8 BOM'         "$f" || RDA_WHY+=" $n-no-bom-rule"
    grep -qF 'one final newline' "$f" || RDA_WHY+=" $n-no-final-newline-rule"
    grep -qF 'never a temp file' "$f" || RDA_WHY+=" $n-no-stdin-rule"
    grep -qF 'RESEARCH.md'       "$f" || RDA_WHY+=" $n-no-hashed-object"
    grep -qF 'unikit:active-summary:start' "$f" || RDA_WHY+=" $n-no-rule-0"
    # ONE measured allowlist entry, on the PL-2 precedent and for the same reason: the
    # /unikit-improve branch that REMOVES the retired field has to name it, and a branch that
    # DESCRIBES the old shape instead of naming it cannot be executed reliably. Pinned to the
    # marker on that same line, never to the file — exempting the file would re-open every
    # occurrence the replacement removed from it.
    if grep -F '**Attached**' "$f" | grep -vF "$RDA_ATTACHED_ALLOW" | grep -q .; then RDA_WHY+=" $n-attached-survives"; fi
    # Second allowlisted negative, same shape and same reason as `**Attached**` above: the
    # retired field name survives ONLY where a branch has to name it — the writer's legacy
    # note, branch 5 of the three readers, and the Step 5.5 line that DELETES it. Pinned to
    # the turn of phrase on that same physical line, never to the file: exempting a file
    # would re-open every occurrence the replacement removed from it.
    #
    # The allowlist literal is deliberately WITHOUT parentheses, and that is measured, not
    # stylistic. The sanctioned occurrences carry it in two different wrappings — the writer
    # inside `(the retired brief field)`, the readers inside
    # `(recorded against the retired brief field)`. Only the bracketless form is a substring
    # of both: after the opening parenthesis the readers have `recorded`, so a parenthesized
    # allowlist would match none of their lines and would turn three files out of four red
    # inside the one commit this phase declares indivisible.
    if grep -F 'Brief SHA256' "$f" | grep -vF "$RDA_BRIEF_ALLOW" | grep -q .; then RDA_WHY+=" $n-retired-field-survives"; fi
done
if [[ -z "$RDA_WHY" ]]; then
    pass "RD-A Summary SHA256 + the one normalization procedure (incl. rule 0) present in all four files (retired fields gone)"
else
    fail "RD-A research-drift procedure diverged:$RDA_WHY"
fi

# (RD-B) The grant that makes the procedure followable at all. Without it the
# normalization text is an instruction the skill cannot carry out, and the skill degrades
# to the WARN branch on every single plan — silently, because that WARN branch is a
# legitimate state. Both names are required: `shasum` ships with perl (macOS, Git Bash),
# `sha256sum` with GNU coreutils (Linux, Git Bash).
# Rule 0 (extract the region between the markers) adds nothing here: it is performed on
# text the skill has already read, not by a shell command, so the list of two names stays
# complete and no `awk`/`sed` grant joins it.
RDB_WHY=""
for f in "${RDA_ALL[@]}"; do
    n="$(basename "$(dirname "$f")")"
    grep -qF 'Bash(shasum *)'    "$f" || RDB_WHY+=" $n-no-shasum"
    grep -qF 'Bash(sha256sum *)' "$f" || RDB_WHY+=" $n-no-sha256sum"
done
if [[ -z "$RDB_WHY" ]]; then
    pass "RD-B the hash grant follows the procedure into all four skills"
else
    fail "RD-B a skill carries the normalization procedure but not the grant:$RDB_WHY"
fi

# (RD-C) One label for every drift branch, and the writer/reader split.
# The label: every branch shares `WARN [research-drift]` precisely so a log can be
# grepped for drift; per-branch labels would make them indistinguishable in aggregate.
# The split: only unikit-plan (on create) and unikit-improve (on an explicit rebase) may
# WRITE a hash. The negative half is the load-bearing one — `instead` is legitimate in a
# dozen other places in these files, so the search is narrowed to lines naming the brief
# itself: reading the live brief INSTEAD of the plan is the scope-widening channel this
# whole contract exists to close, and a drift check standing next to that channel is
# decoration.
RDC_WHY=""
for f in "${RDA_READERS[@]}"; do
    n="$(basename "$(dirname "$f")")"
    grep -qF 'WARN [research-drift]' "$f" || RDC_WHY+=" $n-no-canonical-label"
done
grep -qF 'verification bug' "$UNIKIT_VERIFY_SKILL" || RDC_WHY+=" verify-not-mandatory"
for f in "$UNIKIT_IMPLEMENT_SKILL" "$UNIKIT_VERIFY_SKILL"; do
    n="$(basename "$(dirname "$f")")"
    # The negative half binds to the ADJACENCY, not to the word and not to the line. Two
    # earlier shapes were measured and both are wrong: `grep -qF 'instead'` over lines naming
    # the source condemns the correct sentence ("read the plan's `## Technical Context` instead
    # of `RESEARCH.md`"), and ordering the two tokens across the whole line does not fix
    # it either — the repaired sentence names the source TWICE, so the first occurrence and a
    # later `instead` still match. What is banned is the source immediately followed by
    # `instead`; anything else is prose. Same class as the RD-A anchor above: a negative assert
    # binds to a form, never to a word (patch 2026-08-22-12.40). Only the file name moved when
    # the brief was folded into the manifest — the form of the assert did not.
    if grep -qE 'RESEARCH\.md`?[[:space:]]+instead' "$f"; then RDC_WHY+=" $n-still-reads-instead"; fi
    # The positive counterpart, and the durable half: a positive assert cannot false-positive,
    # so it — not the negative — is what survives a rewrite of the sentence.
    grep -qF 'as a substitute for the plan' "$f" || RDC_WHY+=" $n-no-substitute-ban"
done
if [[ -z "$RDC_WHY" ]]; then
    pass "RD-C one canonical WARN [research-drift] label; implement/verify check the hash and never read the brief instead of the plan"
else
    fail "RD-C drift label / writer-reader split:$RDC_WHY"
fi

# (RD-D) The field has a writer for an entry that does not carry it.
# RD-A proves three consumers READ `Summary SHA256` and that /unikit-plan writes it on create.
# Nothing proved anything can write one into an entry created BEFORE the field existed — and
# the on-disk plan migration rewrites the manifest without touching `## Based on`. Measured:
# every plan that predates the field reported `drift unknown` on every run, /unikit-verify
# held its gate at `warn` permanently, and Step 1.5 offered the user a re-link that Step 5.5
# had no branch to carry out. Reachability is a separate invariant from presence — a guard
# that an artifact exists says nothing about whether control flow reaches it
# (patch 2026-08-22-09.18).
# Both halves are load-bearing and neither substitutes for the other: the WRITE half asserts
# Step 5.5 carries the branch, the WIRING half asserts the Step 1.5 offer names the step that
# performs it. An offer pointing nowhere and a branch nobody reaches fail differently and are
# equally dead. Anchored on formulations, never on the step numbers, which renumber.
RDD_STEP55="$(awk '/^\*\*5\.5:/{f=1} f&&/^\*\*5\.6:/{f=0} f' "$UNIKIT_IMPROVE_SKILL")"
RDD_WHY=""
# Degenerate to fail when the section is gone (NN-4 / RT-7 convention).
[[ -n "$RDD_STEP55" ]] || RDD_WHY+=" no-step-5.5-body"
printf '%s' "$RDD_STEP55" | grep -qF 'records the field on an entry that has none' || RDD_WHY+=" no-relink-writer"
# Doubled, not replaced. The branch does two things now — it WRITES `Summary SHA256` and it
# DELETES a legacy `Brief SHA256` line — and replacing the assert instead of splitting it
# would have dropped half the contract without a single test turning red.
printf '%s' "$RDD_STEP55" | grep -qF 'Summary SHA256' || RDD_WHY+=" writer-does-not-name-the-field"
printf '%s' "$RDD_STEP55" | grep -qF 'Brief SHA256'   || RDD_WHY+=" writer-does-not-drop-the-retired-field"
grep -qF 'the write is Step 5.5 item 3' "$UNIKIT_IMPROVE_SKILL" || RDD_WHY+=" offer-not-wired-to-writer"
# The write is gated on the user's answer: hashing a brief nobody was asked about would claim
# "no drift" over a period that was never examined.
printf '%s' "$RDD_STEP55" | grep -qF 'Never perform this write without that answer' || RDD_WHY+=" write-not-gated-on-consent"
if [[ -z "$RDD_WHY" ]]; then
    pass "RD-D a hashless \`## Based on\` entry has a writer, and the Step 1.5 offer is wired to it"
else
    fail "RD-D the drift-unknown state has no exit:$RDD_WHY"
fi

# (RD-E) The machine input is a REGION, and it stays one.
# RD-A asserts the tokens of the procedure; nothing asserted the shape of its object. The
# regression this closes is narrow and quiet: the hashed object reverts from "the bytes
# between two markers" to "the whole file", every appended session reports drift, and the
# consumer prints "the research changed" about a research nobody touched — RISK-1 exactly,
# a failure that reads as a finding.
# Four assertions, and the negative is the point of the guard.
RDE_WHY=""
# 1. The marker pair is DECLARED by its owner. The overlap with RM-1 is deliberate and not
#    redundant: RM-1 looks at the PRODUCER (does /unikit-explore write the markers), RD-E at
#    the CONSUMERS (do the four readers name the region those markers delimit). Either can
#    go red alone, and they fail for different reasons.
[[ -s "$UR_REF" ]] || RDE_WHY+=" no-format-spec"
grep -qF 'unikit:active-summary:start' "$UR_REF" || RDE_WHY+=" markers-not-declared-by-owner"
grep -qF 'unikit:active-summary:end'   "$UR_REF" || RDE_WHY+=" end-marker-not-declared"
# 2. All four skills name the REGION, not the file. One -qF literal applied to four files, so
#    a rephrasing in any one of them turns the guard red — which is the only mechanism holding
#    four verbatim copies of one procedure together.
for f in "${RDA_ALL[@]}"; do
    n="$(basename "$(dirname "$f")")"
    grep -qF 'between the `## Active Summary` markers' "$f" || RDE_WHY+=" $n-names-a-file-not-a-region"
done
# 3. The NEGATIVE: the reversed decision has not come back. `/unikit-plan` used to carry a
#    written refusal of markers — "The file split is the marker" — and that sentence is the
#    direct detector, because a revert would restore the sentence together with the behaviour.
for f in "${RDA_ALL[@]}"; do
    n="$(basename "$(dirname "$f")")"
    if grep -qF 'The file split is the marker' "$f"; then RDE_WHY+=" $n-file-split-refusal-returned"; fi
done
# 4. The legacy branch exists exactly where it is owed. The three READERS meet entries written
#    before the field was renamed and must report `drift unknown` rather than recompute; the
#    WRITER never does — it creates new entries, it does not read old ones. Asserting the
#    absence in unikit-plan is what keeps the branch from being pasted into all four out of
#    symmetry, which would put a reader's contract in a file that has no reader.
for f in "${RDA_READERS[@]}"; do
    n="$(basename "$(dirname "$f")")"
    grep -qF 'recorded against the retired brief' "$f" || RDE_WHY+=" $n-no-legacy-branch"
done
if grep -qF 'recorded against the retired brief' "$UNIKIT_PLAN_SKILL"; then RDE_WHY+=" plan-carries-a-reader-branch"; fi
# 5. The legacy branch is REACHABLE, not merely present. Measured in review: with the branches
#    read in order, an entry carrying only the retired field fell through the mismatch branch
#    first — because that branch said "Recomputed ≠ recorded" without naming which field
#    `recorded` meant — and reported `WARN [research-drift] … no longer byte-identical` about a
#    research nobody had touched. Presence is not reachability, the same distinction RD-D draws
#    for the writer, and no token-presence assert above can see it. Two literals hold the two
#    halves: the precondition that gates the recompute, and the named field that makes the
#    comparison unambiguous once it runs.
for f in "${RDA_READERS[@]}"; do
    n="$(basename "$(dirname "$f")")"
    grep -qF 'Only when the entry carries a'   "$f" || RDE_WHY+=" $n-recompute-not-gated"
    grep -qF 'the recorded `Summary SHA256`'   "$f" || RDE_WHY+=" $n-comparison-does-not-name-the-field"
done
if [[ -z "$RDE_WHY" ]]; then
    pass "RD-E the hashed object is the Active Summary region in all four files; the file-split refusal is gone"
else
    fail "RD-E machine-input contract broken:$RDE_WHY"
fi

# =============================================
# NM: dateless naming - the date left the folder name and became two header fields.
# Scope of this family is `skills/** + subagents/**`, and the second half is the point: the
# measurement that preceded this change looked at `src/**/*.ts` and `skills/**` only, and both
# files it missed live under `subagents/` - `unikit-implement-coordinator.md` RESOLVES a plan
# folder, `unikit-plan-polisher.md` PRODUCES one. One of each, missed for the same reason.
# Placed AFTER the RD family and reusing the path vars declared there - `set -u` makes a
# forward reference fatal.
# Negatives bind to a FORM (`{YYYY-MM-DD}_`, `<dated-folder>`, `the date prefix already
# gives`, `lexicographically descending`), never to the words `date` or `sort`, which are
# legitimate dozens of times in these same files.
# =============================================
NM_MODE_FULL="$ROOT_DIR/skills/unikit-plan/references/mode-full.md"
NM_MODE_LIST="$ROOT_DIR/skills/unikit-plan/references/mode-list.md"
NM_MODE_ADD="$ROOT_DIR/skills/unikit-plan/references/mode-add.md"
NM_MODE_ULTRA="$ROOT_DIR/skills/unikit-plan/references/mode-ultra.md"
NM_ULTRA_PLAN="$ROOT_DIR/skills/unikit-plan/references/ULTRA-PLAN-FORMAT.md"
NM_IMPL_COORD="$ROOT_DIR/subagents/unikit-implement-coordinator.md"
NM_PLAN_POLISHER="$ROOT_DIR/subagents/unikit-plan-polisher.md"
NM_EXPLORE_SKILL="$ROOT_DIR/skills/unikit-explore/SKILL.md"
# UNIKIT_PLAN_SKILL / UNIKIT_IMPROVE_SKILL / UNIKIT_IMPLEMENT_SKILL / UNIKIT_VERIFY_SKILL come
# from the RD family above; CK_TASKFMT is the TASK-FORMAT.md path declared with the CK family.
NM_WHY=""

# (NM-1) No producer assembles a date into a folder name.
# Four tokens, and the last two are the measured ones. A file can assert datedness WITHOUT
# showing the format - `plans/<dated-folder>/PLAN.md` did exactly that in mode-ultra.md, and a
# two-token negative passed over it green. The fourth token catches the other way of asserting
# it: not as a name format but as a WORKING MECHANISM - "the date prefix already gives both
# order and uniqueness" stood in the same file, invisible to the first three tokens and to
# NM-4 as well, while both guards held that file in scope.
NM_PRODUCERS=("$UNIKIT_PLAN_SKILL" "$NM_MODE_FULL" "$NM_MODE_ULTRA" "$NM_ULTRA_PLAN" "$CK_TASKFMT")
for f in "${NM_PRODUCERS[@]}"; do
    n="$(basename "$f")"
    if [[ ! -s "$f" ]]; then NM_WHY+=" NM-1:$n-missing"; continue; fi
    for tok in '{YYYY-MM-DD}_' '<date>_' '<dated-folder>' 'the date prefix already gives'; do
        if grep -qF "$tok" "$f"; then NM_WHY+=" NM-1:$n-dated[$tok]"; fi
    done
done
# A negative with no positive is satisfied by an empty file. Three producers must still say
# what the name IS.
for f in "$UNIKIT_PLAN_SKILL" "$NM_ULTRA_PLAN" "$NM_MODE_ULTRA"; do
    grep -qF 'plans/<feature-name>/' "$f" || NM_WHY+=" NM-1:$(basename "$f")-no-dateless-form"
done

# (NM-2) The header carries both marks and the rule, in BOTH templates.
# The rule is asserted apart from the fields on purpose: fields without it start moving on
# every checkbox tick within a release, and "latest" quietly stops answering its question.
grep -qF 'Created:'             "$CK_TASKFMT" || NM_WHY+=" NM-2:taskfmt-no-created"
grep -qF 'Updated:'             "$CK_TASKFMT" || NM_WHY+=" NM-2:taskfmt-no-updated"
grep -qF 'does **not** move it' "$CK_TASKFMT" || NM_WHY+=" NM-2:taskfmt-no-tick-rule"
# The ultra half, checked by SECTION WINDOW rather than by file: a grep over the whole file
# would pass on the fields being discussed in prose, and what must exist is the template.
NM_ULTRA_TPL="$(awk '/^## Manifest Template/{f=1;next} /^## /{f=0} f' "$NM_ULTRA_PLAN")"
if [[ -z "$NM_ULTRA_TPL" ]]; then NM_WHY+=" NM-2:no-ultra-manifest-template"; fi
printf '%s' "$NM_ULTRA_TPL" | grep -qF 'Created:' || NM_WHY+=" NM-2:ultra-template-no-created"
printf '%s' "$NM_ULTRA_TPL" | grep -qF 'Updated:' || NM_WHY+=" NM-2:ultra-template-no-updated"
# Two negatives on both templates: the H1 form is unchanged and no third owner of the branch
# name was introduced (after the identity rule, folder name == branch name).
for f in "$CK_TASKFMT" "$NM_ULTRA_PLAN"; do
    n="$(basename "$f")"
    if grep -qF '# Plan:' "$f"; then NM_WHY+=" NM-2:$n-h1-form-changed"; fi
    if grep -qE '^Branch:' "$f"; then NM_WHY+=" NM-2:$n-branch-field-introduced"; fi
done

# (NM-3) All SEVEN places know three name formats.
# Six resolvers plus the non-interactive producer, which checks a collision with the same
# triple. The fragment is chosen so it cannot occur by accident and so its disappearance means
# exactly one thing: the third format was forgotten.
NM_THREE_FORMAT=("$UNIKIT_IMPLEMENT_SKILL" "$UNIKIT_IMPROVE_SKILL" "$UNIKIT_VERIFY_SKILL" "$NM_MODE_LIST" "$NM_MODE_ADD" "$NM_IMPL_COORD" "$NM_PLAN_POLISHER")
for f in "${NM_THREE_FORMAT[@]}"; do
    n="$(basename "$(dirname "$f")")/$(basename "$f")"
    if [[ ! -s "$f" ]]; then NM_WHY+=" NM-3:$n-missing"; continue; fi
    grep -qF 'beginning with three digits' "$f" || NM_WHY+=" NM-3:$n-two-formats-only"
done

# (NM-4) Lexicographic sorting is gone, and its replacement is named.
# Ordering used to live in the folder name; it now lives in the manifest. The negative alone
# would be satisfied by a resolver that sorts by nothing at all, so the positive names the key.
NM_RESOLVERS=("$UNIKIT_IMPLEMENT_SKILL" "$UNIKIT_IMPROVE_SKILL" "$UNIKIT_VERIFY_SKILL" "$NM_MODE_LIST" "$NM_MODE_ADD" "$NM_IMPL_COORD")
for f in "${NM_RESOLVERS[@]}"; do
    n="$(basename "$(dirname "$f")")/$(basename "$f")"
    if grep -qF 'lexicographically descending' "$f"; then NM_WHY+=" NM-4:$n-still-sorts-by-name"; fi
done
# The mtime fallback existed in exactly ONE file, and removing the date turns it from a second
# branch into the only one - which is why its absence is asserted there and nowhere else.
if grep -qF 'modification time' "$NM_IMPL_COORD"; then NM_WHY+=" NM-4:coordinator-mtime-fallback-survives"; fi
# The positive covers the five CHOOSING resolvers. `mode-list.md` is deliberately excluded: it
# labels and never selects, so it has no "latest" to compute. Recorded here because the next
# reader will otherwise add a sixth file and get a false red.
for f in "$UNIKIT_IMPLEMENT_SKILL" "$UNIKIT_IMPROVE_SKILL" "$UNIKIT_VERIFY_SKILL" "$NM_MODE_ADD" "$NM_IMPL_COORD"; do
    n="$(basename "$(dirname "$f")")/$(basename "$f")"
    grep -qF 'manifest has no Updated:' "$f" || NM_WHY+=" NM-4:$n-no-updated-exclusion"
done

# (NM-5) The grant follows the rule, into all THREE writers.
# Direct transfer of RD-B, motivation included: a rule the skill cannot carry out degrades
# SILENTLY, because the degraded branch is itself a legitimate state. The third file is the
# one this whole change started from, and the only one whose date feeds the sort key of an
# entire registry plus the age filter of both registry readers - bounding the guard at two
# would pin the invariant everywhere except where it is worth most.
# `unikit-plan-polisher` is NOT in this list: its grant is an unnarrowed `Bash`, and demanding
# an exact string of it would check a form that file does not have. Recorded so the next
# reader does not add a fourth path and get a false red.
for f in "$UNIKIT_PLAN_SKILL" "$UNIKIT_IMPROVE_SKILL" "$NM_EXPLORE_SKILL"; do
    n="$(basename "$(dirname "$f")")"
    grep -qF 'Bash(date *)' "$f" || NM_WHY+=" NM-5:$n-no-date-grant"
done

# (NM-6) The non-interactive producer does not choose silently either.
# Same policy as the interactive branch, different verb: it hands control back instead of
# asking. The suffix ban is pinned to the literal both producers share.
if [[ ! -s "$NM_PLAN_POLISHER" ]]; then NM_WHY+=" NM-6:polisher-missing"; fi
grep -qF 'automatic suffix' "$NM_PLAN_POLISHER" || NM_WHY+=" NM-6:no-suffix-ban"
grep -qF 'automatic suffix' "$UNIKIT_PLAN_SKILL" || NM_WHY+=" NM-6:interactive-branch-no-suffix-ban"
grep -qF 'plan_path: none'  "$NM_PLAN_POLISHER" || NM_WHY+=" NM-6:no-hand-back-branch"
grep -qF 'Created:'         "$NM_PLAN_POLISHER" || NM_WHY+=" NM-6:no-created-instruction"
grep -qF 'Updated:'         "$NM_PLAN_POLISHER" || NM_WHY+=" NM-6:no-updated-instruction"
# The negative half: an instruction to ask is an instruction this executor cannot follow -
# the tool is absent from its `tools:`. Same failure class NM-5 catches from the other side.
if grep -qF 'AskUserQuestion' "$NM_PLAN_POLISHER"; then NM_WHY+=" NM-6:polisher-told-to-ask"; fi

if [[ -z "$NM_WHY" ]]; then
    pass "NM-1..NM-6 dateless folder names; both manifests carry Created/Updated; seven places know three formats; latest sorts on Updated; the date grant reaches all three writers"
else
    fail "NM dateless-naming contract broken:$NM_WHY"
fi

# =============================================
# GN: the ADR-0003 boundary - a date in a NAME is allowed exactly when the artifact is an
# entry in an event log. Half of this family is ordinary (the date is gone from the two
# addressable gamedesign artifacts); the other half is unusual and is the reason the family
# exists: it asserts POSITIVELY that three event logs still carry theirs. A later "let's
# finish the unification" would otherwise break a cursor and make repeated reviews overwrite
# each other, and both failures surface far from their cause.
# Placed after the NM family; reuses the GD_* path vars declared with the gamedesign block
# far above, and `set -u` forbids the other direction.
# =============================================
GN_SAVE_RESEARCH="$ROOT_DIR/skills/unikit-gd-explore/references/save-research.md"
GN_RECON_INPUT="$ROOT_DIR/skills/unikit-gd-explore/references/mode-recon-input.md"
GN_INIT_INDEX="$ROOT_DIR/skills/unikit-gd-explore/references/init-index.md"
GN_RECON_SKILL="$ROOT_DIR/skills/unikit-gd-recon/SKILL.md"
GN_MODE_IMPORT="$ROOT_DIR/skills/unikit-gd-spec/references/mode-import.md"
GN_FIX_SKILL="$ROOT_DIR/skills/unikit-fix/SKILL.md"
GN_EVOLVE_SKILL="$ROOT_DIR/skills/unikit-evolve/SKILL.md"
GN_WHY=""

# (GN-1) The date is gone from the two ADDRESSABLE gamedesign artifacts.
# Scope is these eight files by name, deliberately NOT `skills/**`: `unikit-gd-review` and
# `unikit-fix` are REQUIRED to carry `<date>_`, so a directory-wide negative would contradict
# GN-2 below.
GN_ADDRESSABLE=("$GD_EXPLORE_SKILL" "$GN_SAVE_RESEARCH" "$GN_RECON_INPUT" "$GN_RECON_SKILL" "$GN_MODE_IMPORT" "$GD_SYSTEM_SKILL" "$GD_BRAINSTORM_SKILL" "$GD_GAME_TPL")
for f in "${GN_ADDRESSABLE[@]}"; do
    n="$(basename "$f")"
    if [[ ! -s "$f" ]]; then GN_WHY+=" GN-1:$n-missing"; continue; fi
    for tok in '<date>_' '{YYYY-MM-DD}_'; do
        if grep -qF "$tok" "$f"; then GN_WHY+=" GN-1:$n-dated[$tok]"; fi
    done
done
# The positive, without which an emptied file passes: the dateless forms are actually named.
grep -qF 'researches/<slug>/'  "$GN_SAVE_RESEARCH"    || GN_WHY+=" GN-1:save-research-no-dateless-form"
grep -qF 'concepts/<slug>/'    "$GD_BRAINSTORM_SKILL" || GN_WHY+=" GN-1:brainstorm-no-dateless-form"

# (GN-2) The three EVENT LOGS kept their date. A positive guard on the presence of a date is
# rare in this suite, and each of the three lines has a mechanism behind it, not a habit:
#   - `/unikit-evolve` stores `last_processed_patch` in `patch-cursor.json` and compares
#     patch names as STRINGS, so lexicographic order of names IS the cursor;
#   - `/unikit-fix` reads the last 10 patches by filename descending, which is the same
#     ordering read a second way;
#   - a review report without a date collides by construction - one scope is reviewed many
#     times, and finding ids `RF-<YYYY-MM-DD>-<n>` already carry the date and are cited from
#     changelog entries.
grep -qF 'reviews/<date>_review-<scope>.md' "$GD_REVIEW_SKILL" || GN_WHY+=" GN-2:review-report-lost-its-date"
grep -qF 'YYYY-MM-DD-HH.mm.md'   "$GN_FIX_SKILL"    || GN_WHY+=" GN-2:patch-name-format-gone-from-fix"
grep -qF 'by filename descending' "$GN_FIX_SKILL"   || GN_WHY+=" GN-2:patch-ordering-rule-gone"
grep -qF 'patch-cursor.json'      "$GN_EVOLVE_SKILL" || GN_WHY+=" GN-2:cursor-file-gone"
grep -qF 'last_processed_patch'   "$GN_EVOLVE_SKILL" || GN_WHY+=" GN-2:cursor-key-gone"
grep -qF 'YYYY-MM-DD-HH.mm.md'    "$GN_EVOLVE_SKILL" || GN_WHY+=" GN-2:patch-name-format-gone-from-evolve"

# (GN-3) The import reader knows BOTH globs, because no folder was renamed.
# A producer edited without its reader is how `researches/<date>_import-*/` would quietly stop
# finding anything; listing only the NEW glob would break the opposite half just as quietly.
grep -qF 'researches/import-*/SOURCE.md'  "$GD_SYSTEM_SKILL" || GN_WHY+=" GN-3:no-current-import-glob"
grep -qF 'researches/*import-*/SOURCE.md' "$GD_SYSTEM_SKILL" || GN_WHY+=" GN-3:no-legacy-import-glob"
# And the reason the other three readers needed no edit at all: discovery runs on the `Target:`
# tag, which does not depend on a folder name. Asserted so that a future rewrite onto names
# has to delete this line first.
grep -qF 'Target:' "$GD_SYSTEM_SKILL" || GN_WHY+=" GN-3:target-tag-mechanism-unnamed"

# (GN-4) The collision policy is stated on both gamedesign producers.
# Same one -qF literal over two files that NM-6 uses over the code side, and for the same
# reason: without the date a repeated run yields the SAME name, so a silent suffix is the
# default failure rather than an exotic one.
for f in "$GN_SAVE_RESEARCH" "$GD_BRAINSTORM_SKILL"; do
    n="$(basename "$f")"
    grep -qF 'automatic suffix' "$f" || GN_WHY+=" GN-4:$n-no-suffix-ban"
done

if [[ -z "$GN_WHY" ]]; then
    pass "GN-1..GN-4 gamedesign researches and concepts are dateless; the three event logs keep their date; the import reader knows both globs"
else
    fail "GN dated-name boundary broken:$GN_WHY"
fi

# ─────────────────────────────────────────────
# UR: ultra research — the second ultra marker, and the identifier contract.
# ─────────────────────────────────────────────

# (UR-1) The reference exists, the marker is declared exactly where it belongs, and the
# two ultra markers are DISTINCT strings. A copy-paste that gives a research folder the
# plan marker would make /unikit-implement treat a research as a bundle — and the failure
# would surface as a missing phase file, far from its cause. The two cross negatives are
# the content of this guard; the positives only give them an object.
# UR_REF is declared above the RD family — RD-E reads it and `set -u` forbids the
# forward reference.
UR_EXPLORE="$ROOT_DIR/skills/unikit-explore/SKILL.md"
UR_PLAN_SPEC="$ROOT_DIR/skills/unikit-plan/references/ULTRA-PLAN-FORMAT.md"
UR_WHY=""
[[ -s "$UR_REF" ]] || UR_WHY+=" no-reference"
grep -qF 'unikit:research-mode:ultra' "$UR_REF"     || UR_WHY+=" no-marker-in-reference"
grep -qF 'ULTRA-RESEARCH-FORMAT.md'   "$UR_EXPLORE" || UR_WHY+=" no-dispatch"
if grep -qF 'unikit:plan-mode:ultra' "$UR_REF"; then UR_WHY+=" plan-marker-in-research-reference"; fi
if grep -qF 'unikit:research-mode:ultra' "$UR_PLAN_SPEC"; then UR_WHY+=" research-marker-in-plan-spec"; fi

# (UR-2) The re-render must not treat an extra file as a defect.
#
# What was REMOVED and why: this used to assert the sentence "Adaptive artifacts in a folder
# are neither read nor listed", which belonged to the `init` command — and `init` is gone,
# dissolved into the re-render that now runs on every save (DEC-6). Deleting the assert
# without replacing it would have read as lost coverage, so the same PROPERTY is asserted
# through the surviving mechanism: a folder is skipped for a missing manifest and for nothing
# else. That is what keeps a folder full of adaptive artifacts from silently dropping out of
# the registry, which is the failure the retired assert existed to prevent.
grep -qF 'no readable RESEARCH.md' "$UR_EXPLORE" || UR_WHY+=" rerender-skips-on-anything-but-a-missing-manifest"

if [[ -z "$UR_WHY" ]]; then
    pass "UR-1/UR-2 ultra research reference + dispatch; the plan and research markers stay distinct; the re-render skips only a missing manifest"
else
    fail "UR-1/UR-2 ultra research contract:$UR_WHY"
fi

# (UR-3) The identifier contract: a CLOSED vocabulary with a named owner.
# Practice diverges in both directions when the vocabulary is left open — the prefixes a
# spec names go unused while the ones actually used go unnamed. Six prefixes, and a seventh
# is a decision rather than a convenience. The guard checks that the vocabulary is PRESENT
# and has not shrunk; forbidding an unknown prefix by grep would need an allowlist the size
# of the corpus, so closure is held by the spec text and by Integrity checks 4-5.
# The owner assert is load-bearing, and it names the MACHINE INPUT: `## Active Summary` of
# `RESEARCH.md` is the one region /unikit-plan takes as input and hashes, so a
# requirement-bearing ID living anywhere else is invisible to the planner and its change
# produces no drift. The anchor sits on the FORMULATION, not on a heading — a heading is
# rewritten during cosmetics, a formulation only together with its meaning (the RT-6 /
# DEGRADATION_TOKEN convention). It must stay on ONE line: `grep -F` is line-based, and
# wrapping the sentence across two lines silently disarms this assert.
#
# `Active Summary` INVERTED from a negative to a positive. It was asserted ABSENT here on the
# grounds that the container "was never ported"; the manifest format makes it the machine
# input, so absence is now the defect. `Traceability` stays NEGATIVE for its original reason:
# it lives in the source format's bundle INDEX.md, a file UniKit deliberately does not have,
# and its work is done by Integrity checks 5 and 6. The two asserts arrived together and
# looked alike, which is exactly why the inversion of one is written down rather than left
# for the next reader to infer from a diff.
# The vocabulary greps are scoped TWICE, and both narrowings are load-bearing: to the body
# of `## Identifiers`, and to the table-row form `| `<prefix>`. Searching the whole file for
# a bare backticked prefix is what the first version did, and it could not fail: `ADR-`
# occurs in the adaptive-artifacts table and twice more in prose, `DEC-` in Integrity check 4,
# so deleting either row from the vocabulary table left the guard green. A guard that cannot
# go red is worse than no guard — it reports confidence it never earned.
UR3_WHY=""
UR3_SECTION=""
if ! grep -qF '## Identifiers' "$UR_REF"; then
    UR3_WHY+=" no-section"
else
    UR3_SECTION="$(awk '/^## Identifiers$/{f=1;next} /^## /{f=0} f' "$UR_REF")"
    # Degenerate to fail when the section is empty (NN-4 / RT-7 convention): an object-less
    # guard must go red rather than pass on nothing.
    if [[ -z "$UR3_SECTION" ]]; then
        UR3_WHY+=" empty-section"
    else
        for pfx in 'C-' 'REQ-' 'DEC-' 'RISK-' 'OQ-' 'ADR-'; do
            printf '%s' "$UR3_SECTION" | grep -qF "| \`$pfx" || UR3_WHY+=" vocab-missing:$pfx"
        done
    fi
fi
grep -qF "must exist in \`## Active Summary\` of \`RESEARCH.md\`" "$UR_REF" || UR3_WHY+=" no-owner-rule"
grep -qF 'never reused'                 "$UR_REF" || UR3_WHY+=" no-stability-rule"
grep -qF 'Active Summary'               "$UR_REF" || UR3_WHY+=" active-summary-missing"
if grep -qF 'Traceability'   "$UR_REF"; then UR3_WHY+=" traceability-returned";   fi
if [[ -z "$UR3_WHY" ]]; then
    pass "UR-3 the identifier vocabulary is closed (six prefixes), homed in the manifest's Active Summary, and stable"
else
    fail "UR-3 identifier contract:$UR3_WHY"
fi

# ─────────────────────────────────────────────
# RM: the research MANIFEST — one file, two state axes, a retired brief and a dateless name.
# The format moved from three prose files to one manifest whose `## Active Summary` is the
# machine input. Four of these five guards exist because the corresponding failure is SILENT:
# it surfaces to a user as "no researches found", never as an error.
RM_SPEC="$ROOT_DIR/skills/unikit-explore/references/ULTRA-RESEARCH-FORMAT.md"
RM_SKILL="$ROOT_DIR/skills/unikit-explore/SKILL.md"
RM_CONTRACTS="$ROOT_DIR/skills/unikit-explore/references/contracts-artifact.md"
RM_RETIRED_TPL="$ROOT_DIR/skills/unikit-explore/references/explore-brief-template.md"
RM_RETIRED_PROMPT="$ROOT_DIR/skills/unikit-explore/references/explore-brief-prompt.md"
RM_WHY=""

if [[ ! -s "$RM_SPEC" ]]; then
    RM_WHY+=" RM-0:spec-missing"
elif [[ ! -s "$RM_SKILL" ]]; then
    RM_WHY+=" RM-0:skill-missing"
else
    # (RM-1) Both marker pairs are DECLARED in the spec and USED by the producer. The region
    # between the active-summary markers is the hashed object of the whole drift mechanism —
    # without the markers there is nothing to hash, and the plan-side drift field of Phase 04
    # has no object to be computed from. Asserted in both files because a marker declared and
    # never emitted is exactly as useless as one emitted and never specified.
    for RM_MARK in 'unikit:active-summary:start' 'unikit:active-summary:end' \
                   'unikit:sessions:start' 'unikit:sessions:end'; do
        grep -qF "$RM_MARK" "$RM_SPEC"  || RM_WHY+=" RM-1:marker-undeclared:$RM_MARK"
        grep -qF "$RM_MARK" "$RM_SKILL" || RM_WHY+=" RM-1:marker-unused:$RM_MARK"
    done

    # (RM-2) The two state axes stay two. `Status` is completeness, `Lifecycle` is currency,
    # and the name `Status` stays with the EXISTING axis whose three values /unikit-plan
    # greps for by name. This guard is the direct detector of the first draft of REQ-5, which
    # gave the name `Status` to the new axis: that rename kills the registry filter without a
    # single error message — the skill answers "no researches", which is indistinguishable
    # from an honestly empty registry. Hence a negative on each axis carrying the other's
    # value, not merely a positive on both being present.
    grep -qE '^Status: completed \| in-progress \| needs-follow-up' "$RM_SPEC" \
        || RM_WHY+=" RM-2:status-axis-missing-or-reworded"
    grep -qE '^Lifecycle: active \| paused \| superseded' "$RM_SPEC" \
        || RM_WHY+=" RM-2:lifecycle-axis-missing-or-reworded"
    if grep -qE 'Lifecycle:.*completed' "$RM_SPEC"; then RM_WHY+=" RM-2:lifecycle-carries-completed"; fi
    if grep -qE 'Status:.*active'       "$RM_SPEC"; then RM_WHY+=" RM-2:status-carries-active"; fi

    # (RM-3) The brief retired WHOLE. A half-retirement — the artifact added while the old
    # template survives — is the shape that leaves two formats documented at once.
    [[ -s "$RM_CONTRACTS" ]]     || RM_WHY+=" RM-3:contracts-artifact-missing-or-empty"
    [[ ! -e "$RM_RETIRED_TPL" ]]    || RM_WHY+=" RM-3:retired-template-still-present"
    [[ ! -e "$RM_RETIRED_PROMPT" ]] || RM_WHY+=" RM-3:retired-prompt-still-present"
    # This file is excluded from its own scan, and the exclusion is not a convenience: the
    # guard has to NAME the two retired files in order to assert they are gone, so it is the
    # one legitimate carrier of the token. Without the exclusion RM-3 reports itself and can
    # never go green — a guard that always fails is discarded, not fixed. The cost is that a
    # reference reintroduced INSIDE this script goes unseen; that is the correct trade,
    # because the token is only dangling when it names a file a skill tries to READ.
    RM3_REFS="$(cd "$ROOT_DIR" && grep -rlF 'explore-brief' skills scripts docs src \
        --exclude=test-skills.sh 2>/dev/null || true)"
    [[ -z "$RM3_REFS" ]] || RM_WHY+=" RM-3:dangling-refs($(printf '%s' "$RM3_REFS" | tr '\n' ','))"

    # (RM-4) `init` dissolved rather than disappeared. The negative half alone would be
    # satisfied by deleting the feature, so the positive half asserts the reconciliation
    # SURVIVED: the three counters `init` used to print are printed by the re-render. Scope is
    # deliberately only `unikit-explore` — `unikit-gd-explore` keeps its own `init` (DEC-7).
    if grep -q '^## Init' "$RM_SKILL"; then RM_WHY+=" RM-4:init-section-returned"; fi
    if grep -n 'argument-hint' "$RM_SKILL" | grep -q 'init'; then RM_WHY+=" RM-4:init-in-argument-hint"; fi
    for RM_COUNT in 'Kept:' 'Added:' 'Removed:'; do
        grep -qF "$RM_COUNT" "$RM_SKILL" || RM_WHY+=" RM-4:reconciliation-counter-lost:$RM_COUNT"
    done
    # The skill body is not the only place the argument was promised. `unikit-help` is read by
    # an agent choosing a route, so a retired argument surviving THERE is worse than in prose a
    # human skims — it gets invoked. The literal carries the skill name so the game-design
    # `init`, which stays, cannot match it.
    RM4_INIT_REFS="$(cd "$ROOT_DIR" && grep -rlF 'unikit-explore init' skills docs 2>/dev/null || true)"
    [[ -z "$RM4_INIT_REFS" ]] || RM_WHY+=" RM-4:init-still-offered($(printf '%s' "$RM4_INIT_REFS" | tr '
' ','))"

    # (RM-5) The research folder name is built WITHOUT a date, in both files that decide it.
    #
    # Two files, and the second is here for a measured reason. The producer (`SKILL.md`)
    # ASSEMBLES the name; the spec (`ULTRA-RESEARCH-FORMAT.md`) PRESCRIBES it — and the
    # prescription lived in the spec's preamble, which sits outside every section the rewrite
    # touched by name. A guard scoped to the producer alone would have left the last surviving
    # instruction to use a dated name inside the file that calls itself the source of the
    # format. Same class as `mode-ultra.md:94` on the plan side: a claim that outlives the
    # task editing around it.
    #
    # The positive sits beside the negatives so the guard cannot pass on an emptied file —
    # zero occurrences of a forbidden token is also what a truncated file looks like.
    for RM_FILE in "$RM_SPEC" "$RM_SKILL"; do
        RM_NAME="$(basename "$RM_FILE")"
        if grep -qF '<date>_' "$RM_FILE";       then RM_WHY+=" RM-5:dated-name-token($RM_NAME)"; fi
        if grep -qF '{YYYY-MM-DD}_' "$RM_FILE"; then RM_WHY+=" RM-5:dated-name-convention($RM_NAME)"; fi
        grep -qF 'researches/<slug>' "$RM_FILE" || RM_WHY+=" RM-5:no-dateless-form($RM_NAME)"
    done
fi

if [[ -z "$RM_WHY" ]]; then
    pass "RM-1..RM-5 research manifest: markers declared and emitted, Status/Lifecycle stay two axes, the brief retired whole, init dissolved into the re-render, folder names dateless in both deciding files"
else
    fail "RM research manifest:$RM_WHY"
fi


# ─────────────────────────────────────────────
# MF: MCP findings are recorded AT THE TASK, not at the end of the run.
# The table used to be filled once, in the run's closing report — which is precisely the
# moment a session is most likely to have already ended. These guards pin the two halves
# of the fix: the column that makes a transferred row honest (`observed`), and the anchor
# that says WHEN the row is written, in each of the four writers.
# Reuses CK_TASKFMT + EM_* path vars are declared later (EM block), so the three skill
# paths are taken locally here.
MF_IMPLEMENT="$ROOT_DIR/skills/unikit-implement/SKILL.md"
MF_FIX="$ROOT_DIR/skills/unikit-fix/SKILL.md"
MF_VERIFY="$ROOT_DIR/skills/unikit-verify/SKILL.md"
MF_WORKER="$ROOT_DIR/subagents/unikit-implement-worker.md"

# (MF-1) `observed` reaches BOTH surfaces of the format: the template a planner copies and
# the column contract a writer reads. A column present in one and not the other is how a
# six-column table starts receiving five-column rows.
MF1_WHY=""
grep -qF '| id | area | confirm that | observed | evidence | from |' "$CK_TASKFMT" || MF1_WHY+=" template"
grep -qF '| `observed` |' "$CK_TASKFMT"                                            || MF1_WHY+=" contract-row"
if [[ -z "$MF1_WHY" ]]; then
    pass "MF-1 observed column in both the MCP Findings template and its column contract"
else
    fail "MF-1 observed column missing in TASK-FORMAT.md:$MF1_WHY"
fi

# (MF-2) The write anchor exists in Step 3.4 of unikit-implement — the step that ticks the
# checkbox. Anchored on the heading plus the table name rather than on prose, because this
# is a structural claim: the section that marks a task also records the finding.
if awk '/^\*\*3\.4: Mark task as completed\*\*/{f=1} f&&/^\*\*3\.5/{exit} f' "$MF_IMPLEMENT" \
     | grep -qF '## MCP Findings'; then
    pass "MF-2 unikit-implement Step 3.4 records the finding with the checkbox"
else
    fail "MF-2 unikit-implement Step 3.4 has no ## MCP Findings anchor — the write drifted back to the end of the run"
fi

# (MF-3) The worker writes the row itself (variant B). BOTH halves are asserted, and the
# negative one is load-bearing: the cancelled behaviour was "hand it back to the
# coordinator", and a half-applied edit leaves both instructions standing at once.
MF3_WHY=""
grep -qF '## MCP Findings' "$MF_WORKER"                             || MF3_WHY+=" append-missing"
grep -qF 'return it to the coordinator as a candidate line' "$MF_WORKER" && MF3_WHY+=" handback-survived"
if [[ -z "$MF3_WHY" ]]; then
    pass "MF-3 implement-worker appends the row itself; the coordinator hand-back is gone"
else
    fail "MF-3 implement-worker findings contract drift:$MF3_WHY"
fi

# (MF-4) The append scheme borrows an invariant it does not own — one editor phase per
# execution layer, hence one writer at a time. Written down where the invariant lives, so
# relaxing the invariant cannot silently break the writers.
if grep -qF '`## MCP Findings` is written under this invariant' "$CK_TASKFMT"; then
    pass "MF-4 TASK-FORMAT.md ties the findings append to the serialization invariant"
else
    fail "MF-4 TASK-FORMAT.md does not say the findings append depends on one-editor-phase-per-layer"
fi

# (MF-5) Parity across all THREE plan-side writers. unikit-fix and unikit-verify carry the
# same defect the research found in unikit-implement — they said WHERE and not WHEN — and
# they write into the same table, so a missed one produces rows without `observed`. This
# is the only guard that holds the three together once the edits are separated in time.
MF5_WHY=""
grep -qF 'observed' "$MF_IMPLEMENT" || MF5_WHY+=" implement"
grep -qF 'observed' "$MF_FIX"       || MF5_WHY+=" fix"
grep -qF 'observed' "$MF_VERIFY"    || MF5_WHY+=" verify"
if [[ -z "$MF5_WHY" ]]; then
    pass "MF-5 observed known to all three plan-side findings writers"
else
    fail "MF-5 observed column unknown to:$MF5_WHY"
fi

# (MF-6) The capability behind the rule. `observed` is a date the writer produces at the
# moment of observation, and a skill with no date grant can only recall one — the class of
# unverified claim dev-principles A1/A2 exists to forbid, landing in a durable file. Every
# other skill that writes a dated artifact carries this grant; these three were the gap.
MF6_WHY=""
grep -qF 'Bash(date *)' "$MF_IMPLEMENT" || MF6_WHY+=" implement"
grep -qF 'Bash(date *)' "$MF_FIX"       || MF6_WHY+=" fix"
grep -qF 'Bash(date *)' "$MF_VERIFY"    || MF6_WHY+=" verify"
if [[ -z "$MF6_WHY" ]]; then
    pass "MF-6 Bash(date *) granted to all three plan-side findings writers"
else
    fail "MF-6 observed is required but the date grant is missing in:$MF6_WHY"
fi

# ─────────────────────────────────────────────
# MH: the handoff from a filled table to the durable notes file.
# Recording findings per task (MF above) only pays off if somebody offers to move them; a
# table nobody reads is the same loss one step later. These guards pin the offer, the
# input form that makes it work, and the two reference surfaces that describe it.
MH_TRAP="$ROOT_DIR/skills/unikit-mcp-trap/SKILL.md"
MH_COORD="$ROOT_DIR/subagents/unikit-implement-coordinator.md"
MH_SKILL_MAP="$ROOT_DIR/skills/unikit-help/references/skill-map.md"
MH_DOCS_SKILLS="$ROOT_DIR/docs/skills.md"

# (MH-1) The handoff step exists in unikit-implement.
if grep -qF 'MCP Findings handoff' "$MF_IMPLEMENT"; then
    pass "MH-1 unikit-implement carries the MCP Findings handoff step"
else
    fail "MH-1 unikit-implement has no MCP Findings handoff step"
fi

# (MH-2) The renumbering was carried through. Inserting a step in the middle of Step 5 means
# renaming three of them, and this range line is the ONE mechanical trace of whether that
# was finished — every other reference is prose that reads fine while being wrong.
if grep -qF 'Steps 5.4–5.8 are sequential' "$MF_IMPLEMENT"; then
    pass "MH-2 Step 5 renumbering complete (5.4-5.8 sequential)"
else
    fail "MH-2 Step 5 range line not updated — the renumbering is half-applied"
fi

# (MH-3) The trap grew an input contract. Before this it had none at all: the body opened
# straight into the session scan, so the argument shape lived only in the frontmatter hint.
if grep -qF '## Input' "$MH_TRAP"; then
    pass "MH-3 unikit-mcp-trap has an ## Input section"
else
    fail "MH-3 unikit-mcp-trap ## Input missing — the three call forms are undocumented in the body"
fi

# (MH-4) The load-bearing half of the explicit-path form: the Step 1 shortcut is OFF. The
# handoff is called FROM the run that produced the findings, i.e. the same session, so with
# the shortcut live the path is ignored in exactly the scenario the form was added for.
if grep -qF 'the Step 1 shortcut is off' "$MH_TRAP"; then
    pass "MH-4 explicit path disables the session shortcut"
else
    fail "MH-4 unikit-mcp-trap does not disable the Step 1 shortcut on an explicit path"
fi

# (MH-5) The stale step reference is gone. Documentation is Step 5.3 and always was; the
# file said 5.4 in two places, and inserting a step made the drift worse. Both literals are
# checked because they are worded differently and one guard would leave the other standing.
MH5_WHY=""
grep -qF 'documentation checkpoint (Step 5.4)' "$MF_IMPLEMENT" && MH5_WHY+=" checkpoint-ref"
grep -qF 'Step 5.4 (documentation)'            "$MF_IMPLEMENT" && MH5_WHY+=" settings-ref"
if [[ -z "$MH5_WHY" ]]; then
    pass "MH-5 no stale Step 5.4-as-documentation references survive"
else
    fail "MH-5 stale documentation step reference:$MH5_WHY"
fi

# (MH-6) Parity of the two reference surfaces. They describe the same skill to two different
# readers (the in-agent navigator and the published docs) and drift apart silently, because
# nothing makes a reader of one open the other.
MH6_WHY=""
grep -qF 'a path to a plan file' "$MH_SKILL_MAP"   || MH6_WHY+=" skill-map"
grep -qF 'A path to a plan file' "$MH_DOCS_SKILLS" || MH6_WHY+=" docs-skills"
if [[ -z "$MH6_WHY" ]]; then
    pass "MH-6 the plan-path input form documented on both reference surfaces"
else
    fail "MH-6 plan-path form missing from:$MH6_WHY"
fi

# (MH-7) The coordinator knows the table exists. It had ZERO occurrences before this work,
# and it is a separate entry point (`claude --agent unikit-implement-coordinator`) that
# unikit-implement never runs — so both holes lived here at once: in its single-phase branch
# it executes tasks itself with no writer, and it ends a run with no offer. One counter
# catches the return of either.
if grep -qF '## MCP Findings' "$MH_COORD"; then
    pass "MH-7 implement-coordinator knows the ## MCP Findings table"
else
    fail "MH-7 implement-coordinator has no ## MCP Findings mention — writer and handoff holes are back"
fi

# (MH-8) …and can act on the offer it prints. A recommendation naming a skill the agent may
# not invoke is a dead end for the user, who has nothing to replace it with.
if awk '/^skills:/{f=1;next} f&&/^[a-zA-Z]/{f=0} f' "$MH_COORD" | grep -qF 'unikit-mcp-trap'; then
    pass "MH-8 implement-coordinator lists unikit-mcp-trap in skills:"
else
    fail "MH-8 implement-coordinator recommends /unikit-mcp-trap without listing it in skills:"
fi

# ─────────────────────────────────────────────
# SI: review is INVOKED as a skill from unikit-implement, not delegated to a subagent.
# The step used to say only "run /unikit-review", naming no mechanism, while its two
# neighbours said "Delegate to <agent>" under a delegation pre-requisite block — so the
# model generalised from the neighbours. These guards hold the positive statements; a
# blanket "no Delegate to" check over the file is WRONG and must not be added, because
# Steps 5.2 and 5.3 delegate legitimately.
SI_REVIEW="$ROOT_DIR/skills/unikit-review/SKILL.md"

# (SI-1) The Tier 1 call is spelled out as a call.
if grep -qF 'Skill(skill: "unikit-review")' "$MF_IMPLEMENT"; then
    pass "SI-1 unikit-implement invokes unikit-review through Skill()"
else
    fail "SI-1 unikit-implement has no Skill(skill: \"unikit-review\") invocation"
fi

# (SI-2) The line that stops the generalisation. Without it the neighbours win again the
# next time this step is rewritten.
if grep -qF 'Review is NOT delegated here' "$MF_IMPLEMENT"; then
    pass "SI-2 unikit-implement states that review is not delegated"
else
    fail "SI-2 unikit-implement does not say review is invoked rather than delegated"
fi

# (SI-3) The frontmatter half of the same contract, and the reason it is a guard rather
# than a one-off edit: `context: fork` made the skill run in a forked context no matter WHO
# called it, so switching the caller from a subagent to Skill() would have changed the
# mechanism and delivered none of the four things SI-2 promises — the findings would still
# land somewhere the user cannot see, and the +check validator would still be an agent
# inside an agent. It was the only occurrence in the repository, undocumented and unguarded.
if grep -qE '^context:' "$SI_REVIEW"; then
    fail "SI-3 unikit-review declares a context: mode — an in-session invocation cannot deliver what Step 5.6 claims"
else
    pass "SI-3 unikit-review runs in the caller's context (no context: fork)"
fi

# ─────────────────────────────────────────────
# MG: the audit gate is one manual confirmation, not a pre-flight measurement.
# The old envelope refused on `dirty`, and a fresh empty untitled scene — the only safe
# place to replay — is dirty by default, so it rejected the correct state structurally and
# passed a configured production scene. The measurement is gone; these guards keep the
# retired mechanism from surviving in any of the four places it was described.
MG_AUDIT="$ROOT_DIR/skills/unikit-mcp-audit/SKILL.md"
MG_SKILL_MAP="$MH_SKILL_MAP"
MG_DOCS_SKILLS="$MH_DOCS_SKILLS"
MG_DOCS_CONFIG="$ROOT_DIR/docs/configuration.md"

# (MG-1) `eight-step` gone from all THREE surfaces that carried it. A removed mechanism
# surviving in a description is worse than a stale comment: the description is what the
# user reads to decide what they are agreeing to.
MG1_WHY=""
grep -qF 'eight-step' "$MG_AUDIT"        && MG1_WHY+=" skill"
grep -qF 'eight-step' "$MG_DOCS_SKILLS"  && MG1_WHY+=" docs-skills"
grep -qF 'eight-step' "$MG_DOCS_CONFIG"  && MG1_WHY+=" docs-configuration"
if [[ -z "$MG1_WHY" ]]; then
    pass "MG-1 the eight-step envelope is gone from skill + both docs surfaces"
else
    fail "MG-1 retired eight-step envelope still described in:$MG1_WHY"
fi

# (MG-2) The REFUSE step itself. Named as a step, it is the inverted gate; its absence is
# the mechanical trace that the envelope was actually rebuilt and not merely renumbered.
if grep -qF 'REFUSE' "$MG_AUDIT"; then
    fail "MG-2 the REFUSE step is back in unikit-mcp-audit — the inverted dirty gate returned"
else
    pass "MG-2 no REFUSE step in unikit-mcp-audit"
fi

# (MG-3) The promise, in the three places that carried it. NOTE the asymmetry with MG-1,
# and it is deliberate: docs/skills.md never contained "refuses on a dirty scene" — it said
# "refuses on any of them" after listing the measurements — so asserting that literal there
# would pass without checking anything. Its own claim is the git working tree, which the
# skill no longer inspects at all and whose grant is gone. MG-1 does not cover that claim:
# a rewrite can drop the words "eight-step" and keep "measures … the git working tree".
#
# That third check is SECTION-SCOPED, and the scoping is the load-bearing part. This file
# documents thirty-odd skills and several of them work on the git working tree for real —
# /unikit-commit stages and commits it, /unikit-review already says "Analyzes staged
# changes (git status + git diff --cached)", /unikit-fix requires a commit before a direct
# edit. A file-wide negative on three such ordinary words goes red the first time somebody
# writes a correct sentence about one of THOSE skills, pointing at unikit-mcp-audit, which
# their change never touched. The cheapest way to green is then to delete this assert — and
# it is the only mechanical protection the claim has. A false red that converts into a
# removed guard is worse than no guard, so the window is what makes the short literal safe.
# Same technique as MF-2 (awk window over Step 3.4) and MH-8 (over the skills: block).
MG3_AUDIT_SECTION="$(awk '/^### .*unikit-mcp-audit/{f=1;next} f&&(/^## /||/^### /){exit} f' \
    "$MG_DOCS_SKILLS" 2>/dev/null || true)"
MG3_WHY=""
grep -qF 'refuses on a dirty scene' "$MG_AUDIT"     && MG3_WHY+=" skill"
grep -qF 'refuses on a dirty scene' "$MG_SKILL_MAP" && MG3_WHY+=" skill-map"
# An empty window is a FAIL, not a pass: renaming the heading would otherwise retire the
# check in silence — the same vacuous-negative failure this guard was rewritten to escape.
if [[ -z "$MG3_AUDIT_SECTION" ]]; then
    MG3_WHY+=" docs-skills-section-not-found"
elif echo "$MG3_AUDIT_SECTION" | grep -qF 'the git working tree'; then
    MG3_WHY+=" docs-skills-git"
fi
if [[ -z "$MG3_WHY" ]]; then
    pass "MG-3 the withdrawn refusal promise is gone from skill, skill-map and the docs audit section"
else
    fail "MG-3 withdrawn promise still advertised in:$MG3_WHY"
fi

# (MG-4) The grant follows the behaviour. git was read only inside the deleted MEASURE
# step; a grant outliving its only caller is how a capability quietly stays available.
if awk '/^allowed-tools:/{f=1;next} f&&/^[a-zA-Z]/{f=0} f' "$MG_AUDIT" | grep -qF 'Bash(git'; then
    fail "MG-4 unikit-mcp-audit still grants Bash(git *) with no step that uses it"
else
    pass "MG-4 Bash(git *) grant removed together with the MEASURE step"
fi

# (MG-5) The courtesy-line contract, anchored on the formulation rather than the heading —
# a heading is rewritten during cosmetics, a formulation only together with its meaning.
# Without this the scene line becomes a gate again the first time someone "improves" it.
if grep -qF 'shown, not checked' "$MG_AUDIT"; then
    pass "MG-5 the open-scene line is contracted as shown-not-checked"
else
    fail "MG-5 unikit-mcp-audit lost the shown-not-checked contract for the scene line"
fi

# (MG-6) The no-silent-demotion rule. The REPLAY step says "could not be reproduced in the
# sandbox → not safe"; applied to a replay that failed because a compile landed mid-run,
# it corrupts a correct row on evidence that never existed.
if grep -qF 'A failed replay is not automatically a demotion' "$MG_AUDIT"; then
    pass "MG-6 a replay failure under instability is offered, not written"
else
    fail "MG-6 unikit-mcp-audit lost the no-silent-demotion rule"
fi

# (MG-7) Step 1 carves out the one read that precedes the confirmation. Both halves, and
# the NEGATIVE one is why this guard exists: the absolute claim "nothing is read from the
# server before this" is the natural way to write the step, it is what was written first,
# and it silently contradicts two other statements in the same section — item 3 requires
# printing the open scene name, which can only come from a read, and MARK is described as
# the first required call. An agent obeying the absolute version drops the courtesy line,
# and the courtesy line is the entire mechanism that solves the original complaint.
MG7_WHY=""
grep -qF 'The one thing read from the server beforehand is the optional courtesy line' "$MG_AUDIT" \
    || MG7_WHY+=" carve-out-missing"
grep -qF 'Nothing is read from the server before this' "$MG_AUDIT" && MG7_WHY+=" absolute-claim-returned"
grep -qF 'first call this skill is required to make' "$MG_AUDIT" || MG7_WHY+=" mark-not-qualified"
if [[ -z "$MG7_WHY" ]]; then
    pass "MG-7 the pre-confirmation read is carved out; MARK is the first REQUIRED call"
else
    fail "MG-7 step 1 / MARK contradiction:$MG7_WHY"
fi

# ─────────────────────────────────────────────
# HG: review/verify → apply/explore handoff (buckets + interview + shared engine).
# (Distinct prefix from the apply-dispatcher GA-1…GA-5 block above — different concern.)
# The review/verify TAIL was reworked into an honest handoff: full report to screen →
# two buckets (apply-ready vs research) → a user-in-the-loop interview → one apply pass.
# The triage engine (the ENTAILED criterion + the interview + decline-vs-direction + the
# loop-guard sentinel) lives in the gd-critique shard, already bound to review/verify/
# explore by gd_check_skill_shards above (UNCHANGED — the engine travels on the existing
# binding). bash cannot run an LLM skill; these are file-scoped grep invariants on the
# contract text. Reuse GD_CRITIQUE / GD_REVIEW_SKILL / GD_VERIFY_SKILL / GD_APPLY_SKILL /
# GD_EXPLORE_SKILL; new path var GD_REVIEW_TPL.
GD_REVIEW_TPL="$GD_DATA/templates/REVIEW.md"

# (HG-1) gd-critique handoff engine — the ENTAILED criterion, the interview model (per-run
# choice + batch, writes nothing to the GDD), the decline-vs-direction asymmetry (review
# declines a finding / verify only re-directs a conflict), and the ONE loop-guard sentinel
# literal (single source of truth — apply writes it, verify reads it).
HG1_WHY=""
grep -qF 'Handoff Engine'        "$GD_CRITIQUE" || HG1_WHY+=" no-handoff-engine"
grep -qF 'ENTAILED criterion'    "$GD_CRITIQUE" || HG1_WHY+=" no-entailed-criterion"
grep -qF 'apply-ready'           "$GD_CRITIQUE" || HG1_WHY+=" no-apply-ready-bucket"
grep -qF 'decline-vs-direction'  "$GD_CRITIQUE" || HG1_WHY+=" no-decline-vs-direction"
grep -qF '[Run the interview]'   "$GD_CRITIQUE" || HG1_WHY+=" no-per-run-interview"
grep -qF '[Decline]'             "$GD_CRITIQUE" || HG1_WHY+=" no-review-decline-option"
grep -qF '[Fix as A]'            "$GD_CRITIQUE" || HG1_WHY+=" no-verify-direction-option"
grep -qF 'apply-phase3'          "$GD_CRITIQUE" || HG1_WHY+=" no-loop-guard-sentinel"
if [[ -z "$HG1_WHY" ]]; then
    pass "HG-1 gd-critique handoff engine (ENTAILED + interview + decline-vs-direction + apply-phase3 sentinel)"
else
    fail "HG-1 gd-critique handoff engine drift:$HG1_WHY"
fi

# (HG-2) unikit-gd-review tail — the full report to SCREEN, the two explicit buckets
# (apply-ready with a Fix field + research), the safeguard + the recommend-only
# /unikit-gd-apply handoff phase. The buckets are orthogonal to severity (severity stays a
# column) and REPLACE the old Required/Non-Blocking split.
HG2_WHY=""
grep -qF 'Print the full report to the screen' "$GD_REVIEW_SKILL" || HG2_WHY+=" no-screen-print"
grep -qF '## Apply-ready'        "$GD_REVIEW_SKILL" || HG2_WHY+=" no-apply-ready-bucket"
grep -qF '## Research'           "$GD_REVIEW_SKILL" || HG2_WHY+=" no-research-bucket"
grep -qF 'Fix (entailed)'        "$GD_REVIEW_SKILL" || HG2_WHY+=" no-fix-field"
grep -qF 'Safeguard'             "$GD_REVIEW_SKILL" || HG2_WHY+=" no-safeguard"
grep -qF '## Phase 6'            "$GD_REVIEW_SKILL" || HG2_WHY+=" no-handoff-phase"
grep -qF '/unikit-gd-apply'      "$GD_REVIEW_SKILL" || HG2_WHY+=" no-apply-handoff"
grep -qF 'orthogonal to severity' "$GD_REVIEW_SKILL" || HG2_WHY+=" no-severity-orthogonality"
if [[ -z "$HG2_WHY" ]]; then
    pass "HG-2 unikit-gd-review tail (screen-print + apply-ready/research buckets + Fix field + safeguard + /unikit-gd-apply handoff)"
else
    fail "HG-2 unikit-gd-review tail drift:$HG2_WHY"
fi

# (HG-3) the two consumers — unikit-gd-apply reads a review file's apply-ready bucket
# (detecting reviews/*_review-*.md, carrying each RF-id to the owner's changelog, closing
# with the apply-phase3 sentinel), and unikit-gd-explore develops the research bucket then
# proposes /unikit-gd-apply.
HG3_WHY=""
grep -qF 'reviews/*_review-*.md'       "$GD_APPLY_SKILL"   || HG3_WHY+=" apply:no-review-file-detect"
grep -qF '## Apply-ready'              "$GD_APPLY_SKILL"   || HG3_WHY+=" apply:no-apply-ready-read"
grep -qF 'apply-phase3'                "$GD_APPLY_SKILL"   || HG3_WHY+=" apply:no-sentinel"
grep -qF 'Carry the review-finding id' "$GD_APPLY_SKILL"   || HG3_WHY+=" apply:no-rf-carry"
grep -qF 'Research-bucket mode'        "$GD_EXPLORE_SKILL" || HG3_WHY+=" explore:no-research-bucket-mode"
grep -qF '## Research'                 "$GD_EXPLORE_SKILL" || HG3_WHY+=" explore:no-research-read"
grep -qF '/unikit-gd-apply'            "$GD_EXPLORE_SKILL" || HG3_WHY+=" explore:no-apply-proposal"
if [[ -z "$HG3_WHY" ]]; then
    pass "HG-3 consumers — apply reads review-file apply-ready (RF-carry + apply-phase3) · explore develops research bucket → apply"
else
    fail "HG-3 handoff consumers drift:$HG3_WHY"
fi

# (HG-4) unikit-gd-verify — the four tracks (freshness print-only · entailed→apply-ready ·
# direction interview · authoring→owner/explore), the read-only declaration (verify writes
# nothing — the self-heal track was excised this PR; freshness is print-only), the
# direction-only interview (no decline), the inline-prose handoff (no file), and the
# LOOP-GUARD (the apply-phase3 sentinel suppresses the offer/interview when verify runs as
# apply's Phase 3).
HG4_WHY=""
grep -qF '4 tracks'          "$GD_VERIFY_SKILL" || HG4_WHY+=" no-4-tracks"
grep -qF 'print-only'        "$GD_VERIFY_SKILL" || HG4_WHY+=" no-freshness-print-only-track"
grep -qF 'writes nothing'    "$GD_VERIFY_SKILL" || HG4_WHY+=" no-read-only-declaration"
grep -qF 'Direction fork'    "$GD_VERIFY_SKILL" || HG4_WHY+=" no-direction-fork-track"
grep -qF 'Which direction?'  "$GD_VERIFY_SKILL" || HG4_WHY+=" no-direction-interview"
grep -qF 'no "Decline"'      "$GD_VERIFY_SKILL" || HG4_WHY+=" no-decline-ban"
grep -qF 'inline prose'      "$GD_VERIFY_SKILL" || HG4_WHY+=" no-inline-prose-handoff"
grep -qF 'apply-phase3'      "$GD_VERIFY_SKILL" || HG4_WHY+=" no-sentinel"
grep -qF 'LOOP-GUARD'        "$GD_VERIFY_SKILL" || HG4_WHY+=" no-loop-guard"
if [[ -z "$HG4_WHY" ]]; then
    pass "HG-4 unikit-gd-verify (4 tracks + freshness print-only/read-only + direction-only interview + inline-prose handoff + apply-phase3 LOOP-GUARD)"
else
    fail "HG-4 unikit-gd-verify handoff drift:$HG4_WHY"
fi

# (HG-4b) symmetric to GA-5 — unikit-gd-verify is FULLY READ-ONLY: its allowed-tools carry
# NO Write / Edit / Bash(mkdir *) (it writes no report file, no Affected line, no doc_status
# bump, no [gen]-map re-render), while Read/Grep stay (a verify that can't read is dead).
# Scope to the YAML list so prose mentions of Write/Edit in the Ownership "Never" line do
# not false-match. (Skill/Agent absence is covered by HG-5.)
GD_VERIFY_TOOLS=$(awk '/^allowed-tools:/{f=1;next} f&&/^[a-zA-Z]/{f=0} f' "$GD_VERIFY_SKILL")
HG4B_WHY=""
grep -qE '^[[:space:]]*-[[:space:]]*Write$'      <<< "$GD_VERIFY_TOOLS" && HG4B_WHY+=" has-Write"
grep -qE '^[[:space:]]*-[[:space:]]*Edit$'       <<< "$GD_VERIFY_TOOLS" && HG4B_WHY+=" has-Edit"
grep -qE '^[[:space:]]*-[[:space:]]*Bash\(mkdir' <<< "$GD_VERIFY_TOOLS" && HG4B_WHY+=" has-mkdir"
grep -qE '^[[:space:]]*-[[:space:]]*Read$'       <<< "$GD_VERIFY_TOOLS" || HG4B_WHY+=" no-Read"
grep -qE '^[[:space:]]*-[[:space:]]*Grep$'       <<< "$GD_VERIFY_TOOLS" || HG4B_WHY+=" no-Grep"
if [[ -z "$HG4B_WHY" ]]; then
    pass "HG-4b unikit-gd-verify allowed-tools is read-only (Read/Grep present; no Write/Edit/mkdir) — symmetric to GA-5"
else
    fail "HG-4b unikit-gd-verify read-only invariant violated:$HG4B_WHY"
fi

# (HG-5) the SHARED recommend-only handoff line locks the review+verify TAIL with ONE -qF
# string (drift in either fails — the verify-canonical ↔ review-mirror contract); the
# REVIEW.md template carries the two buckets + the Fix (entailed) field (canonical
# reference, aligned with the review SKILL inline format); and NEITHER review nor verify
# carries `Skill` in allowed-tools (recommend-only — the handoff is a printed command).
HG5_SHARED='the two handoff tails are identical by contract'
HG5_WHY=""
grep -qF "$HG5_SHARED"     "$GD_REVIEW_SKILL" || HG5_WHY+=" review:no-shared-handoff-line"
grep -qF "$HG5_SHARED"     "$GD_VERIFY_SKILL" || HG5_WHY+=" verify:no-shared-handoff-line"
grep -qF '## Apply-ready'  "$GD_REVIEW_TPL"   || HG5_WHY+=" tpl:no-apply-ready-bucket"
grep -qF '## Research'      "$GD_REVIEW_TPL"   || HG5_WHY+=" tpl:no-research-bucket"
grep -qF 'Fix (entailed)'  "$GD_REVIEW_TPL"   || HG5_WHY+=" tpl:no-fix-field"
grep -qE '^  - Skill$'     "$GD_REVIEW_SKILL" && HG5_WHY+=" review:Skill-in-allowed-tools"
grep -qE '^  - Skill$'     "$GD_VERIFY_SKILL" && HG5_WHY+=" verify:Skill-in-allowed-tools"
if [[ -z "$HG5_WHY" ]]; then
    pass "HG-5 shared recommend-only handoff line (review+verify, one -qF) + REVIEW.md 2 buckets/Fix field + no Skill in allowed-tools"
else
    fail "HG-5 shared handoff/template drift:$HG5_WHY"
fi

# (HG-6) defective-gdd handoff fixture — a seeded review file under reviews/ (the durable
# two-bucket interface) with ≥1 apply-ready entailed finding + ≥1 research finding, plus
# the README "Handoff ground truth" seeds (classification, decline-vs-direction, loop-guard
# apply-phase3). test-only (under scripts/test-fixtures/, not delivered → no test-install /
# test-update wiring); the live agent verify/review/apply run is the reviewer's manual step.
# Reuses GD_DEFECTIVE_DIR (defined above in the flow-fixture block).
GD_DEFECTIVE_REVIEW="$GD_DEFECTIVE_DIR/reviews/2026-06-25_review-all.md"
HG6_WHY=""
[[ -s "$GD_DEFECTIVE_REVIEW" ]]                       || HG6_WHY+=" no-seeded-review-file"
grep -qF '## Apply-ready'  "$GD_DEFECTIVE_REVIEW" 2>/dev/null || HG6_WHY+=" no-apply-ready-bucket"
grep -qF '## Research'      "$GD_DEFECTIVE_REVIEW" 2>/dev/null || HG6_WHY+=" no-research-bucket"
grep -qF 'Fix (entailed)'  "$GD_DEFECTIVE_REVIEW" 2>/dev/null || HG6_WHY+=" no-entailed-fix"
grep -qF 'RF-2026-06-25-1'  "$GD_DEFECTIVE_REVIEW" 2>/dev/null || HG6_WHY+=" no-research-finding"
grep -qF 'RF-2026-06-25-2'  "$GD_DEFECTIVE_REVIEW" 2>/dev/null || HG6_WHY+=" no-apply-ready-finding"
grep -qF 'Handoff ground truth'  "$GD_DEFECTIVE_DIR/README.md" || HG6_WHY+=" no-readme-handoff-truth"
grep -qF 'decline-vs-direction'  "$GD_DEFECTIVE_DIR/README.md" || HG6_WHY+=" no-readme-decline-vs-direction"
grep -qF 'apply-phase3'          "$GD_DEFECTIVE_DIR/README.md" || HG6_WHY+=" no-readme-loop-guard"
if [[ -z "$HG6_WHY" ]]; then
    pass "HG-6 defective-gdd handoff fixture — reviews/ seeded review (apply-ready + research) + README handoff ground truth (classification/decline-vs-direction/loop-guard)"
else
    fail "HG-6 defective-gdd handoff fixture incomplete:$HG6_WHY"
fi

# HT: Unit-1 handoff-tail polish (decisions A + B + C — the layer ON TOP of HG-1…HG-6).
# A — the Handoff Tail contract (runnable command = the LAST block, icon, nothing after)
#     lives in gd-critique → Handoff Engine and is inherited by review/verify/explore.
# B — explore's review-file mode mutates the SAME review file IN PLACE (## Research →
#     ## Apply-ready promotion, brief in-file, zero researches/) → one file command.
# C — explore accepts RECON.md (pre-GDD carve-out): research saved as usual + a research:
#     backlink into RECON.md's new ## Explorations section (the asymmetry with B).
# File-scoped -qF grep invariants on the contract text (bash cannot run an LLM skill).
# Reuse GD_CRITIQUE / GD_REVIEW_SKILL / GD_VERIFY_SKILL / GD_EXPLORE_SKILL / GD_REVIEW_TPL /
# GD_RECON_SKILL / GD_INTERNAL_LENS (all defined above).

# (HT-1) gd-critique Handoff Tail contract — the engine A defines: the runnable command is
# the LAST block (nothing after it), one command on its own line with an icon, and NO
# downstream-plumbing prose. Inherited by review/verify/explore (HT-2).
HT1_WHY=""
grep -qF '### Handoff Tail contract'                  "$GD_CRITIQUE" || HT1_WHY+=" no-tail-contract-heading"
grep -qF 'The runnable command is the LAST block of the response.' "$GD_CRITIQUE" || HT1_WHY+=" no-command-last-block"
grep -qF 'One command, on its own line, icon in front' "$GD_CRITIQUE" || HT1_WHY+=" no-one-command-icon"
grep -qF 'No downstream plumbing.'                    "$GD_CRITIQUE" || HT1_WHY+=" no-downstream-plumbing-ban"
if [[ -z "$HT1_WHY" ]]; then
    pass "HT-1 gd-critique Handoff Tail contract (command = last block · one icon-line · no downstream plumbing)"
else
    fail "HT-1 gd-critique Handoff Tail contract drift:$HT1_WHY"
fi

# (HT-2) review + verify Final blocks follow the Tail contract — locked with TWO SHARED
# -qF strings applied to BOTH skills (drift in either fails: the same contract governs the
# review tail #1 and the verify tail). verify ALSO keeps its apply-phase3 LOOP-GUARD (the
# in-apply run prints no command tail). explore INHERITS the contract via its Bootstrap.
HT2_FOLLOW='Follow the **Handoff Tail contract**'
HT2_LAST='Then end with the handoff as the LAST block'
HT2_WHY=""
grep -qF "$HT2_FOLLOW"        "$GD_REVIEW_SKILL" || HT2_WHY+=" review:no-follow-contract"
grep -qF "$HT2_FOLLOW"        "$GD_VERIFY_SKILL" || HT2_WHY+=" verify:no-follow-contract"
grep -qF "$HT2_LAST"          "$GD_REVIEW_SKILL" || HT2_WHY+=" review:no-last-block"
grep -qF "$HT2_LAST"          "$GD_VERIFY_SKILL" || HT2_WHY+=" verify:no-last-block"
grep -qF 'Nothing prints after the command' "$GD_REVIEW_SKILL" || HT2_WHY+=" review:no-nothing-after"
grep -qF 'Nothing prints after the command' "$GD_VERIFY_SKILL" || HT2_WHY+=" verify:no-nothing-after"
grep -qF 'no command tail'    "$GD_VERIFY_SKILL" || HT2_WHY+=" verify:no-suppressed-tail"
grep -qF 'apply-phase3'       "$GD_VERIFY_SKILL" || HT2_WHY+=" verify:no-loop-guard-sentinel"
grep -qF 'Handoff Tail contract' "$GD_EXPLORE_SKILL" || HT2_WHY+=" explore:no-contract-inheritance"
if [[ -z "$HT2_WHY" ]]; then
    pass "HT-2 review+verify Final follow the Tail contract (2 shared -qF + nothing-after) · verify keeps apply-phase3 suppressed tail · explore inherits"
else
    fail "HT-2 review/verify/explore Tail-contract drift:$HT2_WHY"
fi

# (HT-3) explore review-file mode → IN-PLACE promotion (B). The SAME review file is mutated:
# a developed ## Research finding is promoted into ## Apply-ready (apply reads only that
# bucket), the brief lives in-file, ZERO researches/, and the output is ONE file command
# /unikit-gd-apply reviews/X.md. The sanctioned cross-skill write is recorded in BOTH the
# explore Ownership and the review Ownership; the REVIEW.md template carries the opt#3 note.
HT3_WHY=""
grep -qF "developing a review's open questions IN PLACE" "$GD_EXPLORE_RESEARCH_BUCKET" || HT3_WHY+=" explore:no-in-place-mode"
grep -qF 'Promote the finding in place'   "$GD_EXPLORE_RESEARCH_BUCKET" || HT3_WHY+=" explore:no-promotion-step"
grep -qF '🛠️ /unikit-gd-apply reviews/'   "$GD_EXPLORE_RESEARCH_BUCKET" || HT3_WHY+=" explore:no-one-file-command"
grep -qF 'never into `researches/`'       "$GD_EXPLORE_RESEARCH_BUCKET" || HT3_WHY+=" explore:no-zero-researches"
grep -qF 'Research-bucket mode (in-place promotion)' "$GD_EXPLORE_SKILL" || HT3_WHY+=" explore:no-ownership-note"
grep -qF 'living pipeline artifact'       "$GD_REVIEW_SKILL"  || HT3_WHY+=" review:no-sanctioned-write-note"
grep -qF 'promotes it in place'           "$GD_REVIEW_TPL"    || HT3_WHY+=" tpl:no-in-place-promote-note"
grep -qF 'living pipeline artifact'       "$GD_REVIEW_TPL"    || HT3_WHY+=" tpl:no-living-artifact-note"
if [[ -z "$HT3_WHY" ]]; then
    pass "HT-3 explore review-file IN-PLACE (## Research→## Apply-ready · zero researches/ · one file command) + both-skill ownership + REVIEW.md opt#3 note"
else
    fail "HT-3 explore in-place review-file drift:$HT3_WHY"
fi

# (HT-4) explore RECON-input mode + ## Explorations backlink (C). The pre-GDD carve-out:
# the internal lens engages on RECON.md (no GAME.md), research is saved AS USUAL and a
# research: backlink is appended to RECON.md's new ## Explorations section (the asymmetry
# with B). The section + the sanctioned write are recorded in the recon SKILL (format +
# Ownership); the internal-design-lens reference carries the pre-GDD source carve-out.
HT4_WHY=""
grep -qF '## RECON-input mode'        "$GD_EXPLORE_RECON_INPUT" || HT4_WHY+=" explore:no-recon-mode"
grep -qF 'Pre-GDD carve-out'          "$GD_EXPLORE_RECON_INPUT" || HT4_WHY+=" explore:no-pre-gdd-carveout"
grep -qF '## Explorations'            "$GD_EXPLORE_SKILL"  || HT4_WHY+=" explore:no-explorations-backlink"
grep -qF '🗺️ /unikit-gd-spec .unikit/gamedesign/RECON.md' "$GD_EXPLORE_RECON_INPUT" || HT4_WHY+=" explore:no-spec-import-command"
grep -qF 'RECON-input mode (research + backlink)' "$GD_EXPLORE_SKILL" || HT4_WHY+=" explore:no-recon-ownership-note"
grep -qF '## Explorations'            "$GD_RECON_SKILL"    || HT4_WHY+=" recon:no-explorations-section"
grep -qF 'appended by /unikit-gd-explore' "$GD_RECON_SKILL" || HT4_WHY+=" recon:no-explore-writer-note"
grep -qF 'Pre-GDD source (RECON-input mode)' "$GD_INTERNAL_LENS" || HT4_WHY+=" lens:no-pre-gdd-source-carveout"
if [[ -z "$HT4_WHY" ]]; then
    pass "HT-4 explore RECON-input (pre-GDD carve-out · research-as-usual + ## Explorations backlink · spec import) + recon section/ownership + lens carve-out"
else
    fail "HT-4 explore RECON-input drift:$HT4_WHY"
fi

# SL: Unit-2+3 slim (decisions D + E — current-state-only axiom: an artifact holds
# current state + a minimal provenance anchor, history → git).
# D — the decisions:/DD-n design-decision log is REMOVED everywhere (write-only, no
#     machine consumer; the rationale already rides the changelog essence + git).
# E — the GDD changelog is K1 (the LATEST delta only): a new block REPLACES the prior
#     one in the document; the full v1…v(N-1) ledger lives in git.
# File-scoped over data/gamedesign/ + skills/unikit-gd-* + the gamedesign fixtures.

# (SL-1, D) decisions/DD fully removed. The ban is on EXACT tokens (+check-confirmed):
# the YAML key `decisions:` (bare `decisions` is legitimate English prose — gd-authoring
# "decisions ride this round", lens "worked-out decisions", README) and the `DD-<n>`
# design-decision id (precise: `DD-` NOT preceded by a letter — excludes `GDD-first` /
# `DDD-*` — and followed by a digit / `n` / `<`). NOT bare `DD-`/`decisions`.
SL_SCOPE=("$GD_DATA" "$ROOT_DIR/scripts/test-fixtures/gamedesign")
for sl_d in "$ROOT_DIR"/skills/unikit-gd-*/; do SL_SCOPE+=("$sl_d"); done
SL1_WHY=""
grep -rnF 'decisions:' "${SL_SCOPE[@]}" >/dev/null 2>&1 && SL1_WHY+=" decisions:-key-present"
grep -rnE '(^|[^A-Za-z])DD-([0-9]|n|<)' "${SL_SCOPE[@]}" >/dev/null 2>&1 && SL1_WHY+=" DD-<n>-id-token-present"
grep -qF 'KNOB-slug, DD-n'        "$GD_IDS_TPL"    && SL1_WHY+=" tpl-DD-in-id-list"
grep -qF 'decisions: []'          "$GD_IDS_TPL"    && SL1_WHY+=" tpl-decisions-section"
grep -qF '`DD-<n>` | Design decision' "$GD_PRINCIPLES" && SL1_WHY+=" principles-DD-row"
if [[ -z "$SL1_WHY" ]]; then
    pass "SL-1 (D) decisions/DD removed — zero decisions:/DD-<n> in data/gamedesign + skills/unikit-gd-* + fixtures (exact tokens) · no DECISIONS in GD-IDS tpl · no DD row in gd-principles"
else
    fail "SL-1 decisions/DD drift:$SL1_WHY"
fi

# (SL-2, E) changelog K1 — the latest-delta-only contract carried by gd-authoring (the
# owner), all four authored templates (SYSTEM §K / FLOW §F / CONTENT-TYPE §F / GAME
# ## Changelog), and the three zone skills (system / flow / content) that write it. The
# AC / GOAL / Fields-delta line + the RF-<date>-n anchor stay (the carrying part — the
# accumulated prose ledger is what moves to git). Anchor: "latest delta only".
SL_K1='latest delta only'
SL2_WHY=""
grep -qF "$SL_K1" "$GD_AUTHORING"                            || SL2_WHY+=" authoring:no-K1"
grep -qF "$SL_K1" "$GD_DATA/templates/SYSTEM.md"             || SL2_WHY+=" tpl-system:no-K1"
grep -qF "$SL_K1" "$GD_DATA/templates/FLOW.md"               || SL2_WHY+=" tpl-flow:no-K1"
grep -qF "$SL_K1" "$GD_DATA/templates/CONTENT-TYPE.md"       || SL2_WHY+=" tpl-content:no-K1"
grep -qF "$SL_K1" "$GD_DATA/templates/GAME.md"               || SL2_WHY+=" tpl-game:no-K1"
grep -qF "$SL_K1" "$ROOT_DIR/skills/unikit-gd-system/references/mode-revise.md"   || SL2_WHY+=" sys-skill:no-K1"
grep -qF "$SL_K1" "$ROOT_DIR/skills/unikit-gd-flow/references/mode-revise.md"     || SL2_WHY+=" flow-skill:no-K1"
grep -qF "$SL_K1" "$ROOT_DIR/skills/unikit-gd-content/references/mode-revise.md"  || SL2_WHY+=" content-skill:no-K1"
# the RF-<date>-n changelog anchor replaces the old DD citation in the changelog format
grep -qF '(RF-<date>-n)' "$GD_AUTHORING"                     || SL2_WHY+=" authoring:no-RF-anchor"
if [[ -z "$SL2_WHY" ]]; then
    pass "SL-2 (E) changelog K1 (latest delta only) in gd-authoring + 4 templates + 3 zone skills · RF-<date>-n essence anchor"
else
    fail "SL-2 changelog-K1 drift:$SL2_WHY"
fi

# ─────────────────────────────────────────────
# LA: layer A — the evidence contract in data/dev-principles.md (LA-1…LA-6)
# ─────────────────────────────────────────────
# dev-principles.md is read on EVERY Bootstrap by five skills, so it is the one
# file where a drifted sentence is guaranteed to reach every pipeline run. These
# guards lock the three things that cannot be re-derived from the text: the
# vocabularies (they are the source of truth for the kind grammar and every check
# table's key), the "no names" invariant, and the always/lazy split.
# All -qF and file-scoped (MSYS grep aborts on -iF) except LA-5, which is regex by
# construction. LA-4 (the "no names" invariant on this file) moved to the NN block below:
# the invariant was never about dev-principles.md in particular, and running it on one
# target while layer C went unwatched is how seven tool names accumulated there.
LA_DEV_PRINCIPLES="$ROOT_DIR/data/dev-principles.md"
LA_SYSTEM_ASSETS="$ROOT_DIR/src/core/installer/system-assets.ts"
LA_BOUNDARY='<!-- === LAZY-READ BOUNDARY === -->'
LA_CLASSES=('false success' 'eaten parameter' 'catalog phantom' 'lying validator'
            'fake rollback' 'transport ambiguity' 'opaque aggregate' 'stale read'
            'destructive default')

# (LA-1) The evidence contract itself. Without these tokens every downstream
# "report a verdict" instruction in the pipeline skills points at nothing.
LA1_WHY=""
grep -qF 'CLAIM'    "$LA_DEV_PRINCIPLES" || LA1_WHY+=" CLAIM"
grep -qF 'EVIDENCE' "$LA_DEV_PRINCIPLES" || LA1_WHY+=" EVIDENCE"
grep -qF 'VERDICT'  "$LA_DEV_PRINCIPLES" || LA1_WHY+=" VERDICT"
grep -qF 'NOT CONFIRMED' "$LA_DEV_PRINCIPLES" || LA1_WHY+=" NOT-CONFIRMED"
if [[ -z "$LA1_WHY" ]]; then
    pass "LA-1 evidence contract present in dev-principles.md"
else
    fail "LA-1 evidence contract MISSING in dev-principles.md:$LA1_WHY"
fi

# (LA-2) All nine failure-class names. The taxonomy is closed: a profile marks which
# classes are LIVE on a server, so a missing name here silently drops a whole class
# of silent failure from every check.
LA2_WHY=""
for la_class in "${LA_CLASSES[@]}"; do
    grep -qF "$la_class" "$LA_DEV_PRINCIPLES" || LA2_WHY+=" ${la_class// /-}"
done
if [[ -z "$LA2_WHY" ]]; then
    pass "LA-2 all nine failure-class names present in dev-principles.md"
else
    fail "LA-2 failure-class name MISSING in dev-principles.md:$LA2_WHY"
fi

# (LA-3) Both vocabularies, with their NEGATIVE halves. The input kind was dissolved
# into asset/scene/code (7 -> 6) and uitk is not an area (UI Toolkit is Unity-only,
# and an area must survive an engine change) — without the two absence checks either
# one creeps back as "just one more row" and both vocabularies stop being closed sets.
LA3_WHY=""
grep -qF 'scene · ui · vfx · anim · asset · settings' "$LA_DEV_PRINCIPLES" || LA3_WHY+=" kind-6"
grep -qF 'ui · scene · asset · anim · vfx · settings' "$LA_DEV_PRINCIPLES" || LA3_WHY+=" areas-by-kind"
grep -qF 'rollback · console · batch · compile · transport · visual' "$LA_DEV_PRINCIPLES" || LA3_WHY+=" areas-cross-cutting"
grep -qF '· input ·' "$LA_DEV_PRINCIPLES" && LA3_WHY+=" input-kind-resurrected"
grep -qF 'uitk'      "$LA_DEV_PRINCIPLES" && LA3_WHY+=" uitk-became-an-area"
grep -qF 'rules ≠ no rights' "$LA_DEV_PRINCIPLES" || LA3_WHY+=" no-rules-no-rights"
if [[ -z "$LA3_WHY" ]]; then
    pass "LA-3 kind (6) + areas (12) + the no-rules-no-rights rule present, input/uitk absent"
else
    fail "LA-3 vocabulary drift in dev-principles.md:$LA3_WHY"
fi

# (LA-5) No server counters, in THREE targets. "silent no-ops are confirmed on two of
# the four supported servers" is an assertion about the state of the servers WITH a
# counter: fix one server and the sentence is false, silently. The replacement wording
# is monotone ("a response code is not evidence") and stays true at any server count.
# Targets: data/ (the layer) · skills/ (they ship into projects and outlive this branch)
# · system-assets.ts (the header it writes ships too). The matched line is printed with
# its file — one fail line is not enough to tell a counter from a legitimate number.
LA5_RE='(one|two|three|four|five|six|seven|eight|nine|ten|[0-9]+) of (the )?(one|two|three|four|five|six|seven|eight|nine|ten|[0-9]+)[^.]*servers?'
LA5_HITS=$(grep -rnEi "$LA5_RE" "$LA_DEV_PRINCIPLES" "$ROOT_DIR/skills" "$LA_SYSTEM_ASSETS" --include='*.md' --include='*.ts' 2>/dev/null || true)
if [[ -n "$LA5_HITS" ]]; then
    fail "LA-5 server counter survives (an assertion about server state, not a check):"
    echo "$LA5_HITS" | head -5
else
    pass "LA-5 no server counters in dev-principles.md / skills/ / system-assets.ts"
fi

# (LA-6) The always/lazy split. The boundary marker must exist, the nine class NAMES
# must sit ABOVE it, and the detailed detectors + the 13-question checklist BELOW.
# Without this pair the asymmetry collapses on the first edit and the Bootstrap budget
# quietly reverts to the whole file — with nothing failing.
LA6_WHY=""
if ! grep -qF "$LA_BOUNDARY" "$LA_DEV_PRINCIPLES"; then
    LA6_WHY+=" boundary-marker-missing"
else
    LA_BLINE=$(grep -nF "$LA_BOUNDARY" "$LA_DEV_PRINCIPLES" | head -1 | cut -d: -f1)
    LA_ABOVE=$(head -n "$LA_BLINE" "$LA_DEV_PRINCIPLES")
    LA_BELOW=$(tail -n +"$LA_BLINE" "$LA_DEV_PRINCIPLES")
    for la_class in "${LA_CLASSES[@]}"; do
        echo "$LA_ABOVE" | grep -qF "$la_class" || LA6_WHY+=" name-not-above:${la_class// /-}"
    done
    echo "$LA_BELOW" | grep -qF 'The nine failure classes — detectors' || LA6_WHY+=" detectors-not-below"
    echo "$LA_BELOW" | grep -qF 'The catalog checklist — 13 questions' || LA6_WHY+=" checklist-not-below"
    echo "$LA_ABOVE" | grep -qF 'The catalog checklist — 13 questions' && LA6_WHY+=" checklist-leaked-above"
fi
if [[ -z "$LA6_WHY" ]]; then
    pass "LA-6 lazy-read boundary: nine class names above, detectors + 13-question checklist below"
else
    fail "LA-6 always/lazy split drift:$LA6_WHY"
fi

# ─────────────────────────────────────────────
# GB: guard B — an Editor: phase is serialized alone in its execution layer (GB-1…GB-3)
# ─────────────────────────────────────────────
# The rule has two halves and only the pair is correct. The POSITIVE half is that the
# unit of serialization is the execution LAYER; the NEGATIVE half is that it is not the
# task — two Editor: tasks inside one phase are already sequential, and a rule phrased
# per-task would split a safe pair into two phases the coordinator is then free to run
# concurrently, manufacturing the collision the guard exists to prevent. Both writers of
# task graphs must carry both halves: unikit-plan writes the graph, unikit-improve audits
# a graph it did not write. Losing the rule in either file loses it in practice.
# All -qF and file-scoped (MSYS grep aborts on -iF).
GB_PLAN_SKILL="$ROOT_DIR/skills/unikit-plan/SKILL.md"
GB_IMPROVE_SKILL="$ROOT_DIR/skills/unikit-improve/SKILL.md"
GB_TASK_FORMAT="$ROOT_DIR/skills/unikit-plan/references/TASK-FORMAT.md"

# (GB-1) The positive half, in both task-graph writers: the unit is the LAYER, and the
# layer is computed the way the coordinator computes it.
GB1_WHY=""
grep -qF 'serialized alone in its execution layer' "$GB_PLAN_SKILL"    || GB1_WHY+=" plan:layer-rule"
grep -qF 'serialized alone in its execution layer' "$GB_IMPROVE_SKILL" || GB1_WHY+=" improve:layer-rule"
grep -qF 'layers 0..N-1' "$GB_PLAN_SKILL"    || GB1_WHY+=" plan:layer-computation"
grep -qF 'layers 0..N-1' "$GB_IMPROVE_SKILL" || GB1_WHY+=" improve:layer-computation"
if [[ -z "$GB1_WHY" ]]; then
    pass "GB-1 guard B stated as a LAYER rule in unikit-plan + unikit-improve"
else
    fail "GB-1 guard B layer wording MISSING in:$GB1_WHY"
fi

# (GB-2) The negative half. Without it the rule reads as "one Editor: task per phase",
# which is the inverted requirement — and the inversion is invisible to GB-1.
GB2_WHY=""
grep -qF 'already sequential' "$GB_PLAN_SKILL"    || GB2_WHY+=" plan"
grep -qF 'already sequential' "$GB_IMPROVE_SKILL" || GB2_WHY+=" improve"
if [[ -z "$GB2_WHY" ]]; then
    pass "GB-2 tasks-inside-a-phase-are-already-sequential carve-out present in both"
else
    fail "GB-2 guard B negative half MISSING in:$GB2_WHY"
fi

# (GB-3) The grammar reference carries the rule too: TASK-FORMAT.md is what a plan author
# reads while writing Dependencies: lines, and it is excluded from the Part 7c scan, so
# nothing else looks at it.
if grep -qF 'serialized alone in its execution layer' "$GB_TASK_FORMAT"; then
    pass "GB-3 guard B present in the Editor task grammar (TASK-FORMAT.md)"
else
    fail "GB-3 guard B MISSING in skills/unikit-plan/references/TASK-FORMAT.md"
fi

# ─────────────────────────────────────────────
# EM: engine-MCP rules layer (EM-1…EM-7)
# ─────────────────────────────────────────────
# The shard corpus (mcp/*/shards/**) was dropped with the rules-tree cutover; the
# per-server profile now lives in mcp/<engine>/rules/<server>/{INDEX,verification}.md.
# The guards here lock the SOURCE side — the reader lines in the skills, the dead-name
# sweep on the repaired configs, and the init.ts call site that no runtime test reaches.
# EM-8 (the fennara .gd doctrine override) died with its shard: the fact it guarded is
# now a universal line in layer A, guarded there by the LA-* block. EM-1 / EM-2 were
# retargeted from the shard-era assets to the delivered tree (INDEX.md + the project's
# MCP-RECHECK-NOTES.md) in the same commit that rewrote the reader lines they grep.
# All `-qF`, file-scoped (MSYS grep aborts on -iF).
# Path vars: reuse UNIKIT_VERIFY_SKILL; new EM_* for the other three readers.
EM_IMPLEMENT_SKILL="$ROOT_DIR/skills/unikit-implement/SKILL.md"
EM_FIX_SKILL="$ROOT_DIR/skills/unikit-fix/SKILL.md"
EM_DEVCONTEXT_SKILL="$ROOT_DIR/skills/unikit-devcontext/SKILL.md"
EM_DEV_PRINCIPLES="$ROOT_DIR/data/dev-principles.md"

# (EM-1) INDEX.md is the entry point of the delivered rules tree and is read by ALL FOUR
# pipeline skills. A delivered asset with no reader line is dead weight; this is the only
# thing that keeps the four in sync. (It replaced capabilities.md with the rules-tree
# cutover — the shard corpus, and that file with it, no longer exists.)
EM1_WHY=""
grep -qF 'engine-mcp/INDEX.md' "$EM_IMPLEMENT_SKILL"  || EM1_WHY+=" implement"
grep -qF 'engine-mcp/INDEX.md' "$EM_FIX_SKILL"        || EM1_WHY+=" fix"
grep -qF 'engine-mcp/INDEX.md' "$UNIKIT_VERIFY_SKILL" || EM1_WHY+=" verify"
grep -qF 'engine-mcp/INDEX.md' "$EM_DEVCONTEXT_SKILL" || EM1_WHY+=" devcontext"
if [[ -z "$EM1_WHY" ]]; then
    pass "EM-1 engine-mcp INDEX.md read by all four pipeline skills"
else
    fail "EM-1 engine-mcp INDEX.md reader line MISSING in:$EM1_WHY"
fi

# (EM-2) The rules-tree binding: MCP-RECHECK-NOTES.md → all four readers of the check
# tables; verification.md → verify ONLY. The negative half is the load-bearing one:
# verification.md is the per-gate calibration behind the GATE LIFTED verdict, and that
# verdict means nothing outside unikit-verify. Splitting the calibration across two
# readers is how two skills come to disagree about what is lifted.
EM2_WHY=""
grep -qF 'MCP-RECHECK-NOTES.md' "$EM_IMPLEMENT_SKILL"  || EM2_WHY+=" notes:implement-missing"
grep -qF 'MCP-RECHECK-NOTES.md' "$EM_FIX_SKILL"        || EM2_WHY+=" notes:fix-missing"
grep -qF 'MCP-RECHECK-NOTES.md' "$EM_DEVCONTEXT_SKILL" || EM2_WHY+=" notes:devcontext-missing"
grep -qF 'MCP-RECHECK-NOTES.md' "$UNIKIT_VERIFY_SKILL" || EM2_WHY+=" notes:verify-missing"
grep -qF 'engine-mcp/verification.md'    "$UNIKIT_VERIFY_SKILL" || EM2_WHY+=" verification:verify-missing"
grep -qF 'engine-mcp/verification.md' "$EM_IMPLEMENT_SKILL"  && EM2_WHY+=" verification:leaked-into-implement"
grep -qF 'engine-mcp/verification.md' "$EM_FIX_SKILL"        && EM2_WHY+=" verification:leaked-into-fix"
grep -qF 'engine-mcp/verification.md' "$EM_DEVCONTEXT_SKILL" && EM2_WHY+=" verification:leaked-into-devcontext"
if [[ -z "$EM2_WHY" ]]; then
    pass "EM-2 rules-tree binding: notes → all four readers · verification → verify ONLY"
else
    fail "EM-2 rules-tree binding drift:$EM2_WHY"
fi

# (EM-3) The GATE LIFTED override must exist on ALL THREE sides — the convention is
# useless if unikit-verify does not honour it, and dev-principles p.5 would otherwise keep
# demanding an MCP test run on servers that cannot report results. The third target is a
# server-side file that exercises the override: it was the chir24 shard, and it is the
# biome verification.md now that the rules tree is the delivered asset. What that file
# must say is the NEGATIVE of the convention — the verdict is produced by a run, never
# pre-declared — so the two halves of EM-3 point in opposite directions on purpose.
EM_BIOME_VERIFICATION="$ROOT_DIR/mcp/unity/rules/unity-biome-mcp/verification.md"
EM3_WHY=""
grep -qF 'GATE LIFTED' "$UNIKIT_VERIFY_SKILL" || EM3_WHY+=" verify-skill"
grep -qF 'GATE LIFTED' "$EM_DEV_PRINCIPLES"   || EM3_WHY+=" dev-principles"
if [[ -f "$EM_BIOME_VERIFICATION" ]]; then
    grep -qF 'GATE LIFTED' "$EM_BIOME_VERIFICATION"       || EM3_WHY+=" biome-verification"
    grep -qF 'is not pre-declared here' "$EM_BIOME_VERIFICATION" || EM3_WHY+=" biome-pre-declared-ban"
else
    EM3_WHY+=" biome-verification-missing"
fi
if [[ -z "$EM3_WHY" ]]; then
    pass "EM-3 GATE LIFTED override present in unikit-verify + dev-principles + biome verification.md"
else
    fail "EM-3 GATE LIFTED override MISSING in:$EM3_WHY"
fi

# (EM-4) Dead-name sweep on the two repaired configs. ChiR24 cut over to a single `unreal`
# tool, so every old parent name is a guaranteed DIRECT_TOOL_CALL_REMOVED; UE_PROJECT_PATH
# passed fs.existsSync and then failed every call with NOT_CONNECTED. coplay's 8085 never
# existed in their repository at all.
EM_CHIR24_JSON="$ROOT_DIR/mcp/unreal-engine-5/chir24-unreal-mcp.json"
EM_COPLAY_JSON="$ROOT_DIR/mcp/unity/coplay-unity-mcp.json"
EM4_WHY=""
for dead in manage_pipeline manage_performance manage_game_framework manage_behavior_tree manage_navigation UE_PROJECT_PATH; do
    grep -qF "$dead" "$EM_CHIR24_JSON" && EM4_WHY+=" chir24:$dead"
done
grep -qF '8085' "$EM_COPLAY_JSON" && EM4_WHY+=" coplay:8085"
if [[ -z "$EM4_WHY" ]]; then
    pass "EM-4 dead-name sweep: no removed tool names / UE_PROJECT_PATH / port 8085 survive"
else
    fail "EM-4 DEAD names still present:$EM4_WHY"
fi

# (EM-5) Static wiring guard for BOTH call sites, over the two functions that must run
# together. test-install.sh installs its projects via `update`, so every runtime profile test
# exercises update.ts; a dropped init.ts call would be invisible to lint, knip (still called
# from update.ts) and every smoke test. These greps are the only coverage of the init side.
#
# swapMcpRecheckNotes joins installEngineMcpRules here because its failure mode is worse than
# a missing delivery and completely silent: the notes of the outgoing server stay active under
# the incoming one, and every reader then treats another server's findings as evidence.
EM5_WHY=""
for fn in installEngineMcpRules swapMcpRecheckNotes; do
    grep -qF "$fn(" "$ROOT_DIR/src/cli/commands/init.ts"   || EM5_WHY+=" init.ts:$fn"
    grep -qF "$fn(" "$ROOT_DIR/src/cli/commands/update.ts" || EM5_WHY+=" update.ts:$fn"
done
if [[ -z "$EM5_WHY" ]]; then
    pass "EM-5 installEngineMcpRules + swapMcpRecheckNotes wired in both init.ts and update.ts"
else
    fail "EM-5 rules-tree delivery NOT wired in:$EM5_WHY"
fi

# (EM-6) No recommendation wording in a Godot displayName. Ranking is expressed by
# `order` alone (decision #10/#12) — a `[Recommended]` tag next to a paid server both
# duplicates the ordering and editorialises it. Directory-scoped so the ban cannot be
# reintroduced in whichever Godot config is added next.
EM6_WHY=""
for godot_json in "$ROOT_DIR"/mcp/godot/*.json; do
    [[ -f "$godot_json" ]] || continue
    grep -qF '[Recommended]' "$godot_json" && EM6_WHY+=" $(basename "$godot_json")"
done
if [[ -z "$EM6_WHY" ]]; then
    pass "EM-6 no [Recommended] tag in any mcp/godot/*.json displayName"
else
    fail "EM-6 [Recommended] tag survives in:$EM6_WHY"
fi

# (EM-7) Fennara is the only config with no `config` key at all — its binary path differs
# per OS. Both tokens must be present in the JSON (an accidental absolute path would work
# on the author's machine and nowhere else) and both must resolve at configure time, which
# the platform-agnostic install assertion in test-install.sh covers.
EM_FENNARA_JSON="$ROOT_DIR/mcp/godot/fennara-godot-mcp.json"
EM7_WHY=""
grep -qF '{{localappdata}}' "$EM_FENNARA_JSON" || EM7_WHY+=" no-localappdata-token"
grep -qF '{{home}}' "$EM_FENNARA_JSON"         || EM7_WHY+=" no-home-token"
if [[ -z "$EM7_WHY" ]]; then
    pass "EM-7 fennara configByPlatform carries both {{home}} and {{localappdata}} tokens"
else
    fail "EM-7 fennara platform tokens missing:$EM7_WHY"
fi

# ─────────────────────────────────────────────
# ED: Editor-target grammar layer (ED-1…ED-11)
# ─────────────────────────────────────────────
# The whole Editor: layer is a TEXTUAL contract across the plan template, the
# planner, four consumer skills and two subagents. It has no compiler. Its most
# likely failure is "writer without reader" — a setting written into the plan that
# nobody parses. It fails SILENTLY on a configured MCP.
# ED-12 (the coplay kind table), ED-13 (the visual-regression gate) and ED-14 (kind
# table ⊆ grants) died with the shard corpus they grepped: kind tables naming tools
# exist nowhere now, and `Visual regression` is gone as a setting — the step took its
# own baseline right before its own change, so on a working run it could only ever
# come back green; the evidence obligation it pretended to carry lives in layer A.
# ED-14 returned in schema form below — every check-table `area` ∈ the 12-area vocabulary.
# All -qF and file-scoped (MSYS grep aborts on -iF).
# Path vars: reuse UNIKIT_VERIFY_SKILL / UNIKIT_PLAN_SKILL / UNIKIT_IMPROVE_SKILL /
# CK_TASKFMT / EM_IMPLEMENT_SKILL — declaring ED_* duplicates for the same files is
# exactly the name drift the CK-* block removed. New vars only where none exists.
ED_MODE_FULL="$ROOT_DIR/skills/unikit-plan/references/mode-full.md"
ED_MODE_FAST="$ROOT_DIR/skills/unikit-plan/references/mode-fast.md"
ED_PLAN_TPL="$ROOT_DIR/data/engine-templates/skills/unikit-plan/UNITY_RULES.md"
ED_IMPLEMENT_WORKER="$ROOT_DIR/subagents/unikit-implement-worker.md"

# Shared by ED-14 and by RT-2 / RT-4 below, and deliberately OUT of any numbered guard:
# a guard is a retirable unit (EM-8, ED-12 and ED-13 were all retired in this branch), and
# a helper that dies with one would take three others down with a `command not found`
# under `set -e` rather than a named failure. Same placement LA_CLASSES has relative to the
# LA guards that read it.
RT_AREAS=(ui scene asset anim vfx settings rollback console batch compile transport visual)

# Prints one column of the table under the given heading. Field N+1, since the leading
# pipe makes field 1 empty. Header and separator rows are dropped by rejecting the literal
# header cells and any row whose cell is all dashes.
rt_table_column() {
    local file="$1" heading="$2" column="$3"
    awk -v h="$heading" -v c="$column" '
        $0 == h { inside = 1; next }
        inside && /^## / { exit }
        inside && /^\|/ {
            n = split($0, cells, "|")
            if (c + 1 > n) next
            v = cells[c + 1]
            gsub(/^[ \t]+|[ \t]+$/, "", v)
            if (v == "" || v ~ /^-+$/ || v == "id" || v == "area" || v == "class") next
            print v
        }
    ' "$file"
}

# (ED-1) The grammar itself. Without the kind list the field is unconstrained and
# every planner invents its own vocabulary.
ED1_WHY=""
grep -qF 'Editor: [kind]' "$CK_TASKFMT" || ED1_WHY+=" grammar-line"
grep -qF 'scene | ui | vfx | anim | asset | settings' "$CK_TASKFMT" || ED1_WHY+=" 6-kinds"
grep -qF '| input |' "$CK_TASKFMT" && ED1_WHY+=" input-kind-resurrected"
if [[ -z "$ED1_WHY" ]]; then
    pass 'ED-1 Editor: grammar + 6 kinds present in TASK-FORMAT.md (input dissolved)'
else
    fail "ED-1 Editor: grammar drift in TASK-FORMAT.md:$ED1_WHY"
fi

# (ED-2) The `Editor tasks` ## Settings line. It is parsed by example (like Testing:),
# so a rename here silently disables the consumer rather than erroring. The negative
# half is the other direction: `Visual regression` was removed as a setting, and a
# resurrection here would ship a writer whose reader no longer exists.
ED2_WHY=""
grep -qF 'Editor tasks' "$CK_TASKFMT"      || ED2_WHY+=" editor-tasks"
grep -qF 'Visual regression' "$CK_TASKFMT" && ED2_WHY+=" visual-regression-resurrected"
if [[ -z "$ED2_WHY" ]]; then
    pass "ED-2 Editor tasks ## Settings line present in TASK-FORMAT.md (Visual regression dissolved)"
else
    fail "ED-2 ## Settings drift in TASK-FORMAT.md:$ED2_WHY"
fi

# (ED-3) The brief's aggregation table.
if grep -qF '## EDITOR TARGETS' "$CK_TASKFMT"; then
    pass "ED-3 ## EDITOR TARGETS present in TASK-FORMAT.md"
else
    fail "ED-3 ## EDITOR TARGETS missing from TASK-FORMAT.md"
fi

# (ED-4) NEGATIVE — the only mechanical guard on the engine-neutrality cleanup.
# TWO files, EIGHT assertions.
#   TASK-FORMAT.md: references/ is EXCLUDED from the Part 7c engine stop-word scan,
#   which is precisely how the Unity specifics accumulated there in the first place.
#   Assert `.cs` (not `path/to/file.cs`): the latter misses the `path/to/file1.cs`
#   line and would go green on a half-done cleanup. After the cleanup no legitimate
#   `.cs` remains in the file.
#   unikit-plan/SKILL.md: Part 7c DOES scan it but catches none of these three
#   (`Assets/` is not a stop word, `.cs` does not match `(^| )C# `).
ED4_WHY=""
grep -qF 'Assets/' "$CK_TASKFMT"        && ED4_WHY+=" tpl:Assets/"
grep -qF '```csharp' "$CK_TASKFMT"      && ED4_WHY+=" tpl:csharp-fence"
grep -qF '`.cs`' "$CK_TASKFMT"          && ED4_WHY+=" tpl:.cs"
grep -qF 'Zenject' "$CK_TASKFMT"        && ED4_WHY+=" tpl:Zenject"
grep -qF 'Container.Bind' "$CK_TASKFMT" && ED4_WHY+=" tpl:Container.Bind"
grep -qF 'Assets/' "$UNIKIT_PLAN_SKILL" && ED4_WHY+=" skill:Assets/"
grep -qF 'Zenject' "$UNIKIT_PLAN_SKILL" && ED4_WHY+=" skill:Zenject"
grep -qF '`.cs`' "$UNIKIT_PLAN_SKILL"   && ED4_WHY+=" skill:.cs"
if [[ -z "$ED4_WHY" ]]; then
    pass "ED-4 no engine specifics left in TASK-FORMAT.md + unikit-plan/SKILL.md (8 assertions)"
else
    fail "ED-4 engine specifics leaked back:$ED4_WHY"
fi

# (ED-5) The planner must READ the vocabulary. Before this phase unikit-plan had
# zero mentions of ENGINE_RULES while owning a slot in engines.ts.
if grep -qF 'ENGINE_RULES' "$UNIKIT_PLAN_SKILL"; then
    pass "ED-5 ENGINE_RULES read wired into unikit-plan/SKILL.md"
else
    fail "ED-5 unikit-plan/SKILL.md does not mention ENGINE_RULES"
fi

# (ED-6) Both mode files, two separate assertions — one mode drifting away from the
# other is a real scenario, and a single OR would hide it.
ED6_WHY=""
grep -qF 'Editor tasks' "$ED_MODE_FULL" || ED6_WHY+=" mode-full"
grep -qF 'Editor tasks' "$ED_MODE_FAST" || ED6_WHY+=" mode-fast"
if [[ -z "$ED6_WHY" ]]; then
    pass "ED-6 Editor tasks question present in BOTH mode-full.md and mode-fast.md"
else
    fail "ED-6 Editor tasks question MISSING in:$ED6_WHY"
fi

# (ED-7) The two-sided contract: a setting written by the planner and read by nobody
# is lost silently, which is the failure this whole block exists to prevent.
ED7_WHY=""
grep -qF 'Editor tasks' "$EM_IMPLEMENT_SKILL"       || ED7_WHY+=" implement-missing-Editor-tasks"
grep -qF 'Visual regression' "$UNIKIT_VERIFY_SKILL" && ED7_WHY+=" verify-Visual-regression-resurrected"
if [[ -z "$ED7_WHY" ]]; then
    pass "ED-7 Editor tasks has its reader (→implement); Visual regression has no reader left"
else
    fail "ED-7 setting/reader drift:$ED7_WHY"
fi

# (ED-8) The engine vocabulary itself. `{{` must be ZERO: installEngineTemplates
# writes engine templates VERBATIM (no processTemplate), so a variable would ship
# to users as literal `{{engine_name}}`.
ED8_WHY=""
if [[ -f "$ED_PLAN_TPL" && -s "$ED_PLAN_TPL" ]]; then
    for marker in '§1' '§2' '§3' '§4' '§5' '§6'; do
        grep -qF "$marker" "$ED_PLAN_TPL" || ED8_WHY+=" missing:$marker"
    done
    grep -qF '{{' "$ED_PLAN_TPL" && ED8_WHY+=" has-template-vars"
else
    ED8_WHY+=" missing-or-empty"
fi
if [[ -z "$ED8_WHY" ]]; then
    pass "ED-8 unikit-plan/UNITY_RULES.md present, §1…§6 markers, zero {{ }} vars"
else
    fail "ED-8 unikit-plan/UNITY_RULES.md drift:$ED8_WHY"
fi

# (ED-9) A status that is written but never declared reads as a typo — and a verify
# that does not know it treats deliberately user-owned work as a failed gate.
ED9_WHY=""
grep -qF '⏸️ MANUAL' "$EM_IMPLEMENT_SKILL"  || ED9_WHY+=" implement"
grep -qF '⏸️ MANUAL' "$UNIKIT_VERIFY_SKILL" || ED9_WHY+=" verify"
if [[ -z "$ED9_WHY" ]]; then
    pass "ED-9 ⏸️ MANUAL declared in BOTH unikit-implement and unikit-verify"
else
    fail "ED-9 ⏸️ MANUAL missing in:$ED9_WHY"
fi

# (ED-10) unikit-improve is the THIRD writer of tasks. Without it the first
# /unikit-improve run silently returns the plan to the pre-Editor format.
if grep -qF 'Editor:' "$UNIKIT_IMPROVE_SKILL"; then
    pass "ED-10 Editor: known to unikit-improve (third task writer)"
else
    fail "ED-10 unikit-improve/SKILL.md does not mention Editor:"
fi

# (ED-11) The parallel path. Guard the WORKER, not the coordinator: the worker
# executes, so its branch is where a silent regression lands — an editor task in
# parallel would be applied as a plain file edit, bypassing both `direct` gates.
ED11_WHY=""
grep -qF 'Editor:' "$ED_IMPLEMENT_WORKER"     || ED11_WHY+=" Editor:"
grep -qF '⏸️ MANUAL' "$ED_IMPLEMENT_WORKER"  || ED11_WHY+=" ⏸️MANUAL"
if [[ -z "$ED11_WHY" ]]; then
    pass "ED-11 Editor: + ⏸️ MANUAL present in unikit-implement-worker.md"
else
    fail "ED-11 parallel path unaware of editor targets:$ED11_WHY"
fi

# (ED-14) The schema replacement. The old ED-14 asserted that every tool named in a
# shard kind table was granted to that server; both the table and the shard are gone, and
# with them the only construction this layer had for naming tools. What replaces it is the
# KEY of the surviving table: every row of a rules-tree check table is filed under an
# `area`, and an area outside the 12-word vocabulary is unreachable by construction —
# executors grep their own `kind` plus the cross-cutting set and would never see the row.
# Directory-scoped over every rules tree, so the next server added is covered without an
# edit here. The empty-set branch FAILS: a vacuous loop is how this guard would retire
# itself the day someone moves the tree.
ED14_WHY=""
ED14_SEEN=0
for rt_index in "$ROOT_DIR"/mcp/*/rules/*/INDEX.md; do
    [[ -f "$rt_index" ]] || continue
    ED14_SEEN=$((ED14_SEEN + 1))
    rt_id="$(basename "$(dirname "$rt_index")")"
    while IFS= read -r rt_area; do
        [[ -n "$rt_area" ]] || continue
        rt_known=0
        for rt_known_area in "${RT_AREAS[@]}"; do
            [[ "$rt_area" == "$rt_known_area" ]] && rt_known=1 && break
        done
        [[ $rt_known -eq 1 ]] || ED14_WHY+=" $rt_id:$rt_area"
    done < <(rt_table_column "$rt_index" '## Check' 2)
done
if [[ $ED14_SEEN -eq 0 ]]; then
    fail "ED-14 no mcp/*/rules/*/INDEX.md found — the guard has no object left"
elif [[ -z "$ED14_WHY" ]]; then
    pass "ED-14 every check-table area is one of the 12 ($ED14_SEEN rules tree(s) scanned)"
else
    fail "ED-14 check-table area outside the 12-word vocabulary:$ED14_WHY"
fi

# ─────────────────────────────────────────────
# Content guards on the layer A and layer C additions (LA-7, LA-8, ED-15)
# ─────────────────────────────────────────────
# These three sit here rather than inside their own families for one mechanical reason:
# they read path vars declared with the EM and ED families above (EM_FIX_SKILL, ED_PLAN_TPL),
# and `set -u` makes forward references fatal. The prefix names what a guard watches, not
# where it lives.
#
# What they watch: the texts Phase 2 added live in files nothing parses. A renamed heading
# is not an error — it silently returns nothing, and a reader that finds nothing carries on
# with every right it had. Anchors are therefore chosen by FORMULATION, never by heading:
# a heading gets rewritten during cosmetics, a formulation only together with its meaning.
# Same reasoning that put RT-6 on a sentence instead of a section name.

# (LA-7) D4 exists and sits BELOW the lazy-read boundary — asserted by the marker's line
# number, the way LA-6 does it. The negative half matters more than the positive one: a
# section that drifts above the marker is read on every Bootstrap by every pipeline skill,
# the budget decision 2 protects is spent, and nothing else in the suite would notice.
# Both anchors are FORMULATIONS and neither is the heading: a formulation proves the
# section exists, where it sits and that it did not leak, all three at once, while a
# heading anchor would additionally fail on a rename that changed nothing.
LA7_ANCHORS=('A group is a list, not a script' 'Validation and mutation are two calls.')
LA7_WHY=""
if ! grep -qF "$LA_BOUNDARY" "$LA_DEV_PRINCIPLES"; then
    LA7_WHY+=" boundary-marker-missing"
else
    LA7_BLINE=$(grep -nF "$LA_BOUNDARY" "$LA_DEV_PRINCIPLES" | head -1 | cut -d: -f1)
    LA7_ABOVE=$(head -n "$LA7_BLINE" "$LA_DEV_PRINCIPLES")
    LA7_BELOW=$(tail -n +"$LA7_BLINE" "$LA_DEV_PRINCIPLES")
    for la7_anchor in "${LA7_ANCHORS[@]}"; do
        echo "$LA7_BELOW" | grep -qF "$la7_anchor" || LA7_WHY+=" not-below:${la7_anchor// /-}"
        echo "$LA7_ABOVE" | grep -qF "$la7_anchor" && LA7_WHY+=" leaked-above:${la7_anchor// /-}"
    done
fi
if [[ -z "$LA7_WHY" ]]; then
    pass "LA-7 D4 (group call) present and below the lazy-read boundary, no anchor above it"
else
    fail "LA-7 D4 placement drift in dev-principles.md:$LA7_WHY"
fi

# (LA-8) The other half of the same layer-A delivery, the half that landed in a skill
# consumer rather than in dev-principles.md: the diagnostic ladder and the diagnosis output
# contract in /unikit-fix. The `Unverified` field gets its own anchor because it is the one
# that goes first — it is the only field of the six that looks optional, and dropping it
# turns a hypothesis into an established fact for whoever implements the fix.
LA8_ANCHORS=(
    'cheapest deterministic signal first, most expensive probe last'   # the ladder, by its ordering claim
    'The diagnosis contract — six fields'                             # the contract, by its own count
    '**Unverified:** what remained a hypothesis'                      # the field
    '**This field is never empty.**'                                  # and the rule that keeps it filled
)
LA8_WHY=""
for la8_anchor in "${LA8_ANCHORS[@]}"; do
    grep -qF "$la8_anchor" "$EM_FIX_SKILL" || LA8_WHY+=" ${la8_anchor// /-}"
done
if [[ -z "$LA8_WHY" ]]; then
    pass "LA-8 diagnostic ladder + diagnosis contract (incl. Unverified) present in unikit-fix"
else
    fail "LA-8 anchor MISSING in skills/unikit-fix/SKILL.md:$LA8_WHY"
fi

# (ED-15) Layer C — the two §4 rules Phase 2 added, plus the coherence of the three
# counters §4 carries. A hard count ("§4 has seven rules") would break on every future
# edit; coherence breaks only when the numbers disagree with the body, which is the one
# failure that has no detector at all today. The intro numeral, the number of numbered
# rules and the numeral in "All … rules above pass" must be the same, and the ordinal that
# follows it exactly one greater.
ed15_word_to_num() {
    case "$1" in
        one|One|first|First)             echo 1 ;;
        two|Two|second|Second)           echo 2 ;;
        three|Three|third|Third)         echo 3 ;;
        four|Four|fourth|Fourth)         echo 4 ;;
        five|Five|fifth|Fifth)           echo 5 ;;
        six|Six|sixth|Sixth)             echo 6 ;;
        seven|Seven|seventh|Seventh)     echo 7 ;;
        eight|Eight|eighth|Eighth)       echo 8 ;;
        nine|Nine|ninth|Ninth)           echo 9 ;;
        ten|Ten|tenth|Tenth)             echo 10 ;;
        eleven|Eleven|eleventh|Eleventh) echo 11 ;;
        twelve|Twelve|twelfth|Twelfth)   echo 12 ;;
        *)                               echo 0 ;;
    esac
}
ED15_ANCHORS=(
    "The input-infrastructure object gets its own \`Editor:\` target."   # §4.6
    "The owner of a UI element's geometry is named in \`<target>\`."     # §4.7
)
ED15_WHY=""
if [[ ! -f "$ED_PLAN_TPL" ]]; then
    ED15_WHY+=" template-missing"
else
    for ed15_anchor in "${ED15_ANCHORS[@]}"; do
        grep -qF "$ed15_anchor" "$ED_PLAN_TPL" || ED15_WHY+=" rule-missing:${ed15_anchor:0:24}"
    done
    ED15_SECTION=$(awk '/^## §5 /{exit} /^## §4 /{inside=1} inside{print}' "$ED_PLAN_TPL")
    ED15_INTRO_WORD=$(echo "$ED15_SECTION" | awk '/traps that must be resolved/{print $1; exit}')
    ED15_PASS_WORD=$(echo "$ED15_SECTION" | grep -oE 'All [A-Za-z]+ rules above pass' | head -1 | awk '{print $2}' || true)
    ED15_NEXT_WORD=$(echo "$ED15_SECTION" | grep -oE 'An? [A-Za-z]+ may join them' | head -1 | awk '{print $2}' || true)
    ED15_COUNT=$(echo "$ED15_SECTION" | grep -cE '^[0-9]+\. ' || true)
    ED15_INTRO_N=$(ed15_word_to_num "${ED15_INTRO_WORD:-}")
    ED15_PASS_N=$(ed15_word_to_num "${ED15_PASS_WORD:-}")
    ED15_NEXT_N=$(ed15_word_to_num "${ED15_NEXT_WORD:-}")
    [[ $ED15_COUNT -gt 0 ]] || ED15_WHY+=" no-numbered-rules-in-§4"
    [[ $ED15_INTRO_N -eq $ED15_COUNT ]] || ED15_WHY+=" intro(${ED15_INTRO_WORD:-?}=$ED15_INTRO_N)≠rules($ED15_COUNT)"
    [[ $ED15_PASS_N  -eq $ED15_COUNT ]] || ED15_WHY+=" all-pass(${ED15_PASS_WORD:-?}=$ED15_PASS_N)≠rules($ED15_COUNT)"
    [[ $ED15_NEXT_N  -eq $((ED15_COUNT + 1)) ]] || ED15_WHY+=" next(${ED15_NEXT_WORD:-?}=$ED15_NEXT_N)≠rules+1($((ED15_COUNT + 1)))"
fi
if [[ -z "$ED15_WHY" ]]; then
    pass "ED-15 both new §4 rules present; intro / body / closing counters coherent ($ED15_COUNT rules)"
else
    fail "ED-15 §4 drift in UNITY_RULES.md:$ED15_WHY"
fi

# ─────────────────────────────────────────────
# RT: rules-tree + recheck-notes form (RT-1…RT-6)
# ─────────────────────────────────────────────
# The rules tree and the notes file of a project are read by grep, section by section, by
# five different callers. Nothing parses them, so a renamed heading does not error — it
# silently returns nothing, and a reader that finds nothing proceeds with every right it
# had. That failure is indistinguishable from a well-behaved server, which is exactly why
# the shape needs a guard and the content does not.
# All -qF and file-scoped (MSYS grep aborts on -iF).
RT_NOTES_SPEC="$ROOT_DIR/skills/unikit-mcp-trap/references/notes-format.md"
RT_HEADINGS=('## Access' '## Live failure classes' '## Shape and cost' '## Check'
             '## Irreversible' '## Lane' '## When this file is silent')

# (RT-1) The seven headings of an INDEX.md. Six of them are reached by grep at Bootstrap
# or per task; a heading that drifted its title reads back as "this server has nothing to
# say about that", which is the one wrong answer this file exists to prevent.
RT1_WHY=""
RT1_SEEN=0
for rt_index in "$ROOT_DIR"/mcp/*/rules/*/INDEX.md; do
    [[ -f "$rt_index" ]] || continue
    RT1_SEEN=$((RT1_SEEN + 1))
    rt_id="$(basename "$(dirname "$rt_index")")"
    for rt_heading in "${RT_HEADINGS[@]}"; do
        # -x, not a substring match: `## Irreversible writes` still contains `## Irreversible`,
        # and a heading that grew a suffix is exactly the drift a grep-addressed file dies of.
        grep -qxF "$rt_heading" "$rt_index" || RT1_WHY+=" $rt_id:${rt_heading// /-}"
    done
done
if [[ $RT1_SEEN -eq 0 ]]; then
    fail "RT-1 no mcp/*/rules/*/INDEX.md found — the guard has no object left"
elif [[ -z "$RT1_WHY" ]]; then
    pass "RT-1 all seven INDEX.md headings present ($RT1_SEEN rules tree(s) scanned)"
else
    fail "RT-1 INDEX.md heading MISSING:$RT1_WHY"
fi

# (RT-2) The `Live failure classes` rows are a projection of the closed taxonomy in layer
# A, not a free-text list. A row whose class name drifted is worse than an absent row: the
# executor greps the nine names it knows, misses this one, and reads the server as clean
# of a class the profile was written to flag. Reuses LA_CLASSES — a second copy of the
# nine names is exactly the drift a closed taxonomy exists to make impossible.
RT2_WHY=""
for rt_index in "$ROOT_DIR"/mcp/*/rules/*/INDEX.md; do
    [[ -f "$rt_index" ]] || continue
    rt_id="$(basename "$(dirname "$rt_index")")"
    while IFS= read -r rt_class; do
        [[ -n "$rt_class" ]] || continue
        rt_known=0
        for rt_known_class in "${LA_CLASSES[@]}"; do
            [[ "$rt_class" == "$rt_known_class" ]] && rt_known=1 && break
        done
        [[ $rt_known -eq 1 ]] || RT2_WHY+=" $rt_id:${rt_class// /-}"
    done < <(rt_table_column "$rt_index" '## Live failure classes' 1)
done
if [[ -z "$RT2_WHY" ]]; then
    pass "RT-2 every Live-failure-classes row is one of the nine taxonomy names"
else
    fail "RT-2 failure class outside the taxonomy of nine:$RT2_WHY"
fi

# (RT-3) The notes format, asserted on the canonical example inside the spec rather than
# on its prose. That example is what both skills copy from, and it is the one object in
# the repository shaped like a real notes file. Two sections because there are two readers
# (executors grep the check table, the audit replays the protocol); two header fields
# because `server:` is what tells a finding about THIS server from one inherited from
# another, and `audited:` is the cursor trap reads to decide which plans are new. A third
# field, `version:`, used to sit between them and was dropped: it was copied out of the
# delivery stamp the package writes, so the comparison it fed had the same constant on
# both sides and could never fire for the reason it existed.
RT3_SHAPE="$(awk '/^```markdown$/{f=1;next} f&&/^```$/{exit} f' "$RT_NOTES_SPEC" 2>/dev/null || true)"
RT3_WHY=""
if [[ -z "$RT3_SHAPE" ]]; then
    RT3_WHY+=" shape-example-missing"
else
    for rt_section in '## Check' '## Observation protocol'; do
        echo "$RT3_SHAPE" | grep -qF "$rt_section" || RT3_WHY+=" section:${rt_section// /-}"
    done
    for rt_field in 'server:' 'audited:'; do
        echo "$RT3_SHAPE" | grep -qF "$rt_field" || RT3_WHY+=" header:$rt_field"
    done
    echo "$RT3_SHAPE" | grep -qE '^version:' && RT3_WHY+=" header:version-returned"
fi
if [[ -z "$RT3_WHY" ]]; then
    pass "RT-3 notes shape: two sections + server:/audited: header, no version"
else
    fail "RT-3 notes shape drift in notes-format.md:$RT3_WHY"
fi

# (RT-4) Genre, on the same example. A note may carry a CHECK and nothing else: a lifted
# gate written into a note removes an obligation for good, and `⏸️ MANUAL` written into
# one hands away a whole capability on a finding that was only ever about one call. Both
# read as helpful, and both are the failure this file exists to avoid — which is why the
# ban is asserted on the example every author copies, not merely stated in the prose above
# it. The prose table naming these two as forbidden is deliberately out of scope: it IS
# the ban, and greping it would make stating the rule indistinguishable from breaking it.
# The area check runs here too — a note filed under an unknown area is unreachable for the
# same reason a bad INDEX row is (ED-14).
RT4_WHY=""
if [[ -z "$RT3_SHAPE" ]]; then
    RT4_WHY+=" shape-example-missing"
else
    echo "$RT3_SHAPE" | grep -qF 'GATE LIFTED' && RT4_WHY+=" gate-lifted-in-a-note"
    echo "$RT3_SHAPE" | grep -qF '⏸️ MANUAL'   && RT4_WHY+=" manual-in-a-note"
    RT4_SHAPE_FILE="$(mktemp)"
    printf '%s\n' "$RT3_SHAPE" > "$RT4_SHAPE_FILE"
    while IFS= read -r rt_area; do
        [[ -n "$rt_area" ]] || continue
        rt_known=0
        for rt_known_area in "${RT_AREAS[@]}"; do
            [[ "$rt_area" == "$rt_known_area" ]] && rt_known=1 && break
        done
        [[ $rt_known -eq 1 ]] || RT4_WHY+=" area:$rt_area"
    done < <(rt_table_column "$RT4_SHAPE_FILE" '## Check' 2)
    rm -f "$RT4_SHAPE_FILE"
fi
if [[ -z "$RT4_WHY" ]]; then
    pass "RT-4 notes genre: check-only, no lifted gate, no ⏸️ MANUAL, areas within the 12"
else
    fail "RT-4 notes genre violation in the notes-format.md example:$RT4_WHY"
fi

# (RT-5) The notes file is the accumulated knowledge of the project, and the only right
# the installer has over it is to RENAME it when the selected server changes. The day some
# installer module starts writing its content, the contract inverts silently: an `update`
# would begin overwriting findings that cost a human a live editor to produce. The
# resolver `mcpRecheckNotesPath(` is the mechanical handle on that — it may appear only
# where it is declared and inside the swap module that owns the rename.
RT5_HITS="$(grep -rln 'mcpRecheckNotesPath(' "$ROOT_DIR/src" --include='*.ts' 2>/dev/null || true)"
RT5_WHY=""
while IFS= read -r rt_file; do
    [[ -n "$rt_file" ]] || continue
    case "$(basename "$rt_file")$(dirname "$rt_file" | sed 's|.*/||')" in
        # The declaration, the swap module that owns the rename — and the MCP
        # MIGRATION, which is the one thing here that is not the installer. It
        # rewrites the `server:` header when a file id is renamed under the
        # project's feet; leaving that line stale makes every pipeline skill
        # print "notes header ≠ configured server" forever, and nothing but a
        # human can clear it. The exception is narrow by construction: a
        # migration runs once per project and writes no findings.
        constants.ts*|mcp-notes.ts*|index.tsmcp-migrations) ;;
        *) RT5_WHY+=" $(basename "$rt_file")" ;;
    esac
done <<< "$RT5_HITS"
if [[ -z "$RT5_WHY" ]]; then
    pass "RT-5 mcpRecheckNotesPath( confined to constants.ts + mcp-notes.ts (rename only)"
else
    fail "RT-5 the installer reaches the notes file outside the swap step:$RT5_WHY"
fi

# (RT-6) Invariant 3, in the files that EXECUTE it. "No rules" must never resolve to
# `⏸️ MANUAL`: that status is for one situation only — there is no route, and that was
# established by trying. Asserted as the POSITIVE sentence rather than as the absence of a
# linkage, because absence is also what an empty file has, and this rule has to be stated
# where the decision gets taken. One shared anchor across all five, so drift in any single
# executor fails rather than quietly leaving four correct files to vouch for a fifth.
RT6_ANCHOR='never disables the engine MCP and never turns a target into `⏸️ MANUAL`'
RT6_WHY=""
grep -qF "$RT6_ANCHOR" "$ED_IMPLEMENT_WORKER" || RT6_WHY+=" implement-worker"
grep -qF "$RT6_ANCHOR" "$EM_IMPLEMENT_SKILL"  || RT6_WHY+=" implement"
grep -qF "$RT6_ANCHOR" "$EM_FIX_SKILL"        || RT6_WHY+=" fix"
grep -qF "$RT6_ANCHOR" "$EM_DEVCONTEXT_SKILL" || RT6_WHY+=" devcontext"
grep -qF "$RT6_ANCHOR" "$UNIKIT_VERIFY_SKILL" || RT6_WHY+=" verify"
if [[ -z "$RT6_WHY" ]]; then
    pass "RT-6 invariant 3 (absence never means ⏸️ MANUAL) stated in all four skills + the worker"
else
    fail "RT-6 invariant 3 MISSING in:$RT6_WHY"
fi

# ─────────────────────────────────────────────
# RT-7…RT-10: the distilled tree, guarded against turning back into a registry
# ─────────────────────────────────────────────
# All four watch one failure with four faces: a key that disagrees with its own row, an
# obligation lifted before anyone tried, a file that grew past its budget, a phrase that
# was measured going false. An empty target set is a FAIL and not a silent pass — there is
# exactly one rules tree today, the loop goes empty on the first directory move, and that
# is precisely when a green result is worth the least. Same convention ED-14 and RT-1 use.
RT9_BUDGET=130
RT10_TOKENS=('no silent no-ops' '✅ working' 'Strengths' 'instead of')

# (RT-7) The check table is reached by grepping the `area` key, and ED-14 asserts only that
# the key belongs to the 12-word vocabulary. A row whose id prefix disagrees with its own
# area (`ui-3 | scene | …`) passes ED-14 and is then missed by every caller that greps its
# own area — unreachable exactly when it is needed. Three assertions: the table is not
# empty, ids are unique, and the id prefix is the area.
RT7_WHY=""
RT7_SEEN=0
for rt_index in "$ROOT_DIR"/mcp/*/rules/*/INDEX.md; do
    [[ -f "$rt_index" ]] || continue
    RT7_SEEN=$((RT7_SEEN + 1))
    rt_id="$(basename "$(dirname "$rt_index")")"
    RT7_ROW_IDS=()
    RT7_ROW_AREAS=()
    while IFS= read -r rt_cell; do RT7_ROW_IDS+=("$rt_cell"); done < <(rt_table_column "$rt_index" '## Check' 1)
    while IFS= read -r rt_cell; do RT7_ROW_AREAS+=("$rt_cell"); done < <(rt_table_column "$rt_index" '## Check' 2)
    if [[ ${#RT7_ROW_IDS[@]} -eq 0 ]]; then
        RT7_WHY+=" $rt_id:check-table-empty"
        continue
    fi
    RT7_TAKEN=" "
    for rt_i in "${!RT7_ROW_IDS[@]}"; do
        rt_row_id="${RT7_ROW_IDS[$rt_i]}"
        rt_row_area="${RT7_ROW_AREAS[$rt_i]:-<missing>}"
        case "$RT7_TAKEN" in
            *" $rt_row_id "*) RT7_WHY+=" $rt_id:duplicate-id($rt_row_id)" ;;
            *)               RT7_TAKEN+="$rt_row_id " ;;
        esac
        [[ "${rt_row_id%%-*}" == "$rt_row_area" ]] || RT7_WHY+=" $rt_id:prefix≠area($rt_row_id|$rt_row_area)"
    done
done
if [[ $RT7_SEEN -eq 0 ]]; then
    fail "RT-7 no mcp/*/rules/*/INDEX.md found — the guard has no object left"
elif [[ -z "$RT7_WHY" ]]; then
    pass "RT-7 check table non-empty, ids unique, id prefix == area ($RT7_SEEN rules tree(s) scanned)"
else
    fail "RT-7 check-table key drift:$RT7_WHY"
fi

# (RT-8) Zero `GATE LIFTED` in any INDEX.md — symmetric to RT-4, which guards the same
# thing in the notes. A gate lifted in advance lifts the obligation permanently and for
# everyone, while lifting is a runtime verdict of /unikit-verify. EM-3 requires the
# sentence that says so to be present in verification.md; the presence of that caveat in
# one file is not the absence of a pre-lifted gate in another, which is why this check is
# separate and points elsewhere.
RT8_WHY=""
for rt_index in "$ROOT_DIR"/mcp/*/rules/*/INDEX.md; do
    [[ -f "$rt_index" ]] || continue
    rt_id="$(basename "$(dirname "$rt_index")")"
    while IFS= read -r rt_hit; do
        [[ -n "$rt_hit" ]] && RT8_WHY+=" $rt_id:line-${rt_hit%%:*}"
    done < <(grep -nF 'GATE LIFTED' "$rt_index" || true)
done
if [[ -z "$RT8_WHY" ]]; then
    pass "RT-8 no pre-lifted gate in any rules-tree INDEX.md"
else
    fail "RT-8 GATE LIFTED written in advance:$RT8_WHY"
fi

# (RT-9) The budget. 130 lines is not a style rule: it is the only thing between an
# amendment and the 160-line tool catalog it replaced, which otherwise returns one row at
# a time with nothing noticing until it is whole again.
RT9_WHY=""
RT9_SEEN=0
for rt_index in "$ROOT_DIR"/mcp/*/rules/*/INDEX.md; do
    [[ -f "$rt_index" ]] || continue
    RT9_SEEN=$((RT9_SEEN + 1))
    rt_id="$(basename "$(dirname "$rt_index")")"
    RT9_LEN=$(wc -l < "$rt_index" | tr -d '[:space:]')
    [[ $RT9_LEN -le $RT9_BUDGET ]] || RT9_WHY+=" $rt_id:${RT9_LEN}>${RT9_BUDGET}"
done
if [[ $RT9_SEEN -eq 0 ]]; then
    fail "RT-9 no mcp/*/rules/*/INDEX.md found — the guard has no object left"
elif [[ -z "$RT9_WHY" ]]; then
    pass "RT-9 every INDEX.md within the $RT9_BUDGET-line budget ($RT9_SEEN rules tree(s) scanned)"
else
    fail "RT-9 INDEX.md over budget:$RT9_WHY"
fi

# (RT-10) Genre tokens, measured rather than imagined: the first three stood verbatim in
# the retired biome shard and every one of them went false within four weeks — a claim
# about server state has a shelf life, a check does not. The fourth is the "instead of X
# use Y" shape, forbidden outright by the monotonicity invariant. Scans the whole tree and
# not just INDEX.md, because verification.md is prose on the same subject.
RT10_WHY=""
RT10_SEEN=0
while IFS= read -r rt_file; do
    [[ -f "$rt_file" ]] || continue
    RT10_SEEN=$((RT10_SEEN + 1))
    for rt_token in "${RT10_TOKENS[@]}"; do
        while IFS= read -r rt_hit; do
            [[ -n "$rt_hit" ]] || continue
            RT10_WHY+=" ${rt_file#"$ROOT_DIR/"}:${rt_hit%%:*}(${rt_token// /-})"
        done < <(grep -nF "$rt_token" "$rt_file" || true)
    done
done < <(find "$ROOT_DIR"/mcp -type f -path '*/rules/*' 2>/dev/null)
if [[ $RT10_SEEN -eq 0 ]]; then
    fail "RT-10 no files under mcp/*/rules/** — the guard has no object left"
elif [[ -z "$RT10_WHY" ]]; then
    pass "RT-10 none of the four measured genre tokens in mcp/*/rules/** ($RT10_SEEN file(s) scanned)"
else
    fail "RT-10 genre token in the rules tree:$RT10_WHY"
fi

# ─────────────────────────────────────────────
# NN: the "no names" invariant — three targets, one regex
# ─────────────────────────────────────────────
# A tool name is lower_snake_case inside a backtick span; that is the only shape one takes
# in these files, and this is the only check that stops the architecture from becoming a
# tool registry again. It replaces the single-target LA-4: the invariant was never about
# dev-principles.md in particular, and layer C was measured carrying seven tool names for
# exactly as long as nothing looked at it.
#
# The regex does NOT tell a server tool name from a snake_case ENGINE API or a config key,
# and both live legitimately in layer C — so the guard carries a written allowlist, one
# entry per token with the reason it is allowed. That is monotone: the allowlist adds an
# obligation to explain a new token, it never removes the check. A target whose allowlist
# is empty keeps zero tolerance. Every hit is printed WITH its file and line, because
# "engine API or tool name?" cannot be decided from a count.
NN_RE='`[a-z][a-z0-9]*_[a-z0-9_]*'
# token            why it is allowed
NN_ALLOW=(
    add_child      # Godot Node API
    add_to_group   # Godot Node API
    call_deferred  # Godot Object API
    class_name     # GDScript keyword
    co_await       # C++ coroutine keyword (UE5)
    emit_signal    # Godot Object API
    export_presets # Godot export config file name
    get_node       # Godot Node API
    get_service    # ServiceLocator method, GDScript naming convention
    get_tree       # Godot Node API
    load_threaded  # Godot ResourceLoader API
    m_             # Unity serialized-file key prefix (m_EditorVersion)
    set_process    # Godot Node API
    test_          # GUT test-file naming convention (test_*.gd)
)

# Prints "file:line:`token" for every backticked lower-snake token outside the allowlist.
nn_scan() {
    local hit token known allowed
    { grep -rnoE "$NN_RE" "$@" 2>/dev/null || true; } | while IFS= read -r hit; do
        token="${hit##*\`}"
        allowed=0
        for known in "${NN_ALLOW[@]}"; do
            [[ "$token" == "$known" ]] && allowed=1 && break
        done
        [[ $allowed -eq 1 ]] || echo "$hit"
    done
}

# (NN-1) The rules trees. Empty allowlist in practice: a server profile is the ONE place a
# name would be most tempting and shortest-lived — the whole architecture rests on these
# files carrying checks rather than a catalog.
NN1_TARGETS=()
for rt_rule_file in "$ROOT_DIR"/mcp/*/rules/*/*.md; do
    [[ -f "$rt_rule_file" ]] || continue
    NN1_TARGETS+=("$rt_rule_file")
done
if [[ ${#NN1_TARGETS[@]} -eq 0 ]]; then
    fail "NN-1 no mcp/*/rules/**/*.md found — the guard has no object left"
else
    NN1_HITS="$(nn_scan "${NN1_TARGETS[@]}")"
    if [[ -z "$NN1_HITS" ]]; then
        pass "NN-1 rules trees carry no backticked lower-snake token (no tool names)"
    else
        fail "NN-1 a rules tree names tools:"
        echo "$NN1_HITS" | head -5
    fi
fi

# (NN-2) Layer A. Zero tolerance, empty allowlist — dev-principles.md is read on every
# Bootstrap by five skills, so a name here reaches every pipeline run in the project.
NN2_HITS="$(nn_scan "$LA_DEV_PRINCIPLES")"
if [[ -z "$NN2_HITS" ]]; then
    pass "NN-2 dev-principles.md carries no backticked lower-snake token (no tool names)"
else
    fail "NN-2 dev-principles.md names tools:"
    echo "$NN2_HITS" | head -5
fi

# (NN-3) Layer C. The allowlist above is spent almost entirely here: engine templates are
# the one shipped surface where snake_case is legitimate, because GDScript and the Unity
# serialized formats use it. `references/` is excluded from the Part 7c stop-word scan and
# engine stop-words are ALLOWED in an engine template anyway, so before this guard nothing
# looked at layer C at all — which is how seven tool names accumulated in one table there.
NN3_HITS="$(nn_scan "$ROOT_DIR/data/engine-templates")"
if [[ -z "$NN3_HITS" ]]; then
    pass "NN-3 engine templates carry no un-allowlisted lower-snake token (no tool names)"
else
    fail "NN-3 engine template names a tool (or a new API token needs an allowlist entry):"
    echo "$NN3_HITS" | head -5
fi

# (NN-4) The rules registry — the fourth surface, and the only one this repository does not
# author. A different detector from NN-1…NN-3 on purpose: a rule is user-facing knowledge
# where snake_case is ordinary (GDScript APIs, serialized-format keys), so the backticked-
# token regex would need an allowlist the size of the corpus. `mcp__` is unambiguous — the
# string can only be a grant name — and it is exactly the shape that rots. The middle
# segment of that prefix is a VENDOR CODE, chosen per server since 2.0.0, so a rule naming
# one is wrong for every user who picked a different server of the same engine.
#
# Measured: `code/unity/core/testing.md` shipped `mcp__UnityMCP__run_tests`, correct only by
# accident — biome and coplay were made to share one key, and the moment that ended the rule
# started instructing biome users to call a server that is not theirs. Rules are copied into
# projects VERBATIM (processTemplate never runs on them) and sync by their own version, so
# nothing downstream can repair the name.
#
# Scope is the delivered content (`code/`, `gamedesign/`), not the registry's own README and
# docs — those describe the mechanism legitimately and never reach a project. The registry is
# a gitignored CLONE refreshed by scripts/download-rules.sh, so a failure here is fixed
# upstream in NintendaDev/unikit-ai-rules and clears once the snapshot is refreshed.
NN4_ROOT="$ROOT_DIR/rules-registry"
NN4_TARGETS=()
for nn4_tier_dir in "$NN4_ROOT/code" "$NN4_ROOT/gamedesign"; do
    [[ -d "$nn4_tier_dir" ]] && NN4_TARGETS+=("$nn4_tier_dir")
done
if [[ ${#NN4_TARGETS[@]} -eq 0 ]]; then
    fail "NN-4 no rules-registry/{code,gamedesign} found — the guard has no object left (run scripts/download-rules.sh)"
else
    NN4_HITS="$({ grep -rnF 'mcp__' "${NN4_TARGETS[@]}" --include='*.md' 2>/dev/null || true; })"
    if [[ -z "$NN4_HITS" ]]; then
        pass "NN-4 registry rules name no MCP tool (no mcp__ grant prefix in delivered rule content)"
    else
        fail "NN-4 a registry rule names an MCP tool — fix upstream in NintendaDev/unikit-ai-rules:"
        echo "$NN4_HITS" | head -5
    fi
fi

# ─────────────────────────────────────────────
# Part 7: Codebase integrity checks
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== Codebase integrity checks ===${NC}\n"

# No dotted name: fields in skills
DOTTED_NAMES=$(grep -r 'name: unikit\.' "$ROOT_DIR/skills/" --include='*.md' 2>/dev/null | wc -l | tr -d ' ' || true)
if [[ "$DOTTED_NAMES" -eq 0 ]]; then
    pass "no dotted name: fields in skills/"
else
    fail "found $DOTTED_NAMES dotted name: fields in skills/"
fi

# No dotted /unikit. invocations in markdown
DOTTED_REFS=$(grep -rE "(^|[[:space:]\`\"(>])/unikit\\.[a-z]" "$ROOT_DIR/skills/" "$ROOT_DIR/docs/" "$ROOT_DIR/README.md" "$ROOT_DIR/AGENTS.md" --include='*.md' 2>/dev/null | grep -v 'unikit\.json' | grep -v 'unikit\.js' | wc -l | tr -d ' ' || true)
if [[ "$DOTTED_REFS" -eq 0 ]]; then
    pass "no dotted /unikit.xxx invocations in docs"
else
    fail "found $DOTTED_REFS dotted invocations in docs"
fi

# ─────────────────────────────────────────────
# Part 7a2: self_name validation in RULES_INDEX directives
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== self_name validation ===${NC}\n"

SELF_NAME_ERRORS=0

# Skills/subagents with "RULES_INDEX.md" + "instructions for" must use {{self_name}}
for skill_dir in "$ROOT_DIR"/skills/*/; do
    skill_name=$(basename "$skill_dir")
    SKILL_FILE="$skill_dir/SKILL.md"
    [[ ! -f "$SKILL_FILE" ]] && continue

    if grep -q 'RULES_INDEX\.md' "$SKILL_FILE" && grep -q 'instructions for' "$SKILL_FILE"; then
        if ! grep -q '{{self_name}}' "$SKILL_FILE"; then
            fail "$skill_name — has RULES_INDEX directive but missing {{self_name}}"
            SELF_NAME_ERRORS=$((SELF_NAME_ERRORS + 1))
        fi
    fi
done

for agent_file in "$ROOT_DIR"/subagents/*.md; do
    [[ ! -f "$agent_file" ]] && continue
    agent_name=$(basename "$agent_file" .md)

    if grep -q 'RULES_INDEX\.md' "$agent_file" && grep -q 'instructions for' "$agent_file"; then
        if ! grep -q '{{self_name}}' "$agent_file"; then
            fail "$agent_name — has RULES_INDEX directive but missing {{self_name}}"
            SELF_NAME_ERRORS=$((SELF_NAME_ERRORS + 1))
        fi
    fi
done

if [[ $SELF_NAME_ERRORS -eq 0 ]]; then
    pass "all RULES_INDEX directives use {{self_name}}"
fi

# ─────────────────────────────────────────────
# Part 7b: YAML list format enforcement
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== YAML list format enforcement ===${NC}\n"

YAML_ERRORS=0

# Skills: allowed-tools must use list format (no inline)
for skill_dir in "$ROOT_DIR"/skills/*/; do
    skill_name=$(basename "$skill_dir")
    SKILL_FILE="$skill_dir/SKILL.md"
    [[ ! -f "$SKILL_FILE" ]] && continue

    if grep -qE '^allowed-tools: .+' "$SKILL_FILE" 2>/dev/null; then
        fail "$skill_name — allowed-tools uses inline format (must be YAML list)"
        YAML_ERRORS=$((YAML_ERRORS + 1))
    fi
done

# Subagents: tools must use list format (no inline)
for agent_file in "$ROOT_DIR"/subagents/*.md; do
    [[ ! -f "$agent_file" ]] && continue
    agent_name=$(basename "$agent_file" .md)

    if grep -qE '^tools: .+' "$agent_file" 2>/dev/null; then
        fail "$agent_name — tools uses inline format (must be YAML list)"
        YAML_ERRORS=$((YAML_ERRORS + 1))
    fi
done

if [[ $YAML_ERRORS -eq 0 ]]; then
    pass "all frontmatter tool fields use YAML list format"
fi

# ─────────────────────────────────────────────
# Part 7c: Engine stop words enforcement
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== Engine stop words enforcement ===${NC}\n"

STOPWORD_ERRORS=0

# Scan skills/*/SKILL.md and subagents/*.md (skip references/)
SCAN_FILES=()
for skill_dir in "$ROOT_DIR"/skills/*/; do
    sf="$skill_dir/SKILL.md"
    [[ -f "$sf" ]] && SCAN_FILES+=("$sf")
done
for af in "$ROOT_DIR"/subagents/*.md; do
    [[ -f "$af" ]] && SCAN_FILES+=("$af")
done

STOP_PATTERNS='\bUnity\b|\bGodot\b|\bUnreal\b|\bGDScript\b|(^| )C# |(^| )C\+\+ '

for scan_file in "${SCAN_FILES[@]}"; do
    rel_path="${scan_file#"$ROOT_DIR/"}"
    MATCHES=$(grep -nE "$STOP_PATTERNS" "$scan_file" 2>/dev/null || true)
    if [[ -n "$MATCHES" ]]; then
        while IFS= read -r match_line; do
            fail "$rel_path:$match_line"
            STOPWORD_ERRORS=$((STOPWORD_ERRORS + 1))
        done <<< "$MATCHES"
    fi
done

if [[ $STOPWORD_ERRORS -eq 0 ]]; then
    pass "no engine stop words in skills/*/SKILL.md or subagents/*.md"
fi

# ─────────────────────────────────────────────
# Part 7d: MCP allowed-tools structure validation
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== MCP allowed-tools structure validation ===${NC}\n"

for mcp_json in "$MCP_DIR"/*/; do
    for json_file in "$mcp_json"*.json; do
        [[ ! -f "$json_file" ]] && continue
        rel_name="${json_file#"$ROOT_DIR/"}"

        HAS_ALLOWED=$(json_field "$json_file" "m['allowed-tools'] ? 'yes' : 'no'" 2>/dev/null || echo "no")
        if [[ "$HAS_ALLOWED" != "yes" ]]; then
            continue
        fi

        ALLOWED_VALID=$(node -e "
          const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
          const r=m['allowed-tools'];
          if(!r||typeof r!=='object'){console.log('invalid-root');process.exit(0)}
          for(const k of ['agents','skills']){
            const section=r[k];
            if(!section||typeof section!=='object'){console.log('missing-'+k);process.exit(0)}
            for(const[name,arr]of Object.entries(section)){
              if(!Array.isArray(arr)){console.log('not-array:'+k+'.'+name);process.exit(0)}
              for(const v of arr){if(typeof v!=='string'){console.log('not-string:'+k+'.'+name);process.exit(0)}}
            }
          }
          console.log('ok');
        " "$json_file" 2>/dev/null || echo "parse-error")

        if [[ "$ALLOWED_VALID" == "ok" ]]; then
            pass "$rel_name allowed-tools structure valid"
        else
            fail "$rel_name allowed-tools structure invalid ($ALLOWED_VALID)"
        fi

        # Recipient RESOLVABILITY (not just structure). Naming a skill/subagent in
        # allowed-tools only does something if the recipient can accept an injection:
        # injectToolsIntoSkillFrontmatter returns false when the SKILL.md has no
        # `allowed-tools:` field, and injectToolsIntoAgentFrontmatter the same for a
        # subagent without `tools:` — silently, so a dead recipient is invisible
        # without this guard. That was exactly the unikit-devcontext bug.
        RECIPIENTS_WHY=""
        while IFS= read -r recipient; do
            [[ -z "$recipient" ]] && continue
            target="$ROOT_DIR/skills/$recipient/SKILL.md"
            if [[ ! -f "$target" ]]; then
                RECIPIENTS_WHY+=" skill-missing:$recipient"
            elif ! grep -qE '^allowed-tools:' "$target"; then
                RECIPIENTS_WHY+=" skill-cannot-accept:$recipient"
            fi
        done < <(json_field "$json_file" "Object.keys(m['allowed-tools'].skills||{}).join('\n')" 2>/dev/null || true)

        while IFS= read -r recipient; do
            [[ -z "$recipient" ]] && continue
            target="$ROOT_DIR/subagents/$recipient.md"
            if [[ ! -f "$target" ]]; then
                RECIPIENTS_WHY+=" subagent-missing:$recipient"
            elif ! grep -qE '^tools:' "$target"; then
                RECIPIENTS_WHY+=" subagent-cannot-accept:$recipient"
            fi
        done < <(json_field "$json_file" "Object.keys(m['allowed-tools'].agents||{}).join('\n')" 2>/dev/null || true)

        if [[ -z "$RECIPIENTS_WHY" ]]; then
            pass "$rel_name allowed-tools recipients all resolvable (exist + can accept injection)"
        else
            fail "$rel_name allowed-tools names a DEAD recipient (injection would be a silent no-op):$RECIPIENTS_WHY"
        fi

        # unikit-verify must be a recipient of every engine MCP: without it the
        # verify gates have no tools to run and Step 2.1/2.2 degrade to "unavailable".
        IS_ENGINE=$(json_field "$json_file" "m['is_engine'] === true ? 'yes' : 'no'" 2>/dev/null || echo "no")
        if [[ "$IS_ENGINE" == "yes" ]]; then
            HAS_VERIFY=$(json_field "$json_file" "(m['allowed-tools'].skills||{})['unikit-verify'] ? 'yes' : 'no'" 2>/dev/null || echo "no")
            if [[ "$HAS_VERIFY" == "yes" ]]; then
                pass "$rel_name (is_engine) grants tools to unikit-verify"
            else
                fail "$rel_name is_engine=true but allowed-tools.skills has no unikit-verify entry"
            fi
        fi

    done
done

# ─────────────────────────────────────────────
# Part 7e: All is_engine=true entries carry DISTINCT codes per engine scope
# ─────────────────────────────────────────────
# The inversion of the pre-2.0.0 rule, and it guards the same runtime check —
# `discoverMcpServers` throws on a violation, so a defect here takes down every
# `init`/`update` for that engine, not just this suite.
#
# Why it flipped: `key` became the JSON's own basename, so "all engine servers
# share one key" is now false by construction (Unity ships two, Godot three) and
# the grouping it expressed moved to the directory. What has to hold instead is
# that no two of them register under the same `code` — two entries with one code
# are one entry in the agent's settings file, and a swap could not tell which to
# remove, leaving an orphan with live grants aimed at a server that is not
# running.
echo -e "\n${BOLD}=== is_engine entries carry distinct codes per engine scope ===${NC}\n"

declare -A ENGINE_MCP_DIRS=(["unity"]="unity" ["godot"]="godot" ["godot-net"]="godot" ["unreal-engine-5"]="unreal-engine-5")
KEY_UNIQUENESS_ERRORS=0

for engine in "${!ENGINE_MCP_DIRS[@]}"; do
    mcp_dir="${ENGINE_MCP_DIRS[$engine]}"
    UNIVERSAL_DIR_PATH="$MCP_DIR/universal"
    ENGINE_DIR_PATH="$MCP_DIR/$mcp_dir"

    # Collect codes from is_engine=true entries across universal + engine directories
    RESULT=$(node -e "
      const fs = require('fs');
      const path = require('path');
      const engineCodes = [];
      const missing = [];
      for (const dir of process.argv.slice(1)) {
        if (!fs.existsSync(dir)) continue;
        for (const f of fs.readdirSync(dir)) {
          if (!f.endsWith('.json')) continue;
          try {
            const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
            if (m.is_engine !== true) continue;
            if (typeof m.code !== 'string' || !m.code) { missing.push(f); continue; }
            engineCodes.push(m.code);
          } catch {}
        }
      }
      const duplicates = [...new Set(engineCodes.filter((c, i) => engineCodes.indexOf(c) !== i))];
      if (missing.length > 0) {
        console.log('NOCODE:' + missing.join(','));
      } else if (engineCodes.length === 0) {
        console.log('NONE');
      } else if (duplicates.length === 0) {
        console.log('OK:' + engineCodes.join(','));
      } else {
        console.log('DUPLICATE:' + duplicates.join(','));
      }
    " "$UNIVERSAL_DIR_PATH" "$ENGINE_DIR_PATH" 2>/dev/null || echo "ERROR")

    if [[ "$RESULT" == OK:* ]]; then
        INFO="${RESULT#OK:}"
        pass "engine $engine: is_engine codes distinct ($INFO)"
    elif [[ "$RESULT" == NONE ]]; then
        fail "engine $engine: no is_engine=true entries found"
        KEY_UNIQUENESS_ERRORS=$((KEY_UNIQUENESS_ERRORS + 1))
    elif [[ "$RESULT" == NOCODE:* ]]; then
        FILES="${RESULT#NOCODE:}"
        fail "engine $engine: is_engine entries without a code: $FILES"
        KEY_UNIQUENESS_ERRORS=$((KEY_UNIQUENESS_ERRORS + 1))
    elif [[ "$RESULT" == DUPLICATE:* ]]; then
        CODES="${RESULT#DUPLICATE:}"
        fail "engine $engine: is_engine entries share code(s): $CODES"
        KEY_UNIQUENESS_ERRORS=$((KEY_UNIQUENESS_ERRORS + 1))
    else
        fail "engine $engine: failed to check is_engine code distinctness"
        KEY_UNIQUENESS_ERRORS=$((KEY_UNIQUENESS_ERRORS + 1))
    fi
done

# ─────────────────────────────────────────────
# Part 7e2: MT-1 / MT-2 — the `{{engine_mcp_tool}}` substitution form
# ─────────────────────────────────────────────
# The value substituted here is a VENDOR CODE, and the prose around it is read by
# an agent that has to find that code as a literal key in the settings file. Two
# counters pin the form:
#
#   MT-1  every occurrence is wrapped in backticks
#   MT-2  every wrapped occurrence carries the `MCP server ` label
#
# Written as EQUALITIES between counts, not as a search for a negation. The pair
# mechanically forbids the third form the corpus used to carry — the variable
# sitting inside a code span or a fenced block together with other words, where
# backticks cannot be added at all — without needing an allowlist: such an
# occurrence is unwrapped by construction, so MT-1 catches it.
#
# The class-B probe is why this matters beyond tidiness. A skill greps the
# settings file for the code; a code printed with a neighbouring word inside one
# span is not found, the skill concludes the engine MCP is not configured, and the
# whole pipeline degrades to `manual` with the compile and test gates skipped —
# silently, and looking exactly like a project that has no MCP.
#
# Scope: skills/**/*.md, subagents/*.md, data/dev-principles.md.
# `data/engine-templates/**` is excluded — ED-8 already bans `{{` there outright.
echo -e "\n${BOLD}Part 7e2: {{engine_mcp_tool}} substitution form (MT-1/MT-2)${NC}"

MT_SCOPE=("$ROOT_DIR/skills" "$ROOT_DIR/subagents" "$ROOT_DIR/data/dev-principles.md")

MT_TOTAL=$(grep -rhoF '{{engine_mcp_tool}}' "${MT_SCOPE[@]}" --include='*.md' 2>/dev/null | wc -l | tr -d ' ')
MT_WRAPPED=$(grep -rhoF '`{{engine_mcp_tool}}`' "${MT_SCOPE[@]}" --include='*.md' 2>/dev/null | wc -l | tr -d ' ')
MT_LABELLED=$(grep -rhoF 'MCP server `{{engine_mcp_tool}}`' "${MT_SCOPE[@]}" --include='*.md' 2>/dev/null | wc -l | tr -d ' ')

if [[ "$MT_TOTAL" -eq 0 ]]; then
    fail "MT-1: no {{engine_mcp_tool}} occurrences found at all — the scope is wrong, not the corpus"
elif [[ "$MT_TOTAL" -eq "$MT_WRAPPED" ]]; then
    pass "MT-1: all $MT_TOTAL {{engine_mcp_tool}} occurrences are backtick-wrapped"
else
    fail "MT-1: $MT_TOTAL occurrences of {{engine_mcp_tool}}, only $MT_WRAPPED wrapped in backticks"
    grep -rn '{{engine_mcp_tool}}' "${MT_SCOPE[@]}" --include='*.md' 2>/dev/null \
      | grep -vF '`{{engine_mcp_tool}}`' | sed 's/^/      /' | head -10
fi

if [[ "$MT_WRAPPED" -eq "$MT_LABELLED" ]]; then
    pass "MT-2: all $MT_WRAPPED wrapped occurrences carry the \`MCP server\` label"
else
    fail "MT-2: $MT_WRAPPED wrapped occurrences, only $MT_LABELLED preceded by 'MCP server '"
    grep -rn '`{{engine_mcp_tool}}`' "${MT_SCOPE[@]}" --include='*.md' 2>/dev/null \
      | grep -vF 'MCP server `{{engine_mcp_tool}}`' | sed 's/^/      /' | head -10
fi

# ─────────────────────────────────────────────
# Part 7e3: key/code/docs invariants across the MCP catalog
# ─────────────────────────────────────────────
# What Part 5b cannot express, because it holds no accumulator tying a config to
# the file it was read from or to the rules tree it points at:
#
#   - `key` == the JSON's own basename. The key is the server's internal identity
#     and every other surface derives from it: the config map, the delivery stamp,
#     the findings-log name, the archive names. Letting them drift makes the
#     rename migration's four surfaces disagree with each other.
#   - `code` present and non-empty. `parseMcpServerEntry` DROPS an entry without
#     one — the wizard would simply not offer the server, with no error anywhere.
#   - `docs.context7` REQUIRED of a server that ships a rules tree, and matching
#     the id its INDEX.md names. Presence is deliberately NOT required of every
#     engine server: an id is added only when it was actually resolved by a pinned
#     request, and a guard demanding one everywhere would red the suite exactly
#     when the honest answer is "not verified" — leaving one way out, inventing
#     it. The tree is the one place the two halves can be compared, so it is the
#     one place the field is mandatory.
echo -e "\n${BOLD}Part 7e3: MCP key/code/docs invariants${NC}"

MCP_IDENTITY_RESULT=$(node -e "
  const fs=require('fs'), path=require('path');
  const root=process.argv[1];
  const why=[];

  for (const dir of fs.readdirSync(root)) {
    const dirPath=path.join(root, dir);
    if (!fs.statSync(dirPath).isDirectory()) continue;
    for (const f of fs.readdirSync(dirPath)) {
      if (!f.endsWith('.json')) continue;
      const rel=dir+'/'+f;
      const fileId=f.replace(/\.json\$/, '');
      let m;
      try { m=JSON.parse(fs.readFileSync(path.join(dirPath,f),'utf8')); }
      catch { why.push('parse-error:'+rel); continue; }

      if (m.key !== fileId) why.push('key-not-fileid:'+rel+':key='+JSON.stringify(m.key));
      if (typeof m.code !== 'string' || !m.code) why.push('code-missing:'+rel);

      if (typeof m.rules === 'string' && m.rules) {
        const indexPath=path.resolve(dirPath, m.rules, 'INDEX.md');
        const declared=m.docs && m.docs.context7;
        if (typeof declared !== 'string' || !declared) {
          why.push('rules-tree-without-context7:'+rel);
        } else if (fs.existsSync(indexPath)) {
          const index=fs.readFileSync(indexPath,'utf8');
          if (!index.includes(declared)) why.push('index-does-not-name-context7-id:'+declared+':'+rel);
        }
      }
    }
  }

  console.log(why.length ? why.join(' ') : 'ok');
" "$MCP_DIR" 2>/dev/null || echo "pass-error")

if [[ "$MCP_IDENTITY_RESULT" == "ok" ]]; then
    pass "MCP catalog: key == fileId, code present, rules-tree servers declare a context7 id matching their INDEX"
else
    fail "MCP catalog identity invariants violated: $MCP_IDENTITY_RESULT"
fi

# ─────────────────────────────────────────────
# Part 7e4: migration-chain anchors
# ─────────────────────────────────────────────
# Three rules the runner depends on and cannot check for itself:
#
#   - `since`, WHEN DECLARED, is valid semver and does not decrease in declaration
#     order. The runner sorts by it, so declaration order that disagrees with the
#     anchors is a lie a reader will believe. Steps without `since` are skipped:
#     the registry chain has no version axis at all (its context is `{registryDir}`
#     and `currentVersion` is never passed), and demanding an anchor there would
#     force someone to invent one.
#   - a step with NEITHER `since` NOR `detect` can never fire. The runner throws on
#     it at runtime; this catches it at `npm test` instead.
#   - an anchor ABOVE the package version makes `versionPending` permanently true
#     for every project stamped with the previous number, so `isProjectStale` never
#     clears and `rules sync` answers exit 8 forever — with no `update` able to
#     lift it. The anchor and the release bump ship together, in one commit; this
#     is the only mechanical guard on that pairing anywhere in the repository.
echo -e "\n${BOLD}Part 7e4: migration-chain anchors${NC}"

MIGRATION_ANCHOR_RESULT=$(cd "$ROOT_DIR" && node --input-type=module -e "
  const fs = await import('node:fs');
  const semver = (await import('semver')).default;
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8')).version;
  const chains = [
    ['PROJECT_MEMORY_MIGRATIONS', (await import('./dist/core/memory-migrations/index.js')).PROJECT_MEMORY_MIGRATIONS],
    ['REGISTRY_MIGRATIONS', (await import('./dist/core/registry/migrations/index.js')).REGISTRY_MIGRATIONS],
  ];
  const why = [];

  for (const [name, chain] of chains) {
    if (!Array.isArray(chain)) { why.push('chain-not-array:'+name); continue; }
    let previous = null;
    for (const step of chain) {
      if (!step.since && !step.detect) why.push('step-never-fires:'+name+':'+step.id);
      if (step.since === undefined) continue;
      if (!semver.valid(step.since)) { why.push('since-not-semver:'+name+':'+step.id+':'+step.since); continue; }
      if (previous && semver.lt(step.since, previous)) {
        why.push('since-decreases:'+name+':'+step.id+':'+step.since+'<'+previous);
      }
      if (semver.valid(pkg) && semver.gt(step.since, pkg)) {
        why.push('since-above-package-version:'+name+':'+step.id+':'+step.since+'>'+pkg);
      }
      previous = step.since;
    }
  }

  process.stdout.write(why.length ? why.join(' ') : 'ok');
" 2>/dev/null || echo "pass-error")

if [[ "$MIGRATION_ANCHOR_RESULT" == "ok" ]]; then
    pass "migration chains: since is valid semver, non-decreasing, never above the package version; no step without since AND detect"
else
    fail "migration chain anchors violated: $MIGRATION_ANCHOR_RESULT"
fi

# ─────────────────────────────────────────────
# Part 7f: agent-filter unit tests
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part 7f: agent-filter unit tests${NC}"

set +e
AGENT_FILTER_OUTPUT=$(node "$ROOT_DIR/scripts/test-agent-filter.mjs" 2>&1)
AGENT_FILTER_EXIT=$?
set -e

if [[ $AGENT_FILTER_EXIT -eq 0 ]]; then
    pass "agent-filter unit tests"
    echo "$AGENT_FILTER_OUTPUT" | grep '^PASS ' | sed 's/^/    /'
else
    fail "agent-filter unit tests"
    echo "$AGENT_FILTER_OUTPUT" | sed 's/^/      /'
fi

# ─────────────────────────────────────────────
# Part 7f2: config-tolerance unit tests (unknown agent id in .unikit.json)
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part 7f2: config-tolerance unit tests${NC}"

set +e
CONFIG_TOLERANCE_OUTPUT=$(node "$ROOT_DIR/scripts/test-config-tolerance.mjs" 2>&1)
CONFIG_TOLERANCE_EXIT=$?
set -e

if [[ $CONFIG_TOLERANCE_EXIT -eq 0 ]]; then
    pass "config-tolerance unit tests"
    echo "$CONFIG_TOLERANCE_OUTPUT" | grep '^PASS ' | sed 's/^/    /'
else
    fail "config-tolerance unit tests"
    echo "$CONFIG_TOLERANCE_OUTPUT" | sed 's/^/      /'
fi

# ─────────────────────────────────────────────
# Part 7g: validate <!-- unikit:agents --> markers in skills/subagents
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part 7g: agent-marker validation${NC}"

set +e
MARKER_OUTPUT=$(node "$ROOT_DIR/scripts/validate-agent-markers.mjs" 2>&1)
MARKER_EXIT=$?
set -e

if [[ $MARKER_EXIT -eq 0 ]]; then
    pass "agent-marker validation"
    echo "$MARKER_OUTPUT" | grep '^OK ' | sed 's/^/    /' | head -4
    MARKER_OK_COUNT=$(echo "$MARKER_OUTPUT" | grep -c '^OK ' || true)
    echo "    … ($MARKER_OK_COUNT files clean)"
else
    fail "agent-marker validation"
    echo "$MARKER_OUTPUT" | sed 's/^/      /'
fi

# ─────────────────────────────────────────────
# Part 7g2: agent-filter markers forbidden outside SKILL.md
# ─────────────────────────────────────────────
# Reference/template `.md` files do NOT pass through applyAgentFilter — installs
# only run invocation rewriting + {{}} substitution over them. An agent-filter
# marker there is therefore either a silently-unprocessed guarded block (content
# leaks to every agent) or an inline landmine that would throw if the filter is
# ever enabled for references. SKILL.md is the ONLY surface with agent-filter.
# Match the fragment form `<!-- unikit:agents` / `<!-- unikit:end` exactly as
# agent-filter detects it (START_FRAGMENT / END_FRAGMENT in agent-filter.ts) —
# NOT the bare `unikit:agents` token, which would also match prose and the
# non-literal `unikit:agents codex guard block` wording in the CHECK-MODE.md
# files.
echo -e "\n${BOLD}Part 7g2: agent-filter markers only in SKILL.md${NC}"

MARKER_LEAK_FILES=$(grep -rlE '<!-- unikit:agents|<!-- unikit:end' "$ROOT_DIR/skills" --include='*.md' 2>/dev/null \
    | grep -v '/SKILL.md$' || true)

if [[ -z "$MARKER_LEAK_FILES" ]]; then
    pass "no agent-filter markers outside SKILL.md"
else
    fail "agent-filter markers found outside SKILL.md (only SKILL.md may carry guarded blocks)"
    echo "$MARKER_LEAK_FILES" | sed 's/^/      /'
fi

# ─────────────────────────────────────────────
# Part 7g3: DM-1…DM-3 — the delegation model policy
# ─────────────────────────────────────────────
# A skill body travels to all six runtimes; a dispatch-time `model:` argument works on
# exactly one of them, and of the five others three have no stable tier alias at all. The
# policy is therefore not "pick the right model per runtime" but "name the model in ONE
# declared place per skill, behind an agent-filter branch, and nowhere else". Three guards,
# each closing a different way that policy rots:
#
#   DM-1  counter-pair (MT-1/MT-2 idiom) — every `model:` in skills/** sits inside an
#         `Agent(subagent_type: …)` expansion. An EQUALITY between two counts, not a search
#         for a negation, so a prose mention ("use `subagent_type: Explore, model: sonnet`")
#         is caught with no allowlist: it raises the total and not the in-call count. That
#         is the exact shape that survived every earlier cleanup.
#   DM-2  confinement (RT-5 idiom) — the only files that may carry the literal are
#         `skills/*/SKILL.md`, and inside each one every occurrence sits between
#         `<!-- unikit:agents claude -->` and its `<!-- unikit:end -->`. A reference file is
#         never filtered (Part 7g2), so a literal there ships the argument to all six.
#   DM-3  positive presence — the two rationale sentences exist, one per branch. A guard
#         does not reach the user (`scripts/` is outside `files` in package.json); the skill
#         text does. Deleting the reason is the regression that leaves the suite green and
#         the reader uninformed, and nothing else here would notice.
#
# Anchored on FORMULATIONS, never on headings: a heading is rewritten during cosmetics, a
# formulation only together with its meaning. Zero occurrences is a FAIL and not a silent
# pass, on the convention MT-1 and RT-1 use — an empty corpus is when a green result is
# worth the least. That branch only exists if the counters survive an empty grep, which
# under `set -euo pipefail` they do not by default — hence `{ … || true; }` below.
echo -e "\n${BOLD}Part 7g3: delegation model policy (DM-1/DM-2/DM-3)${NC}"

DM_SCOPE="$ROOT_DIR/skills"
DM_CALL_RE='Agent\(subagent_type: [A-Za-z][A-Za-z-]*, model: [a-z]+'

# `|| true` inside the substitution, not after it: the file runs under `set -euo pipefail`
# (`scripts/test-skills.sh:5`), so a grep that matches NOTHING fails the pipeline and the
# assignment aborts the whole suite — the `-eq 0` branch below would never be reached and
# the diagnostic it exists to print would never appear. The braces keep the failure inside
# the pipeline's first stage; `wc -l` still receives an empty stream and prints `0`.
DM_MODEL_TOTAL=$( { grep -rhoE 'model: [a-z]+' "$DM_SCOPE" --include='*.md' 2>/dev/null || true; } | wc -l | tr -d ' ')
DM_IN_CALL=$( { grep -rhoE "$DM_CALL_RE" "$DM_SCOPE" --include='*.md' 2>/dev/null || true; } | wc -l | tr -d ' ')

# (DM-1)
if [[ "$DM_MODEL_TOTAL" -eq 0 ]]; then
    fail "DM-1: no model literal in skills/ at all — the scope is wrong, not the corpus"
elif [[ "$DM_MODEL_TOTAL" -eq "$DM_IN_CALL" ]]; then
    pass "DM-1: all $DM_MODEL_TOTAL model literals sit inside an Agent(subagent_type: …) expansion"
else
    fail "DM-1: $DM_MODEL_TOTAL model literals in skills/, only $DM_IN_CALL inside a dispatch expansion"
    grep -rnE 'model: [a-z]+' "$DM_SCOPE" --include='*.md' 2>/dev/null \
      | grep -vE "$DM_CALL_RE" | sed 's/^/      /' | head -10
fi

# (DM-2) DM-1 proves the literal is inside an expansion; it does not prove that expansion
# is ever filtered out. A `references/**` file never passes through applyAgentFilter at all
# (Part 7g2), and an expansion sitting outside a marker — or inside the `!claude` branch —
# ships a Claude-only argument to five runtimes whose dispatch signature has no such field.
# Named after RT-5, whose shape this borrows: collect by grep, allow by name, print the
# offender.
DM2_HITS="$(grep -rlE 'model: [a-z]+' "$DM_SCOPE" --include='*.md' 2>/dev/null || true)"
DM2_WHY=""
while IFS= read -r dm_file; do
    [[ -n "$dm_file" ]] || continue
    if [[ "$(basename "$dm_file")" != "SKILL.md" ]]; then
        DM2_WHY+=" ${dm_file#"$ROOT_DIR/"}:not-a-SKILL.md"
        continue
    fi
    dm_loose="$(awk '
        /<!-- unikit:agents / { inblock = ($0 ~ /<!-- unikit:agents claude -->/) ? 1 : 0; next }
        /<!-- unikit:end -->/ { inblock = 0; next }
        /model: [a-z]/        { if (!inblock) print FNR }
    ' "$dm_file" | tr "\n" "," )"
    [[ -z "$dm_loose" ]] || DM2_WHY+=" ${dm_file#"$ROOT_DIR/"}:unguarded-at-${dm_loose%,}"
done <<< "$DM2_HITS"
if [[ -z "$DM2_HITS" ]]; then
    fail "DM-2: no file carries a model literal — the scope is wrong, not the corpus"
elif [[ -z "$DM2_WHY" ]]; then
    pass "DM-2: the model literal is confined to SKILL.md, inside a claude-only branch"
else
    fail "DM-2 the model literal escaped its declaration block:$DM2_WHY"
fi

# (DM-3) The rule itself, in the surface that ships. `scripts/` is outside `files` in
# package.json, so no guard reaches a user's project; the SKILL.md text does. Anchored on
# the two formulations rather than on the heading above them — a heading gets rewritten
# during cosmetics, a formulation only together with its meaning. The third assertion is
# the load-bearing one: as many reasons as there are dispatches means a block cannot be
# added without its reason, nor a reason kept after its block is gone.
# Same `|| true` shape as DM-1, and here it is load-bearing rather than defensive: the
# regression DM-3 exists to catch is the rationale being deleted, which is exactly the case
# where grep matches nothing. Without the guard that case kills the suite at this line
# instead of printing `tier-rationale-absent`, and Part 7h onward never runs.
DM3_TIER=$( { grep -rhoF 'is a tier alias, never a version' "$DM_SCOPE" --include='SKILL.md' 2>/dev/null || true; } | wc -l | tr -d ' ')
DM3_NOMODEL=$( { grep -rhoF 'No model is named' "$DM_SCOPE" --include='SKILL.md' 2>/dev/null || true; } | wc -l | tr -d ' ')
DM3_WHY=""
[[ "$DM3_TIER" -gt 0 ]]              || DM3_WHY+=" tier-rationale-absent"
[[ "$DM3_TIER" -eq "$DM3_NOMODEL" ]] || DM3_WHY+=" claude=$DM3_TIER!=non-claude=$DM3_NOMODEL"
[[ "$DM3_TIER" -eq "$DM_IN_CALL" ]]  || DM3_WHY+=" reasons=$DM3_TIER!=dispatches=$DM_IN_CALL"
if [[ -z "$DM3_WHY" ]]; then
    pass "DM-3: $DM3_TIER declaration blocks, each branch carrying its own stated reason"
else
    fail "DM-3 the reason drifted from the declaration:$DM3_WHY"
fi

# ─────────────────────────────────────────────
# Part 7h: CLI command registration smoke
# ─────────────────────────────────────────────
# Catch the "forgot to wire a new command into src/cli/index.ts" regression
# by running `unikit-ai self-update --help` and checking that commander
# registered the subcommand. Keeps the assertion inside test-skills.sh
# instead of delegating to test-update.sh (self-update must stay out of
# the update command flow).

set +e
SELF_UPDATE_OUTPUT=$(node "$ROOT_DIR/dist/cli/index.js" self-update --help 2>&1)
SELF_UPDATE_EXIT=$?
set -e

if [[ $SELF_UPDATE_EXIT -eq 0 ]] && grep -qi 'self-update' <<< "$SELF_UPDATE_OUTPUT"; then
    pass "unikit-ai self-update registered"
else
    fail "unikit-ai self-update --help (exit=$SELF_UPDATE_EXIT)"
    echo "$SELF_UPDATE_OUTPUT" | sed 's/^/      /'
fi

# ─────────────────────────────────────────────
# Part 7i: core module file-size guard
# ─────────────────────────────────────────────
# Keep the whole of src/core/ — the root modules plus the installer/* and
# registry/* submodules — under a hard 500-line ceiling so neither the former
# installer monolith nor the schema-aware registry layer can silently regrow. The
# limit leaves headroom over the largest module (core/extensions.ts at ~487,
# registry/chained-registry.ts at ~491, installer/rules-sync.ts at ~484).
#
# The root src/core/*.ts glob closes what used to be the rule's blind spot:
# constants.ts was listed by name and everything beside it — mcp.ts above all,
# the module the rules-tree work kept splitting — went unguarded, so a project
# rule that reads as mechanical was enforced by hand review alone.
echo -e "\n${BOLD}Part 7i: core module file-size guard${NC}"

SIZE_LIMIT=500
SIZE_VIOLATIONS=""
for f in "$ROOT_DIR"/src/core/*.ts \
         "$ROOT_DIR"/src/core/installer/*.ts \
         "$ROOT_DIR"/src/core/registry/*.ts \
         "$ROOT_DIR"/src/core/registry/migrations/*.ts; do
    [[ -f "$f" ]] || continue
    lines=$(wc -l < "$f" | tr -d ' ')
    if [[ "$lines" -gt "$SIZE_LIMIT" ]]; then
        SIZE_VIOLATIONS+="    $(basename "$f"): $lines lines (> $SIZE_LIMIT)\n"
    fi
done

if [[ -z "$SIZE_VIOLATIONS" ]]; then
    pass "src/core modules within $SIZE_LIMIT-line limit"
else
    fail "src/core modules exceed $SIZE_LIMIT-line limit"
    echo -e "$SIZE_VIOLATIONS"
fi

# ─────────────────────────────────────────────
# Part 7j: ultra plan bundle contract
# ─────────────────────────────────────────────
# Two invariants grep cannot express: (a) the canonical manifest template extracted
# FROM ULTRA-PLAN-FORMAT.md is self-consistent across its three projections of the task
# set, and (b) every consumer carries the literal mode marker. The template is
# extracted, never copied — a test holding its own copy validates itself.
# Placed inside the codebase-integrity block (after 7i, before the Part 8 smoke tests)
# because it runs no CLI and reads no dist/ — it works on source text alone.
echo -e "\n${BOLD}Part 7j: ultra plan bundle contract${NC}"

set +e
ULTRA_CONTRACT_OUTPUT=$(node "$ROOT_DIR/scripts/test-ultra-plan-contract.mjs" 2>&1)
ULTRA_CONTRACT_EXIT=$?
set -e

if [[ $ULTRA_CONTRACT_EXIT -eq 0 ]]; then
    pass "ultra plan bundle contract"
    echo "$ULTRA_CONTRACT_OUTPUT" | grep '^PASS ' | sed 's/^/    /'
else
    fail "ultra plan bundle contract"
    echo "$ULTRA_CONTRACT_OUTPUT" | sed 's/^/      /'
fi

# ─────────────────────────────────────────────
# Part 8: Update command smoke tests
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== Update command smoke tests ===${NC}\n"

set +e
UPDATE_SMOKE_OUTPUT=$(bash "$ROOT_DIR/scripts/test-update.sh" 2>&1)
UPDATE_SMOKE_EXIT=$?
set -e

if [[ $UPDATE_SMOKE_EXIT -eq 0 ]]; then
    pass "update smoke tests"
    echo "$UPDATE_SMOKE_OUTPUT" | grep '✓' | sed 's/^/    /'
else
    fail "update smoke tests"
    echo "$UPDATE_SMOKE_OUTPUT" | sed 's/^/      /'
fi

# ─────────────────────────────────────────────
# Part 9: Install smoke tests
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== Install smoke tests ===${NC}\n"

set +e
INSTALL_SMOKE_OUTPUT=$(bash "$ROOT_DIR/scripts/test-install.sh" 2>&1)
INSTALL_SMOKE_EXIT=$?
set -e

if [[ $INSTALL_SMOKE_EXIT -eq 0 ]]; then
    pass "install smoke tests"
    echo "$INSTALL_SMOKE_OUTPUT" | grep '✓' | sed 's/^/    /'
else
    fail "install smoke tests"
    echo "$INSTALL_SMOKE_OUTPUT" | sed 's/^/      /'
fi

# ─────────────────────────────────────────────
# Part 9b: Migration chain + MCP reconciliation smoke tests
# ─────────────────────────────────────────────
# Runs after install/update: those two prove the commands work at all, this one
# proves the version matrix and the settings-file write rules underneath them.
echo -e "\n${BOLD}=== Migration + MCP reconciliation smoke tests ===${NC}\n"

set +e
MIGRATIONS_SMOKE_OUTPUT=$(bash "$ROOT_DIR/scripts/test-migrations.sh" 2>&1)
MIGRATIONS_SMOKE_EXIT=$?
set -e

if [[ $MIGRATIONS_SMOKE_EXIT -eq 0 ]]; then
    pass "migration + MCP reconciliation smoke tests"
    echo "$MIGRATIONS_SMOKE_OUTPUT" | grep '✓' | sed 's/^/    /'
else
    fail "migration + MCP reconciliation smoke tests"
    echo "$MIGRATIONS_SMOKE_OUTPUT" | sed 's/^/      /'
fi

# ─────────────────────────────────────────────
# Part 10: Extension smoke tests
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== Extension smoke tests ===${NC}\n"

set +e
EXT_SMOKE_OUTPUT=$(bash "$ROOT_DIR/scripts/test-extensions.sh" 2>&1)
EXT_SMOKE_EXIT=$?
set -e

if [[ $EXT_SMOKE_EXIT -eq 0 ]]; then
    pass "extension smoke tests"
    echo "$EXT_SMOKE_OUTPUT" | grep '✓' | sed 's/^/    /'
else
    fail "extension smoke tests"
    echo "$EXT_SMOKE_OUTPUT" | sed 's/^/      /'
fi

# ─────────────────────────────────────────────
# Part 9: No legacy settings.json references + LANGUAGE_RULES validation
# ─────────────────────────────────────────────
# Skills and subagents now reference .unikit/system/LANGUAGE_RULES.md
# (centralized language rules generated by /unikit bootstrap).
# Only .unikit/settings.json is legacy and must not appear anywhere.
echo -e "\n${BOLD}=== Validate language rules setup (no legacy settings.json) ===${NC}\n"

LEGACY_PATTERN='\.unikit/settings\.json'
LEGACY_ERRORS=0

# All skills must NOT reference legacy settings.json
for skill_dir in "$ROOT_DIR"/skills/*/; do
    skill_name=$(basename "$skill_dir")
    [[ "$skill_name" != "unikit" && "$skill_name" != unikit-* ]] && continue
    SKILL_FILE="$skill_dir/SKILL.md"
    [[ ! -f "$SKILL_FILE" ]] && continue

    if grep -qE "$LEGACY_PATTERN" "$SKILL_FILE" 2>/dev/null; then
        fail "$skill_name SKILL.md — still references legacy .unikit/settings.json"
        LEGACY_ERRORS=$((LEGACY_ERRORS + 1))
    fi
done

# All skill references files must NOT reference legacy settings.json
# (exclude LANGUAGE_RULES_TEMPLATE.md from this scan — it's the bootstrap template)
while IFS= read -r -d '' ref_file; do
    rel_path="${ref_file#$ROOT_DIR/}"
    if grep -qE "$LEGACY_PATTERN" "$ref_file" 2>/dev/null; then
        fail "$rel_path — still references legacy .unikit/settings.json"
        LEGACY_ERRORS=$((LEGACY_ERRORS + 1))
    fi
done < <(find "$ROOT_DIR/skills" -type f \( -name '*.md' -o -name '*.yaml' -o -name '*.yml' \) ! -name 'SKILL.md' ! -name 'LANGUAGE_RULES_TEMPLATE.md' -print0 2>/dev/null)

# Subagents must NOT reference legacy settings.json
for agent_file in "$ROOT_DIR"/subagents/*.md; do
    [[ -f "$agent_file" ]] || continue
    agent_name=$(basename "${agent_file%.md}")
    if grep -qE "$LEGACY_PATTERN" "$agent_file" 2>/dev/null; then
        fail "$agent_name — still references legacy .unikit/settings.json"
        LEGACY_ERRORS=$((LEGACY_ERRORS + 1))
    fi
done

# Engine templates must NOT reference legacy settings.json
while IFS= read -r -d '' tpl_file; do
    rel_path="${tpl_file#$ROOT_DIR/}"
    if grep -qE "$LEGACY_PATTERN" "$tpl_file" 2>/dev/null; then
        fail "$rel_path — still references legacy .unikit/settings.json"
        LEGACY_ERRORS=$((LEGACY_ERRORS + 1))
    fi
done < <(find "$ROOT_DIR/data/engine-templates" -type f -name '*.md' -print0 2>/dev/null)

# LANGUAGE_RULES_TEMPLATE.md must exist in skills/unikit/references/
LANG_RULES_TPL="$ROOT_DIR/skills/unikit/references/LANGUAGE_RULES_TEMPLATE.md"
if [[ ! -f "$LANG_RULES_TPL" ]]; then
    fail "skills/unikit/references/LANGUAGE_RULES_TEMPLATE.md — missing (required for bootstrap)"
    LEGACY_ERRORS=$((LEGACY_ERRORS + 1))
else
    pass "LANGUAGE_RULES_TEMPLATE.md exists"
fi

# Source data/LANGUAGE_RULES.md must NOT exist (removed in config.yaml port)
if [[ -f "$ROOT_DIR/data/LANGUAGE_RULES.md" ]]; then
    fail "data/LANGUAGE_RULES.md — still exists (must be deleted)"
    LEGACY_ERRORS=$((LEGACY_ERRORS + 1))
fi

if [[ $LEGACY_ERRORS -eq 0 ]]; then
    pass "no legacy settings.json references; LANGUAGE_RULES_TEMPLATE.md present"
fi
# ─────────────────────────────────────────────

# ─────────────────────────────────────────────
# Part 11: Language Awareness block presence
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part 11: Language Awareness block presence${NC}"
BLOCKING_ERRORS=0

# All 17 skill SKILL.md files (except unikit/SKILL.md) must have Language Awareness
for skill_dir in "$ROOT_DIR"/skills/unikit-*/; do
    [[ -d "$skill_dir" ]] || continue
    skill_file="$skill_dir/SKILL.md"
    [[ -f "$skill_file" ]] || continue
    skill_name=$(basename "$skill_dir")

    if ! grep -q '## Language Awareness — BLOCKING PRE-REQUISITE' "$skill_file" 2>/dev/null; then
        fail "$skill_name/SKILL.md — missing '## Language Awareness — BLOCKING PRE-REQUISITE'"
        BLOCKING_ERRORS=$((BLOCKING_ERRORS + 1))
    fi

    if grep -q '## Config & Language Resolution' "$skill_file" 2>/dev/null; then
        fail "$skill_name/SKILL.md — still has old '## Config & Language Resolution'"
        BLOCKING_ERRORS=$((BLOCKING_ERRORS + 1))
    fi

    # Every skill must reference the centralized LANGUAGE_RULES.md
    if ! grep -q 'LANGUAGE_RULES\.md' "$skill_file" 2>/dev/null; then
        fail "$skill_name/SKILL.md — missing reference to LANGUAGE_RULES.md"
        BLOCKING_ERRORS=$((BLOCKING_ERRORS + 1))
    fi
done

# Coordinator subagents must have Language Awareness + Internal communication block
for coord in unikit-implement-coordinator unikit-plan-coordinator; do
    coord_file="$ROOT_DIR/subagents/${coord}.md"
    [[ -f "$coord_file" ]] || continue

    if ! grep -q '## Language Awareness — BLOCKING PRE-REQUISITE' "$coord_file" 2>/dev/null; then
        fail "$coord — missing '## Language Awareness — BLOCKING PRE-REQUISITE'"
        BLOCKING_ERRORS=$((BLOCKING_ERRORS + 1))
    fi

    if grep -q '## Config & Language Resolution' "$coord_file" 2>/dev/null; then
        fail "$coord — still has old '## Config & Language Resolution'"
        BLOCKING_ERRORS=$((BLOCKING_ERRORS + 1))
    fi

    # Must reference centralized LANGUAGE_RULES.md
    if ! grep -q 'LANGUAGE_RULES\.md' "$coord_file" 2>/dev/null; then
        fail "$coord — missing reference to LANGUAGE_RULES.md"
        BLOCKING_ERRORS=$((BLOCKING_ERRORS + 1))
    fi

    ic_count=$(grep -c 'Internal communication is always English' "$coord_file" 2>/dev/null || true)
    if [[ "$ic_count" -ne 1 ]]; then
        fail "$coord — expected exactly 1 'Internal communication is always English' line, found $ic_count"
        BLOCKING_ERRORS=$((BLOCKING_ERRORS + 1))
    fi
done

if [[ $BLOCKING_ERRORS -eq 0 ]]; then
    pass "all 17 skills + 2 coordinator subagents have Language Awareness with LANGUAGE_RULES.md reference"
fi

# ─────────────────────────────────────────────
# Part 12: git.* keys in C2 skills
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part 12: git.* keys in C2 skills${NC}"
GIT_KEY_ERRORS=0

PLAN_SKILL="$ROOT_DIR/skills/unikit-plan/SKILL.md"
for key in git.enabled git.base_branch git.create_branches git.branch_prefix; do
    if ! grep -q "$key" "$PLAN_SKILL" 2>/dev/null; then
        fail "unikit-plan/SKILL.md — missing $key"
        GIT_KEY_ERRORS=$((GIT_KEY_ERRORS + 1))
    fi
done

if ! grep -qE '\-\-base.*overrides.*git\.base_branch|Priority.*\-\-base.*git\.base_branch' "$PLAN_SKILL" 2>/dev/null; then
    fail "unikit-plan/SKILL.md — missing --base overrides git.base_branch priority contract"
    GIT_KEY_ERRORS=$((GIT_KEY_ERRORS + 1))
fi

COMMIT_SKILL="$ROOT_DIR/skills/unikit-commit/SKILL.md"
if ! grep -q 'git.skip_push_after_commit' "$COMMIT_SKILL" 2>/dev/null; then
    fail "unikit-commit/SKILL.md — missing git.skip_push_after_commit"
    GIT_KEY_ERRORS=$((GIT_KEY_ERRORS + 1))
fi

if [[ $GIT_KEY_ERRORS -eq 0 ]]; then
    pass "unikit-plan has all 4 git.* keys + priority contract; unikit-commit has git.skip_push_after_commit"
fi

# ─────────────────────────────────────────────
# Part 13: Rules registry tests
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part 13: Rules registry tests${NC}"
if bash "$SCRIPT_DIR/test-rules.sh"; then
    pass "Rules registry tests passed"
else
    fail "Rules registry tests failed"
fi

# ─────────────────────────────────────────────
# Part 13b: Genre profile tests (catalog + CLI + schema)
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part 13b: Genre profile tests${NC}"
if bash "$SCRIPT_DIR/test-genres.sh"; then
    pass "Genre profile tests passed"
else
    fail "Genre profile tests failed"
fi

# ─────────────────────────────────────────────
# Part 14: no non-ASCII letters in distributed source code
# ─────────────────────────────────────────────
# Rationale: unikit-ai is an international npm CLI. All user-facing strings
# in src/ (inquirer messages, chalk outputs, console.log/error, errors)
# must be English. This guards against locale leaks from plan-language
# mirroring (see patches/2026-04-13-14.34.md).
#
# Scope note — we ban alphabetic letters of non-Latin scripts (Cyrillic,
# Greek, Arabic, Hebrew, CJK, etc.), not every non-ASCII code point. CLI
# UX symbols like ✓ ✗ ⚠ ↻ → — are intentional and documented as part of
# the output contract (see src/cli/commands/rules.ts: "keep prefix
# characters stable"). Targeting letters specifically catches the original
# threat — locale-mirrored prose — without flagging decorative glyphs.
#
# Implemented via a small node scan because `grep -rnP` is locale-sensitive
# on Windows Git Bash ("grep: -P supports only unibyte and UTF-8 locales"),
# which made the previous guard silently pass on developer machines with
# non-UTF-8 locales while only failing on CI.
echo -e "\n${BOLD}Part 14: no non-ASCII letters in src/${NC}"
NON_ASCII_HITS=$(node -e '
    const fs = require("fs");
    const path = require("path");
    const LOCALE_LEAK = /\p{Letter}/u;
    const LATIN = /^[A-Za-z]$/;
    const EXT = /\.(ts|tsx|mts|cts|js|mjs|cjs|json)$/;
    const root = process.argv[1];
    const hits = [];
    (function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, entry.name);
            if (entry.isDirectory()) { walk(p); continue; }
            if (!EXT.test(entry.name)) continue;
            const text = fs.readFileSync(p, "utf8");
            const lines = text.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                for (const ch of line) {
                    if (LOCALE_LEAK.test(ch) && !LATIN.test(ch)) {
                        hits.push(`${p}:${i + 1}: ${line}`);
                        break;
                    }
                }
            }
        }
    })(root);
    if (hits.length) console.log(hits.join("\n"));
' "$ROOT_DIR/src")
if [[ -n "$NON_ASCII_HITS" ]]; then
    fail "src/ contains non-Latin letters (expected English-only)"
    echo "$NON_ASCII_HITS" | head -20 | sed 's/^/    /'
else
    pass "src/ contains only Latin letters"
fi

# ─────────────────────────────────────────────
# Part 15: Skill grouping guard
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part 15: Skill grouping guard${NC}"
if bash "$SCRIPT_DIR/test-skill-groups.sh"; then
    pass "Skill grouping guard passed"
else
    fail "Skill grouping guard failed"
fi

# ─────────────────────────────────────────────
# Part 16: unikit-help navigator guard
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part 16: unikit-help navigator guard${NC}"
if bash "$SCRIPT_DIR/test-help-skill.sh"; then
    pass "unikit-help navigator guard passed"
else
    fail "unikit-help navigator guard failed"
fi

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== Results ===${NC}"
echo -e "  Total:    $TOTAL"
echo -e "  Passed:   ${GREEN}$PASSED${NC}"
echo -e "  Failed:   ${RED}$FAILED${NC}"
echo -e "  Warnings: ${YELLOW}$WARNINGS${NC}"

if [[ $FAILED -gt 0 ]]; then
    echo -e "\n${RED}TESTS FAILED${NC}\n"
    exit 1
else
    echo -e "\n${GREEN}ALL TESTS PASSED${NC}\n"
    exit 0
fi
