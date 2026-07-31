"use client";

import { useTransition } from "react";
import { deleteEventAction } from "@/app/actions";

interface DeleteEventButtonProps {
  slug: string;
  name: string;
}

export default function DeleteEventButton({ slug, name }: DeleteEventButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (confirm(`Supprimer définitivement la soirée "${name}" ?\nCette action supprimera également toutes les contributions des invités.`)) {
      startTransition(async () => {
        await deleteEventAction(slug);
      });
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="tap-target-sm flex items-center whitespace-nowrap text-xs text-muted/65 hover:text-red-400 font-medium transition-colors px-2 py-1.5 rounded disabled:opacity-50 cursor-pointer"
    >
      {isPending ? "Suppression..." : "Supprimer"}
    </button>
  );
}
