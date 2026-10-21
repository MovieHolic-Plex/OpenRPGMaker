// 대사창 고정 틀 QA 픽스처 — 출하 데모 프로젝트에 그 데모의 **실제 대사 명령**을 이어 붙인 시험 이벤트 하나를 더한다.
//   DFRAME_WHICH=fallen     『폴른 스타』(chrono-bell)
//   DFRAME_WHICH=astra      『아스트라 호라이즌』(emerald-crown)
//   DFRAME_WHICH=firstlove  「첫사랑」(first-love)
// 순서: 화자+초상 → 내레이션 → 선택지 → 초상 없는 화자 → 화자+초상 → 내레이션 → (저자가 명시한 position:"top" 한 줄).
// 데모 자신의 displayTextSettings 를 맨 앞에 그대로 싣는다(없으면 싣지 않는다). 오프닝은 QA 사본에서만 끈다.
// 실행: npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/runtime/dialogue-frame-fixture.mts > .omo/runtime-qa/dframe/<which>.json
import { serialize } from "../../../src/project/io";
import type { Command, GameEvent } from "../../../src/project/types";

const which = process.env.DFRAME_WHICH ?? "fallen";
const ids = { fallen: "chrono-bell", astra: "emerald-crown", firstlove: "first-love" } as const;
const demoId = ids[which as keyof typeof ids];
if (!demoId) throw new Error(`DFRAME_WHICH=${which} 를 모른다`);
// DFRAME_BASE=<이미 구운 데모 JSON> — 데모 빌더가 이 체크아웃에서 실패할 때(2026-10-22 main: 첫사랑 승강장 「아래 출입구 틈이 없다」) 그 사본을 쓴다.
const base = process.env.DFRAME_BASE;
const { readFileSync } = await import("node:fs");
const project = base
  ? (JSON.parse(readFileSync(base, "utf8")) as import("../../../src/project/types").Project)
  : (await import("../../../src/project/flagship")).createFlagshipDemoProject(demoId).project;

type AnyCmd = Command & Record<string, unknown>;
const all: AnyCmd[][] = [];
const walk = (list: readonly Command[] | undefined): void => {
  if (!list) return;
  all.push(list as AnyCmd[]);
  for (const c of list as AnyCmd[]) {
    for (const key of ["then", "else", "branch", "cancelBranch", "otherwiseBranch"]) walk(c[key] as Command[] | undefined);
    for (const option of (c.options as { branch?: Command[] }[] | undefined) ?? []) walk(option.branch);
  }
};
for (const map of Object.values(project.maps)) for (const ev of map.events) {
  walk(ev.commands);
  for (const p of ev.pages ?? []) walk(p.commands);
}
for (const ce of project.commonEvents ?? []) walk(ce.commands);

