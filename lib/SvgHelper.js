/* eslint-disable camelcase */

'use strict';

function isSvgTextContent(value)
{
	const normalized = normalizeSvgText(value);
	if (!normalized)
	{
		return false;
	}

	return /<svg(?:\s|>)/i.test(normalized);
}

function normalizeSvgText(value)
{
	if (typeof value !== 'string')
	{
		return '';
	}

	let normalized = value.replace(/^\uFEFF/, '').trim();
	if (!normalized)
	{
		return '';
	}

	if (/&lt;svg(?:\s|&gt;)/i.test(normalized))
	{
		normalized = normalized
			.replace(/&lt;/gi, '<')
			.replace(/&gt;/gi, '>')
			.replace(/&quot;/gi, '"')
			.replace(/&#39;/gi, "'")
			.replace(/&amp;/gi, '&');
	}

	return normalized;
}

// Valid but empty SVG. Used to clear an svg/set topic: an empty payload would be
// turned into ' ' by publishMQTTMessage, which is not parseable SVG and crashes the
// panel's web UI (DOMParser -> querySelector('svg') returns null -> getAttribute).
const EMPTY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';

module.exports = {
	EMPTY_SVG,
	isSvgTextContent,
	normalizeSvgText,
};
