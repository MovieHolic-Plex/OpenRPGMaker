// npm run qa:game -- <gen|check|replay|render> ...  — 하위 명령을 해당 스크립트로 넘긴다.
import { checkMain } from "./check.mts";

const [command, ...rest] = process.argv.slice(2);
const COMMANDS: Record<string, () => Promise<number> | number> = {
  gen: async () => (await import("./gen.mts")).genMain(rest),
  check: () => checkMain(rest),
  replay: async () => (await import("./replay.mts")).replayMain(rest),
  render: async () => (await import("./render.mts")).renderMain(rest),
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
