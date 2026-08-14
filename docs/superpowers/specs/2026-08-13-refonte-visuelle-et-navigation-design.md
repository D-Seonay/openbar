# Refonte visuelle et navigation — OpenBar

Date : 2026-08-13
Statut : validé, prêt pour le plan d'implémentation

## 1. Pourquoi

Trois motifs, donnés par ordre d'importance :

1. **L'esthétique** — le style sombre orange ne convient plus.
2. **La navigation** — 23 pages pour 6 entrées de menu, sans regroupement lisible.
3. **La densité** — l'essentiel du contenu vit entre 10 et 12px, hiérarchie plate.

La maintenabilité n'est pas un moteur, mais elle progresse mécaniquement : les
primitives partagées cassent les composants monolithiques.

## 2. Le contexte d'usage, qui commande tout le reste

**Téléphone, pendant la soirée.** Debout, une main, lumière basse, sessions de
dix secondes.

Conséquences non négociables :

- tout se conçoit à **390px d'abord** ; le desktop est une vue élargie ;
- **44px minimum** pour toute zone tactile, sans exception ;
- trois à quatre actions par écran, pas davantage.

## 3. Direction visuelle : « papier chaud »

Fond clair, sérif pour les titres, filets fins plutôt que cartes empilées.

Choisie en connaissance de la réserve suivante, qui reste vraie : un écran clair
en pleine figure dans une pièce sombre est agressif. Décision assumée, thème
unique, pas de variante sombre.

### Palette

Un seul jeu de tokens, six rôles plus deux statuts. La palette actuelle en
compte quatorze, ce qui est une des raisons pour lesquelles rien ne ressort.

| Token | Valeur | Rôle |
|---|---|---|
| `--paper` | `#F3EFE7` | fond général |
| `--paper-sunk` | `#E8E2D7` | blocs, champs, états inactifs |
| `--ink` | `#26221D` | texte principal |
| `--ink-soft` | `#6B6257` | texte secondaire, méta |
| `--rule` | `#D9D1C4` | filets et bordures |
| `--terracotta` | `#A8452A` | accent unique : actions, liens, alertes |
| `--done` | `#4F6B43` | statut « complet » |
| `--warn` | `#8A5A12` | statut « alerte stock » |

Ces valeurs ont été vérifiées, pas supposées. Ratios mesurés :

| Paire | sur `--paper` | sur `--paper-sunk` |
|---|---|---|
| `--ink` | 13.78 | — |
| `--ink-soft` | 5.22 | 4.64 |
| `--terracotta` | 5.16 | — |
| `--done` | 5.21 | — |
| `--warn` | 5.16 | — |
| blanc sur `--terracotta` | 5.92 | — |

Deux corrections issues de cette mesure :

- `--ink-soft` valait `#776E62` dans les maquettes : **4.37 sur papier et 3.89
  sur fond enfoncé, donc sous le seuil**. Assombri à `#6B6257`, qui passe les
  deux surfaces.
- `--done` valait `#5F7A52` : trop clair, assombri à `#4F6B43`.

`--rule` (1.32) n'est pas concerné : c'est un filet décoratif, pas du texte ni
la bordure d'un contrôle interactif. Les bordures qui délimitent un contrôle
utilisent `--ink-soft`.

### Typographie

Sérif pour les titres, sans-serif pour le reste. L'échelle est la correction de
densité :

| Rôle | Taille |
|---|---|
| titre d'écran | 27px sérif |
| titre de section | 17px sans, 600 |
| corps | **15px sans** — le défaut |
| méta | 13px sans |
| label | 13px sérif, majuscules espacées, usage rare |

**Le plancher de 13px est absolu, sans aucune exception.**

Une version antérieure de cette spec plaçait le label à 11px. Cette exception a
été retirée : elle contredisait le critère d'acceptation « aucun texte sous
13px », qu'un audit automatisé vérifie. Entre une règle mesurable sans cas
particulier et un cas particulier à revérifier à la main sur chaque écran, la
règle gagne — d'autant que la densité est l'un des trois motifs de la refonte.

### Quelles polices, concrètement

Le projet auto-héberge aujourd'hui `Outfit` et `Plus Jakarta Sans` — **deux
sans-serif**. Il n'y a aucune sérif disponible, et la maquette s'appuyait sur
`Georgia`, absente d'Android.

Décision : **auto-héberger `Lora`** (OFL, comme les deux autres) en `.woff2`
dans `src/app/fonts/`, déclarée avec `next/font/local`.

Lora est servie en **police variable** : le sous-ensemble latin est un seul
fichier de 37 Ko qui couvre 400 à 700. Une graisse ou quatre coûtent donc le
même poids. Vérifié en récupérant le fichier réel.

Aucune police n'est chargée depuis un CDN. C'est la leçon de la PR #80 : une URL
Google Fonts en dur a cassé le déploiement quand le hash a changé côté Google.

Répartition finale des trois familles :

| Famille | Usage | Sort |
|---|---|---|
| `Lora` | titres d'écran, labels | **à ajouter** — 1 fichier |
| `Plus Jakarta Sans` | corps, méta, boutons | conservée — 3 fichiers |
| `Outfit` | — | **retirée** — 4 fichiers supprimés |

Bilan net : **quatre fichiers de police en moins pour un ajouté.**

### Ce qui est supprimé

Glassmorphism, lueurs orange, dégradés, ombres colorées. Les utilitaires
`box-orange-glow`, `glass-card` et apparentés sortent de `globals.css`.

## 4. Navigation

Barre d'onglets **en bas**, quatre destinations, zone sûre iOS gérée.

**Soirée · Cave · Cocktails · Moi**

