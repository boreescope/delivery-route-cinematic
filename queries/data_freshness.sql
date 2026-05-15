-- 데이터 적재 지연 확인
SELECT
    MAX(pick_up_date) as latest_data,
    CURRENT_TIMESTAMP as current_time,
    DATE_DIFF('minute', MAX(pick_up_date), CURRENT_TIMESTAMP) as delay_minutes
FROM sbbi.bm_delivery_time_period
WHERE part_date = CURRENT_DATE;
