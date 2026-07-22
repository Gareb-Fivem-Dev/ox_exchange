# Item Exchange

A configurable FiveM item exchange and item buyer resource built for `ox_lib`, `ox_inventory`, `ox_target`, and `oxmysql`.

Players interact with database-managed peds to either trade one item for another or sell items for money. Admins can manage peds, trades, and buyer offers in game through the included web UI, so you do not need to restart the resource every time you add or change an offer.

## Version

- Current release: **v1.5**
- Baseline release: **v1.0**

See `CHANGELOG.md` for full version history.

## v1.5 Highlights

- Vehicle Spawner system with dedicated `vehicle_spawner` peds.
- Vehicle Spawner admin support in `/exchange` and `/vehicleadmin` (config-controlled).
- Vehicle licensing/certification menu filtering by player certification and spawner assignment.
- Per-vehicle job lock support (`allowed_jobs`) even when multiple jobs can access the same ped.
- Per-vehicle customization from admin: `livery`, `extras`, and `engine mod`.
- Per-ped vehicle spawn coordinates (`spawn_x`, `spawn_y`, `spawn_z`, `spawn_w`) from Ped Admin.
- Vehicle preview flow with menu exit + `Press E` return prompt.
- Return Vehicle menu option with tracked count removal and startup count reset.
- Buyer/Trader QoL updates: missing-item disabled button and amount auto-fill.
- New ped types: `decoration` and `export`.

## v1.0 Documentation (Original)

## Features

- Database-managed trader peds for item-for-item exchanges.
- Database-managed buyer peds for selling player items for cash or money items.
- Optional map blips per ped with a FiveM blip sprite selector in `/pedadmin`.
- In-game admin menus for adding, editing, moving, enabling, disabling, and deleting peds and offers.
- Separate Trader ID and Buyer ID groups, so different peds can show different menus.
- Automatic database table creation and optional config-based seeding.
- Optional included web UI for player menus and admin tools.
- Fallback ox_lib context menu for trader exchanges.
- Inventory checks before trades complete, including item count and carry capacity.
- Fixed or random trade rewards, such as `1`, `1-3`, or `random(1,3)`.

## Requirements

Make sure these resources are installed and started before this resource:

- `ox_lib`
- `ox_inventory`
- `ox_target`
- `oxmysql`

Optional:

- `qb-core`, if you want buyer payouts to use QBCore account money.

If `qb-core` is not running, buyer payouts use the configured ox_inventory money item instead.

## Installation

1. Place this folder in your server resources directory.
2. Rename the folder to something simple, such as `item_exchange`.
3. Add the resource to `server.cfg` after the required ox resources:

```cfg
ensure ox_lib
ensure ox_inventory
ensure ox_target
ensure oxmysql
ensure item_exchange
```

4. Give admins access to the editor commands:

```cfg
add_ace group.admin command.exchangeadmin allow
add_ace group.admin command.buyeradmin allow
add_ace group.admin command.pedadmin allow
```

The `/exchange` launcher uses those same permissions and does not need its own ACE line.

5. Edit `config.lua` to set menu labels, seed data, and buyer payout settings.
6. Start or restart the server.

On startup, the resource automatically creates these database tables if they do not exist:

- `item_exchange_trades`
- `item_exchange_buyers`
- `item_exchange_peds`

You can also import `item_exchange_trades.sql`, `item_exchange_buyers.sql`, and `item_exchange_peds.sql` manually if you prefer to create the tables yourself.

## Quick Start

The default config creates one trader-style exchange using these items:

- Cost item: `coalore`
- Receive item: `bs_coalore`

It also includes the reverse exchange from `bs_coalore` back to `coalore`.

After the resource is running:

1. Use `/pedadmin` in game to add a trader or buyer ped.
2. Use the Use Current Position button to fill the ped coordinates from your player location.
3. Target the spawned ped with `ox_target`.
4. Choose a trade or buyer offer.
5. Enter the amount you want to trade or sell.

