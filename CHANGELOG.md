# Changelog

All notable changes to this project are documented in this file.

## [1.8] - 2026-07-26

### Added
- **Admin Hub Parameter Examples**: Custom commands can now include an "Example Format" field (e.g., `id time`, `[job_name] [min_job_grade]`, `plate`). This example is displayed in the parameter input modal to guide admins on the required format.
- **Custom Parameter Input Modal**: Replaced browser `prompt()` with a custom dark-themed modal that matches the Admin Hub UI. Includes Cancel/Run buttons and displays the example format as a hint.
- **Simplified Parameter Workflow**: "Has Parameters" checkbox replaces parameter name input. When checked, clicking the command shows a single input box with the example format shown as a hint.
- **Vehicle Admin & Ped Admin Caching**: Both menus now use cached data whenever available (not just when minimized), eliminating redundant database fetches when switching between Admin Hub and admin menus.
- **Example Format Field**: Added "Example Format" input to custom command creation modal. Shows in the parameter input modal as a hint (e.g., `id time`, `[job_name] [min_job_grade]`, `plate`).
- **Parameters Column Type**: Changed `parameters` column from TEXT to TINYINT(1) boolean for cleaner storage.
- **Vehicle Spawner Fuel & Key System Configuration**: Added configurable fuel and key system integrations for vehicle spawning:
  - **Fuel Systems**: `legacyfuel` (LegacyFuel), `ox_fuel`, `cdn-fuel`, `ps-fuel`, `qb-fuel`, `lc_fuel`, `none`
  - **Key Systems**: `qb-vehiclekeys`, `wasabi_carlock`, `cd_garage`, `loaf_keysystem`, `okokGarage`, `none`
  - Set to `'none'` to disable either system
- **Debug Logging System**: Added `Config.Debug` toggle for debugging. When enabled, logs NUI messages, postNui calls, and built-in command execution in both browser console (F12) and server console.

### Changed
- Parameter input now uses a custom UI modal matching the Admin Hub dark theme instead of browser `prompt()`.
- "Has Parameters" checkbox replaces parameter name text field in command creation modal.
- Example format is now displayed in the parameter input modal as a hint.
- Vehicle Admin and Ped Admin now use cached data whenever available (not just when minimized), eliminating redundant database fetches when switching between Admin Hub and admin menus.
- `parameters` column in `item_exchange_admin_commands` changed from TEXT to TINYINT(1) boolean.
- Vehicle Spawner Admin now supports configurable fuel and key system integrations with multiple popular resources.

### Fixed
- **Admin Hub built-in command execution**: Fixed built-in commands (Trade Admin, Buyer Admin, Ped Admin, Vehicle Spawner Admin) not opening from Admin Hub. The issue was `closeMenu()` clearing cached data before the menu could open.
- **Admin Hub parameter example field**: Fixed "Example Format" input not appearing immediately when "Has Parameters" checkbox is checked. Now toggles visibility immediately without requiring save/re-edit.
- Admin Hub parameter input now uses custom dark-themed modal instead of browser `prompt()`.
- Vehicle Admin and Ped Admin no longer refetch data on every open when cached data exists.
- Parameter example format now correctly displays in the input modal hint.
- Vehicle Admin and Ped Admin now properly use cached data when switching between Admin Hub and admin menus (not just when minimized).
- Fixed export names for fuel/key systems to match actual resource exports (e.g., `LegacyFuel`, `wasabi_carlock`).

## [1.7] - 2026-07-26

### Added
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

## [1.6] - 2026-07-22

### Added
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

## [1.0] - Initial Release

### Added
- Database-managed trader peds for item-for-item exchanges.
- Database-managed buyer peds for item-to-cash selling.
- In-game admin menus for trades, buyers, and peds.
- Trader ID and Buyer ID grouping model.
- Optional map blips per ped.
- Config seeding and automatic table creation.
- Web UI player/admin flows with ox_lib context fallback.
- Trade formulas with fixed and random receive counts.