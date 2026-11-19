/** @vitest-environment happy-dom */
// 게임 공개 선언(OPRN PLAY 는 무료·비영리 게임만 싣는다): 스토어가 준 문구를 그대로 보여 주고, 다섯 항목과 사는 곳을 확인해야만
// 게시 요청에 선언이 실린다. 편집기 발행 창·Electron 다리·명령줄이 같은 규칙을 쓴다.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetStoreClient } from "../electron/main/assetStoreClient";
import { storeGamePublishSchema } from "../electron/shared/schemas";
import {
  normalizeStoreGameDeclarationDoc, publishStoreGame, STORE_GAME_DECLARATION_KEYS, storeGameDeclaration, storeGameDeclarationFromFlags, storeGameDeclarationText,
  type StoreGameTransport,
} from "../src/assetStore/gamePublish";
import { createStoreGameSection, storeGamePublishLine, storeGameSubmissionLine } from "../src/editor/panels/storeGameSection";

vi.mock("../src/project/webExport", () => ({ prepareWebExport: () => ({ projectJson: "{}" }) }));
vi.mock("../src/project/storeGameRelease", () => ({
  buildStoreGameFiles: async () => ({ files: new Map([["index.html", new Uint8Array([1, 2, 3])]]), entry: "index.html" }),
  changelogFromChanges: () => "첫 판본",
  projectChangeSummary: () => ({}),
}));

/** 스토어 GET /api/v1/games/declaration?lang=ko 가 주는 꼴(문구는 스토어가 정본 — 여기 글은 시험용 줄임말이다). */
const DOC = {
  version: "2026-11-15", title: "게임 공개 선언", lead: "OPRN PLAY 는 무료 · 비영리 창작 게임만 싣습니다.",
  items: [
    { key: "nonCommercial", text: "이 게임은 비영리입니다." },
    { key: "ownWork", text: "이 게임은 내가 직접 만들었습니다." },
    { key: "noAdultContent", text: "이 게임에는 청소년에게 유해한 내용이 없습니다." },
    { key: "age14", text: "저는 만 14세 이상입니다." },
    { key: "agreeTerms", text: "이용약관에 동의합니다." },
  ],
  residence: { question: "지금 사는 곳", note: "대한민국 밖에 사는 작가의 게임은 대한민국에서는 보이지 않습니다.", options: [{ value: "kr", label: "대한민국" }, { value: "outside_kr", label: "대한민국 밖" }] },
  termsUrl: "https://store.example.com/terms?lang=ko#games",
};
const ALL = new Set<string>(STORE_GAME_DECLARATION_KEYS);
const FULL = { version: "2026-11-15", nonCommercial: true, ownWork: true, noAdultContent: true, age14: true, agreeTerms: true, residence: "kr" };

