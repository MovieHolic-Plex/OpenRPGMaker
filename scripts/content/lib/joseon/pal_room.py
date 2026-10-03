"""조선 궁 내부 평면 → 지도 유도 (후보 B 의 inb_room.Plan 을 그대로 잇고 바닥·벽 문자만 궁 용으로 넓힌다).

평면 문자(막힘 '#'·출입구 'D' 는 후보 B 와 같다):
  j 전돌 바닥 + 궁 회벽 · J 전돌 + 궁 창호벽 · g 마루 + 궁 회벽 · G 마루 + 궁 창호벽 · q 온돌 + 궁 회벽 · Q 온돌 + 궁 창호벽 · D 출입구
규칙은 inb_room.py 와 같다: 막힌 칸 바로 아래 두 줄 = 벽면(못 걸음), 방에 닿은 막힌 칸 = 단청 천장 띠, 나머지는 어둠, 남북 통로는 3줄.
"""
import inb_room as RM

PCH = {'j': ('jeon', 'gung'), 'J': ('jeon', 'gungho'), 'g': ('maru', 'gung'), 'G': ('maru', 'gungho'),
       'q': ('ondol', 'gung'), 'Q': ('ondol', 'gungho'), 'D': ('jeon', 'gung')}
FLOOR_CHARS = set(PCH)


class PPlan(RM.Plan):
    def is_floor(s, x, y):
        return s.ch(x, y) in FLOOR_CHARS

    def floor_kind(s, x, y):
        return PCH[s.ch(x, y)][0]

    def wall_kind(s, x, y):
        return PCH[s.ch(x, y)][1]


# 구조 점검·도달 BFS 는 후보 B 함수를 그대로 쓴다(Plan 인터페이스만 보므로 궁 평면에도 맞는다)
lint_structure = RM.lint_structure
bfs = RM.bfs
faces = RM.faces
