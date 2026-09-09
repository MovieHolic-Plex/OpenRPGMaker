import assert from "node:assert/strict";
import { runAudioAction } from "./runtimeQaAudio.mjs";
// 런타임 QA 하네스 — 부수효과 담당(vite 서버 · 브라우저 구동 · 디스크 쓰기).
// 순수 판정 로직은 ./runtimeQa.mjs 에 있고 여기서 소비만 한다.
// 설계: docs/superpowers/specs/2026-08-28-runtime-vision-qa-design.md
import { createServer as createNetServer } from "node:net";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { PNG } from "pngjs";
import {
  MAX_CLIPPED_AREA_RATIO,
  MIN_EFFECTIVE_ALPHA,
  MIN_INK_HEIGHT_PX,
  auditBattleText,
} from "./battleTextAudit.mjs";
import {
  evaluateExpect,
  normalizeScenario,
  renderSummary,
  shotFileName,
  shouldCaptureShot,
} from "./runtimeQa.mjs";

import { pauseRuntimeFrames, performObservedFrames, resumeRuntimeFrames } from "./runtimeQaFrames.mjs";
export { pauseRuntimeFrames, performObservedFrames, resumeRuntimeFrames } from "./runtimeQaFrames.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** exportEntry.ts 가 fetch 할 주소. 실제 파일이 아니라 page.route 로 가로채 채운다. */
const PROJECT_URL = "/__runtime-qa/project.json";
const PROJECT_ROUTE = "**/__runtime-qa/project.json";

/** 훅을 요구하는 op — 이들 앞에서는 런타임 훅 설치를 기다린다. */
const HOOK_OPS = new Set([
  "seed", "dir", "hold", "face", "action", "attack", "skill", "teleport",
  "pauseFrames", "stepFrames", "resumeFrames",
  // 체공 op 은 __oprnDebug / __oprnCharacterSprites 를 직접 읽는다.
  "playerRoute", "waitForLift", "waitForGrounded", "captureShadowSample",
]);

