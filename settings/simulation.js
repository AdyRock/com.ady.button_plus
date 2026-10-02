/* eslint-disable strict */
// Shared by the app (require) and the settings page (<script>), so it must stay dependency free.
(function(root, factory)
{
	if (typeof module === 'object' && module.exports)
	{
		module.exports = factory();
	}
	else
	{
		root.ButtonPlusSimulation = factory();
	}
}(typeof window !== 'undefined' ? window : this, () =>
{
	const SIMULATED_NUMBER = 1234.5;
	const SIMULATED_TEXT = 'Sim...';

	// Capabilities whose value is a 0..1 fraction that is displayed as a percentage.
	const FRACTION_CAPABILITIES = ['dim', 'windowcoverings_set', 'windowcoverings_tilt_set', 'light_hue', 'light_saturation', 'light_temperature', 'volume_set'];

	const BOOLEAN_CAPABILITIES = ['onoff', 'locked', 'muted', 'garagedoor_closed', 'button'];

	const UNITS = {
		measure_temperature: '°C',
		target_temperature: '°C',
		measure_humidity: '%',
		target_humidity: '%',
		measure_battery: '%',
		measure_power: 'W',
		meter_power: 'kWh',
		measure_voltage: 'V',
		measure_current: 'A',
		measure_luminance: 'lx',
		measure_co2: 'ppm',
		measure_co: 'ppm',
		measure_pm25: 'μg/m³',
		measure_pressure: 'mbar',
		measure_noise: 'dB',
		measure_rain: 'mm/h',
		measure_wind_strength: 'km/h',
		measure_wind_angle: '°',
		measure_gust_strength: 'km/h',
		measure_ultraviolet: 'UVI',
		measure_water: 'L/min',
		meter_gas: 'm³',
		meter_water: 'm³',
		meter_rain: 'mm',
	};

	const ENUMS = {
		windowcoverings_state: {
			value: 'idle',
			values: [{ id: 'up', title: 'Up' }, { id: 'idle', title: 'Idle' }, { id: 'down', title: 'Down' }],
		},
		thermostat_mode: {
			value: 'auto',
			values: [{ id: 'auto', title: 'Auto' }, { id: 'heat', title: 'Heat' }, { id: 'cool', title: 'Cool' }, { id: 'off', title: 'Off' }],
		},
		homealarm_state: {
			value: 'disarmed',
			values: [{ id: 'armed', title: 'Armed' }, { id: 'disarmed', title: 'Disarmed' }, { id: 'partially_armed', title: 'Partially armed' }],
		},
		lock_mode: {
			value: 'always_locked',
			values: [{ id: 'always_locked', title: 'Always locked' }, { id: 'always_unlocked', title: 'Always unlocked' }],
		},
	};

	// Builds a capability-like object for a capability that cannot be found, inferring its type from the id.
	function getSimulatedCapability(capabilityId)
	{
		const id = String(capabilityId || '');
		const baseId = id.split('.')[0];

		if (BOOLEAN_CAPABILITIES.includes(baseId) || baseId.startsWith('alarm_'))
		{
			return { id, type: 'boolean', value: true, units: '', simulated: true };
		}

		if (FRACTION_CAPABILITIES.includes(baseId))
		{
			return { id, type: 'number', value: 0.5, min: 0, max: 1, units: '', simulated: true };
		}

		if (ENUMS[baseId])
		{
			return { id, type: 'enum', value: ENUMS[baseId].value, values: ENUMS[baseId].values, units: '', simulated: true };
		}

		if (baseId.startsWith('measure_') || baseId.startsWith('meter_') || baseId.startsWith('target_'))
		{
			return { id, type: 'number', value: SIMULATED_NUMBER, units: UNITS[baseId] || '', simulated: true };
		}

		return { id, type: 'string', value: SIMULATED_TEXT, units: '', simulated: true };
	}

	// Variable types are unknown once the variable is missing, so text is the only safe choice.
	function getSimulatedVariable(variableId)
	{
		return { id: variableId, name: SIMULATED_TEXT, type: 'string', value: SIMULATED_TEXT, simulated: true };
	}

	return {
		SIMULATED_NUMBER,
		SIMULATED_TEXT,
		getSimulatedCapability,
		getSimulatedVariable,
	};
}));
