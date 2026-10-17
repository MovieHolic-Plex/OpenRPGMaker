#!/usr/bin/env python3
"""Scarloxy People 뼈대 → Argon 부분 편집 드라이버 2차(2026-10-16). scarloxy_draw.py(1차)의 실패 원인을 푼 판이다.

1차(12 후보 중 4 채택)에서 3회 안에 통과 못 한 대표 사유와 이번 대응:
  - 「몸 칸을 투명으로 지울 수 없다」「마스크 밖 칸을 바꿨다」(126개 오류까지): 모델이 모자·머리를 새로 그리며 베이스의 몸 칸을 '.' 로 비우거나 손·맨살(F) 칸까지 칠했다.
    → sanitize(): paint 줄을 부위 마스크에 맞춰 잘라 낸다(허용 밖 칸·몸 칸의 '.' 은 베이스 글자로 되돌림, 24글자가 아닌 줄은 버림). 잘린 개수는 meta 에 적고 되먹임한다. 12프레임 고정 검사(partedit.verify)는 그대로다.
  - 「새 픽셀 덩어리가 1~2칸뿐」「몸체 내부 투명 결손」: → scarloxy_repair.drop_strays / fill_holes 로 적용 뒤 자동 정리(edit.json 은 그대로, meta.repairs 에 기록) 하고 같은 verify 를 다시 건다.
  - 「뼈대와 거의 같다(61%)」: 주문 문장에 베이스 의상 색을 직접 적고(부위별 글자 표) 하나도 남기지 말라고 명시, 결과가 가장 가까운 칩과 45% 미만으로 다르면 어떤 글자가 안 바뀌었는지 적어 거절한다.
  - 윤곽 어둠(「윤곽선이 끊겼다」): 베이스의 윤곽 글자를 알려 주고 새 모자·옷 바깥 둘레를 그 글자로 두르게 한다.
  - 장비(held·back)가 앵커에 안 닿음: 쓰지 않는다. 모자·머리·가운·앞치마·망토 끝(zone h·t)과 recolor 로만 실루엣을 바꾼다.
  - 시도 5회, 응답 파싱 실패·429·5xx 는 argon_http 가 60→120→240초 백오프. 동시 호출은 2개 이하.

  OPRN_LIVE_KEY="$(cat ~/.config/oprn/live-key)" CTFF6_PART_OUT=$HOME/spc-runs python3 src/harnesses/charset-actor/scarloxy_argon2.py draw \\
      --spec harness-data/charset-actor/scarloxy-people-spec-2.json --run sp2-r1 [--label sp2-clerk-m-a ...] [--par 2]
키는 환경변수로만 읽고 출력·로그·파일에 남기지 않는다. 모델은 gemini-4-argon-* 만, 스트리밍만.
"""
import argparse
import datetime
import json
import os
import shutil
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import argon_http  # noqa: E402
import argon_part as A  # noqa: E402
import chr as C  # noqa: E402
import harness as H  # noqa: E402
import partedit as P  # noqa: E402
import scarloxy_distinct as D  # noqa: E402
import scarloxy_repair as R  # noqa: E402
from PIL import Image  # noqa: E402

A.run_agy = argon_http.run_argon_http
OUT = Path(os.environ.get('CTFF6_PART_OUT', os.path.expanduser('~/spc-runs')))
MAX_ATTEMPTS = int(os.environ.get('SPC_ATTEMPTS', '5'))
DISTINCT_MIN = float(os.environ.get('SPC_DISTINCT_MIN', '0.45'))
T = C.TRANSPARENT


