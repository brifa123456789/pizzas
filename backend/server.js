/**
 * Servidor local de desarrollo: npm run dev
 * (En producción con Netlify no se usa este archivo;
 *  la API corre como función serverless — ver netlify/functions/api.mjs)
 */
import app from "./app.js";
import { testConnection } from "./db.js";

const PORT = process.env.PORT || 4000;

testConnection().then(() => {
  app.listen(PORT, () => {
    console.log(`🍕 API de Bella Napoli escuchando en http://localhost:${PORT}`);
  });
});
