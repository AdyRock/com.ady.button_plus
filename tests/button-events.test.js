'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { normalizeSvgText } = require('../lib/SvgHelper');
const { getHomeyScale } = require('../lib/CapabilityScale');

const source = fs.readFileSync(path.join(__dirname, '..', 'drivers', 'panel_hardware', 'device.js'), 'utf8').replace(/\r\n/g, '\n');
const methods = [
	'processMQTTMessage', 'handleButtonClick', 'executeSingleClickAction', 'processAdvancedButtonStateClick',
	'processLongPressMessage', 'processReleaseMessage', 'handleGenericDoubleClick', 'getButtonStateKey',
	'getEventTimingContext', 'resolveAdvancedSideConfig', 'resolveAdvancedEventBinding', 'getEventConfigNameForType',
	'resolveConnectorConfig', 'getConfigPageSide', 'armClickResolutionTimers', 'clearClickResolutionTimers',
	'isWaitingForClickResolution', 'incrementSuppression', 'consumeSuppression', 'clearLongPressTrackingForRelease',
	'queueClickedTrigger', 'queueReleasedTrigger', 'queuePendingAdvancedClickAction', 'clearPendingAdvancedClickFallbackTimer',
	'firePendingSingleClickTriggers', 'discardPendingSingleClickTriggers', 'fireOrQueueClickedTrigger',
	'triggerAdvancedMappedConfigClicked', 'triggerAdvancedMappedConfigLong',
	'runAdvancedEventMapping',
].map(name =>
{
	const match = new RegExp(`\\n\\t(?:async )?${name}\\(`).exec(source);
	assert(match, `${name} exists`);
	return source.slice(match.index, source.indexOf('\n\t}\n', match.index) + 4);
}).join('');

