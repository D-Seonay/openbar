# Le Bar de Noa 🍸

Petite appli web pour gérer le stock d'alcool de la maison où se passent toutes les soirées : savoir ce qu'il reste, planifier une soirée, envoyer un lien aux invités pour qu'ils indiquent ce qu'ils ramènent, garder une réserve VIP secrète pour les intimes, et voir automatiquement quels cocktails sont réalisables avec ce qu'il y a en stock.

## Fonctionnalités

- **Stock** (`/stock`) : liste des bouteilles (alcools + mixers comme le tonic, citron, sucre...) avec quantité, type et tags utilisés pour matcher les recettes de cocktails. Case "Réserve VIP" pour les bouteilles à ne pas montrer à tout le monde.
- **Cocktails** (`/cocktails`) : calcule automatiquement, à partir du stock, quels cocktails sont réalisables maintenant, lesquels nécessitent une bouteille VIP, et ce qu'il manque pour les autres.
- **Soirées** (`/soirees`) : crée une soirée (nom, date, liste de prénoms VIP optionnelle) et récupère un lien unique à envoyer aux invités.
- **Page invité** (`/soirees/[slug]`) : chaque invité entre son prénom (pas de mot de passe), voit ce qui est déjà sur place, indique ce qu'il ramène, et voit la liste de tout le monde. Si son prénom est dans la liste VIP de la soirée, il débloque en plus la réserve VIP et les cocktails premium.

## Lancer le projet

```bash
npm install
npm run dev
```

Avant de lancer le serveur, crée un fichier `.env.local` à la racine avec un mot de passe pour les pages d'administration :

```bash
echo "ADMIN_PASSWORD=ton-mot-de-passe" > .env.local
```

Sans cette variable, `/stock`, `/soirees` et `/cocktails` restent inaccessibles (redirection vers `/login`) — seule la page invité `/soirees/<slug>` reste publique.

Puis ouvre [http://localhost:3000](http://localhost:3000).

Un jeu de données d'exemple est déjà présent dans `data/store.json` (quelques bouteilles, dont 2 en VIP). Tu peux vider ce fichier ou modifier son contenu directement, ou simplement gérer tout depuis l'interface `/stock`.

## Comment ça stocke les données

Pas de base de données externe : tout est écrit dans `data/store.json` par le serveur (via des Server Actions Next.js). Simple, sans dépendance, et suffisant pour un usage perso entre potes.

**Attention** : ce mode de stockage par fichier fonctionne très bien en local (`npm run dev` / `npm run start` sur ta machine ou un petit serveur) mais **pas sur des hébergeurs serverless comme Vercel**, où le système de fichiers est éphémère (les données seraient perdues à chaque redéploiement/mise en veille).

### Pour héberger le site (accessible par lien à tes potes)

Deux options simples :
1. **Sur ta machine à la maison** : lance `npm run build && npm run start`, puis partage l'accès via ton réseau local, ou un tunnel comme [Tailscale](https://tailscale.com) ou [ngrok](https://ngrok.com) si tu veux que ça marche même depuis l'extérieur.
2. **Sur un petit serveur avec disque persistant** (Railway, Render, un VPS...) : le code marche tel quel, il suffit que le dossier `data/` persiste entre les redémarrages.

Si un jour tu veux passer à une vraie base de données (Postgres, SQLite via Turso...) pour déployer sur Vercel, la seule chose à changer est le fichier `src/lib/db.ts` : toutes les pages et Server Actions passent déjà par ses fonctions (`listBottles`, `addBottle`, `createEvent`, etc.), donc le reste du code n'a pas besoin de bouger.

## Ajouter tes propres cocktails

Les recettes sont dans `src/lib/cocktails.ts`. Chaque recette a une liste de `tags` (ex: `"rhum blanc"`, `"citron vert"`) qui doivent correspondre aux tags que tu mets sur tes bouteilles/mixers dans le stock. Ajoute une recette dans le tableau `COCKTAILS` pour l'inclure dans le calcul automatique.

## Stack

Next.js 16 (App Router, TypeScript, Server Actions) + Tailwind CSS. Aucune base de données ni service externe requis.
