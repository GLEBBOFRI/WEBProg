package ru.ifmo.se;

import com.fastcgi.FCGIInterface;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.net.BindException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class Server {

    private static final Set<Double> VALID_X = Set.of(-4.0, -3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0, 4.0);
    private static final Set<Double> VALID_R = Set.of(1.0, 1.5, 2.0, 2.5, 3.0);
    private static final double EPSILON = 1e-7; // погрешность для сравнения флоатов

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm:ss")
            .withZone(ZoneId.of("Europe/Moscow"));

    public static class PointRecord {
        public final double x;
        public final double y;
        public final double r;
        public final boolean hit;
        public final String executionTime;
        public final String currentTime;

        public PointRecord(double x, double y, double r, boolean hit, String executionTime, String currentTime) {
            this.x = x;
            this.y = y;
            this.r = r;
            this.hit = hit;
            this.executionTime = executionTime;
            this.currentTime = currentTime;
        }

        public String toJson() {
            return String.format(Locale.US,
                    "{\"x\":%.3f,\"y\":%.3f,\"r\":%.1f,\"hit\":%b,\"executionTime\":\"%s\",\"currentTime\":\"%s\"}",
                    x, y, r, hit, escapeJson(executionTime), escapeJson(currentTime));
        }
    }

    // хранилище истории точек на сервере
    private static final List<PointRecord> HISTORY = new CopyOnWriteArrayList<>();

    private static Path getHistoryFilePath() {
        String home = System.getProperty("user.home");
        if (home != null && !home.isEmpty()) {
            Path httpdDir = Paths.get(home, "httpd-root");
            if (Files.exists(httpdDir) && Files.isDirectory(httpdDir)) {
                return httpdDir.resolve("history.json");
            }
        }
        return Paths.get("history.json").toAbsolutePath();
    }

    private static synchronized void saveHistoryToFile() {
        try {
            Path path = getHistoryFilePath();
            if (path.getParent() != null && !Files.exists(path.getParent())) {
                Files.createDirectories(path.getParent());
            }
            byte[] bytes = historyToJson().getBytes(StandardCharsets.UTF_8);
            Files.write(path, bytes, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        } catch (Exception e) {
            System.err.println("Ошибка сохранения истории: " + e.getMessage());
        }
    }

    private static synchronized void loadHistoryFromFile() {
        try {
            Path path = getHistoryFilePath();
            if (!Files.exists(path)) {
                return;
            }
            byte[] bytes = Files.readAllBytes(path);
            String content = new String(bytes, StandardCharsets.UTF_8);
            if (content.trim().isEmpty()) {
                return;
            }
            HISTORY.clear();
            Pattern objPattern = Pattern.compile("\\{[^{}]*\\}");
            Pattern kvPattern = Pattern.compile("\"([^\"]+)\"\\s*:\\s*(\"[^\"]*\"|true|false|[-\\d.]+)");
            Matcher objMatcher = objPattern.matcher(content);
            while (objMatcher.find()) {
                String objStr = objMatcher.group();
                Matcher kvMatcher = kvPattern.matcher(objStr);
                Map<String, String> map = new HashMap<>();
                while (kvMatcher.find()) {
                    String k = kvMatcher.group(1);
                    String v = kvMatcher.group(2);
                    if (v.startsWith("\"") && v.endsWith("\"") && v.length() >= 2) {
                        v = v.substring(1, v.length() - 1);
                    }
                    map.put(k, v);
                }
                if (map.containsKey("x") && map.containsKey("y") && map.containsKey("r") && map.containsKey("hit")) {
                    try {
                        double x = Double.parseDouble(map.get("x"));
                        double y = Double.parseDouble(map.get("y"));
                        double r = Double.parseDouble(map.get("r"));
                        boolean hit = Boolean.parseBoolean(map.get("hit"));
                        String execTime = map.getOrDefault("executionTime", "0.000 мс");
                        String curTime = map.getOrDefault("currentTime", "");
                        HISTORY.add(new PointRecord(x, y, r, hit, execTime, curTime));
                    } catch (Exception ignored) {
                    }
                }
            }
            System.err.println("Загружено сохраненных точек на сервере: " + HISTORY.size());
        } catch (Exception e) {
            System.err.println("Ошибка чтения истории: " + e.getMessage());
        }
    }

    private static String historyToJson() {
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        for (int i = 0; i < HISTORY.size(); i++) {
            if (i > 0)
                sb.append(",");
            sb.append(HISTORY.get(i).toJson());
        }
        sb.append("]");
        return sb.toString();
    }

    public static class ResponseData {
        public final int statusCode;
        public final String statusText;
        public final String jsonBody;

        public ResponseData(int statusCode, String statusText, String jsonBody) {
            this.statusCode = statusCode;
            this.statusText = statusText;
            this.jsonBody = jsonBody;
        }
    }

    public static void main(String[] args) {
        // загрузка истории точек из постоянного файла при старте
        loadHistoryFromFile();

        // запуск встроенного хттп-сервера для локального тестирования (если не отключен
        // флагом NO_HTTP)
        String noHttp = System.getProperty("NO_HTTP");
        if ("true".equalsIgnoreCase(noHttp)) {
            System.err.println("Локальный HTTP сервер отключен (NO_HTTP=true). Работа в режиме FastCGI.");
        } else {
            startLocalHttpServer();
        }

        // запуск фаст сиджиай цикла
        FCGIInterface fcgi = new FCGIInterface();
        String fcgiPort = System.getProperty("FCGI_PORT", "unknown");
        System.err.println("FastCGI Server started on port " + fcgiPort);

        while (fcgi.FCGIaccept() >= 0) {
            long startTime = System.nanoTime();
            try {
                processFastCgiRequest(startTime);
            } catch (Exception e) {
                System.err.println("Error processing FastCGI request: " + e.getMessage());
                e.printStackTrace(System.err);
                sendFastCgiResponse("500 Internal Server Error",
                        "{\"valid\":false,\"error\":\"Internal Server Error: " + escapeJson(e.getMessage()) + "\"}");
            }
        }
    }

    /**
     * Запуск локального хттп сервера на порту 24000.
     * для локального тестирования
     */
    private static void startLocalHttpServer() {
        int httpPort = 24000;
        try {
            String portProp = System.getProperty("HTTP_PORT");
            if (portProp != null && !portProp.trim().isEmpty()) {
                httpPort = Integer.parseInt(portProp.trim());
            }
        } catch (Exception ignored) {
        }

        try {
            HttpServer httpServer = HttpServer.create(new InetSocketAddress(httpPort), 0);

            // обработчик фаст сиджиай эндпоинта по хттп
            httpServer.createContext("/fcgi-bin/server.jar", new HttpHandler() {
                @Override
                public void handle(HttpExchange exchange) throws IOException {
                    long startTime = System.nanoTime();

                    // добавляем CORS заголовки
                    exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
                    exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                    exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");

                    String method = exchange.getRequestMethod().toUpperCase();
                    if ("OPTIONS".equals(method)) {
                        exchange.sendResponseHeaders(200, -1);
                        exchange.close();
                        return;
                    }

                    String rawData = "";
                    // считывание тела иф пост
                    if ("POST".equalsIgnoreCase(method)) {
                        try (InputStream is = exchange.getRequestBody()) {
                            rawData = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                        }
                    }

                    if (rawData.isEmpty() && exchange.getRequestURI().getQuery() != null) {
                        rawData = exchange.getRequestURI().getQuery();
                    }

                    Map<String, String> parsedParams = parseParams(rawData);
                    ResponseData response = processCalculation(parsedParams, startTime);

                    byte[] responseBytes = response.jsonBody.getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
                    exchange.sendResponseHeaders(response.statusCode, responseBytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(responseBytes);
                    }
                    exchange.close();
                }
            });

            // обработчик клиента
            // если запрошен / то открывает индекс
            httpServer.createContext("/", new HttpHandler() {
                @Override
                public void handle(HttpExchange exchange) throws IOException {
                    String path = exchange.getRequestURI().getPath();
                    if (path == null || path.equals("/") || path.isEmpty()) {
                        path = "/index.html";
                    }

                    Path clientDir = findClientDirectory();
                    Path filePath = clientDir.resolve(path.startsWith("/") ? path.substring(1) : path).normalize();
                    // гарантирует, что запрос с ../ не позволит злоумышленнику прочитать
                    // произвольные системные файлы за пределами каталога клиента
                    if (!filePath.startsWith(clientDir) || !Files.exists(filePath) || Files.isDirectory(filePath)) {
                        String notFound = "404 Not Found";
                        exchange.sendResponseHeaders(404, notFound.length());
                        try (OutputStream os = exchange.getResponseBody()) {
                            os.write(notFound.getBytes(StandardCharsets.UTF_8));
                        }
                        exchange.close();
                        return;
                    }

                    String contentType = "text/plain";
                    String fileName = filePath.getFileName().toString().toLowerCase();
                    if (fileName.endsWith(".html"))
                        contentType = "text/html; charset=utf-8";
                    else if (fileName.endsWith(".css"))
                        contentType = "text/css; charset=utf-8";
                    else if (fileName.endsWith(".js"))
                        contentType = "application/javascript; charset=utf-8";
                    else if (fileName.endsWith(".png"))
                        contentType = "image/png";

                    byte[] fileBytes = Files.readAllBytes(filePath);
                    exchange.getResponseHeaders().set("Content-Type", contentType);
                    exchange.sendResponseHeaders(200, fileBytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(fileBytes);
                    }
                    exchange.close();
                }
            });

            httpServer.setExecutor(null);
            httpServer.start();
            System.err.println("Локальный HTTP сервер запущен на http://localhost:" + httpPort + "");
        } catch (BindException e) {
            // если порт занят , то тихо продолжаем в режиме фаст сиджиай
            System.err.println("Порт " + httpPort + " занят. Локальный HTTP сервер не запущен, расчет через FastCGI.");
        } catch (Exception e) {
            System.err.println("Не удалось запустить локальный HTTP сервер: " + e.getMessage());
        }
    }

    private static Path findClientDirectory() {
        Path p1 = Paths.get("client");
        if (Files.exists(p1))
            return p1.toAbsolutePath();
        Path p2 = Paths.get("../client");
        if (Files.exists(p2))
            return p2.toAbsolutePath();
        Path p3 = Paths.get("../../client");
        if (Files.exists(p3))
            return p3.toAbsolutePath();
        return Paths.get(".").toAbsolutePath();
    }

    /**
     * обработка фаст сиджиай запроса
     * Считывает метаданные запроса сиджиай из FCGIInterface.request.params.
     * извлекает метод запроса REQUEST_METHOD.
     */
    private static void processFastCgiRequest(long startTime) throws IOException {
        Properties params = (FCGIInterface.request != null && FCGIInterface.request.params != null)
                ? FCGIInterface.request.params
                : new Properties();

        if (params.isEmpty()) {
            for (Map.Entry<String, String> entry : System.getenv().entrySet()) {
                params.setProperty(entry.getKey(), entry.getValue());
            }
        }

        String requestMethod = params.getProperty("REQUEST_METHOD", "GET").toUpperCase();

        if ("OPTIONS".equals(requestMethod)) {
            sendFastCgiResponse("200 OK", "{}");
            return;
        }

        String rawData = "";
        if ("POST".equalsIgnoreCase(requestMethod)) {
            String lenHeader = params.getProperty("CONTENT_LENGTH");
            int contentLength = 0;
            if (lenHeader != null && !lenHeader.trim().isEmpty()) {
                try {
                    contentLength = Integer.parseInt(lenHeader.trim());
                } catch (NumberFormatException ignored) {
                }
            }

            if (contentLength > 0) {
                byte[] buffer = new byte[contentLength];
                int read = 0;
                while (read < contentLength) {
                    int r = System.in.read(buffer, read, contentLength - read);
                    if (r == -1)
                        break;
                    read += r;
                }
                rawData = new String(buffer, 0, read, StandardCharsets.UTF_8);
            }
        }

        if (rawData.isEmpty()) {
            rawData = params.getProperty("QUERY_STRING", "");
        }

        Map<String, String> parsedParams = parseParams(rawData);
        ResponseData response = processCalculation(parsedParams, startTime);
        sendFastCgiResponse(response.statusText, response.jsonBody);
    }

    /**
     * единая логика валидации и проверки попадания точки для фаст сиджиай и
     * локального
     * хттп
     */
    public static ResponseData processCalculation(Map<String, String> parsedParams, long startTime) {
        String action = parsedParams.get("action");
        if (action == null && parsedParams.containsKey("get_history")) {
            action = "history";
        }

        // запрос истории точек с сервера
        if ("history".equalsIgnoreCase(action) || "get_history".equalsIgnoreCase(action)
                || "get".equalsIgnoreCase(action)) {
            String json = "{\"valid\":true,\"action\":\"history\",\"points\":" + historyToJson() + "}";
            return new ResponseData(200, "200 OK", json);
        }

        // очистка истории точек на сервере
        if ("clear".equalsIgnoreCase(action)) {
            synchronized (Server.class) {
                HISTORY.clear();
                saveHistoryToFile();
            }
            String json = "{\"valid\":true,\"action\":\"clear\",\"cleared\":true,\"points\":[]}";
            return new ResponseData(200, "200 OK", json);
        }

        String xStr = parsedParams.get("x");
        String yStr = parsedParams.get("y");
        String rStr = parsedParams.get("r");

        if (xStr == null || yStr == null || rStr == null) {
            return new ResponseData(400, "400 Bad Request",
                    "{\"valid\":false,\"error\":\"Параметры x, y и r обязательны!\"}");
        }

        double x;
        double y;
        double r;

        try {
            x = Double.parseDouble(xStr.trim().replace(',', '.'));
            y = Double.parseDouble(yStr.trim().replace(',', '.'));
            r = Double.parseDouble(rStr.trim().replace(',', '.'));
        } catch (NumberFormatException e) {
            return new ResponseData(400, "400 Bad Request",
                    "{\"valid\":false,\"error\":\"Некорректный числовой формат параметров!\"}");
        }

        boolean xMatches = false;
        for (Double vx : VALID_X) {
            if (Math.abs(vx - x) < EPSILON) {
                xMatches = true;
                break;
            }
        }

        boolean rMatches = false;
        for (Double vr : VALID_R) {
            if (Math.abs(vr - r) < EPSILON) {
                rMatches = true;
                break;
            }
        }

        boolean yMatches = (y > -3.0 && y < 3.0);
        // обработка точки с канвас
        String fromCanvas = parsedParams.get("fromCanvas");
        boolean isCanvasClick = (fromCanvas != null
                && (fromCanvas.equalsIgnoreCase("true") || fromCanvas.startsWith("tru") || fromCanvas.equals("1")));

        if (!rMatches) {
            return new ResponseData(400, "400 Bad Request",
                    "{\"valid\":false,\"error\":\"R должен быть выбран из {1, 1.5, 2, 2.5, 3}!\"}");
        }

        if (!yMatches) {
            return new ResponseData(400, "400 Bad Request",
                    "{\"valid\":false,\"error\":\"Y должен быть в интервале (-3 ... 3)!\"}");
        }

        if (isCanvasClick) {
            if (x < -4.0 || x > 4.0) {
                return new ResponseData(400, "400 Bad Request",
                        "{\"valid\":false,\"error\":\"Координата X клика выходит за пределы [-4, 4]!\"}");
            }
        } else if (!xMatches) {
            return new ResponseData(400, "400 Bad Request",
                    "{\"valid\":false,\"error\":\"X должен быть выбран из {-4, -3, -2, -1, 0, 1, 2, 3, 4}!\"}");
        }

        boolean hit = checkHit(x, y, r);

        long endTime = System.nanoTime();
        double executionTimeMs = (endTime - startTime) / 1_000_000.0;
        String executionTimeStr = String.format(Locale.US, "%.3f мс", executionTimeMs);
        String currentTimeStr = TIME_FORMATTER.format(Instant.now()) + " (Европа/Москва)";

        // сохраняем результат в хранилище истории на сервере
        PointRecord record = new PointRecord(x, y, r, hit, executionTimeStr, currentTimeStr);
        synchronized (Server.class) {
            HISTORY.add(record);
            saveHistoryToFile();
        }

        String json = String.format(Locale.US,
                "{\"valid\":true,\"x\":%.3f,\"y\":%.3f,\"r\":%.1f,\"hit\":%b,\"executionTime\":\"%s\",\"currentTime\":\"%s\",\"points\":%s}",
                x, y, r, hit, executionTimeStr, currentTimeStr, historyToJson());

        return new ResponseData(200, "200 OK", json);
    }

    /**
     * - Q1 (x >= 0, y >= 0): Kubic [0, R] x [0, R/2]
     * - Q2 (x <= 0, y >= 0): Treugolnic (-R, 0), (0, 0), (0, R/2) -> y <= 0.5 * x +
     * 0.5 * R
     * - Q3 (x <= 0, y <= 0): Void
     * - Q4 (x >= 0, y <= 0): Crujok R/2 -> x^2 + y^2 <= (R/2)^2
     */
    public static boolean checkHit(double x, double y, double r) {

        if (x >= 0 && y >= 0) {
            return (x <= r) && (y <= (r / 2.0));
        }

        if (x <= 0 && y >= 0) {
            return (x >= -r) && (y <= (0.5 * x + 0.5 * r));
        }

        if (x >= 0 && y <= 0) {
            return (x * x + y * y) <= ((r / 2.0) * (r / 2.0));
        }

        return false;
    }

    private static Map<String, String> parseParams(String data) {
        Map<String, String> result = new HashMap<>();
        if (data == null || data.trim().isEmpty()) {
            return result;
        }

        String trimmed = data.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            String content = trimmed.substring(1, trimmed.length() - 1);
            String[] pairs = content.split(",");
            for (String pair : pairs) {
                String[] kv = pair.split(":", 2);
                if (kv.length == 2) {
                    String key = kv[0].trim().replace("\"", "");
                    String val = kv[1].trim().replace("\"", "");
                    result.put(key, val);
                }
            }
            return result;
        }

        String[] pairs = trimmed.split("&");
        for (String pair : pairs) {
            String[] kv = pair.split("=", 2);
            if (kv.length == 2) {
                try {
                    String k = java.net.URLDecoder.decode(kv[0].trim(), StandardCharsets.UTF_8);
                    String v = java.net.URLDecoder.decode(kv[1].trim(), StandardCharsets.UTF_8);
                    result.put(k, v);
                } catch (Exception ignored) {
                    result.put(kv[0].trim(), kv[1].trim());
                }
            }
        }
        return result;
    }

    // вовращает ответ через поток вывода сис аут, формирует заголовки, отправляет
    // тело джсон, сбрасывает буфер в сокет фастсиджиай
    private static void sendFastCgiResponse(String status, String jsonBody) {
        byte[] bytes = jsonBody.getBytes(StandardCharsets.UTF_8);
        String response = "Status: " + status + "\r\n" +
                "Content-Type: application/json; charset=utf-8\r\n" +
                "Content-Length: " + bytes.length + "\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" +
                "Access-Control-Allow-Headers: Content-Type\r\n" +
                "\r\n" +
                jsonBody;

        System.out.print(response);
        System.out.flush();
    }

    private static String escapeJson(String s) {
        if (s == null)
            return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
