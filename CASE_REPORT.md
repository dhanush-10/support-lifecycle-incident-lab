# Case report — PSE-A2-002

Fictional training case. Every customer message below is a **draft in this report**; nothing was sent, no ticket was created and nothing was deployed. Two clocks are used and kept apart:

- **Simulated policy clock** (SIM-1): Monday 26 October 2026, GST/MYT times as labelled below.
- **Actual execution time**: the lab commands ran on 2026-10-29 around 10:44–10:48 UTC (see `captured-at.txt` in each evidence folder). No real hours elapsed between the simulated checkpoints, and neither clock is the real submission deadline.

Labels used: **Customer-reported** (what the customer said), **Verified** (observed in this lab, evidence linked), **Hypothesis** / **Assumption**, **Awaiting** (not yet done by anyone).

## 1. Summary and impact

- **Priority / rationale:** P2, as assigned. One customer workspace (`cedar-demo`) has an import marked complete while some of its records were never processed, which blocks that customer's continued work. There is no supplied evidence of an outage, security incident or legal/tax deadline, and I did not find any. The safe workaround (the single-record import flow for genuinely new records) is limited: it does **not** recover the five unprocessed records already in the case, and it does not help for larger files.
- **Current status:**
  - Local fix: **verified in the local lab** (tests, isolated reproduction, and the original lab case recovered).
  - Independent engineering review: **awaiting** (requested in section 5).
  - Release / production restoration: **awaiting** — not done and not claimed.
  - Customer verification: **awaiting** — the customer has not been contacted.
- **Reported observation (customer-reported, not a diagnosis):** 12 records accepted, job shows complete, only 7 results visible; asks whether to upload again.
- **Verified baseline** (original lab database, unpatched code, captured 2026-10-29T10:44:59Z, [evidence/01-baseline-before-fix](evidence/01-baseline-before-fix/)):
  - `GET /imports/case-002` → HTTP 200, `state: completed`, `total: 12`, `processed: 7`, `pending: 5` — the status label and the counters contradict each other.
  - Records: all 12 source rows are stored (ids 1–12, `DOC-001`–`DOC-012`). ids 1–5, 11, 12 are `processed`; ids 6–10 (`DOC-006`–`DOC-010`) are still `pending`.
  - Results: exactly 7, for record ids 1, 2, 3, 4, 5, 11, 12, all correctly normalized (`SAMPLE 001` …). No duplicates.
  - Events: `import_created`, `processing_started`, `batch_processed` `[1,2,3,4,5]`, `batch_processed` `[11,12]`, `processing_completed`. No `processing_failed`.
  - Control `maple-demo / control-002`: `paused`, 3 pending, 0 results. `case-002` under the Maple selector and `control-002` under the Cedar selector both return HTTP 404.
- **Workaround / safety:**
  - For genuinely new records, use the single-record import flow. Single-record imports processed correctly in my lab runs (the 1-row case in the [pre-fix matrix](evidence/02-isolated-reproduction-before-fix/volume-matrix-before-fix.txt)).
  - Do **not** re-upload the 12-record file or any partly processed file: every POST creates a new import with no deduplication, so a re-upload would create a second import, duplicate the seven records that already have results, and is not guaranteed to avoid the same problem.
  - Do not delete prior results or replay accepted work. The existing case must be reconciled (which records already have results) and resumed, not re-imported.

## 2. Draft customer communications

All messages are drafts, not sent to a real customer.

### Acknowledgment — simulated 26 October 2026, 09:35 GST / 13:35 MYT

> **Subject: [PSE-A2-002] Your import shows complete but only 7 of 12 results are visible — we are investigating**
>
> Hello,
>
> Thank you for reporting this, and I'm sorry for the disruption to your work. I understand that you uploaded 12 records, the import was accepted and shows as complete, but you can see results for only seven of them.
>
> I own this case and I have started investigating now. I have not yet verified what happened, so I can't tell you the cause or confirm whether any records are missing. What I am doing first is checking, for your import, which records were accepted, which have results, and what the processing log shows.
>
> **Please do not upload the file again for now.** Each upload creates a separate new import, and re-uploading could duplicate the seven records that already have results without fixing the five that don't. If you have genuinely new records you need to submit in the meantime, please use the single-record import, which is our approved temporary workaround for new records only. It does not recover the current import.
>
> I will send you a progress update **by 10:00 GST / 14:00 MYT today**, even if there is nothing new to report.
>
> Kind regards,
> [Support engineer name], Complyance Support

### Checkpoint update — simulated 10:00 GST / 14:00 MYT

