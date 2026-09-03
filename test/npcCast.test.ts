// 캐스트 라이터 순수 모듈 — 코드는 NPC 대사를 한 줄도 만들지 않는다.
//
// 배경(2026-09-03 사용자 지적): 마을을 생성할 때마다 주민 대사가 비슷했다. 원인은 생성 코드에 박힌
// 고정 대사(DEFAULT_NPCS 10명 · "안녕하세요." · "일하는 중이야." · "${name}입니다.")였다.
// 대사는 테마에 맞아야 하고, 주민끼리 서로를 언급해야 하고, 세계관(project.world)과 엮여야 한다.
// 그래서 대사는 모델이 쓴 **캐스트 시트**로만 들어오고, 이 모듈은 대기 NPC 수집·프롬프트·검증·적용만 맡는다.
import { describe, expect, it } from "vitest";
import {
  buildCastWriterMessages,
  castSheetToWorldPatch,
  collectPendingNpcs,
  parseCastSheet,
  type CastContext,
} from "@/ai/npcCast";
import { normalizeWorld } from "@/project/world/guards";
import { createBlankProject } from "@/project/defaults";
import type { EventPage, GameEvent, Project } from "@/project/types";

const MAP_ID = "map_blank_start";

function page(id: string, name: string, patch: Partial<EventPage> = {}): EventPage {
  return {
    id,
    name,
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
    ...patch,
  };
}

function npc(id: string, x: number, pages: EventPage[]): GameEvent {
  return { id, x, y: 5, trigger: { kind: "action" }, commands: [], pages };
}

/** 대사 없는 주민 둘(한 명은 상점 커맨드 보유) + 대사 있는 기존 주민 한 명. */
function projectWithPendingNpcs(): Project {
  const project = createBlankProject();
  const map = project.maps[MAP_ID]!;
  map.events.push(
    npc("ev_a", 4, [page("ev_a_p0", "주민 1")]),
    npc("ev_b", 8, [
      page("ev_b_p0", "주민 2", {
        commands: [{ kind: "shop", itemIds: ["item_potion"], allowSell: true, quantityMode: "select", shopType: "normal", messageType: "welcome" } as never],
      }),
      page("ev_b_p1", "주민 2", { conditions: [{ kind: "npcActivity", activity: "장터 소식 나누기" }] }),
    ]),
    npc("ev_old", 12, [page("ev_old_p0", "촌장", { commands: [{ kind: "text", body: "마을에 온 걸 환영하네." }] })]),
  );
  project.world = {
    entities: [
      { id: "w_faction_river", type: "faction", name: "강물지기단", summary: "강을 지키는 길드", origin: "user" },
    ],
    relations: [],
  };
  return project;
}

function contextFor(project: Project): CastContext {
  const pending = collectPendingNpcs(project, null);
  return {
    mapId: MAP_ID,
    mapName: project.maps[MAP_ID]!.name,
    theme: "강가 어촌 장터",
    requestText: "강가 어촌 마을 지어줘",
    worldDigest: "[faction] 강물지기단: 강을 지키는 길드",
    worldNames: ["강물지기단"],
    existingCast: [{ name: "촌장", line: "마을에 온 걸 환영하네." }],
    residents: pending,
  };
}

describe("collectPendingNpcs — 대사 없는 페이지를 가진 NPC 만 고른다", () => {
  it("text 커맨드가 없는 페이지를 가진 이벤트만, 페이지 단위로 조건 라벨과 함께 낸다", () => {
    const project = projectWithPendingNpcs();
    const pending = collectPendingNpcs(project, null);
    expect(pending.map((npc) => npc.eventId).sort()).toEqual(["ev_a", "ev_b"]);
    const b = pending.find((npc) => npc.eventId === "ev_b")!;
    expect(b.pages.map((p) => p.pageId)).toEqual(["ev_b_p0", "ev_b_p1"]);
    expect(b.pages[1]!.condition).toContain("장터 소식 나누기");
    // 상점 커맨드는 대사가 아니다 — 상점 주인도 대사가 없으면 대기다.
    expect(b.hasShop).toBe(true);
  });

  it("기준선(사용자 프로젝트)에 이미 있던 이벤트는 건드리지 않는다 — 사용자의 말 없는 NPC 는 사용자 것이다", () => {
    const project = projectWithPendingNpcs();
    const baseline = structuredClone(project);
    project.maps[MAP_ID]!.events.push(npc("ev_new", 14, [page("ev_new_p0", "주민 3")]));
    const pending = collectPendingNpcs(project, baseline);
    expect(pending.map((npc) => npc.eventId)).toEqual(["ev_new"]);
  });
});

describe("buildCastWriterMessages — 테마·기존 주민·세계관·대기 페이지가 프롬프트에 전부 실린다", () => {
  it("system + user 두 메시지이고 user 에 주민 id·조건·세계관 다이제스트·기존 주민이 들어 있다", () => {
    const project = projectWithPendingNpcs();
    const messages = buildCastWriterMessages(contextFor(project));
    expect(messages).toHaveLength(2);
    const user = String(messages[1]!.content);
    expect(user).toContain("ev_a");
    expect(user).toContain("ev_b_p1");
    expect(user).toContain("장터 소식 나누기");
    expect(user).toContain("강물지기단");
    expect(user).toContain("촌장");
    expect(user).toContain("강가 어촌 장터");
  });
});

