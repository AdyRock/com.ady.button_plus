/* eslint-disable max-len */
/* eslint-disable camelcase */

'use strict';

const { Device } = require('homey');
const _ = require('lodash');

class PanelDevice extends Device
{

	/**
	 * onInit is called when the device is initialized.
	 */
	async onInit()
	{
		this.initFinished = false;
		this.longPressOccurred = new Map();

		const { id } = this.getData();
		this.id = id;

		const settings = this.getSettings();

		this.ip = settings.address;

		if (!settings.statusbar)
		{
			settings.statusbar = 2;
		}

		this.langCode = settings.langCode;
		if (!this.langCode)
		{
			this.langCode = this.homey.i18n.getLanguage();
			settings.langCode = this.langCode;
		}

		this.weekdayFormat = settings.weekdayFormat;
		if (this.weekdayFormat == null)
		{
			settings.weekdayFormat = 'none';
		}

		this.dateFormat = settings.dateFormat;
		if (this.dateFormat == null)
		{
			this.dateFormat = '2-digit';
			settings.dateFormat = this.dateFormat;
		}

		this.monthFormat = settings.monthFormat;
		if (this.monthFormat == null)
		{
			this.monthFormat = 'short';
			settings.monthFormat = this.monthFormat;
		}

		this.yearFormat = settings.yearFormat;
		if (this.yearFormat == null)
		{
			this.yearFormat = 'numeric';
			settings.yearFormat = this.yearFormat;
		}

		this.timeFormat = settings.timeFormat;
		if (this.timeFormat == null)
		{
			this.timeFormat = 'T24';
			settings.timeFormat = this.timeFormat;
		}

		this.temperatureCalibration = settings.temperatureCalibration;
		if (this.temperatureCalibration == null)
		{
			this.temperatureCalibration = 0;
			settings.temperatureCalibration = 0;
		}

		this.setSettings(settings).catch(this.error);

		if (this.hasCapability('configuration.display'))
		{
			try
			{
				await this.removeCapability('configuration.display');
			}
			catch (error)
			{
				this.error(error);
			}
		}

		this.registerCapabilityListener('configuration_display', this.onCapabilityDisplayConfiguration.bind(this));

		this.buttonTime = [];
		await this.configureConnectors(settings);

		if (!this.hasCapability('info'))
		{
			await this.addCapability('info');
		}

		await this.registerCapabilityListener('info', this.onCapabilityInfo.bind(this));

		this.checkGatewayConfig();

		if (!this.hasCapability('measure_temperature'))
		{
			await this.addCapability('measure_temperature');
		}

		if (!this.hasCapability('date'))
		{
			await this.addCapability('date');
		}

		if (!this.hasCapability('time'))
		{
			await this.addCapability('time');
		}

		if (this.hasCapability('dim.large'))
		{
			await this.removeCapability('dim.large');
		}

		if (this.hasCapability('dim.small'))
		{
			await this.removeCapability('dim.small');
		}

		if (this.hasCapability('dim.led'))
		{
			await this.removeCapability('dim.led');
		}

		if (!this.hasCapability('button.update_firmware'))
		{
			await this.addCapability('button.update_firmware');
		}

		if (!this.hasCapability('button.apply_config'))
		{
			await this.addCapability('button.apply_config');
		}

		this.registerCapabilityListener('dim', this.onCapabilityDim.bind(this));

		this.registerCapabilityListener('button.update_firmware', async () =>
		{
			// Maintenance action button was pressed
			return this.homey.app.updateFirmware(this.ip);
		});

		this.registerCapabilityListener('button.apply_config', async () =>
		{
			// Maintenance action button was pressed
			await this.uploadConfigurations();
		});

		await this.setupMQTTSubscriptions('Default');

		await this.uploadConfigurations();

		this.log('PanelDevice has been initialized');
		this.initFinished = true;
	}

	async setupMQTTSubscriptions(brokerId)
	{
		const mqttClient = this.homey.app.getMqttClient(brokerId);

		if (!mqttClient)
		{
			return;
		}

		if (this.firmware >= 1.09)
		{
			let value = this.getCapabilityValue('dim');
			this.homey.app.publishMQTTMessage(brokerId, `homey/${this.id}/brightness/value`, value * 255).catch(this.error);

			value = 1;
			if (this.page !== null)
			{
				value = `${this.page - 1}`;
			}
			this.homey.app.publishMQTTMessage(brokerId, `homey/${this.id}/setpage/value`, value);

			mqttClient.subscribe(`homey/${this.id}/currentpage/value`, (err) =>
			{
				if (err)
				{
					this.homey.app.updateLog("setupMQTTClient.subscribe 'currentpage/value' error: " * this.homey.app.varToString(err), 0);
				}
			});
		}
	}

	async onCapabilityDim(value, opts)
	{
		if (opts && opts.mqtt)
		{
			// From MQTT, don't send it back
			return;
		}

		// Publish the new value to the MQTT broker
		const brokerId = this.homey.settings.get('defaultBroker');
		this.homey.app.publishMQTTMessage(brokerId, `homey/${this.id}/brightness/value`, value * 100).catch(this.error);
	}

	/**
	 * onAdded is called when the user adds the device, called just after pairing.
	 */
	async onAdded()
	{
		await super.onAdded();
		this.log('PanelDevice has been added');
	}

	/**
	 * onSettings is called when the user updates the device's settings.
	 * @param {object} event the onSettings event data
	 * @param {object} event.oldSettings The old settings object
	 * @param {object} event.newSettings The new settings object
	 * @param {string[]} event.changedKeys An array of keys changed since the previous version
	 * @returns {Promise<string|void>} return a custom message that will be displayed
	 */
	async onSettings({ oldSettings, newSettings, changedKeys })
	{
		await super.onSettings({ oldSettings, newSettings, changedKeys });
		if (changedKeys.includes('address'))
		{
			// Ensure it is a valid IP address
			const ip = newSettings.address;
			if (!ip.match(/^(\d{1,3}\.){3}\d{1,3}$/))
			{
				throw new Error('Invalid IP address');
			}
			this.ip = ip;
		}
		if (changedKeys.includes('mac'))
		{
			// Ensure it is a valid MAC address
			const { mac } = newSettings;
			if (!mac.match(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/))
			{
				throw new Error('Invalid MAC address');
			}
		}

		let updateDateAndTime = false;
		// All others should be date and time related
		if (changedKeys.includes('langCode'))
		{
			// Ensure it is a valid language code
			const { langCode } = newSettings;
			if (!langCode.match(/^[a-z]{2}$/))
			{
				throw new Error('Invalid language code');
			}

			this.langCode = langCode;
		}

		if (changedKeys.includes('weekdayFormat'))
		{
			this.weekdayFormat = newSettings.weekdayFormat;
			updateDateAndTime = true;
		}

		if (changedKeys.includes('dateFormat'))
		{
			this.dateFormat = newSettings.dateFormat;
			updateDateAndTime = true;
		}

		if (changedKeys.includes('monthFormat'))
		{
			this.monthFormat = newSettings.monthFormat;
			updateDateAndTime = true;
		}

		if (changedKeys.includes('yearFormat'))
		{
			this.yearFormat = newSettings.yearFormat;
			updateDateAndTime = true;
		}

		if (changedKeys.includes('timeFormat'))
		{
			this.timeFormat = newSettings.timeFormat;
			updateDateAndTime = true;
		}

		if (changedKeys.includes('statusbar'))
		{
			setImmediate(() =>
			{
				this.updateStatusBar(null).catch(this.error);
			});
		}

		if (updateDateAndTime)
		{
			// Allow for Homey's timezone setting
			const tzString = this.homey.clock.getTimezone();
			let dateTime = new Date();
			dateTime = new Date(dateTime.toLocaleString('en-US', { timeZone: tzString }));

			setImmediate(() =>
			{
				this.updateDateAndTime(dateTime).catch(this.error);
			});
		}

		if (changedKeys.includes('temperatureCalibration'))
		{
			this.temperatureCalibration = newSettings.temperatureCalibration;
		}
	}