async function freePort() {
  return await new Promise((resolvePort, reject) => {
    const probe = createNetServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

/**
 * player-QA 전용 vite dev 서버를 띄운다.
 * 빈 포트를 직접 잡으므로 동시에 도는 워크트리들과 포트 경합이 없고,
 * 전용 cacheDir 을 쓰므로 공유 node_modules/.vite 를 흔들지 않는다.
 *
 * 파일 감시는 vite.player-qa.config.ts 에서 끈다(inotify 한도 포화 방지). 여기서 인라인으로
 * 넘기면 mergeConfig 가 null 을 삼켜 무효가 된다 — 설정 파일 쪽이 유일한 스위치다.
 */
export async function startPlayerQaServer(opts = {}) {
  const port = opts.port ?? (await freePort());
  const server = await createServer({
    configFile: join(REPO_ROOT, "vite.player-qa.config.ts"),
    server: { port, strictPort: true, host: "127.0.0.1" },
    logLevel: opts.logLevel ?? "warn",
  });
  await server.listen();
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    close: async () => {
      await server.close();
    },
  };
}

/** Subscribe on this scene's host before real input; a rejected action still completes.
 * No temporary window globals, polling, or arbitrary settling delay. */
export async function performObservedAction(page, trigger, timeoutMs = 10_000) {
  const pending = await page.evaluateHandle((timeout) => {
    const mirror = document.querySelector('[data-testid="runtime-state-json"]');
    const host = mirror?.parentElement;
    const debug = window.__oprnDebug;
    if (!host || !debug) throw new Error("QA action observation requires an instrumented scene");
    const sequence = (debug.readState().actionReceipt?.sequence ?? 0) + 1;
    let cancel;
    const promise = new Promise((resolveReceipt) => {
      const finish = (value) => {
        clearTimeout(deadline);
        host.removeEventListener("oprn:action", observed);
        resolveReceipt(value);
      };
      const observed = (event) => {
        if (event.detail.sequence !== sequence) return;
        finish({ receipt: event.detail, state: debug.readState(), mirror: JSON.parse(mirror.textContent) });
      };
      const deadline = setTimeout(() => finish({ error: `Missing scene action receipt ${sequence}` }), timeout);
      cancel = () => finish({ error: "Action observation cancelled" });
      host.addEventListener("oprn:action", observed);
    });
    return { promise, cancel: () => cancel() };
  }, timeoutMs);
  try {
    await trigger();
    const result = await pending.evaluate((entry) => entry.promise);
    if (result.error) throw new Error(result.error);
    return result;
  } finally {
    await pending.evaluate((entry) => entry.cancel());
    await pending.dispose();
  }
}

async function requireHooks(page) {
  await page.evaluate(() => new Promise((resolve, reject) => {
    const finish = () => { observer.disconnect(); clearTimeout(deadline); };
    const check = () => {
      if (window.__oprnDebug && document.querySelector('[data-testid="runtime-state-json"]')) {
        finish(); resolve();
      }
    };
    const observer = new MutationObserver(check);
    const deadline = setTimeout(() => { finish(); reject(new Error("QA scene did not become ready")); }, 120_000);
    // PlayScene installs hooks before the ready callback removes the boot overlay.
    observer.observe(document.documentElement, { childList: true, subtree: true });
    check();
  }));
}

/** testid 존재 판정. `attr`/`value` 를 주면 "그 속성값을 가진 요소가 있다" 로 좁힌다 —
 *  같은 testid 가 여럿인 노드(피해 팝업)에서 특정 대상(data-target-id) 것만 기다릴 때 쓴다. */
function testidPresentInPage([testid, attr, value]) {
  const nodes = document.querySelectorAll(`[data-testid='${testid}']`);
  if (attr === null) return nodes.length > 0;
  return Array.from(nodes).some((node) => node.getAttribute(attr) === value);
}

async function testidMatches(page, op) {
  const present = await page.evaluate(testidPresentInPage, [op.testid, op.attr ?? null, op.value ?? null]);
  return op.state === "absent" ? !present : present;
}

async function waitForTestid(page, op) {
  await page.waitForFunction(
    ([testid, state]) => {
      const present = document.querySelector(`[data-testid='${testid}']`) !== null;
      return state === "absent" ? !present : present;
    },
    [op.testid, op.state],
    { timeout: op.timeoutMs ?? 30_000 },
  );
}

/**
 * 마운트만 말고 **실제로 보이기까지** 기다린다. 상점·이름입력처럼 페이드로 뒤어오는
 * 창은 `waitFor: present` 직후에 조상 opacity 가 아직 0 이라, visibleText 축이 "화면에 없다
 * (alpha 0)" 로 붙는다(실제: shop-open 바로 그것). 여기서 공짜 대기(sleep)를 넣으면 하드웨어
 * 상황에 따라 통과 여부가 바뀌는 테스트가 된다. 시간이 아니라 **상태**를 기다린다 —
 * visibleText 가 보는 것과 동일한 조건(통과 조상 alpha · display · visibility · 상자 크기)을
 * 그대로 폴링하고, 제한 시간을 넘기만 하면 실패한다.
 */
async function waitForVisibleTestid(page, op) {
  await page.waitForFunction(
    ([testid, minAlpha]) => {
      const node = document.querySelector(`[data-testid="${testid}"]`);
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      let alpha = 1;
      for (let cursor = node; cursor && cursor !== document.documentElement; cursor = cursor.parentElement) {
        const style = getComputedStyle(cursor);
        if (style.display === "none" || style.visibility === "hidden") return false;
        alpha *= Number(style.opacity);
      }
      return alpha >= minAlpha;
    },
    // 축의 판정선과 **같은 값**이어야 한다(runtimeQa.mjs: alpha > 0.05). 1.0 에 가깝게 잡으면
    // 상점처럼 조상이 의도적으로 반투명한(0.96) 창은 영원히 조건을 못 넘어 30초 타임아웃이 난다(실측).
    [op.testid, op.minAlpha ?? 0.06],
    { timeout: op.timeoutMs ?? 30_000 },
  );
}

async function waitForRuntimePredicate(page, predicate, argument, timeoutMs = 30_000) {
  await page.waitForFunction(
    ([predicateSource, value]) => {
      const debug = window.__oprnDebug;
      if (!debug || typeof debug.readState !== "function") return false;
      const state = debug.readState();
      return Function("state", "value", `return (${predicateSource})(state, value)`)(state, value);
    },
    [predicate.toString(), argument],
    { timeout: timeoutMs },
  );
}

async function applyOp(page, op, runState) {
  switch (op.kind) {
    case "cinematic": {
      const { cinematicQaOp } = await import("./runtimeQaCinematics.mjs");
      await cinematicQaOp(page, op);
      return;
    }
    case "audioAction": {
      const evidence = await runAudioAction(page, op);
      runState.audio.push(evidence);
      assert.equal(evidence.error, null, JSON.stringify(evidence));
      return;
    }
    case "waitForEmote":
      await page.waitForFunction(
        ({ target, frame }) => window.__oprnEmotes?.().some((emote) =>
          emote.target === target && emote.frame === String(frame) && emote.alpha >= 0.9),
        { target: op.target, frame: op.frame }, { timeout: op.timeoutMs ?? 30_000 },
      );
      return;
    case "waitForRuntime":
      await waitForRuntimePredicate(page, (state) => Boolean(state.currentMapId), null, op.timeoutMs);
      return;
    case "waitForPosition":
      await waitForRuntimePredicate(
        page,
        (state, target) => state.currentMapId === target.mapId && state.x === target.x && state.y === target.y,
        { mapId: op.mapId, x: op.x, y: op.y },
        op.timeoutMs,
      );
      return;
    case "pauseFrames":
      await pauseRuntimeFrames(page);
      return;
    case "stepFrames": {
      const observed = await performObservedFrames(page, { frames: op.frames, deltaMs: op.deltaMs },
        op.key === undefined ? undefined : () => page.keyboard.press(op.key), op.timeoutMs);
      runState.frameReceipts.push(observed.receipt);
      return;
    }
    case "resumeFrames":
      await resumeRuntimeFrames(page);
      return;
    case "key":
      for (let i = 0; i < (op.times ?? 1); i += 1) {
        await page.keyboard.press(op.key);
      }
      return;
    case "seed":
      await page.evaluate((seed) => window.__oprnDebug.setSeed(seed), op.seed);
      return;
    case "setVitals":
      await page.evaluate(
        ([hp, mp, actorIds]) => {
          const ids = actorIds ?? window.__oprnDebug.readState().partyActorIds;
          for (const actorId of ids) window.__oprnSetActorVitals(actorId, hp, mp);
        },
        [op.hp, op.mp ?? 0, op.actorIds ?? null],
      );
      return;
    case "teleport":
      await page.evaluate(
        ([mapId, x, y]) => window.__oprnDebug.teleport(mapId, x, y),
        [op.mapId, op.x, op.y],
      );
      return;
    case "dir":
      await page.evaluate((dir) => window.__oprnInput.dir(dir), op.dir ?? null);
      return;
    case "hold":
      // 눌렀다 → 시간 경과 → 뗀다. 뗀 뒤 한 프레임 정착까지 본다(타일 스냅이 남아 있을 수 있다).
      // 경과 시간을 조건 대기로 바꿀 수 없는 유일한 경우가 "막혔다" 검증이다 — 기다릴 사건이 없다.
      await page.evaluate((dir) => window.__oprnInput.dir(dir), op.dir ?? null);
      await page.waitForTimeout(op.ms);
      await page.evaluate(() => window.__oprnInput.dir(null));
      await page.waitForFunction(() => true);
      return;
    case "face":
      await page.evaluate((dir) => window.__oprnInput.face(dir), op.dir);
      return;
    case "action":
      if (op.observe === true) {
        await performObservedAction(page, () => page.evaluate(() => window.__oprnInput.action()), op.timeoutMs);
      } else {
        await page.evaluate(() => window.__oprnInput.action());
      }
      return;
    case "attack":
    case "skill":
      await page.evaluate((kind) => window.__oprnInput[kind](), op.kind);
      return;
    case "playerRoute":
      await page.evaluate((moves) => window.__oprnDebug.playerRoute(moves), op.moves);
      return;
    case "waitForLift":
      // 체공은 몇 프레임 만에 끝난다. 고정 sleep 으로는 최고점을 놓치거나 이미 착지한
      // 화면을 찍는다 — 리프트 자체를 조건으로 기다린다.
      await page.waitForFunction(
        ([min, max]) => {
          const sprites = window.__oprnCharacterSprites ? window.__oprnCharacterSprites() : null;
          if (!sprites) return false;
          const lift = sprites.player.liftPx;
          return lift >= min && lift <= max;
        },
        [op.minPx ?? 1, op.maxPx ?? Number.MAX_SAFE_INTEGER],
        { timeout: op.timeoutMs ?? 30_000 },
      );
      return;
    case "captureShadowSample": {
      // 그림자가 떠 있는 지금의 프레임과 기하를 기록한다. 대조 프레임은 나중에
      // (캐릭터가 그 자리를 떠난 뒤) `playerShadowInkAtLeast` 가 직접 찍는다.
      const geometry = await readShadowGeometry(page);
      if (!geometry?.shadow?.visible) throw new Error("captureShadowSample: 보이는 그림자가 없다");
      runState.shadowSample = {
        png: await page.screenshot(),
        view: geometry.view,
        shadow: geometry.shadow,
      };
      return;
    }
    case "waitForGrounded":
      // liftPx 는 정수 반올림이라 착지 직전 프레임에서도 0 으로 보인다 — 상태기를 본다.
      await page.waitForFunction(
        () => {
          const sprites = window.__oprnCharacterSprites ? window.__oprnCharacterSprites() : null;
          return Boolean(sprites) && !sprites.player.airborne;
        },
        undefined,
        { timeout: op.timeoutMs ?? 30_000 },
      );
      return;
    case "waitFor":
      await waitForTestid(page, op);
      return;
    case "waitForVisible":
      await waitForVisibleTestid(page, op);
      return;
    case "pointerClick": {
      const info = await page.evaluate((testid) => {
        const nodes = document.querySelectorAll(`[data-testid="${testid}"]`);
        if (nodes.length !== 1) throw new Error(`expected one pointer target ${testid}, got ${nodes.length}`);
        const node = nodes[0];
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return {
          disabled: node.hasAttribute("disabled") || node.getAttribute("aria-disabled") === "true",
          hidden: style.visibility === "hidden" || style.display === "none",
          hit: Boolean(top) && node.contains(top),
          topTestid: top && top.dataset ? (top.dataset.testid ?? null) : null,
          box: { w: rect.width, h: rect.height, left: rect.left, top: rect.top },
        };
      }, op.testid);
      if (info.disabled) throw new Error(`pointer target disabled: ${op.testid}`);
      if (info.hidden) throw new Error(`pointer target hidden: ${op.testid}`);
      if (info.box.w < 1 || info.box.h < 1) throw new Error(`pointer target zero box: ${op.testid}`);
      // 가려짐을 그냥 넘기면 오버레이를 눌러도 성공으로 보고된다. 덮은 대상까지 적는다.
      if (!info.hit) throw new Error(`pointer target occluded: ${op.testid} (top=${info.topTestid ?? "unknown"})`);
      await page.mouse.click(info.box.left + info.box.w / 2, info.box.top + info.box.h / 2, { button: "left" });
      return;
    }
    case "waitForAttr":
      await page.waitForFunction(
        ([testid, attr, value]) => {
          const node = document.querySelector(`[data-testid="${testid}"]`);
          if (!node) return false;
          return node.getAttribute(attr) === value;
        },
        [op.testid, op.attr, op.value],
        { timeout: op.timeoutMs ?? 30_000 },
      );
      return;
    case "pressUntil": {
      // 매 입력 후 조건을 확인하므로 초과 입력이 구조적으로 불가능하다.
      // 정해진 횟수만 누르면 대사가 닫힌 뒤 남은 입력이 이벤트를 재발동시킨다.
      const max = op.maxPresses ?? 12;
      for (let i = 0; i < max; i += 1) {
        if (await testidMatches(page, op)) return;
        await page.keyboard.press(op.key);
        await page.waitForFunction(
          ([testid, state, attr, value]) => {
            const nodes = document.querySelectorAll(`[data-testid='${testid}']`);
            const present = attr === null
              ? nodes.length > 0
              : Array.from(nodes).some((node) => node.getAttribute(attr) === value);
            return state === "absent" ? !present : present;
          },
          [op.testid, op.state, op.attr ?? null, op.value ?? null],
          { timeout: op.timeoutMs ?? 30_000 },
        ).catch(() => undefined);
      }
      if (!(await testidMatches(page, op))) {
        throw new Error(
          `pressUntil: ${op.key} ${max}회 뒤에도 ${op.testid} 가 ${op.state} 가 되지 않았다`,
        );
      }
      return;
    }
    default:
      throw new Error(`구현되지 않은 op: ${op.kind}`);
  }
}

/** 전투 배틀러 기하 — 실브라우저 rect. CSS 레이아웃은 jsdom 으로 재현되지 않으므로
 *  적 배치 검증은 이 측정값만이 근거가 된다. 전투 화면이 없으면 null. */
function readBattlerGeometryInPage() {
  const scene = document.querySelector("[data-testid='battle-scene']");
  const field = scene?.querySelector("[data-testid='battle-field']");
  if (!scene || !field) return null;
  const boxOf = (r) => ({
    top: Math.round(r.top),
    bottom: Math.round(r.bottom),
    left: Math.round(r.left),
    right: Math.round(r.right),
    width: Math.round(r.width),
    height: Math.round(r.height),
  });
  const box = (node) => {
    const r = node.getBoundingClientRect();
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      left: Math.round(r.left),
      right: Math.round(r.right),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  };
  const enemies = [...field.querySelectorAll(".battle-enemy")].map((node) => {
    const image = node.querySelector(".battle-enemy-image");
    // 이름표는 **텍스트 실측 폭**이 필요하다. `.battle-enemy-hud` 는 고정 min-width 상자라
    // 서로 겹쳐도 글자는 안 겹칠 수 있고, 반대로 이름이 길면 상자를 넘어 옆 적과 겹친다.
    // Range 로 텍스트 노드의 실제 잉크 박스를 잰다.
    const nameNode = node.querySelector(".battle-enemy-name");
    let name = null;
    if (nameNode) {
      const range = document.createRange();
      range.selectNodeContents(nameNode);
      const inkRect = range.getBoundingClientRect();
      name = inkRect.width > 0 ? boxOf(inkRect) : box(nameNode);
      range.detach();
    }
    return {
      id: node.dataset.testid ?? null,
      node: box(node),
      image: image ? box(image) : null,
      name,
    };
  });
  const allies = [...field.querySelectorAll(".battle-actor-group .battle-actor")].map((node) => ({
    id: node.dataset.testid ?? null,
    node: box(node),
  }));
  // 적 그룹 박스: 저작 좌표(0..160)가 실제 px 로 어떻게 매핑되는지 재현하려면 필요하다.
  // 필드 != 그룹 박스다(`--battle-stage-inset-*` 만큼 안으로 들어간다).
  const enemyGroup = field.querySelector(".battle-enemy-group");
  return {
    skin: scene.dataset.battleSkin ?? null,
    directorStep: scene.dataset.battleDirectorStep ?? null,
    field: box(field),
    enemyGroup: enemyGroup ? box(enemyGroup) : null,
    enemies,
    allies,
  };
}

/**
 * @param watchedEventIds 발자국 사각을 실어 올 이벤트 id. 시나리오가 이름을 댄 것만 싣는다 —
 *   맵마다 이벤트가 수십 개라 전량은 매니페스트를 노이즈로 덮는다(이 하네스의 목적은
 *   컨텍스트 절약이다).
 * @param watchedTestids 글자를 **눈에 보이는지까지** 재 올 testid. `testids` 축은 DOM 존재만
 *   보므로 display:none 안의 노드도 통과한다 — 실제로 전투 적 HP 목록(.battle-enemy-list-panel)이
 *   숨겨진 스킨에서 `battle-enemy-list-hp-*` 를 단정하면 화면에 없는 숫자를 증거로 삼게 된다.
 */
async function readObserved(page, {
  auditBattleTextNodes = false, watchedEventIds = [], watchedTestids = [],
  watchedItemIds = [], watchedSpeciesIds = [], watchedPlaceableKeys = [], watchedTestidPrefixes = [],
} = {}) {
  const base = await page.evaluate((watched) => {
    const debug = window.__oprnDebug;
    const full = typeof debug?.readState === "function" ? debug.readState() : null;
    // 매니페스트에는 압축 상태만 남긴다 — switches/inventory 전량은 노이즈이고
    // 이 하네스의 목적(컨텍스트 절약)에 역행한다.
    const state = full
      ? {
          currentMapId: full.currentMapId,
          x: full.x,
          y: full.y,
          gold: full.gold,
          battleResult: full.battleResult ?? null,
          ...Object.fromEntries(["farmPlots", "energy", "makerInstances", "farmAnimals", "farmBuildingPlacements", "lifeRecovery", "actionReceipt"]
            .filter((key) => full[key] !== undefined).map((key) => [key, full[key]])),
          // 전량은 여전히 싣지 않는다(노이즈). 시나리오가 이름을 댄 항목만 싣는다 —
          // 싣지 않으면 expect 가 없는 값을 0 으로 읽어 정상을 결함으로, 결함을 정상으로
          // 만든다(실측: item_axe 가 실제로는 1인데 관측에 없어 0 으로 읽혔다).
          // 하루 전환은 채집물을 새로 뿌린다. 그 칸이 밭과 겹치면 조사 입력이 farming 이 아니라
          // lifeField(forage) 로 먹히므로(실측 2026-09-09: handled true, farmAttempts []),
          // 시나리오가 이름을 댄 칸의 placeable 을 실어 원인을 수치로 볼 수 있게 한다.
          ...(watched.placeableKeys.length
            ? { placeablesAt: Object.fromEntries(watched.placeableKeys.map((k) => [k, full.placeables?.[k] ?? null])) }
            : {}),
          ...(watched.itemIds.length
            ? { inventory: Object.fromEntries(watched.itemIds.map((id) => [id, full.inventory?.[id] ?? 0])) }
            : {}),
        }
      : null;
    // Count only named rewards. Unavailable collections are not evidence of zero ownership.
    if (state && watched.itemIds.length > 0) {
      state.inventoryCounts = full.inventory == null ? null : Object.fromEntries(
        watched.itemIds.map((id) => [id, full.inventory[id] ?? 0]),
      );
    }
    if (state && watched.speciesIds.length > 0) {
      state.ownedMonsterCounts = null;
      if (full.monsterInstances != null && Array.isArray(full.monsterParty) && Array.isArray(full.monsterBox)) {
        const ownedIds = new Set([...full.monsterParty, ...full.monsterBox]);
        state.ownedMonsterCounts = Object.fromEntries(watched.speciesIds.map((speciesId) => [
          speciesId,
          [...ownedIds].filter((id) => full.monsterInstances[id]?.speciesId === speciesId).length,
        ]));
      }
    }
    // 진단용: 시나리오가 요청한 접두사로 시작하는 실제 testid 를 그대로 싣는다.
    // "무엇이 없다"만 보면 메뉴 계층을 추측하게 된다 — 무엇이 있는지 봐야 한다.
    const domTestids = watched.testidPrefixes.length
      ? [...document.querySelectorAll("[data-testid]")]
          .map((node) => node.dataset.testid)
          .filter((id) => watched.testidPrefixes.some((p) => id.startsWith(p)))
      : [];
    const sprite = window.__oprnPlayerSprite ? window.__oprnPlayerSprite() : null;
    const characters = window.__oprnCharacterSprites ? window.__oprnCharacterSprites() : null;
    return {
      state,
      domTestids,
      // 체공 계측. 리프트는 원점 채널에 있어 x/y 로는 보이지 않고, 접지 y 는 체공 중에도
      // 타일 경계에 남아야 한다(깊이 y-소트·카메라·조명이 이 값을 읽는다).
      playerLiftPx: characters ? characters.player.liftPx : null,
      playerSpriteY: characters ? characters.player.y : null,
      playerDepth: characters ? characters.player.depth : null,
      // 발밑 그림자는 별개의 게임오브젝트다 — 존재·가시성·깊이 띠를 직접 읽는다.
      playerShadow: characters ? (characters.shadows.__player ?? null) : null,
      playerAirborne: characters ? characters.player.airborne : null,
      // 월드 → 화면 변환에 필요한 것들. 렌더된 픽셀을 직접 재려면 이게 있어야 한다.
      canvasView: (() => {
        const canvas = document.querySelector("canvas");
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const camera = window.__oprnCamera ? window.__oprnCamera() : null;
        if (!camera) return null;
        return {
          left: rect.left,
          top: rect.top,
          cssScaleX: rect.width / camera.width,
          cssScaleY: rect.height / camera.height,
          scrollX: camera.scrollX,
          scrollY: camera.scrollY,
          zoom: camera.zoom,
        };
      })(),
      testids: [...document.querySelectorAll("[data-testid]")].map((node) => node.dataset.testid),
      // 요청받은 testid 만 "보이는 글자" 로 재 온다. 상자·display·visibility·조상 opacity 를 함께
      // 봐야 한다 — 숨은 조상 하나면 자식의 computed style 은 멀쩡한데 화면에는 아무것도 없다.
      visibleText: Object.fromEntries(
        (watched.testids ?? []).map((testid) => {
          const node = document.querySelector(`[data-testid="${testid}"]`);
          if (!node) return [testid, null];
          const rect = node.getBoundingClientRect();
          let hidden = false;
          let alpha = 1;
          for (let cursor = node; cursor && cursor !== document.documentElement; cursor = cursor.parentElement) {
            const style = getComputedStyle(cursor);
            if (style.display === "none" || style.visibility === "hidden") hidden = true;
            alpha *= Number(style.opacity);
          }
          const onScreen =
            rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0
            && rect.left < window.innerWidth && rect.top < window.innerHeight;
          return [
            testid,
            {
              text: (node.textContent ?? "").replace(/\s+/g, " ").trim(),
              visible: !hidden && onScreen && alpha > 0.05,
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              alpha: Number(alpha.toFixed(3)),
            },
          ];
        }),
      ),
      playerSpriteResourceId: sprite ? sprite.resourceId : null,
      playerSpriteTextureKey: sprite ? sprite.textureKey : null,
      emotes: window.__oprnEmotes ? window.__oprnEmotes() : null,
      audioObserved: Array.isArray(window.__oprnAudioObserved) ? [...window.__oprnAudioObserved] : null,
      battlers: window.__oprnReadBattlerGeometry ? window.__oprnReadBattlerGeometry() : null,
    };
  }, { eventIds: watchedEventIds, testids: watchedTestids, itemIds: watchedItemIds, speciesIds: watchedSpeciesIds,
     placeableKeys: watchedPlaceableKeys, testidPrefixes: watchedTestidPrefixes });
  if (!auditBattleTextNodes) return base;
  // 전투 글자 계측은 요청한 비트에서만 돌린다 — 모든 비트에서 트리 전체를 훑을 이유가 없다.
  const battleText = await page.evaluate(auditBattleText, {
    minInkHeight: MIN_INK_HEIGHT_PX,
    maxClippedAreaRatio: MAX_CLIPPED_AREA_RATIO,
    minAlpha: MIN_EFFECTIVE_ALPHA,
  });
  return { ...base, battleText };
}

/** 그림자 기하 + 월드→화면 변환을 한 번에 읽는다(픽셀 측정 직전용). */
async function readShadowGeometry(page) {
  return await page.evaluate(() => {
    const sprites = window.__oprnCharacterSprites ? window.__oprnCharacterSprites() : null;
    const camera = window.__oprnCamera ? window.__oprnCamera() : null;
    const canvas = document.querySelector("canvas");
    if (!sprites || !camera || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      shadow: sprites.shadows.__player ?? null,
      view: {
        left: rect.left,
        top: rect.top,
        cssScaleX: rect.width / camera.width,
        cssScaleY: rect.height / camera.height,
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
        zoom: camera.zoom,
      },

    };
  });
}

/**
 * 그림자 타원의 **속살**에 해당하는 월드 사각형. 방사 그라디언트는 테두리에서 alpha 0 이라
 * 외곽까지 평균에 넣으면 신호가 절반으로 희석된다.
 */
function shadowCoreWorldBox(shadow) {
  const halfW = (shadow.displayWidth / 2) * 0.6;
  const halfH = (shadow.displayHeight / 2) * 0.6;
  return { left: shadow.x - halfW, right: shadow.x + halfW, top: shadow.y - halfH, bottom: shadow.y + halfH };
}

/** 주어진 월드 사각형의 평균 휘도. 프레임마다 자기 카메라 변환으로 화면 좌표를 구한다. */
function meanLumaOfWorldBox(pngBuffer, view, box) {
  const png = PNG.sync.read(pngBuffer);
  const toScreenX = (worldX) => (worldX - view.scrollX) * view.zoom * view.cssScaleX + view.left;
  const toScreenY = (worldY) => (worldY - view.scrollY) * view.zoom * view.cssScaleY + view.top;
  let total = 0;
  let count = 0;
  for (let y = Math.round(toScreenY(box.top)); y <= Math.round(toScreenY(box.bottom)); y += 1) {
    if (y < 0 || y >= png.height) continue;
    for (let x = Math.round(toScreenX(box.left)); x <= Math.round(toScreenX(box.right)); x += 1) {
      if (x < 0 || x >= png.width) continue;
      const i = (png.width * y + x) << 2;
      total += 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
      count += 1;
    }
  }
  return count === 0 ? null : total / count;
}

/**
 * 그림자가 **실제로 그려졌는지** 렌더된 픽셀로 잰다. 같은 **월드 사각형**을 두 프레임에서
 * 비교한다: 그림자가 떠 있던 프레임(captureShadowSample) 대 캐릭터가 그 자리를 떠난 뒤의
 * 프레임. 지형이 완전히 같으므로 차이는 그림자뿐이다.
 *
 * 왜 이렇게까지 하는가(전부 실측 2026-08-29):
 *  1. 오브젝트 축(visible·alpha·depth) 만 보면 **한 픽셀도 안 그려진 상태가 통과한다**
 *     — 런타임 캔버스 텍스처가 GPU 로 올라가지 않는 버그가 실제로 이렇게 숨어 있었다.
 *  2. 같은 프레임에서 상자를 **공간적으로** 옮겨 잡은 대조군은 못 쓴다. 위쪽은 캐릭터의
 *     발이 덮어 측정이 뒤집혔고(-0.036), 아래쪽은 지형 자체가 5% 어두워서 완전 투명한
 *     그림자도 통과했다(0.050 > 0.03).
 */
function measureShadowInk(samplePng, sampleView, sampleShadow, baselinePng, baselineView) {
  const box = shadowCoreWorldBox(sampleShadow);
  const withShadow = meanLumaOfWorldBox(samplePng, sampleView, box);
  const withoutShadow = meanLumaOfWorldBox(baselinePng, baselineView, box);
  if (withShadow === null || withoutShadow === null || withoutShadow <= 0) return null;
  return (withoutShadow - withShadow) / withoutShadow;
}

/** 리포트를 디스크에 쓴다. SUMMARY.md 가 에이전트가 먼저 읽는 진입점이다. */
export async function writeReport(outDir, report) {
  await writeFile(join(outDir, "manifest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(join(outDir, "SUMMARY.md"), renderSummary(report), "utf8");
}

/**
 * 시나리오를 실행하고 리포트를 반환한다(+ outDir 에 기록).
 * 게이트 판정은 호출자가 report.errors / report.beats[].failures 로 한다.
 */
export async function runRuntimeQa(page, rawScenario, opts = {}) {
  const scenario = normalizeScenario(rawScenario);
  const projectPath = resolve(REPO_ROOT, scenario.projectFixture);
  const projectJson = await readFile(projectPath, "utf8");
  const outDir = opts.outDir ?? join(REPO_ROOT, "verify-shots/runtime-qa", scenario.id);

  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.message ?? error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await page.setViewportSize(scenario.viewport);
  // exportEntry.ts 는 최상위에서 즉시 부팅하므로 주입은 addInitScript 여야 한다.
  // localStorage.clear() 는 이전 실행의 세이브가 타이틀 화면을 바꾸는 것을 막는다.
  await page.addInitScript(
    ([projectUrl, saveNamespace]) => {
      try {
        localStorage.clear();
      } catch {
        // 접근 불가 환경이면 그대로 진행한다.
      }
      window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace, qaInstrumentation: true };
    },
    [PROJECT_URL, `runtime-qa:${scenario.id}`],
  );
  await page.route(PROJECT_ROUTE, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: projectJson }),
  );

  // 배틀러 기하 측정기를 페이지에 심는다(readObserved 가 매 비트마다 호출).
  await page.addInitScript(
    `window.__oprnReadBattlerGeometry = ${readBattlerGeometryInPage.toString()};`,
  );

  const query = new URLSearchParams(scenario.query ?? {}).toString();
  const playerUrl = `${opts.serverUrl}/player.html${query ? `?${query}` : ""}`;
  await page.goto(playerUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  // 시나리오 전체가 이름을 댄 이벤트를 한 번만 모은다. 비트마다 다시 걷지 않는 이유는
  // 관측이 비트 사이에 달라지면 안 되기 때문이다 — 어떤 비트에서는 사각을 읽고 어떤 비트에서는
  // 안 읽으면 매니페스트가 비교 불가능해진다.
  const watchedEventIds = [
    ...new Set(scenario.beats.flatMap((beat) => Object.keys(beat.expect?.eventRects ?? {}))),
  ];
  const watchedTestids = [
    ...new Set(scenario.beats.flatMap((beat) => Object.keys(beat.expect?.visibleText ?? {}))),
  ];
  // 생활 소유물도 같은 규칙으로 이름을 댄 것만 관측한다.
  const watchedItemIds = [
    ...new Set(scenario.beats.flatMap((beat) => Object.keys(beat.expect?.inventory ?? {}))),
  ];
  const watchedPlaceableKeys = [
    ...new Set(scenario.beats.flatMap((beat) => beat.expect?.placeablesAt ?? [])),
  ];
  const watchedTestidPrefixes = [
    ...new Set(scenario.beats.flatMap((beat) => beat.expect?.dumpTestidPrefixes ?? [])),
  ];


  let hooksReady = false;
  const beats = [];
  // op 들 사이에 살아 있는 런 상태(그림자 픽셀 측정용 표본 프레임).
  const runState = {};
  for (const [index, beat] of scenario.beats.entries()) {
    runState.audio = [];
    // op 이 던져도 런을 죽이지 않는다. 던진 사유를 그 비트의 실패로 기록하고
    // 계속 진행해야 리포트·샷이 남는다 — 초기 구현은 raw 스택만 남기고 죽어서
    // 정작 진단할 증거가 하나도 없었다(실측).
    const opFailures = [];
    runState.frameReceipts = [];
    for (const op of beat.ops) {
      try {
        if (!hooksReady && HOOK_OPS.has(op.kind)) {
          await requireHooks(page);
          hooksReady = true;
        }
        await applyOp(page, op, runState);
      } catch (error) {
        const reason = String(error?.message ?? error).split("\n")[0];
        opFailures.push(`op ${op.kind} 실패: ${reason}`);
        break; // 같은 비트의 남은 op 은 전제가 깨졌으므로 건너뛴다.
      }
    }
    const observed = await readObserved(page, {
      auditBattleTextNodes: Boolean(beat.expect?.battleTextClean),
      watchedEventIds,
      watchedTestids,
      watchedItemIds: Object.keys(beat.expect?.inventoryCounts ?? {}),
      watchedSpeciesIds: Object.keys(beat.expect?.ownedMonsterCounts ?? {}),
      watchedItemIds,
      watchedPlaceableKeys,
      watchedTestidPrefixes,
    });
    const failures = [...opFailures, ...evaluateExpect(beat.expect ?? {}, observed)];
    let shot = null;
    let shadowInk = null;
    // 픽셀 검사는 화면을 한 번 더 찍는다 — 위 expect 평가와 같은 프레임을 볼 수 없으므로
    // (평가는 이미 끝났다) 이 측정만의 독립 근거로 남긴다.
    const wantsInk = beat.expect?.playerShadowInkAtLeast !== undefined;
    if (wantsInk) {
      const sample = runState.shadowSample;
      if (!sample) {
        failures.push("playerShadowInk: 앞선 비트에서 captureShadowSample 을 하지 않았다");
      } else {
        const baseline = await readShadowGeometry(page);
        if (!baseline?.view) failures.push("playerShadowInk: 대조 프레임의 카메라를 읽을 수 없다");
        else {
          shadowInk = measureShadowInk(
            sample.png,
            sample.view,
            sample.shadow,
            await page.screenshot(),
            baseline.view,
          );
          if (shadowInk === null) failures.push("playerShadowInk: 측정 상자가 화면 밖이다");
          else if (shadowInk < beat.expect.playerShadowInkAtLeast) {
            failures.push(
              `playerShadowInk: 기대 ${beat.expect.playerShadowInkAtLeast} 이상, 실제 `
                + `${shadowInk.toFixed(3)} — 오브젝트는 있는데 픽셀이 없다`,
            );
          }
        }
      }
    }
    if (shouldCaptureShot(beat, failures)) {
      shot = shotFileName(index, beat.id);
      await page.screenshot({ path: join(outDir, shot) });
    }
    beats.push({
      index,
      id: beat.id,
      note: beat.note,
      shot,
      failures,
      shadowInk: shadowInk ?? undefined,
      state: observed.state,
      actions: beat.ops,
      ...(runState.audio.length > 0 ? { audio: runState.audio } : {}),
      ...(observed.domTestids?.length ? { domTestids: observed.domTestids } : {}),
      ...(runState.frameReceipts.length ? { frameReceipts: runState.frameReceipts } : {}),
      // 배치 근거는 리포트에 남긴다 — PNG 를 열지 않고도 수치로 판정할 수 있어야 한다.
      battlers: observed.battlers ?? undefined,
      ...((beat.expect?.emoteCountAtLeast != null || beat.expect?.emoteFrames || beat.expect?.emoteTargets)
        ? { emotes: observed.emotes ?? [] } : {}),
      // 발자국 사각은 단정한 비트에만 싣는다. 안 쓰는 비트에 빈 객체를 남기면 매니페스트가
      // "사각을 봤다" 처럼 읽힌다.
      ...(Object.keys(observed.events ?? {}).length > 0 ? { events: observed.events } : {}),
    });
  }

  const report = {
    scenarioId: scenario.id,
    projectPath: relative(REPO_ROOT, projectPath),
    seed: scenario.seed,
    viewport: scenario.viewport,
    errors,
    beats,
  };
  await writeReport(outDir, report);
  return report;
}
