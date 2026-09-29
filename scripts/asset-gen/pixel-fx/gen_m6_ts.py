"""묶음 m6 스킬 표 → src/assets/retroRosterSkills/m6.ts 생성기.

재사용 레이어의 anchor·frame·frames 는 기존 정의(retroClassSkills.ts·retroMonsterSkills.ts·retroRosterSkills/*.ts)에서
읽어 그대로 적는다. 새 시트(NEW)는 스킬당 최대 1장, 키는 <classKey>_ 접두, 그림은 scripts/asset-gen/pixel-fx/<key>.py.
검사: 직업당 8개·레벨 1·3·5·7·10·12·16·22·마지막 finisher·motion 4종 이상·blink-strike 없음·모든 레이어 PNG 크기.

    python3 scripts/asset-gen/pixel-fx/gen_m6_ts.py
"""
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'src/assets/retroRosterSkills/m6.ts'
FX = ROOT / 'public/assets/generated/pixel-fx'
LEVELS = [1, 3, 5, 7, 10, 12, 16, 22]

NEW = {
    'yeti_snowball': ('projectile', 32, 4), 'yeti_frost_roar': ('allTargets', 64, 10), 'yeti_avalanche_sky': ('screen', 128, 12),
    'merfolk_trident_throw': ('projectile', 32, 4), 'merfolk_tide_wave': ('allTargets', 64, 10), 'merfolk_maelstrom_sky': ('screen', 128, 12),
    'cyclops_eye_beam': ('target', 64, 10), 'cyclops_titan_sky': ('screen', 128, 12),
    'mothman_scale_dust': ('allTargets', 64, 10), 'mothman_hallucination': ('target', 64, 10), 'mothman_moonwing_sky': ('screen', 128, 12),
    'basilisk_petrify': ('target', 64, 10), 'basilisk_gorgon_sky': ('screen', 128, 12),
    'djinn_wish': ('allAllies', 64, 10), 'djinn_sandstorm': ('allTargets', 64, 10), 'djinn_genie_sky': ('screen', 128, 12),
    'chimera_triple_breath': ('allTargets', 64, 10), 'chimera_rampage_sky': ('screen', 128, 12),
    'dark_angel_black_feather': ('projectile', 32, 4), 'dark_angel_judgment_sky': ('screen', 128, 12),
}

