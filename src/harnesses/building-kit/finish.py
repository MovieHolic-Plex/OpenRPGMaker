"""building-kit 마감(finish) — 조립 관문을 모두 통과한 건물마다 새 Opus 5.5 high 프로세스가 손으로 질감·디테일을 더한다.

`finish <테마> <판> --line X [--building id] [--jobs N] [--cmd "…"]`

사용자(2026-10-22, style-r7 ㅜ자 집을 버들항 여관 옆에 놓고): 「전보다 훨씬 낫다. 그래도 버들항 수준은 아니다」 → 고른 길:
**조립 뒤 마감 단계** — 조립된 건물 한 채씩 Opus 5.5 high 가 손으로 질감·디테일을 더한다. 본 차이: 버들항 기와는 낱장마다
모양·밝기가 다르고 빛 받는 모임 사선에 밝은 선이 있다 · 회벽에 고운 점묘 · 1층은 불규칙한 막돌 · 창에 꽃상자와 하늘색 유리
반짝임 · 문은 아치에 징 · 걸린 간판. 우리 것은 16px 마다 같은 기와·벽돌 도장이 반복되고 면이 평평하고 검은 윤곽이 무겁다.

샌드박스(`<RUNS>/finisher/<테마>/<판>/<후보>.<건물>/`):
  base.png · mask.png       조립 건물(그림자 포함)과 그 알파
  pixels.txt · legend.json  팔레트 글자 격자(글자 하나 = 화소 하나, '.' 투명, '~' 바닥 그림자) — 그림자 밑 벽은 원래 색 글자
  shade.png · regions.png · regions.json   다시 얹을 그림자 자리 · 지붕(1)/벽(2)/기타(3) 영역 · 문 칸·처마 글자·문턱 값
  refs/                     테마 버들항 기준 그림 1배·4배, 팔레트 견본, compare.png(기준 | 이 건물 4배, detail-cmp 형식)
  finish_lib.py · check.py  고치는 도구와 검사 (a)~(g) — finish_kit/ 의 원본 사본
  BRIEF.md                  할 일(한국어)
에이전트는 finish_draw.py 를 쓰고 `python3 finish_draw.py && python3 check.py` 를 되풀이한다.

하네스는 에이전트의 말이나 샌드박스의 finished.png 를 믿지 않는다: 지금 조립에서 새로 만든 깨끗한 입력 + 원본 check.py 가 든
임시 폴더에서 에이전트의 finish_draw.py 를 다시 돌리고, 그 출력이 에이전트의 finished.png 와 화소까지 같은지 보고, 원본
check.py 를 다시 돌린다. 결과 `<RUNS>/<테마>/<판>/finished/<후보>.<건물>.png|.json|.finish_draw.py`(바탕 해시·마감 해시·검사 결과).
마감 검사 통과는 합격이 아니다 — review/sheet/village/pick 의 `--finished` 가 마감 그림(그 해시)으로 같은 길을 다시 간다.
"""
import concurrent.futures
import datetime
import hashlib
import json
import os
import shlex
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

import assemble as AS  # noqa: E402
import beodeul  # noqa: E402
import dot  # noqa: E402

KIT = os.path.join(HERE, 'finish_kit')
DEFAULT_TIMEOUT = int(os.environ.get('BUILDING_KIT_FINISH_TIMEOUT', '5400'))
# 사용자 요구(2026-10-22): 마감은 Opus 5.5 high. 환경 변수로만 바꾼다.
MODEL = os.environ.get('BUILDING_KIT_FINISH_MODEL', 'claude-opus-5-5')
EFFORT = os.environ.get('BUILDING_KIT_FINISH_EFFORT', 'high')
RERUN_TIMEOUT = 300
MIN_CHANGED = 0.12
DOOR_KEEP = 0.90
STEP_ROWS = 3
MIN_ITERATIONS = 4
LEAF_RAMPS = ('wood', 'timber', 'iron')
STEP_RAMPS = ('stone', 'cobble', 'ashlar')
WALL_KINDS = ('wall', 'band', 'base')
CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*+=?<>^/|:;,_-'
TOOLS = 'Read,Write,Edit,Bash(python3:*)'
SCHEMA = 'oprn-building-kit-finish/1'


def now():
    return datetime.datetime.now().isoformat(timespec='seconds')


def sandbox_root():
    return os.environ.get('BUILDING_KIT_FINISH_DIR') or os.path.join(dot.RUNS, 'finisher')


def out_dir(theme, rid):
    return os.path.join(dot.RUNS, theme, rid, 'finished')


