'use strict';

const { Device } = require('homey');

class BasePanelDevice extends Device
{

    /**
     * onInit is called when the device is initialized.
     */
    async onInit()
    {
        this.registerCapabilityListener('configuration.display', this.onCapabilityDisplayConfiguration.bind(this));

        if (this.hasCapability('configuration.connector1'))
        {
            if (this.getSetting('connect1Type') !== 1) // 1 = button panel
            {
                this.removeCapability('configuration.connector1');
                this.removeCapability('left_button.connector1');
                this.removeCapability('right_button.connector1');
            }
            else
            {
                this.registerCapabilityListener('configuration.connector1', this.onCapabilityConfiguration.bind(this, 1));
                this.registerCapabilityListener('left_button.connector1', this.onCapabilityLeftButton.bind(this, 1));
                this.registerCapabilityListener('right_button.connector1', this.onCapabilityRightButton.bind(this, 1));
            }
        }

        if (this.hasCapability('configuration.connector2'))
        {
            if (this.getSetting('connect2Type') !== 1) // 1 = button panel
            {
                this.removeCapability('configuration.connector2');
                this.removeCapability('left_button.connector2');
                this.removeCapability('right_button.connector2');
            }
            else
            {
                this.registerCapabilityListener('configuration.connector2', this.onCapabilityConfiguration.bind(this, 2));
                this.registerCapabilityListener('left_button.connector2', this.onCapabilityLeftButton.bind(this, 2));
                this.registerCapabilityListener('right_button.connector2', this.onCapabilityRightButton.bind(this, 2));
            }
        }

        if (this.hasCapability('configuration.connector3'))
        {
            if (this.getSetting('connect3Type') !== 1) // 1 = button panel
            {
                this.removeCapability('configuration.connector3');
                this.removeCapability('left_button.connector3');
                this.removeCapability('right_button.connector3');
            }
            else
            {
                this.registerCapabilityListener('configuration.connector3', this.onCapabilityConfiguration.bind(this, 3));
                this.registerCapabilityListener('left_button.connector3', this.onCapabilityLeftButton.bind(this, 3));
                this.registerCapabilityListener('right_button.connector3', this.onCapabilityRightButton.bind(this, 3));
            }
        }

        if (this.hasCapability('configuration.connector4'))
        {
            if (this.getSetting('connect4Type') !== 1) // 1 = button panel
            {
                this.removeCapability('configuration.connector4');
                this.removeCapability('left_button.connector4');
                this.removeCapability('right_button.connector4');
            }
            else
            {
                this.registerCapabilityListener('configuration.connector4', this.onCapabilityConfiguration.bind(this, 4));
                this.registerCapabilityListener('left_button.connector4', this.onCapabilityLeftButton.bind(this, 4));
                this.registerCapabilityListener('right_button.connector4', this.onCapabilityRightButton.bind(this, 4));
            }
        }

        this.uploadPanelConfigurations();
        this.uploadDisplayConfigurations();

        this.log('MyDevice has been initialized');
    }

    /**
     * onAdded is called when the user adds the device, called just after pairing.
     */
    async onAdded()
    {
        this.log('MyDevice has been added');
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
        this.log('MyDevice settings where changed');
    }

    /**
     * onRenamed is called when the user updates the device's name.
     * This method can be used this to synchronise the name to the device.
     * @param {string} name The new name
     */
    async onRenamed(name)
    {
        this.log('MyDevice was renamed');
    }

    /**
     * onDeleted is called when the user deleted the device.
     */
    async onDeleted()
    {
        this.log('MyDevice has been deleted');
    }

    onCapabilityDisplayConfiguration(value, opts)
    {
        this.log('onCapabilityConfiguration', value, opts);
        const ip = this.getSetting('address');
        this.homey.app.uploadDisplayConfiguration(ip, value);
    }

    onCapabilityConfiguration(connector, value, opts)
    {
        this.log('onCapabilityConfiguration', connector, value, opts);
        const ip = this.getSetting('address');
        this.homey.app.uploadPanelConfiguration(ip, connector, value);
    }

    onCapabilityLeftButton(connector, value, opts)
    {
        this.log('onCapabilityLeftButton', connector, value, opts);
        const configNo = this.getCapabilityValue(`configuration.connector${connector}`);
        if (configNo === null)
        {
            throw new Error(`Connector ${connector} needs a Configuration assigned to it on the next page`);
        }
        const panelConfiguration = this.homey.app.panelConfigurations[configNo];

        this.homey.app.publishMQTTMessage(`homey/${panelConfiguration.leftDevice}/${panelConfiguration.leftCapability}/value`, value);
    }

    onCapabilityRightButton(connector, value, opts)
    {
        this.log('onCapabilityLeftButton', connector, value, opts);
        const configNo = this.getCapabilityValue(`configuration.connector${connector}`);
        if (configNo === null)
        {
            throw new Error(`Connector ${connector} needs a Configuration assigned to it on the next page`);
        }
        const panelConfiguration = this.homey.app.panelConfigurations[configNo];
        this.homey.app.publishMQTTMessage(`homey/${panelConfiguration.rightDevice}/${panelConfiguration.rightCapability}/value`, value);
    }

