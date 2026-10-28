// 스튜디오 감독 보드 — 열린 프로젝트를 스토리보드(맵 흐름) · 장르 핵심 보드 · 오프닝 극장으로 보여 준다.
//
// 모든 그림은 실제 프로젝트에서 그린다: 맵은 createMapThumbnail 캔버스, 인물은 프로젝트 초상 리소스,
// 오프닝은 system.opening 장면을 <canvas> 에 직접 그린다. 인스펙터의 BGM·시간대·조우율, 엔딩 임계값,
// 오프닝 자막·길이는 store.update 로 바로 고치고 다시 그린다.

import { listAudioResources } from "@/assets/audioResourceCatalog";
import { openEventFromCanvas } from "@/editor/canvasPointerBridge";
import { editorState } from "@/editor/editorState";
import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import { addMapPlanningItem } from "@/editor/mapPlanningActions";
import { selectEditorMap } from "@/editor/mapSelection";
import { createMapThumbnail } from "@/editor/panels/mapThumbnail";
import {
  buildBeats,
  buildOpening,
  buildSystemBoard,
  detectDirectorGenre,
  GENRE_META,
  LIGHTING_PRESETS,
  type DirectorBeat,
  type EventRef,
  type LightingPresetId,
  type OpeningShot,
  type StudioDirectorGenre,
  type StudioDirectorTab,
} from "@/editor/panels/studioDirectorData";
import { drawAnimaticFrame, loadAnimaticImages } from "@/player/openingAnimaticRenderer";
import { store } from "@/project/store";
import type { MapId, Project } from "@/project/types";
import { t } from "@/i18n";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

export { detectDirectorGenre, type StudioDirectorGenre, type StudioDirectorTab };

export interface DirectorPromptChip {
  readonly label: string;
  readonly prompt: string;
  readonly tone: "fix" | "idea";
}

export interface StudioDirectorBoardOptions {
  readonly onSelectMap?: (mapId: MapId) => void;
  readonly onPromptPick?: (prompt: string) => void;
  readonly onOpenTileEditor?: (mapId: MapId) => void;
  /** 선택한 비트·탭이 바뀔 때마다 오른쪽 조수 열에 띄울 감독 프롬프트를 넘긴다. */
  readonly onContextChange?: (title: string, chips: readonly DirectorPromptChip[]) => void;
}

export interface StudioDirectorBoard {
  readonly root: HTMLElement;
  refresh(): void;
  getGenre(): StudioDirectorGenre;
  setGenre(genre: StudioDirectorGenre): void;
  getTab(): StudioDirectorTab;
  setTab(tab: StudioDirectorTab): void;
}

const GENRES = ["monster-taming", "classic-jrpg", "romance"] as const;
const TABS: readonly { readonly id: StudioDirectorTab; readonly label: string }[] = [
  { id: "flow", label: "1. 스토리보드 흐름" },
  { id: "system", label: "2. 장르 핵심 보드" },
  { id: "cinema", label: "3. 오프닝 · 컷신 극장" },
];
const EVENT_KIND_LABEL: Record<string, string> = { npc: "인물", door: "문", battle: "전투", ending: "엔딩", story: "연출" };
/** 길이 0 = 입력을 기다리는 장면. 인플레이스 재생은 이 시간만큼 보여 주고 넘어간다. */
const WAIT_SHOT_PREVIEW_MS = 3000;

const SHOT_KIND_LABELS = { text: "글자", image: "그림", animatic: "컷 연출", video: "영상" } as const;
const shotKindLabel = (kind: keyof typeof SHOT_KIND_LABELS): string => t(SHOT_KIND_LABELS[kind]);

function seconds(ms: number): string {
  return ms > 0 ? `${(ms / 1000).toFixed(1)}s` : "입력 대기";
}

function mutateMap(mapId: MapId, label: string, mutate: (map: Project["maps"][string]) => void): boolean {
  if (!canEditMap(mapId)) {
    toast(mapEditLockNotice(mapId), "error");
    return false;
  }
  store.update((draft) => {
    const map = draft.maps[mapId];
    if (map) mutate(map);
  }, { scope: "map", mapId, label });
  return true;
}

function openEvent(ref: EventRef): void {
  selectEditorMap(ref.mapId);
  openEventFromCanvas({ mapId: ref.mapId, eventId: ref.eventId });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const ch of para) {
      if (ctx.measureText(line + ch).width > maxWidth && line) {
        out.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    out.push(line);
  }
  return out.slice(0, maxLines);
}

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(url: string): Promise<HTMLImageElement | null> {
  let pending = imageCache.get(url);
  if (!pending) {
    // tsconfig lib 가 es2024 이전이라 Promise.withResolvers 를 쓸 수 없다.
    pending = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    imageCache.set(url, pending);
  }
  return pending;
}

