/**
 * Inicializa la base de datos:
 *  1. Ejecuta schema.sql (crea tablas + datos semilla)
 *  2. Crea el usuario administrador con la clave encriptada
 *  3. Agrega columnas nuevas si la BD viene de una version anterior
 *
 * Uso:  npm run init-db
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const {
    DB_HOST = "localhost",
    DB_PORT = 3306,
    DB_USER = "root",
    DB_PASSWORD = "",
    DB_NAME = "bellanapoli",
    ADMIN_USER = "admin",
    ADMIN_PASSWORD = "pizza2025",
  } = process.env;

  // Conexion sin base seleccionada (para poder crearla)
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
    ssl:
      process.env.DB_SSL === "true"
        ? { minVersion: "TLSv1.2", rejectUnauthorized: true }
        : undefined,
  });

  // En hostings gestionados la BD ya existe con un nombre impuesto y no hay
  // permiso para crear otras: se quita el CREATE DATABASE/USE del schema y
  // se usa siempre DB_NAME.
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } catch {}
  await conn.query(`USE \`${DB_NAME}\``);

  console.log("📦 Ejecutando schema.sql ...");
  let schema = fs
    .readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8")
    .replace(/CREATE DATABASE[\s\S]*?;/i, "")
    .replace(/USE\s+\S+;/i, "");

  // Si ya hay productos, se quita el INSERT de la semilla para no duplicar.
  let itemsYaExisten = 0;
  try {
    const [[r]] = await conn.query("SELECT COUNT(*) AS n FROM items");
    itemsYaExisten = r.n;
  } catch {
    /* la tabla aun no existe: es la primera instalacion */
  }
  if (itemsYaExisten > 0) {
    console.log(`ℹ️  Ya hay ${itemsYaExisten} productos: no se vuelve a cargar la semilla.`);
    schema = schema.replace(/INSERT INTO items[\s\S]*?;/i, "");
  }

  await conn.query(schema);

  // ─── Migraciones: agrega columnas nuevas si faltan ───
  const columnas = {
    image: "ALTER TABLE items ADD COLUMN image MEDIUMTEXT AFTER price",
    images: "ALTER TABLE items ADD COLUMN images LONGTEXT AFTER image",
    subcategory: "ALTER TABLE items ADD COLUMN subcategory VARCHAR(80) DEFAULT '' AFTER category_id",
    sizes: "ALTER TABLE items ADD COLUMN sizes VARCHAR(160) DEFAULT '' AFTER subcategory",
    size_prices: "ALTER TABLE items ADD COLUMN size_prices LONGTEXT AFTER sizes",
    badge: "ALTER TABLE items ADD COLUMN badge VARCHAR(20) DEFAULT '' AFTER sizes",
    badge_label: "ALTER TABLE items ADD COLUMN badge_label VARCHAR(40) DEFAULT '' AFTER badge",
  };
  for (const [col, alter] of Object.entries(columnas)) {
    const [[{ existe }]] = await conn.query(
      `SELECT COUNT(*) AS existe FROM information_schema.columns
       WHERE table_schema = ? AND table_name = 'items' AND column_name = ?`,
      [DB_NAME, col]
    );
    if (!existe) {
      console.log(`🧩 Agregando columna "${col}" a items ...`);
      await conn.query(alter);
    }
  }

  console.log("👤 Creando usuario administrador ...");
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await conn.query(
    `INSERT INTO admins (username, password_hash) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    [ADMIN_USER, hash]
  );
  // Deja SOLO este administrador para no dejar accesos abiertos.
  const [del] = await conn.query("DELETE FROM admins WHERE username <> ?", [ADMIN_USER]);
  if (del.affectedRows > 0) {
    console.log(`🧹 Eliminados ${del.affectedRows} administrador(es) anterior(es).`);
  }

  await conn.end();
  console.log("\n✅ Base de datos lista.");
  console.log(`   Usuario:  ${ADMIN_USER}`);
  console.log(`   Clave:    ${ADMIN_PASSWORD}`);
  console.log("   (cambia la clave en produccion editando .env antes de correr esto)\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error inicializando la base de datos:", err.message);
  process.exit(1);
});