> **Subject: [PSE-A2-002] Update 1 — what we have confirmed so far**
>
> Hello,
>
> Here is where things stand at this checkpoint.
>
> **What we have confirmed (read-only checks, nothing changed):** your import contains all 12 records, so the upload itself was received in full. Seven records have results and five (`DOC-006` to `DOC-010`) are still waiting to be processed, even though the import is labelled "complete". The processing log shows the import finishing without any recorded error, and the existing seven results look correct. Other workspaces are not involved: your data is not visible from another workspace and we have seen no sign of one.
>
> **What we have not established yet:** why the five records were skipped and the import still showed complete. I am not going to guess at the cause. I am now reproducing the behaviour with synthetic data in a separate test environment so we don't touch your import.
>
> **What to do meanwhile:** please still do not re-upload this file. Genuinely new records can use the single-record import. Your existing 7 results are intact.
>
> **Next:** I will identify the cause and tell you what I can verify, including how we can complete your existing import without re-uploading. I cannot give a restoration time yet. My next update will be **by 12:00 GST / 16:00 MYT today**, or sooner if something changes.
>
> Kind regards,
> [Support engineer name]

(12:00 GST / 16:00 MYT is my own chosen follow-up checkpoint; the policy card supplies none.)

### Final update / conditional closure — simulated 26 October 2026, 13:00 GST / 17:00 MYT (chosen)

> **Subject: [PSE-A2-002] Update 2 — cause identified and fix verified in our test environment; awaiting review and release**
>
> Hello,
>
> **What we found:** the problem was in how the background processor picks the next batch of records. When an import has more records than fit in one batch, it skipped some pending records and then marked the import complete. In your import this left five records (`DOC-006`–`DOC-010`) unprocessed. We reproduced it with synthetic data and confirmed it affects imports larger than one processing batch generally, not just yours. Single-record imports and small files are not affected.
>
> **What we have verified — in our test environment only:** we made a small fix and tested it across file sizes and batch settings. In our test copy of your case, the existing import was resumed with the approved recovery step: all 12 records now have results, the seven earlier results were kept unchanged, nothing was duplicated, and no records were re-uploaded.
>
> **What is not done yet:** the fix has **not** been independently reviewed or released, and your own import has **not** been recovered. I have asked engineering to review and release the fix and to approve the recovery of your existing import. I can't give a release or restoration time because none has been agreed.
>
> **What we need from you:** please keep waiting before re-uploading. We would like to confirm with you once recovered that all 12 results are visible.
>
> **Next update:** by **10:00 GST / 14:00 MYT on Tuesday 27 October**, or sooner when the review decision is known. I'll keep owning this case until you confirm. I plan to close it only after (1) the fix is released, (2) your existing import is resumed and shows 12 of 12 processed, and (3) you confirm the results are as expected. If a further issue appears, we will reopen it.
>
> Kind regards,
> [Support engineer name]

## 3. Reproduction and root cause

- **Environment and steps:**
  - Runtime: Linux x86_64, Bun 1.4.4 (installed with `npm install -g bun`), Node v22.22.2, Vitest 3.2.7, from `starter/` with `bun install --frozen-lockfile`. The starter README's recorded validation was macOS ARM64; this run was Linux.
  - Original case (unpatched code, default config: port 4328, batch size 5, `.data/lab.sqlite`): `bun run start`, then `evidence/capture-case.sh evidence/01-baseline-before-fix` — [evidence/01-baseline-before-fix](evidence/01-baseline-before-fix/).
  - Required reproduction through the CSV import API on an **isolated** database (`SUPPORT_LAB_DB=/tmp/.../repro-b5.sqlite`, port 4329, batch size 5): `evidence/reproduce-import.sh evidence/02-isolated-reproduction-before-fix http://127.0.0.1:4329 12 fixtures/case-002.csv` (`POST /imports`, `x-lab-workspace: cedar-demo`, `Content-Type: text/csv`, fixture unchanged). Result: HTTP 202 then `completed`, `total 12`, `processed 7`, `pending 5`; events `batch_processed [16..20]` and `[26,27]` — [evidence/02-isolated-reproduction-before-fix](evidence/02-isolated-reproduction-before-fix/). This reproduction is independent of the customer's case and did not replay it.
  - Characterisation across volumes and batch sizes (unpatched): [volume-matrix-before-fix.txt](evidence/02-isolated-reproduction-before-fix/volume-matrix-before-fix.txt).
