"use client";

import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export default function ConfirmDeleteModal({
  isOpen,
  title,
  description,
  onConfirm,
  onCancel,
  isPending,
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  // Portaled to <body>: callers render inside <main class="relative z-10">,
  // which is a stacking context — a z-[60] overlay inside it can never rise
  // above the z-50 sticky header. Only escaping to <body> makes it cover the
  // screen, which matters most on phones where the modal is full-width.
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onCancel}
        className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-ink/90 backdrop-blur-xl"
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md bg-ink-2/95 border border-red-500/30 rounded-2xl p-5 sm:p-7 shadow-2xl space-y-5"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-xl text-red-400 shrink-0">
              🗑️
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-lg sm:text-xl font-bold text-cream">
                {title}
              </h3>
              <p className="text-xs text-muted mt-0.5 break-words">{description}</p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 sm:gap-3 pt-3 border-t border-white/[0.08]">
            <button
              onClick={onCancel}
              disabled={isPending}
              className="tap-target flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-cream transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="tap-target flex items-center justify-center px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/25 transition-all cursor-pointer"
            >
              {isPending ? "Suppression..." : "Confirmer la suppression"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
