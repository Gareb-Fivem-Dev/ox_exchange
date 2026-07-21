local exchangePeds = {}
local configuredPeds = {}

local function getTraderPeds()
    return configuredPeds
end

local function getPedByIndex(index)
    for _, ped in ipairs(getTraderPeds()) do
        if ped.index == index then
            return ped
        end
    end

    return nil
end

local function getAdminPeds(pedType)
    local peds = {}

    for index, ped in ipairs(getTraderPeds()) do
        if pedType == 'buyer' and ped.buyer then
            local adminPed = table.clone(ped)
            adminPed.configIndex = index
            peds[#peds + 1] = adminPed
        elseif pedType == 'trader' and ped.trader then
            local adminPed = table.clone(ped)
            adminPed.configIndex = index
            peds[#peds + 1] = adminPed
        end
    end

    return peds
end

local function getTraderFilter(trader)
    if not trader then
        return nil
    end

    return trader.trader or trader.trades
end

local function getBuyerFilter(trader)
    if not trader then
        return nil
    end

    return trader.buyer or trader.buyers
end

local function openWebExchangeMenu(trader)
    local trades = lib.callback.await('item_exchange:server:getTrades', false, getTraderFilter(trader))

    if not trades then
        lib.notify({
            description = 'Trades are not loaded yet.',
            type = 'error'
        })
        return
    end

    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'open',
        title = trader and trader.menuTitle or Config.Menu.title,
        trades = trades
    })
end

local function openOxExchangeMenu(trader)
    local options = {}
    local trades = lib.callback.await('item_exchange:server:getTrades', false, getTraderFilter(trader))

    if not trades then
        lib.notify({
            description = 'Trades are not loaded yet.',
            type = 'error'
        })
        return
    end

    for _, trade in ipairs(trades) do
        options[#options + 1] = {
            title = trade.label,
            description = trade.description,
            icon = trade.icon or 'right-left',
            event = 'item_exchange:client:selectTrade',
            args = trade
        }
    end

    lib.registerContext({
        id = Config.Menu.id,
        title = trader and trader.menuTitle or Config.Menu.title,
        options = options
    })

    lib.showContext(Config.Menu.id)
end

local function openExchangeMenu(trader)
    if Config.Menu.useWebUi then
        openWebExchangeMenu(trader)
        return
    end

    openOxExchangeMenu(trader)
end

local function openBuyerMenu(trader)
    local buyers = lib.callback.await('item_exchange:server:getBuyers', false, getBuyerFilter(trader))

    if not buyers then
        lib.notify({
            description = 'Buyers are not loaded yet.',
            type = 'error'
        })
        return
    end

    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'openBuyer',
        title = trader and trader.menuTitle or 'Item Buyer',
        buyers = buyers
    })
end

RegisterNUICallback('close', function(_, cb)
    SetNuiFocus(false, false)
    cb({ ok = true })
end)

RegisterNUICallback('trade', function(data, cb)
    local index = tonumber(data.index)
    local amount = math.floor(tonumber(data.amount) or 0)

    if not index or amount < 1 then
        lib.notify({
            description = 'Enter a valid amount.',
            type = 'error'
        })

        cb({ ok = false })
        return
    end

    TriggerServerEvent('item_exchange:server:trade', index, amount)
    cb({ ok = true })
end)

RegisterNUICallback('buyerSell', function(data, cb)
    local index = tonumber(data.index)
    local amount = math.floor(tonumber(data.amount) or 0)

    if not index or amount < 1 then
        lib.notify({
            description = 'Enter a valid amount.',
            type = 'error'
        })

        cb({ ok = false })
        return
    end

    TriggerServerEvent('item_exchange:server:sellBuyerItem', index, amount)
    cb({ ok = true })
end)

