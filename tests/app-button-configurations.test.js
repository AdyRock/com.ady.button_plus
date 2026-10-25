'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { isSvgTextContent, normalizeSvgText } = require('../lib/SvgHelper');
const { getScale, scaleValue, getHomeyScale, getDisplayTopic } = require('../lib/CapabilityScale');

assert.strictEqual(scaleValue(0.1, '', 'dim'), 10);
assert.strictEqual(scaleValue(0.1, 100, 'dim'), 10);
assert.strictEqual(scaleValue(0.1, 1, 'dim'), 0.1);
assert.strictEqual(scaleValue(1500, 0.001, 'measure_power'), 1.5);
assert.strictEqual(scaleValue(true, 100, 'onoff'), true);
assert.strictEqual(scaleValue('0.1', 100, 'enum'), '0.1');
for (const invalidScale of ['', 0, -1, 'bad', Infinity, null, undefined])
{
	assert.strictEqual(getScale(invalidScale), null);
}

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const methodStart = source.indexOf('\n\tasync sanitizeStoredButtonConfigurations(');
const methodEnd = source.indexOf('\n\t// ========== DEVICE CONFIGURATION UPLOAD', methodStart);
assert(methodStart >= 0 && methodEnd > methodStart);

async function sanitize(pageConfig)
{
	const app = vm.runInNewContext(`new (class { ${source.slice(methodStart, methodEnd)} })()`);
	const configurations = [[pageConfig]];
	let writes = 0;
	app.homey = { settings: {
		get: () => configurations,
		set: () => { writes += 1; },
	} };
	app.isButtonPlusDeviceId = async deviceId => deviceId === 'other-panel';
	app.updateLog = () => {};
	const changed = await app.sanitizeStoredButtonConfigurations('test');
	return { changed, writes };
}

function checkBlankButtonPageFallbackResolver()
{
	const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
	const methodStart = source.indexOf('\n\tisButtonPageSideBlank(');
	const methodEnd = source.indexOf('\n\tasync applyButtonConfiguration(', methodStart);
	assert(methodStart >= 0 && methodEnd > methodStart);
	const app = vm.runInNewContext(`new (class { ${source.slice(methodStart, methodEnd)} })()`);
	const pages = [
		{
			PageNum: 0,
			leftMode: 'basic',
			leftDevice: 'lamp',
			leftCapability: 'onoff',
			leftTopText: 'Kitchen',
			leftOnText: 'On',
			rightMode: 'basic',
			rightDevice: 'thermostat',
			rightCapability: 'target_temperature',
			rightTopText: 'Temperature',
		},
		{
			PageNum: 1,
			leftMode: 'basic',
			leftDevice: 'none',
			leftCapability: '',
			leftTopText: '',
			leftOnText: '',
			leftOffText: '',
			leftOnSVG: '',
			leftOffSVG: '',
			leftBlankPageFallback: 'page0',
			rightMode: 'basic',
			rightDevice: 'none',
			rightCapability: '',
			rightTopText: '',
			rightBlankPageFallback: 'blank',
		},
	];
	const effectivePage = app.resolveEffectiveButtonPageConfiguration(pages, 1);
	assert.strictEqual(effectivePage.leftDevice, 'lamp', 'Blank left side inherits the page-0 device when selected');
	assert.strictEqual(effectivePage.leftCapability, 'onoff');
	assert.strictEqual(effectivePage.leftTopText, 'Kitchen');
	assert.strictEqual(effectivePage.leftBlankPageFallback, 'page0', 'Page-specific fallback choice is retained');
	assert.strictEqual(effectivePage.PageNum, 1, 'Inherited content remains assigned to the current page');
	assert.strictEqual(effectivePage.rightDevice, 'none', 'Blank mode keeps an unconfigured right side blank');

	const deviceSource = fs.readFileSync(path.join(__dirname, '..', 'drivers', 'panel_hardware', 'device.js'), 'utf8');
	const deviceResolverStart = deviceSource.indexOf('\n\tgetConfigPageSide(config, page, side, configNo)');
	const deviceResolverEnd = deviceSource.indexOf('\n\tformatVariableDisplayValue(', deviceResolverStart);
	assert(deviceResolverStart >= 0 && deviceResolverEnd > deviceResolverStart);
	const panelDevice = vm.runInNewContext(`new (class { ${deviceSource.slice(deviceResolverStart, deviceResolverEnd)} })()`, {
		normalizeSvgText: value => value,
	});
	app.buttonConfigurations = [pages];
	panelDevice.homey = { app };
	const effectiveDeviceSide = panelDevice.getConfigPageSide(null, 1, 'left', 0);
	assert.strictEqual(effectiveDeviceSide.deviceID, 'lamp', 'Runtime resolves the inherited page-0 target');
	assert.strictEqual(effectiveDeviceSide.page, 1, 'Runtime keeps the selected button page');

	pages[1].leftTopText = 'Page-specific label';
	assert.strictEqual(app.resolveEffectiveButtonPageConfiguration(pages, 1).leftDevice, 'none', 'Configured page-specific content prevents fallback');
	assert.strictEqual(app.isButtonPageSideBlank({ leftMode: 'advanced', leftDevice: 'none' }, 'left'), false, 'Advanced mappings are not considered blank buttons');
}

function checkButtonDisplayValuesPreferSvg()
{
	const deviceSource = fs.readFileSync(path.join(__dirname, '..', 'drivers', 'panel_hardware', 'device.js'), 'utf8');
	const methodStart = deviceSource.indexOf('\n\tgetButtonDisplayValues(textValue, svgValue)');
	const methodEnd = deviceSource.indexOf('\n\tgetConfigPageSide(', methodStart);
	assert(methodStart >= 0 && methodEnd > methodStart);
	const panel = vm.runInNewContext(`new (class { ${deviceSource.slice(methodStart, methodEnd)} })()`, {
		isSvgTextContent,
		normalizeSvgText,
	});

	const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle /></svg>';
	const svgValue = panel.getButtonDisplayValues('On', svg);
	assert.strictEqual(svgValue.textValue, '', 'SVG rendering clears the On/Off label');
	assert.strictEqual(svgValue.svgValue, svg, 'Valid SVG is retained');

	const textValue = panel.getButtonDisplayValues('Off', '');
	assert.strictEqual(textValue.textValue, 'Off', 'Text rendering retains the label');
	assert.strictEqual(textValue.svgValue, '', 'Text rendering clears a stale SVG');

	const invalidSvg = panel.getButtonDisplayValues('On', '<div>not svg</div>');
	assert.strictEqual(invalidSvg.textValue, 'On', 'Invalid SVG falls back to text');
	assert.strictEqual(invalidSvg.svgValue, '', 'Invalid SVG is not published');
}

async function checkPublishClearsRetainedSvgTopics()
{
	const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
	const methodStart = appSource.indexOf('\n\tasync publishMQTTMessage(');
	const methodEnd = appSource.indexOf('\n\tqueueMQTTMessage(', methodStart);
	assert(methodStart >= 0 && methodEnd > methodStart);
	const app = vm.runInNewContext(`new (class { ${appSource.slice(methodStart, methodEnd)} })()`);
	const published = [];
	app.lastMQTTData = new Map();
	app.MQTTClients = new Map([['test', {
		connected: true,
		publish: async (topic, data, options) => published.push({ topic, data, options }),
	}]]);
	app.updateLog = () => {};

	await app.publishMQTTMessage('test', 'buttonplus/panel/displayitem/0/svg/set', '   ');
	assert.strictEqual(published[0].data, '', 'Clearing SVG publishes a zero-byte retained tombstone');
	assert.strictEqual(published[0].options.retain, true, 'The SVG tombstone removes the retained topic');

	await app.publishMQTTMessage('test', 'buttonplus/panel/button/1-0/label/set', '');
	assert.strictEqual(published[1].data, ' ', 'Clearing non-SVG topics preserves existing behavior');

	await app.publishMQTTMessage('test', 'buttonplus/panel/displayitem/0/svg/set', '<svg/>');
	assert.strictEqual(published[2].data, '<svg/>', 'Non-empty SVG payloads are unchanged');
}

function checkSettingsPageFallbackToggle()
{
	const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'settings', 'settings.js'), 'utf8');
	const helperStart = settingsSource.indexOf('\nfunction isButtonSideBlankForPageFallback(');
	const helperEnd = settingsSource.indexOf('\nfunction toggleDisplayedButtonPageFallback(', helperStart);
	const toggleStart = settingsSource.indexOf('\nfunction toggleDisplayedButtonPageFallback(', helperEnd);
	const toggleEnd = settingsSource.indexOf('\nwindow.toggleDisplayedButtonPageFallback', toggleStart);
	assert(helperStart >= 0 && helperEnd > helperStart);
	assert(toggleStart >= 0 && toggleEnd > toggleStart);
	const blankPredicateEnd = settingsSource.indexOf('\nfunction getButtonSidePageFallbackPreviewConfig(', helperStart);
	const isBlank = vm.runInNewContext(`(${settingsSource.slice(helperStart, blankPredicateEnd).trim()})`);
	const pageConfig = {
		PageNum: 1,
		leftMode: 'basic',
		leftDevice: 'none',
		leftCapability: '',
		leftTopText: '',
		leftOnText: '',
		leftOffText: '',
		leftOnSVG: '',
		leftOffSVG: '',
		leftBlankPageFallback: 'page0',
	};
	assert.strictEqual(isBlank(pageConfig, 'left'), true, 'A deleted basic button is eligible for page-0 fallback');
	const currentConfig = [
		{ leftDevice: 'lamp', leftCapability: 'onoff', leftTopText: 'Kitchen' },
		pageConfig,
	];
	const previewResolverStart = settingsSource.indexOf('\nfunction getButtonSidePageFallbackPreviewConfig(');
	const previewResolverEnd = settingsSource.indexOf('\nfunction toggleDisplayedButtonPageFallback(', previewResolverStart);
	const previewResolver = vm.runInNewContext(`(${settingsSource.slice(previewResolverStart, previewResolverEnd).trim()})`, {
		isButtonSideBlankForPageFallback: isBlank,
	});
	const inheritedPreview = previewResolver(currentConfig, 1, 'left');
	assert.strictEqual(inheritedPreview.inherited, true);
	assert.strictEqual(inheritedPreview.pageConfig.leftDevice, 'lamp');
	assert.strictEqual(inheritedPreview.pageConfig.PageNum, 1, 'Inherited button content keeps the selected page number');
	pageConfig.leftTopText = 'Page-specific';
	assert.strictEqual(previewResolver(currentConfig, 1, 'left').inherited, false, 'Configured page-specific content is not replaced');
	pageConfig.leftTopText = '';

	let draftFlushes = 0;
	let activationCalls = 0;
	const toggle = vm.runInNewContext(`(${settingsSource.slice(toggleStart, toggleEnd).trim()})`, {
		localButtonConfigurations: [currentConfig],
		activateDisplayedButtonConfiguration: () => { activationCalls += 1; return true; },
		isButtonSideBlankForPageFallback: () => true,
		configDraftDirtySinceLoad: false,
		flushConfigurationDraftPersist() { draftFlushes += 1; },
		renderInlineButtonPagePreview() {},
		buttonPagePopupOverlayElement: null,
	});
	toggle({ preventDefault() {}, stopPropagation() {} }, 0, 'left', 1);
	assert.strictEqual(pageConfig.leftBlankPageFallback, 'blank', `The preview control toggles inherited content off (activation=${activationCalls}, flushes=${draftFlushes})`);
	toggle({ preventDefault() {}, stopPropagation() {} }, 0, 'left', 1);
	assert.strictEqual(pageConfig.leftBlankPageFallback, 'page0', 'The preview control toggles page-0 inheritance on');
	assert.strictEqual(draftFlushes, 2, 'Each fallback choice is persisted to the draft');
}

function checkDraftRestorePreservesVisibleButtonSlots()
{
	const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'settings', 'settings.js'), 'utf8');
	const functionStart = settingsSource.indexOf('\nfunction applyConfigurationDraft(');
	const functionEnd = settingsSource.indexOf('\nfunction maybeHandleLoadedConfigurationDraft(', functionStart);
	assert(functionStart >= 0 && functionEnd > functionStart);
	const visibleSlots = [0, 1, 2];
	const globals = {
		deepCloneData: value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value))),
		localButtonConfigurations: [],
		localDisplayConfigurations: [],
		localBrokerItems: [],
		buttonConfigurationsFetched: false,
		buttonConfigurationNoElement: { value: '' },
		buttonVisibleConfigurationNos: visibleSlots,
		currentButtonConfigurationNo: 0,
		MAX_BUTTON_CONFIGURATIONS: 40,
		Homey: { __: key => key },
		fillConfigListElement() {},
		writeButtonsections() {},
		updateButtonPanelControls() {},
	};
	const applyDraft = vm.runInNewContext(`(${settingsSource.slice(functionStart, functionEnd).trim()})`, globals);
	const draft = {
		buttonConfigurations: [[{ PageNum: 0 }], [{ PageNum: 0 }], [{ PageNum: 0 }]],
		currentButtonConfigurationNo: 2,
		buttonVisibleConfigurationNos: [0, 1, 2],
	};
	applyDraft(draft);
	assert.deepStrictEqual(visibleSlots, [0, 1, 2], 'Restoring a draft leaves Configurations 1, 2, and 3 in their original preview slots');
	assert.strictEqual(globals.currentButtonConfigurationNo, 2, 'The editor still restores the configuration being edited');
	assert.strictEqual(globals.buttonConfigurationNoElement.value, '2');

	applyDraft({ ...draft, buttonVisibleConfigurationNos: undefined });
	assert.deepStrictEqual(visibleSlots, [0, 1, 2], 'Older drafts without slot metadata do not replace the first preview slot');
}