describe("parseCastSheet — 전원 대사, 상호 언급, 세계관 언급을 코드가 검증한다", () => {
  const goodSheet = {
    residents: [
      { eventId: "ev_a", name: "은호", role: "어부", summary: "새벽 그물을 걷는 청년", knows: ["ev_b"],
        pages: [{ pageId: "ev_a_p0", lines: ["다래 아주머니 가게에 오늘 잡은 은어를 넘겼어요.", "강물지기단이 상류를 막아서 물고기가 줄었지요."] }] },
      { eventId: "ev_b", name: "다래", role: "잡화점 주인", summary: "장터를 지키는 상인", knows: ["ev_a"],
        pages: [
          { pageId: "ev_b_p0", lines: ["은호가 가져온 은어가 오늘의 특산이에요."] },
          { pageId: "ev_b_p1", lines: ["장터 소식? 촌장님이 강물지기단과 담판을 지으러 갔대요."] },
        ] },
    ],
  };

  it("정상 시트를 받아 residents 를 그대로 돌려준다", () => {
    const project = projectWithPendingNpcs();
    const parsed = parseCastSheet(JSON.stringify(goodSheet), contextFor(project));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.sheet.residents).toHaveLength(2);
    expect(parsed.sheet.residents[1]!.pages[1]!.lines[0]).toContain("촌장");
  });

  it("대기 페이지 하나라도 대사가 비면 거부한다 — 빈 페이지는 완료가 아니다", () => {
    const project = projectWithPendingNpcs();
    const sheet = structuredClone(goodSheet);
    sheet.residents[1]!.pages = [sheet.residents[1]!.pages[0]!];
    const parsed = parseCastSheet(JSON.stringify(sheet), contextFor(project));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues.join("\n")).toContain("ev_b_p1");
  });

  it("주민이 둘 이상인데 아무도 다른 주민을 언급하지 않으면 거부한다 — 주민끼리 엮여야 한다", () => {
    const project = projectWithPendingNpcs();
    const sheet = structuredClone(goodSheet);
    sheet.residents[0]!.pages[0]!.lines = ["오늘 파도가 잔잔하군요.", "강물지기단이 상류를 막았지요."];
    sheet.residents[1]!.pages[0]!.lines = ["어서 오세요."];
    sheet.residents[1]!.pages[1]!.lines = ["장터 소식은 별로 없어요."];
    const parsed = parseCastSheet(JSON.stringify(sheet), contextFor(project));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues.join("\n")).toMatch(/언급|엮/);
  });

  it("세계관 개체가 있는데 한 줄도 언급하지 않으면 거부한다", () => {
    const project = projectWithPendingNpcs();
    const sheet = structuredClone(goodSheet);
    sheet.residents[0]!.pages[0]!.lines = ["다래 아주머니 가게에 은어를 넘겼어요."];
    sheet.residents[1]!.pages[1]!.lines = ["장터 소식? 은호가 큰 물고기를 잡았대요."];
    const parsed = parseCastSheet(JSON.stringify(sheet), contextFor(project));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues.join("\n")).toContain("세계관");
  });

  it("JSON 이 깨졌거나 모르는 eventId 가 오면 사유를 남기고 거부한다", () => {
    const project = projectWithPendingNpcs();
    expect(parseCastSheet("not json", contextFor(project)).ok).toBe(false);
    const sheet = structuredClone(goodSheet);
    sheet.residents[0]!.eventId = "ev_ghost";
    const parsed = parseCastSheet(JSON.stringify(sheet), contextFor(project));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues.join("\n")).toContain("ev_ghost");
  });
});

describe("castSheetToWorldPatch — 주민은 세계관 개체가 되고 서로 knows 로 엮인다", () => {
  it("맵 place 개체 + 주민 character 개체 + locatedIn/knows 관계를 내고 normalizeWorld 를 통과한다", () => {
    const project = projectWithPendingNpcs();
    const parsed = parseCastSheet(
      JSON.stringify({
        residents: [
          { eventId: "ev_a", name: "은호", role: "어부", summary: "새벽 그물을 걷는 청년", knows: ["ev_b"], pages: [{ pageId: "ev_a_p0", lines: ["다래 가게에 은어를 넘겼어요. 강물지기단 얘기 들었어요?"] }] },
          { eventId: "ev_b", name: "다래", role: "잡화점 주인", summary: "장터를 지키는 상인", knows: ["ev_a"], pages: [{ pageId: "ev_b_p0", lines: ["은호가 잡은 은어예요."] }, { pageId: "ev_b_p1", lines: ["은호 소식이 궁금해요."] }] },
        ],
      }),
      contextFor(project),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const world = castSheetToWorldPatch(project, MAP_ID, parsed.sheet);
    const normalized = normalizeWorld(world);
    const characters = normalized.entities.filter((entity) => entity.type === "character");
    expect(characters.map((entity) => entity.name).sort()).toEqual(["다래", "은호"]);
    expect(characters.every((entity) => entity.origin === "ai")).toBe(true);
    expect(characters.every((entity) => entity.refs?.some((ref) => ref.kind === "event"))).toBe(true);
    const place = normalized.entities.find((entity) => entity.type === "place" && entity.refs?.some((ref) => ref.kind === "map" && ref.id === MAP_ID));
    expect(place).toBeTruthy();
    expect(normalized.relations.filter((relation) => relation.kind === "knows")).toHaveLength(1); // 양방향은 한 쌍으로 접는다
    expect(normalized.relations.filter((relation) => relation.kind === "locatedIn")).toHaveLength(2);
    // 기존 사용자 개체는 그대로 남는다.
    expect(normalized.entities.some((entity) => entity.id === "w_faction_river")).toBe(true);
  });
});
