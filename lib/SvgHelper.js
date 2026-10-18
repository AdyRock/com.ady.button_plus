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

module.exports = {
	isSvgTextContent,
	normalizeSvgText,
};
