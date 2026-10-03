# ARTLink

ARTLink is a free music smart-link platform. Artists publish three kinds of public pages:

- **Smart Link** — a released song and its store buttons
- **Pre-Save Link** — an upcoming song, release date, and pre-save action
- **Bio Link** — an artist landing page with music, social, and custom links

ARTLink does not host full songs or music videos. Listeners are sent to the stores and profiles the artist adds. The product has no subscriptions. Administrators can run labeled banner and video advertisements.

## Stack

- TanStack Start (React 19) and Tailwind CSS
- Better Auth, with Google and X sign-in through the hosted auth broker
- Postgres (Neon when deployed). The local preview uses embedded Postgres if `DATABASE_URL` is unset
- Media is stored in the database as validated images (JPEG, PNG, WebP) or short MP4/WebM clips. Video ads can also use an HTTPS URL

## Scripts

```bash
npm run dev
npm run build
npm run typecheck
```

`npm run build` applies SQL files in `migrations/` before the production bundle is deployed.

## Environment

Do not commit secrets. Deployed hosting injects server environment variables. Names only:

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `ARTLINK_ADMIN_EMAILS` | Optional comma-separated emails that are promoted to administrator on sign-in |
| Auth client id, secret, and issuer | Injected for the Google / X broker. Never put these in client code |

`VITE_` variables are the only ones exposed to the browser. Do not prefix secrets with `VITE_`.

## Administrator

There is no default password. If `ARTLINK_ADMIN_EMAILS` is unset, the first signed-in person can claim the administrator role from Settings while no administrator exists. After that, only an administrator can promote someone else. Every admin API checks the role on the server.

## Data

Schema lives in `migrations/0001_auth.sql`, `migrations/0002_artlink.sql`, and `migrations/0003_catalog.sql`. Users can only change their own links. Public routes serve published (or due scheduled) links and accept view, click, and consented email events.
