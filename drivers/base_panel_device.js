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

        this.buttonTime = [];
        const settings = this.getSettings();
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

        const deviceConfiguration = await this.uploadButtonConfigurations(null, false);
        if (deviceConfiguration)
        {
            // Button configurations uploaded so now do the display configuration
            await this.uploadDisplayConfigurations(deviceConfiguration, true);
        }

        this.log('MyDevice has been initialized');
    }

    async configureConnetctor(connectType, connector)
    {
        if (connectType !== 1) // 0 = not fitted, 1 = button panel, 2 = display
        {
            if (this.hasCapability(`configuration.connector${connector}`))
            {
                await this.removeCapability(`configuration.connector${connector}`);
            }

            if (connectType !== 2)
            {
                await this.removeCapability(`left_button.connector${connector}`);
                await this.removeCapability(`right_button.connector${connector}`);
            }
            else if (!this.hasCapability(`left_button.connector${connector}`))
            {
                await this.addCapability(`left_button.connector${connector}`);
                await this.addCapability(`right_button.connector${connector}`);
            }
        }
        else
        {
            if (!this.hasCapability(`configuration.connector${connector}`))
            {
                await this.addCapability(`configuration.connector${connector}`);
                await this.addCapability(`left_button.connector${connector}`);
                await this.addCapability(`right_button.connector${connector}`);
            }

            await this.registerCapabilityListener(`configuration.connector${connector}`, this.onCapabilityConfiguration.bind(this, connector));
            await this.registerCapabilityListener(`left_button.connector${connector}`, this.onCapabilityLeftButton.bind(this, connector));
            await this.registerCapabilityListener(`right_button.connector${connector}`, this.onCapabilityRightButton.bind(this, connector));

            await this.syncCapability(connector);
        }
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

        if (ButtonPanelConfiguration.leftDevice !== 'customMQTT')
        {
            if (ButtonPanelConfiguration.leftDevice !== 'none')
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

                    this.setCapabilityValue(`left_button.connector${connector}`, value).catch(this.error);
                }

                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.leftBrokerId, `homey/${ButtonPanelConfiguration.leftDevice}/${ButtonPanelConfiguration.leftCapability}/value`, value);
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.leftBrokerId, `homey/${ButtonPanelConfiguration.leftDevice}/${ButtonPanelConfiguration.leftCapability}/label`,
                    value ? ButtonPanelConfiguration.leftOnText : ButtonPanelConfiguration.leftOffText);
            }
            else
            {
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.leftBrokerId, `homey/button/${connector * 2}/value`, value);
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.leftBrokerId, `homey/button/${connector * 2}/label`,
                    value ? ButtonPanelConfiguration.leftOnText : ButtonPanelConfiguration.leftOffText);
            }
            value = 0;
        }

        if (ButtonPanelConfiguration.rightDevice !== 'customMQTT')
        {
            if (ButtonPanelConfiguration.rightDevice !== 'none')
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

                    this.setCapabilityValue(`right_button.connector${connector}`, value).catch(this.error);
                }

                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.rightBrokerId, `homey/${ButtonPanelConfiguration.rightDevice}/${ButtonPanelConfiguration.rightCapability}/value`, value);
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.rightBrokerId, `homey/${ButtonPanelConfiguration.rightDevice}/${ButtonPanelConfiguration.rightCapability}/label`,
                    value ? ButtonPanelConfiguration.rightOnText : ButtonPanelConfiguration.rightOffText);
            }
            else
            {
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.rightBrokerId, `homey/button/${connector * 2 + 1}/value`, value);
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.rightBrokerId, `homey/button/${connector * 2 + 1}/label`,
                    value ? ButtonPanelConfiguration.rightOnText : ButtonPanelConfiguration.rightOffText);
            }
        }
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
        const virtualID = this.getSetting('virtualID');
        this.homey.app.uploadDisplayConfiguration(ip, virtualID, value, null, true);
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
        if (ButtonPanelConfiguration.leftDevice !== 'customMQTT')
        {
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
                    if (capability.id === 'dim')
                    {
                        const change = parseInt(ButtonPanelConfiguration.leftOnText, 10) / 100;
                        if ((ButtonPanelConfiguration.leftOnText.indexOf('+') >= 0) || (ButtonPanelConfiguration.leftOnText.indexOf('-') >= 0))
                        {
                            value = capability.value + change;
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
                            value = change;
                        }

                        this.setCapabilityValue(`left_button.connector${connector}`, false).catch(this.error);
                    }
                    if (capability.value !== value)
                    {
                        await homeyDeviceObject.setCapabilityValue(ButtonPanelConfiguration.leftCapability, value).catch(this.error);
                    }
                }
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.leftBrokerId, `homey/${ButtonPanelConfiguration.leftDevice}/${ButtonPanelConfiguration.leftCapability}/value`, value);
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.leftBrokerId, `homey/${ButtonPanelConfiguration.leftDevice}/${ButtonPanelConfiguration.leftCapability}/label`,
                    value ? ButtonPanelConfiguration.leftOnText : ButtonPanelConfiguration.leftOffText);
            }
            else
            {
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.leftBrokerId, `homey/button/${connector * 2}/value`, value);
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.leftBrokerId, `homey/button/${connector * 2}/label`,
                    value ? ButtonPanelConfiguration.leftOnText : ButtonPanelConfiguration.leftOffText);
            }
        }

        if (value)
        {
            this.homey.app.triggerButtonOn(this, true, connector);
        }
        else
        {
            this.homey.app.triggerButtonOff(this, true, connector);
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
        if (ButtonPanelConfiguration.leftDevice !== 'customMQTT')
        {
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
                    if (capability.id === 'dim')
                    {
                        const change = parseInt(ButtonPanelConfiguration.rightDimChange, 10) / 100;
                        if ((ButtonPanelConfiguration.rightDimChange.indexOf('+') >= 0) || (ButtonPanelConfiguration.rightDimChange.indexOf('-') >= 0))
                        {
                            value = capability.value + change;
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
                            value = change;
                        }

                        this.setCapabilityValue(`right_button.connector${connector}`, false).catch(this.error);
                    }

                    if (capability.value !== value)
                    {
                        homeyDeviceObject.setCapabilityValue(ButtonPanelConfiguration.rightCapability, value).catch(this.error);
                    }
                }
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.rightrokerId, `homey/${ButtonPanelConfiguration.rightDevice}/${ButtonPanelConfiguration.rightCapability}/value`, value);
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.rightrokerId, `homey/${ButtonPanelConfiguration.rightDevice}/${ButtonPanelConfiguration.rightCapability}/label`,
                    value ? ButtonPanelConfiguration.rightOnText : ButtonPanelConfiguration.rightOffText);
            }
            else
            {
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.rightrokerId, `homey/button/${connector * 2 + 1}/value`, value);
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.rightrokerId, `homey/button/${connector * 2 + 1}/label`,
                    value ? ButtonPanelConfiguration.rightOnText : ButtonPanelConfiguration.rightOffText);
            }
        }

        if (value)
        {
            this.homey.app.triggerButtonOn(this, false, connector);
        }
        else
        {
            this.homey.app.triggerButtonOff(this, false, connector);
        }
    }

    async onCapabilityInfo(value, opts)
    {
        this.setCapabilityValue('info', value);
    }

    async processMQTTMessage(topic, MQTTMessage)
    {
        this.homey.app.updateLog('Panel processing MQTT message');
        if (topic === 'homey/click' && MQTTMessage)
        {
            let buttonCapability = '';
            const connectorNo = MQTTMessage.connector;
            if (!connectorNo)
            {
                this.homey.app.updateLog('The MQTT payload has no connector number');
                return;
            }
            const settings = this.getSettings();
            if (settings[`connect${connectorNo}Type`] === 2)
            {
                if (MQTTMessage.side === 'left')
                {
                    buttonCapability = `left_button.connector${connectorNo}`;
                }
                else if (MQTTMessage.side === 'right')
                {
                    buttonCapability = `right_button.connector${connectorNo}`;
                }

                if (buttonCapability)
                {
                    if (this.buttonTime[buttonCapability])
                    {
                        clearTimeout(this.buttonTime[buttonCapability]);
                        this.buttonTime[buttonCapability] = null;
                    }
                    await this.setCapabilityValue(buttonCapability, true).catch(this.error);
                    // trigger the flow
                    this.homey.app.triggerButtonOn(this, MQTTMessage.side === 'left', connectorNo);
                    this.buttonTime[buttonCapability] = this.homey.setTimeout(() => {
                        this.buttonTime[buttonCapability] = null;
                        this.setCapabilityValue(buttonCapability, false).catch(this.error);
                        this.homey.app.triggerButtonOff(this, MQTTMessage.side === 'left', connectorNo);
                    }, 500);
                }
                return;
            }

            const configNo = this.getCapabilityValue(`configuration.connector${connectorNo}`);
            if (configNo === null)
            {
                this.homey.app.updateLog(`Connector ${MQTTMessage.connector} needs a Configuration assigned to it`);
                return;
            }
            const ButtonPanelConfiguration = this.homey.app.buttonConfigurations[configNo];
            let homeyDeviceID = '';
            let homeyCapabilityName = '';
            let buttonNumber = 0;
            let onMessage = '';
            let offMessage = '';
            let brokerId = '';
            let dimChange = '';
            let postCapabilityValue = true;

            if (MQTTMessage.side === 'left')
            {
                buttonCapability = `left_button.connector${connectorNo}`;
                homeyDeviceID = ButtonPanelConfiguration.leftDevice;
                homeyCapabilityName = ButtonPanelConfiguration.leftCapability;
                buttonNumber = MQTTMessage.connector * 2;
                onMessage = ButtonPanelConfiguration.leftOnText;
                offMessage = ButtonPanelConfiguration.leftOffText;
                brokerId = ButtonPanelConfiguration.leftBrokerId;
                dimChange = ButtonPanelConfiguration.leftDimChange;
            }
            else if (MQTTMessage.side === 'right')
            {
                buttonCapability = `right_button.connector${connectorNo}`;
                homeyDeviceID = ButtonPanelConfiguration.rightDevice;
                homeyCapabilityName = ButtonPanelConfiguration.rightCapability;
                buttonNumber = (MQTTMessage.connector * 2) + 1;
                onMessage = ButtonPanelConfiguration.rightOnText;
                offMessage = ButtonPanelConfiguration.rightOffText;
                brokerId = ButtonPanelConfiguration.rightBrokerId;
                dimChange = ButtonPanelConfiguration.rightDimChange;
            }

            if (homeyDeviceID !== 'customMQTT')
            {
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

                            const change = parseInt(dimChange, 10) / 100;
                            if ((dimChange.indexOf('+') >= 0) || (dimChange.indexOf('-') >= 0))
                            {
                                value = capability.value + change;
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
                                value = change;
                            }
                            await homeyDeviceObject.setCapabilityValue(homeyCapabilityName, value).catch(this.error);
                            value = true;
                            if ((change < 0) && (value === 0))
                            {
                                // Reach the limit of the dimmer so use the off message
                                value = false;
                            }
                            else if ((change > 0) && (value === 1))
                            {
                                // Reach the limit of the dimmer so use the off message
                                value = false;
                            }

                            // Set the button capability to false so it acts like a button and not a toggle
                            await this.setCapabilityValue(buttonCapability, false).catch(this.error);
                        }
                        else
                        {
                            try
                            {
                                // Setting the capability value will trigger the MQTT message to be sent
                                postCapabilityValue = false;
                                await homeyDeviceObject.setCapabilityValue(homeyCapabilityName, value);
                            }
                            catch (error)
                            {
                                this.homey.app.updateLog(`Device ${homeyDeviceObject.name}: Capability ${homeyCapabilityName}, ${error.message}`);
                                this.setCapabilityValue('info', error.message).catch(this.error);
                            }
                        }

                        if (postCapabilityValue)
                        {
                            this.homey.app.publishMQTTMessage(brokerId, `homey/${homeyDeviceID}/${homeyCapabilityName}/value`, value);
                        }
                        this.homey.app.publishMQTTMessage(brokerId, `homey/${homeyDeviceID}/${homeyCapabilityName}/label`, value ? onMessage : offMessage);

                        // TODO - check if getable and if not set a timer to set it back to the previous value
                    }
                    else
                    {
                        this.homey.app.publishMQTTMessage(brokerId, `homey/button/${buttonNumber}/value`, value);
                        this.homey.app.publishMQTTMessage(brokerId, `homey/button/${buttonNumber}/label`, value ? onMessage : offMessage);
                    }
                }
            }
        }
    }

    updateGatewayConfig(id, newIp)
    {
        const thisId = this.getSetting('mac');
        if (thisId === id)
        {
            this.setSettings({ address: newIp });
        }
    }

    checkGatewayConfig()
    {
        // Check if the IP address has changed by looking up our mac address in the gateway list
        const id = this.getSetting('mac');
        const newIp = this.homey.app.findGatewayIPById(id);
        if (newIp)
        {
            this.setSettings({ address: newIp });
        }
    }

    async uploadButtonConfigurations(deviceConfigurations, writeConfiguration)
    {
        const ip = this.getSetting('address');
        const virtualID = this.getSetting('virtualID');

        if (!deviceConfigurations)
        {
            // download the current configuration from the device
            deviceConfigurations = await this.homey.app.readDeviceConfiguration(ip, virtualID);
        }

        if (deviceConfigurations)
        {
            for (let i = 0; i < (deviceConfigurations.mqttbuttons.length / 2); i++)
            {
                const buttonID = i * 2;
                if (this.hasCapability(`configuration.connector${i}`))
                {
                    // apply the new configuration to this button bar section
                    const configNo = this.getCapabilityValue(`configuration.connector${i}`);
                    try
                    {
                        if (configNo)
                        {
                            await this.homey.app.applyButtonConfiguration(deviceConfigurations, i, configNo);
                            await this.publishButtonCapabilities(configNo, i);
                        }
                        else
                        {
                            deviceConfigurations.mqttbuttons[buttonID] = { id: buttonID, label: `Btn ${buttonID}`, topics: [] };
                            deviceConfigurations.mqttbuttons[buttonID + 1] = { id: buttonID + 1, label: `Btn ${buttonID + 1}`, topics: [] };
                        }
                    }
                    catch (error)
                    {
                        this.homey.app.updateLog(error);
                    }
                }
                else
                {
                    deviceConfigurations.mqttbuttons[buttonID] = { id: buttonID, label: `Btn ${buttonID}`, topics: [] };
                    deviceConfigurations.mqttbuttons[buttonID + 1] = { id: buttonID + 1, label: `Btn ${buttonID + 1}`, topics: [] };
                }
            }

            this.homey.app.updateLog(`Device configuration: ${this.homey.app.varToString(deviceConfigurations)}`);

            // We might not want to write the configuration just yet as we are still uploading the display configuration
            if (writeConfiguration)
            {
                try
                {
                    // write the updated configuration back to the device
                    await this.homey.app.writeDeviceConfiguration(ip, deviceConfigurations, virtualID);
                }
                catch (error)
                {
                    this.log(error);
                }
            }
        }

        return deviceConfigurations;
    }

    async uploadDisplayConfigurations(deviceConfigurations, writeConfiguration)
    {
        const ip = this.getSetting('address');
        const virtualID = this.getSetting('virtualID');

        // apply the new display configuration to this unit
        const configNo = this.getCapabilityValue('configuration.display');
        if (configNo)
        {
            try
            {
                deviceConfigurations = await this.homey.app.uploadDisplayConfiguration(ip, virtualID, configNo, deviceConfigurations, writeConfiguration);

                // Send each of the display values referenced in the config to the MQTT broker
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
                                    this.homey.app.publishMQTTMessage(item.brokerId, `homey/${item.device}/${item.capability}/value`, capability.value);
                                    this.homey.app.registerDeviceCapabilityStateChange(item.device, item.capability);
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
            catch (error)
            {
                this.homey.app.updateLog(error);
            }
        }
        else
        {
            deviceConfigurations.mqttdisplays = [
                {
                    x: 0, y: 0, width: 100, fontsize: 0, align: 0, label: 'Homey says hello', round: 0, topics: [],
                },
                {
                    x: 0, y: 20, width: 100, fontsize: 0, align: 0, label: 'Open the Button+ Homey app settings to setup configurations', round: 0, topics: [],
                },
                {
                    x: 0, y: 40, width: 100, fontsize: 0, align: 0, label: 'Then use the Button+ Homey device to assign configurations', round: 0, topics: [],
                },
            ];
        }

        // We might not want to write the configuration just yet as we are still uploading the display configuration
        if (writeConfiguration)
        {
            try
            {
                // write the updated configuration back to the device
                await this.homey.app.writeDeviceConfiguration(ip, deviceConfigurations, virtualID);
            }
            catch (error)
            {
                this.log(error);
            }
        }
    }

    async publishButtonCapabilities(configNo, connector)
    {
        const item = this.homey.app.buttonConfigurations[configNo];
        try
        {
            if (item.leftDevice !== 'customMQTT')
            {
                if (item.leftDevice !== 'none')
                {
                    const homeyDeviceObject = await this.homey.app.getHomeyDeviceById(item.leftDevice);
                    if (homeyDeviceObject)
                    {
                        const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObject, item.leftCapability);
                        this.homey.app.publishMQTTMessage(item.leftBrokerId, `homey/${item.leftDevice}/${item.leftCapability}/label`, capability.value ? item.leftOnText : item.leftOffText);
                        this.homey.app.publishMQTTMessage(item.leftBrokerId, `homey/${item.leftDevice}/${item.leftCapability}/value`, capability.value);
                    }
                }
                else
                {
                    const value = this.getCapabilityValue(`left_button.connector${connector}`);
                    this.homey.app.publishMQTTMessage(item.leftBrokerId, `homey/button/${connector * 2}/label`, value ? item.leftOnText : item.leftOffText);
                    this.homey.app.publishMQTTMessage(item.leftBrokerId, `homey/button/${connector * 2}/value`, value);
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
                if (item.rightDevice !== 'none')
                {
                    const homeyDeviceObject = await this.homey.app.getHomeyDeviceById(item.rightDevice);
                    if (homeyDeviceObject)
                    {
                        const capability = await this.homey.app.getHomeyCapabilityByName(homeyDeviceObject, item.rightCapability);
                        this.homey.app.publishMQTTMessage(item.rightBrokerId, `homey/${item.rightDevice}/${item.rightCapability}/label`, capability.value ? item.rightOnText : item.rightOffText);
                        this.homey.app.publishMQTTMessage(item.rightBrokerId, `homey/${item.rightDevice}/${item.rightCapability}/value`, capability.value);
                    }
                }
                else
                {
                    const value = this.getCapabilityValue(`right_button.connector${connector}`);
                    this.homey.app.publishMQTTMessage(item.rightBrokerId, `homey/button/${connector * 2 + 1}/label`, value ? item.rightOnText : item.rightOffText);
                    this.homey.app.publishMQTTMessage(item.rightBrokerId, `homey/button/${connector * 2 + 1}/value`, value);
                }
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

        const configNo = this.getCapabilityValue('configuration.display');
        this.checkStateChangeForDisplay(configNo, deviceId, capability, value);
    }

    checkStateChangeForConnector(configNo, connector, deviceId, capability, value)
    {
        // Check the left and right devices and capabilities for this connector
        if (!configNo)
        {
            // Connector not configured
            return;
        }

        const item = this.homey.app.buttonConfigurations[configNo];
        if ((item.leftDevice === deviceId) && (item.leftCapability === capability))
        {
            if (capability === 'dim')
            {
                // convert dim value to percentage
                value *= 100;
            }

            // Publish to MQTT
            this.homey.app.publishMQTTMessage(item.leftBrokerId, `homey/${deviceId}/${capability}/value`, value);

            if (capability === 'dim')
            {
                value = false;
            }
            this.setCapabilityValue(`left_button.connector${connector}`, value).catch(this.error);
        }

        if ((item.rightDevice === deviceId) && (item.rightCapability === capability))
        {
            if (capability === 'dim')
            {
                // convert dim value to percentage
                value *= 100;
            }

            this.homey.app.publishMQTTMessage(item.rightBrokerId, `homey/${deviceId}/${capability}/value`, value);
            if (capability === 'dim')
            {
                value = false;
            }
            this.setCapabilityValue(`right_button.connector${connector}`, value).catch(this.error);
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
                    if (capability === 'dim')
                    {
                        // convert dim value to percentage
                        value *= 100;
                    }

                    // Publish to MQTT
                    this.homey.app.publishMQTTMessage(displayItem.brokerId, `homey/${deviceId}/${capability}/value`, value);
                }
            }
        }
    }

}

module.exports = BasePanelDevice;
