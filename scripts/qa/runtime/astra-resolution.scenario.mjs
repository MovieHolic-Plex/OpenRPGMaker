// 아스트라 해상도 비교: 같은 연구소 장면(체크포인트 starter-pick)을 논리 해상도·카메라 배율만 바꿔 1배로 찍는다.
// 실행: ASTRA_RES=480x320z2 npm run qa:runtime -- --scenario astra-resolution --checkpoint-set astra-horizon --checkpoint starter-pick
//   ASTRA_RES = <가로>x<세로>z<배율> (지금 출하값 480x320z2). 픽스처는 createFlagshipDemoProject("emerald-crown") 덤프(tmp/astra-pres/astra.project.json).
const spec = /^(\d+)x(\d+)z([\d.]+)$/.exec(process.env.ASTRA_RES ?? "480x320z2");
const [width, height, zoom] = spec ? [Number(spec[1]), Number(spec[2]), Number(spec[3])] : [480, 320, 2];
const MEASURE = process.env.ASTRA_MEASURE ? "true" : "false";
const vp = /^(\d+)x(\d+)$/.exec(process.env.ASTRA_VP ?? "");

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: `astra-resolution-${width}x${height}z${zoom}${vp ? `-vp${vp[1]}x${vp[2]}` : ""}${process.env.ASTRA_DPR ? `-dpr${process.env.ASTRA_DPR}` : ""}`,
  checkpointSet: "astra-horizon",
  projectFixture: process.env.ASTRA_FIXTURE ?? "tmp/astra-pres/astra.project.json",
  query: {},
  ...(process.env.ASTRA_DPR ? { deviceScaleFactor: Number(process.env.ASTRA_DPR) } : {}),
  viewport: vp ? { width: Number(vp[1]), height: Number(vp[2]) } : { width, height },
  systemPatch: { playResolution: { width, height }, cameraZoom: zoom },
  beats: [],
  checkpointBeats: {
    "route-1-meadow": [{ id: "field", ops: [{ kind: "waitForRuntime" }], shot: true }],
    "starter-pick": [
      { id: "field", ops: [{ kind: "waitForRuntime" }], shot: true, expect: { pageAssertions: [{ id: "scale", note: "무대 배율·기기 화소 기록", fn: `() => { const v = document.querySelector('[data-testid=\\\"play-viewport\\\"]'); const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); const m = { scale: v && v.dataset.scale, dpr: devicePixelRatio, canvas: [c.width, c.height], css: [r.width, r.height], left: r.left, top: r.top, devicePerCanvasPx: r.width * devicePixelRatio / c.width, deviceLeft: r.left * devicePixelRatio }; return ${MEASURE} ? 'MEASURE ' + JSON.stringify(m) : true; }` }] } },
      { id: "talk", ops: [{ kind: "face", dir: "up" }, { kind: "action" }, { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "present", maxPresses: 3, timeoutMs: 1500 }, { kind: "waitForVisible", testid: "dialogue-box" }, { kind: "key", key: "Enter", times: 1 }], shot: true },
    ],
  },
};
