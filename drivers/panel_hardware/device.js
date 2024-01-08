'use strict';

const BasePanelDevice = require('../base_panel_device');

class PanelDevice extends BasePanelDevice
{

    /**
     * onInit is called when the device is initialized.
     */
    async onInit()
    {
        this.initFinished = false;

        const settings = this.getSettings();
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

        this.setSettings(settings).catch(this.error);

        await super.onInit();

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

        if (!this.hasCapability('dim.large'))
        {
            await this.addCapability('dim.large');
        }

        if (!this.hasCapability('dim.small'))
        {
            await this.addCapability('dim.small');
        }

        if (!this.hasCapability('dim.led'))
        {
            await this.addCapability('dim.led');
        }

        if (!this.hasCapability('button.update_firmware'))
        {
            await this.addCapability('button.update_firmware');
        }

        if (!this.hasCapability('button.apply_config'))
        {
            await this.addCapability('button.apply_config');
        }

        const ip = this.getSetting('address');

        this.registerCapabilityListener('dim.large', this.onCapabilityDim.bind(this, 'largedisplay'));
        this.registerCapabilityListener('dim.small', this.onCapabilityDim.bind(this, 'minidisplay'));
        this.registerCapabilityListener('dim.led', this.onCapabilityDim.bind(this, 'leds'));
        
        this.registerCapabilityListener('button.update_firmware', async () => {
            // Maintenance action button was pressed
            return await this.homey.app.updateFirmware(ip);
          });
        
          this.registerCapabilityListener('button.apply_config', async () => {
            // Maintenance action button was pressed
            await this.uploadButtonConfigurations(null, true);
            await this.uploadDisplayConfigurations();
            await this.uploadBrokerConfigurations();
          });

        this.homey.app.setupPanelTemperatureTopic(ip, this.__id);

        let brokerId = this.homey.settings.get('defaultBroker');
        const mqttClient = this.homey.app.getMqttClient(brokerId);
        await this.setupMQTTSubscriptions(mqttClient);

        this.log('PanelDevice has been initialized');
        this.initFinished = true;
    }

    async setupMQTTSubscriptions(MQTTclient)
    {
        if (!MQTTclient)
        {
            return;
        }

        const { id } = this.getData();
        MQTTclient.subscribe(`${id}/brightness/largedisplay/value`, (err) =>
        {
            if (err)
            {
                this.homey.app.updateLog("setupMQTTClient.onConnect 'homey/toggle' error: " * this.homey.app.varToString(err), 0);
            }
            else
            {
                const value = this.getCapabilityValue('dim.large');
                this.homey.app.publishMQTTMessage('homey', `${id}/brightness/largedisplay/value`, value * 100);
            }
        });
        MQTTclient.subscribe(`${id}/brightness/minidisplay/value`, (err) =>
        {
            if (err)
            {
                this.homey.app.updateLog("setupMQTTClient.onConnect 'homey/toggle' error: " * this.homey.app.varToString(err), 0);
            }
            else
            {
                const value = this.getCapabilityValue('dim.small');
                this.homey.app.publishMQTTMessage('homey', `${id}/brightness/minidisplay/value`, value * 100);
            }
        });
        MQTTclient.subscribe(`${id}/brightness/leds/value`, (err) =>
        {
            if (err)
            {
                this.homey.app.updateLog("setupMQTTClient.onConnect 'homey/toggle' error: " * this.homey.app.varToString(err), 0);
            }
            else
            {
                const value = this.getCapabilityValue('dim.led');
                this.homey.app.publishMQTTMessage('homey', `${id}/brightness/leds/value`, value * 100);
            }
        });
    }

