## ADDED Requirements

### Requirement: Public collection browsing
The site SHALL show public collections and their public resources, and SHALL open each resource's original HTTP(S) URL from its card.

#### Scenario: Visitor opens a collection
- **WHEN** a visitor selects a public collection
- **THEN** the site displays its public resources with title, platform, optional cover and note, and links to the original resource

#### Scenario: Private content remains hidden
- **WHEN** a visitor or ordinary account queries a private collection or private resource directly
- **THEN** its metadata and records are inaccessible and it contributes no public count

### Requirement: Administrator resource management
The system SHALL allow verified administrators to create, edit, move, change visibility, and delete bookmarks. Direct browser database writes from other identities SHALL be rejected. A server-verified device capability MAY insert bookmarks and collections through the scoped collector API, but SHALL NOT edit or delete existing records.

#### Scenario: Resource is moved
- **WHEN** an administrator changes a bookmark's collection and saves
- **THEN** subsequent reads show it in the destination collection

#### Scenario: Duplicate capture
- **WHEN** an administrator saves an existing canonical URL
- **THEN** the system reports the duplicate without overwriting the existing resource

### Requirement: Collection management during capture
The system SHALL allow an administrator or authorized collector device to choose an existing collection or create a named collection in the capture form. Subsequent renaming, visibility changes and empty-collection deletion SHALL require administrator login.

#### Scenario: New collection is selected immediately
- **WHEN** an administrator creates a valid uniquely named collection while capturing
- **THEN** the new collection is available and selected without losing the resource draft

#### Scenario: Nonempty deletion
- **WHEN** an administrator attempts to delete a collection containing resources
- **THEN** deletion is rejected and the resources are retained
