'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'settings', 'guidedTour.js'), 'utf8');
const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'settings', 'settings.js'), 'utf8');
const panelControlsSource = settingsSource.slice(
	settingsSource.indexOf('function updateButtonPanelControlsExpander('),
	settingsSource.indexOf('\nfunction toggleButtonPanelControls('),
);
const configNameSource = settingsSource.slice(
	settingsSource.indexOf('function toggleDisplayedButtonConfigName('),
	settingsSource.indexOf('\nfunction renameDisplayedButtonConfiguration('),
);
const displayConfigNameSource = settingsSource.slice(
	settingsSource.indexOf('function updateDisplayConfigNameVisibility('),
	settingsSource.indexOf('\nfunction drawDisplayConfiguration('),
);
const displaySelectionSource = settingsSource.slice(
	settingsSource.indexOf('function getDisplayItemSelectionHandlesMarkup('),
	settingsSource.indexOf('\nfunction renderDisplaySimulatorSurface('),
);
const countPreviewSource = settingsSource.slice(
	settingsSource.indexOf('function createButtonConfigurationCountPreview('),
	settingsSource.indexOf('\nfunction updateButtonPanelControlsExpander('),
);
const translations = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', 'en.json'), 'utf8')).settings.tour;

{
	const renderer = settingsSource.slice(
		settingsSource.indexOf('function renderInlineButtonPagePreview('),
		settingsSource.indexOf('\nfunction renderInlineButtonPagePreviews('),
	);
	const pageConfig = { name: 'Unchanged', leftAdvanced: { events: {} } };
	const original = JSON.parse(JSON.stringify(pageConfig));
	const preview = { dataset: { configIndex: '0' } };
	vm.runInNewContext(`${renderer}\nrenderInlineButtonPagePreview(0, true);`, {
		document: { querySelectorAll: selector => selector === '[data-button-preview-page="0"]' ? [preview] : [] },
		localButtonConfigurations: [[pageConfig]],
		isButtonSideAdvanced: () => false,
		getButtonPageFallbackToggleMarkup: () => '',
		normalizeTooltipHtml: value => value,
		getButtonPanelPreviewMarkup(config, side)
		{
			config[`${side}Advanced`] = { events: { click: { action: 'default' } } };
			return '';
		},
		BUTTON_WIZARD_ICON_SVG: '',
		Homey: { __: key => key },
	});
	assert.deepStrictEqual(pageConfig, original, 'Tour preview rendering cannot write default mappings into the user configuration');
}

