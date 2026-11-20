import { describe, expect, it, vi } from "vitest";
import { dbTarget, mapTarget, SmallTaskError, type SmallTaskCollection } from "@/editor/smallTask/target";
import { smallTaskRefusal } from "@/editor/smallTask/tools";
import { ledgerLines, plainSummary } from "@/editor/smallTask/plainSummary";
import { canvasSmallTask, smallTaskErrorMessage } from "@/editor/smallTask/capsule";
import type { GameEvent, Project } from "@/project/types";
import { installFakeDom } from "./fakeDom";
import { runSmallTask } from "@/editor/smallTask/run";

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
  const create = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
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

it("ChatGPT 로그인 요청을 조수의 Pi HTTP 경로로 보내고 호스트 대상과 동반 서비스 토큰을 싣는다", async () => {
  const project = fixture();
  const target = dbTarget(project, "items", "id_first")!;
  const signal = new AbortController().signal;
  const config = { authMode: "chatgpt", apiKey: "", providerId: "openai-codex", model: "gpt-6.1-sol",
    roleModelsPolicyVersion: 1, roleModels: { deep: { provider: "openai-codex", model: "gpt-6.2-sol", thinkingLevel: "medium" } } };
  vi.stubGlobal("window", { oprn: { companionOrigin: "http://127.0.0.1:12345", companionToken: "test-companion-token" } });
  vi.stubGlobal("localStorage", { getItem: (key: string) => key === "oprn:ai-config" ? JSON.stringify(config) : null });
  const fetch = vi.fn(async (_input: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    expect(new Headers(init.headers).get("x-oprn-companion-token")).toBe("test-companion-token");
    expect(body).toMatchObject({ mode: "single", model: "gpt-6.2-sol", thinkingLevel: "medium", smallTask: { target } });
    expect(body).not.toHaveProperty("apiKey");
    const done = { type: "done", smallTask: true, project, changedKeys: [], stats: { ms: 0, turns: 1, toolCalls: 0, toolErrors: 0 } };
    return new Response(JSON.stringify(done) + "\n", {
      headers: { "Content-Type": "application/x-ndjson", "X-Oprn-Run-Id": body.runId },
    });
  });
  vi.stubGlobal("fetch", fetch);
  try {
    await expect(runSmallTask(project, target, "가격을 확인해 줘", signal)).resolves.toBe(project);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toMatch(/^http:\/\/127\.0\.0\.1:12345\/v1\/agent\/run\?provider=openai-codex&reader=/u);
  } finally {
    vi.unstubAllGlobals();
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
