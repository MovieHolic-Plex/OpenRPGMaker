// 그림이 없어 지나간 자리의 기록 — 단계가 «이 칩셋에는 그 그림이 없다»며 아무것도 하지 않을 때 남긴다.
// 왜(2026-11-11 단계×테마 표): 봉인 제단·굴 입구는 버들항 조각뿐이라 다른 칩셋 맵 66 · 41장에서 단계가 말없이 지나갔고,
// 추격자 방 25곳 중 14곳은 숨을 가구가 없었다. 말없이 지나가면 «어느 칩셋에 무슨 그림이 모자란지»를 아무도 모른다.
// 턴 기록(v2.art-gap)의 data 가 정본이고, 보고 줄(session.missingArt)은 사람이 읽는 한 줄이다. 끝내기를 막지 않는다.
import type { PiAssistantV2Env } from "./env";
import type { V2Session } from "../turn/session";

export interface ArtGap {
  readonly tilesetId: string;
  /** 무엇이 필요했나 — 장부가 모으는 영어 열쇠(예: "altar/seal", "cave mouth", "hiding furniture", "door piece", "prop: 서류"). */
  readonly want: string;
  /** 그 그림의 한국어 이름 — 같은 것은 늘 같은 이름(이벤트·맵 이름을 넣지 않는다). 보고 줄의 맨 앞에 온다. */
  readonly thing: string;
  /** 어느 이벤트·출입구의 것인가(있으면). */
  readonly note?: string;
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
}

export function recordArtGaps(ctx: { readonly env: PiAssistantV2Env; readonly session: V2Session }, stage: string, gaps: readonly ArtGap[]): void {
  for (const gap of gaps) {
    const mapName = ctx.env.ctx.project.maps[gap.mapId]?.name ?? gap.mapId;
    // 줄은 그림 이름으로 시작한다 — 없는 그림 장부(mapVqa/artGaps.ts)가 missingArt 줄의 첫 괄호 앞을 그림 이름으로 읽는다.
    const line = `${gap.thing} (${gap.want}) — 칩셋 ${gap.tilesetId} 에 없어 ${mapName} ${gap.x},${gap.y} 를 그대로 둠${gap.note ? `: ${gap.note}` : ""}`;
    if (ctx.session.missingArt.has(line)) continue; // 마감은 한 턴에 여러 번 돈다 — 같은 자리는 한 번만 적는다.
    ctx.session.missingArt.add(line);
    ctx.env.emit({ type: "execution_status", name: "v2.art-gap", ok: false, summary: line, data: { stage, ...gap } });
  }
}
