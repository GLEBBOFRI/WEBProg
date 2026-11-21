<%@ page contentType="text/html;charset=UTF-8" language="java" isErrorPage="true" %>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Ошибка | GTA 6 Vice City</title>
    <link rel="stylesheet" href="${pageContext.request.contextPath}/css/styles.css">
</head>
<body>

<div class="gta6-header-banner">
    <div class="gta6-logo-container">
        <img src="${pageContext.request.contextPath}/images/gta6-logo.svg" alt="Grand Theft Auto VI" class="gta6-logo-img">
    </div>
    <div class="gta6-subtitle-badge">LEONIDA POLICE DEPARTMENT // SYSTEM ALERT</div>
</div>

<div class="result-card" style="text-align: center;">
    <div id="header" style="margin-bottom: 20px;">
        <b>ОШИБКА ОБРАБОТКИ ЗАПРОСА // SYSTEM ERROR</b>
    </div>

    <div class="result-status miss">
        <span>⚠ КОД ОШИБКИ: </span>
        <c:choose>
            <c:when test="${not empty pageContext.errorData.statusCode}">
                <c:out value="${pageContext.errorData.statusCode}"/>
            </c:when>
            <c:otherwise>
                400 / Неизвестная ошибка
            </c:otherwise>
        </c:choose>
    </div>

    <p style="color: #e0d4f5; font-size: 15px; margin: 20px 0;">
        <c:choose>
            <c:when test="${pageContext.errorData.statusCode == 404}">
                Запрашиваемый ресурс <code><c:out value="${pageContext.errorData.requestURI}"/></code> не найден на сервере.
            </c:when>
            <c:when test="${pageContext.errorData.statusCode == 500}">
                Произошла внутренняя ошибка сервера при обработке запроса.
            </c:when>
            <c:otherwise>
                Обнаружена некорректная операция или неверный запрос к приложению.
            </c:otherwise>
        </c:choose>
    </p>

    <div style="margin-top: 30px;">
        <a href="${pageContext.request.contextPath}/controller" class="back-link">
            ← Вернуться на главную страницу (Controller)
        </a>
    </div>
</div>

</body>
</html>
