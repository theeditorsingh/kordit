/**
 * Usernames that would clash with app routes. Board URLs are /{username}/{board}, and a
 * static route such as /workspaces/{slug} takes priority over them.
 */
export const RESERVED_USERNAMES = new Set([
  'workspaces', 'inbox', 'my-tasks', 'my_tasks', 'login', 'onboarding', 'api', 'home', 'settings',
]);

export function isReservedUsername(value: string) {
  return RESERVED_USERNAMES.has(value.trim().toLowerCase());
}
