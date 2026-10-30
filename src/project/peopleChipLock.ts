// project/peopleChipLock.ts
// 사람 칩 계열 잠금(2026-10-29) — 한 게임의 사람 캐릭터 칩(주인공·NPC·동료)은 한 계열만 쓴다.
// RTP 사람(EasyRPG Actor·People)·REFMAP 변형 인물·CT·FF6풍 영웅·현대 인물·Scarloxy 트레이너는 그림체가 달라 한 마을에 섞이면 어색하다
// (2026-10-28 실제 조수 마을 게임: RefmapDoll 5 + RTP 1 + 영웅 1). 사용자 결정 「첫 칩이 정함」: 계열을 정하지 않은 프로젝트에서
// 조수가 처음 새로 놓는 사람 칩의 계열로 잠그고, 그 뒤로 조수는 그 계열 사람 칩만 검색·배치한다. 사용자는 자료집 시스템 탭에서 바꾸거나 자동으로 되돌린다.
// 몬스터·동물·기물·공용 공방·업로드 칩은 잠그지 않는다. 장르 잠금(genreLock.ts)이 캐릭터 칩을 잠그는 프로젝트(몬스터 수집·연애)는 그 잠금이 정하므로 여기서는 아무것도 안 한다.
// 강제 대상은 조수·도구 경로(ctx.assistantRun)뿐 — 사용자의 손 편집은 막지 않는다. 이미 있던 그림은 건드리지 않고 새로 생기거나 바뀐 그림만 본다.
// 잎 모듈이다(번들 의미표를 끌어오지 않는다) — 판정은 리소스 id·텍스처 키 모양(charsetFamily.ts)만 본다.

import { CHARSET_FAMILY_LABELS, charsetFamilyOf, type CharsetFamilyContext, type CharsetFamilyId } from "./charsetFamily";
import { collectCharsetUses, type CharsetUse } from "./genreLockCharsetUses";
import { activeGenreLock } from "./genreLock";
import type { Project } from "./types";

/** 잠글 수 있는 사람 칩 계열(그림체가 서로 다른 번들 사람 칩). */
export const PEOPLE_CHIP_FAMILIES = ["rtp-people", "refmap-doll", "heroes", "modern", "scarloxy-people"] as const satisfies readonly CharsetFamilyId[];
export type PeopleChipFamilyId = (typeof PEOPLE_CHIP_FAMILIES)[number];

/** `system.peopleChipLock` — 저장 형태. 없으면 아직 안 정해졌다(조수가 처음 놓는 사람 칩이 정한다). */
export interface PeopleChipLock {
  readonly family: PeopleChipFamilyId;
  /** auto = 조수가 처음 놓은 사람 칩으로 정해졌다 · user = 사용자가 자료집에서 골랐다. */
  readonly by: "auto" | "user";
}

export function isPeopleChipFamily(value: unknown): value is PeopleChipFamilyId {
  return typeof value === "string" && (PEOPLE_CHIP_FAMILIES as readonly string[]).includes(value);
}

export function normalizePeopleChipLock(value: unknown): PeopleChipLock | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<PeopleChipLock>;
  return isPeopleChipFamily(raw.family) ? { family: raw.family, by: raw.by === "user" ? "user" : "auto" } : undefined;
}

type LockProject = Pick<Project, "system"> & CharsetFamilyContext;

/** 장르 잠금이 캐릭터 칩을 이미 잠그는가(그러면 이 잠금은 쉰다). */
function genreLockOwnsCharsets(project: Pick<Project, "system">): boolean {
  return !!activeGenreLock(project)?.allowedCharsets;
}

/** 이 프로젝트에서 사람 칩 잠금이 판정에 쓰는 계열. 아직 안 정해졌거나 장르 잠금이 캐릭터를 맡으면 undefined. */
export function peopleChipLockFamily(project: Pick<Project, "system">): PeopleChipFamilyId | undefined {
  if (genreLockOwnsCharsets(project)) return undefined;
  return normalizePeopleChipLock(project.system.peopleChipLock)?.family;
}

/** 칩 하나가 잠금 안인가(사람 칩이 아니거나 잠금이 없으면 true). */
export function peopleChipLockAllows(project: LockProject, idOrTextureKey: string): boolean {
  const family = peopleChipLockFamily(project);
  if (!family) return true;
  const of = charsetFamilyOf(project, idOrTextureKey);
  return !isPeopleChipFamily(of) || of === family;
}

/** 「maps/<맵>/events/<이벤트>」·「database/actors/<배우>」 처럼 그림 주인까지의 경로 — 페이지를 갈아 끼워도 같은 주인이다(genreLockMonsterAssetsDiff 와 같은 규칙). */
const ownerOf = (path: string): string => path.split("/").slice(0, path.startsWith("maps/") ? 4 : 3).join("/");

