"""building-kit 그리기 — 후보 키 하나(화풍 판은 한 줄, 이후 판은 <줄><번호>)마다 새 Opus 프로세스가 그 벌의 **모든 항목**을 그린다.

`draw <테마> <판> --agent [--lines A,B,C] [--jobs N]`

한 줄의 지붕·벽·기단을 서로 다른 에이전트가 그리면 서로 못 보고 조립이 어긋난다 — 그래서 한 에이전트가 한 벌을 다 그린다.
`--jobs` 는 동시에 뜨는 프로세스 수만 제한한다.

샌드박스(작업 폴더)에 넣는 것:
  round_module.py   판 모듈 사본(에이전트는 이번 후보의 함수들만 고친다)
  data/<테마>/      seed.json · palette.json
  refs/             버들항 기준 건물 1배·4배(공용 시트 키트를 시트·검수와 같은 방식으로 합성), Actor1 정면 1배·4배, 팔레트 견본,
                    requireGableFront 판이면 projection-*.png(projection.py 가 그린 회색 투영 안내도 — 사용자 참고 그림은 넣지 않는다)
  dry.py · dry.json 샌드박스 자체 점검(테마·판·후보·모듈·미리보기 폴더). 에이전트는 `python3 dry.py` 로 돌린다
  BRIEF.md          할 일 · 3/4 지붕 지침 · 조립 목표 크기 · 쓰는 법

에이전트는 참고 그림을 Read 로 눈으로만 보고, 고칠 때마다 `python3 dry.py` 로 관문·조립을 돌린 뒤 preview/ PNG 를 다시 연다.
`dot` 에는 그림 파일을 읽는 헬퍼가 없다 — 화소 베끼기(트레이스) 금지. 끝나면 그 후보의 함수 블록만 저장소 판 모듈로 옮긴다
(같은 파일을 여러 프로세스가 동시에 고치지 않는다). 모델 호출은 테스트에서 runner 로 바꿔 끼운다.
"""
import concurrent.futures
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from PIL import Image, ImageDraw  # noqa: E402

import assemble as AS  # noqa: E402
import beodeul  # noqa: E402
import dot  # noqa: E402
import projection  # noqa: E402

REPO = dot.REPO
SANDBOX = os.environ.get('BUILDING_KIT_DRAWER_DIR') or os.path.join(REPO, 'qa-runs', 'harnesses', 'building-kit', 'drawer')
DEFAULT_TIMEOUT = int(os.environ.get('BUILDING_KIT_DRAWER_TIMEOUT', '3600'))
# 사용자 요구(2026-10-22): 타일·건물을 그리거나 까는 에이전트는 Opus 5.5 high. 환경 변수로만 바꾼다.
MODEL = os.environ.get('BUILDING_KIT_DRAWER_MODEL', 'claude-opus-5-5')
EFFORT = os.environ.get('BUILDING_KIT_DRAWER_EFFORT', 'high')
MAX_ATTEMPTS = 3
CANDIDATES_PER_LINE = 2
BEGIN = '# >>> {name}'
END = '# <<< {name}'
CANDIDATES_HEAD = 'CANDIDATES = {'

def func_name(item, key):
    return 'cand_' + re.sub(r'[^0-9a-zA-Z]+', '_', item).strip('_') + '_' + key

def round_path(theme, rid):
    s = dot.seed(theme)
    return os.path.join(REPO, s['rounds'][rid]['module'])

def lines_of(seed):
    return [ln for ln, info in seed['lines'].items() if isinstance(info, dict)]

def keys_for(theme, rid, only_lines=None):
    """이번 판의 후보 키 목록 — 화풍 판은 줄 글자 하나씩, 이후 판은 (줄, 번호)마다 하나."""
    seed = dot.seed(theme)
    ls = lines_of(seed)
    if only_lines:
        ls = [ln for ln in ls if ln in only_lines]
    if seed['rounds'][rid].get('wave') == 'style':
        return ls
    return [f'{ln}{n}' for ln in ls for n in range(1, CANDIDATES_PER_LINE + 1)]

