// 주인공이 가구·인물과 겹쳐 그려지는 자리 재현(2026-10-29 vm4/vm5 판정 D 무더기 「주인공이 가구·NPC 와 겹쳐 그려짐」 21건).
//
//   QA_OUT=<폴더> QA_SPOTS="<mapId>@x,y,dir;..." node scripts/runtime-qa.mjs --scenario depth-overlap --project <web.json> --netns
//
// 자리마다 주인공을 옮겨 그 방향을 보게 한 뒤, 주인공 그림 상자와 겹치는 보이는 그림(타일·인물)의 깊이를 적는다.
// above = 주인공보다 위에 그려지는 것. 그 칸(row)이 주인공 칸보다 위(북쪽)인데 above 면 3/4 깊이 규칙 위반이다.
const OUT = process.env.QA_OUT ?? "/tmp/depth-overlap";
const SPOTS = (process.env.QA_SPOTS ?? "").split(";").map((s) => s.trim()).filter(Boolean).map((s) => {
  const [mapId, at = "1,1,down"] = s.split("@");
  const [x, y, dir = "down"] = at.split(",");
  return { mapId, x: Number(x), y: Number(y), dir };
});
const PROBE = `async () => { await new Promise((r) => setTimeout(r, 900)); const s = window.__oprnHooksScene; if (!s?.player) return null;
  const tile = (s.map.tileSize ?? 16) * (s.mapTileScale ?? 1); const p = s.player; const pb = p.getBounds(); const pd = p.depth;
  const out = []; const seen = new Set();
  const walk = (o, parentDepth) => { if (!o || seen.has(o) || o === p || o.name === 'player-occlusion-ghost') return; seen.add(o); if (o.visible === false) return;
    const d = (parentDepth ?? 0) + (o.depth ?? 0);
    if (o.list) { for (const c of o.list) walk(c, o.type === 'Container' ? d : parentDepth); return; }
    if (!o.getBounds || (o.alpha ?? 1) < 0.05) return; const b = o.getBounds();
    const ix = Math.min(b.right, pb.right) - Math.max(b.left, pb.left), iy = Math.min(b.bottom, pb.bottom) - Math.max(b.top, pb.top);
    if (ix <= 0 || iy <= 0) return;
    out.push({ type: o.type, frame: String(o.frame?.name ?? ''), tex: String(o.texture?.key ?? '').slice(0, 40), depth: Math.round(d * 1000) / 1000, above: d > pd,
      bottomRow: Math.round((b.bottom / tile - 0.001) * 100) / 100, overlapPx: Math.round(ix * iy) }); };
  for (const c of s.children.list) walk(c, undefined);
  const ghost = s.children.getByName('player-occlusion-ghost'); return { at: [s.tileX, s.tileY, s.facing], occlusion: s.playerOcclusion ?? null, ghostVisible: !!(ghost && ghost.visible), playerDepth: pd, playerBottomRow: Math.round((pb.bottom / tile) * 100) / 100, playerBox: [Math.round(pb.x), Math.round(pb.y), Math.round(pb.width), Math.round(pb.height)], overlaps: out.sort((a, b) => b.overlapPx - a.overlapPx).slice(0, 20) }; }`;
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const depthOverlapScenario = {
  id: "depth-overlap",
  ...(process.env.QA_VIEWPORT ? { viewport: { width: Number(process.env.QA_VIEWPORT.split("x")[0]), height: Number(process.env.QA_VIEWPORT.split("x")[1]) } } : {}),
  beats: [
    { id: "start", note: "새 게임", ops: [
      { kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 120000 },
      // 「PRESS START」 타이틀은 Enter 한 번이 메뉴 열기다 — 타이틀이 걷힐 때까지 누른다.
      { kind: "pressUntilJs", key: "Enter", maxPresses: 4, settleMs: 1200, fn: "() => !document.querySelector(\"[data-testid='title-screen']\")" },
      { kind: "waitForRuntime", timeoutMs: 240000 },
      { kind: "evalToFile", out: `${OUT}/0-wait.json`, fn: "async () => { await new Promise((r) => setTimeout(r, 1500)); return 1500; }" },
      { kind: "pressUntilJs", key: "Escape", maxPresses: 4, settleMs: 700, fn: "() => !/건너뛰기/.test(document.body.innerText)" },
      { kind: "pressUntilJs", key: "Enter", maxPresses: 40, settleMs: 500,
        fn: "() => !document.querySelector(\"[data-testid='dialogue-box']\") && !!window.__oprnHooksScene && !window.__oprnHooksScene.running && !document.querySelector(\"[data-testid='play-loading-overlay']\")" },
      { kind: "evalToFile", out: `${OUT}/0-settle.json`, fn: "async () => { await new Promise((r) => setTimeout(r, 3500)); return 3500; }" },
    ] },
    ...SPOTS.map((spot, i) => ({ id: `spot${i + 1}`, note: `${spot.mapId}@${spot.x},${spot.y} ${spot.dir}`, ops: [
      { kind: "teleport", mapId: spot.mapId, x: spot.x, y: spot.y },
      { kind: "face", dir: spot.dir },
      { kind: "evalToFile", out: `${OUT}/${i + 1}-spot.json`, fn: PROBE },
    ], shot: true })),
  ],
};
