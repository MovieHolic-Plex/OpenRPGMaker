// 몬스터 마을 ④ 상점·센터 — 에메랄드풍 상점 열린 지갑 + 센터 회복 레시피 + place_monster_center.
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { handleShopTransaction, EMERALD_SHOP_OPEN_PURSE } from "@/player/playSceneShop";
import { createBlankProject } from "@/project/defaults";
import { MONSTER_CENTER_MAX_PARTY, DEFAULT_MONSTER_CENTER_AUDIO, monsterCenterCommands } from "@/project/monsterCenterRecipe";
import { genreLockHidesTool } from "@/project/genreLock";
import { changeItem, startSession } from "@/project/session";
import { store } from "@/project/store";
import { evalActorQueryCondition, type ActorQuerySession } from "@/project/conditionActorQueries";
import type { Command, Project } from "@/project/types";
import type { ItemRecord } from "@/project/types/database";
import type { PlaySceneContext } from "@/player/playSceneTypes";

const previous = store.getCurrent();
beforeEach(() => resetMapEditHistory());
afterEach(() => store.replaceProject(previous));

const scene = (session: ReturnType<typeof startSession>) => ({ session, syncRuntimeState: () => {} }) as unknown as PlaySceneContext;
const potion = (price: number): ItemRecord => ({ id: "item_potion", name: "회복약", price, description: "t", type: "medicine", scope: "ally", occasion: "always", consumable: true, stateEffects: [], consumptionLimit: "noLimit", usableActorIds: [], usableClassIds: [], healStateIds: [], hpRecovery: { flat: 50, percentMax: 0 }, mpRecovery: { flat: 0, percentMax: 0 }, onlyUsableInMenu: false, onlyEffectiveOnDeadActors: false, usageMessage: "normal", occasionField: true, occasionBattle: true, seedParameterBonuses: { maxHp: 0, maxMp: 0, attack: 0, defense: 0, spirit: 0, agility: 0 }, equipmentProfile: { equipable: false } }) as ItemRecord;

describe("에메랄드풍 상점 열린 지갑", () => {
  it("열린 지갑은 사실상 무한이라 소지품 여러 개를 한 번에 팔 수 있다(기본 100G 지갑이면 막혔을 수량)", () => {
    expect(EMERALD_SHOP_OPEN_PURSE).toBeGreaterThanOrEqual(1_000_000);
    const project = createBlankProject();
    const item = potion(300);
    project.database.items = [...project.database.items.filter((entry) => entry.id !== item.id), item];
    store.replaceProject(project);
    const session = startSession(project);
    changeItem(session, item.id, "+=", 9);
    const startGold = session.gold;
    const blockedByDefaultPurse = handleShopTransaction(scene(session), item, "sell", 9, 100);
    expect(blockedByDefaultPurse.ok).toBe(false);
    const open = handleShopTransaction(scene(session), item, "sell", 9, EMERALD_SHOP_OPEN_PURSE);
    expect(open.ok).toBe(true);
    expect(session.inventory[item.id] ?? 0).toBe(0);
    expect(session.gold).toBeGreaterThan(startGold);
  });
});

const flat = (commands: readonly Command[]): Command[] => commands.flatMap((command): Command[] => {
  const nested: Command[] = [];
  if (command.kind === "fork") nested.push(...flat(command.then ?? []), ...flat(command.else ?? []));
  if (command.kind === "choices") for (const option of command.options) nested.push(...flat(option.branch ?? []));
  return [command, ...nested];
});

