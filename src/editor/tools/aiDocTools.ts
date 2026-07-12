// editor/tools/aiDocTools.ts
// AI 리치 문서 툴 — 하이브리드 블록 방식.
// present_doc: 구조화 블록(JSON)으로 문서를 만들어 채팅에 렌더하고 project.aiDocuments에 영속한다.
//   - 구조화 블록(sheetMap/tileBlockCard/paintDemo)은 살아있는 타일셋 데이터를 참조해 그린다.
//   - html 블록은 샌드박스 iframe 탈출구(스크립트 허용, 네트워크/부모 접근 불가).
// list_ai_docs: 저장된 문서 목록 조회.

import { randomUuid } from "@/util/id";
import type { AiDocBlock, AiDocument, Project } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const MAX_BLOCKS = 24;
const MAX_HTML_CHARS = 200_000;
const MAX_MARKDOWN_CHARS = 20_000;
const MAX_ZONES = 40;
const MAX_TABLE_ROWS = 60;
const MAX_TABLE_COLS = 8;
const MAX_CARD_SPAN = 12;
const MAX_DOCUMENTS = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireInt(path: string, value: unknown, min: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new ToolError(`${path}는 ${min}~${max} 정수여야 합니다.`, { code: "invalid-args" });
  }
  return n;
}

function requireStr(path: string, value: unknown, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ToolError(`${path}는 비어있지 않은 문자열이어야 합니다.`, { code: "invalid-args" });
  }
  if (value.length > maxLength) {
    throw new ToolError(`${path}가 너무 깁니다 (최대 ${maxLength}자).`, { code: "invalid-args" });
  }
  return value;
}

function requireTilesetId(project: Project, path: string, value: unknown): string {
  const id = requireStr(path, value, 200);
  if (!project.tilesets[id]) {
    throw new ToolError(`${path}: 타일셋 없음 — ${id}`, { code: "invalid-args" });
  }
  return id;
}

function parseBlock(project: Project, raw: unknown, index: number): AiDocBlock {
  if (!isRecord(raw)) throw new ToolError(`blocks[${index}]는 객체여야 합니다.`, { code: "invalid-args" });
  const path = `blocks[${index}]`;
  const kind = String(raw.kind ?? "");
  if (kind === "markdown") {
    return { kind, text: requireStr(`${path}.text`, raw.text, MAX_MARKDOWN_CHARS) };
  }
  if (kind === "table") {
    const headers = Array.isArray(raw.headers) ? raw.headers.map((h) => String(h)) : [];
    if (headers.length === 0 || headers.length > MAX_TABLE_COLS) {
      throw new ToolError(`${path}.headers는 1~${MAX_TABLE_COLS}개여야 합니다.`, { code: "invalid-args" });
    }
    const rows = Array.isArray(raw.rows) ? raw.rows : [];
    if (rows.length > MAX_TABLE_ROWS) throw new ToolError(`${path}.rows 최대 ${MAX_TABLE_ROWS}행`, { code: "invalid-args" });
    return {
      kind,
      headers,
      rows: rows.map((row) => (Array.isArray(row) ? row.slice(0, MAX_TABLE_COLS).map((cell) => String(cell)) : [String(row)])),
    };
  }
  if (kind === "sheetMap") {
    const tilesetId = requireTilesetId(project, `${path}.tilesetId`, raw.tilesetId);
    const zonesRaw = Array.isArray(raw.zones) ? raw.zones : [];
    if (zonesRaw.length === 0 || zonesRaw.length > MAX_ZONES) {
      throw new ToolError(`${path}.zones는 1~${MAX_ZONES}개여야 합니다.`, { code: "invalid-args" });
    }
    const zones = zonesRaw.map((zone, zi) => {
      if (!isRecord(zone)) throw new ToolError(`${path}.zones[${zi}]는 객체여야 합니다.`, { code: "invalid-args" });
      return {
        col: requireInt(`${path}.zones[${zi}].col`, zone.col, 0, 63),
        row: requireInt(`${path}.zones[${zi}].row`, zone.row, 0, 63),
        w: requireInt(`${path}.zones[${zi}].w`, zone.w, 1, 64),
        h: requireInt(`${path}.zones[${zi}].h`, zone.h, 1, 64),
        label: requireStr(`${path}.zones[${zi}].label`, zone.label, 60),
        color: typeof zone.color === "string" ? zone.color : undefined,
      };
    });
    return { kind, tilesetId, zones };
  }
  if (kind === "tileBlockCard") {
    return {
      kind,
      tilesetId: requireTilesetId(project, `${path}.tilesetId`, raw.tilesetId),
      col: requireInt(`${path}.col`, raw.col, 0, 63),
      row: requireInt(`${path}.row`, raw.row, 0, 63),
      w: requireInt(`${path}.w`, raw.w, 1, MAX_CARD_SPAN),
      h: requireInt(`${path}.h`, raw.h, 1, MAX_CARD_SPAN),
      title: requireStr(`${path}.title`, raw.title, 120),
      caption: typeof raw.caption === "string" ? raw.caption.slice(0, 500) : undefined,
      badge: typeof raw.badge === "string" ? raw.badge.slice(0, 24) : undefined,
    };
  }
  if (kind === "paintDemo") {
    return {
      kind,
      tilesetId: requireTilesetId(project, `${path}.tilesetId`, raw.tilesetId),
      blockCol: requireInt(`${path}.blockCol`, raw.blockCol, 0, 63),
      blockRow: requireInt(`${path}.blockRow`, raw.blockRow, 0, 63),
      title: typeof raw.title === "string" ? raw.title.slice(0, 120) : undefined,
    };
  }
  if (kind === "html") {
    return { kind, src: requireStr(`${path}.src`, raw.src, MAX_HTML_CHARS) };
  }
  throw new ToolError(
    `${path}.kind는 markdown|table|sheetMap|tileBlockCard|paintDemo|html 중 하나여야 합니다: ${kind}`,
    { code: "invalid-args" },
  );
}

