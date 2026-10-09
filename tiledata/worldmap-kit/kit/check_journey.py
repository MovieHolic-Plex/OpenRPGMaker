#!/usr/bin/env python3
"""여정 도달성 검사 — 여정 템플릿 + 아이콘 세트 조합 입력.

  python3 kit/check_journey.py --journey fantasy-5act --iconset fantasy          # 템플릿대로 지형을 만들어(2~3초) 검사
  python3 kit/check_journey.py --journey fantasy-5act --map out/world.json       # 이미 출력한 world.json 의 지형으로 검사(빌더가 쓰는 길)

하는 일
  1) (iconset 을 주면) 템플릿의 모든 장소 역할을 세트가 칸 수대로 채우는지 — 모자라면 무엇이 모자란지 전부 보여 주고 끝낸다.
  2) 지도의 통행 판정 위에서 막별 도달 영역을 BFS 로 구해 템플릿의 막 구분(places[].act)과 대조한다.
  3) 수단(통행증·범선·사막선·비공정)을 얻는 장소의 순서, 장벽 두께, 시작 화면, 줄거리 선, 길이 장벽을 지나지 않는지를 확인한다.
통행 판정(journey_world_v9)은 v9-final3 와 같다: 걷기 = 땅 칸 중 산·절벽·강·협곡·바다·사구가 아닌 칸(다리·경사로·장소 발자국은 열림),
관문 = 통행증이 있을 때만, 배 = 바다 칸(항구에서 타고 높이 0 해안에서 내림), 사막선 = 걷기 + 사구, 비공정 = 천공섬 발판.
종료 코드: 0 통과, 1 불일치, 2 입력 오류.
"""
import argparse
import json
import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True
os.environ['CITY_TAG'] = 'v8'
KIT = Path(__file__).resolve().parent
sys.path.insert(0, str(KIT / 'lib'))

import kit_common as K  # noqa: E402


def run_check(journey, world, out_path=None, verbose=True):
    """journey: 템플릿 dict, world: kit_world.World/MapWorld. 반환 (불일치 목록, info, 보고 텍스트)."""
    import io
    import contextlib
    import journey_plan_v9 as P
    import journey_check_v9 as C
    P.configure(journey)
    lay = getattr(world, 'layout', None)
    C.MIN_SEA_GAP[0] = int(lay.get('min_sea_gap', 4)) if isinstance(lay, dict) else 4
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        _, bad, info = C.run(verbose=True, w=world, out_path=out_path)
    txt = buf.getvalue()
    if verbose:
        print(txt.rstrip())
    return bad, info, txt


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--journey', required=True, help='journeys/<id>.json 의 id')
    ap.add_argument('--iconset', help='iconsets/<id> — 주면 역할 채움을 먼저 검사하고, --map 이 없으면 이 세트로 지형을 만든다')
    ap.add_argument('--map', help='빌더가 쓴 world.json — 주면 그 지형으로 검사한다')
    ap.add_argument('--out', help='보고서 텍스트 저장 경로')
    ap.add_argument('--quiet', action='store_true')
    a = ap.parse_args()
    try:
        roles, _ = K.load_roles()
        journey = K.load_journey(a.journey)
        iconset = K.IconSet(a.iconset) if a.iconset else None
        assign = K.assign_icons(roles, journey, iconset) if iconset else None
        if a.map:
            import kit_world as W
            wd = K.load_json(a.map)
            journey = K.journey_for_world(journey, wd)
            world = W.MapWorld(wd)
        else:
            if not iconset:
                raise K.KitError('--map 이 없으면 지형을 만들 아이콘 세트(--iconset)가 필요하다')
            import kit_world as W
            W.install(journey, roles, iconset, assign)
            world = W.make_world()
    except K.KitError as e:
        print('입력 오류:\n' + str(e), file=sys.stderr)
        sys.exit(2)
    bad, info, txt = run_check(journey, world, a.out, verbose=not a.quiet)
    print('결과: %s' % ('통과' if not bad else '불일치 %d건' % len(bad)))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
