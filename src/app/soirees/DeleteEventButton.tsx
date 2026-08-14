"use client";

import { useState, useTransition } from "react";
import { deleteEventAction } from "@/app/actions";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

interface DeleteEventButtonProps {
  slug: string;
  name: string;
}

export default function DeleteEventButton({ slug, name }: DeleteEventButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsConfirming(true)}
        disabled={isPending}
        className="tap-target inline-flex items-center gap-1.5 px-2.5 rounded-lg text-[13px] text-ink-soft font-medium hover:text-terracotta transition-colors disabled:opacity-50 cursor-pointer"
      >
        {isPending ? "Suppression..." : "Supprimer"}
      </button>

      <ConfirmDeleteModal
        isOpen={isConfirming}
        title="Supprimer cette soirée ?"
        description={`« ${name} » sera supprimée définitivement, ainsi que toutes les contributions des invités.`}
        isPending={isPending}
        onCancel={() => setIsConfirming(false)}
        onConfirm={() =>
          startTransition(async () => {
            await deleteEventAction(slug);
            setIsConfirming(false);
          })
        }
      />
    </>
  );
}
