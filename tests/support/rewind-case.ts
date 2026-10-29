// Test-only helper, run with Bun (never imported by Vitest, which runs in Node).
// Recreates the state the unpatched worker left behind for case-002: the import is "completed" but
// records DOC-006..DOC-010 are pending again and their results are gone. Run it only against a
// temporary test database, with the server stopped.
import { loadConfig } from "../../src/config";
import { openDatabase } from "../../src/database";

const SKIPPED_REFS = ["DOC-006", "DOC-007", "DOC-008", "DOC-009", "DOC-010"];

const database = openDatabase(loadConfig().databasePath);
try {
  database.transaction(() => {
    const marks = SKIPPED_REFS.map(() => "?").join(",");
    database.query(`DELETE FROM results WHERE import_id = 'case-002' AND record_id IN (SELECT id FROM records WHERE import_id = 'case-002' AND document_ref IN (${marks}))`).run(...SKIPPED_REFS);
    database.query(`UPDATE records SET state = 'pending' WHERE import_id = 'case-002' AND document_ref IN (${marks})`).run(...SKIPPED_REFS);
  }).immediate();
  console.log(JSON.stringify({ rewound: SKIPPED_REFS }));
} finally {
  database.close();
}
