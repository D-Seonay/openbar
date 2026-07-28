# Member Profiles — Design

Implements GitHub issue #19 ("améliorer les comptes : anniversaire, boisson
préférée, PP, etc").

## Problem

`User` accounts only carry `username`/`role`/`vip`/`mustChangePassword` today
— nothing personal. There's no way for a bar's members to know each other's
birthday, favorite drink, dietary restrictions, or even see a photo of who
they're inviting to a soirée.

## Goal

Four new self-service profile fields — anniversaire, boisson préférée,
allergies/restrictions, photo de profil — editable by each user for
themselves, and visible to every member of a bar they belong to (not just
the bar owner).

## Discovery that shapes this design

`/membres` — the only existing "see other people in my bar" page — is
owner-only (`if (activeBar.myRole !== "OWNER") redirect("/")`), even though
the underlying API (`GET /bars/:id/members`) only checks bar *membership*,
not ownership. Since the goal is visibility to every member, this needs a
new, separately-accessible page rather than extending `/membres` (which also
carries owner-only actions — invite, revoke, rename — that shouldn't leak to
regular members).

## Data model

Four new nullable fields on `User` (all optional — existing accounts have
none of this filled in):

```prisma
model User {
  ...
  birthday      DateTime?
  favoriteDrink String?
  allergies     String?
  avatarUrl     String?
}
```

`PUBLIC_SELECT` in `users.service.ts` gains all four fields (it already
carries `mustChangePassword` for the same reason — anything a self-service
or bar-facing read needs must flow through the safe, no-`passwordHash`
select).

## Self-service editing: `/profil`

New page, same guard pattern as `/changer-mot-de-passe`: `getSession()` →
`redirect("/login")` if absent, no role restriction (any logged-in user
edits their own profile).

### Backend: two new endpoints, both `JwtAuthGuard`-only (no role check)

- `GET /users/me` — returns the current user's own full public profile
  (`usersService.findPublicById(user.sub)`), used to pre-fill the edit form.
  A new method, not the existing internal `findById` (which returns the raw
  record including `passwordHash` for password-verification use — wrong
  shape to expose over HTTP).
- `PATCH /users/me` — updates the four profile fields via a new
  `UsersService.updateProfile(id, input)`, deliberately a separate method
  from the admin-only `update()` (which also handles `role`/`vip`/`password`)
  so a self-service caller has no path — even by accident — to touch those
  admin-controlled fields. Full-form-replace semantics: the form always
  submits all four fields, and an empty value clears that field to `null`
  (birthday parsed from the HTML date input's `YYYY-MM-DD` string, or `null`
  if empty).

**Route order**: `UsersController` currently declares `PATCH ':id'`, then
`DELETE ':id'`. The new **literal** `me` routes (`GET`, `PATCH`) must be
declared *before* those `:id` routes, or NestJS/Express would swallow
`/users/me` as `:id = "me"` — the same route-ordering rule already
established elsewhere in this codebase (`bars.controller.ts`'s
`mine`/`directory`/`search-users`/`all` all precede its final `:id` route).

### Frontend: `ProfileForm.tsx`

Same `useTransition` + local server-action pattern as `AddBottleForm`/
`ChangePasswordForm`. Fields: date input (birthday), two text inputs
(favoriteDrink, allergies), and the photo — see below.

### `ImagePicker` generalization

`ImagePicker` currently imports `uploadBottleImage` (admin-only) directly,
hardcoding it as the upload handler. It gains an `onUpload: (formData:
FormData) => Promise<string | null>` prop instead; its two existing callers
(`AddBottleForm`, `BottleDetailModal`) each import `uploadBottleImage`
themselves and pass it explicitly — behavior unchanged for them. `ProfileForm`
passes a new `uploadProfileImage` action instead — same file-writing logic as
`uploadBottleImage`, but gated to "any logged-in user" (`getSession()`
truthy) rather than `requireAdmin()`, since users upload their own photo.

## Visibility to bar members: `/annuaire`

New page, any logged-in user with an active bar (same guard as `/soirees`:
`getSession()` → login redirect, `resolveActiveBar` → `/creer` redirect if
none). Calls the existing `listBarMembers(activeBar.id)` — already
accessible to any member per the API's actual guard — and renders a
read-only roster: avatar (or initials fallback, matching `MemberRow`'s
existing initials-circle style), username, birthday shown as day + month
only (e.g. "15 août" — not the year, matching common privacy-conscious
birthday-reminder conventions even though the full date is stored),
favorite drink, and allergies if set.

`BarMember.user` (currently `{ username: string }`) expands to include the
four new fields. Backend: `MEMBER_INCLUDE` in `bars.service.ts` — a single
shared constant already used by `findMembers`, `inviteMember`, and
`updateMember` — gets its `select` extended, so all three call sites pick up
the new fields for free.

## Navigation

- `/annuaire` added to the base `NAV` array in `Navigation.tsx` (visible to
  any logged-in user, alongside Stock/Cocktails/Soirées) — every bar member
  should be able to reach it, not just owners/admins.
- `/profil` added as a new link inside `AccountMenu.tsx`'s dropdown, in the
  "Compte" section, above the existing admin-only "Gestion des comptes"
  link and above "Se déconnecter" — visible to every logged-in user
  regardless of role.

## Out of scope

- No birthday notifications/reminders (email, push, or otherwise) — the
  issue's "pour ne pas oublier" is satisfied by making birthdays visible on
  a page members can check, not by proactive alerts.
- No profile field on the public `/decouvrir` bar directory or any
  unauthenticated page — visibility is bar-members-only.
- No new field beyond the four listed — the issue's "etc" is interpreted as
  covered by "allergies/restrictions" (agreed during brainstorming) and
  nothing further.
