# Room Comfort Simulator Assumptions

Last updated: February 19, 2026.

## 1) Scope and intended use

This tool is a simplified early-stage design simulator for a **single thermal zone**.
It is intended for option comparison (orientation, glazing, shading, ventilation mode), not compliance sign-off.

Main limitations:

- Dry-bulb temperature only (no humidity, latent loads, or PMV/PPD).
- Simplified facade solar projection; when EPW is active, hourly radiation is weather-driven but sub-hour cloud dynamics are not modeled.
- One-zone 1R1C thermal mass representation.
- No explicit HVAC plant efficiency or control deadband modeling.

## 2) Governing model

### 2.1 Weather forcing (primary: synthetic, optional: EPW)

Primary source in the app:

- Synthetic profile with:
  - Annual cosine profile between synthetic winter and summer temperatures
  - Diurnal cosine profile with peak near **15:00 solar time**
  - Synthetic wind profile for dynamic simulation steps

Optional EPW source (user-selectable in Context tab):

- `public/weather/GBR_WAL_Pencelli.Aux.036100_TMYx.epw`
- Dataset: **Pencelli (Brecon) TMYx** (8760 hourly records)
- Fields used:
  - Dry bulb temperature (`T_out`)
  - Global horizontal radiation (`GHI`)
  - Direct normal radiation (`DNI`)
  - Diffuse horizontal radiation (`DHI`)
  - Wind speed
  - Total sky cover (tenths, 0-10), displayed in UI

If EPW is selected but unavailable, the model falls back to synthetic weather.

Form used in code:

- `T_peak(day) = T_mean + A_year * cos(2*pi*(day - day_peak)/365)`
- `T_out(hour) = (T_peak - A_day) + A_day * cos(2*pi*(hour - 15)/24)`

where `A_day = diurnalRange / 2`.

### 2.2 Envelope and solar gains

At each timestep:

- Solar position is computed from latitude/longitude/date.
- Beam + diffuse + ground-reflected radiation are projected onto vertical facades.
- Overhang and fin shading reduce incident beam component.
- Gains transmitted through glazing use a constant solar transmittance (`g_glass`).
- When EPW is active, measured `DNI/DHI/GHI` replace clear-sky radiation in the projection model.

### 2.3 1R1C thermal mass model

Indoor temperature is advanced with a forward-Euler discretization:

`C * dT_in/dt = Q_solar + Q_internal + Q_hvac - UA_total * (T_in - T_out)`

Free-running mode uses `Q_hvac = 0` and predicts `T_in` across the day.

### 2.4 Ventilation heat transfer

Ventilation conductance:

`UA_vent = rho_air * c_p,air * ACH * Volume / 3600`

with `rho_air = 1.2 kg/m3`, `c_p,air = 1006 J/(kg*K)`.

Current ACH uses a simple preset (constant across the day by default):

- `ACH_total` is selected from a preset list and includes the background rate.
- Background infiltration baseline: `0.3 ACH` (always on).
- Presets (total ACH):
  - Background only: `0.3 ACH`
  - Trickle vents: `0.6 ACH`
  - MVHR (Passivhaus-style): `0.4 ACH` with `85%` heat recovery efficiency (continuous balanced ventilation for well-sealed envelope)
  - Open windows: `3.0 ACH`
  - Purge: `6.0 ACH`
  - Adaptive: scales between `0.6` and `6.0 ACH` when indoor temperature is above comfort and outdoor air is beneficial.

Heat recovery modeling:

- MVHR heat recovery reduces ventilation heat loss by the efficiency factor (default `85%`).
- Heat recovery is automatically disabled when window-based ventilation is active:
  - Adaptive ventilation mode (windows open automatically)
  - Manual window openings
  - Night purge mode (22:00-06:00)
- This reflects that heat recovery only applies to air passing through the mechanical heat exchanger, not to bypass airflows through windows.

Optional night purge:

- If enabled, the night period (`22:00-06:00`) is boosted to the purge rate (`6.0 ACH`).

## 3) Baseline numeric assumptions (current implementation)

- Geometry: `4.8 m x 2.4 m x 2.6 m` single zone.
- Orientation is a user input (`0-360°`) rotating facade azimuths relative to north.
- Facade glazing ratio sliders are capped at `0-80%` per facade.
- Shading controls use ratio form (`d/h`, `0-1`) and are converted to depth in meters using room height.
- Weather mode defaults to synthetic (Pencelli/Brecon profile), with EPW as an option.
- Envelope U-value presets:
  - Baseline - Building Regs 2025: walls `0.35`, roof `0.20`, floor `0.25`, windows `1.10` W/m2K.
  - 25% Above Baseline: walls `0.25`, roof `0.15`, floor `0.20`, windows `0.90` W/m2K.
  - High-performance (default): walls `0.15`, roof `0.15`, floor `0.15`, windows `0.70` W/m2K.
  - Passivhaus (indicative): walls `0.10`, roof `0.10`, floor `0.10`, windows `0.80` W/m2K.
- Solar transmittance (`g_glass`): `0.40` (low-E glazing; typical range 0.3-0.5).
- Internal sensible gains: `180 W` constant.
- Ground albedo: `0.25`.
- Air properties:
  - `rho_air = 1.2 kg/m3`
  - `c_p,air = 1006 J/(kg*K)`
