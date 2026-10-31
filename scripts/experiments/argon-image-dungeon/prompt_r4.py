"""The bbox-dungeon round-4 layout prompt, taken verbatim at run time from ../bbox-dungeon/run4.py (its non-v2 branch), so both arms here see exactly what Opus r4 saw."""
import json, os
_SRC = os.path.join(os.path.dirname(__file__), "..", "bbox-dungeon", "run4.py")
def build(RUNS, REQ):
    src = open(_SRC).read()
    a = src.index('    catalog = open(f"{RUNS}/catalog.txt").read()'); b = src.index('open(f"{G}/prompt.txt", "w").write(PROMPT)')
    block = "\n".join(l[4:] if l.startswith("    catalog =") or l.startswith("    PROMPT =") else l for l in src[a:b].splitlines())
    ns = {"RUNS": RUNS, "REQ": REQ, "json": json}; exec(block, ns); return ns["PROMPT"]
