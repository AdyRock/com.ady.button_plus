'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { isSvgTextContent, normalizeSvgText } = require('../lib/SvgHelper');

const source = fs.readFileSync(path.join(__dirname, '..', 'drivers', 'panel_hardware', 'device.js'), 'utf8').replace(/\r\n/g, '\n');
const methods = [
	'turnButtonOnOff', 'getConfigPageSide', 'getButtonDisplayValues', 'setLEDOnOff',
	'queueOrPublishLedColor', 'parseHexColor', 'rgbToInteger', 'interpolateColor',
	'processClickMessage', 'processAdvancedButtonStateClick', 'isButtonStateOnCurrentPage',
].map(name =>
{
	const match = new RegExp(`\\n\\t(?:async )?${name}\\(`).exec(source);
	assert(match, `${name} exists`);
	return source.slice(match.index, source.indexOf('\n\t}\n', match.index) + 4);
}).join('');

function createPanel(mode = 'basic', configured = true)
{
	const panel = vm.runInNewContext(`new (class { ${methods} })()`, {
		isSvgTextContent,
		normalizeSvgText,
		checkSEMVerGreaterOrEqual: () => true,
	});
	const messages = [];
	const events = [];
	const capabilities = new Map();
	const pages = [0, 1, 2].map(page =>
	{
		const config = { PageNum: page === 0 ? 'Default' : String(page) };
		for (const side of ['left', 'right'])
		{
			Object.assign(config, {
				[`${side}Mode`]: mode,
				[`${side}Device`]: 'none',
				[`${side}Capability`]: '',
				[`${side}BrokerId`]: 'homey',
				[`${side}OnText`]: `On ${page}`,
				[`${side}OffText`]: `Off ${page}`,
				[`${side}FrontLEDOnColor`]: '#00ff00',
				[`${side}WallLEDOnColor`]: '#00ff00',
				[`${side}FrontLEDOffColor`]: '#ff0000',
				[`${side}WallLEDOffColor`]: '#ff0000',
			});
		}
		return config;
	});
	panel.buttonId = 'test-panel';
	panel.page = 2;
	panel.firmwareVersion = '3.1.7';
	panel.buttonValues = new Map();
	panel.homey = { app: {
		buttonConfigurations: configured ? [pages] : [],
		publishMQTTMessage: async (broker, topic, value) => messages.push({ broker, topic, value }),
		updateLog: () => {},
		triggerButtonOn: () => events.push('on'),
		triggerButtonOff: () => events.push('off'),
		triggerConfigButton: (_panel, _side, _type, _config, event) => events.push(event),
	} };
	panel.getEffectiveConfigNo = () => (configured ? 0 : null);
	panel.getSetting = () => 1;
	panel.getCapabilityValue = name => capabilities.get(name);
	panel.setCapabilityValue = async (name, value) => capabilities.set(name, value);
	panel.safeSetCapabilityValue = panel.setCapabilityValue;
	panel.triggerCapabilityListener = () => assert.fail('State synchronization must not simulate a button press');
	panel.getButtonStateKey = (connector, side, page) => `${connector}_${side}_${page}`;
	panel.fireOrQueueClickedTrigger = (_parameters, _key, callback) => callback();
	panel.getConfigLedButtonState = async (_config, fallback) => fallback;
	panel.resolveConnectorConfig = parameters => panel.getConfigPageSide(null, parameters.page, parameters.side, parameters.configNo);
	panel.resolveAdvancedLedBinding = parameters =>
	{
		const config = pages[parameters.page];
		return config[`${parameters.side}LedDevice`] === 'lamp' ? { deviceID: 'lamp', capabilityName: 'onoff' } : null;
	};
	panel.error = error => { throw error; };
	return { panel, messages, events, capabilities, pages };
}

function checkFeedback(messages, side, connector, page, state, svg = '')
{
	const button = connector * 2 + (side === 'left' ? 1 : 2);
	const prefix = `buttonplus/test-panel/button/${button}-${page}`;
	for (const led of ['front', 'wall'])
	{
		assert(messages.some(message => message.topic === `${prefix}/led/${led}/rgb/set` && message.value === (state ? 0x00ff00 : 0xff0000)), `${side}/${page}: ${led} LED colour`);
	}
	assert(messages.some(message => message.topic === `${prefix}/label/set` && message.value === (svg ? '' : `${state ? 'On' : 'Off'} ${page}`)), `${side}/${page}: label`);
	assert(messages.some(message => message.topic === `${prefix}/svg/set` && message.value === svg), `${side}/${page}: SVG`);
	assert(messages.every(message => message.broker === 'homey'), 'Use the configured broker');
}

