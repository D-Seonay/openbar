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
      className="tap-target-sm flex items-center whitespace-nowrap text-xs px-2.5 py-1.5 rounded-md border border-brick-light/60 text-muted hover:border-gold hover:text-gold transition-colors cursor-pointer"
    >
      {copied ? "Copié !" : "Copier le lien"}
    </button>
  );
}
