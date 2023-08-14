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
        this.registerDevices();

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

    _handleStateChange(device, value, capability)
    {
        this.app.updateLog(`Capability changed: ${device.name}, ${capability}, ${value}`);

        // Publish to MQTT
        this.app.publishMQTTMessage(`homey/${device.id}/${capability}/value`, value);
    }

    destroy()
    {
        // TODO: implement
    }

}

module.exports = DeviceStateChangeDispatcher;
