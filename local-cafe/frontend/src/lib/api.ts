// Local Cafe Express API Client
import { useQuery, useMutation } from "@tanstack/react-query";

export interface Category {
  id: number;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryId: number;
  categoryName?: string;
  available: boolean;
  sortOrder: number;
  isVeg: boolean;
  isBestseller: boolean;
  isSpicy: boolean;
  badge?: string;
  trackInventory?: boolean;
  inventoryQuantity?: number;
  inventoryUnit?: string;
  lowStockThreshold?: number;
  stockStatus?: "in_stock" | "low_stock" | "out_of_stock" | "untracked";
}

export interface RestaurantSettings {
  id: number;
  restaurantName: string;
  address: string | null;
  whatsappNumber: string | null;
  openingHours: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  tagline: string | null;
}

export interface OrderItem {
  id: number;
  order_id: number;
  menu_item_id?: number | null;
  item_name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: number;
  cafe_id?: number;
  table_id?: number;
  table_number?: string;
  customer_name?: string;
  customer_phone?: string;
  subtotal: number;
  discount?: number;
  promo_code?: string | null;
  offer_id?: number | null;
  tax: number;
  total: number;
  status: "pending" | "accepted" | "preparing" | "ready" | "served" | "completed" | "cancelled";
  is_active: boolean;
  is_paid: boolean;
  updated?: boolean;
  is_updated?: boolean;
  latest_added_items?: string[] | any;
  whatsapp_sent: boolean;
  notes?: string;
  created_at: string;
  order_items?: OrderItem[];
  orderAccessToken?: string;
  session_id?: number | null;
  guest_member_id?: number | null;
  guest_name?: string;
  is_mine?: boolean;
}

export interface TableSession {
  id: number;
  tableNumber: string;
  partySize: number;
  status: "active" | "finished" | "closed";
  createdAt: string;
}

export interface TableSessionStatusResponse {
  active: boolean;
  session?: TableSession;
  membersCount?: number;
  isFull?: boolean;
  isMember?: boolean;
  member?: {
    id: number;
    isFirstGuest: boolean;
    guestName?: string;
  } | null;
}

export interface ActiveTableSessionSummary {
  id: number;
  tableNumber: string;
  partySize: number;
  status: string;
  createdAt: string;
  membersCount: number;
  ordersCount: number;
  totalAmount: number;
  unservedOrdersCount?: number;
  isPaid?: boolean;
}

export interface RewardsUser {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  stars: number;
  total_visits: number;
  reward_available: boolean;
  rewards_claimed: number;
  last_star_date?: string | null;
  last_visit_date?: string | null;
}

export interface ComboItemEntry {
  menuItemId?: number;
  name: string;
  quantity: number;
}

