#!/usr/bin/env python3
"""CT·FF6풍 원형 걷기 칩 — 베이스 칩 + 부위 편집 명령 방식(Agy gemini-4-argon, 2026-10-15 재설계).

사용자 방향: 격자 전체를 새로 쓰지 않는다. Actor·People 칩에서 베이스를 고르고, 의복·머리·장비만 마스크 안에서 고친다.
  1. 베이스(원형마다 지정, base-pick 시트에서 사용자가 고르거나 위임) → partedit.segment 가 부위 마스크를 만든다.
  2. 모델은 서 있는 그림 4방향 격자와 마스크를 보고 **edit.json**(palette · recolor · paint · gear)만 쓴다. 격자 전체를 쓰지 않는다.
  3. 하네스(partedit)가 편집을 12프레임에 옮기고(걷기 프레임은 베이스 대응으로, 왼쪽은 거울 복사 없이 방향별로)
     얼굴·맨살·눈·다리·걷기 포즈가 픽셀 단위로 그대로인지, 마스크 밖이 그대로인지, 튀어나온 한 칸이 없는지, 방향 간 색이 같은지 검사한다.
  4. 어기면 사유를 붙여 최대 3번 다시 고치게 한다(백오프). 눈 판정은 이 뒤에 사람이 한다(지표 통과는 합격이 아니다).

  python3 argon_part.py draw --spec ../../../harness-data/charset-actor/ct-ff6-part-pilot.json --model gemini-4-argon-high --run pilot4-high [--label tt-hero-boy-a]
  python3 argon_part.py sheet RUN [RUN ...] --spec <spec> --out ~/claude-viz/chips-ct-ff6-pick-4.html

저작 모델은 gemini-4-argon-high / gemini-4-argon-medium 둘만 허용한다(다른 모델 폴백 없음). 키는 읽지도 쓰지도 않는다.
고르는 것은 사용자뿐이다. 팩·번들·프로젝트에는 아무것도 설치하지 않는다. 사람 캐릭터라 3/4 관문(object-gate) 대상이 아니다.
"""
import argparse
import base64
import datetime
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
import partedit as P  # noqa: E402
from PIL import Image  # noqa: E402

OUT = Path(os.environ.get('CTFF6_PART_OUT', H.ROOT / 'qa-runs' / 'harnesses' / 'ct-ff6-part'))
ALLOWED_MODELS = ('gemini-4-argon-high', 'gemini-4-argon-medium')
TIMEOUT = int(os.environ.get('CTFF6_ARGON_TIMEOUT', str(25 * 60)))
MAX_ATTEMPTS = 3
BACKOFF = (60, 180, 420)
LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
EFFORT = {'gemini-4-argon-high': 'high', 'gemini-4-argon-medium': 'medium'}

NO_GEN = ('이미지 생성 기능·image-generator 서브에이전트·이미지 API 는 절대 쓰지 마라. 원·다각형·수식·필터로 몸을 합성하는 코드도 금지다. '
          '모든 픽셀은 네가 직접 글자로 적는다. 허용되는 코드는 partedit.py 를 실행하는 것뿐이다.')