RegisterNetEvent('item_exchange:client:selectTrade', function(trade)
    if not trade then
        return
    end

    local input = lib.inputDialog(trade.label, {
        {
            type = 'number',
            label = 'Amount',
            description = ('Each trade costs %sx %s and gives %sx %s'):format(trade.cost.count, trade.cost.label, trade.receive.formula or trade.receive.count, trade.receive.label),
            required = true,
            min = 1,
            default = 1
        }
    })

    if not input then
        return
    end

    local amount = math.floor(tonumber(input[1]) or 0)

    if amount < 1 then
        lib.notify({
            description = 'Enter a valid amount.',
            type = 'error'
        })
        return
    end

    local totalCost = trade.cost.count * amount
    local totalReceive = trade.receive.formula or trade.receive.count

    local alert = lib.alertDialog({
        header = trade.label,
        content = ('Trade **%sx %s** for **%s per trade x %s**?'):format(totalCost, trade.cost.label, totalReceive, trade.receive.label),
        centered = true,
        cancel = true
    })

    if alert == 'confirm' then
        TriggerServerEvent('item_exchange:server:trade', trade.index, amount)
    end
end)

local function openAdminTradeActions(trade)
    lib.registerContext({
        id = 'item_exchange_admin_trade',
        title = trade.label,
        menu = 'item_exchange_admin_menu',
        options = {
            {
                title = trade.enabled and 'Disable Trade' or 'Enable Trade',
                description = ('Trader %s - ID %s: %sx %s to %sx %s'):format(trade.trader, trade.index, trade.cost.count, trade.cost.label, trade.receive.formula or trade.receive.count, trade.receive.label),
                icon = trade.enabled and 'toggle-right' or 'toggle-left',
                event = 'item_exchange:client:adminToggleTrade',
                args = trade.index
            },
            {
                title = 'Change Trader ID',
                description = 'Move this trade to another trader menu',
                icon = 'users',
                event = 'item_exchange:client:adminChangeTrader',
                args = trade
            },
            {
                title = 'Delete Trade',
                description = 'Remove this trade from the database',
                icon = 'trash',
                event = 'item_exchange:client:adminDeleteTrade',
                args = trade.index
            }
        }
    })

    lib.showContext('item_exchange_admin_trade')
end

local function openAdminMenu()
    local trades = lib.callback.await('item_exchange:server:getAdminTrades', false)
    local items = lib.callback.await('item_exchange:server:getAdminItems', false)

    if not trades or not items then
        lib.notify({
            description = 'You do not have permission to use this menu.',
            type = 'error'
        })
        return
    end

    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'openAdmin',
        title = 'Exchange Admin',
        trades = trades,
        items = items,
        peds = getAdminPeds('trader')
    })
end

local function openBuyerAdminMenu()
    local buyers = lib.callback.await('item_exchange:server:getBuyerAdminEntries', false)
    local items = lib.callback.await('item_exchange:server:getAdminItems', false)

    if not buyers or not items then
        lib.notify({
            description = 'You do not have permission to use this menu.',
            type = 'error'
        })
        return
    end

    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'openBuyerAdmin',
        title = 'Buyer Admin',
        buyers = buyers,
        items = items,
        peds = getAdminPeds('buyer')
    })
end

local function openPedAdminMenu()
    local peds = lib.callback.await('item_exchange:server:getAdminPeds', false)

    if not peds then
        lib.notify({
            description = 'You do not have permission to use this menu.',
            type = 'error'
        })
        return
    end

    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'openPedAdmin',
        title = 'Ped Admin',
        peds = peds
    })
end

local function openExchangeAdminLauncher(access)
    local options = {}

    if access and access.trades then
        options[#options + 1] = {
            title = 'Trade Admin',
            description = ('Open /%s'):format(Config.Admin.command),
            icon = 'right-left',
            onSelect = openAdminMenu
        }
    end

    if access and access.buyers then
        options[#options + 1] = {
            title = 'Buyer Admin',
            description = ('Open /%s'):format(Config.BuyerAdmin.command),
            icon = 'dollar-sign',
            onSelect = openBuyerAdminMenu
        }
    end

    if access and access.peds then
        options[#options + 1] = {
            title = 'Ped Admin',
            description = ('Open /%s'):format(Config.PedAdmin.command),
            icon = 'user-gear',
            onSelect = openPedAdminMenu
        }
    end

    if #options < 1 then
        lib.notify({
            description = 'You do not have permission to use this menu.',
            type = 'error'
        })
        return
    end

    lib.registerContext({
        id = 'item_exchange_admin_launcher',
        title = 'Item Exchange Admin',
        options = options
    })

    lib.showContext('item_exchange_admin_launcher')
