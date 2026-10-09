#!/usr/bin/env node
// Offline archive -> isolated project folders. Never connects to a database service.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { withTsModule } from './ontology-ts-loader.mjs';

const TABLES = { project_commits: 'commits', project_changes: 'changes', ai_activity_logs: 'aiActivityLogs', ai_conversations: 'aiConversations', ai_analysis_runs: 'aiAnalysisRuns' };
const REQUIRED = ['projects', ...Object.keys(TABLES)];
const digest = value => createHash('sha256').update(value).digest('hex');

export async function importProjectArchive({ archivePath, destination, onProgress = () => {} }) {
  archivePath = resolve(archivePath); destination = resolve(destination);
  if (!existsSync(archivePath)) throw new Error('Archive file does not exist');
  if (existsSync(destination)) throw new Error('Destination must be a new directory; existing projects are never overwritten');
  const archive = new DatabaseSync(archivePath, { readOnly: true });
  const report = { archivePath, destination, projects: [], failures: [], archivedOnly: {} };
  try {
    for (const name of REQUIRED) {
      const row = archive.prepare('SELECT expected, exported FROM inventory WHERE schema_name=? AND table_name=?').get('rpg_zzu', name);
      const count = archive.prepare('SELECT count(*) AS n FROM source_rows WHERE schema_name=? AND table_name=?').get('rpg_zzu', name).n;
      if (!row || row.expected !== row.exported || row.exported !== count) throw new Error(`Incomplete archive table: ${name}`);
    }
    // Only keys enter the temporary index. Original row JSON remains untouched in the archive.
    archive.exec(`CREATE TEMP TABLE origin_index AS SELECT rowid AS source_id, table_name,
      json_extract(row_json, '$.project_id') AS origin_id, json_extract(row_json, '$.commit_id') AS commit_id
      FROM source_rows WHERE schema_name='rpg_zzu';
      CREATE INDEX temp.origin_lookup ON origin_index(table_name, origin_id);
      CREATE INDEX temp.commit_lookup ON origin_index(commit_id);`);
    mkdirSync(destination, { mode: 0o700 });
    const projects = archive.prepare("SELECT source_id, origin_id FROM origin_index WHERE table_name='projects' ORDER BY origin_id").all();
    const sourceRow = archive.prepare('SELECT row_json FROM source_rows WHERE rowid=?');
    const entry = fileURLToPath(new URL('../electron/local-store/store.ts', import.meta.url));
    await withTsModule(entry, 'oprn-archive-store.mjs', async module => {
      for (const item of projects) {
        const folder = join(destination, `project-${digest(String(item.origin_id)).slice(0, 24)}`);
        let store;
        const source = JSON.parse(sourceRow.get(item.source_id).row_json);
        try {
          const document = typeof source.current_json === 'string' ? source.current_json : JSON.stringify(source.current_json);
          if (!document || document === 'null') throw new Error('Source has no project document');
          store = await module.initLocalProjectStore({ projectDir: folder });
          const saved = await store.saveSerialized(document, null);
          if (saved.kind !== 'saved') throw new Error('Initial project save was not accepted');
          const counts = {};
          for (const [table, field] of Object.entries(TABLES)) {
            const sql = table === 'project_changes'
              ? `SELECT r.row_json FROM origin_index i JOIN source_rows r ON r.rowid=i.source_id
                 WHERE i.table_name=? AND i.commit_id IN (SELECT commit_id FROM origin_index WHERE table_name='project_commits' AND origin_id=?) ORDER BY i.source_id`
              : `SELECT r.row_json FROM origin_index i JOIN source_rows r ON r.rowid=i.source_id WHERE i.table_name=? AND i.origin_id=? ORDER BY i.source_id`;
            let batch = []; let count = 0;
            for (const row of archive.prepare(sql).iterate(table, item.origin_id)) {
              const record = JSON.parse(row.row_json);
              if (field === "aiConversations") record.project_context_key = `remote:${store.projectId}`;
              batch.push(record); count++;
              if (batch.length === 100) { store.importHistory({ [field]: batch }); batch = []; }
            }
            if (batch.length) store.importHistory({ [field]: batch });
            counts[table] = count;
          }
          // Retain inline bytes as authored. They already live in the SQLite document; no HTTP fetch is needed.
          const snapshot = store.loadSnapshot();
          if (!snapshot || snapshot.sha256 !== saved.sha256) throw new Error('Reload did not match saved project');
          const projectId = store.projectId;
          store.close(); store = null;
          const reopened = await module.openLocalProjectStore({ projectDir: folder });
          try {
            const next = reopened.loadSnapshot();
            if (!next || next.sha256 !== saved.sha256) throw new Error('Reopened project does not match');
          } finally { reopened.close(); }
          const db = new DatabaseSync(join(folder, 'project.sqlite'), { readOnly: true });
          try {
            for (const [table, field] of Object.entries(TABLES)) {
              const localTable = field === 'commits' || field === 'changes' ? field : table;
              if (db.prepare(`SELECT count(*) AS n FROM ${localTable}`).get().n !== counts[table]) throw new Error(`History count mismatch: ${table}`);
            }
          } finally { db.close(); }
          const receipt = { originProjectId: item.origin_id, projectId, folder, sourceDocumentSha256: digest(document), sha256: saved.sha256, history: counts, conversationScope: `remote:${projectId}`, reopened: true };
          writeFileSync(join(folder, 'import-receipt.json'), JSON.stringify(receipt, null, 2), { mode: 0o600 });
          report.projects.push(receipt); onProgress({ imported: report.projects.length, total: projects.length });
        } catch (error) {
          store?.close(); store = null;
          // This function exclusively owns the newly created destination folder.
          rmSync(folder, { recursive: true, force: true });
          const recoveryFolder = join(destination, 'unopened', `project-${digest(String(item.origin_id)).slice(0, 24)}`);
          mkdirSync(recoveryFolder, { recursive: true, mode: 0o700 });
          writeFileSync(join(recoveryFolder, 'source-row.json'), JSON.stringify(source), { mode: 0o600 });
          const failure = { originProjectId: item.origin_id, recoveryFolder, error: error instanceof Error ? error.message : 'Import failed' };
          writeFileSync(join(recoveryFolder, 'REASON.json'), JSON.stringify(failure, null, 2), { mode: 0o600 });
          report.failures.push(failure);
          onProgress({ failed: report.failures.length, total: projects.length });
        }
      }
    });
    for (const table of Object.keys(TABLES)) {
      const total = archive.prepare('SELECT count(*) AS n FROM source_rows WHERE schema_name=? AND table_name=?').get('rpg_zzu', table).n;
      const imported = report.projects.reduce((sum, project) => sum + project.history[table], 0);
      if (total > imported) report.archivedOnly[table] = total - imported;
    }
    writeFileSync(join(destination, 'IMPORT.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
    return report;
  } finally { archive.close(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [archivePath, destination] = process.argv.slice(2);
  if (!archivePath || !destination) throw new Error('Usage: node scripts/import-project-archive.mjs <archive.sqlite> <new-folder>');
  const report = await importProjectArchive({ archivePath, destination, onProgress: value => console.log(JSON.stringify(value)) });
  console.log(JSON.stringify({ imported: report.projects.length, failed: report.failures.length, report: join(resolve(destination), 'IMPORT.json') }));
  if (report.failures.length) process.exitCode = 1;
}
