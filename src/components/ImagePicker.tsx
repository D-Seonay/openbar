"use client";

import { useState, useTransition, useRef } from "react";

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  onUpload: (formData: FormData) => Promise<string | null>;
  label?: string;
}

export default function ImagePicker({
  value,
  onChange,
  onUpload,
  label = "Photo de la bouteille",
}: ImagePickerProps) {
  const [mode, setMode] = useState<"local" | "url">("local");
  const [isUploading, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant client preview & server upload
    startUpload(async () => {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const uploadedUrl = await onUpload(formData);
        if (uploadedUrl) {
          onChange(uploadedUrl);
        } else {
          // Fallback to FileReader base64 if server returns null
          const reader = new FileReader();
          reader.onload = (event) => {
            if (typeof event.target?.result === "string") {
              onChange(event.target.result);
            }
          };
          reader.readAsDataURL(file);
        }
      } catch {
        // Fallback to FileReader base64
        const reader = new FileReader();
        reader.onload = (event) => {
          if (typeof event.target?.result === "string") {
            onChange(event.target.result);
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs uppercase tracking-caps text-gold-dim font-semibold">
          {label}
        </label>
        <div className="flex items-center gap-1 bg-ink/80 p-0.5 rounded-lg border border-white/[0.08] text-[10px]">
          <button
            type="button"
            onClick={() => setMode("local")}
            className={`tap-target-sm flex items-center px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
              mode === "local"
                ? "bg-orange text-ink font-bold shadow-sm"
                : "text-muted hover:text-cream"
            }`}
          >
            📂 Fichier local
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`tap-target-sm flex items-center px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
              mode === "url"
                ? "bg-orange text-ink font-bold shadow-sm"
                : "text-muted hover:text-cream"
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
            className="group flex items-center justify-between gap-3 sm:gap-4 p-3 rounded-xl border border-dashed border-white/[0.12] bg-ink-2/60 hover:border-orange/40 hover:bg-ink-2 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 shrink-0 rounded-lg bg-ink flex items-center justify-center text-lg border border-white/[0.08] group-hover:border-orange/30">
                {isUploading ? "⏳" : "📷"}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-cream group-hover:text-orange transition-colors">
                  {isUploading ? "Upload en cours..." : "Choisir une image depuis votre appareil"}
                </p>
                <p className="text-[11px] text-muted hidden xs:block">PNG, JPG, WEBP • Image sauvegardée localement</p>
              </div>
            </div>
            <span className="hidden xs:block shrink-0 text-xs font-semibold text-orange bg-orange/15 px-3 py-1.5 rounded-lg border border-orange/20">
              Parcourir
            </span>
          </div>
        </div>
      ) : (
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex: https://image.com/bouteille.png"
          className="w-full bg-ink border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-xs placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/40 transition-all text-cream"
        />
      )}

      {/* Preview selected image */}
      {value && (
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-ink/80 border border-white/[0.08]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-11 shrink-0 bg-ink rounded-lg p-1 border border-white/[0.08] overflow-hidden">
              <img src={value} alt="Aperçu" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-cream block">Aperçu de l&apos;image sélectionnée</span>
              <span className="text-[10px] text-orange font-mono truncate block">
                {value.startsWith("data:") ? "Image locale convertie" : value}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange("")}
            className="tap-target-sm shrink-0 flex items-center text-xs text-red-400 hover:text-red-300 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 cursor-pointer"
          >
            Retirer
          </button>
        </div>
      )}
    </div>
  );
}
