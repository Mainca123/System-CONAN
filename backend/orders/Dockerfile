# syntax=docker/dockerfile:1
# Build context: repository root (.)
# Example: docker build -f backend/orders/Dockerfile -t conan-orders .

FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace

COPY backend/pom.xml ./pom.xml
COPY backend/common/pom.xml ./common/pom.xml
COPY backend/catalog/pom.xml ./catalog/pom.xml
COPY backend/orders/pom.xml ./orders/pom.xml
COPY backend/assistant/pom.xml ./assistant/pom.xml

COPY backend/common/src ./common/src
COPY backend/orders/src ./orders/src

RUN mvn -B -DskipTests -pl orders -am package

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /workspace/orders/target/quarkus-app/ /app/

USER app
EXPOSE 8082

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/quarkus-run.jar"]
