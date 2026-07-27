# Item Exchange

A configurable FiveM item exchange and item buyer resource built for `ox_lib`, `ox_inventory`, `ox_target`, and `oxmysql`.

Players interact with database-managed peds to either trade one item for another or sell items for money. Admins can manage peds, trades, and buyer offers in game through the included web UI, so you do not need to restart the resource every time you add or change an offer.

## Admin Hub

A fully featured administration hub allowing admin users to manage custom commands directly from the in-game menu, eliminating the need to memorize console commands. The Admin Hub provides a clean, web-based interface where admins can see all available commands with their descriptions and execute them easily.

### Key Features

- **Parameterized Commands**: Commands with parameters show an input prompt when clicked, allowing admins to fill in values they need
- **Categorized Commands**: Commands are organized into logical categories for easy navigation
- **Flexible Permissions**: Each command can have its own permission requirement
- **Visual Interface**: Clean, dark-themed interface with command icons and descriptions
- **Instant Execution**: Commands execute immediately with just a click or parameter input

### Command Types

#### Simple Commands
```
/rank player_id level
/create_account username password email
/teleport x y z
```

#### Parameterized Commands
When a command contains spaces (e.g., `jail id time`), clicking it shows a prompt:

```
Enter parameters for Jail Player
Format: param1 value1 param2 value2
Example: player123 30 minutes
```

User fills in: `player123 30 minutes` → System executes: `/jail player123 30 minutes`

### Usage

1. **Access**: Use `/exchange` in-game as an admin
2. **Navigate**: Use sidebar to switch between built-in and custom command categories
3. **Execute**: Click a command card to run it
4. **Parameters**: For commands with parameters, fill in the prompt values at runtime

### Built-in Categories

The default Admin Hub includes a single **Exchange** category containing:

- Trade Admin (edit/manage trades)
- Buyer Admin (edit/manage buyer offers) 
- Ped Admin (edit/manage peds)
- Vehicle Spawner Admin (manage licenses/vehicles)

### Managing Custom Commands

Admins can create and manage custom commands through the **Manage** category:

- **Add Category**: Create new command categories
- **Edit Categories**: Modify category names, icons, and order
- **Add Custom Command**: Create parameterized or simple commands
- **Delete Commands**: Remove unused commands

#### Creating a Custom Command

To create a command like `/jail id time`:

1. Go to **Manage** → **Add Custom Command**
2. **Command Name**: `jail`
3. **Command to Run**: (leave empty - /jail will be auto-added)
4. **Parameters**: `id time` (parameter names separated by spaces)
5. **Description**: `Send a player to jail`
6. **Category**: Select or create appropriate category
7. **Permission**: Set who can use this command
8. **Icon**: Choose an icon (⚙️, 👤, etc.)
9. **Confirm Prompt** (optional): `Enter player ID and jail time`

#### Result

Admins will see a command card with title **Jail** and description **Send a player to jail**. When clicked, it shows a prompt:

```
Enter parameters for Jail
Format: param1 value1 param2 value2
Example: player123 30 minutes
```

After entering `player123 30 minutes`, the system executes: `/jail player123 30 minutes`

### Permissions System

Commands require permissions based on your server.cfg ACE configuration. The permission dropdown in Admin Hub shows available permissions from your server.

### SQL Schema

Run `admin_hub_schema.sql` to create the required tables if they don't exist:

```sql
-- File: admin_hub_schema.sql
-- Creates: item_exchange_admin_categories, item_exchange_admin_commands
-- Includes both CREATE TABLE (for new) and ALTER TABLE (for existing)
```

This schema is backward compatible - if your tables already exist, the ALTER TABLE statements will update them safely.

### Example Use Cases

#### System Maintenance Commands
- `/restart server` (simple)
- `/kick id reason` (parameterized)
- `/ban id duration` (parameterized)

#### Player Management Commands
- `/reward id amount item` (parameterized)
- `/setrank id rank` (parameterized)
- `/give id item quantity` (parameterized)

#### Configuration Commands
- `/setweather weather_type` (parameterized)
- `/setservername new_name` (simple)
- `/setmaxplayers number` (simple)

### Notes

- Commands with spaces are detected automatically and show parameter prompts
- Parameters are combined with the command name and executed as one command
- All commands run with the permissions of the player who clicked them
- The Admin Hub persists between server restarts