def skeleton(theme, rid, seed):
    rd = seed['rounds'][rid]
    items = [it for it in seed['items'] if it['id'] in rd['items']]
    style = rd.get('wave') == 'style'
    keys = keys_for(theme, rid)
    head = [
        f'"""building-kit {theme} {rid} 후보 — 그리기 에이전트가 쓴다(행 문자열 손 도트, 팔레트 램프 글자만).',
        '',
        f'{seed["theme"]["name"]} · 화풍 {"판(줄 글자 A·B·C 가 곧 줄)" if style else "판(<줄><번호>)"}.',
        '한 후보 키의 항목 전부를 같은 에이전트가 그린다. 함수는 (dot.Cv, meta) 를 돌려준다. meta 는 비어 있어도 된다. hex 색 금지.',
        '"""',
        'import dot',
        '',
        f'ROUND = {rid!r}',
        f'WAVE = {rd.get("wave")!r}',
        'NOTES = {}',
        '',
        '',
    ]
    return '\n'.join(head), items, keys

def ensure_module(theme, rid):
    path = round_path(theme, rid)
    seed = dot.seed(theme)
    head, items, keys = skeleton(theme, rid, seed)
    text = open(path, encoding='utf-8').read() if os.path.exists(path) else head
    for it in items:
        for key in keys:
            name = func_name(it['id'], key)
            if BEGIN.format(name=name) in text:
                continue
            block = [BEGIN.format(name=name),
                     f'def {name}():',
                     f'    raise NotImplementedError({name!r} + " — 그리기 에이전트가 채운다")',
                     END.format(name=name), '', '']
            text = text.replace(CANDIDATES_HEAD, '\n'.join(block) + CANDIDATES_HEAD, 1) if CANDIDATES_HEAD in text else text + '\n'.join(block)
    lines = [f'    {it["id"]!r}: {{' + ', '.join(f'{k!r}: {func_name(it["id"], k)}' for k in keys) + '},' for it in items]
    body = CANDIDATES_HEAD + '\n' + '\n'.join(lines) + '\n}\n'
    text = re.sub(r'CANDIDATES = \{.*?\n\}\n', body, text, flags=re.S) if CANDIDATES_HEAD in text else text + '\n' + body
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(text)
    return path

def extract_block(text, name):
    m = re.search(re.escape(BEGIN.format(name=name)) + r'.*?' + re.escape(END.format(name=name)), text, re.S)
    return m.group(0) if m else None

def splice(path, sandbox_text, name):
    cur = open(path, encoding='utf-8').read()
    block = extract_block(sandbox_text, name)
    if not block:
        return False
    old = extract_block(cur, name)
    if old is None:
        return False
    if block == old:
        return False
    open(path, 'w', encoding='utf-8').write(cur.replace(old, block))
    return True

def palette_legend(theme):
    pal = dot.palette(theme)
    out = []
    for name, ramp in pal['ramps'].items():
        out.append(f'  {name:8} ' + ' '.join(f'{i}:{c}' for i, c in enumerate(ramp)))
    return '\n'.join(out)

def palette_swatch(theme):
    pal = dot.palette(theme)
    block, gap = 10, 2
    rows = list(pal['ramps'].items())
    w = max(len(c) for _, c in rows) * (block + gap) + gap
    h = len(rows) * (block + gap) + gap
    im = Image.new('RGBA', (w, h), (24, 22, 30, 255))
    d = ImageDraw.Draw(im)
    for j, (_, cols) in enumerate(rows):
        for i, c in enumerate(cols):
            x, y = gap + i * (block + gap), gap + j * (block + gap)
            d.rectangle([x, y, x + block - 1, y + block - 1], fill=dot.hx(c) + (255,))
    return im

def write_refs(path, theme, seed, rid=None):
    d = os.path.join(path, 'refs')
    os.makedirs(d, exist_ok=True)
    for ref in seed.get('refs', []):
        try:
            im = beodeul.kit(ref['kit']).img()
        except SystemExit:
            continue
        im.save(os.path.join(d, f'{ref["kit"]}-1x.png'))
        im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(d, f'{ref["kit"]}-4x.png'))
    if AS.requires_gable_front(theme, rid):
        projection.write_guides(d)
    act = beodeul.actor1_frame(1, 0, 0)
    act.save(os.path.join(d, 'actor1-front-1x.png'))
    act.resize((act.width * 4, act.height * 4), Image.NEAREST).save(os.path.join(d, 'actor1-front-4x.png'))
    palette_swatch(theme).save(os.path.join(d, 'palette.png'))

