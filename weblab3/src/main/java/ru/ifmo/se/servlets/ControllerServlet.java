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

/*
 * главный диспетчер (контроллер): разруливает куда слать запрос в зависимости от параметров
 */
@WebServlet(name = "ControllerServlet", urlPatterns = {"/controller"})
public class ControllerServlet extends HttpServlet {
    private final Gson gson = new Gson();

    // принимаем get-запросы (вход на страницу или ajax-запрос истории)
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        processRequest(request, response);
    }

    // принимаем post-запросы (отправка формы или клики с канваса)
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        processRequest(request, response);
    }

    // общая логика диспетчеризации запросов
    private void processRequest(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        // выставляем кодировку чтоб русские символы не превратились в кракозябры
        request.setCharacterEncoding("UTF-8");
        response.setCharacterEncoding("UTF-8");

        String action = request.getParameter("action");
        String clear = request.getParameter("clear");

        // если прилетел запрос на очистку истории — дропаем бинку из сессии
        if ("clear".equalsIgnoreCase(action) || "true".equalsIgnoreCase(clear)) {
            HttpSession session = request.getSession();
            ResultsBean bean = (ResultsBean) session.getAttribute("resultsBean");
            if (bean != null) {
                bean.clear();
            }
            boolean isAjax = "true".equalsIgnoreCase(request.getParameter("ajax")) ||
                    "XMLHttpRequest".equals(request.getHeader("X-Requested-With"));
            if (isAjax) {
                // для аякса отдаем короткий json что все успешно потерли
                response.setContentType("application/json; charset=UTF-8");
                Map<String, Object> res = new HashMap<>();
                res.put("success", true);
                res.put("cleared", true);
                try (PrintWriter out = response.getWriter()) {
                    out.write(gson.toJson(res));
                }
                return;
            }
            // если обычный запрос — редиректим обратно на контроллер
            response.sendRedirect(request.getContextPath() + "/controller");
            return;
        }

        // если клиент просит сохраненные точки — выплевываем историю в json
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

        // чекаем: если есть x, y и r — отправляем на сервлет проверки области
        if (xParam != null && yParam != null && rParam != null &&
                !xParam.trim().isEmpty() && !yParam.trim().isEmpty() && !rParam.trim().isEmpty()) {
            request.getRequestDispatcher("/check").forward(request, response);
        } else {
            // если координат нет — форвардим на jsp с формочкой
            request.getRequestDispatcher("/index.jsp").forward(request, response);
        }
    }
}
