# Ansible — déploiement bardenoa sur Proxmox

Cinq playbooks pour créer la VM bardenoa, la rendre joignable en SSH, y
déployer la stack docker-compose, et la brancher sur l'ingress du cluster
k3s (lifeos) qui tourne sur ce même hôte Proxmox.

## Pourquoi ça ressemble au provisioning lifeos

Le même hôte Proxmox n'a qu'une interface WiFi — le WiFi ne se bridge pas
comme de l'Ethernet (la plupart des points d'accès rejettent les trames
dont la MAC ne correspond pas à l'interface WiFi elle-même). `vmbr0` est
donc un réseau isolé (`10.10.10.0/24`) sans carte physique dedans : la VM
bardenoa n'a par défaut ni accès à Internet, ni visibilité depuis le LAN,
exactement comme la VM k3s de lifeos qui tourne déjà sur ce bridge.

Contrairement à lifeos, bardenoa n'a pas besoin de ports NAT dédiés pour le
web : le cluster k3s expose déjà 80/443 vers l'extérieur via son propre
ingress Traefik, qui route par nom d'hôte. Exposer bardenoa consiste juste
à ajouter une règle de routage dans cet ingress (`configure-ingress.yml`),
pas à ouvrir de nouveaux ports sur la Freebox ou l'hôte Proxmox.

## Prérequis

- Accès SSH root à l'hôte Proxmox (`192.168.1.253` — le WiFi n'a pas de
  réservation DHCP statique pour cet hôte, donc cette IP peut changer ;
  vérifie-la dans l'interface de ta Freebox si un playbook timeout en SSH)
- Accès SSH à la VM k3s existante (`10.10.10.50`), joignable uniquement en
  passant par l'hôte Proxmox (`ProxyJump`)
- `ansible-playbook` en local (`brew install ansible` ou équivalent)
- Une clé SSH locale à injecter dans la VM (`~/.ssh/id_rsa.pub` par défaut)
- Le repo bardenoa doit être privé et accessible via `gh` (utilisé une fois,
  à la main, pour enregistrer la deploy key générée par `deploy-bardenoa.yml`)
- Les playbooks `[bardenoa]`/`[k3s]` tournent avec `become: true`, ce qui
  suppose un sudo sans mot de passe pour l'utilisateur `debian` — vrai par
  défaut sur les images cloud Debian, à vérifier si tu pars d'une autre image
  de base

```bash
cp ansible/inventory.ini.example ansible/inventory.ini
# ce fichier est gitignored (détails réseau internes, pas pour git)
```

## Usage

```bash
# 1. Crée la VM (Debian 12 cloud image, 2 vCPU / 2 Go / 20 Go, 10.10.10.51)
ansible-playbook -i ansible/inventory.ini ansible/create-proxmox-vm.yml

# 2. Ouvre l'accès SSH depuis le LAN : ssh -p 2223 debian@192.168.1.253
ansible-playbook -i ansible/inventory.ini ansible/setup-vm-nat.yml

# 3. Installe Docker, clone le repo, lance `docker compose up -d --build`.
#    Premier run : échoue avec les instructions pour enregistrer la deploy
#    key générée sur la VM via `gh repo deploy-key add` — relance ensuite.
#    Note : après create-proxmox-vm.yml, cloud-init a besoin d'environ 30 à
#    60 secondes pour finir de configurer la VM (réseau, clé SSH) avant que
#    deploy-bardenoa.yml puisse s'y connecter — si la connexion échoue juste
#    après le playbook précédent, patiente puis relance.
ansible-playbook -i ansible/inventory.ini ansible/deploy-bardenoa.yml

# 4. Route openbar.seonay.eu vers la VM depuis l'ingress k3s existant
ansible-playbook -i ansible/inventory.ini ansible/configure-ingress.yml

# 5. (Une seule fois) Installe un runner GitHub Actions auto-hébergé sur la
#    VM, pour que chaque push sur main redéploie automatiquement (voir
#    .github/workflows/deploy.yml). Le token expire après ~1h, à régénérer
#    si tu relances ce playbook plus tard.
gh api -X POST repos/D-Seonay/openbar/actions/runners/registration-token --jq .token
ansible-playbook -i ansible/inventory.ini ansible/setup-github-runner.yml \
  -e github_runner_token=<token-collé-ci-dessus>
```

Une fois `setup-github-runner.yml` en place, `deploy-bardenoa.yml` n'a plus
besoin d'être relancé après chaque changement de code applicatif (voir la
section Déploiement continu ci-dessous) — il reste utile pour des
changements d'infra (nouvelle variable d'environnement, changement de
configuration Docker Compose, etc.).

## Déploiement continu

