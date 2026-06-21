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
# Every `*-agent` token referenced in the body of unikit-{implement,fix,verify}/SKILL.md
# MUST be defined in its own `## Delegation agents` section. This ensures aliases are
# not drift-prone — if a narrative mentions `docs-agent`, that alias must be declared.
echo -e "\n${BOLD}=== Validate delegation-alias connectivity ===${NC}\n"

DELEGATION_SKILLS=("unikit-implement" "unikit-fix" "unikit-verify")

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
          "m.key && m.displayName && m.config ? 'ok' : 'missing'" 2>/dev/null || echo "missing")
        if [[ "$HAS_FIELDS" == "ok" ]]; then
            KEY_VAL=$(json_field "$MCP_DIR/universal/context7.json" "m.key" 2>/dev/null)
            if [[ "$KEY_VAL" == "context7" ]]; then
                pass "mcp/universal/context7.json (valid structure, key=context7)"
            else
                fail "mcp/universal/context7.json — expected key 'context7', got '$KEY_VAL'"
            fi
        else
            fail "mcp/universal/context7.json — missing key, displayName, or config"
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
          "m.key && m.displayName && m.config ? 'ok' : 'missing'" 2>/dev/null || echo "missing")
        if [[ "$HAS_FIELDS" == "ok" ]]; then
            KEY_VAL=$(json_field "$mcp_file" "m.key" 2>/dev/null)
            pass "mcp/unity/$fname (valid structure, key=$KEY_VAL)"
        else
            fail "mcp/unity/$fname — missing key, displayName, or config"
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
          "m.key && m.displayName && m.config ? 'ok' : 'missing'" 2>/dev/null || echo "missing")
        if [[ "$HAS_FIELDS" == "ok" ]]; then
            KEY_VAL=$(json_field "$mcp_file" "m.key" 2>/dev/null)
            pass "mcp/godot/$fname (valid structure, key=$KEY_VAL)"
        else
            fail "mcp/godot/$fname — missing key, displayName, or config"
        fi
    else
        fail "mcp/godot/$fname — invalid JSON"
    fi
done
if [[ "$GODOT_MCP_COUNT" -eq 0 ]]; then
    fail "mcp/godot/ — no MCP JSON files found"
fi

# unreal-engine-5/ must have unreal-mcp-chir24.json
if [[ -f "$MCP_DIR/unreal-engine-5/unreal-mcp-chir24.json" ]]; then
    if validate_json "$MCP_DIR/unreal-engine-5/unreal-mcp-chir24.json"; then
        HAS_FIELDS=$(json_field "$MCP_DIR/unreal-engine-5/unreal-mcp-chir24.json" \
          "m.key && m.displayName && m.config ? 'ok' : 'missing'" 2>/dev/null || echo "missing")
        if [[ "$HAS_FIELDS" == "ok" ]]; then
            KEY_VAL=$(json_field "$MCP_DIR/unreal-engine-5/unreal-mcp-chir24.json" "m.key" 2>/dev/null)
            IS_ENGINE=$(json_field "$MCP_DIR/unreal-engine-5/unreal-mcp-chir24.json" "m.is_engine === true ? 'true' : 'false'" 2>/dev/null)
            if [[ -n "$KEY_VAL" && "$IS_ENGINE" == "true" ]]; then
                pass "mcp/unreal-engine-5/unreal-mcp-chir24.json (valid structure, key=$KEY_VAL, is_engine=true)"
            else
                fail "mcp/unreal-engine-5/unreal-mcp-chir24.json — key='$KEY_VAL', is_engine=$IS_ENGINE (expected non-empty key + is_engine=true)"
            fi
        else
            fail "mcp/unreal-engine-5/unreal-mcp-chir24.json — missing key, displayName, or config"
        fi
    else
        fail "mcp/unreal-engine-5/unreal-mcp-chir24.json — invalid JSON"
    fi
else
    fail "mcp/unreal-engine-5/unreal-mcp-chir24.json — missing"
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
    if grep -q '## Core Principles' "$DEV_PRINCIPLES"; then
        pass "dev-principles.md — has Core Principles section"
    else
        fail "dev-principles.md — missing Core Principles section"
    fi
    if grep -q '## Workflow' "$DEV_PRINCIPLES"; then
        pass "dev-principles.md — has Workflow section"
    else
        fail "dev-principles.md — missing Workflow section"
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

