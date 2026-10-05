"""Current hero-magic layer replacements; source reuse is explicitly labelled."""
import json
from pathlib import Path
import flame_cels, crystal_cels, lightning_cels, aether_cels, water_band_cels

HERE=Path(__file__).resolve().parent

def hydra_sequence():
    doc=json.loads((HERE/'hand-authored/summon-hydra-reuse.json').read_text())
    return 128,doc['palette'],'screen',[('히드라 원화 유지',1400,[{'x':16,'y':16,'rows':doc['rows']}])]

def replacements(previous):
    result=dict(previous)
    result.update(mage_fire_burst=flame_cels.sequence(),mage_blizzard=crystal_cels.sequence(),
      mage_chain_bolt=lightning_cels.sequence(),monk_dragon_aura=hydra_sequence(),
      cleric_holy_field=water_band_cels.sequence(),monk_dragon_wave=water_band_cels.sequence(True))
    contact=previous['cleric_holy_hit'][3][0][2]
    after=previous['cleric_holy_hit'][3][4][2]
    result['cleric_holy_hit']=(64,aether_cels.PAL,'target',[
      ('접촉',60,contact),('빛의 팽창',80,[aether_cels.EXPAND]),
      ('최고점 유지',80,[aether_cels.EXPAND]),('빛의 갈라짐',60,[aether_cels.RELEASE]),
      ('잔광',80,after),('소멸',60,[])])
    result['monk_dragon_hit']=(64,aether_cels.PAL,'target',[
      ('접촉',60,previous['monk_dragon_hit'][3][0][2]),('파동 착탄',80,[aether_cels.EXPAND]),
      ('갈라진 빛',60,[aether_cels.RELEASE]),('두 번째 착탄',80,[aether_cels.EXPAND]),
      ('잔광',80,after),('소멸',60,[])])
    return result
