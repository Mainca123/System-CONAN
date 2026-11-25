-- Standard MySQL initialization for System-CONAN microservices
-- Each microservice owns its own isolated schema and dedicated user.

CREATE DATABASE IF NOT EXISTS catalog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS orders CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS assistant CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS identitydb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'catalog'@'%' IDENTIFIED BY 'demo_catalog';
CREATE USER IF NOT EXISTS 'orders'@'%' IDENTIFIED BY 'demo_orders';
CREATE USER IF NOT EXISTS 'assistant'@'%' IDENTIFIED BY 'demo_assistant';
CREATE USER IF NOT EXISTS 'identitydb'@'%' IDENTIFIED BY 'demo_identitydb';

GRANT ALL PRIVILEGES ON catalog.* TO 'catalog'@'%';
GRANT ALL PRIVILEGES ON orders.* TO 'orders'@'%';
GRANT ALL PRIVILEGES ON assistant.* TO 'assistant'@'%';
GRANT ALL PRIVILEGES ON identitydb.* TO 'identitydb'@'%';

FLUSH PRIVILEGES;
