package vn.conan;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;

public final class OrderView {
  public static Map<String, Object> from(ObjectMapper json, Map<String, Object> r)
      throws Exception {
    r.put("items", json.readTree(r.remove("lines_json").toString()));
    r.remove("request_hash");
    r.remove("request_key");
    return r;
  }
}
