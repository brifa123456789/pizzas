import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Pool de conexiones: reutiliza conexiones y evita abrir/cerrar en cada query
export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "bellanapoli",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
  // MySQL gestionados (TiDB Cloud, Aiven, Azure, etc.) exigen TLS: DB_SSL=true
  ssl:
    process.env.DB_SSL === "true"
      ? { minVersion: "TLSv1.2", rejectUnauthorized: true }
      : undefined,
});

// Comprobacion rapida al arrancar
export async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log("✅ Conectado a MySQL:", process.env.DB_NAME);
  } catch (err) {
    console.error("❌ No se pudo conectar a MySQL:", err.message);
    console.error("   Revisa las credenciales en el archivo .env");
    process.exit(1);
  }
}
