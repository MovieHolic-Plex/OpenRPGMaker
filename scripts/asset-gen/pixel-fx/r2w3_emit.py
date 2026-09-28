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
                r = L.REG[key]
                layers.append(f'{{ key: {js(key)}, anchor: {js(r["anchor"])}, frame: {r["frame"]}, frames: {r["frames"]} }}')
            rows.append(f'    {{ id: "skill_{cl["ck"]}_{sk["slug"]}", classId: {js(cl["classId"])}, actorId: "actor_{cl["ck"]}", name: {js(sk["name"])}, '
                        f'level: {lv}, motion: {js(sk["motion"])}, description: {js(sk["desc"])}, layers: [{", ".join(layers)}] }},')
        assert cl['skills'][-1]['motion'] == 'finisher', cl['classId']
        assert len(motions) >= 4, (cl['classId'], motions)
        assert len({k for sk in cl['skills'] for k in sk['layers']}) == len([k for sk in cl['skills'] for k in sk['layers']]), 'layer key reused'
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
