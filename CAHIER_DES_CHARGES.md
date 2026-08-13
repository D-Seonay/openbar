# Cahier des charges — OpenBar

## 1. Contexte et objectif

Application web pour organiser les soirées d'un groupe : tenir le stock d'alcool, coordonner qui ramène quoi, calculer les cocktails réalisables avec ce qu'il y a réellement en cave, et garder une trace de la soirée (bilan, photos).

L'application est **multi-utilisateurs et multi-bars**. Chaque bar a ses membres, son stock et ses soirées ; une même personne peut appartenir à plusieurs bars et bascule de l'un à l'autre depuis l'en-tête.

## 2. Rôles et accès

| Rôle | Portée | Peut |
|---|---|---|
| `ADMIN` | Global | Tout, sur tous les bars. Gère les comptes. |
| `OWNER` | Un bar | Gérer le stock, les soirées, les membres, le journal, Discord. |
| `MEMBER` | Un bar | Consulter, se déclarer sur la liste « à ramener », déposer des photos. |
| VIP | Un bar | Voir en plus la réserve VIP et les cocktails qui en dépendent. |

L'accès est authentifié : compte, mot de passe, session JWT en cookie `httpOnly`. Il n'y a pas de page publique en dehors de `/login`, `/signup`, `/decouvrir` et l'aperçu d'une invitation.

Un membre non-VIP ne doit jamais pouvoir déduire le contenu de la réserve VIP — y compris indirectement (recherche, scan de code-barres, flux calendrier, journal).

## 3. Périmètre fonctionnel

### 3.1 Stock

- Bouteille : nom, catégorie, quantité, tags, formats (`70cl`, `1L`…), photo, notes, seuil d'alerte, code-barres, indicateur VIP.
- **Tous ces champs sont modifiables après création.** La quantité est dérivée des formats quand ceux-ci existent.
- Scan de code-barres par la caméra : un code déjà présent dans le bar ouvre la bouteille correspondante ; sinon le produit est cherché dans Open Food Facts et le formulaire est prérempli. Un code inconnu de la base publique reste enregistrable pour que le scan suivant le retrouve.
- Un code-barres est unique **par bar** — deux bars peuvent stocker le même produit.
- Liste de courses : références sous leur seuil, copiables ou exportables en CSV.

### 3.2 Cocktails

- Bibliothèque de recettes, chacune avec des tags d'ingrédients requis.
- Une recette est réalisable si chaque tag est couvert par une bouteille en stock (quantité > 0). À couverture égale, une bouteille non-VIP est préférée pour ne pas enfermer inutilement une recette derrière la réserve.
- Trois listes : réalisables, réalisables via la réserve VIP, et manquantes (avec les tags absents).

### 3.3 Soirées

- Création : nom, date. Un slug unique sert de lien d'invitation.
- La page soirée affiche **le stock du bar hôte**, jamais celui du bar actif du visiteur.
- **À ramener** : l'hôte liste ce qu'il faut, avec un nombre de personnes attendues par item. Les invités se déclarent ; l'item se ferme une fois complet. Plusieurs personnes sur un même item est le cas normal.
- **Bilan** : ajustement du stock en fin de soirée, historisé. Une soirée passée sans bilan est signalée dans la liste.
- **Galerie** : photos et vidéos, ou lien vers un album partagé. Téléchargement unitaire ou archive zip de l'ensemble.
- **Calendrier** : export `.ics` d'une soirée, et flux d'abonnement personnel (Google Agenda, iPhone) tenu à jour automatiquement.

### 3.4 Journal

Trace horodatée des actions : bouteille ajoutée, quantité modifiée, bouteille retirée, soirée créée ou supprimée, bilan validé. Consultable par le propriétaire du bar.

Le journal ne doit jamais faire échouer l'action qu'il enregistre.

### 3.5 Discord *(optionnel)*

