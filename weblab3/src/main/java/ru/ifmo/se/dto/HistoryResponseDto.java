package ru.ifmo.se.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import ru.ifmo.se.model.PointResult;

import java.io.Serializable;
import java.util.List;

/*
 * dto выдачи истории точек из сессии
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HistoryResponseDto implements Serializable {
    private static final long serialVersionUID = 1L;

    // список точек из сессионного бина
    private List<PointResult> points;
}
