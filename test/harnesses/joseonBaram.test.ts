import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHarnessIndex } from "@/harnesses/_core/indexMarkdown";
import { HARNESSES, getHarness, harnessesForGenre } from "@/harnesses/_core/registry";
import { JOSEON_BARAM_HARNESS } from "@/harnesses/joseon-baram/harness";
import { REQUIRED_FORBIDDEN, validateSeed } from "@/harnesses/joseon-baram/seed";
import { appendLedger, readLedger } from "@/harnesses/joseon-baram/node/ledger";
import { main, type CliIo } from "@/harnesses/joseon-baram/node/cli";

const ROOT = resolve(__dirname, "../..");
const SEED_PATH = join(ROOT, "harness-data/joseon-baram/seed.json");
const seedJson = () => JSON.parse(readFileSync(SEED_PATH, "utf8")) as Record<string, any>;

function sha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** 출력을 모으는 CLI 입출력 */
function capture(): CliIo & { text(): string } {
  const out: string[] = [];
  return {
    capture: true,
    out: (text) => void out.push(text),
    err: (text) => void out.push(text),
    text: () => out.join(""),
  };
}

describe("joseon-baram 매니페스트·레지스트리", () => {
  it("레지스트리에 등록돼 있고 범위·입구를 정직하게 선언한다", () => {
    expect(HARNESSES.map((h) => h.id)).toContain("joseon-baram");
    const harness = getHarness("joseon-baram");
    expect(harness).toBe(JOSEON_BARAM_HARNESS);
    expect(harness?.scope.genre).toBeUndefined();
    expect(harnessesForGenre("monster-collect").map((h) => h.id)).toContain("joseon-baram");
    expect(harness?.entrypoints).toEqual({ cli: true, editorUi: false, assistantTool: false });
    expect(harness?.workshop).toBeUndefined();
    expect(harness?.stages.map((s) => s.id)).toEqual(["palette", "validate", "list", "gate", "verdict", "build", "map", "review", "status"]);
    expect(harness?.seed).toBe("harness-data/joseon-baram/seed.json");
    expect(harness?.doc).toBe("openwiki/harnesses/joseon-baram.md");
    expect(existsSync(join(ROOT, harness!.doc))).toBe(true);
    // joseon_baram 전용이고 다른 타일셋은 별도 하네스라고 말한다
    expect(harness?.summary).toContain("joseon_baram");
    expect(harness?.triggers.join("\n")).toMatch(/별도 하네스/);
  });

  it("src/harnesses/INDEX.md 와 AGENTS.md·README 가 이 하네스를 가리킨다", () => {
    expect(readFileSync(join(ROOT, "src/harnesses/INDEX.md"), "utf8")).toBe(renderHarnessIndex(HARNESSES));
    const agents = readFileSync(join(ROOT, "AGENTS.md"), "utf8");
    expect(agents).toContain("harness-data/joseon-baram/seed.json");
    expect(agents).toContain("npm run harness -- joseon-baram <단계>");
    expect(readFileSync(join(ROOT, "openwiki/harnesses/README.md"), "utf8")).toContain("(joseon-baram.md)");
    expect(readFileSync(join(ROOT, "openwiki/joseon-baram.md"), "utf8")).toContain("openwiki/harnesses/joseon-baram.md");
  });
});

