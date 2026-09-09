#!/usr/bin/env bash
set -eu
EVID="${EVID:?}"
ROOT="${ROOT:?}"
name="$1"
shift
meta="$EVID/receipts/${name}.json"
stdout="$EVID/receipts/${name}.stdout.txt"
stderr="$EVID/receipts/${name}.stderr.txt"
exitf="$EVID/receipts/${name}.exit.txt"
python3 - "$meta" "$name" "$ROOT" "$PWD" "$@" <<'PY'
import json, os, sys, subprocess, hashlib, pathlib
meta, name, root, cwd, *argv = sys.argv[1:]
head = subprocess.check_output(["git","rev-parse","HEAD"], cwd=root, text=True).strip()
status = subprocess.check_output(["git","status","--porcelain"], cwd=root, text=True)
ident_files = [
  "src/assets/bundled.ts",
  "src/player/eventSpriteResources.ts",
  "src/player/playScenePlaceables.ts",
  "test/spatialCatalogPictureRender.test.ts",
]
def sha(p):
    h=hashlib.sha256(); h.update(pathlib.Path(p).read_bytes()); return h.hexdigest()
payload = {
  "name": name,
  "recordedBeforeRun": True,
  "argv": argv,
  "cwd": cwd,
  "root": root,
  "head": head,
  "gitStatusPorcelain": status,
  "sourceIdentities": {f: sha(os.path.join(root, f)) for f in ident_files},
  "envSubset": {
    "TMPDIR": os.environ.get("TMPDIR"),
    "VITE_CACHE_DIR": os.environ.get("VITE_CACHE_DIR"),
    "XDG_CACHE_HOME": os.environ.get("XDG_CACHE_HOME"),
    "PI_MODEL": os.environ.get("PI_MODEL"),
    "PI_PROVIDER": os.environ.get("PI_PROVIDER"),
  },
}
pathlib.Path(meta).write_text(json.dumps(payload, indent=2)+"\n")
print(f"recorded {name} argv={argv!r} cwd={cwd} head={head}", file=sys.stderr)
PY
set +e
"$@" >"$stdout" 2>"$stderr"
ex=$?
set -e
printf '%s\n' "$ex" >"$exitf"
python3 - "$meta" "$ex" "$stdout" "$stderr" <<'PY'
import json, sys, pathlib
meta, ex, stdout, stderr = sys.argv[1:]
payload = json.loads(pathlib.Path(meta).read_text())
payload["exit"] = int(ex)
payload["stdoutPath"] = stdout
payload["stderrPath"] = stderr
payload["stdoutBytes"] = pathlib.Path(stdout).stat().st_size
payload["stderrBytes"] = pathlib.Path(stderr).stat().st_size
pathlib.Path(meta).write_text(json.dumps(payload, indent=2)+"\n")
print(f"{payload['name']} exit={ex} stdout={payload['stdoutBytes']} stderr={payload['stderrBytes']}")
PY
exit "$ex"
