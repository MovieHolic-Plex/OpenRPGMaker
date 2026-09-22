import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Read-only diagnostics; opening a missing file must never create a blank DB. */
export function openProjectLogReader(projectDir) {
  if (!projectDir) throw new Error('--project-dir <folder> or OPRN_PROJECT_DIR is required');
  const path = join(resolve(projectDir), 'project.sqlite');
  if (!existsSync(path)) throw new Error('project.sqlite does not exist in the selected folder');
  const db = new DatabaseSync(path, { readOnly: true });
  return db;
}
export function projectDirArgument(args) {
  const index = args.indexOf('--project-dir');
  if (index >= 0 && (!args[index + 1] || args[index + 1].startsWith('--'))) throw new Error('--project-dir needs a folder');
  return index >= 0 ? args[index + 1] : process.env.OPRN_PROJECT_DIR;
}
