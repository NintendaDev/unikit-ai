#!/usr/bin/env python3
"""Source acquisition + extraction: PDF/HTML/text/book routing, URL download, folder walk.

Top of the extract layer. Depends on mp_books (the FB2/EPUB extractors), mp_safety
(path predicates, text helpers), and mp_config (extension sets, ExtractedDocument).
It is an independent sibling of mp_output — neither imports the other.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Iterable

from mp_config import (
    ExtractedDocument,
    PDF_EXTENSIONS,
    REJECTED_BOOK_EXTENSIONS,
    SKIP_DIRS,
    TEXT_EXTENSIONS,
)
from mp_books import _book_kind, extract_epub, extract_fb2
from mp_safety import (
    has_hidden_part,
    has_sensitive_part,
    html_to_text,
    is_hidden_name,
    is_sensitive_dir_name,
    is_sensitive_file_name,
    normalize_text,
    read_text_file,
    validate_explicit_source_path,
)


def extract_pdf_with_python(path: Path) -> str | None:
    try:
        from pypdf import PdfReader  # type: ignore

        reader = PdfReader(str(path))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        pass

    try:
        from PyPDF2 import PdfReader  # type: ignore

        reader = PdfReader(str(path))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        pass

    try:
        from pdfminer.high_level import extract_text  # type: ignore

        return extract_text(str(path))
    except Exception:
        return None


def extract_pdf(path: Path) -> str:
    text = extract_pdf_with_python(path)
    if text and text.strip():
        return text

    # Reached when the Python extractors are unavailable OR present but produced no
    # usable text — both fall through to pdftotext, which silently drops non-Latin
    # (Cyrillic) glyphs. Make that degradation loud instead of silent.
    print(
        f"WARN: Python PDF extractors unavailable or produced no text for {path}; "
        f"falling back to pdftotext — non-Latin (e.g. Cyrillic) text may be dropped. "
        f"For robust extraction install a Python PDF library: pip install pypdf",
        file=sys.stderr,
    )

    pdftotext = shutil.which("pdftotext")
    if pdftotext:
        result = subprocess.run(
            [pdftotext, "-layout", str(path), "-"],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout

    raise RuntimeError(
        f"Could not extract PDF text from {path}. Install pypdf, PyPDF2, pdfminer.six, or pdftotext."
    )


def convert_github_blob_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    if parsed.netloc != "github.com":
        return url

    parts = parsed.path.strip("/").split("/")
    if len(parts) >= 5 and parts[2] == "blob":
        owner, repo, _, branch = parts[:4]
        rest = "/".join(parts[4:])
        raw_path = "/".join([owner, repo, branch, rest])
        return urllib.parse.urlunparse(("https", "raw.githubusercontent.com", raw_path, "", "", ""))

    return url


def download_url(url: str, work_dir: Path) -> Path:
    download_url_value = convert_github_blob_url(url)
    parsed = urllib.parse.urlparse(download_url_value)
    basename = Path(urllib.parse.unquote(parsed.path)).name or "downloaded-source"
    if "." not in basename:
        basename += ".html"
    target = work_dir / basename

    request = urllib.request.Request(
        download_url_value,
        headers={"User-Agent": "unikit-memory/1.0"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        target.write_bytes(response.read())
    return target


def is_allowed_folder_file(path: Path, root: Path) -> bool:
    try:
        visible_relative = path.relative_to(root)
    except ValueError:
        return False

    if has_hidden_part(visible_relative):
        return False
    if has_sensitive_part(visible_relative):
        return False
    if path.is_symlink():
        # Symlinks are never followed in this port (no opt-in flag).
        return False

    return True


def iter_folder_files(root: Path) -> Iterable[Path]:
    for current_root, dirs, files in os.walk(root):
        kept_dirs = []
        for dirname in sorted(dirs):
            dir_path = Path(current_root) / dirname
            if dir_path.is_symlink():
                continue
            if dirname in SKIP_DIRS:
                continue
            if is_hidden_name(dirname):
                continue
            if is_sensitive_dir_name(dirname):
                continue
            kept_dirs.append(dirname)
        dirs[:] = kept_dirs

        for filename in sorted(files):
            if is_hidden_name(filename):
                continue
            if is_sensitive_file_name(filename):
                continue
            path = Path(current_root) / filename
            if path.suffix.lower() in REJECTED_BOOK_EXTENSIONS:
                # Recognized-but-rejected inside a folder. Warn by name HERE (this is the
                # single warning channel for the folder case) and do NOT iterate it — that
                # keeps it from reaching extract_path's reject branch, whose RuntimeError
                # would surface a second warning via extract_source's catch.
                print(
                    f"warning: skipping {path} — MOBI/Kindle format is not supported; "
                    f"provide an EPUB export instead (coverage gap for this file)",
                    file=sys.stderr,
                )
                continue
            is_book = _book_kind(path) is not None
            allowed = is_book or path.suffix.lower() in TEXT_EXTENSIONS | PDF_EXTENSIONS
            if allowed and is_allowed_folder_file(path, root):
                yield path


def extract_path(path: Path, label: str | None = None) -> ExtractedDocument:
    suffix = path.suffix.lower()
    title = label or path.name

    # Book formats first — they own the structure-aware (heading-guaranteed) path and
    # must win over the generic text/zip routing (e.g. `.fb2.zip` whose suffix is `.zip`).
    book_kind = _book_kind(path)
    if book_kind == "fb2":
        return extract_fb2(path)
    if book_kind == "epub":
        return extract_epub(path)
    if suffix in REJECTED_BOOK_EXTENSIONS:
        raise RuntimeError(
            f"Cannot process MOBI/Kindle format ({suffix}) — it is a binary/proprietary "
            f"container this helper does not read. Provide an EPUB export instead: {path}"
        )

    if suffix in PDF_EXTENSIONS:
        text = extract_pdf(path)
        kind = "pdf"
        has_headings = False
    elif suffix in {".html", ".htm"}:
        text = html_to_text(read_text_file(path))
        kind = "html"
        has_headings = False
    elif suffix in TEXT_EXTENSIONS:
        text = read_text_file(path)
        kind = "text"
        # Only markdown carries real headings; `# ...` in .py/.sh/.rb is a comment, so
        # those (and every other code/plain-text extension) stay structure-blind.
        has_headings = suffix == ".md"
    else:
        raise RuntimeError(f"Unsupported file type: {path}")

    return ExtractedDocument(
        source=str(path),
        title=title,
        kind=kind,
        text=normalize_text(text),
        has_headings=has_headings,
    )


def extract_source(source: str, work_dir: Path) -> list[ExtractedDocument]:
    if re.match(r"^https?://", source):
        downloaded = download_url(source, work_dir)
        doc = extract_path(downloaded, label=source)
        doc.source = source
        return [doc]

    path = Path(source).expanduser().resolve()
    validate_explicit_source_path(path)

    if path.is_dir():
        docs = []
        for file_path in iter_folder_files(path):
            try:
                docs.append(extract_path(file_path))
            except RuntimeError as exc:
                print(f"warning: {exc}", file=sys.stderr)
        return docs

    if path.is_file():
        return [extract_path(path)]

    raise RuntimeError(f"Source not found: {source}")
