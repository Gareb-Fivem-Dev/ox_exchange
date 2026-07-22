local exchangePeds = {}
local exchangeBlips = {}
local exchangeTargetZones = {}
local configuredPeds = {}
local previewVehicle = nil
local previewActive = false

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

local function getVehicleSpawnerFilter(trader)
    if not trader then
        return nil
    end

    return trader.vehicle_spawner or trader.vehicleSpawner
end

local function nonEmpty(value, fallback)
    if value == nil or tostring(value) == '' then
        return fallback
    end

    return value
end

local function getPedBlipLabel(trader)
    return nonEmpty(trader.menuTitle, nonEmpty(trader.targetLabel, trader.type == 'vehicle_spawner' and 'Vehicle Spawner' or (trader.buyer and 'Item Buyer' or Config.Menu.title)))
end

local function clearPreviewVehicle(showMessage)
    if previewVehicle and DoesEntityExist(previewVehicle) then
        SetEntityAsMissionEntity(previewVehicle, true, true)
        DeleteVehicle(previewVehicle)
        DeleteEntity(previewVehicle)
    end

    previewVehicle = nil
    previewActive = false

    if lib and lib.hideTextUI then
        pcall(function()
            lib.hideTextUI()
        end)
    end

    if showMessage then
        lib.notify({
            description = 'Preview vehicle returned.',
            type = 'inform'
        })
    end
end

CreateThread(function()
    while true do
        if previewActive then
            if not previewVehicle or not DoesEntityExist(previewVehicle) then
                clearPreviewVehicle(false)
                Wait(250)
            else
                if lib and lib.showTextUI then
                    lib.showTextUI('[E] Return Preview Vehicle')
                end

                if IsControlJustReleased(0, 38) then
                    clearPreviewVehicle(true)
                    Wait(250)
                else
                    Wait(0)
                end
            end
        else
            Wait(500)
        end
    end
end)

local function applyVehicleCustomization(veh, vehicle)
    SetVehicleModKit(veh, 0)

    if vehicle.livery ~= nil then
        local livery = math.floor(tonumber(vehicle.livery) or -1)
        if livery >= 0 then
            SetVehicleLivery(veh, livery)
            SetVehicleMod(veh, 48, livery, false)
        end
    end

    if vehicle.modEngine ~= nil then
        local engineMod = math.floor(tonumber(vehicle.modEngine) or -1)
        if engineMod >= 0 and engineMod <= 4 then
            SetVehicleMod(veh, 11, engineMod, false)
        end
    end

    if type(vehicle.extras) == 'table' and #vehicle.extras > 0 then
        for extraId = 0, 30 do
            if DoesExtraExist(veh, extraId) then
                SetVehicleExtra(veh, extraId, true)
            end
        end

        for _, extraId in ipairs(vehicle.extras) do
            local normalizedExtraId = math.floor(tonumber(extraId) or -1)
            if normalizedExtraId >= 0 and DoesExtraExist(veh, normalizedExtraId) then
                SetVehicleExtra(veh, normalizedExtraId, false)
            end
        end
    end
end

local function getVehicleSpawnPoint(ped)
    local playerPed = PlayerPedId()
    local playerCoords = GetEntityCoords(playerPed)
    local spawnCoords = ped.spawnCoords or ped.coords or playerCoords
    local heading = (ped.spawnCoords and tonumber(ped.spawnCoords.w))
        or (ped.coords and tonumber(ped.coords.w))
        or GetEntityHeading(playerPed)

    return playerPed, spawnCoords, heading
end

local function spawnSelectedVehicle(ped, certType, vehicle, isPreview)
    local playerPed, spawnCoords, heading = getVehicleSpawnPoint(ped)

    lib.requestModel(joaat(vehicle.model))
    local veh = CreateVehicle(joaat(vehicle.model), spawnCoords.x or spawnCoords[1], spawnCoords.y or spawnCoords[2], spawnCoords.z or spawnCoords[3], heading, true, false)

    if not veh then
        lib.notify({
            description = 'Failed to spawn vehicle!',
            type = 'error'
        })
        SetModelAsNoLongerNeeded(joaat(vehicle.model))
        return
    end

    applyVehicleCustomization(veh, vehicle)
    SetVehicleOnGroundProperly(veh)
    TaskWarpPedIntoVehicle(playerPed, veh, -1)

    if isPreview then
        clearPreviewVehicle(false)
        previewVehicle = veh
        previewActive = true
        lib.notify({
            description = 'Preview spawned. Press E to return it.',
            type = 'inform'
        })
    else
        local plate = GetVehicleNumberPlateText(veh)
        local netId = VehToNet(veh)
        exports.wasabi_carlock:GiveKey(plate)
        exports["lc_fuel"]:SetFuel(veh, 100)

        TriggerServerEvent('item_exchange:server:vehicleSpawned', certType, netId, vehicle.model, plate)
        lib.notify({
            description = 'Vehicle spawned!',
            type = 'success'
        })
    end

    SetModelAsNoLongerNeeded(joaat(vehicle.model))
