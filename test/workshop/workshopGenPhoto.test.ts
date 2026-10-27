// 공방 캐릭터 「사진으로 만들기」의 호스트 쪽(scripts/lib/workshopGen.mjs) — 가짜 char-gen(cli.py photo·pack)과 가짜 CLI 로
// 사진 → 후보(picking) → 고르기 → 묶음(done) 순서와 입력 거절을 본다. 모델·네트워크 없이 돈다.
import { mkdtemp, mkdir, writeFile, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const FAKE_CLI = `import json, sys, pathlib
args = sys.argv[1:]
if args[0] == "photo":
    assert "--no-picture" not in args          # the host lets char-gen draw a picture (or fall back) itself
    out = pathlib.Path(args[args.index("--out") + 1]) / "candidates"
    out.mkdir(parents=True)
    rows = []
    for i in (1, 2):
        (out / f"0{i}.chr.txt").write_text(f"chip{i}")
        (out / f"0{i}.gif").write_bytes(b"GIF89a")
        rows.append(dict(rank=i, head="H%d" % i, body="B", fit=7, chip=f"0{i}.chr.txt", preview=f"0{i}.gif",
                         checks=dict(errors="ok", flaws=[], walk="skipped", eyes_place=i, passed=i == 1)))
    (out / "candidates.json").write_text(json.dumps(dict(picture="description", candidates=rows)))
elif args[0] == "pack":
    src, dest = pathlib.Path(args[1]), pathlib.Path(args[2])
    chip = (src / "chip.chr.txt").read_text() + " " + json.loads((src / "meta.json").read_text())["key"]
    (dest / "blobs").mkdir(parents=True)
    (dest / "blobs" / "abc").write_text("x")
    (dest / "manifest.json").write_text(json.dumps(dict(title=args[args.index("--title") + 1], blobs=[dict(sha256="abc")], chip=chip)))
`;

let root = "";
let gen: typeof import("../../scripts/lib/workshopGen.mjs");

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "workshop-photo-"));
  await mkdir(join(root, "kit"));
  await writeFile(join(root, "kit", "cli.py"), FAKE_CLI);
  await mkdir(join(root, "bin"));
  await writeFile(join(root, "bin", "claude"), "#!/bin/sh\nexit 0\n");
  await chmod(join(root, "bin", "claude"), 0o755);
  vi.stubEnv("OPRN_GEN_KIT_CHAR_GEN", join(root, "kit"));
  vi.stubEnv("OPRN_WORKSHOP_GEN_WORK", join(root, "work"));
  vi.stubEnv("PATH", `${join(root, "bin")}:${process.env.PATH}`);
  gen = await import("../../scripts/lib/workshopGen.mjs");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

async function until(jobId: string, state: string): Promise<Record<string, unknown>> {
  for (let i = 0; i < 100; i += 1) {
    const st = gen.workshopGenStatus(jobId) as Record<string, unknown>;
    if (st.state === state) return st;
    if (st.state === "failed") throw new Error(String(st.error));
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error(`state ${state} not reached`);
}

describe("char-gen photo on the host", () => {
  it("refuses a photo job without a photo", () => {
    expect(gen.startWorkshopGen({ generator: "char-gen", mode: "photo" }).ok).toBe(false);
    expect(gen.startWorkshopGen({ generator: "char-gen", mode: "photo", photo: "data:text/plain;base64,aGk=" }).ok).toBe(false);
  });

  it("stops at the candidates, then packs only the one picked", async () => {
    const started = gen.startWorkshopGen({ generator: "char-gen", mode: "photo", photo: "data:image/png;base64,iVBORw0KGgo=", cli: "claude" });
    expect(started.ok).toBe(true);
    const jobId = String(started.jobId);
    const picking = await until(jobId, "picking");
    const cands = picking.photoCandidates as { rank: number; passed: boolean; gif: string }[];
    expect(cands.map((c) => c.rank)).toEqual([1, 2]);
    expect(cands[0]!.passed).toBe(true);
    expect(cands[0]!.gif.startsWith("data:image/gif;base64,")).toBe(true);
    expect(picking.photoPicture).toBe("description");     // the screen tells the user the photo itself was not drawn
    expect(gen.pickWorkshopGen({ jobId, rank: 9 }).ok).toBe(false);
    expect(gen.pickWorkshopGen({ jobId, rank: 2, title: "고른 사람" }).ok).toBe(true);
    const done = await until(jobId, "done");
    const pack = done.pack as { manifest: { title: string; chip: string }; blobs: Record<string, string> };
    expect(pack.manifest.title).toBe("고른 사람");
    expect(pack.manifest.chip).toBe("chip2 고른 사람");
    expect(Object.keys(pack.blobs)).toEqual(["abc"]);
    expect(gen.pickWorkshopGen({ jobId, rank: 1 }).ok).toBe(false);
  });
});