export interface Offer {
  id: number;
  cafeId?: number;
  title: string;
  description: string | null;
  code: string | null;
  badge: string | null;
  offerType: "discount" | "combo";
  discountType: "percentage" | "flat";
  discountValue: number;
  minOrderAmount: number;
  comboPrice: number | null;
  comboItems: ComboItemEntry[];
  imageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  daysOfWeek: number[] | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface ValidateOfferResponse {
  valid: boolean;
  error?: string;
  offer?: {
    id: number;
    title: string;
    code: string;
    badge?: string;
    offerType: "discount" | "combo";
    discountType: "percentage" | "flat";
    discountValue: number;
    minOrderAmount: number;
    comboPrice?: number | null;
  };
  discountAmount?: number;
  finalTotal?: number;
  minOrderAmount?: number;
  currentSubtotal?: number;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorBody.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}

// ==========================================
// AUTH & SETUP
// ==========================================

export async function getAuthStatus(): Promise<{ initialized: boolean; adminCount: number }> {
  return request("/api/auth/status");
}

export async function firstRunSetup(data: { email: string; password: string; restaurantName?: string }): Promise<any> {
  return request("/api/auth/first-run-setup", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function adminLogin(email: string, password: string): Promise<any> {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function adminLogout(): Promise<any> {
  return request("/api/auth/logout", { method: "POST" });
}

export async function getAdminMe(): Promise<{ user: any }> {
  return request("/api/auth/me");
}

// ==========================================
// CATEGORIES & MENU
// ==========================================

export async function getCategories(): Promise<Category[]> {
  return request("/api/categories");
}

export async function createCategory(name: string, sort_order = 0): Promise<Category> {
  return request("/api/categories", {
    method: "POST",
    body: JSON.stringify({ name, sort_order }),
  });
}

export async function updateCategory(id: number, data: Partial<Category>): Promise<Category> {
  return request(`/api/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: number): Promise<any> {
  return request(`/api/categories/${id}`, { method: "DELETE" });
}

export async function getMenu(categoryId?: number, available?: boolean): Promise<MenuItem[]> {
  const params = new URLSearchParams();
  if (categoryId !== undefined && categoryId !== 0) params.set("categoryId", String(categoryId));
  if (available !== undefined) params.set("available", String(available));
  const queryStr = params.toString() ? `?${params.toString()}` : "";
  return request(`/api/menu${queryStr}`);
}

export async function getMenuSummary(): Promise<{ totalItems: number; totalCategories: number; availableItems: number }> {
  return request("/api/menu/summary");
}

export async function createMenuItem(data: any): Promise<MenuItem> {
  return request("/api/menu", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMenuItem(id: number, data: any): Promise<MenuItem> {
  return request(`/api/menu/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteMenuItem(id: number): Promise<any> {
  return request(`/api/menu/${id}`, { method: "DELETE" });
}

// ==========================================
// SETTINGS
// ==========================================

export async function getSettings(): Promise<RestaurantSettings> {
  return request("/api/settings");
}

export async function updateSettings(data: Partial<RestaurantSettings>): Promise<RestaurantSettings> {
  return request("/api/settings", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ==========================================
// ORDERS
// ==========================================

export async function getAdminOrders(): Promise<Order[]> {
  return request("/api/orders");
}

export async function getOrder(id: number, token?: string, guestToken?: string): Promise<Order> {
  const headers: Record<string, string> = {};
  if (token) headers["x-order-token"] = token;
  if (guestToken) headers["x-guest-token"] = guestToken;
  return request(`/api/orders/${id}`, { headers });
}

export async function createOrder(
  data: {
    tableNumber: string | number;
    tableId?: number;
    items: Array<{ menuItemId?: number; name: string; quantity: number; price: number }>;
    notes?: string;
    subtotal?: number;
    discount?: number;
    promoCode?: string;
    offerId?: number;
    tax?: number;
    total?: number;
  },
  guestToken?: string,
  idempotencyKey?: string
): Promise<Order> {
  const headers: Record<string, string> = {};
  if (guestToken) headers["x-guest-token"] = guestToken;
  if (idempotencyKey) headers["x-idempotency-key"] = idempotencyKey;
  return request("/api/orders", {
    method: "POST",
    headers,
    body: JSON.stringify({ ...data, idempotencyKey }),
  });
}

// ==========================================
// OFFERS & COMBOS
// ==========================================

export async function getOffers(all = false): Promise<Offer[]> {
  return request(`/api/offers${all ? "?all=true" : ""}`);
}

export async function validateOffer(code: string, subtotal: number, items?: any[]): Promise<ValidateOfferResponse> {
  return request("/api/offers/validate", {
    method: "POST",
    body: JSON.stringify({ code, subtotal, items }),
  });
}

export async function evaluateOffers(
  subtotal: number,
  items?: Array<{ menuItemId?: number; name?: string; quantity: number; price: number }>
): Promise<{
  bestOffer: Offer | null;
  discountAmount: number;
  finalTotal: number;
}> {
  return request("/api/offers/evaluate", {
    method: "POST",
    body: JSON.stringify({ subtotal, items: items || [] }),
  });
}

export async function createOffer(data: Partial<Offer>): Promise<Offer> {
  return request("/api/offers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateOffer(id: number, data: Partial<Offer>): Promise<Offer> {
  return request(`/api/offers/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function toggleOffer(id: number): Promise<Offer> {
  return request(`/api/offers/${id}/toggle`, {
    method: "PATCH",
  });
}

export async function deleteOffer(id: number): Promise<{ success: boolean }> {
  return request(`/api/offers/${id}`, {
    method: "DELETE",
  });
}

export async function appendOrder(
  orderId: number,
  items: Array<{ menuItemId?: number; name: string; quantity: number; price: number }>,
  token?: string,
  guestToken?: string
): Promise<Order> {
  const headers: Record<string, string> = {};
  if (token) headers["x-order-token"] = token;
  if (guestToken) headers["x-guest-token"] = guestToken;
  return request(`/api/orders/${orderId}/append`, {
    method: "POST",
    headers,
    body: JSON.stringify({ items }),
  });
}

export async function cancelOrder(orderId: number, guestToken?: string): Promise<any> {
  const headers: Record<string, string> = {};
  if (guestToken) headers["x-guest-token"] = guestToken;
  return request(`/api/orders/${orderId}/cancel`, {
    method: "POST",
    headers,
  });
}

export async function updateOrderStatus(id: number, status: string): Promise<Order> {
  return request(`/api/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function deleteOrder(id: number): Promise<any> {
  return request(`/api/orders/${id}`, { method: "DELETE" });
}

// ==========================================
// TABLE SESSIONS
// ==========================================

export async function getTableSession(tableNumber: string, guestToken?: string): Promise<TableSessionStatusResponse> {
  const headers: Record<string, string> = {};
  if (guestToken) headers["x-guest-token"] = guestToken;
  return request(`/api/tables/${encodeURIComponent(tableNumber)}/session`, { headers });
}

export async function createTableSession(
  tableNumber: string,
  partySize: number,
  guestName?: string
): Promise<{ session: TableSession; guestToken: string; member: any; membersCount: number }> {
  return request(`/api/tables/${encodeURIComponent(tableNumber)}/session`, {
    method: "POST",
    body: JSON.stringify({ partySize, guestName }),
  });
}

export async function joinTableSession(
  tableNumber: string,
  guestToken?: string,
  guestName?: string
): Promise<{ session: TableSession; guestToken: string; member: any; membersCount: number; alreadyMember?: boolean }> {
  const headers: Record<string, string> = {};
  if (guestToken) headers["x-guest-token"] = guestToken;
  return request(`/api/tables/${encodeURIComponent(tableNumber)}/session/join`, {
    method: "POST",
    headers,
    body: JSON.stringify({ guestName }),
  });
}

export async function getSessionOrders(sessionId: number, guestToken?: string): Promise<Order[]> {
  const headers: Record<string, string> = {};
  if (guestToken) headers["x-guest-token"] = guestToken;
  return request(`/api/sessions/${sessionId}/orders`, { headers });
}

export async function getActiveSessions(): Promise<ActiveTableSessionSummary[]> {
  return request("/api/sessions/active");
}

export async function payTableSession(sessionId: number): Promise<any> {
  return request(`/api/sessions/${sessionId}/pay`, { method: "POST" });
}

export async function closeTableSession(sessionId: number): Promise<any> {
  return request(`/api/sessions/${sessionId}/close`, { method: "POST" });
}

export async function closeTableByNumber(tableNumber: string): Promise<any> {
  return request(`/api/tables/${encodeURIComponent(tableNumber)}/close-session`, { method: "POST" });
}

export async function finishTableSession(sessionId: number): Promise<any> {
  return request(`/api/sessions/${sessionId}/finish`, { method: "POST" });
}

export async function finishTableByNumber(tableNumber: string): Promise<any> {
  return request(`/api/tables/${encodeURIComponent(tableNumber)}/finish-session`, { method: "POST" });
}

// ==========================================
// REWARDS
// ==========================================

export async function enrollRewards(data: { name: string; email?: string; phone?: string; pin?: string }): Promise<RewardsUser> {
  return request("/api/rewards/enroll", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function loginRewards(data: { identifier: string; pin?: string }): Promise<RewardsUser> {
  return request("/api/rewards/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getRewardsMember(identifier: string): Promise<RewardsUser> {
  return request(`/api/rewards/me?identifier=${encodeURIComponent(identifier)}`);
}

export async function claimReward(userId: number): Promise<{ success: boolean; user: RewardsUser }> {
  return request("/api/rewards/claim", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

// ==========================================
// ANALYTICS
// ==========================================

export async function getAnalytics(range = "all"): Promise<any> {
  return request(`/api/analytics?range=${encodeURIComponent(range)}`);
}

// ==========================================
// STORAGE / FILE UPLOAD
// ==========================================

export async function uploadImage(file: File): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/storage/upload", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: "Image upload failed" }));
    throw new Error(errorBody.error || "Image upload failed");
  }

  return res.json();
}

// ==========================================
// TANSTACK REACT QUERY HOOKS & QUERY KEYS
// ==========================================

export const getGetMeQueryKey = () => ["/api/auth/me"] as const;
export function useGetMe(options?: { query?: any }) {
  return useQuery({
    queryKey: getGetMeQueryKey(),
    queryFn: () => getAdminMe(),
    ...options?.query,
  });
}

export const getListCategoriesQueryKey = () => ["/api/categories"] as const;
export function useListCategories(options?: { query?: any }) {
  return useQuery({
    queryKey: getListCategoriesQueryKey(),
    queryFn: () => getCategories(),
    ...options?.query,
  });
}

export const getListMenuItemsQueryKey = (params?: { categoryId?: number; available?: boolean }) =>
  ["/api/menu", ...(params ? [params] : [])] as const;

export function useListMenuItems(
  params?: { categoryId?: number; available?: boolean },
  options?: { query?: any }
) {
  return useQuery({
    queryKey: getListMenuItemsQueryKey(params),
    queryFn: () => getMenu(params?.categoryId, params?.available),
    ...options?.query,
  });
}

export const getGetMenuSummaryQueryKey = () => ["/api/menu/summary"] as const;
export function useGetMenuSummary(options?: { query?: any }) {
  return useQuery({
    queryKey: getGetMenuSummaryQueryKey(),
    queryFn: () => getMenuSummary(),
    ...options?.query,
  });
}

export const getGetSettingsQueryKey = () => ["/api/settings"] as const;
export function useGetSettings(options?: { query?: any }) {
  return useQuery({
    queryKey: getGetSettingsQueryKey(),
    queryFn: () => getSettings(),
    ...options?.query,
  });
}

export const getListOrdersQueryKey = () => ["/api/orders"] as const;
export function useListOrders(options?: { query?: any }) {
  return useQuery({
    queryKey: getListOrdersQueryKey(),
    queryFn: () => getAdminOrders(),
    ...options?.query,
  });
}

export function useLogout(options?: { mutation?: any }) {
  return useMutation({
    mutationFn: () => adminLogout(),
    ...options?.mutation,
  });
}

export function useCreateMenuItem(options?: { mutation?: any }) {
  return useMutation({
    mutationFn: ({ data }: { data: any }) => createMenuItem(data),
    ...options?.mutation,
  });
}

export function useUpdateMenuItem(options?: { mutation?: any }) {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateMenuItem(id, data),
    ...options?.mutation,
  });
}

export function useDeleteMenuItem(options?: { mutation?: any }) {
  return useMutation({
    mutationFn: ({ id }: { id: number }) => deleteMenuItem(id),
    ...options?.mutation,
  });
}

export function useCreateCategory(options?: { mutation?: any }) {
  return useMutation({
    mutationFn: ({ data }: { data: { name: string; sortOrder?: number } }) =>
      createCategory(data.name, data.sortOrder),
    ...options?.mutation,
  });
}

export function useDeleteCategory(options?: { mutation?: any }) {
  return useMutation({
    mutationFn: ({ id }: { id: number }) => deleteCategory(id),
    ...options?.mutation,
  });
}

export function useCreateOrder(options?: { mutation?: any }) {
  return useMutation({
    mutationFn: (data: any) => createOrder(data),
    ...options?.mutation,
  });
}

// ==========================================
// INVENTORY API & REACT QUERY HOOKS
// ==========================================

export interface InventorySummary {
  totalTrackedItems: number;
  totalStockOnHand: number;
  stockOnHandByUnit?: Array<{ unit: string; quantity: number }>;
  totalStockIn: number;
  stockInByUnit?: Array<{ unit: string; quantity: number }>;
  totalStockOut: number;
  stockOutByUnit?: Array<{ unit: string; quantity: number }>;
  outOfStockCount: number;
  lowStockCount: number;
  alerts: Array<{
    id: number;
    name: string;
    categoryId: number;
    categoryName?: string;
    inventoryQuantity: number;
    inventoryUnit: string;
    lowStockThreshold: number;
    alertType: "out_of_stock" | "low_stock";
  }>;
}

export interface InventoryMovement {
  id: number;
  menuItemId: number;
  menuItemName: string;
  categoryName?: string;
  movementType: "stock_in" | "stock_out" | "order_deduction" | "order_reversal" | "opening_stock" | "adjustment";
  quantity: number;
  balanceAfter: number;
  unit: string;
  reason?: string | null;
  orderId?: number | null;
  performedBy: string;
  createdAt: string;
}

export async function getInventorySummary(params?: {
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  menuItemId?: number;
}): Promise<InventorySummary> {
  const queryParams = new URLSearchParams();
  if (params?.startDate) queryParams.set("startDate", params.startDate);
  if (params?.endDate) queryParams.set("endDate", params.endDate);
  if (params?.categoryId) queryParams.set("categoryId", String(params.categoryId));
  if (params?.menuItemId) queryParams.set("menuItemId", String(params.menuItemId));

  const qs = queryParams.toString();
  return request<InventorySummary>(`/api/inventory/summary${qs ? `?${qs}` : ""}`);
}

export async function getInventoryItems(params?: {
  categoryId?: number;
  search?: string;
  status?: string;
}): Promise<MenuItem[]> {
  const queryParams = new URLSearchParams();
  if (params?.categoryId) queryParams.set("categoryId", String(params.categoryId));
  if (params?.search) queryParams.set("search", params.search);
  if (params?.status) queryParams.set("status", params.status);

  const qs = queryParams.toString();
  return request<MenuItem[]>(`/api/inventory/items${qs ? `?${qs}` : ""}`);
}

export async function getInventoryMovements(params?: {
  menuItemId?: number;
  movementType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; movements: InventoryMovement[] }> {
  const queryParams = new URLSearchParams();
  if (params?.menuItemId) queryParams.set("menuItemId", String(params.menuItemId));
  if (params?.movementType) queryParams.set("movementType", params.movementType);
  if (params?.startDate) queryParams.set("startDate", params.startDate);
  if (params?.endDate) queryParams.set("endDate", params.endDate);
  if (params?.limit) queryParams.set("limit", String(params.limit));
  if (params?.offset) queryParams.set("offset", String(params.offset));

  const qs = queryParams.toString();
  return request<{ total: number; movements: InventoryMovement[] }>(`/api/inventory/movements${qs ? `?${qs}` : ""}`);
}

export async function adjustInventory(payload: {
  menuItemId: number;
  movementType: "stock_in" | "stock_out" | "opening_stock" | "adjustment";
  quantity: number;
  unit?: string;
  reason?: string;
  date?: string;
}): Promise<{ success: boolean; movement: InventoryMovement; item: Partial<MenuItem> }> {
  return request(`/api/inventory/adjust`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateInventorySettings(
  id: number,
  payload: {
    trackInventory: boolean;
    inventoryQuantity?: number;
    inventoryUnit?: string;
    lowStockThreshold?: number;
  }
): Promise<MenuItem> {
  return request(`/api/inventory/items/${id}/settings`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function useInventorySummary(params?: {
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  menuItemId?: number;
}) {
  return useQuery({
    queryKey: ["inventory", "summary", params],
    queryFn: () => getInventorySummary(params),
    refetchInterval: 15000,
  });
}

export function useInventoryItems(params?: {
  categoryId?: number;
  search?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ["inventory", "items", params],
    queryFn: () => getInventoryItems(params),
    refetchInterval: 15000,
  });
}

export function useInventoryMovements(params?: {
  menuItemId?: number;
  movementType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["inventory", "movements", params],
    queryFn: () => getInventoryMovements(params),
  });
}

// ==========================================
// RAW MATERIALS & SUPPLIES INVENTORY API
// ==========================================

export interface RawMaterial {
  id: number;
  name: string;
  category: string;
  sku?: string | null;
  baseUnit: string;
  currentStock: number;
  lowStockThreshold: number;
  supplier?: string | null;
  unitCost?: number | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  isArchived: boolean;
  totalValue?: number | null;
  status: "in_stock" | "low_stock" | "out_of_stock" | "expiring_soon" | "archived";
  recipeUsageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RawMaterialsSummary {
  totalItems: number;
  totalInventoryValue: number;
  outOfStockCount: number;
  lowStockCount: number;
  expiringSoonCount: number;
  stockByUnit: Array<{ unit: string; quantity: number }>;
  stockInByUnit: Array<{ unit: string; quantity: number }>;
  stockOutByUnit: Array<{ unit: string; quantity: number }>;
  alerts: Array<{
    id: number;
    name: string;
    category: string;
    currentStock: number;
    baseUnit: string;
    lowStockThreshold: number;
    expiryDate?: string | null;
    batchNumber?: string | null;
    supplier?: string | null;
    alertType: "out_of_stock" | "low_stock" | "expiring_soon" | "normal";
  }>;
}

export interface RawMaterialMovement {
  id: number;
  rawMaterialId: number;
  rawMaterialName: string;
  category: string;
  movementType: "stock_in" | "stock_out" | "adjustment" | "recipe_consumption" | "order_reversal" | "opening_stock";
  quantity: number;
  unit: string;
  baseQuantity: number;
  baseUnit: string;
  balanceBefore: number;
  balanceAfter: number;
  unitCost?: number | null;
  totalCost?: number | null;
  supplier?: string | null;
  invoiceRef?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  reason?: string | null;
  orderId?: number | null;
  performedBy: string;
  createdAt: string;
}

export interface RecipeIngredient {
  id?: number;
  rawMaterialId: number;
  rawMaterialName?: string;
  baseUnit?: string;
  currentStock?: number;
  isArchived?: boolean;
  quantity: number;
  unit: string;
  notes?: string | null;
}

export interface MenuItemRecipeItem {
  menuItemId: number;
  menuItemName: string;
  menuItemPrice: number;
  categoryName?: string;
  available: boolean;
  hasRecipe: boolean;
  ingredients: RecipeIngredient[];
}

export async function getRawMaterialsSummary(params?: {
  startDate?: string;
  endDate?: string;
  category?: string;
  supplier?: string;
}): Promise<RawMaterialsSummary> {
  const queryParams = new URLSearchParams();
  if (params?.startDate) queryParams.set("startDate", params.startDate);
  if (params?.endDate) queryParams.set("endDate", params.endDate);
  if (params?.category) queryParams.set("category", params.category);
  if (params?.supplier) queryParams.set("supplier", params.supplier);

  const qs = queryParams.toString();
  return request<RawMaterialsSummary>(`/api/raw-materials/summary${qs ? `?${qs}` : ""}`);
}

export async function getRawMaterials(params?: {
  search?: string;
  category?: string;
  supplier?: string;
  status?: string;
  includeArchived?: boolean;
}): Promise<RawMaterial[]> {
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.set("search", params.search);
  if (params?.category) queryParams.set("category", params.category);
  if (params?.supplier) queryParams.set("supplier", params.supplier);
  if (params?.status) queryParams.set("status", params.status);
  if (params?.includeArchived) queryParams.set("includeArchived", "true");

  const qs = queryParams.toString();
  return request<RawMaterial[]>(`/api/raw-materials${qs ? `?${qs}` : ""}`);
}

export async function createRawMaterial(payload: {
  name: string;
  category?: string;
  sku?: string;
  baseUnit?: string;
  currentStock?: number;
  lowStockThreshold?: number;
  supplier?: string;
  unitCost?: number;
  batchNumber?: string;
  expiryDate?: string;
}): Promise<RawMaterial> {
  return request<RawMaterial>("/api/raw-materials", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateRawMaterial(
  id: number,
  payload: Partial<{
    name: string;
    category: string;
    sku: string;
    baseUnit: string;
    lowStockThreshold: number;
    supplier: string;
    unitCost: number | null;
    batchNumber: string;
    expiryDate: string | null;
    isArchived: boolean;
  }>
): Promise<RawMaterial> {
  return request<RawMaterial>(`/api/raw-materials/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function archiveRawMaterial(id: number): Promise<{ success: boolean; item?: RawMaterial }> {
  return request<{ success: boolean; item?: RawMaterial }>(`/api/raw-materials/${id}`, {
    method: "DELETE",
  });
}

export async function restoreRawMaterial(id: number): Promise<{ success: boolean; item?: RawMaterial }> {
  return request<{ success: boolean; item?: RawMaterial }>(`/api/raw-materials/${id}/restore`, {
    method: "POST",
  });
}

export async function recordRawMaterialMovement(
  id: number,
  payload: {
    movementType: "stock_in" | "stock_out" | "adjustment";
    quantity: number;
    unit?: string;
    reason?: string;
    supplier?: string;
    invoiceRef?: string;
    unitCost?: number;
    batchNumber?: string;
    expiryDate?: string;
    date?: string;
  }
): Promise<{ success: boolean; movement: RawMaterialMovement; item: Partial<RawMaterial> }> {
  return request(`/api/raw-materials/${id}/movements`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getRawMaterialMovements(params?: {
  rawMaterialId?: number;
  movementType?: string;
  startDate?: string;
  endDate?: string;
  supplier?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; movements: RawMaterialMovement[] }> {
  const queryParams = new URLSearchParams();
  if (params?.rawMaterialId) queryParams.set("rawMaterialId", String(params.rawMaterialId));
  if (params?.movementType) queryParams.set("movementType", params.movementType);
  if (params?.startDate) queryParams.set("startDate", params.startDate);
  if (params?.endDate) queryParams.set("endDate", params.endDate);
  if (params?.supplier) queryParams.set("supplier", params.supplier);
  if (params?.search) queryParams.set("search", params.search);
  if (params?.limit) queryParams.set("limit", String(params.limit));
  if (params?.offset) queryParams.set("offset", String(params.offset));

  const qs = queryParams.toString();
  return request<{ total: number; movements: RawMaterialMovement[] }>(
    `/api/raw-materials/movements${qs ? `?${qs}` : ""}`
  );
}

export async function getRecipes(): Promise<MenuItemRecipeItem[]> {
  return request<MenuItemRecipeItem[]>("/api/raw-materials/recipes");
}

export async function getRecipeForMenuItem(menuItemId: number): Promise<RecipeIngredient[]> {
  return request<RecipeIngredient[]>(`/api/raw-materials/recipes/${menuItemId}`);
}

export async function saveRecipeForMenuItem(
  menuItemId: number,
  ingredients: Array<{ rawMaterialId: number; quantity: number; unit: string; notes?: string }>
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/raw-materials/recipes/${menuItemId}`, {
    method: "PUT",
    body: JSON.stringify({ ingredients }),
  });
}

export function useRawMaterials(params?: {
  search?: string;
  category?: string;
  supplier?: string;
  status?: string;
  includeArchived?: boolean;
}) {
  return useQuery({
    queryKey: ["raw-materials", "items", params],
    queryFn: () => getRawMaterials(params),
    refetchInterval: 15000,
  });
}

export function useRawMaterialsSummary(params?: {
  startDate?: string;
  endDate?: string;
  category?: string;
  supplier?: string;
}) {
  return useQuery({
    queryKey: ["raw-materials", "summary", params],
    queryFn: () => getRawMaterialsSummary(params),
    refetchInterval: 15000,
  });
}

export function useRawMaterialMovements(params?: {
  rawMaterialId?: number;
  movementType?: string;
  startDate?: string;
  endDate?: string;
  supplier?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["raw-materials", "movements", params],
    queryFn: () => getRawMaterialMovements(params),
  });
}

export function useRecipes() {
  return useQuery({
    queryKey: ["raw-materials", "recipes"],
    queryFn: () => getRecipes(),
  });
}
