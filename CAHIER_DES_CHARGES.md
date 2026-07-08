# Cahier des charges — Le Bar de Noa

## 1. Contexte et objectif

Toutes les soirées se passent chez la même personne. Ce projet est une application web qui sert de tableau de bord pour cette maison : savoir ce qu'il reste en stock, planifier une soirée et envoyer un lien aux invités pour organiser qui ramène quoi, garder une petite réserve d'alcools haut de gamme réservée à une liste restreinte de proches (VIP), et voir automatiquement quels cocktails sont réalisables avec ce qu'il y a réellement en stock.

C'est un projet personnel, mono-utilisateur côté administration (l'hôte), avec une page publique légère pour les invités (identification par prénom, sans mot de passe).

## 2. Périmètre fonctionnel

### 2.1 Stock (gestion des bouteilles)

- Ajouter, modifier la quantité (+/-), et supprimer une entrée de stock.
- Chaque entrée a : un nom, un type (whisky, rhum, vodka, gin, tequila, liqueur/apéritif, vin, champagne, bière, mixer, autre), une quantité (nombre, pas forcément entier), une liste de tags libres utilisés pour le matching des cocktails (ex: `rhum blanc`, `citron vert`), un indicateur "réservé VIP", et une note optionnelle.
- Le type `mixer` sert à noter les ingrédients non alcoolisés (tonic, jus de citron, sucre, soda...) : ils comptent dans le calcul des cocktails mais pas dans le compteur "bouteilles en stock".
- Deux vues : le stock courant, et une section "Réserve VIP" séparée visuellement, qui liste uniquement les bouteilles marquées VIP.

### 2.2 Moteur de cocktails

- Une bibliothèque de recettes classiques est intégrée à l'application (une vingtaine de cocktails : Mojito, Cuba Libre, Daiquiri, Piña Colada, Old Fashioned, Whisky-Coca, Godfather, Gin Tonic, Negroni, Dry Martini, Moscow Mule, Cosmopolitan, Screwdriver, Espresso Martini, Margarita, Tequila Sunrise, Aperol Spritz, Kir Royal, French 75, Sidecar, Manhattan, Amaretto Sour).
- Chaque recette a un nom, un verre de service (optionnel), une liste de tags d'ingrédients requis, et des instructions courtes.
- Le calcul de faisabilité se fait automatiquement à partir du stock : une recette est "réalisable" si chacun de ses tags requis correspond à au moins une bouteille en stock (quantité > 0) portant ce tag (comparaison insensible à la casse).
- Pour chaque tag requis, si plusieurs bouteilles en stock le couvrent, on privilégie une bouteille non-VIP pour ne pas bloquer inutilement un cocktail derrière la réserve VIP.
- Une recette est classée "réserve VIP" si, une fois ce choix fait, au moins un de ses ingrédients ne peut être couvert que par une bouteille marquée VIP.
- Trois listes affichées : réalisables maintenant (sans VIP), réalisables avec la réserve VIP, et "encore un peu de shopping" (recettes non réalisables, avec la liste des tags manquants), triées par nombre d'ingrédients manquants.

### 2.3 Soirées et lien invité

- L'hôte crée une soirée : nom, date, et une liste optionnelle de prénoms VIP (texte libre séparé par virgules).
- Un identifiant unique lisible (slug) est généré à partir du nom (ex: "Apéro du samedi" → `apero-du-samedi`, avec suffixe numérique en cas de collision).
- L'hôte obtient un lien unique à partager : `/soirees/<slug>`.
- Liste de toutes les soirées créées, avec bouton "copier le lien" et suppression.

### 2.4 Page invité (publique, par lien)

- Un invité qui ouvre le lien doit d'abord s'identifier avec son prénom (pas de mot de passe, pas de compte). Le prénom est mémorisé localement dans son navigateur (`localStorage`) pour ne pas avoir à le retaper.
- Une fois identifié, l'invité voit :
  - ce qui est déjà sur place (stock non-VIP, hors mixers) ;
  - la liste de qui ramène quoi (tous les invités ayant déjà répondu) ;
  - un formulaire pour ajouter ce qu'il ramène (texte libre + quantité optionnelle) ;
  - les cocktails prévus (réalisables sans VIP) ;
  - il peut retirer sa propre contribution.
- Si le prénom saisi correspond (insensible à la casse) à un prénom de la liste VIP de la soirée, l'invité débloque en plus : la réserve VIP (bouteilles) et les cocktails qui en dépendent, affichés dans une section distincte.
- La liste des prénoms VIP n'est pas un mécanisme de sécurité fort (pas de mot de passe) : c'est un filtre de courtoisie entre proches, pas une protection contre un accès malveillant.

## 3. Modèle de données

Pas de base de données externe : un seul magasin de données `Store` avec trois collections, persistées côté serveur.

| Entité | Champs |
|---|---|
| `Bottle` | `id`, `name`, `type` (enum ci-dessus), `quantity` (number), `tags` (string[], lowercase), `vip` (boolean), `notes?` (string), `createdAt` |
| `EventItem` | `slug` (unique), `name`, `date` (YYYY-MM-DD), `vipNames` (string[]), `createdAt` |
| `Contribution` | `id`, `eventSlug`, `guestName`, `item`, `quantity?`, `createdAt` |

Règles :
- `slug` généré depuis `name` (minuscule, accents supprimés, non-alphanumérique → `-`), avec suffixe `-2`, `-3`... en cas de collision.
- Toute écriture passe par une file d'attente séquentielle (mutex applicatif) pour éviter qu'deux mutations concurrentes ne corrompent le fichier de stockage.
- Supprimer un événement supprime aussi ses contributions associées.

