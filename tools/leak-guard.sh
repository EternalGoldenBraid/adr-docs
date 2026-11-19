#!/usr/bin/env bash
# Blocks commits and pushes of this public repo that contain private strings.
# The patterns live outside the repo (one case-insensitive extended regex per line):
#   ${ADR_DENYLIST:-~/.config/adr/denylist}
# usage: leak-guard.sh staged | leak-guard.sh range <rev-range>
set -u
list=${ADR_DENYLIST:-$HOME/.config/adr/denylist}
if [ ! -s "$list" ]; then echo "leak-guard: no denylist at $list, nothing checked" >&2; exit 0; fi
pattern=$(grep -v '^\s*\(#\|$\)' "$list" | paste -sd'|')
[ -z "$pattern" ] && exit 0
case ${1:-} in
  staged) diff=$(git diff --cached -U0 --no-color); names=$(git diff --cached --name-only) ;;
  range)  diff=$(git log -p -U0 --no-color "$2"); names=$(git diff --name-only "$2" 2>/dev/null) ;;
  *) echo "usage: $0 staged | range <rev-range>" >&2; exit 2 ;;
esac
hits=$({ printf '%s\n' "$diff" | grep -E '^\+[^+]' ; printf '%s\n' "$names"; } | grep -inE "$pattern" | cut -c1-140)
if [ -n "$hits" ]; then
  echo "leak-guard: private pattern found (see $list):" >&2
  printf '%s\n' "$hits" | head -10 >&2
  echo "Remove it, or keep this change local. Bypass only on purpose: git commit --no-verify" >&2
  exit 1
fi
