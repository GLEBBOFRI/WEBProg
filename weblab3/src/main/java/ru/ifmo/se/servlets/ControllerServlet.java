package ru.ifmo.se.servlets;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import ru.ifmo.se.model.ResultsBean;

import java.io.IOException;

/**
 * ControllerServlet - главный диспетчер запросов приложения в архитектуре MVC.
 * Определяет наличие параметров x, y, r и делегирует обработку:
 *  - AreaCheckServlet - если переданы координаты и радиус;
 *  - index.jsp - если параметров нет или требуется отображение формы.
 */
@WebServlet(name = "ControllerServlet", urlPatterns = {"/controller", ""})
public class ControllerServlet extends HttpServlet {

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

        // Обработка очистки истории (если передан параметр clear)
        String clearParam = request.getParameter("clear");
        if ("true".equalsIgnoreCase(clearParam)) {
            ResultsBean bean = (ResultsBean) request.getSession().getAttribute("resultsBean");
            if (bean != null) {
                bean.clear();
            }
            if ("XMLHttpRequest".equals(request.getHeader("X-Requested-With")) ||
                    "true".equalsIgnoreCase(request.getParameter("ajax"))) {
                response.setContentType("application/json; charset=UTF-8");
                response.getWriter().write("{\"success\":true,\"cleared\":true}");
                return;
            }
            response.sendRedirect(request.getContextPath() + "/controller");
            return;
        }

        String xParam = request.getParameter("x");
        String yParam = request.getParameter("y");
        String rParam = request.getParameter("r");

        // Если переданы параметры координат и радиуса -> делегируем проверку AreaCheckServlet
        if (xParam != null && yParam != null && rParam != null &&
                !xParam.trim().isEmpty() && !yParam.trim().isEmpty() && !rParam.trim().isEmpty()) {
            request.getRequestDispatcher("/area-check").forward(request, response);
        } else {
            // Если параметров нет -> передаем управление на страницу index.jsp с формой
            request.getRequestDispatcher("/index.jsp").forward(request, response);
        }
    }
}
