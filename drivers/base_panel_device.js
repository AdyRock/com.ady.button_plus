'use strict';

const { Device } = require('homey');

class BasePanelDevice extends Device
{

    /**
     * onInit is called when the device is initialized.
     */
    async onInit()
    {
        this.registerCapabilityListener('configuration.connector1', this.onCapabilityConfiguration.bind(this, 1));
        this.registerCapabilityListener('configuration.connector2', this.onCapabilityConfiguration.bind(this, 2));
        this.registerCapabilityListener('configuration.connector3', this.onCapabilityConfiguration.bind(this, 3));
        this.registerCapabilityListener('configuration.connector4', this.onCapabilityConfiguration.bind(this, 4));

        this.registerCapabilityListener('left_button.connector1', this.onCapabilityLeftButton.bind(this, 1));
        this.registerCapabilityListener('left_button.connector2', this.onCapabilityLeftButton.bind(this, 2));
        this.registerCapabilityListener('left_button.connector3', this.onCapabilityLeftButton.bind(this, 3));
        this.registerCapabilityListener('left_button.connector4', this.onCapabilityLeftButton.bind(this, 4));

        this.registerCapabilityListener('right_button.connector1', this.onCapabilityRightButton.bind(this, 1));
        this.registerCapabilityListener('right_button.connector2', this.onCapabilityRightButton.bind(this, 2));
        this.registerCapabilityListener('right_button.connector3', this.onCapabilityRightButton.bind(this, 3));
        this.registerCapabilityListener('right_button.connector4', this.onCapabilityRightButton.bind(this, 4));

        this.uploadConfigurations();

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
        const panelConfiguration = this.homey.app.panelConfigurations[configNo];

        this.homey.app.publishMQTTMessage(`homey/${panelConfiguration.leftDevice}/${panelConfiguration.leftCapability}/onoff`, value ? 'ON' : 'OFF');
    }

    onCapabilityRightButton(connector, value, opts)
    {
        this.log('onCapabilityLeftButton', connector, value, opts);
        const configNo = this.getCapabilityValue(`configuration.connector${connector}`);
        const panelConfiguration = this.homey.app.panelConfigurations[configNo];
        this.homey.app.publishMQTTMessage(`homey/${panelConfiguration.rightDevice}/${panelConfiguration.rightCapability}/onoff`, value ? 'ON' : 'OFF');
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

                    this.homey.app.publishMQTTMessage(`homey/${homeyDeviceID}/${homeyCapabilityName}/onoff`, value ? 'ON' : 'OFF');
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

    async uploadConfigurations()
    {
        const ip = this.getSetting('address');

        // download the current configuration from the device
        const deviceConfiguration = await this.homey.app.readDeviceConfiguration(ip, this.homey.app.virtualID);

        if (this.hasCapability('configuration.connector1'))
        {
            // apply the new configuration to this panel section
            const configNo = this.getCapabilityValue('configuration.connector1');
            try
            {
                await this.homey.app.applyPanelConfiguration(deviceConfiguration, 1, configNo);
            }
            catch (error)
            {
                this.homey.app.updateLog(error);
            }
        }
        if (this.hasCapability('configuration.connector2'))
        {
            // apply the new configuration to this panel section
            const configNo = this.getCapabilityValue('configuration.connector2');
            try
            {
                await this.homey.app.applyPanelConfiguration(deviceConfiguration, 2, configNo);
            }
            catch (error)
            {
                this.homey.app.updateLog(error);
            }
        }
        if (this.hasCapability('configuration.connector3'))
        {
            // apply the new configuration to this panel section
            const configNo = this.getCapabilityValue('configuration.connector3');
            try
            {
                await this.homey.app.applyPanelConfiguration(deviceConfiguration, 3, configNo);
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
                await this.homey.app.applyPanelConfiguration(deviceConfiguration, 4, configNo);
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

module.exports = BasePanelDevice;
