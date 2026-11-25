package vn.conan;

import static vn.conan.Db.*;

import com.fasterxml.jackson.databind.JsonNode;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.Connection;
import java.util.*;

@ApplicationScoped
public class OrderFlow extends Events {
  protected String group() {
    return "orders-v1";
  }

  protected List<String> subscriptions() {
    return List.of("stock.results");
  }

  @Scheduled(every = "1s", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
  void send() {
    publish();
  }

  @Scheduled(every = "1s", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
  void receive() {
    consume();
  }

  @Scheduled(every = "30s", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
  void expire() {
    db.tx(
        c -> {
          for (var r :
              rows(
                  c,
                  "SELECT id FROM purchases WHERE status='PENDING' AND created < NOW() - INTERVAL"
                      + " 10 MINUTE LIMIT 50 FOR UPDATE")) {
            String id = r.get("id").toString();
            update(c, "UPDATE purchases SET status='EXPIRED' WHERE id=?", id);
            emit(c, "stock.commands", id, Map.of("id", id, "action", "release"));
          }
          return null;
        });
  }

  protected void handle(Connection c, String topic, JsonNode msg) throws Exception {
    String id = msg.get("id").asText(), result = msg.get("result").asText();
    var r = one(c, "SELECT status,payment FROM purchases WHERE id=? FOR UPDATE", id);
    String state = r.get("status").toString();
    switch (result) {
      case "HELD" -> {
        if (!state.equals("PENDING")) return;
        boolean paid = !"SIM_FAIL".equals(r.get("payment"));
        update(
            c,
            "UPDATE purchases SET status=?,total=?,lines_json=? WHERE id=?",
            paid ? "CONFIRMING" : "RELEASING",
            msg.get("total").asLong(),
            msg.get("items").toString(),
            id);
        emit(c, "stock.commands", id, Map.of("id", id, "action", paid ? "confirm" : "release"));
      }
      case "REJECTED" ->
          update(
              c, "UPDATE purchases SET status='OUT_OF_STOCK' WHERE id=? AND status='PENDING'", id);
      case "CONFIRMED" ->
          update(
              c, "UPDATE purchases SET status='CONFIRMED' WHERE id=? AND status='CONFIRMING'", id);
      case "RELEASED" ->
          update(
              c,
              "UPDATE purchases SET status='PAYMENT_FAILED' WHERE id=? AND status='RELEASING'",
              id);
    }
  }
}
