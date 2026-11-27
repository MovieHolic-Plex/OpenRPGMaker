import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAdvancedCommandBody } from "@/editor/panels/eventEditor/commandBodyAdvanced";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, Project, Condition, GameEvent } from "@/project/types";
import type { CommandEditContext, CommandListActions } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom, FakeNode } from "./fakeDom";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SAMPLE_MOVIE_RESOURCE, listMovieResources, resolveMovieResourceUrl } from "@/editor/panels/eventEditor/playMoviePreview";
import { conditionForm } from "@/editor/panels/eventEditor/conditionForm";
import { shouldRerenderCommandForm, commandRequiredProblems, openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { commandSchemaFor } from "@/editor/eventCommands/schema/defineCommand";
import { isolateTimers } from "./mergedTeardown";
import { rewriteLegacyAdvancedDialogueInProject } from "@/project/io/rewriteLegacyDialogue";
import { renderCoreCommandBody } from "@/editor/panels/eventEditor/commandBodyCore";
import { m2CommandById, M2_COMMAND_CATALOG, isM2CatalogEntrySelectableInMap, isM2CatalogEntrySelectableInBattleEvent, type M2CommandPickerPage } from "@/project/eventCommands/m2Catalog";
import { DEPRECATED_M2_COMMAND_IDS } from "@/project/eventCommands/m2CatalogData";
import { eventCommandPickerSearchEntries, eventCommandPickerTabEntries } from "@/editor/panels/eventEditor/commandPicker";
import { newCommand } from "@/editor/eventCommandFactory";
import { commandBranches, type NestedBranchKind } from "@/editor/tools/commandTraversal";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { startSession } from "@/project/session";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { createInterpreter } from "@/player/interpreter";
import { systemAudioOverride } from "@/player/systemAudioSlots";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { PORTRAIT_BOTTOM_NOTICE } from "@/project/dialoguePortraitPosition";
import { resetToastsForTest } from "@/util/toast";

describe("commandBodyAdvanced", () => {
  isolateTimers();
  // EV-2 리치 이벤트 명령 편집 폼 테스트.
  // - 레코드 픽커 카드(아이콘 + 이름 + 부제) 렌더
  // - 연산 세그먼트 → 숨김 select 동기화 → replaceCommand 호출
  // - 수량 스테퍼(− / +)
  // - 전/후 프리뷰(시작 인벤토리/소지금/파티 기준) 라이브 계산
  // - transfer 통행성 배지
  describe("eventEditorRichForms", () => {
    isolateTimers();
    function contextWithReplaceSpy(
      replaceCommand: CommandEditContext["actions"]["replaceCommand"] = vi.fn()
    ): CommandEditContext {
      return {
        path: [2],
        actions: {
          addCommand: vi.fn(),
          insertCommand: vi.fn(),
          replaceCommand,
          deleteCommand: vi.fn(),
          moveCommand: vi.fn(),
          moveCommandTo: vi.fn(),
        },
      };
    }
    function renderBody(context: CommandEditContext, cmd: Command): FakeElement {
      return renderWithFakeDom(() => renderAdvancedCommandBody(context, cmd) ?? document.createElement("div"));
    }
    describe("event editor rich forms", () => {
      let restoreDom: (() => void) | undefined;
      let project: Project;
      let itemId: string;
      let actorId: string;

      beforeEach(() => {
        restoreDom = installFakeDom({ animationFrames: "manual" });
        project = createBlankProject();
        const item = project.database.items[0];
        const actor = project.database.actors[0];
        if (!item || !actor) throw new Error("blank project is missing default item/actor records");
        item.name = "회복약";
        item.iconResourceId = "cc0-jetrel-potion-red";
        actor.name = "잭";
        itemId = item.id;
        actorId = actor.id;
        // 시작 상태(전/후 프리뷰 기준값).
        project.session.inventory = { [itemId]: 3 };
        project.session.gold = 100;
        project.session.partyActorIds = [actorId];
        store.replace(project);
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("renders the Change Item form with an icon card, op segments, and a before/after preview", () => {
        const body = renderBody(contextWithReplaceSpy(), { kind: "changeItem", itemId, op: "+=", amount: 2 });

        // 기존 select 는 testid/값 그대로 유지(테스트·자동화 보호).
        const select = findByTestId(body, "change-item-select");
        expect(select?.tagName).toBe("SELECT");
        expect(select?.value).toBe(itemId);
        expect(findByTestId(body, "change-item-op-select")?.value).toBe("+=");
        expect(findByTestId(body, "change-item-amount-input")?.value).toBe("2");

        // 선택 레코드 카드: 아이콘 + 이름 + 시작 보유 부제.
        const card = findByTestId(body, "change-item-select-card");
        expect(card?.textContent).toContain("회복약");
        expect(card?.textContent).toContain("시작 보유 ×3");
        expect(card?.querySelector("img")?.attrs.src).toContain("potion-red");

        // 전/후 프리뷰: 시작 인벤토리 3 + 2 = 5.
        const preview = findByTestId(body, "change-item-preview");
        expect(preview?.dataset.before).toBe("3");
        expect(preview?.dataset.after).toBe("5");
        expect(preview?.textContent).toContain("×3");
        expect(preview?.textContent).toContain("×5");
        expect(preview?.textContent).toContain("시작 인벤토리 기준");
      });

      it("changes the Change Item operation through segment buttons and keeps the hidden select in sync", () => {
        const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
        const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "changeItem", itemId, op: "+=", amount: 2 });

        const setSegment = findByTestId(body, "change-item-op-select-segment-set");
        expect(setSegment?.tagName).toBe("BUTTON");
        setSegment?.click();

        expect(findByTestId(body, "change-item-op-select")?.value).toBe("=");
        expect(setSegment?.classList.contains("selected")).toBe(true);
        expect(replaceCommand).toHaveBeenCalledWith([2], { kind: "changeItem", itemId, op: "=", amount: 2 });
        // 대입 연산 프리뷰: 3 → 2.
        expect(findByTestId(body, "change-item-preview")?.dataset.after).toBe("2");
      });

      it("steps the Change Item amount with the +/- stepper buttons and refreshes the preview", () => {
        const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
        const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "changeItem", itemId, op: "+=", amount: 2 });

        findByTestId(body, "change-item-amount-plus")?.click();

        expect(findByTestId(body, "change-item-amount-input")?.value).toBe("3");
        expect(replaceCommand).toHaveBeenCalledWith([2], { kind: "changeItem", itemId, op: "+=", amount: 3 });
        expect(findByTestId(body, "change-item-preview")?.dataset.after).toBe("6");

        findByTestId(body, "change-item-amount-minus")?.click();
        expect(findByTestId(body, "change-item-amount-input")?.value).toBe("2");
      });

      it("explains storage chest scope without exposing runtime implementation jargon", () => {
        const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
        const body = renderBody(contextWithReplaceSpy(replaceCommand), {
          kind: "openChest",
          chestId: "farm_shared_storage",
        });

        expect(findByTestId(body, "open-chest-purpose-card")?.textContent).toContain("넣고 다시 꺼낼");
        expect(findByTestId(body, "open-chest-scope-select")?.value).toBe("shared");
        expect(findByTestId(body, "open-chest-id-input")?.value).toBe("farm_shared_storage");
        expect(body.textContent).not.toContain("session.chests");

        findByTestId(body, "open-chest-scope-select-segment-local")?.click();
        expect(replaceCommand).toHaveBeenLastCalledWith([2], { kind: "openChest" });
        expect(findByTestId(body, "open-chest-shared-settings")?.dataset.active).toBe("false");

        findByTestId(body, "open-chest-scope-select-segment-shared")?.click();
        const sharedId = findByTestId(body, "open-chest-id-input");
        if (!sharedId) throw new Error("missing open-chest-id-input");
        sharedId.value = "village_warehouse";
        sharedId.dispatchEvent(new Event("input"));
        expect(replaceCommand).toHaveBeenLastCalledWith([2], {
          kind: "openChest",
          chestId: "village_warehouse",
        });
      });

      it("previews storage as a two-way bag and chest interaction", () => {
        const preview = renderWithFakeDom(() => renderCommandPreview({
          kind: "openChest",
          chestId: "farm_shared_storage",
        })) as FakeElement;

        const stage = findByTestId(preview, "open-chest-preview");
        expect(stage?.textContent).toContain("가방");
        expect(stage?.textContent).toContain("보관 상자");
        expect(stage?.textContent).toContain("넣기");
        expect(stage?.textContent).toContain("꺼내기");
        expect(stage?.textContent).toContain("여러 상자 공유");
        expect(stage?.textContent).not.toContain("session.chests");
      });

      it("authors farm template, display name, and capacity on the storage chest form", () => {
        const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
        const body = renderBody(contextWithReplaceSpy(replaceCommand), {
          kind: "openChest",
          template: "farm",
        });

        expect(findByTestId(body, "open-chest-template")?.value).toBe("farm");
        const name = findByTestId(body, "open-chest-display-name");
        if (!name) throw new Error("missing open-chest-display-name");
        name.value = "헛간";
        name.dispatchEvent(new Event("input"));
        expect(replaceCommand).toHaveBeenLastCalledWith([2], {
          kind: "openChest",
          displayName: "헛간",
          template: "farm",
        });
      });

      it("previews Change Gold against the project's starting gold with a clamped result", () => {
        const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
        const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "changeGold", op: "+=", amount: 150 });

        const preview = findByTestId(body, "change-gold-preview");
        expect(preview?.dataset.before).toBe("100");
        expect(preview?.dataset.after).toBe("250");
        expect(preview?.textContent).toContain("지금 100G");
        expect(preview?.textContent).toContain("실행 후 250G");
        expect(preview?.textContent).toContain("시작 소지금 기준");

        // 감소 세그먼트: 100 - 150 → 0 으로 클램프(런타임 changeGold 와 동일 규칙).
        findByTestId(body, "change-gold-op-select-segment-dec")?.click();
        expect(replaceCommand).toHaveBeenCalledWith([2], { kind: "changeGold", op: "-=", amount: 150 });
        expect(preview?.dataset.after).toBe("0");
      });

      it("keeps the legacy select change path working for op selects (Playwright selectOption compatibility)", () => {
        const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
        const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "changeGold", op: "+=", amount: 10 });

        const opSelect = findByTestId(body, "change-gold-op-select");
        if (!opSelect) throw new Error("missing change-gold-op-select");
        opSelect.value = "=";
        opSelect.dispatchEvent(new Event("change"));

        expect(replaceCommand).toHaveBeenCalledWith([2], { kind: "changeGold", op: "=", amount: 10 });
        expect(findByTestId(body, "change-gold-op-select-segment-set")?.classList.contains("selected")).toBe(true);
      });

      it("previews Change Party membership against the starting party", () => {
        const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
        const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "changeParty", actorId, action: "remove" });

        expect(findByTestId(body, "change-party-actor-select")?.value).toBe(actorId);
        expect(findByTestId(body, "change-party-actor-select-card")?.textContent).toContain("잭");

        const preview = findByTestId(body, "change-party-preview");
        expect(preview?.dataset.beforeIn).toBe("true");
        expect(preview?.dataset.afterIn).toBe("false");
        expect(preview?.textContent).toContain("파티에 있음");
        expect(preview?.textContent).toContain("파티에 없음");
        expect(preview?.textContent).toContain("시작 파티 기준");

        findByTestId(body, "change-party-action-select-segment-add")?.click();
        expect(replaceCommand).toHaveBeenCalledWith([2], { kind: "changeParty", actorId, action: "add" });
        expect(preview?.dataset.afterIn).toBe("true");
      });

      it("shows enemy names in the Battle Processing troop card subtitle", () => {
        const troop = project.database.troops[0];
        const enemy = project.database.enemies[0];
        if (!troop || !enemy) throw new Error("blank project is missing default troop/enemy records");
        enemy.name = "슬라임";
        troop.enemyIds = [enemy.id];
        store.replace(project);

        const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
        const body = renderBody(contextWithReplaceSpy(replaceCommand), {
          kind: "battleProcessing",
          troopId: troop.id,
          canEscape: true,
          canLose: false,
        });

        expect(findByTestId(body, "battle-processing-troop-select")?.tagName).toBe("SELECT");
        expect(findByTestId(body, "battle-processing-troop-select-card")?.textContent).toContain("슬라임");
        const escape = findByTestId(body, "battle-processing-escape-select");
        const lose = findByTestId(body, "battle-processing-lose-select");
        expect(escape?.tagName).toBe("SELECT");
        expect(escape?.value).toBe("allow");
        expect(lose?.tagName).toBe("SELECT");
        expect(lose?.value).toBe("gameover");
        if (!escape) throw new Error("missing battle-processing-escape-select");
        escape.value = "deny";
        escape.dispatchEvent(new Event("change"));
        expect(replaceCommand).toHaveBeenCalledWith([2], {
          kind: "battleProcessing",
          troopId: troop.id,
          canEscape: false,
          canLose: false,
          battleFlow: undefined,
          troopSource: undefined,
          troopVariableId: undefined,
          branchOnResult: undefined,
          victoryBranch: undefined,
          defeatBranch: undefined,
          escapeBranch: undefined,
        });
      });

      it("renders equipment icons in the Change Equipment picker card", () => {
        const equipment = project.database.equipment[0];
        if (!equipment) throw new Error("blank project is missing default equipment records");
        equipment.name = "청동검";
        equipment.iconResourceId = "cc0-jetrel-bronze-sword";
        store.replace(project);

        const body = renderBody(contextWithReplaceSpy(), {
          kind: "changeEquipment",
          actorId,
          slot: "weapon",
          equipmentId: equipment.id,
        });

        expect(findByTestId(body, "change-equipment-actor-select")?.value).toBe(actorId);
        expect(findByTestId(body, "change-equipment-slot-select")?.tagName).toBe("SELECT");
        const selected = findByTestId(body, "change-equipment-selected");
        expect(selected?.textContent).toContain("청동검");
        expect(selected?.querySelector("img")?.attrs.src).toContain("bronze-sword");
      });

      it("renders Learn Skill with record picker cards while keeping the legacy select test ids", () => {
        const skill = project.database.skills[0];
        if (!skill) throw new Error("blank project is missing default skill records");
        skill.name = "파이어";
        store.replace(project);

        const body = renderBody(contextWithReplaceSpy(), { kind: "learnSkill", actorId, skillId: skill.id });

        expect(findByTestId(body, "learn-skill-actor-select")?.value).toBe(actorId);
        expect(findByTestId(body, "learn-skill-skill-select")?.value).toBe(skill.id);
        expect(findByTestId(body, "learn-skill-skill-select-card")?.textContent).toContain("파이어");
        expect(findByTestId(body, "event-command-learn-skill-form")).toBeTruthy();
        expect(findByTestId(body, "learn-skill-action-select")).toBeTruthy();
      });

      it("flags out-of-bounds transfer destinations with a blocked passability badge", () => {
        const body = renderBody(contextWithReplaceSpy(), {
          kind: "transfer",
          mapId: project.startMapId,
          x: -1,
          y: -1,
        });

        expect(findByTestId(body, "transfer-command-summary")).not.toBeNull();
        const badge = findByTestId(body, "transfer-passability-badge");
        expect(badge?.dataset.passable).toBe("false");
        expect(badge?.textContent).toContain("통행 불가 타일!");
      });

      it("seeds an unknown transfer target to the active start map and shows passability", async () => {
        const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
        const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "transfer", mapId: "", x: 0, y: 0 });
        const badge = findByTestId(body, "transfer-passability-badge");

        expect(findByTestId(body, "transfer-command-summary")?.textContent).toContain(project.maps[project.startMapId]?.name);
        expect(badge?.dataset.passable).toBe("true");
        await Promise.resolve();
        expect(replaceCommand).toHaveBeenCalledWith([2], {
          kind: "transfer",
          mapId: project.startMapId,
          x: 0,
          y: 0,
        });
      });
    });
  });
  describe("playMovieEditorBody", () => {
    isolateTimers();
    const WEBM_DATA_URL = "data:video/webm;base64,GkXfo0AgQoaBAULygQRC";
    const MP4_DATA_URL = "data:video/mp4;base64,AAAAIGZ0eXBpc29t";
    function ctx(replaceCommand = vi.fn()): CommandEditContext {
      return {
        path: [0],
        actions: {
          addCommand: vi.fn(),
          insertCommand: vi.fn(),
          replaceCommand,
          deleteCommand: vi.fn(),
          moveCommand: vi.fn(),
          moveCommandTo: vi.fn(),
        },
      };
    }
    /**
     * 동영상 업로드는 ResourceKind 에 전용 종류가 없다(`movie` 를 넣으면 RESOURCE_SLICING 의
     * `satisfies Record<ResourceKind, …>` 가 깨진다 — 다른 레인 소유 파일).
     * 그래서 편집기는 업로드 kind 가 아니라 **미디어 타입**으로 동영상을 알아본다.
     */
    function withMovies(project: Project): Project {
      project.assets.uploaded["movie-opening"] = {
        id: "movie-opening",
        name: "오프닝 영상",
        kind: "picture",
        dataUrl: WEBM_DATA_URL,
        meta: {},
      };
      project.assets.uploaded["movie-ending"] = {
        id: "movie-ending",
        name: "엔딩 영상",
        kind: "picture",
        dataUrl: MP4_DATA_URL,
        meta: {},
      };
      project.assets.uploaded["picture-note"] = {
        id: "picture-note",
        name: "쪽지 그림",
        kind: "picture",
        dataUrl: "data:image/png;base64,iVBORw0KGgo=",
        meta: {},
      };
      return project;
    }
    function movieBody(cmd: Extract<Command, { kind: "playMovie" }>, replaceCommand = vi.fn()): FakeElement {
      return renderWithFakeDom(() => renderAdvancedCommandBody(ctx(replaceCommand), cmd)!);
    }
    function lastCommand(replaceCommand: ReturnType<typeof vi.fn>): Extract<Command, { kind: "playMovie" }> {
      return replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "playMovie" }>;
    }
    describe("playMovie 편집기 본문", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(withMovies(createBlankProject()));
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("동영상 리소스 목록은 미디어 타입이 동영상인 업로드만 담는다", () => {
        const entries = listMovieResources(store.getCurrent());

        expect(entries.map((entry) => entry.id)).toEqual(["movie-ending", "movie-opening"]);
        expect(entries.map((entry) => entry.name)).toEqual(["엔딩 영상", "오프닝 영상"]);
      });

      it("리소스 URL 은 업로드 동영상만 통과시키고 그림 데이터는 거른다", () => {
        const project = store.getCurrent();

        expect(resolveMovieResourceUrl("movie-opening", project)).toBe(WEBM_DATA_URL);
        expect(resolveMovieResourceUrl("picture-note", project)).toBeNull();
        expect(resolveMovieResourceUrl("", project)).toBeNull();
      });

      it("번들 오디오와 같은 ID의 업로드는 동영상 선택에서 제외한다", () => {
        const project = store.getCurrent();
        const id = "cc0-se-osx-wooded-box-open";
        project.assets.uploaded[id] = { id, name: "충돌 영상", kind: "movie", dataUrl: WEBM_DATA_URL, meta: {} };
        expect(listMovieResources(project).map(entry => entry.id)).toEqual(["movie-ending", "movie-opening"]);
        expect(resolveMovieResourceUrl(id, project)).toBeNull();
      });

      it("본문이 동영상 픽커와 항목을 그린다", () => {
        const body = movieBody({ kind: "playMovie", resourceId: "movie-opening" });

        expect(findByTestId(body, "play-movie-command-body")).not.toBeNull();
        const select = findByTestId(body, "play-movie-resource-select");
        expect(select).not.toBeNull();
        expect(select?.children.map((option) => option.value)).toEqual(["", "movie-ending", "movie-opening"]);
        expect(select?.value).toBe("movie-opening");
        expect(findByTestId(body, "play-movie-resource-select-card")?.textContent).toContain("오프닝 영상");
      });

      it("미리보기 표시면이 선택한 동영상을 실제 <video> 로 걸어 둔다", () => {
        const body = movieBody({ kind: "playMovie", resourceId: "movie-opening" });

        const stage = findByTestId(body, "play-movie-preview-stage");
        expect(stage).not.toBeNull();
        const video = findByTestId(body, "play-movie-preview-video");
        expect(video?.tagName).toBe("VIDEO");
        expect(video?.getAttribute("src")).toBe(WEBM_DATA_URL);
        expect(video?.getAttribute("preload")).toBe("metadata");
        expect(video?.getAttribute("controls")).not.toBeNull();
        expect(video?.getAttribute("muted")).not.toBeNull();
        expect(findByTestId(body, "play-movie-sample-note")).toBeNull();
      });

      it("리소스가 없으면 번들 샘플 클립을 재생면에 걸고 그 사실을 밝힌다", () => {
        const body = movieBody({ kind: "playMovie", resourceId: "" });

        expect(findByTestId(body, "play-movie-preview-video")?.getAttribute("src")).toBe(SAMPLE_MOVIE_RESOURCE.url);
        expect(findByTestId(body, "play-movie-sample-note")?.textContent).toContain("샘플");
      });

      it("명령에 지정된 번들 동영상은 대기 설정을 바꿔도 유지한다", () => {
        const replaceCommand = vi.fn();
        const body = movieBody({ kind: "playMovie", resourceId: SAMPLE_MOVIE_RESOURCE.id }, replaceCommand);
        const wait = findByTestId(body, "play-movie-wait-select") as FakeElement;
        wait.value = "false";
        wait.dispatchEvent(new Event("change"));

        expect(lastCommand(replaceCommand)).toMatchObject({ resourceId: SAMPLE_MOVIE_RESOURCE.id, wait: false });
        expect(findByTestId(body, "play-movie-preview-video")?.getAttribute("src")).toBe(SAMPLE_MOVIE_RESOURCE.url);
        expect(findByTestId(body, "play-movie-sample-note")).toBeNull();
      });

      it("픽커 선택이 명령의 resourceId 를 갱신한다", () => {
        const replaceCommand = vi.fn();
        const body = movieBody({ kind: "playMovie", resourceId: "movie-opening" }, replaceCommand);

        const select = findByTestId(body, "play-movie-resource-select") as FakeElement;
        select.value = "movie-ending";
        select.dispatchEvent(new Event("change"));

        // 본문은 대기·스킵을 늘 명시해 쓴다 — 생략은 런타임에서 true 다(commandCatalog playMovie `wait !== false`).
        expect(lastCommand(replaceCommand)).toEqual({ kind: "playMovie", resourceId: "movie-ending", wait: true, skippable: true });
        expect(findByTestId(body, "play-movie-preview-video")?.getAttribute("src")).toBe(MP4_DATA_URL);
      });

      it("완료 대기·스킵 허용 토글이 명령 모양에 그대로 반영된다", () => {
        const replaceCommand = vi.fn();
        // 생략한 대기·스킵은 런타임 기본값 true 로 보인다(commandCatalog playMovie `wait !== false`) — 끄는 쪽부터 누른다.
        const body = movieBody({ kind: "playMovie", resourceId: "movie-opening" }, replaceCommand);

        (findByTestId(body, "play-movie-wait-select-segment-false") as FakeElement).dispatchEvent(new Event("click"));
        expect(lastCommand(replaceCommand)).toEqual({ kind: "playMovie", resourceId: "movie-opening", wait: false, skippable: true });

        (findByTestId(body, "play-movie-skippable-select-segment-false") as FakeElement).dispatchEvent(new Event("click"));
        expect(lastCommand(replaceCommand)).toEqual({ kind: "playMovie", resourceId: "movie-opening", wait: false, skippable: false });

        (findByTestId(body, "play-movie-wait-select-segment-true") as FakeElement).dispatchEvent(new Event("click"));
        expect(lastCommand(replaceCommand)).toEqual({ kind: "playMovie", resourceId: "movie-opening", wait: true, skippable: false });
      });

      it("번들 샘플 클립 파일이 dev 서버 경로 그대로 레포에 있다", () => {
        const filePath = fileURLToPath(new URL(`../public${SAMPLE_MOVIE_RESOURCE.url}`, import.meta.url));

        expect(existsSync(filePath), `${filePath} 가 없다 — node scripts/gen-sample-movie.mjs 로 생성`).toBe(true);
      });
    });
  });
  describe("roguelikeRunEditor", () => {
    isolateTimers();
    function change(element: FakeElement | null, value: string): void {
      if (!element) throw new Error(`missing control for value ${value}`);
      element.value = value;
      element.dispatchEvent(new Event("change"));
    }
    function stagedContext(initial: Command): { context: CommandEditContext; current: () => Command } {
      let command = initial;
      const context: CommandEditContext = {
        path: [0],
        getCurrentCommand: () => command,
        actions: {
          addCommand: vi.fn(),
          insertCommand: vi.fn(),
          replaceCommand: vi.fn((_path, next) => { command = next; }),
          deleteCommand: vi.fn(),
          moveCommand: vi.fn(),
          moveCommandTo: vi.fn(),
        },
      };
      return { context, current: () => command };
    }
    describe("roguelike run event authoring", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => { restoreDom = installFakeDom(); });
      afterEach(() => { restoreDom?.(); });

      it("authors a run floor condition without raw JSON", () => {
        let current: Condition = { kind: "run", query: "floor", op: ">=", value: 3 };
        const body = renderWithFakeDom(() => conditionForm(current, (next) => { current = next; }));

        expect(findByTestId(body, "event-condition-run-query")?.value).toBe("floor");
        change(findByTestId(body, "event-condition-run-floor-op"), ">");
        change(findByTestId(body, "event-condition-run-floor-value"), "7");

        expect(current).toEqual({ kind: "run", query: "floor", op: ">", value: 7 });
      });

      it("keeps consecutive run flag edits on the latest staged command", () => {
        const initial: Command = { kind: "runControl", action: "setFlag", flag: "door", value: false };
        const staged = stagedContext(initial);
        const body = renderWithFakeDom(() => renderAdvancedCommandBody(staged.context, initial)!);

        change(findByTestId(body, "event-command-run-flag"), "bossDoor");
        change(findByTestId(body, "event-command-run-flag-value"), "true");

        expect(staged.current()).toEqual({ kind: "runControl", action: "setFlag", flag: "bossDoor", value: true });
      });

      it("rerenders the command editor when the run action changes shape", () => {
        expect(shouldRerenderCommandForm(
          { kind: "runControl", action: "start" },
          { kind: "runControl", action: "advance", amount: 1 },
        )).toBe(true);
      });

      it("registers runControl in the native command schema catalog", () => {
        expect(commandSchemaFor("runControl")?.family).toBe("system");
      });
    });
  });
});

