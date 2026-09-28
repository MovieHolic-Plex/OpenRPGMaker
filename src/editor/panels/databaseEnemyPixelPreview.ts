// 적 탭 「미리보기」 열의 **도트 미리보기 카드**(retro2003 손도트 시트가 있는 몬스터만).
//
// 시트 계약은 src/assets/pixelEnemySheets.ts — 셀 cell×cell 3×3, 오른쪽(아군 쪽)을 본다, 바닥 y = cell−4.
//   (0,0)(1,0)(2,0) 대기 a·b·c(a→b→c→b 루프) · (0,1) windup (1,1) move (2,1) attack · (0,2) recover (1,2) hit (2,2) dead
// 카드 = 작은 무대(plains 겹 배경 위 2배 nearest) + 「공격」「피격」「쓰러짐」 버튼 + 9칸 칸 표.
// 공격은 windup → move → attack → recover 순서로 칸을 넘기며, 근접형(hop·swoop·stomp·dash·float)은 move 칸에서
// 오른쪽으로 파고들었다 돌아온다. shoot·breath 는 제자리(런타임 battleRetroMotion 과 같은 뜻)다.
//
// 타이머 수명(databaseSkillRetroStage 와 같은 규약): 카드 루트마다 컨트롤러를 WeakMap 에 두고, 소유자가
// stopSkillAnimationStagesIn / resumeSkillAnimationStagesIn 을 부르면 stopEnemyPixelPreviewsIn / resumeEnemyPixelPreviewsIn 이
// 함께 불린다. 재생은 requestAnimationFrame 하나이고, 루트가 두 틱 연속 문서에서 떨어져 있으면 스스로 멈춘다.
// 감속 모드(prefers-reduced-motion)·rAF 없음 → 대기 a 칸에 서 있고, 버튼은 대표 칸 하나를 잠깐 보여 준다.
// 시트가 404 면 카드 전체를 조용히 걷는다(기존 정적 미리보기만 남는다).
import { withInlineAsset } from "@/assets/inlineAssetStore";
import {
  PIXEL_ENEMY_FRAME,
  pixelEnemyCell,
  pixelEnemySheet,
  pixelEnemySheetUrl,
  type PixelEnemyCell,
  type PixelEnemyMotion,
  type PixelEnemySheet,
} from "@/assets/pixelEnemySheets";
import { el } from "@/util/dom";

/** 무대 논리 크기. 96px 셀(드래곤)이 발밑 여백과 함께 들어가는 높이. */
const STAGE_W = 240;
const STAGE_H = 128;
const FEET_Y = 118;
const HOME_X = 86;
const SCENERY = ["ground", "mid", "far", "sky"].map((layer) => withInlineAsset("/assets/generated/battle-scenery/plains/" + layer + ".png"));

const MOTION_LABELS: Readonly<Record<PixelEnemyMotion, string>> = {
  hop: "통통 뛰어 박치기", swoop: "치켜들었다 급강하", stomp: "다가가 내려찍기", dash: "낮게 달려들기",
  float: "스르르 다가가 할퀴기", shoot: "제자리 사격", breath: "제자리 숨 뿜기",
};
const CELL_LABELS: Readonly<Record<PixelEnemyCell, string>> = {
  idle_a: "대기 a", idle_b: "대기 b", idle_c: "대기 c", windup: "준비", move: "이동", attack: "공격",
  recover: "복귀", hit: "피격", dead: "쓰러짐",
};
const CELL_ORDER: readonly PixelEnemyCell[] = ["idle_a", "idle_b", "idle_c", "windup", "move", "attack", "recover", "hit", "dead"];
const IDLE_LOOP: readonly PixelEnemyCell[] = ["idle_a", "idle_b", "idle_c", "idle_b"];

type Beat = { readonly cell: PixelEnemyCell; readonly ms: number; readonly dx: number; readonly dy: number };
export type EnemyPixelAction = "attack" | "hit" | "dead";

/** 근접형인가 — 공격 때 아군 쪽으로 움직인다. shoot·breath 는 제자리. */
function melee(motion: PixelEnemyMotion): boolean {
  return motion !== "shoot" && motion !== "breath";
}

/**
 * 동작 한 번의 칸 순서(순수). dx/dy 는 논리 px — 칸이 끝날 때 그 자리에 있다(칸 사이는 선형 보간).
 * 길이는 런타임 비트(windup·approach·impact·recover)를 줄인 값이라 미리보기에서도 리듬이 같다.
 */
