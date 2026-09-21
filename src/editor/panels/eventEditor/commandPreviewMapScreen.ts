/**
 * 탭 3「지도 · 화면 효과」 저작면 무대 — 카메라 제어 · 지형 변경.
 *
 * 계약: `.omo/plans/event-editor-map-screen-effects-adversarial-review.md`
 * - 카메라 제어는 모드 이름만 적힌 토큰 카드가 아니다. 뷰포트 사각형이 대상에게
 *   이동·확대하는 모습을 시작 → 이동 중 → 도착 세 프레임 미니 캔버스에 그린다.
 * - 지형 변경은 타일 번호 스와치가 아니라 칩셋 크롭 + 같은 줄 팔레트다.
 *
 * 화면 효과(Screen Effect)와 레거시 RM 화면 행은 `commandPreview.ts` 의 공용
 * `screenEffectStage`(미니 모니터 + 재생)가 그린다 — 무대를 둠으로 나누지 않는다.
 */
import { el } from "@/util/dom";
import { CAMERA_ZOOM_LIMITS } from "@/player/playSceneCamera";
import { store } from "@/project/store";
import { tilesetImageUrl } from "@/editor/tilesetImage";
import type { Command, M2CommandValue } from "@/project/types";

const FRAME_WIDTH = 128;
const FRAME_HEIGHT = 96;

type M2Command = Extract<Command, { kind: "m2Command" }>;


/**
 * 탭 3 m2 명령 미리보기. 담당하지 않는 제목이면 undefined 를 돌려 기존 폴백에 넘긴다.
 */
/** 화면 효과 — 런타임 계획(`planScreenEffect`)을 그대로 그린다. */
/** 카메라 제어 — 뷰포트 사각형이 대상까지 이동/확대되는 미니 무대. */
export function cameraControlStage(cmd: M2Command): HTMLElement {
  const mode = cameraMode(fieldText(cmd, "mode", "panTo"));
  const target = fieldText(cmd, "target", "player");
  const x = fieldNumber(cmd, "x", 0);
  const y = fieldNumber(cmd, "y", 0);
  const zoom = clampZoom(fieldNumber(cmd, "zoom", 1));
  const durationMs = fieldNumber(cmd, "durationMs", 300);
  const targetLabel = cameraTargetLabel(mode, target, x, y);

  const stage = el("div", {
    class: "ecp-stage ecp-fx-frames-stage ecp-camera-stage",
    dataset: {
      testid: "ecp-camera-stage",
      mode,
      zoom: String(zoom),
      target: targetLabel,
    },
  });
  const frames = el("div", { class: "ecp-fx-frames", dataset: { testid: "ecp-camera-frames" } });
  const steps: readonly { readonly label: string; readonly progress: number }[] = [
    { label: "시작", progress: 0 },
    { label: "이동 중", progress: 0.5 },
    { label: "도착", progress: 1 },
  ];
  for (const [order, step] of steps.entries()) {
    const canvas = document.createElement("canvas");
    canvas.className = "ecp-fx-canvas";
    canvas.width = FRAME_WIDTH;
    canvas.height = FRAME_HEIGHT;
    canvas.dataset.testid = `ecp-camera-canvas-${order}`;
    paintCameraFrame(canvas, { mode, x, y, zoom, progress: step.progress });
    frames.append(
      el("div", {
        class: "ecp-fx-frame",
        dataset: {
          testid: `ecp-camera-frame-${order}`,
          progress: String(step.progress),
          zoom: String(frameZoom(mode, zoom, step.progress)),
        },
        children: [canvas, el("span", { class: "ecp-fx-frame-label", text: step.label })],
      }),
    );
  }
  stage.append(frames);
  stage.append(
    el("div", {
      class: "ecp-fx-caption",
      dataset: { testid: "ecp-camera-caption" },
      text: `${cameraModeLabel(mode)} · ${targetLabel} · 줌 ${zoom.toFixed(2)} · ${durationMs}ms`,
    }),
  );
  return stage;
}