describe("commandBodyCore", () => {
  isolateTimers();
  describe("advancedDialogueMerge", () => {
    isolateTimers();
    function legacyDialogue(marker: string): Extract<Command, { kind: "m2Command" }> {
      return {
        kind: "m2Command",
        commandId: "m2-209-advanced-dialogue",
        fields: {
          speaker: `speaker:${marker}`,
          body: `body:${marker}`,
          emotion: `emotion:${marker}`,
          autoAdvance: true,
        },
      };
    }
    function branchContainers(): Record<NestedBranchKind, Command> {
      const commands: Record<NestedBranchKind, Command> = {
        choiceOption: { kind: "choices", options: [{ text: "option", branch: [] }] },
        choiceCancel: { kind: "choices", options: [], cancelBranch: [] },
        presentOption: { kind: "presentItem", options: [{ itemId: "item-1", branch: [] }] },
        presentOtherwise: { kind: "presentItem", options: [], otherwiseBranch: [] },
        presentCancel: { kind: "presentItem", options: [], cancelBranch: [] },
        forkThen: { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [] },
        forkElse: { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [], else: [] },
        loopBody: { kind: "loop", body: [] },
        shopTransaction: { kind: "shop", itemIds: [], transactionBranch: [] },
        shopFailure: { kind: "shop", itemIds: [], failedTransactionBranch: [] },
        innNotEnough: { kind: "inn", price: 1, notEnoughBranch: [] },
        promotionSuccess: { kind: "promoteActor", actorId: "actor-1", successBranch: [] },
        promotionFailure: { kind: "promoteActor", actorId: "actor-1", failureBranch: [] },
        evolutionSuccess: { kind: "evolveMonster", instanceId: "monster-1", successBranch: [] },
        evolutionFailure: { kind: "evolveMonster", instanceId: "monster-1", failureBranch: [] },
        battleVictory: {
          kind: "battleProcessing", troopId: "troop-1", canEscape: true, canLose: true, victoryBranch: [],
        },
        battleDefeat: {
          kind: "battleProcessing", troopId: "troop-1", canEscape: true, canLose: true, defeatBranch: [],
        },
        battleEscape: {
          kind: "battleProcessing", troopId: "troop-1", canEscape: true, canLose: true, escapeBranch: [],
        },
      };
      for (const [kind, command] of Object.entries(commands) as [NestedBranchKind, Command][]) {
        const branch = commandBranches(command).find((candidate) => candidate.kind === kind);
        if (!branch) throw new Error(`commandBranches did not expose ${kind}`);
        (branch.commands as Command[]).push(legacyDialogue(kind));
      }
      return commands;
    }
    function expectLegacyDialogueRewritten(commands: readonly Command[], location: string): void {
      const remaining = commands.filter(
        (command) => command.kind === "m2Command" && command.commandId === "m2-209-advanced-dialogue",
      );
      expect(remaining, `${location}: legacy m2-209 remained`).toHaveLength(0);
      expect(commands, `${location}: text rewrite did not preserve legacy fields`).toContainEqual({
        kind: "text",
        speaker: `speaker:${location}`,
        body: `body:${location}`,
        emotion: `emotion:${location}`,
        autoAdvance: true,
      });
    }
    function ctx(replaceCommand = vi.fn()): CommandEditContext {
      return {
        path: [0],
        actions: {
          addCommand: vi.fn(),
          insertCommand: vi.fn(),
          replaceCommand,
          deleteCommand: vi.fn(),
          moveCommand: vi.fn(),
          moveCommandTo: vi.fn(),
        },
      };
    }
    describe("advanced dialogue merged into text", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("maps Advanced Dialogue catalog entry to native text kind", () => {
        const entry = m2CommandById("m2-209-advanced-dialogue");
        expect(entry?.existingKind).toBe("text");
        expect(entry?.bodyStrategy).toBe("existing");
      });

      it("rewrites legacy m2-209 commands into text with emotion/autoAdvance", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        const event: GameEvent = {
          id: "ev_dialogue",
          x: 2,
          y: 2,
          pages: [
            {
              id: "p1",
              name: "",
              conditions: [],
              commands: [
                {
                  kind: "m2Command",
                  commandId: "m2-209-advanced-dialogue",
                  fields: {
                    speaker: "미나",
                    portraitId: "face_mina",
                    emotion: "happy",
                    body: "숲으로 가자.",
                    autoAdvance: true,
                  },
                },
              ],
              graphic: { transparent: true },
              trigger: { kind: "action" },
              priority: "same",
              movement: { type: "fixed", speed: 3, frequency: 3 },
            },
          ],
          commands: [],
        };
        map.events = [event];
        expect(rewriteLegacyAdvancedDialogueInProject(project)).toBe(true);
        const cmd = event.pages![0]!.commands[0] as Extract<Command, { kind: "text" }>;
        expect(cmd.kind).toBe("text");
        expect(cmd.speaker).toBe("미나");
        expect(cmd.body).toBe("숲으로 가자.");
        expect(cmd.emotion).toBe("happy");
        expect(cmd.autoAdvance).toBe(true);
      });

      it("rewrites legacy m2-209 commands in every canonical branch and root command owner", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        const containers = branchContainers();
        const event: GameEvent = {
          id: "ev_all_dialogue_locations",
          x: 2,
          y: 2,
          commands: [legacyDialogue("map.events[].commands"), ...Object.values(containers)],
          pages: [
            {
              id: "p1",
              name: "",
              conditions: [],
              commands: [legacyDialogue("event.pages[].commands")],
              graphic: { transparent: true },
              trigger: { kind: "action" },
              priority: "same",
              movement: { type: "fixed", speed: 3, frequency: 3 },
            },
          ],
          trigger: { kind: "action" },
        };
        map.events = [event];
        project.commonEvents = [{
          id: "common-dialogue",
          name: "common dialogue",
          trigger: "none",
          commands: [legacyDialogue("project.commonEvents[].commands")],
        }];
        const troop = project.database.troops[0]!;
        troop.battleEventPages = [{
          id: "troop-dialogue",
          name: "troop dialogue",
          conditions: [],
          span: "battle",
          commands: [legacyDialogue("database.troops[].battleEventPages[].commands")],
        }];

        expect(rewriteLegacyAdvancedDialogueInProject(project)).toBe(true);

        expectLegacyDialogueRewritten([event.commands[0]!], "map.events[].commands");
        expectLegacyDialogueRewritten(event.pages![0]!.commands, "event.pages[].commands");
        expectLegacyDialogueRewritten(project.commonEvents[0]!.commands, "project.commonEvents[].commands");
        expectLegacyDialogueRewritten(
          troop.battleEventPages[0]!.commands,
          "database.troops[].battleEventPages[].commands",
        );
        for (const [kind, container] of Object.entries(containers) as [NestedBranchKind, Command][]) {
          const branch = commandBranches(container).find((candidate) => candidate.kind === kind);
          expect(branch, `${kind}: commandBranches no longer exposes this branch`).toBeDefined();
          expectLegacyDialogueRewritten(branch!.commands, kind);
        }
      });

      it("exposes emotion and autoAdvance on the text form", () => {
        const body = renderWithFakeDom(() =>
          renderCoreCommandBody(ctx(), {
            kind: "text",
            speaker: "미나",
            body: "안녕",
            emotion: "happy",
            autoAdvance: true,
          })!
        );
        expect(findByTestId(body, "event-command-text-editor")).not.toBeNull();
        expect(findByTestId(body, "event-command-text-advanced")).not.toBeNull();
        expect(findByTestId(body, "event-command-text-emotion")?.tagName).toBe("SELECT");
        expect(findByTestId(body, "event-command-text-auto-advance")?.tagName).toBe("INPUT");
      });

      it("newCommand(text) stays flat without advanced fields", () => {
        const cmd = newCommand("text");
        expect(cmd).toEqual({ kind: "text", speaker: "", body: "" });
      });

      // 이 세 가지가 "통합됐다"는 말의 증거다. 종전엔 라벨 문자열 필터(`!== "고급 대화"`)가
      // 말줄임 붙은 실제 라벨("고급 대화...")을 맞추지 못해 탭 1 「말하기」에 그대로 남아 있었다.
      it("is not authorable from any picker tab", () => {
        const pages: readonly M2CommandPickerPage[] = [1, 2, 3, 4];
        for (const page of pages) {
          const labels = eventCommandPickerTabEntries(page).map((entry) => entry.label);
          expect(labels.filter((label) => label.startsWith("고급 대화")), `탭 ${page}`).toEqual([]);
        }
      });

      it("is not authorable from the all-tab search list either", () => {
        const entries = eventCommandPickerSearchEntries();
        expect(entries.length).toBeGreaterThan(0);
        expect(entries.filter((entry) => entry.commandId === "m2-209-advanced-dialogue")).toEqual([]);
      });

      it("marks m2-209 deprecated and unselectable in map and battle pickers", () => {
        const entry = m2CommandById("m2-209-advanced-dialogue")!;
        expect(entry.deprecated?.supersededBy).toBe("m2-001-show-text");
        expect(isM2CatalogEntrySelectableInMap(entry)).toBe(false);
        expect(isM2CatalogEntrySelectableInBattleEvent(entry)).toBe(false);
      });

      it("keeps the deprecation registry pointing at live catalog entries", () => {
        const ids = new Set(M2_COMMAND_CATALOG.map((catalogEntry) => catalogEntry.id));
        const registered = Object.entries(DEPRECATED_M2_COMMAND_IDS);
        expect(registered.length).toBeGreaterThan(0);
        for (const [id, deprecation] of registered) {
          expect(ids.has(id), id).toBe(true);
          expect(deprecation!.reason.length).toBeGreaterThan(0);
          if (deprecation!.supersededByKind) {
            expect(deprecation!.supersededBy, id).toBeUndefined();
            continue;
          }
          expect(ids.has(deprecation!.supersededBy!), deprecation!.supersededBy).toBe(true);
          expect(DEPRECATED_M2_COMMAND_IDS[deprecation!.supersededBy!]).toBeUndefined();
        }
      });
    });

    describe("duplicate m2 commands merged into native kinds (load migration)", () => {
      const m2 = (commandId: string, fields: Record<string, string | number | boolean>): Command =>
        ({ kind: "m2Command", commandId, fields });

      function projectWith(commands: Command[]) {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        const event: GameEvent = {
          id: "ev_merge",
          x: 1,
          y: 1,
          trigger: { kind: "action" },
          pages: [{
            id: "p1", name: "", conditions: [], commands,
            graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
          }],
          commands: [],
        };
        map.events = [event];
        project.commonEvents = [{ id: "common-merge", name: "c", trigger: "none", commands: [m2("m2-066-play-movie", { value: "intro.webm" })] }];
        return { project, event };
      }

      it("rewrites an old save holding both kinds into one native kind per command, then is idempotent", () => {
        const { project, event } = projectWith([
          m2("m2-050-set-weather-effects", { value: "rain", intensity: 0.8, transitionMs: 400 }),
          { kind: "setWeather", weather: "snow", intensity: 0.5, transitionMs: 0 },
          m2("m2-054-show-animation", { target: "this-event", animationId: "anim_hit", wait: "true" }),
          m2("m2-055-show-animation", { target: "player", animationId: "anim_heal", wait: "false" }),
          m2("m2-054-show-animation", { target: "ev_other", animationId: "anim_hit", wait: "false" }),
          { kind: "showAnimation", target: "player", animationId: "anim_hit", wait: false },
          m2("m2-066-play-movie", { resourceId: "finale.webm", value: "old", wait: false, skippable: false }),
          { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [m2("m2-050-set-weather-effects", { value: "fog" })] },
        ]);

        expect(rewriteLegacyAdvancedDialogueInProject(project)).toBe(true);
        const commands = event.pages![0]!.commands;
        expect(commands.slice(0, 7)).toEqual([
          { kind: "setWeather", weather: "rain", intensity: 0.8, transitionMs: 400 },
          { kind: "setWeather", weather: "snow", intensity: 0.5, transitionMs: 0 },
          { kind: "showAnimation", target: { eventId: "" }, animationId: "anim_hit", wait: true },
          { kind: "showAnimation", target: "player", animationId: "anim_heal", wait: false },
          { kind: "showAnimation", target: { eventId: "ev_other" }, animationId: "anim_hit", wait: false },
          { kind: "showAnimation", target: "player", animationId: "anim_hit", wait: false },
          { kind: "playMovie", resourceId: "finale.webm", wait: false, skippable: false },
        ]);
        const fork = commands[7] as Extract<Command, { kind: "fork" }>;
        expect(fork.then[0]).toMatchObject({ kind: "setWeather", weather: "fog", transitionMs: 0 });
        expect(project.commonEvents[0]!.commands[0]).toEqual({ kind: "playMovie", resourceId: "intro.webm", wait: true, skippable: true });

        const merged = new Set(["m2-050-set-weather-effects", "m2-054-show-animation", "m2-055-show-animation", "m2-066-play-movie"]);
        const leftovers = JSON.stringify(project.maps).match(/m2-0(50|54|55|66)-/g) ?? [];
        expect(leftovers).toEqual([]);
        expect([...merged].every((id) => m2CommandById(id)?.deprecated)).toBe(true);
        expect(rewriteLegacyAdvancedDialogueInProject(project)).toBe(false);
      });
    });
  });
  // 「말투·연출」 저작 UI 를 지킨다 — 승격된 자리와, 프리뷰가 **언제** 연출을 재생하는지.
  //
  // 이 값은 스키마가 이미 갖고 있었고 에디터도 이미 저작하게 해 줬지만 접힌 「고급 옵션」
  // 안에 있어서 아무도 쓰지 않았다. 이제 이 값이 창 등장 곡선·글자 속도·화면 연출을
  // 고르므로 문장 쓰는 자리에 나와 있어야 한다. 되접히면 기능이 다시 안 보이게 죽는다.
  //
  // 그리고 재생 시점이 더 미묘하다. 프리뷰는 본문 한 글자마다 통째로 다시 그려지므로,
  // 진입 연출을 늘 재생하면 창이 타자마다 튀어 **글을 쓸 수 없다.** 연출이 바뀐 순간에만
  // 재생해야 한다. 둘 다 화면으로만 보면 놓치기 쉬워 여기서 못 박는다.
  describe("dialoguePresentationAuthoring", () => {
    isolateTimers();
    function ctx(replaceCommand = vi.fn()): CommandEditContext {
      return {
        path: [0],
        actions: {
          addCommand: vi.fn(),
          insertCommand: vi.fn(),
          replaceCommand,
          deleteCommand: vi.fn(),
          moveCommand: vi.fn(),
          moveCommandTo: vi.fn(),
        },
      };
    }
    function textForm(cmd: Extract<Command, { kind: "text" }>, replaceCommand = vi.fn()) {
      const root = renderWithFakeDom(() => renderCoreCommandBody(ctx(replaceCommand), cmd)!) as FakeElement;
      const select = findByTestId(root, "event-command-text-emotion") as FakeElement;
      const body = findByTestId(root, "event-command-text-body") as FakeElement;
      const window = () => findByTestId(root, "ecp-message-window") as FakeElement | null;
      return { root, select, body, window, replaceCommand };
    }
    describe("「말투·연출」 저작", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("고급 옵션 밖에 상시 노출된다", () => {
        const { root, select } = textForm({ kind: "text", speaker: "미나", body: "안녕" });
        const field = findByTestId(root, "event-command-text-presentation") as FakeElement | null;
        expect(field, "「말투·연출」 필드가 없다").not.toBeNull();
        const advanced = findByTestId(root, "event-command-text-advanced") as FakeElement;
        expect(
          advanced.contains(field),
          "「말투·연출」이 접힌 고급 옵션 안으로 돌아갔다 — 기능이 다시 안 보이게 죽는다."
        ).toBe(false);
        expect(advanced.contains(select), "감정 선택이 고급 옵션 안에 남아 있다").toBe(false);
        // 접힌 자리에는 자동 넘김만 남는다.
        expect(advanced.textContent).toContain("자동 넘김");
        expect(advanced.textContent).not.toContain("말투");
      });

      it("창을 열 때는 정착 상태로 그린다", () => {
        // 편집창을 열었을 뿐인데 창이 튀면 무엇이 바뀐 신호인지 알 수 없다.
        const { window } = textForm({ kind: "text", body: "안녕", emotion: "happy" });
        expect(window()?.dataset.dialogueEmotion).toBe("happy");
        expect(window()?.dataset.dialoguePhase).toBeUndefined();
      });

      it("연출을 고른 순간에만 프리뷰가 진입을 재생한다", () => {
        const { select, body, window, replaceCommand } = textForm({ kind: "text", body: "안녕" });
        expect(window()?.dataset.dialogueEmotion).toBe("neutral");

        select.value = "happy";
        select.dispatchEvent(new Event("change"));
        const replayed = window();
        expect(replayed?.dataset.dialogueEmotion).toBe("happy");
        expect(replayed?.dataset.dialoguePhase, "연출을 바꿨는데 프리뷰가 재생하지 않는다").toBe("enter");

        // 같은 연출로 본문만 이어 쓰면 재생하지 않는다. 재생하면 타자마다 창이 튀어
        // 글을 쓸 수 없다 — 프리뷰가 매 입력마다 통째로 다시 그려지기 때문이다.
        body.value = "안녕하세요";
        body.dispatchEvent(new Event("input"));
        const typed = window();
        expect(typed?.dataset.dialogueEmotion).toBe("happy");
        expect(typed?.dataset.dialoguePhase, "타자마다 진입 연출이 재생된다 — 글을 쓸 수 없다.").toBeUndefined();

        // 값 형식은 그대로다: neutral 은 필드를 아예 남기지 않는다.
        expect(replaceCommand).toHaveBeenLastCalledWith([0], {
          kind: "text",
          speaker: undefined,
          body: "안녕하세요",
          emotion: "happy",
        });
        select.value = "neutral";
        select.dispatchEvent(new Event("change"));
        expect(replaceCommand).toHaveBeenLastCalledWith([0], {
          kind: "text",
          speaker: undefined,
          body: "안녕하세요",
        });
      });

      it("움직임을 끈 자리도 프리뷰가 알아본다", () => {
        // motion off 는 CSS 가 읽는 게이트다. 프리뷰가 이 값을 안 심으면
        // reduced-motion 안전망이 프리뷰에만 안 걸린다.
        const { window } = textForm({ kind: "text", body: "안녕", emotion: "angry" });
        expect(window()?.dataset.dialogueMotion).toBe("on");
      });
    });
  });
  describe("eventEditorFactionPicker", () => {
    isolateTimers();
    function context(replaceCommand = vi.fn()): CommandEditContext {
      return {
        path: [2],
        actions: {
          addCommand: vi.fn(),
          insertCommand: vi.fn(),
          replaceCommand,
          deleteCommand: vi.fn(),
          moveCommand: vi.fn(),
          moveCommandTo: vi.fn(),
        },
      };
    }
    function command(a = "guard", b = "player"): Extract<Command, { kind: "changeFactionStance" }> {
      return { kind: "changeFactionStance", a, b, op: "-=", value: 1 };
    }
    describe("changeFactionStance faction pickers", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        const project = createBlankProject();
        project.factions = {
          defs: [
            { id: "guard", name: "경비대" },
            { id: "bandit", name: "산적단" },
          ],
          relations: [],
        };
        store.replace(project);
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("renders both operands as labeled selects with reserved and authored factions, then writes a selection", () => {
        const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
        const body = renderWithFakeDom(() => renderCoreCommandBody(context(replaceCommand), command())!);
        const factionA = findByTestId(body, "event-command-faction-a");
        const factionB = findByTestId(body, "event-command-faction-b");

        expect(factionA?.tagName).toBe("SELECT");
        expect(factionB?.tagName).toBe("SELECT");
        expect(factionA?.closest("label")).not.toBeNull();
        expect(factionB?.closest("label")).not.toBeNull();
        const expectedIds = ["player", "enemy", "guard", "bandit"];
        expect(factionA?.children.map((option) => option.value)).toEqual(expectedIds);
        expect(factionB?.children.map((option) => option.value)).toEqual(expectedIds);
        expect(factionA?.children.map((option) => option.textContent)).toEqual([
          "플레이어 (player)",
          "적 (enemy)",
          "경비대 (guard)",
          "산적단 (bandit)",
        ]);

        if (!factionA) throw new Error("진영 A 선택기가 없습니다.");
        const value = findByTestId(body, "event-command-faction-value");
        if (!value) throw new Error("태도 값 입력기가 없습니다.");
        Object.defineProperty(value, "valueAsNumber", { configurable: true, value: 1 });
        factionA.value = "bandit";
        factionA.dispatchEvent(new Event("change"));

        expect(replaceCommand).toHaveBeenLastCalledWith([2], {
          kind: "changeFactionStance",
          a: "bandit",
          b: "player",
          op: "-=",
          value: 1,
        });
      });

      it("keeps a stored missing faction id visible and selected", () => {
        const body = renderWithFakeDom(() => renderCoreCommandBody(context(), command("gaurd"))!);
        const factionA = findByTestId(body, "event-command-faction-a");

        expect(factionA?.tagName).toBe("SELECT");
        expect(factionA?.value).toBe("gaurd");
        expect(factionA?.children.map((option) => option.value)).toContain("gaurd");
        expect(factionA?.children.find((option) => option.value === "gaurd")?.textContent).toContain("gaurd");
      });
    });
  });
});

