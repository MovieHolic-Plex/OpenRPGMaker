// 조수 v2 — 두 선택 대화 장면(연애·고백·속마음처럼 선택지로 상대 반응이 갈리는 짧은 대화).
//
// 모델은 «누구와·무슨 말·두 선택과 각 반응»만 쓴다(SceneSpec). 이 파일이:
//  1) 확정 연애 기획(romance-scene 계약)이 있으면 v1 author_romance_scene 로 원자적으로 쓴다 — 상대·장소·선택 문구는 계약 그대로,
//     계약이 없으면 그 맵에 상대 NPC 를 place_npc 한 번으로 세운다(첫 대화 + 선택 → 반응 + 자기 스위치 → 선택별 재대화 쪽).
//  2) 상대 그림을 역할·외형에 맞고 «검토된 짝 얼굴»이 있는 칩으로 바꾸고, 상대가 말하는 줄 앞에만 그 얼굴을 띄운다
//     (주인공이 말하는 줄은 얼굴을 지운다 — 계약 초안의 임시 그림은 얼굴이 없어 대화창에 초상이 안 나왔다).
//  3) 두 선택을 실제 런타임 해석기(runSceneTest)로 돌려 반응·재대화가 서로 다른지 본다. 계약 경로는 inspect_romance_scene 도 부른다.
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { resolveGraphic } from "@/editor/tools/eventCompile";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { sceneContract } from "@/harnesses/romance-scene/runtime";
import { ROMANCE_IDS } from "@/harnesses/romance-scene/contract";
import { findMap, pickPersonGraphic, placeNpcWithGraphic, resolveWhere } from "./people";
import type { BuildRun, ContentBuildResult } from "./types";

export interface SceneChoice { readonly label: string; readonly reaction: string; readonly revisit: string }
export interface SceneSpec {
  readonly partner: string;
  readonly role?: string;
  readonly looks?: string;
  readonly mapId?: string;
  readonly where?: string;
  readonly opening: readonly string[];
  readonly choices: readonly SceneChoice[];
  readonly closing?: string;
}

export const SCENE_CARD =
  "두 선택 대화 장면(연애·고백·속마음·선택지로 반응이 갈리는 짧은 대화): add_scene {partner:상대 이름, role?:관계(소꿉친구), looks?:외형(여학생·교복), mapId?, where?, " +
  "opening:[상대의 도입 대사 1~6줄], choices:[{label, reaction:그 선택에 대한 상대 반응, revisit:그 뒤 다시 말 걸면 할 말}×2], closing?:주인공이 끝맺는 한 줄}. " +
  "줄마다 8자 이상, 상대가 직접 하는 말만(서술·화자 이름 금지), 두 반응·두 재대화는 서로 다르게. 확정 연애 기획(계약)이 있으면 상대·장소·선택 문구는 계약 그대로 쓰인다. " +
  "함수가 짝 얼굴 있는 그림으로 세우고 두 선택을 실제 런타임으로 돌려 검사한다. 무대 맵이 이미 있으면 다시 짓지 않는다.";

export const SCENE_SCHEMA = {
  type: "object",
  properties: {
    partner: { type: "string" }, role: { type: "string" }, looks: { type: "string" }, mapId: { type: "string" }, where: { type: "string" },
    opening: { type: "array", items: { type: "string" } },
    choices: { type: "array", items: { type: "object", properties: { label: { type: "string" }, reaction: { type: "string" }, revisit: { type: "string" } }, required: ["label", "reaction", "revisit"] } },
    closing: { type: "string" },
  },
  required: ["partner", "opening", "choices"],
};

const FACE = (resourceId: string): Command => ({ kind: "changeFace", resourceId, position: "left", flipHorizontally: false });

