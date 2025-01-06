/* jslint node: true */

'use strict';

const
{
    SimpleClass,
} = require('homey');

const fetch = require('node-fetch');

class HttpHelper extends SimpleClass
{

    constructor()
    {
        super();
        this.ipQueue = new Map();
        return this;
    }

    async get(uri)
    {
        // Throws an error if the get fails
        const response = await fetch(uri);
        if (response.status !== 200)
        {
            throw new Error(`HTTP GET error ${response.status} ${response.statusText}`);
        }

        let responseText = await response.text();

        try
        {
			// Replace all instances of mqttbrokers with brokers
			responseText = responseText.replace(/mqttbrokers/g, 'brokers');

			// Replace all instances of mqttButtons with buttons
			responseText = responseText.replace(/mqttbuttons/g, 'buttons');

			// Replace all instances of mqttdisplays with displays
			responseText = responseText.replace(/mqttdisplays/g, 'displayitems');

			// Replace all instances of mqttsensors with sensors
			responseText = responseText.replace(/mqttsensors/g, 'sensors');

            return JSON.parse(responseText);
        }
        catch (error)
        {
            return responseText;
        }
    }

	async post(uri, dataObject, firmwareVersion)
    {
        // Check the IP queue to see if we need to throttle the request
        while (this.ipQueue.has(uri))
        {
            // A request is already in progress so add this ip so wait for the first request to complete
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Add the ip to the queue
        this.ipQueue.set(uri, true);

        // Throws an error if the post fails
        let timeoutId = null;
        try
        {
            const controller = new AbortController();
            // 5 second timeout:
            timeoutId = setTimeout(() => controller.abort(), 30000);

			// Stringify the data
			let body = JSON.stringify(dataObject);

			// If the dataObject contains the info.firmware version and it less than 2.0.0 then replace renamed objects
			if (firmwareVersion && !checkSEMVerGreaterOrEqual(firmwareVersion, '2.0.0'))
			{
				// Replace all instances of "brokers": with "mqttbrokers":
				body = body.replace(/brokers":/g, 'mqttbrokers":');

				// Replace all instances of "buttons": with "mqttbuttons":
				body = body.replace(/buttons":/g, 'mqttbuttons":');

				// Replace all instances of "displays": with "mqttdisplays":
				body = body.replace(/displayitems":/g, 'mqttdisplays":');

				// Replace all instances of "sensors": with "mqttsensors":
				body = body.replace(/sensors":/g, 'mqttsensors":');

				dataObject = JSON.parse(body);
			}

            const response = await fetch(uri, { signal: controller.signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
            if (response.status !== 200)
            {
                throw new Error(`HTTP POST error ${response.status} ${response.statusText}`);
            }
			if (response.bodyUsed)
			{
				const responseText = await response.text();
				try
				{
					return JSON.parse(responseText);
				}
				catch (error)
				{
					return responseText;
				}
			}

			return "OK";
		}
		catch (error)
		{
			throw error;
        }
        finally
        {
            // Remove the ip from the queue
            this.ipQueue.delete(uri);
            clearTimeout(timeoutId);
        }
    }

};

// Define the function
function checkSEMVerGreaterOrEqual(version1, version2)
{
	const v1 = version1.split('.').map(Number);
	const v2 = version2.split('.').map(Number);

	for (let i = 0; i < Math.max(v1.length, v2.length); i++)
	{
		const num1 = v1[i] || 0;
		const num2 = v2[i] || 0;

		if (num1 > num2) return true;
		if (num1 < num2) return false;
	}

	return true;
}

// Export the function
module.exports = {
	checkSEMVerGreaterOrEqual,
	HttpHelper
};