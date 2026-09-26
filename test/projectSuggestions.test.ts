/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { inspectProjectSuggestions, selectProjectSuggestions } from "@/ai/projectSuggestions";
import { createProjectSuggestions, type SuggestionSnapshot } from "@/editor/panels/aiProjectSuggestions";

function fixture() {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId]!;
  map.events = [{ id: "door", name: "동쪽 문", x: 2, y: 3, trigger: "action", commands: [{ kind: "transfer", mapId: "missing", x: 0, y: 0 }] }];
  return { project, mapId, projectId: "project-a", active: true } satisfies SuggestionSnapshot;
}

const ids = (snapshot: SuggestionSnapshot): string[] =>
  inspectProjectSuggestions(snapshot.project, snapshot.mapId).map((candidate) => candidate.id);
const cardIds = (root: HTMLElement): (string | undefined)[] =>
  [...root.querySelectorAll("article")].map((card) => (card as HTMLElement).dataset.suggestionId);

afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });

describe("grounded project suggestions", () => {
  it("reads without mutating and removes repaired candidates", () => {
    const s = fixture(); const before = JSON.stringify(s.project);
    const transfer = inspectProjectSuggestions(s.project, s.mapId).find(c => c.id.startsWith("transfer:"));
    expect(transfer?.title).toContain("이동");
    expect(JSON.stringify(s.project)).toBe(before);
    s.project.maps[s.mapId]!.events[0]!.commands = [];
    expect(ids(s).some(id => id.startsWith("transfer:"))).toBe(false);
  });
  it("does not recommend encounters in peaceful maps", () => {
    const s = fixture(); s.project.maps[s.mapId]!.events = [];
    s.project.maps[s.mapId]!.encounterRate = 0;
    expect(ids(s).includes("encounters")).toBe(false);
  });
  it("suggests an empty shop only when stock and service alternatives are absent", () => {
    const s = fixture();
    const event = s.project.maps[s.mapId]!.events[0]!;
    // Existing authored DB records are enough; this fixture only changes the event.
    expect(s.project.database.items.length).toBeGreaterThan(0);
    event.commands = [{ kind: "shop", itemIds: [] }];
    expect(ids(s).some(id => id.startsWith("shop:"))).toBe(true);
    event.commands = [{ kind: "shop", itemIds: [s.project.database.items[0]!.id] }];
    expect(ids(s).some(id => id.startsWith("shop:"))).toBe(false);
  });
  it("uses active page definitions, not stale root commands", () => {
    const s = fixture(); const event = s.project.maps[s.mapId]!.events[0]!;
    event.pages = [{ id: "p", trigger: "action", commands: [] }];
    expect(ids(s).some(id => id.startsWith("transfer:"))).toBe(false);
  });
  it("rejects ungrounded model output and duplicate selections", () => {
    const s = fixture(); const candidates = inspectProjectSuggestions(s.project, s.mapId);
    const id = candidates[0]!.id;
    expect(selectProjectSuggestions(JSON.stringify(["invented", id, id]), candidates)).toEqual([candidates[0]]);
    expect(selectProjectSuggestions("make a town", candidates)).toEqual([]);
  });
  it("scopes fingerprints to relevant facts", () => {
    const s = fixture();
    const transferOf = () => inspectProjectSuggestions(s.project, s.mapId).find(c => c.id.startsWith("transfer:"))!;
    const before = transferOf().fingerprint;
    s.project.maps[s.mapId]!.lowerTiles[0] = 123;
    expect(transferOf().fingerprint).toBe(before);
    s.project.maps[s.mapId]!.events[0]!.name = "서쪽 문";
    expect(transferOf().fingerprint).not.toBe(before);
  });
});

