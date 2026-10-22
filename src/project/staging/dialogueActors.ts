// project/staging/dialogueActors.ts
// 대사 한 줄의 «누가 누구에게» — 말하는 인물과 듣는 인물을 맵 위의 인물(주인공·이벤트)로 푼다.
//
// 대사(text)는 화자를 이름 문자열로만 들고 있다. 그 이름과 맵 위의 인물 사이에 고리가 없어서, 화자가 무대에 없거나
// 멀리 있거나 딴 데를 보는 채로 말해도 아무도 몰랐다(2026-10-22 『첫사랑』). 이 모듈이 그 고리다.
// 런타임 대사 자동 돌아보기(player/playSceneDialogueFacing.ts)와 장면 검사(lint/sceneStagingLint.ts)가 같은 규칙을 쓴다.
//
// 화자 찾는 순서: ① text.speakerActor ② 화자 이름 비었으면 이 이벤트 ③ 주인공 이름 → 주인공
//               ④ 맵의 «보이는» 인물 중 이름이 맞는 것(같음 > 포함 > 글자 순서), 여럿이면 이 이벤트 → 주인공에 가까운 쪽.
export const PLAYER_ACTOR = "@player";

export type StageActorCandidate = {
  readonly id: string;
  /** 이벤트 이름, 인물 프로필 표시 이름 등. */
  readonly names: readonly string[];
  readonly x: number;
  readonly y: number;
};

function norm(s: string): string {
  return s.normalize("NFC").replace(/[\s·.,'"“”‘’()（）[\]「」『』…\-_]/gu, "").toLowerCase();
}

/** 화자 이름과 후보 이름의 맞음 점수(0 = 아님). 3 같음 · 2 한쪽이 다른 쪽을 품음 · 1 글자 순서가 들어 있음. */
export function speakerNameScore(speaker: string, candidate: string): number {
  const a = norm(speaker), b = norm(candidate);
  if (a.length === 0 || b.length === 0) return 0;
  if (a === b) return 3;
  if (a.length >= 2 && b.length >= 2 && (b.includes(a) || a.includes(b))) return 2;
  if (a.length >= 2) {
    let i = 0;
    for (const ch of b) if (ch === a[i]) i += 1;
    if (i === a.length) return 1;
  }
  return 0;
}

/** 이름이 «사람이 아닌 목소리»인가(방송·안내·시스템). 무대 인물로 찾지 않는다. */
const NON_ACTOR_SPEAKER = /방송|안내|시스템|내레이션|나레이션|system|narrat|announce|radio|라디오|목소리|voice|전화|phone|\?\?\?/iu;

export function isNonActorSpeaker(speaker: string): boolean {
  return NON_ACTOR_SPEAKER.test(speaker);
}

export type ResolveSpeakerInput = {
  readonly speaker: string | undefined;
  readonly speakerActor?: string;
  /** 지금 실행 중인 이벤트 id(맵 위 인물일 수 있다). */
  readonly currentEventId?: string;
  /** 주인공의 이름들(액터 이름·별명 등). */
  readonly playerNames: readonly string[];
  /** 지금 맵에 «보이는» 인물(주인공 제외). */
  readonly visible: readonly StageActorCandidate[];
  readonly player: { readonly x: number; readonly y: number } | null;
};

/** 화자 인물 id(PLAYER_ACTOR 또는 이벤트 id). 못 찾으면 null(내레이션·속마음·화면 밖 목소리). */
export function resolveSpeakerActor(input: ResolveSpeakerInput): string | null {
  const explicit = input.speakerActor?.trim();
  if (explicit) return explicit === "player" ? PLAYER_ACTOR : explicit;
  const speaker = input.speaker?.trim() ?? "";
  if (!speaker) {
    return input.currentEventId && input.visible.some((v) => v.id === input.currentEventId) ? input.currentEventId : null;
  }
  if (isNonActorSpeaker(speaker)) return null;
  const playerScore = Math.max(0, ...input.playerNames.map((n) => speakerNameScore(speaker, n)));
  let best: { id: string; score: number; tie: number } | null = null;
  for (const v of input.visible) {
    const score = Math.max(0, ...v.names.map((n) => speakerNameScore(speaker, n)));
    if (score === 0) continue;
    const near = input.player ? Math.abs(v.x - input.player.x) + Math.abs(v.y - input.player.y) : 0;
    const tie = (v.id === input.currentEventId ? 0 : 1000) + near;
    if (!best || score > best.score || (score === best.score && tie < best.tie)) best = { id: v.id, score, tie };
  }
  if (playerScore >= 2 && (!best || playerScore >= best.score)) return PLAYER_ACTOR;
  if (best) return best.id;
  return playerScore > 0 ? PLAYER_ACTOR : null;
}

/** 화자 이름이 맵의 어떤 인물(보이든 숨었든)과 맞는가 — 「무대에 없는 화자」 검사용. */
export function matchesAnyActor(speaker: string, candidates: readonly StageActorCandidate[]): StageActorCandidate[] {
  const s = speaker.trim();
  if (!s || isNonActorSpeaker(s)) return [];
  const scored = candidates.map((c) => ({ c, score: Math.max(0, ...c.names.map((n) => speakerNameScore(s, n))) })).filter((e) => e.score >= 2);
  const top = Math.max(0, ...scored.map((e) => e.score));
  return scored.filter((e) => e.score === top).map((e) => e.c);
}

/**
 * 듣는 인물. ① text.addressee ② 화자가 NPC 면 주인공 ③ 화자가 주인공이면 이 장면에서 방금 말한 NPC,
 * 없으면 이 이벤트(보이는 인물일 때), 없으면 null.
 */
export function resolveAddressee(input: {
  readonly addressee?: string;
  readonly speakerActorId: string | null;
  readonly lastNpcSpeaker: string | null;
  readonly currentEventId?: string;
  readonly visibleIds: ReadonlySet<string>;
}): string | null {
  const explicit = input.addressee?.trim();
  if (explicit) return explicit === "player" ? PLAYER_ACTOR : explicit;
  if (!input.speakerActorId) return null;
  if (input.speakerActorId !== PLAYER_ACTOR) return PLAYER_ACTOR;
  if (input.lastNpcSpeaker && input.visibleIds.has(input.lastNpcSpeaker)) return input.lastNpcSpeaker;
  if (input.currentEventId && input.visibleIds.has(input.currentEventId)) return input.currentEventId;
  return null;
}
