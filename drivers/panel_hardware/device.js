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

        if (this.getSetting('dateFormat') == null)
        {
            this.setSetting('dateFormat', '2-digit');
        }

        if (this.getSetting( 'monthFormat') == null)
        {
            this.setSetting('monthFormat', 'short');
        }

        if (this.getSetting('yearFormat') == null)
        {
            this.setSetting('yearFormat', 'numeric');
        }

        if (this.getSetting('timeFormat') == null)
        {
            this.setSettings({ timeFormat: '24h' });
        }

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

        const ip = this.getSetting('address');

        this.registerCapabilityListener('dim.large', this.onCapabilityDim.bind(this, 'largedisplay'));
        this.registerCapabilityListener('dim.small', this.onCapabilityDim.bind(this, 'minidisplay'));
        this.registerCapabilityListener('dim.led', this.onCapabilityDim.bind(this, 'leds'));
        
        this.registerCapabilityListener('button.update_firmware', async () => {
            // Maintenance action button was pressed
            return await this.homey.app.updateFirmware(ip);
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
                this.omey.app.updateLog("setupMQTTClient.onConnect 'homey/toggle' error: " * this.homey.app.varToString(err), 0);
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
                this.updateLog("setupMQTTClient.onConnect 'homey/toggle' error: " * this.homey.app.varToString(err), 0);
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
                this.updateLog("setupMQTTClient.onConnect 'homey/toggle' error: " * this.homey.app.varToString(err), 0);
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
        if (this.dateTimer)
        {
            this.homey.clearInterval(this.dateTimer);
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
            if (item && item.leftDevice !== 'customMQTT' && item.leftDevice !== 'none')
            {
                return this.homey.app.publishMQTTMessage(item.leftBrokerId, `homey/${item.leftDevice}/${item.leftCapability}/toplabel`, label);
            }

            return this.homey.app.publishMQTTMessage('homey', `${id}/button/${connector * 2}/toplabel`, label);
        }
        else
        {
            if (item && item.rightDevice !== 'customMQTT' && item.rightDevice !== 'none')
            {
                return this.homey.app.publishMQTTMessage(item.rightBrokerId, `homey/${item.rightDevice}/${item.rightCapability}/toplabel`, label);
            }

            return this.homey.app.publishMQTTMessage('homey', `${id}//button/${connector * 2 + 1}/toplabel`, label);
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
                        this.homey.app.publishMQTTMessage(item.leftBrokerId, `homey/${item.leftDevice}/${item.leftCapability}/toplabel`, label);
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
                        this.homey.app.publishMQTTMessage(item.rightBrokerId, `homey/${item.rightDevice}/${item.rightCapability}/toplabel`, label);
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
}

module.exports = PanelDevice;
