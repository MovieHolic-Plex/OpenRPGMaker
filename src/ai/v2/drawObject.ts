// 조수 v2 — 없는 기물 그리기 요청 빌더.
//
// v1 generate_missing_object 는 «그리지 않는다». 그림 요청(ObjectGenRequest)만 돌려주고, 실제 그림은 브라우저의
// 공방 카드가 사용자 AI 계정으로 나중에 그린다(수 분, 후보 1~3장, 사용자가 고르거나 「알아서 고르기」). 그래서 이 빌더도
// 성공을 꾸미지 않는다: «카드를 띄웠다 / 기물은 아직 안 놓였다» 를 summary 와 missingArt 에 그대로 적는다.
import { findMap, resolveWhere } from "./people";
import type { BuildRun, ContentBuildResult, ObjectSpec } from "./types";

export const DRAW_OBJECT_CARD =
  "없는 기물(draw_object) 명세: {what,description?,where?,at?,mapId?}. what=기물 이름 한 명사구(놋쇠 태엽 지구본·나무 벌통). " +
  "description=모양·재료·색 한두 문장(없으면 what 으로 채운다). 사람·동물·지형(바닥·벽·물·길)·건물은 그리지 않는다(거부) — " +
  "건물은 집 킷, 사람은 people 로. 이미 칩셋에 이름 맞는 기물이 있으면 새로 그리지 않고 그 id 를 돌려준다. " +
  "where 는 people 과 같은 낱말(입구·광장·문 앞), at:{x,y} 는 정말 필요할 때만. " +
  "놓는 방식은 이름으로 정한다: 액자·간판·포스터는 벽걸이, 러그·카펫·바닥 무늬는 바닥 무늬, 책장·선반·장식장은 벽 앞 가구, 나머지는 바닥에 세움. " +
  "중요: 이 명세는 «그리기 카드» 를 띄울 뿐이다. 그림은 사용자 화면에서 몇 분 뒤 그려지고 그 뒤에야 놓인다 — 지금 맵에는 아직 없다.";

type ObjectKind = "floor" | "wall" | "hang" | "flat";

export function inferObjectKind(what: string, description = ""): ObjectKind {
  const t = `${what} ${description}`.toLowerCase();
  if (/액자|간판|포스터|현판|거울|걸개|족자|깃발|시계|frame|sign|poster|banner|mirror|clock/.test(what.toLowerCase())) return "hang";
  if (/러그|카펫|양탄자|깔개|바닥 ?무늬|매트|rug|carpet|mat\b/.test(t)) return "flat";
  if (/책장|선반|장식장|찬장|서랍장|벽난로|옷장|bookshelf|shelf|cabinet|wardrobe|dresser|fireplace/.test(what.toLowerCase())) return "wall";
  return "floor";
}

export function drawObject(run: BuildRun, spec: ObjectSpec): ContentBuildResult {
  const warnings: string[] = [];
  const firstCall = run.calls.length;
  const what = (spec.what ?? "").trim();
  const mapId = spec.mapId ?? run.ctx.currentMapId ?? run.ctx.project.startMapId;
  const fail = (summary: string): ContentBuildResult => ({
    ok: false, mapIds: [], summary, warnings, missingArt: [], calls: run.calls.slice(firstCall),
  });

  if (!what) return fail("기물 이름(what)이 비었다.");
  const map = findMap(run.ctx.project, mapId);
  if (!map) return fail(`맵 '${mapId}' 이 없다.`);

  const description = (spec.description ?? "").trim() || what;
  if (!spec.description) warnings.push(`description 이 없어 이름 「${what}」 으로 채웠다 — 그림 품질을 위해 모양·재료를 적는 편이 낫다.`);
  const objectKind = inferObjectKind(what, description);

  const args: Record<string, unknown> = {
    mapId, title: what, description, objectKind,
    need: `${what} 을(를) 맵에 놓고 싶다${spec.where ? ` (${spec.where})` : ""}`,
  };
  const wantsSpot = !!(spec.where || spec.at);
  if (wantsSpot) {
    const w = resolveWhere(run.ctx.project, map, spec.where, { at: spec.at });
    if (w.note) warnings.push(`${what}: ${w.note}`);
    args.base = { x: w.cell.x, y: w.cell.y };
  }

  let res = run.call("generate_missing_object", args);
  // 자리가 맵 밖으로 넘치면 자리 없이 다시 — 카드는 띄우되 놓을 자리는 후속 턴이 정한다.
  if (!res.ok && args.base && /벗어난다|out-of-bounds/.test(String(res.summary))) {
    warnings.push(`${what}: 정한 자리에서 기물이 맵 밖으로 넘쳐 자리 없이 요청했다(놓을 자리는 그림이 끝난 뒤 정한다).`);
    delete args.base;
    res = run.call("generate_missing_object", args);
  }
  for (const w of res.warnings ?? []) warnings.push(`${what}: ${w}`);

  if (!res.ok) {
    const exists = /이미 있다/.test(String(res.summary));
    return {
      ok: false, mapIds: [mapId], warnings, missingArt: [],
      summary: exists
        ? `새로 그리지 않았다 — 이름이 맞는 기물이 이미 칩셋에 있다: ${String(res.summary).slice(0, 240)}`
        : `그리기 요청 거부: ${String(res.summary).slice(0, 240)}`,
      calls: run.calls.slice(firstCall),
    };
  }

  const req = (res.data ?? {}) as { tilesW?: number; tilesH?: number; harnessId?: string; tilesetId?: string; base?: { x: number; y: number } | null };
  const size = req.tilesW && req.tilesH ? `${req.tilesW}×${req.tilesH}칸` : "크기는 카드에서 확정";
  const spot = req.base ? `(${req.base.x},${req.base.y})` : "자리 미정";
  return {
    ok: true,
    mapIds: [mapId],
    summary:
      `「${what}」 그리기 카드를 대기열에 올렸다(${objectKind}, ${size}, 놓을 자리 ${spot}, 칩셋 ${req.tilesetId ?? map.tilesetId}). ` +
      `아직 그려지지 않았고 맵에도 놓이지 않았다 — 사용자 화면의 공방 카드가 그린 뒤(수 분) 후속 턴이 놓는다.`,
    warnings,
    missingArt: [`${what} (카드 대기: 그림 완성·선택 전, 맵에 없음)`],
    calls: run.calls.slice(firstCall),
  };
}
