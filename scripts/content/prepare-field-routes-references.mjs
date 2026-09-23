// Bundle-owned guidance for tiledata/field-routes → src/assets/sharedFieldRouteReferences.json. No project/host writes.
// One category per tileset a field is drawn on (the AI reads guidance from the tileset in use); docs are also copied as tiledata/field-routes/*.md.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const dir = "tiledata/field-routes", target = "src/assets/sharedFieldRouteReferences.json", preview = "public/assets/field-route-references";
const c = JSON.parse(fs.readFileSync(dir + "/catalog.json")), validation = JSON.parse(fs.readFileSync(dir + "/validation.json"));
const village = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json"));
const data = JSON.parse(fs.readFileSync("src/assets/climateVillageTilesets.json"));
const block = (o) => "```json\n" + JSON.stringify(o) + "\n```\n";
const rows = (a, w) => "```text\n" + Array.from({ length: a.length / w }, (_, y) => a.slice(y * w, (y + 1) * w).join(" ")).join("\n") + "\n```\n";
const CLIMATE = { forest_harmony_snow: "설원", forest_harmony_volcano: "화산", forest_harmony_desert: "사막", forest_harmony_autumn: "가을" };
const CATEGORY = {
  forest_harmony: { id: "field-routes-forest-v2", name: "마을 사이 필드 · 숲길·벼랑길·고갯길 (나무 몸통 개정2)", description: "집 없이 맵 가장자리에서 가장자리로 길이 이어지는 마을 사이 필드 세 곳. 출구 규칙(어느 마을 입구와 맞닿는지), 절벽·계단·여울·다리·숲 조립, 전체 배열과 통행 검사" },
  ...Object.fromEntries(Object.entries(CLIMATE).map(([ts, name]) => [ts, {
    id: `field-routes-${ts.replace("forest_harmony_", "")}-v2`, name: `${name} 마을 사이 필드 (나무 몸통 개정2)`,
    description: `숲마을 필드를 ${name} 시트로 옮긴 필드. 칸 번호는 숲마을과 같고 기후 편집만 더했다. 출구가 맞닿는 ${name} 마을, 전체 배열과 통행 검사`,
  }])),
};
const docs = Object.fromEntries(Object.keys(CATEGORY).map((k) => [k, []]));
const doc = (tilesetId, id, name, markdown) => {
  fs.writeFileSync(`${dir}/${id}.md`, markdown.replaceAll(/\(image:([^)]+)\)/g, "(images/$1.png)").trimEnd() + "\n");
  docs[tilesetId].push({ id, name, markdown });
};
const plansOn = (ts) => c.plans.filter((p) => p.tilesetId === ts);
const reach = (ts) => block(validation.filter((r) => plansOn(ts).some((p) => p.id === r.id)));
const exitsOf = (p) => p.exits.map((e, n) => `출구${n} ${e.side} (${e.x},${e.y}) → ${e.meets}`).join("; ");
const list = (ts) => plansOn(ts).map((p) => `- ${p.name} (${p.id}, ${p.width}×${p.height}${p.from ? `, 원본 숲마을 필드 ${p.from}` : ""}): ${p.note}. ${exitsOf(p)}.`).join("\n");
const check = "```bash\nnode scripts/content/author-field-routes.mjs   # 숲 필드 + 기후 필드, 통행 검사(실패하면 멈춤)\n```\n";
const b = village.cliffBindings, r = village.riverTiles;

