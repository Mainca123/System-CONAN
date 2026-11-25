import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, auth, money, saved, status } from "./api";
import Admin from "./Admin";
import "./style.css";

function Cover({ book, large = false }) {
  return (
    <div
      aria-hidden="true"
      className={"cover tone" + (book.id % 6) + (large ? " large" : "")}
    >
      <i />
      <span className="orb" />
      <span className="ridge" />
      <div className="ink">
        <small>{book.author}</small>
        <strong>{book.title}</strong>
      </div>
    </div>
  );
}
function App() {
  const [books, setBooks] = useState([]),
    [tab, setTab] = useState("shop"),
    [genre, setGenre] = useState("Tất cả"),
    [query, setQuery] = useState(""),
    [detail, setDetail] = useState(null),
    [sku, setSku] = useState(0);
  const [cart, setCart] = useState(() => saved("conan-cart", [])),
    [orders, setOrders] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [chat, setChat] = useState(false),
    [notice, setNotice] = useState(""),
    [ready, setReady] = useState(false);
  async function refresh() {
    setBooks(await api("catalog"));
    setReady(true);
  }
  function fail(e) {
    setError(e.message);
  }
  useEffect(() => {
    refresh().catch(fail);
  }, []);
  useEffect(() => {
    localStorage.setItem("conan-cart", JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (tab !== "orders" || !auth.authenticated) return;
    let active = true;
    async function load() {
      try {
        let rows = await api("orders");
        if (active) setOrders(rows);
      } catch (e) {
        if (active) fail(e);
      }
    }
    load();
    let t = setInterval(load, 2500);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [tab]);
  function go(t) {
    setTab(t);
    setDetail(null);
    setError("");
    window.scrollTo(0, 0);
  }
  async function open(id) {
    try {
      let b = await api("catalog/" + id);
      setDetail(b);
      setSku(b.variants.find((v) => v.available > 0)?.id ?? b.variants[0]?.id);
      setTab("detail");
      window.scrollTo(0, 0);
    } catch (e) {
      fail(e);
    }
  }
  function add() {
    const v = detail.variants.find((x) => x.id === sku);
    if (!v) return;
    const current = cart.find((x) => x.sku === sku);
    if ((current?.qty ?? 0) >= v.available) {
      fail(new Error("Đã đạt số lượng khả dụng"));
      return;
    }
    setCart(
      current
        ? cart.map((x) =>
            x.sku === sku
              ? { ...x, qty: x.qty + 1, available: v.available }
              : x,
          )
        : [
            ...cart,
            {
              sku,
              qty: 1,
              title: detail.title,
              volume: v.volume,
              edition: v.edition,
              price: v.price,
              available: v.available,
            },
          ],
    );
    setNotice("Đã thêm vào giỏ hàng");
  }
  async function checkout(e) {
    e.preventDefault();
    if (!auth.authenticated) {
      sessionStorage.setItem("conan-return", "cart");
      await auth.login();
      return;
    }
    const data = Object.fromEntries(new FormData(e.target));
    const payload = {
      ...data,
      items: cart.map(({ sku, qty }) => ({ sku, qty })),
    };
    const fingerprint = JSON.stringify([auth.subject, payload]);
    let retry = saved("conan-checkout", {});
    if (retry.fingerprint !== fingerprint) {
      retry = { fingerprint, key: crypto.randomUUID() };
      localStorage.setItem("conan-checkout", JSON.stringify(retry));
    }
    setBusy(true);
    try {
      await api("orders", "POST", payload, { "Idempotency-Key": retry.key });
      localStorage.removeItem("conan-checkout");
      setCart([]);
      go("orders");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (auth.authenticated && sessionStorage.getItem("conan-return")) {
      setTab(sessionStorage.getItem("conan-return"));
      sessionStorage.removeItem("conan-return");
    }
  }, []);
  const filtered = books.filter(
    (b) =>
      (genre === "Tất cả" || b.genre === genre) &&
      (b.title + " " + b.author)
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi")),
  );
  const total = cart.reduce((s, x) => s + x.qty * x.price, 0);
  return (
    <>
      <header>
        <div className="bar">
          <button className="brand" onClick={() => go("shop")}>
            <b>◧</b> CONAN<span>NHÀ SÁCH</span>
          </button>
          <nav>
            <button onClick={() => go("shop")}>Khám phá</button>
            {auth.authenticated && (
              <button onClick={() => go("orders")}>Đơn hàng</button>
            )}
            {auth.hasRealmRole("admin") && (
              <button onClick={() => go("admin")}>Quản trị</button>
            )}
          </nav>
          <div className="account">
            <button
              onClick={() =>
                auth.authenticated
                  ? auth.logout({ redirectUri: location.origin })
                  : auth.login()
              }
            >
              {auth.authenticated ? "Đăng xuất" : "Đăng nhập"}
            </button>
            <button className="cart" onClick={() => go("cart")}>
              Giỏ hàng <b>{cart.reduce((s, x) => s + x.qty, 0)}</b>
            </button>
          </div>
        </div>
      </header>
      <main>
        {error && (
          <div role="alert" className="alert">
            {error}{" "}
            <button
              onClick={() => {
                setError("");
                if (!ready) refresh().catch(fail);
              }}
            >
              OK
            </button>
          </div>
        )}
        {tab === "shop" && (
          <>
            {books[0] && (
              <section className="hero">
                <div>
                  <small>TỦ SÁCH {books[0].genre}</small>
                  <h1>{books[0].title}</h1>
                  <p>{books[0].description}</p>
                  <button className="light" onClick={() => open(books[0].id)}>
                    Khám phá bộ truyện ↗
                  </button>
                </div>
                <div className="heroArt">
                  <Cover book={books[0]} large />
                </div>
              </section>
            )}
            <div className="heading">
              <h2>Kệ truyện</h2>
              <input
                type="search"
                placeholder="Tìm truyện, tác giả…"
                aria-label="Tìm truyện"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="filters">
              {["Tất cả", ...new Set(books.map((b) => b.genre))].map((g) => (
                <button
                  className={genre === g ? "active" : ""}
                  key={g}
                  onClick={() => setGenre(g)}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="grid">
              {filtered.map((b) => (
                <button className="tile" key={b.id} onClick={() => open(b.id)}>
                  <Cover book={b} />
                  <small>
                    {b.genre} · {b.author}
                  </small>
                  <h3>{b.title}</h3>
                  <strong>{b.price ? money(b.price) : "Chưa mở bán"}</strong>
                </button>
              ))}
            </div>
            {!filtered.length && (
              <p>
                {ready ? "Không tìm thấy bộ truyện." : "Đang tải kệ truyện…"}
              </p>
            )}
          </>
        )}
        {tab === "detail" && detail && (
          <>
            <button className="back" onClick={() => go("shop")}>
              ← Kệ truyện
            </button>
            <div className="detail">
              <Cover book={detail} large />
              <article>
                <small>
                  {detail.genre} · {detail.author}
                </small>
                <h1>{detail.title}</h1>
                <p>{detail.description}</p>
                <label>
                  Chọn tập và phiên bản
                  <select
                    value={sku ?? ""}
                    onChange={(e) => setSku(+e.target.value)}
                  >
                    {detail.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        Tập {v.volume} · {v.edition}
                      </option>
                    ))}
                  </select>
                </label>
                {detail.variants
                  .filter((v) => v.id === sku)
                  .map((v) => (
                    <div key={v.id}>
                      <h2>{money(v.price)}</h2>
                      <p>Còn {v.available} cuốn</p>
                      <button
                        className="primary"
                        disabled={!v.available}
                        onClick={add}
                      >
                        Thêm vào giỏ
                      </button>{" "}
                      <button onClick={() => go("cart")}>Xem giỏ hàng</button>
                    </div>
                  ))}
              </article>
            </div>
          </>
        )}
        {tab === "cart" && (
          <>
            <h1>Giỏ hàng</h1>
            {!cart.length ? (
              <p>
                Giỏ hàng đang trống.{" "}
                <button onClick={() => go("shop")}>Khám phá kệ truyện</button>
              </p>
            ) : (
              <div className="split">
                <section>
                  {cart.map((x) => (
                    <div className="line" key={x.sku}>
                      <div>
                        <strong>{x.title}</strong>
                        <p>
                          Tập {x.volume} · {x.edition} · {money(x.price)}
                        </p>
                      </div>
                      <label>
                        Số lượng
                        <input
                          type="number"
                          min="1"
                          max={Math.min(99, x.available)}
                          value={x.qty}
                          onChange={(e) =>
                            setCart(
                              cart.map((c) =>
                                c.sku === x.sku
                                  ? {
                                      ...c,
                                      qty: Math.max(
                                        1,
                                        Math.min(
                                          +e.target.value,
                                          99,
                                          x.available,
                                        ),
                                      ),
                                    }
                                  : c,
                              ),
                            )
                          }
                        />
                      </label>
                      <button
                        onClick={() =>
                          setCart(cart.filter((c) => c.sku !== x.sku))
                        }
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                  <h2>Tạm tính {money(total)}</h2>
                </section>
                <form className="panel" onSubmit={checkout}>
                  <h2>Giao hàng</h2>
                  <label>
                    Người nhận
                    <input
                      name="recipient"
                      required
                      maxLength="100"
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    Điện thoại
                    <input
                      name="phone"
                      type="tel"
                      required
                      minLength="8"
                      maxLength="18"
                      autoComplete="tel"
                    />
                  </label>
                  <label>
                    Địa chỉ
                    <textarea name="address" required maxLength="300" />
                  </label>
                  <label>
                    Thanh toán
                    <select name="payment">
                      <option value="COD">Khi nhận hàng (COD)</option>
                      <option value="SIM_OK">Mô phỏng thành công</option>
                      <option value="SIM_FAIL">Mô phỏng thất bại</option>
                    </select>
                  </label>
                  <button className="primary" disabled={busy}>
                    {auth.authenticated ? "Đặt hàng" : "Đăng nhập để đặt hàng"}
                  </button>
                </form>
              </div>
            )}
          </>
        )}
        {tab === "orders" && (
          <>
            <h1>Đơn hàng của tôi</h1>
            {!orders.length && <p>Bạn chưa có đơn hàng.</p>}
            {orders.map((o) => (
              <article className="panel" key={o.id}>
                <small>#{o.id}</small>
                <h3>{status[o.status]}</h3>
                {o.items.map((l) => (
                  <p key={l.sku}>
                    {l.title ?? "SKU " + l.sku}{" "}
                    {l.volume ? "· Tập " + l.volume : ""} × {l.qty}
                  </p>
                ))}
                <strong>{money(o.total)}</strong>
                <p>
                  {o.recipient} · {o.address}
                </p>
              </article>
            ))}
          </>
        )}
        {tab === "admin" && auth.hasRealmRole("admin") && (
          <Admin books={books} refresh={refresh} fail={fail} />
        )}
      </main>
      {notice && (
        <div role="status" className="toast">
          {notice}
        </div>
      )}
      <button className="chatButton" onClick={() => setChat(!chat)}>
        ✦ Trợ lý Conan
      </button>
      {chat && <Chat close={() => setChat(false)} />}
    </>
  );
}
function Chat({ close }) {
  const [messages, set] = useState([]),
    [q, input] = useState(""),
    [busy, wait] = useState(false);
  async function send(e) {
    e.preventDefault();
    if (!q.trim() || busy) return;
    let question = q.trim();
    input("");
    wait(true);
    set((m) => [...m, { question }]);
    try {
      let r = await api("assistant/ask", "POST", { question });
      set((m) => [...m, r]);
    } catch (e) {
      set((m) => [...m, { answer: e.message }]);
    } finally {
      wait(false);
    }
  }
  return (
    <aside className="chat">
      <div className="heading">
        <h3>Trợ lý Conan</h3>
        <button aria-label="Đóng" onClick={close}>
          ×
        </button>
      </div>
      <section aria-live="polite">
        {!messages.length && (
          <p>
            Bạn muốn tìm hiểu bộ truyện nào? Mình có thể tra giá, tồn kho và
            chính sách nhà sách.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.question ? "question" : "answer"}>
            {m.question ?? m.answer}
            {m.sources?.length > 0 && (
              <small>
                {m.mode === "excerpt" ? "Trích tài liệu · " : ""}
                {m.sources.join(" • ")}
              </small>
            )}
          </div>
        ))}
        {busy && <p>Đang tra cứu…</p>}
      </section>
      <form onSubmit={send}>
        <input
          aria-label="Câu hỏi"
          placeholder="Nhập câu hỏi…"
          maxLength="600"
          value={q}
          onChange={(e) => input(e.target.value)}
        />
        <button disabled={busy}>Gửi</button>
      </form>
    </aside>
  );
}
auth
  .init({ onLoad: "check-sso", pkceMethod: "S256", checkLoginIframe: false })
  .catch(() => false)
  .finally(() => createRoot(document.getElementById("root")).render(<App />));
