import { Router, Request, Response } from "express";
import { query } from "../db/index.js";
import { verifyAdminToken } from "../lib/auth.js";

const router = Router();

// Helper to check if request is from authenticated admin
function isAdminRequest(req: Request): boolean {
  const token = req.cookies?.admin_session || req.headers.authorization?.replace(/^Bearer\s+/, "");
  if (!token) return false;
  const payload = verifyAdminToken(token);
  return payload?.role === "admin";
}

/**
 * GET /api/offers
 * Customer: Returns active and currently valid offers.
 * Admin with ?all=true: Returns all offers (active and inactive) for management.
 */
router.get("/offers", async (req: Request, res: Response) => {
  try {
    const showAll = req.query.all === "true";

    if (showAll) {
      if (!isAdminRequest(req)) {
        res.status(401).json({ error: "Admin authentication required" });
        return;
      }
    }

    let sql: string;
    let params: any[] = [];

    if (showAll) {
      sql = `
        SELECT 
          id, cafe_id, title, description, code, badge,
          offer_type AS "offerType",
          discount_type AS "discountType",
          discount_value AS "discountValue",
          min_order_amount AS "minOrderAmount",
          combo_price AS "comboPrice",
          combo_items AS "comboItems",
          image_url AS "imageUrl",
          start_date AS "startDate",
          end_date AS "endDate",
          start_time AS "startTime",
          end_time AS "endTime",
          days_of_week AS "daysOfWeek",
          is_active AS "isActive",
          sort_order AS "sortOrder",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM offers
        ORDER BY sort_order ASC, id ASC
      `;
    } else {
      // Customer view: active offers whose date range is currently valid
      sql = `
        SELECT 
          id, cafe_id, title, description, code, badge,
          offer_type AS "offerType",
          discount_type AS "discountType",
          discount_value AS "discountValue",
          min_order_amount AS "minOrderAmount",
          combo_price AS "comboPrice",
          combo_items AS "comboItems",
          image_url AS "imageUrl",
          start_date AS "startDate",
          end_date AS "endDate",
          start_time AS "startTime",
          end_time AS "endTime",
          days_of_week AS "daysOfWeek",
          is_active AS "isActive",
          sort_order AS "sortOrder",
          created_at AS "createdAt"
        FROM offers
        WHERE is_active = TRUE
          AND (start_date IS NULL OR start_date <= CURRENT_DATE)
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        ORDER BY sort_order ASC, id ASC
      `;
    }

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch offers", details: err.message });
  }
});

/**
 * Automatically evaluates all active, valid offers against the order items and subtotal,
 * and returns the best single eligible discount without stacking.
 */
