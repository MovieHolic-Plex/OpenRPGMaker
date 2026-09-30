# 조수 도구로 만든 임의 스킬 8종 (화염 검투사)

조수 도구 레지스트리를 헤드리스로 직접 호출(scripts/qa/runtime/retro-assistant-build-project.mts)해 만든 새 직업 class_flame_gladiator 의 스킬 8종을 retro2003 측면 전투에서 실제로 재생했다(scripts/qa/runtime/retro2003-skills-gif.mjs --set custom).

결과: 8/8 스킬에서 빌린 연출의 층이 전부 표시되고 효과음 이벤트가 발생했다. 빌린 연출의 층 수와 표시된 층 수가 8건 모두 일치한다.

| 스킬 | 이름 | 빌린 연출 | 모션 | 연출 층 |
|---|---|---|---|---|
| skill_ember_slash | 불꽃 베기 | skill_hero_flame_sword | dash-strike | hero_flame_aura, hero_flame_slash |
| skill_ember_triple | 화염 삼연격 | skill_samurai_twin_moon | flurry | samurai_moon |
| skill_ember_oath | 불사의 서약 | skill_hero_war_cry | buff | hero_warcry |
| skill_ember_chalice | 피의 잔 | skill_dark_knight_gravity | cast | dark_knight_gravity |
| skill_ember_tide | 작열 파도 | skill_mage_meteor | cast | mage_meteor_rock, mage_meteor_blast |
| skill_ember_roar | 도발의 함성 | skill_guard_taunt | buff | guard_taunt |
| skill_ember_wrath | 분노의 일격 | skill_samurai_final_cut | finisher | samurai_final_sky, samurai_final_slash |
| skill_ember_fall | 폭염 낙하 | skill_red_mage_catastrophe | finisher | red_mage_catastrophe_sky, red_mage_catastrophe_hit |

## 재생 결과 (녹화 하네스 원본)

PASS · 8/8 clips · reduced=false

| skill | recorded | layers shown | sound events | errors |
|---|---|---|---|---|
| skill_ember_slash | yes | 2 (2 nodes) | 3 | - |
| skill_ember_triple | yes | 1 (3 nodes) | 18 | - |
| skill_ember_oath | yes | 1 (2 nodes) | 2 | - |
| skill_ember_chalice | yes | 1 (3 nodes) | 2 | - |
| skill_ember_tide | yes | 2 (6 nodes) | 3 | - |
| skill_ember_roar | yes | 1 (1 nodes) | 1 | - |
| skill_ember_wrath | yes | 2 (4 nodes) | 5 | - |
| skill_ember_fall | yes | 2 (4 nodes) | 5 | - |


GIF 는 4개(slash, triple, tide, wrath)만 남겼다. 나머지 4개는 report 의 표시 층·효과음 수로 갈음한다.

재현: node_modules 가 있는 체크아웃에서

    npx vite-node scripts/qa/runtime/retro-assistant-build-project.mts
    node scripts/qa/runtime/retro2003-skills-gif.mjs --set custom --custom .omo/retro-assistant/custom-project.json --out <경로>
