"use client";

import { useRef, useState, useTransition } from "react";
import {
  uploadEventMedia,
  addEventMediaLinkAction,
  deleteEventMediaAction,
} from "@/app/actions";
import type { EventMedia } from "@/lib/types";

export default function MediaGallery({
  slug,
  items,
  currentUserId,
  canManage,
}: {
  slug: string;
  items: EventMedia[];
  currentUserId: string;
  canManage: boolean;
}) {
  const [isUploading, startUpload] = useTransition();
  const [linkError, setLinkError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = Array.from(files);
    startUpload(async () => {
      for (const file of selected) {
        const formData = new FormData();
        formData.append("file", file);
        try {
          await uploadEventMedia(slug, formData);
        } catch {
          // Intentionally silent — the toast-less pattern used across the app.
          // A failed file simply doesn't appear; the rest still go through.
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-ink-2/80 p-5 sm:p-6 space-y-5 shadow-xl backdrop-blur-xl">
      <span className="sr-only">Galerie Photos &amp; Vidéos</span>
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📸</span>
          <h2 className="font-display text-xl font-bold text-cream">Galerie Photos & Vidéos</h2>
        </div>
        <span className="text-xs font-mono font-bold text-orange bg-orange/15 px-3 py-1 rounded-full border border-orange/30">
          {items.length} média{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Add controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="tap-target-sm flex items-center justify-center px-3.5 py-2 rounded-xl bg-orange/15 hover:bg-orange/25 border border-orange/40 text-xs text-orange font-bold uppercase tracking-wider transition-all disabled:opacity-60 cursor-pointer whitespace-nowrap"
        >
          {isUploading ? "Ajout en cours…" : "➕ Ajouter une photo / vidéo"}
        </button>

        <form
          action={async (formData) => {
            const result = await addEventMediaLinkAction(slug, formData);
            setLinkError(result && "error" in result ? result.error : null);
          }}
          className="flex flex-1 min-w-0 gap-2"
        >
          <input
            name="url"
            required
            type="url"
            placeholder="Lien Google Drive / album partagé…"
            className="flex-1 bg-ink border border-white/[0.12] rounded-xl px-3.5 py-2 text-xs placeholder:text-muted/60 focus:outline-none focus:border-orange text-cream font-medium min-w-0"
          />
          <button
            type="submit"
            className="tap-target flex items-center justify-center bg-orange text-ink font-extrabold rounded-xl px-4 py-2 text-xs hover:bg-orange-hover box-orange-glow transition-all uppercase tracking-wider cursor-pointer"
          >
            Partager
          </button>
        </form>
      </div>
      {linkError && <p className="text-[11px] text-red-400">{linkError}</p>}

      {items.length === 0 ? (
        <div className="text-center py-10 rounded-xl bg-ink/40 border border-white/[0.05]">
          <p className="text-3xl mb-2">🎥</p>
          <p className="text-muted text-xs italic">
            Partagez les photos et vidéos de la soirée, ou un lien Google Drive vers un album commun.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((media) => {
            const canDelete = canManage || media.uploader?.id === currentUserId;
            const isImage = media.mimeType?.startsWith("image/");
            return (
              <li
                key={media.id}
                className="group relative rounded-2xl overflow-hidden border border-white/[0.08] bg-ink shadow-lg"
              >
                {media.kind === "DRIVE_LINK" ? (
                  <a
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block min-h-[160px] p-4 flex flex-col items-center justify-center gap-3 text-center hover:border-orange/40 transition-all"
                  >
                    <span className="w-12 h-12 rounded-xl bg-orange/15 border border-orange/30 text-orange flex items-center justify-center text-2xl">
                      🖇️
                    </span>
                    <span className="text-xs text-cream font-semibold break-all line-clamp-3">
                      {media.url}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-orange font-bold">
                      Ouvrir l&apos;album →
                    </span>
                  </a>
                ) : isImage ? (
                  <a href={media.url} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={media.url}
                      alt={media.fileName ?? "Photo de la soirée"}
                      className="w-full aspect-square object-cover"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  // Videos play in place; tapping opens the source file in a new tab.
                  <a href={media.url} target="_blank" rel="noopener noreferrer" className="block">
                    <video
                      src={media.url}
                      controls
                      preload="metadata"
                      className="w-full aspect-square object-cover bg-black"
                    >
                      <a href={media.url}>{media.fileName ?? "Vidéo de la soirée"}</a>
                    </video>
                  </a>
                )}

                {canDelete && (
                  <button
                    onClick={() => deleteEventMediaAction(slug, media.id)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-ink/90 backdrop-blur border border-red-400/30 text-red-400 text-xs flex items-center justify-center hover:bg-red-500/20 transition-colors cursor-pointer"
                    aria-label="Retirer ce média"
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}