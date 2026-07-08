"use client";

import { useState } from "react";

export default function ShoppingList({ items }: { items: string[] }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(items.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — clipboard access can fail silently, no fallback needed for this scale
    }
  }

  if (items.length === 0) return null;

  return (
    <button
      onClick={copy}
      className="text-xs px-3 py-1.5 rounded-md border border-brick-light/60 text-muted hover:border-gold hover:text-gold transition-colors"
    >
      {copied ? "Copié !" : "Copier la liste de courses"}
    </button>
  );
}
