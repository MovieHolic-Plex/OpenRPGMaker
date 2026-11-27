// @vitest-environment happy-dom

import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";
import { ActionHud } from "@/player/actionHud";
import { mountHandSlotChip } from "@/player/handSlotChip";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { ACTION_CONTROL_BINDINGS, ACTION_CONTROLS_GUIDE } from "@/player/keyBindings";
import { createBattleRuntime, type BattleSnapshot } from "@/battle/runtime";
import { mountBattleScene, type BattleDomController } from "@/player/battleDom";
import { BIG_BOSS_PIXEL_CELL, battlePartyStatus, syncBattleParty, battleField, syncBattleField, applyBattlerPoseForTest } from "@/player/battleFieldDom";
import { store } from "@/project/store";
import { deserialize } from "@/project/io";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { EXTENDED_POSE_FRAME, POSE_FRAME, type BattleBattlerPose } from "@/battle/battlePose";
import { readFileSync } from "node:fs";
import type { Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";
import { BATTLE_INTRO_MS } from "@/player/battleSequencer";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { applyHopFrame, finishHop, type HopVisualScene } from "@/player/characterHopRuntime";
import { HOP_SQUASH_MS } from "@/player/characterHop";
import { createDialogueUI, type DialogueTextRequest, type DialogueUI } from "@/player/dialogue";
import { markPlayerPadKey, armDialogueConfirmRelease } from "@/player/confirmMashGuard";
import { DEFAULT_PLAYER_PREFERENCES, updatePlayerPreferences } from "@/player/playerPreferences";
import { mergeDialogueSystem, romanceDialogueSystem, type BacklogHost, type DialogueSystemPatch } from "@/project/dialogueSystem";

describe("actionHud", () => {
  isolateTimers();
  afterEach(() => document.body.replaceChildren());
  describe("action combat HUD identity", () => {
    it("ships the same attack and moving-dodge guide as the authored controls", () => {
      const host = document.createElement("div");
      const hud = new ActionHud(host);
      const guide = ACTION_CONTROLS_GUIDE.split("\n").filter((_line, index) =>
        ["attack", "dodge"].includes(ACTION_CONTROL_BINDINGS[index].id)).join("\n");

      hud.update({
        hp: 30, maxHp: 40, stamina: 80, staminaMax: 100,
        showStamina: true, skillSlotNames: [], activeSkillSlot: 0, guarding: false,
      });

      expect(host.querySelector('[data-testid="action-hud-controls"]')?.textContent).toBe(guide);
      hud.destroy();
    });

    it("renders the equipped weapon and updates it when equipment changes", () => {
      const host = document.createElement("div");
      document.body.append(host);
      const hud = new ActionHud(host);
      const model = {
        hp: 30, maxHp: 40, stamina: 80, staminaMax: 100,
        showStamina: true, skillSlotNames: [], activeSkillSlot: 0, guarding: false,
        weaponName: "Practice sword",
      };

      hud.update(model);

      expect(host.querySelector('[data-testid="action-hud-weapon"]')?.textContent).toBe(model.weaponName);
      const reequipped = { ...model, weaponName: "Iron sword" };
      hud.update(reequipped);
      expect(host.querySelector('[data-testid="action-hud-weapon"]')?.textContent).toBe("Iron sword");
      hud.destroy();
      expect(host.children).toHaveLength(0);
    });

    it("hides the farming hand chip only on action maps without farming", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const map = project.maps[session.currentMapId];
      project.system.actionCombat = { enabled: true };
      // The legacy chip only draws under the "legacy" field-HUD theme; other themes are owned by FieldHud (handSlotChip.ts).
      project.system.fieldHud = { theme: "legacy" } as typeof project.system.fieldHud;
      map.actionCombat = true;
      const host = document.createElement("div");
      const chip = mountHandSlotChip(host);

      chip?.update(project, session);

      expect(host.querySelector<HTMLElement>('[data-testid="hand-slot"]')?.hidden).toBe(true);
      map.farmableArea = [{ x: 1, y: 1, w: 2, h: 2 }];
      chip?.update(project, session);
      expect(host.querySelector<HTMLElement>('[data-testid="hand-slot"]')?.hidden).toBe(false);
      expect(host.querySelector('[data-testid="hand-slot"]')?.getAttribute("aria-label")).toBe("농사 도구");
      map.actionCombat = false;
      chip?.update(project, session);
      expect(host.querySelector<HTMLElement>('[data-testid="hand-slot"]')?.hidden).toBe(false);
      expect(host.querySelector('[data-testid="hand-slot-label"]')?.textContent).toBe("빈 손");
      chip?.destroy();
    });
  });
});

