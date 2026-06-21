#!/usr/bin/env python3
"""Prepare large material for unikit-memory knowledge-base research.

The script extracts text from local files, folders, and URLs, then writes
chunked markdown files plus a manifest. It intentionally leaves the output
directory for the caller to read and remove after the rule is written.

This is the thin entrypoint: argument parsing, the run-once orchestration, and
the top-level error guard. The real work lives in the flat sibling modules it
imports — mp_config (constants + ExtractedDocument), mp_safety (path/text/XML/zip
helpers), mp_chunk (chunking), mp_books (FB2/EPUB), mp_extract (source →
documents), mp_output (chunks + manifest + index + marker). Running this file
directly puts its own directory on sys.path[0], so the flat `import mp_*` lines
resolve to the siblings without a package.
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

from mp_config import ExtractedDocument
from mp_extract import extract_source
from mp_output import cleanup_output, prepare_output_dir, write_chunks, write_index


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract and chunk material for unikit-memory knowledge-base research.")
    parser.add_argument("sources", nargs="*", help="Local file, local directory, or URL.")
    parser.add_argument("--out", help="Output directory. Defaults to a new temp directory.")
    parser.add_argument("--chunk-chars", type=int, default=18000, help="Approximate max characters per chunk.")
    parser.add_argument("--cleanup", help="Remove an extraction output directory created by this script.")
    return parser.parse_args()


def main() -> int:
    # Make our own prints survive non-ASCII (Cyrillic) on legacy Windows consoles —
    # without this, a status line carrying a Cyrillic path can raise UnicodeEncodeError.
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (ValueError, OSError):
                pass

    args = parse_args()
    if args.cleanup:
        if args.sources:
            raise RuntimeError("--cleanup cannot be combined with sources.")
        return cleanup_output(args.cleanup)

    if not args.sources:
        raise RuntimeError("At least one source is required unless --cleanup is used.")

    out_dir = Path(args.out).expanduser().resolve() if args.out else Path(tempfile.mkdtemp(prefix="unikit-memory-"))
    prepare_output_dir(out_dir)

    with tempfile.TemporaryDirectory(prefix="unikit-memory-download-") as download_dir:
        docs: list[ExtractedDocument] = []
        for source in args.sources:
            docs.extend(extract_source(source, Path(download_dir)))

    docs = [doc for doc in docs if doc.text.strip()]
    if not docs:
        raise RuntimeError("No readable text extracted from sources.")

    manifest = write_chunks(docs, out_dir, args.chunk_chars)
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_index(out_dir, manifest)

    print(f"Output: {out_dir}")
    print(f"Documents: {len(manifest['documents'])}")
    print(f"Chunks: {len(manifest['chunks'])}")
    print(f"Index: {out_dir / 'source-index.md'}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
