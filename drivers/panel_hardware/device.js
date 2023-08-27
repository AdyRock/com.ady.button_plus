'use strict';

const BasePanelDevice = require('../base_panel_device');

class PanelDevice extends BasePanelDevice
{

    /**
     * onInit is called when the device is initialized.
     */
    async onInit()
    {
        super.onInit();
        this.log('PanelDevice has been initialized');
    }

    /**
     * onAdded is called when the user adds the device, called just after pairing.
     */
    async onAdded()
    {
        super.onAdded();
        this.log('PanelDevice has been added');
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
        super.onSettings({ oldSettings, newSettings, changedKeys });
        this.log('PanelDevice settings where changed');
    }

    /**
     * onRenamed is called when the user updates the device's name.
     * This method can be used this to synchronise the name to the device.
     * @param {string} name The new name
     */
    async onRenamed(name)
    {
        super.onRenamed(name);
        this.log('PanelDevice was renamed');
    }

    /**
     * onDeleted is called when the user deleted the device.
     */
    async onDeleted()
    {
        super.onDeleted();
        this.log('PanelDevice has been deleted');
    }

}

module.exports = PanelDevice;
