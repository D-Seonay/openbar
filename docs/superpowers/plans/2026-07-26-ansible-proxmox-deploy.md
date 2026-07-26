# Ansible Provisioning for bardenoa on Proxmox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `ansible/` directory to bardenoa that provisions a dedicated VM on the existing WiFi-only Proxmox host, deploys the docker-compose stack onto it, and wires it into the existing k3s cluster's Traefik ingress at `openbar.seonay.eu`.

**Architecture:** Four idempotent playbooks run in sequence — create the VM (`qm` commands over SSH), open a NAT path to it (iptables), deploy the app onto it (Docker + git + docker compose), then route to it from the existing k3s Ingress (kubectl apply). Each playbook targets a different inventory group and can be re-run safely.

**Tech Stack:** Ansible (core 2.20, no extra collections — only `ansible.builtin.*` modules), plain `qm`/`iptables`/`docker`/`kubectl` shelled out over SSH, Jinja2 templating for the one Kubernetes manifest.

## Global Constraints

- Every playbook must be re-runnable without side effects (idempotent) — this is the load-bearing property from the spec, since these playbooks get re-run whenever the VM list changes or bardenoa is redeployed.
- No new Ansible collections beyond what ships with `ansible-core` — spec keeps this dependency-free like the lifeos example.
- `ansible/inventory.ini` (the real one, with actual credentials/IPs) must be gitignored; only `inventory.ini.example` is committed.
- Secrets (`JWT_SECRET`) are generated on the target VM and never written to any file that leaves it or gets committed.
- VM IP is fixed at `10.10.10.51`, vmid `9001`, SSH NAT port `2223`, ingress host `openbar.seonay.eu`, k3s host `10.10.10.50`, Proxmox host `192.168.1.10`, GitHub repo `D-Seonay/bardenoa` — these are the concrete values from `docs/superpowers/specs/2026-07-26-ansible-proxmox-deploy-design.md` and must be used verbatim, not left as generic placeholders.

---

## Task 1: Scaffold `ansible/` and the inventory

**Files:**
- Create: `ansible/inventory.ini.example`
- Modify: `.gitignore`

**Interfaces:**
- Produces: three inventory groups — `[proxmox]` (host alias `proxmox-host`), `[k3s]` (host alias `k3s-host`), `[bardenoa]` (host alias `bardenoa-host`). Every later playbook's `hosts:` field targets one of these three group names exactly.

- [ ] **Step 1: Create the example inventory**

Create `ansible/inventory.ini.example`:

```ini
[proxmox]
proxmox-host ansible_host=192.168.1.10 ansible_user=root

[k3s]
k3s-host ansible_host=10.10.10.50 ansible_user=debian ansible_ssh_common_args='-o ProxyJump=root@192.168.1.10'

[bardenoa]
bardenoa-host ansible_host=10.10.10.51 ansible_user=debian ansible_ssh_common_args='-o ProxyJump=root@192.168.1.10'
```

- [ ] **Step 2: Add the real inventory to `.gitignore`**

Open `.gitignore` and add, right after the existing `# env files` block:

```gitignore
# ansible inventory (real host details, not for git)
/ansible/inventory.ini
```

- [ ] **Step 3: Verify the example inventory parses**

Run: `ansible-inventory -i ansible/inventory.ini.example --list`
Expected: exits 0, JSON output contains `"proxmox"`, `"k3s"`, and `"bardenoa"` as top-level group keys, each with one host.

- [ ] **Step 4: Verify the gitignore rule works**

Run: `cp ansible/inventory.ini.example ansible/inventory.ini && git check-ignore ansible/inventory.ini && rm ansible/inventory.ini`
Expected: `git check-ignore` prints `ansible/inventory.ini` and exits 0 (meaning it IS ignored).

- [ ] **Step 5: Commit**

```bash
git add ansible/inventory.ini.example .gitignore
git commit -m "chore(ansible): scaffold inventory for Proxmox provisioning"
```

---

## Task 2: `create-proxmox-vm.yml`

**Files:**
- Create: `ansible/create-proxmox-vm.yml`

**Interfaces:**
- Consumes: `[proxmox]` group from Task 1's inventory.
- Produces: a running VM reachable at `10.10.10.51` once cloud-init finishes — later tasks (3, 4) assume this IP is live and has the local operator's SSH public key installed.

- [ ] **Step 1: Write the playbook**

