# Deploy MapReport on Cloudflare

This guide deploys **Slice 1**, the map shell. It serves the React app and the Hono API from one Cloudflare Worker. The browser fetches the existing PMTiles archives directly from the Ride R2 public hostname. **Neon is not used by Slice 1**; the database preparation below is for Slice 2.

## 1. Prerequisites

- Node.js 22 or newer and npm.
- A Cloudflare account with Workers enabled and permission to deploy Workers. Run `npx wrangler login` on your own machine, or configure a suitable Cloudflare API token in CI.
- Access to the existing `ridemaps.neoncore.dev` R2 public bucket settings, or an equivalent public R2 bucket with the same vector archive.
- If using a custom application domain, that domain must be on Cloudflare. The default `*.workers.dev` URL is sufficient for the first deploy.

From a clean checkout:

```sh
npm ci
npm test
npm run build
npx wrangler deploy --dry-run
```

`npm ci` uses the committed lockfile. The build creates `dist/`; Wrangler uploads it as Workers Static Assets and bundles `worker/index.ts` as the Worker entry. `wrangler.jsonc` sends `/health` and `/config` to the Worker first. Other paths are served from `dist/`, with SPA fallback to `index.html`.

## 2. Verify the map archives before deploying

The default style is derived from the expanded Ride style in [`plans/MapLibre-Ride-reference.md`](plans/MapLibre-Ride-reference.md). Its terrain source and layer are removed; the remaining 43 layers preserve their original order and expressions. It references this immutable R2 object:

| Source | Public object URL |
| --- | --- |
| Protomaps vector | `https://ridemaps.neoncore.dev/maps/regions/central-southeast-europe/20260811-v1/vector-z0-15.pmtiles` |

PMTiles needs HTTP byte range access. Check the vector URL with a small GET range request, and stop after the first 16 KiB:

```sh
curl -sS -D - -o /dev/null --max-filesize 16384 --range 0-16383 \
  'https://ridemaps.neoncore.dev/maps/regions/central-southeast-europe/20260811-v1/vector-z0-15.pmtiles'
```

Look for **`206 Partial Content`**, `Content-Range: bytes 0-16383/...`, and `Accept-Ranges: bytes`. If the server returns `200 OK` with the whole archive, stop the request and fix the R2/custom-domain range behavior before launching the map. The Ride reference records a prior `200` response to range requests, so this is a real deployment gate, not a theoretical check. Recheck from a browser and from the deployment network.

For cross-origin browser access, set the bucket CORS policy in **R2 → bucket → Settings → CORS Policy**. Merge this rule with any existing rules needed by other consumers of the shared bucket. Replace the origin with the final `https://...workers.dev` or custom app URL. Include localhost for local development. A suitable policy shape is:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "If-Match"],
    "ExposeHeaders": ["Accept-Ranges", "Content-Range", "ETag", "Content-Length"],
    "MaxAgeSeconds": 3600
  }
]
```

Check a range request with `Origin: https://YOUR-APP-ORIGIN` and verify `Access-Control-Allow-Origin` and exposed headers. If you use a custom domain and have cached older responses, purge them after changing CORS. The public map hostname should have a Cloudflare Cache Rule for `/maps/` if you want edge caching of these large, immutable archives. Do not replace an archive at an existing key: publish a new key and update the URL, because PMTiles readers cache headers by URL.

If you host a copy of the vector archive, configure its public HTTPS URL as `MAP_PMTILES_URL` in the Worker's non-secret environment variables. Use an ordinary `https://` URL; the backend adds `pmtiles://` in the returned style. The default glyph URL is external to R2: `https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf`.

## 3. Local development

```sh
npm ci
npm run dev
```

Visit `http://localhost:5173`. This command builds once, starts Wrangler on port 8787, then Vite on port 5173. Vite proxies `/health` and `/config` to Wrangler. The browser requests map archives directly from R2, so the R2 CORS policy must include `http://localhost:5173`. Frontend edits reload through Vite. For Worker changes, Wrangler watches its source; restart `npm run dev` if you edit the reference JSON or Wrangler configuration.

