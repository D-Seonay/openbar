# Recettes custom — design

Date: 2026-07-12

## Contexte

Les recettes de cocktails sont actuellement un tableau codé en dur
(`api/src/cocktails/cocktails.data.ts`, `COCKTAILS`), sans aucun modèle en
base. Il n'existe donc aucun moyen de créer une recette depuis l'app. Le but
de ce projet est de permettre aux comptes VIP et Admin d'ajouter leurs
propres recettes, stockées en base, affichées mélangées avec les recettes
officielles.

## Décisions issues du brainstorming

- Création réservée aux comptes **VIP et Admin** (pas tous les USER).
- Les recettes custom apparaissent **mélangées** avec les 20+ recettes
  officielles dans la même grille (pas de section séparée).
- Une recette custom utilise le **même système de tags/ingrédients** que les
  recettes officielles pour le calcul de faisabilité (matching sur le stock
  de bouteilles).
- Les 20+ recettes officielles **restent codées en dur** ; seules les
  recettes custom vont en base. La liste affichée est une fusion faite à la
  lecture (`[...COCKTAILS, ...customRecipes]`).
- Modification/suppression : **auteur de la recette ou Admin**.
- Une recette custom peut être marquée **VIP** (visible des VIP/Admin
  seulement), au choix du créateur à la création — flag indépendant du
  calcul `usesVip` existant (qui reflète si la recette utilise une bouteille
  taguée VIP en stock).
- Saisie des ingrédients de matching : **multi-select parmi les tags de
  bouteilles déjà utilisés dans le bar** (pas de texte libre), pour garantir
  la cohérence avec le moteur de matching.
- Formulaire complet : nom, ingrédients (tags + liste d'affichage libre),
  instructions, verre, temps de préparation, difficulté, description sont
  tous requis, au même niveau de détail que les recettes officielles.

## 1. Modèle de données (Prisma)

```prisma
enum RecipeDifficulty {
  Facile
  Moyen
  Expert
}

model Recipe {
  id              String           @id @default(cuid())
  name            String
  glass           String?
  tags            String[]
  ingredientsList String[]
  instructions    String[]
  prepTime        String
  difficulty      RecipeDifficulty @default(Moyen)
  description     String
  vip             Boolean          @default(false)
  createdById     String
  createdBy       User             @relation(fields: [createdById], references: [id])
  createdAt       DateTime         @default(now())
}
```

`User` gagne `recipes Recipe[]`.

Les valeurs de l'enum `RecipeDifficulty` reprennent exactement la casse de
l'union TypeScript existante (`"Facile" | "Moyen" | "Expert"` dans
`CocktailRecipe`), pour éviter une couche de traduction entre l'enum Prisma
et le type partagé frontend/backend. C'est un léger écart avec la convention
`ALL_CAPS` habituelle des enums Prisma dans ce projet — accepté
explicitement pour ce modèle.

