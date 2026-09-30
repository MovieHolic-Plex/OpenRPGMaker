// 사용법: node db-doc.mjs <project.sqlite>  (읽기 전용) 저장 문서 크기·리비전·타일셋 blob 안 referenceDocuments 여부
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(process.argv[2], { readOnly: true });
const p = db.prepare("select revision, length(current_json) n, current_sha256 s, updated_at u from project").get();
console.log("project", p);
const doc = JSON.parse(db.prepare("select current_json from project").get().current_json);
let withDocs = 0, docBytes = 0, total = 0;
for (const [id, t] of Object.entries(doc.tilesets ?? {})) {
  total += 1;
  const body = t?.$blob ? db.prepare("select body from tileset_blobs where sha256=?").get(t.$blob)?.body : JSON.stringify(t);
  if (!body) { console.log("missing blob", id); continue; }
  const j = JSON.parse(body);
  if (j.referenceDocuments?.length) { withDocs += 1; docBytes += JSON.stringify(j.referenceDocuments).length; }
}
console.log("tilesets", total, "withRefDocs", withDocs, "refDocBytes", docBytes);
const a = Object.values(doc.assets?.uploaded ?? {});
console.log("uploaded", a.length, "withRef", a.filter((x) => x.ref).length, "dataUrl", a.filter((x) => String(x.dataUrl ?? "").startsWith("data:")).length);
console.log("blobs", db.prepare("select count(*) c, sum(length(body)) b from tileset_blobs").get());
console.log("assets", db.prepare("select count(*) c from assets").get());
console.log("commits", db.prepare("select count(*) c from commits").get());
