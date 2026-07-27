CREATE TABLE IF NOT EXISTS `vehicle_spawner_vehicles` (
    `id` int unsigned NOT NULL AUTO_INCREMENT,
    `vehicle_spawner_id` int unsigned,
    `cert_type` varchar(50) NOT NULL,
    `label` varchar(100) NOT NULL,
    `model` varchar(100) NOT NULL,
    `livery` int NULL,
    `extras` text NULL,
    `mod_engine` tinyint NULL,
    `allowed_jobs` varchar(255) NOT NULL DEFAULT '',
    `enabled` tinyint(1) NOT NULL DEFAULT 1,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_spawner_cert_model` (`vehicle_spawner_id`, `cert_type`, `model`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vehicle_spawner_certs` (
    `id` int unsigned NOT NULL AUTO_INCREMENT,
    `vehicle_spawner_id` int unsigned,
    `cert_type` varchar(50) NOT NULL,
    `label` varchar(100) NOT NULL,
    `max_spawned` int unsigned NOT NULL DEFAULT 2,
    `enabled` tinyint(1) NOT NULL DEFAULT 1,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_spawner_cert` (`vehicle_spawner_id`, `cert_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
