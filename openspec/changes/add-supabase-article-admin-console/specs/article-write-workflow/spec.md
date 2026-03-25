## ADDED Requirements

### Requirement: Article write workflow SHALL validate required fields before persistence
The system SHALL validate required article fields including `title`, `slug`, and `content` before allowing create or update operations.

#### Scenario: Reject create with missing required fields
- **WHEN** an admin submits a create request without required fields
- **THEN** the system MUST reject the request and return field-level validation errors

#### Scenario: Reject update with duplicate slug
- **WHEN** an admin updates an article slug to a value already used by another article
- **THEN** the system MUST reject the update and return a duplicate-slug error

### Requirement: Article delete workflow SHALL use safe-delete semantics
The system SHALL perform article deletion using reversible semantics and MUST require explicit confirmation from the admin user.

#### Scenario: Confirmed delete succeeds
- **WHEN** an admin confirms deletion of an article
- **THEN** the system stores deletion state and excludes the article from default published and admin active lists

#### Scenario: Cancel delete keeps article unchanged
- **WHEN** an admin cancels deletion in the confirmation step
- **THEN** the system leaves the article state unchanged

### Requirement: Article write operations SHALL provide actionable feedback
The system SHALL provide operation status feedback for create, update, and delete operations, including clear error states.

#### Scenario: Save succeeds with positive feedback
- **WHEN** an article write operation succeeds
- **THEN** the system displays a success state and updated data context

#### Scenario: Save fails with recoverable guidance
- **WHEN** an article write operation fails due to network or backend error
- **THEN** the system displays an error message with retry guidance and preserves unsaved form input
