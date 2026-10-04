# 반응·표적 상태(state_counter·taunt·cover·evade·reflect·reraise·doom)를 약속한 로스터 스킬에 다시 잇는다.
import glob, re
NEW = {
  "skill_sorceress_veil": '{ kind: "support", scope: "self", states: [{ id: "state_reflect" }, { id: "state_shell" }] }',
  "skill_sorceress_doom_curse": '{ hits: [0.5, 0.5, 0.6], hpCost: 15, element: "dark", states: [{ id: "state_doom", chance: 20 }] }',
  "skill_brawler_taunt": '{ kind: "support", scope: "self", states: [{ id: "state_taunt" }, { id: "state_attack_up" }] }',
  "skill_heavy_knight_provoke": '{ kind: "support", scope: "self", states: [{ id: "state_taunt" }] }',
  "skill_heavy_knight_counter_stance": '{ kind: "support", scope: "self", states: [{ id: "state_counter" }, { id: "state_defense_up" }] }',
  "skill_living_armor_taunt": '{ kind: "support", scope: "self", states: [{ id: "state_taunt" }, { id: "state_protect" }] }',
  "skill_noble_parry_stance": '{ kind: "support", scope: "self", priority: 3, states: [{ id: "state_counter" }, { id: "state_evade" }] }',
  "skill_doll_mirror": '{ kind: "support", scope: "self", hpCost: 15, states: [{ id: "state_cover" }, { id: "state_protect" }] }',
  "skill_nomad_mirage": '{ kind: "support", scope: "self", states: [{ id: "state_evade" }] }',
  "skill_cat_afterimage": '{ kind: "support", scope: "self", states: [{ id: "state_evade" }, { id: "state_agility_up" }] }',
  "skill_kitsune_clone": '{ kind: "support", scope: "self", states: [{ id: "state_evade" }] }',
  "skill_slime_pal_split": '{ kind: "support", scope: "self", states: [{ id: "state_evade" }, { id: "state_defense_up" }] }',
  "skill_harpy_pal_wind_veil": '{ kind: "support", scope: "self", states: [{ id: "state_evade" }] }',
  "skill_gambler_poker_face": '{ kind: "support", scope: "self", states: [{ id: "state_evade" }] }',
  "skill_butler_bow": '{ kind: "support", scope: "self", states: [{ id: "state_evade" }, { id: "state_defense_up" }] }',
  "skill_mercenary_veteran_eye": '{ kind: "support", scope: "self", states: [{ id: "state_evade" }, { id: "state_attack_up" }] }',
  "skill_zombie_pal_undying": '{ kind: "healing", scope: "ally", power: 40, revive: true, states: [{ id: "state_reraise" }] }',
  "skill_cat_nine_lives": '{ kind: "support", scope: "self", states: [{ id: "state_reraise" }, { id: "state_regen" }] }',
  "skill_reaper_doom": '{ formula: "power / 2 + b.hp / 3", hits: [0.6, 0.6], states: [{ id: "state_doom", chance: 25 }] }',
  "skill_skeleton_pal_death_curse": '{ kind: "support", scope: "enemy", states: [{ id: "state_doom", chance: 40 }, { id: "state_defense_down", chance: 80 }] }',
  "skill_mandrake_death_wail": '{ formula: "b.hp / 3 + power / 2", hpCost: 20, states: [{ id: "state_doom", chance: 20 }] }',
}
DESC = {
  "skill_sorceress_veil": "거울 같은 어둠을 둘러 단일 마법을 시전자에게 튕겨낸다",
  "skill_doll_mirror": "인형이 빈사의 아군 대신 공격을 받아낸다",
  "skill_zombie_pal_undying": "쓰러진 동료를 일으켜 세우고 한 번 더 버틸 생명력을 남긴다",
  "skill_cat_nine_lives": "아홉 개의 영혼이 감싸 상처를 아물게 하고 쓰러져도 한 번 일어난다",
  "skill_skeleton_pal_death_curse": "해골 저주로 사형을 선고하고 적을 쇠약하게 한다",
  "skill_heavy_knight_counter_stance": "방패를 세우고 반격 자세를 취해 맞으면 되받아친다",
  "skill_heavy_knight_provoke": "방패를 두드려 적의 시선을 자신에게 끈다",
}
def mech_span(line):
    i = line.index("mechanic: {") + len("mechanic: ")
    depth = 0
    for j in range(i, len(line)):
        if line[j] == "{": depth += 1
        elif line[j] == "}":
            depth -= 1
            if depth == 0: return i, j + 1
    raise ValueError
done = set()
for path in sorted(glob.glob("src/assets/retroRosterSkills/*.ts")):
    lines = open(path).read().split("\n")
    changed = False
    for k, line in enumerate(lines):
        m = re.search(r'id: "(skill_[a-z0-9_]+)"', line)
        if not m or m.group(1) not in NEW: continue
        sid = m.group(1)
        if "mechanic: {" in line:
            a, b = mech_span(line)
            line = line[:a] + NEW[sid] + line[b:]
        else:
            print("기믹 칸 없음 → 새로 넣음", sid)
            line = line.replace("layers: [", f"mechanic: {NEW[sid]}, layers: [", 1)
        if sid in DESC: line = re.sub(r'description: "[^"]*"', f'description: "{DESC[sid]}"', line, count=1)
        lines[k] = line; changed = True; done.add(sid)
    if changed: open(path, "w").write("\n".join(lines))
print("바꿈", len(done), "빠짐", sorted(set(NEW) - done))
