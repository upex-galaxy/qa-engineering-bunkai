/**
 * KATA Architecture - Layer 3: Home Page Component
 *
 * UI component for the Home screen's "Active test runs" widget (BK-256).
 * One Page component for this widget; sibling Home-epic stories
 * (BK-255/257/258/259/260) will likely add ATCs to this same class later
 * (automation-plan.md HD-T01 §Component Strategy).
 *
 * Page: /home
 * Locators (data-testid, from components/home/ActiveRuns.tsx):
 * - Section: [data-testid="home-active-runs"]
 * - Table: [data-testid="home-active-runs-table"]
 * - Row (dynamic): [data-testid="home-active-runs-row-{runId}"]
 * - Count: [data-testid="home-active-runs-count"]
 * - Empty state: [data-testid="home-active-runs-empty"]
 * - Resume button: [data-testid="home-active-runs-resume"]
 * - Status chip (per row, derived, D2): [data-status] — reuses the
 *   `.status-chip[data-status]` grammar from app/globals.css; NOT a
 *   data-testid, but a documented product contract per D2.
 *
 * Per-cell locator gap (resolved by reading components/home/ActiveRuns.tsx
 * directly — no per-cell data-testid exists for project/mode/status-text/
 * progress/executor). The table has a fixed column order (Run, Project,
 * Mode, Status, Progress, Executor, Started); the only two cells this
 * ticket's ATCs need individually both have a non-testid, still-robust
 * hook: the status chip's `[data-status]` attribute (D2, sanctioned by the
 * plan) and the progress cell's `role="img"` (StepProgress renders its
 * `aria-label` + visible "{done}/{total}" text under one accessible node).
 * Everything else (BK-849) is asserted structurally (row visible, non-empty)
 * per e2e-patterns.md §3 "When a data-testid is missing" — a follow-up
 * ticket should add per-cell data-testids to ActiveRunRow.
 *
 * `.first()` on every locator below: a one-frame RSC-streaming/hydration
 * artifact observed live against staging can momentarily duplicate ANY node
 * inside the Suspense boundary (section, table, row, resume button) right
 * after navigation — both copies always carry identical content/attributes,
 * so `.first()` resolves the strict-mode ambiguity without masking a real
 * duplicate-data bug (a genuinely duplicated ROW with different content
 * would still fail downstream assertions).
 *
 * BK-260 adds the "Recent activity" widget's own locators/ATCs to this same
 * class (automation-plan.md BK-260 §Component Strategy). Same `.first()`
 * rationale applies — both widgets stream inside their own Suspense
 * boundaries on the same page.
 * - Section: [data-testid="home-recent-activity"]
 * - List: [data-testid="home-recent-activity-list"]
 * - Item (dynamic, keyed by the activity_log event's OWN id — NOT the
 *   entity id; see HomeApi.findActivityEventId's doc comment):
 *   [data-testid="home-recent-activity-item-{eventId}"]
 * - Empty state: [data-testid="home-recent-activity-empty"]
 * - Header "View all" link: [data-testid="home-recent-activity-view-all"]
 * - Empty-state "Browse the full activity feed" link:
 *   [data-testid="home-recent-activity-empty-view-all"]
 */

import type { TestContextOptions } from '@TestContext';

import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { atc } from '@utils/decorators';

// ============================================
// Types
// ============================================

export interface ProgressArgs {
  runId: string
  doneSteps: number
  totalSteps: number
}

export interface ResumeTargetArgs {
  expectedProjectSlug: string
  expectedRunId: string
}

export interface ActivityItemAssertionArgs {
  eventId: string
  expectedActionLabel: string
  expectedItemLabel: string
  expectedGlyphClass: 'text-signal-fail' | 'text-signal-running' | 'text-accent'
  expectedChip: 'Passed' | 'Failed' | 'none'
}

// ============================================
// Home Page Component
// ============================================

export class HomePage extends UiBase {
  // Shared locators (used in 2+ ATCs) — see class doc for why every one
  // ends in .first().
  private readonly activeRunsTable = () => this.page.getByTestId('home-active-runs-table').first();
  private readonly activeRunsRow = (runId: string) => this.page.getByTestId(`home-active-runs-row-${runId}`).first();
  private readonly activeRunsEmpty = () => this.page.getByTestId('home-active-runs-empty').first();
  private readonly activeRunsResumeButton = () => this.page.getByTestId('home-active-runs-resume').first();

  // BK-260 — Recent-activity widget locators (used in 2+ ATCs).
  private readonly recentActivityList = () => this.page.getByTestId('home-recent-activity-list').first();
  private readonly recentActivityItem = (eventId: string) => this.page.getByTestId(`home-recent-activity-item-${eventId}`).first();
  private readonly recentActivityEmpty = () => this.page.getByTestId('home-recent-activity-empty').first();
  private readonly recentActivityViewAllHeader = () => this.page.getByTestId('home-recent-activity-view-all').first();
  private readonly recentActivityEmptyViewAll = () => this.page.getByTestId('home-recent-activity-empty-view-all').first();

  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Navigation (Public)
  // ============================================

