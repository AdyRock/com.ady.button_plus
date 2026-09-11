/* eslint-disable max-len */
/* eslint-disable camelcase */

'use strict';

const { Device } = require('homey');
const _ = require('lodash');
const { checkSEMVerGreaterOrEqual } = require('../../lib/HttpHelper');
const { isSvgTextContent, normalizeSvgText } = require('../../lib/SvgHelper');

const V3_LONG_PRESS_EVENT_INTERVAL_MS = 20;
const DOUBLE_CLICK_WINDOW_MS = 350;
const DEFAULT_LONG_PRESS_DELAY_MS = 750;
const DUPLICATE_CLICK_DEBOUNCE_MS = 120;

/**
 * PanelDevice - Physical button panel device connected via MQTT to Homey.
 *
 * Architecture Overview:
 * - Communicates with device via MQTT topics: buttonplus/{id}/button/{btn}-{page}/{action}
 * - Processes button events (click/longpress/release) through event flow state machines
 * - Supports "basic" mode (simple capability mapping) and "advanced" mode (rich event handling)
 * - Advanced mode allows click/long/double actions to map to any Homey device capability
 * - Display feedback shows target capability's current state; LED state controlled independently
 *
 * Event Processing Flow:
 * 1. processMQTTMessage() receives click/longpress/release from device
 * 2. handleButtonClick() detects single vs double click (requires release to resolve)
 * 3. runAdvancedEventMapping() finds device/capability and applies action (toggle/cycle/adjust)
 * 4. applyAdvancedDisplayBinding() updates panel screen with feedback
 * 5. Long presses are buffered until release to show smooth preview (e.g., dim level changing)
 *
 * State Management:
 * - Maps track per-button state: click timing, long-press count, pending debounced values, direction
 * - Click resolution window (350ms) defers 'clicked' trigger until double-click window closes
 * - Long-press values committed on release, not during repetition, to avoid flickering
 * - Debounce delay prevents excessive MQTT publishes during rapid adjustments
 */
class PanelDevice extends Device
{

