// 작은 맵이 화면을 얼마나 채우는지(2026-10-29 vm4/vm5 판정 E 무더기 「맵보다 화면이 커서 맵 바깥이 보임」 22건).
//
//   QA_OUT=<폴더> QA_MAPS="<mapId>@x,y;<mapId>@x,y" node scripts/runtime-qa.mjs --scenario smallmap-fill --project <web.json> --netns
//
// 시작 맵(QA_MAPS 가 없으면 시작 맵만)과 QA_MAPS 의 맵마다: 카메라 배율·캔버스 크기·맵 크기·화면에서 맵이 차지하는 비율(가로·세로·넓이)을 적고 한 장 찍는다.
const OUT = process.env.QA_OUT ?? "/tmp/smallmap-fill";
const MAPS = (process.env.QA_MAPS ?? "").split(";").map((s) => s.trim()).filter(Boolean).map((s) => {
  const [mapId, at = "1,1"] = s.split("@");
  const [x, y] = at.split(",").map(Number);
  return { mapId, x, y };
});
const MEASURE = `async () => { await new Promise((r) => setTimeout(r, 1200)); const s = window.__oprnHooksScene; if (!s?.map) return null; const cam = s.cameras.main; const canvas = s.game.canvas;
  const css = canvas.getBoundingClientRect(); const tile = s.map.tileSize ?? 16; const z = cam.zoom; const k = css.width / canvas.width;
  const mapW = s.map.width * tile * z * k, mapH = s.map.height * tile * z * k;
  return { map: s.map.id, name: s.map.name, size: [s.map.width, s.map.height], tile, zoom: Math.round(z * 1000) / 1000, camera: [cam.width, cam.height], canvas: [canvas.width, canvas.height], css: [Math.round(css.width), Math.round(css.height)],
    mapPx: [Math.round(mapW), Math.round(mapH)], cover: { w: Math.round(Math.min(1, mapW / css.width) * 100), h: Math.round(Math.min(1, mapH / css.height) * 100), area: Math.round(Math.min(1, mapW / css.width) * Math.min(1, mapH / css.height) * 100) },
    tilePx: Math.round(tile * z * k * 10) / 10 }; }`;
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const smallmapFillScenario = {
  id: "smallmap-fill",
  // QA_VIEWPORT=960x720 — 판정자 손 도구(hplay.mjs)와 같은 창 크기.
  ...(process.env.QA_VIEWPORT ? { viewport: { width: Number(process.env.QA_VIEWPORT.split("x")[0]), height: Number(process.env.QA_VIEWPORT.split("x")[1]) } } : {}),
  beats: [
    { id: "start", note: "시작 맵", ops: [
      { kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 120000 },
      // 「PRESS START」 타이틀은 Enter 한 번이 메뉴 열기다 — 타이틀이 걷힐 때까지 누른다.
      { kind: "pressUntilJs", key: "Enter", maxPresses: 4, settleMs: 1200, fn: "() => !document.querySelector(\"[data-testid='title-screen']\")" },
      { kind: "waitForRuntime", timeoutMs: 240000 },
      { kind: "evalToFile", out: `${OUT}/0-wait.json`, fn: "async () => { await new Promise((r) => setTimeout(r, 1500)); return 1500; }" },
      { kind: "pressUntilJs", key: "Escape", maxPresses: 4, settleMs: 700, fn: "() => !/건너뛰기/.test(document.body.innerText)" },
      { kind: "pressUntilJs", key: "Enter", maxPresses: 40, settleMs: 500,
        fn: "() => !document.querySelector(\"[data-testid='dialogue-box']\") && !!window.__oprnHooksScene && !window.__oprnHooksScene.running && !document.querySelector(\"[data-testid='play-loading-overlay']\")" },
      { kind: "evalToFile", out: `${OUT}/1-start.json`, fn: MEASURE },
    ], shot: true },
    ...MAPS.map((m, i) => ({ id: `map${i + 2}`, note: m.mapId, ops: [
      { kind: "teleport", mapId: m.mapId, x: m.x, y: m.y },
      { kind: "evalToFile", out: `${OUT}/${i + 2}-map.json`, fn: MEASURE },
    ], shot: true })),
  ],
};
