# 데모 방 배치 (16px 판·32px 판 공통). 칸 좌표. 안쪽 10×8칸(벽 2줄 + 바닥 6줄), 둘레는 천장 띠.
# 오두막 거실 겸 침실: 북벽에 괘종시계·책장·벽난로·옷장·침대 둘, 벽난로 앞 소파·안락의자, 서쪽 식탁, 문 옆 통·항아리.
PLAN = [
    '############',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '######.#####',
]
# (이름, x, y)  이름은 v5 kit4.OBJ id, 식탁은 'dining 2x2'
ITEMS = [
    ('clock', 1, 3), ('bookshelf 2w', 2, 3), ('fireplace', 5, 3), ('wardrobe', 7, 3),
    ('bed blue', 8, 3), ('double bed red', 9, 3),
    ('sofa', 5, 5), ('armchair', 7, 5),
    ('chair S', 2, 5), ('chair S', 3, 5), ('dining 2x2', 2, 6), ('chair N', 3, 8),
    ('water jar', 10, 7), ('barrel', 10, 8), ('barrel', 9, 8),
]
# 비교 대상 12종 (v5 id)
OBJECTS = ['double bed red', 'bed blue', 'bookshelf 2w', 'wardrobe', 'clock', 'barrel', 'water jar', 'sofa', 'armchair',
           'chair S', 'chair N', 'fireplace', 'dining 2x2']
KO = {'double bed red': '2인 침대', 'bed blue': '1인 침대', 'bookshelf 2w': '책장 2칸', 'wardrobe': '옷장', 'clock': '괘종시계',
      'barrel': '통', 'water jar': '항아리', 'sofa': '소파', 'armchair': '안락의자', 'chair S': '의자(남향)', 'chair N': '의자(북향)',
      'fireplace': '벽난로', 'dining 2x2': '식탁 2×2'}
