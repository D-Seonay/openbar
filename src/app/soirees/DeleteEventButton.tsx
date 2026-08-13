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
        className="tap-target-sm flex items-center whitespace-nowrap text-xs text-muted/65 hover:text-red-400 font-medium transition-colors px-2 py-1.5 rounded disabled:opacity-50 cursor-pointer"
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
