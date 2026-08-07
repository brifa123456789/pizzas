import { Router } from "express";
import { pool } from "../db.js";
import { requiereAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/site  (publico) → { nombre, eslogan, ... }
router.get("/", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT setting_key, setting_value FROM site_settings");
    const site = {};
    rows.forEach((r) => (site[r.setting_key] = r.setting_value));
    res.json(site);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cargar la configuracion." });
  }
});

// PUT /api/site  (admin) → guarda varios ajustes a la vez
router.put("/", requiereAuth, async (req, res) => {
  const entries = Object.entries(req.body);
  if (entries.length === 0) return res.json({ ok: true });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const [key, value] of entries) {
      await conn.query(
        `INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, value]
      );
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Error al guardar la configuracion." });
  } finally {
    conn.release();
  }
});

export default router;
