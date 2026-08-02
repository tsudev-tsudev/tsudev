# Keycloak production cho SSO tsudev — build context = gốc repo.
# Free tier Render giới hạn 512MB RAM. `start-dev` build/augment lúc container
# khởi động (không phải lúc docker build) từng gây OOM ngay ở bước đầu — build
# sẵn ("kc.sh build") tại đây rồi chạy `start --optimized` để bỏ bước đó lúc
# runtime, kèm giới hạn heap JVM để không vượt hạn mức.
FROM quay.io/keycloak/keycloak:21.1.1 AS builder
ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=false
# Chỉ chọn VENDOR db lúc build (postgres) — URL/user/pass là runtime option,
# đọc từ biến môi trường thật lúc container khởi động (Render secrets), KHÔNG
# bake vào image. dev-mem (H2 RAM) đã thử trước đó SAI: free tier Render ngủ
# rồi khởi động lại thường xuyên sẽ xoá sạch toàn bộ tài khoản mỗi lần.
ENV KC_DB=postgres
# --cache là build-time option (chỉ hợp lệ ở kc.sh build, không phải start).
RUN /opt/keycloak/bin/kc.sh build --cache=local

FROM quay.io/keycloak/keycloak:21.1.1
COPY --from=builder /opt/keycloak/ /opt/keycloak/
COPY apps/sso-auth/keycloak/realm-export.prod.json /opt/keycloak/data/import/realm-export.json
ENV JAVA_OPTS_APPEND="-Xms64m -Xmx320m -XX:MaxMetaspaceSize=128m"
# Render tiêm biến PORT lúc chạy (không cố định lúc build) -> phải qua shell
# để giãn ${PORT}, không dùng exec-form CMD.
ENTRYPOINT ["/bin/sh", "-c"]
CMD ["/opt/keycloak/bin/kc.sh start --optimized --import-realm --http-enabled=true --hostname-strict=false --proxy=edge --http-port=${PORT:-8080}"]
