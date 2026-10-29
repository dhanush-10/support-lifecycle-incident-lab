#!/usr/bin/env bash
# Creates a NEW synthetic import (POST /imports) in the workspace cedar-demo, waits for the worker to
# finish, and saves the HTTP evidence. Use only against an isolated lab database, never to "replay" case-002.
# Usage: evidence/reproduce-import.sh OUTPUT_DIR BASE_URL ROW_COUNT [CSV_FILE]
# With no CSV_FILE it generates ROW_COUNT rows DOC-001.. labelled "Sample 001"..; with CSV_FILE it posts that file.
set -euo pipefail
out="${1:?output dir}"; base="${2:?base url}"; rows="${3:?row count}"; csv_file="${4:-}"
mkdir -p "$out"
csv="$out/request.csv"
if [ -n "$csv_file" ]; then cp "$csv_file" "$csv"; else
  { echo "document_ref,label"; for i in $(seq 1 "$rows"); do printf 'DOC-%03d,Sample %03d\n' "$i" "$i"; done; } > "$csv"
fi
create_status=$(curl -sS -o "$out/create.body" -w '%{http_code}' -H 'x-lab-workspace: cedar-demo' -H 'Content-Type: text/csv' --data-binary @"$csv" "$base/imports")
id=$(sed -E 's/.*"id":"([^"]+)".*/\1/' "$out/create.body")
{ echo "POST /imports  (x-lab-workspace: cedar-demo, Content-Type: text/csv, body: request.csv)"; echo "HTTP $create_status"; cat "$out/create.body"; echo; } > "$out/create.txt"; rm "$out/create.body"
for _ in $(seq 1 200); do
  state=$(curl -sS -H 'x-lab-workspace: cedar-demo' "$base/imports/$id" | sed -E 's/.*"state":"([^"]+)".*/\1/')
  [ "$state" = completed ] || [ "$state" = failed ] && break; sleep 0.05
done
for resource in "" /records /results /events; do
  name="${resource#/}"; name="${name:-detail}"
  { echo "GET /imports/$id$resource  (x-lab-workspace: cedar-demo)"; curl -sS -w '\nHTTP %{http_code}\n' -H 'x-lab-workspace: cedar-demo' "$base/imports/$id$resource"; } > "$out/$name.txt"
done
echo "$id"