Pas de `onDelete` explicite sur la relation `createdBy` (comportement par
défaut, cohérent avec `Contribution.userId` qui n'en définit pas non plus) :
la suppression d'un utilisateur ayant des recettes sera bloquée tant que ses
recettes existent.

Une migration Prisma (`add_recipe_model`) sera générée et appliquée.

## 2. API (NestJS)

Nouveau module `api/src/recipes/` suivant le pattern de `bottles/` :

- `recipes.module.ts`
- `recipes.controller.ts` — `POST /recipes`, `PATCH /recipes/:id`,
  `DELETE /recipes/:id`
- `recipes.service.ts` — CRUD Prisma + `findVisible(includeVip)` (même filtre
  que `BottlesService.findAll`, `where: includeVip ? undefined : { vip: false }`)
- `dto/create-recipe.dto.ts`, `dto/update-recipe.dto.ts` — validation
  `class-validator` (name, tags, ingredientsList, instructions non vides ;
  glass/prepTime/description strings ; difficulty enum ; vip boolean)

### Permissions

- **Création** : `JwtAuthGuard` + vérification inline via `canSeeVip(req.user)`
  (`api/src/auth/vip.util.ts`, déjà exactement la définition "VIP ou Admin").
  Pas de nouveau guard — `ForbiddenException` si `canSeeVip` renvoie `false`.
- **Modification/suppression** : `JwtAuthGuard` + vérification
  `recipe.createdById === req.user.sub || req.user.role === 'ADMIN'` dans le
  service, `ForbiddenException` sinon, `NotFoundException` si l'id n'existe
  pas (même pattern que `BottlesService.findOne`).

### Fusion avec les recettes officielles

`CocktailsService.evaluate(includeVip)` (inchangé côté signature/route
`GET /cocktails`) est étendu :

1. Récupère les bouteilles (inchangé).
2. Récupère les recettes custom visibles via
   `RecipesService.findVisible(includeVip)`, avec `include: { createdBy: { select: { username: true } } }`.
3. Convertit chaque `Recipe` Prisma en forme `CocktailRecipe` (même shape),
   en ajoutant `isCustom: true`, `createdById`, `createdByUsername`.
4. Fusionne `[...COCKTAILS, ...customRecipes]` et appelle
   `evaluateRecipes(bottles, mergedRecipes)`.

`evaluateRecipes` change de signature :
`evaluateRecipes(bottles: StockLike[], recipes: CocktailRecipe[] = COCKTAILS)`
— la valeur par défaut garde tous les tests existants (`cocktails.service.spec.ts`)
valides sans modification.

## 3. Frontend

### Types & data

- `src/lib/cocktail-types.ts` : `CocktailRecipe` gagne des champs optionnels
  `isCustom?: boolean`, `createdById?: string`, `createdByUsername?: string`
  (rétrocompatible avec les recettes en dur, qui ne les définissent pas).
- `src/lib/api-client.ts` : `createRecipe`, `updateRecipe`, `deleteRecipe`
  (appels `POST/PATCH/DELETE /recipes`), suivant le pattern de
  `addBottle`/`updateBottle`/`deleteBottle`.

### Server actions (`src/app/actions.ts`)

- `requireVipOrAdmin()` (nouvelle garde, miroir de `requireAdmin()` :
  `session?.vip || session?.role === "ADMIN"`, sinon `redirect("/login")` ou
  page cocktails avec message d'erreur).
- `createRecipe(formData)`, `updateRecipe(id, formData)`,
  `deleteRecipe(id)` — parsent le `FormData` (tags multi-select, listes
  dynamiques d'ingrédients/instructions en JSON via input hidden, comme
  `volumes` dans `createBottle`), appellent `api.*`, puis
  `revalidatePath("/cocktails")`.

### UI (`src/app/cocktails/`)

- `page.tsx` récupère en plus `listBottles()` pour calculer la liste des
  tags distincts déjà utilisés dans le bar (dédupliqués), passée en prop à
  `CocktailStudio`.
- `CocktailStudio.tsx` reçoit `currentUserId`, `isAdmin`, `allTags` en plus
  de `isVip` existant (qui sert déjà de garde "peut créer", puisqu'il vaut
  déjà `session?.vip || session?.role === "ADMIN"`).
- Bouton "＋ Ajouter une recette" dans la barre d'outils, visible si `isVip`,
  ouvrant `CreateRecipeModal.tsx` (nouveau composant client, formulaire
  calqué sur `AddBottleForm.tsx`) :
  - nom (texte, requis)
  - ingrédients de matching : multi-select des `allTags` (checkboxes)
  - liste d'ingrédients affichés : lignes de texte libre dynamiques (pattern
    éditeur de `volumes` dans `AddBottleForm.tsx`), ex. "6cl rhum blanc"
  - instructions : étapes dynamiques en texte libre
  - verre, temps de préparation (texte)
  - difficulté (select Facile/Moyen/Expert)
  - description (textarea)
  - checkbox "Réserver à la section VIP" (même pattern que dans
    `AddBottleForm.tsx`)
  - réutilisé aussi en mode édition (pré-rempli) pour le créateur/admin
- Liste et panneau détail (`CocktailStudio.tsx`) : badge "Custom" + nom du
  créateur quand `isCustom`.
- Panneau détail : boutons Modifier/Supprimer visibles si
  `currentUserId === recipe.createdById || isAdmin` ; suppression avec
  confirmation (pattern `ConfirmDeleteModal.tsx`).

## 4. Tests

- `api/src/recipes/recipes.service.spec.ts` (nouveau) : création,
  modification/suppression par l'auteur, refus pour un non-auteur non-admin,
  autorisation pour un admin.
- `api/src/cocktails/cocktails.service.spec.ts` (existant) : ajouter des cas
  avec des recettes custom fusionnées à la liste (le paramètre par défaut
  garde les cas actuels inchangés).
- Vérification manuelle dans le navigateur : création par un compte VIP,
  tentative refusée pour un compte USER standard, édition/suppression par le
  créateur, invisibilité d'une recette custom VIP pour un compte non-VIP.

## Hors scope

- Migration des 20+ recettes officielles en base.
- Upload d'image pour une recette custom.
- Commentaires/notes/rating sur les recettes.
- Recherche/filtrage avancé au-delà de ce qui existe déjà dans
  `CocktailStudio.tsx`.