  /**
   * Target a specific workspace for the NEXT goto() call, via the app's
   * `bk_active_ws` active-workspace cookie (httpOnly — the app's own /home
   * route resolves its workspace from this cookie server-side, falling back
   * to the caller's oldest workspace when unset; there is no per-workspace
   * URL). Set via the browser-context cookie API (not page.evaluate — an
   * httpOnly cookie is invisible to page JS).
   *
   * Not an ATC: this is test-fixture wiring (which workspace Home shows),
   * not a user-facing action, so it carries no `@atc` and no fixed
   * assertion of its own.
   */
  async useWorkspace(workspaceId: string): Promise<void> {
    await this.page.context().addCookies([
      { name: 'bk_active_ws', value: workspaceId, url: this.baseUrl },
    ]);
  }

  /**
   * Navigate to Home and wait for the active-runs AND recent-activity
   * widgets to both resolve. Call useWorkspace() first when the test needs
   * a specific workspace.
   *
   * Waits for the TABLE or the EMPTY state specifically, not the wrapping
   * `home-active-runs` section: that testid is on `ActiveRunsShell`, shared
   * verbatim by the Suspense skeleton, the error state, AND the resolved
   * content (components/home/ActiveRuns.tsx) — during RSC streaming the
   * skeleton can still be attached to the DOM for a moment after the real
   * content mounts, so waiting on the section alone intermittently resolves
   * to 2 elements (strict-mode violation). Table/empty are each unique to
   * one terminal, resolved state.
   *
   * BK-260 extends this wait (Promise.all, not replace) to also resolve the
   * recent-activity widget's own list-or-empty terminal state — additive:
   * BK-849..855's own wait condition still resolves exactly when it did
   * before, it now just ALSO waits for a sibling widget those ATCs never
   * assert on, at zero cost since both stream in the same RSC pass
   * (automation-plan.md BK-260 §2 Component Strategy).
   */
  async goto(): Promise<void> {
    await this.page.goto(this.buildUrl('/home'));
    await Promise.all([
      this.activeRunsTable().or(this.activeRunsEmpty()).first().waitFor(),
      this.recentActivityList().or(this.recentActivityEmpty()).first().waitFor(),
    ]);
  }

  // ============================================
  // ATCs - Complete Test Cases
  // ============================================

  /**
   * ATC: the active-runs table lists every expected active run across 2+
   * projects, with its full row contract structurally rendered (BK-849 /
   * AC1).
   */
  @atc('BK-849')
  async viewActiveRunsAcrossProjects(expectedRunIds: string[]): Promise<void> {
    await this.goto();
    await expect(this.activeRunsTable()).toBeVisible();
    for (const runId of expectedRunIds) {
      const row = this.activeRunsRow(runId);
      await expect(row).toBeVisible();
      await expect(row).not.toBeEmpty();
    }
  }

  /**
   * ATC: the empty state renders when no run in the workspace is active
   * (BK-850 / AC2).
   */
  @atc('BK-850')
  async viewActiveRunsEmptyState(): Promise<void> {
    await this.goto();
    await expect(this.activeRunsEmpty()).toBeVisible();
    await expect(this.activeRunsTable()).not.toBeVisible();
  }

  /**
   * ATC: Resume navigates away from Home for the most recently active run
   * (BK-851 / AC3, generic — does not assert the exact destination).
   */
  @atc('BK-851')
  async resumeMostRecentActiveRunSuccessfully(): Promise<void> {
    await this.goto();
    await this.activeRunsResumeButton().click();
    await this.page.waitForURL(url => !url.pathname.endsWith('/home'));
    await expect(this.page).not.toHaveURL(/\/home$/);
  }

  /**
   * ATC: a run's row is absent from the active table once it transitions
   * out of `running` (BK-852 / Business Rule, EP-merged: Finished/Aborted).
   */
  @atc('BK-852')
  async verifyRunExcludedFromActiveTable(runId: string): Promise<void> {
    await this.goto();
    await expect(this.activeRunsRow(runId)).toHaveCount(0);
  }

  /**
   * ATC: a run with a blocked step renders the Blocked chip on its row
   * (BK-853 / Business Rule + D2).
   */
  @atc('BK-853')
  async verifyRunShowsBlockedChip(runId: string): Promise<void> {
    await this.goto();
    const chip = this.activeRunsRow(runId).locator('[data-status]').first();
    await expect(chip).toHaveAttribute('data-status', 'blocked');
  }

