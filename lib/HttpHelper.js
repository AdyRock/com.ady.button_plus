/* jslint node: true */

'use strict';

const
{
    SimpleClass,
} = require('homey');

const axios = require('axios');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');

axiosCookieJarSupport(axios);

module.exports = class HttpHelper extends SimpleClass
{

    constructor()
    {
        super();

        this.cookieJar = new tough.CookieJar();
        this.axios = axios.create();

        this.axios.defaults.jar = this.cookieJar;
        this.axios.defaults.withCredentials = true;
        this.axios.defaults.maxRedirects = 0;

        this.setBaseURL('europe');
        return this;
    }

    setDefaultHeaders(headers, withCredentials)
    {
        this.axios.defaults.withCredentials = withCredentials;
        this.axios.defaults.headers = headers;
        if (!withCredentials)
        {
            this.cookieJar.removeAllCookies();
        }
    }

    setBaseURL(region)
    {
        this.axios.defaults.baseURL = this.getBaseURL(region);
        this.axios.defaults.timeout = 10000;
    }

    // Convert the host option into the host name
    getBaseURL(region)
    {
        if (region === 'local')
        {
            // Base URL for local access
            return '';
        }

        return 'https://api.button.plus';
  }

    // Convert the host option into the host name
    getHostName(region, pin)
    {
        if (region === 'local')
        {
            // Base URL for local access
            return '';
        }

        return 'api.button.plus';
    }

    async get(uri, config)
    {
        // Throws an error if the get fails
        const response = await this.axios.get(uri, config);
        if (response.status !== 200)
        {
            throw new Error(`HTTP GET error ${response.status} ${response.statusText}`);
        }
        return response.data;
    }

    async post(uri, config, data)
    {
        // Throws an error if the post fails
        const response = await this.axios.post(uri, data, config);
        if (response.status !== 200)
        {
            throw new Error(`HTTP POST error ${response.status} ${response.statusText}`);
        }
        if (response.data === '')
        {
            return { status: response.status, statusText: response.statusText };
        }
        return response.data;
    }

    async delete(uri, config)
    {
        const response = await this.axios.delete(uri, config);
        return response.data;
    }

};
