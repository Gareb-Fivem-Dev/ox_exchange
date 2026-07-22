# Changelog

All notable changes to this project are documented in this file.

## [1.5] - 2026-07-22

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