RULES = '''[부위와 규칙 — 하네스가 12프레임 전부를 픽셀 단위로 검사한다]
마스크 글자: H=머리(머리카락·이마, 편집 가능) · F=얼굴·눈·맨살·손(**고정, 한 픽셀도 못 바꾼다**) · T=상의(소매 포함, 편집 가능) · B=하의(리컬러만) · S=신발(리컬러만)
구역(소문자, 베이스에는 빈 칸): h=머리 장식 구역(머리 위 3줄·이마 위, 모자·볏·안테나·머리띠) · t=어깨 구역(몸통 옆 2칸, 어깨받이·망토 끝). '.'=빈 칸(장비는 gear 로만 올릴 수 있다).
- **recolor**: 부위 안의 옛 글자를 새 글자로 바꾼다. 모든 프레임(걷기 포함)·모든 방향에 자동 적용된다. 가장 큰 변화는 대부분 이것으로 만들어라.
- **paint**: 서 있는 그림(_1)의 한 방향·한 부위(H 또는 T)의 행을 24글자 전체로 바꾼다. 그 부위의 칸(H 는 머리 장식 구역 h 포함, T 는 어깨 구역 t 포함)만 바뀌어야 하고, 부위 밖 글자는 베이스 그대로 적어야 한다(하나라도 다르면 거절). 베이스 모양을 남기고 일부만 고쳐라(H·T 각각 전체의 55% 이하).
  걷기 프레임(0·2)은 하네스가 같은 변경을 몸의 출렁임·팔 대응으로 옮긴다. 같은 모양을 네 방향(down/up/right/left)에 각각 써 줘야 하며 **오른쪽·왼쪽은 서로의 거울이 아니다**.
- **gear**(장비): 장비 하나 = kind(held 손에 든 것 · hip 허리 · back 등) + side(R/L = 캐릭터의 오른손·왼손) + **네 방향 모두**의 스프라이트 {rows, grip}.
  스프라이트는 그 방향에서 보이는 모양 그대로의 작은 글자 격자('.'=투명, 12폭×26줄·120칸 이하)이고, **grip 칸**(스프라이트 안의 불투명 칸)이 `anchors.txt` 의 앵커 칸에 겹친다. 하네스가 걷기 프레임마다 앵커를 손·몸과 함께 움직여 장비가 손과 같이 출렁이게 한다.
  - held: 앵커 = 그 손의 바깥 칸. 장비는 손 칸 위를 지나가고 **손(맨살·장갑 칸)은 장비 위에 그려진다**(주먹이 쥔 모양). 창·지팡이는 세로 막대로 그리고 grip 이 막대 가운데쯤에 오게 한다(창끝은 머리 위로). front 모드에서는 소매·옷 위에 겹쳐 그려지고, behind(먼 손) 모드는 몸 밖으로 삐져나온 부분만 보인다 — 옆모습에서 먼 손의 장비는 몸 뒤로 위·아래 삐져나오는 막대만 그려라.
  - **막대형 held(높이 8줄 이상: 창·지팡이·봉)의 방향별 규칙 — 자루가 몸을 가로지르면 거절한다**:
    · 아래(down)·위(up): 자루 2칸 폭. **grip 은 자루의 안쪽 열**(몸 쪽 열)에 둔다 — 자루는 손에서 몸 바깥쪽으로 반 칸 걸쳐 나온다. 손 칸 위에서 자루 2칸 이상이 주먹에 덮이고(주먹이 감싼다), 보이는 자루의 40% 이상이 몸 실루엣 밖이어야 한다. 몸 위에 서 있는 막대는 거절.
    · 오른쪽(right)·왼쪽(left)의 가까운 손: 앵커 = 손 줄의 **몸 앞쪽 가장자리 칸**(anchors.txt 마지막 줄). 자루는 거기서 몸 **바깥**(보는 방향 앞쪽)으로 나온다. 하네스가 몸 칸 위에는 자루를 그리지 않는다(몸이 가린다). 자루를 위로 갈수록 앞쪽으로 1~3칸 **비스듬히** 기울여(창끝이 머리 앞쪽 바깥에 오게) 머리·얼굴을 가로지르지 않게 해라. 보이는 자루가 프레임당 10칸 이상, 가려지는 칸은 절반 이하.
    · 먼 손(side L/R 중 안 보이는 쪽)은 몸 뒤로 막대 위아래만 보인다(기존 규칙).
  - hip: 칼집·가방. 앵커 = 허리 줄의 몸 가장자리 칸. front(아래·가까운 옆)에서는 옷 위에 붙어 그려지고, behind(위·먼 옆)에서는 몸 뒤로 삐져나온 부분만 보인다. 몸에 붙어 있어야지 떠 있으면 거절한다.
  - back: 굴뚝·배낭·망토 고정부. 앵커 = 어깨 뒤 중앙. 위(up)에서는 등 위에 그려지고, 다른 방향에서는 몸 뒤라 몸 밖으로 삐져나온 부분(주로 머리 위·어깨 위)만 보인다.
  - 얼굴·눈·맨살(F 칸)은 어떤 장비도 덮지 못한다. 모든 프레임에서 보이는 픽셀이 3칸 이상이고 앵커에 닿거나 겹쳐야 한다. 오른쪽·왼쪽은 서로의 거울이 아니니 각각 그려라.
- F 칸(얼굴·눈·맨살·손), 다리·걷기 포즈, 몸 비율, 프레임 간 출렁임은 건드릴 수 없다. 몸 칸을 투명으로 만들 수 없다. 실루엣 밖 새 픽셀은 프레임당 110칸 이하.'''

