CREATE TABLE IF NOT EXISTS `item_exchange_peds` (
    `id` int unsigned NOT NULL AUTO_INCREMENT,
    `type` varchar(20) NOT NULL DEFAULT 'trader',
    `group_id` int unsigned NOT NULL DEFAULT 1,
    `model` varchar(100) NOT NULL,
    `x` double NOT NULL DEFAULT 0,
    `y` double NOT NULL DEFAULT 0,
    `z` double NOT NULL DEFAULT 0,
    `w` double NOT NULL DEFAULT 0,
    `scenario` varchar(100) NOT NULL DEFAULT '',
    `target_label` varchar(100) NOT NULL DEFAULT 'Trader',
    `target_icon` varchar(100) NOT NULL DEFAULT 'fa-solid fa-hand-holding-dollar',
    `menu_title` varchar(100) NOT NULL DEFAULT 'Item Exchange',
    `enabled` tinyint(1) NOT NULL DEFAULT 1,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;