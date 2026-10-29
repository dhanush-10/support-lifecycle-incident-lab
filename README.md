# PSE-A2-002 — Support lifecycle lab (patched)

Submission for Assignment 2: the supplied TypeScript/Bun lab application **with the fix for the
incomplete-import defect**, regression tests, recovery evidence and the case report.

- **Case report:** [`CASE_REPORT.md`](CASE_REPORT.md) (communications, root cause, tests, escalation).
- **Original lab documentation** (API contract, configuration, commands): [`STARTER_README.md`](STARTER_README.md), unchanged.
- **Evidence:** [`evidence/`](evidence/) — real outputs captured while doing the work.

## The problem and the fix, in short

An import with more records than the configured batch size (default 5) was marked `completed` while
some records were never processed (reported case: 12 accepted, 7 results). The worker advanced an
`OFFSET` over a query that already excludes processed rows, so it skipped pending rows. The fix removes
the offset from `src/worker.ts` and `src/repository.ts` (diff: [`evidence/03-tests/fix.diff`](evidence/03-tests/fix.diff)).
No API, validation, batch-size, fixture or workspace behaviour changed.

## Prerequisites

- Bun 1.3 or newer (`bun --version`) and Node.js 22 or newer (`node --version`); see `STARTER_README.md` for install links.
- No Docker, external database, credentials or network service.

## Setup, run, test

From the repository root:

```sh
bun install --frozen-lockfile
bun run check-types      # tsc --noEmit
bun run test             # Vitest, starts the real Bun server on temporary databases
bun run start            # http://127.0.0.1:4328 with .data/lab.sqlite
```

### Sample curl health check

After starting the server, run this Windows PowerShell command in another terminal:

```powershell
curl.exe -sS -i http://127.0.0.1:4328/health
```

Expected response:

```text
HTTP/1.1 200 OK
content-type: application/json

{"status":"ok","mode":"training","batchSize":5}
```

Environment variables `SUPPORT_LAB_DB`, `SUPPORT_LAB_PORT` and `SUPPORT_LAB_BATCH_SIZE` are described in `STARTER_README.md`.

### Inspect and recover the original case

```sh
evidence/capture-case.sh my-evidence-dir          # read-only GET requests (server must be running)
# stop the server, then with the PATCHED code:
bun run resume-case                               # lab-only; prints an acknowledgment, does not process records
bun run start                                     # the worker processes the queued case
evidence/capture-case.sh my-evidence-dir-after
```

`evidence/reproduce-import.sh` and `evidence/volume-matrix.sh` create *new synthetic imports* and must
only be used against an isolated `SUPPORT_LAB_DB`, never to replay the original case. Do not run
`bun run reset` unless you intend to delete the local database.

## Actual results

Environment: Linux x86_64, Bun 1.4.4, Node v22.22.2, Vitest 3.2.7.

| Command / check | Result |
| --- | --- |
| `bun run check-types` | exit 0 ([output](evidence/03-tests/check-types-after-fix.txt)) |
| Starter suite on the unpatched code | 25 passed — it never uses an import larger than one batch ([output](evidence/03-tests/starter-suite-before-fix.txt)) |
| New regression suite on the unpatched code | **32 failed, 14 passed** of 46 ([output](evidence/03-tests/regression-before-fix.txt)) |
| `bun run test` after the fix | **71 passed (71)**: 46 new + 25 starter, 2 files ([output](evidence/03-tests/full-suite-after-fix.txt)) |
| Original case, before | `completed`, total 12, processed 7, pending 5 ([evidence/01](evidence/01-baseline-before-fix/)) |
| Original case, after patch + `resume-case` + worker | `completed`, 12 processed, 0 pending; prior 7 results kept; only ids 6–10 processed; no duplicates ([evidence/06](evidence/06-post-recovery/comparison.txt)) |
| Paused Maple control | unchanged before/after ([evidence/06](evidence/06-post-recovery/comparison.txt)) |
| Isolated API volume matrix after fix | 42 of 42 runs `pending=0` ([evidence/07](evidence/07-isolated-verification-after-fix/volume-matrix-after-fix.txt)) |

What the new tests cover (`tests/batch-processing.test.ts`): batch sizes 1, 3, 5 and 20; volumes at and
around every batch boundary plus 12, 25 and 200; exact record ids, normalized values, one result per
record, bounded batches that contain each record id exactly once, event order, workspace isolation and
the unchanged paused control; and the `resume-case` recovery path (rewound via `tests/support/rewind-case.ts`).

## Known limitations

- Local lab verification only: nothing is released, reviewed by engineering, or confirmed by a customer.
- Verified on Linux only; the starter documentation records macOS ARM64 validation.
- `finishImport` still does not refuse to complete an import that has pending rows (left out to keep the
  fix narrow; recommended in the escalation draft in `CASE_REPORT.md`).
- Recovery of the real case was run on a local lab database; it is not a production replay.

## AI assistance disclosure

An AI coding assistant (Claude, by Anthropic) was used to investigate the code, write the fix, the
regression tests, the evidence scripts and the documentation, and to run the commands. The evidence
files are the genuine output of those runs, including the failing test run before the fix. The
application itself has no AI integration. Details are in section 6 of `CASE_REPORT.md`.
