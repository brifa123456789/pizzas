import { Router } from "express";
import { pool } from "../db.js";
import { requiereAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/categories  (publico, para pintar los filtros)
router.get("/", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, color FROM categories ORDER BY position, name"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cargar las categorias." });
  }
});

// POST /api/categories  (crear)
router.post("/", requiereAuth, async (req, res) => {
  let { id, name, color } = req.body;
  if (!name) return res.status(400).json({ error: "El nombre es obligatorio." });

  // Genera un id valido a partir del nombre si no viene
  if (!id) {
    id = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "").slice(0, 18) || "cat" + Date.now();
  }

  try {
    await pool.query(
      "INSERT INTO categories (id, name, color) VALUES (?, ?, ?)",
      [id, name, color || "#3E6FB0"]
    );
    res.status(201).json({ id, name, color: color || "#3E6FB0" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Ya existe una categoria con ese identificador." });
    }
    console.error(err);
    res.status(500).json({ error: "Error al crear la categoria." });
  }
});

// PUT /api/categories/reorder  (guardar el orden)  ← debe ir ANTES de "/:id"
router.put("/reorder", requiereAuth, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Falta la lista de categorias." });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < ids.length; i++) {
      await conn.query("UPDATE categories SET position = ? WHERE id = ?", [i + 1, ids[i]]);
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Error al reordenar las categorias." });
  } finally {
    conn.release();
  }
});

// PUT /api/categories/:id  (editar nombre/color)
router.put("/:id", requiereAuth, async (req, res) => {
  const { name, color } = req.body;
  try {
    await pool.query(
      "UPDATE categories SET name = ?, color = ? WHERE id = ?",
      [name, color, req.params.id]
    );
    res.json({ id: req.params.id, name, color });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar la categoria." });
  }
});

// DELETE /api/categories/:id
// Elimina la categoria y TODOS sus productos (el frontend pide confirmacion antes).
router.delete("/:id", requiereAuth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [del] = await conn.query("DELETE FROM items WHERE category_id = ?", [req.params.id]);
    await conn.query("DELETE FROM categories WHERE id = ?", [req.params.id]);
    await conn.commit();
    res.json({ ok: true, productosEliminados: del.affectedRows });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Error al eliminar la categoria." });
  } finally {
    conn.release();
  }
});

export default router;