- The Admin Hub persists between server restarts

## Vehicle Spawner Configuration

The Vehicle Spawner system supports configurable fuel and key system integrations. Edit these in `config.lua` under `Config.VehicleSpawner`:

```lua
Config.VehicleSpawner = {
    enabled = true,
    clearOnStart = true,
    
    -- Fuel system integration
    -- Options: 'legacyfuel', 'ox_fuel', 'cdn-fuel', 'ps-fuel', 'qb-fuel', 'lc_fuel', 'none'
    -- Set to 'none' to disable fuel handling
    fuelSystem = 'legacyfuel',
    
    -- Vehicle key system integration
    -- Options: 'qb-vehiclekeys', 'wasabi_carlock', 'cd_garage', 'loaf_keysystem', 'okokGarage', 'none'
    -- Set to 'none' to disable key handling
    keySystem = 'wasabi_carlock',
    
    -- Vehicle certification groups...
}
```

### Supported Fuel Systems

| Config Value | Resource Export |
|--------------|-----------------|
| `legacyfuel` | `exports['LegacyFuel']:SetFuel(veh, 100)` |
| `ox_fuel` | `exports['ox_fuel']:SetFuel(veh, 100)` |
| `cdn-fuel` | `exports['cdn-fuel']:SetFuel(veh, 100)` |
| `ps-fuel` | `exports['ps-fuel']:SetFuel(veh, 100)` |
| `qb-fuel` | `exports['qb-fuel']:SetFuel(veh, 100)` |
| `lc_fuel` | `exports['lc_fuel']:SetFuel(veh, 100)` |
| `none` | Disabled |

### Supported Key Systems

| Config Value | Resource Export |
|--------------|-----------------|
| `qb-vehiclekeys` | `exports['qb-vehiclekeys']:GiveKeys(plate)` |
| `wasabi_carlock` | `exports['wasabi_carlock']:GiveKey(plate)` |
| `cd_garage` | `exports['cd_garage']:GiveKey(plate)` |
| `loaf_keysystem` | `exports['loaf_keysystem']:GiveKey(plate)` |
| `okokGarage` | `exports['okokGarage']:GiveKey(plate)` |
| `none` | Disabled |

Set either to `'none'` to disable that system entirely.

## Version

- Current release: **v1.8**
- Baseline release: **v1.0**

See `CHANGELOG.md` for full version history.

## v1.8 Highlights

- **Parameter Examples**: Custom commands can now include an "Example Format" field (e.g., `id time`, `[job_name] [min_job_grade]`, `plate`). Displayed as a hint in the parameter input modal.
- **Custom Parameter Input Modal**: Replaced browser `prompt()` with a dark-themed custom modal matching the Admin Hub UI. Includes Cancel/Run buttons and example hint.
- **Simplified Parameter Workflow**: "Has Parameters" checkbox replaces parameter name input. When checked, clicking the command shows a single input box with the example format shown as a hint.
- **Vehicle Admin & Ped Admin Caching**: Both menus now use cached data whenever available (not just when minimized), eliminating redundant database fetches when switching between Admin Hub and admin menus.
- **Parameters Column**: Changed from TEXT to boolean TINYINT(1) for cleaner storage.

### Changed
- Parameter input uses custom dark-themed modal instead of browser `prompt()`.
- "Has Parameters" checkbox replaces parameter name text field in command creation modal.
- Example format now displayed in parameter input modal as a hint.
- Vehicle Admin and Ped Admin use cached data whenever available, eliminating redundant database fetches.

### Fixed
- **Admin Hub built-in command execution**: Fixed built-in commands (Trade Admin, Buyer Admin, Ped Admin, Vehicle Spawner Admin) not opening from Admin Hub. The issue was `closeMenu()` clearing cached data before the menu could open.
- Admin Hub parameter input uses custom dark-themed modal instead of browser `prompt()`.
- Vehicle Admin and Ped Admin no longer refetch data on every open when cached data exists.
- Parameter example format now correctly displays in the input modal hint.
- Vehicle Admin and Ped Admin now properly use cached data when switching between Admin Hub and admin menus (not just when minimized).
- Fixed export names for fuel/key systems to match actual resource exports (e.g., `LegacyFuel`, `wasabi_carlock`).