export async function calculateBestEligibleOffer(
  subtotal: number,
  items: Array<{
    menuItemId?: number | null;
    menu_item_id?: number | null;
    name?: string | null;
    item_name?: string | null;
    quantity: number | string;
    price: number | string;
  }> = []
): Promise<{
  bestOffer: any | null;
  discountAmount: number;
  finalTotal: number;
}> {
  const numSubtotal = Number(subtotal);
  if (isNaN(numSubtotal) || numSubtotal <= 0) {
    return { bestOffer: null, discountAmount: 0, finalTotal: 0 };
  }

  // 1. Fetch all active offers within current date window
  const offersRes = await query(`
    SELECT *
    FROM offers
    WHERE is_active = TRUE
      AND (start_date IS NULL OR start_date <= CURRENT_DATE)
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    ORDER BY sort_order ASC, id ASC
  `);

  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, "0");
  const currentMins = String(now.getMinutes()).padStart(2, "0");
  const currentTime = `${currentHours}:${currentMins}:00`;
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ...

  let bestOffer: any | null = null;
  let maxDiscount = 0;

  for (const offer of offersRes.rows) {
    // 2. Time window check
    if (offer.start_time && currentTime < offer.start_time) continue;
    if (offer.end_time && currentTime > offer.end_time) continue;

    // 3. Days of week check (if specified)
    if (offer.days_of_week) {
      const days = Array.isArray(offer.days_of_week)
        ? offer.days_of_week
        : typeof offer.days_of_week === "string"
        ? JSON.parse(offer.days_of_week)
        : [];
      if (Array.isArray(days) && days.length > 0 && !days.includes(currentDay)) {
        continue;
      }
    }

    // 4. Minimum order check
    const minOrder = Number(offer.min_order_amount || 0);
    if (numSubtotal < minOrder) continue;

    // 5. Evaluate discount based on offer type
    let discount = 0;

    if (offer.offer_type === "combo") {
      const comboItems: Array<{ menuItemId?: number; name: string; quantity: number }> =
        Array.isArray(offer.combo_items)
          ? offer.combo_items
          : typeof offer.combo_items === "string"
          ? JSON.parse(offer.combo_items)
          : [];

      if (comboItems.length > 0) {
        if (!items || items.length === 0) continue;

        let regularComboCost = 0;
        let isEligible = true;

        for (const reqItem of comboItems) {
          const reqQty = Number(reqItem.quantity) || 1;
          const reqMenuItemId = reqItem.menuItemId ? Number(reqItem.menuItemId) : null;
          const reqName = (reqItem.name || "").trim().toLowerCase();

          // Check if menu item is currently available
          let menuItemRes;
          if (reqMenuItemId) {
            menuItemRes = await query(`SELECT available FROM menu_items WHERE id = $1`, [reqMenuItemId]);
          } else {
            menuItemRes = await query(`SELECT available FROM menu_items WHERE LOWER(name) = $1 LIMIT 1`, [reqName]);
          }

          if (menuItemRes.rows.length > 0 && menuItemRes.rows[0].available === false) {
            isEligible = false;
            break;
          }

          // Match items in order payload
          const matchingOrderItems = items.filter((orderItem) => {
            const id =
              orderItem.menuItemId !== undefined && orderItem.menuItemId !== null
                ? Number(orderItem.menuItemId)
                : orderItem.menu_item_id !== undefined && orderItem.menu_item_id !== null
                ? Number(orderItem.menu_item_id)
                : null;
            if (reqMenuItemId && id) return id === reqMenuItemId;
            const name = (orderItem.name ?? orderItem.item_name ?? "").trim().toLowerCase();
            return name === reqName;
          });

          const matchingQty = matchingOrderItems.reduce(
            (sum, it) => sum + (Number(it.quantity) || 0),
            0
          );

          if (matchingQty < reqQty) {
            isEligible = false;
            break;
          }

          const unitPrice = Number(matchingOrderItems[0]?.price) || 0;
          regularComboCost += reqQty * unitPrice;
        }

        if (!isEligible) continue;

        const comboPrice = offer.combo_price !== null && offer.combo_price !== undefined
          ? Number(offer.combo_price)
          : null;

        if (comboPrice !== null && comboPrice >= 0) {
          discount = Math.max(0, Math.round((regularComboCost - comboPrice) * 100) / 100);
        } else if (offer.discount_type === "percentage") {
          discount = Math.round((regularComboCost * Number(offer.discount_value)) / 100 * 100) / 100;
        } else {
          discount = Math.min(regularComboCost, Number(offer.discount_value));
        }
      } else {
        // Fallback for combo without items
        if (offer.combo_price !== null && offer.combo_price !== undefined) {
          discount = Math.max(0, numSubtotal - Number(offer.combo_price));
        } else if (offer.discount_type === "percentage") {
          discount = Math.round((numSubtotal * Number(offer.discount_value)) / 100 * 100) / 100;
        } else {
          discount = Math.min(numSubtotal, Number(offer.discount_value));
        }
      }
    } else if (offer.discount_type === "percentage") {
      discount = Math.round((numSubtotal * Number(offer.discount_value)) / 100 * 100) / 100;
    } else {
      discount = Math.min(numSubtotal, Number(offer.discount_value));
    }

    if (discount > maxDiscount) {
      maxDiscount = discount;
      bestOffer = {
        id: offer.id,
        title: offer.title,
        description: offer.description,
        badge: offer.badge,
        offerType: offer.offer_type,
        discountType: offer.discount_type,
        discountValue: Number(offer.discount_value),
        minOrderAmount: minOrder,
        comboPrice: offer.combo_price ? Number(offer.combo_price) : null,
        comboItems: offer.combo_items,
        code: offer.code,
      };
    }
  }

  const finalTotal = Math.max(0, Math.round((numSubtotal - maxDiscount) * 100) / 100);

  return {
    bestOffer,
    discountAmount: maxDiscount,
    finalTotal,
  };
}

/**
 * POST /api/offers/evaluate
 * Automatically evaluates best eligible offer for current cart subtotal and items.
 */
router.post("/offers/evaluate", async (req: Request, res: Response) => {
  try {
    const { subtotal = 0, items = [] } = req.body || {};
    const result = await calculateBestEligibleOffer(subtotal, items);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to evaluate offers", details: err.message });
  }
});

