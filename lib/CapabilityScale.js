'use strict';

function getScale(value)
{
	if (value === '' || value === null || value === undefined) return null;
	const scale = Number(value);
	return Number.isFinite(scale) && scale > 0 ? scale : null;
}

function scaleValue(value, scale, capabilityName)
{
	if (typeof value !== 'number' || !Number.isFinite(value)) return value;
	const factor = getScale(scale);
	if (factor !== null) return value * factor;
	if (capabilityName === 'dim' || capabilityName === 'windowcoverings_set')
	{
		return value <= 1 ? Math.round(value * 100) : Math.round(value);
	}
	return value;
}

function getHomeyScale(device, capability, scale)
{
	if (!device || ['none', 'customMQTT'].includes(device) || (device !== '_variable_' && ['dim', 'windowcoverings_set'].includes(capability))) return null;
	return getScale(scale);
}

function getDisplayTopic(panelId, deviceId, capability, itemNo, scale)
{
	return getHomeyScale(deviceId, capability, scale) === null
		? `buttonplus/${deviceId}/${capability}`
		: `buttonplus/${panelId}/displayitem/${itemNo}/scaled`;
}

module.exports = { getScale, scaleValue, getHomeyScale, getDisplayTopic };
