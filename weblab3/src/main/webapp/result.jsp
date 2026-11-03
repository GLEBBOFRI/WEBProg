<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="ru.ifmo.se.model.PointResult" %>
<%
    PointResult result = (PointResult) request.getAttribute("result");
    if (result == null) {
        response.sendRedirect(request.getContextPath() + "/controller");
        return;
    }
%>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Результат проверки точки | AreaCheckServlet</title>
    <link rel="stylesheet" href="${pageContext.request.contextPath}/css/styles.css">
</head>
<body>

<div class="result-card">
    <div id="header" style="margin-bottom: 20px;">
        <b>Результат вычислений AreaCheckServlet</b>
    </div>

    <!-- Результат вычислений — факт попадания или непопадания -->
    <div class="result-status <%= result.isHit() ? "hit" : "miss" %>">
        <%= result.isHit() ? "✓ Точка попала в область (Попал)" : "✗ Точка не попала в область (Мимо)" %>
    </div>

    <!-- Таблица, содержащая полученные параметры -->
    <table border="1" style="width: 100%; border-collapse: collapse; margin-top: 15px; text-align: left;">
        <tr>
            <th style="padding: 10px; width: 45%;">Параметр</th>
            <th style="padding: 10px; width: 55%;">Полученное значение</th>
        </tr>
        <tr>
            <td style="padding: 10px;">Координата X</td>
            <td style="padding: 10px;"><b><%= String.format(java.util.Locale.US, "%.3f", result.getX()) %></b></td>
        </tr>
        <tr>
            <td style="padding: 10px;">Координата Y</td>
            <td style="padding: 10px;"><b><%= String.format(java.util.Locale.US, "%.3f", result.getY()) %></b></td>
        </tr>
        <tr>
            <td style="padding: 10px;">Радиус области R</td>
            <td style="padding: 10px;"><b><%= String.format(java.util.Locale.US, "%.1f", result.getR()) %></b></td>
        </tr>
        <tr>
            <td style="padding: 10px;">Факт попадания</td>
            <td style="padding: 10px;"><b><%= result.isHit() ? "Попадание" : "Непопадание" %></b></td>
        </tr>
        <tr>
            <td style="padding: 10px;">Время запроса</td>
            <td style="padding: 10px;"><%= result.getCurrentTime() %></td>
        </tr>
        <tr>
            <td style="padding: 10px;">Время вычислений</td>
            <td style="padding: 10px;"><%= result.getExecutionTime() %></td>
        </tr>
        <tr>
            <td style="padding: 10px;">Источник запроса</td>
            <td style="padding: 10px;"><%= result.isFromCanvas() ? "Клик по интерактивному графику" : "Веб-форма" %></td>
        </tr>
    </table>

    <!-- Ссылка на страницу с веб-формой для формирования нового запроса -->
    <div style="text-align: center; margin-top: 25px;">
        <a href="${pageContext.request.contextPath}/controller" class="back-link">
            ← Вернуться к веб-форме для нового запроса
        </a>
    </div>
</div>

</body>
</html>
