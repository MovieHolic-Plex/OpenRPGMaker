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
                       'fd-neta-case', 'fd-beer-crates', 'fd-zashiki', 'fd-kutsunugi', 'fd-siphon', 'fd-coffee-machine', 'fd-cake-case', 'fd-bean-shelf', 'fd-rice-tub', 'fd-grill-range', 'fd-cutting-block', 'fd-noren', 'fd-lantern', 'fd-menu-board']),
    ('shop', '상점(빵·책·약·꽃·채소·이발)', ['sh-counter', 'sh-register', 'sh-shutter', 'sh-shutter-2', 'sh-wall-shelf', 'sh-bread-shelf',
                                         'sh-bread-table', 'sh-tray-stand', 'sh-oven', 'sh-bookshelf', 'sh-book-table', 'sh-book-island',
                                         'sh-drug-shelf', 'sh-drug-island', 'sh-consult', 'sh-flower-buckets', 'sh-flower-cooler',
                                         'sh-plant-pot', 'sh-wrap-table', 'sh-veg-stand', 'sh-fruit-box', 'sh-fish-ice', 'sh-barber-chair-n',
                                         'sh-barber-chair-s', 'sh-barber-chair-e', 'sh-barber-chair-w', 'sh-barber-mirror', 'sh-shampoo',
                                         'sh-waiting-bench', 'sh-barber-pole',
          'sh-noren', 'sh-dough-bench', 'sh-proof-rack', 'sh-book-crates', 'sh-returns-shelf', 'sh-dispense-counter', 'sh-stock-shelf', 'sh-bucket-row', 'sh-paper-table', 'sh-crate-stack', 'sh-scale-table', 'sh-towel-rack', 'sh-washer',
                                         'sh-pass-window', 'sh-basket-shelf']),
    ('sento', '목욕탕', ['pb-bandai', 'pb-locker', 'pb-basket-shelf', 'pb-scale', 'pb-massage-chair', 'pb-milk-fridge', 'pb-wash-station',
                        'pb-wash-stool', 'pb-mural', 'pb-noren-m', 'pb-noren-f']),
    ('laundry', '코인세탁', ['pb-washer', 'pb-dryer', 'pb-fold-table', 'pb-bench', 'pb-vending', 'pb-changer']),
    ('koban', '파출소', ['pb-police-desk', 'pb-office-chair-s', 'pb-office-chair-n', 'pb-map-board', 'pb-file-cabinet', 'pb-bicycle',
                       'pb-lost-found-shelf', 'pb-steel-locker']),
    ('clinic', '의원', ['pb-reception', 'pb-waiting-sofa-s', 'pb-waiting-sofa-n', 'pb-exam-bed', 'pb-curtain', 'pb-doctor-desk',
                       'pb-med-cabinet', 'pb-scale-height', 'pb-magazine-rack', 'pb-water-dispenser']),
    # ── 3묶음(2026-10-08~): 학교·체육관·역·사무실·우체국. 블록마다 자기 칸 아래에만 분류 줄을 넣는다(병합 충돌 방지). ──
    # [interior_school sc-]
    ('school-entry', '학교 현관', ['sc-shoe-locker', 'sc-sunoko']),
    ('classroom', '교실', ['sc-blackboard', 'sc-podium', 'sc-teacher-desk', 'sc-desk-n', 'sc-back-locker', 'sc-notice-board',
                          'sc-cleaning-locker', 'sc-classroom-door', 'sc-tv-stand', 'sc-chair-s', 'sc-washstand']),
    ('staffroom', '교무실·보건실', ['sc-staff-desk', 'sc-staff-chair-s', 'sc-staff-chair-n', 'sc-whiteboard', 'sc-key-box',
                                 'sc-copy-machine', 'sc-tea-shelf', 'sc-nurse-bed', 'sc-curtain', 'sc-med-shelf', 'sc-scale',
                                 'sc-sink', 'sc-urinal']),
    ('special-room', '특별교실(음악·도서·이과)', ['sc-piano', 'sc-music-stand', 'sc-music-chair-n', 'sc-instrument-shelf',
                                              'sc-bookshelf', 'sc-book-island', 'sc-lib-counter', 'sc-lab-bench', 'sc-lab-stool',
                                              'sc-specimen-case', 'sc-fume-hood']),
    ('school-stairs', '학교 계단·옥상', ['sc-stairs-up', 'sc-stairwell-down', 'sc-roof-fence', 'sc-roof-fence-side', 'sc-water-tank',
                                       'sc-roof-door']),
    # (학교 끝)

    # [interior_gym gy-]
    ('gym', '체육관', ['gy-line-h', 'gy-line-v', 'gy-line-nw', 'gy-line-ne', 'gy-line-sw', 'gy-line-se', 'gy-line-tn', 'gy-line-ts', 'gy-line-circle', 'gy-key-w', 'gy-key-e', 'gy-line-v-y', 'gy-bench', 'gy-hoop-e', 'gy-hoop-w', 'gy-stage-steps', 'gy-curtain', 'gy-wall-bars', 'gy-mat', 'gy-mat-stack', 'gy-vault-box', 'gy-ball-cart', 'gy-net-post', 'gy-score-board', 'gy-pipe-chair', 'gy-clock-cage']),
    ('kindergarten', '유치원', ['gy-cubby', 'gy-kid-chair-s', 'gy-kid-chair-n', 'gy-kid-chair-e', 'gy-kid-chair-w', 'gy-upright-piano', 'gy-picture-books', 'gy-toy-box', 'gy-blocks-mat', 'gy-nap-futon', 'gy-kids-sink', 'gy-shoe-cubby', 'gy-drawing-board']),
    # (체육관 끝)

    # [interior_station st-]
    ('station', '역사·개찰', ['st-gate', 'st-fence', 'st-ticket-machine', 'st-fare-map', 'st-office-window', 'st-kiosk', 'st-bench',
                           'st-vending', 'st-timetable', 'st-platform-door', 'st-tactile', 'st-tactile-dot']),
    ('platform', '승강장', ['st-edge', 'st-boarding-mark', 'st-roof-pillar', 'st-platform-bench', 'st-sign-pole']),
    ('train', '전철 차내', ['st-long-seat', 'st-long-seat-s', 'st-priority-seat', 'st-priority-seat-s', 'st-car-door', 'st-car-end',
                          'st-pole', 'st-strap', 'st-car-door-s', 'st-door-line']),
    # (역 끝)

    # [interior_office of-]
    ('office-lobby', '사무 빌딩 로비', ['of-reception', 'of-security-gate', 'of-elevator', 'of-elevator-button', 'of-lobby-sofa-s', 'of-lobby-sofa-n',
                                       'of-plant-big', 'of-directory', 'of-mailbox-wall']),
    ('office', '사무실', ['of-desk-w', 'of-desk-e', 'of-desk-n', 'of-desk-s', 'of-boss-desk-e', 'of-boss-desk-w', 'of-desk', 'of-desk-chair-s', 'of-desk-chair-n', 'of-desk-chair-e', 'of-desk-chair-w', 'of-boss-desk',
                         'of-partition', 'of-cabinet', 'of-copier', 'of-whiteboard', 'of-server-rack', 'of-coat-rack', 'of-glass-door', 'of-fire-door',
                         'of-window-blind', 'of-stairs-up', 'of-stairwell-down']),
    ('pantry', '급탕실·휴게', ['of-pantry-sink', 'of-fridge-small', 'of-vending', 'of-stool']),
    # (사무실 끝)

    # [interior_post po-]
    ('post', '우체국', ['po-counter', 'po-parcel-scale', 'po-counter-end', 'po-ticket-machine', 'po-atm', 'po-writing-desk', 'po-bench-n', 'po-bench-s',
                      'po-po-box', 'po-poster', 'po-staff-desk', 'po-sorting-shelf', 'po-mail-cart', 'po-mail-bag']),
    ('mansion-common', '맨션 공용부', ['mc-autolock', 'mc-autodoor', 'mc-mailboxes', 'mc-delivery-box', 'mc-notice-board', 'mc-elevator', 'mc-stairs-up',
                                  'mc-stairwell-down', 'mc-railing', 'mc-unit-door', 'mc-meter-box', 'mc-bike-rack']),
    # (우체국 끝)
    # ── 4묶음(2026-10-08~): 현대 던전. 블록마다 자기 칸 아래에만. ──
    # [dungeon_underground ug-]
    ('tunnel', '지하철 보선 터널', ['ug-track-crossing', 'ug-walkway-rail', 'ug-signal', 'ug-cable-rack', 'ug-emergency-phone', 'ug-refuge-niche',
                               'ug-maint-cart', 'ug-fan', 'ug-ladder-up', 'ug-hatch-down', 'ug-point-machine', 'ug-debris', 'ug-panel', 'ug-locker',
                               'ug-door-steel', 'ug-light-off', 'ug-light-emergency', 'ug-item-toolbox', 'ug-item-lantern']),
    ('sewer', '하수도', ['ug-grate', 'ug-pipe-h', 'ug-pipe-v', 'ug-valve', 'ug-manhole-ladder', 'ug-sluice', 'ug-puddle', 'ug-trash-pile',
                       'ug-rat-hole', 'ug-pump', 'ug-item-firstaid']),
    # (지하 끝)

    # [dungeon_hospital hp-]
    ('ruin-hospital', '폐병원 병동·수술실', ['hp-bed-rusty', 'hp-curtain-torn', 'hp-iv-stand', 'hp-wheelchair', 'hp-stretcher', 'hp-nurse-station',
                                        'hp-chart-rack', 'hp-med-cart', 'hp-op-table', 'hp-op-light', 'hp-monitor-cart', 'hp-xray-box',
                                        'hp-morgue-drawers', 'hp-boiler', 'hp-elevator-dead', 'hp-bench-torn-s', 'hp-bench-torn-n', 'hp-pipes',
                                        'hp-item-medkit', 'hp-item-keybox', 'hp-item-records', 'hp-item-locker']),
    ('ruin-debris', '잔해·흔적', ['hp-bed-overturned', 'hp-debris', 'hp-papers', 'hp-glass', 'hp-ceiling-fallen', 'hp-puddle', 'hp-door-broken',
                                 'hp-door-locked', 'hp-light-flicker', 'hp-chair-fallen', 'hp-shelf-fallen', 'hp-emergency-light']),
    # (폐병원 끝)

    # [dungeon_school as-]
    ('ruin-school', '폐교', ['as-desk-dusty-n', 'as-desk-toppled', 'as-chair-toppled', 'as-blackboard-cracked', 'as-podium-broken', 'as-locker-open',
                           'as-piano-broken', 'as-bookshelf-fallen', 'as-bookshelf-dusty', 'as-staff-desk-dusty', 'as-lab-bench-dusty',
                           'as-music-chair-n', 'as-window-broken', 'as-floor-hole', 'as-debris', 'as-stairs-up-broken', 'as-stairwell-down',
                           'as-door-locked', 'as-shoe-locker-rot', 'as-vines', 'as-vines-floor', 'as-leaves', 'as-puddle', 'as-exit-light',
                           'as-item-diary', 'as-item-key-hook', 'as-item-toolbox', 'as-item-photo-box']),
    # (폐교 끝)

    # [dungeon_construction cs-]
    ('construction', '공사장', ['cs-scaffold', 'cs-rebar', 'cs-cement-bags', 'cs-steel-beam', 'cs-cable-drum', 'cs-cone', 'cs-barrier', 'cs-work-light',
                             'cs-shaft-hole', 'cs-ladder-up', 'cs-ladder-down', 'cs-generator', 'cs-site-office', 'cs-tarp', 'cs-stairs-up-bare',
                             'cs-stairwell-down', 'cs-column-bare', 'cs-site-gate', 'cs-fallen-board', 'cs-rubble', 'cs-debris', 'cs-puddle',
                             'cs-item-toolbox', 'cs-item-helmet-shelf', 'cs-item-blueprint']),
    ('parking', '지하 주차장', ['cs-pillar', 'cs-parking-line', 'cs-parking-line-h', 'cs-parking-line-corner', 'cs-car-a', 'cs-car-b', 'cs-wheel-stop',
                             'cs-ramp-arrow', 'cs-ramp-arrow-e', 'cs-fire-hose', 'cs-pay-machine', 'cs-shutter', 'cs-light-off', 'cs-exit-light',
                             'cs-ramp-up', 'cs-ramp-down', 'cs-item-car-trunk']),
    # (공사장 끝)

    # [dungeon_warehouse wh-]
    ('undermall', '지하상가', ['wh-shopfront-shutter', 'wh-shopfront-shutter-b', 'wh-shopfront-half', 'wh-shop-window', 'wh-mall-pillar',
                            'wh-mall-bench', 'wh-guide-board', 'wh-escalator-stopped', 'wh-escalator-down', 'wh-shutter-gate', 'wh-shutter-crawl',
                            'wh-vending-dark', 'wh-cart-abandoned', 'wh-exit-sign', 'wh-emergency-lamp', 'wh-fluor-broken', 'wh-pump',
                            'wh-panel-board', 'wh-pipes', 'wh-fountain-dry', 'wh-debris-paper', 'wh-glass-shards', 'wh-puddle',
                            'wh-fallen-panel', 'wh-rubble', 'wh-toppled-shelf', 'wh-item-bag', 'wh-item-locker', 'wh-item-firstaid']),
    ('warehouse', '항만 창고', ['wh-container-h', 'wh-container-h-blue', 'wh-container-h-green', 'wh-container-v', 'wh-container-v-blue',
                             'wh-container-v-green', 'wh-pallet', 'wh-pallet-rack', 'wh-forklift', 'wh-crate', 'wh-drum', 'wh-rope-coil',
                             'wh-rolling-door', 'wh-wicket-door', 'wh-catwalk-ladder', 'wh-ladder-hatch', 'wh-catwalk-rail', 'wh-office-cabin',
                             'wh-chain-hoist', 'wh-light-hang', 'wh-light-off', 'wh-tarp-pile', 'wh-item-crate-open', 'wh-item-safe',
                             'wh-item-manifest', 'wh-item-toolbox']),
    # (창고 끝)
    # ── 5묶음(2026-10-09~): 오락·숙박·상업 실내. 블록마다 자기 칸 아래에만. ──
    # [interior_amuse am-]
    ('amusement', '게임 센터', ['am-crane', 'am-crane-big', 'am-arcade-n', 'am-arcade-back', 'am-arcade-stool', 'am-rhythm', 'am-racing',
                             'am-medal-pusher', 'am-photo-booth', 'am-exchange', 'am-prize-shelf', 'am-neon-sign']),
    ('pachinko', '파친코', ['am-pachinko-n', 'am-pachinko-back', 'am-pachinko-stool', 'am-pachinko-island-end', 'am-ball-box', 'am-counter', 'am-register',
                         'am-ashtray-stand', 'am-ball-counter', 'am-smoke-eater']),
    # (오락실 끝)

    # [interior_karaoke kr-]
    ('karaoke', '노래방', ['kr-front', 'kr-front-register', 'kr-drink-bar', 'kr-room-door', 'kr-sofa-n', 'kr-sofa-e', 'kr-sofa-w', 'kr-sofa-sw',
                         'kr-sofa-se', 'kr-screen', 'kr-speaker', 'kr-mic-stand', 'kr-mirror-ball', 'kr-poster', 'kr-speaker-hang', 'kr-rental-shelf']),
    ('mangacafe', '만화 카페', ['kr-manga-shelf', 'kr-manga-island', 'kr-booth', 'kr-booth-n', 'kr-reclining-seat', 'kr-pc-desk', 'kr-shower-door',
                             'kr-ice-cream']),
    # (노래방 끝)

    # [interior_famires fr-]
    ('famires', '패밀리 레스토랑', ['fr-booth-s', 'fr-booth-n', 'fr-booth-divider', 'fr-drink-bar', 'fr-soup-bar', 'fr-dessert-case',
                                  'fr-register', 'fr-waiting-bench', 'fr-kids-chair', 'fr-pass-window']),
    ('gyudon', '규동집', ['fr-counter-stool', 'fr-gyu-pot', 'fr-rice-jar']),
    # (패밀리 레스토랑 끝)

    # [interior_hotel ht-]
    ('hotel', '비즈니스 호텔', ['ht-front', 'ht-lobby-sofa-e', 'ht-lobby-sofa-w', 'ht-elevator', 'ht-room-door', 'ht-single-bed', 'ht-desk-tv',
                              'ht-unit-bath-door', 'ht-luggage-rack', 'ht-ice-machine']),
    ('ryokan', '료칸·온천', ['ht-genkan-step', 'ht-slipper-rack', 'ht-ryokan-front', 'ht-noren-onsen-m', 'ht-noren-onsen-f', 'ht-guest-futon',
                          'ht-tea-set-table', 'ht-engawa-chairs', 'ht-bamboo-fence', 'ht-stone-lantern']),
    # (숙박 끝)

    # [interior_mall ml-]
    ('mall', '쇼핑몰', ['ml-shopfront-clothes', 'ml-shopfront-goods', 'ml-shopfront-tech', 'ml-clothes-rack', 'ml-shelf-goods', 'ml-display-table',
                     'ml-torso-stand', 'ml-fitting-room', 'ml-tv-shelf', 'ml-gadget-table', 'ml-escalator-up', 'ml-escalator-down', 'ml-bench',
                     'ml-info-board', 'ml-food-stall', 'ml-food-stall-b', 'ml-food-stall-c', 'ml-food-stall-d', 'ml-tray-return']),
    ('cinema', '영화관', ['ml-ticket-counter', 'ml-concession', 'ml-concession-counter', 'ml-poster', 'ml-poster-b', 'ml-poster-c', 'ml-screen',
                       'ml-seat-row', 'ml-step', 'ml-aisle-light', 'ml-ticket-gate', 'ml-cinema-entrance', 'ml-mall-passage']),
    # (쇼핑몰 끝)
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
