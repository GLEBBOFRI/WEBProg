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

/*
 * сервлет проверки области: обсчитывает попадание точки и генерит ответ в jsp или json
 */
@WebServlet(name = "AreaCheckServlet", urlPatterns = {"/check"})
public class AreaCheckServlet extends HttpServlet {
    // допустимые значения x для формы из чекбоксов
    private static final Set<Double> VALID_X = Set.of(-4.0, -3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0, 4.0);
    // допустимые значения r из селекта
    private static final Set<Double> VALID_R = Set.of(1.0, 2.0, 3.0, 4.0, 5.0);
    // погрешность для сравнения дробных чисел
    private static final double EPSILON = 1e-7;

    // формат даты и времени по москве
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

    // общая логика проверки точки и формирования страницы/ответа
    private void processRequest(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        // засекаем наносекунды для замера времени выполнения сервлета
        long startTime = System.nanoTime();

        request.setCharacterEncoding("UTF-8");
        response.setCharacterEncoding("UTF-8");

        // чекаем если сервлет дернули напрямую мимо контроллера — отфутболиваем на контроллер
        String forwardUri = (String) request.getAttribute("jakarta.servlet.forward.request_uri");
        if (forwardUri == null) {
            forwardUri = (String) request.getAttribute("javax.servlet.forward.request_uri");
        }
        String xStr = request.getParameter("x");
        String yStr = request.getParameter("y");
        String rStr = request.getParameter("r");

        if (forwardUri == null && (xStr == null || yStr == null || rStr == null)) {
            response.sendRedirect(request.getContextPath() + "/controller");
            return;
        }

        // проверяем аякс это или отправка через обычную веб-форму
        boolean isAjax = "true".equalsIgnoreCase(request.getParameter("ajax")) ||
                "XMLHttpRequest".equals(request.getHeader("X-Requested-With"));

        boolean fromCanvas = "true".equalsIgnoreCase(request.getParameter("fromCanvas"));

        if (xStr == null || yStr == null || rStr == null) {
            handleError(request, response, "Не переданы обязательные параметры X, Y или R!", isAjax);
            return;
        }

        double x;
        double y;
        double r;

        // парсим числа, заменяя запятые на точки на всякий случай
        try {
            x = Double.parseDouble(xStr.trim().replace(',', '.'));
            y = Double.parseDouble(yStr.trim().replace(',', '.'));
            r = Double.parseDouble(rStr.trim().replace(',', '.'));
        } catch (Exception e) {
            handleError(request, response, "Некорректный числовой формат параметров X, Y или R!", isAjax);
            return;
        }

        // 1. валидируем радиус r по списку {1, 2, 3, 4, 5}
        boolean rValid = false;
        for (Double vr : VALID_R) {
            if (Math.abs(vr - r) < EPSILON) {
                rValid = true;
                break;
            }
        }
        if (!rValid) {
            handleError(request, response, "Радиус R должен быть строго из списка {1, 2, 3, 4, 5}!", isAjax);
            return;
        }

        // 2. валидируем y: строго открытый интервал (-5 ... 3), границы не берем
        if (!(y > -5.0 && y < 3.0)) {
            handleError(request, response, "Координата Y должна быть строго в интервале (-5 ... 3)!", isAjax);
            return;
        }

        // 3. валидируем x: для кликов с канваса диапазон [-4, 4], для формы строго чекбоксы
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
                handleError(request, response, "Координата X должна быть выбрана из чекбоксов {-4, -3, -2, -1, 0, 1, 2, 3, 4}!", isAjax);
                return;
            }
        }

        // 4. считаем геометрическое попадание точки в область
        boolean hit = checkAreaHit(x, y, r);

        // 5. замеряем время работы сервлета и текущий таймштамп
        long endTime = System.nanoTime();
        double executionTimeMs = (endTime - startTime) / 1_000_000.0;
        String executionTimeStr = String.format(Locale.US, "%.3f мс", executionTimeMs);
        String currentTimeStr = TIME_FORMATTER.format(Instant.now()) + " (МСК)";

        PointResult pointResult = new PointResult(x, y, r, hit, currentTimeStr, executionTimeStr, fromCanvas);

        // 6. пушим свежий результат в сессионную бинку
        HttpSession session = request.getSession();
        ResultsBean resultsBean = (ResultsBean) session.getAttribute("resultsBean");
        if (resultsBean == null) {
            resultsBean = new ResultsBean();
            session.setAttribute("resultsBean", resultsBean);
        }
        resultsBean.addResult(pointResult);

        // 7. отдаем ответ клиенту
        if (isAjax) {
            // для канваса отдаем компактный json
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
            // для веб-формы форвардим на jsp страницу с результатами
            request.setAttribute("result", pointResult);
            request.getRequestDispatcher("/result.jsp").forward(request, response);
        }
    }

    /*
     * математика попадания точки в область по четвертям:
     * - 1 четверть (x >= 0, y >= 0): прямоугольник шириной R и высотой R/2 -> [0, R] x [0, R/2]
     * - 2 четверть (x <= 0, y >= 0): прямоугольный треугольник -> y <= 2*x + R
     * - 3 четверть (x <= 0, y <= 0): пусто (точек нет)
     * - 4 четверть (x >= 0, y <= 0): четверть круга радиуса R -> x^2 + y^2 <= R^2
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

        // 4 четверть: сектор круга радиуса r
        if (x >= 0 && y <= 0) {
            return (x * x + y * y) <= (r * r);
        }

        // 3 четверть: глухо, сюда ничего не попадает
        return false;
    }

    // хэндлер ошибок валидации
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