describe("battleFieldDom", () => {
  isolateTimers();
  // 큰 보스 전투 표식(battleFieldDom BIG_BOSS_PIXEL_CELL): 도트 시트 칸 128 이상인 적이 있으면 씬에 data-battle-big-boss 가 붙고
  // (_retro2003.css 가 무대 위 여백을 윗창 자리까지 줄인다), 칸 96 이하만 있는 전투는 표식이 없어 예전 그대로다.
  describe("battleBigBoss", () => {
    isolateTimers();
    const ONE_PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    let controller: BattleDomController | undefined;
    const nativeAnimate = HTMLElement.prototype.animate;
    beforeEach(() => {
      vi.useFakeTimers();
      // happy-dom 의 Web Animation 은 cancel 때 finished 를 거절해 처리되지 않은 오류를 남긴다. 표식만 보므로 끈다.
      (HTMLElement.prototype as { animate?: unknown }).animate = undefined;
    });
    afterEach(() => {
      controller?.destroy();
      controller = undefined;
      document.body.replaceChildren();
      vi.clearAllTimers();
      vi.useRealTimers();
      HTMLElement.prototype.animate = nativeAnimate;
    });
    function mountWithCell(cell: 48 | 64 | 96 | 128 | 192) {
      const project = createBlankProject();
      project.system.battleUiStyle = "retro2003";
      project.system.battleModel = "rm2k3";
      const id = `boss-${cell}`;
      project.assets.uploaded[id] = {
        id, name: `Boss ${cell}`, kind: "monster", dataUrl: ONE_PX,
        meta: { width: cell, height: cell, pixelEnemySheet: { sheetResourceId: `${id}-sheet`, cell, motion: "stomp", idleFrameMs: 300, skillCell: true } },
      };
      project.assets.uploaded[`${id}-sheet`] = {
        id: `${id}-sheet`, name: `Boss ${cell} sheet`, kind: "picture", dataUrl: ONE_PX,
        meta: { width: cell * 3, height: cell * 3, frameWidth: cell, frameHeight: cell, frames: 9 },
      };
      const enemy = project.database.enemies.find((entry) => entry.id === "enemy_stone_golem");
      const troop = project.database.troops.find((entry) => entry.id === "troop_golem_guard");
      if (!enemy || !troop) throw new Error("Missing golem fixture");
      enemy.monsterResourceId = id;
      store.replace(project);
      const host = document.createElement("div");
      document.body.append(host);
      const runtime = createBattleRuntime({ project: store.getCurrent(), troopId: troop.id, canEscape: true, canLose: false, rng: () => 0 });
      controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: false });
      const golem = controller.root.querySelector<HTMLElement>('.battle-enemy[data-record-id="enemy_stone_golem"]');
      if (!golem) throw new Error("Missing mounted golem");
      return { root: controller.root, golem };
    }
    describe("big-boss battle marker", { timeout: 60_000 }, () => {
      it("uses cell 128 as the one threshold", () => {
        expect(BIG_BOSS_PIXEL_CELL).toBe(128);
      });

      it.each([128, 192] as const)("marks the scene for a %s-cell sheet", (cell) => {
        const { root, golem } = mountWithCell(cell);
        expect(golem.dataset.pixelEnemyCell).toBe(String(cell));
        expect(root.dataset.battleBigBoss).toBe("true");
      });

      it.each([48, 64, 96] as const)("leaves a %s-cell battle unmarked", (cell) => {
        const { root, golem } = mountWithCell(cell);
        expect(golem.dataset.pixelEnemyCell).toBe(String(cell));
        expect(root.dataset.battleBigBoss).toBeUndefined();
      });
    });
  });
  describe("battleEventRepairHud", () => {
    isolateTimers();
    describe("battle event level changes reach the existing party HUD", () => {
      it("updates level and maximum HP without rebuilding the actor row", () => {
        const project = createBlankProject();
        const actor = project.database.actors[0];
        const troop = project.database.troops[0];
        if (!actor || !troop) throw new Error("Missing HUD fixture records");
        const runtime = createBattleRuntime({
          project, troopId: troop.id, canEscape: true, canLose: true, rng: () => 0.5,
          party: { partyActorIds: [actor.id], levels: { [actor.id]: 7 }, experience: {} },
        });
        const before = runtime.snapshot();
        const party = battlePartyStatus(before);
        const row = party.querySelector(".battle-actor-status");
        expect(row?.querySelector(".battle-actor-level .battle-vital-value")?.textContent?.trim()).toBe("7");
        const after = {
          ...before,
          actors: before.actors.map(entry => ({ ...entry, level: 11, maxHp: 1100, hp: 300 })),
        };
        syncBattleParty(party, after);
        expect(party.querySelector(".battle-actor-status")).toBe(row);
        expect(row?.querySelector(".battle-actor-level .battle-vital-value")?.textContent?.trim()).toBe("11");
        expect(row?.querySelector(".battle-actor-hp .battle-vital-max")?.textContent).toBe("/1100");
      });
    });
  });
  describe("battleFieldAllySprite", () => {
    isolateTimers();
    // 이 테스트가 지키는 것: **아군 스프라이트 선택 순서**.
    //
    // 후면 구도 스킨(포켓몬 등)은 여태 파티 전원에게 `bskin-ally-creature-back` 한 장을 돌려 줬다.
    // 어느 액터를 넣어도 같은 보라색 생물이 뒤통수를 보였다는 뜻이다. 2026-08-29 부터 액터별
    // 뒷모습(`generated-actor-<slug>-back`)이 있으면 그걸 먼저 쓴다.
    //
    // 순서가 네 단계라 회귀가 조용히 난다 — 액터별 뒷모습이 빠져도 공용 한 장으로 "그려지긴"
    // 하므로 렌더 성공만 보는 테스트는 통과한다. 그래서 **어느 파일이 붙었는지**를 못 박는다.

    // "rm2000"·"classic" 은 지운 정면 스킨의 저장값이다 — resolveSkinId 가 기본(retro2003)으로 푼다.
    type Skin = "pokemon" | "rm2000" | "retro2003" | "classic";
    function renderField(options: {
      readonly skin?: Skin;
      readonly battleCharacterResourceId?: string | null;
      readonly characterResourceId?: string;
      readonly characterIndex?: number;
    }): HTMLElement {
      const project = deserialize(JSON.stringify(battleFixture));
      // system.battleUiStyle 이 스킨을 정한다(resolveSkinId). 픽스처는 비어 있어 기본 스킨이다.
      (project.system as { battleUiStyle?: string }).battleUiStyle = options.skin;
      store.replace(project);
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        rng: () => 0.5,
      });
      const snapshot: BattleSnapshot = runtime.snapshot();
      const actor = snapshot.actors[0];
      expect(actor, "픽스처에 아군 배틀러가 있다").toBeTruthy();
      if (options.battleCharacterResourceId === null) {
        delete (actor as { battleCharacterResourceId?: string }).battleCharacterResourceId;
      } else if (options.battleCharacterResourceId !== undefined) {
        // 스냅샷은 타입만 readonly 인 순수 객체다. 시트 id 만 갈아 선택 경로를 태운다.
        (actor as { battleCharacterResourceId?: string }).battleCharacterResourceId =
          options.battleCharacterResourceId;
      }
      if (options.characterResourceId !== undefined) {
        (actor as { characterResourceId?: string }).characterResourceId = options.characterResourceId;
        (actor as { characterIndex?: number }).characterIndex = options.characterIndex ?? 0;
      }
      const field = battleField(snapshot);
      syncBattleField(field, snapshot);
      return field;
    }
    function allyImage(field: HTMLElement): HTMLImageElement | null {
      return field.querySelector<HTMLImageElement>(".battle-actor-group .battle-actor-image");
    }
    describe("아군 배틀러 스프라이트 선택", () => {
      it.each(["hero-01", "hero-03", "hero-06"])(
        "후면 스킨에서 %s 는 자기 뒷모습을 쓴다",
        (slug) => {
          const field = renderField({
            skin: "pokemon",
            battleCharacterResourceId: `generated-actor-${slug}-battle`,
          });

          const image = allyImage(field);
          expect(image?.getAttribute("src")).toBe(
            `/assets/generated/battle-skins/sprites/${slug}-back.png`,
          );
          const node = field.querySelector<HTMLElement>(".battle-actor-group .battle-actor");
          expect(node?.dataset.actorBackBattler).toBe("true");
          expect(node?.dataset.partyFacing).toBe("back");
        },
      );

      it("여섯 액터가 서로 다른 뒷모습을 쓴다 — 예전처럼 한 장을 돌려 쓰지 않는다", () => {
        const sources = ["hero-01", "hero-02", "hero-03", "hero-04", "hero-05", "hero-06"].map((slug) => {
          const field = renderField({
            skin: "pokemon",
            battleCharacterResourceId: `generated-actor-${slug}-battle`,
          });
          return allyImage(field)?.getAttribute("src");
        });

        expect(sources.every((src) => typeof src === "string")).toBe(true);
        expect(new Set(sources).size).toBe(6);
      });

      it("뒷모습이 없는 시트는 예전 공용 스프라이트로 떨어진다", () => {
        // 픽스처의 원래 값("hero")은 generated-actor-<slug>-battle 형식이 아니라 슬러그를 못 뽑는다.
        const field = renderField({ skin: "pokemon" });

        const image = allyImage(field);
        expect(image?.getAttribute("src")).toBe(
          "/assets/scarloxy/scarloxy-monster-mossling.png",
        );
        const node = field.querySelector<HTMLElement>(".battle-actor-group .battle-actor");
        expect(node?.dataset.actorBackBattler).toBeUndefined();
      });

      it("리졸브되지 않는 슬러그도 공용 스프라이트로 떨어진다", () => {
        // 형식은 맞지만 그림이 없는 경우. id 를 만들었다는 이유만으로 깨진 src 를 붙이면 안 된다.
        const field = renderField({
          skin: "pokemon",
          battleCharacterResourceId: "generated-actor-hero-99-battle",
        });

        const image = allyImage(field);
        expect(image?.getAttribute("src")).toBe(
          "/assets/scarloxy/scarloxy-monster-mossling.png",
        );
        const node = field.querySelector<HTMLElement>(".battle-actor-group .battle-actor");
        expect(node?.dataset.actorBackBattler).toBeUndefined();
      });

      it.each([undefined, "classic", "rm2000"] as const)(
        "기본 도트 측면 구도(%s → retro2003)는 아군을 앞모습으로 세우고 적을 유지한다",
        (skin) => {
          const field = renderField({
            skin,
            battleCharacterResourceId: "generated-actor-hero-02-battle",
          });

          const group = field.querySelector<HTMLElement>(".battle-actor-group");
          expect(group?.dataset.partyFacing).toBe("front");
          expect(group?.dataset.hidden).not.toBe("true");
          expect(field.querySelectorAll(".battle-actor").length).toBeGreaterThan(0);
          expect(field.querySelectorAll(".battle-enemy").length).toBeGreaterThan(0);
        },
      );

      it("기본 구도(미설정)에서도 파티 상태창의 이름과 HP/MP를 표시한다", () => {
        const project = deserialize(JSON.stringify(battleFixture));
        delete project.system.battleUiStyle;
        store.replace(project);
        const snapshot = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: true,
          canLose: true,
          rng: () => 0.5,
        }).snapshot();

        const party = battlePartyStatus(snapshot);

        expect(party.querySelectorAll(".battle-actor-status")).toHaveLength(snapshot.actors.length);
        for (const actor of snapshot.actors) {
          const row = party.querySelector(`[data-record-id="${actor.recordId}"]`);
          expect(row?.textContent).toContain(actor.name);
          expect(row?.querySelector(".battle-actor-hp")?.textContent).toContain(String(actor.hp));
          expect(row?.querySelector(".battle-actor-mp")?.textContent).toContain(String(actor.mp));
        }
      });

      it("명시적 측면 구도는 저작된 아군 전투 시트를 표시한다", () => {
        const field = renderField({
          skin: "retro2003",
          battleCharacterResourceId: "charset-battler-actor2-0",
        });
        const group = field.querySelector<HTMLElement>(".battle-actor-group");
        expect(group?.dataset.partyFacing).toBe("front");
        expect(group?.dataset.hidden).not.toBe("true");
        const nodes = field.querySelectorAll<HTMLElement>(".battle-actor-group .battle-actor");
        expect(nodes.length).toBeGreaterThan(0);
        const first = nodes[0]!;
        expect(first.dataset.partyFacing).toBe("front");
        expect(first.dataset.authoredBattler).toBe("true");
        expect(first.dataset.battleCharsetResourceId).toBe("charset-battler-actor2-0");
        expect(first.querySelector(".battle-actor-sprite")).not.toBeNull();
      });

      // 전투 시트도 칩 대응도 없는 걷기 칩(현대 교복 Modern1#0)은 기본 검사(charset-battler-actor1-0)가 아니라
      // 그 배우의 걷기 칩 한 칸으로 선다. 왼쪽 보기 가운데 칸: 0번 사람 = 칸 (1, 3) → 24×32 × 2배.
      it.each([
        ["전투 시트 미지정", null],
        ["걷기 칩 시트를 전투 시트로 적음", "oprn-charset-modern1"],
      ] as const)("측면 구도: 전투 시트 없는 걷기 칩 배우는 자기 걷기 칩으로 선다 (%s)", (_label, battleCharacterResourceId) => {
        const field = renderField({
          skin: "retro2003",
          battleCharacterResourceId,
          characterResourceId: "oprn-charset-modern1",
          characterIndex: 0,
        });
        const first = field.querySelector<HTMLElement>(".battle-actor-group .battle-actor")!;
        expect(first.dataset.walkChipBattler).toBe("true");
        expect(first.dataset.battleCharsetResourceId).toBe("oprn-charset-modern1");
        expect(first.dataset.battlerExtended).toBeUndefined();
        const sprite = first.querySelector<HTMLElement>(".battle-actor-sprite")!;
        expect(sprite.dataset.testid).toBe("battle-actor-walk-chip-oprn-charset-modern1-0");
        expect(sprite.style.width).toBe("48px");
        expect(sprite.style.height).toBe("64px");
        expect(sprite.style.backgroundPosition).toBe("-48px -192px");
        expect(first.dataset.battlePoseFrame).toBe("walk_chip_idle");
      });

      it("측면 구도: 걷기 칩 대응 전투 시트가 있으면 그대로 그것을 쓴다", () => {
        const field = renderField({
          skin: "retro2003",
          battleCharacterResourceId: null,
          characterResourceId: "easyrpg-charset-actor2",
          characterIndex: 0,
        });
        const first = field.querySelector<HTMLElement>(".battle-actor-group .battle-actor")!;
        expect(first.dataset.walkChipBattler).toBeUndefined();
        expect(first.dataset.battleCharsetResourceId).toBe("charset-battler-actor2-0");
      });
    });
  });
  describe("battlerPoseFrame", () => {
    isolateTimers();
    // 이 테스트가 지키는 것: **backgroundPosition 산식**.
    //
    // 왜 픽셀이 아니라 산식인가: 2026-08-29 까지 계약 테스트에는 "행 0 아래 8px 띠가 투명하다" 는
    // 가드가 있었다. 그건 런타임이 Y 를 절대 움직이지 않는다는 전제의 구조적 방어선이었고,
    // 오슬라이스 회귀(발밑에 아랫행 머리 16px 이 따라오던 증상)를 그림 쪽에서 막았다.
    // 행 1(defend/dead)을 쓰기 시작하면 그 전제가 깨져 띠 가드를 유지할 수 없다.
    // 그래서 방어선을 그림에서 **산식**으로 옮긴다 — 5포즈가 각각 정확히 어느 칸을 가리키는지
    // 문자열로 못 박으면, 열·행이 어긋나는 회귀는 여기서 즉시 걸린다.
    //
    // 96px 은 실제 값이다: BATTLE_SHEET_CELL(48) × BATTLE_ASSET_PIXEL_SCALE(2).
    const FRAME = 96;
    // 0 은 "0px" 로 쓴다 — CSSOM 이 "-0px" 를 "0px" 로 정규화해서, 음수 부호를 붙이면
    // 우리가 쓴 값과 읽히는 값이 달라진다.
    const EXPECTED: Record<BattleBattlerPose, string> = {
      idle: "0px 0px",
      attack: `-${FRAME}px 0px`,
      hit: `-${FRAME * 2}px 0px`,
      defend: `0px -${FRAME}px`,
      dead: `-${FRAME}px -${FRAME}px`,
    };
    function makeNode(): HTMLElement {
      const node = document.createElement("div");
      const sprite = document.createElement("span");
      sprite.className = "battle-actor-sprite";
      sprite.style.setProperty("--battle-sprite-frame-width", `${FRAME}px`);
      sprite.style.setProperty("--battle-sprite-frame-height", `${FRAME}px`);
      sprite.style.backgroundPosition = "0 0";
      node.append(sprite);
      return node;
    }
    describe("applyBattlerPose background position", () => {
      let node: HTMLElement;

      beforeEach(() => {
        node = makeNode();
      });

      it.each(Object.keys(POSE_FRAME) as BattleBattlerPose[])("%s 포즈가 지정된 칸을 가리킨다", (pose) => {
        applyBattlerPoseForTest(node, pose);

        const sprite = node.querySelector<HTMLElement>(".battle-actor-sprite");
        expect(sprite?.style.backgroundPosition).toBe(EXPECTED[pose]);
        expect(node.dataset.battlePose).toBe(pose);
      });

      it("defend 와 dead 가 행 1 을 쓴다 — 예전처럼 idle/hit 칸을 돌려 쓰지 않는다", () => {
        expect(POSE_FRAME.defend).not.toEqual(POSE_FRAME.idle);
        expect(POSE_FRAME.dead).not.toEqual(POSE_FRAME.hit);
        expect(POSE_FRAME.defend.row).toBe(1);
        expect(POSE_FRAME.dead.row).toBe(1);
      });

      it("다섯 포즈가 서로 다른 칸을 쓴다", () => {
        const keys = Object.values(POSE_FRAME).map((frame) => `${frame.col},${frame.row}`);
        expect(new Set(keys).size).toBe(keys.length);
      });

      // 여기까지는 산식만 잰다. 아래는 **실제 전투 필드를 렌더해서** 스냅샷의 포즈가 시트의
      // 어느 칸으로 이어지는지 본다 — 런타임 스크린샷(Playwright)이 이 환경에서 안 돌아가므로,
      // DOM 레벨에서 같은 경로를 태우는 것이 가장 강한 증거다.
      // 측면(retro2003)은 이제 생성 영웅 시트 대신 걷기 칩 전투 시트(24포즈, EXTENDED_POSE_FRAME)로 파티를 그린다
      // (charsetBattlers.resolvePartyBattleCharset: retro && generatedHero → 칩 대응). 그래서 실제 필드 렌더에서는
      // 고전 모션이 고른 칸(battlePoseFrame)이 EXTENDED_POSE_FRAME 좌표로 이어지는지 본다.
      it.each(["defend", "dead"] as const)("전투 필드 렌더에서 %s 포즈가 확장 시트의 그 칸을 가리킨다", (pose) => {
        const project = deserialize(JSON.stringify(battleFixture));
        (project.system as { battleUiStyle?: string }).battleUiStyle = "retro2003";
        store.replace(project);
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: true,
          canLose: true,
          rng: () => 0.5,
        });
        const snapshot = runtime.snapshot();
        const actor = snapshot.actors[0];
        expect(actor, "픽스처에 아군 배틀러가 있다").toBeTruthy();
        (actor as { pose: BattleBattlerPose }).pose = pose;
        // 확장 시트의 방어 칸은 스냅샷 pose 가 아니라 defending 표시에서 온다(battleRetroMotion extendedMotionPose).
        if (pose === "defend") (actor as { defending: boolean }).defending = true;

        const field = battleField(snapshot);
        const node = field.querySelector<HTMLElement>(".battle-actor-group .battle-actor");
        const sprite = field.querySelector<HTMLElement>(".battle-actor-group .battle-actor-sprite");

        expect(sprite, "아군이 전투 시트로 그려진다").toBeTruthy();
        const drawn = node?.dataset.battlePoseFrame;
        expect(drawn, "확장 시트는 그린 칸 이름을 남긴다").toBeTruthy();
        // 쓰러짐은 먼저 휘청 칸(dying)을 거쳐 dead 로 눕는다.
        expect(drawn).toBe(pose === "defend" ? "defend" : "dying");
        const frame = EXTENDED_POSE_FRAME[drawn as keyof typeof EXTENDED_POSE_FRAME];
        expect(frame).toBeTruthy();
        const offset = (value: number) => (value === 0 ? "0px" : `-${value}px`);
        expect(sprite?.style.backgroundPosition).toBe(`${offset(frame.col * FRAME)} ${offset(frame.row * FRAME)}`);
        expect(sprite?.style.backgroundSize).toBe(`${FRAME * 3}px ${FRAME * 8}px`);
      });

      it("커스텀 프로퍼티가 없으면 기본 프레임 크기로 떨어진다", () => {
        const bare = document.createElement("div");
        const sprite = document.createElement("span");
        sprite.className = "battle-actor-sprite";
        bare.append(sprite);

        applyBattlerPoseForTest(bare, "dead");

        // 기본값도 BATTLE_SHEET_CELL × BATTLE_ASSET_PIXEL_SCALE = 96 이다.
        expect(sprite.style.backgroundPosition).toBe(`-${FRAME}px -${FRAME}px`);
      });
    });
  });
  // 상태 배지 토큰 매핑 — "이미 걸린 상태가 화면에서 구별되는가" 를 지킨다.
  //
  // 두 가지 거짓 통과를 막는다.
  //   1) `state_attack_down` 은 "down" 을 품고 있어서 death 분기에 먼저 걸렸다 → 공격 하락이
  //      전투불능과 같은 붉은 KO 배지로 그려졌다.
  //   2) 능력 증감·재생은 폴백(`burst`, 회색 ●)으로 떨어져서 공격 상승/방어 상승/재생이
  //      화면에서 전부 같은 점이었다 → 스크린샷으로 아이템 효과를 증명할 수 없었다.
  describe("battleStatusBadgeToken", () => {
    isolateTimers();
    const STATUS_CSS = "src/styles/runtime/battle/03-vxace-status-nodes.css";
    function tokenFor(stateId: string): string | undefined {
      const project = deserialize(JSON.stringify(battleFixture));
      store.replace(project);
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        rng: () => 0.5,
      });
      const snapshot = runtime.snapshot();
      const enemies = snapshot.enemies.map((enemy, index) => (index === 0 ? { ...enemy, stateIds: [stateId] } : enemy));
      const node = battleField({ ...snapshot, enemies });
      return node.querySelector<HTMLElement>(".battle-enemy .battle-status-icon")?.dataset.statusIcon;
    }
    describe("전투 상태 배지 토큰", () => {
      it("능력 하락을 전투불능(KO) 배지로 그리지 않는다", () => {
        expect(tokenFor("state_attack_down")).toBe("atk-down");
        expect(tokenFor("state_defense_down")).toBe("def-down");
        expect(tokenFor("state_agility_down")).toBe("agi-down");
      });

      it("능력 상승과 재생을 서로 다른 토큰으로 가른다", () => {
        const tokens = ["state_attack_up", "state_defense_up", "state_agility_up", "state_regen"].map((id) => tokenFor(id));
        expect(tokens).toEqual(["atk-up", "def-up", "agi-up", "regen"]);
        expect(new Set(tokens).size).toBe(tokens.length);
      });

      it("기존 상태이상 토큰은 그대로 유지한다", () => {
        expect(tokenFor("state_poison")).toBe("poison");
        expect(tokenFor("state_deep_poison")).toBe("poison");
        expect(tokenFor("state_sleep")).toBe("sleep");
        expect(tokenFor("state_paralysis")).toBe("paralysis");
        expect(tokenFor("state_silence")).toBe("silence");
        expect(tokenFor("state_death")).toBe("death");
      });

      it("아군 상태는 파티 상태 행에도 배지로 남는다 — 정면 스킨(필드 노드 없음)에서도 효과가 보여야 한다", () => {
        const project = deserialize(JSON.stringify(battleFixture));
        store.replace(project);
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: true,
          canLose: true,
          rng: () => 0.5,
        });
        const snapshot = runtime.snapshot();
        const actor = snapshot.actors[0];
        const buffed = {
          ...snapshot,
          actors: snapshot.actors.map((entry, index) =>
            index === 0 ? { ...entry, stateIds: ["state_attack_up"] } : entry),
        };
        const party = battlePartyStatus(buffed);
        const row = party.querySelector<HTMLElement>(`.battle-actor-status[data-record-id="${actor.recordId}"]`);
        expect(row?.querySelector("[data-testid='battle-status-" + actor.id + "-atk-up']")).not.toBeNull();

        // 동기화 경로도 같은 계약이다 — 전투 중 상태가 새로 걸려도 배지가 갱신돼야 한다.
        const fresh = battlePartyStatus(snapshot);
        syncBattleParty(fresh, buffed);
        const freshRow = fresh.querySelector<HTMLElement>(`.battle-actor-status[data-record-id="${actor.recordId}"]`);
        expect(freshRow?.querySelector("[data-testid='battle-status-" + actor.id + "-atk-up']")).not.toBeNull();
      });

      it("필드 노드를 그리는 스킨은 상태 행에 배지를 중복으로 달지 않는다", () => {
        const project = deserialize(JSON.stringify(battleFixture));
        // retro2003 은 필드에 아군을 그리면서도 배지는 파티 창 행에 다는 예외다(battleFieldDom partyStatusRowsCarryIcons, 2026-09-29).
        // 필드 노드에만 다는 스킨은 pokemon(partyFacing "back")이다.
        project.system.battleUiStyle = "pokemon";
        store.replace(project);
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: true,
          canLose: true,
          rng: () => 0.5,
        });
        const snapshot = runtime.snapshot();
        const buffed = {
          ...snapshot,
          actors: snapshot.actors.map((entry, index) =>
            index === 0 ? { ...entry, stateIds: ["state_attack_up"] } : entry),
        };
        // 행에는 배지가 없고(중복 testid 금지), 필드 노드에만 단다.
        const party = battlePartyStatus(buffed);
        expect(party.querySelector(".battle-status-icons")).toBeNull();
        const field = battleField(buffed);
        expect(field.querySelectorAll("[data-testid$='-atk-up']")).toHaveLength(1);
      });

      it("토큰마다 글리프 CSS 규칙이 있다(빈 배지 금지)", () => {
        const css = readFileSync(STATUS_CSS, "utf8");
        const tokens = [
          "atk-up",
          "atk-down",
          "def-up",
          "def-down",
          "agi-up",
          "agi-down",
          "mag-up",
          "mag-down",
          "regen",
          "poison",
          "sleep",
          "paralysis",
          "silence",
          "death",
          "burst",
        ];
        for (const token of tokens) {
          expect(css, `${token} 배지에 ::before 글리프 규칙이 없다`).toContain(`.battle-status-icon-${token}::before`);
        }
      });
    });
  });
  describe("battleUploadedBattleCharset", () => {
    isolateTimers();
    // 이 테스트가 지키는 것: **올린 전투 캐릭터 시트(kind battleCharset)는 id 가 아니라 시트 모양으로 잘린다.**
    // 스토어 「OPRN Battlers — Party Classes」 팩의 144×384(48px 3열×8행) 시트가 번들 id 표(charsetBattler)에 없다는 이유로
    // 통짜 <img> 로 서서, 전투 화면 오른쪽에 24칸이 한꺼번에 깔리고 움직이지 않았다(2026-10-31 스토어 검증).
    const SHEET_ID = "store_party_pack__oprn-party-mage";
    function renderWith(meta: Record<string, number>, kind = "battleCharset"): HTMLElement {
      const project = deserialize(JSON.stringify(battleFixture));
      project.assets.uploaded[SHEET_ID] = {
        id: SHEET_ID, name: "마법사", kind: kind as "battleCharset",
        dataUrl: "data:image/png;base64,iVBORw0KGgo=", meta,
      };
      store.replace(project);
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 });
      const snapshot: BattleSnapshot = runtime.snapshot();
      (snapshot.actors[0] as { battleCharacterResourceId?: string }).battleCharacterResourceId = SHEET_ID;
      const field = battleField(snapshot);
      syncBattleField(field, snapshot);
      return field;
    }
    const node = (field: HTMLElement) => field.querySelector<HTMLElement>(`[data-battle-charset-resource-id="${SHEET_ID}"]`);
    describe("올린 battleCharset 시트", () => {
      it("3열×8행 시트는 칸을 잘라 24포즈 확장 시트로 선다", () => {
        const field = renderWith({ width: 144, height: 384, frameWidth: 48, frameHeight: 48, frames: 24 });
        const actor = node(field)!;
        expect(actor.dataset.battlerExtended).toBe("true");
        expect(actor.querySelector(".battle-actor-image")).toBeNull();
        const sprite = actor.querySelector<HTMLElement>(".battle-actor-sprite")!;
        expect(sprite.style.backgroundSize).toBe("288px 768px");
        // 기본 스킨(retro2003)은 도트 연출(battleRetroMotion)이 칸을 소유한다 — 의미 포즈만으로는 idle 로 서고,
        // 공격 칸은 비트(retroBeat+retroFrame), 쓰러짐 칸은 retroKo 정착 뒤에 그려진다. 그 상태를 직접 세워 칸 좌표만 잰다.
        actor.dataset.retroBeat = "impact";
        actor.dataset.retroFrame = "attack";
        applyBattlerPoseForTest(actor, "attack");
        expect(actor.dataset.battlePoseFrame).toBe("attack");
        expect(sprite.style.backgroundPosition).toBe("-96px 0px");
        delete actor.dataset.retroBeat;
        delete actor.dataset.retroFrame;
        actor.dataset.retroKo = "settled";
        applyBattlerPoseForTest(actor, "dead");
        expect(sprite.style.backgroundPosition).toBe("-96px -96px");
      });

      it("3열×2행 시트는 5포즈 시트로 잘린다(확장 아님)", () => {
        const actor = node(renderWith({ width: 144, height: 96, frameWidth: 48, frameHeight: 48 }))!;
        expect(actor.dataset.battlerExtended).toBeUndefined();
        expect(actor.querySelector<HTMLElement>(".battle-actor-sprite")?.style.backgroundSize).toBe("288px 192px");
      });

      it("칸 격자가 아닌 그림은 예전처럼 한 장으로 선다", () => {
        const actor = node(renderWith({ width: 100, height: 130 }))!;
        expect(actor.querySelector(".battle-actor-image")).not.toBeNull();
        expect(actor.querySelector(".battle-actor-sprite")).toBeNull();
      });
    });
  });
  describe("battleWeaponSheetDom", () => {
    isolateTimers();
    // 전투 중 무기를 바꿔 전투 시트가 달라지면(battleWeaponSheet.ts) 그 배우 그림만 새 시트로 다시 세운다 — 다음 자세부터 창을 든다.
    // 변신(transformResourceId)과 달리 연기 펑 연출(battle-actor-transformed)은 붙이지 않는다.
    const BASE = "charset-battler-actor1-0";
    const SPEAR = "charset-battler-actor1-0-spear";
    function snapshotWithSheet(sheet: string): BattleSnapshot {
      const project = deserialize(JSON.stringify(battleFixture));
      store.replace(project);
      const snapshot = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 }).snapshot();
      // 스냅샷은 타입만 readonly 인 순수 객체다. 시트 id 만 갈아 표시 경로를 태운다.
      (snapshot.actors[0] as { battleCharacterResourceId?: string }).battleCharacterResourceId = sheet;
      return snapshot;
    }
    function actorNodeOf(field: HTMLElement, snapshot: BattleSnapshot): HTMLElement {
      const node = field.querySelector<HTMLElement>(`[data-testid="battle-actor-${snapshot.actors[0]!.recordId}"]`);
      if (!node) throw new Error("아군 배틀러 노드가 없다");
      return node;
    }
    describe("전투 중 무기 시트 바꾸기(표시)", () => {
      it("시트가 달라진 배우만 새 그림으로 다시 세운다 — 변신 연출 없이", () => {
        const sword = snapshotWithSheet(BASE);
        const field = battleField(sword);
        syncBattleField(field, sword);
        const before = actorNodeOf(field, sword);
        expect(before.dataset.battleSheet).toBe(BASE);
        expect(before.outerHTML).toContain("actor1-0.png");
        expect(before.outerHTML).not.toContain("actor1-0-spear");

        // 같은 시트로 다시 그리면 노드를 그대로 쓴다.
        syncBattleField(field, sword);
        expect(actorNodeOf(field, sword)).toBe(before);

        const spear = snapshotWithSheet(SPEAR);
        syncBattleField(field, spear);
        const after = actorNodeOf(field, spear);
        expect(after).not.toBe(before);
        expect(after.dataset.battleSheet).toBe(SPEAR);
        expect(after.outerHTML).toContain("actor1-0-spear.png");
        expect(after.classList.contains("battle-actor-transformed")).toBe(false);
        expect(field.querySelectorAll(`[data-testid="battle-actor-${spear.actors[0]!.recordId}"]`)).toHaveLength(1);

        // 검으로 돌아오면 다시 검 시트.
        syncBattleField(field, sword);
        const back = actorNodeOf(field, sword);
        expect(back.dataset.battleSheet).toBe(BASE);
        expect(back.outerHTML).not.toContain("actor1-0-spear");
      });
    });
  });
  // 전투 HUD 의 리미트·기력·파티 게이지(#9 #16 #21). 켠 전투만 행을 만들고, 값이 바뀌면 같은 노드를 갱신한다.
  describe("mgL3BattleGaugeHud", () => {
    isolateTimers();
    function snapshotFor(configure: (project: Project) => void): BattleSnapshot {
      const project = deserialize(JSON.stringify(battleFixture));
      configure(project);
      store.replace(project);
      return createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 }).snapshot();
    }
    describe("battle HUD resource gauges", () => {
      it("renders no gauge rows for legacy projects", () => {
        const party = battlePartyStatus(snapshotFor(() => {}));
        expect(party.querySelector(".battle-resource-gauge")).toBeNull();
        expect(party.querySelector("[data-testid='battle-party-gauge']")).toBeNull();
      });

      it("renders labelled limit/resource2 meters per actor and a party gauge row, then updates them in place", () => {
        const before = snapshotFor((project) => {
          project.system.limitGauge = { enabled: true, label: "오버드라이브" };
          project.system.resource2 = { enabled: true, max: 50, start: 10 };
          project.system.partyGauge = { enabled: true, max: 80, label: "추격" };
        });
        const party = battlePartyStatus(before);
        const limit = party.querySelector<HTMLElement>("[data-testid='battle-limit-gauge-actor_hero']");
        const resource2 = party.querySelector<HTMLElement>("[data-testid='battle-resource2-gauge-actor_hero']");
        const shared = party.querySelector<HTMLElement>("[data-testid='battle-party-gauge']");
        expect(limit?.getAttribute("role")).toBe("meter");
        expect(limit?.getAttribute("aria-label")).toBe("오버드라이브");
        expect(limit?.querySelector(".battle-resource-gauge-value")?.textContent).toBe("0/100");
        expect(resource2?.getAttribute("aria-label")).toBe("기력");
        expect(resource2?.querySelector(".battle-resource-gauge-value")?.textContent).toBe("10/50");
        expect(shared?.querySelector(".battle-resource-gauge-label")?.textContent).toBe("추격");
        expect(shared?.getAttribute("aria-valuenow")).toBe("0");

        const after: BattleSnapshot = {
          ...before,
          partyGauge: 80,
          actors: before.actors.map((actor) => ({ ...actor, limitGauge: 100, resource2: 25 })),
        };
        syncBattleParty(party, after);
        expect(party.querySelector("[data-testid='battle-limit-gauge-actor_hero']")).toBe(limit);
        expect(limit?.classList.contains("is-full")).toBe(true);
        expect(limit?.querySelector<HTMLElement>(".battle-resource-gauge-bar")?.style.getPropertyValue("--battle-stat")).toBe("100%");
        expect(resource2?.getAttribute("aria-valuenow")).toBe("25");
        expect(party.querySelector("[data-testid='battle-party-gauge']")).toBe(shared);
        expect(shared?.classList.contains("is-full")).toBe(true);
        expect(party.querySelectorAll("[data-testid='battle-party-gauge']")).toHaveLength(1);
      });
    });
  });
});

