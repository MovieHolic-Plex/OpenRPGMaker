// C: 카드 캐시 적중/실패 확인. 같은 입력 → 같은 maps 참조(적중), 입력 하나 바뀜 → 새 계산(실패).
import { openLocalProjectStore } from "../../../electron/local-store/store";
import { deserialize } from "../../../src/project/io/serialize";
import { cachedPlaceMaps } from "../../../src/editor/panels/spatialPlacePreview";

const store = await openLocalProjectStore({ projectDir: "/tmp/lag-proj-C" });
const project = deserialize(store.exportSerialized()!);
store.close();
const place = Object.values(project.spatialAuthoring!.library.places)[0];
const card = { id: "probe-card" };
const t = <T,>(f: () => T): [T, number] => { const s = performance.now(); const r = f(); return [r, Math.round(performance.now() - s)]; };

const [a, ta] = t(() => cachedPlaceMaps(project, card, place, undefined));
const [b, tb] = t(() => cachedPlaceMaps(project, card, place, undefined));
console.log("miss ms", ta, "hit ms", tb, "same maps ref (hit):", a.maps === b.maps);

const project2 = { ...project, maps: { ...project.maps } };
const [c, tc] = t(() => cachedPlaceMaps(project2, card, place, undefined));
console.log("maps ref changed -> ms", tc, "recomputed (new ref):", c.maps !== a.maps);

const project3 = { ...project, spatialAuthoring: { ...project.spatialAuthoring! } };
const [d, td] = t(() => cachedPlaceMaps(project3, card, place, undefined));
console.log("new spatialAuthoring doc -> ms", td, "recomputed:", d.maps !== a.maps);
