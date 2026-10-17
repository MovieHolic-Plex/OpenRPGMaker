"""object-gate 에 낼 종류(kind) — 조각 id → 관문 종류. 없으면 조각 등록 kind 를 그대로 쓴다.
판정 기준은 src/harnesses/_core/objectGate/rules.ts OBJECT_GATE_KINDS."""
GATE_KIND = {
    # 건물·지형 덧그림
    'pier-struts-w': 'terrain', 'pier-struts-c': 'terrain', 'pier-struts-e': 'terrain',
    'bridge-h-w': 'terrain', 'bridge-h-e': 'terrain', 'bridge-v-n': 'terrain', 'bridge-v-s': 'terrain',
    # 소품
    'crystal-pylon': 'figure', 'well': 'container', 'fence-h': 'frame', 'fence-v': 'frame', 'fence-w': 'frame', 'fence-e': 'frame',
    'lamppost': 'column', 'banner': 'column', 'signpost': 'column', 'bench': 'seat', 'barrel': 'round_body',
    'crate': 'box', 'crates': 'box', 'haybale': 'round_body', 'cart': 'other', 'bollard': 'round_body',
    'windsock': 'column', 'chain-hang': 'other', 'statue': 'figure', 'stele': 'column', 'birdbath': 'container',
    'beehive': 'box', 'flowerpot': 'container', 'pond': 'terrain', 'stall': 'structure',
    'flowers-a': 'organic', 'flowers-b': 'organic', 'tallgrass': 'organic', 'plant': 'organic',
    # 실내
    'wall-plaster': 'terrain', 'wall-plaster-low': 'terrain', 'wall-stone': 'terrain', 'wall-stone-low': 'terrain',
    'wall-wood': 'terrain', 'wall-wood-low': 'terrain', 'wall-star': 'terrain', 'wall-star-low': 'terrain',
    'wall-plaster-win': 'terrain', 'wall-plaster-low-win': 'terrain', 'wall-wood-port': 'terrain', 'wall-stone-arch': 'terrain', 'wall-star-sky': 'terrain',
    'void': 'terrain', 'void-w': 'terrain', 'void-e': 'terrain', 'void-s': 'terrain', 'void-sw': 'terrain', 'void-se': 'terrain',
    'floor-wood': 'terrain', 'floor-stone': 'terrain', 'floor-deck': 'terrain', 'floor-mosaic': 'terrain',
    'bed': 'low_furniture', 'table': 'low_furniture', 'table-round': 'low_furniture', 'chair': 'seat', 'stool': 'seat',
    'cupboard': 'tall_furniture', 'bookshelf': 'tall_furniture', 'wardrobe': 'tall_furniture', 'clock': 'tall_furniture', 'hearth': 'tall_furniture',
    'altar': 'box', 'offering': 'box', 'lantern-floor': 'column', 'incense': 'container', 'helm': 'other', 'chart-table': 'low_furniture',
    'hammock': 'low_furniture', 'chest': 'box', 'telescope': 'other', 'orrery': 'figure', 'globe': 'figure', 'desk': 'low_furniture',
    'ladder': 'wall_mounted', 'lamp': 'column', 'counter': 'low_furniture', 'basin': 'low_furniture',
}