const isNarration = (c: AnyCmd): boolean => c.kind === "text" && (!c.speaker || c.context === "narration") && !c.container && (!c.position || c.position === "bottom") && String(c.body).length > 8;
const isSpeech = (c: AnyCmd): boolean => c.kind === "text" && !!c.speaker && !c.context && !c.container && (!c.position || c.position === "bottom") && String(c.body).length > 8;
let facedLine: [AnyCmd, AnyCmd] | undefined;
let facedLine2: [AnyCmd, AnyCmd] | undefined;
let bareSpeech: AnyCmd | undefined;
let firstSpeech: AnyCmd | undefined;
const narrations: AnyCmd[] = [];
let choices: AnyCmd | undefined;
let settings: AnyCmd | undefined;
for (const list of all) {
  let face: AnyCmd | undefined;
  for (const c of list) {
    if (c.kind === "changeFace") face = c.resourceId || c.appearanceId ? c : undefined;
    if (c.kind === "displayTextSettings" && !settings) settings = c;
    if (c.kind === "choices" && !choices && (c.options as unknown[]).length >= 2 && (c.options as unknown[]).length <= 4) choices = c;
    if (isNarration(c) && narrations.length < 2) narrations.push(c);
    if (isSpeech(c)) {
      firstSpeech ??= c;
      if (face && !facedLine) facedLine = [face, c];
      else if (face && facedLine && !facedLine2 && c.speaker !== facedLine[1].speaker) facedLine2 = [face, c];
      else if (!face && !bareSpeech) bareSpeech = c;
    }
  }
}
const pick = (c: AnyCmd | undefined, fallback: AnyCmd): AnyCmd => structuredClone(c ?? fallback);
const clearFace: AnyCmd = { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false } as AnyCmd;
const sample = (body: string, speaker?: string): AnyCmd => ({ kind: "text", body, ...(speaker ? { speaker } : {}) }) as AnyCmd;
const said = facedLine?.[1] ?? firstSpeech ?? sample("(시험) 화자 줄", "화자");
const seq: AnyCmd[] = [];
if (settings) seq.push(structuredClone(settings));
if (facedLine) seq.push(structuredClone(facedLine[0]));
seq.push(pick(said, said));
seq.push(clearFace, pick(narrations[0], sample("(시험) 내레이션 한 줄입니다.")));
seq.push({ ...pick(choices, { kind: "choices", options: [{ text: "예", branch: [] }, { text: "아니오", branch: [] }] } as unknown as AnyCmd), options: ((choices?.options as { text: string }[] | undefined) ?? [{ text: "예" }, { text: "아니오" }]).map((o) => ({ text: o.text, branch: [] })) } as AnyCmd);
seq.push(pick(bareSpeech, sample("(시험) 초상 없는 화자 줄", "행인")));
if (facedLine2) seq.push(structuredClone(facedLine2[0]), structuredClone(facedLine2[1]));
else if (facedLine) seq.push(structuredClone(facedLine[0]), pick(said, said));
seq.push(clearFace, pick(narrations[1] ?? narrations[0], sample("(시험) 내레이션 두 번째 줄입니다.")));
seq.push({ ...sample("(시험) 저자가 이 줄만 위로 올렸다.", "시험"), position: "top" } as AnyCmd);
seq.push({ kind: "setSwitch", switchId: "sw_dframe_done", value: true } as AnyCmd);