describe("store game declaration text", () => {
  it("takes the store's text only when every item, both residence options and an http(s) terms address are there", () => {
    const doc = normalizeStoreGameDeclarationDoc(DOC);
    expect(doc.items.map((item) => item.key)).toEqual([...STORE_GAME_DECLARATION_KEYS]);
    expect(doc.residence.options.map((option) => option.value)).toEqual(["kr", "outside_kr"]);
    expect(doc.termsUrl).toBe("https://store.example.com/terms?lang=ko#games");
    const broken: unknown[] = [
      null, "text", { ...DOC, version: "" }, { ...DOC, items: DOC.items.slice(0, 4) }, { ...DOC, items: [...DOC.items].reverse() },
      { ...DOC, items: [...DOC.items, { key: "extra", text: "x" }] }, { ...DOC, items: DOC.items.map((item) => (item.key === "ownWork" ? { ...item, text: " " } : item)) },
      { ...DOC, residence: { ...DOC.residence, options: [DOC.residence.options[0]] } }, { ...DOC, residence: { ...DOC.residence, note: "" } },
      { ...DOC, termsUrl: "javascript:alert(1)" }, { ...DOC, termsUrl: "not a url" },
    ];
    for (const value of broken) expect(() => normalizeStoreGameDeclarationDoc(value), JSON.stringify(value)?.slice(0, 80)).toThrow(/게임 공개 선언을 읽지 못했습니다/);
  });

  it("makes a declaration only from all five items and a residence", () => {
    expect(storeGameDeclaration(DOC, ALL, "kr")).toEqual(FULL);
    expect(storeGameDeclaration(DOC, ALL, "outside_kr")).toEqual({ ...FULL, residence: "outside_kr" });
    expect(storeGameDeclaration(DOC, ALL, null)).toBeNull();
    expect(storeGameDeclaration(DOC, ALL, "moon")).toBeNull();
    for (const key of STORE_GAME_DECLARATION_KEYS) expect(storeGameDeclaration(DOC, new Set([...ALL].filter((other) => other !== key)), "kr"), key).toBeNull();
  });

  it("command line: prints the text and needs --declare <text version> and --residence", () => {
    const doc = normalizeStoreGameDeclarationDoc(DOC);
    const text = storeGameDeclarationText(doc);
    expect(text).toContain("게임 공개 선언 (2026-11-15)");
    expect(text).toContain("  1. 이 게임은 비영리입니다.");
    expect(text).toContain("  5. 이용약관에 동의합니다.");
    expect(text).toContain("kr = 대한민국 / outside_kr = 대한민국 밖");
    expect(text).toContain("대한민국 밖에 사는 작가의 게임은 대한민국에서는 보이지 않습니다.");
    expect(text).toContain("https://store.example.com/terms?lang=ko#games");
    expect(storeGameDeclarationFromFlags(doc, "2026-11-15", "outside_kr")).toEqual({ ...FULL, residence: "outside_kr" });
    expect(() => storeGameDeclarationFromFlags(doc, undefined, "kr")).toThrow(/게임 공개 선언이 필요합니다.*--declare 2026-11-15 --residence kr\|outside_kr/);
    expect(() => storeGameDeclarationFromFlags(doc, "2026-10-31", "kr")).toThrow(/문구가 바뀌었습니다.*지금 판은 2026-11-15/);
    expect(() => storeGameDeclarationFromFlags(doc, "2026-11-15", undefined)).toThrow(/--residence kr/);
    expect(() => storeGameDeclarationFromFlags(doc, "2026-11-15", "KR")).toThrow(/--residence kr/);
  });
});

describe("store game publish request", () => {
  const request = { projectKey: "p", meta: { title: "시험", summary: "", description: "", credits: "", genre: "", controls: [] }, files: new Map([["index.html", new Uint8Array([1])]]), entry: "index.html", cover: null, art: [], changelog: "", changes: {}, bump: "minor" as const };
  const transport = (bodies: unknown[]): StoreGameTransport => ({
    json: async (_method, path, body) => {
      if (path.endsWith("/files/check")) return { missing: [] };
      bodies.push(body);
      return { slug: "g", version: "1.0", unchanged: false, status: "pending", playUrl: "", pageUrl: "", gameUrl: "", held: ["first_version"], message: "처음 올리는 게임은 운영자가 확인한 뒤 공개됩니다." };
    },
    upload: async () => undefined,
  });

  it("sends the declaration with the publish call and passes the held result through", async () => {
    const bodies: unknown[] = [];
    const result = await publishStoreGame(transport(bodies), { ...request, declaration: storeGameDeclaration(DOC, ALL, "kr") });
    expect((bodies[0] as { declaration: unknown }).declaration).toEqual(FULL);
    expect(result.held).toEqual(["first_version"]);
    expect(result.status).toBe("pending");
  });

  it("leaves the field out when there is none (a store that does not know the declaration)", async () => {
    const bodies: unknown[] = [];
    await publishStoreGame(transport(bodies), { ...request, declaration: null });
    expect(bodies[0]).not.toHaveProperty("declaration");
  });

  it("the bridge schema lets a declaration through only with every item true and a residence", () => {
    const base = { ...request, files: { "index.html": new Uint8Array([1]) }, version: null };
    expect(storeGamePublishSchema.safeParse({ ...base, declaration: FULL }).success).toBe(true);
    expect(storeGamePublishSchema.safeParse(base).success).toBe(true);
    expect(storeGamePublishSchema.safeParse({ ...base, declaration: { ...FULL, noAdultContent: false } }).success).toBe(false);
    expect(storeGamePublishSchema.safeParse({ ...base, declaration: { ...FULL, residence: "moon" } }).success).toBe(false);
    const { age14: _age14, ...missing } = FULL;
    expect(storeGamePublishSchema.safeParse({ ...base, declaration: missing }).success).toBe(false);
  });
});