Create `ansible/create-proxmox-vm.yml`:

```yaml
# =============================================================================
# create-proxmox-vm.yml
# Crée la VM bardenoa (Debian 12 cloud image) sur l'hôte Proxmox, via SSH +
# les commandes `qm` natives — même schéma que le projet lifeos sur ce même
# hôte, dimensionné pour une stack docker-compose (Postgres + NestJS +
# Next.js) plutôt qu'un cluster K8s.
#
# Idempotent au niveau "tout ou rien" : si le vmid existe déjà, le playbook
# ne touche à rien.
#
# Usage :
#   ansible-playbook -i ansible/inventory.ini ansible/create-proxmox-vm.yml
# =============================================================================

- name: Créer la VM bardenoa sur Proxmox
  hosts: proxmox
  become: true
  gather_facts: false

  vars:
    vmid: 9001
    vm_name: bardenoa
    memory_mb: 2048
    cores: 2
    bridge: vmbr0
    storage: local-lvm
    disk_size: 20G
    image_url: "https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-generic-amd64.qcow2"
    # Même fichier que la VM lifeos sur cet hôte (même image de base) — pas
    # besoin de le télécharger deux fois.
    image_dest: "/var/lib/vz/template/iso/debian-12-generic-amd64.qcow2"
    vm_ip_cidr: "10.10.10.51/24"
    vm_gateway: "10.10.10.1"
    vm_nameserver: "1.1.1.1"
    local_ssh_pubkey: "{{ lookup('env', 'HOME') }}/.ssh/id_rsa.pub"

  tasks:
    - name: Vérifier si la VM existe déjà
      ansible.builtin.command: qm status {{ vmid }}
      register: vm_status
      changed_when: false
      failed_when: false

    - name: Télécharger l'image cloud Debian 12 sur l'hôte Proxmox
      ansible.builtin.get_url:
        url: "{{ image_url }}"
        dest: "{{ image_dest }}"
        mode: "0644"
        timeout: 300
      when: vm_status.rc != 0

    - name: Créer la VM (coquille vide)
      ansible.builtin.command: >
        qm create {{ vmid }}
        --name {{ vm_name }}
        --memory {{ memory_mb }}
        --cores {{ cores }}
        --cpu host
        --onboot 1
        --net0 virtio,bridge={{ bridge }}
      when: vm_status.rc != 0

    - name: Importer le disque cloud dans le stockage Proxmox
      ansible.builtin.command: qm importdisk {{ vmid }} {{ image_dest }} {{ storage }}
      when: vm_status.rc != 0

    - name: Attacher le disque, le cloud-init et la console série
      ansible.builtin.command: "{{ item }}"
      loop:
        - "qm set {{ vmid }} --scsihw virtio-scsi-pci --scsi0 {{ storage }}:vm-{{ vmid }}-disk-0"
        - "qm set {{ vmid }} --ide2 {{ storage }}:cloudinit"
        - "qm set {{ vmid }} --boot c --bootdisk scsi0"
        - "qm set {{ vmid }} --serial0 socket --vga serial0"
        - "qm set {{ vmid }} --ipconfig0 ip={{ vm_ip_cidr }},gw={{ vm_gateway }}"
        - "qm set {{ vmid }} --nameserver {{ vm_nameserver }}"
      when: vm_status.rc != 0

    - name: Redimensionner le disque
      ansible.builtin.command: qm resize {{ vmid }} scsi0 {{ disk_size }}
      when: vm_status.rc != 0

    - name: Copier la clé SSH publique locale sur l'hôte Proxmox
      ansible.builtin.copy:
        src: "{{ local_ssh_pubkey }}"
        dest: "/tmp/bardenoa-vm-{{ vmid }}.pub"
        mode: "0644"
      when: vm_status.rc != 0

    - name: Injecter la clé SSH via cloud-init
      ansible.builtin.command: qm set {{ vmid }} --sshkeys /tmp/bardenoa-vm-{{ vmid }}.pub
      when: vm_status.rc != 0

    - name: Démarrer la VM
      ansible.builtin.command: qm start {{ vmid }}
      when: vm_status.rc != 0

    - name: VM déjà présente — rien à faire
      ansible.builtin.debug:
        msg: "vmid {{ vmid }} existe déjà (statut : {{ vm_status.stdout }}) — playbook sauté."
      when: vm_status.rc == 0
```

