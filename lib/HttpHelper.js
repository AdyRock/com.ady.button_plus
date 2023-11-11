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
        const data = await response.json();
        return data;
    }

    async post(uri, data)
    {
        // Throws an error if the post fails
        const response = await fetch(uri, { method: 'POST', body: data });
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

};
