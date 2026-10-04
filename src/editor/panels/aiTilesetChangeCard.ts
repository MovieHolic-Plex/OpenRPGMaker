// editor/panels/aiTilesetChangeCard.ts
// 칩셋 계열 변경 질문 카드(2026-09-25 사용자 결정). 조수가 ask_tileset_change 를 부르면 Pi 턴 끝에 이 카드가 뜬다:
// 지금 보는 맵의 실제 화면 일부와 바뀔 칩셋의 견본을 나란히 보여 주고, 사용자가 고르면 후속 요청을 보낸다.
// 승인은 패널 대화 상태(승인 계열 목록)에 넣고 Pi 요청 approvedTilesetFamilies 로 간다 — 실행기 계열 검사가 그 계열을 통과시킨다.
// 모양은 제작 전 그래픽 선택 카드(aiCreationChoice.ts)를 따르되 클래스는 ai-tileset-change-*.

import { isTilesetChangeQuestion, type TilesetChangeQuestion } from "@/editor/tools/tilesetChangeTools";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { drawMapTileLayers, loadTilesetImage } from "@/editor/mapTileDraw";
import { referenceOwner } from "@/project/tilesetReferences";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

/** 지금 맵 견본 크기(칸). 맵이 작으면 맵 전체. */
const CROP_COLUMNS = 16;
const CROP_ROWS = 10;
/** 참고 그림이 없는 칩셋의 아틀라스 견본 크기(칸). */
const ATLAS_COLUMNS = 12;
const ATLAS_ROWS = 8;
/** 견본은 32px 칸 기준으로 키운다 — 16px 칩셋이 우표만 하게 보이지 않게. */
const SAMPLE_CELL_PX = 32;

/** Pi 이벤트(팀 모드의 agent_event 포장 포함)에서 성공한 ask_tileset_change 결과를 꺼낸다. */
export function tilesetQuestionFromEvent(raw: PiAgentEvent): TilesetChangeQuestion | null {
  let event = raw;
  while (event.type === "agent_event") event = event.event;
  if (event.type !== "tool_end" || event.name !== "ask_tileset_change" || !event.ok) return null;
  const data = (event.result as { data?: unknown } | undefined)?.data;
  return isTilesetChangeQuestion(data) ? data : null;
}

/** 카드 버튼이 보내는 후속 요청 문장. 모델이 읽는 지시문이다. */
export function tilesetChangeFollowUp(question: TilesetChangeQuestion, approved: boolean): string {
  return approved
    ? `[사용자 승인] 칩셋 계열 변경 허용: ${question.fromLabel} → ${question.toLabel}. 원래 요청을 이어서 하라.`
    : `[사용자 거절] ${question.fromLabel} 계열 안에서만 만들어라. 이 계열로 못 만드는 부분은 무엇이 부족한지 말하라.`;
}

export interface TilesetChangeDecision {
  readonly approved: boolean;
  /** 승인이면 대화 승인 목록에 넣을 계열. */
  readonly family: string;
  readonly followUp: string;
}

function scaleFor(tileSize: number): number {
  return Math.max(1, Math.round(SAMPLE_CELL_PX / Math.max(1, tileSize)));
}

