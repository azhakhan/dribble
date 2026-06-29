# Dribble docs

- [Authentication & users](./authentication.md) — local (no-login) vs. hosted
  (Google sign-in) mode, how every request resolves a user, and what's private
  per user.
- [Workspace state & persistence](./workspace-state.md) — how open tabs, layout
  sizes, the expanded tree, and cached query/chat results are saved and restored
  across reloads (and browsers).
- [Database connection lifecycle](./connection-lifecycle.md) — when database
  drivers open, how they're kept warm vs. left to idle out, and how the sidebar
  reflects real connection status.