/** 상대가 말하는 줄 앞에는 상대 얼굴, 다른 사람이 말하는 줄 앞에는 얼굴 지우기 — 바뀔 때만 넣는다. 선택 분기는 갈래마다 따로. */
export function withSpeakerFaces(commands: readonly Command[], partner: string, faceId: string, start?: string): Command[] {
  const out: Command[] = [];
  let cur = start;
  for (const c of commands) {
    if (c.kind === "changeFace") continue; // 앞에 넣은 얼굴은 다시 계산한다
    if (c.kind === "text") {
      const want = c.speaker === partner ? faceId : "";
      if (want !== cur) { out.push(FACE(want)); cur = want; }
      out.push(c);
    } else if (c.kind === "choices") {
      out.push({ ...c, options: c.options.map((o) => ({ ...o, branch: withSpeakerFaces(o.branch, partner, faceId, cur) })),
        ...(c.cancelBranch ? { cancelBranch: withSpeakerFaces(c.cancelBranch, partner, faceId, cur) } : {}) });
      cur = undefined;
    } else out.push(c);
  }
  return out;
}

function lines(v: readonly string[] | undefined): string[] {
  return (v ?? []).map((s) => String(s).trim()).filter(Boolean);
}

/** 두 선택을 실제 해석기로: 걸어가 말 걸기 → 선택 → 마지막 대사(반응) → 다시 말 걸기(같은 첫 선택지가 다시 나오면 첫째를 고른다) → 마지막 대사(재대화). */
export function probeTwoChoices(project: Project, mapId: string, eventId: string): { reaction: string; revisit: string; ok: boolean; why?: string }[] {
  const map = project.maps[mapId];
  const event = map?.events.find((e) => e.id === eventId);
  if (!map || !event) return [];
  const start = project.startMapId === mapId ? project.startPos : { x: event.x, y: Math.min(map.height - 1, event.y + 1) };
  const talk = [{ kind: "walk" as const, to: { x: event.x, y: event.y }, adjacent: true }, { kind: "interact" as const, eventId }];
  return [0, 1].map((index) => {
    const first = runSceneTest(project, { mapId, start, steps: [...talk, { kind: "choose", index }] });
    const again = runSceneTest(project, { mapId, start, steps: [...talk, { kind: "choose", index }, ...talk] });
    const tail = (r: typeof first) => r.finalState.messages.at(-1) ?? "";
    return { reaction: tail(first), revisit: tail(again), ok: first.ok && again.ok, ...(first.ok && again.ok ? {} : { why: first.failureReason ?? again.failureReason ?? "실행 실패" }) };
  });
}

/** 상대 그림을 역할·외형에 맞는 짝 얼굴 칩으로 바꾸고, 상대 줄 앞에 그 얼굴을 띄운다(모든 쪽). */
function dressPartner(run: BuildRun, mapId: string, event: GameEvent, spec: SceneSpec, warnings: string[]): string | undefined {
  const map = findMap(run.ctx.project, mapId)!;
  const pick = pickPersonGraphic(run.ctx.project, map, spec.role ?? spec.partner, spec.looks);
  const old = event.pages?.[0]?.graphic as { sprite?: { id?: string }; pattern?: number; direction?: EventPage["graphic"]["direction"] } | undefined;
  if (!pick) { warnings.push(`${spec.partner}: 역할·외형(${[spec.role, spec.looks].filter(Boolean).join("·") || "없음"})에 맞는 사람 그림을 못 찾아 임시 그림 그대로 둔다(대화창 초상 없음).`); return undefined; }
  if (!pick.faceResourceId) warnings.push(`${spec.partner}: 고른 그림 '${pick.label}' 에 짝 얼굴이 없어 대화창 초상이 없다.`);
  const keepSprite = !!old?.sprite?.id && old.sprite.id === pick.textureKey && typeof old.pattern === "number" && decodeCharsetFrameIndex(old.pattern).characterIndex === pick.characterIndex;
  const graphic = keepSprite ? undefined : { ...resolveGraphic({ textureKey: pick.textureKey, characterIndex: pick.characterIndex }), ...(old?.direction ? { direction: old.direction } : {}) };
  (event.pages ?? []).forEach((page, pageIndex) => {
    const commands = pick.faceResourceId ? withSpeakerFaces(page.commands ?? [], spec.partner, pick.faceResourceId) : undefined;
    const set: Record<string, unknown> = { ...(graphic ? { graphic } : {}), ...(commands ? { commands } : {}) };
    if (!Object.keys(set).length) return;
    const res = run.call("patch_event_page", { mapId, eventId: event.id, pageIndex, set });
    if (!res.ok) warnings.push(`${spec.partner} 쪽 ${pageIndex} 그림·얼굴 바꾸기 실패: ${String(res.summary).slice(0, 160)}`);
  });
  return `${pick.label}${pick.faceResourceId ? "+얼굴" : ""}`;
}

