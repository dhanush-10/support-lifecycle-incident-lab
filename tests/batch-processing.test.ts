import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { json, object, objects, startLab, starterDirectory, waitForCompletion, type RunningLab } from "./harness";

// Regression tests for PSE-A2-002: an import larger than the configured batch size was marked
// "completed" although some source records were never processed. Every test here uses the real HTTP
// application and checks exact record/result identities, not just counters or the "completed" label.

interface Row { documentRef: string; label: string }

const cedar = { "x-lab-workspace": "cedar-demo" };
const maple = { "x-lab-workspace": "maple-demo" };

/** Rows DOC-001.. with mixed-case, padded labels so normalization (trim + uppercase) is exercised. */
function syntheticRows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(3, "0");
    return { documentRef: `DOC-${number}`, label: `  sample ${number} mIxEd ` };
  });
}

function toCsv(rows: readonly Row[]): string {
  return `document_ref,label\n${rows.map((row) => `${row.documentRef},"${row.label}"`).join("\n")}\n`;
}

/** The expected batch sizes: full batches first, then the remainder. */
function expectedBatchSizes(total: number, batchSize: number): number[] {
  const sizes = Array.from({ length: Math.floor(total / batchSize) }, () => batchSize);
  if (total % batchSize !== 0) sizes.push(total % batchSize);
  return sizes;
}

async function createImport(lab: RunningLab, csv: string, headers: Record<string, string> = cedar): Promise<string> {
  const response = await fetch(`${lab.url}/imports`, { method: "POST", headers: { ...headers, "content-type": "text/csv" }, body: csv });
  expect(response.status).toBe(202);
  const body = await json(response);
  if (typeof body.id !== "string") throw new Error("Create did not return a string import ID");
  return body.id;
}

async function readResource(lab: RunningLab, id: string, resource = "", headers: Record<string, string> = cedar): Promise<Record<string, unknown>> {
  const response = await fetch(`${lab.url}/imports/${id}${resource}`, { headers });
  expect(response.status).toBe(200);
  return json(response);
}

function batchesOf(events: Record<string, unknown>[]): { recordIds: number[]; count: number }[] {
  return events.filter((event) => event.type === "batch_processed").map((event) => {
    const details = object(event.details);
    if (!Array.isArray(details.recordIds) || typeof details.count !== "number") throw new Error("Malformed batch_processed event");
    return { recordIds: details.recordIds.map(Number), count: details.count };
  });
}

/** Asserts the full processing invariants for one import. */
async function expectFullyProcessed(lab: RunningLab, id: string, rows: readonly Row[], batchSize: number, workspace = "cedar-demo"): Promise<void> {
  const headers = { "x-lab-workspace": workspace };
  expect(await waitForCompletion(lab.url, id, workspace)).toEqual({ id, workspaceId: workspace, state: "completed", total: rows.length, processed: rows.length, pending: 0 });

  const records = objects((await readResource(lab, id, "/records", headers)).records);
  expect(records.map((record) => record.documentRef)).toEqual(rows.map((row) => row.documentRef));
  expect(records.every((record) => record.state === "processed")).toBe(true);
  const recordIds = records.map((record) => Number(record.id));
  expect(new Set(recordIds).size).toBe(rows.length);

  const results = objects((await readResource(lab, id, "/results", headers)).results);
  expect(results).toEqual(rows.map((row, index) => ({
    recordId: recordIds[index], documentRef: row.documentRef, normalizedLabel: row.label.trim().toUpperCase(),
  })));

  const events = objects((await readResource(lab, id, "/events", headers)).events);
  const batches = batchesOf(events);
  expect(batches.map((batch) => batch.count)).toEqual(expectedBatchSizes(rows.length, batchSize));
  for (const batch of batches) {
    expect(batch.recordIds).toHaveLength(batch.count);
    expect(batch.count).toBeLessThanOrEqual(batchSize);
  }
  // Every source record is in exactly one batch, in source order: nothing skipped, nothing repeated.
  expect(batches.flatMap((batch) => batch.recordIds)).toEqual(recordIds);
  expect(events.map((event) => event.type).filter((type) => type !== "batch_processed"))
    .toEqual(["import_created", "processing_started", "processing_completed"]);
}

async function expectControlUntouched(lab: RunningLab): Promise<void> {
  expect(await readResource(lab, "control-002", "", maple)).toEqual({ id: "control-002", workspaceId: "maple-demo", state: "paused", total: 3, processed: 0, pending: 3 });
  expect(objects((await readResource(lab, "control-002", "/records", maple)).records).map((record) => [record.id, record.documentRef, record.state]))
    .toEqual([[13, "CTRL-001", "pending"], [14, "CTRL-002", "pending"], [15, "CTRL-003", "pending"]]);
  expect(await readResource(lab, "control-002", "/results", maple)).toEqual({ results: [] });
  expect(objects((await readResource(lab, "control-002", "/events", maple)).events).map((event) => event.type)).toEqual(["import_created"]);
}