interface PeopleUse extends CharsetUse {
  readonly path: string;
  readonly family: PeopleChipFamilyId;
}

/** before → after 사이에 새로 생기거나 바뀐 사람 칩 사용처. 그 주인(이벤트·배우)이 이미 쓰던 칩은 새 선택이 아니다. */
function newPeopleUses(before: Project, after: Project): PeopleUse[] {
  const old = collectCharsetUses(before);
  const kept = new Set([...old].map(([path, use]) => `${ownerOf(path)}|${use.resourceId}|${use.characterIndex}`));
  const out: PeopleUse[] = [];
  for (const [path, use] of collectCharsetUses(after)) {
    if (use.unresolved !== undefined || !use.resourceId || use.battler) continue;
    const previous = old.get(path);
    if (previous && previous.resourceId === use.resourceId && previous.characterIndex === use.characterIndex) continue;
    if (kept.has(`${ownerOf(path)}|${use.resourceId}|${use.characterIndex}`)) continue;
    const family = charsetFamilyOf(after, use.resourceId);
    if (isPeopleChipFamily(family)) out.push({ ...use, path, family });
  }
  return out;
}

/** 새 사용처 중 가장 많은 계열(같으면 먼저 나온 것). */
function majorityFamily(uses: readonly PeopleUse[]): PeopleChipFamilyId {
  const count = new Map<PeopleChipFamilyId, number>();
  for (const use of uses) count.set(use.family, (count.get(use.family) ?? 0) + 1);
  let best = uses[0]!.family;
  for (const [family, n] of count) if (n > count.get(best)!) best = family;
  return best;
}

export class PeopleChipLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeopleChipLockError";
  }
}

export const peopleChipFamilyLabel = (family: PeopleChipFamilyId): string => CHARSET_FAMILY_LABELS[family];

const HOW_TO_CHANGE = "계열은 사용자만 자료집 시스템 탭 「사람 칩 계열」에서 바꾼다 — 조수가 다른 계열을 원하면 사용자에게 한 문장으로 묻는다.";

/**
 * 도구 실행이 만든 draft 의 사람 칩 판정 입구(toolRunner 가 부른다 — 조수·도구 경로만).
 * 아직 계열이 없으면 이번에 새로 놓인 사람 칩(여럿이면 가장 많은 계열)으로 draft 에 잠금을 적고 안내를 돌려준다.
 * 잠금 밖 계열 사람 칩이 새로 생기면 거부한다. `lenient`(캠페인 생성·장소 가져오기처럼 통째로 들이는 도구)는 막지 않고 개수만 경고한다.
 * 조수가 잠금 값 자체를 바꾸거나 지우면 거부한다.
 */
export function settlePeopleChipLock(before: Project, draft: Project, args: { toolName: string; lenient?: boolean }): string[] {
  if (genreLockOwnsCharsets(draft)) return [];
  const had = normalizePeopleChipLock(before.system.peopleChipLock);
  const now = normalizePeopleChipLock(draft.system.peopleChipLock);
  if (had && (now?.family !== had.family || now.by !== had.by)) {
    throw new PeopleChipLockError(`사람 칩 잠금: ${args.toolName} 이 이 프로젝트의 사람 칩 계열(${peopleChipFamilyLabel(had.family)})을 바꾸려 해 거부했다. ${HOW_TO_CHANGE}`);
  }
  const uses = newPeopleUses(before, draft);
  if (!uses.length) {
    if (!had && now) delete draft.system.peopleChipLock;   // 조수가 사람 칩 없이 잠금만 적지 않는다
    return [];
  }
  const notes: string[] = [];
  let family = had?.family;
  if (!family) {
    family = majorityFamily(uses);
    draft.system.peopleChipLock = { family, by: "auto" };
    notes.push(`사람 칩 잠금: 이 프로젝트에 처음 놓인 사람 칩의 계열(${peopleChipFamilyLabel(family)})로 사람 칩을 잠갔다 — 앞으로 주인공·NPC·동료는 이 계열만 쓰고, list_npc_graphics 도 이 계열 사람 칩만 보여 준다.`);
  }
  const outside = uses.filter((use) => use.family !== family);
  if (!outside.length) return notes;
  if (args.lenient) {
    return [...notes, `사람 칩 잠금(${peopleChipFamilyLabel(family)}): ${args.toolName} 이 다른 계열 사람 칩 ${outside.length}곳을 들여왔다(예: ${outside[0]!.where} ${outside[0]!.resourceId}#${outside[0]!.characterIndex}, ${peopleChipFamilyLabel(outside[0]!.family)}) — 통째로 들이는 도구라 막지 않았다. 그 인물은 ${peopleChipFamilyLabel(family)}로 바꾸는 편이 맞다.`];
  }
  const first = outside[0]!;
  throw new PeopleChipLockError(
    `사람 칩 잠금(${peopleChipFamilyLabel(family)}): ${args.toolName} 이 ${first.where} 에 「${first.resourceId}#${first.characterIndex}」(${peopleChipFamilyLabel(first.family)})를 쓰려 해 거부했다 — `
    + `이 게임의 사람은 ${peopleChipFamilyLabel(family)}만 쓴다(그림체를 섞지 않는다). list_npc_graphics 가 이 계열 사람 칩만 보여 주니 그 안에서 고르거나 graphic 을 생략해 다시 불러라. ${HOW_TO_CHANGE}`,
  );
}

