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
      className="tap-target inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-rule text-[13px] text-ink-soft font-medium hover:border-terracotta hover:text-terracotta transition-colors cursor-pointer"
    >
      📲 Partager
    </button>
  );
}
