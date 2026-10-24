#!/bin/bash
# Test suite: the `grep -qF` shortcut of grep-shim.sh answers exactly like real grep.
# Usage: ./scripts/test-grep-shim.sh
#
# Every case runs the shortcut and the real binary on the same input and compares the exit
# status. A shortcut that disagrees on one of these shapes would turn a red guard green
# (or the other way round) without anything noticing.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=./grep-shim.sh
source "$SCRIPT_DIR/grep-shim.sh"

if [[ "${UNIKIT_TEST_REAL_GREP:-0}" == "1" ]]; then
    echo "  grep shim switched off (UNIKIT_TEST_REAL_GREP=1) - nothing to compare"
    exit 0
fi

PASSED=0
FAILED=0
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT

printf 'alpha beta\ngamma delta\n' > "$T/plain.txt"
printf 'no trailing newline' > "$T/nonl.txt"
printf 'crlf line\r\nsecond\r\n' > "$T/crlf.txt"
printf 'glob * ? [x] \\ back\n$dollar ^caret .dot\n' > "$T/special.txt"
printf 'Straße ünï ✓ → ключ\n' > "$T/utf8.txt"
: > "$T/empty.txt"
printf 'first\nsecond line\n' > "$T/lines.txt"

# case <label> <pattern> <file>   - the two exit statuses must be equal.
check() {
    local label="$1" pat="$2" file="$3" a=0 b=0
    grep -qF "$pat" "$file" 2>/dev/null || a=$?
    command grep -qF "$pat" "$file" 2>/dev/null || b=$?
    if [[ $a -eq $b ]]; then
        PASSED=$((PASSED + 1))
        echo "  ✓ $label (exit $a)"
    else
        FAILED=$((FAILED + 1))
        echo "  ✗ $label: shortcut=$a real=$b"
    fi
}

check "match inside a line"            'beta'           "$T/plain.txt"
check "match at line start"            'gamma'          "$T/plain.txt"
check "match at the very end"          'delta'          "$T/plain.txt"
check "no match"                       'epsilon'        "$T/plain.txt"
check "case differs"                   'ALPHA'          "$T/plain.txt"
check "whole line"                     'alpha beta'     "$T/plain.txt"
check "pattern longer than the file"   'alpha beta gamma delta and more' "$T/plain.txt"
check "file without trailing newline"  'trailing newline' "$T/nonl.txt"
check "CRLF file, text before CR"      'crlf line'      "$T/crlf.txt"
check "CRLF file, text with the CR"    $'line\r'        "$T/crlf.txt"
check "glob star literal"              '*'              "$T/special.txt"
check "glob question literal"          '?'              "$T/special.txt"
check "bracket literal"                '[x]'            "$T/special.txt"
check "backslash literal"              '\'              "$T/special.txt"
check "dollar literal"                 '$dollar'        "$T/special.txt"
check "caret and dot literal"          '^caret .dot'    "$T/special.txt"
check "star where the file has none"   '*beta'          "$T/plain.txt"
check "UTF-8 text"                     'ключ'           "$T/utf8.txt"
check "UTF-8 symbol"                   '✓ →'            "$T/utf8.txt"
check "empty file, text"               'x'              "$T/empty.txt"
check "empty pattern, non-empty file"  ''               "$T/plain.txt"
check "empty pattern, empty file"      ''               "$T/empty.txt"
check "newline in pattern, both lines" $'first\nsecond' "$T/lines.txt"
check "newline in pattern, one line"   $'first\nnope'   "$T/lines.txt"
check "pattern starting with a dash"   '-x'             "$T/plain.txt"
check "missing file"                   'x'              "$T/absent.txt"
check "directory instead of file"      'x'              "$T"

# Other shapes of `grep` must still reach the real binary.
for form in '-c' '-n' '-E' '-o' '-i'; do
    a=0; b=0
    out_a="$(grep "$form" 'beta' "$T/plain.txt" 2>/dev/null)" || a=$?
    out_b="$(command grep "$form" 'beta' "$T/plain.txt" 2>/dev/null)" || b=$?
    if [[ "$a:$out_a" == "$b:$out_b" ]]; then
        PASSED=$((PASSED + 1)); echo "  ✓ grep $form passes through"
    else
        FAILED=$((FAILED + 1)); echo "  ✗ grep $form differs: '$out_a' vs '$out_b'"
    fi
done
# stdin: `printf <input> | grep <flags> <pattern>` must give the exit status real grep gives.
check_stdin() {
    local label="$1" input="$2" flags="$3" pat="$4" a=0 b=0
    printf '%s' "$input" | grep "$flags" "$pat" || a=$?
    printf '%s' "$input" | command grep "$flags" "$pat" || b=$?
    if [[ $a -eq $b ]]; then
        PASSED=$((PASSED + 1)); echo "  ✓ stdin: $label (exit $a)"
    else
        FAILED=$((FAILED + 1)); echo "  ✗ stdin: $label: shortcut=$a real=$b"
    fi
}
check_stdin "-qF match"                     $'x\nbeta\n'       -qF 'beta'
check_stdin "-qF no match"                  $'x\nbeta\n'       -qF 'gamma'
check_stdin "-qE regex match"               $'x\nbeta\n'       -qE '^b[aeiou]ta$'
check_stdin "-qE regex no match"            $'x\nbeta\n'       -qE '^zeta$'
check_stdin "-q basic regex"                $'x\nbeta\n'       -q  'be.a'
check_stdin "empty stdin, -qF"              ''                 -qF 'x'
check_stdin "empty stdin, empty-line regex" ''                 -qE '^$'
check_stdin "blank lines kept, empty-line regex" $'a\n\n\n'    -qE '^$'
check_stdin "no blank line, empty-line regex"    $'a\nb\n'     -qE '^$'
check_stdin "no trailing newline"           'tail'             -qF 'tail'
check_stdin "pattern with a dash"           $'a\n-x\n'         -qF -- '-x' || true

# The race itself: the match is in the first line, the producer keeps writing. With real grep
# and pipefail this fails now and then (SIGPIPE, status 141); the shortcut must never fail.
race_fail=0
for _ in $(seq 1 15); do
    if ! { set -o pipefail; awk 'BEGIN { print "match"; for (i = 0; i < 20000; i++) print "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }' | grep -qF 'match'; }; then
        race_fail=$((race_fail + 1))
    fi
done
if [[ $race_fail -eq 0 ]]; then
    PASSED=$((PASSED + 1)); echo "  ✓ stdin: a producer that outlives the match never fails the pipeline (15 runs)"
else
    FAILED=$((FAILED + 1)); echo "  ✗ stdin: $race_fail of 15 runs failed with SIGPIPE"
fi

# A cached source file and a rewritten project file: the second read must see the new text.
printf 'one\n' > "$T/rewritten.txt"
grep -qF 'one' "$T/rewritten.txt"
printf 'two\n' > "$T/rewritten.txt"
if grep -qF 'one' "$T/rewritten.txt"; then
    FAILED=$((FAILED + 1)); echo "  ✗ a rewritten file was answered from stale text"
else
    PASSED=$((PASSED + 1)); echo "  ✓ a rewritten file is read again"
fi

echo
echo "=== Results (grep shim) ==="
echo "  Total:    $((PASSED + FAILED))"
echo "  Passed:   $PASSED"
echo "  Failed:   $FAILED"
[[ $FAILED -eq 0 ]]
