"""Atomic JSON writes — the cure for the 2026-07-10 truncation incident.

Two sessions writing cross-reference.json concurrently interleaved into a
torn file. json.dump straight onto the target means any interruption or
concurrent writer leaves corruption. Writing to a temp file in the same
directory and os.replace()-ing guarantees readers (and the other session)
only ever see a complete file. Last-writer-wins remains — that's a
coordination question — but torn files are impossible.

Usage:
    from lib.atomic_json import dump_atomic
    dump_atomic(data, path, indent=1)
"""

import json
import os
import tempfile


def dump_atomic(data, path, **json_kwargs):
    path = os.fspath(path)
    d = os.path.dirname(path) or "."
    json_kwargs.setdefault("ensure_ascii", False)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".atomic-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, **json_kwargs)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
