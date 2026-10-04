// 사용법: node marker-peek.mjs <project.sqlite>  (읽기 전용) revision·문서 길이·meta.bootNormalization·meta.schemaVersion 을 본다.
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(process.argv[2], { readOnly: true });
const row = db.prepare("select revision, current_json from project").get();
const doc = JSON.parse(row.current_json);
console.log(JSON.stringify({ revision: row.revision, len: row.current_json.length, bootNormalization: doc.meta?.bootNormalization ?? null, metaKeys: Object.keys(doc.meta ?? {}) }));
