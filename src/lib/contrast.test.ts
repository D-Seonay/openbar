import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio } from "./contrast";

const PAPER = "#F3EFE7";
const SUNK = "#E8E2D7";
const AA = 4.5;

describe("contrastRatio", () => {
  it("rend 21 pour noir sur blanc", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });

  it("rend 1 pour une couleur contre elle-même", () => {
    expect(contrastRatio(PAPER, PAPER)).toBeCloseTo(1, 5);
  });

  it("est symétrique", () => {
    expect(contrastRatio("#26221D", PAPER)).toBeCloseTo(
      contrastRatio(PAPER, "#26221D"),
      5,
    );
  });

  it("accepte les hex à 3 chiffres", () => {
    expect(contrastRatio("#000", "#FFF")).toBeCloseTo(21, 1);
  });
});

// Le vrai objet du test : la palette de la spec. Si quelqu'un éclaircit un
// token, ce test tombe avant que l'écran illisible n'atteigne un utilisateur.
describe("palette papier chaud", () => {
  const surTexte: Array<[string, string, string]> = [
    ["--ink", "#26221D", PAPER],
    ["--ink-soft", "#6B6257", PAPER],
    ["--ink-soft sur enfoncé", "#6B6257", SUNK],
    ["--terracotta", "#A8452A", PAPER],
    ["--done", "#4F6B43", PAPER],
    ["--warn", "#8A5A12", PAPER],
    ["blanc sur --terracotta", "#FFFFFF", "#A8452A"],
  ];

  it.each(surTexte)("%s atteint AA", (_nom, avant, arriere) => {
    expect(contrastRatio(avant, arriere)).toBeGreaterThanOrEqual(AA);
  });

  it("rejette la valeur d'origine de --ink-soft, qui échouait", () => {
    // #776E62 venait de la maquette et donnait 4.37 sur papier.
    // Ce test documente pourquoi elle a été assombrie.
    expect(contrastRatio("#776E62", PAPER)).toBeLessThan(AA);
  });
});

// Un modificateur d'opacité sur une classe de couleur de texte échappe aux
// tests ci-dessus : ils ne voient que les tokens bruts. Or une opacité de 70%
// sur --ink-soft donne 2.89:1 et 80% donne 3.49:1, tous deux sous le seuil AA
// de 4.5 — un report mécanique des classes atténuées du thème sombre. Plutôt
// que de recalculer le contraste de chaque opacité possible, on bannit
// purement et simplement le modificateur sur une couleur de texte : un
// balayage par expression régulière sur les sources.
describe("pas de modificateur d'opacité sur une couleur de texte", () => {
  const RACINE_SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
  const MOTIF = /text-(ink-soft|ink|terracotta|done|warn)\/\d+/g;
  const EXTENSIONS = [".ts", ".tsx"];

  function fichiersSource(dir: string): string[] {
    const resultats: string[] = [];
    for (const entree of readdirSync(dir)) {
      const chemin = join(dir, entree);
      const info = statSync(chemin);
      // Les fichiers de test peuvent légitimement citer le motif dans un
      // commentaire ou une chaîne (documentation, fixture) : ce n'est pas du
      // balisage rendu, donc hors du périmètre de ce garde-fou.
      if (info.isDirectory()) {
        resultats.push(...fichiersSource(chemin));
      } else if (
        EXTENSIONS.some((ext) => chemin.endsWith(ext)) &&
        !chemin.endsWith(".test.ts") &&
        !chemin.endsWith(".test.tsx")
      ) {
        resultats.push(chemin);
      }
    }
    return resultats;
  }

  function trouvailles(): string[] {
    const trouve: string[] = [];
    for (const fichier of fichiersSource(RACINE_SRC)) {
      const contenu = readFileSync(fichier, "utf8");
      const lignes = contenu.split("\n");
      lignes.forEach((ligne, index) => {
        const correspondances = ligne.match(MOTIF);
        if (correspondances) {
          for (const correspondance of correspondances) {
            trouve.push(`${fichier}:${index + 1} — ${correspondance}`);
          }
        }
      });
    }
    return trouve;
  }

  it("ne trouve aucun modificateur d'opacité sur ink/ink-soft/terracotta/done/warn", () => {
    expect(trouvailles()).toEqual([]);
  });
});
