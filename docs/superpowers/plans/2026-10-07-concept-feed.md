# 새 게임 = 컨셉 피드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 입구 넷(런처 첫 화면·런처 새 게임·메뉴 새 프로젝트·편집기 환영 화면)을 하나의 유튜브식 「컨셉 피드」로 바꾸고, 컨셉 하나를 누르면 묻지 않고 바로 게임 생성을 시작한다.

**Architecture:** 순수 컨셉 형식(`src/concepts/`)을 서버·Electron·하네스·화면이 함께 쓴다. 컨셉은 스토어 서버 새 표에서 쪽 단위로 받고(Electron 메인 중계), 실패하면 앱 번들 20개로 대체한다. 「만들기」는 컨셉을 기존 `GameDesignBrief`(+ `concept` 필드)로 바꿔 이미 있는 `generationPending → prepareProjectInterviewStartup` 경로에 넘긴다.

**Tech Stack:** TypeScript, DOM(`el()` 헬퍼), Electron IPC + zod, store-server(Node 24 + Postgres, node:test), vite-node 하네스 CLI, Python 없이 Node 만.

**Spec:** `docs/superpowers/specs/2026-10-07-concept-feed-design.md`

## Global Constraints

- 썸네일 화풍: SNES 16비트 도트(인터뷰 그림 규칙과 같은 문장). 글자·로고 금지.
- 원작 이름·고유 색 조합 금지(해리포터·호그와트·말포이·파이널판타지·포켓몬 등). 패러디 이름만.
- 「만들기」는 이름·폴더·화면 크기를 묻지 않는다: 제목 = 컨셉 제목, 폴더 = `suggestProjectDir` 기본, 화면 = `wide`.
- AI 연결 확인은 만들기 직전 `ensureAiConnectedForPreset`. 거절하면 폴더를 만들지 않는다.
- 렌더러는 스토어 서버와 직접 통신하지 않는다(Electron 메인 중계, `openwiki/asset-store.md`).
- 공식 컨셉은 사람이 받은 것만 게시한다. 감독 에이전트는 대신 고르지 않는다.
- 운영 스토어(`store.openrpgmaker.com`) 쓰기는 `--target prod` 명시 스위치에서만.
- 워크트리 세션 규칙: vitest·gates·`npm test` 는 사용자가 요청할 때만 실행한다. 테스트는 쓰고, 증거는 브라우저 캡처와 store-server 타입 검사로 남긴다.
- 편집기 e2e 가 쓰는 `oprn:editor-welcome-dismissed` 키 의미를 유지한다(환영 피드 창도 이 키를 따른다).
- 화면 문구는 한국어로 쓰고 en/ja/zh 카탈로그에 넣는다. 문장을 조각으로 이어 붙이지 않는다.

## Review Focus

1. 스토어가 느리거나 죽었을 때 피드가 빈 화면·무한 로딩이 되면 안 된다 → 3초 안에 번들 20개 + 「인터넷에 연결하면 더 볼 수 있어요」.
2. 같은 컨셉을 두 번 눌러 「만들기」를 연타 → 폴더가 하나만 생겨야 한다(busy 잠금).
3. 「살짝 바꾸기」에 300자 넘게·줄바꿈·HTML 을 넣음 → 300자로 자르고 글자 그대로 요약 마지막 줄에 들어간다.
4. 무한 스크롤 중 분류 칩을 바꿈 → 이전 요청 결과가 새 목록에 섞이면 안 된다(요청 순번 비교).
5. 웹 편집기(Electron 아님)에서 메뉴 「새 프로젝트」 → 피드는 번들 20개로 뜨고, 만들기는 기존 `createProjectFolderWithSeed` 실패 안내를 그대로 보인다.

---

## File Map

| 파일 | 책임 |
|---|---|
| `src/concepts/format.ts` (새) | `GameConcept` 타입, `CONCEPT_TAGS`, `normalizeGameConcept`, `conceptSlug` |
| `src/concepts/brief.ts` (새) | `conceptBrief(concept, tweak)` → `GameDesignBrief` |
| `src/concepts/art.ts` (새) | `conceptArtPrompt(concept)` 도트 썸네일 프롬프트, `CONCEPT_FORBIDDEN_NAMES` |
| `src/concepts/source.ts` (새) | `ConceptSource`: 스토어 쪽 읽기 + 번들 대체, 썸네일 URL 해석 |
| `src/concepts/draft.ts` (새) | 입력 문장 → 컨셉 초안(LLM) + 썸네일 생성 |
| `src/assets/bundledConcepts.json` (새) | 비상용 20개 |
| `public/assets/concepts/*.webp` (새) | 비상용 썸네일 |
| `src/project/gameDesignBrief.ts` | `concept?` 필드 정규화 |
| `src/editor/welcomeGenrePresets.ts` | 컨셉 있으면 표시 문구·프롬프트 머리에 컨셉 제목 |
| `store-server/migrations/006_concepts.sql` (새) | `store_concepts` |
| `store-server/src/concepts.ts` (새) | 목록·상세·made·게시 |
| `store-server/src/app.ts` | 라우트 5개 |
| `store-server/test/concepts.test.ts` (새) | 통합 테스트 |
| `electron/shared/channels.ts`, `schemas.ts`, `electron/main/assetStore.ts`, `assetStoreClient.ts`, `electron/preload/index.ts`, `src/assetStore/bridgeTypes.ts` | 컨셉 중계 채널 3개 |
| `src/start/conceptFeed/conceptFeed.ts` (새) | 피드·상세 화면 컴포넌트 |
| `src/start/conceptFeed/conceptFeed.css` (새) | 스타일 |
| `src/start/conceptFeed/makeGame.ts` (새) | 입구별 만들기 처리기 3종 |
| `src/start/startScreen.ts` | 피드로 교체(이어하기 줄·폴더 열기·팀 참여 유지) |
| `src/editor/panels/menu.ts` | 「새 프로젝트」 → 피드 창 |
| `src/app/mode.ts` | 환영 화면 → 피드 창 |
| `src/harnesses/game-concepts/**` (새) | 공식 컨셉 하네스 |
| 지울 것 | `src/start/startLobby.ts`, `startInterview.ts`, `firstWorldArrival.ts`, `src/editor/ui/newProjectDialog.ts`, `src/editor/editorWelcome.ts`, 해당 CSS·테스트, `public/assets/project-interview/world-motion.mp4`·`world-poster.webp` |

---

### Task 1: 컨셉 형식과 기획 변환

**Files:**
- Create: `src/concepts/format.ts`, `src/concepts/brief.ts`, `src/concepts/art.ts`
- Modify: `src/project/gameDesignBrief.ts` (interface + normalize)
- Test: `test/concepts.test.ts`

**Interfaces:**
- Produces:
  - `type ConceptTag = typeof CONCEPT_TAGS[number]`
  - `interface GameConcept { slug; title; hook; description; tags: ConceptTag[]; presetId: GamePresetId; protagonist; stage; firstScene; brief: Record<GameBriefSlot,string>; tilesetHint?: string; thumb: { full: string; card: string }; locales?: …; source: "official"|"user"; author?: { name: string }; madeCount?: number; aiGenerated: true }`
  - `normalizeGameConcept(value: unknown): GameConcept` (throws `Error` with 한국어 메시지)
  - `conceptSlug(title: string, salt?: string): string`
  - `CONCEPT_TWEAK_LIMIT = 300`
  - `conceptBrief(concept: GameConcept, tweak?: string): GameDesignBrief` (`generationPending` 없음 — 호출부가 붙인다)
  - `conceptArtPrompt(concept: Pick<GameConcept,"title"|"hook"|"protagonist"|"stage"|"firstScene">): string`
  - `conceptForbiddenNameHits(text: string): string[]`
  - `GameDesignBrief.concept?: { slug: string; title: string; hook: string; tweak?: string }`

