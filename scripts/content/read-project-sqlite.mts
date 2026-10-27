// 저장된 project.sqlite 를 읽기 전용으로 열어 «온전한» 프로젝트 JSON 을 낸다(번들 타일셋 차이·접힌 본문을 되돌린 것).
//
// 왜(2026-10-27): 번들 타일셋은 번들 정의와의 차이만 저장한다(src/project/bundledTilesetDiff.ts). 행을 직접 읽어
// tileset_blobs 본문만 끼우면 칸 표·킷·참고문서가 빠진 차이 보기가 나온다. 스크립트는 이 경로(= 앱의 deserialize)로 읽는다.
//
//   npx tsx scripts/content/read-project-sqlite.mts <project 폴더 | project.sqlite> [출력.json]
//
// 출력은 자기완결 문서다(참고문서·번들 타일셋 통째) — .oprn 내보내기와 같은 모양. 원본 DB 에는 아무것도 쓰지 않는다.
import { existsSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { openNodeSqliteDriver } from "../../electron/local-store/driver";
import { foldDocument, foldedTilesetShas, sha256HexOfText } from "../../electron/local-store/tilesetFold";
import { deserializeStoredProjectJson } from "../../src/project/persistence/core/loadRepair";
import { projectWireView } from "../../src/project/io/serialize";
import type { Project } from "../../src/project/types";

export function readProjectSqlite(input: string): Project {
  const file = existsSync(input) && statSync(input).isDirectory() ? join(input, "project.sqlite") : input;
  const db = openNodeSqliteDriver(resolve(file), { readOnly: true });
  try {
    const row = db.prepare("SELECT current_json, current_sha256 FROM project WHERE id = 1").get([]);
    if (!row) throw new Error(`${file}: 저장된 프로젝트가 없습니다`);
    const raw = String(row.current_json);
    const folded = foldedTilesetShas(raw);
    let text = raw;
    if (folded) {
      const wire = foldDocument(folded.document, (marker) => {
        const sha = (marker as { readonly $blob: string }).$blob;
        const blob = db.prepare("SELECT body FROM tileset_blobs WHERE sha256 = ?").get([sha]);
        if (!blob || typeof blob.body !== "string" || sha256HexOfText(blob.body) !== sha) throw new Error(`${file}: 타일셋 본문 ${sha} 이 없거나 손상됐습니다`);
        return { sha256: sha, text: blob.body };
      });
      text = wire.full();
    }
    return deserializeStoredProjectJson(JSON.parse(text), text);
  } finally {
    db.close();
  }
}

/** 자기완결 JSON(참고문서·번들 타일셋 통째). */
export function readProjectSqliteJson(input: string): string {
  return JSON.stringify(projectWireView(readProjectSqlite(input), { keepReferenceDocuments: true, inlineBundledTilesets: true }));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename ?? "")) {
  const [input, out] = process.argv.slice(2);
  if (!input) throw new Error("Usage: npx tsx scripts/content/read-project-sqlite.mts <project 폴더 | project.sqlite> [출력.json]");
  const json = readProjectSqliteJson(input);
  if (out) writeFileSync(out, json);
  else process.stdout.write(json);
}
