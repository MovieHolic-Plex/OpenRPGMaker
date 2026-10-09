# 사막 성 내보내기: parts/*.png + partmeta.json + parts.md, render-1x/2x.png, grid.json, compare-ref.png.
import os, json
from PIL import Image, ImageDraw
from dc_base import *
import dc_inner as IN
from dc_meta import META, piece

R = os.path.abspath(os.path.join(HERE, '..', '..')) + '/'

def export(im, g, M, reach, link_ok, isolated, worst_out, worst_in, count, W, H, IW0):
    P = wl.Parts(HERE)
    for n, md in META.items():
        if md.get('reuse'): continue
        extra = {k: md[k] for k in ('brows', 'layer', 'role') if k in md}
        P.add(n, piece(n), md['kind'], md['ko'], md['desc'], md['rules'], extra.get('brows'), extra.get('layer'), extra.get('role'))
    G = IN.SAMPLES
    P.add('ground-court-flag', G['dc_court'], 'floor', '안뜰 큰 사암 판석', '햇빛 받은 32x16·16x16 큰 사암 판을 엇갈려 깐 바닥, 줄눈에 모래, 날린 모래 점·먼지 얼룩 3x3 표본',
          '사막 성 안뜰·광장 기본 바닥. 3x3 이어 붙여도 이음새 없음. 벽 앞면보다 한 단 어둡다(벽과 갈라 보이게). 모래 번짐은 autotile-sand-spill 로 덧그린다.', 0, 'lower', 'terrain', pad=False)
    P.add('ground-cellar-flag', G['dc_cellar'], 'floor', '지하 사암 판석', '두 단 어두운 24x16 사암 판석(줄눈에 모래, 판마다 톤, 닳은 자리) 3x3 표본',
          '사막 성 지하·지하묘지·실내 복도 기본 바닥. 벽 앞면(face_cellar_3h)보다 밝다.', 0, 'lower', 'terrain', pad=False)
    P.add('ground-machine-plate', G['dc_plate'], 'floor', '기계실 강철판', '16x16 리벳 강철판(기계 재질 규약 줄눈), 미끄럼 돌기, 48px 마다 놋쇠 띠, 기름 얼룩 3x3 표본',
          '기계실의 기계 둘레 바닥(방 전체가 아니라 기계 밑 사각 구역). 둘레는 ground-cellar-flag.', 0, 'lower', 'terrain', pad=False)
    P.add('face_castle_outer', IN.outer_face_sample(), 'wall', '바깥 성벽 앞면', '햇빛 받은 사암 마름돌 앞면 + 층 띠 + 굵은 받침돌(3x3 표본)',
          '사막 성·성곽 건물 바깥 벽 앞면. 위에 성가퀴(wall_front 윗줄)를 얹는다.', 0, None, 'wall', pad=False)
    P.add('face_cellar_3h', IN.face_sample(3, 3), 'wall', '지하 벽 앞면(3줄)', '사암 마름돌을 지하라 두 단 어둡게 쌓은 벽 앞면과 아래 굵은 받침돌 띠, 3칸 폭 표본',
          '지하 방 천장 밑에 3줄. 모든 방 북쪽 벽에 필수. 바닥보다 어둡다. 장식(벽 톱니·계기판·벽 등·관)은 이 줄 위에.', 0, None, 'wall', pad=False)
    P.add('ceiling_cellar', IN.ceiling_sample(), 'wall', '지하 천장', '어두운 천장 속 + 사암 벽 윗면 띠(열린 쪽만 밝은 턱), 모서리 포함 3x3 표본',
          '방·복도 바깥(벽 너머). 바닥·앞면에 닿은 쪽만 띠.', 0, None, 'wall', pad=False)
    P.add('autotile-sand-spill', IN.sand_spill_sheet(), 'autotile', '모래 번짐', '바닥 위로 새어 든·날려 쌓인 모래 16변형(위 1·오른 2·아래 4·왼 8). 속은 두껍고 잔물결, 가장자리는 얇아져 바닥이 비치고 알갱이로 흩어진다.',
          '벽 밑·계단 밑·무너진 틈 밑·모래 새는 틈 둘레 바닥에 덩이로. 걷기. 직사각형으로 깔지 말고 한쪽으로 몰리게(바람·흐름 방향).', 0, 'lower', 'terrain', pad=False)
    P.add('autotile-brass-rail', IN.brass_rail_sheet(), 'autotile', '놋쇠 난간', '강철 기둥(놋쇠 꼭지)과 놋쇠 가로대 두 가닥의 난간 16변형. 남북 이음은 위에서 본 가로대 윗면.',
          '기계 구덩이·관성 바퀴·낭떠러지 둘레. 모든 변형 막힘(위층). 출입 틈을 남길 땐 끝 변형으로 끊는다.', 1, 'upper', 'fence', pad=False)
    # ---- 보정 패스(2026-10-08): 시그니처 땅 덩이 오토타일 셋 + 성벽 앞면 변형 셋
    import dc_fix as FX
    P.add('autotile-oasis-pond', FX.pond_sheet(), 'autotile', '오아시스 연못', '청록 물 ↔ 밝은 물가 테 ↔ 젖은 모래 기슭 ↔ 풀 술 16변형(위 1·오른 2·아래 4·왼 8). 북쪽 둑은 3/4 로 흙 앞면이 보이고 물에 그늘이 진다. 물가 굴곡은 칸 가운데에서 내고 칸 모서리는 거의 곧게 맞춰 오목한 모서리에도 네모 혹이 없다. 속은 한 톤 + 잔물결 줄.',
          '막힘(물). 붓으로 불규칙한 덩이(혹·만·코)를 칠한다 — 사각형 채우기 금지, 1칸 외톨이·1칸 폭 띠 금지(3칸 이상 덩이). 밑에 autotile-oasis-grass 를 못보다 2칸 넓게 먼저 칠하고, 물가 풀 칸에 갈대·야자를 둔다.', 0, 'lower', 'terrain', pad=False)
    P.meta['autotile-oasis-pond']['passable'] = False
    P.add('autotile-oasis-grass', FX.grass_sheet(), 'autotile', '오아시스 풀 덩이', '모래 위 풀밭 16변형: 속은 버들항 풀 칩(잔디·들풀 섞음)과 잔 풀포기, 가장자리는 들쭉날쭉한 풀잎 술과 모래 위로 삐죽 나온 풀잎, 남쪽은 풀 깔개 두께 그늘, 북·서쪽은 밝은 잎끝.',
          '걷기. 오아시스 못 둘레·야자 덩이 밑에 못보다 크게 불규칙한 덩이로. 사각형 채우기 금지. 위에 야자·덤불·낙타 말뚝을 둔다.', 0, 'lower', 'terrain', pad=False)
    P.add('autotile-dune-crest', FX.dune_sheet(), 'autotile', '모래 언덕 능선', '모래 땅 위 언덕 덩이 16변형: 속은 투명(바탕 모래)이고 성긴 잔물결 빛만, 덩이 남·동 가장자리를 따라 바람받이 밝은 비탈 → 날카로운 마루 빛 → 마루 밑 짙은 줄 → 바람그늘 비탈 그늘이 굽이친다. 칠한 덩이의 남쪽 윤곽이 곧 능선이다.',
          '걷기. 빈 사막에 남쪽 윤곽이 굽이치게(혹·코) 덩이로 칠한다. autotile-sand-spill(바닥 위로 새어 든 얇은 모래)과 다르다 — 이것은 모래 땅 위의 높낮이. 길(autotile-trail)과 겹치지 않게.', 0, 'lower', 'terrain', pad=False)
    P.add('wall_face_repair', FX.wall_face_repair(), 'decal', '성벽 보수 자국', '2x2칸 앞면 덧그림: 무너진 자리를 작은 8x4 새 마름돌로 촘촘히 다시 쌓은 자리(줄눈 변화), 옛 벽과의 이음 금, 걸쳐 남은 옛 큰 돌 하나, 밑 물 자국',
          'wall_front·wall_front_breach 의 아래 2줄(4·5번째 줄)에 칸 경계를 맞춰 겹쳐 찍는다. 한 성벽 줄에 1~2개, 균열·살창과 엇갈리게. 받침돌은 덮지 않는다. 막힘은 성벽이 맡는다.', 0, None, 'prop', pad=False)
    P.add('wall_face_crack', FX.wall_face_crack(), 'decal', '성벽 균열', '2x3칸 앞면 덧그림: 층 띠 밑에서 받침돌까지 줄눈을 따라 계단꼴로 내려가는 큰 균열(속 어둠·그늘 어깨·밝은 입술), 떨어져 나간 마름돌 모서리, 받침돌 위 돌 조각과 모래 한 줌',
          'wall_front 의 아래 3줄(3~5번째 줄)에 칸 경계를 맞춰 겹쳐 찍는다. 한 성벽 줄에 1~2개(무너진 틈 곁에 몰아도 좋다). 막힘은 성벽이 맡는다.', 0, None, 'prop', pad=False)
    P.add('wall_face_lattice', FX.wall_face_lattice(), 'decal', '내민 나무 살창 창', '2x3칸 앞면 덧그림: 성벽 앞면에 내민 나무 덧창 상자 — 처마판, 6px 마름모 살(틈은 따뜻한 어둠), 가운데 가로대, 두꺼운 틀·창턱, 까치발 둘, 벽에 진 반투명 그늘. 글자·문장 없음',
          'wall_front 의 아래 3줄(3~5번째 줄)에, 화살 구멍 자리를 덮게 칸 경계를 맞춰 찍는다. 한 성벽 줄에 하나(4칸 이상 띄움). 천 깃발과 겹치지 않게. 막힘은 성벽이 맡는다.', 0, None, 'prop', pad=False)
    json.dump(P.meta, open(P.mpath, 'w'), ensure_ascii=False, indent=1)
    n = P.finish('사막 성 — 모래에 잠긴 사암 성 외관 + 지하 기계실 (desert-castle)')
    im.convert('RGB').save(HERE + '/render-1x.png')
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(HERE + '/render-2x.png')
    json.dump({'w': W, 'h': H, 'tile': 16, 'rows': [''.join('.' if g[y][x] else '#' for x in range(W)) for y in range(H)],
               'legend': {'.': 'walkable', '#': 'blocked'}, 'parts': {'outdoor': [0, 0, IW0, H], 'cellar': [IW0, 0, W - IW0, H]},
               'links': [{'from': list(M['stair_down']), 'to': list(M['cellar_stair_top']), 'note': '모래 속 내림 계단 ⇔ 지하 오름 계단'}],
               'marks': {k: list(v) for k, v in M.items()}, 'reach': reach, 'link_ok': link_ok, 'isolated_walk_cells': isolated,
               'empty_window_outdoor': [round(float(worst_out[0]), 3), [worst_out[1], worst_out[2]]],
               'empty_window_cellar': [round(float(worst_in[0]), 3), [worst_in[1] + IW0, worst_in[2]]], 'count': count}, open(HERE + '/grid.json', 'w'), ensure_ascii=False)
    compare()
    print('parts', n)

