package vn.conan.orders.adapter;

import static vn.conan.Db.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.security.MessageDigest;
import java.util.*;
import vn.conan.*;
import vn.conan.orders.application.OrderStore;
import vn.conan.orders.domain.Checkout;

@ApplicationScoped
public class JdbcOrderStore implements OrderStore {
  @Inject Db db;
  @Inject OrderFlow flow;
  @Inject ObjectMapper json;

  public Map<String, Object> place(String user, String key, Checkout x) {
    return db.tx(
        c -> {
          String id = UUID.randomUUID().toString();
          var items = x.items();
          String hash =
              HexFormat.of()
                  .formatHex(
                      MessageDigest.getInstance("SHA-256")
                          .digest(
                              json.writeValueAsBytes(
                                  new Checkout(
                                      x.recipient(), x.address(), x.phone(), x.payment(), items))));
          update(
              c,
              "INSERT INTO"
                  + " purchases(id,owner,request_key,request_hash,recipient,address,phone,payment,status,lines_json)"
                  + " VALUES(?,?,?,?,?,?,?,?,'PENDING',?) ON DUPLICATE KEY UPDATE id=id",
              id,
              user,
              key,
              hash,
              x.recipient(),
              x.address(),
              x.phone(),
              x.payment(),
              json.writeValueAsString(items));
          var r =
              one(
                  c,
                  "SELECT * FROM purchases WHERE owner=? AND request_key=? FOR UPDATE",
                  user,
                  key);
          if (!hash.equals(r.get("request_hash")))
            throw error(409, "Mã yêu cầu đã dùng cho giỏ hàng khác");
          if (id.equals(r.get("id")))
            flow.emit(
                c, "stock.commands", id, Map.of("id", id, "action", "reserve", "items", items));
          return OrderView.from(json, r);
        });
  }
}
