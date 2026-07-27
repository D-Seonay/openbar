# Forced Password Change on Admin-Generated Passwords — Design

## Problem

The admin "Comptes" page (`/comptes`) already generates random temporary
passwords in two places: creating a new account (`CreateUserForm` →
`createUserAction`) and resetting an existing account's password
(`resetPasswordAction`). Nothing currently forces the account holder to
replace that temporary password — they can keep using the admin-known value
indefinitely.

## Goal

Any account whose current password was set by an admin (via account
creation or password reset) must change it before using the rest of the
app. Passwords chosen by the user themselves (public signup, or a
self-service change) never trigger this.

## Data model

Add one field to `User` (Prisma migration):

```prisma
model User {
  ...
  mustChangePassword Boolean @default(false)
}
```

## Backend changes

### `UsersService.create()`

Add an explicit `mustChangePassword?: boolean` field to the input object
(default `false`). The admin-only `POST /users` controller route
(`UsersController.create`) passes `mustChangePassword: true` explicitly.
`AuthService.signup()` calls the same `create()` method but does not pass
the flag, so public signups are unaffected.

### `UsersService.update()`

When the `password` field is present in the update payload, also set
`mustChangePassword: true` in the same `prisma.user.update` call. Since
`PATCH /users/:id` is admin-only (`@Roles('ADMIN')`), any password write
through this path is by definition an admin-generated reset.

### JWT payload / session claim

Add `mustChangePassword: boolean` to `JwtPayload` (`auth.service.ts`) and to
`SessionUser` (`src/lib/session.ts`). `issueToken()` reads the flag off the
`User` record and includes it in the signed payload, so the frontend knows
the state immediately after login without an extra request.

### New endpoint: `POST /auth/change-password`

- Guard: `JwtAuthGuard` only (any authenticated role — a user who must
  change their password is still fully authenticated, just gated on the
  frontend).
- Body: `{ currentPassword: string, newPassword: string }` (DTO with
  `@IsString()` / `@MinLength(6)` on `newPassword`, matching the existing
  `MinLength(6)` convention in `create-user.dto.ts`).
- `AuthService.changePassword(userId, currentPassword, newPassword)`:
  loads the user, `bcrypt.compare(currentPassword, user.passwordHash)` —
  throws `UnauthorizedException` on mismatch (same error shape as login).
  On success, hashes `newPassword`, updates `passwordHash` and sets
  `mustChangePassword: false` in one `prisma.user.update`, then returns a
  freshly-signed token via the existing `issueToken()` (the claim changed,
  so the old token is stale) plus the updated user summary — mirrors the
  shape already returned by `login`/`signup`.

## Frontend changes

### Enforcement: new `middleware.ts` at the project root

The app currently has no middleware — every page self-guards individually
via `getSession()`/`isAdminLoggedIn()` in the page's server component. A
global "redirect everywhere until the password is changed" rule is a
cross-cutting concern that belongs in one place rather than duplicated
across every existing and future page.

- Reads the `bardenoa_session` cookie, verifies it with the existing `jose`
  helper (`verifySessionToken`, already edge-compatible).
- If the session is valid and `mustChangePassword` is `true`, and the
  request path is not `/changer-mot-de-passe`, `/login`, or `/logout` (and
  not a static asset / `/api` route), redirect to `/changer-mot-de-passe`.
- No session, or `mustChangePassword` is `false` → no redirect; existing
  per-page guards continue to handle the "not logged in" case exactly as
  today.
- Matcher excludes `_next/*`, static files, and any public unauthenticated
  routes (`/decouvrir`, etc.) the same way they're already public today —
  the middleware only ever *adds* a redirect for the forced-change case, it
  never removes existing access.

### New page: `/changer-mot-de-passe`

- Server component guard: redirect to `/login` if not logged in (same
  pattern as every other page).
- Client form (`ChangePasswordForm`, following the existing
  `useTransition` + server-action pattern used by `AddBottleForm` /
  `CreateUserForm`): three fields — ancien mot de passe, nouveau mot de
  passe, confirmation. Client-side check that the two new-password fields
  match before submitting; server action surfaces the
  `UnauthorizedException` ("ancien mot de passe incorrect") or success.
- Server action `changePasswordAction`: calls the new API endpoint, and on
  success replaces the `bardenoa_session` cookie with the freshly-issued
  token (same `cookies().set(...)` options already used in
  `login/actions.ts`), then redirects to `/`.

## Out of scope

- No backend-side blocking of other API routes while
  `mustChangePassword` is `true`. The JWT is already fully valid — this
  feature nudges a legitimate account holder away from an admin-known
  password, it is not a security boundary against an attacker (who would
  already need the temporary password to obtain a valid JWT in the first
  place). Frontend-only redirect enforcement matches that threat model.
- The bootstrap `api/scripts/create-admin.ts` script does not go through
  `UsersService.create()` and is unaffected — the human running it chooses
  the password directly, it is never "admin-generated" for someone else.
