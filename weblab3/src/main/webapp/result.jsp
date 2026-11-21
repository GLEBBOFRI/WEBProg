<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>

<%-- чекаем, не залетел ли юзер сюда внаглую мимо проверки, если да — кидаем обратно на контроллер --%>
<c:if test="${empty result}">
    <c:redirect url="/controller"/>
</c:if>

<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Результат проверки точки | GTA 6 Vice City</title>
    <link rel="stylesheet" href="${pageContext.request.contextPath}/css/styles.css">
</head>
<body>

<%-- фирменный неоновый баннер gta 6 и бейдж полицейского департамента вайс-сити --%>
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

    <%-- плашка со статусом проверки: сочный флекс если залетело или провал миссии --%>
    <div class="result-status ${result.hit ? 'hit' : 'miss'}">
        <c:choose>
            <c:when test="${result.hit}">
                ✓ МИССИЯ ВЫПОЛНЕНА // ПОПАДАНИЕ
            </c:when>
            <c:otherwise>
                ✗ МИССИЯ ПРОВАЛЕНА // ПРОМАХ
            </c:otherwise>
        </c:choose>
    </div>

    <%-- таблица со всеми параметрами точки через чистый el без устаревших скриптлетов --%>
    <table border="1" style="width: 100%; border-collapse: collapse; margin-top: 15px; text-align: left;">
        <tr>
            <th style="padding: 10px; width: 45%;">Параметр</th>
            <th style="padding: 10px; width: 55%;">Полученное значение</th>
        </tr>
        <tr>
            <td style="padding: 10px;">Координата X</td>
            <td style="padding: 10px;"><b><c:out value="${result.x}"/></b></td>
        </tr>
        <tr>
            <td style="padding: 10px;">Координата Y</td>
            <td style="padding: 10px;"><b><c:out value="${result.y}"/></b></td>
        </tr>
        <tr>
            <td style="padding: 10px;">Радиус области R</td>
            <td style="padding: 10px;"><b><c:out value="${result.r}"/></b></td>
        </tr>
        <tr>
            <td style="padding: 10px;">Вердикт попадания</td>
            <td style="padding: 10px;">
                <c:choose>
                    <c:when test="${result.hit}">
                        <b style="color: #55ff99; text-shadow: 0 0 8px rgba(85,255,153,0.7);">Попадание (Успех)</b>
                    </c:when>
                    <c:otherwise>
                        <b style="color: #ff4466; text-shadow: 0 0 8px rgba(255,68,102,0.7);">Мимо (Провал)</b>
                    </c:otherwise>
                </c:choose>
            </td>
        </tr>
        <tr>
            <td style="padding: 10px;">Время фиксации</td>
            <td style="padding: 10px;"><c:out value="${result.currentTime}"/></td>
        </tr>
        <tr>
            <td style="padding: 10px;">Время обработки сервером</td>
            <td style="padding: 10px;"><c:out value="${result.executionTime}"/></td>
        </tr>
        <tr>
            <td style="padding: 10px;">Источник данных</td>
            <td style="padding: 10px;">
                <c:choose>
                    <c:when test="${result.fromCanvas}">
                        Интерактивный радар
                    </c:when>
                    <c:otherwise>
                        Ручной ввод координат
                    </c:otherwise>
                </c:choose>
            </td>
        </tr>
    </table>

    <%-- ссылка возврата на форму строго через контроллер как завещал препод --%>
    <div style="text-align: center; margin-top: 25px;">
        <a href="${pageContext.request.contextPath}/controller" class="back-link">
            ← Вернуться в Vice City к выбору цели
        </a>
    </div>
</div>

<%-- подключаем общий js со звуками и крутилками пасхалок --%>
<script src="${pageContext.request.contextPath}/js/main.js"></script>
<script>
    // врубаем пасхалку только для ручного ввода одного x (по клику на графике тишина)
    window.addEventListener('DOMContentLoaded', function() {
        <c:if test="${not result.fromCanvas}">
            setTimeout(function() {
                <c:choose>
                    <c:when test="${result.hit}">
                        triggerFnafEasterEgg();
                    </c:when>
                    <c:otherwise>
                        triggerGtaEasterEgg();
                    </c:otherwise>
                </c:choose>
            }, 150);
        </c:if>
    });
</script>

</body>
</html>