async function run()
{
	for (const mode of ['basic', 'advanced'])
	{
		for (const side of ['left', 'right'])
		{
			const { panel, messages, events, capabilities, pages } = createPanel(mode);
			const capability = `${side}_button.connector1`;
			capabilities.set(capability, true);
			panel.buttonValues.set(`${side}_1_1`, true);
			await panel.turnButtonOnOff(side, 1, 1, false);
			assert.strictEqual(panel.buttonValues.get(`${side}_1_1`), false, 'Cache is Off');
			assert.strictEqual(capabilities.get(capability), false, 'Homey state is Off');
			assert.deepStrictEqual(events, [], 'Off synchronization fires no Flow triggers');
			checkFeedback(messages, side, 1, 1, false);

			messages.length = 0;
			capabilities.set(capability, true);
			await panel.turnButtonOnOff(side, 1, 1, false);
			assert.strictEqual(capabilities.get(capability), false, 'A repeated Off repairs stale Homey state even when the cache is already Off');
			checkFeedback(messages, side, 1, 1, false);

			messages.length = 0;
			await panel.turnButtonOnOff(side, 1, 2, true);
			assert.strictEqual(capabilities.get(capability), false, 'An inactive page does not change the active Homey state');
			assert.strictEqual(panel.buttonValues.get(`${side}_1_2`), true);
			checkFeedback(messages, side, 1, 2, true);
			assert(messages.every(message => message.topic.includes('-2/')), 'Only the selected page is rendered');

			messages.length = 0;
			await panel.turnButtonOnOff(side, 1, -1, true);
			assert.strictEqual(capabilities.get(capability), true);
			for (let page = 0; page < pages.length; page++)
			{
				assert.strictEqual(panel.buttonValues.get(`${side}_1_${page}`), true);
				checkFeedback(messages, side, 1, page, true);
			}

			const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle /></svg>';
			pages[1][`${side}OnSVG`] = svg;
			pages[1][`${side}BasicBooleanRender`] = 'svg';
			messages.length = 0;
			await panel.turnButtonOnOff(side, 1, 1, true);
			checkFeedback(messages, side, 1, 1, true, svg);
			assert.deepStrictEqual(events, [], 'On synchronization also fires no Flow triggers');

			const parameters = { connector: 1, idx: side === 'left' ? 2 : 3, side, page: 1, configNo: 0, connectorType: 1, buttonCapability: capability, value: false };
			if (mode === 'advanced')
			{
				await panel.processAdvancedButtonStateClick(parameters);
			}
			else
			{
				await panel.processClickMessage(parameters);
			}
			assert.deepStrictEqual(events, ['off', 'clicked'], 'A real button action still fires Off and Clicked');
			events.length = 0;
			parameters.value = true;
			if (mode === 'advanced')
			{
				await panel.processAdvancedButtonStateClick(parameters);
			}
			else
			{
				await panel.processClickMessage(parameters);
			}
			assert.deepStrictEqual(events, ['on', 'clicked'], 'A real button action still fires On and Clicked');
		}
	}

	const bound = createPanel();
	bound.pages[1].leftDevice = 'tv';
	bound.pages[1].leftCapability = 'onoff';
	bound.panel.getDeviceAndCapability = () => assert.fail('State actions must not read or control the configured target');
	await bound.panel.turnButtonOnOff('left', 1, 1, false);
	checkFeedback(bound.messages, 'left', 1, 1, false);
	assert.deepStrictEqual(bound.events, []);

	const independent = createPanel('advanced');
	independent.pages[1].leftLedDevice = 'lamp';
	independent.pages[1].leftLedCapability = 'onoff';
	independent.pages[1].leftDisplayDevice = 'thermostat';
	independent.pages[1].leftDisplayCapability = 'measure_temperature';
	await independent.panel.turnButtonOnOff('left', 1, 1, false);
	assert.deepStrictEqual(independent.messages, [], 'Explicit advanced LED and display sources retain ownership of their outputs');
	assert.strictEqual(independent.capabilities.get('left_button.connector1'), false);

	const unconfigured = createPanel('basic', false);
	await unconfigured.panel.turnButtonOnOff('right', 0, -1, true);
	assert.strictEqual(unconfigured.capabilities.get('right_button.connector0'), true);
	assert.strictEqual(unconfigured.panel.buttonValues.get('right_0_1'), true, 'All-pages also updates the active page without a configuration');
	assert.deepStrictEqual(unconfigured.events, []);

	const failedPublish = createPanel();
	failedPublish.panel.homey.app.publishMQTTMessage = async () => { throw new Error('MQTT unavailable'); };
	await assert.rejects(failedPublish.panel.turnButtonOnOff('left', 1, 1, false), /MQTT unavailable/);
	const failedCapability = createPanel();
	failedCapability.panel.setCapabilityValue = async () => { throw new Error('Capability unavailable'); };
	await assert.rejects(failedCapability.panel.turnButtonOnOff('left', 1, 1, false), /Capability unavailable/);
	process.stdout.write('Button state action tests passed\n');
}

run().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
