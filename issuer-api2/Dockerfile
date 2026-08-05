# waltid-issuer-api2 (educational PoC lab).
# Expects ./dist from scripts/build-issuer-api2.sh (installDist).
FROM eclipse-temurin:21-jre

WORKDIR /waltid-issuer-api2
COPY dist/ /waltid-issuer-api2/
EXPOSE 7005
ENTRYPOINT ["/waltid-issuer-api2/bin/waltid-issuer-api2"]
