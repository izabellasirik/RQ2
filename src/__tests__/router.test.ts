import { describe, expect, it } from 'vitest';
import { router } from '../router';

describe('TEST 9 (continued) — /login is a real, reachable, unauthenticated route', () => {
  it('exists as a top-level route, not nested inside the authenticated AppShell', () => {
    const routes = router.routes;
    const topLevelPaths = routes.map((r) => r.path);
    expect(topLevelPaths).toContain('/login');
    expect(topLevelPaths).toContain('/signup');

    // Sanity check: the authenticated shell's children never include /login — a broker landing
    // there after confirming their email must not be routed through account-required UI first.
    const appShellRoute = routes.find((r) => !r.path && Array.isArray(r.children) && r.children.some((c) => c.path === '/'));
    const appShellPaths = (appShellRoute?.children ?? []).map((c) => c.path);
    expect(appShellPaths).not.toContain('/login');
  });
});
