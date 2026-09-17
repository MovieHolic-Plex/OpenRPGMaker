import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { openNodeSqliteDriver, applyStorePragmas } from './driver';
import { PROJECT_STORE_FILE } from './schema';

export type TeamRole = 'owner' | 'editor' | 'viewer';
export type TeamMember = { id: string; label: string; role: TeamRole };
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Membership lives beside project data and survives host restarts; raw access codes never do. */
export function openTeamDirectory(projectDir: string) {
  const db = openNodeSqliteDriver(join(projectDir, PROJECT_STORE_FILE));
  applyStorePragmas(db);
  db.exec(`CREATE TABLE IF NOT EXISTS workspace_team (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS workspace_members (id TEXT PRIMARY KEY, label TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')), token_hash TEXT UNIQUE, revoked INTEGER NOT NULL DEFAULT 0);`);
  db.transaction(() => {
    if (!db.prepare('SELECT id FROM workspace_team LIMIT 1').get([])) {
      db.prepare('INSERT INTO workspace_team VALUES (?,?)').run([randomUUID(), '내 팀']);
      db.prepare("INSERT INTO workspace_members (id,label,role) VALUES (?,?,'owner')").run([randomUUID(), '호스트']);
    }
  });
  const member = (id: string): TeamMember | null => {
    const row = db.prepare('SELECT id,label,role FROM workspace_members WHERE id=? AND revoked=0').get([id]);
    return row ? { id: String(row.id), label: String(row.label), role: row.role as TeamRole } : null;
  };
  const ownerId = String(db.prepare("SELECT id FROM workspace_members WHERE role='owner' AND revoked=0 LIMIT 1").get([])!.id);
  return {
    member,
    owner: () => member(ownerId)!,
    info() {
      const row = db.prepare('SELECT id,name FROM workspace_team LIMIT 1').get([])!;
      return { id: String(row.id), name: String(row.name) };
    },
    rename(name: string) { db.prepare('UPDATE workspace_team SET name=?').run([name]); },
    list(): TeamMember[] {
      return db.prepare('SELECT id FROM workspace_members WHERE revoked=0').all([]).map(row => member(String(row.id))!);
    },
    invite(label: string, role: 'editor' | 'viewer') {
      const id = randomUUID(), token = randomBytes(32).toString('hex');
      db.prepare('INSERT INTO workspace_members (id,label,role,token_hash) VALUES (?,?,?,?)').run([id, label, role, hash(token)]);
      return { member: member(id)!, token };
    },
    ownerToken() {
      const token = randomBytes(32).toString('hex');
      db.prepare('UPDATE workspace_members SET token_hash=? WHERE id=?').run([hash(token), ownerId]);
      return token;
    },
    authenticate(token: string): TeamMember | null {
      const row = db.prepare('SELECT id FROM workspace_members WHERE token_hash=? AND revoked=0').get([hash(token)]);
      return row ? member(String(row.id)) : null;
    },
    revoke(id: string) {
      db.prepare("UPDATE workspace_members SET revoked=1,token_hash=NULL WHERE id=? AND role!='owner'").run([id]);
    },
    close() { db.close(); },
  };
}
export type TeamDirectory = ReturnType<typeof openTeamDirectory>;