# The 8 GDD authoring templates (Phase C / #9) must exist and be non-empty.
# GD-IDS ships as .yaml (machine truth); the rest are .md.
for tpl in CONCEPT GAME GD-IDS GD-INDEX GD_RULES_INDEX PITCH REVIEW SYSTEM; do
    ext=md
    [[ "$tpl" == "GD-IDS" ]] && ext=yaml
    if [[ -s "$GD_DATA/templates/$tpl.$ext" ]]; then
        pass "data/gamedesign/templates/$tpl.$ext"
    else
        fail "data/gamedesign/templates/$tpl.$ext — missing or empty"
    fi
done

# gd-principles.md — the cross-skill working contract installed as a system
# asset (.unikit/system/gd-principles.md). It is PROCESS, not domain: it must
# carry the protocol + severity-rubric sections and, like dev-principles.md,
# stay free of agent/engine template vars (it is copied without substitution).
GD_PRINCIPLES="$GD_DATA/gd-principles.md"
if [[ ! -f "$GD_PRINCIPLES" ]]; then
    fail "data/gamedesign/gd-principles.md — missing"
else
    for section in "Collaborative Protocol" "Section-Cycle Contract" "One-Way Boundary" "Severity Rubric"; do
        if grep -q "## $section" "$GD_PRINCIPLES"; then
            pass "gd-principles.md — has '$section' section"
        else
            fail "gd-principles.md — missing '$section' section"
        fi
    done
    if grep -qE '\{\{settings_file\}\}|\{\{skills_dir\}\}|\{\{engine_' "$GD_PRINCIPLES"; then
        fail "gd-principles.md — contains agent/engine vars (must be substitution-free like dev-principles.md)"
    else
        pass "gd-principles.md — no agent/engine vars (system-file safe)"
    fi
fi

# Status spine (Tier 1) — the system doc_status enum spans four surfaces that
# carry DIFFERENT sets (GD-IDS doc_status = 5; SYSTEM header legend = 4, no
# `not-started`; GD-INDEX = a display-union with `deprecated` + read-only
# `implemented`; the gd-verify `Status coherence` check legend = the design-
# writable enum). So this guard asserts the shared MERGE invariant, not enum
# equality: `reviewed` and `revised` on all four legends, and no `approved`-as-
# status on any (it merged into `reviewed`). Each grep targets the one status
# legend line per surface — never the whole file — so GAME.md/CONCEPT.md (their
# own `approved` lifecycle enums, including the gd-verify carve-out NB prose) and
# the GD-IDS `revised:` date field stay out.
GD_IDS_TPL="$GD_DATA/templates/GD-IDS.yaml"
GD_INDEX_TPL="$GD_DATA/templates/GD-INDEX.md"
GD_SYSTEM_TPL="$GD_DATA/templates/SYSTEM.md"
GD_VERIFY_SKILL="$ROOT_DIR/skills/unikit-gd-verify/SKILL.md"
SPINE_IDS_LINE=$(grep -F 'doc_status:' "$GD_IDS_TPL" 2>/dev/null | head -1 || true)
SPINE_SYSTEM_LINE=$(grep -F '> **Status**:' "$GD_SYSTEM_TPL" 2>/dev/null | head -1 || true)
SPINE_INDEX_LINE=$(grep -F '`Status`:' "$GD_INDEX_TPL" 2>/dev/null | head -1 || true)
# 4th surface: the gd-verify `Status coherence` check carries the design-writable
# enum on its single legend line; the GAME.md/CONCEPT.md `approved` carve-out lives
# in separate NB prose, so head -1 anchors the table row, not the explanation.
SPINE_VERIFY_LINE=$(grep -F 'Status coherence' "$GD_VERIFY_SKILL" 2>/dev/null | head -1 || true)
SPINE_OK=1
SPINE_WHY=""
for pair in "GD-IDS.yaml:$SPINE_IDS_LINE" "SYSTEM.md:$SPINE_SYSTEM_LINE" "GD-INDEX.md:$SPINE_INDEX_LINE" "gd-verify:$SPINE_VERIFY_LINE"; do
    name="${pair%%:*}"
    line="${pair#*:}"
    if [[ -z "$line" ]]; then
        SPINE_OK=0; SPINE_WHY+=" $name(no-status-legend)"; continue
    fi
    if ! echo "$line" | grep -q "reviewed"; then SPINE_OK=0; SPINE_WHY+=" $name(no-reviewed)"; fi
    if ! echo "$line" | grep -q "revised";  then SPINE_OK=0; SPINE_WHY+=" $name(no-revised)"; fi
    if echo "$line" | grep -q "approved";   then SPINE_OK=0; SPINE_WHY+=" $name(approved-as-status)"; fi
