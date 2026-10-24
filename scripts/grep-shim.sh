#!/bin/bash
# Test-suite speed-up: `grep -qF <text> <file>` without starting a process.
#
# Sourced by test-fixtures.sh, so every suite gets it. About 1400 guards ask exactly this
# question, and on Windows a process start costs ~40 ms, which is most of what the suite
# spends. The function answers it inside the shell and hands every other form of `grep`
# (regex, counts, line numbers, stdin, several files, options) to the real one untouched.
#
# The fast path is taken only when the answer is provably the same:
#   - exactly `grep -qF <pattern> <file>` (also `-Fq`), a regular file;
#   - the pattern is non-empty, has no newline (that would be several patterns), no carriage
#     return (grep of Git Bash drops the CR of a CRLF file, the shell keeps it) and does
#     not start with `-` (real grep would read it as an option).
# A substring test over the whole file equals the per-line test because the pattern has no
# newline. A file that is a copy of a tracked source tree is read once and cached; any other
# file is read again on each call, since suites rewrite their own project files.
#
# The quiet stdin form (`... | grep -qF x`, `... | grep -qE x`) is drained before the answer,
# see the comment at the branch. UNIKIT_TEST_REAL_GREP=1 switches the function off. scripts/test-grep-shim.sh pins the
# equivalence with real grep.

if [[ "${UNIKIT_TEST_REAL_GREP:-0}" != "1" ]]; then
    declare -A GREP_SHIM_CACHE=()

    grep() {
        if [[ $# -eq 3 && ( $1 == -qF || $1 == -Fq ) && -n $2 && $2 != -* \
              && $2 != *$'\n'* && $2 != *$'\r'* && -f $3 && -r $3 ]]; then
            local _gs_file="$3" _gs_text
            case "$_gs_file" in
                "${ROOT_DIR:-/nonexistent}"/skills/* | "${ROOT_DIR:-/nonexistent}"/subagents/* | \
                "${ROOT_DIR:-/nonexistent}"/data/* | "${ROOT_DIR:-/nonexistent}"/docs/* | \
                "${ROOT_DIR:-/nonexistent}"/mcp/* | "${ROOT_DIR:-/nonexistent}"/src/*)
                    if [[ -z ${GREP_SHIM_CACHE[$_gs_file]+x} ]]; then
                        GREP_SHIM_CACHE[$_gs_file]="$(<"$_gs_file")"
                    fi
                    _gs_text="${GREP_SHIM_CACHE[$_gs_file]}"
                    ;;
                *)
                    _gs_text="$(<"$_gs_file")"
                    ;;
            esac
            [[ $_gs_text == *"$2"* ]]
            return
        fi
        # `<producer> | grep -q[F|E] <pattern>`: a quiet grep leaves at the first match, the
        # producer is still writing, gets SIGPIPE, and `set -o pipefail` turns the pipeline
        # red (status 141) in a run where the pattern WAS there. It depends on timing, so it
        # shows on a fast Linux runner and never on a slow machine. Reading all of stdin
        # first lets the producer finish; the search itself is unchanged.
        if [[ $# -eq 2 && $1 == -*q* && $1 != --* && $2 != -* ]]; then
            # `cat` reads in blocks (the builtin `read` takes one byte at a time from a pipe);
            # the sentinel keeps the trailing newlines the substitution would strip.
            local _gs_in=""
            _gs_in="$(cat; printf x)"
            _gs_in="${_gs_in%x}"
            if [[ ( $1 == -qF || $1 == -Fq ) && -n $2 && $2 != *$'\n'* && $2 != *$'\r'* ]]; then
                [[ $_gs_in == *"$2"* ]]
                return
            fi
            command grep "$@" < <(printf '%s' "$_gs_in")
            return
        fi
        command grep "$@"
    }
fi
