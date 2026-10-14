"""화풍 보정·재검수에 쓰는 테마 칩셋 목록과 「버들항 결 맞추기」 PR 의 고치기 전/후 커밋."""
THEMES = {
    # id: (타일셋 JSON, 시트 PNG, 후 커밋, 전 커밋(=후^), 비고)
    "farm":        ("src/assets/beodeulCityTileset.json", "public/assets/beodeul-city/beodeul-city-chipset.png", "17cee0175", "17cee0175^", "PR #2541 3판(전=2판 반려)"),
    "gothic":      ("src/assets/gothicManorTileset.json", "public/assets/gothic-manor/gothic-manor-chipset.png", "190fe3ce3", "190fe3ce3^", "PR #2544"),
    "campus":      ("src/assets/modernCampusTileset.json", "public/assets/modern-campus/modern-campus-chipset.png", "12d462c7f", "12d462c7f^", "PR #2547"),
    "snow":        ("src/assets/snowNorthTileset.json", "public/assets/snow-north/snow-north-chipset.png", "ea63257e9", "ea63257e9^", "PR #2548"),
    "desert":      ("src/assets/desertEastTileset.json", "public/assets/desert-east/desert-east-chipset.png", "06ad748e5", "06ad748e5^", "PR #2550"),
    "sengoku":     ("src/assets/sengokuEdoTileset.json", "public/assets/sengoku-edo/sengoku-edo-chipset.png", "148fe88ed", "148fe88ed^", "PR #2551"),
    "modern_city": ("src/assets/modernCityTileset.json", "public/assets/modern-city/modern-city-chipset.png", "dee37f177", "dee37f177^", "PR #2552"),
    "sf":          ("src/assets/sfStationTileset.json", "public/assets/sf-station/sf-station-chipset.png", "668c50089", "668c50089^", "PR #2553"),
    "sky":         ("src/assets/skyIslandTileset.json", "public/assets/sky-island/sky-island-chipset.png", "70cec72bc", "70cec72bc^", "PR #2554"),
    "pirate":      ("src/assets/pirateIslesTileset.json", "public/assets/pirate-isles/pirate-isles-chipset.png", "22209e079", "22209e079^", "PR #2555"),
    "prehistoric": ("src/assets/prehistoricTileset.json", "public/assets/prehistoric/prehistoric-chipset.png", "fd535e12e", "fd535e12e^", "PR #2556"),
    "steampunk":   ("src/assets/steampunkCityTileset.json", "public/assets/steampunk-city/steampunk-city-chipset.png", "b7723c431", "b7723c431^", "PR #2558"),
}
