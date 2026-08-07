import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev_secret";

// Genera un token para un admin
export function firmarToken(admin) {
  return jwt.sign(
    { id: admin.id, username: admin.username },
    SECRET,
    { expiresIn: "8h" }
  );
}

// Protege rutas: exige un token valido en el header Authorization
export function requiereAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "No autorizado. Inicia sesion." });
  }

  try {
    req.admin = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Sesion expirada o token invalido." });
  }
}