The script multiplies the configured cost, reward, or payout by the selected amount. The exchange only completes when the player has enough required items and enough inventory space for the reward or payout item.

## Configuration Overview

Most settings live in `config.lua`.

```lua
Config.Menu = {
    id = 'item_exchange_menu',
    title = 'Item Exchange',
    useWebUi = true
}
```

Set `Config.Menu.useWebUi = false` if you want trader menus to use the ox_lib context menu instead of the included web UI. Buyer menus and admin menus use the web UI.

```lua
Config.BuyerMoneyItem = 'money'
Config.BuyerQbMoneyAccount = 'cash'
```

Buyer payouts use `Config.BuyerQbMoneyAccount` when `qb-core` is started. If `qb-core` is not started, payouts use the ox_inventory item from `Config.BuyerMoneyItem`.

## Managing Peds

Open the ped editor with:

```txt
/pedadmin
```

The ped admin menu lets you:

- Add trader or buyer peds.
- Use your current player position for ped coordinates.
- Edit ped model, group ID, target label, target icon, scenario, menu title, and optional map blip.
- Teleport to existing peds.
- Enable or disable peds.
- Delete peds from the database.

Ped changes are saved to the database and broadcast to all clients. Players do not need `Config.Peds` entries for peds created through `/pedadmin`.

## Trader Peds

Trader peds exchange one item for another. In `/pedadmin`, set Type to `Trader` and choose the Trader ID group the ped should display.

The old config seed format is still supported if you want to prefill the database on first startup:

```lua
{
    enabled = true,
    model = 's_m_m_dockwork_01',
    coords = vec4(0.0, 0.0, 0.0, 0.0),
    scenario = 'WORLD_HUMAN_CLIPBOARD',
    targetLabel = 'Trade Ingots',
    targetIcon = 'fa-solid fa-hammer',
    menuTitle = 'Ingot Exchange',
    blipEnabled = true,
    blipSprite = 605,
    trader = 2
}
```

The Trader ID is a menu group. A ped with Trader ID `1` shows enabled trades assigned to Trader ID `1`. A ped with Trader ID `2` shows enabled trades assigned to Trader ID `2`.

## Buyer Peds

Buyer peds remove items from players and pay money. In `/pedadmin`, set Type to `Buyer` and choose the Buyer ID group the ped should display.

The old config seed format is still supported if you want to prefill the database on first startup:

```lua
{
    enabled = true,
    model = 's_m_m_dockwork_01',
    coords = vec4(0.0, 0.0, 0.0, 0.0),
    scenario = 'WORLD_HUMAN_CLIPBOARD',
    targetLabel = 'Sell Ingots',
    targetIcon = 'fa-solid fa-dollar-sign',
    menuTitle = 'Ingot Buyer',
    blipEnabled = true,
    blipSprite = 351,
    buyer = 1
}
```

The Buyer ID is a menu group. A ped with Buyer ID `1` shows enabled buyer offers assigned to Buyer ID `1`.

## Admin Commands

Use these commands in game as an admin:

```txt
/exchange
/exchangeadmin
/buyeradmin
/pedadmin
```

`/exchange` opens a small ox_lib menu where you can choose Trade Admin, Buyer Admin, or Ped Admin. It only shows the options your player has permission to use.

The commands are protected by ACE permissions:

```cfg
add_ace group.admin command.exchangeadmin allow
add_ace group.admin command.buyeradmin allow
add_ace group.admin command.pedadmin allow
```

Console cannot open the menus. If any admin command is run from the server console, it prints a message telling you to use it in game.

## Managing Trades

Open the trade editor with:

```txt
/exchangeadmin
```

The trade admin menu lets you:

- Add new trades.
- Edit existing trades.
- Search ox_inventory item labels or spawn names.
- Move a trade to another Trader ID.
- Teleport to configured trader peds.
- Enable or disable trades.
- Delete trades from the database.

When adding or editing a trade, item fields must use valid ox_inventory item spawn names.

Receive counts can be fixed or random:

```txt
1
1-3
random(1,3)
```

