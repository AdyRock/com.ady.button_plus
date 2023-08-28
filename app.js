/* eslint-disable max-len */

'use strict';

if (process.env.DEBUG === '1')
{
    // eslint-disable-next-line node/no-unsupported-features/node-builtins, global-require
    require('inspector').open(9223, '0.0.0.0', false);
}

const Homey = require('homey');

const { HomeyAPI } = require('athom-api');
const httpServer = require('http').createServer();
const ws = require('websocket-stream');
const net = require('./net');
const nodemailer = require('./nodemailer');
const aedes = require('./aedes')();
const mqtt = require('./mqtt');
const HttpHelper = require('./lib/HttpHelper');
const DeviceManager = require('./lib/DeviceManager');
const DeviceDispatcher = require('./lib/DeviceStateChangedDispatcher');

// const MQTT_SERVER_BUTTONPLUS = 'mqtt://mqtt.button.plus:1883';
// const USE_LOCAL_MQTT = true;
// const USE_BUTTON_PLUS_MQTT = true;

const MAX_CONFIGURATIONS = 20;

class MyApp extends Homey.App
{

    /**
     * onInit is called when the app is initialized.
     */
    async onInit()
    {
        this.mqttServerReady = false;
        this.autoConfigGateway = true;

        const homeyLocalURL = await this.homey.cloud.getLocalAddress();
        this.homeyIP = homeyLocalURL.split(':')[0];

        this.homey.settings.set('autoConfig', this.autoConfigGateway);

        this.brokerItems = this.homey.settings.get('brokerConfigurationItems');
        if (!this.brokerItems)
        {
            this.brokerItems = [
                {
                    brokerid: 'homey',
                    url: `mqtt://${this.homeyIP}`,
                    port: 49876,
                    wsport: 9001,
                    enabled: true,
                    protected: true,
                },
                {
                    brokerid: 'buttonplus',
                    url: 'mqtt://mqtt.button.plus',
                    port: 1883,
                    wsport: 9001,
                    enabled: true,
                    protected: true,
                },
            ];

            this.homey.settings.set('brokerConfigurationItems', this.brokerItems);
        }

        this.buttonConfigurations = this.homey.settings.get('buttonConfigurations');
        if (!this.buttonConfigurations || this.buttonConfigurations.length < MAX_CONFIGURATIONS)
        {
            // Create the default button bar configurations
            this.createbuttonConfigurations();
        }
        else
        {
            // Validate new configuration items
            for (let i = 0; i < this.buttonConfigurations.length; i++)
            {
                const buttonConfiguration = this.buttonConfigurations[i];
                if (!buttonConfiguration.leftBrokerId)
                {
                    buttonConfiguration.leftBrokerId = 'homey';
                }

                if (!buttonConfiguration.rightBrokerId)
                {
                    buttonConfiguration.rightBrokerId = 'homey';
                }

                if (!buttonConfiguration.leftDimChange)
                {
                    buttonConfiguration.leftDimChange = '-10';
                }

                if (!buttonConfiguration.rightDimChange)
                {
                    buttonConfiguration.rightDimChange = '+10';
                }

                if (!buttonConfiguration.leftMQTTTopic)
                {
                    buttonConfiguration.leftMQTTTopic = '';
                }

                if (!buttonConfiguration.rightMQTTTopic)
                {
                    buttonConfiguration.rightMQTTTopic = '';
                }
            }

            this.homey.settings.set('buttonConfigurations', this.buttonConfigurations);
        }

        this.displayConfigurations = this.homey.settings.get('displayConfigurations');
        if (!this.displayConfigurations || this.displayConfigurations.length < MAX_CONFIGURATIONS)
        {
            // Create the default display configurations
            this.createDisplayConfigurations();
        }

        this.settings = this.homey.settings.get('settings') || {};

        try
        {
            this.homeyID = await this.homey.cloud.getHomeyId();

            this.MQTTClients = new Map();

            // Setup the local access method if possible
            if (this.brokerItems[0].enabled)
            {
                // The client setup is called when the server is ready
                this.setupHomeyMQTTServer();
            }
            this.setupMDNS();
            for (const brokerItem of this.brokerItems)
            {
                if (brokerItem.enabled && brokerItem.brokerid !== 'homey')
                {
                    this.setupMQTTClient(brokerItem.brokerid, brokerItem.url, this.homeyID);
                }
            }
        }
        catch (err)
        {
            this.updateLog(`Error setting up local access: ${err.message}`);
        }

        this.api = await HomeyAPI.forCurrentHomey(this.homey);
        try
        {
            this.system = await this._getSystemInfo();
        }
        catch (e)
        {
            this.updateLog('[boot] Failed to fetch system info');
            this.updateLog(e);
            this.system = {};
        }

        this.api.devices.setMaxListeners(9999); // HACK
        this.initSettings();

        // devices
        this.updateLog('Initialize DeviceManager');
        this.deviceManager = new DeviceManager(this);

        this.updateLog('Register DeviceManager');
        await this.deviceManager.register();

        this.getHomeyDevices({});
        this.deviceDispather = new DeviceDispatcher(this);

        try
        {
            this.cloudConnected = false;
            this.httpHelperSimulator = new HttpHelper();
            const username = this.homey.settings.get('username');
            const password = this.homey.settings.get('password');

            if (username && password)
            {
                await this.loginToSimulator(username, password);
            }

            this.httpHelperLocal = new HttpHelper();
            this.httpHelperLocal.setBaseURL('local');
            this.httpHelperLocal.setDefaultHeaders({}, true);
        }
        catch (err)
        {
            this.updateLog(`Error logging into simulator: ${err.message}`);
        }

        this.homey.settings.on('set', async (setting) =>
        {
            if (setting === 'buttonConfigurations')
            {
                this.buttonConfigurations = this.homey.settings.get('buttonConfigurations');

                // Get devices to upload their configurations that might have changed
                this.refreshbuttonConfigurations();
            }
            if (setting === 'displayConfigurations')
            {
                this.displayConfigurations = this.homey.settings.get('displayConfigurations');

                // Get devices to upload their configurations that might have changed
                this.refreshDisplayConfigurations();
            }
            if (setting === 'brokerConfigurationItems')
            {
                this.brokerItems = this.homey.settings.get('brokerConfigurationItems');

                for (const brokerItem of this.brokerItems)
                {
                    if (brokerItem.enabled)
                    {
                        if (brokerItem.brokerid !== 'homey')
                        {
                            this.setupMQTTClient(brokerItem.brokerid, brokerItem.url, this.homeyID);
                        }
                    }
                    else
                    {
                        // disconnect any connected clients that have been disabled
                        const client = this.MQTTClients.get(brokerItem.brokerid);
                        if (client)
                        {
                            client.end();
                            this.MQTTClients.delete(brokerItem.brokerid);
                        }
                    }
                }
                }
        });

        this._triggerButtonOn = this.homey.flow.getDeviceTriggerCard('button_on')
            .registerRunListener((args, state) =>
            {
                return (args.left_right === state.left_right && args.connector === state.connector);
            });

        this._triggerButtonOff = this.homey.flow.getDeviceTriggerCard('button_off')
            .registerRunListener((args, state) =>
            {
                return (args.left_right === state.left_right && args.connector === state.connector);
            });

        this._triggerButtonChange = this.homey.flow.getDeviceTriggerCard('button_change')
            .registerRunListener((args, state) =>
            {
                return (args.left_right === state.left_right && args.connector === state.connector);
            });

        this.homey.flow.getActionCard('switch_button_configuration')
            .registerRunListener(async (args, state) =>
            {
                const config = args.configurationId - 1;
                this.log('switch_button_configuration', config);
                return args.device.triggerCapabilityListener(`configuration.connector${args.connector}`, config.toString());
            });

        this.homey.flow.getActionCard('switch_display_configuration')
            .registerRunListener(async (args, state) =>
            {
                const config = args.configurationId - 1;
                this.log('switch_display_configuration', config);
                return args.device.triggerCapabilityListener('configuration.display', config.toString());
            });

        this.homey.flow.getActionCard('turn_on_button')
            .registerRunListener(async (args, state) =>
            {
                this.log(`${args.left_right}.connector${args.connector}`, args);
                return args.device.triggerCapabilityListener(`${args.left_right}_button.connector${args.connector}`, true);
            });

        this.homey.flow.getActionCard('set_info')
            .registerRunListener(async (args, state) =>
            {
                this.log(`${args.info}`, args);
                return args.device.triggerCapabilityListener('info', args.info);
            });

        this.homey.flow.getActionCard('turn_off_button')
            .registerRunListener(async (args, state) =>
            {
                this.log(`${args.left_right}.connector${args.connector}`, args);
                return args.device.triggerCapabilityListener(`${args.left_right}_button.connector${args.connector}`, false);
            });

        /** * CONDITIONS ** */
        this._conditionIsButtonOn = this.homey.flow.getConditionCard('is_button_on');
        this._conditionIsButtonOn.registerRunListener(async (args, state) =>
        {
            return args.device.getCapabilityValue(`${args.left_right}_button.connector${args.connector}`);
        });

        this.updateLog('MyApp has been initialized');
    }

