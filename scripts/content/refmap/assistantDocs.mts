// REFMAP 세트 타일셋의 조수용 참고문서: 규칙 · 예시(실제 게시 장소를 글자 배열로) · 장소 목록.
// buildMvPackTileset 이 굽는 기본 문서(까는 순서·재료·물체·예시 블록·팩 정보) 중 예시 블록은 도시 팩용이라
// REFMAP 세트에는 빈 배열(-1)만 들어갔다(2026-09-28 발견). 게시할 때 세트의 실제 맵으로 바꾼다.
import { packSpaceKind, PACK_EMPTY_LIMIT } from "../../../src/project/rpgmakerMv/packMapLint.ts";
import { encodePng, render, shrink, type Converted, type LoadedSet, type MapSpec } from "./lib.mts";

const LETTERS = "#ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** 세트 맵마다 조수가 따라 할 규칙. 게시 검사(check_pack_map)와 같은 기준이다. */
export function rulesDoc(presetId: string): string {
  const kind = packSpaceKind(presetId, true);
  const limit = PACK_EMPTY_LIMIT[kind];
  return [
    "# 규칙 — 게시된 완성 장소가 모두 지킨 것",
    "이 세트의 완성 장소(「장소 목록」)는 모두 아래 규칙을 지킨다. 조수가 깐 맵도 끝에서 `check_pack_map` 으로 같은 기준을 잰다 — 경고가 남으면 끝난 것이 아니다.",
    "",
    "## 1. 목적 먼저 (칠하기 전에)",
    "- 한 줄 이야기(누가 살고 무엇을 하나)를 정하고, 구역마다 **용도 + 기준 물체 하나 + 곁들이 2~4개**를 정한 뒤 깐다. 잔소품은 기준 물체 곁·벽 모서리에만.",
    "- 같은 물체를 줄 세우거나 방 가운데 고르게 흩지 않는다. 러그·꽃병으로 빈 곳을 메우지 않는다.",
    "- 요청한 물건이 이 세트에 없으면(「물체 목록」에서 찾아도 없으면) 뜻이 다른 물체로 대신하지 않는다 — 비석을 잠자리로, 관을 탁자로 쓰지 말 것. 없는 것은 보고에 적는다.",
    "",
    "## 2. 구조",
    "- 천장(A4 윗면) 테 바로 밑에는 **벽면 2줄**이 온다. 방 안 칸막이도 천장 덩이 + 그 밑 벽면 2줄이다. 천장 밑이 바로 바닥이면 떠 보인다.",
    "- 방을 모두 직사각형(ㅁ자)으로 두지 않는다: 구석에 천장 덩이를 들여 ㄱ·ㄷ자 방, 알코브, 튀어나온 벽 기둥을 만든다.",
    "- 벽을 판 문·통로는 위 2줄에 벽면(인방)을 남긴다. 바깥 출구는 남쪽 벽 천장 테를 1~2칸 비워 바닥을 **맵 끝까지** 잇는다(입구 = 맵 가장자리로 이어진 바닥).",
    "",
    "## 3. 공간 — 공간이 남으면 공간이 너무 큰 것이다",
    `- 가구·물체 없는 빈 바닥 직사각형(두 변 3칸 이상)은 ${kind === "interior" ? "집 실내" : kind === "cave" ? "동굴·던전" : "야외"} ${limit}칸 이하. 넘으면 물체로 메우지 말고 **방·맵을 줄인다** — 벽을 안으로 옮기거나 칸막이·알코브를 세우고, 맵 자체가 크면 \`resize_map\`.`,
    "- 작은 집은 9×9~15×13 이면 충분하다. 맵이 커서 남으면 둘레를 천장으로 두고 방은 필요한 만큼만 판다.",
    "",
    "## 4. 통행 (엔진 규칙 그대로)",
    "- 입구에서 모든 바닥·가구 앞까지 걸어서 닿는다. 가구 사이 통로는 1칸이면 된다.",
    "- 침대는 **긴 옆면 한쪽**이 비어 닿아야 한다(발치로만 닿으면 안 된다). 세로 침대(1×3)는 머리를 북벽에, 가로 침대(`*_h`, 3×1)는 머리를 서쪽 벽에.",
    "- 키 큰 가구(선반·장·시계·벽난로·갑옷)는 벽에 붙이고, 그 윗칸을 통로로 쓰지 않는다.",
    "- 물·벽·천장 위를 걷게 만드는 물체를 두지 않는다(계단·다리·문 밑줄만 예외). 두 줄 이상인 물체의 밑줄은 바닥 위에 둔다(벽·천장 위에 세우지 않는다).",
    "",
    "## 5. 벽걸이",
    "- 창·액자·화환·벽 선반·걸린 냄비는 벽면 2줄 안에만. 시계·장은 벽 앞에 세운다.",
    "",
    "## 6. 도구",
    "- **맵 한 장은 `paint_pack_layout` 으로 한 번에 깐다** — 「예시」 문서와 같은 글자 배열(layer1 = 천장·벽면·바닥, layer2 = 탁자·카운터 겹침) + 물체 목록. 배열 크기가 곧 맵 크기다. 결과에 검사 경고가 붙으니 배열을 고쳐 다시 부른다. 방 모양을 한눈에 보며 짜는 것이 칸을 하나씩 칠하는 것보다 낫다.",
    "- 부분 수정: `fill_region material:\"재료 이름\" layer:1`(탁자·카운터 겹침은 `layer:2`).",
    "- 물체: `stamp_tileset_object objectId at:{x,y}`(왼쪽 위 칸) 또는 `base:{x,y}`(땅에 닿는 줄). 한 줄 높이 소품(찻잔·등잔·냄비·책)은 탁자·카운터·상자 위에 그대로 찍으면 4층에 올라간다.",
    "- 끝나면 `show_map_region` 으로 보고 `check_pack_map` 경고가 빌 때까지 고친다.",
    "- 「장소 목록」의 완성 장소는 **요청이 그 장소와 같은 이야기일 때만** `import_region_reference id:\"reviewed:…\"` 로 가져온다(「가난한 셋방을 가져와」, 「지하 묘지를 만들어」). 요청한 구역·물건이 그 장소에 없으면 가져오지 말고 새로 깐다 — 광산을 요청했는데 묘지를, 재봉사 집을 요청했는데 노부부 집을 가져오면 요청을 어긴 것이다.",
    "- 가져왔으면 요청한 구역이 모두 있는지 하나씩 대조하고, 없는 구역·물건은 `paint_pack_layout`·`stamp_tileset_object` 로 더한 뒤 보고에 무엇을 바꿨는지 적는다. 새 맵으로 가져오는 것이 기본이다. 지금 맵에 붙이려면(mapId) 먼저 `resize_map` 으로 장소 크기에 맞춘다 — 맵이 더 크면 둘레에 옛 칸이 남아 벽 테가 어긋난다. 장소 그림 킷(`stamp_object` 의 REFMAP 장소)은 층이 합쳐진 그림이라 쓰지 않는다.",
    "- 새로 까는 요청이면 예시를 베끼지 말고 이야기에 맞게 새로 짠다.",
  ].join("\n");
}

