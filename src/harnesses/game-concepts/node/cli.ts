// npm run harness -- game-concepts <단계> [옵션]. 단계 설명은 openwiki/harnesses/game-concepts.md.
const STAGES = ["produce", "draw", "check", "serve", "status", "publish", "bundle"] as const;

export async function run(argv: string[]): Promise<number> {
  const [stage, ...rest] = argv;
  switch (stage) {
    case "produce": return (await import("./produce")).produce(rest);
    case "draw": return (await import("./draw")).draw(rest);
    case "check": return (await import("./check")).check(rest);
    case "serve": return (await import("./serve")).serve(rest);
    case "status": return (await import("./status")).status(rest);
    case "publish": return (await import("./publish")).publish(rest);
    case "bundle": return (await import("./bundle")).bundle(rest);
    default: throw new Error(`단계: ${STAGES.join(" | ")}`);
  }
}
