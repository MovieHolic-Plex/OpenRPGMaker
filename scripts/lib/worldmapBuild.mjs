// 월드맵 키트(tiledata/worldmap-kit, Python) 를 돌려 세계 지도 한 장을 만든다 — 조수의 지형 편집 도구가 쓴다.
// 호스트 쪽(동반 서비스 /v1/worldmap/build, Pi 워커)에서만 돈다. 브라우저는 동반 서비스 경로로 부른다.
//
// 입력 { theme, terrain?: worldmap-terrain/1 객체({base?, ops, fit_salt?}), preview?: boolean }
// 출력 { ok, preview, imageDataUrl, world:{...칸 배열·장소·길·walk}, ascii, journeyCheck:{ok,bad}, warnings, seconds }
//      실패 { ok:false, error } — error 는 키트의 「입력 오류/지형 오류/길을 낼 수 없다」 문장 그대로(조수가 읽고 고친다)
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// 키트 경로는 쓸 때만 계산한다. Electron 메인(CJS 번들)에서는 import.meta.url 이 비어 fileURLToPath 가 던진다 —
// 모듈 로드 때 평가하면 앱이 켜지지도 않는다(2026-10-04 실측: v0.108.0 윈도우 앱 시작 실패).
const kitDir = () => process.env.OPRN_WORLDMAP_KIT || join(resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."), "tiledata", "worldmap-kit");
const CACHE = process.env.OPRN_WORLDMAP_CACHE || join(homedir(), ".cache", "oprn", "worldmap-kit");
const THEME_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
/** 전체 렌더는 지형이 바뀌면 100초 남짓 걸린다(캐시가 맞으면 몇 초). */
const TIMEOUT_MS = 6 * 60 * 1000;

function run(args, timeoutMs) {
  return new Promise((resolvePromise) => {
    let child;
    try {
      child = spawn(process.env.OPRN_PYTHON || "python3", args, { cwd: kitDir(), stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      resolvePromise({ code: -1, signal: null, stdout: "", stderr: String(error) });
      return;
    }
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("close", (code, signal) => { clearTimeout(timer); resolvePromise({ code, signal, stdout, stderr }); });
    child.on("error", (error) => { clearTimeout(timer); resolvePromise({ code: -1, signal: null, stdout, stderr: String(error) }); });
  });
}

/** 테마가 지형을 어떻게 칠하는지 한 줄 — 글자 지도는 바닥 종류라서, 지역 팔레트(desert-east 등)가 정글을 모래빛으로 칠하면 조수가 오해했다. */
async function themeNote(theme) {
  try {
    const t = JSON.parse(await readFile(join(kitDir(), "themes", `${theme}.json`), "utf8"));
    const p = t.palette ? JSON.parse(await readFile(join(kitDir(), "palettes", `${t.palette}.json`), "utf8")) : null;
    const tt = t.terrain ? JSON.parse(await readFile(join(kitDir(), "terrains", `${t.terrain}.json`), "utf8")) : null;
    const head = tt?.base === "generate"
      ? `${t.name}: 이 테마는 손 대륙 대신 생성 구조 「${t.terrain}」(${tt.name ?? ""})를 깐다 — 장소 배치는 자동 맞춤(layout). ${tt.note ?? ""}`
      : t.terrain
        ? `${t.name}: 이 테마는 공용 지형 위에 자기 지형 「${t.terrain}」(해협·섬 등)을 먼저 깔고, 네 작업은 그 위에 얹힌다. 장소 배치는 공용과 같다.`
        : `${t.name}: 이 테마는 화풍(팔레트·덧칠·아이콘)만 바꾼다 — 지형·장소 배치는 공용 지형 그대로다.`;
    return head
      + (p?.desc ? ` 팔레트 ${p.id ?? t.palette}: ${p.desc}${p.regional ? " (지역 팔레트 — 같은 바닥 글자도 자리마다 다른 색으로 칠해진다)" : ""}` : "");
  } catch {
    return "";
  }
}

/** 생성 지형의 배치 요약(조수용) — 칸 배열·좌표 목록은 뺀다. 손 대륙이면 null. */
function layoutSummary(layout) {
  if (!layout || layout.base !== "generate") return null;
  const { regions, road_ends: _r, places: _p, systems, ...rest } = layout;
  return { ...rest, systems: Array.isArray(systems) ? systems.length : undefined, regions };
}

export async function buildWorldmap(request = {}) {
  const theme = typeof request.theme === "string" && request.theme ? request.theme : "fantasy";
  if (!THEME_RE.test(theme)) return { ok: false, error: `theme 이름이 올바르지 않다: ${theme}` };
  const preview = request.preview === true;
  const dir = await mkdtemp(join(tmpdir(), "oprn-worldmap-"));
  try {
    // 여정은 테마가 고른다(starmap = 우주 5막, 나머지 = 판타지 5막)
    const args = ["kit/build_world.py", "--theme", theme, "--out", join(dir, "out"), "--cache", CACHE];
    if (request.terrain && typeof request.terrain === "object") {
      const spec = { schema: "worldmap-terrain/1", ...request.terrain, id: String(request.terrain.id || "edit") };
      if (spec.base == null) delete spec.base;           // 없으면 테마 지형의 바탕(공용 shared-v9 또는 생성)을 따른다
      if (spec.fit_salt == null) delete spec.fit_salt;
      await writeFile(join(dir, "terrain.json"), JSON.stringify(spec));
      args.push("--terrain", join(dir, "terrain.json"));
    }
    if (preview) args.push("--preview");
    const t0 = Date.now();
    const res = await run(args, TIMEOUT_MS);
    if (res.code !== 0) {
      const text = (res.stderr || res.stdout).trim();
      const error = res.signal ? `월드맵 빌드가 시간 안에 끝나지 않았다(${Math.round(TIMEOUT_MS / 60000)}분)` : (text.split("\n").filter((l) => !l.startsWith("Traceback")).slice(-8).join("\n") || `빌드 실패(code ${res.code})`);
      return { ok: false, error };
    }
    const out = join(dir, "out");
    const world = JSON.parse(await readFile(join(out, "world.json"), "utf8"));
    const report = JSON.parse(await readFile(join(out, "build-report.json"), "utf8"));
    const imageFile = preview ? "schematic.png" : Object.values(world.images ?? {})[0];
    const png = await readFile(join(out, imageFile));
    const ascii = await readFile(join(out, "terrain.txt"), "utf8");
    const warnings = res.stdout.split("\n").filter((l) => l.startsWith("지형 경고:")).map((l) => l.replace(/^지형 경고:\s*/, ""));
    return {
      ok: true,
      preview,
      theme,
      imageDataUrl: `data:image/png;base64,${png.toString("base64")}`,
      world: {
        width: world.width, height: world.height, terrain: world.terrain, palette: world.palette ?? null,
        ground: world.ground, object: world.object, height_level: world.height_level, walk: world.walk,
        places: world.places, road_cells: world.road_cells, ramp: world.ramp, bridges: world.bridges, sky_site: world.sky_site,
        placeRules: world.place_rules ?? {},
        layout: layoutSummary(world.layout),
      },
      themeNote: await themeNote(theme),
      ascii,
      journeyCheck: report.journey_check ?? null,
      warnings,
      seconds: Math.round((Date.now() - t0) / 100) / 10,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
