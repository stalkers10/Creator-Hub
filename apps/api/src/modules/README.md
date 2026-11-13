# API modules

One folder per module of the specification. Every module exports a router named `<name>Routes`
from `<name>.routes.ts`, and `src/routes.ts` mounts it.

## Layout of a module

| File                   | Responsibility                                                     |
| ---------------------- | ------------------------------------------------------------------ |
| `<name>.routes.ts`     | URL paths, middleware (auth, validation), maps paths to controller |
| `<name>.schemas.ts`    | Zod schemas that validate input                                    |
| `<name>.controller.ts` | Reads the request, calls the service, sends the response           |
| `<name>.service.ts`    | Business rules and database queries (no `req` / `res` here)        |
| `<name>.test.ts`       | Tests                                                              |

`auth` and `users` are working examples: copy their structure.

## Status

| Module          | Status      | Spec requirements        |
| --------------- | ----------- | ------------------------ |
| `auth`          | working     | FR1, FR2, FR6            |
| `users`         | partly done | FR3, FR5 (todo)          |
| `creators`      | stub        | FR7, FR10, FR12          |
| `posts`         | stub        | FR8, FR9                 |
| `media`         | stub        | FR8 (Cloudinary)         |
| `feed`          | stub        | FR13                     |
| `usage`         | stub        | FR14 to FR21             |
| `subscriptions` | stub        | FR22 to FR29             |
| `payments`      | stub        | FR30 to FR34             |
| `social`        | stub        | FR11, FR35 to FR38, FR40 |
| `notifications` | stub        | FR39                     |
| `admin`         | stub        | FR41 to FR43             |

Stub endpoints answer `501 NOT_IMPLEMENTED` through the `todo(...)` helper in `src/lib`.
Replace `todo(...)` with a real controller when you implement an endpoint.
