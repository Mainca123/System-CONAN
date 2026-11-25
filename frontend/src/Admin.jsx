import React, { useState, useEffect } from "react";
import { api, money, status } from "./api";
const blank = { title: "", genre: "", author: "", description: "" },
  emptyDoc = { title: "", source: "", body: "" };
function Fields({ value, set, labels }) {
  return Object.entries(labels).map(([k, label]) => (
    <label key={k}>
      {label}
      {["body", "description"].includes(k) ? (
        <textarea
          required
          value={value[k]}
          onChange={(e) => set({ ...value, [k]: e.target.value })}
        />
      ) : (
        <input
          required
          value={value[k]}
          onChange={(e) => set({ ...value, [k]: e.target.value })}
        />
      )}
    </label>
  ));
}
export default function Admin({ books, refresh, fail }) {
  const [page, setPage] = useState("Truyện và kho"),
    [book, setBook] = useState(blank),
    [doc, setDoc] = useState(emptyDoc),
    [docs, setDocs] = useState([]),
    [orders, setOrders] = useState([]),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    if (page === "Đơn hàng") setOrders(await api("orders/admin"));
    if (page === "Tài liệu AI") setDocs(await api("assistant/documents"));
  }
  useEffect(() => {
    setMsg("");
    load().catch(fail);
  }, [page]);
  async function run(fn) {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      await refresh();
      await load();
      setMsg("Đã cập nhật");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  function selectBook(id) {
    if (!id) setBook(blank);
    else
      api("catalog/" + id)
        .then(setBook)
        .catch(fail);
  }
  return (
    <>
      <h1>Quản trị nhà sách</h1>
      <div className="filters">
        {["Truyện và kho", "Đơn hàng", "Tài liệu AI"].map((p) => (
          <button
            key={p}
            className={p === page ? "active" : ""}
            onClick={() => setPage(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <p role="status">{msg}</p>
      <fieldset disabled={busy}>
        {page === "Truyện và kho" && (
          <div className="split">
            <form
              className="panel"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () =>
                  setBook(
                    await api(
                      "catalog" + (book.id ? "/" + book.id : ""),
                      book.id ? "PUT" : "POST",
                      book,
                    ),
                  ),
                );
              }}
            >
              <label>
                Bộ truyện
                <select
                  value={book.id ?? ""}
                  onChange={(e) => selectBook(e.target.value)}
                >
                  <option value="">Tạo bộ mới</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </label>
              <Fields
                value={book}
                set={setBook}
                labels={{
                  title: "Tên bộ",
                  author: "Tác giả",
                  genre: "Thể loại",
                  description: "Mô tả",
                }}
              />
              <button className="primary">Lưu bộ truyện</button>{" "}
              {book.id && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Ẩn bộ truyện khỏi cửa hàng?"))
                      run(async () => {
                        await api("catalog/" + book.id, "DELETE");
                        setBook(blank);
                      });
                  }}
                >
                  Ẩn bộ
                </button>
              )}
            </form>
            {book.id && (
              <section className="panel">
                <h2>Kho theo SKU</h2>
                {book.variants.map((v) => (
                  <form
                    className="stock"
                    key={v.id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const data = new FormData(e.target);
                      const delta = Number(data.get("delta"));
                      const price = Number(data.get("price"));
                      run(async () => {
                        await api("catalog/stock/" + v.id, "POST", {
                          delta,
                          price,
                        });
                        setBook(await api("catalog/" + book.id));
                      });
                    }}
                  >
                    <strong>
                      Tập {v.volume} · {v.edition}
                    </strong>
                    <p>
                      {money(v.price)} · Có {v.on_hand} · Đang giữ {v.held}
                    </p>
                    <input
                      type="number"
                      name="delta"
                      defaultValue="0"
                      required
                      placeholder="+ nhập / − giảm"
                      aria-label="Lượng điều chỉnh"
                    />{" "}
                    <label>
                      Giá bán (đ)
                      <input
                        name="price"
                        type="number"
                        min="1"
                        max="100000000"
                        defaultValue={v.price}
                        required
                      />
                    </label>
                    <button>Cập nhật kho</button>
                  </form>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    let v = Object.fromEntries(new FormData(e.target));
                    for (const k of ["volume", "price", "quantity"])
                      v[k] = +v[k];
                    run(async () =>
                      setBook(
                        await api(
                          "catalog/" + book.id + "/variants",
                          "POST",
                          v,
                        ),
                      ),
                    );
                  }}
                >
                  <h3>Thêm phiên bản</h3>
                  {[
                    ["volume", "Tập", 1],
                    ["edition", "Phiên bản"],
                    ["price", "Giá bán", 1],
                    ["quantity", "Tồn đầu", 0],
                  ].map(([k, l, min]) => (
                    <label key={k}>
                      {l}
                      <input
                        name={k}
                        type={min == null ? "text" : "number"}
                        min={min}
                        required
                      />
                    </label>
                  ))}
                  <button>Thêm SKU</button>
                </form>
              </section>
            )}
          </div>
        )}
        {page === "Đơn hàng" && (
          <>
            <button onClick={() => load().catch(fail)}>Làm mới</button>
            {!orders.length && <p>Chưa có đơn hàng.</p>}
            {orders.map((o) => (
              <article className="panel" key={o.id}>
                <small>#{o.id}</small>
                <h3>
                  {status[o.status]} · {money(o.total)}
                </h3>
                <p>
                  {o.recipient} · {o.phone} · {o.address}
                </p>
                {o.items.map((i) => (
                  <p key={i.sku}>
                    {i.title ?? "SKU " + i.sku} · × {i.qty}
                  </p>
                ))}
                {["CONFIRMED", "SHIPPED"].includes(o.status) && (
                  <button
                    onClick={() =>
                      run(() =>
                        api("orders/admin/" + o.id, "PATCH", {
                          status:
                            o.status === "CONFIRMED" ? "SHIPPED" : "DELIVERED",
                        }),
                      )
                    }
                  >
                    {o.status === "CONFIRMED"
                      ? "Bắt đầu giao"
                      : "Đánh dấu đã giao"}
                  </button>
                )}
              </article>
            ))}
          </>
        )}
        {page === "Tài liệu AI" && (
          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api(
                  "assistant/documents" + (doc.id ? "/" + doc.id : ""),
                  doc.id ? "PUT" : "POST",
                  doc,
                );
                setDoc(emptyDoc);
              });
            }}
          >
            <label>
              Chọn tài liệu
              <select
                value={doc.id ?? ""}
                onChange={(e) =>
                  setDoc(docs.find((d) => d.id === e.target.value) ?? emptyDoc)
                }
              >
                <option value="">Tài liệu mới</option>
                {docs
                  .filter((d) => d.id.startsWith("doc-"))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
              </select>
            </label>
            <Fields
              value={doc}
              set={setDoc}
              labels={{ title: "Tiêu đề", source: "Nguồn", body: "Nội dung" }}
            />
            <button className="primary">Lưu và lập chỉ mục</button>{" "}
            {doc.id && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Xóa tài liệu đã chọn?"))
                    run(async () => {
                      await api("assistant/documents/" + doc.id, "DELETE");
                      setDoc(emptyDoc);
                    });
                }}
              >
                Xóa tài liệu
              </button>
            )}
          </form>
        )}
      </fieldset>
    </>
  );
}