function checkBasicButtonPopupVisibility()
{
	const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'settings', 'settings.js'), 'utf8');
	const start = settingsSource.indexOf('\nfunction updateButtonFieldPopupCapabilityState(');
	const end = settingsSource.indexOf('\nfunction restoreButtonFieldPopupCustomMQTTSection(', start);
	const updateVisibility = vm.runInNewContext(`(${settingsSource.slice(start, end)})`, {
		variablesArray: [{ id: 'boolean-variable', type: 'boolean' }, { id: 'number-variable', type: 'number' }],
		canScaleHomeyCapability: (_device, _capability, type) => type === 'number',
	});
	for (const [device, capability, type, hide] of [
		['missing-device', 'onoff', undefined, false],
		['missing-device', 'alarm_contact', undefined, false],
		['lamp', 'onoff', 'boolean', false],
		['lamp', 'dim', 'number', true],
		['thermostat', 'target_temperature', 'number', true],
		['picker', 'mode', 'enum', true],
		['_variable_', 'boolean-variable', 'boolean', false],
		['_variable_', 'number-variable', 'number', true],
		['none', '', undefined, false],
	])
	{
		for (const mode of ['text', 'svg'])
		{
			const row = () => ({ style: {}, querySelector: () => null });
			const capabilityRow = row();
			const fields = {
				Device: { value: device },
				Capability: { value: capability, selectedOptions: [{ dataset: type ? { type } : {} }], closest: () => capabilityRow },
				__booleanRenderMode: mode,
				__booleanRenderRow: row(),
			};
			for (const suffix of ['OnText', 'OffText', 'OnSVG', 'OffSVG', 'Unit', 'DisplayValueScale', 'DimChange'])
			{
				const fieldRow = row();
				fields[suffix] = { closest: () => fieldRow };
			}
			updateVisibility(fields);
			assert.strictEqual(fields.__booleanRenderRow.style.display, hide ? 'none' : 'flex', `${device}/${capability}/${mode}: render selector`);
			for (const suffix of ['OnText', 'OffText', 'OnSVG', 'OffSVG'])
			{
				const visible = !hide && (suffix.endsWith('SVG') ? mode === 'svg' : mode === 'text');
				assert.strictEqual(fields[suffix].closest().style.display, visible ? '' : 'none', `${device}/${capability}/${mode}/${suffix}`);
			}
		}
	}
	const capabilityStart = settingsSource.indexOf('\nfunction capabilityChanged(');
	const capabilityEnd = settingsSource.indexOf('\n// If the config and devices', capabilityStart);
	for (const type of [undefined, 'boolean', 'number'])
	{
		const elements = {
			left0Device: { value: 'missing-device' },
			left0Capability: { selectedOptions: [{ dataset: type ? { type } : {} }] },
		};
		for (const suffix of ['UnitDiv', 'DimChangeDiv', 'OnTextDiv', 'OffText', 'OffTextLabel'])
		{
			elements[`left0${suffix}`] = { style: {} };
		}
		const capabilityChanged = vm.runInNewContext(`(${settingsSource.slice(capabilityStart, capabilityEnd)})`, {
			document: { getElementById: id => elements[id] },
			buttonFieldPopupContext: null,
			variablesArray: [],
			itemDisplyType: 'block',
			hidePopupManagedFieldsForSection: () => {},
			renderInlineButtonPagePreview: () => {},
			buttonPagePopupOverlayElement: null,
		});
		capabilityChanged('left', 0, 'onoff');
		assert.strictEqual(elements.left0OnTextDiv.style.display, type === 'number' ? 'none' : 'block', `Main controls preserve On/Off fields for type ${type}`);
	}
}

async function checkPopupDefaults()
{
	const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'settings', 'settings.js'), 'utf8');
	const deviceSelectorStart = settingsSource.indexOf('\nfunction fillPopupDeviceSelector(');
	const deviceSelectorEnd = settingsSource.indexOf('\nfunction fillPopupCapabilitySelector(', deviceSelectorStart);
	const selectorStart = settingsSource.indexOf('\nfunction fillPopupCapabilitySelector(');
	const selectorEnd = settingsSource.indexOf('\nasync function resolvePopupCapabilityType(', selectorStart);
	assert(deviceSelectorStart >= 0 && deviceSelectorEnd > deviceSelectorStart);
	assert(selectorStart >= 0 && selectorEnd > selectorStart);
	const createOption = () => ({ dataset: {}, value: '', text: '' });
	const createSelect = () =>
	{
		const select = {
			options: [],
			dataset: {},
			selectedIndex: -1,
			dispatchedEvents: [],
			add(option) { this.options.push(option); },
			dispatchEvent(event) { this.dispatchedEvents.push(event); },
			querySelector(query) { return this.options.find(option => query === `option[value="${option.value}"]`); },
		};
		Object.defineProperty(select, 'innerHTML', {
			set() { this.options = []; this._value = ''; },
		});
		Object.defineProperty(select, 'value', {
			get() { return this.options.some(option => option.value === this._value) ? this._value : ''; },
			set(value) { this._value = this.options.some(option => option.value === value) ? value : ''; },
		});
		Object.defineProperty(select, 'selectedOptions', {
			get()
			{
				const selectedOption = this.options.find(option => option.value === this.value);
				return selectedOption ? [selectedOption] : [];
			},
		});
		return select;
	};
	const fillDeviceSelector = vm.runInNewContext(`(${settingsSource.slice(deviceSelectorStart, deviceSelectorEnd)})`, {
		buttonDevicesArray: [],
		document: { createElement: createOption },
		Homey: { __: key => key },
	});
	const missingDeviceSelector = createSelect();
	fillDeviceSelector(missingDeviceSelector, false, true, 'missing-device');
	assert.strictEqual(missingDeviceSelector.value, 'missing-device', 'Missing configured device remains selected');
	assert.strictEqual(missingDeviceSelector.options.find(option => option.value === 'missing-device').text, 'missing-device (Missing)');
	const fillSelector = vm.runInNewContext(`(${settingsSource.slice(selectorStart, selectorEnd)})`, {
		document: { createElement: createOption },
		Event,
		Homey: {
			__: key => key,
			api: (_method, _route, args, callback) =>
			{
				if (args.deviceId === 'missing-device')
				{
					callback(new Error('Device not found'), null);
					return;
				}
				callback(null, { dim: { id: 'dim', type: 'number', setable: true } });
			},
		},
	});
	for (const [stored, expected] of [['', '__flowTrigger__'], ['dim', 'dim'], ['__toggleDirection__', '__toggleDirection__'], ['__flowTrigger__', '__flowTrigger__']])
	{
		const selector = createSelect();
		await fillSelector(selector, 'other-panel', stored, 'event');
		assert.strictEqual(selector.value, expected, `Popup selection for ${JSON.stringify(stored)}`);
		assert.strictEqual(selector.options.find(option => option.value === '__flowTrigger__').dataset.flowTriggerOnly, 'true');
	}
	const missingCapabilitySelector = createSelect();
	await fillSelector(missingCapabilitySelector, 'missing-device', 'target_temperature.inside', 'event', 'number');
	assert.strictEqual(missingCapabilitySelector.value, 'target_temperature.inside', 'Missing configured capability remains selected');
	const missingCapabilityOption = missingCapabilitySelector.options.find(option => option.value === 'target_temperature.inside');
	assert.strictEqual(missingCapabilityOption.text, 'target_temperature.inside (Missing)');
	assert.strictEqual(missingCapabilityOption.dataset.type, 'number', 'Missing numeric capability retains its type');
	const missingToggleSelector = createSelect();
	await fillSelector(missingToggleSelector, 'missing-device', '__toggleDirection__', 'event');
	assert.strictEqual(missingToggleSelector.value, '__toggleDirection__', 'Missing-device mappings retain Toggle direction');
	assert(missingToggleSelector.dispatchedEvents.some(event => event.type === 'change'), 'Programmatic selection notifies the filterable-select input display');
	const stateStart = settingsSource.indexOf('\t\t\tconst updateFlowTriggerState = function()');
	const stateEnd = settingsSource.indexOf('\n\t\t\tconst eventDevice =', stateStart);
	const deviceChangeStart = settingsSource.indexOf("\n\t\t\tdevElement.addEventListener('change', () =>", stateEnd);
	const deviceChangeEnd = settingsSource.indexOf('\n\t\t\tcapElement.addEventListener(', deviceChangeStart);
	assert(stateStart >= 0 && stateEnd > stateStart);
	assert(deviceChangeStart >= 0 && deviceChangeEnd > deviceChangeStart);
	const capabilitySelector = { selectedOptions: [{ dataset: { flowTriggerOnly: 'true' } }] };
	const stepInput = {};
	const updateState = vm.runInNewContext(`(function() { ${settingsSource.slice(stateStart, stateEnd)} return updateFlowTriggerState; })()`, {
		devElement: { value: 'other-panel' },
		capElement: capabilitySelector,
		stepElement: stepInput,
		updateStepVisibility: () => {},
	});
	updateState();
	assert.strictEqual(capabilitySelector.disabled, false, 'Flow-only selection must allow choosing a real action');
	assert.strictEqual(stepInput.disabled, true, 'Flow-only mappings have no numeric step');
	const toggleStepInput = {};
	const updateToggleState = vm.runInNewContext(`(function() { ${settingsSource.slice(stateStart, stateEnd)} return updateFlowTriggerState; })()`, {
		devElement: { value: 'missing-device' },
		capElement: missingToggleSelector,
		stepElement: toggleStepInput,
		updateStepVisibility: () => {},
	});
	updateToggleState();
	assert.strictEqual(missingToggleSelector.value, '__toggleDirection__', 'Popup state updates do not replace a missing-device toggle with Flow Trigger Only');
	assert.strictEqual(missingToggleSelector.disabled, false, 'A missing target device does not disable Toggle direction');
	let deviceChangeHandler;
	const missingDeviceElement = {
		value: 'another-missing-device',
		addEventListener: (_eventName, handler) => { deviceChangeHandler = handler; },
	};
	const registerDeviceChangeHandler = vm.runInNewContext(`(function() { ${settingsSource.slice(deviceChangeStart, deviceChangeEnd)} })`, {
		devElement: missingDeviceElement,
		capElement: missingToggleSelector,
		fillPopupCapabilitySelector: fillSelector,
		updateFlowTriggerState: updateToggleState,
	});
	registerDeviceChangeHandler();
	deviceChangeHandler();
	await Promise.resolve();
	assert.strictEqual(missingToggleSelector.value, '__toggleDirection__', 'Changing to another missing device preserves Toggle direction');
}

