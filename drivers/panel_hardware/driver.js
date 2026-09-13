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
			}

			return devices;
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
			return this.pairListDevices(data.ip, '');
		});
	}

	async onRepair(session, device)
	{

		session.setHandler('set_ip_setup', async () =>
		{
			return device.ip;
		});

		session.setHandler('set_ip_connection', async (data) =>
		{
			await device.repair(data.ip);

			return 'OK';
		});
	}

	async pairListDevices(ip, id)
	{
		const deviceConfiguration = await this.homey.app.readDeviceConfiguration(ip);
		this.homey.app.updateLog(`Device configuration: ${this.homey.app.varToString(deviceConfiguration)}`);

		if (!deviceConfiguration)
		{
			return [];
		}

		const settings = {
			address: deviceConfiguration.info.ipaddress,
			mac: deviceConfiguration.info.mac,
			configuration_mode: 'group',
		};

		if (deviceConfiguration.info && Array.isArray(deviceConfiguration.info.connectors))
		{
			for (let i = 0; i < 8; i++)
			{
				const conn = deviceConfiguration.info.connectors.find((c) => c && c.id === i);
				settings[`connect${i}Type`] = conn ? conn.type : (i === 0 ? 2 : 0);
			}
		}

        const device = {
            // eslint-disable-next-line no-nested-ternary
            name: deviceConfiguration.core.location ? deviceConfiguration.core.location : (deviceConfiguration.core.name ? deviceConfiguration.core.name : deviceConfiguration.info.ipaddress),
            data:
            {
                id: deviceConfiguration.info.id,
            },
            settings,
        };

		return device;
	}

}

module.exports = PanelDriver;
