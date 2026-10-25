#!/usr/bin/env python3
"""char-gen `command` image engine -> private codex image route (kaykai-image-api, gpt-image). args: prompt_file ref out size"""
import sys, json, base64, urllib.request
pf, ref, out, size = sys.argv[1:5]
body = json.dumps({"prompt": open(pf).read(), "reference_b64": base64.b64encode(open(ref, 'rb').read()).decode(),
                   "fallback": False, "priority": 0, "size": size, "return_base64": True}).encode()
with urllib.request.urlopen(urllib.request.Request('http://100.73.251.77:8091/v1/generate/json', body, {"Content-Type": "application/json"}), timeout=1500) as r:
    j = json.load(r)
open(out, 'wb').write(base64.b64decode(j['image_b64']))
