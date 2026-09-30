// 사용법: node tamper-doc.mjs <project.sqlite> <keep|drop>  (서버를 멈춘 사본에서만)
// mapTree 에서 잎 하나(map_forest_ceiling_review)를 빼 «정규화기가 고칠 결함»을 심는다.
// keep: 표식 유지(현재 빌드와 짝이 맞음 → 건너뛰면 결함이 남는다) / drop: 표식 제거(옛 파일 → 정규화로 결함이 복구돼야 한다).
// 접힌 행이라 current_sha256 은 «펼친 글»의 해시다(tilesetFold.foldDocument 와 같은 조각 규칙) — 글만 바꾸면 호스트가 «행이 sha 와 다르다»로 거부한다.
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
const [, , file, mode] = process.argv;
const db = new DatabaseSync(file);
const row = db.prepare("select current_json from project").get();
const doc = JSON.parse(row.current_json);
const kids = doc.mapTree.children;
const before = kids.length;
doc.mapTree.children = kids.filter((k) => k.mapId !== "map_forest_ceiling_review");
if (mode === "drop") delete doc.meta.bootNormalization;
const folded = JSON.stringify(doc);
// 펼친 글: 접힌 글의 {"$blob":"<sha>"} 를 blob 본문으로 바꾼다(키 순서·구분자는 접힌 글이 이미 같은 규칙).
const blobText = (sha) => String(db.prepare("select body from tileset_blobs where sha256=?").get(sha).body);
const full = folded.replace(/\{"\$blob":"([0-9a-f]{64})"\}/g, (_, sha) => blobText(sha));
const sha = createHash("sha256").update(full, "utf8").digest("hex");
db.prepare("update project set current_json=?, current_sha256=?").run(folded, sha);
console.log(JSON.stringify({ mode, treeChildrenBefore: before, after: doc.mapTree.children.length, marker: doc.meta.bootNormalization ?? null, sha }));
