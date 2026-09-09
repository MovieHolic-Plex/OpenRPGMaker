#!/usr/bin/env python3
"""verify-r6 native runner. Adapts verify-r5 invocations to r6 output paths.
Refuses to overwrite prior receipts. Does not mutate product or verify-r5."""
import hashlib, json, os, pathlib, shutil, subprocess, sys, time
from datetime import datetime, timezone

ROOT = pathlib.Path("/home/main/z-project/rpg-zzu-life-full-p4")
EV = ROOT / ".omo/evidence/life-full-20260906/12/ui/verify-r6"
NATIVE = EV / "native"
SCRATCH = pathlib.Path("/dev/shm/st_01a07c36")
LOCK = pathlib.Path("/tmp/rpg-zzu-life-full-qa-01a0727b.lock")
FIXTURES_R4 = ROOT / ".omo/evidence/life-full-20260906/12/ui/fixtures-r4"
FIXTURES_R5 = ROOT / ".omo/evidence/life-full-20260906/12/ui/fixtures-r5"

SCENARIOS = {
  "arena-lastexit": {
    "script": NATIVE / "native-qa-arena-lastexit.mjs",
    "env": {
      "TASK12_V5_SCRATCH": str(SCRATCH / "native-arena"),
      "TASK12_V5_ARENA": str(FIXTURES_R4 / "arena.reloaded.json"),
      "TASK12_V5_LAST_EXIT": str(FIXTURES_R4 / "lastExit.reloaded.json"),
    },
    "timeout": 600,
  },
  "rug": {
    "script": NATIVE / "native-qa-rug.mjs",
    "env": {
      "TASK12_V5_SCRATCH": str(SCRATCH / "native-rug"),
      "TASK12_V5_RUG": str(FIXTURES_R5 / "rug.reloaded.json"),
    },
    "timeout": 600,
  },
  "general": {
    "script": NATIVE / "native-qa-general.mjs",
    "env": {
      "TASK12_V5_SCRATCH": str(SCRATCH / "native-general"),
    },
    "timeout": 900,
  },
}

RECEIPT_SUFFIXES = (
  ".before.json", ".after.json", ".cleanup.json", ".command.json",
  ".exit", ".stderr", ".stdout", ".key-steps.json",
)

