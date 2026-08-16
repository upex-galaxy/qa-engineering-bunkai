# Team Chat | Chat with workspace members in a real-time channel

**Jira Key:** [BK-215](https://jira.upexgalaxy.com/browse/BK-215)
**Epic:** [BK-210](https://jira.upexgalaxy.com/browse/BK-210) (Team Chat)
**Type:** Story
**Status:** Estimation
**Priority:** Medium
**Story Points:** -
**Web Link:** https://staging-upexbunkai.vercel.app/

---

## Overview

## User Story

As Elena Vargas, a Senior QA Engineer, I want to chat with my workspace members in a real-time channel, so that operational questions like "is staging down?" get answered where the QA work lives instead of scattering into external tools.

## Context

This is the foundation story of the Team Chat epic. Every Workspace gets a general channel shared by all of its members: messages appear for everyone in real time without refreshing, the history persists across sessions, and a roster shows who belongs to the Workspace. Channel access mirrors the shipped Workspace membership model (epic BK-1) — joining the Workspace is joining the channel. The remaining Team Chat stories (per-project channels, mentions, rich links, edit and delete, history search) all build on the channel and message primitives introduced here, so this story activates the moment Workspace membership is live and unlocks the rest of the epic.

---

## QA Refinements (Shift-Left Analysis)

***Refined on****: 2026-08-15 | ****Mode****: Shift-Left (pre-sprint) | ****Status***: Refined - Awaiting PO Estimation

### Story Quality Assessment

***Verdict***: Significant Issues

- Clear user value and well-defined ACs, but underlying infrastructure does not exist.
- Integration points are undefined — high feasibility risk.
- Critical details missing: ordering guarantee, pagination strategy, error/loading states, empty state copy.

---

### Critical Analysis

***Business context***:

- Primary persona: Elena Vargas, Senior QA Engineer
- Secondary personas: QA engineers, workspace members who need real-time operational conversation
- Business value: Operational questions like "is staging down?" get answered where the QA work lives instead of scattering into external tools
- KPIs influenced: Time-to-answer for operational questions, context retention, reduced tool-switching friction
- User journey position: Foundation story of the Team Chat epic

***Technical context***:

- Frontend: Right-side collapsible panel in App Shell (consistent with BK-147 patterns)
- Backend: No confirmed chat API endpoints exist in baseline
- Database: New tables needed (channels, messages, channel_members) - no schema exists yet
- External services: Supabase Auth/Postgres/RLS for channel visibility; Supabase Realtime for message delivery
- Integration points: Workspace membership (BK-1), App Shell (BK-147), Supabase Realtime

***Evidence-confirmed facts***:

- Supabase Realtime is configured in migration 0043 for broadcast channels
- Chat features are marked as post-MVP in business-model.md
- Workspace membership model (BK-1) exists with RBAC ladder (viewer, member, admin, owner)
- App Shell with tabbed explorer patterns (BK-147) exists and can host a right-side panel
- No confirmed chat API endpoints, message delivery pipeline, or Realtime chat subscription exists

***Proposals / pending decisions***:

- Proposal: MVP should use Supabase Realtime broadcast for message delivery
- Pending: Whether to use Supabase Realtime broadcast or Presence for online status tracking
- Pending: Message delivery confirmation semantics (delivered vs read vs seen)
- Pending: Message ordering guarantees when multiple users send simultaneously
- Pending: Whether general channel is special case of channels table or separate concept
- Pending: Pagination strategy for message history (cursor-based vs offset-based)
- Pending: Whether presence dots reflect real-time online status or last-seen timestamp

---

### Story Complexity

| Axis | Rating | Why |
| --- | --- | --- |
| Business logic | Medium | Clear user value but new domain (chat) with undefined API contracts and DB schema |
| Integration | High | Depends on workspace membership, App Shell, Supabase Realtime, and new DB tables |
| Data validation | Medium | Message length bounds (1-4000 chars), empty/whitespace rejection, ordering guarantees |
| UI | Medium | Panel layout designed but interaction states (typing, presence, unread, reconnect) need definition |

***Estimated test effort***: High for refinement because the acceptance criteria are clear but the underlying infrastructure (DB schema, API endpoints, Realtime wiring) does not exist yet. Feasibility risk is high.

---

### Epic-level Inheritance

- Risks restated at Story level: Chat is a new domain for this codebase — no existing chat infrastructure
- Integration points inherited: Workspace membership (BK-1) → channel access; App Shell (BK-147) → panel hosting; Supabase Realtime → message delivery
- PO/Dev answers already given at epic level: Chat is post-MVP in business-model.md; new DB tables are expected
- Test strategy inherited: Treat workspace membership as upstream dependency; do not final-design message delivery assertions until API contract and Realtime subscription are confirmed

---

### Refined Acceptance Criteria

```gherkin
AC1: Real-time message delivery

  Scenario 1.1 (Critical): Should deliver a message to all channel members in real time without page refresh
    Given Elena and Sara are both members of the workspace and have the workspace general channel open.
    When Elena sends the message "Is staging down? My run just stalled".
    Then Sara sees the message appear in the channel within 2 seconds without refreshing the page. The message shows Elena's name and the time it was sent.

  Scenario 1.2 (High): Should display sender name and timestamp on each message
    Given A message has been sent by Elena in the general channel.
    When The message renders in the channel.
    Then The message displays Elena's display name and the send time in a consistent format.

  Scenario 1.3 (Critical): Should not deliver messages to users who are not channel members
    Given A user belongs to a different workspace and is not a member of "Bunkai QA".
    When A message is sent in the "Bunkai QA" general channel.
    Then The non-member does not receive or see the message.

  Scenario 1.4 (High): Should reject empty or whitespace-only messages
    Given Elena has the general channel open.
    When Elena attempts to send a message that is empty or contains only whitespace.
    Then The message is not sent and a clear error message is shown.

  Scenario 1.5 (High): Should reject messages exceeding 4000 characters
    Given Elena has the general channel open.
    When Elena types a message of 4001 characters.
    Then The send button is disabled or an error is shown before/after attempting to send.

  Scenario 1.6 (Medium): Should accept messages at exactly 1 character
    Given Elena has the general channel open.
    When Elena sends a single character message (e.g., "OK").
    Then The message is sent and appears in the channel.

  Scenario 1.7 (Medium): Should accept messages at exactly 4000 characters
    Given Elena has the general channel open.
    When Elena sends a message of exactly 4000 characters.
    Then The message is sent and appears in the channel.

AC2: Message history persistence

  Scenario 2.1 (Critical): Should display message history in chronological order across sessions
    Given The "Bunkai QA" general channel contains 20 messages.
    When Elena signs out, signs back in, and opens the channel.
    Then She sees the same 20 messages in chronological order (oldest at top, newest at bottom).

  Scenario 2.2 (High): Should load older messages on scroll-up
    Given The general channel contains more messages than fit on one screen.
    When Elena scrolls up to the top of the visible messages.
    Then Older messages load progressively without losing her scroll position.

  Scenario 2.3 (High): Should maintain message ordering under concurrent sends
    Given Elena and Sara both send messages at nearly the same time.
    When Both messages appear in the channel.
    Then Messages appear in a deterministic order consistent across all members' views.

AC3: Workspace roster

  Scenario 3.1 (High): Should display all workspace members with their roles
    Given The workspace "Bunkai QA" has 3 members: Elena, Sara, and Mateo.
    When Elena opens the channel roster.
    Then She sees all 3 members listed with their workspace role (e.g., "Admin", "Member", "Viewer").

  Scenario 3.2 (Medium): Should show online/offline presence for each member
    Given Elena opens the channel roster.
    When She views the member list.
    Then Each member shows a presence indicator (e.g., green dot for online, gray for offline).

AC4: Viewer read-only access

  Scenario 4.1 (High): Should allow viewers to read full message history
    Given Mateo's account in "Bunkai QA" has the viewer role.
    When Mateo opens the workspace general channel.
    Then He can read the full message history without restrictions.

  Scenario 4.2 (High): Should disable the composer for viewers with a read-only hint
    Given Mateo has the viewer role and opens the general channel.
    When He looks at the composer area.
    Then The composer is disabled and shows a hint indicating viewers have read-only access.

  Scenario 4.3 (Critical): Should prevent viewers from sending messages via API
    Given Mateo has the viewer role.
    When Mateo attempts to send a message (e.g., via API manipulation).
    Then The server rejects the request with an appropriate error (e.g., 403 Forbidden).

AC5: Reconnection catch-up

  Scenario 5.1 (High): Should show missed messages after connection drop without page refresh
    Given Elena has the channel open and her connection drops for 2 minutes. Sara sends 3 messages during that gap.
    When Elena's connection comes back.
    Then The 3 missed messages appear in the channel in the right order without Elena needing to refresh the page.

  Scenario 5.2 (Medium): Should handle extended disconnection gracefully
    Given Elena's connection drops for 30 minutes.
    When Her connection comes back.
    Then She sees all missed messages or is prompted to refresh if the gap exceeds the catch-up window.

New scenarios from edge cases

  Scenario E1 (High): Should queue messages sent while disconnected
    Given Elena loses connection while composing a message.
    When She finishes typing and hits send while still disconnected.
    Then The message is either queued for delivery on reconnect or the user is notified of failure.

  Scenario E2 (High): Should reflect role changes in real-time
    Given Elena is a member with the channel open.
    When An admin changes Elena's role to viewer.
    Then The composer becomes disabled without requiring a page refresh.

  Scenario E3 (Medium): Should handle message validation client-side and server-side
    Given Elena types a message that exceeds 4000 characters.
    When She attempts to send.
    Then Validation prevents the send at the appropriate layer with a clear error.
    
  Scenario E4 (High): Should meet delivery latency SLA under concurrent load (NFR - Performance)
    Given 10 members have the general channel open and send messages simultaneously.
    When All messages are delivered to all members.
    Then Message delivery latency stays within the agreed SLA (scenario 1.1: under 2 seconds). NEEDS PO/DEV CONFIRMATION.

  Scenario E5 (Medium): Should load large message histories within a defined time (NFR - Performance)
    Given The general channel contains 10,000+ messages.
    When A member opens the channel.
    Then The history loads within a defined time budget (e.g., under 3 seconds). NEEDS PO/DEV CONFIRMATION.

  Scenario E6 (High): Should support keyboard-only navigation (NFR - Accessibility, WCAG 2.1 AA)
    Given A user navigates the channel panel with keyboard only.
    When They interact with the message list, composer, and roster.
    Then All interactions are keyboard-accessible with visible focus (send on Enter, newline on Shift+Enter). NEEDS PO/DEV CONFIRMATION.

  Scenario E7 (Medium): Should announce new messages to screen readers (NFR - Accessibility, WCAG 2.1 AA)
    Given A screen reader user has the channel open.
    When A new message arrives or presence changes.
    Then New messages are announced via a live region and presence indicators are not color-only. NEEDS PO/DEV CONFIRMATION.
```

---

### Critical Findings

| # | Finding | Impact | Action |
| --- | --- | --- | --- |
| 1 | No DB schema exists for channels, messages, or channel_members | Blocks all data-layer testing | Confirm schema design before sprint estimation |
| 2 | No chat API endpoints exist in the baseline | Blocks API contract testing | Confirm endpoint paths, auth, response shapes |
| 3 | Supabase Realtime is configured for broadcast, not chat | May need different Realtime subscription pattern | Confirm Realtime usage for chat vs broadcast |
| 4 | Presence tracking system does not exist | Roster online/offline status is untestable | Confirm presence implementation approach |
| 5 | Message ordering under concurrent sends is undefined | Ordering assertions are unstable | Confirm ordering guarantees (server timestamp vs client) |
| 6 | Pagination strategy for history is not defined | Scroll-up-to-load behavior is untestable | Confirm cursor format and page size |

---

### Ambiguities

| # | Location in Story | Question for PO/Dev | Impact on testing | Suggested clarification |
| --- | --- | --- | --- | --- |
| 1 | AC1 "without refreshing the page" | Does this mean WebSocket/Server-Sent Events, or polling? | Cannot decide whether to test automatic updates vs manual refresh | Confirm delivery mechanism (Supabase Realtime broadcast) |
| 2 | AC2 "oldest messages load as she scrolls up" | Is this infinite scroll, pagination, or lazy loading? What is the page size? | Cannot test pagination boundaries | Confirm pagination strategy and page size |
| 3 | AC3 "currently online" | Is online status real-time via Supabase Presence, or last-seen timestamp? | Cannot test presence accuracy | Confirm presence implementation |
| 4 | AC4 "composer is disabled with a hint" | What exact copy does the hint show? Where is it positioned? | Cannot assert exact UI text | Define hint copy and placement |
| 5 | AC5 "connection drops for 2 minutes" | How is connection drop simulated in testing? What is the reconnection window? | Cannot design reconnection test | Define reconnection semantics and timeout |
| 6 | AC5 "Elena does not need to refresh" | Does the client automatically reconnect and fetch missed messages? | Cannot test catch-up behavior | Confirm auto-reconnect and catch-up mechanism |
| 7 | Business Rules "Messages display in the order they were sent" | Is this server-assigned timestamp, client timestamp, or sequence number? | Ordering assertions depend on this | Confirm ordering mechanism |
| 8 | Business Rules "history is retained for the life of the Workspace" | Is there a maximum message count or storage limit? | Cannot test large-history scenarios | Confirm retention policy details |
| 9 | Mockup "send on Enter, newline on Shift+Enter" | Is this confirmed behavior or design intent? | Cannot test keyboard shortcuts | Confirm keyboard interaction model |

---

### Gaps (missing info)

| # | Type | Why critical | What to add | Risk if omitted |
| --- | --- | --- | --- | --- |
| 1 | DB schema | No tables exist for channels, messages, channel_members | Schema design with columns, types, constraints, indexes | Implementation and QA invent different data models |
| 2 | API contract | No chat endpoints exist | Endpoint paths, methods, auth, request/response shapes | Implementation and QA invent different contracts |
| 3 | Realtime subscription | Supabase Realtime is configured for broadcast, not chat | Confirm Realtime channel naming, event types, payload shape | Message delivery may not work as expected |
| 4 | Presence system | No online/offline tracking exists | Presence implementation approach (Supabase Presence vs custom) | Roster online status is untestable |
| 5 | Message ordering | Ordering guarantee is not defined | Confirm server timestamp vs sequence number vs client timestamp | Ordering assertions become subjective |
| 6 | Pagination | Scroll-up behavior is not defined | Cursor format, page size, loading states | History loading cannot be tested |
| 7 | Error states | No error handling is defined | Network error, auth failure, message send failure, Realtime disconnect | User may see broken UI on failure |
| 8 | Loading states | No loading indicators are defined | Message loading, history loading, send-in-progress | UX may feel broken during loads |
| 9 | Empty state copy | "friendly prompt" is vague | Exact copy for empty channel | Cannot assert exact UI text |

---

### Clarified Business Rules

| Rule | Clarification |
| --- | --- |
| Viewer access | Viewers are read-only; cannot send messages (enforced at API level) |
| Message length | 1-4000 characters after trimming; empty/whitespace-only messages rejected |
| History retention | Retained indefinitely in v1 (no auto-purge) |
| Send behavior | Send on Enter, newline on Shift+Enter (confirmed in mockup) |

---

### Critical Questions for PO

> These BLOCK sprint planning until answered.

***1. Should the general channel be a special case of a channels table or a separate concept?***

- Context: The story assumes a general channel exists per workspace, but no DB schema exists.
- Impact: Dev cannot estimate the data model; QA cannot design data-layer tests.
- Suggested: Treat it as a row in a channels table with `type: 'general'`.

***2. What is the message ordering guarantee when multiple users send simultaneously?***

- Context: Business Rules say "order they were sent" but mechanism is not defined.
- Impact: QA cannot write deterministic ordering assertions.
- Suggested: Server-assigned timestamps with microsecond precision; tie-break by sender ID.

***3. What is the pagination strategy and page size for message history?***

- Context: AC2 says "scrolls up" but mechanism is undefined.
- Impact: QA cannot test pagination boundaries.
- Suggested: Cursor-based using last message ID; page size = 50.

***4. Is message validation client-side only, server-side only, or both?***

- Context: AC5 mentions length bounds but not where validation occurs.
- Impact: QA cannot determine testing layers.
- Suggested: Both — client-side for UX, server-side for security.

***5. What is the maximum disconnection window before requiring manual refresh?***

- Context: AC5 mentions "2 minutes" but no maximum is defined.
- Impact: QA cannot test reconnection catch-up boundary.
- Suggested: 5 minutes; beyond that, prompt refresh.

***6. How should the empty channel state be worded?***

- Context: Business Rules mention "friendly prompt" but no copy is defined.
- Impact: QA cannot assert exact UI text.
- Suggested: "No messages yet. Start the conversation!"

***7. Should presence dots reflect real-time status or last-seen timestamp?***

- Context: AC3 mentions "currently online" but implementation is undefined.
- Impact: QA cannot test presence accuracy.
- Suggested: Supabase Presence for real-time; last-seen fallback.

***8. What happens when a user's role changes from member to viewer while channel is open?***

- Context: Edge case not covered by ACs but affects viewer scenario.
- Impact: QA cannot test real-time role propagation.
- Suggested: Composer disabled in real-time + toast notification.

***9. Should messages be queued when user is disconnected or should failure be notified?***

- Context: Edge case not covered by ACs but affects reconnection scenario.
- Impact: QA cannot test offline behavior.
- Suggested: Queue for delivery on reconnect; show sending indicator.

---

### Technical Questions for Dev

> These do not block PO but block implementation.

1. ***What DB schema will be used for channels, messages, and channel_members?*** — Columns, types, constraints, indexes, foreign keys. Blocks all data-layer testing.
2. ***What API endpoints will power the chat?*** — Paths, methods, auth, request/response shapes. Blocks API contract testing.
3. ***How will Supabase Realtime be wired for chat delivery?*** — Channel naming, event types, payload shape. Blocks Realtime subscription testing.
4. ***How will presence tracking be implemented?*** — Supabase Presence vs custom solution. Blocks roster online/offline testing.
5. ***What is the message ordering mechanism?*** — Server timestamp, sequence number, or hybrid. Blocks ordering assertions.
6. ***What cursor format and page size for history pagination?*** — Blocks pagination boundary testing.
7. ***How will RLS policies be implemented for channel access?*** — Blocks security-RBAC testing.
8. ***What error codes and shapes will the API return?*** — Auth failures, validation errors, server errors. Blocks error-state testing.
9. ***Will there be a typing indicator or delivery confirmation?*** — If yes, blocks additional test scenarios.
10. What performance SLAs apply to message delivery and history loading? — Blocks NFR performance outlines (NFR1, NFR2).
11. Will the chat panel meet WCAG 2.1 AA accessibility (keyboard navigation, screen reader)? — Blocks NFR accessibility outlines (NFR3, NFR4).

---

### Design Questions

1. ***What exact copy does the viewer read-only hint show?*** — Mockup says "disabled composer with a read-only hint" but no text provided.
2. ***How should the empty channel state be visually represented?*** — Business Rules say "friendly prompt" but no design provided.
3. ***Should the roster be a flyout overlay or persistent sidebar?*** — Mockup says "roster flyout" but behavior not defined.
4. ***How should the unread separator line be styled?*** — Business Rules mention it but no visual spec exists.
5. ***Should the panel remember open/closed state across navigations?*** — Not defined in ACs or mockup.
6. ***How should the panel behave on narrow viewports?*** — BRIEF.md says "desktop-first 1440px" but no responsive behavior defined.

---

### Open Questions — Proposed Answers

| # | Question | Proposed Answer | Source |
| --- | --- | --- | --- |
| 1 | General channel: special case or separate table? | Row in channels table with `type: 'general'` | Consistency with future project channels (BK-216) |
| 2 | Message ordering guarantee | Server timestamps with microsecond precision; tie-break by sender ID | Industry standard for chat systems |
| 3 | Pagination strategy | Cursor-based using last message ID; page size = 50 | Standard for real-time feeds |
| 4 | Validation layers | Both client-side (UX) and server-side (security) | Security best practice |
| 5 | Max disconnection window | 5 minutes; beyond that, prompt refresh | Reasonable for QA tool context |
| 6 | Empty state copy | "No messages yet. Start the conversation!" | Friendly, action-oriented |
| 7 | Presence implementation | Supabase Presence for real-time; last-seen fallback | Leverages existing Supabase infrastructure |
| 8 | Role change propagation | Real-time composer disable + toast notification | Consistent with real-time chat UX |
| 9 | Offline message behavior | Queue for delivery on reconnect; show sending indicator | Standard chat pattern |

---

### Suggested Story Improvements

| # | Current state | Suggested change | Benefit |
| --- | --- | --- | --- |
| 1 | "real-time channel" | Define delivery mechanism (Supabase Realtime broadcast) | Removes ambiguity |
| 2 | "without refreshing" | Define reconnection mechanism and catch-up window | Makes AC5 testable |
| 3 | "currently online" | Define presence implementation | Makes AC3 testable |
| 4 | "scrolls up" | Define pagination strategy and page size | Makes AC2 testable |
| 5 | "friendly prompt" | Provide exact copy | Makes empty state assertable |
| 6 | "order they were sent" | Define ordering mechanism | Makes assertions objective |

---

### Next Steps

- [ ] PO answers Critical Questions before sprint planning
- [ ] Dev answers Technical Questions before estimation
- [ ] DB schema design is confirmed and implemented
- [ ] API endpoint contracts are confirmed and implemented
- [ ] Supabase Realtime wiring for chat is confirmed
- [ ] Story enters sprint at status Ready For Dev once estimated

---

## Fields

> Each rich-text field is a separate file in this folder.

- [Acceptance Criteria](./acceptance-criteria.md)
- [Business Rules](./business-rules.md)
- [Scope](./scope.md)
- [Out Of Scope](./out-of-scope.md)
- [Workflow](./workflow.md)
- [Mockup](./mockup.md)
- [Acceptance Test Plan (QA)](./acceptance-test-plan.md)

---

## Traceability

### Storys (5)

- [BK-216](https://jira.upexgalaxy.com/browse/BK-216): Team Chat | Chat in a dedicated per-project channel _(Backlog)_
- [BK-220](https://jira.upexgalaxy.com/browse/BK-220): Team Chat | Search the message history _(Backlog)_
- [BK-219](https://jira.upexgalaxy.com/browse/BK-219): Team Chat | Edit and delete my own messages _(Ready For Dev)_
- [BK-217](https://jira.upexgalaxy.com/browse/BK-217): Team Chat | Mention a teammate to get their attention _(Backlog)_
- [BK-218](https://jira.upexgalaxy.com/browse/BK-218): Team Chat | Share an ATC, test, or run as a rich link _(Backlog)_

### Epic (1)

- [BK-1](https://jira.upexgalaxy.com/browse/BK-1): Tenancy & Identity _(Planning)_

---

## Metadata

- **Created:** 11/7/2026
- **Updated:** 15/8/2026
- **Reporter:** Ely
- **Assignee:** pinto.lucas.nahuel
- **Labels:** shift-left-2026-08-15, shift-left-reviewed

---

_Synced from Jira by sync-jira-issues_