describe("authoring-journey rules (2026-09-20)", () => {
  it("offers to connect a map that no travel reaches", () => {
    // 실측 근거: 프로젝트 30개 중 12개가 이 상태였고 이전 판은 아무 말도 하지 않았다.
    const s = fixture();
    const map = s.project.maps[s.mapId]!;
    // 이동이 없는 이벤트만 있는 맵 — 나가는 transfer 도 연결도 없다.
    map.events = [{ id: "npc", name: "마을 사람", x: 1, y: 1, trigger: "action", commands: [{ kind: "text", lines: ["안녕"] }] }];
    expect(ids(s)).toContain("no-exit");
    // 문이 생기면 침묵한다 — 이미 연결된 맵에 같은 제안을 반복하면 소음이다.
    // store 는 편집마다 새 Project 객체를 만든다(구조적 공유). 링크 인덱스가 프로젝트
    // identity 로 캐시되므로, 그 계약대로 새 객체를 넘겨야 캐시가 무효화된다.
    const linked = fixture();
    const linkedMap = linked.project.maps[linked.mapId]!;
    linkedMap.events = [{ id: "out", name: "출구", x: 1, y: 1, trigger: "action", commands: [{ kind: "transfer", mapId: "other", x: 0, y: 0 }] }];
    const other = createBlankProject().maps[createBlankProject().startMapId]!;
    other.id = "other";
    linked.project.maps["other"] = other;
    expect(ids(linked)).not.toContain("no-exit");
  });
  it("reports an empty map and an inert event without inventing defects", () => {
    const s = fixture();
    s.project.maps[s.mapId]!.events = [];
    expect(ids(s)).toContain("no-events");
    s.project.maps[s.mapId]!.events = [{ id: "idle", name: "사람", x: 1, y: 1, trigger: "action", commands: [] }];
    expect(ids(s)).toContain("empty-events");
  });
  it("flags a door that lands the player on an impassable tile", () => {
    const s = fixture();
    const map = s.project.maps[s.mapId]!;
    map.lowerTiles.fill(TILE.WALL);
    // 다른 맵에서 이 맵으로 들어오는 문을 만든다 — 착지가 벽이면 나올 수 없다.
    const source = createBlankProject().maps[createBlankProject().startMapId]!;
    source.id = "hall";
    source.events = [{ id: "into", name: "안쪽 문", x: 1, y: 1, trigger: "action", commands: [{ kind: "transfer", mapId: map.id, x: 3, y: 3 }] }];
    s.project.maps["hall"] = source;
    const landing = inspectProjectSuggestions(s.project, s.mapId).find(c => c.id === "landing-impassable");
    expect(landing).toBeTruthy();
    expect(landing!.x).toBe(3);
    expect(landing!.y).toBe(3);
    // 통행 가능한 칸으로 옮기면 사라진다.
    map.lowerTiles.fill(TILE.GRASS);
    expect(ids(s)).not.toContain("landing-impassable");
  });
  it("stays silent about DB records once anything references them", () => {
    const s = fixture();
    expect(ids(s)).toContain("items-unused");
    expect(ids(s)).toContain("troops-unused");
    // 물건 하나를 상점에, 적 그룹 하나를 맵 조우에 연결하면 그 축은 침묵한다.
    const map = s.project.maps[s.mapId]!;
    map.events[0]!.commands = [{ kind: "shop", itemIds: [s.project.database.items[0]!.id] }];
    map.troopIds = [s.project.database.troops[0]!.id];
    expect(ids(s)).not.toContain("items-unused");
    expect(ids(s)).not.toContain("troops-unused");
  });
});

