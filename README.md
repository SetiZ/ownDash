# ownDash

Personal dashboard to monitor work stuff while traveling: GitHub PRs/CI, K8s cluster health, Plane.so issues, weather, timezones.

## Stack

- **Frontend**: Vanilla JS + Vite (no framework)
- **Backend**: Hono + TypeScript (Node.js)
- **PWA**: Installable, service worker for offline cache

## Quick start

```bash
cp .env.example .env   # fill in your tokens
npm run dev            # starts frontend (5173) + backend (3001)
```

## Configuration

| Env var | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Yes | GitHub PAT for PRs/CI data |
| `GITHUB_REPOS` | Yes | Comma-separated `owner/repo` list |
| `PLANE_API_KEY` | No | Plane.so API key |
| `PLANE_WORKSPACE` | No | Plane.so workspace slug |
| `PLANE_EMAIL` | No | Plane.so account email |
| `K8S_CONTEXTS` | No | Comma-separated kubeconfig contexts to watch (omit for default) |

K8s data comes from your local `~/.kube/config` (or in-cluster config when deployed). Mount into Docker: `-v ~/.kube/config:/root/.kube/config`.

## Deploy

```bash
docker build -t owndash .
docker run -p 3001:3001 --env-file .env owndash
```

## PR review

This repo uses opencode for automated code review on every PR. Project conventions are in `GUIDELINES.md`. See `opencode.json`.

- `.github/workflows/review.yml` — auto-review on every PR
- `.github/workflows/opencode.yml` — slash commands: comment `/opencode <task>` on any PR or issue to have opencode execute it

## License

MIT