    // Make all the device upload their button bar configurations to the panels
    async refreshbuttonConfigurations()
    {
        if (this.cloudConnected)
        {
            // Get devices to upload their configurations
            const drivers = this.homey.drivers.getDrivers();
            for (const driver of Object.values(drivers))
            {
                let devices = driver.getDevices();
                for (let device of Object.values(devices))
                {
                    if (device.uploadButtonConfigurations)
                    {
                        try
                        {
                            await device.uploadButtonConfigurations(null, true);
                        }
                        catch (error)
                        {
                            this.updateLog(`Sync Devices error: ${error.message}`);
                        }
                    }

                    device = null;
                }
                devices = null;
            }
        }
    }

    // Make all the device upload their button bar configurations to the panels
    async refreshDisplayConfigurations()
    {
        // Get devices to upload their configurations
        const drivers = this.homey.drivers.getDrivers();
        for (const driver of Object.values(drivers))
        {
            let devices = driver.getDevices();
            for (let device of Object.values(devices))
            {
                if (device.uploadDisplayConfigurations)
                {
                    try
                    {
                        await device.uploadDisplayConfigurations(null, true);
                    }
                    catch (error)
                    {
                        this.updateLog(`Sync Devices error: ${error.message}`);
                    }
                }

                device = null;
            }
            devices = null;
        }
    }