## v1.7 Highlights

- **Admin Hub**: A new central administration interface that replaces the need to remember multiple admin commands. Features:
  - Built-in Exchange category containing Trade Admin, Buyer Admin, Ped Admin, and Vehicle Spawner Admin
  - Custom command management with parameterized support
  - Visual command interface with icons, descriptions, and permission system
  - Direct execution of server commands with parameter input prompts
  - Role-based access control for different command types
- **Parameterized Commands**: Custom commands can define parameter names (e.g., `jail id time`). When clicked, they show an input prompt where admins fill in values runtime (e.g., `player123 30 minutes`)
- **Command Categories**: Organized command management with built-in Exchange category and support for custom categories
- **Visual Admin Interface**: Dark theme with command cards, sidebar navigation, modal forms for adding/editing commands
- **Permission System**: Each command can have custom permission requirements (group.admin, command.add_ace, etc.)
- **SQL Schema**: `admin_hub_schema.sql` with `item_exchange_admin_categories` and `item_exchange_admin_commands` tables
- **Backward Compatibility**: Existing database tables are automatically updated if they exist

### Changed
- `/exchange` command now opens the new Admin Hub instead of the ox_lib context menu
- All existing admin commands (Trade Admin, Buyer Admin, Ped Admin, Vehicle Spawner Admin) are now accessible through the Exchange category in the Admin Hub
- Updated README documentation to reflect the new Admin Hub interface

### Fixed
- MySQL callback bug fixes in vehicle admin handlers (previously silently swallowed results)
- Removed stray duplicate `end)` in vehicle admin server handler

## v1.6 Highlights

- Vehicle Spawner ped type (`vehicle_spawner`) with grouped spawner IDs.
- Vehicle Spawner admin data model and schema (`vehicle_spawner_certs`, `vehicle_spawner_vehicles`).
- Vehicle admin support for per-spawner assignment of certs and vehicles.
- Job/job-type gate support for vehicle spawner ped target access.
- Per-vehicle `allowed_jobs` visibility lock in menu (job name or job type).
- Per-vehicle customization fields:
  - `livery`
  - `extras`
  - `mod_engine`
- Per-ped vehicle spawn coordinate fields in ped data:
  - `spawn_x`, `spawn_y`, `spawn_z`, `spawn_w`
- Vehicle preview option in spawner menu with `Press E` return behavior.
- Vehicle return menu action with tracked count decrement and confirmation flow.
- Startup reset for tracked spawned-vehicle counts.
- New ped types:
  - `decoration` (no target)
  - `export` (custom client/server export action)

### Changed
- `/exchange` launcher includes Vehicle Spawner Admin entry (permission/config dependent).
- Vehicle availability now supports DB-driven cert/vehicle definitions by spawner ID.
- Vehicle spawner menu and spawn pipeline apply admin-defined livery/extras/engine settings.
- Trader/Buyer UX improvements:
  - Disabled "Missing" action state when inventory requirements are not met.
  - Amount field auto-fills from available player inventory.

### Fixed
- Vehicle spawner context registration/show flow issues (`ox_lib` context not found).
- Vehicle admin add form behavior and validation edge cases.
- Vehicle spawner target label fallback behavior and menu-title usage.

## v1.0 Documentation (Original)

### Features

- Database-managed trader peds for item-for-item exchanges.
- Database-managed buyer peds for item-to-cash selling.
- Optional map blips per ped with a FiveM blip sprite selector in `/pedadmin`.
- In-game admin menus for adding, editing, moving, enabling, disabling, and deleting peds and offers.
- Trader ID and Buyer ID grouping model.
- Automatic database table creation and optional config-based seeding.
- Optional included web UI for player menus and admin tools.
- Fallback ox_lib context menu for trader exchanges.
- Inventory checks before trades complete, including item count and carry capacity.
- Fixed or random trade rewards, such as `1`, `1-3`, or `random(1,3)`.

### Requirements

Make sure these resources are installed and started before this resource:

- `ox_lib`
- `ox_inventory`
- `ox_target`
- `oxmysql`

Optional:

- `qb-core`, if you want buyer payouts to use QBCore account money.

If `qb-core` is not running, buyer payouts use the configured ox_inventory money item instead.

### Installation

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

### Quick Start

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