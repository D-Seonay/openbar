# Quick Share Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "📲 Partager" button next to each soirée's "Copier le lien" button on `/soirees`, using the browser's native Web Share API so Discord, Instagram, WhatsApp, and anything else installed on the user's phone show up as share targets.

**Architecture:** One new client component (`ShareButton.tsx`) that feature-detects `navigator.share` on mount and renders nothing where it's unavailable (desktop browsers); rendered directly next to the existing `CopyLink` component on each event row in `/soirees/page.tsx`.

**Tech Stack:** Next.js 16 App Router (`src/`), Web Share API (browser built-in, no new dependency). No backend changes. No frontend test framework in this project — verified via `tsc --noEmit` and manual/live checks.

## Global Constraints

- No per-network buttons (WhatsApp/Twitter/Facebook links) — the Web Share API covers Discord/Instagram plus everything else installed, in one control. Full reasoning: `docs/superpowers/specs/2026-07-28-share-button-design.md`.
- On desktop (`navigator.share` unavailable), the button renders nothing — `CopyLink` already sits in the same row and covers that case.
- Visual style must match the existing `CopyLink` button exactly: same classes, same size, so the two sit naturally side by side.
- Full spec: `docs/superpowers/specs/2026-07-28-share-button-design.md`.

---

### Task 1: `ShareButton` component + wiring into `/soirees`

**Files:**
- Create: `src/app/soirees/ShareButton.tsx`
- Modify: `src/app/soirees/page.tsx:102` (the row where `CopyLink` is rendered)

**Interfaces:**
- Consumes: nothing from other tasks — this is a self-contained component using only browser APIs.
- Produces: `<ShareButton path={string} title={string} />` — no other file needs to know more than that.

- [ ] **Step 1: Create the component**

Create `src/app/soirees/ShareButton.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

export default function ShareButton({ path, title }: { path: string; title: string }) {
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  if (!canShare) return null;

  async function share() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.share({ title, text: `Rejoins-moi pour ${title} !`, url });
    } catch {
      // User cancelled the native share sheet, or it failed silently —
      // same "ignore" behavior as the existing CopyLink component.
    }
  }

  return (
    <button
      onClick={share}
      className="text-xs px-2 py-1 rounded-md border border-brick-light/60 text-muted hover:border-gold hover:text-gold transition-colors"
    >
      📲 Partager
    </button>
  );
}
```

- [ ] **Step 2: Wire it into the soirées list**

In `src/app/soirees/page.tsx`, add the import at the top (alongside the
existing `CopyLink`/`DeleteEventButton` imports):

```tsx
import ShareButton from "./ShareButton";
```

Then change the row (currently):

```tsx
                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-0 border-orange/5 pt-2 sm:pt-0 shrink-0">
                    <CopyLink path={`/soirees/${event.slug}`} />
                    <DeleteEventButton slug={event.slug} name={event.name} />
                  </div>
```

to:

```tsx
                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-0 border-orange/5 pt-2 sm:pt-0 shrink-0">
                    <CopyLink path={`/soirees/${event.slug}`} />
                    <ShareButton path={`/soirees/${event.slug}`} title={event.name} />
                    <DeleteEventButton slug={event.slug} name={event.name} />
                  </div>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit -p .
```

Expected: no errors. (`navigator.share` is typed by the `"dom"` lib already
included in `tsconfig.json` — no new type declarations needed.)

- [ ] **Step 4: Manual verification**

With the web dev server running:

1. On a desktop browser, visit `/soirees` (as a bar owner with at least one
   event created). Confirm only "Copier le lien" and the delete button show
   — no "📲 Partager" button (since `navigator.share` doesn't exist there).
2. If you have access to a mobile device or a mobile browser emulation mode
   with Web Share API support (e.g. a real phone, since most desktop
   dev-tools device emulation does NOT actually implement `navigator.share`
   — check for the button appearing at all before trying to click it): visit
   the same page, confirm "📲 Partager" appears next to "Copier le lien",
   and tapping it opens the native share sheet with the event name and link
   pre-filled, listing whatever apps are installed (Discord, Instagram,
   WhatsApp, Messages, Mail, etc. — whichever the test device has).
3. If no mobile device/environment with real Web Share API support is
   reachable, note that explicitly instead of silently skipping this step —
   the desktop "button doesn't appear" check (point 1) is still fully
   verifiable and should be done regardless.

- [ ] **Step 5: Commit**

```bash
git add src/app/soirees/ShareButton.tsx src/app/soirees/page.tsx
git commit -m "feat(web): add quick-share button for soirée invite links"
```
