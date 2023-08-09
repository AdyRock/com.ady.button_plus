'use strict';

if (process.env.DEBUG === '1')
{
    // eslint-disable-next-line node/no-unsupported-features/node-builtins, global-require
    require('inspector').open(9223, '0.0.0.0', true);
}

const Homey = require('homey');

const http = require('http');
const nodemailer = require('nodemailer');
const aedes = require('aedes')();
const net = require('net');
const mqtt = require('mqtt');

const PORT = 49876;
// const MQTT_SERVER = 'mqtt://localhost:49876';
const MQTT_SERVER = 'mqtt://mqtt.button.plus:1883';
const USE_LOCAL_MQTT = false;

class MyApp extends Homey.App
{

    /**
     * onInit is called when the app is initialized.
     */
    async onInit()
    {
        this.serverReady = false;
        this.autoConfigGateway = true;
        this.homey.settings.set('autoConfig', this.autoConfigGateway);
        try
        {
            // Setup the local access method if possible
            if (USE_LOCAL_MQTT)
            {
                this.setupMQTTServer();
            }
            this.setupMDNS();
            this.setupMQTTClient();
        }
        catch (err)
        {
            this.updateLog(`Error setting up local access: ${err.message}`);
        }

        this.log('MyApp has been initialized');
    }

    async setupMDNS()
    {
        const homeyLocalURL = await this.homey.cloud.getLocalAddress();
        this.homeyIP = homeyLocalURL.split(':')[0];

        this.mDNSGateways = this.homey.settings.get('gateways');
        this.mDNSGateways = [];

        this.autoConfigGateway = this.homey.settings.get('autoConfig');

        // setup the mDNS discovery for local gateways
        this.discoveryStrategy = this.homey.discovery.getStrategy('panel');

        const discoveryResult = this.discoveryStrategy.getDiscoveryResults();
        this.updateLog(`Got initial mDNS result:${this.varToString(discoveryResult)}`);
        if (discoveryResult && discoveryResult.address)
        {
            this.mDNSGatewaysUpdate(discoveryResult);
        }

        this.discoveryStrategy.on('result', (discoveryResult) =>
        {
            this.updateLog(`Got mDNS result:${this.varToString(discoveryResult)}`);
            this.mDNSGatewaysUpdate(discoveryResult);
        });
    }

    setupMQTTServer()
    {
        // Setup the local MQTT server
        const server = net.createServer(aedes.handle);
        server.listen(PORT, () =>
        {
            this.updateLog(`server started and listening on port ${PORT}`);
            this.serverReady = true;
        });

        server.on('error', (err) =>
        {
            this.updateLog(`server error: ${this.varToString(err)}`);
        });
    }

    setupMQTTClient()
    {
        aedes.authenticate = function aedesAuthenticate(client, username, password, callback)
        {
            callback(null, (username === Homey.env.MQTT_USER_NAME) && (password.toString() === Homey.env.MQTT_PASSWORD));
        };

        // Connect to the MQTT server and subscribe to the required topics
        this.MQTTclient = mqtt.connect(MQTT_SERVER, { clientId: 'homeyButtonPlusApp', username: Homey.env.MQTT_USER_NAME, password: Homey.env.MQTT_PASSWORD });
        this.MQTTclient.on('connect', () =>
        {
            this.updateLog(`setupLocalAccess.onConnect: connected to ${MQTT_SERVER}`);

            this.MQTTclient.subscribe('homey/click', (err) =>
            {
                if (err)
                {
                    this.updateLog("setupLocalAccess.onConnect 'homey/toggle' error: " * this.varToString(err), 0);
                }
            });

            this.MQTTclient.subscribe('homey/longpress', (err) =>
            {
                if (err)
                {
                    this.updateLog("setupLocalAccess.onConnect 'homey/longpress' error: " * this.varToString(err), 0);
                }
            });

            this.MQTTclient.subscribe('homey/sensorvalue', (err) =>
            {
                if (err)
                {
                    this.updateLog("setupLocalAccess.onConnect 'homey/sensorvalue' error: " * this.varToString(err), 0);
                }
            });
        });

        this.MQTTclient.on('error', (err) =>
        {
            this.updateLog(`setupLocalAccess.onError: ${this.varToString(err)}`);
        });

        this.MQTTclient.on('message', (topic, message) =>
        {
            // message is in Buffer
            try
            {
                const mqttMessage = JSON.parse(message.toString());
                this.updateLog(`MQTTDeviceValues: ${this.varToString(mqttMessage)}`);

                // Find the device that handles this message
                if (mqttMessage.connector)
                {
                    const drivers = this.homey.drivers.getDrivers();
                    for (const driver of Object.values(drivers))
                    {
                        let devices = driver.getDevices();
                        for (let device of Object.values(devices))
                        {
                            if (device.processMQTTMessage)
                            {
                                try
                                {
                                    device.processMQTTMessage(topic, mqttMessage);
                                }
                                catch (error)
                                {
                                    this.updateLog(`Sync Devices error: ${error.message}`);
                                }
                            }

                            device = null;
                        }
                        devices = null;
                    }
                }
            }
            catch (err)
            {
                this.updateLog(`MQTT Client error: ${topic}: ${err.message}`);
            }
        });

        return true;
    }

