// pirate_isles 구성기 시험 출력 — 종류:씨앗 목록을 짜서 OUT(기본 /tmp/pic/out.json)에 칸 배열로 쓴다. 그림은 compose_render.py.
// 실행: SPECS="harbor:1,beach:2" node_modules/.bin/vite-node scripts/content/pirate-isles/compose_probe.ts
import { composePirateIslesMap, PIRATE_DEFAULT_SIZE, type PirateMapKind } from "@/project/pirateIslesComposer";
import { createPirateIslesTileset } from "@/project/defaults/pirateIsles";
import { writeFileSync } from "node:fs";
const ts = createPirateIslesTileset();
const out: Record<string, unknown> = {};
for (const spec of (process.env.SPECS ?? "harbor:1,beach:1,fort:1,wreck:1,ship:1").split(",")) {
  const [kind, seedS, wS, hS] = spec.split(":"); const seed = Number(seedS);
  const sz = PIRATE_DEFAULT_SIZE[kind as PirateMapKind];
  const w = wS ? Number(wS) : sz.w, h = hS ? Number(hS) : sz.h;
  const map: any = { id: "m", name: "m", width: w, height: h, tilesetId: "pirate_isles", tileSize: 16, lowerTiles: new Array(w * h).fill(0), upperTiles: new Array(w * h).fill(-1), events: [] };
  const r = composePirateIslesMap(map, ts, kind as PirateMapKind, seed);
  out[spec] = { w, h, lower: map.lowerTiles, l2: map.lowerOverlayTiles ?? null, upper: map.upperTiles, layers: map.extraLayers ?? null, summary: r.summary, placed: r.placed, areas: r.areas, spawn: r.spawn, skipped: r.skipped, unreachable: r.unreachable, portals: r.portals };
  console.log(spec, r.summary, "skipped", r.skipped);
}
writeFileSync(process.env.OUT ?? "/tmp/pic/out.json", JSON.stringify(out));

// EXAMPLES=1 이면 참고문서용 완성 예제(tiledata/pirate-isles/examples/<id>.json)도 쓴다 — pi_refs.py 가 읽는다.
if (process.env.EXAMPLES) {
  const { mkdirSync } = await import("node:fs");
  const dir = "tiledata/pirate-isles/examples"; mkdirSync(dir, { recursive: true });
  const NAME: Record<string, [string, string]> = {
    harbor: ["해적 항구 마을", "남쪽 바다 + 돌 방파제 + 판자 부두(배 정박·해적 범선) + 북쪽 집 줄·큰길 + 방파제 앞 창고 줄 + 시장 광장 + 등대."],
    beach: ["열대 섬 해변 마을", "섬(모래 둘레·풀 안쪽) + 모래길 두 줄과 광장(모닥불·토템) + 오두막 + 부두 끝 수상 가옥."],
    fort: ["해안 요새", "성벽 사각 + 모퉁이 포대 + 남벽 문루(대문 이동 이벤트로 안뜰과 잇는다) + 남벽 위 대포(바다 겨눔) + 안뜰 병영·망루·보급 마당 + 해변."],
    wreck: ["난파선과 보물 동굴 섬", "작은 섬 + 북쪽 보물 동굴 입구·바위 + 남쪽 해변 난파선과 흩어진 짐 + 흙길."],
    ship: ["배 안", "뱃머리 뾰족한 선체 안: 선장실·선원 선실·주방 + 복도(위 갑판 계단) + 선창·포 갑판(남쪽 뱃전 대포)."],
    tavern: ["해적 술집 안", "홀(바 선반·벽난로·탁자) + 부엌·창고·뒷방."],
    cave: ["보물 동굴 안", "굴 입구 방 + 보물 방·굴 안쪽."],
    hut: ["섬 오두막 안", "방 하나(짚 침대·화덕·선반)."],
  };
  for (const [spec, m] of Object.entries(out) as [string, any][]) {
    const kind = spec.split(":")[0]!; const n = m.w * m.h;
    const fill = (a: number[] | null) => (a ? a.map((v) => (v == null ? -1 : v)) : new Array(n).fill(-1));
    const ex = { id: `pi-ex-${kind}`, name: NAME[kind]![0], desc: NAME[kind]![1], kind, seed: Number(spec.split(":")[1]), w: m.w, h: m.h,
      lower: m.lower, l2: fill(m.l2), upper: fill(m.upper), place: m.placed.map((p: any) => [p.id, p.x, p.y]), areas: m.areas, spawn: m.spawn, portals: m.portals ?? [], summary: m.summary };
    writeFileSync(`${dir}/pi-ex-${kind}.json`, JSON.stringify(ex));
  }
}
