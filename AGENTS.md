# Repository Guidelines

## Project Structure & Module Organization

`README.md` defines the product and architecture; `plans/ROADMAP.md` defines delivery slices and acceptance criteria. `src/` contains the React frontend, `worker/` contains the Hono Worker and copied Ride map style, `shared/` contains API types, and `tests/` contains Slice 1 tests. `DEPLOYMENT.md` documents Cloudflare/R2 deployment and future Neon setup. Keep frontend presentation separate from the generic MapReport backend. Put Cloudflare, Hono, Hyperdrive, and database details at infrastructure boundaries rather than in domain or application logic.

## Build, Test, and Development Commands

Use `npm ci`, `npm run dev`, `npm test`, `npm run build`, and `npm run deploy`. See `README.md` and `DEPLOYMENT.md` for details. Before publishing a slice, verify a clean checkout builds and the documented local commands run.

## Coding Style & Naming Conventions

The planned stack uses TypeScript, React, Vite, and Hono. Follow the formatter and linter configured when code is introduced; do not impose an undocumented indentation rule. Use `MapReport` and `rating` (1–5) in shared types and backend code. Keep “Where It Smells” labels and prompts in frontend presentation or product configuration. Avoid premature tenant, plugin, or dynamic schema abstractions.

## Testing Guidelines

Vitest runs with `npm test`. Add tests with each implemented slice and document how to run them. Cover the behavior in `plans/ROADMAP.md`: map and API configuration for Slice 1; coordinate and rating validation, geographic bounds, rate limiting, persistence, and migration replay for Slice 2; time-window filtering and shared visibility for Slice 3. Name tests after the behavior they verify.

## Commit & Pull Request Guidelines

The checkout has no accessible Git history, so an existing commit convention cannot be verified. Use short, imperative commit subjects that describe one change. In pull requests, identify the roadmap slice, summarize behavior and configuration changes, list the commands run, and link the relevant issue when one exists. Include screenshots for map or other visible UI changes.

## Security & Configuration

Keep secrets out of source control and out of `GET /config`. Validate anonymous submissions on the server, enforce supported geographic bounds and payload limits, and apply rate limiting before exposing `POST /reports` publicly.
