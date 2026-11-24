// editor/panels/draftOverviewData.ts
// 「초안 한 장 보기」가 그리는 것 — 열린 프로젝트만 읽는다(ideal-flow-draft 3·5번, 오너 2026-11-24).
// 첫 MVP 실행이 만든 세계·인물·맵 흐름·데이터 수를 한 장에 모은다. 없는 칸은 비워 두고 그리기 쪽이 숨긴다.
// 데이터 수는 엔진 기본 프리셋을 뺀 「이 게임 것」만 센다(databasePresetRecords).
import { countGameDatabaseRecords } from "@/project/databasePresetRecords";
import type { MapId, Project } from "@/project/types";
import { WORLD_CANON_TONE_LABELS } from "./databaseWorldCanonFields";
import { buildBeats, detectDirectorGenre } from "./studioDirectorData";

export interface DraftWorldCard {
  readonly name: string;
  readonly premise: string;
  readonly tones: readonly string[];
  readonly lines: readonly string[];
}

export type DraftPersonKind = "hero" | "companion" | "boss" | "other";

export interface DraftPersonCard {
  readonly key: string;
  readonly kind: DraftPersonKind;
  readonly roleLabel: string;
  readonly name: string;
  readonly sub: string;
  readonly bio: string;
  readonly faceResourceId: string;
}

export interface DraftMapNode {
  readonly mapId: MapId;
  readonly name: string;
  readonly roleLabel: string;
  readonly isStart: boolean;
  readonly exits: readonly string[];
}

