import Keycloak from "keycloak-js";
export const auth = new Keycloak({
  url: window.CONAN_IDENTITY_URL || import.meta.env.VITE_IDENTITY_URL || "http://localhost:8181",
  realm: "conan",
  clientId: "conan-web",
});
export async function api(path, method = "GET", body, extra = {}) {
  const headers = { ...extra };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth.authenticated) {
    await auth.updateToken(30);
    headers.Authorization = "Bearer " + auth.token;
  }
  const response = await fetch("/api/" + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok)
    throw new Error(
      data?.message || "Không thể hoàn tất yêu cầu (" + response.status + ").",
    );
  return data;
}
export const money = (n) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    n,
  );
export const status = {
  PENDING: "Đang giữ hàng",
  CONFIRMING: "Đang xác nhận",
  RELEASING: "Đang hoàn giữ hàng",
  CONFIRMED: "Đã xác nhận",
  SHIPPED: "Đang giao",
  DELIVERED: "Đã giao",
  OUT_OF_STOCK: "Hết hàng",
  PAYMENT_FAILED: "Thanh toán thất bại",
  EXPIRED: "Đã hết hạn",
};
export function saved(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
