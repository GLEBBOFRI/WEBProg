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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Результат проверки точки | AreaCheckServlet</title>
    <link rel="stylesheet" href="${pageContext.request.contextPath}/css/styles.css">
    <style>
        .result-box {
            text-align: center;
            padding: 30px;
            margin-bottom: 24px;
            border-radius: 12px;
        }
        .result-box.hit {
            background-color: #d1fae5;
            border: 2px solid #10b981;
            color: #065f46;
        }
        .result-box.miss {
            background-color: #fee2e2;
            border: 2px solid #ef4444;
            color: #991b1b;
        }
        .result-title {
            font-size: 28px;
            font-weight: 800;
            margin-bottom: 8px;
        }
    </style>
</head>
<body>

<div class="container" style="max-width: 800px; margin-top: 40px;">
    <header class="header-card">
        <div class="header-info">
            <h1>Результат проверки точки</h1>
            <p><strong>AreaCheckServlet:</strong> вычисление попадания в область</p>
        </div>
        <div class="header-badge">
            Лабораторная работа №3
        </div>
    </header>

    <div class="card">
        <div class="result-box <%= result.isHit() ? "hit" : "miss" %>">
            <div class="result-title">
                <%= result.isHit() ? "✓ Точка попала в область" : "✗ Точка не попала в область" %>
            </div>
            <p>Проверка выполнена сервером для радиуса R = <%= result.getR() %></p>
        </div>

        <h3 style="margin-bottom: 14px; color: #1e293b;">Полученные параметры:</h3>
        <table class="results-table" style="margin-bottom: 24px;">
            <thead>
            <tr>
                <th>Параметр</th>
                <th>Значение</th>
            </tr>
            </thead>
            <tbody>
            <tr>
                <td>Координата X</td>
                <td><strong><%= String.format(java.util.Locale.US, "%.3f", result.getX()) %></strong></td>
            </tr>
            <tr>
                <td>Координата Y</td>
                <td><strong><%= String.format(java.util.Locale.US, "%.3f", result.getY()) %></strong></td>
            </tr>
            <tr>
                <td>Радиус R</td>
                <td><strong><%= result.getR() %></strong></td>
            </tr>
            <tr>
                <td>Факт попадания</td>
                <td>
                    <span class="badge <%= result.isHit() ? "badge-hit" : "badge-miss" %>">
                        <%= result.isHit() ? "Попадание" : "Промах" %>
                    </span>
                </td>
            </tr>
            <tr>
                <td>Время запроса</td>
                <td><%= result.getCurrentTime() %></td>
            </tr>
            <tr>
                <td>Время работы сервлета</td>
                <td><%= result.getExecutionTime() %></td>
            </tr>
            <tr>
                <td>Способ ввода</td>
                <td><%= result.isFromCanvas() ? "Клик по интерактивному графику" : "Веб-форма" %></td>
            </tr>
            </tbody>
        </table>

        <div style="text-align: center;">
            <a href="${pageContext.request.contextPath}/controller" class="btn btn-primary" style="display: inline-block; padding: 12px 28px;">
                ← Вернуться к форме для нового запроса
            </a>
        </div>
    </div>
</div>

</body>
</html>