	/**
	 * onRenamed is called when the user updates the device's name.
	 * This method can be used this to synchronise the name to the device.
	 * @param {string} name The new name
	 */
	async onRenamed(name)
	{
		await super.onRenamed(name);
		this.log('PanelDevice was renamed');
	}

	/**
	 * onDeleted is called when the user deleted the device.
	 */
	async onDeleted()
	{
		await super.onDeleted();
		this.log('PanelDevice has been deleted');
	}

	async processMQTTBtnMessage(topic, MQTTMessage)
	{
		if (!this.initFinished)
		{
			return;
		}

		// search the topic for the device id
		if (topic[1] === 'brightness')
		{
			const dim = parseFloat(MQTTMessage) / 100;
			this.triggerCapabilityListener('dim', dim, { mqtt: true }).catch((e) => this.homey.app.updateLog(this.homey.app.varToString(e), 0));
		}
	}

	getBrokerIdAndBtnIdx(side, connector)
	{
		let brokerId = 'Default';
		const buttonIdx = (connector * 2) + (side === 'right' ? 1 : 0);
		if (this.hasCapability(`configuration_button.connector${connector}`))
		{
			// Get the configuration number for this connector
			const configNo = this.getCapabilityValue(`configuration_button.connector${connector}`);
			const item = this.homey.app.buttonConfigurations[configNo];
			if (item)
			{
				if (side === 'left')
				{
					brokerId = item.leftBrokerId;
				}
				else
				{
					brokerId = item.rightBrokerId;
				}
			}
		}

		return { brokerId, buttonIdx };
	}

	findConnectorUsingConfigNo(configNo)
	{
		// Find the button connector that has this configuration
		for (let connector = 0; connector < 8; connector++)
		{
			if (this.hasCapability(`configuration_button.connector${connector}`))
			{
				// Get the configuration number for this connector
				const config = this.getCapabilityValue(`configuration_button.connector${connector}`);
				// eslint-disable-next-line eqeqeq
				if (config == configNo)
				{
					return connector;
				}
			}
		}

		throw new Error('Configuration is not assigned to a button');
	}

	async updateConnectorTopLabel(left_right, connector, label)
	{
		const { brokerId, buttonIdx } = this.getBrokerIdAndBtnIdx(left_right, connector);
		return this.homey.app.publishMQTTMessage(brokerId, `homey/${this.id}/${buttonIdx}/toplabel`, label).catch(this.error);
	}

	async updateConnectorLabel(left_right, connector, label)
	{
		const { brokerId, buttonIdx } = this.getBrokerIdAndBtnIdx(left_right, connector);
		return this.homey.app.publishMQTTMessage(brokerId, `homey/${this.id}/${buttonIdx}/label`, label).catch(this.error);
	}

	async updateConfigTopLabel(left_right, configNo, label)
	{
		// Find the button connector that has this configuration
		const connector = this.findConnectorUsingConfigNo(configNo);
		return this.updateConnectorTopLabel(left_right, connector, label);
	}

	async updateConfigLabel(left_right, configNo, label)
	{
		// Find the button connector that has this configuration
		const connector = this.findConnectorUsingConfigNo(configNo);
		return this.updateConnectorLabel(left_right, connector, label);
	}

	async updateDateAndTime(dateTime)
	{
		if (this.hasCapability('date'))
		{
			let date = '';
			let formatString = { year: 'numeric', month: 'long', day: '2-digit' };
			formatString.day = this.dateFormat;
			formatString.month = this.monthFormat;
			formatString.year = this.yearFormat;
			const { weekdayFormat } = this;
			if (weekdayFormat !== 'none')
			{
				formatString.weekday = weekdayFormat;
			}

			try
			{
				// Get the date using the short month format
				date = dateTime.toLocaleDateString(this.langCode, formatString);
			}
			catch (err)
			{
				// Get the date using the long month format
				formatString = { year: 'numeric', month: 'long', day: '2-digit' };
				date = dateTime.toLocaleDateString(this.langCode, formatString);
			}

			let time = '';
			const tf = this.getSetting('timeFormat');
			if (tf === 'T24')
			{
				// get the time in the local format, but exclude seconds
				// eslint-disable-next-line object-curly-newline
				time = dateTime.toLocaleTimeString(this.langCode, { hour12: false, hour: '2-digit', minute: '2-digit' });
			}
			else
			{
				// get the time in the local format, but exclude seconds keeping am/pm if it's 12 hour format
				// eslint-disable-next-line object-curly-newline
				time = dateTime.toLocaleTimeString(this.langCode, { hour12: true, hour: 'numeric', minute: '2-digit' });
			}

			// Replace a . with a : in the time
			time = time.replace('.', ':');

			this.setCapabilityValue('date', date).catch(this.error);
			this.setCapabilityValue('time', time).catch(this.error);
		}
	}

	async updateStatusBar(deviceConfigurations)
	{
		if (this.ip !== '')
		{
			// If a device configuration is passed, just update that.
			if (deviceConfigurations)
			{
				const statusbar = parseInt(this.getSetting('statusbar'), 10);
				if (deviceConfigurations.core && deviceConfigurations.core.statusbar !== statusbar)
				{
					deviceConfigurations.core.statusbar = statusbar;
				}
				else
				{
					delete deviceConfigurations.core.statusbar;
				}
				return null;
			}

			try
			{
				const sectionConfiguration = {
					core:
					{
						statusbar: this.getSetting('statusbar'),
					},
				};

				this.homey.app.updateLog(`writeCore ${this.homey.app.varToString(sectionConfiguration)}`);

				return await await this.homey.app.writeDeviceConfiguration(this.ip, sectionConfiguration);
			}
			catch (err)
			{
				this.homey.app.updateLog(`Error setting up pane temperature topic: ${err.message}`, 0);
				return err.message;
			}
		}

		return null;
	}

	async setDimLevel(large, mini)
	{
		if (this.ip !== '')
		{
			try
			{
				if (this.firmware <= 1.09)
				{
					const sectionConfiguration = {
						core:
						{
							brightnesslargedisplay: large,
							brightnessminidisplay: mini,
						},
					};
	
					this.homey.app.updateLog(`writeCore ${this.homey.app.varToString(sectionConfiguration)}`);
					return await await this.homey.app.writeDeviceConfiguration(this.ip, sectionConfiguration);
				}
				else
				{
					const brokerId = this.homey.settings.get('defaultBroker');
					this.homey.app.publishMQTTMessage(brokerId, `homey/${this.id}/brightness/large/value`, large, false, false).catch(this.error);
					this.homey.app.publishMQTTMessage(brokerId, `homey/${this.id}/brightness/mini/value`, mini, false, false).catch(this.error);
				}
			}
			catch (err)
			{
				this.homey.app.updateLog(`Error setting up core brightness topic: ${err.message}`, 0);
				return err.message;
			}
		}

		return null;
	}

