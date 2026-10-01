# 게이지 밀기(gauge)·힘 모으기(charge)를 이름·설명이 약속하는 로스터 스킬에 잇는다. 기믹 칸 맨 앞에 키를 끼운다.
import glob, re
ADD = {
  "skill_chronomancer_time_arrow": "gauge: -40",
  "skill_chronomancer_time_skip": "gauge: -25",
  "skill_miner_tunnel_quake": "gauge: -25",
  "skill_gunslinger_dead_eye": "gauge: -30",
  "skill_gunner_flare": "gauge: 30",
  "skill_noble_noble_order": "gauge: 30",
  "skill_sailor_hoist_sail": "gauge: 25",
  # 한 차례를 버리므로 위력 약 1.7배.
  "skill_archmage_grand_fusion": "charge: 1, power: 300",
  "skill_wraith_mage_requiem": "charge: 1, power: 300",
  "skill_dragonewt_flame_breath": "charge: 1, power: 120",
  "skill_cyclops_eye_beam": "charge: 1, power: 130",
}
done = set()
for path in sorted(glob.glob("src/assets/retroRosterSkills/*.ts")):
    lines = open(path).read().split("\n"); changed = False
    for k, line in enumerate(lines):
        m = re.search(r'id: "(skill_[a-z0-9_]+)"', line)
        if not m or m.group(1) not in ADD or "mechanic: { " not in line: continue
        if re.search(r'mechanic: \{ (gauge|charge):', line): done.add(m.group(1)); continue
        lines[k] = line.replace("mechanic: { ", "mechanic: { " + ADD[m.group(1)] + ", ", 1); changed = True; done.add(m.group(1))
    if changed: open(path, "w").write("\n".join(lines))
print("바꿈", len(done), "빠짐", sorted(set(ADD) - done))
