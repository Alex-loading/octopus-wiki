## ADDED Requirements

### Requirement: Cross-platform input
The collector SHALL accept HTTP(S) URLs and sharing text containing URLs, SHALL identify bilibili, Douyin, Xiaohongshu and Nowcoder by domain, and SHALL allow other websites to be collected.

#### Scenario: Sharing text contains a short link
- **WHEN** sharing text containing an xhslink.com or b23.tv URL is provided
- **THEN** the URL can be selected and retained as the original link with its platform identified

#### Scenario: Unsafe URL
- **WHEN** a javascript, data, file or credential-bearing URL is submitted
- **THEN** the collector rejects it without navigation or database writes

### Requirement: Metadata is optional
The collector SHALL allow a title, optional cover URL and note to be edited, and SHALL allow manual saving when automated metadata retrieval fails.

#### Scenario: Platform blocks preview
- **WHEN** an authenticated metadata lookup fails or returns unusable HTML
- **THEN** the form retains the draft and explains that the user can fill metadata manually

#### Scenario: Preview fetch access controls
- **WHEN** a user without administrator or device authorization requests preview or an allowed URL redirects to an unapproved host
- **THEN** the server rejects the request before fetching the unauthorized destination

### Requirement: Browser and mobile capture
The system SHALL provide a mobile-friendly capture form, a desktop bookmarklet, and an installed Android PWA share target where supported, plus an iOS shortcut integration recipe using the same form.

#### Scenario: Android share only creates a draft
- **WHEN** the installed PWA receives a URL or text share
- **THEN** the collector prefills the form and only persists the resource after an administrator or authorized device selects a collection and submits

#### Scenario: Login preserves incoming content
- **WHEN** an unauthenticated capture is sent to the administrator login flow
- **THEN** the validated same-site return URL preserves the incoming draft parameters for the post-login collector

#### Scenario: Save fails
- **WHEN** the database write fails or the device is offline
- **THEN** the collector displays an error, retains form input and does not claim the resource was saved

### Requirement: Persistent scoped device authorization
The system SHALL let a verified administrator explicitly authorize the current browser for 90 days of collection without repeated administrator login. Credentials SHALL be stored in a persistent HttpOnly cookie, with only their digest stored server-side. The system SHALL retain the existing tab-scoped administrator session policy.

#### Scenario: A new bookmarklet window has no administrator session
- **WHEN** a new collector window sends a valid device cookie
- **THEN** the user can select or create a collection, preview and save a bookmark without an administrator login prompt

#### Scenario: Authorization lifecycle
- **WHEN** the credential expires, is revoked, or its owner loses administrator status
- **THEN** subsequent capture requests are rejected and an open form retains its input for retry after reauthorization

#### Scenario: Scope and cross-site request enforcement
- **WHEN** a device attempts to edit or delete existing resources, issue credentials without administrator login, or submit a write from another origin
- **THEN** the API rejects the operation without mutations

#### Scenario: Revocation and renewal
- **WHEN** the user revokes this device, or an administrator revokes all their devices or renews the current device
- **THEN** revoked credentials immediately cease to authorize subsequent requests, and renewal replaces the old secret with a new 90-day secret
