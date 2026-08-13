/**
 * Contraste WCAG 2.1. Sert au test de la palette : un token de texte qui
 * n'atteint pas 4.5:1 doit faire échouer la suite, pas arriver en production.
 */

function expandHex(hex: string): string {
  const raw = hex.replace("#", "");
  if (raw.length === 3) {
    return raw
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return raw;
}

function channelLuminance(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const raw = expandHex(hex);
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) {
    throw new Error(`Couleur hex invalide : ${hex}`);
  }
  const [r, g, b] = [0, 2, 4].map((i) =>
    channelLuminance(parseInt(raw.slice(i, i + 2), 16)),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const clair = Math.max(la, lb);
  const sombre = Math.min(la, lb);
  return (clair + 0.05) / (sombre + 0.05);
}
