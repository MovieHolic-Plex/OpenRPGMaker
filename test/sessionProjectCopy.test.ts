// 조수 세션의 프로젝트 사본·정체가 «고치기 전과 글자까지 같다» 를 고정한다(src/ai/sessionProjectCopy.ts).
//
// 고치기 전: 사본 = structuredClone(project), 정체 = JSON.stringify(project), 내용 비교 = jsonContentDigest 두 번.
// 고친 뒤: 스토어가 들고 있는 타일셋·업로드 자산 항목은 객체째 공유하고 글 조각을 기억한다. 값은 한 글자도 달라지면 안 된다.
// 대상은 번들 칩셋 전부(빈 새 프로젝트의 타일셋 전부) + 사용자가 고친 타일셋(게임 열쇠가 고른 겉모습 · 이식 목록 · 고친 칸) + 업로드 자산이다.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { sameAcceptanceContent } from "@/ai/assistantAcceptanceEvaluation";
import { defaultAiConfig } from "@/ai/llmClient";
import { sameSessionProjectJson, sessionDraftCopy, sessionProjectCopy, sessionProjectJson } from "@/ai/sessionProjectCopy";
import { tilesetLookTableFor } from "@/assets/tilesetLooks";
import { addTileGraft } from "@/editor/tilesetActions";
import { authoredIdentity, projectIdentityDigest } from "@/project/authoredProjectBaseline";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { bundledTilesetDefinitionReady } from "@/project/defaults/defaultAssets";
import { deserialize, serialize } from "@/project/io";
import { projectJsonChunks, sameJsonChunks } from "@/project/io/sharedDictionaryJson";
import { jsonContentDigest } from "@/project/persistence/core/contentDigest";
import { isStoreOwnedEntry } from "@/project/projectClone";
import { store } from "@/project/store";
import { chooseTilesetLook } from "@/project/tilesetLook";
import type { Project, TilesetLook } from "@/project/types";
import { fixedDeclarer } from "./intentFixture";

// 빈 새 프로젝트(약 7천만 자)를 여러 번 통째로 직렬화·요약해 «예전 값» 을 만든다 — 그 기준값이 느리다.
vi.setConfig({ testTimeout: 300_000, hookTimeout: 300_000 });

const LOOK_TILESET = "beodeul_city";
const GRAFT_TILESET = "pirate_isles";
const EDITED_TILESET = "jp_city";
const GRAFT_SOURCE = "tex_beodeul_architecture";

/** 큰 글은 expect(a).toBe(b) 로 비교하지 않는다 — 실패하면 7천만 자 diff 를 만든다. */
const same = (left: string | undefined, right: string | undefined): boolean => left !== undefined && left === right;

let live: Project;
/** 고치기 전의 사본: structuredClone(project). */
let plain: Project;
/** 고치기 전의 정체: JSON.stringify(project). */
let liveJson: string;

beforeAll(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  const project = createBlankProject();
  project.system = normalizeSystemRecords(project.system);
  project.assets.uploaded["upload-a"] = { id: "upload-a", name: "Uploaded A", kind: "charset", dataUrl: "data:image/png;base64,AA==", meta: {} };
  project.assets.uploaded["upload-b"] = { id: "upload-b", name: "Uploaded B", kind: "picture", dataUrl: "data:image/png;base64,AAAA", meta: {} };
  store.replace(project);

  // 게임 열쇠가 고른 겉모습.
  const table = tilesetLookTableFor(LOOK_TILESET)!;
  let look: TilesetLook | undefined;
  for (let n = 0; n < 5000 && !look; n += 1) look = chooseTilesetLook(table, JSON.stringify(["project", `game-${n}`]));
  if (!look) throw new Error("겉모습을 고르는 게임 열쇠를 찾지 못했다");
  const chosen = look;
  store.update((draft) => { draft.tilesets[LOOK_TILESET]!.look = chosen; });
  // 이식 목록: 덮어쓰기 한 칸 + 시트를 늘리는 한 칸.
  expect(addTileGraft(GRAFT_TILESET, { targetTile: 5, sourceChipset: GRAFT_SOURCE, sourceTile: 4 }).ok).toBe(true);
  const count = store.getCurrent().tilesets[GRAFT_TILESET]!.count;
  expect(addTileGraft(GRAFT_TILESET, { targetTile: count + 3, sourceChipset: GRAFT_SOURCE, sourceTile: 7 }).ok).toBe(true);
  expect(store.getCurrent().tilesets[GRAFT_TILESET]!.count).toBeGreaterThan(count);
  // 사용자가 고친 칸과 이름.
  store.update((draft) => {
    const tileset = draft.tilesets[EDITED_TILESET]!;
    tileset.passability[5] = { up: false, down: true, left: false, right: true };
    tileset.name = `${tileset.name} (고침)`;
  });

  live = store.getCurrent();
  plain = structuredClone(live);
  liveJson = JSON.stringify(live);
});

