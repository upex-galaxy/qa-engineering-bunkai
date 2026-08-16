# BK-215 — Acceptance Test Plan (QA)

> Jira field: `customfield_10067` · [View in Jira](https://jira.upexgalaxy.com/browse/BK-215)

## Acceptance Test Plan (ATP) — BK-215

***Story***: Team Chat | Chat with workspace members in a real-time channel
***Epic***: BK-210 Team Chat
***Status***: DRAFT — Awaiting PO Estimation
***Created***: 2026-08-15
***Mode***: Shift-Left (pre-sprint)

---

## Coverage Estimate

| Type | Count | Notes |
| --- | --- | --- |
| Positive | 7 | Core message delivery, history, roster, viewer access, reconnection |
| Negative | 4 | Cross-workspace isolation, viewer send prevention, empty message rejection, concurrent ordering |
| Boundary | 5 | Message length 0/1/4000/4001, history pagination, disconnection window |
| Integration | 4 | Workspace membership, App Shell panel, Supabase Realtime, DB persistence |
| Security-RBAC | 3 | Viewer read-only, cross-workspace isolation, server-side role enforcement |
| State-Transition | 3 | Connected/disconnected, member/viewer role change, empty/non-empty channel |
| Non-Functional | 4 | Performance (delivery latency, history load time) + Accessibility (keyboard, screen reader) |
| ***Total**** | ****30*** | High count driven by new domain, missing infrastructure, and RBAC risk |

***Rationale***: BK-215 is the foundation story for a new domain (chat) with no existing infrastructure. The ACs are clear but the underlying DB schema, API endpoints, Realtime wiring, and presence system do not exist. This drives high integration and security-RBAC outline counts.

---

## Test Outlines

### Positive (7)

| # | Outline | Preconditions | Expected Result |
| --- | --- | --- | --- |
| P1 | Should deliver a new message to all channel members in real time | Two members have the channel open | New message appears for both without refresh |
| P2 | Should display sender name and timestamp on each message | A message exists in the channel | Message shows sender display name and formatted timestamp |
| P3 | Should load full message history when user opens the channel | Channel has 20+ messages | All messages visible in chronological order |
| P4 | Should load older messages when user scrolls up | Channel has more messages than fit on screen | Older messages load progressively on scroll-up |
| P5 | Should display all workspace members with roles in the roster | Workspace has 3 members with different roles | Roster shows all members with role badges |
| P6 | Should allow viewers to read full message history | Viewer opens the channel | Full history is readable |
| P7 | Should show missed messages after reconnection | Connection drops while messages arrive | Missed messages appear in correct order on reconnect |

### Negative (4)

| # | Outline | Preconditions | Expected Result |
| --- | --- | --- | --- |
| N1 | Should not deliver messages to non-members of the workspace | User belongs to a different workspace | Foreign messages do not appear |
| N2 | Should prevent viewers from sending messages | Viewer attempts to send | Send is rejected at server level |
| N3 | Should reject empty or whitespace-only messages | User types only spaces | Message is not sent, error is shown |
| N4 | Should not show messages from other workspaces | User has access to multiple workspaces | Channel shows only current workspace messages |

### Boundary (5)

| # | Outline | Preconditions | Expected Result |
| --- | --- | --- | --- |
| B1 | Should accept message at exactly 1 character | User types a single character | Message is sent successfully |
| B2 | Should accept message at exactly 4000 characters | User types 4000 characters | Message is sent successfully |
| B3 | Should reject message at 4001 characters | User types 4001 characters | Message is rejected with error |
| B4 | Should handle message with leading/trailing whitespace correctly | User types " Hello " | Message is trimmed and sent as "Hello" |
| B5 | Should handle disconnection window boundary | Connection drops for exactly the catch-up window | Messages load or refresh is prompted |

### Integration (4)

| # | Outline | Preconditions | Expected Result |
| --- | --- | --- | --- |
| I1 | Should enforce channel access through workspace membership | User is/is not a workspace member | Channel access granted/denied based on membership |
| I2 | Should render the chat panel within the App Shell | User opens the panel | Panel appears as right-side dock consistent with BK-147 patterns |
| I3 | Should persist messages to the database | Message is sent | Message is stored in the messages table with correct foreign keys |
| I4 | Should subscribe to Supabase Realtime for message delivery | Channel is open | Realtime subscription is active and receives new messages |

### Security-RBAC (3)

| # | Outline | Preconditions | Expected Result |
| --- | --- | --- | --- |
| S1 | Should enforce viewer read-only access at the API level | Viewer sends message via API | 403 Forbidden returned |
| S2 | Should isolate workspace channels from each other | User accesses channels from different workspaces | No cross-workspace message leakage |
| S3 | Should enforce role-based access on channel operations | User with different roles attempts operations | Operations permitted/denied per RBAC rules |

### State-Transition (3)

| # | Outline | Preconditions | Expected Result |
| --- | --- | --- | --- |
| T1 | Should handle connected-to-disconnected state transition | User is connected then loses connection | UI reflects disconnection state, reconnects automatically |
| T2 | Should handle member-to-viewer role transition | Member's role changes to viewer | Composer becomes disabled in real-time |
| T3 | Should handle empty-to-populated channel transition | Channel has 0 messages, then a message is sent | Empty state disappears, message appears |

### Non-Functional (4)

| # | Outline | Preconditions | Expected Result |
| --- | --- | --- | --- |
| NFR1 | Should deliver messages within the latency SLA under concurrent load | 10 members send simultaneously | All messages delivered within the agreed SLA (2 seconds) |
| NFR2 | Should load large message history within a defined time | Channel has 10,000+ messages | History loads within the agreed time budget (e.g., 3 seconds) |
| NFR3 | Should support keyboard-only navigation of the channel panel | User navigates with keyboard only | All interactions keyboard-accessible with visible focus (WCAG 2.1 AA) |
| NFR4 | Should announce new messages to screen readers | Screen reader user has channel open | New messages announced via live region; presence not color-only (WCAG 2.1 AA) |

---

## Traceability Map

| Original AC | Refined Scenarios | Test Outlines |
| --- | --- | --- |
| AC1: Real-time message delivery | 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7 | P1, P2; N1, N3; B1, B2, B3 |
| AC2: Message history persistence | 2.1, 2.2, 2.3 | P3, P4; B4 |
| AC3: Workspace roster | 3.1, 3.2 | P5; T3 |
| AC4: Viewer read-only access | 4.1, 4.2, 4.3 | P6; N2; S1 |
| AC5: Reconnection catch-up | 5.1, 5.2 | P7; B5; T1 |
| E1: Offline message queue | E1 | Edge #2 |
| E2: Role change propagation | E2 | T2; Edge #6 |
| E3: Validation layers | E3 | B3; Edge #9 |
| E4: NFR - Performance delivery latency | E4 | NFR1; needs PO confirmation |
| E5: NFR - Performance history load | E5 | NFR2; needs PO confirmation |
| E6: NFR - Accessibility keyboard | E6 | NFR3; needs PO confirmation |
| E7: NFR - Accessibility screen reader | E7 | NFR4; needs PO confirmation |

---

## Test Data Requirements

| Data | Requirements | Notes |
| --- | --- | --- |
| Workspaces | At least 2 workspaces with different members | For cross-workspace isolation tests |
| Members | At least 3 members per workspace with different roles (Admin, Member, Viewer) | For RBAC tests |
| Messages | Various lengths: 1 char, 100 chars, 4000 chars, 4001 chars, empty, whitespace-only | For boundary tests |
| Connection states | Connected, disconnected, reconnecting | For state-transition tests |

---

## Test Environment Requirements

| Component | Requirement | Notes |
| --- | --- | --- |
| Database | Supabase PostgreSQL with channels, messages, channel_members tables | New tables required |
| API | Chat API endpoints (send, history, roster, presence) | New endpoints required |
| Realtime | Supabase Realtime configured for chat delivery | Different from broadcast config |
| Auth | Supabase Auth with workspace membership | Existing (BK-1) |

---

## Entry Criteria

- [ ] DB schema for channels, messages, channel_members is implemented
- [ ] Chat API endpoints are implemented and documented
- [ ] Supabase Realtime is wired for chat delivery
- [ ] Presence tracking is implemented (if applicable)
- [ ] Test data is seeded

---

## Exit Criteria

- [ ] All 30 test outlines executed
- [ ] All Critical/High priority scenarios pass
- [ ] No Critical/High severity bugs open
- [ ] RBAC enforcement verified at API level
- [ ] Realtime delivery verified across members
- [ ] NFR verification executed (performance latency/load, accessibility keyboard/screen reader)

---

## Risk-Based Prioritization

| Priority | Test Outlines | Rationale |
| --- | --- | --- |
| P0 — Must Have | P1, N1, N2, S1, S2 | Core message delivery + security |
| P1 — Should Have | P2, P3, P5, P6, P7, N3, B1, B2, B3, I1, I3, I4, T1, NFR1, NFR2, NFR3, NFR4 | Happy paths + critical boundaries + NFR verification |
| P2 — Nice to Have | P4, B4, B5, I2, T2, T3, N4, S3 | Edge cases + integration details |

---

## Open Items for Sprint

- [ ] Confirm DB schema design with Dev
- [ ] Confirm API endpoint contracts with Dev
- [ ] Confirm Realtime wiring approach with Dev
- [ ] Confirm presence implementation approach with Dev
- [ ] Seed test data for all scenarios

---

## Risks & mitigation

| # | Risk | Likelihood | Impact | Mitigated by which outlines |
| --- | --- | --- | --- | --- |
| 1 | DB schema does not exist — blocks all testing | High | Critical | Integration #3, Security-RBAC #1 |
| 2 | API contracts undefined — QA and Dev invent different interfaces | High | Critical | Integration #4, Technical Questions #2 |
| 3 | Realtime wiring misconfigured — messages do not deliver | Medium | Critical | Integration #4, Positive #1 |
| 4 | Presence tracking inaccurate — roster shows wrong online status | Medium | High | Positive #6, Technical Questions #4 |
| 5 | Message ordering inconsistent under concurrent sends | Medium | High | Positive #7, Edge #1 |
| 6 | Viewer can bypass client-side restrictions via API | Medium | Critical | Security-RBAC #1, Negative #2 |
| 7 | Pagination breaks on large histories | Medium | High | Boundary #4, Edge #3 |
| 8 | Role changes not propagated in real-time | Medium | High | State-Transition #2, Edge #6 |
| 9 | NFRs undefined (performance SLA, accessibility) — QA cannot assert non-functional acceptance | Medium | Medium | NFR1-NFR4, Technical Questions #10, #11 |

---
_Synced from Jira by sync-jira-issues_