/**
 * Helper to validate promo code and calculate discount against current subtotal and items (legacy support)
 */
export async function validateOfferCode(
  code: string,
  subtotal: number,
  items?: Array<{
    menuItemId?: number | null;
    menu_item_id?: number | null;
    name?: string | null;
    item_name?: string | null;
    quantity: number | string;
    price: number | string;
  }>
): Promise<{
  valid: boolean;
  error?: string;
  offer?: any;
  discountAmount?: number;
  finalTotal?: number;
  minOrderAmount?: number;
  currentSubtotal?: number;
}> {
  const cleanCode = String(code || "").trim().toUpperCase();

  if (!cleanCode) {
    return { valid: false, error: "Promo code is required" };
  }

  const numSubtotal = Number(subtotal);
  if (isNaN(numSubtotal) || numSubtotal <= 0) {
    return { valid: false, error: "Order must have items before applying a code" };
  }

  const offerRes = await query(
    `SELECT * FROM offers WHERE UPPER(code) = $1`,
    [cleanCode]
  );

  if (offerRes.rows.length === 0) {
    return { valid: false, error: `Promo code '${cleanCode}' is not valid` };
  }

  const offer = offerRes.rows[0];

  // 1. Check if active
  if (!offer.is_active) {
    return { valid: false, error: `Offer '${offer.title}' is currently inactive` };
  }

  // 2. Check active date window
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  if (offer.start_date && todayStr < String(offer.start_date).split("T")[0]) {
    return { valid: false, error: `This offer is not yet active (starts on ${offer.start_date})` };
  }

  if (offer.end_date && todayStr > String(offer.end_date).split("T")[0]) {
    return { valid: false, error: `This offer has expired (ended on ${offer.end_date})` };
  }

  // 3. Check active time window (if specified)
  if (offer.start_time || offer.end_time) {
    const currentHours = String(now.getHours()).padStart(2, "0");
    const currentMins = String(now.getMinutes()).padStart(2, "0");
    const currentTime = `${currentHours}:${currentMins}:00`;

    if (offer.start_time && currentTime < offer.start_time) {
      return {
        valid: false,
        error: `This offer is only valid after ${offer.start_time.slice(0, 5)}`,
      };
    }

    if (offer.end_time && currentTime > offer.end_time) {
      return {
        valid: false,
        error: `This offer was valid until ${offer.end_time.slice(0, 5)}`,
      };
    }
  }

  // 4. Check minimum order requirement
  const minOrder = Number(offer.min_order_amount || 0);
  if (numSubtotal < minOrder) {
    const remaining = Math.round(minOrder - numSubtotal);
    return {
      valid: false,
      error: `Add ₹${remaining} more to apply code '${offer.code}' (min order: ₹${minOrder})`,
      minOrderAmount: minOrder,
      currentSubtotal: numSubtotal,
    };
  }

  // 5. Calculate discount amount and validate required combo items
  let discountAmount = 0;
  if (offer.offer_type === "combo") {
    const comboItems: Array<{ menuItemId?: number; name: string; quantity: number }> =
      Array.isArray(offer.combo_items)
        ? offer.combo_items
        : typeof offer.combo_items === "string"
        ? JSON.parse(offer.combo_items)
        : [];

    if (comboItems.length > 0) {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return {
          valid: false,
          error: `Add the required combo items to your order before applying code '${offer.code}'`,
        };
      }

      let regularComboItemsCost = 0;

      for (const reqItem of comboItems) {
        const reqQty = Number(reqItem.quantity) || 1;
        const reqMenuItemId = reqItem.menuItemId ? Number(reqItem.menuItemId) : null;
        const reqName = (reqItem.name || "").trim().toLowerCase();

        // Validate menu item is active / available in the restaurant menu
        let menuItemRes;
        if (reqMenuItemId) {
          menuItemRes = await query(`SELECT id, name, price, available FROM menu_items WHERE id = $1`, [reqMenuItemId]);
        } else {
          menuItemRes = await query(`SELECT id, name, price, available FROM menu_items WHERE LOWER(name) = $1 LIMIT 1`, [reqName]);
        }

        if (menuItemRes.rows.length > 0 && menuItemRes.rows[0].available === false) {
          return {
            valid: false,
            error: `Item '${reqItem.name}' in combo '${offer.title}' is currently unavailable.`,
          };
        }

        // Match items in order payload
        const matchingOrderItems = items.filter((orderItem) => {
          const id =
            orderItem.menuItemId !== undefined && orderItem.menuItemId !== null
              ? Number(orderItem.menuItemId)
              : orderItem.menu_item_id !== undefined && orderItem.menu_item_id !== null
              ? Number(orderItem.menu_item_id)
              : null;
          if (reqMenuItemId && id) {
            return id === reqMenuItemId;
          }
          const name = (orderItem.name ?? orderItem.item_name ?? "").trim().toLowerCase();
          return name === reqName;
        });

        const matchingQty = matchingOrderItems.reduce(
          (sum, it) => sum + (Number(it.quantity) || 0),
          0
        );

        if (matchingQty < reqQty) {
          return {
            valid: false,
            error: `Combo '${offer.title}' requires at least ${reqQty}x ${reqItem.name} in your order (found ${matchingQty}).`,
          };
        }

        // Calculate regular price for those exact required items
        const itemUnitPrice = matchingOrderItems[0]
          ? Number(matchingOrderItems[0].price)
          : menuItemRes.rows[0]
          ? Number(menuItemRes.rows[0].price)
          : 0;

        regularComboItemsCost += reqQty * itemUnitPrice;
      }

      // Calculate combo price / discount from those exact items
      const comboPrice = offer.combo_price !== null && offer.combo_price !== undefined
        ? Number(offer.combo_price)
        : null;

      if (comboPrice !== null && comboPrice >= 0) {
        discountAmount = Math.max(0, Math.round((regularComboItemsCost - comboPrice) * 100) / 100);
      } else if (offer.discount_type === "percentage") {
        discountAmount = Math.round((regularComboItemsCost * Number(offer.discount_value)) / 100 * 100) / 100;
      } else {
        discountAmount = Math.min(regularComboItemsCost, Number(offer.discount_value));
      }
    } else {
      // Fallback for combo without explicit required item definitions
      if (offer.combo_price !== null && offer.combo_price !== undefined) {
        discountAmount = Math.max(0, numSubtotal - Number(offer.combo_price));
      } else if (offer.discount_type === "percentage") {
        discountAmount = Math.round((numSubtotal * Number(offer.discount_value)) / 100 * 100) / 100;
      } else {
        discountAmount = Math.min(numSubtotal, Number(offer.discount_value));
      }
    }
  } else if (offer.discount_type === "percentage") {
    discountAmount = Math.round((numSubtotal * Number(offer.discount_value)) / 100 * 100) / 100;
  } else {
    // Flat amount
    discountAmount = Math.min(numSubtotal, Number(offer.discount_value));
  }

  const finalTotal = Math.max(0, Math.round((numSubtotal - discountAmount) * 100) / 100);

  return {
    valid: true,
    offer: {
      id: offer.id,
      title: offer.title,
      code: offer.code,
      badge: offer.badge,
      offerType: offer.offer_type,
      discountType: offer.discount_type,
      discountValue: Number(offer.discount_value),
      minOrderAmount: minOrder,
      comboPrice: offer.combo_price ? Number(offer.combo_price) : null,
      rawOffer: offer,
    },
    discountAmount,
    finalTotal,
  };
}