	async setConnectorLEDColour(left_right, connector, rgbString, front_wall)
	{
		if (this.firmware < 1.12)
		{
			if (front_wall !== 'both')
			{
				throw new Error('Firmware too old to support this feature. Set the Front / Wall to both or update the firmware to 1.12 or later');
			}
		}

		const brokerId = this.homey.settings.get('defaultBroker');
		let buttonNo = connector * 2;
		if (left_right === 'right')
		{
			buttonNo++;
		}
		// Remove the # from rgbString and convert it to a number
		rgbString = rgbString.replace('#', '');
		const rgb = parseInt(rgbString, 16);
		if (front_wall === 'front')
		{
			return this.homey.app.publishMQTTMessage(brokerId, `homey/${this.id}/${buttonNo}/front`, rgb, false, false).catch(this.error);
		}
		if (front_wall === 'wall')
		{
			return this.homey.app.publishMQTTMessage(brokerId, `homey/${this.id}/${buttonNo}/wall`, rgb, false, false).catch(this.error);
		}

		return this.homey.app.publishMQTTMessage(brokerId, `homey/${this.id}/${buttonNo}/rgb`, rgb, false, false).catch(this.error);
	}

	async setConfigLEDColour(left_right, configNo, rgb, front_wall, updateConfig)
	{
		const item = this.homey.app.buttonConfigurations[configNo];
		if (item)
		{
			if (this.firmware < 1.12)
			{
				if (front_wall !== 'both' && !updateConfig)
				{
					throw new Error('Firmware too old to support this feature. Set the Front / Wall to both or set Update configuration or update the firmware to 1.12 or later');
				}
			}

			if (updateConfig)
			{
				// Update the configuration with the new colour
				if (left_right === 'left')
				{
					if ((front_wall === 'front') || (front_wall === 'both'))
					{
						item.leftFrontLEDColor = rgb;
					}

					if ((front_wall === 'wall') || (front_wall === 'both'))
					{
						item.leftWallLEDColor = rgb;
					}
				}
				else
				{
					if ((front_wall === 'front') || (front_wall === 'both'))
					{
						item.rightFrontLEDColor = rgb;
					}

					if ((front_wall === 'wall') || (front_wall === 'both'))
					{
						item.rightWallLEDColor = rgb;
					}
				}

				this.homey.settings.set('buttonConfigurations', this.homey.app.buttonConfigurations);
			}

			// Find the button connector that has this configuration
			for (let connector = 0; connector < 8; connector++)
			{
				if (this.hasCapability(`configuration_button.connector${connector}`))
				{
					// Get the configuration number for this connector
					const config = this.getCapabilityValue(`configuration_button.connector${connector}`);

					// eslint-disable-next-line eqeqeq
					if (config == configNo)
					{
						if (updateConfig)
						{
							// Send the new configuration to the device
							return this.uploadOneButtonConfiguration(connector, configNo);
						}
	
						return this.setConnectorLEDColour(left_right, connector, rgb, front_wall);
					}
				}
			}

			throw new Error('Configuration is not assigned to a button');
		}
		else
		{
			throw new Error('Invalid configuration number');
		}
	}

	async setSetDisplayPage(pageCommand, page)
	{
		if (this.firmware < 1.09)
		{
			throw new Error('Firmware too old to support this feature');
		}

		const brokerId = this.homey.settings.get('defaultBroker');
		if (pageCommand === 'index')
		{
			if (!page)
			{
				this.page = 1;
			}
			else
			{
				this.page = page;
			}
			pageCommand = `${this.page - 1}`;
		}

		this.homey.app.publishMQTTMessage(brokerId, `homey/${this.id}/setpage/value`, pageCommand).catch(this.error);
	}

	async uploadPanelTemperatureConfiguration(deviceConfigurations)
	{
		if (this.ip !== '')
		{
			try
			{
				// Add the temperature event entry
				const brokerId = this.homey.settings.get('defaultBroker');
				const sectionConfiguration = {
					mqttsensors: [
					{
						sensorid: 1,
						interval: 10,
						topic:
						{
							brokerid: brokerId,
							topic: `homey/${this.__id}/button_temperature/value`,
							payload: '',
							eventtype: 18,
						},
					}],
				};

				const MQTTclient = this.homey.app.MQTTClients.get(brokerId);
				if (MQTTclient)
				{
					MQTTclient.subscribe(`homey/${this.__id}/button_temperature/value`, (err) =>
					{
						if (err)
						{
							this.homey.app.updateLog("setupMQTTClient.onConnect 'homey/sensorvalue' error: " * this.homey.app.varToString(err), 0);
						}
					});
				}

				if (deviceConfigurations)
				{
					// Check if the configuration is the same
					if (this.compareObjects(sectionConfiguration.mqttsensors, deviceConfigurations.mqttsensors))
					{
						delete deviceConfigurations.mqttsensors;
					}
					else
					{
						deviceConfigurations.mqttsensors = sectionConfiguration.mqttsensors;
					}
					return null;
				}

				this.homey.app.updateLog(`writeSensorConfig: ${this.homey.app.varToString(sectionConfiguration)}`);
				return await await this.homey.app.writeDeviceConfiguration(this.ip, sectionConfiguration);
			}
			catch (err)
			{
				this.homey.app.updateLog(`Error setting up pane temperature topic: ${err.message}`, 0);
				return err.message;
			}
		}

		return null;
	}

	async uploadCoreConfiguration(deviceConfigurations)
	{
		if (this.ip !== '')
		{
			if (this.firmware >= 1.09)
			{
				let upload = false;
				try
				{
					if (!deviceConfigurations)
					{
						// Read the current device configuration
						deviceConfigurations = await this.homey.app.readDeviceConfiguration(this.ip);
						if (deviceConfigurations === null)
						{
							return null;
						}
						upload = true;
					}

					const sectionConfiguration = {
						core: _.cloneDeep(deviceConfigurations.core),
					};

					const brokerId = this.homey.settings.get('defaultBroker');
					sectionConfiguration.core.topics = [
					{
						brokerid: brokerId,
						topic: `homey/${this.id}/brightness/large/value`,
						payload: '',
						eventtype: 24,
						retain: false,
					},
					{
						brokerid: brokerId,
						topic: `homey/${this.id}/brightness/mini/value`,
						payload: '',
						eventtype: 25,
						retain: false,
					},
					{
						brokerid: brokerId,
						topic: `homey/${this.id}/brightness/value`,
						payload: '',
						eventtype: 26,
					},
					{
						brokerid: brokerId,
						topic: `homey/${this.id}/brightness/leds/value`,
						payload: '',
						eventtype: 27,
						retain: false,
					},
					{
						brokerid: brokerId,
						topic: `homey/${this.id}/currentpage/value`,
						payload: '',
						eventtype: 6,
					},
					{
						brokerid: brokerId,
						topic: `homey/${this.id}/setpage/value`,
						payload: '',
						eventtype: 20,
						retain: false,
					}];

					const MQTTclient = this.homey.app.MQTTClients.get(brokerId);
					if (MQTTclient)
					{
						MQTTclient.subscribe(`homey/${this.id}/brightness/value`, (err) =>
						{
							if (err)
							{
								this.homey.app.updateLog(`setupMQTTClient.onConnect 'homey/${this.id}/brightness' error:  ${this.homey.app.varToString(err)}`, 0);
							}
						});
					}

					// Compare the current settings with the new settings
					if (this.compareObjects(sectionConfiguration.core, deviceConfigurations.core))
					{
						// They are the same so don't upload
						if (!upload)
						{
							// Remove the core section from the device configuration
							delete deviceConfigurations.core;
						}
					}
					else if (upload)
					{
						this.homey.app.updateLog(`writeBrightnessConfig: ${this.homey.app.varToString(sectionConfiguration)}`);
						return await await this.homey.app.writeDeviceConfiguration(this.ip, sectionConfiguration);
					}
					else
					{
						// Replace the core section of the device configuration with the new sectionConfiguration
						deviceConfigurations.core = sectionConfiguration.core;
					}
				}
				catch (err)
				{
					this.homey.app.updateLog(`Error setting up dim topics: ${err.message}`, 0);
					return err.message;
				}
			}
		}

		return null;
	}

