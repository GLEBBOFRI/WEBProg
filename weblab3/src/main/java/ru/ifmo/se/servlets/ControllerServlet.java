package ru.ifmo.se.servlets;

import com.google.gson.Gson;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import ru.ifmo.se.filters.RequestStatsFilter;
import ru.ifmo.se.model.RequestStats;
import ru.ifmo.se.model.ResultsBean;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/*
 * контроллер-диспетчер (mvc): распределяет запросы между проверкой точки, выдачей статы и отображением страницы
 */
@WebServlet(name = "ControllerServlet", urlPatterns = {"/controller"})
public class ControllerServlet extends HttpServlet {
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

    // общая логика диспетчеризации входящих запросов
    private void processRequest(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String action = request.getParameter("action");
        String clear = request.getParameter("clear");

        // 1. если пришел запрос на очистку истории — чистим бин сессии
        if ("clear".equalsIgnoreCase(action) || "true".equalsIgnoreCase(clear)) {
            HttpSession session = request.getSession();
            ResultsBean bean = (ResultsBean) session.getAttribute("resultsBean");
            if (bean != null) {
                bean.clear();
            }
            boolean isAjax = "true".equalsIgnoreCase(request.getParameter("ajax")) ||
                    "XMLHttpRequest".equals(request.getHeader("X-Requested-With"));
            if (isAjax) {
                response.setContentType("application/json; charset=UTF-8");
                Map<String, Object> res = new HashMap<>();
                res.put("success", true);
                res.put("cleared", true);
                try (PrintWriter out = response.getWriter()) {
                    out.write(gson.toJson(res));
                }
                return;
            }
            response.sendRedirect(request.getContextPath() + "/controller");
            return;
        }

        // 2. отдаем серверную статистику запросов из ServletContext по требованию пользователя
        if ("stats".equalsIgnoreCase(action)) {
            RequestStats stats = (RequestStats) getServletContext().getAttribute(RequestStatsFilter.STATS_ATTR);
            if (stats == null) {
                stats = new RequestStats();
            }
            response.setContentType("application/json; charset=UTF-8");
            Map<String, Object> statsMap = new HashMap<>();
            statsMap.put("totalRequests", stats.getTotalRequests().get());
            statsMap.put("getRequests", stats.getGetRequests().get());
            statsMap.put("postRequests", stats.getPostRequests().get());
            statsMap.put("pointChecks", stats.getPointChecks().get());
            statsMap.put("hits", stats.getHits().get());
            statsMap.put("misses", stats.getMisses().get());
            statsMap.put("uptime", stats.getUptime());
            statsMap.put("lastRequestTime", stats.getLastRequestTime());

            try (PrintWriter out = response.getWriter()) {
                out.write(gson.toJson(statsMap));
            }
            return;
        }

        // 3. если клиент запрашивает сохраненную историю точек в json
        if ("history".equalsIgnoreCase(action)) {
            HttpSession session = request.getSession();
            ResultsBean bean = (ResultsBean) session.getAttribute("resultsBean");
            response.setContentType("application/json; charset=UTF-8");
            Map<String, Object> res = new HashMap<>();
            res.put("points", bean != null ? bean.getResults() : Collections.emptyList());
            try (PrintWriter out = response.getWriter()) {
                out.write(gson.toJson(res));
            }
            return;
        }

        String[] xValues = request.getParameterValues("x");
        String yParam = request.getParameter("y");
        String rParam = request.getParameter("r");

        // 4. если переданы x (один или несколько чекбоксов), y и r — делегируем AreaCheckServlet
        boolean hasX = xValues != null && xValues.length > 0 && !xValues[0].trim().isEmpty();
        boolean hasY = yParam != null && !yParam.trim().isEmpty();
        boolean hasR = rParam != null && !rParam.trim().isEmpty();

        if (hasX && hasY && hasR) {
            request.getRequestDispatcher("/check").forward(request, response);
        } else {
            // если координат нет — форвардим на jsp с формочкой
            request.getRequestDispatcher("/index.jsp").forward(request, response);
        }
    }
}