export function buildScene(run: BuildRun, spec: SceneSpec): ContentBuildResult & { readonly probe?: unknown } {
  const firstCall = run.calls.length;
  const warnings: string[] = [];
  const done = (ok: boolean, mapIds: string[], summary: string, extra: Partial<ContentBuildResult> & { probe?: unknown } = {}) =>
    ({ ok, mapIds, summary, warnings, missingArt: [], calls: run.calls.slice(firstCall), ...extra });
  const choices = (spec.choices ?? []).slice(0, 2);
  if (choices.length !== 2) return done(false, [], "선택지는 정확히 두 개(label·reaction·revisit)여야 한다.");
  const opening = lines(spec.opening);
  if (!opening.length) return done(false, [], "상대의 도입 대사(opening)가 한 줄 이상 있어야 한다.");
  if (choices[0]!.reaction.trim() === choices[1]!.reaction.trim() || choices[0]!.revisit.trim() === choices[1]!.revisit.trim()) return done(false, [], "두 선택의 반응·재대화를 서로 다르게 쓴다.");

  const contract = sceneContract(run.ctx.project);
  if (contract) {
    // 확정 연애 기획 — 상대·장소·선택 문구는 계약이 정한다. 모델이 쓴 것과 다르면 알린다(계약을 바꾸지 않는다).
    const mapId = contract.mapId;
    if (spec.partner.trim() !== contract.partner) warnings.push(`상대 이름은 확정 기획대로 '${contract.partner}'(요청 '${spec.partner}').`);
    choices.forEach((c, i) => { if (c.label.trim() !== contract.choices[i]) warnings.push(`선택 ${i + 1} 문구는 확정 기획대로 「${contract.choices[i]}」(쓴 문구 「${c.label}」) — 반응은 이 순서로 붙었다.`); });
    if (spec.mapId && spec.mapId !== mapId) warnings.push(`무대는 확정 기획의 시작 맵 ${mapId} 이다(요청 ${spec.mapId}).`);
    const closing = (spec.closing ?? "").trim() || "오늘 이야기해 줘서 고마워. 다음에 또 여기서 이야기하자.";
    const res = run.call("author_romance_scene", {
      opening: opening.slice(0, 6), reactionA: choices[0]!.reaction.trim(), reactionB: choices[1]!.reaction.trim(),
      revisitA: choices[0]!.revisit.trim(), revisitB: choices[1]!.revisit.trim(), closing,
    });
    if (!res.ok) return done(false, [mapId], `연애 장면 작성 실패: ${String(res.summary).slice(0, 400)}`);
    const event = run.ctx.project.maps[mapId]?.events.find((e) => e.id === ROMANCE_IDS.npc);
    const look = event ? dressPartner(run, mapId, event, { ...spec, partner: contract.partner }, warnings) : undefined;
    const inspected = run.call("inspect_romance_scene", {});
    const data = (inspected.data ?? {}) as { ok?: boolean; blockers?: string[]; paths?: { choice: string; reaction: string; revisit: string }[] };
    if (!data.ok) warnings.push(`inspect_romance_scene 반려: ${(data.blockers ?? [String(inspected.summary)]).join(" / ").slice(0, 400)}`);
    const paths = (data.paths ?? []).map((p) => `「${p.choice}」→ ${p.reaction.slice(0, 40)} / 다시: ${p.revisit.slice(0, 30)}`);
    return done(!!data.ok, [mapId], `연애 장면(계약) — ${contract.partner} @ ${contract.place}: ${paths.join(" | ")}${look ? ` · 그림 ${look}` : ""}${data.ok ? " · 런타임 검사 통과(두 선택·재대화·취소·종료)" : " · 런타임 검사 반려"}`,
      { eventIds: [{ mapId, eventId: ROMANCE_IDS.npc }], probe: data });
  }

  // 계약 없음 — 그 맵에 상대를 세운다(첫 대화 + 선택별 반응·자기 스위치, 선택별 재대화 쪽).
  const mapId = spec.mapId ?? run.ctx.currentMapId ?? run.ctx.project.startMapId;
  const map = findMap(run.ctx.project, mapId);
  if (!map) return done(false, [], `맵 '${mapId}' 이 없다.`);
  const where = resolveWhere(run.ctx.project, map, spec.where, {});
  if (where.note) warnings.push(`${spec.partner}: ${where.note}`);
  const say = (body: string): Command => ({ kind: "text", speaker: spec.partner, body: body.trim() });
  const pages = [
    { name: "첫 대화", lines: opening, choices: choices.map((c, i) => ({ text: c.label.trim(), commands: [say(c.reaction), { kind: "setSelfSwitch", key: i ? "B" : "A", value: true }] })) },
    ...choices.map((c, i) => ({ name: `다시 — ${c.label.trim()}`, lines: [c.revisit.trim()], conditions: [{ kind: "selfSwitch", key: i ? "B" : "A", value: true }] })),
  ];
  const placed = placeNpcWithGraphic(run, map, { mapId, name: spec.partner, x: where.cell.x, y: where.cell.y, movement: "fixed", pages }, spec.role ?? spec.partner, spec.looks, spec.partner, warnings);
  if (!placed.result.ok) return done(false, [mapId], `${spec.partner} 세우기 실패: ${String(placed.result.summary).slice(0, 300)}`);
  const eventId = (placed.result.data as { eventId?: string } | undefined)?.eventId ?? "";
  if (!placed.graphic?.faceResourceId) warnings.push(`${spec.partner}: 짝 얼굴 있는 그림을 못 골라 대화창 초상이 없다.`);
  const probe = probeTwoChoices(run.ctx.project, mapId, eventId);
  const ok = probe.length === 2 && probe.every((p) => p.ok) && probe[0]!.reaction !== probe[1]!.reaction && probe[0]!.revisit !== probe[1]!.revisit
    && probe.every((p, i) => p.reaction === choices[i]!.reaction.trim() && p.revisit === choices[i]!.revisit.trim());
  if (!ok) warnings.push(`런타임 검사: ${JSON.stringify(probe).slice(0, 400)}`);
  const ev = run.ctx.project.maps[mapId]!.events.find((e) => e.id === eventId);
  return done(ok, [mapId], `대화 장면 — ${spec.partner} (${ev?.x},${ev?.y}) ${where.how ?? ""}: ${probe.map((p, i) => `「${choices[i]!.label}」→ ${p.reaction.slice(0, 40)} / 다시: ${p.revisit.slice(0, 30)}`).join(" | ")}${placed.graphic ? ` · 그림 ${placed.graphic.label}${placed.graphic.faceResourceId ? "+얼굴" : ""}` : ""}${ok ? " · 런타임 검사 통과" : " · 런타임 검사 실패"}`,
    { eventIds: eventId ? [{ mapId, eventId }] : [], probe });
}
