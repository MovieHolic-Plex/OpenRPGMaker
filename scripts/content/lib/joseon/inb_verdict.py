"""조선 실내 후보 B 조각 판정(눈으로 본 결과)을 verdicts.json 에 쓴다. 판정은 그 조각의 현재 픽셀 해시에 묶인다 — 그림이 바뀌면 다시 돌려야 한다.

    python3 inb_verdict.py        # 표에 없는 in_b_ 조각이 있으면 오류로 멈춘다(빠짐없이 봤다는 뜻)
본 방법: 조각마다 [내 조각 | 같은 배율의 v5 기준(inb_show.py·inb_preview.sheet)] 시트를 4배로 보고, 방에 놓은 그림(×3)에서 한 번 더 봤다.
상태: pass = v5 기물과 같은 문법(윗면 3~5px + 앞면, 안쪽 윤곽, 왼쪽 위 빛) / note = 쓸 수 있으나 아래 차이가 있다.
정면 벽 조각(wall_·win_·door_)은 윗면이 보이지 않는 정면이 맞다(벽면 규칙) — v5 벽과 같은 방식.
"""
import json, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'harness'))
import catalog
from gate import piece_hash, VERD_PATH

# (이름 접두 또는 이름, 상태, 한 줄). 위에서부터 첫 일치.
TABLE = [
    ('wall_hoe', 'note', '정면 벽(윗면 없음 = 벽면 규칙). 흰 회벽 면+갈색 틀+밑 널이라 v5 wall:plaster(황토 윗단+판자 하단)보다 밝고 단순하다. 변형 m/l/r/lr 이음은 맞는다'),
    ('wall_mok', 'note', '정면 벽. 세로 널 목재벽이라 v5 wall:log(가로 통나무)와 결이 다르다(조선 판벽). 틀·밑 널 윤곽은 맞는다'),
    ('wall_heuk', 'note', '정면 벽. 황토 면+돌 밑단. v5 wall:rubble(어두운 석벽)보다 훨씬 밝고 거칠다 — 부엌·대장간 안쪽 용도'),
    ('wall_dol', 'pass', '정면 벽. 돌 쌓기 줄눈이 v5 wall:stone 과 같은 밝기대·크기, 끝 변형 윤곽도 맞는다'),
    ('wall_changho', 'pass', '정면 벽. 격자 창호 면이 한 칸에 3×4 칸살이라 v5 window 보다 크지만 조선 마루 창호로 읽힌다'),
    ('win_', 'note', '벽 안 창 1×2. 흰 회벽/목재벽/흑벽 안에 놓이는 작은 창; v5 window(파란 유리)와 달리 불투명 한지·검은 구멍 — 같은 색 벽과만 쓴다'),
    ('door_slide', 'note', '미닫이 문 1×2(닫힘·열림 좌우). 창호 문살은 맞으나 열림 변형은 검은 틈 + 문살 반쪽이라 어두운 면적이 크다'),
    ('door_plank', 'pass', '널문 1×2. 쇠 띠·손잡이가 윤곽 안에 있고 v5 round door 보다 직사각 정면으로 읽힌다'),
    ('door_open', 'note', '열린 널문 1×2. 안쪽이 균일한 격자 어둠이라 깊이 단서가 약하다'),
    ('pillar_red', 'note', '붉은 기둥(2·3칸). v5 column(가는 금 띠 기둥)보다 굵고 붉은 칠 + 회색 초석, 왼쪽 위 빛은 맞다. 두께가 칸(16px)의 절반이라 방 안에선 커 보인다'),
    ('pillar', 'note', '나무 기둥(2·3칸). 같은 문법, 초석은 돌. v5 column wood 보다 굵다'),
    ('beam', 'note', '천장 가로보 조각 1×1(m/l/r). 단색 막대라 정보량이 적고 어느 방에도 놓지 않았다 — 실사용 시험 없음'),
    ('stair_up', 'note', '나무 계단 3칸/2칸 폭. v5 stairs up wood 와 같은 널 줄 문법이나 윗 어둠 띠가 체크무늬라 거칠다. 어느 방에도 놓지 않았다 — 통행 시험 없음(그리드 XXX/XXX/FFF)'),
    ('ladder_loft', 'note', '다락 사다리 1×3. 가는 사다리 + 윗 어둠 틈. 방에 놓지 않았다'),
    ('stair_down', 'note', '아래 계단 구멍 1×1. 어느 방에도 놓지 않았다'),
    ('stair_dais_wood', 'note', '목재 단 앞 계단(3·2칸). 윗 디딤 넓은 면 + 챌판 두 단이 계단으로 읽히나 단색 널이라 v5 stairs up wood 의 줄 정보량보다 적다. 관아·서당 단 앞에서 시험'),
    ('throne', 'note', '사또 큰 의자 2×2. 구름 머리 등받이·붉은 등판·붉은 방석·팔걸이가 읽히고 이전 1×2 교의보다 폭이 두 배. v5 throne 만큼 장식은 없다(호피 없음)'),
    ('mat_carpet', 'pass', '붉은 길 깔개 1×4. 테두리+금실 줄+마름모 무늬가 4칸에 되풀이, v5 rug red 보다 길고 좁은 길 깔개 — 바닥에 붙은 윗면'),
    ('gonjang_geori', 'note', '곤장 걸이 1×2. 기둥+가로대에 곤장 셋, 곤장 폭 1~2px 라 작은 크기에서 막대 묶음으로만 읽힌다(thin_ok 사유 있음)'),
    ('mangchi', 'note', '망치 그루터기 1×1. 그루터기 위 망치·집게. 모루와 윤곽이 달라 읽히나 망치 머리가 작아 한눈에 안 읽힌다'),
    ('yakseonban', 'pass', '약 선반 2×2. 박 약병 셋(초록·황·주황)·단지·서랍 둘이 칸마다 읽히고 v5 apothecary drawers 와 다른 호리병 선반 문법'),
    ('pyeongsang_3b', 'pass', '평상 3칸(세로 널). 널 방향·다리 모양이 기본 평상(가로 널)과 달라 같은 가구 반복을 깬다'),
    ('pyeongsang_2b', 'pass', '평상 2칸(세로 널). 3b 와 같은 널 문법'),
    ('pyeongsang_2c', 'pass', '평상 2칸(가로보 보강·곧은 다리). 기본 평상과 널 이음·다리가 다르다'),
    ('pyeongsang_3c', 'pass', '평상 3칸(가로보 보강·곧은 다리). 2c 와 같은 문법'),
    ('stair_dais', 'pass', '돌 단 앞 계단. 위 널·아래 널 두 줄, 서당·동헌에서 단 앞에 놓여 읽힌다'),
    ('dais_', 'note', '단 앞 가름(나무·돌, m/l/r/lr). 단색 정면이라 윗면 폭이 없다 — 돌은 v5 stairs up stone 과 같은 회색이지만 밋밋하다'),
    ('exit_mat', 'pass', '출구 깔개 1×1. 흰 석 문턱+나무 문지방, v5 doormat 처럼 바닥에 붙은 정면'),
    ('byeongpung', 'pass', '병풍. 접힌 패널 4폭이 윗 테두리와 아래 발로 읽히고 v5 tapestry 보다 그림 정보가 많다(화조·산수 3종 + 왕 일월오봉)'),
    ('ibuljang', 'pass', '이불장 2×2. 문 둘+쇠 장식 정면, 윗면 3px 와 윤곽이 v5 wardrobe 와 같다'),
    ('nong', 'pass', '농(1×2·2×2). 서랍+문 구성, v5 wardrobe/cupboard 와 같은 톤과 윗면'),
    ('bandaji', 'pass', '반닫이(1×1·2×1). 앞 열림 판+쇠 장식, v5 chest/sideboard 와 같은 문법'),
    ('munggap', 'pass', '문갑 2×1. 책 칸+서랍, v5 sideboard 2x1 와 같다'),
    ('soban', 'pass', '소반 1×1 셋. 둥근 상판+개다리 셋, 윗면이 보이고 그릇이 읽힌다'),
    ('sang_low', 'pass', '앉은뱅이 상 2×1. 윗면 널+앞 판+다리, v5 dining 2x1 과 같은 문법'),
    ('gyojasang', 'pass', '교자상 2·3칸. 상 위 그릇·병이 읽힌다'),
    ('hwaro', 'pass', '화로 1×1. 솥+불씨+쇠 다리, v5 brazier 보다 어둡지만 불씨 대비가 있다'),
    ('deungjan', 'pass', '등잔(탁상·서 있는 것). 가는 몸통이지만 불꽃·받침이 읽힌다'),
    ('chotdae', 'pass', '촛대 1×1. v5 candle 과 같은 크기·불꽃'),
    ('banseok', 'pass', '방석 1×1(4색). 윗면이 큰 납작 쿠션, 윤곽·빛 맞다'),
    ('mat_jip', 'pass', '짚자리 깔개(2×2·3×2). 바닥에 붙은 윗면, 결이 거칠어 걷는 바닥 장식으로 읽힌다. 가장자리 윤곽은 있으나 가로세로 규칙이 약하다'),
    ('mat_dot', 'pass', '돗자리/방석 깔개 2×2. 붉은 테두리+체크 안, v5 rug red 와 같은 문법'),
    ('mat_hopi', 'note', '호피 깔개 2×2. 호랑이 가죽 몸통·네 다리·머리가 읽히나 줄무늬가 좌우 짧은 선 반복이라 단조롭다. 방에는 쓰지 않았다'),
    ('ibul_folded', 'pass', '갠 이불 더미 1×1. 세 겹 색 띠'),
    ('ibul', 'pass', '이불 1×2(붉은·푸른). 베개+이불 윗면, v5 bed green 의 간략판'),
    ('jokja', 'pass', '족자 1×1(벽걸이). 위·아래 축+그림, v5 picture 와 같은 크기'),
    ('hang_bagaji', 'note', '벽에 건 바가지. 박 모양+걸이 끈, 크기가 칸의 절반이라 작다'),
    ('hang_tools', 'pass', '벽에 거는 연장 1×1. 자루·집게 날'),
    ('hang_', 'pass', '벽 걸이(시래기·고추·약초·메주 두름). 벽면 윗줄에 걸려 읽힌다'),
    ('pyeongsang', 'pass', '평상 2·3칸. 널 6줄 윗면+앞 테두리+다리, 크기가 커서 윗면이 충분히 보인다'),
    ('geolsang', 'note', '걸상 2×1. 판+가는 다리 둘뿐이라 v5 bench 2 보다 얇고 윗면 폭이 3px 로 좁다'),
    ('stool', 'pass', '걸상 1×1. v5 stool 과 같은 윗면+세 다리'),
    ('bumak', 'pass', '부뚜막(2·3칸). 솥 윗면+아궁이 불, v5 kitchen range 보다 흙 질감이 거칠고 불 대비가 있다'),
    ('hangari_straw', 'pass', '짚 뚜껑 항아리 1×1'),
    ('hangari', 'pass', '항아리(작은·중간). v5 pot 과 같은 문법'),
    ('dok_big', 'note', '큰 독 1×2. 몸통 폭 대비 키가 커서 v5 pot 보다 길쭉하다. 윤곽·결은 맞다'),
    ('ssal_dwiju', 'note', '쌀뒤주 1×2. 판 몸통+쇠 띠, 위가 약간 납작해 윗면 폭이 3px'),
    ('muldongi', 'pass', '물동이 1×1. v5 water jar 와 같은 톤'),
    ('sokuri', 'pass', '소쿠리(채소·곡식·과일). 윗면 담김이 보이고 v5 basket 과 같은 문법'),
    ('jangjak', 'pass', '장작 더미 1×1. v5 firewood bundle 과 같은 단면 원'),
    ('seonban', 'pass', '선반 2×2. 칸마다 그릇·병, v5 bookshelf 2w 와 같은 정면'),
    ('betul', 'pass', '베틀 3×2. 앉는 널+날실+붉은 직물, 폭 3칸에 윗 틀이 읽힌다'),
    ('mulle', 'note', '물레 1×1. 바퀴 살이 1px 라 작은 크기에서 읽힘이 약하다(thin_ok 사유 있음)'),
    ('sewing', 'pass', '반짇고리 1×1. 상자+바늘꽂이'),
    ('pungmu', 'note', '풀무 2×1. 긴 상자+손잡이 막대로 읽히나 화덕 곁이 아니면 도마로 오인된다'),
    ('moru', 'pass', '모루 1×1. v5 anvil 과 같은 쇠 톤·윗면'),
    ('sutdeomi', 'pass', '숯더미 1×1. v5 coal bin 보다 덩이만 있어 단순'),
    ('hwadeok', 'pass', '화덕 3×2. 깔때기 굴뚝+불 구멍, v5 forge 보다 낮고 넓다'),
    ('dameum', 'pass', '담금질 통 1×1. 파란 물+통 띠, v5 quench barrel 과 같다'),
    ('sutdol', 'note', '숫돌 1×1. 회색 판+받침이라 작은 상자로 읽힌다'),
    ('cheol', 'note', '쇠 더미 1×1. 덩이들의 구분이 약하다'),
    ('gongjang', 'pass', '대장간 작업대 2×1. 상판 위 망치·집게, v5 work 2x1 보다 어둡다'),
    ('yakjang', 'pass', '약장(2×3·1×2). 작은 서랍 격자+손잡이, 정면 소품'),
    ('yakdang', 'pass', '약탕관 1×1. 주전자+불 받침'),
    ('yakyeon', 'note', '약연 1×1. 둥근 절구로 읽히나 윗면 홈이 작다'),
    ('jakdu', 'pass', '작두 1×1. 날+받침 도마'),
    ('yak_table', 'pass', '약 짓는 상 2×1. 윗면에 약봉지·저울'),
    ('yakcho_basket', 'pass', '약초 광주리 1×1. 대바구니+마른 약초 더미'),
    ('suldok', 'pass', '술독 1×1. 덮개 천+국자'),
    ('sulsang', 'pass', '술상 2×1. 병·잔'),
    ('juga', 'pass', '주막 상(3·2칸). 앞 판 격자+상 위 주전자·잔'),
    ('seoan', 'pass', '서안 1×1/2×1. 낮은 책상 위 책·붓'),
    ('seoga', 'pass', '서가(2×2·1×2). 책등 줄 칸, v5 bookshelf 와 같은 문법'),
    ('boryo', 'pass', '보료 2×1. 붉은 바닥 깔개+무늬'),
    ('ansuk', 'pass', '안석 1×1. 낮은 팔걸이 베개'),
    ('hoechori', 'note', '회초리 통 1×1. 가는 가지 다발이라 작은 크기에서 덩어리로 읽힌다(thin_ok 사유 있음)'),
    ('chaekdemi', 'pass', '책 더미 1×1. 쌓은 책 세 층'),
    ('gwan_desk', 'pass', '관아 책상(3·2칸). 서랍 둘+상판 위 문서·인장, v5 desk 3x2 와 같은 문법'),
    ('gyoui', 'pass', '사또 의자 1×2. 등받이+붉은 방석, v5 chair S 보다 키가 크다'),
    ('gonjang_teul', 'note', '곤장 틀 2×2. 널+기둥으로 읽히나 결박 줄이 1px 라 틀의 쓰임이 약하다'),
    ('buk', 'pass', '북 1×2. 붉은 몸통+가죽면+받침'),
    ('mungseo_ham', 'pass', '문서 함 1×1. 상자+쇠 장식'),
]


def lookup(short):
    for pfx, st, line in TABLE:
        if short.startswith(pfx):
            return st, line
    return None


if __name__ == '__main__':
    objs = {k: v for k, v in catalog.objects().items() if k.startswith('in_b_')}
    try:
        v = json.load(open(VERD_PATH))
    except FileNotFoundError:
        v = {}
    miss = []
    cnt = {'pass': 0, 'note': 0}
    for n, cv in objs.items():
        r = lookup(n[5:])
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
