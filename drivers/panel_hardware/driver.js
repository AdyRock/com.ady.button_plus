'use strict';

const { Driver } = require('homey');

class PanelDriver extends Driver
{

    /**
     * onInit is called when the driver is initialized.
     */
    async onInit()
    {
        this.log('PanelDriver has been initialized');
    }

    onPair(session)
    {
        session.setHandler('manual_connection', async (data) =>
        {
            return this.pairListDevices(data.ip, 0);
        });

        session.setHandler('list_devices', async () =>
        {
            const devices = await this.pairListDevices(0, 0);
            if (!devices || devices.length === 0)
            {
                throw new Error('no_devices_found');
            }
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

        const device = {
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
        };

        return device;
    }

}

module.exports = PanelDriver;
