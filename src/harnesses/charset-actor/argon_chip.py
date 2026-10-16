#!/usr/bin/env python3
"""CT·FF6풍 직업 원형 걷기 칩 — Agy 의 gemini-4-argon-medium 이 격자 문자열을 손으로 고쳐 쓴다(2026-10-15).

사용자 지시: 「CT FF6 칩은 무조건 gemini 4 argon medium」. 저작 모델은 이 하나뿐이다(codex·GPT·Claude 로 폴백하지 않는다).
몬스터 걷기 칩(monster-collect-species/field_chip.py)과 같은 방식이다.

  1. 뼈대(RTP Actor1~4·People1~5 중 한 칸)의 down/up/right × 0·1·2 아홉 장을 txt 격자와 palette.json 으로 작업 폴더에 먼저 깐다.
  2. 모델은 그 격자를 **고쳐 쓴다**(머리·옷·장비·색). 몸 비율·머리 크기·걷기 다리 모양은 뼈대 그대로 이어받는다.
     참고 그림(뼈대 6배 시트, RTP 화풍 모음)을 @첨부로 같이 준다.
  3. 하네스가 검사한다 — 구조·결손(chr.gate 의 opacity_defects)·걷기 동작·방향 간 색 일관·디더 잡티·뼈대 복사 여부.
     어기면 이유를 붙여 같은 폴더에서 다시 고치게 한다(최대 3번, 백오프).
  4. 왼쪽 방향은 오른쪽을 거울로 뒤집어 만든다(저작 부담 3분의 1). 한 손 소지품은 왼쪽에서 반대 손이 된다.

  python3 argon_chip.py draw --spec ../../../harness-data/charset-actor/ct-ff6-argon-pilot.json [--only tt-hero-boy] [--par 2] [--run NAME]
  python3 argon_chip.py sheet RUN [RUN ...] --spec <spec> --out ~/claude-viz/chips-ct-ff6-pick-3.html [--note KEY=소견] [--cull KEY]

산출: <OUT>/<run>/<key>/ (OUT 기본 qa-runs/harnesses/ct-ff6-argon, 저장소에 커밋하지 않는다). 키는 읽지도 쓰지도 않는다(agy 가 환경에서 스스로 인증).
고르는 것은 사용자뿐이다. 이 스크립트는 팩·번들·프로젝트에 아무것도 설치하지 않는다. 사람 캐릭터라 3/4 관문(object-gate) 대상이 아니다.
"""
import argparse
import base64
import datetime
import hashlib
import html
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402
import harness as H  # noqa: E402
from PIL import Image  # noqa: E402

OUT = Path(os.environ.get('CTFF6_ARGON_OUT', H.ROOT / 'qa-runs' / 'harnesses' / 'ct-ff6-argon'))
MODEL = 'gemini-4-argon-medium'      # 고정. 환경 변수로도 바꾸지 못하게 한다.
TIMEOUT = int(os.environ.get('CTFF6_ARGON_TIMEOUT', str(25 * 60)))
MAX_ATTEMPTS = int(os.environ.get('CTFF6_ARGON_ATTEMPTS', '3'))
BACKOFF = (60, 180, 420)
SRC_DIRS = ('down', 'up', 'right')   # 모델이 그리는 방향. left = right 거울.
FRAMES = (0, 1, 2)
LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

# 걷기 칩 검사에서 chr.gate 의 「뼈대 대비 소지품 제한」은 창·칼·방패가 필요한 직업 원형에 맞게 푼다(결손·걷기·윤곽 검사는 그대로).
C.STRENGTH['ctff6'] = dict(label='CT/FF6 원형', protrude_frame_max=70, protrude_sum_max=500, silhouette_max=None,
                           changed_min=0.22, redrawn_min=0.18, area_vs_base=(0.6, 1.9))

NO_GEN = ('이미지 생성 기능·image-generator 서브에이전트·이미지 API 는 절대 쓰지 마라. 원·다각형·수식·필터로 몸을 합성하는 코드도 금지다. '
          '모든 행의 문자열을 네가 직접 손으로 적어라(파일 쓰기/편집 도구로 txt 를 고친다). 허용되는 코드는 txt 들을 PNG 로 굽는 아주 작은 확인용 스크립트뿐이다.')

