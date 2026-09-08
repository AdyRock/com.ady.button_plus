/* eslint-disable max-len */
/* eslint-disable camelcase */

'use strict';

const { Device } = require('homey');
const _ = require('lodash');
const { checkSEMVerGreaterOrEqual } = require('../../lib/HttpHelper');
const { isSvgTextContent } = require('../../lib/SvgHelper');

const V3_LONG_PRESS_EVENT_INTERVAL_MS = 20;
const DOUBLE_CLICK_WINDOW_MS = 350;
const DEFAULT_LONG_PRESS_DELAY_MS = 750;

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
		this.longPressEventCounts = new Map();
		this.lastLongPressTimes = new Map();
		this.buttonValues = new Map();
		this.dimDirections = new Map();
		this.dimClickTimers = new Map();
		this.dimToggleValues = new Map();
		this.clickEventTimers = new Map();
		this.pendingClickedTriggers = new Map();
		this.pendingReleasedTriggers = new Map();
		this.pickerPendingValues = new Map();
		this.pickerCommitTimers = new Map();
		this.capabilityDispatchInFlight = new Set();
		this.barConfigured = [false, false, false, false, false, false, false, false];
		this.page = 1;

		const { id } = this.getData();
		this.buttonId = id;

		const settings = this.getSettings();

		this.ip = settings.address;
		this.displayButtonEvents = settings.displayButtonEvents === true;

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

		this.initHardwareTimer = this.homey.setTimeout(() =>
		{
			this.initHardwareTimer = null;
			this.intiHardware().catch(this.error);
		}, 7000 + random);

		this.log('PanelDevice has been initialized');
	}

	async intiHardware()
	{
		if (this.initHardwareTimer || this.initInProgress)
		{
			// Already waiting for the hardware to initialise
			this.log('PanelDevice is already initializing hardware');
			return;
		}

		this.initInProgress = true;

		try
		{
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
					if (!this.disabled)
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
		catch (err)
		{
			this.error('Hardware initialization error:', err);
			this.initInProgress = false;
		}
		finally
		{
			this.initInProgress = false;
		}
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
					this.homey.app.updateLog("setupMQTTClient.subscribe 'currentpage' error: " + this.homey.app.varToString(err), 0);
				}
			});

			mqttClient.subscribe(`buttonplus/${this.buttonId}/#`, (err) =>
			{
				if (err)
				{
					this.homey.app.updateLog("setupMQTTSubscriptions 'buttom/#' error: " + this.homey.app.varToString(err), 0);
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

		if (changedKeys.includes('displayButtonEvents'))
		{
			this.displayButtonEvents = newSettings.displayButtonEvents === true;

			// Reconfigure the connectors and republish the panel configuration so the
			// display connector's buttons are added or removed from the panel configuration
			setImmediate(() =>
			{
				this.configureConnectors(newSettings)
					.then(() => this.uploadConfigurations())
					.catch(this.error);
			});
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

		if (this.setupSubsTimer)
		{
			this.homey.clearTimeout(this.setupSubsTimer);
			this.setupSubsTimer = null;
		}

		// Clean up Map objects to prevent memory leaks
		if (this.longPressOccurred)
		{
			this.longPressOccurred.clear();
		}
		if (this.longPressEventCounts)
		{
			this.longPressEventCounts.clear();
		}
		if (this.lastLongPressTimes)
		{
			this.lastLongPressTimes.clear();
		}
		if (this.buttonValues)
		{
			this.buttonValues.clear();
		}
		if (this.dimClickTimers)
		{
			for (const timer of this.dimClickTimers.values())
			{
				this.homey.clearTimeout(timer);
			}
			this.dimClickTimers.clear();
		}
		if (this.dimDirections)
		{
			this.dimDirections.clear();
		}
		if (this.dimToggleValues)
		{
			this.dimToggleValues.clear();
		}
		if (this.clickEventTimers)
		{
			for (const timer of this.clickEventTimers.values())
			{
				this.homey.clearTimeout(timer);
			}
			this.clickEventTimers.clear();
		}
		if (this.pendingClickedTriggers)
		{
			this.pendingClickedTriggers.clear();
		}
		if (this.pendingReleasedTriggers)
		{
			this.pendingReleasedTriggers.clear();
		}
		if (this.pickerCommitTimers)
		{
			for (const timer of this.pickerCommitTimers.values())
			{
				this.homey.clearTimeout(timer);
			}
			this.pickerCommitTimers.clear();
		}
		if (this.pickerPendingValues)
		{
			this.pickerPendingValues.clear();
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

		if (!Array.isArray(topic) || topic.length < 2)
		{
			return;
		}

		if (topic[1] === 'brightness')
		{
			const dim = parseFloat(MQTTMessage) / 100;
			if (isNaN(dim))
			{
				return;
			}
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
			const configs = this.homey?.app?.buttonConfigurations;
			const item = Array.isArray(configs) ? configs[configNo] : null;
			if (item)
			{
				if (page < item.length)
				{
					const pageItem = item[page];
					if (!pageItem)
					{
						return { brokerId, buttonIdx };
					}

					if (side === 'left')
					{
						if (pageItem.leftBrokerId)
						{
							brokerId = pageItem.leftBrokerId;
						}
					}
					else
					{
						if (pageItem.rightBrokerId)
						{
							brokerId = pageItem.rightBrokerId;
						}
					}
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

	async updateConnectorButtonSVG(left_right, connector, page, svg)
	{
		if (!this.initFinished)
		{
			throw new Error('Device is not initialised');
		}
		const { brokerId, buttonIdx } = this.getBrokerIdAndBtnIdx(left_right, connector, page);
		return this.homey.app.publishMQTTMessage(brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx + 1}-${page}/svg/set`, svg).catch((err) => this.error(err));
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

	async updateConfigButtonSVG(left_right, configNo, page, svg)
	{
		if (!this.initFinished)
		{
			throw new Error('Device is not initialised');
		}
		// Find the button connector that has this configuration
		const connector = this.findConnectorUsingConfigNo(configNo);
		return this.updateConnectorButtonSVG(left_right, connector, page, svg);
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
		const allConfigs = this.homey?.app?.buttonConfigurations;
		if (!Array.isArray(allConfigs))
		{
			throw new Error('Button configurations are unavailable');
		}

		const config = allConfigs[configNo];
		if (!Array.isArray(config))
		{
			throw new Error(`Invalid button configuration index: ${configNo}`);
		}

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

		this.homey.app.publishMQTTMessage(brokerId, `buttonplus/${this.buttonId}/page/set`, pageCommand, false).catch(this.error);
	}

	async uploadPanelSensorConfiguration(deviceConfigurations)
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
		else if (checkSEMVerGreaterOrEqual(this.firmwareVersion, '3.0.0'))
		{
			// Upload the sensor configuration for firmware 3.0.0 and later
			if (this.ip !== '')
			{
				try
				{
					const brokerId = this.homey.settings.get('defaultBroker');
					const sectionConfiguration = {
						sensors: [
							{
								sensorid: "sens1",
								type: 1,
								interval: 10,
								topics: [
								],
							},
							{
								sensorid: "sens2",
								type: 7,
								interval: 3,
								topics: [
								],
							},
							{
								sensorid: "sens3",
								type: 8,
								interval: 10,
								topics: [
								],
							},
							{
								sensorid: "sens4",
								type: 9,
								interval: 10,
								topics: [
								],
							},
							{
								sensorid: "sens5",
								type: 6,
								interval: 10,
								topics: [
								]
							}
						]
					}

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
					this.homey.app.updateLog(`Error setting up sensor configuration: ${err.message}`, 0);
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
			let deviceConfigurations = null;
			let readAttempt = 0;
			const maxReadAttempts = 3;

			while (readAttempt < maxReadAttempts)
			{
				deviceConfigurations = await this.homey.app.readDeviceConfiguration(this.ip);
				if (deviceConfigurations !== null)
				{
					break;
				}

				readAttempt++;
				if (readAttempt < maxReadAttempts)
				{
					await new Promise((resolve) => setTimeout(resolve, 1500));
				}
			}

			if (deviceConfigurations === null)
			{
				this.homey.app.updateLog(`Unable to read device configuration from ${this.ip} after ${maxReadAttempts} attempts`, 0);
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
			({ mqttQue } = await this.uploadAllButtonConfigurations(deviceConfigurations) || { mqttQue: [] })
			await this.uploadDisplayConfigurations(deviceConfigurations);
			await this.uploadBrokerConfigurations(deviceConfigurations);
			await this.uploadPanelSensorConfiguration(deviceConfigurations);
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
							if (!mqttMsg || typeof mqttMsg !== 'object' || !mqttMsg.message)
							{
								this.homey.app.updateLog(`Skipping malformed mqtt queue entry: ${this.homey.app.varToString(mqttMsg)}`, 0);
								continue;
							}

							const brokerId = mqttMsg.brokerId || 'Default';
							this.homey.app.publishMQTTMessage(brokerId, mqttMsg.message, mqttMsg.value, false).catch(this.error);
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

		if (!deviceConfiguration.info || !Array.isArray(deviceConfiguration.info.connectors) || !deviceConfiguration.info.mac)
		{
			throw new Error('Device configuration is missing required fields');
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
				settings[`connect${i}Type`] = deviceConfiguration.info.connectors[connectIdx].type;
			}
			else
			{
				settings[`connect${i}Type`] = 0;
			}
		}

		await this.setSettings(settings);
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

			if (connectType !== 1) // 0 = not fitted, 1 = button panel, 2 = display, 3 = display (V2 panels)
			{
				if (this.hasCapability(`configuration_button.connector${connector}`))
				{
					await this.removeCapability(`configuration_button.connector${connector}`);
				}

				if ((connectType !== 2) && ((connectType !== 3) || (this.displayButtonEvents !== true)))
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

					if (!this.hasCapability(`left_button.connector${connector}`))
					{
						await this.addCapability(`left_button.connector${connector}`);
					}

					if (!this.hasCapability(`right_button.connector${connector}`))
					{
						await this.addCapability(`right_button.connector${connector}`);
					}

					const capabilityOption = {};
					capabilityOption.title = `${this.homey.__('display')} ${this.homey.__('connector')} ${connector + 1}`;
					this.setCapabilityOptions('configuration_display', capabilityOption);
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
				}

				if (!this.hasCapability(`left_button.connector${connector}`))
				{
					await this.addCapability(`left_button.connector${connector}`);
				}

				if (!this.hasCapability(`right_button.connector${connector}`))
				{
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
				this.barConfigured[connector] = configNo != null;

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
					({ mqttQue, delay } = await this.uploadAllButtonConfigurations(null, connector, value) || { mqttQue: [], delay: 100 });
				}
				else
				{
					const configNo = parseInt(value, 10);

					if (!Number.isNaN(configNo))
					{
						const buttonPanelConfiguration = this.homey.app.buttonConfigurations[configNo];

						if ((!checkSEMVerGreaterOrEqual(this.firmwareVersion, '1.12.0')) || (this.barConfigured[connector] === false))
						{
							// Upload the button configuration
							await this.uploadOneButtonConfiguration(connector, configNo, this.firmwareVersion);
							this.barConfigured[connector] = true;
						}

						if (Array.isArray(buttonPanelConfiguration))
						{
							for (let page = 0; page < buttonPanelConfiguration.length; page++)
							{
								const pageMqttMessages = await this.setupConnectorMQTTmessages(buttonPanelConfiguration, page, connector);
								mqttQue = mqttQue.concat(pageMqttMessages);
							}
						}
					}
				}

				// Send the MQTT messages after a short delay to allow the device to reset and connect to the broker
				setTimeout(async () =>
				{
					for (const mqttMsg of mqttQue)
					{
						if (!mqttMsg || typeof mqttMsg !== 'object' || !mqttMsg.message)
						{
							this.homey.app.updateLog(`Skipping malformed mqtt queue entry: ${this.homey.app.varToString(mqttMsg)}`, 0);
							continue;
						}

						const brokerId = mqttMsg.brokerId || 'Default';
						this.homey.app.publishMQTTMessage(brokerId, mqttMsg.message, mqttMsg.value, false).catch(this.error);
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
		parameters.configNo = ((connectorType === 2) || (connectorType === 3)) ? null : this.getCapabilityValue(`configuration_button.connector${parameters.connector}`);
		await this.processClickMessage(parameters);
	}

	isPanelButtonCapability(capabilityName)
	{
		return /^(left|right)_button\.connector\d+$/.test(capabilityName || '');
	}

	isButtonPlusTargetDevice(device)
	{
		const driverId = String((device && (device.driverId || device.driverUri)) || '');
		return driverId === 'homey:app:com.ady.button_plus:panel_hardware'
			|| /com\.ady\.button_plus:panel_hardware$/.test(driverId);
	}

	getHomeyDeviceId(device)
	{
		return (device && (device.id || device.__id)) || null;
	}

	async guardedSetCapabilityValueOnDevice(device, capabilityName, value, sourceLabel)
	{
		const targetDeviceId = this.getHomeyDeviceId(device) || 'unknown-device';
		const key = `${targetDeviceId}::${capabilityName}`;

		if (this.capabilityDispatchInFlight.has(key))
		{
			// Repeated dim adjustments during a long press can legitimately overlap while a slow device (e.g. Z-Wave)
			// is still acknowledging the previous change; that's expected, not a sign of a recursive loop
			const isExpectedDimOverlap = (capabilityName === 'dim') && (sourceLabel === 'processClickMessage:dim');
			this.homey.app.updateLog(`Blocked recursive capability dispatch ${key} from ${sourceLabel}`, isExpectedDimOverlap ? 1 : 0);
			return false;
		}

		this.capabilityDispatchInFlight.add(key);
		try
		{
			await device.setCapabilityValue(capabilityName, value);
			return true;
		}
		finally
		{
			this.capabilityDispatchInFlight.delete(key);
		}
	}

	async onCapabilityInfo(value, opts)
	{
		this.setCapabilityValue('info', value).catch(this.error);
	}

	async safeSetCapabilityValue(capability, value)
	{
		if (!this.hasCapability(capability))
		{
			this.homey.app.updateLog(`Skipping update for missing capability: ${capability}`);
			return null;
		}

		return this.setCapabilityValue(capability, value).catch(this.error);
	}

	async safeTriggerCapabilityListener(capability, value)
	{
		if (!this.hasCapability(capability))
		{
			this.homey.app.updateLog(`Skipping trigger for missing capability: ${capability}`);
			return null;
		}

		return this.triggerCapabilityListener(capability, value).catch(this.error);
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
			else if ((topicParts[2] === 'sensor') && ((topicParts[3] === '1') || (topicParts[3] === 'sens1')))
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
			else if ((topicParts[2] === 'sensor') && ((topicParts[3] === '2') || (topicParts[3] === 'sens2')))
			{
				// If the value is not a number then ignore it
				if (!isNaN(value))
				{
					// Update the luminance capability
					const luminance = value;

					// Make sure the capability exists before trying to set it
					if (!this.hasCapability('measure_luminance'))
					{
						await this.addCapability('measure_luminance');
					}

					this.setCapabilityValue('measure_luminance', luminance).catch(this.error);

					const configNo = this.getCapabilityValue('configuration_display');
					this.checkStateChangeForDisplay(configNo, this.__id, 'measure_luminance', luminance);
				}
			}
			else if ((topicParts[2] === 'sensor') && ((topicParts[3] === '3') || (topicParts[3] === 'sens3')))
			{
				// If the value is not a number then ignore it
				if (!isNaN(value))
				{
					// Update the memory capability
					const freeMemory = value;
					// Make sure the capability exists before trying to set it
					if (!this.hasCapability('measure_memory'))
					{
						await this.addCapability('measure_memory');
					}

					this.setCapabilityValue('measure_memory', freeMemory).catch(this.error);
				}
			}
			else if ((topicParts[2] === 'sensor') && ((topicParts[3] === '4') || (topicParts[3] === 'sens4')))
			{
				// If the value is not a number then ignore it
				if (!isNaN(value))
				{
					// Update the signal strength capability
					const signalStrength = value;

					// Make sure the capability exists before trying to set it
					if (!this.hasCapability('measure_signal_strength'))
					{
						await this.addCapability('measure_signal_strength');
					}

					this.setCapabilityValue('measure_signal_strength', signalStrength).catch(this.error);

					const configNo = this.getCapabilityValue('configuration_display');
					this.checkStateChangeForDisplay(configNo, this.__id, 'measure_signal_strength', signalStrength);
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
		parameters.configNo = ((parameters.connectorType === 2) || (parameters.connectorType === 3)) ? this.getCapabilityValue('configuration_display') : this.getCapabilityValue(`configuration_button.connector${parameters.connector}`);
		parameters.buttonCapability = `${parameters.side}_button.connector${parameters.connector}`;
		parameters.value = !this.buttonValues.get(`${parameters.side}_${parameters.connector}_${parameters.page}`);

		// Now process the message
		if (MQTTMessage.event === 'click')
		{
			this.homey.app.updateLog(`Panel processing MQTT message: ${MQTTMessage.event}`);
			const longPressKey = `${parameters.connector}_${parameters.side}_${parameters.page}`;
			this.longPressOccurred.set(longPressKey, 0);
			this.longPressEventCounts.delete(longPressKey);
			this.lastLongPressTimes.delete(longPressKey);

			// The button was pressed
			this.handleButtonClick(parameters);
			// Defer the generic 'clicked' Flow trigger: it's discarded instead of fired if this turns into a double click
			this.queueClickedTrigger(longPressKey, () => this.homey.app.triggerButtonEvent(this, parameters.side, parameters.connector, 'clicked', parameters.value, parameters.value.toString(), 0));
		}
		else if (MQTTMessage.event === 'longpress')
		{
			// The button has been pressed for a long time
			this.processLongPressMessage(parameters);
		}
		else if (MQTTMessage.event === 'release')
		{
			this.homey.app.updateLog(`Panel processing MQTT message: ${MQTTMessage.event}`);

			// The button has been released; button_event's 'released' trigger is queued from within
			// processReleaseMessage itself so it can be discarded there if this turns into a double click
			this.processReleaseMessage(parameters);
		}
	}

	resolveConnectorConfig(parameters)
	{
		// Check if a large display or if no configuration assigned to this connector
		let config = null;
		if ((parameters.configNo != null) && (parameters.connectorType !== 2) && (parameters.connectorType !== 3))
		{
			if (!parameters.page)
			{
				parameters.page = 0;
			}
			config = this.getConfigPageSide(null, parameters.page, parameters.side, parameters.configNo);
			parameters.page = parseInt(config.page, 10);
		}

		return config;
	}

	isDimButtonConfig(config)
	{
		return !!config && (config.capabilityName === 'dim') && (config.deviceID !== 'none') && (config.deviceID !== 'customMQTT') && (config.deviceID !== '_variable_');
	}

	getConfiguredLongPressDelayMs(parameters)
	{
		if ((parameters.configNo == null) || (parameters.connectorType === 2) || (parameters.connectorType === 3))
		{
			return DEFAULT_LONG_PRESS_DELAY_MS;
		}

		const buttonPanelConfiguration = this.homey.app.buttonConfigurations[parameters.configNo];
		const buttonPageConfiguration = buttonPanelConfiguration ? (buttonPanelConfiguration[parameters.page] || buttonPanelConfiguration[0] || {}) : {};
		const configuredDelay = parseInt(buttonPageConfiguration[`${parameters.side}LongDelayMs`], 10);

		return Number.isNaN(configuredDelay) ? DEFAULT_LONG_PRESS_DELAY_MS : Math.max(0, Math.min(configuredDelay, 10000));
	}

	// Defers firing a 'clicked'/'released' Flow trigger until we know whether the press turns into a double click;
	// if a second click/release arrives within the double click window the pending fns are discarded instead of fired
	queueClickedTrigger(key, fireFn)
	{
		if (!this.pendingClickedTriggers.has(key))
		{
			this.pendingClickedTriggers.set(key, []);
		}

		this.pendingClickedTriggers.get(key).push(fireFn);
	}

	queueReleasedTrigger(key, fireFn)
	{
		if (!this.pendingReleasedTriggers.has(key))
		{
			this.pendingReleasedTriggers.set(key, []);
		}

		this.pendingReleasedTriggers.get(key).push(fireFn);
	}

	firePendingSingleClickTriggers(key)
	{
		const clickedFns = this.pendingClickedTriggers.get(key);
		this.pendingClickedTriggers.delete(key);
		if (clickedFns)
		{
			clickedFns.forEach((fireFn) => fireFn());
		}

		const releasedFns = this.pendingReleasedTriggers.get(key);
		this.pendingReleasedTriggers.delete(key);
		if (releasedFns)
		{
			releasedFns.forEach((fireFn) => fireFn());
		}
	}

	discardPendingSingleClickTriggers(key)
	{
		this.pendingClickedTriggers.delete(key);
		this.pendingReleasedTriggers.delete(key);
	}

	// Real physical clicks are paired with a release that resolves single-vs-double via handleGenericDoubleClick,
	// so their 'clicked' trigger can be deferred; clicks with no such pairing (virtual button capability,
	// long press repeat) must fire immediately since nothing will ever resolve/discard them
	fireOrQueueClickedTrigger(parameters, key, fireFn)
	{
		if (parameters.event === 'click')
		{
			this.queueClickedTrigger(key, fireFn);
		}
		else
		{
			fireFn();
		}
	}

	async getCapabilityDisplayKind(config)
	{
		if (config.deviceID === '_variable_')
		{
			const variable = await this.homey.app.getVariable(config.capabilityName);
			if (!variable)
			{
				return 'unknown';
			}

			return (variable.type === 'boolean') ? 'boolean' : 'text';
		}

		if ((config.capabilityName === 'dim') || (config.capabilityName === 'windowcoverings_state'))
		{
			return config.capabilityName;
		}

		const { capability } = await this.getDeviceAndCapability(config);
		if (!capability)
		{
			return 'unknown';
		}

		if (capability.type === 'boolean')
		{
			return 'boolean';
		}

		if ((capability.type === 'enum') && (capability.setable !== false) && Array.isArray(capability.values) && (capability.values.length > 0))
		{
			return 'picker';
		}

		return 'text';
	}

	async getConfigLedButtonState(config, fallback = false)
	{
		if (!config || (config.deviceID === '_variable_') || (config.deviceID === 'none') || (config.deviceID === 'customMQTT'))
		{
			return fallback;
		}

		if (config.capabilityName === 'dim')
		{
			// Dim buttons have no on/off value of their own: the LED (and reported button state) follows the target device's onoff capability
			return this.getDimButtonLedState(config);
		}

		const kind = await this.getCapabilityDisplayKind(config);
		if ((kind === 'text') || (kind === 'picker'))
		{
			// Text/picker capabilities have no on/off value of their own: the LED (and reported button state) follows the target device's onoff capability
			const ledState = await this.getCapabilityLedState(config);
			return (ledState !== null) ? ledState : fallback;
		}

		return fallback;
	}

	async handleButtonClick(parameters)
	{
		const config = this.resolveConnectorConfig(parameters);

		if (this.isDimButtonConfig(config))
		{
			// Dim buttons only decide their click action on release, once we know for certain whether it was a long press
			const key = this.getDimButtonKey(parameters.connector, parameters.side, parameters.page);
			const { capability } = await this.getDeviceAndCapability(config);
			const percent = capability && (typeof capability.value === 'number') ? capability.value * 100 : 0;
			const direction = this.getDimDirection(key, config.dimChange);

			// Dim buttons have no on/off value of their own: the button/LED state instead follows the target device's onoff capability
			const ledState = await this.getDimButtonLedState(config);
			this.fireOrQueueClickedTrigger(parameters, key, () => this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'clicked', ledState, this.formatDimLabel(percent, direction), parameters.page));
			return null;
		}

		if (config && (config.deviceID !== 'none') && (config.deviceID !== 'customMQTT'))
		{
			const kind = await this.getCapabilityDisplayKind(config);
			if (kind === 'picker')
			{
				// Item list capabilities toggle the target device's onoff state on a plain click; holding the
				// button (long press repeat) steps through the available items instead, see processLongPressMessage
				return this.handlePickerToggleClick(parameters, config);
			}

			if (kind === 'text')
			{
				return this.handleTextButtonClick(parameters, config);
			}
		}

		return this.processClickMessage(parameters);
	}

	async handlePickerToggleClick(parameters, config)
	{
		await this.toggleOnOffForNonBooleanCapability(config);

		const { capability } = await this.getDeviceAndCapability(config);
		const currentValue = capability ? capability.value : undefined;
		const currentOption = capability && Array.isArray(capability.values) ? capability.values.find((entry) => entry.id === currentValue) : null;
		const displayValue = currentOption ? (currentOption.title || currentOption.id) : ((currentValue === null || currentValue === undefined) ? '' : String(currentValue));

		const buttonIdx = parameters.connector * 2 + (parameters.side === 'left' ? 0 : 1) + 1;
		const key = this.getButtonStateKey(parameters.connector, parameters.side, parameters.page);

		// Item list capabilities have no on/off value of their own: the button/LED state instead follows the target device's onoff capability
		const ledState = await this.getCapabilityLedState(config);
		this.fireOrQueueClickedTrigger(parameters, key, () => this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'clicked', ledState !== null ? ledState : false, displayValue, parameters.page));

		if (ledState !== null)
		{
			this.setLEDOnOff(config, null, buttonIdx, parameters.page, ledState);
		}

		if (parameters.fromButton && ((parameters.page === 0) || (this.page === parameters.page)))
		{
			// Momentary press: reset the virtual button state immediately
			setImmediate(() => this.safeSetCapabilityValue(parameters.buttonCapability, false));
		}
	}

	async handleTextButtonClick(parameters, config)
	{
		const { capability } = await this.getDeviceAndCapability(config);
		const value = capability ? capability.value : '';
		const buttonIdx = parameters.connector * 2 + (parameters.side === 'left' ? 0 : 1) + 1;
		const key = this.getButtonStateKey(parameters.connector, parameters.side, parameters.page);
		this.publishTextButtonLabel(config.brokerId, buttonIdx, parameters.page, value);

		// Text capabilities have no on/off value of their own: the button/LED state instead follows the target device's onoff capability
		const ledState = await this.getCapabilityLedState(config);
		this.fireOrQueueClickedTrigger(parameters, key, () => this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'clicked', ledState !== null ? ledState : false, (value === null || value === undefined) ? '' : String(value), parameters.page));

		if (ledState !== null)
		{
			this.setLEDOnOff(config, null, buttonIdx, parameters.page, ledState);
		}

		if (parameters.fromButton && ((parameters.page === 0) || (this.page === parameters.page)))
		{
			// Momentary press: reset the virtual button state immediately
			setImmediate(() => this.safeSetCapabilityValue(parameters.buttonCapability, false));
		}
	}

	cycleNextPickerOption(capability, currentValue)
	{
		const values = Array.isArray(capability.values) ? capability.values : [];
		if (values.length === 0)
		{
			return null;
		}

		const currentIndex = values.findIndex((entry) => entry.id === currentValue);
		const nextIndex = (currentIndex >= 0) ? ((currentIndex + 1) % values.length) : 0;
		return values[nextIndex];
	}

	async handlePickerButtonClick(parameters, config)
	{
		const { device, capability } = await this.getDeviceAndCapability(config);
		if (!device || !capability)
		{
			return;
		}

		const key = this.getButtonStateKey(parameters.connector, parameters.side, parameters.page);
		const pendingValue = this.pickerPendingValues.get(key);
		const currentValue = (pendingValue !== undefined) ? pendingValue : capability.value;
		const nextOption = this.cycleNextPickerOption(capability, currentValue);
		if (!nextOption)
		{
			return;
		}

		this.pickerPendingValues.set(key, nextOption.id);

		// Display the newly selected option straight away, so cycling feels instant
		const buttonIdx = parameters.connector * 2 + (parameters.side === 'left' ? 0 : 1) + 1;
		this.publishTextButtonLabel(config.brokerId, buttonIdx, parameters.page, nextOption.title || nextOption.id);

		// Picker capabilities have no on/off value of their own: the button/LED state instead follows the target device's onoff capability
		const ledState = await this.getCapabilityLedState(config);
		this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'clicked', ledState !== null ? ledState : false, nextOption.title || nextOption.id, parameters.page);

		if (ledState !== null)
		{
			this.setLEDOnOff(config, null, buttonIdx, parameters.page, ledState);
		}

		// Defer the actual capability write until the long press delay has passed without another click,
		// so rapidly cycling through options doesn't flood the device with state changes
		const pendingTimer = this.pickerCommitTimers.get(key);
		if (pendingTimer)
		{
			this.homey.clearTimeout(pendingTimer);
		}

		const commitDelayMs = this.getConfiguredLongPressDelayMs(parameters);
		const timer = this.homey.setTimeout(() =>
		{
			this.pickerCommitTimers.delete(key);
			const valueToCommit = this.pickerPendingValues.get(key);
			this.pickerPendingValues.delete(key);
			if (valueToCommit === undefined)
			{
				return;
			}

			this.guardedSetCapabilityValueOnDevice(device, config.capabilityName, valueToCommit, 'handlePickerButtonClick:commit').catch((err) => this.error(err));
		}, commitDelayMs);

		this.pickerCommitTimers.set(key, timer);

		if (parameters.fromButton && ((parameters.page === 0) || (this.page === parameters.page)))
		{
			// Set the button state back to false immediately
			setImmediate(() => this.safeSetCapabilityValue(parameters.buttonCapability, false));
		}
	}

	getButtonStateKey(connector, side, page)
	{
		return `${connector}_${side}_${page}`;
	}

	getDimButtonKey(connector, side, page)
	{
		return this.getButtonStateKey(connector, side, page);
	}

	getDimDirection(key, dimChangeStr)
	{
		const stored = this.dimDirections.get(key);
		if (stored === '+' || stored === '-')
		{
			return stored;
		}

		return (typeof dimChangeStr === 'string' && dimChangeStr.indexOf('-') >= 0) ? '-' : '+';
	}

	formatDimLabel(percent, direction)
	{
		return `${Math.round(percent)}% ${direction}`;
	}

	publishDimButtonLabel(brokerId, buttonIdx, page, percent, direction)
	{
		this.homey.app.publishMQTTMessage(brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/label/set`, this.formatDimLabel(percent, direction)).catch(this.error);
		this.homey.app.publishMQTTMessage(brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/svg/set`, '').catch(this.error);
	}

	publishTextButtonLabel(brokerId, buttonIdx, page, value)
	{
		const text = (value === null || value === undefined) ? '' : String(value);
		this.publishTextOrSvg(brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/svg/set`, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/label/set`, text);
	}

	async handleGenericDoubleClick(parameters, key, config)
	{
		const pendingTimer = this.clickEventTimers.get(key);
		if (pendingTimer)
		{
			// Second click arrived within the double click window: discard the deferred 'clicked'/'released'
			// triggers from both presses (they never fire for a double click) and fire the double click triggers instead
			this.homey.clearTimeout(pendingTimer);
			this.clickEventTimers.delete(key);
			this.discardPendingSingleClickTriggers(key);

			// Toggle first (if applicable) so the reported button/LED state reflects the new value
			await this.toggleOnOffForNonBooleanCapability(config);

			const value = this.buttonValues.get(`${parameters.side}_${parameters.connector}_${parameters.page}`) || false;
			const buttonState = await this.getConfigLedButtonState(config, value);
			this.homey.app.triggerButtonEvent(this, parameters.side, parameters.connector, 'double', buttonState, value.toString(), 0);
			if (parameters.configNo != null)
			{
				this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'double', buttonState, value.toString(), parameters.page);
			}

			return;
		}

		// Wait to see if a second click follows before giving up on this being a double click
		const timer = this.homey.setTimeout(() =>
		{
			this.clickEventTimers.delete(key);

			// No second click arrived, so this was a plain single click/release: fire the deferred triggers now
			this.firePendingSingleClickTriggers(key);
		}, DOUBLE_CLICK_WINDOW_MS);

		this.clickEventTimers.set(key, timer);
	}

	async toggleOnOffForNonBooleanCapability(config)
	{
		if (!config || (config.deviceID === 'none') || (config.deviceID === 'customMQTT') || (config.deviceID === '_variable_'))
		{
			return;
		}

		// Text/picker capabilities have no on/off state of their own; if the target device also exposes
		// onoff, use a double click to toggle it (same as dim buttons already do)
		const kind = await this.getCapabilityDisplayKind(config);
		if ((kind !== 'text') && (kind !== 'picker'))
		{
			return;
		}

		const device = await this.homey.app.getHomeyDeviceById(config.deviceID);
		if (!device)
		{
			return;
		}

		const onoffCapability = await this.homey.app.getHomeyCapabilityByName(device, 'onoff');
		if (!onoffCapability)
		{
			return;
		}

		await this.guardedSetCapabilityValueOnDevice(device, 'onoff', !onoffCapability.value, 'handleGenericDoubleClick:onoff');
	}

	async getDimButtonLedState(config)
	{
		const device = await this.homey.app.getHomeyDeviceById(config.deviceID);
		if (device)
		{
			const onoffCapability = await this.homey.app.getHomeyCapabilityByName(device, 'onoff');
			if (onoffCapability)
			{
				return Boolean(onoffCapability.value);
			}
		}

		const dimCapability = device ? await this.homey.app.getHomeyCapabilityByName(device, 'dim') : null;
		return !!(dimCapability && dimCapability.value > 0);
	}

	async getCapabilityLedState(config)
	{
		// Non-boolean capabilities (text/picker) have no on/off value of their own, so if the target device
		// also exposes an onoff capability, use that to drive the LED instead; otherwise leave the LED alone
		const device = await this.homey.app.getHomeyDeviceById(config.deviceID);
		if (!device)
		{
			return null;
		}

		const onoffCapability = await this.homey.app.getHomeyCapabilityByName(device, 'onoff');
		return onoffCapability ? Boolean(onoffCapability.value) : null;
	}

	async refreshDimButtonDisplay(parameters, config, key)
	{
		const { capability } = await this.getDeviceAndCapability(config);
		const percent = capability && (typeof capability.value === 'number') ? capability.value * 100 : 0;
		const direction = this.getDimDirection(key, config.dimChange);

		const buttonIdx = parameters.connector * 2 + (parameters.side === 'left' ? 0 : 1) + 1;
		this.publishDimButtonLabel(config.brokerId, buttonIdx, parameters.page, percent, direction);

		// Dim buttons have no on/off value of their own, so drive the LED from the target device's onoff state
		const ledState = await this.getDimButtonLedState(config);
		this.setLEDOnOff(config, null, buttonIdx, parameters.page, ledState);
	}

	async handleDimButtonRelease(parameters, config, key)
	{
		const pendingTimer = this.dimClickTimers.get(key);
		if (pendingTimer)
		{
			// Second click arrived within the double click window
			this.homey.clearTimeout(pendingTimer);
			this.dimClickTimers.delete(key);
			return this.toggleDimDirection(parameters, config, key);
		}

		// Wait to see if a second click follows before treating this as a single click; by this point (release)
		// we already know for certain this press did not turn into a long press
		const timer = this.homey.setTimeout(() =>
		{
			this.dimClickTimers.delete(key);
			this.toggleDimOnOff(parameters, config, key).catch((err) => this.error(err));
		}, DOUBLE_CLICK_WINDOW_MS);

		this.dimClickTimers.set(key, timer);
		return null;
	}

	async toggleDimDirection(parameters, config, key)
	{
		const currentDirection = this.getDimDirection(key, config.dimChange);
		this.dimDirections.set(key, currentDirection === '-' ? '+' : '-');

		await this.refreshDimButtonDisplay(parameters, config, key);
	}

	async toggleDimOnOff(parameters, config, key)
	{
		const device = await this.homey.app.getHomeyDeviceById(config.deviceID);
		if (!device)
		{
			return;
		}

		const onoffCapability = await this.homey.app.getHomeyCapabilityByName(device, 'onoff');
		if (onoffCapability)
		{
			await this.guardedSetCapabilityValueOnDevice(device, 'onoff', !onoffCapability.value, 'handleDimButtonClick:onoff');
			await this.refreshDimButtonDisplay(parameters, config, key);
			return;
		}

		const dimCapability = await this.homey.app.getHomeyCapabilityByName(device, 'dim');
		if (!dimCapability)
		{
			return;
		}

		if (dimCapability.value > 0)
		{
			this.dimToggleValues.set(key, dimCapability.value);
			await this.guardedSetCapabilityValueOnDevice(device, 'dim', 0, 'handleDimButtonClick:dimOff');
		}
		else
		{
			const restoreValue = this.dimToggleValues.get(key) || 1;
			await this.guardedSetCapabilityValueOnDevice(device, 'dim', restoreValue, 'handleDimButtonClick:dimOn');
		}

		await this.refreshDimButtonDisplay(parameters, config, key);
	}

	async processClickMessage(parameters)
	{
		// Check if a large display or if no configuration assigned to this connector
		let config = null;
		if ((parameters.configNo != null) && (parameters.connectorType !== 2) && (parameters.connectorType !== 3))
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
		let displayValue;
		const key = this.getButtonStateKey(parameters.connector, parameters.side, parameters.page);

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
				else if (variable)
				{
					// Text/number variables have no on/off state: just show their content and trigger the flows
					const buttonIdx = parameters.connector * 2 + (parameters.side === 'left' ? 0 : 1) + 1;
					this.publishTextButtonLabel(config.brokerId, buttonIdx, parameters.page, variable.value);
					this.fireOrQueueClickedTrigger(parameters, key, () => this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'clicked', false, variable.value === undefined ? '' : String(variable.value), parameters.page));

					if (parameters.fromButton && ((parameters.page === 0) || (this.page === parameters.page)))
					{
						// Momentary press: reset the virtual button state immediately
						setImmediate(() => this.safeSetCapabilityValue(parameters.buttonCapability, false));
					}

					return;
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
						const targetDeviceId = this.getHomeyDeviceId(device);
						if (this.isButtonPlusTargetDevice(device) && config.capabilityName !== 'dim')
						{
							this.homey.app.updateLog(`Blocked unsupported Button+ target capability for ${targetDeviceId || config.deviceID}/${config.capabilityName}; only dim is allowed`, 0);
							if (parameters.fromButton)
							{
								setImmediate(() => this.safeTriggerCapabilityListener(parameters.buttonCapability, false));
							}
							return;
						}

						if (this.isPanelButtonCapability(config.capabilityName))
						{
							this.homey.app.updateLog(`Blocked recursive button target mapping for ${targetDeviceId || config.deviceID}/${config.capabilityName}`, 0);
							if (parameters.fromButton)
							{
								setImmediate(() => this.safeTriggerCapabilityListener(parameters.buttonCapability, false));
							}
							return;
						}

						if (config.capabilityName === 'dim')
						{
							// For dim capabilities we need to adjust the value by the amount in the dimChange field and not change the button state
							// Get the required change magnitude from the dimChange field and convert it from a percentage to a value
							const dimKey = this.getDimButtonKey(parameters.connector, parameters.side, parameters.page);
							const magnitude = Math.abs(parseInt(config.dimChange, 10)) / 100;
							if ((config.dimChange.indexOf('+') >= 0) || (config.dimChange.indexOf('-') >= 0))
							{
								// Brighten or darken from the current value using the direction toggled by a single click
								const direction = this.getDimDirection(dimKey, config.dimChange);
								value = direction === '-' ? capability.value - magnitude : capability.value + magnitude;

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
								value = magnitude;
							}

							// Set the dim capability value of the target device
							await this.guardedSetCapabilityValueOnDevice(device, config.capabilityName, value, 'processClickMessage:dim');

							// Show the new dim level and direction on the button display
							await this.refreshDimButtonDisplay(parameters, config, dimKey);

							displayValue = this.formatDimLabel(value * 100, this.getDimDirection(dimKey, config.dimChange));
							value *= 100;

							if (parameters.fromButton && ((parameters.page === 0) || (this.page === parameters.page)))
							{
								// Set the button state back to false immediately
								setImmediate(() => this.safeSetCapabilityValue(parameters.buttonCapability, false));
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
							displayValue = value ? 'up' : 'down';
							if (value)
							{
								// Set the new state to up
								await this.guardedSetCapabilityValueOnDevice(device, config.capabilityName, 'up', 'processClickMessage:windowcoverings_state');
							}
							else
							{
								// Set the new state to down
								await this.guardedSetCapabilityValueOnDevice(device, config.capabilityName, 'down', 'processClickMessage:windowcoverings_state');
							}
						}
						else if ((capability.type === 'enum') && (capability.setable !== false) && Array.isArray(capability.values) && (capability.values.length > 0))
						{
							// Picker capabilities have no on/off state: cycling and display are handled uniformly
							return this.handlePickerButtonClick(parameters, config);
						}
						else if (capability.type !== 'boolean')
						{
							// Text/number capabilities have no on/off state: just show their content and trigger the flows
							return this.handleTextButtonClick(parameters, config);
						}
						else
						{
							const buttonStateKey = `${parameters.side}_${parameters.connector}_${parameters.page}`;
							const cachedButtonValue = this.buttonValues.get(buttonStateKey);
							if (!parameters.fromButton)
							{
								this.homey.app.updateLog(`Toggle debug: key=${buttonStateKey}, cached=${cachedButtonValue}, capability=${capability && capability.value !== undefined ? capability.value : 'undefined'}`, 1);
							}
							const currentCapabilityValue = cachedButtonValue !== undefined ? cachedButtonValue : (capability && capability.value !== undefined ? capability.value : false);
							value = parameters.fromButton ? parameters.value : !Boolean(currentCapabilityValue);
							await this.guardedSetCapabilityValueOnDevice(device, config.capabilityName, value, 'processClickMessage:boolean');

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
				this.safeSetCapabilityValue(parameters.buttonCapability, value);
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

		const buttonState = await this.getConfigLedButtonState(config, (typeof value === 'boolean') ? value : false);
		this.fireOrQueueClickedTrigger(parameters, key, () => this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'clicked', buttonState, (displayValue !== undefined) ? displayValue : String(value), parameters.page));

		if (config && (config.capabilityName !== 'dim'))
		{
			let buttonIdx = parameters.idx;
			buttonIdx++;

			this.setLEDOnOff(config, null, buttonIdx, parameters.page, value);
			// this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/${parameters.idx}`, value).catch(this.error);
			if ((value && config.onMessage !== '') || (!value && config.offMessage !== ''))
			{
				this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${parameters.page}/label/set`, value ? config.onMessage : config.offMessage).catch(this.error);
			}

			this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${parameters.page}/svg/set`, value ? config.onSVG : config.offSVG).catch((err) => this.error(err));

			if (config.onMessage === '' && config.offMessage !== '')
			{
				// There is only an Off message so don't latch the button state
				if (parameters.fromButton && value)
				{
					// Set the button state back to false immediately
					setImmediate(() => this.safeTriggerCapabilityListener(parameters.buttonCapability, false));
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
		const longPressKey = `${parameters.connector}_${parameters.side}_${parameters.page}`;
		const isFirmwareV3 = checkSEMVerGreaterOrEqual(this.firmwareVersion, '3.0.0');
		if (!isFirmwareV3)
		{
			const lastLongPressTime = this.lastLongPressTimes.get(longPressKey);
			if (lastLongPressTime && ((Date.now() - lastLongPressTime) < 25))
			{
				// Ignore duplicate long press messages from firmware that handles its own repeat interval.
				return;
			}

			this.lastLongPressTimes.set(longPressKey, Date.now());
		}

		let repeatCount = this.longPressOccurred.get(longPressKey);
		if (repeatCount === undefined)
		{
			repeatCount = 0;
		}

		let buttonPanelConfiguration = null;
		let buttonPageConfiguration = null;
		if ((parameters.configNo != null) && (parameters.connectorType !== 2) && (parameters.connectorType !== 3))
		{
			buttonPanelConfiguration = this.homey.app.buttonConfigurations[parameters.configNo];
			buttonPageConfiguration = buttonPanelConfiguration ? (buttonPanelConfiguration[parameters.page] || buttonPanelConfiguration[0] || {}) : {};
			if (buttonPageConfiguration[`${parameters.side}DisableLongRepeat`] && (repeatCount > 0))
			{
				return null;
			}
		}

		if (isFirmwareV3)
		{
			const configuredRepeatMs = parseInt(buttonPageConfiguration && buttonPageConfiguration[`${parameters.side}LongRepeatMs`], 10);
			const repeatIntervalMs = Number.isNaN(configuredRepeatMs) ? 500 : Math.max(50, Math.min(configuredRepeatMs, 10000));
			const eventsPerRepeat = Math.max(1, Math.ceil(repeatIntervalMs / V3_LONG_PRESS_EVENT_INTERVAL_MS));
			const eventCount = this.longPressEventCounts.get(longPressKey) || 0;
			this.longPressEventCounts.set(longPressKey, eventCount + 1);

			if ((eventCount % eventsPerRepeat) !== 0)
			{
				return null;
			}
		}

		if (repeatCount === 0)
		{
			this.homey.app.updateLog(`Panel processing MQTT message: ${parameters}`);
		}

		this.longPressOccurred.set(longPressKey, repeatCount + 1);
		this.homey.app.triggerButtonLongPress(this, parameters.side === 'left', parameters.connector + 1, repeatCount, parameters.page);
		this.homey.app.triggerButtonEvent(this, parameters.side, parameters.connector, 'long', parameters.value, parameters.value.toString(), 0);

		if ((parameters.connectorType === 2) || (parameters.connectorType === 3))
		{
			// Display connector buttons: fire the configuration button trigger so long presses can start flows
			const value = this.buttonValues.get(`${parameters.side}_${parameters.connector}_${parameters.page}`) || false;
			this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'long', value, value.toString(), parameters.page, repeatCount);
		}
		else if (buttonPanelConfiguration !== null)
		{
			const value = this.buttonValues.get(`${parameters.side}_${parameters.connector}_${parameters.page}`) || false;
			const config = this.getConfigPageSide(null, parameters.page, parameters.side, parameters.configNo);
			const buttonState = await this.getConfigLedButtonState(config, value);
			this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'long', buttonState, value.toString(), parameters.page, repeatCount);

			const capability = parameters.side === 'left' ? buttonPageConfiguration.leftCapability : buttonPageConfiguration.rightCapability;

			if (capability === 'dim')
			{
				// process another click message to change the dim value
				return this.processClickMessage(parameters);
			}

			const kind = await this.getCapabilityDisplayKind(config);
			if (kind === 'picker')
			{
				// Holding the button steps through the item list instead of the plain click, which toggles onoff
				return this.handlePickerButtonClick(parameters, config);
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

		const releaseKey = `${parameters.connector}_${parameters.side}_${parameters.page}`;

		// Defer the 'released' Flow triggers: they're discarded instead of fired if this turns into a double click
		this.queueReleasedTrigger(releaseKey, () => this.homey.app.triggerButtonEvent(this, parameters.side, parameters.connector, 'released', parameters.value, parameters.value.toString(), 0));

		if (parameters.configNo != null)
		{
			const value = this.buttonValues.get(`${parameters.side}_${parameters.connector}_${parameters.page}`) || false;
			const buttonState = await this.getConfigLedButtonState(config, value);
			this.queueReleasedTrigger(releaseKey, () => this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'released', buttonState, value.toString(), parameters.page));
		}

		if (!(this.longPressOccurred && (this.longPressOccurred.get(releaseKey) > 0)))
		{
			// Only a plain click (no long press) can be part of a double click
			this.handleGenericDoubleClick(parameters, releaseKey, config).catch((err) => this.error(err));
		}

		// Check if a large display or if no configuration assigned to this connector
		if ((parameters.connectorType === 2) || (parameters.connectorType === 3) || (parameters.configNo == null))
		{
			this.setLEDOnOff(config, null, buttonIdx, parameters.page, false);
			if (parameters.page === this.page)
			{
				this.safeSetCapabilityValue(`${parameters.side}_button.connector${parameters.connector}`, false);
			}

			this.buttonValues.set(`${parameters.side}_${parameters.connector}_${parameters.page}`, false);
		}
		else if (config)
		{
			if (this.isDimButtonConfig(config))
			{
				const longPressKey = `${parameters.connector}_${parameters.side}_${parameters.page}`;
				const longPressHappened = this.longPressOccurred && (this.longPressOccurred.get(longPressKey) > 0);
				if (!longPressHappened)
				{
					// Only a plain click (no long press) reaches here, so it's safe to decide single vs double click now
					const dimKey = this.getDimButtonKey(parameters.connector, parameters.side, parameters.page);
					this.handleDimButtonRelease(parameters, config, dimKey).catch((err) => this.error(err));
				}
			}
			else if (this.longPressOccurred && (this.longPressOccurred.get(`${parameters.connector}_${parameters.side}_${parameters.page}`) > 0) && (config.capabilityName === 'windowcoverings_state'))
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
					this.safeSetCapabilityValue(`${parameters.side}_button.connector${parameters.connector}`, false);
				}

				this.buttonValues.set(`${parameters.side}_${parameters.connector}_${parameters.page}`, false);
			}
		}

		if (this.longPressOccurred)
		{
			// Record that the long press has finished
			const longPressKey = `${parameters.connector}_${parameters.side}_${parameters.page}`;
			this.longPressOccurred.set(longPressKey, 0);
			this.longPressEventCounts.delete(longPressKey);
			this.lastLongPressTimes.delete(longPressKey);
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

				// Display connectors have no button configuration, but a section entry must still be
				// generated for their two buttons so the panel publishes click events for them.
				// Only done when the displayButtonEvents setting is enabled (default off) so
				// existing installations keep their current behaviour.
				// Use the display configuration number so applyButtonConfiguration can add the defaults.
				let applyConfigNo = configNo;
				if ((configNo == null) && (this.displayButtonEvents === true) && ((connectorType === 2) || (connectorType === 3)) && this.hasCapability('configuration_display'))
				{
					applyConfigNo = this.getCapabilityValue('configuration_display');
				}

				try
				{
					let numPages = await this.homey.app.applyButtonConfiguration(this.buttonId, connectorType, sectionConfiguration, i, applyConfigNo, this.firmwareVersion);
					if (numPages > this.numPages)
					{
						this.numPages = numPages;
					}

					const hasConfigNo = configNo != null;
					let buttonPanelConfiguration = hasConfigNo ? this.homey.app.buttonConfigurations[configNo] : null;
					let pages = buttonPanelConfiguration ? buttonPanelConfiguration.length : 1;
					for (let page = 0; page < pages; page++)
					{
						// Always call setupConnectorMQTTmessages to register capability listeners and
						// initialise buttonValues from the device's current state, even when the
						// MQTT configuration has not changed and does not need to be republished.
						const pageMqttMessages = await this.setupConnectorMQTTmessages(buttonPanelConfiguration, page, i);
						const shouldPublishPage = !writeConfig || this.shouldPublishConnectorPageMQTT(deviceConfigurations, sectionConfiguration, i, page);
						if (shouldPublishPage)
						{
							mqttQue = mqttQue.concat(pageMqttMessages);
						}
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
					this.setWarning(error.message || 'Error writing Button configuration');
					return { mqttQue: [], delay };
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

		return { mqttQue, delay };
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
		if (configNo != null)
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
		if (!this.buttonValues)
		{
			this.buttonValues = new Map();
		}

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

	async checkStateChangeForConnector(connector, deviceId, capability, value)
	{
		// Get the configuration for this connector
		const configNo = this.getCapabilityValue(`configuration_button.connector${connector}`);
		if (configNo == null)
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
				const isConfiguredCapabilityMatch = (config.deviceID === deviceId) && (config.capabilityName === capability);
				// Dim buttons have no on/off value of their own, so also react to the target device's onoff changes to drive the LED
				const isDimOnOffFollow = (config.deviceID === deviceId) && (config.capabilityName === 'dim') && (capability === 'onoff');

				// Other non-boolean capabilities have no on/off value of their own either; if the target device also
				// exposes an onoff capability, react to its changes too so the LED can follow it
				let isNonBooleanOnOffFollow = false;
				if (!isConfiguredCapabilityMatch && !isDimOnOffFollow && (capability === 'onoff') && (config.deviceID === deviceId)
					&& (config.deviceID !== '_variable_') && (config.capabilityName !== 'dim') && (config.capabilityName !== 'windowcoverings_state') && (config.capabilityName !== 'onoff') && config.capabilityName)
				{
					// eslint-disable-next-line no-await-in-loop
					const { capability: configuredCapability } = await this.getDeviceAndCapability(config);
					isNonBooleanOnOffFollow = !!configuredCapability && (configuredCapability.type !== 'boolean');
				}

				if (isConfiguredCapabilityMatch || isDimOnOffFollow || isNonBooleanOnOffFollow)
				{
					let buttonIdx = connector * 2 + (side === 'left' ? 0 : 1);
					buttonIdx += 1;

					// An onoff-follow match is only for driving the LED; the capability that changed isn't the one configured on this button
					const isOnOffFollowOnly = isDimOnOffFollow || isNonBooleanOnOffFollow;

					// Text/number variables and non-boolean device capabilities (text/picker) have no on/off state: just refresh what's shown on the button
					const isNonBooleanVariable = !isOnOffFollowOnly && (config.deviceID === '_variable_') && (typeof value !== 'boolean');
					const isNonBooleanDeviceCapability = !isOnOffFollowOnly && (config.deviceID !== '_variable_') && (config.capabilityName !== 'dim') && (config.capabilityName !== 'windowcoverings_state') && (typeof value !== 'boolean');
					const skipOnOffHandling = isNonBooleanVariable || isNonBooleanDeviceCapability;

					if (isNonBooleanVariable)
					{
						this.publishTextButtonLabel(config.brokerId, buttonIdx, page, value);
					}
					else if (isNonBooleanDeviceCapability)
					{
						// eslint-disable-next-line no-await-in-loop
						const displayText = await this.resolveCapabilityDisplayText(config, value);
						this.publishTextButtonLabel(config.brokerId, buttonIdx, page, displayText);
					}
					else if (!isOnOffFollowOnly && (config.capabilityName !== 'dim'))
					{
						if (config.capabilityName !== 'windowcoverings_state')
						{
							// and trigger the flow
							if (value)
							{
								this.homey.app.triggerButtonOn(this, side === 'left', connector + 1, page);
							}
							else
							{
								this.homey.app.triggerButtonOff(this, side === 'left', connector + 1, page);
							}

							if ((page === 0) || (this.page === page))
							{
								// Set the device button state
								this.safeSetCapabilityValue(`${side}_button.connector${connector}`, value);
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
						this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/svg/set`, value ? config.onSVG : config.offSVG).catch((err) => this.error(err));
					}
					else if (!isOnOffFollowOnly && (capability === 'dim'))
					{
						// Dim capability: show the current level and toggled brighten/darken direction on the button
						const dimKey = this.getDimButtonKey(connector, side, page);
						const direction = this.getDimDirection(dimKey, config.dimChange);
						this.publishDimButtonLabel(config.brokerId, buttonIdx, page, value, direction);
					}

					// Dim buttons have no on/off value of their own, so drive the LED from the target device's onoff state
					if (config.capabilityName === 'dim')
					{
						// eslint-disable-next-line no-await-in-loop
						const ledState = await this.getDimButtonLedState(config);
						this.setLEDOnOff(config, null, buttonIdx, page, ledState);
					}
					else if (isNonBooleanDeviceCapability || isNonBooleanOnOffFollow)
					{
						// eslint-disable-next-line no-await-in-loop
						const ledState = await this.getCapabilityLedState(config);
						if (ledState !== null)
						{
							this.setLEDOnOff(config, null, buttonIdx, page, ledState);
						}
					}
					else if (!skipOnOffHandling)
					{
						// Add the front and wall colours or the on/off state to the message queue based on the on/off value and firmware version
						this.setLEDOnOff(config, null, buttonIdx, page, value);
					}
				}

				side = 'right';
			}
		}
	}

	async resolveCapabilityDisplayText(config, rawValue)
	{
		const { capability } = await this.getDeviceAndCapability(config);
		if (capability && (capability.type === 'enum') && Array.isArray(capability.values))
		{
			const match = capability.values.find((entry) => entry.id === rawValue);
			if (match)
			{
				return match.title || match.id;
			}
		}

		return (rawValue === null || rawValue === undefined) ? '' : String(rawValue);
	}


	async checkStateChangeForDisplay(configNo, deviceId, capability, value)
	{
		// Check if configNo is missing
		if (configNo == null)
		{
			// Display not configured
			return;
		}

		// Check the display devices and capabilities for this panel
		const item = this.homey.app.displayConfigurations[configNo];
		if (item)
		{
			if (!Array.isArray(item.items))
			{
				this.homey.app.updateLog(`checkStateChangeForDisplay: display config ${configNo} has no items array for panel ${this.buttonId}`, 0);
				return;
			}

			if ((value == null) || (value === undefined))
			{
				value = '';
			}

			const publishValue = (capability === 'dim') ? value * 100 : value;
			let matchedCount = 0;

			if (deviceId === '_variable_')
			{
				// This is a variable update so only check the variable entries
				for (let itemNo = 0; itemNo < item.items.length; itemNo++)
				{
					const displayItem = item.items[itemNo];
					if ((displayItem.device === '_variable_') && (displayItem.capability === capability))
					{
						// Publish to MQTT
						const brokerId = displayItem.brokerId || displayItem.brokerid || 'Default';
						matchedCount += 1;

						// If the value starts with an SVG tag then publish to the svg topic instead of the variable topic
						this.publishTextOrSvg(brokerId, `buttonplus/${this.buttonId}/displayitem/${itemNo}/svg/set`, `buttonplus/_variable_/${capability}`, publishValue);
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
						// Publish to MQTT
						const brokerId = displayItem.brokerId || displayItem.brokerid || 'Default';
						matchedCount += 1;
						this.publishTextOrSvg(brokerId, `buttonplus/${this.buttonId}/displayitem/${itemNo}/svg/set`, `buttonplus/${deviceId}/${capability}`, publishValue);
					}
				}
			}

			if (matchedCount !== 0)
			{
				this.homey.app.updateLog(`checkStateChangeForDisplay: panel ${this.buttonId}, source=${deviceId}, capability=${capability}, matched=${matchedCount}`, 1);
			}
		}
	}

	publishTextOrSvg(brokerId, svgTopic, textTopic, value)
	{
		if (isSvgTextContent(value))
		{
			this.homey.app.publishMQTTMessage(brokerId, svgTopic, value).catch((err) => this.error(err));
			this.homey.app.publishMQTTMessage(brokerId, textTopic, '').catch(this.error);
		}
		else
		{
			this.homey.app.publishMQTTMessage(brokerId, svgTopic, '').catch((err) => this.error(err));
			this.homey.app.publishMQTTMessage(brokerId, textTopic, value).catch(this.error);
		}
	}

	getButtonConfigEntry(buttons, position, page)
	{
		if (!Array.isArray(buttons))
		{
			return null;
		}

		if (checkSEMVerGreaterOrEqual(this.firmwareVersion, '2.0.0'))
		{
			const pageNo = parseInt(page, 10);
			return buttons.find((button) => parseInt(button?.position, 10) === position && parseInt(button?.page, 10) === pageNo) || null;
		}

		const idx = position - 1;
		return buttons[idx] || null;
	}

	shouldPublishConnectorPageMQTT(deviceConfigurations, sectionConfiguration, connector, page)
	{
		if (!deviceConfigurations || !Array.isArray(deviceConfigurations.buttons))
		{
			// No current button config available (for example after reset), so publish everything.
			return true;
		}

		if (!sectionConfiguration || !Array.isArray(sectionConfiguration.buttons))
		{
			return true;
		}

		const leftPosition = connector * 2 + 1;
		const rightPosition = leftPosition + 1;

		const desiredLeft = this.getButtonConfigEntry(sectionConfiguration.buttons, leftPosition, page);
		const currentLeft = this.getButtonConfigEntry(deviceConfigurations.buttons, leftPosition, page);
		if (!desiredLeft || !currentLeft)
		{
			if (desiredLeft || currentLeft)
			{
				return true;
			}
		}
		else if (!this.compareObjects(desiredLeft, currentLeft))
		{
			return true;
		}

		const desiredRight = this.getButtonConfigEntry(sectionConfiguration.buttons, rightPosition, page);
		const currentRight = this.getButtonConfigEntry(deviceConfigurations.buttons, rightPosition, page);
		if (!desiredRight || !currentRight)
		{
			if (desiredRight || currentRight)
			{
				return true;
			}
		}
		else if (!this.compareObjects(desiredRight, currentRight))
		{
			return true;
		}

		return false;
	}

	async setupConnectorMQTTmessages(config, page, connector)
	{
		const [leftQueue, rightQueue] = await Promise.all([
			this.publishButtonMQTTmessages(config, page, connector * 2),
			this.publishButtonMQTTmessages(config, page, connector * 2 + 1),
		]);

		return leftQueue.concat(rightQueue);
	}

	async publishButtonMQTTmessages(config, page, buttonIdx)
	{
		const mqttQueue = [];
		let value = false;
		let rawDimValue = null;
		let rawTextValue = null;

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
			else if (variable)
			{
				// Text/number variables have no on/off state; show their content instead
				rawTextValue = variable.value;
			}

			if ((page === 0) || (this.page === page))
			{
				// Set the device button state
				this.safeSetCapabilityValue(`${side}_button.connector${connector}`, value);
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
					const isNonBooleanCapability = (capability.type !== 'boolean') && (capability.id !== 'windowcoverings_state') && (sideConfig.capabilityName !== 'dim');
					if ((sideConfig.capabilityName === 'dim') || isNonBooleanCapability)
					{
						// Non-boolean capabilities have no on/off value of their own, so also listen for onoff changes to drive the LED
						this.homey.app.registerDeviceCapabilityStateChange(device, 'onoff');
					}
					value = capability.value;
					if (sideConfig.capabilityName === 'dim')
					{
						rawDimValue = value;
					}
					else if (isNonBooleanCapability)
					{
						// Text/picker capabilities have no on/off state; show their content (or the picker's active option title) instead
						if ((capability.type === 'enum') && Array.isArray(capability.values))
						{
							const matchedOption = capability.values.find((entry) => entry.id === value);
							rawTextValue = matchedOption ? (matchedOption.title || matchedOption.id) : value;
						}
						else
						{
							rawTextValue = value;
						}
					}

					if (isNonBooleanCapability)
					{
						// eslint-disable-next-line no-await-in-loop
						const capabilityLedState = await this.getCapabilityLedState(sideConfig);
						if (capabilityLedState !== null)
						{
							value = capabilityLedState;
						}
					}

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
						// make sure the value is a boolean for the button state
						value = Boolean(value);
						await this.safeSetCapabilityValue(`${side}_button.connector${connector}`, value);
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
			value = Boolean(this.buttonValues.get(`${side}_${connector}_${page}`));
		}

		// Add the front and wall colours or the on/off state to the message queue based on the on/off value and firmware version
		const ledValue = (sideConfig.capabilityName === 'dim') ? await this.getDimButtonLedState(sideConfig) : value;
		this.setLEDOnOff(sideConfig, mqttQueue, buttonIdx, page, ledValue);

		// Send the value to the device after a short delay to allow the device to connect to the broker
		mqttQueue.push(
			{
				brokerId: sideConfig.brokerId,
				message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/toplabel/set`,
				value: sideConfig.topLabel,
			},
		);

		if (sideConfig.capabilityName === 'dim')
		{
			// Show the current dim level and toggled brighten/darken direction on the button
			const dimKey = this.getDimButtonKey(connector, side, page);
			const direction = this.getDimDirection(dimKey, sideConfig.dimChange);
			mqttQueue.push(
				{
					brokerId: sideConfig.brokerId,
					message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/label/set`,
					value: this.formatDimLabel((rawDimValue || 0) * 100, direction),
				}
			);

			mqttQueue.push(
				{
					brokerId: sideConfig.brokerId,
					message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/svg/set`,
					value: '',
				}
			);

			return mqttQueue;
		}

		if (rawTextValue !== null)
		{
			// Text/number variables and text/picker device capabilities have no on/off state; show their content instead (or the SVG it contains)
			const displayText = String(rawTextValue);
			const displayIsSvg = isSvgTextContent(displayText);
			mqttQueue.push(
				{
					brokerId: sideConfig.brokerId,
					message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/label/set`,
					value: displayIsSvg ? '' : displayText,
				}
			);

			mqttQueue.push(
				{
					brokerId: sideConfig.brokerId,
					message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/svg/set`,
					value: displayIsSvg ? displayText : '',
				}
			);

			return mqttQueue;
		}

		// Send the value to the device after a short delay to allow the device to connect to the broker
		mqttQueue.push(
			{
				brokerId: sideConfig.brokerId,
				message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/label/set`,
				value: value ? sideConfig.onMessage : sideConfig.offMessage,
			}
		);

		mqttQueue.push(
			{
				brokerId: sideConfig.brokerId,
				message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/svg/set`,
				value: value ? sideConfig.onSVG : sideConfig.offSVG,
			}
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
				onSVG: '',
				offSVG: '',
			};
		}

		// Setup which of our buttons (left or right) this message is for
		const brokerId = config[`${side}BrokerId`] || config[`${side}brokerid`] || 'Default';
		return {
			deviceID: config[`${side}Device`],
			capabilityName: config[`${side}Capability`],
			topLabel: config[`${side}TopText`],
			onMessage: config[`${side}OnText`],
			offMessage: config[`${side}OffText`],
			brokerId,
			dimChange: config[`${side}DimChange`],
			frontLEDOnColor: config[`${side}FrontLEDOnColor`],
			wallLEDOnColor: config[`${side}WallLEDOnColor`],
			frontLEDOffColor: config[`${side}FrontLEDOffColor`],
			wallLEDOffColor: config[`${side}WallLEDOffColor`],
			page: config['PageNum'] === 'Default' ? 0 : config['PageNum'],
			onSVG: config[`${side}OnSVG`] || '',
			offSVG: config[`${side}OffSVG`] || '',
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
		function customizer(value1, value2)
		{
			if (Array.isArray(value1) && Array.isArray(value2))
			{
				value1.sort((a, b) =>
				{
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
						// Array of display items, so sort by page then y and then x
						if (a.page === b.page)
						{
							if (a.y === b.y)
							{
								return a.x - b.x;
							}
							return a.y - b.y;
						}
						return a.page - b.page;
					}

					return 0;
				});

				value2.sort((a, b) =>
				{
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
						// Array of display items, so sort by page then y and then x
						if (a.page === b.page)
						{
							if (a.y === b.y)
							{
								return a.x - b.x;
							}
							return a.y - b.y;
						}
						return a.page - b.page;
					}

					if (a.front_wall !== undefined)
					{
						// Array of front and wall colours
						return a.front_wall.localeCompare(b.front_wall);
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

		// This needs to be a non-destructive compare as we need to sort the arrays in the objects before comparing them but we don't want to change the original objects as they are used for the device configuration which we only want to update if there are changes
		const obj1Copy = _.cloneDeep(obj1);
		const obj2Copy = _.cloneDeep(obj2);
		return _.isEqualWith(obj1Copy, obj2Copy, customizer);
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

						// Always send the On command as we control the LED via the colour and use RGB(0) to turn it off
						mqttQueue.push(
							{
								brokerId: config.brokerId,
								message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/front/on/set`,
								value: 1,
								retain: false,
							},
						);
					}
					else
					{
						this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/front/rgb/set`, frontLEDOnColor).catch(this.error);
						this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/front/on/set`, 1).catch(this.error); // Always send the On command as we control the LED via the colour and use RGB(0) to turn it off
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

						// Always send the On command as we control the LED via the colour and use RGB(0) to turn it off
						mqttQueue.push(
							{
								brokerId: config.brokerId,
								message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/wall/on/set`,
								value: 1,
								retain: false,
							},
						);
					}
					else
					{
						this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/wall/rgb/set`, wallLEDOnColor).catch(this.error);
						this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/wall/on/set`, 1).catch(this.error); // Always send the On command as we control the LED via the colour and use RGB(0) to turn it off
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

						// Always send the On command as we control the LED via the colour and use RGB(0) to turn it off
						mqttQueue.push(
							{
								brokerId: config.brokerId,
								message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/front/on/set`,
								value: 1,
								retain: false,
							},
						);
					}
					else
					{
						this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/front/rgb/set`, frontLEDOffColor).catch(this.error);
						this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/front/on/set`, 1).catch(this.error); // Always send the On command as we control the LED via the colour and use RGB(0) to turn it off
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

						// Always send the On command as we control the LED via the colour and use RGB(0) to turn it off
						mqttQueue.push(
							{
								brokerId: config.brokerId,
								message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/wall/on/set`,
								value: 1,
								retain: false,
							},
						);
					}
					else
					{
						this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/wall/rgb/set`, wallLEDOffColor).catch(this.error);
						this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/wall/on/set`, 1).catch(this.error);  // Always send the On command as we control the LED via the colour and use RGB(0) to turn it off
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