async function checkSignedAdvancedSteps()
{
	const deviceSource = fs.readFileSync(path.join(__dirname, '..', 'drivers', 'panel_hardware', 'device.js'), 'utf8').replace(/\r\n/g, '\n');
	const parseStart = deviceSource.indexOf('\n\tparseValueStep(');
	const parseEnd = deviceSource.indexOf('\n\tformatDimPercentageValue(', parseStart);
	const directionStart = deviceSource.indexOf('\n\tgetAdvancedDirectionKey(');
	const directionEnd = deviceSource.indexOf('\n\tresolveAdvancedSideConfig(', directionStart);
	const actionStart = deviceSource.indexOf('\n\tasync runAdvancedEventMapping(');
	const actionEnd = deviceSource.indexOf('\n\t}\n', actionStart) + 4;
	assert(parseStart >= 0 && parseEnd > parseStart);
	assert(directionStart >= 0 && directionEnd > directionStart);
	assert(actionStart >= 0 && actionEnd > actionStart);
	const panel = vm.runInNewContext(`new (class { ${deviceSource.slice(parseStart, parseEnd)}${deviceSource.slice(directionStart, directionEnd)}${deviceSource.slice(actionStart, actionEnd)} })()`);
	panel.advancedDirectionStates = new Map();
	panel.getDeviceAndCapability = async () => ({ capability: { type: 'number', min: 16, max: 30 } });
	let usesDirection = true;
	panel.resolveAdvancedEventBinding = (_parameters, eventType) => (usesDirection && eventType === 'double' ? { numericAction: 'toggleDirection', directionOnly: true } : null);
	const parameters = { connector: 1, side: 'right' };
	assert.strictEqual(panel.getAdvancedStepDelta(parameters, '-1'), -1, 'A negative step decreases by default');
	assert.strictEqual(panel.getAdvancedStepDelta(parameters, '+1'), -1, 'The default direction persists across repeat steps');
	panel.setAdvancedDirection(parameters, '+');
	assert.strictEqual(panel.getAdvancedStepDelta(parameters, '-1'), 1, 'An explicit direction override takes precedence');
	panel.advancedDirectionStates.delete('1_right');
	panel.prepareAdvancedDirectionForEvent(parameters, { numericAction: 'change', rawValueStep: '-1', valueStep: '-1' });
	assert.strictEqual(panel.getAdvancedDirection(parameters), '-', 'A missing-device preview uses the configured negative step direction');
	const leftParameters = { connector: 1, side: 'left' };
	panel.prepareAdvancedDirectionForEvent(leftParameters, { numericAction: 'change', rawValueStep: '+1', valueStep: '+1' });
	assert.strictEqual(panel.getAdvancedDirection(leftParameters), '+', 'A missing-device preview uses the configured positive step direction');
	assert.strictEqual(panel.getAdvancedStepDelta({ connector: 2, side: 'left' }, '+2'), 2, 'Positive steps increase by default');
	usesDirection = false;
	const capability = { type: 'number', value: 29, min: 16, max: 30 };
	panel.homey = { app: {
		updateLog() {},
		getHomeyDeviceById: async () => ({ id: 'ac' }),
		getHomeyCapabilityByName: async () => capability,
	} };
	panel.resolveAdvancedEventBinding = (button, eventType) =>
	{
		if (eventType === 'click')
		{
			return {
				deviceID: 'ac',
				capabilityName: 'target_temperature',
				numericAction: 'change',
				valueStep: button.side === 'left' ? 1 : -1,
				rawValueStep: button.side === 'left' ? '+1' : '-1',
			};
		}
		return usesDirection && eventType === 'double' ? { numericAction: 'toggleDirection', directionOnly: true } : null;
	};
	panel.showInitialAdvancedDisplayValue = async () => false;
	panel.getPendingAdvancedDebounceValue = () => undefined;
	panel.getNumericActionForValueType = (_value, action) => action;
	panel.applyAdvancedDisplayPreviewValue = async () => true;
	panel.applyAdvancedEventDisplayFeedback = async () => {};
	panel.applyAdvancedDisplayBinding = async () => {};
	panel.applyAdvancedLedBinding = async () => {};
	panel.isLockButtonCapability = () => false;
	panel.guardedSetCapabilityValueOnDevice = async (_device, _name, value) =>
	{
		capability.value = value;
		for (const button of [leftParameters, parameters])
		{
			await panel.updateAdvancedDirectionForExternalChange(button, { deviceID: 'ac', capabilityName: 'target_temperature' }, value);
		}
	};
	for (const [button, expected] of [[leftParameters, 30], [leftParameters, 30], [parameters, 29], [leftParameters, 30], [parameters, 29]])
	{
		await panel.runAdvancedEventMapping(button, 'click');
		assert.strictEqual(capability.value, expected, 'Opposite temperature buttons retain their signed writes at the upper bound');
	}
	capability.value = 17;
	for (const [button, expected] of [[parameters, 16], [parameters, 16], [leftParameters, 17], [parameters, 16], [leftParameters, 17]])
	{
		await panel.runAdvancedEventMapping(button, 'click');
		assert.strictEqual(capability.value, expected, 'Opposite temperature buttons retain their signed writes at the lower bound');
	}
	for (const value of [16, 30, 22])
	{
		for (const button of [leftParameters, parameters])
		{
			await panel.updateAdvancedDirectionForExternalChange(button, { deviceID: 'ac', capabilityName: 'target_temperature' }, value);
		}
		assert.strictEqual(panel.getAdvancedStepDelta(leftParameters, '+1'), 1, 'The increase button keeps its signed step after external changes');
		assert.strictEqual(panel.getAdvancedStepDelta(parameters, '-1'), -1, 'The decrease button keeps its signed step after external changes');
	}
	assert.strictEqual(panel.getAdvancedStepDelta(parameters, '+2'), 2, 'Changing a signed step does not inherit the previous step direction');
	usesDirection = true;
	panel.applyAdvancedDirectionAtBounds(leftParameters, 30, 16, 30);
	assert.strictEqual(panel.getAdvancedStepDelta(leftParameters, '+1'), -1, 'Explicit direction controls retain automatic reversal at the upper bound');
	assert.strictEqual(panel.getAdvancedStepDelta(parameters, '-1'), 1, 'Reversing one button does not change the other button direction');
	panel.applyAdvancedDirectionAtBounds(leftParameters, 16, 16, 30);
	assert.strictEqual(panel.getAdvancedStepDelta(leftParameters, '+1'), 1, 'Explicit direction controls reverse at the lower bound');
	assert.strictEqual(panel.isAdvancedStepRelative('10'), false, 'Unsigned advanced values are absolute targets');
	assert.strictEqual(panel.isAdvancedStepRelative('+10'), true, 'An explicit plus marks a relative increment');
	assert.strictEqual(panel.isAdvancedStepRelative('-10'), true, 'An explicit minus marks a relative decrement');
	assert.strictEqual(panel.getAdvancedAbsoluteValue('25', 'dim', {}), 0.25, 'Dim absolute targets use percentages');
	assert.strictEqual(panel.getAdvancedAbsoluteValue('50', 'windowcoverings_set', { min: 0, max: 1 }), 0.5, 'Blind absolute targets use percentages in a 0-1 range');
	assert.strictEqual(panel.getAdvancedAbsoluteValue('25', 'target_temperature', { min: 5, max: 30 }), 25, 'Other numeric absolute targets use capability units');
}

async function checkAdvancedDisplayFeedback()
{
	const deviceSource = fs.readFileSync(path.join(__dirname, '..', 'drivers', 'panel_hardware', 'device.js'), 'utf8');
	const resolveStart = deviceSource.indexOf('\n\tresolveAdvancedDisplayBinding(parameters)');
	const resolveEnd = deviceSource.indexOf('\n\tresolveAdvancedLedBinding(parameters)', resolveStart);
	const idleStart = deviceSource.indexOf('\n\tgetAdvancedDisplayIdleValue(binding, parameters)');
	const idleEnd = deviceSource.indexOf('\n\tasync applyAdvancedDisplayBinding(parameters, overrideValue)', idleStart);
	const applyStart = deviceSource.indexOf('\n\tasync applyAdvancedDisplayBinding(parameters, overrideValue)');
	const applyEnd = deviceSource.indexOf('\n\tasync applyAdvancedDisplayPreviewValue(', applyStart);
	const feedbackStart = deviceSource.indexOf('\n\tasync applyAdvancedEventDisplayFeedback(');
	const feedbackEnd = deviceSource.indexOf('\n\tasync applyAdvancedDisplayPreviewValue(', feedbackStart);
	const eventMappingStart = deviceSource.indexOf('\n\tasync runAdvancedEventMapping(parameters, eventType)');
	const eventMappingEnd = deviceSource.indexOf('\n\tqueueClickedTrigger(key, fireFn)', eventMappingStart);
	assert(resolveStart >= 0 && resolveEnd > resolveStart);
	assert(idleStart >= 0 && idleEnd > idleStart);
	assert(applyStart >= 0 && applyEnd > applyStart);
	assert(feedbackStart >= 0 && feedbackEnd > feedbackStart);
	assert(eventMappingStart >= 0 && eventMappingEnd > eventMappingStart);
	assert(deviceSource.includes('this.resolveAdvancedDisplayInitialValue(effectiveDisplayBinding, advancedParameters)'), 'Startup rendering uses the idle-display resolution path');

	const published = [];
	const scheduledTimers = new Map();
	let nextTimerId = 1;
	const panel = vm.runInNewContext(`new (class { ${deviceSource.slice(resolveStart, resolveEnd)}${deviceSource.slice(idleStart, idleEnd)}${deviceSource.slice(applyStart, applyEnd)}${deviceSource.slice(feedbackStart, feedbackEnd)}${deviceSource.slice(eventMappingStart, eventMappingEnd)} })()`, {
		ADVANCED_DISPLAY_FEEDBACK_MS: 3000,
		normalizeSvgText: value => value,
		getHomeyScale,
		scaleValue,
	});
	const sideConfig = {
		leftMode: 'advanced',
		leftDisplayDevice: 'missing-ac',
		leftDisplayCapability: '',
		leftDevice: 'none',
		leftCapability: 'target_temperature.inside',
		leftClickDevice: 'missing-ac',
		leftClickCapability: 'target_temperature.inside',
		leftLongDevice: 'missing-ac',
		leftLongCapability: 'target_temperature.inside',
		leftOnSVG: '<svg>on</svg>',
		leftOffSVG: '<svg>off</svg>',
		leftBrokerId: 'Default',
	};
	panel.buttonId = 'test-panel';
	panel.buttonValues = new Map();
	panel.advancedDisplayFeedbackTimers = new Map();
	panel.resolveAdvancedSideConfig = () => sideConfig;
	panel.getConfigPageSide = () => ({ deviceID: 'none', capabilityName: 'target_temperature.inside' });
	panel.getButtonStateKey = (connector, side, page) => `${connector}_${side}_${page}`;
	panel.getPendingAdvancedLongDisplayOverride = () => undefined;
	let liveValueReads = 0;
	panel.resolveAdvancedDisplayValue = async (_binding, overrideValue) =>
	{
		liveValueReads++;
		return {
			textValue: _binding.capabilityName === 'measure_temperature'
				? '19 °C'
				: `${overrideValue === undefined ? '1234.5' : overrideValue} °C +`,
			svgValue: null,
		};
	};
	panel.homey = {
		app: {
			updateLog() {},
			publishMQTTMessage: (brokerId, topic, value) =>
			{
				published.push({ brokerId, topic, value });
				return Promise.resolve();
			},
		},
		setTimeout: (callback, delay) =>
		{
			const timerId = nextTimerId++;
			scheduledTimers.set(timerId, { callback, delay });
			return timerId;
		},
		clearTimeout: timerId => scheduledTimers.delete(timerId),
	};
	panel.error = error => { throw error; };

	const parameters = { connector: 0, side: 'left', page: 3, configNo: 1 };
	const actionDisplay = panel.resolveAdvancedDisplayBinding(parameters);
	assert.strictEqual(actionDisplay.source, 'action', 'Action mappings are not treated as a configured idle display source');
	const startupActionValue = await panel.resolveAdvancedDisplayInitialValue(actionDisplay, parameters);
	assert.strictEqual(startupActionValue.svgValue, '<svg>off</svg>', 'Startup initializes action-only displays with the configured off SVG');
	assert.strictEqual(liveValueReads, 0, 'Simulation values do not seed action-only displays at startup');
	await panel.applyAdvancedDisplayBinding(parameters);
	assert.strictEqual(published[published.length - 2].value, '<svg>off</svg>', 'Action fallback renders the off SVG at rest');
	assert.strictEqual(published[published.length - 1].value, '', 'Idle SVG rendering clears stale text');

	const actionBinding = { deviceID: 'missing-ac', capabilityName: 'target_temperature.inside' };
	const showInitialDisplayValue = panel.showInitialAdvancedDisplayValue.bind(panel);
	assert.strictEqual(await panel.showInitialAdvancedDisplayValue(parameters, actionBinding), true, 'First event previews the current value');
	assert.strictEqual(published[published.length - 1].value, '1234.5 °C +', 'First event displays the existing simulated value');
	assert.strictEqual(await panel.showInitialAdvancedDisplayValue(parameters, actionBinding), false, 'Later events do not get swallowed while feedback is active');
	const eventBinding = { ...actionBinding, numericAction: 'change', valueStep: '+1', rawValueStep: '+1' };
	let actionReads = 0;
	let deviceLookupAttempted = false;
	let directionPrepared = false;
	panel.resolveAdvancedEventBinding = () => eventBinding;
	panel.homey.app.updateLog = () => {};
	panel.prepareAdvancedDirectionForEvent = () => { directionPrepared = true; };
	panel.showInitialAdvancedDisplayValue = async () =>
	{
		assert.strictEqual(directionPrepared, true, 'Direction is initialized before the first-value preview');
		actionReads++;
		return actionReads === 1;
	};
	panel.homey.app.getHomeyDeviceById = async () => { deviceLookupAttempted = true; return null; };
	assert.strictEqual(await panel.runAdvancedEventMapping(parameters, 'click'), true);
	assert.strictEqual(deviceLookupAttempted, false, 'First event returns before looking up the target device');
	assert.strictEqual(await panel.runAdvancedEventMapping(parameters, 'click'), true);
	assert.strictEqual(deviceLookupAttempted, true, 'Subsequent events proceed to the mapped action');
	let simulatedDirection = '+';
	let directionFeedback = false;
	panel.resolveAdvancedEventBinding = () => ({ directionOnly: true });
	panel.toggleAdvancedDirection = () => { simulatedDirection = simulatedDirection === '+' ? '-' : '+'; };
	const applyEventDisplayFeedback = panel.applyAdvancedEventDisplayFeedback.bind(panel);
	const applyIdleDisplay = panel.applyAdvancedDisplayBinding.bind(panel);
	panel.applyAdvancedEventDisplayFeedback = async () => { directionFeedback = true; };
	panel.applyAdvancedDisplayBinding = async () => {};
	panel.applyAdvancedLedBinding = async () => {};
	assert.strictEqual(await panel.runAdvancedEventMapping(parameters, 'double'), true);
	assert.strictEqual(simulatedDirection, '-', 'Double-click Toggle direction changes the simulated sign');
	assert.strictEqual(directionFeedback, true, 'The new simulated direction is shown immediately');
	panel.applyAdvancedEventDisplayFeedback = applyEventDisplayFeedback;
	panel.applyAdvancedDisplayBinding = applyIdleDisplay;
	panel.showInitialAdvancedDisplayValue = showInitialDisplayValue;

	assert.strictEqual(await panel.applyAdvancedEventDisplayFeedback(parameters, actionBinding, 22), true);
	assert.strictEqual(published[published.length - 1].value, '22 °C +', 'An action temporarily displays its capability value');
	const firstTimerId = panel.advancedDisplayFeedbackTimers.get('0_left_3');
	const firstFeedbackTimer = scheduledTimers.get(firstTimerId);
	assert.strictEqual(firstFeedbackTimer.delay, 3000, 'Temporary value stays visible for three seconds');
	assert.strictEqual(await panel.applyAdvancedEventDisplayFeedback(parameters, actionBinding, 23), true);
	assert.strictEqual(scheduledTimers.has(firstTimerId), false, 'A later event resets the previous feedback timer');
	assert.strictEqual(published[published.length - 1].value, '23 °C +');
	const feedbackTimer = scheduledTimers.get(panel.advancedDisplayFeedbackTimers.get('0_left_3'));
	assert.strictEqual(feedbackTimer.delay, 3000, 'Temporary value stays visible for three seconds');
	feedbackTimer.callback();
	assert.strictEqual(published[published.length - 2].value, '<svg>off</svg>', 'The idle SVG is restored when feedback expires');

	sideConfig.leftDisplayDevice = 'missing-ac';
	sideConfig.leftDisplayCapability = 'measure_temperature';
	const currentTemperatureDisplay = panel.resolveAdvancedDisplayBinding(parameters);
	assert.strictEqual(currentTemperatureDisplay.source, 'configured', 'The explicit current-temperature source remains configured');
	const initialCurrentTemperature = await panel.resolveAdvancedDisplayInitialValue(currentTemperatureDisplay, parameters);
	assert.strictEqual(initialCurrentTemperature.textValue, '19 °C', 'The selected display capability is shown at rest');
	assert.strictEqual(await panel.showInitialAdvancedDisplayValue(parameters, actionBinding), true, 'A different target capability previews before its first action');
	assert.strictEqual(published[published.length - 1].value, '1234.5 °C +', 'The target value is shown with its direction indicator');
	const differentSourceTimer = panel.advancedDisplayFeedbackTimers.get('0_left_3');
	assert(differentSourceTimer, 'A different-capability preview starts the feedback timer');
	assert.strictEqual(await panel.showInitialAdvancedDisplayValue(parameters, actionBinding), false, 'Later target events proceed while the preview is visible');
	let restoreDisplayCalls = 0;
	const originalApplyDisplay = panel.applyAdvancedDisplayBinding.bind(panel);
	panel.applyAdvancedDisplayBinding = (...args) =>
	{
		restoreDisplayCalls++;
		return originalApplyDisplay(...args);
	};
	scheduledTimers.get(differentSourceTimer).callback();
	await new Promise(resolve => setImmediate(resolve));
	assert.strictEqual(restoreDisplayCalls, 1, 'The timeout invokes the base display renderer');
	assert.strictEqual(panel.advancedDisplayFeedbackTimers.has('0_left_3'), false, 'The feedback timer is removed before restoring the base display');
	assert.strictEqual(liveValueReads > 0, true, 'Restoration resolves the configured capability value');
	assert.strictEqual(published[published.length - 1].value, '19 °C', `The explicit display capability returns after the preview timeout: ${JSON.stringify(published.slice(-6))}`);
	panel.applyAdvancedDisplayBinding = originalApplyDisplay;

	sideConfig.leftDisplayCapability = 'target_temperature.inside';
	assert.strictEqual(await panel.showInitialAdvancedDisplayValue(parameters, actionBinding), false, 'Matching display and event capabilities need no preview gate');
	assert.strictEqual(await panel.applyAdvancedEventDisplayFeedback(parameters, actionBinding, 23), false, 'Matching explicit display mappings retain normal live-value feedback');
	await panel.applyAdvancedDisplayBinding(parameters);
	assert.strictEqual(published[published.length - 1].value, '1234.5 °C +', 'Explicit display mappings keep their live capability value');
}

