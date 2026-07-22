-- Vehicle Spawner System for ox_exchange
-- Integrated vehicle management with certification tracking

local vehicleSpawner = {}
local spawnedVehicles = {}
local QBCore = nil

function vehicleSpawner.initialize()
    -- Try to get QBCore
    if GetResourceState('qb-core') == 'started' then
        QBCore = exports['qb-core']:GetCoreObject()
    end

    spawnedVehicles = {}

    -- Initialize spawned vehicles table from config
    if Config.VehicleSpawner and Config.VehicleSpawner.vehicles then
        for certType, _ in pairs(Config.VehicleSpawner.vehicles) do
            spawnedVehicles[certType] = {}
        end
    end
end

function vehicleSpawner.resetSpawnedVehicles()
    spawnedVehicles = {}
end

function vehicleSpawner.hasPlayerCertification(source, certType)
    if not QBCore then return false end
    
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return false end
    
    local pd = Player.PlayerData or {}
    
    -- Check metadata.licences (primary source for certifications)
    if pd.metadata and type(pd.metadata) == 'table' then
        local meta = pd.metadata
        if meta.licences and meta.licences[certType] == true then 
            return true
        end
    end
    
    -- Fallback checks for other license formats
    if pd.licenses and type(pd.licenses) == 'table' then
        if pd.licenses[certType] == true then 
            return true
        end
        
        for k,v in pairs(pd.licenses) do
            if type(v) == 'table' then
                if v.type == certType or v.name == certType or v.license == certType then
                    return true
                end
            end
        end
    end
    
    return false
end

function vehicleSpawner.canSpawnVehicle(certType, maxSpawned, label)
    local config = Config.VehicleSpawner and Config.VehicleSpawner.vehicles and Config.VehicleSpawner.vehicles[certType]
    
    if not config and not maxSpawned then
        return false, "Invalid certification type"
    end
    
    local currentCount = #(spawnedVehicles[certType] or {})
    maxSpawned = maxSpawned or (config and config.maxSpawned) or 2
    label = label or (config and config.label) or certType
    
    if currentCount >= maxSpawned then
        return false, "Maximum " .. maxSpawned .. " " .. label .. " vehicles already spawned!"
    end
    
    return true, ""
end

function vehicleSpawner.trackSpawnedVehicle(certType, netId, model, source, plate)
    if not spawnedVehicles[certType] then
        spawnedVehicles[certType] = {}
    end
    
    table.insert(spawnedVehicles[certType], {
        netId = netId,
        model = model,
        source = source,
        time = os.time(),
        plate = plate
    })
end

function vehicleSpawner.removeSpawnedVehicle(certType, netId)
    if not spawnedVehicles[certType] then return end
    
    for i, vehicle in ipairs(spawnedVehicles[certType]) do
        if vehicle.netId == netId then
            table.remove(spawnedVehicles[certType], i)
            break
        end
    end
end

function vehicleSpawner.removeSpawnedVehicleByNetId(netId)
    netId = tonumber(netId)
    if not netId then
        return false
    end

    for certType, vehicles in pairs(spawnedVehicles) do
        for index, vehicle in ipairs(vehicles) do
            if tonumber(vehicle.netId) == netId then
                table.remove(vehicles, index)
                return true, certType
            end
        end
    end

    return false
end

function vehicleSpawner.getSpawnedCount(certType)
    return #(spawnedVehicles[certType] or {})
end

return vehicleSpawner
