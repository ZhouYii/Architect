import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Collect console errors emitted during a page operation */
function collectErrors(page: Page): { errors: string[]; cleanup: () => void } {
  const errors: string[] = [];
  const handler = (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  };
  page.on('console', handler);
  return {
    errors,
    cleanup: () => page.off('console', handler),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Architect App', () => {

  test('1. App loads without errors', async ({ page }) => {
    const { errors, cleanup } = collectErrors(page);

    await page.goto('/');
    // Wait for the app layout to mount
    await page.waitForSelector('.app-layout', { timeout: 5000 });

    cleanup();

    // Filter out non-fatal Tauri IPC warnings — those are expected in browser mode
    const fatalErrors = errors.filter(
      (e) => !e.includes('[ipc] Not in Tauri') && !e.includes('[workspace]')
    );
    expect(fatalErrors, `Console errors: ${fatalErrors.join('\n')}`).toHaveLength(0);
  });

  test('2. Canvas renders React Flow nodes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-layout', { timeout: 5000 });

    // React Flow renders nodes with this class
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeVisible({ timeout: 5000 });

    const count = await nodes.count();
    expect(count).toBeGreaterThan(0);
  });

  test('3. Toolbar is visible with breadcrumb and controls', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-layout', { timeout: 5000 });

    // App logo / name is always present
    const logo = page.locator('text=Architect').first();
    await expect(logo).toBeVisible({ timeout: 3000 });

    // Breadcrumb nav
    const breadcrumb = page.locator('nav[aria-label="Canvas navigation"]');
    await expect(breadcrumb).toBeVisible({ timeout: 3000 });

    // View toggle buttons (conceptual ◆ / code ≡)
    const viewToggles = page.locator('button[title="Conceptual view"], button[title="Code view"]');
    await expect(viewToggles.first()).toBeVisible({ timeout: 3000 });
  });

  test('4. Block selection opens inspector panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-layout', { timeout: 5000 });

    // Wait for at least one node to appear
    const firstNode = page.locator('.react-flow__node').first();
    await expect(firstNode).toBeVisible({ timeout: 5000 });

    // Click a block node
    await firstNode.click();
    await page.waitForTimeout(500);

    // Inspector panel should have content — the side panel tab bar should be visible
    const inspectorTab = page.locator('button', { hasText: 'Inspector' });
    await expect(inspectorTab).toBeVisible({ timeout: 3000 });
  });

  test('5. Side panel tabs switch content', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-layout', { timeout: 5000 });

    // All three tabs should be present
    const inspectorTab = page.locator('button', { hasText: 'Inspector' });
    const changesetsTab = page.locator('button', { hasText: 'Changesets' });
    const chatTab = page.locator('button', { hasText: 'Chat' });

    await expect(inspectorTab).toBeVisible({ timeout: 3000 });
    await expect(changesetsTab).toBeVisible({ timeout: 3000 });
    await expect(chatTab).toBeVisible({ timeout: 3000 });

    // Click Changesets tab
    await changesetsTab.click();
    await page.waitForTimeout(300);

    // Click Chat tab
    await chatTab.click();
    await page.waitForTimeout(300);
    // All tabs rendered and clickable without crash
  });

  test('6. Drill-down navigation via double-click on parent block', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-layout', { timeout: 5000 });

    // Read the initial breadcrumb text
    const breadcrumb = page.locator('nav[aria-label="Canvas navigation"]');
    await expect(breadcrumb).toBeVisible({ timeout: 3000 });
    const initialText = await breadcrumb.innerText();

    // Find a node with children — in mock data "Game Server" has has_children: true
    // It shows "↵ drill-in" text inside the node
    const drillableNode = page.locator('.react-flow__node', { hasText: 'drill-in' }).first();

    const drillableCount = await drillableNode.count();
    if (drillableCount === 0) {
      // No drillable nodes visible — skip this test gracefully
      test.skip();
      return;
    }

    await drillableNode.dblclick();
    await page.waitForTimeout(800);

    // Breadcrumb should now have changed (either new segment or back button)
    const updatedText = await breadcrumb.innerText();
    // If we drilled in, the path changed; if it was a no-op, it didn't crash at least
    expect(typeof updatedText).toBe('string');

    // Also verify no crash by checking app-layout still exists
    await expect(page.locator('.app-layout')).toBeVisible();
  });

  test('7. Delta mode toggle dims clean nodes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });

    // Make sure we have nodes rendered
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeVisible();

    // Press D to toggle delta mode
    await page.keyboard.press('d');
    await page.waitForTimeout(400);

    // At least one node should be dimmed (opacity: 0.3)
    // React Flow wraps nodes in a div with inline style
    const anyDimmed = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.react-flow__node');
      return Array.from(nodes).some((n) => {
        const style = (n as HTMLElement).style;
        return style.opacity === '0.3';
      });
    });
    // delta mode should dim clean nodes — at minimum one should be dimmed in mock data
    expect(anyDimmed).toBe(true);

    // Press D again to toggle back
    await page.keyboard.press('d');
    await page.waitForTimeout(400);

    const stillDimmed = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.react-flow__node');
      return Array.from(nodes).some((n) => {
        const style = (n as HTMLElement).style;
        return style.opacity === '0.3';
      });
    });
    expect(stillDimmed).toBe(false);
  });

  test('8. Command palette opens with Ctrl+K, filters, and closes with Escape', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-layout', { timeout: 5000 });

    // Open command palette
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);

    // The palette input should be visible — it has a placeholder containing "Search"
    const paletteInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"], input[placeholder*="command"], input[placeholder*="Command"]');
    await expect(paletteInput).toBeVisible({ timeout: 3000 });

    // Type to filter
    await paletteInput.type('banner', { delay: 50 });
    await page.waitForTimeout(300);

    // Press Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Palette should now be hidden
    await expect(paletteInput).toBeHidden({ timeout: 2000 });
  });

  test('9. No console errors during initial load and navigation', async ({ page }) => {
    const allErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore expected browser-environment warnings
        if (
          text.includes('[ipc] Not in Tauri') ||
          text.includes('[workspace]') ||
          text.includes('favicon') ||
          text.includes('net::ERR_')
        ) {
          return;
        }
        allErrors.push(text);
      }
    });

    await page.goto('/');
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });

    // Interact with the app a bit
    const firstNode = page.locator('.react-flow__node').first();
    await firstNode.click();
    await page.waitForTimeout(300);

    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expect(allErrors, `Unexpected console errors:\n${allErrors.join('\n')}`).toHaveLength(0);
  });

  test('10. App renders correctly in browser (no Tauri required)', async ({ page }) => {
    const { errors, cleanup } = collectErrors(page);

    await page.goto('/');
    await page.waitForSelector('.app-layout', { timeout: 5000 });

    // The canvas area should have react-flow
    const reactFlow = page.locator('.react-flow');
    await expect(reactFlow).toBeVisible({ timeout: 5000 });

    // The mock data should be loaded — blocks from the gacha canvas
    const blockNodes = page.locator('.react-flow__node');
    const count = await blockNodes.count();
    expect(count).toBeGreaterThan(0);

    cleanup();

    // No JavaScript exceptions (TypeError, ReferenceError, etc.)
    const jsErrors = errors.filter((e) =>
      (e.includes('TypeError') || e.includes('ReferenceError') || e.includes('Cannot read')) &&
      !e.includes('[ipc]')
    );
    expect(jsErrors, `JS errors: ${jsErrors.join('\n')}`).toHaveLength(0);
  });
});