Après `setup-github-runner.yml`, chaque `git push` sur `main` déclenche
automatiquement `.github/workflows/deploy.yml` sur la VM (`git pull` +
`docker compose up -d --build` dans `/opt/bardenoa`) — plus besoin de
relancer `deploy-bardenoa.yml` à la main pour les mises à jour de code (le
`JWT_SECRET` généré au premier déploiement n'est jamais touché).

**Sécurité** : un runner auto-hébergé exécute tout ce que contient le
workflow au SHA poussé sur `main` — acceptable ici (repo privé, un seul
mainteneur, pas de pull request externe à fusionner), mais à garder en tête
si le repo devient un jour public ou accepte des contributions externes.

## DNS

`openbar.seonay.eu` doit pointer vers l'IP publique de la Freebox (le port
forward 80/443 vers la VM k3s existe déjà, pas besoin d'en ajouter). En
attendant la propagation DNS, tu peux tester en mappant le domaine vers
cette IP publique dans `/etc/hosts` sur ta machine cliente (pas sur les VMs).

## Dépannage

**`Host key verification failed` sur `[k3s]`/`[bardenoa]`** : Ansible ne
peut pas répondre au prompt interactif "are you sure you want to continue
connecting?" que SSH pose la première fois qu'il voit un hôte (ici, les VMs
sur `10.10.10.0/24`, jamais contactées avant). C'est pour ça que
`ansible_ssh_common_args` inclut `-o StrictHostKeyChecking=accept-new` pour
ces deux groupes — accepte automatiquement une clé *jamais vue*, mais
continue de refuser une clé qui *change* (donc pas de baisse de sécurité
réelle). Si l'erreur persiste malgré tout, vérifie s'il existe une entrée
en conflit dans ton `~/.ssh/known_hosts` pour ces IP (`ssh-keygen -R
10.10.10.50` / `ssh-keygen -R 10.10.10.51` pour la supprimer).

**Timeout SSH vers l'hôte Proxmox** (`ssh: connect to host ... port 22:
Operation timed out`, ou `ping` qui répond `Host is down`) : l'hôte n'a que
du WiFi, sans réservation DHCP statique connue — son IP peut changer entre
deux sessions. Vérifie son IP actuelle dans l'interface d'admin de ta
Freebox (liste des appareils connectés), puis mets à jour `ansible_host`
pour le groupe `[proxmox]` (et le `ProxyJump` des groupes `[k3s]`/
`[bardenoa]`) dans `ansible/inventory.ini`.

**VM à moitié provisionnée** : `create-proxmox-vm.yml` est idempotent
seulement sur l'existence du `vmid` (`qm status`) — si `qm importdisk` /
`qm resize` / l'injection de la clé SSH échoue après la création de la
coquille VM (ex : `local-lvm` plein), le `vmid` 9001 existe déjà et le
playbook considérera la VM comme prête au prochain run, alors qu'elle est
incomplète (pas de disque, pas de clé SSH, ou éteinte). Pour repartir de
zéro : `qm destroy 9001` sur l'hôte Proxmox, puis relance
`create-proxmox-vm.yml`.

**`wan_iface` incorrect** : `setup-vm-nat.yml` suppose l'interface WiFi
nommée `wlo1`. iptables accepte silencieusement une interface qui n'existe
pas — le playbook réussit, mais aucun trafic ne passe (`ssh -p 2223 ...`
reste bloqué sans erreur). Vérifie le nom réel avec `ip -br link` sur
l'hôte Proxmox avant de lancer ce playbook, et ajuste la variable
`wan_iface` si besoin.

**L'ingress répond une erreur (502 ou timeout)** : vérifie d'abord que la
stack tourne directement sur la VM avec `curl http://10.10.10.51:8080`
depuis l'hôte Proxmox, avant de creuser côté k3s/Traefik.

**Runner à moitié installé** : `setup-github-runner.yml` est idempotent
seulement sur l'existence de `~/actions-runner/.runner` sur la VM — si
`config.sh`/`svc.sh install`/`svc.sh start` échoue après le téléchargement
de l'archive (ex : token expiré), le dossier existe mais `.runner` n'y est
peut-être pas encore, donc un nouveau run repart proprement de zéro. Si au
contraire `.runner` existe mais le service ne tourne pas
(`sudo ~/actions-runner/svc.sh status` sur la VM), supprime le runner côté
GitHub (Settings → Actions → Runners), `rm -rf ~/actions-runner` sur la VM,
régénère un token, et relance le playbook.

**`./config.sh` échoue avec `404 Not Found` sur
`POST .../actions/runner-registration`** : le repo a été renommé côté
GitHub (`D-Seonay/bardenoa` → `D-Seonay/openbar`). `git push`/`gh api`
suivent la redirection automatiquement, mais l'endpoint interne
d'enregistrement du runner exige le nom canonique actuel — utilise
`D-Seonay/openbar` dans `--url` et dans la commande `gh api ... /repos/...`
qui génère le token, pas l'ancien nom.

## Hors scope

- TLS/Let's Encrypt sur `openbar.seonay.eu` (pas de cert-manager configuré
  sur ce cluster pour l'instant — HTTP simple).
- Sauvegardes de la base Postgres de production.