describe("센터 회복 레시피", () => {
  it("맡길까요 예/아니오 → 맡김 → 볼 줄 → 회복 ME → 번쩍임 3번 → 전원 회복 → 센터 기록 순서다", () => {
    const commands = monsterCenterCommands({ greeting: null, checkpointLabel: "별빛 회복 센터", machineCells: [{ x: 5, y: 3 }, { x: 6, y: 3 }] });
    const choice = commands.find((command) => command.kind === "choices");
    expect(choice?.kind).toBe("choices");
    if (choice?.kind !== "choices") return;
    expect(choice.options).toHaveLength(2);
    const ritual = flat(choice.options[0]!.branch ?? []);
    const order = ritual.map((command) => command.kind);
    expect(order.indexOf("playAudio")).toBeGreaterThan(-1);
    const me = ritual.findIndex((command) => command.kind === "playAudio" && command.channel === "me");
    const recover = order.indexOf("recoverAll");
    const save = order.indexOf("checkpointSave");
    expect(me).toBeGreaterThan(-1);
    expect(recover).toBeGreaterThan(me);
    expect(save).toBeGreaterThan(recover);
    expect(ritual.filter((command) => command.kind === "m2Command" && JSON.stringify(command.fields).includes("flash"))).toHaveLength(3);
    // 볼은 파티 칸 수(최대 6)만큼 partySize 분기로 줄지어 놓인다.
    expect(ritual.filter((command) => command.kind === "fork" && command.condition?.kind === "partySize").length).toBeGreaterThanOrEqual(MONSTER_CENTER_MAX_PARTY);
    // 거절 분기에는 회복이 없다.
    expect(flat(choice.options[1]!.branch ?? []).some((command) => command.kind === "recoverAll")).toBe(false);
  });

  it("checkpointLabel 이 없으면 센터 기록을 넣지 않고, 번들 효과음 id 만 쓴다", () => {
    const all = flat(monsterCenterCommands({ greeting: null }));
    expect(all.some((command) => command.kind === "checkpointSave")).toBe(false);
    for (const command of all) if (command.kind === "playAudio") expect(command.resourceId).toMatch(/^(easyrpg-sound-|cc0-se-)/);
    expect(DEFAULT_MONSTER_CENTER_AUDIO.me).toMatch(/^easyrpg-sound-/);
  });

  it("partySize 조건은 몬스터 파티가 있으면 몬스터 수를, 없으면 파티 배우 수를 센다", () => {
    const base = { partyActorIds: ["actor_a"], actorVitals: {} } as unknown as ActorQuerySession;
    const withMonsters = { ...base, monsterParty: ["a", "b", "c"] } as ActorQuerySession;
    const cond = (value: number) => ({ kind: "partySize", op: ">=", value }) as never;
    expect(evalActorQueryCondition(withMonsters, cond(3))).toBe(true);
    expect(evalActorQueryCondition(withMonsters, cond(4))).toBe(false);
    expect(evalActorQueryCondition(base, cond(1))).toBe(true);
    expect(evalActorQueryCondition(base, cond(2))).toBe(false);
  });
});

describe("place_monster_center 도구", () => {
  const ctx = (draft: Project): ToolContext => ({ project: draft } as unknown as ToolContext);

  it("간호사 이벤트에 레시피 명령을 넣고 몬스터 수집 잠금에서도 보인다", async () => {
    expect(genreLockHidesTool({ preset: "monster-collect", mode: "enforce" } as never, "place_monster_center")).toBe(false);
    const project = createBlankProject();
    const mapId = Object.keys(project.maps)[0]!;
    // runTool 은 성공하면 context.project 를 새 사본으로 바꾼다 — 원본이 아니라 그 사본을 읽는다.
    const context = ctx(project);
    const result = await runTool(context, "place_monster_center", { mapId, x: 3, y: 3, checkpointLabel: "시험 센터", machineCells: [{ x: 2, y: 2 }] });
    expect(result.ok).toBe(true);
    const events = context.project.maps[mapId]!.events.filter((event) => JSON.stringify(event.pages).includes("recoverAll"));
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events[0]!.pages)).toContain("checkpointSave");
  });

  it("모르는 칸·맵 밖 machineCells 는 조용히 버리지 않고 거절한다", async () => {
    const project = createBlankProject();
    const mapId = Object.keys(project.maps)[0]!;
    const unknown = await runTool(ctx(project), "place_monster_center", { mapId, x: 3, y: 3, heal: true });
    expect(unknown.ok).toBe(false);
    const outside = await runTool(ctx(project), "place_monster_center", { mapId, x: 3, y: 3, machineCells: [{ x: 9999, y: 1 }] });
    expect(outside.ok).toBe(false);
  });
});
