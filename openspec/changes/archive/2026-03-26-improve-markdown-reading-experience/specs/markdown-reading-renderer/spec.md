## ADDED Requirements

### Requirement: Article markdown SHALL be rendered via a standardized React markdown pipeline
The system SHALL render article body content with a standardized pipeline based on `react-markdown` and SHALL replace ad-hoc line-by-line parsing for article detail pages.

#### Scenario: Render article content with standardized parser
- **WHEN** a user opens an article detail page
- **THEN** the system renders the markdown body through the standardized React markdown pipeline

### Requirement: GFM syntax SHALL be supported for article reading
The system SHALL support GitHub Flavored Markdown features at minimum including tables, task lists, and strikethrough through `remark-gfm`.

#### Scenario: Render GFM table and task list
- **WHEN** an article contains a markdown table and task list syntax
- **THEN** the article detail page displays them as semantic table and checklist structures

### Requirement: Rendered markdown SHALL be sanitized before output
The system SHALL sanitize rendered markdown output through an allowlist-based strategy to prevent unsafe HTML/script injection in article pages.

#### Scenario: Unsafe html is blocked
- **WHEN** article markdown contains unsafe script or disallowed HTML fragments
- **THEN** the rendered output excludes unsafe content and remains readable

### Requirement: Heading anchors SHALL be generated consistently for TOC and deep links
The system SHALL generate stable heading anchors for rendered headings and SHALL expose clickable anchor links for heading navigation.

#### Scenario: Navigate to heading by anchor
- **WHEN** a user clicks a heading anchor or accesses a URL fragment for a heading
- **THEN** the page scrolls to the matching heading and TOC highlighting remains consistent

### Requirement: Markdown typography SHALL follow site theme and reading rhythm
The system SHALL apply consistent typography mapping for core markdown elements (`heading`, `paragraph`, `list`, `blockquote`, `inline code`, `code block`, `link`, `horizontal rule`) in both light and dark themes.

#### Scenario: Readability is consistent across themes
- **WHEN** a user switches between light and dark modes on the same article
- **THEN** markdown content keeps consistent spacing hierarchy and accessible contrast for all mapped core elements
