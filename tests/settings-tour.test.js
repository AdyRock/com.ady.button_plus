'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'settings', 'guidedTour.js'), 'utf8');
const translations = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', 'en.json'), 'utf8')).settings.tour;

function createPage(view = 'settings', reducedMotion = false)
{
	const timers = new Map();
	const listeners = new Map();
	const elements = new Map();
	const alerts = [];
	const observers = [];
	let timerId = 0;
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
			this.textContent = '';
			this.classList = { toggle() {} };
		}

		append(...children) { this.children.push(...children); }
		setAttribute(key, value) { this.attributes[key] = value; }
		addEventListener(key, callback) { this.events[key] = callback; }
		click() { if (!this.disabled) this.events.click(); }
		focus() { document.activeElement = this; }
		scrollIntoView() { this.scrolled = true; }
		getClientRects() { return this.shown ? [{}] : []; }
		getBoundingClientRect() { return { top: 150, bottom: 190, left: 20, right: 240, width: 220, height: 40 }; }
		closest() { return null; }
		remove() { this.isConnected = false; }
		querySelector() { return this.loading || null; }
		querySelectorAll(selector)
		{
			return this.children.flatMap(child => [
				...(selector === 'button' && child.tag === 'button' ? [child] : []),
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
	document.activeElement = launch;
	element('configType').value = view;
	const window = {
		innerWidth: 390,
		innerHeight: 700,
		matchMedia: () => ({ matches: reducedMotion }),
		addEventListener,
		removeEventListener,
	};
	const context = {
		document,
		window,
		Homey: {
			__: key => translations[key.replace('settings.tour.', '')] || key,
			alert: message => alerts.push(message),
			set() { assert.fail('Tours must not persist settings'); },
			api() { assert.fail('Tours must not call APIs'); },
		},
		closePageHelpPopup() {},
		MutationObserver: MockMutationObserver,
		getComputedStyle: () => ({ visibility: 'visible' }),
		setTimeout: (callback, delay) => { timerId += 1; timers.set(timerId, { callback, delay }); return timerId; },
		clearTimeout: id => timers.delete(id),
		requestAnimationFrame: () => 1,
		cancelAnimationFrame() {},
	};
	vm.runInNewContext(source, context);
	function overlay() { return document.body.children[document.body.children.length - 1]; }
	function buttons() { return overlay().querySelectorAll('button'); }
	function currentMessage() { return overlay().children[2].children[1].children[1].textContent; }
	function tick()
	{
		assert.strictEqual(timers.size, 1);
		const [id, timer] = Array.from(timers)[0];
		timers.delete(id);
		assert(timer.delay >= 8000, 'Every step must allow at least eight seconds to read');
		timer.callback();
	}
	return { launch, document, window, element, alerts, timers, listeners, observers, overlay, buttons, currentMessage, tick };
}

const counts = { settings: 3, panelConfig: 11, displayConfig: 6, groupConfig: 6, brokerConfig: 4, diagnosticLog: 5, lastSentLog: 3, importExport: 5 };
for (const [view, count] of Object.entries(counts))
{
	const page = createPage(view);
	page.launch.click();
	assert.strictEqual(page.overlay().dataset.view, view);
	const messages = [];
	for (let i = 0; i < count; i++)
	{
		assert(page.overlay().isConnected);
		messages.push(page.currentMessage());
		page.tick();
	}
	assert.strictEqual(new Set(messages).size, count, `${view} should explain each step distinctly`);
	assert.strictEqual(page.overlay().isConnected, false);
	assert.strictEqual(page.timers.size, 0);
	assert.strictEqual(page.listeners.size, 0, 'Closing removes every temporary listener');
	assert.strictEqual(page.document.activeElement, page.launch);
}

{
	const page = createPage('panelConfig');
	const card = '#panelConfig .button-main-page.active .button-config-preview-card.active';
	const expected = [
		['#panelConfig .button-shared-toolbar', 'buttonPages'],
		[`${card} .button-sim-config-select, ${card} .button-card-editor-controls select`, 'buttonConfiguration'],
		[`${card} .button-sim-top-hit-area`, 'buttonTitle'],
		[`${card} .button-sim-state-block, ${card} .button-sim-icon`, 'buttonValue'],
		[`${card} .button-sim-leds`, 'buttonLED'],
		[`${card} .button-sim-mode-toggle-left`, 'buttonMode'],
		[`${card} .button-sim-advanced-badge-left`, 'buttonActions'],
		[`${card} .button-sim-wizard-left`, 'buttonWizard'],
		['#buttonPanelControlsExpander', 'buttonExtra'],
		['#copyButtonConfig', 'buttonCopy'],
		['#save', 'save'],
	];
	page.launch.click();
	for (const [selector, key] of expected)
	{
		assert.strictEqual(page.currentMessage(), translations[key], 'Button tour follows the requested order');
		assert(page.element(selector).scrolled, `${key} highlights and scrolls to its own control`);
		page.buttons()[2].click();
	}
	assert.strictEqual(page.overlay().isConnected, false);
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
	for (let i = 0; i < 6; i++) page.buttons()[2].click();
	assert.strictEqual(page.currentMessage(), translations.buttonActions);
	const demo = shell.children[0];
	assert(demo.isConnected, 'STD mode temporarily displays the BUTTON pill');
	assert.strictEqual(demo.attributes['aria-hidden'], 'true');
	assert.strictEqual(demo.children[0].textContent, 'Button');
	assert.strictEqual(demo.events.click, undefined, 'Demonstration pill cannot edit settings');
	page.buttons()[1].click();
	assert.strictEqual(page.timers.size, 0);
	demo.remove();
	page.observers[0].callback();
	const refreshedDemo = shell.children[1];
	assert(refreshedDemo.isConnected, 'A live refresh restores the demonstration while paused');
	assert.strictEqual(page.currentMessage(), translations.buttonActions, 'Refreshing preserves the current step');
	assert.strictEqual(page.timers.size, 0, 'Refreshing preserves pause');
	page.observers[0].callback();
	assert.strictEqual(shell.children.length, 2, 'Observing the inserted pill does not recreate it');
	page.buttons()[2].click();
	assert.strictEqual(refreshedDemo.isConnected, false, 'Leaving the step removes the demonstration');
	page.buttons()[0].click();
	const secondDemo = shell.children[2];
	assert(secondDemo.isConnected, 'Going back recreates the demonstration');
	page.listeners.get('keydown')({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} });
	assert.strictEqual(secondDemo.isConnected, false, 'Closing removes the demonstration');
	assert.strictEqual(page.observers[0].connected, false, 'Closing disconnects the refresh observer');
	page.launch.click();
	for (let i = 0; i < 6; i++) page.tick();
	const thirdDemo = shell.children[3];
	page.window.SettingsTour.stop();
	assert.strictEqual(thirdDemo.isConnected, false, 'Page-switch cleanup removes the demonstration');
}

{
	const page = createPage('panelConfig');
	const selector = '#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-advanced-badge-left';
	const existing = page.element(selector);
	page.launch.click();
	for (let i = 0; i < 7; i++) page.buttons()[2].click();
	page.buttons()[3].click();
	assert(existing.isConnected, 'The real ADV mode BUTTON pill is never removed');
}

{
	const page = createPage();
	page.launch.click();
	assert(page.buttons()[0].disabled);
	const first = page.currentMessage();
	page.buttons()[2].click();
	assert.notStrictEqual(page.currentMessage(), first);
	page.buttons()[0].click();
	assert.strictEqual(page.currentMessage(), first);
	page.buttons()[1].click();
	assert.strictEqual(page.timers.size, 0);
	assert.strictEqual(page.buttons()[1].textContent, 'Resume');
	page.buttons()[2].click();
	assert.strictEqual(page.timers.size, 0, 'Manual navigation preserves pause');
	page.buttons()[1].click();
	assert.strictEqual(page.timers.size, 1);
	page.buttons()[3].click();
	assert.strictEqual(page.timers.size, 0);
	page.launch.click();
	assert.strictEqual(page.currentMessage(), first, 'Restart begins at step one');
	const event = { key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} };
	page.listeners.get('keydown')(event);
	assert.strictEqual(page.overlay().isConnected, false);
}

