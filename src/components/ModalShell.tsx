"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

export interface ModalShellProps {
  isOpen: boolean;
  /** Dismiss on backdrop click and on Escape. Omit for a modal that must be answered. */
  onDismiss?: () => void;
  /** Colours the icon badge and the panel border. */
  accent: "danger" | "warning" | "success" | "info";
  icon: string;
  title: string;
  description?: string;
  /** Buttons, rendered right-aligned on desktop and stacked on a phone. */
  children: React.ReactNode;
}

const ACCENTS: Record<ModalShellProps["accent"], { panel: string; badge: string }> = {
  danger: {
    panel: "border-terracotta/30",
    badge: "bg-terracotta/15 border-terracotta/30 text-terracotta",
  },
  warning: {
    panel: "border-warn/30",
    badge: "bg-warn/15 border-warn/30 text-warn",
  },
  success: {
    panel: "border-done/30",
    badge: "bg-done/15 border-done/30 text-done",
  },
  info: {
    panel: "border-rule",
    badge: "bg-paper-sunk border-rule text-ink",
  },
};

/**
 * The chrome shared by every dialog: backdrop, animation, portal, Escape.
 *
 * Portaled to <body> because callers render inside `<main class="relative
 * z-10">`, which is a stacking context — an overlay inside it can never rise
 * above the z-50 sticky header no matter its z-index. Escaping to <body> is
 * what makes it cover the screen, which matters most on phones where the panel
 * is full-width.
 */
export default function ModalShell({
  isOpen,
  onDismiss,
  accent,
  icon,
  title,
  description,
  children,
}: ModalShellProps) {
  // Escape closes, and the page behind must not scroll under the user's finger.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss?.();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onDismiss]);

  if (!isOpen || typeof document === "undefined") return null;

  const tone = ACCENTS[accent];

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onDismiss}
        className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-paper/90"
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-md bg-paper border ${tone.panel} rounded-2xl p-5 sm:p-7 shadow-2xl space-y-5`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-11 h-11 rounded-xl border flex items-center justify-center text-xl shrink-0 ${tone.badge}`}
            >
              {icon}
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-lg sm:text-xl font-bold text-ink">{title}</h3>
              {description && (
                // `whitespace-pre-line` so callers can keep the line breaks the
                // old `confirm()` strings relied on.
                <p className="text-[13px] text-ink-soft mt-0.5 break-words whitespace-pre-line">
                  {description}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 sm:gap-3 pt-3 border-t border-rule">
            {children}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