/** 조수 실행 중 그림 검색·기본 선택을 잠금 계열 사람 칩(+ 사람이 아닌 칩)으로 좁히는 필터. 잠금이 없으면 undefined. */
export function peopleChipCatalogFilter(project: LockProject): ((entry: { readonly textureKey: string }) => boolean) | undefined {
  const family = peopleChipLockFamily(project);
  if (!family) return undefined;
  return (entry) => { const of = charsetFamilyOf(project, entry.textureKey); return !isPeopleChipFamily(of) || of === family; };
}

/** 시스템 프롬프트 한 줄. 장르 잠금이 캐릭터를 맡으면 null. */
export function peopleChipPromptNote(project: Pick<Project, "system">): string | null {
  if (genreLockOwnsCharsets(project)) return null;
  const family = peopleChipLockFamily(project);
  if (family) {
    return `[사람 칩 잠금 — ${peopleChipFamilyLabel(family)}] 이 게임의 사람 캐릭터 칩(주인공·NPC·동료)은 ${peopleChipFamilyLabel(family)}만 쓴다. list_npc_graphics 는 이 계열 사람 칩만 보여 주고, 다른 계열 사람 칩은 거부된다. 몬스터·동물·기물 칩은 상관없다.`;
  }
  return "[사람 칩 잠금] 사람 캐릭터 칩은 한 게임에 한 계열만 쓴다 — 처음 새로 놓는 사람 칩(주인공 포함)의 계열(RTP 사람 칩·REFMAP 변형 인물 칩·CT·FF6풍 영웅 칩·현대 인물 칩)로 잠기고, 그 뒤로는 그 계열만 쓸 수 있다. "
    + "마을 사람이 여럿 나오는 판타지 게임은 칩이 많은 REFMAP 변형 인물 칩(약 2,500명)이나 RTP 사람 칩에서 고른다 — 칩이 적은 영웅 칩으로 시작하면 NPC 가 모자란다.";
}

export interface PeopleChipLockStatus {
  readonly family?: PeopleChipFamilyId;
  readonly by?: PeopleChipLock["by"];
  /** 장르 잠금이 캐릭터 칩을 맡고 있다. */
  readonly genreLocked: boolean;
  /** 맵 이벤트·시작 파티 중 잠금 계열 밖 사람 칩 수(이미 있던 것·손 편집 포함 — 막지 않고 알리기만 한다). */
  readonly outside: number;
  /** 맵 이벤트·시작 파티의 계열별 사람 칩 수. */
  readonly counts: Readonly<Partial<Record<PeopleChipFamilyId, number>>>;
}

/** 자료집 시스템 탭 표시용. */
export function peopleChipLockStatus(project: Project): PeopleChipLockStatus {
  const lock = normalizePeopleChipLock(project.system.peopleChipLock);
  const counts: Partial<Record<PeopleChipFamilyId, number>> = {};
  // 화면에 나오는 사람만 센다: 맵 이벤트와 시작 파티. 자료집의 쓰지 않는 기본 배우(RTP 72명)는 세지 않는다.
  const party = new Set(project.system.startActorIds.map((id) => `database/actors/${id}/actor`));
  for (const [path, use] of collectCharsetUses(project)) {
    if (use.unresolved !== undefined || !use.resourceId || use.battler || use.viaActor) continue;
    if (!path.startsWith("maps/") && !party.has(path)) continue;
    const family = charsetFamilyOf(project, use.resourceId);
    if (isPeopleChipFamily(family)) counts[family] = (counts[family] ?? 0) + 1;
  }
  const outside = lock ? Object.entries(counts).filter(([family]) => family !== lock.family).reduce((sum, [, n]) => sum + (n ?? 0), 0) : 0;
  return { ...(lock ? { family: lock.family, by: lock.by } : {}), genreLocked: genreLockOwnsCharsets(project), outside, counts };
}