export interface DraftCount {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

export interface DraftOverview {
  readonly world: DraftWorldCard | null;
  readonly people: readonly DraftPersonCard[];
  readonly maps: readonly DraftMapNode[];
  readonly counts: readonly DraftCount[];
}

const MAX_PEOPLE = 4;

const ROLE_LABEL: Record<DraftPersonKind, string> = { hero: "주인공", companion: "동료", boss: "보스", other: "인물" };

const text = (value: unknown): string => (typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "");

/** 별명 · 직업 — 엔진 자리표시 별명 «없음»은 빼고, 별명과 직업이 같은 낱말이면 한 번만. */
function subLine(nickname: unknown, className: unknown): string {
  const parts = [text(nickname), text(className)].filter((part) => part && part !== "없음");
  return [...new Set(parts)].join(" · ");
}

function readWorld(project: Project): DraftWorldCard | null {
  const canon = project.worldCanon;
  const blueprint = project.gameBlueprint;
  const name = text(canon?.name) || text(blueprint?.title);
  const premise = text(canon?.premise) || text(blueprint?.playerGoal);
  const tones = (canon?.tones ?? []).map((tone) => WORLD_CANON_TONE_LABELS[tone] ?? tone);
  const genre = text(blueprint?.genre);
  const opening = (blueprint?.opening ?? []).map(text).filter(Boolean);
  const body = text(canon?.body);
  // 세계 전제가 오프닝 글을 이어 붙인 것이면(초안 데이터가 world.premise 없이 채운 경우) 같은 줄을 두 번 싣지 않는다.
  const fresh = opening.filter((line) => !premise.includes(line));
  const lines = fresh.length ? fresh.slice(0, 3) : opening.length ? [] : body ? [body] : [];
  if (!name && !premise && lines.length === 0) return null;
  return { name: name || "이름 없는 세계", premise, tones: tones.length ? tones : genre ? [genre] : [], lines };
}

/** gameBlueprint.cast — 따로 붙고 있는 칸이다. 모양을 믿지 않고 이름 있는 항목만 읽는다. */
function readBlueprintCast(project: Project): { name: string; kind: DraftPersonKind; bio: string }[] {
  const cast = (project.gameBlueprint as { readonly cast?: unknown } | undefined)?.cast;
  const out: { name: string; kind: DraftPersonKind; bio: string }[] = [];
  const kindOf = (role: string, fallback: DraftPersonKind): DraftPersonKind =>
    /hero|주인공|protagonist/iu.test(role) ? "hero" : /boss|보스|마왕|적/iu.test(role) ? "boss" : /compan|동료|ally|party/iu.test(role) ? "companion" : fallback;
  const push = (entry: unknown, fallback: DraftPersonKind): void => {
    if (!entry || typeof entry !== "object") return;
    const record = entry as Record<string, unknown>;
    const name = text(record.name) || text(record.displayName);
    if (!name) return;
    out.push({ name, kind: kindOf(text(record.role), fallback), bio: text(record.bio) || text(record.note) });
  };
  if (Array.isArray(cast)) for (const entry of cast) push(entry, "other");
  else if (cast && typeof cast === "object") {
    const record = cast as Record<string, unknown>;
    push(record.hero, "hero");
    if (Array.isArray(record.companions)) for (const entry of record.companions) push(entry, "companion");
    push(record.boss, "boss");
  }
  return out;
}

function readPeople(project: Project): DraftPersonCard[] {
  const actors = project.database.actors;
  const classes = project.database.classes;
  const profiles = project.characters ?? {};
  const cards: DraftPersonCard[] = [];
  (project.system.startActorIds ?? []).forEach((id, index) => {
    const actor = actors.find((record) => record.id === id);
    if (!actor) return;
    const kind: DraftPersonKind = index === 0 ? "hero" : "companion";
    const className = classes.find((record) => record.id === actor.classId)?.name ?? "";
    cards.push({
      key: actor.id, kind, roleLabel: ROLE_LABEL[kind], name: text(actor.name) || actor.id,
      sub: subLine(actor.nickname, className),
      bio: text(profiles[actor.id]?.note), faceResourceId: actor.faceResourceId ?? "",
    });
  });
  // 싸움 없는 게임의 동료는 파티 밖 배우(actor_cast_*)다 — characters[배우 id] 에 소개가 있으면 동료로 세운다.
  const seenIds = new Set(cards.map((card) => card.key));
  for (const actor of actors) {
    if (seenIds.has(actor.id)) continue;
    const profile = profiles[actor.id];
    if (!text(profile?.note) && !text(profile?.displayName)) continue;
    seenIds.add(actor.id);
    const className = classes.find((record) => record.id === actor.classId)?.name ?? "";
    cards.push({
      key: actor.id, kind: "companion", roleLabel: ROLE_LABEL.companion, name: text(profile?.displayName) || text(actor.name) || actor.id,
      sub: subLine(actor.nickname, className),
      bio: text(profile?.note), faceResourceId: actor.faceResourceId ?? "",
    });
  }
  const known = new Set(cards.map((card) => card.name));
  const bossName = text(profiles["boss"]?.displayName);
  if (bossName) known.add(bossName);
  let castBoss: DraftPersonCard | null = null;
  for (const person of readBlueprintCast(project)) {
    if (known.has(person.name)) continue;
    known.add(person.name);
    const card: DraftPersonCard = { key: `cast:${person.name}`, kind: person.kind, roleLabel: ROLE_LABEL[person.kind], name: person.name, sub: "", bio: person.bio, faceResourceId: "" };
    if (person.kind === "boss") castBoss ??= card;
    else cards.push(card);
  }
  // 사람은 넷까지, 보스는 따로 하나.
  const people = cards.slice(0, MAX_PEOPLE);
  if (bossName) people.push({ key: "boss", kind: "boss", roleLabel: ROLE_LABEL.boss, name: bossName, sub: "", bio: text(profiles["boss"]?.note), faceResourceId: "" });
  else if (castBoss) people.push(castBoss);
  return people;
}

function readMaps(project: Project): DraftMapNode[] {
  return buildBeats(project, detectDirectorGenre(project)).map((beat) => ({
    mapId: beat.mapId, name: beat.title, roleLabel: beat.roleLabel, isStart: beat.isStart, exits: beat.exits,
  }));
}

function readCounts(project: Project): DraftCount[] {
  const db = project.database;
  const record = (id: string, label: string, list: readonly { readonly id: string }[] | undefined): DraftCount =>
    ({ id, label, count: list ? countGameDatabaseRecords(id, list) : 0 });
  return [
    record("actors", "인물", db.actors),
    record("classes", "직업", db.classes),
    record("skills", "스킬", db.skills),
    record("items", "아이템", db.items),
    record("equipment", "장비", db.equipment),
    record("enemies", "적", db.enemies),
    record("troops", "적 무리", db.troops),
    { id: "quests", label: "퀘스트", count: project.quests?.length ?? 0 },
    { id: "endings", label: "엔딩", count: project.endings?.length ?? 0 },
  ];
}

export function readDraftOverview(project: Project): DraftOverview {
  return { world: readWorld(project), people: readPeople(project), maps: readMaps(project), counts: readCounts(project) };
}

/** 「말로 고치기」가 입력창에 넣는 머리말 — «주인공 아젤: ». */
export function draftFixPrefix(label: string): string {
  return `${label}: `;
}

/** 방향 칩 — 누르면 이 문장을 조수에게 그대로 보낸다. */
export const DRAFT_DIRECTIONS: readonly { readonly group: string; readonly chips: readonly { readonly id: string; readonly label: string; readonly request: string }[] }[] = [
  { group: "톤", chips: [
    { id: "tone-bright", label: "밝게", request: "게임 톤을 더 밝게 바꿔 줘" },
    { id: "tone-dark", label: "어둡게", request: "게임 톤을 더 어둡게 바꿔 줘" },
  ] },
  { group: "난이도", chips: [
    { id: "difficulty-easy", label: "쉽게", request: "게임 난이도를 더 쉽게 바꿔 줘" },
    { id: "difficulty-hard", label: "어렵게", request: "게임 난이도를 더 어렵게 바꿔 줘" },
  ] },
  { group: "규모", chips: [
    { id: "scale-map", label: "맵 하나 더", request: "맵을 하나 더 만들어 지금 흐름에 이어 줘" },
  ] },
];