    async publishMQTTMessage(topic, message)
    {
        const data = JSON.stringify(message);
        this.updateLog(`publishMQTTMessage: ${data} to topic ${topic}}`);
        this.MQTTclient.publish(topic, data);
    }

    // Build a list of gateways detected by mDNS
    mDNSGatewaysUpdate(discoveryResult)
    {
        try
        {
            let index = this.mDNSGateways.findIndex((gateway) =>
            {
                return gateway.gatewayId === discoveryResult.id;
            });

            if (index >= 0)
            {
                // Already cached so just make sure the address is up to date
                this.mDNSGateways[index].address = discoveryResult.address;
            }
            else
            {
                // Add a new entry to the cache
                const gateway = {
                    gatewayId: discoveryResult.id,
                    address: discoveryResult.address,
                    model: discoveryResult.txt.model,
                };

                this.mDNSGateways.push(gateway);
                index = this.mDNSGateways.length - 1;
            }

            this.homey.settings.set('gateways', this.mDNSGateways);

            if (this.autoConfigGateway)
            {
                // Make sure the gateway is configure for local access
                this.checkGatewayConfiguration(this.mDNSGateways[index]);
            }
        }
        catch (err)
        {
            this.updateLog(`mDNSGatewaysUpdate error: ${err.message}`);
        }
    }

    async checkGatewayConfiguration(gateway)
    {
        try
        {
            let config = await this.getURL(gateway.address, 'config');
            if (config)
            {
                try
                {
                    config = JSON.parse(config);

                    // Process it

                    const response = await this.postURL(gateway.address, 'config', config);
                    if (response)
                    {
                        try
                        {
                            const responseJson = JSON.parse(response);
                            if (responseJson.success)
                            {
                                this.updateLog(`checkGatewayConfiguration: ${gateway.gatewayId} configured`);
                            }
                            else
                            {
                                this.updateLog(`checkGatewayConfiguration: ${gateway.gatewayId} configuration failed`);
                            }
                        }
                        catch (err)
                        {
                            this.updateLog(`checkGatewayConfiguration error: ${err.message}`);
                        }
                    }
                }
                catch (err)
                {
                    this.updateLog(`checkGatewayConfiguration error: ${err.message}`);
                }
            }
        }
        catch (err)
        {
            this.updateLog(`checkGatewayConfiguration error: ${err.message}`);
        }
    }

    async postURL(host, url, body, logBody = true)
    {
        this.updateLog(`Post to: ${url}`);
        if (logBody)
        {
            this.updateLog(this.varToString(body));
        }

        const bodyText = JSON.stringify(body);

        return new Promise((resolve, reject) =>
        {
            try
            {
                const safeUrl = encodeURI(url);

                const httpOptions = {
                    host,
                    path: `/api/${safeUrl}`,
                    method: 'POST',
                    headers:
                    {
                        'Content-type': 'application/json',
                        'Content-Length': bodyText.length,
                    },
                };

                const req = http.request(httpOptions, (res) =>
                {
                    const body = [];
                    res.on('data', (chunk) =>
                    {
                        body.push(chunk);
                    });

                    res.on('end', () =>
                    {
                        if (res.statusCode === 200)
                        {
                            let returnData = Buffer.concat(body);
                            returnData = JSON.parse(returnData);
                            resolve(returnData);
                        }
                        else
                        {
                            reject(new Error(`HTTP Error - ${res.statusCode}`));
                        }
                    });
                });

                req.on('error', (err) =>
                {
                    reject(new Error(`HTTP Catch: ${err}`), 0);
                });

                req.setTimeout(5000, () =>
                {
                    req.destroy();
                    reject(new Error('HTTP Catch: Timeout'));
                });

                req.write(bodyText);
                req.end();
            }
            catch (err)
            {
                this.updateLog(`HTTP Catch: ${this.varToString(err)}`);
                const stack = this.varToString(err.stack);
                reject(new Error(`HTTP Catch: ${err.message}\n${stack}`));
            }
        });
    }