function createPage(view = 'settings', reducedMotion = false, panelControlsExpanded = true, configurationCount = 1, displayNameExpanded = false)
{
	const listeners = new Map();
	const elements = new Map();
	const alerts = [];
	const observers = [];
	let document;
	class Element
	{

		constructor()
		{
			this.children = [];
			this.style = {};
			this.dataset = {};
			this.attributes = {};
			this.events = {};
			this.isConnected = true;
			this.shown = true;
			this.open = false;
			this.textContent = '';
			const classes = new Set();
			this.classList = {
				contains: name => classes.has(name),
				add: name => classes.add(name),
				toggle(name, force)
				{
					const add = force === undefined ? !classes.has(name) : force;
					if (add) classes.add(name);
					else classes.delete(name);
					return add;
				},
			};
		}

		append(...children) { this.children.push(...children); }
		get childNodes() { return this.children; }
		set innerHTML(value)
		{
			this.html = value;
			this.children = [];
			if (value.includes('class="display-sim-move-handle"'))
			{
				for (const name of ['display-sim-move-handle', 'display-sim-resize-handle'])
				{
					const handle = new Element();
					handle.tag = 'button';
					handle.classList.add(name);
					handle.setAttribute('onpointerdown', 'drag');
					handle.setAttribute('onclick', 'click');
					this.append(handle);
				}
			}
		}
		replaceChildren(...children) { this.children = children; }
		insertBefore(child, reference) { this.children.splice(this.children.indexOf(reference), 0, child); }
		setAttribute(key, value) { this.attributes[key] = value; }
		getAttribute(key) { return this.attributes[key] || null; }
		removeAttribute(key) { delete this.attributes[key]; }
		addEventListener(key, callback) { this.events[key] = callback; }
		click() { if (!this.disabled) this.events.click(); }
		focus() { document.activeElement = this; }
		scrollIntoView(options) { this.scrolled = true; this.scrollOptions = options; this.scrollMargin = this.style.scrollMarginTop; }
		getClientRects() { return this.shown ? [{}] : []; }
		getBoundingClientRect() { return { top: 150, bottom: 190, left: 20, right: 240, width: 220, height: 40 }; }
		closest() { return null; }
		remove() { this.isConnected = false; }
		querySelector() { return this.loading || null; }
		querySelectorAll(selector)
		{
			return this.children.flatMap(child => [
				...(selector.split(',').map(value => value.trim()).includes(child.tag) ? [child] : []),
				...child.querySelectorAll(selector),
			]);
		}

	}
	function element(key)
	{
		if (!elements.has(key)) elements.set(key, new Element());
		return elements.get(key);
	}
	function addEventListener(name, callback) { listeners.set(name, callback); }
	function removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); }
	function MockMutationObserver(callback)
	{
		this.callback = callback;
		this.observe = () => { this.connected = true; };
		this.disconnect = () => { this.connected = false; };
		observers.push(this);
	}
	document = {
		getElementById: element,
		querySelector: element,
		querySelectorAll: selector => [element(selector)],
		createElement: tag => { const result = new Element(); result.tag = tag; return result; },
		body: new Element(),
		addEventListener,
		removeEventListener,
		hidden: false,
	};
	const launch = element('pageTourOpen');
	const previewStack = element('previewStack');
	previewStack.append(element('originalPreview'));
	const countSelect = element('configurationCountSelect');
	countSelect.value = String(configurationCount);
	const section = element('buttonItemsSection');
	section.querySelector = selector => selector === '.button-visible-count-select' ? countSelect : null;
	section.querySelectorAll = selector => selector === '.button-config-preview-stack' ? [previewStack] : [];
	const cardSelector = '#panelConfig .button-main-page.active .button-config-preview-card.active';
	const nameButton = element(`${cardSelector} .button-card-editor-controls .panel-config-toggle-btn`);
	const nameRow = element(`${cardSelector} .button-displayed-config-name-row`);
	const card = element(cardSelector);
	nameButton.closest = selector => selector === '.button-config-preview-card' ? card : null;
	card.querySelector = selector => selector === '.button-displayed-config-name-row' ? nameRow : null;
	nameRow.getClientRects = () => nameRow.classList.contains('visible') ? [{}] : [];
	nameButton.setAttribute('aria-expanded', 'false');
	const displayNameRow = element('displayConfigNameRow');
	elements.set('#displayConfigNameRow', displayNameRow);
	displayNameRow.getClientRects = () => displayNameRow.style.display === 'none' ? [] : [{}];
	const displayNameButton = element('toggleDisplayConfigNameVisibility');
	elements.set('#toggleDisplayConfigNameVisibility', displayNameButton);
	const displaySurface = element('displayInlineSimSurface');
	elements.set('#displayInlineSimSurface', displaySurface);
	let displayItemNos = [0, 1];
	const isExample = item => (item.className || '').includes('settings-tour-display-item');
	const selectedDisplayItem = () => displaySurface.children.find(item => item.isConnected
		&& (item.classList.contains('display-sim-item-selected') || isExample(item)));
	displaySurface.querySelectorAll = selector => selector === '.display-sim-item:not(.display-sim-item-page-zero-overlay)'
		? displaySurface.children.filter(item => item.isConnected && (item.dataset.itemNo !== undefined || isExample(item))) : [];
	displaySurface.querySelector = selector => selector === '.display-sim-empty-message'
		? displaySurface.children.find(item => item.classList.contains('display-sim-empty-message')) || null : null;
	const queryAll = document.querySelectorAll;
	document.querySelectorAll = selector =>
	{
		if (!selector.startsWith('#displayInlineSimSurface .display-sim-item-selected')) return queryAll(selector);
		const item = selectedDisplayItem();
		if (!item) return [];
		if (selector.endsWith('.display-sim-move-handle')) return item.children.filter(child => child.classList.contains('display-sim-move-handle'));
		if (selector.endsWith('.display-sim-resize-handle')) return item.children.filter(child => child.classList.contains('display-sim-resize-handle'));
		return [item];
	};
	function renderDisplayInlineSimulator()
	{
		for (const item of displaySurface.children) item.remove();
		displaySurface.replaceChildren();
		for (const itemNo of displayItemNos)
		{
			const item = new Element();
			item.dataset.itemNo = String(itemNo);
			item.classList.toggle('display-sim-item-selected', itemNo === context.displayInlineSelectedItemNo);
			if (itemNo === context.displayInlineSelectedItemNo)
			{
				for (const name of ['display-sim-move-handle', 'display-sim-resize-handle'])
				{
					const handle = new Element();
					handle.classList.add(name);
					item.append(handle);
				}
			}
			displaySurface.append(item);
		}
		if (!displayItemNos.length)
		{
			const message = new Element();
			message.classList.add('display-sim-empty-message');
			message.style.display = '';
			displaySurface.append(message);
		}
	}
	element('#panelConfig .button-global-controls').shown = false;
	document.activeElement = launch;
	element('configType').value = view;
	const window = {
		innerWidth: 390,
		innerHeight: 700,
		scrollX: 0,
		scrollY: 120,
		scrollTo(options) { this.scrollX = options.left; this.scrollY = options.top; },
		matchMedia: () => ({ matches: reducedMotion }),
		addEventListener,
		removeEventListener,
	};
	const context = {
		document,
		window,
		Homey: {
			__: key => key.replace('settings.tour.', '').split('.').reduce((value, part) => value && value[part], translations) || key,
			alert: message => alerts.push(message),
			set() { assert.fail('Tours must not persist settings'); },
			api() { assert.fail('Tours must not call APIs'); },
		},
		closePageHelpPopup() {},
		buttonPanelControlsExpanded: panelControlsExpanded,
		displayConfigNameCollapsed: !displayNameExpanded,
		displayConfigNameRowElement: displayNameRow,
		toggleDisplayConfigNameVisibilityElement: displayNameButton,
		displayInlineSelectedItemNo: -1,
		renderDisplayInlineSimulator,
		escapeHtml: value => String(value),
		buttonVisibleConfigurationCount: configurationCount,
		buttonVisibleConfigurationNos: [7, 3, 5, 1].slice(0, configurationCount),
		getDisplayedButtonCardsHtml()
		{
			while (context.buttonVisibleConfigurationNos.length < context.buttonVisibleConfigurationCount)
			{
				context.buttonVisibleConfigurationNos.push(context.buttonVisibleConfigurationNos.length);
			}
			return 'Preview';
		},
		renderInlineButtonPagePreviews() {},
		MutationObserver: MockMutationObserver,
		getComputedStyle: () => ({ visibility: 'visible' }),
		setTimeout() { assert.fail('Tours must not schedule timed progression'); },
		clearTimeout() { assert.fail('Tours must not use progression timers'); },
		requestAnimationFrame: () => 1,
		cancelAnimationFrame() {},
	};
	renderDisplayInlineSimulator();
	vm.runInNewContext(`${panelControlsSource}\n${configNameSource}\n${displayConfigNameSource}\n${displaySelectionSource}\n${countPreviewSource}\n${source}\nupdateButtonPanelControlsExpander();\nupdateDisplayConfigNameVisibility();`, context);
	function overlay() { return document.body.children[document.body.children.length - 1]; }
	function buttons() { return overlay().querySelectorAll('button'); }
	function currentMessage() { return overlay().children[2].children[1].children[1].textContent; }
	function stepSelect() { return overlay().children[2].children[1].children[0].children[1]; }
	function jumpTo(stepIndex)
	{
		stepSelect().value = String(stepIndex);
		stepSelect().events.change();
	}
	function advance()
	{
		buttons()[1].click();
	}
	return {
		launch, document, window, element, alerts, listeners, observers, overlay, buttons, currentMessage, stepSelect, jumpTo, advance,
		renderSavedPanelControls: () => context.updateButtonPanelControlsExpander(),
		savedPanelControlsExpanded: () => context.buttonPanelControlsExpanded,
		savedDisplayNameExpanded: () => !context.displayConfigNameCollapsed,
		displaySelection: () => context.displayInlineSelectedItemNo,
		setDisplaySelection(itemNo) { context.displayInlineSelectedItemNo = itemNo; renderDisplayInlineSimulator(); },
		setDisplayItems(itemNos) { displayItemNos = itemNos; renderDisplayInlineSimulator(); },
		refreshDisplayPreview()
		{
			renderDisplayInlineSimulator();
			for (const observer of observers) if (observer.connected) observer.callback();
		},
		visibleConfigurationCount: () => context.buttonVisibleConfigurationCount,
		visibleConfigurationNos: () => context.buttonVisibleConfigurationNos.slice(),
	};
}

