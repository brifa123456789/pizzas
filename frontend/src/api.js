/**
 * Capa de comunicacion con la API de Bella Napoli.
 * Todas las llamadas al backend pasan por aqui.
 */

// En produccion (Netlify) la API vive en el mismo dominio bajo /api.
// En desarrollo local apunta al backend de npm run dev.
const BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "/api" : "http://localhost:4000/api");

// ─── Manejo del token ──────────────────────────────────
const TOKEN_KEY = "bellanapoli_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// ─── Helper generico ───────────────────────────────────
async function req(ruta, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) headers.Authorization = `Bearer ${getToken()}`;

  const res = await fetch(`${BASE}${ruta}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Error ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// ─── Endpoints ─────────────────────────────────────────
export const api = {
  login: (username, password) =>
    req("/auth/login", { method: "POST", body: { username, password } }),
  verificarSesion: () => req("/auth/me", { auth: true }),

  // Sitio
  getSite: () => req("/site"),
  guardarSite: (data) => req("/site", { method: "PUT", body: data, auth: true }),

  // Categorias
  getCategorias: () => req("/categories"),
  crearCategoria: (data) => req("/categories", { method: "POST", body: data, auth: true }),
  editarCategoria: (id, data) =>
    req(`/categories/${id}`, { method: "PUT", body: data, auth: true }),
  eliminarCategoria: (id) =>
    req(`/categories/${id}`, { method: "DELETE", auth: true }),
  reordenarCategorias: (ids) =>
    req("/categories/reorder", { method: "PUT", body: { ids }, auth: true }),

  // Productos
  getItemsPublicos: () => req("/items/public"),
  getItems: () => req("/items", { auth: true }),
  crearItem: (data) => req("/items", { method: "POST", body: data, auth: true }),
  editarItem: (id, data) => req(`/items/${id}`, { method: "PUT", body: data, auth: true }),
  toggleVisible: (id, visible) =>
    req(`/items/${id}/visible`, { method: "PATCH", body: { visible }, auth: true }),
  eliminarItem: (id) => req(`/items/${id}`, { method: "DELETE", auth: true }),
  reordenarItems: (ids) =>
    req("/items/reorder", { method: "PUT", body: { ids }, auth: true }),
};
