// 스튜디오 감독 보드 (Option B: 장르 적응형 비주얼 스토리보드 & 감독 보드)

import { addMapPlanningItem } from "@/editor/mapPlanningActions";
import { selectEditorMap } from "@/editor/mapSelection";
import { createMapThumbnail } from "@/editor/panels/mapThumbnail";
import {
  buildBeatsForGenre,
  buildOpeningShots,
  buildSystemEntries,
  detectDirectorGenre,
  GENRE_META,
  type DirectorBeat,
  type StudioDirectorGenre,
  type StudioDirectorTab,
} from "@/editor/panels/studioDirectorData";
import { store } from "@/project/store";
import type { MapId, Project } from "@/project/types";
import { el } from "@/util/dom";

export { detectDirectorGenre, type StudioDirectorGenre, type StudioDirectorTab };

export interface StudioDirectorBoardOptions {
  readonly onSelectMap?: (mapId: MapId) => void;
  readonly onPromptPick?: (prompt: string) => void;
  readonly onOpenTileEditor?: (mapId: MapId) => void;
}

export interface StudioDirectorBoard {
  readonly root: HTMLElement;
  refresh(): void;
  getGenre(): StudioDirectorGenre;
  setGenre(genre: StudioDirectorGenre): void;
  getTab(): StudioDirectorTab;
  setTab(tab: StudioDirectorTab): void;
}