{
	const page = createPage('panelConfig', false, false, 4);
	const card = '#panelConfig .button-main-page.active .button-config-preview-card.active';
	const nameRow = page.element(`${card} .button-displayed-config-name-row`);
	const details = page.element(`${card} .button-card-settings-details`);
	const originalNos = page.visibleConfigurationNos();
	function jump(key)
	{
		const stepIndex = page.stepSelect().children.findIndex(option => option.textContent === translations.stepTitles[key]);
		assert(stepIndex >= 0, `${key} is available in the step menu`);
		page.jumpTo(stepIndex);
	}
	page.launch.click();
	jump('buttonConfigurationsShown');
	assert.strictEqual(page.visibleConfigurationCount(), 2);
	jump('buttonConfigurationName');
	assert.strictEqual(page.visibleConfigurationCount(), 1, 'Jumping out of the count demonstration restores one configuration');
	assert(nameRow.classList.contains('visible'), 'Jumping to a hidden name field reveals it');
	jump('buttonExtraRelease');
	assert.strictEqual(nameRow.classList.contains('visible'), false, 'Jumping away restores the name-field state');
	assert.strictEqual(details.open, true, 'Jumping to a hidden Extra Settings control expands its section');
	jump('buttonPanelExtra');
	assert.strictEqual(details.open, false, 'Jumping away restores the Extra Settings section');
	assert.strictEqual(page.element('buttonPanelControlsExpander').getAttribute('aria-expanded'), 'false');
	page.buttons()[2].click();
	assert.strictEqual(page.visibleConfigurationCount(), 4, 'Closing after jumps restores the original configuration count');
	assert.deepStrictEqual(page.visibleConfigurationNos(), originalNos);
	assert.strictEqual(page.savedPanelControlsExpanded(), false);
}

for (const hidden of [true, false])
{
	const page = createPage('displayConfig');
	const deleteButton = page.element('#displayInlineSimDeletePage');
	deleteButton.disabled = hidden;
	deleteButton.classList.toggle('display-inline-sim-action-hidden', hidden);
	deleteButton.getClientRects = () => deleteButton.classList.contains('display-inline-sim-action-hidden') ? [] : [{}];
	page.launch.click();
	assert.strictEqual(page.stepSelect().children.length, 15, 'The delete-page card is included even on Page 0');
	page.advance();
	page.advance();
	page.advance();
	assert.strictEqual(page.currentMessage(), translations.displayPages);
	page.advance();
	assert.strictEqual(page.currentMessage(), translations.displayPageAdd);
	assert(page.element('#displayInlineSimAddPage').scrolled, 'Adding a page has its own highlighted control');
	page.advance();
	assert.strictEqual(page.currentMessage(), translations.displayPageDelete);
	assert.strictEqual(deleteButton.classList.contains('display-inline-sim-action-hidden'), false);
	assert.strictEqual(deleteButton.disabled, hidden, 'The tour never enables deletion on Page 0');
	assert(deleteButton.scrolled, 'Deleting a page has its own highlighted control');
	page.advance();
	assert.strictEqual(deleteButton.classList.contains('display-inline-sim-action-hidden'), hidden, 'Leaving the delete card restores its visibility');
	page.buttons()[0].click();
	assert.strictEqual(deleteButton.classList.contains('display-inline-sim-action-hidden'), false);
	page.buttons()[2].click();
	assert.strictEqual(deleteButton.classList.contains('display-inline-sim-action-hidden'), hidden, 'Closing on the delete card restores its visibility');
}

{
	const page = createPage('displayConfig');
	const statusBar = page.element('#displayInlineSimStatusBarPosition');
	statusBar.value = 'top';
	page.launch.click();
	page.jumpTo(11);
	assert.strictEqual(page.stepSelect().title, 'Sim Status bar');
	assert.strictEqual(page.currentMessage(), translations.displayStatusBar);
	assert(page.currentMessage().includes("device's Advanced Settings"), 'The card identifies where the actual device setting is configured');
	assert(statusBar.scrolled, 'The card highlights the simulator status-bar control');
	assert.strictEqual(statusBar.value, 'top', 'The tour does not change the preview setting');
	page.buttons()[2].click();
}

for (const checked of [true, false])
{
	const page = createPage('displayConfig');
	const checkbox = page.element('displayInlineSimShowPageZero');
	checkbox.checked = checked;
	page.launch.click();
	page.jumpTo(12);
	assert.strictEqual(page.stepSelect().title, 'Always show page 0 items');
	assert.strictEqual(page.currentMessage(), translations.displayPageZero);
	assert(page.element('#displayConfig label[for="displayInlineSimShowPageZero"]').scrolled, 'The card highlights the checkbox and its label');
	page.buttons()[2].click();
	assert.strictEqual(checkbox.checked, checked, 'The tour leaves the preview checkbox unchanged');
}

