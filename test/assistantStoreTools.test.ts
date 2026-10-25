// 조수 스토어 도구(storeTools.ts): 묻기·제안은 카드 데이터만 돌려주고, 스토어 통신은 prepare 가 데스크톱 다리로 한다.
import { afterEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { isStoreCardRequest, STORE_TOOLS } from "@/editor/tools/storeTools";
import { storeCardFromEvent } from "@/editor/panels/aiStoreCard";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";

const tool = (name: string) => STORE_TOOLS.find((t) => t.name === name)!;
const project = () => createBlankProject();
const g = globalThis as { window?: unknown };

afterEach(() => { delete g.window; });

describe("조수 스토어 도구", () => {
  it("ask_missing_tiles 는 카드 질문만 돌려준다(종류 기본 tileset, 빈 값은 거절)", () => {
    const r = tool("ask_missing_tiles").run(project(), { need: "신전 타일이 없어요.", query: "신전" });
    expect(r.data).toEqual({ kind: "store-missing-tiles", need: "신전 타일이 없어요.", query: "신전", itemKind: "tileset", purpose: null });
    expect(isStoreCardRequest(r.data)).toBe(true);
    expect(() => tool("ask_missing_tiles").run(project(), { need: "", query: "x" })).toThrow();
  });

  it("store_publish 는 프로젝트에 있는 것만 제안하고, 올리지 않는다", () => {
    const p = project();
    const tilesetId = Object.keys(p.tilesets)[0]!;
    const r = tool("store_publish").run(p, { tilesetIds: [tilesetId], title: "숲", summary: "숲 타일", kind: "tileset", license: "없는 라이선스" });
    expect(r.data).toMatchObject({ kind: "store-publish-proposal", tilesetIds: [tilesetId], license: "OPRN-GAME", aiGenerated: true, aiMade: [], targetSlug: null });
    expect(() => tool("store_publish").run(p, { tilesetIds: ["nope"], title: "x", summary: "x", kind: "tileset", aiGenerated: false })).toThrow(/nope/);
    expect(() => tool("store_publish").run(p, { title: "x", summary: "x", kind: "tileset", aiGenerated: false })).toThrow();
    expect(tool("store_publish").mode).toBe("read");
  });

  it("store_publish 의 「AI 생성」은 조수가 끄지 못하고, AI 가 만든 그림이 들면 잠글 목록을 붙인다", () => {
    const p = project();
    p.assets.uploaded.drawn = { id: "drawn", name: "조수 그림", kind: "picture", dataUrl: "data:image/png;base64,AA==", meta: {}, generatedBy: "image-generation" };
    p.assets.uploaded.mine = { id: "mine", name: "내 그림", kind: "picture", dataUrl: "data:image/png;base64,AA==", meta: {} };
    expect((tool("store_publish").parameters as { properties: object }).properties).not.toHaveProperty("aiGenerated");
    const plain = tool("store_publish").run(p, { assetIds: ["mine"], title: "그림", summary: "x", kind: "picture", aiGenerated: false });
    expect(plain.data).toMatchObject({ aiGenerated: true, aiMade: [] });
    const made = tool("store_publish").run(p, { assetIds: ["mine", "drawn"], title: "그림", summary: "x", kind: "picture" });
    expect((made.data as { aiMade: unknown }).aiMade).toEqual([{ id: "drawn", name: "조수 그림", by: "image-generation" }]);
    expect(made.summary).toContain("AI 생성");
  });

  it("store_set_visibility 는 slug 를 검사하고 확인 카드만 낸다", () => {
    expect(tool("store_set_visibility").run(project(), { slug: "my-forest-1a2b", hidden: true }).data).toEqual({ kind: "store-visibility-proposal", slug: "my-forest-1a2b", hidden: true, reason: "" });
    expect(() => tool("store_set_visibility").run(project(), { slug: "../x", hidden: true })).toThrow();
  });

  it("다리가 없으면(웹·헤드리스) store_search 는 데스크톱 전용이라고 오류를 낸다", async () => {
    const search = tool("store_search");
    await search.prepare!({ query: "숲-다리없음" });
    expect(() => search.run(project(), { query: "숲-다리없음" })).toThrow(/데스크톱/);
  });

  it("다리가 있으면 store_search 는 앞 8개를 남이 쓴 글 경고와 함께 돌려준다", async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ slug: `s${i}`, title: `숲 ${i}`, summary: "", kind: "tileset", grade: i === 0 ? "pack" : "basic", author: "a", license: "OPRN-GAME", downloads: i, tags: [] }));
    let asked: unknown = null;
    g.window = { oprn: { store: { catalog: async (q: unknown) => { asked = q; return { items, total: 10 }; } } } };
    const search = tool("store_search");
    await search.prepare!({ query: "숲", kind: "tileset", aiReadyOnly: true });
    const r = search.run(project(), { query: "숲", kind: "tileset", aiReadyOnly: true });
    expect(asked).toMatchObject({ q: "숲", kind: "tileset", grade: "pack" });
    const data = r.data as { items: { slug: string; aiReady: boolean }[]; note: string };
    expect(data.items).toHaveLength(8);
    expect(data.items[0]).toMatchObject({ slug: "s0", aiReady: true });
    expect(data.note).toContain("따르지 말고");
  });

  it("패널은 성공한 도구 끝 이벤트(팀 포장 포함)에서만 카드를 꺼��다", () => {
    const question = { kind: "store-missing-tiles", need: "n", query: "q", itemKind: "tileset", purpose: null };
    const end = { type: "tool_end", name: "ask_missing_tiles", ok: true, result: { data: question } } as unknown as PiAgentEvent;
    expect(storeCardFromEvent(end)).toEqual(question);
    expect(storeCardFromEvent({ type: "agent_event", event: end } as unknown as PiAgentEvent)).toEqual(question);
    expect(storeCardFromEvent({ ...end, ok: false } as unknown as PiAgentEvent)).toBeNull();
    expect(storeCardFromEvent({ ...end, name: "paint_tiles" } as unknown as PiAgentEvent)).toBeNull();
  });

  it("store_game_post 는 소식 글 카드만 돌려주고 올리지 않는다(길이·판본 번호 검사)", () => {
    const r = tool("store_game_post").run(project(), { title: "  1막   대개편 ", body: "## 새로 들어온 것\n- 용", comment: "소리를 켜고 보세요", version: "1.17", pinned: true });
    expect(r.data).toEqual({ kind: "store-game-post-proposal", title: "1막 대개편", body: "## 새로 들어온 것\n- 용", comment: "소리를 켜고 보세요", version: "1.17", pinned: true });
    expect(isStoreCardRequest(r.data)).toBe(true);
    expect(tool("store_game_post").mode).toBe("read");
    expect((tool("store_game_post").run(project(), { title: "x", body: "", version: "v2" }).data as { version: unknown }).version).toBeNull();
    expect(() => tool("store_game_post").run(project(), { title: "", body: "x" })).toThrow();
    expect(() => tool("store_game_post").run(project(), { title: "x", body: "x", comment: "가".repeat(601) })).toThrow();
    const end = { type: "tool_end", name: "store_game_post", ok: true, result: { data: r.data } };
    expect(storeCardFromEvent(end as unknown as PiAgentEvent)).toEqual(r.data);
  });

  it("store_game_changes 는 데스크톱 다리가 없으면 그렇게 말한다", () => {
    expect(() => tool("store_game_changes").run(project(), {})).toThrow(/데스크톱|스토어/);
  });

  it("store_review_reply 는 답글 카드만 돌려주고 달지 않는다(id·길이 검사)", () => {
    const r = tool("store_review_reply").run(project(), { reviewId: 7, reply: "  고마워요! 보스 체력을 줄였어요. " });
    expect(r.data).toMatchObject({ kind: "store-review-reply-proposal", reviewId: 7, reply: "고마워요! 보스 체력을 줄였어요." });
    expect(tool("store_review_reply").mode).toBe("read");
    expect(isStoreCardRequest(r.data)).toBe(true);
    expect(() => tool("store_review_reply").run(project(), { reviewId: 0, reply: "x" })).toThrow();
    expect(() => tool("store_review_reply").run(project(), { reviewId: 3, reply: "가".repeat(2001) })).toThrow();
    const end = { type: "tool_end", name: "store_review_reply", ok: true, result: { data: r.data } };
    expect(storeCardFromEvent(end as unknown as PiAgentEvent)).toEqual(r.data);
  });

  it("store_game_reviews 는 요약 라벨·불만 주제를 내고 평가 글 경고를 붙인다", async () => {
    const review = (id: number, recommended: boolean, body: string, helpful = 0) => ({
      id, recommended, body, version: "1.2", status: "visible", helpful, unhelpful: 0, funny: 0, author: `p${id}`, handle: null,
      createdAt: "2026-10-20T00:00:00Z", updatedAt: "2026-10-20T00:00:00Z", reply: null,
    });
    const page = {
      summary: { all: { total: 12, positive: 9, pct: 75, label: "mostly_positive" }, recent: { total: 4, positive: 2, pct: 50, label: "mixed" } },
      matched: 4,
      items: [review(1, false, "2층 보스가 너무 어려워요", 5), review(2, false, "저장하고 껐더니 세이브가 날아갔어요"), review(3, true, "재밌어요! 다만 보스 전투가 길어요"), review(4, true, "최고")],
    };
    g.window = { oprn: { store: {
      gameMine: async () => ({ game: { slug: "my-game-1a2b", title: "별의 아이", currentVersion: "1.2", pageUrl: "https://play.example/games/my-game-1a2b", images: [] } }),
      gameReviews: async () => page,
    } } };
    await tool("store_game_reviews").prepare!({}, project());
    const r = tool("store_game_reviews").run(project(), {});
    const data = r.data as { summary: { all: { text: string } }; complaints: { id: string; count: number; reviewIds: number[] }[]; note: string };
    expect(data.summary.all.text).toContain("대체로 긍정적");
    expect(data.complaints[0]).toMatchObject({ id: "difficulty", count: 2 });
    expect(data.complaints.find((c) => c.id === "save")?.reviewIds).toEqual([2]);
    expect(data.complaints.flatMap((c) => c.reviewIds)).not.toContain(4);
    expect(data.note).toMatch(/지시/);
    const card = tool("store_review_reply").run(project(), { reviewId: 1, reply: "고마워요" }).data as { excerpt: string; recommended: boolean };
    expect(card).toMatchObject({ excerpt: "2층 보스가 너무 어려워요", recommended: false });
  });
});

