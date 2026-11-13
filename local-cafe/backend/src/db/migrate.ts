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

      CREATE TABLE IF NOT EXISTS menu_item_reviews (
        id BIGSERIAL PRIMARY KEY,
        menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
        reviewer_key_hash TEXT NOT NULL,
        rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        review_text TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (menu_item_id, reviewer_key_hash)
      );

      CREATE INDEX IF NOT EXISTS idx_menu_item_reviews_recent
        ON menu_item_reviews(menu_item_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS restaurant_settings (
        id SERIAL PRIMARY KEY,
        restaurant_name TEXT NOT NULL DEFAULT 'Kusum Kunja Café',
        address TEXT,
        gstin TEXT,
        whatsapp_number TEXT,
        opening_hours TEXT,
        logo_url TEXT,
        banner_url TEXT,
        primary_color TEXT NOT NULL DEFAULT '#c9a96e',
        tagline TEXT
      );

      ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS gstin TEXT;
      ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

      -- Update only the previous default brand; preserve custom café names.
      UPDATE restaurant_settings
      SET restaurant_name = 'Kusum Kunja Café'
      WHERE lower(trim(restaurant_name)) IN ('the golden brew', 'the golden brew cafe', 'the golden brew café');

      UPDATE cafes
      SET name = 'Kusum Kunja Café'
      WHERE lower(trim(name)) IN ('the golden brew', 'the golden brew cafe', 'the golden brew café');

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

      -- 5. Shared Table Sessions for QR Ordering
      CREATE TABLE IF NOT EXISTS table_sessions (
        id SERIAL PRIMARY KEY,
        cafe_id INTEGER NOT NULL DEFAULT 1 REFERENCES cafes(id) ON DELETE CASCADE,
        table_number TEXT NOT NULL,
        party_size INTEGER NOT NULL CHECK (party_size BETWEEN 1 AND 4),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_table_sessions_table_status ON table_sessions(table_number, status);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_session_per_table ON table_sessions(table_number) WHERE (status = 'active');

      CREATE TABLE IF NOT EXISTS table_session_members (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
        guest_token_hash TEXT NOT NULL UNIQUE,
        guest_name TEXT,
        is_first_guest BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_session_members_session_id ON table_session_members(session_id);

      -- Add session_id and guest_member_id to orders table (idempotent)
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES table_sessions(id) ON DELETE SET NULL;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_member_id INTEGER REFERENCES table_session_members(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);
      CREATE INDEX IF NOT EXISTS idx_orders_guest_member_id ON orders(guest_member_id);

      -- Add idempotency_key and idempotency_payload_hash to orders table (idempotent, partial unique index)
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_payload_hash TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;

      -- Add is_paid to table_sessions (idempotent)
      ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT FALSE;
      CREATE INDEX IF NOT EXISTS idx_table_sessions_is_paid ON table_sessions(is_paid);

      -- Update table_sessions status check to permit 'closed' alongside 'active' and 'finished' (idempotent)
      ALTER TABLE table_sessions DROP CONSTRAINT IF EXISTS table_sessions_status_check;
      ALTER TABLE table_sessions ADD CONSTRAINT table_sessions_status_check CHECK (status IN ('active', 'finished', 'closed'));

      -- 6. Offers & Combos Management
      CREATE TABLE IF NOT EXISTS offers (
        id SERIAL PRIMARY KEY,
        cafe_id INTEGER NOT NULL DEFAULT 1 REFERENCES cafes(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        code TEXT,
        badge TEXT,
        offer_type TEXT NOT NULL DEFAULT 'discount' CHECK (offer_type IN ('discount', 'combo')),
        discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'flat')),
        discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        combo_price NUMERIC(10, 2),
        combo_items JSONB DEFAULT '[]'::jsonb,
        image_url TEXT,
        start_date DATE,
        end_date DATE,
        start_time TIME,
        end_time TIME,
        days_of_week JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_offers_code ON offers(UPPER(code));
      CREATE INDEX IF NOT EXISTS idx_offers_is_active ON offers(is_active);
      CREATE INDEX IF NOT EXISTS idx_offers_cafe_id ON offers(cafe_id);

      -- Add discount, promo_code, and offer_id to orders table (idempotent)
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS offer_id INTEGER REFERENCES offers(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_orders_offer_id ON orders(offer_id);

      -- Seed imported / demo promotional content as inactive admin drafts if not already present.
      -- Note: Unapproved demo or mismatched promotions are never published as active offers.
      -- They remain inactive drafts (is_active = FALSE) until an administrator explicitly reviews and activates them.
      -- Existing admin-created or customized offers are preserved and never overwritten.
      INSERT INTO offers (
        cafe_id, title, description, code, badge, offer_type,
        discount_type, discount_value, min_order_amount,
        start_time, end_time, is_active, sort_order
      )
      SELECT 1, '20% OFF Breakfast Combo (Draft)',
             'Order any handcrafted specialty coffee with a croissant or avocado toast before 11:30 AM.',
             'BREAKFAST20', 'Daily until 11:30 AM', 'discount',
             'percentage', 20.00, 0.00,
             NULL, '11:30:00', FALSE, 1
      WHERE NOT EXISTS (SELECT 1 FROM offers WHERE UPPER(code) = 'BREAKFAST20');

      INSERT INTO offers (
        cafe_id, title, description, code, badge, offer_type,
        discount_type, discount_value, min_order_amount,
        start_time, end_time, is_active, sort_order
      )
      SELECT 1, 'Buy 2 Coffees, Get 1 Pastry (Draft)',
             'Order any 2 signature espresso or cold brew drinks and receive a complimentary artisan pastry at Kusum Kunja Café.',
             'GOLDENBREW', 'All-Day Special', 'discount',
             'flat', 50.00, 150.00,
             NULL, NULL, FALSE, 2
      WHERE NOT EXISTS (SELECT 1 FROM offers WHERE UPPER(code) = 'GOLDENBREW');

      INSERT INTO offers (
        cafe_id, title, description, code, badge, offer_type,
        discount_type, discount_value, min_order_amount,
        start_time, end_time, is_active, sort_order
      )
      SELECT 1, 'Flat ₹75 OFF on QR Orders (Draft)',
             'Enjoy ₹75 instant savings on orders above ₹300 placed directly from your table.',
             'FLAT75', 'Min Order ₹300', 'discount',
             'flat', 75.00, 300.00,
             NULL, NULL, FALSE, 3
      WHERE NOT EXISTS (SELECT 1 FROM offers WHERE UPPER(code) = 'FLAT75');

      INSERT INTO offers (
        cafe_id, title, description, code, badge, offer_type,
        discount_type, discount_value, min_order_amount,
        start_time, end_time, is_active, sort_order
      )
      SELECT 1, '15% OFF Desserts & Coolers (Draft)',
             'Relax during afternoon hours with 15% discount on all cakes, tarts, and botanical coolers.',
             'HAPPYHOUR', '4:00 PM – 7:00 PM', 'discount',
             'percentage', 15.00, 0.00,
             '16:00:00', '19:00:00', FALSE, 4
      WHERE NOT EXISTS (SELECT 1 FROM offers WHERE UPPER(code) = 'HAPPYHOUR');

      INSERT INTO offers (
        cafe_id, title, description, code, badge, offer_type,
        discount_type, discount_value, min_order_amount,
        combo_price, combo_items, is_active, sort_order
      )
      SELECT 1, 'Specialty Coffee & Croissant Combo (Draft)',
             'Pair any signature handcrafted espresso or cappuccino with a warm, flaky butter croissant at Kusum Kunja Café.',
             'COFFEECOMBO', 'Breakfast Combo', 'combo',
             'flat', 0.00, 0.00,
             189.00, '[{"name": "Cappuccino", "quantity": 1}, {"name": "Butter Croissant", "quantity": 1}]'::jsonb,
             FALSE, 5
      WHERE NOT EXISTS (SELECT 1 FROM offers WHERE UPPER(code) = 'COFFEECOMBO');

      -- Ensure previously seeded demo records are marked inactive drafts
      UPDATE offers
      SET is_active = FALSE
      WHERE code IN ('BREAKFAST20', 'GOLDENBREW', 'FLAT75', 'HAPPYHOUR', 'COFFEECOMBO')
        AND (title LIKE '%(Draft)%' OR description ILIKE '%croissant%' OR description ILIKE '%pastry%' OR description ILIKE '%Kusum%');

      -- 7. Menu Item Inventory & Stock Movements
      ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS inventory_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
      ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS inventory_unit TEXT NOT NULL DEFAULT 'portions';
      ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC(10, 2) NOT NULL DEFAULT 5.00;

      CREATE INDEX IF NOT EXISTS idx_menu_items_track_inventory ON menu_items(track_inventory);

      CREATE TABLE IF NOT EXISTS inventory_movements (
        id SERIAL PRIMARY KEY,
        cafe_id INTEGER NOT NULL DEFAULT 1 REFERENCES cafes(id) ON DELETE CASCADE,
        menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
        movement_type TEXT NOT NULL CHECK (movement_type IN ('stock_in', 'stock_out', 'order_deduction', 'order_reversal', 'opening_stock', 'adjustment')),
        quantity NUMERIC(10, 2) NOT NULL,
        balance_after NUMERIC(10, 2) NOT NULL,
        unit TEXT NOT NULL DEFAULT 'portions',
        reason TEXT,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        performed_by TEXT NOT NULL DEFAULT 'admin',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON inventory_movements(menu_item_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);
      CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at);
      CREATE INDEX IF NOT EXISTS idx_inventory_movements_order_id ON inventory_movements(order_id);

      -- Add inventory_deducted to orders table (idempotent)
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_deducted BOOLEAN NOT NULL DEFAULT FALSE;
      CREATE INDEX IF NOT EXISTS idx_orders_inventory_deducted ON orders(inventory_deducted);

      -- 8. Raw Materials, Supplies, and Recipe Consumption
      CREATE TABLE IF NOT EXISTS raw_materials (
        id SERIAL PRIMARY KEY,
        cafe_id INTEGER NOT NULL DEFAULT 1 REFERENCES cafes(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Ingredients',
        sku TEXT,
        base_unit TEXT NOT NULL DEFAULT 'kg',
        current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
        low_stock_threshold NUMERIC(12, 3) NOT NULL DEFAULT 2.000,
        supplier TEXT,
        unit_cost NUMERIC(10, 2),
        batch_number TEXT,
        expiry_date DATE,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_raw_materials_cafe ON raw_materials(cafe_id);
      CREATE INDEX IF NOT EXISTS idx_raw_materials_category ON raw_materials(category);
      CREATE INDEX IF NOT EXISTS idx_raw_materials_is_archived ON raw_materials(is_archived);
      CREATE INDEX IF NOT EXISTS idx_raw_materials_expiry ON raw_materials(expiry_date);

      CREATE TABLE IF NOT EXISTS raw_material_movements (
        id SERIAL PRIMARY KEY,
        cafe_id INTEGER NOT NULL DEFAULT 1 REFERENCES cafes(id) ON DELETE CASCADE,
        raw_material_id INTEGER NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
        movement_type TEXT NOT NULL CHECK (movement_type IN ('stock_in', 'stock_out', 'adjustment', 'recipe_consumption', 'order_reversal', 'opening_stock')),
        quantity NUMERIC(12, 3) NOT NULL,
        unit TEXT NOT NULL DEFAULT 'kg',
        base_quantity NUMERIC(12, 3) NOT NULL,
        balance_before NUMERIC(12, 3) NOT NULL,
        balance_after NUMERIC(12, 3) NOT NULL,
        unit_cost NUMERIC(10, 2),
        total_cost NUMERIC(10, 2),
        supplier TEXT,
        invoice_ref TEXT,
        batch_number TEXT,
        expiry_date DATE,
        reason TEXT,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        performed_by TEXT NOT NULL DEFAULT 'admin',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_rm_movements_item ON raw_material_movements(raw_material_id);
      CREATE INDEX IF NOT EXISTS idx_rm_movements_type ON raw_material_movements(movement_type);
      CREATE INDEX IF NOT EXISTS idx_rm_movements_created ON raw_material_movements(created_at);
      CREATE INDEX IF NOT EXISTS idx_rm_movements_order ON raw_material_movements(order_id);

      CREATE TABLE IF NOT EXISTS menu_item_recipes (
        id SERIAL PRIMARY KEY,
        cafe_id INTEGER NOT NULL DEFAULT 1 REFERENCES cafes(id) ON DELETE CASCADE,
        menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
        raw_material_id INTEGER NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
        quantity NUMERIC(12, 3) NOT NULL,
        unit TEXT NOT NULL DEFAULT 'kg',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE (menu_item_id, raw_material_id)
      );

      -- Migration: Ensure foreign keys on raw_material_movements and menu_item_recipes
      -- strictly enforce ON DELETE RESTRICT to preserve immutable audit logs and recipe history.
      DO $$
      BEGIN
        -- raw_material_movements -> raw_materials (RESTRICT)
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'raw_material_movements_raw_material_id_fkey'
        ) THEN
          ALTER TABLE raw_material_movements DROP CONSTRAINT raw_material_movements_raw_material_id_fkey;
        END IF;
        ALTER TABLE raw_material_movements
          ADD CONSTRAINT raw_material_movements_raw_material_id_fkey
          FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE RESTRICT;

        -- menu_item_recipes -> raw_materials (RESTRICT)
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'menu_item_recipes_raw_material_id_fkey'
        ) THEN
          ALTER TABLE menu_item_recipes DROP CONSTRAINT menu_item_recipes_raw_material_id_fkey;
        END IF;
        ALTER TABLE menu_item_recipes
          ADD CONSTRAINT menu_item_recipes_raw_material_id_fkey
          FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE RESTRICT;
      EXCEPTION
        WHEN undefined_table THEN NULL;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_recipes_menu_item ON menu_item_recipes(menu_item_id);
      CREATE INDEX IF NOT EXISTS idx_recipes_raw_material ON menu_item_recipes(raw_material_id);

      ALTER TABLE orders ADD COLUMN IF NOT EXISTS raw_materials_deducted BOOLEAN NOT NULL DEFAULT FALSE;
      CREATE INDEX IF NOT EXISTS idx_orders_raw_materials_deducted ON orders(raw_materials_deducted);

      -- 9. Table Scan Links (Reusable Printed QR & Single-Use Access Tokens)
      CREATE TABLE IF NOT EXISTS table_scan_links (
        id SERIAL PRIMARY KEY,
        cafe_id INTEGER NOT NULL DEFAULT 1 REFERENCES cafes(id) ON DELETE CASCADE,
        table_number TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        is_superseded BOOLEAN NOT NULL DEFAULT FALSE,
        redeemed_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_scan_links_token_hash ON table_scan_links(token_hash);
      CREATE INDEX IF NOT EXISTS idx_scan_links_table ON table_scan_links(table_number, is_superseded, redeemed_at);
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

