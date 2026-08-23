"""삼중 검산: 내 측정값 vs codex(GPT) 판독 vs agy(Gemini) 판독.

    python scripts/se/cross-check-se.py [--staging dist/se-staging]

왜 필요한가: 라벨을 붙인 에이전트는 소리를 못 듣고 스펙트로그램만 본다. 같은 그림을 계열이
다른 두 모델에게 **블라인드로**(타일에 측정값을 찍지 않은 시트) 읽히면, 내 신호처리 검출기가
그림과 어긋나는 지점을 골라낼 수 있다. 셋이 일치하는 항목은 감독이 들을 필요가 없고,
어긋나는 항목만 오디션 페이지 맨 위로 올라간다 — 감독의 왕복이 456개에서 수십 개로 준다.

전제:
- 블라인드 시트와 매핑: `analyze-se-audio.py --blind` (blind-sheet-*.png, blind-sheet-map.json)
- 판독 결과: `dist/se-staging/run-reviewers.sh` → review/codex-<n>.txt, review/agy-<n>.txt

판정 축은 **그림으로 실제 판별되는 것만**이다(음색 형용사·장단조는 넣지 않는다):
- 방향(dir): 주선율이 오르는지 내리는지. 징글의 승리/실패를 가르는 축.
- 음 이벤트 수(onsets): ±1 은 일치로 본다 — 플럭스 피크와 눈으로 센 버스트는 그 정도 흔들린다.
- 음색(timbre): 배음선이 뚜렷한 악음 vs 광대역 잡음.

판정 원칙:
- **방향 뒤바뀜(dir-flip)만 사실 충돌로 본다.** 한쪽은 UP, 한쪽은 DOWN 이면 둘 중 하나가 틀렸다.
- 내가 방향을 주장하고 검토자는 FLAT/NONE 이라면 이건 **크기 이주**다(dir-weak). 내 임계값은
  ±1.5반음이라 1~2반음 변화는 그림에서 거의 평평하게 보이는 게 정상이다 — 임계값 다툼을 항목
  거짓으로 오인하지 않는다. 단 |반음| 이 큼다면(기본 3st 이상) 그림에 보여야 하므로 우선새림만 올린다.
- 음색은 임계값 해석 차이가 클 수 있으므로 항상 약한 불일치(soft)로 둔다.
- **검토자 둘만 서로 일치하고 내가 어긋나면 가장 강한 신호**다(`odd=mine`). 검토자들도 서로
  어긋나면 그 타일은 그림으로 안 갈리는 것이다(`odd=ambiguous`) — 사람 귀로 넘긴다.
"""
import argparse, json, os, re, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LINE = re.compile(r'^\D{0,4}(\d{1,2})\s*\|\s*(UP|DOWN|FLAT|NONE)\s*\|\s*(\d+)\s*\|\s*(TONAL|NOISY)',
                  re.IGNORECASE)
# 내 contour 어휘 → 방향 버킷. '평탄'(피치는 있고 일정)·'무피치'·'미세…'(변화폭이 작아 그림으로는
# 보이지 않는 범위)는 방향을 주장하지 않는다는 점에서 같은 판정이므로 한 버킷으로 접는다.
DIR_OF_MINE = {'상승': 'UP', '하강': 'DOWN', '미세상승': 'NONE-DIR', '미세하강': 'NONE-DIR',
               '평탄': 'NONE-DIR', '무피치': 'NONE-DIR'}
DIR_OF_REVIEW = {'UP': 'UP', 'DOWN': 'DOWN', 'FLAT': 'NONE-DIR', 'NONE': 'NONE-DIR'}


def parse_review(path):
    """한 시트 판독 텍스트 → {타일번호: dict}. 형식을 벗어난 줄은 버린다."""
    out = {}
    if not os.path.exists(path):
        return out
    for raw in open(path, encoding='utf-8', errors='replace'):
        m = LINE.match(raw.strip())
        if not m:
            continue
        code = '%02d' % int(m.group(1))
        out[code] = dict(dir=DIR_OF_REVIEW[m.group(2).upper()],
                         onsets=int(m.group(3)),
                         timbre=m.group(4).upper())
    return out