for (const expanded of [false, true])
{
	for (const exit of ['close', 'back', 'next', 'jump'])
	{
		const page = createPage('displayConfig', false, true, 1, expanded);
		const row = page.element('displayConfigNameRow');
		const button = page.element('toggleDisplayConfigNameVisibility');
		const input = page.element('displayConfigName');
		input.value = 'Unsaved display name';
		const originalTitle = button.title;
		page.launch.click();
		assert.strictEqual(page.stepSelect().children.length, 15, 'The hidden name field remains available in the menu');
		page.advance();
		assert.strictEqual(page.currentMessage(), translations.displayConfigurationNameToggle);
		assert.strictEqual(row.style.display, expanded ? 'block' : 'none', 'The arrow introduction keeps the original state');
		page.advance();
		assert.strictEqual(page.currentMessage(), translations.displayConfigurationName);
		assert.strictEqual(row.style.display, 'block');
		assert.strictEqual(button.getAttribute('aria-expanded'), 'true');
		assert(row.scrolled);
		if (exit === 'back') page.buttons()[0].click();
		else if (exit === 'next') page.advance();
		else if (exit === 'jump') page.jumpTo(11);
		page.buttons()[2].click();
		assert.strictEqual(row.style.display, expanded ? 'block' : 'none', `${exit} restores the name field's original visibility`);
		assert.strictEqual(button.classList.contains('is-open'), expanded);
		assert.strictEqual(button.getAttribute('aria-expanded'), String(expanded));
		assert.strictEqual(button.title, originalTitle);
		assert.strictEqual(page.savedDisplayNameExpanded(), expanded, 'Temporary expansion does not change the saved view preference');
		assert.strictEqual(input.value, 'Unsaved display name', 'The tour preserves unsaved names');
	}
}

for (const originalSelection of [-1, 1])
{
	for (const exit of ['close', 'escape', 'finish'])
	{
		const page = createPage('displayConfig');
		page.setDisplaySelection(originalSelection);
		page.launch.click();
		assert.strictEqual(page.displaySelection(), -1, 'The display tour starts with no item selected');
		page.jumpTo(7);
		assert.strictEqual(page.currentMessage(), translations.displayEdit);
		assert.strictEqual(page.displaySelection(), -1, 'The first-click explanation keeps items unselected');
		page.advance();
		const selected = originalSelection === -1 ? 0 : originalSelection;
		assert.strictEqual(page.currentMessage(), translations.displayMove);
		assert.strictEqual(page.displaySelection(), selected);
		const moveSelector = '#displayInlineSimSurface .display-sim-item-selected .display-sim-move-handle';
		assert(page.document.querySelectorAll(moveSelector)[0].scrolled, 'The move card highlights the top handle');
		page.advance();
		assert.strictEqual(page.currentMessage(), translations.displayResize);
		assert.strictEqual(page.displaySelection(), selected);
		page.advance();
		assert.strictEqual(page.currentMessage(), translations.displayProperties);
		assert.strictEqual(page.displaySelection(), selected, 'The properties explanation keeps the item selected without opening an editor');
		page.advance();
		assert.strictEqual(page.displaySelection(), -1, 'Leaving the selection demonstration returns to the unselected tour view');
		page.jumpTo(8);
		page.refreshDisplayPreview();
		assert.strictEqual(page.displaySelection(), selected, 'Live preview refresh preserves the demonstration');
		if (exit === 'escape') page.listeners.get('keydown')({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} });
		else if (exit === 'finish')
		{
			page.jumpTo(14);
			page.buttons()[1].click();
		}
		else page.buttons()[2].click();
		assert.strictEqual(page.displaySelection(), originalSelection, `${exit} restores the user's original display selection`);
	}
}

{
	const page = createPage('displayConfig');
	page.setDisplayItems([]);
	page.launch.click();
	assert.strictEqual(page.stepSelect().children.length, 15, 'Empty pages still include every selection-demonstration card');
	page.jumpTo(8);
	const surface = page.element('displayInlineSimSurface');
	const example = surface.children.find(item => (item.className || '').includes('settings-tour-display-item'));
	assert(example && example.html.includes('Example display item'));
	for (const handle of example.querySelectorAll('button'))
	{
		assert.strictEqual(handle.getAttribute('onpointerdown'), null, 'Example handles cannot start real drags');
		assert.strictEqual(handle.getAttribute('onclick'), null);
		assert.strictEqual(handle.tabIndex, -1);
	}
	assert.strictEqual(page.displaySelection(), -1, 'The example is not a real configuration item');
	page.advance();
	page.advance();
	assert.strictEqual(example.isConnected, true, 'The same example stays visible for both handle and properties cards');
	page.refreshDisplayPreview();
	assert.strictEqual(example.isConnected, false);
	assert.strictEqual(surface.children.filter(item => item.isConnected && (item.className || '').includes('settings-tour-display-item')).length, 1);
	page.jumpTo(7);
	assert.strictEqual(surface.children.filter(item => item.isConnected && (item.className || '').includes('settings-tour-display-item')).length, 0);
	assert.strictEqual(surface.querySelector('.display-sim-empty-message').style.display, '', 'Leaving the example restores the empty-state message');
	page.jumpTo(8);
	page.buttons()[2].click();
	assert.strictEqual(page.displaySelection(), -1);
	assert.strictEqual(surface.children.filter(item => item.isConnected && (item.className || '').includes('settings-tour-display-item')).length, 0);
}

