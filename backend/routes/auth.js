import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { firmarToken, requiereAuth } from "../middleware/auth.js";

const router = Router();

// POST /api/auth/login  → { token }
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y clave son obligatorios." });
  }

  try {
    const [rows] = await pool.query(
      "SELECT * FROM admins WHERE username = ? LIMIT 1",
      [username]
    );
    const admin = rows[0];
    if (!admin) {
      return res.status(401).json({ error: "Usuario o clave incorrectos." });
    }

    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Usuario o clave incorrectos." });
    }

    const token = firmarToken(admin);
    res.json({ token, username: admin.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor." });
  }
});

// GET /api/auth/me  → valida que el token siga siendo valido
router.get("/me", requiereAuth, (req, res) => {
  res.json({ username: req.admin.username });
});

export default router;