describe.each([1, 3, 5, 20])("batch size %i", (batchSize) => {
  let directory: string;
  let lab: RunningLab;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "pse-batch-"));
    lab = await startLab(join(directory, "test.sqlite"), batchSize);
  });

  afterAll(async () => {
    try {
      if (lab) await lab.stop();
    } finally {
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  });

  // Volumes around every boundary: below, equal to, and just past one and two batches, plus the
  // reported 12 and the 200-row maximum.
  const volumes = [...new Set([1, batchSize - 1, batchSize, batchSize + 1, 2 * batchSize - 1, 2 * batchSize, 2 * batchSize + 1, 12, 25, 200])]
    .filter((volume) => volume >= 1).sort((a, b) => a - b);

  test.each(volumes)("processes all %i records exactly once", async (volume) => {
    const rows = syntheticRows(volume);
    await expectFullyProcessed(lab, await createImport(lab, toCsv(rows)), rows, batchSize);
  });

  test("the supplied seed case and the paused control are handled correctly after startup", async () => {
    const seededRows = (await readFile(join(starterDirectory, "fixtures", "case-002.csv"), "utf8")).trim().split("\n").slice(1)
      .map((line) => { const [documentRef = "", label = ""] = line.split(","); return { documentRef, label }; });
    expect(seededRows).toHaveLength(12);
    await expectFullyProcessed(lab, "case-002", seededRows, batchSize);
    await expectControlUntouched(lab);
  });

  test("a large import in one workspace does not leak into or disturb the other workspace", async () => {
    const rows = syntheticRows(batchSize * 2 + 1);
    const id = await createImport(lab, toCsv(rows), maple);
    await expectFullyProcessed(lab, id, rows, batchSize, "maple-demo");
    for (const resource of ["", "/records", "/results", "/events"]) {
      const response = await fetch(`${lab.url}/imports/${id}${resource}`, { headers: cedar });
      expect(response.status).toBe(404);
    }
    await expectControlUntouched(lab);
  });
});

describe("recovery of the existing partially processed case (lab-only resume-case)", () => {
  let directory: string;
  let databasePath: string;
  let lab: RunningLab | undefined;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "pse-resume-"));
    databasePath = join(directory, "test.sqlite");
  });

  afterAll(async () => {
    try {
      if (lab) await lab.stop();
    } finally {
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  });

  function runBun(script: string): { status: number | null; stdout: string; stderr: string } {
    const result = spawnSync("bun", [script], { cwd: starterDirectory, env: { ...process.env, SUPPORT_LAB_DB: databasePath }, encoding: "utf8" });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  test("resume requeues only the skipped records and preserves existing results and identities", async () => {
    // 1. A healthy lab processes the seed case, then we rewind DOC-006..DOC-010 to the state the old worker left.
    lab = await startLab(databasePath, 5);
    await waitForCompletion(lab.url, "case-002");
    await lab.stop();
    expect(runBun("tests/support/rewind-case.ts").status).toBe(0);

    // 2. Restart: startup must NOT repair the case by itself.
    lab = await startLab(databasePath, 5);
    const before = {
      detail: await readResource(lab, "case-002"),
      records: await readResource(lab, "case-002", "/records"),
      results: await readResource(lab, "case-002", "/results"),
      events: await readResource(lab, "case-002", "/events"),
      control: await readResource(lab, "control-002", "", maple),
    };
    expect(before.detail).toEqual({ id: "case-002", workspaceId: "cedar-demo", state: "completed", total: 12, processed: 7, pending: 5 });
    expect(objects(before.results.results).map((result) => result.recordId)).toEqual([1, 2, 3, 4, 5, 11, 12]);
    await lab.stop();

    // 3. Approved lab-only command: acknowledgment only, no processing.
    const resume = runBun("scripts/resume-case.ts");
    expect(resume.status).toBe(0);
    expect(JSON.parse(resume.stdout)).toEqual({ id: "case-002", workspaceId: "cedar-demo", state: "queued", pending: 5 });

    // 4. The worker processes the queued job; the patched worker must finish all 12.
    lab = await startLab(databasePath, 5);
    expect(await waitForCompletion(lab.url, "case-002")).toEqual({ id: "case-002", workspaceId: "cedar-demo", state: "completed", total: 12, processed: 12, pending: 0 });

    const records = objects((await readResource(lab, "case-002", "/records")).records);
    expect(records.map((record) => record.id)).toEqual(objects(before.records.records).map((record) => record.id)); // same source IDs
    expect(records.every((record) => record.state === "processed")).toBe(true);

    const results = objects((await readResource(lab, "case-002", "/results")).results);
    expect(results.map((result) => result.recordId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(results.map((result) => result.normalizedLabel)).toEqual(Array.from({ length: 12 }, (_, index) => `SAMPLE ${String(index + 1).padStart(3, "0")}`));
    for (const earlier of objects(before.results.results)) expect(results).toContainEqual(earlier); // prior results retained unchanged

    const events = objects((await readResource(lab, "case-002", "/events")).events);
    const earlierEvents = objects(before.events.events);
    expect(events.slice(0, earlierEvents.length)).toEqual(earlierEvents); // history preserved
    const newEvents = events.slice(earlierEvents.length);
    expect(newEvents.map((event) => event.type)).toEqual(["resume_requested", "processing_started", "batch_processed", "processing_completed"]);
    expect(batchesOf(newEvents)).toEqual([{ recordIds: [6, 7, 8, 9, 10], count: 5 }]); // only the pending rows, once

    expect(await readResource(lab, "control-002", "", maple)).toEqual(before.control); // control unchanged
  });

  test("resume-case refuses to run when nothing is pending", async () => {
    const result = runBun("scripts/resume-case.ts");
    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stderr)).toMatchObject({ code: "invalid_state" });
    expect(await readResource(lab as RunningLab, "case-002")).toMatchObject({ state: "completed", total: 12, processed: 12, pending: 0 });
  });
});