# (직업 키, 한글 이름, [(뜻, 이름, motion, 설명, [레이어 키...]) x 8])
TABLE = [
    ('yeti', '예티', [
        ('fist', '설원 주먹', 'dash-strike', '털북숭이 주먹으로 힘껏 내리친다', ['guard_bash']),
        ('snowball', '눈덩이 던지기', 'shoot', '단단히 뭉친 눈덩이를 던져 얼린다', ['yeti_snowball', 'mon_frost_burst']),
        ('chest_beat', '가슴 두드리기', 'buff', '가슴을 두드리며 포효해 공격력을 올린다', ['berserker_roar']),
        ('frost_roar', '얼음 포효', 'cast', '얼어붙은 숨결로 포효해 모든 적을 얼린다', ['yeti_frost_roar']),
        ('stomp', '설산 짓밟기', 'leap-strike', '뛰어올라 짓밟아 얼음 땅을 쪼갠다', ['mon_quake_crack']),
        ('blizzard_hug', '눈보라 껴안기', 'flurry', '파고들어 끌어안고 연달아 조인다', ['mon_claw_rake', 'mage_snow']),
        ('big_snowball', '거대 눈덩이', 'spin', '적진을 구르며 눈덩이를 키워 모두를 친다', ['dragonewt_frost']),
        ('avalanche', '대눈사태', 'finisher', '설산을 무너뜨려 눈사태로 적을 덮는 필살기', ['yeti_avalanche_sky', 'mon_frost_burst']),
    ]),
    ('merfolk', '인어 전사', [
        ('thrust', '삼지창 찌르기', 'dash-strike', '물결을 타고 미끄러져 삼지창으로 찌른다', ['mon_spear_pierce']),
        ('water_jet', '물줄기', 'shoot', '창끝에서 세찬 물줄기를 쏜다', ['mon_wave_screen']),
        ('trident_throw', '삼지창 투척', 'shoot', '삼지창을 던져 적을 꿰뚫는다', ['merfolk_trident_throw', 'hero_pierce']),
        ('bubble_guard', '거품 방패', 'buff', '거품 막으로 아군 전체를 감싼다', ['maid_bubbles']),
        ('tide_wave', '밀려오는 조수', 'cast', '조수를 불러 모든 적을 휩쓴다', ['merfolk_tide_wave']),
        ('sea_song', '바다의 노래', 'cast', '잔잔한 노래로 아군 전체를 치유한다', ['heal']),
        ('whirl_spear', '소용돌이 창', 'spin', '물기둥 속에서 회전하며 모든 적을 찌른다', ['skiff_wave']),
        ('maelstrom', '대해의 소용돌이', 'finisher', '바다를 소용돌이로 뒤집어 적을 삼키는 필살기', ['merfolk_maelstrom_sky', 'skiff_wave']),
    ]),
    ('cyclops', '사이클롭스', [
        ('smash', '거인의 주먹', 'dash-strike', '큰 주먹으로 땅째 후려친다', ['tank_crush']),
        ('rock_throw', '바위 던지기', 'shoot', '바위를 뽑아 던져 짓누른다', ['mon_boulder', 'golem_pal_boulder_hit']),
        ('eye_beam', '외눈 광선', 'cast', '외눈에 빛을 모아 뜨거운 광선을 쏜다', ['cyclops_eye_beam']),
        ('glare', '노려보기', 'cast', '외눈으로 노려봐 모든 적을 움츠리게 한다', ['mon_gaze_screen']),
        ('quake', '대지 강타', 'leap-strike', '뛰어올라 두 주먹으로 땅을 내려친다', ['golem_pal_quake']),
        ('rage', '거인의 분노', 'buff', '핏발 선 눈으로 힘을 끌어올린다', ['berserker_roar']),
        ('rock_rain', '바위 비', 'spin', '바위를 휘둘러 흩뿌려 모든 적을 친다', ['mon_rock_burst']),
        ('titan_crash', '타이탄 크래시', 'finisher', '산만 한 바위를 들어 내리꽂는 필살기', ['cyclops_titan_sky', 'hero_meteor_impact']),
    ]),
    ('mothman', '나방 인간', [
        ('claw', '나방 발톱', 'dash-strike', '날아들어 가는 발톱으로 할퀸다', ['mon_claw_rake']),
        ('scale_dust', '인분 뿌리기', 'cast', '날개의 인분을 흩뿌려 모든 적을 흐리게 한다', ['mothman_scale_dust']),
        ('dust_shot', '인분탄', 'shoot', '빛나는 인분 덩어리를 쏜다', ['fairy_dust', 'fairy_dust_hit']),
        ('hallucination', '환각', 'cast', '붉은 눈빛으로 적 하나를 환각에 빠뜨린다', ['mothman_hallucination']),
        ('sleep_powder', '수면 가루', 'cast', '졸음 가루로 모든 적을 재운다', ['mon_spore_cloud']),
        ('wing_flurry', '날개 난타', 'flurry', '큰 날개로 연달아 후려친다', ['samurai_wind_hit']),
        ('moth_charm', '불빛 유혹', 'buff', '불빛처럼 흔들려 적의 시선을 끈다', ['dancer_charm']),
        ('moonwing', '달밤의 날개', 'finisher', '달빛을 가린 거대한 날개로 환각의 밤을 여는 필살기', ['mothman_moonwing_sky', 'mon_spore_cloud']),
    ]),
    ('basilisk', '바실리스크', [
        ('bite', '독니', 'dash-strike', '재빨리 파고들어 독니로 문다', ['mon_fang_bite']),
        ('venom_spit', '독침 뱉기', 'shoot', '독을 뱉어 적을 중독시킨다', ['dragonewt_venom']),
        ('petrify', '석화 시선', 'cast', '볏을 세우고 노려봐 적 하나를 돌로 굳힌다', ['basilisk_petrify']),
        ('crest', '왕관 볏', 'buff', '왕관 볏을 세워 비늘을 단단히 한다', ['mon_shell_barrier']),
        ('tail_sweep', '꼬리 휩쓸기', 'spin', '꼬리를 크게 돌려 모든 적을 쓸어버린다', ['tiger_claw']),
        ('stone_gaze', '석화의 눈빛', 'cast', '모든 적에게 석화의 눈빛을 흩뿌린다', ['gargoyle_pal_gaze']),
        ('venom_rain', '독의 비', 'leap-strike', '뛰어올라 독을 흩뿌리며 내려앉는다', ['poison']),
        ('gorgon', '고르곤의 왕관', 'finisher', '왕관의 눈을 열어 전장 전체를 돌로 만드는 필살기', ['basilisk_gorgon_sky', 'gargoyle_pal_gaze']),
    ]),
    ('djinn', '지니', [
        ('smoke_fist', '연기 주먹', 'dash-strike', '연기 몸을 늘여 주먹을 뻗는다', ['guard_bash']),
        ('gust', '돌풍', 'shoot', '손바닥에서 돌풍을 쏘아 밀쳐낸다', ['samurai_wind_hit']),
        ('wish', '소원의 빛', 'cast', '소원을 들어줘 아군 전체를 치유한다', ['djinn_wish']),
        ('sandstorm', '모래 폭풍', 'cast', '모래 폭풍을 일으켜 모든 적을 휩쓴다', ['djinn_sandstorm']),
        ('lamp_ward', '램프의 가호', 'buff', '램프 연기로 아군 전체를 감싼다', ['summoner_sylph']),
        ('spirit', '정령 소환', 'cast', '램프 속 정령을 불러 적을 치게 한다', ['summoner_golem']),
        ('tempest', '폭풍 회오리', 'spin', '연기 몸을 회오리로 바꿔 모든 적을 휘감는다', ['nomad_dust_devil']),
        ('three_wishes', '세 가지 소원', 'finisher', '마지막 소원으로 하늘을 가르는 황금 폭풍을 부르는 필살기', ['djinn_genie_sky', 'harpy_pal_storm_hit']),
    ]),
    ('chimera', '키메라', [
        ('maul', '사자 이빨', 'dash-strike', '사자 머리로 달려들어 물어뜯는다', ['mon_fang_bite']),
        ('goat_bolt', '염소 번개', 'cast', '염소 머리가 번개를 불러 적에게 떨군다', ['mage_chain_bolt']),
        ('snake_venom', '뱀 꼬리 독', 'shoot', '꼬리 뱀이 독을 뱉는다', ['scout_venom']),
        ('rampage', '삼두 난무', 'flurry', '세 머리가 번갈아 연달아 공격한다', ['tiger_claw']),
        ('roar', '사자후', 'buff', '포효로 아군의 기세를 올린다', ['mon_howl_ring']),
        ('pounce', '덮치기', 'leap-strike', '높이 뛰어 적을 덮쳐 누른다', ['mon_quake_crack']),
        ('triple_breath', '삼중 브레스', 'cast', '불·번개·독 세 가닥 숨결을 모든 적에게 뿜는다', ['chimera_triple_breath']),
        ('chaos', '혼돈의 삼두', 'finisher', '세 머리의 숨결을 하나로 합쳐 전장을 태우는 필살기', ['chimera_rampage_sky', 'airship_flame']),
    ]),
    ('dark_angel', '타락 천사', [
        ('wing_slash', '검은 날개베기', 'dash-strike', '검은 날개로 스쳐 지나가며 벤다', ['dark_knight_slash']),
        ('black_feather', '흑우탄', 'shoot', '검은 깃털을 쏘아 꿰뚫는다', ['dark_angel_black_feather', 'seraph_feather_hit']),
        ('fallen_smite', '타락의 빛', 'cast', '더럽혀진 빛기둥을 적 하나에 내리꽂는다', ['seraph_smite']),
        ('dark_orb', '암흑 구체', 'cast', '검은 구체를 쏘아 터뜨린다', ['dark_lord_orb', 'dark_lord_orb_hit']),
        ('broken_halo', '금 간 후광', 'buff', '금 간 후광을 밝혀 마력을 끌어올린다', ['mon_demon_aura']),
        ('gravity', '추락의 무게', 'cast', '하늘에서 떨어진 무게로 모든 적을 짓누른다', ['dark_knight_gravity']),
        ('feather_storm', '흑우 폭풍', 'spin', '적진 한가운데서 검은 깃털을 흩날린다', ['mon_dark_flame']),
        ('judgment', '심판의 빛', 'finisher', '하늘을 가르고 검은 빛의 심판을 내리는 필살기', ['dark_angel_judgment_sky', 'cleric_judgment_hit']),
    ]),
]


