CREATE TABLE IF NOT EXISTS `item_exchange_buyers` (
    `id` int unsigned NOT NULL AUTO_INCREMENT,
    `buyer` int unsigned NOT NULL DEFAULT 1,
    `label` varchar(100) NOT NULL,
    `description` varchar(255) NOT NULL DEFAULT '',
    `item` varchar(100) NOT NULL,
    `count` int unsigned NOT NULL DEFAULT 1,
    `price` int unsigned NOT NULL DEFAULT 1,
    `enabled` tinyint(1) NOT NULL DEFAULT 1,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
