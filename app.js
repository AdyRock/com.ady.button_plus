/* eslint-disable max-len */

'use strict';

if (process.env.DEBUG === '1')
{
    // eslint-disable-next-line node/no-unsupported-features/node-builtins, global-require
    require('inspector').open(9223, '0.0.0.0', false);
}

const Homey = require('homey');

const { HomeyAPI } = require('athom-api');
const net = require('./net');
const nodemailer = require('./nodemailer');
const aedes = require('./aedes')();
const mqtt = require('./mqtt');
const HttpHelper = require('./lib/HttpHelper');
const DeviceManager = require('./lib/DeviceManager');
const DeviceDispatcher = require('./lib/DeviceStateChangedDispatcher');

const PORT = 49876;
// const MQTT_SERVER = 'mqtt://localhost:49876';
const MQTT_SERVER = 'mqtt://mqtt.button.plus:1883';
const USE_LOCAL_MQTT = false;

const MAX_CONFIGURATIONS = 20;

class MyApp extends Homey.App
{

    /**
     * onInit is called when the app is initialized.
     */
    async onInit()
    {
        this.serverReady = false;
        this.autoConfigGateway = true;
        this.homey.settings.set('autoConfig', this.autoConfigGateway);

        this.buttonConfigurations = this.homey.settings.get('buttonConfigurations');
        if (!this.buttonConfigurations || this.buttonConfigurations.length < MAX_CONFIGURATIONS)
        {
            // Create the default button bar configurations
            this.createbuttonConfigurations();
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
            // Setup the local access method if possible
            if (USE_LOCAL_MQTT)
            {
                this.setupMQTTServer();
            }
            this.setupMDNS();
            this.homeyID = await this.homey.cloud.getHomeyId();
            this.setupMQTTClient(this.homeyID);
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
            this.httpHelper = new HttpHelper();
            const username = this.homey.settings.get('username');
            const password = this.homey.settings.get('password');

            if (username && password)
            {
                await this.loginToSimulator(username, password);
            }
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
                            await device.uploadButtonConfigurations();
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
        if (this.cloudConnected)
        {
            // Get devices to upload their configurations
            const drivers = this.homey.drivers.getDrivers();
            for (const driver of Object.values(drivers))
            {
                let devices = driver.getDevices();
                for (let device of Object.values(devices))
                {
                    if (device.uploadbuttonConfigurations)
                    {
                        try
                        {
                            await device.uploadDisplayConfigurations();
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
                rightTopText: '',
                rightOnText: '',
                rightOffText: '',
                rightDevice: 'none',
                rightCapability: '',
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

    async uploadDisplayConfiguration(ip, virtualID, configurationNo)
    {
        try
        {
            // download the current configuration from the device
            const deviceConfiguration = await this.readDeviceConfiguration(ip, virtualID);

            if (deviceConfiguration)
            {
                // apply the new configuration
                this.applyDisplayConfiguration(deviceConfiguration, configurationNo);
                this.updateLog(`Current Config: ${deviceConfiguration}`);

                // write the updated configuration back to the device
                await this.writeDeviceConfiguration(ip, deviceConfiguration, virtualID);
            }
        }
        catch (err)
        {
            this.updateLog(`Error uploading display configuration: ${err.message}`);
            throw err;
        }
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
                            brokerid: 'buttonplus',
                            topic: `homey/${item.device}/${item.capability}/value`,
                            eventtype: 15,
                        }],
                    };

                    deviceConfiguration.mqttdisplays.push(capabilities);
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
                        let capability = await this.setupClickTopic(buttonIdx, deviceConfiguration.mqttbuttons[buttonIdx], ButtonPanelConfiguration.leftDevice, ButtonPanelConfiguration.leftCapability, connectorNo, 'left');
                        await this.setupStatusTopic(buttonIdx, deviceConfiguration.mqttbuttons[buttonIdx], ButtonPanelConfiguration.leftTopText, ButtonPanelConfiguration.leftOnText, ButtonPanelConfiguration.leftOffText, ButtonPanelConfiguration.leftDevice, ButtonPanelConfiguration.leftCapability, capability);

                        // Configure the right button bar
                        buttonIdx++;
                        capability = await this.setupClickTopic(buttonIdx, deviceConfiguration.mqttbuttons[buttonIdx], ButtonPanelConfiguration.rightDevice, ButtonPanelConfiguration.rightCapability, connectorNo, 'right');
                        await this.setupStatusTopic(buttonIdx, deviceConfiguration.mqttbuttons[buttonIdx], ButtonPanelConfiguration.rightTopText, ButtonPanelConfiguration.rightOnText, ButtonPanelConfiguration.rightOffText, ButtonPanelConfiguration.rightDevice, ButtonPanelConfiguration.rightCapability, capability);
                    }
                }
            }
        }
    }

