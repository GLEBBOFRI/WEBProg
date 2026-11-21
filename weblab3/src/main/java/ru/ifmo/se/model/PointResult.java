package ru.ifmo.se.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/*
 * моделька точки на lombok: аннотация @Data генерит все геттеры, сеттеры, equals, hashcode и tostring без кучи портянок
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PointResult implements Serializable {
    private static final long serialVersionUID = 1L;

    // координаты x, y и радиус r
    private double x;
    private double y;
    private double r;

    // попала ли точка в заданную геометрическую область
    private boolean hit;

    // серверное время и затраченное время вычислений
    private String currentTime;
    private String executionTime;

    // флаг: отправлено ли с графика canvas (true) или ручным вводом формы (false)
    private boolean fromCanvas;
}
