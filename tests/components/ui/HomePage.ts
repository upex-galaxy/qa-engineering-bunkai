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
   * Navigate to Home and wait for the active-runs widget to resolve.
   * Call useWorkspace() first when the test needs a specific workspace.
   *
   * Waits for the TABLE or the EMPTY state specifically, not the wrapping
   * `home-active-runs` section: that testid is on `ActiveRunsShell`, shared
   * verbatim by the Suspense skeleton, the error state, AND the resolved
   * content (components/home/ActiveRuns.tsx) — during RSC streaming the
   * skeleton can still be attached to the DOM for a moment after the real
   * content mounts, so waiting on the section alone intermittently resolves
   * to 2 elements (strict-mode violation). Table/empty are each unique to
   * one terminal, resolved state.
   */
  async goto(): Promise<void> {
    await this.page.goto(this.buildUrl('/home'));
    await this.activeRunsTable().or(this.activeRunsEmpty()).first().waitFor();
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
}
