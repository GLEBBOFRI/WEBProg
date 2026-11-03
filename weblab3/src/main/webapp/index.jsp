<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="ru.ifmo.se.model.ResultsBean" %>
<%@ page import="ru.ifmo.se.model.PointResult" %>
<%@ page import="java.util.List" %>
<jsp:useBean id="resultsBean" class="ru.ifmo.se.model.ResultsBean" scope="session"/>

<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Лабораторная работа №3 | Проверка попадания точки</title>
    <link rel="stylesheet" href="${pageContext.request.contextPath}/css/styles.css">
</head>
<body>

<div id="toast-container"></div>

<div class="container">
    <!-- Шапка страницы по заданию -->
    <header class="header-card">
        <div class="header-info">
            <h1>Лабораторная работа №3</h1>
            <p><strong>Студент:</strong> Вохрамеев Глеб Дмитриевич | <strong>Группа:</strong> P3218</p>
        </div>
        <div class="header-badge">
            Вариант 3 лабы (JSP &amp; Servlets)
        </div>
    </header>

    <% if (request.getAttribute("errorMessage") != null) { %>
        <div class="card" style="margin-bottom: 20px; border-left: 5px solid var(--miss-color); background: #fef2f2;">
            <strong style="color: var(--miss-color);">Ошибка:</strong> <%= request.getAttribute("errorMessage") %>
        </div>
    <% } %>

    <!-- Основная секция: Форма + Интерактивный график -->
    <div class="main-grid">
        <!-- Форма ввода данных -->
        <div class="card">
            <h2 class="card-title">Параметры точки</h2>
            <form id="point-form" action="${pageContext.request.contextPath}/controller" method="POST">
                
                <!-- Координата X (Checkbox) -->
                <div class="form-group">
                    <label class="form-label">Координата X (выберите одно значение):</label>
                    <div class="checkbox-group">
                        <% for (int xVal : new int[]{-4, -3, -2, -1, 0, 1, 2, 3, 4}) { %>
                            <div class="checkbox-btn">
                                <input type="checkbox" id="x_<%= xVal %>" name="x" value="<%= xVal %>">
                                <label for="x_<%= xVal %>"><%= xVal %></label>
                            </div>
                        <% } %>
                    </div>
                    <div class="form-hint">Допустимые значения: {-4, -3, -2, -1, 0, 1, 2, 3, 4}</div>
                </div>

                <!-- Координата Y (Text: (-5 ... 3)) -->
                <div class="form-group">
                    <label for="y-input" class="form-label">Координата Y:</label>
                    <input type="text" id="y-input" name="y" class="text-input"
                           placeholder="Число от -5 до 3 (например, 1.5)" maxlength="10" autocomplete="off">
                    <div class="form-hint">Интервал: строго <strong>(-5 ... 3)</strong> не включая границы</div>
                </div>

                <!-- Радиус R (Select: {'1', '2', '3', '4', '5'}) -->
                <div class="form-group">
                    <label for="r-select" class="form-label">Радиус области R:</label>
                    <select id="r-select" name="r" class="select-input">
                        <option value="1">1</option>
                        <option value="2" selected>2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                    </select>
                    <div class="form-hint">Выберите радиус для отображения области на графике</div>
                </div>

                <div class="button-row">
                    <button type="submit" id="submit-btn" class="btn btn-primary">Проверить точку</button>
                    <button type="button" id="clear-btn" class="btn btn-secondary">Очистить историю</button>
                </div>
            </form>
        </div>

        <!-- Интерактивный график Canvas -->
        <div class="card canvas-wrapper">
            <h2 class="card-title">Область на координатной плоскости</h2>
            <canvas id="graph-canvas" width="360" height="360"></canvas>
            
            <div class="canvas-legend">
                <div class="legend-item">
                    <span class="legend-dot hit"></span> Попадание
                </div>
                <div class="legend-item">
                    <span class="legend-dot miss"></span> Промах
                </div>
                <div class="legend-item">
                    <span class="legend-dot bounds"></span> Допустимая зона [-4..4] × (-5..3)
                </div>
            </div>
            <div class="form-hint" style="text-align: center; margin-top: 6px;">
                Кликните по графику с выбранным R для быстрой проверки с примагничиванием
            </div>
        </div>
    </div>

    <!-- Таблица результатов предыдущих проверок из JavaBean -->
    <div class="table-card">
        <div class="table-header-row">
            <h2 class="card-title" style="margin-bottom: 0;">История проверок (Session Bean)</h2>
            <span class="badge" style="background: #e2e8f0; color: #475569;">
                Всего записей: <%= resultsBean.getCount() %>
            </span>
        </div>

        <div class="table-responsive">
            <table class="results-table">
                <thead>
                <tr>
                    <th>Координата X</th>
                    <th>Координата Y</th>
                    <th>Радиус R</th>
                    <th>Результат</th>
                    <th>Время запроса</th>
                    <th>Время расчета</th>
                </tr>
                </thead>
                <tbody id="results-tbody">
                <%
                    List<PointResult> history = resultsBean.getResults();
                    if (history == null || history.isEmpty()) {
                %>
                    <tr>
                        <td colspan="6" class="empty-table-msg">История проверок пуста. Отправьте форму или кликните по графику!</td>
                    </tr>
                <%
                    } else {
                        for (PointResult res : history) {
                %>
                    <tr>
                        <td><strong><%= String.format(java.util.Locale.US, "%.3f", res.getX()) %></strong></td>
                        <td><strong><%= String.format(java.util.Locale.US, "%.3f", res.getY()) %></strong></td>
                        <td><%= res.getR() %></td>
                        <td>
                            <span class="badge <%= res.isHit() ? "badge-hit" : "badge-miss" %>">
                                <%= res.isHit() ? "Попадание" : "Промах" %>
                            </span>
                        </td>
                        <td><%= res.getCurrentTime() %></td>
                        <td><%= res.getExecutionTime() %></td>
                    </tr>
                <%
                        }
                    }
                %>
                </tbody>
            </table>
        </div>
    </div>
</div>

<script src="${pageContext.request.contextPath}/js/main.js"></script>
</body>
</html>
