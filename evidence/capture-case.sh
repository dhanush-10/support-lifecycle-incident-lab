#!/usr/bin/env bash
# Saves HTTP status + JSON body of the read endpoints for the supplied case and the paused control.
# Usage: evidence/capture-case.sh OUTPUT_DIR [BASE_URL]   (default BASE_URL http://127.0.0.1:4328)
# Read-only: only GET requests are made. Files contain the status line, then the response body.
set -euo pipefail
out="${1:?usage: capture-case.sh OUTPUT_DIR [BASE_URL]}"
base="${2:-http://127.0.0.1:4328}"
mkdir -p "$out"

get() { # file, workspace-header-or-empty, path
  local file="$1" workspace="$2" path="$3"
  local args=(-sS -o "$out/$file.body" -w '%{http_code}')
  [ -n "$workspace" ] && args+=(-H "x-lab-workspace: $workspace")
  local status; status="$(curl "${args[@]}" "$base$path")"
  { echo "GET $path  (x-lab-workspace: ${workspace:-none})"; echo "HTTP $status"; cat "$out/$file.body"; echo; } > "$out/$file.txt"
  rm -f "$out/$file.body"
}

get health ""            /health
for resource in "" /records /results /events; do
  name="${resource#/}"; name="${name:-detail}"
  get "cedar-case-002-$name"   cedar-demo "/imports/case-002$resource"
  get "maple-control-002-$name" maple-demo "/imports/control-002$resource"
done
get cross-workspace-case-002-under-maple   maple-demo "/imports/case-002"
get cross-workspace-control-002-under-cedar cedar-demo "/imports/control-002"
date -u +"captured_at_utc=%Y-%m-%dT%H:%M:%SZ" > "$out/captured-at.txt"
