<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="ru.ifmo.se.model.PointResult" %>
<%
    // забираем результат проверки из аттрибутов запроса от AreaCheckServlet
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

<%-- фирменный логотип gta 6 и плашка миссии вверху страницы результатов --%>
<div class="gta6-header-banner">
    <div class="gta6-logo-container">
        <img src="${pageContext.request.contextPath}/images/gta6-logo.svg" alt="Grand Theft Auto VI" class="gta6-logo-img">
    </div>
    <div class="gta6-subtitle-badge">LEONIDA POLICE DEPARTMENT // MISSION REPORT</div>
</div>

<div class="result-card">
    <div id="header" style="margin-bottom: 20px;">
        <b>ОТЧЁТ МИССИИ // AREA CHECK DOSSIER</b>
    </div>

    <%-- плашка с вердиктом: залетело или мимо в стиле gta --%>
    <div class="result-status <%= result.isHit() ? "hit" : "miss" %>">
        <%= result.isHit() ? "✓ МИССИЯ ВЫПОЛНЕНА // ПОПАДАНИЕ" : "✗ МИССИЯ ПРОВАЛЕНА // ПРОМАХ" %>
    </div>

    <%-- табличка со всеми входными параметрами и замерами --%>
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
            <td style="padding: 10px;">Вердикт попадания</td>
            <td style="padding: 10px;"><b><%= result.isHit() ? "Попадание (Успех)" : "Мимо (Провал)" %></b></td>
        </tr>
        <tr>
            <td style="padding: 10px;">Время фиксации</td>
            <td style="padding: 10px;"><%= result.getCurrentTime() %></td>
        </tr>
        <tr>
            <td style="padding: 10px;">Время обработки сервером</td>
            <td style="padding: 10px;"><%= result.getExecutionTime() %></td>
        </tr>
        <tr>
            <td style="padding: 10px;">Источник данных</td>
            <td style="padding: 10px;"><%= result.isFromCanvas() ? "Интерактивный радар" : "Ручной ввод координат" %></td>
        </tr>
    </table>

    <%-- ссылка возврата на главную через контроллер по условию тз --%>
    <div style="text-align: center; margin-top: 25px;">
        <a href="${pageContext.request.contextPath}/controller" class="back-link">
            ← Вернуться в Vice City к выбору цели
        </a>
    </div>
</div>

<%-- подключаем скрипты и запускаем эпичную пасхалку на странице результатов --%>
<script src="${pageContext.request.contextPath}/js/main.js"></script>
<script>
    // врубаем пасхалку только для ручного ввода формы (если кликнули по графику — тишина)
    window.addEventListener('DOMContentLoaded', function() {
        <% if (!result.isFromCanvas()) { %>
            setTimeout(function() {
                <% if (result.isHit()) { %>
                    triggerFnafEasterEgg();
                <% } else { %>
                    triggerGtaEasterEgg();
                <% } %>
            }, 150);
        <% } %>
    });
</script>

</body>
</html>
