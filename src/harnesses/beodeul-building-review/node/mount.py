"""Serve the beodeul review screen under /harness/beodeul inside another HTTP server (슈퍼하네싱).

The review code, receipts and decision table stay the ones in queue.py; this only strips the
prefix and lends the host handler queue.Handler's reply/js helpers for one request. Same data
dir, same signed gate files, same hash-bound decisions as the standalone `serve`. Not signed.
"""
import importlib.util
import sys
import types
from pathlib import Path
from urllib.parse import urlsplit

NODE = Path(__file__).resolve().parent
PREFIX = '/harness/beodeul'
_module = None


def module():
    global _module
    if _module is None:
        # visual_gate/native_author import each other by plain name. Appended, never inserted,
        # so queue.py here can't shadow the stdlib `queue`.
        if str(NODE) not in sys.path:
            sys.path.append(str(NODE))
        spec = importlib.util.spec_from_file_location('beodeul_review_queue', NODE / 'queue.py')
        mod = importlib.util.module_from_spec(spec)
        sys.modules['beodeul_review_queue'] = mod
        spec.loader.exec_module(mod)
        _module = mod
    return _module


def owns(path):
    return path == PREFIX or path.startswith(PREFIX + '/')


def dispatch(handler, method):
    """Run queue.Handler.do_<method> for a request whose path starts with PREFIX."""
    q = module()
    parts = urlsplit(handler.path)
    if parts.path == PREFIX:  # relative URLs in the page need the trailing slash
        handler.send_response(308)
        handler.send_header('Location', PREFIX + '/' + ('?' + parts.query if parts.query else ''))
        handler.send_header('Content-Length', '0')
        handler.end_headers()
        return
    saved = handler.path
    handler.path = parts.path[len(PREFIX):] + ('?' + parts.query if parts.query else '')
    handler.reply = types.MethodType(q.Handler.reply, handler)
    handler.js = types.MethodType(q.Handler.js, handler)
    try:
        return getattr(q.Handler, 'do_' + method)(handler)
    finally:
        handler.path = saved
        for name in ('reply', 'js'):
            handler.__dict__.pop(name, None)
