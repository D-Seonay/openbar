"use client";

import { useState, useMemo } from "react";
import type { Bottle } from "@/lib/types";
import BottlePreview from "@/app/stock/BottlePreview";

export default function BottleImage({ bottle }: { bottle: Bottle }) {
  const [hasError, setHasError] = useState(false);

  // Upload paths stay relative: `/uploads/*` is proxied to the API by the
  // rewrite in next.config.ts. Prefixing an API origin here would also break
  // the server-rendered pass, where it resolves to the internal Docker host.
  const finalUrl = useMemo(() => {
    if (!bottle?.imageUrl) return null;

    if (bottle.imageUrl.startsWith("http://") || bottle.imageUrl.startsWith("https://")) {
      return bottle.imageUrl;
    }

    return bottle.imageUrl.startsWith("/") ? bottle.imageUrl : `/${bottle.imageUrl}`;
  }, [bottle?.imageUrl]);

  if (!finalUrl || hasError) {
    return (
      <BottlePreview
        type={bottle.type}
        quantity={bottle.quantity}
        vip={bottle.vip}
      />
    );
  }

  return (
    <img
      src={finalUrl}
      alt={bottle.name}
      className="w-full h-full object-contain"
      onError={() => setHasError(true)}
    />
  );
}
