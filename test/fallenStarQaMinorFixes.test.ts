// @vitest-environment happy-dom
// 2026-11-14 폴른 스타 QA 에서 고친 작은 엔진 결함들 — 플레이어가 읽는 글과 미리보기가 다시 어긋나지 않게 묶어 둔다.
import { afterEach, describe, expect, it } from "vitest";

import { playInn } from "@/player/playSceneCommerce";
import { itemToGoods } from "@/player/playSceneShopGoods";
import { formationDetail } from "@/player/playerFormationDetail";
import { updatePlayerPreferences } from "@/player/playerPreferences";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { listStatusMenuCommandIds } from "@/player/playerStatusMenuModel";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { recoveryPreview } from "@/player/shopPartyFit";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { listPartyBondEntries } from "@/project/partyBonds";
import { startSession } from "@/project/session";
import { store } from "@/project/store";

function innScene(gold: number): PlaySceneContext {
  store.replace(deserialize(serialize(createBlankProject())));
  const project = store.getCurrent();
  const host = document.createElement("div");
  document.body.append(host);
  const session = startSession(project, 1);
  session.gold = gold;
  return {
    session,
    map: project.maps[project.startMapId],
    tileX: 0,
    tileY: 0,
    game: { registry: { get: (key: string) => (key === "dialogueHost" ? host : undefined) } },
    syncRuntimeState() {},
    time: { delayedCall() { return { remove() {} }; } },
  } as unknown as PlaySceneContext;
}

afterEach(() => {
  document.body.replaceChildren();
  updatePlayerPreferences({ reduceMenuMotion: false });
});

describe("여관 요약(minor 15)", () => {
  it("돈이 모자라면 가진 돈과 모자란 돈을 적는다 — 「10 → 부족 G」가 아니다", async () => {
    const scene = innScene(10);
    const pending = playInn(scene, { kind: "inn", price: 30 });
    const purse = document.querySelector("[data-testid='inn-summary-gold']")?.textContent ?? "";
    expect(purse).toContain("10");
    expect(purse).toContain("20");
    expect(purse).toContain("부족");
    expect(purse).not.toContain("→");
    document.querySelector<HTMLButtonElement>("[data-testid='inn-cancel']")?.click();
    await pending;
  });

  it("돈이 넉넉하면 「가진 돈 → 남는 돈」 그대로다", async () => {
    const scene = innScene(1250);
    const pending = playInn(scene, { kind: "inn", price: 30 });
    const purse = document.querySelector("[data-testid='inn-summary-gold']")?.textContent ?? "";
    expect(purse).toContain("1,250 → 1,220");
    document.querySelector<HTMLButtonElement>("[data-testid='inn-cancel']")?.click();
    await pending;
  });

  it("이미 가득이면 「+0」을 적지 않는다", async () => {
    const scene = innScene(1250);
    const pending = playInn(scene, { kind: "inn", price: 30 });
    const hp = document.querySelector("[data-testid='inn-summary-hp']")?.textContent ?? "";
    expect(hp).not.toContain("+0");
    expect(hp).toContain("가득");
    document.querySelector<HTMLButtonElement>("[data-testid='inn-cancel']")?.click();
    await pending;
  });
});

describe("진형 도움말(minor 5)", () => {
  it("플레이어에게 하는 말이다 — 저작 용어(적 그룹 설정·기본 참전)가 없다", () => {
    const project = createBlankProject();
    project.database.actors.push({ ...structuredClone(project.database.actors[0]!), id: "qa_second", name: "둘째" });
    const session = startSession(project);
    session.partyActorIds = [session.partyActorIds[0]!, "qa_second"];
    const detail = formationDetail({ project, session, slots: [], waitModeEnabled: true, selectedCommand: "formation" as const });
    const texts = [detail.hint ?? "", ...detail.entries.map((entry) => entry.description ?? "")].join("\n");
    expect(texts).not.toContain("적 그룹");
    expect(texts).not.toContain("기본 참전");
    expect(texts).not.toMatch(/^결정:/mu);
    expect(texts).toContain("전투에 나섭니다");
  });
});

