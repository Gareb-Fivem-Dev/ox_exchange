fx_version 'cerulean'
game 'gta5'
lua54 'yes'

description 'Configurable ox_lib item exchange menu'
author 'Gareb - Torrid RP'

ui_page 'web/index.html'

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua'
}

client_scripts {
    'client.lua'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server.lua',
    "@AdvancedParking/fixDeleteVehicle.lua",
    "@AdvancedParking/handleAttachedEntities.lua",
}

files {
    'web/index.html',
    'web/style.css',
    'web/script.js'
}

dependencies {
    'ox_lib',
    'ox_inventory',
    'ox_target',
    'oxmysql'
}