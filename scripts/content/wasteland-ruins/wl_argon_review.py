#!/usr/bin/env python3
"""Send the review brief + images to gemini-4-argon via the local proxy; write the raw text reply as verdict-<LETTER>.md."""
import base64, glob, json, os, sys, urllib.request
R, LETTER = sys.argv[1], sys.argv[2]
brief = open(os.path.join(R, 'BRIEF.md')).read()
brief += ("\n\nYou cannot run tools in this session: the images are attached below in order, each preceded by its file name (only a subset of the crops and only the settlement maps are attached; judge from these). Ignore the instructions about Read, python, /tmp and writing the file. "
          "Your whole reply is saved verbatim as the verdict file, so reply ONLY with the verdict file content in the format above "
          "(first line VERDICT: ...).")
names = sorted(glob.glob(os.path.join(R, '*-3x.png')))
pieces = [n for n in names if not os.path.basename(n).startswith('crop-')]
crops = [n for n in names if os.path.basename(n).startswith('crop-')]
# 프록시 504 를 피하려고 그림 수를 줄인다: 조각 판 · 기준 둘 · 맵 둘(정착지) · 조각마다 둘레 crop 최대 2장
seen = {}
pick = []
for cp in crops:
    k = next((pid for pid in ('oil-stain-a', 'oil-stain-b', 'scorch-a', 'scorch-b', 'crop-bed-b', 'crop-bed-c') if '-' + pid + '-' in os.path.basename(cp)), None)
    if k and seen.get(k, 0) < 2: pick.append(cp); seen[k] = seen.get(k, 0) + 1
maps = [m for m in sorted(glob.glob(os.path.join(R, 'map-*.png'))) if 'settlement' in m]
imgs = pieces + [os.path.join(R, 'ref-beodeul-sheet-2x.png'), os.path.join(R, 'ref-modern-city-2x.png')] + maps + pick
content = [{"type": "text", "text": brief}]
for p in imgs:
    content.append({"type": "text", "text": "FILE: " + os.path.basename(p)})
    content.append({"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": base64.b64encode(open(p, 'rb').read()).decode()}})
body = json.dumps({"model": os.environ.get("ARGON_MODEL", "gemini-4-argon"), "max_tokens": 16000, "messages": [{"role": "user", "content": content}]}).encode()
tok = os.environ['ANTHROPIC_AUTH_TOKEN']
req = urllib.request.Request('http://127.0.0.1:8318/v1/messages', data=body, headers={'content-type': 'application/json', 'x-api-key': tok, 'authorization': 'Bearer ' + tok, 'anthropic-version': '2023-06-01'})
with urllib.request.urlopen(req, timeout=1500) as r: resp = json.load(r)
open(os.path.join(R, 'argon-raw-%s.json' % LETTER), 'w').write(json.dumps(resp, ensure_ascii=False, indent=1))
text = ''.join(b.get('text', '') for b in resp.get('content', []) if b.get('type') == 'text')
open(os.path.join(R, 'verdict-%s.md' % LETTER), 'w').write(text)
print(text.splitlines()[0] if text else 'EMPTY', '| images', len(imgs))