def legend(theme):
    pal = dot.palette(theme)
    chars, ramps, by_hex = {}, {}, {}

    def char_for(hx, name):
        hx = hx.lower()
        if hx not in by_hex:
            if len(by_hex) >= len(CHARS):
                raise SystemExit(f'{theme}: 팔레트 색이 {len(CHARS)}개를 넘는다 — 범례 글자가 모자란다')
            by_hex[hx] = CHARS[len(by_hex)]
            chars[by_hex[hx]] = {'hex': hx, 'names': []}
        if name:
            chars[by_hex[hx]]['names'].append(name)
        return by_hex[hx]

    for name, cols in pal['ramps'].items():
        ramps[name] = [char_for(c, f'{name}{i}') for i, c in enumerate(cols)]
    for c in pal['allowed']:
        char_for(c, None)
    return {'transparent': '.', 'shadow': {'char': '~', 'rgb': list(AS.SHADOW_RGB), 'alpha': int(AS.SHADOW_ALPHA)},
            'chars': chars, 'ramps': ramps}


def _rgb_to_char(leg):
    return {tuple(int(v['hex'][i:i + 2], 16) for i in (1, 3, 5)): ch for ch, v in leg['chars'].items()}


def _unshade_map(leg):
    k = leg['shadow']['alpha'] / 255.0
    out = {}
    for rgb, ch in _rgb_to_char(leg).items():
        s = tuple(int(v) for v in np.round(np.asarray(rgb, float) * (1 - k) + np.array(leg['shadow']['rgb'], float) * k))
        out.setdefault(s, ch)
    return out


def char_grid(res, leg):
    """조립 결과 → 글자 격자. 그림자 밑 불투명 화소는 그림자를 걷어 낸 원래 팔레트 글자."""
    a = np.array(res['img'].img())
    shadow = res.get('shadow')
    shadow = shadow if shadow is not None else np.zeros(a.shape[:2], bool)
    plain, unshade = _rgb_to_char(leg), _unshade_map(leg)
    sh_rgb, sh_a = tuple(leg['shadow']['rgb']), leg['shadow']['alpha']
    rows = []
    for y in range(a.shape[0]):
        row = []
        for x in range(a.shape[1]):
            al, rgb = int(a[y, x, 3]), tuple(int(v) for v in a[y, x, :3])
            if al == 0:
                row.append('.')
            elif al == sh_a and rgb == sh_rgb:
                row.append('~')
            elif al == 255:
                ch = (unshade if shadow[y, x] else plain).get(rgb)
                if ch is None:
                    raise SystemExit(f'조립 그림 ({x}, {y}) 색 {rgb} 이 팔레트(그림자 포함)로 풀리지 않는다')
                row.append(ch)
            else:
                raise SystemExit(f'조립 그림 ({x}, {y}) 알파 {al} — 그림자 하나 말고 반투명이 있다')
        rows.append(''.join(row))
    return rows


def regions(res, leg, rows, ref_name=None):
    """지붕/벽 영역 마스크, 지붕 글자 집합, 문 칸, 문턱 램프, 기준값."""
    a = np.array(res['img'].img())
    kind = res['owner_kind']
    op = a[:, :, 3] == 255
    roof = op & (kind == 'roof')
    wall = op & np.isin(kind, WALL_KINDS)
    regm = np.zeros(op.shape, np.uint8)
    regm[op] = 3
    regm[wall] = 2
    regm[roof] = 1
    counts = {}
    for y, x in zip(*np.nonzero(roof | wall)):
        c = counts.setdefault(rows[y][x], [0, 0])
        c[0 if roof[y, x] else 1] += 1
    ramp_votes = {}
    for ch, (r, w) in counts.items():
        for n in leg['chars'][ch]['names']:
            v = ramp_votes.setdefault(n.rstrip('0123456789'), [0, 0])
            v[0] += r
            v[1] += w
    roofish = {rp for rp, (r, w) in ramp_votes.items() if r > w}
    roof_chars = []
    for ch, info in leg['chars'].items():
        if ch in counts:
            if counts[ch][0] > counts[ch][1]:
                roof_chars.append(ch)
        else:
            rps = {n.rstrip('0123456789') for n in info['names']}
            if rps and rps <= roofish:
                roof_chars.append(ch)
    pal_ramps = set(leg['ramps'])
    leaf = sorted(set(LEAF_RAMPS) & pal_ramps)
    doors = []
    for p in res['pieces']:
        if p.get('role') != 'd':
            continue
        x0, y0 = p['at'][0] * dot.T, p['at'][1] * dot.T
        w, h = p['size'][0] * dot.T, p['size'][1] * dot.T
        present = set()
        for y in range(y0, min(y0 + h, len(rows))):
            for x in range(x0, min(x0 + w, len(rows[0]))):
                ch = rows[y][x]
                if ch in leg['chars']:
                    present |= {n.rstrip('0123456789') for n in leg['chars'][ch]['names']}
        doors.append({'px': [x0, y0, w, h], 'allowedRamps': sorted(present | set(leaf)),
                      'stepRamps': sorted(set(STEP_RAMPS) & pal_ramps), 'stepRows': STEP_ROWS})
    return regm, {
        'size': [a.shape[1], a.shape[0]], 'roofChars': sorted(roof_chars), 'doorRects': doors, 'doorLeafRamps': leaf,
        'doorKeep': DOOR_KEEP, 'minChanged': MIN_CHANGED, 'minIterations': MIN_ITERATIONS,
        'pixelsSha256': hashlib.sha256(('\n'.join(rows) + '\n').encode()).hexdigest(),
        'compareRef': f'refs/{ref_name}-1x.png' if ref_name else None,
        'regionCodes': {'0': '투명', '1': '지붕(roof 조각)', '2': '벽·층 띠·기단', '3': '그 밖(굴뚝 등)'},
    }


