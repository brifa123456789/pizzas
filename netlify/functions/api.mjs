/**
 * Función serverless de Netlify que envuelve la API Express completa.
 * Todas las rutas /api/* llegan aquí (ver redirects en netlify.toml).
 */
import serverless from "serverless-http";
import app from "../../backend/app.js";

export const handler = serverless(app);