STYLE = '''[RTP 화풍 — @rtp_style_4x.png 옆에 서도 어색하면 안 된다]
- 재질마다 3톤 명암(밝음·중간·어두움), 빛은 왼쪽 위. 윤곽은 순수 검정이 아니라 그 재질의 가장 어두운 색. **디더링·체스판·점 흩뿌림 금지**: 같은 색은 면으로 모아 칠한다.
- 직업 표식을 위·옆·뒤에서도 보이게 한다. 세 방향(아래·위·옆)은 같은 사람(같은 머리색·옷색·팔레트 글자).
- 새 팔레트 글자는 베이스에 없는 글자만 쓴다(베이스 글자의 색은 못 바꾼다). 총 48색 이하.'''

SCHEMA = '''{
  "palette": {"Q": "#2a3a5a", "R": "#43587f"},                      // 새 글자(베이스에 없는 것만) → 색
  "recolor": [ {"region": "T", "map": {"i": "Q", "m": "R"}},         // 부위 H|T|B|S 안의 옛 글자 → 새 글자(모든 프레임에 적용)
               {"region": "H", "map": {"h": "Q"}} ],
  "paint":   [ {"dir": "down", "region": "H", "rows": {"9": "........QQRQQ...........", "10": "........Q..."}} ],   // 줄 번호 → 24글자 전체
  "gear":    [ {"name": "spear", "kind": "held", "side": "R", "sprites": {          // 네 방향 모두
                 "down": {"rows": ["ww", "kk", "kk", "kk"], "grip": [1, 2]},          // grip = 스프라이트 안의 불투명 칸 [x, y]
                 "up": {"rows": ["ww", "kk", "kk", "kk"], "grip": [1, 2]},
                 "right": {"rows": ["ww", "kk", "kk", "kk"], "grip": [1, 2]},
                 "left": {"rows": ["kk", "kk"], "grip": [0, 1]} }} ]
}'''


def now():
    return datetime.datetime.now().isoformat(timespec='seconds')


def agy_bin():
    return shutil.which('agy') or os.path.expanduser('~/.local/bin/agy')


def seed_workdir(adir, base_key, prev=None, seed_edit=None, cand_keep_gear=False):
    nk = base_key if '@' in base_key else H.norm_base(base_key)
    pal, frames, labels, zones, info = P.segment(nk)
    (adir / 'base.json').write_text(json.dumps(dict(base=nk), ensure_ascii=False))
    json.dump({k: '#%02x%02x%02x' % v for k, v in pal.items() if v is not None}, open(adir / 'palette.json', 'w'), indent=1)
    for d in C.DIRS:
        (adir / f'base_{d}_1.txt').write_text('\n'.join(frames[(d, 1)]) + '\n')
        (adir / f'mask_{d}_1.txt').write_text('\n'.join(P.mask_grid(labels, zones, d, 1)) + '\n')
    if prev and (prev / 'edit.json').exists():
        shutil.copy(prev / 'edit.json', adir / 'edit.json')
    elif seed_edit:
        ed = json.loads(Path(seed_edit).read_text(encoding='utf-8'))
        if not cand_keep_gear:
            ed.pop('gear', None)      # 의복·머리 편집은 이어받고 장비는 새 규칙으로 다시 쓴다
        (adir / 'edit.json').write_text(json.dumps(ed, ensure_ascii=False, indent=1))
    plain = Image.new('RGBA', (72, 128), (92, 140, 70, 255))
    plain.alpha_composite(C.sheet_rgba(pal, frames))
    plain.resize((72 * 6, 128 * 6), Image.NEAREST).convert('RGB').save(adir / 'base_6x.png')
    mi, _ = P.mask_image(nk, 4)
    mi.save(adir / 'masks_4x.png')
    tbl, _, _ = P.anchor_table(nk)
    (adir / 'anchors.txt').write_text(tbl + '\n', encoding='utf-8')
    P.anchor_image(nk, 6).save(adir / 'anchors_6x.png')
    style = H.HDATA / 'rtp_style_4x.png'
    if not style.exists():
        import argon_chip as AC
        AC.make_style_sheet(style)
    shutil.copy(style, adir / 'rtp_style_4x.png')
    return pal, info


