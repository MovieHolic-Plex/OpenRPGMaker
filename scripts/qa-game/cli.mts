// npm run qa:game -- <gen|check|replay|render|toollist> ...  — 하위 명령을 해당 스크립트로 넘긴다.
import { checkMain } from "./check.mts";

const [command, ...rest] = process.argv.slice(2);
const COMMANDS: Record<string, () => Promise<number> | number> = {
  gen: async () => (await import("./gen.mts")).genMain(rest),
  check: () => checkMain(rest),
  replay: async () => (await import("./replay.mts")).replayMain(rest),
  render: async () => (await import("./render.mts")).renderMain(rest),
  // 모델 없이 첫 요청의 도구 목록·프롬프트의 몬스터 도구 수를 센다(몬스터 자산 역방향 잠금 증거, toollist.mts).
  toollist: async () => (await import("./toollist.mts")).toollistMain(rest),
};

async function main(): Promise<number> {
  const run = command ? COMMANDS[command] : undefined;
  if (!run) {
    console.error(`사용법: npm run qa:game -- <${Object.keys(COMMANDS).join("|")}> ...  (scripts/qa-game/README.md)`);
    return 2;
  }
  return run();
}

process.exit(await main());