function canvasOf(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = el("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("견본을 그릴 수 없습니다.");
  context.imageSmoothingEnabled = false;
  return { canvas, context };
}

/** 지금 보는 맵 가운데 최대 16×10칸을 실제 층 그대로 그린다. 프로젝트는 건드리지 않는다. */
async function currentMapSample(map: GameMap, tileset: TilesetDef): Promise<string> {
  const atlas = await loadTilesetImage(tileset);
  const scale = scaleFor(tileset.tileSize);
  const cell = tileset.tileSize * scale;
  const columns = Math.min(CROP_COLUMNS, map.width);
  const rows = Math.min(CROP_ROWS, map.height);
  const x0 = Math.floor((map.width - columns) / 2);
  const y0 = Math.floor((map.height - rows) / 2);
  const { canvas, context } = canvasOf(columns * cell, rows * cell);
  // 맵 전체를 옮겨 그리고 캔버스 밖은 버린다 — 층·그림자 자르기를 따로 하지 않아도 된다.
  context.translate(-x0 * cell, -y0 * cell);
  drawMapTileLayers(context, atlas, map, tileset, scale);
  return canvas.toDataURL();
}

/** 참고 그림이 없는 칩셋: 아틀라스 앞부분 12×8칸을 칸 그대로. */
async function atlasSample(tileset: TilesetDef): Promise<string> {
  const atlas = await loadTilesetImage(tileset);
  const scale = scaleFor(tileset.tileSize);
  const size = tileset.tileSize;
  const columns = Math.max(1, Math.min(ATLAS_COLUMNS, tileset.tilesPerRow));
  const rows = Math.max(1, Math.min(ATLAS_ROWS, Math.ceil(tileset.count / Math.max(1, tileset.tilesPerRow))));
  const { canvas, context } = canvasOf(columns * size * scale, rows * size * scale);
  context.drawImage(atlas, 0, 0, columns * size, rows * size, 0, 0, columns * size * scale, rows * size * scale);
  return canvas.toDataURL();
}

/** 대상 칩셋의 참고문서 그림 — purpose 가 맞는 용도, 없으면 그림이 있는 첫 용도의 첫 그림. */
export function targetReferenceImage(project: Project, tileset: TilesetDef, purpose: string | null): { src: string; name: string } | null {
  let owner: TilesetDef;
  try { owner = referenceOwner(project, tileset); } catch { return null; }
  const categories = (owner.referenceDocuments ?? []).filter((category) => category.images.length > 0);
  const category = (purpose ? categories.find((entry) => entry.id === purpose) : undefined) ?? categories[0];
  const image = category?.images[0];
  return image ? { src: image.dataUrl, name: `${category!.name} · ${image.name}` } : null;
}

async function targetSample(project: Project, tileset: TilesetDef, purpose: string | null): Promise<{ src: string; note: string }> {
  const reference = targetReferenceImage(project, tileset, purpose);
  if (reference) return { src: reference.src, note: `참고 그림 · ${reference.name}` };
  return { src: await atlasSample(tileset), note: "타일 모음 앞부분" };
}

function sampleFigure(title: string, testid: string): { figure: HTMLElement; fill(src: string, alt: string, note: string): void; fail(): void } {
  const frame = el("div", { class: "ai-tileset-change-frame", text: "견본을 그리는 중…" });
  const note = el("figcaption", { children: [el("strong", { text: title })] });
  const figure = el("figure", { class: "ai-tileset-change-sample", dataset: { testid }, children: [frame, note] });
  return {
    figure,
    fill(src, alt, detail) {
      frame.replaceChildren(el("img", { attrs: { src, alt } }));
      note.append(el("span", { text: detail }));
    },
    fail() { frame.textContent = "견본을 그리지 못했어요."; },
  };
}

/**
 * 질문 카드. 버튼을 한 번 누르면 잠기고 onDecision 이 한 번 불린다(승인 목록 갱신·후속 요청은 호출자가 한다).
 * 그림은 비동기로 채운다 — 못 그려도 카드와 버튼은 쓸 수 있다.
 */
export function createTilesetChangeCard(
  project: Project,
  question: TilesetChangeQuestion,
  onDecision: (decision: TilesetChangeDecision) => void,
): HTMLElement {
  const fromTileset = project.tilesets[question.fromTilesetId];
  const toTileset = project.tilesets[question.toTilesetId];
  const map = question.mapId ? project.maps[question.mapId] : undefined;
  const fromName = fromTileset?.name ?? question.fromTilesetId;
  const toName = toTileset?.name ?? question.toTilesetId;
  const before = sampleFigure(`지금 · ${question.fromLabel}`, "ai-tileset-change-before");
  const after = sampleFigure(`바뀐 뒤 · ${question.toLabel}`, "ai-tileset-change-after");
  const status = el("p", { class: "ai-tileset-change-status", attrs: { role: "status" } });
  const buttons: HTMLButtonElement[] = [];
  let settled = false;
  const decide = (approved: boolean): void => {
    if (settled) return;
    settled = true;
    for (const button of buttons) button.disabled = true;
    root.classList.add(approved ? "is-approved" : "is-rejected");
    status.textContent = approved ? `${question.toLabel} 타일로 이어서 만들게요.` : `${question.fromLabel} 타일 안에서 만들게요.`;
    onDecision({ approved, family: question.toFamily, followUp: tilesetChangeFollowUp(question, approved) });
  };
  const button = (text: string, approved: boolean, testid: string, cls = ""): HTMLButtonElement => {
    const node = el("button", { text, class: cls, attrs: { type: "button" }, dataset: { testid }, on: { click: () => decide(approved) } });
    buttons.push(node);
    return node;
  };
  const root = el("section", {
    class: "ai-tileset-change-card",
    dataset: { testid: "ai-tileset-change-card", toFamily: question.toFamily },
    attrs: { "aria-label": "타일 느낌 변경 확인" },
    children: [
      el("span", { class: "ai-tileset-change-eyebrow", text: "답변 필요" }),
      el("h3", { text: "타일 느낌이 바뀌어요" }),
      el("p", { class: "ai-tileset-change-reason", text: question.reason }),
      el("p", { class: "ai-tileset-change-detail", text: `지금 맵은 「${fromName}」(${question.fromLabel}) 타일이에요. 조수는 「${toName}」(${question.toLabel}) 타일을 쓰려고 해요.` }),
      el("div", { class: "ai-tileset-change-pair", children: [before.figure, after.figure] }),
      status,
      el("footer", { children: [
        button("아니요, 지금 타일로", false, "ai-tileset-change-reject"),
        button("이 타일로 바꿔도 좋아요", true, "ai-tileset-change-approve", "is-primary"),
      ] }),
    ],
  });
  if (map && fromTileset) {
    void currentMapSample(map, fromTileset)
      .then((src) => before.fill(src, `지금 맵 ${map.name} 화면 일부`, map.name))
      .catch(() => before.fail());
  } else before.fail();
  if (toTileset) {
    void targetSample(project, toTileset, question.purpose)
      .then(({ src, note }) => after.fill(src, `${toName} 견본`, note))
      .catch(() => after.fail());
  } else after.fail();
  return root;
}