describe("joseon-baram 시드", () => {
  it("커밋된 seed.json 이 유효하고 쓰지 말 것·지도·관문이 들어 있다", () => {
    const seed = validateSeed(seedJson());
    expect(seed.tileset.id).toBe("joseon_baram");
    expect(seed.maps.map((m) => m.id)).toEqual(["joseon_v20", "gungnae", "gungnae_full", "joseon_field", "joseon_cave", "joseon_in_house_b", "joseon_in_inn_b", "joseon_in_smith_b", "joseon_in_pharmacy_b", "joseon_in_school_b", "joseon_in_office_b", "joseon_in_throne", "joseon_in_corridor", "joseon_in_bedchamber"]);
    // 시트순번은 0..13 한 번씩이고 앞 3장이 기준(동결 장부)이다
    expect(seed.maps.map((m) => m.sheetOrder)).toEqual(Array.from({ length: 14 }, (_, i) => i));
    expect(seed.maps.filter((m) => m.profile === "interior_b")).toHaveLength(6);
    expect(seed.maps.filter((m) => m.profile === "palace_int")).toHaveLength(3);
    // 방 빌더는 한 파일이 여러 방을 굽는다 — 방 id 를 인자로 받는다
    for (const m of seed.maps.filter((x) => x.profile === "interior_b" || x.profile === "palace_int")) expect(m.builderArgs?.[0]).toBe(m.id);
    expect(seed.gates.map((g) => g.code)).toEqual(["P", "E", "T", "L", "S", "A", "K", "TR", "V"]);
    expect(seed.forbidden.map((f) => f.id)).toEqual(expect.arrayContaining([...REQUIRED_FORBIDDEN]));
    expect(seed.characters.sheet).toMatch(/Actor1/);
    expect(seed.sources.baramScreens.commit).toBe(false);
  });

  it("잘못된 시드는 거부한다", () => {
    const base = seedJson();
    const clone = () => structuredClone(base);
    expect(() => validateSeed({ ...clone(), version: 2 })).toThrow("version");
    expect(() => validateSeed({ ...clone(), tileset: { ...base.tileset, id: "beodeul_city" } })).toThrow("joseon_baram");
    const noForbidden = clone();
    noForbidden.forbidden = noForbidden.forbidden.filter((f: { id: string }) => f.id !== "generated-characters");
    expect(() => validateSeed(noForbidden)).toThrow("generated-characters");
    const commitTrue = clone();
    commitTrue.sources.baramScreens.commit = true;
    expect(() => validateSeed(commitTrue)).toThrow("커밋 금지");
    const badSha = clone();
    badSha.sources.baramScreens.files["gate.png"].sha256 = "abc";
    expect(() => validateSeed(badSha)).toThrow("64자");
    const noGate = clone();
    noGate.gates = noGate.gates.filter((g: { code: string }) => g.code !== "V");
    expect(() => validateSeed(noGate)).toThrow("관문 V");
    const notActor = clone();
    notActor.characters.sheet = "public/assets/generated/people.png";
    expect(() => validateSeed(notActor)).toThrow("Actor1");
    const dupOrder = clone();
    dupOrder.maps[1].sheetOrder = 0;
    expect(() => validateSeed(dupOrder)).toThrow("sheetOrder");
    const badProfile = clone();
    badProfile.maps[0].profile = "nope";
    expect(() => validateSeed(badProfile)).toThrow("profile");
    const badStatus = clone();
    badStatus.verdictStatuses = ["pass", "ok"];
    expect(() => validateSeed(badStatus)).toThrow("verdictStatuses");
    const badArgs = clone();
    badArgs.maps[5].builderArgs = [3];
    expect(() => validateSeed(badArgs)).toThrow("builderArgs");
    const badSize = clone();
    badSize.maps[0].size = [0, 5];
    expect(() => validateSeed(badSize)).toThrow("size");
  });

  it("시드가 가리키는 파일이 실제로 있다", () => {
    const seed = validateSeed(seedJson());
    for (const [key, rel] of Object.entries(seed.toolchain)) expect(existsSync(join(ROOT, rel)), `toolchain.${key} ${rel}`).toBe(true);
    for (const rel of [seed.tileset.sheet, seed.tileset.doc, seed.characters.sheet, seed.palette.file, seed.palette.previous.file]) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(true);
    }
    for (const map of seed.maps) {
      expect(existsSync(join(ROOT, map.builder)), map.builder).toBe(true);
      for (const template of seed.mapFiles) {
        const rel = join(map.out, template.replace("{stem}", map.stem));
        expect(existsSync(join(ROOT, rel)), rel).toBe(true);
      }
    }
    expect(existsSync(join(ROOT, "tiledata/beodeul-city/render/city6_objects.json"))).toBe(true);
  });
});