for (const originalCount of [1, 2, 3, 4])
{
	for (const exit of ['close', 'escape', 'finish', 'restart', 'view'])
	{
		const page = createPage('panelConfig', false, true, originalCount);
		const stack = page.element('previewStack');
		const originalNode = stack.childNodes[0];
		originalNode.value = 'Unsaved draft';
		const originalNos = page.visibleConfigurationNos();
		page.launch.click();
		assert.strictEqual(page.visibleConfigurationCount(), 1, 'Every button tour starts with one configuration');
		for (let i = 0; i < 3; i++) page.buttons()[1].click();
		assert.strictEqual(page.currentMessage(), translations.buttonConfigurationsShown, 'Configurations shown has its own step after page navigation');
		assert.strictEqual(page.visibleConfigurationCount(), 2, 'The dedicated step demonstrates two configurations');
		assert.strictEqual(page.element('configurationCountSelect').value, '2');
		page.buttons()[1].click();
		assert.strictEqual(page.visibleConfigurationCount(), 1, 'Moving on restores the one-configuration walkthrough');
		page.buttons()[0].click();
		assert.strictEqual(page.visibleConfigurationCount(), 2, 'Going back repeats the two-configuration demonstration');
		if (exit === 'finish')
		{
			while (page.overlay().isConnected) page.advance();
		}
		else if (exit === 'escape') page.listeners.get('keydown')({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} });
		else if (exit === 'view')
		{
			page.element('configType').value = 'displayConfig';
			page.advance();
		}
		else if (exit === 'restart')
		{
			page.launch.click();
			assert.strictEqual(page.visibleConfigurationCount(), 1, 'Restarting resets the temporary demonstration');
			page.buttons()[2].click();
		}
		else page.buttons()[2].click();
		assert.strictEqual(page.visibleConfigurationCount(), originalCount, `${exit} restores the user's configuration count`);
		assert.strictEqual(page.element('configurationCountSelect').value, String(originalCount));
		assert.deepStrictEqual(page.visibleConfigurationNos(), originalNos, `${exit} preserves the chosen configuration slots`);
		assert.strictEqual(stack.childNodes[0], originalNode, 'The original editing controls are restored, not recreated');
		assert.strictEqual(originalNode.value, 'Unsaved draft', 'Draft input values survive the demonstration');
	}
}

for (const initiallyExpanded of [false, true])
{
	for (const exit of ['close', 'escape', 'finish', 'pagehide', 'restart', 'view'])
	{
		const page = createPage('panelConfig', false, initiallyExpanded);
		const section = page.element('buttonItemsSection');
		const button = page.element('buttonPanelControlsExpander');
		const originalQuery = page.document.querySelectorAll;
		page.document.querySelectorAll = selector => {
			const elements = originalQuery(selector);
			if (selector.includes('.button-main-page'))
			{
				elements[0].getClientRects = () => section.classList.contains('button-preview-controls-collapsed') ? [] : [{}];
			}
			return elements;
		};
		page.launch.click();
		assert.strictEqual(page.currentMessage(), translations.buttonSimulate);
		assert.strictEqual(button.getAttribute('aria-expanded'), 'false', 'The tour starts with the top Extra Settings collapsed');
		page.renderSavedPanelControls();
		page.observers[0].callback();
		assert.strictEqual(button.getAttribute('aria-expanded'), 'false', 'A refresh preserves the collapsed introduction');
		const messages = [page.currentMessage()];
		page.buttons()[1].click();
		messages.push(page.currentMessage());
		assert.strictEqual(page.currentMessage(), translations.buttonPanelExtra);
		assert.strictEqual(button.getAttribute('aria-expanded'), 'false', 'The top button is explained before expansion');
		page.buttons()[1].click();
		assert.strictEqual(button.getAttribute('aria-expanded'), 'true', 'Moving on reveals all editing controls');
		page.renderSavedPanelControls();
		page.observers[0].callback();
		assert.strictEqual(button.getAttribute('aria-expanded'), 'true', 'A refresh preserves expansion during the walkthrough');
		if (exit === 'finish')
		{
			while (page.overlay().isConnected)
			{
				messages.push(page.currentMessage());
				page.advance();
			}
			assert.strictEqual(messages.length, 22, 'A tour started with controls hidden still includes every step');
			assert(messages.includes(translations.buttonExtraBroker), 'The per-card Extra Settings steps are retained');
		}
		else if (exit === 'escape') page.listeners.get('keydown')({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} });
		else if (exit === 'pagehide') page.listeners.get('pagehide')();
		else if (exit === 'view')
		{
			page.element('configType').value = 'displayConfig';
			page.advance();
		}
		else if (exit === 'restart')
		{
			page.launch.click();
			assert.strictEqual(button.getAttribute('aria-expanded'), 'false', 'Restarting begins collapsed again');
			page.buttons()[2].click();
		}
		else
		{
			page.buttons()[0].click();
			assert.strictEqual(button.getAttribute('aria-expanded'), 'false', 'Going back to the explanation collapses the controls again');
			page.buttons()[2].click();
		}
		assert.strictEqual(button.getAttribute('aria-expanded'), String(initiallyExpanded), `${exit} restores the original top Extra Settings state`);
		assert.strictEqual(section.classList.contains('button-preview-controls-collapsed'), !initiallyExpanded);
		assert.strictEqual(page.savedPanelControlsExpanded(), initiallyExpanded, 'Temporary view changes never modify the saved preference');
	}
}