def known_layers():
    files = [ROOT / 'src/assets/retroClassSkills.ts', ROOT / 'src/assets/retroMonsterSkills.ts'] + \
        sorted(p for p in (ROOT / 'src/assets/retroRosterSkills').glob('*.ts') if p.name != 'm6.ts')
    out = {}
    pat1 = re.compile(r'\{ key: "([^"]+)", anchor: "([a-zA-Z]+)", frame: (\d+), frames: (\d+) \}')
    pat2 = re.compile(r'L\("([^"]+)", "([a-zA-Z]+)", (\d+), (\d+)\)')
    for f in files:
        t = f.read_text()
        for m in list(pat1.finditer(t)) + list(pat2.finditer(t)):
            out.setdefault(m.group(1), (m.group(2), int(m.group(3)), int(m.group(4))))
    return out


def main():
    known = known_layers()
    bad, rows = [], []
    for ck, name, skills in TABLE:
        assert len(skills) == 8, ck
        motions = {s[2] for s in skills}
        if len(motions) < 4: bad.append(f'{ck}: motion {len(motions)}종')
        if 'blink-strike' in motions: bad.append(f'{ck}: blink-strike')
        if skills[-1][2] != 'finisher': bad.append(f'{ck}: 마지막이 finisher 아님')
        rows.append(f'    // ── {name} (monster6-{[t[0] for t in TABLE].index(ck)}) ──')
        for lv, (w, nm, mo, desc, keys) in zip(LEVELS, skills):
            new = [k for k in keys if k in NEW]
            if len(new) > 1: bad.append(f'{ck}_{w}: 새 시트 {len(new)}장')
            ls = []
            for k in keys:
                spec = NEW.get(k) or known.get(k)
                if spec is None:
                    bad.append(f'{k}: 정의 없음'); continue
                if k in NEW and not k.startswith(ck + '_'): bad.append(f'{k}: 접두')
                a, fr, n = spec
                p = FX / f'{k}.png'
                if not p.exists(): bad.append(f'{k}: PNG 없음')
                elif Image.open(p).size != (fr * n, fr): bad.append(f'{k}: 크기 {Image.open(p).size} != {fr * n}x{fr}')
                ls.append(f'{{ key: "{k}", anchor: "{a}", frame: {fr}, frames: {n} }}')
            rows.append(f'    {{ id: "skill_{ck}_{w}", classId: "class_{ck}", actorId: "actor_{ck}", name: "{nm}", level: {lv}, '
                        f'motion: "{mo}", description: "{desc}", layers: [{", ".join(ls)}] }},')
    pp = [(0, 64, 'stomp', 300), (1, 48, 'shoot', 220), (2, 64, 'stomp', 340), (3, 48, 'float', 160),
          (4, 48, 'breath', 260), (5, 64, 'float', 220), (6, 64, 'dash', 240), (7, 48, 'float', 200)]
    for i, cell, *_ in pp:
        p = ROOT / f'public/assets/generated/party-pixel/monster6-{i}.png'
        if not p.exists() or Image.open(p).size != (cell * 3, cell * 5): bad.append(f'monster6-{i}: 전투 시트 크기')
    head = ('// 묶음 m6 — 3차 로스터(OPRN 자체 제작 Monster6 걷기 칩 8명: 전설의 괴수). 담당 에이전트만 이 파일을 쓴다. 규격: src/assets/retroRoster.ts 머리 주석.\n'
            '// 생성: scripts/asset-gen/pixel-fx/gen_m6_ts.py (표를 고치고 다시 돌린다). 새 이펙트 시트: scripts/asset-gen/pixel-fx/<키>.py + lib_nm6.py.\n'
            '// 걷기 칩 scripts/asset-gen/oprn-charset/monster6.py, 전투 15칸 scripts/asset-gen/party-pixel/monster6-<i>.py + pp15_nm6.py.\n'
            '// 비인간형 몸이므로 motion 은 dash-strike·leap-strike·flurry·spin·cast·shoot·buff·finisher 만 쓴다(blink-strike 제외).\n'
            'import type { RetroRosterBatch } from "@/assets/retroRoster";\n\n'
            'export const BATCH: RetroRosterBatch = {\n  skills: [\n')
    pps = '\n'.join(f'    {{ chip: "monster6-{i}", cell: {c}, motion: "{mo}", idleFrameMs: {ms}, rows: 5 }},' for i, c, mo, ms in pp)
    OUT.write_text(head + '\n'.join(rows) + '\n  ],\n  partyPixel: [\n' + pps + '\n  ],\n};\n')
    n = sum(len(s) for _, _, s in TABLE)
    print(f'{n} skills, new sheets {len(NEW)}', 'OK' if not bad else '\n'.join(bad))
    return not bad


if __name__ == '__main__':
    sys.exit(0 if main() else 1)