done
if [[ "$SPINE_OK" -eq 1 ]]; then
    pass "status spine — reviewed+revised on all 4 surfaces, no approved-as-status (GD-IDS/SYSTEM/GD-INDEX/gd-verify)"
else
    fail "status spine enum drift:$SPINE_WHY"
fi
# The state machine is defined once in gd-principles (#2); skills reference it by
# name ("Lifecycle & Status"). Guard a re-clone that drops the section.
if grep -q '^## Lifecycle & Status' "$GD_PRINCIPLES"; then
    pass "gd-principles.md — has 'Lifecycle & Status' section"
else
    fail "gd-principles.md — missing 'Lifecycle & Status' section"
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
# so only validate the fixture is present and well-formed (canonical schema, two
# system docs); its README.md carries the planted-defect → verify-check ground
# truth a reviewer checks skill output against.
GD_DEFECTIVE="$ROOT_DIR/scripts/test-fixtures/gamedesign/defective-gdd"
GD_DEFECTIVE_OK=1
# systems/boost.md is the FIXED literal path the new ≥2-doc defects (unregistered
# cross-doc fact, Depends 3-way) hang off — README §map and this guard both pin it.
for f in README.md GAME.md GD-IDS.yaml GD-INDEX.md systems/combat.md systems/boost.md; do
    [[ -s "$GD_DEFECTIVE/$f" ]] || GD_DEFECTIVE_OK=0
done
if [[ "$GD_DEFECTIVE_OK" -eq 1 ]]; then
    pass "defective-gdd fixture present (GAME.md, GD-INDEX.md, GD-IDS.yaml, systems/combat.md, systems/boost.md, README ground truth)"
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
GD_SECTION_PACKS="$ROOT_DIR/skills/unikit-gd-detail/references/section-packs.md"
GD_LENSES="$ROOT_DIR/skills/unikit-gd-review/references/lenses.md"
GD_REVIEW_SKILL="$ROOT_DIR/skills/unikit-gd-review/SKILL.md"
GD_DETAIL_SKILL="$ROOT_DIR/skills/unikit-gd-detail/SKILL.md"
GD_IMPROVE_SKILL="$ROOT_DIR/skills/unikit-gd-improve/SKILL.md"
# ($GD_VERIFY_SKILL is defined above in the status-spine block.)

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

# (4) Keying-vocabulary parity detail↔improve: both Phase 0 tables carry the two
#     new domains (T5 goal — identical keying vocabulary across the two skills).
GD_KEYING_WHY=""
for f in "$GD_DETAIL_SKILL" "$GD_IMPROVE_SKILL"; do
    bn=$(basename "$(dirname "$f")")
    if ! grep -qF 'ai-behavior' "$f"; then GD_KEYING_WHY+=" $bn(ai-behavior)"; fi
    if ! grep -qF 'persistence' "$f"; then GD_KEYING_WHY+=" $bn(persistence)"; fi
done
if [[ -z "$GD_KEYING_WHY" ]]; then
    pass "gd-detail + gd-improve Phase 0 — ai-behavior + persistence domains present (T5 keying parity)"
else
    fail "Phase 0 keying parity drift:$GD_KEYING_WHY"
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

# (T7-1) Provenance contract section in gd-principles (GP2).
if grep -q '^## Provenance' "$GD_PRINCIPLES"; then
    pass "gd-principles — ## Provenance (imports) section present (T7 GP2)"
else
    fail "gd-principles — missing ## Provenance (imports) section (T7 GP2)"
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

# (T7-4) GAME.md Delta-Discipline carve-out in gd-principles (#16) — file-scoped on
#        the unique marker phrase inside ## Delta Discipline.
if grep -qF 'GAME.md exception (not a system)' "$GD_PRINCIPLES"; then
    pass "gd-principles — GAME.md Delta-Discipline carve-out present (#16)"
else
    fail "gd-principles — missing GAME.md Delta-Discipline carve-out (#16)"
fi

# (T8-5) implemented_version field in the GD-IDS template (#9).
if grep -qF 'implemented_version' "$GD_IDS_TPL"; then
    pass "GD-IDS template — implemented_version field present (T8)"
else
    fail "GD-IDS template — missing implemented_version field (T8)"
fi

