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
                this.app.updateLog(`Error registering capability: ${capability}, ${e.message}`);
            }
        }
    }

    registerDeviceCapability(device, capabilityId)
    {
        if (!device || !capabilityId)
        {
            return;
        }

        try
        {
            device.makeCapabilityInstance(capabilityId, (value) => this._handleStateChange(device, value, capabilityId));
        }
        catch (e)
        {
            this.app.updateLog(`Error registering capability: ${capabilityId}, ${e.message}`);
        }
    }

    _handleStateChange(device, value, capability)
    {
        this.app.updateLog(`Capability changed: ${device.name}, ${capability}, ${value}`);

        const deviceId = device.id;

        // Publish to MQTT
        this.app.publishMQTTMessage(`homey/${deviceId}/${capability}/value`, value);
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
                        this.app.updateLog(`Sync Devices error: ${error.message}`);
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