describe("asset store client game declaration", () => {
  const roots: string[] = [];
  const requests: { url: string; authorization: string | null }[] = [];
  function client(respond: () => Response): AssetStoreClient {
    const root = mkdtempSync(join(tmpdir(), "oprn-store-declaration-"));
    roots.push(root);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
      requests.push({ url: String(url), authorization: new Headers(init.headers).get("authorization") });
      return respond();
    }));
    return new AssetStoreClient(root, { load: () => null, save: () => undefined, persistent: () => false }, "https://store.example.com");
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  afterEach(() => {
    vi.unstubAllGlobals();
    requests.length = 0;
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("asks the store for the text in the editor language, without a login", async () => {
    await expect(client(() => json(DOC)).gameDeclaration("ja")).resolves.toMatchObject({ version: "2026-11-15", termsUrl: "https://store.example.com/terms?lang=ko#games" });
    expect(requests).toEqual([{ url: "https://store.example.com/api/v1/games/declaration?lang=ja", authorization: null }]);
  });

  it("answers null for a store that does not know the declaration (404), and refuses a broken text", async () => {
    await expect(client(() => json({ error: "not_found", message: "게임을 찾지 못했습니다." }, 404)).gameDeclaration()).resolves.toBeNull();
    await expect(client(() => json({ ...DOC, items: [] })).gameDeclaration()).rejects.toThrow(/게임 공개 선언을 읽지 못했습니다/);
    await expect(client(() => json({ message: "잠시 뒤에 다시" }, 503)).gameDeclaration()).rejects.toThrow(/잠시 뒤에 다시/);
  });
});

describe("publish dialog lines", () => {
  const base = { version: "1.0", unchanged: false, status: "visible", pageUrl: "https://play.example/games/g" };
  it("says «sent, not public yet» with the store's reason for a held version", () => {
    expect(storeGamePublishLine(base)).toBe("v1.0 을 올렸습니다. https://play.example/games/g");
    expect(storeGamePublishLine({ ...base, unchanged: true })).toBe("바뀐 파일이 없어 새 판본을 만들지 않았습니다. 지금 판본 v1.0.");
    const held = storeGamePublishLine({ ...base, status: "pending", held: ["first_version"], message: "처음 올리는 게임은 운영자가 확인한 뒤 공개됩니다.", pageUrl: "https://store.example/me#my-games" });
    expect(held).toBe("v1.0 을 보냈습니다 — 아직 공개되지 않았습니다. 처음 올리는 게임은 운영자가 확인한 뒤 공개됩니다. https://store.example/me#my-games");
    expect(storeGamePublishLine({ ...base, status: "pending" })).toContain("운영자가 확인한 뒤 공개됩니다.");
    expect(storeGamePublishLine({ ...base, distribution: "outside_kr" })).toBe("v1.0 을 올렸습니다. 이 게임은 대한민국에서는 보이지 않습니다. https://play.example/games/g");
  });

  it("tells the author about a waiting or returned submission", () => {
    expect(storeGameSubmissionLine(null)).toBe("");
    expect(storeGameSubmissionLine(undefined)).toBe("");
    expect(storeGameSubmissionLine({ status: "pending", reasons: ["first_version"], reasonTexts: ["처음 올리는 게임은 운영자가 확인한 뒤 공개됩니다."], note: "", createdAt: "" }))
      .toBe("운영자 확인을 기다리는 판본이 있습니다. 처음 올리는 게임은 운영자가 확인한 뒤 공개됩니다. 지금 다시 올리면 기다리는 판본을 대신합니다.");
    expect(storeGameSubmissionLine({ status: "rejected", reasons: ["build_link"], reasonTexts: [], note: "게임 안 대사의 후원 주소를 지워 주세요.", createdAt: "" }))
      .toBe("운영자가 지난 판본을 돌려보냈습니다: 게임 안 대사의 후원 주소를 지워 주세요. 고친 뒤 다시 올려 주세요.");
  });
});

