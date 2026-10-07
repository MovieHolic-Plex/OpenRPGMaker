/** 배선 확인(감독용): 번들 목록 → 생성 → 프로젝트 타일셋 검증 → ensureBundledTilesets 가 새·옛 프로젝트에 심는지. npx tsx node/wire_check.mts */
import { MONSTER_KIT_SHEETS } from "../../../assets/monsterKitAssets";
import { BUNDLED_EASYRPG_CHIPSET_ASSETS, bundledChipsetFrameCount, bundledChipsetTilesPerRow, bundledChipsetSheetHeight } from "../../../assets/bundled";
import { createMonsterKitTileset, ensureMonsterKitTileset } from "../../../project/defaults/monsterKit";
import { ensureBundledTilesets } from "../../../project/defaults/defaultAssets";
import { validateTileset } from "../../../project/io/shapeResourceFields";
import { existsSync } from "node:fs";
import { imageSize } from "./png_size.mts";
let bad = 0;
const fail = (m: string) => { console.log("X", m); bad++; };
for (const s of MONSTER_KIT_SHEETS) {
  if (!BUNDLED_EASYRPG_CHIPSET_ASSETS.some((a) => a.textureKey === s.textureKey)) fail(`${s.theme}: 번들 칩셋 목록에 없음`);
  if (bundledChipsetFrameCount(s.textureKey) !== s.count) fail(`${s.theme}: 칸 수 ${bundledChipsetFrameCount(s.textureKey)} ≠ ${s.count}`);
  if (bundledChipsetTilesPerRow(s.textureKey) !== 16) fail(`${s.theme}: 열 수 ${bundledChipsetTilesPerRow(s.textureKey)}`);
  const png = `public/${s.path}`;
  if (!existsSync(png)) fail(`${s.theme}: 그림 ${png} 없음`);
  else { const { w, h } = imageSize(png); if (w !== 256 || h !== bundledChipsetSheetHeight(s.textureKey)) fail(`${s.theme}: 그림 ${w}×${h} ≠ 256×${bundledChipsetSheetHeight(s.textureKey)}`); }
  const t = createMonsterKitTileset(s.textureKey);
  try { validateTileset(t.id, t); } catch (e) { fail(`${s.theme}: 검증 실패 ${(e as Error).message}`); }
  const cats = t.referenceDocuments ?? [];
  if (!cats.length || !cats[0].documents.length) fail(`${s.theme}: 참고문서 없음`);
  for (const c of cats) {
    for (const d of c.documents) if (d.markdown.length > 120_000) fail(`${s.theme}: 문서 ${d.id} 가 120,000자 초과`);
    for (const im of c.images) if (!existsSync(`public${im.dataUrl}`)) fail(`${s.theme}: 그림 ${im.dataUrl} 없음`);
  }
  console.log(`· ${s.theme}: 문서 ${cats.reduce((n, c) => n + c.documents.length, 0)} · 그림 ${cats.reduce((n, c) => n + c.images.length, 0)}`);
  console.log(`· ${s.theme}: ${t.count}칸 · 킷 ${t.structureKits?.length} · 오토타일 ${t.autotileGroups?.length} · 미끄럼 ${Object.keys(t.slideTiles ?? {}).length} · 턱 ${Object.keys(t.ledgeDirections ?? {}).length}`);
}
// 새 프로젝트: 비어 있는 타일셋 사전에 심긴다
const fresh: any = { tilesets: {}, maps: {} };
ensureBundledTilesets(fresh);
for (const s of MONSTER_KIT_SHEETS) if (!fresh.tilesets[s.id]) fail(`새 프로젝트에 ${s.id} 가 없다`);
// 옛 프로젝트: 칸 수가 다른 사본은 번들 칸 표로 바뀐다, 저자 킷은 남는다
for (const s of MONSTER_KIT_SHEETS) {
  const old = createMonsterKitTileset(s.textureKey);
  old.count = 10; old.structureKits = [];
  if (!ensureMonsterKitTileset(old) || old.count !== s.count) fail(`${s.id}: 옛 사본이 갱신되지 않았다`);
  const same = createMonsterKitTileset(s.textureKey);
  same.structureKits = [{ id: "author-x", kind: "section", width: 1, height: 1, rows: [{ tiles: [0] }], learnedFrom: "user-paint" }];
  ensureMonsterKitTileset(same);
  if (!same.structureKits.some((k) => k.id === "author-x") || same.structureKits.length !== 1 + (createMonsterKitTileset(s.textureKey).structureKits?.length ?? 0)) fail(`${s.id}: 저자 킷 보존/번들 킷 보충 실패`);
}
// 참고문서: 옛 사본(문서 없음)에 심긴다 · 저자 용도는 남는다 · 다시 구운 번들 용도는 같은 id 자리에서 바뀐다 · 일부러 비운 것은 그대로
for (const s of MONSTER_KIT_SHEETS) {
  const want = createMonsterKitTileset(s.textureKey).referenceDocuments ?? [];
  const old = createMonsterKitTileset(s.textureKey);
  delete old.referenceDocuments;
  ensureMonsterKitTileset(old);
  if ((old.referenceDocuments ?? []).length !== want.length) fail(`${s.id}: 옛 사본에 참고문서가 안 심겼다`);
  const mixed = createMonsterKitTileset(s.textureKey);
  const author = { id: "author-notes", name: "내 메모", description: "", documents: [{ id: "n", name: "n", markdown: "x" }], images: [] };
  mixed.referenceDocuments = [author, { ...structuredClone(want[0]), description: "옛 굽기", documents: want[0].documents.slice(0, 1) }];
  ensureMonsterKitTileset(mixed);
  const got = mixed.referenceDocuments ?? [];
  if (!got.some((c) => c.id === "author-notes")) fail(`${s.id}: 저자 참고문서 용도가 지워졌다`);
  if (got.find((c) => c.id === want[0].id)?.documents.length !== want[0].documents.length) fail(`${s.id}: 다시 구운 번들 용도가 안 바뀌었다`);
  const emptied = createMonsterKitTileset(s.textureKey);
  emptied.referenceDocuments = [];
  ensureMonsterKitTileset(emptied);
  if (emptied.referenceDocuments.length !== 0) fail(`${s.id}: 일부러 비운 참고문서를 다시 심었다`);
  if (!(fresh.tilesets[s.id]?.referenceDocuments ?? []).length) fail(`새 프로젝트 ${s.id} 에 참고문서가 없다`);
}
console.log(bad ? `배선 확인 실패 ${bad}건` : `배선 확인 ok — 시트 ${MONSTER_KIT_SHEETS.length}장`);
process.exit(bad ? 1 : 0);
