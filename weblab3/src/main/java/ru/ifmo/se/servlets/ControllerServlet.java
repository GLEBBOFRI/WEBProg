package ru.ifmo.se.servlets;

import com.google.gson.Gson;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import ru.ifmo.se.dto.ClearResponseDto;
import ru.ifmo.se.dto.HistoryResponseDto;
import ru.ifmo.se.dto.StatsResponseDto;
import ru.ifmo.se.filters.RequestStatsFilter;
import ru.ifmo.se.model.RequestStats;
import ru.ifmo.se.model.ResultsBean;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.Collections;

/*
 * контроллер-диспетчер (mvc): распределяет запросы между проверкой точки, выдачей статы и отображением страницы
 */
@WebServlet(name = "ControllerServlet", urlPatterns = {"/controller", "/controller/*"})
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
                ClearResponseDto clearDto = ClearResponseDto.builder()
                        .success(true)
                        .cleared(true)
                        .build();
                try (PrintWriter out = response.getWriter()) {
                    out.write(gson.toJson(clearDto));
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
            StatsResponseDto statsDto = StatsResponseDto.builder()
                    .totalRequests(stats.getTotalRequests().get())
                    .getRequests(stats.getGetRequests().get())
                    .postRequests(stats.getPostRequests().get())
                    .pointChecks(stats.getPointChecks().get())
                    .hits(stats.getHits().get())
                    .misses(stats.getMisses().get())
                    .uptime(stats.getUptime())
                    .lastRequestTime(stats.getLastRequestTime())
                    .build();

            try (PrintWriter out = response.getWriter()) {
                out.write(gson.toJson(statsDto));
            }
            return;
        }

        // 3. если клиент запрашивает сохраненную историю точек в json
        if ("history".equalsIgnoreCase(action)) {
            HttpSession session = request.getSession();
            ResultsBean bean = (ResultsBean) session.getAttribute("resultsBean");
            response.setContentType("application/json; charset=UTF-8");
            HistoryResponseDto historyDto = HistoryResponseDto.builder()
                    .points(bean != null ? bean.getResults() : Collections.emptyList())
                    .build();
            try (PrintWriter out = response.getWriter()) {
                out.write(gson.toJson(historyDto));
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