// 첫 전투 진입 비용: 인트로가 있는 전투는 마운트 때 명령 화면을 먼저 그리고 숨은 버튼에 포커스를 주지 않는다.
// 실측(2026-09-28): 명령 상태로 syncView → 버튼 focus()(강제 레이아웃 약 64ms) → 곧바로 인트로로 갈아엎음.
describe("battleIntroMountCost", () => {
  isolateTimers();
  function mount(introHold: boolean) {
    const project = createScarloxyPokemonDemoProject();
    store.replace(project);
    const host = document.createElement("div");
    document.body.append(host);
    const runtime = createBattleRuntime({ project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, rng: () => 0.5 });
    const focused: string[] = [];
    const original = HTMLElement.prototype.focus;
    const spy = vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
      focused.push(this.dataset.testid ?? this.className);
      return original.call(this, options);
    });
    const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold });
    return { controller, runtime, focused, spy, host };
  }
  describe("첫 전투 마운트", () => {
    it("인트로 전투는 마운트 중 명령 버튼에 포커스를 주지 않고, 명령 국면이 되면 커서 버튼이 포커스를 갖는다", () => {
      vi.useFakeTimers();
      const { controller, runtime, focused, spy, host } = mount(true);
      try {
        expect(controller.root.dataset.battleDirectorStep).toBe("intro");
        expect(focused.filter((id) => id.startsWith("actor-command"))).toEqual([]);
        for (let i = 0; i < 10 && runtime.snapshot().phase !== "actorCommand"; i += 1) vi.advanceTimersByTime(BATTLE_INTRO_MS);
        vi.advanceTimersByTime(BATTLE_INTRO_MS);
        expect(controller.root.dataset.battleDirectorStep).toBe("command");
        const active = document.activeElement as HTMLElement | null;
        expect(active?.matches("button.battle-command[data-battle-command-cursor='true']")).toBe(true);
      } finally {
        controller.destroy();
        spy.mockRestore();
        host.remove();
        vi.useRealTimers();
      }
    });

    it("인트로 없는 전투는 마운트 즉시 명령 화면이고 커서 버튼이 포커스를 갖는다", () => {
      const { controller, spy, host } = mount(false);
      try {
        expect(controller.root.dataset.battleDirectorStep).toBe("command");
        const active = document.activeElement as HTMLElement | null;
        expect(active?.matches("button.battle-command[data-battle-command-cursor='true']")).toBe(true);
      } finally {
        controller.destroy();
        spy.mockRestore();
        host.remove();
      }
    });
  });
});