export function createStudioDirectorBoard(options: StudioDirectorBoardOptions = {}): StudioDirectorBoard {
  let genreOverride: StudioDirectorGenre | null = null;
  let activeTab: StudioDirectorTab = "flow";
  let selectedBeatId: string | null = null;
  let planningDraft = "";

  const currentGenre = (): StudioDirectorGenre => genreOverride ?? detectDirectorGenre(store.getCurrent());

  const genreButtons: Partial<Record<StudioDirectorGenre, HTMLButtonElement>> = {};
  const tabButtons: Partial<Record<StudioDirectorTab, HTMLButtonElement>> = {};
  const systemTabLabelSpan = el("span", { text: GENRE_META["classic-jrpg"].systemTabLabel });

  const genreSwitcher = el("div", {
    class: "ai-studio-director-genre-switcher",
    dataset: { testid: "ai-studio-genre-switcher" },
    attrs: { role: "group", "aria-label": "장르 감독 프리셋 전환" },
    children: (["monster-taming", "classic-jrpg", "romance"] as const).map((g) => {
      const btn = el("button", {
        class: "ai-studio-director-genre-pill",
        attrs: { type: "button", "aria-pressed": "false" },
        dataset: { testid: `ai-studio-genre-${g}`, genre: g },
        text: GENRE_META[g].label,
        on: {
          click: () => {
            genreOverride = g;
            selectedBeatId = null;
            refresh();
          },
        },
      }) as HTMLButtonElement;
      genreButtons[g] = btn;
      return btn;
    }),
  });

  const subTabs = el("div", {
    class: "ai-studio-director-subtabs",
    dataset: { testid: "ai-studio-director-tabs" },
    attrs: { role: "tablist", "aria-label": "감독 보드 보기 전환" },
    children: [
      (() => {
        const btn = el("button", {
          class: "ai-studio-director-subtab",
          attrs: { type: "button", role: "tab", "aria-selected": "true" },
          dataset: { testid: "ai-studio-director-tab-flow" },
          text: "1. 스토리보드 흐름",
          on: { click: () => { activeTab = "flow"; refresh(); } },
        }) as HTMLButtonElement;
        tabButtons.flow = btn;
        return btn;
      })(),
      (() => {
        const btn = el("button", {
          class: "ai-studio-director-subtab",
          attrs: { type: "button", role: "tab", "aria-selected": "false" },
          dataset: { testid: "ai-studio-director-tab-system" },
          children: [systemTabLabelSpan],
          on: { click: () => { activeTab = "system"; refresh(); } },
        }) as HTMLButtonElement;
        tabButtons.system = btn;
        return btn;
      })(),
      (() => {
        const btn = el("button", {
          class: "ai-studio-director-subtab",
          attrs: { type: "button", role: "tab", "aria-selected": "false" },
          dataset: { testid: "ai-studio-director-tab-cinema" },
          text: "3. 오프닝 · 컷신 극장",
          on: { click: () => { activeTab = "cinema"; refresh(); } },
        }) as HTMLButtonElement;
        tabButtons.cinema = btn;
        return btn;
      })(),
    ],
  });

  const subtitleLine = el("p", {
    class: "ai-studio-director-subtitle",
    dataset: { testid: "ai-studio-director-subtitle" },
  });

  const topBar = el("div", {
    class: "ai-studio-director-topbar",
    children: [
      el("div", { class: "ai-studio-director-topbar-row", children: [subTabs, genreSwitcher] }),
      subtitleLine,
    ],
  });

  const contentHost = el("div", {
    class: "ai-studio-director-content",
    dataset: { testid: "ai-studio-director-content" },
  });

  const root = el("div", {
    class: "ai-studio-director-board",
    dataset: { testid: "ai-studio-director-board" },
    attrs: { "aria-label": "장르 적응형 스토리보드 & 감독 보드" },
    children: [topBar, contentHost],
  });

  const renderStagePreview = (beat: DirectorBeat, project: Project): HTMLElement => {
    const mapId = beat.mapId ?? project.startMapId;
    const hasMap = Boolean(mapId && project.maps[mapId]);
    const backdrop = hasMap
      ? createMapThumbnail(mapId, {
          width: 320,
          height: 180,
          className: "ai-studio-director-stage-map-canvas",
          testId: `ai-studio-stage-thumb-${beat.id}`,
        })
      : el("img", { class: "ai-studio-director-stage-backdrop-img", attrs: { src: beat.backdropUrl, alt: beat.title } });

    const overlayChildren: HTMLElement[] = [];

    if (beat.stageKind === "monster") {
      overlayChildren.push(
        el("div", {
          class: "ai-studio-director-stage-monster-hud is-foe",
          children: [
            el("strong", { text: beat.stageSprites.rightLabel ?? "야생 몬스터" }),
            el("div", { class: "ai-studio-director-hp-bar", children: [el("span", { class: "ai-studio-director-hp-fill is-good", attrs: { style: "width: 78%" } })] }),
          ],
        }),
        el("div", {
          class: "ai-studio-director-stage-monster-sprites",
          children: [
            el("img", { class: "ai-studio-director-pixel-sprite is-back", attrs: { src: beat.stageSprites.leftUrl, alt: beat.stageSprites.leftLabel ?? "파트너" } }),
            el("img", { class: "ai-studio-director-pixel-sprite is-front", attrs: { src: beat.stageSprites.rightUrl, alt: beat.stageSprites.rightLabel ?? "상대" } }),
          ],
        }),
        el("div", {
          class: "ai-studio-director-stage-monster-hud is-ally",
          children: [
            el("strong", { text: beat.stageSprites.leftLabel ?? "내 파트너" }),
            el("div", { class: "ai-studio-director-hp-bar", children: [el("span", { class: "ai-studio-director-hp-fill is-good", attrs: { style: "width: 100%" } })] }),
          ],
        }),
      );
    } else if (beat.stageKind === "romance") {
      overlayChildren.push(
        el("div", {
          class: "ai-studio-director-stage-vn-cast",
          children: [
            el("img", { class: "ai-studio-director-vn-standing is-left", attrs: { src: beat.stageSprites.leftUrl, alt: beat.stageSprites.leftLabel ?? "히로인 좌" } }),
            el("img", { class: "ai-studio-director-vn-standing is-right", attrs: { src: beat.stageSprites.rightUrl, alt: beat.stageSprites.rightLabel ?? "히로인 우" } }),
          ],
        }),
      );
    } else {
      overlayChildren.push(
        el("div", {
          class: "ai-studio-director-stage-jrpg-hud",
          children: [
            el("span", { class: "ai-studio-director-jrpg-party-pill", text: "아리아 HP 280/280" }),
            el("span", { class: "ai-studio-director-jrpg-party-pill", text: "세리아 MP 95/95" }),
            el("span", { class: "ai-studio-director-jrpg-party-pill is-dual", text: "[연계] 화염회전베기 READY" }),
          ],
        }),
        el("div", {
          class: "ai-studio-director-stage-jrpg-cast",
          children: [
            el("img", { class: "ai-studio-director-jrpg-sprite", attrs: { src: beat.stageSprites.leftUrl, alt: beat.stageSprites.leftLabel ?? "전열" } }),
            el("img", { class: "ai-studio-director-jrpg-portrait", attrs: { src: beat.stageSprites.rightUrl, alt: beat.stageSprites.rightLabel ?? "후열" } }),
          ],
        }),
      );
    }

    overlayChildren.push(
      el("div", {
        class: "ai-studio-director-stage-dialogue",
        children: [
          ...(beat.stageSprites.bustUrl
            ? [el("img", { class: "ai-studio-director-stage-bust", attrs: { src: beat.stageSprites.bustUrl, alt: beat.stageSpeaker } })]
            : []),
          el("div", {
            class: "ai-studio-director-stage-dialogue-copy",
            children: [
              el("span", { class: "ai-studio-director-stage-speaker", text: beat.stageSpeaker }),
              el("p", { class: "ai-studio-director-stage-line", text: beat.stageLine }),
            ],
          }),
        ],
      }),
    );

    return el("div", {
      class: `ai-studio-director-stage-16x9 is-${beat.stageKind}`,
      dataset: { testid: "ai-studio-stage-16x9", stageKind: beat.stageKind },
      children: [
        el("div", { class: "ai-studio-director-stage-backdrop", children: [backdrop] }),
        el("div", { class: "ai-studio-director-stage-overlay", children: overlayChildren }),
      ],
    });
  };

  const renderFlowView = (project: Project, genre: StudioDirectorGenre): HTMLElement => {
    const beats = buildBeatsForGenre(project, genre);
    const activeBeat = beats.find((b) => b.id === selectedBeatId) ?? beats.find((b) => b.defect !== null) ?? beats[0];
    if (activeBeat && selectedBeatId !== activeBeat.id) selectedBeatId = activeBeat.id;

    const beatCards = beats.map((beat) => {
      const selected = beat.id === activeBeat?.id;
      const mapId = beat.mapId ?? project.startMapId;
      const thumbNode = mapId && project.maps[mapId]
        ? createMapThumbnail(mapId, {
            width: 112,
            height: 70,
            className: "ai-studio-director-beat-thumb-canvas",
            testId: `ai-studio-beat-thumb-${beat.id}`,
          })
        : el("img", { class: "ai-studio-director-beat-thumb-img", attrs: { src: beat.backdropUrl, alt: beat.title } });

      return el("button", {
        class: `ai-studio-director-beat-card${selected ? " is-selected" : ""}${beat.defect ? " has-defect" : ""}`,
        attrs: { type: "button", "aria-pressed": String(selected) },
        dataset: { testid: "ai-studio-beat-card", beatId: beat.id, ...(beat.mapId ? { mapId: beat.mapId } : {}) },
        on: {
          click: () => {
            selectedBeatId = beat.id;
            if (beat.mapId && project.maps[beat.mapId]) {
              selectEditorMap(beat.mapId);
              options.onSelectMap?.(beat.mapId);
            }
            refresh();
          },
        },
        children: [
          el("div", {
            class: "ai-studio-director-beat-head",
            children: [
              el("span", { class: "ai-studio-director-beat-step", text: beat.stepLabel }),
              ...(beat.defect
                ? [el("span", { class: "ai-studio-director-defect-pill", dataset: { testid: "ai-studio-beat-defect-pill" }, text: `⚠ ${beat.defect.badge}` })]
                : [el("span", { class: "ai-studio-director-ok-pill", text: "연결 정상" })]),
            ],
          }),
          el("div", {
            class: "ai-studio-director-beat-body",
            children: [
              el("div", { class: "ai-studio-director-beat-thumb", children: [thumbNode] }),
              el("div", {
                class: "ai-studio-director-beat-info",
                children: [
                  el("strong", { class: "ai-studio-director-beat-title", text: beat.title }),
                  el("span", { class: "ai-studio-director-beat-meta", text: beat.mapMeta }),
                  el("p", { class: "ai-studio-director-beat-summary", text: beat.summary }),
                  el("div", {
                    class: "ai-studio-director-beat-cast",
                    children: beat.castNames.map((name) => el("span", { class: "ai-studio-director-cast-chip", text: name })),
                  }),
                ],
              }),
            ],
          }),
        ],
      });
    });

    if (!activeBeat) return el("div", { class: "ai-studio-director-flow-grid", children: beatCards });

    const targetMapId = activeBeat.mapId ?? project.startMapId;
    const planningInput = el("input", {
      class: "ai-studio-director-planning-input",
      attrs: { type: "text", placeholder: "이 장면에 보존할 기획 한 줄 추가 후 Enter…", value: planningDraft, "aria-label": "장면 기획 메모 추가" },
      dataset: { testid: "ai-studio-planning-pin-input" },
      on: {
        input: (e) => { planningDraft = (e.currentTarget as HTMLInputElement).value; },
        keydown: (e) => {
          if (!(e instanceof KeyboardEvent) || e.key !== "Enter") return;
          e.preventDefault();
          const text = planningDraft.trim();
          if (!text || !targetMapId) return;
          addMapPlanningItem(targetMapId, text);
          planningDraft = "";
          refresh();
        },
      },
    }) as HTMLInputElement;

    const inspector = el("aside", {
      class: "ai-studio-director-inspector",
      dataset: { testid: "ai-studio-director-inspector", beatId: activeBeat.id },
      attrs: { "aria-label": "선택한 장면 감독 인스펙터" },
      children: [
        el("div", {
          class: "ai-studio-director-inspector-head",
          children: [
            el("div", {
              children: [
                el("span", { class: "ai-studio-director-kicker", text: `${activeBeat.stepLabel} · 16:9 실시간 무대 프리뷰` }),
                el("h3", { class: "ai-studio-director-inspector-title", dataset: { testid: "ai-studio-inspector-title" }, text: activeBeat.title }),
              ],
            }),
            el("div", {
              class: "ai-studio-director-inspector-actions",
              children: [
                el("button", {
                  class: "ai-studio-director-btn is-primary",
                  attrs: { type: "button", title: "이 장면(Beat) 위치부터 즉시 테스트 플레이를 시작합니다" },
                  dataset: { testid: "ai-studio-play-beat" },
                  text: "▶ 이 장면부터 바로 플레이",
                  on: {
                    click: () => {
                      const target = targetMapId && project.maps[targetMapId] ? project.maps[targetMapId] : null;
                      const modPromise = import("@/editor/panels/testPlayModal");
                      void modPromise.then(({ openTestPlayModal }) => {
                        if (target) {
                          openTestPlayModal({ mapId: target.id, x: Math.max(1, Math.floor(target.width / 2)), y: Math.max(1, Math.floor(target.height / 2)) });
                        } else {
                          openTestPlayModal();
                        }
                      });
                    },
                  },
                }),
                el("button", {
                  class: "ai-studio-director-btn",
                  attrs: { type: "button", title: "이 장면을 선택한 채 타일·이벤트 편집기로 이동합니다" },
                  dataset: { testid: "ai-studio-open-tile-editor" },
                  text: "타일 편집기로 열기",
                  on: {
                    click: () => {
                      if (targetMapId && project.maps[targetMapId]) selectEditorMap(targetMapId);
                      options.onOpenTileEditor?.(targetMapId);
                    },
                  },
                }),
              ],
            }),
          ],
        }),
        renderStagePreview(activeBeat, project),
        el("p", { class: "ai-studio-director-stage-subtext", text: activeBeat.stageSubtext }),
        el("div", { class: "ai-studio-director-mood-row", children: activeBeat.moodChips.map((chip) => el("span", { class: "ai-studio-director-mood-chip", text: chip })) }),
        el("div", {
          class: "ai-studio-director-planning-pin",
          dataset: { testid: "ai-studio-planning-pin" },
          children: [
            el("div", {
              class: "ai-studio-director-section-head",
              children: [el("strong", { text: "📌 고정 기획 노트 (Planning Pin)" }), el("span", { text: `${activeBeat.planningNotes.length}건 보존 중` })],
            }),
            el("ul", { class: "ai-studio-director-planning-list", children: activeBeat.planningNotes.map((note) => el("li", { text: note })) }),
            el("div", {
              class: "ai-studio-director-planning-add",
              children: [
                planningInput,
                el("button", {
                  class: "ai-studio-director-btn",
                  attrs: { type: "button" },
                  dataset: { testid: "ai-studio-planning-pin-add" },
                  text: "+ 고정",
                  on: {
                    click: () => {
                      const text = planningDraft.trim();
                      if (!text || !targetMapId) return;
                      addMapPlanningItem(targetMapId, text);
                      planningDraft = "";
                      refresh();
                    },
                  },
                }),
              ],
            }),
          ],
        }),
        ...(activeBeat.defect
          ? [
              el("div", {
                class: "ai-studio-director-defect-box",
                dataset: { testid: "ai-studio-defect-box" },
                children: [
                  el("div", {
                    class: "ai-studio-director-defect-copy",
                    children: [el("strong", { text: `⚠ 결함 감지: ${activeBeat.defect.badge}` }), el("p", { text: activeBeat.defect.detail })],
                  }),
                  el("button", {
                    class: "ai-studio-director-btn is-danger-fix",
                    attrs: { type: "button" },
                    dataset: { testid: "ai-studio-defect-fix" },
                    text: "AI로 즉시 수리 ↗",
                    on: { click: () => options.onPromptPick?.(activeBeat.defect?.aiPrompt ?? "") },
                  }),
                ],
              }),
            ]
          : []),
      ],
    });

    return el("div", {
      class: "ai-studio-director-flow-layout",
      dataset: { testid: "ai-studio-flow-layout" },
      children: [
        el("div", { class: "ai-studio-director-beat-column", attrs: { role: "list", "aria-label": "스토리보드 비트 목록" }, children: beatCards }),
        inspector,
      ],
    });
  };

  const renderSystemView = (project: Project, genre: StudioDirectorGenre): HTMLElement => {
    const { cards, matrixTitle, matrixRows } = buildSystemEntries(project, genre);
    return el("div", {
      class: "ai-studio-director-system-board",
      dataset: { testid: "ai-studio-system-board", genre },
      children: [
        el("div", {
          class: "ai-studio-director-system-cards",
          children: cards.map((card) =>
            el("article", {
              class: "ai-studio-director-system-card",
              dataset: { testid: "ai-studio-system-card", cardId: card.id },
              children: [
                el("span", { class: "ai-studio-director-kicker", text: card.badge }),
                el("h3", { class: "ai-studio-director-system-card-title", text: card.title }),
                el("p", { class: "ai-studio-director-system-card-sub", text: card.subtitle }),
                el("div", {
                  class: "ai-studio-director-sprite-strip",
                  children: card.sprites.map((sp) =>
                    el("figure", { class: "ai-studio-director-sprite-figure", children: [el("img", { attrs: { src: sp.url, alt: sp.label } }), el("figcaption", { text: sp.label })] })),
                }),
                el("div", {
                  class: "ai-studio-director-metric-list",
                  children: card.metrics.map((m) =>
                    el("div", { class: `ai-studio-director-metric-row${m.warn ? " is-warn" : ""}`, children: [el("span", { text: m.label }), el("strong", { text: m.value })] })),
                }),
                ...(card.defectPrompt
                  ? [
                      el("button", {
                        class: "ai-studio-director-btn is-danger-fix",
                        attrs: { type: "button" },
                        dataset: { testid: "ai-studio-system-card-fix" },
                        text: "AI로 결함 보강 ↗",
                        on: { click: () => options.onPromptPick?.(card.defectPrompt ?? "") },
                      }),
                    ]
                  : []),
              ],
            })),
        }),
        el("section", {
          class: "ai-studio-director-matrix-section",
          children: [
            el("h3", { class: "ai-studio-director-matrix-title", text: matrixTitle }),
            el("div", {
              class: "ai-studio-director-matrix-list",
              children: matrixRows.map((row) =>
                el("div", {
                  class: `ai-studio-director-matrix-row${row.isWarn ? " is-warn" : ""}`,
                  dataset: { testid: "ai-studio-matrix-row", rowId: row.id },
                  children: [
                    el("div", {
                      class: "ai-studio-director-matrix-main",
                      children: [el("strong", { text: row.name }), el("span", { class: "ai-studio-director-matrix-role", text: row.role }), el("p", { text: row.detail })],
                    }),
                    el("div", {
                      class: "ai-studio-director-matrix-side",
                      children: [
                        el("span", { class: row.isWarn ? "ai-studio-director-defect-pill" : "ai-studio-director-ok-pill", text: row.statusLabel }),
                        ...(row.aiPrompt
                          ? [
                              el("button", {
                                class: "ai-studio-director-btn is-danger-fix",
                                attrs: { type: "button" },
                                dataset: { testid: "ai-studio-matrix-fix" },
                                text: "AI로 즉시 수리 ↗",
                                on: { click: () => options.onPromptPick?.(row.aiPrompt ?? "") },
                              }),
                            ]
                          : []),
                      ],
                    }),
                  ],
                })),
            }),
          ],
        }),
      ],
    });
  };

  const renderCinemaView = (project: Project, genre: StudioDirectorGenre): HTMLElement => {
    const shots = buildOpeningShots(project, genre);
    const titleText = project.meta.title?.trim() || "여명의 시계탑과 별빛의 약속";
    return el("div", {
      class: "ai-studio-director-cinema-board",
      dataset: { testid: "ai-studio-cinema-board" },
      children: [
        el("div", {
          class: "ai-studio-director-cinema-hero",
          children: [
            el("div", {
              class: "ai-studio-director-cinema-hero-copy",
              children: [
                el("span", { class: "ai-studio-director-kicker", text: "TITLE & 6-SHOT PIXEL ANIMATIC (#2852)" }),
                el("h3", { class: "ai-studio-director-cinema-title", text: `${titleText} · 오프닝 시퀀스` }),
                el("p", {
                  class: "ai-studio-director-cinema-sub",
                  text: "WORLD → RUPTURE → STAKES → MYSTERY → INVITATION → HANDOFF 6단계 서사 컷이 타이틀 화면 직후 재생되며, 마지막 6번째 컷에서 시작 맵으로 끊김 없이(Seamless) 이어집니다.",
                }),
              ],
            }),
            el("div", {
              class: "ai-studio-director-cinema-actions",
              children: [
                el("button", {
                  class: "ai-studio-director-btn is-primary",
                  attrs: { type: "button" },
                  dataset: { testid: "ai-studio-play-opening" },
                  text: "▶ 오프닝 전체 재생 (0:20)",
                  on: { click: () => { const modPromise = import("@/editor/panels/testPlayModal"); void modPromise.then(({ openTestPlayModal }) => openTestPlayModal()); } },
                }),
                el("button", {
                  class: "ai-studio-director-btn",
                  attrs: { type: "button" },
                  dataset: { testid: "ai-studio-generate-opening" },
                  text: "AI로 6컷 오프닝 재연출 ↗",
                  on: {
                    click: () =>
                      options.onPromptPick?.(
                        `${GENRE_META[genre].shortLabel} 분위기에 맞춰 6-Shot 오프닝 시퀀스(WORLD→RUPTURE→STAKES→MYSTERY→INVITATION→HANDOFF)와 타이틀 화면 연출을 자동 구성해 줘.`,
                      ),
                  },
                }),
              ],
            }),
          ],
        }),
        el("div", {
          class: "ai-studio-director-shot-grid",
          children: shots.map((shot) =>
            el("article", {
              class: "ai-studio-director-shot-card",
              dataset: { testid: "ai-studio-opening-shot", shotStep: shot.step },
              children: [
                el("div", {
                  class: "ai-studio-director-shot-frame",
                  children: [
                    el("img", { attrs: { src: shot.imageUrl, alt: shot.title } }),
                    el("span", { class: "ai-studio-director-shot-badge", text: `${shot.step} · ${shot.beatRole}` }),
                    el("span", { class: "ai-studio-director-shot-time", text: shot.durationLabel }),
                  ],
                }),
                el("div", {
                  class: "ai-studio-director-shot-body",
                  children: [el("strong", { text: shot.title }), el("span", { class: "ai-studio-director-shot-cam", text: shot.cameraLabel }), el("p", { text: shot.caption })],
                }),
              ],
            })),
        }),
      ],
    });
  };

  const refresh = (): void => {
    const project = store.getCurrent();
    const genre = currentGenre();
    const meta = GENRE_META[genre];
    root.dataset.genre = genre;
    root.dataset.tab = activeTab;
    systemTabLabelSpan.textContent = meta.systemTabLabel;
    subtitleLine.textContent = meta.subtitle;

    for (const g of ["monster-taming", "classic-jrpg", "romance"] as const) {
      const btn = genreButtons[g];
      if (!btn) continue;
      const active = g === genre;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    }
    for (const t of ["flow", "system", "cinema"] as const) {
      const btn = tabButtons[t];
      if (!btn) continue;
      const active = t === activeTab;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    }


    if (activeTab === "flow") contentHost.replaceChildren(renderFlowView(project, genre));
    else if (activeTab === "system") contentHost.replaceChildren(renderSystemView(project, genre));
    else contentHost.replaceChildren(renderCinemaView(project, genre));
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
