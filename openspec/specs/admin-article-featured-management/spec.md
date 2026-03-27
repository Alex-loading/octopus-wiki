## ADDED Requirements

### Requirement: Admin can toggle article featured status
The system SHALL allow authenticated administrators to set an article as featured or remove it from featured state from the admin article management interface.

#### Scenario: Admin marks article as featured
- **WHEN** an authenticated administrator clicks "设为精选" for a non-featured article
- **THEN** the system MUST persist `featured=true` for that article
- **THEN** the interface MUST reflect the updated featured state in the same list row

#### Scenario: Admin unmarks article as featured
- **WHEN** an authenticated administrator clicks "取消精选" for a featured article
- **THEN** the system MUST persist `featured=false` for that article
- **THEN** the interface MUST reflect the updated featured state in the same list row

### Requirement: Featured toggle enforces admin authorization
The system MUST reject featured-state write operations for unauthenticated users and non-admin users.

#### Scenario: Unauthenticated user attempts featured toggle
- **WHEN** the user is not authenticated and triggers a featured toggle request
- **THEN** the system MUST deny the operation
- **THEN** the interface MUST show an authentication-required error message

#### Scenario: Non-admin user attempts featured toggle
- **WHEN** the user is authenticated but lacks admin role metadata and triggers a featured toggle request
- **THEN** the system MUST deny the operation
- **THEN** the interface MUST show an authorization error message

### Requirement: Featured toggle provides deterministic operation feedback
The system SHALL provide clear success or failure feedback for each featured toggle operation and prevent duplicate submissions while a request is in progress.

#### Scenario: Successful toggle shows completion state
- **WHEN** a featured toggle request succeeds
- **THEN** the system MUST display a success indication
- **THEN** the action control MUST return to an enabled state

#### Scenario: Failed toggle restores operability
- **WHEN** a featured toggle request fails
- **THEN** the system MUST display an error indication with actionable text
- **THEN** the action control MUST return to an enabled state so the admin can retry
