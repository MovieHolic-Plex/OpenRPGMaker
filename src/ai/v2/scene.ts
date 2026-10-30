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
import { startStateOf } from "@/project/session";
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
  "Two-choice dialogue scene (romance, confession, inner feelings — a short talk whose reaction branches on a choice): add_scene {partner:partner name, role?:relationship (소꿉친구 childhood friend), looks?:appearance (여학생 schoolgirl · 교복 uniform), mapId?, where?, " +
  "opening:[partner's opening lines, 1–6], choices:[{label, reaction:the partner's reaction to that choice, revisit:what they say when talked to again}×2], closing?:one closing line by the hero}. " +
  "Each line at least 8 characters, only what the partner says aloud (no narration, no speaker names), the two reactions and the two revisits must differ. If a confirmed romance plan (contract) exists, partner, place and choice text follow the contract. " +
  "The function stands the partner up with art that has a matching face and checks both choices in the real runtime. If the stage map already exists it is not rebuilt.";

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

/** 현대 무대(일본 도시·학교)인데 주인공이 판타지 기본 그림이면 같은 무대의 사람 칩으로 갈아입힌다(2026-10-23 3차: 옥상 장면의 주인공이
 * 주황 머리 판타지 용사라 교복 상대와 안 맞았다). 외형 프리셋(appearanceId)을 쓰는 배우는 저자 선택이라 건드리지 않는다. */
function dressHero(run: BuildRun, mapId: string, partnerKey: string | undefined, warnings: string[]): string | undefined {
  const project = run.ctx.project;
  const map = findMap(project, mapId);
  if (!map || !/jp_city|jp-|modern|campus|school|city16/i.test(map.tilesetId)) return undefined;
  const leaderId = startStateOf(project).partyActorIds[0];
  const actor = leaderId ? project.database.actors.find((a) => a.id === leaderId) : undefined;
  if (!actor || actor.appearanceId) return undefined;
  const cur = actor.characterResourceId ?? "";
  if (cur && !/easyrpg-charset-actor|(^|[-_])actor[1-4]\b|^Actor/i.test(cur)) return undefined;
  const pick = pickPersonGraphic(project, map, "남학생", "교복 남학생");
  if (!pick || `${pick.textureKey}#${pick.characterIndex}` === partnerKey) { warnings.push("주인공: 현대 무대에 맞는 사람 그림을 못 찾아 기본 그림 그대로 둔다."); return undefined; }
  const res = run.call("upsert_actor", { actor: { id: actor.id, characterResourceId: pick.textureKey, characterIndex: pick.characterIndex, ...(pick.faceResourceId ? { faceResourceId: pick.faceResourceId } : {}) } });
  if (!res.ok) { warnings.push(`주인공 그림 바꾸기 실패: ${String(res.summary).slice(0, 160)}`); return undefined; }
  return pick.label;
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
    const partnerGraphic = run.ctx.project.maps[mapId]?.events.find((e) => e.id === ROMANCE_IDS.npc)?.pages?.[0]?.graphic as { sprite?: { id?: string }; pattern?: number } | undefined;
    const hero = dressHero(run, mapId, partnerGraphic?.sprite?.id && typeof partnerGraphic.pattern === "number" ? `${partnerGraphic.sprite.id}#${decodeCharsetFrameIndex(partnerGraphic.pattern).characterIndex}` : undefined, warnings);
    if (hero) warnings.push(`주인공을 무대에 맞는 그림 '${hero}' 으로 갈아입혔다.`);
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
  const hero = dressHero(run, mapId, placed.graphic ? `${placed.graphic.textureKey}#${placed.graphic.characterIndex}` : undefined, warnings);
  if (hero) warnings.push(`주인공을 무대에 맞는 그림 '${hero}' 으로 갈아입혔다.`);
  const probe = probeTwoChoices(run.ctx.project, mapId, eventId);
  const ok = probe.length === 2 && probe.every((p) => p.ok) && probe[0]!.reaction !== probe[1]!.reaction && probe[0]!.revisit !== probe[1]!.revisit
    && probe.every((p, i) => p.reaction === choices[i]!.reaction.trim() && p.revisit === choices[i]!.revisit.trim());
  if (!ok) warnings.push(`런타임 검사: ${JSON.stringify(probe).slice(0, 400)}`);
  const ev = run.ctx.project.maps[mapId]!.events.find((e) => e.id === eventId);
  return done(ok, [mapId], `대화 장면 — ${spec.partner} (${ev?.x},${ev?.y}) ${where.how ?? ""}: ${probe.map((p, i) => `「${choices[i]!.label}」→ ${p.reaction.slice(0, 40)} / 다시: ${p.revisit.slice(0, 30)}`).join(" | ")}${placed.graphic ? ` · 그림 ${placed.graphic.label}${placed.graphic.faceResourceId ? "+얼굴" : ""}` : ""}${ok ? " · 런타임 검사 통과" : " · 런타임 검사 실패"}`,
    { eventIds: eventId ? [{ mapId, eventId }] : [], probe });
}
