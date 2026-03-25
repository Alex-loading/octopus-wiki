## ADDED Requirements

### Requirement: Demos SHALL be managed as first-class content entities
The system SHALL store each technical demo as a structured entity with required fields including `slug`, `title`, `description`, and at least one runnable or reference URL.

#### Scenario: Create demo entity with required fields
- **WHEN** an editor submits a demo with required metadata and a valid URL
- **THEN** the system stores the demo entity and returns its identifier

#### Scenario: Reject demo without any usable link
- **WHEN** an editor submits a demo lacking runnable and reference URLs
- **THEN** the system MUST reject the entity and return a validation error

### Requirement: Articles SHALL support ordered demo associations
The system SHALL allow an article to associate with one or more demos in a defined order for rendering within article and lab views.

#### Scenario: Associate multiple demos to one article
- **WHEN** an editor links multiple demos to an article with explicit order indexes
- **THEN** the system stores all associations and preserves the specified order

#### Scenario: Remove demo association from article
- **WHEN** an editor removes an existing demo association from an article
- **THEN** the system no longer returns that demo in article-linked demo queries

### Requirement: Lab and article pages SHALL consume unified demo retrieval APIs
The frontend SHALL retrieve demo lists and article-linked demos through unified content APIs rather than hardcoded local arrays.

#### Scenario: Lab page renders demos from API-backed content source
- **WHEN** the Lab page requests available demos
- **THEN** the system returns normalized demo cards for display

#### Scenario: Article page renders linked demos contextually
- **WHEN** a reader opens an article with linked demos
- **THEN** the page renders the linked demos in configured order and with valid links
