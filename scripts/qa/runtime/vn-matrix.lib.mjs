// 미연시 대사창 매트릭스 시나리오 공용 구성기 — 픽스처(vn-matrix-fixture.mts)가 만든 proof.json 의 beats 를 그대로 캡처 비트로 만든다.
import fs from "node:fs";
import path from "node:path";
const stable = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 40, deltaMs: 16 }, { kind: "resumeFrames" }];
const settle = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 150, deltaMs: 16 }, { kind: "resumeFrames" }];
// 위치 탐침(VN_POS_PROBE_DIR): 캡처마다 대사창이 실제로 선 자리(position-* 클래스)와 초상 유무·사각을 JSON 으로 남긴다.
//   「흉상이 있는데 창이 위/가운데」인 캡처를 기계로 센다 — 눈으로만 훑지 않는다.
const POS_PROBE_FN = `() => { const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
 const o = document.querySelector('.dialogue-overlay'); const box = document.querySelector('.dialogue-box');
 const pos = ['top','center','bottom'].filter((p) => o?.classList.contains('position-' + p));
 return { overlayPositions: pos, boxPosition: box?.dataset.messagePosition ?? null, bust: [...document.querySelectorAll('.dialogue-face-bust')].map(r), listener: document.querySelectorAll('.dialogue-portrait-listener').length, cls: box?.className ?? null, box: r(box), choices: !!document.querySelector('[data-testid="runtime-choices"]'), vw: innerWidth, vh: innerHeight }; }`;
const probeOp = (id) => process.env.VN_POS_PROBE_DIR ? [{ kind: "evalToFile", fn: POS_PROBE_FN, out: path.join(process.env.VN_POS_PROBE_DIR, `${id}.json`) }] : [];
const key = (k, times = 1) => ({ kind: "key", key: k, times });

export function buildMatrixScenario({ id, viewport, fixtureDefault }) {
  const flag = process.argv.indexOf("--project");
  const projectFixture = flag >= 0 ? process.argv[flag + 1] : fixtureDefault;
  const proof = JSON.parse(fs.readFileSync(path.join(path.dirname(projectFixture), "proof.json"), "utf8"));
  const beats = [
    { id: "title", note: "타이틀", shot: false, expect: { testidPresent: ["title-screen"] } },
    { id: "01-start", note: "새 게임", ops: [key("Enter"), { kind: "waitForRuntime" }, ...settle, ...settle], expect: { mapId: proof.mapId } },
    { id: "02-walk", note: "상대 옆까지", ops: [{ kind: "playerRoute", moves: proof.moves }, { kind: "waitForPosition", mapId: proof.mapId, x: proof.at.x, y: proof.at.y, timeoutMs: 30000 }, ...stable] },
    { id: "03-talk", note: "대화 시작", ops: [{ kind: "face", dir: proof.face }, { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present" }], },
  ];
  let prevTag = null;
  for (const b of proof.beats) {
    const id = `m${String(b.n).padStart(3, "0")}-${b.group.toLowerCase()}-${b.position}-${b.named ? "nm" : "nn"}-${b.len}`;
    const ops = [];
    if (prevTag) ops.push({ kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: b.tag, maxPresses: 14 });
    else ops.push({ kind: "waitForText", testid: "dialogue-box", text: b.tag });
    ops.push(...stable);
    // 글이 다 나와 쪽이 준비될 때까지(긴 글 포함) 실시간으로 기다린다.
    ops.push({ kind: "waitForClass", testid: "dialogue-box", cls: "page-ready", timeoutMs: 60000 }, ...stable);
    if (b.kind === "choices") {
      // 글 다음 Enter 로 선택지를 연다.
      beats.push({ id, note: `${b.tag} ${b.groupLabel} · ${b.position} · 이름 ${b.named ? "있음" : "없음"} · ${b.lenLabel} (글 줄)`, ops: [...ops, ...probeOp(id)], shot: false });
      beats.push({ id: `${id}-c`, note: `${b.tag} 선택지 — ${b.groupLabel} · ${b.position}`,
        ops: [{ kind: "pressUntil", key: "Enter", testid: "runtime-choices", state: "present", maxPresses: 4 }, { kind: "waitForVisible", testid: "runtime-choices", minAlpha: 0.9 }, ...stable, ...probeOp(`${id}-c`)], shot: true });
      beats.push({ id: `${id}-p`, note: "선택지 고르기", ops: [key("1"), ...stable], shot: false });
      prevTag = "__after_choice__";
      // 선택 뒤의 다음 줄은 pressUntilText 가 아니라 이미 열려 있을 수 있다 — 아래 다음 비트의 pressUntilText 가 현재 글을 먼저 본다.
      continue;
    }
    beats.push({ id, note: `${b.tag} ${b.groupLabel} · ${b.position} · 이름 ${b.named ? "있음" : "없음"} · ${b.lenLabel}`, ops: [...ops, ...probeOp(id)], shot: true });
    prevTag = b.tag;
  }
  return { id, projectFixture, viewport, beats };
}