end

RegisterNUICallback('adminAddTrade', function(data, cb)
    TriggerServerEvent('item_exchange:server:adminAddTrade', data)
    cb({ ok = true })
end)

RegisterNUICallback('adminUpdateTrade', function(data, cb)
    TriggerServerEvent('item_exchange:server:adminUpdateTrade', data)
    cb({ ok = true })
end)

RegisterNUICallback('adminToggleTrade', function(data, cb)
    TriggerServerEvent('item_exchange:server:adminToggleTrade', data.index)
    cb({ ok = true })
end)

RegisterNUICallback('adminDeleteTrade', function(data, cb)
    TriggerServerEvent('item_exchange:server:adminDeleteTrade', data.index)
    cb({ ok = true })
end)

RegisterNUICallback('adminChangeTrader', function(data, cb)
    TriggerServerEvent('item_exchange:server:adminChangeTrader', data.index, data.trader)
    cb({ ok = true })
end)

RegisterNUICallback('adminTeleportPed', function(data, cb)
    local pedIndex = tonumber(data.index)
    local trader = pedIndex and getTraderPeds()[pedIndex]

    if not trader or not trader.coords then
        lib.notify({
            description = 'Trader ped not found.',
            type = 'error'
        })
        cb({ ok = false })
        return
    end

    local playerPed = PlayerPedId()
    SetEntityCoords(playerPed, trader.coords.x, trader.coords.y, trader.coords.z, false, false, false, false)
    SetEntityHeading(playerPed, trader.coords.w or GetEntityHeading(playerPed))

    lib.notify({
        description = ('Teleported to %s.'):format(trader.menuTitle or trader.targetLabel or 'trader'),
        type = 'success'
    })

    cb({ ok = true })
end)

RegisterNUICallback('buyerAdminAddOffer', function(data, cb)
    TriggerServerEvent('item_exchange:server:buyerAdminAddOffer', data)
    cb({ ok = true })
end)

RegisterNUICallback('buyerAdminUpdateOffer', function(data, cb)
    TriggerServerEvent('item_exchange:server:buyerAdminUpdateOffer', data)
    cb({ ok = true })
end)

RegisterNUICallback('buyerAdminToggleOffer', function(data, cb)
    TriggerServerEvent('item_exchange:server:buyerAdminToggleOffer', data.index)
    cb({ ok = true })
end)

RegisterNUICallback('buyerAdminDeleteOffer', function(data, cb)
    TriggerServerEvent('item_exchange:server:buyerAdminDeleteOffer', data.index)
    cb({ ok = true })
end)

RegisterNUICallback('buyerAdminChangeBuyer', function(data, cb)
    TriggerServerEvent('item_exchange:server:buyerAdminChangeBuyer', data.index, data.buyer)
    cb({ ok = true })
end)

RegisterNUICallback('buyerAdminTeleportPed', function(data, cb)
    local pedIndex = tonumber(data.index)
    local trader = pedIndex and getTraderPeds()[pedIndex]

    if not trader or not trader.coords then
        lib.notify({
            description = 'Buyer ped not found.',
            type = 'error'
        })
        cb({ ok = false })
        return
    end

    local playerPed = PlayerPedId()
    SetEntityCoords(playerPed, trader.coords.x, trader.coords.y, trader.coords.z, false, false, false, false)
    SetEntityHeading(playerPed, trader.coords.w or GetEntityHeading(playerPed))

    lib.notify({
        description = ('Teleported to %s.'):format(trader.menuTitle or trader.targetLabel or 'buyer'),
        type = 'success'
    })

    cb({ ok = true })
end)

RegisterNUICallback('pedAdminAddPed', function(data, cb)
    TriggerServerEvent('item_exchange:server:pedAdminAddPed', data)
    cb({ ok = true })
end)

