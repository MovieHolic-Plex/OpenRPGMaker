// 배역표(scarloxyCast.ts)를 이벤트 그림·대사 얼굴로 바꾸는 얇은 도우미.
// 맵 코드는 칸 번호 대신 배역 이름만 적는다 — castGraphic("nurse"), castLines("nurse", [...]).

import type { Command, EventPage } from "../types";
import { SCARLOXY_CAST, type ScarloxyCastRole } from "./scarloxyCast";
import { charsetGraphic } from "./scarloxyDemoGame";

/** 배역의 걷기 그림(아래 방향 서 있는 칸). */
export function castGraphic(role: ScarloxyCastRole): EventPage["graphic"] {
  const entry = SCARLOXY_CAST[role];
  return charsetGraphic(entry.charsetTextureKey, entry.index);
}

/** 대사창 얼굴을 배역 얼굴로 바꾸는 명령. 얼굴이 없는 배역은 빈 배열. */
export function castFace(role: ScarloxyCastRole): Command[] {
  const faceId = SCARLOXY_CAST[role].faceId;
  return faceId ? [{ kind: "changeFace", resourceId: faceId, position: "left", flipHorizontally: false }] : [];
}

/** 얼굴을 걸고 배역 이름으로 여러 줄을 말한다. speaker 를 주면 화자 이름만 바꾼다. */
export function castLines(role: ScarloxyCastRole, lines: readonly string[], speaker = SCARLOXY_CAST[role].label): Command[] {
  return [...castFace(role), ...lines.map((body) => ({ kind: "text", speaker, body }) satisfies Command)];
}
