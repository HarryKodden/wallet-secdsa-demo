# Educational adapter image — not for production.
# SECDSA is patent-encumbered; see HarryKodden/SECDSA USAGE.md / NOTICE.

FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /workspace

COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle gradle
RUN chmod +x gradlew \
	&& ./gradlew --no-daemon --quiet help >/dev/null

COPY src src
RUN ./gradlew --no-daemon test installDist

FROM eclipse-temurin:17-jre-jammy AS runtime
RUN useradd --system --uid 65532 --home /app --shell /usr/sbin/nologin adapter \
	&& apt-get update \
	&& apt-get install -y --no-install-recommends curl \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /workspace/build/install/secdsa-waltid-adapter /app
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh \
	&& chown -R adapter:adapter /app

ENV WSCA_BASE_URL=http://lab:8080 \
	WSCA_ACCOUNT_ID=citizen-42 \
	WSCA_WAIT_SECONDS=60

USER adapter
ENTRYPOINT ["/app/entrypoint.sh"]
# PIN via argv or WSCA_PIN
CMD []
