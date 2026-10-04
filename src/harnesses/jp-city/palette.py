"""modern3 팔레트 → pxgrid 팔레트(`palette.pal`)와 재료 글자표(`mats.txt`).

정본은 `tiledata/atlas-pick/palette/modern3.pal`(28램프 · 154색, 규칙 기반 생성 파일)이다. 이 모듈은 색을 만들지 않는다 — 램프를 그대로 읽어
pxgrid 가 읽는 `@rampc` 줄로 옮기고, 작업자가 파일 머리에 붙여 쓸 `@mat 글자 램프 기본단` 표를 만든다(램프 28개 → 글자 a–z, A, B).

154색은 한 글자 한 색 방식(글자 62개)으로 못 담는다. 그래서 pxgrid 의 램프 격자(`@mblock`·`@tblock`·`@tadj`)를 쓴다 — 선례 `tiledata/atlas-pick/candidates-jp/*/palette.pal`.
반투명 색은 없다(modern3 규칙 4). 마커 `#` = `#e040c0` 은 실루엣 단계 표시용이며 최종본에 남으면 불합격.
"""
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SRC = os.path.join(ROOT, 'tiledata/atlas-pick/palette/modern3.pal')
MARKER = '#e040c0'
MAT_LETTERS = 'abcdefghijklmnopqrstuvwxyzAB'


def ramps():
    """[(램프 이름, [#hex, …](어두운→밝은), 설명)] — modern3.pal 의 `//` 주석 줄이 바로 다음 램프의 설명."""
    out, desc = [], ''
    for ln in open(SRC, encoding='utf-8'):
        s = ln.strip()
        if s.startswith('//'):
            desc = s[2:].strip()
            continue
        m = re.match(r'@rampc\s+(\S+)\s+(.*)', s)
        if m:
            out.append((m.group(1), ['#' + h.lower() for h in re.findall(r'#([0-9a-fA-F]{6})', m.group(2))], desc)); desc = ''
    return out


def base_tone(n):
    """램프의 기본 단(t0): 7단 → 3, 5단 → 2, 3단 → 1. modern3.pal 머리말 「3 = 기본 t0」."""
    return {7: 3, 5: 2}.get(n, 1)


def all_colors():
    return {h for _, cols, _ in ramps() for h in cols}


def write_pal(path):
    lines = ['// jp-city 하네스 팔레트 — 생성 파일(palette.py). 정본 tiledata/atlas-pick/palette/modern3.pal (28램프 · 154색). 손으로 색을 더하지 마라.',
             '// 격자 쓰는 법: `@mat 글자 램프 기본단` 으로 재료 글자를 정하고 `@mblock`(재료)·`@tblock`(단)·`@tadj`(단 옮김). 단 0 = 가장 어두움. 반투명 없음.',
             '// `.` 투명/그대로, `_` 지우기, `#` 실루엣 단계 표시색(최종본에 남으면 불합격)']
    for name, cols, desc in ramps():
        lines.append(f'// {desc}' if desc else f'// {name}')
        lines.append(f'@rampc {name} ' + ' '.join(cols))
    lines.append(f'# {MARKER}   // 실루엣 단계 표시색(최종본 금지)')
    open(path, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')


def mats_snippet():
    """작업자가 .pxg 의 `@palette` 아래에 그대로 붙여 쓰는 `@mat` 줄들."""
    return '\n'.join(f'@mat {MAT_LETTERS[i]} {name} {base_tone(len(cols))}' for i, (name, cols, _) in enumerate(ramps()))


def write_mats(path):
    open(path, 'w', encoding='utf-8').write(mats_snippet() + '\n')


def legend():
    """brief.md 용 표: 글자 | 램프 | 단 수 | 용도 | 색(어두운→밝은)."""
    rows = ['| 글자 | 램프 | 단 | 용도 | 색 (단 0 → 끝) |', '|---|---|---|---|---|']
    for i, (name, cols, desc) in enumerate(ramps()):
        rows.append(f'| `{MAT_LETTERS[i]}` | `{name}` | {len(cols)} (기본 {base_tone(len(cols))}) | {desc} | {" ".join(cols)} |')
    return '\n'.join(rows)


if __name__ == '__main__':
    d = os.path.join(ROOT, 'harness-data/jp-city'); os.makedirs(d, exist_ok=True)
    write_pal(os.path.join(d, 'palette.pal')); write_mats(os.path.join(d, 'mats.txt'))
    r = ramps(); print(f'램프 {len(r)}개 · 색 {len(all_colors())}개 → harness-data/jp-city/palette.pal, mats.txt')
