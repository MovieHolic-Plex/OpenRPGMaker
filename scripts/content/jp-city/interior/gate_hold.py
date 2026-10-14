"""3/4 관문(object-gate) 2회 판정에 떨어져 번들에서 뺀 시설 실내 조각(2026-10-14).
그림 함수는 블록 파일에 남겨 두고(다음 판에 다시 그려 관문을 받는다) 굽기·분류표·예제에서는 뺀다.
관문을 통과하면 여기서 지우고 예제 생성기(gen_places6_*.py)에 다시 넣는다. 점수·기준을 낮춰 통과시키지 않는다."""
HOLD = {
    'hs-reception-kiosk': '판정 2회 불합격 — 머리 상자가 정면 판으로 읽힌다',
    'hs-pay-machine': '판정 2회 불합격 — 윗판이 정면 머리판으로 읽힌다',
    'hs-folding-screen': '판정 2회 불합격 — 위 틀 윗면이 안 읽힌다',
    'hs-curtain-wide': '판정 2회 불합격 — 레일·주름 윗면이 안 읽힌다',
    'hs-med-fridge': '판정 2회 불합격 — 정면 입면도',
    'sx-recycle-bins': '판정 2회 불합격 — 뚜껑 윗면이 안 읽힌다',
    'sx-letter-shelf': '판정 2회 불합격 — 정면 입면도',
    'sx-riso-printer': '판정 2회 불합격 — 정면 입면도',
    'sx-book-cart': '판정 2회 불합격 — 정면 입면도',
    'sx-newspaper-rack': '판정 2회 불합격 — 정면 입면도',
    'sx-roof-vent': '판정 2회 불합격 — 캡 윗면 타원이 안 읽힌다',
    'sx-roof-ac-big': '판정 2회 불합격 — 정면 입면도',
    'ox-phone-booth': '판정 2회 불합격 — 지붕판이 정면 머리판으로 읽힌다',
    'ox-display-stand': '판정 2회 불합격 — 정면 입면도',
    'ox-umbrella-bagger': '판정 2회 불합격 — 정면 입면도',
    'ox-floor-guide': '판정 2회 불합격 — 누운 안내판이 정면 판으로 읽힌다',
    'ox-visitor-kiosk': '판정 2회 불합격 — 누운 태블릿이 정면 판으로 읽힌다',
}
