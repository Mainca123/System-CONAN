package vn.conan.orders.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;
import vn.conan.orders.domain.Checkout;

@ApplicationScoped
public class CheckoutService {
  private final OrderStore store;

  @Inject
  public CheckoutService(OrderStore store) {
    this.store = store;
  }

  public Map<String, Object> place(String owner, String key, Checkout checkout) {
    if (key == null || key.isBlank() || key.length() > 80 || checkout == null)
      throw new IllegalArgumentException("Thiếu mã yêu cầu hoặc nội dung đơn");
    return store.place(owner, key, checkout.validated());
  }
}