- [ ] **Step 1: 테스트 작성** — `test/concepts.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { normalizeGameConcept, conceptSlug, CONCEPT_TAGS } from "@/concepts/format";
import { conceptBrief } from "@/concepts/brief";
import { conceptArtPrompt, conceptForbiddenNameHits } from "@/concepts/art";
import { normalizeGameDesignBrief } from "@/project/gameDesignBrief";

const RAW = {
  slug: "body-swap-villainess", title: "몸이 뒤바뀐 악역영애", hook: "처형 3일 전, 눈을 떠 보니 그 아이의 몸이었다.",
  description: "왕립 아카데미 무도회에서 시작하는 뒤바뀐 두 사람의 이야기.", tags: ["웹소설", "연애"], presetId: "story-cutscene",
  protagonist: "악역영애(평민 소녀의 몸)", stage: "왕립 아카데미", firstScene: "무도회장 거울 앞",
  brief: { experience: "뒤바뀐 몸으로 처형을 피한다", activity: "대화·조사", progression: "3일 카운트다운", detail: "거울·무도회", scope: "첫날 밤까지" },
  thumb: { full: "/assets/concepts/body-swap-villainess.webp", card: "/assets/concepts/body-swap-villainess.card.webp" },
  source: "official", aiGenerated: true,
};

describe("concept format", () => {
  it("normalizes a valid concept", () => {
    const concept = normalizeGameConcept(RAW);
    expect(concept.presetId).toBe("story-cutscene");
    expect(concept.tags).toEqual(["웹소설", "연애"]);
  });
  it("rejects unknown preset, tag, too-long title and missing brief slot", () => {
    expect(() => normalizeGameConcept({ ...RAW, presetId: "rts" })).toThrow();
    expect(() => normalizeGameConcept({ ...RAW, tags: ["없는분류"] })).toThrow();
    expect(() => normalizeGameConcept({ ...RAW, title: "가".repeat(41) })).toThrow();
    expect(() => normalizeGameConcept({ ...RAW, brief: { ...RAW.brief, scope: "" } })).toThrow();
  });
  it("tags list includes the user's categories", () => {
    for (const tag of ["웹소설", "패러디", "퓨전 사극", "정통 JRPG", "몬스터 수집", "추리", "연애", "호러", "힐링"]) expect(CONCEPT_TAGS).toContain(tag);
  });
  it("slug is ascii kebab", () => {
    expect(conceptSlug("마법사 in 조선")).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("conceptBrief", () => {
  it("maps brief slots and survives brief normalization", () => {
    const brief = conceptBrief(normalizeGameConcept(RAW));
    expect(brief.presetId).toBe("story-cutscene");
    expect(brief.answers.experience.text).toBe("뒤바뀐 몸으로 처형을 피한다");
    expect(brief.answers.experience.source).toBe("recommended");
    expect(brief.concept).toEqual({ slug: "body-swap-villainess", title: "몸이 뒤바뀐 악역영애", hook: RAW.hook });
    expect(normalizeGameDesignBrief(brief)).toEqual(brief);
  });
  it("appends a trimmed tweak as the last summary line", () => {
    const brief = conceptBrief(normalizeGameConcept(RAW), "  주인공을 고양이로\n<b>x</b>" + "가".repeat(400));
    const last = brief.summary.split("\n").at(-1)!;
    expect(last.startsWith("사용자 변경: 주인공을 고양이로 <b>x</b>")).toBe(true);
    expect(brief.concept!.tweak!.length).toBe(300);
    expect(normalizeGameDesignBrief(brief).concept!.tweak).toBe(brief.concept!.tweak);
  });
});

describe("concept art", () => {
  it("prompt carries the SNES pixel contract and no-text rule", () => {
    const prompt = conceptArtPrompt(normalizeGameConcept(RAW));
    expect(prompt).toContain("16-bit SNES");
    expect(prompt).toContain("No letters");
  });
  it("flags original IP names", () => {
    expect(conceptForbiddenNameHits("TS 말포이와 호그와트")).toEqual(["말포이", "호그와트"]);
    expect(conceptForbiddenNameHits("TS 금발 라이벌 도련님")).toEqual([]);
  });
});
```

- [ ] **Step 2: 구현** — `src/concepts/format.ts`

```ts
// 컨셉 피드 카드 한 장(oprn-concept/1). 서버·Electron·하네스·화면이 같이 쓰는 순수 모듈 — DOM·node 의존 없음.
import { GAME_BRIEF_SLOTS, GAME_PRESET_IDS, type GameBriefSlot, type GamePresetId } from "@/project/gameDesignBrief";

export const CONCEPT_FORMAT = "oprn-concept/1";
export const CONCEPT_TAGS = ["웹소설", "패러디", "퓨전 사극", "정통 JRPG", "몬스터 수집", "추리", "연애", "호러", "힐링", "농장", "액션", "SF", "학원", "코미디"] as const;
export type ConceptTag = typeof CONCEPT_TAGS[number];
export const CONCEPT_LOCALES = ["en", "ja", "zh"] as const;
export type ConceptLocale = typeof CONCEPT_LOCALES[number];
export const CONCEPT_TWEAK_LIMIT = 300;
export const CONCEPT_LIMITS = { title: 40, hook: 120, description: 600, protagonist: 120, stage: 120, firstScene: 160, brief: 1000 } as const;

export interface GameConcept {
  slug: string; title: string; hook: string; description: string; tags: ConceptTag[]; presetId: GamePresetId;
  protagonist: string; stage: string; firstScene: string; brief: Record<GameBriefSlot, string>;
  tilesetHint?: string; thumb: { full: string; card: string };
  locales?: Partial<Record<ConceptLocale, { title: string; hook: string; description: string }>>;
  source: "official" | "user"; author?: { name: string }; madeCount?: number; aiGenerated: true;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
function text(value: unknown, label: string, max: number): string {
  if (typeof value !== "string") throw new Error(`컨셉 ${label}이(가) 글자가 아닙니다.`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw new Error(`컨셉 ${label} 길이가 올바르지 않습니다(1~${max}자).`);
  return trimmed;
}

export function normalizeGameConcept(value: unknown): GameConcept {
  if (!isRecord(value)) throw new Error("컨셉이 객체가 아닙니다.");
  const slug = text(value.slug, "slug", 80);
  if (slug.length < 3 || !SLUG.test(slug)) throw new Error("컨셉 slug 는 소문자·숫자·하이픈 3~80자입니다.");
  if (!GAME_PRESET_IDS.includes(value.presetId as GamePresetId)) throw new Error("컨셉 장르 틀이 올바르지 않습니다.");
  if (!Array.isArray(value.tags) || value.tags.length < 1 || value.tags.length > 4) throw new Error("컨셉 분류는 1~4개입니다.");
  const tags = value.tags.map((tag) => {
    if (!CONCEPT_TAGS.includes(tag as ConceptTag)) throw new Error(`모르는 컨셉 분류입니다: ${String(tag)}`);
    return tag as ConceptTag;
  });
  if (!isRecord(value.brief)) throw new Error("컨셉 기획 5칸이 없습니다.");
  const brief = {} as Record<GameBriefSlot, string>;
  for (const slot of GAME_BRIEF_SLOTS) brief[slot] = text((value.brief as Record<string, unknown>)[slot], `기획(${slot})`, CONCEPT_LIMITS.brief);
  if (!isRecord(value.thumb)) throw new Error("컨셉 썸네일이 없습니다.");
  const thumb = { full: text(value.thumb.full, "썸네일", 300), card: text(value.thumb.card, "썸네일", 300) };
  let locales: GameConcept["locales"];
  if (value.locales !== undefined) {
    if (!isRecord(value.locales)) throw new Error("컨셉 번역이 올바르지 않습니다.");
    locales = {};
    for (const locale of CONCEPT_LOCALES) {
      const entry = value.locales[locale];
      if (entry === undefined) continue;
      if (!isRecord(entry)) throw new Error("컨셉 번역이 올바르지 않습니다.");
      locales[locale] = { title: text(entry.title, "번역 제목", 80), hook: text(entry.hook, "번역 훅", 240), description: text(entry.description, "번역 설명", 1200) };
    }
  }
  if (value.source !== "official" && value.source !== "user") throw new Error("컨셉 출처가 올바르지 않습니다.");
  return {
    slug, title: text(value.title, "제목", CONCEPT_LIMITS.title), hook: text(value.hook, "훅", CONCEPT_LIMITS.hook),
    description: text(value.description, "설명", CONCEPT_LIMITS.description), tags: [...new Set(tags)], presetId: value.presetId as GamePresetId,
    protagonist: text(value.protagonist, "주인공", CONCEPT_LIMITS.protagonist), stage: text(value.stage, "무대", CONCEPT_LIMITS.stage),
    firstScene: text(value.firstScene, "첫 장면", CONCEPT_LIMITS.firstScene), brief, thumb,
    ...(typeof value.tilesetHint === "string" && value.tilesetHint ? { tilesetHint: text(value.tilesetHint, "타일셋", 80) } : {}),
    ...(locales && Object.keys(locales).length ? { locales } : {}),
    source: value.source,
    ...(isRecord(value.author) ? { author: { name: text(value.author.name, "작가", 60) } } : {}),
    ...(typeof value.madeCount === "number" && Number.isFinite(value.madeCount) ? { madeCount: Math.max(0, Math.floor(value.madeCount)) } : {}),
    aiGenerated: true,
  };
}

/** 한글 제목도 ascii slug 로. 같은 제목 충돌은 salt(짧은 해시)로 피한다. */
export function conceptSlug(title: string, salt = ""): string {
  const ascii = title.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  let hash = 2166136261;
  for (const ch of title + salt) hash = Math.imul(hash ^ ch.codePointAt(0)!, 16777619) >>> 0;
  const tail = hash.toString(36).slice(0, 6);
  return (ascii.length >= 3 ? `${ascii.slice(0, 60)}-${tail}` : `concept-${tail}`).replace(/-+/g, "-");
}

export function localizedConcept(concept: GameConcept, locale: string): Pick<GameConcept, "title" | "hook" | "description"> {
  const entry = concept.locales?.[locale as ConceptLocale];
  return entry ?? { title: concept.title, hook: concept.hook, description: concept.description };
}
```