def references(theme, seed, rid=None):
    out = []
    for ref in seed.get('refs', []):
        out.append(f'  - refs/{ref["kit"]}-1x.png · refs/{ref["kit"]}-4x.png — {ref.get("label", "")} ({ref.get("use", "")})')
    if AS.requires_gable_front(theme, rid):
        for name in projection.NAMES:
            out.append(f'  - refs/projection-{name}-1x.png · refs/projection-{name}-4x.png — 박공 정면 투영 안내도(회색 구조 도형, 화풍 기준 아님)')
    out.append('  - refs/actor1-front-1x.png · refs/actor1-front-4x.png — Actor1 정면 24×32(사람 크기 기준)')
    out.append('  - refs/palette.png — 잠긴 팔레트 램프 견본')
    return '\n'.join(out)

def _piece_h(item, role):
    for pc in item['pieces']:
        if pc.get('role') == role:
            return pc['size'][1]
    return 0

def round_buildings(seed, rid):
    ids = ((seed.get('rounds') or {}).get(rid or '') or {}).get('buildings')
    if not ids:
        return seed.get('buildings', [])
    by = {b['id']: b for b in seed.get('buildings', [])}
    return [by[i] for i in ids if i in by]

def _mass_size(items, m):
    kind = m.get('kind') or AS.RIDGE_SIDE
    rh = AS.roof_rows(m, items)
    h = rh
    if kind == AS.GABLE_FRONT:
        desc = [f'박공 정면 지붕 {rh}(뒤 끝 + 사면 띠 {m["depth_rows"]}행 + 앞 박공{", 골" if m.get("back_end") == "valley" else ""})']
    elif kind == AS.LEAN_TO:
        desc = [f'외쪽 지붕 {rh}(낮은 쪽 {m.get("low")}, 사면 띠 {m["depth_rows"]}행)']
    else:
        desc = [f'지붕 {rh}']
    for s, row in enumerate(m['walls']):
        item_id = row['item'] if isinstance(row, dict) else m.get('wall')
        wh = _piece_h(items.get(item_id, {'pieces': []}), 'l')
        h += wh
        desc.append(f'{s}층 벽 {wh}칸({item_id})')
    if m.get('band'):
        bh = _piece_h(items[m['band']], 'l')
        h += bh * max(0, len(m['walls']) - 1)
        desc.append(f'층 띠 {bh}×{max(0, len(m["walls"]) - 1)}')
    if m.get('base'):
        bb = _piece_h(items[m['base']], 'l')
        h += bb
        desc.append(f'기단 {bb}')
    return h, ' + '.join(desc)

def targets(theme, rid):
    import assemble as AS
    seed = dot.seed(theme)
    items = {it['id']: it for it in seed['items']}
    out = []
    for b in round_buildings(seed, rid):
        ms = AS.masses(b)
        width = height = 0
        rows = []
        for m in ms:
            h, desc = _mass_size(items, m)
            width = max(width, m['x'] + m['cols'])
            height = max(height, h + max([0] + [-int(ex['at'][1]) for ex in m.get('extras') or []]))
            rows.append(f'      질량 {m["id"]} [{m["kind"]}]: {m["cols"]}칸 폭 {m["storeys"]}층 x={m["x"]} depth={m["depth"]} → 세로 {h}칸 ({desc})'
                        + ''.join(f' · extra {ex["part"]} at {ex["at"]}' + (' on roof' if ex.get('on') == 'roof' else '')
                                  for ex in m.get('extras') or []))
        head = (f'  - {b["id"]} "{b.get("title", "")}" ({b.get("use", "")}): 질량 {len(ms)}개 → 가로 {width}칸 × 세로 {height}칸, '
                + ('기단 행 있음' if any(m.get('base') for m in ms) else '기단 행 없음(벽이 땅에 닿는다)'))
        out.append(head + '\n' + '\n'.join(rows))
    return '\n'.join(out) or '  - (레시피 없음)'

