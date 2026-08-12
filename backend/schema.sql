-- ============================================================
--  BELLA NAPOLI — Esquema de base de datos (pizzeria)
--  Ejecutar en MySQL: mysql -u root -p < schema.sql
--  (o usar el script npm run init-db, que ademas crea el admin)
-- ============================================================

CREATE DATABASE IF NOT EXISTS bellanapoli
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bellanapoli;

-- ─── Administradores ───────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(60)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Categorias ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id       VARCHAR(20) PRIMARY KEY,       -- ej: "clasicas", "especiales"
  name     VARCHAR(80) NOT NULL,
  color    VARCHAR(9)  NOT NULL DEFAULT '#C08A17',
  position INT NOT NULL DEFAULT 0
);

-- ─── Productos ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  description TEXT,
  price       VARCHAR(20)  NOT NULL DEFAULT '', -- opcional; vacio = "Consultar"
  image       MEDIUMTEXT,                  -- primera foto (miniatura)
  images      LONGTEXT,                    -- todas las fotos: JSON array de data URLs
  category_id VARCHAR(20)  NOT NULL,
  subcategory VARCHAR(80)  DEFAULT '',     -- ej: "Clasicas", "Especiales"
  sizes       VARCHAR(160) DEFAULT '',     -- tamaños: "Chica, Mediana, Grande"
  size_prices LONGTEXT,                    -- precio por tamaño: JSON [{name, price}]
  badge       VARCHAR(20)  DEFAULT '',     -- '', 'new' o 'sale'
  badge_label VARCHAR(40)  DEFAULT '',     -- texto opcional del badge (ej: "Oferta")
  visible     TINYINT(1)   NOT NULL DEFAULT 1,
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_item_category
    FOREIGN KEY (category_id) REFERENCES categories(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ─── Configuracion del sitio (clave/valor) ─────────────
CREATE TABLE IF NOT EXISTS site_settings (
  setting_key   VARCHAR(50) PRIMARY KEY,
  setting_value TEXT
);

-- ─── Datos iniciales (semilla) ─────────────────────────
-- INSERT IGNORE: solo inserta lo que falta. NUNCA pisa lo que ya editaste
-- desde el panel, aunque vuelvas a correr init-db.
INSERT IGNORE INTO categories (id, name, color, position) VALUES
  ('clasicas',     'Clásicas',      '#D98324', 1),
  ('especiales',   'Especiales',    '#C0392B', 2),
  ('vegetarianas', 'Vegetarianas',  '#6F9A3E', 3),
  ('empanadas',    'Empanadas',     '#E0A93E', 4),
  ('bebidas',      'Bebidas',       '#5AAE8A', 5);

INSERT INTO items (name, description, price, category_id, subcategory, sizes, size_prices, badge, badge_label, visible, position) VALUES
  ('Muzzarella', 'Salsa de tomate, muzzarella y aceitunas', '11.000', 'clasicas', '', 'Chica, Mediana, Grande', '[{"name":"Chica","price":"8.000"},{"name":"Mediana","price":"11.000"},{"name":"Grande","price":"13.000"}]', '', '', 1, 1),
  ('Napolitana', 'Muzzarella, rodajas de tomate, ajo y albahaca', '12.500', 'clasicas', '', 'Chica, Mediana, Grande', '[{"name":"Chica","price":"9.500"},{"name":"Mediana","price":"12.500"},{"name":"Grande","price":"14.500"}]', '', '', 1, 2),
  ('Jamón y morrón', 'Muzzarella, jamón cocido y morrones', '13.000', 'clasicas', '', 'Chica, Mediana, Grande', '[{"name":"Chica","price":"10.000"},{"name":"Mediana","price":"13.000"},{"name":"Grande","price":"15.000"}]', '', '', 1, 3),
  ('Fugazzeta', 'Cebolla dorada y abundante muzzarella', '12.500', 'especiales', '', 'Chica, Mediana, Grande', '[{"name":"Chica","price":"9.500"},{"name":"Mediana","price":"12.500"},{"name":"Grande","price":"14.500"}]', '', '', 1, 4),
  ('Calabresa', 'Longaniza calabresa, muzzarella y morrón', '13.500', 'especiales', '', 'Chica, Mediana, Grande', '[{"name":"Chica","price":"10.500"},{"name":"Mediana","price":"13.500"},{"name":"Grande","price":"16.000"}]', '', '', 1, 5),
  ('Cuatro quesos', 'Muzzarella, roquefort, provolone y parmesano', '14.500', 'especiales', '', 'Chica, Mediana, Grande', '[{"name":"Chica","price":"11.000"},{"name":"Mediana","price":"14.500"},{"name":"Grande","price":"16.500"}]', '', '', 1, 6),
  ('Vegetariana', 'Verduras grilladas de estación y muzzarella', '12.500', 'vegetarianas', '', 'Chica, Mediana, Grande', '[{"name":"Chica","price":"9.500"},{"name":"Mediana","price":"12.500"},{"name":"Grande","price":"14.500"}]', '', '', 1, 7),
  ('Rúcula y parmesano', 'Muzzarella, rúcula fresca y láminas de parmesano', '13.500', 'vegetarianas', '', 'Chica, Mediana, Grande', '[{"name":"Chica","price":"10.500"},{"name":"Mediana","price":"13.500"},{"name":"Grande","price":"15.500"}]', '', '', 1, 8),
  ('Empanada de carne', 'Carne cortada a cuchillo, cocida al horno', '1.200', 'empanadas', '', 'Unidad, Docena', '[{"name":"Unidad","price":"1.200"},{"name":"Docena","price":"13.000"}]', '', '', 1, 9),
  ('Empanada de jamón y queso', 'Clásica, bien gratinada', '1.200', 'empanadas', '', 'Unidad, Docena', '[{"name":"Unidad","price":"1.200"},{"name":"Docena","price":"13.000"}]', '', '', 0, 10),
  ('Gaseosa 1.5L', 'Línea Coca-Cola, bien fría', '2.500', 'bebidas', '', '', NULL, '', '', 1, 11)
;

INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES
  ('nombre',      'Bella Napoli'),
  ('eslogan',     'Pizza a la piedra, hecha como en casa.'),
  ('subtitulo',   'Pizzas artesanales, empanadas y más - Delivery y take away'),
  ('descripcion', 'En Bella Napoli amasamos todos los días y cocinamos en horno a leña. Ingredientes frescos, recetas de siempre y esa muzzarella que se estira. Pedí online y disfrutá.'),
  ('direccion',   'Av. Siempre Viva 742, Local 3'),
  ('horario',     'Mar-Dom 19:00 - 00:00'),
  ('telefono',    '+54 9 1234 5678'),
  ('whatsapp',    '5491112345678'),
  ('instagram',   '@bellanapoli'),
  ('envio',        ''),
  ('horaApertura', '18:00'),
  ('horaCierre',   '22:00'),
  ('diasCerrado',  '');