- Ventilation defaults:
  - Background-only preset: `0.3 ACH` total (infiltration only).
  - Preset options: `0.3 / 0.4 / 0.6 / 3.0 / 6.0 ACH` total (+ adaptive `0.6-6.0 ACH`).
  - Manual window/rooflight opening airflow in the app uses a fixed southwest wind assumption (`5 mph`) for consistency in the UI.
- 1R1C thermal capacitance: `6.0 MJ/K` (single lumped node).
- Numerical integration step: `10 minutes`.
- Spin-up period before reporting a day: `7 days` by default (adjustable via "Balanced out").
- Start indoor temperature: auto (matches outdoor at spin-up start).
- Annual reporting run: `8760` hourly steps (typical year view).
- Passivhaus override (indicative): one-click preset for Passivhaus-style design comparison:
  - Applies Passivhaus fabric and MVHR ventilation presets (see above).
  - Enables night purge (`22:00-06:00` at `6.0 ACH`). Note: heat recovery is disabled during night purge hours as this represents window-based ventilation, not MVHR bypass.
  - Sets facade glazing: North `16%`, East `18%`, South `34%`, West `18%`.
  - Sets shading: South overhang `0.9` + horizontal fin `0.45`; East/West vertical fins only `0.5` (overhangs ineffective for low-angle sun).
  - Closes all manual window openings and disables rooflight.
  - Orientation is not changed (user-controlled).
- Site metadata from EPW LOCATION:
  - Latitude: `51.917`
  - Longitude: `-3.317` (east positive / west negative)
  - Time zone: `UTC+0`
  - Elevation: `160 m`

EPW parser handling:

- Uses 8-line EPW header convention.
- Converts EPW hour `1..24` to simulation hour via `hour % 24`.
- Missing radiation values are set to `0`.
- Missing dry-bulb values are linearly interpolated (or carried from nearest valid value).

## 4) Comfort and control interpretation

Current comfort band (fixed dry-bulb):

- Comfortable: `18 to 23 C`
- Below 18 C: heating required.
- Above 23 C: cooling required.

Instantaneous HVAC estimate shown in the UI is a steady-state sensible power estimate to hold the nearest comfort boundary at that timestep.

Ventilation is set by the selected preset (constant ACH), optional night purge, optional adaptive control, plus any manual openings. Cooling/heating demand is reported for the resulting total ventilation rate.

Annual view reports:

- Hours in comfort (`18-23 C`)
- Overheating hours (`>23 C`) and stricter (`>28 C`)
- Heating degree-hours below `18 C`
- Cooling degree-hours above `23 C`
- Peak indoor temperature and month/day/time of occurrence

## 5) Energy cost & carbon conversion (student-facing)

Thermal load (W) is converted to energy, then to £ and kg CO2e.

Core formulas (per timestep):

```
Heating fuel kWh = Heating thermal kWh / boiler_efficiency
Cooling electric kWh = Cooling thermal kWh / COP

Cost (£) = (heating_fuel_kWh * gas_rate) + (cooling_elec_kWh * elec_rate)
         + standing_charges

Carbon (kg CO2e) = (heating_fuel_kWh * gas_factor) + (cooling_elec_kWh * elec_factor)
```

Default system assumptions:

- Heating: high-efficiency gas boiler, seasonal efficiency `0.90`.
- Cooling: electric DX cooling, COP `3.0`.
- Standing charges: included in all £ figures.

Tariffs (Ofgem price cap, **1 January 2026 to 31 March 2026**, typical Direct Debit):

- Electricity: `27.69 p/kWh` + `54.75 p/day` standing charge.
- Gas: `5.93 p/kWh` + `35.09 p/day` standing charge.

Carbon factors (UK Government GHG Conversion Factors 2025, kg CO2e per kWh):

- Electricity consumption: `0.19553` (generation `0.177` + T&D `0.01853`).
- Natural gas: `0.20268` (derived from `2575.46441 kg CO2e/tonne` and net CV `12.707 kWh/kg`).

Carbon is reported in **kg CO2e**.

## 6) Credibility and calibration notes

The model structure is physically defensible for conceptual studies, but outputs should be calibrated before decision-making:

- Tune internal gains and ACH schedules to observed operation.
- Calibrate effective capacitance (`C`) against measured indoor temperature lag.
- Replace synthetic weather with TMY/EPW weather data for project analysis.
- For comfort studies involving occupants, add humidity and PMV/adaptive comfort logic.

## 7) References and standards basis

Primary references used to frame assumptions and method:

1. US DOE, **EnergyPlus Engineering Reference** (zone heat balance and dynamic thermal methods).  
   https://energyplus.readthedocs.io/
2. ASHRAE, **Standard 55: Thermal Environmental Conditions for Human Occupancy** (comfort framework).  
   https://www.ashrae.org/technical-resources/bookstore/standard-55
3. ISO, **ISO 52016-1** (hourly calculation procedures for energy needs and indoor temperatures).  
   https://www.iso.org/standard/65696.html
4. EnergyPlus Weather File format (EPW data dictionary and field conventions).  
   https://bigladdersoftware.com/epx/docs/latest/auxiliary-programs/energyplus-weather-file-epw-data-dictionary.html
5. Ofgem, **Energy price cap (Jan 2026) unit rates and standing charges**.  
   https://www.ofgem.gov.uk/information-consumers/energy-advice-households/energy-price-cap-explained
6. UK Government, **Greenhouse gas reporting conversion factors 2025** (condensed set).  
   https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025

These references inform method selection; this simulator is still a simplified implementation and not a full standards-compliance engine.
