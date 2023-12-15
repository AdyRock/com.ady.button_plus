'use strict';

class DeviceStateChangeDispatcher
{

    constructor(app)
    {
        this.api = app.api;
        this.deviceManager = app.deviceManager;
        this.app = app;

        this._init();
    }

    // Get all devices and add them
    async _init()
    {
        // listeners
        this.deviceManager.onAdd.subscribe(this.registerDevice.bind(this));
        // this.deviceManager.onRemove.subscribe(id => Log.debug('device remove: ' + id));
        // this.deviceManager.onUpdate.subscribe(id => Log.debug('device update: ' + id));

        // register
        //        this.registerDevices();

        //        Log.debug('Devices registered');
    }

    registerDevices()
    {
        if (this.deviceManager.devices)
        {
            const devices = Object.values(this.deviceManager.devices);
            for (const device of devices)
            {
                this.registerDevice(device);
            }
        }
    }

    registerDevice(device)
    {
        if (!device) return;
        const capabilities = Object.values(device.capabilities);
        for (const capability of capabilities)
        {
            try
            {
                device.makeCapabilityInstance(capability, (value) => this._handleStateChange(device, value, capability));
            }
            catch (e)
            {
                this.app.updateLog(`Error registering capability: ${capability}, ${e.message}`, 0);
            }
        }
    }

    async registerDeviceCapability(device, capabilityId)
    {
        if (!device || !capabilityId)
        {
            this.app.updateLog('Error registering device capability: missing device or capabilityId', 0);
            return;
        }

        // Check if the device is an object or a string
        if (typeof device === 'string')
        {
            // Get the device object
            device = await this.deviceManager.getDevice(device);
        }

        if (!device)
        {
            this.app.updateLog('Error registering device capability: device not found', 0);
            return;
        }

        try
        {
            await device.makeCapabilityInstance(capabilityId, (value) => this._handleStateChange(device, value, capabilityId));
        }
        catch (e)
        {
            this.app.updateLog(`Error registering capability: ${capabilityId}, ${e.message}`, 0);
        }
    }

    _handleStateChange(device, value, capability)
    {
        this.app.updateLog(`Capability changed: ${device.name}, ${capability}, ${value}`);

        const deviceId = device.id;

        // Get devices to upload their configurations
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

    destroy()
    {
        // TODO: implement
    }

}

module.exports = DeviceStateChangeDispatcher;