    createbuttonConfigurations()
    {
        if (!this.buttonConfigurations)
        {
            this.buttonConfigurations = [];
        }

        for (let i = this.buttonConfigurations.length; i < MAX_CONFIGURATIONS; i++)
        {
            const ButtonPanelConfiguration = {
                leftTopText: '',
                leftOnText: '',
                leftOffText: '',
                leftDevice: 'none',
                leftCapability: '',
                leftbrokerid: 'homey',
                leftDimChange: '-10',
                rightTopText: '',
                rightOnText: '',
                rightOffText: '',
                rightDevice: 'none',
                rightCapability: '',
                rightbrokerid: 'homey',
                rightDimChange: '+10',
            };
            this.buttonConfigurations.push(ButtonPanelConfiguration);
        }
        this.homey.settings.set('buttonConfigurations', this.buttonConfigurations);
    }

    createDisplayConfigurations()
    {
        if (!this.displayConfigurations)
        {
            this.displayConfigurations = [];
        }

        for (let i = this.displayConfigurations.length; i < MAX_CONFIGURATIONS; i++)
        {
            const displayConfiguration = {
                items: [],
            };

            this.displayConfigurations.push(displayConfiguration);
        }
        this.homey.settings.set('displayConfigurations', this.displayConfigurations);
    }

    async uploadDisplayConfiguration(ip, virtualID, configurationNo, deviceConfiguration, writeConfig)
    {
        try
        {
            if (!deviceConfiguration)
            {
                // download the current configuration from the device
                deviceConfiguration = await this.readDeviceConfiguration(ip, virtualID);
            }

            if (deviceConfiguration)
            {
                // apply the new configuration
                this.applyDisplayConfiguration(deviceConfiguration, configurationNo);
                this.updateLog(`Current Config: ${deviceConfiguration}`);

                if (writeConfig)
                {
                    // write the updated configuration back to the device
                    await this.writeDeviceConfiguration(ip, deviceConfiguration, virtualID);
                }
            }
        }
        catch (err)
        {
            this.updateLog(`Error uploading display configuration: ${err.message}`);
            throw err;
        }

        return deviceConfiguration;
    }