Optional local archive overrides can go in an untracked `.dev.vars` file:

```text
MAP_PMTILES_URL=https://example.com/vector.pmtiles
```

Check API responses:

```sh
curl http://localhost:8787/health
curl http://localhost:8787/config
```

`/config` returns the entire map style plus Zagreb center, zooms, map coverage bounds, future report bounds, supported time windows, and attribution. It contains public URLs only. Never put passwords, tokens, or private R2 endpoints in this response or in the map style.

## 4. Deploy the Worker and frontend

1. Set a unique Worker `name` in `wrangler.jsonc` if `mapreport` is already used in your Cloudflare account.
2. If the default map host is unsuitable, add public URL overrides under a `vars` object in `wrangler.jsonc`, or set them in the Cloudflare Worker settings. Keep configuration changes in the repository for reproducible deployments.
3. Run:

```sh
npm ci
npm test
npm run deploy
```

`npm run deploy` builds the assets, then runs `wrangler deploy`. Wrangler prints the deployed `workers.dev` URL. You may later attach a custom domain in Cloudflare Workers settings or with the `routes` configuration. Update the R2 CORS allowed origins when the application origin changes.

Verify the deployed URL:

```sh
curl -i 'https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/health'
curl -i 'https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/config'
```

Open the root URL in a browser. Confirm the map is centered on Zagreb, roads and labels render, zoom and pan work, and attribution stays visible. In browser developer tools, inspect network requests for the vector `.pmtiles` file: they should be range requests returning `206`, with no CORS errors. No terrain archive should be requested. `GET /config` should return the vector archive URL you intended. A `200` for `/health` alone does not prove the map works.

## 5. Prepare Neon and Hyperdrive for Slice 2

There is deliberately **no database migration, Neon credential, or Hyperdrive binding in Slice 1**. Creating these now is optional and does not change the app. When implementing Slice 2:

1. Create a Neon project and a dedicated role for the application. Select its branch, database, and role in Neon Connection Details. Choose the **direct** connection string (pooling off) for Hyperdrive, and keep the password private.
2. Run `npx wrangler hyperdrive create mapreport-db --connection-string='postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require'` on a trusted machine. Avoid saving the command in shell history or CI logs; the Cloudflare dashboard creation flow is useful if that matters in your environment.
3. Add the returned binding ID to `wrangler.jsonc` as `"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "YOUR-ID" }]`. Add the Postgres driver and repository adapter in Slice 2; only the infrastructure adapter should read `env.HYPERDRIVE.connectionString`.
4. Add a versioned SQL migration and run it against Neon with a direct migration connection. Verify a fresh database can replay all migrations before deploying the report endpoint.
5. For local Worker development, provide `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` outside source control. Add server validation, payload limits, geographic bounds, and rate limiting before enabling `POST /reports`.

Do not add the Neon URL to `/config`, Vite variables, or frontend files. Hyperdrive connects the Worker to Neon; the browser never connects to the database.

## Request path and operations

```text
Browser → Cloudflare static assets → React + MapLibre
Browser → /config and /health → Hono Worker
Browser → public R2 hostname → PMTiles range requests
Slice 2 only: Worker → Hyperdrive → Neon PostgreSQL
```

For a failed deployment, first inspect the Worker logs with `npx wrangler tail`. For a blank map, inspect `/config`, browser console, the vector PMTiles range responses, CORS headers, and the external glyph requests in that order. Archive access and CORS are managed at the R2 edge; changing the Hono API cannot repair them.

## References

- [Cloudflare Workers Static Assets configuration](https://developers.cloudflare.com/workers/wrangler/configuration/#assets)
- [Cloudflare Wrangler deployment](https://developers.cloudflare.com/workers/wrangler/commands/workers/#deploy)
- [Cloudflare R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [Cloudflare R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/)
- [Cloudflare Hyperdrive with Neon](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/neon/)