describe("background suggestion lifecycle", () => {
  function setup(analyze = vi.fn(async (_s: SuggestionSnapshot, c: ReturnType<typeof inspectProjectSuggestions>) => JSON.stringify(c.map(v => v.id)))) {
    vi.useFakeTimers();
    let snapshot = fixture();
    const request = vi.fn(), locate = vi.fn();
    const ui = createProjectSuggestions({ snapshot: () => snapshot, request, locate, analyze, intervalMs: 10, cooldownMs: 100 });
    document.body.append(ui.root);
    return { ui, analyze, request, locate, get: () => snapshot, set: (s: SuggestionSnapshot) => { snapshot = s; } };
  }
  const rendered = (t: ReturnType<typeof setup>): number =>
    Math.min(3, inspectProjectSuggestions(t.get().project, t.get().mapId).length);

  it("renders at most once for unchanged state and only requests work after click", async () => {
    const t = setup(); await vi.advanceTimersByTimeAsync(20);
    expect(t.ui.root.querySelectorAll("article")).toHaveLength(rendered(t));
    expect(t.request).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(t.analyze).toHaveBeenCalledTimes(1);
    [...t.ui.root.querySelectorAll("button")].find(b => b.textContent === "AI와 이어가기")!.click();
    expect(t.request).toHaveBeenCalledTimes(1); t.ui.dispose();
  });
  it("dismisses until related facts change, isolated by project", async () => {
    const t = setup(); await vi.advanceTimersByTimeAsync(20);
    const dismissed = cardIds(t.ui.root)[0]!;
    expect(dismissed).toBeTruthy();
    [...t.ui.root.querySelectorAll("button")].find(b => b.textContent === "넘기기")!.click();
    expect(cardIds(t.ui.root)).not.toContain(dismissed);
    // 무관한 편집(타일)은 그 카드의 근거를 바꾸지 않는다 — 다시 뜨면 「넘기기」가 거짓말이 된다.
    t.get().project.maps[t.get().mapId]!.lowerTiles[0] = 333;
    await vi.advanceTimersByTimeAsync(120);
    expect(cardIds(t.ui.root)).not.toContain(dismissed);
    t.set({ ...t.get(), projectId: "other-project" });
    await vi.advanceTimersByTimeAsync(20);
    expect(cardIds(t.ui.root)).toContain(dismissed); t.ui.dispose();
  });
  it("keeps map-wide findings unlocatable and point findings locatable", async () => {
    // 「위치 보기」가 (0,0) 으로 카메라를 옮기면 「가리켰다」는 거짓말이 된다 —
    // 좌표가 없는 제안(맵 전체)에는 버튼 자체가 없어야 한다.
    const t = setup(); await vi.advanceTimersByTimeAsync(20);
    const byId = (id: string) => [...t.ui.root.querySelectorAll("article")].find(c => (c as HTMLElement).dataset.suggestionId === id);
    const wide = byId("no-exit") ?? byId("items-unused");
    expect(wide).toBeTruthy();
    expect([...(wide!.querySelectorAll("button"))].map(b => b.textContent)).not.toContain("위치 보기");
    const transfer = byId("transfer:door.0");
    expect(transfer).toBeTruthy();
    expect([...(transfer!.querySelectorAll("button"))].map(b => b.textContent)).toContain("위치 보기");
    t.ui.dispose();
  });
  it("ignores delayed results after project switches and aborts on disposal", async () => {
    let resolve!: (v: string) => void; let signal: AbortSignal | undefined;
    const analyze = vi.fn((_s: SuggestionSnapshot, _c: ReturnType<typeof inspectProjectSuggestions>, abort?: AbortSignal) => { signal = abort; return new Promise<string>(r => { resolve = r; }); });
    const t = setup(analyze); await vi.advanceTimersByTimeAsync(20);
    const candidateIds = inspectProjectSuggestions(t.get().project, t.get().mapId).map(c => c.id);
    t.set({ ...t.get(), projectId: "new-project" });
    await vi.advanceTimersByTimeAsync(20);
    expect(signal?.aborted).toBe(true);
    // 늦게 도착한 이전 프로젝트의 답은 **적용되지 않는다.** 로컬 탐지 결과는 즉시 깔리므로
    // (2026-09-20 쿨다운 수정) 카드 수로는 판정할 수 없다 — 대신 그 답이 고른 후보가
    // 새 프로젝트의 정본이 되었는지 본다. 새 프로젝트에는 없는 id 를 답으로 준다.
    resolve(JSON.stringify(["transfer:stale-from-old-project"])); await vi.advanceTimersByTimeAsync(10);
    expect(cardIds(t.ui.root)).not.toContain("transfer:stale-from-old-project");
    // 새 프로젝트는 자기 차례가 되면 다시 물어본다 — 끊긴 요청이 그 프로젝트의 답을 먹지 않는다.
    await vi.advanceTimersByTimeAsync(200);
    expect(analyze).toHaveBeenCalledTimes(2);
    t.ui.dispose(); await vi.advanceTimersByTimeAsync(500);
    expect(analyze).toHaveBeenCalledTimes(2);
  });
  it("does not call AI during conversation or when paused", async () => {
    const t = setup(); t.set({ ...t.get(), active: false });
    await vi.advanceTimersByTimeAsync(100); expect(t.analyze).not.toHaveBeenCalled();
    t.set({ ...t.get(), active: true });
    [...t.ui.root.querySelectorAll("button")].find(b => b.textContent === "잠시 멈추기")!.click();
    await vi.advanceTimersByTimeAsync(100); expect(t.analyze).not.toHaveBeenCalled(); t.ui.dispose();
  });
  it("reconsiders dismissed suggestions only after relevant edits and cooldown", async () => {
    const t = setup(); await vi.advanceTimersByTimeAsync(20);
    const target = cardIds(t.ui.root)[0]!;
    [...t.ui.root.querySelectorAll("button")].find(b => b.textContent === "넘기기")!.click();
    // 이벤트 이름은 이 카드의 근거 사실이다 — 바뀌면 같은 카드가 다시 검토된다.
    t.get().project.maps[t.get().mapId]!.events[0]!.name = "바뀐 출구";
    await vi.advanceTimersByTimeAsync(30);
    expect(t.analyze).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(t.analyze).toHaveBeenCalledTimes(2);
    expect(cardIds(t.ui.root)).toContain(target);
    expect(t.ui.root.textContent).toContain("바뀐 출구"); t.ui.dispose();
  });
  it("retries after a reply arrives during a brief input pause", async () => {
    let resolve!: (value: string) => void;
    const analyze = vi.fn((_s: SuggestionSnapshot, _c: ReturnType<typeof inspectProjectSuggestions>) =>
      new Promise<string>(r => { resolve = r; }));
    const t = setup(analyze); await vi.advanceTimersByTimeAsync(10);
    t.set({ ...t.get(), active: false });
    resolve("[]"); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    t.set({ ...t.get(), active: true });
    await vi.advanceTimersByTimeAsync(120);
    expect(analyze).toHaveBeenCalledTimes(2); t.ui.dispose();
  });
  it("aborts the active request when the panel is disposed", async () => {
    let signal: AbortSignal | undefined;
    const t = setup(vi.fn((_s: SuggestionSnapshot, _c: ReturnType<typeof inspectProjectSuggestions>, abort?: AbortSignal) => {
      signal = abort; return new Promise<string>(() => {});
    }));
    await vi.advanceTimersByTimeAsync(20); t.ui.dispose();
    expect(signal?.aborted).toBe(true);
  });
  it("counts locally while the popover is closed, and only calls the model when open", async () => {
    // Break (2026-09-21 실측): 닫힌 동안 탐지까지 멈추면 배지가 빈 채로 남아, 느낌표를
    // 눌러 보기 전에는 「살펴볼 것이 있는지」를 알 수 없다 — 그 알림이 이 버튼의 존재 이유다.
    // 반대로 닫힌 채 원격 턴까지 돌리면 보이지 않는 표면을 위해 모델을 태운다.
    const t = setup(); t.set({ ...t.get(), active: false });
    await vi.advanceTimersByTimeAsync(50);
    expect(t.analyze).not.toHaveBeenCalled();
    // 닫혀 있어도 로컬 탐지·렌더·배지는 돈다.
    expect(t.ui.root.querySelectorAll("article").length).toBeGreaterThan(0);
    // 열면 같은 상태에서 모델을 한 번 부른다.
    t.set({ ...t.get(), active: true });
    await vi.advanceTimersByTimeAsync(50);
    expect(t.analyze).toHaveBeenCalledTimes(1);
    t.ui.dispose();
  });
  it("shows a truthful local fallback when the AI connection fails", async () => {
    const t = setup(vi.fn(async () => { throw Error("offline"); }));
    await vi.advanceTimersByTimeAsync(20);
    expect(t.ui.root.textContent).toContain("기본 확인 결과");
    expect(t.ui.root.querySelectorAll("article")).toHaveLength(rendered(t)); t.ui.dispose();
  });
  it("reuses local findings for an unchanged content version and rescans on a new one", async () => {
    const t = setup();
    t.set({ ...t.get(), version: "1:1" });
    await vi.advanceTimersByTimeAsync(20);
    const before = cardIds(t.ui.root);
    expect(before).toContain("transfer:door.0");
    // 같은 버전에서는 다시 훑지 않는다 — 제자리 변형은 버전 토큰 없이는 보이지 않는다.
    t.get().project.maps[t.get().mapId]!.events[0]!.commands = [];
    await vi.advanceTimersByTimeAsync(40);
    expect(cardIds(t.ui.root)).toEqual(before);
    // store 는 내용이 바뀔 때마다 버전을 올린다 — 그때는 고친 문이 카드에서 빠진다.
    t.set({ ...t.get(), version: "1:2" });
    await vi.advanceTimersByTimeAsync(20);
    expect(cardIds(t.ui.root)).not.toContain("transfer:door.0");
    t.ui.dispose();
  });
});
