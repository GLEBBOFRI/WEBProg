package ru.ifmo.se.filters;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.FilterConfig;
import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import ru.ifmo.se.model.RequestStats;

import java.io.IOException;

/*
 * фильтр запросов: считает статистику обращений к сервлетам в ServletContext и ставит utf-8 кодировку
 */
@WebFilter(filterName = "RequestStatsFilter", urlPatterns = {"/*"})
public class RequestStatsFilter implements Filter {
    public static final String STATS_ATTR = "appStats";
    private ServletContext servletContext;

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        this.servletContext = filterConfig.getServletContext();
        if (servletContext.getAttribute(STATS_ATTR) == null) {
            servletContext.setAttribute(STATS_ATTR, new RequestStats());
        }
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        // выставляем utf-8 для всех входящих и исходящих данных
        request.setCharacterEncoding("UTF-8");
        response.setCharacterEncoding("UTF-8");

        if (request instanceof HttpServletRequest httpRequest) {
            RequestStats stats = (RequestStats) servletContext.getAttribute(STATS_ATTR);
            if (stats == null) {
                stats = new RequestStats();
                servletContext.setAttribute(STATS_ATTR, stats);
            }
            // фиксируем метод входящего запроса (get, post и тд)
            stats.recordRequest(httpRequest.getMethod());
        }

        chain.doFilter(request, response);
    }

    @Override
    public void destroy() {
    }
}
