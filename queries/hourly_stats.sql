-- 시간대별 배달 통계
-- 파라미터: ${date}, ${region_code} (optional)
SELECT
    HOUR(pick_up_date) as hour,
    COUNT(*) as delivery_count,
    AVG(DATE_DIFF('minute', pick_up_date, hand_over_date)) as avg_delivery_min,
    MIN(DATE_DIFF('minute', pick_up_date, hand_over_date)) as min_delivery_min,
    MAX(DATE_DIFF('minute', pick_up_date, hand_over_date)) as max_delivery_min,
    APPROX_PERCENTILE(DATE_DIFF('minute', pick_up_date, hand_over_date), 0.5) as median_delivery_min
FROM sbbi.bm_delivery_time_period
WHERE part_date = '${date}'
  AND pick_up_date IS NOT NULL
  AND hand_over_date IS NOT NULL
  -- AND dlvry_rgn2_cd = '${region_code}'
GROUP BY HOUR(pick_up_date)
ORDER BY hour;
