# compass-api

Backend for **Compass** — a furniture & home marketplace: stores (AGENT) sell new furniture, members (USER) share
Room Tours with product pins and sell up to 5 used items, ADMIN moderates.

NestJS 10 monorepo · GraphQL (Apollo, code-first) · MongoDB (Mongoose) · JWT · WebSocket (`ws`).

## Apps

| App | Entry | What it does |
|---|---|---|
| `compass-api` | `apps/compass-api/src/main.ts` | GraphQL API on `/graphql`, image uploads on `/uploads`, live chat WebSocket on the same port |
| `compass-batch` | `apps/compass-batch/src/main.ts` | Hourly ranking jobs: rollback → top stores → top products → Room Tours of the week |

## Structure (compass-api)

```
src/
  components/      one folder per domain: module, resolver, service
                   auth · member · product · board-article (community + Room Tours) · comment
                   like · view · follow · my-room · notice · notification
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
npm run test:e2e           # includes the live chat gateway e2e suite
```

## Deploy

```bash
npm ci
npm run build                     # builds both apps into dist/
npm run start:prod                # NODE_ENV=production node dist/apps/compass-api/main
npm run start:prod:batch          # NODE_ENV=production node dist/apps/compass-batch/main
```

- Run each app under a process manager (e.g. `pm2 start npm --name compass-api -- run start:prod`).
- `uploads/` holds user images on disk: keep it on a persistent volume and back it up.
- Behind a reverse proxy, forward WebSocket upgrades on the API port (the chat uses the same port as GraphQL).
