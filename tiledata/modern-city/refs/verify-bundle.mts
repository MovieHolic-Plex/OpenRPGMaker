/**
 * 번들 등록 확인 — 참고문서·번들 장소가 실제 코드 경로로 읽히는지 본다(테스트 스위트가 아니다).
 *   npx vite-node tiledata/modern-city/refs/verify-bundle.mts
 * 확인: 타일셋 정의가 참고문서를 들고 태어남 · 장소 목록에 modern-city-60x60 · 스냅샷 로드 · 스냅샷 4층이 예제 맵과 같음 · 문서의 그림 파일 존재.
 */
import fs from "node:fs";
import { createModernCityTileset, ensureModernCityReferences } from "../../../src/project/defaults/modernCity";
import { PLACE_REFERENCES } from "../../../src/project/regionReferences";
import { preloadRegionReference, regionReferenceSnapshotScene, readRegionReference } from "../../../src/project/regionReferenceSnapshots";

const ts = createModernCityTileset();
const docs = ts.referenceDocuments ?? [];
const imgs = docs.flatMap(c => c.images ?? []);
const missing = imgs.filter(i => !fs.existsSync("public" + (i as { dataUrl: string }).dataUrl));
const place = PLACE_REFERENCES.find(p => p.id === "modern-city-60x60");
await preloadRegionReference("modern-city-60x60");
const scene = regionReferenceSnapshotScene("modern-city-60x60");
const ex = JSON.parse(fs.readFileSync("tiledata/modern-city/map/modern-city-1.json", "utf8"));
const same = (a?: number[], b?: number[]) => !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);
const empty = { ...ts, referenceDocuments: [] };
const filled = ensureModernCityReferences(empty);
const rows = readRegionReference("modern-city-60x60", 0, 2);
const out = {
  categories: docs.length, documents: docs.reduce((n, c) => n + c.documents.length, 0), images: imgs.length, missingImageFiles: missing.length,
  placeFound: !!place, snapshotLoaded: !!scene, sceneSize: scene ? [scene.map.width, scene.map.height] : null,
  layers: scene ? { lower: same(scene.map.lowerTiles, ex.lowerTiles), lo2: same((scene.map as any).lowerOverlayTiles, ex.lowerOverlayTiles), upper: same(scene.map.upperTiles, ex.upperTiles), up4: same((scene.map as any).upperOverlayTiles, ex.upperOverlayTiles) } : null,
  ensureFillsEmptyProject: filled, afterEnsureCategories: empty.referenceDocuments?.length, readToolRows: rows.map ? undefined : { rows: (rows as any).map.rows, hasOverlay: "lowerOverlayTiles" in (rows as any).map },
};
console.log(JSON.stringify(out));
if (!place || !scene || missing.length || !out.layers || !Object.values(out.layers).every(Boolean) || !filled) process.exit(1);
