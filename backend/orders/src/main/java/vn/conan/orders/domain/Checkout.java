package vn.conan.orders.domain;

import java.util.*;

public record Checkout(
    String recipient, String address, String phone, String payment, List<Line> items) {
  public record Line(int sku, int qty) {}

  public Checkout validated() {
    if (recipient == null
        || recipient.isBlank()
        || recipient.length() > 100
        || address == null
        || address.isBlank()
        || address.length() > 300)
      throw new IllegalArgumentException("Vui lòng kiểm tra thông tin giao hàng");
    if (phone == null
        || !phone.matches("[+0-9 ()-]{8,18}")
        || payment == null
        || !Set.of("COD", "SIM_OK", "SIM_FAIL").contains(payment))
      throw new IllegalArgumentException("Kiểm tra điện thoại và phương thức thanh toán");
    if (items == null || items.isEmpty() || items.size() > 60)
      throw new IllegalArgumentException("Giỏ hàng không hợp lệ");
    var bySku = new TreeMap<Integer, Line>();
    for (var line : items)
      if (line == null
          || line.sku() < 1
          || line.qty() < 1
          || line.qty() > 99
          || bySku.put(line.sku(), line) != null)
        throw new IllegalArgumentException("Số lượng hoặc SKU không hợp lệ");
    return new Checkout(
        recipient.strip(), address.strip(), phone.strip(), payment, List.copyOf(bySku.values()));
  }
}