# (T8-6) Both the writer (unikit-verify) and the reader (unikit-plan) name
#        implemented_version.
GD_IMPL_WHY=""
grep -qF 'implemented_version' "$UNIKIT_VERIFY_SKILL" || GD_IMPL_WHY+=" unikit-verify(writer)"
grep -qF 'implemented_version' "$UNIKIT_PLAN_SKILL"   || GD_IMPL_WHY+=" unikit-plan(reader)"
if [[ -z "$GD_IMPL_WHY" ]]; then
    pass "unikit-verify + unikit-plan — implemented_version wired (T8 writer/reader)"
else
    fail "implemented_version missing in:$GD_IMPL_WHY (T8)"
fi

# (T8-7) unikit-verify documents the GD-INDEX Status writeback (the value
#        `implemented`), not only implemented_version — guards the second surface of
#        the T8 writer scope (GD-IDS + GD-INDEX).
if grep -qF 'GD-INDEX Status=implemented' "$UNIKIT_VERIFY_SKILL"; then
    pass "unikit-verify — documents GD-INDEX Status=implemented writeback (T8 second surface)"
else
    fail "unikit-verify — missing GD-INDEX Status writeback (T8 second surface)"
fi

# (T8-8) Sanctioned code→design exception in the gd-principles One-Way Boundary (#8).
if grep -qF 'Sanctioned exceptions (two, narrow)' "$GD_PRINCIPLES"; then
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

# (UM-6) LOAD-BEARING (b): the ported helper + its split sibling modules are present in
#        source. WS1 split material-prep.py into a thin entrypoint that flat-imports
#        mp_config/mp_safety/mp_chunk/mp_books/mp_extract/mp_output (no package, no
#        __init__.py). Delivery into an installed project is asserted in test-install.sh.
UM_SCRIPTS_DIR="$ROOT_DIR/skills/unikit-memory/scripts"
UM_MP_WHY=""
[[ -s "$UM_PREP" ]] || UM_MP_WHY+=" material-prep.py"
for m in mp_config mp_safety mp_chunk mp_books mp_extract mp_output; do
    [[ -s "$UM_SCRIPTS_DIR/$m.py" ]] || UM_MP_WHY+=" $m.py"
done
if [[ -z "$UM_MP_WHY" ]]; then
    pass "material-prep.py + mp_*.py split modules — all present in skills/unikit-memory/scripts/ (T1/T9)"
else
    fail "material-prep helper modules — missing:$UM_MP_WHY"
fi

# (UM-7) LOAD-BEARING (c): the rebrand is complete across the entrypoint AND every split
#        mp_*.py — no aif-distillation/ai-factory literal survived (marker constants,
#        docstrings, User-Agent, argparse desc, SENSITIVE_DIR_NAMES, temp prefixes).
if grep -RqiE 'aif-distillation|ai-factory' "$UM_PREP" "$UM_SCRIPTS_DIR"/mp_*.py; then
    fail "material-prep helper — stale aif-distillation/ai-factory literal remains (T1/T9 rebrand)"
    grep -RniE 'aif-distillation|ai-factory' "$UM_PREP" "$UM_SCRIPTS_DIR"/mp_*.py
else
    pass "material-prep.py + mp_*.py — fully rebranded, no aif-distillation/ai-factory literal (T1/T9)"
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
#         UM-9 runtime smoke. After the WS1 split the symbols moved out of material-prep.py
#         into the sibling modules: format constants → mp_config.py, FB2/EPUB extractors →
#         mp_books.py, the ## TOC writer → mp_output.py, the loud pdftotext warning →
#         mp_extract.py. large-sources.md documents the book formats + MOBI rejection + the
#         pypdf recommendation; SKILL.md Phase A lists the new extensions.
UM_MP_CONFIG="$UM_SCRIPTS_DIR/mp_config.py"
UM_MP_BOOKS="$UM_SCRIPTS_DIR/mp_books.py"
UM_MP_OUTPUT="$UM_SCRIPTS_DIR/mp_output.py"
UM_MP_EXTRACT="$UM_SCRIPTS_DIR/mp_extract.py"
UM_T10_WHY=""
grep -qF 'BOOK_EXTENSIONS' "$UM_MP_CONFIG"              || UM_T10_WHY+=" config:BOOK_EXTENSIONS"
grep -qF 'REJECTED_BOOK_EXTENSIONS' "$UM_MP_CONFIG"     || UM_T10_WHY+=" config:REJECTED_BOOK_EXTENSIONS"
grep -qF 'def extract_fb2' "$UM_MP_BOOKS"              || UM_T10_WHY+=" books:extract_fb2"
grep -qF 'def extract_epub' "$UM_MP_BOOKS"             || UM_T10_WHY+=" books:extract_epub"
grep -qF '## TOC' "$UM_MP_OUTPUT"                       || UM_T10_WHY+=" output:toc-writer"
grep -qF 'WARN: Python PDF extractors' "$UM_MP_EXTRACT" || UM_T10_WHY+=" extract:pdftotext-warning"
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
    done
