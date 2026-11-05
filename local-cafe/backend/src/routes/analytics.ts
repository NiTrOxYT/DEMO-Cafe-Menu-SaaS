import { Router, Request, Response } from "express";
import { query } from "../db/index.js";

const router = Router();

// GET /api/analytics
router.get("/analytics", async (req: Request, res: Response) => {
  try {
    const { range = "all" } = req.query;
    const now = new Date();
    let startDate: Date | null = null;

    if (range === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (range === "yesterday") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    } else if (range === "7d") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    } else if (range === "30d") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    } else if (range === "thisMonth") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const conditions: string[] = [];
    const values: any[] = [];
    if (startDate) {
      conditions.push("created_at >= $1");
      values.push(startDate.toISOString());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // 1. Overall stats
    const statsSql = `
      SELECT
        COALESCE(SUM(total), 0) AS "totalRevenue",
        COALESCE(COUNT(*), 0) AS "totalOrders",
        COALESCE(AVG(total), 0) AS "averageOrderValue",
        COALESCE(COUNT(*) FILTER (WHERE status = 'completed'), 0) AS "completedOrders",
        COALESCE(COUNT(*) FILTER (WHERE status = 'cancelled'), 0) AS "cancelledOrders"
      FROM orders
      ${whereClause}
    `;
    const statsRes = await query(statsSql, values);
    const stats = statsRes.rows[0];

    // 2. Orders by Status
    const statusSql = `
      SELECT status, count(*) AS count
      FROM orders
      ${whereClause}
      GROUP BY status
    `;
    const statusRes = await query(statusSql, values);

    // 3. Top Selling Items
    const topItemsSql = `
      SELECT 
        oi.item_name AS name,
        SUM(oi.quantity) AS "quantitySold",
        SUM(oi.quantity * oi.price) AS "totalSales"
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      ${whereClause ? whereClause.replace("created_at", "o.created_at") : ""}
      GROUP BY oi.item_name
      ORDER BY "quantitySold" DESC
      LIMIT 10
    `;
    const topItemsRes = await query(topItemsSql, values);

    // 4. Hourly distribution
    const hourlySql = `
      SELECT 
        EXTRACT(HOUR FROM created_at) AS hour,
        COUNT(*) AS count,
        SUM(total) AS revenue
      FROM orders
      ${whereClause}
      GROUP BY hour
      ORDER BY hour ASC
    `;
    const hourlyRes = await query(hourlySql, values);

    res.json({
      summary: {
        totalRevenue: Number(stats.totalRevenue),
        totalOrders: Number(stats.totalOrders),
        averageOrderValue: Number(stats.averageOrderValue),
        completedOrders: Number(stats.completedOrders),
        cancelledOrders: Number(stats.cancelledOrders),
      },
      ordersByStatus: statusRes.rows.map((r) => ({ status: r.status, count: Number(r.count) })),
      topItems: topItemsRes.rows.map((r) => ({
        name: r.name,
        quantitySold: Number(r.quantitySold),
        totalSales: Number(r.totalSales),
      })),
      hourlyDistribution: hourlyRes.rows.map((r) => ({
        hour: Number(r.hour),
        orders: Number(r.count),
        revenue: Number(r.revenue),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load analytics", details: err.message });
  }
});

export default router;

