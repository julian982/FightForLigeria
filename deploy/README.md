# Héberger le serveur de jeu sur le VPS de TTS

Le serveur de jeu tourne dans **son propre projet Docker** (`/opt/fightforligeria`), sur **son propre réseau**, avec des limites de ressources. Il ne voit ni la MariaDB, ni le back, ni le front de TTS. Un `docker compose down` de TTS ne l'arrête pas, et inversement.

```
internet ──https / wss──▶ tts-nginx (réseau « host », celui de TTS)
                            ├─ trouve-ton-serveur.fr      ──▶ 127.0.0.1:4000 / 8080 / 8081   (TTS, inchangé)
                            └─ jeu.trouve-ton-serveur.fr  ──▶ 127.0.0.1:2567  ffl-game      (512 Mo, 1 cœur max)
```

Le Nginx de TTS est en `network_mode: host` : il joint déjà tout en `127.0.0.1:<port>`. Le jeu fait pareil, sans réseau partagé.

**Côté DeployTTS, il n'y a que deux ajouts, et aucune ligne existante n'est modifiée :**
- un fichier `nginx/fightforligeria.conf` ;
- une ligne de volume dans le service `nginx` de `docker-compose.yaml`.

Le sous-domaine utilisé ici est `jeu.trouve-ton-serveur.fr`. Si tu en veux un autre, remplace-le dans `deploy/nginx/*.conf` et dans les commandes ci-dessous.

---

## 1. DNS

Ajoute un enregistrement **A** `jeu` → l'IP du VPS (même cible que `trouve-ton-serveur.fr`), plus **AAAA** si tu as de l'IPv6. Puis vérifie :

```bash
dig +short jeu.trouve-ton-serveur.fr
```

## 2. Image du serveur (GitHub)

L'action **« Serveur de jeu »** publie l'image `ghcr.io/julian982/fightforligeria-server` à chaque push qui touche `shared/` ou `server/`. Une fois, sur GitHub, va dans ton profil → **Packages** → `fightforligeria-server` → **Package settings** → **Change visibility** → **Public**. Le VPS pourra alors la télécharger sans identifiants.

## 3. Lancer le jeu sur le VPS

```bash
sudo mkdir -p /opt/fightforligeria && sudo chown "$USER" /opt/fightforligeria
cd /opt/fightforligeria
curl -fsSLO https://raw.githubusercontent.com/julian982/FightForLigeria/main/deploy/docker-compose.yml
docker compose up -d
docker compose logs --tail 5              # « serveur prêt sur ws://localhost:2567 »
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:2567/   # répond (404 = normal, c'est bien le jeu)
```

## 4. Brancher le sous-domaine dans DeployTTS

Toutes les commandes se lancent depuis le dossier `DeployTTS/` du VPS.

**a. Ajouter le fichier, d'abord en version « HTTP seulement ».** Le certificat n'existe pas encore, et le bloc HTTPS empêcherait Nginx de démarrer.

```bash
curl -fsSL https://raw.githubusercontent.com/julian982/FightForLigeria/main/deploy/nginx/fightforligeria-http-only.conf -o nginx/fightforligeria.conf
```

**b. Le monter dans Nginx.** Dans `docker-compose.yaml`, service `nginx`, ajoute **une ligne** sous `volumes:` :

```yaml
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./nginx/fightforligeria.conf:/etc/nginx/conf.d/fightforligeria.conf:ro   # ← ajout
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
```

Puis recrée uniquement Nginx. TTS est coupé une ou deux secondes, le temps du redémarrage :

```bash
docker compose up -d nginx
docker exec tts-nginx nginx -t
```

**c. Le certificat**, avec le même certbot que TTS :

```bash
docker compose run --rm --entrypoint "" certbot certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  --email julian.demois@hotmail.com --agree-tos --no-eff-email \
  -d jeu.trouve-ton-serveur.fr
```

Le conteneur `tts-certbot` le renouvellera automatiquement avec celui de TTS, et `tts-nginx` le recharge toutes les 6 h.

**d. Passer en HTTPS.** On remplace le fichier par la version complète, puis on teste avant de recharger :

```bash
curl -fsSL https://raw.githubusercontent.com/julian982/FightForLigeria/main/deploy/nginx/fightforligeria.conf -o nginx/fightforligeria.conf
docker exec tts-nginx nginx -t && docker exec tts-nginx nginx -s reload
```

Si `nginx -t` signale une erreur, rien n'est rechargé et TTS continue tel quel.

**e. Vérifier :** `https://jeu.trouve-ton-serveur.fr` doit répondre. « Cannot GET / » ou 404 est **normal** : c'est le serveur de jeu, qui n'a pas de page d'accueil. Si le conteneur du jeu est arrêté, seul ce sous-domaine affiche une erreur 502 ; TTS n'est pas concerné.

## 5. Déploiement automatique et adresse par défaut (GitHub)

Dans le dépôt FightForLigeria → **Settings** → **Secrets and variables** → **Actions** :

| Type | Nom | Valeur |
|---|---|---|
| Secret | `VPS_HOST` | l'IP du VPS |
| Secret | `VPS_USER` | l'utilisateur SSH qui lance `docker` |
| Secret | `VPS_SSH_KEY` | une **clé privée SSH dédiée** (sa clé publique dans `~/.ssh/authorized_keys` de cet utilisateur) |
| Secret | `VPS_PORT` | (facultatif) port SSH s'il n'est pas 22 |
| Variable | `GAME_SERVER_URL` | `wss://jeu.trouve-ton-serveur.fr` |

- **Pour le serveur :** à chaque push sur le jeu, l'action teste, publie l'image, puis sur le VPS récupère le `docker-compose.yml` du dépôt dans `/opt/fightforligeria` et fait `docker compose pull && up -d`. Elle ne touche à rien d'autre.
- **Pour la page du jeu :** `GAME_SERVER_URL` est intégrée à la page GitHub Pages, donc tes amis n'ont rien à saisir dans le lobby. Relance l'action « Tests et déploiement GitHub Pages », ou pousse un commit, pour la prendre en compte.

> Un utilisateur qui peut lancer `docker` a, en pratique, des droits élevés sur la machine. Utilise une clé dédiée, que tu peux révoquer facilement.

## 6. Au quotidien

```bash
cd /opt/fightforligeria
docker compose ps            # état
docker compose logs -f       # journaux en direct
docker stats ffl-game        # mémoire et processeur
docker compose restart       # redémarrer (les parties en cours sont perdues)
```

## Tout retirer

```bash
cd /opt/fightforligeria && docker compose down          # le jeu
# dans DeployTTS : supprimer nginx/fightforligeria.conf et la ligne de volume ajoutée, puis
docker compose up -d nginx
```