def rejected(theme):
    path = os.path.join(dot.theme_dir(theme), 'ledger.json')
    if not os.path.exists(path):
        return ''
    L = json.load(open(path, encoding='utf-8'))
    rows = [f'  - {r["item"]} 줄 {r["line"]} {r["key"]}: {r["why"]}' for r in L.get('rejects', [])][-12:]
    return '\n'.join(rows)

def review_majors(theme, rid):
    path = os.path.join(dot.RUNS, theme, rid, 'review', 'result.json')
    if not os.path.exists(path):
        return ''
    res = json.load(open(path, encoding='utf-8'))
    rows = []
    for key, v in (res.get('candidates') or {}).items():
        if v.get('verdict') != 'PASS':
            rows.append(f'  - {key}: ' + ' · '.join(v.get('reasons', [])[:3]))
    return '\n'.join(rows)

def item_sections(seed, items):
    out = []
    for it in items:
        pieces = '\n'.join(
            f'  - 조각 {pc["id"]} ({pc.get("role", "")}) at={pc["at"]} size={pc["size"]} kind={pc["kind"]}'
            + (f' tileable={pc["tileable"]}' if pc.get('tileable') else '')
            + (f' inset={pc["inset"]}' if pc.get('inset') else '')
            + (f' qMin={pc["qMin"]}' if 'qMin' in pc else '')
            + (f' qTopRow={str(pc["qTopRow"]).lower()}' if 'qTopRow' in pc else '')
            for pc in it['pieces'])
        joins = ', '.join('→'.join(j[:2]) + f'({j[2]})' for j in it.get('joins', []))
        out.append(f"""### {it['id']} — {it['title']}
- {it['brief']}
- 받아들일 기준: {' · '.join(it.get('accept', []))}
- 세트 그림 {it['size'][0]}×{it['size'][1]}칸(16px 칸). 조각:
{pieces}
- 세트 이음(맞닿는 조각 쌍): {joins or '없음'}""")
    return '\n\n'.join(out)

def projection_section(theme, rid, seed):
    """requireGableFront 판(style-r5~)의 투영 절. 다른 판은 빈 문자열."""
    if not AS.requires_gable_front(theme, rid):
        return ''
    rd = seed['rounds'][rid]
    return f"""## 투영 — 박공 정면(gable-front). 이 판은 여기서 갈린다
{rd.get('projection') or seed['rules'].get('projection', '')}

- 빛: {rd.get('light', '')}
- 문법(조립이 이 순서로 쌓는다, 위→아래): 뒤 끝 b<폭>(또는 골 v<폭>) → 사면 띠 l·ml·k|k2·mr·r × depth_rows → 앞 박공 g<폭> → 층마다 벽.
  용마루 띠는 질량 가운데 2px(폭 W 화소면 열 W/2-1, W/2)이다. 1칸 용마루 k 는 칸 안 7·8열, 2칸 용마루 k2 는 15·16열.
- 조립 관문: A12 용마루가 뒤 끝 꼭대기에서 앞 박공 꼭대기까지 끊기지 않고 사면 띠 모든 행에서 양옆 사면과 밝기 6 이상 다르다 ·
  왼쪽 사면 평균이 오른쪽보다 8 이상 밝다 / A13 골(v<폭>) 윗변 바로 위가 전부 더 뒤 본채의 지붕이고, 혼자 선 뒤 끝 위에는
  본채 지붕이 없다 / A14 굴뚝 밑동이 그 질량 지붕 면 위 / A15 건물마다 박공 정면 질량 / A6 물러나는 지붕은 질량 높이의 50~85%.
- 정면과 나란한 용마루 지붕(모임·망사드·박공)만 있는 건물, 지붕이 얇은 띠인 평평한 정면 입면은 이 판에서 실패다(검수 FAIL).
- {rd.get('compare', '')}

"""