const counts = { settings: 4, panelConfig: 22, displayConfig: 15, groupConfig: 6, brokerConfig: 4, diagnosticLog: 5, lastSentLog: 3, importExport: 5 };
for (const [view, count] of Object.entries(counts))
{
	const page = createPage(view);
	page.launch.click();
	assert.strictEqual(page.overlay().dataset.view, view);
	assert.deepStrictEqual(page.buttons().map(button => button.textContent), ['Back', 'Next', 'Close'], `${view} has no Pause or Resume control`);
	assert.strictEqual(page.stepSelect().children.length, count, `${view} lists every available step`);
	assert(page.stepSelect().children.every(option => typeof option.textContent === 'string' && option.textContent.length > 0));
	const firstMessage = page.currentMessage();
	page.jumpTo(count - 1);
	assert.strictEqual(page.buttons()[1].textContent, 'Finish', `${view} can jump directly to the last step`);
	page.jumpTo(0);
	assert.strictEqual(page.currentMessage(), firstMessage, `${view} can jump back to the first step`);
	const messages = [];
	for (let i = 0; i < count; i++)
	{
		assert(page.overlay().isConnected);
		messages.push(page.currentMessage());
		assert.strictEqual(page.stepSelect().value, String(i), 'The dropdown follows manual navigation');
		assert.strictEqual(page.stepSelect().title, page.stepSelect().children[i].textContent);
		if (i === count - 1) assert.strictEqual(page.buttons()[1].textContent, 'Finish');
		page.advance();
	}
	assert.strictEqual(new Set(messages).size, count, `${view} should explain each step distinctly`);
	assert.strictEqual(page.overlay().isConnected, false);
	assert.strictEqual(page.listeners.size, 0, 'Closing removes every temporary listener');
	assert.strictEqual(page.document.activeElement, page.launch);
}

{
	const page = createPage('panelConfig');
	const card = '#panelConfig .button-main-page.active .button-config-preview-card.active';
	const expected = [
		['#panelConfig .button-global-controls .button-shared-sim-actions', 'buttonSimulate'],
		['#buttonPanelControlsExpander', 'buttonPanelExtra'],
		['#panelConfig .button-global-controls .button-page-label-group', 'buttonPages'],
		['#panelConfig .button-visible-count-label', 'buttonConfigurationsShown'],
		[`${card} .button-sim-config-select, ${card} .button-card-editor-controls select`, 'buttonConfiguration'],
		[`${card} .button-card-editor-controls .panel-config-toggle-btn`, 'buttonConfigurationNameToggle'],
		[`${card} .button-displayed-config-name-row`, 'buttonConfigurationName'],
		[`${card} .button-sim-top-hit-area`, 'buttonTitle'],
		[`${card} .button-sim-state-block, ${card} .button-sim-icon`, 'buttonValue'],
		[`${card} .button-sim-leds`, 'buttonLED'],
		[`${card} .button-sim-mode-toggle-left`, 'buttonMode'],
		[`${card} .button-sim-advanced-badge-left`, 'buttonActions'],
		[`${card} .button-sim-wizard-left`, 'buttonWizard'],
		[`${card} .button-card-settings-summary`, 'buttonExtra'],
		[`${card} [data-button-tour-control="release"]`, 'buttonExtraRelease'],
		[`${card} [data-button-tour-control="repeat"]`, 'buttonExtraRepeat'],
		[`${card} [data-button-tour-control="delay"]`, 'buttonExtraDelay'],
		[`${card} [data-button-tour-control="interval"]`, 'buttonExtraInterval'],
		[`${card} [data-button-tour-control="broker"]`, 'buttonExtraBroker'],
		[`${card} .button-card-delete-configuration`, 'buttonDelete'],
		['#copyButtonConfig', 'buttonCopy'],
		['#save', 'save'],
	];
	page.launch.click();
	for (const [selector, key] of expected)
	{
		assert.strictEqual(page.currentMessage(), translations[key], 'Button tour follows the requested order');
		const scrollTarget = key.startsWith('buttonExtra') ? `${card} .button-card-settings-summary` : selector;
		assert(page.element(scrollTarget).scrolled, `${key} scrolls its control or expanded section into view`);
		page.buttons()[1].click();
	}
	assert.strictEqual(page.overlay().isConnected, false);
}

for (const initiallyVisible of [false, true])
{
	for (const exit of ['next', 'back', 'close', 'escape', 'stop'])
	{
		const page = createPage('panelConfig');
		const card = '#panelConfig .button-main-page.active .button-config-preview-card.active';
		const button = page.element(`${card} .button-card-editor-controls .panel-config-toggle-btn`);
		const row = page.element(`${card} .button-displayed-config-name-row`);
		row.classList.toggle('visible', initiallyVisible);
		button.classList.toggle('is-open', initiallyVisible);
		button.setAttribute('aria-expanded', String(initiallyVisible));
		page.launch.click();
		for (let i = 0; i < 5; i++) page.buttons()[1].click();
		assert.strictEqual(page.currentMessage(), translations.buttonConfigurationNameToggle, 'Step 6 explains the dropdown after the configuration selector');
		assert.strictEqual(row.classList.contains('visible'), initiallyVisible, 'The dropdown explanation leaves its original state unchanged');
		page.buttons()[1].click();
		assert.strictEqual(page.currentMessage(), translations.buttonConfigurationName, 'The next step explains the revealed name field');
		assert.strictEqual(row.classList.contains('visible'), true, 'An initially hidden name field is included and temporarily revealed');
		assert.strictEqual(button.getAttribute('aria-expanded'), 'true');
		assert(row.scrolled, 'The expanded name field is scrolled into view');
		if (exit === 'next') page.buttons()[1].click();
		else if (exit === 'back') page.buttons()[0].click();
		else if (exit === 'close') page.buttons()[2].click();
		else if (exit === 'escape') page.listeners.get('keydown')({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} });
		else page.window.SettingsTour.stop();
		assert.strictEqual(row.classList.contains('visible'), initiallyVisible, `${exit} restores the original name-field visibility`);
		assert.strictEqual(button.getAttribute('aria-expanded'), String(initiallyVisible));
		assert.strictEqual(button.classList.contains('is-open'), initiallyVisible);
		if (exit === 'next' || exit === 'back') page.buttons()[2].click();
	}
}

