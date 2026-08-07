import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Pizza, MapPin, Clock, Phone, Instagram, Menu as MenuIcon, X,
  Plus, Minus, Pencil, Trash2, Eye, EyeOff, Search, LogOut, Lock,
  ShoppingBag, ShoppingCart, Tags, Home, Check, ChevronLeft, ChevronRight,
  Loader2, Image as ImageIcon, ChevronUp, ChevronDown, Ruler, MessageCircle, Share2
} from "lucide-react";
import { api, getToken, setToken, clearToken } from "./api.js";

/* ============================================================
   BELLA NAPOLI — Frontend (React + API Node/MySQL/TiDB)
   Pizzas artesanales · Paleta crema · amarillo · dorado horneado
   ============================================================ */

const C = {
  crema: "#FFFDF4",      // fondo de la pagina (crema muy claro)
  cremaSoft: "#FFFFFF",  // tarjetas / header
  durazno: "#FFEDAF",    // hero (izquierda) amarillo claro
  menta: "#FFF7DA",      // hero (derecha) crema calido
  terra: "#C08A17",      // acento principal (dorado horneado)
  terraSoft: "#F2DFA6",
  marron: "#5A3E22",     // botones oscuros / texto fuerte (espresso)
  marronSoft: "#8A745A", // texto suave
  verde: "#6F9A3E",      // badge "Nuevo" (albahaca)
  borde: "#F0E6C8",
  texto: "#453626",
  wapp: "#25D366",       // verde WhatsApp
  wappDark: "#1EA855",
};

const CART_KEY = "bellanapoli_cart";

function catById(cats, id) {
  return cats.find((c) => c.id === id) || { name: "—", color: C.marronSoft };
}

// Badge a mostrar (o null)
function badgeInfo(it) {
  if (it.badge === "new") return { text: it.badgeLabel || "Nuevo", color: C.verde };
  if (it.badge === "sale") return { text: it.badgeLabel || "Oferta", color: "#C6553F" };
  return null;
}

// Fotos de un producto (array). Compatibilidad con `image` suelto.
function fotosDe(it) {
  if (Array.isArray(it.images) && it.images.length) return it.images;
  return it.image ? [it.image] : [];
}

// Talles de un producto (texto separado por comas → array)
function tallesDe(it) {
  return (it.sizes || "").split(",").map((s) => s.trim()).filter(Boolean);
}

