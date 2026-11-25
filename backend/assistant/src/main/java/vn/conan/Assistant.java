package vn.conan;

import static vn.conan.Db.*;
import static vn.conan.Knowledge.fold;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import java.util.*;

@Path("/api/assistant")
@Produces("application/json")
@Consumes("application/json")
public class Assistant {
  @Inject Knowledge kb;
  @Inject Db db;

  public record Ask(String question) {}

  public record Doc(String title, String source, String body) {}

  private static final String UNKNOWN =
      "Mình chưa đủ thông tin để trả lời. Bạn có thể ghi rõ tên bộ truyện hoặc chính sách muốn tra"
          + " cứu.";

  @POST
  @Path("/ask")
  public Map<String, Object> ask(Ask ask) throws Exception {
    String q = required(ask.question, 600), normalized = " " + fold(q) + " ";
    boolean live =
        List.of(
                " gia ",
                " ton ",
                " bao nhieu tien ",
                " con hang ",
                " het hang ",
                " con bao nhieu ",
                " bao nhieu cuon ")
            .stream()
            .anyMatch(normalized.replace(" tac gia ", " ")::contains);
    if (live) {
      for (var b : kb.catalog(""))
        if (normalized.contains(" " + fold(b.get("title").asText()) + " ")) {
          int id = b.get("id").asInt();
          var detail = kb.catalog("/" + id);
          if (detail == null) break;
          var lines = new ArrayList<String>();
          var volume = java.util.regex.Pattern.compile("\\btap (\\d+)\\b").matcher(normalized);
          String wanted = volume.find() ? volume.group(1) : null;
          for (var v : detail.get("variants"))
            if (wanted == null || wanted.equals(v.get("volume").asText()))
              lines.add(
                  "Tập "
                      + v.get("volume")
                      + " ("
                      + v.get("edition").asText()
                      + "): "
                      + String.format(Locale.GERMANY, "%,d", v.get("price").asInt())
                      + " đ, còn "
                      + v.get("available")
                      + " cuốn");
          return Map.of(
              "answer",
              lines.isEmpty()
                  ? "Chưa có phiên bản này trong danh mục."
                  : b.get("title").asText() + "\n" + String.join("\n", lines),
              "sources",
              List.of("API danh mục · Bộ #" + id),
              "mode",
              "live");
        }
      return Map.of(
          "answer",
          "Bạn muốn tra giá hoặc tồn kho của bộ truyện nào? Hãy ghi tên bộ và số tập nếu có.",
          "sources",
          List.of(),
          "mode",
          "clarify");
    }
    var hits = kb.search(q);
    if (hits.isEmpty())
      return Map.of("answer", UNKNOWN, "sources", List.of(), "mode", "insufficient");
    var selected = hits.stream().filter(h -> h.score() >= hits.get(0).score() * .8).toList();
    var context =
        String.join("\n", selected.stream().map(h -> h.title() + ": " + h.excerpt()).toList());
    String answer, mode;
    try {
      answer =
          kb.generate(
              "Trả lời ngắn bằng tiếng Việt. Chỉ dùng dữ kiện trong tài liệu. Thiếu dữ kiện thì nói"
                  + " chưa đủ thông tin.\n"
                  + "TÀI LIỆU:\n"
                  + context
                  + "\nCÂU HỎI:\n"
                  + q);
      if (answer.isBlank()) throw new IllegalStateException();
      mode = "rag";
    } catch (Exception e) {
      answer = selected.get(0).excerpt();
      mode = "excerpt";
    }
    return Map.of(
        "answer",
        answer,
        "sources",
        selected.stream().map(h -> h.source() + " · " + h.title()).distinct().toList(),
        "mode",
        mode);
  }

  @GET
  @Path("/documents")
  @RolesAllowed("admin")
  public Object docs() {
    return db.tx(c -> rows(c, "SELECT * FROM documents ORDER BY id"));
  }

  @POST
  @Path("/documents")
  @RolesAllowed("admin")
  public Object add(Doc doc) {
    String id = "doc-" + UUID.randomUUID();
    put(id, doc);
    return Map.of("id", id);
  }

  @PUT
  @Path("/documents/{id}")
  @RolesAllowed("admin")
  public void edit(@PathParam("id") String id, Doc doc) {
    put(id, doc);
  }

  void put(String id, Doc d) {
    if (!id.startsWith("doc-")) throw error(409, "Sửa dữ liệu truyện trong danh mục");
    db.tx(
        c -> {
          kb.save(c, id, required(d.title, 180), required(d.source, 240), required(d.body, 12000));
          return null;
        });
  }

  @DELETE
  @Path("/documents/{id}")
  @RolesAllowed("admin")
  public void remove(@PathParam("id") String id) {
    if (!id.startsWith("doc-")) throw error(409, "Sửa dữ liệu truyện trong danh mục");
    db.tx(
        c -> {
          if (update(c, "DELETE FROM documents WHERE id=?", id) == 0)
            throw error(404, "Không tìm thấy tài liệu");
          return null;
        });
  }
}
