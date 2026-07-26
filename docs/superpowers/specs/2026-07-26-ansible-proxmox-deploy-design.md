# Provisioning Ansible pour bardenoa sur Proxmox — design

Date: 2026-07-26

## Contexte

bardenoa tourne aujourd'hui via `docker-compose.yml` (Postgres + API NestJS +
web Next.js), lancé à la main. On veut l'automatiser sur un hôte Proxmox
existant dont la seule interface réseau est du WiFi (`192.168.1.10`) — le
même hôte qui héberge déjà un cluster k3s pour un autre projet ("lifeos").
Ce point WiFi-only dicte l'architecture réseau : `vmbr0` est un bridge isolé
(`10.10.10.0/24`) sans carte physique dedans (le WiFi ne se bridge pas comme
de l'Ethernet), donc toute nouvelle VM y est injoignable par défaut depuis le
LAN/Internet sans NAT explicite.

## Décisions issues du brainstorming

- Nouvelle VM dédiée à bardenoa sur ce même hôte Proxmox (pas de VPS, pas
  d'hôte séparé) — réutilise le schéma NAT WiFi déjà en place pour l'autre
  projet, sans le dupliquer aveuglément (les playbooks scopent leurs
  modifications à leurs propres ports/règles pour ne rien casser côté
  lifeos).
- Portée complète : provisioning de la VM **et** déploiement de l'app
  (contrairement à l'exemple lifeos, qui s'arrête à "VM prête" parce que
  l'installation de k3s dessus était trop spécifique pour être scriptée —
  ici docker-compose est trivial à automatiser).
- Exposition web via le cluster k3s existant plutôt que des ports NAT
  dédiés : un `Ingress` Traefik sur la VM k3s (`10.10.10.50`) route
  `openbar.seonay.eu` vers la VM bardenoa via un `Service`/`Endpoints` sans
  selector. HTTP simple pour l'instant (pas de cert-manager configuré sur ce
  cluster).
- Le repo GitHub est privé → deploy key générée sur la VM, mais son
  enregistrement côté GitHub (`gh repo deploy-key add`) reste une étape
  manuelle : l'ansible ne peut pas parler à l'API GitHub à la place de
  l'utilisateur.
- Secrets (JWT_SECRET) générés par le playbook et écrits uniquement sur la
  VM (jamais commités) — génération conditionnelle pour ne pas régénérer (et
  donc invalider) un secret déjà en place à chaque run.

## Architecture

```
Internet ──▶ Freebox ──▶ hôte Proxmox (192.168.1.10)
                              │
                    iptables NAT existant (80/443 → VM k3s .50)
                    + nouvelle règle SSH (2223 → VM bardenoa .51)
                              │
                         vmbr0 (10.10.10.0/24, isolé)
                    ┌─────────┴─────────┐
              VM k3s (.50)         VM bardenoa (.51, nouvelle)
              Traefik ingress ───▶ Service sans selector
              host: openbar.          + Endpoints → .51:8080
              seonay.eu                     │
                                       docker compose
                                  (postgres + api + web)
```

Aucune règle NAT HTTP supplémentaire n'est nécessaire : Traefik route déjà
par en-tête `Host`, donc exposer bardenoa consiste juste à ajouter une règle
Ingress sur un `Service` qui pointe vers l'IP interne de la VM bardenoa.
Seul le SSH a besoin d'un nouveau port externe dédié.

## Fichiers (`ansible/`, nouveau dossier à la racine du repo)

```
ansible/
  inventory.ini.example
  create-proxmox-vm.yml
  setup-vm-nat.yml
  deploy-bardenoa.yml
  configure-ingress.yml
  templates/
    ingress.yml.j2
  README.md
```

`ansible/inventory.ini` (réel) est gitignored comme dans le projet lifeos —
détails d'infra internes, pas pour git. `inventory.ini.example` documente
deux groupes :

```ini
[proxmox]
proxmox-host ansible_host=192.168.1.10 ansible_user=root

[k3s]
k3s-host ansible_host=10.10.10.50 ansible_user=debian ansible_ssh_common_args='-o ProxyJump=root@192.168.1.10'

[bardenoa]
bardenoa-host ansible_host=10.10.10.51 ansible_user=debian ansible_ssh_common_args='-o ProxyJump=root@192.168.1.10'
```

Les groupes `[k3s]` et `[bardenoa]` passent par `ProxyJump` via l'hôte
Proxmox : `10.10.10.0/24` n'est joignable que depuis l'intérieur du bridge
isolé, jamais directement depuis le Mac. L'IP `10.10.10.51` est fixée dès
`create-proxmox-vm.yml` (cloud-init), donc `[bardenoa]` peut figurer dans
l'inventaire dès le départ — `deploy-bardenoa.yml` échouera simplement à se
connecter tant que la VM n'existe pas.

## 1. `create-proxmox-vm.yml`

Même schéma idempotent ("tout ou rien" selon l'existence du `vmid") que le
playbook équivalent du projet lifeos : `qm create`/`importdisk`/`resize` en
SSH sur l'hôte Proxmox, cloud-init pour l'IP statique et la clé SSH locale.
Adapté au gabarit réel de bardenoa (stack Postgres + Node, pas un cluster
K8s) :

| Variable | Valeur | Pourquoi |
|---|---|---|
| `vmid` / `vm_name` | `9001` / `bardenoa` | distinct du `9000` déjà pris par lifeos |
| `memory_mb` / `cores` | `2048` / `2` | Postgres + API NestJS + web Next.js, usage perso — pas besoin du gabarit K8s |
| `disk_size` | `20G` | image + volumes Docker + DB, marge confortable |
| `vm_ip_cidr` / `vm_gateway` | `10.10.10.51/24` / `10.10.10.1` | même sous-réseau isolé, IP libre suivante après `.50` |
| `vm_nameserver` | `1.1.1.1` | même raison que lifeos : ne pas dépendre d'un résolveur local |
| `--cpu host` (en dur) | — | même contournement que lifeos : `kvm64` n'expose pas x86-64-v2, l'image Postgres alpine peut aussi en dépendre selon la version |
| `--onboot 1` (en dur) | — | redémarrage automatique après coupure de courant |

## 2. `setup-vm-nat.yml`

Réutilise exactement la même logique idempotente que lifeos (activation
`ip_forward`, `iptables-persistent`, MASQUERADE + FORWARD ACCEPT pour
`10.10.10.0/24`, et pour chaque entrée de `port_forwards` : suppression de
toute règle DNAT existante sur ce `dport` avant d'ajouter la bonne). Rejouer
ces règles subnet-wide est sans risque (idempotent, mêmes valeurs que
lifeos) ; seule la liste `port_forwards` diffère et ne touche pas aux
entrées `2222`/`80`/`443`/`6443` déjà utilisées par lifeos :

```yaml
port_forwards:
  - { host_port: 2223, vm_ip: "10.10.10.51", vm_port: 22 }   # SSH bardenoa
```

## 3. `deploy-bardenoa.yml`

Cible le groupe `[bardenoa]` (`10.10.10.51`) de l'inventaire. Tâches, dans
l'ordre :

1. Installer Docker (`curl -fsSL https://get.docker.com | sh`, ajoute
   l'utilisateur au groupe `docker`) et `git` si absents.
2. Générer une paire de clés SSH dédiée (`~/.ssh/id_ed25519_bardenoa_deploy`)
   si elle n'existe pas déjà.
3. Si `/opt/bardenoa` n'existe pas encore **et** que le clone échoue
   (signe que la deploy key n'est pas encore enregistrée côté GitHub) :
   afficher la clé publique et la commande `gh repo deploy-key add` à
   lancer, puis s'arrêter avec un message clair — l'utilisateur relance le
   playbook après avoir enregistré la clé.
4. Cloner (première fois) ou `git pull` (runs suivants) le repo dans
   `/opt/bardenoa` via l'alias SSH configuré dans `~/.ssh/config` de la VM.
5. Générer `JWT_SECRET` (`openssl rand -hex 32`) et écrire
   `/opt/bardenoa/.env` **seulement si ce fichier n'existe pas déjà** —
   ne jamais régénérer un secret en place (casserait les sessions/JWT actifs).
6. `docker compose up -d --build` dans `/opt/bardenoa`.

Idempotent de bout en bout : relancer ce playbook après un `git push` sur
bardenoa revient à faire un redéploiement (pull + rebuild + up), sans
toucher aux secrets ni recréer la VM.

## 4. `configure-ingress.yml`

Cible le groupe `[k3s]`. Template `templates/ingress.yml.j2` :

```yaml
apiVersion: v1
kind: Service
metadata:
  name: bardenoa
  namespace: default
spec:
  ports:
    - port: 8080
      targetPort: 8080
---
apiVersion: v1
kind: Endpoints
metadata:
  name: bardenoa
  namespace: default
subsets:
  - addresses:
      - ip: 10.10.10.51
    ports:
      - port: 8080
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: bardenoa
  namespace: default
spec:
  ingressClassName: traefik
  rules:
    - host: openbar.seonay.eu
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: bardenoa
                port:
                  number: 8080
```

Appliqué via `ansible.builtin.command` (`become: true`,
`KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl apply -f -`, manifeste passé en
stdin) — cohérent avec le point de friction déjà documenté côté lifeos
(`kubectl` ne regarde `/etc/rancher/k3s/k3s.yaml` par défaut que sous
`root`). `kubectl apply` est intrinsèquement idempotent, pas de garde
supplémentaire nécessaire.

## 5. `ansible/README.md`

Adapté du README lifeos : mêmes sections "Pourquoi c'est plus compliqué
qu'un bridge classique" / "Prérequis", plus courtes commandes d'usage pour
les 4 playbooks (create → nat → deploy → ingress), et un point sur le DNS :
`openbar.seonay.eu` doit pointer vers l'IP publique de la Freebox (le port
forward 80/443 vers la VM k3s existe déjà) ; en attendant la propagation,
`/etc/hosts` sur la machine cliente peut mapper le domaine vers cette IP
publique.

## Vérification

- `ansible-playbook -i ansible/inventory.ini ansible/create-proxmox-vm.yml`
  puis `ansible-playbook -i ansible/inventory.ini ansible/setup-vm-nat.yml`
  → `ssh -p 2223 debian@192.168.1.10` doit atteindre la VM bardenoa.
- `ansible-playbook -i ansible/inventory.ini ansible/deploy-bardenoa.yml`
  → `curl http://10.10.10.51:8080` depuis l'hôte Proxmox doit répondre
  (page d'accueil bardenoa).
- `ansible-playbook -i ansible/inventory.ini ansible/configure-ingress.yml`
  → `curl -H "Host: openbar.seonay.eu" http://192.168.1.10` (ou depuis
  l'extérieur une fois le DNS propagé) doit répondre la même page.
- Pas de tests automatisés : playbooks d'infra, aucun code applicatif
  bardenoa n'est modifié.

## Hors scope

- TLS/Let's Encrypt sur `openbar.seonay.eu` (ajoutable plus tard via
  cert-manager sans remaniement de ce design).
- Paramétrer le mot de passe Postgres (`docker-compose.yml` le laisse en
  dur à `bardenoa`/`bardenoa`) — non exposé comme variable d'environnement
  aujourd'hui, changer ça est un changement applicatif, pas infra.
- Sauvegardes de la base Postgres de production.
- CI/CD (déploiement déclenché automatiquement sur push) — le playbook
  `deploy-bardenoa.yml` reste déclenché à la main pour l'instant.