def prompt(spec, cand, pal, info, feedback, again):
    if cand.get('gear_task'):
        return prompt_gear(spec, cand, pal, info, feedback, again)
    free = ' '.join(c for c in LETTERS if c not in pal)
    fb = ('\n[지난 시도에서 하네스가 거절한 이유 — 반드시 고쳐라]\n' + '\n'.join('- ' + e for e in feedback) + '\n') if feedback else ''
    robot = ('\n[이 원형은 기계다] 머리의 맨살 색 칸도 H 부위라 금속·구리로 칠할 수 있다. 눈 줄(F 상자)만 그대로 남는다 — 눈 줄을 투명 유리창처럼 읽히게 주변을 칠하고, 얼굴 표정을 만들려 하지 마라.\n' if info.get('robot') else '')
    redo = 'edit.json 이 이미 있다(네가 쓴 직전 시도). 그것을 고쳐 거절 사유만 해결해라.\n' if again else 'edit.json 이 아직 없다. 새로 쓴다.\n'
    return f'''{NO_GEN}

[과제] RPG Maker 2000 CharSet 규격(24×32) 걷기 칩 한 명을 **베이스 칩에서 의복·머리·장비만 고쳐서** 만든다. 크로노 트리거·FF6풍 RPG 의 「{spec['name']}」 원형이다.
원작 게임의 실제 캐릭터를 베끼거나 닮게 그리지 않는다. 직업 원형만 독자 디자인으로 그린다.
- 원형 설명: {spec['concept']}
- 이번 후보의 방향: {cand['variant']}
- 공통 규칙: {spec['common']}{robot}

현재 폴더: anchors.txt(장비 앵커 칸 표) · anchors_6x.png(앵커 표시 그림) · base_down_1.txt · base_up_1.txt · base_right_1.txt · base_left_1.txt (베이스의 서 있는 그림 격자, 글자는 palette.json), mask_*_1.txt (같은 칸의 부위 마스크), @base_6x.png(베이스 12프레임 6배: 행=위·오른쪽·아래·왼쪽, 열=걸음 0·1·2), @masks_4x.png(왼쪽 베이스·오른쪽 마스크 색: 주황 H, 하늘 F 고정, 파랑 T, 보라 B, 갈색 S, 어두운 노랑/남/초록=구역), @rtp_style_4x.png(같은 칩셋의 다른 캐릭터들).
먼저 그림들과 anchors.txt 를 직접 열어 베이스의 모양·손 위치를 파악해라. **격자 전체를 새로 쓰지 않는다.** 아래 형식의 **edit.json** 한 파일만 쓴다.

{SCHEMA}

{RULES}

{STYLE}

사용 가능한 새 글자: {free}
{fb}
[작업 순서] {redo}edit.json 을 쓴 뒤 `python3 {HERE / 'partedit.py'} apply .` 를 실행하면 하네스와 같은 검증을 하고 preview.png(12프레임 6배)를 쓴다. 오류가 없을 때까지 고치고, preview.png 를 **직접 열어** 얼굴·직업 표식·네 방향의 같은 사람·잡티·튀어나온 한 칸을 눈으로 확인한 뒤 끝내라. 끝나면 'done' 한 단어만 답하라.
'''


