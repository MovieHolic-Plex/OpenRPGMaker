# Lineup fixture for scripts/qa/runtime/astra-prof-lineup.scenario.mjs. First dump the project:
#   npx vite-node --script scripts/content/monsters/astra_professor_chargen/dump-project.ts
# then: python3 scripts/content/monsters/astra_professor_chargen/lineup_fixture.py default,cg-nat9,...  (run from the repo root)
import json, sys
p = json.load(open('tmp/astra-pres/astra.project.json'))
p['system']['opening'] = {**p['system']['opening'], 'enabled': False}
CAST = [('hero', '오늘부터 나도 트레이너야!'), ('mom', '조심해서 다녀오렴. 저녁엔 꼭 들어오고.'), ('nurse', '어서 오세요! 몬스터를 쉬게 해 드릴게요.'),
        ('naru', '나도 오늘 첫 동료를 받았어. 승부하자!'), ('yurim', '숲의 약속을 지킬 각오가 있나?'), ('muyeong', '별빛은 우리 밤막회사가 가져간다.')]
CANDS = sys.argv[1].split(',')
LINES = {'base': '왔구나! 기다리고 있었단다.', 'happy': '하하, 축하한다! 좋은 동료를 만났구나.', 'sad': '미안하구나… 등대의 빛이 약해지고 있어.', 'surprised': '뭐라고?! 벌써 배지를 모았니?'}
cmds, labels = [], []
for c, line in CAST:
    lab = f'〈{c}〉'; labels.append(lab)
    cmds += [{'kind': 'changeFace', 'resourceId': f'oprn_astra_cast_{c}_bust_base', 'presentation': 'bust', 'position': 'left', 'flipHorizontally': False},
             {'kind': 'text', 'body': f'{lab} {line}', 'position': 'bottom'}]
for v in CANDS:
    for e, line in LINES.items():
        lab = f'〈{v} {e}〉'; labels.append(lab)
        cmds += [{'kind': 'changeFace', 'resourceId': (f'oprn_astra_cast_professor_bust_{e}' if v == 'default' else f'oprn_astra_cast_professor_{v.replace("-", "_")}_bust_{e}'), 'presentation': 'bust', 'position': 'left', 'flipHorizontally': False},
                 {'kind': 'text', 'body': f'{lab} {line}', 'position': 'bottom'}]
m = p['maps']['mx_map_home_house_2f']
ev = [e for e in m['events'] if e['id'].endswith('_opening')][0]
ev['pages'][0]['commands'] = cmds + [{'kind': 'setSwitch', 'switchId': 'mx_intro', 'value': True}]
json.dump(p, open('tmp/astra-pres/astra.lineup.json', 'w'))
json.dump(labels, open('tmp/astra-pres/lineup-labels.json', 'w'), ensure_ascii=False)
print(len(labels))