function checkDeviceChangeClearsStaleCapability()
{
	const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'settings', 'settings.js'), 'utf8');
	const functionStart = settingsSource.indexOf('\nfunction buttonDeviceChanged(');
	const functionEnd = settingsSource.indexOf('\nfunction buttonCapabilityChanged(', functionStart);
	assert(functionStart >= 0 && functionEnd > functionStart);
	const calls = [];
	const config = {
		leftDevice: 'light-device',
		leftCapability: 'dim',
		leftCapabilityName: 'Brightness (dim)',
	};
	const deviceElement = { value: '_variable_', selectedIndex: 0, options: [{ text: 'Variables' }] };
	const handler = vm.runInNewContext(`(${settingsSource.slice(functionStart, functionEnd)})`, {
		localButtonConfigurations: [[config]],
		currentButtonConfigurationNo: 0,
		document: { getElementById: id => (id === 'left0Device' ? deviceElement : null) },
		stripMissingNameSuffix: value => value,
		updateButtonDeviceIndicator: () => {},
		getCapabilities: (...args) => calls.push(args),
	});
	handler('left', 0);
	assert.strictEqual(calls[0][3], 'dim', 'The old capability is checked against the new source');
	assert.strictEqual(calls[0][5], true, 'A device change enables strict capability validation');

	config.leftDevice = '_variable_';
	config.leftCapability = 'existing-variable-id';
	config.leftCapabilityName = 'Existing variable';
	calls.length = 0;
	handler('left', 0);
	assert.strictEqual(calls[0][3], 'existing-variable-id', 'Refreshing the same source preserves its capability selection');
	assert.strictEqual(calls[0][5], false, 'Refreshing the same source does not enable strict validation');

	const variablesStart = settingsSource.indexOf('\nfunction fillButtonVariablesElement(');
	const variablesEnd = settingsSource.indexOf('\nfunction getCapabilities(', variablesStart);
	assert(variablesStart >= 0 && variablesEnd > variablesStart);
	const fillVariables = vm.runInNewContext(`(${settingsSource.slice(variablesStart, variablesEnd)})`, {
		document: { createElement: () => ({}) },
		variablesArray: [{ id: 'existing-variable-id', name: 'Room temperature', type: 'number' }],
		localButtonConfigurations: [[config]],
		currentButtonConfigurationNo: 0,
		capabilityChanged: () => {},
		updateButtonCapabilityIndicator: () => {},
		stripMissingNameSuffix: value => value,
	});
	const createSelector = () =>
	{
		const selector = {
			options: [],
			add(option) { this.options.push(option); },
			get selectedIndex() { return this.options.findIndex(option => option.value === this.value); },
			get selectedOptions() { return this.options.filter(option => option.value === this.value); },
		};
		Object.defineProperty(selector, 'value', {
			get() { return this.selectedValue || ''; },
			set(value) { this.selectedValue = this.options.some(option => option.value === value) ? value : ''; },
		});
		return selector;
	};
	const missingSelector = createSelector();
	fillVariables('left', 0, missingSelector, 'dim', 'Display brightness (dim)', false);
	assert.strictEqual(missingSelector.value, '', 'A missing old capability remains unselected after changing source');
	assert.strictEqual(missingSelector.options.some(option => /\(Missing\)$/.test(option.text)), false, 'A changed source does not get a stale Missing option');
	assert.strictEqual(config.leftCapability, '', 'A missing capability is cleared from saved config');
	assert.strictEqual(config.leftCapabilityName, '', 'A missing capability name is cleared too');

	const matchingSelector = createSelector();
	fillVariables('left', 0, matchingSelector, 'existing-variable-id', 'Room temperature', false);
	assert.strictEqual(matchingSelector.value, 'existing-variable-id', 'A capability that exists in the new source is retained');
	assert.strictEqual(config.leftCapability, 'existing-variable-id');
	assert.strictEqual(config.leftCapabilityName, 'Room temperature (number)');
}

function checkPopupCancelRestoresSnapshots()
{
	const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'settings', 'settings.js'), 'utf8');
	const snapshotStart = settingsSource.indexOf('\nfunction restoreObjectSnapshot(');
	const snapshotEnd = settingsSource.indexOf('\nfunction getSafeDefaultBrokerValue(', snapshotStart);
	const buttonCloseStart = settingsSource.indexOf('\nfunction closeButtonFieldPopup(');
	const buttonCloseEnd = settingsSource.indexOf('\nfunction syncButtonFieldPopupCapabilityOptions(', buttonCloseStart);
	const displayCloseStart = settingsSource.indexOf('\nfunction closeDisplayFieldPopup(');
	const displayCloseEnd = settingsSource.indexOf('\nfunction syncDisplayFieldPopupCapabilityOptions(', displayCloseStart);
	assert(snapshotStart >= 0 && snapshotEnd > snapshotStart);
	assert(buttonCloseStart >= 0 && buttonCloseEnd > buttonCloseStart);
	assert(displayCloseStart >= 0 && displayCloseEnd > displayCloseStart);
	const snapshotHelper = settingsSource.slice(snapshotStart, snapshotEnd).trim();

	const buttonConfig = [[{ value: 'edited' }]];
	let buttonDraftFlushes = 0;
	const buttonGlobals = {
		buttonFieldPopupOverlayElement: { classList: { remove() {} }, setAttribute() {} },
		buttonFieldPopupBodyElement: { innerHTML: '' },
		buttonFieldPopupBindings: [],
		buttonFieldPopupContext: { configNo: 0, page: 0, originalPageConfig: { value: 'original' }, committed: false, dirtyBeforeOpen: false },
		localButtonConfigurations: buttonConfig,
		currentButtonConfigurationNo: 0,
		restoreObjectSnapshot: vm.runInNewContext(`(${snapshotHelper})`),
		restoreButtonFieldPopupCustomMQTTSection() {},
		writeButtonsections() {},
		getDisplayedButtonPageCount: () => 1,
		updateButtonPanelControls() {},
		configDraftDirtySinceLoad: false,
		flushConfigurationDraftPersist() { buttonDraftFlushes += 1; },
	};
	const closeButton = vm.runInNewContext(`(${settingsSource.slice(buttonCloseStart, buttonCloseEnd).trim()})`, buttonGlobals);
	closeButton();
	assert.strictEqual(buttonConfig[0][0].value, 'original', 'Button popup cancellation restores its snapshot');
	assert.strictEqual(buttonGlobals.configDraftDirtySinceLoad, false, 'Canceling an unchanged button popup keeps the draft clean');
	assert.strictEqual(buttonDraftFlushes, 1, 'Button popup rollback clears any pending draft timer');

	const displayConfig = [{ items: [{ value: 'edited' }] }];
	let displayRedraws = 0;
	let displayDraftFlushes = 0;
	const displayGlobals = {
		displayFieldPopupOverlayElement: {
			contains: () => false,
			classList: { remove() {} },
			setAttribute() {},
		},
		document: { activeElement: null },
		displayFieldPopupBindings: [],
		displayFieldPopupContext: { configNo: 0, itemNo: 0, originalItem: { value: 'original' }, committed: false, dirtyBeforeOpen: false },
		localDisplayConfigurations: displayConfig,
		currentDisplayConfigurationNo: 0,
		restoreObjectSnapshot: vm.runInNewContext(`(${snapshotHelper})`),
		restoreDisplayFieldPopupCustomMQTTSection() {},
		displayFieldPopupBodyElement: { innerHTML: '' },
		displayPagePopupOverlayElement: { classList: { contains: () => false } },
		drawDisplayConfiguration() { displayRedraws += 1; },
		refreshDisplayPopupLiveValues() {},
		configDraftDirtySinceLoad: false,
		flushConfigurationDraftPersist() { displayDraftFlushes += 1; },
		focusDisplaySimulatorSurfaceForSelection() {},
	};
	const closeDisplay = vm.runInNewContext(`(${settingsSource.slice(displayCloseStart, displayCloseEnd).trim()})`, displayGlobals);
	closeDisplay();
	assert.strictEqual(displayConfig[0].items[0].value, 'original', 'Display popup cancellation restores its snapshot');
	assert.strictEqual(displayRedraws, 1, 'Display popup rollback redraws the editor');
	assert.strictEqual(displayGlobals.configDraftDirtySinceLoad, false, 'Canceling an unchanged display popup keeps the draft clean');
	assert.strictEqual(displayDraftFlushes, 1, 'Display popup rollback clears any pending draft timer');
}

