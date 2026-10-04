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
    import in_extra as _X                      # 보강 기물(일월오봉도 병풍·호피·보료·서안·소쿠리 …), 이름은 위와 겹치지 않는다
    for k, v in _X.objects().items():
        d.setdefault(k, v)
    return d
