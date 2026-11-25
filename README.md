# System-CONAN

Hệ thống nhà sách Conan theo kiến trúc microservices (Quarkus 3 + React 19 + Vite + MySQL + Kafka + Keycloak + Ollama), đóng gói Docker riêng cho từng service để dễ dàng deploy độc lập.

## Danh sách Dockerfile (Build Context: `.`)

| Service | Dockerfile Path | Port mặc định | Mô tả |
|---|---|---|---|
| **Catalog Service** | `backend/catalog/Dockerfile` | `8081` | Quản lý danh mục truyện, SKU và giữ tồn kho |
| **Orders Service** | `backend/orders/Dockerfile` | `8082` | Đặt hàng (idempotency), saga xử lý đơn qua Kafka |
| **Assistant Service** | `backend/assistant/Dockerfile` | `8083` | Trợ lý tra cứu giá/tồn kho & RAG (Ollama) |
| **Frontend (Web)** | `frontend/Dockerfile` | `80` | Giao diện React + Nginx reverse proxy cấu hình qua env |
| **Database (MySQL)** | `database/Dockerfile` | `3306` | MySQL 8.4 kèm script khởi tạo 4 schema (`catalog`, `orders`, `assistant`, `identitydb`) |

## Build riêng từng service

```bash
docker build -f backend/catalog/Dockerfile -t conan-catalog .
docker build -f backend/orders/Dockerfile -t conan-orders .
docker build -f backend/assistant/Dockerfile -t conan-assistant .
docker build -f frontend/Dockerfile -t conan-frontend .
docker build -f database/Dockerfile -t conan-mysql .
```

## Chạy toàn bộ bằng Docker Compose

```bash
cp .env.example .env
docker compose up --build
```
