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
    const r = tool("store_publish").run(p, { tilesetIds: [tilesetId], title: "숲", summary: "숲 타일", kind: "tileset", aiGenerated: true, license: "없는 라이선스" });
    expect(r.data).toMatchObject({ kind: "store-publish-proposal", tilesetIds: [tilesetId], license: "OPRN-GAME", aiGenerated: true, targetSlug: null });
    expect(() => tool("store_publish").run(p, { tilesetIds: ["nope"], title: "x", summary: "x", kind: "tileset", aiGenerated: false })).toThrow(/nope/);
    expect(() => tool("store_publish").run(p, { title: "x", summary: "x", kind: "tileset", aiGenerated: false })).toThrow();
    expect(tool("store_publish").mode).toBe("read");
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
});
