#!/usr/bin/env python3
"""Output stage: chunk files, manifest.json, source-index.md (## TOC), marker, cleanup.

Independent sibling of mp_extract — it depends on mp_chunk (split_text), mp_safety
(slugify), and mp_config (the tool marker identity + ExtractedDocument), never on
mp_extract. Owns the ## TOC + Headings breadcrumb writer and the marker-gated
output-dir / cleanup guards.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import uuid
from pathlib import Path

from mp_config import (
    ExtractedDocument,
    TOOL_MARKER_FILE,
    TOOL_MARKER_NAME,
    TOOL_MARKER_VERSION,
)
from mp_chunk import split_text
from mp_safety import slugify


def _format_breadcrumb(entries: list[dict]) -> str:
    parts = []
    for entry in entries:
        title = entry["title"]
        if entry.get("cont"):
            title = f"{title} (cont. {entry['cont']})"
        parts.append(title)
    return " > ".join(parts)


def write_chunks(docs: list[ExtractedDocument], out_dir: Path, chunk_chars: int) -> dict:
    chunks_dir = out_dir / "chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "tool": TOOL_MARKER_NAME,
        "tool_version": TOOL_MARKER_VERSION,
        "marker_file": TOOL_MARKER_FILE,
        "chunk_chars": chunk_chars,
        "documents": [],
        "chunks": [],
        "toc": [],
    }

    chunk_index = 1
    for doc in docs:
        doc_hash = hashlib.sha256(doc.text.encode("utf-8", errors="ignore")).hexdigest()[:12]
        # heading_map is per-document — its chunk indices are local to this doc, so the
        # ## TOC and breadcrumbs never collapse identical headings from different books.
        doc_chunks, heading_map = split_text(doc.text, chunk_chars, doc.has_headings)
        doc_record = {
            "source": doc.source,
            "title": doc.title,
            "kind": doc.kind,
            "characters": len(doc.text),
            "sha256_12": doc_hash,
            "chunk_count": len(doc_chunks),
        }
        manifest["documents"].append(doc_record)

        headings_by_local_chunk: dict[int, list[dict]] = {}
        for entry in heading_map:
            headings_by_local_chunk.setdefault(entry["chunk"], []).append(entry)

        local_chunk_files: dict[int, str] = {}
        for local_index, chunk in enumerate(doc_chunks, start=1):
            slug = slugify(Path(doc.title).stem or f"source-{chunk_index}")
            filename = f"{chunk_index:04d}-{slug}.md"
            chunk_path = chunks_dir / filename
            # Forward slashes so source-index.md (## TOC + Chunks table) stays portable
            # regardless of the OS the helper runs on.
            relative = chunk_path.relative_to(out_dir).as_posix()
            local_chunk_files[local_index] = relative

            header = [
                f"# Chunk {chunk_index:04d}",
                "",
                f"Source: {doc.source}",
                f"Document chunk: {local_index}/{len(doc_chunks)}",
                f"Characters: {len(chunk)}",
            ]
            breadcrumb = _format_breadcrumb(headings_by_local_chunk.get(local_index, []))
            if breadcrumb:
                header.append(f"Headings: {breadcrumb}")
            header.extend(["", "---", "", chunk, ""])
            chunk_path.write_text("\n".join(header), encoding="utf-8")

            manifest["chunks"].append(
                {
                    "file": relative,
                    "source": doc.source,
                    "document_chunk": local_index,
                    "characters": len(chunk),
                }
            )
            chunk_index += 1

        # Per-document TOC block (resolved to chunk filenames). Skipped for sources
        # without headings (greedy fallback returns an empty heading_map).
        if heading_map:
            manifest["toc"].append(
                {
                    "document": doc.title or doc.source,
                    "source": doc.source,
                    "entries": [
                        {
                            "level": entry["level"],
                            "title": entry["title"],
                            "cont": entry["cont"],
                            "file": local_chunk_files.get(entry["chunk"], ""),
                        }
                        for entry in heading_map
                    ],
                }
            )

    return manifest


def write_index(out_dir: Path, manifest: dict) -> None:
    lines = [
        "# Source Index",
        "",
        "Read this file first, then open only the chunks needed for the target rule.",
        "",
        "## Documents",
        "",
        "| Source | Kind | Characters | Chunks |",
        "|--------|------|------------|--------|",
    ]

    for doc in manifest["documents"]:
        lines.append(
            f"| {doc['source']} | {doc['kind']} | {doc['characters']} | {doc['chunk_count']} |"
        )

    # ## TOC — heading → chunk file(s), grouped per document so identical headings from
    # different books never collapse. Present only for structure-aware sources (FB2 /
    # EPUB / markdown); omitted entirely for the greedy fallback so the table stays clean.
    toc = manifest.get("toc", [])
    if toc:
        lines.extend(["", "## TOC", ""])
        for block in toc:
            lines.append(f"### {block['document']}")
            lines.append("")
            for entry in block["entries"]:
                indent = "  " * (entry["level"] - 1)
                title = entry["title"]
                if entry.get("cont"):
                    title = f"{title} (cont. {entry['cont']})"
                lines.append(f"{indent}- {title} → `{entry['file']}`")
            lines.append("")

    lines.extend(["", "## Chunks", "", "| File | Source | Characters |", "|------|--------|------------|"])
    for chunk in manifest["chunks"]:
        lines.append(f"| {chunk['file']} | {chunk['source']} | {chunk['characters']} |")

    (out_dir / "source-index.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def marker_path(out_dir: Path) -> Path:
    return out_dir / TOOL_MARKER_FILE


def has_valid_marker(out_dir: Path) -> bool:
    try:
        marker = json.loads(marker_path(out_dir).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    return marker.get("tool") == TOOL_MARKER_NAME and marker.get("version") == TOOL_MARKER_VERSION


def write_marker(out_dir: Path) -> None:
    marker_path(out_dir).write_text(
        json.dumps(
            {
                "tool": TOOL_MARKER_NAME,
                "version": TOOL_MARKER_VERSION,
                "run_id": str(uuid.uuid4()),
                "ownership": "This directory is generated working output and may be removed by material-prep.py --cleanup.",
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def prepare_output_dir(out_dir: Path) -> None:
    if out_dir.exists():
        if not out_dir.is_dir():
            raise RuntimeError(f"Output path exists and is not a directory: {out_dir}")

        has_entries = any(out_dir.iterdir())
        if has_entries and not has_valid_marker(out_dir):
            raise RuntimeError(
                f"Refusing to write into non-empty output directory without {TOOL_MARKER_FILE}: {out_dir}"
            )

        if has_valid_marker(out_dir):
            shutil.rmtree(out_dir)

    out_dir.mkdir(parents=True, exist_ok=True)
    write_marker(out_dir)


def cleanup_output(path_value: str) -> int:
    target = Path(path_value).expanduser().resolve()
    if not target.exists():
        print(f"Already removed: {target}")
        return 0

    if not target.is_dir():
        raise RuntimeError(f"Cleanup target is not a directory: {target}")

    if not has_valid_marker(target):
        raise RuntimeError(f"Refusing cleanup because {TOOL_MARKER_FILE} is missing or invalid: {target}")

    shutil.rmtree(target)
    print(f"Removed: {target}")
    return 0
