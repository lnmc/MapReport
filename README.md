# MapReport

## Current implementation: Slice 1

The deployable map shell is implemented. It shows Zagreb with the Ride-derived 43-layer vector basemap and its existing R2 PMTiles source. Terrain is disabled. Report submission and storage begin in later slices.

```sh
npm ci
npm run dev       # Vite at http://localhost:5173; Worker at http://localhost:8787
npm test
npm run build
npm run deploy    # requires Cloudflare authentication
```

Requires Node.js 22+. See [DEPLOYMENT.md](DEPLOYMENT.md) for the Cloudflare, R2, and future Neon steps, including the required PMTiles range and CORS checks.

The current source layout is small by design:

| Path | Purpose |
| --- | --- |
| `src/` | React map UI and product-specific copy |
| `worker/` | Hono routes, public configuration, and the copied Ride basemap JSON |
| `shared/` | API configuration type shared by browser and Worker |
| `tests/` | Slice 1 API and map configuration tests |
| `plans/` | Roadmap and source MapLibre reference |

The browser fetches `/config` from the same origin, and MapLibre fetches PMTiles from R2 directly. The Worker does not proxy map tiles. `GET /health` and `GET /config` are the only API routes in this slice. The public vector archive URL can be overridden with `MAP_PMTILES_URL` in the Worker environment. No Neon or Hyperdrive configuration is needed yet.

---

MapReport is a lightweight, location-based reporting application for collecting simple user reports on a map.

The core interaction is intentionally minimal:

1. A user opens a map.
2. The user selects a location.
3. The user submits a rating from 1 to 5.
4. Recent reports are visualized geographically.

MapReport is designed to be slightly generic from the beginning, but it is **not intended to become a framework or multi-tenant platform**.

Its purpose is to provide a small, deployable product that can be quickly adapted to different location-based reporting use cases.

The first deployed use case is:

> **Where It Smells**

In that product, a MapReport rating of 1–5 represents perceived smell intensity.

The smell-specific meaning belongs in the frontend presentation layer. The backend and persistence model remain generic.

---

# Product Philosophy

MapReport exists to support rapid reaction to real-world signals.

Examples of possible future adaptations include:

- smell intensity
- noise intensity
- flooding
- crowding
- traffic disruption
- availability of a local resource
- local incidents
- temporary event reporting

These are examples, not requirements.

MapReport should not be generalized in anticipation of all possible future uses.

The guiding principle is:

> Keep the core vocabulary reusable where doing so is cheap, but only generalize architecture after real reuse demonstrates the need.

---

# First Product: Where It Smells

The first product built on MapReport is a simple Zagreb smell-reporting application.

A user should be able to:

1. Open a map of Zagreb.
2. See recent reports.
3. Select a location.
4. Rate the smell intensity from 1 to 5.
5. Submit the report anonymously.
6. Immediately contribute to the shared geographic view.

Smell-specific labels, prompts and visual language belong in the frontend.

For example:

```ts
const productConfig = {
  title: "Where It Smells",
  reportPrompt: "How bad is the smell here?",
  levels: {
    1: "Barely noticeable",
    2: "Mild",
    3: "Noticeable",
    4: "Strong",
    5: "Very strong"
  }
}
```

The backend does not need to know what the rating means.

---

# Core Domain Model

The initial domain model is intentionally small.

```ts
MapReport {
  id
  latitude
  longitude
  rating: 1 | 2 | 3 | 4 | 5
  createdAt
}
```

Possible future fields should only be added when justified by a real use case.

Examples might include:

```text
category
comment
moderation status
source metadata
```

They are deliberately excluded from the initial model.

---

# Architectural Goal

Build a lightweight serverless application using the Cloudflare ecosystem, with minimal infrastructure cost and operational maintenance, while preserving practical portability of the important parts of the system.

Cloudflare and Neon are intended as the initial and likely long-term infrastructure.

There is no planned migration away from them.

However, the architecture should preserve a reasonable exit path so that moving to a conventional Node.js runtime and self-hosted PostgreSQL would mainly require replacing infrastructure adapters and deployment configuration rather than rewriting core application logic.

The goal is not theoretical cloud independence.

The goal is:

> Use managed infrastructure aggressively where it improves speed and operations, while preventing infrastructure-specific concerns from leaking unnecessarily into the core application.

---

# Initial Technology Stack

## Frontend

- React
- TypeScript
- Vite
- MapLibre GL JS
- Cloudflare Workers Static Assets

The map is the primary user interface.

MapLibre renders vector maps using the existing Protomaps / PMTiles infrastructure hosted on Cloudflare R2.

---

## Backend

- TypeScript
- Hono
- Cloudflare Workers

Hono is used as the HTTP adapter.

Application and domain logic should remain independent of Hono and Cloudflare-specific APIs wherever reasonably possible.

---

## Database

- PostgreSQL
- Neon
- PostGIS available when spatial queries justify its use

The initial schema may use plain latitude and longitude fields.

PostGIS does not need to be introduced from the first slice.

The database choice intentionally keeps the option open for later spatial functionality such as:

- bounding-box queries
- radius queries
- point-in-polygon queries
- spatial aggregation
- neighbourhood or administrative-area analysis
- nearest-neighbour queries

---

## Database Connectivity

- Cloudflare Hyperdrive

Hyperdrive is treated as an infrastructure concern.

Application code should not depend directly on Hyperdrive-specific behaviour.

---

## Maps

- MapLibre GL JS
- Protomaps / PMTiles
- Vector tiles hosted on Cloudflare R2

The application does not depend on a commercial map tile provider for its base map.

---

# High-Level Architecture

