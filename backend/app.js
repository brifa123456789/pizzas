/**
 * Aplicación Express de Bella Napoli (sin listen).
 * - En desarrollo la usa server.js (npm run dev).
 * - En producción la envuelve la función serverless de Netlify.
 */
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import itemsRoutes from "./routes/items.js";
import categoriesRoutes from "./routes/categories.js";
import siteRoutes from "./routes/site.js";

dotenv.config();

const app = express();
app.use(cors());                             // permite que el frontend llame a la API
app.use(express.json({ limit: "20mb" }));    // margen para varias fotos por producto (data URLs)

// Rutas de la API
app.use("/api/auth", authRoutes);
app.use("/api/items", itemsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/site", siteRoutes);

// Salud del servidor
app.get("/api/health", (_req, res) => res.json({ ok: true, servicio: "bellanapoli-api" }));

export default app;
