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

    // Get an array of Homey's Button devices
    async getButtonDevices({ homey }) {
        return homey.app.getButtonDevices();
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
        return homey.app.getLog();
    },

    // Queue/Progress state
    async getState({ homey }) {
        return homey.app.getState();
    },

    // Get the list of variables
    async getVariables({ homey }) {
        return homey.app.getVariables();
    },

    // Clear log
    async clearLog({ homey }) {
        return homey.app.clearLog();
    },

    // Send Log
    async sendLog({ homey, body }) {
        return homey.app.sendLog(body);
    },
};