- **Expected versus observed:**

  | | Expected (README invariants) | Observed before fix |
  | --- | --- | --- |
  | Source rows | every accepted row processed once | rows 6–10 never processed |
  | Results | one genuine result per processed row; 12 for 12 rows | 7 results (ids 1–5, 11, 12) |
  | Completion | `completed` only when no rows pending and `processed == total` | `completed` with `pending: 5` |
  | Events | batches of ≤ 5 covering every record id exactly once | `[1..5]` and `[11,12]` only; ids 6–10 in no batch |

  Pre-fix matrix (batch size 5): 1–5 rows fully processed; 6 rows → 5 processed; 10 rows → 5; 12 → 7; 15 → 10; 25 → 15; 200 → 100. With batch size 3: 3 rows OK, 4 rows → 3, 12 → 6, 200 → 101. Every import larger than the batch size was left incomplete yet `completed`.
- **Causal explanation (confirmed):** `src/worker.ts` `processImport` fetched each batch with `repository.pendingBatch(..., batchSize, offset)` and then did `offset += batch.length`. `pendingBatch` (`src/repository.ts`) selects `WHERE state = 'pending' ... LIMIT ? OFFSET ?`. Rows committed in a previous batch are already `processed`, so they have **left** the result set; adding an offset on top skips that many *still-pending* rows. Trace for 12 rows, batch size 5:

  | Loop | `offset` | Pending rows at query time | `OFFSET` result | Action |
  | --- | --- | --- | --- | --- |
  | 1 | 0 | 1–12 | ids 1–5 | commit, `offset = 5` |
  | 2 | 5 | 6–12 (7 rows) | skips 6–10 → ids 11, 12 | commit, `offset = 7` |
  | 3 | 7 | 6–10 (5 rows) | skips 7 rows → empty | `break` |

  The loop exits on an empty batch, and `finishImport` only checks that the import is `running` — never that nothing is pending — so the import is set to `completed` and `processing_completed` is emitted with five rows pending. This matches the baseline exactly (processed 1–5, 11, 12; batches `[1..5]`, `[11,12]`) and explains why imports of 5 rows or fewer (a single batch, so the offset is never used) are unaffected.
- **Facts, hypotheses and rejected explanations:**

  | Item | Status | Basis |
  | --- | --- | --- |
  | Offset-after-filter skips pending rows | Confirmed cause | source trace above; reproduced; 32 regression tests fail before the fix and all pass after it with only this change |
  | Upload truncated / rows not stored | Rejected | all 12 records stored (baseline records) |
  | Partial transaction / corrupt batch | Rejected | each batch event lists exactly the rows with results; batches commit atomically in `commitBatch` |
  | Normalization defect | Rejected | all results equal `label.trim().toUpperCase()` |
  | Worker exception | Rejected | no `processing_failed` event, state `completed` |
  | Workspace-isolation defect | Rejected | cross-workspace requests return 404; control unchanged |
  | Customer double-submission | Not applicable | one import only; no evidence of a second |
  | Same defect in production data | **Not verified** | I have no production access; only the lab shows the code path |
  | Contributing factor: starter tests never exceed one batch | Verified | the 25 starter tests pass on the buggy code ([evidence](evidence/03-tests/starter-suite-before-fix.txt)) |
  | Contributing factor: completion not validated against pending rows | Verified by code reading | `finishImport` has no pending check; **not changed** (see limitations) |
- **Permanent change:** two files, [diff](evidence/03-tests/fix.diff).
  - `src/worker.ts`: removed `offset`; every iteration now takes the first pending rows. Comment explains why.
  - `src/repository.ts`: removed the now-unused `offset` parameter and `OFFSET ?` from `pendingBatch`, so the faulty pattern cannot be reintroduced by a caller.
  - Public API, validation, batch size (still ≤ the configured size), fixtures and workspace checks are unchanged.

## 4. Tests and existing-case reconciliation

New file `tests/batch-processing.test.ts` (46 tests) plus helper `tests/support/rewind-case.ts`. Tests start the real Bun HTTP server on an isolated temporary database and assert exact record ids, result identities and normalized values, batch composition and size, event order, and the unchanged control.

