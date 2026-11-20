/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { dbTarget, mapTarget, SmallTaskError, type SmallTaskCollection } from "@/editor/smallTask/target";
import { smallTaskRefusal } from "@/editor/smallTask/tools";
import { ledgerLines, plainSummary } from "@/editor/smallTask/plainSummary";
import { canvasSmallTask, smallTaskErrorMessage } from "@/editor/smallTask/capsule";
import { LOCATION_DELETION_DRAFT_REFUSAL, MAP_REMOVAL_DRAFT_REFUSAL, MAP_REMOVAL_REFERENCE_REFUSAL } from "@/editor/smallTask/primitives/errors";
import { editorState } from "@/editor/editorState";
import type { GameEvent, Project } from "@/project/types";
import { installFakeDom } from "./fakeDom";
import { runSmallTask } from "@/editor/smallTask/run";
import { setLocale } from "@/i18n";

const collections: SmallTaskCollection[] = ["actors", "classes", "items", "skills", "enemies", "troops", "states", "equipment"];
function fixture(): Project {
  const event: GameEvent = { id: "ev_f52", name: "경비", x: 2, y: 3, trigger: { kind: "action" }, commands: [],
    pages: [{ id: "page_first", name: "", conditions: [], trigger: { kind: "action" }, graphic: { sprite: { type: "bundled", id: "tex_actor" } },
      priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "안녕." }] }] };
  return { maps: { map_a: { id: "map_a", name: "장터", events: [event] } },
    database: Object.fromEntries(collections.map(collection => [collection, [{ id: "id_first", name: "포션", price: 50 }]])) } as unknown as Project;
}

describe("호스트가 고른 작은 일 대상", () => {
  it("맵, 캐릭터 그림이 있는 NPC, 그림이 없는 이벤트와 페이지를 구별한다", () => {
    const p = fixture();
    expect(mapTarget(p, null)).toBeNull();
    expect(mapTarget(p, "map_a", "missing")).toBeNull();
    const map = mapTarget(p, "map_a")!;
    expect(map).toEqual({ kind: "map", mapId: "map_a", label: "장터" });
    expect(Object.isFrozen(map)).toBe(true);
    expect(smallTaskRefusal(map, "get_map_region", { mapId: "map_b" })).toContain("선택한 대상");
    const npc = mapTarget(p, "map_a", "ev_f52", "page_first")!;
    expect(npc).toEqual({ kind: "event", mapId: "map_a", eventId: "ev_f52", pageId: "page_first", isNpc: true, x: 2, y: 3, label: "NPC · 경비" });
    expect(Object.isFrozen(npc)).toBe(true);
    const args = { mapId: "map_a", eventId: "ev_f52", pageId: "page_first" };
    expect(smallTaskRefusal(npc, "patch_event_page", args)).toBeNull();
    for (const key of ["mapId", "eventId", "pageId"]) expect(smallTaskRefusal(npc, "patch_event_page", { ...args, [key]: "else" })).toBeTruthy();
    p.maps.map_a.events[0].pages = [];
    const event = mapTarget(p, "map_a", "ev_f52")!;
    expect(event).toMatchObject({ isNpc: false, label: "이벤트 · 경비" });
    expect(smallTaskRefusal(event, "upsert_event", { mapId: "map_a", event: { id: "else" } })).toBeTruthy();
  });
  it.each(collections)("자료집 %s의 현재 레코드만 고친다", collection => {
    const p = fixture();
    expect(dbTarget(p, collection, "absent")).toBeNull();
    const target = dbTarget(p, collection, "id_first")!;
    expect(Object.isFrozen(target)).toBe(true);
    const key = ({ equipment: "equipment", classes: "class", enemies: "enemy" } as Record<string, string>)[collection] ?? collection.slice(0, -1);
    const tool = `upsert_${key}`;
    const args = { [key]: { id: "id_first" } };
    expect(smallTaskRefusal(target, tool, args)).toBeNull();
    expect(smallTaskRefusal(target, tool, { ...args, collection: "foreign" })).toBeTruthy();
    expect(smallTaskRefusal(target, tool, { [key]: { id: "foreign" } })).toBeTruthy();
    expect(smallTaskRefusal(target, tool === "upsert_skill" ? "upsert_actor" : "upsert_skill", args)).toBeTruthy();
  });
});

