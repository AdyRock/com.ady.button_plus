'use strict';

class VariableDispatcher
{

    constructor(app)
    {
        this.api = app.api;
        this.app = app;

        this._init();
    }

    async _init()
    {
        if (!this.api.logic.isConnected())
        {
            await this.api.logic.connect();
        }

        this.api.logic.on('variable.update', async (variable) =>
        {
            const { name, value, id } = variable;
            this.app.updateLog(`Variable ${id} (${name}) updated to ${value}`);

            // Get devices to upload their configurations
            const drivers = this.app.homey.drivers.getDrivers();
            for (const driver of Object.values(drivers))
            {
                let devices = driver.getDevices();
                for (let device of Object.values(devices))
                {
                    if (device.checkStateChange)
                    {
                        try
                        {
                            device.checkStateChange('_variable_', id, value);
                        }
                        catch (error)
                        {
                            this.app.updateLog(`VariableDispatcher _init: ${error.message}`, 0);
                        }
                    }

                    device = null;
                }
                devices = null;
            }
        });
    }

    async getVariables()
    {
        return this.api.logic.getVariables();
    }

    async getVariable(id)
    {
        return this.api.logic.getVariable({ id });
    }

    async setVariable(id, variable)
    {
        return this.api.logic.updateVariable({ id, variable });
    }

}

module.exports = VariableDispatcher;
