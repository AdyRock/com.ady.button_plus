/* eslint-disable camelcase */
/* eslint-disable max-len */

'use strict';

if (process.env.DEBUG === '1')
{
	// eslint-disable-next-line node/no-unsupported-features/node-builtins, global-require
	require('inspector').open(9223, '0.0.0.0', true);
}

const Homey = require('homey');

const { HomeyAPI } = require('homey-api');
// const { HomeyAPI } = require('athom-api');
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
const _ = require('lodash');

const MAX_BUTTON_CONFIGURATIONS = 40;
const MAX_DISPLAY_CONFIGURATIONS = 20;

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
		this.dateTimer = null;

		const defaultbroker = this.homey.settings.get('defaultBroker');
		if (!defaultbroker)
		{
			this.homey.settings.set('defaultBroker', 'homey');
		}

		try
		{
			const homeyLocalURL = await this.homey.cloud.getLocalAddress();
			this.homeyIP = homeyLocalURL.split(':')[0];
		}
		catch (err)
		{
			this.updateLog(`Error getting homey IP: ${err.message}`, 0);
		}

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
			if (!homeyBroker.url !== `mqtt://${this.homeyIP}`)
			{
				homeyBroker.url = `mqtt://${this.homeyIP}`;
				this.homey.settings.set('brokerConfigurationItems', this.brokerItems);
			}
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
		if (!this.buttonConfigurations || this.buttonConfigurations.length < MAX_BUTTON_CONFIGURATIONS)
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
					buttonConfiguration.leftBrokerId = 'Default';
				}

				if (!buttonConfiguration.rightBrokerId)
				{
					buttonConfiguration.rightBrokerId = 'Default';
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

				if (!buttonConfiguration.leftFrontLEDOnColor)
				{
					if (!buttonConfiguration.leftFrontLEDColor)
					{
						buttonConfiguration.leftFrontLEDOnColor = '#ff0000';
						buttonConfiguration.leftWallLEDOnColor = '#ff0000';
						buttonConfiguration.rightFrontLEDOnColor = '#ff0000';
						buttonConfiguration.rightWallLEDOnColor = '#ff0000';
					}
					else
					{
						buttonConfiguration.leftFrontLEDOnColor = buttonConfiguration.leftFrontLEDColor;
						buttonConfiguration.leftWallLEDOnColor = buttonConfiguration.leftWallLEDColor;
						buttonConfiguration.rightFrontLEDOnColor = buttonConfiguration.rightFrontLEDColor;
						buttonConfiguration.rightWallLEDOnColor = buttonConfiguration.rightWallLEDColor;

						delete buttonConfiguration.leftFrontLEDColor;
						delete buttonConfiguration.leftWallLEDColor;
						delete buttonConfiguration.rightFrontLEDColor;
						delete buttonConfiguration.rightWallLEDColor;
					}
				}

				if (!buttonConfiguration.leftFrontLEDOffColor)
				{
					buttonConfiguration.leftFrontLEDOffColor = '#000000';
					buttonConfiguration.leftWallLEDOffColor = '#000000';
					buttonConfiguration.rightFrontLEDOffColor = '#000000';
					buttonConfiguration.rightWallLEDOffColor = '#000000';
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
		if (!this.displayConfigurations || this.displayConfigurations.length < MAX_DISPLAY_CONFIGURATIONS)
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

		this.api = await HomeyAPI.createAppAPI({ homey: this.homey });
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

		this.initSettings();

		// devices
		this.updateLog('Initialize DeviceManager');
		this.deviceManager = new DeviceManager(this);

		this.updateLog('Register DeviceManager');
		await this.deviceManager.register();

//        this.getHomeyDevices({});
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
			if ((setting === 'buttonConfigurations') || (setting === 'defaultBroker'))
			{
				this.buttonConfigurations = this.homey.settings.get('buttonConfigurations');
			}
			if ((setting === 'displayConfigurations') || (setting === 'defaultBroker'))
			{
				this.displayConfigurations = this.homey.settings.get('displayConfigurations');
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
						else if (!this.server)
						{
							this.setupHomeyMQTTServer();
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

						// if (brokerItem.brokerid === 'homey')
						// {
						//     this.disconnectAllClientsAndClose();
						// }
					}
				}
			}
		});

		this._triggerButtonOn = this.homey.flow.getDeviceTriggerCard('button_on')
			.registerRunListener((args, state) =>
			{
				return ((args.left_right === state.left_right) && (args.connector === state.connector));
			});

		this._triggerButtonOff = this.homey.flow.getDeviceTriggerCard('button_off')
			.registerRunListener((args, state) =>
			{
				return ((args.left_right === state.left_right) && (args.connector === state.connector));
			});

		this._triggerButtonChange = this.homey.flow.getDeviceTriggerCard('button_change')
			.registerRunListener((args, state) =>
			{
				return ((args.left_right === state.left_right) && (args.connector === state.connector));
			});

		this._triggerButtonLongPress = this.homey.flow.getDeviceTriggerCard('button_long_press')
			.registerRunListener((args, state) =>
			{
				return ((args.left_right === state.left_right) && (args.connector === state.connector));
			});

		this._triggerButtonRelease = this.homey.flow.getDeviceTriggerCard('button_release')
			.registerRunListener((args, state) =>
			{
				return ((args.left_right === state.left_right) && (args.connector === state.connector));
			});

		// This flow is deprecated as it is replaced by the config_name_button_change flow
		this.triggerConfigButtonChanged = this.homey.flow.getDeviceTriggerCard('config_button_change')
			.registerRunListener((args, state) =>
			{
				return ((args.left_right === state.left_right) && (args.config === state.config) && (args.display_button === state.displaybutton) && (args.state === state.state));
			});

		this.triggerConfigButtonNameChanged = this.homey.flow.getDeviceTriggerCard('config_name_button_change')
			.registerRunListener((args, state) =>
			{
				return ((args.left_right === state.left_right) && (args.config.id === state.config) && (args.display_button === state.displaybutton) && (args.state === state.state));
			})
			.registerArgumentAutocompleteListener('config', async (query, args) =>
			{
				// itterate over the config array and return the name and id
				let configurations = this.buttonConfigurations;
				if (args.display_button === 'display')
				{
					configurations = this.displayConfigurations;
				}
				const results = configurations.map((config, index) => ({ name: `Configuration ${index + 1} ${config.name ? config.name : ''}`, id: index }));

				// filter the results based on the search query
				return results.filter((result) => (result.name.toLowerCase().includes(query.toLowerCase())));
			});

		// This trigger is deprecated as it is replaced by the switch_button_configuration_name trigger
		this.homey.flow.getActionCard('switch_button_configuration')
			.registerRunListener(async (args, state) =>
			{
				const config = args.configurationId - 1;
				this.log('switch_button_configuration', config);
				return args.device.triggerCapabilityListener(`configuration_button.connector${args.connector - 1}`, config.toString());
			});

		this.homey.flow.getActionCard('switch_button_configuration_name')
			.registerRunListener(async (args, state) =>
			{
				this.log('switch_button_configuration_name', args.config.id);
				return args.device.triggerCapabilityListener(`configuration_button.connector${args.connector - 1}`, args.config.id.toString());
			})
			.registerArgumentAutocompleteListener('config', async (query, args) =>
			{
				// itterate over the config array and return the name and id
				const results = this.buttonConfigurations.map((config, index) => ({ name: `Configuration ${index + 1} ${config.name ? config.name : ''}`, id: index }));

				// filter the results based on the search query
				return results.filter((result) => (result.name.toLowerCase().includes(query.toLowerCase())));
			});

		// This flow is deprecated as it is replaced by the switch_display_configuration_name flow
		this.homey.flow.getActionCard('switch_display_configuration')
			.registerRunListener(async (args, state) =>
			{
				const config = args.configurationId - 1;
				this.log('switch_display_configuration', config);
				return args.device.triggerCapabilityListener('configuration_display', config.toString());
			});

		this.homey.flow.getActionCard('switch_display_configuration_name')
			.registerRunListener(async (args, state) =>
			{
				this.log('switch_display_configuration_name', args.config.id);
				return args.device.triggerCapabilityListener('configuration_display', args.config.id.toString());
			})
			.registerArgumentAutocompleteListener('config', async (query, args) =>
			{
				// itterate over the config array and return the name and id
				const results = this.displayConfigurations.map((config, index) => ({ name: `Configuration ${index + 1} ${config.name ? config.name : ''}`, id: index }));

				// filter the results based on the search query
				return results.filter((result) => (result.name.toLowerCase().includes(query.toLowerCase())));
			});

		this.homey.flow.getActionCard('turn_on_button')
			.registerRunListener(async (args, state) =>
			{
				this.log(`${args.left_right}.connector${args.connector}`);
				return args.device.triggerCapabilityListener(`${args.left_right}_button.connector${args.connector - 1}`, true);
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
				return args.device.triggerCapabilityListener(`${args.left_right}_button.connector${args.connector - 1}`, false);
			});

		this.homey.flow.getActionCard('set_connector_button_top_label')
			.registerRunListener(async (args, state) =>
			{
				this.log(`set_connector_top_button_label ${args.left_right} connector${args.connector} to ${args.label}`);
				return args.device.updateConnectorTopLabel(args.left_right, args.connector - 1, args.label);
			});

		this.homey.flow.getActionCard('set_connector_button_text')
			.registerRunListener(async (args, state) =>
			{
				this.log(`set_connector_button_text ${args.left_right} connector${args.connector} to ${args.label}`);
				return args.device.updateConnectorLabel(args.left_right, args.connector - 1, args.label);
			});

		// This flow is deprecated as it is replaced by the set_config_name_button_top_label flow
		this.homey.flow.getActionCard('set_config_button_top_label')
			.registerRunListener(async (args, state) =>
			{
				this.log(`set_config_button_top_label ${args.left_right} config${args.config} to ${args.label}`);
				return args.device.updateConfigTopLabel(args.left_right, args.config - 1, args.label);
			});

		this.homey.flow.getActionCard('set_config_name_button_top_label')
			.registerRunListener(async (args, state) =>
			{
				this.log(`set_config_name_button_label ${args.left_right} config${args.config} to ${args.label}`);
				return args.device.updateConfigTopLabel(args.left_right, args.config.id, args.label);
			})
			.registerArgumentAutocompleteListener('config', async (query, args) =>
			{
				// itterate over the config array and return the name and id
				const results = this.buttonConfigurations.map((config, index) => ({ name: `Configuration ${index + 1} ${config.name ? config.name : ''}`, id: index }));

				// filter the results based on the search query
				return results.filter((result) => (result.name.toLowerCase().includes(query.toLowerCase())));
			});

		// This flow is deprecated as it is replaced by the set_config_name_button_label flow
		this.homey.flow.getActionCard('set_config_button_label')
			.registerRunListener(async (args, state) =>
			{
				this.log(`set_config_button_label ${args.left_right} config${args.config} to ${args.label}`);
				return args.device.updateConfigLabel(args.left_right, args.config - 1, args.label);
			});

		this.homey.flow.getActionCard('set_config_name_button_label')
			.registerRunListener(async (args, state) =>
			{
				this.log(`set_config_name_button_label ${args.left_right} config${args.config} to ${args.label}`);
				return args.device.updateConfigLabel(args.left_right, args.config.id, args.label);
			})
			.registerArgumentAutocompleteListener('config', async (query, args) =>
			{
				// itterate over the config array and return the name and id
				const results = this.buttonConfigurations.map((config, index) => ({ name: `Configuration ${index + 1} ${config.name ? config.name : ''}`, id: index }));

				// filter the results based on the search query
				return results.filter((result) => (result.name.toLowerCase().includes(query.toLowerCase())));
			});

		// This action is deprecated as it is replaced by standard dim capability
		this.homey.flow.getActionCard('set_dim')
			.registerRunListener(async (args, state) =>
			{
				this.log(`set_dim to ${args.large}, ${args.mini}, ${args.led}`);
				return args.device.setDimLevel(args.large, args.mini, args.led);
			});

		this.homey.flow.getActionCard('set_connector_led_rgb')
			.registerRunListener(async (args, state) =>
			{
				this.log(`set_connector_led_rgb ${args.left_right} connector${args.connector} to ${args.rgb}`);
				return args.device.setConnectorLEDColour(args.left_right, args.connector - 1, args.rgb, args.front_wall ? args.front_wall : 'both');
			});

		this.homey.flow.getActionCard('set_config_name_led_rgb')
			.registerRunListener(async (args, state) =>
			{
				this.log(`set_config_name_led_rgb ${args.left_right} config${args.config} to ${args.rgb}. Update Config ${args.update_config}`);
				return args.device.setConfigLEDColour(args.left_right, args.config.id, args.rgb, args.front_wall ? args.front_wall : 'both', args.update_configuration ? args.update_configuration : false, args.on_off ? args.on_off : true);
			})
			.registerArgumentAutocompleteListener('config', async (query, args) =>
			{
				// itterate over the config array and return the name and id
				const results = this.buttonConfigurations.map((config, index) => ({ name: `Configuration ${index + 1} ${config.name ? config.name : ''}`, id: index }));

				// filter the results based on the search query
				return results.filter((result) => (result.name.toLowerCase().includes(query.toLowerCase())));
			});

		this.homey.flow.getActionCard('set_display_page')
			.registerRunListener(async (args, state) =>
			{
				this.log(`set_display_page ${args.pageCommand} to ${args.index}`);
				return args.device.setSetDisplayPage(args.pageCommand, args.index);
			});

		this.homey.flow.getActionCard('upload_gonfigurations')
			.registerRunListener(async (args, state) =>
			{
				this.log(`upload_gonfigurations`);
				return args.device.uploadConfigurations();
			});


		/** * CONDITIONS ** */
		this.homey.flow.getConditionCard('is_button_on')
			.registerRunListener(async (args, state) =>
			{
				return args.device.getCapabilityValue(`${args.left_right}_button.connector${args.connector - 1}`);
			});

		// This flow is deprecated as it is replaced by the is_button_config_name flow
		this.homey.flow.getConditionCard('is_button_config')
			.registerRunListener(async (args, state) =>
			{
				const activeConfig = args.device.getCapabilityValue(`configuration_button.connector${args.connector - 1}`);
				const requiredConfig = args.config - 1;
				// eslint-disable-next-line eqeqeq
				return activeConfig == requiredConfig;
			});

		this.homey.flow.getConditionCard('is_button_config_name')
			.registerRunListener(async (args, state) =>
			{
				const activeConfig = args.device.getCapabilityValue(`configuration_button.connector${args.connector - 1}`);
				const requiredConfig = args.config.id;
				// eslint-disable-next-line eqeqeq
				return activeConfig == requiredConfig;
			})
			.registerArgumentAutocompleteListener('config', async (query, args) =>
			{
				// itterate over the config array and return the name and id
				const results = this.buttonConfigurations.map((config, index) => ({ name: `Configuration ${index + 1} ${config.name ? config.name : ''}`, id: index }));

				// filter the results based on the search query
				return results.filter((result) => (result.name.toLowerCase().includes(query.toLowerCase())));
			});

		// This flow is deprecated as it is replaced by the is_display_config_name flow
		this.homey.flow.getConditionCard('is_display_config')
			.registerRunListener(async (args, state) =>
			{
				const activeConfig = args.device.getCapabilityValue('configuration_display');
				const requiredConfig = args.config - 1;
				// eslint-disable-next-line eqeqeq
				return activeConfig == requiredConfig;
			});

		this.homey.flow.getConditionCard('is_display_config_name')
			.registerRunListener(async (args, state) =>
			{
				const activeConfig = args.device.getCapabilityValue('configuration_display');
				const requiredConfig = args.config.id;
				// eslint-disable-next-line eqeqeq
				return activeConfig == requiredConfig;
			})
			.registerArgumentAutocompleteListener('config', async (query, args) =>
			{
				// itterate over the config array and return the name and id
				const results = this.displayConfigurations.map((config, index) => ({ name: `Configuration ${index + 1} ${config.name ? config.name : ''}`, id: index }));

				// filter the results based on the search query
				return results.filter((result) => (result.name.toLowerCase().includes(query.toLowerCase())));
			});

		this.homey.on('memwarn', (data) =>
		{
			if (data)
			{
				if (data.count > data.limit - 1)
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
				if (data.count >= data.limit - 1)
				{
					this.updateLog('Closing MQTT server', 0);
					if (this.server && this.server.listening)
					{
						aedes.close((err) =>
						{
							this.updateLog(`MQTT Server closed: ${err ? err : 'Success'}`, 0);
							this.server.close();
							setTimeout(() =>
							{
								this.updateLog('Restarting MQTT Server', 0);
								this.server.listen(this.pushServerPort);
							}, 300000);
						});
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
		if (this.dateTimer !== null)
		{
			this.homey.clearTimeout(this.dateTimer);
			this.dateTimer = null;
		}

		const msUntilNextMinute = this.updateTime();

		// Set a timeout to update the time every minute
		this.dateTimer = this.homey.setTimeout(() =>
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

		const drivers = this.homey.drivers.getDrivers();
		for (const driver of Object.values(drivers))
		{
			const devices = driver.getDevices();
			for (const device of Object.values(devices))
			{
				if (device.updateDateAndTime)
				{
					device.updateDateAndTime(dateTime);
				}
			}
		}

		// Return the number of ms until next minute
		dateTime = new Date();
		return (60 - dateTime.getSeconds()) * 1000;
	}

	// Make all the device upload their button bar configurations to the panels
	async uploadConfigurations()
	{
		// Get devices to upload their configurations
		const drivers = this.homey.drivers.getDrivers();
		for (const driver of Object.values(drivers))
		{
			let devices = driver.getDevices();
			for (let device of Object.values(devices))
			{
				if (device.uploadConfigurations)
				{
					try
					{
						await device.uploadConfigurations();
					}
					catch (error)
					{
						this.updateLog(`uploadConfigurations: ${error.message}`, 0);
					}
				}

				device = null;
			}
			devices = null;
		}
	}

	// // Make all the device upload their button bar configurations to the panels
	// async refreshDisplayConfigurations()
	// {
	// 	// Get devices to upload their configurations
	// 	const drivers = this.homey.drivers.getDrivers();
	// 	for (const driver of Object.values(drivers))
	// 	{
	// 		let devices = driver.getDevices();
	// 		for (let device of Object.values(devices))
	// 		{
	// 			if (device.uploadDisplayConfigurations)
	// 			{
	// 				try
	// 				{
	// 					await device.uploadDisplayConfigurations();
	// 				}
	// 				catch (error)
	// 				{
	// 					this.updateLog(`refreshDisplayConfigurations: ${error.message}`);
	// 				}
	// 			}

	// 			device = null;
	// 		}
	// 		devices = null;
	// 	}
	// }

	// // Make all the device upload their broker configurations to the panels
	// async refresBrokerConfigurations()
	// {
	// 	// Get devices to upload their configurations
	// 	const drivers = this.homey.drivers.getDrivers();
	// 	for (const driver of Object.values(drivers))
	// 	{
	// 		let devices = driver.getDevices();
	// 		for (let device of Object.values(devices))
	// 		{
	// 			if (device.uploadBrokerConfigurations)
	// 			{
	// 				try
	// 				{
	// 					await device.uploadBrokerConfigurations(2);
	// 				}
	// 				catch (error)
	// 				{
	// 					this.updateLog(`uploadBrokerConfigurations: ${error.message}`);
	// 				}
	// 			}

	// 			device = null;
	// 		}
	// 		devices = null;
	// 	}
	// }

	createbuttonConfigurations()
	{
		if (!this.buttonConfigurations)
		{
			this.buttonConfigurations = [];
		}

		for (let i = this.buttonConfigurations.length; i < MAX_BUTTON_CONFIGURATIONS; i++)
		{
			const ButtonPanelConfiguration = {
				leftTopText: '',
				leftOnText: '',
				leftOffText: '',
				leftDevice: 'none',
				leftCapability: '',
				leftbrokerid: 'Default',
				leftDimChange: '-10',
				leftFrontLEDOnColor: '#ff0000',
				leftWallLEDOnColor: '#ff0000',
				leftFrontLEDOffColor: '#000000',
				leftWallLEDOffColor: '#000000',
				leftCustomMQTTTopics: [],
				rightTopText: '',
				rightOnText: '',
				rightOffText: '',
				rightDevice: 'none',
				rightCapability: '',
				rightbrokerid: 'Default',
				rightDimChange: '+10',
				rightFrontLEDOnColor: '#ff0000',
				rightWallLEDOnColor: '#ff0000',
				rightFrontLEDOffColor: '#000000',
				rightWallLEDOffColor: '#000000',
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

		for (let i = this.displayConfigurations.length; i < MAX_DISPLAY_CONFIGURATIONS; i++)
		{
			const displayConfiguration = {
				items: [],
			};

			this.displayConfigurations.push(displayConfiguration);
		}
		this.homey.settings.set('displayConfigurations', this.displayConfigurations);
	}

	async uploadDisplayConfiguration(ip, configurationNo, firmwareVersion)
	{
		try
		{
			// apply the new configuration
			const sectionConfiguration = {};
			await this.applyDisplayConfiguration(sectionConfiguration, configurationNo, firmwareVersion);
			this.updateLog(`Current Config: ${sectionConfiguration}`);

			// write the updated configuration back to the device
			let error = await this.writeDeviceConfiguration(ip, sectionConfiguration);
			if (error)
			{
				throw new Error(error);
			}
		}
		catch (err)
		{
			this.updateLog(`Error uploading display configuration: ${err.message}`, 0);
			throw err;
		}
	}

	async applyDisplayConfiguration(sectionConfiguration, configurationNo, firmwareVersion)
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
				if ((firmwareVersion < 1.09) && (parseInt(item.page, 10) > 0))
				{
					// Page support was added in firmware 1.09 so skip any items with a page number > 0
					continue;
				}

				if (item.device === 'customMQTT')
				{
					// Custom MQTT topic
					const capabilities = {
						align: 1,
						x: parseInt(item.xPos, 10) || 0,
						y: parseInt(item.yPos, 10) || 0,
						fontsize: parseInt(item.fontSize, 10) || 0,
						width: parseInt(item.width, 10) || 0,
						label: item.label,
						unit: item.unit,
						round: parseInt(item.rounding, 10) || 0,
						page: parseInt(item.page, 10) || 0,
						boxtype: parseInt(item.boxType, 10) || 0,
						topics: [],
					};

					// Setup the custom MQTT topic
					for (const customTopic of item.customMQTTTopics)
					{
						capabilities.topics.push({
							brokerid: customTopic.brokerId === 'Default' ? this.homey.settings.get('defaultBroker') : customTopic.brokerId,
							topic: customTopic.topic,
							eventtype: customTopic.type,
							payload: customTopic.payload,
						});
					}

					sectionConfiguration.mqttdisplays.push(capabilities);
					continue;
				}

				let { brokerId } = item;
				if (brokerId === 'Default')
				{
					brokerId = this.homey.settings.get('defaultBroker');
				}
				const capabilities = {
					align: 1,
					x: parseInt(item.xPos, 10) || 0,
					y: parseInt(item.yPos, 10) || 0,
					fontsize: parseInt(item.fontSize, 10) || 0,
					width: parseInt(item.width, 10) || 0,
					label: item.label,
					unit: item.device === 'none' ? '' : item.unit,
					round: parseInt(item.rounding, 10) || 0,
					page: parseInt(item.page, 10) || 0,
					boxtype: parseInt(item.boxType, 10) || 0,
					topics: [
					{
						brokerid: brokerId,
						topic: `homey/${item.device}/${item.capability}`,
						eventtype: 15,
						payload: '',
					}],
				};

				if (item.device === '_variable_')
				{
					// Get the variable value
					const variable = await this.homey.app.getVariable(item.capability);
					if (variable)
					{
						// Send the value to the device after a short delay to allow the device to connect to the broker
						mqttQueue.push({
							brokerId,
							message: `homey/${item.device}/${item.capability}`,
							value: variable.value,
						});
					}
				}
				else if (item.device !== 'none')
				{
					try
					{
						const homeyDeviceObject = await this.getHomeyDeviceById(item.device);
						if (homeyDeviceObject)
						{
							const capability = await this.getHomeyCapabilityByName(homeyDeviceObject, item.capability);
							if (capability)
							{
								let { value } = capability;
								if (item.capability === 'dim')
								{
									value = Math.round(value * 100);
								}

								// Send the value to the device after a short delay to allow the device to connect to the broker
								mqttQueue.push({
									brokerId,
									message: `homey/${item.device}/${item.capability}`,
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
				else
				{
					// For deviceId type None, we need to send the Label vai MQTT so the item is displayed
					// Send the value to the device after a short delay to allow the device to connect to the broker
					mqttQueue.push({
						brokerId,
						message: `homey/${item.device}/${item.capability}`,
						value: item.unit,
					});
				}

				sectionConfiguration.mqttdisplays.push(capabilities);
			}
		}

		// Send the MQTT messages after a short delay to allow the device to connect to the broker
		setTimeout(async () =>
		{
			for (const mqttMsg of mqttQueue)
			{
				this.publishMQTTMessage(mqttMsg.brokerId, mqttMsg.message, mqttMsg.value).catch(this.error);
			}
		}, 1000);
	}

	async uploadButtonPanelConfiguration(ip, panelId, connectorNo, configurationNo, firmwareVersion)
	{
		try
		{
			// download the current configuration from the device
			const deviceConfiguration = await this.readDeviceConfiguration(ip);
			this.updateLog(`Current Config: ${deviceConfiguration}`);

			if (deviceConfiguration)
			{
				const sectionConfiguration = {
					mqttbuttons: [...deviceConfiguration.mqttbuttons],
				};

				if (firmwareVersion < 1.09)
				{
					// Old firmware only paresd buttons if the core section was present
					sectionConfiguration.core = {};
				}

				// apply the new configuration
				const mqttQue = await this.applyButtonConfiguration(panelId, deviceConfiguration.info.connectors[connectorNo].type, sectionConfiguration, connectorNo, configurationNo, firmwareVersion);

				// write the updated configuration back to the device
				let error = await this.writeDeviceConfiguration(ip, sectionConfiguration);
				if (error)
				{
					throw new Error(error);
				}

				// Send the MQTT messages after a short delay to allow the device to connect to the broker
				setTimeout(async () =>
				{
					for (const mqttMsg of mqttQue)
					{
						this.publishMQTTMessage(mqttMsg.brokerId, mqttMsg.message, mqttMsg.value).catch(this.error);
					}
				}, 1000);
			}
		}
		catch (err)
		{
			this.updateLog(`Error uploading button bar configuration: ${err.message}`, 0);
			throw err;
		}
	}

	async applyButtonConfiguration(panelId, connectorType, sectionConfiguration, connectorNo, configurationNo, firmwareVersion)
	{
		const buttonIdx = connectorNo * 2;
		let arrayIdx = 0;

		if (sectionConfiguration.mqttbuttons.length > buttonIdx)
		{
			// Might only be a single configuration entry if doing a partial update
			arrayIdx = buttonIdx;
		}

		// Make sure it's a button bar
		if (connectorType === 1)
		{
			// This device has a valid button bar at the specified location so get that panels properties
			if (sectionConfiguration.mqttbuttons)
			{
				// Get the specified user configuration
				const ButtonPanelConfiguration = this.buttonConfigurations[configurationNo];
				if (ButtonPanelConfiguration)
				{
					if (ButtonPanelConfiguration.leftDevice === 'customMQTT')
					{
						try
						{
							// Add custom MQTT topics
							await this.setupCustomMQTTTopics(sectionConfiguration.mqttbuttons[arrayIdx], ButtonPanelConfiguration, connectorNo, 'left');
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
							this.setupButtonConfigSection(ButtonPanelConfiguration, panelId, buttonIdx, sectionConfiguration.mqttbuttons[arrayIdx], connectorType, firmwareVersion);
							this.setupButtonConfigSection(ButtonPanelConfiguration, panelId, buttonIdx + 1, sectionConfiguration.mqttbuttons[arrayIdx + 1], connectorType, firmwareVersion);
						}
						catch (err)
						{
							this.updateLog(`Error setting up status topic (1): ${err.message}`, 0);
						}
					}
				}
			}
		}
		else if (connectorType === 2)
		{
			this.setupButtonMQTTList(null, panelId, buttonIdx, sectionConfiguration.mqttbuttons[arrayIdx], connectorType, firmwareVersion);
			this.setupButtonMQTTList(null, panelId, buttonIdx + 1, sectionConfiguration.mqttbuttons[arrayIdx + 1], connectorType, firmwareVersion);
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

	async writeDeviceConfiguration(ip, deviceConfiguration)
	{
		if (!this.autoConfigGateway)
		{
			return null;
		}

		this.updateLog(`writeDeviceConfiguration: ${this.varToString(deviceConfiguration)}`);

		if (ip !== '')
		{
			if (_.isEmpty(deviceConfiguration))
			{
				return null;
			}

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
		const sectionConfiguration = { mqttbrokers: [] };

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
								port: parseInt(brokerItem.port, 10),
								wsport: parseInt(brokerItem.wsport, 10),
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
		return this.httpHelperLocal.post(`http://${ip}/updatefirmware`);
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
				this.updateLog(`Error getting device list: ${e.message}`, 0);
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
					return await this.deviceManager.getDeviceById(id);
				}
			}
			catch (e)
			{
				this.updateLog(`Error getting device id = ${id}: ${e.message}`, 0);
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
				this.updateLog(`Error getting capabilities for device id ${device.id}: ${e.message}`, 0);
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
				return await this.variableDispather.getVariables();
			}
			catch (e)
			{
				this.updateLog(`Error getting variables: ${e.message}`, 0);
			}
		}
		return [];
	}

	async getVariable(id)
	{
		if (this.variableDispather)
		{
			try
			{
				return await this.variableDispather.getVariable(id);
			}
			catch (e)
			{
				this.updateLog(`Error getting variables: ${e.message}`, 0);
			}
		}
		return null;
	}

	async setVariable(id, variable)
	{
		if (this.variableDispather)
		{
			try
			{
				return await this.variableDispather.setVariable(id, variable);
			}
			catch (e)
			{
				this.updateLog(`Error setting variables: ${e.message}`, 0);
			}
		}
		return null;
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
			const deviceEntry = { ip: data.address, name: device.getName() };
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

		const initialDiscoveryResults = this.discoveryStrategy.getDiscoveryResults();
		this.updateLog(`Got initial mDNS result:${this.varToString(initialDiscoveryResults)}`);
		if (initialDiscoveryResults)
		{
			for (const discoveryResult of Object.values(initialDiscoveryResults))
			{
				this.mDNSGatewaysUpdate(discoveryResult);
			}
		}

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
		try
		{
			this.server.listen(this.brokerItems[0].port, () =>
			{
				this.updateLog(`server started and listening on port ${this.brokerItems[0].port}`);
				this.mqttServerReady = true;

				// Start the MQTT client
				this.setupMQTTClient(this.brokerItems[0], this.homeyID);
			});
		}
		catch (err)
		{
			if (err.code === 'ERR_SERVER_ALREADY_LISTEN')
			{
				this.updateLog(`server already listening on port ${this.brokerItems[0].port}`);
			}
			else if (err.code === 'EADDRINUSE')
			{
				this.updateLog(`server address in use on port ${this.brokerItems[0].port}`);
			}
		}

		this.server.on('error', (err) =>
		{
			this.updateLog(`server error: ${this.varToString(err)}`, 0);
		});

		// Create a websocket server for the MQTT server
		this.wsServer = ws.createServer({ server: httpServer }, aedes.handle);

		try
		{
			httpServer.listen(this.brokerItems[0].wsport, () => {
				this.updateLog(`websocket server listening on port ${this.brokerItems[0].wsport}`);
			});
		}
		catch (err)
		{
			if (err.code === 'ERR_SERVER_ALREADY_LISTEN')
			{
				this.updateLog(`server already listening on port ${this.brokerItems[0].port}`);
			}
			else if (err.code === 'EADDRINUSE')
			{
				this.updateLog(`server address in use on port ${this.brokerItems[0].port}`);
			}
		}

		this.wsServer.on('error', (err) => {
			this.updateLog(`websocket server error: ${this.varToString(err)}`, 0);
		});

		this.wsServer.on('connection', (socket) => {
			this.updateLog('websocket server connection');
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
						this.updateLog("setupMQTTClient.onConnect 'homey/click' error: " * this.varToString(err), 0);
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

				// MQTTclient.subscribe('homey/shortpress', (err) =>
				// {
				//     if (err)
				//     {
				//         this.updateLog("setupMQTTClient.onConnect 'homey/shortpress' error: " * this.varToString(err), 0);
				//     }
				// });

				// MQTTclient.subscribe('homey/multipress', (err) =>
				// {
				//     if (err)
				//     {
				//         this.updateLog("setupMQTTClient.onConnect 'homey/multipress' error: " * this.varToString(err), 0);
				//     }
				// });

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
								// Setup device MQTT subscriptions
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
					let mqttMessage = '';
					const mqttString = message.toString();
					try
					{
						mqttMessage = JSON.parse(mqttString);
					}
					catch (err)
					{
						mqttMessage = mqttString;
					}

					this.updateLog(`MQTTclient.on message: ${topic}, ${this.varToString(mqttMessage)}`);

					// Make sure mqttMessage.connector is defined
					if (mqttMessage.idx !== undefined)
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
										if (driver.id === 'panel_hardware' && topicParts[2] === 'button_temperature')
										{
											// Add the temperature calibration offset to the value
											const temperature = mqttMessage + device.temperatureCalibration;
											device.setCapabilityValue('measure_temperature', temperature).catch(device.error);

											// request the device to check the state change
											device.checkStateChange(deviceId, 'measure_temperature', temperature);
										}
										else
										{
											device.setCapabilityValue(topicParts[2], mqttMessage).catch(device.error);
										}
										return;
									}

										if (await device.checkCoreMQTTMessage(topicParts, mqttMessage))
										{
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
		if (brokerId === 'Default')
		{
			brokerId = this.homey.settings.get('defaultBroker');
		}
		return this.MQTTClients.get(brokerId);
	}

	disconnectAllClientsAndClose()
	{
		// Iterate through all connected clients and disconnect them
		aedes.close(() =>
		{
			// server.close();
			// wsServer.close();
			// httpServer.close();
		});

		this.server = null;
		this.wsServer = null;
	}

	// eslint-disable-next-line camelcase
	async publishMQTTMessage(MQTT_Id, topic, message, Ignoresame = true, Retain = true)
	{
		if (MQTT_Id === 'Default')
		{
			MQTT_Id = this.homey.settings.get('defaultBroker');
		}

		const data = (typeof message === 'string' || message instanceof String) ? message : JSON.stringify(message);

		const lastMQTTData = this.lastMQTTData.get(`${MQTT_Id}_${topic}`);
		// eslint-disable-next-line eqeqeq
		if (Retain && Ignoresame && (lastMQTTData == data))
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
				await MQTTclient.publish(topic, data, { qos: 1, retain: Retain });
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
				return panel.id === discoveryResult.txt.id;
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
		if ((errorLevel === 0) || this.homey.settings.get('logEnabled'))
		{
			if (errorLevel === 0)
			{
				this.error(newMessage);
			}
			else
			{
				this.log(newMessage);
			}

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
	async sendLog({ email = '', description = '' })
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
					text: `${email}\n${description}\n\n${this.diagLog}`, // plain text body
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
		this.deviceDispather.registerDeviceCapability(device, capabilityId).catch((err) =>
		{
			this.updateLog(`registerDeviceCapabilityStateChange: ${err.message}`, 0);
		});
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

	triggerButtonLongPress(device, leftright, connector, repeatCount)
	{
		const tokens = { left_right: leftright, connector, repeatCount };
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

	triggerConfigButton(device, left_right, display_button, configID, button_state, onoff)
	{
		const tokens = { state: onoff };
		const state = {
			left_right,
			displaybutton: display_button === 2 ? 'display' : 'button',
			config: parseInt(configID, 10) + 1,
			state: button_state,
		};
		this.triggerFlow(this.triggerConfigButtonChanged, device, tokens, state);
		return this;
	}

	/**
	 * Triggers a flow
	 * @param {this.homey.flow.getDeviceTriggerCard} trigger - A this.homey.flow.getDeviceTriggerCard instance
	 * @param {Device} device - A Device instance
	 * @param {Object} tokens - An object with tokens and their typed values, as defined in the app.json
	 */
	async triggerFlow(trigger, device, tokens, state)
	{
		if (trigger)
		{
			this.updateLog(`triggerFlow (${trigger.id})\n tokens: ${this.varToString(tokens)},\n state: ${this.varToString(state)}`);

			try
            {
                await trigger.trigger(device, tokens, state)
            }
			catch(error)
            {
                this.updateLog(`triggerFlow (${trigger.id}) Error: ${error.message}`, 0);
            };
		}
	}

	setupButtonConfigSection(ButtonPanelConfiguration, panelId, buttonIdx, mqttButtons, connectorType, firmwareVersion)
	{
		if (connectorType === 1)
		{
			mqttButtons.toplabel = '';
			mqttButtons.label = '';
			mqttButtons.longdelay = 75;
			mqttButtons.longrepeat = 15;
			mqttButtons.id = buttonIdx;

			// // Convert the '#000000' string to a long for the LED color
			// const frontLEDOnColor = parseInt(ButtonPanelConfiguration ? ButtonPanelConfiguration[(buttonIdx & 1) === 0 ? 'leftFrontLEDOnColor' : 'rightFrontLEDOnColor'].substring(1) : '0', 16);
			// const wallLEDOnColor = parseInt(ButtonPanelConfiguration ? ButtonPanelConfiguration[(buttonIdx & 1) === 0 ? 'leftWallLEDOnColor' : 'rightWallLEDOnColor'].substring(1) : '0', 16);
			// mqttButtons.LEDColorfront = frontLEDOnColor;
			// mqttButtons.LEDColorwall = wallLEDOnColor;
		}

		this.setupButtonMQTTList(ButtonPanelConfiguration, panelId, buttonIdx, mqttButtons, connectorType, firmwareVersion);
	}

	setupButtonMQTTList(ButtonPanelConfiguration, panelId, buttonIdx, mqttButtons, connectorType, firmwareVersion)
	{
		const brokerId = this.getBrokerId(ButtonPanelConfiguration ? ButtonPanelConfiguration[(buttonIdx & 1) === 0 ? 'leftBrokerId' : 'rightBrokerId'] : 'Default');
		mqttButtons.topics = [];

		// Only add the top label, label and value if the connector type is 1
		if (connectorType === 1)
		{
			// if (mqttButtons.topics === undefined)
			// {
			// 	mqttButtons.topics = [];
			// }

			// Add the Top Label event entry
			mqttButtons.topics.push(
				{
					brokerid: brokerId,
					eventtype: 12,
					topic: `homey/${panelId}/${buttonIdx}/toplabel`,
					payload: '',
				},
			);

			// Add the Label event entry
			mqttButtons.topics.push(
				{
					brokerid: brokerId,
					eventtype: 11,
					topic: `homey/${panelId}/${buttonIdx}/label`,
					payload: '',
				},
			);

			if (firmwareVersion < 1.12)
			{
				// Add the LED on / off event entry
				mqttButtons.topics.push(
					{
						brokerid: brokerId,
						eventtype: 14,
						topic: `homey/${panelId}/${buttonIdx}/led`,
						payload: true,
					},
				);
			}
			else
			{
				// Add the LED front colour event entry
				mqttButtons.topics.push(
					{
						brokerid: brokerId,
						eventtype: 28,
						topic: `homey/${panelId}/${buttonIdx}/front`,
						payload: '',
					},
				);

				// Add the LED wall colour event entry
				mqttButtons.topics.push(
					{
						brokerid: brokerId,
						eventtype: 29,
						topic: `homey/${panelId}/${buttonIdx}/wall`,
						payload: '',
					},
				);
			}

			// Add the LED colour event entry
			mqttButtons.topics.push(
				{
					brokerid: brokerId,
					eventtype: 13,
					topic: `homey/${panelId}/${buttonIdx}/rgb`,
					payload: '',
				},
			);
		}

		const payload = { id: panelId, idx: buttonIdx };

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
	}

	// Returns the usable broker ID
	getBrokerId(brokerId)
	{
		if (brokerId === 'Default')
		{
			return this.homey.settings.get('defaultBroker');
		}

		return brokerId;
	}

}

module.exports = MyApp;