| Check | Actual result and evidence |
| --- | --- |
| Regression: failure before, success after | Before fix (`bunx vitest run tests/batch-processing.test.ts`): **32 failed, 14 passed** ([output](evidence/03-tests/regression-before-fix.txt)); failures show `state: "completed"` with `pending > 0`. The 14 passes are volumes not larger than the batch size, the batch-20 seed-case test, and the two recovery tests (the recovery case has 5 pending rows, which fits one batch). After fix (`bun run test`): **71 passed (71)** — 46 new + 25 starter ([output](evidence/03-tests/full-suite-after-fix.txt)). |
| Varied volumes, batch boundaries, different batch size | `describe.each` over batch sizes 1, 3, 5, 20; volumes 1, B−1, B, B+1, 2B−1, 2B, 2B+1, 12, 25 and 200 per size. Asserts exact record ids, `normalizedLabel`, one result per record, batch counts equal to the expected full-batches-then-remainder list, every batch ≤ B, and every record id in exactly one batch in order. Isolated API matrix after fix: all 42 volume/batch runs `pending=0` ([evidence/07](evidence/07-isolated-verification-after-fix/volume-matrix-after-fix.txt)); reported fixture: batches 5, 5, 2 ([evidence](evidence/07-isolated-verification-after-fix/case-002-fixture-batch5/events.txt)). |
| API validation and workspace isolation | All 25 starter tests still pass (CSV rejection, selectors, 404s, UTF-8/size limits, restart persistence). New test processes a large Maple import and checks Cedar gets 404 on all four resources. `tsc --noEmit` passes ([output](evidence/03-tests/check-types-after-fix.txt)). |
| Original case before recovery | [evidence/01](evidence/01-baseline-before-fix/) (unpatched) and [evidence/04](evidence/04-pre-recovery-patched-server-running/) (patched server running, before resume): both `completed 12/7/5`, byte-identical — **startup does not auto-repair**. Source ids 1–12, results for 1–5, 11, 12. |
| Patched-worker restart and approved `resume-case` | Patched server restarted on the original database; `bun run resume-case` → `{"id":"case-002","workspaceId":"cedar-demo","state":"queued","pending":5}`, exit 0 ([output](evidence/05-recovery/resume-case-output.txt)). The restarted worker then processed the queued job: new events `resume_requested {pending:5}`, `processing_started`, `batch_processed {recordIds:[6,7,8,9,10],count:5}`, `processing_completed` ([evidence/06](evidence/06-post-recovery/cedar-case-002-events.txt)). The acknowledgment alone was not treated as recovery. |
| Original case after recovery | `completed`, `total 12`, `processed 12`, `pending 0`; same source ids 1–12; results for ids 1–12; the 7 earlier results retained unchanged; 0 duplicate result ids; earlier events preserved as a prefix; only ids 6–10 were processed again ([comparison](evidence/06-post-recovery/comparison.txt)). Automated equivalent: recovery test in `batch-processing.test.ts`. |
| Paused Maple control | `paused`, 3 pending, 0 results, single `import_created` event; all four control files byte-identical before and after ([comparison](evidence/06-post-recovery/comparison.txt)). Also asserted in the test suite for every batch size. |

**Not run / not verified:** production behaviour; Windows and macOS execution (Linux only); any independent review or release; the customer's own view of the recovered import; `bun run reset` (deliberately not used, since it would delete the original case and its evidence).
A command acknowledgment or local passing tests do not establish production restoration.

## 5. Escalation and customer ownership