RegisterNUICallback('pedAdminUpdatePed', function(data, cb)
    TriggerServerEvent('item_exchange:server:pedAdminUpdatePed', data)
    cb({ ok = true })
end)

RegisterNUICallback('pedAdminTogglePed', function(data, cb)
    TriggerServerEvent('item_exchange:server:pedAdminTogglePed', data.index)
    cb({ ok = true })
end)

RegisterNUICallback('pedAdminDeletePed', function(data, cb)
    TriggerServerEvent('item_exchange:server:pedAdminDeletePed', data.index)
    cb({ ok = true })
end)

RegisterNUICallback('pedAdminTeleportPed', function(data, cb)
    local pedIndex = tonumber(data.index)
    local trader = pedIndex and getPedByIndex(pedIndex)

    if not trader or not trader.coords then
        lib.notify({
            description = 'Ped not found.',
            type = 'error'
        })
        cb({ ok = false })
        return
    end

    local playerPed = PlayerPedId()
    SetEntityCoords(playerPed, trader.coords.x, trader.coords.y, trader.coords.z, false, false, false, false)
    SetEntityHeading(playerPed, trader.coords.w or GetEntityHeading(playerPed))

    lib.notify({
        description = ('Teleported to %s.'):format(trader.menuTitle or trader.targetLabel or 'ped'),
        type = 'success'
    })

    cb({ ok = true })
end)

RegisterNUICallback('pedAdminUseCurrentCoords', function(_, cb)
    local playerPed = PlayerPedId()
    local coords = GetEntityCoords(playerPed)

    cb({
        ok = true,
        x = coords.x,
        y = coords.y,
        z = coords.z,
        w = GetEntityHeading(playerPed)
    })
end)

local function openOxAdminMenu()
    local trades = lib.callback.await('item_exchange:server:getAdminTrades', false)

    if not trades then
        lib.notify({
            description = 'You do not have permission to use this menu.',
            type = 'error'
        })
        return
    end

    local options = {
        {
            title = 'Add Trade',
            description = 'Create a new database trade',
            icon = 'plus',
            event = 'item_exchange:client:adminAddTrade'
        }
    }

    for _, trade in ipairs(trades) do
        options[#options + 1] = {
            title = ('[Trader %s] [%s] %s'):format(trade.trader, trade.index, trade.label),
            description = ('%s%sx %s to %sx %s'):format(trade.enabled and '' or 'Disabled - ', trade.cost.count, trade.cost.label, trade.receive.formula or trade.receive.count, trade.receive.label),
            icon = trade.enabled and 'right-left' or 'ban',
            onSelect = function()
                openAdminTradeActions(trade)
            end
        }
    end

    lib.registerContext({
        id = 'item_exchange_admin_menu',
        title = 'Exchange Admin',
        options = options
    })

    lib.showContext('item_exchange_admin_menu')
end

RegisterNetEvent('item_exchange:client:openAdminMenu', openAdminMenu)

RegisterNetEvent('item_exchange:client:openBuyerAdminMenu', openBuyerAdminMenu)

RegisterNetEvent('item_exchange:client:openPedAdminMenu', openPedAdminMenu)

RegisterNetEvent('item_exchange:client:openExchangeAdminLauncher', openExchangeAdminLauncher)

RegisterNetEvent('item_exchange:client:adminAddTrade', function()
    local input = lib.inputDialog('Add Trade', {
        { type = 'number', label = 'Trader ID', description = 'Peds with the same trader number show this trade', required = true, min = 1, default = 1 },
        { type = 'input', label = 'Menu Label', required = true, placeholder = 'Buy Blacksmith Coal Ore' },
        { type = 'input', label = 'Description', required = false, placeholder = 'Trade coal ore for blacksmith coal ore' },
        { type = 'input', label = 'Cost Item Spawn Name', required = true, placeholder = 'coalore' },
        { type = 'number', label = 'Cost Count', required = true, min = 1, default = 1 },
        { type = 'input', label = 'Receive Item Spawn Name', required = true, placeholder = 'bs_coalore' },
        { type = 'input', label = 'Receive Count or Formula', description = 'Use 1, 1-3, or random(1,3)', required = true, default = '1' },
        { type = 'input', label = 'Icon', required = false, placeholder = 'right-left' }
    })

    if not input then
        return
    end

    TriggerServerEvent('item_exchange:server:adminAddTrade', {
        trader = input[1],
        label = input[2],
        description = input[3],
        costItem = input[4],
        costCount = input[5],
        receiveItem = input[6],
        receiveCount = input[7],
        icon = input[8]
    })
end)

