// 세계표 밖 주제(조선·일본 도시·마법 학교·현대 한국)의 바깥 맵 세 장 사슬을 모델 없이 짓는다 — 장소 명세를 make_game 동사에 그대로 준다.
// worldProbe 가 세계표(WORLDS)의 열 세계를 짓는 것과 짝이다. 지은 프로젝트(project.json)와 맵 PNG 를 남긴다 — 출구·길 재기는 exitProbe.mts 로.
//   bun scripts/qa/assistant-v2/themeChainProbe.mts <outDir> [joseon|jp_city|wizarding|modern_kr …]
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createV2Tools } from "../../../src/ai/v2/tools/verbs.ts";
import { V2Session } from "../../../src/ai/v2/turn/session.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/shared/env.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

const out = process.argv[2] ?? "qa-runs/v2scratch/themes";
const only = process.argv.slice(3);
process.env.OPRN_V2_MAKE_GAME = "1";

const THEMES: Record<string, { task: string; places: readonly string[]; spec: Record<string, string> }> = {
  joseon: { task: "조선 시대 사극 게임 하나 만들어 줘.", places: ["한양 저잣거리", "나루터 마을", "산골 마을"], spec: { type: "village", style: "joseon" } },
  jp_city: { task: "일본 도시를 배경으로 한 게임 하나 만들어 줘.", places: ["역 앞 상점가", "주택가 골목", "신사 앞 거리"], spec: { type: "street", style: "jp-city" } },
  wizarding: { task: "마법 학교 게임 하나 만들어 줘.", places: ["마법 학교 마을", "학교 정문 앞 거리", "호숫가 마을"], spec: { type: "village", style: "wizarding" } },
  modern_kr: { task: "현대 한국 도시를 배경으로 한 게임 하나 만들어 줘.", places: ["번화가 거리", "주택가 골목", "시장 거리"], spec: { type: "street", style: "kr-modern" } },
};
// 단계 종류를 섞는다 — 청사진 관문(사람 둘·싸움·퍼즐)을 지나야 make_game 이 열린다.
const KINDS: readonly { kind: string; who?: string }[] = [{ kind: "talk", who: "촌장 하르" }, { kind: "find" }, { kind: "choice", who: "떠돌이 상인 미라" }, { kind: "puzzle" }, { kind: "battle", who: "문지기 그림자" }, { kind: "find" }];
// 둘째 장소는 첫 장소의 동쪽, 셋째는 둘째의 남쪽으로 잇는다.
const SIDES = ["east", "south"] as const;

for (const [id, theme] of Object.entries(THEMES)) {
  if (only.length && !only.includes(id)) continue;
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const session = new V2Session();
  const env: PiAssistantV2Env = {
    ctx, request: { task: theme.task, provider: "local-cli:claude", mapIds: [], project, projectKey: `["project","probe-${id}"]` } as never,
    emit: () => {}, record: () => {},
    sideChat: async () => JSON.stringify({ imagesSeen: 0, axes: {}, score: 7, majors: [] }),
    render: async () => "", checkpoint: async () => {},
  };
  const tools = createV2Tools(env, session);
  const call = async (name: string, args: unknown): Promise<Record<string, unknown>> => {
    const tool = tools.find((t) => t.name === name);
    if (!tool) return { ok: false, summary: `no tool ${name}` };
    const res = await tool.execute(`c-${name}`, args);
    const text = (res.content as { type: string; text?: string }[]).find((c) => c.type === "text")?.text ?? "{}";
    try { return JSON.parse(text) as Record<string, unknown>; } catch { return { ok: false, summary: text.slice(0, 300) }; }
  };
  const stepPlaces = [0, 0, 1, 1, 2, 2].map((k) => theme.places[k]!);
  const steps = stepPlaces.map((place, i) => {
    const kind = KINDS[i]!;
    return {
      id: `s${i + 1}`, ...kind, place,
      event: kind.who ?? (kind.kind === "puzzle" ? `${place}의 번호 자물쇠` : `${place}의 단서 ${i + 1}`),
      action: `${place}에서 ${kind.kind === "battle" ? "문지기와 싸워 이긴다" : kind.kind === "puzzle" ? "번호를 맞춘다" : "단서를 찾는다"}`,
      ...(i ? { needs: `단서 ${i}` } : {}), gives: i === 5 ? "엔딩" : `단서 ${i + 1}`, feeling: "호기심",
    };
  });
  const bp = await call("write_blueprint", { title: `${id} 시험`, genre: "모험", playerGoal: "단서를 따라 마지막 장소까지 가자.", places: theme.places.map((name) => ({ name })), steps, ending: { name: "끝", how: "마지막 단서를 찾았다.", feeling: "안도" } });
  const made = await call("make_game", { game: { title: `${id} 시험`, places: theme.places.map((name, i) => ({ key: `p${i}`, spec: { name, ...theme.spec }, ...(i ? { from: `p${i - 1}`, side: SIDES[i - 1] } : {}) })) } });
  console.log(`\n== ${id} blueprint=${bp.ok} make_game=${made.ok}${bp.ok ? "" : ` ${String(bp.summary).slice(0, 300)}`}${made.ok ? "" : ` ${String(made.summary).slice(0, 300)}`}`);
  for (const line of [...((made.places as string[] | undefined) ?? []), ...((made.links as string[] | undefined) ?? []), ...((made.path as string[] | undefined) ?? [])]) console.log(`   · ${line.slice(0, 220)}`);
  const dir = path.join(out, id);
  fs.mkdirSync(dir, { recursive: true });
  const built = theme.places.map((name) => Object.values(ctx.project.maps).find((m) => m.name === name)).filter((m): m is NonNullable<typeof m> => !!m);
  built.forEach((m, i) => fs.writeFileSync(path.join(dir, `${String(i + 1).padStart(2, "0")}-place.png`), renderMapPng(ctx.project, m).png));
  fs.writeFileSync(path.join(dir, "project.json"), JSON.stringify(ctx.project));
}
