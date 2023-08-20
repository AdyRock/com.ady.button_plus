'use strict';

const { Driver } = require('homey');

class PanelDriver extends Driver
{

    /**
     * onInit is called when the driver is initialized.
     */
    async onInit()
    {
        this._triggerButtonOn = this.homey.flow.getDeviceTriggerCard('button_on');
        this._triggerButtonOn.registerRunListener((args, state) =>
        {
            return (args.left_right === state.left_right && args.connector === state.connector);
        });

        this._triggerButtonOff = this.homey.flow.getDeviceTriggerCard('button_off');
        this._triggerButtonOff.registerRunListener((args, state) =>
        {
            return (args.left_right === state.left_right && args.connector === state.connector);
        });

        this._triggerButtonChange = this.homey.flow.getDeviceTriggerCard('button_change');
        this._triggerButtonChange.registerRunListener((args, state) =>
        {
            return (args.left_right === state.left_right && args.connector === state.connector);
        });

        this.log('PanelDriver has been initialized');
    }

    triggerButtonOn(device, leftright, connector)
    {
        const tokens = { left_right: leftright, connector };
        const state = { left_right: leftright ? 'left' : 'right', connector };
        this.triggerFlow(this._triggerButtonOn, device, tokens, state);
        this.triggerButtonChange(device, leftright, connector, true);
        return this;
    }

    triggerButtonOff(device, leftright, connector)
    {
        const tokens = { left_right: leftright, connector };
        const state = { left_right: leftright ? 'left' : 'right', connector };
        this.triggerFlow(this._triggerButtonOff, device, tokens, state);
        this.triggerButtonChange(device, leftright, connector, false);
        return this;
    }

    triggerButtonChange(device, leftright, connector, value)
    {
        const tokens = { left_right: leftright, connector, state: value };
        const state = { left_right: leftright ? 'left' : 'right', connector };
        this.triggerFlow(this._triggerButtonChange, device, tokens, state);
        return this;
    }

    /**
     * Triggers a flow
     * @param {this.homey.flow.getDeviceTriggerCard} trigger - A this.homey.flow.getDeviceTriggerCard instance
     * @param {Device} device - A Device instance
     * @param {Object} tokens - An object with tokens and their typed values, as defined in the app.json
     */
    triggerFlow(trigger, device, tokens, state)
    {
        if (trigger)
        {
            trigger.trigger(device, tokens, state)
                .then((result) =>
                {
                    if (result)
                    {
                        this.log(result);
                    }
                })
                .catch((error) =>
                {
                    this.homey.app.logInformation(`triggerFlow (${trigger.id})`, error);
                });
        }
    }

    onPair(session)
    {
        let username = this.homey.settings.get('username');
        let password = this.homey.settings.get('password');
        let virtualID = 0;

        session.setHandler('showView', async (view) =>
        {
            if (view === 'login_credentials')
            {
                if (username && password)
                {
                    await session.nextView();
                }
            }
        });

        session.setHandler('login', async (data) =>
        {
            username = data.username;
            password = data.password;

            await this.homey.app.loginToSimulator(username, password);

            // return true to continue adding the device if the login succeeded
            // return false to indicate to the user the login attempt failed
            // thrown errors will also be shown to the user
            return true;
        });

        session.setHandler('pincode', async (pincode) =>
        {
            // The pincode is given as an array of the filled in values
            virtualID = parseInt(pincode[3], 10) + (parseInt(pincode[2], 10) * 10) + (parseInt(pincode[1], 10) * 100) + (parseInt(pincode[0], 10) * 1000);
            return (true);
        });

        session.setHandler('list_devices', async () =>
        {
            const devices = await this.pairListDevices(0, virtualID);
            if (!devices || devices.length === 0)
            {
                throw new Error('no_devices_found');
            }

            this.homey.settings.set('username', username);
            this.homey.settings.set('password', password);
            return devices;
        });
    }

    async pairListDevices(ip, virtualID)
    {
        const deviceConfiguration = await this.homey.app.readDeviceConfiguration(ip, virtualID);
        this.homey.app.updateLog(`Device configuration: ${this.homey.app.varToString(deviceConfiguration)}`);

        if (!deviceConfiguration)
        {
            return [];
        }

        let connect0Type = 0;
        let connect1Type = 0;
        let connect2Type = 0;
        let connect3Type = 0;
        let connect4Type = 0;

        let connectIdx = deviceConfiguration.info.connectors.findIndex((id) => id.id === 0);
        if (connectIdx >= 0)
        {
            connect0Type = deviceConfiguration.info.connectors[connectIdx].type;
        }

        connectIdx = deviceConfiguration.info.connectors.findIndex((id) => id.id === 1);
        if (connectIdx >= 0)
        {
            connect1Type = deviceConfiguration.info.connectors[connectIdx].type;
        }

        connectIdx = deviceConfiguration.info.connectors.findIndex((id) => id.id === 2);
        if (connectIdx >= 0)
        {
            connect2Type = deviceConfiguration.info.connectors[connectIdx].type;
        }

        connectIdx = deviceConfiguration.info.connectors.findIndex((id) => id.id === 3);
        if (connectIdx >= 0)
        {
            connect3Type = deviceConfiguration.info.connectors[connectIdx].type;
        }

        connectIdx = deviceConfiguration.info.connectors.findIndex((id) => id.id === 4);
        if (connectIdx >= 0)
        {
            connect4Type = deviceConfiguration.info.connectors[connectIdx].type;
        }

        return [
            // Example device data
            {
                name: deviceConfiguration.core.location,
                data:
                {
                    id: deviceConfiguration.core.name,
                },
                settings:
                {
                    address: ip,
                    connect0Type,
                    connect1Type,
                    connect2Type,
                    connect3Type,
                    connect4Type,
                    virtualID,
                },
            },
        ];
    }

}

module.exports = PanelDriver;