    async getURL(host, url)
    {
        this.updateLog(`Get from: ${url}`);

        return new Promise((resolve, reject) =>
        {
            try
            {
                const safeUrl = encodeURI(url);

                const httpOptions = {
                    host,
                    path: `/api/${safeUrl}`,
                    method: 'GET',
                    headers:
                    {
                        'Content-type': 'application/json',
                    },
                };

                const req = http.fetch(httpOptions, (res) =>
                {
                    const body = [];
                    res.on('data', (chunk) =>
                    {
                        body.push(chunk);
                    });

                    res.on('end', () =>
                    {
                        if (res.statusCode === 200)
                        {
                            let returnData = Buffer.concat(body);
                            returnData = JSON.parse(returnData);
                            resolve(returnData);
                        }
                        else
                        {
                            reject(new Error(`HTTP Error - ${res.statusCode}`));
                        }
                    });
                });

                req.on('error', (err) =>
                {
                    reject(new Error(`HTTP Catch: ${err}`), 0);
                });

                req.setTimeout(5000, () =>
                {
                    req.destroy();
                    reject(new Error('HTTP Catch: Timeout'));
                });

                req.end();
            }
            catch (err)
            {
                this.updateLog(`HTTP Catch: ${this.varToString(err)}`);
                const stack = this.varToString(err.stack);
                reject(new Error(`HTTP Catch: ${err.message}\n${stack}`));
            }
        });
    }

    // Convert a variable of any type (almost) to a string
    varToString(source)
    {
        try
        {
            if (source === null)
            {
                return 'null';
            }
            if (source === undefined)
            {
                return 'undefined';
            }
            if (source instanceof Error)
            {
                const stack = source.stack.replace('/\\n/g', '\n');
                return `${source.message}\n${stack}`;
            }
            if (typeof (source) === 'object')
            {
                const getCircularReplacer = () =>
                {
                    const seen = new WeakSet();
                    return (key, value) =>
                    {
                        if (typeof value === 'object' && value !== null)
                        {
                            if (seen.has(value))
                            {
                                return '';
                            }
                            seen.add(value);
                        }
                        return value;
                    };
                };

                return JSON.stringify(source, getCircularReplacer(), 2);
            }
            if (typeof (source) === 'string')
            {
                return source;
            }
        }
        catch (err)
        {
            this.updateLog(`VarToString Error: ${err.message}`);
        }

        return source.toString();
    }

    // Add a message to the debug log if not running in the cloud
    updateLog(newMessage, errorLevel = 1)
    {
        this.log(newMessage);
        if (errorLevel === 0)
        {
            this.error(newMessage);
        }

        if ((errorLevel === 0) || this.homey.settings.get('logEnabled'))
        {
            try
            {
                const nowTime = new Date(Date.now());

                this.diagLog += '\r\n* ';
                this.diagLog += nowTime.toJSON();
                this.diagLog += '\r\n';

                this.diagLog += newMessage;
                this.diagLog += '\r\n';
                if (this.diagLog.length > 60000)
                {
                    this.diagLog = this.diagLog.substr(this.diagLog.length - 60000);
                }

                if (!this.cloudOnly)
                {
                    this.homey.api.realtime('com.ady.button_plus.logupdated', { log: this.diagLog });
                }
            }
            catch (err)
            {
                this.log(err);
            }
        }
    }

    // Send the log to the developer (not applicable to Homey cloud)
    async sendLog(body)
    {
        let tries = 5;

        let logData;
        if (body.logType === 'diag')
        {
            logData = this.diagLog;
        }
        else
        {
            logData = JSON.parse(this.detectedDevices);
            if (!logData)
            {
                throw (new Error('No data to send'));
            }

            logData = this.varToString(logData);
        }

        while (tries-- > 0)
        {
            try
            {
                // create reusable transporter object using the default SMTP transport
                const transporter = nodemailer.createTransport(
                    {
                        host: Homey.env.MAIL_HOST, // Homey.env.MAIL_HOST,
                        port: 465,
                        ignoreTLS: false,
                        secure: true, // true for 465, false for other ports
                        auth:
                        {
                            user: Homey.env.MAIL_USER, // generated ethereal user
                            pass: Homey.env.MAIL_SECRET, // generated ethereal password
                        },
                        tls:
                        {
                            // do not fail on invalid certs
                            rejectUnauthorized: false,
                        },
                    },
                );

                // send mail with defined transport object
                const info = await transporter.sendMail(
                    {
                        from: `"Homey User" <${Homey.env.MAIL_USER}>`, // sender address
                        to: Homey.env.MAIL_RECIPIENT, // list of receivers
                        subject: `Button + ${body.logType} log (${Homey.manifest.version})`, // Subject line
                        text: logData, // plain text body
                    },
                );

                this.updateLog(`Message sent: ${info.messageId}`);
                // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

                // Preview only available when sending through an Ethereal account
                this.log('Preview URL: ', nodemailer.getTestMessageUrl(info));
                return this.homey.__('settings.logSent');
            }
            catch (err)
            {
                this.updateLog(`Send log error: ${err.message}`, 0);
            }
        }

        return (this.homey.__('settings.logSendFailed'));
    }

}

module.exports = MyApp;
