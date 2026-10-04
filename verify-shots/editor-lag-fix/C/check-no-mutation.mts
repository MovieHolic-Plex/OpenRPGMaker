// C: 컴파일이 저장소 타일셋을 제자리 변경하지 않는지 — 타일셋 전체를 깊게 얼린 뒤 카드 컴파일이 통과하는지.
// (ESM 은 strict 라서 얼린 객체에 쓰기를 하면 TypeError 로 실패한다.) 추가로 JSON 지문이 전후로 같은지 본다.
import { createHash } from "node:crypto";
import { openLocalProjectStore } from "../../../electron/local-store/store";
import { deserialize } from "../../../src/project/io/serialize";
import { previewPlaceMaps } from "../../../src/editor/panels/spatialPlacePreview";

const store = await openLocalProjectStore({ projectDir: "/tmp/lag-proj-C" });
const project = deserialize(store.exportSerialized()!);
store.close();
const deepFreeze = (v: unknown): void => {
  if (v && typeof v === "object" && !Object.isFrozen(v)) { for (const c of Object.values(v)) deepFreeze(c); Object.freeze(v); }
};
const sha = () => createHash("sha256").update(JSON.stringify(project.tilesets)).digest("hex").slice(0, 16);
const before = sha();
deepFreeze(project.tilesets);
const places = Object.values(project.spatialAuthoring!.library.places).slice(0, 6);
let ok = 0;
for (const place of places) { previewPlaceMaps({ project, place, floor: null }); ok++; }
console.log("frozen tilesets, cards compiled:", ok, "/", places.length, "tileset digest unchanged:", before === sha());
