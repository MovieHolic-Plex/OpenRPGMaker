// 감사 프로브: 연애 인터뷰(캠퍼스) 씨앗이 어떤 칩셋·맵으로 시작하는지 모델 없이 잰다.
import { readFileSync, writeFileSync } from "node:fs";
import { buildBrowserSeed } from "../../qa-game/lib/seed.ts";
import { serialize } from "../../../src/project/io.ts";
import { preloadKitStartPlaces } from "../../../src/project/playableSegment.ts";
const briefFile = process.argv[2]; const out = process.argv[3];
await preloadKitStartPlaces();
const input = JSON.parse(readFileSync(briefFile, "utf8"));
const { project } = buildBrowserSeed(input);
const maps = Object.values((project as any).maps ?? {}) as any[];
const list = Array.isArray((project as any).maps) ? (project as any).maps : maps;
console.log(JSON.stringify({
  preset: project.gameDesignBrief?.presetId, genreLock: (project as any).genreLock ?? (project.system as any)?.genreLock ?? null,
  startMapId: project.startMapId,
  maps: list.map((m: any) => ({ id: m.id, name: m.name, w: m.width, h: m.height, tileset: m.tilesetId, events: m.events?.length })),
  tilesets: Object.keys((project as any).tilesets ?? {}).slice(0, 40),
  opening: !!project.system.opening, title: project.system.titleScreen?.backgroundResourceId,
}, null, 1));
writeFileSync(out, serialize(project));
