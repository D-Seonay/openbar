"use client";

import { useState } from "react";

export default function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={copy}
      className="text-xs px-2 py-1 rounded-md border border-brick-light/60 text-muted hover:border-gold hover:text-gold transition-colors"
    >
      {copied ? "Copié !" : "Copier le lien"}
    </button>
  );
}