	async uploadConfigurations()
	{
		try
		{
			const deviceConfigurations = await this.homey.app.readDeviceConfiguration(this.ip);
			if (deviceConfigurations === null)
			{
				this.setWarning('Error reading Button configuration');
				return;
			}
			
			this.setWarning(null);

			if (deviceConfigurations.info && deviceConfigurations.info.firmware)
			{
				this.firmware = parseFloat(deviceConfigurations.info.firmware);
				await this.setSettings({ firmware: deviceConfigurations.info.firmware });
				if (this.firmware < 1.12)
				{
					if (this.hasCapability('dim'))
					{
						await this.removeCapability('dim');
					}
				}
				else
				{
					if (!this.hasCapability('dim'))
					{
						await this.addCapability('dim');
					}
				}	
			}

			await this.updateStatusBar(deviceConfigurations);
			await this.uploadCoreConfiguration(deviceConfigurations);
			await this.uploadAllButtonConfigurations(deviceConfigurations);
			await this.uploadDisplayConfigurations(deviceConfigurations);
			await this.uploadBrokerConfigurations(deviceConfigurations);
			await this.uploadPanelTemperatureConfiguration(deviceConfigurations);
			delete deviceConfigurations.info;

			return await this.homey.app.writeDeviceConfiguration(this.ip, deviceConfigurations);
		}
		catch (err)
		{
			this.homey.app.updateLog(`Error reading device configuration: ${err.message}`, 0);
			return err.message;
		}

		return null;
	}

	async repair(ip)
	{
		const deviceConfiguration = await this.homey.app.readDeviceConfiguration(ip);
		this.homey.app.updateLog(`Device configuration: ${this.homey.app.varToString(deviceConfiguration)}`);

		if (!deviceConfiguration)
		{
			throw new Error('Failed to read device configuration');
		}

		const thisMAC = this.getSetting('mac');
		if (thisMAC !== deviceConfiguration.info.mac)
		{
			throw new Error('Device ID does not match');
		}

		let settings = {};

		settings.address = ip;
		this.ip = ip;

		for (let i = 0; i < deviceConfiguration.info.connectors.length; i++)
		{
			let connectIdx = deviceConfiguration.info.connectors.findIndex((id) => id.id === i);
			if (connectIdx >= 0)
			{
				settings[`connect${i}Type`]= deviceConfiguration.info.connectors[connectIdx].type;
			}
			else
			{
				settings[`connect${i}Type`] = 0;
			}
		}	

		this.setSettings(settings);
		await this.configureConnectors(settings);
	}
	
	async configureConnectors(settings)
	{
		for (let connector = 0; connector < 8; connector++)
		{
			const connectType = settings[`connect${connector}Type`];
			await this.configureConnector(connectType, connector);
		}
	}

	async configureConnector(connectType, connector)
	{
		try
		{
			// Remove old connectors configuration capabilities
			if (this.hasCapability(`configuration.connector${connector}`))
			{
				try
				{
					await this.removeCapability(`configuration.connector${connector}`);
				}
				catch (error)
				{
					this.error(error);
				}
			}

			if (connectType !== 1) // 0 = not fitted, 1 = button panel, 2 = display
			{
				if (this.hasCapability(`configuration_button.connector${connector}`))
				{
					await this.removeCapability(`configuration_button.connector${connector}`);
				}

				if (connectType !== 2)
				{
					await this.removeCapability(`left_button.connector${connector}`);
					await this.removeCapability(`right_button.connector${connector}`);
				}
				else
				{
					// Make sure a Disply configuration is assigned to this device
					if (!this.hasCapability('configuration_display'))
					{
						await this.addCapability('configuration_display');
					}

					const capabilityOption = {};
					capabilityOption.title = `${this.homey.__('display')} ${this.homey.__('connector')} ${connector + 1}`;
					this.setCapabilityOptions('configuration_display', capabilityOption);

					if (!this.hasCapability(`left_button.connector${connector}`))
					{
						await this.addCapability(`left_button.connector${connector}`);
						await this.addCapability(`right_button.connector${connector}`);
					}
					this.setCapabilityOptions(`configuration_button.connector${connector}`, capabilityOption);

					capabilityOption.title = `${this.homey.__('display')} ${this.homey.__('connector')} ${connector + 1} ${this.homey.__('left')}`;
					this.setCapabilityOptions(`left_button.connector${connector}`, capabilityOption);

					capabilityOption.title = `${this.homey.__('display')} ${this.homey.__('connector')} ${connector + 1} ${this.homey.__('right')}`;
					this.setCapabilityOptions(`right_button.connector${connector}`, capabilityOption);

					await this.registerCapabilityListener(`configuration_button.connector${connector}`, this.onCapabilityConfiguration.bind(this, connector));
					await this.registerCapabilityListener(`left_button.connector${connector}`, this.onCapabilityLeftButton.bind(this, connector));
					await this.registerCapabilityListener(`right_button.connector${connector}`, this.onCapabilityRightButton.bind(this, connector));
				}
			}
			else
			{
				if (!this.hasCapability(`configuration_button.connector${connector}`))
				{
					await this.addCapability(`configuration_button.connector${connector}`);
					await this.addCapability(`left_button.connector${connector}`);
					await this.addCapability(`right_button.connector${connector}`);
				}

				// set the tile for configuration_button.connector
				const capabilityOption = {};
				capabilityOption.title = `${this.homey.__('button')} ${this.homey.__('connector')} ${connector + 1}`;
				this.setCapabilityOptions(`configuration_button.connector${connector}`, capabilityOption);

				capabilityOption.title = `${this.homey.__('button')} ${this.homey.__('connector')} ${connector + 1} ${this.homey.__('left')}`;
				this.setCapabilityOptions(`left_button.connector${connector}`, capabilityOption);

				capabilityOption.title = `${this.homey.__('button')} ${this.homey.__('connector')} ${connector + 1} ${this.homey.__('right')}`;
				this.setCapabilityOptions(`right_button.connector${connector}`, capabilityOption);

				await this.registerCapabilityListener(`configuration_button.connector${connector}`, this.onCapabilityConfiguration.bind(this, connector));
				await this.registerCapabilityListener(`left_button.connector${connector}`, this.onCapabilityLeftButton.bind(this, connector));
				await this.registerCapabilityListener(`right_button.connector${connector}`, this.onCapabilityRightButton.bind(this, connector));

				// await this.syncCapability(connector);
			}
		}
		catch (err)
		{
			this.error(err);
		}
	}

	async onCapabilityDisplayConfiguration(value, opts)
	{
		this.homey.app.updateLog(`onCapabilityConfiguration ${value}, ${opts}`);
		try
		{
			await this.homey.app.uploadDisplayConfiguration(this.ip, value, this.id, this.firmware);
			this.setWarning(null);
		}
		catch (error)
		{
			this.setWarning(error.message);
			throw error;
		}
	}

