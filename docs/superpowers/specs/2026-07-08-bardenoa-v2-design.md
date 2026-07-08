# Spec v2 — Le Bar de Noa

Date : 2026-07-08
Statut : proposé (à valider avant plan d'implémentation)
Réfère à : `CAHIER_DES_CHARGES.md` (v1, déjà implémenté)

## 1. Contexte

La v1 du projet est en production personnelle : stock, moteur de cocktails, soirées et page invité fonctionnent. Cette spec v2 documente un ensemble d'améliorations identifiées après usage réel, organisées en deux phases pour rester actionnables.

Contraintes actées pour cette version :
- Le site continue de tourner sur un serveur maison (pas de migration vers une base de données externe, pas de déploiement serverless type Vercel).
- Le site est exposé depuis l'extérieur via un tunnel/VPN/reverse proxy — ce qui justifie l'ajout d'une authentification minimale côté administration.
- La mise à jour du stock après une soirée se fait toujours a posteriori (le lendemain ou en fin de soirée), pas en temps réel pendant que les cocktails sont servis.

## 2. Phasage

- **Phase 1 (must-have)** : renforce l'usage réel actuel — sécurité, bilan post-soirée, alertes, recherche, liste de courses, tests.
- **Phase 2 (nice-to-have)** : enrichit l'expérience — gestion des recettes en UI, RSVP, historique/stats, mobile, dashboard.

Chaque phase peut être planifiée et livrée indépendamment ; Phase 2 dépend du modèle de données introduit en Phase 1 (`StockAdjustment`) pour ses stats.

## 3. Modèle de données (évolutions)

Le magasin de données reste un fichier JSON unique (`data/store.json`), sans base de données externe, conformément à la v1.

| Entité | Statut | Champs | Notes |
|---|---|---|---|
| `Bottle` | modifiée | `id`, `name`, `type`, `quantity`, `tags`, `vip`, `notes?`, `createdAt`, **`lowStockThreshold?` (number)** | Seuil sous lequel une alerte s'affiche. Absent = pas d'alerte pour cette bouteille. |
| `EventItem` | inchangée | `slug`, `name`, `date`, `vipNames`, `createdAt` | L'archive (soirées passées) est calculée par filtre `date < aujourd'hui`, pas un champ stocké. |
| `Contribution` | inchangée | `id`, `eventSlug`, `guestName`, `item`, `quantity?`, `createdAt` | — |
| `Rsvp` *(nouvelle, Phase 2)* | ajout | `id`, `eventSlug`, `guestName`, `attending` (boolean), `createdAt` | Une entrée par invité identifié et par soirée. Upsert si l'invité change d'avis (rappelle son prénom). |
| `Recipe` *(nouvelle, Phase 2)* | ajout | `id`, `name`, `glass?`, `tags` (string[], lowercase), `instructions`, `createdAt` | Remplace le tableau `COCKTAILS` codé en dur dans `src/lib/cocktails.ts`. Les 20 recettes actuelles deviennent les données de seed dans `data/store.json`. |
| `StockAdjustment` *(nouvelle, Phase 1)* | ajout | `id`, `eventSlug`, `bottleId`, `bottleName` (snapshot), `quantityBefore`, `quantityAfter`, `createdAt` | Un enregistrement par bouteille modifiée via l'écran "bilan post-soirée". Sert de journal de consommation pour les stats Phase 2. |

Règles complémentaires :
- Un bilan peut être refait plusieurs fois pour la même soirée ; chaque validation crée de nouveaux `StockAdjustment` (pas de contrainte d'unicité sur `eventSlug` + `bottleId`).
- Supprimer un événement supprime ses `Contribution`, `Rsvp` et `StockAdjustment` associés (cohérent avec la règle existante sur les contributions).
- `Recipe.tags` suit les mêmes conventions que `Bottle.tags` (minuscules, utilisés pour le matching).

## 4. Authentification admin

- Un mot de passe unique défini via variable d'environnement `ADMIN_PASSWORD` (dans `.env.local`, non commité).
- Nouvelle route publique `/login` : formulaire à un seul champ (mot de passe, pas de nom d'utilisateur).
- À validation réussie, pose un cookie `HttpOnly`, `Secure`, signé (session token avec expiration, ex. 30 jours).
- `middleware.ts` protège toutes les routes sous `/stock`, `/soirees` (liste, création, bilan) et `/cocktails/recettes`. **Exception : `/soirees/[slug]` reste public**, accessible sans authentification (page invité).
- Pas de multi-utilisateurs ni de rôles — un seul verrou hôte/reste-du-monde, cohérent avec le projet mono-utilisateur.
- En cas de mot de passe erroné : message générique + délai artificiel (~1s) pour décourager le brute-force basique. Pas de mécanisme de verrouillage de compte (disproportionné pour l'usage réel).

## 5. Phase 1 — Détail fonctionnel

### 5.1 Bilan post-soirée

- Nouvelle route `/soirees/[slug]/bilan` (admin), accessible via un bouton "Faire le bilan" sur la page de la soirée.
- Liste affichée : toutes les bouteilles non-VIP, plus les bouteilles VIP qui apparaissent comme ingrédient d'au moins un cocktail classé "réserve VIP" pour cette soirée (évite de noyer l'hôte avec tout le stock VIP si non concerné).
- Pour chaque bouteille : quantité actuelle affichée en lecture seule, champ "quantité restante" pré-rempli avec la valeur actuelle (donc ne rien toucher = aucun impact).
- Validation en un seul submit : pour chaque ligne dont la valeur diffère de la quantité actuelle, met à jour `Bottle.quantity` et crée un `StockAdjustment` (`eventSlug`, `bottleId`, `bottleName`, `quantityBefore`, `quantityAfter`).
- Aucune validation de cohérence forcée (une quantité restante peut être supérieure à l'actuelle, ex. correction d'erreur de saisie).

### 5.2 Alerte stock bas

- Champ optionnel `lowStockThreshold` ajouté au formulaire d'édition d'une bouteille sur `/stock`.
- Si `quantity <= lowStockThreshold`, la ligne est mise en évidence visuellement (badge/bordure distincte, cohérente avec la DA existante — probablement un liseré `gold` ou un badge discret, à trancher en implémentation).
- Le dashboard (`/`) affiche un compteur "bouteilles en alerte" et une liste courte (3 à 5) des plus critiques (celles avec le plus petit écart `quantity - lowStockThreshold`).

### 5.3 Recherche/filtre stock

- Client Component ajouté au-dessus de la liste sur `/stock` : champ texte (filtre sur `name` + `tags`) et sélecteur de `type`.
- Filtrage entièrement côté client sur la liste déjà chargée par le Server Component — pas d'aller-retour serveur, la taille de la liste ne le justifie pas.

### 5.4 Liste de courses copiable

- Sur `/cocktails`, à côté de la section "encore un peu de shopping" : bouton "Copier la liste de courses".
- Agrège tous les tags manquants des recettes non réalisables, dédupliqués, formatés en texte simple (une ligne par ingrédient), copiés via `navigator.clipboard` (même pattern que le composant `CopyLink` existant).

### 5.5 Tests unitaires

- Ajout de Vitest comme dépendance de test.
- Couvre `src/lib/cocktails.ts` : faisabilité par correspondance de tags, priorité donnée à une bouteille non-VIP quand plusieurs couvrent un même tag, classification "réserve VIP", tri des recettes manquantes par nombre de tags manquants.
- Pas de tests end-to-end dans cette phase (coût disproportionné par rapport à l'usage réel du projet).

## 6. Phase 2 — Détail fonctionnel

### 6.1 Gestion des recettes depuis l'UI

- Nouvelle route admin `/cocktails/recettes` : liste des recettes existantes, formulaire d'ajout, actions d'édition et de suppression.
- Champs du formulaire : `name`, `glass?`, `tags` (saisie libre séparée par virgules, comme `vipNames` aujourd'hui), `instructions`.
- Migration : les 20 recettes actuelles de `COCKTAILS` deviennent des données de seed dans `data/store.json` ; le tableau statique est supprimé de `src/lib/cocktails.ts`, qui ne garde que la logique de calcul de faisabilité.
- `/cocktails` (lecture, faisabilité) ne change pas de comportement, seulement sa source de données (store au lieu du tableau en dur).

### 6.2 RSVP (qui vient / qui ne vient pas)

- Sur la page invité, juste après l'identification par prénom : deux boutons "Je viens" / "Je ne viens pas".
- Non bloquant : un invité peut ignorer le RSVP et directement ajouter une contribution ou consulter le contenu.
- Compteur "X confirmés" affiché sur `/soirees/[slug]` et sur `/soirees` (admin) pour la prochaine soirée à venir.

### 6.3 Historique des soirées passées + stats

- `/soirees` : nouvelle section "Soirées passées" (événements avec `date < aujourd'hui`), repliable ou paginée si la liste grossit dans le temps.
- Chaque soirée passée est cliquable vers une vue résumé : ses `Contribution` et ses `StockAdjustment` associés (si un bilan a été fait).
- Stats globales affichées en bas de `/soirees` :
  - "Contributeur le plus actif" : comptage des `Contribution` par `guestName`.
  - "Bouteille la plus consommée" : somme des écarts négatifs (`quantityBefore - quantityAfter`) par `bottleName` dans `StockAdjustment`, toutes soirées confondues.

### 6.4 Optimisation mobile de la page invité

- Passe de responsive sur `GuestPanel.tsx` existant, sans nouvelle route.
- Formulaire de contribution repositionné en haut de la page (plutôt qu'après tout le contenu).
- Zones tactiles ≥ 44px pour les boutons (RSVP, ajout de contribution, retrait).
- Sections stock/cocktails repliables par défaut sur petit écran pour réduire le scroll initial.

### 6.5 Dashboard enrichi

- Ajoute au tableau de bord existant :
  - Alertes stock bas (issues de la section 5.2).
  - Compteur RSVP de la prochaine soirée (issu de 6.2).
  - Lien direct "bilan à faire" pour toute soirée passée sans `StockAdjustment` associé.

## 7. Arborescence des routes (v2)

| Route | Type | Protection | Rôle |
|---|---|---|---|
| `/` | Server Component | admin | Dashboard enrichi (alertes stock bas, RSVP prochaine soirée, bilans en attente) |
| `/login` | Server Component + formulaire | publique | Authentification hôte |
| `/stock` | Server Component + formulaire | admin | Ajout/liste bouteilles, recherche/filtre, seuils d'alerte |
| `/cocktails` | Server Component | admin | Trois listes de faisabilité + liste de courses copiable |
| `/cocktails/recettes` | Server Component + formulaire | admin | CRUD recettes *(Phase 2)* |
| `/soirees` | Server Component + formulaire | admin | Création, liste à venir, soirées passées + stats *(Phase 2)* |
| `/soirees/[slug]` | Server Component | publique | Page invité (identification, RSVP *Phase 2*, contributions, cocktails) |
| `/soirees/[slug]/bilan` | Server Component + formulaire | admin | Écran de bilan post-soirée |

## 8. Critères d'acceptation

**Phase 1**
- Toutes les routes admin (`/`, `/stock`, `/soirees`, `/cocktails`) redirigent vers `/login` en l'absence de cookie de session valide ; `/soirees/[slug]` reste accessible sans authentification.
- `npm run build` et `npm run test` passent sans erreur.
- Faire un bilan post-soirée avec une quantité modifiée met à jour `Bottle.quantity` et crée un `StockAdjustment` correspondant.
- Une bouteille dont `quantity <= lowStockThreshold` apparaît en alerte sur `/stock` et dans le compteur du dashboard.
- Rechercher un texte ou filtrer par type sur `/stock` réduit la liste affichée sans rechargement de page.
- Le bouton "Copier la liste de courses" produit un texte contenant tous les tags manquants dédupliqués des recettes non réalisables.

**Phase 2**
- Créer, modifier ou supprimer une recette dans `/cocktails/recettes` se reflète immédiatement dans les calculs de `/cocktails`.
- Un RSVP "je viens" incrémente le compteur de confirmés de la soirée concernée.
- Une soirée passée apparaît dans la section "Soirées passées" avec ses contributions et ses ajustements de stock associés.
- Les stats "contributeur le plus actif" et "bouteille la plus consommée" reflètent les données réelles du store.

## 9. Hors périmètre (explicitement exclu)

- Déduction automatique du stock en temps réel via un bouton "cocktail servi" — écarté au profit du bilan post-soirée (section 5.1), car l'usage réel se fait a posteriori.
- Migration vers une base de données externe (Postgres, SQLite/Turso) — non nécessaire tant que l'hébergement reste sur serveur maison à disque persistant.
- Authentification multi-utilisateurs ou par rôle — un seul mot de passe hôte suffit pour l'usage réel.
- Tests end-to-end — coût disproportionné par rapport à l'échelle du projet ; seuls des tests unitaires sur le moteur de cocktails sont prévus.
- Prix d'achat / valeur monétaire du stock — non demandé, à réévaluer dans une future itération si le besoin apparaît.
