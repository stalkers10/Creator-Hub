# Contributing

## Workflow

1. Pick or create an issue (use the Feature template; mention the module and the FR numbers).
2. Create a branch from an up-to-date `main`:
   `feature/<module>-<short-description>`, `fix/<short-description>` or `docs/<short-description>`
   (example: `feature/usage-heartbeat`).
3. Commit often with clear messages in the form `type(scope): message`, for example
   `feat(usage): add heartbeat endpoint`, `fix(auth): reject suspended users`, `docs: update README`.
   Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
4. Before pushing, run:
   ```bash
   npm run format && npm run lint && npm run typecheck && npm test
   ```
5. Open a pull request to `main` using the template. Keep it small and focused on one feature.
   At least one teammate reviews it. Do not push directly to `main`.

On GitHub, protect `main` (Settings, Branches): require a pull request and the CI check to pass.

## Adding or changing an API endpoint

1. Work in the module folder `apps/api/src/modules/<module>` (copy the structure of `auth`).
2. Validate input with a Zod schema in `<module>.schemas.ts` and the `validate` middleware.
3. Put business rules and database queries in `<module>.service.ts`, not in the controller.
4. Throw `AppError` helpers from `src/lib/errors.ts`. Never send raw errors to the client.
5. Replace the `todo(...)` placeholder in the routes file with your controller.
6. Add a test in `<module>.test.ts`. If the response shape is used by the app, add the type to `packages/shared`.

## Database changes

1. Edit the schema in `apps/api/src/db/schema`.
2. Run `npm run db:generate -- --name <what-changed>` and commit the generated SQL in `apps/api/drizzle`.
3. Run `npm run db:migrate` locally.
4. Never edit a migration that is already on `main`. If two branches both added migrations, regenerate yours after merging `main`.

## Configuration and secrets

- Never commit `.env` files or keys. Only the `.env.example` files are committed.
- A new environment variable must be added to the matching `.env.example` and, for the API,
  to the Zod schema in `apps/api/src/config/env.ts`.
- Values such as plan prices, durations and the free daily time are configuration, not constants in the code.

## Code style

- TypeScript strict mode. Prefer explicit types on exported functions.
- Formatting is automatic (Prettier): run `npm run format`.
- Mobile: screens go in `src/app` and stay thin; put logic and components in `src/features/<feature>`.
- Passwords are only ever stored as hashes. Never log tokens, passwords or payment details.

## Using the shared package

Types and constants used by both the API and the app live in `packages/shared`. After changing it, run
`npm run build` (or keep `npm run dev:shared` running) so the other packages see the change.
