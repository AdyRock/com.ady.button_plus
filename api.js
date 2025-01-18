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

    // Settings changed
    async setSettingsChanged({ homey }) {
        return homey.app.uploadConfigurations();
    },

    // Log lines
	async getLog({ homey, query }) {
		if (query && query.ip)
		{
			return homey.app.getSent(query.ip);
		}

        return homey.app.getLog();
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

	// Get the list of capability listeners
	async getCapabilityListeners({ homey }) {
		const listeners = homey.app.getCapabilityListeners();
		const obj = Object.fromEntries(listeners);
		homey.app.updateLog(`getCapabilityListeners: ${JSON.stringify(obj)}`);
		return obj;
	}
};