	/**
	 * onInit is called when the device is initialized.
	 * Initializes all internal Maps for tracking button state across MQTT events.
	 */
	async onInit()
	{
		//		this.setUnavailable('Device is initializing');
		this.initFinished = false;
		this.longPressOccurred = new Map();
		this.longPressEventCounts = new Map();
		this.longPressLastProcessedAt = new Map();
		this.lastLongPressTimes = new Map();
		this.buttonValues = new Map();
		this.dimDirections = new Map();
		this.lastPhysicalClickAt = new Map();
		this.dimToggleValues = new Map();
		this.clickEventTimers = new Map();
		this.clickEventStates = new Map();
		this.pendingClickedTriggers = new Map();
		this.pendingReleasedTriggers = new Map();
		this.pendingAdvancedClickActions = new Map();
		this.pendingAdvancedClickFallbackTimers = new Map();
		this.releaseSuppressions = new Map();
		this.clickedSuppressions = new Map();
		this.pendingAdvancedLongReleaseCommits = new Map();
		this.longPressHeartbeatAt = new Map();
		this.advancedLongSyntheticTickTimers = new Map();
		this.advancedLastClickProcessedAt = new Map();
		this.pickerPendingValues = new Map();
		this.pickerCommitTimers = new Map();
		this.advancedPendingValues = new Map();
		this.advancedCommitTimers = new Map();
		this.advancedDirectionStates = new Map();
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

	/**
	 * Initialize hardware communication with the physical device.
	 * Reads device configuration (firmware version, connectors) and uploads current panel settings.
	 * Sets up MQTT subscriptions for button events and sensor readings.
	 * Called on startup and when device becomes available after disconnect.
	 */
	// ========== HARDWARE INITIALIZATION ==========
	// Initialize and maintain device connection, fetch firmware version, upload configuration

	/**
	 * Initialize hardware communication with the physical device.
	 * Reads device configuration (firmware version, connectors) and uploads current panel settings.
	 * Sets up MQTT subscriptions for button events and sensor readings.
	 * Called on startup and when device becomes available after disconnect.
	 */
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

	/**
	 * Subscribe to MQTT topics for this button device's events.
	 * Brokers map to dedicated MQTT clients; retries if broker not ready.
	 * Topics:
	 *   buttonplus/{id}/page/state - panel's current page changes
	 *   buttonplus/{id}/sensor/1,2,3,4,5 - temperature, light, humidity, pressure, sound
	 *   buttonplus/{id}/brightness/* - hardware brightness level updates
	 */
	// ========== MQTT COMMUNICATION ==========
	// Subscribe to device topics, process incoming messages, publish state updates

	/**
	 * Subscribe to MQTT topics for this button device's events.
	 * Brokers map to dedicated MQTT clients; retries if broker not ready.
	 * Topics subscribed:
	 *   buttonplus/{id}/page/state - panel's current display page
	 *   buttonplus/{id}/sensor/1-5 - temperature, luminance, humidity, pressure, sound
	 *   buttonplus/{id}/button/{btn}-{page}/label/set - text label updates
	 */
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

	/**
	 * Capability listener for dim level changes.
	 * Publishes new brightness to MQTT so the physical device updates its display/LED brightness.
	 * When change originates from MQTT (opts.mqtt=true), skip loopback to avoid echoes.
	 */
	// ========== CAPABILITY LISTENERS ==========
	// Handle Homey capability changes: dim level, button presses, page navigation, configuration selection

	/**
	 * Capability listener for dim level changes.
	 * Publishes new brightness to MQTT so the physical device updates its display/LED brightness.
	 * When change originates from MQTT (opts.mqtt=true), skip loopback to avoid echoes.
	 */
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
	// ========== DEVICE LIFECYCLE ==========
	// Handle device added, deleted, renamed, settings changed, repaired

	/**
	 * onAdded is called when the user adds the device, called just after pairing.
	 * Initializes default dim level and calls parent handler.
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
		if (this.longPressLastProcessedAt)
		{
			this.longPressLastProcessedAt.clear();
		}
		if (this.lastLongPressTimes)
		{
			this.lastLongPressTimes.clear();
		}
		if (this.buttonValues)
		{
			this.buttonValues.clear();
		}
		if (this.lastPhysicalClickAt)
		{
			this.lastPhysicalClickAt.clear();
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
		if (this.clickEventStates)
		{
			this.clickEventStates.clear();
		}
		if (this.pendingClickedTriggers)
		{
			this.pendingClickedTriggers.clear();
		}
		if (this.pendingReleasedTriggers)
		{
			this.pendingReleasedTriggers.clear();
		}
		if (this.pendingAdvancedClickActions)
		{
			this.pendingAdvancedClickActions.clear();
		}
		if (this.pendingAdvancedClickFallbackTimers)
		{
			for (const timer of this.pendingAdvancedClickFallbackTimers.values())
			{
				this.homey.clearTimeout(timer);
			}
			this.pendingAdvancedClickFallbackTimers.clear();
		}
		if (this.releaseSuppressions)
		{
			this.releaseSuppressions.clear();
		}
		if (this.clickedSuppressions)
		{
			this.clickedSuppressions.clear();
		}
		if (this.pendingAdvancedLongReleaseCommits)
		{
			this.pendingAdvancedLongReleaseCommits.clear();
		}
		if (this.longPressHeartbeatAt)
		{
			this.longPressHeartbeatAt.clear();
		}
		if (this.advancedLongSyntheticTickTimers)
		{
			for (const timer of this.advancedLongSyntheticTickTimers.values())
			{
				this.homey.clearTimeout(timer);
			}
			this.advancedLongSyntheticTickTimers.clear();
		}
		if (this.advancedLastClickProcessedAt)
		{
			this.advancedLastClickProcessedAt.clear();
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
		if (this.advancedCommitTimers)
		{
			for (const timer of this.advancedCommitTimers.values())
			{
				this.homey.clearTimeout(timer);
			}
			this.advancedCommitTimers.clear();
		}
		if (this.advancedPendingValues)
		{
			this.advancedPendingValues.clear();
		}
		if (this.advancedDirectionStates)
		{
			this.advancedDirectionStates.clear();
		}

		await super.onDeleted();
		this.log('PanelDevice has been deleted');
	}

	/**
	 * Process physical MQTT brightness control messages from the device.
	 * The device may publish brightness changes from its own UI.
	 */
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

	/**
	 * Get the MQTT broker ID and button index for a given side, connector, and page.
	 * Returns an object with 'brokerId' and 'buttonIdx'.
	 */
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

	/**
	 * Find the button connector that is using the given configuration number.
	 * Returns the connector index (0-7) or throws an error if not found.
	 */
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


	/**
	 * Update date and time capability values based on device timezone and locale settings.
	 * Respects user's chosen weekday/date/month/year/time format and language code.
	 */
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

	/**
	 * Update the device status bar (separator between display and buttons).
	 * Only applies to firmware >= 1.09.0.
	 */
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

	/**
	 * Set hardware brightness levels: large display, mini display, or LED brightness.
	 * Updates both the dim capability and MQTT topics for the device.
	 */
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

	/**
	 * Set LED color for a button (front/wall, on/off state).
	 * Front/wall distinction added in firmware 1.12.0; older firmware supports only 'both'.
	 */
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

	// ========== CONFIGURATION UPLOAD ==========
	// Upload device settings: button configs, display items, brightness, sensor topics, MQTT brokers

	/**
	 * Upload all panel configurations to the device.
	 * Reads device config, compares with desired state, writes differences, then sends MQTT messages.
	 * Handles retries with exponential backoff if device is unreachable.
	 */
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
			const originalDeviceConfigurations = _.cloneDeep(deviceConfigurations);

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

			const writableSectionKeys = ['core', 'buttons', 'displayitems', 'brokers', 'sensors'];
			const changedConfiguration = {};
			const changedSections = [];
			for (const sectionKey of writableSectionKeys)
			{
				if (!Object.prototype.hasOwnProperty.call(deviceConfigurations, sectionKey))
				{
					continue;
				}

				const currentSection = deviceConfigurations[sectionKey];
				const originalSection = originalDeviceConfigurations ? originalDeviceConfigurations[sectionKey] : undefined;
				if (!this.compareObjects(currentSection, originalSection, false))
				{
					const mismatch = this.findFirstDifference(currentSection, originalSection);
					if (mismatch)
					{
						this.homey.app.updateLog(`Configuration mismatch ${sectionKey} at ${mismatch.path}: desired=${this.homey.app.varToString(mismatch.left)} readback=${this.homey.app.varToString(mismatch.right)}`);
					}

					changedConfiguration[sectionKey] = currentSection;
					changedSections.push(sectionKey);
				}
			}

			const hasConfigurationChanges = changedSections.length > 0;

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

			if (hasConfigurationChanges)
			{
				this.homey.app.updateLog(`Configuration sections changed for ${this.ip}: ${changedSections.join(', ')}`);

				while (tries > 0)
				{
					error = await this.homey.app.writeDeviceConfiguration(this.ip, changedConfiguration, this.firmwareVersion)
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
			}
			else
			{
				this.homey.app.updateLog(`Skipping hardware configuration write for ${this.ip}; panel configuration already matches`);

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
				await this.setupMQTTSubscriptions('Default');
			}

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
		const isLightColorComponent = capabilityName === 'light_hue' || capabilityName === 'light_saturation';
		const key = isLightColorComponent
			? `${targetDeviceId}::light_hue_saturation`
			: `${targetDeviceId}::${capabilityName}`;

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
			if (isLightColorComponent)
			{
				const hueCapability = await this.homey.app.getHomeyCapabilityByName(device, 'light_hue');
				const saturationCapability = await this.homey.app.getHomeyCapabilityByName(device, 'light_saturation');

				const sanitizePairValue = (rawValue, fallbackValue = 0) =>
				{
					let numericValue = Number(rawValue);
					if (!Number.isFinite(numericValue))
					{
						numericValue = Number(fallbackValue);
					}

					if (!Number.isFinite(numericValue))
					{
						numericValue = 0;
					}

					numericValue = Math.max(0, Math.min(1, numericValue));
					return Math.round(numericValue * 1000) / 1000;
				};

				const currentHue = hueCapability ? hueCapability.value : undefined;
				const currentSaturation = saturationCapability ? saturationCapability.value : undefined;
				const hsPair = {
					light_hue: sanitizePairValue(capabilityName === 'light_hue' ? value : currentHue, currentHue),
					light_saturation: sanitizePairValue(capabilityName === 'light_saturation' ? value : currentSaturation, currentSaturation),
				};

				if (!Number.isFinite(Number(hsPair.light_hue)) || !Number.isFinite(Number(hsPair.light_saturation)))
				{
					this.homey.app.updateLog(`Skipping non-numeric ${capabilityName} write for ${targetDeviceId}: ${value}`, 0);
					return false;
				}

				let wrotePair = false;
				const transactionId = `button-plus-hs-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
				const transactionTime = Date.now();

				// Try object/pair-style APIs first; fallback gracefully for devices that only
				// support single capability updates.
				if (typeof device.setCapabilityValues === 'function')
				{
					try
					{
						await device.setCapabilityValues(hsPair);
						wrotePair = true;
					}
					catch (error)
					{
						this.homey.app.updateLog(`setCapabilityValues pair write failed for ${targetDeviceId}: ${error.message}`, 1);
					}
				}

				if (!wrotePair && (typeof device.setMultipleCapabilityValue === 'function'))
				{
					try
					{
						await device.setMultipleCapabilityValue(hsPair);
						wrotePair = true;
					}
					catch (error)
					{
						this.homey.app.updateLog(`setMultipleCapabilityValue pair write failed for ${targetDeviceId}: ${error.message}`, 1);
					}
				}

				if (!wrotePair)
				{
					try
					{
						await Promise.all([
							device.setCapabilityValue({
								capabilityId: 'light_hue',
								value: hsPair.light_hue,
								transactionId,
								transactionTime,
							}),
							device.setCapabilityValue({
								capabilityId: 'light_saturation',
								value: hsPair.light_saturation,
								transactionId,
								transactionTime,
							}),
						]);
						wrotePair = true;
					}
					catch (error)
					{
						this.homey.app.updateLog(`Object option pair write failed for ${targetDeviceId}: ${error.message}`, 1);
					}
				}

				if (!wrotePair)
				{
					// Last-resort legacy path.
					await Promise.all([
						device.setCapabilityValue('light_hue', hsPair.light_hue),
						device.setCapabilityValue('light_saturation', hsPair.light_saturation),
					]);
				}
			}
			else
			{
				await device.setCapabilityValue(capabilityName, value);
			}
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

	/**
	 * Process core/sensor MQTT messages (page state, temperature, luminance, etc).
	 * These are status messages, not button events.
	 */
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

	// ========== BUTTON EVENT PROCESSING ==========
	// Core state machines for click/longpress/release events with timing and debouncing

	/**
	 * Main button event processor. Entry point for all physical button presses.
	 * Routes to click/longpress/release handlers with proper state tracking.
	 *
	 * Event flow:
	 *  - Click: defer ~350ms to check for double-click, then fire single-click or queue for resolution
	 *  - Longpress: start repeating fire, buffer value changes until release
	 *  - Release: commit buffered values, fire released trigger, clear long-press state
	 *
	 * State machines track:
	 *  - Click count and timing for double-click detection
	 *  - Long-press repetition count and last heartbeat
	 *  - Pending value commits (debounced device writes)
	 *  - Release suppressions (to avoid duplicate events)
	 */
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

		// Normalize page before creating per-button state keys so click/long/release share the same key.
		if ((parameters.configNo != null) && (parameters.connectorType !== 2) && (parameters.connectorType !== 3))
		{
			const lookupPage = (parameters.page == null) ? 0 : parameters.page;
			const mappedConfig = this.getConfigPageSide(null, lookupPage, parameters.side, parameters.configNo);
			if (mappedConfig)
			{
				const mappedPage = parseInt(mappedConfig.page, 10);
				if (!Number.isNaN(mappedPage))
				{
					parameters.page = mappedPage;
				}
			}
		}

		// Now process the message
		if (MQTTMessage.event === 'click')
		{
			this.homey.app.updateLog(`Panel processing MQTT message: ${MQTTMessage.event}`);
			const longPressKey = `${parameters.connector}_${parameters.side}_${parameters.page}`;
			this.homey.app.updateLog(`TIMING click ts=${new Date().toISOString()} ms=${Date.now()} key=${longPressKey} configNo=${parameters.configNo} page=${parameters.page}`, 0);

			// Some firmware/message paths can emit duplicated click events for one physical press.
			// Ignore near-immediate duplicates so single presses cannot toggle twice.
			const now = Date.now();
			const lastClickAt = this.lastPhysicalClickAt.get(longPressKey) || 0;
			if ((now - lastClickAt) < DUPLICATE_CLICK_DEBOUNCE_MS)
			{
				this.homey.app.updateLog(`Ignoring duplicate physical click for ${longPressKey} (${now - lastClickAt}ms apart)`, 1);
				return;
			}

			this.lastPhysicalClickAt.set(longPressKey, now);
			// A new physical click starts a fresh cycle; clear any stale suppression state
			// left over from a previous incomplete/aborted cycle.
			this.releaseSuppressions.delete(longPressKey);
			this.clickedSuppressions.delete(longPressKey);
			this.longPressOccurred.set(longPressKey, 0);
			this.longPressEventCounts.delete(longPressKey);
			this.longPressLastProcessedAt.delete(longPressKey);
			this.lastLongPressTimes.delete(longPressKey);
			this.longPressHeartbeatAt.delete(longPressKey);
			this.cancelAdvancedLongSyntheticTick(longPressKey);
			this.pendingAdvancedLongReleaseCommits.delete(longPressKey);

			// The button was pressed
			const clickResult = await this.handleButtonClick(parameters);
			if (!(clickResult && clickResult.suppressGenericClick))
			{
				const clickedFire = () => this.homey.app.triggerButtonEvent(this, parameters.side, parameters.connector, 'clicked', parameters.value, parameters.value.toString(), 0);
				if (this.isWaitingForClickResolution(longPressKey))
				{
					this.queueClickedTrigger(longPressKey, clickedFire);
				}
				else
				{
					clickedFire();
				}
			}
		}
		else if (MQTTMessage.event === 'longpress')
		{
			// The button has been pressed for a long time or a repeat
			await this.processLongPressMessage(parameters);
		}
		else if (MQTTMessage.event === 'release')
		{
			this.homey.app.updateLog(`Panel processing MQTT message: ${MQTTMessage.event}`);
			const releaseKey = `${parameters.connector}_${parameters.side}_${parameters.page}`;
			this.homey.app.updateLog(`TIMING release ts=${new Date().toISOString()} ms=${Date.now()} key=${releaseKey} configNo=${parameters.configNo} page=${parameters.page}`, 0);

			// The button has been released; button_event's 'released' trigger is queued from within
			// processReleaseMessage itself so it can be discarded there if this turns into a double click
			await this.processReleaseMessage(parameters);
		}
	}

	// ========== CONFIGURATION RESOLUTION ==========
	// Resolve button configuration, connector type, and advanced event bindings

	/**
	 * Resolve the config object for a button based on its page and side.
	 * For display connectors, returns null. For button connectors, maps to the assigned config.
	 */
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

	// ========== DIM BUTTON HANDLING ==========
	// Specialized logic for brightness control buttons (dim capability)

	/**
	 * Check if a config represents a dim button (adjusts brightness).
	 * Dim buttons have independent direction state and LED control.
	 */
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

	getConfiguredLongPressRepeatMs(parameters)
	{
		if ((parameters.configNo == null) || (parameters.connectorType === 2) || (parameters.connectorType === 3))
		{
			return 500;
		}

		const buttonPanelConfiguration = this.homey.app.buttonConfigurations[parameters.configNo];
		const buttonPageConfiguration = buttonPanelConfiguration ? (buttonPanelConfiguration[parameters.page] || buttonPanelConfiguration[0] || {}) : {};
		const configuredRepeat = parseInt(buttonPageConfiguration[`${parameters.side}LongRepeatMs`], 10);

		return Number.isNaN(configuredRepeat) ? 500 : Math.max(50, Math.min(configuredRepeat, 10000));
	}

	// ========== STATE MANAGEMENT & TIMING ==========
	// Manage button state timers, debouncing, suppression, and event sequencing

	/**
	 * Detect single vs double click within 350ms window.
	 * Uses timed state machine to defer single-click trigger until double-click window closes.
	 * Returns context object indicating whether double/long clicks are configured.
	 */
	getEventTimingContext(parameters)
	{
		const sideConfig = this.resolveAdvancedSideConfig(parameters);
		const side = parameters && parameters.side ? parameters.side : 'left';
		const mode = String((sideConfig && sideConfig[`${side}Mode`]) || 'basic').toLowerCase();
		const simpleMode = mode !== 'advanced';

		if (simpleMode)
		{
			return {
				simpleMode: true,
				doubleClickDefined: false,
				longPressDefined: false,
			};
		}

		return {
			simpleMode: false,
			doubleClickDefined: !!this.resolveAdvancedEventBinding(parameters, 'double'),
			longPressDefined: !!this.resolveAdvancedEventBinding(parameters, 'long'),
		};
	}

	isWaitingForClickResolution(key)
	{
		return this.pendingAdvancedClickActions.has(key)
			|| this.pendingAdvancedClickFallbackTimers.has(key)
			|| this.clickEventTimers.has(key);
	}

	incrementSuppression(map, key)
	{
		if (!map || !key)
		{
			return;
		}

		map.set(key, (map.get(key) || 0) + 1);
	}

	consumeSuppression(map, key)
	{
		if (!map || !key)
		{
			return false;
		}

		const remaining = map.get(key) || 0;
		if (remaining <= 0)
		{
			return false;
		}

		if (remaining === 1)
		{
			map.delete(key);
		}
		else
		{
			map.set(key, remaining - 1);
		}

		return true;
	}

	async triggerAdvancedMappedConfigClicked(parameters)
	{
		if (parameters.configNo == null)
		{
			return;
		}

		const flowParameters = _.cloneDeep(parameters);
		const config = this.resolveConnectorConfig(flowParameters);
		const rawValue = this.buttonValues.get(`${flowParameters.side}_${flowParameters.connector}_${flowParameters.page}`);
		const flowBooleanValue = (typeof rawValue === 'boolean')
			? rawValue
			: ((typeof flowParameters.value === 'boolean') ? flowParameters.value : false);
		const fallbackState = typeof rawValue === 'boolean' ? rawValue : false;
		const buttonState = await this.getConfigLedButtonState(config, fallbackState);
		const displayValue = (rawValue === null || rawValue === undefined) ? String(flowBooleanValue) : String(rawValue);

		this.homey.app.triggerConfigButton(this, flowParameters.side, flowParameters.connectorType, flowParameters.configNo, 'clicked', buttonState, displayValue, flowParameters.page);
	}

	async triggerAdvancedMappedConfigLong(parameters, repeatCount = 0)
	{
		if (parameters.configNo == null)
		{
			return;
		}

		const flowParameters = _.cloneDeep(parameters);
		const config = this.resolveConnectorConfig(flowParameters);
		const rawValue = this.buttonValues.get(`${flowParameters.side}_${flowParameters.connector}_${flowParameters.page}`);
		const flowBooleanValue = (typeof rawValue === 'boolean')
			? rawValue
			: ((typeof flowParameters.value === 'boolean') ? flowParameters.value : false);
		const fallbackState = typeof rawValue === 'boolean' ? rawValue : false;
		const buttonState = await this.getConfigLedButtonState(config, fallbackState);
		const displayValue = (rawValue === null || rawValue === undefined) ? String(flowBooleanValue) : String(rawValue);

		this.homey.app.triggerConfigButton(this, flowParameters.side, flowParameters.connectorType, flowParameters.configNo, 'long', buttonState, displayValue, flowParameters.page, repeatCount);
	}

	async executeSingleClickAction(parameters)
	{
		if (await this.runAdvancedEventMapping(parameters, 'click'))
		{
			await this.triggerAdvancedMappedConfigClicked(parameters);
			if (parameters.fromButton && ((parameters.page === 0) || (this.page === parameters.page)))
			{
				setImmediate(() => this.safeSetCapabilityValue(parameters.buttonCapability, false));
			}
			return null;
		}

		return this.processClickMessage(parameters);
	}

	/**
	 * Clear pending single/double-click timers and queued triggers.
	 * Called when transitioning to a different event (e.g., double-click detected).
	 */
	clearClickResolutionTimers(key)
	{
		this.clearPendingAdvancedClickFallbackTimer(key);

		const pendingDoubleTimer = this.clickEventTimers.get(key);
		if (pendingDoubleTimer)
		{
			this.homey.clearTimeout(pendingDoubleTimer);
			this.clickEventTimers.delete(key);
		}
	}

	/**
	 * Arm timers to detect single vs double click.
	 * Single-click fires after 350ms if no second click arrives.
	 * Double-click timer cleared if second click arrives within window.
	 */
	armClickResolutionTimers(parameters, key, timingContext)
	{
		this.clearPendingAdvancedClickFallbackTimer(key);

		const clickTimeoutMs = DOUBLE_CLICK_WINDOW_MS;

		const resolveSingleClick = async () =>
		{
			const currentState = this.clickEventStates.get(key);
			if (currentState && currentState.waitingForRelease)
			{
				const retryTimer = this.homey.setTimeout(() =>
				{
					resolveSingleClick().catch((err) => this.error(err));
				}, 50);
				this.pendingAdvancedClickFallbackTimers.set(key, retryTimer);
				return;
			}

			this.clearClickResolutionTimers(key);
			await this.firePendingSingleClickTriggers(key);
			this.clickEventStates.delete(key);
		};

		const clickTimer = this.homey.setTimeout(() =>
		{
			resolveSingleClick().catch((err) => this.error(err));
		}, clickTimeoutMs);

		this.pendingAdvancedClickFallbackTimers.set(key, clickTimer);

		if (timingContext.doubleClickDefined)
		{
			const doubleTimer = this.homey.setTimeout(() =>
			{
				this.clickEventTimers.delete(key);
			}, DOUBLE_CLICK_WINDOW_MS);

			this.clickEventTimers.set(key, doubleTimer);
		}
	}

	getAdvancedCommitDelayMs(parameters)
	{
		const longDelay = this.getConfiguredLongPressDelayMs(parameters);
		const longRepeat = this.getConfiguredLongPressRepeatMs(parameters);
		return Math.max(500, longDelay + longRepeat + 2000);
	}

	cancelAdvancedLongSyntheticTick(key)
	{
		if (!this.advancedLongSyntheticTickTimers)
		{
			return;
		}

		const timer = this.advancedLongSyntheticTickTimers.get(key);
		if (timer)
		{
			this.homey.clearTimeout(timer);
		}

		this.advancedLongSyntheticTickTimers.delete(key);
	}

	/**
	 * Arm synthetic tick timer for long-press repeat events.
	 * Fires updates at 500ms intervals (or configured repeat rate) while button is held.
	 * Respects firmware heartbeat to avoid duplicate events during device lag.
	 */
	armAdvancedLongSyntheticTick(parameters, key, repeatIntervalMs)
	{
		if (!this.advancedLongSyntheticTickTimers)
		{
			return;
		}

		this.cancelAdvancedLongSyntheticTick(key);

		const scheduleNext = () =>
		{
			const timer = this.homey.setTimeout(async () =>
			{
				this.advancedLongSyntheticTickTimers.delete(key);

				const repeatCount = this.longPressOccurred ? (this.longPressOccurred.get(key) || 0) : 0;
				if (repeatCount <= 0)
				{
					return;
				}

				const now = Date.now();
				const heartbeatAt = this.longPressHeartbeatAt ? (this.longPressHeartbeatAt.get(key) || 0) : 0;
				const heartbeatGraceMs = Math.max(150, Math.floor(repeatIntervalMs * 1.25));
				const isFirmwareQuiet = (now - heartbeatAt) > heartbeatGraceMs;
				if (!isFirmwareQuiet)
				{
					scheduleNext();
					return;
				}

				const lastProcessedAt = this.longPressLastProcessedAt ? (this.longPressLastProcessedAt.get(key) || 0) : 0;
				if ((now - lastProcessedAt) < repeatIntervalMs)
				{
					scheduleNext();
					return;
				}

				this.longPressLastProcessedAt.set(key, now);

				try
				{
					if (await this.runAdvancedEventMapping(parameters, 'long'))
					{
						if ((parameters.page === 0) || (this.page === parameters.page))
						{
							this.safeSetCapabilityValue(`${parameters.side}_button.connector${parameters.connector}`, false);
						}
					}

					const currentCount = this.longPressOccurred.get(key) || 0;
					if (currentCount > 0)
					{
						this.longPressOccurred.set(key, currentCount + 1);
					}
				}
				catch (err)
				{
					this.error(err);
				}

				scheduleNext();
			}, repeatIntervalMs);

			this.advancedLongSyntheticTickTimers.set(key, timer);
		};

		scheduleNext();
	}

	getEventConfigNameForType(eventType)
	{
		switch (eventType)
		{
			case 'double': return 'Double';
			case 'long': return 'Long';
			case 'click':
			default:
				return 'Click';
		}
	}

	getNumericActionForValueType(rawValue, fallbackAction)
	{
		if (typeof rawValue === 'number')
		{
			return fallbackAction || 'change';
		}

		return 'change';
	}

	parseValueStep(rawStep, defaultValue = 10)
	{
		const parsedStep = Number(rawStep);
		if (!Number.isFinite(parsedStep) || parsedStep === 0)
		{
			return defaultValue;
		}

		return parsedStep;
	}

	/**
	 * Format brightness (dim) as percentage with current adjustment direction indicator (+ or -).
	 */
	formatDimPercentageValue(rawValue)
	{
		const numericValue = Number(rawValue);
		const clampedValue = Number.isFinite(numericValue) ? Math.max(0, Math.min(1, numericValue)) : 0;
		return `${Math.round(clampedValue * 100)}%`;
	}

	/**
	 * Format window coverings set position as percentage (handles 0-1 and 0-100 ranges).
	 */
	formatWindowCoveringsSetPercentage(rawValue)
	{
		const numericValue = Number(rawValue);
		if (!Number.isFinite(numericValue))
		{
			return '';
		}

		if (numericValue >= 0 && numericValue <= 1)
		{
			return `${Math.round(numericValue * 100)}%`;
		}

		if (numericValue >= 0 && numericValue <= 100)
		{
			return `${Math.round(numericValue)}%`;
		}

		const clamped = Math.max(0, Math.min(1, numericValue));
		return `${Math.round(clamped * 100)}%`;
	}

	/**
	 * Extract capability's unit text from 'unit' or 'units' property.
	 * Handles both string (e.g., '°C') and localized object (e.g., { en: '°C', nl: '°C' }).
	 */
	getCapabilityUnitText(capability)
	{
		if (!capability)
		{
			return '';
		}

		const rawUnit = capability.units || capability.unit || '';
		if (typeof rawUnit === 'string')
		{
			return rawUnit.trim();
		}

		if (rawUnit && typeof rawUnit === 'object')
		{
			if (typeof rawUnit.en === 'string' && rawUnit.en.trim())
			{
				return rawUnit.en.trim();
			}

			for (const value of Object.values(rawUnit))
			{
				if (typeof value === 'string' && value.trim())
				{
					return value.trim();
				}
			}
		}

		return '';
	}

	/**
	 * Format a numeric value with units for display.
	 * Rounds to 2 decimals and appends capability's unit string (°C, %, dB, etc).
	 */
	formatAdvancedNumberValue(rawValue, capability)
	{
		const numericValue = Number(rawValue);
		if (!Number.isFinite(numericValue))
		{
			return '';
		}

		const normalizedValue = Math.round(numericValue * 100) / 100;
		const numberText = Number.isInteger(normalizedValue)
			? String(normalizedValue)
			: String(normalizedValue);
		const unitText = this.getCapabilityUnitText(capability);
		if (!unitText)
		{
			return numberText;
		}

		if (unitText.startsWith(' '))
		{
			return `${numberText}${unitText}`;
		}

		return `${numberText} ${unitText}`;
	}

	/**
	 * Determine whether to show a direction indicator (+ or -) for this numeric binding.
	 * True if any click/long/double action uses setPlus/setMinus/toggleDirection on the same capability.
	 */
	shouldShowAdvancedDirectionIndicator(parameters, binding, capability)
	{
		if (!parameters || !binding || !capability || capability.type !== 'number' || binding.capabilityName === 'dim')
		{
			return false;
		}

		for (const eventType of ['click', 'double', 'long'])
		{
			const eventBinding = this.resolveAdvancedEventBinding(parameters, eventType);
			if (!eventBinding)
			{
				continue;
			}

			if (eventBinding.deviceID !== binding.deviceID || eventBinding.capabilityName !== binding.capabilityName)
			{
				continue;
			}

			const action = eventBinding.numericAction || 'change';
			if (action === 'change' || action === 'setPlus' || action === 'setMinus' || action === 'toggleDirection')
			{
				return true;
			}
		}

		return false;
	}

	getAdvancedDirectionKey(parameters)
	{
		return `${parameters.connector}_${parameters.side}`;
	}

	// ========== DIRECTION STATE ==========
	// Track direction for numeric adjustments (dim, window coverings, etc.)

	/**
	 * Get stored direction for a button (+ or -).
	 * Defaults to + unless previously set or specified in config.
	 */
	getAdvancedDirection(parameters)
	{
		const key = this.getAdvancedDirectionKey(parameters);
		const existing = this.advancedDirectionStates.get(key);
		return existing === '-' ? '-' : '+';
	}

	setAdvancedDirection(parameters, direction)
	{
		const key = this.getAdvancedDirectionKey(parameters);
		this.advancedDirectionStates.set(key, direction === '-' ? '-' : '+');
	}

	/**
	 * Toggle direction state for numeric adjustments.
	 * Used by 'toggleDirection' action to alternate + and - on repeated presses.
	 */
	toggleAdvancedDirection(parameters)
	{
		const nextDirection = this.getAdvancedDirection(parameters) === '+' ? '-' : '+';
		this.setAdvancedDirection(parameters, nextDirection);
		return nextDirection;
	}

	/**
	 * Clamp numeric value to min/max range and auto-flip direction at boundaries.
	 * Used to toggle direction automatically when dim/brightness reaches 0% or 100%.
	 */
	applyAdvancedDirectionAtBounds(parameters, value, minValue, maxValue)
	{
		const numericValue = Number(value);
		const min = Number(minValue);
		const max = Number(maxValue);
		if (!Number.isFinite(numericValue) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min)
		{
			return;
		}

		const epsilon = Math.max(1e-6, Math.abs(max - min) * 0.001);
		if (numericValue >= (max - epsilon))
		{
			this.setAdvancedDirection(parameters, '-');
		}
		else if (numericValue <= (min + epsilon))
		{
			this.setAdvancedDirection(parameters, '+');
		}
	}

	resolveAdvancedSideConfig(parameters)
	{
		if ((parameters.configNo == null) || (parameters.connectorType === 2) || (parameters.connectorType === 3))
		{
			return null;
		}

		const pageSideConfig = this.getConfigPageSide(null, parameters.page, parameters.side, parameters.configNo);
		return pageSideConfig && pageSideConfig.raw ? pageSideConfig.raw : null;
	}

	/**
	 * Resolve the action binding for a specific event (click/long/double).
	 * Returns device/capability pair, action type, and step size if numeric.
	 * Returns null if event is not configured or binding is incomplete.
	 */
	resolveAdvancedEventBinding(parameters, eventType)
	{
		const sideConfig = this.resolveAdvancedSideConfig(parameters);
		if (!sideConfig)
		{
			return null;
		}

		const side = parameters.side;
		const mode = String(sideConfig[`${side}Mode`] || 'basic').toLowerCase();
		if (mode !== 'advanced')
		{
			return null;
		}

		const eventName = this.getEventConfigNameForType(eventType);
		const deviceID = sideConfig[`${side}${eventName}Device`] || 'none';
		const capabilityName = sideConfig[`${side}${eventName}Capability`] || '';
		const numericAction = sideConfig[`${side}${eventName}NumericAction`] || 'change';
		const rawStep = sideConfig[`${side}${eventName}ValueStep`] || '+10';
		const directionOnly = (numericAction === 'toggleDirection') && !capabilityName;

		if (!directionOnly && (!deviceID || deviceID === 'none' || !capabilityName))
		{
			return null;
		}

		const brokerId = sideConfig[`${side}BrokerId`] || sideConfig[`${side}brokerid`] || 'Default';
		return {
			deviceID,
			capabilityName,
			numericAction,
			directionOnly,
			valueStep: this.parseValueStep(rawStep, 10),
			brokerId,
			eventName,
		};
	}

	queueAdvancedLongReleaseCommit(parameters, binding, valueToCommit)
	{
		if (!parameters || !binding)
		{
			return;
		}

		const key = this.getButtonStateKey(parameters.connector, parameters.side, parameters.page);
		this.pendingAdvancedLongReleaseCommits.set(key, {
			deviceID: binding.deviceID,
			capabilityName: binding.capabilityName,
			valueToCommit,
		});
	}

	getQueuedAdvancedLongReleaseValue(parameters, binding)
	{
		if (!parameters || !binding)
		{
			return undefined;
		}

		const key = this.getButtonStateKey(parameters.connector, parameters.side, parameters.page);
		const pending = this.pendingAdvancedLongReleaseCommits.get(key);
		if (!pending)
		{
			return undefined;
		}

		if (pending.deviceID !== binding.deviceID || pending.capabilityName !== binding.capabilityName)
		{
			return undefined;
		}

		return pending.valueToCommit;
	}

	getPendingAdvancedDebounceValue(parameters, binding)
	{
		if (!parameters || !binding)
		{
			return undefined;
		}

		const commitKey = `${parameters.connector}_${parameters.side}_${parameters.page}_${binding.deviceID}_${binding.capabilityName}`;
		return this.advancedPendingValues.get(commitKey);
	}

	async flushAdvancedLongReleaseCommit(parameters)
	{
		if (!parameters)
		{
			return;
		}

		const key = this.getButtonStateKey(parameters.connector, parameters.side, parameters.page);
		await this.flushAdvancedLongReleaseCommitByKey(key, 'advanced:long:releaseCommit');
		await this.applyAdvancedDisplayBinding(parameters);
		await this.applyAdvancedLedBinding(parameters);
	}

	async flushAdvancedLongReleaseCommitFamily(connector, side, excludeKey)
	{
		if (connector === undefined || connector === null || !side)
		{
			return;
		}

		const prefix = `${connector}_${side}_`;
		const pendingKeys = Array.from(this.pendingAdvancedLongReleaseCommits.keys())
			.filter((key) => typeof key === 'string' && key.startsWith(prefix) && key !== excludeKey);

		for (const key of pendingKeys)
		{
			await this.flushAdvancedLongReleaseCommitByKey(key, 'advanced:long:releaseFamilyCommit');
		}
	}

	async flushAdvancedLongReleaseCommitByKey(key, sourceLabel)
	{
		if (!key)
		{
			return;
		}

		const pending = this.pendingAdvancedLongReleaseCommits.get(key);
		if (!pending)
		{
			return;
		}

		this.pendingAdvancedLongReleaseCommits.delete(key);

		if (!pending.deviceID || pending.deviceID === 'none' || pending.deviceID === '_variable_' || pending.deviceID === 'customMQTT' || !pending.capabilityName)
		{
			return;
		}

		const device = await this.homey.app.getHomeyDeviceById(pending.deviceID);
		if (!device)
		{
			return;
		}

		await this.guardedSetCapabilityValueOnDevice(device, pending.capabilityName, pending.valueToCommit, sourceLabel || 'advanced:long:releaseCommit');
	}

	/**
	 * Clear long-press tracking and commit any buffered values for a button release.
	 * Handles related keys (same button, different pages) to clean up shared state.
	 */
	async clearLongPressTrackingForRelease(connector, side, releaseKey)
	{
		const relatedKeys = new Set();
		if (releaseKey)
		{
			relatedKeys.add(releaseKey);
		}

		const prefix = `${connector}_${side}_`;
		if (this.longPressOccurred)
		{
			for (const key of this.longPressOccurred.keys())
			{
				if (typeof key === 'string' && key.startsWith(prefix))
				{
					relatedKeys.add(key);
				}
			}
		}

		for (const key of relatedKeys)
		{
			if (key !== releaseKey && this.pendingAdvancedLongReleaseCommits.has(key))
			{
				await this.flushAdvancedLongReleaseCommitByKey(key, 'advanced:long:relatedReleaseCommit');
			}

			if (this.longPressOccurred)
			{
				this.longPressOccurred.set(key, 0);
			}

			const clickState = this.clickEventStates.get(key);
			if (clickState)
			{
				clickState.longPressActive = false;
				if (!this.isWaitingForClickResolution(key) && (clickState.clickCount === 0))
				{
					this.clickEventStates.delete(key);
				}
				else
				{
					this.clickEventStates.set(key, clickState);
				}
			}

			this.longPressEventCounts.delete(key);
			this.longPressLastProcessedAt.delete(key);
			this.lastLongPressTimes.delete(key);
			this.longPressHeartbeatAt.delete(key);
			this.cancelAdvancedLongSyntheticTick(key);
			this.pendingAdvancedLongReleaseCommits.delete(key);
		}
	}

	getPendingAdvancedLongDisplayOverride(parameters, binding)
	{
		// Long-press changes are buffered until release. Use that pending value for
		// display feedback only when it belongs to the same device capability.
		if (!parameters || !binding)
		{
			return undefined;
		}

		const key = this.getButtonStateKey(parameters.connector, parameters.side, parameters.page);
		const pending = this.pendingAdvancedLongReleaseCommits.get(key);
		if (!pending)
		{
			return undefined;
		}

		if (pending.deviceID !== binding.deviceID || pending.capabilityName !== binding.capabilityName)
		{
			return undefined;
		}

		return pending.valueToCommit;
	}

	resolveAdvancedDisplayBinding(parameters)
	{
		// Display bindings are only meaningful for a button side configured in
		// advanced mode. Basic-mode rendering follows the legacy configuration path.
		const sideConfig = this.resolveAdvancedSideConfig(parameters);
		if (!sideConfig)
		{
			return null;
		}

		const side = parameters.side;
		const mode = String(sideConfig[`${side}Mode`] || 'basic').toLowerCase();
		if (mode !== 'advanced')
		{
			return null;
		}

		let deviceID = sideConfig[`${side}DisplayDevice`] || 'none';
		let capabilityName = sideConfig[`${side}DisplayCapability`] || '';

		// Older configurations stored one shared device/capability pair instead of
		// a dedicated display binding. Preserve that value when upgrading configs.
		if (!capabilityName)
		{
			const legacySideConfig = this.getConfigPageSide(null, parameters.page, side, parameters.configNo);
			if (legacySideConfig && legacySideConfig.deviceID && legacySideConfig.deviceID !== 'none' && legacySideConfig.capabilityName)
			{
				deviceID = legacySideConfig.deviceID;
				capabilityName = legacySideConfig.capabilityName;
				this.homey.app.updateLog(`ADVDBG displayBinding fallback: ${parameters.connector}/${parameters.side}/${parameters.page} using Legacy ${deviceID}/${capabilityName}`, 1);
			}
		}

		// If no display source was selected, mirror the first local Homey capability
		// used by an action. Variables and custom MQTT actions cannot be read here.
		if (!capabilityName)
		{
			for (const eventName of ['Click', 'Long', 'Double'])
			{
				const fallbackDeviceId = sideConfig[`${side}${eventName}Device`] || 'none';
				const fallbackCapabilityName = sideConfig[`${side}${eventName}Capability`] || '';
				if (!fallbackCapabilityName || fallbackDeviceId === 'none' || fallbackDeviceId === '_variable_' || fallbackDeviceId === 'customMQTT')
				{
					continue;
				}

				deviceID = fallbackDeviceId;
				capabilityName = fallbackCapabilityName;
				this.homey.app.updateLog(`ADVDBG displayBinding fallback: ${parameters.connector}/${parameters.side}/${parameters.page} using ${eventName} ${deviceID}/${capabilityName}`, 1);
				break;
			}
		}

		if (!deviceID || deviceID === 'none' || !capabilityName)
		{
			return null;
		}

		return {
			deviceID,
			capabilityName,
			booleanRender: sideConfig[`${side}DisplayBooleanRender`] || 'text',
			onText: sideConfig[`${side}OnText`] || '',
			offText: sideConfig[`${side}OffText`] || '',
			onSVG: normalizeSvgText(sideConfig[`${side}OnSVG`] || ''),
			offSVG: normalizeSvgText(sideConfig[`${side}OffSVG`] || ''),
			brokerId: sideConfig[`${side}BrokerId`] || sideConfig[`${side}brokerid`] || 'Default',
		};
	}

	resolveAdvancedLedBinding(parameters)
	{
		// LED state has its own binding and deliberately does not inherit the display
		// fallback chain: an unconfigured LED should retain its existing behaviour.
		const sideConfig = this.resolveAdvancedSideConfig(parameters);
		if (!sideConfig)
		{
			return null;
		}

		const side = parameters.side;
		const mode = String(sideConfig[`${side}Mode`] || 'basic').toLowerCase();
		if (mode !== 'advanced')
		{
			return null;
		}

		const deviceID = sideConfig[`${side}LedDevice`] || 'none';
		const capabilityName = sideConfig[`${side}LedCapability`] || '';
		if (!deviceID || deviceID === 'none' || !capabilityName)
		{
			return null;
		}

		const brokerId = sideConfig[`${side}BrokerId`] || sideConfig[`${side}brokerid`] || 'Default';
		return {
			deviceID,
			capabilityName,
			brokerId,
			frontLEDOnColor: sideConfig[`${side}FrontLEDOnColor`] || '#ff0000',
			wallLEDOnColor: sideConfig[`${side}WallLEDOnColor`] || '#ff0000',
			frontLEDOffColor: sideConfig[`${side}FrontLEDOffColor`] || '#000000',
			wallLEDOffColor: sideConfig[`${side}WallLEDOffColor`] || '#000000',
		};
	}

	// ========== DISPLAY & LED FEEDBACK ==========
	// Resolve and apply display text/SVG and LED color based on device state

	/**
	 * Resolve the current display value (text or SVG) for a binding.
	 * Uses overrideValue (preview during long-press) if provided, else reads device capability.
	 * Handles boolean (On/Off), enum (picker values), number (with units), and text display types.
	 */
	async resolveAdvancedDisplayValue(binding, overrideValue, parameters)
	{
		if (!binding)
		{
			return { textValue: null, svgValue: null };
		}

		// Homey Logic variables are resolved separately because they are not device
		// capabilities, but can still provide boolean, numeric, or text display data.
		if (binding.deviceID === '_variable_')
		{
			const variable = await this.homey.app.getVariable(binding.capabilityName);
			if (!variable)
			{
				return { textValue: '', svgValue: null };
			}

			if (variable.type === 'boolean')
			{
				const isOn = !!variable.value;
				if (binding.booleanRender === 'svg')
				{
					return { textValue: null, svgValue: isOn ? binding.onSVG : binding.offSVG };
				}
				return { textValue: isOn ? binding.onText : binding.offText, svgValue: null };
			}

			return { textValue: variable.value == null ? '' : String(variable.value), svgValue: null };
		}

		const device = await this.homey.app.getHomeyDeviceById(binding.deviceID);
		if (!device)
		{
			return { textValue: '', svgValue: null };
		}

		const capability = await this.homey.app.getHomeyCapabilityByName(device, binding.capabilityName);
		if (!capability)
		{
			return { textValue: '', svgValue: null };
		}

		// A preview/buffered value takes precedence over the last committed device
		// value so the panel reacts immediately while writes are being debounced.
		const effectiveValue = (overrideValue === undefined) ? capability.value : overrideValue;

		if (capability.type === 'boolean')
		{
			const isOn = !!effectiveValue;
			if (binding.booleanRender === 'svg')
			{
				return { textValue: null, svgValue: isOn ? binding.onSVG : binding.offSVG };
			}
			return { textValue: isOn ? binding.onText : binding.offText, svgValue: null };
		}

		if ((capability.type === 'enum') && Array.isArray(capability.values))
		{
			const match = capability.values.find((entry) => entry.id === effectiveValue);
			return { textValue: match ? (match.title || match.id) : ((effectiveValue == null) ? '' : String(effectiveValue)), svgValue: null };
		}

		if (binding.capabilityName === 'dim')
		{
			return { textValue: `${this.formatDimPercentageValue(effectiveValue)} ${this.getAdvancedDirection(parameters)}`, svgValue: null };
		}

		if (binding.capabilityName === 'windowcoverings_set')
		{
			return { textValue: `${this.formatWindowCoveringsSetPercentage(effectiveValue)} ${this.getAdvancedDirection(parameters)}`, svgValue: null };
		}

		if (capability.type === 'number')
		{
			let textValue = this.formatAdvancedNumberValue(effectiveValue, capability);
			if (this.shouldShowAdvancedDirectionIndicator(parameters, binding, capability))
			{
				textValue = `${textValue} ${this.getAdvancedDirection(parameters)}`;
			}
			return { textValue, svgValue: null };
		}

		return { textValue: effectiveValue == null ? '' : String(effectiveValue), svgValue: null };
	}

	/**
	 * Apply display binding to the panel: publish SVG or text label via MQTT.
	 * Called after each event and during long-press to provide live feedback.
	 * Reads device capability or pending buffered value to show current/preview state.
	 */
	async applyAdvancedDisplayBinding(parameters, overrideValue)
	{
		const binding = this.resolveAdvancedDisplayBinding(parameters);
		if (!binding)
		{
			this.homey.app.updateLog(`ADVDBG applyDisplay skip: ${parameters ? `${parameters.connector}/${parameters.side}/${parameters.page}` : 'unknown'}`, 1);
			return;
		}

		const pendingOverride = this.getPendingAdvancedLongDisplayOverride(parameters, binding);
		const effectiveOverride = (overrideValue === undefined) ? pendingOverride : overrideValue;
		const value = await this.resolveAdvancedDisplayValue(binding, effectiveOverride, parameters);
		const buttonIdx = parameters.connector * 2 + (parameters.side === 'left' ? 0 : 1) + 1;
		this.homey.app.updateLog(`ADVDBG applyDisplay ok: ${parameters.connector}/${parameters.side}/${parameters.page}, value=${value && value.textValue != null ? value.textValue : ''}, svg=${value && value.svgValue ? 'yes' : 'no'}, override=${effectiveOverride === undefined ? 'none' : effectiveOverride}`, 1);
		// The firmware renders either an SVG or a text label. Clear the unused field
		// to prevent stale content from a previous render mode remaining visible.
		if (value && value.svgValue)
		{
			this.homey.app.publishMQTTMessage(binding.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${parameters.page}/svg/set`, value.svgValue).catch((err) => this.error(err));
			this.homey.app.publishMQTTMessage(binding.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${parameters.page}/label/set`, '').catch(this.error);
		}
		else
		{
			this.homey.app.publishMQTTMessage(binding.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${parameters.page}/svg/set`, '').catch((err) => this.error(err));
			this.homey.app.publishMQTTMessage(binding.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${parameters.page}/label/set`, value && value.textValue != null ? value.textValue : '').catch(this.error);
		}
	}

	/**
	 * Apply live display preview during long-press adjustment.
	 * Shows preview value on panel before debounce commit to device.
	 * Used by numeric (dim, window coverings) and enum (picker) adjustments.
	 */
	// ========== DISPLAY PREVIEW & FALLBACK ==========
	// Show preview values during long-press adjustments

	/**
	 * Apply live display preview during long-press adjustment.
	 * Shows preview value on panel before debounce commit to device.
	 * Used by numeric (dim, window coverings) and enum (picker) adjustments.
	 */
	async applyAdvancedDisplayPreviewValue(parameters, eventBinding, capability, previewValue)
	{
		const displayBinding = this.resolveAdvancedDisplayBinding(parameters);
		if (!displayBinding)
		{
			return false;
		}

		if (displayBinding.deviceID !== eventBinding.deviceID || displayBinding.capabilityName !== eventBinding.capabilityName)
		{
			return false;
		}

		const buttonIdx = parameters.connector * 2 + (parameters.side === 'left' ? 0 : 1) + 1;
		if ((capability.type === 'boolean') && displayBinding.booleanRender === 'svg')
		{
			const svgValue = previewValue ? displayBinding.onSVG : displayBinding.offSVG;
			this.homey.app.publishMQTTMessage(displayBinding.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${parameters.page}/svg/set`, svgValue || '').catch((err) => this.error(err));
			this.homey.app.publishMQTTMessage(displayBinding.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${parameters.page}/label/set`, '').catch(this.error);
			return true;
		}

		let textValue = '';
		if ((capability.type === 'boolean') && displayBinding.booleanRender === 'text')
		{
			textValue = previewValue ? displayBinding.onText : displayBinding.offText;
		}
		else if ((capability.type === 'enum') && Array.isArray(capability.values))
		{
			const matched = capability.values.find((entry) => entry.id === previewValue);
			textValue = matched ? (matched.title || matched.id) : String(previewValue);
		}
		else
		{
			if (eventBinding.capabilityName === 'dim')
			{
				textValue = `${this.formatDimPercentageValue(previewValue)} ${this.getAdvancedDirection(parameters)}`;
			}
			else if (eventBinding.capabilityName === 'windowcoverings_set')
			{
				textValue = `${this.formatWindowCoveringsSetPercentage(previewValue)} ${this.getAdvancedDirection(parameters)}`;
			}
			else if (capability.type === 'number')
			{
				textValue = this.formatAdvancedNumberValue(previewValue, capability);
				textValue = `${textValue} ${this.getAdvancedDirection(parameters)}`;
			}
			else
			{
				textValue = (previewValue === null || previewValue === undefined) ? '' : String(previewValue);
			}
		}

		this.homey.app.publishMQTTMessage(displayBinding.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${parameters.page}/svg/set`, '').catch((err) => this.error(err));
		this.homey.app.publishMQTTMessage(displayBinding.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${parameters.page}/label/set`, textValue).catch(this.error);
		return true;
	}

	/**
	 * Apply fallback selection preview: show picker cycle in action button's display (not display binding).
	 * Useful when display binding is not configured but action displays the cycling value.
	 */
	/**
	 * Apply fallback selection preview: show picker cycle in action button's display (not display binding).
	 * Useful when display binding is not configured but action displays the cycling value.
	 */
	applyAdvancedFallbackSelectionPreview(parameters, eventBinding, capability, previewValue)
	{
		if (!parameters || !eventBinding || !capability)
		{
			return;
		}

		const buttonIdx = parameters.connector * 2 + (parameters.side === 'left' ? 0 : 1) + 1;
		let textValue = '';

		if ((capability.type === 'enum') && Array.isArray(capability.values))
		{
			const matched = capability.values.find((entry) => entry.id === previewValue);
			textValue = matched ? (matched.title || matched.id) : String(previewValue);
		}
		else if (capability.type === 'boolean')
		{
			textValue = previewValue ? 'On' : 'Off';
		}
		else
		{
			if (eventBinding.capabilityName === 'dim')
			{
				textValue = `${this.formatDimPercentageValue(previewValue)} ${this.getAdvancedDirection(parameters)}`;
			}
			else if (eventBinding.capabilityName === 'windowcoverings_set')
			{
				textValue = `${this.formatWindowCoveringsSetPercentage(previewValue)} ${this.getAdvancedDirection(parameters)}`;
			}
			else if (capability.type === 'number')
			{
				textValue = this.formatAdvancedNumberValue(previewValue, capability);
				textValue = `${textValue} ${this.getAdvancedDirection(parameters)}`;
			}
			else
			{
				textValue = (previewValue === null || previewValue === undefined) ? '' : String(previewValue);
			}
		}

		this.homey.app.publishMQTTMessage(eventBinding.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${parameters.page}/svg/set`, '').catch((err) => this.error(err));
		this.homey.app.publishMQTTMessage(eventBinding.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${parameters.page}/label/set`, textValue).catch(this.error);
	}

	/**
	 * Normalize numeric LED value to 0-1 range for device write.
	 * Handles 0-1 ranges, 0-100 percentage ranges, and arbitrary min/max from capability schema.
	 */
	normalizeLedLevel(rawValue, capability)
	{
		const numericValue = Number(rawValue);
		if (!Number.isFinite(numericValue))
		{
			return null;
		}

		const min = capability && Number.isFinite(Number(capability.min)) ? Number(capability.min) : null;
		const max = capability && Number.isFinite(Number(capability.max)) ? Number(capability.max) : null;
		if ((min !== null) && (max !== null) && (max > min))
		{
			return Math.max(0, Math.min(1, (numericValue - min) / (max - min)));
		}

		if (numericValue >= 0 && numericValue <= 1)
		{
			return numericValue;
		}

		if (numericValue >= 0 && numericValue <= 100)
		{
			return numericValue / 100;
		}

		return Math.max(0, Math.min(1, numericValue));
	}

	/**
	 * Resolve current value and normalize LED state (boolean, numeric 0-1, or fallback state).
	 * Handles variables, devices, and edge cases (unknown device, missing capability).
	 */
	async resolveLightColor(binding, override)
	{
		const device = await this.homey.app.getHomeyDeviceById(binding.deviceID);
		const hueCapability = device ? await this.homey.app.getHomeyCapabilityByName(device, 'light_hue') : null;
		const saturationCapability = device ? await this.homey.app.getHomeyCapabilityByName(device, 'light_saturation') : null;
		const hue = Number(override && override.capabilityName === 'light_hue' ? override.value : hueCapability && hueCapability.value);
		const saturation = Number(override && override.capabilityName === 'light_saturation' ? override.value : saturationCapability && saturationCapability.value);
		if (!Number.isFinite(hue) || !Number.isFinite(saturation))
		{
			return null;
		}

		const normalizedHue = Math.max(0, Math.min(1, hue));
		const normalizedSaturation = Math.max(0, Math.min(1, saturation));
		const segment = normalizedHue * 6;
		const index = Math.floor(segment);
		const fraction = segment - index;
		const chroma = normalizedSaturation;
		const match = 1 - chroma;
		const ascending = match + (chroma * fraction);
		const descending = 1 - (chroma * fraction);
		const channels = [
			[chroma, ascending, match],
			[descending, chroma, match],
			[match, chroma, ascending],
			[match, descending, chroma],
			[ascending, match, chroma],
			[chroma, match, descending],
		][index % 6];

		return `#${channels.map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0')).join('')}`;
	}

	async resolveLedBindingValue(binding)
	{
		if (!binding)
		{
			return false;
		}

		if (binding.deviceID === '_variable_')
		{
			const variable = await this.homey.app.getVariable(binding.capabilityName);
			if (!variable)
			{
				return false;
			}

			if (variable.type === 'boolean')
			{
				return !!variable.value;
			}

			if (variable.type === 'number')
			{
				const level = this.normalizeLedLevel(variable.value, null);
				return level === null ? false : level;
			}

			return false;
		}

		const device = await this.homey.app.getHomeyDeviceById(binding.deviceID);
		const capability = device ? await this.homey.app.getHomeyCapabilityByName(device, binding.capabilityName) : null;
		if (capability && (capability.type === 'boolean'))
		{
			return !!capability.value;
		}

		if (capability && (capability.type === 'number'))
		{
			const level = this.normalizeLedLevel(capability.value, capability);
			return level === null ? false : level;
		}

		const followState = await this.getCapabilityLedState(binding);
		return (followState === null) ? false : followState;
	}

	/**
	 * Apply LED binding: set button LED color based on device capability state.
	 * LED state is independent from display feedback.
	 */
	async applyAdvancedLedBinding(parameters, override)
	{
		const binding = this.resolveAdvancedLedBinding(parameters);
		if (!binding)
		{
			return;
		}

		const isLightColorBinding = binding.capabilityName === 'light_hue' || binding.capabilityName === 'light_saturation';
		const ledValue = isLightColorBinding ? true : await this.resolveLedBindingValue(binding);
		if (isLightColorBinding)
		{
			const lightColor = await this.resolveLightColor(binding, override);
			if (lightColor)
			{
				binding.frontLEDOnColor = lightColor;
				binding.wallLEDOnColor = lightColor;
				binding.frontLEDOffColor = '#000000';
				binding.wallLEDOffColor = '#000000';
			}
		}

		const buttonIdx = parameters.connector * 2 + (parameters.side === 'left' ? 0 : 1) + 1;
		this.setLEDOnOff(binding, null, buttonIdx, parameters.page, ledValue);
	}

	/**
	 * Queue a capability write to be committed after long-press delay + repeat interval.
	 * Prevents rapid writes during long-press adjustment (e.g., dimming).
	 * Pending value shown on display immediately via preview, but device write is deferred.
	 */
	async commitAdvancedValueWithDebounce(parameters, binding, device, capabilityName, valueToCommit)
	{
		const commitKey = `${parameters.connector}_${parameters.side}_${parameters.page}_${binding.deviceID}_${capabilityName}`;
		this.advancedPendingValues.set(commitKey, valueToCommit);

		const existingTimer = this.advancedCommitTimers.get(commitKey);
		if (existingTimer)
		{
			this.homey.clearTimeout(existingTimer);
		}

		const commitDelayMs = this.getAdvancedCommitDelayMs(parameters);
		const timer = this.homey.setTimeout(() =>
		{
			this.advancedCommitTimers.delete(commitKey);
			const pendingValue = this.advancedPendingValues.get(commitKey);
			this.advancedPendingValues.delete(commitKey);
			if (pendingValue === undefined)
			{
				return;
			}

			this.guardedSetCapabilityValueOnDevice(device, capabilityName, pendingValue, 'advanced:commit').catch((err) => this.error(err));
		}, commitDelayMs);

		this.advancedCommitTimers.set(commitKey, timer);
	}

	/**
	 * Execute an advanced event action (click/long/double).
	 * Resolves binding, applies action (toggle/cycle/adjust), updates display feedback.
	 * For long presses, buffers value changes until release to avoid flickering writes.
	 * Returns true if handled, false if no binding configured.
	 */
	async runAdvancedEventMapping(parameters, eventType)
	{
		const binding = this.resolveAdvancedEventBinding(parameters, eventType);
		if (!binding)
		{
			this.homey.app.updateLog(`ADVDBG map ${eventType}: no binding ${parameters ? `${parameters.connector}/${parameters.side}/${parameters.page}` : 'unknown'}`, 1);
			return false;
		}

		this.homey.app.updateLog(`ADVDBG map ${eventType}: ${parameters.connector}/${parameters.side}/${parameters.page} -> ${binding.deviceID}/${binding.capabilityName}, action=${binding.numericAction}, step=${binding.valueStep}`, 1);

		const shouldBufferUntilRelease = eventType === 'long';
		let hasLocalPreview = false;

		if (binding.directionOnly)
		{
			this.toggleAdvancedDirection(parameters);
			await this.applyAdvancedDisplayBinding(parameters);
			await this.applyAdvancedLedBinding(parameters);
			return true;
		}

		if (binding.deviceID === '_variable_' || binding.deviceID === 'customMQTT')
		{
			this.homey.app.updateLog(`ADVDBG map ${eventType}: special source ${binding.deviceID}`, 1);
			return true;
		}

		const device = await this.homey.app.getHomeyDeviceById(binding.deviceID);
		if (!device)
		{
			this.homey.app.updateLog(`ADVDBG map ${eventType}: device missing ${binding.deviceID}`, 1);
			return true;
		}

		const capability = await this.homey.app.getHomeyCapabilityByName(device, binding.capabilityName);
		if (!capability || capability.setable === false)
		{
			this.homey.app.updateLog(`ADVDBG map ${eventType}: capability missing/not setable ${binding.capabilityName}`, 1);
			return true;
		}

		let valueToWrite = capability.value;
		if (capability.type === 'boolean')
		{
			const queuedValue = shouldBufferUntilRelease ? this.getQueuedAdvancedLongReleaseValue(parameters, binding) : undefined;
			const currentBoolean = queuedValue === undefined ? Boolean(capability.value) : Boolean(queuedValue);
			valueToWrite = !currentBoolean;
			const previewApplied = await this.applyAdvancedDisplayPreviewValue(parameters, binding, capability, valueToWrite);
			let localPreviewApplied = previewApplied;
			if (shouldBufferUntilRelease && !previewApplied)
			{
				this.applyAdvancedFallbackSelectionPreview(parameters, binding, capability, valueToWrite);
				localPreviewApplied = true;
			}
			hasLocalPreview = hasLocalPreview || localPreviewApplied;
			if (shouldBufferUntilRelease)
			{
				this.queueAdvancedLongReleaseCommit(parameters, binding, valueToWrite);
			}
			else
			{
				await this.guardedSetCapabilityValueOnDevice(device, binding.capabilityName, valueToWrite, `advanced:${eventType}:boolean`);
			}
		}
		else if ((capability.type === 'enum') && Array.isArray(capability.values) && capability.values.length > 0)
		{
			const queuedValue = shouldBufferUntilRelease ? this.getQueuedAdvancedLongReleaseValue(parameters, binding) : undefined;
			const currentEnumValue = queuedValue === undefined ? capability.value : queuedValue;
			const currentIndex = capability.values.findIndex((entry) => entry.id === currentEnumValue);
			const nextIndex = currentIndex >= 0 ? ((currentIndex + 1) % capability.values.length) : 0;
			const nextItem = capability.values[nextIndex];
			if (nextItem)
			{
				valueToWrite = nextItem.id;
				const previewApplied = await this.applyAdvancedDisplayPreviewValue(parameters, binding, capability, valueToWrite);
				let localPreviewApplied = previewApplied;
				if (shouldBufferUntilRelease && !previewApplied)
				{
					this.applyAdvancedFallbackSelectionPreview(parameters, binding, capability, valueToWrite);
					localPreviewApplied = true;
				}
				hasLocalPreview = hasLocalPreview || localPreviewApplied;
				if (shouldBufferUntilRelease)
				{
					this.queueAdvancedLongReleaseCommit(parameters, binding, valueToWrite);
				}
				else
				{
					await this.commitAdvancedValueWithDebounce(parameters, binding, device, binding.capabilityName, valueToWrite);
				}
			}
		}
		else if ((capability.type === 'number') || (binding.capabilityName === 'dim'))
		{
			const queuedValue = shouldBufferUntilRelease ? this.getQueuedAdvancedLongReleaseValue(parameters, binding) : undefined;
			const pendingDebounceValue = this.getPendingAdvancedDebounceValue(parameters, binding);
			const currentNumericValue = Number.isFinite(Number(queuedValue))
				? Number(queuedValue)
				: (Number.isFinite(Number(pendingDebounceValue)) ? Number(pendingDebounceValue) : capability.value);
			const numericAction = this.getNumericActionForValueType(currentNumericValue, binding.numericAction);
			if (numericAction === 'setPlus')
			{
				this.setAdvancedDirection(parameters, '+');
			}
			else if (numericAction === 'setMinus')
			{
				this.setAdvancedDirection(parameters, '-');
			}
			else if (numericAction === 'toggleDirection')
			{
				this.toggleAdvancedDirection(parameters);
			}
			else
			{
				const direction = this.getAdvancedDirection(parameters);
				const step = Math.abs(binding.valueStep);
				if (binding.capabilityName === 'dim')
				{
					const currentDim = Number.isFinite(Number(currentNumericValue)) ? Number(currentNumericValue) : 0;
					const delta = step / 100;
					valueToWrite = direction === '-' ? currentDim - delta : currentDim + delta;
					valueToWrite = Math.max(0, Math.min(1, valueToWrite));
					valueToWrite = Math.round(valueToWrite * 1000) / 1000;
					this.applyAdvancedDirectionAtBounds(parameters, valueToWrite, 0, 1);
				}
				else if (binding.capabilityName === 'windowcoverings_set')
				{
					const currentCoverings = Number.isFinite(Number(currentNumericValue)) ? Number(currentNumericValue) : 0;
					const delta = step / 100;
					valueToWrite = direction === '-' ? currentCoverings - delta : currentCoverings + delta;
					const min = Number.isFinite(Number(capability.min)) ? Number(capability.min) : 0;
					const max = Number.isFinite(Number(capability.max)) ? Number(capability.max) : 1;
					valueToWrite = Math.max(min, Math.min(max, valueToWrite));
					valueToWrite = Math.round(valueToWrite * 1000) / 1000;
					this.applyAdvancedDirectionAtBounds(parameters, valueToWrite, min, max);
				}
				else
				{
					const currentNumber = Number.isFinite(Number(currentNumericValue)) ? Number(currentNumericValue) : 0;
					const delta = step;
					valueToWrite = direction === '-' ? currentNumber - delta : currentNumber + delta;
					if (Number.isFinite(Number(capability.min)))
					{
						valueToWrite = Math.max(Number(capability.min), valueToWrite);
					}
					if (Number.isFinite(Number(capability.max)))
					{
						valueToWrite = Math.min(Number(capability.max), valueToWrite);
					}

					if (Number.isFinite(Number(capability.min)) && Number.isFinite(Number(capability.max)))
					{
						this.applyAdvancedDirectionAtBounds(parameters, valueToWrite, Number(capability.min), Number(capability.max));
					}
				}

				const previewApplied = await this.applyAdvancedDisplayPreviewValue(parameters, binding, capability, valueToWrite);
				let localPreviewApplied = previewApplied;
				if (shouldBufferUntilRelease && !previewApplied)
				{
					this.applyAdvancedFallbackSelectionPreview(parameters, binding, capability, valueToWrite);
					localPreviewApplied = true;
				}
				hasLocalPreview = hasLocalPreview || localPreviewApplied;
				if (shouldBufferUntilRelease)
				{
					this.queueAdvancedLongReleaseCommit(parameters, binding, valueToWrite);
				}
				else
				{
					await this.guardedSetCapabilityValueOnDevice(device, binding.capabilityName, valueToWrite, `advanced:${eventType}:number`);
				}
			}
		}

		// For debounced updates, avoid immediately re-reading the old device value and overwriting preview feedback.
		if (!hasLocalPreview)
		{
			await this.applyAdvancedDisplayBinding(parameters);
		}
		if (!shouldBufferUntilRelease)
		{
			await this.applyAdvancedDisplayBinding(parameters);
		}
		await this.applyAdvancedLedBinding(parameters, {
			deviceID: binding.deviceID,
			capabilityName: binding.capabilityName,
			value: valueToWrite,
		});
		this.homey.app.updateLog(`ADVDBG map ${eventType}: done localPreview=${hasLocalPreview}, buffered=${shouldBufferUntilRelease}`, 1);
		if ((eventType === 'click') && this.advancedLastClickProcessedAt)
		{
			const key = this.getButtonStateKey(parameters.connector, parameters.side, parameters.page);
			this.advancedLastClickProcessedAt.set(key, Date.now());
		}
		return true;
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

	queuePendingAdvancedClickAction(key, fireFn)
	{
		if (!this.pendingAdvancedClickActions.has(key))
		{
			this.pendingAdvancedClickActions.set(key, []);
		}

		this.pendingAdvancedClickActions.get(key).push(fireFn);
	}

	clearPendingAdvancedClickFallbackTimer(key)
	{
		const pendingTimer = this.pendingAdvancedClickFallbackTimers.get(key);
		if (pendingTimer)
		{
			this.homey.clearTimeout(pendingTimer);
			this.pendingAdvancedClickFallbackTimers.delete(key);
		}
	}

	async firePendingSingleClickTriggers(key)
	{
		this.clearPendingAdvancedClickFallbackTimer(key);
		const advancedClickFns = this.pendingAdvancedClickActions.get(key);
		this.pendingAdvancedClickActions.delete(key);
		if (advancedClickFns)
		{
			await Promise.allSettled(advancedClickFns.map((fireFn) => Promise.resolve().then(() => fireFn())));
		}

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

		this.clickEventStates.delete(key);
	}

	discardPendingSingleClickTriggers(key)
	{
		this.clearPendingAdvancedClickFallbackTimer(key);
		this.pendingClickedTriggers.delete(key);
		this.pendingReleasedTriggers.delete(key);
		this.pendingAdvancedClickActions.delete(key);
		this.clickEventStates.delete(key);
	}

	// Real physical clicks are paired with a release that resolves single-vs-double via handleGenericDoubleClick,
	// so their 'clicked' trigger can be deferred; clicks with no such pairing (virtual button capability,
	// long press repeat) must fire immediately since nothing will ever resolve/discard them
	fireOrQueueClickedTrigger(parameters, key, fireFn)
	{
		if ((parameters.event === 'click' || parameters.event === 'deferred_click') && this.isWaitingForClickResolution(key))
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

	// ========== BUTTON TYPE HANDLERS ==========
	// Specialized event handling for button, picker, text display, and dim buttons

	/**
	 * Main entry point for button click detection.
	 * Distinguishes single vs double click, applies debouncing for physical press duplicates.
	 * In advanced mode, defers single-click until double-click window closes.
	 */
	async handleButtonClick(parameters)
	{
		const key = this.getButtonStateKey(parameters.connector, parameters.side, parameters.page);
		const timingContext = this.getEventTimingContext(parameters);
		const advancedTimingEnabled = !timingContext.simpleMode && (timingContext.doubleClickDefined || timingContext.longPressDefined);

		if (advancedTimingEnabled && !parameters.fromButton && parameters.event === 'click')
		{
			const state = this.clickEventStates.get(key) || {
				clickCount: 0,
				longPressActive: false,
				waitingForRelease: false,
			};

			if (state.longPressActive)
			{
				this.homey.app.updateLog(`Click: ignoring click while long press active for ${key}`, 0);
				return null;
			}

			if (state.clickCount === 0)
			{
				state.clickCount = 1;
				state.waitingForRelease = true;
				this.clickEventStates.set(key, state);

				const deferredParameters = _.cloneDeep(parameters);
				deferredParameters.event = 'deferred_click';
				this.queuePendingAdvancedClickAction(key, () => this.executeSingleClickAction(deferredParameters).catch((err) => this.error(err)));
				this.armClickResolutionTimers(parameters, key, timingContext);

				this.homey.app.updateLog(`Click: queued first click for ${key} long=${timingContext.longPressDefined} double=${timingContext.doubleClickDefined}`, 0);
				return null;
			}

			if (timingContext.doubleClickDefined && this.clickEventTimers.has(key))
			{
				state.clickCount += 1;
				state.waitingForRelease = true;
				this.clickEventStates.set(key, state);
				const config = this.resolveConnectorConfig(parameters);
				await this.handleGenericDoubleClick(parameters, key, config);
				return { suppressGenericClick: true };
			}

			this.homey.app.updateLog(`Click: ignored second click for ${key} (double window closed)`, 0);
			return null;
		}

		return this.executeSingleClickAction(parameters);
	}

	async refreshPickerButtonDisplay(parameters, config)
	{
		const { capability } = await this.getDeviceAndCapability(config);
		const currentValue = capability ? capability.value : undefined;
		const displayValue = await this.resolveCapabilityDisplayText(config, currentValue);

		const buttonIdx = parameters.connector * 2 + (parameters.side === 'left' ? 0 : 1) + 1;
		this.publishTextButtonLabel(config.brokerId, buttonIdx, parameters.page, displayValue);

		const ledState = await this.getCapabilityLedState(config);
		if (ledState !== null)
		{
			this.setLEDOnOff(config, null, buttonIdx, parameters.page, ledState);
		}

		return {
			displayValue,
			ledState,
		};
	}

	async handlePickerToggleClick(parameters, config)
	{
		await this.toggleOnOffForNonBooleanCapability(config);
		const { displayValue, ledState } = await this.refreshPickerButtonDisplay(parameters, config);
		const key = this.getButtonStateKey(parameters.connector, parameters.side, parameters.page);

		// Item list capabilities have no on/off value of their own: the button/LED state instead follows the target device's onoff capability
		this.fireOrQueueClickedTrigger(parameters, key, () => this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'clicked', ledState !== null ? ledState : false, displayValue, parameters.page));

		if (parameters.fromButton && ((parameters.page === 0) || (this.page === parameters.page)))
		{
			// Momentary press: reset the virtual button state immediately
			setImmediate(() => this.safeSetCapabilityValue(parameters.buttonCapability, false));
		}
	}

	/**
	 * Handle text display button click: show current device value (read-only display).
	 * No action taken; serves as informational display.
	 */
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

	/**
	 * Handle picker button click: cycle to next enum value with debounced commit.
	 * Displays selected value immediately, but writes to device after long-press delay.
	 */
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

	/**
	 * Handle generic double-click: toggle onoff for non-boolean capabilities or cycle dim direction.
	 * Discards pending single-click triggers and suppresses click event.
	 */
	async handleGenericDoubleClick(parameters, key, config)
	{
		const pendingTimer = this.clickEventTimers.get(key);
		if (!pendingTimer)
		{
			return;
		}

		// Second click arrived within the double click window: discard deferred single-click paths
		this.homey.clearTimeout(pendingTimer);
		this.clickEventTimers.delete(key);
		this.discardPendingSingleClickTriggers(key);
		this.clearPendingAdvancedClickFallbackTimer(key);
		this.incrementSuppression(this.releaseSuppressions, key);

		if (this.isDimButtonConfig(config))
		{
			await this.toggleDimDirection(parameters, config, key);
		}

		if (await this.runAdvancedEventMapping(parameters, 'double'))
		{
			const value = this.buttonValues.get(`${parameters.side}_${parameters.connector}_${parameters.page}`) || false;
			this.homey.app.triggerButtonEvent(this, parameters.side, parameters.connector, 'double', value, value.toString(), 0);
			if (parameters.configNo != null)
			{
				this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'double', value, value.toString(), parameters.page);
			}
			return;
		}

		// Toggle first (if applicable) so the reported button/LED state reflects the new value
		await this.toggleOnOffForNonBooleanCapability(config);

		const value = this.buttonValues.get(`${parameters.side}_${parameters.connector}_${parameters.page}`) || false;
		const buttonState = await this.getConfigLedButtonState(config, value);
		this.homey.app.triggerButtonEvent(this, parameters.side, parameters.connector, 'double', buttonState, value.toString(), 0);
		if (parameters.configNo != null)
		{
			this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'double', buttonState, value.toString(), parameters.page);
		}
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

	/**
	 * Toggle dim direction (+ up or - down) for next long-press adjustment.
	 * Double-click on a dim button toggles direction.
	 */
	async toggleDimDirection(parameters, config, key)
	{
		const currentDirection = this.getDimDirection(key, config.dimChange);
		this.dimDirections.set(key, currentDirection === '-' ? '+' : '-');

		await this.refreshDimButtonDisplay(parameters, config, key);
	}

	/**
	 * Toggle device onoff or cycle between on/off when adjusting brightness.
	 * Dim buttons control both brightness (long-press) and on/off (click).
	 */
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

		this.homey.app.updateLog(`TIMING longpress ts=${new Date().toISOString()} ms=${Date.now()} key=${longPressKey} configNo=${parameters.configNo} page=${parameters.page}`, 0);

		let repeatCount = this.longPressOccurred.get(longPressKey);
		if (repeatCount === undefined)
		{
			repeatCount = 0;
		}

		let buttonPanelConfiguration = null;
		let buttonPageConfiguration = null;
		const timingContext = this.getEventTimingContext(parameters);
		const hasAdvancedLongMapping = !timingContext.simpleMode && timingContext.longPressDefined;
		if ((parameters.configNo != null) && (parameters.connectorType !== 2) && (parameters.connectorType !== 3))
		{
			buttonPanelConfiguration = this.homey.app.buttonConfigurations[parameters.configNo];
			buttonPageConfiguration = buttonPanelConfiguration ? (buttonPanelConfiguration[parameters.page] || buttonPanelConfiguration[0] || {}) : {};
			const disableLongRepeatRaw = buttonPageConfiguration[`${parameters.side}DisableLongRepeat`];
			const disableLongRepeat = disableLongRepeatRaw === true
				|| disableLongRepeatRaw === 1
				|| disableLongRepeatRaw === '1'
				|| (typeof disableLongRepeatRaw === 'string' && disableLongRepeatRaw.trim().toLowerCase() === 'true');
			if (!hasAdvancedLongMapping && disableLongRepeat && (repeatCount > 0))
			{
				this.homey.app.updateLog(`ADVDBG long gate: disabled repeat for ${parameters.connector}/${parameters.side}/${parameters.page}, raw=${disableLongRepeatRaw}`, 1);
				return null;
			}
		}

		if (hasAdvancedLongMapping)
		{
			this.longPressHeartbeatAt.set(longPressKey, Date.now());
		}

		if (isFirmwareV3)
		{
			const configuredRepeatMs = parseInt(buttonPageConfiguration && buttonPageConfiguration[`${parameters.side}LongRepeatMs`], 10);
			const repeatIntervalMs = Number.isNaN(configuredRepeatMs) ? 500 : Math.max(50, Math.min(configuredRepeatMs, 10000));
			if (hasAdvancedLongMapping)
			{
				this.armAdvancedLongSyntheticTick(parameters, longPressKey, repeatIntervalMs);
			}
			const now = Date.now();
			const lastProcessedAt = this.longPressLastProcessedAt.get(longPressKey) || 0;
			if ((repeatCount > 0) && ((now - lastProcessedAt) < repeatIntervalMs))
			{
				return null;
			}

			this.longPressLastProcessedAt.set(longPressKey, now);
		}

		if (repeatCount === 0)
		{
			this.homey.app.updateLog(`Panel processing MQTT message: ${parameters}`);
		}

		this.longPressOccurred.set(longPressKey, repeatCount + 1);
		if (repeatCount === 0)
		{
			if (this.isWaitingForClickResolution(longPressKey))
			{
				// Any confirmed hold must cancel pending click resolution for the same press,
				// otherwise click actions (e.g. onoff) can leak into dim-hold behavior.
				this.clearClickResolutionTimers(longPressKey);
				this.discardPendingSingleClickTriggers(longPressKey);
				const clickState = this.clickEventStates.get(longPressKey) || { clickCount: 0, longPressActive: false };
				clickState.longPressActive = true;
				this.clickEventStates.set(longPressKey, clickState);
			}
		}
		this.homey.app.triggerButtonLongPress(this, parameters.side === 'left', parameters.connector + 1, repeatCount, parameters.page);
		this.homey.app.triggerButtonEvent(this, parameters.side, parameters.connector, 'long', parameters.value, parameters.value.toString(), 0);

		if (!hasAdvancedLongMapping)
		{
			if (parameters.configNo != null)
			{
				const config = this.getConfigPageSide(null, parameters.page, parameters.side, parameters.configNo);
				const value = this.buttonValues.get(`${parameters.side}_${parameters.connector}_${parameters.page}`) || false;
				const buttonState = await this.getConfigLedButtonState(config, value);
				this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'long', buttonState, value.toString(), parameters.page, repeatCount);
			}
			return null;
		}

		if (hasAdvancedLongMapping && (repeatCount === 0) && this.advancedLastClickProcessedAt)
		{
			const lastClickAt = this.advancedLastClickProcessedAt.get(longPressKey) || 0;
			const suppressInitialLongMs = Math.max(150, Math.min(2000, this.getConfiguredLongPressDelayMs(parameters) + 250));
			if (lastClickAt > 0 && ((Date.now() - lastClickAt) < suppressInitialLongMs))
			{
				if ((parameters.page === 0) || (this.page === parameters.page))
				{
					this.safeSetCapabilityValue(`${parameters.side}_button.connector${parameters.connector}`, false);
				}
				return null;
			}
		}

		if (await this.runAdvancedEventMapping(parameters, 'long'))
		{
			await this.triggerAdvancedMappedConfigLong(parameters, repeatCount);
			if ((parameters.page === 0) || (this.page === parameters.page))
			{
				this.safeSetCapabilityValue(`${parameters.side}_button.connector${parameters.connector}`, false);
			}
			return null;
		}

		if ((parameters.connectorType === 2) || (parameters.connectorType === 3))
		{
			const value = this.buttonValues.get(`${parameters.side}_${parameters.connector}_${parameters.page}`) || false;
			this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'long', value, value.toString(), parameters.page, repeatCount);
		}
		else if (buttonPanelConfiguration !== null)
		{
			const value = this.buttonValues.get(`${parameters.side}_${parameters.connector}_${parameters.page}`) || false;
			const config = this.getConfigPageSide(null, parameters.page, parameters.side, parameters.configNo);
			const buttonState = await this.getConfigLedButtonState(config, value);
			this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'long', buttonState, value.toString(), parameters.page, repeatCount);
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
		try
		{
			const clickStateOnRelease = this.clickEventStates.get(releaseKey);
			if (clickStateOnRelease)
			{
				clickStateOnRelease.waitingForRelease = false;
				this.clickEventStates.set(releaseKey, clickStateOnRelease);
			}
			await this.flushAdvancedLongReleaseCommit(parameters);
			await this.flushAdvancedLongReleaseCommitFamily(parameters.connector, parameters.side, releaseKey);

			if (!this.consumeSuppression(this.releaseSuppressions, releaseKey))
			{
				const releaseFire = () => this.homey.app.triggerButtonEvent(this, parameters.side, parameters.connector, 'released', parameters.value, parameters.value.toString(), 0);
				if (this.isWaitingForClickResolution(releaseKey))
				{
					this.queueReleasedTrigger(releaseKey, releaseFire);
				}
				else
				{
					releaseFire();
				}

				if (parameters.configNo != null)
				{
					const value = this.buttonValues.get(`${parameters.side}_${parameters.connector}_${parameters.page}`) || false;
					const buttonState = await this.getConfigLedButtonState(config, value);
					const releaseConfigFire = () => this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'released', buttonState, value.toString(), parameters.page);
					if (this.isWaitingForClickResolution(releaseKey))
					{
						this.queueReleasedTrigger(releaseKey, releaseConfigFire);
					}
					else
					{
						releaseConfigFire();
					}
				}
			}
			else
			{
				this.homey.app.updateLog(`Release: suppressed queued release for ${releaseKey}`, 1);
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
					// Dim now follows the shared click timing resolver (single deferred; double cancels single; long cancels single).
				}
				else if (this.longPressOccurred && (this.longPressOccurred.get(`${parameters.connector}_${parameters.side}_${parameters.page}`) > 0) && (config.capabilityName === 'windowcoverings_state'))
				{
					// Send the pause command to the device if the LongPress was received
					if (config.deviceID !== 'customMQTT')
					{
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
		}
		finally
		{
			await this.clearLongPressTrackingForRelease(parameters.connector, parameters.side, releaseKey);
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

					let buttonPanelConfiguration = applyConfigNo != null ? this.homey.app.buttonConfigurations[applyConfigNo] : null;
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

		// Check every connector; checkStateChangeForConnector resolves whether a usable
		// button/display configuration exists for the connector.
		for (let connector = 0; connector < 8; connector++)
		{
			this.checkStateChangeForConnector(connector, deviceId, capability, value);
		}

		const configNo = this.getCapabilityValue('configuration_display');
		this.checkStateChangeForDisplay(configNo, deviceId, capability, value);
	}

	async checkStateChangeForConnector(connector, deviceId, capability, value)
	{
		const connectorType = this.getSetting(`connect${connector}Type`);
		const rawCapabilityValue = value;

		// Display connectors have no configuration_button.*, so fall back to
		// configuration_display when display button events are enabled.
		let configNo = this.hasCapability(`configuration_button.connector${connector}`)
			? this.getCapabilityValue(`configuration_button.connector${connector}`)
			: null;
		if ((configNo == null) && (this.displayButtonEvents === true) && ((connectorType === 2) || (connectorType === 3)) && this.hasCapability('configuration_display'))
		{
			configNo = this.getCapabilityValue('configuration_display');
		}

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
		if (!Array.isArray(config) || config.length === 0)
		{
			return;
		}
		const numPages = config.length;

		for (let page = 0; page < numPages; page++)
		{
			// Check the left and right devices and capabilities for this page
			let side = 'left';
			for (let i = 0; i < 2; i++)
			{
				const rawPageConfig = config[page] || config[0] || {};
				const sideMode = String(rawPageConfig[`${side}Mode`] || 'basic').toLowerCase();
				if (sideMode === 'advanced')
				{
					const advancedParameters = {
						connector,
						side,
						page,
						configNo,
						connectorType,
					};

					const ledBinding = this.resolveAdvancedLedBinding(advancedParameters);
					let shouldApplyAdvancedLedBinding = false;
					if (ledBinding && (ledBinding.deviceID === deviceId) && ledBinding.capabilityName)
					{
						if (ledBinding.capabilityName === capability
							|| ((ledBinding.capabilityName === 'light_hue' || ledBinding.capabilityName === 'light_saturation')
								&& (capability === 'light_hue' || capability === 'light_saturation')))
						{
							shouldApplyAdvancedLedBinding = true;
						}
						else if (capability === 'onoff')
						{
							if (ledBinding.capabilityName === 'dim')
							{
								shouldApplyAdvancedLedBinding = true;
							}
							else
							{
								const sourceDevice = await this.homey.app.getHomeyDeviceById(ledBinding.deviceID);
								const sourceCapability = sourceDevice ? await this.homey.app.getHomeyCapabilityByName(sourceDevice, ledBinding.capabilityName) : null;
								if (sourceCapability && (sourceCapability.type !== 'boolean'))
								{
									shouldApplyAdvancedLedBinding = true;
								}
							}
						}
					}

					if (shouldApplyAdvancedLedBinding)
					{
						// eslint-disable-next-line no-await-in-loop
						await this.applyAdvancedLedBinding(advancedParameters);
					}

					const displayBinding = this.resolveAdvancedDisplayBinding(advancedParameters);
					if (displayBinding && (displayBinding.deviceID === deviceId) && (displayBinding.capabilityName === capability))
					{
						// eslint-disable-next-line no-await-in-loop
						this.homey.app.updateLog(`ADVDBG stateChange: applyAdvancedDisplayBinding ${connector}/${side}/${page}`, 1);
						await this.applyAdvancedDisplayBinding(advancedParameters, rawCapabilityValue);
					}

					// Advanced mode owns rendering/state sync for this side; avoid legacy basic-path overwrites.
					side = 'right';
					continue;
				}

				const sideConfig = this.getConfigPageSide(null, page, side, configNo);
				const isConfiguredCapabilityMatch = (sideConfig.deviceID === deviceId) && (sideConfig.capabilityName === capability);
				// Dim buttons have no on/off value of their own, so also react to the target device's onoff changes to drive the LED
				const isDimOnOffFollow = (sideConfig.deviceID === deviceId) && (sideConfig.capabilityName === 'dim') && (capability === 'onoff');

				// Other non-boolean capabilities have no on/off value of their own either; if the target device also
				// exposes an onoff capability, react to its changes too so the LED can follow it
				let isNonBooleanOnOffFollow = false;
				if (!isConfiguredCapabilityMatch && !isDimOnOffFollow && (capability === 'onoff') && (sideConfig.deviceID === deviceId)
					&& (sideConfig.deviceID !== '_variable_') && (sideConfig.capabilityName !== 'dim') && (sideConfig.capabilityName !== 'windowcoverings_state') && (sideConfig.capabilityName !== 'onoff') && sideConfig.capabilityName)
				{
					// eslint-disable-next-line no-await-in-loop
					const { capability: configuredCapability } = await this.getDeviceAndCapability(sideConfig);
					isNonBooleanOnOffFollow = !!configuredCapability && (configuredCapability.type !== 'boolean');
				}

				if (isConfiguredCapabilityMatch || isDimOnOffFollow || isNonBooleanOnOffFollow)
				{
					let buttonIdx = connector * 2 + (side === 'left' ? 0 : 1);
					buttonIdx += 1;

					// An onoff-follow match is only for driving the LED; the capability that changed isn't the one configured on this button
					const isOnOffFollowOnly = isDimOnOffFollow || isNonBooleanOnOffFollow;

					// Text/number variables and non-boolean device capabilities (text/picker) have no on/off state: just refresh what's shown on the button
					const isNonBooleanVariable = !isOnOffFollowOnly && (sideConfig.deviceID === '_variable_') && (typeof value !== 'boolean');
					const isNonBooleanDeviceCapability = !isOnOffFollowOnly && (sideConfig.deviceID !== '_variable_') && (sideConfig.capabilityName !== 'dim') && (sideConfig.capabilityName !== 'windowcoverings_state') && (typeof value !== 'boolean');
					const skipOnOffHandling = isNonBooleanVariable || isNonBooleanDeviceCapability;

					if (isNonBooleanVariable)
					{
						this.publishTextButtonLabel(sideConfig.brokerId, buttonIdx, page, value);
					}
					else if (isNonBooleanDeviceCapability)
					{
						// eslint-disable-next-line no-await-in-loop
						const displayText = await this.resolveCapabilityDisplayText(sideConfig, value);
						this.publishTextButtonLabel(sideConfig.brokerId, buttonIdx, page, displayText);
					}
					else if (!isOnOffFollowOnly && (sideConfig.capabilityName !== 'dim'))
					{
						if (sideConfig.capabilityName !== 'windowcoverings_state')
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

						if (sideConfig.onMessage !== '' || sideConfig.offMessage !== '')
						{
							this.homey.app.publishMQTTMessage(sideConfig.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/label/set`, value ? sideConfig.onMessage : sideConfig.offMessage).catch(this.error);
						}
						this.homey.app.publishMQTTMessage(sideConfig.brokerId, `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/svg/set`, value ? sideConfig.onSVG : sideConfig.offSVG).catch((err) => this.error(err));
					}
					else if (!isOnOffFollowOnly && (capability === 'dim'))
					{
						// Dim capability: show the current level and toggled brighten/darken direction on the button
						const dimKey = this.getDimButtonKey(connector, side, page);
						const direction = this.getDimDirection(dimKey, sideConfig.dimChange);
						this.publishDimButtonLabel(sideConfig.brokerId, buttonIdx, page, value, direction);
					}

					// Dim buttons have no on/off value of their own, so drive the LED from the target device's onoff state
					if (sideConfig.capabilityName === 'dim')
					{
						// eslint-disable-next-line no-await-in-loop
						const ledState = await this.getDimButtonLedState(sideConfig);
						this.setLEDOnOff(sideConfig, null, buttonIdx, page, ledState);
					}
					else if (isNonBooleanDeviceCapability || isNonBooleanOnOffFollow)
					{
						// eslint-disable-next-line no-await-in-loop
						const ledState = await this.getCapabilityLedState(sideConfig);
						if (ledState !== null)
						{
							this.setLEDOnOff(sideConfig, null, buttonIdx, page, ledState);
						}
					}
					else if (!skipOnOffHandling)
					{
						// Add the front and wall colours or the on/off state to the message queue based on the on/off value and firmware version
						this.setLEDOnOff(sideConfig, null, buttonIdx, page, value);
					}
				}

				side = 'right';
			}
		}
	}

	async resolveCapabilityDisplayText(config, rawValue)
	{
		const { capability } = await this.getDeviceAndCapability(config);
		if ((config && config.capabilityName === 'windowcoverings_set') || (capability && capability.id === 'windowcoverings_set'))
		{
			return this.formatWindowCoveringsSetPercentage(rawValue);
		}

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
		const rawConfig = sideConfig.raw || null;
		const sideMode = String(rawConfig && rawConfig[`${side}Mode`] ? rawConfig[`${side}Mode`] : 'basic').toLowerCase();

		const connector = parseInt(buttonIdx / 2, 10);

		buttonIdx += 1;

		if (sideMode === 'advanced' && rawConfig)
		{
			const registeredAdvancedSources = new Set();
			const advancedBindingKeys = [`${side}Led`, `${side}Display`, `${side}Click`, `${side}Double`, `${side}Long`];
			for (const bindingKey of advancedBindingKeys)
			{
				const deviceId = rawConfig[`${bindingKey}Device`];
				const capabilityName = rawConfig[`${bindingKey}Capability`];
				if (!deviceId || !capabilityName || deviceId === 'none' || deviceId === '_variable_' || deviceId === 'customMQTT')
				{
					continue;
				}

				registeredAdvancedSources.add(`${deviceId}::${capabilityName}`);

				const sourceDevice = await this.homey.app.getHomeyDeviceById(deviceId);
				if (sourceDevice)
				{
					this.homey.app.registerDeviceCapabilityStateChange(sourceDevice, capabilityName);
					if ((bindingKey === `${side}Led`)
						&& (capabilityName === 'light_hue' || capabilityName === 'light_saturation'))
					{
						this.homey.app.registerDeviceCapabilityStateChange(sourceDevice, 'light_hue');
						this.homey.app.registerDeviceCapabilityStateChange(sourceDevice, 'light_saturation');
					}
					else if ((bindingKey === `${side}Led`) && (capabilityName === 'dim'))
					{
						this.homey.app.registerDeviceCapabilityStateChange(sourceDevice, 'onoff');
					}
					else if (bindingKey === `${side}Led`)
					{
						const sourceCapability = await this.homey.app.getHomeyCapabilityByName(sourceDevice, capabilityName);
						if (sourceCapability && (sourceCapability.type !== 'boolean'))
						{
							this.homey.app.registerDeviceCapabilityStateChange(sourceDevice, 'onoff');
						}
					}
				}
			}

			if (sideConfig.deviceID && sideConfig.deviceID !== 'none' && sideConfig.deviceID !== '_variable_' && sideConfig.deviceID !== 'customMQTT' && sideConfig.capabilityName)
			{
				const legacyKey = `${sideConfig.deviceID}::${sideConfig.capabilityName}`;
				if (!registeredAdvancedSources.has(legacyKey))
				{
					const legacySourceDevice = await this.homey.app.getHomeyDeviceById(sideConfig.deviceID);
					if (legacySourceDevice)
					{
						this.homey.app.registerDeviceCapabilityStateChange(legacySourceDevice, sideConfig.capabilityName);
					}
				}
			}

			let advancedConfigNo = this.hasCapability(`configuration_button.connector${connector}`)
				? this.getCapabilityValue(`configuration_button.connector${connector}`)
				: null;
			const connectorType = this.getSetting(`connect${connector}Type`);
			if ((advancedConfigNo == null) && (this.displayButtonEvents === true) && ((connectorType === 2) || (connectorType === 3)) && this.hasCapability('configuration_display'))
			{
				advancedConfigNo = this.getCapabilityValue('configuration_display');
			}

			const advancedParameters = {
				connector,
				side,
				page,
				configNo: advancedConfigNo,
				connectorType,
			};

			const displayBinding = this.resolveAdvancedDisplayBinding(advancedParameters);
			const ledBinding = this.resolveAdvancedLedBinding(advancedParameters);
			const fallbackDisplayBinding = (sideConfig.deviceID && sideConfig.deviceID !== 'none' && sideConfig.capabilityName)
				? {
					deviceID: sideConfig.deviceID,
					capabilityName: sideConfig.capabilityName,
					booleanRender: String((rawConfig && rawConfig[`${side}DisplayBooleanRender`]) || 'text').toLowerCase(),
					onText: sideConfig.onMessage || 'On',
					offText: sideConfig.offMessage || 'Off',
					onSVG: sideConfig.onSVG || '',
					offSVG: sideConfig.offSVG || '',
					brokerId: sideConfig.brokerId,
				}
				: null;
			const effectiveDisplayBinding = displayBinding || fallbackDisplayBinding;

			const displayBrokerId = displayBinding ? displayBinding.brokerId : sideConfig.brokerId;

			if (ledBinding)
			{
				const isLightColorBinding = ledBinding.capabilityName === 'light_hue' || ledBinding.capabilityName === 'light_saturation';
				const ledValue = isLightColorBinding ? true : await this.resolveLedBindingValue(ledBinding);
				if (isLightColorBinding)
				{
					const lightColor = await this.resolveLightColor(ledBinding);
					if (lightColor)
					{
						ledBinding.frontLEDOnColor = lightColor;
						ledBinding.wallLEDOnColor = lightColor;
						ledBinding.frontLEDOffColor = '#000000';
						ledBinding.wallLEDOffColor = '#000000';
					}
				}
				this.setLEDOnOff(ledBinding, mqttQueue, buttonIdx, page, ledValue);
			}

			mqttQueue.push(
				{
					brokerId: displayBrokerId,
					message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/toplabel/set`,
					value: sideConfig.topLabel,
				},
			);

			if (effectiveDisplayBinding)
			{
				const displayValue = await this.resolveAdvancedDisplayValue(effectiveDisplayBinding, undefined, advancedParameters);
				mqttQueue.push(
					{
						brokerId: effectiveDisplayBinding.brokerId || displayBrokerId,
						message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/svg/set`,
						value: (displayValue && displayValue.svgValue) ? displayValue.svgValue : '',
					},
				);

				mqttQueue.push(
					{
						brokerId: effectiveDisplayBinding.brokerId || displayBrokerId,
						message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/label/set`,
						value: (displayValue && displayValue.svgValue) ? '' : ((displayValue && displayValue.textValue != null) ? displayValue.textValue : ''),
					},
				);
			}

			return mqttQueue;
		}

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
						// Text/picker capabilities have no on/off state; normalize display content (enum title or text fallback).
						rawTextValue = await this.resolveCapabilityDisplayText(sideConfig, value);
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
				raw: null,
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
			onSVG: normalizeSvgText(config[`${side}OnSVG`] || ''),
			offSVG: normalizeSvgText(config[`${side}OffSVG`] || ''),
			raw: config,
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

	compareObjects(obj1, obj2, strict = true)
	{
		function customizer(value1, value2)
		{
			if (value1 === value2)
			{
				return true;
			}

			// Treat numeric strings and numbers as equal when they represent the same value.
			if (((typeof value1 === 'number') && (typeof value2 === 'string')) || ((typeof value1 === 'string') && (typeof value2 === 'number')))
			{
				const value1Num = Number(value1);
				const value2Num = Number(value2);
				if (!Number.isNaN(value1Num) && !Number.isNaN(value2Num))
				{
					return value1Num === value2Num;
				}
			}

			// Treat booleans and 0/1 as equal for firmware payload compatibility.
			if (((typeof value1 === 'boolean') && ((typeof value2 === 'number') || (typeof value2 === 'string')))
				|| ((typeof value2 === 'boolean') && ((typeof value1 === 'number') || (typeof value1 === 'string'))))
			{
				const value1Bool = (typeof value1 === 'boolean') ? value1 : (Number(value1) !== 0);
				const value2Bool = (typeof value2 === 'boolean') ? value2 : (Number(value2) !== 0);
				if (!Number.isNaN(Number(value1)) || (typeof value1 === 'boolean'))
				{
					if (!Number.isNaN(Number(value2)) || (typeof value2 === 'boolean'))
					{
						return value1Bool === value2Bool;
					}
				}
			}

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
					if (a.eventtype !== undefined)
					{
						return a.eventtype - b.eventtype;
					}

					if (a.brokerid !== undefined)
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
						if (!Object.prototype.hasOwnProperty.call(value2, key))
						{
							return false;
						}

						if (!_.isEqual(value1[key], value2[key]))
						{
							return false;
						}
					}
				}

				if (strict)
				{
					// In strict mode, read-back objects must not contain additional keys
					for (const key in value2)
					{
						if (key !== 'buttonid')
						{
							if (!Object.prototype.hasOwnProperty.call(value1, key))
							{
								return false;
							}
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

	findFirstDifference(left, right, path = '$')
	{
		if (this.compareObjects(left, right, false))
		{
			return null;
		}

		const leftIsArray = Array.isArray(left);
		const rightIsArray = Array.isArray(right);
		if (leftIsArray || rightIsArray)
		{
			if (!(leftIsArray && rightIsArray))
			{
				return { path, left, right };
			}

			const maxLen = Math.max(left.length, right.length);
			for (let i = 0; i < maxLen; i++)
			{
				if (!this.compareObjects(left[i], right[i], false))
				{
					const nested = this.findFirstDifference(left[i], right[i], `${path}[${i}]`);
					return nested || { path: `${path}[${i}]`, left: left[i], right: right[i] };
				}
			}

			return { path, left, right };
		}

		const leftIsObject = (left && typeof left === 'object');
		const rightIsObject = (right && typeof right === 'object');
		if (leftIsObject || rightIsObject)
		{
			if (!(leftIsObject && rightIsObject))
			{
				return { path, left, right };
			}

			for (const key of Object.keys(left))
			{
				if (!Object.prototype.hasOwnProperty.call(right, key))
				{
					return { path: `${path}.${key}`, left: left[key], right: undefined };
				}

				if (!this.compareObjects(left[key], right[key], false))
				{
					const nested = this.findFirstDifference(left[key], right[key], `${path}.${key}`);
					return nested || { path: `${path}.${key}`, left: left[key], right: right[key] };
				}
			}

			return { path, left, right };
		}

		return { path, left, right };
	}

	parseHexColor(hexColor)
	{
		if (typeof hexColor !== 'string')
		{
			return null;
		}

		const trimmed = hexColor.trim().replace('#', '');
		if (!/^[0-9a-fA-F]{6}$/.test(trimmed))
		{
			return null;
		}

		return {
			r: parseInt(trimmed.substring(0, 2), 16),
			g: parseInt(trimmed.substring(2, 4), 16),
			b: parseInt(trimmed.substring(4, 6), 16),
		};
	}

	rgbToInteger(color)
	{
		if (!color)
		{
			return 0;
		}

		const r = Math.max(0, Math.min(255, Math.round(color.r || 0)));
		const g = Math.max(0, Math.min(255, Math.round(color.g || 0)));
		const b = Math.max(0, Math.min(255, Math.round(color.b || 0)));
		return (r << 16) + (g << 8) + b;
	}

	interpolateColor(offHex, onHex, level)
	{
		const clampedLevel = Math.max(0, Math.min(1, Number(level)));
		const offColor = this.parseHexColor(offHex);
		const onColor = this.parseHexColor(onHex);
		if (!offColor && !onColor)
		{
			return 0;
		}

		if (!offColor)
		{
			return this.rgbToInteger(onColor);
		}

		if (!onColor)
		{
			return this.rgbToInteger(offColor);
		}

		return this.rgbToInteger({
			r: offColor.r + ((onColor.r - offColor.r) * clampedLevel),
			g: offColor.g + ((onColor.g - offColor.g) * clampedLevel),
			b: offColor.b + ((onColor.b - offColor.b) * clampedLevel),
		});
	}

	queueOrPublishLedColor(mqttQueue, brokerId, rgbTopic, onTopic, rgbValue)
	{
		if (mqttQueue)
		{
			mqttQueue.push(
				{
					brokerId,
					message: rgbTopic,
					value: rgbValue,
					retain: false,
				},
			);

			mqttQueue.push(
				{
					brokerId,
					message: onTopic,
					value: 1,
					retain: false,
				},
			);
		}
		else
		{
			this.homey.app.publishMQTTMessage(brokerId, rgbTopic, rgbValue).catch(this.error);
			this.homey.app.publishMQTTMessage(brokerId, onTopic, 1).catch(this.error);
		}
	}

	setLEDOnOff(config, mqttQueue, buttonIdx, page, value)
	{
		if (checkSEMVerGreaterOrEqual(this.firmwareVersion, '1.12.0'))
		{
			const numericLevel = (typeof value === 'number' && Number.isFinite(value))
				? Math.max(0, Math.min(1, value))
				: null;
			const isOn = numericLevel === null ? ((value === true) || (value === 'up')) : numericLevel > 0;

			const frontRgbValue = numericLevel === null
				? this.interpolateColor(config.frontLEDOffColor, config.frontLEDOnColor, isOn ? 1 : 0)
				: this.interpolateColor(config.frontLEDOffColor, config.frontLEDOnColor, numericLevel);
			const wallRgbValue = numericLevel === null
				? this.interpolateColor(config.wallLEDOffColor, config.wallLEDOnColor, isOn ? 1 : 0)
				: this.interpolateColor(config.wallLEDOffColor, config.wallLEDOnColor, numericLevel);

			if (config.frontLEDOnColor || config.frontLEDOffColor)
			{
				this.queueOrPublishLedColor(
					mqttQueue,
					config.brokerId,
					`buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/front/rgb/set`,
					`buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/front/on/set`,
					frontRgbValue,
				);
			}

			if (config.wallLEDOnColor || config.wallLEDOffColor)
			{
				this.queueOrPublishLedColor(
					mqttQueue,
					config.brokerId,
					`buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/wall/rgb/set`,
					`buttonplus/${this.buttonId}/button/${buttonIdx}-${page}/led/wall/on/set`,
					wallRgbValue,
				);
			}
		}
		else
		{
			// Send the value to the device after a short delay to allow the device to connect to the broker
			const legacyValue = (typeof value === 'number' && Number.isFinite(value)) ? value > 0 : value;
			if (mqttQueue)
			{
				mqttQueue.push(
					{
						brokerId: config.brokerId,
						message: `buttonplus/${this.buttonId}/button/${buttonIdx}-${page}`,
						value: legacyValue,
					},
				);
			}
			else
			{
				this.homey.app.publishMQTTMessage(config.brokerId, `buttonplus/${this.buttonId}/${buttonIdx}-${page}`, legacyValue).catch(this.error);
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