function checkPopupSavesCommit()
{
	const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'settings', 'settings.js'), 'utf8');
	const buttonSaveStart = settingsSource.indexOf('\nfunction saveButtonFieldPopup(');
	const buttonSaveEnd = settingsSource.indexOf('\nfunction openButtonFieldPopup(', buttonSaveStart);
	const displaySaveStart = settingsSource.indexOf('\nfunction saveDisplayFieldPopup(');
	const displaySaveEnd = settingsSource.indexOf('\nfunction openDisplayFieldPopup(', displaySaveStart);
	assert(buttonSaveStart >= 0 && buttonSaveEnd > buttonSaveStart);
	assert(displaySaveStart >= 0 && displaySaveEnd > displaySaveStart);

	const buttonContext = { page: 0, side: 'left', configNo: 0, originalPageConfig: { value: 'original' }, committed: false };
	let buttonCommittedOnClose = false;
	const saveButton = vm.runInNewContext(`(${settingsSource.slice(buttonSaveStart, buttonSaveEnd).trim()})`, {
		saveAdvancedButtonPopup: () => true,
		buttonFieldPopupContext: buttonContext,
		closeButtonFieldPopup() { buttonCommittedOnClose = buttonContext.committed; },
	});
	saveButton();
	assert.strictEqual(buttonCommittedOnClose, true, 'Button popup Save commits before closing');

	const displayContext = { itemNo: 0, configNo: 0, originalItem: { value: 'original' }, committed: false };
	let displayCommittedOnClose = false;
	const saveDisplay = vm.runInNewContext(`(${settingsSource.slice(displaySaveStart, displaySaveEnd).trim()})`, {
		displayFieldPopupBindings: [null],
		displayFieldPopupContext: displayContext,
		localDisplayConfigurations: [{ items: [{ customMQTTTopics: [] }] }],
		currentDisplayConfigurationNo: 0,
		storeDisplayCustomMQTTItems() {},
		renderDisplayInlineSimulator() {},
		displayPagePopupOverlayElement: { classList: { contains: () => false } },
		refreshDisplayPopupLiveValues() {},
		configDraftDirtySinceLoad: false,
		flushConfigurationDraftPersist() {},
		closeDisplayFieldPopup() { displayCommittedOnClose = displayContext.committed; },
	});
	saveDisplay();
	assert.strictEqual(displayCommittedOnClose, true, 'Display popup Save commits before closing');
}

function checkPopupTooltipsStayReachable()
{
	const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'settings', 'settings.js'), 'utf8');
	const functionStart = settingsSource.indexOf('\nfunction position_tooltip()');
	const functionEnd = settingsSource.indexOf('\nfunction suppressNativeTooltipTitles(', functionStart);
	assert(functionStart >= 0 && functionEnd > functionStart);
	const tooltip = {
		style: {},
		getBoundingClientRect: () => ({ width: 270, height: 80 }),
	};
	const trigger = {
		querySelector: () => tooltip,
		closest: () => ({}),
		getBoundingClientRect: () => ({ left: 280, right: 294, top: 300, bottom: 314 }),
	};
	const positionTooltip = vm.runInNewContext(`(${settingsSource.slice(functionStart, functionEnd).trim()})`, {
		document: { documentElement: { clientWidth: 360 } },
		window: { innerHeight: 400 },
	});
	positionTooltip.call(trigger);
	assert.strictEqual(tooltip.style.position, 'fixed', 'Popup tooltips are removed from the scrollable layout');
	assert.strictEqual(tooltip.style.left, '74px', 'Popup tooltips are clamped within the viewport width');
	assert.strictEqual(tooltip.style.top, '204px', 'Popup tooltips flip above the trigger when there is not enough room below');
}

function checkAdvancedMappingHelpTooltips()
{
	const localeDirectory = path.join(__dirname, '..', 'locales');
	const localeFiles = fs.readdirSync(localeDirectory).filter(fileName => fileName.endsWith('.json'));
	for (const fileName of localeFiles)
	{
		const locale = JSON.parse(fs.readFileSync(path.join(localeDirectory, fileName), 'utf8'));
		assert(locale.settings.advancedMappingTargetHelp, `${fileName} includes advanced target help`);
		assert(locale.settings.advancedMappingPreviewHelp, `${fileName} includes advanced preview help`);
		assert(locale.settings.buttonPageFallbackBlank, `${fileName} includes the blank-page fallback label`);
		assert(locale.settings.pageHelp, `${fileName} includes the page-help label`);
		assert(locale.settings.buttonHelpSetupType, `${fileName} includes the setup-type label`);
		assert(locale.settings.buttonHelpThermostatCurrentTarget, `${fileName} includes the current/setpoint thermostat option`);
		assert(locale.settings.buttonHelpReadOnlySensor, `${fileName} includes the read-only sensor option`);
		assert(locale.settings.sentLogPageHelp, `${fileName} includes sent-log page help`);
		for (const setupType of [
			'FlowOnly', 'OnOff', 'Dimmable', 'Thermostat', 'ThermostatDisplay', 'WindowCoverings',
			'Colour', 'Fan', 'Lock', 'LockButtons', 'ReadOnly', 'CustomMQTT',
		])
		{
			assert(locale.settings[`buttonHelpSetup${setupType}`], `${fileName} includes ${setupType} setup guidance`);
		}
		for (const instruction of ['HowToTitle', 'ClickTitle', 'ClickValue', 'ClearButton', 'Wizard'])
		{
			assert(locale.settings[`buttonHelp${instruction}`], `${fileName} includes ${instruction} instructions`);
		}
	}
	const englishLocale = JSON.parse(fs.readFileSync(path.join(localeDirectory, 'en.json'), 'utf8'));
	assert.strictEqual(englishLocale.settings.buttonHelpSetupType, 'Select a setup type to show an example', 'Button help prompts users to select an example');
	assert(englishLocale.settings.pageHelpIntroMessage.includes('book button'), 'English locale explains the new Page Help feature');
	assert(englishLocale.settings.buttonHelpLED, 'English help explains the LED settings');
	assert(englishLocale.settings.buttonHelpToggleModeStd, 'English help separates the STD description');
	assert(englishLocale.settings.buttonHelpToggleModeAdv, 'English help separates the ADV description');
	assert(englishLocale.settings.buttonHelpAdvancedButton, 'English help explains the Advanced mappings button');
	assert(englishLocale.settings.buttonHelpPageFallback, 'English help explains the Page 0 and Blank pills');
	assert(englishLocale.settings.displayHelpHowToTitle, 'English help includes a display item walkthrough');
	assert(englishLocale.settings.displayHelpMoveResizeItem.includes('four-arrow handle'), 'Display help explains how to move and resize items');
	assert(englishLocale.settings.displayHelpDeleteItem.includes('fi-rr-trash'), 'Display help uses the delete icon');
	assert(englishLocale.settings.buttonHelpSaveAssign.includes('Save All Configurations'), 'Button help explains saving and assigning configurations');
	assert(englishLocale.settings.displayHelpSaveAssign.includes('Save All Configurations'), 'Display help explains saving and assigning configurations');
	assert(englishLocale.settings.settingsHelpSimulation.includes('hold Shift'), 'Settings help explains how to reveal simulation controls');
	assert(englishLocale.settings.diagnosticHelpListeners.includes('capability listeners'), 'Diagnostics help explains Get Listeners');
	assert(englishLocale.settings.sentLogHelpGet.includes('most recent configuration'), 'Sent-log help explains Get Log');
	assert(englishLocale.settings.importExportHelpImport.includes('Save All Configurations'), 'Import help explains saving imported configurations');
	assert(englishLocale.settings.brokerHelpHowToTitle, 'English help includes a Broker setup walkthrough');
	assert(englishLocale.settings.brokerExplanation.includes('MQTT server'), 'English help explains what a Broker is used for');
	assert(englishLocale.settings.brokerHelpDelete.includes('fi-rr-trash'), 'Broker help uses the delete icon');
	assert(englishLocale.settings.groupHelpHowToTitle, 'English help includes a group setup walkthrough');
	assert(englishLocale.settings.groupHelpActions.includes('fi-rr-copy'), 'Group help uses the duplicate-group icon');
	assert(englishLocale.settings.groupHelpDisplayModule.includes('group-sim-config-number') && englishLocale.settings.groupHelpButtonBars.includes('group-sim-config-number'), 'Group help shows numbered module badges');
	assert(englishLocale.settings.groupHelpDisplayModule.includes('fi-rr-edit') && englishLocale.settings.groupHelpDisplayModule.includes('fi-rr-trash'), 'Display module help uses its edit and remove icons');
	assert(englishLocale.settings.groupHelpButtonBars.includes('fi-rr-edit') && englishLocale.settings.groupHelpButtonBars.includes('fi-rr-trash') && englishLocale.settings.groupHelpButtonBars.includes('&uarr;'), 'Button bar help uses its edit, remove, and move controls');
	assert(englishLocale.settings.groupHelpButtonBars.includes('toggle its preview state'), 'Group help explains simulated button toggling');
	assert(englishLocale.settings.groupHelpPreview.includes('hide the group setup controls'), 'Group help explains the Preview / Configure layout toggle');
	assert(englishLocale.settings.groupHelpPages.includes('&lt;') && englishLocale.settings.groupHelpPages.includes('&gt;'), 'Group help shows the page navigation buttons');
	assert(englishLocale.settings.groupHelpAddButtonBars.includes('up to 8 button bars'), 'Group help explains the button bar limit');
	assert(englishLocale.settings.brokerHelpFields.includes('routes messages to the correct broker'), 'Broker help explains the purpose of a unique Broker ID');
	assert(
		englishLocale.settings.buttonHelpGlobalSettings.includes('Simulate:')
			&& englishLocale.settings.buttonHelpGlobalSettings.includes('Top Extra Settings:')
			&& englishLocale.settings.buttonHelpGlobalSettings.includes('fi-rr-plus')
			&& englishLocale.settings.buttonHelpGlobalSettings.includes('fi-rr-trash'),
		'English help explains global controls and uses page action icons',
	);

	const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'settings', 'settings.js'), 'utf8');
	const settingsHtml = fs.readFileSync(path.join(__dirname, '..', 'settings', 'index.html'), 'utf8');
	const stylesSource = fs.readFileSync(path.join(__dirname, '..', 'settings', 'extraStyles.css'), 'utf8');
	assert(settingsHtml.includes('id="pageHelpClose"') && settingsHtml.includes('aria-label="Close help">&times;</button>'), 'Buttons help closes from a header cross');
	assert(settingsHtml.includes('id="pageHelpIntroOverlay"') && settingsHtml.includes('id="pageHelpIntroClose"'), 'First-run Page Help intro includes an overlay and close button');
	assert(!settingsHtml.includes('id="pageHelpClose" type="button" data-i18n="settings.cancel"'), 'Buttons help has no Cancel footer button');
	const fixedHeader = settingsHtml.slice(settingsHtml.indexOf('<div class="fixedTop">'), settingsHtml.indexOf('<div class="main">'));
	assert(!fixedHeader.includes('<hr class="hr-separator" />'), 'Shared help header has no divider below the help button');
	assert(settingsSource.includes('pageHelpBodyElement.scrollTop = 0'), 'Buttons help opens at the top of its content');
	assert(settingsSource.includes('Homey.get(PAGE_HELP_INTRO_ACKNOWLEDGED_KEY'), 'First-run Page Help intro checks whether it was acknowledged');
	assert(settingsSource.includes('Homey.set(PAGE_HELP_INTRO_ACKNOWLEDGED_KEY, true)'), 'Closing the first-run Page Help intro records acknowledgement');
	assert(settingsSource.includes("pageHelpOverlayElement.classList.contains('visible')"), 'Buttons help refreshes when the active view changes');
	assert(stylesSource.includes('#pageHelpOverlay {') && stylesSource.includes('top: var(--settings-fixed-top-offset, 64px);'), 'Help leaves the fixed view tabs accessible');
	assert(stylesSource.includes('.page-help-intro-bubble::before'), 'First-run Page Help intro has a speech-bubble pointer');
	assert.strictEqual((settingsSource.match(/settings\.advancedMappingTargetHelp/g) || []).length, 6, 'Each event has device and capability help');
	assert.strictEqual((settingsSource.match(/settings\.advancedMappingPreviewHelp/g) || []).length, 3, 'Each numeric step has preview help');
	assert(settingsSource.includes('class="tooltip" tabindex="0"'), 'Advanced mapping help icons can receive keyboard focus');
	assert(settingsSource.includes("value: 'thermostatCurrentTarget'"), 'Button help includes the current/setpoint thermostat pattern');
	assert(settingsSource.includes("value: 'readOnly'"), 'Button help includes read-only sensor setups');
	assert(settingsSource.includes("stepKeys: ['settingsHelpWebView', 'settingsHelpSimulation']"), 'Settings help does not mention a missing Save button');
	const helpMapStart = settingsSource.indexOf('const viewHelp = {');
	const helpMapEnd = settingsSource.indexOf('\n\t};', helpMapStart);
	const buttonHelpView = settingsSource.slice(helpMapStart, helpMapEnd);
	assert(buttonHelpView.includes("panelConfig: { title: 'buttonConfigs', keys: ['buttonExplanation', 'buttonHelpGlobalSettings'] }"), 'Buttons help shows global controls before setup instructions');
	assert(buttonHelpView.includes("settings: { title: 'Settings', keys: [] }"), 'Settings help avoids repeating its overview above the numbered guide');
	assert(buttonHelpView.includes("importExport: { title: 'importExport', keys: [] }"), 'Import/Export help avoids repeating its overview above the numbered guide');
	assert(!buttonHelpView.includes('advancedMappingTargetHelp') && !buttonHelpView.includes('advancedMappingPreviewHelp'), 'Buttons help does not repeat Advanced mappings popup guidance');
	assert(settingsSource.includes("else if (view === 'displayConfig')"), 'Display help includes its own ordered walkthrough');
	assert(settingsSource.includes("'displayHelpSaveAssign'"), 'Display save and assign is the final help topic');
	assert(settingsSource.includes("else if (view === 'groupConfig')"), 'Group help includes its own ordered walkthrough');
	assert(settingsSource.includes("else if (['settings', 'diagnosticLog', 'lastSentLog', 'importExport'].includes(view))"), 'Remaining help views render ordered control walkthroughs');
	assert(settingsSource.includes("else if (view === 'brokerConfig')"), 'Broker help includes its own ordered walkthrough');
	const groupHelpStart = settingsSource.indexOf('const groupHelpStepKeys = [');
	const groupHelpEnd = settingsSource.indexOf('\n\t\t];', groupHelpStart);
	const groupHelpOrder = settingsSource.slice(groupHelpStart, groupHelpEnd);
	assert(groupHelpOrder.indexOf('groupHelpManage') < groupHelpOrder.indexOf('groupHelpActions'), 'Group actions have their own item after group selection');
	assert(groupHelpOrder.indexOf('groupHelpPreview') < groupHelpOrder.indexOf('groupHelpPages'), 'Group layout and page navigation have separate ordered items');
	assert(groupHelpOrder.indexOf('groupHelpPreview') < groupHelpOrder.indexOf('groupHelpDisplayModule'), 'Group help follows the page order');
}

