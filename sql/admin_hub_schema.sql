-- Admin Hub Schema
-- This file creates the database tables for the Admin Hub feature
-- Run this file once during server setup to create the required tables

-- Table for command categories (e.g., Trading, Buyers, Peds, Vehicles)
CREATE TABLE IF NOT EXISTS `item_exchange_admin_categories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `label` VARCHAR(100) NOT NULL,
    `icon` VARCHAR(50) DEFAULT '⚙️',
    `sort_order` INT DEFAULT 0,
    `enabled` TINYINT(1) DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for custom commands that admins can execute
CREATE TABLE IF NOT EXISTS `item_exchange_admin_commands` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `category_id` INT NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) DEFAULT '',
    `command` VARCHAR(255) NOT NULL,
    `icon` VARCHAR(50) DEFAULT '⚙️',
    `permission` VARCHAR(100) DEFAULT 'admin',
    `confirm_prompt` VARCHAR(255) DEFAULT '',
    `parameters` TINYINT(1) DEFAULT 0,
    `example` VARCHAR(255) DEFAULT '',
    `enabled` TINYINT(1) DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`category_id`) REFERENCES `item_exchange_admin_categories`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index to speed up lookups by category and permission
CREATE INDEX idx_category_id_enabled ON item_exchange_admin_commands (category_id, enabled);
CREATE INDEX idx_command_enabled ON item_exchange_admin_commands (command, enabled);
CREATE INDEX idx_permission_enabled ON item_exchange_admin_commands (permission, enabled);