    async onCapabilityDim(mqttTopic, value, opts)
    {
        this.homey.app.triggerDim( this, mqttTopic, value)
        if (opts && opts.mqtt)
        {
            // From MQTT, don't send it back
            return;
        }
    
        // Publish the new value to the MQTT broker
        const { id } = this.getData();
        this.homey.app.publishMQTTMessage('homey', `${id}/brightness/${mqttTopic}/value`, value * 100);
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
        }
        if (changedKeys.includes('mac'))
        {
            // Ensure it is a valid MAC address
            const mac = newSettings.mac;
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
            const langCode = newSettings.langCode;
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
            if (topic[2] === 'largedisplay')
            {
                this.triggerCapabilityListener('dim.large', dim, { mqtt: true }).catch((e) => this.log(e));
            }
            else if (topic[2] === 'minidisplay')
            {
                this.triggerCapabilityListener('dim.small', dim, { mqtt: true }).catch((e) => this.log(e));
            }
            else if (topic[2] === 'leds')
            {
                this.triggerCapabilityListener('dim.led', dim, { mqtt: true }).catch((e) => this.log(e));
            }
        }
    }

    async updateConnectorTopLabel(left_right, connector, label)
    {
        const { id } = this.getData();
        var item = null;
        if (this.hasCapability(`configuration_button.connector${connector}`))
        {
            // Get the configuration number for this connector
            const configNo = this.getCapabilityValue(`configuration_button.connector${connector}`);
            item = this.homey.app.buttonConfigurations[configNo];
        }
    
        if (left_right === 'left')
        {
            let brokerId = item.leftBrokerId;
            if (brokerId === 'Default')
            {
                brokerId = this.homey.settings.get('defaultBroker');
            }
    
            if (item && item.leftDevice !== 'customMQTT' && item.leftDevice !== 'none')
            {
                return this.homey.app.publishMQTTMessage(brokerId, `homey/${item.leftDevice}/${item.leftCapability}/toplabel`, label);
            }

            return this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/button/${connector * 2}/toplabel`, label);
        }
        else
        {
            let brokerId = item.rightBrokerId;
            if (brokerId === 'Default')
            {
                brokerId = this.homey.settings.get('defaultBroker');
            }
    
            if (item && item.rightDevice !== 'customMQTT' && item.rightDevice !== 'none')
            {
                return this.homey.app.publishMQTTMessage(brokerId, `homey/${item.rightDevice}/${item.rightCapability}/toplabel`, label);
            }

            return this.homey.app.publishMQTTMessage(brokerId, `homey/${id}//button/${connector * 2 + 1}/toplabel`, label);
        }
    }

    async updateConfigTopLabel(left_right, configNo, label)
    {
        const item = this.homey.app.buttonConfigurations[configNo];
        if (item)
        {
            if (left_right === 'left')
            {
                if (item.leftDevice !== 'customMQTT')
                {
                    if (item.leftDevice !== 'none')
                    {
                        let brokerId = item.leftBrokerId;
                        if (brokerId === 'Default')
                        {
                            brokerId = this.homey.settings.get('defaultBroker');
                        }
                        this.homey.app.publishMQTTMessage(brokerId, `homey/${item.leftDevice}/${item.leftCapability}/toplabel`, label);
                    }
                    else
                    {
                        // Find the button connector that has this configuration
                        for (let connector = 0; connector < 8; connector++)
                        {
                            if (this.hasCapability(`configuration_button.connector${connector}`))
                            {
                                // Get the configuration number for this connector
                                const config = this.getCapabilityValue(`configuration_button.connector${connector}`);
                                if (config == configNo)
                                {
                                    return this.updateConnectorTopLabel('left', connector, label);
                                }
                            }
                        }

                        throw new Error('Configuration is not assigned to a button');
                    }
                }
                else
                {
                    throw new Error('Custom MQTT not compatible');
                }
            }
            else
            {
                if (item.rightDevice !== 'customMQTT')
                {
                    if (item.rightDevice !== 'none')
                    {
                        let brokerId = item.rightBrokerId;
                        if (brokerId === 'Default')
                        {
                            brokerId = this.homey.settings.get('defaultBroker');
                        }
                        this.homey.app.publishMQTTMessage(brokerId, `homey/${item.rightDevice}/${item.rightCapability}/toplabel`, label);
                    }
                    else
                    {
                        // Find the button connector that has this configuration
                        for (let connector = 0; connector < 8; connector++)
                        {
                            if (this.hasCapability(`configuration_button.connector${connector}`))
                            {
                                // Get the configuration number for this connector
                                const config = this.getCapabilityValue(`configuration_button.connector${connector}`);
                                if (config == configNo)
                                {
                                    return this.updateConnectorTopLabel('right', connector, label);
                                }
                            }
                        }

                        throw new Error('Configuration is not assigned to a button');
                    }
                }
                else
                {
                    throw new Error('Custom MQTT not compatible');
                }
            }
        }
        else
        {
            throw new Error('Invalid configuration number');
        }
    }

    async updateDateAndTime(dateTime)
    {
        if (this.hasCapability('date'))
        {
            let date = '';
            let formatString = { year: 'numeric', month: 'long', day: '2-digit' }
            formatString.day = this.dateFormat;
            formatString.month = this.monthFormat;
            formatString.year = this.yearFormat;
            let weekdayFormat = this.weekdayFormat;
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

            this.setCapabilityValue('date', date).catch(this.error);
            this.setCapabilityValue('time', time).catch(this.error);
        }
    }
}

module.exports = PanelDevice;
