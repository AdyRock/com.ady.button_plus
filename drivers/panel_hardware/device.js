/* eslint-disable max-len */
/* eslint-disable camelcase */

'use strict';

const { Device } = require('homey');
const _ = require('lodash');
const { checkSEMVerGreaterOrEqual } = require('../../lib/HttpHelper');

class PanelDevice extends Device
{

	/**
	 * onInit is called when the device is initialized.
	 */
	async onInit()
	{
//		this.setUnavailable('Device is initializing');

		this.initFinished = false;
		this.longPressOccurred = new Map();
		this.buttonValues = new Map();
		this.barConfigured = [false, false, false, false, false, false, false, false];
		this.page = 1;

		const { id } = this.getData();
		this.buttonId = id;

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

		if (!this.hasCapability('dim'))
		{
			await this.addCapability('dim');
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

		let dim = this.getCapabilityValue('dim');
		if (dim < 0.1)
		{
			dim = 0.5;
			this.setCapabilityValue('dim', dim).catch(this.error);
		}

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

		if (!this.hasCapability('page'))
		{
			await this.addCapability('page');
			this.setCapabilityValue('page', '1').catch(this.error);
		}
		else
		{
			// make sure page (converted to an int) is a valid number as it seems it can be NaN
			const page = parseInt(this.getCapabilityValue('page'), 10);
			if (page < 1 || isNaN(page))
			{
				this.setCapabilityValue('page', '1').catch(this.error);
			}
		}

		if (!this.hasCapability('page.max'))
		{
			await this.addCapability('page.max');
			await this.setCapabilityOptions('page.max', { title: 'Pages' });
		}

		this.registerCapabilityListener('next_page_button', this.onCapabilityNextPage.bind(this));
		this.registerCapabilityListener('previous_page_button', this.onCapabilityPreviousPage.bind(this));

		this.disabled = settings.disabled;
		if (settings.disabled)
		{
			this.setUnavailable('Device is disabled');
			return;
		}

		// calculate an random number between 1 and 30 seconds
		const random = Math.floor(Math.random() * 10000);

		this.initHardwareTimer =  this.homey.setTimeout(() =>
		{
			this.initHardwareTimer = null;
			this.intiHardware().catch(this.error);
		}, 7000 + random);

		this.log('PanelDevice has been initialized');
	}

	async intiHardware()
	{
		if (this.initHardwareTimer)
		{
			// Already waiting for the hardware to initialise
			this.log('PanelDevice is already initializing hardware');
			return;
		}

		this.log('PanelDevice is initializing hardware');

		// Unsubscribe from the old MQTT client
		this.homey.app.UnsubscribeMQTTMessage(`buttonplus/${this.buttonId}/#`, (err) =>
		{
			if (err)
			{
				this.log('Failed to unsubscribe from old MQTT client:', err);
			}
		});

		if (await this.uploadConfigurations() !== null)
		{
			// failed to upload the configuration so try again in 30 seconds
			this.initHardwareTimer = this.homey.setTimeout(() =>
			{
				this.initHardwareTimer = null;
				if (!this.disbaled)
				{
					this.intiHardware().catch(this.error);
				}
			}, 30000);

			this.log('Hardware initialisation failed, retrying in 30 seconds');

			return;
		}

		await this.setupMQTTSubscriptions('Default');

		if (checkSEMVerGreaterOrEqual(this.firmwareVersion, '2.0.0'))
		{
			if (!this.hasCapability('previous_page_button'))
			{
				await this.addCapability('previous_page_button');
			}

			if (!this.hasCapability('next_page_button'))
			{
				await this.addCapability('next_page_button');
			}
		}
		else
		{
			if (this.hasCapability('previous_page_button'))
			{
				await this.removeCapability('previous_page_button');
			}

			if (this.hasCapability('next_page_button'))
			{
				await this.removeCapability('next_page_button');
			}
		}

		this.initFinished = true;
		this.setAvailable();

		this.log('PanelDevice hardware initialization completed');
	}

	async setupMQTTSubscriptions(brokerOrStringId)
	{
		let mqttClient = null;

		// If the brokerId is a string then get the MQTT client
		if (typeof brokerOrStringId === 'string')
		{
			mqttClient = this.homey.app.getMqttClient(brokerOrStringId);
		}
		else
		{
			mqttClient = brokerOrStringId;
		}

		if (!mqttClient)
		{
			this.homey.app.updateLog(`setupMQTTSubscriptions: MQTT client not found for brokerId: ${brokerOrStringId}`, 0);

			if (this.setupSubsTimer)
			{
				this.homey.clearTimeout(this.setupSubsTimer);
				this.setupSubsTimer = null;
			}

			// try again in 30 seconds
			this.setupSubsTimer = this.homey.setTimeout(() =>
			{
				this.setupSubsTimer = null;
				this.setupMQTTSubscriptions(brokerOrStringId).catch(this.error);
			}, 30000);

			return;
		}

		if (checkSEMVerGreaterOrEqual(this.firmwareVersion, '1.12.0'))
		{
			let value = this.getCapabilityValue('dim');
			this.homey.app.publishMQTTMessage(brokerOrStringId, `buttonplus/${this.buttonId}/brightness/set`, value * 255).catch(this.error);

			value = 1;
			if (this.page !== null)
			{
				value = `${this.page - 1}`;
			}
			this.homey.app.publishMQTTMessage(brokerOrStringId, `buttonplus/${this.buttonId}/page/set`, value);

			mqttClient.subscribe(`buttonplus/${this.buttonId}/page/state`, (err) =>
			{
				if (err)
				{
					this.homey.app.updateLog("setupMQTTClient.subscribe 'currentpage' error: " * this.homey.app.varToString(err), 0);
				}
			});

			mqttClient.subscribe(`buttonplus/${this.buttonId}/#`, (err) =>
			{
				if (err)
				{
					this.homey.app.updateLog("setupMQTTSubscriptions 'buttom/#' error: " * this.homey.app.varToString(err), 0);
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
		this.homey.app.publishMQTTMessage(brokerId, `buttonplus/${this.buttonId}/brightness/set`, value * 100).catch(this.error);
	}

	/**
	 * onAdded is called when the user adds the device, called just after pairing.
	 */
	async onAdded()
	{
		if (this.hasCapability('dim'))
		{
			this.setCapabilityValue('dim', 1).catch(this.error);
		}
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

		let refreshDateAndTime = false;
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
			refreshDateAndTime = true;
		}

		if (changedKeys.includes('dateFormat'))
		{
			this.dateFormat = newSettings.dateFormat;
			refreshDateAndTime = true;
		}

		if (changedKeys.includes('monthFormat'))
		{
			this.monthFormat = newSettings.monthFormat;
			refreshDateAndTime = true;
		}

		if (changedKeys.includes('yearFormat'))
		{
			this.yearFormat = newSettings.yearFormat;
			refreshDateAndTime = true;
		}

		if (changedKeys.includes('timeFormat'))
		{
			this.timeFormat = newSettings.timeFormat;
			refreshDateAndTime = true;
		}

		if (changedKeys.includes('statusbar'))
		{
			setImmediate(() =>
			{
				this.updateStatusBar(null).catch(this.error);
			});
		}

		if (refreshDateAndTime)
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

		if (changedKeys.includes('disabled'))
		{
			this.disbaled = newSettings.disabled;
			if (newSettings.disabled)
			{
				this.setUnavailable('Device is disabled');
				this.homey.clearTimeout(this.initHardwareTimer);
				this.initFinished = false;
			}
			else
			{
				this.initHardwareTimer = this.homey.setTimeout(() =>
				{
					this.initHardwareTimer = null;
					this.intiHardware().catch(this.error);
				}, 1000);
			}
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
		if (this.initHardwareTimer)
		{
			this.homey.clearTimeout(this.initHardwareTimer);
			this.initHardwareTimer = null;
		}
		await super.onDeleted();
		this.log('PanelDevice has been deleted');
	}

	async processMQTTBtnMessage(topic, MQTTMessage)
	{
		if (!this.initFinished)
		{
			return;
		}

		if (topic[1] === 'brightness')
		{
			const dim = parseFloat(MQTTMessage) / 100;
			this.triggerCapabilityListener('dim', dim, { mqtt: true }).catch((e) => this.homey.app.updateLog(this.homey.app.varToString(e), 0));
		}
	}

	getBrokerIdAndBtnIdx(side, connector, page)
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
					brokerId = item[page].leftBrokerId;
				}
				else
				{
					brokerId = item[page].rightBrokerId;
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

	async updateConnectorTopLabel(left_right, connector, page, label)
	{
		const { brokerId, buttonIdx } = this.getBrokerIdAndBtnIdx(left_right, connector, page);
		return this.homey.app.publishMQTTMessage(brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx + 1}-${page}/toplabel/set`, label).catch(this.error);
	}

	async updateConnectorLabel(left_right, connector, page, label)
	{
		if (!this.initFinished)
		{
			throw new Error('Device is not initialised');
		}

		const { brokerId, buttonIdx } = this.getBrokerIdAndBtnIdx(left_right, connector, page);
		return this.homey.app.publishMQTTMessage(brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx + 1}-${page}/label/set`, label).catch(this.error);
	}

	async updateConfigTopLabel(left_right, configNo, page, label)
	{
		if (!this.initFinished)
		{
			throw new Error('Device is not initialised');
		}

		// Find the button connector that has this configuration
		const connector = this.findConnectorUsingConfigNo(configNo);
		return this.updateConnectorTopLabel(left_right, connector, page, label);
	}

	async updateConfigLabel(left_right, configNo, page, label)
	{
		if (!this.initFinished)
		{
			throw new Error('Device is not initialised');
		}

// Find the button connector that has this configuration
		const connector = this.findConnectorUsingConfigNo(configNo);
		return this.updateConnectorLabel(left_right, connector, page, label);
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
				time = dateTime.toLocaleTimeString(this.langCode, { hourCycle: 'h23', hour: '2-digit', minute: '2-digit' });
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
			this.checkStateChange(this.__id, 'date', date).catch(this.error);

			this.setCapabilityValue('time', time).catch(this.error);
			this.checkStateChange(this.__id, 'time', time).catch(this.error);
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

				return await await this.homey.app.writeDeviceConfiguration(this.ip, sectionConfiguration, this.firmwareVersion);
			}
			catch (err)
			{
				this.homey.app.updateLog(`Error setting up pane temperature topic: ${err.message}`, 0);
				return err.message;
			}
		}

		return null;
	}

	async setDimLevel(large, mini, led)
	{
		if (this.ip !== '')
		{
			try
			{
				if (!checkSEMVerGreaterOrEqual(this.firmwareVersion, '1.09.0'))
				{
					const sectionConfiguration = {
						core:
						{
							brightnesslargedisplay: large,
							brightnessminidisplay: mini,
						},
					};

					this.homey.app.updateLog(`writeCore ${this.homey.app.varToString(sectionConfiguration)}`);
					return await await this.homey.app.writeDeviceConfiguration(this.ip, sectionConfiguration, this.firmwareVersion);
				}
				else
				{
					const brokerId = this.homey.settings.get('defaultBroker');
					if (large != undefined)
					{
						this.homey.app.publishMQTTMessage(brokerId, `buttonplus/${this.buttonId}/brightness/large`, large, false, false).catch(this.error);
					}
					if (mini != undefined)
					{
						this.homey.app.publishMQTTMessage(brokerId, `buttonplus/${this.buttonId}/brightness/mini`, mini, false, false).catch(this.error);
					}
					if (led != undefined)
					{
						this.homey.app.publishMQTTMessage(brokerId, `buttonplus/${this.buttonId}/brightness/led`, led, false, false).catch(this.error);
					}
				}

				this.setCapabilityValue('dim', (large || mini || led || 0) / 100).catch(this.error);
			}
			catch (err)
			{
				this.homey.app.updateLog(`Error setting up core brightness topic: ${err.message}`, 0);
				return err.message;
			}
		}

		return null;
	}

	async setConnectorLEDColour(left_right, connector, rgbString, front_wall, page)
	{
		if (!checkSEMVerGreaterOrEqual(this.firmwareVersion, '1.12.0'))
		{
			if (front_wall !== 'both')
			{
				throw new Error(`Firmware ${this.firmwareVersion} is too old to support this feature. Set the Front / Wall to both or update the firmware to 1.12 or later`);
			}
		}

		const brokerId = this.homey.settings.get('defaultBroker');
		let buttonNo = (connector * 2) + 1;
		if (left_right === 'right')
		{
			buttonNo++;
		}
		// Remove the # from rgbString and convert it to a number
		rgbString = rgbString.replace('#', '');
		const rgb = parseInt(rgbString, 16);

		if (page === undefined)
		{
			page = 0;
		}

		if ((front_wall === 'front') || (front_wall === 'both'))
		{
			this.homey.app.publishMQTTMessage(brokerId, `buttonplus/${this.buttonId}/button/${buttonNo}-${page}/led/front/rgb/set`, rgb, false, false).catch(this.error);
		}
		if ((front_wall === 'wall') || (front_wall === 'both'))
		{
			this.homey.app.publishMQTTMessage(brokerId, `buttonplus/${this.buttonId}/button/${buttonNo}-${page}/led/wall/rgb/set`, rgb, false, false).catch(this.error);
		}

//		return this.homey.app.publishMQTTMessage(brokerId, `buttonplus/${this.buttonId}/${buttonNo}-${page}led/rgb`, rgb, false, false).catch(this.error);
	}

	async setConfigLEDColour(left_right, configNo, rgb, front_wall, page, updateConfig, On_Off)
	{
		const config = this.homey.app.buttonConfigurations[configNo];
		const item = config[page];
		if (item)
		{
			if (!checkSEMVerGreaterOrEqual(this.firmwareVersion, '1.12.0'))
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
						On_Off ? item.leftFrontLEDOnColor = rgb : item.leftFrontLEDOffColor = rgb;
					}

					if ((front_wall === 'wall') || (front_wall === 'both'))
					{
						On_Off ? item.leftWallLEDOnColor = rgb : item.leftWallLEDOffColor = rgb;
					}
				}
				else
				{
					if ((front_wall === 'front') || (front_wall === 'both'))
					{
						On_Off ? item.rightFrontLEDOnColor = rgb : item.rightFrontLEDOffColor = rgb;
					}

					if ((front_wall === 'wall') || (front_wall === 'both'))
					{
						On_Off ? item.rightWallLEDOnColor = rgb : item.rightWallLEDOffColor = rgb;
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
							return this.uploadOneButtonConfiguration(connector, configNo, this.firmwareVersion);
						}

						return this.setConnectorLEDColour(left_right, connector, rgb, front_wall, page);
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
		if (!checkSEMVerGreaterOrEqual(this.firmwareVersion, '1.09.0'))
		{
			throw new Error('Firmware too old to support this feature');
		}

		const brokerId = this.homey.settings.get('defaultBroker');
		if (pageCommand === 'index')
		{
			if (!page)
			{
				if (this.page !== 1)
				{
					this.page = 1;
					this.homey.app.triggerPageChange(this, this.page);
				}
			}
			else
			{
				if (this.page !== page)
				{
					this.page = page;
					this.homey.app.triggerPageChange(this, this.page);
				}
			}
			pageCommand = `${this.page - 1}`;
		}

		this.homey.app.publishMQTTMessage(brokerId, `buttonplus/${this.buttonId}/page/set`, pageCommand).catch(this.error);
	}

	async uploadPanelTemperatureConfiguration(deviceConfigurations)
	{
		if (!checkSEMVerGreaterOrEqual(this.firmwareVersion, '2.0.0'))
		{
			// Only required for firmware versions less than 2.0.0
			if (this.ip !== '')
			{
				try
				{
					// Add the temperature event entry
					const brokerId = this.homey.settings.get('defaultBroker');
					const sectionConfiguration = {
						sensors: [
						{
							sensorid: 1,
							interval: 30,
							topic:
							{
								brokerid: brokerId,
								topic: `buttonplus/${this.buttonId}/sensor/1`,
								payload: '',
								eventtype: 18,
							},
						}],
					};

					if (deviceConfigurations)
					{
						// Check if the configuration is the same
						if (this.compareObjects(sectionConfiguration.sensors, deviceConfigurations.sensors))
						{
							delete deviceConfigurations.sensors;
						}
						else
						{
							deviceConfigurations.sensors = sectionConfiguration.sensors;
						}
						return null;
					}

					this.homey.app.updateLog(`writeSensorConfig: ${this.homey.app.varToString(sectionConfiguration)}`);
					return await await this.homey.app.writeDeviceConfiguration(this.ip, sectionConfiguration, this.firmwareVersion);
				}
				catch (err)
				{
					this.homey.app.updateLog(`Error setting up pane temperature topic: ${err.message}`, 0);
					return err.message;
				}
			}
		}
		return null;
	}

	async uploadCoreConfiguration(deviceConfigurations)
	{
		if (this.ip !== '')
		{
			if (checkSEMVerGreaterOrEqual(this.firmwareVersion, '1.09.0'))
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
						topic: `buttonplus/${this.buttonId}/brightness/large`,
						payload: '',
						eventtype: 24,
					},
					{
						brokerid: brokerId,
						topic: `buttonplus/${this.buttonId}/brightness/mini`,
						payload: '',
						eventtype: 25,
					},
					{
						brokerid: brokerId,
						topic: `buttonplus/${this.buttonId}/brightness/led`,
						payload: '',
						eventtype: 27,
					}];

					if (!checkSEMVerGreaterOrEqual(this.firmwareVersion, '2.0.0'))
					{
						sectionConfiguration.core.topics.push(
						{
							brokerid: brokerId,
							topic: `buttonplus/${this.buttonId}/page/state`,
							payload: '',
							eventtype: 6,
						});

						sectionConfiguration.core.topics.push(
						{
							brokerid: brokerId,
							topic: `buttonplus/${this.buttonId}/page/set`,
							payload: '',
							eventtype: 20,
							retain: false,
						});
					}

					if (checkSEMVerGreaterOrEqual(this.firmwareVersion, '1.12.0'))
					{
						if (!checkSEMVerGreaterOrEqual(this.firmwareVersion, '2.0.0'))
						{
							// Add the brightness topics to the configuration
							sectionConfiguration.core.topics.push(
							{
								brokerid: brokerId,
								topic: `buttonplus/${this.buttonId}/brightness/set`,
								payload: '',
								eventtype: 26,
							});
						}

						const MQTTclient = this.homey.app.MQTTClients.get(brokerId);
						if (MQTTclient)
						{
							MQTTclient.subscribe(`buttonplus/${this.buttonId}/brightness/set`, (err) =>
							{
								if (err)
								{
									this.homey.app.updateLog(`setupMQTTClient.onConnect 'buttonplus/${this.buttonId}/brightness' error:  ${this.homey.app.varToString(err)}`, 0);
								}
							});
						}
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
						return await await this.homey.app.writeDeviceConfiguration(this.ip, sectionConfiguration, this.firmwareVersion);
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
			let deviceConfigurations = await this.homey.app.readDeviceConfiguration(this.ip);
			if (deviceConfigurations === null)
			{
				this.setWarning('Failed to read device configuration');
				return 'Failed to read device configuration';
			}

			// If a string was returned, it is an error message
			if (typeof deviceConfigurations === 'string')
			{
				this.homey.app.updateLog('Error reading device configuration: ' + deviceConfigurations, 0);
				// Start with a fresh configuration
				deviceConfigurations = {};
			}

			this.unsetWarning();

			if (deviceConfigurations.info && deviceConfigurations.info.firmware)
			{
				this.firmwareVersion = deviceConfigurations.info.firmware;
				await this.setSettings({ firmware: deviceConfigurations.info.firmware });
				if (!checkSEMVerGreaterOrEqual(this.firmwareVersion, '1.12.0'))
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

			let mqttQue = [];
			this.numPages = 0;
			await this.updateStatusBar(deviceConfigurations);
			await this.uploadCoreConfiguration(deviceConfigurations);
			({ mqttQue } = await this.uploadAllButtonConfigurations(deviceConfigurations))
			await this.uploadDisplayConfigurations(deviceConfigurations);
			await this.uploadBrokerConfigurations(deviceConfigurations);
			await this.uploadPanelTemperatureConfiguration(deviceConfigurations);
			delete deviceConfigurations.info;

			if (this.numPages > 1)
			{
				const brokerId = this.homey.settings.get('defaultBroker');
				mqttQue.push(
					{
						brokerId: brokerId,
						message: `buttonplus/${this.buttonId}/page/set`,
						value: 1,
					},
				);
			}


			let tries = 3;
			let error = null;
			let delay = 100;
			if (checkSEMVerGreaterOrEqual(this.firmwareVersion, '2.0.0'))
			{
				delay = 10000;
			}

			while (tries > 0)
			{
				error = await this.homey.app.writeDeviceConfiguration(this.ip, deviceConfigurations, this.firmwareVersion)
				if (error == null)
				{
					// Send the MQTT messages after a short delay to allow the device to reset and connect to the broker
					setTimeout(async () =>
					{
						for (const mqttMsg of mqttQue)
						{
							this.homey.app.publishMQTTMessage(mqttMsg.brokerId, mqttMsg.message, mqttMsg.value, false).catch(this.error);
						}

						mqttQue = null;
					}, delay);

					await this.setupMQTTSubscriptions('Default');

					break;
				}

				this.homey.app.updateLog(`Retrying write configuration to ${this.ip}`, 0);
				tries--;
			};

			if (error)
			{
				this.setWarning(error);
			}
		}
		catch (err)
		{
			this.homey.app.updateLog(`Error reading device configuration: ${err.message}`, 0);
			this.setWarning(err.message);
			return err.message;
		}

		if (this.hasCapability('page.max'))
		{
			this.setCapabilityValue('page.max', `${this.numPages}`).catch(this.error);
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

				const configNo = this.getCapabilityValue(`configuration_button.connector${connector}`);
				this.barConfigured[connector] = configNo !== null;

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
			await this.homey.app.uploadDisplayConfiguration(this.ip, value, this.firmwareVersion, this);
			this.unsetWarning();
		}
		catch (error)
		{
			this.setWarning(error.message);
			throw error;
		}
	}

	async onCapabilityConfiguration(connector, value, opts)
	{
		if (!this.initFinished)
		{
			throw new Error('Device is not initialised');
		}

		this.homey.app.updateLog(`onCapabilityConfiguration ${connector}, ${value}, ${opts}`);

		const connectorType = this.getSetting(`connect${connector}Type`);
		if (connectorType === 1)
		{
			// Button bar
			try
			{
				if (!this.firmwareVersion)
				{
					// Fetch the button + configuration from the device
					return await this.uploadConfigurations();
				}

				let mqttQue = [];
				let delay = 100;

				if (checkSEMVerGreaterOrEqual(this.firmwareVersion, '2.0.0'))
				{
					({ mqttQue, delay } = await this.uploadAllButtonConfigurations(null, connector, value))
					mqttQue = mqttQue.concat(mqttQue);
				}
				else
				{
					const configNo = parseInt(value, 10);

					if (configNo !== null)
					{
						// Get the button page configuration
						let buttonPanelConfiguration = this.homey.app.buttonConfigurations[configNo];
						if (!buttonPanelConfiguration)
						{
							throw new Error('Invalid configuration number');
						}

						if ((!checkSEMVerGreaterOrEqual(this.firmwareVersion, '1.12.0')) || (this.barConfigured[connector] === false))
						{
							// Upload the button configuration
							await this.uploadOneButtonConfiguration(connector, value, this.firmwareVersion);
							this.barConfigured[connector] = true;
						}

						// for each page in the configuration
						for (let page = 0; page < buttonPanelConfiguration.length; page++)
						{
							mqttQue = await this.setupConnectorMQTTmessages(buttonPanelConfiguration, page, connector, connectorType);
						}
					}
				}

				// Send the MQTT messages after a short delay to allow the device to reset and connect to the broker
				setTimeout(async () =>
				{
					for (const mqttMsg of mqttQue)
					{
						this.homey.app.publishMQTTMessage(mqttMsg.brokerId, mqttMsg.message, mqttMsg.value, false).catch(this.error);
					}

					mqttQue = null;
				}, delay);
			}
			catch (error)
			{
				this.homey.app.updateLog(error, 0);
				this.setWarning(error.message);
				return
			}
		}

		this.unsetWarning();
	}

	async onCapabilityNextPage(value, opts)
	{
		this.homey.app.updateLog(`onCapabilityNextPage ${value}, ${opts}`);
		try
		{
			await this.setSetDisplayPage('next');
		}
		catch (error)
		{
			throw error;
		}
	}

	async onCapabilityPreviousPage(value, opts)
	{
		this.homey.app.updateLog(`onCapabilityPreviousPage ${value}, ${opts}`);
		try
		{
			await this.setSetDisplayPage('previous');
		}
		catch (error)
		{
			throw error;
		}
	}

	async onCapabilityLeftButton(connector, value, opts)
	{
		this.homey.app.updateLog(`onCapabilityLeftButton ${connector}, ${value}, ${opts}`);
		this.buttonValues.set(`left_${connector}_${this.page}`, value);

		// Setup parameters and call procesButtonClick
		const parameters = {};
		parameters.connector = connector;
		parameters.idx = connector * 2;
		parameters.side = 'left';
		parameters.value = value;
		parameters.page = this.page;

		await this.processButtonCapability(parameters);
	}

	async onCapabilityRightButton(connector, value, opts)
	{
		this.homey.app.updateLog(`onCapabilityLeftButton ${connector}, ${value}, ${opts}`);
		this.buttonValues.set(`right_${connector}_${this.page}`, value);

		// Setup parameters and call procesButtonClick
		const parameters = {};
		parameters.connector = connector;
		parameters.idx = connector * 2 + 1;
		parameters.side = 'right';
		parameters.value = value;
		parameters.page = this.page;

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
		if (topicParts[1] === this.buttonId)
		{
			if ((topicParts[2] === 'page') && (topicParts[3] === 'state'))
			{
				const page = parseInt(value, 10);
				// Make sure the page is a number
				if (!isNaN(page) && page !== this.page)
				{
					this.page = page;
					if (this.hasCapability('page'))
					{
						let page = this.page;
						if (page === 0)
						{
							page = 1;
						}
						this.setCapabilityValue('page', `${page}`).catch(this.error);
						this.homey.app.triggerPageChange(this, this.page);
					}
				}
			}
			else if ((topicParts[2] === 'sensor') && (topicParts[3] === '1'))
			{
				// If the value is not a number then ignore it
				if (!isNaN(value))
				{
					// Update the temperature capability
					// Add the temperature calibration offset to the value
					const temperature = value + this.temperatureCalibration;
					this.setCapabilityValue('measure_temperature', temperature).catch(this.error);

					const configNo = this.getCapabilityValue('configuration_display');
					this.checkStateChangeForDisplay(configNo, this.__id, 'measure_temperature', temperature);
				}
			}
		}
	}

	async processMQTTMessage(MQTTMessage)
	{
		if (!this.initFinished)
		{
			return;
		}

		// eslint-disable-next-line eqeqeq
		if (!MQTTMessage || MQTTMessage.id != this.buttonId)
		{
			// Message is not for this device
			return;
		}

		if (MQTTMessage.idx === undefined)
		{
			this.homey.app.updateLog(`Panel processing MQTT message: ${topic}`);

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
		parameters.value = !this.buttonValues.get(`${parameters.side}_${parameters.connector}_${parameters.page}`);

		// Now process the message
		if (MQTTMessage.event === 'click')
		{
			this.homey.app.updateLog(`Panel processing MQTT message: ${MQTTMessage.event}`);

			// The button was pressed
			this.processClickMessage(parameters);
		}
		else if (MQTTMessage.event === 'longpress')
		{
			// The button has been pressed for a long time
			this.processLongPressMessage(parameters);
		}
		else if (MQTTMessage.event === 'release')
		{
			this.homey.app.updateLog(`Panel processing MQTT message: ${MQTTMessage.event}`);

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
			if (!parameters.page)
			{
				parameters.page = 0;
			}
			config = this.getConfigPageSide(null, parameters.page, parameters.side, parameters.configNo);
			parameters.page = parseInt(config.page);
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

							if (parameters.fromButton && ((parameters.page === 0) || (this.page === parameters.page)))
							{
								// Set the button state back to false immediately
								setImmediate(() => this.setCapabilityValue(parameters.buttonCapability, false).catch(this.error));
							}
                        }
                        else if (config.capabilityName === 'windowcoverings_state')
                        {
                            // if (capability.value !== null)
                            // {
							// 	await device.setCapabilityValue(config.capabilityName, 'idle');

							// 	// don't make any further changes to the button state
							// 	return;
                            // }
                            if (value)
                            {
								// Set the new state to up
                                await device.setCapabilityValue(config.capabilityName, 'up');
                            }
							else
							{
								// Set the new state to down
                                await device.setCapabilityValue(config.capabilityName, 'down');
							}
                        }
                        else
                        {
                            value = parameters.fromButton ? parameters.value : !capability.value;
                            await device.setCapabilityValue(config.capabilityName, value);

							// Don't trigger the button change Flow as the other device will do this
							triggerChange = false;
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
			if (!parameters.fromButton && ((parameters.page === 0) || (this.page === parameters.page)))
            {
                // Set the virtual button state
                this.setCapabilityValue(parameters.buttonCapability, value).catch(this.error);
            }

			this.buttonValues.set(`${parameters.side}_${parameters.connector}_${parameters.page}`, value);

            if (triggerChange)
            {
                // and trigger the flow
                if (value)
                {
					this.homey.app.triggerButtonOn(this, parameters.side === 'left', parameters.connector + 1, parameters.page);
                }
                else
                {
					this.homey.app.triggerButtonOff(this, parameters.side === 'left', parameters.connector + 1, parameters.page);
                }
            }
        }

		this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'clicked', value, parameters.page);

        if (config)
        {
			let buttonIdx = parameters.idx;
			buttonIdx++;

			this.setLEDOnOff(config, null, buttonIdx, parameters.page, value);
			// this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/${parameters.idx}`, value).catch(this.error);
            if ((value && config.onMessage !== '') || (!value && config.offMessage !== ''))
            {
				this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${parameters.page}/label/set`, value ? config.onMessage : config.offMessage).catch(this.error);
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
        // else if (value)
        // {
        //     // Set the button state back to false immediately
        //     setImmediate(() => this.triggerCapabilityListener(parameters.buttonCapability, false).catch(this.error));
        // }
	}

	async processLongPressMessage(parameters)
	{
		if (this.lastLongPressTime && ((Date.now() - this.lastLongPressTime) < 500))
		{
			// ignore long press messages that are too close together
			return;
		}

		this.lastLongPressTime = Date.now();
		let repeatCount = this.longPressOccurred.get(`${parameters.connector}_${parameters.side}_${parameters.page}`);
		if (repeatCount === undefined)
		{
			repeatCount = 0;
		}

		let buttonPanelConfiguration = null;
		if (parameters.configNo !== null)
		{
			buttonPanelConfiguration = this.homey.app.buttonConfigurations[parameters.configNo];
			if (buttonPanelConfiguration[`${parameters.side}DisableLongRepeat`] && (repeatCount > 0))
			{
				return null;
			}
		}

		if (repeatCount === 0)
		{
			this.homey.app.updateLog(`Panel processing MQTT message: ${parameters}`);
		}

		this.longPressOccurred.set(`${parameters.connector}_${parameters.side}_${parameters.page}`, repeatCount + 1);
		this.homey.app.triggerButtonLongPress(this, parameters.side === 'left', parameters.connector + 1, repeatCount, parameters.page);

		if (buttonPanelConfiguration !== null)
		{
			const value = this.buttonValues.get(`${parameters.side}_${parameters.connector}_${parameters.page}`);

			if (repeatCount === 0)
			{
				this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'long', value, parameters.page);
			}

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
		let buttonIdx = parameters.idx;
		buttonIdx++;

		this.homey.app.triggerButtonRelease(this, parameters.side === 'left', parameters.connector + 1, parameters.page);

		const config = this.getConfigPageSide(null, parameters.page, parameters.side, parameters.configNo);

		if (parameters.configNo !== null)
		{
			const value = this.buttonValues.get(`${parameters.side}_${parameters.connector}_${parameters.page}`) || false;
			this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'released', value, parameters.page);
		}

		// Check if a large display or if no configuration assigned to this connector
		if ((parameters.connectorType === 2) || (parameters.configNo === null))
		{
			this.setLEDOnOff(config, null, buttonIdx, parameters.page, false);
			if (parameters.page === this.page)
			{
				this.setCapabilityValue(`${parameters.side}_button.connector${parameters.connector}`, false);
			}

			this.buttonValues.set(`${parameters.side}_${parameters.connector}_${parameters.page}`, false);
		}
		else if (config)
		{
			if (this.longPressOccurred && (this.longPressOccurred.get(`${parameters.connector}_${parameters.side}_${parameters.page}`) > 0) && (config.capabilityName === 'windowcoverings_state'))
			{
				// Send the pause command to the device if the LongPress was received
				if (config.deviceID === 'customMQTT')
				{
					// we don't handle customMQTT messages
					return;
				}

				// Find the Homey device that is defined in the configuration
				const { device, capability } = await this.getDeviceAndCapability(config);
				if (capability && ((parameters.page === 0) || (this.page === parameters.page)))
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
				this.setLEDOnOff(config, null, buttonIdx, parameters.page, false);
				if (parameters.page === this.page)
				{
					this.setCapabilityValue(`${parameters.side}_button.connector${parameters.connector}`, false);
				}

				this.buttonValues.set(`${parameters.side}_${parameters.connector}_${parameters.page}`, false);
			}
		}

		if (this.longPressOccurred)
		{
			// Record that the long press has finished
			this.longPressOccurred.set(`${parameters.connector}_${parameters.side}_${parameters.page}`, 0);
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
			if (newIp && (newIp !== this.ip))
			{
				this.homey.app.updateLog(`Device ${this.getName()}: IP address changed from ${this.ip} to ${newIp}`);
				// TODO: update the IP address when mDNS is fixed
				this.setSettings({ address: newIp });
				this.ip = newIp;
			}
		}
	}

	// Function to filter out only the array items
	filterButtonPanelConfiguration(config)
	{
		return config.map(item =>
		{
			return Object.keys(item).reduce((acc, key) =>
			{
				if (Array.isArray(item[key]))
				{
					acc[key] = item[key];
				}
				else
				{
					acc[key] = item[key];
				}
				return acc;
			}, {});
		});
	}

	async uploadAllButtonConfigurations(deviceConfigurations, Connector, ConfigNo)
	{
		let writeConfig = false;
		let mqttQue = [];
		let delay = 100;
		if (!deviceConfigurations)
		{
			// download the current configuration from the device
			deviceConfigurations = await this.homey.app.readDeviceConfiguration(this.ip);
			writeConfig = true;
			this.firmwareVersion = deviceConfigurations.info.firmware;
		}

		if (deviceConfigurations)
		{
			this.unsetWarning();

			// Create a new section configuration for the button panel by adding the core and buttons sections of the deviceConfigurations to core and buttons of a new object
			const sectionConfiguration = {
				core: deviceConfigurations.core ? _.cloneDeep(deviceConfigurations.core) : {},
				buttons: [],
			};

			for (let i = 0; i < (deviceConfigurations.info.connectors.length); i++)
			{
				const connectorType = this.getSetting(`connect${i}Type`);

				let configNo = null;

				if (i === Connector)
				{
					configNo = ConfigNo;
				}
				else if (this.hasCapability(`configuration_button.connector${i}`))
				{
					// apply the new configuration to this button bar section
					configNo = this.getCapabilityValue(`configuration_button.connector${i}`);
				}

				try
				{
					let numPages = await this.homey.app.applyButtonConfiguration(this.buttonId, connectorType, sectionConfiguration, i, configNo, this.firmwareVersion);
					if (numPages > this.numPages)
					{
						this.numPages = numPages;
					}

					let buttonPanelConfiguration = configNo ? this.homey.app.buttonConfigurations[configNo] : null;
					let pages = buttonPanelConfiguration ? buttonPanelConfiguration.length : 1;
					for (let page = 0; page < pages; page++)
					{
						mqttQue = mqttQue.concat(await this.setupConnectorMQTTmessages(buttonPanelConfiguration, page, i));
					}
				}
				catch (error)
				{
					this.homey.app.updateLog(error, 0);
				}
			}

			if (writeConfig && deviceConfigurations.buttons)
			{
				for (let i = sectionConfiguration.buttons.length - 1; i >= 0; i--)
				{
					if (this.compareObjects(sectionConfiguration.buttons[i], deviceConfigurations.buttons[i]))
					{
						// No changes have been made to the configuration so remove it from the sectionConfiguration so is doesn't write
						sectionConfiguration.buttons.splice(i, 1);
					}
				}
			}

			if (writeConfig && (sectionConfiguration.buttons.length > 0))
			{
				// write the updated configuration back to the device
				let error = await this.homey.app.writeDeviceConfiguration(this.ip, sectionConfiguration, this.firmwareVersion);
				this.homey.app.updateLog(`Device configuration: ${this.homey.app.varToString(sectionConfiguration)}`);
				if (error)
				{
					this.homey.app.updateLog(this.homey.app.varToString(error), 0);
					return null;
				}

				if (checkSEMVerGreaterOrEqual(this.firmwareVersion, '2.0.0'))
				{
					delay = 10000;
				}
			}
			else if (sectionConfiguration.buttons.length === 0)
			{
				// No changes have been made to the configuration so remove it from the deviceConfigurations so is doesn't write
				delete deviceConfigurations.buttons;
			}
			else
			{
				// Replace the buttons section of the device configuration with the new sectionConfiguration
				deviceConfigurations.buttons = sectionConfiguration.buttons;
			}
		}
		else
		{
			this.setWarning('Error reading Button configuration');
		}

		return {mqttQue, delay};
	}

	async uploadOneButtonConfiguration(connector, configNo, firmwareVersion)
	{
		// Create a new section configuration for the button panel by adding buttons sections of the deviceConfiguration to a new object
		// Create the framework for the left and right buttons section
		const sectionConfiguration = {
			buttons: [
				{},
				{},
			],
		};

		if (!checkSEMVerGreaterOrEqual(this.firmwareVersion, '1.09.0'))
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
				await this.homey.app.applyButtonConfiguration(this.buttonId, connectorType, sectionConfiguration, connector, configNo, firmwareVersion);
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
						displayitems: _.cloneDeep(deviceConfigurations.displayitems),
					};

					let numPages = await this.homey.app.applyDisplayConfiguration(sectionConfiguration, configNo, this.firmwareVersion, this);
					if (numPages > this.numPages)
					{
						this.numPages = numPages;
					}

					// Check if the display configuration has changed
					if (this.compareObjects(sectionConfiguration.displayitems, deviceConfigurations.displayitems))
					{
						// No changes have been made to the configuration so remove it from the sectionConfiguration so is doesn't write
						delete deviceConfigurations.displayitems;
					}
					else
					{
						// Replace the display section of the device configuration with the new sectionConfiguration
						deviceConfigurations.displayitems = sectionConfiguration.displayitems;
					}
				}
				else
				{
					await this.homey.app.uploadDisplayConfiguration(this.ip, configNo, this.firmwareVersion);
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

			deviceConfigurations.displayitems = [
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
				return await this.homey.app.writeDeviceConfiguration(this.ip, deviceConfigurations, this.firmwareVersion);
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
			if (this.compareObjects(sectionConfiguration.brokers, deviceConfigurations.brokers))
			{
				// No changes have been made to the configuration so remove it from the sectionConfiguration so is doesn't write
				delete deviceConfigurations.brokers;
				return;
			}

			// copy the section configuration to the device configuration
			deviceConfigurations.brokers = sectionConfiguration.brokers;
			return;
		}

		// write the updated configuration back to the device
		return await this.homey.app.writeDeviceConfiguration(this.ip, sectionConfiguration, this.firmwareVersion);
	}

	async checkStateChange(deviceId, capability, value)
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

		const config = this.homey.app.buttonConfigurations[configNo];
		const numPages = config.length;

		for (let page = 0; page < numPages; page++)
		{
			// Check the left and right devices and capabilities for this page
			let side = 'left';
			for (let i = 0; i < 2; i++)
			{
				const config = this.getConfigPageSide(null, page, side, configNo);
				if ((config.deviceID === deviceId) && (config.capabilityName === capability))
				{
					let buttonIdx = connector * 2 + (side === 'left' ? 0 : 1);
					buttonIdx += 1;

					if (config.capabilityName !== 'dim')
					{
						if (config.capabilityName !== 'windowcoverings_state')
						{
							// and trigger the flow
							if (value)
							{
								this.homey.app.triggerButtonOn(this, true, connector + 1, page);
							}
							else
							{
								this.homey.app.triggerButtonOff(this, true, connector + 1, page);
							}

							if ((page === 0) || (this.page === page))
							{
								// Set the device button state
								this.setCapabilityValue(`${side}_button.connector${connector}`, value).catch(this.error);
							}

							this.buttonValues.set(`${side}_${connector}_${page}`, value);
						}
						else
						{
							value = value === 'up';
						}
						if (config.onMessage !== '' || config.offMessage !== '')
						{
							this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/label/set`, value ? config.onMessage : config.offMessage).catch(this.error);
						}
					}

					// Add the front and wall colours or the on/off state to the message queue based on the on/off value and firmware version
					this.setLEDOnOff(config, null, buttonIdx, page, value );
				}

				side = 'right';
			}
		}
	}

	async checkStateChangeForDisplay(configNo, deviceId, capability, value)
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
			if ((value == null) || (value === undefined))
			{
				value = '';
			}

			if (deviceId === '_variable_')
			{
				// This is a variable update so only check the variable entries
				for (let itemNo = 0; itemNo < item.items.length; itemNo++)
				{
					const displayItem = item.items[itemNo];
					if ((displayItem.device === '_variable_') && (displayItem.capability === capability))
					{
						// Publish to MQTT
						const { brokerId } = displayItem;
						this.homey.app.publishMQTTMessage(brokerId, `buttonplus/_variable_/${capability}`, value).catch(this.error);
						break;
					}
				}
			}
			else
			{
				// Check if it is Button Plus device as it's all for one and one for all
				let buttonPlusDevice = false;
				let homeyDeviceObject = await this.homey.app.getHomeyDeviceById(deviceId);
				if (homeyDeviceObject)
				{
					if (homeyDeviceObject.driverId === 'homey:app:com.ady.button_plus:panel_hardware')
					{
						buttonPlusDevice = true;
						deviceId = this.__id;
					}
				}

				for (let itemNo = 0; itemNo < item.items.length; itemNo++)
				{
					const displayItem = item.items[itemNo];
					if ((buttonPlusDevice || (displayItem.device === deviceId)) && (displayItem.capability === capability))
					{
						// Check if the value is different from the last time we published it
						if (capability === 'dim')
						{
							// convert dim value to percentage
							value *= 100;
						}

						// Publish to MQTT
						const { brokerId } = displayItem;
						this.homey.app.publishMQTTMessage(brokerId, `buttonplus/${deviceId}/${capability}`, value).catch(this.error);
						break;
					}
				}
			}
		}
	}

	async setupConnectorMQTTmessages(config, page, connector)
	{
		let mqttQue = [];

		mqttQue = mqttQue.concat(await this.publishButtonMQTTmessages(config, page, connector * 2));
		mqttQue = mqttQue.concat(await this.publishButtonMQTTmessages(config, page, connector * 2 + 1));

		return mqttQue;
	}

	async publishButtonMQTTmessages(config, page, buttonIdx)
	{
		const mqttQueue = [];
		let value = false;

		if ((page > 0) && !checkSEMVerGreaterOrEqual(this.firmwareVersion, '2.0.0'))
		{
			// Button pages are not supported in this firmware version
			return mqttQueue;
		}

		const side = ((buttonIdx & 1) === 0) ? 'left' : 'right';
		const sideConfig = this.getConfigPageSide(config ? config[page] : null, page, side);

		const connector = parseInt(buttonIdx / 2, 10);

		buttonIdx += 1;

		// Setup value based on the configuration
		if (sideConfig.deviceID === '_variable_')
		{
			// Get the variable value
			const variable = await this.homey.app.getVariable(sideConfig.capabilityName);
			if (variable && variable.type === 'boolean')
			{
				value = variable.value;
			}

			if ((page === 0) || (this.page === page))
			{
				// Set the device button state
				this.setCapabilityValue(`${side}_button.connector${connector}`, value).catch(this.error);
			}

			this.buttonValues.set(`${side}_${connector}_${page}`, value);
		}
		else if (sideConfig.deviceID !== 'none')
		{
			// Get the value from the capability
			try
			{
				const { device, capability } = await this.getDeviceAndCapability(sideConfig);
				if (capability)
				{
					this.homey.app.registerDeviceCapabilityStateChange(device, sideConfig.capabilityName);
					value = capability.value;
					if (capability.id === 'windowcoverings_state')
					{
						if (value === 'up')
						{
							value = true;
						}
						else if (value === 'down')
						{
							value = false;
						}
						else
						{
							// for idle use the last value
							value = this.buttonValues.get(`${side}_${connector}_${page}`);

						}
					}
					if ((page === 0) || (this.page === page))
					{
						await this.setCapabilityValue(`${side}_button.connector${connector}`, value);
					}

					this.buttonValues.set(`${side}_${connector}_${page}`, value);
				}
			}
			catch (err)
			{
				this.homey.app.updateLog(`Error getting device id = ${sideConfig.deviceID}: ${err.message}`, 0);
			}
		}
		else
		{
			value = this.buttonValues.get(`${side}_${connector}_${page}`) | false;
		}

		// Add the front and wall colours or the on/off state to the message queue based on the on/off value and firmware version
		this.setLEDOnOff(sideConfig, mqttQueue, buttonIdx, page, value );

		// Send the value to the device after a short delay to allow the device to connect to the broker
		mqttQueue.push(
            {
                brokerId: sideConfig.brokerId,
				message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/toplabel/set`,
                value: sideConfig.topLabel,
            },
        );

		// Send the value to the device after a short delay to allow the device to connect to the broker
		mqttQueue.push(
            {
                brokerId: sideConfig.brokerId,
				message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/label/set`,
                value: value ? sideConfig.onMessage : sideConfig.offMessage,
            },
        );

        return mqttQueue;
	}

	getConfigPageSide(config, page, side, configNo)
	{
		if (config === null)
		{
			let buttonPanelConfiguration = this.homey.app.buttonConfigurations[configNo];
			if (buttonPanelConfiguration)
			{
				if (page >= buttonPanelConfiguration.length)
				{
					page = 0;
				}
				config = buttonPanelConfiguration[page]
			}
		}

		if (!config)
		{
			return {
				deviceID: 'none',
				capabilityName: '',
				onMessage: '',
				offMessage: '',
				brokerId: 'Default',
				dimChange: 0,
                frontLEDOnColor: '#000000',
                wallLEDOnColor: '#000000',
				frontLEDOffColor: '#000000',
				wallLEDOffColor: '#000000',
				page,
			};
		}

		// Setup which of our buttons (left or right) this message is for
		return {
			deviceID: config[`${side}Device`],
			capabilityName: config[`${side}Capability`],
			topLabel: config[`${side}TopText`],
			onMessage: config[`${side}OnText`],
			offMessage: config[`${side}OffText`],
			brokerId: config[`${side}BrokerId`],
			dimChange: config[`${side}DimChange`],
            frontLEDOnColor: config[`${side}FrontLEDOnColor`],
            wallLEDOnColor: config[`${side}WallLEDOnColor`],
			frontLEDOffColor: config[`${side}FrontLEDOffColor`],
			wallLEDOffColor: config[`${side}WallLEDOffColor`],
			page: config['PageNum'] === 'Default' ? 0 : config['PageNum'],
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

					if (a.front_wall !== undefined)
					{
						// Array of front and wall colours
						return a.front_wall.localeCompare( b.front_wall);
					}

					return 0;
				});
			}
			// Check if the values are objects and if so compare items
			else if ((typeof value1 === 'object' && value1 !== null) && (typeof value2 === 'object' && value2 !== null))
			{
				// For each item in value1 check if it is in value2
				for (const key in value1)
				{
					// If the item is another array then compare the items
					if (Array.isArray(value1[key]) && Array.isArray(value2[key]))
					{
						if (!_.isEqualWith(value1[key], value2[key], customizer))
						{
							return false;
						}
					}
					else
					{
						if (!value2.hasOwnProperty(key))
						{
							return false;
						}

						if (!_.isEqual(value1[key], value2[key]))
						{
							return false;
						}
					}
				}

				// For each item in value2 check if it is in value1
				for (const key in value2)
				{
					if (key !== 'buttonid')
					{
						if (!value1.hasOwnProperty(key))
						{
							return false;
						}
					}
				}

				return true;
			}

			return undefined;
		}

		return _.isEqualWith(obj1, obj2, customizer);
	}

	setLEDOnOff(config, mqttQueue, buttonIdx, page, value)
	{
		if (checkSEMVerGreaterOrEqual(this.firmwareVersion, '1.12.0'))
		{
			if ((value === true) || (value === 'up'))
			{
				// Send the front and wall colours to the device after a short delay to allow the device to connect to the broker
				if (config.frontLEDOnColor)
				{
					const frontLEDOnColor = parseInt(config.frontLEDOnColor.substring(1), 16);
					if (mqttQueue)
					{
						mqttQueue.push(
							{
								brokerId: config.brokerId,
								message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/front/rgb/set`,
								value: frontLEDOnColor,
								retain: false,
							},
						);
					}
					else
					{
						this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/front/rgb/set`, frontLEDOnColor).catch(this.error);
					}
				}

				if (config.wallLEDOnColor)
				{
					const wallLEDOnColor = parseInt(config.wallLEDOnColor.substring(1), 16);
					if (mqttQueue)
					{
						mqttQueue.push(
							{
								brokerId: config.brokerId,
								message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/wall/rgb/set`,
								value: wallLEDOnColor,
								retain: false,
							},
						);
					}
					else
					{
						this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/wall/rgb/set`, wallLEDOnColor).catch(this.error);
					}
				}
			}
			else
			{
				// Send 0 to the front and wall colours of the device after a short delay to allow the device to connect to the broker
				if (config.frontLEDOffColor)
				{
					const frontLEDOffColor = parseInt(config.frontLEDOffColor.substring(1), 16);
					if (mqttQueue)
					{
						mqttQueue.push(
							{
								brokerId: config.brokerId,
								message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/front/rgb/set`,
								value: frontLEDOffColor,
								retain: false,
							},
						);
					}
					else
					{
						this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/front/rgb/set`, frontLEDOffColor).catch(this.error);
					}
				}

				if (config.wallLEDOffColor)
				{
					const wallLEDOffColor = parseInt(config.wallLEDOffColor.substring(1), 16);
					if (mqttQueue)
					{
						mqttQueue.push(
							{
								brokerId: config.brokerId,
								message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/wall/rgb/set`,
								value: wallLEDOffColor,
								retain: false,
							},
						);
					}
					else
					{
						this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/wall/rgb/set`, wallLEDOffColor).catch(this.error);
					}
				}
			}
		}
		else
		{
			// Send the value to the device after a short delay to allow the device to connect to the broker
			if (mqttQueue)
			{
				mqttQueue.push(
					{
						brokerId: config.brokerId,
						message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}`,
						value,
					},
				);
			}
			else
			{
				this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/${buttonIdx}-${page}`, value).catch(this.error);
			}
		}
	}

	async turnButtonOnOff(left_right, connector, page, state)
	{
		if ((page === 0) || (page === this.page))
		{
			await this.triggerCapabilityListener(`${left_right}_button.connector${connector}`, state);
		}

		this.buttonValues.set(`${left_right}_${connector}_${page}`, state);
	}
}

module.exports = PanelDevice;
