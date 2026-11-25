# syntax=docker/dockerfile:1
# Build context: repository root (.)
# Example: docker build -f backend/catalog/Dockerfile -t conan-catalog .

FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace

COPY backend/pom.xml ./pom.xml
COPY backend/common/pom.xml ./common/pom.xml
COPY backend/catalog/pom.xml ./catalog/pom.xml
COPY backend/orders/pom.xml ./orders/pom.xml
COPY backend/assistant/pom.xml ./assistant/pom.xml

COPY backend/common/src ./common/src
COPY backend/catalog/src ./catalog/src

RUN mvn -B -DskipTests -pl catalog -am package

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /workspace/catalog/target/quarkus-app/ /app/

USER app
EXPOSE 8081

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/quarkus-run.jar"]
