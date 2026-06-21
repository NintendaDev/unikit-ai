# Migrate Rules from RULES.md (Branch C)

The `unikit-memory` router loads this file when the resolved intent is **MIGRATE
RULES** (`migrate-rules`, the `--migrate-rules` legacy alias, or a RULES.md path was
passed). It transfers mature
entries from `.unikit/RULES.md` (the quick-capture staging area owned by
`unikit-rules`) into permanent rule files under `.unikit/memory/<module>/`. RULES.md
holds project-specific overrides — over time, entries that clearly belong to a
specific rule file should graduate into the knowledge base.

Prerequisites carried in from the router: the resolved `moduleId`, its `tiers`, and
the loaded module contract (for tier semantics and the File Format Template).

## C.1: Load Context

Read:
1. **`.unikit/RULES.md`** — current entries
2. **`.unikit/memory/<module>/RULES_INDEX.md`** — available rule files with descriptions

**Skip entirely** if RULES.md has no entries — report "No entries in RULES.md to migrate" and stop.

## C.2: Classify Entries

For each rule entry in RULES.md:

0. **Check for `@no-migrate` tag** — if the rule line ends with `<!-- @no-migrate -->`, skip it entirely. This tag means the user previously decided this rule must stay in RULES.md. Do not present it as a transfer candidate, do not mention it in the output. Proceed to the next entry.
1. **Classify destination** — match topic against RULES_INDEX.md "Description" and "Load When" columns to find the target file. If no file covers this topic — mark as **New File** candidate (needs a new rule file in the module). Use the module contract's tier semantics to pick the tier for a New File candidate.
2. **Check maturity** — ready for transfer when:
   - Clearly belongs to a specific rule file (existing or proposed new one)
   - Specific and actionable (not a vague note)
3. **Detect conflicts** (skip for New File candidates) — read the target rule file and check whether the RULES.md entry **contradicts** an existing rule. Mark each candidate as:
   - **Compatible** — no conflict, standard transfer
   - **Override** — contradicts an existing rule in the target file (e.g., "Never use var" overrides a {{engine_code_language}} convention, "Factory classes instead of Zenject PlaceholderFactory" overrides a DI pattern). Record which specific rule(s) in the target file conflict.
   - **New File** — no existing file covers this topic; propose creating a new rule file

## C.3: Present Transfer Candidates

**Compatible entries:**

```
### Transfer: "[rule text]"
- **From:** `.unikit/RULES.md` (section: {section name})
- **To:** `.unikit/memory/<module>/<tier>/{FILE}.md` (section: {target section})
- **Reason:** {why this belongs in the target file}
```

Options via `AskUserQuestion` (batches of up to 4):
1. Transfer — move to target file, remove from RULES.md
2. Keep — leave in RULES.md permanently, tag `<!-- @no-migrate -->`
3. Skip — decide later (no tag — will be presented again on next migration)

Based on choice:
- Transfer → apply C.4 "Transfer" procedure for this entry
- Keep → append `<!-- @no-migrate -->` tag, do not touch memory files
- Skip → leave as-is, no changes

**Override entries (conflict detected):**

```
### Override: "[rule text]"
- **From:** `.unikit/RULES.md` (section: {section name})
- **To:** `.unikit/memory/<module>/<tier>/{FILE}.md` (section: {target section})
- **Conflicts with:** "[existing rule text in memory file]"
- **Reason:** {why the RULES.md entry overrides the base convention}
```

Options via `AskUserQuestion` (batches of up to 4):
1. Replace — delete conflicting rule(s) from memory file, insert RULES.md entry verbatim, remove from RULES.md
2. Keep — leave in RULES.md permanently, tag `<!-- @no-migrate -->`
3. Delete — remove from RULES.md without transferring (base convention wins)

Based on choice:
- Replace → apply C.4 "Replace" procedure for this entry
- Keep → append `<!-- @no-migrate -->` tag, do not touch memory files
- Delete → remove entry from RULES.md, leave memory file unchanged

**New File entries (no matching file in the module):**

```
### New File: "[rule text]"
- **From:** `.unikit/RULES.md` (section: {section name})
- **Proposed file:** `.unikit/memory/<module>/<tier>/{PROPOSED-NAME}.md`
- **Tier:** {tier} — {reasoning for the choice, per the module contract}
- **Reason:** {why no existing file covers this topic}
```

Options via `AskUserQuestion` (batches of up to 4):
1. Create & Transfer — create proposed file and move the rule there
2. Custom — user specifies own filename and/or tier
3. Keep — leave in RULES.md permanently, tag `<!-- @no-migrate -->`
4. Skip — decide later (no tag — will be presented again on next migration)

Based on choice:
- Create & Transfer → apply C.4 "Create & Transfer" procedure with proposed filename
- Custom → ask user for filename and tier, confirm, then apply C.4 "Create & Transfer" with user's values
- Keep → append `<!-- @no-migrate -->` tag, do not touch memory files
- Skip → leave as-is, no changes

If no transfer candidates found across all three types (Compatible, Override, New File) → report "No mature entries to transfer" and stop.

## C.3a: Handle Rephrasing Requests

If the user rephrases a rule, requests changes to the wording, or asks to modify a rule before saving:

1. **Generate a new variant** — rewrite the rule text according to the user's instructions.
2. **Present the updated rule** using the same format as C.3 (Compatible / Override / New File — whichever applies), showing the **new wording** instead of the original.
3. **Offer the same options** as C.3 for this entry (Transfer / Replace / Create & Transfer / Keep / Skip / etc.).
4. **Repeat** if the user requests further changes — keep iterating until the user approves or skips.

The rephrased text replaces the original for all downstream steps (C.4 applies the approved wording, not the original RULES.md text).

## C.4: Apply Approved Actions

**For "Transfer" (compatible entries):**
1. Read the target rule file
2. Add the rule text **verbatim** (or the approved rephrased variant from C.3a) — copy exact wording without rephrasing or paraphrasing
3. Remove the rule from RULES.md using `Edit`
4. If a RULES.md section becomes empty after removal, remove the section header too

**For "Replace" (override entries):**
1. Read the target rule file
2. Locate and **delete** the conflicting rule(s) from the target memory file using `Edit`
3. Insert the RULES.md entry **verbatim** (or the approved rephrased variant from C.3a) in the same section where the conflicting rule was
4. Remove the rule from RULES.md using `Edit`
5. If a RULES.md section becomes empty after removal, remove the section header too

**For "Create & Transfer" (new file entries):**
1. Create the new rule file following the **File Format Template** from the module contract, using the approved filename and tier
2. Write the rule text (original or approved rephrased variant from C.3a) into the appropriate section
3. Update `RULES_INDEX.md` — add a new row to the appropriate table in alphabetical order
4. Remove the rule from RULES.md using `Edit`
5. If a RULES.md section becomes empty after removal, remove the section header too

**For "Delete" (discard override):**
1. Remove the rule from RULES.md using `Edit`
2. If a RULES.md section becomes empty after removal, remove the section header too
3. Do not touch the memory file — the base convention remains

**For "Keep" (leave in RULES.md permanently):**
1. Append ` <!-- @no-migrate -->` to the end of the rule line in RULES.md using `Edit`
2. The tag is an HTML comment — invisible when rendered, but detectable during future migrations (see C.2 step 0)
3. Do not modify any memory files

**Verbatim transfer is critical:** rules in RULES.md were carefully worded. Changing wording during transfer risks losing nuance. The only acceptable change is adding a section header in the target file if needed.

→ Return to the router's **Final Step: Confirm** (report which rules were transferred, replaced, or deleted).