describe("publish dialog «스토어에서 바로 플레이» declaration", () => {
  const published: Record<string, unknown>[] = [];
  const result = { slug: "g", version: "1.0", unchanged: false, status: "pending", playUrl: "", pageUrl: "https://store.example/me#my-games", gameUrl: "", held: ["first_version"], message: "처음 올리는 게임은 운영자가 확인한 뒤 공개됩니다." };
  function mount(overrides: Record<string, unknown> = {}): HTMLElement {
    (window as unknown as { oprn: unknown }).oprn = {
      store: {
        status: async () => ({ loggedIn: true }),
        gameMine: async () => ({ game: null, next: { minor: "1.0", major: "1.0" }, baseline: null, baselineProject: null, submission: null }),
        gameDeclaration: async () => DOC,
        gamePublish: async (input: Record<string, unknown>) => { published.push(input); return result; },
        onProgress: () => () => undefined,
        ...overrides,
      },
    };
    const section = createStoreGameSection({
      project: { meta: { title: "시험 게임" } } as never, projectKey: () => "project-key", versionOverride: () => "",
      fetchBytes: async () => new Uint8Array(), bundleBase: "/export-player/",
    });
    expect(section).not.toBeNull();
    document.body.append(section!.element);
    return section!.element;
  }
  const part = <T extends HTMLElement>(root: HTMLElement, id: string): T => {
    const node = root.querySelector<T>(`[data-testid="${id}"]`);
    if (!node) throw new Error(`no ${id}`);
    return node;
  };
  const set = (input: HTMLInputElement, on = true): void => { input.checked = on; input.dispatchEvent(new Event("change")); };
  afterEach(() => {
    published.length = 0;
    document.body.replaceChildren();
    delete (window as unknown as { oprn?: unknown }).oprn;
  });

  it("shows the store's text and keeps «올리기» off until all five items are checked and a residence is chosen; then sends the declaration and clears the checks", async () => {
    const root = mount();
    const box = part(root, "store-game-declaration");
    const publish = part<HTMLButtonElement>(root, "store-game-publish");
    await vi.waitFor(() => expect(box.style.display).toBe("flex"));
    expect(box.textContent).toContain("OPRN PLAY 는 무료 · 비영리 창작 게임만 싣습니다.");
    for (const item of DOC.items) expect(box.textContent).toContain(item.text);
    expect(part(root, "store-game-residence-note").textContent).toBe("대한민국 밖에 사는 작가의 게임은 대한민국에서는 보이지 않습니다.");
    expect(part<HTMLAnchorElement>(root, "store-game-terms").getAttribute("href")).toBe("https://store.example.com/terms?lang=ko#games");
    expect(publish.disabled).toBe(true);
    expect(part(root, "store-game-declaration-hint").hidden).toBe(false);

    const checks = STORE_GAME_DECLARATION_KEYS.map((key) => part<HTMLInputElement>(root, `store-game-declare-${key}`));
    for (const input of checks.slice(0, 4)) set(input);
    set(part<HTMLInputElement>(root, "store-game-residence-outside_kr"));
    expect(publish.disabled, "four of five").toBe(true);
    set(checks[4]!);
    expect(publish.disabled).toBe(false);
    expect(part(root, "store-game-declaration-hint").hidden).toBe(true);
    set(checks[2]!, false);
    expect(publish.disabled, "unchecking one turns it off again").toBe(true);
    set(checks[2]!);

    publish.click();
    await vi.waitFor(() => expect(published).toHaveLength(1));
    expect(published[0]!.declaration).toEqual({ ...FULL, residence: "outside_kr" });
    await vi.waitFor(() => expect(part(root, "store-game-status").textContent).toContain("v1.0 을 보냈습니다 — 아직 공개되지 않았습니다. 처음 올리는 게임은 운영자가 확인한 뒤 공개됩니다."));
    await vi.waitFor(() => expect(checks.every((input) => !input.checked)).toBe(true));
    await vi.waitFor(() => expect(publish.disabled, "the next publish needs a new declaration").toBe(true));
    expect(part<HTMLInputElement>(root, "store-game-residence-outside_kr").checked).toBe(true);
  });

  it("without a residence nothing is sent even when every item is checked", async () => {
    const root = mount();
    await vi.waitFor(() => expect(part(root, "store-game-declaration").style.display).toBe("flex"));
    for (const key of STORE_GAME_DECLARATION_KEYS) set(part<HTMLInputElement>(root, `store-game-declare-${key}`));
    const publish = part<HTMLButtonElement>(root, "store-game-publish");
    expect(publish.disabled).toBe(true);
    publish.disabled = false;
    publish.click();
    await new Promise((done) => setTimeout(done, 20));
    expect(published).toHaveLength(0);
    expect(publish.disabled).toBe(true);
  });

  it("shows a waiting submission and the operator's note for a returned one", async () => {
    const root = mount({ gameMine: async () => ({ game: { slug: "g", title: "시험 게임", status: "visible", currentVersion: "1.1", latestVersion: "1.1", pageUrl: "" }, next: { minor: "1.2", major: "2.0" }, baseline: null, baselineProject: null, submission: { status: "rejected", reasons: ["build_link"], reasonTexts: [], note: "게임 안 대사의 후원 주소를 지워 주세요.", createdAt: "" } }) });
    await vi.waitFor(() => expect(part(root, "store-game-submission").hidden).toBe(false));
    expect(part(root, "store-game-submission").textContent).toBe("운영자가 지난 판본을 돌려보냈습니다: 게임 안 대사의 후원 주소를 지워 주세요. 고친 뒤 다시 올려 주세요.");
  });

  it("publishes without a declaration only to a store that does not know it, and not at all when the text cannot be fetched", async () => {
    const legacy = mount({ gameDeclaration: async () => null });
    const publish = part<HTMLButtonElement>(legacy, "store-game-publish");
    await vi.waitFor(() => expect(publish.disabled).toBe(false));
    expect(part(legacy, "store-game-declaration").style.display).toBe("none");
    publish.click();
    await vi.waitFor(() => expect(published).toHaveLength(1));
    expect(published[0]).not.toHaveProperty("declaration");
    document.body.replaceChildren();

    const failed = mount({ gameDeclaration: async () => { throw new Error("Error invoking remote method 'oprn:store.gameDeclaration': Error: {\"message\":\"스토어에 연결하지 못했습니다.\",\"status\":0,\"details\":[]}"); } });
    await vi.waitFor(() => expect(part(failed, "store-game-status").textContent).toBe("게임 공개 선언을 받지 못해 올릴 수 없습니다: 스토어에 연결하지 못했습니다."));
    expect(part<HTMLButtonElement>(failed, "store-game-publish").disabled).toBe(true);
    expect(published).toHaveLength(1);
  });
});
