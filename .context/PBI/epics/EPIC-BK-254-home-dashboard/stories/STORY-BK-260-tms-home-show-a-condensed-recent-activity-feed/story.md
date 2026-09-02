# TMS-Home | Show a condensed recent activity feed

**Jira Key:** [BK-260](https://jira.upexgalaxy.com/browse/BK-260)
**Epic:** [BK-254](https://jira.upexgalaxy.com/browse/BK-254) (Home Dashboard)
**Type:** Story
**Status:** QA Approved
**Priority:** Medium
**Story Points:** -

---

## Overview

## User story

As a Senior QA Engineer, I want to see a condensed feed of recent workspace activity on Home so that I can catch up on what changed without leaving the screen I land on first.

## Definition of done

- The condensed feed appears on Home and reflects the workspace's most recent activity.
- The change does not regress existing Home navigation or other screens.

## Technical notes

Renders into `home.jsx` (master-design-plan.md §4.2), the "Recent activity" section. A thin presentation layer over the activity stream already built for TMS-Activity ([https://jira.upexgalaxy.com/browse/BK-49#icft=BK-49](https://jira.upexgalaxy.com/browse/BK-49#icft=BK-49)) — this story does not duplicate that backend, it reuses it with a small page size and no pagination controls.

---

## Fields

> Each rich-text field is a separate file in this folder.

- [Acceptance Criteria](./acceptance-criteria.md)
- [Scope](./scope.md)
- [Out Of Scope](./out-of-scope.md)

---

## Traceability

### Tests (8)

- [BK-624](https://jira.upexgalaxy.com/browse/BK-624): BK-260: TC1: should show actor, action, target, relative time, glyph and verdict for each event type given workspace has recent tracked activity _(Draft)_
- [BK-625](https://jira.upexgalaxy.com/browse/BK-625): BK-260: TC2: should navigate to /activity when "View all" header link is selected _(Draft)_
- [BK-626](https://jira.upexgalaxy.com/browse/BK-626): BK-260: TC3: should navigate to /activity when link is selected from empty state _(Draft)_
- [BK-627](https://jira.upexgalaxy.com/browse/BK-627): BK-260: TC4: should show empty state given workspace has no tracked activity in last 24h _(Draft)_
- [BK-628](https://jira.upexgalaxy.com/browse/BK-628): BK-260: TC5: should show error state, not empty state, given activity read fails _(Draft)_
- [BK-629](https://jira.upexgalaxy.com/browse/BK-629): BK-260: TC6: should exclude or include an event at the 24h window boundary _(Draft)_
- [BK-630](https://jira.upexgalaxy.com/browse/BK-630): BK-260: TC7: should cap feed at configured row limit given more tracked events than the limit _(Draft)_
- [BK-631](https://jira.upexgalaxy.com/browse/BK-631): BK-260: TC8: should not show activity from a different workspace given RLS scoping _(Draft)_

### Test Execution (1)

- [BK-634](https://jira.upexgalaxy.com/browse/BK-634): ATR: BK-260: Story Testing _(ACTIVE)_

### Story (1)

- [BK-49](https://jira.upexgalaxy.com/browse/BK-49): TMS-Activity | Stream a read-side feed over the existing activity log _(Ready For QA)_

### Test Plan (1)

- [BK-633](https://jira.upexgalaxy.com/browse/BK-633): ATP: BK-260: TMS-Home | Show a condensed recent activity feed _(Planning)_

### Test Set (1)

- [BK-632](https://jira.upexgalaxy.com/browse/BK-632): ATS: BK-260: TMS-Home | Show a condensed recent activity feed _(Designing)_

---

## Metadata

- **Created:** 31/7/2026
- **Updated:** 27/8/2026
- **Reporter:** Ely
- **Assignee:** Carlos C
- **Labels:** p2

---

_Synced from Jira by sync-jira-issues_
