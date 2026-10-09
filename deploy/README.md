# Héberger le serveur de jeu sur le VPS (à côté de TTS)

Le serveur de jeu tourne dans **son propre projet Docker**, dans son propre dossier, avec des limites de ressources. Il ne partage ni réseau, ni volume, ni base de données avec TTS.

**Le seul contact avec TTS** : le Nginx de TTS fait suivre le sous-domaine du jeu vers le conteneur du jeu, ce qui nécessite deux choses :
- un **fichier de configuration à part**, sans aucune ligne existante modifiée ;
- **un réseau Docker de plus** pour le conteneur Nginx.

Tout se retire en deux minutes (voir « Revenir en arrière »).

```
internet ──https/wss──▶ Nginx de TTS ──(réseau ffl-proxy)──▶ ffl-game:2567  (512 Mo max, 1 cœur max)
                         │
                         └──▶ front / back / MariaDB de TTS (inchangés, invisibles pour le jeu)
```

Dans ce guide, remplace `jeu.example.fr` par le sous-domaine choisi, par exemple `jeu.trouve-ton-serveur.fr`.

---

## 1. DNS

Chez ton registrar (ou ton DNS), ajoute un enregistrement **A** `jeu` → l'IP de ton VPS, plus un enregistrement **AAAA** si tu as de l'IPv6. Attends qu'il réponde :

```bash
ping jeu.example.fr
```

## 2. Publier l'image du serveur (GitHub)

1. Pousse sur `main` : l'action **« Serveur de jeu »** lance les tests, construit l'image et la publie sur `ghcr.io/julian982/fightforligeria-server`. Le déploiement sur le VPS sera sauté tant que les secrets de l'étape 5 n'existent pas.
2. Sur GitHub, va dans ton profil → **Packages** → `fightforligeria-server` → **Package settings** → **Change visibility** → **Public**. Comme le code est public, l'image peut l'être aussi, et ton VPS pourra la télécharger sans identifiants.

## 3. Lancer le jeu sur le VPS

```bash
# réseau partagé entre le jeu et le Nginx de TTS (une seule fois)
docker network create ffl-proxy

# le dossier du jeu, à part de TTS
sudo mkdir -p /opt/fightforligeria && sudo chown "$USER" /opt/fightforligeria
cd /opt/fightforligeria
curl -fsSLO https://raw.githubusercontent.com/julian982/FightForLigeria/main/deploy/docker-compose.yml

docker compose up -d
docker compose logs --tail 20      # doit afficher « serveur prêt »
```

## 4. Brancher le Nginx de TTS

**a. Trouver le conteneur Nginx de TTS :**

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}'
```

Dans la suite, on l'appelle `tts-nginx`. Mets son vrai nom.

**b. Le relier au réseau du jeu.** C'est immédiat et ça ne redémarre rien :

```bash
docker network connect ffl-proxy tts-nginx
```

Pour que ça tienne après un `docker compose up` de TTS, ajoute aussi le réseau dans le `docker-compose.yml` de TTS, sur le service nginx uniquement :

```yaml
services:
  nginx:            # ton service nginx existant
    # …tout ce qui existe déjà reste identique…
    networks:
      - default     # ⚠ garde les réseaux qu'il a déjà ; s'il n'en listait aucun, c'est « default »
      - ffl-proxy

networks:
  ffl-proxy:
    external: true
```

**c. Le certificat HTTPS.** Copie `deploy/nginx/fightforligeria.conf` dans le dossier de configuration de ton Nginx (souvent `conf.d/`, monté depuis le dossier de TTS). Remplace `jeu.example.fr`, puis :

1. **Commente d'abord le second bloc `server { listen 443 … }`.** Le certificat n'existe pas encore, et Nginx refuserait de recharger.
2. Teste puis recharge, **toujours dans cet ordre** :

   ```bash
   docker exec tts-nginx nginx -t && docker exec tts-nginx nginx -s reload
   ```

   Si `nginx -t` signale une erreur, rien n'est rechargé et TTS continue de tourner normalement.
3. Demande le certificat avec le même outil que pour TTS. Par exemple, si tu as un service `certbot` en mode webroot :

   ```bash
   docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d jeu.example.fr
   ```

4. Décommente le bloc 443, vérifie que les chemins `ssl_certificate` correspondent à ceux de TTS, puis refais `nginx -t && nginx -s reload`.

> La config joint le jeu via une variable (`set $ffl_upstream …`). Si le conteneur du jeu est arrêté, Nginx démarre quand même et **TTS n'est jamais bloqué** : seul le sous-domaine du jeu répond une erreur 502.

**d. Vérifier :** `https://jeu.example.fr` doit répondre. Une page « Cannot GET / » ou une erreur 404 est **normale** : c'est le serveur de jeu qui répond, et il n'a pas de page d'accueil.

## 5. Déploiement automatique (GitHub)

Dans le dépôt GitHub → **Settings** → **Secrets and variables** → **Actions** :

| Type | Nom | Valeur |
|---|---|---|
| Secret | `VPS_HOST` | l'IP ou le nom du VPS |
| Secret | `VPS_USER` | l'utilisateur SSH qui peut lancer `docker` |
| Secret | `VPS_SSH_KEY` | une **clé privée SSH dédiée** à ce déploiement (sa clé publique va dans `~/.ssh/authorized_keys` de cet utilisateur) |
| Secret | `VPS_PORT` | (facultatif) le port SSH s'il n'est pas 22 |
| Variable | `GAME_SERVER_URL` | `wss://jeu.example.fr` |

- **Pour le serveur :** à chaque push qui touche `shared/` ou `server/`, l'action teste, publie l'image puis exécute sur le VPS `cd /opt/fightforligeria && docker compose pull && docker compose up -d`. Elle ne touche à rien d'autre.
- **Pour la page du jeu :** la variable `GAME_SERVER_URL` est intégrée à la page GitHub Pages, donc tes amis n'ont rien à saisir dans le lobby. Relance l'action « Tests et déploiement GitHub Pages », ou pousse un commit, pour la prendre en compte.

> Un utilisateur qui peut lancer `docker` a, en pratique, des droits élevés sur la machine. Utilise une clé dédiée, que tu peux révoquer facilement.

## 6. Au quotidien

```bash
cd /opt/fightforligeria
docker compose ps                 # état
docker compose logs -f            # journaux en direct
docker stats ffl-game             # mémoire et processeur utilisés
docker compose restart            # redémarrer (les parties en cours sont perdues)
```

## Revenir en arrière (tout retirer)

```bash
# côté Nginx de TTS
rm <dossier conf Nginx>/fightforligeria.conf
docker exec tts-nginx nginx -t && docker exec tts-nginx nginx -s reload
docker network disconnect ffl-proxy tts-nginx      # et retirer ffl-proxy du compose de TTS

# côté jeu
cd /opt/fightforligeria && docker compose down
docker network rm ffl-proxy
```
