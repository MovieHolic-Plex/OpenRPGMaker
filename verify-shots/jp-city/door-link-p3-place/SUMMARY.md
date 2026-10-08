# 거리 문 ↔ 실내 런타임 QA

판정: **통과** · PASS 74줄 · 커밋 5f0c99be59

실행 방식: links 의 `example` 은 게시 전 예제 JSON(tiledata/jp-city/interior/examples)을 build_hand_interior_room 으로 지어 `interiorMapId` 로 잇고, `place` 는 게시된 장소(public/assets/region-references)를 도구가 가져와 잇는다. 게시 뒤에는 같은 장소 id 로 place 경로가 된다.

도구 결과 (scripts/content/jp-city/qa/door-link-p3-place.json):
- 일본 도시 · 상가 거리 문 (19,10) 외 1칸 ↔ 일본 학교 본관(中学校・高校) 실내 · 학교 본관 1층(昇降口·교무실·보건실): 문 앞 (19,11) (20,11) 발판 → 실내 (13,18) · 실내 출입구 (11,19) (12,19) (13,19) (14,19) → 거리 (19,12) · 「일본 학교 본관(中学校・高校) 실내」 새 맵 map_ref_jp_city_school_1f_26x20 + 다른 층 map_ref_jp_city_school_1f_26x20:jp-city-school-2f, map_ref_jp_city_school_1f_26x20:jp-city-school-3f, map_ref_jp_city_school_1f_26x20:jp-city-school-roof
- 일본 도시 · 상가 거리 문 (1,22) 외 1칸 ↔ 일본 학교 체육관 실내: 문 앞 (1,23) (2,23) 발판 → 실내 (2,13) · 실내 출입구 (1,14) (2,14) → 거리 (1,24) · 「일본 학교 체육관 실내」 새 맵 map_ref_jp_city_gym_21x15
- 일본 도시 · 상가 거리 문 (4,10) 외 1칸 ↔ 일본 유치원 실내: 문 앞 (4,11) (5,11) 발판 → 실내 (6,10) · 실내 출입구 (5,11) (6,11) → 거리 (4,12) · 「일본 유치원 실내」 새 맵 map_ref_jp_city_kindergarten_18x12
- 일본 도시 · 상가 거리 문 (7,22) 외 1칸 ↔ 일본 작은 지상역(駅) — 역사·승강장·전철 차내 · 일본 작은 지상역 역사(駅舎) 실내: 문 앞 (7,23) (8,23) 발판 → 실내 (6,9) · 실내 출입구 (5,10) (6,10) (7,10) → 거리 (6,24) · 「일본 작은 지상역(駅) — 역사·승강장·전철 차내」 새 맵 map_ref_jp_city_station_16x11 + 다른 층 map_ref_jp_city_station_16x11:jp-city-station-platform, map_ref_jp_city_station_16x11:jp-city-train-car
- 일본 도시 · 상가 거리 문 (8,10) 외 2칸 ↔ 일본 사무 빌딩 실내(1층 로비 + 사무층) · 사무 빌딩 1층 로비: 문 앞 (8,11) (9,11) (10,11) 발판 → 실내 (8,8) · 실내 출입구 (7,9) (8,9) → 거리 (9,12) · 「일본 사무 빌딩 실내(1층 로비 + 사무층)」 새 맵 map_ref_jp_city_office_1f_16x10 + 다른 층 map_ref_jp_city_office_1f_16x10:jp-city-office-floor
- 일본 도시 · 상가 거리 문 (21,22) 외 1칸 ↔ 일본 우체국(郵便局) 실내: 문 앞 (21,23) (22,23) 발판 → 실내 (6,11) · 실내 출입구 (5,12) (6,12) → 거리 (21,24) · 「일본 우체국(郵便局) 실내」 새 맵 map_ref_jp_city_post_office_12x13
- 일본 도시 · 상가 거리 문 (27,10) 외 1칸 ↔ 일본 맨션 공용부(엔트런스·엘리베이터 홀·외복도) · 일본 맨션 공용부 1층(엔트런스·엘리베이터 홀): 문 앞 (27,11) (28,11) 발판 → 실내 (4,10) · 실내 출입구 (3,11) (4,11) → 거리 (27,12) · 「일본 맨션 공용부(엔트런스·엘리베이터 홀·외복도)」 새 맵 map_ref_jp_city_mansion_lobby_9x12 + 다른 층 map_ref_jp_city_mansion_lobby_9x12:jp-city-mansion-corridor

