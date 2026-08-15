"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { lookupBarcodeAction, updateBottleQuantity } from "@/app/actions";
import type { BarcodeLookupResult, LookedUpProduct } from "@/lib/types";
import { Sheet, Button } from "@/components/ui";

type Phase =
  | { step: "scanning" }
  | { step: "looking-up"; barcode: string }
  | { step: "result"; result: BarcodeLookupResult }
  | { step: "error"; message: string };

interface BarcodeScannerProps {
  barId: string;
  onClose: () => void;
  /** Hand a resolved product (or a bare code) to the add form. */
  onCreate: (barcode: string, product: LookedUpProduct | null) => void;
}

export default function BarcodeScanner({ barId, onClose, onCreate }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  // Decoding fires continuously once a barcode is in frame; this latch keeps
  // the first hit from queuing a dozen identical lookups.
  const handledRef = useRef(false);
  const [phase, setPhase] = useState<Phase>({ step: "scanning" });
  const [manualCode, setManualCode] = useState("");
  const [pendingQuantity, setPendingQuantity] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  // Bumped by "scanner un autre code". The camera effect keys off it, since a
  // decoded result stops the stream and it has to be opened again from scratch.
  const [scanSession, setScanSession] = useState(0);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  const runLookup = useCallback(
    async (barcode: string) => {
      stopCamera();
      setPhase({ step: "looking-up", barcode });
      const result = await lookupBarcodeAction(barId, barcode);
      if ("error" in result) {
        setPhase({ step: "error", message: result.error });
        return;
      }
      if (result.status === "existing") setPendingQuantity(result.bottle.quantity);
      setPhase({ step: "result", result });
    },
    [barId, stopCamera],
  );

  // Start the camera once, when the overlay opens. ZXing is ~300 KB, so it is
  // imported here rather than at module scope: nobody who never scans pays for
  // it. The import is awaited after mount, so guard against unmounting midway.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { BrowserMultiFormatOneDReader } = await import("@zxing/browser");
        if (cancelled || !videoRef.current) return;

        const reader = new BrowserMultiFormatOneDReader();
        // `facingMode: environment` puts a phone on its rear camera, which is
        // the only one that can physically see the bottle being held up.
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current,
          (result) => {
            if (!result || handledRef.current) return;
            handledRef.current = true;
            void runLookup(result.getText());
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch {
        if (cancelled) return;
        // Permission denied, no camera, or a non-secure origin (getUserMedia is
        // unavailable outside HTTPS/localhost). Manual entry still works.
        setPhase({
          step: "error",
          message: "Caméra indisponible. Saisis le code à la main ci-dessous.",
        });
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [runLookup, stopCamera, scanSession]);

  const submitManualCode = () => {
    const trimmed = manualCode.trim();
    if (!trimmed) return;
    handledRef.current = true;
    void runLookup(trimmed);
  };

  const restart = () => {
    handledRef.current = false;
    setManualCode("");
    setPhase({ step: "scanning" });
    setScanSession((n) => n + 1);
  };

  const saveQuantity = (bottleId: string) => {
    setIsSaving(true);
    void updateBottleQuantity(bottleId, pendingQuantity).then(() => {
      setIsSaving(false);
      onClose();
    });
  };

  const showCamera = phase.step === "scanning";
  // Pulled out of `phase` so each branch below narrows on a plain const, which
  // keeps the narrowing alive inside the onClick closures.
  const result = phase.step === "result" ? phase.result : null;

  return (
    <Sheet ouvert titre="Code-barres" onFermer={onClose}>
      <div className="space-y-4">
        {/* The video element stays mounted while scanning so ZXing keeps its
            reference; it is simply hidden once a code has been read. */}
        <div className={showCamera ? "block" : "hidden"}>
          <div className="relative rounded-xl overflow-hidden bg-paper-sunk border border-rule aspect-[4/3]">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {/* Aiming guide — purely decorative, hence aria-hidden. */}
            <div
              aria-hidden
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="w-4/5 h-24 border-2 border-terracotta rounded-lg" />
            </div>
          </div>
          <p className="text-[13px] text-ink-soft mt-3 text-center">
            Vise le code-barres au dos de la bouteille.
          </p>
        </div>

        {phase.step === "looking-up" && (
          <div className="py-8 text-center space-y-2">
            <p className="text-[27px]">⟳</p>
            <p className="text-[15px] text-ink font-semibold">Recherche du produit…</p>
            <p className="text-[13px] text-ink-soft font-mono">{phase.barcode}</p>
          </div>
        )}

        {phase.step === "error" && (
          <div className="rounded-xl border border-terracotta/30 bg-paper-sunk p-4 text-[13px] text-terracotta">
            {phase.message}
          </div>
        )}

        {result?.status === "existing" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-done/35 bg-paper-sunk p-4 space-y-1">
              <span className="text-[13px] uppercase tracking-caps text-done font-bold block">
                Déjà en stock
              </span>
              <p className="font-display text-[17px] text-ink break-words">{result.bottle.name}</p>
              <p className="text-[13px] text-ink-soft capitalize">
                {result.bottle.type} · {result.bottle.quantity} en stock
              </p>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setPendingQuantity((q) => Math.max(0, q - 1))}
                aria-label="Retirer une bouteille"
                className="tap-target w-12 h-12 rounded-xl bg-paper-sunk border border-rule text-ink text-[17px] font-bold cursor-pointer hover:border-terracotta hover:text-terracotta"
              >
                −
              </button>
              <span className="font-display text-[27px] font-bold text-terracotta w-24 text-center">
                {pendingQuantity}
              </span>
              <button
                onClick={() => setPendingQuantity((q) => q + 1)}
                aria-label="Ajouter une bouteille"
                className="tap-target w-12 h-12 rounded-xl bg-paper-sunk border border-rule text-ink text-[17px] font-bold cursor-pointer hover:border-terracotta hover:text-terracotta"
              >
                +
              </button>
            </div>

            <Button pleineLargeur onClick={() => saveQuantity(result.bottle.id)} disabled={isSaving}>
              {isSaving ? "Enregistrement…" : "Mettre à jour le stock"}
            </Button>
          </div>
        )}

        {result?.status === "product" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-rule bg-paper-sunk p-4 flex items-center gap-4">
              {result.product.imageUrl && (
                <img
                  src={result.product.imageUrl}
                  alt=""
                  className="w-16 h-20 object-contain shrink-0"
                />
              )}
              <div className="min-w-0">
                <span className="text-[13px] uppercase tracking-caps text-terracotta font-bold block">
                  Produit trouvé
                </span>
                <p className="font-display text-[15px] text-ink break-words mt-0.5">
                  {result.product.name}
                </p>
                <p className="text-[13px] text-ink-soft capitalize">
                  {result.product.type}
                  {result.product.size ? ` · ${result.product.size}` : ""}
                </p>
              </div>
            </div>

            <Button pleineLargeur onClick={() => onCreate(result.barcode, result.product)}>
              Ajouter au stock
            </Button>
          </div>
        )}

        {result?.status === "unknown" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-rule bg-paper-sunk p-4 space-y-1">
              <span className="text-[13px] uppercase tracking-caps text-ink-soft font-bold block">
                Produit inconnu
              </span>
              <p className="text-[13px] text-ink-soft">
                Ce code n&apos;est ni dans ton bar ni dans la base publique. Tu peux créer la
                bouteille à la main, le code sera enregistré avec.
              </p>
              <p className="text-[13px] text-ink font-mono pt-1">{result.barcode}</p>
            </div>

            <Button pleineLargeur onClick={() => onCreate(result.barcode, null)}>
              Créer la bouteille
            </Button>
          </div>
        )}

        {(phase.step === "scanning" || phase.step === "error") && (
          <div className="pt-2 border-t border-rule space-y-2">
            <label htmlFor="scanner-manual-code" className="text-[13px] uppercase tracking-caps text-ink-soft block">
              Ou saisis le code
            </label>
            <div className="flex gap-2">
              <input
                id="scanner-manual-code"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitManualCode();
                  }
                }}
                inputMode="numeric"
                placeholder="3049197000470"
                className="flex-1 min-w-0 min-h-[44px] bg-paper-sunk border border-rule rounded-xl px-3 text-[15px] text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-terracotta"
              />
              <Button variant="discret" onClick={submitManualCode} className="shrink-0">
                Chercher
              </Button>
            </div>
          </div>
        )}

        {(phase.step === "result" || phase.step === "error") && (
          <Button variant="discret" pleineLargeur onClick={restart}>
            Scanner un autre code
          </Button>
        )}
      </div>
    </Sheet>
  );
}