- [ ] **Step 3: 구현** — `src/concepts/brief.ts`

```ts
// 컨셉 → 확정 게임 기획. 이후 경로(generationPending → prepareProjectInterviewStartup)는 인터뷰와 같다.
import { GAME_BRIEF_SLOTS, gameDesignSummary, type GameBriefSlot, type GameDesignAnswer, type GameDesignBrief } from "@/project/gameDesignBrief";
import { CONCEPT_TWEAK_LIMIT, type GameConcept } from "./format";

const SLOT_LABELS: Record<GameBriefSlot, { label: string; question: string }> = {
  experience: { label: "핵심 경험", question: "이 게임에서 플레이어가 느낄 것은?" },
  activity: { label: "주로 하는 일", question: "플레이어가 주로 하는 행동은?" },
  progression: { label: "진행", question: "게임은 어떻게 앞으로 나아가나?" },
  detail: { label: "인물과 무대", question: "누가 어디에서?" },
  scope: { label: "첫 제작 범위", question: "처음 만들 구간은?" },
};

export function cleanTweak(tweak: string | undefined): string {
  return (tweak ?? "").replace(/\s+/gu, " ").trim().slice(0, CONCEPT_TWEAK_LIMIT);
}

export function conceptBrief(concept: GameConcept, tweak?: string): GameDesignBrief {
  const answers = {} as Record<GameBriefSlot, GameDesignAnswer>;
  for (const slot of GAME_BRIEF_SLOTS) answers[slot] = { ...SLOT_LABELS[slot], text: concept.brief[slot], source: "recommended" };
  const change = cleanTweak(tweak);
  const head = [`컨셉: ${concept.title} — ${concept.hook}`, `주인공: ${concept.protagonist}`, `무대: ${concept.stage}`, `첫 장면: ${concept.firstScene}`];
  const summary = [...head, gameDesignSummary(answers), ...(change ? [`사용자 변경: ${change}`] : [])].join("\n").slice(0, 4000);
  return {
    version: 1, presetId: concept.presetId, answers, summary,
    concept: { slug: concept.slug, title: concept.title, hook: concept.hook, ...(change ? { tweak: change } : {}) },
  };
}
```

`summary` 가 4000자를 넘으면 앞부분이 남도록 자르되, 사용자 변경 줄은 300자 이하라 잘림 전에 앞 줄을 줄인다 — 위 구현은 brief 칸 각 ≤1000 이라 최대 약 5,400자가 될 수 있다. 그래서 구현은 다음처럼 바꾼다:

```ts
  const tail = change ? `\n사용자 변경: ${change}` : "";
  const body = [...head, gameDesignSummary(answers)].join("\n").slice(0, 4000 - tail.length);
  const summary = body + tail;
```

- [ ] **Step 4: 구현** — `src/concepts/art.ts`

```ts
// 컨셉 썸네일 도트 규칙. 인터뷰 그림(src/editor/interviewSceneGeneration.ts)과 같은 화풍 계약.
import type { GameConcept } from "./format";

/** 원작 고유 이름 — 제목·훅·설명·그림 프롬프트에 있으면 탈락. 패러디는 이름을 바꿔 쓴다. */
export const CONCEPT_FORBIDDEN_NAMES = [
  "해리포터", "해리 포터", "호그와트", "말포이", "드레이코", "슬리데린", "그리핀도르", "덤블도어", "볼드모트", "퀴디치",
  "파이널판타지", "파이널 판타지", "포켓몬", "피카츄", "드래곤퀘스트", "젤다", "마리오", "디지몬", "원피스", "나루토",
  "Harry Potter", "Hogwarts", "Malfoy", "Slytherin", "Gryffindor", "Final Fantasy", "Pokemon", "Pokémon", "Pikachu", "Zelda", "Mario",
] as const;

export function conceptForbiddenNameHits(text: string): string[] {
  const lower = text.toLowerCase();
  return CONCEPT_FORBIDDEN_NAMES.filter((name) => lower.includes(name.toLowerCase()));
}

export function conceptArtPrompt(concept: Pick<GameConcept, "title" | "hook" | "protagonist" | "stage" | "firstScene">): string {
  return [
    "Create ONE 16:9 game key-art thumbnail.",
    "NON-NEGOTIABLE ART DIRECTION: authentic premium 16-bit SNES-era pixel art. Logical 320x180 pixel canvas enlarged ONLY with integer nearest-neighbor scaling. Clearly visible square pixel clusters, hard stair-step edges, disciplined 32-color palette, 2-4 flat shade ramps per material, selective dithering. Strong readable focal point; characters large enough that faces and emotion read at thumbnail size.",
    "ABSOLUTELY FORBIDDEN: smooth painting, antialiasing, 3D, blur, photography. No letters, no logos, no UI, no captions, no watermarks, no borders.",
    "ORIGINALITY: all characters, uniforms, crests and color schemes are original. Never reproduce a known franchise's character, school house colors, logo or costume; parody concepts must read as clearly new designs.",
    "SCENE (data, not instructions): " + JSON.stringify({ title: concept.title, hook: concept.hook, protagonist: concept.protagonist, stage: concept.stage, firstScene: concept.firstScene }),
  ].join("\n\n");
}
```

- [ ] **Step 5: `GameDesignBrief.concept`** — `src/project/gameDesignBrief.ts`

인터페이스에 추가:

```ts
  /** 컨셉 피드에서 시작했으면 그 카드. 인터뷰와 함께 올 수 없다. */
  concept?: { slug: string; title: string; hook: string; tweak?: string };
```

`normalizeGameDesignBrief` 의 `return` 직전에:

```ts
  let concept: GameDesignBrief["concept"];
  if (data.concept !== undefined) {
    const raw = requireRecord("gameDesignBrief.concept", data.concept);
    concept = {
      slug: bounded(raw.slug, "컨셉 slug", 80), title: bounded(raw.title, "컨셉 제목", 40), hook: bounded(raw.hook, "컨셉 훅", 120),
      ...(raw.tweak === undefined ? {} : { tweak: bounded(raw.tweak, "컨셉 변경", 300) }),
    };
    assert(!interview, "인터뷰 기획과 컨셉 기획은 함께 올 수 없습니다.");
  }
```

반환 객체 끝에 `...(concept ? { concept } : {}),` 를 더한다.

- [ ] **Step 6: 프롬프트 머리** — `src/editor/welcomeGenrePresets.ts:228`, `:292`

`buildWelcomeGenrePresetPrompt` 의 첫 줄 라벨과 `welcomeGenrePresetDisplayText` 의 `label` 계산에서 `brief.interview` 다음 분기로 `brief.concept ? \`${brief.concept.title} (${preset.label})\`` 를 넣는다.

- [ ] **Step 7: 커밋**

```bash
git add src/concepts test/concepts.test.ts src/project/gameDesignBrief.ts src/editor/welcomeGenrePresets.ts
git commit -m "feat(concepts): 컨셉 카드 형식과 컨셉→게임 기획 변환"
```

---

### Task 2: 스토어 서버 컨셉 표·API

**Files:**
- Create: `store-server/migrations/006_concepts.sql`, `store-server/src/concepts.ts`, `store-server/test/concepts.test.ts`
- Modify: `store-server/src/app.ts` (라우트), `store-server/scripts/run-tests.mjs`(새 테스트 파일이 자동 포함되는지 확인, 아니면 추가)

**Interfaces:**
- Consumes: `normalizeGameConcept`, `GameConcept` (Task 1, `../../src/concepts/format`)
- Produces (HTTP):
  - `GET /api/v1/concepts?tag=&q=&preset=&cursor=&lang=` → `{ items: ConceptCard[], nextCursor: string | null }`
  - `GET /api/v1/concepts/:slug?lang=` → `{ concept: ConceptCard, similar: ConceptCard[] }` (404 `not_found`)
  - `POST /api/v1/concepts/:slug/made` → 204
  - `POST /api/v1/admin/concepts` (운영자) body `{ concept: GameConcept(thumb 은 sha256 두 개), rank?: number }` → `{ slug }`, 같은 slug 면 덮어쓴다
  - `ConceptCard` = `GameConcept` 에서 `thumb: { full: sha256, card: sha256 }`, `madeCount`, `author?`

