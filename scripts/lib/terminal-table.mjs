// 터미널 표 공용 헬퍼 — CLI 리더들이 같은 폭 계산을 쓰게 한다.
//
// 왜 별도 모듈인가: 라벨이 거의 전부 한국어인 표에서 `String.length` 로 패딩하면 열이
// 통째로 어긋난다(실측: 라벨 열이 10칸 이상 밀렸다). 이 계산을 CLI 마다 복제하면
// 한쪽만 고쳐진 채로 남는다.

/** 터미널 표시 폭. CJK·한글·전각은 한 글자가 두 칸을 먹는다. */
export function displayWidth(text) {
  let width = 0;
  for (const char of String(text ?? "")) {
    const code = char.codePointAt(0);
    const wide =
      (code >= 0x1100 && code <= 0x115f) || // 한글 자모
      (code >= 0x2e80 && code <= 0xa4cf) || // CJK 부수·한자·かな
      (code >= 0xac00 && code <= 0xd7a3) || // 한글 음절
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) || // 전각
      (code >= 0xffe0 && code <= 0xffe6);
    width += wide ? 2 : 1;
  }
  return width;
}

/** 표시 폭 기준 좌측 정렬 패딩. 넘치면 자른다. */
export function pad(text, width) {
  const value = String(text ?? "");
  let out = "";
  let used = 0;
  for (const char of value) {
    const charWidth = displayWidth(char);
    if (used + charWidth > width) return out + " ".repeat(Math.max(0, width - used));
    out += char;
    used += charWidth;
  }
  return out + " ".repeat(Math.max(0, width - used));
}

/** `2026-08-29T04:05:06.789Z` → `04:05:06` (로컬 시각). 표에서 날짜는 소음이다. */
export function clockOf(at) {
  const ms = Date.parse(at ?? "");
  if (!Number.isFinite(ms)) return "--:--:--";
  return new Date(ms).toTimeString().slice(0, 8);
}

/**
 * `2026-08-29T19:05:06.789Z` → `08-30 04:05:06` (로컬). 커밋 목록은 날짜가 넘어간다.
 * 날짜도 시각도 **같은 로컬 기준**이어야 한다 — ISO 날짜에 로컬 시각을 붙이면 UTC+9 에서
 * 자정 넘은 행이 하루 전 날짜로 찍힌다(실측).
 */
export function stampOf(at) {
  const ms = Date.parse(at ?? "");
  if (!Number.isFinite(ms)) return "----- --:--:--";
  const local = new Date(ms);
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${month}-${day} ${local.toTimeString().slice(0, 8)}`;
}

/**
 * 편집 행위 1건의 한 줄 요약. `src/editor/editActivityLog.ts` 의 `describeEditActivity` 와
 * 같은 문구를 낸다 — 노드 CLI 는 TS 모듈을 못 import 하므로 형태를 맞춰 복제한다.
 */
export function describeEdit(entry) {
  const parts = [entry.label ?? `(라벨 없음: ${entry.scope})`];
  if (entry.mapId) parts.push(entry.mapId);
  if (entry.collection) parts.push(entry.collection);
  if (entry.cellCount > 0) parts.push(`${entry.cellCount}셀`);
  if (entry.mergedCount > 1) parts.push(`×${entry.mergedCount}`);
  const fields = entry.fields ?? [];
  if (fields.length > 0) {
    parts.push(`[${fields.slice(0, 4).map((field) => field.path).join(", ")}${fields.length > 4 ? ", …" : ""}]`);
  }
  if (entry.origin && entry.origin !== "human") parts.push(`(${entry.origin})`);
  return parts.join(" · ");
}
