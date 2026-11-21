package ru.ifmo.se.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/*
 * dto серверной статистики: строго типизированные поля вместо Map<String, Object>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StatsResponseDto implements Serializable {
    private static final long serialVersionUID = 1L;

    // счетчики запросов из фильтра
    private long totalRequests;
    private long getRequests;
    private long postRequests;
    private long pointChecks;
    private long hits;
    private long misses;

    // время аптайма и крайнего запроса
    private String uptime;
    private String lastRequestTime;
}
