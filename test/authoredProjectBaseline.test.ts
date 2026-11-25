import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import type { Project } from "@/project/types";
import { store } from "@/project/store";
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import * as history from "@/editor/mapEditHistory";
import * as commits from "@/project/projectCommitLog";

beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const edits: readonly { readonly name: string; readonly edit: (project: Project) => void }[] = [
  { name: "database", edit: project => {
    const potion = project.database.items.find(item => item.id === "item_potion");
    if (!potion) throw new Error("Missing potion fixture");
    potion.price = 9876;
  } },
  { name: "system", edit: project => { project.system.titleScreen = { ...project.system.titleScreen, title: "Manual title" }; } },
  { name: "authored start state", edit: project => { project.session.gold = 9876; } },
  { name: "world registration", edit: project => { project.world = { entities: [{ id: "npc", type: "character", name: "NPC", summary: "Manual character", origin: "user" }], relations: [] }; } },
  { name: "world relation", edit: project => { project.world = { entities: [], relations: [{ a: "npc", b: "place", kind: "locatedIn" }] }; } },
];

it.each(edits)("rejects stale $name at the shared boundary without history, commits or store mutation", async ({ name, edit }) => {
  const original = createBlankProject();
  store.replace(original);
  const baseline = new AuthoredProjectBaseline(original);
  const base = captureProposalBase(original);
  const proposed = structuredClone(original);
  proposed.meta.title = "Detached draft";
  store.update(edit);
  const live = structuredClone(store.getCurrent());
  history.resetMapEditHistory();
  const snapshot = vi.spyOn(history, "recordProjectSnapshot");
  const commit = vi.spyOn(commits, "recordProjectCommit");
  const replace = vi.spyOn(store, "replace");
  const manualBaseline = vi.spyOn(commits, "resetManualProjectCommitBaseline");
  expect(await applyProposedProject(proposed, { base, baseline, source: "agent", summary: "Detached draft", toolNames: [] }))
    .toMatchObject({ ok: false, reason: name.startsWith("world") ? "stale-baseline" : "stale-base" });
  expect(store.getCurrent()).toEqual(live);
  expect(history.getMapEditHistoryEntries()).toEqual([]);
  for (const spy of [snapshot, commit, replace, manualBaseline]) expect(spy).not.toHaveBeenCalled();
});

it("captures immutable values rather than trusting a mutable baseline Project", () => {
  const project = createBlankProject();
  const baseline = new AuthoredProjectBaseline(project);
  const original = structuredClone(project);
  project.meta.title = "Mutated original reference";
  expect(baseline.matches(project)).toBe(false);
  expect(baseline.matches(original)).toBe(true);
  expect(Object.isFrozen(baseline)).toBe(true);
});

it("keeps draft authority bounded for large documents while detecting a tail edit", () => {
  const project = createBlankProject();
  project.meta.title = "숲🌲".repeat(100_000);
  store.replace(project);
  const baseline = new AuthoredProjectBaseline(project);
  const base = captureProposalBase(project);
  // Retained authority must not contain copies of the large authored document.
  expect(JSON.stringify(baseline).length).toBeLessThan(256);
  expect(base.content.length).toBe(64);
  expect(base.world.length).toBe(64);
  expect(baseline.matches(structuredClone(project))).toBe(true);
  project.meta.title += "changed";
  expect(baseline.matches(project)).toBe(false);
});

it.each([false, true])("keeps the wiki exception explicit and does not let reset discard newer documents (reset=%s)", async resetProject => {
  const original = createBlankProject();
  store.replace(original);
  const baseline = new AuthoredProjectBaseline(original);
  const base = captureProposalBase(original);
  const proposed = structuredClone(original);
  proposed.meta.title = "Reviewed title";
  store.update(project => { project.world = { entities: [{ id: "w_wiki", type: "concept", name: "Manual wiki", summary: "Keep me", origin: "user", locked: true,
    wiki: { kind: "knowledge", basis: "explicit", sources: [{ id: "manual", kind: "manual", text: "Keep me", at: 1 }] } }], relations: [] }; });
  const world = structuredClone(store.getCurrent().world);
  history.resetMapEditHistory();
  const result = await applyProposedProject(proposed, { base, baseline, source: "agent", summary: "Title", toolNames: ["set_title_screen"], resetProject });
  expect(result.ok).toBe(!resetProject);
  expect(store.getCurrent().world?.entities).toEqual(expect.arrayContaining(world?.entities ?? []));
  // 받아들인 제안 하나 = 되돌리기 한 단계(적용 직전 스냅샷 하나). 적용은 커밋·변경 기록을 이미 남기므로 위키 쪽이 그것을 또 하나의 저작으로 적지 않는다
  // (applyProposedProject 끝 «Do not turn it into another authored document»; projectWikiApplication.test 도 적용 두 번에 기록 둘을 본다).
  // 전에는 «저작 + 위키 조정자의 관찰 영수증» 둘을 기대했는데, 그 둘째 기록은 공개 기준선(0d4f13e7c)의 제품에 이미 없었다.
  expect(history.getMapEditHistoryEntries()).toHaveLength(resetProject ? 0 : 1);
  if (!resetProject) expect(store.getCurrent().meta.title).toBe("Reviewed title");
// 한도 60초: 빈 프로젝트(수십 MB)를 만들고 통째 지문(AuthoredProjectBaseline)·통째 복제를 거친 뒤 실제 적용까지 간다. reset=false 경우가 러너에서
// 12.1~17.0초였다(ci-full 11-05~11-15 일곱 실행 12.1·12.3·12.6·13.6·15.1·15.8·16.5 · ci-vitest-files 43719165070 에서 17.0) — 기본 한도 15초를 넘나든다.
// 그 열흘 사이 커밋에 따라 늘지 않았다(러너 빠르기 차이). 단언이 고쳐진 뒤 시간 초과로 다시 떨어지지 않게 이 두 경우만 한도를 둔다.
}, 60_000);
