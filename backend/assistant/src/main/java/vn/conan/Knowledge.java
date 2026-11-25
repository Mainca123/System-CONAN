package vn.conan;

import static vn.conan.Db.*;

import com.fasterxml.jackson.databind.JsonNode;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import java.net.*;
import java.net.http.*;
import java.sql.Connection;
import java.text.Normalizer;
import java.time.Duration;
import java.util.*;

@ApplicationScoped
public class Knowledge extends Events {
  static final HttpClient http =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

  protected String group() {
    return "assistant-v1";
  }

  protected List<String> subscriptions() {
    return List.of("catalog.changed");
  }

  @Scheduled(every = "2s", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
  void receive() {
    consume();
  }

  JsonNode catalog(String suffix) throws Exception {
    String base = System.getenv().getOrDefault("CATALOG_URL", "http://localhost:8081");
    var req =
        HttpRequest.newBuilder(URI.create(base + "/api/catalog" + suffix))
            .timeout(Duration.ofSeconds(5))
            .build();
    var res = http.send(req, HttpResponse.BodyHandlers.ofString());
    if (res.statusCode() == 404) return null;
    if (res.statusCode() != 200) throw error(503, "Danh mục tạm thời chưa sẵn sàng");
    return json.readTree(res.body());
  }

  static String fold(String s) {
    return Normalizer.normalize(s.toLowerCase(Locale.ROOT).replace('đ', 'd'), Normalizer.Form.NFD)
        .replaceAll("\\p{M}", "")
        .replaceAll("[^a-z0-9]+", " ")
        .trim();
  }

  static double[] vector(String text) {
    var v = new double[512];
    String prev = "";
    for (String word : fold(text).split(" ")) {
      v[Math.floorMod(word.hashCode(), v.length)]++;
      if (!prev.isEmpty()) v[Math.floorMod((prev + " " + word).hashCode(), v.length)] += 1.4;
      prev = word;
    }
    double norm = Math.sqrt(Arrays.stream(v).map(x -> x * x).sum());
    if (norm > 0) for (int i = 0; i < v.length; i++) v[i] /= norm;
    return v;
  }

  void save(Connection c, String id, String title, String source, String body) throws Exception {
    update(
        c,
        "INSERT INTO documents(id,title,source,body) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE"
            + " title=VALUES(title),source=VALUES(source),body=VALUES(body),version=version+1",
        id,
        title,
        source,
        body);
    update(c, "DELETE FROM chunks WHERE doc_id=?", id);
    int seq = 0;
    for (int start = 0; start < body.length(); start += 540) {
      String part = body.substring(start, Math.min(start + 640, body.length()));
      update(
          c,
          "INSERT INTO chunks VALUES(?,?,?,?)",
          id,
          seq++,
          part,
          json.writeValueAsString(vector(title + " " + part)));
    }
  }

  protected void handle(Connection c, String topic, JsonNode data) throws Exception {
    int id = data.get("id").asInt();
    var b = catalog("/" + id);
    if (b == null) update(c, "DELETE FROM documents WHERE id=?", "book-" + id);
    else
      save(
          c,
          "book-" + id,
          b.get("title").asText(),
          "Danh mục · Bộ #" + id,
          b.get("description").asText()
              + " Tác giả: "
              + b.get("author").asText()
              + ". Thể loại: "
              + b.get("genre").asText()
              + ".");
  }

  record Hit(String id, String title, String source, String excerpt, double score) {}

  List<Hit> search(String question) {
    double[] query = vector(question);
    return db.tx(
        c -> {
          var hits = new ArrayList<Hit>();
          for (var r :
              rows(
                  c,
                  "SELECT d.id,d.title,d.source,ch.body,ch.embedding FROM chunks ch JOIN documents"
                      + " d ON ch.doc_id=d.id")) {
            double[] v = json.readValue(r.get("embedding").toString(), double[].class);
            double score = 0;
            for (int i = 0; i < v.length; i++) score += v[i] * query[i];
            String title = r.get("title").toString();
            if (fold(question).contains(fold(title))) score += 1;
            if (score >= 0.17)
              hits.add(
                  new Hit(
                      r.get("id").toString(),
                      title,
                      r.get("source").toString(),
                      r.get("body").toString(),
                      score));
          }
          return hits.stream()
              .sorted(Comparator.comparingDouble(Hit::score).reversed())
              .limit(3)
              .toList();
        });
  }

  String generate(String prompt) throws Exception {
    String model = System.getenv().getOrDefault("OLLAMA_MODEL", "qwen2.5:0.5b");
    String ollamaUrl = System.getenv().getOrDefault("OLLAMA_URL", "http://localhost:11434");
    String body =
        json.writeValueAsString(
            Map.of(
                "model",
                model,
                "prompt",
                prompt,
                "stream",
                false,
                "options",
                Map.of("temperature", 0, "num_predict", 140)));
    var req =
        HttpRequest.newBuilder(URI.create(ollamaUrl + "/api/generate"))
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(65))
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
    var res = http.send(req, HttpResponse.BodyHandlers.ofString());
    if (res.statusCode() != 200) throw new IllegalStateException("Model unavailable");
    return json.readTree(res.body()).path("response").asText().trim();
  }
}