- [ ] **Step 1: 마이그레이션**

```sql
-- 컨셉 피드 카드(oprn-concept/1). 공식은 author_id null. 그림은 store_blobs 의 sha256 두 개.
create table if not exists store_concepts (
  id bigserial primary key,
  slug text not null unique,
  author_id bigint references store_users(id),
  body jsonb not null,
  tags text[] not null default '{}',
  preset_id text not null,
  full_sha text not null references store_blobs(sha256),
  card_sha text not null references store_blobs(sha256),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'pending')),
  rank integer not null default 1000,
  made_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists store_concepts_feed on store_concepts (status, rank, id);
create table if not exists store_concept_made (
  concept_id bigint not null references store_concepts(id) on delete cascade,
  client_key text not null,
  day date not null default current_date,
  primary key (concept_id, client_key, day)
);
```

- [ ] **Step 2: `store-server/src/concepts.ts`**

```ts
import { normalizeGameConcept, type GameConcept } from "../../src/concepts/format";
import { isSha256 } from "../../src/assetStore/format";
import type { Db } from "./db";
import { HttpError } from "./http";

export const CONCEPT_PAGE = 24;
export type ConceptCard = GameConcept;

function card(row: Record<string, unknown>, lang: string | null): ConceptCard {
  const body = row.body as GameConcept;
  const local = lang ? body.locales?.[lang as "en"] : undefined;
  return { ...body, ...(local ?? {}), thumb: { full: String(row.full_sha), card: String(row.card_sha) }, madeCount: Number(row.made_count) };
}

/** 커서 = "rank:id". 정렬은 rank, id 오름차순. */
export async function listConcepts(db: Db, query: { tag?: string; q?: string; preset?: string; cursor?: string; lang: string | null }): Promise<{ items: ConceptCard[]; nextCursor: string | null }> {
  const where = ["status = 'visible'"];
  const args: unknown[] = [];
  if (query.tag) { args.push(query.tag); where.push(`$${args.length} = any(tags)`); }
  if (query.preset) { args.push(query.preset); where.push(`preset_id = $${args.length}`); }
  const q = query.q?.trim().slice(0, 80);
  if (q) { args.push(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`); where.push(`body::text ilike $${args.length}`); }
  const cursor = /^(\d+):(\d+)$/.exec(query.cursor ?? "");
  if (cursor) { args.push(Number(cursor[1]), Number(cursor[2])); where.push(`(rank, id) > ($${args.length - 1}, $${args.length})`); }
  const { rows } = await db.query(`select * from store_concepts where ${where.join(" and ")} order by rank, id limit ${CONCEPT_PAGE + 1}`, args);
  const page = rows.slice(0, CONCEPT_PAGE);
  const last = page.at(-1);
  return { items: page.map((row) => card(row, query.lang)), nextCursor: rows.length > CONCEPT_PAGE && last ? `${last.rank}:${last.id}` : null };
}

export async function conceptDetail(db: Db, slug: string, lang: string | null): Promise<{ concept: ConceptCard; similar: ConceptCard[] }> {
  const { rows } = await db.query("select * from store_concepts where slug = $1 and status = 'visible'", [slug]);
  if (!rows[0]) throw new HttpError(404, "컨셉을 찾을 수 없습니다.", "not_found");
  const row = rows[0];
  const similar = await db.query(
    `select * from store_concepts where status = 'visible' and id <> $1 and (tags && $2 or preset_id = $3)
     order by (tags && $2)::int desc, rank, id limit 6`, [row.id, row.tags, row.preset_id]);
  return { concept: card(row, lang), similar: similar.rows.map((r) => card(r, lang)) };
}

export async function recordConceptMade(db: Db, slug: string, clientKey: string): Promise<void> {
  const { rows } = await db.query("select id from store_concepts where slug = $1 and status = 'visible'", [slug]);
  if (!rows[0]) throw new HttpError(404, "컨셉을 찾을 수 없습니다.", "not_found");
  const inserted = await db.query("insert into store_concept_made (concept_id, client_key) values ($1, $2) on conflict do nothing", [rows[0].id, clientKey]);
  if (inserted.rowCount) await db.query("update store_concepts set made_count = made_count + 1 where id = $1", [rows[0].id]);
}

export async function publishConcept(db: Db, input: unknown, authorId: number | null): Promise<{ slug: string }> {
  const raw = (input && typeof input === "object" ? input : {}) as { concept?: unknown; rank?: unknown };
  const concept = normalizeGameConcept(raw.concept);
  if (!isSha256(concept.thumb.full) || !isSha256(concept.thumb.card)) throw new HttpError(400, "썸네일은 올린 파일의 sha256 이어야 합니다.", "bad_thumb");
  const have = await db.query("select sha256 from store_blobs where sha256 = any($1)", [[concept.thumb.full, concept.thumb.card]]);
  if (have.rows.length < (concept.thumb.full === concept.thumb.card ? 1 : 2)) throw new HttpError(400, "썸네일 파일을 먼저 올려 주세요.", "missing_blob");
  const rank = typeof raw.rank === "number" && Number.isFinite(raw.rank) ? Math.floor(raw.rank) : 1000;
  const { thumb, madeCount: _made, ...body } = concept;
  await db.query(
    `insert into store_concepts (slug, author_id, body, tags, preset_id, full_sha, card_sha, rank)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (slug) do update set body = excluded.body, tags = excluded.tags, preset_id = excluded.preset_id,
       full_sha = excluded.full_sha, card_sha = excluded.card_sha, rank = excluded.rank, updated_at = now()`,
    [concept.slug, authorId, JSON.stringify({ ...body, thumb }), concept.tags, concept.presetId, thumb.full, thumb.card, rank]);
  return { slug: concept.slug };
}
```

주의: `blobServable`(items.ts)는 「내려지지 않은 상품이 쓰는 파일」만 내준다. 컨셉 썸네일도 내줄 수 있게 그 함수의 판정에 `or exists (select 1 from store_concepts c where c.status = 'visible' and (c.full_sha = $1 or c.card_sha = $1))` 를 더한다. `sweepOrphanBlobs` 도 컨셉이 쓰는 blob 을 고아로 지우지 않게 같은 조건을 더한다.

- [ ] **Step 3: 라우트** — `store-server/src/app.ts` 의 `/api/v1/items` 묶음 옆에

```ts
  router.get("/api/v1/concepts", async (ctx) => {
    const p = ctx.url.searchParams;
    sendJson(ctx.res, 200, await listConcepts(db, { tag: p.get("tag") ?? undefined, q: p.get("q") ?? undefined, preset: p.get("preset") ?? undefined, cursor: p.get("cursor") ?? undefined, lang: apiLang(ctx) }));
  });
  router.get("/api/v1/concepts/:slug", async (ctx) => {
    sendJson(ctx.res, 200, await conceptDetail(db, ctx.params.slug!, apiLang(ctx)));
  });
  router.post("/api/v1/concepts/:slug/made", async (ctx) => {
    limit(limits.download, ctx);
    await recordConceptMade(db, ctx.params.slug!, clientKey(ctx, await viewer(ctx)));
    ctx.res.writeHead(204).end();
  });
  router.post("/api/v1/admin/concepts", async (ctx) => {
    const auth = await authenticate(db, ctx);
    requireAdmin(auth);
    sendJson(ctx.res, 200, await publishConcept(db, await readJson(ctx.req), null));
  });
