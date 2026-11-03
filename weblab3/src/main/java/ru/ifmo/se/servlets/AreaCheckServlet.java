package ru.ifmo.se.servlets;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import com.google.gson.Gson;
import ru.ifmo.se.model.PointResult;
import ru.ifmo.se.model.ResultsBean;

import java.io.IOException;
import java.io.PrintWriter;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * AreaCheckServlet - сервлет проверки попадания точки в заданную область.
 * Обрабатывает запросы, содержащие сведения о координатах точки и радиусе области.
 * Формирует HTML-страницу с результатами проверки (result.jsp) или JSON при AJAX-запросах.
 */
@WebServlet(name = "AreaCheckServlet", urlPatterns = {"/check"})
public class AreaCheckServlet extends HttpServlet {
    private static final Set<Double> VALID_X = Set.of(-4.0, -3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0, 4.0);
    private static final Set<Double> VALID_R = Set.of(1.0, 2.0, 3.0, 4.0, 5.0);
    private static final double EPSILON = 1e-7;

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

    private void processRequest(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        long startTime = System.nanoTime();

        request.setCharacterEncoding("UTF-8");
        response.setCharacterEncoding("UTF-8");

        boolean isAjax = "true".equalsIgnoreCase(request.getParameter("ajax")) ||
                "XMLHttpRequest".equals(request.getHeader("X-Requested-With"));

        String xStr = request.getParameter("x");
        String yStr = request.getParameter("y");
        String rStr = request.getParameter("r");
        boolean fromCanvas = "true".equalsIgnoreCase(request.getParameter("fromCanvas"));

        if (xStr == null || yStr == null || rStr == null) {
            // Если параметров нет, перенаправляем на ControllerServlet
            response.sendRedirect(request.getContextPath() + "/controller");
            return;
        }

        double x;
        double y;
        double r;

        try {
            x = Double.parseDouble(xStr.trim().replace(',', '.'));
            y = Double.parseDouble(yStr.trim().replace(',', '.'));
            r = Double.parseDouble(rStr.trim().replace(',', '.'));
        } catch (Exception e) {
            handleError(request, response, "Некорректный числовой формат параметров X, Y или R!", isAjax);
            return;
        }

        // 1. Валидация R: Select {'1', '2', '3', '4', '5'}
        boolean rValid = false;
        for (Double vr : VALID_R) {
            if (Math.abs(vr - r) < EPSILON) {
                rValid = true;
                break;
            }
        }
        if (!rValid) {
            handleError(request, response, "Радиус R должен быть выбран из {1, 2, 3, 4, 5}!", isAjax);
            return;
        }

        // 2. Валидация Y: Text (-5 ... 3) строго (не включая границы!)
        if (!(y > -5.0 && y < 3.0)) {
            handleError(request, response, "Координата Y должна быть строго в интервале (-5 ... 3)!", isAjax);
            return;
        }

        // 3. Валидация X: Checkbox {'-4', '-3', '-2', '-1', '0', '1', '2', '3', '4'}
        if (fromCanvas) {
            if (x < -4.0 || x > 4.0) {
                handleError(request, response, "Координата X клика выходит за допустимый диапазон [-4, 4]!", isAjax);
                return;
            }
        } else {
            boolean xValid = false;
            for (Double vx : VALID_X) {
                if (Math.abs(vx - x) < EPSILON) {
                    xValid = true;
                    break;
                }
            }
            if (!xValid) {
                handleError(request, response, "Координата X должна быть выбрана из {-4, -3, -2, -1, 0, 1, 2, 3, 4}!", isAjax);
                return;
            }
        }

        // 4. Проверка попадания в область
        boolean hit = checkAreaHit(x, y, r);

        // 5. Замер времени выполнения и текущее время
        long endTime = System.nanoTime();
        double executionTimeMs = (endTime - startTime) / 1_000_000.0;
        String executionTimeStr = String.format(Locale.US, "%.3f мс", executionTimeMs);
        String currentTimeStr = TIME_FORMATTER.format(Instant.now()) + " (МСК)";

        PointResult pointResult = new PointResult(x, y, r, hit, currentTimeStr, executionTimeStr, fromCanvas);

        // 6. Сохранение в JavaBean сессии
        HttpSession session = request.getSession();
        ResultsBean resultsBean = (ResultsBean) session.getAttribute("resultsBean");
        if (resultsBean == null) {
            resultsBean = new ResultsBean();
            session.setAttribute("resultsBean", resultsBean);
        }
        resultsBean.addResult(pointResult);

        // 7. Формирование ответа
        if (isAjax) {
            response.setContentType("application/json; charset=UTF-8");
            Map<String, Object> jsonMap = new HashMap<>();
            jsonMap.put("valid", true);
            jsonMap.put("x", pointResult.getX());
            jsonMap.put("y", pointResult.getY());
            jsonMap.put("r", pointResult.getR());
            jsonMap.put("hit", pointResult.isHit());
            jsonMap.put("currentTime", pointResult.getCurrentTime());
            jsonMap.put("executionTime", pointResult.getExecutionTime());
            jsonMap.put("fromCanvas", pointResult.isFromCanvas());

            try (PrintWriter out = response.getWriter()) {
                out.write(gson.toJson(jsonMap));
            }
        } else {
            // Формирование HTML-страницы с результатами (по ТЗ: страница, возвращаемая AreaCheckServlet)
            request.setAttribute("result", pointResult);
            request.getRequestDispatcher("/result.jsp").forward(request, response);
        }
    }

    /**
     * Геометрическая проверка попадания точки в заданную область:
     * - 1 четверть (x >= 0, y >= 0): Прямоугольник шириной R и высотой R/2: [0, R] x [0, R/2]
     * - 2 четверть (x <= 0, y >= 0): Треугольник с вершинами (0, 0), (-R/2, 0), (0, R) -> y <= 2*x + R
     * - 3 четверть (x <= 0, y <= 0): Пусто (точки не попадают)
     * - 4 четверть (x >= 0, y <= 0): Четверть круга радиуса R -> x^2 + y^2 <= R^2
     */
    public static boolean checkAreaHit(double x, double y, double r) {
        // 1 четверть: прямоугольник
        if (x >= 0 && y >= 0) {
            return (x <= r) && (y <= (r / 2.0));
        }

        // 2 четверть: треугольник
        if (x <= 0 && y >= 0) {
            return (x >= -r / 2.0) && (y <= (2.0 * x + r));
        }

        // 4 четверть: четверть круга радиуса R
        if (x >= 0 && y <= 0) {
            return (x * x + y * y) <= (r * r);
        }

        // 3 четверть: пусто
        return false;
    }

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