function createPanel(side, connector, page, configNo, mode, doubleTarget, longMapping)
{
	let clock = 1000;
	const panel = vm.runInNewContext(`new (class { ${methods} })()`, {
		_: { cloneDeep: value => ({ ...value }) },
		normalizeSvgText,
		getHomeyScale,
		checkSEMVerGreaterOrEqual: () => true,
		DOUBLE_CLICK_WINDOW_MS: 350,
		DUPLICATE_CLICK_DEBOUNCE_MS: Number(source.match(/const DUPLICATE_CLICK_DEBOUNCE_MS = (\d+);/)[1]),
		Date: class extends Date
		{

			static now()
			{
				return clock;
			}

		},
	});
	const timers = new Map();
	const events = [];
	const actions = [];
	const configs = Array.from({ length: 3 }, (_value, index) => ({
		PageNum: index,
		[`${side}Mode`]: mode,
		[`${side}Device`]: 'none',
		[`${side}Capability`]: '',
		[`${side}OnText`]: 'On',
		[`${side}OffText`]: 'Off',
		[`${side}ClickDevice`]: 'none',
		[`${side}ClickCapability`]: '',
		[`${side}DoubleDevice`]: doubleTarget,
		[`${side}DoubleCapability`]: doubleTarget === 'mapped' ? 'onoff' : '',
		[`${side}DoubleNumericAction`]: doubleTarget === 'direction' ? 'toggleDirection' : 'none',
		[`${side}LongDevice`]: longMapping ? 'mapped' : 'none',
		[`${side}LongCapability`]: longMapping ? 'onoff' : '',
	}));
	for (const map of [
		'buttonValues', 'clickEventStates', 'clickEventTimers', 'pendingAdvancedClickActions', 'pendingAdvancedClickFallbackTimers',
		'pendingClickedTriggers', 'pendingReleasedTriggers', 'releaseSuppressions', 'clickedSuppressions', 'lastPhysicalClickAt',
		'longPressOccurred', 'longPressEventCounts', 'longPressLastProcessedAt', 'lastLongPressTimes',
		'longPressHeartbeatAt', 'pendingAdvancedLongReleaseCommits',
	])
	{
		panel[map] = new Map();
	}
	panel.homey = {
		setTimeout: (callback, delay) =>
		{
			const timer = Symbol('timer');
			timers.set(timer, { callback, due: clock + delay });
			return timer;
		},
		clearTimeout: timer => timers.delete(timer),
		app: {
			buttonConfigurations: Array.from({ length: configNo + 1 }, () => configs),
			updateLog: () => {},
			triggerButtonEvent: (_device, eventSide, eventConnector, event, state, value, repeatCount) => events.push({ type: 'connector', side: eventSide, connector: eventConnector, event, state, value, repeatCount }),
			triggerConfigButton: (_device, eventSide, _type, config, event, state, value, eventPage, repeatCount = 0) => events.push({ type: 'config', side: eventSide, config, event, state, value, page: eventPage, repeatCount }),
			triggerButtonOn: () => {},
			triggerButtonOff: () => {},
			triggerButtonLongPress: () => {},
			triggerButtonRelease: () => {},
			publishMQTTMessage: async () => {},
		},
	};
	panel.initFinished = true;
	panel.buttonId = 'panel';
	panel.page = page + 1;
	panel.firmwareVersion = '3.1.7';
	panel.getSetting = () => 1;
	panel.getEffectiveConfigNo = () => configNo;
	panel.parseValueStep = value => parseFloat(value);
	panel.isDimButtonConfig = () => false;
	panel.isButtonStateOnCurrentPage = () => true;
	panel.safeSetCapabilityValue = async () => {};
	panel.setLEDOnOff = () => {};
	panel.resolveAdvancedLedBinding = () => null;
	panel.getButtonDisplayValues = textValue => ({ textValue, svgValue: '' });
	panel.getConfigLedButtonState = async (_config, fallback) => fallback;
	panel.cancelAdvancedLongSyntheticTick = () => {};
	panel.armAdvancedLongSyntheticTick = () => {};
	panel.flushAdvancedLongReleaseCommit = async () => {};
	panel.flushAdvancedLongReleaseCommitFamily = async () => {};
	panel.toggleOnOffForNonBooleanCapability = async () => {};
	panel.processClickMessage = parameters => panel.processAdvancedButtonStateClick(parameters);
	const runAdvancedEventMapping = panel.runAdvancedEventMapping.bind(panel);
	panel.runAdvancedEventMapping = async (parameters, event) =>
	{
		const binding = panel.resolveAdvancedEventBinding(parameters, event);
		if (!binding)
		{
			return false;
		}
		if (!binding.flowTriggerOnly)
		{
			actions.push(event);
		}
		return true;
	};
	panel.error = error => { throw error; };

	const tick = async elapsed =>
	{
		const until = clock + elapsed;
		while (timers.size > 0)
		{
			const next = [...timers].filter(([, timer]) => timer.due <= until).sort((a, b) => a[1].due - b[1].due)[0];
			if (!next)
			{
				break;
			}
			clock = next[1].due;
			timers.delete(next[0]);
			await next[1].callback();
			await new Promise(resolve => setImmediate(resolve));
		}
		clock = until;
	};
	const message = event => panel.processMQTTMessage({ id: 'panel', idx: connector * 2 + (side === 'left' ? 0 : 1), page, event });
	return { panel, message, tick, events, actions, timers, runAdvancedEventMapping };
}

