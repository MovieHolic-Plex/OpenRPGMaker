"""r2w3_skills.py 목록 → src/assets/retroRosterSkills/p2.ts·p3.ts 생성(계약 형식 RetroClassSkill).
    python3 scripts/asset-gen/pixel-fx/r2w3_emit.py [p2|p3]"""
import json, sys
from pathlib import Path
import r2w3_skills as SK
import lib_r2w3 as L

MOTIONS = {'dash-strike', 'leap-strike', 'blink-strike', 'flurry', 'spin', 'cast', 'shoot', 'buff', 'finisher'}


def js(s):
    return json.dumps(s, ensure_ascii=False)


def emit(batch):
    SK.load_all()
    rows = []
    for cl in SK.CLASSES:
        if cl['batch'] != batch: continue
        assert len(cl['skills']) == 8, cl['classId']
        motions = set()
        for lv, sk in zip(SK.LV, cl['skills']):
            assert sk['motion'] in MOTIONS, sk
            motions.add(sk['motion'])
            layers = []
            for key in sk['layers']:
                r = L.spec(key)
                layers.append(f'{{ key: {js(key)}, anchor: {js(r["anchor"])}, frame: {r["frame"]}, frames: {r["frames"]} }}')
            rows.append(f'    {{ id: "skill_{cl["ck"]}_{sk["slug"]}", classId: {js(cl["classId"])}, actorId: "actor_{cl["ck"]}", name: {js(sk["name"])}, '
                        f'level: {lv}, motion: {js(sk["motion"])}, description: {js(sk["desc"])}, layers: [{", ".join(layers)}] }},')
        assert cl['skills'][-1]['motion'] == 'finisher', cl['classId']
        assert len(motions) >= 4, (cl['classId'], motions)
        own = [k for sk in cl['skills'] for k in sk['layers'] if k in L.REG]
        assert len(set(own)) == len(own), 'new sheet key used twice'
        if batch != 'p2':
            # 2차 규칙: 스킬 하나당 새 시트 최대 1장(나머지 층은 기존 시트 재사용). p2 는 규칙 확정 전에 만든 것이라 그대로 둔다.
            for sk in cl['skills']:
                assert sum(k in L.REG for k in sk['layers']) <= 1, (cl['classId'], sk['slug'], 'more than one new sheet')
    body = '\n'.join(rows)
    text = f'''// 묶음 {batch} — 담당 에이전트만 이 파일을 쓴다. 규격: src/assets/retroRoster.ts 머리 주석, 스킬 형식은 retroClassSkills.ts(RetroClassSkill).
// 생성 파일: scripts/asset-gen/pixel-fx/r2w3_emit.py (정본 목록은 r2w3_skills.py). 직접 고치지 말고 목록을 고친 뒤 다시 생성한다.
import type {{ RetroRosterBatch }} from "@/assets/retroRoster";

export const BATCH: RetroRosterBatch = {{
  skills: [
{body}
  ],
  partyPixel: []
}};
'''
    out = L.ROOT / f'src/assets/retroRosterSkills/{batch}.ts'
    out.write_text(text, encoding='utf8')
    print('wrote', out, len(rows), 'skills')


if __name__ == '__main__':
    for b in (sys.argv[1:] or ['p2', 'p3']):
        emit(b)