L'onglet Soirée est l'accueil. Le header du haut se réduit au nom du bar
(sélecteur) et à l'avatar ; plus aucune navigation en haut.

### Où vont les 23 pages

| Onglet | Pages |
|---|---|
| Soirée | `/soirees`, `/soirees/[slug]`, `/soirees/[slug]/bilan` |
| Cave | `/stock` — scan et édition deviennent des surfaces, pas des pages |
| Cocktails | `/cocktails` |
| Moi | `/profil`, membres+annuaire fusionnés, `/journal`, `/comptes`, `/decouvrir`, `/creer`, `/rejoindre/[token]`, `/changer-mot-de-passe`, `/admin/*` |

Deux décisions structurelles :

- `/annuaire` et `/membres` **fusionnent** sur `/membres` ; `/annuaire` devient
  une redirection permanente vers `/membres` plutôt qu'un 404, parce que le lien
  a pu être partagé. Mêmes personnes, un seul écran, les actions de gestion
  visibles seulement pour le propriétaire ;
- `/bar` est **supprimée** — elle ne fait qu'une redirection.

## 5. Primitives

Huit composants, un rôle chacun.

| Composant | Rôle |
|---|---|
| `Button` | 3 variantes (principal, discret, danger), hauteur 44px imposée |
| `Card` | bloc de contenu, avec ou sans filet |
| `Field` | label + champ + erreur |
| `Badge` | statut : neutre, complet, alerte |
| `Row` | ligne de liste tactile 44px, chevron optionnel |
| `Sheet` | panneau montant du bas |
| `TabBar` | barre du bas, 4 destinations |
| `EmptyState` | état vide avec action |

`ModalShell`, `NoticeModal` et `ConfirmDeleteModal` sont **reskinnés, pas
réécrits**.

### Le tiroir devient une feuille

Changement de manipulation, pas seulement de style : un panneau ancré en bas est
atteignable au pouce, un tiroir latéral pleine hauteur ne l'est pas.

C'est aussi ce qui permet de casser `StockStudio` (699 lignes) en trois feuilles
distinctes : fiche bouteille, scanner, édition.

## 6. Écrans

**Soirée** — la page répond d'abord à « qu'est-ce que je fais maintenant » : à
ramener en premier, le reste replié dessous. Le bilan reste une page à part,
c'est une tâche assise.

**Cave** — `StockStudio` éclate en liste + trois feuilles. Filtres en rangée
déroulante horizontale. Les boutons ± passent de 32px à 44px.

**Cocktails** — surtout du reskin. Le sélecteur grille/liste est retiré : sur
téléphone une seule présentation suffit et la maintenir en double coûte plus
qu'elle ne rapporte.

**Moi / Bar** — écran de renvois plus pages existantes reskinnées.

## 7. Périmètre

**Hors périmètre, strictement :** l'API, le schéma Prisma, la logique métier, et
la signature des Server Actions. Refonte front uniquement.

Nuance, pour lever toute ambiguïté : un écran refondu peut **appeler** des
Server Actions existantes différemment — l'écran membres fusionné en appellera
deux au lieu d'une. Ce qui est interdit, c'est d'en modifier le contrat ou le
comportement.

Discord, le calendrier, le scan de code-barres, le journal et l'archive zip
continuent de fonctionner à l'identique.

**Reporté :** le traitement des pages `/admin/*`, reskinnées en dernier et au
minimum.

## 8. Exécution

**Une seule branche, un seul merge.** Choix assumé après présentation des
revers.

Deux garde-fous internes qui ne modifient pas ce choix :

- les fondations (tokens, primitives, coquille) sont construites **en premier
  dans la branche**, avant toute page ;
- rebase régulier sur `main`, et vérification du build Docker avant merge.

Risque accepté : aucune amélioration de style n'atteint la production pendant la
durée de la branche, et le merge portera sur une trentaine de fichiers.

## 9. Vérification

Chaque point est mesuré, pas constaté à l'œil.

| Quoi | Comment |
|---|---|
| 44px | audit programmatique de toutes les zones tactiles à 390px |
| contraste | ratio calculé par paire texte/fond, seuil AA 4.5:1 |
| débordement | `scrollWidth === clientWidth` par page, à **vrai** viewport mobile |
| non-régression | scanner une bouteille, se déclarer sur un item, valider un bilan, télécharger l'archive |

Deux notes de méthode, apprises en cours de route :

**Rétrécir un élément en JS ne teste pas le responsive.** Les points de rupture
Tailwind réagissent au viewport, pas à l'élément. Les mesures se font à viewport
réellement réduit — d'où un vrai moteur mobile plutôt qu'une fenêtre redimensionnée.

**L'audit ne teste que ce qui s'affiche.** Un jeu de données qui ne déclenche ni
pagination, ni état vide, ni alerte de stock produit un vert trompeur. Avant de
conclure qu'un écran passe, s'assurer que les données de test font apparaître
ses composants conditionnels. C'est ainsi que la pagination a traversé une tâche
entière sans être vue, alors qu'elle portait un débordement horizontal et six
textes à 12px.

## 10. Critères d'acceptation

- Aucun texte sous 13px, nulle part, sans exception.
- Aucune zone tactile sous 44px à 390px.
- Chaque paire texte/fond atteint AA.
- Aucun débordement horizontal sur les pages refondues à 390px.
- Les quatre parcours de non-régression passent.
- `npm run build` passe côté web ; l'API n'est pas touchée.
- Plus aucune occurrence de `box-orange-glow` ni `glass-card` dans `src/`.
- Aucune police chargée depuis un domaine externe ; la sérif est dans
  `src/app/fonts/`.
- `/annuaire` redirige vers `/membres` ; `/bar` n'existe plus.
- Le build Docker passe sur la branche avant le merge.
