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
  tax: number;
  total: number;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
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

export async function getOrder(id: number, token?: string): Promise<Order> {
  const headers: Record<string, string> = {};
  if (token) headers["x-order-token"] = token;
  return request(`/api/orders/${id}`, { headers });
}

export async function createOrder(data: {
  tableNumber: string | number;
  tableId?: number;
  items: Array<{ menuItemId?: number; name: string; quantity: number; price: number }>;
  notes?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
}): Promise<Order> {
  return request("/api/orders", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function appendOrder(
  orderId: number,
  items: Array<{ menuItemId?: number; name: string; quantity: number; price: number }>,
  token?: string
): Promise<Order> {
  const headers: Record<string, string> = {};
  if (token) headers["x-order-token"] = token;
  return request(`/api/orders/${orderId}/append`, {
    method: "POST",
    headers,
    body: JSON.stringify({ items }),
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