    async processMQTTMessage(topic, MQTTMessage)
    {
        this.homey.app.updateLog(`MQTT message received: ${topic}, ${this.homey.app.varToString(MQTTMessage)}`);
        if (topic === 'homey/click')
        {
            const configNo = this.getCapabilityValue(`configuration.connector${MQTTMessage.connector}`);
            const panelConfiguration = this.homey.app.panelConfigurations[configNo];
            let buttonCapability = '';
            let homeyDeviceID = '';
            let homeyCapabilityName = '';

            if (MQTTMessage.side === 'left')
            {
                buttonCapability = `left_button.connector${MQTTMessage.connector}`;
                homeyDeviceID = panelConfiguration.leftDevice;
                homeyCapabilityName = panelConfiguration.leftCapability;
            }
            else if (MQTTMessage.side === 'right')
            {
                buttonCapability = `right_button.connector${MQTTMessage.connector}`;
                homeyDeviceID = panelConfiguration.rightDevice;
                homeyCapabilityName = panelConfiguration.rightCapability;
            }

            if ((homeyDeviceID === MQTTMessage.device) && (homeyCapabilityName === MQTTMessage.capability))
            {
                const value = !this.getCapabilityValue(buttonCapability);
                this.setCapabilityValue(buttonCapability, value).catch(this.error);

                // Find the Homey capability that is linked to the MQTT topic
                if (homeyDeviceID !== 'none')
                {
                    const homeyDeviceObject = await this.homey.app.getHomeyDeviceById(homeyDeviceID);
                    homeyDeviceObject.setCapabilityValue(homeyCapabilityName, value).catch(this.error);

                    this.homey.app.publishMQTTMessage(`homey/${homeyDeviceID}/${homeyCapabilityName}/value`, value);
                }
            }
        }
    }

    updateGatewayConfig(oldIp, newIp)
    {
        const ip = this.getSetting('address');
        if (ip === oldIp)
        {
            this.setSettings({ address: newIp });
        }
    }

    async uploadPanelConfigurations()
    {
        const ip = this.getSetting('address');

        // download the current configuration from the device
        const deviceConfiguration = await this.homey.app.readDeviceConfiguration(ip, this.homey.app.virtualID);

        if (deviceConfiguration)
        {
            if (this.hasCapability('configuration.connector1'))
            {
                // apply the new configuration to this button bar section
                const configNo = this.getCapabilityValue('configuration.connector1');
                try
                {
                    if (configNo)
                    {
                        await this.homey.app.applyPanelConfiguration(deviceConfiguration, 1, configNo);
                    }
                }
                catch (error)
                {
                    this.homey.app.updateLog(error);
                }
            }
            if (this.hasCapability('configuration.connector2'))
            {
                // apply the new configuration to this button bar section
                const configNo = this.getCapabilityValue('configuration.connector2');
                try
                {
                    if (configNo)
                    {
                        await this.homey.app.applyPanelConfiguration(deviceConfiguration, 2, configNo);
                    }
                }
                catch (error)
                {
                    this.homey.app.updateLog(error);
                }
            }
            if (this.hasCapability('configuration.connector3'))
            {
                // apply the new configuration to this button bar section
                const configNo = this.getCapabilityValue('configuration.connector3');
                try
                {
                    if (configNo)
                    {
                        await this.homey.app.applyPanelConfiguration(deviceConfiguration, 3, configNo);
                    }
                }
                catch (error)
                {
                    this.homey.app.updateLog(error);
                }
            }
            if (this.hasCapability('configuration.connector4'))
            {
                // apply the new configuration to this panel section
                const configNo = this.getCapabilityValue('configuration.connector4');
                try
                {
                    if (configNo)
                    {
                        await this.homey.app.applyPanelConfiguration(deviceConfiguration, 4, configNo);
                    }
                }
                catch (error)
                {
                    this.homey.app.updateLog(error);
                }
            }

            this.homey.app.updateLog(`Device configuration: ${this.homey.app.varToString(deviceConfiguration)}`);

            try
            {
                // write the updated configuration back to the device
                await this.homey.app.writeDeviceConfiguration(ip, deviceConfiguration, this.homey.app.virtualID);
            }
            catch (error)
            {
                this.log(error);
            }
        }
    }

    async uploadDisplayConfigurations()
    {
        const ip = this.getSetting('address');

        // apply the new display configuration to this unit
        const configNo = this.getCapabilityValue('configuration.display');
        try
        {
            if (await this.homey.app.uploadDisplayConfiguration(ip, configNo))
            {
                // Send each of the display values referenced in the config to the device
                const displayConfiguration = this.homey.app.displayConfigurations[configNo];
                for (let itemNo = 0; itemNo < displayConfiguration.items.length; itemNo++)
                {
                    const item = displayConfiguration.items[itemNo];
                    if (item !== undefined)
                    {
                        if (item.device !== 'none')
                        {
                            const homeyDeviceObject = await this.homey.app.getHomeyDeviceById(item.device);
                            try
                            {
                                if (homeyDeviceObject)
                                {
                                    const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObject, item.capability);
                                    this.homey.app.publishMQTTMessage(`homey/${item.device}/${item.capability}/value`, capability.value);
                                }
                            }
                            catch (error)
                            {
                                this.homey.app.updateLog(error.message);
                            }
                        }
                    }
                }
            }
        }
        catch (error)
        {
            this.homey.app.updateLog(error);
        }
    }

}

module.exports = BasePanelDevice;
