/**
 * Database migration + seed script.
 * Creates all required tables (idempotent) and seeds default data.
 * Run with: node dist/migrate.mjs
 */
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log("Connected to database.");

    // ──────────────────────────────────────────────
    // 1. Create tables
    // ──────────────────────────────────────────────
    console.log("Creating tables...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id          SERIAL PRIMARY KEY,
        name        TEXT    NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id           SERIAL  PRIMARY KEY,
        name         TEXT    NOT NULL,
        description  TEXT,
        price        NUMERIC(10, 2) NOT NULL,
        image_url    TEXT,
        category_id  INTEGER NOT NULL,
        available    BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order   INTEGER NOT NULL DEFAULT 0,
        is_veg       BOOLEAN NOT NULL DEFAULT TRUE,
        is_bestseller BOOLEAN NOT NULL DEFAULT FALSE,
        is_spicy     BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id             SERIAL  PRIMARY KEY,
        table_number   TEXT,
        customer_name  TEXT,
        items          JSONB   NOT NULL,
        total_amount   NUMERIC(10, 2) NOT NULL,
        status         TEXT    NOT NULL DEFAULT 'pending',
        whatsapp_sent  BOOLEAN NOT NULL DEFAULT FALSE,
        notes          TEXT,
        created_at     TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS restaurant_settings (
        id                SERIAL PRIMARY KEY,
        restaurant_name   TEXT   NOT NULL DEFAULT 'The Golden Brew',
        address           TEXT,
        whatsapp_number   TEXT,
        opening_hours     TEXT,
        logo_url          TEXT,
        banner_url        TEXT,
        primary_color     TEXT   NOT NULL DEFAULT '#c9a96e',
        tagline           TEXT
      )
    `);

    console.log("Tables created (or already existed).");

    // ──────────────────────────────────────────────
    // 2. Seed default settings (only if table empty)
    // ──────────────────────────────────────────────
    const { rows: settingsRows } = await client.query(
      "SELECT id FROM restaurant_settings LIMIT 1",
    );
    if (settingsRows.length === 0) {
      await client.query(`
        INSERT INTO restaurant_settings
          (restaurant_name, tagline, primary_color, opening_hours)
        VALUES
          ('The Golden Brew', 'Crafted with passion, served with love', '#c9a96e', 'Mon–Sun: 8 AM – 10 PM')
      `);
      console.log("Seeded default restaurant settings.");
    } else {
      console.log("Settings already exist — skipping.");
    }

    // ──────────────────────────────────────────────
    // 3. Seed categories + menu items (only if empty)
    // ──────────────────────────────────────────────
    const { rows: catRows } = await client.query(
      "SELECT id FROM categories LIMIT 1",
    );
    if (catRows.length > 0) {
      console.log("Categories already exist — skipping seed.");
      return;
    }

    console.log("Seeding categories...");

    const categories = [
      { name: "Coffee", sort_order: 0 },
      { name: "Tea & Cold Drinks", sort_order: 1 },
      { name: "Food & Pastries", sort_order: 2 },
      { name: "Desserts", sort_order: 3 },
    ];

    const catIds: Record<string, number> = {};
    for (const cat of categories) {
      const { rows } = await client.query(
        "INSERT INTO categories (name, sort_order) VALUES ($1, $2) RETURNING id",
        [cat.name, cat.sort_order],
      );
      catIds[cat.name] = rows[0].id;
    }
    console.log("Categories seeded:", Object.keys(catIds));

    console.log("Seeding menu items...");

    const items: Array<{
      name: string;
      description: string;
      price: number;
      category: string;
      is_veg: boolean;
      is_bestseller?: boolean;
      is_spicy?: boolean;
      sort_order: number;
    }> = [
      // ── Coffee ────────────────────────────────────
      {
        name: "Espresso",
        description:
          "A rich, bold shot of pure arabica — the heart of every great coffee.",
        price: 120,
        category: "Coffee",
        is_veg: true,
        is_bestseller: true,
        sort_order: 0,
      },
      {
        name: "Cappuccino",
        description:
          "Velvety espresso topped with thick microfoam and a dusting of cocoa.",
        price: 180,
        category: "Coffee",
        is_veg: true,
        is_bestseller: true,
        sort_order: 1,
      },
      {
        name: "Café Latte",
        description:
          "Smooth espresso with steamed milk and a light layer of foam.",
        price: 200,
        category: "Coffee",
        is_veg: true,
        sort_order: 2,
      },
      {
        name: "Cold Brew",
        description: "Steeped for 12 hours, slow-chilled, refreshingly smooth.",
        price: 220,
        category: "Coffee",
        is_veg: true,
        is_bestseller: true,
        sort_order: 3,
      },
      {
        name: "Caramel Macchiato",
        description:
          "Layers of vanilla syrup, steamed milk, espresso and caramel drizzle.",
        price: 240,
        category: "Coffee",
        is_veg: true,
        sort_order: 4,
      },
      // ── Tea & Cold Drinks ─────────────────────────
      {
        name: "Masala Chai",
        description:
          "Aromatic Indian spiced tea brewed with ginger, cardamom and cinnamon.",
        price: 90,
        category: "Tea & Cold Drinks",
        is_veg: true,
        is_bestseller: true,
        sort_order: 0,
      },
      {
        name: "Iced Matcha Latte",
        description: "Ceremonial-grade matcha whisked with oat milk over ice.",
        price: 230,
        category: "Tea & Cold Drinks",
        is_veg: true,
        sort_order: 1,
      },
      {
        name: "Fresh Lime Soda",
        description:
          "Freshly squeezed limes, sparkling water, rock salt — pure refreshment.",
        price: 110,
        category: "Tea & Cold Drinks",
        is_veg: true,
        sort_order: 2,
      },
      {
        name: "Mango Smoothie",
        description:
          "Alphonso mango blended with yoghurt and a touch of cardamom.",
        price: 190,
        category: "Tea & Cold Drinks",
        is_veg: true,
        is_bestseller: true,
        sort_order: 3,
      },
      // ── Food & Pastries ────────────────────────────
      {
        name: "Butter Croissant",
        description:
          "Flaky, golden, layered with real French butter. Baked fresh each morning.",
        price: 150,
        category: "Food & Pastries",
        is_veg: true,
        is_bestseller: true,
        sort_order: 0,
      },
      {
        name: "Avocado Toast",
        description:
          "Sourdough, smashed avocado, chilli flakes, poached egg and microgreens.",
        price: 280,
        category: "Food & Pastries",
        is_veg: true,
        sort_order: 1,
      },
      {
        name: "Spicy Chicken Sandwich",
        description:
          "Grilled chicken, sriracha mayo, pickled jalapeños and crisp lettuce.",
        price: 320,
        category: "Food & Pastries",
        is_veg: false,
        is_spicy: true,
        sort_order: 2,
      },
      {
        name: "Banana Walnut Muffin",
        description:
          "Moist banana muffin studded with toasted walnuts and brown sugar.",
        price: 130,
        category: "Food & Pastries",
        is_veg: true,
        sort_order: 3,
      },
      // ── Desserts ───────────────────────────────────
      {
        name: "Chocolate Brownie",
        description:
          "Dense, fudgy dark chocolate brownie with a sea-salt caramel swirl.",
        price: 180,
        category: "Desserts",
        is_veg: true,
        is_bestseller: true,
        sort_order: 0,
      },
      {
        name: "New York Cheesecake",
        description:
          "Classic baked cheesecake on a buttery graham cracker crust.",
        price: 240,
        category: "Desserts",
        is_veg: true,
        sort_order: 1,
      },
      {
        name: "Tiramisu",
        description:
          "Espresso-soaked ladyfingers, mascarpone cream, dusted with premium cocoa.",
        price: 260,
        category: "Desserts",
        is_veg: true,
        is_bestseller: true,
        sort_order: 2,
      },
    ];

    for (const item of items) {
      const catId = catIds[item.category];
      await client.query(
        `INSERT INTO menu_items
           (name, description, price, category_id, is_veg, is_bestseller, is_spicy, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          item.name,
          item.description,
          item.price,
          catId,
          item.is_veg,
          item.is_bestseller ?? false,
          item.is_spicy ?? false,
          item.sort_order,
        ],
      );
    }

    console.log(`Seeded ${items.length} menu items.`);
    console.log("");
    console.log("✓ Migration complete.");
    console.log("  Admin login: twister.admin@gmail.com / admin123");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
