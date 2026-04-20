# HTML Generation Guide

Instructions for converting markdown documentation into a static HTML site using "The Ledger" theme.

> **You are the converter.** Do NOT write a Node.js, Python, bash, or any other script to perform these conversions. Apply these rules directly — read markdown, produce HTML in your head, write the result with the Write tool. This is inline text transformation, not a programming task. You already have all the markdown content loaded — just transform and write each file.

## Table of Contents

1. [Overview](#overview)
2. [Conversion Process](#conversion-process)
3. [Template Placeholders](#template-placeholders)
4. [nav_links Format](#nav_links-format)
5. [prev_link / next_link Format](#prev_link--next_link-format)
6. [Markdown to HTML Conversion Rules](#markdown-to-html-conversion-rules)
7. [Auto-features](#auto-features-javascript)

---

## Overview

The HTML template (`templates/html-template.html`) uses "The Ledger" theme — warm amber/gold tones with sidebar navigation, auto-generated TOC, dark/light toggle, copy-code buttons, and reading progress bar.

File mapping: `README.md` → `index.html`, `docs/*.md` → `*.html`.

## Conversion Process

For each page, do the following:

1. Read `templates/html-template.html` once (cache in memory for all pages)
2. Read the source markdown file
3. Strip the navigation header line (first line with `[<- ...](...) . [Назад ...](...) . [Далее ->](...)`)
4. Convert markdown body to HTML (see [conversion rules](#markdown-to-html-conversion-rules))
5. Replace `.md` links with `.html` in `href` attributes (`architecture.md` → `architecture.html`, `../README.md` → `index.html`)
6. Build `{nav_links}` with `class="active"` on the current page
7. Build `{prev_link}` and `{next_link}` based on page order
8. Replace all placeholders in the template
9. Write the result to `docs-html/{filename}.html`

Use `Bash(mkdir -p docs-html)` to create the output directory. Write each page with the `Write` tool.

## Template Placeholders

| Placeholder | Content |
|-------------|---------|
| `{project_name}` | Project display name (e.g., "Pawnshop Simulator") |
| `{page_title}` | Current page title in project language (used in `<title>` and mobile header) |
| `{nav_links}` | Sidebar navigation links (see format below) |
| `{content}` | Converted HTML content from markdown |
| `{prev_link}` | Previous page link (bottom nav), empty string for first page |
| `{next_link}` | Next page link (bottom nav), empty string for last page |

## nav_links Format

Generate sidebar links with section titles. Mark the current page with `class="active"`:

```html
<div class="sidebar-section-title">Core</div>
<a href="index.html"><span class="nav-icon">&#9751;</span> Overview</a>
<a href="getting-started.html"><span class="nav-icon">&#9889;</span> Getting Started</a>
<a href="architecture.html" class="active"><span class="nav-icon">&#9878;</span> Architecture</a>
<a href="project-map.html"><span class="nav-icon">&#9776;</span> Project Map</a>
<div class="sidebar-section-title">Systems</div>
<a href="di-bindings.html"><span class="nav-icon">&#9881;</span> DI Bindings</a>
<a href="events.html"><span class="nav-icon">&#9733;</span> Events</a>
<a href="save-system.html"><span class="nav-icon">&#9850;</span> Save System</a>
<a href="game-systems.html"><span class="nav-icon">&#9654;</span> Game Systems</a>
<a href="ui-system.html"><span class="nav-icon">&#9635;</span> UI System</a>
<div class="sidebar-section-title">Tools</div>
<a href="testing.html"><span class="nav-icon">&#10004;</span> Testing</a>
<a href="editor-tools.html"><span class="nav-icon">&#9998;</span> Editor Tools</a>
<a href="build.html"><span class="nav-icon">&#9888;</span> Build</a>
<a href="localization.html"><span class="nav-icon">&#127760;</span> Localization</a>
```

**Section grouping:** Group pages into logical sections based on the Documentation table in README. Translate section titles to the project language. Example sections: "Основное" / "Системы" / "Инструменты" for Russian.

**Link labels:** Use the page title in the project language.

## prev_link / next_link Format

```html
<!-- prev_link -->
<a href="prev-page.html">
  <span class="page-nav-label">&larr; Previous</span>
  <span class="page-nav-title">Page Title</span>
</a>

<!-- next_link -->
<a href="next-page.html">
  <span class="page-nav-label">Next &rarr;</span>
  <span class="page-nav-title">Page Title</span>
</a>
```

- Translate "Previous" / "Next" to project language (e.g., "Предыдущая" / "Далее")
- First page in order: `{prev_link}` is empty string
- Last page in order: `{next_link}` is empty string
- Page order follows the Documentation table in README.md

## Markdown to HTML Conversion Rules

Convert markdown elements to their HTML equivalents. The agent performs this conversion directly — no external tools or scripts needed.

### Headings

```markdown
# Title        →  <h1>Title</h1>
## Section     →  <h2 id="section">Section</h2>
### Subsection →  <h3 id="subsection">Subsection</h3>
```

Generate `id` attributes from heading text: lowercase, replace spaces with `-`, remove special characters. This enables the auto-TOC JavaScript.

### Paragraphs

Consecutive text lines → `<p>...</p>`. Blank line separates paragraphs.

### Inline formatting

```
**bold**   → <strong>bold</strong>
*italic*   → <em>italic</em>
`code`     → <code>code</code>
[text](url) → <a href="url">text</a>
```

### Code blocks

````markdown
```csharp
code here
```
````

→

```html
<pre><code class="language-csharp">code here</code></pre>
```

The JavaScript auto-adds copy buttons and language headers. Always include `class="language-{lang}"` when the language is specified.

Escape `<`, `>`, `&` inside code blocks to HTML entities (`&lt;`, `&gt;`, `&amp;`).

### Tables

```markdown
| Header1 | Header2 |
|---------|---------|
| Cell1   | Cell2   |
```

→

```html
<table>
  <thead>
    <tr><th>Header1</th><th>Header2</th></tr>
  </thead>
  <tbody>
    <tr><td>Cell1</td><td>Cell2</td></tr>
  </tbody>
</table>
```

### Lists

```markdown
- Item 1
- Item 2
  - Nested
```

→

```html
<ul>
  <li>Item 1</li>
  <li>Item 2
    <ul><li>Nested</li></ul>
  </li>
</ul>
```

Ordered lists (`1. Item`) → `<ol><li>...</li></ol>`.

### Blockquotes

```markdown
> Quote text
```

→ `<blockquote><p>Quote text</p></blockquote>`

### Horizontal rules

`---` or `***` → `<hr>`

### Images

`![alt](src)` → `<img src="src" alt="alt">`

### Pre-formatted blocks (no language)

ASCII art or diagrams inside ``` without a language tag → `<pre><code>...</code></pre>` (no `language-` class).

## Auto-features (JavaScript)

The template's built-in JavaScript provides these features automatically — no extra work needed during generation:

- **Dark/light mode toggle** — persisted to localStorage, respects `prefers-color-scheme`
- **Reading progress bar** — thin amber bar at top of page
- **Table of Contents** — auto-generated from h2/h3 headings on right rail (hidden on screens <1400px)
- **Copy code buttons** — added to every `<pre><code>` block with language detection from `class="language-*"`
- **Back to top button** — appears on scroll
- **Mobile sidebar** — hamburger menu with overlay on screens <900px
- **Heading anchors** — hover to reveal `#` links on h2 elements

These features depend on correct HTML structure:
- Headings must have `id` attributes for TOC and anchors to work
- Code blocks must use `<pre><code class="language-*">` for language detection
- The template's `{nav_links}` section must contain `<a>` tags with proper `href` for sidebar navigation