    async applyDisplayConfiguration(deviceConfiguration, configurationNo)
    {
        if (deviceConfiguration)
        {
            // Get the specified user configuration
            const displayConfiguration = this.displayConfigurations[configurationNo];

            // Update the device configuration
            if (displayConfiguration)
            {
                deviceConfiguration.mqttdisplays = [];
                for (let itemNo = 0; itemNo < displayConfiguration.items.length; itemNo++)
                {
                    const item = displayConfiguration.items[itemNo];
                    const capabilities = {
                        x: parseInt(item.xPos, 10),
                        y: parseInt(item.yPos, 10),
                        fontsize: parseInt(item.fontSize, 10),
                        align: parseInt(item.alignment, 10),
                        width: parseInt(item.width, 10),
                        label: item.label,
                        units: item.units,
                        round: parseInt(item.rounding, 10),
                        topics: [
                        {
                            brokerid: item.brokerId,
                            topic: `homey/${item.device}/${item.capability}/value`,
                            eventtype: 15,
                        }],
                    };
                    if (item.device !== 'none')
                    {
                        const homeyDeviceObject = await this.homey.app.getHomeyDeviceById(item.device);
                        if (homeyDeviceObject)
                        {
                            const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObject, item.capability);
                            if (capability)
                            {
                                this.homey.app.publishMQTTMessage(item.brokerId, `homey/${item.device}/${item.capability}/value`, capability.value);
                                this.registerDeviceCapabilityStateChange(item.device, item.capability);
                            }
                        }
                    }

                    deviceConfiguration.mqttdisplays.push(capabilities);
                }
            }

            // Create click events for the display buttons
            if (deviceConfiguration.mqttbuttons)
            {
                for (let connectorNo = 0; connectorNo < deviceConfiguration.info.connectors.length; connectorNo++)
                {
                    const itemInfo = deviceConfiguration.info.connectors[connectorNo];
                    if (itemInfo.type === 2)
                    {
                        const buttonIdx = connectorNo * 2;
                        await this.setupClickTopic(buttonIdx, deviceConfiguration.mqttbuttons[buttonIdx], 'none', 'none', connectorNo, 'left', 'homey');
                        await this.setupClickTopic(buttonIdx + 1, deviceConfiguration.mqttbuttons[buttonIdx + 1], 'none', 'none', connectorNo, 'right', 'homey');
                    }
                }
            }
        }
    }

    async uploadButtonPanelConfiguration(ip, virtualID, connectorNo, configurationNo)
    {
        try
        {
            // download the current configuration from the device
            const deviceConfiguration = await this.readDeviceConfiguration(ip, virtualID);
            this.updateLog(`Current Config: ${deviceConfiguration}`);

            if (deviceConfiguration)
            {
                // apply the new configuration
                await this.applyButtonConfiguration(deviceConfiguration, connectorNo, configurationNo);

                // write the updated configuration back to the device
                await this.writeDeviceConfiguration(ip, deviceConfiguration, virtualID);
            }
        }
        catch (err)
        {
            this.updateLog(`Error uploading button bar configuration: ${err.message}`);
            throw err;
        }
    }

    async applyButtonConfiguration(deviceConfiguration, connectorNo, configurationNo)
    {
        if (deviceConfiguration)
        {
            // Get the specified user configuration
            const ButtonPanelConfiguration = this.buttonConfigurations[configurationNo];

            // Update the device configuration for the selected connectorNo
            if (deviceConfiguration.info && deviceConfiguration.info.connectors)
            {
                const connectorIdx = deviceConfiguration.info.connectors.findIndex((connector) => connector.id === connectorNo);
                if (connectorIdx < 0)
                {
                    this.updateLog(`Invalid connector number: ${connectorNo}`);
                    throw new Error(`Invalid connector number: ${connectorNo}`);
                }

                // Make sure it's a button bar
                if (deviceConfiguration.info.connectors[connectorIdx].type === 1)
                {
                    // This device has a valid button bar at the specified location so get that panels properties
                    if (deviceConfiguration.mqttbuttons)
                    {
                        // Configure the left button bar
                        let buttonIdx = connectorNo * 2;
                        let capability = await this.setupClickTopic(
                            buttonIdx,
                            deviceConfiguration.mqttbuttons[buttonIdx],
                            ButtonPanelConfiguration.leftDevice,
                            ButtonPanelConfiguration.leftCapability,
                            connectorNo,
                            'left',
                            ButtonPanelConfiguration.leftBrokerId,
                        );

                        await this.setupStatusTopic(
                            buttonIdx,
                            deviceConfiguration.mqttbuttons[buttonIdx],
                            ButtonPanelConfiguration.leftTopText,
                            ButtonPanelConfiguration.leftCapability === 'dim' ? ButtonPanelConfiguration.leftDimChange : ButtonPanelConfiguration.leftOnText,
                            ButtonPanelConfiguration.leftOffText,
                            ButtonPanelConfiguration.leftDevice,
                            ButtonPanelConfiguration.leftCapability,
                            capability,
                            ButtonPanelConfiguration.leftBrokerId,
                        );

                        // Configure the right button bar
                        buttonIdx++;
                        capability = await this.setupClickTopic(
                            buttonIdx,
                            deviceConfiguration.mqttbuttons[buttonIdx],
                            ButtonPanelConfiguration.rightDevice,
                            ButtonPanelConfiguration.rightCapability,
                            connectorNo,
                            'right',
                            ButtonPanelConfiguration.rightBrokerId,
                        );

                        await this.setupStatusTopic(
                            buttonIdx,
                            deviceConfiguration.mqttbuttons[buttonIdx],
                            ButtonPanelConfiguration.rightTopText,
                            ButtonPanelConfiguration.rightCapability === 'dim' ? ButtonPanelConfiguration.rightDimChange : ButtonPanelConfiguration.rightOnText,
                            ButtonPanelConfiguration.rightOffText,
                            ButtonPanelConfiguration.rightDevice,
                            ButtonPanelConfiguration.rightCapability,
                            capability,
                            ButtonPanelConfiguration.rightBrokerId,
                        );
                    }
                }
            }
        }
    }

    async setupClickTopic(buttonIdx, mqttButtons, configDevice, configCapability, connectorNo, side, brokerId)
    {
        let readOnly = false;
        let capability = null;
        let type = '';

        try
        {
            mqttButtons.topics = [];
            if (configDevice !== 'none')
            {
                const device = await this.deviceManager.getDeviceById(configDevice);
                if (device)
                {
                    // Check if this device capability id read only
                    capability = await this.deviceManager.getCapability(device, configCapability);
                    if (capability)
                    {
                        readOnly = (capability.setable === false);
                        type = capability.type;
                        this.registerDeviceCapabilityStateChange(device, configCapability);
                    }
                }
            }

            let payload = {
                connector: connectorNo,
                side,
                device: configDevice,
                capability: configCapability,
                type,
            };
            payload = JSON.stringify(payload);

            if (!readOnly)
            {
                // Add the click event entry
                mqttButtons.topics.push(
                {
                    brokerid: brokerId,
                    eventtype: 0,
                    topic: 'homey/click',
                    payload,
                },
);
            }
        }
        catch (err)
        {
            this.updateLog(`Error setting up click topic: ${err.message}`);
        }

        return capability;
    }

    async setupStatusTopic(buttonIdx, mqttButtons, topLabel, labelOn, labelOff, configDevice, configCapability, capability, brokerId)
    {
        mqttButtons.toplabel = topLabel;
        mqttButtons.label = labelOn;

        try
        {
            let payload = '';
            if (configDevice === 'none')
            {
                // User capabilities are always 'ON' or 'OFF' and have a click event
                payload = true;

                // Add the LED event entry
                mqttButtons.topics.push(
                {
                    brokerid: brokerId,
                    eventtype: 14,
                    topic: `homey/button/${buttonIdx}/value`,
                    payload,
                },
);

                // Add the Label event entry
                mqttButtons.topics.push(
                {
                    brokerid: brokerId,
                    eventtype: 16,
                    topic: `homey/button/${buttonIdx}/label`,
                    payload,
                },
);
            }
            else if (capability)
            {
                if (capability && capability.type === 'boolean')
                {
                    if (capability.value === false)
                    {
                        mqttButtons.label = labelOff;
                    }
                    // Boolean capabilities are always 'true' or 'false'
                    payload = true;

                    // Add the LED event entry
                    mqttButtons.topics.push(
                    {
                        brokerid: brokerId,
                        eventtype: 14,
                        topic: `homey/${configDevice}/${configCapability}/value`,
                        payload,
                    },
);
                }

                // Add the Label event entry
                mqttButtons.topics.push(
                {
                    brokerid: brokerId,
                    eventtype: 16,
                    topic: `homey/${configDevice}/${configCapability}/label`,
                    payload,
                },
);
            }
            else
            {
                // Oops
            }
        }
        catch (err)
        {
            this.updateLog(`Error setting up status topic: ${err.message}`);
        }
    }

    async readDeviceConfiguration(ip, virtualID)
    {
        // Read the device configuration from the specified device
        if ((virtualID > 0) && this.cloudConnected)
        {
            try
            {
                // TODO change to use IP for real hardware
                this.updateLog(`readDeviceConfiguration for ${virtualID}`);
                return await this.httpHelperSimulator.get(`button/config/${virtualID}`);
            }
            catch (err)
            {
                this.updateLog(`readDeviceConfiguration error: ${err.message}`);
            }
        }
        else if (ip !== '')
        {
            try
            {
                return await this.httpHelperLocal.get(`http://${ip}/config`);
            }
            catch (err)
            {
                this.updateLog(`readDeviceConfiguration error: ${err.message}`);
            }
        }
        this.updateLog('readDeviceConfiguration: not connected to cloud');
        return null;
    }

    async writeDeviceConfiguration(ip, deviceConfiguration, virtualID)
    {
        if (!this.autoConfigGateway)
        {
            return null;
        }

        // Make sure the device configuration has the MQTT broker Id's define
        if (!deviceConfiguration.mqttbrokers)
        {
            deviceConfiguration.mqttbrokers = [];
        }

        for (const brokerItem of this.brokerItems)
        {
            if (brokerItem.enabled)
            {
                if ((ip !== '') || brokerItem.brokerid !== 'homey')
                {
                    if (deviceConfiguration.mqttbrokers.findIndex((broker) => broker.brokerid === brokerItem.brokerid) < 0)
                    {
                        // Add the broker Id
                        deviceConfiguration.mqttbrokers.push(
                            {
                                brokerid: brokerItem.brokerid,
                                url: brokerItem.url,
                                port: brokerItem.port,
                                wsport: brokerItem.wsport,
                            },
                        );
                    }
                }
            }
            else
            {
                // Find the broker Id and remove it
                const brokerIdx = deviceConfiguration.mqttbrokers.findIndex((broker) => broker.brokerid === brokerItem.brokerid);
                if (brokerIdx >= 0)
                {
                    deviceConfiguration.mqttbrokers.splice(brokerIdx, 1);
                }
            }
        }

        this.updateLog(`writeDeviceConfiguration: ${this.varToString(deviceConfiguration)}`);

        const options = {
            json: true,
        };

        if ((virtualID > 0) && this.cloudConnected)
        {
            // Write the device configuration to the specified device
            try
            {
                // Use the simulator
                return await this.httpHelperSimulator.post(`/button/postbutton?id=${virtualID}`, options, deviceConfiguration);
            }
            catch (err)
            {
                this.updateLog(`writeDeviceConfiguration error: ${err.message}`);
            }
        }
        else if (ip !== '')
        {
            try
            {
                // Use the local device
                return await this.httpHelperLocal.post(`http://${ip}/configsave`, options, deviceConfiguration);
            }
            catch (err)
            {
                this.updateLog(`writeDeviceConfiguration error: ${err.message}`);
            }
        }
        return null;
    }

    async getHomeyDevices({ type = '', ids = null })
    {
        if (this.deviceManager)
        {
            try
            {
                let devices = {};
                if (this.deviceManager && this.deviceManager.devices)
                {
                    devices = this.deviceManager.devices;
                }
                else
                {
                    const api = await HomeyAPI.forCurrentHomey(this.homey);
                    devices = await api.devices.getDevices();
                }

                if (type || ids)
                {
                    // Filter the object on type or id
                    const filteredDevices = [];
                    // Turn the devices object into an array, filter on type or id and turn it back into an object
                    const deviceArray = Object.values(devices);
                    for (const device of deviceArray)
                    {
                        const capabilities = await this.deviceManager.getCapabilities(device);
                        const capabilitiesArray = Object.values(capabilities);
                        for (const capability of capabilitiesArray)
                        {
                            if ((type && capability.type === type) || (ids && this.id.findIndex((id) => capability.id === id) >= 0))
                            {
                                filteredDevices.push(device);
                                break;
                            }
                        }
                    }

                    // return the filtered devices as an object
                    devices = {};
                    for (const device of filteredDevices)
                    {
                        devices[device.id] = device;
                    }

                    return devices;
                }

                return devices;
            }
            catch (e)
            {
                this.updateLog(`Error getting devices: ${e.message}`);
            }
        }
        return [];
    }

    async getHomeyDeviceById(id)
    {
        if (this.deviceManager)
        {
            try
            {
                if (this.deviceManager.devices)
                {
                    return this.deviceManager.getDeviceById(id);
                }
            }
            catch (e)
            {
                this.updateLog(`Error getting devices: ${e.message}`);
            }
        }
        return [];
    }

    async getHomeyCapabilityByName(device, name)
    {
        if (this.deviceManager && device)
        {
            try
            {
                return this.deviceManager.getCapability(device, name);
            }
            catch (e)
            {
                this.updateLog(`Error getting capability: ${e.message}`);
            }
        }
        return [];
    }

    async getHomeyDeviceCapabilities(device)
    {
        if (this.deviceManager)
        {
            try
            {
                if (this.deviceManager && this.deviceManager.devices)
                {
                    return this.deviceManager.getCapabilities(device);
                }
            }
            catch (e)
            {
                this.updateLog(`Error getting devices: ${e.message}`);
            }
        }
        return [];
    }

    async _getSystemInfo()
    {
        this.updateLog('get system info');
        const info = await this.api.system.getInfo();
        return {
            name: info.hostname,
            version: info.homey_version,
        };
    }

    initSettings()
    {
        const systemName = this.system.name || 'Homey';
        if (this.settings.deviceId === undefined || this.settings.systemName !== systemName || this.settings.topicRoot)
        {
            // Backwards compatibility
            if (this.settings.topicRoot && !this.settings.homieTopic)
            {
                this.settings.homieTopic = `${this.settings.topicRoot}/${this.settings.deviceId || systemName}`;
                delete this.settings.topicRoot;
            }

            this.settings.systemName = systemName;
            if (!this.settings.deviceId)
            {
                const idx = systemName.lastIndexOf('-');
                this.settings.deviceId = idx === -1 ? systemName : systemName.substr(0, idx);
            }

            this.updateLog(`Settings initial deviceId: ${this.settings.deviceId}`);
            this.homey.settings.set('settings', this.settings);
            this.updateLog('Settings updated');
        }
    }

    async setupMDNS()
    {
        this.mDNSGateways = this.homey.settings.get('gateways');
        this.mDNSGateways = [];

        // setup the mDNS discovery for local gateways
        this.discoveryStrategy = this.homey.discovery.getStrategy('panel');

        const discoveryResult = this.discoveryStrategy.getDiscoveryResults();
        this.updateLog(`Got initial mDNS result:${this.varToString(discoveryResult)}`);
        if (discoveryResult && discoveryResult.address)
        {
            this.mDNSGatewaysUpdate(discoveryResult);
        }

        this.discoveryStrategy.on('result', (discoveryResult) =>
        {
            this.updateLog(`Got mDNS result:${this.varToString(discoveryResult)}`);
            this.mDNSGatewaysUpdate(discoveryResult);
        });
    }

    setupHomeyMQTTServer()
    {
        // Setup the local MQTT server
        aedes.authenticate = function aedesAuthenticate(client, username, password, callback)
        {
            // callback(null, (username === Homey.env.MQTT_USER_NAME) && (password.toString() === Homey.env.MQTT_PASSWORD));
            callback(null, true);
        };

        const server = net.createServer(aedes.handle);
        server.listen(this.brokerItems[0].port, () =>
        {
            this.updateLog(`server started and listening on port ${this.brokerItems[0].port}`);
            this.mqttServerReady = true;

            // Start the MQTT client
            this.setupMQTTClient('homey', this.brokerItems[0].url, this.homeyID);
        });

        server.on('error', (err) =>
        {
            this.updateLog(`server error: ${this.varToString(err)}`);
        });

        // Create a websocket server for the MQTT server
        ws.createServer({ server: httpServer }, aedes.handle);

        httpServer.listen(this.brokerItems[0].wsport, () => {
            this.updateLog(`websocket server listening on port ${this.brokerItems[0].wsport}`);
        });
    }

    setupMQTTClient(MQTTClintID, MQTTServerAddress, homeyID)
    {
        // Connect to the MQTT server and subscribe to the required topics
        // this.MQTTclient = mqtt.connect(MQTT_SERVER, { clientId: `HomeyButtonApp-${homeyID}`, username: Homey.env.MQTT_USER_NAME, password: Homey.env.MQTT_PASSWORD });
        const MQTTclient = mqtt.connect(MQTTServerAddress, { clientId: `HomeyButtonApp-${homeyID}`, username: '', password: '' });
        this.MQTTClients.set(MQTTClintID, MQTTclient);

        MQTTclient.on('connect', () =>
        {
            this.updateLog(`setupLocalAccess.onConnect: connected to ${MQTTServerAddress}`);

            MQTTclient.subscribe('homey/click', (err) =>
            {
                if (err)
                {
                    this.updateLog("setupLocalAccess.onConnect 'homey/toggle' error: " * this.varToString(err), 0);
                }
            });

            MQTTclient.subscribe('homey/longpress', (err) =>
            {
                if (err)
                {
                    this.updateLog("setupLocalAccess.onConnect 'homey/longpress' error: " * this.varToString(err), 0);
                }
            });

            MQTTclient.subscribe('homey/sensorvalue', (err) =>
            {
                if (err)
                {
                    this.updateLog("setupLocalAccess.onConnect 'homey/sensorvalue' error: " * this.varToString(err), 0);
                }
            });
        });

        MQTTclient.on('error', (err) =>
        {
            this.updateLog(`setupLocalAccess.onError: ${this.varToString(err)}`);
        });

        MQTTclient.on('message', async (topic, message) =>
        {
            // message is in Buffer
            try
            {
                const mqttMessage = JSON.parse(message.toString());
                this.updateLog(`MQTTDeviceValues: ${this.varToString(mqttMessage)}`);

                // Find the device that handles this message
                if (mqttMessage.connector)
                {
                    const drivers = this.homey.drivers.getDrivers();
                    for (const driver of Object.values(drivers))
                    {
                        let devices = driver.getDevices();
                        for (let device of Object.values(devices))
                        {
                            if (device.processMQTTMessage)
                            {
                                try
                                {
                                    await device.processMQTTMessage(topic, mqttMessage);
                                }
                                catch (error)
                                {
                                    this.updateLog(`Sync Devices error: ${error.message}`);
                                }
                            }

                            device = null;
                        }
                        devices = null;
                    }
                }
            }
            catch (err)
            {
                this.updateLog(`MQTT Client error: ${topic}: ${err.message}`);
            }
        });

        return true;
    }

    // eslint-disable-next-line camelcase
    async publishMQTTMessage(MQTT_Id, topic, message)
    {
        const data = JSON.stringify(message);
        this.updateLog(`publishMQTTMessage: ${data} to topic ${topic}}`);
        try
        {
            const MQTTclient = this.MQTTClients.get(MQTT_Id);
            if (MQTTclient)
            {
                await MQTTclient.publish(topic, data, { qos: 1, retain: true });
            }
        }
        catch (err)
        {
            this.updateLog(`publishMQTTMessage error: ${err.message}`);
        }
    }

    // Build a list of gateways detected by mDNS
    mDNSGatewaysUpdate(discoveryResult)
    {
        try
        {
            let index = this.mDNSGateways.findIndex((gateway) =>
            {
                return gateway.gatewayId === discoveryResult.id;
            });

            if (index >= 0)
            {
                // Already cached so just make sure the address is up to date
                const oldAddress = this.mDNSGateways[index].address;
                this.mDNSGateways[index].address = discoveryResult.address;
                this.updateDeviceIPAddress(oldAddress, discoveryResult.address);
            }
            else
            {
                // Add a new entry to the cache
                const gateway = {
                    gatewayId: discoveryResult.id,
                    address: discoveryResult.address,
                    model: discoveryResult.txt.model,
                };

                this.mDNSGateways.push(gateway);
                index = this.mDNSGateways.length - 1;
            }

            this.homey.settings.set('gateways', this.mDNSGateways);
        }
        catch (err)
        {
            this.updateLog(`mDNSGatewaysUpdate error: ${err.message}`);
        }
    }

    async updateDeviceIPAddress(oldIp, newIp)
    {
        try
        {
            // Find the device that uses this gateway
            const drivers = this.homey.drivers.getDrivers();
            for (const driver of Object.values(drivers))
            {
                let devices = driver.getDevices();
                for (let device of Object.values(devices))
                {
                    if (device.updateGatewayConfig)
                    {
                        // Update the device IP address
                        device.updateGatewayConfig(oldIp, newIp);
                    }

                    device = null;
                }
                devices = null;
            }
        }
        catch (err)
        {
            this.updateLog(`updateDeviceIPAddress error: ${err.message}`);
        }
    }

    // Convert a variable of any type (almost) to a string
    varToString(source)
    {
        try
        {
            if (source === null)
            {
                return 'null';
            }
            if (source === undefined)
            {
                return 'undefined';
            }
            if (source instanceof Error)
            {
                const stack = source.stack.replace('/\\n/g', '\n');
                return `${source.message}\n${stack}`;
            }
            if (typeof (source) === 'object')
            {
                const getCircularReplacer = () =>
                {
                    const seen = new WeakSet();
                    return (key, value) =>
                    {
                        if (typeof value === 'object' && value !== null)
                        {
                            if (seen.has(value))
                            {
                                return '';
                            }
                            seen.add(value);
                        }
                        return value;
                    };
                };

                return JSON.stringify(source, getCircularReplacer(), 2);
            }
            if (typeof (source) === 'string')
            {
                return source;
            }
        }
        catch (err)
        {
            this.updateLog(`VarToString Error: ${err.message}`);
        }

        return source.toString();
    }

    // Add a message to the debug log if not running in the cloud
    updateLog(newMessage, errorLevel = 1)
    {
        this.log(newMessage);
        if (errorLevel === 0)
        {
            this.error(newMessage);
        }

        if ((errorLevel === 0) || this.homey.settings.get('logEnabled'))
        {
            try
            {
                const nowTime = new Date(Date.now());

                this.diagLog += '\r\n* ';
                this.diagLog += nowTime.toJSON();
                this.diagLog += '\r\n';

                this.diagLog += newMessage;
                this.diagLog += '\r\n';
                if (this.diagLog.length > 60000)
                {
                    this.diagLog = this.diagLog.substr(this.diagLog.length - 60000);
                }

                if (!this.cloudOnly)
                {
                    this.homey.api.realtime('com.ady.button_plus.logupdated', { log: this.diagLog });
                }
            }
            catch (err)
            {
                this.log(err);
            }
        }
    }

    // Send the log to the developer (not applicable to Homey cloud)
    async sendLog(body)
    {
        let tries = 5;

        let logData;
        if (body.logType === 'diag')
        {
            logData = this.diagLog;
        }
        else
        {
            logData = JSON.parse(this.detectedDevices);
            if (!logData)
            {
                throw (new Error('No data to send'));
            }

            logData = this.varToString(logData);
        }

        while (tries-- > 0)
        {
            try
            {
                // create reusable transporter object using the default SMTP transport
                const transporter = nodemailer.createTransport(
                {
                    host: Homey.env.MAIL_HOST, // Homey.env.MAIL_HOST,
                    port: 465,
                    ignoreTLS: false,
                    secure: true, // true for 465, false for other ports
                    auth:
                    {
                        user: Homey.env.MAIL_USER, // generated ethereal user
                        pass: Homey.env.MAIL_SECRET, // generated ethereal password
                    },
                    tls:
                    {
                        // do not fail on invalid certs
                        rejectUnauthorized: false,
                    },
                },
);

                // send mail with defined transport object
                const info = await transporter.sendMail(
                {
                    from: `"Homey User" <${Homey.env.MAIL_USER}>`, // sender address
                    to: Homey.env.MAIL_RECIPIENT, // list of receivers
                    subject: `Button + ${body.logType} log (${Homey.manifest.version})`, // Subject line
                    text: logData, // plain text body
                },
);

                this.updateLog(`Message sent: ${info.messageId}`);
                // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

                // Preview only available when sending through an Ethereal account
                this.log('Preview URL: ', nodemailer.getTestMessageUrl(info));
                return this.homey.__('settings.logSent');
            }
            catch (err)
            {
                this.updateLog(`Send log error: ${err.message}`, 0);
            }
        }

        return (this.homey.__('settings.logSendFailed'));
    }

    async loginToSimulator(username, password)
    {
        this.httpHelperSimulator.setBaseURL('cloud');
        this.httpHelperSimulator.setDefaultHeaders({}, true);

        const login = { email: username, password };

        const result = await this.httpHelperSimulator.post('account/login', {}, login);
        this.updateLog(`Login result: ${JSON.stringify(result)}`);

        this.cloudConnected = true;

        return result;
    }

    // Register a device so we receive state change events that are posted to the MQTT server
    registerDeviceCapabilityStateChange(device, capabilityId)
    {
        this.deviceDispather.registerDeviceCapability(device, capabilityId);
    }

    // Device Flow Card Triggers
    triggerButtonOn(device, leftright, connector)
    {
        const tokens = { left_right: leftright, connector };
        const state = { left_right: leftright ? 'left' : 'right', connector };
        this.triggerFlow(this._triggerButtonOn, device, tokens, state);
        this.triggerButtonChange(device, leftright, connector, true);
        return this;
    }

    triggerButtonOff(device, leftright, connector)
    {
        const tokens = { left_right: leftright, connector };
        const state = { left_right: leftright ? 'left' : 'right', connector };
        this.triggerFlow(this._triggerButtonOff, device, tokens, state);
        this.triggerButtonChange(device, leftright, connector, false);
        return this;
    }

    triggerButtonChange(device, leftright, connector, value)
    {
        const tokens = { left_right: leftright, connector, state: value };
        const state = { left_right: leftright ? 'left' : 'right', connector };
        this.triggerFlow(this._triggerButtonChange, device, tokens, state);
        return this;
    }

    /**
     * Triggers a flow
     * @param {this.homey.flow.getDeviceTriggerCard} trigger - A this.homey.flow.getDeviceTriggerCard instance
     * @param {Device} device - A Device instance
     * @param {Object} tokens - An object with tokens and their typed values, as defined in the app.json
     */
    triggerFlow(trigger, device, tokens, state)
    {
        if (trigger)
        {
            trigger.trigger(device, tokens, state)
                .then((result) =>
                {
                    if (result)
                    {
                        this.log(result);
                    }
                })
                .catch((error) =>
                {
                    this.homey.app.logInformation(`triggerFlow (${trigger.id})`, error);
                });
        }
    }

}

module.exports = MyApp;
