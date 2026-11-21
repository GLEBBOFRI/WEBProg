<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<%-- подключаем бин истории из сессии --%>
<jsp:useBean id="resultsBean" class="ru.ifmo.se.model.ResultsBean" scope="session"/>

<%-- проверяем что юзер не открыл index.jsp напрямую в обход контроллера mvc --%>
<c:if test="${empty requestScope['jakarta.servlet.forward.request_uri'] and empty requestScope['javax.servlet.forward.request_uri']}">
    <c:redirect url="/controller"/>
</c:if>

<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Лабораторная работа №3 | GTA 6 Vice City</title>
    <link rel="stylesheet" href="${pageContext.request.contextPath}/css/styles.css">
</head>
<body>

<%-- контейнер для всплывашек с ошибками --%>
<div id="toast-container"></div>

<%-- блок серверной ошибки через el и jstl без скриптлетов --%>
<c:if test="${not empty errorMessage}">
    <div style="background: rgba(180, 20, 40, 0.85); border: 1px solid #ff4466; color: #ffffff; padding: 14px; margin-bottom: 16px; text-align: center; font-family: monospace; border-radius: 8px; box-shadow: 0 0 15px rgba(255, 68, 102, 0.5);">
        <strong>ОШИБКА:</strong> <c:out value="${errorMessage}"/>
    </div>
</c:if>

<%-- фирменный логотип gta 6 и бейдж локации вайс-сити --%>
<div class="gta6-header-banner">
    <div class="gta6-logo-container">
        <img src="${pageContext.request.contextPath}/images/gta6-logo.svg" alt="Grand Theft Auto VI" class="gta6-logo-img">
    </div>
    <div class="gta6-subtitle-badge">LEONIDA STATE • VICE CITY DISTRICT</div>
</div>

<table border="1" id="main-layout">
    <tbody>
    <tr>
        <td colspan="2" id="header">
            <b>Вохрамеев Глеб Дмитриевич | Группа: P3218 | Вариант: 45218 (Лабораторная работа №3)</b>
        </td>
    </tr>
    <tr>
        <td colspan="2" id="easter-egg-cell">
            <input type="text" id="top-left-input" placeholder="Интересно, для чего же это поле......?">
        </td>
    </tr>
    <tr>
        <td id="canvas-cell" align="center">
            <%-- канвас с интерактивной областью --%>
            <canvas id="graph" width="300" height="300"></canvas>
        </td>
        <td id="form-cell">
            <%-- формочка шлет post строго на контроллер по тз --%>
            <form id="point-form" action="${pageContext.request.contextPath}/controller" method="POST">
                <p><b style="color: #00f0ff; letter-spacing: 1px;">МИССИЯ: ОПРЕДЕЛИТЬ КООРДИНАТЫ ЦЕЛИ // VICE CITY</b></p>
                
                <%-- выбор координаты x чекбоксами (мультивыбор) без java-скриптлетов через jstl c:forEach --%>
                <p><b>Координата X (выбери один или несколько):</b></p>
                <div id="x-checkboxes-group" class="btn-group">
                    <c:forEach var="xVal" items="-4,-3,-2,-1,0,1,2,3,4">
                        <label class="x-cb-label">
                            <input type="checkbox" class="x-cb" name="x" value="${xVal}"> ${xVal}
                        </label>
                    </c:forEach>
                </div>

                <%-- ввод y текстом со строгим диапазоном (-5 ... 3) --%>
                <p><b>Координата Y (-5 ... 3):</b></p>
                <input type="text" id="y-input" name="y" placeholder="Введи число строго от -5 до 3" maxlength="10" autocomplete="off">

                <%-- выбор r через селект от 1 до 5 --%>
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
                    <%-- кнопка отправки залочена пока инпуты не станут валидными --%>
                    <input type="submit" id="submit-btn" value="Проверить точку // Execute" disabled>
                </p>
            </form>
        </td>
    </tr>
    <tr>
        <td colspan="2" id="clr" align="center">
            <div class="button-group">
                <button type="button" id="clear-btn" class="action-btn">Очистить улики</button>
                <button type="button" id="toggle-invalid-btn" class="action-btn">Показать невалидные</button>
                <button type="button" id="stats-btn" class="action-btn">Статистика сервера</button>
            </div>
        </td>
    </tr>
    <tr>
        <td colspan="2">
            <%-- вывод таблицы с результатами строго через JSTL c:forEach и EL без скриптлетов --%>
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
                <c:forEach var="res" items="${resultsBean.results}">
                    <tr>
                        <td><c:out value="${res.x}"/></td>
                        <td><c:out value="${res.y}"/></td>
                        <td><c:out value="${res.r}"/></td>
                        <td>
                            <c:choose>
                                <c:when test="${res.hit}">
                                    <span style="color: #55ff99; font-weight: bold; text-shadow: 0 0 8px rgba(85,255,153,0.7);">Попал</span>
                                </c:when>
                                <c:otherwise>
                                    <span style="color: #ff4466; font-weight: bold; text-shadow: 0 0 8px rgba(255,68,102,0.7);">Мимо</span>
                                </c:otherwise>
                            </c:choose>
                        </td>
                        <td><c:out value="${res.currentTime}"/></td>
                        <td><c:out value="${res.executionTime}"/></td>
                    </tr>
                </c:forEach>
                </tbody>
            </table>
        </td>
    </tr>
    </tbody>
</table>

<%-- модалка серверной статистики запросов из ServletContext --%>
<div id="stats-modal" class="stats-modal-overlay" style="display: none;">
    <div class="stats-modal-card">
        <div class="stats-modal-header">
            <span class="stats-modal-title">LEONIDA SERVER INTEL // REQUEST STATS</span>
            <button type="button" id="stats-close-btn" class="stats-close-btn">&times;</button>
        </div>
        <div class="stats-modal-body" id="stats-content">
            <div class="stats-loading">Загрузка данных...</div>
        </div>
    </div>
</div>

<%-- прокидываем сохраненные точки из бина в js через jstl без скриптлетов --%>
<script>
    window.CONTEXT_PATH = "${pageContext.request.contextPath}";
    window.INITIAL_POINTS = [
        <c:forEach var="pt" items="${resultsBean.results}" varStatus="loop">
            {
                x: ${pt.x},
                y: ${pt.y},
                r: ${pt.r},
                hit: ${pt.hit},
                time: "${pt.currentTime}",
                execTime: "${pt.executionTime}"
            }${not loop.last ? ',' : ''}
        </c:forEach>
    ];
</script>
<script src="${pageContext.request.contextPath}/js/main.js"></script>
</body>
</html>