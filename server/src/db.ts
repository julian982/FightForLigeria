// La base de données des comptes (MariaDB). Le serveur de jeu tourne aussi sans : les comptes sont alors indisponibles,
// mais les parties en invité continuent de marcher. Le schéma est créé et mis à jour au démarrage (migrations numérotées).
import * as mariadb from 'mariadb';

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