done

# ─────────────────────────────────────────────
# Part 7e: All is_engine=true entries share same key per engine scope
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== is_engine entries share same key per engine scope ===${NC}\n"

declare -A ENGINE_MCP_DIRS=(["unity"]="unity" ["godot"]="godot" ["godot-net"]="godot" ["unreal-engine-5"]="unreal-engine-5")
KEY_UNIQUENESS_ERRORS=0

for engine in "${!ENGINE_MCP_DIRS[@]}"; do
    mcp_dir="${ENGINE_MCP_DIRS[$engine]}"
    UNIVERSAL_DIR_PATH="$MCP_DIR/universal"
    ENGINE_DIR_PATH="$MCP_DIR/$mcp_dir"

    # Collect keys from is_engine=true entries across universal + engine directories
    RESULT=$(node -e "
      const fs = require('fs');
      const path = require('path');
      const engineKeys = [];
      for (const dir of process.argv.slice(1)) {
        if (!fs.existsSync(dir)) continue;
        for (const f of fs.readdirSync(dir)) {
          if (!f.endsWith('.json')) continue;
          try {
            const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
            if (m.is_engine === true && m.key) engineKeys.push(m.key);
          } catch {}
        }
      }
      const unique = [...new Set(engineKeys)];
      if (unique.length === 0) {
        console.log('NONE');
      } else if (unique.length === 1) {
        console.log('OK:' + unique[0] + ':' + engineKeys.length);
      } else {
        console.log('MISMATCH:' + unique.join(','));
      }
    " "$UNIVERSAL_DIR_PATH" "$ENGINE_DIR_PATH" 2>/dev/null || echo "ERROR")

    if [[ "$RESULT" == OK:* ]]; then
        INFO="${RESULT#OK:}"
        pass "engine $engine: all is_engine entries share key ($INFO)"
    elif [[ "$RESULT" == NONE ]]; then
        fail "engine $engine: no is_engine=true entries found"
        KEY_UNIQUENESS_ERRORS=$((KEY_UNIQUENESS_ERRORS + 1))
    elif [[ "$RESULT" == MISMATCH:* ]]; then
        KEYS="${RESULT#MISMATCH:}"
        fail "engine $engine: is_engine entries have different keys: $KEYS"
        KEY_UNIQUENESS_ERRORS=$((KEY_UNIQUENESS_ERRORS + 1))
    else
        fail "engine $engine: failed to check is_engine key consistency"
        KEY_UNIQUENESS_ERRORS=$((KEY_UNIQUENESS_ERRORS + 1))
    fi
done

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
# Part 7i: installer/registry module file-size guard
# ─────────────────────────────────────────────
# Keep the post-refactor installer/* and registry/* submodules and the shared
# constants.ts under a hard 500-line ceiling so neither the former installer
# monolith nor the schema-aware registry layer can silently regrow. The limit
# leaves comfortable headroom over the largest module (installer/rules-sync.ts
# at ~427, registry/validator.ts at ~297).
echo -e "\n${BOLD}Part 7i: installer/registry module file-size guard${NC}"

SIZE_LIMIT=500
SIZE_VIOLATIONS=""
for f in "$ROOT_DIR"/src/core/installer/*.ts \
         "$ROOT_DIR"/src/core/registry/*.ts \
         "$ROOT_DIR"/src/core/registry/migrations/*.ts \
         "$ROOT_DIR"/src/core/constants.ts; do
    [[ -f "$f" ]] || continue
    lines=$(wc -l < "$f" | tr -d ' ')
    if [[ "$lines" -gt "$SIZE_LIMIT" ]]; then
        SIZE_VIOLATIONS+="    $(basename "$f"): $lines lines (> $SIZE_LIMIT)\n"
    fi
done

if [[ -z "$SIZE_VIOLATIONS" ]]; then
    pass "installer/registry modules within $SIZE_LIMIT-line limit"
else
    fail "installer/registry modules exceed $SIZE_LIMIT-line limit"
    echo -e "$SIZE_VIOLATIONS"
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
