package vn.conan;

import static vn.conan.Db.*;

import com.fasterxml.jackson.databind.JsonNode;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.Connection;
import java.util.*;

@ApplicationScoped
public class Inventory extends Events {
  protected String group() {
    return "inventory-v1";
  }

  protected List<String> subscriptions() {
    return List.of("stock.commands");
  }

  @Scheduled(every = "1s", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
  void send() {
    publish();
  }

  @Scheduled(every = "1s", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
  void receive() {
    consume();
  }

  protected void handle(Connection c, String topic, JsonNode cmd) throws Exception {
    String id = cmd.path("id").asText(), action = cmd.path("action").asText();
    var existing = rows(c, "SELECT * FROM reservations WHERE order_id=? FOR UPDATE", id);
    if (action.equals("reserve")) {
      if (!existing.isEmpty()) return;
      var snapshot = new ArrayList<Map<String, Object>>();
      boolean enough = true;
      long total = 0;
      for (var item : cmd.path("items")) {
        int sku = item.path("sku").asInt(), qty = item.path("qty").asInt();
        var found =
            rows(
                c,
                "SELECT s.*,b.title FROM sku s JOIN books b ON s.book_id=b.id WHERE s.id=? AND"
                    + " b.active=1 FOR UPDATE",
                sku);
        if (found.isEmpty()) {
          enough = false;
          break;
        }
        var r = found.get(0);
        int available = (int) r.get("on_hand") - (int) r.get("held");
        if (available < qty) {
          enough = false;
          break;
        }
        int price = (int) r.get("price");
        total += (long) price * qty;
        snapshot.add(
            Map.of(
                "sku",
                sku,
                "qty",
                qty,
                "price",
                price,
                "title",
                r.get("title"),
                "volume",
                r.get("volume"),
                "edition",
                r.get("edition")));
      }
      if (enough)
        for (var item : snapshot)
          update(c, "UPDATE sku SET held=held+? WHERE id=?", item.get("qty"), item.get("sku"));
      update(
          c,
          "INSERT INTO reservations VALUES(?,?,?)",
          id,
          enough ? "HELD" : "REJECTED",
          json.writeValueAsString(enough ? snapshot : List.of()));
      emit(
          c,
          "stock.results",
          id,
          Map.of(
              "id",
              id,
              "result",
              enough ? "HELD" : "REJECTED",
              "items",
              enough ? snapshot : List.of(),
              "total",
              enough ? total : 0));
      return;
    }
    if (existing.isEmpty() || !"HELD".equals(existing.get(0).get("state"))) return;
    boolean confirm = action.equals("confirm");
    for (var line : json.readTree(existing.get(0).get("lines_json").toString())) {
      int q = line.get("qty").asInt();
      update(
          c,
          "UPDATE sku SET held=held-?,on_hand=on_hand-? WHERE id=?",
          q,
          confirm ? q : 0,
          line.get("sku").asInt());
    }
    String result = confirm ? "CONFIRMED" : "RELEASED";
    update(c, "UPDATE reservations SET state=? WHERE order_id=?", result, id);
    emit(c, "stock.results", id, Map.of("id", id, "result", result));
  }
}