export function enemyPixelBeats(sheet: Pick<PixelEnemySheet, "motion">, action: EnemyPixelAction, cell: number): readonly Beat[] {
  if (action === "hit") return [{ cell: "hit", ms: 380, dx: -4, dy: 0 }, { cell: "hit", ms: 120, dx: 0, dy: 0 }];
  if (action === "dead") return [{ cell: "hit", ms: 260, dx: -4, dy: 0 }, { cell: "dead", ms: 900, dx: 0, dy: 0 }];
  const reach = melee(sheet.motion) ? Math.min(64, Math.round(96 - cell / 2)) : 0;
  const lift = sheet.motion === "swoop" ? -18 : sheet.motion === "hop" ? -10 : sheet.motion === "float" ? -6 : 0;
  return [
    { cell: "windup", ms: 360, dx: melee(sheet.motion) ? -4 : -2, dy: sheet.motion === "swoop" ? -10 : 0 },
    { cell: "move", ms: melee(sheet.motion) ? 320 : 220, dx: reach, dy: lift },
    { cell: "attack", ms: 300, dx: reach, dy: 0 },
    { cell: "recover", ms: melee(sheet.motion) ? 360 : 260, dx: 0, dy: 0 },
  ];
}

// ---- 시트 적재(404 허용) ----