  /**
   * ATC: an in-progress run renders a non-zero, non-total step-completion
   * progress value (BK-854 / BVA, mid-progress boundary).
   */
  @atc('BK-854')
  async verifyRunProgressRendersValue(args: ProgressArgs): Promise<void> {
    await this.goto();
    const progressCell = this.activeRunsRow(args.runId).getByRole('img');
    await expect(progressCell).toHaveText(`${args.doneSteps}/${args.totalSteps}`);
  }

  /**
   * ATC: Resume navigates to the exact target run's own execution screen
   * (BK-855 / AC3, risk-beyond-AC — exact destination, not just "some"
   * screen; see atc/BK-855-*.md for the D6 recency construction).
   */
  @atc('BK-855')
  async resumeNavigatesToTargetRun(args: ResumeTargetArgs): Promise<void> {
    await this.goto();
    await this.activeRunsResumeButton().click();
    await this.page.waitForURL(url => url.pathname.includes('/runs/'));
    await expect(this.page).toHaveURL(
      new RegExp(`/projects/${args.expectedProjectSlug}/runs/${args.expectedRunId}$`),
    );
  }

  /**
   * ATC: Navigate to Home and verify one specific activity item's row
   * renders its full content contract — actor, action label, item label,
   * relative time, glyph, and verdict chip (BK-624 / AC1, parameterized
   * across entity types — see atc/BK-624.md §6 for the EP-merge + BVA-
   * reduction derivation).
   */
  @atc('BK-624')
  async verifyActivityItemRenders(args: ActivityItemAssertionArgs): Promise<void> {
    await this.goto();
    const row = this.recentActivityItem(args.eventId);
    await expect(row).toBeVisible();
    await expect(row).toContainText(this.config.testUser.email);
    await expect(row).toContainText(args.expectedActionLabel);
    await expect(row).toContainText(args.expectedItemLabel);
    await expect(row.locator('time')).toHaveText('just now');
    await expect(row.locator('span[aria-hidden="true"] svg')).toHaveClass(new RegExp(args.expectedGlyphClass));
    if (args.expectedChip === 'none') {
      await expect(row.locator('[data-status]')).toHaveCount(0);
    }
    else {
      // .first() — RunVerdictChip renders `data-status` on BOTH the outer
      // chip span AND its inner `.dot` span (same two-element pattern
      // BK-853's activeRunsRow chip locator already guards against above).
      const status = args.expectedChip === 'Passed' ? 'pass' : 'fail';
      await expect(row.locator('[data-status]').first()).toHaveAttribute('data-status', status);
      await expect(row.locator('[data-status]').first()).toContainText(args.expectedChip);
    }
  }

  /**
   * ATC: Click the recent-activity card's header "View all" link and
   * verify navigation to the full activity view (BK-625 / AC2, header
   * variant — renders unconditionally in every feed state).
   */
  @atc('BK-625')
  async navigateToActivityFromHeaderLink(): Promise<void> {
    await this.goto();
    await this.recentActivityViewAllHeader().click();
    await this.page.waitForURL(/\/activity$/);
    await expect(this.page).toHaveURL(/\/activity$/);
  }

  /**
   * ATC: Given the feed is showing its empty state, click the empty
   * state's own "Browse the full activity feed" link and verify navigation
   * to the full activity view (BK-626 / AC2, empty-state variant — distinct
   * DOM location from BK-625).
   */
  @atc('BK-626')
  async navigateToActivityFromEmptyState(): Promise<void> {
    await this.goto();
    await this.recentActivityEmptyViewAll().click();
    await this.page.waitForURL(/\/activity$/);
    await expect(this.page).toHaveURL(/\/activity$/);
  }

  /**
   * ATC: Navigate to Home and verify the recent-activity empty state
   * renders with its scoped copy, offering the browse link, while the item
   * list does not render (BK-627 / AC3).
   */
  @atc('BK-627')
  async viewRecentActivityEmptyState(): Promise<void> {
    await this.goto();
    await expect(this.recentActivityEmpty()).toBeVisible();
    await expect(this.recentActivityEmpty()).toContainText('No tracked events in the last 24 hours');
    await expect(this.recentActivityEmpty()).toContainText('new modules, ATCs and tests, finished runs and defect');
    await expect(this.recentActivityEmptyViewAll()).toBeVisible();
    await expect(this.recentActivityList()).toHaveCount(0);
  }

  /**
   * ATC: Given the active workspace was switched away from the one that
   * produced a known event, navigate to Home and verify that event's row
   * is absent from the now-active workspace's condensed feed (BK-631 /
   * Risk-beyond-AC — RLS: activity_log_select_workspace_member never leaks
   * across workspaces — see atc/BK-631.md §"Adaptation rationale").
   */
  @atc('BK-631')
  async verifyActivityIsolatedByWorkspace(foreignEventId: string): Promise<void> {
    await this.goto();
    await expect(this.recentActivityItem(foreignEventId)).toHaveCount(0);
  }
}
