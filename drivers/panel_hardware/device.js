'use strict';

const { Device } = require('homey');

class PanelDevice extends Device
{

    /**
     * onInit is called when the device is initialized.
     */
    async onInit()
    {
        this.initFinished = false;
        this.longPressOccured = new Map();

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
        await this.configureConnetctor(settings.connect0Type, 0);
        await this.configureConnetctor(settings.connect1Type, 1);
        await this.configureConnetctor(settings.connect2Type, 2);
        await this.configureConnetctor(settings.connect3Type, 3);
        await this.configureConnetctor(settings.connect4Type, 4);
        await this.configureConnetctor(settings.connect5Type, 5);
        await this.configureConnetctor(settings.connect6Type, 6);
        await this.configureConnetctor(settings.connect7Type, 7);

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

        this.registerCapabilityListener('dim.large', this.onCapabilityDim.bind(this, 'largedisplay'));
        this.registerCapabilityListener('dim.small', this.onCapabilityDim.bind(this, 'minidisplay'));
        this.registerCapabilityListener('dim.led', this.onCapabilityDim.bind(this, 'leds'));

        this.registerCapabilityListener('button.update_firmware', async () =>
        {
            // Maintenance action button was pressed
            const ip = this.getSetting('address');
            return await this.homey.app.updateFirmware(ip);
        });

        this.registerCapabilityListener('button.apply_config', async () =>
        {
            // Maintenance action button was pressed
            await this.uploadConfigurations();
        });

        this.uploadConfigurations();

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

        const { id } = this.getData();
        
        mqttClient.subscribe(`homey/${id}/brightness/largedisplay/value`, (err) =>
        {
            if (err)
            {
                this.homey.app.updateLog("setupMQTTClient.onConnect 'homey/toggle' error: " * this.homey.app.varToString(err), 0);
            }
            else
            {
                const value = this.getCapabilityValue('dim.large');
                this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/brightness/largedisplay/value`, value * 100);
            }
        });
        mqttClient.subscribe(`${id}/brightness/minidisplay/value`, (err) =>
        {
            if (err)
            {
                this.homey.app.updateLog("setupMQTTClient.onConnect 'homey/toggle' error: " * this.homey.app.varToString(err), 0);
            }
            else
            {
                const value = this.getCapabilityValue('dim.small');
                this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/brightness/minidisplay/value`, value * 100);
            }
        });
        mqttClient.subscribe(`${id}/brightness/leds/value`, (err) =>
        {
            if (err)
            {
                this.homey.app.updateLog("setupMQTTClient.onConnect 'homey/toggle' error: " * this.homey.app.varToString(err), 0);
            }
            else
            {
                const value = this.getCapabilityValue('dim.led');
                this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/brightness/leds/value`, value * 100);
            }
        });
    }

    async onCapabilityDim(mqttTopic, value, opts)
    {
        this.homey.app.triggerDim(this, mqttTopic, value)
        if (opts && opts.mqtt)
        {
            // From MQTT, don't send it back
            return;
        }

        // Publish the new value to the MQTT broker
        const { id } = this.getData();
        let brokerId = this.homey.settings.get('defaultBroker');
        this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/brightness/${mqttTopic}/value`, value * 100);
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

        if (changedKeys.includes('temperatureCalibration'))
        {
            this.temperatureCalibration = newSettings.temperatureCalibration;

            setImmediate(() =>
            {
                this.uploadPanelTemperatureConfiguration().catch(this.error);
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

    async updateConnectorText(left_right, connector, label)
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
                return this.homey.app.publishMQTTMessage(brokerId, `homey/${item.leftDevice}/${item.leftCapability}/label`, label);
            }

            return this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/button/${connector * 2}/label`, label);
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
                return this.homey.app.publishMQTTMessage(brokerId, `homey/${item.rightDevice}/${item.rightCapability}/label`, label);
            }

            return this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/button/${connector * 2 + 1}/label`, label);
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

    async uploadPanelTemperatureConfiguration()
    {
        const ip = this.getSetting('address');
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
                const sectionConfiguration = {
                    mqttsensors: [
                    {
                        sensorid: 1,
                        interval: 10,
                        calibrationOffset: this.temperatureCalibration,
                        topic:
                        {
                            brokerid: brokerId,
                            topic: `homey/${this.__id}/measure_temperature/value`,
                            payload: '',
                            eventtype: 18,
                        },
                    }, ],
                };

                this.homey.app.updateLog(`writeSensorConfig: ${this.homey.app.varToString(sectionConfiguration)}`);

                const MQTTclient = this.homey.app.MQTTClients.get(brokerId);
                if (MQTTclient)
                {
                    MQTTclient.subscribe(`homey/${this.__id}/measure_temperature/value`, (err) =>
                    {
                        if (err)
                        {
                            this.homey.app.updateLog("setupMQTTClient.onConnect 'homey/sensorvalue' error: " * this.varToString(err), 0);
                        }
                    });
                }

                return await await this.homey.app.writeDeviceConfiguration(ip, sectionConfiguration);
            }
            catch (err)
            {
                this.homey.app.updateLog(`Error setting up pane temperature topic: ${err.message}`, 0);
            }
        }

        return null;
    }

    async uploadBrightnessConfiguration()
    {
        const ip = this.getSetting('address');
        if (ip !== '')
        {
            try
            {
                // Add the temperature event entry
                let brokerId = this.homey.settings.get('defaultBroker');
                const { id } = this.getData();
                const sectionConfiguration = {
                    core:
                    {
                        topics: [
                            {
                                brokerid: brokerId,
                                topic: `homey/${id}/brightness/largedisplay/value`,
                                payload: '',
                                eventtype: 5,
                            },
                            {
                                brokerid: brokerId,
                                topic: `homey/${id}/brightness/minidisplay/value`,
                                payload: '',
                                eventtype: 6,
                            },
                            {
                                brokerid: brokerId,
                                topic: `homey/${id}/brightness/leds/value`,
                                payload: '',
                                eventtype: 7,
                            },
                        ],
                    },
                };

                this.homey.app.updateLog(`writeSensorConfig: ${this.homey.app.varToString(sectionConfiguration)}`);

                const MQTTclient = this.homey.app.MQTTClients.get(brokerId);
                if (MQTTclient)
                {
                    MQTTclient.subscribe(`homey/${id}/brightness/largedisplay/value`, (err) =>
                    {
                        if (err)
                        {
                            this.homey.app.updateLog(`setupMQTTClient.onConnect 'homey/${id}/brightness/largedisplay' error:  ${this.varToString(err)}`, 0);
                        }
                    });
                    MQTTclient.subscribe(`homey/${id}/brightness/minidisplay/value`, (err) =>
                    {
                        if (err)
                        {
                            this.homey.app.updateLog(`setupMQTTClient.onConnect 'homey/${id}/brightness/minidisplay/value' error:  ${this.varToString(err)}`, 0);
                        }
                    });
                    MQTTclient.subscribe(`homey/${id}/brightness/leds/value`, (err) =>
                    {
                        if (err)
                        {
                            this.homey.app.updateLog(`setupMQTTClient.onConnect 'homey/${id}/brightness/leds/value' error:  ${this.varToString(err)}`, 0);
                        }
                    });
                }

                return await await this.homey.app.writeDeviceConfiguration(ip, sectionConfiguration);
            }
            catch (err)
            {
                this.homey.app.updateLog(`Error setting up dim topics: ${err.message}`, 0);
            }
        }

        return null;
    }

    async uploadConfigurations()
    {
        await this.uploadButtonConfigurations(null, true);
        await this.uploadDisplayConfigurations();
        await this.uploadBrokerConfigurations();
        await this.uploadPanelTemperatureConfiguration();
        await this.uploadBrightnessConfiguration();

        let brokerId = this.homey.settings.get('defaultBroker');
        await this.setupMQTTSubscriptions(brokerId);
    }

    async configureConnetctor(connectType, connector)
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

            await this.syncCapability(connector);
        }
    }

    async syncCapability(connector)
    {
        const configNo = this.getCapabilityValue(`configuration_button.connector${connector}`);
        if (configNo === null)
        {
            return;
        }
        const ButtonPanelConfiguration = this.homey.app.buttonConfigurations[configNo];
        const { id } = this.getData();

        let value = 0;

        if (ButtonPanelConfiguration.leftDevice !== 'customMQTT')
        {
            let brokerId = ButtonPanelConfiguration.leftBrokerId;
            if (brokerId === 'Default')
            {
                brokerId = this.homey.settings.get('defaultBroker');
            }

            if (ButtonPanelConfiguration.leftDevice === '_variable_')
            {
                const variable = await this.homey.app.getVariable(ButtonPanelConfiguration.leftCapability);
                if (variable && variable.type === 'boolean')
                {
                    value = variable.value;

                    // and trigger the flow
                    if (value)
                    {
                        this.homey.app.triggerButtonOn(this, true, connector + 1);
                    }
                    else
                    {
                        this.homey.app.triggerButtonOff(this, true, connector + 1);
                    }

                    this.setCapabilityValue(`left_button.connector${connector}`, value).catch(this.error);
                }

                this.homey.app.publishMQTTMessage(brokerId, `homey/${ButtonPanelConfiguration.leftDevice}/${ButtonPanelConfiguration.leftCapability}/value`, value);
                if (ButtonPanelConfiguration.leftOnText !== '' || ButtonPanelConfiguration.leftOffText !== '')
                {
                    this.homey.app.publishMQTTMessage(brokerId, `homey/${ButtonPanelConfiguration.leftDevice}/${ButtonPanelConfiguration.leftCapability}/label`, value ? ButtonPanelConfiguration.leftOnText : ButtonPanelConfiguration.leftOffText);
                }
            }
            else if (ButtonPanelConfiguration.leftDevice !== 'none')
            {
                const homeyDeviceObjectLeft = await this.homey.app.getHomeyDeviceById(ButtonPanelConfiguration.leftDevice);
                if (homeyDeviceObjectLeft)
                {
                    const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObjectLeft, ButtonPanelConfiguration.leftCapability);
                    if (capability)
                    {
                        value = capability.value;
                        if (capability.id === 'dim')
                        {
                            value = false;
                        }
                    }

                    // and trigger the flow
                    if (value)
                    {
                        this.homey.app.triggerButtonOn(this, true, connector + 1);
                    }
                    else
                    {
                        this.homey.app.triggerButtonOff(this, true, connector + 1);
                    }

                    this.setCapabilityValue(`left_button.connector${connector}`, value).catch(this.error);
                }

                this.homey.app.publishMQTTMessage(brokerId, `homey/${ButtonPanelConfiguration.leftDevice}/${ButtonPanelConfiguration.leftCapability}/value`, value);
                if (ButtonPanelConfiguration.leftOnText !== '' || ButtonPanelConfiguration.leftOffText !== '')
                {
                    this.homey.app.publishMQTTMessage(brokerId, `homey/${ButtonPanelConfiguration.leftDevice}/${ButtonPanelConfiguration.leftCapability}/label`, value ? ButtonPanelConfiguration.leftOnText : ButtonPanelConfiguration.leftOffText);
                }
            }
            else
            {
                this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/button/${connector * 2}/value`, value);
                if (ButtonPanelConfiguration.leftOnText !== '' || ButtonPanelConfiguration.leftOffText !== '')
                {
                    this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/button/${connector * 2}/label`, value ? ButtonPanelConfiguration.leftOnText : ButtonPanelConfiguration.leftOffText);
                }
            }
            value = 0;
        }

        if (ButtonPanelConfiguration.rightDevice !== 'customMQTT')
        {
            let brokerId = ButtonPanelConfiguration.rightBrokerId;
            if (brokerId === 'Default')
            {
                brokerId = this.homey.settings.get('defaultBroker');
            }

            if (ButtonPanelConfiguration.rightDevice === '_variable_')
            {
                const variable = await this.homey.app.getVariable(ButtonPanelConfiguration.rightCapability);
                if (variable && variable.type === 'boolean')
                {
                    value = variable.value;

                    // and trigger the flow
                    if (value)
                    {
                        this.homey.app.triggerButtonOn(this, false, connector + 1);
                    }
                    else
                    {
                        this.homey.app.triggerButtonOff(this, false, connector + 1);
                    }

                    this.setCapabilityValue(`left_button.connector${connector}`, value).catch(this.error);
                }

                this.homey.app.publishMQTTMessage(brokerId, `homey/${ButtonPanelConfiguration.rightDevice}/${ButtonPanelConfiguration.rightCapability}/value`, value);
                if (ButtonPanelConfiguration.rightOnText !== '' || ButtonPanelConfiguration.rightOffText !== '')
                {
                    this.homey.app.publishMQTTMessage(brokerId, `homey/${ButtonPanelConfiguration.rightDevice}/${ButtonPanelConfiguration.rightCapability}/label`, value ? ButtonPanelConfiguration.rightOnText : ButtonPanelConfiguration.rightOffText);
                }
            }
            else if (ButtonPanelConfiguration.rightDevice !== 'none')
            {
                const homeyDeviceObjectRight = await this.homey.app.getHomeyDeviceById(ButtonPanelConfiguration.rightDevice);
                if (homeyDeviceObjectRight)
                {
                    const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObjectRight, ButtonPanelConfiguration.rightCapability);
                    if (capability)
                    {
                        value = capability.value;
                        if (capability.id === 'dim')
                        {
                            value = false;
                        }
                    }

                    // and trigger the flow
                    if (value)
                    {
                        this.homey.app.triggerButtonOn(this, false, connector + 1);
                    }
                    else
                    {
                        this.homey.app.triggerButtonOff(this, false, connector + 1);
                    }

                    this.setCapabilityValue(`right_button.connector${connector}`, value).catch(this.error);
                }

                this.homey.app.publishMQTTMessage(brokerId, `homey/${ButtonPanelConfiguration.rightDevice}/${ButtonPanelConfiguration.rightCapability}/value`, value);
                if (ButtonPanelConfiguration.rightOnText !== '' || ButtonPanelConfiguration.rightOffText !== '')
                {
                    this.homey.app.publishMQTTMessage(brokerId, `homey/${ButtonPanelConfiguration.rightDevice}/${ButtonPanelConfiguration.rightCapability}/label`, value ? ButtonPanelConfiguration.rightOnText : ButtonPanelConfiguration.rightOffText);
                }
            }
            else
            {
                this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/button/${connector * 2 + 1}/value`, value);
                if (ButtonPanelConfiguration.rightOnText !== '' || ButtonPanelConfiguration.rightOffText !== '')
                {
                    this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/button/${connector * 2 + 1}/label`, value ? ButtonPanelConfiguration.rightOnText : ButtonPanelConfiguration.rightOffText);
                }
            }
        }
    }

    async onCapabilityDisplayConfiguration(value, opts)
    {
        this.log('onCapabilityConfiguration', value, opts);
        const ip = this.getSetting('address');
        const { id } = this.getData();
        await this.homey.app.uploadDisplayConfiguration(ip, value, id)
    }

    async onCapabilityConfiguration(connector, value, opts)
    {
        this.log('onCapabilityConfiguration', connector, value, opts);
        const ip = this.getSetting('address');
        const { id } = this.getData();
        await this.homey.app.uploadButtonPanelConfiguration(ip, id, connector, value)
    }

    async onCapabilityLeftButton(connector, value, opts)
    {
        this.log('onCapabilityLeftButton', connector, value, opts);

        // Setup parameters and call procesButtonClick
        const parameters = {};
        parameters.fromButton = true;
        parameters.buttonCapability = `left_button.connector${connector}`
        parameters.connector = connector;
        parameters.side = 'left';
        parameters.value = value;
        parameters.configNo = this.getCapabilityValue(`configuration_button.connector${connector}`);
        parameters.connectorType = this.getSetting(`connect${connector}Type`);

        await this.processClickMessage(parameters);
    }

    async onCapabilityRightButton(connector, value, opts)
    {
        this.log('onCapabilityLeftButton', connector, value, opts);
        // Setup parameters and call procesButtonClick
        const parameters = {};
        parameters.fromButton = true;
        parameters.buttonCapability = `right_button.connector${connector}`
        parameters.connector = connector;
        parameters.side = 'right';
        parameters.value = value;
        parameters.configNo = this.getCapabilityValue(`configuration_button.connector${connector}`);
        parameters.connectorType = this.getSetting(`connect${connector}Type`);

        await this.processClickMessage(parameters);
    }

    async onCapabilityInfo(value, opts)
    {
        this.setCapabilityValue('info', value);
    }

    async processMQTTMessage(topic, MQTTMessage)
    {
        const { id } = this.getData();
        if (!MQTTMessage || MQTTMessage.panelId != id)
        {
            // Message is not for this device
            return;
        }

        this.homey.app.updateLog(`Panel processing MQTT message: ${topic}`);

        if (MQTTMessage.connector === undefined)
        {
            // If the message has no connector number then ignore it as we don't know which button it is for
            this.homey.app.updateLog('The MQTT payload has no connector number');
            return;
        }

        // gather the parameters from various places that we need to process the message
        const parameters = { ...MQTTMessage };
        parameters.connectorType = this.getSetting(`connect${parameters.connector}Type`);
        if (parameters.connectorType === 2)
        {
            parameters.configNo = this.getCapabilityValue(`configuration_display`);
        }
        else
        {
            parameters.configNo = this.getCapabilityValue(`configuration_button.connector${parameters.connector}`);
        }

        // Setup which of our buttons (left or right) this message is for
        if (parameters.side === 'left')
        {
            parameters.buttonCapability = `left_button.connector${parameters.connector}`;
        }
        else if (parameters.side === 'right')
        {
            parameters.buttonCapability = `right_button.connector${parameters.connector}`;
        }

        if (!parameters.buttonCapability)
        {
            // If the message has no button capability then ignore it as we don't know which button it is for
            this.homey.app.updateLog('The MQTT payload has no valid button capability');
            return;
        }

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
            this.processReleaseMessage(parameters)
        }
    }

    async processClickMessage(parameters)
    {
        // Check if a large display or if no configuration assigned to this connector
        if (parameters.configNo !== null)
        {
            this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'clicked');
        }

        if ((parameters.connectorType === 2) || (parameters.configNo === null) || parameters.device === '' || parameters.capability === '')
        {
            let value = parameters.value;
            if (!parameters.fromButton)
            {
                // Only do this for on / off capabilities and not dim
                try
                {
                    value = !this.getCapabilityValue(parameters.buttonCapability);
                    await this.setCapabilityValue(parameters.buttonCapability, value).catch(this.error);

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
                catch (error)
                {
                    this.error(error);
                }
            }

            let buttonNumber = -1;
            let onMessage = '';
            let offMessage = '';
            let brokerId = '';

            if (parameters.configNo !== null)
            {
                const buttonPanelConfiguration = this.homey.app.buttonConfigurations[parameters.configNo];

                if (parameters.side === 'left')
                {
                    buttonNumber = parameters.connector * 2;
                    onMessage = buttonPanelConfiguration.leftOnText;
                    offMessage = buttonPanelConfiguration.leftOffText;
                    brokerId = buttonPanelConfiguration.leftBrokerId;
                }
                else if (parameters.side === 'right')
                {
                    buttonNumber = (parameters.connector * 2) + 1;
                    onMessage = buttonPanelConfiguration.rightOnText;
                    offMessage = buttonPanelConfiguration.rightOffText;
                    brokerId = buttonPanelConfiguration.rightBrokerId;
                }

                if (brokerId === 'Default')
                {
                    brokerId = this.homey.settings.get('defaultBroker');
                }

                const { id } = this.getData();
                if (onMessage !== '' || offMessage !== '')
                {
                    this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/button/${buttonNumber}/label`, value && onMessage ? onMessage : offMessage);
                }
                this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/button/${buttonNumber}/value`, value);
            }

            if (parameters.fromButton)
            {
                if (onMessage === '')
                {
                    // Set the button state back to false immediately
                    setImmediate(() =>
                    {
                        this.setCapabilityValue(parameters.buttonCapability, false).catch(this.error)

                        // and trigger the flow
                        this.homey.app.triggerButtonOff(this, parameters.side === 'left', parameters.connector + 1);
                        if (parameters.configNo !== null)
                        {
                            this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'released');
                        }
                    });
                }
            }
            return;
        }

        // Get the button configuration for this connector
        const buttonPanelConfiguration = this.homey.app.buttonConfigurations[parameters.configNo];
        let configDeviceID = '';
        let configCapabilityName = '';
        let buttonNumber = 0;
        let onMessage = '';
        let offMessage = '';
        let brokerId = '';
        let dimChange = '';

        // Setup which of our buttons (left or right) this message is for
        if (parameters.side === 'left')
        {
            configDeviceID = buttonPanelConfiguration.leftDevice;
            configCapabilityName = buttonPanelConfiguration.leftCapability;
            buttonNumber = parameters.connector * 2;
            onMessage = buttonPanelConfiguration.leftOnText;
            offMessage = buttonPanelConfiguration.leftOffText;
            brokerId = buttonPanelConfiguration.leftBrokerId;
            dimChange = buttonPanelConfiguration.leftDimChange;
        }
        else if (parameters.side === 'right')
        {
            configDeviceID = buttonPanelConfiguration.rightDevice;
            configCapabilityName = buttonPanelConfiguration.rightCapability;
            buttonNumber = (parameters.connector * 2) + 1;
            onMessage = buttonPanelConfiguration.rightOnText;
            offMessage = buttonPanelConfiguration.rightOffText;
            brokerId = buttonPanelConfiguration.rightBrokerId;
            dimChange = buttonPanelConfiguration.rightDimChange;
        }

        if (configDeviceID === 'customMQTT')
        {
            // we don't handle customMQTT messages
            return;
        }

        if (brokerId === 'Default')
        {
            brokerId = this.homey.settings.get('defaultBroker');
        }

        let value = 0;

        if (parameters.fromButton || ((configDeviceID === parameters.device) && (configCapabilityName === parameters.capability)))
        {
            // Check if the button has another device and capability assigned to it
            if (configDeviceID === '_variable_')
            {
                // Variables are read only so just trigger the button flows so they can do the work
                const variable = await this.homey.app.getVariable(configCapabilityName);
                if (variable && variable.type === 'boolean')
                {
                    value = variable.value;

                    // and trigger the flow
                    if (value)
                    {
                        this.homey.app.triggerButtonOn(this, true, parameters.connector + 1);
                    }
                    else
                    {
                        this.homey.app.triggerButtonOff(this, true, parameters.connector + 1);
                    }
                }

                return;
            }
            else if (configDeviceID !== 'none')
            {
                // Find the Homey device that is defined in the configuration
                const homeyDeviceObject = await this.homey.app.getHomeyDeviceById(configDeviceID);
                if (!homeyDeviceObject)
                {
                    // Device not found
                    this.homey.app.updateLog(`Device ${configDeviceID} not found`);
                    return;
                }

                // Find the capability that is defined in the configuration
                const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObject, configCapabilityName);
                if (!capability)
                {
                    // Capability not found
                    this.homey.app.updateLog(`Capability ${configCapabilityName} not found`);
                    return;
                }

                if (configCapabilityName === 'dim')
                {
                    // For dim cpaabilities we need to adjust the value by the amount in the dimChange field and not change the button state
                    // Get the required change from the dimChange field and convert it from a percentage to a value
                    const change = parseInt(dimChange, 10) / 100;
                    if ((dimChange.indexOf('+') >= 0) || (dimChange.indexOf('-') >= 0))
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
                    homeyDeviceObject.setCapabilityValue(configCapabilityName, value).catch(this.error);
                    this.homey.app.publishMQTTMessage(brokerId, `homey/${configDeviceID}/${configCapabilityName}/value`, value * 100);

                    if (parameters.fromButton)
                    {
                        // Set the button state back to false immediately
                        setImmediate(() => this.setCapabilityValue(parameters.buttonCapability, false).catch(this.error));
                    }
                    return;
                }

                try
                {
                    if (configCapabilityName === 'windowcoverings_state')
                    {
                        value = parameters.fromButton ? parameters.value : !this.getCapabilityValue(parameters.buttonCapability);;

                        if (value)
                        {
                            await homeyDeviceObject.setCapabilityValue(configCapabilityName, 'up');
                        }
                        else
                        {
                            await homeyDeviceObject.setCapabilityValue(configCapabilityName, 'down');
                        }
                    }
                    else
                    {
                        value = parameters.fromButton ? parameters.value : !capability.value;
                        await homeyDeviceObject.setCapabilityValue(configCapabilityName, value);
                    }
                    if (onMessage !== '' || offMessage !== '')
                    {
                        this.homey.app.publishMQTTMessage(brokerId, `homey/${configDeviceID}/${configCapabilityName}/label`, value ? onMessage : offMessage);
                    }
                    this.homey.app.publishMQTTMessage(brokerId, `homey/${configDeviceID}/${configCapabilityName}/value`, value);
                }
                catch (error)
                {
                    this.homey.app.updateLog(`Device ${homeyDeviceObject.name}: Capability ${configCapabilityName}, ${error.message}`);
                }
            }
            else
            {
                // No capability assigned to this button so just toggle the button
                const { id } = this.getData();
                this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/button/${buttonNumber}/value`, value);
                if (onMessage !== '' || offMessage !== '')
                {
                    this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/button/${buttonNumber}/label`, value ? onMessage : offMessage);
                }
            }
        }

        if (!parameters.fromButton)
        {
            // Only do this for on / off capabilities and not dim
            try
            {
                let value = !this.getCapabilityValue(parameters.buttonCapability);

                // and trigger the flow
                if (value)
                {
                    this.homey.app.triggerButtonOn(this, parameters.side === 'left', parameters.connector + 1);
                }
                else
                {
                    this.homey.app.triggerButtonOff(this, parameters.side === 'left', parameters.connector + 1);
                }

                await this.setCapabilityValue(parameters.buttonCapability, value).catch(this.error);
            }
            catch (error)
            {
                this.error(error);
            }
        }
    }

    async processLongPressMessage(parameters)
    {
        this.longPressOccured.set(`${parameters.connector}_${parameters.side}`, true);
        this.homey.app.triggerButtonLongPress(this, parameters.side === 'left', parameters.connector + 1);

        if (parameters.configNo !== null)
        {
            this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'long');
        }

        if (parameters.capability === 'dim')
        {
            // process another click message to change the dim value
            return this.processClickMessage(parameters);
        }
    }

    async processReleaseMessage(parameters)
    {
        this.homey.app.triggerButtonRelease(this, parameters.side === 'left', parameters.connector + 1);
        if (parameters.configNo !== null)
        {
            this.homey.app.triggerConfigButton(this, parameters.side, parameters.connectorType, parameters.configNo, 'released');
        }

        // Check if a large display or if no configuration assigned to this connector
        if ((parameters.connectorType === 2) || (parameters.configNo === null) || parameters.device === '' || parameters.capability === '')
        {
            let buttonNumber = -1;
            let onMessage = '';
            let offMessage = '';
            let brokerId = '';

            if (parameters.configNo !== null)
            {
                const buttonPanelConfiguration = this.homey.app.buttonConfigurations[parameters.configNo];

                if (parameters.side === 'left')
                {
                    buttonNumber = parameters.connector * 2;
                    onMessage = buttonPanelConfiguration.leftOnText;
                    offMessage = buttonPanelConfiguration.leftOffText;
                    brokerId = buttonPanelConfiguration.leftBrokerId;
                }
                else if (parameters.side === 'right')
                {
                    buttonNumber = (parameters.connector * 2) + 1;
                    onMessage = buttonPanelConfiguration.rightOnText;
                    offMessage = buttonPanelConfiguration.rightOffText;
                    brokerId = buttonPanelConfiguration.rightBrokerId;
                }

                if (brokerId === 'Default')
                {
                    brokerId = this.homey.settings.get('defaultBroker');
                }
            }

            if (onMessage === '')
            {
                // and trigger the flow
                this.homey.app.triggerButtonOff(this, parameters.side === 'left', parameters.connector + 1);
                await this.setCapabilityValue(parameters.buttonCapability, false).catch(this.error);

                const { id } = this.getData();
                if (offMessage !== '')
                {
                    this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/button/${buttonNumber}/label`, offMessage);
                }
                this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/button/${buttonNumber}/value`, false);
            }
        }
        else if (this.longPressOccured && this.longPressOccured.get(`${parameters.connector}_${parameters.side}`) && parameters.capability === 'windowcoverings_state')
        {
            // Send the pause command to the device if the LongPress was received
            // Get the button configuration for this connector
            const buttonPanelConfiguration = this.homey.app.buttonConfigurations[parameters.configNo];
            let configDeviceID = '';
            let configCapabilityName = '';
            let buttonNumber = 0;
            let onMessage = '';
            let offMessage = '';
            let brokerId = '';
            let dimChange = '';

            // Setup which of our buttons (left or right) this message is for
            if (parameters.side === 'left')
            {
                configDeviceID = buttonPanelConfiguration.leftDevice;
                configCapabilityName = buttonPanelConfiguration.leftCapability;
                buttonNumber = parameters.connector * 2;
                onMessage = buttonPanelConfiguration.leftOnText;
                offMessage = buttonPanelConfiguration.leftOffText;
                brokerId = buttonPanelConfiguration.leftBrokerId;
                dimChange = buttonPanelConfiguration.leftDimChange;
            }
            else if (parameters.side === 'right')
            {
                configDeviceID = buttonPanelConfiguration.rightDevice;
                configCapabilityName = buttonPanelConfiguration.rightCapability;
                buttonNumber = (parameters.connector * 2) + 1;
                onMessage = buttonPanelConfiguration.rightOnText;
                offMessage = buttonPanelConfiguration.rightOffText;
                brokerId = buttonPanelConfiguration.rightBrokerId;
                dimChange = buttonPanelConfiguration.rightDimChange;
            }

            if (configDeviceID === 'customMQTT')
            {
                // we don't handle customMQTT messages
                return;
            }

            if (brokerId === 'Default')
            {
                brokerId = this.homey.settings.get('defaultBroker');
            }

            if (((configDeviceID === parameters.device) && (configCapabilityName === parameters.capability)))
            {
                // Check if the button has another device and capability assigned to it
                if (configDeviceID !== 'none')
                {
                    // Find the Homey device that is defined in the configuration
                    const homeyDeviceObject = await this.homey.app.getHomeyDeviceById(configDeviceID);
                    if (!homeyDeviceObject)
                    {
                        // Device not found
                        this.homey.app.updateLog(`Device ${configDeviceID} not found`);
                        return;
                    }

                    // Find the capability that is defined in the configuration
                    const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObject, configCapabilityName);
                    if (!capability)
                    {
                        // Capability not found
                        this.homey.app.updateLog(`Capability ${configCapabilityName} not found`);
                        return;
                    }

                    try
                    {
                        await homeyDeviceObject.setCapabilityValue(configCapabilityName, 'idle');
                    }
                    catch (error)
                    {
                        this.homey.app.updateLog(`Device ${homeyDeviceObject.name}: Capability ${configCapabilityName}, ${error.message}`);
                    }
                }
            }
        }

        if (this.longPressOccured)
        {
            // Record that the long press has finished
            this.longPressOccured.set(`${parameters.connector}_${parameters.side}`, false);
        }
    }

    updateGatewayConfig(id, newIp)
    {
        const thisId = this.getSetting('mac');
        if (thisId === id)
        {
            // TODO: update the IP address when mDNS is fixed
            // this.setSettings({ address: newIp });
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
            }
        }
    }

    async updateTemperatureOffset()
    {
        const ip = this.getSetting('address');
        const sectionConfiguration = { 'mqttsensors': [{ calibrationOffset: this.temperatureCalibration }] };
        await this.homey.app.writeDeviceConfiguration(ip, sectionConfiguration);
    }

    async uploadButtonConfigurations(deviceConfigurations, writeConfiguration)
    {
        const ip = this.getSetting('address');
        const { id } = this.getData();

        if (!deviceConfigurations)
        {
            // download the current configuration from the device
            deviceConfigurations = await this.homey.app.readDeviceConfiguration(ip);
            if (deviceConfigurations && deviceConfigurations.core)
            {
                this.setCapabilityValue('dim.large', deviceConfigurations.core.brightnesslargedisplay / 100).catch(this.error);
                this.setCapabilityValue('dim.small', deviceConfigurations.core.brightnessminidisplay / 100).catch(this.error);
            }
        }

        if (deviceConfigurations)
        {
            let mqttQue = [];
            // Create a new section configuration for the button panel by adding the core and mqttbuttons sections of the deviceConfigurations to core and mqttbuttons of a new object
            const sectionConfiguration = {
                'core': { ...deviceConfigurations.core },
                'mqttbuttons': [...deviceConfigurations.mqttbuttons],
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
                    });
                }
            }
            let updated = false;

            // Set the core configuration values
            const largeDim = this.getCapabilityValue('dim.large');
            const smallDim = this.getCapabilityValue('dim.small');
            const ledDim = this.getCapabilityValue('dim.led');

            if (largeDim !== null)
            {
                sectionConfiguration.core.brightnesslargedisplay = largeDim * 100;
                updated = true;
            }

            if (smallDim !== null)
            {
                sectionConfiguration.core.brightnessminidisplay = smallDim * 100;
                updated = true;
            }

            if (ledDim !== null)
            {
                sectionConfiguration.core.brightnessleds = ledDim * 100;
                updated = true;
            }

            sectionConfiguration.core.calibrationOffset = this.temperatureCalibration;

            for (let i = 0; i < (sectionConfiguration.mqttbuttons.length / 2); i++)
            {
                const buttonID = i * 2;
                let configNo = 0;
                if (this.hasCapability(`configuration_button.connector${i}`))
                {
                    // apply the new configuration to this button bar section
                    configNo = this.getCapabilityValue(`configuration_button.connector${i}`);
                }

                try
                {
                    mqttQue = mqttQue.concat(await this.homey.app.applyButtonConfiguration(id, deviceConfigurations, sectionConfiguration, i, configNo));
                    // await this.publishButtonCapabilities(configNo, i);
                    updated = true;
                }
                catch (error)
                {
                    this.homey.app.updateLog(error, 0);
                }
            }

            this.homey.app.updateLog(`Device configuration: ${this.homey.app.varToString(sectionConfiguration)}`);

            // We might not want to write the configuration just yet as we are still uploading the display configuration
            if (updated && writeConfiguration)
            {
                try
                {
                    // write the updated configuration back to the device
                    await this.homey.app.writeDeviceConfiguration(ip, sectionConfiguration);

                    // Send the MQTT messages after a short delay to allow the device to connect to the broker
                    setTimeout(async () =>
                    {
                        for (const mqttMsg of mqttQue)
                        {
                            await this.homey.app.publishMQTTMessage(mqttMsg.brokerId, mqttMsg.message, mqttMsg.value, false);
                        }
                    }, 1000);
                }
                catch (error)
                {
                    this.log(error);
                }
            }
        }

        return deviceConfigurations;
    }

    async uploadDisplayConfigurations()
    {
        const ip = this.getSetting('address');
        const { id } = this.getData();

        // apply the new display configuration to this unit
        const configNo = this.getCapabilityValue('configuration_display');
        if (configNo)
        {
            try
            {
                await this.homey.app.uploadDisplayConfiguration(ip, configNo, id);

                // Send each of the display values referenced in the config to the MQTT broker
                const displayConfiguration = this.homey.app.displayConfigurations[configNo];
                for (let itemNo = 0; itemNo < displayConfiguration.items.length; itemNo++)
                {
                    const item = displayConfiguration.items[itemNo];
                    if (item !== undefined)
                    {
                        if (item.device === '_variable_')
                        {
                            const variable = await this.homey.app.getVariable(item.capability);
                            if (variable)
                            {
                                this.homey.app.publishMQTTMessage(item.brokerId, `homey/${item.device}/${item.capability}/label`, variable.value);
                                this.homey.app.publishMQTTMessage(item.brokerId, `homey/${item.device}/${item.capability}/value`, variable.value);
                            }
                        }
                        else if (item.device !== 'none')
                        {
                            const homeyDeviceObject = await this.homey.app.getHomeyDeviceById(item.device);
                            try
                            {
                                if (homeyDeviceObject)
                                {
                                    const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObject, item.capability);
                                    let brokerId = item.brokerId;
                                    if (brokerId === 'Default')
                                    {
                                        brokerId = this.homey.settings.get('defaultBroker');
                                    }
                                    this.homey.app.publishMQTTMessage(brokerId, `homey/${item.device}/${item.capability}/value`, capability.value);
                                    this.homey.app.registerDeviceCapabilityStateChange(item.device, item.capability);
                                }
                            }
                            catch (error)
                            {
                                this.homey.app.updateLog(error.message, 0);
                            }
                        }
                    }
                }
            }
            catch (error)
            {
                this.homey.app.updateLog(error, 0);
            }
        }
        else
        {
            const sectionConfiguration = {};
            sectionConfiguration.mqttdisplays = [
            {
                x: 0,
                y: 0,
                width: 100,
                fontsize: 0,
                align: 0,
                label: this.homey.__("hello1"),
                round: 0,
                topics: [],
            },
            {
                x: 0,
                y: 20,
                width: 100,
                fontsize: 0,
                align: 0,
                label: this.homey.__("hello2"),
                round: 0,
                topics: [],
            },
            {
                x: 0,
                y: 40,
                width: 100,
                fontsize: 0,
                align: 0,
                label: this.homey.__("hello3"),
                round: 0,
                topics: [],
            }, ];

            try
            {
                // write the updated configuration back to the device
                await this.homey.app.writeDeviceConfiguration(ip, sectionConfiguration);
            }
            catch (error)
            {
                this.log(error);
            }
        }
    }

    async uploadBrokerConfigurations()
    {
        const ip = this.getSetting('address');
        const sectionConfiguration = await this.homey.app.applyBrokerConfiguration(ip);

        try
        {
            // write the updated configuration back to the device
            await this.homey.app.writeDeviceConfiguration(ip, sectionConfiguration);
        }
        catch (error)
        {
            this.log(error);
        }
    }

    async publishButtonCapabilities(configNo, connector)
    {
        if (configNo === null)
        {
            return;
        }

        const item = this.homey.app.buttonConfigurations[configNo];
        if (!item)
        {
            return;
        }

        const { id } = this.getData();

        try
        {
            if (item.leftDevice !== 'customMQTT')
            {
                let brokerId = item.leftBrokerId;
                if (brokerId === 'Default')
                {
                    brokerId = this.homey.settings.get('defaultBroker');
                }

                if (item.leftDevice !== 'none')
                {
                    const homeyDeviceObject = await this.homey.app.getHomeyDeviceById(item.leftDevice);
                    if (homeyDeviceObject)
                    {
                        const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObject, item.leftCapability);
                        if (item.leftOnText !== '' || item.leftOffText !== '')
                        {
                            this.homey.app.publishMQTTMessage(brokerId, `homey/${item.leftDevice}/${item.leftCapability}/label`, capability.value && item.leftOnText ? item.leftOnText : item.leftOffText);
                        }
                        this.homey.app.publishMQTTMessage(brokerId, `homey/${item.leftDevice}/${item.leftCapability}/value`, capability.value);
                    }
                }
                else
                {
                    const value = this.getCapabilityValue(`left_button.connector${connector}`);
                    if (item.leftOnText !== '' || item.leftOffText !== '')
                    {
                        this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/button/${connector * 2}/label`, value && item.leftOnText ? item.leftOnText : item.leftOffText);
                    }
                    this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/button/${connector * 2}/value`, value);
                }
            }
        }
        catch (error)
        {
            this.homey.app.updateLog(error.message);
        }
        try
        {
            if (item.rightDevice !== 'customMQTT')
            {
                let brokerId = item.rightBrokerId;
                if (brokerId === 'Default')
                {
                    brokerId = this.homey.settings.get('defaultBroker');
                }

                if (item.rightDevice !== 'none')
                {
                    const homeyDeviceObject = await this.homey.app.getHomeyDeviceById(item.rightDevice);
                    if (homeyDeviceObject)
                    {
                        const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObject, item.rightCapability);
                        if (item.rightOnText !== '' || item.rightOffText !== '')
                        {
                            this.homey.app.publishMQTTMessage(brokerId, `homey/${item.rightDevice}/${item.rightCapability}/label`, capability.value && item.rightOnText ? item.rightOnText : item.rightOffText);
                        }
                        this.homey.app.publishMQTTMessage(brokerId, `homey/${item.rightDevice}/${item.rightCapability}/value`, capability.value);
                    }
                }
                else
                {
                    const value = this.getCapabilityValue(`right_button.connector${connector}`);
                    if (item.rightOnText !== '' || item.rightOffText !== '')
                    {
                        this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/button/${connector * 2 + 1}/label`, value && item.rightOnText ? item.rightOnText : item.rightOffText);
                    }
                    this.homey.app.publishMQTTMessage(brokerId, `homey/${id}/button/${connector * 2 + 1}/value`, value);
                }
            }
        }
        catch (error)
        {
            this.homey.app.updateLog(error.message, 0);
        }
    }

    checkStateChange(deviceId, capability, value)
    {
        // if (capability !== '_variable_')
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
        const item = this.homey.app.buttonConfigurations[configNo];
        if ((item.leftDevice === deviceId) && (item.leftCapability === capability))
        {
            let brokerId = item.leftBrokerId;
            if (brokerId === 'Default')
            {
                brokerId = this.homey.settings.get('defaultBroker');
            }

            if (capability !== 'dim')
            {
                if (capability !== 'windowcoverings_state')
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
                    this.setCapabilityValue(`left_button.connector${connector}`, value).catch(this.error);
                }
                else
                {
                    value = value === 'up';
                }
                if (item.leftOnText !== '' || item.leftOffText !== '')
                {
                    this.homey.app.publishMQTTMessage(brokerId, `homey/${deviceId}/${capability}/label`, value ? item.leftOnText : item.leftOffText);
                }
            }

            // Publish to MQTT
            this.homey.app.publishMQTTMessage(brokerId, `homey/${deviceId}/${capability}/value`, value);
        }

        if ((item.rightDevice === deviceId) && (item.rightCapability === capability))
        {
            let brokerId = item.rightBrokerId;
            if (brokerId === 'Default')
            {
                brokerId = this.homey.settings.get('defaultBroker');
            }

            if (capability !== 'dim')
            {
                if (capability !== 'windowcoverings_state')
                {
                    // and trigger the flow
                    if (value)
                    {
                        this.homey.app.triggerButtonOn(this, false, connector + 1);
                    }
                    else
                    {
                        this.homey.app.triggerButtonOff(this, false, connector + 1);
                    }

                    // Set the device button state
                    this.setCapabilityValue(`right_button.connector${connector}`, value).catch(this.error);
                }
                else
                {
                    value = value === 'up';
                }
                if (item.rightOnText !== '' || item.rightOffText !== '')
                {
                    this.homey.app.publishMQTTMessage(brokerId, `homey/${deviceId}/${capability}/label`, value ? item.rightOnText : item.rightOffText);
                }
            }

            this.homey.app.publishMQTTMessage(brokerId, `homey/${deviceId}/${capability}/value`, value);
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
                        let brokerId = displayItem.brokerId;
                        if (brokerId === 'Default')
                        {
                            brokerId = this.homey.settings.get('defaultBroker');
                        }
                        this.homey.app.publishMQTTMessage(brokerId, `homey/${deviceId}/${capability}/value`, value);
                    }
                }
            }
        }
    }

}

module.exports = PanelDevice;