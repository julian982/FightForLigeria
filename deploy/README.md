# Héberger le serveur de jeu sur le VPS

Le serveur de jeu tourne derrière le **Traefik commun du VPS** (dépôt `vps-infra`), comme TTS et les futurs projets :

```
internet ──wss──▶ Traefik (vps-infra) ──réseau edge──▶ ffl-game:2567   (512 Mo, 1 cœur max)
```

- **Projet isolé.** C'est un projet Docker à part (`/opt/fightforligeria`). Il est branché uniquement sur `edge`, ne voit ni la MariaDB ni le back de TTS, et n'ouvre aucun port sur le VPS.
- **HTTPS automatique.** Traefik obtient et renouvelle tout seul le certificat de `fightforligeria.trouve-ton-serveur.fr`, grâce aux labels de `docker-compose.yml`.
- **Indépendant des autres projets.** Arrêter ou planter le jeu ne touche ni TTS ni les autres projets, et inversement.

## Prérequis

- Traefik est en place sur le VPS (voir le README de `vps-infra`).
- Un enregistrement DNS **A** `fightforligeria` pointe vers l'IP du VPS.
- Le package `fightforligeria-server` est **public**, pour que le VPS le télécharge sans identifiants. Pour le rendre public, sur GitHub : profil → **Packages** → `fightforligeria-server` → **Package settings** → **Change visibility**.

## Première mise en ligne

```bash
sudo mkdir -p /opt/fightforligeria && sudo chown "$USER" /opt/fightforligeria
cd /opt/fightforligeria
curl -fsSLO https://raw.githubusercontent.com/julian982/FightForLigeria/main/deploy/docker-compose.yml
docker compose up -d
docker compose logs --tail 5     # « serveur prêt sur ws://localhost:2567 »
curl -sI https://fightforligeria.trouve-ton-serveur.fr | head -1   # 404 = normal : c'est le serveur de jeu, sans page d'accueil
```

La route `ffl@docker` apparaît en vert dans le tableau de bord Traefik.

## Déploiement automatique et adresse par défaut (GitHub)

Dans le dépôt FightForLigeria → **Settings** → **Secrets and variables** → **Actions** :

| Type | Nom | Valeur |
|---|---|---|
| Secret | `VPS_HOST` | l'IP du VPS |
| Secret | `VPS_USER` | l'utilisateur SSH qui lance `docker` |
| Secret | `VPS_SSH_KEY` | une **clé privée SSH dédiée** (sa clé publique dans `~/.ssh/authorized_keys` de cet utilisateur) |
| Secret | `VPS_PORT` | (facultatif) port SSH s'il n'est pas 22 |
| Variable | `GAME_SERVER_URL` | `wss://fightforligeria.trouve-ton-serveur.fr` |

- **Côté serveur.** À chaque push sur le jeu, l'action :
  1. lance les tests ;
  2. publie l'image ;
  3. sur le VPS, récupère le `docker-compose.yml` du dépôt dans `/opt/fightforligeria` ;
  4. fait `docker compose pull && up -d`.

  Elle ne touche à rien d'autre.
- **Côté page du jeu.** `GAME_SERVER_URL` est intégrée à la page GitHub Pages : tes amis n'ont rien à saisir dans le lobby. Pour qu'elle soit prise en compte, relance l'action « Tests et déploiement GitHub Pages », ou pousse un commit.

> Un utilisateur qui peut lancer `docker` a, en pratique, des droits élevés sur la machine. Utilise une clé dédiée, que tu peux révoquer facilement.

## Au quotidien

```bash
cd /opt/fightforligeria
docker compose ps            # état
docker compose logs -f       # journaux en direct
docker stats ffl-game        # mémoire et processeur
docker compose restart       # redémarrer (les parties en cours sont perdues)
docker compose down          # tout arrêter (le sous-domaine répond alors 404, rien d'autre n'est touché)
```
