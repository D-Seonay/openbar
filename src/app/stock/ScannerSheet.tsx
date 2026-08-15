"use client";

import BarcodeScanner from "@/components/BarcodeScanner";
import type { LookedUpProduct } from "@/lib/types";

interface ScannerSheetProps {
  ouvert: boolean;
  barId: string;
  onFermer: () => void;
  /** Un scan qui ne trouve rien en stock transmet le code (et ce que la base
   * produit connaît) au formulaire d'ajout — d'où le produit, pas seulement
   * le code. */
  onTrouve: (barcode: string, product: LookedUpProduct | null) => void;
}

/**
 * N'enveloppe plus `BarcodeScanner` dans sa propre `<Sheet>` : le composant
 * porte désormais lui-même la feuille (voir `src/components/BarcodeScanner.tsx`)
 * pour éviter un double cadre. Ce fichier ne fait plus qu'extraire de
 * `StockStudio` le montage conditionnel sur `isScanning`.
 */
export default function ScannerSheet({ ouvert, barId, onFermer, onTrouve }: ScannerSheetProps) {
  if (!ouvert) return null;
  return <BarcodeScanner barId={barId} onClose={onFermer} onCreate={onTrouve} />;
}
