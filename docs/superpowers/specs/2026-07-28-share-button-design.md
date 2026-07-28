# Quick Share on Social Networks — Design

## Problem

Each soirée on `/soirees` has a "Copier le lien" button to grab its shareable
invite link, but no faster way to send it directly to a social/messaging app.

## Goal

Add a quick-share option for a soirée's invite link, specifically covering
Discord and Instagram alongside whatever else the user's phone offers
(WhatsApp, Messages, Mail, etc.).

## Why not per-network share buttons

WhatsApp and Twitter/X expose public "share intent" URLs
(`https://wa.me/?text=...`, `https://twitter.com/intent/tweet?...`) that
pre-fill a message from a plain link — no API key, no app install required.
Discord and Instagram do not: Instagram deliberately blocks arbitrary
web-based sharing into posts/stories/DMs, and Discord has no equivalent
since every user's server/channel differs. Building per-network buttons for
either would mean, at best, a link to their homepage — not an actual share.

## Chosen approach: Web Share API

The browser-native `navigator.share()` API hands off to the OS's own share
sheet (iOS/Android), which lists whatever share-capable apps are installed —
including Discord and Instagram — without any app-specific integration.

- **Availability**: only where `navigator.share` exists as a function —
  effectively mobile Safari and mobile Chrome/Android WebView. Desktop
  Chrome/Firefox/Safari do not implement it.
- **Fallback**: on desktop, render nothing. The existing "Copier le lien"
  button is already present in the same row, so there's no gap in
  functionality — just no redundant second button where the API doesn't
  apply.

## Component: `src/app/soirees/ShareButton.tsx`

New client component:

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

Feature detection happens in `useEffect` (client-only, matches the existing
`mounted`-guard pattern used elsewhere in this codebase for browser-only
APIs) rather than at render time directly, since `navigator` doesn't exist
during server-side rendering.

## Integration: `src/app/soirees/page.tsx`

Rendered directly after the existing `<CopyLink path={...} />` in each
event row, passing the same `path` plus the event's `name` as the share
title:

```tsx
<CopyLink path={`/soirees/${event.slug}`} />
<ShareButton path={`/soirees/${event.slug}`} title={event.name} />
<DeleteEventButton slug={event.slug} name={event.name} />
```

## Out of scope

- No per-network buttons (WhatsApp/Twitter/Facebook links) — superseded by
  the Web Share API covering Discord/Instagram plus everything else in one
  control.
- No backend changes — this only shares an already-public soirée link.
- No desktop fallback UI beyond the existing "Copier le lien" button.
