-- 인기 배달 경로 (매장→배달지 클러스터)
-- 같은 매장에서 비슷한 지역으로 가는 배달을 그룹핑
-- 파라미터: ${date}, ${region_code}, ${limit}
SELECT
    ROUND(shop_lat, 3) as shop_lat_cluster,
    ROUND(shop_lon, 3) as shop_lon_cluster,
    ROUND(dlvry_lat, 3) as dlvry_lat_cluster,
    ROUND(dlvry_lon, 3) as dlvry_lon_cluster,
    COUNT(*) as route_count,
    AVG(DATE_DIFF('minute', pick_up_date, hand_over_date)) as avg_delivery_min
FROM sbbi.bm_delivery_time_period
WHERE part_date = '${date}'
  AND dlvry_rgn2_cd = '${region_code}'
  AND pick_up_date IS NOT NULL
  AND hand_over_date IS NOT NULL
GROUP BY
    ROUND(shop_lat, 3),
    ROUND(shop_lon, 3),
    ROUND(dlvry_lat, 3),
    ROUND(dlvry_lon, 3)
HAVING COUNT(*) >= 3
ORDER BY route_count DESC
LIMIT ${limit};