project.switches.push({ id: "sw_dframe_done", name: "대사창 QA 끝" } as never);
const map = project.maps[project.startMapId];
if (!map) throw new Error("시작 맵 없음");
// 시작 맵의 다른 자동 실행 이벤트는 QA 사본에서 끈다 — 시험 줄 사이에 다른 장면이 끼지 않게.
for (const ev of map.events) for (const p of ev.pages ?? []) if (p.trigger?.kind === "auto") p.trigger = { kind: "action" };
for (const ev of map.events) if (!ev.pages && ev.trigger?.kind === "auto") ev.trigger = { kind: "action" };
for (const ce of project.commonEvents ?? []) if (ce.trigger === "auto") ce.trigger = "none";
const page = (id: string, conditions: unknown[], commands: AnyCmd[], trigger: string) => ({
  id, name: id, conditions, graphic: { direction: "down", pattern: 0, transparent: true },
  movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "below", trigger: { kind: trigger }, commands,
});
const qaEvent = {
  id: "ev_dframe_qa", name: "대사창 QA", x: 0, y: 0, trigger: { kind: "auto" }, commands: [],
  pages: [page("p_run", [], seq, "auto"), page("p_done", [{ kind: "switch", switchId: "sw_dframe_done", value: true }], [], "action")],
} as unknown as GameEvent;
map.events.push(qaEvent);
if (project.system.opening) project.system.opening = { ...project.system.opening, enabled: false };
// DFRAME_STYLE=<대화창 스타일 id> / DFRAME_VN=<미연시 룩 프리셋> — 스킨 행렬(같은 데모 줄을 스킨만 바꿔 잰다).
if (process.env.DFRAME_STYLE) {
  project.system.dialogueStyle = process.env.DFRAME_STYLE as never;
  const m = (project as { meta?: Record<string, unknown> }).meta;
  if (m) delete m.oprnVnLook;
}
if (process.env.DFRAME_VN) ((project as { meta?: Record<string, unknown> }).meta ??= {}).oprnVnLook = { version: 1, preset: process.env.DFRAME_VN };
// DFRAME_SCENE=door — 폴른 스타 천문대의 잠긴 철문 앞(주인공이 문을 밟는 바로 그 칸)에서 화자 → 잠긴 문 안내(내레이션) → 화자.
// DFRAME_SCENE=letterbox — 마을 광장의 실제 컷신(ev_fs_event: 레터박스 띠 + 발렌·엘레나 대사)을 그대로 자동 실행.
const scene = process.env.DFRAME_SCENE;
if (scene === "door" || scene === "letterbox") {
  const findEvent = (mapId: string, id: string) => project.maps[mapId]?.events.find((e) => e.id === id);
  const run = (qaEvent.pages ?? [])[0]!;
  if (scene === "door") {
    const gate = findEvent("fs_observatory", "ev_world_gate_y0wah3");
    const fork = gate?.pages?.[0]?.commands.find((c) => c.kind === "fork") as AnyCmd | undefined;
    const locked = (fork?.else as AnyCmd[] | undefined)?.find((c) => c.kind === "text");
    if (!gate || !locked) throw new Error("천문대 철문 이벤트 없음");
    const obs = project.maps.fs_observatory!;
    for (const ev of obs.events) for (const p of ev.pages ?? []) if (p.trigger?.kind === "auto") p.trigger = { kind: "action" };
    map.events.splice(map.events.indexOf(qaEvent), 1);
    obs.events.push(qaEvent);
    project.startMapId = "fs_observatory";
    (project as { startPos: { x: number; y: number } }).startPos = { x: gate.x, y: gate.y - 1 };
    const lines: AnyCmd[] = [];
    if (settings) lines.push(structuredClone(settings));
    if (facedLine) lines.push(structuredClone(facedLine[0]));
    lines.push(pick(said, said), clearFace, structuredClone(locked));
    if (facedLine) lines.push(structuredClone(facedLine[0]));
    lines.push(pick(said, said), structuredClone(locked));
    lines.push({ kind: "setSwitch", switchId: "sw_dframe_done", value: true } as AnyCmd);
    run.commands = lines;
  } else {
    const cut = findEvent("fs_hub", "ev_fs_event");
    const cmds = (cut?.pages?.[0]?.commands ?? []) as AnyCmd[];
    if (!cmds.length) throw new Error("광장 컷신 없음");
    run.commands = [...structuredClone(cmds), { kind: "setSwitch", switchId: "sw_dframe_done", value: true } as AnyCmd];
    (project as { startPos: { x: number; y: number } }).startPos = { x: cut!.x, y: cut!.y + 2 };
  }
}
const badgeOverride = process.env.DFRAME_ENDING_BADGE;
// DFRAME_LANG=ko|en|ja|zh — 게임 언어(대사 시스템 language). 읽기 보조 기능은 켜지 않는다.
const lang = process.env.DFRAME_LANG;
const meta = ((project as { meta?: Record<string, unknown> }).meta ??= {});
if (lang) meta.oprnDialogueSystem = {
  ...(meta.oprnDialogueSystem as object ?? { version: 1, backlog: { enabled: false, limit: 100 }, auto: { enabled: false }, skip: { enabled: false }, hideButton: { enabled: false }, defaults: { textSpeed: "normal", autoSpeed: "normal", skipScope: "read", windowOpacity: 1 } }),
  language: lang,
};
// DFRAME_ENDING=<엔딩 id> — 시험 이벤트를 그 엔딩 하나로 바꾼다(조건은 QA 사본에서 비운다). 엔딩 카드 언어 확인용.
const endingId = process.env.DFRAME_ENDING;
if (endingId) {
  const ending = project.endings?.find((e) => e.id === endingId);
  if (!ending) throw new Error(`엔딩 ${endingId} 없음`);
  ending.conditions = [];
  // 엔딩 이름은 저작 글이라 엔진이 번역하지 않는다 — 영어 게임이면 저자가 영어로 쓴다. 언어 QA 사본은 그 이름도 그 언어로.
  if (process.env.DFRAME_ENDING_NAME) ending.name = process.env.DFRAME_ENDING_NAME;
  ending.epilogue = [];
  if (badgeOverride) ending.presentation = { ...ending.presentation, badge: badgeOverride, finalTitle: process.env.DFRAME_ENDING_FINAL ?? "" };
  const run = (qaEvent.pages ?? [])[0]!;
  run.commands = [{ kind: "triggerEnding", endingId } as unknown as Command];
}
process.stderr.write(`[dframe] ${which} map=${project.startMapId} seq=${seq.map((c) => c.kind === "text" ? `text(${c.speaker ?? "-"}${c.position ? `@${c.position}` : ""})` : c.kind).join(" → ")} settings=${JSON.stringify(settings ?? null)}\n`);
process.stdout.write(base ? JSON.stringify(project) : serialize(project));
