#!/usr/bin/env python3
"""Chunking: structure-blind greedy packing + heading-aware section packing.

Sits beside mp_books one layer above mp_safety (it only needs the generic
`_has_markdown_heading` probe). Owns the `_MD_HEADING_LINE_RE` module regex and
returns (chunks, heading_map) so mp_output can build the ## TOC + breadcrumbs.
"""

from __future__ import annotations

import re

from mp_safety import _has_markdown_heading


_MD_HEADING_LINE_RE = re.compile(r"^(#{1,3}) +(\S.*?)\s*$")


def _greedy_pack(text: str, chunk_chars: int) -> list[str]:
    """Structure-blind blank-line greedy packer (the pre-heading behavior).

    Used as the fallback for sources without guaranteed headings (PDF, HTML,
    plain text, code) so nothing regresses.
    """
    paragraphs = re.split(r"\n\s*\n", text)
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        piece_len = len(paragraph) + 2
        if current and current_len + piece_len > chunk_chars:
            chunks.append("\n\n".join(current).strip())
            current = []
            current_len = 0
        if piece_len > chunk_chars:
            for start in range(0, len(paragraph), chunk_chars):
                chunks.append(paragraph[start : start + chunk_chars].strip())
            continue
        current.append(paragraph)
        current_len += piece_len

    if current:
        chunks.append("\n\n".join(current).strip())

    return [chunk for chunk in chunks if chunk]


def _split_into_sections(text: str) -> list[tuple[tuple[int, str] | None, str]]:
    """Split markdown into (heading, body) sections at #/##/### boundaries.

    A leading (None, body) section captures any preamble before the first
    heading. heading is a (level, title) tuple.
    """
    sections: list[tuple[tuple[int, str] | None, str]] = []
    cur_heading: tuple[int, str] | None = None
    cur_lines: list[str] = []

    def emit() -> None:
        body = "\n".join(cur_lines).strip()
        if cur_heading is not None or body:
            sections.append((cur_heading, body))

    for line in text.split("\n"):
        match = _MD_HEADING_LINE_RE.match(line)
        if match:
            emit()
            cur_heading = (len(match.group(1)), match.group(2).strip())
            cur_lines = []
        else:
            cur_lines.append(line)
    emit()
    return sections


def _emit_large_section(
    heading: tuple[int, str] | None,
    body: str,
    chunk_chars: int,
    chunks: list[str],
    heading_map: list[dict],
) -> None:
    """Split a single oversized section across several chunks, tagging
    continuations with `(cont. k/n)` and keeping the heading on each."""
    head_line = f"{'#' * heading[0]} {heading[1]}" if heading else ""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    pieces: list[str] = []
    for paragraph in paragraphs:
        if len(paragraph) > chunk_chars:
            for start in range(0, len(paragraph), chunk_chars):
                pieces.append(paragraph[start : start + chunk_chars].strip())
        else:
            pieces.append(paragraph)

    sub_chunks: list[str] = []
    current: list[str] = []
    current_len = 0
    for piece in pieces:
        piece_len = len(piece) + 2
        if current and current_len + piece_len > chunk_chars:
            sub_chunks.append("\n\n".join(current).strip())
            current = []
            current_len = 0
        current.append(piece)
        current_len += piece_len
    if current:
        sub_chunks.append("\n\n".join(current).strip())
    if not sub_chunks:
        sub_chunks = [""]

    total = len(sub_chunks)
    for index, sub in enumerate(sub_chunks, start=1):
        if index == 1:
            top = head_line
        elif head_line:
            top = f"{head_line} (cont. {index}/{total})"
        else:
            top = f"(cont. {index}/{total})"
        chunk_text = (top + ("\n\n" if top and sub else "") + sub).strip()
        chunks.append(chunk_text)
        if heading:
            heading_map.append(
                {
                    "level": heading[0],
                    "title": heading[1],
                    "chunk": len(chunks),
                    # The first sub-chunk is the section head, not a continuation.
                    "cont": None if total == 1 or index == 1 else f"{index}/{total}",
                }
            )


def _pack_sections(
    sections: list[tuple[tuple[int, str] | None, str]], chunk_chars: int
) -> tuple[list[str], list[dict]]:
    """Heading-aware greedy packer. A heading is never orphaned (it always
    travels with its body); small sections group up to chunk_chars; oversized
    ones are split with `(cont. k/n)` markers. Builds a heading→chunk map."""
    chunks: list[str] = []
    heading_map: list[dict] = []
    cur_parts: list[str] = []
    cur_len = 0

    def flush() -> None:
        nonlocal cur_parts, cur_len
        if cur_parts:
            chunks.append("\n\n".join(cur_parts).strip())
            cur_parts = []
            cur_len = 0

    for heading, body in sections:
        head_line = f"{'#' * heading[0]} {heading[1]}" if heading else ""
        seg = (head_line + ("\n\n" if head_line and body else "") + body).strip()
        if not seg:
            continue
        seg_len = len(seg) + 2
        if seg_len <= chunk_chars:
            if cur_parts and cur_len + seg_len > chunk_chars:
                flush()
            cur_parts.append(seg)
            cur_len += seg_len
            if heading:
                heading_map.append(
                    {
                        "level": heading[0],
                        "title": heading[1],
                        "chunk": len(chunks) + 1,  # the chunk this buffer will become
                        "cont": None,
                    }
                )
        else:
            flush()
            _emit_large_section(heading, body, chunk_chars, chunks, heading_map)

    flush()
    return chunks, heading_map


def split_text(
    text: str, chunk_chars: int, has_headings: bool = False
) -> tuple[list[str], list[dict]]:
    """Chunk `text`, returning (chunks, heading_map).

    heading_map maps each markdown heading to the 1-based chunk index it appears
    in: a list of {"level", "title", "chunk", "cont"} dicts. It is empty for
    structure-blind sources (has_headings=False or no headings present), which
    fall back to the legacy greedy packer so nothing regresses.
    """
    if not has_headings or not _has_markdown_heading(text):
        return _greedy_pack(text, chunk_chars), []
    return _pack_sections(_split_into_sections(text), chunk_chars)