const rules = `## 필드를 짜는 법 — 집 없는 숲마을
필드는 숲마을과 **같은 부품**으로 짠다. 집이 없고, 길이 맵 가장자리에서 가장자리로 이어진다. 지형만 있고 이벤트(문 이동·NPC)는 없다.
- **출구**: 맵 가장자리의 흙길 입구. 폭 3칸, 안쪽으로 5칸. 출구마다 어느 마을 입구와 맞닿는지(meets)를 적는다. 숲마을은 대개 남쪽 가장자리 x=40(80칸 폭)에 입구가 있으므로, 필드 북쪽 출구를 x=40에 두면 이어 붙였을 때 길이 곧게 이어진다.
- **길**: 흙길 오토타일 forest_harmony_road_47. 가운데 줄을 경로로 찾은 뒤 동·남쪽으로 한 칸 넓혀 두 칸 길로 칠한다. 갈림길에는 나무 이정표(596, 위층)를 길 옆에 둔다.
- **절벽**: 숲마을 절벽 열 문법(윗선 → 반복 면 → 밑단, 왼쪽 ${b[18]}→${b[231]}→${b[48]}, 정면 ${b[139]}→${b[172]}→${b[202]}, 오른쪽 ${b[19]}→${b[232]}→${b[49]}, 위층). 절벽의 **양 끝은 숲에 묻힌다** — 끝 옆 네 칸(가장자리가 여섯 칸 안이면 가장자리까지)은 반드시 숲. 그래야 계단으로만 오른다.
- **계단**: 돌계단 ${b[374]}(아래층, 같은 칸 위층 비움), 폭 2, 절벽 면 전체 높이.
- **여울·폭포**: 폭 4 붓으로 물(호수 오토타일)을 칠하고, 절벽을 넘는 열은 윗선 칸이 물·면 칸이 폭포 ${r.fall}. 폭포 아래 아랫단에 소(둥근 물)를 둔다. 맵 끝으로 나가는 물은 가장자리에 물가를 만들지 않는다.
- **다리**: 강이 곧게 흐르는 두 줄에 나무다리 윗줄 ${r.bridgeTop}·아랫줄 ${r.bridgeBottom}(아래층)을 강폭만큼. 다리 두 끝은 마른 땅이어야 한다.
- **동굴**: 절벽 면 한 칸에 동굴 입구 ${b[413]}(위층). 그 열 밑단 아래 칸까지 길을 낸다.
- **숲**: 숲 윤곽(forest_harmony_grove_47 수관 + 줄기 조립). 가장자리 숲에 덧붙인 숲 덩이(patches)와 빈터(clearings), 풀밭 한가운데의 숲섬(groves). 줄기 수리가 얇은 숲 가장자리를 깎으면 절벽 끝이 뚫리므로, 검사가 실패하면 숲 무늬 씨앗(seed)만 하나 올려 다시 칠한다(검사표의 forestSeed). 줄기는 수관 밑변과 **정확히 같은 폭**으로 놓는다(폭 2 이상 모든 폭에 조립이 있다; 규칙은 숲마을 문서 forest-assembly). 밑변보다 넓게 옆 수관 밑으로 밀어 넣거나 옛 4칸 마감을 쓰면 몸통이 반쯤 잘려 보인다. 폭 1 밑변은 이웃 열 높이로 한 칸 옮긴다.
- **숲 안 구멍**: 수관 안에 갇힌 40칸 미만의 풀밭은 수관으로 메운다(같은 오토타일로 다시 칠함).
- **나무·장식**: 숲마을 나무 도장 셋(활엽수 3×4, 둥근 덤불 3×3, 작은 덤불 2×2)을 풀밭에, 둘레 한 칸과 서로 다섯 칸을 띄워. 한 칸 장식(회백색 바위 537, 돌 무더기 29, 꽃 관목 768, 위층)은 둘레 한 칸을 비워.
- **검사**: 첫 출구에서 런타임 이동 규칙(canMove)으로 모든 출구·계단 양 끝·다리 양 끝·동굴 앞에 닿아야 하고, 계단을 모두 막으면 아랫단에서 윗단으로 못 올라가야 한다.
`;

doc("forest_harmony", "field-guide", "필드 규칙 · 출구·길·절벽·여울·숲", `# 마을 사이 필드 — 숲마을 부품으로 짠 길

tilesetId=forest_harmony. 좌표는 0기준, 16px.

**번호 주의**: 이 필드는 숲마을 「다양한 마을」 타일셋(forest_harmony + 이식 2550~2729, 2730칸)으로 그렸다. 수관(2550~2596)·절벽(2670~2694)·폭포·다리(2700~2702)는 이식 번호라서, 이식이 없는 번들 forest_harmony(2550칸)에는 없다. 「장소」 내려받기 파일에 이식까지 든 타일셋이 함께 들어 있다. 다른 프로젝트에 옮길 때는 사용 타일 사전과 전체 배열을 함께 다시 매핑한다. 이식 없이 같은 번호를 그대로 쓰려면 기후 시트(설원·화산·사막·가을)를 쓴다 — 이식이 구워져 있다.

${rules}
## 검사
${check}
${reach("forest_harmony")}
## 실제 구분
${list("forest_harmony")}
`);

for (const [ts, name] of Object.entries(CLIMATE)) {
  const climate = Object.values(data.climates).find((x) => x.id === ts);
  doc(ts, `field-guide-${ts.replace("forest_harmony_", "")}`, `${name} 필드 규칙 · 숲 필드를 ${name} 시트로`, `# ${name} 마을 사이 필드

tilesetId=${ts}, 시트 ${climate.textureKey}(30열·16px, ${climate.count}칸). 좌표는 0기준.

숲마을 필드(tilesetId=forest_harmony)의 두 레이어를 **그대로** 이 타일셋으로 옮긴 뒤 기후 편집만 더했다. 기후 시트는 숲마을 이식을 한 장에 구워 칸 번호가 같으므로, 숲 필드 문서(field-routes-forest-v2)의 부품 번호를 이식 없이 그대로 쓴다. 기후 시트 자체의 규칙(무엇이 칠해졌나, 얼음·용암·야자·선인장)은 같은 타일셋의 「${name} 마을」 분류 문서에 있다.

${rules}
## 검사
${check}
${reach(ts)}
## 실제 구분
${list(ts)}
`);
}