def brief(theme, rid, seed, key, items, line):
    names = ', '.join(func_name(it['id'], key) for it in items)
    return f"""# building-kit 그리기 — {seed['theme']['name']} · 판 {rid} · 후보 {key} (항목 {len(items)}개)

너는 버들항(beodeul_city)과 같은 계열 oprn-atlas 의 16px 3/4 탑뷰 건물 부품을 코드 도트로 그린다.
이번 작업은 **{key} 한 벌 전체**다 — 아래 항목 전부를 네가 그린다(같은 줄의 지붕·벽·기단이 서로 맞아야 한다).
사람이 나중에 시트에서 고른다. 생성 이미지·트레이스 금지. 사람(캐릭터)은 그리지 않는다.

## 이번에 그릴 항목
{item_sections(seed, items)}

{projection_section(theme, rid, seed)}## 3/4 지붕 — 여기서 갈린다
- 모임지붕(hip)을 3/4 탑뷰로 보면 위에서부터: ① 용마루가 위쪽 가까이 **짧고 밝은 선**으로 지나가고
  ② 그 아래 **큰 사면**이 면으로 보이며(2행 이상) 기와 줄이 가로로 흐르고 ③ 맨 아래 처마 띠는 더 어둡다.
  ④ 왼끝·오른끝 조각(각 2칸 폭) 안에 처마 모서리에서 용마루 끝으로 올라가는 **모임 사선**을 어두운 단으로 긋고
  사선 바깥 삼각형은 지붕 그늘이다 — 이 사선이 없으면 지붕이 세운 판(네모 상자)으로 읽힌다(사용자 반려 이유 1).
- 지붕 색: **중간·어두운 단이 대부분**이고 가장 밝은 단은 한 화소 하이라이트로 드문드문. 밝은 단을 넓게 깔면
  지붕이 떠 보인다(사용자 반려 「색감이 어색하다」). 버들항 지붕은 어두운 테라코타가 주이고 용마루만 밝다.
- 지붕을 한 가지 색·한 가지 무늬의 **평평한 사각형**으로 채우면 벽돌 담으로 읽힌다(실패). 용마루·사면·처마
  세 띠는 밝기와 줄 방향이 서로 달라야 하고, 윗면(용마루+사면)은 처마보다 밝다.
- 지붕 **맨 아래 2행은 칸 경계까지 불투명**하게 찍는다. '~'(반투명 그림자)를 지붕 아래에 쓰면 바닥이 비쳐
  조립했을 때 지붕과 벽 사이가 벌어진다(A2 FAIL). '~' 는 건물 발치 바닥 그림자에만 쓴다.
- 처마(overhang)는 지붕 끝 조각의 **바깥 2~3px** 에 그린다 — 조립에서 지붕 폭 = 벽 폭(0칸)이다.
  벽 l·r 조각은 바깥 2~3px 을 투명하게 두어(시드 inset) 지붕 처마가 벽보다 튀어나와 보이게 한다.
- 처마 그늘은 벽 조각 **맨 위 1~2행**에 벽 재질의 어두운 단으로 **불투명하게** 찍는다.
- 지붕 끝 조각에 qMin·qTopRow 가 선언돼 있으면 모임 사선·삼각 그늘로 바깥 위 귀퉁이를 비울 수 있다(불투명 비율 ≥ qMin).
  가운데 조각은 윗줄까지 꽉 차야 한다(불투명 90% 이상). 어느 조각이든 맨 아래 2행은 꽉 찬다.
- refs/ 의 버들항 기준 건물 지붕과 같은 배율로 견줘라(색·기와 줄 간격·처마 두께·사선 기울기).

## 접지 — 기단 행을 깔지 않는다
- 건물은 땅에 **바로** 닿는다. 벽 조각의 맨 아래 1~3px 을 그 벽 재질의 어두운 단(또는 돌)으로 그려 기초를 만든다.
  별도 기단(base) 행은 이번 판 부품이 아니다 — 전폭 보도블록 띠로 읽히면 사용자가 반려한다(반려 이유 2).
- 조립 관문 A4 는 건물의 맨 아래 불투명 행이 그림 맨 아래 칸 경계인지 본다 — 벽이 땅에 닿아야 통과한다.

## 조립 목표 크기 (dry.py 가 이 레시피로 조립해 preview/ 에 보여 준다)
{targets(theme, rid)}

## 줄 {line}
- 이름: {seed['lines'][line]['name']}
- 화풍: {seed['lines'][line]['concept']}

## 잠긴 팔레트 (글자 → (램프, 단); 단 0 = 가장 어두움)
{palette_legend(theme)}

## 샌드박스 그림 — Read 로 열어 본다 (보기·비율용, 화소 베끼기 금지)
{references(theme, seed, rid)}

## 질량 합성 — 한 채가 여러 덩어리다
- 레시피가 `masses` 로 여러 질량을 적으면, 앞줄(depth 0) 질량이 뒤 질량(depth 1)을 **덮는다** — 3/4 깊이.
  버들항 여관 = 석조 1층 + 반목조 2층 본채 + 낮은 날개, 사막 칸 = 총안 탑 둘 + 한 칸 물러난 가운데.
- 층마다 벽 재질이 다를 수 있다(`walls` 의 층별 `item`+`letters`) — 그 경우 위층 벽 부품도 이번 판에 같이 그린다.
- 문은 건물 전체(질량 전부)에 **하나**다(A1). 질량끼리 닿거나 겹쳐야 하고(A7), 여러 질량이면 실루엣이
  네모 판이 아니어야 한다(A8) — 꼭대기 높이가 칸 하나 이상 갈려야 한다.
- dry.py 는 이번 판의 **모든 건물**을 조립해 preview/ 에 낸다(여러 질량 포함).

## 이번 판 규칙
{json.dumps(seed['rules'], ensure_ascii=False, indent=1)}

## 하지 말 것
{rejected(theme) or '  - (아직 없음)'}

## 이전 독립 검수의 major
{review_majors(theme, rid) or '  - (아직 없음)'}

## 쓰는 법
- 샌드박스의 `round_module.py` 에서 **이번 후보 {key} 의 함수 {len(items)}개만** 고친다: {names}.
  다른 후보 함수·CANDIDATES·ROUND/WAVE 는 건드리지 않는다.
- 함수는 `dot.grid(rows, legend)` 로만 화소를 찍어 `(cv, meta)` 를 돌려준다. `rows` 는 위→아래 문자열, 글자 하나 = 화소 하나,
  '.' 투명, '~' 그림자(투명한 곳에만). `legend` 는 `dot.legend('{theme}', a=('램프', 단), ...)`.
- 원·다각형 마스크로 본체 만들기, 잡음 채우기, 난수 금지. 반복 무늬 보조는 좌표를 고른 것만.
- 고칠 때마다 **이 폴더에서 그대로 `python3 dry.py`** 를 실행한다(승인 없이 돈다). FAIL 코드와 문구를 보고 고친다(최대 {MAX_ATTEMPTS}회).
- dry.py 가 `preview/` 에 미리보기를 쓴다: `preview/<항목>.png`(4배) · `preview/<건물>.png`(3배, 버들항 잔디 위) ·
  `preview/compare.png`(내 조립 건물과 버들항 기준 건물을 같은 배율로 나란히).
  **고칠 때마다 preview PNG 를 Read 로 열어** 눈으로 확인하고, **끝내기 전에 `preview/compare.png` 를 반드시 본다**.
- 그림 파일은 보기·비율용이다. Read 로 열어 보되 화소를 베끼지 않는다 — `dot` 에 그림을 읽는 도구는 없다.
- 끝나면 한 줄로 무엇을 그렸고 무엇이 아직 안 읽히는지 적는다.
"""

