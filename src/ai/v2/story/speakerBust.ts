// 말하는 사람의 공용 흉상 — v2 가 지은 대사는 화자의 흉상(걷기 칩의 검토된 짝 얼굴 → 그 표정 세트의 흉상)을 기본으로 띄운다.
// 왜(2026-11-12 오너, r1w-fun): «초상화나 이런 건 미리 만들어둔 거 써도 좋았겠다». 공용 흉상 2,400여 장(76세트 × 16표정)이 있는데
// 사슬·경로 빌더가 지은 사람은 얼굴 명령이 없어 이름표만 떴고, add_people(place_npc)은 48px 얼굴 낱장만 붙였다.
// 그림은 칩에서 결정적으로 나온다(모델에게 묻지 않는다): 칩 → 짝 얼굴(reviewedCharsetFaces) → 표정 세트 → `…-bust-base`.
// 표정은 대사 줄의 emotion 이 고른다(런타임 dialogueFaceForEmotion) — 함수가 기분을 아는 줄(싸우기 직전)에만 적는다.
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { findSharedPortrait, sharedExpressionSetIdOf, sharedPortraitId } from "@/assets/sharedPortraitAssets";
import { startStateOf } from "@/project/session";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";

type Obj = Record<string, unknown>;
type FaceCmd = Extract<Command, { kind: "changeFace" }>;

/** 얼굴(48px 낱장·흉상·전신) → 같은 인물의 흉상 기본 그림. 표정 세트가 없는 얼굴은 undefined. */
export function bustOfFace(faceResourceId: string | undefined): string | undefined {
  const setId = sharedExpressionSetIdOf(faceResourceId);
  const id = setId ? sharedPortraitId(setId, "bust", "base") : undefined;
  return id && findSharedPortrait(id) ? id : undefined;
}

/** 걷기 칩 → 그 인물의 흉상. 짝 얼굴이 없거나 흉상이 안 그려진 칩은 undefined. */
export function bustOfChip(textureKeyOrId: string | undefined, characterIndex = 0): string | undefined {
  return textureKeyOrId ? bustOfFace(reviewedFaceIdForCharset(textureKeyOrId, characterIndex)) : undefined;
}

function bustOfGraphic(graphic: unknown): string | undefined {
  const g = (graphic ?? {}) as { sprite?: { id?: unknown }; pattern?: unknown; transparent?: unknown };
  if (g.transparent === true || typeof g.sprite?.id !== "string") return undefined;
  return bustOfChip(g.sprite.id, decodeCharsetFrameIndex(typeof g.pattern === "number" ? g.pattern : 0).characterIndex);
}

/** 주인공(시작 파티 맨 앞)의 이름과 흉상. */
function heroBust(project: Project): { readonly name: string; readonly bust: string } | undefined {
  const lead = startStateOf(project).partyActorIds[0];
  const actor = lead ? project.database.actors.find((a) => a.id === lead) : undefined;
  const bust = actor ? bustOfChip(actor.characterResourceId, actor.characterIndex ?? 0) : undefined;
  return actor && bust ? { name: actor.name.trim(), bust } : undefined;
}

/** 이름 → 흉상 — 맵에 선 사람(이벤트 이름 = 그 사람)과 주인공. 같은 이름은 먼저 선 모습. */
function castBusts(project: Project): Map<string, string> {
  const cast = new Map<string, string>();
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    const name = (ev.name ?? "").trim();
    if (!name || cast.has(name)) continue;
    const bust = (ev.pages ?? []).map((page) => bustOfGraphic(page.graphic)).find(Boolean);
    if (bust) cast.set(name, bust);
  }
  const hero = heroBust(project);
  if (hero && !cast.has(hero.name)) cast.set(hero.name, hero.bust);
  return cast;
}

const isCmd = (v: unknown): v is Command => !!v && typeof v === "object" && typeof (v as Obj).kind === "string";
const isCmdList = (v: unknown): v is Command[] => Array.isArray(v) && v.length > 0 && v.every(isCmd);

/** 명령 목록 안 어디든(갈래 포함) 그 종류의 명령이 있나. */
function hasKind(list: readonly Command[], kind: string): boolean {
  return list.some((c) => c.kind === kind || Object.values(c as Obj).some((v) => (isCmdList(v) && hasKind(v, kind))
    || (Array.isArray(v) && v.some((o) => o && typeof o === "object" && Object.values(o as Obj).some((b) => isCmdList(b) && hasKind(b, kind))))));
}

/** 이미 있는 얼굴 명령의 낱장 얼굴을 같은 인물의 흉상으로(모양을 직접 정한 명령은 그대로). 바뀐 수를 센다. */
function upgradeFaces(list: readonly Command[], count: { n: number }): Command[] {
  return list.map((c) => {
    if (c.kind === "changeFace") {
      const bust = !c.presentation && !c.appearanceId && c.resourceId ? bustOfFace(c.resourceId) : undefined;
      if (!bust || bust === c.resourceId) return c;
      count.n += 1;
      return { ...c, resourceId: bust };
    }
    return nested(c, (branch) => upgradeFaces(branch, count));
  });
}

