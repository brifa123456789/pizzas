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
INSERT INTO categories (id, name, color, position) VALUES
  ('clasicas',     'Clásicas',      '#D98324', 1),
  ('especiales',   'Especiales',    '#C0392B', 2),
  ('vegetarianas', 'Vegetarianas',  '#6F9A3E', 3),
  ('empanadas',    'Empanadas',     '#E0A93E', 4),
  ('bebidas',      'Bebidas',       '#5AAE8A', 5)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO items (name, description, price, category_id, subcategory, sizes, badge, badge_label, visible, position) VALUES
  ('Muzzarella', 'Salsa de tomate, muzzarella y aceitunas', '7.500', 'clasicas', 'Clásicas', 'Chica, Mediana, Grande', 'new', '', 1, 1),
  ('Napolitana', 'Muzzarella, rodajas de tomate, ajo y albahaca', '8.900', 'clasicas', 'Clásicas', 'Chica, Mediana, Grande', '', '', 1, 2),
  ('Jamón y morrón', 'Muzzarella, jamón cocido y morrones', '9.200', 'clasicas', 'Clásicas', 'Chica, Mediana, Grande', '', '', 1, 3),
  ('Fugazzeta', 'Cebolla dorada y abundante muzzarella', '9.200', 'especiales', 'Especiales', 'Chica, Mediana, Grande', '', '', 1, 4),
  ('Calabresa', 'Longaniza calabresa, muzzarella y morrón', '9.800', 'especiales', 'Especiales', 'Chica, Mediana, Grande', 'sale', 'Oferta', 1, 5),
  ('Cuatro quesos', 'Muzzarella, roquefort, provolone y parmesano', '10.500', 'especiales', 'Especiales', 'Chica, Mediana, Grande', 'new', '', 1, 6),
  ('Vegetariana', 'Verduras grilladas de estación y muzzarella', '9.000', 'vegetarianas', 'Vegetarianas', 'Chica, Mediana, Grande', '', '', 1, 7),
  ('Rúcula y parmesano', 'Muzzarella, rúcula fresca y láminas de parmesano', '9.900', 'vegetarianas', 'Vegetarianas', 'Chica, Mediana, Grande', '', '', 1, 8),
  ('Empanada de carne', 'Carne cortada a cuchillo, cocida al horno', '1.200', 'empanadas', 'Empanadas', 'Unidad, Docena', '', '', 1, 9),
  ('Empanada de jamón y queso', 'Clásica, bien gratinada', '1.200', 'empanadas', 'Empanadas', 'Unidad, Docena', '', '', 0, 10),
  ('Gaseosa 1.5L', 'Línea Coca-Cola, bien fría', '2.500', 'bebidas', 'Bebidas', '', '', '', 1, 11)
;

INSERT INTO site_settings (setting_key, setting_value) VALUES
  ('nombre',      'Bella Napoli'),
  ('eslogan',     'Pizza a la piedra, hecha como en casa.'),
  ('subtitulo',   'Pizzas artesanales, empanadas y más - Delivery y take away'),
  ('descripcion', 'En Bella Napoli amasamos todos los días y cocinamos en horno a leña. Ingredientes frescos, recetas de siempre y esa muzzarella que se estira. Pedí online y disfrutá.'),
  ('direccion',   'Av. Siempre Viva 742, Local 3'),
  ('horario',     'Mar-Dom 19:00 - 00:00'),
  ('telefono',    '+54 9 1234 5678'),
  ('whatsapp',    '5491112345678'),
  ('instagram',   '@bellanapoli')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
