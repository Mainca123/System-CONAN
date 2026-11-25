import { test, expect } from "@playwright/test";
const root = "http://localhost:8180";
async function login(page, user) {
  await page.goto(root);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.locator("#username").fill(user);
  await page.locator("#password").fill("ConanDemo123!");
  await page.locator("#kc-login").click();
  await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
  const request = page.waitForRequest((r) => r.url().endsWith("/api/orders"));
  await page.getByRole("button", { name: "Đơn hàng", exact: true }).click();
  return (await request).headers().authorization;
}
test("Mua hàng, phân quyền, chống lặp và bảo toàn tồn kho", async ({
  browser,
  page,
  request,
}) => {
  const reader = await login(page, "reader");
  await page.getByRole("button", { name: "Khám phá", exact: true }).click();
  await page.getByRole("button", { name: "Khám phá bộ truyện ↗" }).click();
  await page.getByRole("button", { name: "Thêm vào giỏ" }).click();
  await page.getByRole("button", { name: "Xem giỏ hàng" }).click();
  await page.getByLabel("Người nhận").fill("Bạn đọc demo");
  await page.getByLabel("Điện thoại").fill("0900000000");
  await page.getByLabel("Địa chỉ").fill("Địa chỉ kiểm thử");
  const submitted = page.waitForResponse(
    (r) => r.url().endsWith("/api/orders") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Đặt hàng", exact: true }).click();
  const newOrder = await (await submitted).json();
  await expect(
    page
      .locator("article")
      .filter({ hasText: newOrder.id })
      .getByRole("heading", { name: "Đã xác nhận" }),
  ).toBeVisible({ timeout: 45000 });
  const adminPage = await browser.newPage(),
    otherPage = await browser.newPage();
  const admin = await login(adminPage, "manager"),
    other = await login(otherPage, "reader2");
  const call = (path, method, token, data, extra = {}) =>
    request.fetch(root + "/api/" + path, {
      method,
      headers: { ...(token ? { Authorization: token } : {}), ...extra },
      data,
    });
  expect((await call("orders", "GET")).status()).toBe(401);
  expect((await call("orders/admin", "GET", reader)).status()).toBe(403);
  const book = await (
    await call("catalog", "POST", admin, {
      title: "Kiểm thử " + Date.now(),
      genre: "Kiểm thử",
      author: "Nhóm 10",
      description: "Bộ dữ liệu kiểm thử tạm thời.",
    })
  ).json();
  try {
    const detail = await (
      await call("catalog/" + book.id + "/variants", "POST", admin, {
        volume: 1,
        edition: "Demo",
        price: 10000,
        quantity: 1,
      })
    ).json();
    const sku = detail.variants[0].id;
    const payload = {
      items: [{ sku, qty: 1 }],
      recipient: "Test",
      phone: "0900000000",
      address: "Demo",
      payment: "SIM_FAIL",
    };
    const buy = (token, key, x) =>
      call("orders", "POST", token, x, { "Idempotency-Key": key });
    async function orderState(id, token, states) {
      await expect
        .poll(
          async () => {
            const r = await call("orders/" + id, "GET", token);
            return states.includes((await r.json()).status);
          },
          { timeout: 45000 },
        )
        .toBe(true);
    }
    const key = crypto.randomUUID();
    const first = await (await buy(reader, key, payload)).json();
    expect((await (await buy(reader, key, payload)).json()).id).toBe(first.id);
    expect(
      (await buy(reader, key, { ...payload, address: "Khác" })).status(),
    ).toBe(409);
    await orderState(first.id, reader, ["PAYMENT_FAILED"]);
    expect((await call("orders/" + first.id, "GET", other)).status()).toBe(404);
    const placed = await Promise.all(
      [reader, other].map(async (token) => ({
        token,
        id: (
          await (
            await buy(token, crypto.randomUUID(), {
              ...payload,
              payment: "COD",
            })
          ).json()
        ).id,
      })),
    );
    for (const p of placed)
      await orderState(p.id, p.token, ["CONFIRMED", "OUT_OF_STOCK"]);
    const results = await Promise.all(
      placed.map(
        async (p) =>
          (await (await call("orders/" + p.id, "GET", p.token)).json()).status,
      ),
    );
    expect([...results].sort()).toEqual(["CONFIRMED", "OUT_OF_STOCK"]);
    const stock = (await (await call("catalog/" + book.id, "GET")).json())
      .variants[0];
    expect(stock.available).toBe(0);
    expect(stock.held).toBe(0);
    const winner = placed[results.indexOf("CONFIRMED")];
    for (const status of ["SHIPPED", "DELIVERED"])
      expect(
        (
          await call("orders/admin/" + winner.id, "PATCH", admin, { status })
        ).ok(),
      ).toBeTruthy();
    const live = await (
      await call("assistant/ask", "POST", null, {
        question: "Giá tập 1 của " + book.title + "?",
      })
    ).json();
    expect(live.mode).toBe("live");
    expect(live.answer).toContain("10.000");
  } finally {
    await call("catalog/" + book.id, "DELETE", admin);
    await adminPage.close();
    await otherPage.close();
  }
});
test("Quản trị tài liệu AI, cập nhật và loại bỏ nguồn", async ({page,request}) => {
  const token=await login(page,"manager");
  const headers={Authorization:token};
  const idTag="KT"+Date.now();
  const title="Chính sách "+idTag;
  const doc={title,source:idTag,body:"Mã ưu đãi của chương trình là BONGMAI."};
  await page.getByRole("button",{name:"Quản trị",exact:true}).click();
  await page.getByRole("button",{name:"Tài liệu AI",exact:true}).click();
  await page.getByLabel("Tiêu đề").fill(title);
  await page.getByLabel("Nguồn",{exact:true}).fill(idTag);
  await page.getByLabel("Nội dung",{exact:true}).fill(doc.body);
  const created=page.waitForResponse(r=>r.url().endsWith("/assistant/documents") && r.request().method()==="POST");
  await page.getByRole("button",{name:"Lưu và lập chỉ mục"}).click();
  const {id}=await (await created).json();
  const url=root+"/api/assistant/documents/"+id;
  try {
    const read=()=>request.post(root+"/api/assistant/ask",{data:{question:title+" có mã gì?"},timeout:100000}).then(r=>r.json());
    expect((await read()).sources.join(" ")).toContain(idTag);
    const changed=await request.put(url,{headers,data:{...doc,source:idTag+"-v2",body:"Mã ưu đãi hiện hành là TRUCXANH."}});
    expect(changed.ok()).toBeTruthy();
    expect((await read()).sources.join(" ")).toContain(idTag+"-v2");
  } finally {
    expect((await request.delete(url,{headers})).ok()).toBeTruthy();
  }
  const all=await (await request.get(root+"/api/assistant/documents",{headers})).json();
  expect(all.some(d=>d.id===id)).toBe(false);
});