describe("세션 사본 — structuredClone 과 같은 값, 스토어 항목은 객체째 공유", () => {
  it("대상: 번들 칩셋 전부에 고친 타일셋 셋과 업로드 자산 둘이 섞여 있다", () => {
    const ids = Object.keys(live.tilesets);
    expect(ids.length).toBeGreaterThanOrEqual(40);
    expect(ids.every((id) => bundledTilesetDefinitionReady(id) !== undefined)).toBe(true);
    expect(live.tilesets[LOOK_TILESET]!.look).toBeDefined();
    expect(live.tilesets[GRAFT_TILESET]!.tileGrafts).toEqual(expect.arrayContaining([{ targetTile: 5, sourceChipset: GRAFT_SOURCE, sourceTile: 4 }]));
    expect(live.tilesets[EDITED_TILESET]!.passability[5]).toEqual({ up: false, down: true, left: false, right: true });
    expect(Object.keys(live.assets.uploaded)).toEqual(expect.arrayContaining(["upload-a", "upload-b"]));
    expect(same(JSON.stringify(plain), liveJson)).toBe(true);
  });

  it("스토어 프로젝트의 사본: 글자까지 같고, 키 순서가 같고, 타일셋·업로드 자산 항목만 같은 객체다", () => {
    expect(store.ownsSettledEntriesOf(live)).toBe(true);
    const copy = sessionProjectCopy(live);
    expect(same(JSON.stringify(copy), liveJson)).toBe(true);
    expect(Object.keys(copy)).toEqual(Object.keys(plain));
    expect(Object.keys(copy.tilesets)).toEqual(Object.keys(plain.tilesets));
    expect(Object.keys(copy.assets)).toEqual(Object.keys(plain.assets));
    expect(Object.keys(copy.assets.uploaded)).toEqual(Object.keys(plain.assets.uploaded));
    for (const id of Object.keys(live.tilesets)) {
      expect(copy.tilesets[id]).toBe(live.tilesets[id]);
      expect(isStoreOwnedEntry(copy.tilesets[id])).toBe(true);
    }
    for (const id of Object.keys(live.assets.uploaded)) expect(copy.assets.uploaded[id]).toBe(live.assets.uploaded[id]);
    // 사전과 나머지 가지는 따로 복제된다 — 세션이 초안에서 고쳐도 스토어는 그대로다.
    expect(copy).not.toBe(live);
    expect(copy.tilesets).not.toBe(live.tilesets);
    expect(copy.assets).not.toBe(live.assets);
    expect(copy.assets.uploaded).not.toBe(live.assets.uploaded);
    expect(copy.maps).not.toBe(live.maps);
    expect(copy.database).not.toBe(live.database);
    expect(copy.system).not.toBe(live.system);
    expect(Object.values(copy.maps)[0]).not.toBe(Object.values(live.maps)[0]);
    copy.meta.title = "초안에서만 바뀐 제목";
    delete (copy.tilesets as Record<string, unknown>)[EDITED_TILESET];
    expect(same(JSON.stringify(live), liveJson)).toBe(true);
    // 초안 사본도 같은 값이다.
    expect(same(JSON.stringify(sessionDraftCopy(live)), liveJson)).toBe(true);
  });

  it("내용 요약과 저장 형식: 사본의 값이 structuredClone 사본·새로 읽은 값과 같다", () => {
    const copy = sessionProjectCopy(live);
    const fresh = jsonContentDigest(JSON.parse(liveJson));
    expect(fresh).toMatch(/^[0-9a-f]{64}$/);
    expect(jsonContentDigest(plain)).toBe(fresh);
    expect(jsonContentDigest(copy)).toBe(fresh);
    expect(jsonContentDigest(live)).toBe(fresh);
    for (const kind of ["proposal", "authored", "complete"] as const) expect(projectIdentityDigest(copy, kind)).toBe(projectIdentityDigest(plain, kind));
    const wire = serialize(plain);
    expect(same(serialize(copy), wire)).toBe(true);
    // 되읽기: 사본을 저장하고 읽어 다시 저장한 글이 그대로다.
    expect(same(serialize(deserialize(serialize(copy))), wire)).toBe(true);
    // 내보내기(자기완결 — 번들 정의를 통째로 싣는다)도 같다.
    expect(same(serialize(copy, { inlineBundledTilesets: true }), serialize(plain, { inlineBundledTilesets: true }))).toBe(true);
  });

  it("스토어 밖 프로젝트의 사본은 아무것도 공유하지 않는다(예전처럼 통째 복제)", () => {
    const outside = structuredClone(live);
    expect(store.ownsSettledEntriesOf(outside)).toBe(false);
    const copy = sessionProjectCopy(outside);
    for (const id of Object.keys(outside.tilesets)) {
      expect(copy.tilesets[id]).not.toBe(outside.tilesets[id]);
      expect(isStoreOwnedEntry(copy.tilesets[id])).toBe(false);
    }
    for (const id of Object.keys(outside.assets.uploaded)) expect(copy.assets.uploaded[id]).not.toBe(outside.assets.uploaded[id]);
    expect(same(JSON.stringify(copy), liveJson)).toBe(true);
    // 스토어 밖에서 제자리에서 고쳐도 사본은 그대로다.
    outside.tilesets[EDITED_TILESET]!.passability[6] = { up: true, down: true, left: true, right: true };
    expect(same(JSON.stringify(copy), liveJson)).toBe(true);
  });

  it("도구가 새로 만든 타일셋(스토어가 들고 있던 적이 없는 객체)만 다시 복제하고 나머지는 공유한다", () => {
    const draft = sessionProjectCopy(live);
    const edited = structuredClone(draft.tilesets[EDITED_TILESET]!);
    edited.passability[7] = { up: false, down: false, left: false, right: false };
    draft.tilesets[EDITED_TILESET] = edited;
    const draftJson = JSON.stringify(draft);
    const copy = sessionProjectCopy(draft);
    expect(same(JSON.stringify(copy), draftJson)).toBe(true);
    expect(same(draftJson, liveJson)).toBe(false);
    expect(copy.tilesets[EDITED_TILESET]).not.toBe(edited);
    expect(copy.tilesets[EDITED_TILESET]).toEqual(edited);
    for (const id of Object.keys(draft.tilesets)) if (id !== EDITED_TILESET) expect(copy.tilesets[id]).toBe(live.tilesets[id]);
    expect(Object.keys(copy.tilesets)).toEqual(Object.keys(draft.tilesets));
  });
});

