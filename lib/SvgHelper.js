/* eslint-disable camelcase */

'use strict';

function isSvgTextContent(value)
{
	if (typeof value !== 'string')
	{
		return false;
	}

	const normalized = value.replace(/^\uFEFF/, '').trim();
	return /<svg(?:\s|>)/i.test(normalized);
}

module.exports = {
	isSvgTextContent,
};
