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

    async onPair(session)
    {
        this.devicesToAdd = [];

        session.setHandler('list_devices', async () =>
        {
            const devices = [];
            devices.push({
                name: 'Manual connection',
                data:
                {
                    id: 'manual_connection',
                },
            });

            if (this.homey.app.mDNSPanels.length > 0)
            {
                for (let i = 0; i < this.homey.app.mDNSPanels.length; i++)
                {
                    const { ip, id } = this.homey.app.mDNSPanels[i];
                    const device = await this.pairListDevices(ip, id);
                    devices.push(device);
                }

                if (!devices || devices.length === 0)
                {
                    throw new Error('no_devices_found');
                }

                return devices;
            }

            return [];
        });

        session.setHandler('list_devices_selection', async (data) =>
        {
            // User selected a device so cache the information required to validate it when the credentials are set
            this.devicesToAdd = data;
        });

        session.setHandler('manual_connection_setup', async () =>
        {
            return this.devicesToAdd;
        });

        session.setHandler('manual_connection', async (data) =>
        {
            this.ip = data.ip;
            return this.pairListDevices(data.ip, 0);
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
                virtualID: (ip ? 0 : virtualID),
                mac: (ip ? virtualID : 0),
            },
        };

        return device;
    }

}

module.exports = PanelDriver;
