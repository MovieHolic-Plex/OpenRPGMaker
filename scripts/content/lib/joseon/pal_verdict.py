"""조선 궁 내부 조각(pal_) 판정(눈으로 본 결과)을 verdicts.json 에 쓴다. 판정은 그 조각의 현재 픽셀 해시에 묶인다 — 그림이 바뀌면 다시 돌려야 한다.

    python3 pal_verdict.py        # 표에 없는 pal_ 조각이 있으면 오류로 멈춘다(빠짐없이 봤다는 뜻)
본 방법: 하네스 `npm run harness -- joseon-baram gate --candidate --piece <pal_ 이름들> --sheets` 로 [내 조각 | 후보 B·v5 기준] 시트(×3)를 만들어 조각마다 직접 열고
(pal_stack.py 로 6장씩 이어 읽음), 정전·회랑·침전 3방을 굽은 그림(×3~5 확대, 구역 크롭)에서 한 번 더 봤다. 점검기·통과율 숫자를 근거로 쓰지 않았다.
상태: pass = 기준 기물과 같은 문법(윗면 3~6px + 앞면, 안쪽 윤곽, 왼쪽 위 빛) / note = 쓸 수 있으나 아래 차이가 있다.
정면 벽 조각(wall_·door_gung)은 윗면이 보이지 않는 정면이 맞다(벽면 규칙). 기준 v5 는 서양식이라 궁 기물은 더 크고 장식이 많다 — 같은 배율에서 크기 차이는 의도다.
"""
import json, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'harness'))
from gate import piece_hash, VERD_PATH