end

local function getVehicleReturnDistance()
    local configured = Config.VehicleSpawner and (Config.VehicleSpawner.returnDistance or Config.VehicleSpawner.proximityReturnDistance)
    local fallback = Config.ProximityReturnDistance or 20.0
    return tonumber(configured or fallback) or 20.0
end

local function getVehicleDisplayName(veh, fallbackLabel)
    local modelHash = GetEntityModel(veh)
    local modelName = GetDisplayNameFromVehicleModel(modelHash)

    if modelName and modelName ~= '' then
        local label = GetLabelText(modelName)
        if label and label ~= '' and label ~= 'NULL' then
            return label
        end
    end

    return fallbackLabel or modelName or 'Unknown Vehicle'
end

local function findNearestAllowedVehicle(allowedByHash)
    local playerPed = PlayerPedId()
    local playerCoords = GetEntityCoords(playerPed)
    local maxDistance = getVehicleReturnDistance()
    local nearestVeh = 0
    local nearestDistance = maxDistance + 0.001

    for _, veh in ipairs(GetGamePool('CVehicle')) do
        if DoesEntityExist(veh) then
            local modelHash = GetEntityModel(veh)
            if allowedByHash[modelHash] then
                local vehCoords = GetEntityCoords(veh)
                local distance = #(playerCoords - vehCoords)
                if distance < nearestDistance then
                    nearestDistance = distance
                    nearestVeh = veh
                end
            end
        end
    end

    return nearestVeh
end

local function returnCurrentVehicleFromMenu(allowedByHash)
    clearPreviewVehicle(false)

    local playerPed = PlayerPedId()
    local veh = GetVehiclePedIsIn(playerPed, false)
    if veh == 0 then
        veh = findNearestAllowedVehicle(allowedByHash)
    else
        if GetPedInVehicleSeat(veh, -1) ~= playerPed then
            lib.notify({
                description = 'You must be the driver to return this vehicle.',
                type = 'error'
            })
            return
        end
    end

    if veh == 0 then
        lib.notify({
            description = 'No allowed vehicle found nearby to return.',
            type = 'error'
        })
        return
    end

    local modelHash = GetEntityModel(veh)
    local allowedLabel = allowedByHash[modelHash]

    if not allowedLabel then
        lib.notify({
            description = 'This vehicle is not in this spawner\'s return list.',
            type = 'error'
        })
        return
    end

    if previewVehicle and veh == previewVehicle then
        clearPreviewVehicle(true)
        return
    end

    local plate = (GetVehicleNumberPlateText(veh) or ''):gsub('^%s*(.-)%s*$', '%1')
    local displayName = getVehicleDisplayName(veh, allowedLabel)

    local confirm = lib.alertDialog({
        header = 'Return Vehicle',
        content = ('Vehicle: %s\nPlate: %s\n\nReturn this vehicle?'):format(displayName, plate ~= '' and plate or 'Unknown'),
        centered = true,
        cancel = true
    })

    if confirm ~= 'confirm' then
        return
    end

    local netId = VehToNet(veh)
    local removed = lib.callback.await('item_exchange:server:returnVehicleByNetId', false, netId)

    if not removed then
        lib.notify({
            description = 'This vehicle is not tracked as spawned. Return cancelled.',
            type = 'error'
        })
        return
    end

    SetEntityAsMissionEntity(veh, true, true)
    DeleteVehicle(veh)
    DeleteEntity(veh)

    lib.notify({
        description = 'Vehicle returned. Spawn count updated.',
        type = 'success'
    })
end

