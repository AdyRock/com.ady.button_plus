'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'settings', 'settings.js'), 'utf8');
function readFunction(name, nextName)
{
	const start = source.indexOf(`\nfunction ${name}(`);
	const end = source.indexOf(`\nfunction ${nextName}(`, start);
	assert(start >= 0 && end > start);
	return source.slice(start, end);
}

const initStart = source.indexOf('\nfunction initialiseSettingsPage(');
const initEnd = source.indexOf('\n\tsetupGroupUI();', initStart);
assert(initStart >= 0 && initEnd > initStart);
const initialization = `${source.slice(initStart, initEnd)}\n}`;
const functions = [
	readFunction('renderLoadedButtonConfiguration', 'getDevices'),
	readFunction('getDevices', 'fillButtonDevices'),
	readFunction('setupButtonBrokerItems', 'buttonDeviceChanged'),
	readFunction('sortDevices', 'filterButtonDevices'),
	readFunction('filterButtonDevices', 'renderLoadedButtonConfiguration'),
].join('\n');

function permutations(values)
{
	if (values.length === 0) return [[]];
	return values.flatMap((value, index) => permutations(values.filter((_, i) => i !== index)).map(rest => [value, ...rest]));
}

function createPage()
{
	const callbacks = new Map();
	const elements = new Map();
	const renders = [];
	const alerts = [];
	let brokerDraws = 0;
	const element = id =>
	{
		if (!elements.has(id))
		{
			elements.set(id, {
				style: {},
				options: [],
				add(option) { this.options.push(option); },
				set length(value) { this.options.length = value; },
			});
		}
		return elements.get(id);
	};
	const context = {
		console: { log() {} },
		document: {
			getElementById: element,
			createElement: () => ({}),
			querySelector: () => null,
			body: { classList: { toggle() {} } },
		},
		window: { addEventListener() {} },
		Homey: {
			get: (key, callback) => callbacks.set(key, callback),
			api: (method, url, body, callback) => callbacks.set(url, callback),
			__: key => key,
			alert: error => alerts.push(error),
		},
		BUTTON_VISIBLE_CONFIGURATION_COUNT_KEY: 'visibleCount',
		BUTTON_PANEL_CONTROLS_COLLAPSED_KEY: 'collapsed',
		CONFIG_DRAFT_STORAGE_KEY: 'draft',
		CONFIG_DRAFT_DISMISSED_SIGNATURE_KEY: 'dismissed',
		MAX_BUTTON_CONFIGURATIONS: 40,
		MAX_DISPLAY_CONFIGURATIONS: 20,
		localButtonConfigurations: [],
		localDisplayConfigurations: [],
		localBrokerItems: [],
		buttonConfigurationsFetched: false,
		buttonDevicesFetched: false,
		displayDevicesFetched: false,
		displayConfigurationsFetched: false,
		brokerItemsFetched: false,
		currentButtonConfigurationNo: 0,
		currentDisplayConfigurationNo: 0,
		customMQTTItemsElements: [],
		customDisplayMQTTItemsElements: [],
		restoredDraftDefaultBroker: null,
		buttonConfigurationNoElement: element('buttonConfiguration'),
		displayConfigurationNoElement: element('displayConfiguration'),
		defaultBrokerElement: element('defaultBroker'),
		setupFilterableSelects() {},
		isHomeyMobileAppRuntime: () => false,
		applyDisplaySimulatorLocalization() {},
		adjustMainTopOffset() {},
		scheduleMainTopOffsetAdjustment() {},
		getDisplayedButtonConfigurationNos() {},
		getDisplayedButtonPageCount: () => 4,
		updateButtonPanelControlsExpander() {},
		fillConfigListElement() {},
		maybeHandleLoadedConfigurationDraft() {},
		getButtonList() {},
		fillDisplayDevices() {},
		normalizeDisplayConfigurationsPages() {},
		updateDisplayConfiguration() {},
		fillDefaultBrokerList() {},
		setBrokerSelectValue: (select, value) => { select.value = value; },
		drawBrokerItems: () => { brokerDraws += 1; },
		setTimeout: () => { assert.fail('Loading must not poll for broker readiness'); },
		writeButtonsections: pages =>
		{
			assert(context.buttonConfigurationsFetched && context.buttonDevicesFetched, 'Do not render before both responses arrive');
			renders.push(pages);
		},
		updateButtonPanelControls: () => context.setupButtonBrokerItems(),
	};
	vm.createContext(context);
	vm.runInContext(`${initialization}\n${functions}\ninitialiseSettingsPage(Homey);`, context);
	return { context, callbacks, renders, alerts, getBrokerDraws: () => brokerDraws, element };
}

for (const order of permutations(['buttonConfigurations', 'displayConfigurations', '/Devices/', 'brokerConfigurationItems', 'visibleCount']))
{
	const page = createPage();
	const settings = {
		buttonConfigurations: [Array.from({ length: 4 }, (_, PageNum) => ({ PageNum, leftBrokerId: 'Default', rightBrokerId: 'Default' }))],
		displayConfigurations: [{ version: 2, items: Array.from({ length: 8 }, (_, itemId) => ({ itemId, page: 1, brokerId: 'Default' })) }],
		'/Devices/': { lamp: { id: 'lamp', zone: { name: 'Kitchen' }, capabilitiesObj: { onoff: { type: 'boolean' } } } },
		brokerConfigurationItems: [{ brokerid: 'homey', enabled: true }],
		visibleCount: 2,
	};
	for (const key of order)
	{
		page.callbacks.get(key)(null, settings[key]);
	}
	assert(page.renders.length >= 1 && page.renders.length <= 2, `Avoid redundant initial renders: ${order}`);
	assert(page.renders.every(pages => pages === 4), 'Preserve all four configured pages');
	assert(page.getBrokerDraws() > 0, `Brokers must eventually render: ${order}`);
	assert.strictEqual(page.context.buttonVisibleConfigurationCount, 2);
	assert.strictEqual(page.context.displayDevicesArray.length, 1);
	assert.strictEqual(page.context.buttonDevicesArray.length, 1);
	assert.strictEqual(page.context.localDisplayConfigurations[0].items.length, 8);
	assert.deepStrictEqual(page.alerts, []);
	page.callbacks.get('defaultBroker')(null, 'homey');
	assert.strictEqual(page.context.defaultBrokerFetched, true);
	assert.strictEqual(page.context.defaultBrokerElement.value, 'homey');
	for (let index = 0; index < 4; index++)
	{
		assert.deepStrictEqual(page.element(`left${index}BrokerId`).options.map(option => option.value), ['Default', 'homey']);
	}
}

for (const configuration of [[], [[{ PageNum: 0 }]], [{ PageNum: 0 }]])
{
	const page = createPage();
	page.callbacks.get('/Devices/')(null, {});
	assert.strictEqual(page.renders.length, 0, 'An early device response must not render missing settings');
	page.callbacks.get('buttonConfigurations')(null, configuration);
	assert.deepStrictEqual(page.renders, [1], 'Empty and legacy configurations must still render');
}

for (const key of ['buttonConfigurations', '/Devices/', 'brokerConfigurationItems'])
{
	const page = createPage();
	const error = new Error(`${key} unavailable`);
	page.callbacks.get(key)(error);
	assert.deepStrictEqual(page.alerts, [error], 'Failed requests must remain visible to the user');
	assert.strictEqual(page.renders.length, 0);
}

process.stdout.write('Settings loading response-order tests passed (120 permutations).\n');
