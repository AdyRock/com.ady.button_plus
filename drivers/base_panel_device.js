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
                await this.removeCapability('configuration.connector1');
                await this.removeCapability('left_button.connector1');
                await this.removeCapability('right_button.connector1');
            }
            else
            {
                await this.registerCapabilityListener('configuration.connector1', this.onCapabilityConfiguration.bind(this, 1));
                await this.registerCapabilityListener('left_button.connector1', this.onCapabilityLeftButton.bind(this, 1));
                await this.registerCapabilityListener('right_button.connector1', this.onCapabilityRightButton.bind(this, 1));

                await this.syncCapability(1);
            }
        }

        if (this.hasCapability('configuration.connector2'))
        {
            if (this.getSetting('connect2Type') !== 1) // 1 = button panel
            {
                await this.removeCapability('configuration.connector2');
                await this.removeCapability('left_button.connector2');
                await this.removeCapability('right_button.connector2');
            }
            else
            {
                await this.registerCapabilityListener('configuration.connector2', this.onCapabilityConfiguration.bind(this, 2));
                await this.registerCapabilityListener('left_button.connector2', this.onCapabilityLeftButton.bind(this, 2));
                await this.registerCapabilityListener('right_button.connector2', this.onCapabilityRightButton.bind(this, 2));

                await this.syncCapability(2);
            }
        }

        if (this.hasCapability('configuration.connector3'))
        {
            if (this.getSetting('connect3Type') !== 1) // 1 = button panel
            {
                await this.removeCapability('configuration.connector3');
                await this.removeCapability('left_button.connector3');
                await this.removeCapability('right_button.connector3');
            }
            else
            {
                await this.registerCapabilityListener('configuration.connector3', this.onCapabilityConfiguration.bind(this, 3));
                await this.registerCapabilityListener('left_button.connector3', this.onCapabilityLeftButton.bind(this, 3));
                await this.registerCapabilityListener('right_button.connector3', this.onCapabilityRightButton.bind(this, 3));

                await this.syncCapability(3);
            }
        }

        if (this.hasCapability('configuration.connector4'))
        {
            if (this.getSetting('connect4Type') !== 1) // 1 = button panel
            {
                await this.removeCapability('configuration.connector4');
                await this.removeCapability('left_button.connector4');
                await this.removeCapability('right_button.connector4');
            }
            else
            {
                await this.registerCapabilityListener('configuration.connector4', this.onCapabilityConfiguration.bind(this, 4));
                await this.registerCapabilityListener('left_button.connector4', this.onCapabilityLeftButton.bind(this, 4));
                await this.registerCapabilityListener('right_button.connector4', this.onCapabilityRightButton.bind(this, 4));

                await this.syncCapability(4);
            }
        }

        await this.uploadButtonConfigurations();
        await this.uploadDisplayConfigurations();

        this.log('MyDevice has been initialized');
    }

    async syncCapability(connector)
    {
        const configNo = this.getCapabilityValue(`configuration.connector${connector}`);
        if (configNo === null)
        {
            return;
        }
        const ButtonPanelConfiguration = this.homey.app.buttonConfigurations[configNo];

        let value = 0;

        if (ButtonPanelConfiguration.leftDevice !== 'none')
        {
            const homeyDeviceObjectLeft = await this.homey.app.getHomeyDeviceById(ButtonPanelConfiguration.leftDevice);
            if (homeyDeviceObjectLeft)
            {
                const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObjectLeft, ButtonPanelConfiguration.leftCapability);
                value = capability.value;
                if (capability.id === 'dim')
                {
                    value = false;
                }
                this.setCapabilityValue(`left_button.connector${connector}`, value).catch(this.error);
            }

            this.homey.app.publishMQTTMessage(`homey/${ButtonPanelConfiguration.leftDevice}/${ButtonPanelConfiguration.leftCapability}/value`, value);
            this.homey.app.publishMQTTMessage(`homey/${ButtonPanelConfiguration.leftDevice}/${ButtonPanelConfiguration.leftCapability}/label`,
                value ? ButtonPanelConfiguration.leftOnText : ButtonPanelConfiguration.leftOffText);
        }
        else
        {
            this.homey.app.publishMQTTMessage(`homey/button/${connector * 2}/value`, value);
            this.homey.app.publishMQTTMessage(`homey/button/${connector * 2}/label`,
                value ? ButtonPanelConfiguration.leftOnText : ButtonPanelConfiguration.leftOffText);
        }
        value = 0;

        if (ButtonPanelConfiguration.rightDevice !== 'none')
        {
            const homeyDeviceObjectRight = await this.homey.app.getHomeyDeviceById(ButtonPanelConfiguration.rightDevice);
            if (homeyDeviceObjectRight)
            {
                const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObjectRight, ButtonPanelConfiguration.rightCapability);
                value = capability.value;
                if (capability.id === 'dim')
                {
                    value = false;
                }
                this.setCapabilityValue(`right_button.connector${connector}`, value).catch(this.error);
            }

            this.homey.app.publishMQTTMessage(`homey/${ButtonPanelConfiguration.rightDevice}/${ButtonPanelConfiguration.rightCapability}/value`, value);
            this.homey.app.publishMQTTMessage(`homey/${ButtonPanelConfiguration.rightDevice}/${ButtonPanelConfiguration.rightCapability}/label`,
                value ? ButtonPanelConfiguration.leftOnText : ButtonPanelConfiguration.leftOffText);
        }
        else
        {
            this.homey.app.publishMQTTMessage(`homey/button/${connector * 2 + 1}/value`, value);
            this.homey.app.publishMQTTMessage(`homey/button/${connector * 2 + 1}/label`,
                value ? ButtonPanelConfiguration.leftOnText : ButtonPanelConfiguration.leftOffText);
        }
    }

    /**
     * onAdded is called when the user adds the device, called just after pairing.
     */
    async onAdded()
    {
        // if (this.hasCapability('configuration.connector1'))
        // {
        //     if (this.getSetting('connect1Type') !== 1) // 1 = button panel
        //     {
        //         await this.removeCapability('configuration.connector1');
        //         await this.removeCapability('left_button.connector1');
        //         await this.removeCapability('right_button.connector1');
        //     }
        // }

        // if (this.hasCapability('configuration.connector2'))
        // {
        //     if (this.getSetting('connect2Type') !== 1) // 1 = button panel
        //     {
        //         await this.removeCapability('configuration.connector2');
        //         await this.removeCapability('left_button.connector2');
        //         await this.removeCapability('right_button.connector2');
        //     }
        // }

        // if (this.hasCapability('configuration.connector3'))
        // {
        //     if (this.getSetting('connect3Type') !== 1) // 1 = button panel
        //     {
        //         await this.removeCapability('configuration.connector3');
        //         await this.removeCapability('left_button.connector3');
        //         await this.removeCapability('right_button.connector3');
        //     }
        // }

        // if (this.hasCapability('configuration.connector4'))
        // {
        //     if (this.getSetting('connect4Type') !== 1) // 1 = button panel
        //     {
        //         await this.removeCapability('configuration.connector4');
        //         await this.removeCapability('left_button.connector4');
        //         await this.removeCapability('right_button.connector4');
        //     }
        // }

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
        const virtualID = this.getSetting('virtualID');
        this.homey.app.uploadDisplayConfiguration(ip, virtualID, value);
    }

    onCapabilityConfiguration(connector, value, opts)
    {
        this.log('onCapabilityConfiguration', connector, value, opts);
        const ip = this.getSetting('address');
        const virtualID = this.getSetting('virtualID');
        this.homey.app.uploadButtonPanelConfiguration(ip, virtualID, connector, value);
    }

    async onCapabilityLeftButton(connector, value, opts)
    {
        this.log('onCapabilityLeftButton', connector, value, opts);
        const configNo = this.getCapabilityValue(`configuration.connector${connector}`);
        if (configNo === null)
        {
            throw new Error(`Connector ${connector} needs a Configuration assigned to it on the next page`);
        }
        const ButtonPanelConfiguration = this.homey.app.buttonConfigurations[configNo];

        if (ButtonPanelConfiguration.leftDevice !== 'none')
        {
            const homeyDeviceObject = await this.homey.app.getHomeyDeviceById(ButtonPanelConfiguration.leftDevice);
            if (homeyDeviceObject)
            {
                const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObject, ButtonPanelConfiguration.leftCapability);
                if (!capability.setable)
                {
                    // Not allowed to change this capability
                    throw new Error(`The capability ${ButtonPanelConfiguration.leftCapability} is not setable`);
                }
                if (capability.value !== value)
                {
                    homeyDeviceObject.setCapabilityValue(ButtonPanelConfiguration.leftCapability, value).catch(this.error);
                }
            }
            this.homey.app.publishMQTTMessage(`homey/${ButtonPanelConfiguration.leftDevice}/${ButtonPanelConfiguration.leftCapability}/value`, value);
            this.homey.app.publishMQTTMessage(`homey/${ButtonPanelConfiguration.leftDevice}/${ButtonPanelConfiguration.leftCapability}/label`,
                 value ? ButtonPanelConfiguration.leftOnText : ButtonPanelConfiguration.leftOffText);
        }
        else
        {
            this.homey.app.publishMQTTMessage(`homey/button/${connector * 2}/value`, value);
            this.homey.app.publishMQTTMessage(`homey/button/${connector * 2}/label`,
                 value ? ButtonPanelConfiguration.leftOnText : ButtonPanelConfiguration.leftOffText);
        }

        if (value)
        {
            this.driver.triggerButtonOn(this, true, connector);
        }
        else
        {
            this.driver.triggerButtonOff(this, true, connector);
        }
    }

    async onCapabilityRightButton(connector, value, opts)
    {
        this.log('onCapabilityLeftButton', connector, value, opts);
        const configNo = this.getCapabilityValue(`configuration.connector${connector}`);
        if (configNo === null)
        {
            throw new Error(`Connector ${connector} needs a Configuration assigned to it on the next page`);
        }
        const ButtonPanelConfiguration = this.homey.app.buttonConfigurations[configNo];
        if (ButtonPanelConfiguration.rightDevice !== 'none')
        {
            const homeyDeviceObject = await this.homey.app.getHomeyDeviceById(ButtonPanelConfiguration.rightDevice);
            if (homeyDeviceObject)
            {
                const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObject, ButtonPanelConfiguration.rightCapability);
                if (!capability.setable)
                {
                    // Not allowed to change this capability
                    throw new Error(`The capability ${ButtonPanelConfiguration.rightCapability} is not setable`);
                }
                if (capability.value !== value)
                {
                    homeyDeviceObject.setCapabilityValue(ButtonPanelConfiguration.rightCapability, value).catch(this.error);
                }
            }
            this.homey.app.publishMQTTMessage(`homey/${ButtonPanelConfiguration.rightDevice}/${ButtonPanelConfiguration.rightCapability}/value`, value);
            this.homey.app.publishMQTTMessage(`homey/${ButtonPanelConfiguration.rightDevice}/${ButtonPanelConfiguration.rightCapability}/label`,
                value ? ButtonPanelConfiguration.rightOnText : ButtonPanelConfiguration.rightOffText);
        }
        else
        {
            this.homey.app.publishMQTTMessage(`homey/button/${connector * 2 + 1}/value`, value);
            this.homey.app.publishMQTTMessage(`homey/button/${connector * 2 + 1}/label`,
                value ? ButtonPanelConfiguration.rightOnText : ButtonPanelConfiguration.rightOffText);
        }

        if (value)
        {
            this.driver.triggerButtonOn(this, false, connector);
        }
        else
        {
            this.driver.triggerButtonOff(this, false, connector);
        }
}

    async processMQTTMessage(topic, MQTTMessage)
    {
        this.homey.app.updateLog(`MQTT message received: ${topic}, ${this.homey.app.varToString(MQTTMessage)}`);
        if (topic === 'homey/click')
        {
            const configNo = this.getCapabilityValue(`configuration.connector${MQTTMessage.connector}`);
            const ButtonPanelConfiguration = this.homey.app.buttonConfigurations[configNo];
            let buttonCapability = '';
            let homeyDeviceID = '';
            let homeyCapabilityName = '';
            let buttonNumber = 0;
            let onMessage = '';
            let offMessage = '';

            if (MQTTMessage.side === 'left')
            {
                buttonCapability = `left_button.connector${MQTTMessage.connector}`;
                homeyDeviceID = ButtonPanelConfiguration.leftDevice;
                homeyCapabilityName = ButtonPanelConfiguration.leftCapability;
                buttonNumber = MQTTMessage.connector * 2;
                onMessage = ButtonPanelConfiguration.leftOnText;
                offMessage = ButtonPanelConfiguration.leftOffText;
            }
            else if (MQTTMessage.side === 'right')
            {
                buttonCapability = `right_button.connector${MQTTMessage.connector}`;
                homeyDeviceID = ButtonPanelConfiguration.rightDevice;
                homeyCapabilityName = ButtonPanelConfiguration.rightCapability;
                buttonNumber = (MQTTMessage.connector * 2) + 1;
                onMessage = ButtonPanelConfiguration.rightOnText;
                offMessage = ButtonPanelConfiguration.rightOffText;
            }

            if ((homeyDeviceID === MQTTMessage.device) && (homeyCapabilityName === MQTTMessage.capability))
            {
                let value = !this.getCapabilityValue(buttonCapability);
                try
                {
                    await this.setCapabilityValue(buttonCapability, value).catch(this.error);
                }
                catch (error)
                {
                    this.error(error);
                }

                // Find the Homey capability that is linked to the MQTT topic
                if (homeyDeviceID !== 'none')
                {
                    const homeyDeviceObject = await this.homey.app.getHomeyDeviceById(homeyDeviceID);
                    if (homeyCapabilityName === 'dim')
                    {
                        const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObject, homeyCapabilityName);

                        const change = parseInt(onMessage, 10) / 100;
                        if ((onMessage.findIndex('+') >= 0) || (onMessage.findIndex('-') >= 0))
                        {
                            value = capability.value + change;
                        }
                        else
                        {
                            value = change;
                        }
                        homeyDeviceObject.setCapabilityValue(homeyCapabilityName, value).catch(this.error);
                        await this.setCapabilityValue(buttonCapability, false).catch(this.error);
                    }
                    else
                    {
                        homeyDeviceObject.setCapabilityValue(homeyCapabilityName, value).catch(this.error);
                    }

                    this.homey.app.publishMQTTMessage(`homey/${homeyDeviceID}/${homeyCapabilityName}/value`, value);
                    this.homey.app.publishMQTTMessage(`homey/${homeyDeviceID}/${homeyCapabilityName}/label`, value ? onMessage : offMessage);

                    // TODO - check if getable and if not set a timer to set it back to the previous value
                }
                else
                {
                    this.homey.app.publishMQTTMessage(`homey/button/${buttonNumber}/value`, value);
                    this.homey.app.publishMQTTMessage(`homey/button/${buttonNumber}/label`, value ? onMessage : offMessage);
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

    async uploadButtonConfigurations()
    {
        const ip = this.getSetting('address');
        const virtualID = this.getSetting('virtualID');

        // download the current configuration from the device
        const deviceConfigurations = await this.homey.app.readDeviceConfiguration(ip, virtualID);

        if (deviceConfigurations)
        {
            if (this.hasCapability('configuration.connector1'))
            {
                // apply the new configuration to this button bar section
                const configNo = this.getCapabilityValue('configuration.connector1');
                try
                {
                    if (configNo)
                    {
                        await this.homey.app.applyButtonConfiguration(deviceConfigurations, 1, configNo);
                        await this.publishButtonCapabilities(configNo, 1);
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
                        await this.homey.app.applyButtonConfiguration(deviceConfigurations, 2, configNo);
                        await this.publishButtonCapabilities(configNo, 2);
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
                        await this.homey.app.applyButtonConfiguration(deviceConfigurations, 3, configNo);
                        await this.publishButtonCapabilities(configNo, 3);
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
                        await this.homey.app.applyButtonConfiguration(deviceConfigurations, 4, configNo);
                        await this.publishButtonCapabilities(configNo, 4);
                    }
                }
                catch (error)
                {
                    this.homey.app.updateLog(error);
                }
            }

            this.homey.app.updateLog(`Device configuration: ${this.homey.app.varToString(deviceConfigurations)}`);

            try
            {
                // write the updated configuration back to the device
                await this.homey.app.writeDeviceConfiguration(ip, deviceConfigurations, this.homey.app.virtualID);
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
        const virtualID = this.getSetting('virtualID');

        // apply the new display configuration to this unit
        const configNo = this.getCapabilityValue('configuration.display');
        try
        {
            if (await this.homey.app.uploadDisplayConfiguration(ip, virtualID, configNo))
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

    async publishButtonCapabilities(configNo, connector)
    {
        const item = this.homey.app.buttonConfigurations[configNo];
        try
        {
            if (item.leftDevice !== 'none')
            {
                const homeyDeviceObject = await this.homey.app.getHomeyDeviceById(item.leftDevice);
                if (homeyDeviceObject)
                {
                    const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObject, item.leftCapability);
                    this.homey.app.publishMQTTMessage(`homey/${item.leftDevice}/${item.leftCapability}/label`, capability.value ? item.leftOnText : item.leftOffText);
                    this.homey.app.publishMQTTMessage(`homey/${item.leftDevice}/${item.leftCapability}/value`, capability.value);
                }
            }
            else
            {
                const value = this.getCapabilityValue(`left_button.connector${connector}`);
                this.homey.app.publishMQTTMessage(`homey/button/${connector * 2}/label`, value ? item.leftOnText : item.leftOffText);
                this.homey.app.publishMQTTMessage(`homey/button/${connector * 2}/value`, value);
            }
        }
        catch (error)
        {
            this.homey.app.updateLog(error.message);
        }
        try
        {
            if (item.leftDevice !== 'none')
            {
                const homeyDeviceObject = await this.homey.app.getHomeyDeviceById(item.rightDevice);
                if (homeyDeviceObject)
                {
                    const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObject, item.rightCapability);
                    this.homey.app.publishMQTTMessage(`homey/${item.rightDevice}/${item.rightCapability}/label`, capability.value ? item.rightOnText : item.rightOffText);
                    this.homey.app.publishMQTTMessage(`homey/${item.rightDevice}/${item.rightCapability}/value`, capability.value);
                }
            }
            else
            {
                const value = this.getCapabilityValue(`right_button.connector${connector}`);
                this.homey.app.publishMQTTMessage(`homey/button/${connector * 2 + 1}/label`, value ? item.rightOnText : item.rightOffText);
                this.homey.app.publishMQTTMessage(`homey/button/${connector * 2 + 1}/value`, value);
            }
        }
        catch (error)
        {
            this.homey.app.updateLog(error.message);
        }
    }

    checkStateChange(deviceId, capability, value)
    {
        // check the configuration to see if this capability is being monitored by one of the buttons

        if (this.hasCapability('configuration.connector1'))
        {
            const configNo = this.getCapabilityValue('configuration.connector1');
            this.checkStateChangeForConnector(configNo, 1, deviceId, capability, value);
        }
        if (this.hasCapability('configuration.connector2'))
        {
            const configNo = this.getCapabilityValue('configuration.connector2');
            this.checkStateChangeForConnector(configNo, 2, deviceId, capability, value);
        }
        if (this.hasCapability('configuration.connector3'))
        {
            const configNo = this.getCapabilityValue('configuration.connector3');
            this.checkStateChangeForConnector(configNo, 3, deviceId, capability, value);
        }
        if (this.hasCapability('configuration.connector4'))
        {
            const configNo = this.getCapabilityValue('configuration.connector4');
            this.checkStateChangeForConnector(configNo, 4, deviceId, capability, value);
        }
    }

    checkStateChangeForConnector(configNo, connector, deviceId, capability, value)
    {
        // Check the left and right devices and capabilities for this connector

        const item = this.homey.app.buttonConfigurations[configNo];
        if ((item.leftDevice === deviceId) && (item.leftCapability === capability))
        {
            if (item.leftCapability === 'dim')
            {
                value = false;
            }
            this.setCapabilityValue(`left_button.connector${connector}`, value).catch(this.error);
        }

        if ((item.rightDevice === deviceId) && (item.rightCapability === capability))
        {
            if (item.rightCapability === 'dim')
            {
                value = false;
            }
            this.setCapabilityValue(`right_button.connector${connector}`, value).catch(this.error);
        }
    }

}

module.exports = BasePanelDevice;
