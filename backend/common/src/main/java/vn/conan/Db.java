package vn.conan;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import java.sql.*;
import java.util.*;
import javax.sql.DataSource;

@ApplicationScoped
public class Db {
  @Inject DataSource source;

  public interface Work<T> {
    T run(Connection c) throws Exception;
  }

  public <T> T tx(Work<T> work) {
    try (var c = source.getConnection()) {
      c.setAutoCommit(false);
      try {
        T result = work.run(c);
        c.commit();
        return result;
      } catch (Exception e) {
        c.rollback();
        throw e;
      }
    } catch (RuntimeException e) {
      throw e;
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  static PreparedStatement bind(Connection c, String sql, Object... args) throws SQLException {
    var stmt = c.prepareStatement(sql);
    for (int i = 0; i < args.length; i++) stmt.setObject(i + 1, args[i]);
    return stmt;
  }

  public static int update(Connection c, String sql, Object... args) throws SQLException {
    try (var stmt = bind(c, sql, args)) {
      return stmt.executeUpdate();
    }
  }

  public static List<Map<String, Object>> rows(Connection c, String sql, Object... args)
      throws SQLException {
    try (var stmt = bind(c, sql, args);
        var rs = stmt.executeQuery()) {
      var list = new ArrayList<Map<String, Object>>();
      while (rs.next()) {
        var row = new LinkedHashMap<String, Object>();
        for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++)
          row.put(rs.getMetaData().getColumnLabel(i), rs.getObject(i));
        list.add(row);
      }
      return list;
    }
  }

  public static Map<String, Object> one(Connection c, String sql, Object... args)
      throws SQLException {
    var list = rows(c, sql, args);
    if (list.isEmpty()) throw error(404, "Không tìm thấy dữ liệu");
    return list.get(0);
  }

  public static WebApplicationException error(int status, String msg) {
    return new WebApplicationException(
        jakarta.ws.rs.core.Response.status(status).entity(Map.of("message", msg)).build());
  }

  public static String required(String value, int max) {
    if (value == null || value.isBlank() || value.strip().length() > max)
      throw error(400, "Vui lòng kiểm tra nội dung đã nhập");
    return value.strip();
  }
}