def _rate(rows, axis):
    """내 판정과 검토자 판독이 얼마나 간다 — 축당 백분율. 음수는 ±1 을 일치로 본다."""
    tot = hit = 0
    for r in rows:
        for tool in ('codex', 'agy'):
            v = r.get(tool)
            if not v:
                continue
            tot += 1
            if axis == 'onsets':
                hit += abs(v['onsets'] - r['mine']['onsets']) <= 1
            else:
                hit += v[axis] == r['mine'][axis]
    return round(100 * hit / tot) if tot else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--staging', default=os.path.join(REPO, 'dist', 'se-staging'))
    # 방향 크기가 이보다 큼다면 검토자가 FLAT 이라 해도 그림에 보여야 한다는 기준(반음).
    ap.add_argument('--weak-semitones', type=float, default=3.0)
    args = ap.parse_args()
    st = os.path.abspath(args.staging)

    feats = json.load(open(os.path.join(st, 'audio-features.json'), encoding='utf-8'))
    sheet_map = json.load(open(os.path.join(st, 'blind-sheet-map.json'), encoding='utf-8'))
    review_dir = os.path.join(st, 'review')

    reviews = {}   # tool → {id: reading}
    coverage = {}  # tool → 판독된 타일 수
    for tool in ('codex', 'agy'):
        got = {}
        for sheet, codes in sheet_map.items():
            n = re.search(r'-(\d+)\.png$', sheet).group(1)
            parsed = parse_review(os.path.join(review_dir, '%s-%s.txt' % (tool, n)))
            for code, rid in codes.items():
                if code in parsed:
                    got[rid] = parsed[code]
        reviews[tool] = got
        coverage[tool] = len(got)

    rows = []
    for rid, f in feats.items():
        mine = dict(dir=DIR_OF_MINE[f['contour']], onsets=f['onsets'],
                    timbre='TONAL' if f['tonal'] else 'NOISY',
                    semitones=f['contourSemitones'])
        rec = dict(id=rid, title=f.get('title', rid), mine=mine)
        hard, soft = [], []
        for tool in ('codex', 'agy'):
            r = reviews[tool].get(rid)
            rec[tool] = r
            if r is None:
                continue
            if r['dir'] != mine['dir']:
                if 'NONE-DIR' not in (r['dir'], mine['dir']):
                    hard.append('dir-flip')
                elif abs(mine['semitones']) >= args.weak_semitones:
                    soft.append('dir-weak-big')
                else:
                    soft.append('dir-weak')
            if abs(r['onsets'] - mine['onsets']) > 1:
                soft.append('onsets')
            if r['timbre'] != mine['timbre']:
                soft.append('timbre')
        seen = [t for t in ('codex', 'agy') if rec.get(t)]
        rec['reviewers'] = len(seen)
        rec['hard'] = sorted(set(hard))
        rec['soft'] = sorted(set(soft))
        # 검토자 둘이 서로 어떻게 봉는가 — 누가 이상한지를 가린다.
        if len(seen) == 2:
            a, b = rec['codex'], rec['agy']
            same = (a['dir'] == b['dir'] and abs(a['onsets'] - b['onsets']) <= 1
                    and a['timbre'] == b['timbre'])
            rec['odd'] = ('none' if not (hard or soft) else 'mine' if same else 'ambiguous')
        else:
            rec['odd'] = 'unknown'
        # 판독이 하나도 없으면 '검산 안 됨'이다 — 일치로 세면 거짓 안심이 된다.
        rec['verdict'] = ('uncovered' if not seen
                          else 'conflict' if hard
                          else 'soft' if soft else 'confirmed')
        # 뒤바뀜 > 방향이 큼 항목의 방향 불일치 > 나머지. 검토자 둘이 한목소리면 +1.
        rec['priority'] = (4 if hard else 0) \
            + (2 if 'dir-weak-big' in rec['soft'] else 0) \
            + (1 if 'onsets' in rec['soft'] else 0) \
            + (1 if rec['odd'] == 'mine' else 0)
        # 감독이 진짜로 들어봐야 하는 것만 골라낸다. 음색(tonal/noisy)과 음 개수 불일치는
        # 내 임계값 보정 문제지 항목별 청취 사안이 아니다 — 전자는 집계로만 보고한다.
        # 감독을 부를 자공: (1) 방향 부호가 서로 반대다 (2) 큰 방향을 주장했는데 검토자 둘이
        # 한목소리로 방향이 없다고 한다.
        rec['audition'] = bool(hard) or ('dir-weak-big' in rec['soft'] and rec['odd'] == 'mine')
        rows.append(rec)

    rows.sort(key=lambda r: (-r['priority'], r['id']))
    out = dict(
        summary=dict(
            total=len(rows),
            coverage=coverage,
            confirmed=sum(1 for r in rows if r['verdict'] == 'confirmed'),
            soft=sum(1 for r in rows if r['verdict'] == 'soft'),
            conflict=sum(1 for r in rows if r['verdict'] == 'conflict'),
            uncovered=sum(1 for r in rows if r['verdict'] == 'uncovered'),
            dirFlips=sum(1 for r in rows if r['hard']),
            dirWeakBig=sum(1 for r in rows if 'dir-weak-big' in r['soft']),
            onsetConflicts=sum(1 for r in rows if 'onsets' in r['soft']),
            timbreConflicts=sum(1 for r in rows if 'timbre' in r['soft']),
            oddMine=sum(1 for r in rows if r['odd'] == 'mine'),
            oddAmbiguous=sum(1 for r in rows if r['odd'] == 'ambiguous'),
            audition=sum(1 for r in rows if r['audition']),
            # 축별 일치율(검토자 한 명이라도 판독한 항목 기준). 임계값 보정의 근거로 쓴다.
            agreeDir=_rate(rows, 'dir'),
            agreeOnsets=_rate(rows, 'onsets'),
            agreeTimbre=_rate(rows, 'timbre'),
        ),
        rows=rows,
    )
    path = os.path.join(st, 'cross-check.json')
    json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    # 검산을 통과한 방향만 러포에 남긴다. `dist/` 는 버려지는 생성물이라 라벨 밀드가 그것을
    # 잎으면 다섬 러포만 받은 사람이 다른 제목을 만들게 된다. 결로만 추적하면
    # `build-se-labels.py` 는 레포 하나로 똑같은 결과를 낸다.
    accepted = {r['id']: ('상승' if r['mine']['dir'] == 'UP' else '하강')
                for r in sorted(rows, key=lambda r: r['id'])
                if r['mine']['dir'] in ('UP', 'DOWN') and not r['audition']}
    cpath = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'accepted-contours.json')
    json.dump(dict(note='cross-check-se.py 가 생성한다. 내 측정이 방향을 단언하고 '
                        '검토자 판독이 그것을 반박하지 않은 항목만 들어 있다.',
                    contours=accepted),
              open(cpath, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    s = out['summary']
    print('삼중 검산 %d개' % s['total'])
    print('  판독 커버리지: codex %d / agy %d' % (coverage['codex'], coverage['agy']))
    print('  일치(감독 청취 불필요)   %d' % s['confirmed'])
    print('  방향 뒤바뀜(사실 충돌) %d' % s['conflict'])
    print('  약한 불일치              %d   — 방향 큼 %d / 음 개수 %d / 음색 %d'
          % (s['soft'], s['dirWeakBig'], s['onsetConflicts'], s['timbreConflicts']))
    print('  미검산                  %d' % s['uncovered'])
    print('  검토자 둘은 일치하는데 내가 어긋난 것 %d / 그림 자체가 애매한 것 %d'
          % (s['oddMine'], s['oddAmbiguous']))
    print('  축별 일치율: 방향 %d%% / 음수(±1) %d%% / 음색 %d%%'
          % (s['agreeDir'], s['agreeOnsets'], s['agreeTimbre']))
    print('  → 감독이 실제로 들어봐야 하는 항목: %d개' % s['audition'])
    print('\n%s' % os.path.relpath(path, REPO).replace(os.sep, '/'))
    print('%s  (방향 확정 %d개)' % (os.path.relpath(cpath, REPO).replace(os.sep, '/'), len(accepted)))


if __name__ == '__main__':
    main()
