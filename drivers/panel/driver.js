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

    /**
     * onPairListDevices is called when a user is adding a device
     * and the 'list_devices' view is called.
     * This should return an array with the data of devices that are available for pairing.
     */
    async onPairListDevices()
    {
        return [
            // Example device data
            {
                name: 'Panel 4',
                data:
                {
                    connector: 4,
                },
                settings:
                {
                    address: '127.0.0.1',
                },
            },
        ];
    }

}

module.exports = PanelDriver;