/** 지형 변경 — 칩셋 크롭 + 같은 줄 팔레트. 번호만 있는 스와치가 아니다. */
export function changeTileChipStage(cmd: Extract<Command, { kind: "changeTile" }>): HTMLElement {
  const project = store.getCurrent();
  const map = project.maps[cmd.mapId] ?? project.maps[project.startMapId];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  const tile = Math.trunc(Number(cmd.tile) || 0);
  const stage = el("div", {
    class: "ecp-stage ecp-tile-chipsel-stage",
    dataset: {
      testid: "ecp-tile-chipsel",
      tile: String(tile),
      tileset: tileset?.id ?? "",
      layer: cmd.layer,
    },
  });

  if (!tileset) {
    stage.append(el("div", { class: "ecp-missing-card", text: "맵 그림 세트를 찾을 수 없습니다" }));
    return stage;
  }

  const imageUrl = tilesetImageUrl(tileset);
  stage.append(
    el("div", {
      class: "ecp-tile-chipsel-main",
      children: [
        tileChip(tile, tileset, imageUrl, 56, true, "ecp-tile-chip"),
        el("div", {
          class: "ecp-tile-chipsel-meta",
          children: [
            el("strong", {
              class: "ecp-tile-chipsel-title",
              dataset: { testid: "ecp-tile-chipsel-title" },
              text: tile < 0 ? "이 칸을 비웁니다" : `${tileset.name} · 그림 ${tile}`,
            }),
            el("span", {
              class: "ecp-tile-chipsel-place",
              text: `${map?.name || cmd.mapId || "(맵)"} · ${cmd.layer === "upper" ? "상위" : "바닥"} (${cmd.x}, ${cmd.y})`,
            }),
          ],
        }),
      ],
    }),
  );

  // 같은 줄 팔레트 — 이웃 칩을 보여 줘야 "그림 12" 가 무슨 그림인지 눈으로 고칠 수 있다.
  const strip = el("div", { class: "ecp-tile-chip-strip", dataset: { testid: "ecp-tile-chip-strip" } });
  for (const candidate of chipStripTiles(tile, tileset.tilesPerRow, tileset.count)) {
    const chip = tileChip(candidate, tileset, imageUrl, 28, candidate === tile, "ecp-tile-chip-strip");
    chip.classList.add("ecp-tile-chip-strip-item");
    strip.append(chip);
  }
  stage.append(strip);
  return stage;
}

function tileChip(
  tile: number,
  tileset: { readonly tileSize: number; readonly tilesPerRow: number },
  imageUrl: string,
  size: number,
  selected: boolean,
  testIdPrefix: string,
): HTMLElement {
  const chip = el("div", {
    class: `ecp-tile-chip${selected ? " is-selected" : ""}${tile < 0 ? " is-empty" : ""}`,
    dataset: { testid: selected ? `${testIdPrefix}-selected` : `${testIdPrefix}-${tile}`, tile: String(tile) },
    attrs: { title: tile < 0 ? "비우기" : `그림 ${tile}`, "aria-hidden": "true" },
  });
  if (tile < 0) {
    chip.append(el("span", { class: "ecp-tile-chip-empty-mark", text: "✕" }));
    return chip;
  }
  const scale = size / tileset.tileSize;
  const column = tile % tileset.tilesPerRow;
  const row = Math.floor(tile / tileset.tilesPerRow);
  chip.style.width = `${size}px`;
  chip.style.height = `${size}px`;
  chip.style.backgroundImage = `url("${cssUrl(imageUrl)}")`;
  chip.style.backgroundSize = `${tileset.tilesPerRow * tileset.tileSize * scale}px auto`;
  chip.style.backgroundPosition = `-${column * tileset.tileSize * scale}px -${row * tileset.tileSize * scale}px`;
  chip.style.backgroundRepeat = "no-repeat";
  chip.style.imageRendering = "pixelated";
  return chip;
}

/** 선택 타일이 든 칩셋 줄에서 최대 8칸. 줄 밖으로 넘어가지 않는다. */
function chipStripTiles(tile: number, tilesPerRow: number, count: number): readonly number[] {
  const perRow = Math.max(1, tilesPerRow);
  const anchor = Math.max(0, tile);
  const rowStart = Math.floor(anchor / perRow) * perRow;
  const rowEnd = Math.min(rowStart + perRow, Math.max(rowStart + 1, count));
  const shown = Math.min(8, rowEnd - rowStart);
  const start = Math.max(rowStart, Math.min(anchor - 3, rowEnd - shown));
  const tiles: number[] = [];
  for (let index = start; index < start + shown; index += 1) tiles.push(index);
  return tiles;
}


function paintCameraFrame(
  canvas: HTMLCanvasElement,
  request: { readonly mode: CameraMode; readonly x: number; readonly y: number; readonly zoom: number; readonly progress: number },
): void {
  const context = context2d(canvas);
  if (!context) return;
  const width = canvas.width;
  const height = canvas.height;
  paintMockScene(context, width, height);

  // 플레이어(무대 중앙)에서 대상 좌표까지 뷰포트가 이동한다. 좌표는 타일 → 화면 비율로 축약.
  const targetX = width / 2 + clamp(request.x, -10, 10) * (width / 26);
  const targetY = height / 2 + clamp(request.y, -10, 10) * (height / 20);
  const centerX = lerp(width / 2, targetX, request.progress);
  const centerY = lerp(height / 2, targetY, request.progress);
  const zoom = frameZoom(request.mode, request.zoom, request.progress);
  const boxWidth = (width * 0.62) / zoom;
  const boxHeight = (height * 0.62) / zoom;

  context.save();
  context.strokeStyle = "rgba(255,255,255,0.92)";
  context.lineWidth = 2;
  context.setLineDash(request.mode === "fixed" ? [4, 3] : []);
  context.strokeRect(centerX - boxWidth / 2, centerY - boxHeight / 2, boxWidth, boxHeight);
  context.restore();

  // 어두운 마스크로 뷰포트 밖을 눌러 준다 — 카메라가 어디를 보는지 한눈에.
  context.save();
  context.fillStyle = "rgba(8,10,20,0.42)";
  context.beginPath();
  context.rect(0, 0, width, height);
  context.rect(centerX - boxWidth / 2, centerY - boxHeight / 2, boxWidth, boxHeight);
  context.fill("evenodd");
  context.restore();

  // 대상 표식.
  context.fillStyle = "rgba(255,214,102,0.95)";
  context.beginPath();
  context.arc(targetX, targetY, 3.5, 0, Math.PI * 2);
  context.fill();
}

