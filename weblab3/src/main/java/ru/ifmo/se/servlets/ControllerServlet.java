package ru.ifmo.se.servlets;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import com.google.gson.Gson;
import ru.ifmo.se.model.ResultsBean;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.HashMap;
import java.util.Map;

/**
 * ControllerServlet - главный диспетчер запросов приложения в архитектуре MVC.
 * Определяет тип запроса и делегирует обработку:
 *  - AreaCheckServlet: если запрос содержит координаты точки и радиус;
 *  - index.jsp: если запрос не содержит сведений о координатах и радиусе.
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

    private void processRequest(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        request.setCharacterEncoding("UTF-8");
        response.setCharacterEncoding("UTF-8");

        String action = request.getParameter("action");
        String clear = request.getParameter("clear");

        // Обработка очистки истории
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

        // Запрос истории в формате JSON
        if ("history".equalsIgnoreCase(action)) {
            HttpSession session = request.getSession();
            ResultsBean bean = (ResultsBean) session.getAttribute("resultsBean");
            response.setContentType("application/json; charset=UTF-8");
            Map<String, Object> res = new HashMap<>();
            res.put("points", bean != null ? bean.getResults() : java.util.Collections.emptyList());
            try (PrintWriter out = response.getWriter()) {
                out.write(gson.toJson(res));
            }
            return;
        }

        String xParam = request.getParameter("x");
        String yParam = request.getParameter("y");
        String rParam = request.getParameter("r");

        // Если запрос содержит информацию о координатах точки и радиусе области
        if (xParam != null && yParam != null && rParam != null &&
                !xParam.trim().isEmpty() && !yParam.trim().isEmpty() && !rParam.trim().isEmpty()) {
            request.getRequestDispatcher("/check").forward(request, response);
        } else {
            // Если запрос не содержит сведений о координатах и радиусе -> делегируем index.jsp
            request.getRequestDispatcher("/index.jsp").forward(request, response);
        }
    }
}
