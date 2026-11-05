import { pool } from "./index.js";

export async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log("[Migration] Running idempotent schema migration for local PostgreSQL 16...");

    await client.query(`
      -- 1. Multi-Tenant infrastructure (Preserved for single-tenant local parity)
      CREATE TABLE IF NOT EXISTS cafes (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS restaurant_tables (
        id SERIAL PRIMARY KEY,
        cafe_id INTEGER NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
        table_number INTEGER NOT NULL,
        active_order_id BIGINT,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_restaurant_tables_cafe_id ON restaurant_tables(cafe_id);

      -- 2. Catalog & Restaurant Settings
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        name TEXT NOT NULL,
        description TEXT,
        price NUMERIC(10, 2) NOT NULL,
        image_url TEXT,
        available BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_veg BOOLEAN NOT NULL DEFAULT TRUE,
        is_bestseller BOOLEAN NOT NULL DEFAULT FALSE,
        is_spicy BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
      CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);

      CREATE TABLE IF NOT EXISTS restaurant_settings (
        id SERIAL PRIMARY KEY,
        restaurant_name TEXT NOT NULL DEFAULT 'The Golden Brew',
        address TEXT,
        whatsapp_number TEXT,
        opening_hours TEXT,
        logo_url TEXT,
        banner_url TEXT,
        primary_color TEXT NOT NULL DEFAULT '#c9a96e',
        tagline TEXT
      );

      -- 3. Orders & Normalized Order Items
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        cafe_id INTEGER NOT NULL DEFAULT 1 REFERENCES cafes(id) ON DELETE RESTRICT,
        table_id INTEGER REFERENCES restaurant_tables(id) ON DELETE SET NULL,
        table_number TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        tax NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        status TEXT NOT NULL DEFAULT 'pending',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_paid BOOLEAN NOT NULL DEFAULT FALSE,
        updated BOOLEAN NOT NULL DEFAULT FALSE,
        is_updated BOOLEAN NOT NULL DEFAULT FALSE,
        latest_added_items JSONB,
        whatsapp_sent BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT,
        order_access_token_hash TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_is_active ON orders(is_active);
      CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);

      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
        item_name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);

      -- 4. Loyalty Program & Admin Authentication
      CREATE TABLE IF NOT EXISTS rewards_users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT UNIQUE,
        email TEXT UNIQUE,
        pin_hash TEXT,
        stars INTEGER NOT NULL DEFAULT 0,
        total_visits INTEGER NOT NULL DEFAULT 0,
        reward_available BOOLEAN NOT NULL DEFAULT FALSE,
        rewards_claimed INTEGER NOT NULL DEFAULT 0,
        last_star_date DATE,
        last_visit_date DATE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_rewards_users_phone ON rewards_users(phone);
      CREATE INDEX IF NOT EXISTS idx_rewards_users_email ON rewards_users(email);

      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    console.log("[Migration] Schema migration completed successfully with zero copied production rows.");
  } catch (err) {
    console.error("[Migration] Error running migration:", err);
    throw err;
  } finally {
    client.release();
  }
}

// Allow direct execution
if (process.argv[1]?.endsWith("migrate.ts") || process.argv[1]?.endsWith("migrate.js")) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

