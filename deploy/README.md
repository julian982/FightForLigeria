# Héberger le serveur de jeu sur le VPS

Le serveur de jeu tourne derrière le **Traefik commun du VPS** (dépôt `vps-infra`), comme TTS et les futurs projets :

```
internet ──wss/https──▶ Traefik (vps-infra) ──réseau edge──▶ ffl-game:2567   (512 Mo, 1 cœur max)
                                                                  │ réseau interne ffl-db
                                                       ffl-db (MariaDB, comptes) ◀── ffl-backup (sauvegarde chaque jour)
```

- **Projet isolé.** C'est un projet Docker à part (`/opt/fightforligeria`). Seul le jeu est branché sur `edge`. Il a **sa propre MariaDB**, sur un réseau interne sans accès à internet. Il ne voit ni la base ni le back de TTS, et n'ouvre aucun port sur le VPS.
- **Le jeu ne dépend pas de la base.** Si elle est en panne, on joue toujours en invité ; les comptes reviennent tout seuls dès qu'elle répond.
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
curl -fsSL https://raw.githubusercontent.com/julian982/FightForLigeria/main/deploy/.env.example -o .env
chmod 600 .env
nano .env                        # DB_PASSWORD (obligatoire), puis le SMTP : voir « Comptes et emails »
docker compose up -d
docker compose logs --tail 5     # « serveur prêt sur ws://localhost:2567 »
curl -sI https://fightforligeria.trouve-ton-serveur.fr | head -1   # 404 = normal : c'est le serveur de jeu, sans page d'accueil
```

La route `ffl@docker` apparaît en vert dans le tableau de bord Traefik.

## Comptes et emails

Les comptes sont facultatifs pour les joueurs. Ils ont besoin de deux choses, réglées dans `/opt/fightforligeria/.env` :

1. **La base.** `DB_PASSWORD` est obligatoire : sans lui, `docker compose` refuse de démarrer. Le déploiement automatique échoue alors aussi, mais sans rien casser : l'ancien conteneur continue de tourner. Pour générer un mot de passe : `openssl rand -base64 32 | tr -d '/+='`.
   - Les tables sont créées et mises à jour toutes seules par le serveur de jeu au démarrage.
   - Ne change plus `DB_PASSWORD` une fois la base créée : MariaDB garde celui du premier démarrage.
2. **L'envoi des emails (SMTP).** La confirmation d'adresse est obligatoire pour se connecter, donc il faut un SMTP qui marche.
   - Remplis `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` et `MAIL_FROM`.
   - Sans SMTP, les emails sont seulement écrits dans `docker compose logs game` : pratique pour tester, pas pour de vrais joueurs.
   - Si l'adresse d'envoi est sur `trouve-ton-serveur.fr`, ajoute à ce domaine les enregistrements **SPF** et **DKIM** donnés par ton fournisseur d'email. Sinon les emails partent en indésirables.

Après une modification de `.env` : `docker compose up -d`. Pour vérifier :

```bash
docker compose logs game | grep comptes     # « comptes : base de données prête »
curl -s https://fightforligeria.trouve-ton-serveur.fr/api/me   # {"error":"Session expirée…"} = l'API répond
```

### Sauvegardes

- `ffl-backup` fait une sauvegarde complète de la base au démarrage, puis toutes les 24 h, dans `/opt/fightforligeria/backups/`.
- Les sauvegardes de plus de 14 jours sont effacées.
- Pense à copier ce dossier ailleurs de temps en temps : une sauvegarde sur le même disque ne protège pas d'une panne du VPS.

Pour restaurer une sauvegarde (cela remplace le contenu actuel) :

```bash
cd /opt/fightforligeria
gunzip -c backups/ffl-AAAA-MM-JJ.sql.gz | docker compose exec -T -e MYSQL_PWD="$(grep ^DB_PASSWORD= .env | cut -d= -f2-)" db mariadb -u ffl ffl
```

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
docker stats ffl-game ffl-db # mémoire et processeur
ls -lh backups/              # sauvegardes de la base
docker compose restart       # redémarrer (les parties en cours sont perdues)
docker compose down          # tout arrêter (le sous-domaine répond alors 404, rien d'autre n'est touché ; la base est gardée)
# ne jamais faire « docker compose down -v » : -v efface aussi la base des comptes
```
