import { describe, expect, it, vi } from 'vitest';

/**
 * TEST 9 — email verification callback. The real bug (see brokerAuth.ts) was that signUpBroker
 * never told Supabase where to send a broker back after clicking the confirmation link, so
 * Supabase fell back to the project's Site URL — frequently an unreachable placeholder — and a
 * successful signup looked like a broken app. This test locks in the fix: signUpBroker must always
 * pass an emailRedirectTo pointing at this app's own /login route (a route that exists in the
 * router — see router.tsx — outside the authenticated shell, so it's reachable with no session).
 */
describe('TEST 9 — signUpBroker requests a redirect back to a real, reachable app route', () => {
  it('passes emailRedirectTo pointing at {origin}/login', async () => {
    const signUp = vi.fn().mockResolvedValue({ error: null });
    vi.doMock('../client', () => ({ supabase: { auth: { signUp } }, isSupabaseConfigured: true }));

    const { signUpBroker } = await import('../brokerAuth');
    const result = await signUpBroker('broker@example.com', 'password123');

    expect(result.ok).toBe(true);
    expect(signUp).toHaveBeenCalledWith({
      email: 'broker@example.com',
      password: 'password123',
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });

    vi.doUnmock('../client');
  });
});
