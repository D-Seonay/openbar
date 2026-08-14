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
      className="tap-target inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-rule text-[13px] text-ink-soft font-medium hover:border-terracotta hover:text-terracotta transition-colors cursor-pointer"
    >
      {copied ? "Copié !" : "Copier le lien"}
    </button>
  );
}