```

(`ctx.params`·`sendJson`·`readJson` 이름은 기존 `/api/v1/items/:slug` 핸들러와 똑같이 맞춘다 — 다르면 그 핸들러의 형태를 따른다.)

- [ ] **Step 4: 테스트** — `store-server/test/concepts.test.ts` (기존 `store.test.ts` 의 `startPostgres`·`createApp`·운영자 로그인 준비를 그대로 복사)

검사 항목:
1. 운영자가 blob 2개 올리고 컨셉 30개 게시 → `GET /api/v1/concepts` 24개 + `nextCursor`, 다음 쪽 6개 + `null`, 두 쪽의 slug 겹침 없음.
2. `?tag=패러디` 는 그 분류만, `?q=조선` 은 본문 검색.
3. `GET /api/v1/concepts/:slug` 의 `similar` 는 자신을 빼고 ≤6.
4. `POST …/made` 두 번 → `madeCount` 1.
5. 운영자 아님 → `POST /api/v1/admin/concepts` 403. blob 없는 sha → 400 `missing_blob`.
6. 컨셉 썸네일 sha 로 `GET /api/v1/blobs/:sha` 200.

- [ ] **Step 5: 타입 검사** — `node store-server/scripts/typecheck.mjs` (이 패키지 파일 오류만). 통합 테스트 실행은 사용자 요청 시.

- [ ] **Step 6: 커밋** `feat(store-server): 컨셉 피드 표·목록·상세·만든 수·운영자 게시`

---

### Task 3: Electron 중계

**Files:**
- Modify: `electron/shared/channels.ts`, `electron/shared/schemas.ts`, `electron/main/assetStoreClient.ts`, `electron/main/assetStore.ts`, `electron/preload/index.ts`, `src/assetStore/bridgeTypes.ts`
- Test: `test/assetStoreClient.test.ts` (기존 파일에 3건 추가)

**Interfaces:**
- Produces on `window.oprn.store`:
  - `concepts(input: { tag?: string; q?: string; preset?: string; cursor?: string; lang?: StoreLocale }): Promise<{ items: GameConcept[]; nextCursor: string | null }>`
  - `concept(input: { slug: string; lang?: StoreLocale }): Promise<{ concept: GameConcept; similar: GameConcept[] }>`
  - `conceptMade(input: { slug: string }): Promise<boolean>`
  - 썸네일은 기존 `blob({ sha256 })`.

- [ ] **Step 1:** channels 에 `storeConcepts: "oprn:store.concepts"`, `storeConcept: "oprn:store.concept"`, `storeConceptMade: "oprn:store.conceptMade"`.
- [ ] **Step 2:** schemas 에

```ts
export const storeConceptsSchema = z.object({
  tag: z.string().max(40).optional(), q: z.string().max(80).optional(), preset: z.string().max(40).optional(),
  cursor: z.string().regex(/^\d+:\d+$/).optional(), lang: z.enum(["en", "ja", "zh", "ko"]).optional(),
}).strict();
export const storeConceptSlugSchema = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), lang: z.enum(["en", "ja", "zh", "ko"]).optional() }).strict();
```

- [ ] **Step 3:** `assetStoreClient.ts` 의 클라이언트에 `catalog()` 와 같은 방식(`this.getJson(path)`)으로

```ts
  async concepts(input: { tag?: string; q?: string; preset?: string; cursor?: string; lang?: string }): Promise<{ items: GameConcept[]; nextCursor: string | null }> {
    const params = new URLSearchParams(Object.entries(input).filter(([, v]) => v) as [string, string][]);
    const body = await this.getJson(`/api/v1/concepts?${params}`) as { items: unknown[]; nextCursor: unknown };
    return { items: body.items.map((item) => normalizeGameConcept(item)), nextCursor: typeof body.nextCursor === "string" ? body.nextCursor : null };
  }
  async concept(input: { slug: string; lang?: string }) { … 같은 방식, similar 도 normalize }
  async conceptMade(input: { slug: string }): Promise<boolean> { try { await this.post(`/api/v1/concepts/${input.slug}/made`, {}); return true; } catch { return false; } }
```

(`getJson`·`post` 는 그 파일에 이미 있는 이름을 쓴다. 서버 응답은 **반드시** `normalizeGameConcept` 를 거친다.)

- [ ] **Step 4:** `assetStore.ts` 에 `ipcMain.handle` 3개(`wrap(() => storeClient().concepts(storeConceptsSchema.parse(payload ?? {})))` 등), preload `store` 에 `concepts`·`concept`·`conceptMade`, `OprnStoreBridge` 에 시그니처.
- [ ] **Step 5:** `test/assetStoreClient.test.ts` 에 가짜 fetch 로 (a) 쪽 응답 normalize, (b) 잘못된 컨셉(모르는 presetId)은 throw, (c) made 실패는 false.
- [ ] **Step 6: 커밋** `feat(electron): 스토어 컨셉 중계 채널`

---

### Task 4: 공식 컨셉 하네스 `game-concepts`

**Files:**
- Create: `src/harnesses/game-concepts/harness.ts`, `src/harnesses/game-concepts/node/cli.ts`, `node/produce.ts`, `node/draw.ts`, `node/check.ts`, `node/serve.ts`, `node/publish.ts`, `node/bundle.ts`, `node/data.ts`, `src/harnesses/game-concepts/web/index.html`, `harness-data/game-concepts/seed.json`, `openwiki/harnesses/game-concepts.md`
- Modify: `src/harnesses/_core/registry.ts`, `AGENTS.md`(하네스 절 한 줄), `openwiki/harnesses/README.md`(목록 한 줄)

**Interfaces:**
- Consumes: `normalizeGameConcept`, `conceptSlug`, `conceptArtPrompt`, `conceptForbiddenNameHits`, `CONCEPT_TAGS` (Task 1)
- Produces: 데이터 폴더 `GC_HARNESS_DATA`(기본 `~/oprn-harness-data/game-concepts`)
  - `candidates/<slug>.json` — `GameConcept`(thumb 은 로컬 파일 이름)
  - `images/<slug>.full.webp`, `images/<slug>.card.webp`
  - `checks/<slug>.json` — `{ imageSha: string; ok: boolean; findings: string[] }`
  - `decisions.json` — `{ [slug]: { verdict: "accept"|"reject"; imageSha: string; at: string } }` (사람만 쓴다, 서버가 저장)
  - `published.json` — `{ [target]: { [slug]: imageSha } }`

- [ ] **Step 1: 시드** `harness-data/game-concepts/seed.json`

```json
{
  "version": 1,
  "targets": { "웹소설": 50, "패러디": 40, "퓨전 사극": 20, "정통 JRPG": 35, "몬스터 수집": 30, "추리": 25, "연애": 25, "호러": 25, "힐링": 15, "농장": 10, "액션": 15, "SF": 10, "학원": 15, "코미디": 15 },
  "examples": ["몸이 뒤바뀐 악역영애", "TS 금발 라이벌 도련님", "마법사 in 조선", "내가 쓰는 판타지 소설", "파이널 판타지아 999", "정통 JRPG: 별의 검", "몬스터 수집: 첫 파트너", "추리: 폭풍의 저택"],
  "presetGuide": {
    "story-cutscene": "대화·조사·선택 중심(웹소설·연애·추리·회상)",
    "adventure-jrpg": "마을·필드·던전·턴제 전투",
    "monster-collect": "몬스터 만나기·포획·육성·체육관",
    "horror-gallery": "퍼즐·탐색 호러",
    "school-horror": "학교 배경 추격 호러",
    "farm-life": "농사·마을 생활",
    "partner-raise": "파트너 한 마리 육성",
    "action-rpg": "실시간 액션 전투"
  },
  "tilesetHints": { "조선": "joseon_baram", "마법 학교": "wizarding_world", "일본 도시": "jp_city", "항구 도시": "beodeul_city" },
  "rules": [
    "원작 이름 금지. 패러디는 누가 봐도 알아보는 다른 이름(예: TS 금발 라이벌 도련님, 파이널 판타지아 999).",
    "제목 ≤40자, 훅 ≤120자 한 문장, 설명 ≤600자.",
    "brief 5칸은 조수가 바로 지을 수 있는 구체 문장. scope 는 한 맵~세 맵 안에서 끝나는 첫 구간."
  ]
}
```

- [ ] **Step 2: 매니페스트** `harness.ts`

```ts
import { defineHarness } from "../_core/manifest";

