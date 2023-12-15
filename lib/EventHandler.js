'use strict';

class EventHandler
{

    constructor(name)
    {
        this.name = name || 'unknown';
        this._listeners = [];
        this._once = new Set();
    }

    subscribe(callback, once)
    {
        if (this._listeners.indexOf(callback) !== -1)
        {
            this.homey.app.updateLog('[Skip] Listener already subscribed');
        }
        this._listeners.push(callback);
        if (once)
        {
            this._once.add(callback);
        }
    }

    unsubscribe(callback) { return this.remove(callback); }
    remove(callback)
    {
        this._listeners = this._listeners.filter((c) => c !== callback);
    }

    async emit(...args)
    {
        for (let i = 0; i < this._listeners.length; i++)
        {
            const callback = this._listeners[i];
            if (typeof callback === 'function')
            {
                try
                {
                    if (this._once.has(callback))
                    {
                        this.remove(callback);
                        this._once.delete(callback);
                    }
                    await callback(...args);
                }
                catch (e)
                {
                    this.homey.app.updateLog(`Error handling event: ${this.name}`, 0);
                    this.homey.app.updateLog(args);
                    this.homey.app.updateLog(e);
                }
            }
        }
    }

}

module.exports = EventHandler;
