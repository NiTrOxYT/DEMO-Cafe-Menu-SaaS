export type RangeKey = "today" | "yesterday" | "7d" | "30d" | "thisMonth" | "prevMonth" | "all";

export interface OrderItem {
  id?: number;
  item_name?: string | null;
  name?: string | null;
  price?: number | string | null;
  quantity?: number | string | null;
  menu_items?: { name?: string | null } | null;
}

export interface Order {
  id: number;
  status?: string | null;
  total?: number | string | null;
  total_amount?: number | string | null;
  totalAmount?: number | string | null;
  table_id?: number | string | null;
  tableNumber?: string | null;
  customer_name?: string | null;
  customerName?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  is_paid?: boolean | null;
  is_active?: boolean | null;
  order_items?: OrderItem[] | null;
  cafe_id?: number | string | null;
}

export interface Category {
  id: number;
  name: string;
}

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  category_id: number;
}

export interface CategoryStat {
  name: string;
  revenue: number;
  ordersCount: number;
  percent: number;
}

export interface CustomerStats {
  totalCustomers: number;
  returningCustomers: number;
  newCustomers: number;
  repeatPurchaseRate: number;
}

export interface RevenueStats {
  grossRevenue: number;
  paidRevenue: number;
  pendingRevenue: number;
  cancelledValue: number;
  avgOrder: number;
}

export interface ChartDayTrend {
  label: string;
  revenue: number;
  orders: number;
}

export interface ChartHourlyDemand {
  hour: string;
  orders: number;
}

export interface TableStat {
  table: string;
  orders: number;
  revenue: number;
}

export interface ItemStat {
  name: string;
  quantity: number;
  revenue: number;
  orders: number;
}

export interface AnalyticsResult {
  scopedOrders: Order[];
  activeOrders: Order[];
  completedOrders: Order[];
  revenue: number; // compatible with existing tile (PaidRevenue)
  grossRevenue: number;
  paidRevenue: number;
  pendingRevenue: number;
  cancelledValue: number;
  todayRevenue: number;
  yesterdayRevenue: number;
  revenueDelta: number;
  avgOrder: number;
  avgItems: number;
  completionRate: number;
  topItem?: ItemStat;
  topTables: TableStat[];
  peakHour: string;
  dayTrend: ChartDayTrend[];
  statusMix: { name: string; key: string; value: number }[];
  hourlyDemand: ChartHourlyDemand[];
  revenueItems: ItemStat[];
  quantityItems: ItemStat[];
  highValueOrders: Order[];
  customers: CustomerStats;
  categories: CategoryStat[];
  fetchTimeMs?: number;
  calcTimeMs?: number;
  processedCount?: number;
}