for (const initiallyOpen of [false, true])
{
	for (const exit of ['next', 'back', 'close', 'escape', 'stop'])
	{
		const page = createPage('panelConfig');
		const card = '#panelConfig .button-main-page.active .button-config-preview-card.active';
		const details = page.element(`${card} .button-card-settings-details`);
		const summary = page.element(`${card} .button-card-settings-summary`);
		details.open = initiallyOpen;
		summary.style.scrollMarginTop = '3px';
		const originalQuery = page.document.querySelectorAll;
		page.document.querySelectorAll = selector => {
			const elements = originalQuery(selector);
			if (selector.includes('[data-button-tour-control='))
			{
				elements[0].getClientRects = () => details.open ? [{}] : [];
			}
			return elements;
		};
		page.launch.click();
		for (let i = 0; i < 13; i++) page.buttons()[1].click();
		assert.strictEqual(page.currentMessage(), translations.buttonExtra);
		assert.strictEqual(details.open, initiallyOpen, 'The introductory step explains the button without opening or closing it');
		assert.strictEqual(summary.scrollOptions.block, 'center', 'The introductory step shows the button in context');
		assert.strictEqual(page.document.body.children.length, 1, 'The introductory step does not add temporary scroll space');
		page.buttons()[1].click();
		assert.strictEqual(page.currentMessage(), translations.buttonExtraRelease);
		assert.strictEqual(details.open, true, 'The section opens without changing configuration values');
		assert.strictEqual(summary.scrollOptions.block, 'start', 'The section header scrolls to the top');
		assert.strictEqual(summary.scrollMargin, '198px', 'The fixed header stays above the section');
		assert.strictEqual(summary.style.scrollMarginTop, '3px', 'Temporary scroll styling is restored');
		const spacer = page.document.body.children[page.document.body.children.length - 2];
		assert.strictEqual(spacer.style.height, '700px', 'Temporary space lets a bottom-of-page section reach the top');
		for (let i = 0; i < 4; i++)
		{
			page.buttons()[1].click();
			assert.strictEqual(details.open, true, 'All five control-pair steps keep the section expanded');
		}
		assert.strictEqual(page.currentMessage(), translations.buttonExtraBroker, 'Initially hidden controls remain in the tour');
		page.window.scrollY = 450;
		if (exit === 'next') page.buttons()[1].click();
		else if (exit === 'back') for (let i = 0; i < 5; i++) page.buttons()[0].click();
		else if (exit === 'close') page.buttons()[2].click();
		else if (exit === 'escape') page.listeners.get('keydown')({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} });
		else page.window.SettingsTour.stop();
		assert.strictEqual(details.open, initiallyOpen, `${exit} restores the original open state`);
		assert.strictEqual(page.window.scrollY, 120, `${exit} restores the pre-section scroll position`);
		assert.strictEqual(spacer.isConnected, false, `${exit} removes temporary scroll space`);
		if (exit === 'next' || exit === 'back')
		{
			page.buttons()[exit === 'next' ? 0 : 1].click();
			assert.strictEqual(details.open, true, 'Returning to the section opens it again');
			page.buttons()[2].click();
			assert.strictEqual(details.open, initiallyOpen, 'Closing after re-entry restores the original state');
		}
	}
}

{
	const page = createPage('panelConfig');
	const card = '#panelConfig .button-main-page.active .button-config-preview-card.active';
	const toolbar = page.element('#panelConfig .button-global-controls');
	const summary = page.element(`${card} .button-card-settings-summary`);
	const release = page.element(`${card} [data-button-tour-control="release"]`);
	let summaryTop = 350;
	toolbar.shown = true;
	toolbar.getBoundingClientRect = () => ({ top: summary.scrolled ? 194 : 230, bottom: summary.scrolled ? 294 : 330, left: 20, right: 350 });
	summary.getBoundingClientRect = () => ({ top: summaryTop, bottom: summaryTop + 30, left: 20, right: 160 });
	summary.scrollIntoView = options => {
		summary.scrolled = true;
		summary.scrollOptions = options;
		summaryTop = options.block === 'start' ? parseFloat(summary.style.scrollMarginTop) : 350;
	};
	release.getBoundingClientRect = () => ({ top: summaryTop + 50, bottom: summaryTop + 80, left: 20, right: 350 });
	page.launch.click();
	for (let i = 0; i < 13; i++) page.buttons()[1].click();
	assert.strictEqual(summaryTop, 350, 'The introductory step leaves the button in context');
	assert.strictEqual(page.overlay().children[0].style.top, '346px', 'The introductory highlight cannot cover the toolbar On State button');
	page.buttons()[1].click();
	assert.strictEqual(summaryTop, 302, 'Expanded Extra Settings aligns below the sticky toolbar');
	assert.strictEqual(page.overlay().children[0].style.top, '348px', 'Paired controls remain below the sticky toolbar');
	page.buttons()[2].click();
}

{
	const page = createPage('panelConfig');
	const card = '#panelConfig .button-main-page.active .button-config-preview-card.active';
	const selector = `${card} [data-button-tour-control="release"]`;
	const left = page.element('leftRelease');
	const right = page.element('rightRelease');
	left.getBoundingClientRect = () => ({ top: 250, bottom: 280, left: 20, right: 160 });
	right.getBoundingClientRect = () => ({ top: 250, bottom: 280, left: 190, right: 350 });
	const originalQuery = page.document.querySelectorAll;
	page.document.querySelectorAll = value => value === selector ? [left, right] : originalQuery(value);
	page.launch.click();
	for (let i = 0; i < 14; i++) page.buttons()[1].click();
	assert.strictEqual(page.currentMessage(), translations.buttonExtraRelease);
	const highlight = page.overlay().children[0];
	assert.strictEqual(highlight.style.left, '16px');
	assert.strictEqual(highlight.style.width, '338px', 'Highlight spans both left and right controls');
	assert.strictEqual(highlight.style.height, '38px');
	page.buttons()[2].click();
}