it("캔버스 도구막대가 다시 그려져도 닫을 때 새 작업 버튼에 초점을 돌려준다", () => {
  const restoreDom = installFakeDom({ window: true });
  vi.stubGlobal("innerWidth", window.innerWidth);
  vi.stubGlobal("innerHeight", window.innerHeight);
  const createElement = document.createElement.bind(document);
  const create = vi.spyOn<{ createElement(tag: string): HTMLElement }, "createElement">(document, "createElement").mockImplementation(tag => {
    const element = createElement(tag);
    if (tag === "section") element.showPopover = () => {};
    return element;
  });
  try {
    const toolbar = document.createElement("div");
    toolbar.classList.add("canvas-toolbar");
    const original = canvasSmallTask(), replacement = canvasSmallTask();
    const otherTrigger = canvasSmallTask();
    document.body.append(otherTrigger, toolbar);
    toolbar.append(original);
    original.click();
    expect(document.querySelector(".small-task")).not.toBeNull();
    toolbar.replaceChildren(replacement);
    document.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "Escape" }));
    expect(document.querySelector(".small-task")).toBeNull();
    expect(document.activeElement).toBe(replacement);
  } finally {
    create.mockRestore();
    vi.unstubAllGlobals();
    restoreDom();
  }
});

it.each([
  { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 } },
  { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 }, omitChangedKeys: true },
  { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 }, withSpawnDraft: true },
  { kind: "event", selectedMapId: "another_map", rect: undefined },
  { kind: "dbEntry", selectedMapId: "map_a", rect: undefined },
  { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 }, selectedDraft: true },
  { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 }, noDraft: true },
  { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 },
    stoppedEarly: "명령 목록이 바뀌었어요. 이벤트를 다시 읽어 주세요." },
  { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 },
    stoppedEarly: "이벤트 페이지가 여러 개예요. 고칠 페이지를 선택해 주세요." },
  { kind: "map", selectedMapId: "another_map", rect: undefined,
    stoppedEarly: `${MAP_REMOVAL_DRAFT_REFUSAL}워커 문구`, shownMessage: "『미저장 출입구』의 편집을 먼저 저장하거나 취소해 주세요." },
  { kind: "map", selectedMapId: "another_map", rect: undefined, savedMapReference: true, noDraft: true,
    stoppedEarly: `${MAP_REMOVAL_REFERENCE_REFUSAL}워커 문구`, shownMessage: "『North Gate』에서 이 맵을 사용하고 있어 삭제할 수 없어요." },
  { kind: "map", selectedMapId: "another_map", rect: undefined, draftLocationId: "loc1",
    stoppedEarly: `${LOCATION_DELETION_DRAFT_REFUSAL}워커 문구\nloc1`,
    shownMessage: "미저장 이벤트 『미저장 출입구』에서 이 장소를 사용하고 있어 삭제할 수 없어요." },
  { kind: "map", selectedMapId: "another_map", rect: undefined, draftLocationId: "loc1",
    stoppedEarly: `${LOCATION_DELETION_DRAFT_REFUSAL}워커 문구\nloc2`,
    shownMessage: "AI가 요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요." },
  { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 },
    stoppedEarly: "퀘스트에 연결할 이벤트를 먼저 저장해 주세요.\n범위 밖: 퀘스트가 사용하는 미저장 이벤트",
    shownMessage: "퀘스트에 연결할 이벤트를 먼저 저장해 주세요." },
])("작은 일 Pi HTTP 요청은 대상과 선택 영역을 보내고 안내를 받는다 ($kind, $selectedMapId, $#)", async ({
  kind, selectedMapId, rect, stoppedEarly, omitChangedKeys, selectedDraft, noDraft, withSpawnDraft,
  shownMessage, savedMapReference, draftLocationId,
}) => {
  const project = fixture();
  if (savedMapReference) {
    const gate: GameEvent = { id: "north_gate", name: "North Gate", x: 1, y: 1, trigger: { kind: "action" },
      commands: [{ kind: "transfer", mapId: "map_a", x: 2, y: 3 }] };
    project.maps.map_b = { ...project.maps.map_a, id: "map_b", events: [gate] };
    project.commonEvents = [];
  }
  const live = structuredClone(project);
  const original = project.maps.map_a.events[0]!;
  const draft: GameEvent = {
    ...original, id: "draft_event", draft: { kind: "new", original },
    ...(kind === "map" ? { name: "미저장 출입구" } : {}),
    ...(draftLocationId ? { condition: { kind: "insideLocation", locationId: draftLocationId, inside: true } } : {}),
  };
  const selected = live.maps.map_a.events[0]!;
  const spawnDraft: GameEvent = { ...original, id: "ev_spawn_draft", draft: { kind: "new" }, pages: [],
    commands: [{ kind: "despawnFieldEnemy", spawnId: "spawn_trial" }] };
  if (selectedDraft) selected.draft = { kind: "edit", original };
  if (!noDraft) live.maps.map_a.events.push(draft);
  if (withSpawnDraft) live.maps.map_a.events.push(spawnDraft);
  const target = kind === "dbEntry" ? dbTarget(project, "items", "id_first")!
    : kind === "map" ? mapTarget(project, "map_a")! : mapTarget(project, "map_a", "ev_f52", "page_first")!;
  const previousSelection = editorState.get().selection;
  editorState.set({ selection: { mapId: selectedMapId, x: 2, y: 3, width: 4, height: 5 } });
  const signal = new AbortController().signal;
  const config = { authMode: "chatgpt", apiKey: "", providerId: "openai-codex", model: "gpt-6.1-sol",
    roleModelsPolicyVersion: 1, roleModels: { deep: { provider: "openai-codex", model: "gpt-6.2-sol", thinkingLevel: "medium" } } };
  vi.stubGlobal("window", { oprn: { companionOrigin: "http://127.0.0.1:12345", companionToken: "test-companion-token" } });
  vi.stubGlobal("localStorage", { getItem: (key: string) => key === "oprn:ai-config" ? JSON.stringify(config) : null });
  const fetch = vi.fn(async (_input: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    expect(new Headers(init.headers).get("x-oprn-companion-token")).toBe("test-companion-token");
    expect(body).toMatchObject({ mode: "single", model: "gpt-6.2-sol", thinkingLevel: "medium", smallTask: { target } });
    expect(body.smallTask.selection).toEqual(rect ? { rect } : undefined);
    const drafts = [
      ...(selectedDraft ? [selected] : []),
      ...(noDraft ? [] : [draft]),
      ...(withSpawnDraft ? [spawnDraft] : []),
    ];
    expect(body.smallTask.draftSource).toEqual(drafts.length ? { maps: { map_a: { events: drafts } } } : undefined);
    expect(body.project.maps.map_a.events).toEqual(project.maps.map_a.events);
    expect(body).not.toHaveProperty("apiKey");
    const done = { type: "done", smallTask: true, project, changedKeys: omitChangedKeys ? undefined : [], stoppedEarly, stats: { ms: 0, turns: 1, toolCalls: 0, toolErrors: 0 } };
    return new Response(JSON.stringify(done) + "\n", {
      headers: { "Content-Type": "application/x-ndjson", "X-Oprn-Run-Id": body.runId },
    });
  });
  vi.stubGlobal("fetch", fetch);
  try {
    const run = runSmallTask(project, target, "고른 대상을 확인해 줘", signal, live);
    if (stoppedEarly) await expect(run.catch(smallTaskErrorMessage)).resolves.toBe(shownMessage ?? stoppedEarly);
    else await expect(run).resolves.toBe(project);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toMatch(/^http:\/\/127\.0\.0\.1:12345\/v1\/agent\/run\?provider=openai-codex&reader=/u);
  } finally {
    vi.unstubAllGlobals();
    editorState.set({ selection: previousSelection });
  }
});