/**
 * POST /api/offers/validate
 * Validates promo code and calculates discount against current cart items & subtotal.
 */
router.post("/offers/validate", async (req: Request, res: Response) => {
  try {
    const { code, subtotal = 0, items = [] } = req.body || {};
    const result = await validateOfferCode(code, subtotal, items);
    if (!result.valid) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ valid: false, error: "Validation failed", details: err.message });
  }
});

/**
 * POST /api/offers
 * Admin only: create a new offer or combo.
 */
router.post("/offers", async (req: Request, res: Response) => {
  try {
    if (!isAdminRequest(req)) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }

    const {
      title,
      description,
      code,
      badge,
      offerType = "discount",
      discountType = "percentage",
      discountValue = 0,
      minOrderAmount = 0,
      comboPrice,
      comboItems = [],
      imageUrl,
      startDate,
      endDate,
      startTime,
      endTime,
      isActive = true,
      sortOrder = 0,
    } = req.body || {};

    if (!title || !description) {
      res.status(400).json({ error: "Title and description are required" });
      return;
    }

    const cleanCode = code ? String(code).trim().toUpperCase() : null;

    // Check if code is already taken
    if (cleanCode) {
      const existing = await query("SELECT id FROM offers WHERE UPPER(code) = $1", [cleanCode]);
      if (existing.rows.length > 0) {
        res.status(409).json({ error: `Promo code '${cleanCode}' is already in use` });
        return;
      }
    }

    const insertRes = await query(
      `INSERT INTO offers (
        cafe_id, title, description, code, badge,
        offer_type, discount_type, discount_value, min_order_amount,
        combo_price, combo_items, image_url,
        start_date, end_date, start_time, end_time,
        is_active, sort_order, created_at, updated_at
      ) VALUES (
        1, $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, NOW(), NOW()
      ) RETURNING *`,
      [
        title.trim(),
        description.trim(),
        cleanCode,
        badge ? badge.trim() : null,
        offerType,
        discountType,
        Number(discountValue) || 0,
        Number(minOrderAmount) || 0,
        comboPrice !== undefined && comboPrice !== null ? Number(comboPrice) : null,
        JSON.stringify(comboItems || []),
        imageUrl ? imageUrl.trim() : null,
        startDate || null,
        endDate || null,
        startTime || null,
        endTime || null,
        Boolean(isActive),
        Number(sortOrder) || 0,
      ]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create offer", details: err.message });
  }
});

