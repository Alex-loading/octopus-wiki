## ADDED Requirements

### Requirement: Articles SHALL be persisted with structured metadata
The system SHALL persist each article in a database record containing at least `slug`, `title`, `summary`, `content`, `status`, and `updated_at` fields, and MUST enforce unique `slug` values.

#### Scenario: Create article with valid metadata
- **WHEN** an editor submits a new article with all required fields and a non-conflicting `slug`
- **THEN** the system stores the article as a new record and returns a stable identifier

#### Scenario: Reject duplicate slug
- **WHEN** an editor submits an article whose `slug` already exists
- **THEN** the system MUST reject the write and return a duplicate-slug validation error

### Requirement: Article visibility SHALL follow publish status
The system SHALL expose only articles with `status=published` to public read endpoints, and MUST hide `draft` content from unauthenticated public readers.

#### Scenario: Public list excludes drafts
- **WHEN** a public reader requests the article list
- **THEN** the system returns only published articles and excludes drafts

#### Scenario: Published article is publicly retrievable
- **WHEN** a public reader requests an article by `slug` that is published
- **THEN** the system returns the full published article content

### Requirement: Frontend SHALL access articles through a unified content interface
The frontend content layer SHALL provide stable read methods for article listing and detail retrieval independent of storage backend.

#### Scenario: Blog page loads through content interface
- **WHEN** the Blog page requests article summaries
- **THEN** the content interface returns normalized article data for rendering cards

#### Scenario: Post page resolves article by slug
- **WHEN** the Post page requests a specific article `slug`
- **THEN** the content interface returns the corresponding article or a not-found result
