"""시드 harness-data/charset-actor/ct-ff6-concepts.json 의 직업 원형 후보를 자유 저작 주문으로 만들어 시작한다.

studio.py 의 자유 저작 주문(_create)과 같은 manifest 형식이며 뼈대 칸만 후보마다 시드에서 고른다.
모델 호출·검사·사람 선택(남기기/폐기)은 기존 경로 그대로다. 선택 전에는 팩·번들·프로젝트에 설치하지 않는다.

  python3 order_concepts.py --dry                 # manifest 만 만든다(시작 안 함)
  python3 order_concepts.py --par 6               # 만들고 시작
  python3 order_concepts.py --only tt-scrap-robot --par 2
"""
import argparse
import json
import uuid
from datetime import datetime
from pathlib import Path

import harness as H
import chr as C
import motion
import studio

SEED = H.HDATA / 'ct-ff6-concepts.json'


def build(only=None, suffix='', offset=0):
    seed = json.loads(SEED.read_text(encoding='utf-8'))
    run = datetime.now().strftime('%Y%m%d-%H%M%S') + '-ctff6-' + (suffix or uuid.uuid4().hex[:6])
    rows = []
    for arch in seed['archetypes']:
        if only and arch['id'] not in only:
            continue
        for i, cand in enumerate(arch['candidates']):
            base = H.norm_base(cand['base'])
            if not C.gate(*H.base_of(base), H.base_of(base), strength='free')['ok']:
                raise SystemExit(f'뼈대 {base} 가 결손 검사를 통과하지 못한다: {arch["id"]}')
            label = 'abcdefgh'[i + offset]
            rows.append(dict(
                key=f'{arch["id"]}-{label}', name=f'{arch["name"]} {label.upper()}', base=base,
                brief=seed['common'] + ' 이번 캐릭터: ' + arch['concept'] + ' 이 후보의 방향: ' + cand['variant'],
                strength='free', reviewMode='human', source='rtp', genre=arch['genre'], role=arch['role'],
                gender=arch['gender'], age=arch['age'],
                animationMode=H.FRAME_AUTHOR_MODE, motionPolicy=motion.VERSION))
    if not rows:
        raise SystemExit('주문할 후보가 없다')
    return run, dict(run=run, reviewMode='human', animationMode=H.FRAME_AUTHOR_MODE, characters=rows,
                     genres=sorted({r['genre'] for r in rows}), sourceOriginal=None,
                     motionPolicy=motion.VERSION, title=seed['title'][:80])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', action='append', help='시드 원형 id(여러 번 지정 가능)')
    ap.add_argument('--par', type=int, default=6)
    ap.add_argument('--suffix', default='')
    ap.add_argument('--label-offset', type=int, default=0, help='후보 글자 시작(a=0). 같은 원형을 다시 주문할 때 e=4 처럼 이어 쓴다')
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--no-launch', action='store_true', help='manifest 만 저장하고 시작하지 않는다(retry_driver.py 로 구동)')
    args = ap.parse_args()
    with H.data_lock('studio'):
        run, manifest = build(args.only, args.suffix, args.label_offset)
        print(run, len(manifest['characters']), '명')
        if args.dry:
            print(json.dumps(manifest['characters'][0], ensure_ascii=False, indent=1))
            return
        root = H.run_dir(run)
        root.mkdir(parents=True)
        H.write_json_atomic(root / 'manifest.json', manifest)
        if args.no_launch:
            print('manifest 저장:', root)
            return
        studio.reserve_artists(args.par)
        print(json.dumps(studio.launch(root, args.par, 1)))


if __name__ == '__main__':
    main()
