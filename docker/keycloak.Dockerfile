# Keycloak production cho SSO tsudev — build context = gốc repo.
FROM quay.io/keycloak/keycloak:21.1.1
COPY apps/sso-auth/keycloak/realm-export.prod.json /opt/keycloak/data/import/realm-export.json
# Render tiêm biến PORT lúc chạy (không cố định lúc build) -> phải qua shell
# để giãn ${PORT}, không dùng exec-form CMD.
ENTRYPOINT ["/bin/sh", "-c"]
CMD ["/opt/keycloak/bin/kc.sh start-dev --import-realm --http-enabled=true --hostname-strict=false --proxy=edge --health-enabled=true --http-port=${PORT:-8080}"]