const sheetState = new Map<string, boolean>();
function probeSheet(url: string): Promise<boolean> {
  const known = sheetState.get(url);
  if (known !== undefined) return Promise.resolve(known);
  if (typeof Image !== "function") return Promise.resolve(true);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => { sheetState.set(url, true); resolve(true); };
    // 실패는 기억하지 않는다 — 그림 에이전트가 시트를 막 추가했을 수 있다.
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

// ---- 카드 ----

type Controller = { readonly stop: () => void; readonly resume: () => void; readonly canAutoplay: boolean };
const controllers = new WeakMap<HTMLElement, Controller>();

/** 목록 배지·카드 조건: 이 리소스에 retro2003 도트 시트가 있는가. */
export function enemyHasPixelSheet(resourceId: string | undefined): boolean {
  return Boolean(pixelEnemySheet(resourceId));
}

/** 목록 행 썸네일 모서리의 작은 「도트」 배지. 시트가 없으면 null. 그림은 대기 a 칸 한 장. */
export function enemyPixelListBadge(resourceId: string | undefined, size = 16): HTMLElement | null {
  const sheet = pixelEnemySheet(resourceId);
  if (!sheet) return null;
  const badge = el("span", {
    class: "db-enemy-pixel-badge",
    attrs: { role: "img", "aria-label": "도트 시트" },
    dataset: { testid: "db-enemy-pixel-badge" },
  });
  const url = pixelEnemySheetUrl(sheet);
  badge.style.backgroundImage = 'url("' + url + '")';
  badge.style.backgroundSize = size * 3 + "px " + size * 3 + "px";
  badge.style.width = size + "px";
  badge.style.height = size + "px";
  void probeSheet(url).then((ok) => { if (!ok) badge.remove(); });
  return badge;
}

export type EnemyPixelPreview = { readonly element: HTMLElement; readonly stop: () => void };

/** 몬스터 도트 미리보기 카드. 시트가 없는 리소스면 null. hue·투명은 전투 화면과 같게 반영한다. */
export function renderEnemyPixelPreview(
  record: { readonly name: string; readonly monsterResourceId?: string; readonly graphicHue?: number; readonly transparent?: boolean },
): EnemyPixelPreview | null {
  const sheet = pixelEnemySheet(record.monsterResourceId);
  if (!sheet) return null;
  const cell = pixelEnemyCell(sheet);
  const url = pixelEnemySheetUrl(sheet);
  const name = record.name || sheet.resourceId;

  const world = el("div", { class: "db-enemy-pixel-world", attrs: { "aria-hidden": "true" } });
  world.style.width = STAGE_W + "px";
  world.style.height = STAGE_H + "px";
  const scenery = el("div", { class: "db-enemy-pixel-scenery" });
  scenery.style.backgroundImage = SCENERY.map((entry) => 'url("' + entry + '")').join(", ");
  const sprite = el("span", { class: "db-enemy-pixel-sprite" });
  sprite.style.width = cell + "px";
  sprite.style.height = cell + "px";
  sprite.style.backgroundImage = 'url("' + url + '")';
  sprite.style.backgroundSize = cell * 3 + "px " + cell * 3 + "px";
  if (record.graphicHue) sprite.style.setProperty("--enemy-pixel-hue", record.graphicHue + "deg");
  if (record.transparent) sprite.style.opacity = "0.58";
  world.append(scenery, sprite);

  const stage = el("div", {
    class: "db-enemy-pixel-stage",
    dataset: { testid: "db-enemy-pixel-stage", motion: sheet.motion, cell: String(cell), running: "false", action: "idle", pixelCell: "idle_a" },
    attrs: { role: "img", "aria-label": name + " 도트 미리보기" },
    children: [world],
  });
  if (typeof ResizeObserver === "function") {
    new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) world.style.setProperty("--enemy-pixel-scale", String(Math.round((width / STAGE_W) * 1000) / 1000));
    }).observe(stage);
  }

  // ---- 칸 표(9칸) ----
  const cellButtons = new Map<PixelEnemyCell, HTMLButtonElement>();
  const grid = el("div", { class: "db-enemy-pixel-cells", attrs: { role: "group", "aria-label": "칸 표" }, dataset: { testid: "db-enemy-pixel-cells" } });
  const thumb = 36;
  for (const id of CELL_ORDER) {
    const frame = PIXEL_ENEMY_FRAME[id];
    const pic = el("span", { class: "db-enemy-pixel-cell-pic", attrs: { "aria-hidden": "true" } });
    pic.style.backgroundImage = 'url("' + url + '")';
    pic.style.backgroundSize = thumb * 3 + "px " + thumb * 3 + "px";
    pic.style.backgroundPosition = -frame.col * thumb + "px " + -frame.row * thumb + "px";
    if (record.graphicHue) pic.style.setProperty("--enemy-pixel-hue", record.graphicHue + "deg");
    const button = el("button", {
      class: "db-enemy-pixel-cell",
      attrs: { type: "button", title: CELL_LABELS[id] + " 칸 보기", "aria-pressed": "false" },
      dataset: { testid: "db-enemy-pixel-cell-" + id, cell: id },
      children: [pic, el("span", { class: "db-enemy-pixel-cell-label", text: CELL_LABELS[id] })],
    });
    button.addEventListener("click", () => showStill(id));
    cellButtons.set(id, button);
    grid.append(button);
  }

  // ---- 재생 상태 ----
  const canAutoplay = autoplayAllowed();
  let frame: number | null = null;
  let last = 0;
  let clock = 0;
  let detachedTicks = 0;
  let beats: readonly Beat[] = [];
  let beatAt = 0;
  let action: EnemyPixelAction | "idle" | "still" = "idle";
  let still: PixelEnemyCell = "idle_a";
  let from = { x: 0, y: 0 };

  const draw = (current: PixelEnemyCell, dx: number, dy: number): void => {
    const pos = PIXEL_ENEMY_FRAME[current];
    sprite.style.backgroundPosition = -pos.col * cell + "px " + -pos.row * cell + "px";
    sprite.style.left = Math.round(HOME_X - cell / 2 + dx) + "px";
    sprite.style.top = Math.round(FEET_Y - (cell - 4) + dy) + "px";
    sprite.classList.toggle("is-hit", current === "hit");
    stage.dataset.pixelCell = current;
    for (const [id, button] of cellButtons) {
      const on = id === current;
      button.classList.toggle("is-current", on);
      button.setAttribute("aria-pressed", String(action === "still" && on));
    }
  };

  const setAction = (next: typeof action): void => {
    action = next;
    stage.dataset.action = next;
    for (const button of actionButtons) button.setAttribute("aria-pressed", String(button.dataset.action === next));
  };

  const stop = (): void => {
    if (frame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
    frame = null;
    stage.dataset.running = "false";
  };
  const schedule = (): void => {
    if (typeof requestAnimationFrame === "function") frame = requestAnimationFrame(tick);
  };

  function stepAction(dt: number): void {
    beatAt += dt;
    let elapsed = beatAt;
    let prev = from;
    for (const beat of beats) {
      if (elapsed < beat.ms) {
        const p = beat.ms > 0 ? elapsed / beat.ms : 1;
        draw(beat.cell, prev.x + (beat.dx - prev.x) * p, prev.y + (beat.dy - prev.y) * p);
        return;
      }
      elapsed -= beat.ms;
      prev = { x: beat.dx, y: beat.dy };
    }
    // 동작이 끝났다. 쓰러짐은 dead 칸에 머물다 대기로, 나머지는 곧장 대기로.
    if (action === "dead" && elapsed < 700) { draw("dead", 0, 0); return; }
    setAction("idle");
    clock = 0;
  }

  function tick(stamp: number): void {
    frame = null;
    if (!stage.isConnected) {
      detachedTicks += 1;
      if (detachedTicks >= 2) { stop(); return; }
    } else detachedTicks = 0;
    const dt = Math.min(64, Math.max(0, stamp - (last || stamp)));
    last = stamp;
    // 칸 정지 보기는 루프를 세운다(대기·동작 버튼이 다시 켠다).
    if (action === "still") { draw(still, 0, 0); stop(); return; }
    if (action === "idle") {
      clock += dt;
      if (!canAutoplay) { draw("idle_a", 0, 0); stop(); return; }
      draw(IDLE_LOOP[Math.floor(clock / sheet!.idleFrameMs) % 4]!, 0, 0);
    } else stepAction(dt);
    schedule();
  }

  const start = (): void => {
    if (frame !== null) return;
    last = 0;
    detachedTicks = 0;
    stage.dataset.running = "true";
    schedule();
  };

  function play(next: EnemyPixelAction): void {
    beats = enemyPixelBeats(sheet!, next, cell);
    beatAt = 0;
    from = { x: 0, y: 0 };
    setAction(next);
    if (!canAutoplay) {
      // 감속 모드: 움직이지 않고 그 동작의 대표 칸 하나만 보인다.
      draw(next === "attack" ? "attack" : next === "hit" ? "hit" : "dead", 0, 0);
      return;
    }
    stepAction(0);
    start();
  }

  function showStill(id: PixelEnemyCell): void {
    // 같은 칸을 다시 누르면 대기 루프로 돌아간다.
    if (action === "still" && still === id) { setAction("idle"); clock = 0; if (canAutoplay) start(); else draw("idle_a", 0, 0); return; }
    still = id;
    setAction("still");
    draw(id, 0, 0);
    stop();
  }

  const actionButton = (id: EnemyPixelAction, label: string): HTMLButtonElement => el("button", {
    class: "db-enemy-pixel-action",
    text: label,
    attrs: { type: "button", "aria-pressed": "false" },
    dataset: { testid: "db-enemy-pixel-" + id, action: id },
    on: { click: () => play(id) },
  });
  const actionButtons = [actionButton("attack", "공격"), actionButton("hit", "피격"), actionButton("dead", "쓰러짐")];
  const idleButton = el("button", {
    class: "db-enemy-pixel-action",
    text: "대기",
    attrs: { type: "button", "aria-pressed": "true" },
    dataset: { testid: "db-enemy-pixel-idle", action: "idle" },
    on: { click: () => { setAction("idle"); clock = 0; if (canAutoplay) start(); else draw("idle_a", 0, 0); } },
  });
  actionButtons.unshift(idleButton);

  const caption = el("div", { class: "db-enemy-pixel-caption", children: [
    el("span", { class: "db-skill-retro-badge-inline", text: "도트 시트" }),
    el("span", { class: "db-skill-animation-chip", dataset: { testid: "db-enemy-pixel-motion" }, text: MOTION_LABELS[sheet.motion] }),
    el("span", { class: "db-skill-animation-chip", text: cell + "px 셀" }),
  ] });
  const controls = el("div", { class: "db-enemy-pixel-controls", attrs: { role: "group", "aria-label": "도트 동작" }, children: actionButtons });
  const wrap = el("section", {
    class: "db-enemy-pixel-preview",
    attrs: { "aria-label": "도트 미리보기" },
    dataset: { testid: "db-enemy-pixel-preview", resourceId: sheet.resourceId },
    children: [
      el("div", { class: "db-enemy-stage-heading", children: [el("span", { text: "도트 미리보기" }), el("span", { class: "db-enemy-stage-status", text: "레트로 2003 전투" })] }),
      caption, stage, controls, grid,
    ],
  });

  controllers.set(stage, { stop, resume: () => { if (canAutoplay) start(); }, canAutoplay });
  draw("idle_a", 0, 0);
  if (canAutoplay) start();
  void probeSheet(url).then((ok) => {
    if (ok) return;
    // 없는 시트: 카드를 조용히 걷는다.
    stop();
    wrap.remove();
  });
  return { element: wrap, stop };
}

function autoplayAllowed(): boolean {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches !== true;
}

/** scope 안의 도트 미리보기 루프를 모두 멈춘다. stopSkillAnimationStagesIn 이 함께 부른다. */
export function stopEnemyPixelPreviewsIn(scope: ParentNode): void {
  for (const stage of scope.querySelectorAll<HTMLElement>("[data-testid='db-enemy-pixel-stage']")) controllers.get(stage)?.stop();
}

/** 캐시에서 다시 붙은 카드를 대기 루프로 되돌린다. resumeSkillAnimationStagesIn 이 함께 부른다. */
export function resumeEnemyPixelPreviewsIn(scope: ParentNode): void {
  for (const stage of scope.querySelectorAll<HTMLElement>("[data-testid='db-enemy-pixel-stage']")) {
    const controller = controllers.get(stage);
    if (controller?.canAutoplay) controller.resume();
  }
}