# ───────────────────────────── 주문서에 넣는 사실 표 ─────────────────────────────
def facts(bkey):
    """부위별(H·T·B·S) 베이스 글자 표와 윤곽 글자. 모델이 「모든 원래 색을 바꿔라」를 실행할 수 있게 글자·색·칸 수를 적는다."""
    pal, frames, labels, zones, info = P.segment(bkey)
    reg, edge = {}, Counter()
    for fk in frames:   # 12프레임 전부(걷기 프레임에만 나오는 글자도 표에 넣어야 모델이 recolor 한다 — 2026-10-16 3차)
        rows, lab = frames[fk], labels[fk]
        for y in range(C.FH):
            for x in range(C.FW):
                c = rows[y][x]
                if c == T:
                    continue
                reg.setdefault(lab[y][x], Counter())[c] += 1
                if any(not (0 <= x + dx < C.FW and 0 <= y + dy < C.FH) or rows[y + dy][x + dx] == T for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    edge[c] += 1
    hexo = lambda c: '#%02x%02x%02x' % pal[c]
    names = {'H': '머리·모자(편집 가능)', 'T': '상의(편집 가능)', 'B': '하의(recolor 만)', 'S': '신발(recolor 만)', 'F': '얼굴·맨살·손(고정)'}
    lines = []
    for r in 'HTBSF':
        cs = reg.get(r)
        if cs:
            lines.append(f'  {r} {names[r]}: ' + ' '.join(f'{c}={hexo(c)}({n})' for c, n in cs.most_common(14)))
    lum = lambda c: 0.299 * pal[c][0] + 0.587 * pal[c][1] + 0.114 * pal[c][2]
    outline = [c for c, _ in edge.most_common(10) if lum(c) < 110][:5] or [c for c, _ in edge.most_common(3)]
    return '\n'.join(lines), ' '.join(f'{c}={hexo(c)}' for c in outline), {r: set(cs) for r, cs in reg.items()}


def prompt(spec, cand, bkey, feedback, again):
    ftxt, outline, _ = facts(bkey)
    pal = H.base_of(bkey)[0]
    free = ' '.join(c for c in A.LETTERS if c not in pal)
    fb = ('\n[지난 시도에서 하네스가 거절한 이유 — 반드시 고쳐라]\n' + '\n'.join('- ' + e for e in feedback) + '\n') if feedback else ''
    redo = ('edit.json 이 이미 있다(직전 시도를 하네스가 부위 밖 칸·몸 칸 지우기를 되돌려 정리한 판이다). 그것을 고쳐 거절 사유만 해결해라.' if again else 'edit.json 이 아직 없다. 새로 쓴다.')
    return f'''{A.NO_GEN}

[과제] RPG Maker 2000 CharSet 규격(24×32) 걷기 칩 한 명을 **Scarloxy 몬스터 테이밍 팩 People 칩에서 의복·머리·모자·망토·가운 같은 윤곽이 달라지는 요소를 고쳐서** 만든다. 몬스터를 모으는 모험 세계의 「{spec['name']}」 인물이다(일반 직업 이름, 원작 이름·상표 없음).
- 인물 설명: {spec['concept']}
- 이번 후보의 방향: {cand['variant']}
- 공통 규칙: {spec['common']}

현재 폴더의 파일: base_*_1.txt(베이스의 서 있는 그림 격자, 글자는 palette.json) · mask_*_1.txt(같은 칸의 부위 마스크) · @base_6x.png(베이스 12프레임 6배: 행=위·오른쪽·아래·왼쪽, 열=걸음 0·1·2) · @masks_4x.png(왼쪽 베이스·오른쪽 마스크 색: 주황 H, 하늘 F 고정, 파랑 T, 보라 B, 갈색 S, 어두운 노랑/남=구역). 화풍 기준은 **베이스 칩 자신**이다 — 머리가 크고 윤곽이 검정이 아니라 색 있는 짙은 선이다. 베이스보다 크게 부풀리지 마라.
손에 든 소품·허리·등 장비(gear)는 쓰지 않는다. recolor 와 paint 만 쓴다.

[베이스의 부위별 글자 표 — 글자=색(칸 수)] (이 표의 H·T·B·S 글자는 **모두** 직업 색으로 recolor 해라. 한 글자라도 안 바꾸면 베이스와 같은 사람으로 읽혀 거절된다. 맨살 F 는 그대로.)
{ftxt}
베이스의 윤곽(바깥 둘레) 글자: {outline}
- 새로 그린 모자·옷·망토가 몸 밖으로 나온 바깥 둘레는 위 윤곽 글자(또는 recolor 로 새로 만든 어두운 글자)로 **한 칸 두께 이어서** 둘러라. 흰색·밝은 색이 실루엣 가장자리에 그대로 닿으면 「윤곽선이 끊겼다」로 거절된다.

[편집 규칙]
- paint 줄은 **베이스 줄을 그대로 복사한 뒤 바꿀 칸의 글자만 바꿔라**(24글자 한 줄 전체). 베이스의 불투명 칸(머리·몸)을 '.' 로 지울 수 없다 — 튀어나온 머리카락·챙을 없애고 싶으면 지우지 말고 새 모자색·머리색으로 칠해 그 일부로 만들어라.
- 마스크 밖 칸(얼굴·손·맨살 F, 허용 구역 밖 빈 칸)을 칠하면 하네스가 그 칸을 베이스 글자로 되돌린다. 빈 칸에 새로 올리는 부분은 h(머리 위 3줄)·t(몸통 옆 2칸) 구역 안에서 **세 칸 이상 이어진 덩어리**로만 그려라(한두 칸짜리 점은 지워진다).
- 오른쪽·왼쪽은 서로의 거울이 아니다 — 네 방향(down/up/right/left)에 각각 써라. 같은 사람이니 네 방향의 같은 부위는 같은 글자들을 쓴다.

{A.SCHEMA}

{A.RULES}

{A.STYLE}

사용 가능한 새 글자: {free}
{fb}
[작업 순서] {redo}답은 edit.json 내용 하나뿐이다(```json 코드블록).
'''


# ───────────────────────────── 자동 정리: paint 를 마스크에 맞춰 자름 ─────────────────────────────
def sanitize(bkey, edit):
    """paint 줄을 부위 마스크에 맞춘다 → (edit, notes{카테고리: 개수}). 12프레임 검증은 이 뒤 partedit 가 그대로 건다."""
    pal, bframes, labels, zones, info = P.segment(bkey)
    letters = set(pal) | set((edit.get('palette') or {}).keys())
    notes = Counter()
    keep = []
    rc = {}   # (부위, 베이스 글자) → recolor 가 만드는 새 글자. 같은 글자를 paint 로 또 적은 칸은 군더더기라 뺀다(행 교체 55% 한도를 아낀다).
    for r in edit.get('recolor') or []:
        for old, nw in ((r.get('map') or {}).items() if isinstance(r, dict) else ()):
            rc[(r.get('region'), old)] = nw
    for i, p in enumerate(edit.get('paint') or []):
        d, reg = p.get('dir'), p.get('region')
        if d not in C.DIRS or reg not in ('H', 'T'):
            notes['paint 의 dir/region 이 틀려 버림'] += 1
            continue
        zk = 'h' if reg == 'H' else 't'
        rows = {}
        for ys, text in (p.get('rows') or {}).items():
            try:
                y = int(ys)
            except Exception:  # noqa: BLE001
                notes['줄 번호가 숫자가 아니라 버림'] += 1
                continue
            if not (0 <= y < C.FH) or not isinstance(text, str) or len(text) != C.FW:
                notes[f'{d} 줄 {ys} 이 24글자가 아니라 버림'] += 1
                continue
            out = list(text)
            for x, ch in enumerate(text):
                cur = bframes[(d, 1)][y][x]
                lab = labels[(d, 1)][y][x]
                zone = (x, y) in zones[(d, 1)][zk]
                if not (lab == reg or zone):
                    if ch != cur:
                        out[x] = cur
                        notes['마스크 밖(얼굴·손·구역 밖) 칸을 베이스로 되돌림'] += 1
                elif ch == T and cur != T:
                    out[x] = cur
                    notes['베이스 몸 칸을 비운 것을 되돌림'] += 1
                elif cur != T and ch == rc.get((reg, cur)):
                    out[x] = cur
                    notes['recolor 와 같은 색을 paint 로 또 적은 칸을 정리'] += 1
                elif ch != T and ch not in letters:
                    out[x] = cur
                    notes[f"팔레트에 없는 글자 '{ch}' 칸을 되돌림(palette 에 정의하라)"] += 1
            rows[ys] = ''.join(out)
        keep.append(dict(p, rows=rows))
    edit = dict(edit, paint=keep)
    edit.pop('gear', None)
    extra = complete_recolor(bkey, edit, pal, bframes, labels)
    if extra:
        notes[f'걷기 프레임에만 있는 베이스 글자 {sum(len(m) for _, m in extra)}개를 가장 가까운 색의 recolor 대상 글자로 따라 바꿈'] += 1
    return edit, dict(notes)


def complete_recolor(bkey, edit, pal, bframes, labels):
    """recolor 가 안 닿은 (부위, 베이스 글자)를 같은 부위에서 색이 가장 가까운 recolor 글자의 새 글자로 따라 바꾼다(edit 에 덧붙임).
    서 있는 그림(걸음 1)에 없고 걷기 프레임(0·2)에만 나오는 글자는 모델이 못 봐서 베이스 색(붉은 신발 점 등)이 걸을 때만 깜박였다."""
    letters = set(pal) | set((edit.get('palette') or {}).keys())
    mapped = {}
    for r in edit.get('recolor') or []:
        if isinstance(r, dict):
            for old, nw in (r.get('map') or {}).items():
                mapped[(r.get('region'), old)] = nw
    seen = {}
    for fk, rows in bframes.items():
        for y in range(C.FH):
            for x in range(C.FW):
                c, reg = rows[y][x], labels[fk][y][x]
                if c != T and reg in 'HTBS':
                    seen[(reg, c)] = seen.get((reg, c), 0) + 1
    dist = lambda a, b: sum((u - v) ** 2 for u, v in zip(pal[a], pal[b]))
    extra = {}
    for (reg, c), n in sorted(seen.items(), key=lambda kv: -kv[1]):
        if (reg, c) in mapped:
            continue
        near = [(dist(c, o), o) for (r2, o) in mapped if r2 == reg and o in pal and pal.get(o) is not None]
        if not near:
            continue
        d, o = min(near)
        if d <= 90 ** 2 * 3 or n <= 24:   # 색이 멀어도 12프레임 합쳐 24칸 이하인 작은 베이스 글자(목걸이 점·단추)는 잡색으로 남지 않게 가까운 recolor 글자로 따라 바꾼다
            extra.setdefault(reg, {})[c] = mapped[(reg, o)]
    if extra:
        edit['recolor'] = list(edit.get('recolor') or []) + [dict(region=r, map=m) for r, m in extra.items()]
    return list(extra.items())


# ───────────────────────────── 한 시도 평가 ─────────────────────────────
def evaluate(bkey, adir, key):
    """→ (ok, result|None, errors[], info). info = 정리 기록."""
    p = Path(adir) / 'edit.json'
    try:
        edit = json.loads(p.read_text(encoding='utf-8'))
    except Exception as e:  # noqa: BLE001
        return False, None, [f'edit.json 읽기 실패: {e}'], {}
    edit, notes = sanitize(bkey, edit)
    p.write_text(json.dumps(edit, ensure_ascii=False, indent=1), encoding='utf-8')
    info = dict(sanitized=notes)
    try:
        pal, new, bframes, bpal, labels, zones, changed, kind, rep = P.apply_edits(bkey, edit)
    except Exception as e:  # noqa: BLE001
        return False, None, [f'편집 적용 실패: {e!r}'], info
    if rep['errors']:
        return False, None, rep['errors'], info
    new, dropped = R.drop_strays(new, bframes, kind)
    new, filled = R.fill_holes(new, bframes)
    info.update(dropped_stray_px=dropped, hole_filled_px=filled)
    errs, warns, m = P.verify(bkey, pal, new, bframes, bpal, labels, zones, changed, kind, gear_report=rep.get('gear'))
    info.update(metrics=m, warnings=warns)
    if errs:
        return False, None, list(errs), info
    P.render_preview(pal, new, Path(adir) / 'preview.png')
    return True, dict(pal=pal, frames=new, bframes=bframes, bpal=bpal, labels=labels), [], info


def unchanged_letters(res):
    """결과에도 그대로 남은 베이스 의상 글자(부위 H·T·B·S) — 「원래 색이 남았다」 되먹임용."""
    bpal, labels = res['bpal'], res['labels']
    left = Counter()
    for fk, rows in res['bframes'].items():
        if fk[1] != 1:
            continue
        for y in range(C.FH):
            for x in range(C.FW):
                b, n = rows[y][x], res['frames'][fk][y][x]
                if b != T and n == b and labels[fk][y][x] in 'HTBS':
                    left[(labels[fk][y][x], b)] += 1
    return [f'{r} 글자 {c}({"#%02x%02x%02x" % bpal[c]}) {n}칸' for (r, c), n in left.most_common(8)]


def summarize(errs):
    """오류를 중복 없이 묶어 구체 지시로 바꾼다."""
    out, seen = [], set()
    hints = []
    for e in errs:
        k = e.split(':')[0][:6] + e[-18:]
        if k in seen:
            continue
        seen.add(k)
        out.append(e)
    joined = ' '.join(errs)
    if '윤곽 픽셀 중 어두운 것' in joined:
        hints.append('윤곽: 새로 그린 모자·옷의 바깥 둘레가 밝다. 위 「베이스의 윤곽 글자」(또는 새로 만든 짙은 글자)로 바깥 한 칸 두께를 이어서 둘러라.')
    if '몸체 내부 투명 결손' in joined:
        hints.append('결손: 모자·머리 안쪽에 갇힌 빈 칸이 없게 한 덩어리로 칠해라(안쪽 칸을 . 로 남기지 마라).')
    if '방향 공통 색' in joined:
        hints.append('방향: 아래·위·옆에서 같은 사람으로 읽히게 H·T 부위에 쓴 색 글자를 네 방향 모두 같게 써라(recolor 는 모두에 적용되니 paint 에 쓴 글자만 맞추면 된다).')
    if '행 교체' in joined:
        hints.append('paint 분량: 행 교체 칸이 전체의 55% 를 넘었다. 모자·앞치마·망토처럼 꼭 필요한 덩어리만 paint 하고 나머지는 recolor 로 해결해라. 베이스 줄과 똑같은 줄은 rows 에 넣지 말고, 바꿀 줄만 적어라.')
    if '변경률' in joined:
        hints.append('변화량: recolor 를 H·T 의 모든 베이스 글자에 대해 써서 머리·상의 색이 절반 이상 바뀌게 해라.')
    return out[:10] + hints


# ───────────────────────────── 후보 하나 ─────────────────────────────
def make_candidate(spec, cand, key, run_dir, model):
    cdir = run_dir / key
    cdir.mkdir(parents=True, exist_ok=True)
    bkey = H.norm_base(cand['base'])
    meta = dict(key=key, arch=spec['id'], base=bkey, variant=cand['variant'], model=model, effort=A.EFFORT[model], attempts=[], harness='scarloxy_argon2')
    feedback, prev = [], None
    for n in range(1, MAX_ATTEMPTS + 1):
        adir = cdir / 'attempts' / str(n)
        adir.mkdir(parents=True, exist_ok=True)
        A.seed_workdir(adir, bkey, prev, None, False)
        code, out = argon_http.run_argon_http(adir, prompt(spec, cand, bkey, feedback, bool(prev)), f'try{n}', model)
        if not (adir / 'edit.json').exists():
            meta['attempts'].append(dict(n=n, code=code, errors=[f'응답 없음/파싱 실패: {out[:120]}'], at=A.now()))
            (cdir / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
            feedback = ['지난 응답을 edit.json 으로 읽지 못했다. ```json 코드블록 하나에 edit.json 내용만 써라.']
            time.sleep(10)
            continue
        ok, res, errs, info = evaluate(bkey, adir, key)
        dist = None
        if ok:
            pal2 = {'.': None, **{c: v for c, v in res['pal'].items() if any(c in r for rows in res['frames'].values() for r in rows)}}
            png = cdir / 'chip.png'
            C.sheet_rgba(pal2, res['frames']).save(png)
            s, near = D.nearest(png, exclude=(f'accepted:{key}',))
            dist = dict(score=round(float(s), 3), nearest=near)
            if s < DISTINCT_MIN and near.startswith('accepted:'):
                ok = False
                errs = [f'방금 채택된 {near[9:]} 와 다른 화소가 {s:.0%}뿐이다(최소 {DISTINCT_MIN:.0%}) — 같은 베이스에서 비슷한 색·모양이 됐다. 이 직군만의 색 계열(다른 색상군)과 모자·머리·옷깃 모양을 확실히 다르게 해라.']
            elif s < DISTINCT_MIN:
                ok = False
                errs = [f'가장 가까운 칩 {near} 와 다른 화소가 {s:.0%}뿐이다(최소 {DISTINCT_MIN:.0%}) — 뼈대 의상과 너무 같다. 아직 안 바뀐 베이스 글자: ' + '; '.join(unchanged_letters(res))
                        + '. 이 글자들을 모두 새 직업 색으로 recolor 하고 실루엣(모자·가운·망토 끝)도 더 키워라.']
        meta['attempts'].append(dict(n=n, code=code, errors=errs, info=info, distinct=dist, at=A.now()))
        (cdir / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
        if ok:
            (cdir / 'chip.chr.txt').write_text(C.dump(pal2, {}, res['frames'], header=f'{key} — {spec["name"]} / {cand["variant"]}\nbase {bkey} · {model}'))
            shutil.copy(adir / 'edit.json', cdir / 'edit.json')
            (OUT / 'accepted').mkdir(parents=True, exist_ok=True)
            shutil.copy(png, OUT / 'accepted' / f'{key}.png')
            meta.update(ok=True, warnings=info.get('warnings', []), metrics=info.get('metrics', {}), distinct=dist,
                        repairs=dict(dropped_stray_px=info.get('dropped_stray_px', 0), hole_filled_px=info.get('hole_filled_px', 0), sanitized=info.get('sanitized', {})))
            (cdir / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
            return meta
        san = info.get('sanitized') or {}
        feedback = summarize(errs) + ([f'(참고: 하네스가 정리한 것 — {k}: {v}건)' for k, v in san.items()] if san else [])
        prev = adir
        time.sleep(5)
    meta['ok'] = False
    (cdir / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    return meta


def cmd_draw(a):
    if a.model not in A.ALLOWED_MODELS:
        raise SystemExit(f'저작 모델은 {A.ALLOWED_MODELS} 만 허용한다')
    if not os.environ.get('OPRN_LIVE_KEY'):
        raise SystemExit('OPRN_LIVE_KEY 환경변수가 필요하다')
    spec = json.loads(Path(a.spec).read_text(encoding='utf-8'))
    run_dir = OUT / (a.run or datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
    run_dir.mkdir(parents=True, exist_ok=True)
    jobs = []
    for arch in spec['archetypes']:
        arch = dict(arch, common=spec['common'])
        for i, cand in enumerate(arch['candidates']):
            key = f'{arch["id"]}-{"abcdefgh"[i]}'
            if a.label and key not in a.label:
                continue
            jobs.append((arch, cand, key))
    par = max(1, min(a.par, 2))
    print('run', run_dir.name, '주문', len(jobs), [j[2] for j in jobs], '모델', a.model, '동시', par, flush=True)

    def one(j):
        try:
            m = make_candidate(j[0], j[1], j[2], run_dir, a.model)
        except Exception as e:  # noqa: BLE001 — 한 후보의 예외가 전체를 죽이지 않게
            m = dict(key=j[2], ok=False, attempts=[dict(errors=[f'{type(e).__name__}: {str(e)[:200]}'])])
        print(m['key'], 'OK' if m.get('ok') else 'FAIL', [len(t['errors']) for t in m['attempts']], (m.get('distinct') or {}).get('score', ''), flush=True)
        return m

    with ThreadPoolExecutor(max_workers=par) as ex:
        list(ex.map(one, jobs))
    print('done', run_dir.name, flush=True)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    d = sub.add_parser('draw')
    d.add_argument('--spec', required=True)
    d.add_argument('--model', default='gemini-4-argon-high')
    d.add_argument('--label', action='append')
    d.add_argument('--par', type=int, default=2)
    d.add_argument('--run')
    d.set_defaults(fn=cmd_draw)
    a = ap.parse_args()
    a.fn(a)


if __name__ == '__main__':
    main()