def claude_command(sandbox, model=None, effort=None, tools='Read,Write,Edit,Bash(python3:*)'):
    """타일·건물을 그리거나 까는 에이전트 명령 — 기본 Opus 5.5 high(BUILDING_KIT_DRAWER_MODEL/EFFORT 로만 바꾼다).
    마을에 타일을 까는 에이전트도 이 함수로 띄운다."""
    return [shutil.which('claude') or 'claude', '-p', '--output-format', 'text', '--strict-mcp-config',
            '--allowedTools', tools, '--add-dir', sandbox, '--model', model or MODEL, '--effort', effort or EFFORT]

def subprocess_runner(cmd, prompt, cwd, timeout):
    r = subprocess.run(cmd, input=prompt, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    return r.returncode, r.stdout or '', r.stderr or ''

def sandbox_for(theme, rid, key):
    path = os.path.join(SANDBOX, theme, rid, key)
    os.makedirs(path, exist_ok=True)
    shutil.copy(round_path(theme, rid), os.path.join(path, 'round_module.py'))
    seed = dot.seed(theme)
    data = os.path.join(path, 'data', theme)
    os.makedirs(data, exist_ok=True)
    json.dump(seed, open(os.path.join(data, 'seed.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(dot.palette(theme), open(os.path.join(data, 'palette.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    write_refs(path, theme, seed, rid)
    shutil.copy(os.path.join(HERE, 'dry.py'), os.path.join(path, 'dry.py'))
    out = os.path.join(path, 'preview')
    shutil.rmtree(out, ignore_errors=True)
    json.dump({'theme': theme, 'round': rid, 'key': key, 'module': os.path.join(path, 'round_module.py'),
               'out': out, 'harness': HERE, 'data': os.path.join(path, 'data')},
              open(os.path.join(path, 'dry.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return path

def draw_one(theme, rid, key, runner, cmd, timeout, effort):
    line = key[0]
    seed = dot.seed(theme)
    items = [it for it in seed['items'] if it['id'] in seed['rounds'][rid]['items']]
    sandbox = sandbox_for(theme, rid, key)
    text = brief(theme, rid, seed, key, items, line)
    (open(os.path.join(sandbox, 'BRIEF.md'), 'w', encoding='utf-8')).write(text)
    command = cmd or claude_command(sandbox, effort=effort)
    rc, out, err = runner(command, text, sandbox, timeout)
    (open(os.path.join(sandbox, 'drawer.log'), 'w', encoding='utf-8')).write((out or '') + '\n--- stderr\n' + (err or '')[-4000:])
    sandbox_text = open(os.path.join(sandbox, 'round_module.py'), encoding='utf-8').read()
    changed = [it['id'] for it in items if splice(round_path(theme, rid), sandbox_text, func_name(it['id'], key))]
    return {'theme': theme, 'round': rid, 'key': key, 'exit': rc, 'changed': changed,
            'missing': [it['id'] for it in items if it['id'] not in changed],
            'sandbox': os.path.relpath(sandbox, REPO), 'tail': (out or '').strip().splitlines()[-3:]}

def run(theme, rid, lines_=None, jobs=1, cmd=None, runner=None, timeout=None, effort=None):
    path = ensure_module(theme, rid)
    keys = keys_for(theme, rid, lines_)
    if not keys:
        raise SystemExit(f'{theme} {rid}: 그릴 후보 키가 없다 — --lines 로 줄을 고른다')
    runner = runner or subprocess_runner
    timeout = timeout or DEFAULT_TIMEOUT
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, int(jobs))) as ex:
        futs = [ex.submit(draw_one, theme, rid, k, runner, cmd, timeout, effort) for k in keys]
        for f in futs:
            try:
                results.append(f.result())
            except Exception as e:  # noqa: BLE001
                results.append({'error': str(e)})
    for r in results:
        if 'error' in r:
            print(f'  그리기 실패: {r["error"]}')
            continue
        state = ('함수 갱신 ' + ','.join(r['changed'])) if r['changed'] else '변경 없음'
        if r['missing']:
            state += ' · 안 고침 ' + ','.join(r['missing'])
        print(f'  후보 {r["key"]:3} exit {r["exit"]} {state} · {r["sandbox"]}')
    print(f'{theme} {rid}: 후보 {len(results)}벌 그리기 → {os.path.relpath(path, REPO)}  (다음: gate → review → sheet)')
    return 0 if all(r.get('exit') == 0 and r.get('changed') and not r.get('missing') for r in results) else 1
