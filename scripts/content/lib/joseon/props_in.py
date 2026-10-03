"""조선 실내 기물 모음(`in_` 접두): A 살림집 · B 일터(대장간·약방·주막·서당·관아). 구조 키트는 interior_kit.py."""
import props_in_a as _A


def terrain():
    return {}


def objects():
    d = dict(_A.objects())
    try:
        import props_in_b as _B
        d.update(_B.objects())
    except ImportError:
        pass
    return d
