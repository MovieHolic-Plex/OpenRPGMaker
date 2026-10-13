// ai/contextFooter.ts
// 패널·영역 작업이 사용자 발화 뒤에 붙이는 `[컨텍스트] …` 줄(현재 맵·선택 영역)을 읽고 걷어내는 순수 함수.
//
// 이 줄은 **사실**(코드가 아는 값)이라 모델에게는 그대로 가고, 사용자 발화만 봐야 하는 자리
// (의도 선언·시선 문구 해석·제안 카드 표시)에서는 걷어낸다. 예전에는 여기에 「도구 규칙」 가이드
// 17줄도 실려 왔고, 그 기계 텍스트를 분류기들이 사용자 말로 읽어 라우팅이 어긋났다(2026-09-03 감사).
// 이제 가이드는 없다 — 규칙은 툴 설명에 있고, 뜻은 의도 선언(intentDeclaration)이 정한다.
//
// 읽기는 **항목 단위**다. 이 줄은 `현재 맵: 이름 (id)` 뒤에 재료 라벨 힌트·선택 영역이 ` · ` 로
// 이어지고(aiChatPanel.contextFooter), 영역 작업은 힌트를 선택 영역 **뒤에** 붙인다
// (runRegionTask.buildRegionTaskMessage). 줄 끝에 `$` 를 박은 정규식은 두 경로 모두에서 선택 영역을
// 놓쳤다 — 암묵 스펙이 프로덕션에서 한 번도 뜨지 않았다(2026-09-03 적대적 리뷰). 맵 이름에는
// ` · ` 와 괄호가 들어갈 수 있으므로(「얼음 대평원 · 절벽과 계단 (64×64)」) id 는 「` · ` 또는 줄 끝이
// 바로 뒤따르는 괄호」로 잡고, 선택 영역은 줄 어디에 있어도 읽는다.

export interface ContextFooterSelection {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface ContextFooter {
  readonly mapId: string | null;
  readonly selection: ContextFooterSelection | null;
}

const FOOTER_LINE = /^\s*\[컨텍스트\]\s*(.*)$/;
const MAP_ID_PATTERN = /현재 맵: .+? \(([^()]+)\)(?= · |\s*$)/;
const SELECTION_PATTERN = /사용자 선택 영역: \((-?\d+),(-?\d+)\) ([1-9]\d*)×([1-9]\d*)/;

interface FooterEventSource {
  readonly maps: Readonly<Record<string, { readonly events?: ReadonlyArray<{ readonly id: string; readonly name?: string; readonly x: number; readonly y: number; readonly pages?: ReadonlyArray<{ readonly id: string; readonly name?: string }> }> } | undefined>>;
}

/**
 * 편집기에서 사용자가 고른 이벤트를 한 줄 사실로 만든다. 「이 이벤트」「이 NPC」「현재 이벤트」「이 문」처럼
 * 지시어로 가리킨 대상이 무엇인지 모델이 맵 전체를 훑어 짐작하지 않게 한다. 고른 이벤트가 이 맵에 없으면 null.
 */
export function selectedEventFact(
  project: FooterEventSource,
  mapId: string,
  eventId: string | null,
  pageId: string | null,
): string | null {
  if (!eventId) return null;
  const event = project.maps[mapId]?.events?.find((candidate) => candidate.id === eventId);
  if (!event) return null;
  const label = event.name ? `${event.name} (${event.id})` : event.id;
  const pageIndex = pageId ? (event.pages ?? []).findIndex((page) => page.id === pageId) : -1;
  const page = pageIndex >= 0 ? ` · 페이지 ${pageIndex + 1}${event.pages?.[pageIndex]?.name ? `「${event.pages[pageIndex]!.name}」` : ""}` : "";
  return `사용자가 선택한 이벤트: ${label} 위치 (${event.x},${event.y})${page} — 「이 이벤트」「이 NPC」「이 문」「현재 이벤트」는 이 이벤트다`;
}

/** `[컨텍스트]` 줄을 뗀 사용자 발화. */
export function stripContextFooter(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("[컨텍스트]"))
    .join("\n")
    .trim();
}

/** 마지막 `[컨텍스트]` 줄을 항목 단위로 읽는다. 줄이 없으면 null. */
export function parseContextFooter(text: string): ContextFooter | null {
  let body: string | null = null;
  for (const line of text.split("\n")) {
    const match = FOOTER_LINE.exec(line);
    if (match?.[1] !== undefined) body = match[1];
  }
  if (body === null) return null;
  const mapMatch = MAP_ID_PATTERN.exec(body);
  const selectionMatch = SELECTION_PATTERN.exec(body);
  const selection = selectionMatch === null
    ? null
    : {
        x: Number.parseInt(selectionMatch[1] ?? "0", 10),
        y: Number.parseInt(selectionMatch[2] ?? "0", 10),
        w: Number.parseInt(selectionMatch[3] ?? "0", 10),
        h: Number.parseInt(selectionMatch[4] ?? "0", 10),
      };
  return { mapId: mapMatch?.[1] ?? null, selection };
}

/** footer 의 현재 맵 id(가장 마지막 것). 없으면 null. */
export function contextFooterMapId(text: string): string | null {
  return parseContextFooter(text)?.mapId ?? null;
}