describe("commandBodyM2", () => {
  isolateTimers();
  describe("eventEditorM2CommandBody", () => {
    isolateTimers();
    const MOVE_PICTURE_COMMAND = {
      kind: "m2Command",
      commandId: "m2-052-move-picture",
      fields: {
        pictureId: "pic_cloud",
        resourceId: "easyrpg-picture-cloud",
        x: 12,
        y: 34,
      },
    } satisfies Command;
    function contextWithReplaceSpy(replaceCommand: CommandEditContext["actions"]["replaceCommand"]): CommandEditContext {
      return {
        path: [2],
        actions: {
          addCommand: vi.fn(),
          insertCommand: vi.fn(),
          replaceCommand,
          deleteCommand: vi.fn(),
          moveCommand: vi.fn(),
          moveCommandTo: vi.fn(),
        },
      };
    }
    describe("event editor M2 command body", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        const project = createBlankProject();
        const firstActor = project.database.actors[0];
        const firstClass = project.database.classes[0];
        const firstAnimation = project.database.battleAnimations[0];
        if (firstActor) firstActor.name = "테스트 주인공";
        if (firstClass) firstClass.name = "테스트 직업";
        if (firstAnimation) firstAnimation.name = "테스트 애니메이션";
        store.replace(project);
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("offers pickers instead of free text for the journal line actor, skill and result switch ids", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody(contextWithReplaceSpy(vi.fn()), { kind: "m2Command", commandId: "m2-227-journal-line", fields: {} })
        );
        expect(findByTestId(body, "m2-command-learnActorId-record-select")).not.toBeNull();
        expect(findByTestId(body, "m2-command-learnSkillId-record-select")).not.toBeNull();
      });

      it("renders Move Picture as the canonical rich picture-slot movement form", () => {
        const context = contextWithReplaceSpy(vi.fn());

        const body = renderWithFakeDom(() => renderM2CommandBody(context, MOVE_PICTURE_COMMAND) ?? document.createElement("div"));

        expect(body.textContent).not.toMatch(/catalog-disabled|missing-runtime|runtime:/);
        expect(findByTestId(body, "move-picture-m2-command-body")).not.toBeNull();
        expect(findByTestId(body, "move-picture-m2-intent")?.textContent).toContain("그림 이동");
        expect(findByTestId(body, "move-picture-m2-preview")).not.toBeNull();
        expect(findByTestId(body, "move-picture-m2-resource-select")).toBeNull();
      });

      it("keeps Move Picture numeric fields editable through the normal command replace path", () => {
        const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
        const context = contextWithReplaceSpy(replaceCommand);

        const body = renderWithFakeDom(() => renderM2CommandBody(context, MOVE_PICTURE_COMMAND) ?? document.createElement("div"));
        const pictureId = findByTestId(body, "move-picture-m2-id-input");
        const x = findByTestId(body, "move-picture-m2-x-input");
        const y = findByTestId(body, "move-picture-m2-y-input");
        expect(pictureId?.value).toBe("pic_cloud");
        expect(x?.value).toBe("12");
        expect(y?.value).toBe("34");
        if (!x) throw new Error("missing Move Picture X input");

        x.value = "48";
        x.dispatchEvent(new Event("change"));

        expect(replaceCommand).toHaveBeenCalledWith(
          [2],
          expect.objectContaining({
            kind: "m2Command",
            commandId: "m2-052-move-picture",
            fields: expect.objectContaining({ pictureId: "pic_cloud", x: 48, y: 34 }),
          })
        );
      });

      it("renders database-backed generic command ids as Korean record selectors instead of raw text inputs", () => {
        const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
        const context = contextWithReplaceSpy(replaceCommand);

        const body = renderWithFakeDom(
          () =>
            renderM2CommandBody(context, {
              kind: "m2Command",
              commandId: "m2-091-change-actor-class",
              fields: { target: "actor_hero", operation: "set", value: "class_hero" },
            }) ?? document.createElement("div")
        );

        expect(Boolean(findByTestId(body, "m2-command-target-input"))).toBe(false);
        expect(Boolean(findByTestId(body, "m2-command-value-input"))).toBe(false);
        const actor = findByTestId(body, "change-actor-class-actor-select");
        const actorClass = findByTestId(body, "change-actor-class-class-select");
        expect(findByTestId(body, "change-actor-class-command-body")).not.toBeNull();
        expect(actor?.tagName).toBe("SELECT");
        expect(actor?.textContent).toContain("테스트 주인공");
        expect(actorClass?.tagName).toBe("SELECT");
        expect(actorClass?.textContent).toContain("테스트 직업");
      });

      it("renders generic animation ids as battle animation record selectors", () => {
        const context = contextWithReplaceSpy(vi.fn());

        const body = renderWithFakeDom(
          () =>
            renderM2CommandBody(context, {
              kind: "m2Command",
              commandId: "m2-054-show-animation",
              fields: { target: "this-event", animationId: "anim_sword" },
            }) ?? document.createElement("div")
        );

        expect(Boolean(findByTestId(body, "m2-command-animationId-input"))).toBe(false);
        const animation = findByTestId(body, "show-animation-m2-animation-select");
        expect(findByTestId(body, "show-animation-m2-command-body")).not.toBeNull();
        expect(animation?.tagName).toBe("SELECT");
        expect(animation?.textContent).toContain("테스트 애니메이션");
      });

      it("renders system graphic values as resource selectors with a preview", () => {
        const context = contextWithReplaceSpy(vi.fn());

        const body = renderWithFakeDom(
          () =>
            renderM2CommandBody(context, {
              kind: "m2Command",
              commandId: "m2-029-change-system-graphic",
              fields: { target: "window", operation: "set", value: "windowskin-warm" },
            }) ?? document.createElement("div")
        );

        expect(Boolean(findByTestId(body, "m2-command-value-input"))).toBe(false);
        const picker = findByTestId(body, "m2-command-value-resource-picker");
        const preview = findByTestId(body, "m2-command-value-resource-preview");
        expect(picker?.tagName).toBe("SELECT");
        expect(picker?.attrs["aria-label"]).toBe("메뉴 모습 선택");
        expect(picker?.textContent).toContain("windowskin-warm");
        expect(preview?.dataset.resourceId).toBe("windowskin-warm");
      });

      it("renders map/event location commands with friendly event, map, and coordinate controls", () => {
        const context = contextWithReplaceSpy(vi.fn());

        const body = renderWithFakeDom(
          () =>
            renderM2CommandBody(context, {
              kind: "m2Command",
              commandId: "m2-040-set-event-location",
              fields: { target: "event_starter_mina", mapId: "map_starter_village", x: 3, y: 4 },
            }) ?? document.createElement("div")
        );

        expect(body.textContent).not.toMatch(/catalog-disabled|missing-runtime|runtime:/);
        expect(findByTestId(body, "set-event-location-command-body")).not.toBeNull();
        expect(findByTestId(body, "set-event-location-event-select")?.tagName).toBe("SELECT");
        expect(findByTestId(body, "set-event-location-map-select")?.tagName).toBe("SELECT");
        expect(findByTestId(body, "set-event-location-x-input")?.value).toBe("3");
        expect(findByTestId(body, "set-event-location-y-input")?.value).toBe("4");
      });

      it("renders modern commands as guided controls instead of raw note fields", () => {
        const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
        const context = contextWithReplaceSpy(replaceCommand);

        const body = renderWithFakeDom(
          () =>
            renderM2CommandBody(context, {
              kind: "m2Command",
              commandId: "m2-201-camera-control",
              fields: { mode: "panTo", target: "player", x: 10, y: 12, zoom: 1.25, durationMs: 450 },
            }) ?? document.createElement("div")
        );

        expect(body.textContent).toContain("값을 고르고 확인을 누르면 적용됩니다.");
        expect(findByTestId(body, "m2-command-mode-option-select")?.tagName).toBe("SELECT");
        expect(findByTestId(body, "m2-command-target-option-select")?.tagName).toBe("SELECT");
        expect(findByTestId(body, "m2-command-x-input")?.value).toBe("10");
        expect(findByTestId(body, "m2-command-y-input")?.value).toBe("12");
        expect(findByTestId(body, "m2-command-zoom-input")?.value).toBe("1.25");
        expect(findByTestId(body, "m2-command-durationMs-input")?.value).toBe("450");
        expect(findByTestId(body, "m2-command-note-input")).toBeNull();
      });

      it("routes Advanced Dialogue into the native text form (merged)", async () => {
        // Advanced Dialogue is now existingKind:text — generic m2 body is not used.
        const { m2CommandById } = await import("@/project/eventCommands/m2Catalog");
        const entry = m2CommandById("m2-209-advanced-dialogue");
        expect(entry?.existingKind).toBe("text");
        expect(entry?.bodyStrategy).toBe("existing");
      });

      it("renders Call Event as a common-event record selector, not map coordinates", () => {
        const project = store.getCurrent();
        project.commonEvents.push({ id: "ce_test", name: "테스트 공통 이벤트", commands: [], trigger: "none" });
        store.replace(project);
        const context = contextWithReplaceSpy(vi.fn());
        const body = renderWithFakeDom(() =>
          renderM2CommandBody(context, {
            kind: "m2Command",
            commandId: "m2-087-call-event",
            fields: {},
          }) ?? document.createElement("div")
        );

        // m2-087은 existingKind:callCommonEvent 별칭이라 제네릭 껍데기만 낸다.
        // 실제 저작은 네이티브 폼이 맡으므로, 별칭 껍데기가 맵 좌표 입력을 내놓지 않으면 된다.
        expect(Boolean(findByTestId(body, "m2-command-target-input"))).toBe(false);
        expect(Boolean(findByTestId(body, "m2-command-mapId-input"))).toBe(false);
        expect(Boolean(findByTestId(body, "m2-command-x-input"))).toBe(false);
        expect(Boolean(findByTestId(body, "m2-command-y-input"))).toBe(false);
      });

      it("renders Play Movie resource ids as movie picks, not image picks", () => {
        const context = contextWithReplaceSpy(vi.fn());
        const body = renderWithFakeDom(() =>
          renderM2CommandBody(context, {
            kind: "m2Command",
            commandId: "m2-066-play-movie",
            fields: {},
          }) ?? document.createElement("div")
        );

        const picker = findByTestId(body, "m2-command-resourceId-picker");
        expect(picker?.attrs["aria-label"]).toBe("영상 선택");
        expect(body.textContent).not.toContain("합본 마을");
        expect(body.textContent).not.toContain("tex_easyrpg_chipset_combined_town");
        expect(body.textContent).toContain("동영상을 고르세요");
        expect(body.textContent).not.toContain("그림을 고르세요");
      });

      it("explains Wait for All Movement intent for authors", () => {
        const context = contextWithReplaceSpy(vi.fn());
        const body = renderWithFakeDom(() =>
          renderM2CommandBody(context, {
            kind: "m2Command",
            commandId: "m2-058-wait-for-all-movement",
            fields: {},
          }) ?? document.createElement("div")
        );

        expect(findByTestId(body, "m2-command-body-m2-058-wait-for-all-movement")).not.toBeNull();
        expect(findByTestId(body, "m2-command-note-input")).toBeNull();
        expect(body.textContent).toContain("이 명령은 추가 설정 없이 실행됩니다");
        const hints = (body.textContent?.match(/추가 설정 없음/g) ?? []).length;
        expect(hints).toBeLessThanOrEqual(1);
      });
      it("announces retired catalog rows inside the dialog", () => {
        const context = contextWithReplaceSpy(vi.fn());
        // m2-055는 전용 애니메이션 폼 경로 — 배너가 전용 폼에도 붙는지 본다.
        const body = renderWithFakeDom(() =>
          renderCommandBody(context, {
            kind: "m2Command",
            commandId: "m2-055-show-animation",
            fields: {},
          })
        );

        expect(findByTestId(body, "show-animation-m2-command-body")).not.toBeNull();
        const notice = findByTestId(body, "m2-command-deprecated-notice");
        expect(notice).not.toBeNull();
        expect(notice?.textContent).toContain("통합");
      });
    });
  });
  /** Page-3 (map and presentation) command body behavior contracts. */
  describe("page3CommandBodies", () => {
    isolateTimers();
    function stagedContext(initial: Command): {
      readonly context: CommandEditContext;
      readonly current: () => Command;
    } {
      let staged = structuredClone(initial);
      return {
        context: {
          path: [1],
          actions: {
            addCommand: vi.fn(),
            insertCommand: vi.fn(),
            replaceCommand: (_path, command) => { staged = structuredClone(command); },
            deleteCommand: vi.fn(),
            moveCommand: vi.fn(),
            moveCommandTo: vi.fn(),
          },
          getCurrentCommand: () => staged,
        },
        current: () => staged,
      };
    }
    function m2(
      commandId: string,
      fields: Record<string, string | number | boolean> = {}
    ): Extract<Command, { kind: "m2Command" }> {
      return { kind: "m2Command", commandId, fields };
    }
    function change(node: FakeElement | null, value: string): void {
      expect(node).not.toBeNull();
      if (!node) return;
      node.value = value;
      node.dispatchEvent(new Event("change"));
    }
    function execute(command: Extract<Command, { kind: "m2Command" }>) {
      const project = store.getCurrent();
      const session = startSession(project);
      const entry = m2CommandById(command.commandId);
      expect(entry).toBeTruthy();
      if (entry) executeM2RuntimeCommand(session, entry, command, { project });
      return session;
    }
    describe("page3 command body UX (맵·연출)", () => {
      let restoreDom: (() => void) | undefined;
      let pictureResourceId = "";

      beforeEach(() => {
        restoreDom = installFakeDom();
        const project = createBlankProject();
        pictureResourceId =
          project.resources?.find?.((r) => (r as { kind?: string }).kind === "picture")?.id ??
          project.database.actors[0]?.faceResourceId ??
          "picture_sample";
        store.replace(project);
      });

      afterEach(() => {
        restoreDom?.();
      });


      describe("M2 page3 form-to-runtime contracts", () => {
        it("commits tint fields and applies them to runtime screen state", () => {
          const initial = m2("m2-046-tint-screen", { color: "neutral", value: "", duration: 0 });
          const staged = stagedContext(initial);
          const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
          findByTestId(body, "tint-screen-color-blue")?.click();
          change(findByTestId(body, "tint-screen-duration-input"), "240");

          const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
          // 편집기는 이제 durationMs 로 쓰고 옛 duration 키는 지운다(tintScreenBody commit).
          expect(command.fields).toMatchObject({ color: "blue", value: "", durationMs: 240 });
          expect(command.fields).not.toHaveProperty("duration");
          const session = execute(command);
          expect(session.m2Runtime?.screen).toMatchObject({ tint: "blue", tintDurationMs: 240 });
        });

        it("commits flash fields and applies the flash color to runtime", () => {
          const initial = m2("m2-047-flash-screen", { color: "white", value: "white", durationMs: 180 });
          const staged = stagedContext(initial);
          const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
          change(findByTestId(body, "flash-screen-color"), "red");
          change(findByTestId(body, "flash-screen-duration-input"), "320");

          const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
          expect(command.fields).toMatchObject({ color: "red", value: "red", durationMs: 320 });
          expect(execute(command).m2Runtime?.screen.flash).toBe("red");
        });

        it("commits shake fields and applies the intensity to runtime", () => {
          const initial = m2("m2-048-shake-screen", { intensity: "3", value: 3, durationMs: 300 });
          const staged = stagedContext(initial);
          const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
          change(findByTestId(body, "shake-screen-intensity"), "6");
          change(findByTestId(body, "shake-screen-duration-input"), "450");

          const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
          expect(command.fields).toMatchObject({ intensity: "6", value: 6, durationMs: 450 });
          expect(execute(command).m2Runtime?.screen.shake).toBe(6);
        });

        it("commits scroll fields and applies the canonical map runtime record", () => {
          const initial = m2("m2-049-scroll-map", { direction: "down", distance: 1, speed: 4, wait: "true", mode: "return" });
          const staged = stagedContext(initial);
          const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
          change(findByTestId(body, "scroll-map-direction"), "right");
          change(findByTestId(body, "scroll-map-distance-input"), "5");

          const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
          expect(command.fields).toMatchObject({ direction: "right", distance: 5, speed: 4, wait: "true", mode: "return" });
          expect(execute(command).m2Runtime?.map.scroll_map).toMatchObject({ value: "", x: 0, y: 0 });
        });

        it("commits weather fields and applies parsed weather to runtime", () => {
          const initial = m2("m2-050-set-weather-effects", { value: "none", transitionMs: 0, durationMs: 0 });
          const staged = stagedContext(initial);
          const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
          findByTestId(body, "set-weather-effects-kind-snow")?.click();
          change(findByTestId(body, "set-weather-effects-intensity-input"), "0.75");
          change(findByTestId(body, "set-weather-effects-transition-input"), "400");

          const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
          expect(command.fields).toMatchObject({ value: "snow,0.75", transitionMs: 400, durationMs: 400 });
          expect(execute(command).m2Runtime?.screen.weather).toBe("snow,0.75");
        });

        it("commits picture movement and updates the runtime picture slot", () => {
          const initial = m2("m2-052-move-picture", { pictureId: "pic1", resourceId: pictureResourceId, x: 8, y: 9, durationMs: 0 });
          const staged = stagedContext(initial);
          const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
          change(findByTestId(body, "move-picture-m2-x-input"), "24");
          change(findByTestId(body, "move-picture-m2-y-input"), "30");
          change(findByTestId(body, "move-picture-m2-duration-input"), "500");

          const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
          expect(command.fields).toMatchObject({ pictureId: "pic1", x: 24, y: 30, durationMs: 500, duration: 500 });
          const session = startSession(store.getCurrent());
          session.pictures = { pic1: { pictureId: "pic1", resourceId: pictureResourceId, x: 8, y: 9 } };
          executeM2RuntimeCommand(session, m2CommandById(command.commandId)!, command, { project: store.getCurrent() });
          expect(session.pictures.pic1).toMatchObject({ pictureId: "pic1", resourceId: pictureResourceId, x: 24, y: 30, durationMs: 500 });
        });

        it("commits encounter rate and applies the runtime map value", () => {
          const initial = m2("m2-070-set-encounter-rate", { value: 24, valueSource: "number", valueVariableId: "" });
          const staged = stagedContext(initial);
          const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
          change(findByTestId(body, "set-encounter-rate-value-input"), "12");

          const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
          expect(command.fields).toMatchObject({ target: "map", operation: "set", value: 12, valueSource: "number" });
          expect(execute(command).m2Runtime?.map.encounter_rate?.value).toBe("12");
        });
      });

    });
  });
  // 시스템·연출(피커 3페이지) 명령 프리뷰 폴리시 계약.
  // 색조/날씨/먼 배경/키 입력 프리뷰가 "실제 시각 요소"를 갖는지 구조로만 검사한다
  // (한국어 산문 전문·픽셀 색은 고정하지 않는다).
  describe("page3SystemEffectPreviews", () => {
    isolateTimers();
    const TINT_ID = "m2-046-tint-screen";
    const WEATHER_ID = "m2-050-set-weather-effects";
    const KEY_INPUT_ID = "m2-067-key-input-processing";
    const PARALLAX_ID = "m2-069-change-parallax-back";
    const UPLOADED_BACKDROP_ID = "uploaded-parallax-cliff";
    let replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
    function context(): CommandEditContext {
      return {
        path: [3],
        actions: {
          addCommand: vi.fn(),
          insertCommand: vi.fn(),
          replaceCommand,
          deleteCommand: vi.fn(),
          moveCommand: vi.fn(),
          moveCommandTo: vi.fn(),
        },
      };
    }
    function renderBody(commandId: string, fields: Record<string, unknown>): FakeElement {
      const cmd = { kind: "m2Command", commandId, fields } as unknown as Command;
      return renderWithFakeDom(() => renderM2CommandBody(context(), cmd) ?? document.createElement("div"));
    }
    function requireTestId(root: FakeElement, testId: string): FakeElement {
      const found = findByTestId(root, testId);
      if (!found) throw new Error(`missing [data-testid="${testId}"]`);
      return found;
    }
    /** 프리뷰 구조 불변조건: [시각 요소] → .actor-m2-preview-line → .actor-m2-preview-note */
    function expectVisualFirstThenLineThenNote(preview: FakeElement, visualTestId: string): void {
      const first = preview.children[0];
      expect(first?.dataset.testid).toBe(visualTestId);
      const classes = preview.children.map((child) => child.className);
      const lineIndex = classes.findIndex((name) => name.split(/\s+/).includes("actor-m2-preview-line"));
      const noteIndex = classes.findIndex((name) => name.split(/\s+/).includes("actor-m2-preview-note"));
      expect(lineIndex).toBeGreaterThan(0);
      expect(noteIndex).toBeGreaterThan(lineIndex);
    }
    describe("page 3 시스템·연출 프리뷰 폴리시", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
        const project = createBlankProject();
        project.assets.uploaded[UPLOADED_BACKDROP_ID] = {
          id: UPLOADED_BACKDROP_ID,
          name: "절벽 원경.png",
          kind: "backdrop",
          dataUrl: "data:image/png;base64,iVBORw0KGgo=",
          meta: { width: 640, height: 480 },
        };
        store.replace(project);
      });

      afterEach(() => {
        restoreDom?.();
      });

      describe("화면 색조", () => {
        it("프리뷰 첫 자식이 stage + 색 swatch이고 프리셋 선택이 data-tint로 반영된다", () => {
          const body = renderBody(TINT_ID, { color: "blue", value: "", duration: 600 });
          const preview = requireTestId(body, "tint-screen-preview");
          const stage = requireTestId(preview, "tint-screen-preview-stage");
          const swatch = requireTestId(stage, "tint-screen-preview-swatch");

          expect(stage.className.split(/\s+/)).toEqual(
            expect.arrayContaining(["actor-m2-preview-stage", "page3-preview-stage"])
          );
          expect(swatch.className.split(/\s+/)).toEqual(
            expect.arrayContaining(["actor-m2-effect-swatch", "page3-tint-preview"])
          );
          expect(swatch.dataset.tint).toBe("blue");
          expect(swatch.dataset.durationMs).toBe("600");
          expectVisualFirstThenLineThenNote(preview, "tint-screen-preview-stage");
          expect(findByTestId(body, "tint-screen-preview-error")).toBeNull();
        });

        it("기존 색상 칩 testid를 유지하고 칩 클릭이 swatch 색조를 갱신한다", () => {
          const body = renderBody(TINT_ID, { color: "neutral", value: "", duration: 0 });
          expect(findByTestId(body, "tint-screen-color-chips")).not.toBeNull();
          for (const id of ["neutral", "white", "red", "green", "blue", "yellow", "purple", "black"]) {
            expect(findByTestId(body, `tint-screen-color-${id}`), id).not.toBeNull();
          }
          expect(requireTestId(body, "tint-screen-preview-swatch").dataset.tint).toBe("neutral");

          requireTestId(body, "tint-screen-color-red").click();

          expect(requireTestId(body, "tint-screen-preview-swatch").dataset.tint).toBe("red");
        });

        it("유효한 직접 색은 custom swatch + 인라인 효과 색 변수로 표현된다", () => {
          const body = renderBody(TINT_ID, { color: "blue", value: "#3366ff", duration: 200 });
          const swatch = requireTestId(body, "tint-screen-preview-swatch");

          expect(swatch.dataset.tint).toBe("custom");
          expect(swatch.style.getPropertyValue("--actor-m2-effect-color")).not.toBe("");
          expect(findByTestId(body, "tint-screen-preview-error")).toBeNull();
        });

        it("무효한 직접 색은 status 오류 안내를 띄운다", () => {
          const body = renderBody(TINT_ID, { color: "blue", value: "nope", duration: 200 });
          const error = requireTestId(body, "tint-screen-preview-error");

          expect(error.getAttribute("role")).toBe("status");
          expect(error.textContent.trim().length).toBeGreaterThan(0);
          expect(requireTestId(body, "tint-screen-preview-swatch").dataset.tint).toBe("blue");
        });

        it("폼을 여는 것만으로는 명령을 저장하지 않는다", () => {
          renderBody(TINT_ID, { color: "blue", value: "", duration: 600 });
          expect(replaceCommand).not.toHaveBeenCalled();
        });
      });

      describe("날씨 효과", () => {
        it("stage 안에 강도가 반영된 오버레이가 항상 존재한다", () => {
          const body = renderBody(WEATHER_ID, { value: "rain,0.7", transitionMs: 800 });
          const preview = requireTestId(body, "set-weather-effects-preview");
          const stage = requireTestId(preview, "set-weather-effects-preview-stage");
          const overlay = requireTestId(stage, "set-weather-effects-preview-overlay");

          expect(stage.className.split(/\s+/)).toEqual(
            expect.arrayContaining(["actor-m2-preview-stage", "page3-preview-stage", "page3-preview-weather"])
          );
          expect(overlay.className.split(/\s+/)).toEqual(
            expect.arrayContaining(["actor-m2-weather-overlay", "page3-weather-preview"])
          );
          expect(overlay.dataset.weather).toBe("rain");
          expect(Number(overlay.dataset.intensity)).toBeCloseTo(0.7, 5);
          expect(overlay.dataset.transitionMs).toBe("800");
          expectVisualFirstThenLineThenNote(preview, "set-weather-effects-preview-stage");
        });

        it("날씨 없음에서도 오버레이를 DOM에서 제거하지 않는다", () => {
          const body = renderBody(WEATHER_ID, { value: "none", transitionMs: 0 });
          const overlay = requireTestId(body, "set-weather-effects-preview-overlay");

          expect(overlay.dataset.weather).toBe("none");
        });

        it("종류 칩마다 색 점을 붙이고 기존 칩 testid를 유지한다", () => {
          const body = renderBody(WEATHER_ID, { value: "snow,0.4", transitionMs: 0 });
          for (const id of ["none", "rain", "storm", "snow", "fog"]) {
            const chip = requireTestId(body, `set-weather-effects-kind-${id}`);
            const dot = requireTestId(chip, `set-weather-effects-kind-${id}-dot`);
            expect(dot.className.split(/\s+/)).toContain("actor-m2-weather-dot");
          }
        });

        it("안개일 때만 원·근 두 겹의 안개 층이 생긴다", () => {
          const fog = renderBody(WEATHER_ID, { value: "fog,0.7", transitionMs: 800 });
          const far = requireTestId(fog, "set-weather-effects-preview-fog-far");
          const near = requireTestId(fog, "set-weather-effects-preview-fog-near");
          expect(far.className.split(/\s+/)).toContain("actor-m2-fog-layer");
          expect(near.className.split(/\s+/)).toContain("actor-m2-fog-layer");
          expect(fog.querySelectorAll(".actor-m2-fog-layer")).toHaveLength(2);

          const rain = renderBody(WEATHER_ID, { value: "rain,0.7", transitionMs: 0 });
          expect(rain.querySelectorAll(".actor-m2-fog-layer")).toHaveLength(0);
          expect(findByTestId(rain, "set-weather-effects-preview-fog-far")).toBeNull();
          expect(findByTestId(rain, "set-weather-effects-preview-fog-near")).toBeNull();
        });

        it("강도 슬라이더가 숫자 입력·오버레이와 동기화되고 저장 형식은 그대로다", () => {
          const body = renderBody(WEATHER_ID, { value: "fog,0.7", transitionMs: 800 });
          const slider = requireTestId(body, "set-weather-effects-intensity-slider");
          const numberInput = requireTestId(body, "set-weather-effects-intensity-input");
          expect(slider.className.split(/\s+/)).toContain("page3-range-input");
          expect(slider.getAttribute("type")).toBe("range");
          expect(Number(slider.value)).toBeCloseTo(0.7, 5);

          slider.value = "0.35";
          slider.dispatchEvent(new Event("input"));

          expect(Number(numberInput.value)).toBeCloseTo(0.35, 5);
          expect(Number(requireTestId(body, "set-weather-effects-preview-overlay").dataset.intensity)).toBeCloseTo(0.35, 5);
          expect(replaceCommand).toHaveBeenCalledWith(
            [3],
            expect.objectContaining({
              fields: expect.objectContaining({ value: "fog,0.35" }),
            })
          );
        });

        it("폼을 여는 것만으로는 명령을 저장하지 않는다", () => {
          renderBody(WEATHER_ID, { value: "fog,0.7", transitionMs: 800 });
          expect(replaceCommand).not.toHaveBeenCalled();
        });
      });

      describe("먼 배경 변경", () => {
        it("선택된 배경은 실제 이미지 + 캡션으로 보인다", () => {
          const body = renderBody(PARALLAX_ID, { value: UPLOADED_BACKDROP_ID });
          const preview = requireTestId(body, "change-parallax-back-preview");
          const panel = requireTestId(preview, "change-parallax-back-preview-image");

          expect(panel.className.split(/\s+/)).toEqual(
            expect.arrayContaining(["actor-m2-parallax-preview", "actor-m2-preview-stage"])
          );
          expect(panel.dataset.state).toBe("ready");
          const images = panel.querySelectorAll("img");
          expect(images).toHaveLength(1);
          expect(images[0]?.className.split(/\s+/)).toContain("actor-m2-parallax-preview-img");
          expect(images[0]?.getAttribute("alt")).toContain("먼 배경");
          const caption = requireTestId(preview, "change-parallax-back-preview-caption");
          expect(caption.getAttribute("title")).toBe(UPLOADED_BACKDROP_ID);
          expectVisualFirstThenLineThenNote(preview, "change-parallax-back-preview-image");
        });

        it("미선택이면 empty 상태 안내만 보이고 이미지가 없다", () => {
          const body = renderBody(PARALLAX_ID, { value: "" });
          const panel = requireTestId(body, "change-parallax-back-preview-image");

          expect(panel.dataset.state).toBe("empty");
          expect(panel.querySelectorAll("img")).toHaveLength(0);
          expect(findByTestId(panel, "change-parallax-back-preview-empty")).not.toBeNull();
          expect(findByTestId(panel, "change-parallax-back-preview-missing")).toBeNull();
        });

        it("해석할 수 없는 리소스는 missing 상태로 알린다", () => {
          const body = renderBody(PARALLAX_ID, { value: "no-such-backdrop-#$%" });
          const panel = requireTestId(body, "change-parallax-back-preview-image");

          expect(panel.dataset.state).toBe("missing");
          expect(panel.querySelectorAll("img")).toHaveLength(0);
          expect(findByTestId(panel, "change-parallax-back-preview-missing")).not.toBeNull();
        });

        it("기존 리소스 선택/피커 testid를 유지하고 오픈 시 저장하지 않는다", () => {
          const body = renderBody(PARALLAX_ID, { value: UPLOADED_BACKDROP_ID });
          expect(findByTestId(body, "change-parallax-back-resource-select")).not.toBeNull();
          expect(findByTestId(body, "change-parallax-back-resource-picker")).not.toBeNull();
          expect(replaceCommand).not.toHaveBeenCalled();
        });
      });

      describe("키 입력", () => {
        it("저장되는 키 코드 집합을 키캡으로 전부 보여준다", () => {
          const body = renderBody(KEY_INPUT_ID, { variableId: "", value: "true" });
          const preview = requireTestId(body, "key-input-processing-preview");
          const keycaps = requireTestId(preview, "key-input-processing-keycaps");

          expect(keycaps.className.split(/\s+/)).toContain("actor-m2-keycaps");
          expect(keycaps.getAttribute("aria-label")).toBe("입력 가능한 키 코드");
          for (const code of ["1", "2", "3", "4", "5", "6", "7", "digits"]) {
            const cap = requireTestId(keycaps, `key-input-processing-keycap-${code}`);
            expect(cap.className.split(/\s+/)).toContain("actor-m2-keycap");
          }
          expect(keycaps.querySelectorAll(".actor-m2-keycap")).toHaveLength(8);
          expectVisualFirstThenLineThenNote(preview, "key-input-processing-keycaps");
        });

        it("대상 변수·대기 배지를 시각 요소와 함께 노출한다", () => {
          const waiting = renderBody(KEY_INPUT_ID, { variableId: "", value: "true" });
          expect(requireTestId(waiting, "key-input-processing-preview-target").textContent.trim().length).toBeGreaterThan(0);
          expect(requireTestId(waiting, "key-input-processing-preview-wait").dataset.wait).toBe("true");

          const notWaiting = renderBody(KEY_INPUT_ID, { variableId: "", value: "false" });
          expect(requireTestId(notWaiting, "key-input-processing-preview-wait").dataset.wait).toBe("false");
        });

        it("기존 변수/대기 컨트롤 testid를 유지하고 오픈 시 저장하지 않는다", () => {
          const body = renderBody(KEY_INPUT_ID, { variableId: "", value: "true" });
          expect(findByTestId(body, "key-input-processing-variable")).not.toBeNull();
          expect(findByTestId(body, "key-input-processing-wait")).not.toBeNull();
          expect(replaceCommand).not.toHaveBeenCalled();
        });
      });
    });
  });
});

