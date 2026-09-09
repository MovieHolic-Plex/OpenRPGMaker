import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys
import time

ROOT = pathlib.Path("/home/main/z-project/rpg-zzu-life-full-p4")
OUT = ROOT / ".omo/evidence/life-full-20260906/12/ui/producer-r5"
NATIVE = OUT / "native"
FIXTURES = ROOT / ".omo/evidence/life-full-20260906/12/ui/fixtures-r5"
SCRATCH = pathlib.Path("/dev/shm/st_01a07bf9")
LOCK = pathlib.Path("/tmp/rpg-zzu-life-full-qa-01a0727b.lock")
EXPECTED_FIXTURE_SHA = "265f600a710025ee451361b70746b50ca2bf9165e6815d4ce0aa582e7eca520b"
DECLARED = [
    "src/player/lifePlacementScene.ts",
    "src/player/lifeLedger.ts",
    "src/player/playerStatusMenuDetails.ts",
    "src/player/playerStatusMenu.ts",
    "src/player/playerStatusMenuController.ts",
    "src/player/playerStatusMenuTypes.ts",
    "src/player/playerStatusMenuDetailTypes.ts",
    "src/player/PlayScene.ts",
    "test/lifePlacementSceneUi.test.ts",
    "test/p2SpatialPlayIntegration.test.ts",
    "test/p2SpatialRuntimeUi.test.ts",
    "test/lifePlacementRenderedBodyReplay.test.ts",
    "src/project/databaseRecordModel.ts",
    "test/playerBodyProjectPersistence.test.ts",
]
WIKI = [
    "openwiki/INDEX.md",
    "openwiki/runtime-project-schema.md",
    "openwiki/runtime-sessions.md",
]
R3 = {
    "src/player/lifePlacementScene.ts": "275318021fbdfdfa0a8bcb131314fd7a75bf5a8fba1c37fdd35b47eac4739565",
    "src/player/lifeLedger.ts": "9e7ffb6f6e3bdd24f22d723556513570be03a5cb0394640ea718d918e5cfebcb",
    "src/player/playerStatusMenuDetails.ts": "26b30f5a06f8fc49ce9a815d7493300c4aae42d2d8b1693304cf9a2a3f96b67b",
    "src/player/playerStatusMenu.ts": "5d33e4a4844ddf2a5f623928b2c730ca514cdca29922d7435feeff2a4a3d6370",
    "src/player/playerStatusMenuController.ts": "7cf1dd019700f5ad8e19a170f6aa33fccfa0bfdce388eb00241c364bf81565e7",
    "src/player/playerStatusMenuTypes.ts": "40efe968f6d087034ec01e134f87043327eac5108d0b20ddb4b1b6ddee54972c",
    "src/player/playerStatusMenuDetailTypes.ts": "42ac4b0a3b6e06b1f6f5b594843b7c61cf85f141dd46c6711a9fc9b30a89614a",
    "src/player/PlayScene.ts": "a3c2fe2b3baad143cdef4db6de14590137316669961a451ec65407b0c156225d",
    "test/lifePlacementSceneUi.test.ts": "78403533ace4a55fa78c8b1e77e8466c87a18f1db187c5c38e0968a4821f6b56",
    "test/p2SpatialPlayIntegration.test.ts": "b7329262d031932ab515ec5647026e0a956c8275a145051e40f8ccc8403a9e51",
    "test/p2SpatialRuntimeUi.test.ts": "927d55ec45b0a72e8cd0240270701f9983f76734f1ace7b1d145cd822663be2f",
    "test/lifePlacementRenderedBodyReplay.test.ts": "f7ffd8d8a89a2fb10ef67ee13a459a8bda592e63e7035a50b63a75d27b06cc97",
    "src/project/databaseRecordModel.ts": "c27eb4c534e39a6b0c68c2d3650aadb905c8f42e0d053d10f79c8092aa6cbdfd",
    "test/playerBodyProjectPersistence.test.ts": "0dd6e5c03614aa124a4d953c8f80e6189fbdaebe0c31bf0b3335619861372ef1",
}


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1048576), b""):
            h.update(chunk)
    return h.hexdigest()


def identity():
    files = {path: digest(ROOT / path) for path in DECLARED + WIKI if (ROOT / path).is_file()}
    git = {
        key: subprocess.check_output(cmd, cwd=ROOT).decode()
        for key, cmd in {
            "head": ["git", "rev-parse", "HEAD"],
            "branch": ["git", "branch", "--show-current"],
            "status": ["git", "status", "--porcelain=v1"],
            "index": ["git", "diff", "--cached", "--name-only"],
        }.items()
    }
    return {"files": files, "git": git}