CMP = [((0, 450, 220, 560), '오아시스 서쪽 — 풀 덩이 바깥 둘레(둥근 혹·만)'), ((150, 470, 370, 580), '오아시스 동쪽 · 낙타 — 풀 덩이 둘레'),
       ((40, 500, 260, 610), '오아시스 남쪽 — 야자 밑 풀 덩이'), ((0, 420, 220, 530), '오아시스 북쪽 둑')]
def compare():
    """이전 판(커밋 당시 render-1x) | 새 판, 같은 자리 2배. 달라진 곳만(보정 3차: autotile-oasis-grass 바깥 둘레)."""
    prev = HERE + '/_qa/render-prev.png'
    if not os.path.exists(prev): return
    A_ = Image.open(prev).convert('RGB'); B_ = Image.open(HERE + '/render-1x.png').convert('RGB')
    def cr(im, b): return im.crop(b).resize(((b[2] - b[0]) * 2, (b[3] - b[1]) * 2), Image.NEAREST)
    pw, ph = 440, 220
    o = Image.new('RGB', (pw * 2 + 24, (ph + 22) * len(CMP) + 8), (24, 24, 28)); d = ImageDraw.Draw(o)
    for i, (b, la) in enumerate(CMP):
        y = 8 + i * (ph + 22)
        d.text((8, y), 'before', fill=(230, 230, 230)); d.text((pw + 16, y), 'after', fill=(230, 230, 230))
        o.paste(cr(A_, b), (8, y + 14)); o.paste(cr(B_, b), (pw + 16, y + 14))
    # 보정 3차: 같은 붓 덩이(5x5 네모·코 L자)를 옛/새 autotile-oasis-grass 로 칠해 2배로 나란히
    import dc_fix as FX
    sand = FX.sand_tile(); rows_ = []
    for k in ('block5', 'nose_L'):
        a_ = FX.stamp(FX.grass_sheet(v1=True), FX.SHAPES[k], sand); b_ = FX.stamp(FX.grass_sheet(), FX.SHAPES[k], sand)
        rows_.append((a_.resize((a_.width * 2, a_.height * 2), Image.NEAREST), b_.resize((b_.width * 2, b_.height * 2), Image.NEAREST)))
    extra = sum(r[0].height + 22 for r in rows_)
    o2 = Image.new('RGB', (o.width, o.height + extra), (24, 24, 28)); o2.paste(o, (0, 0)); d = ImageDraw.Draw(o2); y = o.height
    for (a_, b_), k in zip(rows_, ('5x5 block brush', 'L + nose brush')):
        d.text((8, y), 'before autotile-oasis-grass ' + k, fill=(230, 230, 230)); d.text((pw + 16, y), 'after', fill=(230, 230, 230))
        o2.paste(a_.convert('RGB'), (8, y + 14)); o2.paste(b_.convert('RGB'), (pw + 16, y + 14)); y += a_.height + 22
    o2.save(HERE + '/compare-ref.png')
    FX_check()
def FX_check():
    import dc_fix as FX
    FX.check_sheet(HERE + '/check-autotile.png')
