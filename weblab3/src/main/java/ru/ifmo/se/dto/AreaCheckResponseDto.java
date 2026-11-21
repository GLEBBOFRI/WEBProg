package ru.ifmo.se.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import ru.ifmo.se.model.PointResult;

import java.io.Serializable;
import java.util.List;

/*
 * dto ответа проверки области: строгая типизация вместо сырых Map<String, Object> для защиты от подмены данных
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AreaCheckResponseDto implements Serializable {
    private static final long serialVersionUID = 1L;

    // статус успешности проверки и валидации параметров
    private boolean valid;

    // сообщение об ошибке валидации, если что-то пошло не так
    private String error;

    // список проверенных сервером точек
    private List<PointResult> points;
}
