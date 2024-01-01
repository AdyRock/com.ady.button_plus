'use strict';

const { Device } = require('homey');

class BasePanelDevice extends Device
{

    /**
     * onInit is called when the device is initialized.
     */
    async onInit()
    {
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

        this.longPressOccured = new Map();

        this.registerCapabilityListener('configuration_display', this.onCapabilityDisplayConfiguration.bind(this));

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

        await this.uploadButtonConfigurations(null, true);

        // Button configurations uploaded so now do the display configuration
        await this.uploadDisplayConfigurations();

        await this.uploadBrokerConfigurations();

        this.log('MyDevice has been initialized');
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
                this.setCapabilityOptions(`left_button.connector${connector}`, capabilityOption);
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
            this.setCapabilityOptions(`left_button.connector${connector}`, capabilityOption);
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
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.leftBrokerId, `${id}/button/${connector * 2}/value`, value);
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.leftBrokerId, `${id}/button/${connector * 2}/label`,
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
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.rightBrokerId, `${id}/button/${connector * 2 + 1}/value`, value);
                this.homey.app.publishMQTTMessage(ButtonPanelConfiguration.rightBrokerId, `${id}/button/${connector * 2 + 1}/label`,
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
        const parameters = {...MQTTMessage};
        parameters.connectorType = this.getSetting(`connect${parameters.connector}Type`);
        parameters.configNo = this.getCapabilityValue(`configuration_button.connector${parameters.connector}`);

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
                this.homey.app.publishMQTTMessage(brokerId, `${id}/button/${buttonNumber}/label`, value && onMessage ? onMessage : offMessage);
                this.homey.app.publishMQTTMessage(brokerId, `${id}/button/${buttonNumber}/value`, value);
            }

            if (parameters.fromButton)
            {
                if (onMessage === '')
                {
                    // Set the button state back to false immediately
                    setImmediate(() => {
                        this.setCapabilityValue(parameters.buttonCapability, false).catch(this.error)
               
                        // and trigger the flow
                        this.homey.app.triggerButtonOff(this, parameters.side === 'left', parameters.connector + 1);
                    });
                }
            }

            // and trigger the flow
            this.homey.app.triggerButtonOn(this, parameters.side === 'left', parameters.connector + 1);
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
                    this.homey.app.publishMQTTMessage(brokerId, `homey/${configDeviceID}/${configCapabilityName}/label`, value ? onMessage : offMessage);
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
                this.homey.app.publishMQTTMessage(brokerId, `${id}/button/${buttonNumber}/value`, value);
                this.homey.app.publishMQTTMessage(brokerId, `${id}/button/${buttonNumber}/label`, value ? onMessage : offMessage);
            }
        }

        if (!parameters.fromButton)
        {
            // Only do this for on / off capabilities and not dim
            try
            {
                let value = !this.getCapabilityValue(parameters.buttonCapability);
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

        if (parameters.capability === 'dim')
        {
            // process another click message to change the dim value
            return this.processClickMessage(parameters);
        }
    }

    async processReleaseMessage(parameters)
    {
        this.homey.app.triggerButtonRelease(this, parameters.side === 'left', parameters.connector + 1);

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
                await this.setCapabilityValue(parameters.buttonCapability, false).catch(this.error);

                const { id } = this.getData();
                this.homey.app.publishMQTTMessage(brokerId, `${id}/button/${buttonNumber}/label`, offMessage);
                this.homey.app.publishMQTTMessage(brokerId, `${id}/button/${buttonNumber}/value`, false);

                // and trigger the flow
                this.homey.app.triggerButtonOff(this, parameters.side === 'left', parameters.connector + 1);
            }
        }
        else if (this.longPressOccured.get(`${parameters.connector}_${parameters.side}`) && parameters.capability === 'windowcoverings_state')
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

        this.longPressOccured.set(`${parameters.connector}_${parameters.side}`, false);
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
            // Create a new section configuration for the button panel by adding the core and mqttbuttons sections of the deviceConfigurations to core and mqttbuttons of a new object
            const sectionConfiguration = {'core': {...deviceConfigurations.core},
                                          'mqttbuttons': [...deviceConfigurations.mqttbuttons],
                                         };
        
            if (sectionConfiguration.mqttbuttons.length < (deviceConfigurations.info.connectors.length * 2))
            {
                // Add the missing mqttbuttons
                for (let i = sectionConfiguration.mqttbuttons.length; i < (deviceConfigurations.info.connectors.length * 2 ); i++)
                {
                    sectionConfiguration.mqttbuttons.push({
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
                    await this.homey.app.applyButtonConfiguration(id, deviceConfigurations, sectionConfiguration, i, configNo);
                    await this.publishButtonCapabilities(configNo, i);
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
                        if (item.device !== 'none')
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
                    x: 0, y: 0, width: 100, fontsize: 0, align: 0, label: this.homey.__("hello1"), round: 0, topics: [],
                },
                {
                    x: 0, y: 20, width: 100, fontsize: 0, align: 0, label: this.homey.__("hello2"), round: 0, topics: [],
                },
                {
                    x: 0, y: 40, width: 100, fontsize: 0, align: 0, label: this.homey.__("hello3"), round: 0, topics: [],
                },
            ];

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
        const sectionConfiguration =  await this.homey.app.applyBrokerConfiguration(ip);

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
        const item = this.homey.app.buttonConfigurations[configNo];
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
                        this.homey.app.publishMQTTMessage(brokerId, `homey/${item.leftDevice}/${item.leftCapability}/label`, capability.value && item.leftOnText ? item.leftOnText : item.leftOffText);
                        this.homey.app.publishMQTTMessage(brokerId, `homey/${item.leftDevice}/${item.leftCapability}/value`, capability.value);
                    }
                }
                else
                {
                    const value = this.getCapabilityValue(`left_button.connector${connector}`);
                    this.homey.app.publishMQTTMessage(brokerId, `${id}/button/${connector * 2}/label`, value && item.leftOnText ? item.leftOnText : item.leftOffText);
                    this.homey.app.publishMQTTMessage(brokerId, `${id}/button/${connector * 2}/value`, value);
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
                        this.homey.app.publishMQTTMessage(brokerId, `homey/${item.rightDevice}/${item.rightCapability}/label`, capability.value && item.rightOnText ? item.rightOnText : item.rightOffText);
                        this.homey.app.publishMQTTMessage(brokerId, `homey/${item.rightDevice}/${item.rightCapability}/value`, capability.value);
                    }
                }
                else
                {
                    const value = this.getCapabilityValue(`right_button.connector${connector}`);
                    this.homey.app.publishMQTTMessage(brokerId, `${id}/button/${connector * 2 + 1}/label`, value && item.rightOnText ? item.rightOnText : item.rightOffText);
                    this.homey.app.publishMQTTMessage(brokerId, `${id}/button/${connector * 2 + 1}/value`, value);
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
        if (capability !== '_variable_')
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
            if (capability !== 'dim')
            {
                // Set the device button state
                this.setCapabilityValue(`left_button.connector${connector}`, value).catch(this.error);
                this.homey.app.publishMQTTMessage(item.leftBrokerId, `homey/${deviceId}/${capability}/label`, value ? item.leftOnText : item.leftOffText);
            }
            // else
            {
                // Publish to MQTT
                this.homey.app.publishMQTTMessage(item.leftBrokerId, `homey/${deviceId}/${capability}/value`, value);
            }
        }

        if ((item.rightDevice === deviceId) && (item.rightCapability === capability))
        {
            if (capability !== 'dim')
            {
                if (capability !== 'windowcoverings_state')
                {
                    // Set the device button state
                    this.setCapabilityValue(`right_button.connector${connector}`, value).catch(this.error);
                }
                else
                {
                    value = value === 'up';
                }
                this.homey.app.publishMQTTMessage(item.rightBrokerId, `homey/${deviceId}/${capability}/label`, value ? item.rightOnText : item.rightOffText);
            }

            this.homey.app.publishMQTTMessage(item.rightBrokerId, `homey/${deviceId}/${capability}/value`, value);
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

module.exports = BasePanelDevice;
