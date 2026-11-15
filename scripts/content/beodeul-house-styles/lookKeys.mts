// 게임 열쇠마다 고르는 겉모습을 찍는다 — 집 양식 갈래(houseStyle)를 더해도 앞 갈래들의 고르기가 그대로인지 전/후로 본다.
//   bun scripts/content/beodeul-house-styles/lookKeys.mts [저장소 뿌리(기본 이 체크아웃)] [--keys a,b,c] [--count N]
// 다른 체크아웃(기준 커밋)의 뿌리를 주면 그 코드로 고른다(읽기만 한다). --count N 은 열쇠 N개에서 집 양식이 갈린 몫을 센다.
import path from "node:path";
const args = process.argv.slice(2);
const root = path.resolve(args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--keys" && args[args.indexOf(a) - 1] !== "--count") ?? path.join(import.meta.dir, "../../.."));
const opt = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const keys = (opt("keys") ?? "game-a,game-b,game-c,game-d,game-e,game-f").split(",");
const { chooseTilesetLook } = await import(path.join(root, "src/project/tilesetLook.ts"));
const { tilesetLookTableFor, TILESET_LOOK_PARTS } = await import(path.join(root, "src/assets/tilesetLooks.ts"));
const table = tilesetLookTableFor("beodeul_city")!;
console.log(`갈래: ${(TILESET_LOOK_PARTS as readonly string[]).join(" · ")}`);
for (const key of keys) {
  const look = chooseTilesetLook(table, key) ?? {};
  console.log(`${key}: ${(TILESET_LOOK_PARTS as readonly string[]).map((part) => `${part}=${(look as Record<string, string>)[part] || "-"}`).join(" ")}`);
}
const count = Number(opt("count") ?? 0);
if (count) {
  const tally = new Map<string, number>();
  for (let i = 0; i < count; i += 1) {
    const look = (chooseTilesetLook(table, `tally-${i}`) ?? {}) as Record<string, string>;
    const name = look.houseStyle ? `양식 ${look.houseStyle}` : look.houses ? `벌 ${look.houses}` : "원래 가족";
    tally.set(name, (tally.get(name) ?? 0) + 1);
  }
  console.log(`열쇠 ${count}개의 집 모습: ${[...tally].sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name} ${(100 * n / count).toFixed(1)}%`).join(" · ")}`);
}
