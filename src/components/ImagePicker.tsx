"use client";

import { useState, useTransition, useRef } from "react";

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  /**
   * Called when the choice is settled rather than on every keystroke: on blur
   * or Enter for a typed URL, and immediately for an upload or a removal.
   *
   * Callers that only keep the value in local state (a form that saves later)
   * can ignore this. Callers that persist have to use it — `onChange` fires per
   * character in URL mode, which would otherwise mean one write per keystroke,
   * each racing the others and fighting the controlled input.
   */
  onCommit?: (url: string) => void;
  onUpload: (formData: FormData) => Promise<string | null>;
  label?: string;
}

export default function ImagePicker({
  value,
  onChange,
  onCommit,
  onUpload,
  label = "Photo de la bouteille",
}: ImagePickerProps) {
  const [mode, setMode] = useState<"local" | "url">("local");
  const [isUploading, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    startUpload(async () => {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const uploadedUrl = await onUpload(formData);
        if (uploadedUrl) {
          onChange(uploadedUrl);
          // A finished upload is already a settled choice, so commit it too.
          onCommit?.(uploadedUrl);
        }
      } catch {
        // silent
      }
    });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-[13px] uppercase tracking-caps text-ink-soft font-semibold">
          {label}
        </label>
        <div className="flex items-center gap-1 bg-paper-sunk p-0.5 rounded-lg border border-rule">
          <button
            type="button"
            onClick={() => setMode("local")}
            className={`tap-target flex items-center px-2.5 rounded text-[13px] font-medium transition-all cursor-pointer ${
              mode === "local" ? "bg-terracotta text-paper font-bold" : "text-ink-soft hover:text-ink"
            }`}
          >
            📂 Fichier local
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`tap-target flex items-center px-2.5 rounded text-[13px] font-medium transition-all cursor-pointer ${
              mode === "url" ? "bg-terracotta text-paper font-bold" : "text-ink-soft hover:text-ink"
            }`}
          >
            🔗 URL Internet
          </button>
        </div>
      </div>

      {mode === "local" ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group flex items-center justify-between gap-3 sm:gap-4 p-3 rounded-xl border border-dashed border-rule bg-paper-sunk hover:border-terracotta/50 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 shrink-0 rounded-lg bg-paper flex items-center justify-center text-lg border border-rule group-hover:border-terracotta/40">
                {isUploading ? "⏳" : "📷"}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink group-hover:text-terracotta transition-colors">
                  {isUploading ? "Upload en cours..." : "Choisir une image depuis votre appareil"}
                </p>
                <p className="text-[13px] text-ink-soft hidden xs:block">PNG, JPG, WEBP • Image sauvegardée localement</p>
              </div>
            </div>
            <span className="hidden xs:block shrink-0 text-[13px] font-semibold text-terracotta bg-paper px-3 py-1.5 rounded-lg border border-terracotta/25">
              Parcourir
            </span>
          </div>
        </div>
      ) : (
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onCommit?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // Committing here rather than letting the keypress bubble keeps a
            // picker inside a <form> from submitting it by accident.
            e.preventDefault();
            onCommit?.(e.currentTarget.value);
          }}
          placeholder="Ex: https://image.com/bouteille.png"
          className="w-full min-h-[44px] bg-paper-sunk border border-rule rounded-xl px-3.5 text-[15px] placeholder:text-ink-soft focus:outline-2 focus:outline-terracotta text-ink"
        />
      )}

      {/* Preview of the selected image. This lives in the picker rather than in
          each caller so that every consumer — bottle form, bottle detail, and
          the profile avatar — keeps a way to clear the image. */}
      {value && (
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-paper-sunk border border-rule">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-11 shrink-0 bg-paper rounded-lg p-1 border border-rule overflow-hidden">
              {/* `/uploads/*` is proxied to the API by next.config.ts, so the
                  stored path resolves same-origin as-is. */}
              <img src={value} alt="Aperçu" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <span className="text-[13px] font-medium text-ink block">Aperçu de l&apos;image sélectionnée</span>
              <span className="text-[13px] text-terracotta font-mono truncate block">
                {value.startsWith("data:") ? "Image locale convertie" : value}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange("");
              onCommit?.("");
            }}
            className="tap-target shrink-0 flex items-center text-[13px] text-terracotta hover:text-terracotta/80 bg-paper px-2.5 rounded-lg border border-terracotta/25 cursor-pointer"
          >
            Retirer
          </button>
        </div>
      )}
    </div>
  );
}
