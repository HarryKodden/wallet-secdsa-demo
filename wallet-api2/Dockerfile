# waltid-wallet-api2 + SECDSA key backend (educational PoC).
# Expects ./dist from scripts/build-wallet-api2.sh (installDist + BC jar strip).
FROM eclipse-temurin:21-jre

WORKDIR /waltid-wallet-api2
COPY dist/ /waltid-wallet-api2/
# Actions upload/download-artifact strips +x; restore start scripts.
RUN chmod +x /waltid-wallet-api2/bin/*
EXPOSE 7006
ENTRYPOINT ["/waltid-wallet-api2/bin/waltid-wallet-api2"]