- PASS — 01a. A2 → 일본 학교 본관(中学校・高校) 실내 · 학교 본관 1층(昇降口·교무실·보건실) — 문 앞 발판 (19,11) 으로 up 한 걸음: map_ref_jp_city_school_1f_26x20 (13,18) / 기대 (13,18)
- PASS — 01s1. 계단 올라가기 16걸음: map_ref_jp_city_school_1f_26x20:jp-city-school-2f (22,16) / 기대 (22,16)
- PASS — 01s2. 위층 둘러보고 계단 내려오기 69걸음: map_ref_jp_city_school_1f_26x20 (23,13) / 기대 (23,13)
- PASS — 01h1. map_ref_jp_city_school_1f_26x20 (23,12) 밟기 → map_ref_jp_city_school_1f_26x20:school-2f: map_ref_jp_city_school_1f_26x20:jp-city-school-2f (22,16) / 기대 (22,16)
- PASS — 01h2. map_ref_jp_city_school_1f_26x20 (24,12) 밟기 → map_ref_jp_city_school_1f_26x20:school-2f: map_ref_jp_city_school_1f_26x20:jp-city-school-2f (22,16) / 기대 (22,16)
- PASS — 01h3. map_ref_jp_city_school_1f_26x20:school-2f (21,15) 밟기 → map_ref_jp_city_school_1f_26x20:school-3f: map_ref_jp_city_school_1f_26x20:jp-city-school-3f (22,13) / 기대 (22,13)
- PASS — 01h4. map_ref_jp_city_school_1f_26x20:school-2f (22,15) 밟기 → map_ref_jp_city_school_1f_26x20:school-3f: map_ref_jp_city_school_1f_26x20:jp-city-school-3f (22,13) / 기대 (22,13)
- PASS — 01h5. map_ref_jp_city_school_1f_26x20:school-2f (23,16) 밟기 → map_ref_jp_city_school_1f_26x20: map_ref_jp_city_school_1f_26x20 (23,13) / 기대 (23,13)
- PASS — 01h6. map_ref_jp_city_school_1f_26x20:school-2f (24,16) 밟기 → map_ref_jp_city_school_1f_26x20: map_ref_jp_city_school_1f_26x20 (24,13) / 기대 (24,13)
- PASS — 01h7. map_ref_jp_city_school_1f_26x20:school-3f (21,12) 밟기 → map_ref_jp_city_school_1f_26x20:school-roof: map_ref_jp_city_school_1f_26x20:jp-city-school-roof (6,7) / 기대 (6,7)
- PASS — 01h8. map_ref_jp_city_school_1f_26x20:school-3f (22,12) 밟기 → map_ref_jp_city_school_1f_26x20:school-roof: map_ref_jp_city_school_1f_26x20:jp-city-school-roof (6,7) / 기대 (6,7)
- PASS — 01h9. map_ref_jp_city_school_1f_26x20:school-3f (23,13) 밟기 → map_ref_jp_city_school_1f_26x20:school-2f: map_ref_jp_city_school_1f_26x20:jp-city-school-2f (21,16) / 기대 (21,16)
- PASS — 01h10. map_ref_jp_city_school_1f_26x20:school-roof (6,6) 밟기 → map_ref_jp_city_school_1f_26x20:school-3f: map_ref_jp_city_school_1f_26x20:jp-city-school-3f (21,13) / 기대 (21,13)
- PASS — 01b. 실내 양 끝(가장 먼 칸 → 거기서 가장 먼 칸)까지 69걸음: 22,8 → 23,8 → 24,8 → 24,7
- PASS — 01c. 출입구 밟고 거리로: jp-city-shopstreet (19,12) / 기대 (19,12)
- PASS — 01d. 거리에 머문다(되튕김 없음, 1.5초): jp-city-shopstreet (19,12)
- PASS — 02a. B1a → 일본 학교 체육관 실내 — 문 앞 발판 (1,23) 으로 up 한 걸음: map_ref_jp_city_gym_21x15 (2,13) / 기대 (2,13)
- PASS — 02b. 실내 양 끝(가장 먼 칸 → 거기서 가장 먼 칸)까지 55걸음: 4,13 → 3,13 → 2,13 → 1,13
- PASS — 02c. 출입구 밟고 거리로: jp-city-shopstreet (1,24) / 기대 (1,24)
- PASS — 02d. 거리에 머문다(되튕김 없음, 1.5초): jp-city-shopstreet (1,24)
- PASS — 03a. A1b → 일본 유치원 실내 — 문 앞 발판 (4,11) 으로 up 한 걸음: map_ref_jp_city_kindergarten_18x12 (6,10) / 기대 (6,10)
- PASS — 03b. 실내 양 끝(가장 먼 칸 → 거기서 가장 먼 칸)까지 45걸음: 13,9 → 14,9 → 15,9 → 16,9
- PASS — 03c. 출입구 밟고 거리로: jp-city-shopstreet (4,12) / 기대 (4,12)
- PASS — 03d. 거리에 머문다(되튕김 없음, 1.5초): jp-city-shopstreet (4,12)
- PASS — 04a. B1b → 일본 작은 지상역(駅) — 역사·승강장·전철 차내 · 일본 작은 지상역 역사(駅舎) 실내 — 문 앞 발판 (7,23) 으로 right 한 걸음: map_ref_jp_city_station_16x11 (6,9) / 기대 (6,9)
- PASS — 04s1. 계단 올라가기 8걸음: map_ref_jp_city_station_16x11:jp-city-station-platform (5,7) / 기대 (5,7)
- PASS — 04s2. 위층 둘러보고 계단 내려오기 2걸음: map_ref_jp_city_station_16x11 (4,4) / 기대 (4,4)
- PASS — 04h1. map_ref_jp_city_station_16x11 (4,3) 밟기 → map_ref_jp_city_station_16x11:station-platform: map_ref_jp_city_station_16x11:jp-city-station-platform (5,7) / 기대 (5,7)
- PASS — 04h2. map_ref_jp_city_station_16x11 (5,3) 밟기 → map_ref_jp_city_station_16x11:station-platform: map_ref_jp_city_station_16x11:jp-city-station-platform (5,7) / 기대 (5,7)
- PASS — 04h3. map_ref_jp_city_station_16x11:station-platform (5,8) 밟기 → map_ref_jp_city_station_16x11: map_ref_jp_city_station_16x11 (4,4) / 기대 (4,4)
- PASS — 04h4. map_ref_jp_city_station_16x11:station-platform (6,8) 밟기 → map_ref_jp_city_station_16x11: map_ref_jp_city_station_16x11 (4,4) / 기대 (4,4)
- PASS — 04h5. map_ref_jp_city_station_16x11:station-platform (5,6) 밟기 → map_ref_jp_city_station_16x11:train-car: map_ref_jp_city_station_16x11:jp-city-train-car (5,4) / 기대 (5,4)
- PASS — 04h6. map_ref_jp_city_station_16x11:station-platform (6,6) 밟기 → map_ref_jp_city_station_16x11:train-car: map_ref_jp_city_station_16x11:jp-city-train-car (5,4) / 기대 (5,4)
- PASS — 04h7. map_ref_jp_city_station_16x11:station-platform (14,6) 밟기 → map_ref_jp_city_station_16x11:train-car: map_ref_jp_city_station_16x11:jp-city-train-car (14,4) / 기대 (14,4)
- PASS — 04h8. map_ref_jp_city_station_16x11:station-platform (15,6) 밟기 → map_ref_jp_city_station_16x11:train-car: map_ref_jp_city_station_16x11:jp-city-train-car (14,4) / 기대 (14,4)
- PASS — 04h9. map_ref_jp_city_station_16x11:train-car (5,3) 밟기 → map_ref_jp_city_station_16x11:station-platform: map_ref_jp_city_station_16x11:jp-city-station-platform (5,7) / 기대 (5,7)
- PASS — 04h10. map_ref_jp_city_station_16x11:train-car (6,3) 밟기 → map_ref_jp_city_station_16x11:station-platform: map_ref_jp_city_station_16x11:jp-city-station-platform (5,7) / 기대 (5,7)
- PASS — 04h11. map_ref_jp_city_station_16x11:train-car (14,3) 밟기 → map_ref_jp_city_station_16x11:station-platform: map_ref_jp_city_station_16x11:jp-city-station-platform (14,7) / 기대 (14,7)
- PASS — 04h12. map_ref_jp_city_station_16x11:train-car (15,3) 밟기 → map_ref_jp_city_station_16x11:station-platform: map_ref_jp_city_station_16x11:jp-city-station-platform (14,7) / 기대 (14,7)
- PASS — 04b. 실내 양 끝(가장 먼 칸 → 거기서 가장 먼 칸)까지 33걸음: 4,4 → 3,4 → 2,4 → 1,4
- PASS — 04c. 출입구 밟고 거리로: jp-city-shopstreet (6,24) / 기대 (6,24)
- PASS — 04d. 거리에 머문다(되튕김 없음, 1.5초): jp-city-shopstreet (6,24)
- PASS — 05a. A1c → 일본 사무 빌딩 실내(1층 로비 + 사무층) · 사무 빌딩 1층 로비 — 문 앞 발판 (8,11) 으로 up 한 걸음: map_ref_jp_city_office_1f_16x10 (8,8) / 기대 (8,8)
- PASS — 05s1. 계단 올라가기 13걸음: map_ref_jp_city_office_1f_16x10:jp-city-office-floor (13,15) / 기대 (13,15)
- PASS — 05s2. 위층 둘러보고 계단 내려오기 59걸음: map_ref_jp_city_office_1f_16x10 (14,4) / 기대 (14,4)
- PASS — 05h1. map_ref_jp_city_office_1f_16x10 (14,3) 밟기 → map_ref_jp_city_office_1f_16x10:office-floor: map_ref_jp_city_office_1f_16x10:jp-city-office-floor (13,15) / 기대 (13,15)
- PASS — 05h2. map_ref_jp_city_office_1f_16x10 (4,3) 밟기 → map_ref_jp_city_office_1f_16x10:office-floor: map_ref_jp_city_office_1f_16x10:jp-city-office-floor (17,15) / 기대 (17,15)
- PASS — 05h3. map_ref_jp_city_office_1f_16x10 (5,3) 밟기 → map_ref_jp_city_office_1f_16x10:office-floor: map_ref_jp_city_office_1f_16x10:jp-city-office-floor (18,15) / 기대 (18,15)
- PASS — 05h4. map_ref_jp_city_office_1f_16x10 (7,3) 밟기 → map_ref_jp_city_office_1f_16x10:office-floor: map_ref_jp_city_office_1f_16x10:jp-city-office-floor (21,15) / 기대 (21,15)
- PASS — 05h5. map_ref_jp_city_office_1f_16x10 (8,3) 밟기 → map_ref_jp_city_office_1f_16x10:office-floor: map_ref_jp_city_office_1f_16x10:jp-city-office-floor (22,15) / 기대 (22,15)
- PASS — 05h6. map_ref_jp_city_office_1f_16x10:office-floor (14,15) 밟기 → map_ref_jp_city_office_1f_16x10: map_ref_jp_city_office_1f_16x10 (14,4) / 기대 (14,4)
- PASS — 05h7. map_ref_jp_city_office_1f_16x10:office-floor (15,15) 밟기 → map_ref_jp_city_office_1f_16x10: map_ref_jp_city_office_1f_16x10 (14,4) / 기대 (14,4)
- PASS — 05h8. map_ref_jp_city_office_1f_16x10:office-floor (17,14) 밟기 → map_ref_jp_city_office_1f_16x10: map_ref_jp_city_office_1f_16x10 (4,4) / 기대 (4,4)
- PASS — 05h9. map_ref_jp_city_office_1f_16x10:office-floor (18,14) 밟기 → map_ref_jp_city_office_1f_16x10: map_ref_jp_city_office_1f_16x10 (5,4) / 기대 (5,4)
- PASS — 05h10. map_ref_jp_city_office_1f_16x10:office-floor (21,14) 밟기 → map_ref_jp_city_office_1f_16x10: map_ref_jp_city_office_1f_16x10 (7,4) / 기대 (7,4)
- PASS — 05h11. map_ref_jp_city_office_1f_16x10:office-floor (22,14) 밟기 → map_ref_jp_city_office_1f_16x10: map_ref_jp_city_office_1f_16x10 (8,4) / 기대 (8,4)
- PASS — 05b. 실내 양 끝(가장 먼 칸 → 거기서 가장 먼 칸)까지 44걸음: 12,5 → 12,4 → 13,4 → 14,4
- PASS — 05c. 출입구 밟고 거리로: jp-city-shopstreet (9,12) / 기대 (9,12)
- PASS — 05d. 거리에 머문다(되튕김 없음, 1.5초): jp-city-shopstreet (9,12)
- PASS — 06a. B2 → 일본 우체국(郵便局) 실내 — 문 앞 발판 (21,23) 으로 up 한 걸음: map_ref_jp_city_post_office_12x13 (6,11) / 기대 (6,11)
- PASS — 06b. 실내 양 끝(가장 먼 칸 → 거기서 가장 먼 칸)까지 45걸음: 7,10 → 8,10 → 9,10 → 10,10
- PASS — 06c. 출입구 밟고 거리로: jp-city-shopstreet (21,24) / 기대 (21,24)
- PASS — 06d. 거리에 머문다(되튕김 없음, 1.5초): jp-city-shopstreet (21,24)
- PASS — 07a. E1 → 일본 맨션 공용부(엔트런스·엘리베이터 홀·외복도) · 일본 맨션 공용부 1층(엔트런스·엘리베이터 홀) — 문 앞 발판 (27,11) 으로 up 한 걸음: map_ref_jp_city_mansion_lobby_9x12 (4,10) / 기대 (4,10)
- PASS — 07s1. 계단 올라가기 9걸음: map_ref_jp_city_mansion_lobby_9x12:jp-city-mansion-corridor (3,4) / 기대 (3,4)
- PASS — 07s2. 위층 둘러보고 계단 내려오기 18걸음: map_ref_jp_city_mansion_lobby_9x12 (5,4) / 기대 (5,4)
- PASS — 07h1. map_ref_jp_city_mansion_lobby_9x12 (1,4) 밟기 → map_ref_jp_city_mansion_lobby_9x12:mansion-corridor: map_ref_jp_city_mansion_lobby_9x12:jp-city-mansion-corridor (3,4) / 기대 (3,4)
- PASS — 07h2. map_ref_jp_city_mansion_lobby_9x12 (2,4) 밟기 → map_ref_jp_city_mansion_lobby_9x12:mansion-corridor: map_ref_jp_city_mansion_lobby_9x12:jp-city-mansion-corridor (3,4) / 기대 (3,4)
- PASS — 07h3. map_ref_jp_city_mansion_lobby_9x12 (5,3) 밟기 → map_ref_jp_city_mansion_lobby_9x12:mansion-corridor: map_ref_jp_city_mansion_lobby_9x12:jp-city-mansion-corridor (18,4) / 기대 (18,4)
- PASS — 07h4. map_ref_jp_city_mansion_lobby_9x12:mansion-corridor (2,4) 밟기 → map_ref_jp_city_mansion_lobby_9x12: map_ref_jp_city_mansion_lobby_9x12 (3,4) / 기대 (3,4)
- PASS — 07h5. map_ref_jp_city_mansion_lobby_9x12:mansion-corridor (19,4) 밟기 → map_ref_jp_city_mansion_lobby_9x12: map_ref_jp_city_mansion_lobby_9x12 (5,4) / 기대 (5,4)
- PASS — 07b. 실내 양 끝(가장 먼 칸 → 거기서 가장 먼 칸)까지 22걸음: 4,4 → 5,4 → 6,4 → 7,4
- PASS — 07c. 출입구 밟고 거리로: jp-city-shopstreet (27,12) / 기대 (27,12)
- PASS — 07d. 거리에 머문다(되튕김 없음, 1.5초): jp-city-shopstreet (27,12)

증거: NNa-street(문 앞) · NNb-inside(도착) · NNs-upstairs(위층, 여러 층만) · NNc-far(실내 끝) · NNd-back(거리로 나와 1.5초 뒤). NNhK = 층·구역 이동 칸 K번째를 옆 칸에서 한 걸음 밟아 대상 맵·칸 도착(그림 없음)
