import { describe, expect, it } from "vitest";
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