- **Decision and reason: escalate now — request independent review and release; Support keeps the customer.** Reasons: (1) the root cause is a code defect in the shared processing path, which Support may fix locally but must not release or apply to production data; (2) the lab shows the failure is **general** — any import larger than the batch size is silently left incomplete and still marked `completed`, in either workspace — so other customers' imports could be affected, and Support cannot assess that without production access; (3) recovering the real customer import requires an approved, reviewed replay, which this lab authorisation does not extend to. I did **not** find a security issue, cross-workspace leakage or evidence of an actual production outage, and I have not claimed any. I recommend keeping P2 but asking engineering to confirm scope; no P1 evidence exists.
- **Continuity:** Support owner: me (the support engineer on PSE-A2-002), until the customer confirms. Next customer update: by 10:00 GST / 14:00 MYT on Tuesday 27 October 2026 (simulated), or sooner on a review/release decision. Next requested action: engineering review of the two-file change. The requested engineering owner below is a **request**, not an accepted owner; no acceptance, approval, deployment or ETA exists.
- **Linear-ready draft** (not created in Linear):

  > **Title:** Imports larger than one worker batch are marked `completed` with pending records (worker `OFFSET` skip) — PSE-A2-002
  >
  > **Priority / impact:** P2. Cedar Demo Malaysia (fictional) import `case-002`: 12 accepted, 7 results, state `completed`, 5 pending. Customer is blocked from continuing work; no outage, security or deadline evidence. **Possible wider impact:** the defect is in the shared worker path, so any import with more records than the configured batch size (default 5) can be silently incomplete. Production exposure not assessed — no production access.
  >
  > **Reproduction (local lab, synthetic data):** isolated DB, batch size 5, `POST /imports` with `fixtures/case-002.csv` → `completed`, `processed 7`, `pending 5`, events `batch_processed [..5 ids..]` and `[2 ids]` then `processing_completed`. Matrix: 1–5 rows OK; N > 5 rows processes fewer than N (e.g. 200 → 100). Evidence: `evidence/01…02`.
  >
  > **Confirmed finding:** `processImport` (`src/worker.ts`) advances `offset` after each committed batch while `pendingBatch` (`src/repository.ts`) already filters `state = 'pending'`; processed rows leave the filter, so `OFFSET` skips unprocessed rows. The loop ends on an empty batch and `finishImport` does not check pending rows.
  >
  > **Local change and tests:** remove `offset` from the worker loop and `pendingBatch`. 46 new Vitest regression tests (32 fail before, all pass after; 71/71 total with the starter suite); original lab case resumed with `bun run resume-case`: 12/12, prior 7 results retained, no duplicates, paused control unchanged. Evidence: `evidence/03…07`.
  >
  > **Request:** (1) review and, if approved, release the fix; (2) assess whether any production imports are `completed` with pending records and tell Support the scope; (3) approve or perform the recovery of the real customer import, with the replay procedure — Support has authority only for the lab command; (4) consider hardening `finishImport` to refuse completion while rows are pending (not implemented here).
  >
  > **Requested owner / checkpoint:** import-processing engineering owner (requested, not accepted); review decision by 10:00 GST on 27 October 2026 (simulated).
  >
  > **Pending decisions:** review outcome, release/deploy decision, production scope assessment, production recovery approval, customer verification. No engineering acceptance, release or restoration ETA exists.
- **Exit criteria:** close only when (1) the fix is reviewed and released, (2) the real customer import is resumed and shows 12/12 with prior results retained, (3) the customer confirms, and (4) engineering has reported the scope assessment. Re-engage engineering if the review rejects the fix, if production shows other incomplete imports, if the customer reports anything beyond the 5 known records, or if any duplicate/cross-workspace data appears. No restoration ETA is given.

## 6. Submission notes

- **Evidence index** (all small, synthetic, no secrets):
  - [01-baseline-before-fix](evidence/01-baseline-before-fix/) — original case and control, unpatched (HTTP status + JSON).
  - [02-isolated-reproduction-before-fix](evidence/02-isolated-reproduction-before-fix/) — API reproduction and pre-fix volume matrix.
  - [03-tests](evidence/03-tests/) — starter suite before, regression suite before (32 fail), full suite after (71 pass), type check, [fix.diff](evidence/03-tests/fix.diff).
  - [04-pre-recovery-patched-server-running](evidence/04-pre-recovery-patched-server-running/) — patched server, no auto-repair.
  - [05-recovery](evidence/05-recovery/) — `resume-case` output and server start log.
  - [06-post-recovery](evidence/06-post-recovery/) — final state and [comparison](evidence/06-post-recovery/comparison.txt).
  - [07-isolated-verification-after-fix](evidence/07-isolated-verification-after-fix/) — post-fix fixture run and volume matrix.
  - Scripts: [capture-case.sh](evidence/capture-case.sh), [reproduce-import.sh](evidence/reproduce-import.sh), [volume-matrix.sh](evidence/volume-matrix.sh).
- **AI assistance:** Claude (Anthropic) assisted with reading the scenario, investigating the code, writing the fix, regression tests, evidence scripts, this report and the README. The AI ran every command shown (type check, tests, API reproduction, recovery) and the outputs in `evidence/` are the real outputs of those runs. The submitted application has no AI integration. The trace table and diff in section 3 are the basis for explaining the work.
- **Limitations:**
  - Local lab only; no production restoration, release or customer confirmation is claimed.
  - Linux only; Windows/macOS not exercised. Bun was installed through npm in my environment.
  - The completion invariant is still not enforced in `finishImport` — deliberately left out to keep the change narrow; recommended in the ticket.
  - The automated recovery test rewinds rows with a test-only Bun helper to recreate the old worker's end state; the real recovery proof is the original-database run in evidence 04–06.
  - Pre-fix volume numbers are from my runs of the unpatched code; the loop behaviour for other volumes is described by the trace, not exhaustively tested beyond the matrix.
  - The 12:00 GST follow-up and the 13:00 GST final-update times are chosen by me for the exercise; the policy card only fixes the first-response and 10:00 GST update times.