// Precio a numero (para sumar el carrito). "12.900" → 12900. Vacio → 0.
function precioNum(p) {
  const n = parseInt(String(p || "").replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}
const fmt = (n) => n.toLocaleString("es-AR");
// Muestra el precio o "Consultar" si esta vacio
function precioTxt(p) {
  return precioNum(p) > 0 ? `$${p}` : "Consultar";
}

/* ============================================================
   RAIZ
   ============================================================ */
export default function App() {
  const [modo, setModo] = useState("public");
  const [logueado, setLogueado] = useState(!!getToken());

  return (
    <div style={{ background: C.crema, minHeight: "100vh", color: C.texto }}>
      <FontsAndBase />
      {modo === "public" ? (
        <SitioPublico onAdmin={() => setModo("admin")} />
      ) : (
        <Admin logueado={logueado} setLogueado={setLogueado} onSalir={() => setModo("public")} />
      )}
    </div>
  );
}

function FontsAndBase() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; }
      .ff-display { font-family: 'Fraunces', serif; }
      .ff-body { font-family: 'Inter', sans-serif; }
      .cf-btn { transition: all .18s ease; cursor: pointer; }
      .cf-btn:hover { filter: brightness(1.06); }
      .cf-card { transition: transform .2s ease, box-shadow .2s ease; }
      .cf-card:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(120,80,50,.14); }
      .cf-navlink { transition: color .18s ease; cursor: pointer; }
      .cf-spin { animation: cfspin 1s linear infinite; }
      @keyframes cfspin { to { transform: rotate(360deg); } }
      @keyframes cfslide { from { transform: translateX(100%); } to { transform: translateX(0); } }
      @keyframes cffade { from { opacity: 0; } to { opacity: 1; } }
      input, textarea, select { font-family: 'Inter', sans-serif; }
      *::-webkit-scrollbar { width: 8px; height: 8px; }
      *::-webkit-scrollbar-thumb { background: ${C.terraSoft}; border-radius: 8px; }
      *::-webkit-scrollbar-track { background: ${C.crema}; }
    `}</style>
  );
}

function Cargando({ texto = "Cargando..." }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: C.marronSoft }}>
      <Loader2 size={30} color={C.terra} className="cf-spin" />
      <span style={{ fontSize: 14 }}>{texto}</span>
    </div>
  );
}

/* ============================================================
   SITIO PUBLICO (con carrito)
   ============================================================ */
function SitioPublico({ onAdmin }) {
  const [seccion, setSeccion] = useState("catalogo");
  const [filtro, setFiltro] = useState("todos");
  const [menuAbierto, setMenuAbierto] = useState(false);

  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [site, setSite] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // Carrito (persistido en localStorage)
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
  });
  const [cartAbierto, setCartAbierto] = useState(false);
  const [productoVer, setProductoVer] = useState(null); // producto abierto en el modal

  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);

  useEffect(() => {
    let activo = true;
    const cargar = (primera = false) =>
      Promise.all([api.getItemsPublicos(), api.getCategorias(), api.getSite()])
        .then(([i, c, s]) => { if (!activo) return; setItems(i); setCats(c); setSite(s); })
        .catch((e) => { if (primera && activo) setError(e.message); })
        .finally(() => { if (primera && activo) setCargando(false); });
    cargar(true);
    const id = setInterval(() => cargar(false), 30 * 60 * 1000);
    return () => { activo = false; clearInterval(id); };
  }, []);

  // ─── Acciones del carrito ───
  const agregarAlCarrito = (it, talle = "") => {
    const key = `${it.id}::${talle}`;
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.key === key);
      if (idx >= 0) {
        const copia = [...prev];
        copia[idx] = { ...copia[idx], qty: copia[idx].qty + 1 };
        return copia;
      }
      return [...prev, { key, id: it.id, name: it.name, price: it.price, image: it.image, talle, qty: 1 }];
    });
    setCartAbierto(true);
  };
  const cambiarQty = (key, delta) =>
    setCart((prev) =>
      prev
        .map((x) => (x.key === key ? { ...x, qty: Math.max(1, x.qty + delta) } : x))
        .filter((x) => x.qty > 0)
    );
  const quitarDelCarrito = (key) => setCart((prev) => prev.filter((x) => x.key !== key));

  const cartCount = cart.reduce((n, x) => n + x.qty, 0);

  if (cargando) return <div className="ff-body"><Cargando texto="Cargando el catalogo..." /></div>;
  if (error) return <PantallaError error={error} />;

  const mostrados = filtro === "todos" ? items : items.filter((i) => i.cat === filtro);
  const nav = [
    { id: "catalogo", label: "Catalogo" },
    { id: "nosotros", label: "Nosotros" },
    { id: "contacto", label: "Contacto" },
  ];

  return (
    <div className="ff-body">
      {/* NAVBAR */}
      <header style={{ background: C.cremaSoft, borderBottom: `1px solid ${C.borde}`, padding: "0 clamp(16px,4vw,40px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div className="ff-display cf-btn" onClick={() => setSeccion("catalogo")}
            style={{ color: C.terra, fontSize: 26, fontWeight: 700, letterSpacing: ".01em", display: "flex", alignItems: "center", gap: 8 }}>
            <Pizza size={24} strokeWidth={2.2} />{site.nombre}
          </div>
          <nav style={{ display: "flex", gap: 26, alignItems: "center" }} className="cf-desktop-nav">
            {nav.map((n) => (
              <span key={n.id} className="cf-navlink" onClick={() => setSeccion(n.id)}
                style={{ color: seccion === n.id ? C.terra : C.marronSoft, fontSize: 14, fontWeight: seccion === n.id ? 600 : 500 }}>
                {n.label}
              </span>
            ))}
            <span className="cf-navlink" onClick={onAdmin} title="Panel de administracion"
              style={{ color: C.marronSoft, opacity: 0.55, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
              <Lock size={13} /> Admin
            </span>
            <BotonCarrito count={cartCount} onClick={() => setCartAbierto(true)} />
          </nav>
          <div style={{ display: "none", alignItems: "center", gap: 6 }} className="cf-mobile-actions">
            <BotonCarrito count={cartCount} onClick={() => setCartAbierto(true)} />
            <button onClick={() => setMenuAbierto((v) => !v)} className="cf-btn"
              style={{ background: "transparent", border: "none", color: C.terra }}>
              {menuAbierto ? <X size={24} /> : <MenuIcon size={24} />}
            </button>
          </div>
        </div>
        {menuAbierto && (
          <div className="cf-mobile-menu" style={{ display: "none", flexDirection: "column", paddingBottom: 12, gap: 4 }}>
            {nav.map((n) => (
              <span key={n.id} onClick={() => { setSeccion(n.id); setMenuAbierto(false); }}
                style={{ color: seccion === n.id ? C.terra : C.marronSoft, padding: "10px 4px", fontSize: 15, cursor: "pointer" }}>
                {n.label}
              </span>
            ))}
            <span onClick={onAdmin} style={{ color: C.marronSoft, opacity: 0.6, padding: "10px 4px", fontSize: 14, display: "flex", gap: 6, cursor: "pointer" }}>
              <Lock size={14} /> Admin
            </span>
          </div>
        )}
      </header>

      {/* HERO */}
      <section style={{ background: `linear-gradient(110deg, ${C.durazno} 0%, ${C.menta} 100%)`, padding: "clamp(44px,6vw,76px) clamp(16px,4vw,40px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 560 }}>
            <div style={{ color: C.terra, fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700, marginBottom: 14 }}>
              Bienvenidos a {site.nombre}
            </div>
            <h1 className="ff-display" style={{ color: C.marron, fontSize: "clamp(32px,5.5vw,52px)", fontWeight: 600, lineHeight: 1.08, margin: 0 }}>
              {(() => {
                const partes = (site.eslogan || "").split(",");
                const resto = partes.slice(1).join(",").trim();
                return (
                  <>
                    {partes[0]}{resto ? "," : ""}
                    {resto && <><br /><em style={{ color: C.terra, fontStyle: "italic" }}>{resto}</em></>}
                  </>
                );
              })()}
            </h1>
            <p style={{ color: C.marronSoft, fontSize: 15, fontWeight: 400, marginTop: 16 }}>{site.subtitulo}</p>
            <button onClick={() => setSeccion("catalogo")} className="cf-btn"
              style={{ marginTop: 22, background: C.terra, color: "#fff", border: "none", padding: "12px 22px", borderRadius: 10, fontSize: 14, fontWeight: 600 }}>
              Explorar catalogo
            </button>
          </div>
          <div className="cf-hero-emojis" style={{ display: "flex", flexWrap: "wrap", gap: 14, maxWidth: 260 }}>
            {["🍕", "🧀", "🍅", "🌶️", "🔥", "🥖"].map((e, i) => (
              <div key={i} style={{ width: 76, height: 76, borderRadius: "50%", background: "rgba(255,255,255,.55)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34 }}>{e}</div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTENIDO */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(28px,5vw,52px) clamp(16px,4vw,40px)", minHeight: 360 }}>
        {seccion === "catalogo" && (
          <CatalogoPublico cats={cats} filtro={filtro} setFiltro={setFiltro} mostrados={mostrados}
            onVer={setProductoVer} onAgregar={agregarAlCarrito} />
        )}
        {seccion === "nosotros" && <Nosotros site={site} />}
        {seccion === "contacto" && <Contacto site={site} />}
      </main>

      {/* FOOTER */}
      <footer style={{ background: C.marron, padding: "clamp(28px,4vw,40px) clamp(16px,4vw,40px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24, alignItems: "start" }}>
          <div>
            <div className="ff-display" style={{ color: C.terra, fontSize: 24, marginBottom: 8 }}>{site.nombre}</div>
            <p style={{ color: "rgba(252,247,240,.6)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{site.subtitulo}</p>
          </div>
          <FootItem icon={<MapPin size={16} />} label="Direccion" val={site.direccion} />
          <FootItem icon={<Clock size={16} />} label="Horario" val={site.horario} />
          <FootItem icon={<Instagram size={16} />} label="Seguinos" val={site.instagram} />
        </div>
        <div style={{ maxWidth: 1100, margin: "24px auto 0", paddingTop: 16, borderTop: "1px solid rgba(252,247,240,.14)", textAlign: "center" }}>
          <span style={{ color: "rgba(252,247,240,.4)", fontSize: 12 }}>© {new Date().getFullYear()} {site.nombre} · Todos los derechos reservados</span>
        </div>
      </footer>

      {/* CARRITO (offcanvas) */}
      {cartAbierto && (
        <CarritoPanel cart={cart} site={site} onCerrar={() => setCartAbierto(false)}
          onQty={cambiarQty} onQuitar={quitarDelCarrito} />
      )}

      {/* MODAL DETALLE DE PRODUCTO */}
      {productoVer && (
        <ProductoModal it={productoVer} cats={cats} onCerrar={() => setProductoVer(null)}
          onAgregar={(talle) => { agregarAlCarrito(productoVer, talle); setProductoVer(null); }} />
      )}

      {/* WHATSAPP flotante + globo de ayuda */}
      {site.whatsapp && <WhatsappWidget site={site} />}

      <style>{`
        @media (max-width: 760px) {
          .cf-desktop-nav { display: none !important; }
          .cf-mobile-actions { display: flex !important; }
          .cf-mobile-menu { display: flex !important; }
          .cf-hero-emojis { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function BotonCarrito({ count, onClick }) {
  return (
    <button onClick={onClick} className="cf-btn"
      style={{ position: "relative", background: C.marron, color: "#fff", border: "none", padding: "9px 16px 9px 13px", borderRadius: 22, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
      <ShoppingCart size={17} /> Carrito
      <span style={{ background: C.terra, color: "#fff", minWidth: 20, height: 20, borderRadius: 10, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{count}</span>
    </button>
  );
}

function PantallaError({ error }) {
  return (
    <div className="ff-body" style={{ padding: 60, textAlign: "center" }}>
      <div style={{ maxWidth: 460, margin: "0 auto", background: "#fff", border: `1px solid ${C.borde}`, borderRadius: 12, padding: 28 }}>
        <div style={{ color: "#C6553F", fontWeight: 600, marginBottom: 8 }}>No se pudo conectar con el servidor</div>
        <p style={{ color: C.marronSoft, fontSize: 14, margin: 0 }}>{error}</p>
        <p style={{ color: C.marronSoft, fontSize: 13, marginTop: 12 }}>Comprueba que el backend este corriendo en <b>http://localhost:4000</b>.</p>
      </div>
    </div>
  );
}

function FootItem({ icon, label, val }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ color: C.terra, marginTop: 2 }}>{icon}</div>
      <div>
        <div style={{ color: C.terra, fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 3 }}>{label}</div>
        <div style={{ color: "rgba(252,247,240,.85)", fontSize: 13, lineHeight: 1.5 }}>{val}</div>
      </div>
    </div>
  );
}

/* ---------- Tarjeta de producto ---------- */
function TarjetaProducto({ it, cat, onVer, onAgregar }) {
  const badge = badgeInfo(it);
  const fotos = fotosDe(it);

  const clickAgregar = (e) => {
    e.stopPropagation();
    onAgregar(it, "");   // agrega directo; el talle es opcional (se puede elegir en el detalle)
  };

  return (
    <div className="cf-card" onClick={() => onVer(it)}
      style={{ position: "relative", background: C.cremaSoft, borderRadius: 16, overflow: "hidden", border: `1px solid ${C.borde}`, cursor: "pointer", display: "flex", flexDirection: "column" }}>
      {badge && (
        <span style={{ position: "absolute", top: 12, left: 12, zIndex: 2, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", padding: "3px 10px", borderRadius: 12, background: badge.color, color: "#fff" }}>{badge.text}</span>
      )}
      <div style={{ aspectRatio: "1 / 1", background: C.crema, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {fotos[0] ? (
          <img src={fotos[0]} alt={it.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <ImageIcon size={40} color={C.borde} />
        )}
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div className="ff-display" style={{ fontSize: 16, fontWeight: 600, color: C.texto, lineHeight: 1.2 }}>{it.name}</div>
        {it.subcat && <div style={{ fontSize: 11, color: C.marronSoft, marginTop: -4 }}>{it.subcat}</div>}
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.terra }}>{precioTxt(it.price)}</span>
          <button onClick={clickAgregar} className="cf-btn"
            style={{ background: C.marron, color: "#fff", border: "none", padding: "8px 14px", borderRadius: 9, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
            <ShoppingBag size={14} /> Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

function GrillaProductos({ cats, items, onVer, onAgregar }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
      {items.map((it) => (
        <TarjetaProducto key={it.id} it={it} cat={catById(cats, it.cat)} onVer={onVer} onAgregar={onAgregar} />
      ))}
    </div>
  );
}

function CatalogoPublico({ cats, filtro, setFiltro, mostrados, onVer, onAgregar }) {
  const grupos =
    filtro === "todos"
      ? cats.map((c) => ({ cat: c, prods: mostrados.filter((i) => i.cat === c.id) })).filter((g) => g.prods.length > 0)
      : null;

  return (
    <>
      <SectionTitle>Nuestro catalogo</SectionTitle>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        <FiltroPill activo={filtro === "todos"} onClick={() => setFiltro("todos")}>Todos</FiltroPill>
        {cats.map((c) => (
          <FiltroPill key={c.id} activo={filtro === c.id} onClick={() => setFiltro(c.id)}>{c.name}</FiltroPill>
        ))}
      </div>
      {mostrados.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", color: C.marronSoft, fontSize: 15 }}>No hay productos en esta categoria por ahora.</div>
      ) : grupos ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {grupos.map(({ cat, prods }) => (
            <section key={cat.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ width: 4, height: 24, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
                <h3 className="ff-display" style={{ fontSize: 22, fontWeight: 600, color: C.texto, margin: 0 }}>{cat.name}</h3>
                <span style={{ fontSize: 12, color: C.marronSoft, background: C.crema, padding: "2px 9px", borderRadius: 10 }}>{prods.length}</span>
                <span style={{ flex: 1, height: 1, background: C.borde }} />
              </div>
              <GrillaProductos cats={cats} items={prods} onVer={onVer} onAgregar={onAgregar} />
            </section>
          ))}
        </div>
      ) : (
        <GrillaProductos cats={cats} items={mostrados} onVer={onVer} onAgregar={onAgregar} />
      )}
    </>
  );
}

/* ---------- Modal detalle de producto (carrusel + talle) ---------- */
function ProductoModal({ it, cats, onCerrar, onAgregar }) {
  const fotos = fotosDe(it);
  const talles = tallesDe(it);
  const cat = catById(cats, it.cat);
  const badge = badgeInfo(it);
  const [i, setI] = useState(0);
  const [talle, setTalle] = useState("");

  const prev = () => setI((n) => (n - 1 + fotos.length) % fotos.length);
  const next = () => setI((n) => (n + 1) % fotos.length);

  const compartir = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: it.name, url });
      else { await navigator.clipboard.writeText(url); window.alert("Link copiado al portapapeles"); }
    } catch {}
  };

  return (
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(43,37,33,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 120, animation: "cffade .15s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.cremaSoft, borderRadius: 18, width: "100%", maxWidth: 820, maxHeight: "92vh", overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.35)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          {/* Carrusel */}
          <div style={{ position: "relative", flex: "1 1 340px", minHeight: 320, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {fotos[i] ? (
              <img src={fotos[i]} alt={it.name} style={{ width: "100%", height: "100%", maxHeight: 460, objectFit: "contain" }} />
            ) : (
              <ImageIcon size={64} color={C.borde} />
            )}
            {fotos.length > 1 && (
              <>
                <button onClick={prev} className="cf-btn" style={carruselBtn("left")}><ChevronLeft size={22} /></button>
                <button onClick={next} className="cf-btn" style={carruselBtn("right")}><ChevronRight size={22} /></button>
                <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
                  {fotos.map((_, k) => (
                    <span key={k} onClick={() => setI(k)} style={{ width: 8, height: 8, borderRadius: "50%", background: k === i ? C.terra : C.borde, cursor: "pointer" }} />
                  ))}
                </div>
              </>
            )}
          </div>
          {/* Info */}
          <div style={{ flex: "1 1 320px", padding: 24, position: "relative" }}>
            <button onClick={onCerrar} className="cf-btn" style={{ position: "absolute", top: 16, right: 16, background: C.crema, border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: C.marronSoft }}><X size={18} /></button>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              {badge && <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", padding: "3px 10px", borderRadius: 12, background: badge.color, color: "#fff" }}>{badge.text}</span>}
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: cat.color + "22", color: cat.color, fontWeight: 600 }}>{cat.name}</span>
            </div>
            <h2 className="ff-display" style={{ fontSize: 26, fontWeight: 700, color: C.texto, margin: "4px 40px 4px 0", lineHeight: 1.15 }}>{it.name}</h2>
            {it.subcat && <div style={{ fontSize: 13, color: C.marronSoft, marginBottom: 8 }}>{it.subcat}</div>}
            <div style={{ fontSize: 24, fontWeight: 700, color: C.terra, margin: "10px 0 14px" }}>{precioTxt(it.price)}</div>
            {it.desc && <p style={{ fontSize: 14, color: C.marronSoft, lineHeight: 1.6, margin: "0 0 16px" }}>{it.desc}</p>}

            {talles.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".07em", color: C.marronSoft, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Ruler size={13} /> Elegí el tamaño (opcional)
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {talles.map((t) => (
                    <button key={t} onClick={() => setTalle(t)} className="cf-btn"
                      style={{ padding: "7px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${talle === t ? C.terra : C.borde}`, background: talle === t ? C.terra : "#fff", color: talle === t ? "#fff" : C.texto }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => onAgregar(talle)} className="cf-btn"
                style={{ flex: 1, background: C.marron, color: "#fff", border: "none", padding: "13px", borderRadius: 11, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
                <ShoppingBag size={17} /> Agregar al carrito
              </button>
              <button onClick={compartir} className="cf-btn" title="Compartir"
                style={{ background: "#fff", border: `1px solid ${C.borde}`, color: C.marronSoft, padding: "0 14px", borderRadius: 11, display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500 }}>
                <Share2 size={16} /> Compartir
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const carruselBtn = (lado) => ({
  position: "absolute", top: "50%", [lado]: 10, transform: "translateY(-50%)",
  background: "rgba(255,255,255,.9)", border: "none", borderRadius: "50%", width: 38, height: 38,
  display: "flex", alignItems: "center", justifyContent: "center", color: C.marron, boxShadow: "0 2px 8px rgba(0,0,0,.15)",
});

/* ---------- Carrito (offcanvas derecha) ---------- */
function CarritoPanel({ cart, site, onCerrar, onQty, onQuitar }) {
  const total = cart.reduce((s, x) => s + precioNum(x.price) * x.qty, 0);
  const hayConsultar = cart.some((x) => precioNum(x.price) === 0);
  const totalTxt = total > 0 ? `$${fmt(total)}${hayConsultar ? " + a consultar" : ""}` : "A consultar";

  const finalizar = () => {
    if (!cart.length) return;
    const lineas = cart.map((x) => {
      const t = x.talle ? ` (Tamaño: ${x.talle})` : "";
      const p = precioNum(x.price) > 0 ? ` — $${x.price}` : " — Consultar";
      return `• ${x.name}${t} x${x.qty}${p}`;
    });
    const totalLinea = total > 0 ? `\n\nTotal: $${fmt(total)}${hayConsultar ? " (+ productos a consultar)" : ""}` : "";
    const msg = `¡Hola ${site.nombre}! Quiero hacer este pedido:\n\n${lineas.join("\n")}${totalLinea}`;
    window.open(`https://wa.me/${site.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(43,37,33,.5)", zIndex: 130, display: "flex", justifyContent: "flex-end", animation: "cffade .15s ease" }}>
      <aside onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: C.cremaSoft, height: "100%", display: "flex", flexDirection: "column", boxShadow: "-10px 0 40px rgba(0,0,0,.2)", animation: "cfslide .22s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: `1px solid ${C.borde}` }}>
          <h3 className="ff-display" style={{ margin: 0, fontSize: 20, color: C.texto, display: "flex", alignItems: "center", gap: 8 }}>
            <ShoppingCart size={19} color={C.terra} /> Tu carrito
          </h3>
          <button onClick={onCerrar} className="cf-btn" style={{ background: "transparent", border: "none", color: C.marronSoft }}><X size={22} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: cart.length ? 16 : 40 }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", color: C.marronSoft, marginTop: 40 }}>
              <ShoppingCart size={40} color={C.borde} />
              <p style={{ fontSize: 14, marginTop: 12 }}>Tu carrito esta vacio.</p>
            </div>
          ) : (
            cart.map((x) => (
              <div key={x.key} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.crema}` }}>
                <div style={{ width: 58, height: 58, borderRadius: 10, overflow: "hidden", background: C.crema, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {x.image ? <img src={x.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={20} color={C.borde} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.texto }}>{x.name}</span>
                    <button onClick={() => onQuitar(x.key)} className="cf-btn" style={{ background: "transparent", border: "none", color: "#C6553F", fontSize: 12 }}>Quitar</button>
                  </div>
                  <div style={{ fontSize: 12, color: C.marronSoft, margin: "2px 0 6px" }}>{x.talle ? `Tamaño: ${x.talle}` : "Tamaño: a elección"} · {precioTxt(x.price)}</div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 10, border: `1px solid ${C.borde}`, borderRadius: 8, padding: "3px 8px" }}>
                    <button onClick={() => onQty(x.key, -1)} className="cf-btn" style={qtyBtn}><Minus size={14} /></button>
                    <span style={{ fontSize: 14, fontWeight: 600, minWidth: 16, textAlign: "center" }}>{x.qty}</span>
                    <button onClick={() => onQty(x.key, 1)} className="cf-btn" style={qtyBtn}><Plus size={14} /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.borde}`, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.marronSoft, marginBottom: 6 }}>
              <span>Productos</span><span>{cart.reduce((n, x) => n + x.qty, 0)} item(s)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.marronSoft, marginBottom: 10 }}>
              <span>Envio</span><span>A coordinar</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: C.texto }}>Total</span>
              <span style={{ fontWeight: 700, fontSize: 18, color: C.terra }}>{totalTxt}</span>
            </div>
            <button onClick={finalizar} className="cf-btn"
              style={{ width: "100%", background: C.wapp, color: "#fff", border: "none", padding: "13px", borderRadius: 11, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
              <MessageCircle size={19} /> Finalizar pedido por WhatsApp
            </button>
            <div style={{ textAlign: "center", fontSize: 11, color: C.marronSoft, marginTop: 8 }}>🔒 Tu pedido se envia de forma segura</div>
          </div>
        )}
      </aside>
    </div>
  );
}
const qtyBtn = { background: "transparent", border: "none", color: C.marron, display: "flex", alignItems: "center", cursor: "pointer", padding: 0 };

/* ---------- Widget flotante de WhatsApp ---------- */
function WhatsappWidget({ site }) {
  const [abierto, setAbierto] = useState(true);
  const link = `https://wa.me/${site.whatsapp}`;
  return (
    <>
      {abierto && (
        <div style={{ position: "fixed", right: 20, bottom: 90, width: 260, background: "#fff", borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,.2)", padding: 18, zIndex: 60, animation: "cffade .2s ease" }}>
          <button onClick={() => setAbierto(false)} className="cf-btn" style={{ position: "absolute", top: 10, right: 10, background: "transparent", border: "none", color: C.marronSoft }}><X size={16} /></button>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.texto }}>¿Necesitas ayuda?</div>
          <div style={{ fontSize: 13, color: C.marronSoft, margin: "4px 0 12px" }}>Chatea con nosotros</div>
          <a href={link} target="_blank" rel="noreferrer" className="cf-btn"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: C.wapp, color: "#fff", textDecoration: "none", padding: "10px", borderRadius: 10, fontSize: 14, fontWeight: 600 }}>
            <MessageCircle size={17} /> Abrir WhatsApp
          </a>
        </div>
      )}
      <button onClick={() => setAbierto((v) => !v)} className="cf-btn" title="WhatsApp"
        style={{ position: "fixed", right: 20, bottom: 20, width: 56, height: 56, borderRadius: "50%", background: C.wapp, color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(0,0,0,.25)", zIndex: 60 }}>
        <MessageCircle size={28} />
      </button>
    </>
  );
}

function Nosotros({ site }) {
  return (
    <>
      <SectionTitle>Nosotros</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 28, alignItems: "center" }}>
        <div>
          <p style={{ fontSize: 16, lineHeight: 1.8, color: C.texto, marginTop: 0 }}>{site.descripcion}</p>
          <div style={{ display: "flex", gap: 28, marginTop: 24, flexWrap: "wrap" }}>
            <Stat num="+20" label="Variedades" />
            <Stat num="100%" label="Masa artesanal" />
            <Stat num="30'" label="Delivery promedio" />
          </div>
        </div>
        <div style={{ background: `linear-gradient(150deg, ${C.durazno}, ${C.menta})`, borderRadius: 16, padding: 40, textAlign: "center", color: C.marron }}>
          <Pizza size={56} color={C.terra} strokeWidth={1.6} />
          <div className="ff-display" style={{ fontSize: 26, marginTop: 16, color: C.marron }}>{site.eslogan}</div>
        </div>
      </div>
    </>
  );
}

function Stat({ num, label }) {
  return (
    <div>
      <div className="ff-display" style={{ fontSize: 32, fontWeight: 700, color: C.terra, lineHeight: 1 }}>{num}</div>
      <div style={{ fontSize: 12, color: C.marronSoft, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Contacto({ site }) {
  const items = [
    { icon: <MapPin size={20} />, label: "Direccion", val: site.direccion },
    { icon: <Clock size={20} />, label: "Horario", val: site.horario },
    { icon: <Phone size={20} />, label: "Telefono", val: site.telefono },
    { icon: <MessageCircle size={20} />, label: "WhatsApp", val: site.whatsapp },
    { icon: <Instagram size={20} />, label: "Instagram", val: site.instagram },
  ];
  return (
    <>
      <SectionTitle>Contacto y ubicacion</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {items.filter((it) => it.val).map((it, i) => (
          <div key={i} style={{ background: C.cremaSoft, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 20, display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: C.terra, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{it.icon}</div>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".07em", color: C.marronSoft, marginBottom: 4 }}>{it.label}</div>
              <div style={{ fontSize: 15, color: C.texto, fontWeight: 500 }}>{it.val}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="ff-display" style={{ fontSize: "clamp(22px,3vw,28px)", color: C.texto, margin: "0 0 20px", display: "flex", alignItems: "center", gap: 14 }}>
      {children}
      <span style={{ flex: 1, height: 1, background: C.terra, opacity: 0.4 }} />
    </h2>
  );
}

function FiltroPill({ children, activo, onClick }) {
  return (
    <button onClick={onClick} className="cf-btn"
      style={{ padding: "7px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, border: `1px solid ${activo ? C.marron : C.borde}`, background: activo ? C.marron : "#fff", color: activo ? "#fff" : C.marronSoft }}>
      {children}
    </button>
  );
}

/* ============================================================
   ADMIN
   ============================================================ */
function Admin({ logueado, setLogueado, onSalir }) {
  if (!logueado) return <Login setLogueado={setLogueado} onSalir={onSalir} />;
  return <AdminPanel setLogueado={setLogueado} onSalir={onSalir} />;
}

function Login({ setLogueado, onSalir }) {
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    setCargando(true); setError("");
    try {
      const { token } = await api.login(usuario, clave);
      setToken(token); setLogueado(true);
    } catch (e) { setError(e.message); } finally { setCargando(false); }
  };

  return (
    <div className="ff-body" style={{ minHeight: "100vh", background: `linear-gradient(150deg, ${C.durazno}, ${C.menta})`, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.cremaSoft, borderRadius: 16, padding: 36, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(90,60,40,.25)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: C.terra, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <Pizza size={28} color="#fff" />
          </div>
          <h2 className="ff-display" style={{ fontSize: 24, margin: 0, color: C.texto }}>Panel Bella Napoli</h2>
          <p style={{ fontSize: 13, color: C.marronSoft, marginTop: 6 }}>Ingresa tus credenciales para administrar el sitio</p>
        </div>
        <label style={{ fontSize: 12, color: C.marronSoft, fontWeight: 500 }}>Usuario</label>
        <input value={usuario} onChange={(e) => { setUsuario(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && entrar()} placeholder="Usuario" autoComplete="username"
          style={{ width: "100%", padding: "11px 14px", margin: "6px 0 14px", borderRadius: 8, border: `1px solid ${C.borde}`, fontSize: 15, background: "#fff", outline: "none" }} />
        <label style={{ fontSize: 12, color: C.marronSoft, fontWeight: 500 }}>Clave</label>
        <input type="password" value={clave} onChange={(e) => { setClave(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && entrar()} placeholder="••••••••"
          style={{ width: "100%", padding: "11px 14px", marginTop: 6, borderRadius: 8, border: `1px solid ${error ? "#C6553F" : C.borde}`, fontSize: 15, background: "#fff", outline: "none" }} />
        {error && <div style={{ color: "#C6553F", fontSize: 12, marginTop: 8 }}>{error}</div>}
        <button onClick={entrar} disabled={cargando} className="cf-btn"
          style={{ width: "100%", marginTop: 18, padding: "12px", borderRadius: 8, border: "none", background: C.terra, color: "#fff", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {cargando ? <Loader2 size={16} className="cf-spin" /> : null}
          {cargando ? "Entrando..." : "Entrar"}
        </button>
        <div onClick={onSalir} style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: C.marronSoft, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <ChevronLeft size={15} /> Volver al sitio
        </div>
      </div>
    </div>
  );
}

function AdminPanel({ setLogueado, onSalir }) {
  const [seccion, setSeccion] = useState("catalogo");
  const [site, setSite] = useState(null);

  useEffect(() => { api.getSite().then(setSite).catch(() => {}); }, []);
  const cerrarSesion = () => { clearToken(); setLogueado(false); onSalir(); };

  const nav = [
    { grupo: "Contenido", items: [
      { id: "catalogo", label: "Catalogo", icon: <ShoppingBag size={17} /> },
      { id: "categorias", label: "Categorias", icon: <Tags size={17} /> },
    ]},
    { grupo: "Sitio", items: [
      { id: "inicio", label: "Inicio", icon: <Home size={17} /> },
      { id: "contacto", label: "Contacto", icon: <MapPin size={17} /> },
    ]},
  ];

  return (
    <div className="ff-body" style={{ minHeight: "100vh", background: C.crema }}>
      <div style={{ background: C.marron, padding: "0 24px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="ff-display" style={{ color: C.terra, fontSize: 20, display: "flex", gap: 8, alignItems: "center" }}>
          <Pizza size={20} /> {site?.nombre || "Bella Napoli"}
          <span style={{ background: C.terra, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, marginLeft: 4, letterSpacing: ".05em" }}>ADMIN</span>
        </div>
        <button onClick={cerrarSesion} className="cf-btn" style={{ background: "transparent", border: "none", color: "rgba(252,247,240,.7)", fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
          <LogOut size={15} /> Cerrar sesion
        </button>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 58px)" }}>
        <aside style={{ width: 210, background: C.cremaSoft, borderRight: `1px solid ${C.borde}`, padding: "18px 0", flexShrink: 0 }} className="cf-admin-sidebar">
          {nav.map((g) => (
            <div key={g.grupo} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: C.marronSoft, letterSpacing: ".1em", textTransform: "uppercase", padding: "8px 18px 4px" }}>{g.grupo}</div>
              {g.items.map((n) => (
                <div key={n.id} onClick={() => setSeccion(n.id)} className="cf-btn"
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", fontSize: 14, color: seccion === n.id ? "#fff" : C.texto, background: seccion === n.id ? C.terra : "transparent", fontWeight: seccion === n.id ? 600 : 400 }}>
                  {n.icon} <span>{n.label}</span>
                </div>
              ))}
            </div>
          ))}
        </aside>

        <main style={{ flex: 1, padding: "clamp(16px,3vw,28px)", overflowX: "auto" }}>
          {seccion === "catalogo" && <AdminCatalogo />}
          {seccion === "categorias" && <AdminCategorias />}
          {seccion === "inicio" && <AdminSite campos={["nombre", "eslogan", "subtitulo", "descripcion"]} titulo="Pagina de inicio" sub="Textos que ven tus clientes al entrar" onSaved={setSite} />}
          {seccion === "contacto" && <AdminSite campos={["direccion", "horario", "telefono", "whatsapp", "instagram"]} titulo="Datos de contacto" sub="Direccion, horario y redes" onSaved={setSite} />}
        </main>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .cf-admin-sidebar { width: 64px !important; }
          .cf-admin-sidebar .cf-btn span { display: none; }
        }
      `}</style>
    </div>
  );
}

/* ---------- Admin: Catalogo ---------- */
function AdminCatalogo() {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState(null);
  const [nuevo, setNuevo] = useState(false);

  const recargar = () => {
    setCargando(true);
    Promise.all([api.getItems(), api.getCategorias()])
      .then(([i, c]) => { setItems(i); setCats(c); })
      .finally(() => setCargando(false));
  };
  useEffect(recargar, []);

  const filtrados = useMemo(
    () => items.filter((i) => i.name.toLowerCase().includes(busqueda.toLowerCase())),
    [items, busqueda]
  );

  const toggleVisible = async (it) => {
    await api.toggleVisible(it.id, !it.visible);
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, visible: !x.visible } : x)));
  };
  const eliminar = async (id) => {
    if (!window.confirm("¿Eliminar este producto del catalogo?")) return;
    await api.eliminarItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };
  const guardar = async (data) => {
    try {
      if (data.id) {
        const upd = await api.editarItem(data.id, data);
        setItems((prev) => prev.map((i) => (i.id === upd.id ? upd : i)));
      } else {
        const nuevoItem = await api.crearItem(data);
        setItems((prev) => [...prev, nuevoItem]);
      }
      setEditando(null); setNuevo(false);
    } catch (e) { window.alert(e.message); }
  };

  if (cargando) return <Cargando texto="Cargando productos..." />;

  return (
    <>
      <AdminHeader titulo="Catalogo"
        sub={`${items.length} productos · ${items.filter((i) => i.visible).length} visibles`}
        accion={<BotonAgregar onClick={() => setNuevo(true)}>Agregar producto</BotonAgregar>} />

      <div style={{ position: "relative", marginBottom: 16, maxWidth: 340 }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.marronSoft }} />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto..."
          style={{ width: "100%", padding: "9px 12px 9px 36px", borderRadius: 8, border: `1px solid ${C.borde}`, fontSize: 14, background: "#fff", outline: "none" }} />
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.borde}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr style={{ background: C.crema }}>
              {["Producto", "Categoria", "Tamaños", "Precio", "Visible", ""].map((h, i) => (
                <th key={i} style={{ textAlign: i === 4 ? "center" : "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: C.marronSoft, padding: "12px 16px", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((it) => {
              const cat = catById(cats, it.cat);
              const badge = badgeInfo(it);
              const nFotos = fotosDe(it).length;
              return (
                <tr key={it.id} style={{ borderTop: `1px solid ${C.crema}` }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ position: "relative" }}>
                        {it.image ? (
                          <img src={it.image} alt="" style={{ width: 38, height: 38, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.borde}` }} />
                        ) : (
                          <div title="Sin foto" style={{ width: 38, height: 38, borderRadius: 8, border: `1px dashed ${C.borde}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.borde }}><ImageIcon size={16} /></div>
                        )}
                        {nFotos > 1 && <span style={{ position: "absolute", bottom: -4, right: -4, background: C.terra, color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 8, padding: "1px 5px" }}>{nFotos}</span>}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: C.texto }}>{it.name}</span>
                          {badge && <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "1px 6px", borderRadius: 8, background: badge.color, color: "#fff" }}>{badge.text}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: C.marronSoft, marginTop: 2, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.subcat ? it.subcat + " · " : ""}{it.desc}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 12, background: cat.color + "22", color: cat.color, fontWeight: 600 }}>{cat.name}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: C.marronSoft, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.sizes || "—"}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: precioNum(it.price) ? C.terra : C.marronSoft }}>{precioTxt(it.price)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <button onClick={() => toggleVisible(it)} className="cf-btn" title={it.visible ? "Ocultar" : "Mostrar"}
                      style={{ background: "transparent", border: "none", color: it.visible ? C.verde : C.marronSoft }}>
                      {it.visible ? <Eye size={19} /> : <EyeOff size={19} />}
                    </button>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <IconBtn onClick={() => setEditando(it)} color={C.terra}><Pencil size={15} /></IconBtn>
                      <IconBtn onClick={() => eliminar(it.id)} color="#C6553F"><Trash2 size={15} /></IconBtn>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: C.marronSoft, fontSize: 14 }}>No se encontraron productos.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(editando || nuevo) && (
        <ModalProducto item={editando} cats={cats} onGuardar={guardar} onCerrar={() => { setEditando(null); setNuevo(false); }} />
      )}
    </>
  );
}

/* Reduce una foto y la convierte a WebP/JPEG. Devuelve un data URL. */
function comprimirImagen(file, maxLado = 640) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * escala));
        canvas.height = Math.max(1, Math.round(img.height * escala));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        let data = canvas.toDataURL("image/webp", 0.8);
        if (!data.startsWith("data:image/webp")) data = canvas.toDataURL("image/jpeg", 0.82);
        resolve(data);
      };
      img.onerror = () => reject(new Error("El archivo no es una imagen valida (usa JPG, PNG o WebP)."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

/* Selector de VARIAS fotos por producto */
function SelectorImagenes({ value, onChange, max = 8 }) {
  const inputRef = useRef(null);
  const [procesando, setProcesando] = useState(false);
  const fotos = Array.isArray(value) ? value : [];

  const elegir = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setProcesando(true);
    try {
      const libres = Math.max(0, max - fotos.length);
      const nuevas = [];
      for (const f of files.slice(0, libres)) nuevas.push(await comprimirImagen(f));
      onChange([...fotos, ...nuevas]);
      if (files.length > libres) window.alert(`Maximo ${max} fotos por producto.`);
    } catch (err) { window.alert(err.message); } finally { setProcesando(false); }
  };
  const quitar = (i) => onChange(fotos.filter((_, k) => k !== i));
  const mover = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= fotos.length) return;
    const copia = [...fotos];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    onChange(copia);
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        {fotos.map((src, i) => (
          <div key={i} style={{ position: "relative", width: 72, height: 72, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.borde}` }}>
            <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {i === 0 && <span style={{ position: "absolute", top: 2, left: 2, background: C.terra, color: "#fff", fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 5 }}>PORTADA</span>}
            <button type="button" onClick={() => quitar(i)} className="cf-btn" style={{ position: "absolute", top: 2, right: 2, background: "rgba(198,85,63,.92)", border: "none", color: "#fff", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={11} /></button>
            <div style={{ position: "absolute", bottom: 2, left: 2, display: "flex", gap: 2 }}>
              <button type="button" onClick={() => mover(i, -1)} className="cf-btn" style={miniMov} title="Mover antes"><ChevronLeft size={11} /></button>
              <button type="button" onClick={() => mover(i, 1)} className="cf-btn" style={miniMov} title="Mover despues"><ChevronRight size={11} /></button>
            </div>
          </div>
        ))}
        {fotos.length < max && (
          <button type="button" onClick={() => inputRef.current && inputRef.current.click()} disabled={procesando} className="cf-btn"
            style={{ width: 72, height: 72, borderRadius: 10, border: `1px dashed ${C.borde}`, background: "#fff", color: C.marronSoft, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, fontSize: 10 }}>
            {procesando ? <Loader2 size={18} className="cf-spin" /> : <Plus size={18} />}
            {procesando ? "..." : "Agregar"}
          </button>
        )}
      </div>
      <div style={{ fontSize: 11, color: C.marronSoft }}>Podes subir hasta {max} fotos · la primera es la portada · JPG, PNG o WebP</div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={elegir} style={{ display: "none" }} />
    </div>
  );
}
const miniMov = { background: "rgba(255,255,255,.9)", border: "none", color: C.marron, borderRadius: 4, width: 18, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 };

const limpiarPrecio = (v) => v.replace(/[^\d.,]/g, "");

function ModalProducto({ item, cats, onGuardar, onCerrar }) {
  const [form, setForm] = useState(
    item
      ? { ...item, images: fotosDe(item) }
      : { name: "", desc: "", price: "", cat: cats[0]?.id || "", subcat: "", sizes: "", badge: "", badgeLabel: "", images: [] }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const valido = form.name.trim() && form.cat;   // precio OPCIONAL

  return (
    <ModalShell titulo={item ? "Editar producto" : "Nuevo producto"} onCerrar={onCerrar}>
      <Campo label="Nombre del producto">
        <input value={form.name} autoFocus onChange={(e) => set("name", e.target.value)} placeholder="Ej: Muzzarella" style={inputStyle} />
      </Campo>
      <Campo label="Descripcion">
        <textarea value={form.desc} onChange={(e) => set("desc", e.target.value)} placeholder="Breve descripcion del producto" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
      </Campo>
      <Campo label="Fotos (podes subir varias)">
        <SelectorImagenes value={form.images} onChange={(imgs) => set("images", imgs)} />
      </Campo>
      <div style={{ display: "flex", gap: 12 }}>
        <Campo label="Precio (opcional)" style={{ flex: 1 }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.marronSoft, fontSize: 14 }}>$</span>
            <input value={form.price} inputMode="decimal" onChange={(e) => set("price", limpiarPrecio(e.target.value))} placeholder="Vacio = Consultar" style={{ ...inputStyle, paddingLeft: 24 }} />
          </div>
        </Campo>
        <Campo label="Categoria" style={{ flex: 1 }}>
          <select value={form.cat} onChange={(e) => set("cat", e.target.value)} style={inputStyle}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Campo>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Campo label="Subcategoria (opcional)" style={{ flex: 1 }}>
          <input value={form.subcat || ""} onChange={(e) => set("subcat", e.target.value)} placeholder="Ej: Clásicas" style={inputStyle} />
        </Campo>
        <Campo label="Tamaños (opcional)" style={{ flex: 1 }}>
          <input value={form.sizes || ""} onChange={(e) => set("sizes", e.target.value)} placeholder="Ej: Chica, Mediana, Grande" style={inputStyle} />
        </Campo>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Campo label="Etiqueta" style={{ flex: 1 }}>
          <select value={form.badge || ""} onChange={(e) => set("badge", e.target.value)} style={inputStyle}>
            <option value="">Sin etiqueta</option>
            <option value="new">Nuevo</option>
            <option value="sale">Oferta</option>
          </select>
        </Campo>
        <Campo label="Texto de la etiqueta (opcional)" style={{ flex: 1 }}>
          <input value={form.badgeLabel || ""} onChange={(e) => set("badgeLabel", e.target.value)} placeholder="Ej: -20%" style={inputStyle} disabled={!form.badge} />
        </Campo>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
        <button onClick={onCerrar} className="cf-btn" style={btnSecundario}>Cancelar</button>
        <button onClick={() => valido && onGuardar(form)} className="cf-btn" style={{ ...btnPrimario, opacity: valido ? 1 : 0.5 }}>
          <Check size={16} /> Guardar
        </button>
      </div>
    </ModalShell>
  );
}

/* ---------- Admin: Categorias ---------- */
function AdminCategorias() {
  const [cats, setCats] = useState([]);
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nueva, setNueva] = useState(false);
  const [editando, setEditando] = useState(null);

  const recargar = () => {
    setCargando(true);
    Promise.all([api.getCategorias(), api.getItems()])
      .then(([c, i]) => { setCats(c); setItems(i); })
      .finally(() => setCargando(false));
  };
  useEffect(recargar, []);

  const contar = (id) => items.filter((i) => i.cat === id).length;

  const eliminar = async (id) => {
    const n = contar(id);
    const cat = cats.find((c) => c.id === id);
    const nombre = cat ? cat.name : "esta categoria";
    const mensaje = n > 0
      ? `La categoria "${nombre}" tiene ${n} producto(s) asignado(s).\n\nSi la eliminas, tambien se eliminaran esos ${n} producto(s). Esta accion no se puede deshacer.\n\n¿Deseas continuar?`
      : `¿Eliminar la categoria "${nombre}"?`;
    if (!window.confirm(mensaje)) return;
    try {
      await api.eliminarCategoria(id);
      setCats((prev) => prev.filter((c) => c.id !== id));
      setItems((prev) => prev.filter((i) => i.cat !== id));
    } catch (e) { window.alert(e.message); }
  };

  const guardar = async (data) => {
    try {
      if (data.__edit) {
        const upd = await api.editarCategoria(data.id, { name: data.name, color: data.color });
        setCats((prev) => prev.map((c) => (c.id === upd.id ? upd : c)));
      } else {
        const nuevaCat = await api.crearCategoria({ name: data.name, color: data.color });
        setCats((prev) => [...prev, nuevaCat]);
      }
      setNueva(false); setEditando(null);
    } catch (e) { window.alert(e.message); }
  };

  const mover = async (index, dir) => {
    const destino = index + dir;
    if (destino < 0 || destino >= cats.length) return;
    const nuevo = [...cats];
    [nuevo[index], nuevo[destino]] = [nuevo[destino], nuevo[index]];
    setCats(nuevo);
    try { await api.reordenarCategorias(nuevo.map((c) => c.id)); }
    catch (e) { window.alert(e.message); recargar(); }
  };

  if (cargando) return <Cargando texto="Cargando categorias..." />;

  return (
    <>
      <AdminHeader titulo="Categorias" sub={`${cats.length} categorias · usa las flechas para ordenar`}
        accion={<BotonAgregar onClick={() => setNueva(true)}>Nueva categoria</BotonAgregar>} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
        {cats.map((c, i) => (
          <div key={c.id} style={{ background: "#fff", border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button onClick={() => mover(i, -1)} disabled={i === 0} className="cf-btn" title="Subir" style={{ background: "transparent", border: "none", padding: 2, color: i === 0 ? C.borde : C.marronSoft, cursor: i === 0 ? "default" : "pointer", lineHeight: 0 }}><ChevronUp size={18} /></button>
              <button onClick={() => mover(i, 1)} disabled={i === cats.length - 1} className="cf-btn" title="Bajar" style={{ background: "transparent", border: "none", padding: 2, color: i === cats.length - 1 ? C.borde : C.marronSoft, cursor: i === cats.length - 1 ? "default" : "pointer", lineHeight: 0 }}><ChevronDown size={18} /></button>
            </div>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: c.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: C.marronSoft }}>{contar(c.id)} productos</div>
            </div>
            <IconBtn onClick={() => setEditando(c)} color={C.terra}><Pencil size={14} /></IconBtn>
            <IconBtn onClick={() => eliminar(c.id)} color="#C6553F"><Trash2 size={14} /></IconBtn>
          </div>
        ))}
      </div>
      {(nueva || editando) && (
        <ModalCategoria cat={editando} onGuardar={guardar} onCerrar={() => { setNueva(false); setEditando(null); }} />
      )}
    </>
  );
}

function ModalCategoria({ cat, onGuardar, onCerrar }) {
  const paleta = ["#D98324", "#C0392B", "#6F9A3E", "#E0A93E", "#B26E0F", "#9B6FC4", "#5AAE8A"];
  const [form, setForm] = useState(cat ? { ...cat, __edit: true } : { name: "", color: paleta[0] });
  const valido = form.name.trim();

  return (
    <ModalShell titulo={cat ? "Editar categoria" : "Nueva categoria"} onCerrar={onCerrar}>
      <Campo label="Nombre">
        <input value={form.name} autoFocus onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Especiales" style={inputStyle} />
      </Campo>
      <Campo label="Color identificador">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {paleta.map((col) => (
            <div key={col} onClick={() => setForm((f) => ({ ...f, color: col }))} className="cf-btn"
              style={{ width: 32, height: 32, borderRadius: 8, background: col, border: form.color === col ? `3px solid ${C.texto}` : "3px solid transparent" }} />
          ))}
        </div>
      </Campo>
      <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
        <button onClick={onCerrar} className="cf-btn" style={btnSecundario}>Cancelar</button>
        <button onClick={() => valido && onGuardar(form)} className="cf-btn" style={{ ...btnPrimario, opacity: valido ? 1 : 0.5 }}>
          <Check size={16} /> Guardar
        </button>
      </div>
    </ModalShell>
  );
}

/* ---------- Admin: Site ---------- */
function AdminSite({ campos, titulo, sub, onSaved }) {
  const [form, setForm] = useState(null);
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const etiquetas = {
    nombre: "Nombre de la tienda", eslogan: "Eslogan principal", subtitulo: "Subtitulo",
    descripcion: "Descripcion (Nosotros)", direccion: "Direccion", horario: "Horario",
    telefono: "Telefono", whatsapp: "WhatsApp", instagram: "Instagram",
  };
  const hints = {
    eslogan: "Separa con una coma para el efecto de color: 'Pizza a la piedra, hecha como en casa.'",
    whatsapp: "Solo numeros con codigo de pais, sin + ni espacios. Ej: 5491112345678",
  };

  useEffect(() => { api.getSite().then(setForm); }, []);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setGuardado(false); };

  const guardar = async () => {
    setGuardando(true);
    try {
      const datos = {};
      campos.forEach((k) => (datos[k] = form[k]));
      await api.guardarSite(datos);
      setGuardado(true);
      api.getSite().then(onSaved);
    } catch (e) { window.alert(e.message); } finally { setGuardando(false); }
  };

  if (!form) return <Cargando />;

  return (
    <>
      <AdminHeader titulo={titulo} sub={sub} />
      <div style={{ maxWidth: 560 }}>
        {campos.map((k) => (
          <CampoAdmin key={k} label={etiquetas[k]} value={form[k] || ""} hint={hints[k]} textarea={k === "descripcion"} onChange={(v) => set(k, v)} />
        ))}
        <button onClick={guardar} disabled={guardando} className="cf-btn"
          style={{ marginTop: 8, background: guardado ? C.verde : C.terra, color: "#fff", border: "none", padding: "11px 22px", borderRadius: 8, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          {guardando ? <Loader2 size={16} className="cf-spin" /> : guardado ? <Check size={16} /> : null}
          {guardando ? "Guardando..." : guardado ? "Cambios guardados" : "Guardar cambios"}
        </button>
      </div>
    </>
  );
}

/* ---------- Reutilizables ---------- */
function AdminHeader({ titulo, sub, accion }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
      <div>
        <h2 className="ff-display" style={{ fontSize: 24, margin: 0, color: C.texto }}>{titulo}</h2>
        {sub && <p style={{ fontSize: 13, color: C.marronSoft, margin: "4px 0 0" }}>{sub}</p>}
      </div>
      {accion}
    </div>
  );
}

function BotonAgregar({ children, onClick }) {
  return (
    <button onClick={onClick} className="cf-btn"
      style={{ background: C.terra, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
      <Plus size={16} /> {children}
    </button>
  );
}

function IconBtn({ children, onClick, color }) {
  return (
    <button onClick={onClick} className="cf-btn"
      style={{ background: "transparent", border: `1px solid ${color}`, color, width: 30, height: 30, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {children}
    </button>
  );
}

function CampoAdmin({ label, value, onChange, textarea, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.texto }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: C.marronSoft, margin: "2px 0 4px" }}>{hint}</div>}
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} style={{ ...inputStyle, marginTop: 4, resize: "vertical" }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
      )}
    </div>
  );
}

function ModalShell({ titulo, children, onCerrar }) {
  return (
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(43,37,33,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.cremaSoft, borderRadius: 14, padding: 24, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 70px rgba(0,0,0,.35)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 className="ff-display" style={{ fontSize: 20, margin: 0, color: C.texto }}>{titulo}</h3>
          <button onClick={onCerrar} className="cf-btn" style={{ background: "transparent", border: "none", color: C.marronSoft }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Campo({ label, children, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.texto, display: "block", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borde}`, fontSize: 14, background: "#fff", outline: "none", color: C.texto };
const btnPrimario = { flex: 1, background: C.terra, color: "#fff", border: "none", padding: "11px", borderRadius: 8, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 };
const btnSecundario = { flex: 1, background: "transparent", color: C.marronSoft, border: `1px solid ${C.borde}`, padding: "11px", borderRadius: 8, fontSize: 14, fontWeight: 500 };
