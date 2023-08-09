'use strict';

const { Device } = require('homey');

class MyDevice extends Device
{

    /**
     * onInit is called when the device is initialized.
     */
    async onInit()
    {
        this.registerCapabilityListener('onoff.left', this.onCapabilityOnOffLeft.bind(this));
        this.registerCapabilityListener('onoff.right', this.onCapabilityOnOffRight.bind(this));

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

    onCapabilityOnOffLeft(value, opts)
    {
        this.log('onCapabilityOnOffLeft', value, opts);
        const dd = this.getData();
        this.homey.app.publishMQTTMessage(`homey/connector${dd.connector}/left/onoff`, value ? 'ON' : 'OFF');
    }

    onCapabilityOnOffRight(value, opts)
    {
        this.log('onCapabilityOnOffLeft', value, opts);
        const dd = this.getData();
        this.homey.app.publishMQTTMessage(`homey/connector${dd.connector}/right/onoff`, value ? 'ON' : 'OFF');
    }

    processMQTTMessage(topic, MQTTMessage)
    {
        const dd = this.getData();
        this.log('MQTT message received:', topic, MQTTMessage.toString());
        if (MQTTMessage.connector === dd.connector)
        {
            if (topic === 'homey/click')
            {
                if (MQTTMessage.btn === 'left')
                {
                    const value = !this.getCapabilityValue('onoff.left');
                    this.setCapabilityValue('onoff.left', value).catch(this.error);
                    this.homey.app.publishMQTTMessage(`homey/connector${dd.connector}/left/onoff`, value ? 'ON' : 'OFF');
                }
                else if (MQTTMessage.btn === 'right')
                {
                    const value = !this.getCapabilityValue('onoff.right');
                    this.setCapabilityValue('onoff.right', !this.getCapabilityValue('onoff.right')).catch(this.error);
                    this.homey.app.publishMQTTMessage(`homey/connector${dd.connector}/right/onoff`, value ? 'ON' : 'OFF');
                }
            }
        }
    }

}

module.exports = MyDevice;
