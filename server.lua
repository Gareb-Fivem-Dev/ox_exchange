local trades = {}
local tradesLoaded = false
local buyers = {}
local buyersLoaded = false
local peds = {}
local pedsLoaded = false
local QBCore
local vehicleSpawner = nil

-- Load vehicle spawner module if enabled
if Config.VehicleSpawner and Config.VehicleSpawner.enabled then
    vehicleSpawner = require('./vehicle_spawner')
end

local function notify(source, message, notifyType)
    TriggerClientEvent('ox_lib:notify', source, {
        description = message,
        type = notifyType or 'inform'
    })
end

local function isAdmin(source)
    return source == 0 or IsPlayerAceAllowed(source, Config.Admin.ace)
end

local function isBuyerAdmin(source)
    return source == 0 or IsPlayerAceAllowed(source, Config.BuyerAdmin.ace)
end

local function isPedAdmin(source)
    return source == 0 or IsPlayerAceAllowed(source, Config.PedAdmin.ace)
end

local function isVehicleSpawnerAdmin(source)
    if not Config.VehicleSpawnerAdmin.enabled then
        return false
    end
    return source == 0 or IsPlayerAceAllowed(source, Config.VehicleSpawnerAdmin.ace)
end

local function nonEmptyString(value, fallback)
    value = tostring(value or '')

    if value == '' then
        return fallback
    end

    return value
end

local function getDefaultPedTargetLabel(pedType)
    if pedType == 'buyer' then
        return 'Buyer'
    elseif pedType == 'vehicle_spawner' then
        return 'Vehicle Spawner'
    elseif pedType == 'decoration' then
        return ''
    end

    return 'Trader'
end

local function getDefaultPedTargetIcon(pedType)
    if pedType == 'buyer' then
        return 'fa-solid fa-dollar-sign'
    elseif pedType == 'vehicle_spawner' then
        return 'fa-solid fa-car'
    end

    return 'fa-solid fa-hand-holding-dollar'
end

local function getPlayerJobNameAndType(source)
    if GetResourceState('qb-core') ~= 'started' then
        return '', ''
    end

    local qbCore = exports['qb-core']:GetCoreObject()
    if not qbCore then
        return '', ''
    end

    local player = qbCore.Functions.GetPlayer(source)
    if not player then
        return '', ''
    end

    local job = player.PlayerData and player.PlayerData.job or {}
    local jobName = tostring(job.name or ''):lower()
    local jobType = tostring(job.type or ''):lower()
    return jobName, jobType
end

