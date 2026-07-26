# CD via Self-Hosted GitHub Actions Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate bardenoa's redeployment on every push to `main` by installing a GitHub Actions self-hosted runner directly on the bardenoa VM, and a workflow that runs `git pull && docker compose up -d --build` in `/opt/bardenoa`.

**Architecture:** One new Ansible playbook installs and registers the runner as a systemd service on the VM (outbound-only connection to GitHub, no inbound exposure). One new GitHub Actions workflow file triggers on push to `main` and runs a single deploy step on that runner, reusing the exact `/opt/bardenoa` directory `deploy-bardenoa.yml` already manages.

**Tech Stack:** Ansible (core only, `ansible.builtin.*` modules — `uri` to resolve the latest runner release, `unarchive` to install it), GitHub Actions YAML, systemd (via the runner's own `svc.sh` installer).

## Global Constraints

- Every playbook must be re-runnable without side effects (idempotent) — gated on the existence of `~/actions-runner/.runner` (all-or-nothing, matching the pattern already used in `ansible/create-proxmox-vm.yml`).
- No new Ansible collections beyond what ships with `ansible-core` — only `ansible.builtin.*` modules.
- The runner registration token (`github_runner_token`) is short-lived (~1h) and must never be committed or written to any file — passed only via `-e` on the command line, and the task that uses it must have `no_log: true` so it never appears in Ansible's own console output.
- The runner process (and its systemd service) runs as the `debian` user, never root — `debian` already has `docker` group membership from `ansible/deploy-bardenoa.yml`, which is what the deploy step needs.
- The workflow deploys unconditionally on every push to `main` — no lint/test gate (the repo has ~194 pre-existing lint errors unrelated to this work; gating on them would block every future deploy).
- Exact values: GitHub repo `D-Seonay/bardenoa`, runner label/name `bardenoa-vm`, target directory `/opt/bardenoa`, targets the `bardenoa` inventory group — these are the concrete values from `docs/superpowers/specs/2026-07-27-github-actions-cd-design.md` and must be used verbatim.

---

## Task 1: `ansible/setup-github-runner.yml`

**Files:**
- Create: `ansible/setup-github-runner.yml`

**Interfaces:**
- Consumes: `[bardenoa]` group from `ansible/inventory.ini` (`ansible_user=debian`, already has `docker` group membership from `ansible/deploy-bardenoa.yml`).
- Produces: a running systemd service (`actions.runner.*`) on the VM, registered with GitHub as a runner labeled `bardenoa-vm`, listening for jobs on the `D-Seonay/bardenoa` repo. Task 2's workflow assumes this runner exists and is online.

- [ ] **Step 1: Write the playbook**

Create `ansible/setup-github-runner.yml`:

```yaml
# =============================================================================
# setup-github-runner.yml
# Installe et enregistre un runner GitHub Actions auto-hébergé directement
# sur la VM bardenoa, pour que le déploiement continu (.github/workflows/
# deploy.yml) n'ait besoin d'aucune exposition entrante : le runner ouvre
# une connexion sortante vers GitHub, insensible au fait que l'hôte Proxmox
# WiFi-only change d'IP (vécu pendant cette même session de travail).
#
# Idempotent au niveau "tout ou rien", comme create-proxmox-vm.yml : si
# ~/actions-runner/.runner existe déjà, le playbook ne touche à rien (le
# token de registration expire de toute façon après un premier usage).
#
# Prérequis : un token de registration GitHub, valable ~1h, jamais commité :
#   gh api -X POST repos/D-Seonay/bardenoa/actions/runners/registration-token --jq .token
#
# Usage :
#   ansible-playbook -i ansible/inventory.ini ansible/setup-github-runner.yml \
#     -e github_runner_token=<token>
# =============================================================================

- name: Installer et enregistrer le runner GitHub Actions sur la VM bardenoa
  hosts: bardenoa
  gather_facts: false

  vars:
    github_repo: "D-Seonay/bardenoa"
    runner_dir: "/home/{{ ansible_user }}/actions-runner"
    github_runner_token: ""

  tasks:
    - name: Vérifier si le runner est déjà installé et enregistré
      ansible.builtin.stat:
        path: "{{ runner_dir }}/.runner"
      register: runner_config

    - name: Refuser de continuer sans token de registration
      ansible.builtin.fail:
        msg: >-
          github_runner_token est vide. Génère-en un avec :
          gh api -X POST repos/{{ github_repo }}/actions/runners/registration-token --jq .token
          puis relance avec -e github_runner_token=<token>.
      when: not runner_config.stat.exists and github_runner_token == ""

    - name: Créer le dossier du runner
      ansible.builtin.file:
        path: "{{ runner_dir }}"
        state: directory
        mode: "0755"
      when: not runner_config.stat.exists

    - name: Résoudre la dernière release du runner GitHub Actions
      ansible.builtin.uri:
        url: https://api.github.com/repos/actions/runner/releases/latest
        return_content: true
      register: runner_release
      when: not runner_config.stat.exists

    - name: Extraire l'URL de téléchargement linux-x64
      ansible.builtin.set_fact:
        runner_tarball_url: "{{ (runner_release.json.assets | selectattr('name', 'match', '^actions-runner-linux-x64-.*\\.tar\\.gz$') | first).browser_download_url }}"
      when: not runner_config.stat.exists

    - name: Télécharger et extraire l'archive du runner
      ansible.builtin.unarchive:
        src: "{{ runner_tarball_url }}"
        dest: "{{ runner_dir }}"
        remote_src: true
      when: not runner_config.stat.exists

    - name: Enregistrer le runner auprès de GitHub
      ansible.builtin.command: >
        ./config.sh --url https://github.com/{{ github_repo }}
        --token {{ github_runner_token }}
        --unattended --labels bardenoa-vm --name bardenoa-vm
      args:
        chdir: "{{ runner_dir }}"
      no_log: true
      when: not runner_config.stat.exists

    - name: Installer le service systemd du runner
      ansible.builtin.command: "./svc.sh install {{ ansible_user }}"
      become: true
      args:
        chdir: "{{ runner_dir }}"
      when: not runner_config.stat.exists

    - name: Démarrer le service du runner
      ansible.builtin.command: ./svc.sh start
      become: true
      args:
        chdir: "{{ runner_dir }}"
      when: not runner_config.stat.exists

    - name: Vérifier l'état du service
      ansible.builtin.command: ./svc.sh status
      become: true
      args:
        chdir: "{{ runner_dir }}"
      register: runner_status
      changed_when: false

    - name: Résumé
      ansible.builtin.debug:
        msg: "{{ runner_status.stdout }}"
```

- [ ] **Step 2: Syntax-check the playbook**

Run: `ansible-playbook -i ansible/inventory.ini.example ansible/setup-github-runner.yml --syntax-check`
Expected: `playbook: ansible/setup-github-runner.yml` printed, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add ansible/setup-github-runner.yml
git commit -m "feat(ansible): install a self-hosted GitHub Actions runner on the bardenoa VM"
```

---

## Task 2: `.github/workflows/deploy.yml`

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: the runner labeled `self-hosted` registered by Task 1 (GitHub routes jobs with `runs-on: self-hosted` to any runner carrying that built-in label — the runner from Task 1 always carries it regardless of its custom `bardenoa-vm` label).
- Produces: nothing consumed by later tasks — this is the workflow's terminal deliverable.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/deploy.yml`:

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

- [ ] **Step 2: Validate the workflow YAML structure**

Run:

```bash
python3 -c "
import yaml
with open('.github/workflows/deploy.yml') as f:
    doc = yaml.safe_load(f)
# YAML parses the bare 'on:' key as boolean True — this is expected/known
# PyYAML behavior for GitHub Actions workflow files, not a bug in the file.
assert doc[True]['push']['branches'] == ['main'], doc[True]
job = doc['jobs']['deploy']
assert job['runs-on'] == 'self-hosted', job
steps = job['steps']
assert len(steps) == 1, steps
assert 'cd /opt/bardenoa' in steps[0]['run']
assert 'git pull' in steps[0]['run']
assert 'docker compose up -d --build' in steps[0]['run']
print('OK: workflow structure valid')
"
```

Expected: `OK: workflow structure valid`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat(ci): auto-deploy bardenoa on push to main via self-hosted runner"
```

---

## Task 3: `ansible/README.md` — document the CD workflow

**Files:**
- Modify: `ansible/README.md`

**Interfaces:**
- Consumes: nothing (documentation only) — references the exact commands and values fixed in Tasks 1–2.

- [ ] **Step 1: Add a new step to the Usage section**

In `ansible/README.md`, in the ` ```bash ` usage block that currently ends
with step 4 (`configure-ingress.yml`), add a step 5 right after it, inside
the same code fence:

```bash

# 5. (Une seule fois) Installe un runner GitHub Actions auto-hébergé sur la
#    VM, pour que chaque push sur main redéploie automatiquement (voir
#    .github/workflows/deploy.yml). Le token expire après ~1h, à régénérer
#    si tu relances ce playbook plus tard.
gh api -X POST repos/D-Seonay/bardenoa/actions/runners/registration-token --jq .token
ansible-playbook -i ansible/inventory.ini ansible/setup-github-runner.yml \
  -e github_runner_token=<token-collé-ci-dessus>
```

- [ ] **Step 2: Add a security note**

Right after the usage block (before the `## DNS` section), add:

```markdown
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
```

- [ ] **Step 3: Add a Dépannage entry for a half-installed runner**

In the `## Dépannage` section, add a new entry (matching the style of the
existing "VM à moitié provisionnée" entry):

```markdown
**Runner à moitié installé** : `setup-github-runner.yml` est idempotent
seulement sur l'existence de `~/actions-runner/.runner` sur la VM — si
`config.sh`/`svc.sh install`/`svc.sh start` échoue après le téléchargement
de l'archive (ex : token expiré), le dossier existe mais `.runner` n'y est
peut-être pas encore, donc un nouveau run repart proprement de zéro. Si au
contraire `.runner` existe mais le service ne tourne pas
(`sudo ~/actions-runner/svc.sh status` sur la VM), supprime le runner côté
GitHub (Settings → Actions → Runners), `rm -rf ~/actions-runner` sur la VM,
régénère un token, et relance le playbook.
```

- [ ] **Step 4: Verify the new content references the right files and commands**

Run: `grep -c "setup-github-runner.yml" ansible/README.md`
Expected: `2` (once in the usage block, once in the Dépannage entry).

Run: `grep -c "registration-token" ansible/README.md`
Expected: `1`.

- [ ] **Step 5: Commit**

```bash
git add ansible/README.md
git commit -m "docs(ansible): document the self-hosted runner setup and CD workflow"
```