`1` gives one reward item per selected amount. `1-3` and `random(1,3)` roll a random amount between 1 and 3 for each selected amount.

Example: if a player chooses amount `5` on a trade with a receive formula of `1-3`, the script rolls between 1 and 3, then multiplies that roll by 5.

## Managing Buyers

Open the buyer editor with:

```txt
/buyeradmin
```

The buyer admin menu lets you:

- Add new buyer offers.
- Edit existing offers.
- Search ox_inventory item labels or spawn names.
- Move an offer to another Buyer ID.
- Teleport to configured buyer peds.
- Enable or disable offers.
- Delete offers from the database.

Each buyer offer has an item count and a cash price. For example, an offer with Item Count `2` and Cash Price `50` removes `2x` of the item and pays `$50` for each amount the player sells.

If the player sells amount `3`, the total result is:

- Items removed: `6x`
- Money paid: `$150`

## Database Seeding

`Config.Trades`, `Config.Buyers`, and `Config.Peds` are seed data. They are inserted only when the matching database table is empty and seeding is enabled.

```lua
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
```

After the first startup, use `/exchangeadmin`, `/buyeradmin`, and `/pedadmin` to manage live database entries. Editing `Config.Trades`, `Config.Buyers`, or `Config.Peds` later will not overwrite existing database rows unless you empty the relevant table first.

## Trade Seed Example

Add seed trades to `Config.Trades`:

```lua
{
    trader = 1,
    label = 'Buy Washed Stone',
    description = 'Trade dirty stone for washed stone',
    receive = {
        item = 'washed_stone',
        count = '1-3'
    },
    cost = {
        item = 'dirty_stone',
        count = 2
    }
}
```

Make sure every item name exists in your ox_inventory item definitions.

## Buyer Seed Example

Add seed buyer offers to `Config.Buyers`:

```lua
{
    buyer = 1,
    label = 'Sell Steel Ingot',
    description = 'Sell steel ingots for cash',
    item = 'steel',
    count = 1,
    price = 25
}
```

## Ped Seed Example

You usually do not need to seed peds because `/pedadmin` can create them in game. If you want starter peds on a fresh database, add entries to `Config.Peds`:

```lua
{
    enabled = true,
    model = 's_m_m_dockwork_01',
    coords = vec4(0.0, 0.0, 0.0, 0.0),
    scenario = 'WORLD_HUMAN_CLIPBOARD',
    targetLabel = 'Trader',
    targetIcon = 'fa-solid fa-hand-holding-dollar',
    menuTitle = 'The Exchange',
    trader = 1
}
```

## Troubleshooting

### The ped does not appear

- Make sure the ped entry has `enabled = true`.
- Confirm the model name is valid.
- Confirm the coordinates are correct.
- Confirm the ped exists in `/pedadmin` or in the `item_exchange_peds` database table.
- Check that `ox_lib` loaded before this resource.

### The target option does not show

- Make sure `ox_target` is started before this resource.
- Confirm the ped spawned successfully.
- Check that `targetLabel` and `targetIcon` are set in the ped config.

### The admin command says no permission

- Confirm your server.cfg has the correct ACE lines.
- Confirm your player is in the group that receives those permissions.
- Restart the server or reload permissions after changing ACE config.

### Trades or buyers do not show in the menu

- Confirm the trade or buyer offer is enabled.
- Confirm the ped's `trader` or `buyer` number matches the offer's Trader ID or Buyer ID.
- Confirm the database tables have rows.
- Check the server console for oxmysql errors.

### Buyer payouts are not working

- If using QBCore money, make sure `qb-core` is started and `Config.BuyerQbMoneyAccount` is valid.
- If not using QBCore money, make sure `Config.BuyerMoneyItem` exists in ox_inventory.
- Confirm the player can carry the payout item when using the ox_inventory fallback.

## Notes

- Trader peds use a Trader ID group.
- Buyer peds use a Buyer ID group.
- Database rows are the live source of truth after seeding.
- Deleted offers are removed from the database, not just hidden.
- Disabled offers stay in the database but are hidden from players.