export const classes = ["al-card", "bt-row", `bt-${"is-active"}`];
// 템플릿 중간의 동적 접두어 — 백틱 바로 뒤가 아니라 공백 뒤에 온다 (tilesetAutotileEditor.ts:333 의 형태).
export const glyphClass = (kind: string) => `al-glyph al-glyph-${kind}`;