{
	const page = createPage('settings', true);
	page.launch.click();
	assert.strictEqual(page.timers.size, 0, 'Reduced motion starts paused');
	page.buttons()[1].click();
	page.document.hidden = true;
	page.listeners.get('visibilitychange')();
	assert.strictEqual(page.timers.size, 0, 'Backgrounding pauses automatic progression');
	page.document.hidden = false;
	page.listeners.get('visibilitychange')();
	assert.strictEqual(page.timers.size, 0, 'Returning does not unexpectedly resume');
	page.buttons()[3].click();
}

{
	const page = createPage();
	page.element('#webviewip').shown = false;
	page.launch.click();
	page.tick();
	assert.strictEqual(page.buttons()[2].textContent, 'Finish', 'Invisible controls are skipped');
	page.buttons()[2].click();
	const loading = new (page.element('settings').constructor)();
	loading.textContent = 'Loading configuration and devices...';
	page.element('settings').loading = loading;
	page.launch.click();
	assert.deepStrictEqual(page.alerts, ['Loading configuration and devices...']);
	assert.strictEqual(page.timers.size, 0);
}

{
	const page = createPage();
	const wrapper = page.element('webviewWrapper');
	page.element('#webviewip').shown = false;
	page.element('#webviewip').closest = selector => (selector === '.filterable-select-wrapper' ? wrapper : null);
	page.launch.click();
	page.buttons()[2].click();
	assert(page.currentMessage().includes('panel IP address'), 'Enhanced selects highlight their visible wrapper');
	assert(wrapper.scrolled);
	page.buttons()[3].click();
}

{
	const page = createPage();
	page.launch.click();
	const keydown = page.listeners.get('keydown');
	keydown({ key: 'Tab', preventDefault() {} });
	assert.strictEqual(page.document.activeElement, page.buttons()[3]);
	keydown({ key: 'Tab', preventDefault() {} });
	assert.strictEqual(page.document.activeElement, page.buttons()[1], 'Focus wraps without entering settings');
	page.element('configType').value = 'displayConfig';
	page.tick();
	assert.strictEqual(page.overlay().isConnected, false, 'A changed view ends the tour');
	assert.strictEqual(page.timers.size, 0);
}

console.log('Settings tours: eight page tours, timers, navigation, pause, reduced motion, visibility, loading, focus and cleanup passed.');