describe("characterHopChainedScale", () => {
  isolateTimers();
  type ScaleSprite = {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    readonly height: number;
    setOrigin(x: number, y: number): void;
    setScale(x: number, y: number): void;
  };
  /* 기존 통합 모의는 setScale 을 갖지 않아 applyHopScale 이 조용히 no-op 이었다. 그래서
     배율 채널 두 개(스쿼시·원근)가 출하 경로에서 전혀 검증되지 않았고, 아래 결함이 그 틈으로
     들어왔다. 이 모의는 setScale 을 실제로 기록한다. */
  function scaleSprite(): ScaleSprite {
    return {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      height: 32,
      setOrigin() {},
      setScale(x: number, y: number) { this.scaleX = x; this.scaleY = y; },
    };
  }
  function sceneWithTweens(): {
    scene: HopVisualScene;
    killed: object[];
    runPendingTween: () => void;
  } {
    const killed: object[] = [];
    let pending: (() => void) | null = null;
    const displayObject = {
      setDepth() { return this; }, setAlpha() { return this; }, setScale() { return this; },
      setPosition() { return this; }, setVisible() { return this; }, destroy() {},
      setOrigin() { return this; }, setTint() { return this; }, setBlendMode() { return this; },
    };
    const scene = {
      characterHopScales: new Map(),
      cameras: { main: { shake() {} } },
      textures: { exists: () => true, addCanvas: () => undefined },
      add: { image: () => displayObject, graphics: () => displayObject, sprite: () => displayObject },
      tweens: {
        killTweensOf(target: object) {
          killed.push(target);
          pending = null;
        },
        add(config: { targets?: unknown; onComplete?: () => void }) {
          pending = () => config.onComplete?.();
          return { stop() { pending = null; } };
        },
      },
    } as unknown as HopVisualScene;
    return { scene, killed, runPendingTween: () => pending?.() };
  }
  describe("연속 체공 배율", () => {
    /* 착지 스쿼시 트윈은 HOP_SQUASH_MS 동안 스프라이트를 눌러 두는데, 경로는 !scene.playerHop 이면
       다음 프레임에 바로 다음 체공을 시작한다. 기준 배율을 풀에서 지운 채로 두면 다음 체공이
       캐시 미스로 눌린 값을 읽어 영구 기준으로 굳고, 남은 맵 동안 캐릭터가 찌그러진다.
       트윈을 끊는 것만으로는 안 된다 — 스프라이트가 눌린 값에 그대로 머문다. */
    it("착지 눌림 중에도 기준 배율이 풀에 남아 다음 체공이 눌린 값을 기준으로 잡지 않는다", () => {
      const { scene, killed } = sceneWithTweens();
      const sprite = scaleSprite();
      const fall = { kind: "fall", liftPx: 128, durationMs: 400, impact: true } as const;

      applyHopFrame(scene, "__player", sprite as never, 0, 0, fall, 0.5);
      finishHop(scene, "__player", sprite as never, 0, 0, fall);

      const kept = scene.characterHopScales.get("__player");
      expect(kept).toEqual({ x: 1, y: 1 });

      // 다음 체공은 캐시를 맞춰 참 기준(1)을 쓰고, 살아 있던 트윈을 끊는다
      const jump = { kind: "jump", liftPx: 64, durationMs: 300, impact: true } as const;
      applyHopFrame(scene, "__player", sprite as never, 0, 0, jump, 0.5);
      expect(killed).toContain(sprite);
      expect(scene.characterHopScales.get("__player")).toEqual({ x: 1, y: 1 });
    });

    it("스쿼시 지속시간이 0 보다 커서 트윈이 착지보다 오래 산다", () => {
      expect(HOP_SQUASH_MS).toBeGreaterThan(0);
    });
  });
});

