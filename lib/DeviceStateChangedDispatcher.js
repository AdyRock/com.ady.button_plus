'use strict';

class DeviceStateChangeDispatcher
{

    constructor(app)
    {
        this.api = app.api;
        this.deviceManager = app.deviceManager;
        this.app = app;
        this.lastValues = new Map();
		this.listeners = new Map();
		this.expectedListenerKeys = new Set();
        this.bootstrapStateCache = new Map();
        this.bootstrapDebounceMs = 15000;
        this._init();
    }

    async _init()
    // eslint-disable-next-line no-empty-function
    {
    }

	getListeners()
	{
		return this.listeners;
	}

    getRegisteredDeviceCapabilities()
    {
        const deviceCapabilities = [];
        for (const key of this.expectedListenerKeys.values())
        {
            const parsed = this._parseListenerKey(key);
            if (!parsed)
            {
                this.app.updateLog(`getRegisteredDeviceCapabilities: invalid listener key ${key}`, 0);
                continue;
            }

            deviceCapabilities.push(parsed);
        }

        return deviceCapabilities;
    }

    getListenerHealth()
    {
        const missing = [];
        for (const key of this.expectedListenerKeys.values())
        {
            if (!this.listeners.has(key))
            {
                missing.push(key);
            }
        }

        const stale = [];
        for (const key of this.listeners.keys())
        {
            if (!this.expectedListenerKeys.has(key))
            {
                stale.push(key);
            }
        }

        return {
            expected: this.expectedListenerKeys.size,
            active: this.listeners.size,
            missingCount: missing.length,
            staleCount: stale.length,
            missing,
            stale,
        };
    }

    _buildListenerKey(deviceId, capabilityId)
    {
        return `${deviceId}::${capabilityId}`;
    }

    _parseListenerKey(key)
    {
        if (typeof key !== 'string' || key.length === 0)
        {
            return null;
        }

        // Current key format
        if (key.includes('::'))
        {
            const separatorIndex = key.indexOf('::');
            const deviceId = key.slice(0, separatorIndex);
            const capabilityId = key.slice(separatorIndex + 2);
            if (!deviceId || !capabilityId)
            {
                return null;
            }

            return { deviceId, capabilityId };
        }

        // Legacy bugged format fallback: deviceId_deviceId_capabilityId
        const parts = key.split('_');
        if (parts.length < 3)
        {
            return null;
        }

        const deviceId = parts[0];
        let capabilityId = parts.slice(1).join('_');
        if (parts[1] === deviceId)
        {
            capabilityId = parts.slice(2).join('_');
        }

        if (!deviceId || !capabilityId)
        {
            return null;
        }

        return { deviceId, capabilityId };
    }

    async registerDeviceCapability(device, capabilityId)
    {
        if (!device || !capabilityId)
        {
            this.app.updateLog('Error registering device capability: missing device or capabilityId', 0);
            return false;
        }

        // Check if the device is an object or a string
        if (typeof device === 'string')
        {
            // Get the device object
            device = await this.deviceManager.getDeviceById(device);
        }

        if (!device)
        {
            this.app.updateLog('Error registering device capability: device not found', 0);
            return false;
        }

        if ((device.driverId.search('panel_hardware') >= 0) && (capabilityId === 'measure_temperature'))
        {
			return true;
        }

        const capability = `${device.id}_${capabilityId}`;
        const listenerKey = this._buildListenerKey(device.id, capabilityId);
        this.expectedListenerKeys.add(listenerKey);
        try
        {
            const oldListener = this.listeners.get(listenerKey);
			if (oldListener)
			{
				// Already registered, so return
                this.app.updateLog(`Capability listener already registered: ${capability}`, 1);
				return true;
			}

            this.app.updateLog(`Registering capability listener: ${capability}`, 1);
            this.lastValues.set(capability, null);
            const listener = await device.makeCapabilityInstance(capabilityId, (value) => this._handleStateChange(device, value, capabilityId));
            this.listeners.set(listenerKey, listener);
            this.app.updateLog(`Capability listener registered: ${capability}`, 1);

            // Publish the current capability value once so displays are initialized after reboot
            this._bootstrapCapabilityState(device, capabilityId).catch((err) =>
            {
                this.app.updateLog(`Bootstrap capability state failed: ${capability}, ${err.message}`, 0);
            });

			return true;
        }
        catch (e)
        {
            this.app.updateLog(`Error registering capability: ${capability}, ${e.message}`, 0);
			return false;
        }
    }

