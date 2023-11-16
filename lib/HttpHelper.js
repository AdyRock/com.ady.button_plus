/* jslint node: true */

'use strict';

const
{
    SimpleClass,
} = require('homey');

const got = require('got');

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
        try
        {
            const options = {
                timeout: {
                    send: 2000,
                },
            };
            return await got(uri, options).json();
        }
        catch (error)
        {
            return null;
        }
    }

    async post(uri, data)
    {
        // Throws an error if the post fails
        try
        {
            const options = {
                json: data,
                timeout: {
                    send: 2000,
                },
            };
            return await got.post(uri, options).json();
        }
        catch (error)
        {
            return null;
        }
    }

};
