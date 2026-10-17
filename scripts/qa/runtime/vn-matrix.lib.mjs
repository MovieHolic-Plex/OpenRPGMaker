// 미연시 대사창 매트릭스 시나리오 공용 구성기 — 픽스처(vn-matrix-fixture.mts)가 만든 proof.json 의 beats 를 그대로 캡처 비트로 만든다.
import fs from "node:fs";
import path from "node:path";
const stable = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 40, deltaMs: 16 }, { kind: "resumeFrames" }];
const settle = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 150, deltaMs: 16 }, { kind: "resumeFrames" }];
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
      beats.push({ id, note: `${b.tag} ${b.groupLabel} · ${b.position} · 이름 ${b.named ? "있음" : "없음"} · ${b.lenLabel} (글 줄)`, ops, shot: false });
      beats.push({ id: `${id}-c`, note: `${b.tag} 선택지 — ${b.groupLabel} · ${b.position}`,
        ops: [{ kind: "pressUntil", key: "Enter", testid: "runtime-choices", state: "present", maxPresses: 4 }, { kind: "waitForVisible", testid: "runtime-choices", minAlpha: 0.9 }, ...stable], shot: true });
      beats.push({ id: `${id}-p`, note: "선택지 고르기", ops: [key("1"), ...stable], shot: false });
      prevTag = "__after_choice__";
      // 선택 뒤의 다음 줄은 pressUntilText 가 아니라 이미 열려 있을 수 있다 — 아래 다음 비트의 pressUntilText 가 현재 글을 먼저 본다.
      continue;
    }
    beats.push({ id, note: `${b.tag} ${b.groupLabel} · ${b.position} · 이름 ${b.named ? "있음" : "없음"} · ${b.lenLabel}`, ops, shot: true });
    prevTag = b.tag;
  }
  return { id, projectFixture, viewport, beats };
}
