package vn.conan;

import static vn.conan.Db.*;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import java.sql.Connection;
import java.util.*;

@Path("/api/catalog")
@Produces("application/json")
@Consumes("application/json")
public class Catalog {
  @Inject Db db;
  @Inject Inventory events;

  public record Book(String title, String author, String genre, String description) {}

  public record Variant(int volume, String edition, int price, int quantity) {}

  public record Adjustment(int delta, Integer price) {}

  @GET
  public List<Map<String, Object>> list() {
    return db.tx(
        c ->
            rows(
                c,
                "SELECT b.*,MIN(s.price) price,COALESCE(SUM(s.on_hand-s.held),0) available FROM"
                    + " books b LEFT JOIN sku s ON s.book_id=b.id WHERE b.active=1 GROUP BY b.id"
                    + " ORDER BY b.id"));
  }

  @GET
  @Path("/{id}")
  public Map<String, Object> detail(@PathParam("id") int id) {
    return db.tx(c -> detail(c, id));
  }

  static Map<String, Object> detail(Connection c, int id) throws Exception {
    var b = one(c, "SELECT * FROM books WHERE active=1 AND id=?", id);
    b.put(
        "variants",
        rows(
            c,
            "SELECT id,volume,edition,price,on_hand,held,on_hand-held available FROM sku WHERE"
                + " book_id=? ORDER BY volume,edition",
            id));
    return b;
  }

  void changed(Connection c, int id) throws Exception {
    events.emit(c, "catalog.changed", "" + id, Map.of("id", id));
  }

  @POST
  @RolesAllowed("admin")
  public Map<String, Object> create(Book b) {
    return db.tx(
        c -> {
          update(
              c,
              "INSERT INTO books(title,author,genre,description) VALUES(?,?,?,?)",
              required(b.title, 150),
              required(b.author, 100),
              required(b.genre, 80),
              required(b.description, 4000));
          int id = ((Number) one(c, "SELECT LAST_INSERT_ID() id").get("id")).intValue();
          changed(c, id);
          return detail(c, id);
        });
  }

  @PUT
  @Path("/{id}")
  @RolesAllowed("admin")
  public Map<String, Object> edit(@PathParam("id") int id, Book b) {
    return db.tx(
        c -> {
          detail(c, id);
          update(
              c,
              "UPDATE books SET title=?,author=?,genre=?,description=? WHERE id=?",
              required(b.title, 150),
              required(b.author, 100),
              required(b.genre, 80),
              required(b.description, 4000),
              id);
          changed(c, id);
          return detail(c, id);
        });
  }

  @DELETE
  @Path("/{id}")
  @RolesAllowed("admin")
  public void archive(@PathParam("id") int id) {
    db.tx(
        c -> {
          detail(c, id);
          update(c, "UPDATE books SET active=0 WHERE id=?", id);
          changed(c, id);
          return null;
        });
  }

  @POST
  @Path("/{id}/variants")
  @RolesAllowed("admin")
  public Map<String, Object> variant(@PathParam("id") int id, Variant v) {
    return db.tx(
        c -> {
          detail(c, id);
          if (v.volume < 1 || v.quantity < 0 || v.price < 1 || v.price > 100000000)
            throw error(400, "Tập, giá hoặc số lượng không hợp lệ");
          if (update(
                  c,
                  "INSERT IGNORE INTO sku(book_id,volume,edition,price,on_hand) VALUES(?,?,?,?,?)",
                  id,
                  v.volume,
                  required(v.edition, 80),
                  v.price,
                  v.quantity)
              == 0) throw error(409, "Phiên bản đã tồn tại");
          return detail(c, id);
        });
  }

  @POST
  @Path("/stock/{id}")
  @RolesAllowed("admin")
  public Map<String, Object> stock(@PathParam("id") int id, Adjustment a) {
    if (a.price != null && (a.price < 1 || a.price > 100000000))
      throw error(400, "Giá không hợp lệ");
    return db.tx(
        c -> {
          if (update(
                  c,
                  "UPDATE sku SET on_hand=on_hand+?,price=COALESCE(?,price) WHERE id=? AND"
                      + " on_hand+? BETWEEN held AND 2147483647",
                  a.delta,
                  a.price,
                  id,
                  a.delta)
              != 1) throw error(409, "Điều chỉnh vượt số lượng khả dụng");
          return one(c, "SELECT id,on_hand,held,on_hand-held available FROM sku WHERE id=?", id);
        });
  }
}