{
	const page = createPage('panelConfig');
	const card = '#panelConfig .button-main-page.active .button-config-preview-card.active';
	const shell = page.element(`${card} .button-sim-shell-left`);
	const badgeSelector = `${card} .button-sim-advanced-badge-left`;
	const originalQuery = page.document.querySelectorAll;
	page.document.querySelectorAll = selector => (selector === badgeSelector
		? shell.children.filter(child => child.isConnected)
		: originalQuery(selector));
	page.launch.click();
	for (let i = 0; i < 11; i++) page.buttons()[1].click();
	assert.strictEqual(page.currentMessage(), translations.buttonActions);
	const demo = shell.children[0];
	assert(demo.isConnected, 'STD mode temporarily displays the BUTTON pill');
	assert.strictEqual(demo.attributes['aria-hidden'], 'true');
	assert.strictEqual(demo.children[0].textContent, 'Button');
	assert.strictEqual(demo.events.click, undefined, 'Demonstration pill cannot edit settings');
	demo.remove();
	page.observers[0].callback();
	const refreshedDemo = shell.children[1];
	assert(refreshedDemo.isConnected, 'A live refresh restores the demonstration on the current step');
	assert.strictEqual(page.currentMessage(), translations.buttonActions, 'Refreshing preserves the current step');
	page.observers[0].callback();
	assert.strictEqual(shell.children.length, 2, 'Observing the inserted pill does not recreate it');
	page.buttons()[1].click();
	assert.strictEqual(refreshedDemo.isConnected, false, 'Leaving the step removes the demonstration');
	page.buttons()[0].click();
	const secondDemo = shell.children[2];
	assert(secondDemo.isConnected, 'Going back recreates the demonstration');
	page.listeners.get('keydown')({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} });
	assert.strictEqual(secondDemo.isConnected, false, 'Closing removes the demonstration');
	assert.strictEqual(page.observers[0].connected, false, 'Closing disconnects the refresh observer');
	page.launch.click();
	for (let i = 0; i < 11; i++) page.advance();
	const thirdDemo = shell.children[3];
	page.window.SettingsTour.stop();
	assert.strictEqual(thirdDemo.isConnected, false, 'Page-switch cleanup removes the demonstration');
}

{
	const page = createPage('panelConfig');
	const selector = '#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-advanced-badge-left';
	const existing = page.element(selector);
	page.launch.click();
	for (let i = 0; i < 12; i++) page.buttons()[1].click();
	page.buttons()[2].click();
	assert(existing.isConnected, 'The real ADV mode BUTTON pill is never removed');
}

{
	const page = createPage();
	page.launch.click();
	assert(page.buttons()[0].disabled);
	const first = page.currentMessage();
	page.buttons()[1].click();
	assert.notStrictEqual(page.currentMessage(), first);
	page.buttons()[0].click();
	assert.strictEqual(page.currentMessage(), first);
	page.buttons()[2].click();
	page.launch.click();
	assert.strictEqual(page.currentMessage(), first, 'Restart begins at step one');
	const event = { key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} };
	page.listeners.get('keydown')(event);
	assert.strictEqual(page.overlay().isConnected, false);
}

{
	const page = createPage('settings', true);
	page.launch.click();
	const first = page.currentMessage();
	page.document.hidden = true;
	assert.strictEqual(page.listeners.has('visibilitychange'), false, 'Visibility changes need no progression handler');
	page.document.hidden = false;
	assert.strictEqual(page.currentMessage(), first, 'Returning leaves the same manual step active');
	page.buttons()[2].click();
}

{
	const page = createPage();
	page.element('#webviewip').shown = false;
	page.launch.click();
	page.advance();
	page.advance();
	assert.strictEqual(page.buttons()[1].textContent, 'Finish', 'Invisible controls are skipped');
	page.buttons()[1].click();
	const loading = new (page.element('settings').constructor)();
	loading.textContent = 'Loading configuration and devices...';
	page.element('settings').loading = loading;
	page.launch.click();
	assert.deepStrictEqual(page.alerts, ['Loading configuration and devices...']);
}

{
	const page = createPage();
	const wrapper = page.element('webviewWrapper');
	page.element('#webviewip').shown = false;
	page.element('#webviewip').closest = selector => (selector === '.filterable-select-wrapper' ? wrapper : null);
	page.launch.click();
	assert(page.currentMessage().startsWith('Use the tabs to select views where you can design'), 'The Settings tour introduces the tabs first');
	assert.strictEqual(page.stepSelect().children[0].textContent, translations.stepTitles.tabs);
	page.buttons()[1].click();
	assert.strictEqual(page.currentMessage(), translations.assignment, 'Configuration assignment follows the tabs');
	page.buttons()[1].click();
	assert.strictEqual(page.currentMessage(), 'Choose a Button+ panel by IP or Name here.', 'Panel selection has its own card with IP or Name');
	assert(wrapper.scrolled);
	page.advance();
	assert.strictEqual(page.currentMessage(), translations.webviewOpen, 'Opening the web view has a separate card');
	assert.strictEqual(page.stepSelect().title, translations.stepTitles.webviewOpen);
	assert(page.element('#openwebview').scrolled, 'The new card highlights the Open Web view button');
	assert.strictEqual(page.buttons()[1].textContent, 'Finish');
	page.buttons()[2].click();
}

{
	const page = createPage();
	page.launch.click();
	const keydown = page.listeners.get('keydown');
	keydown({ key: 'Tab', preventDefault() {} });
	assert.strictEqual(page.document.activeElement, page.buttons()[2]);
	keydown({ key: 'Tab', preventDefault() {} });
	assert.strictEqual(page.document.activeElement, page.stepSelect(), 'Focus wraps to the step dropdown without entering settings');
	keydown({ key: 'Tab', preventDefault() {} });
	assert.strictEqual(page.document.activeElement, page.buttons()[1]);
	page.element('configType').value = 'displayConfig';
	page.advance();
	assert.strictEqual(page.overlay().isConnected, false, 'A changed view ends the tour');
}

console.log('Settings tours: eight manual page tours, navigation, loading, focus, previews and state restoration passed.');
