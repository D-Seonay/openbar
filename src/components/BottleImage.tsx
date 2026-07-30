"use client";

import { useState, useMemo } from "react";
import type { Bottle } from "@/lib/types";
import BottlePreview from "@/app/stock/BottlePreview";
import { getBaseApiUrl } from "@/lib/api";

export default function BottleImage({ bottle }: { bottle: Bottle }) {
  const [hasError, setHasError] = useState(false);

  const finalUrl = useMemo(() => {
    if (!bottle?.imageUrl) return null;

    if (bottle.imageUrl.startsWith("http://") || bottle.imageUrl.startsWith("https://")) {
      return bottle.imageUrl;
    }

    const cleanPath = bottle.imageUrl.startsWith("/") ? bottle.imageUrl : `/${bottle.imageUrl}`;

    return `${getBaseApiUrl()}${cleanPath}`;
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