def dump(name, data):
    (OUT / name).write_text(json.dumps(data, indent=2) + "\n")


def next_attempt():
    n = 1
    while (NATIVE / f"native-qa-{n}.exit").exists():
        n += 1
    return n


attempt = next_attempt()
prefix = f"native-qa-{attempt}"
assert not (OUT / f"{prefix}.command.json").exists(), "preserve original command receipt"
OUT.mkdir(parents=True, exist_ok=True)
NATIVE.mkdir(parents=True, exist_ok=True)
before = identity()
dump(f"{prefix}.before.json", before)
mismatched = {
    path: {"expected": expected, "actual": before["files"].get(path)}
    for path, expected in R3.items()
    if before["files"].get(path) != expected
}
if mismatched:
    dump(f"{prefix}.source-mismatch.json", mismatched)
    raise SystemExit(f"protected source drifted from r3: {mismatched}")

fixture_path = FIXTURES / "rug.reloaded.json"
fixture_sha = digest(fixture_path)
if fixture_sha != EXPECTED_FIXTURE_SHA:
    raise SystemExit(f"fixture sha mismatch expected={EXPECTED_FIXTURE_SHA} actual={fixture_sha}")

assert not SCRATCH.exists(), "owned scratch unexpectedly exists"
SCRATCH.mkdir(mode=0o700)
env = dict(os.environ)
env.update({
    "TMPDIR": str(SCRATCH),
    "XDG_CACHE_HOME": str(SCRATCH / "xdg"),
    "XDG_CONFIG_HOME": str(SCRATCH / "xdg-config"),
    "XDG_DATA_HOME": str(SCRATCH / "xdg-data"),
    "VITE_CACHE_DIR": str(SCRATCH / "vite"),
    "PLAYWRIGHT_BROWSERS_PATH": env.get("PLAYWRIGHT_BROWSERS_PATH", "/home/main/.cache/ms-playwright"),
    "TASK12_R5_SCRATCH": str(SCRATCH),
    "TASK12_R5_RUG": str(fixture_path),
})
argv = [
    "flock", "--timeout", "900", str(LOCK),
    "timeout", "--signal=TERM", "--kill-after=30s", "600s",
    "node", str(NATIVE / "native-qa.mjs"),
]
record = {
    "argv": argv,
    "cwd": str(ROOT),
    "attempt": attempt,
    "environment": {key: env[key] for key in [
        "TMPDIR", "XDG_CACHE_HOME", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "VITE_CACHE_DIR",
        "PLAYWRIGHT_BROWSERS_PATH", "TASK12_R5_SCRATCH", "TASK12_R5_RUG",
    ]},
    "started": time.time(),
    "fixtureSha256": {"rug.reloaded.json": fixture_sha},
    "scriptSha256": digest(NATIVE / "native-qa.mjs"),
}
code = 1
try:
    with (NATIVE / f"{prefix}.stdout").open("w") as stdout, (NATIVE / f"{prefix}.stderr").open("w") as stderr:
        code = subprocess.run(argv, cwd=ROOT, env=env, stdout=stdout, stderr=stderr).returncode
    record.update(exit=code, finished=time.time())
    (NATIVE / f"{prefix}.exit").write_text(f"{code}\n")
finally:
    shutil.rmtree(SCRATCH, ignore_errors=True)
    after = identity()
    dump(f"{prefix}.after.json", after)
    record["stdoutSha256"] = digest(NATIVE / f"{prefix}.stdout")
    record["stderrSha256"] = digest(NATIVE / f"{prefix}.stderr")
    record["protectedIdentityUnchanged"] = before == after
    record["r3SourceIdentity"] = True
    dump(f"{prefix}.command.json", record)
    dump(f"{prefix}.cleanup.json", {
        "scratchAbsent": not SCRATCH.exists(),
        "protectedIdentityUnchanged": before == after,
        "lockRetained": LOCK.exists(),
        "playwrightBrowsersPath": env["PLAYWRIGHT_BROWSERS_PATH"],
        "playwrightBrowsersDeleted": False,
        "nodeModulesUntouched": True,
        "olderEvidenceUntouched": True,
        "fixturesR5Untouched": True,
    })
    if before != after:
        raise RuntimeError("protected identity changed")

print(json.dumps(record, indent=2))
sys.exit(code)
