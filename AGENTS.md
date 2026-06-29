<!-- BEGIN:nextjs-agent-rules -->
# Next.js version note

This project runs **stock** Next.js 16 + React 19 — official upstream, not forked or
patched. These versions are newer than many models' training data, so some APIs and
conventions differ from older Next.js (for example, middleware lives in `proxy.ts`, not
`middleware.ts`). Before writing Next-specific code, confirm the current API against the
docs bundled with the package at `node_modules/next/dist/docs/` rather than relying on
memory.
<!-- END:nextjs-agent-rules -->