local function splitAccessList(value)
    local list = {}

    for token in tostring(value or ''):gmatch('[^,%s]+') do
        list[#list + 1] = token:lower()
    end

    return list
end

local function listContains(list, value)
    value = tostring(value or ''):lower()

    if value == '' then
        return false
    end

    for _, entry in ipairs(list) do
        if entry == value then
            return true
        end
    end

    return false
end

local function getPlayerJobData()
    if GetResourceState('qbx_core') == 'started' then
        local ok, playerData = pcall(function()
            return exports.qbx_core:GetPlayerData()
        end)

        if ok and playerData and playerData.job then
            return playerData.job
        end
    end

    if GetResourceState('qb-core') == 'started' then
        local ok, playerData = pcall(function()
            local QBCore = exports['qb-core']:GetCoreObject()
            return QBCore.Functions.GetPlayerData()
        end)

        if ok and playerData and playerData.job then
            return playerData.job
        end
    end

    local stateJob = LocalPlayer and LocalPlayer.state and LocalPlayer.state.job
    if stateJob then
        return stateJob
    end

    return nil
end

local function canUseVehicleSpawnerTarget(trader)
    local allowedJobs = splitAccessList(trader.targetJobs)
    local allowedJobTypes = splitAccessList(trader.targetJobTypes)

    if #allowedJobs == 0 and #allowedJobTypes == 0 then
        return true
    end

    local job = getPlayerJobData()
    if not job then
        return false
    end

    local jobName = job.name or job.id or job.label
    local jobType = job.type or job.jobType or job.category

    return listContains(allowedJobs, jobName) or listContains(allowedJobTypes, jobType)
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

RegisterNetEvent('item_exchange:client:tradeCompleted', function(costItem, costCount, receiveItem, receiveCount)
    SendNUIMessage({
        action = 'tradeCompleted',
        costItem = costItem,
        costCount = costCount,
        receiveItem = receiveItem,
        receiveCount = receiveCount
    })
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

RegisterNetEvent('item_exchange:client:buyerSold', function(index, itemCount)
    SendNUIMessage({
        action = 'buyerSold',
        index = index,
        itemCount = itemCount
    })
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

local function openVehicleSpawnerAdminMenu()
    local data = lib.callback.await('item_exchange:server:getVehicleAdminData', false)

    if not data then
        lib.notify({
            description = 'You do not have permission to use this menu.',
            type = 'error'
        })
        return
    end

    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'openVehicleAdmin',
        title = 'Vehicle Spawner Admin',
        certs = data.certs,
        vehicles = data.vehicles
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

    if access and access.vehicles then
        options[#options + 1] = {
            title = 'Vehicle Spawner Admin',
            description = ('Open /%s'):format(Config.VehicleSpawnerAdmin.command),
            icon = 'fa-solid fa-car',
            onSelect = openVehicleSpawnerAdminMenu
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

RegisterNUICallback('vehicleAdminAddCert', function(data, cb)
    TriggerServerEvent('item_exchange:server:vehicleAdminAddCert', data)
    cb({ ok = true })
end)

RegisterNUICallback('vehicleAdminAddVehicle', function(data, cb)
    TriggerServerEvent('item_exchange:server:vehicleAdminAddVehicle', data)
    cb({ ok = true })
end)

RegisterNUICallback('vehicleAdminDeleteCert', function(data, cb)
    TriggerServerEvent('item_exchange:server:vehicleAdminDeleteCert', data.id)
    cb({ ok = true })
end)

RegisterNUICallback('vehicleAdminDeleteVehicle', function(data, cb)
    TriggerServerEvent('item_exchange:server:vehicleAdminDeleteVehicle', data.id)
    cb({ ok = true })
end)

RegisterNUICallback('vehicleAdminToggleCert', function(data, cb)
    TriggerServerEvent('item_exchange:server:vehicleAdminToggleCert', data.id)
    cb({ ok = true })
end)

RegisterNUICallback('vehicleAdminToggleVehicle', function(data, cb)
    TriggerServerEvent('item_exchange:server:vehicleAdminToggleVehicle', data.id)
    cb({ ok = true })
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

RegisterNetEvent('item_exchange:client:openVehicleSpawnerAdminMenu', openVehicleSpawnerAdminMenu)

RegisterNetEvent('item_exchange:client:openExchangeAdminLauncher', openExchangeAdminLauncher)

RegisterNetEvent('item_exchange:client:refreshVehicleAdmin', function()
    openVehicleSpawnerAdminMenu()
end)

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
            -- Only remove target if it was added (non-decoration peds)
            pcall(function()
                exports.ox_target:removeLocalEntity(exchangePed)
            end)
            DeleteEntity(exchangePed)
        end
    end

    exchangePeds = {}

    for _, zoneId in ipairs(exchangeTargetZones) do
        pcall(function()
            exports.ox_target:removeZone(zoneId)
        end)
    end

    exchangeTargetZones = {}
end

local function openVehicleSpawnerMenu(ped)
    local spawnerId = getVehicleSpawnerFilter(ped)
    local available = lib.callback.await('item_exchange:server:getAvailableVehicles', false, spawnerId)

    if not available or next(available) == nil then
        lib.notify({
            description = 'You don\'t have any vehicle certifications!',
            type = 'error'
        })
        return
    end

    local options = {}
    local allowedByHash = {}

    for _, config in pairs(available) do
        for _, vehicle in ipairs(config.vehicles or {}) do
            local modelName = tostring(vehicle.model or '')
            if modelName ~= '' then
                allowedByHash[joaat(modelName)] = vehicle.label or modelName
            end
        end
    end

    table.insert(options, {
        id = 'return_vehicle',
        title = 'Return Vehicle',
        description = 'Return current or nearest allowed vehicle (with confirmation)',
        icon = 'rotate-left',
        onSelect = function()
            returnCurrentVehicleFromMenu(allowedByHash)
        end
    })

    for certType, config in pairs(available) do
        for _, vehicle in ipairs(config.vehicles or {}) do
            table.insert(options, {
                id = certType .. '_' .. vehicle.model .. '_spawn',
                title = vehicle.label,
                description = 'Certification: ' .. config.label,
                icon = 'car',
                onSelect = function()
                    clearPreviewVehicle(false)

                    local canSpawn, message = lib.callback.await('item_exchange:server:canSpawnVehicle', false, certType, config.maxSpawned, config.label)
                    if not canSpawn then
                        lib.notify({
                            description = message,
                            type = 'error'
                        })
                        return
                    end

                    spawnSelectedVehicle(ped, certType, vehicle, false)
                end
            })

            -- table.insert(options, {
            --     id = certType .. '_' .. vehicle.model .. '_preview',
            --     title = 'Preview ' .. vehicle.label,
            --     description = 'Exit menu, preview vehicle, then press E to return',
            --     icon = 'eye',
            --     onSelect = function()
            --         spawnSelectedVehicle(ped, certType, vehicle, true)
            --     end
            -- })
        end
    end

    if #options < 1 then
        lib.notify({
            description = 'You don\'t have any vehicles available at this spawner.',
            type = 'error'
        })
        return
    end

    local contextId = ('item_exchange_vehicle_spawner_%s'):format(ped.index or 'menu')

    lib.registerContext({
        id = contextId,
        title = ped.menuTitle or ped.targetLabel or 'Vehicle Spawner',
        options = options
    })

    lib.showContext(contextId)
end

local function addPedBlip(trader)
    if not trader.blipEnabled then
        return
    end

    local blip = AddBlipForCoord(trader.coords.x, trader.coords.y, trader.coords.z)
    SetBlipSprite(blip, tonumber(trader.blipSprite) or 280)
    SetBlipDisplay(blip, 4)
    SetBlipScale(blip, 0.7)
    SetBlipColour(blip, trader.buyer and 2 or 5)
    SetBlipAsShortRange(blip, true)
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentString(getPedBlipLabel(trader))
    EndTextCommandSetBlipName(blip)
    exchangeBlips[#exchangeBlips + 1] = blip
end

local function addTraderBuyerLocationTarget(trader)
    local zoneId = exports.ox_target:addSphereZone({
        coords = vec3(trader.coords.x, trader.coords.y, trader.coords.z),
        radius = 1.5,
        debug = false,
        options = {
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
        }
    })

    if zoneId then
        exchangeTargetZones[#exchangeTargetZones + 1] = zoneId
    end
end

local function spawnExchangePed(trader)
    if not trader.enabled then
        return
    end

    local isTraderBuyer = trader.type ~= 'decoration' and trader.type ~= 'export' and trader.type ~= 'vehicle_spawner'

    if trader.showPed == false and isTraderBuyer then
        addTraderBuyerLocationTarget(trader)
        addPedBlip(trader)
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

    if trader.type == 'vehicle_spawner' then
        exports.ox_target:addLocalEntity(exchangePed, {
            {
                name = ('item_exchange_vehicle_spawner_%s'):format(trader.index or getVehicleSpawnerFilter(trader) or 'ped'),
                label = nonEmpty(trader.menuTitle, nonEmpty(trader.targetLabel, 'Vehicle Spawner')),
                icon = nonEmpty(trader.targetIcon, 'fa-solid fa-car'),
                canInteract = function()
                    return canUseVehicleSpawnerTarget(trader)
                end,
                onSelect = function()
                    openVehicleSpawnerMenu(trader)
                end
            }
        })
    elseif trader.type == 'export' then
        exports.ox_target:addLocalEntity(exchangePed, {
            {
                label = trader.targetLabel,
                icon = trader.targetIcon,
                onSelect = function()
                    if trader.exportSide == 'server' then
                        TriggerServerEvent('item_exchange:server:triggerExportPed', trader.index)
                    else
                        local resource = trader.exportResource
                        local exportName = trader.exportName
                        if resource and resource ~= '' and exportName and exportName ~= '' then
                            exports[resource][exportName]()
                        end
                    end
                end
            }
        })
    elseif trader.type ~= 'decoration' then
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
    end

    addPedBlip(trader)

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

    for _, blip in ipairs(exchangeBlips) do
        if DoesBlipExist(blip) then
            RemoveBlip(blip)
        end
    end

    exchangeBlips = {}

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

    for _, blip in ipairs(exchangeBlips) do
        if DoesBlipExist(blip) then
            RemoveBlip(blip)
        end
    end

    exchangeBlips = {}

    clearPreviewVehicle(false)

    SetNuiFocus(false, false)
end)