STYLE = '''[RTP 화풍 — 이 칩은 @rtp_style_4x.png 의 캐릭터들 옆에 서도 어색하면 안 된다]
- 머리가 큰 2.5등신. 1배 크기(24×32)에서 **얼굴이 또렷이 읽혀야 한다**. 아래(정면) 방향: 눈은 가로 2칸짜리 흰자+눈동자(어두운 한 칸)로 좌우 두 개를 분명히 찍고, 입·코는 피부색보다 약간 어두운 한 칸으로 최소한만 둔다. 얼굴을 투구·머리카락·그림자가 덮더라도 눈 줄은 반드시 보이게 한다(바이저는 눈 줄만 비운 틈으로 처리).
- **윤곽선은 순수 검정 한 색으로 두껍게 두르지 않는다.** RTP 는 재질마다 그 재질의 가장 어두운 색(머리=짙은 갈색·남색, 살=짙은 적갈색, 천=짙은 군청, 금속=짙은 청회색)을 윤곽으로 쓴다. 가장 어두운 검정은 눈·깊은 그림자·장갑 같은 곳에 조금만 쓴다.
- 재질마다 3톤 명암(밝음·중간·어두움), 빛은 왼쪽 위. **디더링(체스판·점 흩뿌림)·노이즈 무늬 금지**: 같은 색은 면으로 모아 칠한다. 인접한 픽셀 하나만 다른 색이 박힌 잡티를 남기지 않는다.
- **직업 표식을 위·옆·뒤에서도 보이게**: 정면에만 있는 장식으로 끝내지 말고 뒷모습(망토·가방·투구 뒤·장비)과 옆모습(소지품이 몸 옆으로 보임)에도 같은 표식을 넣는다.
- 세 방향(아래·위·오른쪽)은 **같은 사람**이어야 한다: 같은 머리색·옷색·팔레트 글자, 같은 몸 크기, 머리 꼭대기 줄도 같다.
- 색은 총 40개 이하. 칸 가장자리(왼쪽·오른쪽 끝 열, 맨 위 줄)에는 픽셀을 두지 않는다. 발 바닥 줄은 뼈대와 같은 줄.'''


def now():
    return datetime.datetime.now().isoformat(timespec='seconds')


def agy_bin():
    return shutil.which('agy') or os.path.expanduser('~/.local/bin/agy')


def sha(frames):
    return hashlib.sha256(json.dumps({f'{d}{f}': frames[(d, f)] for d in C.DIRS for f in range(3)}, sort_keys=True).encode()).hexdigest()[:16]


# ─────────────────────────────── 뼈대 깔기 ───────────────────────────────
def spare_letters(pal):
    return [c for c in LETTERS if c not in pal]


def seed_workdir(adir, base_key, again=None):
    """작업 폴더에 참고 그림과 (처음이면) 뼈대 아홉 장 txt + palette.json 을 놓는다. again 이 있으면 직전 시도 파일을 이어받는다."""
    pal, frames = H.base_of(base_key)
    if again:
        for f in os.listdir(again):
            if f.endswith('.txt') or f == 'palette.json':
                shutil.copy(os.path.join(again, f), adir)
    else:
        json.dump({k: '#%02x%02x%02x' % v for k, v in pal.items() if v is not None}, open(adir / 'palette.json', 'w'), indent=1)
        for d in SRC_DIRS:
            for f in FRAMES:
                (adir / f'{d}_{f}.txt').write_text('\n'.join(frames[(d, f)]) + '\n')
    pal0, f0 = pal, frames
    # 참고 그림: 뼈대 12프레임 6배(행 = 위·오른쪽·아래·왼쪽, 열 = 걸음 0·1·2)
    plain = Image.new('RGBA', (72, 128), (92, 140, 70, 255))
    plain.alpha_composite(C.sheet_rgba(pal0, f0))
    plain.resize((72 * 6, 128 * 6), Image.NEAREST).convert('RGB').save(adir / 'base_6x.png')
    style = H.HDATA / 'rtp_style_4x.png'
    if not style.exists():
        make_style_sheet(style)
    shutil.copy(style, adir / 'rtp_style_4x.png')
    return pal0, f0