## 4. Architecture technique

- **Framework** : Next.js (App Router, TypeScript), React avec Server Components par défaut et quelques Client Components pour l'interactivité (compteur de quantité, identification invité, copie de lien).
- **Mutations** : Server Actions (`"use server"`) plutôt que des routes API REST séparées — formulaires natifs (`<form action={...}>`) et appels directs depuis les composants client.
- **Persistance** : pas de base de données. Les trois collections sont stockées dans un unique fichier JSON (`data/store.json`), lu/écrit via `fs/promises`. C'est volontairement simple et suffisant pour un usage perso.
- **Style** : Tailwind CSS v4, avec des tokens de couleur et de police définis une fois via `@theme` dans `globals.css` (voir section DA).
- **Pas d'authentification** : les pages d'administration (`/stock`, `/soirees`) ne sont pas protégées ; c'est un outil personnel. L'identification invité est un simple prénom stocké côté client.

### Limite connue à documenter

Le stockage par fichier fonctionne très bien en local (`npm run dev` / `npm run start`) ou sur un serveur à disque persistant, mais **pas** sur un hébergeur serverless comme Vercel (système de fichiers éphémère). Si un déploiement "cloud" est nécessaire, prévoir de remplacer `src/lib/db.ts` par une vraie base (Postgres, SQLite via Turso...) — le reste du code ne dépend que des fonctions exportées par ce fichier (`listBottles`, `addBottle`, `createEvent`, etc.), donc l'impact sur le reste de l'app est minimal.

## 5. Arborescence des pages

| Route | Type | Rôle |
|---|---|---|
| `/` | Server Component | Tableau de bord : compteurs (stock, VIP, cocktails prêts, soirées à venir), prochaine soirée |
| `/stock` | Server Component + formulaire | Ajout/liste des bouteilles, section VIP séparée |
| `/cocktails` | Server Component | Trois listes : réalisables, VIP, à acheter |
| `/soirees` | Server Component + formulaire | Création et liste des soirées, lien copiable |
| `/soirees/[slug]` | Server Component | Page publique invité (identification, contributions, cocktails, VIP conditionnel) |

## 6. Direction artistique

Univers "bar feutré" inspiré d'une esthétique lounge chic (référence : mockup "Velvet Lounge", fond bordeaux/noir avec typographie dorée élégante).

### Palette (tokens Tailwind `@theme`)

| Token | Valeur | Usage |
|---|---|---|
| `--color-ink` | `#14090a` | Fond général (noir chaud) |
| `--color-ink-2` | `#1d0e0d` | Fond des cartes sur fond ink |
| `--color-brick` | `#7a2a1f` | Panneaux principaux (bordeaux) |
| `--color-brick-light` | `#96392a` | Bordures, hover |
| `--color-brick-dark` | `#571d15` | Fond des sections VIP |
| `--color-gold` | `#f0c24c` | Titres, boutons primaires, accents |
| `--color-gold-dim` | `#c99a52` | Labels secondaires, petites majuscules |
| `--color-cream` | `#f6ecdf` | Texte principal sur fond sombre |
| `--color-muted` | `#c7a690` | Texte secondaire (taupe chaud, pas de gris froid) |

### Typographie

- **Titres / display** : `Italiana` (Google Font, un seul poids 400), serif haute, élégante, façon logotype — utilisée pour les `<h1>`, `<h2>` et le nom du site.
- **Interface / corps** : `Jost` (poids 300 à 600), sans-serif géométrique claire — utilisée pour la nav, les boutons, le corps de texte.
- Les libellés de navigation et petits labels utilisent des majuscules avec tracking large (`uppercase tracking-caps`, `letter-spacing: 0.18em`).

### Motifs de mise en page

- Header sticky, fond `ink` translucide, logo en `Italiana` doré à gauche, nav en petites majuscules à droite.
- Page d'accueil en hero deux colonnes : panneau gauche sombre avec dégradé radial façon spot lumineux + accroche, panneau droit `brick` avec grand titre `Italiana` doré, compteurs, et bloc "prochaine soirée".
- Cartes/sections : coins arrondis, fond `ink-2` ou `brick-dark`/`brick` selon le niveau (standard vs VIP), bordures fines semi-transparentes (`border-cream/10`, `border-gold/25`).
- Boutons primaires : fond `gold`, texte `ink`, hover vers `cream`.
- Le contenu VIP est systématiquement distingué visuellement (fond `brick-dark`, bordure `gold/25`) partout où il apparaît (stock, cocktails, page invité).

## 7. Données de démonstration

Le projet doit être livré avec un jeu de données d'exemple dans `data/store.json` (quelques bouteilles courantes + mixers + 2 bouteilles VIP), pour que `/cocktails` affiche immédiatement des résultats sans configuration.

## 8. Critères d'acceptation

- `npm run build` passe sans erreur TypeScript ni erreur de lint.
- Les quatre routes listées en section 5 répondent en 200 (sauf `/soirees/<slug-inexistant>` qui doit renvoyer une 404).
- Ajouter une bouteille avec les bons tags dans `/stock` fait apparaître au moins un nouveau cocktail dans `/cocktails` sans rechargement manuel nécessaire (revalidation automatique).
- Créer une soirée avec un prénom dans `vipNames`, puis s'identifier avec ce prénom exact (insensible à la casse) sur la page invité, déverrouille la section VIP ; un autre prénom ne la déverrouille pas.
- Aucune dépendance à une base de données externe ; le projet démarre avec `npm install && npm run dev` sans configuration supplémentaire.
