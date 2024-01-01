/* eslint-disable max-len */

'use strict';

if (process.env.DEBUG === '1')
{
    // eslint-disable-next-line node/no-unsupported-features/node-builtins, global-require
    require('inspector').open(9223, '0.0.0.0', true);
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
const VariableDispatcher = require('./lib/variables');

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
        this.lastMQTTData = new Map();

        let defaultbroker = this.homey.settings.get('defaultBroker');
        if (!defaultbroker)
        {
            this.homey.settings.set('defaultBroker', 'homey');
        }

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
                    username: '',
                    password: '',
                },
            ];

            this.homey.settings.set('brokerConfigurationItems', this.brokerItems);
        }

        // Make sure homey broker ip is up to date
        const homeyBroker = this.brokerItems.find((broker) => broker.brokerid === 'homey');
        if (homeyBroker)
        {
            homeyBroker.url = `mqtt://${this.homeyIP}`;
            if (!homeyBroker.username)
            {
                homeyBroker.username = '';
            }
            if (!homeyBroker.password)
            {
                homeyBroker.password = '';
            }
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
                    buttonConfiguration.leftBrokerId = 'default';
                }

                if (!buttonConfiguration.rightBrokerId)
                {
                    buttonConfiguration.rightBrokerId = 'default';
                }

                if (!buttonConfiguration.leftDimChange)
                {
                    buttonConfiguration.leftDimChange = '-10';
                }

                if (!buttonConfiguration.rightDimChange)
                {
                    buttonConfiguration.rightDimChange = '+10';
                }

                // Ensure the left and right MQTT topics are arrays
                if (!Array.isArray(buttonConfiguration.leftCustomMQTTTopics))
                {
                    buttonConfiguration.leftCustomMQTTTopics = [];
                }

                if (!Array.isArray(buttonConfiguration.rightCustomMQTTTopics))
                {
                    buttonConfiguration.rightCustomMQTTTopics = [];
                }

                if (!buttonConfiguration.leftFrontLEDColor)
                {
                    buttonConfiguration.leftFrontLEDColor = '#ff0000';
                    buttonConfiguration.leftWallLEDColor = '#ff0000';
                    buttonConfiguration.rightFrontLEDColor = '#ff0000';
                    buttonConfiguration.rightWallLEDColor = '#ff0000';
                }

                if (!buttonConfiguration.leftLongDelay)
                {
                    buttonConfiguration.leftLongDelay = '75';
                }

                if (!buttonConfiguration.rightLongDelay)
                {
                    buttonConfiguration.rightLongDelay = '75';
                }

                if (!buttonConfiguration.leftLongRepeat)
                {
                    buttonConfiguration.leftLongRepeat = '15';
                }

                if (!buttonConfiguration.rightLongRepeat)
                {
                    buttonConfiguration.rightLongRepeat = '15';
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

            // Start the mDNS discovery and setup an array of detected devices
            this.setupMDNS();

            for (const brokerItem of this.brokerItems)
            {
                if (brokerItem.enabled && brokerItem.brokerid !== 'homey')
                {
                    this.setupMQTTClient(brokerItem, this.homeyID);
                }
            }
        }
        catch (err)
        {
            this.updateLog(`Error setting up local access: ${err.message}`, 0);
        }

        this.api = await HomeyAPI.forCurrentHomey(this.homey);
        try
        {
            this.system = await this._getSystemInfo();
        }
        catch (e)
        {
            this.updateLog('[boot] Failed to fetch system info', 0);
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
        this.variableDispather = new VariableDispatcher(this);

        try
        {
            this.httpHelperLocal = new HttpHelper();
        }
        catch (err)
        {
            this.updateLog(`Error connecting to panel: ${err.message}`, 0);
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
                            this.setupMQTTClient(brokerItem, this.homeyID);
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

                await this.refresBrokerConfigurations();
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

        this._triggerButtonLongPress = this.homey.flow.getDeviceTriggerCard('button_long_press')
            .registerRunListener((args, state) =>
            {
                return (args.left_right === state.left_right && args.connector === state.connector);
            });

        this._triggerButtonRelease = this.homey.flow.getDeviceTriggerCard('button_release')
            .registerRunListener((args, state) =>
            {
                return (args.left_right === state.left_right && args.connector === state.connector);
            });

        this.triggerDimLargeChanged = this.homey.flow.getDeviceTriggerCard('dim.large_changed')
            .registerRunListener((args, state) =>
            {
                return true;
            });

        this.triggerDimMiniChanged = this.homey.flow.getDeviceTriggerCard('dim.small_changed')
            .registerRunListener((args, state) =>
            {
                return true;
            });

        this.triggerDimLEDChanged = this.homey.flow.getDeviceTriggerCard('dim.led_changed')
            .registerRunListener((args, state) =>
            {
                return true;
            });

        this.homey.flow.getActionCard('switch_button_configuration')
            .registerRunListener(async (args, state) =>
            {
                const config = args.configurationId - 1;
                this.log('switch_button_configuration', config);
                return args.device.triggerCapabilityListener(`configuration_button.connector${args.connector}`, config.toString());
            });

        this.homey.flow.getActionCard('switch_display_configuration')
            .registerRunListener(async (args, state) =>
            {
                const config = args.configurationId - 1;
                this.log('switch_display_configuration', config);
                return args.device.triggerCapabilityListener('configuration_display', config.toString());
            });

        this.homey.flow.getActionCard('turn_on_button')
            .registerRunListener(async (args, state) =>
            {
                this.log(`${args.left_right}.connector${args.connector}`);
                return args.device.triggerCapabilityListener(`${args.left_right}_button.connector${args.connector}`, true);
            });

        this.homey.flow.getActionCard('set_info')
            .registerRunListener(async (args, state) =>
            {
                this.log(`${args.info}`);
                return args.device.triggerCapabilityListener('info', args.info);
            });

        this.homey.flow.getActionCard('turn_off_button')
            .registerRunListener(async (args, state) =>
            {
                this.log(`${args.left_right}.connector${args.connector}`, args);
                return args.device.triggerCapabilityListener(`${args.left_right}_button.connector${args.connector}`, false);
            });

        this.homey.flow.getActionCard('dim.large')
            .registerRunListener(async (args, state) =>
            {
                this.log(`dim.large Flow Action ${args.dim}`);
                return args.device.triggerCapabilityListener('dim.large', args.dim > 1 ? args.dim / 100 : args.dim);
            });

        this.homey.flow.getActionCard('dim.small')
            .registerRunListener(async (args, state) =>
            {
                this.log(`dim.small Flow Action ${args.dim}`);
                return args.device.triggerCapabilityListener('dim.small', args.dim > 1 ? args.dim / 100 : args.dim);
            });

        this.homey.flow.getActionCard('dim.led')
            .registerRunListener(async (args, state) =>
            {
                this.log(`dim.led Flow Action ${args.dim}`);
                return args.device.triggerCapabilityListener('dim.led', args.dim > 1 ? args.dim / 100 : args.dim);
            });

        this.homey.flow.getActionCard('dim.large_relative')
            .registerRunListener(async (args, state) =>
            {
                this.log('dim.large_relative');
                return args.device.triggerCapabilityListener('dim.large', args.dim > 1 ? args.dim / 100 : args.dim);
            });

        this.homey.flow.getActionCard('dim.small_relative')
            .registerRunListener(async (args, state) =>
            {
                this.log('dim.small_relative');
                return args.device.triggerCapabilityListener('dim.small', args.dim > 1 ? args.dim / 100 : args.dim);
            });

        this.homey.flow.getActionCard('dim.led_relative')
            .registerRunListener(async (args, state) =>
            {
                this.log('dim.led_relative');
                return args.device.triggerCapabilityListener('dim.led', args.dim > 1 ? args.dim / 100 : args.dim);
            });
        this.homey.flow.getActionCard('set_connector_button_top_label')
            .registerRunListener(async (args, state) =>
            {
                this.log(`set_connector_button_label ${args.left_right} connector${args.connector} to ${args.label}`);
                return args.device.updateConnectorTopLabel(args.left_right, args.connector - 1, args.label);
            });
        this.homey.flow.getActionCard('set_config_button_top_label')
            .registerRunListener(async (args, state) =>
            {
                this.log(`set_config_button_label ${args.left_right} config${args.config} to ${args.label}`);
                return args.device.updateConfigTopLabel(args.left_right, args.config - 1, args.label);
            });

        /** * CONDITIONS ** */
        this._conditionIsButtonOn = this.homey.flow.getConditionCard('is_button_on');
        this._conditionIsButtonOn.registerRunListener(async (args, state) =>
        {
            return args.device.getCapabilityValue(`${args.left_right}_button.connector${args.connector}`);
        });

        this.homey.on('memwarn', (data) =>
        {
            if (data)
            {
                if (data.count > data.limit - 5)
                {
                    this.diagLog = '';
                }
                this.updateLog(`memwarn! ${data.count} of ${data.limit}`, 0);
            }
            else
            {
                this.updateLog('memwarn', 0);
            }
        });

        this.homey.on('cpuwarn', (data) =>
        {
            if (data)
            {
                if (data.count > data.limit - 5)
                {
                    this.updateLog('Closing server', 0);
                    if (this.server && this.server.listening)
                    {
                        this.server.close((err) => 
                        {
                            this.updateLog(`Server closed: ${err}`, 0);
                        });
                        this.server.closeAllConnections();
                        setTimeout(() =>
                        {
                            this.server.close();
                            this.server.listen(this.pushServerPort);
                        }, 300000);
                    }
                }
                this.updateLog(`cpuwarn! ${data.count} of ${data.limit}`, 0);
            }
            else
            {
                this.updateLog('cpuwarn', 0);
            }
        });

        this.syncTime();

        this.updateLog('MyApp has been initialized');
    }

    async syncTime()
    {
        this.dateTimer = null;
        const msUntilNextMinute = this.updateTime();

        // Set a timeout to update the time every minute
        this.homey.setTimeout(() =>
        {
            this.syncTime();
        }, msUntilNextMinute);
    }

    updateTime()
    {
        // Allow for Homey's timezone setting
        const tzString = this.homey.clock.getTimezone();
        let dateTime = new Date();
        dateTime = new Date(dateTime.toLocaleString('en-US', { timeZone: tzString }));

        // Get the date using the short month format
        const date = dateTime.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });

        // get the time in the local format, but exclude seconds keeping am/pm if it's 12 hour format
        // eslint-disable-next-line object-curly-newline
        const time = dateTime.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: 'numeric' });

        const drivers = this.homey.drivers.getDrivers();
        for (const driver of Object.values(drivers))
        {
            let devices = driver.getDevices();
            for (let device of Object.values(devices))
            {
                if (device.hasCapability('date'))
                {
                    device.setCapabilityValue('date', date).catch(this.error);
                    device.setCapabilityValue('time', time).catch(this.error);
                }
            }
        }

        // Return the number of ms until next minute
        dateTime = new Date();
        return (60 - dateTime.getSeconds()) * 1000;
    }

    // Make all the device upload their button bar configurations to the panels
    async refreshbuttonConfigurations()
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
                        this.updateLog(`refreshbuttonConfigurations: ${error.message}`, 0);
                    }
                }

                device = null;
            }
            devices = null;
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
                        await device.uploadDisplayConfigurations();
                    }
                    catch (error)
                    {
                        this.updateLog(`refreshDisplayConfigurations: ${error.message}`);
                    }
                }

                device = null;
            }
            devices = null;
        }
    }

    // Make all the device upload their broker configurations to the panels
    async refresBrokerConfigurations()
    {
        // Get devices to upload their configurations
        const drivers = this.homey.drivers.getDrivers();
        for (const driver of Object.values(drivers))
        {
            let devices = driver.getDevices();
            for (let device of Object.values(devices))
            {
                if (device.uploadBrokerConfigurations)
                {
                    try
                    {
                        await device.uploadBrokerConfigurations(null, true);
                    }
                    catch (error)
                    {
                        this.updateLog(`uploadBrokerConfigurations: ${error.message}`);
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
                leftbrokerid: 'default',
                leftDimChange: '-10',
                leftFrontLEDColor: '#ff0000',
                leftWallLEDColor: '#ff0000',
                leftCustomMQTTTopics: [],
                rightTopText: '',
                rightOnText: '',
                rightOffText: '',
                rightDevice: 'none',
                rightCapability: '',
                rightbrokerid: 'default',
                rightDimChange: '+10',
                rightFrontLEDColor: '#ff0000',
                rightWallLEDColor: '#ff0000',
                rightCustomMQTTTopics: [],
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

    async uploadDisplayConfiguration(ip, configurationNo, panelId)
    {
        try
        {
            // apply the new configuration
            const sectionConfiguration = {};
            const mqttQue = await this.applyDisplayConfiguration(sectionConfiguration, configurationNo, panelId);
            this.updateLog(`Current Config: ${sectionConfiguration}`);

            // write the updated configuration back to the device
            await this.writeDeviceConfiguration(ip, sectionConfiguration);

            // Send the MQTT messages after a short delay to allow the device to connect to the broker
            setTimeout(() =>
            {
                for (const mqttMsg of mqttQue)
                {
                    this.publishMQTTMessage(mqttMsg.brokerId, mqttMsg.message, mqttMsg.value);
                }
            }, 1000);
        }
        catch (err)
        {
            this.updateLog(`Error uploading display configuration: ${err.message}`, 0);
            throw err;
        }

        return;
    }

    async applyDisplayConfiguration(sectionConfiguration, configurationNo, panelId)
    {
        // Get the specified user configuration
        const displayConfiguration = this.displayConfigurations[configurationNo];
        const mqttQueue = [];

        // Update the device configuration
        if (displayConfiguration)
        {
            sectionConfiguration.mqttdisplays = [];
            for (let itemNo = 0; itemNo < displayConfiguration.items.length; itemNo++)
            {
                const item = displayConfiguration.items[itemNo];
                const capabilities = {
                    x: parseInt(item.xPos, 10),
                    y: parseInt(item.yPos, 10),
                    fontsize: parseInt(item.fontSize, 10),
                    width: parseInt(item.width, 10),
                    label: item.label,
                    unit: item.unit,
                    round: parseInt(item.rounding, 10),
                    topics: [
                    {
                        brokerid: item.brokerId,
                        topic: `homey/${item.device}/${item.capability}/value`,
                        eventtype: 15,
                    }],
                };

                if (item.device === '_variable_')
                {
                    // Get the variable value
                    const variable = await this.api.logic.getVariable({ id: item.capability });
                    if (variable)
                    {
                        // Send the value to the device after a short delay to allow the device to connect to the broker
                        mqttQueue.push({
                            brokerId: item.brokerId,
                            message: `homey/${item.device}/${item.capability}/value`,
                            value: variable.value,
                        });
                    }
                }
                else if (item.device !== 'none')
                {
                    try
                    {
                        const homeyDeviceObject = await this.homey.app.getHomeyDeviceById(item.device);
                        if (homeyDeviceObject)
                        {
                            const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObject, item.capability);
                            if (capability)
                            {
                                let { value } = capability;
                                if (item.capability === 'dim')
                                {
                                    value = Math.round(value * 100);
                                }

                                // Send the value to the device after a short delay to allow the device to connect to the broker
                                mqttQueue.push({
                                    brokerId: item.brokerId,
                                    message: `homey/${item.device}/${item.capability}/value`,
                                    value,
                                });

                                this.registerDeviceCapabilityStateChange(item.device, item.capability);
                            }
                        }
                    }
                    catch (err)
                    {
                        continue;
                    }
                }

                sectionConfiguration.mqttdisplays.push(capabilities);
            }
        }

        return mqttQueue;
    }

    async uploadButtonPanelConfiguration(ip, panelId, connectorNo, configurationNo)
    {
        try
        {
            // download the current configuration from the device
            const deviceConfiguration = await this.readDeviceConfiguration(ip);
            this.updateLog(`Current Config: ${deviceConfiguration}`);

            if (deviceConfiguration)
            {
                const sectionConfiguration = {'mqttbuttons': [...deviceConfiguration.mqttbuttons]};

                // apply the new configuration
                await this.applyButtonConfiguration(panelId, deviceConfiguration, sectionConfiguration, connectorNo, configurationNo);

                // write the updated configuration back to the device
                await this.writeDeviceConfiguration(ip, deviceConfiguration);
            }
        }
        catch (err)
        {
            this.updateLog(`Error uploading button bar configuration: ${err.message}`, 0);
            throw err;
        }
    }

    async applyButtonConfiguration(panelId, deviceConfiguration, sectionConfiguration, connectorNo, configurationNo)
    {
        if (deviceConfiguration)
        {
            // Update the device configuration for the selected connectorNo
            if (deviceConfiguration.info && deviceConfiguration.info.connectors)
            {
                const connectorIdx = deviceConfiguration.info.connectors.findIndex((connector) => connector.id === connectorNo);
                if (connectorIdx < 0)
                {
                    this.updateLog(`Invalid connector number: ${connectorNo}`, 0);
                    throw new Error(`Invalid connector number: ${connectorNo}`);
                }

                // Make sure it's a button bar
                if (deviceConfiguration.info.connectors[connectorIdx].type === 1)
                {
                    // This device has a valid button bar at the specified location so get that panels properties
                    if (sectionConfiguration.mqttbuttons)
                    {
                        // Get the specified user configuration
                        const ButtonPanelConfiguration = this.buttonConfigurations[configurationNo];
                        if (!ButtonPanelConfiguration)
                        {
                            this.updateLog(`Invalid button bar configuration: ${configurationNo}`, 0);
                            throw new Error(`Invalid button bar configuration: ${configurationNo}`);
                        }

                        let buttonIdx = connectorNo * 2;
                        if (ButtonPanelConfiguration.leftDevice === 'customMQTT')
                        {
                            try
                            {
                                // Add custom MQTT topics
                                await this.setupCustomMQTTTopics(
                                    sectionConfiguration.mqttbuttons[buttonIdx],
                                    ButtonPanelConfiguration,
                                    connectorNo,
                                    'left',
                                );
                            }
                            catch (err)
                            {
                                this.updateLog(`Error setting up custom MQTT topics: ${err.message}`, 0);
                            }
                        }
                        else
                        {
                            try
                            {
                                // Configure the left button bar
                                const capability = await this.setupClickTopic(
                                    sectionConfiguration.mqttbuttons[buttonIdx],
                                    ButtonPanelConfiguration,
                                    connectorNo,
                                    'left',
                                    panelId,
                                );

                                await this.setupStatusTopic(
                                    panelId,
                                    buttonIdx,
                                    sectionConfiguration.mqttbuttons[buttonIdx],
                                    ButtonPanelConfiguration,
                                    'left',
                                    capability,
                                );
                            }
                            catch (err)
                            {
                                this.updateLog(`Error setting up status topic: ${err.message}`, 0);
                            }
                        }
                        // Configure the right button bar
                        buttonIdx++;
                        if (ButtonPanelConfiguration.leftDevice === 'customMQTT')
                        {
                            try
                            {
                                // Add custom MQTT topics
                                await this.setupCustomMQTTTopics(
                                    sectionConfiguration.mqttbuttons[buttonIdx],
                                    ButtonPanelConfiguration,
                                    connectorNo,
                                    'right',
                                );
                            }
                            catch (err)
                            {
                                this.updateLog(`Error setting up custom MQTT topics: ${err.message}`, 0);
                            }
                        }
                        else
                        {
                            try
                            {
                                const capability = await this.setupClickTopic(
                                    sectionConfiguration.mqttbuttons[buttonIdx],
                                    ButtonPanelConfiguration,
                                    connectorNo,
                                    'right',
                                    panelId
                                );

                                await this.setupStatusTopic(
                                    panelId,
                                    buttonIdx,
                                    sectionConfiguration.mqttbuttons[buttonIdx],
                                    ButtonPanelConfiguration,
                                    'right',
                                    capability,
                                );
                            }
                            catch (err)
                            {
                                this.updateLog(`Error setting up status topic: ${err.message}`, 0);
                            }
                        }
                    }
                }
                else if (deviceConfiguration.info.connectors[connectorIdx].type === 2)
                {

                    // Create click events for the display buttons
                    const buttonIdx = connectorNo * 2;
                    try
                    {
                        await this.setupDisplayClickTopic(sectionConfiguration.mqttbuttons[buttonIdx], connectorNo, 'left', panelId);
                    }
                    catch (err)
                    {
                        this.updateLog(`Error setting up display click topic: ${err.message}`, 0);
                    }

                    try
                    {
                        await this.setupDisplayClickTopic(sectionConfiguration.mqttbuttons[buttonIdx + 1], connectorNo, 'right', panelId);
                    }
                    catch (err)
                    {
                        this.updateLog(`Error setting up display click topic: ${err.message}`, 0);
                    }
                }
                else
                {
                    this.updateLog(`Invalid connector type: ${deviceConfiguration.info.connectors[connectorIdx].type} on ${connectorNo}`, 0);
                    throw new Error(`Invalid connector type: ${deviceConfiguration.info.connectors[connectorIdx].type} on ${connectorNo}`);
                }
            }
        }
    }

    async setupCustomMQTTTopics(mqttButtons, ButtonPanelConfiguration, connectorNo, side)
    {
        const customMQTTTopics = ButtonPanelConfiguration[`${side}CustomMQTTTopics`];
        const topLabel = ButtonPanelConfiguration[`${side}TopText`];
        const labelOn = ButtonPanelConfiguration[`${side}OnText`];
        mqttButtons.toplabel = topLabel;
        mqttButtons.label = labelOn;

        try
        {
            mqttButtons.topics = [];
            for (const customMQTTTopic of customMQTTTopics)
            {
                if (customMQTTTopic.topic !== '' && customMQTTTopic.enabled)
                {
                    mqttButtons.topics.push(
                        {
                            brokerid: customMQTTTopic.brokerId !== 'Default' ? customMQTTTopic.brokerId : this.homey.settings.get('defaultBroker'),
                            eventtype: customMQTTTopic.eventType,
                            topic: customMQTTTopic.topic,
                            payload: customMQTTTopic.payload,
                        },
                    );
                }
            }
        }
        catch (err)
        {
            this.updateLog(`Error setting up custom MQTT topics: ${err.message}`, 0);
        }
    }

    setupDisplayClickTopic(mqttButtons, connectorNo, side, panelId)
    {
        mqttButtons.toplabel = '';
        mqttButtons.label = '';
        mqttButtons.longdelay = 50;
        mqttButtons.longrepeat = 15;

        mqttButtons.topics = [];
        let payload = {
            connector: connectorNo,
            side,
            device: 'none',
            capability: 'none',
            type: 'boolean',
            panelId,
        };
        payload = JSON.stringify(payload);

        let brokerId = this.homey.settings.get('defaultBroker');

        // Add the click event entry
        mqttButtons.topics.push(
            {
                brokerid: brokerId,
                eventtype: 0,
                topic: 'homey/click',
                payload,
            },
        );

        // Add the long press event entry
        mqttButtons.topics.push(
            {
                brokerid: brokerId,
                eventtype: 1,
                topic: 'homey/longpress',
                payload,
            },
        );

        // Add the click release event entry
        mqttButtons.topics.push(
            {
                brokerid: brokerId,
                eventtype: 2,
                topic: 'homey/clickrelease',
                payload,
            },
        );

        // Add the short press event entry
        mqttButtons.topics.push(
            {
                brokerid: brokerId,
                eventtype: 3,
                topic: 'homey/shortpress',
                payload,
            },
        );

        // Add the multipress press event entry
        mqttButtons.topics.push(
            {
                brokerid: brokerId,
                eventtype: 4,
                topic: 'homey/multipress',
                payload,
            },
        );
    }

    async setupClickTopic(mqttButtons, ButtonPanelConfiguration, connectorNo, side, panelId)
    {
        let readOnly = false;
        let capability = null;
        let type = '';

        const configDevice = ButtonPanelConfiguration[`${side}Device`];
        const configCapability = ButtonPanelConfiguration[`${side}Capability`];
        var brokerId = ButtonPanelConfiguration[`${side}BrokerId`];
        if (brokerId === 'Default')
        {
            brokerId = this.homey.settings.get('defaultBroker');
        }

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
                panelId,
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

                // Add the long press event entry
                mqttButtons.topics.push(
                    {
                        brokerid: brokerId,
                        eventtype: 1,
                        topic: 'homey/longpress',
                        payload,
                    },
                );

                // Add the clickrelease event entry
                mqttButtons.topics.push(
                    {
                        brokerid: brokerId,
                        eventtype: 2,
                        topic: 'homey/clickrelease',
                        payload,
                    },
                );

                // // Add the short press event entry
                // mqttButtons.topics.push(
                //     {
                //         brokerid: brokerId,
                //         eventtype: 3,
                //         topic: 'homey/shortpress',
                //         payload,
                //     },
                // );

                // // Add the multipress press event entry
                // mqttButtons.topics.push(
                //     {
                //         brokerid: brokerId,
                //         eventtype: 4,
                //         topic: 'homey/multipress',
                //         payload,
                //     },
                // );
            }
        }
        catch (err)
        {
            this.updateLog(`Error setting up click topic: ${err.message}`, 0);
        }

        return capability;
    }

    async setupStatusTopic(panelId, buttonIdx, mqttButtons, ButtonPanelConfiguration, side, capability)
    {
        const configCapability = ButtonPanelConfiguration[`${side}Capability`];
        const topLabel = ButtonPanelConfiguration[`${side}TopText`];
        const labelOn = configCapability === 'dim' ? ButtonPanelConfiguration[`${side}DimChange`] : ButtonPanelConfiguration[`${side}OnText`];
        const labelOff = ButtonPanelConfiguration[`${side}OffText`];
        const configDevice = ButtonPanelConfiguration[`${side}Device`];
        const longDelay = ButtonPanelConfiguration[`${side}LongDelay`];
        const longRepeat = ButtonPanelConfiguration[`${side}LongRepeat`];

        let brokerId = ButtonPanelConfiguration[`${side}BrokerId`];

        if (brokerId === 'Default')
        {
            brokerId = this.homey.settings.get('defaultBroker');
        }

        mqttButtons.toplabel = topLabel;
        mqttButtons.label = labelOn ? labelOn : labelOff;
        mqttButtons.longdelay = longDelay;
        mqttButtons.longrepeat = longRepeat;

        // Convert the '#000000' string to a long for the LED color
        const frontLEDColor = parseInt(ButtonPanelConfiguration[`${side}FrontLEDColor`].substring(1), 16);
        const wallLEDColor = parseInt(ButtonPanelConfiguration[`${side}WallLEDColor`].substring(1), 16);
        mqttButtons.ledcolorfront = frontLEDColor;
        mqttButtons.ledcolorwall = wallLEDColor;

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
                        topic: `${panelId}/button/${buttonIdx}/value`,
                        payload,
                    },
                );

                // Add the Top Label event entry
                mqttButtons.topics.push(
                    {
                        brokerid: brokerId,
                        eventtype: 12,
                        topic: `${panelId}/button/${buttonIdx}/toplabel`,
                        payload,
                    },
                );

                // Add the Label event entry
                mqttButtons.topics.push(
                    {
                        brokerid: brokerId,
                        eventtype: 11,
                        topic: `${panelId}/button/${buttonIdx}/label`,
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

                // Add the Top Label event entry
                mqttButtons.topics.push(
                    {
                        brokerid: brokerId,
                        eventtype: 12,
                        topic: `homey/${configDevice}/${configCapability}/toplabel`,
                        payload,
                    },
                );

                // Add the Label event entry
                mqttButtons.topics.push(
                    {
                        brokerid: brokerId,
                        eventtype: 11,
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
            this.updateLog(`Error setting up status topic: ${err.message}`, 0);
        }
    }

    async setupPanelTemperatureTopic(ip, device)
    {
        if (ip !== '')
        {
            try
            {
                // Add the temperature event entry
                let brokerId = this.homey.settings.get('defaultBroker');
                if (brokerId === 'Default')
                {
                    brokerId = this.homeyID.getSetting('defaultBroker');
                }
                const mqttSenors = {
                    mqttsensors: [
                        {
                            sensorid: 1,
                            interval: 10,
                            topic: {
                            brokerid: brokerId,
                            topic: `homey/${device}/measure_temperature/value`,
                            payload: '',
                            eventtype: 18,
                            },
                        },
                    ],
                };

                this.updateLog(`writeSensorConfig: ${this.varToString(mqttSenors)}`);

                const MQTTclient = this.MQTTClients.get(brokerId);
                if (MQTTclient)
                {
                    MQTTclient.subscribe(`homey/${device}/measure_temperature/value`, (err) =>
                    {
                        if (err)
                        {
                            this.updateLog("setupMQTTClient.onConnect 'homey/sensorvalue' error: " * this.varToString(err), 0);
                        }
                    });
                }

                // Use the local device
                return await this.httpHelperLocal.post(`http://${ip}/configsave`, mqttSenors);
            }
            catch (err)
            {
                this.updateLog(`Error setting up status topic: ${err.message}`, 0);
            }
        }

        return null;
    }

    async readDeviceConfiguration(ip)
    {
        // Read the device configuration from the specified device
        if (ip !== '')
        {
            try
            {
                return await this.httpHelperLocal.get(`http://${ip}/config`);
            }
            catch (err)
            {
                this.updateLog(`readDeviceConfiguration error: ${err.message}`, 0);
            }
        }
        else
        {
            this.updateLog('readDeviceConfiguration: no connections available');
        }
        return null;
    }

    async writeDeviceConfiguration(ip, deviceConfiguration, partial = false)
    {
        if (!this.autoConfigGateway)
        {
            return null;
        }

        // Remove core.brightnesslargedisplay and core.brightnessminidisplay references from deviceConfiguration
        if (deviceConfiguration.core && deviceConfiguration.core.brightnesslargedisplay)
        {
            delete deviceConfiguration.core.brightnesslargedisplay;
            delete deviceConfiguration.core.brightnessminidisplay;
        }
    
        this.updateLog(`writeDeviceConfiguration: ${this.varToString(deviceConfiguration)}`);

        if (ip !== '')
        {
            try
            {
                // Use the local device
                await this.httpHelperLocal.post(`http://${ip}/configsave`, deviceConfiguration);
                return null;
            }
            catch (err)
            {
                this.updateLog(`writeDeviceConfiguration error: ${err.message}`, 0);
                return err.message;
            }
        }
        return 'No IP address';
    }

    async applyBrokerConfiguration(ip)
    {
        // Make sure the device configuration has the MQTT broker Id's define
        const sectionConfiguration = {mqttbrokers: []};

        for (const brokerItem of this.brokerItems)
        {
            if (brokerItem.enabled)
            {
                if ((ip !== '') || brokerItem.brokerid !== 'homey')
                {
                    if (sectionConfiguration.mqttbrokers.findIndex((broker) => broker.brokerid === brokerItem.brokerid) < 0)
                    {
                        // Add the broker Id
                        sectionConfiguration.mqttbrokers.push(
                            {
                                brokerid: brokerItem.brokerid,
                                url: brokerItem.url,
                                port: brokerItem.port,
                                wsport: brokerItem.wsport,
                                username: brokerItem.username,
                                password: brokerItem.password,
                            },
                        );
                    }
                }
            }
            else
            {
                // Find the broker Id and remove it
                const brokerIdx = sectionConfiguration.mqttbrokers.findIndex((broker) => broker.brokerid === brokerItem.brokerid);
                if (brokerIdx >= 0)
                {
                    sectionConfiguration.mqttbrokers.splice(brokerIdx, 1);
                }
            }
        }

        // find the Homey broker in the device configuration and make sure the IP address is up to date
        const brokerIdx = sectionConfiguration.mqttbrokers.findIndex((broker) => broker.brokerid === 'homey');
        if (brokerIdx >= 0)
        {
            sectionConfiguration.mqttbrokers[brokerIdx].url = `mqtt://${this.homeyIP}`;
        }

        return sectionConfiguration;
    }

    async updateFirmware(ip)
    {
        return await this.httpHelperLocal.get(`http://${ip}/updatefirmware`);
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

                // Sort the devices by name
                devices = Object.values(devices).sort((a, b) => a.name.localeCompare(b.name));

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
                this.updateLog(`Error getting devices: ${e.message}`, 0);
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
                this.updateLog(`Error getting devices: ${e.message}`, 0);
            }
        }
        return undefined;
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
                this.updateLog(`Error getting capability: ${e.message}`, 0);
            }
        }
        return undefined;
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
                this.updateLog(`Error getting devices: ${e.message}`, 0);
            }
        }
        return [];
    }

    async getVariables()
    {
        if (this.variableDispather)
        {
            try
            {
                return this.variableDispather.getVariables();
            }
            catch (e)
            {
                this.updateLog(`Error getting variables: ${e.message}`, 0);
            }
        }
        return [];
    }

    async getButtonDevices()
    {
        // Get the apps devices
        const driver = this.homey.drivers.getDriver('panel_hardware');
        const devices = [];
        const driverDevices = driver.getDevices();
        for (const device of Object.values(driverDevices))
        {
            const data = device.getSettings();
            const deviceEntry = {ip: data.address, name: device.getName()};
            devices.push(deviceEntry);
        }

        return devices;
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
        this.mDNSPanels = this.homey.settings.get('gateways');
        this.mDNSPanels = [];

        // setup the mDNS discovery for local gateways
        this.discoveryStrategy = this.homey.discovery.getStrategy('panel');

        this.homey.setTimeout(() => {
            const initialDiscoveryResults = this.discoveryStrategy.getDiscoveryResults();
            this.updateLog(`Got initial mDNS result:${this.varToString(initialDiscoveryResults)}`);
            if (initialDiscoveryResults)
            {
                for (const discoveryResult of Object.values(initialDiscoveryResults))
                {
                    this.mDNSGatewaysUpdate(discoveryResult);
                }
            }
        }, 2000);

        this.discoveryStrategy.on('result', (discoveryResult) =>
        {
            this.updateLog(`Got mDNS result:${this.varToString(discoveryResult)}`);
            this.mDNSGatewaysUpdate(discoveryResult);
        });

        this.discoveryStrategy.on('addressChanged', (discoveryResult) =>
        {
            this.updateLog(`Got mDNS address changed:${this.varToString(discoveryResult)}`);
            this.mDNSGatewaysUpdate(discoveryResult);
        });
    }

    setupHomeyMQTTServer()
    {
        // Setup the local MQTT server
        aedes.authenticate = function aedesAuthenticate(client, username, password, callback)
        {
            password = password ? Buffer.from(password, 'base64').toString() : '';
            if ((!username || username === this.brokerItems[0].username) && (password === this.brokerItems[0].password))
            {
                callback(null, true);
            }
            else
            {
                callback(new Error('Authentication Failed'), false);
            }
            // callback(null, true);
        }.bind(this);

        this.server = net.createServer(aedes.handle);
        this.server.listen(this.brokerItems[0].port, () =>
        {
            this.updateLog(`server started and listening on port ${this.brokerItems[0].port}`);
            this.mqttServerReady = true;

            // Start the MQTT client
            this.setupMQTTClient(this.brokerItems[0], this.homeyID);
        });

        this.server.on('error', (err) =>
        {
            this.updateLog(`server error: ${this.varToString(err)}`, 0);
        });

        // Create a websocket server for the MQTT server
        this.wsServer = ws.createServer({ server: httpServer }, aedes.handle);

        httpServer.listen(this.brokerItems[0].wsport, () => {
            // this.updateLog(`websocket server listening on port ${this.brokerItems[0].wsport}`);
        });

        this.wsServer.on('error', (err) => {
            this.updateLog(`websocket server error: ${this.varToString(err)}`, 0);
        });

        this.wsServer.on('connection', (socket) => {
            // this.updateLog(`websocket server connection: ${this.varToString(socket)}`);
        });

        this.wsServer.on('message', (message) => {
            this.updateLog(`websocket server message: ${this.varToString(message)}`);
        });
    }

    setupMQTTClient(brokerConfig, homeyID)
    {
        try
        {
            // Connect to the MQTT server and subscribe to the required topics
            // this.MQTTclient = mqtt.connect(MQTT_SERVER, { clientId: `HomeyButtonApp-${homeyID}`, username: Homey.env.MQTT_USER_NAME, password: Homey.env.MQTT_PASSWORD });
            this.updateLog(`setupMQTTClient connect: ${brokerConfig.url}:${brokerConfig.port}`, 1);
            const MQTTclient = mqtt.connect(`${brokerConfig.url}:${brokerConfig.port}`, { clientId: `HomeyButtonApp-${homeyID}`, username: brokerConfig.username, password: brokerConfig.password });
            this.MQTTClients.set(brokerConfig.brokerid, MQTTclient);

            MQTTclient.on('connect', () =>
            {
                this.updateLog(`setupMQTTClient.onConnect: connected to ${brokerConfig.url}:${brokerConfig.port} as ${brokerConfig.brokerid}`);

                MQTTclient.subscribe('homey/click', (err) =>
                {
                    if (err)
                    {
                        this.updateLog("setupMQTTClient.onConnect 'homey/toggle' error: " * this.varToString(err), 0);
                    }
                });

                MQTTclient.subscribe('homey/longpress', (err) =>
                {
                    if (err)
                    {
                        this.updateLog("setupMQTTClient.onConnect 'homey/longpress' error: " * this.varToString(err), 0);
                    }
                });

                MQTTclient.subscribe('homey/clickrelease', (err) =>
                {
                    if (err)
                    {
                        this.updateLog("setupMQTTClient.onConnect 'homey/clickrelease' error: " * this.varToString(err), 0);
                    }
                });

                MQTTclient.subscribe('homey/shortpress', (err) =>
                {
                    if (err)
                    {
                        this.updateLog("setupMQTTClient.onConnect 'homey/shortpress' error: " * this.varToString(err), 0);
                    }
                });

                MQTTclient.subscribe('homey/multipress', (err) =>
                {
                    if (err)
                    {
                        this.updateLog("setupMQTTClient.onConnect 'homey/multipress' error: " * this.varToString(err), 0);
                    }
                });

                const drivers = this.homey.drivers.getDrivers();
                for (const driver of Object.values(drivers))
                {
                    let devices = driver.getDevices();
                    for (let device of Object.values(devices))
                    {
                        if (device.setupMQTTSubscriptions)
                        {
                            try
                            {
                                device.setupMQTTSubscriptions(MQTTclient);
                            }
                            catch (error)
                            {
                                this.updateLog(`SsetupMQTTClient: ${error.message}`, 0);
                            }
                        }

                        device = null;
                    }
                    devices = null;
                }
            });

            MQTTclient.on('error', (err) =>
            {
                this.updateLog(`setupMQTTClient.onError: ${this.varToString(err)}`, 0);
            });

            MQTTclient.on('message', async (topic, message) =>
            {
                // message is in Buffer
                try
                {
                    const mqttMessage = JSON.parse(message.toString());
                    this.updateLog(`MQTTclient.on message: ${this.varToString(mqttMessage)}`);

                    // Make sure mqttMessage.connector is defined
                    if (mqttMessage.connector !== undefined)
                    {
                        // Find the device that handles this message
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
                                        this.updateLog(`MQTTclient.on('message'): ${error.message}`);
                                    }
                                }

                                device = null;
                            }
                            devices = null;
                        }
                    }
                    else
                    {
                        // Look for homey at the start of the topic string
                        const topicParts = topic.split('/');
                        if (topicParts.length >= 3 && topicParts[0] === 'homey')
                        {
                            // next part is the device id
                            const deviceId = topicParts[1];

                            // Try to find the driver / device that has this id
                            const drivers = this.homey.drivers.getDrivers();
                            for (const driver of Object.values(drivers))
                            {
                                const devices = driver.getDevices();
                                for (const device of Object.values(devices))
                                {
                                    if (device.__id === deviceId)
                                    {
                                        device.setCapabilityValue(topicParts[2], mqttMessage).catch(device.error);
                                        return;
                                    }
                                }
                            }
                        }
                        else if (topicParts.length >= 3 && topicParts[0].substring(0, 4) === 'btn_')
                        {
                            const drivers = this.homey.drivers.getDrivers();
                            for (const driver of Object.values(drivers))
                            {
                                const devices = driver.getDevices();
                                for (const device of Object.values(devices))
                                {
                                    if (device.processMQTTBtnMessage)
                                    {
                                        device.processMQTTBtnMessage(topicParts, mqttMessage).catch(device.error);
                                    }
                                }
                            }
                        }
                    }
                }
                catch (err)
                {
                    this.updateLog(`MQTT Client error: ${topic}: ${err.message}`, 0);
                }
            });

            return true;
        }
        catch (err)
        {
            this.updateLog(`setupMQTTClient error: ${err.message}`, 0);
            return false;
        }
    }

    getMqttClient(brokerId)
    {
        return this.MQTTClients.get(brokerId);
    }

    // eslint-disable-next-line camelcase
    async publishMQTTMessage(MQTT_Id, topic, message)
    {
        const data = (typeof message === 'string' || message instanceof String) ? message : JSON.stringify(message);

        const lastMQTTData = this.lastMQTTData.get(`${MQTT_Id}_${topic}`);
        if (lastMQTTData == data) 
        {
            this.updateLog(`publishMQTTMessage: ${MQTT_Id}_${topic}, ${data}, ignored, same as previous value`);
            return;
        }

        this.lastMQTTData.set(`${MQTT_Id}_${topic}`, data);

        this.updateLog(`publishMQTTMessage: ${data} to topic ${topic}`);
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
            this.updateLog(`publishMQTTMessage error: ${err.message}`, 0);
        }
    }

    // Build a list of gateways detected by mDNS
    mDNSGatewaysUpdate(discoveryResult)
    {
        try
        {
            let index = this.mDNSPanels.findIndex((panel) =>
            {
                return panel.id === discoveryResult.id;
            });

            if (index >= 0)
            {
                // Already cached so just make sure the address is up to date
                this.mDNSPanels[index].ip = discoveryResult.address;
            }
            else
            {
                // Add a new entry to the cache
                const gateway = {
                    id: discoveryResult.txt.id,
                    ip: discoveryResult.address,
                    model: discoveryResult.txt.md,
                };

                this.mDNSPanels.push(gateway);
                index = this.mDNSPanels.length - 1;
            }

            const { id } = this.mDNSPanels[index];
            this.updateDeviceIPAddress(id, discoveryResult.address);

            this.homey.settings.set('gateways', this.mDNSPanels);
        }
        catch (err)
        {
            this.updateLog(`mDNSGatewaysUpdate error: ${err.message}`, 0);
        }
    }

    async updateDeviceIPAddress(id, newIp)
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
                        device.updateGatewayConfig(id, newIp);
                    }

                    device = null;
                }
                devices = null;
            }
        }
        catch (err)
        {
            this.updateLog(`updateDeviceIPAddress error: ${err.message}`, 0);
        }
    }

    findGatewayIPById(id)
    {
        const index = this.mDNSPanels.findIndex((panel) =>
        {
            return panel.id === id;
        });

        if (index >= 0)
        {
            return this.mDNSPanels[index].ip;
        }

        return null;
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
        if (errorLevel === 0)
        {
            this.error(newMessage);
        }
        else
        {
            this.log(newMessage);
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

    getLog()
    {
        return this.diagLog;
    }

    clearLog()
    {
        this.diagLog = '';
        this.homey.api.realtime('com.ady.button_plus.logupdated', { log: this.diagLog });
    }

    // Send the log to the developer (not applicable to Homey cloud)
    async sendLog({email = '', description = ''})
    {
        let tries = 5;
        let error = null;
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
                    subject: `Button + log (${Homey.manifest.version})`, // Subject line
                    text: email + '\n' + description + '\n\n' + this.diagLog // plain text body
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
                error = err;
            }
        }

        throw new Error(this.homey.__('settings.logSendFailed') + error.message);
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

    triggerButtonLongPress(device, leftright, connector)
    {
        const tokens = { left_right: leftright, connector };
        const state = { left_right: leftright ? 'left' : 'right', connector };
        this.triggerFlow(this._triggerButtonLongPress, device, tokens, state);
        return this;
    }

    triggerButtonRelease(device, leftright, connector)
    {
        const tokens = { left_right: leftright, connector };
        const state = { left_right: leftright ? 'left' : 'right', connector };
        this.triggerFlow(this._triggerButtonRelease, device, tokens, state);
        return this;
    }

    triggerDim(device, subdevice, dim)
    {
        const tokens = { dim };
        const state = { dim };
        if (subdevice === 'largedisplay')
        {
            this.triggerFlow(this.triggerDimLargeChanged, device, tokens, state);
        }
        else if (subdevice === 'minidisplay')
        {
            this.triggerFlow(this.triggerDimMiniChanged, device, tokens, state);
        }
        else if (subdevice === 'leds')
        {
            this.triggerFlow(this.triggerDimLEDChanged, device, tokens, state);
        }
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