describe("confirmMashGuard", () => {
  isolateTimers();
  // 필드에서 WASD 로 걷던 플레이어가 선택지에서는 방향키만 쓸 수 있었다.
  describe("dialogueChoiceKeys", () => {
    isolateTimers();
    const session = { variables: {}, actorNames: {}, gold: 0 };
    function press(key: string): void {
      document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    }
    /** OS 자동반복으로 배달된 키. 실제 키보드는 isTrusted 지만 테스트에서는 repeat 만으로 그 자리를 잡는다. */
    function repeatKey(key: string): void {
      const event = new KeyboardEvent("keydown", { key, repeat: true, bubbles: true, cancelable: true });
      Object.defineProperty(event, "isTrusted", { value: true });
      document.dispatchEvent(event);
    }
    /** 게임패드·가상패드가 보내는 반복은 플레이어 입력 표시가 붙어 온다. */
    function padRepeatKey(key: string): void {
      document.dispatchEvent(markPlayerPadKey(new KeyboardEvent("keydown", { key, repeat: true, bubbles: true, cancelable: true })));
    }
    function selectedId(): string | null {
      return document.querySelector(".choice-btn.selected")?.getAttribute("data-testid") ?? null;
    }
    describe("choice cursor keys", () => {
      afterEach(() => {
        document.body.replaceChildren();
      });

      it("moves the cursor with WASD the same way arrow keys do, then confirms that row", async () => {
        store.replaceProject(createBlankProject());
        const host = document.createElement("div");
        document.body.append(host);
        const dialogue = createDialogueUI(host);
        const pending = dialogue.showChoices({
          options: [{ text: "숲" }, { text: "마을" }, { text: "성" }],
          playerTileY: 0,
          mapHeight: 20,
          textContext: { session, project: store.getCurrent() },
        });

        expect(selectedId()).toBe("runtime-choice-0");
        press("s");
        expect(selectedId()).toBe("runtime-choice-1");
        press("w");
        expect(selectedId()).toBe("runtime-choice-0");
        // 1e5e3ff99f: ←→(A·D)는 받지 않는다 — 패드 스틱이 대각선이면 ArrowDown 과 ArrowRight 가 한꺼번에 와서
        // 둘 다 「다음」이면 한 줄을 건너뛴다. 세로 목록은 W/S · ↑↓ 만 움직인다.
        press("d");
        expect(selectedId()).toBe("runtime-choice-0");
        press("a");
        expect(selectedId()).toBe("runtime-choice-0");
        press("W");
        expect(selectedId()).toBe("runtime-choice-2");
        press("ArrowDown");
        expect(selectedId()).toBe("runtime-choice-0");
        press("S");
        expect(selectedId()).toBe("runtime-choice-1");
        press("Enter");
        await expect(pending).resolves.toBe(1);
      });

      it("does not spin the cursor when a direction key is held down", async () => {
        store.replaceProject(createBlankProject());
        const host = document.createElement("div");
        document.body.append(host);
        const dialogue = createDialogueUI(host);
        const pending = dialogue.showChoices({
          options: [{ text: "숲" }, { text: "마을" }, { text: "성" }, { text: "항구" }],
          playerTileY: 0,
          mapHeight: 20,
          textContext: { session, project: store.getCurrent() },
        });

        expect(selectedId()).toBe("runtime-choice-0");
        press("ArrowDown");
        expect(selectedId()).toBe("runtime-choice-1");
        // 누르고 있는 동안 브라우저가 보내는 자동반복(초당 30번쯤)이 커서를 한 바퀴 돌리면 안 된다.
        // 자동반복은 33ms 간격으로 오지만 커서는 사람이 훑는 속도로만 내려간다.
        let fakeNow = performance.now();
        const clock = vi.spyOn(performance, "now").mockImplementation(() => fakeNow);
        try {
          for (const step of [33, 33, 33]) {
            fakeNow += step;
            repeatKey("ArrowDown");
          }
          expect(selectedId()).toBe("runtime-choice-1");
          fakeNow += 101; // 같은 키를 계속 누르고 있어도 사람이 훑는 간격이 지나면 한 줄 내려간다
          repeatKey("ArrowDown");
          expect(selectedId()).toBe("runtime-choice-2");
        } finally {
          clock.mockRestore();
        }
        // 커서는 두 줄 내려왔다(새 누름 1 + 간격을 넘긴 반복 1) — 결정은 그 줄을 고른다.
        press("Enter");
        await expect(pending).resolves.toBe(2);
      });

      it("still walks the list while a gamepad stick is held", async () => {
        store.replaceProject(createBlankProject());
        const host = document.createElement("div");
        document.body.append(host);
        const dialogue = createDialogueUI(host);
        const pending = dialogue.showChoices({
          options: [{ text: "숲" }, { text: "마을" }, { text: "성" }],
          playerTileY: 0,
          mapHeight: 20,
          textContext: { session, project: store.getCurrent() },
        });

        padRepeatKey("ArrowDown");
        expect(selectedId()).toBe("runtime-choice-1");
        // 스틱을 계속 밀면 한 줄씩 내려간다(누른 채로도 목록을 훑을 수 있어야 한다).
        let fakeNow = performance.now();
        const clock = vi.spyOn(performance, "now").mockImplementation(() => fakeNow);
        try {
          fakeNow += 160;
          padRepeatKey("ArrowDown");
        } finally {
          clock.mockRestore();
        }
        expect(selectedId()).toBe("runtime-choice-2");
        press("Enter");
        await expect(pending).resolves.toBe(2);
      });

      it("still confirms the highlighted row with E", async () => {
        store.replaceProject(createBlankProject());
        const host = document.createElement("div");
        document.body.append(host);
        const dialogue = createDialogueUI(host);
        const pending = dialogue.showChoices({
          options: [{ text: "숲" }, { text: "마을" }],
          playerTileY: 0,
          mapHeight: 20,
          textContext: { session, project: store.getCurrent() },
        });

        press("e");
        await expect(pending).resolves.toBe(0);
      });
    });
  });
  describe("dialogueTextCancellation", () => {
    isolateTimers();
    const ownedKeys = new Set<EventListenerOrEventListenerObject>();
    beforeEach(() => {
      vi.useFakeTimers();
      const add = document.addEventListener.bind(document);
      vi.spyOn(document, "addEventListener").mockImplementation((type, listener, options) => {
        if (type === "keydown") ownedKeys.add(listener);
        add(type, listener, options);
      });
    });
    afterEach(() => {
      // RED must not leak the broken production listener into the next scenario.
      for (const listener of ownedKeys) document.removeEventListener("keydown", listener);
      ownedKeys.clear();
      vi.clearAllTimers();
      vi.restoreAllMocks();
      vi.useRealTimers();
      window.dispatchEvent(new Event("blur"));
      document.body.replaceChildren();
    });
    function confirm(key = "Enter", { repeat = false, at = 0, release = false } = {}): void {
      const event = new KeyboardEvent(release ? "keyup" : "keydown", { key, repeat, bubbles: true, cancelable: true });
      Object.defineProperty(event, "timeStamp", { value: at });
      document.dispatchEvent(event);
    }
    function fixture() {
      const host = document.createElement("div");
      document.body.append(host);
      const dialogue = createDialogueUI(host);
      const controller = new AbortController();
      const request = { body: "Ready", playerTileY: 0, mapHeight: 20, signal: controller.signal };
      return { host, dialogue, controller, request };
    }
    describe("dialogue text cancellation", () => {
      it("abort during entry cancels the typewriter and presentation timers immediately", async () => {
        const { dialogue, controller, request, host } = fixture();
        const cancelled = expect(dialogue.showText(request)).rejects.toMatchObject({ name: "AbortError" });
        expect(vi.getTimerCount()).toBeGreaterThan(0);
        controller.abort();
        await cancelled;
        expect(host.querySelector(".dialogue-box")).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
      });

      it.each(["abort", "hide", "close", "replace"] as const)("%s settles text cancellation and detaches its listener", async mode => {
        const { host, dialogue, controller, request } = fixture();
        const results: string[] = [];
        const outcome = dialogue.showText(request).then(
          () => results.push("resolved"),
          (error: unknown) => {
            if (!(error instanceof DOMException)) throw error;
            results.push(error.name);
          },
        );
        // Flush the explicitly controlled typewriter, not an elapsed-time guess.
        await vi.runAllTimersAsync();
        if (mode === "abort") controller.abort();
        else if (mode === "hide") dialogue.hide();
        else if (mode === "close") dialogue.close();
        else {
          const replacement = dialogue.showChoices({
            options: [{ text: "First" }, { text: "Second" }], playerTileY: 0, mapHeight: 20,
          });
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
          expect(await replacement).toBe(1);
        }
        await Promise.resolve();
        expect(results, "cancelled text must reject rather than hang or accept a later key").toEqual(["AbortError"]);
        await outcome;
        await vi.runAllTimersAsync();
        expect(host.querySelector(".dialogue-box")).toBeNull();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        expect(results).toEqual(["AbortError"]);
        expect(vi.getTimerCount()).toBe(0);
      });

      it("ignores composing advance input", async () => {
        const { dialogue, request } = fixture();
        let finished = false;
        const shown = dialogue.showText(request).then(() => { finished = true; });
        await vi.runAllTimersAsync();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true }));
        confirm("Enter", { release: true });
        await Promise.resolve();
        expect(finished).toBe(false);
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await shown;
        expect(finished).toBe(true);
      });

      it("repeats at 160ms across consecutive text commands in one event", async () => {
        const { dialogue, request } = fixture();
        const first = dialogue.showText(request);
        await vi.runAllTimersAsync();
        confirm("Enter", { at: 1000 });
        await first;

        let finished = false;
        const second = dialogue.showText({ ...request, body: "Still the same event" }).then(() => { finished = true; });
        await vi.runAllTimersAsync();
        confirm("Enter", { repeat: true, at: 1159 });
        await Promise.resolve();
        expect(finished).toBe(false);
        confirm("Enter", { repeat: true, at: 1160 });
        await second;
        expect(finished).toBe(true);
      });

      it.each(["Enter", " ", "z", "e"])("requires release and a fresh %j press after a dialogue boundary", async (key) => {
        const { dialogue, request, host } = fixture();
        const before = dialogue.showText(request);
        await vi.runAllTimersAsync();
        confirm(key, { at: 1000 });
        await before;

        armDialogueConfirmRelease();
        const after = dialogue.showText({ ...request, body: "First line after the boundary" });
        await vi.runAllTimersAsync();
        confirm(key, { repeat: true, at: 2000 });
        confirm(key, { at: 2200 });
        const otherKey = key === "Enter" ? "z" : "Enter";
        confirm(otherKey, { at: 2300 });
        confirm(otherKey, { release: true, at: 2350 });
        expect(host.querySelector(".dialogue-box.page-ready .body")?.textContent).toBe("First line after the boundary");

        confirm(key, { release: true, at: 2400 });
        confirm(key, { repeat: true, at: 2600 });
        expect(host.querySelector(".dialogue-box.page-ready .body")?.textContent).toBe("First line after the boundary");
        confirm(key, { at: 2800 });
        await after;
      });

      it.each(["keyup", "blur", "same event"])("requires a fresh choice press after %s", async (handoff) => {
        const { dialogue, request, host } = fixture();
        const before = dialogue.showText(request);
        await vi.runAllTimersAsync();
        confirm();
        await before;
        if (handoff !== "same event") {
          armDialogueConfirmRelease();
          if (handoff === "blur") window.dispatchEvent(new Event("blur"));
          else confirm("Enter", { release: true });
        }

        const choice = dialogue.showChoices({
          options: [{ text: "First" }, { text: "Second" }], playerTileY: 0, mapHeight: 20,
        });
        confirm("Enter", { repeat: true, at: 1000 });
        expect(host.querySelector(".choice-btn.selected")?.textContent).toBe("First");
        if (handoff === "same event") confirm("Enter", { release: true });
        confirm("Enter", { at: 1200 });
        await expect(choice).resolves.toBe(0);
      });
    });
  });
});