describe("세션 정체 — JSON.stringify 끼리의 === 와 같은 판정", () => {
  it("조각을 이으면 JSON.stringify 와 글자까지 같다(스토어 항목을 공유한 것도, 아무것도 공유하지 않은 것도)", () => {
    expect(same(sessionProjectJson(live).text(), liveJson)).toBe(true);
    expect(same(sessionProjectJson(sessionProjectCopy(live)).text(), liveJson)).toBe(true);
    expect(same(projectJsonChunks(plain).join(""), liveJson)).toBe(true);
    // 두 번째 호출(기억한 조각)도 같다.
    expect(same(sessionProjectJson(live).text(), liveJson)).toBe(true);
  });

  it("바뀐 프로젝트들 사이에서 판정이 JSON.stringify 비교·정체성 글 비교와 같다", () => {
    const variants: [name: string, project: Project, sameContentAsLive: boolean][] = [
      ["스토어", live, true],
      ["사본", sessionProjectCopy(live), true],
      ["통째 복제", plain, true],
    ];
    { const next = sessionProjectCopy(live); next.meta.title = "다른 제목"; variants.push(["제목", next, false]); }
    {
      const next = sessionProjectCopy(live);
      const tileset = next.tilesets[EDITED_TILESET]!;
      next.tilesets = { ...next.tilesets, [EDITED_TILESET]: { ...tileset, passability: tileset.passability.map((cell, index) => (index === 9 ? { ...cell, up: !cell.up } : cell)) } };
      variants.push(["타일셋 한 칸", next, false]);
    }
    {
      // 키 순서만 다르다 — JSON.stringify 로는 다르고, 내용(요약·정체성)으로는 같다.
      const next = sessionProjectCopy(live);
      const entries = Object.entries(next.tilesets);
      next.tilesets = Object.fromEntries([...entries.slice(1), entries[0]!]);
      variants.push(["타일셋 키 순서", next, true]);
    }
    {
      const next = sessionProjectCopy(live);
      next.assets.uploaded = { ...next.assets.uploaded, "upload-a": { ...next.assets.uploaded["upload-a"]!, name: "바뀐 이름" } };
      variants.push(["업로드 자산 이름", next, false]);
    }
    const jsons = variants.map(([, project]) => JSON.stringify(project));
    const identities = variants.map(([, project]) => sessionProjectJson(project));
    const authoredTexts = variants.map(([, project]) => authoredIdentity(project));
    const authoredDigests = variants.map(([, project]) => projectIdentityDigest(project, "authored"));
    const mismatches: string[] = [];
    for (let i = 0; i < variants.length; i += 1) {
      if (identities[i]!.text() !== jsons[i]) mismatches.push(`글: ${variants[i]![0]}`);
      if (sameAcceptanceContent(variants[i]![1], live) !== variants[i]![2]) mismatches.push(`내용 비교: ${variants[i]![0]}`);
      for (let j = 0; j < variants.length; j += 1) {
        const pair = `${variants[i]![0]} · ${variants[j]![0]}`;
        if (identities[i]!.equals(identities[j]!) !== (jsons[i] === jsons[j])) mismatches.push(`정체: ${pair}`);
        if (sameSessionProjectJson(identities[i]!, identities[j]!) !== (jsons[i] === jsons[j])) mismatches.push(`정체(널 허용): ${pair}`);
        // 승인 정체는 정체성 글 대신 그 요약을 쥔다 — 요약이 같다 ⇔ 글이 같다.
        if ((authoredDigests[i] === authoredDigests[j]) !== (authoredTexts[i] === authoredTexts[j])) mismatches.push(`저작 정체성: ${pair}`);
        if (sameAcceptanceContent(variants[i]![1], variants[j]![1]) !== (variants[i]![2] === variants[j]![2] && (variants[i]![2] || i === j))) mismatches.push(`내용 비교: ${pair}`);
      }
    }
    expect(mismatches).toEqual([]);
    // 표가 실제로 두 판정을 가른다: 같은 쌍과 다른 쌍이 모두 있다.
    expect(jsons[0] === jsons[1] && jsons[0] === jsons[2]).toBe(true);
    expect(new Set(jsons).size).toBe(5);
    expect(sameSessionProjectJson(null, null)).toBe(true);
    expect(sameSessionProjectJson(null, identities[0]!)).toBe(false);
    expect(sameSessionProjectJson(identities[0]!, null)).toBe(false);
  });

  it("조각 경계가 달라도 이어 붙인 글이 같으면 같다", () => {
    let seed = 12345;
    const random = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const cut = (text: string): string[] => {
      const out: string[] = [];
      for (let at = 0; at < text.length;) { const length = Math.floor(random() * 7); out.push(text.slice(at, at + length)); at += length; }
      return out;
    };
    const texts = ["", "a", "ab", "abc", "abd", "{\"a\":1}", "{\"a\":12}", "{\"a\":1,\"b\":[1,2,3]}", "{\"a\":1,\"b\":[1,2,4]}", "숲🌲숲", "숲🌲숩"];
    for (let round = 0; round < 200; round += 1) {
      for (const left of texts) for (const right of texts) expect(sameJsonChunks(cut(left), cut(right))).toBe(left === right);
    }
    const chunks = ["{", "\"a\":1", "}"];
    expect(sameJsonChunks(chunks, chunks)).toBe(true);
    expect(sameJsonChunks(chunks, ["{\"a\":1}"])).toBe(true);
    expect(sameJsonChunks(chunks, ["{\"a\":1", ""])).toBe(false);
  });
});