- [ ] **Step 2: Syntax-check the playbook**

Run: `ansible-playbook -i ansible/inventory.ini.example ansible/create-proxmox-vm.yml --syntax-check`
Expected: `playbook: ansible/create-proxmox-vm.yml` printed, exit code 0. (This only parses the YAML/module structure — it does not connect to `192.168.1.10`, so it succeeds even though that host isn't reachable from this session.)

- [ ] **Step 3: Commit**

```bash
git add ansible/create-proxmox-vm.yml
git commit -m "feat(ansible): create bardenoa VM on Proxmox"
```

---

## Task 3: `setup-vm-nat.yml`

**Files:**
- Create: `ansible/setup-vm-nat.yml`

**Interfaces:**
- Consumes: `[proxmox]` group from Task 1; assumes the VM from Task 2 is at `10.10.10.51`.
- Produces: SSH from the LAN reachable at `192.168.1.10:2223` → VM `:22`. Does not touch any port used by another project on the same host (only ever deletes/re-adds DNAT rules matching its own `dport` values).

- [ ] **Step 1: Write the playbook**

Create `ansible/setup-vm-nat.yml`:

```yaml
# =============================================================================
# setup-vm-nat.yml
# Même hôte Proxmox WiFi-only que le projet lifeos (vmbr0 = bridge isolé
# 10.10.10.0/24, sans carte physique dedans). Ce playbook fait sortir la VM
# bardenoa vers Internet (MASQUERADE, règles déjà en place pour tout ce
# sous-réseau) et ouvre uniquement un port SSH dédié pour elle — le trafic
# HTTP passe par l'ingress k3s existant (voir configure-ingress.yml), donc
# aucune règle 80/443 supplémentaire n'est nécessaire ici.
#
# Usage :
#   ansible-playbook -i ansible/inventory.ini ansible/setup-vm-nat.yml
# =============================================================================

- name: Configurer le NAT pour la VM bardenoa sur bridge isolé
  hosts: proxmox
  become: true
  gather_facts: false

  vars:
    wan_iface: wlo1
    vm_subnet: "10.10.10.0/24"
    port_forwards:
      - { host_port: 2223, vm_ip: "10.10.10.51", vm_port: 22 } # SSH bardenoa

  tasks:
    - name: Activer le forwarding IP immédiatement
      ansible.builtin.command: sysctl -w net.ipv4.ip_forward=1
      changed_when: true

    - name: Rendre le forwarding IP persistant au reboot
      ansible.builtin.lineinfile:
        path: /etc/sysctl.d/99-bardenoa-vm-nat.conf
        line: "net.ipv4.ip_forward=1"
        create: true
        mode: "0644"

    - name: Installer iptables-persistent (sauvegarde/restauration des règles au boot)
      ansible.builtin.apt:
        name: iptables-persistent
        state: present
        update_cache: true
      environment:
        DEBIAN_FRONTEND: noninteractive

    - name: NAT sortant — le sous-réseau VM sort vers Internet via {{ wan_iface }}
      ansible.builtin.shell: >
        iptables -t nat -C POSTROUTING -s {{ vm_subnet }} -o {{ wan_iface }} -j MASQUERADE 2>/dev/null ||
        iptables -t nat -A POSTROUTING -s {{ vm_subnet }} -o {{ wan_iface }} -j MASQUERADE
      args:
        executable: /bin/bash
      changed_when: true

    - name: Autoriser le forward depuis le sous-réseau VM
      ansible.builtin.shell: >
        iptables -C FORWARD -s {{ vm_subnet }} -j ACCEPT 2>/dev/null ||
        iptables -A FORWARD -s {{ vm_subnet }} -j ACCEPT
      args:
        executable: /bin/bash
      changed_when: true

    - name: Autoriser le forward vers le sous-réseau VM
      ansible.builtin.shell: >
        iptables -C FORWARD -d {{ vm_subnet }} -j ACCEPT 2>/dev/null ||
        iptables -A FORWARD -d {{ vm_subnet }} -j ACCEPT
      args:
        executable: /bin/bash
      changed_when: true

    - name: Rediriger les ports du LAN (IP WiFi de l'hôte) vers la VM bardenoa
      ansible.builtin.shell: |
        while iptables -t nat -L PREROUTING -n --line-numbers | \
              awk -v p="{{ item.host_port }}" '$0 ~ ("dpt:"p" ") {print $1; exit}' | \
              grep -q .; do
          line=$(iptables -t nat -L PREROUTING -n --line-numbers | \
                 awk -v p="{{ item.host_port }}" '$0 ~ ("dpt:"p" ") {print $1; exit}')
          iptables -t nat -D PREROUTING "$line"
        done
        iptables -t nat -A PREROUTING -i {{ wan_iface }} -p tcp --dport {{ item.host_port }} \
          -j DNAT --to-destination {{ item.vm_ip }}:{{ item.vm_port }}
      args:
        executable: /bin/bash
      loop: "{{ port_forwards }}"
      changed_when: true

    - name: Sauvegarder les règles iptables (persistant au reboot)
      ansible.builtin.command: netfilter-persistent save
      changed_when: true

    - name: Résumé
      ansible.builtin.debug:
        msg: >-
          NAT actif. Depuis ton Mac : ssh -p 2223 debian@192.168.1.10 pour la
          VM bardenoa (10.10.10.51). Le trafic web passe par l'ingress k3s
          existant — lance configure-ingress.yml pour le brancher.
```

- [ ] **Step 2: Syntax-check the playbook**

Run: `ansible-playbook -i ansible/inventory.ini.example ansible/setup-vm-nat.yml --syntax-check`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add ansible/setup-vm-nat.yml
git commit -m "feat(ansible): NAT SSH access to the bardenoa VM"
```

---

## Task 4: `deploy-bardenoa.yml`

**Files:**
- Create: `ansible/deploy-bardenoa.yml`

**Interfaces:**
- Consumes: `[bardenoa]` group from Task 1 (`ansible_user=debian`, IP `10.10.10.51`, reachable via the SSH NAT from Task 3 or directly from the Proxmox host).
- Produces: `/opt/bardenoa` on the VM running `docker compose up -d` (Postgres + API + web, per the existing `docker-compose.yml`), `/opt/bardenoa/.env` containing a generated `JWT_SECRET`, and `/root/.ssh/id_ed25519_bardenoa_deploy(.pub)` as the GitHub deploy key.

- [ ] **Step 1: Write the playbook**

Create `ansible/deploy-bardenoa.yml`:

```yaml
# =============================================================================
# deploy-bardenoa.yml
# Déploie la stack docker-compose de bardenoa (Postgres + API NestJS + web
# Next.js) sur sa VM dédiée. Contrairement au cluster k3s de lifeos (installé
# à la main), docker-compose est trivial à automatiser de bout en bout :
# ce playbook installe Docker, clone le repo privé via une deploy key
# dédiée, génère un JWT_SECRET s'il n'existe pas encore, et lance la stack.
#
# Idempotent : rejouable après chaque `git push` sur bardenoa pour
# redéployer (pull + rebuild + up), sans jamais régénérer un secret déjà en
# place ni recréer la deploy key.
#
# Premier run : le clone échoue tant que la deploy key générée sur la VM
# n'est pas enregistrée sur GitHub — le playbook affiche la clé publique et
# la commande à lancer, puis s'arrête. Relance le playbook une fois la clé
# enregistrée.
#
# Usage :
#   ansible-playbook -i ansible/inventory.ini ansible/deploy-bardenoa.yml
# =============================================================================

- name: Déployer bardenoa sur sa VM
  hosts: bardenoa
  become: true
  gather_facts: false

  vars:
    github_repo: "D-Seonay/bardenoa"
    app_dir: /opt/bardenoa
    deploy_key_path: "/root/.ssh/id_ed25519_bardenoa_deploy"

  tasks:
    - name: Installer git
      ansible.builtin.apt:
        name: git
        state: present
        update_cache: true

    - name: Installer Docker (script officiel get.docker.com)
      ansible.builtin.shell: curl -fsSL https://get.docker.com | sh
      args:
        creates: /usr/bin/docker

    - name: Ajouter l'utilisateur {{ ansible_user }} au groupe docker
      ansible.builtin.user:
        name: "{{ ansible_user }}"
        groups: docker
        append: true

    - name: Créer le dossier ~/.ssh pour root
      ansible.builtin.file:
        path: /root/.ssh
        state: directory
        mode: "0700"

    - name: Générer une deploy key SSH dédiée si absente
      ansible.builtin.command: ssh-keygen -t ed25519 -f {{ deploy_key_path }} -N "" -C "bardenoa-vm-deploy"
      args:
        creates: "{{ deploy_key_path }}"

    - name: Lire la clé publique générée
      ansible.builtin.command: cat {{ deploy_key_path }}.pub
      register: deploy_pubkey
      changed_when: false

    - name: Vérifier si le repo est déjà cloné
      ansible.builtin.stat:
        path: "{{ app_dir }}/.git"
      register: repo_git_dir

    - name: Cloner le repo bardenoa (première fois)
      ansible.builtin.git:
        repo: "git@github.com:{{ github_repo }}.git"
        dest: "{{ app_dir }}"
        version: main
        key_file: "{{ deploy_key_path }}"
        accept_hostkey: true
      register: clone_result
      failed_when: false
      when: not repo_git_dir.stat.exists

    - name: Arrêter avec les instructions si le clone a échoué (deploy key pas encore enregistrée)
      ansible.builtin.fail:
        msg: |
          Le clone a échoué — la deploy key générée sur cette VM n'est
          probablement pas encore enregistrée sur GitHub.

          Clé publique :
            {{ deploy_pubkey.stdout }}

          Enregistre-la en lecture seule sur le repo, puis relance ce
          playbook :
            gh repo deploy-key add - --repo {{ github_repo }} --title bardenoa-vm --read-only <<< "{{ deploy_pubkey.stdout }}"
      when: not repo_git_dir.stat.exists and clone_result is failed

    - name: Mettre à jour le repo (déploiements suivants)
      ansible.builtin.git:
        repo: "git@github.com:{{ github_repo }}.git"
        dest: "{{ app_dir }}"
        version: main
        key_file: "{{ deploy_key_path }}"
        accept_hostkey: true
      when: repo_git_dir.stat.exists

    - name: Vérifier si le fichier .env de production existe déjà
      ansible.builtin.stat:
        path: "{{ app_dir }}/.env"
      register: env_file

    - name: Générer un JWT_SECRET aléatoire
      ansible.builtin.command: openssl rand -hex 32
      register: generated_jwt_secret
      changed_when: false
      when: not env_file.stat.exists

    - name: Écrire le fichier .env de production
      ansible.builtin.copy:
        dest: "{{ app_dir }}/.env"
        content: "JWT_SECRET={{ generated_jwt_secret.stdout }}\n"
        mode: "0600"
      when: not env_file.stat.exists

    - name: Lancer la stack avec Docker Compose
      ansible.builtin.command: docker compose up -d --build
      args:
        chdir: "{{ app_dir }}"
      changed_when: true
```

- [ ] **Step 2: Syntax-check the playbook**

Run: `ansible-playbook -i ansible/inventory.ini.example ansible/deploy-bardenoa.yml --syntax-check`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add ansible/deploy-bardenoa.yml
git commit -m "feat(ansible): deploy the docker-compose stack to the bardenoa VM"
```

---

## Task 5: `configure-ingress.yml` and the Ingress template

**Files:**
- Create: `ansible/templates/ingress.yml.j2`
- Create: `ansible/configure-ingress.yml`

**Interfaces:**
- Consumes: `[k3s]` group from Task 1; assumes the bardenoa VM from Task 2 is reachable at `10.10.10.51:8080` (the `web` service's host-mapped port in `docker-compose.yml`) from the k3s node over the shared bridge.
- Produces: a `default/bardenoa` Service+Endpoints+Ingress in the k3s cluster routing `openbar.seonay.eu` → `10.10.10.51:8080`.

- [ ] **Step 1: Write the Jinja2 template**

Create `ansible/templates/ingress.yml.j2`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: bardenoa
  namespace: default
spec:
  ports:
    - port: {{ bardenoa_port }}
      targetPort: {{ bardenoa_port }}
---
apiVersion: v1
kind: Endpoints
metadata:
  name: bardenoa
  namespace: default
subsets:
  - addresses:
      - ip: {{ bardenoa_ip }}
    ports:
      - port: {{ bardenoa_port }}
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: bardenoa
  namespace: default
spec:
  ingressClassName: traefik
  rules:
    - host: {{ ingress_host }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: bardenoa
                port:
                  number: {{ bardenoa_port }}
```

- [ ] **Step 2: Write the playbook**

Create `ansible/configure-ingress.yml`:

```yaml
# =============================================================================
# configure-ingress.yml
# Route openbar.seonay.eu vers la VM bardenoa via l'ingress Traefik déjà en
# place sur le cluster k3s lifeos, hébergé sur ce même hôte Proxmox. Un
# Service sans selector + des Endpoints pointant sur l'IP de la VM bardenoa
# permettent à Traefik de proxifier vers une VM externe au cluster.
#
# Aucune règle NAT supplémentaire n'est nécessaire côté hôte Proxmox :
# Traefik route déjà 80/443 par en-tête Host, donc ce playbook se contente
# d'ajouter une règle de routage applicative.
#
# HTTP simple pour l'instant, pas de cert-manager sur ce cluster.
#
# Usage :
#   ansible-playbook -i ansible/inventory.ini ansible/configure-ingress.yml
# =============================================================================

- name: Router openbar.seonay.eu vers la VM bardenoa
  hosts: k3s
  become: true
  gather_facts: false

  vars:
    bardenoa_ip: "10.10.10.51"
    bardenoa_port: 8080
    ingress_host: "openbar.seonay.eu"
    kubeconfig: /etc/rancher/k3s/k3s.yaml

  tasks:
    - name: Générer le manifeste Kubernetes
      ansible.builtin.template:
        src: templates/ingress.yml.j2
        dest: /tmp/bardenoa-ingress.yml
        mode: "0644"

    - name: Appliquer le manifeste
      ansible.builtin.command: kubectl apply -f /tmp/bardenoa-ingress.yml
      environment:
        KUBECONFIG: "{{ kubeconfig }}"
      changed_when: true

    - name: Résumé
      ansible.builtin.debug:
        msg: >-
          Ingress appliqué. Une fois le DNS de {{ ingress_host }} propagé
          vers l'IP publique de la Freebox : curl http://{{ ingress_host }}
          doit répondre la page d'accueil bardenoa.
```

- [ ] **Step 3: Verify the template renders to valid YAML**

Run:

```bash
python3 -c "
import jinja2, yaml
env = jinja2.Environment()
tpl = env.from_string(open('ansible/templates/ingress.yml.j2').read())
rendered = tpl.render(bardenoa_ip='10.10.10.51', bardenoa_port=8080, ingress_host='openbar.seonay.eu')
docs = list(yaml.safe_load_all(rendered))
assert len(docs) == 3, f'expected 3 documents, got {len(docs)}'
assert docs[0]['kind'] == 'Service'
assert docs[1]['kind'] == 'Endpoints'
assert docs[1]['subsets'][0]['addresses'][0]['ip'] == '10.10.10.51'
assert docs[2]['kind'] == 'Ingress'
assert docs[2]['spec']['rules'][0]['host'] == 'openbar.seonay.eu'
print('OK: template renders to 3 valid YAML documents')
"
```

Expected: `OK: template renders to 3 valid YAML documents`. If `jinja2`/`yaml` aren't importable, run `pip install jinja2 pyyaml` first (both are already transitive dependencies of `ansible-core`, so this should already be satisfied by the same Python `ansible-playbook` uses — run `ansible-playbook --version` output's "python version" path if `python3` resolves to a different interpreter).

- [ ] **Step 4: Syntax-check the playbook**

Run: `ansible-playbook -i ansible/inventory.ini.example ansible/configure-ingress.yml --syntax-check`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add ansible/templates/ingress.yml.j2 ansible/configure-ingress.yml
git commit -m "feat(ansible): route openbar.seonay.eu to the bardenoa VM via k3s ingress"
```

---

## Task 6: `ansible/README.md`

**Files:**
- Create: `ansible/README.md`

**Interfaces:**
- Consumes: nothing (documentation only) — references the exact commands and values fixed in Tasks 1–5.

- [ ] **Step 1: Write the README**

Create `ansible/README.md`:

```markdown
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
```

- [ ] **Step 2: Verify the documented commands match the actual playbook filenames**

Run: `grep -o 'ansible/[a-z-]*\.yml' ansible/README.md | sort -u`
Expected output (four lines, matching the files created in Tasks 2–5):
```
ansible/configure-ingress.yml
ansible/create-proxmox-vm.yml
ansible/deploy-bardenoa.yml
ansible/setup-vm-nat.yml
```

- [ ] **Step 3: Commit**

```bash
git add ansible/README.md
git commit -m "docs(ansible): document the bardenoa Proxmox provisioning workflow"
```
