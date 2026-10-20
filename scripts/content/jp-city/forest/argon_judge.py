#!/usr/bin/env python3
"""숲 키트 적대적 시각 검수 — 판정자 Argon(gemini-4-argon-high, 로컬 중계 8319). 그림은 그리는 쪽이 아니라 이 판정자가 본다.

  python3 argon_judge.py --round N --scene dense --img scene.png [--ref ref.png] [--note "..."] --out DIR

장면 그림을 2×2 사분면으로 잘라 4배로 키우고, 버들항 숲 기준 크롭(같은 배율)과 함께 보낸다.
판정자는 결함을 위치(사분면·대략 좌표)와 함께 적고 PASS / NEEDS WORK / FAIL 을 낸다. 결과는 DIR/argon-r<N>-<scene>.json.
키는 ~/.omp/agent/models.yml 의 providers.argonproxy.apiKey 를 실행 때 읽는다(출력·저장하지 않는다).
"""
import argparse
import base64
import io
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

import yaml
from PIL import Image

URL = 'http://127.0.0.1:8319/v1/chat/completions'
MODEL = 'gemini-4-argon-high'

PROMPT = """You are a hostile senior pixel-art reviewer for a 16px-per-tile SNES-era top-down (3/4 view) JRPG chipset.
Your job is to find reasons this forest art should NOT ship. Do not be polite. Do not praise.

Image 1 is the REFERENCE: a dense forest from the project's quality bar tileset ("beodeul"), shown at 4x.
Images 2-5 are the CANDIDATE scene "{scene}" split into quadrants q0 (top-left), q1 (top-right), q2 (bottom-left), q3 (bottom-right), each at 4x.
Each 64 screen px = one 16px tile. Candidate scene description: {desc}
{note}
Compare the candidate against the reference at the same zoom. Judge:
- value range and saturation vs the reference (too dark/flat/dull?), hue shifting from shadow to light
- visible 16px tile grid / repetition / identical stamps repeated (count how many times the same crown head appears)
- crown shapes: "cauliflower" (many identical small bubbles), "cat-ear" bumps, round balls/clouds, sticker look, outlines
- forest edges: north skyline, south trunk band (does it read as a black stripe or a fence?), side edges
- trunks (stick-like? same everywhere?), shadows (identical?), bamboo culm grain (vertical stripes every 16px?)
- noise: salt-and-pepper speckle, muddy/olive camo patches, banding
For every defect give: quadrant (q0-q3), approximate location (e.g. "upper-left third", or tile col/row counted in 64px steps), what is wrong, and a concrete pixel-level fix.
Then give a verdict line exactly as: VERDICT: PASS | NEEDS WORK | FAIL
and a score line: SCORE: <0-10> (10 = matches reference quality).
Answer in English, as a numbered defect list, most severe first, max 14 items."""


def key():
    d = yaml.safe_load(open(os.path.expanduser('~/.omp/agent/models.yml'), encoding='utf-8'))
    return d['providers']['argonproxy']['apiKey']


def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def quads(path, scale=4):
    im = Image.open(path).convert('RGBA')
    W, H = im.size
    out = []
    for qy in range(2):
        for qx in range(2):
            c = im.crop((qx * W // 2, qy * H // 2, (qx + 1) * W // 2, (qy + 1) * H // 2))
            out.append(c.resize((c.width * scale, c.height * scale), Image.NEAREST))
    return out


def ask(content, tries=4):
    body = json.dumps({'model': MODEL, 'messages': [{'role': 'user', 'content': content}], 'temperature': 0.2}).encode()
    for t in range(tries):
        req = urllib.request.Request(URL, data=body, headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key()})
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                d = json.load(r)
            return d['choices'][0]['message']['content']
        except Exception as e:  # noqa: BLE001
            err = getattr(e, 'read', lambda: b'')()[:300]
            print(f'argon try {t + 1} failed: {e} {err!r}', file=sys.stderr)
            time.sleep(20 * (t + 1))
    raise SystemExit('argon unavailable')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--round', type=int, required=True)
    ap.add_argument('--scene', required=True)
    ap.add_argument('--img', required=True)
    ap.add_argument('--desc', default='')
    ap.add_argument('--ref', default=str(Path(__file__).resolve().parents[4] / 'tiledata/jp-city/forest-proto/ref-beodeul-forest-x4.png'))
    ap.add_argument('--note', default='')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    ref = Image.open(a.ref).convert('RGBA')
    content = [{'type': 'text', 'text': PROMPT.format(scene=a.scene, desc=a.desc, note=('Author note: ' + a.note) if a.note else '')},
               {'type': 'image_url', 'image_url': {'url': uri(ref)}}]
    for q in quads(a.img):
        content.append({'type': 'image_url', 'image_url': {'url': uri(q)}})
    text = ask(content)
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    verdict = next((ln.split(':', 1)[1].strip() for ln in text.splitlines() if ln.strip().upper().startswith('VERDICT')), '?')
    score = next((ln.split(':', 1)[1].strip() for ln in text.splitlines() if ln.strip().upper().startswith('SCORE')), '?')
    json.dump(dict(round=a.round, scene=a.scene, model=MODEL, verdict=verdict, score=score, text=text), open(out / f'argon-r{a.round}-{a.scene}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'[{a.scene}] {verdict} score {score}')
    print(text)


if __name__ == '__main__':
    main()