describe("세션 — 스토어 프로젝트로 만든 세션의 초안", () => {
  const config = { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 4 } satisfies ReturnType<typeof defaultAiConfig>;

  it("적용 대기 초안은 스토어의 타일셋 객체를 그대로 가리키고 글자까지 같다", () => {
    const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }) });
    const proposed = session.getProposedProject();
    expect(same(JSON.stringify(proposed), liveJson)).toBe(true);
    for (const id of Object.keys(live.tilesets)) expect(proposed.tilesets[id]).toBe(live.tilesets[id]);
    expect(proposed.maps).not.toBe(live.maps);
    // 받은 초안을 고쳐도 세션의 초안은 그대로다(타일셋 사전·맵은 따로 복제된다).
    proposed.meta.title = "받은 쪽에서 바꾼 제목";
    delete (proposed.tilesets as Record<string, unknown>)[EDITED_TILESET];
    expect(same(JSON.stringify(session.getProposedProject()), liveJson)).toBe(true);
  });

  it("스토어 밖 프로젝트로 만든 세션의 초안은 예전처럼 아무것도 공유하지 않는다", () => {
    const outside = structuredClone(live);
    const session = new AssistantSession(outside, { config, declareIntent: fixedDeclarer({ mode: "other" }) });
    const proposed = session.getProposedProject();
    expect(same(JSON.stringify(proposed), liveJson)).toBe(true);
    for (const id of Object.keys(outside.tilesets)) {
      expect(proposed.tilesets[id]).not.toBe(outside.tilesets[id]);
      expect(proposed.tilesets[id]).not.toBe(live.tilesets[id]);
    }
  });
});