def make_style_sheet(path):
    sel = ['Actor1:0', 'Actor1:4', 'Actor2:0', 'Actor2:2', 'Actor3:0', 'Actor3:6', 'Actor4:0', 'Actor4:3',
           'People1:0', 'People1:2', 'People2:0', 'People3:0', 'People3:6', 'People4:0', 'People4:6', 'People5:2']
    S = 4
    im = Image.new('RGB', (8 * 28 * S, 2 * 36 * S), (92, 140, 70))
    for i, k in enumerate(sel):
        pal, fr = H.base_of(k)
        f = C.frame_rgba(pal, fr[('down', 1)]).resize((24 * S, 32 * S), Image.NEAREST)
        im.paste(f, ((i % 8) * 28 * S + 2 * S, (i // 8) * 36 * S + 2 * S), f)
    im.save(path)


# ─────────────────────────────── 지시 ───────────────────────────────
def prompt(spec, cand, pal, feedback, again):
    rules = '''[걷기 프레임 규칙(하네스가 검사해 어기면 거절한다)]
- 걷기 순서는 0,1,2,1 이다. _1 이 서 있는 그림, _0·_2 가 발을 내디딘 그림이다. 뼈대의 다리·팔 흔들림과 1줄 출렁임을 **그대로 이어받아라**: 몸 위쪽을 새로 그리더라도 다리·발 줄과 몸 출렁임 규칙은 뼈대를 따른다.
- 한 방향의 세 프레임은 같은 머리·옷·장비를 공유한다. 걸음마다 달라지는 것은 팔·다리·소지품 끝뿐이다.'''
    fb = ('\n[지난 시도에서 하네스가 거절한 이유 — 반드시 고쳐라]\n' + '\n'.join('- ' + e for e in feedback) + '\n') if feedback else ''
    free = ' '.join(spare_letters(pal)[:24])
    redo = ('이번에는 이미 네가 고친 파일이 폴더에 있다. 그 위에서 거절 사유만 고쳐라.\n' if again else
            '폴더의 9개 txt 는 뼈대 원본(@base_6x.png 와 같은 그림)이다. 이 위에 **덮어 고쳐 쓴다**.\n')
    return f'''{NO_GEN}

[과제] RPG Maker 2000 CharSet 규격(24×32 프레임)의 걷기 칩 한 명을 새로 그린다. 크로노 트리거·FF6풍 RPG 의 「{spec['name']}」 원형이다.
원작 게임의 실제 캐릭터를 베끼거나 닮게 그리지 않는다. 직업 원형(아키타입)만 독자 디자인으로 그린다.
- 원형 설명: {spec['concept']}
- 이번 후보의 방향: {cand['variant']}
- 공통 규칙: {spec['common']}

@base_6x.png 는 뼈대 원본이다(행 = 위·오른쪽·아래·왼쪽, 열 = 걸음 0·1·2, 6배). @rtp_style_4x.png 는 같은 칩셋의 다른 캐릭터들(4배)이다. 두 그림을 직접 열어 보고 시작해라.
{redo}머리 모양·머리색·옷·장비·색을 새 캐릭터로 바꾸되 몸 비율·머리 크기·팔다리 위치·걷기 동작은 뼈대 그대로 둔다.
창·칼·지팡이처럼 길게 튀어나오는 장비는 몸 옆에 붙여 세로로 두고 가로 24칸 안에 모두 들어오게 한다(옆모습에서 잘리지 않게).

{STYLE}

{rules}

[격자 형식] 파일 이름 → 내용: down_0/1/2.txt(아래=정면), up_0/1/2.txt(위=뒷모습), right_0/1/2.txt(오른쪽을 보는 옆모습). 각 파일 정확히 32줄, 줄마다 정확히 24글자, '.' 은 투명.
왼쪽 방향은 하네스가 right 를 거울로 뒤집어 쓰니 그리지 않는다. 팔레트는 palette.json({{"글자":"#rrggbb"}}, '.' 는 넣지 않고 글자는 한 자)이며 이미 뼈대 색이 들어 있다. 새 색 글자는 쓰이지 않은 이것 중에서 골라 추가하고 안 쓰는 뼈대 색은 지워도 된다: {free}
팔레트의 배경 키 색 #009392(±8)는 쓰지 못한다.
{fb}
[산출물] 위 9개 txt 와 palette.json 을 수정한다. 다 쓴 뒤 txt 들을 PNG(preview.png, 8배 확대, 3열×3행)로 굽는 확인용 스크립트를 돌려 **직접 열어 보고** 얼굴(눈)·직업 표식·세 방향의 일관성·잡티를 최소 한 번 고쳐 다시 써라. 끝나면 'done' 한 단어만 답하라.
'''


def run_agy(cwd, text, label):
    t0 = time.time()
    try:
        r = subprocess.run([agy_bin(), '-p', text, '--model', MODEL, '--output-format', 'text'], cwd=cwd,
                           capture_output=True, text=True, timeout=TIMEOUT)
        out, code = (r.stdout or '') + (r.stderr or ''), r.returncode
    except subprocess.TimeoutExpired:
        out, code = 'timeout', 124
    (Path(cwd) / f'agy-{label}.log').write_text('exit=%s sec=%.0f\n%s' % (code, time.time() - t0, out[-4000:]))
    return code, out


# ─────────────────────────────── 검사 ───────────────────────────────
def parse_hex(v):
    v = v.strip().lstrip('#')
    return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))


def cross_count(rows):
    """디더 잡티 지표: 상하좌우 이웃 둘씩이 서로 같고 자기와는 다른(+ 둘이 서로도 다른) 십자 점."""
    n = 0
    for y in range(1, C.FH - 1):
        for x in range(1, C.FW - 1):
            c = rows[y][x]
            if c == '.':
                continue
            l, r, u, d = rows[y][x - 1], rows[y][x + 1], rows[y - 1][x], rows[y + 1][x]
            if '.' in (l, r, u, d):
                continue
            if l == r and u == d and l != c and u != c and l != u:
                n += 1
    return n


def lone_pixels(rows):
    """주변 8칸이 모두 자기와 다른 색(투명 제외)인 외톨이 점 수."""
    n = 0
    for y in range(1, C.FH - 1):
        for x in range(1, C.FW - 1):
            c = rows[y][x]
            if c == '.':
                continue
            nb = [rows[y + dy][x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dy]
            if all(v != c for v in nb) and all(v != '.' for v in nb):
                n += 1
    return n


def load_attempt(adir, base_key):
    errs, warns = [], []
    try:
        raw = json.load(open(adir / 'palette.json'))
        pal = {k: parse_hex(v) for k, v in raw.items() if k != '.' and len(k) == 1}
    except Exception as e:
        return None, None, ['palette.json 읽기 실패: %s' % e], warns
    frames = {}
    for d in SRC_DIRS:
        for f in FRAMES:
            p = adir / f'{d}_{f}.txt'
            if not p.exists():
                errs.append(f'{d}_{f}.txt 가 없다')
                continue
            rows = [ln.rstrip('\n') for ln in p.read_text(encoding='utf-8').splitlines()]
            while rows and rows[-1] == '':
                rows.pop()
            if len(rows) != C.FH:
                errs.append(f'{d}_{f}.txt: 줄 수 {len(rows)} ({C.FH} 여야 함)')
                continue
            bad = [i + 1 for i, r in enumerate(rows) if len(r) != C.FW]
            if bad:
                errs.append(f'{d}_{f}.txt: 길이가 {C.FW} 가 아닌 줄 {bad[:8]}')
                continue
            unk = sorted({c for r in rows for c in r if c != '.' and c not in pal})
            if unk:
                errs.append(f'{d}_{f}.txt: palette.json 에 없는 글자 {"".join(unk)}')
                continue
            frames[(d, f)] = rows
    if errs:
        return None, None, errs, warns
    for f in FRAMES:  # 왼쪽 = 오른쪽 거울
        frames[('left', f)] = [r[::-1] for r in frames[('right', f)]]
    pal = dict(pal)
    pal['.'] = None
    bpal, bframes = H.base_of(base_key)
    g = C.gate(pal, frames, (bpal, bframes), strength='ctff6')
    for t in g.get('fails', []):
        # 오른쪽의 거울인 왼쪽 프레임은 자동으로 같은 문제를 가지므로 오른쪽만 말해도 되지만 그대로 알린다
        errs.append(t)
    warns += g.get('warns', [])
    if len(pal) - 1 > 40:
        errs.append(f'색 {len(pal) - 1}개 > 40')
    used = {c for rows in frames.values() for r in rows for c in r if c != '.'}
    if len(used) > 40:
        errs.append(f'실제 쓰인 색 {len(used)}개 > 40')
    # 방향 간 색 일관: 아래·위·오른쪽이 같은 사람인가(공통 색 비율)
    def cols(d):
        return {pal[c] for f in FRAMES for r in frames[(d, f)] for c in r if c != '.'}
    cd, cu, cr = cols('down'), cols('up'), cols('right')
    for a_, b_, n_ in ((cd, cu, '아래·위'), (cd, cr, '아래·오른쪽')):
        share = len(a_ & b_) / max(1, min(len(a_), len(b_)))
        if share < 0.55:
            errs.append(f'{n_} 방향의 공통 색이 {share:.0%} 뿐이다 — 방향마다 다른 사람처럼 보인다(같은 머리색·옷색·팔레트 글자를 쓴다)')
    # 같은 방향 세 프레임의 머리 꼭대기 줄(출렁임은 gate 가 보지만 머리 모양이 달라지는 것은 따로)
    for d in SRC_DIRS:
        tops = [min(y for y, r in enumerate(frames[(d, f)]) if any(c != '.' for c in r)) for f in FRAMES]
        if max(tops) - min(tops) > 2:
            errs.append(f'{d} 방향의 머리 꼭대기 줄이 프레임마다 {tops} 로 다르다(차이 2줄 이하)')
    # 디더·외톨이 잡티: 뼈대의 1.6배+여유를 넘으면 거절
    bc = sum(cross_count(bframes[(d, f)]) for d in SRC_DIRS for f in FRAMES)
    bl = sum(lone_pixels(bframes[(d, f)]) for d in SRC_DIRS for f in FRAMES)
    nc = sum(cross_count(frames[(d, f)]) for d in SRC_DIRS for f in FRAMES)
    nl = sum(lone_pixels(frames[(d, f)]) for d in SRC_DIRS for f in FRAMES)
    if nc > bc * 1.6 + 10:
        errs.append(f'디더/체스판 잡티가 {nc}곳이다(뼈대 {bc}곳, 허용 {int(bc * 1.6 + 10)}) — 같은 색을 면으로 모아 칠하고 점 흩뿌림을 없애라')
    if nl > bl * 1.6 + 14:
        errs.append(f'외톨이 점(주변과 전부 다른 색 한 픽셀)이 {nl}개다(뼈대 {bl}개, 허용 {int(bl * 1.6 + 14)}) — 잡티를 지워라')
    # 정면 얼굴: 머리 구역에 눈으로 읽히는 어두운 점 두 개 이상(윤곽선 제외)이 있는가는 눈 검수 몫이라 여기서는 색 수만 본다
    # 아래 방향 서 있는 그림의 머리 구역(꼭대기~+10줄)에서 서로 다른 색이 4개 미만이면 얼굴이 뭉개진 것이다
    rows = frames[('down', 1)]
    top = min(y for y, r in enumerate(rows) if any(c != '.' for c in r))
    head_cols = {rows[y][x] for y in range(top, min(C.FH, top + 11)) for x in range(C.FW) if rows[y][x] != '.'}
    if len(head_cols) < 5:
        errs.append(f'정면 머리 구역에 색이 {len(head_cols)}개뿐이다(최소 5) — 눈·입·머리 명암이 뭉개졌다')
    return (frames if not errs else None), pal, errs, warns


# ─────────────────────────────── 후보 만들기 ───────────────────────────────
def make_candidate(spec, cand, key, run_dir):
    cdir = run_dir / key
    cdir.mkdir(parents=True, exist_ok=True)
    base_key = H.norm_base(cand['base'])
    meta = dict(key=key, arch=spec['id'], base=base_key, variant=cand['variant'], model=MODEL, effort='medium', attempts=[])
    feedback, prev = [], None
    for n in range(1, MAX_ATTEMPTS + 1):
        adir = cdir / 'attempts' / str(n)
        adir.mkdir(parents=True, exist_ok=True)
        seed_workdir(adir, base_key, prev)
        pal0, _ = H.base_of(base_key)
        code, out = run_agy(adir, prompt(spec, cand, pal0, feedback, bool(prev)), f'try{n}')
        frames, pal, errs, warns = load_attempt(adir, base_key)
        meta['attempts'].append(dict(n=n, agy_exit=code, errors=errs, warnings=warns, at=now()))
        (cdir / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
        if frames:
            used = sorted({c for rows in frames.values() for r in rows for c in r if c != '.'}, key=lambda c: pal[c])
            pal2 = {'.': None, **{c: pal[c] for c in used}}
            (cdir / 'chip.chr.txt').write_text(C.dump(pal2, {}, frames, header=f'{key} — {spec["name"]} / {cand["variant"]}\n{MODEL}'))
            C.sheet_rgba(pal2, frames).save(cdir / 'chip.png')
            meta.update(ok=True, sha=sha(frames), warnings=warns)
            (cdir / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
            return meta
        feedback, prev = errs, adir
        if code == 124 or (code != 0 and not any((adir / f'{d}_{f}.txt').exists() for d in SRC_DIRS for f in FRAMES)):
            time.sleep(BACKOFF[min(n - 1, len(BACKOFF) - 1)])  # 제공자 오류·한도 → 백오프
        elif n < MAX_ATTEMPTS:
            time.sleep(10)
    meta['ok'] = False
    (cdir / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    return meta


def load_spec(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def cmd_draw(a):
    spec = load_spec(a.spec)
    run = a.run or datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '-argon'
    run_dir = OUT / run
    run_dir.mkdir(parents=True, exist_ok=True)
    jobs = []
    for arch in spec['archetypes']:
        if a.only and arch['id'] not in a.only:
            continue
        arch = dict(arch, common=spec['common'])
        for i, cand in enumerate(arch['candidates']):
            jobs.append((arch, cand, f'{arch["id"]}-{"abcdefgh"[i]}'))
    if a.label:
        jobs = [j for j in jobs if j[2] in a.label]
    print('run', run, '주문', [j[2] for j in jobs], '모델', MODEL, '동시', a.par, flush=True)
    with ThreadPoolExecutor(max_workers=max(1, min(a.par, 2))) as ex:
        res = list(ex.map(lambda j: make_candidate(j[0], j[1], j[2], run_dir), jobs))
    for m in res:
        print(m['key'], 'OK' if m.get('ok') else 'FAIL', [len(t['errors']) for t in m['attempts']], flush=True)
    print(run)


# ─────────────────────────────── 시트 ───────────────────────────────
def gif_b64(pal, frames, scale):
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / 'w.gif'
        C.gif_walk(pal, frames, out, scale=scale, lawn=None, ms=170)
        return base64.b64encode(out.read_bytes()).decode()


def png_b64(im):
    b = io.BytesIO()
    im.save(b, 'PNG')
    return base64.b64encode(b.getvalue()).decode()


def cmd_sheet(a):
    spec = load_spec(a.spec)
    names = {x['id']: x for x in spec['archetypes']}
    order = [x['id'] for x in spec['archetypes']]
    notes = dict(n.split('=', 1) for n in a.note)
    items = []
    for run in a.runs:
        rd = OUT / run
        for cd in sorted(rd.iterdir()):
            if (cd / 'chip.chr.txt').exists() and (cd / 'meta.json').exists():
                items.append((run, cd))
    groups = {}
    for run, cd in items:
        meta = json.loads((cd / 'meta.json').read_text())
        groups.setdefault(meta['arch'], []).append((run, cd, meta))
    base_cache = {}
    sections = []
    for arch in sorted(groups, key=lambda x: order.index(x) if x in order else 99):
        info = names.get(arch, {})
        cards = []
        for run, cd, meta in sorted(groups[arch], key=lambda t: t[2]['key']):
            pal, _, frames = C.load(cd / 'chip.chr.txt')
            bk = meta['base']
            if bk not in base_cache:
                bp, bf = H.base_of(bk)
                base_cache[bk] = (gif_b64(bp, bf, 2), gif_b64(bp, bf, 8))
            ctx = C.context(pal, frames, H.ACTOR1, scale=4, lawn=None, others=(0, 1, 3, 6))
            f12 = C.sheet_big(pal, frames, scale=6)
            cull = meta['key'] in a.cull
            card = (f'<div class="card{" cull" if cull else ""}" id="{html.escape(meta["key"])}"><div class="id">{html.escape(meta["key"])} '
                    f'<small>뼈대 {html.escape(H.base_label(bk))} · {meta["model"]} {meta["effort"]} · 시도 {len(meta["attempts"])}회</small></div>'
                    f'<p class="var">{html.escape(meta["variant"])}</p>'
                    f'<div class="cmp"><figure><img src="data:image/gif;base64,{base_cache[bk][0]}"><figcaption>뼈대 원본 2×</figcaption></figure>'
                    f'<figure><img src="data:image/gif;base64,{gif_b64(pal, frames, 2)}"><figcaption>후보 2× (위·오른쪽·아래·왼쪽)</figcaption></figure>'
                    f'<figure><img src="data:image/png;base64,{png_b64(ctx)}"><figcaption>Actor1 옆 비교 4× (Actor1 4명 → 후보 아래·왼쪽·위·오른쪽 서 있는 그림)</figcaption></figure></div>'
                    f'<img class="big" src="data:image/gif;base64,{gif_b64(pal, frames, 8)}"><div class="cap">후보 8× 걷기</div>'
                    f'<details><summary>12프레임 6× 시트 · 뼈대 8× 걷기</summary><img class="big" src="data:image/png;base64,{png_b64(f12)}">'
                    f'<img class="big" src="data:image/gif;base64,{base_cache[bk][1]}"></details>'
                    + (f'<p class="note">눈 검수 소견: {html.escape(notes[meta["key"]])}</p>' if meta['key'] in notes else '') + '</div>')
            cards.append(card)
        sections.append(f'<h2>{html.escape(info.get("name", arch))} <small>{html.escape(arch)} · {html.escape(info.get("genre", ""))}</small></h2>'
                        f'<p class="concept">{html.escape(info.get("concept", ""))}</p><div class="row">{"".join(cards)}</div>')
    page = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>CT·FF6 걷기 칩 파일럿 (Argon medium)</title>
<style>body{{background:#161a1d;color:#e6e6e6;font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px 32px}}
h1{{margin:0 0 6px}}h2{{margin:36px 0 2px;border-bottom:1px solid #3a4248;padding-bottom:4px}}small{{color:#8fa0aa;font-weight:400;font-size:13px}}
.how{{background:#1f272c;border:1px solid #3a4a55;border-radius:8px;padding:14px 18px;margin:12px 0 8px;max-width:1000px}}
.how code{{background:#0e1214;padding:1px 6px;border-radius:4px}}.concept{{color:#aab6bd;margin:2px 0 10px;max-width:1000px}}
.row{{display:flex;flex-direction:column;gap:18px}}.card{{background:#1d2328;border:1px solid #333c43;border-radius:8px;padding:12px;width:1000px}}
.id{{font:600 16px ui-monospace,monospace;color:#ffd479;margin-bottom:2px}}.var{{color:#9fb0ba;margin:2px 0 8px;font-size:13px}}.cmp{{display:flex;gap:16px;margin-bottom:8px;align-items:flex-end;flex-wrap:wrap}}figure{{margin:0}}
figcaption,.cap{{color:#8fa0aa;font-size:12px}}img{{image-rendering:pixelated}}.big{{display:block;max-width:100%;margin:6px 0}}details{{margin-top:8px}}.note{{color:#e8b86d;font-size:13px;margin:4px 0 0}}.cull{{opacity:.55}}</style>
<h1>CT·FF6 걷기 칩 파일럿 — 저작 모델 Agy gemini-4-argon-medium</h1>
<div class="how"><b>고르는 방법</b><br>마음에 드는 후보의 <code>id</code>(노란 글씨, 예: <code>tt-hero-boy-b</code>)를 채팅에 적어 주세요. 방향이 아니라 다른 화풍이 필요하면 그렇게 말해 주세요.<br>
이번 판은 <b>원형 2종만</b>의 파일럿입니다. 방향을 보신 뒤에 나머지 7종을 돌립니다. 직전 판(GPT 6.1 sol)은 폐기했습니다.<br>
<b>고르기 전에는 팩·번들·프로젝트에 설치하지 않습니다.</b> 왼쪽 방향은 오른쪽의 거울입니다. 사람 캐릭터라 3/4 관문(object-gate) 영수증은 없습니다. 후보 {sum(len(v) for v in groups.values())}종 · 실행 {html.escape(", ".join(a.runs))}</div>
{"".join(sections)}</html>'''
    out = Path(a.out).expanduser()
    out.write_text(page, encoding='utf-8')
    print(out, sum(len(v) for v in groups.values()), '종', len(page), 'bytes')


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    d = sub.add_parser('draw')
    d.add_argument('--spec', required=True)
    d.add_argument('--only', action='append')
    d.add_argument('--label', action='append', help='후보 key(예: tt-hero-boy-b)만')
    d.add_argument('--par', type=int, default=2)
    d.add_argument('--run')
    d.set_defaults(fn=cmd_draw)
    s = sub.add_parser('sheet')
    s.add_argument('runs', nargs='+')
    s.add_argument('--spec', required=True)
    s.add_argument('--out', required=True)
    s.add_argument('--note', action='append', default=[])
    s.add_argument('--cull', nargs='*', default=[])
    s.set_defaults(fn=cmd_sheet)
    a = ap.parse_args()
    a.fn(a)


if __name__ == '__main__':
    main()