async function checkCapabilityScaling()
{
	assert.strictEqual(getHomeyScale('lamp', 'dim', 100), null);
	assert.strictEqual(getHomeyScale('blinds', 'windowcoverings_set', 100), null);
	assert.strictEqual(getHomeyScale('customMQTT', 'value', 100), null);
	assert.strictEqual(getHomeyScale('_variable_', 'value', 100), 100);
	assert.strictEqual(getHomeyScale('_variable_', 'dim', 100), 100, 'Variable IDs do not use capability-specific conversions');
	assert.strictEqual(getDisplayTopic('panel', 'meter', 'measure_power', 0, 0.001), 'buttonplus/panel/displayitem/0/scaled');
	assert.strictEqual(getDisplayTopic('panel', 'meter', 'measure_power', 1, ''), 'buttonplus/meter/measure_power');
	assert.notStrictEqual(getDisplayTopic('panel', 'meter', 'measure_power', 0, 0.001), getDisplayTopic('panel', 'meter', 'measure_power', 1, 1));

	const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'settings', 'settings.js'), 'utf8');
	const uiStart = settingsSource.indexOf('\nfunction canScaleHomeyCapability(');
	const uiEnd = settingsSource.indexOf('\nfunction buildCapabilityScaleRow(', uiStart);
	const ui = vm.runInNewContext(`${settingsSource.slice(uiStart, uiEnd)}; ({ canScaleHomeyCapability, normalizeCapabilityScale })`);
	assert.strictEqual(ui.canScaleHomeyCapability('meter', 'measure_power', 'number'), true);
	assert.strictEqual(ui.canScaleHomeyCapability('_variable_', 'value', 'number'), true);
	for (const [deviceId, capabilityId, type] of [['lamp', 'dim', 'number'], ['blind', 'windowcoverings_set', 'number'], ['customMQTT', 'power', 'number'], ['lamp', 'onoff', 'boolean'], ['_variable_', 'flag', 'boolean'], ['_variable_', 'text', 'string']])
	{
		assert.strictEqual(ui.canScaleHomeyCapability(deviceId, capabilityId, type), false);
	}
	assert.strictEqual(ui.normalizeCapabilityScale('0.001'), '0.001');
	assert.strictEqual(ui.normalizeCapabilityScale('0'), '');
	assert.strictEqual(ui.normalizeCapabilityScale('bad'), '');
	const fillStart = settingsSource.indexOf('\nfunction fillDisplayCapabilitiesElement(');
	const fillEnd = settingsSource.indexOf('\nfunction selectDisplayCapability(', fillStart);
	const unitElement = { value: '' };
	const fillCapabilities = vm.runInNewContext(`${settingsSource.slice(fillStart, fillEnd)}; fillDisplayCapabilitiesElement`, {
		document: { createElement: () => ({ dataset: {} }), getElementById: id => (id.endsWith('Unit') ? unitElement : { style: {} }) },
		getCapabilityIconUrl: () => '',
		itemDisplyType: '',
		localDisplayConfigurations: [{ items: [{ capability: 'measure_power' }] }],
		displayConfigurationNoElement: { value: 0 },
		updateDisplayItemControlsVisibility: () => {},
	});
	const capabilitySelector = { add: () => {} };
	fillCapabilities(0, capabilitySelector, { measure_power: { id: 'measure_power', type: 'number', units: { en: 'W' } } });
	assert.strictEqual(unitElement.value, '', 'Loading capabilities preserves a blank unit for inheritance');
	unitElement.value = 'kW';
	fillCapabilities(0, capabilitySelector, { measure_power: { id: 'measure_power', type: 'number', units: 'W' } });
	assert.strictEqual(unitElement.value, 'kW', 'Loading capabilities preserves an explicit override');
	const testVariables = [
		{ id: 'value', type: 'number', value: 1500 },
		{ id: 'flag', type: 'boolean', value: true },
		{ id: 'text', type: 'string', value: '1500' },
	];
	const previewStart = settingsSource.indexOf('\nfunction getButtonPanelVariablePreviewText(');
	const previewEnd = settingsSource.indexOf('\nfunction getButtonPanelCapabilityPreviewText(', previewStart);
	const variablePreview = vm.runInNewContext(`${settingsSource.slice(uiStart, uiEnd)}${settingsSource.slice(previewStart, previewEnd)}; getButtonPanelVariablePreviewText`, {
		variablesArray: testVariables,
		simulationEnabled: false,
	});
	assert.strictEqual(variablePreview('_variable_', 'value', 0.001, 'kW'), '1.5 kW');
	assert.strictEqual(variablePreview('_variable_', 'value', '', ''), '1500');
	assert.strictEqual(variablePreview('_variable_', 'flag', 100, ''), null);
	assert.strictEqual(variablePreview('_variable_', 'text', 100, 'kW'), '1500');
	const visibilityStart = settingsSource.indexOf('\nfunction updateDisplayFieldPopupCapabilityState(');
	const visibilityEnd = settingsSource.indexOf('\nfunction restoreDisplayFieldPopupCustomMQTTSection(', visibilityStart);
	const updateVisibility = vm.runInNewContext(`${settingsSource.slice(uiStart, uiEnd)}${settingsSource.slice(visibilityStart, visibilityEnd)}; updateDisplayFieldPopupCapabilityState`, {
		variablesArray: testVariables,
		displayCapabilityItems: new Map(),
	});
	const visibilityCases = [
		['meter', 'measure_power', 'number', true],
		['lamp', 'dim', 'number', false],
		['blind', 'windowcoverings_set', 'number', false],
		['customMQTT', 'power', 'number', false],
		['lamp', 'onoff', 'boolean', false],
		['_variable_', 'value', '', true],
		['_variable_', 'flag', '', false],
		['_variable_', 'text', '', false],
	];
	for (const [deviceId, capabilityId, type, visible] of visibilityCases)
	{
		const scaleRow = { style: {} };
		updateVisibility({
			Device: { value: deviceId },
			Capability: { value: capabilityId, selectedOptions: [{ dataset: { type } }], closest: () => ({ style: {}, querySelector: () => null }) },
			ValueScale: { closest: () => scaleRow },
		});
		assert.strictEqual(scaleRow.style.display, visible ? '' : 'none', `Multiplier visibility for ${capabilityId}`);
	}

	const deviceSource = fs.readFileSync(path.join(__dirname, '..', 'drivers', 'panel_hardware', 'device.js'), 'utf8');
	const liveStart = deviceSource.indexOf('\n\tasync checkStateChangeForDisplay(');
	const liveEnd = deviceSource.indexOf('\n\tpublishTextOrSvg(', liveStart);
	const actionStart = deviceSource.indexOf('\n\tasync runAdvancedEventMapping(');
	const actionEnd = deviceSource.indexOf('\n\tqueueClickedTrigger(', actionStart);
	const absoluteStart = deviceSource.indexOf('\n\tgetAdvancedAbsoluteValue(');
	const absoluteEnd = deviceSource.indexOf('\n\t/**', absoluteStart);
	const basicStart = deviceSource.indexOf('\n\tasync resolveCapabilityDisplayText(');
	const formatStart = deviceSource.indexOf('\n\tformatDimPercentageValue(');
	const formatEnd = deviceSource.indexOf('\n\tshouldShowAdvancedDirectionIndicator(', formatStart);
	const advancedStart = deviceSource.indexOf('\n\tasync resolveAdvancedDisplayValue(');
	const advancedEnd = deviceSource.indexOf('\n\tgetAdvancedDisplayIdleValue(', advancedStart);
	const unitStart = deviceSource.indexOf('\n\tformatVariableDisplayValue(');
	const unitEnd = deviceSource.indexOf('\n\tasync getDeviceAndCapability(', unitStart);
	const panelMethods = [
		deviceSource.slice(liveStart, liveEnd),
		deviceSource.slice(actionStart, actionEnd),
		deviceSource.slice(absoluteStart, absoluteEnd),
		deviceSource.slice(basicStart, liveStart),
		deviceSource.slice(formatStart, formatEnd),
		deviceSource.slice(advancedStart, advancedEnd),
		deviceSource.slice(unitStart, unitEnd),
	].join('');
	const panel = vm.runInNewContext(`new (class { ${panelMethods} })()`, {
		scaleValue, getHomeyScale, getDisplayTopic, isSvgTextContent, TARGET_BUTTON_PLUS_DEVICE_ID: '_this_button_plus_',
	});
	const published = [];
	panel.buttonId = 'panel';
	panel.homey = { app: {
		displayConfigurations: [{ items: [
			{ device: 'meter', capability: 'measure_power', valueScale: 0.001 },
			{ device: 'meter', capability: 'measure_power' },
		] }],
		updateLog: () => {},
		getHomeyDeviceById: async () => ({}),
		getHomeyCapabilityByName: async () => ({ type: 'number', value: 0.1, min: 0, max: 1 }),
	} };
	panel.publishTextOrSvg = (_broker, _svg, topic, value) => published.push({ topic, value });
	await panel.checkStateChangeForDisplay(0, 'meter', 'measure_power', 1500);
	assert.strictEqual(published[0].value, 1.5);
	assert.strictEqual(published[0].topic, 'buttonplus/panel/displayitem/0/scaled');
	assert.strictEqual(published[1].value, 1500);
	assert.strictEqual(published[1].topic, 'buttonplus/meter/measure_power');
	const appStart = source.indexOf('\n\tasync applyDisplayConfiguration(');
	const appEnd = source.indexOf('\n\trouteSvgOrTextValue(', appStart);
	let publishInitialValues;
	const app = vm.runInNewContext(`new (class { ${source.slice(appStart, appEnd)} })()`, {
		scaleValue,
		getHomeyScale,
		getDisplayTopic,
		isSvgTextContent,
		checkSEMVerGreaterOrEqual: () => true,
		TARGET_BUTTON_PLUS_DEVICE_ID: '_this_button_plus_',
		setTimeout: callback => { publishInitialValues = callback; },
	});
	app.displayConfigurations = panel.homey.app.displayConfigurations;
	app.getHomeyDeviceById = async () => ({ id: 'meter' });
	app.getHomeyCapabilityByName = async () => ({ type: 'number', value: 1500, units: { en: 'W' } });
	app.registerDeviceCapabilityStateChange = async () => {};
	app.routeSvgOrTextValue = value => ({ textValue: value, svg: '' });
	app.publishMQTTMessage = async (_broker, topic, value) => { published.push({ topic, value }); };
	const section = {};
	await app.applyDisplayConfiguration(section, 0, '2.0.0', panel);
	assert.strictEqual(section.displayitems.length, 2);
	assert.strictEqual(section.displayitems[0].topics[0].topic, published[0].topic);
	assert.strictEqual(section.displayitems[1].topics[0].topic, published[1].topic);
	await publishInitialValues();
	assert.strictEqual(published[2].value, 1.5, 'Initial values use the same scale as live updates');
	assert.strictEqual(published[2].topic, published[0].topic);
	assert.strictEqual(published[4].value, 1500);
	assert.strictEqual(section.displayitems[0].unit, 'W', 'Localized units remain supported');
	app.displayConfigurations[0].items[0].unit = 'kW';
	await app.applyDisplayConfiguration(section, 0, '2.0.0', panel);
	assert.strictEqual(section.displayitems[0].unit, 'kW', 'An explicit unit overrides the localized capability unit');
	assert.strictEqual(section.displayitems[1].unit, 'W', 'A blank unit inherits the capability unit');
	panel.getDeviceAndCapability = async () => ({ capability: { type: 'number', units: { en: 'W' } } });
	assert.strictEqual(await panel.resolveCapabilityDisplayText({ deviceID: 'meter', capabilityName: 'measure_power', valueScale: 0.001, unit: 'kW' }, 1500), '1.5 kW');
	assert.strictEqual(await panel.resolveCapabilityDisplayText({ deviceID: 'meter', capabilityName: 'measure_power' }, 1500), '1500 W', 'Blank units inherit the localized capability unit');
	assert.strictEqual(await panel.resolveCapabilityDisplayText({ deviceID: 'meter', capabilityName: 'measure_power', unit: 'kW' }, 1500), '1500 kW', 'Unit overrides also apply without a multiplier');
	assert.strictEqual(await panel.resolveCapabilityDisplayText({ deviceID: 'meter', capabilityName: 'measure_power' }, 1.2345), '1.2345 W', 'Adding inherited units preserves unscaled precision');
	assert.strictEqual(await panel.resolveCapabilityDisplayText({ deviceID: 'meter', capabilityName: 'measure_power', valueScale: 0.001 }, null), '', 'Unavailable readings remain blank');
	assert.strictEqual(panel.formatSimulatedCapabilityText({ type: 'number', value: 1500 }, { deviceID: 'meter', capabilityName: 'measure_power', valueScale: 0.001, unit: 'kW' }), '1.5 kW');
	panel.shouldShowAdvancedDirectionIndicator = () => false;
	panel.getAdvancedDirection = () => '+';
	assert.strictEqual((await panel.resolveAdvancedDisplayValue({ deviceID: 'meter', capabilityName: 'level', valueScale: 100, unit: '%' }, 0.1, {})).textValue, '10 %');
	assert.strictEqual((await panel.resolveAdvancedDisplayValue({ deviceID: 'lamp', capabilityName: 'dim' }, 0.1, {})).textValue, '10% +');
	const variableValues = new Map(testVariables.map(variable => [variable.id, variable]));
	app.homey = { app };
	app.getVariable = async id => variableValues.get(id);
	panel.homey.app.getVariable = app.getVariable;
	app.getHomeyDeviceById = async () => null;
	app.displayConfigurations[0] = { items: [
		{ device: '_variable_', capability: 'value', valueScale: 0.001, unit: 'kW' },
		{ device: '_variable_', capability: 'value', valueScale: 100 },
		{ device: '_variable_', capability: 'value' },
		{ device: '_variable_', capability: 'flag', valueScale: 100 },
		{ device: '_variable_', capability: 'text', valueScale: 100 },
	] };
	published.length = 0;
	await app.applyDisplayConfiguration(section, 0, '2.0.0', panel);
	await publishInitialValues();
	assert.strictEqual(published[0].value, 1.5, 'Initial variable values are scaled');
	assert.strictEqual(published[2].value, 150000, 'Each item has its own factor');
	assert.strictEqual(published[4].value, 1500, 'Blank factors leave the source value unchanged');
	assert.strictEqual(published[6].value, 'On', 'Boolean formatting is unchanged');
	assert.strictEqual(published[8].value, '1500', 'Text variables are never scaled');
	assert.strictEqual(section.displayitems[0].topics[0].topic, published[0].topic);
	assert.strictEqual(section.displayitems[1].topics[0].topic, published[2].topic);
	assert.notStrictEqual(published[0].topic, published[2].topic);
	assert.strictEqual(published[4].topic, 'buttonplus/_variable_/value');
	assert.strictEqual(section.displayitems[0].unit, 'kW');
	published.length = 0;
	await panel.checkStateChangeForDisplay(0, '_variable_', 'value', 2000);
	assert.strictEqual(published[0].value, 2, 'Live updates use the configured variable factor');
	assert.strictEqual(published[1].value, 200000);
	assert.strictEqual(published[2].value, 2000);
	assert.strictEqual(published[0].topic, section.displayitems[0].topics[0].topic);
	assert.strictEqual(published[1].topic, section.displayitems[1].topics[0].topic);
	assert.strictEqual((await panel.resolveAdvancedDisplayValue({ deviceID: '_variable_', capabilityName: 'value', valueScale: 0.001, unit: 'kW' })).textValue, '1.5 kW');
	assert.strictEqual(panel.formatVariableDisplayValue(1500, 'kW', 0.001), '1.5 kW', 'Basic button variables use the same display conversion');
	assert.strictEqual(testVariables[0].value, 1500, 'Scaling never mutates the source variable');

	const binding = { deviceID: 'meter', capabilityName: 'level', valueScale: 100, rawValueStep: '+10', valueStep: 10, numericAction: 'change' };
	panel.resolveAdvancedEventBinding = () => binding;
	panel.prepareAdvancedDirectionForEvent = () => {};
	panel.showInitialAdvancedDisplayValue = async () => false;
	panel.getPendingAdvancedDebounceValue = () => undefined;
	panel.getQueuedAdvancedLongReleaseValue = () => undefined;
	panel.getNumericActionForValueType = () => 'change';
	panel.isAdvancedStepRelative = value => /^[+-]/.test(value);
	panel.getAdvancedStepDelta = (_parameters, step) => step;
	panel.applyAdvancedDirectionAtBounds = () => {};
	panel.applyAdvancedDisplayPreviewValue = async () => true;
	panel.applyAdvancedEventDisplayFeedback = async () => {};
	panel.applyAdvancedDisplayBinding = async () => {};
	panel.applyAdvancedLedBinding = async () => {};
	panel.isLockButtonCapability = () => false;
	let writtenValue;
	panel.guardedSetCapabilityValueOnDevice = async (_device, _capability, value) => { writtenValue = value; };
	panel.queueAdvancedLongReleaseCommit = (_parameters, _binding, value) => { writtenValue = value; };
	const parameters = { connector: 0, side: 'left', page: 0 };
	await panel.runAdvancedEventMapping(parameters, 'click');
	assert.strictEqual(writtenValue, 0.2, 'A displayed +10 step writes +0.1 in native units');
	binding.rawValueStep = '25';
	await panel.runAdvancedEventMapping(parameters, 'click');
	assert.strictEqual(writtenValue, 0.25, 'Absolute targets are divided before writing');
	binding.rawValueStep = '0';
	await panel.runAdvancedEventMapping(parameters, 'long');
	assert.strictEqual(writtenValue, 0, 'Zero absolute targets are buffered in native units');
	binding.rawValueStep = '+200';
	binding.valueStep = 200;
	await panel.runAdvancedEventMapping(parameters, 'click');
	assert.strictEqual(writtenValue, 1, 'Scaled steps respect native capability bounds');
}

