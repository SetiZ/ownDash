# ownDash guidelines

- Frontend: vanilla JS in `src/main.js` and `src/components/`. No frameworks or libraries.
- Backend: TypeScript with Hono in `backend/src/`. Routes in `backend/src/routes/`.
- CSS: keep styles in `src/style.css`, dark theme, mobile-first responsive.
- Keep it simple — prefer plain functions over classes or abstractions.
- API: backend exposes `/api/*` endpoints returning JSON. Frontend calls them via `src/api/client.js`.
- PWA: service worker in `src/sw.js`. Cache-first for assets.
- K8s: backend uses kubectl CLI via child_process. Never add @kubernetes/client-node.
- Never add dependencies unless needed. Avoid npm packages for trivial things.
- When adding environment variables, document them in `.env.example`.