it.each([
  [Object.assign(new Error("credential missing"), { status: 401 }), "AI 로그인이 만료됐거나 연결되지 않았어요. 설정에서 다시 로그인해 주세요."],
  [new Error("No API key found"), "AI 로그인이 만료됐거나 연결되지 않았어요. 설정에서 다시 로그인해 주세요."],
  [new TypeError("Failed to fetch"), "인터넷 연결을 확인하고 다시 시도해 주세요."],
  [new Error("400: Invalid tools schema"), "AI가 요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요."],
  [new SmallTaskError("선택한 대상만 고칠 수 있어요."), "선택한 대상만 고칠 수 있어요."],
])("작은 일이 실패하면 내부 오류 대신 대응하는 안내를 표시한다 (%s)", (error, message) => {
  expect(smallTaskErrorMessage(error)).toBe(message);
});

describe("명세를 읽는 쉬운 말 요약", () => {
  it("가격 한 칸은 전후 값이 곧 제목이다", () => {
    const a = fixture(), b = structuredClone(a);
    b.database.items[0].price = 80;
    expect(plainSummary(a, b)).toEqual({ headline: "포션 가격 50 → 80", lines: ["포션 가격 50 → 80"] });
  });
  it("대사 줄을 세고 바뀐 본문을 짧게 보여 준다", () => {
    const a = fixture(), b = structuredClone(a);
    b.maps.map_a.events[0].pages![0].commands = ["들어와.", "어서.", "길은 map_hidden 쪽", "기다려.".repeat(60)].map(body => ({ kind: "text", body }));
    const { headline, lines } = plainSummary(a, b);
    expect(headline).toBe("대사 3줄 추가 · 대사 1줄 수정 · 이벤트 1개");
    expect(lines).toContain("대사 「안녕.」 → 「들어와.」");
    expect(lines.join(" ")).not.toMatch(/map_hidden|ev_f52|page_first/);
    expect(lines.every(line => line.length < 100)).toBe(true);
  });
  it.each([
    ["ko", "대사 추가 「경비 · 좋은 아침!」"],
    ["en", "Dialogue added 「경비 · 좋은 아침!」"],
    ["ja", "せりふを追加 「경비 · 좋은 아침!」"],
    ["zh", "新增对话 「경비 · 좋은 아침!」"],
  ] as const)("%s에서 새 대사는 이전 값 없이 표시한다", async (locale, added) => {
    try {
      await setLocale(locale);
      const a = fixture(), b = structuredClone(a);
      b.maps.map_a.events[0].pages![0].commands.push({ kind: "text", speaker: "경비", body: "좋은 아침!" });
      const lines = plainSummary(a, b).lines;
      expect(lines.filter(line => line.includes("좋은 아침!"))).toEqual([added]);
    } finally {
      await setLocale("ko");
    }
  });
  it("추가·삭제·변경과 낯선 모양도 한 줄 이상 남기고 내부 식별자를 숨긴다", () => {
    for (const change of ["added", "removed", "changed"] as const) {
      for (const area of ["맵", "이벤트 · 장터", "데이터베이스 · 상태", "퀘스트", "타일셋", "새 설정", "futureArea"]) {
        const lines = ledgerLines({ area, change, label: "map_xxx (ev_xxx)", detail: ["이름: ev_xxx → 6ac327c1-b18a-4fa0-8ba4-1919ee76b8dc"] });
        expect(lines.length).toBeGreaterThan(0);
        expect(lines.join(" ")).not.toMatch(/map_|ev_|6ac327c1|futureArea/);
      }
    }
    const a = fixture(), b = structuredClone(a);
    b.maps.map_a.events = [];
    expect(plainSummary(a, b).headline).toBe("대사 1줄 삭제 · 이벤트 1개");
    expect(ledgerLines({ area: "맵", change: "changed", label: "장터 (abc)", detail: ["BGM: Town1 → Town2"] }))
      .toEqual(["장터 BGM 바뀜"]);
  });
});