export const AI_DOC_TOOLS: readonly ToolDefinition[] = [
  {
    name: "present_doc",
    description:
      "리치 설명 문서를 만들어 채팅에 렌더하고 프로젝트에 저장한다. " +
      "블록: markdown(설명), table(헤더+행), sheetMap(칩셋 시트 + 색상 존 오버레이 — 타일 블록 위치 안내), " +
      "tileBlockCard(칩셋 영역 크롭 카드 — col/row/w/h 타일 단위), " +
      "paintDemo(RM2k3 3×4 오토타일 블록 인터랙티브 페인트 — blockCol/blockRow는 블록 좌상단), " +
      "html(자유형 — 샌드박스 iframe). 타일 이미지는 살아있는 타일셋에서 그려지므로 base64가 필요 없다. " +
      "시각 자료가 필요한 설명(오토타일 구조, 타일 배치 문법, 비교표)에 우선 사용하라.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "문서 제목" },
        blocks: {
          type: "array",
          description:
            "블록 배열. 예: [{kind:'markdown',text:'...'},{kind:'sheetMap',tilesetId:'easyrpg_chipset_interior',zones:[{col:6,row:12,w:3,h:4,label:'다크월'}]},{kind:'tileBlockCard',tilesetId:'...',col:6,row:12,w:3,h:4,title:'다크월 블록'},{kind:'paintDemo',tilesetId:'...',blockCol:0,blockRow:12}]",
          items: { type: "object" },
        },
      },
      required: ["title", "blocks"],
    },
    invalidArgsExample: {
      title: "오토타일 후보 정리",
      blocks: [
        { kind: "markdown", text: "## 요약\n이 칩셋의 오토타일 블록들" },
        { kind: "tileBlockCard", tilesetId: "easyrpg_chipset_interior", col: 6, row: 12, w: 3, h: 4, title: "다크월", badge: "구현됨" },
      ],
    },
    run(draft, args): ToolExecResult {
      const title = requireStr("title", args.title, 200);
      const blocksRaw = args.blocks;
      if (!Array.isArray(blocksRaw) || blocksRaw.length === 0 || blocksRaw.length > MAX_BLOCKS) {
        throw new ToolError(`blocks는 1~${MAX_BLOCKS}개의 배열이어야 합니다.`, { code: "invalid-args" });
      }
      const blocks = blocksRaw.map((raw, index) => parseBlock(draft, raw, index));
      const document: AiDocument = {
        id: `aidoc_${randomUuid().slice(0, 8)}`,
        title,
        createdAt: new Date().toISOString(),
        blocks,
      };
      const existing = draft.aiDocuments ?? [];
      // 상한 초과 시 고정되지 않은 오래된 문서부터 정리
      const trimmed = existing.length >= MAX_DOCUMENTS
        ? [...existing.filter((doc) => doc.pinned), ...existing.filter((doc) => !doc.pinned).slice(-(MAX_DOCUMENTS - 1))]
        : existing;
      draft.aiDocuments = [...trimmed, document];
      return {
        summary: `문서 '${title}' 생성 — 블록 ${blocks.length}개 (채팅에 렌더됨)`,
        data: { document },
      };
    },
  },
  {
    name: "list_ai_docs",
    description: "저장된 AI 문서 목록을 조회한다(제목/블록 수/생성 시각).",
    mode: "read",
    parameters: { type: "object", properties: {} },
    invalidArgsExample: {},
    run(project): ToolExecResult {
      const documents = (project.aiDocuments ?? []).map((doc) => ({
        id: doc.id,
        title: doc.title,
        createdAt: doc.createdAt,
        blockCount: doc.blocks.length,
        pinned: doc.pinned === true,
      }));
      return { summary: `AI 문서 ${documents.length}건`, data: { documents } };
    },
  },
];
