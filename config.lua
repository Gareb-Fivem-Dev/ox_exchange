Config = {}

Config.Menu = {
    id = 'item_exchange_menu',
    title = 'Item Exchange',
    useWebUi = true
}

Config.Database = {
    table = 'item_exchange_trades',
    seedFromConfig = true
}

Config.BuyerDatabase = {
    table = 'item_exchange_buyers',
    seedFromConfig = true
}

Config.PedDatabase = {
    table = 'item_exchange_peds',
    seedFromConfig = true
}

Config.Admin = {
    command = 'exchangeadmin',
    ace = 'command.exchangeadmin'
}

Config.BuyerAdmin = {
    command = 'buyeradmin',
    ace = 'command.buyeradmin'
}

Config.PedAdmin = {
    command = 'pedadmin',
    ace = 'command.pedadmin'
}

Config.Exchange = {
    command = 'exchange'
}

-- Buyer payouts use qb-core account money when qb-core is started.
-- If qb-core is not running, payouts fall back to this ox_inventory item.
Config.BuyerMoneyItem = 'money'
Config.BuyerQbMoneyAccount = 'cash'

-- Optional seed data only. Use /pedadmin in game to add, edit, and delete peds.
-- These entries are inserted only when the ped database table is empty and
-- Config.PedDatabase.seedFromConfig is true.
Config.Peds = {}

-- These buyer entries seed the database when Config.BuyerDatabase.seedFromConfig is true
-- and the buyer database table is empty. After that, use /buyeradmin to manage buyers.
Config.Buyers = {
    -- {
    --     buyer = 1,
    --     label = 'Sell Steel Ingot',
    --     description = 'Sell steel ingots for cash',
    --     item = 'steel',
    --     count = 1,
    --     price = 25
    -- }
}

-- These trades are only used to seed the database when Config.Database.seedFromConfig is true
-- and the database table is empty. After that, use /exchangeadmin to manage trades.
Config.Trades = {
    {
        trader = 1,
        label = 'Buy Blacksmith Coal Ore',
        description = 'Trade coal ore for Blacksmith coal ore',
        receive = {
            item = 'bs_coalore',
            count = 1
        },
        cost = {
            item = 'coalore',
            count = 1
        }
    },
    {
        trader = 1,
        label = 'Buy Coal Ore',
        description = 'Trade Blacksmith coal ore for coal ore',
        receive = {
            item = 'coalore',
            count = 1
        },
        cost = {
            item = 'bs_coalore',
            count = 1
        }
    },
 
    -- Add more trades like this:
    -- {
    --     trader = 2,
    --     label = 'Buy Washed Stone',
    --     description = 'Trade dirty stone for washed stone',
    --     receive = {
    --         item = 'washed_stone',
    --         count = '1-3'
    --     },
    --     cost = {
    --         item = 'dirty_stone',
    --         count = 2
    --     }
    -- }
}