def prompt_gear(spec, cand, pal, info, feedback, again):
    try:
        used = set(json.loads((Path(info['adir']) / 'edit.json').read_text()).get('palette', {}))
    except Exception:
        used = set()
    free = ' '.join(c for c in LETTERS if c not in pal and c not in used)
    fb = ('\n[지난 시도에서 하네스가 거절한 이유 — 반드시 고쳐라]\n' + '\n'.join('- ' + e for e in feedback) + '\n') if feedback else ''
    return f'''{NO_GEN}

[과제 — 장비 다시 붙이기] 「{spec['name']}」 칩의 의복·머리 편집(edit.json 의 palette·recolor·paint)은 이미 사용자에게 보여 준 그림이고 **건드리지 않는다**. 문제는 장비였다: 지난 판의 장비는 몸 옆에 떠서 손과 이어지지 않고 따로 놀았다. 이번에는 **gear 만** 새 규칙(앵커)으로 처음부터 다시 쓴다. edit.json 에서 gear 키만 새로 쓰고 나머지 키는 그대로 둔다.
- 원형 설명: {spec['concept']}
- 이번에 올릴 장비: {cand['gear_task']}

현재 폴더: anchors.txt(장비 앵커 칸 표) · @anchors_6x.png(앵커를 베이스에 표시: 초록=held R 손, 하늘=held L 손, 노랑=hip R 허리, 분홍=back 등. 4방향 down·up·right·left) · @base_6x.png · @masks_4x.png · base_*_1.txt · mask_*_1.txt · edit.json(이미 의복·머리 편집이 있음).
먼저 anchors_6x.png 와 anchors.txt 를 직접 열어 손·허리·등 앵커 위치를 확인해라.

{RULES}

[장비가 읽혀야 하는 모습]
- **손이 장비를 쥔다**: held 장비는 grip 칸이 손 칸에 겹치고 손(주먹 칸)은 장비 위에 그려진다. 8배로 걷기를 볼 때 막대 한가운데를 주먹이 감싸 쥔 모양이어야 하고, 막대는 몸 옆에 떨어져 서 있는 것처럼 보이면 안 된다. 창은 주먹 위아래로 막대가 나오고 창끝은 머리 위로 올라온다.
- 걷기 프레임에서는 하네스가 앵커를 손·몸과 같이 상하·앞뒤로 옮긴다. 장비는 손과 같이 출렁인다. 따로 맞출 필요 없다.
- 위(up)에서는 몸 뒤로 삐져나온 부분만(held), 아래(down)에서는 몸 앞에 보인다. 옆모습의 먼 손 장비는 몸 뒤로 막대 끝만 보인다.
- 스프라이트는 네 방향 모두 다시 그린다(방향마다 보이는 모양·길이를 맞춘다). 색은 기존 팔레트 글자를 쓰거나 새 글자를 palette 에 추가한다(쓸 수 있는 새 글자: {free}).
{fb}
[작업 순서] `python3 {HERE / 'partedit.py'} apply .` 로 검증하고 preview.png(12프레임 6배)를 **직접 열어** 손이 장비를 쥔 모습이 읽히는지·장비가 떠 있지 않은지·네 방향이 같은 장비인지를 눈으로 확인해 고쳐라. 끝나면 'done' 한 단어만 답하라.
'''


def run_agy(cwd, text, label, model):
    t0 = time.time()
    try:
        r = subprocess.run([agy_bin(), '-p', text, '--model', model, '--output-format', 'text'], cwd=cwd,
                           capture_output=True, text=True, timeout=TIMEOUT)
        out, code = (r.stdout or '') + (r.stderr or ''), r.returncode
    except subprocess.TimeoutExpired:
        out, code = 'timeout', 124
    (Path(cwd) / f'agy-{label}.log').write_text('exit=%s sec=%.0f\n%s' % (code, time.time() - t0, out[-4000:]))
    return code, out


