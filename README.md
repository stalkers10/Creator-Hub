# Content Platform

A mobile platform where every user can watch and publish content (video, image and text posts).
Non-subscribers get a limited amount of free viewing time each day; a paid subscription, paid by
mobile money through Campay, unlocks unlimited access.

> School project, Institut Universitaire Saint Jean, academic year 2026-2027.
> Specification: [`docs/specification`](docs/specification). Architecture: [`docs/architecture.md`](docs/architecture.md).
> The name "Content Platform" is a placeholder: rename it when the team picks the final name.

## Tech stack

| Part     | Technology                                               |
| -------- | -------------------------------------------------------- |
| Mobile   | React Native, Expo (Expo Router), TypeScript             |
| API      | Node.js, Express 5, TypeScript, Zod                      |
| Database | PostgreSQL 16, Drizzle ORM                               |
| Media    | Cloudinary                                               |
| Payments | Campay (MTN Mobile Money, Orange Money)                  |
| Tooling  | npm workspaces, ESLint, Prettier, Vitest, GitHub Actions |

## Repository layout

```
.
├── apps/
│   ├── api/                 Express API
│   │   ├── drizzle/         SQL migrations (generated, committed)
│   │   └── src/
│   │       ├── config/      environment variables
│   │       ├── db/schema/   database tables
│   │       ├── jobs/        scheduled jobs
│   │       ├── lib/         errors, JWT, logger, helpers
│   │       ├── middleware/  auth, device id, validation, quota guard, errors
│   │       └── modules/     one folder per feature (auth, posts, feed, ...)
│   └── mobile/              Expo app
│       └── src/
│           ├── app/         screens and navigation (Expo Router)
│           ├── api/         API client
│           ├── components/  shared UI
│           ├── features/    feature code (auth, feed, creators, ...)
│           ├── hooks/ lib/ theme/
├── packages/shared/         types and constants shared by API and app
├── docs/                    specification and architecture
├── docker-compose.yml       local PostgreSQL
└── .github/                 CI, PR and issue templates
```

## Getting started

Requirements: Node.js 22 (`nvm use` reads `.nvmrc`), Docker, Git, and Expo Go on a phone or an Android/iOS emulator.

```bash
# 1. Install everything (also builds packages/shared)
npm install

# 2. Create your local environment files
cp .env.example .env
cp apps/api/.env.example apps/api/.env      # set JWT_SECRET to a long random string
cp apps/mobile/.env.example apps/mobile/.env

# 3. Start PostgreSQL and create the tables
npm run db:up
npm run db:migrate

# 4. Start the API (http://localhost:4000/health) and the app, in two terminals
npm run dev:api
npm run dev:mobile
```

On a real phone, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to your computer's LAN IP
(for example `http://192.168.1.20:4000`). The Android emulator uses `http://10.0.2.2:4000`.

If you edit `packages/shared`, run `npm run dev:shared` in a third terminal (or `npm run build`)
so the API and the app see the change.

## Scripts (run from the repository root)

| Command                                | What it does                                 |
| -------------------------------------- | -------------------------------------------- |
| `npm run dev:api`                      | API with auto-reload                         |
| `npm run dev:mobile`                   | Expo dev server                              |
| `npm run dev:shared`                   | Rebuild `packages/shared` on change          |
| `npm run db:up` / `db:down`            | Start / stop local PostgreSQL                |
| `npm run db:generate -- --name <name>` | Create a migration after changing the schema |
| `npm run db:migrate`                   | Apply migrations                             |
| `npm run typecheck`                    | TypeScript check of all packages             |
| `npm run lint`                         | ESLint (API and shared)                      |
| `npm run format`                       | Prettier                                     |
| `npm test`                             | Tests                                        |
| `npm run build`                        | Build shared and API                         |

## What is already there

- Working: monorepo, CI, database schema and first migration, API base (errors, validation,
  authentication middleware), registration, login and `GET /users/me`, mobile navigation with
  placeholder screens, API client and device id.
- Everything else answers `501 NOT_IMPLEMENTED` (API) or shows a "To implement" box (mobile),
  listing the specification requirements to build.

## Work areas

Each area can be built by one person with little overlap. Put your name in the last column.

| Area                       | API modules                       | Mobile screens / features | Spec requirements | Owner |
| -------------------------- | --------------------------------- | ------------------------- | ----------------- | ----- |
| Accounts and profiles      | `auth`, `users`                   | `(auth)`, `profile`       | FR1 to FR6        |       |
| Creators, posts and media  | `creators`, `posts`, `media`      | `create`, `explore`       | FR7 to FR12       |       |
| Feed and free daily time   | `feed`, `usage`                   | `index` (feed), `paywall` | FR13 to FR21      |       |
| Subscriptions and payments | `subscriptions`, `payments`, jobs | `paywall`, `profile`      | FR22 to FR34      |       |
| Social and notifications   | `social`, `notifications`         | `notifications`           | FR35 to FR40      |       |
| Administration             | `admin`                           | admin screens (later)     | FR41 to FR43      |       |

Suggested order: posts and media, then the feed without a limit, then usage and quota, then
subscriptions and payments, then social, notifications and administration.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening your first pull request.