// 선택 질문은 틀 본문에만 있다. 그 틀을 aria-hidden 으로 가리면 목록은 질문 없이 단추만 읽힌다.
describe("dialogueChoiceA11y", () => {
  isolateTimers();
  const session = { variables: {}, actorNames: {}, gold: 0 };
  function choiceRequest(prompt?: string) {
    return {
      ...(prompt ? { prompt } : {}),
      options: [{ text: "숲" }, { text: "마을" }],
      playerTileY: 0,
      mapHeight: 20,
      textContext: { session, project: store.getCurrent() },
    };
  }
  describe("choice prompt accessibility", () => {
    afterEach(() => {
      document.body.replaceChildren();
    });

    it("names the choice list with the question and announces that question", () => {
      store.replaceProject(createBlankProject());
      const host = document.createElement("div");
      document.body.append(host);
      const dialogue = createDialogueUI(host);
      const pending = dialogue.showChoices(choiceRequest("어디로 갈까?"));
      void pending.catch(() => undefined);

      const frame = host.querySelector<HTMLElement>("[data-testid='dialogue-choice-frame']");
      expect(frame?.getAttribute("aria-hidden")).not.toBe("true");
      const promptId = frame?.dataset.choicePromptId;
      expect(promptId).toBeTruthy();
      const prompt = document.getElementById(promptId ?? "");
      expect(prompt?.textContent).toContain("어디로 갈까?");
      expect(frame?.contains(prompt ?? null)).toBe(true);

      const list = host.querySelector("[data-testid='runtime-choices']");
      expect(list?.getAttribute("role")).toBe("listbox");
      expect(list?.getAttribute("aria-labelledby")).toBe(promptId);
      expect(list?.hasAttribute("aria-label")).toBe(false);

      const announcement = host.querySelector("[data-testid='dialogue-choice-announcement']");
      expect(announcement?.getAttribute("role")).toBe("status");
      expect(announcement?.textContent).toBe("어디로 갈까?");

      dialogue.hide();
    });

    it("hides an empty choice frame and still names the list", () => {
      store.replaceProject(createBlankProject());
      const host = document.createElement("div");
      document.body.append(host);
      const dialogue = createDialogueUI(host);
      const pending = dialogue.showChoices(choiceRequest());
      void pending.catch(() => undefined);

      const frame = host.querySelector<HTMLElement>("[data-testid='dialogue-choice-frame']");
      expect(frame?.getAttribute("aria-hidden")).toBe("true");
      expect(frame?.dataset.choicePromptId).toBeUndefined();
      expect(host.querySelector("[data-testid='runtime-choices']")?.getAttribute("aria-label")).toBe("선택");
      expect(host.querySelector("[data-testid='dialogue-choice-announcement']")).toBeNull();

      dialogue.hide();
    });

    it("moves the choice cursor with W and S as well as the arrow keys", () => {
      store.replaceProject(createBlankProject());
      const host = document.createElement("div");
      document.body.append(host);
      const dialogue = createDialogueUI(host);
      const pending = dialogue.showChoices({
        options: [{ text: "숲" }, { text: "마을" }, { text: "성" }],
        playerTileY: 0,
        mapHeight: 20,
        textContext: { session, project: store.getCurrent() },
      });
      void pending.catch(() => undefined);

      const selected = (): string | null =>
        host.querySelector("[data-testid^='runtime-choice-'].selected")?.getAttribute("data-testid") ?? null;

      const press = (key: string): void => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      };

      expect(selected()).toBe("runtime-choice-0");
      press("s");
      expect(selected()).toBe("runtime-choice-1");
      press("ArrowDown");
      expect(selected()).toBe("runtime-choice-2");
      press("w");
      expect(selected()).toBe("runtime-choice-1");
      press("W");
      expect(selected()).toBe("runtime-choice-0");
      press("ArrowUp");
      expect(selected()).toBe("runtime-choice-2");
      press("a");
      press("ArrowRight");
      expect(selected()).toBe("runtime-choice-2");

      dialogue.hide();
    });
  });
});