def sha_file(p: pathlib.Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()

def refuse_if_exists(paths):
    existing = [str(p) for p in paths if p.exists()]
    if existing:
        print("REFUSE overwrite of prior receipts:\n  " + "\n  ".join(existing), file=sys.stderr)
        raise SystemExit(2)

def run_one(name: str) -> int:
    cfg = SCENARIOS[name]
    scratch = pathlib.Path(cfg["env"]["TASK12_V5_SCRATCH"])
    dest_dir = NATIVE / name
    receipt_paths = [NATIVE / f"{name}{suf}" for suf in RECEIPT_SUFFIXES]
    refuse_if_exists(receipt_paths + ([dest_dir] if dest_dir.exists() and any(dest_dir.iterdir()) else []))

    if scratch.exists():
        shutil.rmtree(scratch)
    scratch.mkdir(parents=True, exist_ok=True)
    (SCRATCH / "tmp").mkdir(parents=True, exist_ok=True)

    before = {
        "when": datetime.now(timezone.utc).isoformat(),
        "scenario": name,
        "scriptSha256": sha_file(cfg["script"]),
        "env": {k: v for k, v in cfg["env"].items()},
        "fixtureHashes": {
          k: sha_file(pathlib.Path(v))
          for k, v in cfg["env"].items()
          if v.endswith(".json")
        },
        "head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "verify": "r6",
        "scratchRoot": str(SCRATCH),
    }
    (NATIVE / f"{name}.before.json").write_text(json.dumps(before, indent=2) + "\n")

    env = os.environ.copy()
    env.update({
        "TMPDIR": str(SCRATCH / "tmp"),
        "XDG_CACHE_HOME": str(SCRATCH / "xdg-cache"),
        "XDG_CONFIG_HOME": str(SCRATCH / "xdg-config"),
        "XDG_DATA_HOME": str(SCRATCH / "xdg-data"),
        "VITE_CACHE_DIR": str(SCRATCH / "vite-cache"),
        "PLAYWRIGHT_BROWSERS_PATH": "/home/main/.cache/ms-playwright",
        "HOME": str(SCRATCH),
        **cfg["env"],
    })
    stdout_p = NATIVE / f"{name}.stdout"
    stderr_p = NATIVE / f"{name}.stderr"
    exit_p = NATIVE / f"{name}.exit"
    cmd = [
        "flock", "--timeout", "900", str(LOCK),
        "timeout", "--kill-after=30s", f"{cfg['timeout']}s",
        "node", str(cfg["script"]),
    ]
    cmd_meta = {
        "when": datetime.now(timezone.utc).isoformat(),
        "cwd": str(ROOT),
        "argv": cmd,
        "envSubset": {
          k: env[k] for k in sorted(env)
          if k.startswith("TASK12_") or k in ("TMPDIR", "VITE_CACHE_DIR", "PLAYWRIGHT_BROWSERS_PATH", "HOME")
        },
        "scriptSha256": before["scriptSha256"],
        "verify": "r6",
    }
    (NATIVE / f"{name}.command.json").write_text(json.dumps(cmd_meta, indent=2) + "\n")

    t0 = time.time()
    with open(stdout_p, "w") as out, open(stderr_p, "w") as err:
        proc = subprocess.run(cmd, cwd=str(ROOT), env=env, stdout=out, stderr=err)
    elapsed = time.time() - t0
    exit_p.write_text(f"{proc.returncode}\n")

    archived = []
    dest_dir.mkdir(parents=True, exist_ok=True)
    for pattern in ["native-evidence.json", "raw-slot-*.json", "*.png", "native-qa-final*"]:
        for f in NATIVE.glob(pattern):
            if f.is_file() and f.parent == NATIVE:
                target = dest_dir / f.name
                if target.exists():
                    raise SystemExit(f"REFUSE overwrite archived target {target}")
                shutil.move(str(f), str(target))
                archived.append(str(target))
    for f in list(NATIVE.glob("raw-slot-*.json")) + list(NATIVE.glob("*-1024.png")) + list(NATIVE.glob("*-1440.png")):
        if f.is_file() and f.parent == NATIVE:
            target = dest_dir / f.name
            if target.exists():
                raise SystemExit(f"REFUSE overwrite archived target {target}")
            shutil.move(str(f), str(target))
            archived.append(str(target))

    after = {
        "when": datetime.now(timezone.utc).isoformat(),
        "scenario": name,
        "exit": proc.returncode,
        "elapsedSec": round(elapsed, 3),
        "stdoutBytes": stdout_p.stat().st_size,
        "stderrBytes": stderr_p.stat().st_size,
        "scratchExists": scratch.exists(),
        "archived": archived,
    }
    (NATIVE / f"{name}.after.json").write_text(json.dumps(after, indent=2) + "\n")

    closed = {"scratchRemoved": False, "paths": [], "archivedCount": len(archived), "errors": []}
    try:
        if scratch.exists():
            shutil.rmtree(scratch)
            closed["scratchRemoved"] = not scratch.exists()
            closed["paths"].append(str(scratch))
            if scratch.exists():
                closed["errors"].append(f"scratch still present: {scratch}")
    except Exception as exc:  # noqa: BLE001 — record cleanup failure visibly
        closed["errors"].append(str(exc))
    (NATIVE / f"{name}.cleanup.json").write_text(json.dumps(closed, indent=2) + "\n")
    if closed["errors"]:
        print(f"{name} CLEANUP ERROR {closed['errors']}", flush=True)
        return 1 if proc.returncode == 0 else proc.returncode

    print(f"{name} exit={proc.returncode} elapsed={elapsed:.1f}s", flush=True)
    return proc.returncode

def main():
    names = sys.argv[1:] or list(SCENARIOS)
    codes = {}
    for name in names:
        if name not in SCENARIOS:
            print(f"unknown {name}", file=sys.stderr)
            return 2
        codes[name] = run_one(name)
    print(json.dumps(codes))
    # Any nonzero scenario exit OR cleanup error fails the runner.
    return 0 if all(c == 0 for c in codes.values()) else 1

if __name__ == "__main__":
    raise SystemExit(main())