describe("기록 메뉴에 아직 없는 것(minor 2)", () => {
  it("유대 목록은 만난 동료만 — 파티에 없고 유대도 0 인 동료는 올리지 않는다", () => {
    const project = createBlankProject();
    const [first] = project.database.actors;
    project.database.actors.push({ ...structuredClone(first!), id: "qa_later", name: "나중 동료" });
    project.variables.push({ id: "var_bond_first", name: "유대 1" } as (typeof project.variables)[number], { id: "var_bond_later", name: "유대 2" } as (typeof project.variables)[number]);
    project.system.partyBonds = { members: [{ actorId: first!.id, variableId: "var_bond_first" }, { actorId: "qa_later", variableId: "var_bond_later" }] };
    const session = startSession(project);
    session.partyActorIds = [first!.id];
    expect(listPartyBondEntries(project, session).map((entry) => entry.actorId)).toEqual([first!.id]);
    // 합류하면 보인다.
    session.partyActorIds = [first!.id, "qa_later"];
    expect(listPartyBondEntries(project, session).map((entry) => entry.actorId)).toEqual([first!.id, "qa_later"]);
    // 유대를 쌓고 파티를 떠나도 남는다(「지금 파티에 없음」).
    session.variables.var_bond_later = 2;
    session.partyActorIds = [first!.id];
    const entries = listPartyBondEntries(project, session);
    expect(entries.map((entry) => entry.actorId)).toEqual([first!.id, "qa_later"]);
    expect(entries[1]).toMatchObject({ value: 2, inParty: false });
  });

  it("이야기 일지는 줄이 적힌 뒤에만 메뉴에 나온다", () => {
    const project = createBlankProject();
    project.meta.oprnStoryJournal = { version: 1, title: "이리스의 일지", writers: [{ id: "iris", name: "이리스" }] };
    const session = startSession(project);
    expect(listStatusMenuCommandIds(project, session)).not.toContain("journal");
    session.storyJournal = [{ id: "l1", writer: "iris", date: "1일", text: "별이 떨어졌다.", state: "normal" }];
    expect(listStatusMenuCommandIds(project, session)).toContain("journal");
  });
});

describe("임무 화면(minor 3)", () => {
  it("제목·상태 줄에 값 없는 꼬리표(「임무 요약」「완료한 단계 / 전체 단계」)를 달지 않는다", () => {
    const project = createBlankProject();
    project.quests = [{ kind: "graph", id: "q_graph", title: "첫 임무", summary: "숲으로 간다.", edges: [],
      nodes: [{ id: "n1", description: "숲 입구에 닿는다", completesWhen: { kind: "switch", switchId: "sw_never", value: true } }] }] as unknown as typeof project.quests;
    const session = startSession(project);
    const detail = createStatusMenuDetail({ project, session, selectedCommand: "quests", slots: [], waitModeEnabled: true });
    const summary = detail.entries.find((entry) => entry.testId === "status-menu-quest-q_graph");
    const state = detail.entries.find((entry) => entry.testId === "status-menu-quest-state-q_graph");
    expect(summary).toMatchObject({ label: "첫 임무", value: "숲으로 간다." });
    expect(summary?.description).toBeUndefined();
    expect(state?.description).toBeUndefined();
    expect(state?.value).toContain("(0/1)");
  });
});

describe("상점 회복 미리보기(쓰러진 동료)", () => {
  function fixture() {
    const project = createBlankProject();
    const item = project.database.items.find((record) => record.id === "item_potion");
    if (!item) throw new Error("missing item_potion fixture");
    Object.assign(item, { type: "medicine", scope: "ally", hpRecovery: { flat: 40, percentMax: 0 }, mpRecovery: { flat: 0, percentMax: 0 }, onlyEffectiveOnDeadActors: false });
    const session = startSession(project, 7);
    const actorId = session.partyActorIds[0]!;
    const vitals = session.actorVitals[actorId]!;
    return { project, session, item, actorId, vitals };
  }

  it("쓰러진 동료에게 보통 약은 듣지 않는다 — 「0 → 회복」을 보여 주지 않는다", () => {
    const f = fixture();
    f.vitals.hp = 0;
    const rows = recoveryPreview(f.project, f.session, itemToGoods(f.item));
    expect(rows?.[0]).toMatchObject({ actorId: f.actorId, current: 0, next: 0 });
    expect(rows?.[0]?.reason).toBeTruthy();
  });

  it("서 있는 다친 동료에게는 예전처럼 회복량을 보여 준다", () => {
    const f = fixture();
    f.vitals.hp = 1;
    const rows = recoveryPreview(f.project, f.session, itemToGoods(f.item));
    expect(rows?.[0]?.next).toBe(Math.min(f.vitals.maxHp, 41));
    expect(rows?.[0]?.reason).toBeUndefined();
  });

  it("되살리는 약은 쓰러진 동료에게만 듣는다", () => {
    const f = fixture();
    f.item.onlyEffectiveOnDeadActors = true;
    f.vitals.hp = 1;
    expect(recoveryPreview(f.project, f.session, itemToGoods(f.item))?.[0]).toMatchObject({ current: 1, next: 1 });
    f.vitals.hp = 0;
    expect(recoveryPreview(f.project, f.session, itemToGoods(f.item))?.[0]?.next).toBe(Math.min(f.vitals.maxHp, 40));
  });
});
