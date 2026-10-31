// Clear the assistant history of a stage checkpoint so every measured run starts with an empty conversation.
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(process.argv[2]);
const before = Object.fromEntries(["ai_conversations", "ai_activity_logs", "ai_analysis_runs"].map((t) => [t, db.prepare(`SELECT count(*) n FROM ${t}`).get().n]));
for (const t of Object.keys(before)) db.exec(`DELETE FROM ${t}`);
db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
console.log("frozen: cleared", JSON.stringify(before));
