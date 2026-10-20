#!/usr/bin/env python3
"""jp_city 부품 적대적 시각 검수 — 판정자 Argon(gemini-4-argon-high, 로컬 중계 8319). 그리는 쪽이 아닌 독립 판정자.

  python3 scripts/content/jp-city/qa/argon_parts_judge.py --round N --name poles --dir <borrowed_parts_sheet 출력 DIR> \
      --desc "무엇인가" [--focus "특히 볼 것"] [--extra a.png,b.png] --out DIR

보내는 그림: (1) 버들항 기준 크롭 4배(<name>-ref-x4.png) (2) 전|후 4배(<name>-x4.png, 왼쪽=전 오른쪽=후) (3) 후 1배(<name>-after-x1.png) (+ --extra).
결과 DIR/argon-r<N>-<name>.json, 표준 출력에 VERDICT·SCORE·결함 목록. 키는 ~/.omp/agent/models.yml providers.argonproxy.apiKey(출력·저장 안 함).
"""
import argparse, base64, io, json, os, sys, time, urllib.request
from pathlib import Path
import yaml
from PIL import Image

URL = 'http://127.0.0.1:8319/v1/chat/completions'
MODEL = 'gemini-4-argon-high'
MAX_SIDE = 1600

PROMPT = """You are a hostile senior pixel-art reviewer for a 16px-per-tile SNES-era top-down JRPG chipset drawn in 3/4 view
(camera above and to the south: you see the TOP face of things plus their SOUTH-facing front; light from the upper-left).
Your job is to find reasons this art should NOT ship. Do not be polite. Do not praise.

Image 1 = REFERENCE quality bar ("beodeul" city chipset), 4x zoom. Match its information density, material shading
(5+ value steps per material, hue-shifted shadows, material-tone outlines instead of pure black), texture grain and 3/4 depth.
Image 2 = the part "{name}" BEFORE (left half) and AFTER (right half), 4x zoom, same scene. Judge the AFTER (right).
Image 3 = AFTER at 1x (true game size). Further images (if any) are extra context.
Part description: {desc}
{focus}
Check: 3/4 view correctness (top faces visible where they must be; no pure side elevations for vehicles/poles), silhouette readability at 1x,
outline colour (pure black = defect), value range vs reference, texture (flat fill = defect; salt-and-pepper noise = defect),
visible 16px tile repetition / stamp repetition, seams between tiles, scale vs a 16px-per-metre world, Japanese real-world plausibility.
Japanese kana/kanji on signs is allowed; real brand logos are not.
For every defect: where (left/right, approx tile col/row in 64px steps of image 2), what is wrong, concrete pixel-level fix.
Then exactly:
VERDICT: PASS | NEEDS WORK | FAIL
SCORE: <0-10>   (10 = as good as the reference; 7 = shippable)
Numbered list, most severe first, max 12 items, English."""


def key():
    return yaml.safe_load(open(os.path.expanduser('~/.omp/agent/models.yml'), encoding='utf-8'))['providers']['argonproxy']['apiKey']


def uri(path):
    im = Image.open(path).convert('RGBA')
    if max(im.size) > MAX_SIDE:
        f = MAX_SIDE / max(im.size); im = im.resize((int(im.width * f), int(im.height * f)), Image.NEAREST)
    b = io.BytesIO(); im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def ask(content, tries=4):
    body = json.dumps({'model': MODEL, 'messages': [{'role': 'user', 'content': content}], 'temperature': 0.2}).encode()
    for t in range(tries):
        req = urllib.request.Request(URL, data=body, headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key()})
        try:
            with urllib.request.urlopen(req, timeout=900) as r:
                return json.load(r)['choices'][0]['message']['content']
        except Exception as e:  # noqa: BLE001
            print(f'argon try {t + 1} failed: {e}', file=sys.stderr); time.sleep(20 * (t + 1))
    raise SystemExit('argon unavailable')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--round', type=int, required=True); ap.add_argument('--name', required=True); ap.add_argument('--dir', required=True)
    ap.add_argument('--desc', default=''); ap.add_argument('--focus', default=''); ap.add_argument('--extra', default=''); ap.add_argument('--out', required=True)
    a = ap.parse_args()
    d = Path(a.dir)
    imgs = [d / f'{a.name}-ref-x4.png', d / f'{a.name}-x4.png', d / f'{a.name}-after-x1.png'] + [Path(p) for p in a.extra.split(',') if p]
    content = [{'type': 'text', 'text': PROMPT.format(name=a.name, desc=a.desc, focus=('Focus: ' + a.focus) if a.focus else '')}]
    content += [{'type': 'image_url', 'image_url': {'url': uri(p)}} for p in imgs if p.exists()]
    text = ask(content)
    pick = lambda tag: next((ln.split(':', 1)[1].strip() for ln in text.splitlines() if ln.strip().upper().startswith(tag)), '?')
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    json.dump(dict(round=a.round, name=a.name, model=MODEL, verdict=pick('VERDICT'), score=pick('SCORE'), text=text),
              open(out / f'argon-r{a.round}-{a.name}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'[{a.name}] r{a.round} {pick("VERDICT")} score {pick("SCORE")}\n{text}')


if __name__ == '__main__':
    main()
