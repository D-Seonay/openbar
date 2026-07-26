# Déploiement continu (CD) de bardenoa sur push — design

Date: 2026-07-27

## Contexte

Le déploiement de bardenoa sur sa VM Proxmox est aujourd'hui manuel : après
un `git push` sur `main`, il faut relancer
`ansible-playbook -i ansible/inventory.ini ansible/deploy-bardenoa.yml` à la
main pour que la VM récupère le nouveau code (`git pull` +
`docker compose up -d --build`, cf. `ansible/deploy-bardenoa.yml`). On veut
automatiser cette étape à chaque push sur `main`.

## Décisions issues du brainstorming

- **Runner GitHub Actions auto-hébergé, installé directement sur la VM
  bardenoa** — pas un runner hébergé par GitHub qui SSH vers chez
  l'utilisateur. L'hôte Proxmox n'a que du WiFi, sans réservation DHCP
  statique (son IP a changé de `192.168.1.10` à `192.168.1.253` pendant
  cette même session de travail) et sans DNS dynamique configuré : un
  runner cloud qui doit joindre une IP mouvante nécessiterait soit du DNS
  dynamique, soit une exposition SSH root permanente sur cette IP. Un
  runner auto-hébergé n'a besoin que d'une connexion **sortante** vers
  GitHub — insensible au changement d'IP, aucune ouverture entrante
  supplémentaire côté Freebox/Proxmox.
- Le job de déploiement réutilise directement `/opt/bardenoa` (le
  répertoire déjà géré par `ansible/deploy-bardenoa.yml`) plutôt que de
  faire faire un second `actions/checkout` dans l'espace de travail du
  runner — un seul répertoire source de vérité, `.env`/`JWT_SECRET`
  inchangés.
- Déploiement **sans condition** sur chaque push vers `main` — pas de gate
  de lint. Le repo a ~194 erreurs de lint préexistantes sans rapport avec
  ce chantier ; en faire un gate bloquerait tous les déploiements dès le
  premier run.
- Le runner tourne comme utilisateur `debian` (déjà membre du groupe
  `docker` depuis `deploy-bardenoa.yml`), pas `root` — limite le privilège
  d'un processus qui exécute du code arrivé par un dépôt Git.

## Architecture

```
push sur main ──▶ GitHub Actions (job "deploy")
                        │
                   s'exécute sur le runner auto-hébergé
                   installé sur la VM bardenoa elle-même
                        │
                   cd /opt/bardenoa && git pull
                   && sudo docker compose up -d --build
```

## Fichiers

### 1. `ansible/setup-github-runner.yml` (nouveau)

Playbook ponctuel, cible le groupe `bardenoa`. Tâches :

1. Télécharger et extraire l'archive `actions-runner-linux-x64` officielle
   dans `/home/debian/actions-runner` (idempotent : `creates:` sur le
   dossier).
2. Enregistrer le runner via `./config.sh --url
   https://github.com/D-Seonay/bardenoa --token {{ github_runner_token }}
   --unattended --labels bardenoa-vm --name bardenoa-vm` — idempotent :
   skip si `~/actions-runner/.runner` existe déjà (le token de
   registration expire de toute façon après enregistrement, donc rejouer
   `config.sh` sur un runner déjà enregistré échouerait).
3. Installer le service systemd (`sudo ./svc.sh install debian && sudo
   ./svc.sh start`) — idempotent via l'état du service systemd
   (`systemctl is-active`).

`github_runner_token` est un token de registration GitHub, valable ~1h,
jamais commité — passé en ligne de commande (`-e
github_runner_token=...`), obtenu juste avant l'exécution via :

```bash
gh api -X POST repos/D-Seonay/bardenoa/actions/runners/registration-token --jq .token
```

### 2. `.github/workflows/deploy.yml` (nouveau)

```yaml
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: self-hosted
    steps:
      - name: Redéployer la stack
        run: |
          cd /opt/bardenoa
          git pull
          sudo docker compose up -d --build
```

### 3. `ansible/README.md` (modifié)

Nouvelle section décrivant l'usage de `setup-github-runner.yml` (commande
`gh api` pour le token + invocation du playbook), et une note sécurité sur
ce qu'implique un runner auto-hébergé pour un repo privé mono-mainteneur.

## Sécurité

Un runner auto-hébergé exécute tout ce que contient le workflow au SHA
poussé sur `main` — risque acceptable ici (repo privé, un seul
mainteneur, pas de pull request externe à fusionner), documenté
explicitement dans le README plutôt que laissé implicite.

## Vérification

- `ansible-playbook -i ansible/inventory.ini ansible/setup-github-runner.yml`
  puis l'onglet **Settings → Actions → Runners** du repo GitHub doit
  montrer `bardenoa-vm` en ligne (idle).
- `git commit --allow-empty -m "test CD" && git push` doit déclencher le
  job dans l'onglet **Actions**, se terminer en succès, et
  `docker compose ps` sur la VM doit montrer une heure de démarrage
  récente pour `web`/`api`.
- Pas de tests automatisés (playbook d'infra + workflow YAML, aucun code
  applicatif bardenoa n'est modifié).

## Hors scope

- Gate de lint/tests avant déploiement (voir décision ci-dessus).
- Rollback automatique en cas d'échec du build/déploiement.
- Déploiement sur des branches autres que `main` (staging, PR previews).
- Notifications (Slack, email...) en cas d'échec du job.
