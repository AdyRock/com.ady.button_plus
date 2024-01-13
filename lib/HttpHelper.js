/* jslint node: true */

'use strict';

const
{
    SimpleClass,
} = require('homey');

const fetch = require('node-fetch');

module.exports = class HttpHelper extends SimpleClass
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

        const responseText = await response.text();

        try
        {
            return JSON.parse(responseText);
        }
        catch (error)
        {
            return responseText;
        }
        return data;
    }

    async post(uri, data)
    {
        // Check the IP queue to see if we need to throttle the request
        while (this.ipQueue.has(uri))
        {
            // A request is already in progress so add this ip so wait for the first request to complete
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Add the ip to the queue
        this.ipQueue.set(uri, true);

        // Throws an error if the post fails
        var timeoutId = null;
        try
        {
            const controller = new AbortController()
            // 5 second timeout:
            timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(uri, { signal: controller.signal, method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
            if (response.status !== 200)
            {
                throw new Error(`HTTP POST error ${response.status} ${response.statusText}`);
            }
            const responseData = await response.json();
            if (responseData === '')
            {
                return { status: response.status, statusText: response.statusText };
            }
            return responseData;
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