    async _bootstrapCapabilityState(device, capabilityId)
    {
        if (!device || !capabilityId || typeof device.getCapabilityValue !== 'function')
        {
            return;
        }

        const value = await device.getCapabilityValue(capabilityId);
        if (value === undefined)
        {
            return;
        }

        const cacheKey = `${device.id}::${capabilityId}`;
        const now = Date.now();
        const cached = this.bootstrapStateCache.get(cacheKey);
        if (cached && (cached.value === value) && ((now - cached.timestamp) < this.bootstrapDebounceMs))
        {
            this.app.updateLog(`Bootstrap capability state skipped (debounced): ${device.id}_${capabilityId}=${value}`, 1);
            return;
        }

        this.bootstrapStateCache.set(cacheKey, {
            value,
            timestamp: now,
        });

        this.app.updateLog(`Bootstrap capability state: ${device.id}_${capabilityId}=${value}`, 1);
        await this._handleStateChange(device, value, capabilityId);
    }

    async _handleStateChange(device, value, capability)
    {
        const deviceId = device.id;
        const lastValue = this.lastValues.get(`${deviceId}_${capability}`);
        // eslint-disable-next-line eqeqeq
        if (lastValue == value)
        {
            this.app.updateLog(`Capability changed: ${device.name}, ${capability}, ${value}, same as previous value`);
            return;
        }

        this.app.updateLog(`Capability changed: ${device.name}, ${capability}, ${value}`);

        this.lastValues.set(`${deviceId}_${capability}`, value);

        // Get devices and check if they have a checkStateChange function
        const drivers = this.app.homey.drivers.getDrivers();
        for (const driver of Object.values(drivers))
        {
            let devices = driver.getDevices();
            for (let device of Object.values(devices))
            {
                if (device.checkStateChange)
                {
                    try
                    {
                        // request the device to check the state change
                        device.checkStateChange(deviceId, capability, value);
                    }
                    catch (error)
                    {
                        this.app.updateLog(`_handleStateChange: ${error.message}`, 0);
                    }
                }

                device = null;
            }
            devices = null;
        }
    }

    async reregisterDeviceCapabilities(deviceCapabilities = null)
	{
		this.app.updateLog('Reregistering device capabilities', 1);
		this.lastValues.clear();
        const stats = {
            total: 0,
            restored: 0,
            failed: 0,
        };

        const capabilitiesToRestore = Array.isArray(deviceCapabilities)
            ? deviceCapabilities
            : this.getRegisteredDeviceCapabilities();
        stats.total = capabilitiesToRestore.length;

		await this.clearListeners();

		// iterate over deviceCapabilities and register each device capability
        for (const deviceCapability of capabilitiesToRestore)
		{
            const registered = await this.registerDeviceCapability(deviceCapability.deviceId, deviceCapability.capabilityId);
            if (registered)
            {
                stats.restored += 1;
            }
            else
            {
                stats.failed += 1;
            }
		}

        return stats;
	}

    async clearListeners()
	{
		this.app.updateLog('Clearing device capability listeners', 1);
		this.lastValues.clear();
		for (const listener of this.listeners.values())
		{
			try
			{
				await listener.destroy();
			}
			catch (error)
			{
				this.app.updateLog(`clearListeners: ${error.message}`, 0);
			}
		}
		this.listeners.clear();
	}

	async destroy()
    {
        this.bootstrapStateCache.clear();
        this.expectedListenerKeys.clear();
        await this.clearListeners();
    }

	setListeners(listeners)
	{
		this.listeners = listeners;
	}

}

module.exports = DeviceStateChangeDispatcher;
