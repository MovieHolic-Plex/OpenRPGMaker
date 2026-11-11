// 없는 그림 기록 하나 — 빌더·끝맺음 단계·이야기 조립이 «이 칩셋·테마에는 그 그림이 없다»며 대역을 쓰거나 그대로 둘 때 남긴다.
// 왜(2026-11-11): 봉인 제단·굴 입구는 버들항 조각뿐이라 다른 칩셋 맵 66 · 41장에서 단계가 말없이 지나갔고, 사막 피라미드에는 숲 전투 배경이 섰다.
// 기록이 두 모양으로 생겼다(단계의 `v2.art-gap` 기록 + 한국어 줄, 장소 테마의 `[art-gap]` 줄) — 장부가 둘을 따로 읽어야 했다. 이제 모양은 하나다.
//   줄: `[art-gap] theme=… chipset=… want=… wanted=«…» where=«…» stand-in=«…» by=… note=«…»` (theme·chipset 은 아는 것만, by·note 는 있을 때만)
//   가는 길: session.missingArt(보고 줄 「그림·부품이 없어 못 한 것」) → 턴 끝 `v2.summary` 의 data.artGaps(읽어 낸 기록) → 없는 그림 장부(mapVqa/artGaps.ts).
// 세션이 손에 있으면 recordArtGaps, 결과만 돌려주는 빌더는 결과의 missingArt 에 artGapLine 을 싣는다 — 어느 쪽이든 같은 줄이다. 끝내기를 막지 않는다.
// 조수(src/ai/v2)와 하네스의 장부가 함께 읽는 약속이라 여기에 둔다. 다른 것을 끌어오지 않는다.

export interface ArtGap {
  /** 그 그림이 속할 장소 테마(세계/종류, 예 "desert_east/tomb") — 전투 배경·적처럼 칩셋 밖의 그림. */
  readonly theme?: string;
  /** 그 그림이 속할 맵 칩셋 id — 타일·기물. */
  readonly chipset?: string;
  /** 무엇의 자리인가 — 장부가 모으는 빈칸 없는 영어 열쇠(backdrop · foe · boss · altar-seal · cave-mouth · hiding-furniture · door-piece · prop …). */
  readonly want: string;
  /** 바란 그림의 이름 — 같은 것은 늘 같은 이름(이벤트·맵 이름을 넣지 않는다). */
  readonly wanted: string;
  /** 어디서 — 장소 이름(칸을 알면 「이름 x,y」). */
  readonly where: string;
  /** 대신 쓴 것. 아무것도 안 쓰고 그대로 뒀으면 "none". */
  readonly standIn: string;
  /** 누가 적었나(단계·빌더 id). */
  readonly by?: string;
  /** 어느 이벤트·출입구의 것인가 같은 덧말. */
  readonly note?: string;
}

const TAG = "[art-gap]";
/** «» 안에 들어갈 글 — 닫는 꺾쇠와 줄바꿈은 줄을 깨뜨린다. */
const quoted = (text: string): string => `«${text.replace(/[«»\n]/gu, " ").trim()}»`;
const bare = (text: string): string => text.replace(/\s+/gu, "-");

export function artGapLine(g: ArtGap): string {
  return [
    TAG, g.theme ? `theme=${bare(g.theme)}` : "", g.chipset ? `chipset=${bare(g.chipset)}` : "",
    `want=${bare(g.want)}`, `wanted=${quoted(g.wanted)}`, `where=${quoted(g.where)}`, `stand-in=${quoted(g.standIn || "none")}`,
    g.by ? `by=${bare(g.by)}` : "", g.note ? `note=${quoted(g.note)}` : "",
  ].filter(Boolean).join(" ");
}

/** 줄을 기록으로 — 이 모양이 아닌 줄(빌더의 자유 글)은 undefined. 대역을 꺾쇠 없이 줄 끝까지 적던 옛 줄도 읽는다. */
export function parseArtGap(line: string): ArtGap | undefined {
  const text = line.trim();
  if (!text.startsWith(TAG)) return undefined;
  const word = (key: string) => new RegExp(`(?:^|\\s)${key}=(\\S+)`, "u").exec(text)?.[1];
  const span = (key: string) => new RegExp(`(?:^|\\s)${key}=«([^»]*)»`, "u").exec(text)?.[1];
  const want = word("want"), wanted = span("wanted"), where = span("where");
  const standIn = span("stand-in") ?? /\sstand-in=(.*)$/u.exec(text)?.[1]?.trim();
  if (!want || wanted === undefined || where === undefined || !standIn) return undefined;
  const theme = word("theme"), chipset = word("chipset"), by = word("by"), note = span("note");
  return { ...(theme ? { theme } : {}), ...(chipset ? { chipset } : {}), want, wanted, where, standIn, ...(by ? { by } : {}), ...(note ? { note } : {}) };
}

/** 보고 줄들에서 기록만 — 턴 끝 요약(v2.summary data.artGaps)이 싣는다. */
export function artGapsIn(lines: Iterable<string>): ArtGap[] {
  const out: ArtGap[] = [];
  for (const line of lines) { const gap = parseArtGap(line); if (gap) out.push(gap); }
  return out;
}

/** 사람이 읽는 보고 한 토막 — 기록 줄이 아닌 것은 그대로. */
export function artGapText(line: string): string {
  const g = parseArtGap(line);
  if (!g) return line;
  return `${g.wanted}(${g.where}${g.standIn === "none" ? "" : ` — 대신 ${g.standIn}`}${g.note ? ` · ${g.note}` : ""})`;
}

/** 세션에 적는다. 마감은 한 턴에 여러 번 돈다 — 같은 줄은 한 번만 남는다(Set). */
export function recordArtGaps(session: { readonly missingArt: Set<string> }, gaps: readonly ArtGap[]): void {
  for (const gap of gaps) session.missingArt.add(artGapLine(gap));
}
