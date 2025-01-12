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
			this.app.updateLog('VariableDispatcher init: connect to logic', 1);
            await this.api.logic.connect();
        }

        this.api.logic.on('variable.update', async (variable) =>
        {
            const { name, value, id } = variable;
            this.app.updateLog(`Variable ${id} (${name}) updated to ${value}`);

            // Get devices to update their configurations
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
		if (!this.api.logic.isConnected())
		{
			this.app.updateLog('VariableDispatcher Get all: connect top logic', 1);
			await this.api.logic.connect();
		}

        const vars = await this.api.logic.getVariables();
		this.app.updateLog(`VariableDispatcher Get: ${this.app.varToString(vars)}`, 1);
		return vars;
    }

    async getVariable(id)
    {
		if (!this.api.logic.isConnected())
		{
			this.app.updateLog('VariableDispatcher Get: connect to logic', 1);
			await this.api.logic.connect();
		}
        return this.api.logic.getVariable({ id });
    }

    async setVariable(id, variable)
    {
		if (!this.api.logic.isConnected())
		{
			this.app.updateLog('VariableDispatcher Set: connect to logic', 1);
			await this.api.logic.connect();
		}

        return this.api.logic.updateVariable({ id, variable });
    }

}

module.exports = VariableDispatcher;
