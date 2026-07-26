# Ansible — déploiement bardenoa sur Proxmox

Quatre playbooks pour créer la VM bardenoa, la rendre joignable en SSH, y
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

- Accès SSH root à l'hôte Proxmox (`192.168.1.10`)
- Accès SSH à la VM k3s existante (`10.10.10.50`), joignable uniquement en
  passant par l'hôte Proxmox (`ProxyJump`)
- `ansible-playbook` en local (`brew install ansible` ou équivalent)
- Une clé SSH locale à injecter dans la VM (`~/.ssh/id_rsa.pub` par défaut)
- Le repo bardenoa doit être privé et accessible via `gh` (utilisé une fois,
  à la main, pour enregistrer la deploy key générée par `deploy-bardenoa.yml`)

```bash
cp ansible/inventory.ini.example ansible/inventory.ini
# ce fichier est gitignored (détails réseau internes, pas pour git)
```

## Usage

```bash
# 1. Crée la VM (Debian 12 cloud image, 2 vCPU / 2 Go / 20 Go, 10.10.10.51)
ansible-playbook -i ansible/inventory.ini ansible/create-proxmox-vm.yml

# 2. Ouvre l'accès SSH depuis le LAN : ssh -p 2223 debian@192.168.1.10
ansible-playbook -i ansible/inventory.ini ansible/setup-vm-nat.yml

# 3. Installe Docker, clone le repo, lance `docker compose up -d --build`.
#    Premier run : échoue avec les instructions pour enregistrer la deploy
#    key générée sur la VM via `gh repo deploy-key add` — relance ensuite.
ansible-playbook -i ansible/inventory.ini ansible/deploy-bardenoa.yml

# 4. Route openbar.seonay.eu vers la VM depuis l'ingress k3s existant
ansible-playbook -i ansible/inventory.ini ansible/configure-ingress.yml
```

Relance `deploy-bardenoa.yml` après chaque `git push` sur `main` pour
redéployer (pull + rebuild + up) — le `JWT_SECRET` généré au premier run
n'est jamais régénéré.

## DNS

`openbar.seonay.eu` doit pointer vers l'IP publique de la Freebox (le port
forward 80/443 vers la VM k3s existe déjà, pas besoin d'en ajouter). En
attendant la propagation DNS, tu peux tester en mappant le domaine vers
cette IP publique dans `/etc/hosts` sur ta machine cliente (pas sur les VMs).

## Hors scope

- TLS/Let's Encrypt sur `openbar.seonay.eu` (pas de cert-manager configuré
  sur ce cluster pour l'instant — HTTP simple).
- Sauvegardes de la base Postgres de production.
- Déploiement automatique sur push (CI/CD) — `deploy-bardenoa.yml` reste
  déclenché à la main.
