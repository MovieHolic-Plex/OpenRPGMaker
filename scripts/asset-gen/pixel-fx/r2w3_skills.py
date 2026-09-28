"""p2·p3 스킬 목록(정본) — 직업 8개 × 스킬 8개. 레이어는 시트 키만 적고, frame·frames·anchor 는 시트 등록값(REG)에서 채운다.
r2w3_emit.py 가 이 목록으로 src/assets/retroRosterSkills/p2.ts·p3.ts 를 쓴다.
스킬 규칙: 레벨 1·3·5·7·10·12·16·22, 마지막은 finisher, motion 은 직업당 4종 이상, 주된 층은 이 스킬 전용의 새 시트."""
import importlib, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import lib_r2w3 as L

LV = [1, 3, 5, 7, 10, 12, 16, 22]


def S(slug, name, motion, desc, *layers):
    return dict(slug=slug, name=name, motion=motion, desc=desc, layers=list(layers))


CLASSES = [
    dict(batch='p2', classId='class_gypsy', ck='gypsy', chip='people2-3', name='방랑 점술사', mod='r2w3_gypsy', skills=[
        S('tarot_flick', '타로 던지기', 'shoot', '타로 카드를 부채질하듯 날려 적을 벤다', 'gypsy_card', 'gypsy_card_hit'),
        S('crystal_gaze', '수정구의 환영', 'cast', '수정구를 띄워 환영 광선을 쏘고 산산이 부순다', 'gypsy_crystal'),
        S('curse_card', '저주 카드', 'cast', '검은 카드를 내리꽂아 해골 독기로 저주한다', 'gypsy_curse'),
        S('wheel_fortune', '운명의 수레바퀴', 'cast', '황금 수레바퀴를 돌려 모든 적의 운을 뒤튼다', 'gypsy_wheel'),
        S('veil_dance', '베일 춤', 'buff', '베일 리본과 금화를 휘감아 몸을 가볍게 한다', 'gypsy_dance'),
        S('lovers_charm', '연인의 매혹', 'cast', '붉은 하트와 보랏빛 하트가 얽혀 적의 마음을 사로잡는다', 'gypsy_lovers'),
        S('card_storm', '카드 회오리', 'spin', '카드 수십 장이 회오리로 적진을 갈아 버린다', 'gypsy_cardstorm'),
        S('star_prophecy', '별의 점괘', 'finisher', '「별」 카드를 세워 하늘의 별빛을 쏟아붓는 필살기', 'gypsy_fate_sky', 'gypsy_fate_hit'),
    ]),
]


def load_all():
    for cl in CLASSES:
        importlib.import_module(cl['mod'])


def find(class_id):
    return next(c for c in CLASSES if c['classId'] == class_id)


def build_class(class_id, argv):
    cl = find(class_id)
    load_all()
    keys = []
    for sk in cl['skills']:
        keys += [k for k in sk['layers'] if k not in keys]
    return L.make_class(cl['batch'], cl['ck'], keys, cl['skills'], cl['chip'], argv)