/**
 * 미니 무대. 하늘 / 바닥 / 길 / 집 / 주인공을 그린다. 실제 맵 렌더러가 아니라
 * 효과가 화면에 어떻게 얹히는지 보기 위한 셰이더 목업이다(무대 자체는 항상 같다).
 */
function paintMockScene(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.save();
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, width, height);

  const sky = context.createLinearGradient(0, 0, 0, height * 0.62);
  sky.addColorStop(0, "#8fc4f2");
  sky.addColorStop(1, "#cfe7f7");
  context.fillStyle = sky;
  context.fillRect(-16, 0, width + 32, height * 0.62);

  context.fillStyle = "#6aa04a";
  context.fillRect(-16, height * 0.6, width + 32, height * 0.4);
  context.fillStyle = "#5c8f42";
  for (let x = -16; x < width + 16; x += 16) {
    for (let y = Math.floor(height * 0.6); y < height; y += 16) {
      if (((x / 16) + (y / 16)) % 2 === 0) context.fillRect(x, y, 16, 16);
    }
  }

  context.fillStyle = "#c8b184";
  context.fillRect(width * 0.42, height * 0.62, width * 0.16, height * 0.38);

  // 집 — 벽 + 지붕 + 창.
  context.fillStyle = "#d9c9a8";
  context.fillRect(width * 0.12, height * 0.36, width * 0.24, height * 0.28);
  context.fillStyle = "#a4503f";
  context.beginPath();
  context.moveTo(width * 0.09, height * 0.37);
  context.lineTo(width * 0.24, height * 0.22);
  context.lineTo(width * 0.39, height * 0.37);
  context.closePath();
  context.fill();
  context.fillStyle = "#5b7fb0";
  context.fillRect(width * 0.17, height * 0.44, width * 0.06, height * 0.08);

  // 주인공 폰 — 무대 중앙 아래.
  context.fillStyle = "#2f2a44";
  context.fillRect(width * 0.47, height * 0.66, width * 0.06, height * 0.12);
  context.fillStyle = "#f2d3ac";
  context.fillRect(width * 0.475, height * 0.62, width * 0.05, height * 0.05);
  context.restore();
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  // fakeDom(노드 단위 테스트)에는 캔버스 2D 가 없다 — 구조/데이터셋만 검사한다.
  if (typeof canvas.getContext !== "function") return null;
  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

type CameraMode = "pan" | "follow" | "fixed" | "return";

/** 런타임 `cameraControlStep` 과 같은 모드 판정. */
function cameraMode(value: string): CameraMode {
  switch (value) {
    case "follow":
      return "follow";
    case "lock":
    case "fixed":
      return "fixed";
    case "return":
    case "restore":
    case "followPlayer":
      return "return";
    default:
      return "pan";
  }
}

/** 초보자 계약: 내부 API 토큰(panTo 등)은 보여 주지 않는다. */
function cameraModeLabel(mode: CameraMode): string {
  switch (mode) {
    case "follow":
      return "대상 따라가기";
    case "fixed":
      return "고정";
    case "return":
      return "주인공으로 복귀";
    case "pan":
      return "화면 이동";
  }
}

function cameraTargetLabel(mode: CameraMode, target: string, x: number, y: number): string {
  if (mode === "return") return "주인공";
  if (target === "player") return "주인공";
  if (target === "this-event") return "이 이벤트";
  if (target === "screen" || target === "position" || target === "fixed") return `(${x}, ${y})`;
  if (target.startsWith("event:")) return `이벤트 ${target.slice("event:".length)}`;
  return target.trim() || `(${x}, ${y})`;
}

function frameZoom(mode: CameraMode, zoom: number, progress: number): number {
  if (mode === "return") return lerp(zoom, 1, progress);
  return lerp(1, zoom, progress);
}

function clampZoom(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  // 상한 정본은 런타임과 같다 — 여기서 따로 자르면 미리보기가 게임과 다른 배율을 보여준다.
  return Math.max(CAMERA_ZOOM_LIMITS.min, Math.min(CAMERA_ZOOM_LIMITS.max, value));
}

function fieldValue(cmd: M2Command, key: string): M2CommandValue | undefined {
  return cmd.fields?.[key];
}

function fieldText(cmd: M2Command, key: string, fallback: string): string {
  const value = fieldValue(cmd, key);
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function fieldNumber(cmd: M2Command, key: string, fallback: number): number {
  const value = fieldValue(cmd, key);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * clamp(t, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function cssUrl(url: string): string {
  return url.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