local function isVehicleAllowedForJob(allowedJobs, source)
    local normalized = {}
    local seen = {}
    for token in tostring(allowedJobs or ''):gmatch('[^,%s]+') do
        local value = token:lower():gsub('[^%w_%-]', '')
        if value ~= '' and not seen[value] then
            seen[value] = true
            normalized[#normalized + 1] = value
        end
    end

    if #normalized == 0 then
        return true
    end

    local jobName, jobType = getPlayerJobNameAndType(source)
    if jobName == '' and jobType == '' then
        return false
    end

    for _, token in ipairs(normalized) do
        if token == jobName or token == jobType then
            return true
        end
    end

    return false
end

local function parseExtrasList(value)
    if value == nil then
        return nil
    end

    if type(value) == 'table' then
        local list = {}
        local seen = {}

        for _, entry in ipairs(value) do
            local extraId = math.floor(tonumber(entry) or -1)
            if extraId >= 0 and extraId <= 30 and not seen[extraId] then
                seen[extraId] = true
                list[#list + 1] = extraId
            end
        end

        table.sort(list)
        return #list > 0 and list or nil
    end

    local text = tostring(value)
    if text == '' then
        return nil
    end

    local ok, decoded = pcall(json.decode, text)
    if ok and type(decoded) == 'table' then
        return parseExtrasList(decoded)
    end

    local list = {}
    local seen = {}
    for token in text:gmatch('[^,%s]+') do
        local extraId = math.floor(tonumber(token) or -1)
        if extraId >= 0 and extraId <= 30 and not seen[extraId] then
            seen[extraId] = true
            list[#list + 1] = extraId
        end
    end

    table.sort(list)
    return #list > 0 and list or nil
end

local function useQbCoreMoney()
    return GetResourceState('qb-core') == 'started'
end

local function getBuyerMoneyAccount()
    return Config.BuyerQbMoneyAccount or 'cash'
end

local function getQBCore()
    if QBCore then
        return QBCore
    end

    if not useQbCoreMoney() then
        return nil
    end

    QBCore = exports['qb-core']:GetCoreObject()
    return QBCore
end

local function canReceiveBuyerPayout(source, amount)
    if useQbCoreMoney() then
        return true
    end

    return exports.ox_inventory:CanCarryItem(source, Config.BuyerMoneyItem, amount)
end

local function giveBuyerPayout(source, amount)
    if useQbCoreMoney() then
        local success, result = pcall(function()
            local qbCore = getQBCore()

            if not qbCore then
                return false
            end

            local player = qbCore.Functions.GetPlayer(source)

            if not player then
                return false
            end

            return player.Functions.AddMoney(getBuyerMoneyAccount(), amount, 'item-buyer-sale')
        end)

        return success and result ~= false
    end

    return exports.ox_inventory:AddItem(source, Config.BuyerMoneyItem, amount)
end

local cachedWeaponItems

local function getWeaponItems()
    if cachedWeaponItems then
        return cachedWeaponItems
    end

    cachedWeaponItems = {}

    local weaponsFile = LoadResourceFile('ox_inventory', 'data/weapons.lua')

    if not weaponsFile or weaponsFile == '' then
        return cachedWeaponItems
    end

    local chunk = load(weaponsFile, '@ox_inventory/data/weapons.lua', 't', {})

    if not chunk then
        return cachedWeaponItems
    end

    local success, result = pcall(chunk)

    if not success or type(result) ~= 'table' then
        return cachedWeaponItems
    end

    for weaponName, weaponData in pairs(result) do
        if type(weaponName) == 'string' and type(weaponData) == 'table' then
            cachedWeaponItems[weaponName] = weaponData
        end
    end

    return cachedWeaponItems
end

local function getWeaponItem(itemName)
    if type(itemName) ~= 'string' or itemName == '' then
        return nil, nil
    end

    local weapons = getWeaponItems()
    local direct = weapons[itemName]

    if type(direct) == 'table' then
        return itemName, direct
    end

    local upperName = itemName:upper()
    direct = weapons[upperName]

    if type(direct) == 'table' then
        return upperName, direct
    end

    local lowerName = itemName:lower()

    for weaponName, weaponData in pairs(weapons) do
        if weaponName:lower() == lowerName then
            return weaponName, weaponData
        end
    end

    return nil, nil
end

local function getItemLabel(itemName)
    local item = exports.ox_inventory:Items(itemName)

    if item and item.label then
        return item.label
    end

    local weaponName, weapon = getWeaponItem(itemName)

    if weapon and weapon.label then
        return weapon.label
    end

    if weaponName then
        return weaponName
    end

    return itemName
end

local function getItemImage(itemName)
    local item = exports.ox_inventory:Items(itemName)
    local image = item and (item.image or item.client and item.client.image)

    if image and image:find('^nui://') then
        return image
    end

    if image then
        if not image:find('%.%w+$') then
            image = ('%s.png'):format(image)
        end

        return ('nui://ox_inventory/web/images/%s'):format(image)
    end

    local weaponName, weapon = getWeaponItem(itemName)
    local weaponImage = weapon and (weapon.image or weapon.client and weapon.client.image)

    if weaponImage and weaponImage:find('^nui://') then
        return weaponImage
    end

    if weaponImage then
        if not weaponImage:find('%.%w+$') then
            weaponImage = ('%s.png'):format(weaponImage)
        end

        return ('nui://ox_inventory/web/images/%s'):format(weaponImage)
    end

    if weaponName then
        return ('nui://ox_inventory/web/images/%s.png'):format(weaponName:lower())
    end

    return ('nui://ox_inventory/web/images/%s.png'):format(itemName)
end

local function normalizeFormula(formula, fallback)
    formula = tostring(formula or ''):gsub('%s+', '')

    if formula == '' then
        return tostring(fallback or 1)
    end

    return formula
end

local function calculateReceiveCount(formula, amount)
    formula = normalizeFormula(formula, 1)
    amount = math.max(math.floor(tonumber(amount) or 1), 1)

    local fixed = tonumber(formula)

    if fixed then
        return math.max(math.floor(fixed), 1) * amount
    end

    local minRange, maxRange = formula:match('^(%d+)%-(%d+)$')

    if minRange and maxRange then
        minRange = assert(tonumber(minRange))
        maxRange = assert(tonumber(maxRange))

        if minRange > maxRange then
            minRange, maxRange = maxRange, minRange
        end

        return math.random(minRange, maxRange) * amount
    end

    minRange, maxRange = formula:match('^random%((%d+),(%d+)%)$')

    if minRange and maxRange then
        minRange = assert(tonumber(minRange))
        maxRange = assert(tonumber(maxRange))

        if minRange > maxRange then
            minRange, maxRange = maxRange, minRange
        end

        return math.random(minRange, maxRange) * amount
    end

    return nil
end

local function toTrade(row)
    local costLabel = getItemLabel(row.cost_item)
    local receiveLabel = getItemLabel(row.receive_item)
    local receiveFormula = normalizeFormula(row.receive_formula, row.receive_count)

    return {
        index = row.id,
        trader = row.trader or 1,
        label = row.label,
        description = row.description ~= '' and row.description or ('Trade %sx %s for %sx %s'):format(row.cost_count, costLabel, receiveFormula, receiveLabel),
        icon = row.icon,
        enabled = row.enabled == 1 or row.enabled == true,
        cost = {
            item = row.cost_item,
            label = costLabel,
            image = getItemImage(row.cost_item),
            count = row.cost_count
        },
        receive = {
            item = row.receive_item,
            label = receiveLabel,
            image = getItemImage(row.receive_item),
            count = row.receive_count,
            formula = receiveFormula
        }
    }
end

local function toBuyer(row)
    local itemLabel = getItemLabel(row.item)

    return {
        index = row.id,
        buyer = row.buyer or 1,
        label = row.label,
        description = row.description ~= '' and row.description or ('Sell %sx %s for $%s'):format(row.count, itemLabel, row.price),
        enabled = row.enabled == 1 or row.enabled == true,
        item = {
            name = row.item,
            label = itemLabel,
            image = getItemImage(row.item),
            count = row.count
        },
        price = row.price
    }
end

local function toPed(row)
    local spawnX = tonumber(row.spawn_x)
    local spawnY = tonumber(row.spawn_y)
    local spawnZ = tonumber(row.spawn_z)
    local spawnW = tonumber(row.spawn_w)

    local ped = {
        index = row.id,
        enabled = row.enabled == 1 or row.enabled == true,
        showPed = row.show_ped == nil or row.show_ped == 1 or row.show_ped == true,
        type = row.type,
        model = row.model,
        coords = {
            x = row.x,
            y = row.y,
            z = row.z,
            w = row.w
        },
        scenario = row.scenario,
        targetLabel = nonEmptyString(row.target_label, getDefaultPedTargetLabel(row.type)),
        targetIcon = nonEmptyString(row.target_icon, getDefaultPedTargetIcon(row.type)),
        menuTitle = nonEmptyString(row.menu_title, row.type == 'buyer' and 'Item Buyer' or row.type == 'vehicle_spawner' and 'Vehicle Spawner' or Config.Menu.title),
        blipEnabled = row.blip_enabled == 1 or row.blip_enabled == true,
        blipSprite = tonumber(row.blip_sprite) or 280,
        exportName = row.export_name or '',
        exportResource = row.export_resource or '',
        exportSide = row.export_side or 'client',
        targetJobs = row.target_jobs or '',
        targetJobTypes = row.target_job_types or ''
    }

    if spawnX and spawnY and spawnZ then
        ped.spawnCoords = {
            x = spawnX,
            y = spawnY,
            z = spawnZ,
            w = spawnW or 0.0
        }
    end

    if row.type == 'buyer' then
        ped.buyer = row.group_id or 1
    elseif row.type == 'vehicle_spawner' then
        ped.vehicle_spawner = tonumber(row.group_id) or nil
    elseif row.type == 'decoration' or row.type == 'export' then
        -- no group ID for these types
    else
        ped.trader = row.group_id or 1
    end

    return ped
end

local function loadTrades()
    trades = {}

    local rows = MySQL.query.await(('SELECT * FROM `%s` ORDER BY `id` ASC'):format(Config.Database.table))

    for _, row in ipairs(rows or {}) do
        local trade = toTrade(row)
        trades[trade.index] = trade
    end

    tradesLoaded = true
end

local function loadBuyers()
    buyers = {}

    local rows = MySQL.query.await(('SELECT * FROM `%s` ORDER BY `id` ASC'):format(Config.BuyerDatabase.table))

    for _, row in ipairs(rows or {}) do
        local buyer = toBuyer(row)
        buyers[buyer.index] = buyer
    end

    buyersLoaded = true
end

local function loadPeds()
    peds = {}

    local rows = MySQL.query.await(('SELECT * FROM `%s` ORDER BY `id` ASC'):format(Config.PedDatabase.table))

    for _, row in ipairs(rows or {}) do
        local ped = toPed(row)
        peds[ped.index] = ped
    end

    pedsLoaded = true
end

local function seedTrades()
    if not Config.Database.seedFromConfig then
        return
    end

    local count = MySQL.scalar.await(('SELECT COUNT(*) FROM `%s`'):format(Config.Database.table))

    if count and count > 0 then
        return
    end

    for _, trade in ipairs(Config.Trades or {}) do
        MySQL.insert.await(([[
            INSERT INTO `%s` (`trader`, `label`, `description`, `cost_item`, `cost_count`, `receive_item`, `receive_count`, `receive_formula`, `icon`, `enabled`)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        ]]):format(Config.Database.table), {
            trade.trader or 1,
            trade.label,
            trade.description or '',
            trade.cost.item,
            trade.cost.count,
            trade.receive.item,
            tonumber(trade.receive.count) or 1,
            normalizeFormula(trade.receive.formula or trade.receive.count, trade.receive.count),
            trade.icon or 'right-left'
        })
    end
end

local function seedBuyers()
    if not Config.BuyerDatabase.seedFromConfig then
        return
    end

    local count = MySQL.scalar.await(('SELECT COUNT(*) FROM `%s`'):format(Config.BuyerDatabase.table))

    if count and count > 0 then
        return
    end

    for _, buyer in ipairs(Config.Buyers or {}) do
        MySQL.insert.await(([[
            INSERT INTO `%s` (`buyer`, `label`, `description`, `item`, `count`, `price`, `enabled`)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        ]]):format(Config.BuyerDatabase.table), {
            buyer.buyer or 1,
            buyer.label,
            buyer.description or '',
            buyer.item,
            buyer.count,
            buyer.price
        })
    end
end

local function seedPeds()
    if not Config.PedDatabase.seedFromConfig then
        return
    end

    local count = MySQL.scalar.await(('SELECT COUNT(*) FROM `%s`'):format(Config.PedDatabase.table))

    if count and count > 0 then
        return
    end

    for _, ped in ipairs(Config.Peds or {}) do
        local pedType = ped.buyer and 'buyer' or 'trader'
        local groupId = ped.buyer or ped.trader or 1
        local coords = ped.coords or vec4(0.0, 0.0, 0.0, 0.0)

        MySQL.insert.await(([[
            INSERT INTO `%s` (`type`, `group_id`, `model`, `x`, `y`, `z`, `w`, `scenario`, `target_label`, `target_icon`, `menu_title`, `blip_enabled`, `blip_sprite`, `show_ped`, `enabled`)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ]]):format(Config.PedDatabase.table), {
            pedType,
            groupId,
            ped.model,
            coords.x,
            coords.y,
            coords.z,
            coords.w or 0.0,
            ped.scenario or '',
            nonEmptyString(ped.targetLabel, getDefaultPedTargetLabel(pedType)),
            nonEmptyString(ped.targetIcon, getDefaultPedTargetIcon(pedType)),
            ped.menuTitle or (pedType == 'buyer' and 'Item Buyer' or Config.Menu.title),
            ped.blipEnabled and 1 or 0,
            tonumber(ped.blipSprite) or 280,
            ped.showPed == false and 0 or 1,
            ped.enabled == false and 0 or 1
        })
    end
end

local function createTable()
    MySQL.query.await(([[
        CREATE TABLE IF NOT EXISTS `%s` (
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
    ]]):format(Config.Database.table))

    MySQL.query.await(('ALTER TABLE `%s` ADD COLUMN IF NOT EXISTS `trader` int unsigned NOT NULL DEFAULT 1 AFTER `id`'):format(Config.Database.table))
    MySQL.query.await(('ALTER TABLE `%s` ADD COLUMN IF NOT EXISTS `receive_formula` varchar(40) NOT NULL DEFAULT \'1\' AFTER `receive_count`'):format(Config.Database.table))
end

local function createBuyerTable()
    MySQL.query.await(([[
        CREATE TABLE IF NOT EXISTS `%s` (
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
    ]]):format(Config.BuyerDatabase.table))
end

local function createPedTable()
    MySQL.query.await(([[
        CREATE TABLE IF NOT EXISTS `%s` (
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
            `blip_enabled` tinyint(1) NOT NULL DEFAULT 0,
            `blip_sprite` int unsigned NOT NULL DEFAULT 280,
            `show_ped` tinyint(1) NOT NULL DEFAULT 1,
            `target_jobs` varchar(255) NOT NULL DEFAULT '',
            `target_job_types` varchar(255) NOT NULL DEFAULT '',
            `spawn_x` double NULL,
            `spawn_y` double NULL,
            `spawn_z` double NULL,
            `spawn_w` double NULL,
            `export_name` varchar(100) NOT NULL DEFAULT '',
            `export_resource` varchar(100) NOT NULL DEFAULT '',
            `export_side` varchar(10) NOT NULL DEFAULT 'client',
            `enabled` tinyint(1) NOT NULL DEFAULT 1,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]]):format(Config.PedDatabase.table))

    MySQL.query.await(('ALTER TABLE `%s` ADD COLUMN IF NOT EXISTS `blip_enabled` tinyint(1) NOT NULL DEFAULT 0 AFTER `menu_title`'):format(Config.PedDatabase.table))
    MySQL.query.await(('ALTER TABLE `%s` ADD COLUMN IF NOT EXISTS `blip_sprite` int unsigned NOT NULL DEFAULT 280 AFTER `blip_enabled`'):format(Config.PedDatabase.table))
    MySQL.query.await(('ALTER TABLE `%s` ADD COLUMN IF NOT EXISTS `show_ped` tinyint(1) NOT NULL DEFAULT 1 AFTER `blip_sprite`'):format(Config.PedDatabase.table))
    MySQL.query.await(('ALTER TABLE `%s` ADD COLUMN IF NOT EXISTS `target_jobs` varchar(255) NOT NULL DEFAULT "" AFTER `show_ped`'):format(Config.PedDatabase.table))
    MySQL.query.await(('ALTER TABLE `%s` ADD COLUMN IF NOT EXISTS `target_job_types` varchar(255) NOT NULL DEFAULT "" AFTER `target_jobs`'):format(Config.PedDatabase.table))
    MySQL.query.await(('ALTER TABLE `%s` ADD COLUMN IF NOT EXISTS `spawn_x` double NULL AFTER `target_job_types`'):format(Config.PedDatabase.table))
    MySQL.query.await(('ALTER TABLE `%s` ADD COLUMN IF NOT EXISTS `spawn_y` double NULL AFTER `spawn_x`'):format(Config.PedDatabase.table))
    MySQL.query.await(('ALTER TABLE `%s` ADD COLUMN IF NOT EXISTS `spawn_z` double NULL AFTER `spawn_y`'):format(Config.PedDatabase.table))
    MySQL.query.await(('ALTER TABLE `%s` ADD COLUMN IF NOT EXISTS `spawn_w` double NULL AFTER `spawn_z`'):format(Config.PedDatabase.table))
    MySQL.query.await(('ALTER TABLE `%s` ADD COLUMN IF NOT EXISTS `export_name` varchar(100) NOT NULL DEFAULT "" AFTER `target_job_types`'):format(Config.PedDatabase.table))
    MySQL.query.await(('ALTER TABLE `%s` ADD COLUMN IF NOT EXISTS `export_resource` varchar(100) NOT NULL DEFAULT "" AFTER `export_name`'):format(Config.PedDatabase.table))
    MySQL.query.await(('ALTER TABLE `%s` ADD COLUMN IF NOT EXISTS `export_side` varchar(10) NOT NULL DEFAULT "client" AFTER `export_resource`'):format(Config.PedDatabase.table))
end

local function createVehicleSpawnerTables()
    MySQL.query.await([[
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ]])

    MySQL.query.await([[
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ]])

    pcall(function()
        MySQL.query.await('ALTER TABLE `vehicle_spawner_certs` ADD COLUMN IF NOT EXISTS `vehicle_spawner_id` int unsigned NULL AFTER `id`')
    end)
    pcall(function()
        MySQL.query.await('ALTER TABLE `vehicle_spawner_vehicles` ADD COLUMN IF NOT EXISTS `vehicle_spawner_id` int unsigned NULL AFTER `id`')
    end)
    pcall(function()
        MySQL.query.await('ALTER TABLE `vehicle_spawner_vehicles` ADD COLUMN IF NOT EXISTS `livery` int NULL AFTER `model`')
    end)
    pcall(function()
        MySQL.query.await('ALTER TABLE `vehicle_spawner_vehicles` ADD COLUMN IF NOT EXISTS `extras` text NULL AFTER `livery`')
    end)
    pcall(function()
        MySQL.query.await('ALTER TABLE `vehicle_spawner_vehicles` ADD COLUMN IF NOT EXISTS `mod_engine` tinyint NULL AFTER `extras`')
    end)
    pcall(function()
        MySQL.query.await('ALTER TABLE `vehicle_spawner_vehicles` ADD COLUMN IF NOT EXISTS `allowed_jobs` varchar(255) NOT NULL DEFAULT "" AFTER `mod_engine`')
    end)
    pcall(function()
        MySQL.query.await('ALTER TABLE `vehicle_spawner_certs` DROP INDEX `cert_type`')
    end)
    pcall(function()
        MySQL.query.await('ALTER TABLE `vehicle_spawner_certs` ADD UNIQUE KEY `unique_spawner_cert` (`vehicle_spawner_id`, `cert_type`)')
    end)
    pcall(function()
        MySQL.query.await('ALTER TABLE `vehicle_spawner_vehicles` DROP INDEX `unique_cert_model`')
    end)
    pcall(function()
        MySQL.query.await('ALTER TABLE `vehicle_spawner_vehicles` ADD UNIQUE KEY `unique_spawner_cert_model` (`vehicle_spawner_id`, `cert_type`, `model`)')
    end)
end

local function getTradeList(filter, includeDisabled)
    local list = {}

    if type(filter) == 'table' then
        for _, id in ipairs(filter) do
            local trade = trades[tonumber(id)]

            if trade and (includeDisabled or trade.enabled) then
                list[#list + 1] = trade
            end
        end

        return list
    end

    local traderId = tonumber(filter)

    for _, trade in pairs(trades) do
        if (not traderId or trade.trader == traderId) and (includeDisabled or trade.enabled) then
            list[#list + 1] = trade
        end
    end

    table.sort(list, function(first, second)
        return first.index < second.index
    end)

    return list
end

local function getTradeListWithInventory(source, filter)
    local baseList = getTradeList(filter, false)
    local list = {}

    for _, trade in ipairs(baseList) do
        local owned = exports.ox_inventory:GetItemCount(source, trade.cost.item) or 0
        list[#list + 1] = {
            index = trade.index,
            trader = trade.trader,
            label = trade.label,
            description = trade.description,
            icon = trade.icon,
            enabled = trade.enabled,
            cost = {
                item = trade.cost.item,
                label = trade.cost.label,
                image = trade.cost.image,
                count = trade.cost.count
            },
            receive = {
                item = trade.receive.item,
                label = trade.receive.label,
                image = trade.receive.image,
                count = trade.receive.count,
                formula = trade.receive.formula
            },
            owned = owned,
            canTrade = owned >= trade.cost.count
        }
    end

    return list
end

local function getBuyerList(filter, includeDisabled)
    local list = {}
    local buyerId = tonumber(filter)

    for _, buyer in pairs(buyers) do
        if (not buyerId or buyer.buyer == buyerId) and (includeDisabled or buyer.enabled) then
            list[#list + 1] = buyer
        end
    end

    table.sort(list, function(first, second)
        return first.index < second.index
    end)

    return list
end

local function getBuyerListWithInventory(source, filter)
    local baseList = getBuyerList(filter, false)
    local list = {}

    for _, buyer in ipairs(baseList) do
        local owned = exports.ox_inventory:GetItemCount(source, buyer.item.name) or 0
        list[#list + 1] = {
            index = buyer.index,
            buyer = buyer.buyer,
            label = buyer.label,
            description = buyer.description,
            enabled = buyer.enabled,
            item = {
                name = buyer.item.name,
                label = buyer.item.label,
                image = buyer.item.image,
                count = buyer.item.count
            },
            price = buyer.price,
            owned = owned,
            canSell = owned >= buyer.item.count
        }
    end

    return list
end

local function getPedList(filterType, includeDisabled)
    local list = {}

    for _, ped in pairs(peds) do
        if (not filterType or ped.type == filterType) and (includeDisabled or ped.enabled) then
            list[#list + 1] = ped
        end
    end

    table.sort(list, function(first, second)
        return first.index < second.index
    end)

    return list
end

local function normalizeAccessList(value)
    local list = {}
    local seen = {}

    if type(value) == 'table' then
        value = table.concat(value, ',')
    end

    for token in tostring(value or ''):gmatch('[^,%s]+') do
        local normalized = token:lower():gsub('[^%w_%-]', '')
        if normalized ~= '' and not seen[normalized] then
            seen[normalized] = true
            list[#list + 1] = normalized
        end
    end

    return table.concat(list, ',')
end

local function normalizePedData(data)
    local pedType = tostring(data.type or 'trader')
    local groupId = math.floor(tonumber(data.groupId) or tonumber(data.group_id) or 0)
    local model = tostring(data.model or '')
    local x = tonumber(data.x)
    local y = tonumber(data.y)
    local z = tonumber(data.z)
    local w = tonumber(data.w) or 0.0
    local spawnX = tonumber(data.spawnX or data.spawn_x)
    local spawnY = tonumber(data.spawnY or data.spawn_y)
    local spawnZ = tonumber(data.spawnZ or data.spawn_z)
    local spawnW = tonumber(data.spawnW or data.spawn_w)

    if pedType ~= 'buyer' and pedType ~= 'decoration' and pedType ~= 'export' and pedType ~= 'vehicle_spawner' then
        pedType = 'trader'
    end

    local exportSide = tostring(data.exportSide or data.export_side or 'client')
    if exportSide ~= 'server' then
        exportSide = 'client'
    end

    if pedType == 'vehicle_spawner' then
        spawnX = spawnX or x
        spawnY = spawnY or y
        spawnZ = spawnZ or z
        spawnW = spawnW or w
    else
        spawnX, spawnY, spawnZ, spawnW = nil, nil, nil, nil
    end

    return {
        type = pedType,
        groupId = (pedType == 'decoration' or pedType == 'export') and 0 or (groupId >= 1 and groupId or 1),
        model = model,
        x = x,
        y = y,
        z = z,
        w = w,
        scenario = tostring(data.scenario or ''),
        targetLabel = nonEmptyString(data.targetLabel, getDefaultPedTargetLabel(pedType)),
        targetIcon = nonEmptyString(data.targetIcon, getDefaultPedTargetIcon(pedType)),
        menuTitle = nonEmptyString(data.menuTitle, pedType == 'buyer' and 'Item Buyer' or pedType == 'vehicle_spawner' and 'Vehicle Spawner' or (pedType == 'decoration') and '' or Config.Menu.title),
        blipEnabled = data.blipEnabled == true or data.blipEnabled == 'true' or data.blipEnabled == 'on' or data.blipEnabled == 1 or data.blipEnabled == '1',
        blipSprite = math.floor(tonumber(data.blipSprite) or 280),
        showPed = data.showPed == nil or data.showPed == true or data.showPed == 'true' or data.showPed == 'on' or data.showPed == 1 or data.showPed == '1',
        targetJobs = pedType == 'vehicle_spawner' and normalizeAccessList(data.targetJobs or data.target_jobs) or '',
        targetJobTypes = pedType == 'vehicle_spawner' and normalizeAccessList(data.targetJobTypes or data.target_job_types) or '',
        spawnX = spawnX,
        spawnY = spawnY,
        spawnZ = spawnZ,
        spawnW = spawnW,
        exportName = tostring(data.exportName or data.export_name or ''),
        exportResource = tostring(data.exportResource or data.export_resource or ''),
        exportSide = exportSide
    }
end

local function isValidPedData(pedData)
    if pedData.type == 'decoration' then
        return pedData.model ~= ''
            and pedData.x ~= nil
            and pedData.y ~= nil
            and pedData.z ~= nil
    end

    if pedData.type == 'vehicle_spawner' then
        return pedData.model ~= ''
            and pedData.x ~= nil
            and pedData.y ~= nil
            and pedData.z ~= nil
            and pedData.spawnX ~= nil
            and pedData.spawnY ~= nil
            and pedData.spawnZ ~= nil
            and pedData.groupId >= 1
    end

    if pedData.type == 'export' then
        return pedData.model ~= ''
            and pedData.x ~= nil
            and pedData.y ~= nil
            and pedData.z ~= nil
            and pedData.exportName ~= ''
            and pedData.exportResource ~= ''
            and pedData.targetLabel ~= ''
    end

    return pedData.groupId >= 1
        and pedData.model ~= ''
        and pedData.x ~= nil
        and pedData.y ~= nil
        and pedData.z ~= nil
        and pedData.targetLabel ~= ''
        and pedData.menuTitle ~= ''
end

MySQL.ready(function()
    createTable()
    createBuyerTable()
    createPedTable()
    createVehicleSpawnerTables()
    seedTrades()
    seedBuyers()
    seedPeds()
    loadTrades()
    loadBuyers()
    loadPeds()
end)

lib.callback.register('item_exchange:server:getTrades', function(source, filter)
    if not tradesLoaded then
        return nil
    end

    return getTradeListWithInventory(source, filter)
end)

lib.callback.register('item_exchange:server:getAdminTrades', function(source)
    if not isAdmin(source) or not tradesLoaded then
        return nil
    end

    return getTradeList(nil, true)
end)

lib.callback.register('item_exchange:server:getAdminItems', function(source)
    if not isAdmin(source) and not isBuyerAdmin(source) then
        return nil
    end

    local items = {}
    local addedItems = {}
    local inventoryItems = exports.ox_inventory:Items()

    local function addAdminItem(itemName, label)
        local normalizedName = tostring(itemName or ''):lower()

        if normalizedName == '' or addedItems[normalizedName] then
            return
        end

        addedItems[normalizedName] = true
        items[#items + 1] = {
            name = itemName,
            label = label or itemName,
            image = getItemImage(itemName)
        }
    end

    for itemName, item in pairs(inventoryItems or {}) do
        addAdminItem(itemName, item.label or itemName)
    end

    for weaponName, weapon in pairs(getWeaponItems()) do
        addAdminItem(weaponName, weapon.label or weaponName)
    end

    table.sort(items, function(first, second)
        return first.label:lower() < second.label:lower()
    end)

    return items
end)

lib.callback.register('item_exchange:server:getBuyers', function(source, filter)
    if not buyersLoaded then
        return nil
    end

    return getBuyerListWithInventory(source, filter)
end)

lib.callback.register('item_exchange:server:getPeds', function(_)
    if not pedsLoaded then
        return nil
    end

    return getPedList(nil, true)
end)

lib.callback.register('item_exchange:server:getBuyerAdminEntries', function(source)
    if not isBuyerAdmin(source) or not buyersLoaded then
        return nil
    end

    return getBuyerList(nil, true)
end)

lib.callback.register('item_exchange:server:getAdminPeds', function(source, filterType)
    if not isPedAdmin(source) or not pedsLoaded then
        return nil
    end

    return getPedList(filterType, true)
end)

RegisterCommand(Config.Admin.command, function(source)
    if source == 0 then
        print(('Use /%s in game as an admin.'):format(Config.Admin.command))
        return
    end

    if not isAdmin(source) then
        notify(source, 'You do not have permission to use this command.', 'error')
        return
    end

    TriggerClientEvent('item_exchange:client:openAdminMenu', source)
end, false)

RegisterCommand(Config.BuyerAdmin.command, function(source)
    if source == 0 then
        print(('Use /%s in game as an admin.'):format(Config.BuyerAdmin.command))
        return
    end

    if not isBuyerAdmin(source) then
        notify(source, 'You do not have permission to use this command.', 'error')
        return
    end

    TriggerClientEvent('item_exchange:client:openBuyerAdminMenu', source)
end, false)

RegisterCommand(Config.PedAdmin.command, function(source)
    if source == 0 then
        print(('Use /%s in game as an admin.'):format(Config.PedAdmin.command))
        return
    end

    if not isPedAdmin(source) then
        notify(source, 'You do not have permission to use this command.', 'error')
        return
    end

    TriggerClientEvent('item_exchange:client:openPedAdminMenu', source)
end, false)

RegisterCommand(Config.Exchange.command, function(source)
    if source == 0 then
        print(('Use /%s in game as an admin.'):format(Config.Exchange.command))
        return
    end

    local access = {
        trades = isAdmin(source),
        buyers = isBuyerAdmin(source),
        peds = isPedAdmin(source),
        vehicles = isVehicleSpawnerAdmin(source)
    }

    if not access.trades and not access.buyers and not access.peds and not access.vehicles then
        notify(source, 'You do not have permission to use this command.', 'error')
        return
    end

    TriggerClientEvent('item_exchange:client:openExchangeAdminLauncher', source, access)
end, false)

RegisterNetEvent('item_exchange:server:trade', function(id, amount)
    local source = source
    local trade = trades[tonumber(id)]

    if not trade or not trade.enabled then
        notify(source, 'That trade is not available.', 'error')
        return
    end

    amount = math.floor(tonumber(amount) or 0)

    if amount < 1 then
        notify(source, 'Enter a valid amount.', 'error')
        return
    end

    local costItem = trade.cost.item
    local costCount = trade.cost.count * amount
    local receiveItem = trade.receive.item
    local receiveCount = calculateReceiveCount(trade.receive.formula, amount)
    local itemCount = exports.ox_inventory:GetItemCount(source, costItem)

    if not receiveCount then
        notify(source, 'This trade has an invalid receive formula.', 'error')
        return
    end

    if itemCount < costCount then
        notify(source, ('You need %sx %s.'):format(costCount, trade.cost.label), 'error')
        return
    end

    if not exports.ox_inventory:CanCarryItem(source, receiveItem, receiveCount) then
        notify(source, 'You do not have enough inventory space.', 'error')
        return
    end

    if not exports.ox_inventory:RemoveItem(source, costItem, costCount) then
        notify(source, ('Could not remove %s.'):format(trade.cost.label), 'error')
        return
    end

    if not exports.ox_inventory:AddItem(source, receiveItem, receiveCount) then
        exports.ox_inventory:AddItem(source, costItem, costCount)
        notify(source, ('Could not add %s. Your items were returned.'):format(trade.receive.label), 'error')
        return
    end

    notify(source, ('Traded %sx %s for %sx %s.'):format(costCount, trade.cost.label, receiveCount, trade.receive.label), 'success')
    TriggerClientEvent('item_exchange:client:tradeCompleted', source, costItem, costCount, receiveItem, receiveCount)
end)

RegisterNetEvent('item_exchange:server:sellBuyerItem', function(id, amount)
    local source = source
    local buyer = buyers[tonumber(id)]

    if not buyer or not buyer.enabled then
        notify(source, 'That buyer option is not available.', 'error')
        return
    end

    amount = math.floor(tonumber(amount) or 0)

    if amount < 1 then
        notify(source, 'Enter a valid amount.', 'error')
        return
    end

    local itemCount = buyer.item.count * amount
    local payout = buyer.price * amount

    if exports.ox_inventory:GetItemCount(source, buyer.item.name) < itemCount then
        notify(source, ('You need %sx %s.'):format(itemCount, buyer.item.label), 'error')
        return
    end

    if not canReceiveBuyerPayout(source, payout) then
        notify(source, 'You cannot carry that payout.', 'error')
        return
    end

    if not exports.ox_inventory:RemoveItem(source, buyer.item.name, itemCount) then
        notify(source, ('Could not remove %s.'):format(buyer.item.label), 'error')
        return
    end

    if not giveBuyerPayout(source, payout) then
        exports.ox_inventory:AddItem(source, buyer.item.name, itemCount)
        notify(source, 'Could not pay you. Your items were returned.', 'error')
        return
    end

    notify(source, ('Sold %sx %s for $%s.'):format(itemCount, buyer.item.label, payout), 'success')
    TriggerClientEvent('item_exchange:client:buyerSold', source, buyer.index, itemCount)
end)

RegisterNetEvent('item_exchange:server:adminAddTrade', function(data)
    local source = source

    if not isAdmin(source) then
        return
    end

    local label = tostring(data.label or '')
    local traderId = math.floor(tonumber(data.trader) or 0)
    local costItem = tostring(data.costItem or '')
    local receiveItem = tostring(data.receiveItem or '')
    local costCount = math.floor(tonumber(data.costCount) or 0)
    local receiveFormula = normalizeFormula(data.receiveCount, 1)
    local fixedReceiveCount = tonumber(receiveFormula)
    local receiveCount = fixedReceiveCount and math.floor(fixedReceiveCount) or 1

    if traderId < 1 or label == '' or costItem == '' or receiveItem == '' or costCount < 1 or not calculateReceiveCount(receiveFormula, 1) then
        notify(source, 'Fill out all required trade fields.', 'error')
        return
    end

    MySQL.insert.await(([[
        INSERT INTO `%s` (`trader`, `label`, `description`, `cost_item`, `cost_count`, `receive_item`, `receive_count`, `receive_formula`, `icon`, `enabled`)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ]]):format(Config.Database.table), {
        traderId,
        label,
        tostring(data.description or ''),
        costItem,
        costCount,
        receiveItem,
        receiveCount,
        receiveFormula,
        tostring(data.icon or 'right-left')
    })

    loadTrades()
    notify(source, 'Trade added.', 'success')
    TriggerClientEvent('item_exchange:client:refreshAdminMenu', source)
end)

RegisterNetEvent('item_exchange:server:adminUpdateTrade', function(data)
    local source = source

    if not isAdmin(source) then
        return
    end

    local id = tonumber(data.index)
    local trade = id and trades[id]
    local label = tostring(data.label or '')
    local traderId = math.floor(tonumber(data.trader) or 0)
    local costItem = tostring(data.costItem or '')
    local receiveItem = tostring(data.receiveItem or '')
    local costCount = math.floor(tonumber(data.costCount) or 0)
    local receiveFormula = normalizeFormula(data.receiveCount, 1)
    local fixedReceiveCount = tonumber(receiveFormula)
    local receiveCount = fixedReceiveCount and math.floor(fixedReceiveCount) or 1

    if not trade then
        notify(source, 'Trade not found.', 'error')
        return
    end

    if traderId < 1 or label == '' or costItem == '' or receiveItem == '' or costCount < 1 or not calculateReceiveCount(receiveFormula, 1) then
        notify(source, 'Fill out all required trade fields.', 'error')
        return
    end

    MySQL.update.await(([[
        UPDATE `%s`
        SET `trader` = ?, `label` = ?, `description` = ?, `cost_item` = ?, `cost_count` = ?, `receive_item` = ?, `receive_count` = ?, `receive_formula` = ?, `icon` = ?
        WHERE `id` = ?
    ]]):format(Config.Database.table), {
        traderId,
        label,
        tostring(data.description or ''),
        costItem,
        costCount,
        receiveItem,
        receiveCount,
        receiveFormula,
        tostring(data.icon or 'right-left'),
        trade.index
    })

    loadTrades()
    notify(source, 'Trade updated.', 'success')
    TriggerClientEvent('item_exchange:client:refreshAdminMenu', source)
end)

RegisterNetEvent('item_exchange:server:adminToggleTrade', function(id)
    local source = source

    if not isAdmin(source) then
        return
    end

    local trade = trades[tonumber(id)]

    if not trade then
        notify(source, 'Trade not found.', 'error')
        return
    end

    MySQL.update.await(('UPDATE `%s` SET `enabled` = ? WHERE `id` = ?'):format(Config.Database.table), {
        trade.enabled and 0 or 1,
        trade.index
    })

    loadTrades()
    notify(source, trade.enabled and 'Trade disabled.' or 'Trade enabled.', 'success')
    TriggerClientEvent('item_exchange:client:refreshAdminMenu', source)
end)

RegisterNetEvent('item_exchange:server:adminChangeTrader', function(id, traderId)
    local source = source

    if not isAdmin(source) then
        return
    end

    local trade = trades[tonumber(id)]
    traderId = math.floor(tonumber(traderId) or 0)

    if not trade or traderId < 1 then
        notify(source, 'Enter a valid trader ID.', 'error')
        return
    end

    MySQL.update.await(('UPDATE `%s` SET `trader` = ? WHERE `id` = ?'):format(Config.Database.table), {
        traderId,
        trade.index
    })

    loadTrades()
    notify(source, ('Trade moved to trader %s.'):format(traderId), 'success')
    TriggerClientEvent('item_exchange:client:refreshAdminMenu', source)
end)

RegisterNetEvent('item_exchange:server:adminDeleteTrade', function(id)
    local source = source

    if not isAdmin(source) then
        return
    end

    local trade = trades[tonumber(id)]

    if not trade then
        notify(source, 'Trade not found.', 'error')
        return
    end

    MySQL.update.await(('DELETE FROM `%s` WHERE `id` = ?'):format(Config.Database.table), { trade.index })
    loadTrades()
    notify(source, 'Trade deleted.', 'success')
    TriggerClientEvent('item_exchange:client:refreshAdminMenu', source)
end)

RegisterNetEvent('item_exchange:server:buyerAdminAddOffer', function(data)
    local source = source

    if not isBuyerAdmin(source) then
        return
    end

    local buyerId = math.floor(tonumber(data.buyer) or 0)
    local label = tostring(data.label or '')
    local item = tostring(data.item or '')
    local count = math.floor(tonumber(data.count) or 0)
    local price = math.floor(tonumber(data.price) or 0)

    if buyerId < 1 or label == '' or item == '' or count < 1 or price < 1 then
        notify(source, 'Fill out all required buyer fields.', 'error')
        return
    end

    MySQL.insert.await(([[
        INSERT INTO `%s` (`buyer`, `label`, `description`, `item`, `count`, `price`, `enabled`)
        VALUES (?, ?, ?, ?, ?, ?, 1)
    ]]):format(Config.BuyerDatabase.table), {
        buyerId,
        label,
        tostring(data.description or ''),
        item,
        count,
        price
    })

    loadBuyers()
    notify(source, 'Buyer offer added.', 'success')
    TriggerClientEvent('item_exchange:client:refreshBuyerAdminMenu', source)
end)

RegisterNetEvent('item_exchange:server:buyerAdminUpdateOffer', function(data)
    local source = source

    if not isBuyerAdmin(source) then
        return
    end

    local id = tonumber(data.index)
    local buyer = id and buyers[id]
    local buyerId = math.floor(tonumber(data.buyer) or 0)
    local label = tostring(data.label or '')
    local item = tostring(data.item or '')
    local count = math.floor(tonumber(data.count) or 0)
    local price = math.floor(tonumber(data.price) or 0)

    if not buyer then
        notify(source, 'Buyer offer not found.', 'error')
        return
    end

    if buyerId < 1 or label == '' or item == '' or count < 1 or price < 1 then
        notify(source, 'Fill out all required buyer fields.', 'error')
        return
    end

    MySQL.update.await(([[
        UPDATE `%s`
        SET `buyer` = ?, `label` = ?, `description` = ?, `item` = ?, `count` = ?, `price` = ?
        WHERE `id` = ?
    ]]):format(Config.BuyerDatabase.table), {
        buyerId,
        label,
        tostring(data.description or ''),
        item,
        count,
        price,
        buyer.index
    })

    loadBuyers()
    notify(source, 'Buyer offer updated.', 'success')
    TriggerClientEvent('item_exchange:client:refreshBuyerAdminMenu', source)
end)

RegisterNetEvent('item_exchange:server:buyerAdminToggleOffer', function(id)
    local source = source

    if not isBuyerAdmin(source) then
        return
    end

    local buyer = buyers[tonumber(id)]

    if not buyer then
        notify(source, 'Buyer offer not found.', 'error')
        return
    end

    MySQL.update.await(('UPDATE `%s` SET `enabled` = ? WHERE `id` = ?'):format(Config.BuyerDatabase.table), {
        buyer.enabled and 0 or 1,
        buyer.index
    })

    loadBuyers()
    notify(source, buyer.enabled and 'Buyer offer disabled.' or 'Buyer offer enabled.', 'success')
    TriggerClientEvent('item_exchange:client:refreshBuyerAdminMenu', source)
end)

RegisterNetEvent('item_exchange:server:buyerAdminChangeBuyer', function(id, buyerId)
    local source = source

    if not isBuyerAdmin(source) then
        return
    end

    local buyer = buyers[tonumber(id)]
    buyerId = math.floor(tonumber(buyerId) or 0)

    if not buyer or buyerId < 1 then
        notify(source, 'Enter a valid buyer ID.', 'error')
        return
    end

    MySQL.update.await(('UPDATE `%s` SET `buyer` = ? WHERE `id` = ?'):format(Config.BuyerDatabase.table), {
        buyerId,
        buyer.index
    })

    loadBuyers()
    notify(source, ('Buyer offer moved to buyer %s.'):format(buyerId), 'success')
    TriggerClientEvent('item_exchange:client:refreshBuyerAdminMenu', source)
end)

RegisterNetEvent('item_exchange:server:buyerAdminDeleteOffer', function(id)
    local source = source

    if not isBuyerAdmin(source) then
        return
    end

    local buyer = buyers[tonumber(id)]

    if not buyer then
        notify(source, 'Buyer offer not found.', 'error')
        return
    end

    MySQL.update.await(('DELETE FROM `%s` WHERE `id` = ?'):format(Config.BuyerDatabase.table), { buyer.index })
    loadBuyers()
    notify(source, 'Buyer offer deleted.', 'success')
    TriggerClientEvent('item_exchange:client:refreshBuyerAdminMenu', source)
end)

RegisterNetEvent('item_exchange:server:pedAdminAddPed', function(data)
    local source = source

    if not isPedAdmin(source) then
        return
    end

    local pedData = normalizePedData(data)

    if not isValidPedData(pedData) then
        notify(source, 'Fill out all required ped fields.', 'error')
        return
    end

    MySQL.insert.await(([[
        INSERT INTO `%s` (`type`, `group_id`, `model`, `x`, `y`, `z`, `w`, `scenario`, `target_label`, `target_icon`, `menu_title`, `blip_enabled`, `blip_sprite`, `show_ped`, `target_jobs`, `target_job_types`, `spawn_x`, `spawn_y`, `spawn_z`, `spawn_w`, `export_name`, `export_resource`, `export_side`, `enabled`)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ]]):format(Config.PedDatabase.table), {
        pedData.type,
        pedData.groupId,
        pedData.model,
        pedData.x,
        pedData.y,
        pedData.z,
        pedData.w,
        pedData.scenario,
        pedData.targetLabel,
        pedData.targetIcon,
        pedData.menuTitle,
        pedData.blipEnabled and 1 or 0,
        pedData.blipSprite,
        pedData.showPed and 1 or 0,
        pedData.targetJobs,
        pedData.targetJobTypes,
        pedData.spawnX,
        pedData.spawnY,
        pedData.spawnZ,
        pedData.spawnW,
        pedData.exportName,
        pedData.exportResource,
        pedData.exportSide
    })

    loadPeds()
    notify(source, 'Ped added.', 'success')
    TriggerClientEvent('item_exchange:client:refreshPeds', -1)
    TriggerClientEvent('item_exchange:client:refreshPedAdminMenu', source)
end)

RegisterNetEvent('item_exchange:server:pedAdminUpdatePed', function(data)
    local source = source

    if not isPedAdmin(source) then
        return
    end

    local id = tonumber(data.index)
    local ped = id and peds[id]
    local pedData = normalizePedData(data)

    if not ped then
        notify(source, 'Ped not found.', 'error')
        return
    end

    if not isValidPedData(pedData) then
        notify(source, 'Fill out all required ped fields.', 'error')
        return
    end

    MySQL.update.await(([[
        UPDATE `%s`
        SET `type` = ?, `group_id` = ?, `model` = ?, `x` = ?, `y` = ?, `z` = ?, `w` = ?, `scenario` = ?, `target_label` = ?, `target_icon` = ?, `menu_title` = ?, `blip_enabled` = ?, `blip_sprite` = ?, `show_ped` = ?, `target_jobs` = ?, `target_job_types` = ?, `spawn_x` = ?, `spawn_y` = ?, `spawn_z` = ?, `spawn_w` = ?, `export_name` = ?, `export_resource` = ?, `export_side` = ?
        WHERE `id` = ?
    ]]):format(Config.PedDatabase.table), {
        pedData.type,
        pedData.groupId,
        pedData.model,
        pedData.x,
        pedData.y,
        pedData.z,
        pedData.w,
        pedData.scenario,
        pedData.targetLabel,
        pedData.targetIcon,
        pedData.menuTitle,
        pedData.blipEnabled and 1 or 0,
        pedData.blipSprite,
        pedData.showPed and 1 or 0,
        pedData.targetJobs,
        pedData.targetJobTypes,
        pedData.spawnX,
        pedData.spawnY,
        pedData.spawnZ,
        pedData.spawnW,
        pedData.exportName,
        pedData.exportResource,
        pedData.exportSide,
        ped.index
    })

    loadPeds()
    notify(source, 'Ped updated.', 'success')
    TriggerClientEvent('item_exchange:client:refreshPeds', -1)
    TriggerClientEvent('item_exchange:client:refreshPedAdminMenu', source)
end)

RegisterNetEvent('item_exchange:server:pedAdminTogglePed', function(id)
    local source = source

    if not isPedAdmin(source) then
        return
    end

    local ped = peds[tonumber(id)]

    if not ped then
        notify(source, 'Ped not found.', 'error')
        return
    end

    MySQL.update.await(('UPDATE `%s` SET `enabled` = ? WHERE `id` = ?'):format(Config.PedDatabase.table), {
        ped.enabled and 0 or 1,
        ped.index
    })

    loadPeds()
    notify(source, ped.enabled and 'Ped disabled.' or 'Ped enabled.', 'success')
    TriggerClientEvent('item_exchange:client:refreshPeds', -1)
    TriggerClientEvent('item_exchange:client:refreshPedAdminMenu', source)
end)

RegisterNetEvent('item_exchange:server:pedAdminDeletePed', function(id)
    local source = source

    if not isPedAdmin(source) then
        return
    end

    local ped = peds[tonumber(id)]

    if not ped then
        notify(source, 'Ped not found.', 'error')
        return
    end

    MySQL.update.await(('DELETE FROM `%s` WHERE `id` = ?'):format(Config.PedDatabase.table), { ped.index })
    loadPeds()
    notify(source, 'Ped deleted.', 'success')
    TriggerClientEvent('item_exchange:client:refreshPeds', -1)
    TriggerClientEvent('item_exchange:client:refreshPedAdminMenu', source)
end)

RegisterNetEvent('item_exchange:server:triggerExportPed', function(pedIndex)
    local source = source
    local ped = peds[tonumber(pedIndex)]

    if not ped or ped.type ~= 'export' or ped.exportSide ~= 'server' then
        return
    end

    local resource = ped.exportResource
    local exportName = ped.exportName

    if not resource or resource == '' or not exportName or exportName == '' then
        return
    end

    if GetResourceState(resource) ~= 'started' then
        notify(source, ('Resource "%s" is not running.'):format(resource), 'error')
        return
    end

    exports[resource][exportName](source)
end)

-- ========== VEHICLE SPAWNER ADMIN ==========

lib.callback.register('item_exchange:server:getVehicleAdminData', function(source)
    if not isVehicleSpawnerAdmin(source) then
        return nil
    end

    local certs = MySQL.query.await('SELECT * FROM vehicle_spawner_certs ORDER BY cert_type ASC')
    local vehicles = MySQL.query.await('SELECT * FROM vehicle_spawner_vehicles ORDER BY cert_type ASC')

    return {
        certs = certs or {},
        vehicles = vehicles or {}
    }
end)

RegisterNetEvent('item_exchange:server:vehicleAdminAddCert', function(data)
    local source = source
    if not isVehicleSpawnerAdmin(source) then
        return
    end

    local certType = tostring(data.cert_type or ''):lower():gsub('%s+', '')
    local label = tostring(data.label or '')
    local maxSpawned = math.floor(tonumber(data.max_spawned) or 2)
    local rawSpawnerId = tonumber(data.vehicle_spawner_id)
    local spawnerId = rawSpawnerId and math.floor(rawSpawnerId) or nil

    if spawnerId and spawnerId < 1 then
        spawnerId = nil
    end

    if certType == '' or label == '' or maxSpawned < 1 then
        notify(source, 'Invalid certification data', 'error')
        return
    end

    MySQL.insert.await('INSERT INTO vehicle_spawner_certs (vehicle_spawner_id, cert_type, label, max_spawned) VALUES (?, ?, ?, ?)', {
        spawnerId, certType, label, maxSpawned
    }, function()
        notify(source, 'Certification added', 'success')
        TriggerClientEvent('item_exchange:client:refreshVehicleAdmin', source)
    end)
end)

RegisterNetEvent('item_exchange:server:vehicleAdminAddVehicle', function(data)
    local source = source
    if not isVehicleSpawnerAdmin(source) then
        return
    end

    local certType = tostring(data.cert_type or ''):lower():gsub('%s+', '')
    local model = tostring(data.model or '')
    local label = tostring(data.label or '')
    local rawSpawnerId = tonumber(data.vehicle_spawner_id)
    local spawnerId = rawSpawnerId and math.floor(rawSpawnerId) or nil
    local livery = tonumber(data.livery)
    local modEngine = tonumber(data.mod_engine)
    local allowedJobs = normalizeAccessList(data.allowed_jobs)
    local extrasList = parseExtrasList(data.extras)
    local extrasJson = extrasList and json.encode(extrasList) or nil

    if spawnerId and spawnerId < 1 then
        spawnerId = nil
    end

    if livery ~= nil then
        livery = math.floor(livery)
        if livery < 0 then
            livery = nil
        end
    end

    if modEngine ~= nil then
        modEngine = math.floor(modEngine)
        if modEngine < 0 or modEngine > 4 then
            modEngine = nil
        end
    end

    if certType == '' or model == '' or label == '' then
        notify(source, 'Invalid vehicle data', 'error')
        return
    end

    MySQL.insert.await('INSERT INTO vehicle_spawner_vehicles (vehicle_spawner_id, cert_type, model, label, livery, extras, mod_engine, allowed_jobs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', {
        spawnerId, certType, model, label, livery, extrasJson, modEngine, allowedJobs
    }, function()
        notify(source, 'Vehicle added', 'success')
        TriggerClientEvent('item_exchange:client:refreshVehicleAdmin', source)
    end)
end)

RegisterNetEvent('item_exchange:server:vehicleAdminDeleteCert', function(id)
    local source = source
    if not isVehicleSpawnerAdmin(source) then
        return
    end

    id = tonumber(id)
    if not id then
        return
    end

    local cert = MySQL.single.await('SELECT cert_type, vehicle_spawner_id FROM vehicle_spawner_certs WHERE id = ?', { id })
    if not cert then
        return
    end

    MySQL.update.await('DELETE FROM vehicle_spawner_certs WHERE id = ?', { id })
    MySQL.update.await('DELETE FROM vehicle_spawner_vehicles WHERE cert_type = ? AND vehicle_spawner_id <=> ?', { cert.cert_type, cert.vehicle_spawner_id })
    notify(source, 'Certification and vehicles deleted', 'success')
    TriggerClientEvent('item_exchange:client:refreshVehicleAdmin', source)
end)

RegisterNetEvent('item_exchange:server:vehicleAdminDeleteVehicle', function(id)
    local source = source
    if not isVehicleSpawnerAdmin(source) then
        return
    end

    MySQL.update.await('DELETE FROM vehicle_spawner_vehicles WHERE id = ?', { id })
    notify(source, 'Vehicle deleted', 'success')
    TriggerClientEvent('item_exchange:client:refreshVehicleAdmin', source)
end)

RegisterNetEvent('item_exchange:server:vehicleAdminToggleCert', function(id)
    local source = source
    if not isVehicleSpawnerAdmin(source) then
        return
    end

    id = tonumber(id)
    if not id then
        return
    end

    MySQL.update.await('UPDATE vehicle_spawner_certs SET enabled = NOT enabled WHERE id = ?', { id })
    notify(source, 'Certification toggled', 'success')
    TriggerClientEvent('item_exchange:client:refreshVehicleAdmin', source)
end)

RegisterNetEvent('item_exchange:server:vehicleAdminToggleVehicle', function(id)
    local source = source
    if not isVehicleSpawnerAdmin(source) then
        return
    end

    MySQL.update.await('UPDATE vehicle_spawner_vehicles SET enabled = NOT enabled WHERE id = ?', { id })
    notify(source, 'Vehicle toggled', 'success')
    TriggerClientEvent('item_exchange:client:refreshVehicleAdmin', source)
end)

-- ========== VEHICLE SPAWNER EVENTS ==========

if vehicleSpawner then
    -- Initialize vehicle spawner on MySQL ready
    local vehicleSpawnerInitialized = false
    
    local originalMySQLReady = MySQL.ready
    MySQL.ready(function()
        if not vehicleSpawnerInitialized then
            vehicleSpawner.initialize()
            vehicleSpawner.resetSpawnedVehicles()
            vehicleSpawnerInitialized = true
        end
        if originalMySQLReady then originalMySQLReady() end
    end)

    -- Callback: Check if player has certification
    lib.callback.register('item_exchange:server:hasVehicleCertification', function(source, certType)
        return vehicleSpawner.hasPlayerCertification(source, certType)
    end)

    -- Callback: Check if can spawn vehicle
    lib.callback.register('item_exchange:server:canSpawnVehicle', function(source, certType, maxSpawned, label)
        maxSpawned = math.floor(tonumber(maxSpawned) or 0)

        if maxSpawned > 0 then
            local currentCount = vehicleSpawner.getSpawnedCount(certType)

            if currentCount >= maxSpawned then
                return false, 'Maximum ' .. maxSpawned .. ' ' .. tostring(label or certType) .. ' vehicles already spawned!'
            end

            return true, ''
        end

        local canSpawn, message = vehicleSpawner.canSpawnVehicle(certType)
        return canSpawn, message
    end)

    -- Event: Vehicle spawned - track it
    RegisterNetEvent('item_exchange:server:vehicleSpawned', function(certType, netId, model, plate)
        local source = source
        vehicleSpawner.trackSpawnedVehicle(certType, netId, model, source, plate)
    end)

    -- Event: Vehicle returned - stop tracking
    RegisterNetEvent('item_exchange:server:vehicleReturned', function(certType, netId)
        vehicleSpawner.removeSpawnedVehicle(certType, netId)
    end)

    RegisterNetEvent('item_exchange:server:vehicleReturnedByNetId', function(netId)
        vehicleSpawner.removeSpawnedVehicleByNetId(netId)
    end)

    lib.callback.register('item_exchange:server:returnVehicleByNetId', function(source, netId)
        local removed, certType = vehicleSpawner.removeSpawnedVehicleByNetId(netId)
        return removed == true, certType
    end)

    -- Get available vehicles for player
    lib.callback.register('item_exchange:server:getAvailableVehicles', function(source, spawnerId)
        local available = {}

        spawnerId = tonumber(spawnerId)
        if spawnerId then
            spawnerId = math.floor(spawnerId)
            if spawnerId < 1 then
                spawnerId = nil
            end
        end

        local certs = MySQL.query.await('SELECT * FROM vehicle_spawner_certs WHERE enabled = 1 AND (vehicle_spawner_id IS NULL OR vehicle_spawner_id = ?) ORDER BY cert_type ASC, vehicle_spawner_id IS NULL ASC', {
            spawnerId
        }) or {}

        if #certs > 0 then
            local processedCerts = {}

            for _, cert in ipairs(certs) do
                local certType = cert.cert_type

                if certType and not processedCerts[certType] then
                    processedCerts[certType] = true

                    if vehicleSpawner.hasPlayerCertification(source, certType) then
                        local vehicles = MySQL.query.await('SELECT DISTINCT model, label, livery, extras, mod_engine, allowed_jobs FROM vehicle_spawner_vehicles WHERE enabled = 1 AND cert_type = ? AND (vehicle_spawner_id IS NULL OR vehicle_spawner_id = ?) ORDER BY label ASC', {
                        certType, spawnerId
                    }) or {}

                        local filteredVehicles = {}
                        for _, vehicle in ipairs(vehicles) do
                            if isVehicleAllowedForJob(vehicle.allowed_jobs, source) then
                                local extras = parseExtrasList(vehicle.extras)
                                filteredVehicles[#filteredVehicles + 1] = {
                                    model = vehicle.model,
                                    label = vehicle.label,
                                    livery = vehicle.livery,
                                    extras = extras,
                                    modEngine = vehicle.mod_engine,
                                    allowedJobs = vehicle.allowed_jobs or ''
                                }
                            end
                        end

                        if #filteredVehicles > 0 then
                            available[certType] = {
                                label = cert.label,
                                maxSpawned = cert.max_spawned,
                                vehicles = filteredVehicles
                            }
                        end
                    end
                end
            end

            return available
        end

        if not Config.VehicleSpawner or not Config.VehicleSpawner.vehicles then
            return available
        end
        
        for certType, config in pairs(Config.VehicleSpawner.vehicles) do
            -- Check if spawner ID filter is set and matches
            if spawnerId and config.vehicle_spawner_id and config.vehicle_spawner_id ~= spawnerId then
                goto continue
            end
            
            if vehicleSpawner.hasPlayerCertification(source, certType) then
                available[certType] = config
            end
            
            ::continue::
        end
        
        return available
    end)
end