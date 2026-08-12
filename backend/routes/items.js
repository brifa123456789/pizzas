import { Router } from "express";
import { pool } from "../db.js";
import { requiereAuth } from "../middleware/auth.js";

const router = Router();

// Lee las imagenes de una fila: nueva columna `images` (JSON array),
// con fallback a la columna vieja `image` (una sola) por compatibilidad.
function parseImages(row) {
  if (row.images) {
    try {
      const arr = JSON.parse(row.images);
      if (Array.isArray(arr)) return arr.filter(Boolean);
    } catch {}
  }
  return row.image ? [row.image] : [];
}

// Lee los precios por tamaño: columna `size_prices` (JSON [{name, price}])
function parseSizePrices(row) {
  if (row.size_prices) {
    try {
      const arr = JSON.parse(row.size_prices);
      if (Array.isArray(arr)) {
        return arr
          .filter((x) => x && x.name != null && String(x.name).trim())
          .map((x) => ({ name: String(x.name).trim(), price: String(x.price || "").trim() }));
      }
    } catch {}
  }
  return [];
}

// Prepara los valores de tamaño/precio para guardar: JSON + string de nombres
function valoresSizePrices(sizePrices) {
  const arr = Array.isArray(sizePrices)
    ? sizePrices
        .filter((x) => x && x.name != null && String(x.name).trim())
        .map((x) => ({ name: String(x.name).trim(), price: String(x.price || "").trim() }))
    : [];
  return { json: arr.length ? JSON.stringify(arr) : null, sizes: arr.map((x) => x.name).join(", ") };
}

// Convierte una fila de la BD al formato que usa el frontend
function mapItem(row) {
  const imgs = parseImages(row);
  return {
    id: row.id,
    name: row.name,
    desc: row.description || "",
    price: row.price || "",
    cat: row.category_id,
    subcat: row.subcategory || "",
    sizes: row.sizes || "",
    sizePrices: parseSizePrices(row),
    badge: row.badge || "",
    badgeLabel: row.badge_label || "",
    visible: !!row.visible,
    image: imgs[0] || "",   // miniatura (primera foto)
    images: imgs,           // todas las fotos
  };
}

// Cada foto llega como data URL ya comprimida por el frontend (~30-100 KB)
function imagenesInvalidas(images) {
  if (images == null) return false;         // no enviar fotos es valido
  if (!Array.isArray(images)) return true;
  if (images.length > 8) return true;       // maximo 8 fotos por producto
  return images.some(
    (img) => typeof img !== "string" || !img.startsWith("data:image/") || img.length > 1_500_000
  );
}

// Normaliza el badge a uno de los valores permitidos
function limpiarBadge(b) {
  return b === "new" || b === "sale" ? b : "";
}

// Prepara los valores de imagen para guardar: JSON del array + primera foto
function valoresImagen(images) {
  const arr = Array.isArray(images) ? images.filter(Boolean) : [];
  return { json: arr.length ? JSON.stringify(arr) : null, primera: arr[0] || null };
}

// ─── PUBLICO: solo productos visibles ──────────────────
router.get("/public", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM items WHERE visible = 1 ORDER BY position, id"
    );
    res.json(rows.map(mapItem));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cargar el catalogo." });
  }
});

// ─── ADMIN: todos los productos ────────────────────────
router.get("/", requiereAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM items ORDER BY position, id");
    res.json(rows.map(mapItem));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cargar los productos." });
  }
});

// POST /api/items  (crear) — el precio es OPCIONAL
router.post("/", requiereAuth, async (req, res) => {
  const { name, desc, price, cat, subcat, sizes, sizePrices, badge, badgeLabel, visible = true, images } = req.body;
  if (!name || !cat) {
    return res.status(400).json({ error: "Nombre y categoria son obligatorios." });
  }
  if (imagenesInvalidas(images)) {
    return res.status(400).json({ error: "Alguna imagen no es valida o es demasiado pesada (max 8 fotos)." });
  }
  const img = valoresImagen(images);
  const sp = valoresSizePrices(sizePrices);
  const sizesFinal = sp.sizes || sizes || "";
  try {
    const [result] = await pool.query(
      `INSERT INTO items (name, description, price, category_id, subcategory, sizes, size_prices, badge, badge_label, visible, image, images)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, desc || "", price || "", cat, subcat || "", sizesFinal, sp.json, limpiarBadge(badge), badgeLabel || "", visible ? 1 : 0, img.primera, img.json]
    );
    const [rows] = await pool.query("SELECT * FROM items WHERE id = ?", [result.insertId]);
    res.status(201).json(mapItem(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear el producto." });
  }
});

// PUT /api/items/reorder  (guardar el orden)  ← debe ir ANTES de "/:id"
router.put("/reorder", requiereAuth, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Falta la lista de productos." });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < ids.length; i++) {
      await conn.query("UPDATE items SET position = ? WHERE id = ?", [i + 1, ids[i]]);
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Error al reordenar los productos." });
  } finally {
    conn.release();
  }
});

// PUT /api/items/:id  (actualizar)
router.put("/:id", requiereAuth, async (req, res) => {
  const { name, desc, price, cat, subcat, sizes, sizePrices, badge, badgeLabel, visible, images } = req.body;
  if (imagenesInvalidas(images)) {
    return res.status(400).json({ error: "Alguna imagen no es valida o es demasiado pesada (max 8 fotos)." });
  }
  const img = valoresImagen(images);
  const sp = valoresSizePrices(sizePrices);
  const sizesFinal = sp.sizes || sizes || "";
  try {
    await pool.query(
      `UPDATE items SET name = ?, description = ?, price = ?, category_id = ?, subcategory = ?,
       sizes = ?, size_prices = ?, badge = ?, badge_label = ?, visible = ?, image = ?, images = ? WHERE id = ?`,
      [name, desc || "", price || "", cat, subcat || "", sizesFinal, sp.json, limpiarBadge(badge), badgeLabel || "", visible ? 1 : 0, img.primera, img.json, req.params.id]
    );
    const [rows] = await pool.query("SELECT * FROM items WHERE id = ?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Producto no encontrado." });
    res.json(mapItem(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar el producto." });
  }
});

// PATCH /api/items/:id/visible
router.patch("/:id/visible", requiereAuth, async (req, res) => {
  try {
    await pool.query("UPDATE items SET visible = ? WHERE id = ?", [req.body.visible ? 1 : 0, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cambiar la visibilidad." });
  }
});

// DELETE /api/items/:id
router.delete("/:id", requiereAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM items WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar el producto." });
  }
});

export default router;