async function checkAdvancedButtonClickResolution()
{
	const deviceSource = fs.readFileSync(path.join(__dirname, '..', 'drivers', 'panel_hardware', 'device.js'), 'utf8').replace(/\r\n/g, '\n');
	const methodNames = [
		'processMQTTMessage', 'triggerAdvancedMappedConfigClicked', 'executeSingleClickAction', 'handleButtonClick', 'processLongPressMessage', 'processReleaseMessage',
		'armClickResolutionTimers', 'isWaitingForClickResolution', 'handleGenericDoubleClick', 'incrementSuppression', 'consumeSuppression', 'clearClickResolutionTimers',
	];
	const methods = methodNames.map(name =>
	{
		const match = new RegExp(`\\n\\t(?:async )?${name}\\(`).exec(deviceSource);
		assert(match, `${name} exists`);
		return deviceSource.slice(match.index, deviceSource.indexOf('\n\t}\n', match.index) + 4);
	}).join('');
	const queueStart = deviceSource.indexOf('\n\tqueueClickedTrigger(');
	const queueEnd = deviceSource.indexOf('\n\tasync getCapabilityDisplayKind(', queueStart);
	for (const side of ['left', 'right'])
	{
		for (const mode of ['advanced-flow-only', 'advanced-click', 'advanced-long', 'advanced-double', 'advanced-double-fast', 'advanced-double-same-tick', 'advanced-double-single'])
		{
			for (const hold of [false, true])
			{
				let clock = 1000;
				const panel = vm.runInNewContext(`new (class { ${methods}${deviceSource.slice(queueStart, queueEnd)} })()`, {
					_: { cloneDeep: value => ({ ...value }) },
					checkSEMVerGreaterOrEqual: () => true,
					DOUBLE_CLICK_WINDOW_MS: 350,
					DUPLICATE_CLICK_DEBOUNCE_MS: Number(deviceSource.match(/const DUPLICATE_CLICK_DEBOUNCE_MS = (\d+);/)[1]),
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
				const genericEvents = [];
				const config = { capabilityName: 'onoff', page: 0 };
				const key = `0_${side}_0`;
				for (const map of [
					'buttonValues', 'pendingClickedTriggers', 'pendingReleasedTriggers', 'pendingAdvancedClickActions', 'pendingAdvancedClickFallbackTimers',
					'clickEventTimers', 'clickEventStates', 'longPressOccurred', 'longPressLastProcessedAt', 'longPressHeartbeatAt', 'releaseSuppressions',
					'lastPhysicalClickAt', 'clickedSuppressions', 'longPressEventCounts', 'lastLongPressTimes', 'pendingAdvancedLongReleaseCommits',
				])
				{
					panel[map] = new Map();
				}
				panel.homey = {
					setTimeout: (callback, delay) => { const timer = Symbol('timer'); timers.set(timer, { callback, due: clock + delay }); return timer; },
					clearTimeout: timer => timers.delete(timer),
					app: {
						buttonConfigurations: [[{}]],
						updateLog: () => {},
						triggerConfigButton: (_panel, _side, _type, _config, event) => events.push(event),
						triggerButtonLongPress: () => {},
						triggerButtonRelease: () => {},
						triggerButtonEvent: (_panel, _side, _connector, event) => genericEvents.push(event),
					},
				};
				panel.getButtonStateKey = (connector, buttonSide, page) => `${connector}_${buttonSide}_${page}`;
				panel.initFinished = true;
				panel.buttonId = 'panel';
				panel.getSetting = () => 1;
				panel.getEffectiveConfigNo = () => 0;
				panel.cancelAdvancedLongSyntheticTick = () => {};
				panel.getEventTimingContext = () => ({ simpleMode: false, longPressDefined: mode === 'advanced-long', doubleClickDefined: mode.startsWith('advanced-double') });
				panel.resolveAdvancedEventBinding = () => null;
				panel.runAdvancedEventMapping = async () => mode !== 'advanced-flow-only';
				panel.resolveConnectorConfig = () => config;
				panel.getConfigPageSide = () => config;
				panel.getConfigLedButtonState = async () => true;
				panel.processClickMessage = parameters => panel.triggerAdvancedMappedConfigClicked(parameters);
				panel.processAdvancedButtonStateClick = parameters => panel.triggerAdvancedMappedConfigClicked(parameters);
				panel.isDimButtonConfig = () => false;
				panel.flushAdvancedLongReleaseCommit = async () => {};
				panel.flushAdvancedLongReleaseCommitFamily = async () => {};
				panel.clearLongPressTrackingForRelease = async () => panel.longPressOccurred.delete(key);
				panel.armAdvancedLongSyntheticTick = () => {};
				panel.triggerAdvancedMappedConfigLong = async () => events.push('long');
				panel.error = error => { throw error; };
				const parameters = { event: 'click', connector: 0, side, page: 0, configNo: 0, connectorType: 1, value: true, idx: side === 'left' ? 0 : 1 };
				const click = { id: 'panel', idx: parameters.idx, page: 0, event: 'click' };
				await panel.processMQTTMessage(click);
				assert.deepStrictEqual(events, ['pressed'], `${side}/${mode}: pressed fires immediately, clicked waits for release`);
				assert.deepStrictEqual(genericEvents, ['pressed'], `${side}/${mode}: connector pressed fires immediately`);
				await panel.processMQTTMessage(click);
				assert.deepStrictEqual(events, ['pressed'], `${side}/${mode}: duplicate down messages do not repeat pressed`);
				const tick = async (elapsed = 350) =>
				{
					clock += elapsed;
					for (const [timer, scheduled] of [...timers])
					{
						if (timers.has(timer) && scheduled.due <= clock)
						{
							timers.delete(timer);
							scheduled.callback();
						}
					}
					await new Promise(resolve => setImmediate(resolve));
				};
				const fastDoubleClick = !hold && (mode === 'advanced-double-fast' || mode === 'advanced-double-same-tick');
				await tick(fastDoubleClick ? 20 : 350);
				assert.deepStrictEqual(events, ['pressed'], `${side}/${mode}: timer cannot click while held`);
				if (hold)
				{
					await panel.processLongPressMessage({ ...parameters, event: 'longpress' });
					await panel.triggerAdvancedMappedConfigClicked(parameters);
					await panel.triggerAdvancedMappedConfigClicked({ ...parameters, event: 'deferred_click' });
					assert.deepStrictEqual(events, ['pressed', 'long'], `${side}/${mode}: late click notifications are suppressed during a hold`);
				}
				await panel.processMQTTMessage({ ...click, event: 'release' });
				const doubleClick = mode.startsWith('advanced-double') && mode !== 'advanced-double-single' && !hold;
				if (doubleClick)
				{
					assert.strictEqual(panel.clickEventTimers.has(key), true, `${side}: double-click window starts at release, not initial press`);
					const secondPressDelay = fastDoubleClick ? 20 : 349;
					await tick(mode === 'advanced-double-same-tick' ? 0 : secondPressDelay);
					assert.deepStrictEqual(events, ['pressed'], `${side}: single click stays deferred throughout the release-based window`);
					await panel.processMQTTMessage(click);
					await panel.processMQTTMessage({ ...click, event: 'release' });
				}
				await tick();
				const clickCount = hold || doubleClick ? 0 : 1;
				assert.strictEqual(events.filter(event => event === 'clicked').length, clickCount, `${side}/${mode}: only single short presses click`);
				assert.strictEqual(events.filter(event => event === 'double').length, doubleClick ? 1 : 0, `${side}/${mode}: double click fires once`);
				if (doubleClick)
				{
					assert.deepStrictEqual(events, ['pressed', 'double'], `${side}: double click has one pressed and suppresses clicked and released`);
				}
				assert.strictEqual(events.filter(event => event === 'pressed').length, 1, `${side}/${mode}: one configuration pressed per gesture`);
				assert.strictEqual(genericEvents.filter(event => event === 'pressed').length, 1, `${side}/${mode}: one connector pressed per gesture`);
				assert.strictEqual(events.filter(event => event === 'long').length, hold ? 1 : 0, `${side}/${mode}: holds still trigger long`);
				await panel.handleButtonClick({ ...parameters, event: undefined, fromButton: true });
				assert.strictEqual(events.filter(event => event === 'clicked').length, clickCount + 1, `${side}/${mode}: virtual clicks remain immediate`);
			}
		}
	}
}

async function checkAdvancedLedSources()
{
	const deviceSource = fs.readFileSync(path.join(__dirname, '..', 'drivers', 'panel_hardware', 'device.js'), 'utf8').replace(/\r\n/g, '\n');
	const methods = [
		'resolveAdvancedLedBinding', 'resolveLedBindingValue', 'applyAdvancedLedBinding', 'checkStateChangeForConnector',
		'publishButtonMQTTmessages', 'parseHexColor', 'rgbToInteger', 'interpolateColor', 'queueOrPublishLedColor', 'setLEDOnOff',
	].map(name =>
	{
		const start = deviceSource.search(new RegExp(`\\n\\t(?:async )?${name}\\(`));
		const end = deviceSource.indexOf('\n\t}\n', start) + 4;
		assert(start >= 0 && end > start, `Found ${name}`);
		return deviceSource.slice(start, end);
	}).join('\n');
	const panel = vm.runInNewContext(`new (class { ${methods} })()`, { checkSEMVerGreaterOrEqual: () => true });
	const page = {
		leftMode: 'advanced',
		rightMode: 'advanced',
		leftLedDevice: 'ac',
		leftLedCapability: 'onoff',
		leftFrontLEDOnColor: '#00ff00',
		leftWallLEDOnColor: '#0000ff',
		leftFrontLEDOffColor: '#000000',
		leftWallLEDOffColor: '#000000',
	};
	const capabilities = { onoff: { type: 'boolean', value: false }, target_temperature: { type: 'number', value: 22 } };
	const published = [];
	panel.homey = { app: {
		buttonConfigurations: [[page]],
		getHomeyDeviceById: async id => ({ id }),
		getHomeyCapabilityByName: async (_device, name) => capabilities[name],
		registerDeviceCapabilityStateChange: () => {},
		publishMQTTMessage: async (_broker, topic, value) => { published.push({ topic, value }); },
	} };
	panel.buttonId = 'panel';
	panel.firmwareVersion = '3.0.3';
	panel.getSetting = () => 1;
	panel.getEffectiveConfigNo = () => 0;
	panel.resolveAdvancedSideConfig = () => page;
	panel.resolveAdvancedDisplayBinding = () => null;
	panel.getConfigPageSide = (_config, _page, side) => ({
		raw: page,
		deviceID: 'none',
		topLabel: '',
		brokerId: 'Default',
		frontLEDOnColor: page[`${side}FrontLEDOnColor`],
		wallLEDOnColor: page[`${side}WallLEDOnColor`],
		frontLEDOffColor: page[`${side}FrontLEDOffColor`],
		wallLEDOffColor: page[`${side}WallLEDOffColor`],
	});
	panel.error = error => { throw error; };
	const parameters = { connector: 0, side: 'left', page: 0, configNo: 0 };

	await panel.checkStateChangeForConnector(0, 'ac', 'onoff', true);
	assert.strictEqual(published[0].value, 0x00ff00, 'LED follows the reported AC state even before the cached capability updates');
	assert.strictEqual(published[2].value, 0x0000ff, 'Front and wall LEDs follow the selected source');
	published.length = 0;
	capabilities.onoff.value = true;
	await panel.checkStateChangeForConnector(0, 'ac', 'onoff', false);
	assert.strictEqual(published[0].value, 0, 'A reported off value overrides a stale on snapshot');
	assert.strictEqual(published[2].value, 0);

	published.length = 0;
	await panel.applyAdvancedLedBinding(parameters, { deviceID: 'other-ac', capabilityName: 'onoff', value: false });
	assert.strictEqual(published[0].value, 0x00ff00, 'An action on a different device cannot override the LED source');
	published.length = 0;
	await panel.applyAdvancedLedBinding(parameters, { deviceID: 'ac', capabilityName: 'target_temperature', value: 30 });
	assert.strictEqual(published[0].value, 0x00ff00, 'Temperature actions do not replace the independent onoff LED source');

	page.leftFrontLEDOnColor = '#000000';
	page.leftWallLEDOnColor = '#000000';
	published.length = 0;
	await panel.applyAdvancedLedBinding(parameters);
	assert.strictEqual(published[0].value, 0, 'Black front LEDs remain dark while the device is on');
	assert.strictEqual(published[2].value, 0, 'Black wall LEDs remain dark while the device is on');
	const queue = await panel.publishButtonMQTTmessages([page], 0, 0);
	assert.strictEqual(queue.find(entry => entry.message.endsWith('/led/front/rgb/set')).value, 0, 'Configuration reload respects black LED colours');
	page.leftLedDevice = 'none';
	page.leftLedCapability = '';
	page.leftFrontLEDOnColor = '#00ff00';
	page.leftWallLEDOnColor = '#0000ff';
	const clearedQueue = await panel.publishButtonMQTTmessages([page], 0, 0);
	assert.strictEqual(clearedQueue.find(entry => entry.message.endsWith('/led/front/rgb/set')).value, 0, 'Removing the LED source clears stale front output');
	assert.strictEqual(clearedQueue.find(entry => entry.message.endsWith('/led/wall/rgb/set')).value, 0, 'Removing the LED source clears stale wall output');
}

function checkWizardPreservesLedColours()
{
	const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'settings', 'settings.js'), 'utf8');
	const buildersStart = settingsSource.indexOf('\nfunction getWizardCapability(');
	const buildersEnd = settingsSource.indexOf('\nfunction getButtonWizardDevices(', buildersStart);
	const applyStart = settingsSource.indexOf('\nfunction applyButtonWizard(');
	const applyEnd = settingsSource.indexOf('\nfunction findAdvancedDefaultDeviceForSide(', applyStart);
	assert(buildersStart >= 0 && buildersEnd > buildersStart);
	assert(applyStart >= 0 && applyEnd > applyStart);
	const page = {
		leftFrontLEDOnColor: '#000000',
		leftWallLEDOnColor: '#000000',
		leftFrontLEDOffColor: '#123456',
		leftWallLEDOffColor: '#654321',
	};
	const device = {
		id: 'ac',
		name: 'AC',
		capabilitiesObj: {
			target_temperature: { id: 'target_temperature', type: 'number' },
			onoff: { id: 'onoff.ac', type: 'boolean', setable: false },
		},
	};
	const context = {
		Homey: { __: key => key },
		DEFAULT_RELOCK_SECONDS: 5,
		buttonWizardContext: { configNo: 0, side: 'left', page: 0 },
		buttonDevicesArray: [device],
		localButtonConfigurations: [[page]],
		document: { getElementById: id => ({ value: id === 'buttonWizardType' ? 'thermostat' : 'ac' }) },
		activateDisplayedButtonConfiguration: () => true,
		configDraftStoreButtonSettingsFn: null,
		ensureButtonSideAdvancedDefaults: () => {},
		sanitizeDisplayString: value => value,
		closeButtonWizard: () => {},
		writeButtonsections: () => {},
		getDisplayedButtonPageCount: () => 1,
		updateButtonPanelControls: () => {},
		buttonPagePopupOverlayElement: null,
		flushConfigurationDraftPersist: () => {},
	};
	const applyWizard = vm.runInNewContext(`${settingsSource.slice(buildersStart, buildersEnd)}\n${settingsSource.slice(applyStart, applyEnd)}\napplyButtonWizard`, context);
	applyWizard();
	assert.strictEqual(page.leftFrontLEDOnColor, '#000000', 'Wizard preserves disabled front LEDs');
	assert.strictEqual(page.leftWallLEDOnColor, '#000000', 'Wizard preserves disabled wall LEDs');
	assert.strictEqual(page.leftFrontLEDOffColor, '#123456', 'Wizard preserves existing off colours');
	assert.strictEqual(page.leftWallLEDOffColor, '#654321');
	assert.strictEqual(page.leftLedCapability, 'onoff.ac', 'Thermostat LEDs follow onoff, including read-only subcapabilities');
	assert.strictEqual(page.leftClickCapability, 'target_temperature', 'Thermostat clicks still adjust temperature');
	assert.strictEqual(page.leftClickValueStep, '+1');
	delete device.capabilitiesObj.onoff;
	applyWizard();
	assert.strictEqual(page.leftLedCapability, '', 'A thermostat without onoff does not use its temperature as LED brightness');
}