RegisterNetEvent('item_exchange:client:adminChangeTrader', function(trade)
    local input = lib.inputDialog('Change Trader ID', {
        { type = 'number', label = 'Trader ID', required = true, min = 1, default = trade.trader }
    })

    if not input then
        return
    end

    TriggerServerEvent('item_exchange:server:adminChangeTrader', trade.index, input[1])
end)

RegisterNetEvent('item_exchange:client:adminToggleTrade', function(id)
    TriggerServerEvent('item_exchange:server:adminToggleTrade', id)
end)

RegisterNetEvent('item_exchange:client:adminDeleteTrade', function(id)
    local alert = lib.alertDialog({
        header = 'Delete Trade',
        content = ('Delete trade ID %s?'):format(id),
        centered = true,
        cancel = true
    })

    if alert == 'confirm' then
        TriggerServerEvent('item_exchange:server:adminDeleteTrade', id)
    end
end)

RegisterNetEvent('item_exchange:client:refreshAdminMenu', function()
    openAdminMenu()
end)

RegisterNetEvent('item_exchange:client:refreshBuyerAdminMenu', function()
    openBuyerAdminMenu()
end)

RegisterNetEvent('item_exchange:client:refreshPedAdminMenu', function()
    openPedAdminMenu()
end)

local function deleteExchangePeds()
    for _, exchangePed in ipairs(exchangePeds) do
        if DoesEntityExist(exchangePed) then
            exports.ox_target:removeLocalEntity(exchangePed)
            DeleteEntity(exchangePed)
        end
    end

    exchangePeds = {}
end

local function spawnExchangePed(trader)
    if not trader.enabled then
        return
    end

    lib.requestModel(trader.model)

    local exchangePed = CreatePed(0, joaat(trader.model), trader.coords.x, trader.coords.y, trader.coords.z - 1.0, trader.coords.w, false, false)
    exchangePeds[#exchangePeds + 1] = exchangePed

    SetEntityInvincible(exchangePed, true)
    SetBlockingOfNonTemporaryEvents(exchangePed, true)
    FreezeEntityPosition(exchangePed, true)

    if trader.scenario then
        TaskStartScenarioInPlace(exchangePed, trader.scenario, 0, true)
    end

    exports.ox_target:addLocalEntity(exchangePed, {
        {
            label = trader.targetLabel,
            icon = trader.targetIcon,
            onSelect = function()
                if trader.buyer then
                    openBuyerMenu(trader)
                    return
                end

                openExchangeMenu(trader)
            end
        }
    })

    SetModelAsNoLongerNeeded(joaat(trader.model))
end

local function loadConfiguredPeds()
    local peds = lib.callback.await('item_exchange:server:getPeds', false)

    if not peds then
        lib.notify({
            description = 'Peds are not loaded yet.',
            type = 'error'
        })
        return false
    end

    configuredPeds = peds
    return true
end

local function spawnConfiguredPeds()
    deleteExchangePeds()

    for _, trader in ipairs(getTraderPeds()) do
        spawnExchangePed(trader)
    end
end

RegisterNetEvent('item_exchange:client:refreshPeds', function()
    if loadConfiguredPeds() then
        spawnConfiguredPeds()
    end
end)

CreateThread(function()
    for _ = 1, 20 do
        if loadConfiguredPeds() then
            spawnConfiguredPeds()
            return
        end

        Wait(1000)
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then
        return
    end

    deleteExchangePeds()

    SetNuiFocus(false, false)
end)