for (const p of c.plans) {
  const m = c.maps[p.id];
  const props = p.placements.filter((o) => o.kind !== "vegetation").map(({ name, kind, x, y, w, h, upper }) => ({ name, kind, x, y, w, h, upper }));
  const trees = p.placements.filter((o) => o.kind === "vegetation").map(({ name, x, y, w, h }) => ({ name, x, y, w, h }));
  doc(p.tilesetId, p.id, p.name + " · 출구와 지형", `# ${p.name}

${p.note}. ${m.width}×${m.height}, tilesetId=${p.tilesetId}${p.from ? `, 원본 숲마을 필드 ${p.from}` : ""}. 통행 검사 시작 (${p.entry.join(",")}).

![${p.name}](image:${p.id})

## 출구 — 어느 마을로 이어지나
${block(p.exits)}
## 지형
${block({ cliffs: p.cliffs, stairs: p.stairs, river: p.river ?? null, bridges: p.bridges, falls: p.falls.length ? { columns: p.falls.map((f) => f.x), rimY: p.falls[0].y, tile: p.falls[0].tile } : null, ponds: p.ponds, cave: p.cave ?? null, groves: p.groves ?? [] })}
${p.edits ? "## 기후 편집 (숲 필드 위에 한 것)\n" + block(p.edits) : ""}## 소품과 장식
${block(props)}
## 나무 도장
${block(trees)}
전체 두 레이어는 다음 배열 문서가 정답이다.
`);
  for (let y = 0; y < m.height; y += 16) {
    doc(p.tilesetId, `${p.id}-rows-${y}`, `${p.name} · ${y}행부터 전체 배열`, `# ${p.name} 전체 배열 y=${y}..${Math.min(y + 15, m.height - 1)}

폭 ${m.width}, x=0..${m.width - 1}, -1은 빈 칸. mapId=${m.id}, tilesetId=${p.tilesetId}, 16px.

## lowerTiles
${rows(m.lowerTiles.slice(y * m.width, Math.min(y + 16, m.height) * m.width), m.width)}
## upperTiles
${rows(m.upperTiles.slice(y * m.width, Math.min(y + 16, m.height) * m.width), m.width)}
`);
  }
}

// Used tiles with their meaning, per tileset — so a number is never guessed from a picture.
for (const [ts, k] of Object.entries(CATEGORY)) {
  const climate = Object.values(data.climates).find((x) => x.id === ts);
  const meta = (t) => climate ? climate.metaPatch[t] ?? data.base.tileMeta[t] ?? climate.append.tileMeta[t - data.base.tileMeta.length] : village.tileset.tileMeta[t];
  const pass = (t) => climate ? data.base.passability[t] ?? climate.append.passability[t - data.base.passability.length] : village.tileset.passability[t];
  const used = [...new Set(plansOn(ts).flatMap((p) => [...c.maps[p.id].lowerTiles, ...c.maps[p.id].upperTiles]).filter((n) => n >= 0))].sort((a, b) => a - b);
  const entries = used.map((tile) => ({ tile, label: meta(tile)?.label ?? "", passability: pass(tile) }));
  for (let i = 0; i < entries.length; i += 150) doc(ts, `${k.id}-dictionary-${i / 150 + 1}`, `사용 타일 사전 ${i / 150 + 1}`, `# 사용 타일 사전\n\n${ts}에서 이 분류의 필드가 쓰는 번호·라벨·통행.\n` + block(entries.slice(i, i + 150)));
}

fs.mkdirSync(preview, { recursive: true });
const images = Object.fromEntries(Object.keys(CATEGORY).map((k) => [k, []]));
for (const p of c.plans) {
  const file = `${preview}/${p.id}.png`;
  execFileSync("convert", [`${dir}/images/${p.id}.png`, "-strip", "-filter", "point", "-resize", "820x820>", "-colors", "128", "-define", "png:compression-level=9", file]);
  images[p.tilesetId].push({ id: p.id, name: p.id + ".png", caption: "실제 타일 완성 지도 · 열람용 축소본", dataUrl: "data:image/png;base64," + fs.readFileSync(file).toString("base64") });
}
const out = Object.fromEntries(Object.entries(CATEGORY).map(([ts, k]) => [ts, { ...k, documents: docs[ts], images: images[ts] }]));
for (const k of Object.values(out)) if (k.documents.length > 64 || k.documents.some((d) => d.markdown.length > 12e4)) throw Error("Reference page limit " + k.id);
fs.writeFileSync(target, JSON.stringify(out) + "\n");
console.log(Object.values(out).map((k) => ({ id: k.id, documents: k.documents.length, images: k.images.length })), fs.statSync(target).size);
