local trades = {}
local tradesLoaded = false
local buyers = {}
local buyersLoaded = false
local peds = {}
local pedsLoaded = false
local QBCore

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

local function getItemLabel(itemName)
    local item = exports.ox_inventory:Items(itemName)

    if item and item.label then
        return item.label
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
    local ped = {
        index = row.id,
        enabled = row.enabled == 1 or row.enabled == true,
        type = row.type,
        model = row.model,
        coords = {
            x = row.x,
            y = row.y,
            z = row.z,
            w = row.w
        },
        scenario = row.scenario,
        targetLabel = row.target_label,
        targetIcon = row.target_icon,
        menuTitle = row.menu_title
    }

    if row.type == 'buyer' then
        ped.buyer = row.group_id or 1
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
            INSERT INTO `%s` (`type`, `group_id`, `model`, `x`, `y`, `z`, `w`, `scenario`, `target_label`, `target_icon`, `menu_title`, `enabled`)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ]]):format(Config.PedDatabase.table), {
            pedType,
            groupId,
            ped.model,
            coords.x,
            coords.y,
            coords.z,
            coords.w or 0.0,
            ped.scenario or '',
            ped.targetLabel or (pedType == 'buyer' and 'Buyer' or 'Trader'),
            ped.targetIcon or (pedType == 'buyer' and 'fa-solid fa-dollar-sign' or 'fa-solid fa-hand-holding-dollar'),
            ped.menuTitle or (pedType == 'buyer' and 'Item Buyer' or Config.Menu.title),
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
            `enabled` tinyint(1) NOT NULL DEFAULT 1,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]]):format(Config.PedDatabase.table))
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

local function normalizePedData(data)
    local pedType = tostring(data.type or 'trader')
    local groupId = math.floor(tonumber(data.groupId) or tonumber(data.group_id) or 0)
    local model = tostring(data.model or '')
    local x = tonumber(data.x)
    local y = tonumber(data.y)
    local z = tonumber(data.z)
    local w = tonumber(data.w) or 0.0

    if pedType ~= 'buyer' then
        pedType = 'trader'
    end

    return {
        type = pedType,
        groupId = groupId,
        model = model,
        x = x,
        y = y,
        z = z,
        w = w,
        scenario = tostring(data.scenario or ''),
        targetLabel = tostring(data.targetLabel or (pedType == 'buyer' and 'Buyer' or 'Trader')),
        targetIcon = tostring(data.targetIcon or (pedType == 'buyer' and 'fa-solid fa-dollar-sign' or 'fa-solid fa-hand-holding-dollar')),
        menuTitle = tostring(data.menuTitle or (pedType == 'buyer' and 'Item Buyer' or Config.Menu.title))
    }
end

local function isValidPedData(pedData)
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
    seedTrades()
    seedBuyers()
    seedPeds()
    loadTrades()
    loadBuyers()
    loadPeds()
end)

lib.callback.register('item_exchange:server:getTrades', function(_, filter)
    if not tradesLoaded then
        return nil
    end

    return getTradeList(filter, false)
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
    local inventoryItems = exports.ox_inventory:Items()

    for itemName, item in pairs(inventoryItems or {}) do
        items[#items + 1] = {
            name = itemName,
            label = item.label or itemName,
            image = getItemImage(itemName)
        }
    end

    table.sort(items, function(first, second)
        return first.label < second.label
    end)

    return items
end)

lib.callback.register('item_exchange:server:getBuyers', function(_, filter)
    if not buyersLoaded then
        return nil
    end

    return getBuyerList(filter, false)
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
        peds = isPedAdmin(source)
    }

    if not access.trades and not access.buyers and not access.peds then
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
        INSERT INTO `%s` (`type`, `group_id`, `model`, `x`, `y`, `z`, `w`, `scenario`, `target_label`, `target_icon`, `menu_title`, `enabled`)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
        pedData.menuTitle
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
        SET `type` = ?, `group_id` = ?, `model` = ?, `x` = ?, `y` = ?, `z` = ?, `w` = ?, `scenario` = ?, `target_label` = ?, `target_icon` = ?, `menu_title` = ?
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