async function run()
{
	await checkAdvancedLedSources();
	checkWizardPreservesLedColours();
	await checkAdvancedButtonClickResolution();
	await checkCapabilityScaling();
	checkBlankButtonPageFallbackResolver();
	checkButtonDisplayValuesPreferSvg();
	await checkPublishClearsRetainedSvgTopics();
	checkSettingsPageFallbackToggle();
	checkDraftRestorePreservesVisibleButtonSlots();
	const inactive = {
		buttonConfigVersion: 2,
		leftDevice: 'other-panel',
		leftCapability: '',
		leftClickDevice: 'other-panel',
		leftClickCapability: '',
		leftClickNumericAction: 'none',
		leftDoubleDevice: 'other-panel',
		leftDoubleCapability: '',
		leftDoubleNumericAction: 'toggleDirection',
		leftLongDevice: 'other-panel',
		leftLongCapability: '',
		leftLongNumericAction: 'none',
	};
	const original = JSON.parse(JSON.stringify(inactive));
	assert.deepStrictEqual(await sanitize(inactive), { changed: false, writes: 0 });
	assert.deepStrictEqual(inactive, original, 'Empty mappings must not become dim actions');

	const legacyUnsignedStep = {
		leftMode: 'advanced',
		leftClickDevice: 'thermostat',
		leftClickCapability: 'target_temperature',
		leftClickNumericAction: 'change',
		leftClickValueStep: '1',
	};
	assert.deepStrictEqual(await sanitize(legacyUnsignedStep), { changed: true, writes: 1 });
	assert.strictEqual(legacyUnsignedStep.leftClickValueStep, '+1', 'Legacy unsigned steps remain increments after migration');
	assert.strictEqual(legacyUnsignedStep.buttonConfigVersion, 2, 'Migrated pages receive the current config version');
	const legacyInvalidStep = { leftLongValueStep: 'invalid' };
	await sanitize(legacyInvalidStep);
	assert.strictEqual(legacyInvalidStep.leftLongValueStep, '+10', 'Invalid legacy steps retain their +10 fallback');

	const orphanedCapability = {
		leftDevice: 'none',
		leftCapability: 'dim',
		leftCapabilityName: 'Display brightness (dim)',
		leftClickDevice: 'other-panel',
		leftClickCapability: '',
	};
	assert.deepStrictEqual(await sanitize(orphanedCapability), { changed: true, writes: 1 });
	assert.strictEqual(orphanedCapability.leftCapability, '', 'A capability without a legacy device is cleared');
	assert.strictEqual(orphanedCapability.leftCapabilityName, '', 'The stale capability label is cleared too');
	assert.strictEqual(orphanedCapability.leftClickDevice, 'other-panel', 'Independent advanced device targets are preserved');

	const advanced = {
		leftDevice: 'none',
		leftClickDevice: 'other-panel',
		leftClickCapability: 'left_button.connector0',
		leftDisplayDevice: 'other-panel',
		leftDisplayCapability: 'measure_temperature',
	};
	assert.deepStrictEqual(await sanitize(advanced), { changed: true, writes: 1 });
	assert.strictEqual(advanced.leftClickCapability, 'dim', 'Advanced safety must not depend on a basic device');
	assert.strictEqual(advanced.leftDisplayCapability, 'measure_temperature');

	const supported = {
		buttonConfigVersion: 2,
		leftDevice: 'other-panel',
		leftCapability: 'dim',
		leftClickDevice: 'other-panel',
		leftClickCapability: 'dim',
		rightDevice: 'thermostat',
		rightCapability: 'target_temperature',
	};
	assert.deepStrictEqual(await sanitize(supported), { changed: false, writes: 0 });
	assert.strictEqual(supported.rightCapability, 'target_temperature');

	checkBasicButtonPopupVisibility();
	await checkPopupDefaults();
	await checkSignedAdvancedSteps();
	await checkAdvancedDisplayFeedback();
	checkDeviceChangeClearsStaleCapability();
	checkPopupCancelRestoresSnapshots();
	checkPopupSavesCommit();
	checkPopupTooltipsStayReachable();
	checkAdvancedMappingHelpTooltips();
	process.stdout.write('Button configuration and popup transaction tests passed\n');
}

run().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
