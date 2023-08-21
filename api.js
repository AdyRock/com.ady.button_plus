'use strict';

module.exports = {

    // Retrieve all devices with their information
    async getDevices({ homey, body }) {
        return homey.app.getHomeyDevices(body);
    },

    // Retrieve all capabilities for a device
    async getDevicesCapabilities({ homey, body }) {
        const device = await homey.app.getHomeyDeviceById(body.deviceId);
        return homey.app.getHomeyDeviceCapabilities(device);
    },

    // Retrieve all zones with their information
    async getZones({ homey }) {
        return homey.app.getZones();
    },

    // Refresh device states
    async refresh({ homey }) {
        return homey.app.refresh();
    },

    // Settings changed
    async getSettingsChanged({ homey }) {
        return homey.app.settingsChanged();
    },

    // Log lines
    async getLog({ homey }) {
        return []; // Log.getLogLines();
    },

    // Log level
    async getLogLevel({ homey }) {
        return 0; // Log.getLevel();
    },

    // Set log level
    async setLogLevel({ homey, body }) {
        // const { level } = body;
        return true; // Log.setLevel(level);
    },

    // Queue/Progress state
    async getState({ homey }) {
        return homey.app.getState();
    },
};
