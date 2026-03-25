## ADDED Requirements

### Requirement: Admin article management page SHALL provide full article CRUD entrypoints
The system SHALL provide an admin page for articles that supports listing, creating, editing, and deleting articles through a unified interface.

#### Scenario: Admin views article list
- **WHEN** an authenticated admin opens the article management page
- **THEN** the system displays article records with key metadata including title, slug, status, and updated time

#### Scenario: Admin creates an article
- **WHEN** an authenticated admin submits a valid article form in the management page
- **THEN** the system creates a new article record and shows a success feedback

#### Scenario: Admin edits an article
- **WHEN** an authenticated admin updates an existing article and submits changes
- **THEN** the system persists updates and reflects the latest data in the list and detail view

#### Scenario: Admin deletes an article
- **WHEN** an authenticated admin confirms deletion for an existing article
- **THEN** the system marks the article as deleted and removes it from default list views

### Requirement: Admin UI SHALL follow main-site design language
The admin article management page SHALL reuse existing design tokens and UI component patterns to maintain visual and interaction consistency with the main site.

#### Scenario: Admin page renders with shared style primitives
- **WHEN** the admin page is rendered in light or dark mode
- **THEN** typography, spacing, colors, and interactive states follow the same design system used by the main site
