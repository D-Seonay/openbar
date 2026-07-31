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
      className="tap-target-sm flex items-center whitespace-nowrap text-xs px-2.5 py-1.5 rounded-md border border-brick-light/60 text-muted hover:border-gold hover:text-gold transition-colors cursor-pointer"
    >
      📲 Partager
    </button>
  );
}
