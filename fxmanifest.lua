fx_version 'cerulean'
game 'gta5'
lua54 'yes'
version '1.8.0'

description 'Configurable ox_lib item exchange menu'
author 'Gareb - Torrid RP'

ui_page 'web/index.html'

shared_scripts {
    "@AdvancedParking/fixDeleteVehicle.lua",         ---hash out of you do not have AdvancedParking
    "@AdvancedParking/handleAttachedEntities.lua",   ---hash out of you do not have AdvancedParking
    '@ox_lib/init.lua',
    'config.lua'
}

client_scripts {
    'client.lua'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server.lua',

}

files {
    'web/index.html',
    'web/style.css',
    'web/script.js',
    'web/img/logo.png'
}

dependencies {
    'ox_lib',
    'ox_inventory',
    'ox_target',
    'oxmysql'
}