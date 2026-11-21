package ru.ifmo.se.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/*
 * dto ответа на очистку истории проверок
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClearResponseDto implements Serializable {
    private static final long serialVersionUID = 1L;

    // флаги успешного сброса бина в сессии
    private boolean success;
    private boolean cleared;
}
