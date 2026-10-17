#!/usr/bin/env python3
"""char-gen 갤러리 4 의 스크립트 합성 22종을 scarloxy-people-chips/ 로 모으고 설치 명단에 ScarloxyPeople11~ 로 **덧붙인다**(2026-10-17).

  python3 scarloxy_gallery4.py [--gallery ~/char-gen-public/examples/gallery] [--dry]

입력: harness-data/charset-actor/scarloxy-people/gallery4.json (이름·설명·직군·판정 점수·그림 화소 해시) + 갤러리의 최종 격자 chips/mix-NN.chr.txt.
① 격자를 RGBA 로 렌더해 해시가 매니페스트(= 사용자가 갤러리에서 본 그림)와 같은지 확인한다 — 다르면 거절.
② scarloxy-people-chips/sc3-mix-NN/{chip.chr.txt, meta.json} 를 쓴다(meta.lockExempt: 이 칩은 char-gen 합성기 산출이라 눈 색도 머리색을 따른다 → scarloxy_lock 의 눈·피부·손 원본 고정 검사 대상이 아니다. 대신 ①의 화소 해시 고정).
③ 설치 명단 scarloxy-people-install.json 의 마지막 시트 다음 번호(11~)에 8칩씩 덧붙인다. 이미 명단에 있는 key 는 건드리지 않는다. 기존 시트(1~10)의 빈 칸에는 채우지 않는다(번호·칸 불변).
뼈대·출처: Scarloxy MPWSP01(CC BY 4.0) People1~2. 사람 칩이라 3/4 관문 해당 없음.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402

PICKS = ROOT / 'harness-data/charset-actor/scarloxy-people-chips'
INSTALL = ROOT / 'harness-data/charset-actor/scarloxy-people-install.json'
MANIFEST = ROOT / 'harness-data/charset-actor/scarloxy-people/gallery4.json'
FIRST_SHEET = 11


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gallery', default=str(Path.home() / 'char-gen-public/examples/gallery'))
    ap.add_argument('--dry', action='store_true')
    a = ap.parse_args()
    gallery = Path(a.gallery)
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    install = json.loads(INSTALL.read_text(encoding='utf-8'))
    have = {c['key'] for s in install['sheets'] for c in s['characters']}
    todo = [e for e in manifest['chips'] if e['key'] not in have]
    for e in todo:
        pal, _, frames = C.load(gallery / 'chips' / f'{e["gallery"]}.chr.txt')
        errors = C.structural_errors(pal, frames)
        if errors:
            raise SystemExit(f'{e["key"]}: 구조 오류 {errors}')
        img = C.sheet_rgba(pal, frames)
        if hashlib.sha256(img.tobytes()).hexdigest() != e['slotRgbaSha256']:
            raise SystemExit(f'{e["key"]}: 갤러리 그림과 화소가 다르다(매니페스트 해시 불일치) — 갤러리에 올라간 것과 같은 것만 설치한다')
        if a.dry:
            continue
        d = PICKS / e['key']
        d.mkdir(parents=True, exist_ok=True)
        (d / 'chip.chr.txt').write_text(C.dump(pal, {}, frames, header=f'{e["key"]} — char-gen gallery 4 {e["gallery"]} script head={e["head"]} body={e["body"]}'), encoding='utf-8')
        meta = dict(key=e['key'], name=e['name'], head=e['head'], body=e['body'], ok=True, model='script-compose(char-gen gallery 4; no model call)',
                    lockExempt='char-gen compose recolors eyes with the hair hue; pixels pinned by gallery4.json slotRgbaSha256',
                    gallery=e['gallery'], candidate_id=e['candidate_id'], judge_totals_ABC=e['judge_totals_ABC'], recipe=f'gallery4-recipes.json#{e["gallery"]}')
        (d / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    if a.dry:
        print('검증 통과', len(todo), '종(쓰기 없음)')
        return
    sheets = install['sheets']
    for e in todo:
        if sheets[-1]['n'] < FIRST_SHEET or len(sheets[-1]['characters']) >= 8:   # 기존 시트(1~10)의 빈 칸은 채우지 않고 11번부터 새로 연다
            sheets.append(dict(n=sheets[-1]['n'] + 1, characters=[]))
        sheets[-1]['characters'].append(dict(key=e['key'], id=e['id'], name=e['name'], desc=e['desc'], role=e['role'], gender=e.get('gender'), age=e.get('age'),
                                             tags=e['tags'], genre='몬스터 수집', lockExempt='gallery4', expectSlotRgbaSha256=e['slotRgbaSha256']))
    if todo:
        install['selection']['note'] += ' | 4차(2026-10-17, 사용자 「22종은 넣어야할듯」): char-gen 갤러리 4 의 스크립트 합성 22종(머리 이식 + 부위 색 이동, 모델 호출 없음, 눈가림 판정자 3명 다수결 + 세트 중복 검사 통과)을 갤러리 그림 그대로 ScarloxyPeople11~13 에 덧붙임. 기존 시트의 빈 칸(4#1~7·10#5~7)은 채우지 않았다.'
        INSTALL.write_text(json.dumps(install, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('명단에 덧붙임', len(todo), '종 → 시트', [s['n'] for s in sheets][-4:])


if __name__ == '__main__':
    main()
