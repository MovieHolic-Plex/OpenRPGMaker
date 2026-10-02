// 월드맵 키트(tiledata/worldmap-kit, Python) 를 돌려 세계 지도 한 장을 만든다 — 조수의 지형 편집 도구가 쓴다.
// 호스트 쪽(동반 서비스 /v1/worldmap/build, Pi 워커)에서만 돈다. 브라우저는 동반 서비스 경로로 부른다.
//
// 입력 { theme, terrain?: worldmap-terrain/1 객체, preview?: boolean }
// 출력 { ok, preview, imageDataUrl, world:{...칸 배열·장소·길·walk}, ascii, journeyCheck:{ok,bad}, warnings, seconds }
//      실패 { ok:false, error } — error 는 키트의 「입력 오류/지형 오류/길을 낼 수 없다」 문장 그대로(조수가 읽고 고친다)
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const KIT = join(ROOT, "tiledata", "worldmap-kit");
const CACHE = process.env.OPRN_WORLDMAP_CACHE || join(homedir(), ".cache", "oprn", "worldmap-kit");
const JOURNEY = "fantasy-5act";
const THEME_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
/** 전체 렌더는 지형이 바뀌면 100초 남짓 걸린다(캐시가 맞으면 몇 초). */
const TIMEOUT_MS = 6 * 60 * 1000;

function run(args, timeoutMs) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.env.OPRN_PYTHON || "python3", args, { cwd: KIT, stdio: ["ignore", "pipe", "pipe"] });
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
    const t = JSON.parse(await readFile(join(KIT, "themes", `${theme}.json`), "utf8"));
    const p = t.palette ? JSON.parse(await readFile(join(KIT, "palettes", `${t.palette}.json`), "utf8")) : null;
    const terrain = t.terrain ? ` 이 테마는 지형 「${t.terrain}」 을 먼저 깐다.` : "";
    return `${t.name}: 테마는 화풍(팔레트·덧칠·아이콘)만 바꾼다 — 지형·장소 배치는 모든 테마가 같은 공용 지형이다.${terrain}`
      + (p?.desc ? ` 팔레트 ${p.id ?? t.palette}: ${p.desc}${p.regional ? " (지역 팔레트 — 같은 바닥 글자도 자리마다 다른 색으로 칠해진다)" : ""}` : "");
  } catch {
    return "";
  }
}

export async function buildWorldmap(request = {}) {
  const theme = typeof request.theme === "string" && request.theme ? request.theme : "fantasy";
  if (!THEME_RE.test(theme)) return { ok: false, error: `theme 이름이 올바르지 않다: ${theme}` };
  const preview = request.preview === true;
  const dir = await mkdtemp(join(tmpdir(), "oprn-worldmap-"));
  try {
    const args = ["kit/build_world.py", "--theme", theme, "--journey", JOURNEY, "--out", join(dir, "out"), "--cache", CACHE];
    if (request.terrain && typeof request.terrain === "object") {
      const spec = { schema: "worldmap-terrain/1", base: "shared-v9", ...request.terrain, id: String(request.terrain.id || "edit") };
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