describe("commandEditModalPreview", () => {
  isolateTimers();
  const noopActions: CommandListActions = {
    addCommand: () => {},
    insertCommand: () => {},
    replaceCommand: () => {},
    deleteCommand: () => {},
    moveCommand: () => {},
    moveCommandTo: () => {},
  };
  describe("command edit modal — image-rich preview", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => {
      resetToastsForTest();
      restoreDom?.();
    });

    it("renders a preview for every representative command kind without throwing", () => {
      const project = store.getCurrent();
      const itemId = project.database.items[0]?.id ?? "";
      const switchId = project.switches[0]?.id ?? "";
      const actorId = project.database.actors[0]?.id ?? "";
      const mapId = project.startMapId;
      const samples: Command[] = [
        { kind: "text", speaker: "용사", body: "안녕\n반가워" },
        { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false },
        { kind: "displayTextSettings", format: "transparent", position: "top", preventObscuringPlayer: false, allowEventMovementDuringWait: false },
        { kind: "choices", options: [{ text: "예", branch: [] }, { text: "아니오", branch: [] }] },
        { kind: "inputNumber", variableId: project.variables[0]?.id ?? "var_0001", digits: 3, prompt: "PIN 입력", showPad: true },
        { kind: "fork", condition: { kind: "switch", switchId, value: true }, then: [{ kind: "text", body: "참" }], else: [] },
        { kind: "moveEvent", eventId: PLAYER_MOVE_TARGET, route: { moves: [{ kind: "move", dir: "left" }, { kind: "move", dir: "up" }], repeat: false } },
        { kind: "transfer", mapId, x: 3, y: 4 },
        { kind: "showPicture", pictureId: "1", resourceId: "", x: 160, y: 120 },
        { kind: "changeItem", itemId, op: "+=", amount: 2 },
        { kind: "shop", itemIds: [itemId] },
        { kind: "changeParty", actorId, action: "add" },
        { kind: "changeGold", op: "-=", amount: 50 },
        { kind: "battleProcessing", troopId: "", canEscape: true, canLose: false },
        { kind: "playAudio", resourceId: "bgm", loop: true },
        { kind: "stopAudio" },
        { kind: "setSwitch", switchId, value: true },
        { kind: "gameOver" },
        { kind: "wait", ms: 500 },
      ];
      for (const cmd of samples) {
        const preview = renderWithFakeDom(() => renderCommandPreview(cmd));
        expect(preview.dataset.previewKind).toBe(cmd.kind);
        expect(findByTestId(preview, "event-command-preview-body")).toBeTruthy();
      }
    });

    it("places the message preview where the line's window position says", () => {
      const overlayOf = (position?: "auto" | "top" | "center" | "bottom") =>
        renderWithFakeDom(() =>
          renderCommandPreview({ kind: "text", speaker: "촌장", body: "마을에 온 걸 환영하네.", ...(position ? { position } : {}) })
        ).querySelector(".dialogue-overlay");
      expect(overlayOf()?.className).toContain("position-bottom");
      expect(overlayOf("bottom")?.className).toContain("position-bottom");
      expect(overlayOf("auto")?.className).toContain("position-bottom");
      expect(overlayOf("top")?.className).toContain("position-top");
      expect(overlayOf("top")?.className).not.toContain("position-bottom");
      expect(overlayOf("center")?.className).toContain("position-center");
    });

    it("keeps a bust portrait's message preview at the bottom and says why", () => {
      const preview = renderWithFakeDom(() =>
        renderCommandPreview(
          { kind: "text", speaker: "촌장", body: "마을에 온 걸 환영하네.", position: "top" },
          { face: { resourceId: "hero-bust" } },
        )
      );
      expect(preview.querySelector(".dialogue-overlay")?.className).toContain("position-bottom");
      expect(findByTestId(preview, "ecp-message-position-note")?.textContent).toBe(PORTRAIT_BOTTOM_NOTICE);
    });

    it("renders the RM2003 message window for text and reflects speaker + body", () => {
      const preview = renderWithFakeDom(() => renderCommandPreview({ kind: "text", speaker: "촌장", body: "마을에 온 걸 환영하네." }));
      expect(findByTestId(preview, "ecp-message-window")).toBeTruthy();
      expect(findByTestId(preview, "ecp-message-speaker")?.className).toContain("ecp-message-speaker-nameplate");
      expect(preview.textContent).toContain("촌장");
      expect(preview.textContent).toContain("마을에 온 걸");
    });

    it("shows an actor name code in the name box as that actor's current name", () => {
      const bs = String.fromCharCode(92);
      const preview = renderWithFakeDom(() =>
        renderCommandPreview({ kind: "text", speaker: `${bs}n[1]`, body: "오늘도 모험이야." })
      );
      const speaker = findByTestId(preview, "ecp-message-speaker");
      expect(speaker?.textContent).toBe(store.getCurrent().database.actors[0]?.name);
      expect(speaker?.textContent).not.toContain(bs);
    });


    it("text preview resolves control codes and shows effect examples without raw escape syntax", () => {
      const bs = String.fromCharCode(92);
      const bodyText = [
        "값 ",
        bs + "v[1]",
        " 이름 ",
        bs + "n[1]",
        bs + "c[2]",
        " 색",
        bs + "s[3]",
        bs + "$",
        bs + "!",
        bs + ".",
        bs + "|",
        bs + ">",
        bs + "<",
        bs + "^",
        bs + "_",
        "끝",
      ].join("");
      const preview = renderWithFakeDom(() =>
        renderCommandPreview({ kind: "text", body: bodyText })
      );
      const body = findByTestId(preview, "ecp-message-body");
      expect(body).toBeTruthy();
      if (!body) return;
      expect(body.textContent).toContain("값 0");
      expect(body.textContent).toContain("이름");
      expect(body.textContent).toContain("색");
      expect(body.textContent).toContain(" 끝");
      expect(body.textContent).not.toContain(bs);
      expect(findByTestId(body, "ecp-message-control-pause")?.textContent).toContain("키 입력 대기");
      expect(findByTestId(body, "ecp-message-control-gold")?.textContent).toContain("소지금 창 · 0 G");
      expect(findByTestId(body, "ecp-message-control-speed")?.textContent).toContain("표시 속도 3");
      expect(findByTestId(body, "ecp-message-control-fast-on")?.textContent).toContain("즉시 표시 시작");
      expect(findByTestId(body, "ecp-message-control-skip-wait")?.textContent).toContain("입력 대기 없이 닫기");
      expect(findByTestId(body, "ecp-message-control-space")?.textContent).toContain("반각 공백");
      expect(body.textContent.indexOf("색")).toBeLessThan(body.textContent.indexOf("표시 속도 3"));
      expect(body.textContent.indexOf("표시 속도 3")).toBeLessThan(body.textContent.indexOf("소지금 창 · 0 G"));
      expect(body.textContent.indexOf("반각 공백")).toBeLessThan(body.textContent.lastIndexOf("끝"));
      expect(findByTestId(preview, "ecp-message-control-badges")).toBeNull();
    });

    it("text editor keeps preview and easy tools primary while raw controls stay advanced", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody(
          { path: [], actions: noopActions, lockKind: true },
          { kind: "text", body: "안녕" }
        )
      );
      expect(findByTestId(body, "event-command-text-editor")).toBeTruthy();
      expect(findByTestId(body, "event-command-text-live-preview")).toBeTruthy();
      expect(findByTestId(body, "event-command-text-body")).toBeTruthy();
      expect(findByTestId(body, "event-command-text-speaker")).toBeTruthy();
      expect(findByTestId(body, "event-command-text-easy-tools")).toBeTruthy();
      expect(findByTestId(body, "event-command-text-tool-emphasis")).toBeTruthy();
      const controlDetails = findByTestId(body, "event-command-text-control-details") as HTMLDetailsElement | null;
      expect(controlDetails?.open).toBe(false);
      expect(findByTestId(body, "event-command-text-palette")).toBeTruthy();
      expect(findByTestId(body, "event-command-text-insert-variable")?.textContent).toContain("변수");
    });


    it("renders digit-slot preview for inputNumber with prompt and optional pad", () => {
      const preview = renderWithFakeDom(() =>
        renderCommandPreview({ kind: "inputNumber", variableId: "", digits: 4, prompt: "비밀번호", showPad: true })
      );
      expect(findByTestId(preview, "ecp-number-window")).toBeTruthy();
      expect(findByTestId(preview, "ecp-number-slots")).toBeTruthy();
      expect(findByTestId(preview, "ecp-number-pad")).toBeTruthy();
      expect(preview.textContent).toContain("확인");
      expect(preview.textContent).not.toContain("OK");
      expect(preview.textContent).toContain("비밀번호");
      expect(preview.textContent).toContain("4자리");
      expect(preview.textContent).toContain("대기 중");
      const slots = findByTestId(preview, "ecp-number-slots");
      // FakeDom uses childNodes (no HTMLElement.children).
      expect(slots?.childNodes?.length).toBe(4);
      // Idle preview: empty slots, no filled sample digits like "1234".
      const slotNodes = [...(slots?.childNodes ?? [])] as Array<{ className?: string; textContent?: string }>;
      expect(slotNodes.every((node) => String(node.className ?? "").includes("empty"))).toBe(true);
      expect(slotNodes.some((node) => String(node.className ?? "").includes("cursor"))).toBe(true);
      expect(slotNodes.every((node) => !(node.textContent ?? "").trim())).toBe(true);
    });

    it("inputNumber form uses digit chips only and labels window title / keypad option", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody(
          { path: [0], actions: noopActions, lockKind: true },
          { kind: "inputNumber", variableId: "var_0001", digits: 2, prompt: "PIN", showPad: true }
        )
      );
      expect(findByTestId(body, "input-number-command-body")).toBeTruthy();
      expect(findByTestId(body, "input-number-digit-stepper")).toBeTruthy();
      expect(findByTestId(body, "input-number-digit-chip-2")?.className).toContain("active");
      expect(findByTestId(body, "input-number-digits")).toBeTruthy();
      expect(body.textContent).toContain("안내 문구");
      expect(body.textContent).toContain("화면에 숫자 버튼 보이기");
      expect(body.textContent).not.toContain("창 제목");
      expect(body.textContent).not.toContain("자릿수");
    });

    it("inputNumber preview without pad shows a Korean confirm mock instead of a keypad", () => {
      const preview = renderWithFakeDom(() =>
        renderCommandPreview({ kind: "inputNumber", variableId: "var_0001", digits: 1 })
      );
      const mock = findByTestId(preview, "ecp-number-ok-mock");
      expect(mock?.textContent).toBe("확인");
      expect(findByTestId(preview, "ecp-number-pad")).toBeFalsy();
      expect(preview.textContent).toContain("1자리");
      expect(preview.textContent).not.toContain("OK");
    });

    it("setVariable form shows labeled fields, op segments, and live formula", () => {
      const project = store.getCurrent();
      const variableId = project.variables[0]?.id ?? "var_0001";
      const body = renderWithFakeDom(() =>
        renderCommandBody(
          { path: [0], actions: noopActions, lockKind: true },
          { kind: "setVariable", variableId, op: "+=", value: 7 }
        )
      );
      expect(findByTestId(body, "event-command-variable-form")).toBeTruthy();
      expect(findByTestId(body, "event-command-variable-op")).toBeTruthy();
      expect(findByTestId(body, "event-command-variable-value-source")).toBeTruthy();
      expect(findByTestId(body, "event-command-variable-number-value")).toBeTruthy();
      expect(body.textContent).toContain("대상 변수");
      expect(body.textContent).toContain("값은");
      expect(body.textContent).toContain("나누기는 나머지를 버립니다");
      const formula = findByTestId(body, "event-command-variable-formula");
      expect(formula?.textContent).toContain("+=");
      expect(formula?.textContent).toContain("7");
    });

    it("setVariable preview renders formula card for number and variable operands", () => {
      const project = store.getCurrent();
      const variableId = project.variables[0]?.id ?? "var_0001";
      const numberPreview = renderWithFakeDom(() =>
        renderCommandPreview({ kind: "setVariable", variableId, op: "=", value: 12 })
      );
      expect(findByTestId(numberPreview, "ecp-variable-card")).toBeTruthy();
      expect(findByTestId(numberPreview, "ecp-variable-formula")?.textContent).toContain("12");
      expect(numberPreview.textContent).toContain("값은 숫자");

      const varPreview = renderWithFakeDom(() =>
        renderCommandPreview({
          kind: "setVariable",
          variableId,
          op: "+=",
          value: { kind: "var", id: variableId },
        })
      );
      expect(findByTestId(varPreview, "ecp-variable-formula")?.textContent).toContain("+=");
      expect(varPreview.textContent).toContain("값은 변수");
    });

    it("changeFace play mock shows a tall message window with crop-only face (no editor meta card)", () => {
      const preview = renderWithFakeDom(() =>
        renderCommandPreview({
          kind: "changeFace",
          resourceId: "easyrpg-faceset-actor1-00",
          position: "left",
          flipHorizontally: false,
        })
      );
      expect(findByTestId(preview, "ecp-message-window")).toBeTruthy();
      expect(findByTestId(preview, "event-command-face-crop-shell")).toBeTruthy();
      expect(findByTestId(preview, "event-command-face-crop")).toBeTruthy();
      expect(findByTestId(preview, "event-command-face-preview")).toBeNull();
      expect(preview.textContent).toContain("대사 창에");
      expect(findByTestId(preview, "ecp-face-caption")?.textContent).toContain("왼쪽");
      // 얼굴 한 칸 = 파일 한 장 — 캡션은 순번("얼굴 1")을 다시 말하지 않는다.
      expect(findByTestId(preview, "ecp-face-caption")?.textContent).not.toMatch(/얼굴\s*\d/);
    });

    it("renders displayTextSettings with clean windowskin mock, position stage, and option badges", () => {
      const preview = renderWithFakeDom(() =>
        renderCommandPreview({
          kind: "displayTextSettings",
          format: "normal",
          position: "bottom",
          preventObscuringPlayer: true,
          allowEventMovementDuringWait: false,
        })
      );
      const win = findByTestId(preview, "ecp-message-window");
      expect(win).toBeTruthy();
      // System.png 시트를 인라인 border-image 로 붙이지 않는다 (팔레트 오염 방지).
      expect(String(win?.style?.borderImageSource ?? "")).not.toMatch(/System\.png/i);
      expect(win?.dataset?.systemResource).toBeUndefined();
      expect(findByTestId(preview, "ecp-settings-stage")?.className).toContain("pos-bottom");
      const badges = findByTestId(preview, "ecp-settings-badges");
      expect(badges?.textContent).toContain("일반");
      expect(badges?.textContent).toContain("하단");
      expect(badges?.textContent).toContain("가림 방지 켜짐");
      expect(badges?.textContent).toContain("이벤트 이동 정지");
    });

    it("groups displayTextSettings form into format/position segments and options fieldsets", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody(
          { path: [], actions: noopActions, lockKind: true },
          {
            kind: "displayTextSettings",
            format: "transparent",
            position: "top",
            preventObscuringPlayer: false,
            allowEventMovementDuringWait: true,
          }
        )
      );
      expect(findByTestId(body, "event-command-message-settings")).toBeTruthy();
      expect(findByTestId(body, "event-command-message-format")).toBeTruthy();
      expect(findByTestId(body, "event-command-message-position")).toBeTruthy();
      expect(findByTestId(body, "event-command-message-format-segment-transparent")?.className).toContain("selected");
      expect(findByTestId(body, "event-command-message-position-segment-top")?.className).toContain("selected");
      expect(findByTestId(body, "event-command-message-format-segment-normal")).toBeTruthy();
      expect(findByTestId(body, "event-command-message-position-segment-center")).toBeTruthy();
      expect(findByTestId(body, "event-command-message-position-segment-bottom")).toBeTruthy();
      expect(findByTestId(body, "event-command-message-prevent-obscuring")).toBeTruthy();
      expect(findByTestId(body, "event-command-message-allow-movement")).toBeTruthy();
      expect(body.textContent).toContain("윈도우 표시 형식");
      expect(body.textContent).toContain("윈도우 위치");
      expect(body.textContent).toContain("옵션");
    });

    it("shows the move tape with direction chips and repeat/wait badges (SVG-less env falls back to tape)", () => {
      const preview = renderWithFakeDom(() =>
        renderCommandPreview({ kind: "moveEvent", eventId: "", route: { moves: [{ kind: "move", dir: "up" }, { kind: "wait" }], repeat: true, wait: true } })
      );
      const tape = findByTestId(preview, "ecp-move-tape");
      expect(tape).toBeTruthy();
      expect(tape?.textContent).toContain("↑");
      expect(preview.textContent).toContain("반복");
      expect(preview.textContent).toContain("완료까지 대기");
    });

    it("newCommand(moveEvent) defaults to at least one step for visible trajectory", () => {
      const cmd = newCommand("moveEvent");
      expect(cmd.kind).toBe("moveEvent");
      if (cmd.kind !== "moveEvent") return;
      expect(cmd.route.moves.length).toBeGreaterThanOrEqual(1);
    });

    it("move-route editor stacks multiple adds locally and shows path preview + command list", () => {
      let staged: Command = { kind: "moveEvent", eventId: "", route: { moves: [], repeat: false } };
      const actions: CommandListActions = {
        ...noopActions,
        replaceCommand: (_path, command) => {
          staged = command;
        },
      };
      const body = renderWithFakeDom(() => renderCommandBody({ path: [], actions, lockKind: true }, staged));
      expect(findByTestId(body, "move-route-editor")).toBeTruthy();
      expect(findByTestId(body, "move-route-path-preview")).toBeTruthy();
      expect(findByTestId(body, "move-route-command-list")).toBeTruthy();

      findByTestId(body, "move-route-add-move-up")?.click();
      findByTestId(body, "move-route-add-move-right")?.click();
      expect(staged.kind).toBe("moveEvent");
      if (staged.kind !== "moveEvent") return;
      expect(staged.route.moves).toEqual([
        { kind: "move", dir: "up" },
        { kind: "move", dir: "right" },
      ]);
      expect(findByTestId(body, "move-route-command-1")?.textContent).toContain("위 이동");
      expect(findByTestId(body, "move-route-command-2")?.textContent).toContain("오른쪽 이동");
      expect(findByTestId(body, "move-route-summary")?.textContent).toContain("위 이동 -> 오른쪽 이동");
      expect(findByTestId(body, "ecp-move-preview")).toBeTruthy();
    });

    it("empty move-route still shows path preview shell and command add panel", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody(
          {
            path: [],
            actions: noopActions,
            lockKind: true,
          },
          { kind: "moveEvent", eventId: "", route: { moves: [], repeat: false } },
        )
      );
      expect(findByTestId(body, "move-route-editor")).toBeTruthy();
      expect(findByTestId(body, "move-route-path-preview")).toBeTruthy();
      expect(findByTestId(body, "move-route-help")).toBeTruthy();
      expect(findByTestId(body, "ecp-move-preview")).toBeTruthy();
      expect(findByTestId(body, "move-route-add-move-up")).toBeTruthy();
      expect(findByTestId(body, "move-route-parameters-details")).toBeTruthy();
      // 매개변수는 접힌 채로 시작 — 주 작업면이 먼저 보인다.
      const params = findByTestId(body, "move-route-parameters-details") as unknown as { open?: boolean };
      expect(params?.open).toBeFalsy();
    });

    it("summarizes fork branches with then/else counts", () => {
      const preview = renderWithFakeDom(() =>
        renderCommandPreview({ kind: "fork", condition: { kind: "switch", switchId: "", value: true }, then: [{ kind: "text", body: "a" }, { kind: "text", body: "b" }] })
      );
      expect(findByTestId(preview, "ecp-fork-preview")).toBeTruthy();
      expect(preview.textContent).toContain("2개 명령");
      expect(preview.textContent).toContain("분기 없음");
    });

    it("setEventGraphicPattern shows charset sprite preview instead of text-only summary", () => {
      const preview = renderWithFakeDom(() =>
        renderCommandPreview({
          kind: "setEventGraphicPattern",
          eventId: "ev_house_door_77_map_village_77_48x48_1",
          pattern: 24,
        })
      );
      expect(findByTestId(preview, "ecp-pattern-stage")).toBeTruthy();
      expect(findByTestId(preview, "ecp-pattern-sprite")).toBeTruthy();
      expect(findByTestId(preview, "ecp-pattern-caption")?.textContent).toContain("ev_house_door");
      expect(preview.textContent).toContain("아래");
      expect(preview.textContent).toContain("왼쪽");
    });

    it("setEventGraphicPattern editor uses RM2003 graphic picker layout", () => {
      let staged: Command = {
        kind: "setEventGraphicPattern",
        eventId: "ev_door",
        pattern: 24, // ch0 down pattern0 closed door
      };
      const actions: CommandListActions = {
        ...noopActions,
        replaceCommand: (_path, command) => {
          staged = command;
        },
      };
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [], actions, lockKind: true }, staged)
      );
      expect(findByTestId(body, "event-command-frame-editor")).toBeTruthy();
      // Same shell as page graphic dialog: file list + 8 character chips + direction/pattern radios.
      expect(findByTestId(body, "event-graphic-resource-list")).toBeTruthy();
      expect(findByTestId(body, "event-command-frame-character-grid")).toBeTruthy();
      expect(findByTestId(body, "event-command-frame-direction-group")).toBeTruthy();
      expect(findByTestId(body, "event-command-frame-pattern-group")).toBeTruthy();
      expect(findByTestId(body, "event-command-frame-probe")).toBeTruthy();
      expect(findByTestId(body, "event-command-frame-door-seq")).toBeTruthy();
      // Door open step 2 = direction up, pattern left → frame 0 for ch0.
      findByTestId(body, "event-command-frame-door-step-2")?.click();
      expect(staged.kind).toBe("setEventGraphicPattern");
      if (staged.kind !== "setEventGraphicPattern") return;
      expect(staged.pattern).toBe(0);
    });

    it("locks the command-kind select when editing an existing command, keeps it for new commands", () => {
      const cmd: Command = { kind: "text", body: "hi" };
      const locked = renderWithFakeDom(() => renderCommandBody({ path: [], actions: noopActions, lockKind: true }, cmd));
      const unlocked = renderWithFakeDom(() => renderCommandBody({ path: [], actions: noopActions }, cmd));
      expect(hasKindSelect(locked)).toBe(false);
      expect(hasKindSelect(unlocked)).toBe(true);
    });

    it("preserves fork branches through the edit dialog OK path", () => {
      const switchId = store.getCurrent().switches[0]!.id;
      const original: Command = {
        kind: "fork",
        condition: { kind: "switch", switchId, value: true },
        then: [{ kind: "text", body: "참 분기" }],
        else: [{ kind: "text", body: "거짓 분기" }],
      };
      let applied: Command | null = null;
      openEventCommandEditDialog({ initial: original, lockKind: true, onApply: (command) => (applied = command) });
      const body = globalThis.document.body as unknown as FakeNode;
      const ok = findByTestId(body, "event-command-edit-ok");
      expect(ok).toBeTruthy();
      ok?.click();
      expect(applied).toEqual(original);
    });

    it.each([
      ["empty dialogue", { kind: "text", speaker: "", body: "" } as Command, (c: Command) => ({ ...c, body: "안녕" }) as Command],
      ["unselected switch", { kind: "setSwitch", switchId: "", value: true } as Command,
        (c: Command) => ({ ...c, switchId: store.getCurrent().switches[0]!.id }) as Command],
      ["sound without a sound", { kind: "playAudio", resourceId: "", loop: true } as Command,
        (c: Command) => ({ ...c, resourceId: "cc0-music-field-loop" }) as Command],
      ["actor rename without an actor",
        { kind: "m2Command", commandId: "m2-022-change-actor-name", fields: { target: "", value: "레안" } } as Command,
        (c: Command) => ({ ...c, fields: { target: store.getCurrent().database.actors[0]!.id, value: "레안" } }) as Command],
    ])("keeps the dialog open on OK while a required value is empty (%s)", (_name, initial, fill) => {
      const applied: Command[] = [];
      openEventCommandEditDialog({ initial, onApply: (command) => applied.push(command) });
      const body = globalThis.document.body as unknown as FakeNode;
      const required = findByTestId(body, "event-command-edit-required")!;
      expect(required.hidden).toBe(true);
      findByTestId(body, "event-command-edit-ok")!.click();
      expect(applied).toEqual([]);
      expect(findByTestId(body, "event-command-edit-dialog")).toBeTruthy();
      expect(required.hidden).toBe(false);
      expect(required.textContent?.trim().length).toBeGreaterThan(0);

      const filled = fill(initial);
      expect(commandRequiredProblems(filled)).toEqual([]);
    });

    it.each(["set", "reset"] as const)("switches a victory music %s command to the field slot", (operation) => {
      const resourceId = "cc0-music-field-loop";
      const initial: Command = {
        kind: "m2Command", commandId: "m2-027-change-system-bgm",
        fields: { slot: "battle", cue: "victory", operation, resourceId, volume: 42 },
      };
      const body = globalThis.document.body as unknown as FakeNode;
      const applied: Command[] = [];
      openEventCommandEditDialog({ initial, onApply: command => applied.push(command) });
      const cue = findByTestId(body, "m2-command-cue-option-select")!;
      expect(cue.value).toBe("victory");
      expect(findByTestId(body, "m2-command-slot-option-select")).toBeNull();

      cue.value = "field";
      cue.dispatchEvent(new Event("change"));
      expect(findByTestId(body, "m2-command-cue-option-select")).toBeNull();
      expect(findByTestId(body, "m2-command-slot-option-select")?.value).toBe("field");
      findByTestId(body, "event-command-edit-ok")!.click();

      const expectedId = operation === "set" ? resourceId : "";
      expect(applied).toEqual([{ ...initial, fields: { slot: "field", resourceId: expectedId } }]);
      const project = store.getCurrent();
      const session = startSession(project);
      createInterpreter(applied, session, project).start();
      expect(systemAudioOverride(session.m2Runtime, "field")).toBe(expectedId || undefined);
      expect(session.systemAudioOverrides?.bgm?.victory).toBeUndefined();
    });

    it("keeps the selected silent cue when switching to field music is rejected", () => {
      const initial: Command = {
        kind: "m2Command", commandId: "m2-027-change-system-bgm",
        fields: { slot: "battle", cue: "battle", operation: "set", resourceId: "", volume: 100 },
      };
      const body = globalThis.document.body as unknown as FakeNode;
      const applied: Command[] = [];
      openEventCommandEditDialog({ initial, onApply: command => applied.push(command) });
      const cue = findByTestId(body, "m2-command-cue-option-select")!;

      cue.value = "victory";
      cue.dispatchEvent(new Event("change"));
      cue.value = "field";
      cue.dispatchEvent(new Event("change"));

      expect(cue.value).toBe("victory");
      expect(findByTestId(body, "toast")?.textContent).toContain("필드 기본곡은 무음으로 지정할 수 없습니다.");
      findByTestId(body, "event-command-edit-ok")!.click();
      expect(applied).toEqual([{ ...initial, fields: { ...initial.fields, cue: "victory" } }]);

      const project = store.getCurrent();
      const session = startSession(project);
      createInterpreter(applied, session, project).start();
      expect(session.systemAudioOverrides?.bgm?.victory).toEqual({ resourceId: "", volume: 100 });
      expect(systemAudioOverride(session.m2Runtime, "field")).toBeUndefined();
    });

    it.each([
      [{ slot: "defeat", cue: "confirm", operation: "set", resourceId: "cc0-sound-ui-confirm", volume: 42 }, "cue", "confirm", "cancel"],
      [{ slot: "defeat", value: "cc0-sound-ui-confirm" }, "slot", "defeat", "escape"],
    ] as const)("edits system SE through its saved %s format", (fields, key, selected, next) => {
      const initial: Command = { kind: "m2Command", commandId: "m2-028-change-system-se", fields };
      const applied: Command[] = [];
      openEventCommandEditDialog({ initial, onApply: command => applied.push(command) });
      const body = globalThis.document.body as unknown as FakeNode;
      const picker = findByTestId(body, `m2-command-${key}-option-select`)!;
      expect(picker.value).toBe(selected);
      picker.value = next;
      picker.dispatchEvent(new Event("change"));
      findByTestId(body, "event-command-edit-ok")!.click();
      expect(applied).toEqual([{ ...initial, fields: { ...fields, [key]: next } }]);
    });

    it("updates the mounted shop list after a staged catalog add", () => {
      const project = store.getCurrent();
      const first = project.database.items[0];
      const second = project.database.items[1];
      expect(first && second).toBeTruthy();
      if (!first || !second) return;

      openEventCommandEditDialog({
        initial: { kind: "shop", itemIds: [first.id] },
        lockKind: true,
        onApply: () => {},
      });
      const body = globalThis.document.body as unknown as FakeNode;
      // 담기는 목록 행의 체크박스로 한다 — 예전의 aria-hidden 트레이 안 select+버튼은 없어졌다.
      expect(findByTestId(body, "shop-available-items")).toBeNull();
      expect(findByTestId(body, "shop-add-item")).toBeNull();

      findByTestId(body, "shop-add-goods")!.click();
      const check = findByTestId(body, `shop-item-check-${second.id}`) as FakeElement | null;
      expect(check).toBeTruthy();
      if (!check) return;
      check.checked = true;
      check.dispatchEvent(new Event("change", { bubbles: true }));
      findByTestId(body, "shop-catalog-add")!.click();

      const saleList = findByTestId(body, "shop-sale-list") as FakeElement | null;
      expect(saleList).toBeTruthy();
      expect(findByTestId(saleList!, `shop-item-row-${first.id}`)).toBeTruthy();
      expect(findByTestId(saleList!, `shop-item-row-${second.id}`)).toBeTruthy();
      expect(findByTestId(body, "shop-catalog-dialog")).toBeNull();
      expect(findByTestId(body, "shop-stock-pool")).toBeNull();
    });

    it("shows shop transaction branch controls when branch checkbox is enabled", () => {
      openEventCommandEditDialog({
        initial: { kind: "shop", itemIds: [] },
        lockKind: true,
        onApply: () => {},
      });
      const body = globalThis.document.body as unknown as FakeNode;
      findByTestId(body, "shop-tab-branches")!.click();
      const branch = findByTestId(body, "shop-branch-on-transaction") as FakeElement | null;
      expect(branch).toBeTruthy();
      if (!branch) return;
      branch.checked = true;
      branch.dispatchEvent(new Event("change", { bubbles: true }));

      const controls = findByTestId(body, "shop-transaction-branch-controls");
      expect(controls).toBeTruthy();
      expect(controls?.className.includes("is-hidden")).toBe(false);
    });

    it("shop owns its updates while choices still rebuild on cancel structure", () => {
      expect(
        shouldRerenderCommandForm(
          { kind: "shop", itemIds: ["a"] },
          { kind: "shop", itemIds: ["a", "b"] }
        )
      ).toBe(false);
      expect(
        shouldRerenderCommandForm(
          { kind: "shop", itemIds: [], branchOnTransaction: false },
          { kind: "shop", itemIds: [], branchOnTransaction: true }
        )
      ).toBe(false);
      expect(
        shouldRerenderCommandForm(
          { kind: "shop", itemIds: ["a"], messageType: "welcome" },
          { kind: "shop", itemIds: ["a"], messageType: "direct" }
        )
      ).toBe(false);
      expect(
        shouldRerenderCommandForm(
          { kind: "choices", options: [{ text: "예", branch: [] }] },
          { kind: "choices", options: [{ text: "예", branch: [] }], cancelBehavior: "branch" }
        )
      ).toBe(true);
    });

    it("shouldRerenderCommandForm flags fork structure and loop body length", () => {
      expect(
        shouldRerenderCommandForm(
          { kind: "fork", condition: { kind: "switch", switchId: "a", value: true }, then: [] },
          { kind: "fork", condition: { kind: "variable", variableId: "v", op: "==", value: 1 }, then: [] },
        ),
      ).toBe(true);
      expect(
        shouldRerenderCommandForm(
          { kind: "fork", condition: { kind: "switch", switchId: "a", value: true }, then: [] },
          { kind: "fork", condition: { kind: "switch", switchId: "a", value: true }, then: [], else: [] },
        ),
      ).toBe(true);
      expect(
        shouldRerenderCommandForm(
          { kind: "loop", body: [] },
          { kind: "loop", body: [{ kind: "text", body: "x" }] },
        ),
      ).toBe(true);
      expect(
        shouldRerenderCommandForm(
          { kind: "fork", condition: { kind: "switch", switchId: "a", value: true }, then: [] },
          { kind: "fork", condition: { kind: "switch", switchId: "a", value: false }, then: [] },
        ),
        ).toBe(false);
    });

    it("uses a Korean caption and a save-screen stage for openSaveMenu", () => {
      const preview = renderWithFakeDom(() => renderCommandPreview({ kind: "openSaveMenu" }));
      expect(preview.querySelector(".ecp-caption")?.textContent).toBe("저장 메뉴 열기");
      expect(preview.querySelector(".ecp-stage")).toBeTruthy();
      expect(preview.classList.contains("ecp-summary-only")).toBe(false);
    });

    it("renders leftover advanced-dialogue m2 commands as a message stage, not a 0x0 summary", () => {
      const preview = renderWithFakeDom(() =>
        renderCommandPreview({
          kind: "m2Command",
          commandId: "m2-209-advanced-dialogue",
          fields: { speaker: "미나", body: "숲으로 가자." },
        }),
      );
      expect(findByTestId(preview, "ecp-message-window")).toBeTruthy();
      expect(preview.querySelector(".ecp-stage")).toBeTruthy();
      expect(preview.textContent).toContain("미나");
      expect(preview.textContent).toContain("숲으로 가자");
      expect(preview.classList.contains("ecp-summary-only")).toBe(false);
    });

    it("keeps the native text editor's inline stage so the collapsed side panel is not the only preview", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [], actions: noopActions, lockKind: true }, { kind: "text", speaker: "촌장", body: "마을에 온 걸 환영하네." }),
      );
      expect(body.querySelector(".event-command-text-preview-canvas .ecp-stage")).toBeTruthy();
      expect(findByTestId(body, "ecp-message-window")).toBeTruthy();
    });

    it("marks summary-only commands so the preview column can collapse", () => {
      const preview = renderWithFakeDom(() =>
        renderCommandPreview({
          kind: "m2Command",
          commandId: "m2-079-change-menu-access",
          fields: {},
        }),
      );
      expect(preview.classList.contains("ecp-summary-only")).toBe(true);
      expect(preview.querySelector(".ecp-summary-card")).toBeTruthy();
      expect(preview.querySelector(".ecp-stage")).toBeNull();
    });

    it("renders a visual stage for Screen Effect instead of a summary card", () => {
      const preview = renderWithFakeDom(() =>
        renderCommandPreview({
          kind: "m2Command",
          commandId: "m2-202-screen-effect",
          fields: { effect: "flash", value: "white", durationMs: 400 },
        }),
      );
      expect(findByTestId(preview, "ecp-screen-effect-stage")).toBeTruthy();
      expect(findByTestId(preview, "ecp-runtime-effect")).toBeFalsy();
    });
  });
  function hasKindSelect(root: FakeElement): boolean {
    return findByPredicate(root, (element) => element.dataset.commandKindSelect === "true") !== null;
  }
  function findByPredicate(root: FakeNode, predicate: (element: FakeElement) => boolean): FakeElement | null {
    if (root instanceof FakeElement && predicate(root)) return root;
    for (const child of root.childNodes) {
      const match = findByPredicate(child, predicate);
      if (match) return match;
    }
    return null;
  }
});