// 대사창 읽기 보조 동작 — 오토·스킵·숨기기·백로그와 안전 규칙을 실제 대사 UI 로 검사한다(2026-10-17).
describe("dialogueReading", () => {
  isolateTimers();
  const ownedKeys = new Set<EventListenerOrEventListenerObject>();
  let previous: Project;
  let host: HTMLElement;
  let session: BacklogHost & { variables: Record<string, number>; actorNames: Record<string, string>; gold: number };
  beforeEach(() => {
    vi.useFakeTimers();
    previous = store.getCurrent();
    const add = document.addEventListener.bind(document);
    vi.spyOn(document, "addEventListener").mockImplementation((type, listener, options) => {
      if (type === "keydown" || type === "keyup") ownedKeys.add(listener);
      add(type, listener, options);
    });
    updatePlayerPreferences({ ...DEFAULT_PLAYER_PREFERENCES, textSpeedChosen: undefined, autoSpeed: undefined, skipScope: undefined, windowOpacity: undefined });
    session = { variables: {}, actorNames: {}, gold: 0 };
    host = document.createElement("div");
    document.body.append(host);
  });
  afterEach(() => {
    for (const listener of ownedKeys) { document.removeEventListener("keydown", listener); document.removeEventListener("keyup", listener); }
    ownedKeys.clear();
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.replaceChildren();
    store.replaceProject(previous);
  });
  function useSystem(patch: DialogueSystemPatch | null): Project {
    const project = createBlankProject();
    if (patch) project.meta.oprnDialogueSystem = mergeDialogueSystem(romanceDialogueSystem(), patch);
    store.replaceProject(project);
    return project;
  }
  function ui(): DialogueUI {
    return createDialogueUI(host);
  }
  function request(dialogue: DialogueUI, body: string, extra: Partial<DialogueTextRequest> = {}): { done: () => boolean; promise: Promise<void> } {
    let finished = false;
    const promise = dialogue.showText({
      body, speaker: "하루", playerTileY: 0, mapHeight: 20, reducedMotion: true,
      textContext: { session, project: store.getCurrent() }, ...extra,
    }).then(() => { finished = true; });
    return { done: () => finished, promise };
  }
  function press(key: string, code = "", init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true, ...init });
    document.dispatchEvent(event);
    return event;
  }
  const letter = (name: "a" | "s" | "h" | "l"): KeyboardEvent => press(name, `Key${name.toUpperCase()}`);
  const stopOf = (): string | undefined => host.querySelector<HTMLElement>(".dialogue-overlay")?.dataset.readingStop;
  const settle = (ms: number) => vi.advanceTimersByTimeAsync(ms);
  describe("controls exist only for authored systems", () => {
    it("a plain project keeps the old hover button and has no tool bar, no backlog, and ignores A/S/H", async () => {
      useSystem(null);
      const dialogue = ui();
      const line = request(dialogue, "안녕");
      expect(host.querySelector('[data-testid="dialogue-bar"]')).toBeNull();
      expect(host.querySelector('[data-testid="dialogue-log-button"]')).not.toBeNull();
      letter("a"); letter("s"); letter("h");
      await settle(5000);
      expect(line.done()).toBe(false);
      expect(host.querySelector<HTMLElement>(".dialogue-overlay")?.dataset.dialogueHidden).toBeUndefined();
      expect(session.dialogueBacklog).toBeUndefined();
      press("Enter"); press("Enter");
      await line.promise;
    });

    it("an authored system draws no reading-tool buttons and no log button in the window (shortcuts still work)", async () => {
      useSystem({});
      const dialogue = ui();
      const line = request(dialogue, "안녕");
      expect(host.querySelector('[data-testid="dialogue-bar"]')).toBeNull();
      expect(host.querySelectorAll("button").length).toBe(0);
      expect(host.querySelector('[data-testid="dialogue-log-button"]')).toBeNull();
      letter("a");
      expect(dialogue.readingMode?.()).toBe("auto");
      letter("a");
      press("Enter"); press("Enter");
      await line.promise;
    });
  });
  describe("auto", () => {
    it("advances by itself after reading time once A is pressed, and stays put without it", async () => {
      useSystem({});
      const dialogue = ui();
      const idle = request(dialogue, "안녕하세요");
      await settle(6000);
      expect(idle.done()).toBe(false);
      press("Enter"); press("Enter");
      await idle.promise;
      const line = request(dialogue, "안녕하세요");
      letter("a");
      expect(dialogue.readingMode?.()).toBe("auto");
      await settle(8000);
      expect(line.done()).toBe(true);
    });

    it("waits longer for longer text", async () => {
      useSystem({});
      const dialogue = ui();
      const short = request(dialogue, "네");
      letter("a");
      await settle(1800);
      expect(short.done()).toBe(true);
      const long = request(dialogue, "아주 긴 이야기를 하고 있어요. ".repeat(3));
      await settle(1800);
      expect(long.done()).toBe(false);
      await settle(20000);
      expect(long.done()).toBe(true);
    });

    it("is stopped by a click, Enter, or Esc without advancing the line", async () => {
      useSystem({});
      const dialogue = ui();
      const line = request(dialogue, "안녕하세요");
      letter("a");
      const event = press("Escape");
      expect(event.defaultPrevented).toBe(true);
      expect(dialogue.readingMode?.()).toBe("off");
      await settle(9000);
      expect(line.done()).toBe(false);
      press("Enter"); press("Enter");
      await line.promise;
    });

    it("does not advance while the backlog is open or the tab is hidden", async () => {
      useSystem({});
      const dialogue = ui();
      const line = request(dialogue, "네");
      letter("a");
      letter("l");
      expect(host.querySelector('[data-testid="dialogue-backlog"]')).not.toBeNull();
      await settle(9000);
      expect(line.done()).toBe(false);
      press("Escape");
      expect(host.querySelector('[data-testid="dialogue-backlog"]')).toBeNull();
      press("Enter"); press("Enter");
      await line.promise;
    });
  });
  describe("skip", () => {
    it("in read-only scope stops at unread text and marks it read; a re-seen line then skips", async () => {
      useSystem({});
      const dialogue = ui();
      const first = request(dialogue, "처음 보는 글");
      letter("s");
      await settle(3000);
      expect(first.done()).toBe(false);
      expect(stopOf()).toBe("unread");
      expect(dialogue.readingMode?.()).toBe("off");
      press("Enter"); press("Enter");
      await first.promise;
      const again = request(dialogue, "처음 보는 글");
      letter("s");
      await settle(1500);
      expect(again.done()).toBe(true);
    });

    it("all scope skips unread text but never an ending epilogue", async () => {
      useSystem({ defaults: { skipScope: "all" } });
      const dialogue = ui();
      const plain = request(dialogue, "아직 안 읽은 글");
      letter("s");
      await settle(1500);
      expect(plain.done()).toBe(true);
      const ending = request(dialogue, "그리고 둘은...", { endingEpilogue: true });
      letter("s");
      await settle(8000);
      expect(ending.done()).toBe(false);
      expect(stopOf()).toBe("ending");
      press("Enter"); press("Enter");
      await ending.promise;
    });

    it("never skips a no-skip line even in the all scope", async () => {
      useSystem({ defaults: { skipScope: "all" } });
      const dialogue = ui();
      const locked = request(dialogue, "[넘기기금지]중요한 고백");
      letter("s");
      await settle(8000);
      expect(locked.done()).toBe(false);
      expect(stopOf()).toBe("locked");
      press("Enter"); press("Enter"); press("Enter");
      await locked.promise;
    });

    it("stops at choices and never picks one by itself", async () => {
      useSystem({ defaults: { skipScope: "all" } });
      const dialogue = ui();
      const line = request(dialogue, "갈래?");
      letter("s");
      await settle(1500);
      expect(line.done()).toBe(true);
      expect(dialogue.readingMode?.()).toBe("skip");
      let chosen: number | undefined;
      const choice = dialogue.showChoices({ prompt: "어떻게?", options: [{ text: "간다" }, { text: "안 간다" }], playerTileY: 0, mapHeight: 20, textContext: { session, project: store.getCurrent() } })
        .then((index) => { chosen = index; });
      expect(dialogue.readingMode?.()).toBe("off");
      expect(stopOf()).toBe("choices");
      await settle(20000);
      expect(chosen).toBeUndefined();
      press("2");
      await choice;
      expect(chosen).toBe(1);
    });

    it("stopReading(boundary) from the interpreter ends skip, and close() ends it at the end of an event", async () => {
      useSystem({ defaults: { skipScope: "all" } });
      const dialogue = ui();
      const line = request(dialogue, "한 줄");
      letter("s");
      await settle(1500);
      await line.promise;
      expect(dialogue.readingMode?.()).toBe("skip");
      dialogue.stopReading?.("boundary");
      expect(dialogue.readingMode?.()).toBe("off");
      const next = request(dialogue, "다음 줄");
      letter("s");
      await settle(1500);
      await next.promise;
      dialogue.close();
      expect(dialogue.readingMode?.()).toBe("off");
    });

    it("holding Ctrl skips only while held, and a lost keyup is recovered by the next key", async () => {
      useSystem({ defaults: { skipScope: "all" } });
      const dialogue = ui();
      const line = request(dialogue, "길게 누르면 넘어간다");
      expect(dialogue.readingMode?.()).toBe("off");
      press("Control", "ControlLeft", { ctrlKey: true });
      expect(dialogue.readingMode?.()).toBe("skip");
      document.dispatchEvent(new KeyboardEvent("keyup", { key: "Control", code: "ControlLeft" }));
      expect(dialogue.readingMode?.()).toBe("off");
      await settle(100);
      expect(line.done()).toBe(false);
      press("Control", "ControlLeft", { ctrlKey: true });
      await settle(1500);
      expect(line.done()).toBe(true);
      const next = request(dialogue, "다음");
      press("Control", "ControlLeft", { ctrlKey: true });
      expect(dialogue.readingMode?.()).toBe("skip");
      press("x", "KeyX", { ctrlKey: false });
      expect(dialogue.readingMode?.()).toBe("off");
      press("Enter"); press("Enter");
      await next.promise;
    });

    it("skip disabled by the author: S does nothing and Ctrl does nothing", async () => {
      useSystem({ skip: false });
      const dialogue = ui();
      const line = request(dialogue, "한 줄");
      letter("s");
      press("Control", "ControlLeft", { ctrlKey: true });
      expect(dialogue.readingMode?.()).toBe("off");
      await settle(5000);
      expect(line.done()).toBe(false);
      press("Enter"); press("Enter");
      await line.promise;
    });

    it("is never started for a battle event line", async () => {
      useSystem({ defaults: { skipScope: "all" } });
      const dialogue = ui();
      const line = request(dialogue, "전투 중 대사", { reading: "off" });
      expect(host.querySelector('[data-testid="dialogue-bar"]')).toBeNull();
      letter("s"); letter("a");
      expect(dialogue.readingMode?.()).toBe("off");
      await settle(8000);
      expect(line.done()).toBe(false);
      expect(session.dialogueBacklog).toBeUndefined();
      press("Enter"); press("Enter");
      await line.promise;
    });
  });
  describe("hide", () => {
    it("hides the window, swallows the first key, and restores on any key", async () => {
      useSystem({});
      const dialogue = ui();
      const line = request(dialogue, "숨겨 보자");
      const overlay = host.querySelector<HTMLElement>(".dialogue-overlay")!;
      letter("h");
      expect(overlay.dataset.dialogueHidden).toBe("1");
      const enter = press("Enter");
      expect(enter.defaultPrevented).toBe(true);
      expect(overlay.dataset.dialogueHidden).toBeUndefined();
      await settle(500);
      expect(line.done()).toBe(false);
      press("Enter"); press("Enter");
      await line.promise;
    });

    it("restores on a pointer press and never advances while hidden", async () => {
      useSystem({});
      const dialogue = ui();
      const line = request(dialogue, "숨겨 보자");
      const overlay = host.querySelector<HTMLElement>(".dialogue-overlay")!;
      letter("h");
      letter("a");
      await settle(9000);
      expect(line.done()).toBe(false);
      host.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
      expect(overlay.dataset.dialogueHidden).toBeUndefined();
      press("Enter"); press("Enter");
      await line.promise;
    });

    it("an auto-advancing line cannot be hidden", async () => {
      useSystem({});
      const dialogue = ui();
      const line = request(dialogue, "자동으로 지나간다", { autoAdvance: true });
      letter("h");
      expect(host.querySelector<HTMLElement>(".dialogue-overlay")?.dataset.dialogueHidden).toBeUndefined();
      await settle(3000);
      expect(line.done()).toBe(true);
    });
  });
  describe("backlog", () => {
    it("records lines and chosen options into the session ring buffer, and reopens them with L", async () => {
      useSystem({});
      const dialogue = ui();
      const a = request(dialogue, "첫 번째 말", { speaker: "하루" });
      press("Enter"); press("Enter");
      await a.promise;
      const picked = dialogue.showChoices({ prompt: "고르세요", options: [{ text: "예" }, { text: "아니오" }], playerTileY: 0, mapHeight: 20, textContext: { session, project: store.getCurrent() } });
      press("1");
      expect(await picked).toBe(0);
      const b = request(dialogue, "두 번째 말", { speaker: "소라" });
      expect(session.dialogueBacklog).toEqual([
        { kind: "line", text: "첫 번째 말", speaker: "하루", context: expect.any(String) },
        { kind: "choice", picked: "예", prompt: "고르세요" },
        { kind: "line", text: "두 번째 말", speaker: "소라", context: expect.any(String) },
      ]);
      const event = letter("l");
      expect(event.defaultPrevented).toBe(true);
      const view = host.querySelector('[data-testid="dialogue-backlog"]');
      expect(view?.getAttribute("data-count")).toBe("3");
      expect(view?.textContent).toContain("첫 번째 말");
      expect(view?.querySelector(".is-choice")?.textContent).toContain("예");
      // 백로그가 열린 동안 키는 글에 닿지 않는다: 결정 키는 뷰만 닫고 글은 그대로다.
      press("Enter");
      expect(b.done()).toBe(false);
      expect(host.querySelector('[data-testid="dialogue-backlog"]')).toBeNull();
      letter("l");
      expect(host.querySelector('[data-testid="dialogue-backlog"]')).not.toBeNull();
      press("Escape");
      expect(host.querySelector('[data-testid="dialogue-backlog"]')).toBeNull();
      press("Enter"); press("Enter");
      await b.promise;
    });

    it("wheel up over the window opens it and L reopens it", async () => {
      // 앞 시험이 백로그를 닫은 직후라면 휠 다시 열기 쿨다운(450ms, dialogueBacklogView.closedAt 은 모듈 상태)에 걸려 휠이 무시된다.
      // 시험이 빨라지자(#5300) 그 쿨다운 안으로 들어와 흔들렸다(run 46020355127) — 시계를 쿨다운 너머로 고정해 순서·속도에 기대지 않게 한다.
      const realNow = Date.now.bind(Date);
      const clock = vi.spyOn(Date, "now").mockImplementation(() => realNow() + 60_000);
      try {
      useSystem({});
      const dialogue = ui();
      const line = request(dialogue, "휠 시험");
      const box = host.querySelector<HTMLElement>(".dialogue-box")!;
      box.dispatchEvent(new WheelEvent("wheel", { deltaY: 40, bubbles: true, cancelable: true }));
      expect(host.querySelector('[data-testid="dialogue-backlog"]')).toBeNull();
      box.dispatchEvent(new WheelEvent("wheel", { deltaY: -40, bubbles: true, cancelable: true }));
      expect(host.querySelector('[data-testid="dialogue-backlog"]')).not.toBeNull();
      host.querySelector<HTMLElement>('[data-testid="dialogue-backlog-close"]')!.click();
      expect(host.querySelector('[data-testid="dialogue-backlog"]')).toBeNull();
      letter("l");
      expect(host.querySelector('[data-testid="dialogue-backlog"]')).not.toBeNull();
      press("Escape");
      press("Enter"); press("Enter");
      await line.promise;
      } finally {
        clock.mockRestore();
      }
    });

    it("never grows past the authored limit even over a very long session", async () => {
      useSystem({ backlogLimit: 20, defaults: { skipScope: "all" } });
      const dialogue = ui();
      for (let index = 0; index < 60; index += 1) {
        const line = request(dialogue, `줄 ${index}`);
        if (index === 0) letter("s"); // 스킵은 줄이 바뀌어도 켜져 있다
        await settle(300);
        await line.promise;
      }
      expect(session.dialogueBacklog).toHaveLength(20);
      expect((session.dialogueBacklog?.at(-1) as { text: string }).text).toBe("줄 59");
    });

    it("does not record when the author turned the backlog off", async () => {
      useSystem({ backlog: false });
      const dialogue = ui();
      const line = request(dialogue, "기록 안 함");
      expect(session.dialogueBacklog).toBeUndefined();
      press("Enter"); press("Enter");
      await line.promise;
    });
  });
});