/** 오프닝 장면 한 컷을 실제 리소스로 캔버스에 그린다. 애니매틱은 런타임과 같은 drawAnimaticFrame 을 쓴다. */
async function drawShot(canvas: HTMLCanvasElement, project: Project, shot: OpeningShot, atMs: number, signal: AbortSignal): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  const scene = shot.scene;
  if (scene.kind === "animatic") {
    const images = await loadAnimaticImages(project, scene.composition, signal);
    if (signal.aborted) return;
    drawAnimaticFrame(canvas, scene.composition, images, atMs);
  } else {
    ctx.fillStyle = "#0b0f19";
    ctx.fillRect(0, 0, w, h);
    const img = shot.imageUrl ? await loadImage(shot.imageUrl) : null;
    if (signal.aborted) return;
    if (img) {
      const motion = scene.kind === "image" && scene.motion === "zoom" ? 1 + Math.min(1, atMs / Math.max(1, shot.durationMs || WAIT_SHOT_PREVIEW_MS)) * 0.08 : 1;
      const fit = Math.min(w / img.naturalWidth, (h * 0.78) / img.naturalHeight) * motion;
      const dw = img.naturalWidth * fit;
      const dh = img.naturalHeight * fit;
      ctx.imageSmoothingEnabled = img.naturalWidth > 200;
      ctx.drawImage(img, (w - dw) / 2, (h * 0.78 - dh) / 2, dw, dh);
    } else if (scene.kind === "video") {
      ctx.fillStyle = "#94a3b8";
      ctx.font = `${Math.round(h * 0.08)}px sans-serif`;
      ctx.fillText(`영상 ${scene.resourceId}`, w * 0.05, h * 0.4);
    }
  }
  const narration = shot.narration.trim();
  if (!narration) return;
  const band = scene.kind === "text" ? h : h * 0.3;
  ctx.fillStyle = scene.kind === "text" ? "rgba(0,0,0,0)" : "rgba(5,8,16,0.82)";
  ctx.fillRect(0, h - band, w, band);
  const size = Math.max(9, Math.round(h * (scene.kind === "text" ? 0.08 : 0.062)));
  ctx.font = `${size}px "Noto Sans KR", sans-serif`;
  ctx.fillStyle = "#f8fafc";
  ctx.textBaseline = "top";
  const lines = wrapLines(ctx, narration, w * 0.9, scene.kind === "text" ? 6 : 3);
  const top = scene.kind === "text" ? (h - lines.length * size * 1.4) / 2 : h - band + size * 0.6;
  lines.forEach((line, i) => ctx.fillText(line, w * 0.05, top + i * size * 1.4));
}

