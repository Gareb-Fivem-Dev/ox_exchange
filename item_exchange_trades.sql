CREATE TABLE IF NOT EXISTS `item_exchange_trades` (
    `id` int unsigned NOT NULL AUTO_INCREMENT,
    `trader` int unsigned NOT NULL DEFAULT 1,
    `label` varchar(100) NOT NULL,
    `description` varchar(255) NOT NULL DEFAULT '',
    `cost_item` varchar(100) NOT NULL,
    `cost_count` int unsigned NOT NULL DEFAULT 1,
    `receive_item` varchar(100) NOT NULL,
    `receive_count` int unsigned NOT NULL DEFAULT 1,
    `receive_formula` varchar(40) NOT NULL DEFAULT '1',
    `icon` varchar(80) DEFAULT 'right-left',
    `enabled` tinyint(1) NOT NULL DEFAULT 1,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;