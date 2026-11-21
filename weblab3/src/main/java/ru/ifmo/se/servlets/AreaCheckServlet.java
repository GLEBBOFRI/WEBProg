package ru.ifmo.se.servlets;

import com.google.gson.Gson;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import ru.ifmo.se.config.AppConfig;
import ru.ifmo.se.filters.RequestStatsFilter;
import ru.ifmo.se.model.PointResult;
import ru.ifmo.se.model.RequestStats;
import ru.ifmo.se.model.ResultsBean;

import java.io.IOException;
import java.io.PrintWriter;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/*
 * сервлет проверки области: валидирует координаты по конфигу, считает попадание для всех выбранных x и пушит в сессию
 */
@WebServlet(name = "AreaCheckServlet", urlPatterns = {"/check"})
public class AreaCheckServlet extends HttpServlet {
    private static final DateTimeFormatter TIME_FORMATTER =
            DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm:ss").withZone(ZoneId.of("Europe/Moscow"));

    private final Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        processRequest(request, response);
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        processRequest(request, response);
    }

    // общая логика проверки точки и расчета попадания
    private void processRequest(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        // засекаем наносекунды для замера времени выполнения работы сервлета
        long startTime = System.nanoTime();

        // чекаем если сервлет дернули напрямую мимо контроллера — отфутболиваем на контроллер
        String forwardUri = (String) request.getAttribute("jakarta.servlet.forward.request_uri");
        if (forwardUri == null) {
            forwardUri = (String) request.getAttribute("javax.servlet.forward.request_uri");
        }

        String[] xValues = request.getParameterValues("x");
        String yStr = request.getParameter("y");
        String rStr = request.getParameter("r");

        if (forwardUri == null && (xValues == null || yStr == null || rStr == null)) {
            response.sendRedirect(request.getContextPath() + "/controller");
            return;
        }

        boolean isAjax = "true".equalsIgnoreCase(request.getParameter("ajax")) ||
                "XMLHttpRequest".equals(request.getHeader("X-Requested-With"));
        boolean fromCanvas = "true".equalsIgnoreCase(request.getParameter("fromCanvas"));

        if (xValues == null || xValues.length == 0 || yStr == null || rStr == null) {
            handleError(request, response, "Не переданы обязательные параметры X, Y или R!", isAjax);
            return;
        }

        // 1. валидируем радиус r по допустимым значениям из конфига (без магических чисел)
        double r;
        try {
            r = Double.parseDouble(rStr.trim().replace(',', '.'));
        } catch (Exception e) {
            handleError(request, response, "Некорректный числовой формат радиуса R!", isAjax);
            return;
        }

        boolean rValid = false;
        for (Double vr : AppConfig.VALID_R) {
            if (Math.abs(vr - r) < AppConfig.EPSILON) {
                rValid = true;
                break;
            }
        }
        if (!rValid) {
            handleError(request, response, "Радиус R должен быть строго из списка допустимых значений: " + AppConfig.VALID_R, isAjax);
            return;
        }

        // 2. валидируем координату y по интервалу (minY ... maxY) из конфига
        double y;
        try {
            y = Double.parseDouble(yStr.trim().replace(',', '.'));
        } catch (Exception e) {
            handleError(request, response, "Некорректный числовой формат координаты Y!", isAjax);
            return;
        }

        if (!(y > AppConfig.MIN_Y && y < AppConfig.MAX_Y)) {
            handleError(request, response, String.format(Locale.US, "Координата Y должна быть строго в интервале (%.1f ... %.1f)!", AppConfig.MIN_Y, AppConfig.MAX_Y), isAjax);
            return;
        }

        // 3. парсим и валидируем все выбранные значения x (мультивыбор чекбоксов)
        List<Double> parsedXList = new ArrayList<>();
        for (String rawX : xValues) {
            if (rawX == null || rawX.trim().isEmpty()) continue;
            double parsedX;
            try {
                parsedX = Double.parseDouble(rawX.trim().replace(',', '.'));
            } catch (Exception e) {
                handleError(request, response, "Некорректный формат одного из значений координаты X: " + rawX, isAjax);
                return;
            }

            if (fromCanvas) {
                // для клика с холста проверяем границы канваса из конфига
                if (parsedX < AppConfig.CANVAS_MIN_X || parsedX > AppConfig.CANVAS_MAX_X) {
                    handleError(request, response, String.format(Locale.US, "Координата X клика выходит за допустимые границы [%.1f, %.1f]!", AppConfig.CANVAS_MIN_X, AppConfig.CANVAS_MAX_X), isAjax);
                    return;
                }
            } else {
                // для формы строго сверяем со списком допустимых чекбоксов
                boolean xValid = false;
                for (Double vx : AppConfig.VALID_X) {
                    if (Math.abs(vx - parsedX) < AppConfig.EPSILON) {
                        xValid = true;
                        break;
                    }
                }
                if (!xValid) {
                    handleError(request, response, "Выбрано недопустимое значение координаты X: " + parsedX, isAjax);
                    return;
                }
            }
            parsedXList.add(parsedX);
        }

        if (parsedXList.isEmpty()) {
            handleError(request, response, "Не выбрано ни одно значение координаты X!", isAjax);
            return;
        }

        // 4. получаем сессионную бинку и серверную статку из ServletContext
        HttpSession session = request.getSession();
        ResultsBean resultsBean = (ResultsBean) session.getAttribute("resultsBean");
        if (resultsBean == null) {
            resultsBean = new ResultsBean();
            session.setAttribute("resultsBean", resultsBean);
        }

        RequestStats stats = (RequestStats) getServletContext().getAttribute(RequestStatsFilter.STATS_ATTR);

        // 5. рассчитываем попадание для КАЖДОГО выбранного x и сохраняем результаты
        List<PointResult> addedPoints = new ArrayList<>();
        long endTime = System.nanoTime();
        double executionTimeMs = (endTime - startTime) / 1_000_000.0;
        String executionTimeStr = String.format(Locale.US, "%.3f мс", executionTimeMs);
        String currentTimeStr = TIME_FORMATTER.format(Instant.now()) + " (МСК)";

        for (Double x : parsedXList) {
            boolean hit = checkAreaHit(x, y, r);
            if (stats != null) {
                stats.recordPointCheck(hit);
            }

            PointResult pointResult = PointResult.builder()
                    .x(x)
                    .y(y)
                    .r(r)
                    .hit(hit)
                    .currentTime(currentTimeStr)
                    .executionTime(executionTimeStr)
                    .fromCanvas(fromCanvas)
                    .build();

            // 6. пушим в синхронизированную бинку
            resultsBean.addResult(pointResult);
            addedPoints.add(pointResult);
        }

        // 7. переписанная седьмая часть: никакой отдельной страницы результатов, все остается на index.jsp
        if (isAjax) {
            // для аякса отдаем полный список созданных точек в json
            response.setContentType("application/json; charset=UTF-8");
            Map<String, Object> jsonMap = new HashMap<>();
            jsonMap.put("valid", true);
            jsonMap.put("points", addedPoints);
            // дублируем первую точку для обратной совместимости старых хэндлеров
            if (!addedPoints.isEmpty()) {
                PointResult first = addedPoints.get(0);
                jsonMap.put("x", first.getX());
                jsonMap.put("y", first.getY());
                jsonMap.put("r", first.getR());
                jsonMap.put("hit", first.isHit());
                jsonMap.put("currentTime", first.getCurrentTime());
                jsonMap.put("executionTime", first.getExecutionTime());
                jsonMap.put("fromCanvas", first.isFromCanvas());
            }

            try (PrintWriter out = response.getWriter()) {
                out.write(gson.toJson(jsonMap));
            }
        } else {
            // для обычной веб-формы форвардим сразу обратно на index.jsp (таблица рисуется через c:forEach)
            request.getRequestDispatcher("/index.jsp").forward(request, response);
        }
    }

    /*
     * геометрическая проверка попадания точки в область:
     * - 1 четверть (x >= 0, y >= 0): прямоугольник [0, R] на [0, R/2]
     * - 2 четверть (x <= 0, y >= 0): треугольник от (-R/2, 0) до (0, R) -> y <= 2*x + R
     * - 3 четверть (x <= 0, y <= 0): мимо (область пустая)
     * - 4 четверть (x >= 0, y <= 0): сектор круга радиуса R -> x^2 + y^2 <= R^2
     */
    public static boolean checkAreaHit(double x, double y, double r) {
        if (x >= 0 && y >= 0) {
            return (x <= r) && (y <= (r / 2.0));
        }
        if (x <= 0 && y >= 0) {
            return (x >= -r / 2.0) && (y <= (2.0 * x + r));
        }
        if (x >= 0 && y <= 0) {
            return (x * x + y * y) <= (r * r);
        }
        return false;
    }

    // хэндлер ошибок с возвратом на index.jsp
    private void handleError(HttpServletRequest request, HttpServletResponse response, String message, boolean isAjax)
            throws ServletException, IOException {
        if (isAjax) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json; charset=UTF-8");
            Map<String, Object> err = new HashMap<>();
            err.put("valid", false);
            err.put("error", message);
            try (PrintWriter out = response.getWriter()) {
                out.write(gson.toJson(err));
            }
        } else {
            request.setAttribute("errorMessage", message);
            request.getRequestDispatcher("/index.jsp").forward(request, response);
        }
    }
}