def ref_for(theme, recipe):
    refs = dot.seed(theme).get('refs') or []
    use = recipe.get('use')
    hit = next((r for r in refs if r.get('use') == use), None)
    return hit or next((r for r in refs if r.get('kit') == 'bd-house-inn'), None) or (refs[0] if refs else None)


def write_inputs(dest, theme, item):
    """깨끗한 마감 입력(그림·격자·범례·영역·도구). 샌드박스와 하네스 재검사가 같은 함수를 쓴다."""
    os.makedirs(dest, exist_ok=True)
    res = item['res']
    leg = legend(theme)
    rows = char_grid(res, leg)
    ref = ref_for(theme, item['recipe'])
    regm, reg = regions(res, leg, rows, beodeul.ref_name(ref) if ref else None)
    img = res['img'].img()
    img.save(os.path.join(dest, 'base.png'))
    Image.fromarray(np.array(img)[:, :, 3], 'L').save(os.path.join(dest, 'mask.png'))
    shadow = res.get('shadow')
    shade = (shadow if shadow is not None else np.zeros(regm.shape, bool)) & (np.array(img)[:, :, 3] == 255)
    Image.fromarray((shade * 255).astype(np.uint8), 'L').save(os.path.join(dest, 'shade.png'))
    Image.fromarray(regm, 'L').save(os.path.join(dest, 'regions.png'))
    open(os.path.join(dest, 'pixels.txt'), 'w', encoding='utf-8').write('\n'.join(rows) + '\n')
    json.dump(leg, open(os.path.join(dest, 'legend.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(reg, open(os.path.join(dest, 'regions.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for f in ('finish_lib.py', 'check.py'):
        shutil.copy(os.path.join(KIT, f), os.path.join(dest, f))
    if ref:
        d = os.path.join(dest, 'refs')
        os.makedirs(d, exist_ok=True)
        rim = beodeul.ref_image(ref).img()
        rim.save(os.path.join(d, f'{beodeul.ref_name(ref)}-1x.png'))
    return {'legend': leg, 'regions': reg, 'rows': rows, 'ref': ref, 'baseSha256': dot.image_hash(img)}


def _lib():
    import importlib.util
    spec = importlib.util.spec_from_file_location('bk_finish_lib_tpl', os.path.join(KIT, 'finish_lib.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def write_refs(dest, theme, item):
    """테마의 버들항 기준 그림 1배·4배 · 팔레트 견본 · compare.png(기준 | 이 건물, 같은 4배)."""
    import drawer
    d = os.path.join(dest, 'refs')
    os.makedirs(d, exist_ok=True)
    names = []
    for ref in dot.seed(theme).get('refs') or []:
        try:
            im = beodeul.ref_image(ref).img()
        except SystemExit:
            continue
        name = beodeul.ref_name(ref)
        im.save(os.path.join(d, f'{name}-1x.png'))
        im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(d, f'{name}-4x.png'))
        names.append((name, ref))
    drawer.palette_swatch(theme).save(os.path.join(d, 'palette.png'))
    base = item['res']['img'].img()
    lib = _lib()
    ref = ref_for(theme, item['recipe'])
    files = []
    if ref:
        lib.compare_row([beodeul.ref_image(ref).img(), base]).save(os.path.join(d, 'compare.png'))
        files.append(('refs/compare.png', f'{beodeul.ref_name(ref)} | 이 건물(바탕) — 4배, 풀 땅 위 바닥 맞춤'))
        if ref.get('kit') != 'bd-house-inn':
            inn = next((r for _, r in names if r.get('kit') == 'bd-house-inn'), None)
            if inn:
                lib.compare_row([beodeul.ref_image(inn).img(), base]).save(os.path.join(d, 'compare-inn.png'))
                files.append(('refs/compare-inn.png', '버들항 광장 여관 | 이 건물 — 사용자가 본 비교(detail-cmp)'))
    return names, files


THEME_NOTES = {
    'fantasy-kingdom': [
        '붉은 테라코타 기와(roof 램프): 낱장마다 모양(아래 끝 둥금/각짐·폭 3~5px)과 밝기(단 1~3)를 섞어 16px 반복을 없앤다.',
        '반목조 회벽(plaster): 고운 점묘 — 한 화소짜리 어두운 단 점을 고르지 않게(무늬 간격이 되풀이되지 않게) 손으로 찍는다.',
        '목조(timber): 나뭇결 — 기둥·보에 한 화소 밝은 결 선과 옹이 한두 개, 이음부 어두운 점.',
        '1층 마름돌(ashlar·stone)은 크기가 다른 막돌로 — 돌마다 윗변 밝은 단 한 줄, 아랫변 어두운 단, 줄눈 굵기 들쭉날쭉.',
    ],
    'northern-snow': [
        '눈 덩이: 처마·창턱·통·상자 윗면에 snow 램프 밝은 단 불규칙 덩어리(실루엣 안에서만 — 윤곽은 못 바꾼다).',
        '나무 판자벽은 판자마다 길이·밝기가 다르게, 이음 못 자리 어두운 점.',
        '지붕 너와/슬레이트는 낱장 모양을 섞고, 빛 받는 왼쪽 사면에 밝은 선.',
    ],
    'desert-oasis': [
        '흙벽: 고운 점묘와 갈라진 금 몇 줄, 벽 아래쪽 흙탕 얼룩(어두운 단).',
        '평지붕 난간: 돌·벽돌 크기를 섞고 윗면에 밝은 선.',
        '천 차양·나무 들보 끝은 실루엣 안에서만.',
    ],
    'beodeul-noble': [
        '청석·테라코타 기와의 낱장 변화와 모임 사선 밝은 선.',
        '마름돌 벽은 돌마다 크기·밝기 변화, 창틀 돌 장식.',
    ],
}

USE_NOTES = {
    'home': '살림집 — 창 아래 꽃상자(꽃 한두 화소 색은 팔레트 안), 문 옆 벽에 붙은 나무통·장작(실루엣 안), 벽 타고 오르는 담쟁이.',
    'inn': '여관 — 글자 없는 간판 받침(쇠 받침대 + 나무판), 문 옆 등불, 술통.',
    'smithy': '대장간 — 굴뚝·처마 둘레 그을음, 쇠 장식, 벽에 붙은 나무 상자.',
    'guild': '길드 — 문 위 문장 판(글자 없음), 등불 한 쌍.',
    'church': '교회 — 아치창 돌 테두리, 종 아래 그늘.',
    'hall': '회관 — 문 위 돌 아치, 기둥 받침돌, 깃발 걸이(실루엣 안).',
}


def legend_table(leg):
    lines = []
    for name, chars in leg['ramps'].items():
        lines.append(f'  {name:8} ' + ' '.join(f'{i}:{c}' for i, c in enumerate(chars)) + '   (단 0 = 가장 어두움)')
    return '\n'.join(lines)


def brief(theme, rid, item, meta, ref_files):
    s = dot.seed(theme)
    line = item['key'][0]
    info = (s.get('lines') or {}).get(line) or {}
    recipe = item['recipe']
    reg = meta['regions']
    w, h = reg['size']
    kit = item['res']['kit']
    masses = '\n'.join(f'  - 질량 {m["id"]}: 칸 x={m["x"]} 폭 {m["cols"]} · 화면 위 {m["top"]}칸 ~ 땅 {m["ground"]}칸 · depth {m["depth"]}'
                       f' · 지붕 {m["roof"]} · 벽 {", ".join(m["walls"])}' for m in kit['masses'])
    doors = '\n'.join(f'  - 문 칸 화소 x={d["px"][0]}..{d["px"][0] + d["px"][2] - 1}, y={d["px"][1]}..{d["px"][1] + d["px"][3] - 1}'
                      f' — 재질 램프 {"·".join(d["allowedRamps"])} (맨 아래 {d["stepRows"]}행은 문턱 {"·".join(d["stepRamps"])} 도 됨)'
                      for d in reg['doorRects']) or '  - (문 칸 없음)'
    theme_notes = '\n'.join(f'- {t}' for t in THEME_NOTES.get(theme, []))
    refs = '\n'.join(f'  - {p} — {why}' for p, why in ref_files)
    return f"""# building-kit 마감 — {s['theme']['name']} · 판 {rid} · 줄 {line} · {item['bid']}

너는 이미 조립된 16px 3/4 탑뷰 건물 한 채({recipe.get('title', recipe['id'])}, 쓰임 {recipe.get('use', '')})에 **손으로 질감과 디테일을 더한다**.
윤곽·지붕 모양·투영은 끝났다. 할 일은 화소 단위 마감 하나다. 사람이 나중에 시트에서 고른다. 생성 이미지·트레이스 금지, 사람(캐릭터) 금지.

## 왜 — 사용자 판정(2026-10-22)
style-r7 ㅜ자 집을 버들항 광장 여관 옆에 놓고: 「전보다 훨씬 낫다. 그래도 버들항 수준은 아니다」. 차이:
- 버들항 기와는 **낱장마다 모양·밝기가 다르고**, 빛 받는 모임 사선을 따라 **밝은 선**이 있다. 우리 것은 16px 마다 같은 기와 도장이 반복된다.
- 버들항 회벽에는 **고운 점묘**가 있다. 우리 것은 면이 평평하다.
- 버들항 1층은 **불규칙한 막돌**이다. 우리 것은 같은 벽돌 도장이 되풀이된다.
- 버들항 창에는 **창턱·꽃상자**와 **하늘색 유리 반짝임**이 있다. 우리 창은 짙은 남색 네모뿐이다.
- 버들항 문은 **아치에 징**이 박혔다. 걸린 **간판**(글자 없음)이 있다.
- 우리 것은 **검은 윤곽이 무겁다** — 윤곽은 그 재질의 가장 어두운 단으로 바꿔 가볍게 한다(윤곽 화소 자리 자체는 그대로).

## 이 건물에 더할 것
- **지붕**: 기와 낱장마다 모양(아래 끝 둥금/각짐·폭)과 밝기를 바꿔 16px 반복을 없앤다 · 빛 받는(왼쪽 위) 사선·박공 가장자리를 따라
  밝은 하이라이트 선 한 줄 · 용마루 덮개(ridge cap) 기와 · 처마 끝 그늘은 지붕 재질의 어두운 단.
- **벽**: 회벽 점묘 · 목조 나뭇결 · 막돌/벽돌 크기·줄눈 변화(돌마다 윗변 밝게, 아랫변 어둡게) · 모서리·아래쪽 때.
- **창**: 창턱(돌·나무), 덧문, 꽃상자, 유리에 한두 화소 밝은 반짝임(지금 창유리 화소가 쓰는 램프의 가장 밝은 단 —
  pixels.txt 에서 창 글자를 보고 names() 로 램프를 확인한다. 팔레트 밖 하늘색은 없다).
- **문**: 아치(문짝 위 귀퉁이를 테두리 재질로), 쇠 징·경첩, 문턱 돌. 문짝 화소의 {int(DOOR_KEEP * 100)}% 이상은 문짝 램프(wood·timber·iron)로 남는다.
- **이야기 소품**(실루엣 안에서만 — 투명 자리에는 못 찍는다): {USE_NOTES.get(recipe.get('use'), USE_NOTES['home'])}
  벽에 붙은 통·상자, 담쟁이, 등불, 글자 없는 간판 받침.
- **풍화**: 굴뚝 둘레 그을음(어두운 단 점), 처마 아래 빗물 얼룩.
- 빛은 **왼쪽 위**. **테마 팔레트 글자만** 쓴다(범례 아래).
{theme_notes}

## 줄 {line} — {info.get('name', '')}
{info.get('concept', '')}

## 그림 — Read 로 연다(눈으로만 본다, 화소 베끼기 금지)
  - base.png — 지금 건물 1배 ({w}×{h}px) · refs/palette.png — 팔레트 견본
{refs}
  - refs/<기준>-1x.png · -4x.png — 테마의 버들항 기준 건물들
  - 고칠 때마다 생기는 것: preview/finished-4x.png(마감 4배) · preview/compare.png(기준 | 바탕 | 마감, 같은 4배)

## 건물 구조(칸 = 16px)
{masses}
{doors}
- regions.png: 1 = 지붕 조각 화소, 2 = 벽·층 띠·기단, 3 = 그 밖(굴뚝 등). (g) 반복 측정은 1·2 영역에서 한다.

## 범례 — pixels.txt 글자 하나 = 화소 하나
- 좌표: pixels.txt 의 n 번째 줄(1부터) = y n-1, 줄 안 글자 자리(0부터) = x. 왼쪽 위가 (0, 0).
- '.' 투명(못 바꾼다) · '~' 바닥 그림자(못 바꾼다). 그림자가 얹힌 벽(shade.png)도 원래 색 글자로 적혀 있고, save() 가 그림자를 다시 얹는다.
- 램프별 글자 (finish_lib.L('roof', 2) 처럼 고른다):
{legend_table(meta['legend'])}

## 쓰는 법
1. `finish_draw.py` 를 쓴다. 꼴:
   ```python
   from finish_lib import load, L, put, row, block, get, names, save
   px = load()                      # pixels.txt 사본(고칠 격자)
   a, b = L('roof', 1), L('roof', 3)
   row(px, 20, 31, f'{{a}}{{b}} {{b}}')    # (20,31) 부터 오른쪽으로 — 공백은 그대로 둔다
   block(px, 40, 100, ['ab', ' a'])  # 여러 줄
   for x, y in [(3, 4), (9, 4)]:    # 짧은 반복은 명시 좌표 목록만
       put(px, x, y, b)
   save(px)                         # finished.png · preview/*
   ```
2. `python3 finish_draw.py && python3 check.py` — check.py 의 (a)~(g) 수치를 보고 고친다.
3. **고칠 때마다 preview/finished-4x.png 와 preview/compare.png 를 Read 로 열어 본다.** 최소 {MIN_ITERATIONS}번 되풀이한다(지붕 → 벽 → 창·문 → 소품·풍화 → 전체 다듬기).
4. 끝나면 한 줄로 무엇을 더했고 아직 버들항보다 모자란 곳이 어디인지 적는다.

## check.py 가 보는 것 (하네스가 깨끗한 사본으로 finish_draw.py 와 check.py 를 다시 돌린다 — 네 말은 믿지 않는다)
- (a) 알파 = mask.png (윤곽 한 화소도 못 바꾼다)
- (b) 문 칸 재질 · 문짝 화소 {int(DOOR_KEEP * 100)}% 이상 문짝 램프
- (c) 팔레트 글자만(그림자는 save 가 얹는 하나)
- (d) 지붕→벽 처마 경계가 ±1px 안에 남는다(투영이 밀리지 않는다)
- (e) finish_draw.py 코드: `import finish_lib` 만 허용(random·numpy·noise·math·os 금지) · while·lambda·`%`·비트 연산 금지 ·
  반복은 한 겹, 명시 좌표 목록 또는 {16} 이하 상수 range 만 · 문자열 반복('a'*n)은 상수 16 이하 · 식으로 넓은 면 채우기 금지 —
  고침은 명시 좌표·행 문자열로
- (f) 불투명 화소의 {int(MIN_CHANGED * 100)}% 이상이 바뀐다
- (g) 지붕·벽 영역의 16px 자기상관이 바탕보다 낮아진다(숫자가 찍힌다)
- pixels.txt·check.py·finish_lib.py 는 고치지 않는다 — 하네스는 원본으로 다시 돌린다. finished.png 를 다른 방법으로 쓰면 재실행 결과와 달라 FAIL 이다.
"""


def eligible(theme, rid, line, building=None, parts_by_key=None):
    """그 줄 후보 키마다 판 레시피를 조립해 조립 관문(A1~A15)을 모두 통과한 건물만."""
    import harness
    if parts_by_key is None:
        _, rendered = harness.render_round(theme, rid)
        keys = sorted({k for c in rendered.values() for k in c})
        parts_by_key = {k: harness.parts_for(theme, rid, k, rendered) for k in keys}
    out, skipped = [], []
    for key in sorted(parts_by_key):
        if key[0] != line:
            continue
        for recipe in AS.round_buildings(theme, rid):
            bid = f'{key}.{recipe["id"]}'
            if building and building not in (recipe['id'], bid):
                continue
            res = AS.assemble(recipe, parts_by_key[key], dot.palette(theme), theme)
            if res['img'] is None:
                skipped.append((bid, f'needs drawing: {", ".join(res["needsDrawing"])}' if res.get('needsDrawing') else '조립 불가'))
                continue
            bad = AS.run_checks(res)
            if bad:
                skipped.append((bid, ' · '.join(f'{c["code"]}' for c in bad)))
                continue
            out.append({'bid': bid, 'key': key, 'line': line, 'recipe': recipe, 'res': res, 'parts': parts_by_key[key]})
    return out, skipped


def sandbox_for(theme, rid, item):
    path = os.path.join(sandbox_root(), theme, rid, item['bid'])
    shutil.rmtree(path, ignore_errors=True)
    meta = write_inputs(path, theme, item)
    _, ref_files = write_refs(path, theme, item)
    text = brief(theme, rid, item, meta, ref_files)
    open(os.path.join(path, 'BRIEF.md'), 'w', encoding='utf-8').write(text)
    json.dump({'theme': theme, 'round': rid, 'building': item['bid'], 'baseSha256': meta['baseSha256'], 'at': now()},
              open(os.path.join(path, 'finish.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return path, meta, text


def claude_command(sandbox):
    import drawer
    return drawer.claude_command(sandbox, model=MODEL, effort=EFFORT, tools=TOOLS)


def recheck(theme, item, sandbox):
    """에이전트 말을 믿지 않는다: 지금 조립에서 만든 깨끗한 입력 + 원본 check.py 로 finish_draw.py 를 다시 돌린다."""
    out = {'reproduced': False, 'agentFinishedSha256': None, 'finishedSha256': None, 'check': None, 'rerun': ''}
    agent_png = os.path.join(sandbox, 'finished.png')
    if os.path.exists(agent_png):
        out['agentFinishedSha256'] = dot.image_hash(Image.open(agent_png))
    draw = os.path.join(sandbox, 'finish_draw.py')
    tmp = tempfile.mkdtemp(prefix='bk-finish-recheck-')
    try:
        meta = write_inputs(tmp, theme, item)
        out['baseSha256'] = meta['baseSha256']
        if os.path.exists(draw):
            shutil.copy(draw, os.path.join(tmp, 'finish_draw.py'))
            try:
                r = subprocess.run([sys.executable, 'finish_draw.py'], cwd=tmp, capture_output=True, text=True,
                                   timeout=RERUN_TIMEOUT)
                out['rerun'] = ((r.stdout or '') + (r.stderr or ''))[-1500:]
            except subprocess.TimeoutExpired:
                out['rerun'] = f'finish_draw.py 재실행이 {RERUN_TIMEOUT}s 를 넘었다'
        fin = os.path.join(tmp, 'finished.png')
        if os.path.exists(fin):
            im = Image.open(fin).convert('RGBA')
            out['finishedSha256'] = dot.image_hash(im)
            out['image'] = im.copy()
            out['reproduced'] = out['finishedSha256'] == out['agentFinishedSha256']
        r = subprocess.run([sys.executable, 'check.py'], cwd=tmp, capture_output=True, text=True, timeout=RERUN_TIMEOUT)
        out['checkOutput'] = (r.stdout or '')[-4000:]
        cj = os.path.join(tmp, 'check.json')
        out['check'] = json.load(open(cj, encoding='utf-8')) if os.path.exists(cj) else {'pass': False, 'checks': {}}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    out['pass'] = bool(out['reproduced'] and out['check'] and out['check'].get('pass'))
    return out


def iterations(sandbox):
    p = os.path.join(sandbox, 'preview', 'iterations.jsonl')
    return sum(1 for _ in open(p, encoding='utf-8')) if os.path.exists(p) else 0


def record(theme, rid, item, sandbox, rc, chk, extra=None):
    d = out_dir(theme, rid)
    os.makedirs(d, exist_ok=True)
    stem = os.path.join(d, item['bid'])
    im = chk.pop('image', None)
    if im is not None:
        im.save(stem + '.png')
        im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(stem + '-x4.png')
    else:
        for suf in ('.png', '-x4.png'):
            if os.path.exists(stem + suf):
                os.remove(stem + suf)
    draw = os.path.join(sandbox, 'finish_draw.py')
    if os.path.exists(draw):
        shutil.copy(draw, stem + '.finish_draw.py')
    rec = {'schema': SCHEMA, 'theme': theme, 'round': rid, 'building': item['bid'], 'key': item['key'], 'line': item['line'],
           'recipe': item['recipe']['id'], 'baseSha256': chk.get('baseSha256'), 'finishedSha256': chk.get('finishedSha256'),
           'agentFinishedSha256': chk.get('agentFinishedSha256'), 'reproduced': chk['reproduced'], 'pass': chk['pass'],
           'check': chk.get('check'), 'checkOutput': chk.get('checkOutput', ''), 'rerun': chk.get('rerun', ''),
           'iterations': iterations(sandbox), 'minIterations': MIN_ITERATIONS, 'exit': rc,
           'agent': f'claude/{MODEL}/{EFFORT}', 'sandbox': os.path.relpath(sandbox, dot.REPO), 'at': now(), **(extra or {})}
    json.dump(rec, open(stem + '.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return rec


def finish_one(theme, rid, item, runner, cmd, timeout):
    sandbox, meta, text = sandbox_for(theme, rid, item)
    command = cmd or claude_command(sandbox)
    timed_out = False
    try:
        rc, out, err = runner(command, text, sandbox, timeout)
    except subprocess.TimeoutExpired:
        rc, out, err, timed_out = 124, '', f'시간 초과 {timeout}s', True
    open(os.path.join(sandbox, 'finisher.log'), 'w', encoding='utf-8').write((out or '') + '\n--- stderr\n' + (err or '')[-4000:])
    chk = recheck(theme, item, sandbox)
    extra = {'timedOut': timed_out, 'agentCommand': command if isinstance(command, str) else ' '.join(command[:2] + ['…']),
             'tail': (out or '').strip().splitlines()[-3:]}
    if chk.get('baseSha256') != meta['baseSha256']:
        chk['pass'] = False
        extra['stale'] = '마감 중에 조립 바탕이 바뀌었다'
    return record(theme, rid, item, sandbox, rc, chk, extra)


def run(theme, rid, line, building=None, jobs=1, cmd=None, runner=None, timeout=None, parts_by_key=None, quiet=False):
    import drawer
    items, skipped = eligible(theme, rid, line, building, parts_by_key)
    if not items:
        why = '; '.join(f'{b}: {w}' for b, w in skipped) or '레시피 없음'
        raise SystemExit(f'{theme} {rid} 줄 {line}: 조립 관문을 통과한 건물이 없다({why})')
    if isinstance(cmd, str):
        cmd = shlex.split(cmd)
    runner = runner or drawer.subprocess_runner
    timeout = timeout or DEFAULT_TIMEOUT
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, int(jobs))) as ex:
        futs = [ex.submit(finish_one, theme, rid, it, runner, cmd, timeout) for it in items]
        for f in futs:
            results.append(f.result())
    if not quiet:
        for bid, why in skipped:
            print(f'  건너뜀 {bid}: {why}')
        for r in results:
            print(describe(r))
        print(f'{theme} {rid} 줄 {line}: 마감 {sum(r["pass"] for r in results)}/{len(results)} 검사 통과 → '
              f'{os.path.relpath(out_dir(theme, rid), dot.REPO)}/  (통과는 합격이 아니다 — review --finished → sheet --finished)')
    return 0 if results and all(r['pass'] for r in results) else 1


def describe(r):
    c = (r.get('check') or {}).get('checks') or {}
    f = c.get('f_changed') or {}
    g = c.get('g_period') or {}
    per = ' · '.join(f'{n} {v["base"]:.3f}→{v["finished"]:.3f}' for n, v in g.items()
                     if isinstance(v, dict) and v.get('base') is not None and v.get('finished') is not None)
    head = (f'  {r["building"]:22} {"통과" if r["pass"] else "실패"} · 재현 {"같음" if r["reproduced"] else "다름/없음"}'
            f' · 바뀜 {f.get("frac", 0):.1%} · 주기 {per or "-"} · 되풀이 {r["iterations"]}회 · exit {r["exit"]}'
            + (f' · {r["finishedSha256"][:8]}' if r.get('finishedSha256') else ''))
    bad = [f'{k} {v["msg"]}' for k, v in sorted(c.items()) if not v.get('ok')]
    if r.get('stale'):
        bad.append(r['stale'])
    if not r['reproduced']:
        bad.append('하네스가 finish_draw.py 를 다시 돌린 결과가 에이전트의 finished.png 와 다르거나 없다')
    if r['iterations'] < MIN_ITERATIONS:
        bad.append(f'(경고) save 되풀이 {r["iterations"]}회 < {MIN_ITERATIONS}')
    return head + ''.join(f'\n     - {b}' for b in bad)


def finished_candidates(theme, rid, parts_by_key=None, line=None):
    """마감 검사 통과 + 마감 PNG 해시 일치 + 바탕(지금 부품 조립) 해시 일치인 마감 건물. 반환 (후보, 빠진 이유)."""
    d = out_dir(theme, rid)
    if not os.path.isdir(d):
        return {}, {}
    recs = []
    for f in sorted(os.listdir(d)):
        if f.endswith('.json') and f != 'sheet.json':
            rec = json.load(open(os.path.join(d, f), encoding='utf-8'))
            if rec.get('schema') == SCHEMA and (line is None or rec.get('line') == line):
                recs.append(rec)
    if not recs:
        return {}, {}
    if parts_by_key is None:
        import harness
        _, rendered = harness.render_round(theme, rid)
        parts_by_key = {k: harness.parts_for(theme, rid, k, rendered) for k in {r['key'] for r in recs}}
    recipes = {r['id']: r for r in AS.round_buildings(theme, rid)}
    out, why = {}, {}
    for rec in recs:
        bid = rec['building']
        if not rec.get('pass'):
            why[bid] = '마감 검사 실패'
            continue
        png = os.path.join(d, f'{bid}.png')
        if not os.path.exists(png):
            why[bid] = '마감 PNG 가 없다'
            continue
        img = Image.open(png).convert('RGBA')
        if dot.image_hash(img) != rec.get('finishedSha256'):
            why[bid] = '마감 PNG 해시가 기록과 다르다'
            continue
        recipe = recipes.get(rec['recipe'])
        parts = parts_by_key.get(rec['key'])
        if recipe is None or not parts:
            why[bid] = '레시피·부품이 이 판에 없다'
            continue
        res = AS.assemble(recipe, parts, dot.palette(theme), theme)
        if res['img'] is None or dot.image_hash(res['img'].img()) != rec.get('baseSha256'):
            why[bid] = '바탕(조립) 그림이 마감 뒤 바뀌었다 — finish 를 다시'
            continue
        out[bid] = {'img': img, 'recipe': recipe, 'kit': res['kit'], 'parts': parts, 'base': res['img'].img(),
                    'record': rec}
    return out, why
