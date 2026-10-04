#!/bin/bash
# B 그룹 녹화: 변신·아군 힘 모으기·적 예고·게이지 밀기·재생 오라·소환.
cd "$(dirname "$0")/../.."
H=scripts/qa/runtime/retro2003-skills-gif.mjs
O=verify-shots/retro-btl-b
rm -rf $O/transform $O/charge $O/telegraph $O/gauge $O/regen $O/summon $O/summon-djinn $O/summon-king
node $H --set roster --batch m4 --skills skill_tanuki_disguise --linger 4 --out $O/transform > $O/transform.log 2>&1
node $H --set roster --batch b4 --skills skill_dragonewt_flame_breath --linger 4 --out $O/charge > $O/charge.log 2>&1
node $H --set roster --batch b4 --skills skill_dragonewt_flame_breath --enemy-skill skill_cyclops_eye_beam --linger 16 --out $O/telegraph > $O/telegraph.log 2>&1
node $H --set roster --batch a1 --skills skill_chronomancer_time_arrow --linger 4 --out $O/gauge > $O/gauge.log 2>&1
node $H --set roster --batch a3 --skills skill_flower_girl_aroma --linger 2 --out $O/regen > $O/regen.log 2>&1
node $H --set roster --batch a3 --skills skill_summoner_imp_call,skill_summoner_golem_fist --out $O/summon > $O/summon.log 2>&1
node $H --set roster --batch m6 --skills skill_djinn_spirit --out $O/summon-djinn > $O/summon-djinn.log 2>&1
node $H --set roster --batch a1 --skills skill_beast_tamer_beast_king --out $O/summon-king > $O/summon-king.log 2>&1
echo ALL-DONE