    async setupClickTopic(buttonIdx, mqttButtons, configDevice, configCapability, connectorNo, side)
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
                connector: connectorNo, side, device: configDevice, capability: configCapability, type,
            };
            payload = JSON.stringify(payload);

            if (!readOnly)
            {
                // Add the click event entry
                mqttButtons.topics.push(
                    {
                        brokerid: 'buttonplus',
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

    async setupStatusTopic(buttonIdx, mqttButtons, topLabel, labelOn, labelOff, configDevice, configCapability, capability)
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
                        brokerid: 'buttonplus',
                        eventtype: 14,
                        topic: `homey/button/${buttonIdx}/value`,
                        payload,
                    },
                );

                // Add the Label event entry
                mqttButtons.topics.push(
                    {
                        brokerid: 'buttonplus',
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
                            brokerid: 'buttonplus',
                            eventtype: 14,
                            topic: `homey/${configDevice}/${configCapability}/value`,
                            payload,
                        },
                    );
                }

                // Add the Label event entry
                mqttButtons.topics.push(
                    {
                        brokerid: 'buttonplus',
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
        if (this.cloudConnected)
        {
            try
            {
                // TODO change to use IP for real hardware
                this.updateLog(`readDeviceConfiguration for ${virtualID}`);
                return this.httpHelper.get(`button/config/${virtualID}`);
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
        if (this.cloudConnected)
        {
            // Write the device configuration to the specified device
            try
            {
                this.updateLog(`writeDeviceConfiguration: ${this.varToString(deviceConfiguration)}`);

                // TODO change to use IP for real hardware
                const options = {
                    json: true,
                };

                return this.httpHelper.post(`/button/postbutton?id=${virtualID}`, options, deviceConfiguration);
            }
            catch (err)
            {
                this.updateLog(`writeDeviceConfiguration error: ${err.message}`);
            }
        }
        return null;
    }

    async getHomeyDevices({ type = '', id = '' })
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

                if (type || id)
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
                            if ((type && capability.type === type) || (id && capability.id === id))
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
        const homeyLocalURL = await this.homey.cloud.getLocalAddress();
        this.homeyIP = homeyLocalURL.split(':')[0];

        this.mDNSGateways = this.homey.settings.get('gateways');
        this.mDNSGateways = [];

        this.autoConfigGateway = this.homey.settings.get('autoConfig');

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

    setupMQTTServer()
    {
        // Setup the local MQTT server
        const server = net.createServer(aedes.handle);
        server.listen(PORT, () =>
        {
            this.updateLog(`server started and listening on port ${PORT}`);
            this.serverReady = true;
        });

        server.on('error', (err) =>
        {
            this.updateLog(`server error: ${this.varToString(err)}`);
        });
    }

    setupMQTTClient(homeyID)
    {
        aedes.authenticate = function aedesAuthenticate(client, username, password, callback)
        {
            // callback(null, (username === Homey.env.MQTT_USER_NAME) && (password.toString() === Homey.env.MQTT_PASSWORD));
            callback(null, true);
        };

        // Connect to the MQTT server and subscribe to the required topics
        // this.MQTTclient = mqtt.connect(MQTT_SERVER, { clientId: `HomeyButtonApp-${homeyID}`, username: Homey.env.MQTT_USER_NAME, password: Homey.env.MQTT_PASSWORD });
        this.MQTTclient = mqtt.connect(MQTT_SERVER, { clientId: `HomeyButtonApp-${homeyID}`, username: '', password: '' });
        this.MQTTclient.on('connect', () =>
        {
            this.updateLog(`setupLocalAccess.onConnect: connected to ${MQTT_SERVER}`);

            this.MQTTclient.subscribe('homey/click', (err) =>
            {
                if (err)
                {
                    this.updateLog("setupLocalAccess.onConnect 'homey/toggle' error: " * this.varToString(err), 0);
                }
            });

            this.MQTTclient.subscribe('homey/longpress', (err) =>
            {
                if (err)
                {
                    this.updateLog("setupLocalAccess.onConnect 'homey/longpress' error: " * this.varToString(err), 0);
                }
            });

            this.MQTTclient.subscribe('homey/sensorvalue', (err) =>
            {
                if (err)
                {
                    this.updateLog("setupLocalAccess.onConnect 'homey/sensorvalue' error: " * this.varToString(err), 0);
                }
            });
        });

        this.MQTTclient.on('error', (err) =>
        {
            this.updateLog(`setupLocalAccess.onError: ${this.varToString(err)}`);
        });

        this.MQTTclient.on('message', (topic, message) =>
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
                                    device.processMQTTMessage(topic, mqttMessage);
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

    async publishMQTTMessage(topic, message)
    {
        const data = JSON.stringify(message);
        this.updateLog(`publishMQTTMessage: ${data} to topic ${topic}}`);
        this.MQTTclient.publish(topic, data, { qos: 1, retain: true });
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
        this.httpHelper.setBaseURL('cloud');
        this.httpHelper.setDefaultHeaders({}, true);

        const login = { email: username, password };

        const result = await this.httpHelper.post('account/login', {}, login);
        this.updateLog(`Login result: ${JSON.stringify(result)}`);

        this.cloudConnected = true;

        return result;
    }

    // Register a device so we receive state change events that are posted to the MQTT server
    registerDeviceCapabilityStateChange(device, capabilityId)
    {
        this.deviceDispather.registerDeviceCapability(device, capabilityId);
    }

}

module.exports = MyApp;