- Liaison d'un compte OpenBar à un compte Discord (OAuth2, scope `identify`). Un compte Discord ne peut être lié qu'à un seul profil.
- Un bar peut être relié à un salon. Le tableau « à ramener » y est publié puis **édité sur place** à chaque changement.
- Annonce d'une soirée en message privé aux membres liés. La livraison partielle est normale et doit être rapportée telle quelle.
- Sondages natifs Discord lancés depuis la soirée.

Sans configuration Discord, aucune de ces fonctions n'est proposée et aucun appel sortant n'est émis.

## 4. Modèle de données

Postgres, via Prisma. Entités principales :

| Entité | Rôle |
|---|---|
| `User` | Compte : identifiants, rôle global, profil, liaison Discord, jeton de calendrier. |
| `Bar` | Un bar : nom, visibilité, jeton d'invitation, salon Discord. |
| `BarMembership` | Appartenance d'un utilisateur à un bar, avec rôle et statut VIP. Unique par couple. |
| `BarJoinRequest` | Demande d'adhésion en attente. |
| `Bottle` / `BottleVolume` | Stock et formats. Code-barres unique par bar. |
| `Event` | Soirée : slug unique, date, clôture, message Discord associé. |
| `WishlistItem` / `WishlistItemAssignment` | « À ramener » et prises. Un utilisateur ne peut se déclarer qu'une fois par item. |
| `Contribution` | Apports libres annoncés par les invités. |
| `StockAdjustment` | Historique des bilans. |
| `EventMedia` | Photos, vidéos, ou lien d'album. |
| `Recipe` | Recettes propres à un bar. |
| `AuditLog` | Journal. Dénormalisé : le nom de l'acteur est copié pour rester lisible après archivage du compte. |

### Règles transverses

- Toute écriture concurrente sur une ressource à capacité limitée (prise d'un item « à ramener ») est sérialisée par un verrou de ligne, pas par un simple comptage.
- Les fichiers uploadés sont stockés sous un nom généré, avec une extension déduite du type MIME validé — jamais du nom fourni par le client.
- Les intégrations externes (Open Food Facts, Discord) ne peuvent ni bloquer ni faire échouer une requête utilisateur.

## 5. Architecture technique

```
navigateur ──► web (Next.js 16)  ──►  api (NestJS)  ──►  Postgres
                    │                      │
                    │                      └──► Open Food Facts, Discord
                    └── /uploads/* réécrit vers l'API
```

- **Web** : Next.js 16, App Router, Server Components par défaut, mutations par Server Actions. Tailwind CSS v4.
- **API** : NestJS 11, Prisma 6. Aucun port publié : le navigateur ne l'appelle jamais directement.
- **Seule l'API sort vers l'extérieur.** Les secrets tiers n'existent que dans son environnement.
- Les téléchargements (archive zip, `.ics`, flux calendrier) passent par des *route handlers* du web, qui relaient l'API : un téléchargement doit arriver au navigateur, ce qu'une Server Action ne permet pas.

### Journalisation

Une ligne JSON par requête HTTP : méthode, chemin, statut, durée, utilisateur, identifiant de corrélation renvoyé en `x-request-id`. Le corps des requêtes n'est jamais lu — il contiendrait les mots de passe de `/auth/login`.

## 6. Direction artistique

Voir [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), **référence unique** pour la palette, la typographie, les composants et les règles mobile.

Ce document ne duplique pas les valeurs de couleur : c'est ce qui l'avait rendu faux.

## 7. Critères d'acceptation

- `npm run build` passe côté web et côté API, sans erreur TypeScript.
- Un membre non-VIP ne voit aucune bouteille VIP, quel que soit le chemin emprunté.
- Un invité voit le stock du **bar hôte** sur la page soirée, pas le sien.
- Une prise concurrente sur le dernier créneau d'un item « à ramener » n'en accepte qu'une.
- Une intégration externe en panne (Open Food Facts, Discord) ne fait échouer aucune action utilisateur.
- Aucun secret n'est présent dans le dépôt.