describe("joseon-baram ledger", () => {
  it("덧붙이고 다시 읽는다(모래상자 경로)", () => {
    const dir = mkdtempSync(join(tmpdir(), "jb-ledger-"));
    try {
      const path = join(dir, "sub/ledger.json");
      expect(readLedger(path).entries).toEqual([]);
      appendLedger("verdict", { piece: "x", status: "pass" }, path);
      appendLedger("build", { ok: true }, path);
      const ledger = readLedger(path);
      expect(ledger.version).toBe(1);
      expect(ledger.entries.map((e) => e.step)).toEqual(["verdict", "build"]);
      expect(ledger.entries[0]).toMatchObject({ piece: "x", status: "pass" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("joseon-baram CLI (기존 도구를 실제로 부른다, 정본 파일은 건드리지 않는다)", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "jb-cli-"));
  const protectedFiles = [
    "scripts/content/lib/joseon/harness/verdicts.json",
    "scripts/content/lib/joseon/harness/adversarial.json",
    "scripts/content/lib/joseon/harness/pieces_meta.json",
    "scripts/content/lib/joseon/harness/palette.json",
    "harness-data/joseon-baram/ledger.json",
  ];
  const before = new Map<string, string>();
  beforeAll(() => {
    for (const rel of protectedFiles) before.set(rel, sha(join(ROOT, rel)));
    vi.stubEnv("JOSEON_BARAM_LEDGER", join(sandbox, "ledger.json"));
    vi.stubEnv("JOSEON_BARAM_RUNS", join(sandbox, "runs"));
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    rmSync(sandbox, { recursive: true, force: true });
    // 판정·적대 리뷰·메타·팔레트·커밋된 ledger 는 시험이 바꾸지 않았다
    for (const rel of protectedFiles) expect(sha(join(ROOT, rel)), rel).toBe(before.get(rel));
  });

  it("도움말과 모르는 단계", async () => {
    const help = capture();
    expect(await main([], help)).toBe(0);
    for (const stage of JOSEON_BARAM_HARNESS.stages) expect(help.text()).toContain(stage.id);
    const unknown = capture();
    expect(await main(["frobnicate"], unknown)).toBe(2);
    expect(unknown.text()).toContain("모르는 단계: frobnicate");
    expect(unknown.text()).toContain("palette");
  });

  it("palette: 잠금 검사가 통과하고 91색을 말한다", async () => {
    const io = capture();
    expect(await main(["palette"], io)).toBe(0);
    expect(io.text()).toContain("팔레트 잠금 OK");
    expect(io.text()).toContain("허용 91색");
  });

  it("validate: 시드·메타·지도 관문 임계·스크린샷 추적 점검", async () => {
    const io = capture();
    expect(await main(["validate"], io)).toBe(0);
    expect(io.text()).toContain("시드 구조 OK");
    expect(io.text()).toContain("지도 관문 프로필 8개 mapgate.py 와 일치");
    expect(io.text()).toContain("바람의나라 스크린샷 해시 일치 0");
    expect(io.text()).toContain("validate: FAIL 0");
  });

  it("list: 지도·조각 목록과 거름", async () => {
    const maps = capture();
    expect(await main(["list", "maps"], maps)).toBe(0);
    for (const id of ["joseon_v20", "gungnae", "gungnae_full", "joseon_field", "joseon_cave", "joseon_in_house_b", "joseon_in_inn_b", "joseon_in_smith_b", "joseon_in_pharmacy_b", "joseon_in_school_b", "joseon_in_office_b", "joseon_in_throne", "joseon_in_corridor", "joseon_in_bedchamber"]) expect(maps.text()).toContain(id);
    expect(maps.text()).toContain("200x208칸");
    const trees = capture();
    expect(await main(["list", "pieces", "--class", "tree"], trees)).toBe(0);
    expect(trees.text()).toMatch(/조각 \d+개 +분류 \{'tree': \d+\}/);
    const bad = capture();
    expect(await main(["list", "nonsense"], bad)).toBe(2);
  });

  it("gate --candidate: 조각 하나를 실제 관문으로 돌려 FAIL 0 으로 끝난다", async () => {
    const io = capture();
    expect(await main(["gate", "--candidate", "--piece", "giwa_house_6"], io)).toBe(0);
    expect(io.text()).toContain("giwa_house_6");
    expect(io.text()).toContain("[후보(A 건너뜀)] FAIL 0 / WARN 0 / 전체 1");
  }, 120_000);

  it("verdict: 인자 검사와 --dry (기록을 쓰지 않는다)", async () => {
    const noArgs = capture();
    expect(await main(["verdict"], noArgs)).toBe(2);
    const badStatus = capture();
    expect(await main(["verdict", "giwa_house_6", "perfect", "앞사면이 두 줄 보인다"], badStatus)).toBe(2);
    expect(badStatus.text()).toContain("pass|note|user|redo");
    const tooShort = capture();
    expect(await main(["verdict", "giwa_house_6", "pass", "ok"], tooShort)).toBe(2);
    const dry = capture();
    expect(await main(["verdict", "giwa_house_6", "pass", "앞사면이", "두", "줄", "보이고", "기준과", "같은", "문법", "--dry"], dry)).toBe(0);
    expect(dry.text()).toContain("[dry]");
    expect(readLedger(join(sandbox, "ledger.json")).entries.filter((e) => e.step === "verdict")).toEqual([]);
  });

  it("build --dry: 계획과 입력 점검만 하고 굽지 않는다", async () => {
    const io = capture();
    expect(await main(["build", "--dry"], io)).toBe(0);
    expect(io.text()).toContain("rebuild-joseon.sh");
    expect(io.text()).toContain("입력 점검 OK");
    expect(io.text()).toContain("[dry] 실행하지 않았다.");
    const regen = capture();
    expect(await main(["build", "--dry", "--regen-village", "--report-only"], regen)).toBe(0);
    expect(regen.text()).toContain("REGEN_VILLAGE=1");
    expect(regen.text()).toContain("JOSEON_REPORT_ONLY=1");
    const missing = capture();
    expect(await main(["build", "--dry", "--gungnae-dir", join(sandbox, "nope")], missing)).toBe(1);
    expect(missing.text()).toContain("재굽기 입력이 없다");
    expect(readLedger(join(sandbox, "ledger.json")).entries.filter((e) => e.step === "build")).toEqual([]);
  });

  it("map: --dry 계획, 덮어쓰기 확인, 게이트 우회 환경 거부", async () => {
    const plan = capture();
    expect(await main(["map", "gungnae_full", "--dry"], plan)).toBe(0);
    expect(plan.text()).toContain("demo_gungnae_full.py");
    expect(plan.text()).toContain("JS_PROFILE=gungnae_full");
    expect(plan.text()).toContain("건물 밀도 ≥0.0007");
    // 방 지도는 빌더에 방 id 를 넘기고, 사냥터·동굴은 조각 게이트 대신 빌더 단언이 막는다고 말한다
    const room = capture();
    expect(await main(["map", "joseon_in_throne", "--dry"], room)).toBe(0);
    expect(room.text()).toContain("pal_demo.py joseon_in_throne --candidate");
    expect(room.text()).toContain("JS_PROFILE=palace_int");
    expect(room.text()).toContain("M3 물체 피복");
    const field = capture();
    expect(await main(["map", "joseon_field", "--dry"], field)).toBe(0);
    expect(field.text()).toContain("demo_field.py");
    expect(field.text()).toContain("빌더 단언");
    expect(field.text()).toContain("건물 밀도 ≥0.001");
    const v20 = capture();
    expect(await main(["map", "joseon_v20", "--dry", "--candidate"], v20)).toBe(0);
    expect(v20.text()).toContain("추적 파일이 아니다");
    expect(v20.text()).toContain("--candidate");
    const needWrite = capture();
    expect(await main(["map", "gungnae"], needWrite)).toBe(2);
    expect(needWrite.text()).toContain("--write");
    const unknownMap = capture();
    expect(await main(["map", "nowhere", "--dry"], unknownMap)).toBe(2);
    vi.stubEnv("JS_SKIPGATE", "1");
    try {
      const bypass = capture();
      expect(await main(["map", "joseon_v20", "--dry"], bypass)).toBe(2);
      expect(bypass.text()).toContain("우회하는 실행을 하지 않는다");
    } finally {
      vi.stubEnv("JS_SKIPGATE", "");
    }
    expect(readLedger(join(sandbox, "ledger.json")).entries.filter((e) => e.step === "map")).toEqual([]);
  });

  it("review zones: 16구역 크롭·렌즈 프롬프트·manifest 를 만들고 ledger 에 지도 해시를 남긴다", async () => {
    const out = join(sandbox, "zones");
    const io = capture();
    expect(await main(["review", "zones", "joseon_v20", "--out", out], io)).toBe(0);
    expect(io.text()).toContain("구역 16개");
    const files = readdirSync(out);
    expect(files.filter((f) => /^zone-r\dc\d\.png$/.test(f))).toHaveLength(16);
    expect(files.filter((f) => f.endsWith(".culture.prompt.md"))).toHaveLength(16);
    expect(files.filter((f) => f.endsWith(".view.prompt.md"))).toHaveLength(16);
    const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
    const mapPng = join(ROOT, "tiledata/joseon-village20/joseon-village20-map.png");
    expect(manifest.sourceSha256).toBe(sha(mapPng));
    expect(manifest.grid).toEqual([4, 4]);
    expect(manifest.zones).toHaveLength(16);
    // 64x56 칸 → 구역 16x14 칸 → x2 = 512x448 px
    expect(manifest.zones[0].px).toEqual([512, 448]);
    expect(manifest.zones[0].tiles).toEqual([0, 0, 16, 14]);
    const prompt = readFileSync(join(out, "zone-r1c1.culture.prompt.md"), "utf8");
    expect(prompt).toContain("렌즈 culture");
    expect(prompt).toContain("기본 태도는 **기각**");
    expect(prompt).toContain("joseon_v20");
    const entries = readLedger(join(sandbox, "ledger.json")).entries.filter((e) => e.step === "review");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: "zones", map: "joseon_v20", sourceSha256: sha(mapPng), zones: 16 });
    const badMap = capture();
    expect(await main(["review", "zones", "nowhere"], badMap)).toBe(2);
  });

  it("review: record 는 파일이 없으면 거부하고, 모르는 종류는 사용법 오류", async () => {
    const missing = capture();
    expect(await main(["review", "record", join(sandbox, "nope.json")], missing)).toBe(2);
    const noArg = capture();
    expect(await main(["review", "record"], noArg)).toBe(2);
    const unknown = capture();
    expect(await main(["review", "bogus"], unknown)).toBe(2);
  });

  it("status: 현황을 보고하고 0 으로 끝난다", async () => {
    const io = capture();
    expect(await main(["status"], io)).toBe(0);
    expect(io.text()).toContain("팔레트 잠금 OK");
    expect(io.text()).toContain("판정 기록");
    expect(io.text()).toContain("적대 리뷰 기록");
    expect(io.text()).toMatch(/번들 시트: \d+칸/);
    expect(io.text()).toContain("기록(ledger)");
  });
});