```text
┌───────────────────────────────────────┐
│               Browser                 │
│                                       │
│  React + TypeScript                   │
│  MapLibre GL JS                       │
│                                       │
│  Product presentation:                │
│  "Where It Smells"                    │
└──────────────────┬────────────────────┘
                   │
                   │ HTTPS
                   ▼
┌───────────────────────────────────────┐
│           Cloudflare Worker           │
│                                       │
│  Hono HTTP Adapter                    │
│           │                           │
│           ▼                           │
│  Application / Use Cases             │
│           │                           │
│           ▼                           │
│  MapReport Domain                     │
│           │                           │
│           ▼                           │
│  Repository / Infrastructure Ports   │
└──────────────────┬────────────────────┘
                   │
                   │ Hyperdrive
                   ▼
┌───────────────────────────────────────┐
│          Neon PostgreSQL              │
│                                       │
│  Standard PostgreSQL                  │
│  Optional PostGIS                     │
└───────────────────────────────────────┘


Map tiles:

Browser
   │
   ▼
MapLibre
   │
   ▼
PMTiles / Protomaps
   │
   ▼
Cloudflare R2
```

---

# Architectural Principles

## 1. Keep product semantics in the presentation layer

The backend stores and processes MapReports.

It should not contain smell-specific concepts such as:

```text
SmellReport
OdorIntensity
SmellCategory
```

The first frontend interprets `rating` as smell intensity.

A future product may interpret the same field differently.

---

## 2. Keep business logic independent from infrastructure

Domain and application code should not depend directly on:

- Cloudflare Worker APIs
- Worker bindings
- Hyperdrive APIs
- Hono Context objects
- Neon-specific SDK behaviour

Infrastructure-specific code belongs at the edges of the system.

---

## 3. Prefer standard technologies and protocols

Prefer:

- HTTP
- TypeScript
- PostgreSQL
- SQL
- standard database drivers
- standard web APIs

Neon should behave primarily as hosted PostgreSQL.

Cloudflare should behave primarily as the runtime and deployment platform.

---

## 4. Keep the backend portable

The core application should be capable of running under:

```text
Cloudflare Workers
```

or, with a different runtime adapter:

```text
Node.js
```

This does not mean abstracting every runtime detail in advance.

Only boundaries that provide real value should be isolated.

---

## 5. Keep the database portable

Schema and queries should remain compatible with ordinary PostgreSQL wherever practical.

Moving from Neon to another PostgreSQL installation should mainly involve:

- connection configuration
- infrastructure configuration
- deployment changes

PostGIS remains compatible with this portability model because it is a PostgreSQL extension.

---

## 6. Accept useful vendor lock-in at the edges

Avoiding all vendor-specific functionality would create unnecessary complexity.

Cloudflare-specific functionality is acceptable where it significantly improves:

- deployment
- connectivity
- caching
- operational simplicity
- infrastructure cost

The important constraint is that such dependencies should not unnecessarily spread into domain or application logic.

---

## 7. Avoid premature framework design

MapReport is a flexible product, not a generic geo-reporting framework.

Do not introduce concepts such as:

- tenants
- arbitrary report types
- dynamic schemas
- plugin systems
- configurable workflows
- generic form engines

unless real use cases require them.

Guiding principle:

> Generic vocabulary is cheap. Generic architecture is not.

---

## 8. Optimize for adaptation

A new use case should ideally be created by changing:

- frontend copy
- frontend styling
- rating labels
- default location
- visualization choices
- limited configuration

rather than rewriting the backend.

This is adaptation, not framework extensibility.

---

## 9. Optimize for deployability

A clean repository checkout should be deployable with minimal configuration.

Deployment complexity should remain proportional to the size of the application.

MapReport is intended to support rapid experiments.

---

## 10. Production-aware, not production-perfect

The application should be safe enough to expose publicly without introducing unnecessary enterprise complexity.

Important concerns include:

- input validation
- abuse protection
- error handling
- logging
- data retention
- observability
- safe configuration
- reproducible deployment

Complex infrastructure should only be introduced when justified by a real problem.

---

# Time as a First-Class Concept

MapReports represent observations that may lose relevance quickly.

The initial frontend will support time windows such as:

- last 30 minutes
- last 1 hour
- last 3 hours
- last 12 hours

The first product uses this to show the current geographic distribution of smell reports.

Long-term retention and analytics may be handled separately from the current-map view.

---

# Initial API Shape

The API is intentionally small.

```text
GET  /health
GET  /config

POST /reports
GET  /reports
```

`/config` may expose public runtime configuration such as:

- map style URL
- default centre
- default zoom
- allowed geographic bounds
- supported time windows

No secrets should ever be exposed through this endpoint.

---

# Security and Abuse Model

The initial product is anonymous by design.

Anonymous access reduces friction but creates abuse risk.

Initial controls should include:

- server-side validation
- geographic bounds validation
- rate limiting
- payload size limits
- safe error responses
- basic logging

More sophisticated abuse detection should only be introduced when real usage justifies it.

---

# What This Project Is Also For

MapReport is both a small product and an engineering exercise.

It should help develop three capabilities.

## Rapid execution

Move from a real-world signal to a deployed application quickly.

## AI-native development

Use coding agents aggressively for implementation while retaining human ownership of:

- architecture
- behaviour
- risks
- code review
- production decisions

## Senior engineering judgement

For every implementation slice, understand:

- how requests flow through the system
- where state lives
- what can fail
- what the security boundaries are
- what assumptions were introduced
- what would need to change under significantly higher traffic

The objective is not merely to make MapReport work.

The objective is to make it work quickly while remaining able to explain, operate and adapt the system.
