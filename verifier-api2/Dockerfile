# waltid-verifier-api2 (educational PoC lab).
# Expects ./dist from scripts/build-verifier-api2.sh (installDist).
FROM eclipse-temurin:21-jre

WORKDIR /waltid-verifier-api2
COPY dist/ /waltid-verifier-api2/
# Actions upload/download-artifact strips +x; restore start scripts.
RUN chmod +x /waltid-verifier-api2/bin/*
EXPOSE 7004
ENTRYPOINT ["/waltid-verifier-api2/bin/waltid-verifier-api2"]