	async onCapabilityConfiguration(connector, value, opts)
	{
		this.homey.app.updateLog(`onCapabilityConfiguration ${connector}, ${value}, ${opts}`);

		// await this.uploadOneButtonConfiguration(connector, value);

		const connectorType = this.getSetting(`connect${connector}Type`);
		if (connectorType === 1)
		{
			// Button bar
			const configNo = parseInt(value, 10);

			try
			{
				let mqttQue = [];

				if (configNo !== null)
				{
					if (this.firmware < 1.13)
					{
						// Upload the button configuration
						await this.uploadOneButtonConfiguration(connector, value);
					}

					mqttQue = await this.setupConnectorMQTTmessages(configNo, connector, connectorType);

					for (const mqttMsg of mqttQue)
					{
						this.homey.app.publishMQTTMessage(mqttMsg.brokerId, mqttMsg.message, mqttMsg.value, false, mqttMsg.retain).catch(this.error);
					}
				}
			}
			catch (error)
			{
				this.homey.app.updateLog(error, 0);
				this.setWarning(error.message);
				return
			}

			this.setWarning(null);
		}
	}

	async onCapabilityLeftButton(connector, value, opts)
	{
		this.homey.app.updateLog(`onCapabilityLeftButton ${connector}, ${value}, ${opts}`);

		// Setup parameters and call procesButtonClick
		const parameters = {};
		parameters.connector = connector;
		parameters.idx = connector * 2;
		parameters.side = 'left';
		parameters.value = value;

		await this.processButtonCapability(parameters);
	}

	async onCapabilityRightButton(connector, value, opts)
	{
		this.homey.app.updateLog(`onCapabilityLeftButton ${connector}, ${value}, ${opts}`);
		// Setup parameters and call procesButtonClick
		const parameters = {};
		parameters.connector = connector;
		parameters.idx = connector * 2 + 1;
		parameters.side = 'right';
		parameters.value = value;

		await this.processButtonCapability(parameters);
	}

	async processButtonCapability(parameters)
	{
		parameters.buttonCapability = `${parameters.side}_button.connector${parameters.connector}`;
		parameters.fromButton = true;
		const connectorType = this.getSetting(`connect${parameters.connector}Type`);
		parameters.configNo = connectorType === 2 ? null : this.getCapabilityValue(`configuration_button.connector${parameters.connector}`);
		await this.processClickMessage(parameters);
	}

	async onCapabilityInfo(value, opts)
	{
		this.setCapabilityValue('info', value).catch(this.error);
	}

	async checkCoreMQTTMessage(topicParts, value)
	{
		if (topicParts[1] === this.id)
		{
			if (topicParts[2] === 'currentpage')
			{
				this.page = parseInt(value, 10) + 1;
			}
		}
	}

	async processMQTTMessage(topic, MQTTMessage)
	{
		// eslint-disable-next-line eqeqeq
		if (!MQTTMessage || MQTTMessage.id != this.id)
		{
			// Message is not for this device
			return;
		}

		this.homey.app.updateLog(`Panel processing MQTT message: ${topic}`);

		if (MQTTMessage.idx === undefined)
		{
			// If the message has no button number then ignore it as we don't know which button it is for
			this.homey.app.updateLog('The MQTT payload has no connector number');
			return;
		}

		// gather the parameters from various places that we need to process the message
		const parameters = _.cloneDeep(MQTTMessage);
		parameters.connector = (MQTTMessage.idx / 2) | 0;
		parameters.side = (MQTTMessage.idx % 2) === 0 ? 'left' : 'right';
		parameters.connectorType = this.getSetting(`connect${parameters.connector}Type`);
		parameters.configNo = parameters.connectorType === 2 ? this.getCapabilityValue('configuration_display') : this.getCapabilityValue(`configuration_button.connector${parameters.connector}`);
		parameters.buttonCapability = `${parameters.side}_button.connector${parameters.connector}`;
		parameters.value = !this.getCapabilityValue(parameters.buttonCapability);

		// Now process the message
		if (topic === 'homey/click')
		{
			// The button was pressed
			this.processClickMessage(parameters);
		}
		else if (topic === 'homey/longpress')
		{
			// The button has been pressed for a long time
			this.processLongPressMessage(parameters);
		}
		else if (topic === 'homey/clickrelease')
		{
			// The button has been released
			this.processReleaseMessage(parameters);
		}
	}

	async processClickMessage(parameters)
	{
		// Check if a large display or if no configuration assigned to this connector
		let config = null;
		if ((parameters.configNo !== null) && (parameters.connectorType !== 2))
		{
			config = this.getConfigSide(parameters.configNo, parameters.side);
		}

		let { value } = parameters;
        let triggerChange = true;

		// Check if the button has another device and capability assigned to it
		if (config !== null)
		{
			if (config.deviceID === 'customMQTT')
			{
				// we don't handle customMQTT messages
				return;
			}

			if (config.deviceID === '_variable_')
			{
				// Variables are read only so just trigger the button flows so they can do the work
				const variable = await this.homey.app.getVariable(config.capabilityName);
				if (variable && variable.type === 'boolean')
				{
					value = !variable.value;

					// Cant't update the variable as the app has missing scopes so a Flow card is required to do this
					// variable.value = value;
					// this.homey.app.setVariable(config.capabilityName, variable);
				}
			}
			else if (config.deviceID !== 'none')
			{
				// Find the Homey device that is defined in the configuration
				const { device, capability } = await this.getDeviceAndCapability(config);
				if (device && capability)
				{
                    try
                    {
                        if (config.capabilityName === 'dim')
                        {
                            // For dim cpaabilities we need to adjust the value by the amount in the dimChange field and not change the button state
                            // Get the required change from the dimChange field and convert it from a percentage to a value
                            const change = parseInt(config.dimChange, 10) / 100;
                            if ((config.dimChange.indexOf('+') >= 0) || (config.dimChange.indexOf('-') >= 0))
                            {
                                // + or - was specified so add or subtract the change from the current value
                                value = capability.value + change;

                                // Make sure the value is between 0 and 1
                                if (value > 1)
                                {
                                    value = 1;
                                }
                                else if (value < 0)
                                {
                                    value = 0;
                                }
                            }
                            else
                            {
                                // No + or - was specified so just set the value to the change
                                value = change;
                            }

                            // Set the dim capability value of the target device
                            device.setCapabilityValue(config.capabilityName, value).catch(this.error);
                            value *= 100;

                            if (parameters.fromButton)
                            {
                                // Set the button state back to false immediately
                                setImmediate(() => this.setCapabilityValue(parameters.buttonCapability, false).catch(this.error));
                            }
                        }
                        else if (config.capabilityName === 'windowcoverings_state')
                        {
                            if (value)
                            {
                                await device.setCapabilityValue(config.capabilityName, 'up');
                            }
                            else
                            {
                                await device.setCapabilityValue(config.capabilityName, 'down');
                            }
                        }
                        else
                        {
                            // The don't trigger the button change Flow as the other device will do this
                            triggerChange = false;

                            value = parameters.fromButton ? parameters.value : !capability.value;
                            await device.setCapabilityValue(config.capabilityName, value);
                        }
                    }
                    catch (error)
                    {
                        this.homey.app.updateLog(`Device ${device.name}: Capability ${config.capabilityName}, ${error.message}`, 0);
                    }
				}
			}
        }

        if (typeof value === 'boolean')
        {
            if (!parameters.fromButton)
            {
                // Set the virtual button state
                this.setCapabilityValue(parameters.buttonCapability, value).catch(this.error);
            }

            if (triggerChange)
            {
                // and trigger the flow
                if (value)
                {
                    this.homey.app.triggerButtonOn(this, parameters.side === 'left', parameters.connector + 1);
                }
                else
                {
                    this.homey.app.triggerButtonOff(this, parameters.side === 'left', parameters.connector + 1);
                }
            }
        }

        this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'clicked', value);

