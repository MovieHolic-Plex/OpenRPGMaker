// People 전투 시트(public/assets/generated/charset-battlers/people<N>-<i>.png)가 있는 칩만 src/assets/charsetBattlerReady.ts 에 적는다.
// 시트가 머지될 때마다 한 번 돌린다: node scripts/content/sync-charset-battler-ready.mjs [--dry]
import { readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = new URL("../../public/assets/generated/charset-battlers/", import.meta.url);
const ids = readdirSync(dir)
  .map((name) => /^(people[1-5]-[0-7])\.png$/.exec(name)?.[1])
  .filter(Boolean)
  .sort()
  .map((chip) => `charset-battler-${chip}`);
const body = `// 생성 파일 — \`node scripts/content/sync-charset-battler-ready.mjs\` 가 public/assets/generated/charset-battlers/people*-*.png 를 훑어 다시 쓴다.
// People 전투 시트(48px 셀 24포즈)는 아트 묶음이 나눠 만든다. 파일이 있는 것만 여기 올라 전투 시트 카탈로그에 등록된다.
export const READY_PEOPLE_BATTLERS: ReadonlySet<string> = new Set<string>([
${ids.map((id) => `  "${id}",`).join("\n")}${ids.length ? "\n" : ""}]);
`;
if (process.argv.includes("--dry")) console.log(body);
else {
  writeFileSync(fileURLToPath(new URL("../../src/assets/charsetBattlerReady.ts", import.meta.url)), body);
  console.log(`people 전투 시트 ${ids.length}개 등록`);
}
