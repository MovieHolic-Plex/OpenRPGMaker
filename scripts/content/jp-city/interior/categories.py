"""일본 집 실내 가구 분류 — 방(쓰는 곳)별. 가구 하나는 정확히 한 분류에 든다(굽기가 검사한다).

분류는 조수 `list_hand_interior_parts category=` 와 에디터 오브젝트 갤러리 카드 부제가 같이 쓴다.
태그(tags)는 여러 방에 걸칠 수 있지만 분류는 「주로 어디 물건인가」 하나다.
"""

CATEGORIES = [
    ('entry', '현관', ['genkan-door', 'agarikamachi', 'getabako', 'getabako-narrow', 'genkan-mat', 'slippers', 'shoes-pair',
                      'umbrella-stand', 'intercom']),
    ('stairs', '계단', ['stairs-up-wood', 'stairs-up-wood-wide', 'stairwell-down-wood']),
    ('door', '문', ['door-open-western', 'door-open-toilet', 'fusuma-open', 'door-side-western', 'door-side-sliding', 'door-western']),
    ('window', '창', ['window-sash', 'window-sash-small', 'shoji-window', 'curtain-window']),
    ('wallhang', '벽걸이', ['ac-unit', 'wall-clock', 'calendar', 'light-switch', 'kamidana']),
    ('kitchen', '부엌', ['kitchen-sink', 'kitchen-worktop', 'kitchen-stove', 'fridge', 'microwave-rack', 'cupboard', 'trash-bins']),
    ('dining', '다이닝', ['chair-dining-s', 'chair-dining-n', 'chair-dining-e', 'chair-dining-w']),
    ('living', '거실', ['sofa-s', 'sofa-n', 'sofa-e', 'sofa-w', 'low-table', 'tv-board', 'rug', 'houseplant', 'bookshelf', 'floor-lamp',
                       'cushion-floor']),
    ('washitsu', '화실', ['chabudai', 'zataku', 'zabuton', 'zaisu-s', 'zaisu-n', 'zaisu-e', 'zaisu-w', 'kotatsu', 'tansu', 'butsudan',
                         'tokonoma', 'chigaidana', 'oshiire', 'futon', 'futon-folded', 'andon', 'ikebana', 'tv-old']),
    ('bedroom', '침실', ['bed-single', 'bed-double', 'wardrobe', 'closet-doors', 'dresser-low', 'mirror-stand', 'bed-side-table']),
    ('kids', '아이방·서재', ['bunk-bed', 'desk-study', 'desk-chair-s', 'desk-chair-n', 'desk-chair-e', 'desk-chair-w']),
    ('bath', '욕실', ['bathtub', 'bathtub-lid', 'shower-faucet', 'bath-mirror', 'bath-stool', 'bath-bucket', 'bath-mat']),
    ('dressing', '탈의실·세탁', ['washbasin', 'washing-machine', 'laundry-basket', 'towel-rack', 'laundry-rack']),
    ('toilet', '화장실', ['toilet', 'toilet-handwash', 'toilet-paper', 'toilet-mat', 'toilet-slippers']),
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
