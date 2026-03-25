## ADDED Requirements

### Requirement: Admin management routes SHALL require authenticated admin identity
The system SHALL restrict article management routes to authenticated users with admin permission.

#### Scenario: Unauthenticated user requests admin route
- **WHEN** a non-authenticated user accesses the admin article route
- **THEN** the system redirects the user to the login flow or returns an unauthorized response

#### Scenario: Non-admin authenticated user requests admin route
- **WHEN** an authenticated user without admin permission accesses the admin article route
- **THEN** the system denies access and returns a forbidden state

### Requirement: Database write policies SHALL enforce admin-only mutation
The system SHALL enforce admin-only permissions at the database policy layer for article create, update, and delete actions.

#### Scenario: Admin mutation is allowed
- **WHEN** an authenticated admin performs a write mutation on articles
- **THEN** the database policy allows the operation

#### Scenario: Non-admin mutation is blocked
- **WHEN** a non-admin user attempts to mutate article records directly through client APIs
- **THEN** the database policy blocks the operation