async function run()
{
	let cases = 0;
	for (const side of ['left', 'right'])
	{
		for (const connector of [0, 1, 7])
		{
			for (const page of [0, 1, 2])
			{
				for (const doubleTarget of ['none', 'selected-flow-only', 'mapped', 'direction'])
				{
					for (const longMapping of [false, true])
					{
						const configNo = connector === 0 ? 0 : 1;
						const context = `${side}/${connector}/${page}/${doubleTarget}/long=${longMapping}`;
						const { panel, message, tick, events, actions, timers, runAdvancedEventMapping } = createPanel(side, connector, page, configNo, 'advanced', doubleTarget, longMapping);
						const key = `${connector}_${side}_${page}`;
						const parameters = { connector, side, page, configNo, connectorType: 1 };
						const binding = panel.resolveAdvancedEventBinding(parameters, 'double');
						assert(binding, `${context}: double-click binding exists, including Flow-only with a selected device`);
						assert.strictEqual(binding.directionOnly, doubleTarget === 'direction');
						assert.strictEqual(binding.flowTriggerOnly, doubleTarget === 'none' || doubleTarget === 'selected-flow-only');
						if (binding.flowTriggerOnly)
						{
							assert.strictEqual(await runAdvancedEventMapping(parameters, 'double'), true, `${context}: Flow-only mapping needs no device action or display/direction side effects`);
						}
						const configEvents = () => events.filter(event => event.type === 'config').map(event => event.event);
						const assertRoutes = () =>
						{
							for (const event of events)
							{
								assert.strictEqual(event.side, side, context);
								if (event.type === 'config')
								{
									assert.strictEqual(event.config, configNo, context);
									assert.strictEqual(event.page, page, context);
								}
								else
								{
									assert.strictEqual(event.connector, connector, context);
								}
							}
							assert.deepStrictEqual(events.filter(event => event.type === 'connector').map(event => event.event), configEvents(), `${context}: connector and configuration events agree`);
						};

						await message('click');
						await message('click');
						assert.deepStrictEqual(configEvents(), ['pressed'], `${context}: immediate Pressed, duplicate down ignored`);
						await tick(500);
						assert.deepStrictEqual(configEvents(), ['pressed'], `${context}: holding cannot resolve a click`);
						await message('release');
						await tick(349);
						assert.deepStrictEqual(configEvents(), ['pressed'], context);
						await tick(1);
						assert.deepStrictEqual(configEvents(), ['pressed', 'clicked', 'released'], `${context}: one single click after 350 ms from release`);
						assert.strictEqual(panel.buttonValues.get(`${side}_${connector}_${page}`), true);
						assertRoutes();
						events.length = 0;

						await message('click');
						await message('release');
						await tick(20);
						await message('click');
						await message('release');
						await tick(350);
						assert.deepStrictEqual(configEvents(), ['pressed', 'double'], `${context}: double click suppresses single-click action and Released`);
						assert.strictEqual(panel.buttonValues.get(`${side}_${connector}_${page}`), true, `${context}: no single-click toggle leaks into double click`);
						assert.deepStrictEqual(actions, doubleTarget === 'mapped' || doubleTarget === 'direction' ? ['double'] : [], context);
						assertRoutes();
						events.length = 0;

						await message('click');
						await tick(500);
						await message('longpress');
						await tick(500);
						await message('longpress');
						await message('release');
						await tick(350);
						assert.deepStrictEqual(configEvents(), ['pressed', 'long', 'long', 'released'], `${context}: hold cancels click and releases once`);
						for (const type of ['config', 'connector'])
						{
							assert.deepStrictEqual(events.filter(event => event.type === type && event.event === 'long').map(event => event.repeatCount), [0, 1], `${context}: ${type} repeat tokens`);
						}
						assert.strictEqual(panel.clickEventStates.has(key), false, `${context}: release clears completed long-press state`);
						assertRoutes();
						events.length = 0;

						await message('click');
						await message('release');
						await tick(350);
						assert.deepStrictEqual(configEvents(), ['pressed', 'clicked', 'released'], `${context}: a single click after a hold still works`);
						assert.strictEqual(panel.buttonValues.get(`${side}_${connector}_${page}`), false, `${context}: subsequent action toggles Off`);
						assertRoutes();
						assert.strictEqual(timers.size, 0, `${context}: no timers leak`);
						cases++;
					}
				}

				const basic = createPanel(side, connector, page, 0, 'basic', 'none', false);
				await basic.message('click');
				assert.deepStrictEqual(basic.events.filter(event => event.type === 'config').map(event => event.event), ['pressed', 'clicked'], 'STD clicks remain immediate');
				await basic.message('release');
				assert.strictEqual(basic.timers.size, 0, 'STD has no double-click delay');
			}
		}
	}
	console.log(`PASS: ${cases} ADV event lifecycles, both sides, connectors 0/1/7, pages 0/1/2, Flow-only/mapped/direction actions, post-hold recovery, repeat tokens, and immediate STD clicks`);
}

run().catch(error =>
{
	console.error(error);
	process.exitCode = 1;
});