/** 명령 하나의 갈래(선택지 branch · 조건 then/else …)마다 f 를 돌린 사본. 갈래가 없으면 그대로. */
function nested(command: Command, f: (branch: Command[]) => Command[]): Command {
  let next: Obj | undefined;
  for (const [key, value] of Object.entries(command as Obj)) {
    if (isCmdList(value)) (next ??= { ...(command as Obj) })[key] = f(value);
    else if (Array.isArray(value) && value.some((o) => o && typeof o === "object" && Object.values(o as Obj).some(isCmdList))) {
      (next ??= { ...(command as Obj) })[key] = value.map((o) => (o && typeof o === "object"
        ? Object.fromEntries(Object.entries(o as Obj).map(([k, b]) => [k, isCmdList(b) ? f(b) : b])) : o));
    }
  }
  return (next ?? command) as Command;
}

/**
 * 얼굴 명령이 없는 목록에 화자마다 흉상을 건다 — 그 사람이 말하는 줄 바로 앞에만, 내레이션·모르는 화자 줄 앞에서는 지운다(바뀔 때만 넣는다).
 * 갈래는 갈래마다 따로 따지고, 갈래 뒤 첫 줄은 다시 정한다(eventCompile.placeSpeakerFace 와 같은 규칙 — 화자가 여럿이고 갈래가 깊어도 된다).
 */
function placeBusts(list: readonly Command[], bustFor: (speaker: string | undefined) => string, start: string | undefined, angryBefore: boolean, count: { n: number }): Command[] {
  const out: Command[] = [];
  let current = start;
  const fightAt = angryBefore ? list.findIndex((c) => c.kind === "battleProcessing") : -1;
  list.forEach((command, i) => {
    if (command.kind === "text") {
      const want = bustFor(command.speaker);
      if (want !== current) { out.push({ kind: "changeFace", resourceId: want, position: "left", flipHorizontally: false } satisfies FaceCmd); current = want; if (want) count.n += 1; }
      // 싸우기 직전의 그 사람 말은 화난 얼굴 — 함수가 기분을 아는 유일한 줄이다.
      out.push(want && i < fightAt && !command.emotion ? { ...command, emotion: "angry" } : command);
      return;
    }
    const inner = nested(command, (branch) => placeBusts(branch, bustFor, current ?? "", false, count));
    if (inner !== command) current = undefined;
    out.push(inner);
  });
  return out;
}

/** 이 페이지의 명령을 흉상 규칙으로 맞춘 사본(바뀐 것이 없으면 undefined). */
function settlePage(page: EventPage, cast: ReadonlyMap<string, string>, count: { n: number }): EventPage | undefined {
  const commands = (page.commands ?? []) as Command[];
  if (!commands.length) return undefined;
  const before = count.n;
  const next = hasKind(commands, "changeFace")
    ? upgradeFaces(commands, count)
    : placeBusts(commands, (speaker) => cast.get((speaker ?? "").trim()) ?? "", "", true, count);
  return count.n === before ? undefined : { ...page, commands: next };
}

/**
 * 프로젝트(또는 그 이벤트들)의 대사에 화자 흉상을 건다. 되풀이 안전 — 이미 흉상이 걸린 페이지는 그대로다.
 *  - 얼굴 명령이 이미 있는 페이지: 낱장 얼굴을 같은 인물의 흉상으로만 바꾼다(자리는 저작 그대로).
 *  - 얼굴 명령이 없는 페이지: 화자 이름이 맵에 선 사람·주인공이면 그 줄 앞에 흉상을 건다.
 * 바꾼 것 한 줄(없으면 빈 목록).
 */
export function settleSpeakerBustsIn(project: Project, only?: readonly { readonly mapId: string; readonly eventId: string }[]): string[] {
  const cast = castBusts(project);
  const wanted = only ? new Set(only.map((r) => `${r.mapId}\u0000${r.eventId}`)) : undefined;
  const count = { n: 0 };
  let events = 0;
  for (const map of Object.values(project.maps)) {
    let touched = false;
    const next = (map.events ?? []).map((ev): GameEvent => {
      if (wanted && !wanted.has(`${map.id}\u0000${ev.id}`)) return ev;
      let changed = false;
      const pages = (ev.pages ?? []).map((page) => { const settled = settlePage(page, cast, count); if (settled) changed = true; return settled ?? page; });
      if (!changed) return ev;
      touched = true; events += 1;
      return { ...ev, pages };
    });
    if (touched) map.events = next;
  }
  return events ? [`대사 ${count.n}곳에 화자 흉상(이벤트 ${events}개)`] : [];
}
