// 사용법: node db-peek.mjs <project.sqlite 사본 경로>  (읽기 전용으로 테이블·행 크기를 본다)
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(process.argv[2], { readOnly: true });
const tables = db.prepare("select name from sqlite_master where type='table'").all().map((r) => r.name);
console.log("tables", tables.join(","));
for (const t of tables) {
  const n = db.prepare(`select count(*) c from "${t}"`).get().c;
  const cols = db.prepare(`pragma table_info("${t}")`).all().map((c) => c.name);
  console.log(t, n, cols.join(","));
}
