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
const loadingStart = source.indexOf('const settingsLoadingDependencies = ');
const loadingEnd = source.indexOf('let buttonDevicesArray', loadingStart);
assert(loadingStart >= 0 && loadingEnd > loadingStart);
const functions = [
	source.slice(loadingStart, loadingEnd),
	readFunction('completeSettingsLoading', 'initialiseSettingsPage'),
	readFunction('fetchAndInitGroupConfigurations', 'updateGroupListDropdown'),
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
			const classes = new Set();
			elements.set(id, {
				style: {},
				options: [],
				hidden: false,
				attributes: { 'aria-busy': 'true' },
				classList: {
					toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
					contains: name => classes.has(name),
				},
				setAttribute(name, value) { this.attributes[name] = value; },
				querySelector: selector => element(`${id}${selector}`),
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
		updateGroupListDropdown() {},
		loadGroupIntoForm() {},
		currentGroupIndex: 0,
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
	vm.runInContext(`${initialization}\n${functions}\ninitialiseSettingsPage(Homey);\nfetchAndInitGroupConfigurations();`, context);
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
		const buttonReady = ['buttonConfigurations', '/Devices/', 'brokerConfigurationItems'].every(required => order.indexOf(required) <= order.indexOf(key));
		const displayReady = buttonReady && order.indexOf('displayConfigurations') <= order.indexOf(key);
		assert.strictEqual(page.element('panelConfigLoading').hidden, buttonReady, `Button loading state: ${order}, ${key}`);
		assert.strictEqual(page.element('panelConfig').attributes['aria-busy'], buttonReady ? 'false' : 'true');
		assert.strictEqual(page.element('brokerConfigLoading').hidden, buttonReady);
		assert.strictEqual(page.element('displayConfigLoading').hidden, displayReady);
		assert.strictEqual(page.element('groupConfigLoading').hidden, false, 'Groups must wait for their own response');
	}
	page.callbacks.get('groupConfigurations')(null, []);
	assert.strictEqual(page.element('groupConfigLoading').hidden, true);
	assert.strictEqual(page.element('groupConfig').attributes['aria-busy'], 'false');
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

for (const key of ['buttonConfigurations', 'displayConfigurations', '/Devices/', 'brokerConfigurationItems', 'groupConfigurations'])
{
	const page = createPage();
	const error = new Error(`${key} unavailable`);
	page.callbacks.get(key)(error);
	assert.deepStrictEqual(page.alerts, [error], 'Failed requests must remain visible to the user');
	assert.strictEqual(page.renders.length, 0);
	assert.strictEqual(page.element('groupConfigLoading').hidden, false);
	assert.strictEqual(page.element('groupConfigLoading').classList.contains('settings-loading-error'), true);
	assert.strictEqual(page.element('groupConfigLoading.settings-loading-text').textContent, 'settings.loadingFailed');
	assert.strictEqual(page.element('groupConfig').attributes['aria-busy'], 'false', 'An error must stop the busy state');
	page.context.completeSettingsLoading('unrelated-request');
	assert.strictEqual(page.element('groupConfigLoading').classList.contains('settings-loading-error'), true, 'Later responses must not conceal the error');
}

{
	const page = createPage();
	page.callbacks.get('groupConfigurations')(null, []);
	page.callbacks.get('displayConfigurations')(null, []);
	page.callbacks.get('buttonConfigurations')(null, []);
	page.callbacks.get('brokerConfigurationItems')(null, []);
	assert.strictEqual(page.element('panelConfigLoading').hidden, false, 'Slow devices keep the loading indicator visible');
	assert.strictEqual(page.element('displayConfigLoading').hidden, false);
	assert.strictEqual(page.element('groupConfigLoading').hidden, false);
	page.callbacks.get('/Devices/')(null, {});
	for (const view of ['panelConfig', 'displayConfig', 'brokerConfig', 'groupConfig'])
	{
		assert.strictEqual(page.element(`${view}Loading`).hidden, true, 'Empty settings must still finish loading');
		assert.strictEqual(page.element(view).attributes['aria-busy'], 'false');
	}
}

process.stdout.write('Settings loading response-order tests passed (120 permutations).\n');
