#!/usr/bin/env bash
# For each row count, POSTs a fresh synthetic import to the server at BASE_URL and prints the final
# state, total, processed and pending. Isolated lab databases only.
# Usage: evidence/volume-matrix.sh BASE_URL
set -euo pipefail
base="${1:?base url}"; here="$(cd "$(dirname "$0")" && pwd)"
for rows in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 20 25 40 100 200; do
  dir="$(mktemp -d)"; "$here/reproduce-import.sh" "$dir" "$base" "$rows" > /dev/null
  line="$(grep '"state"' "$dir/detail.txt" | sed -E 's/.*"state":"([^"]+)","total":([0-9]+),"processed":([0-9]+),"pending":([0-9]+).*/state=\1 total=\2 processed=\3 pending=\4/')"
  printf '%-4s rows -> %s\n' "$rows" "$line"; rm -rf "$dir"
done