def make_candidate(spec, cand, key, run_dir, model):
    cdir = run_dir / key
    cdir.mkdir(parents=True, exist_ok=True)
    base_key = cand['base'] if '@' in cand['base'] else H.norm_base(cand['base'])
    meta = dict(key=key, arch=spec['id'], base=base_key, variant=cand['variant'], model=model, effort=EFFORT[model], attempts=[],
                delegated=cand.get('delegated', ''), before=cand.get('before', ''), gear_task=cand.get('gear_task', ''))
    feedback, prev = [], None
    for n in range(1, MAX_ATTEMPTS + 1):
        adir = cdir / 'attempts' / str(n)
        adir.mkdir(parents=True, exist_ok=True)
        pal, info = seed_workdir(adir, base_key, prev, cand.get('seed_edit'), bool(cand.get('keep_gear')))
        info['adir'] = str(adir)
        code, out = run_agy(adir, prompt(spec, cand, pal, info, feedback, bool(prev)), f'try{n}', model)
        res, errs, warns, m = P.run_apply(adir, write=True)
        meta['attempts'].append(dict(n=n, agy_exit=code, errors=errs, warnings=warns, at=now()))
        (cdir / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
        if res:
            pal2 = {'.': None, **{c: v for c, v in res['pal'].items() if any(c in r for rows in res['frames'].values() for r in rows)}}
            (cdir / 'chip.chr.txt').write_text(C.dump(pal2, {}, res['frames'], header=f'{key} — {spec["name"]} / {cand["variant"]}\nbase {base_key} · {model}'))
            C.sheet_rgba(pal2, res['frames']).save(cdir / 'chip.png')
            shutil.copy(adir / 'edit.json', cdir / 'edit.json')
            meta.update(ok=True, warnings=warns, metrics=m)
            (cdir / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
            return meta
        feedback, prev = errs, adir
        if not (adir / 'edit.json').exists() or code == 124:
            time.sleep(BACKOFF[min(n - 1, len(BACKOFF) - 1)])
        elif n < MAX_ATTEMPTS:
            time.sleep(10)
    meta['ok'] = False
    (cdir / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    return meta


def cmd_draw(a):
    if a.model not in ALLOWED_MODELS:
        raise SystemExit(f'저작 모델은 {ALLOWED_MODELS} 만 허용한다')
    spec = json.loads(Path(a.spec).read_text(encoding='utf-8'))
    run = a.run or datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + EFFORT[a.model]
    run_dir = OUT / run
    run_dir.mkdir(parents=True, exist_ok=True)
    jobs = []
    for arch in spec['archetypes']:
        arch = dict(arch, common=spec['common'])
        for i, cand in enumerate(arch['candidates']):
            key = f'{arch["id"]}-{"abcdefgh"[i]}'
            if a.label and key not in a.label:
                continue
            jobs.append((arch, cand, key))
    print('run', run, '주문', [j[2] for j in jobs], '모델', a.model, '동시', min(a.par, 2), flush=True)
    with ThreadPoolExecutor(max_workers=max(1, min(a.par, 2))) as ex:
        res = list(ex.map(lambda j: make_candidate(j[0], j[1], j[2], run_dir, a.model), jobs))
    for m in res:
        print(m['key'], 'OK' if m.get('ok') else 'FAIL', [len(t['errors']) for t in m['attempts']], flush=True)
    print(run)


# ─────────────────────────────── 시트 ───────────────────────────────
def b64png(im):
    b = io.BytesIO()
    im.save(b, 'PNG')
    return base64.b64encode(b.getvalue()).decode()


def gif_b64(pal, frames, scale):
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / 'w.gif'
        C.gif_walk(pal, frames, out, scale=scale, lawn=None, ms=170)
        return base64.b64encode(out.read_bytes()).decode()


def diff_image(base_key, pal, frames, scale=4):
    """베이스 대비 바뀐 칸(빨강)과 고정 부위(하늘색 테두리 없음) 표시 — 12프레임."""
    bpal, bframes, labels, zones, _ = P.segment(base_key)
    gap = 3
    im = Image.new('RGBA', (3 * (24 + gap), 4 * (32 + gap)), (30, 30, 30, 255))
    for di, d in enumerate(C.DIRS):
        for f in range(3):
            ox, oy = f * (24 + gap), di * (32 + gap)
            for y in range(32):
                for x in range(24):
                    n, b = frames[(d, f)][y][x], bframes[(d, f)][y][x]
                    if n == '.' and b == '.':
                        continue
                    nc = pal.get(n) if n != '.' else None
                    bc = bpal.get(b) if b != '.' else None
                    if nc != bc:
                        im.putpixel((ox + x, oy + y), (235, 60, 60, 255))
                    else:
                        v = nc or bc
                        im.putpixel((ox + x, oy + y), (v[0] // 2 + 60, v[1] // 2 + 60, v[2] // 2 + 60, 255))
    return im.resize((im.width * scale, im.height * scale), Image.NEAREST).convert('RGB')


def cmd_sheet(a):
    spec = json.loads(Path(a.spec).read_text(encoding='utf-8'))
    names = {x['id']: x for x in spec['archetypes']}
    order = [x['id'] for x in spec['archetypes']]
    notes = dict(n.split('=', 1) for n in a.note)
    groups = {}
    for run in a.runs:
        for cd in sorted((OUT / run).iterdir()):
            if (cd / 'chip.chr.txt').exists():
                meta = json.loads((cd / 'meta.json').read_text())
                meta['run'] = run
                groups.setdefault(meta['arch'], []).append((cd, meta))
    base_cache, sections = {}, []
    for arch in sorted(groups, key=lambda x: order.index(x) if x in order else 99):
        info = names.get(arch, {})
        cards = []
        for cd, meta in sorted(groups[arch], key=lambda t: (t[1]['key'], t[1]['effort'] != 'high')):
            pal, _, frames = C.load(cd / 'chip.chr.txt')
            bk = meta['base']
            if bk not in base_cache:
                bp, bf = H.base_of(bk.split("@")[0])
                base_cache[bk] = (gif_b64(bp, bf, 2), gif_b64(bp, bf, 8))
            ctx = C.context(pal, frames, H.ACTOR1, scale=4, lawn=None, others=(0, 1, 3, 6))
            diff = diff_image(bk, pal, frames)
            before_html = ''
            if meta.get('before'):
                bpal2, _, bfr2 = C.load(OUT / meta['before'] / 'chip.chr.txt')
                before_html = (f'<figure><img src="data:image/gif;base64,{gif_b64(bpal2, bfr2, 2)}"><figcaption>수정 전(pick-4) 2×</figcaption></figure>')
                before8 = f'<img class="big" src="data:image/gif;base64,{gif_b64(bpal2, bfr2, 8)}"><div class="cap">수정 전(pick-4, 장비가 몸 옆 띠에 떠 있음) 8× 걷기</div>'
            else:
                before8 = ''
            nk = f'{meta["key"]}/{meta["effort"]}'
            note = notes.get(nk) or notes.get(meta['key'])
            card = (f'<div class="card" id="{html.escape(meta["key"])}-{meta["effort"]}"><div class="id">{html.escape(meta["key"])} '
                    f'<span class="eff {meta["effort"]}">Argon {meta["effort"]}</span> <small>베이스 {html.escape(H.base_label(bk.split("@")[0]))}{(" · " + html.escape(meta["delegated"])) if meta.get("delegated") else ""} · 시도 {len(meta["attempts"])}회</small></div>'
                    f'<p class="var">{html.escape(meta["variant"])}</p>'
                    f'<div class="cmp"><figure><img src="data:image/gif;base64,{base_cache[bk][0]}"><figcaption>베이스 원본 2×</figcaption></figure>{before_html}'
                    f'<figure><img src="data:image/gif;base64,{gif_b64(pal, frames, 2)}"><figcaption>후보 2× (위·오른쪽·아래·왼쪽)</figcaption></figure>'
                    f'<figure><img src="data:image/png;base64,{b64png(ctx)}"><figcaption>Actor1 옆 비교 4×(Actor1 4명 → 후보 아래·왼쪽·위·오른쪽)</figcaption></figure></div>'
                    f'{before8}<img class="big" src="data:image/gif;base64,{gif_b64(pal, frames, 8)}"><div class="cap">후보 8× 걷기{" (수정 후: 앵커에 묶인 장비)" if meta.get("before") else ""}</div>'
                    f'<details><summary>베이스 8× 걷기 · 바뀐 칸(빨강) 12프레임 4×</summary><img class="big" src="data:image/gif;base64,{base_cache[bk][1]}">'
                    f'<img src="data:image/png;base64,{b64png(diff)}"></details>'
                    + (f'<p class="note">눈 검수 소견: {html.escape(note)}</p>' if note else '') + '</div>')
            cards.append(card)
        sections.append(f'<h2>{html.escape(info.get("name", arch))} <small>{html.escape(arch)} · {html.escape(info.get("genre", ""))}</small></h2>'
                        f'<p class="concept">{html.escape(info.get("concept", ""))}</p><div class="row">{"".join(cards)}</div>')
    total = sum(len(v) for v in groups.values())
    page = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>{html.escape(a.title)}</title>
<style>body{{background:#161a1d;color:#e6e6e6;font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px 32px}}h1{{margin:0 0 6px}}h2{{margin:36px 0 2px;border-bottom:1px solid #3a4248;padding-bottom:4px}}small{{color:#8fa0aa;font-weight:400;font-size:13px}}
.how{{background:#1f272c;border:1px solid #3a4a55;border-radius:8px;padding:14px 18px;margin:12px 0 8px;max-width:1040px}}.how code{{background:#0e1214;padding:1px 6px;border-radius:4px}}.concept{{color:#aab6bd;margin:2px 0 10px;max-width:1040px}}
.row{{display:flex;flex-direction:column;gap:18px}}.card{{background:#1d2328;border:1px solid #333c43;border-radius:8px;padding:12px;width:1040px}}.id{{font:600 16px ui-monospace,monospace;color:#ffd479;margin-bottom:2px}}.eff{{font-size:12px;padding:1px 8px;border-radius:10px;color:#101418}}.eff.high{{background:#7fe08a}}.eff.medium{{background:#e8b86d}}
.var{{color:#9fb0ba;margin:2px 0 8px;font-size:13px}}.cmp{{display:flex;gap:16px;margin-bottom:8px;align-items:flex-end;flex-wrap:wrap}}figure{{margin:0}}figcaption,.cap{{color:#8fa0aa;font-size:12px}}img{{image-rendering:pixelated}}.big{{display:block;max-width:100%;margin:6px 0}}details{{margin-top:8px}}.note{{color:#e8b86d;font-size:13px;margin:4px 0 0}}</style>
<h1>{html.escape(a.title)}</h1>
<div class="how">{a.intro}<b>방식</b>: 격자를 새로 쓰지 않고, 베이스 칩(Actor·People)의 <b>머리·상의·하의·신발·장비</b>만 마스크 안에서 고칩니다. 얼굴(눈·입)·맨살·몸 비율·다리·걷기 포즈·출렁임은 하네스가 12프레임 전부 픽셀 대조로 불변을 검증합니다. 왼쪽 방향은 거울 복사가 아니라 베이스의 왼쪽 그림에 방향별로 편집을 올립니다.<br>
<b>사용자 위임: ★ 추천 베이스로 진행</b> — 베이스는 각 카드에 표시. 저작 모델은 카드의 <span class="eff high">Argon high</span> / <span class="eff medium">Argon medium</span> 표기를 따릅니다. 마음에 드는 후보의 <code>id</code>를 채팅에 적어 주세요. 고르기 전에는 팩·번들·프로젝트에 설치하지 않습니다. 후보 {total}종 · 실행 {html.escape(", ".join(a.runs))}</div>
{"".join(sections)}</html>'''
    out = Path(a.out).expanduser()
    out.write_text(page, encoding='utf-8')
    print(out, total, '종', len(page), 'bytes')


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    d = sub.add_parser('draw')
    d.add_argument('--spec', required=True)
    d.add_argument('--model', required=True)
    d.add_argument('--label', action='append')
    d.add_argument('--par', type=int, default=2)
    d.add_argument('--run')
    d.set_defaults(fn=cmd_draw)
    s = sub.add_parser('sheet')
    s.add_argument('runs', nargs='+')
    s.add_argument('--spec', required=True)
    s.add_argument('--out', required=True)
    s.add_argument('--note', action='append', default=[])
    s.add_argument('--title', default='CT·FF6 걷기 칩 — 베이스 칩 + 부위 편집 (Agy gemini-4-argon)')
    s.add_argument('--intro', default='')
    s.set_defaults(fn=cmd_sheet)
    a = ap.parse_args()
    a.fn(a)


if __name__ == '__main__':
    main()