function nameOf(set: LoadedSet, key: string): string {
  if (key.startsWith("#")) {
    const tile = Number(key.slice(1));
    const flat = (set.presetJson.flats ?? []).find((f) => set.tileOf(f.sheet, f.cell) === tile);
    return flat?.name ?? `평타일 ${tile}`;
  }
  return set.presetJson.autotiles.find((a) => `${a.sheet}:${a.kind}` === key)?.name ?? key;
}

function grid(set: LoadedSet, m: Converted, keys: (string | null)[]): { rows: string[]; legend: string[] } {
  const letters = new Map<string, string>();
  const rows: string[] = [];
  for (let y = 0; y < m.height; y += 1) {
    let row = "";
    for (let x = 0; x < m.width; x += 1) {
      const key = keys[y * m.width + x];
      if (!key) { row += "."; continue; }
      if (!letters.has(key)) letters.set(key, LETTERS[letters.size] ?? "?");
      row += letters.get(key);
    }
    rows.push(row);
  }
  return { rows, legend: [...letters].map(([key, c]) => `\`${c}\` = "${nameOf(set, key)}"`) };
}

/** 게시 장소 하나를 조수가 읽을 수 있는 예시 문서로: 1층·2층 글자 배열 + 물체 좌표. */
export function exampleDoc(set: LoadedSet, spec: MapSpec, m: Converted, placeId: string): string {
  const l1 = grid(set, m, m.keys1), l2 = grid(set, m, m.keys2);
  const objects = m.objects.map((o) => {
    const def = set.presetJson.objects.find((p) => p.id === o.id);
    return `- \`${o.id}\` at (${o.x},${o.y})${def ? ` — ${def.name} ${def.w}×${def.h}` : ""}`;
  });
  const tiles = spec.ops.filter((op): op is Extract<MapSpec["ops"][number], { tile: unknown }> => "tile" in op)
    .map((op) => `- 낱장 칸 \`paint_tiles\` 층 ${op.layer ?? 3} (${op.at[0]},${op.at[1]}) ← 칸 ${set.flatTile(op.tile.sheet, op.tile.x, op.tile.y)}${op.pass ? " (지나가는 무늬)" : ""}`);
  return [
    `# 예시: ${spec.name} ${spec.w}×${spec.h}`,
    `완성 장소 \`reviewed:${placeId}\` 와 같은 맵이다. ${spec.note}`,
    "짜임(천장 테 · 벽면 2줄 · ㄱ자 방 · 입구 · 가구 자리)을 보라. **통째로 베끼지 말 것** — 요청의 이야기에 맞게 방 모양과 가구 자리를 새로 정한다. 그대로 필요하면 import_region_reference 로 가져온다.",
    "",
    "## 1층 (paint_pack_layout layer1) — 글자 한 칸 = 재료",
    "```",
    ...l1.rows,
    "```",
    l1.legend.join(" · "),
    ...(l2.legend.length ? ["", "## 2층 겹침 (paint_pack_layout layer2, `.` = 없음)", "```", ...l2.rows, "```", l2.legend.join(" · ")] : []),
    "",
    `## 물체 ${objects.length}개 (paint_pack_layout objects 또는 stamp_tileset_object, at = 왼쪽 위 칸)`,
    ...objects,
    ...tiles,
  ].join("\n");
}

export function exampleImage(set: LoadedSet, m: Converted): string {
  const img = render(set, m);
  return encodePng(Math.max(img.width, img.height) > 1100 ? shrink(img, 1100) : img);
}

/** 이 세트의 완성 장소 목록 — 가져오기 id·크기·이야기. */
export function placesDoc(entries: readonly { placeId: string; spec: MapSpec }[]): string {
  return [
    "# 장소 목록 — 이 세트의 완성 장소",
    "요청이 아래 장소와 **같은 이야기일 때만** `import_region_reference id:\"reviewed:<id>\"` 로 가져온다(mapId 를 주면 그 맵에 붙인다). 다른 이야기면 짜임만 참고하고 새로 깐다. 모두 check_pack_map 경고 0.",
    "",
    "| id | 이름 | 크기 | 이야기 |",
    "|---|---|---|---|",
    ...entries.map(({ placeId, spec }) => `| \`${placeId}\` | ${spec.name} | ${spec.w}×${spec.h} | ${spec.note.replace(/\|/g, "/")} |`),
  ].join("\n");
}
