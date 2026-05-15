-- 지역별 배달 데이터 조회
-- 파라미터: ${date}, ${region_code}, ${hour_start}, ${hour_end}, ${limit}
SELECT
    ord_no,
    shop_lat,
    shop_lon,
    dlvry_lat,
    dlvry_lon,
    pick_up_date,
    hand_over_date,
    DATE_DIFF('minute', pick_up_date, hand_over_date) as delivery_minutes
FROM sbbi.bm_delivery_time_period
WHERE part_date = '${date}'
  AND dlvry_rgn2_cd = '${region_code}'
  AND HOUR(pick_up_date) BETWEEN ${hour_start} AND ${hour_end}
  AND pick_up_date IS NOT NULL
  AND hand_over_date IS NOT NULL
LIMIT ${limit};
