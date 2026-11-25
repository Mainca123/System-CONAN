package vn.conan;

import static vn.conan.Db.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import java.util.*;
import vn.conan.orders.application.CheckoutService;
import vn.conan.orders.domain.Checkout;

@Path("/api/orders")
@Authenticated
@Produces("application/json")
@Consumes("application/json")
public class Orders {
  @Inject Db db;
  @Inject CheckoutService checkoutService;
  @Inject ObjectMapper json;
  @Inject SecurityIdentity identity;

  public record Progress(String status) {}

  private String owner() {
    return identity.getPrincipal() instanceof org.eclipse.microprofile.jwt.JsonWebToken jwt
        ? jwt.getSubject()
        : identity.getPrincipal().getName();
  }

  @POST
  public Map<String, Object> checkout(@HeaderParam("Idempotency-Key") String key, Checkout x) {
    try {
      return checkoutService.place(owner(), key, x);
    } catch (IllegalArgumentException e) {
      throw error(400, e.getMessage());
    }
  }

  @GET
  public List<Map<String, Object>> history() {
    return list(false);
  }

  @GET
  @Path("/admin")
  @RolesAllowed("admin")
  public List<Map<String, Object>> admin() {
    return list(true);
  }

  List<Map<String, Object>> list(boolean all) {
    return db.tx(
        c -> {
          var result =
              all
                  ? rows(c, "SELECT * FROM purchases ORDER BY created DESC")
                  : rows(c, "SELECT * FROM purchases WHERE owner=? ORDER BY created DESC", owner());
          for (var r : result) OrderView.from(json, r);
          return result;
        });
  }

  @GET
  @Path("/{id}")
  public Map<String, Object> get(@PathParam("id") String id) {
    return db.tx(
        c ->
            OrderView.from(
                json, one(c, "SELECT * FROM purchases WHERE id=? AND owner=?", id, owner())));
  }

  @PATCH
  @Path("/admin/{id}")
  @RolesAllowed("admin")
  public void progress(@PathParam("id") String id, Progress p) {
    db.tx(
        c -> {
          String previous =
              "SHIPPED".equals(p.status)
                  ? "CONFIRMED"
                  : "DELIVERED".equals(p.status) ? "SHIPPED" : "";
          if (previous.isEmpty()
              || update(
                      c,
                      "UPDATE purchases SET status=? WHERE id=? AND status=?",
                      p.status,
                      id,
                      previous)
                  != 1) throw error(409, "Trạng thái đơn không hợp lệ");
          return null;
        });
  }
}
