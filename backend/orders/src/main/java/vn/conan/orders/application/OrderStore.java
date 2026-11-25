package vn.conan.orders.application;

import java.util.Map;
import vn.conan.orders.domain.Checkout;

public interface OrderStore {
  Map<String, Object> place(String owner, String key, Checkout checkout);
}
