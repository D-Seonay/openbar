"use client";

import type { Bottle } from "@/lib/types";
import { Sheet } from "@/components/ui";
import EditBottleDetails from "./EditBottleDetails";

interface EditionSheetProps {
  bouteille: Bottle | null;
  ouvert: boolean;
  canSeeVip: boolean;
  onFermer: () => void;
}

export default function EditionSheet({ bouteille, ouvert, canSeeVip, onFermer }: EditionSheetProps) {
  return (
    <Sheet ouvert={ouvert && bouteille !== null} titre="Modifier la fiche" onFermer={onFermer}>
      {bouteille && (
        // Keyed on the bottle so switching selection loads the new bottle's
        // values instead of leaving the previous edit half-applied.
        <EditBottleDetails key={bouteille.id} bottle={bouteille} canSeeVip={canSeeVip} onFermer={onFermer} />
      )}
    </Sheet>
  );
}
