// La base de données des comptes (MariaDB). Le serveur de jeu tourne aussi sans : les comptes sont alors indisponibles,
// mais les parties en invité continuent de marcher. Le schéma est créé et mis à jour au démarrage (migrations numérotées).
import * as mariadb from 'mariadb';

// toutes les dates de la base sont en UTC : le serveur lit et écrit en UTC quel que soit le fuseau de la machine
// (le pilote convertit les DATETIME avec le fuseau du processus Node)
process.env.TZ = 'UTC';

export const DB_ENABLED = !!process.env.DB_HOST;
let pool: mariadb.Pool | null = null;
let ready = false;

/** les migrations s'appliquent dans l'ordre, une seule fois chacune (version enregistrée dans schema_version) */
const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      pseudo VARCHAR(16) NOT NULL,
      email VARCHAR(254) NOT NULL,
      pass_hash VARCHAR(200) NOT NULL,
      verified_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME NULL,
      terms_version VARCHAR(16) NOT NULL,
      UNIQUE KEY uq_pseudo (pseudo),
      UNIQUE KEY uq_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    // une session = un jeton gardé par le navigateur ; on ne stocke que son empreinte (SHA-256)
    `CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) NOT NULL PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      KEY ix_sessions_user (user_id),
      CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=ascii`,
    // liens envoyés par email : confirmation de l'adresse, nouveau mot de passe
    `CREATE TABLE IF NOT EXISTS email_tokens (
      token_hash CHAR(64) NOT NULL PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      kind ENUM('verify','reset') NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      KEY ix_tokens_user (user_id),
      CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=ascii`,
  ],
  // 2 : blason, Elo 1v1 et 2v2, historique des parties
  [
    `ALTER TABLE users
      ADD COLUMN blason VARCHAR(200) NULL,
      ADD COLUMN elo1 SMALLINT NOT NULL DEFAULT 1000, ADD COLUMN games1 INT UNSIGNED NOT NULL DEFAULT 0, ADD COLUMN wins1 INT UNSIGNED NOT NULL DEFAULT 0,
      ADD COLUMN elo2 SMALLINT NOT NULL DEFAULT 1000, ADD COLUMN games2 INT UNSIGNED NOT NULL DEFAULT 0, ADD COLUMN wins2 INT UNSIGNED NOT NULL DEFAULT 0`,
    // une partie : classée, en ligne (non classée) ou contre l'IA (déclarée par le navigateur, ne compte jamais pour l'Elo)
    `CREATE TABLE IF NOT EXISTS matches (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      kind ENUM('ranked','online','solo') NOT NULL,
      mode ENUM('1v1','2v2') NOT NULL,
      map VARCHAR(32) NOT NULL,
      duration_s INT UNSIGNED NOT NULL DEFAULT 0,
      winner_side TINYINT NULL,
      played_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY ix_matches_played (played_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    // chaque place de la partie : un compte, un invité ou l'IA
    `CREATE TABLE IF NOT EXISTS match_players (
      match_id INT UNSIGNED NOT NULL,
      slot TINYINT NOT NULL,
      user_id INT UNSIGNED NULL,
      pseudo VARCHAR(24) NOT NULL,
      ai TINYINT(1) NOT NULL DEFAULT 0,
      side TINYINT NOT NULL,
      won TINYINT(1) NOT NULL,
      left_game TINYINT(1) NOT NULL DEFAULT 0,
      elo_before SMALLINT NULL,
      elo_after SMALLINT NULL,
      PRIMARY KEY (match_id, slot),
      KEY ix_mp_user (user_id, match_id),
      CONSTRAINT fk_mp_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
      CONSTRAINT fk_mp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
];

function getPool() {
  if (!pool) pool = mariadb.createPool({
    host: process.env.DB_HOST, port: +(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
    connectionLimit: 5, charset: 'utf8mb4', timezone: 'Z', dateStrings: false, bigIntAsNumber: true, insertIdAsNumber: true,
  });
  return pool;
}

/** crée ou met à jour le schéma. Réessaie tant que la base n'est pas joignable (elle démarre parfois après le jeu). */
export async function initDb(log = console.log) {
  if (!DB_ENABLED) { log('comptes : pas de base de données configurée (DB_HOST), comptes désactivés'); return false }
  for (let attempt = 1; ; attempt++) {
    try {
      const c = await getPool().getConnection();
      try {
        await c.query('CREATE TABLE IF NOT EXISTS schema_version (v INT NOT NULL) ENGINE=InnoDB');
        const rows = await c.query('SELECT v FROM schema_version');
        let v = rows.length ? rows[0].v : 0;
        if (!rows.length) await c.query('INSERT INTO schema_version (v) VALUES (0)');
        for (; v < MIGRATIONS.length; v++) {
          for (const sql of MIGRATIONS[v]) await c.query(sql);
          await c.query('UPDATE schema_version SET v = ?', [v + 1]);
          log(`comptes : migration ${v + 1} appliquée`);
        }
      } finally { c.release() }
      ready = true; log('comptes : base de données prête');
      return true;
    } catch (e: any) {
      const wait = Math.min(30, attempt * 2);
      log(`comptes : base de données injoignable (${e.code || e.message}), nouvel essai dans ${wait} s`);
      await new Promise(r => setTimeout(r, wait * 1000));
    }
  }
}
export const dbReady = () => ready;
export async function q<T = any>(sql: string, params: any[] = []): Promise<T> { return getPool().query(sql, params) as any }
export async function closeDb() { if (pool) await pool.end(); pool = null; ready = false }