export function createStudioDirectorBoard(options: StudioDirectorBoardOptions = {}): StudioDirectorBoard {
  let genreOverride: StudioDirectorGenre | null = null;
  let activeTab: StudioDirectorTab = "flow";
  let selectedBeatId: string | null = null;
  let selectedLine = 0;
  let planningDraft = "";
  let selectedShot = 0;
  /** 다시 그릴 때마다 진행 중인 캔버스 그리기·재생을 끊는다. */
  let renderAbort = new AbortController();
  let playFrame = 0;

  const currentGenre = (): StudioDirectorGenre => genreOverride ?? detectDirectorGenre(store.getCurrent());

  const genreButtons = GENRES.map((g) => el("button", {
    class: "ai-studio-director-genre-pill",
    // 이름은 보이는 라벨로 시작한다 — 세 알약이 같은 툴팁 문장을 이름으로 갖던 것을 고쳤다(C-64).
    attrs: { type: "button", "aria-pressed": "false", title: `${GENRE_META[g].label} — 자동 판정 대신 이 장르 관점으로 봅니다` },
    dataset: { testid: `ai-studio-genre-${g}`, genre: g },
    text: GENRE_META[g].label,
    on: { click: () => { genreOverride = g; selectedBeatId = null; refresh(); } },
  }));
  const tabButtons = TABS.map((t) => el("button", {
    class: "ai-studio-director-subtab",
    attrs: { type: "button", role: "tab", "aria-selected": "false" },
    dataset: { testid: `ai-studio-director-tab-${t.id}` },
    text: t.label,
    on: { click: () => { activeTab = t.id; refresh(); } },
  }));
  const subtitleLine = el("p", { class: "ai-studio-director-subtitle", dataset: { testid: "ai-studio-director-subtitle" } });
  const contentHost = el("div", { class: "ai-studio-director-content", dataset: { testid: "ai-studio-director-content" } });
  const root = el("div", {
    class: "ai-studio-director-board",
    dataset: { testid: "ai-studio-director-board" },
    attrs: { "aria-label": "스토리보드 & 감독 보드" },
    children: [
      el("div", {
        class: "ai-studio-director-topbar",
        children: [
          el("div", {
            class: "ai-studio-director-topbar-row",
            children: [
              el("div", { class: "ai-studio-director-subtabs", attrs: { role: "tablist", "aria-label": "감독 보드 보기" }, children: tabButtons }),
              el("div", { class: "ai-studio-director-genre-switcher", attrs: { role: "group", "aria-label": "장르 관점" }, dataset: { testid: "ai-studio-genre-switcher" }, children: genreButtons }),
            ],
          }),
          subtitleLine,
        ],
      }),
      contentHost,
    ],
  });

  const pick = (prompt: string) => options.onPromptPick?.(prompt);

  // ── 1. 스토리보드 흐름 ─────────────────────────────────────────────────

  const renderStage = (beat: DirectorBeat, project: Project): HTMLElement => {
    const mapAspect = beat.mapWidth / Math.max(1, beat.mapHeight);
    const stageAspect = 16 / 9;
    const boxW = mapAspect > stageAspect ? 100 : (mapAspect / stageAspect) * 100;
    const boxH = mapAspect > stageAspect ? (stageAspect / mapAspect) * 100 : 100;
    const markers = beat.events.map((ev) => el("button", {
      class: `ai-studio-director-marker is-${ev.kind}`,
      attrs: {
        type: "button",
        title: `${EVENT_KIND_LABEL[ev.kind]} · ${ev.name} (${ev.x},${ev.y})${ev.firstLine ? `\n「${ev.firstLine}」` : ""}`,
        style: `left:${((ev.x + 0.5) / beat.mapWidth) * 100}%;top:${((ev.y + 0.5) / beat.mapHeight) * 100}%`,
      },
      dataset: { testid: "ai-studio-stage-marker", eventId: ev.eventId },
      children: [el("span", { text: ev.name })],
      on: { click: () => openEvent({ mapId: beat.mapId, eventId: ev.eventId, label: ev.name }) },
    }));
    const tint = beat.lighting;
    const line = beat.lines[Math.min(selectedLine, beat.lines.length - 1)];
    const bgmName = beat.bgmResourceId ? listAudioResources("music", project).find((r) => r.id === beat.bgmResourceId)?.name ?? beat.bgmResourceId : "프로젝트 기본";
    return el("div", {
      class: "ai-studio-director-stage",
      dataset: { testid: "ai-studio-stage-16x9", tint: beat.lightingPreset },
      children: [
        createMapThumbnail(beat.mapId, { width: 512, height: 288, className: "ai-studio-director-stage-canvas", testId: `ai-studio-stage-canvas-${beat.mapId}` }),
        el("div", {
          class: "ai-studio-director-stage-tint",
          attrs: { style: tint ? `background:${tint.color ?? "#000"};opacity:${Math.min(0.85, tint.ambient)}` : "opacity:0" },
          dataset: { testid: "ai-studio-stage-tint" },
        }),
        el("div", {
          class: "ai-studio-director-marker-layer",
          attrs: { style: `width:${boxW}%;height:${boxH}%;left:${(100 - boxW) / 2}%;top:${(100 - boxH) / 2}%` },
          children: markers,
        }),
        el("div", {
          class: "ai-studio-director-stage-hud",
          children: [
            // ♪ 는 따로 둔다 — 이으면 「프로젝트 기본 BGM」 같은 정확 일치 키가 깨진다.
            el("span", { children: ["♪ ", bgmName] }),
            el("span", { text: `${LIGHTING_PRESETS[beat.lightingPreset === "custom" ? "day" : beat.lightingPreset].label}${beat.lightingPreset === "custom" ? "(사용자 조명)" : ""}` }),
            ...(beat.encounterCount > 0 ? [el("span", { text: `조우 ${beat.encounterCount}종 · ${beat.encounterRate}` })] : []),
          ],
        }),
        line
          ? el("div", {
              class: "ai-studio-director-stage-dialogue",
              dataset: { testid: "ai-studio-stage-dialogue" },
              children: [
                ...(line.portraitUrl ? [el("img", { class: "ai-studio-director-stage-face", attrs: { src: line.portraitUrl, alt: line.speaker } })] : []),
                el("div", {
                  class: "ai-studio-director-stage-copy",
                  children: [
                    el("strong", { text: line.speaker }),
                    el("p", { text: line.text }),
                  ],
                }),
                el("div", {
                  class: "ai-studio-director-stage-step",
                  children: [
                    el("button", { attrs: { type: "button", "aria-label": "이전 대사" }, text: "‹", on: { click: () => { selectedLine = Math.max(0, selectedLine - 1); refresh(); } } }),
                    el("span", { text: `${Math.min(selectedLine, beat.lines.length - 1) + 1}/${beat.lines.length}` }),
                    el("button", { attrs: { type: "button", "aria-label": "다음 대사" }, text: "›", on: { click: () => { selectedLine = Math.min(beat.lines.length - 1, selectedLine + 1); refresh(); } } }),
                  ],
                }),
              ],
            })
          : el("div", { class: "ai-studio-director-stage-dialogue is-empty", text: "이 맵에는 아직 대사가 없습니다." }),
      ],
    });
  };

  const renderLiveControls = (beat: DirectorBeat, project: Project): HTMLElement => {
    const music = listAudioResources("music", project);
    // 맵이 쓰는 곡이 카탈로그에 없어도(외부·번들 BGM) 선택 상자가 빈칸으로 보이지 않게 현재 값을 남긴다.
    const currentMissing = beat.bgmResourceId && !music.some((r) => r.id === beat.bgmResourceId) ? beat.bgmResourceId : null;
    const bgmSelect = el("select", {
      class: "ai-studio-director-select",
      attrs: { "aria-label": "맵 BGM" },
      dataset: { testid: "ai-studio-live-bgm" },
      children: [
        el("option", { attrs: { value: "" }, text: "프로젝트 기본 BGM" }),
        ...(currentMissing ? [el("option", { attrs: { value: currentMissing }, text: `${currentMissing} (현재)` })] : []),
        ...music.map((r) => el("option", { attrs: { value: r.id }, text: r.name })),
      ],
      on: {
        change: () => {
          const value = bgmSelect.value;
          if (mutateMap(beat.mapId, "스튜디오: BGM 변경", (map) => {
            if (value) map.bgm = { ...(map.bgm ?? {}), mode: "custom", resourceId: value };
            else delete map.bgm;
          })) refresh();
        },
      },
    });
    bgmSelect.value = beat.bgmResourceId ?? "";
    const tintButtons = (Object.keys(LIGHTING_PRESETS) as LightingPresetId[]).map((id) => el("button", {
      class: `ai-studio-director-seg${beat.lightingPreset === id ? " is-active" : ""}`,
      attrs: { type: "button", "aria-pressed": String(beat.lightingPreset === id) },
      dataset: { testid: `ai-studio-live-tint-${id}` },
      text: LIGHTING_PRESETS[id].label,
      on: {
        click: () => {
          const preset = LIGHTING_PRESETS[id].lighting;
          if (mutateMap(beat.mapId, `스튜디오: 시간대 ${LIGHTING_PRESETS[id].label}`, (map) => {
            if (preset) map.defaultLighting = { ...preset, sources: [...(map.defaultLighting?.sources ?? [])] };
            else delete map.defaultLighting;
          })) refresh();
        },
      },
    }));
    const rateInput = el("input", {
      class: "ai-studio-director-number",
      attrs: { type: "number", min: "0", max: "200", step: "1", "aria-label": "조우율", value: String(beat.encounterRate) },
      dataset: { testid: "ai-studio-live-encounter" },
      on: {
        change: () => {
          const next = Math.max(0, Math.min(200, Math.round(Number(rateInput.value) || 0)));
          if (mutateMap(beat.mapId, "스튜디오: 조우율 변경", (map) => {
            if (next > 0) map.encounterRate = next;
            else delete map.encounterRate;
          })) refresh();
        },
      },
    });
    return el("div", {
      class: "ai-studio-director-live-controls",
      dataset: { testid: "ai-studio-live-controls" },
      children: [
        el("label", { class: "ai-studio-director-control is-bgm", children: [el("span", { text: "배경음" }), bgmSelect] }),
        el("div", { class: "ai-studio-director-control", children: [el("span", { text: "시간대" }), el("div", { class: "ai-studio-director-segs", children: tintButtons })] }),
        el("label", {
          class: "ai-studio-director-control",
          children: [el("span", { text: `조우율${beat.encounterCount === 0 ? " (출현 0종)" : ` (${beat.encounterCount}종)`}` }), rateInput],
        }),
      ],
    });
  };

  const renderFlowView = (project: Project, genre: StudioDirectorGenre): HTMLElement => {
    const beats = buildBeats(project, genre);
    if (beats.length === 0) return el("p", { class: "ai-studio-director-empty", text: "프로젝트에 맵이 없습니다." });
    // 처음 열 때는 편집 중인 맵을 고른다 — 없으면 시작 맵.
    const currentMapId = editorState.get().currentMapId;
    const editorMap = beats.find((b) => b.mapId === currentMapId) ?? beats.find((b) => b.mapId === project.startMapId);
    const beat = beats.find((b) => b.id === selectedBeatId) ?? editorMap ?? beats[0]!;
    selectedBeatId = beat.id;

    const cards = beats.map((b) => el("button", {
      class: `ai-studio-director-beat${b.id === beat.id ? " is-selected" : ""}${b.defects.length ? " has-defect" : ""}`,
      attrs: { type: "button", "aria-pressed": String(b.id === beat.id) },
      dataset: { testid: "ai-studio-beat-card", mapId: b.mapId },
      on: {
        click: () => {
          selectedBeatId = b.id;
          selectedLine = 0;
          selectEditorMap(b.mapId);
          options.onSelectMap?.(b.mapId);
          refresh();
        },
      },
      children: [
        createMapThumbnail(b.mapId, { width: 112, height: 63, className: "ai-studio-director-beat-thumb", testId: `ai-studio-beat-thumb-${b.mapId}` }),
        el("div", {
          class: "ai-studio-director-beat-body",
          children: [
            el("span", { class: "ai-studio-director-kicker", text: `${b.stepLabel} · ${b.roleLabel}` }),
            el("strong", { class: "ai-studio-director-beat-title", text: b.title }),
            el("span", { class: "ai-studio-director-beat-meta", text: b.mapMeta }),
            el("span", { class: "ai-studio-director-beat-meta", text: b.exits.length ? `→ ${b.exits.slice(0, 3).join(", ")}${b.exits.length > 3 ? ` 외 ${b.exits.length - 3}` : ""}` : "→ 나가는 문 없음" }),
            el("div", {
              class: "ai-studio-director-badges",
              children: b.defects.length
                ? b.defects.map((d) => el("span", { class: "ai-studio-director-defect-pill", text: d.badge }))
                : [el("span", { class: "ai-studio-director-ok-pill", text: "결함 없음" })],
            }),
          ],
        }),
      ],
    }));

    const keyEvents = beat.events.filter((e) => e.kind !== "story" || e.firstLine).slice(0, 12);
    const inspector = el("section", {
      class: "ai-studio-director-inspector",
      dataset: { testid: "ai-studio-director-inspector", mapId: beat.mapId },
      attrs: { "aria-label": "선택한 장면" },
      children: [
        el("header", {
          class: "ai-studio-director-inspector-head",
          children: [
            el("div", {
              children: [
                // 크기·이벤트 수는 왼쪽 카드가 이미 말한다 — 같은 사실을 되풀이하지 않는다(C-66).
                el("span", { class: "ai-studio-director-kicker", text: `${beat.stepLabel} · ${beat.roleLabel}` }),
                el("h3", { class: "ai-studio-director-inspector-title", dataset: { testid: "ai-studio-inspector-title" }, text: beat.title }),
              ],
            }),
            el("div", {
              class: "ai-studio-director-actions",
              children: [
                el("button", {
                  class: "ai-studio-director-btn is-primary",
                  attrs: { type: "button" },
                  dataset: { testid: "ai-studio-play-beat" },
                  text: "▶ 이 맵부터 플레이",
                  on: {
                    click: () => {
                      const map = project.maps[beat.mapId];
                      void import("@/editor/panels/testPlayModal").then(({ openTestPlayModal }) =>
                        openTestPlayModal(map ? { mapId: map.id, x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) } : undefined));
                    },
                  },
                }),
                el("button", {
                  class: "ai-studio-director-btn",
                  attrs: { type: "button" },
                  dataset: { testid: "ai-studio-open-tile-editor" },
                  text: "타일 편집기",
                  on: { click: () => { selectEditorMap(beat.mapId); options.onOpenTileEditor?.(beat.mapId); } },
                }),
              ],
            }),
          ],
        }),
        renderStage(beat, project),
        renderLiveControls(beat, project),
        ...beat.defects.map((d) => el("div", {
          class: "ai-studio-director-defect-box",
          dataset: { testid: "ai-studio-defect-box" },
          children: [
            el("div", { children: [el("strong", { text: `⚠ ${d.badge}` }), el("p", { text: d.detail })] }),
            el("button", { class: "ai-studio-director-btn is-fix", attrs: { type: "button" }, dataset: { testid: "ai-studio-defect-fix" }, text: "AI로 수리", on: { click: () => pick(d.aiPrompt) } }),
          ],
        })),
        el("div", {
          class: "ai-studio-director-section",
          children: [
            el("div", { class: "ai-studio-director-section-head", children: [el("strong", { text: "이 맵의 핵심 이벤트" }), ...(beat.events.length ? [el("span", { text: `${beat.events.length}개 중 ${keyEvents.length}` })] : [])] }),
            keyEvents.length
              ? el("ul", {
                  class: "ai-studio-director-event-list",
                  children: keyEvents.map((ev) => el("li", {
                    dataset: { testid: "ai-studio-key-event", eventId: ev.eventId },
                    children: [
                      ...(ev.portraitUrl ? [el("img", { class: "ai-studio-director-event-face", attrs: { src: ev.portraitUrl, alt: "" } })] : [el("span", { class: `ai-studio-director-event-kind is-${ev.kind}`, text: EVENT_KIND_LABEL[ev.kind] ?? ev.kind })]),
                      el("div", {
                        class: "ai-studio-director-event-copy",
                        children: [el("strong", { text: ev.name }), el("span", { text: ev.firstLine ?? `(${ev.x}, ${ev.y}) · 대사 없음` })],
                      }),
                      el("button", {
                        class: "ai-studio-director-btn is-small",
                        attrs: { type: "button" },
                        dataset: { testid: "ai-studio-edit-event" },
                        text: "이 이벤트 편집",
                        on: { click: () => openEvent({ mapId: beat.mapId, eventId: ev.eventId, label: ev.name }) },
                      }),
                    ],
                  })),
                })
              // 빈 목록에는 다음 행동을 함께 둔다(C-66).
              : el("div", {
                  class: "ai-studio-director-empty-row",
                  children: [
                    el("p", { class: "ai-studio-director-empty", text: "인물·문·전투 이벤트가 없습니다." }),
                    el("button", {
                      class: "ai-studio-director-btn is-small",
                      attrs: { type: "button" },
                      dataset: { testid: "ai-studio-empty-events-ask" },
                      text: "조수에게 배치 맡기기",
                      on: { click: () => pick(`「${beat.title}」에 분위기에 맞는 인물·문 이벤트를 배치해 줘.`) },
                    }),
                  ],
                }),
          ],
        }),
        el("div", {
          class: "ai-studio-director-section",
          dataset: { testid: "ai-studio-planning-pin" },
          children: [
            el("div", { class: "ai-studio-director-section-head", children: [el("strong", { text: "고정 기획 노트" }), ...(beat.planningNotes.length ? [el("span", { text: `${beat.planningNotes.length}건` })] : [])] }),
            ...(beat.planningNotes.length ? [el("ul", { class: "ai-studio-director-planning-list", children: beat.planningNotes.map((n) => el("li", { text: n })) })] : []),
            el("input", {
              class: "ai-studio-director-planning-input",
              attrs: { type: "text", placeholder: "이 장면에 남길 기획 한 줄 + Enter", value: planningDraft, "aria-label": "장면 기획 메모" },
              dataset: { testid: "ai-studio-planning-pin-input" },
              on: {
                input: (e) => { if (e.currentTarget instanceof HTMLInputElement) planningDraft = e.currentTarget.value; },
                keydown: (e) => {
                  if (!(e instanceof KeyboardEvent) || e.key !== "Enter" || !planningDraft.trim()) return;
                  e.preventDefault();
                  addMapPlanningItem(beat.mapId, planningDraft.trim());
                  planningDraft = "";
                  refresh();
                },
              },
            }),
          ],
        }),
      ],
    });

    const chips: DirectorPromptChip[] = [
      ...beat.defects.map((d) => ({ label: `수리: ${d.badge}`, prompt: d.aiPrompt, tone: "fix" as const })),
      { label: "대사 다듬기", prompt: `「${beat.title}」의 인물 대사 ${beat.lines.length}줄을 캐릭터 성격이 드러나게 다듬고, 대사가 없는 인물에게 2줄씩 추가해 줘.`, tone: "idea" },
      { label: "장면 연출 추가", prompt: `「${beat.title}」에 처음 들어올 때 한 번만 재생되는 짧은 연출(카메라 이동·말풍선·효과음)을 만들어 줘.`, tone: "idea" },
      { label: "다음 장면 연결", prompt: `「${beat.title}」 다음에 올 맵을 이야기 흐름에 맞게 만들고 문으로 양방향 연결해 줘.`, tone: "idea" },
    ];
    options.onContextChange?.(beat.title, chips);

    return el("div", {
      class: "ai-studio-director-flow-layout",
      dataset: { testid: "ai-studio-flow-layout" },
      children: [
        el("div", { class: "ai-studio-director-beat-column", attrs: { role: "list", "aria-label": "맵 흐름" }, children: cards }),
        inspector,
      ],
    });
  };

  // ── 2. 장르 핵심 보드 ─────────────────────────────────────────────────

  const jumpButton = (ref: EventRef, text = "이벤트로 이동") => el("button", {
    class: "ai-studio-director-btn is-small",
    attrs: { type: "button", title: ref.label },
    dataset: { testid: "ai-studio-jump-event" },
    text,
    on: { click: () => openEvent(ref) },
  });

  const renderSystemView = (project: Project, genre: StudioDirectorGenre): HTMLElement => {
    const board = buildSystemBoard(project, genre);
    const thresholdInput = (endingIndex: number, condIndex: number, value: number) => {
      const input = el("input", {
        class: "ai-studio-director-number",
        attrs: { type: "number", min: "0", max: "999", value: String(value), "aria-label": "엔딩 조건 임계값" },
        dataset: { testid: "ai-studio-ending-threshold" },
        on: {
          change: () => {
            const next = Math.max(0, Math.round(Number(input.value) || 0));
            store.update((draft) => {
              const cond = draft.endings?.[endingIndex]?.conditions[condIndex];
              if (cond && (cond.kind === "friendshipAtLeast" || cond.kind === "variable")) cond.value = next;
            }, { scope: "project", label: "스튜디오: 엔딩 임계값 변경" });
            refresh();
          },
        },
      });
      return input;
    };
    const chips: DirectorPromptChip[] = [
      ...board.endings.filter((e) => !e.reachable).map((e) => ({ label: `엔딩 연결: ${e.name}`, prompt: `엔딩 「${e.name}」이 도달 불가입니다(${e.reason}). 조건을 채울 수 있게 선택지·이벤트를 보강해 줘.`, tone: "fix" as const })),
      ...board.cast.filter((c) => c.warn).slice(0, 3).map((c) => ({ label: `보강: ${c.name}`, prompt: `「${c.name}」 문제: ${c.warn}. 프로젝트 흐름에 맞게 고쳐 줘.`, tone: "fix" as const })),
      ...board.flags.filter((f) => f.warn).slice(0, 2).map((f) => ({ label: `플래그: ${f.name}`, prompt: `${f.kind === "switch" ? "스위치" : f.kind === "friendship" ? "호감도" : "변수"} 「${f.name}」 문제: ${f.warn}. 쓰는 곳과 읽는 곳이 맞물리게 이벤트를 고쳐 줘.`, tone: "fix" as const })),
      ...board.endings.filter((e) => e.reachable).slice(0, 2).map((e) => ({ label: `엔딩 연출: ${e.name}`, prompt: `엔딩 「${e.name}」(조건: ${e.conditionText})에 들어가기 직전 장면과 엔딩 컷신 연출을 강화해 줘. 조건 수치는 바꾸지 마.`, tone: "idea" as const })),
      ...(board.cast.length > 0 ? [{ label: "인물 대사 개성", prompt: `${board.cast.slice(0, 4).map((c) => `「${c.name}」`).join("·")}의 대사를 찾아 말투가 서로 구분되게 다듬어 줘. 사건 순서와 조건은 유지해.`, tone: "idea" as const }] : []),
      { label: "장르 밸런스 점검", prompt: `${GENRE_META[genre].shortLabel} 관점에서 이 프로젝트의 ${genre === "romance" ? "호감도 곡선과 엔딩 분기" : genre === "monster-taming" ? "출현 테이블과 레벨 곡선" : "파티 합류 시점과 보스 난이도"}를 점검하고 고칠 점을 제안해 줘.`, tone: "idea" },
    ];
    options.onContextChange?.(GENRE_META[genre].systemTabLabel.replace(/^2\. /, ""), chips);

    return el("div", {
      class: "ai-studio-director-system",
      dataset: { testid: "ai-studio-system-board", genre },
      children: [
        el("div", {
          class: "ai-studio-director-stats",
          children: board.stats.map((s) => el("div", { class: `ai-studio-director-stat${s.warn ? " is-warn" : ""}`, children: [el("span", { text: s.label }), el("strong", { text: s.value })] })),
        }),
        el("h3", { class: "ai-studio-director-section-title", text: board.castTitle }),
        board.cast.length
          ? el("div", {
              class: "ai-studio-director-cast-grid",
              children: board.cast.map((c) => el("article", {
                class: `ai-studio-director-cast${c.warn ? " is-warn" : ""}`,
                dataset: { testid: "ai-studio-cast-card", castId: c.id },
                children: [
                  el("div", {
                    class: `ai-studio-director-cast-art is-${c.imageKind}`,
                    children: c.imageUrl ? [el("img", { attrs: { src: c.imageUrl, alt: c.name, loading: "lazy" } })] : [el("span", { text: "그림 없음" })],
                  }),
                  el("div", {
                    class: "ai-studio-director-cast-body",
                    children: [
                      el("strong", { text: c.name }),
                      el("span", { class: "ai-studio-director-kicker", text: c.role }),
                      ...c.facts.filter(Boolean).map((f) => el("span", { class: "ai-studio-director-cast-fact", text: f })),
                      ...(c.warn ? [el("span", { class: "ai-studio-director-defect-pill", text: c.warn })] : []),
                      ...(c.event ? [jumpButton(c.event)] : []),
                    ],
                  }),
                ],
              })),
            })
          : el("p", { class: "ai-studio-director-empty", text: "이 관점에서 찾은 인물·몬스터가 없습니다." }),
        el("h3", { class: "ai-studio-director-section-title", text: `엔딩 ${board.endings.length}개 · 도달 가능성` }),
        board.endings.length
          ? el("div", {
              class: "ai-studio-director-table",
              children: board.endings.map((e, i) => el("div", {
                class: `ai-studio-director-row${e.reachable ? "" : " is-warn"}`,
                dataset: { testid: "ai-studio-ending-row", endingId: e.id },
                children: [
                  el("div", { class: "ai-studio-director-row-main", children: [el("strong", { text: e.name }), el("span", { text: e.conditionText }), el("span", { class: "ai-studio-director-row-reason", text: e.reason })] }),
                  el("div", {
                    class: "ai-studio-director-row-side",
                    children: [
                      ...(e.threshold ? [el("label", { class: "ai-studio-director-inline", children: [el("span", { text: `${e.threshold.label} ≥` }), thresholdInput(i, e.threshold.index, e.threshold.value)] })] : []),
                      el("span", { class: e.reachable ? "ai-studio-director-ok-pill" : "ai-studio-director-defect-pill", text: e.reachable ? "도달 가능" : "도달 불가" }),
                      ...(e.sources[0] ? [jumpButton(e.sources[0], "관련 이벤트")] : []),
                    ],
                  }),
                ],
              })),
            })
          : el("p", { class: "ai-studio-director-empty", text: "프로젝트에 엔딩이 정의돼 있지 않습니다." }),
        el("h3", { class: "ai-studio-director-section-title", text: `스위치 · 변수 · 호감도 ${board.flags.length}개 (실제 명령 기준)` }),
        board.flags.length
          ? el("div", {
              class: "ai-studio-director-table",
              children: board.flags.slice(0, 24).map((f) => el("div", {
                class: `ai-studio-director-row${f.warn ? " is-warn" : ""}`,
                dataset: { testid: "ai-studio-flag-row" },
                children: [
                  el("div", { class: "ai-studio-director-row-main", children: [el("strong", { text: f.name }), el("span", { text: `${f.kind === "switch" ? "스위치" : f.kind === "variable" ? "변수" : "호감도"} · 쓰기 ${f.writers.length}곳 · 조건 읽기 ${f.readers}곳` }), ...(f.warn ? [el("span", { class: "ai-studio-director-row-reason", text: f.warn })] : [])] }),
                  el("div", { class: "ai-studio-director-row-side", children: f.writers[0] ? [jumpButton(f.writers[0])] : [] }),
                ],
              })),
            })
          : el("p", { class: "ai-studio-director-empty", text: "이벤트가 스위치·변수·호감도를 바꾸지 않습니다." }),
      ],
    });
  };

  // ── 3. 오프닝 · 컷신 극장 ─────────────────────────────────────────────

  const renderCinemaView = (project: Project, genre: StudioDirectorGenre): HTMLElement => {
    const opening = buildOpening(project);
    const signal = renderAbort.signal;
    const title = project.meta.title?.trim() || "제목 없음";
    const chips: DirectorPromptChip[] = [
      ...(opening.shots.length === 0 ? [{ label: "오프닝 만들기", prompt: `「${title}」의 ${GENRE_META[genre].shortLabel} 분위기에 맞는 오프닝 컷신을 4~6장면으로 만들어 줘.`, tone: "fix" as const }] : []),
      ...(opening.shots.length > 0 && opening.shots.every((s) => s.kind === "text") ? [{ label: "그림 컷으로 승격", prompt: `오프닝이 글자 장면만 ${opening.shots.length}개입니다. 프로젝트 맵·인물 그림을 쓰는 이미지/애니매틱 장면으로 바꿔 줘.`, tone: "fix" as const }] : []),
      { label: "자막 다듬기", prompt: `오프닝 ${opening.shots.length}장면의 자막을 짧고 리듬감 있게 다듬어 줘. 장면 수와 순서는 유지해.`, tone: "idea" },
      { label: "첫 맵으로 이어지기", prompt: `오프닝 마지막 장면이 시작 맵 「${project.maps[project.startMapId]?.name ?? project.startMapId}」으로 자연스럽게 이어지도록 연출을 조정해 줘.`, tone: "idea" },
    ];
    options.onContextChange?.("오프닝 · 컷신", chips);

    if (opening.shots.length === 0) {
      return el("div", {
        class: "ai-studio-director-cinema",
        dataset: { testid: "ai-studio-cinema-board" },
        children: [el("p", { class: "ai-studio-director-empty", dataset: { testid: "ai-studio-opening-empty" }, text: "system.opening 에 장면이 없습니다. 오른쪽 「오프닝 만들기」로 시작하세요." })],
      });
    }
    selectedShot = Math.min(selectedShot, opening.shots.length - 1);
    const main = el("canvas", { class: "ai-studio-director-theater-canvas", attrs: { width: "640", height: "360", "aria-label": "오프닝 장면 미리보기" }, dataset: { testid: "ai-studio-theater-canvas" } });
    const status = el("span", { class: "ai-studio-director-theater-status", dataset: { testid: "ai-studio-theater-status" } });
    const showShot = (index: number, atMs = 0) => {
      const shot = opening.shots[index];
      if (!shot) return;
      status.textContent = `SHOT ${index + 1}/${opening.shots.length} · ${shotKindLabel(shot.kind)} · ${seconds(shot.durationMs)}`;
      void drawShot(main, project, shot, atMs, signal);
    };
    const stop = () => {
      cancelAnimationFrame(playFrame);
      playFrame = 0;
      root.dataset.playing = "false";
    };
    const play = () => {
      stop();
      const durations = opening.shots.map((s) => s.durationMs || WAIT_SHOT_PREVIEW_MS);
      const total = durations.reduce((a, b) => a + b, 0);
      const started = performance.now();
      let lastIndex = -1;
      root.dataset.playing = "true";
      const tick = () => {
        if (signal.aborted) return;
        const t = performance.now() - started;
        if (t >= total) { stop(); showShot(selectedShot); return; }
        let acc = 0;
        let index = 0;
        while (index < durations.length - 1 && t >= acc + durations[index]!) acc += durations[index++]!;
        if (index !== lastIndex || opening.shots[index]?.kind === "animatic" || opening.shots[index]?.scene.kind === "image") {
          lastIndex = index;
          showShot(index, t - acc);
        }
        status.textContent = `▶ ${(t / 1000).toFixed(1)}s / ${(total / 1000).toFixed(1)}s · SHOT ${index + 1}/${opening.shots.length}`;
        playFrame = requestAnimationFrame(tick);
      };
      playFrame = requestAnimationFrame(tick);
    };
    signal.addEventListener("abort", stop);
    showShot(selectedShot);

    const cards = opening.shots.map((shot) => {
      const thumb = el("canvas", { class: "ai-studio-director-shot-canvas", attrs: { width: "320", height: "180" }, dataset: { testid: "ai-studio-shot-canvas" } });
      void drawShot(thumb, project, shot, 0, signal);
      const narration = el("textarea", {
        class: "ai-studio-director-shot-text",
        attrs: { rows: "3", "aria-label": `장면 ${shot.index + 1} 자막` },
        dataset: { testid: "ai-studio-shot-caption" },
        value: shot.narration,
        on: {
          change: () => {
            const next = narration.value;
            store.update((draft) => {
              const scene = draft.system.opening?.scenes.find((s) => s.id === shot.sceneId);
              if (scene) scene.narration = next;
            }, { scope: "system", label: "스튜디오: 오프닝 자막 변경" });
            refresh();
          },
        },
      });
      const duration = el("input", {
        class: "ai-studio-director-number",
        attrs: { type: "number", min: "0", max: "120", step: "0.1", value: String(shot.durationMs / 1000), "aria-label": `장면 ${shot.index + 1} 길이(초)` },
        dataset: { testid: "ai-studio-shot-duration" },
        on: {
          change: () => {
            const ms = Math.max(0, Math.min(120_000, Math.round((Number(duration.value) || 0) * 1000)));
            store.update((draft) => {
              const scene = draft.system.opening?.scenes.find((s) => s.id === shot.sceneId);
              if (scene) scene.durationMs = ms;
            }, { scope: "system", label: "스튜디오: 오프닝 길이 변경" });
            refresh();
          },
        },
      });
      return el("article", {
        class: `ai-studio-director-shot${shot.index === selectedShot ? " is-selected" : ""}`,
        dataset: { testid: "ai-studio-opening-shot", sceneId: shot.sceneId },
        children: [
          el("button", {
            class: "ai-studio-director-shot-frame",
            attrs: { type: "button", "aria-label": `장면 ${shot.index + 1} 보기` },
            children: [thumb, el("span", { class: "ai-studio-director-shot-badge", text: `SHOT ${shot.index + 1} · ${shotKindLabel(shot.kind)}` })],
            on: { click: () => { stop(); selectedShot = shot.index; refresh(); } },
          }),
          narration,
          el("label", { class: "ai-studio-director-inline", children: [el("span", { text: "길이(초, 0=입력 대기)" }), duration] }),
        ],
      });
    });

    return el("div", {
      class: "ai-studio-director-cinema",
      dataset: { testid: "ai-studio-cinema-board" },
      children: [
        el("div", {
          class: "ai-studio-director-theater",
          children: [
            main,
            el("div", {
              class: "ai-studio-director-theater-side",
              children: [
                el("span", { class: "ai-studio-director-kicker", text: `system.opening · ${opening.enabled ? "켜짐" : "꺼짐"}` }),
                el("h3", { class: "ai-studio-director-inspector-title", text: title }),
                el("p", { class: "ai-studio-director-beat-meta", text: `${opening.shots.length}장면 · 총 ${seconds(opening.totalMs)}${opening.musicResourceId ? ` · ♪ ${opening.musicResourceId}` : ""}` }),
                status,
                el("div", {
                  class: "ai-studio-director-actions",
                  children: [
                    el("button", { class: "ai-studio-director-btn is-primary", attrs: { type: "button" }, dataset: { testid: "ai-studio-play-opening-inplace" }, text: "▶ 오프닝 인플레이스 재생", on: { click: play } }),
                    el("button", { class: "ai-studio-director-btn", attrs: { type: "button" }, dataset: { testid: "ai-studio-stop-opening" }, text: "■ 정지", on: { click: () => { stop(); showShot(selectedShot); } } }),
                    el("button", {
                      class: "ai-studio-director-btn",
                      attrs: { type: "button" },
                      dataset: { testid: "ai-studio-play-opening" },
                      text: "실제 런타임으로 테스트",
                      on: { click: () => { void import("@/editor/panels/testPlayModal").then(({ openTestPlayModal }) => openTestPlayModal()); } },
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        el("div", { class: "ai-studio-director-shot-grid", children: cards }),
      ],
    });
  };

  const refresh = (): void => {
    renderAbort.abort();
    renderAbort = new AbortController();
    const project = store.getCurrent();
    const genre = currentGenre();
    root.dataset.genre = genre;
    root.dataset.genreSource = genreOverride ? "override" : "detected";
    root.dataset.tab = activeTab;
    // 부제는 긴 문장 키가 따로 있다 — 한 문자열로 이으면 문장 속 쉼표에서 쪼개져 반만 번역된다.
    subtitleLine.replaceChildren(GENRE_META[genre].label, genreOverride ? " (수동)" : " (자동 판정)", " · ", GENRE_META[genre].subtitle);
    genreButtons.forEach((btn, i) => {
      const active = GENRES[i] === genre;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
    tabButtons.forEach((btn, i) => {
      const active = TABS[i]!.id === activeTab;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
      if (TABS[i]!.id === "system") btn.textContent = GENRE_META[genre].systemTabLabel;
    });
    const scroll = contentHost.scrollTop;
    if (activeTab === "flow") contentHost.replaceChildren(renderFlowView(project, genre));
    else if (activeTab === "system") contentHost.replaceChildren(renderSystemView(project, genre));
    else contentHost.replaceChildren(renderCinemaView(project, genre));
    contentHost.scrollTop = scroll;
  };

  refresh();

  return {
    root,
    refresh,
    getGenre: currentGenre,
    setGenre(genre: StudioDirectorGenre) {
      genreOverride = genre;
      selectedBeatId = null;
      refresh();
    },
    getTab: () => activeTab,
    setTab(tab: StudioDirectorTab) {
      activeTab = tab;
      refresh();
    },
  };
}