        if (config)
        {
            this.homey.app.publishMQTTMessage(config.brokerId, `homey/${this.id}/${parameters.idx}/value`, value).catch(this.error);
            if ((value && config.onMessage !== '') || (!value && config.offMessage !== ''))
            {
                this.homey.app.publishMQTTMessage(config.brokerId, `homey/${this.id}/${parameters.idx}/label`, value ? config.onMessage : config.offMessage).catch(this.error);
            }

            if (config.onMessage === '' && config.offMessage !== '')
            {
                // There is only an Off message so don't latch the button state
                if (parameters.fromButton && value)
                {
                    // Set the button state back to false immediately
                    setImmediate(() => this.triggerCapabilityListener(parameters.buttonCapability, false).catch(this.error));
                }
            }
        }
        else if (value)
        {
            // Set the button state back to false immediately
            setImmediate(() => this.triggerCapabilityListener(parameters.buttonCapability, false).catch(this.error));
        }
	}

	async processLongPressMessage(parameters)
	{
		this.longPressOccurred.set(`${parameters.connector}_${parameters.side}`, true);
		this.homey.app.triggerButtonLongPress(this, parameters.side === 'left', parameters.connector + 1);

		if (parameters.configNo !== null)
		{
			const value = this.getCapabilityValue(`${parameters.side}_button.connector${parameters.connector}`);
			this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'long', value);

			const buttonPanelConfiguration = this.homey.app.buttonConfigurations[parameters.configNo];
			const capability = parameters.side === 'left' ? buttonPanelConfiguration.leftCapability : buttonPanelConfiguration.rightCapability;

			if (capability === 'dim')
			{
				// process another click message to change the dim value
				return this.processClickMessage(parameters);
			}
		}

		return null;
	}

	async processReleaseMessage(parameters)
	{
		this.homey.app.triggerButtonRelease(this, parameters.side === 'left', parameters.connector + 1);

		const config = this.getConfigSide(parameters.configNo, parameters.side);

		if (parameters.configNo !== null)
		{
			const value = this.getCapabilityValue(`${parameters.side}_button.connector${parameters.connector}`);
			this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'released', value);
		}

		// Check if a large display or if no configuration assigned to this connector
		if ((parameters.connectorType === 2) || (parameters.configNo === null))
		{
			this.homey.app.publishMQTTMessage('Default', `homey/${this.id}/${parameters.idx}/value`, false).catch(this.error);
		}
		else if (config)
		{
			if (this.longPressOccurred && this.longPressOccurred.get(`${parameters.connector}_${parameters.side}`) && (config.capabilityName === 'windowcoverings_state'))
			{
				// Send the pause command to the device if the LongPress was received
				if (config.deviceID === 'customMQTT')
				{
					// we don't handle customMQTT messages
					return;
				}

				// Find the Homey device that is defined in the configuration
				const { device, capability } = await this.getDeviceAndCapability(config);
				if (capability)
				{
					try
					{
						await device.setCapabilityValue(config.capabilityName, 'idle');
					}
					catch (error)
					{
						this.homey.app.updateLog(`Device ${device.name}: Capability ${config.capabilityName}, ${error.message}`);
					}
				}
			}
			else if (config.onMessage === '' && config.offMessage !== '')
			{
				// There is only an Off message so don't latch the button state
				this.triggerCapabilityListener(parameters.buttonCapability, false).catch(this.error);
			}
		}

		if (this.longPressOccurred)
		{
			// Record that the long press has finished
			this.longPressOccurred.set(`${parameters.connector}_${parameters.side}`, false);
		}
	}

	updateGatewayConfig(id, newIp)
	{
		const thisId = this.getSetting('mac');
		if (thisId === id)
		{
			this.setSettings({ address: newIp });
			this.ip = newIp;
		}
	}

	checkGatewayConfig()
	{
		// Check if the IP address has changed by looking up our mac address in the gateway list
		const id = this.getSetting('mac');
		if (id)
		{
			const newIp = this.homey.app.findGatewayIPById(id);
			if (newIp)
			{
				// TODO: update the IP address when mDNS is fixed
				// this.setSettings({ address: newIp });
				// this.ip = newIp;
			}
		}
	}

	async uploadAllButtonConfigurations(deviceConfigurations)
	{
		let writeConfig = false;
		let mqttQue = [];
		if (!deviceConfigurations)
		{
			// download the current configuration from the device
			deviceConfigurations = await this.homey.app.readDeviceConfiguration(this.ip);
			writeConfig = true;
		}

		if (deviceConfigurations)
		{
			this.setWarning(null);

			// Create a new section configuration for the button panel by adding the core and mqttbuttons sections of the deviceConfigurations to core and mqttbuttons of a new object
			const sectionConfiguration = {
				core: _.cloneDeep(deviceConfigurations.core),
				mqttbuttons: _.cloneDeep(deviceConfigurations.mqttbuttons),
			};

			if (sectionConfiguration.mqttbuttons.length < (deviceConfigurations.info.connectors.length * 2))
			{
				// Add the missing mqttbuttons
				for (let i = sectionConfiguration.mqttbuttons.length; i < (deviceConfigurations.info.connectors.length * 2); i++)
				{
					sectionConfiguration.mqttbuttons.push(
						{
							id: i,
							label: `Btn_${i}`,
							toplabel: 'Label',
							topics: [],
						},
					);
				}
			}

			for (let i = 0; i < (sectionConfiguration.mqttbuttons.length / 2); i++)
			{
				const connectorType = this.getSetting(`connect${i}Type`);
				let configNo = 0;
				if (this.hasCapability(`configuration_button.connector${i}`))
				{
					// apply the new configuration to this button bar section
					configNo = this.getCapabilityValue(`configuration_button.connector${i}`);
				}

				try
				{
					if (configNo !== null)
					{
						await this.homey.app.applyButtonConfiguration(this.id, connectorType, sectionConfiguration, i, configNo);
						if (connectorType === 1)
						{
							mqttQue = mqttQue.concat(await this.setupConnectorMQTTmessages(configNo, i));
						}
					}
				}
				catch (error)
				{
					this.homey.app.updateLog(error, 0);
				}
			}
			for (let i = sectionConfiguration.mqttbuttons.length - 1; i >= 0; i--)
			{
				if (this.compareObjects(sectionConfiguration.mqttbuttons[i], deviceConfigurations.mqttbuttons[i]))
				{
					// No changes have been made to the configuration so remove it from the sectionConfiguration so is doesn't write
					sectionConfiguration.mqttbuttons.splice(i, 1);
				}
			}

			if (writeConfig && (sectionConfiguration.mqttbuttons.length > 0))
			{
				// write the updated configuration back to the device
				let error = await this.homey.app.writeDeviceConfiguration(this.ip, sectionConfiguration);
				this.homey.app.updateLog(`Device configuration: ${this.homey.app.varToString(sectionConfiguration)}`);
				if (error)
				{
					this.homey.app.updateLog(this.homey.app.varToString(error), 0);
					return null;
				}
			}
			else if (sectionConfiguration.mqttbuttons.length === 0)
			{
				// No changes have been made to the configuration so remove it from the deviceConfigurations so is doesn't write
				delete deviceConfigurations.mqttbuttons;
			}
			else
			{
				// Replace the mqttbuttons section of the device configuration with the new sectionConfiguration
				deviceConfigurations.mqttbuttons = sectionConfiguration.mqttbuttons;
			}

			// Send the MQTT messages after a short delay to allow the device to connect to the broker
			setTimeout(async () =>
			{
				for (const mqttMsg of mqttQue)
				{
					this.homey.app.publishMQTTMessage(mqttMsg.brokerId, mqttMsg.message, mqttMsg.value, false).catch(this.error);
				}
			}, 1000);
		}
		else
		{
			this.setWarning('Error reading Button configuration');
		}

		return deviceConfigurations;
	}

	async uploadOneButtonConfiguration(connector, configNo)
	{
		// Create a new section configuration for the button panel by adding mqttbuttons sections of the deviceConfiguration to a new object
		// Create the framework for the left and right mqttbuttons section
		const sectionConfiguration = {
			mqttbuttons: [
				{},
				{},
			],
		};

		if (this.firmware <= 1.09)
		{
			// Old firmware would only apply buttons config if the core section was present
			sectionConfiguration.core = {};
		}

		const connectorType = this.getSetting(`connect${connector}Type`);
		// eslint-disable-next-line eqeqeq
		if (connectorType == 1)
		{
			try
			{
				await this.homey.app.applyButtonConfiguration(this.id, connectorType, sectionConfiguration, connector, configNo);
			}
			catch (error)
			{
				this.homey.app.updateLog(error, 0);
				return error.message;
			}

			// write the updated configuration back to the device
			return await this.homey.app.writeDeviceConfiguration(this.ip, sectionConfiguration);
		}

		return null;
	}

	async uploadDisplayConfigurations(deviceConfigurations)
	{
		// apply the new display configuration to this unit
		const configNo = this.getCapabilityValue('configuration_display');
		if (configNo)
		{
			try
			{
				if (deviceConfigurations)
				{
					const sectionConfiguration = {
						mqttdisplays: _.cloneDeep(deviceConfigurations.mqttdisplays),
					};

					await this.homey.app.applyDisplayConfiguration(sectionConfiguration, configNo, this.id, this.firmware);

					// Check if the display configuration has changed
					if (this.compareObjects(sectionConfiguration.mqttdisplays, deviceConfigurations.mqttdisplays))
					{
						// No changes have been made to the configuration so remove it from the sectionConfiguration so is doesn't write
						delete deviceConfigurations.mqttdisplays;
					}
					else
					{
						// Replace the display section of the device configuration with the new sectionConfiguration
						deviceConfigurations.mqttdisplays = sectionConfiguration.mqttdisplays;
					}
				}
				else
				{
					await this.homey.app.uploadDisplayConfiguration(this.ip, configNo, this.id, this.firmware);
				}
			}
			catch (error)
			{
				this.homey.app.updateLog(error, 0);
			}
		}
		else
		{
			let writeConfig = false;
			if (!deviceConfigurations)
			{
				deviceConfigurations = {};
				writeConfig = true;
			}

			deviceConfigurations.mqttdisplays = [
			{
				x: 0,
				y: 0,
				width: 100,
				fontsize: 0,
				align: 0,
				label: this.homey.__('hello1'),
				round: 0,
				topics: [],
			},
			{
				x: 0,
				y: 20,
				width: 100,
				fontsize: 0,
				align: 0,
				label: this.homey.__('hello2'),
				round: 0,
				topics: [],
			},
			{
				x: 0,
				y: 40,
				width: 100,
				fontsize: 0,
				align: 0,
				label: this.homey.__('hello3'),
				round: 0,
				topics: [],
			}];

			if (writeConfig)
			{
				// write the updated configuration back to the device
				return await this.homey.app.writeDeviceConfiguration(this.ip, deviceConfigurations);
			}
		}

		return null;
	}

	async uploadBrokerConfigurations(deviceConfigurations)
	{
		const sectionConfiguration = await this.homey.app.applyBrokerConfiguration(this.ip);

		if (deviceConfigurations)
		{
			// Check if the broker configuration has changed
			if (this.compareObjects(sectionConfiguration.mqttbrokers, deviceConfigurations.mqttbrokers))
			{
				// No changes have been made to the configuration so remove it from the sectionConfiguration so is doesn't write
				delete deviceConfigurations.mqttbrokers;
				return;
			}

			// copy the section configuration to the device configuration
			deviceConfigurations.mqttbrokers = sectionConfiguration.mqttbrokers;
			return;
		}

		// write the updated configuration back to the device
		return await this.homey.app.writeDeviceConfiguration(this.ip, sectionConfiguration);
	}

	checkStateChange(deviceId, capability, value)
	{
		// check the configuration to see if this capability is being monitored by one of the buttons
		if (this.hasCapability('configuration_button.connector0'))
		{
			this.checkStateChangeForConnector(0, deviceId, capability, value);
		}
		if (this.hasCapability('configuration_button.connector1'))
		{
			this.checkStateChangeForConnector(1, deviceId, capability, value);
		}
		if (this.hasCapability('configuration_button.connector2'))
		{
			this.checkStateChangeForConnector(2, deviceId, capability, value);
		}
		if (this.hasCapability('configuration_button.connector3'))
		{
			this.checkStateChangeForConnector(3, deviceId, capability, value);
		}
		if (this.hasCapability('configuration_button.connector4'))
		{
			this.checkStateChangeForConnector(4, deviceId, capability, value);
		}

		const configNo = this.getCapabilityValue('configuration_display');
		this.checkStateChangeForDisplay(configNo, deviceId, capability, value);
	}

	checkStateChangeForConnector(connector, deviceId, capability, value)
	{
		// Get the configuration for this connector
		const configNo = this.getCapabilityValue(`configuration_button.connector${connector}`);
		if (!configNo)
		{
			// Connector not configured
			return;
		}

		if (capability === 'dim')
		{
			// convert dim value to percentage
			value *= 100;
		}

		// Check the left and right devices and capabilities for this connector
		let side = 'left';
		for (let i = 0; i < 2; i++)
		{
			const config = this.getConfigSide(configNo, side);
			if ((config.deviceID === deviceId) && (config.capabilityName === capability))
			{
				const buttonIdx = connector * 2 + (side === 'left' ? 0 : 1);
				if (config.capabilityName !== 'dim')
				{
					if (config.capabilityName !== 'windowcoverings_state')
					{
						// and trigger the flow
						if (value)
						{
							this.homey.app.triggerButtonOn(this, true, connector + 1);
						}
						else
						{
							this.homey.app.triggerButtonOff(this, true, connector + 1);
						}

						// Set the device button state
						this.setCapabilityValue(`${side}_button.connector${connector}`, value).catch(this.error);
					}
					else
					{
						value = value === 'up';
					}
					if (config.onMessage !== '' || config.offMessage !== '')
					{
						this.homey.app.publishMQTTMessage(config.brokerId, `homey/${this.id}/${buttonIdx}/label`, value ? config.onMessage : config.offMessage).catch(this.error);
					}
				}

				// Publish to MQTT
				this.homey.app.publishMQTTMessage(config.brokerId, `homey/${this.id}/${buttonIdx}/value`, value).catch(this.error);
			}

			side = 'right';
		}
	}

	checkStateChangeForDisplay(configNo, deviceId, capability, value)
	{
		// Check if configNo is undefined
		if (configNo === undefined)
		{
			// Display not configured
			return;
		}

		// Check the display devices and capabilities for this panel
		const item = this.homey.app.displayConfigurations[configNo];
		if (item)
		{
			for (let itemNo = 0; itemNo < item.items.length; itemNo++)
			{
				const displayItem = item.items[itemNo];
				if ((displayItem.device === deviceId) && (displayItem.capability === capability))
				{
					// Check if the value is different from the last time we published it
					if (displayItem.lastValue !== value)
					{
						displayItem.lastValue = value;

						if (capability === 'dim')
						{
							// convert dim value to percentage
							value *= 100;
						}

						// Publish to MQTT
						const { brokerId } = displayItem;
						this.homey.app.publishMQTTMessage(brokerId, `homey/${deviceId}/${capability}/value`, value).catch(this.error);
					}
				}
			}
		}
	}

	async setupConnectorMQTTmessages(configNo, connector)
	{
		if (configNo === null)
		{
			return [];
		}

		let mqttQue = [];

		mqttQue = mqttQue.concat(await this.publishButtonMQTTmessages(configNo, connector * 2));
		mqttQue = mqttQue.concat(await this.publishButtonMQTTmessages(configNo, connector * 2 + 1));

		return mqttQue;
	}

	async publishButtonMQTTmessages(configNo, buttonIdx)
	{
		const mqttQueue = [];
		let value = false;

		const side = ((buttonIdx & 1) === 0) ? 'left' : 'right';
		const config = this.getConfigSide(configNo, side);

		// Setup value based on the configuration
		if (config.deviceID === '_variable_')
		{
			// Get the variable value
			const variable = await this.homey.app.getVariable(config.capabilityName);
			if (variable && variable.type === 'boolean')
			{
				value = variable.value;
			}

			this.setCapabilityValue(`${side}_button.connector${parseInt(buttonIdx / 2, 10)}`, value).catch(this.error);
		}
		else if (config.deviceID !== 'none')
		{
			// Get the value from the capability
			try
			{
				const { device, capability } = await this.getDeviceAndCapability(config);
				if (capability)
				{
					this.homey.app.registerDeviceCapabilityStateChange(device, config.capabilityName);
					value = capability.value;
					await this.setCapabilityValue(`${side}_button.connector${parseInt(buttonIdx / 2, 10)}`, value);
				}
			}
			catch (err)
			{
				this.homey.app.updateLog(`Error getting device id = ${config.deviceID}: ${err.message}`, 0);
			}
		}
		else
		{
			value = this.getCapabilityValue(`${side}_button.connector${parseInt(buttonIdx / 2, 10)}`);
		}

		// Send the value to the device after a short delay to allow the device to connect to the broker
		mqttQueue.push(
            {
                brokerId: config.brokerId,
                message: `homey/${this.id}/${buttonIdx}/value`,
                value,
            },
        );

		if (value)
		{
			if (this.firmware >= 1.2)
			{
				// Send the front and wall colours to the device after a short delay to allow the device to connect to the broker
				const frontLEDColor = parseInt(config.frontLEDColor.substring(1), 16);
				mqttQueue.push(
					{
						brokerId: config.brokerId,
						message: `homey/${this.id}/${buttonIdx}/front`,
						value: frontLEDColor,
						retain: false,
					},
				);

				const wallLEDColor = parseInt(config.wallLEDColor.substring(1), 16);
				mqttQueue.push(
					{
						brokerId: config.brokerId,
						message: `homey/${this.id}/${buttonIdx}/wall`,
						value: wallLEDColor,
						retain: false,
					},
				);
			}
		}

		// Send the value to the device after a short delay to allow the device to connect to the broker
		mqttQueue.push(
            {
                brokerId: config.brokerId,
                message: `homey/${this.id}/${buttonIdx}/toplabel`,
                value: config.topLabel,
            },
        );

		// Send the value to the device after a short delay to allow the device to connect to the broker
		mqttQueue.push(
            {
                brokerId: config.brokerId,
                message: `homey/${this.id}/${buttonIdx}/label`,
                value: value ? config.onMessage : config.offMessage,
            },
        );

        return mqttQueue;
	}

	getConfigSide(configNo, side)
	{
		let buttonPanelConfiguration = null;
		if (configNo !== null)
		{
			buttonPanelConfiguration = this.homey.app.buttonConfigurations[configNo];
		}

		if (!buttonPanelConfiguration)
		{
			return {
				deviceID: 'none',
				capabilityName: '',
				onMessage: '',
				offMessage: '',
				brokerId: 'Default',
				dimChange: 0,
                frontLEDColor: '#000000',
                wallLEDColor: '#000000',
			};
		}

		// Setup which of our buttons (left or right) this message is for
		return {
			deviceID: buttonPanelConfiguration[`${side}Device`],
			capabilityName: buttonPanelConfiguration[`${side}Capability`],
			topLabel: buttonPanelConfiguration[`${side}TopText`],
			onMessage: buttonPanelConfiguration[`${side}OnText`],
			offMessage: buttonPanelConfiguration[`${side}OffText`],
			brokerId: buttonPanelConfiguration[`${side}BrokerId`],
			dimChange: buttonPanelConfiguration[`${side}DimChange`],
            frontLEDColor: buttonPanelConfiguration[`${side}FrontLEDColor`],
            wallLEDColor: buttonPanelConfiguration[`${side}WallLEDColor`],
		};
	}

	async getDeviceAndCapability(config)
	{
		// Find the Homey device that is defined in the configuration
		const device = await this.homey.app.getHomeyDeviceById(config.deviceID);
		if (!device)
		{
			// Device not found
			this.homey.app.updateLog(`Device ${config.deviceID} not found`);
			return { homeyDeviceObject: device, capability: null };
		}

		// Find the capability that is defined in the configuration
		const capability = await this.homey.app.getHomeyCapabilityByName(device, config.capabilityName);
		if (!capability)
		{
			// Capability not found
			this.homey.app.updateLog(`Capability ${config.capabilityName} not found`);
		}

		return { device, capability };
	}

	compareObjects(obj1, obj2)
	{
		// Use Lodash to compare objects
		function customizer(value1, value2)
		{
			if (Array.isArray(value1) && Array.isArray(value2))
			{
				value1.sort((a, b) => {
					if (a.eventtype !== undefined)
					{
						// Array of topics
						return a.eventtype - b.eventtype;
					}

					if (a.brokerid !== undefined)
					{
						// Array of brokers
						return a.brokerid.localeCompare(b.brokerid);
					}

					if (a.page !== undefined)
					{
						// Array of display items, so sort by page then x and then y
						if (a.page === b.page)
						{
							if (a.x === b.x)
							{
								return a.y - b.y;
							}
							return a.x - b.x;
						}
						return a.page - b.page;
					}

					return 0;
				});

				value2.sort((a, b) => {
					if (a.eventtype)
					{
						return a.eventtype - b.eventtype;
					}

					if (a.brokerid)
					{
						return a.brokerid.localeCompare(b.brokerid);
					}

					if (a.page !== undefined)
					{
						// Array of display items, so sort by page then x and then y
						if (a.page === b.page)
						{
							if (a.x === b.x)
							{
								return a.y - b.y;
							}
							return a.x - b.x;
						}
						return a.page - b.page;
					}

					return 0;
				});
			}

			return undefined;
		}

		return _.isEqualWith(obj1, obj2, customizer);
	}

}

module.exports = PanelDevice;
