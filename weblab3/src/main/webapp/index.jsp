<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="ru.ifmo.se.model.ResultsBean" %>
<%@ page import="ru.ifmo.se.model.PointResult" %>
<%@ page import="java.util.List" %>
<jsp:useBean id="resultsBean" class="ru.ifmo.se.model.ResultsBean" scope="session"/>

<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Лабораторная работа №3 | Проверка попадания точки</title>
    <link rel="stylesheet" href="${pageContext.request.contextPath}/css/styles.css">
</head>
<body>

<div id="toast-container"></div>

<% if (request.getAttribute("errorMessage") != null) { %>
    <div style="background-color: #fee2e2; border: 1px solid #ef4444; color: #991b1b; padding: 12px; margin-bottom: 12px; text-align: center; font-family: monospace;">
        <strong>Ошибка:</strong> <%= request.getAttribute("errorMessage") %>
    </div>
<% } %>

<table border="1" id="main-layout">
    <tbody>
    <tr>
        <td colspan="2" id="header">
            <b>Вохрамеев Глеб Дмитриевич | Группа: P3218 | Вариант: 89721 (Лабораторная работа №3)</b>
        </td>
    </tr>
    <tr>
        <td colspan="2" id="easter-egg-cell">
            <input type="text" id="top-left-input" placeholder="Интересно, для чего же это поле......?">
        </td>
    </tr>
    <tr>
        <td id="canvas-cell" align="center">
            <canvas id="graph" width="300" height="300"></canvas>
        </td>
        <td id="form-cell">
            <form id="point-form" action="${pageContext.request.contextPath}/controller" method="POST">
                <p><b> Да начнется морской бой </b></p>
                
                <!-- Координата X (Checkbox: {-4..4}) -->
                <p><b>Координата X:</b></p>
                <div id="x-checkboxes-group" class="btn-group">
                    <% for (int xVal : new int[]{-4, -3, -2, -1, 0, 1, 2, 3, 4}) { %>
                        <label class="x-cb-label">
                            <input type="checkbox" class="x-cb" name="x_cb" value="<%= xVal %>"> <%= xVal %>
                        </label>
                    <% } %>
                </div>
                <!-- Скрытый инпут для отправки выбранного X на сервлет -->
                <input type="hidden" id="x-input" name="x" value="">

                <!-- Координата Y (Text: (-5 ... 3)) -->
                <p><b>Координата Y (-5 ... 3):</b></p>
                <input type="text" id="y-input" name="y" placeholder="Введи число строго от -5 до 3" maxlength="10" autocomplete="off">

                <!-- Радиус R (Select: {'1','2','3','4','5'}) -->
                <p><b>Радиус R:</b></p>
                <select id="r-select" name="r">
                    <option value="" disabled selected>Выбери R</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                </select>

                <p>
                    <input type="submit" id="submit-btn" value="Проверить" disabled>
                </p>
            </form>
        </td>
    </tr>
    <tr>
        <td colspan="2" id="clr" align="center">
            <div class="button-group">
                <button type="button" id="clear-btn" class="action-btn">Очистить историю</button>
                <button type="button" id="toggle-invalid-btn" class="action-btn">Показать невалидные</button>
            </div>
        </td>
    </tr>
    <tr>
        <td colspan="2">
            <!-- Таблица с результатами предыдущих проверок из JavaBean -->
            <table border="1" id="results-table">
                <thead>
                <tr>
                    <th>X</th>
                    <th>Y</th>
                    <th>R</th>
                    <th>Результат</th>
                    <th>Время отправки</th>
                    <th>Время работы (мс)</th>
                </tr>
                </thead>
                <tbody id="results-body">
                <%
                    List<PointResult> historyList = resultsBean.getResults();
                    if (historyList != null && !historyList.isEmpty()) {
                        for (int i = historyList.size() - 1; i >= 0; i--) {
                            PointResult item = historyList.get(i);
                %>
                    <tr>
                        <td><%= String.format(java.util.Locale.US, "%.3f", item.getX()) %></td>
                        <td><%= String.format(java.util.Locale.US, "%.3f", item.getY()) %></td>
                        <td><%= String.format(java.util.Locale.US, "%.1f", item.getR()) %></td>
                        <td><%= item.isHit() ? "Попал" : "Мимо" %></td>
                        <td><%= item.getCurrentTime() %></td>
                        <td><%= item.getExecutionTime() %></td>
                    </tr>
                <%
                        }
                    }
                %>
                </tbody>
            </table>
        </td>
    </tr>
    </tbody>
</table>

<!-- Передача истории из ResultsBean в клиентский JavaScript для отображения на Canvas -->
<script>
    window.CONTEXT_PATH = "${pageContext.request.contextPath}";
    window.INITIAL_POINTS = [
    <%
        if (historyList != null) {
            for (int i = 0; i < historyList.size(); i++) {
                PointResult p = historyList.get(i);
    %>
        {
            x: <%= p.getX() %>,
            y: <%= p.getY() %>,
            r: <%= p.getR() %>,
            hit: <%= p.isHit() %>,
            time: "<%= p.getCurrentTime() %>",
            execTime: "<%= p.getExecutionTime() %>"
        }<%= (i < historyList.size() - 1) ? "," : "" %>
    <%
            }
        }
    %>
    ];
</script>
<script src="${pageContext.request.contextPath}/js/main.js"></script>
</body>
</html>