export const GAME_CONCEPTS_HARNESS = defineHarness({
  id: "game-concepts",
  title: "새 게임 컨셉 카드",
  summary: "새 게임 피드의 공식 컨셉(제목·훅·기획 5칸·도트 썸네일)을 만들고 사람이 받기/버리기로 고른 것만 스토어에 게시",
  scope: {},
  triggers: ["새 게임 컨셉", "컨셉 피드", "새 게임 썸네일", "공식 컨셉 추가"],
  seed: "harness-data/game-concepts/seed.json",
  doc: "openwiki/harnesses/game-concepts.md",
  stages: [
    { id: "produce", title: "컨셉 쓰기", summary: "시드의 분류별 목표 수만큼 AI가 컨셉 JSON 을 쓴다. 형식·금지 이름·중복을 거른다." },
    { id: "draw", title: "썸네일", summary: "컨셉마다 도트 썸네일(960×540, 480×270 webp)을 생성한다." },
    { id: "check", title: "검사", summary: "형식 + 원작 닮음(금지 이름, 그림 비전 판정). 실패는 한 번 다시 그린다." },
    { id: "serve", title: "고르기 화면", summary: "사람이 받기/버리기. 선택은 현재 그림 해시에 묶인다." },
    { id: "status", title: "현황", summary: "분류별 받음·버림·대기·검사 실패 수." },
    { id: "publish", title: "게시", summary: "받은 것만 스토어에 올린다. 운영은 --target prod 명시." },
    { id: "bundle", title: "비상용 번들", summary: "받은 것 중 분류마다 고르게 20개를 앱 번들로 굽는다." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
```

레지스트리 `HARNESSES` 끝에 `GAME_CONCEPTS_HARNESS` 를 더한다.

- [ ] **Step 3: `node/data.ts`** — 데이터 폴더 경로, 읽기/쓰기 도우미, `sha256File(path)`, `readDecisions()`, `writeDecision(slug, verdict, imageSha)`(원자적 쓰기: 임시 파일 → rename).

- [ ] **Step 4: `node/produce.ts`** — 분류마다 부족한 수 = target − (후보 중 그 분류가 첫 태그인 수). 20개씩 묶어 `claude -p --output-format text` 를 병렬 4개로 부른다. 프롬프트: 시드 rules + presetGuide + 이미 있는 제목 목록(중복 방지) + JSON 배열만 출력 지시 + 각 항목 필드(slug 제외). 응답에서 첫 `[` ~ 마지막 `]` 를 파싱 → 각 항목에 `slug = conceptSlug(title)`, `thumb = { full: slug+".full.webp", card: slug+".card.webp" }`, `source: "official"`, `aiGenerated: true` 를 붙여 `normalizeGameConcept`. 실패·금지 이름·같은 제목은 버리고 `produce.log` 에 사유를 남긴다.

- [ ] **Step 5: `node/draw.ts`** — 이미지가 없는 후보마다 `POST {--image-endpoint, 기본 http://mdc-server:9888/v1/images/generations}` (`X-Oprn-Provider: openai-codex`, `model: codex-image-default`, `prompt: conceptArtPrompt(c)`), 병렬 4. 응답 dataUrl → PNG → `sharp` 없이 `npx` 의존을 늘리지 않기 위해 ImageMagick `convert` 로 `-resize 960x540^ -gravity center -extent 960x540 -quality 82` / `480x270` webp. 실패는 `draw.log`.

- [ ] **Step 6: `node/check.ts`** — 각 후보: `normalizeGameConcept` 재검사, `conceptForbiddenNameHits(title+hook+description+protagonist+stage)`, 그림 비전 판정은 `claude -p "Read <full.webp>… JSON {ok, findings}"`(원작 고유 의상·문장·로고·글자·도트 아님). 결과 `checks/<slug>.json` 에 현재 이미지 sha 와 함께. `--redraw` 면 실패 그림을 지우고 draw 를 한 번 더.

- [ ] **Step 7: `node/serve.ts` + `web/index.html`** — 포트 18321(`--port`). `GET /api/state` → 후보(검사 결과·현재 sha·판정 포함), `GET /img/:file`, `POST /api/decide { slug, verdict, imageSha }` → 현재 이미지 sha 와 다르면 409. 화면: 분류 필터, 카드(썸네일·제목·훅·틀·검사 경고), 받기(A)/버리기(D) 키, 진행률. 감독은 이 화면을 대신 누르지 않는다.

- [ ] **Step 8: `node/publish.ts`** — `--target staging`(기본 `http://mdc-server:18320`) | `prod`(`https://store.openrpgmaker.com`, 명시 필요). 토큰은 `OPRN_STORE_TOKEN` 환경 변수(운영자 Bearer). 받은 것 중 판정 sha == 현재 sha 인 것만: 두 그림을 `POST /api/v1/blobs` → `POST /api/v1/admin/concepts { concept(thumb=sha 둘), rank }`. rank 는 분류 순환(분류마다 하나씩 번갈아)으로 매겨 첫 쪽이 다양하게 보이게 한다. `published.json` 갱신.

- [ ] **Step 9: `node/bundle.ts`** — 받은 것 중 분류 순환으로 20개 → `public/assets/concepts/<slug>.card.webp`·`<slug>.full.webp` 복사, `src/assets/bundledConcepts.json` = `{ format: "oprn-concept/1", concepts: GameConcept[] }`(thumb 은 `/assets/concepts/…` 경로).

- [ ] **Step 10: `node/cli.ts`** — `run(argv)` 가 단계 이름으로 위 모듈을 부르고, 모르는 단계면 사용법을 던진다.

- [ ] **Step 11: 문서·목록** — `openwiki/harnesses/game-concepts.md`(단계 표, 데이터 폴더, 사람 선택 규칙, 운영 게시 스위치), `npm run harness -- list` 로 INDEX·catalog 재생성, AGENTS.md 하네스 절에 한 줄:
  `- **새 게임 피드의 공식 컨셉 카드를 만들거나 추가할 때** → game-concepts · 시드 harness-data/game-concepts/seed.json · npm run harness -- game-concepts produce|draw|check|serve|status|publish|bundle · 문서 openwiki/harnesses/game-concepts.md. 사람이 받은 것만 게시한다.`

- [ ] **Step 12: 노드 타입 검사** `npx tsc -p src/harnesses/tsconfig.node.json --noEmit` 후 커밋 `feat(harness): game-concepts 공식 컨셉 하네스`

---

### Task 5: 화면용 컨셉 출처(스토어 + 번들 대체)

**Files:**
- Create: `src/concepts/source.ts`, `src/assets/bundledConcepts.json`(Task 4 bundle 전까지는 시안 8개로 채운 임시본 — 아래 Step 1), `public/assets/concepts/`
- Test: `test/conceptSource.test.ts`

**Interfaces:**
- Produces:

```ts
export type ConceptQuery = { tag?: string; q?: string };
export type ConceptPage = { items: GameConcept[]; nextCursor: string | null; offline: boolean };
export interface ConceptSource {
  page(query: ConceptQuery, cursor: string | null): Promise<ConceptPage>;
  detail(slug: string): Promise<{ concept: GameConcept; similar: GameConcept[] } | null>;
  thumbUrl(concept: GameConcept, size: "full" | "card"): Promise<string>;
  made(slug: string): void;
}
export function createConceptSource(deps?: { bridge?: OprnStoreBridge | null; timeoutMs?: number; locale?: string }): ConceptSource;
export function bundledConcepts(): readonly GameConcept[];
export const CONCEPT_FALLBACK_THUMB: Record<GamePresetId, string>;
```

- [ ] **Step 1: 임시 번들** — 지금 시안 8개(`~/claude-viz/concept-thumbs/*-A.webp`)를 `public/assets/concepts/<slug>.card.webp`(480×270)·`.full.webp`(960×540)로, 컨셉 본문은 시안 HTML 의 8개를 형식에 맞춰 brief 5칸까지 써서 `src/assets/bundledConcepts.json` 에 넣는다. Task 4 `bundle` 이 나중에 20개로 덮어쓴다. TS 금발 라이벌 도련님 썸네일은 초록·은색 교복이라 **넣지 않는다**(원작 색) — 7개로 시작.
- [ ] **Step 2: 테스트** — 가짜 bridge 로 (a) 브리지 없음 → 번들, `offline: true`, `tag` 필터 적용; (b) bridge.concepts 가 `timeoutMs` 넘게 걸림 → 번들 + offline; (c) 정상 → 스토어 결과, `offline: false`; (d) `thumbUrl` 은 번들이면 경로 그대로, 스토어면 `blob()` 바이트 → `URL.createObjectURL`(테스트에서는 주입한 `toUrl`), 같은 sha 는 한 번만 받는다; (e) blob 실패 → `CONCEPT_FALLBACK_THUMB[presetId]`.
- [ ] **Step 3: 구현** — 번들 검색은 `q` 를 제목·훅·설명·태그에 소문자 포함으로. 스토어 실패는 한 번 실패하면 그 세션 동안 `offline` 로 붙들지 않고 다음 쪽 요청마다 다시 시도한다. 기본 timeout 3000ms. `CONCEPT_FALLBACK_THUMB` 은 기존 `NEW_PROJECT_CHOICES[*].thumb` 를 presetId 로 찾는다.
- [ ] **Step 4: 커밋** `feat(concepts): 피드용 컨셉 출처 — 스토어 쪽 읽기와 번들 대체`

---

### Task 6: 피드·상세 화면 컴포넌트

**Files:**
- Create: `src/start/conceptFeed/conceptFeed.ts`, `src/start/conceptFeed/conceptFeed.css`
- Test: `test/conceptFeed.test.ts` (happy-dom; 기존 DOM 테스트 설정을 따른다)

**Interfaces:**
- Consumes: `ConceptSource`(Task 5), `localizedConcept`, `CONCEPT_TAGS`, `CONCEPT_TWEAK_LIMIT`(Task 1), `draftConceptFromText`(Task 7, 지연 import)
- Produces:

```ts
export type ConceptFeedMode = "launcher" | "overlay";
export type ConceptFeedOptions = {
  mode: ConceptFeedMode;
  source: ConceptSource;
  /** 만들기. 성공하면 true(이후 화면은 호출부가 넘긴다), 취소면 false. 던지면 오류 줄에 보인다. */
  onMake: (concept: GameConcept, tweak: string) => Promise<boolean>;
  onBlank?: () => void;
  onClose?: () => void;          // overlay 만
  continueRow?: HTMLElement;     // launcher 만 — 이어하기 줄
  topActions?: HTMLElement[];    // launcher 만 — 폴더 열기·팀 참여
};
export type ConceptFeed = { element: HTMLElement; dispose(): void };
export function createConceptFeed(options: ConceptFeedOptions): ConceptFeed;
export const CONCEPT_FEED_TESTIDS = {
  root: "concept-feed", search: "concept-feed-search", chip: "concept-feed-chip", card: "concept-feed-card",
  custom: "concept-feed-custom", detail: "concept-detail", make: "concept-detail-make", tweak: "concept-detail-tweak",
  back: "concept-detail-back", similar: "concept-detail-similar", blank: "concept-feed-blank", offline: "concept-feed-offline",
  close: "concept-feed-close", error: "concept-feed-error",
} as const;
```

동작 계약:
- 첫 쪽을 받는 동안 회색 카드 12장(뼈대). `offline` 이면 격자 아래 「인터넷에 연결하면 더 많은 컨셉을 볼 수 있어요」.
- `IntersectionObserver` 로 마지막 카드가 보이면 `nextCursor` 쪽을 붙인다. 요청마다 순번을 올리고, 응답 순번이 현재와 다르면 버린다(칩·검색 바뀜).
- 검색 입력은 250ms 디바운스. 입력이 있으면 격자 맨 앞에 「✏️ "…" 로 만들기」 카드(`custom`).
- 카드 클릭·Enter → 상세(같은 루트 안에서 바꿈, 스크롤 위치 기억, 「← 피드로」 로 복귀). Esc: 상세면 피드로, 피드 overlay 면 `onClose`.
- 상세의 「▶ 이 게임 만들기」 → 버튼 잠금 + 「만드는 중…」, `onMake(concept, tweak)`. false 면 잠금 해제, 던지면 오류 줄. 성공(true)이면 잠금 유지.
- 「살짝 바꾸기」 textarea `maxlength=300`.
- 썸네일 `<img loading="lazy">`, 실패 시 `CONCEPT_FALLBACK_THUMB`.
- 시안(`~/claude-viz/concept-feed.html`)의 시각 구조를 따른다: 어두운 바탕, 16:9 둥근 썸네일, 제목 굵게, 훅 회색, 틀 배지 오른쪽 아래.

- [ ] **Step 1: 테스트** — 가짜 source(쪽 2개)로: 첫 렌더 카드 24장; 관찰자 콜백 수동 호출 → 30장; 칩 클릭 후 늦게 온 이전 쪽 응답이 섞이지 않음; 카드 클릭 → 상세 testid; tweak 400자 입력 → onMake 에 300자; 만들기 두 번 클릭 → onMake 1회; 검색 입력 → custom 카드 첫 자리.
- [ ] **Step 2: 구현** (`el()` 헬퍼, `t()` 는 쓰지 않고 한국어 원문 — DOM 번역 계층이 옮긴다. 입력 placeholder 는 `t()` 로 직접 번역).
- [ ] **Step 3: CSS** — 접두 `cf-`. 런처는 화면 전체, overlay 는 `position: fixed; inset: 0; z-index` 를 기존 모달 층(`--z-modal` 류 토큰이 있으면 그것)으로.
- [ ] **Step 4: 커밋** `feat(start): 유튜브식 컨셉 피드·상세 화면`

---

### Task 7: 「내가 쓴 걸로 만들기」 초안

**Files:**
- Create: `src/concepts/draft.ts`
- Test: `test/conceptDraft.test.ts`

**Interfaces:**
- Produces:

```ts
export async function draftConceptFromText(text: string, deps?: {
  complete?: (prompt: string, signal: AbortSignal) => Promise<string>;
  signal?: AbortSignal;
}): Promise<GameConcept>;   // thumb 은 CONCEPT_FALLBACK_THUMB[presetId] 로 시작
export async function drawConceptThumb(concept: GameConcept, deps?: { generate?: (prompt: string, signal: AbortSignal) => Promise<string>; signal?: AbortSignal }): Promise<string | null>; // dataURL, 실패 null
```

- 기본 `complete` = `chatCompletion(configForRole(<인터뷰 요약에 쓰는 역할과 같은 것>), …)`, 기본 `generate` = `generateAiImage({ prompt: conceptArtPrompt(c) }).dataUrl`.
- 프롬프트: 사용자 문장(데이터로 인용) + Task 4 시드 rules·presetGuide 와 같은 문장 + JSON 한 개만 출력. 파싱 실패·`normalizeGameConcept` 실패는 1회 재시도 후 `Error("컨셉을 만들지 못했습니다. 문장을 조금 바꿔 다시 시도해 주세요.")`.
- 금지 이름이 나오면 그 낱말을 지운 문장으로 1회 재요청.
- slug = `conceptSlug(title, Date.now().toString(36))`, `source: "user"`.

- [ ] **Step 1: 테스트** — 가짜 complete 로 정상 JSON(코드 펜스 포함) → 컨셉; 잘못된 presetId 후 정상 → 성공(재시도); 두 번 다 실패 → throw; 금지 이름 포함 응답 → 재요청에 금지 이름이 빠짐.
- [ ] **Step 2: 구현**, 피드의 custom 카드 클릭이 `draftConceptFromText` → 상세 열기(썸네일은 뒤에서 `drawConceptThumb`, 오면 큰 그림 교체).
- [ ] **Step 3: 커밋** `feat(concepts): 입력 문장으로 컨셉 초안과 썸네일`

---

### Task 8: 만들기 처리기 3종

**Files:**
- Create: `src/start/conceptFeed/makeGame.ts`
- Test: `test/conceptMakeGame.test.ts`

**Interfaces:**
- Consumes: `conceptBrief`(Task 1), `writeStartScreenIntent`(기존), `createProjectStartSeed`(기존), `createProjectFolderWithSeed`(기존), `newProjectChoiceById`, `createNewProjectSeed`, `ensureAiConnectedForPreset`(지연 import)
- Produces:

```ts
export type MakeDeps = { ensureAiConnected(label: string): Promise<boolean>; made(slug: string): void };
/** 런처: 폴더 만들고 인계 쓰고 편집기로. */
export function launcherMakeHandler(bridge: OprnBridgeStart, deps: MakeDeps & { goEditor(): void; storage: Storage }): (concept: GameConcept, tweak: string) => Promise<boolean>;
/** 편집기 메뉴: 새 폴더에 씨앗+기획 → 다시 읽기. */
export function menuMakeHandler(deps: MakeDeps & { reload(): void }): (concept: GameConcept, tweak: string) => Promise<boolean>;
/** 환영 화면: 지금 열린 빈 프로젝트에 적용. 적용 뒤 prepareProjectInterviewStartup 은 mode.ts 가 부른다. */
export function welcomeMakeHandler(deps: MakeDeps): (concept: GameConcept, tweak: string) => Promise<boolean>;
```

- 셋 다: 먼저 `ensureAiConnected(choice.label)` → false 면 false. 그다음 `brief = { ...conceptBrief(concept, tweak), generationPending: true }`.
- 런처: `dir = (await bridge.suggestProjectDir?.({ title }))?.projectDir` → `bridge.createProject({ title, projectDir: dir })` → `writeStartScreenIntent(storage, { projectDir, title, choiceId: concept.presetId, intent: "", startMode: "ai", screenSize: "wide", gameDesignBrief: brief })` → `made(slug)` → `goEditor()` → true. (`startScreenHandoff.applyStartScreenHandoff` 가 brief 를 검증해 심고, `brief.presetId === intent.choiceId` 를 이미 확인한다.)
- 메뉴: `seed = await createProjectStartSeed(presetId, title, "ai", "wide")`; `seed.gameDesignBrief = brief`; 저장 안 된 변경이 있으면 기존 `saveProjectNow()`; `createProjectFolderWithSeed(title, seed)` false → `Error("프로젝트 저장 서버에 연결하거나 데스크톱 앱에서 열어 주세요.")`; true → `made` → `reload()`.
- 환영: `store.update(project => { project.system = createNewProjectSeed(packId, project.meta.title).system(playResolution 보존); project.meta.title = title; project.gameDesignBrief = brief; })` → `made` → true.

- [ ] **Step 1: 테스트** — 런처: 가짜 bridge 로 intent 저장 내용(choiceId=presetId, gameDesignBrief.concept.slug) 확인, AI 거절이면 createProject 호출 0회. 메뉴: createProjectFolderWithSeed 주입(모듈 mock) false → throw. 환영: store 갱신 뒤 `gameDesignBrief.generationPending === true`, `system.genre === packId`.
- [ ] **Step 2: 구현**
- [ ] **Step 3: 커밋** `feat(start): 컨셉 만들기 — 런처·메뉴·환영 처리기`

---

### Task 9: 입구 연결

**Files:**
- Modify: `src/start/startScreen.ts`, `src/start/startScreen.css`, `src/editor/panels/menu.ts`, `src/app/mode.ts`
- Create: `src/editor/conceptFeedOverlay.ts`
- Test: `test/startScreen.test.ts` (기존 테스트를 새 화면 계약으로 고친다)

**Interfaces:**
- Produces: `openConceptFeedOverlay(mode: "menu" | "welcome"): Promise<"made" | "closed" | "blank">`

- [ ] **Step 1: 런처** — `startScreen.ts`
  - 레일을 위 막대(`start-topbar`)로 바꾼다: 로고, 「폴더 열기」, 「팀에 참여」, 언어, 버전. 「새 게임 만들기」 버튼·홈/새 게임 nav 는 지운다.
  - `view: "home" | "join"` 두 개만. home = `createConceptFeed({ mode: "launcher", source: createConceptSource({ bridge: window.oprn?.store }), onMake: launcherMakeHandler(...), onBlank, continueRow, topActions })`.
  - `continueRow` = 최근 프로젝트 가로 줄(기존 `coverArt`·`entryMeta`·`openEntry`·`refreshCovers`·숨김 토글 재사용, 최대 11장).
  - `onBlank` = 기존 blank 경로(`createProject` + intent `startMode: "blank"`), 제목 `새 게임`.
  - 지우는 상태·함수: `choiceId/startMode/screenSize/intent/root/confirmedBrief`, `renderStartChoices`, `renderAiArrival`, `renderNew`, `chooseRoot`, `refreshLocation`(blank 경로가 `suggestProjectDir` 를 직접 부른다).
  - `START_SCREEN_TESTIDS` 는 남는 것만 유지하고 `feed` 를 더한다.
- [ ] **Step 2: 편집기 창** — `src/editor/conceptFeedOverlay.ts`: `document.body` 에 overlay 피드를 붙이고 Promise 로 결과를 돌려준다. menu 모드 onMake = `menuMakeHandler`, welcome 모드 = `welcomeMakeHandler`. onBlank: menu 는 기존 빈 프로젝트 생성(`createProjectStartSeed(null, "새 프로젝트")` + `createProjectFolderWithSeed`), welcome 은 창만 닫고 `"blank"`.
- [ ] **Step 3: 메뉴** — `menu.ts` `createProjectFromDialog()` 본문을 `await openConceptFeedOverlay("menu")` 로 바꾼다(`newProject()` 잠금은 그대로).
- [ ] **Step 4: 환영** — `mode.ts` 의 `if (showBriefing && elements) { … presentEditorWelcome … }` 블록을:

```ts
  if (showBriefing && elements) {
    const { openConceptFeedOverlay } = await import("@/editor/conceptFeedOverlay");
    const outcome = openConceptFeedOverlay("welcome");
    dismissBootLoader();
    const result = await outcome;
    if (result !== "made") setEditorWelcomeDismissed(true);
    else clearWelcomeIntentBootFlags();
  }
```

  로 바꾸고, `welcomeModules` 사전 로드를 `import("@/editor/conceptFeedOverlay")` 하나로 줄인다. 바로 아래의 `generationPending → prepareProjectInterviewStartup` 가 welcome 적용분을 이어받는다. `startHandoff?.presetId` 인터뷰 분기는 지운다(런처가 더 이상 presetId-only 인계를 쓰지 않는다 — 옛 인계 값은 `gameDesignBrief` 없이 `startMode: "ai"` 면 한 문장만 조수에 넘기는 기존 `prompt` 경로로 남는다).
- [ ] **Step 5: 테스트 고치기** — `test/startScreen.test.ts` 는 피드 루트·이어하기 줄·폴더 열기·팀 참여·빈 프로젝트 링크 계약으로 다시 쓴다. `test/startScreenPresetInterview.test.ts` 는 `runStartScreenPresetInterview` 를 지우므로 함께 지운다.
- [ ] **Step 6: 커밋** `feat(start): 새 게임·새 프로젝트·환영 화면을 컨셉 피드 하나로`

---

### Task 10: 옛 화면 지우기

**Files:**
- Delete: `src/start/startLobby.ts`, `src/start/startInterview.ts`, `src/start/firstWorldArrival.ts`, `src/styles/shell/first-world-arrival.css`, `src/editor/ui/newProjectDialog.ts`, `src/editor/editorWelcome.ts`(+ 그 CSS), `public/assets/project-interview/world-motion.mp4`, `world-poster.webp`, 테스트 `test/newProjectDialog.test.ts`, `test/editorWelcome.test.ts`, `test/editorWelcomeCss.test.ts`, `test/startScreenPresetInterview.test.ts`
- Modify: 남은 참조(`test/actionGenreAuthoring.test.ts`, `test/modalEscapeLayerGate.quarantine.test.ts`, `test/studioBarActions.test.ts`, `test/modeTransitions.test.ts`, `test/uxcLoadFailure.test.ts`, `test/editorWelcomeBootGate.test.ts`, `test/koreanWordBreakCss.test.ts`, `test/systemShell.test.ts`)
- Keep: `projectInterviewDialog.ts`(메뉴 「게임 기획」 수정용), `newProjectChoices.ts`, `welcomeGenrePresets.ts`, `shouldPresentEditorWelcome`·`setEditorWelcomeDismissed`(키 유지 — 다른 파일에 있으면 그대로, `editorWelcome.ts` 안에 있으면 `src/editor/editorWelcomeGate.ts` 로 옮긴다)

- [ ] **Step 1:** 각 파일을 지우기 전 `grep -rn "<모듈명>" src test electron scripts` 로 남은 참조를 확인하고, 참조를 새 경로로 바꾸거나 그 테스트 단언을 지운다. `projectInterviewDialog.ts` 의 새 게임 전용 진입(`interviewBeforeProject` 류)이 다른 데서 안 쓰이면 지운다.
- [ ] **Step 2:** `public/assets/project-interview/` 의 다른 그림(인터뷰 장면 그림)은 `projectInterviewDialog`(기획 수정)가 계속 쓰면 남긴다. 영상·포스터만 지운다.
- [ ] **Step 3:** `npm run typecheck:app` 1회(앱 범위 타입 검사)로 지운 참조가 남지 않았는지 확인.
- [ ] **Step 4: 커밋** `refactor(start): 인터뷰·첫 세계·로비·새 프로젝트 모달·환영 포스터 제거`

---

### Task 11: 다국어·문서·화면 증거·PR

- [ ] **Step 1: 다국어** — `node scripts/i18n/extract-ui-strings.mjs --missing en` (ja, zh 도) → 새 문구를 세 카탈로그에 넣는다(`docs/terminology/product-terminology.md` 정본 용어).
- [ ] **Step 2: 문서**
  - `openwiki/runtime-project-schema.md` 데스크톱 시작 화면 절 → 컨셉 피드.
  - `openwiki/editor-genre-packs.md` 「예시로 시작·인터뷰 답 적용」 절 → 컨셉 → 기획 변환.
  - `openwiki/editor-ai-panel.md` 새 프로젝트 기획 전달 절 → `gameDesignBrief.concept`.
  - `openwiki/asset-store.md` 에 「컨셉 피드」 절(표·API·중계 채널).
  - `openwiki/runtime-project-schema.md` 에 `gameDesignBrief.concept` 필드.
- [ ] **Step 3: 화면 증거** `verify-shots/concept-feed/`
  - 로컬 스토어(`store-server/scripts/dev-unit.sh start 18391`)에 컨셉 30개(하네스 publish `--target http://127.0.0.1:18391`)를 올린다.
  - Electron 앱(`OPRN_STORE_URL=http://127.0.0.1:18391`)을 Playwright Electron 으로 띄워: 런처 피드, 스크롤 후 2쪽, 상세, 만들기 → 편집기 + 조수 첫 생성 행, 메뉴 「새 프로젝트」 창, 스토어 꺼짐 → 비상용 + 안내.
  - 만들기로 생긴 폴더의 `project.sqlite` 를 다시 열어 `gameDesignBrief.concept.slug` 확인(정본 저장·재로드 근거).
- [ ] **Step 4: PR** — `gh pr create`(본문: 무엇이 바뀌었나, 화면 증거 경로, 실행하지 않은 테스트 목록), `link_pull_request`.
