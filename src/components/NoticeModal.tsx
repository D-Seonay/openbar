"use client";

import ModalShell from "./ModalShell";

export interface Notice {
  accent: "danger" | "warning" | "success" | "info";
  icon: string;
  title: string;
  description?: string;
}

/**
 * Replaces `alert()`: one message, one way out.
 *
 * A native alert blocks the whole page, cannot be styled, and on a phone it
 * renders as a system sheet naming the site — which reads like a browser
 * warning rather than a message from the app.
 */
export default function NoticeModal({
  notice,
  onClose,
}: {
  notice: Notice | null;
  onClose: () => void;
}) {
  return (
    <ModalShell
      isOpen={notice !== null}
      onDismiss={onClose}
      accent={notice?.accent ?? "info"}
      icon={notice?.icon ?? "ℹ️"}
      title={notice?.title ?? ""}
      description={notice?.description}
    >
      <button
        onClick={onClose}
        autoFocus
        className="tap-target flex items-center justify-center px-5 py-2 text-xs font-bold rounded-xl bg-orange text-ink hover:bg-orange-hover transition-colors cursor-pointer"
      >
        OK
      </button>
    </ModalShell>
  );
}
