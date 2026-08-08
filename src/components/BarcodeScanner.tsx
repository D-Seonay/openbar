"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { IScannerControls } from "@zxing/browser";
import { lookupBarcodeAction, updateBottleQuantity } from "@/app/actions";
import type { BarcodeLookupResult, LookedUpProduct } from "@/lib/types";

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

  const body = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-ink-2 border border-white/[0.1] rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-dvh overflow-y-auto overscroll-contain pb-safe"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-white/[0.08]">
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-caps text-gold font-bold block">
              Scanner
            </span>
            <h2 className="font-display text-xl font-bold text-cream mt-0.5">Code-barres</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer le scanner"
            className="w-10 h-10 shrink-0 rounded-xl bg-ink border border-white/[0.1] text-muted hover:text-cream text-lg flex items-center justify-center cursor-pointer"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* The video element stays mounted while scanning so ZXing keeps its
              reference; it is simply hidden once a code has been read. */}
          <div className={showCamera ? "block" : "hidden"}>
            <div className="relative rounded-xl overflow-hidden bg-ink border border-white/[0.08] aspect-[4/3]">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* Aiming guide — purely decorative, hence aria-hidden. */}
              <div
                aria-hidden
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="w-4/5 h-24 border-2 border-orange/80 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
            </div>
            <p className="text-xs text-muted mt-3 text-center">
              Vise le code-barres au dos de la bouteille.
            </p>
          </div>

          {phase.step === "looking-up" && (
            <div className="py-8 text-center space-y-2">
              <p className="text-2xl">⟳</p>
              <p className="text-sm text-cream font-semibold">Recherche du produit…</p>
              <p className="text-xs text-muted font-mono">{phase.barcode}</p>
            </div>
          )}

          {phase.step === "error" && (
            <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-300">
              {phase.message}
            </div>
          )}

          {result?.status === "existing" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-1">
                <span className="text-[10px] uppercase tracking-caps text-emerald-400 font-bold block">
                  Déjà en stock
                </span>
                <p className="font-display text-lg font-bold text-cream break-words">
                  {result.bottle.name}
                </p>
                <p className="text-xs text-muted capitalize">
                  {result.bottle.type} · {result.bottle.quantity} en stock
                </p>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setPendingQuantity((q) => Math.max(0, q - 1))}
                  aria-label="Retirer une bouteille"
                  className="w-12 h-12 rounded-xl bg-ink border border-white/[0.1] text-cream text-lg font-bold cursor-pointer hover:bg-white/[0.06]"
                >
                  −
                </button>
                <span className="font-display text-2xl font-bold text-orange w-24 text-center">
                  {pendingQuantity}
                </span>
                <button
                  onClick={() => setPendingQuantity((q) => q + 1)}
                  aria-label="Ajouter une bouteille"
                  className="w-12 h-12 rounded-xl bg-ink border border-white/[0.1] text-cream text-lg font-bold cursor-pointer hover:bg-orange hover:text-ink"
                >
                  +
                </button>
              </div>

              <button
                onClick={() => saveQuantity(result.bottle.id)}
                disabled={isSaving}
                className="tap-target w-full bg-orange text-ink font-extrabold rounded-xl py-3 text-xs uppercase tracking-caps cursor-pointer disabled:opacity-60"
              >
                {isSaving ? "Enregistrement…" : "Mettre à jour le stock"}
              </button>
            </div>
          )}

          {result?.status === "product" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/[0.08] bg-ink p-4 flex items-center gap-4">
                {result.product.imageUrl && (
                  <img
                    src={result.product.imageUrl}
                    alt=""
                    className="w-16 h-20 object-contain shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-caps text-gold font-bold block">
                    Produit trouvé
                  </span>
                  <p className="font-display text-base font-bold text-cream break-words mt-0.5">
                    {result.product.name}
                  </p>
                  <p className="text-xs text-muted capitalize">
                    {result.product.type}
                    {result.product.size ? ` · ${result.product.size}` : ""}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onCreate(result.barcode, result.product)}
                className="tap-target w-full bg-orange text-ink font-extrabold rounded-xl py-3 text-xs uppercase tracking-caps cursor-pointer"
              >
                Ajouter au stock
              </button>
            </div>
          )}

          {result?.status === "unknown" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/[0.08] bg-ink p-4 space-y-1">
                <span className="text-[10px] uppercase tracking-caps text-muted font-bold block">
                  Produit inconnu
                </span>
                <p className="text-xs text-muted">
                  Ce code n&apos;est ni dans ton bar ni dans la base publique. Tu peux créer la
                  bouteille à la main, le code sera enregistré avec.
                </p>
                <p className="text-xs text-cream font-mono pt-1">{result.barcode}</p>
              </div>

              <button
                onClick={() => onCreate(result.barcode, null)}
                className="tap-target w-full bg-orange text-ink font-extrabold rounded-xl py-3 text-xs uppercase tracking-caps cursor-pointer"
              >
                Créer la bouteille
              </button>
            </div>
          )}

          {(phase.step === "scanning" || phase.step === "error") && (
            <div className="pt-2 border-t border-white/[0.08] space-y-2">
              <label className="text-xs uppercase tracking-caps text-gold-dim block">
                Ou saisis le code
              </label>
              <div className="flex gap-2">
                <input
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
                  className="flex-1 min-w-0 bg-ink border border-white/[0.12] rounded-xl px-3 py-2.5 text-sm text-cream placeholder:text-muted/50 focus:outline-none focus:border-orange"
                />
                <button
                  onClick={submitManualCode}
                  className="tap-target shrink-0 px-4 rounded-xl bg-cream text-ink font-bold text-xs uppercase cursor-pointer"
                >
                  Chercher
                </button>
              </div>
            </div>
          )}

          {(phase.step === "result" || phase.step === "error") && (
            <button
              onClick={restart}
              className="tap-target w-full rounded-xl border border-white/[0.1] py-2.5 text-xs text-muted hover:text-cream uppercase tracking-caps cursor-pointer"
            >
              Scanner un autre code
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );

  // Portaled for the same reason as the stock drawer: <PageTransition> keeps an
  // inline transform, which would otherwise become the containing block for
  // this fixed overlay. Only rendered from a click, so `document` exists.
  if (typeof document === "undefined") return null;
  return createPortal(<AnimatePresence>{body}</AnimatePresence>, document.body);
}
