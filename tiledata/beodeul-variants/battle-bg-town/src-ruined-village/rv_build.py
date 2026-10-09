# 폐허 마을 건물 조각 정의(지도와 조각 내보내기가 같이 쓴다). 각 함수 = 한 조각, 결정적.
from rv_base import *
import rv_house as RH, rv_shell as SH

def ruin_house_a():
    """반목조 폐가(6칸): 용마루가 휘어 내려앉고 앞 경사에 큰 구멍(서까래·도리가 드러남), 덧문 처진 창, 판자로 막은 창, 문짝 떨어진 문간, 무너진 굴뚝."""
    return RH.ruin_house('tim', 6, 'lwpdwr', sags=((44, 30, 10),), holes=((42, 20, 18, 11),), seed=3,
                         windows={1: {'shutter': 'L'}, 4: {'boarded': True}}, chim=4, plaster=((40, 14, 5, 5),), ivy=((86, 6),),
                         weeds=((20, 38), (70, 40)), webs=((19, 61, 5, 'tl'),))

def ruin_house_b():
    """돌벽 폐가(5칸): 돌 1층 벽에 붉은 기와 지붕, 지붕 두 군데가 꺼졌다. 집 전체가 오른쪽으로 살짝 기울었고 창마다 그을음."""
    im = RH.ruin_house('tim', 5, 'lwdwr', sags=((24, 20, 7), (60, 12, 4)), holes=((22, 22, 12, 9), (60, 26, 7, 6)), seed=8, gs='sto',
                       windows={1: {'boarded': False}, 3: {'shutter': 'R'}}, door='hang', chim=1, ivy=((6, 8),), weeds=((44, 40),), soot_k=0.5)
    return RH._lean(im, 3)

def gable_ruin_a():
    """박공 정면 폐가(4칸): 왼쪽 지붕 경사에 구멍(가로 서까래), 박공벽 삼각에 뚫린 구멍, 경첩 하나로 매달린 문짝."""
    return RH.gable_ruin('tim', 4, 2, seed=5, kinds='lwdr', ivy=((10, 8),), hole_roof=((16, 20, 9, 8),), webs=((52, 64, 4, 'tr'),))

def gable_ruin_log():
    """통나무 박공 폐가(4칸): 통나무 벽, 지붕 오른쪽이 꺼지고 박공에 구멍, 문은 판자로 막혔다. 집이 기울었다."""
    im = RH.gable_ruin('wod', 4, 2, seed=11, kinds='ldwr', door='boarded', hole_roof=((46, 24, 9, 7),), hole_gable=(26, 0.6, 6, 5),
                       windows={2: {'boarded': True}}, ivy=((58, 10),))
    return RH._lean(im, 2)

def gable_ruin_stone():
    """돌벽 박공 폐가(4칸): 돌 벽 위 반목조 박공, 지붕 양쪽에 구멍. 문짝 없는 문간과 덧문 처진 창."""
    return RH.gable_ruin('tim', 4, 2, seed=17, gs='sto', kinds='lwdr', door='gone', hole_roof=((14, 26, 8, 7), (48, 18, 7, 6)),
                         hole_gable=None, windows={1: {'shutter': 'L'}}, soot_k=0.4)

def burnt_house(): return SH.burnt_house()
def burnt_house_pale(): return SH.burnt_house_b()
def church_ruin(): return SH.church_ruin()

BUILDINGS = ['ruin_house_a', 'ruin_house_b', 'gable_ruin_a', 'gable_ruin_log', 'gable_ruin_stone', 'burnt_house', 'burnt_house_pale', 'church_ruin']