/**
 * PUT /api/offers/:id
 * Admin only: update an existing offer or combo.
 */
router.put("/offers/:id", async (req: Request, res: Response) => {
  try {
    if (!isAdminRequest(req)) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }

    const id = parseInt(String(req.params.id), 10);
    const {
      title,
      description,
      code,
      badge,
      offerType = "discount",
      discountType = "percentage",
      discountValue = 0,
      minOrderAmount = 0,
      comboPrice,
      comboItems = [],
      imageUrl,
      startDate,
      endDate,
      startTime,
      endTime,
      isActive = true,
      sortOrder = 0,
    } = req.body || {};

    if (!title || !description) {
      res.status(400).json({ error: "Title and description are required" });
      return;
    }

    const cleanCode = code ? String(code).trim().toUpperCase() : null;

    if (cleanCode) {
      const existing = await query("SELECT id FROM offers WHERE UPPER(code) = $1 AND id != $2", [cleanCode, id]);
      if (existing.rows.length > 0) {
        res.status(409).json({ error: `Promo code '${cleanCode}' is already in use by another offer` });
        return;
      }
    }

    const updateRes = await query(
      `UPDATE offers SET
        title = $1,
        description = $2,
        code = $3,
        badge = $4,
        offer_type = $5,
        discount_type = $6,
        discount_value = $7,
        min_order_amount = $8,
        combo_price = $9,
        combo_items = $10,
        image_url = $11,
        start_date = $12,
        end_date = $13,
        start_time = $14,
        end_time = $15,
        is_active = $16,
        sort_order = $17,
        updated_at = NOW()
      WHERE id = $18
      RETURNING *`,
      [
        title.trim(),
        description.trim(),
        cleanCode,
        badge ? badge.trim() : null,
        offerType,
        discountType,
        Number(discountValue) || 0,
        Number(minOrderAmount) || 0,
        comboPrice !== undefined && comboPrice !== null ? Number(comboPrice) : null,
        JSON.stringify(comboItems || []),
        imageUrl !== undefined ? (imageUrl ? imageUrl.trim() : null) : null,
        startDate || null,
        endDate || null,
        startTime || null,
        endTime || null,
        Boolean(isActive),
        Number(sortOrder) || 0,
        id,
      ]
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ error: "Offer not found" });
      return;
    }

    res.json(updateRes.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update offer", details: err.message });
  }
});

/**
 * PATCH /api/offers/:id/toggle
 * Admin only: toggle active state of an offer.
 */
router.patch("/offers/:id/toggle", async (req: Request, res: Response) => {
  try {
    if (!isAdminRequest(req)) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }

    const id = parseInt(String(req.params.id), 10);
    const updateRes = await query(
      `UPDATE offers SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ error: "Offer not found" });
      return;
    }

    res.json(updateRes.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to toggle offer", details: err.message });
  }
});

/**
 * DELETE /api/offers/:id
 * Admin only: delete an offer.
 * (Orders with this offer_id will have offer_id set to null, preserving order and discount history).
 */
router.delete("/offers/:id", async (req: Request, res: Response) => {
  try {
    if (!isAdminRequest(req)) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }

    const id = parseInt(String(req.params.id), 10);
    const deleteRes = await query("DELETE FROM offers WHERE id = $1 RETURNING id", [id]);

    if (deleteRes.rows.length === 0) {
      res.status(404).json({ error: "Offer not found" });
      return;
    }

    res.json({ success: true, message: `Offer #${id} deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete offer", details: err.message });
  }
});

export default router;
