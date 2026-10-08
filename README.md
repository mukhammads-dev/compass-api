# compass-api

Backend for **Compass** — a furniture & home marketplace: stores (AGENT) sell new furniture, members (USER) share
Room Tours with product pins and sell up to 5 used items, ADMIN moderates.

NestJS 10 monorepo · GraphQL (Apollo, code-first) · MongoDB (Mongoose) · JWT · WebSocket (`ws`) ·
ONNX Runtime (Compass Lens, computer vision on CPU).

## Apps

| App | Entry | What it does |
|---|---|---|
| `compass-api` | `apps/compass-api/src/main.ts` | GraphQL API on `/graphql`, image uploads on `/uploads`, live chat WebSocket on the same port |
| `compass-batch` | `apps/compass-batch/src/main.ts` | Hourly ranking jobs: rollback → top stores → top products → Room Tours of the week; nightly Lens photo cleanup |

## Structure (compass-api)

```
src/
  components/      one folder per domain: module, resolver, service
                   auth · member · product · board-article (community + Room Tours) · comment
                   like · view · follow · my-room · notice · notification · lens (photo search)
  libs/
    dto/           GraphQL input / output types per domain
    enums/         shared enums
    types/         common types, vendor typings
    interceptor/   request / response logging (passwords masked)
    config.ts      business limits, sort whitelists, Mongo lookups, helpers
  schemas/         Mongoose models
  socket/          live chat gateway (JWT from ?token=, history, presence, flood guard, heartbeat)
  database/        Mongo connection (MONGO_DEV / MONGO_PROD by NODE_ENV)
```

## Compass Lens

Upload any room photo → Compass finds the furniture and decor in it and the closest products in the catalog.
Everything runs inside the API process on CPU (no GPU, no external AI service).

```
photo ──► detector.onnx ──► boxes + labels (sofa, rug, floor lamp … 24 labels)
              │
              └─ each box cropped ──► embedder.onnx ──► 1280-d vector ──► nearest products
                                                                         (same label first, then same product type)
```

| Part | File |
|---|---|
| Models (ONNX, in the repo) | `models/lens/detector.onnx` (YOLOE-11s, open vocabulary, labels baked in) · `models/lens/embedder.onnx` (YOLO11s-cls backbone) |
| Re-export the models | `models/lens/export.py` (only when the label list changes) |
| Inference | `components/lens/vision.service.ts` (onnxruntime-node + sharp) |
| Product index | `components/lens/lens.service.ts`, vectors in the `productVectors` collection |
| Ranking | `components/lens/lens.matcher.ts` (unit tested) |

- A product's vector is made from its first image, cropped to the main object; its label comes from the title, or
  from the detector when the title does not say. New products and changed first images are picked up within a minute.
- `lensSearch(file)` stores the photo (re-encoded, EXIF removed) in `uploads/lens/`, `lensRegion(input)` searches a
  spot the member tapped on it. The batch app deletes these photos after 24 hours.
- At most 2 searches run the models at once; a search takes ~0.3 s on a laptop CPU.

## Environment (`.env`, not committed)

| Variable | Example | |
|---|---|---|
| `PORT_API` | `3007` | API + WebSocket port |
| `PORT_BATCH` | `3008` | batch app port |
| `MONGO_DEV` | `mongodb+srv://…/compass` | used when `NODE_ENV` is not `production` |
| `MONGO_PROD` | `mongodb+srv://…/compass` | used with `NODE_ENV=production` |
| `SECRET_TOKEN` | long random string | JWT signing secret |

## Run

```bash
npm install
npm run start:dev          # API, watch mode
npm run start:dev:batch    # batch, watch mode
```

GraphQL playground: `http://localhost:<PORT_API>/graphql` (disabled in production).

## Test & lint

```bash
npm run lint
npm test                   # unit tests (Lens ranking)
npm run test:e2e           # live chat gateway suite + app suite (app suite needs MONGO_DEV reachable)
```

## Deploy

```bash
ONNXRUNTIME_NODE_INSTALL=skip npm ci   # Linux: skips the optional CUDA download, the CPU runtime is bundled
npm run build                     # builds compass-api and compass-batch into dist/apps/
npm run start:prod                # NODE_ENV=production node dist/apps/compass-api/main
npm run start:prod:batch          # NODE_ENV=production node dist/apps/compass-batch/main
```

- Run each app under a process manager (e.g. `pm2 start npm --name compass-api -- run start:prod`).
- `uploads/` holds user images on disk: keep it on a persistent volume and back it up.
- Deploy `models/lens/` next to `dist/` (the API reads it relative to the working directory). Without it the API
  still runs and photo search answers "not available".
- Behind a reverse proxy, forward WebSocket upgrades on the API port (the chat uses the same port as GraphQL).