TABLE = [
    ('wall_gungho', 'pass', '정면 벽. 붉은 틀 격자 창호 + 위 단청 창방 + 돌 걸레받이. 후보 B wall_changho 와 같은 구성에 붉은 칠·단청만 다르다'),
    ('wall_gung', 'pass', '정면 벽. 회벽 + 붉은 중방 + 단청 창방 + 돌 걸레받이, 끝 변형은 붉은 기둥. 후보 B wall_hoe 보다 단청 띠가 있어 궁 전용으로 구분된다'),
    ('door_gung_open', 'note', '열린 쌍문 한 짝. 안쪽 어두운 체크 면이 넓어 깊이 단서가 약하다(후보 B door_open 과 같은 한계). 회랑 가운데 한 곳에만 썼다'),
    ('door_gung', 'pass', '창호 쌍문 한 짝(l/r 두 칸이 한 쌍). 붉은 틀·빗살·놋쇠 손잡이·단청 윗창방·돌 문턱, 후보 B door_slide 와 같은 크기·구성'),
    ('pillar_dan_2', 'pass', '단청 기둥 2칸. 붉은 둥근 몸 + 머리초 띠 + 넓은 두공(주두·창방 단청 띠 3줄) + 돌 초석. 후보 B pillar_red 와 같은 굵기(8px)·왼쪽 위 빛. 머리가 넓어져 보를 얹은 것처럼 읽힌다'),
    ('pillar_dan_3', 'pass', '단청 기둥 3칸(정전·회랑). 2칸과 같은 문법 + 넓은 두공(기둥 폭보다 넓은 단청 띠), 세 변형(a 청녹 마름모·b 적청 줄·c 녹적 점)이 줄지을 때 같은 무늬가 반복되지 않는다. 바닥에 누운 보 대신 이 두공이 보 노릇을 한다'),
    ('beam_dan', 'note', '단청 들보 한 칸(l/m/r). 8px 정면 띠라 윗면이 보이지 않고 막대로 읽힌다 — 방 바닥 줄에 놓으면 누운 띠로 읽혀(2026-10 검수) 더는 어느 방에도 쓰지 않는다(점검 P6 이 막는다). 키트에는 번호 안정을 위해 남긴다'),
    ('dais_top', 'pass', '단 윗면 한 칸(마루 널, l/m/r × 뒷줄 그늘/일반). 바닥보다 밝은 마루로 한 단 올라 보이고 끝 칸은 가장자리 윤곽'),
    ('dais_face', 'pass', '단 앞면 한 칸(l/m/r). 윗 돌띠 + 들어간 판 문양 + 밑 접지 그림자. 후보 B dais_stone 보다 판 문양이 있어 장대석 단으로 읽힌다'),
    ('dais_stair', 'pass', '단 앞 돌계단 3칸 폭. 카펫 없이 돌만: 디딤 윗면(밝은 줄)과 챌판(어두운 줄)이 번갈아 세 단 + 양끝 소맷돌. 카펫은 계단 아래 칸에서 멈춘다. 후보 B stair_dais 와 같은 돌 문법'),
    ('mat_carpet', 'pass', '어도 카펫(l/m/r × 연꽃 줄/마름모 줄/아래 술 끝). 바닥에 붙은 윗면, 붉은 바탕·금 테두리, v5 runner 와 같은 문법(더 밝고 얼룩을 줄임)'),
    ('mat_runb', 'pass', '회랑 푸른 마루깔개 1×2(l/m/r). 남색 바탕 + 은빛 줄 두 가닥 + 가운데 연속 마름모, 붉은 깔개와 다른 색·다른 무늬'),
    ('mat_run', 'pass', '회랑 마루깔개 1×2(l/m/r). 붉은 바탕 + 금 줄 두 가닥 + 가운데 마름모, 앞 두께 2px'),
    ('step_stone', 'pass', '협문·방문 앞 디딤돌 2×1. 밝은 화강암 한 장 윗면 + 앞 두께 + 접지 그림자. 문턱 노릇(걸을 수 있다). 후보 B stair_dais 보다 낮은 한 단'),
    ('mat_gung', 'pass', '문 앞 깔개 2×1(붉은·청). 바닥에 붙은 윗면, 금 테두리 + 꽃무늬'),
    ('mat_sinha', 'pass', '신하 깔개 2×1(청록 b1~3 문신·붉은 r1~3 무신). 돗자리 + 방석 + 홀, 무늬·방석 위치가 다르다. 바닥에 붙은 윗면'),
    ('nangan', 'note', '붉은 난간 한 칸(m/l/r). 윗 난간대 윗면 3px 와 동자기둥·석단이 읽히나 동자기둥이 2px 로 가늘다. 맞는 기준 기물이 v5 에 없어 후보 B bench 와만 견줬다'),
    ('ilwol_byeongpung', 'pass', '일월오봉도 병풍 7×3. 붉은 칠 틀 윗면 + 청 바탕·해·달·다섯 봉우리·물결·양끝 소나무. 후보 B byeongpung_royal 의 큰 판, 정면 병풍이라 윗면은 틀 위 3px'),
    ('yongsang', 'pass', '용상 3×3. 단청 닫집(윗면 처마 + 단청 띠) + 높은 붉은 등받이 + 큰 금빛 세로 용(굽이친 몸통·뿔·눈·여의주) + 팔걸이(윗면) + 방석 윗면 + 족좌. 의자로 읽히고 v5 throne 보다 훨씬 웅장하다'),
    ('hyangro_a', 'pass', '대형 향로(돌 몸통 + 놋쇠 뚜껑과 꼭지 + 연기). 세 발·두 귀, 윗면 타원이 보이고 후보 B hwaro 보다 크다'),
    ('hyangro_b', 'pass', '대형 향로(놋쇠 몸통 + 열린 화구에 불씨 + 연기 두 줄기). 윗면 타원 속 불씨가 보이는 것이 a 와 다르다'),
    ('buk_big', 'pass', '큰 북 2×3. 나무 틀 윗가로대 윗면 + 붉은 테·금 못·삼태극 가죽 면. 정면 소품(가죽 면이 앞을 본다) — 틀 윗면과 북 윗 두께로 3/4'),
    ('jong_geori', 'pass', '종 걸이 3×3. 단청 가로대 윗면 + 놋쇠 범종(어깨·유두·허리 띠·입술) + 당목 + 마루 받침. 종 윤곽은 단 진 것이 아직 있으나 종으로 읽힌다'),
    ('deungnong_', 'pass', '서 있는 등롱 1×2(a 붉은·b 청 띠). 나무 기둥 + 십자 받침 + 종이 등. 후보 B deungjan_stand 보다 크다'),
    ('hang_deungnong', 'pass', '벽에 거는 등롱 1×1(a·b). 쇠 팔 + 등 + 술. 방 안에서 벽면 윗줄에 걸려 읽힌다(그리는 순서를 벽면 위로 맞춤)'),
    ('deumeu_', 'pass', '드므 2×2(a 맑은 물·b 낙엽). 돌 받침 + 청동 독 윗면 타원 속 물. 후보 B 에 대응 기물 없음'),
    ('byeongpung_gung', 'pass', '궁중 병풍 4폭 두 가지. 붉은 칠 틀·금 안테두리, 폭이 윗선에서 지그재그로 어긋난다. 기본은 모란, 2는 청 산·소나무·물결 산수(침전 마루·회랑에서 다른 그림이 되게). 후보 B byeongpung_b 의 궁중판'),
    ('chimgu', 'pass', '침구 2×2. 바닥에 놓인 청 비단 요 + 붉은 금박 이불 + 원앙 베개 둘, 윗면이 크고 앞 두께 3px'),
    ('seoan', 'pass', '궁중 서안 2×1 두 가지. 기본(붉은 옻칠 윗면 5px + 앞 판 + 다리, 두루마리·붓통·벼루)과 b(감나무빛, 책 더미·펼친 장부·붓통 — 서리용). 둘 다 윗면 + 앞 판 + 다리'),
    ('hwaro', 'note', '궁중 청동 화로 1×1. 세 발 + 놋쇠 몸통 + 윗면 타원 속 불씨. 작은 크기라 바구니처럼도 보인다. 후보 B hwaro(쇠)보다 놋쇠·금 띠'),
    ('chotdae_big', 'pass', '큰 촛대 1×2. 세 발 받침 + 놋쇠 기둥 마디 + 위 접시 + 굵은 붉은 초 + 불꽃. v5 candelabra 보다 단순하다'),
    ('yong_jang', 'pass', '용 문양 대형 장 2×3. 검붉은 칠 두 짝 문에 마주 오르는 금빛 용(S 곡선 + 뿔·눈·수염 있는 머리) + 놋쇠 경첩 + 윗면 4px 처마 + 받침 다리. 후보 B ibuljang 보다 크고 용이 또렷하다'),
    ('bangseok_o', 'pass', '둥근 방석 1×1(a 붉은·b 청·c 녹). 윗면 타원 + 금 테두리 + 점 무늬, 네모 방석과 다른 모양'),
    ('bangseok_', 'pass', '비단 방석 1×1(a 붉은·b 청·c 녹). 윗면 + 금 테두리 + 금 단추 + 귀 술, 후보 B banseok 의 비단판'),
    ('hang_jokja', 'pass', '벽에 거는 궁중 족자 1×2(a 산수·b 글씨). 위·아래 축 + 붉은 천 두름 + 그림. 벽면 두 줄을 채운다'),
]


def lookup(short):
    for pfx, st, line in TABLE:
        if short.startswith(pfx):
            return st, line
    return None


if __name__ == '__main__':
    import pal_demo
    terr, objs = pal_demo.sheet_objects()
    objs = {k: v for k, v in objs.items() if k.startswith('pal_')}
    try:
        v = json.load(open(VERD_PATH))
    except FileNotFoundError:
        v = {}
    miss = []
    cnt = {'pass': 0, 'note': 0}
    for n, cv in objs.items():
        r = lookup(n[4:])
        if r is None:
            miss.append(n)
            continue
        st, line = r
        v[n] = {'hash': piece_hash(cv), 'status': st, 'line': line, 'reviewer': 'claude', 'user': 'pending', 'date': time.strftime('%Y-%m-%d')}
        cnt[st] += 1
    if miss:
        print('표에 없는 조각:', miss)
        sys.exit(1)
    json.dump(v, open(VERD_PATH, 'w'), ensure_ascii=False, indent=1)
    print('판정', len(objs), cnt)
