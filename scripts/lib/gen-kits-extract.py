#!/usr/bin/env python3
"""gen-kits:sync 의 뽑기 — 파이썬 모듈 글(stdin, JSON {path: source})에서 모듈 수준 리터럴 상수만 뽑아 JSON 으로 낸다.

- 대문자 이름(앞 _ 없음)에 리터럴(ast.literal_eval 이 되는 것)을 넣은 대입만. 함수·f-string·계산식은 뽑지 않는다(프롬프트 조립 코드는 옮기지 않는다).
- set 은 정렬한 list, tuple 은 list 로. 키는 정렬 — 같은 커밋이면 늘 같은 바이트.
"""
import ast
import json
import sys


def plain(value):
    if isinstance(value, (set, frozenset)):
        return sorted(plain(v) for v in value)
    if isinstance(value, (list, tuple)):
        return [plain(v) for v in value]
    if isinstance(value, dict):
        return {str(k): plain(v) for k, v in sorted(value.items(), key=lambda kv: str(kv[0]))}
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    return value


def constants(source: str) -> dict:
    out = {}
    for node in ast.parse(source).body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target, value = node.targets[0], node.value
        elif isinstance(node, ast.AnnAssign) and node.value is not None:
            target, value = node.target, node.value
        else:
            continue
        if not isinstance(target, ast.Name) or target.id.startswith("_") or not target.id.isupper():
            continue
        try:
            out[target.id] = plain(ast.literal_eval(value))
        except (ValueError, TypeError, SyntaxError, MemoryError, RecursionError):
            continue
    return dict(sorted(out.items()))


def main() -> None:
    sources = json.load(sys.stdin)
    result = {}
    for path, source in sorted(sources.items()):
        module = path.rsplit("/", 1)[-1].removesuffix(".py")
        result[module] = constants(source)
    json.dump(result, sys.stdout, ensure_ascii=False, sort_keys=True)


if __name__ == "__main__":
    main()
