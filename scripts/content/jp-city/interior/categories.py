"""일본 집 실내 가구 분류 — 방(쓰는 곳)별. 가구 하나는 정확히 한 분류에 든다(굽기가 검사한다).

분류는 조수 `list_hand_interior_parts category=` 와 에디터 오브젝트 갤러리 카드 부제가 같이 쓴다.
태그(tags)는 여러 방에 걸칠 수 있지만 분류는 「주로 어디 물건인가」 하나다.
"""

CATEGORIES = [
    ('entry', '현관', ['genkan-door', 'agarikamachi', 'getabako', 'getabako-narrow', 'genkan-mat', 'slippers', 'shoes-pair',
                      'umbrella-stand']),
    ('stairs', '계단', ['stairs-up-wood', 'stairs-up-wood-wide', 'stairwell-down-wood']),
    ('door', '문', ['door-open-western', 'door-open-toilet', 'fusuma-open', 'door-side-western', 'door-side-sliding', 'door-western']),
    ('window', '창', ['window-sash', 'window-sash-small', 'shoji-window', 'curtain-window']),
    ('wallhang', '벽걸이', ['intercom', 'ac-unit', 'wall-clock', 'calendar', 'light-switch', 'kamidana']),
    ('kitchen', '부엌', ['kitchen-sink', 'kitchen-worktop', 'kitchen-stove', 'fridge', 'microwave-rack', 'cupboard', 'trash-bins']),
    ('dining', '다이닝', ['chair-dining-s', 'chair-dining-n', 'chair-dining-e', 'chair-dining-w']),
    ('living', '거실', ['sofa-s', 'sofa-n', 'sofa-e', 'sofa-w', 'low-table', 'tv-board', 'rug', 'houseplant', 'bookshelf', 'floor-lamp',
                       'cushion-floor']),
    ('washitsu', '화실', ['chabudai', 'zataku', 'zabuton', 'zaisu-s', 'zaisu-n', 'zaisu-e', 'zaisu-w', 'kotatsu', 'tansu', 'butsudan',
                         'tokonoma', 'chigaidana', 'oshiire', 'futon', 'futon-folded', 'andon', 'ikebana', 'tv-old']),
    ('bedroom', '침실', ['bed-single', 'bed-double', 'wardrobe', 'closet-doors', 'dresser-low', 'mirror-stand', 'bed-side-table']),
    ('kids', '아이방·서재', ['bunk-bed', 'desk-study', 'desk-chair-s', 'desk-chair-n', 'desk-chair-e', 'desk-chair-w']),
    ('bath', '욕실', ['bathtub', 'bathtub-lid', 'shower-faucet', 'bath-mirror', 'bath-stool', 'bath-bucket']),
    ('dressing', '탈의실·세탁', ['bath-mat', 'washbasin', 'washing-machine', 'laundry-basket', 'towel-rack', 'laundry-rack']),
    ('toilet', '화장실', ['toilet', 'toilet-handwash', 'toilet-paper', 'toilet-mat', 'toilet-slippers']),
    # ── 2묶음(2026-10-07): 가게·공공·집 보강 ──
    ('veranda', '베란다', ['h2-railing', 'h2-railing-metal', 'h2-laundry-pole', 'h2-ac-outdoor', 'h2-planter', 'h2-sandals', 'h2-sash-door']),
    ('apartment', '맨션·목조 아파트', ['h2-genkan-door-steel', 'h2-shoe-closet', 'h2-bed-side', 'h2-old-sink', 'h2-old-fridge', 'h2-cardboard',
                                     'h2-hanger-rail', 'h2-futon-dry']),
    ('oldhouse', '옛집(단층)', ['h2-garden-step', 'h2-shoji-door', 'h2-irori', 'h2-hibachi', 'h2-old-tansu']),
    ('store', '편의점·슈퍼', ['cv-gondola', 'cv-gondola-v', 'cv-gondola-end', 'cv-cooler', 'cv-open-case', 'cv-meat-case', 'cv-magazine',
                             'cv-freezer', 'cv-counter', 'cv-register', 'cv-hotcase', 'cv-coffee', 'cv-back-shelf', 'cv-atm', 'cv-copier',
                             'cv-baskets', 'cv-autodoor', 'cv-trash', 'cv-checkout', 'cv-produce', 'cv-cart', 'cv-cart-rack', 'cv-basket-stack']),
    ('food', '음식점', ['fd-stool', 'fd-chair-s', 'fd-chair-n', 'fd-chair-e', 'fd-chair-w', 'fd-prep', 'fd-sink', 'fd-stockpot',
                       'fd-noodle-boiler', 'fd-fryer', 'fd-fridge', 'fd-sake-shelf', 'fd-ticket-machine', 'fd-water-jug', 'fd-register',
                       'fd-neta-case', 'fd-beer-crates', 'fd-zashiki', 'fd-noren', 'fd-lantern', 'fd-menu-board']),
    ('shop', '상점(빵·책·약·꽃·채소·이발)', ['sh-counter', 'sh-register', 'sh-shutter', 'sh-shutter-2', 'sh-wall-shelf', 'sh-bread-shelf',
                                         'sh-bread-table', 'sh-tray-stand', 'sh-oven', 'sh-bookshelf', 'sh-book-table', 'sh-book-island',
                                         'sh-drug-shelf', 'sh-drug-island', 'sh-consult', 'sh-flower-buckets', 'sh-flower-cooler',
                                         'sh-plant-pot', 'sh-wrap-table', 'sh-veg-stand', 'sh-fruit-box', 'sh-fish-ice', 'sh-barber-chair-n',
                                         'sh-barber-chair-s', 'sh-barber-chair-e', 'sh-barber-chair-w', 'sh-barber-mirror', 'sh-shampoo',
                                         'sh-waiting-bench', 'sh-barber-pole',
          'sh-noren', 'sh-dough-bench', 'sh-proof-rack', 'sh-book-crates', 'sh-returns-shelf', 'sh-dispense-counter', 'sh-stock-shelf', 'sh-bucket-row', 'sh-paper-table', 'sh-crate-stack', 'sh-scale-table', 'sh-towel-rack', 'sh-washer']),
    ('sento', '목욕탕', ['pb-bandai', 'pb-locker', 'pb-basket-shelf', 'pb-scale', 'pb-massage-chair', 'pb-milk-fridge', 'pb-wash-station',
                        'pb-wash-stool', 'pb-mural', 'pb-noren-m', 'pb-noren-f']),
    ('laundry', '코인세탁', ['pb-washer', 'pb-dryer', 'pb-fold-table', 'pb-bench', 'pb-vending', 'pb-changer']),
    ('koban', '파출소', ['pb-police-desk', 'pb-office-chair-s', 'pb-office-chair-n', 'pb-map-board', 'pb-file-cabinet', 'pb-bicycle',
                       'pb-lost-found-shelf', 'pb-steel-locker']),
    ('clinic', '의원', ['pb-reception', 'pb-waiting-sofa-s', 'pb-waiting-sofa-n', 'pb-exam-bed', 'pb-curtain', 'pb-doctor-desk',
                       'pb-med-cabinet', 'pb-scale-height', 'pb-magazine-rack', 'pb-water-dispenser']),
]

BY_ID = {}
for _cat, _ko, _ids in CATEGORIES:
    for _id in _ids:
        assert _id not in BY_ID, ('가구가 두 분류에 들었다', _id)
        BY_ID[_id] = (_cat, _ko)


def check(obj_ids, complete=False):
    """블록 하나: 모든 가구가 분류표에 있는지. complete(모든 블록을 합친 사양): 분류표에만 있는 id 도 없는지."""
    missing = sorted(set(obj_ids) - set(BY_ID))
    assert not missing, ('분류표에 없는 가구 — categories.py 에 넣을 것', missing)
    stale = sorted(set(BY_ID) - set(obj_ids)) if complete else []
    assert not stale, ('분류표에만 있는 id — 가구가 없어졌거나 이름이 바뀜', stale)
