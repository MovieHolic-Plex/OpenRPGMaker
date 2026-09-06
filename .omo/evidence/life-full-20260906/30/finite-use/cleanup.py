import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

root = Path.cwd()
base = "f86474547028cddf795c8e431b2195b7edccd201"
integrity = []
for name in [".vite-cache/deps/_metadata.json", ".vite-cache/deps/package.json", "package.json"]:
    actual = (root / name).read_bytes()
    original = subprocess.check_output(["git", "show", f"{base}:{name}"])
    assert actual == original, name
    integrity.append({"path": name, "bytes": len(actual), "sha256": hashlib.sha256(actual).hexdigest(), "baseIdentical": True})
removed = []
for path in [root / "dist", *Path("/tmp").glob("st_01a074ed-*")]:
    if path.is_relative_to(root):
        assert not subprocess.check_output(["git", "ls-files", "--", str(path.relative_to(root))]), path
    assert not path.is_symlink(), path
    if path.exists():
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()
        removed.append(str(path))
processes = []
for entry in Path("/proc").iterdir():
    if not entry.name.isdigit() or int(entry.name) == os.getpid():
        continue
    try:
        cwd = (entry / "cwd").resolve()
        command = (entry / "cmdline").read_bytes().replace(b"\0", b" ").decode(errors="replace")
        executable = (entry / "exe").resolve().name
    except (OSError, RuntimeError):
        continue
    if cwd == root and executable in ["node", "bun"] and any(word in command for word in ["vitest", "vite", "typescript", "tsserver", "public-roundtrip"]):
        processes.append({"pid": int(entry.name), "command": command})
assert not processes, processes
assert not list(Path("/tmp").glob("st_01a074ed-*"))
print(json.dumps({"integrity": integrity, "removed": removed, "ownRemainingProcesses": processes, "remainingOwnTmpPaths": [], "sharedCachesDeleted": False}))
