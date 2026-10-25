/* global closePageHelpPopup */

'use strict';

window.SettingsTour = (() =>
{
	const steps = {
		settings: [
			['#settings .settings-main-note', 'assignment', 'Assign your finished configurations or a group to the physical Button+ in its Homey device settings. These app pages are where you design them.'],
			['#webviewip', 'webview', 'Choose a panel IP address here, then use Open webview to visit that panel. The tour will not open it for you.'],
			['#configTypeTabs', 'tabs', 'Use the tabs to design buttons, displays and groups, manage MQTT brokers, view logs, or import and export configurations. Each tab has its own tour.'],
		],
		panelConfig: [
			['#panelConfig .button-shared-toolbar', 'buttonPages', 'Use the arrows to browse pages and + to add a page. Configurations shown lets you compare several button configurations side by side.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-config-select, #panelConfig .button-main-page.active .button-config-preview-card.active .button-card-editor-controls select', 'buttonConfiguration', 'Each card represents a button configuration. Use its selector to choose a configuration. Extra Settings shows configuration names and more controls.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-top-hit-area', 'buttonTitle', 'Click the title area at the top of either simulated button to edit its label. Use a short room, device or action name so it is easy to recognize on your panel.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-state-block, #panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-icon', 'buttonValue', 'Click the value or icon area to choose the device capability or Logic variable shown on the button. For boolean values, you can configure On/Off text or SVG icons. In advanced mode, this display source can differ from the button actions.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-leds', 'buttonLED', 'Click a front or wall LED to configure its feedback and On/Off colors. Set both colors to black to keep that LED off. The same controls are available for the other simulated button.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-mode-toggle-left', 'buttonMode', 'Use this STD / ADV button to switch between standard and advanced setup for this simulated button. STD provides simple setup for one device, its displayed value and LED colors. ADV lets you configure separate action, display and LED bindings. The tour does not change the mode.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-advanced-badge-left', 'buttonActions', 'In ADV mode, the green BUTTON pill opens advanced mappings for Click, Double Click and Long Press. Choose the device, capability and action for each event. If you are using STD mode, this pill is shown temporarily for this tour step only; your mode and settings are unchanged.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-wizard-left', 'buttonWizard', 'Use the wizard button to set up common device types. Choose a type and device to fill in suggested title, display, LED and event settings, then review the result. Each simulated button has its own wizard.'],
			['#buttonPanelControlsExpander', 'buttonExtra', 'Extra Settings shows or hides configuration names and additional configuration controls. Close the tour before using these controls.'],
			['#copyButtonConfig', 'buttonCopy', 'Copy and Paste reuse the selected button configuration. Pasting changes the editor, so do this only when you want to replace its contents.'],
			['#save', 'save', 'Save All Configurations stores your edits. Then assign the configuration or group to your Button+ device. This tour never edits or saves settings.'],
		],
		displayConfig: [
			['#displayConfigurationNo', 'displayConfiguration', 'Choose the display configuration to edit. Use the adjacent name control to show or edit its name.'],
			['#displayInlineSimNext', 'displayPages', 'Browse display pages using the arrows. Use + to add a page and the trash button to delete the current page.'],
			['#displayInlineSimAddItem', 'displayAdd', 'Use + in the item controls to add a display item. Tap or click an item once to select it, or use the trash button to remove the selected item.'],
			['#displayInlineSimSurface', 'displayEdit', 'The first tap or click on an item selects it and shows a frame with handles to move and resize it. Tap or click the selected item a second time to open its properties and set its device or Logic variable, capability, label, units and formatting.'],
			['#copyDisplayConfig', 'displayCopy', 'Copy and Paste reuse a display configuration. Save your finished layout, then assign it directly to a panel or include it in a group.'],
			['#save', 'save', 'Save All Configurations stores your edits. Then assign the configuration or group to your Button+ device. This tour never edits or saves settings.'],
		],
		groupConfig: [
			['#groupSelect', 'groupSelect', 'Select a group representing a complete physical panel. Use the adjacent name control to show or edit its name.'],
			['#addGroupBtn', 'groupManage', 'Create a group with +, duplicate it with Copy, or delete it with the trash button. The tour does not perform any of these actions.'],
			['#groupPanelControlsExpander', 'groupPreview', 'Switch between Preview and Configure to hide or show setup controls. If controls are hidden, close the tour, select Configure, and restart it to see those steps.'],
			['#groupSimulatorSurface', 'groupModules', 'Add a display module and button bar modules here. Use each module number to assign a configuration, the edit icon to open its editor, and the trash icon to remove it from this group.'],
			['#groupSimNextPage', 'groupPages', 'Use these arrows to preview pages across the display and button bars together. A group can contain up to eight button bars.'],
			['#save', 'save', 'Save All Configurations stores your edits. Then assign the configuration or group to your Button+ device. This tour never edits or saves settings.'],
		],
		brokerConfig: [
			['#defaultBroker', 'brokerDefault', 'Choose the default MQTT broker used by configurations whose broker is set to Default.'],
			['#newBrokerItem', 'brokerAdd', 'Add a broker here when you need another MQTT connection.'],
			['#brokerItemsSection', 'brokerEdit', 'Configure each broker connection and enable the brokers you need. Check the address, port and any required authentication before saving.'],
			['#save', 'save', 'Save All Configurations stores your edits. Then assign the configuration or group to your Button+ device. This tour never edits or saves settings.'],
		],
		diagnosticLog: [
			['#enableLog', 'logEnable', 'Enable diagnostic logging when investigating a problem. Turn it off again when you no longer need it.'],
			['#diagLog', 'logRead', 'Diagnostic messages appear here. These can help identify connection or configuration problems.'],
			['#clearLog', 'logClear', 'Clear log removes the recorded messages. The tour will not clear them.'],
			['#sendLog', 'logSend', 'Send log opens the support process so you can describe a problem and send diagnostic information. Review what you share first.'],
			['#getListeners', 'logListeners', 'Get listeners collects listener information that can help diagnose device event issues.'],
		],
		lastSentLog: [
			['#sentip', 'sentPanel', 'Select the panel whose last sent configuration you want to inspect.'],
			['#getLog', 'sentFetch', 'Get log retrieves the configuration last sent to the selected panel. The tour does not make this request.'],
			['#sentLog', 'sentRead', 'Review the sent configuration here when checking what was delivered to your panel.'],
		],
		importExport: [
			['#export', 'export', 'Export places your configuration data in the text area. Keep a backup before making major changes or importing another setup.'],
			['#copyText', 'transfer', 'Copy exported data from here to keep a backup, or paste configuration data here before importing. Treat backups as private: they may contain connection details.'],
			['#import', 'import', 'Import loads the pasted configuration into the editor. Review it carefully before saving; importing can replace your current setup.'],
			['#sendExport', 'sendExport', 'Send export lets you share configuration data with support. Review the contents and describe the issue before sending.'],
			['#save', 'saveImport', 'After importing, review your configurations and save them when ready. The tour never imports, exports, sends or saves anything.'],
		],
	};
	const launch = document.getElementById('pageTourOpen');
	const viewSelect = document.getElementById('configType');
	let overlay;
	let dialog;
	let highlight;
	let pointer;
	let message;
	let progress;
	let back;
	let pause;
	let next;
	let activeSteps = [];
	let index = 0;
	let active = false;
	let paused = false;
	let timer = null;
	let frame = null;
	let returnFocus = null;
	let demonstrationButton = null;
	let simulatorObserver = null;
	const actionShellSelector = '#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-shell-left';

	function clearDemonstrationButton()
	{
		if (demonstrationButton) demonstrationButton.remove();
		demonstrationButton = null;
	}

	function prepareDemonstrationButton(step)
	{
		if (step[1] === 'buttonActions' && target(step)) return;
		clearDemonstrationButton();
		if (step[1] !== 'buttonActions') return;
		const shell = document.querySelector(actionShellSelector);
		if (!visible(shell)) return;
		demonstrationButton = document.createElement('span');
		demonstrationButton.className = 'button-sim-advanced-badge button-sim-advanced-badge-left';
		demonstrationButton.setAttribute('aria-hidden', 'true');
		const label = document.createElement('span');
		label.className = 'button-sim-advanced-badge-label';
		const translatedLabel = Homey.__('settings.advancedBadgeLabel');
		label.textContent = translatedLabel === 'settings.advancedBadgeLabel' ? 'Button' : translatedLabel;
		demonstrationButton.append(label);
		shell.append(demonstrationButton);
	}

	function simulatorChanged()
	{
		if (!active || activeSteps[index][1] !== 'buttonActions') return;
		prepareDemonstrationButton(activeSteps[index]);
		requestPosition();
	}

	function text(key, fallback)
	{
		const translationKey = `settings.tour.${key}`;
		const translated = Homey.__(translationKey);
		return translated && translated !== translationKey ? translated : fallback;
	}

	function visible(element)
	{
		return element && element.getClientRects().length > 0
			&& getComputedStyle(element).visibility !== 'hidden';
	}

	function target(step)
	{
		return Array.from(document.querySelectorAll(step[0]))
			.map(element => element.closest('.filterable-select-wrapper') || element)
			.find(visible);
	}

	function button(label, handler)
	{
		const element = document.createElement('button');
		element.type = 'button';
		element.className = 'homey-button-secondary-shadow';
		element.textContent = label;
		element.addEventListener('click', handler);
		return element;
	}

	function createOverlay()
	{
		overlay = document.createElement('div');
		overlay.id = 'settingsTour';
		highlight = document.createElement('div');
		highlight.className = 'settings-tour-highlight';
		highlight.setAttribute('aria-hidden', 'true');
		pointer = document.createElement('div');
		pointer.className = 'settings-tour-pointer';
		pointer.setAttribute('aria-hidden', 'true');
		dialog = document.createElement('div');
		dialog.className = 'settings-tour-dialog';
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');
		dialog.setAttribute('aria-labelledby', 'settingsTourTitle');
		dialog.setAttribute('aria-describedby', 'settingsTourMessage');
		const title = document.createElement('h2');
		title.id = 'settingsTourTitle';
		title.textContent = text('title', 'Guided tour');
		progress = document.createElement('p');
		message = document.createElement('p');
		message.id = 'settingsTourMessage';
		const announcement = document.createElement('div');
		announcement.setAttribute('aria-live', 'polite');
		announcement.setAttribute('aria-atomic', 'true');
		announcement.append(progress, message);
		const controls = document.createElement('div');
		controls.className = 'settings-tour-controls';
		back = button(text('back', 'Back'), () => show(index - 1));
		pause = button('', togglePause);
		next = button('', advance);
		controls.append(back, pause, next, button(text('close', 'Close'), stop));
		dialog.append(title, announcement, controls);
		overlay.append(highlight, pointer, dialog);
		document.body.append(overlay);
	}

	function clearTimer()
	{
		clearTimeout(timer);
		timer = null;
	}

	function schedule()
	{
		clearTimer();
		pause.textContent = paused ? text('resume', 'Resume') : text('pause', 'Pause');
		pause.setAttribute('aria-pressed', String(paused));
		if (!paused)
		{
			timer = setTimeout(advance, Math.max(8000, message.textContent.length * 65));
		}
	}

	function position()
	{
		frame = null;
		if (!active) return;
		if (viewSelect.value !== overlay.dataset.view)
		{
			stop();
			return;
		}
		const element = target(activeSteps[index]);
		if (!element)
		{
			advance();
			return;
		}
		const rect = element.getBoundingClientRect();
		const header = document.querySelector('.fixedTop').getBoundingClientRect();
		const margin = 12;
		const width = window.innerWidth;
		const height = window.innerHeight;
		const top = Math.max(margin, element.closest('.fixedTop') ? rect.top : header.bottom + 4, rect.top);
		const bottom = Math.max(top, Math.min(height - margin, rect.bottom));
		const left = Math.max(margin, rect.left);
		const right = Math.max(left, Math.min(width - margin, rect.right));
		highlight.style.top = `${top - 4}px`;
		highlight.style.left = `${left - 4}px`;
		highlight.style.width = `${right - left + 8}px`;
		highlight.style.height = `${bottom - top + 8}px`;
		const bubble = dialog.getBoundingClientRect();
		const below = bottom + 26;
		const above = top - bubble.height - 26;
		const bubbleTop = below + bubble.height <= height - margin ? below
			: above >= margin ? above : Math.max(margin, height - bubble.height - margin);
		dialog.style.top = `${bubbleTop}px`;
		dialog.style.left = `${Math.max(margin, Math.min(left, width - bubble.width - margin))}px`;
		const pointsDown = bubbleTop < top;
		pointer.classList.toggle('points-down', pointsDown);
		pointer.style.left = `${Math.max(20, Math.min(width - 32, left + (right - left) / 2))}px`;
		const pointerTop = pointsDown ? top - 20 : Math.min(bottom + 8, bubbleTop - 20);
		pointer.style.top = `${Math.max(margin, Math.min(height - margin - 20, pointerTop))}px`;
	}

	function requestPosition()
	{
		if (active && frame === null) frame = requestAnimationFrame(position);
	}

	function show(stepIndex)
	{
		if (stepIndex < 0 || stepIndex >= activeSteps.length) return;
		index = stepIndex;
		prepareDemonstrationButton(activeSteps[index]);
		message.textContent = text(activeSteps[index][1], activeSteps[index][2]);
		progress.textContent = text('step', 'Step __current__ of __total__')
			.replace('__current__', index + 1).replace('__total__', activeSteps.length);
		back.disabled = index === 0;
		next.textContent = index === activeSteps.length - 1 ? text('finish', 'Finish') : text('next', 'Next');
		const element = target(activeSteps[index]);
		if (element) element.scrollIntoView({ block: 'center', behavior: 'instant' });
		position();
		if (active) schedule();
	}

	function advance()
	{
		if (index === activeSteps.length - 1) stop();
		else show(index + 1);
	}

	function togglePause()
	{
		paused = !paused;
		schedule();
	}

	function keydown(event)
	{
		if (event.key === 'Escape')
		{
			event.preventDefault();
			event.stopImmediatePropagation();
			stop();
		}
		else if (event.key === 'Tab')
		{
			const buttons = Array.from(dialog.querySelectorAll('button')).filter(element => !element.disabled);
			const current = buttons.indexOf(document.activeElement);
			const nextIndex = (current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
			event.preventDefault();
			buttons[nextIndex].focus();
		}
	}

	function visibilityChanged()
	{
		if (document.hidden && !paused)
		{
			paused = true;
			schedule();
		}
	}

	function stop()
	{
		if (!active) return;
		active = false;
		if (simulatorObserver) simulatorObserver.disconnect();
		simulatorObserver = null;
		clearDemonstrationButton();
		clearTimer();
		if (frame !== null) cancelAnimationFrame(frame);
		frame = null;
		overlay.remove();
		document.removeEventListener('keydown', keydown, true);
		document.removeEventListener('visibilitychange', visibilityChanged);
		window.removeEventListener('scroll', requestPosition, true);
		window.removeEventListener('resize', requestPosition);
		window.removeEventListener('pagehide', stop);
		if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
	}

	function start()
	{
		stop();
		const view = document.getElementById(viewSelect.value);
		const loading = view.querySelector('.settings-loading:not([hidden])');
		if (loading)
		{
			Homey.alert(loading.textContent.trim());
			return;
		}
		activeSteps = (steps[viewSelect.value] || []).filter(step => target(step)
			|| (step[1] === 'buttonActions' && visible(document.querySelector(actionShellSelector))));
		if (!activeSteps.length)
		{
			Homey.alert(text('unavailable', 'There are no visible controls to explain. Please wait for the page to load and try again.'));
			return;
		}
		returnFocus = document.activeElement;
		closePageHelpPopup();
		paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden;
		createOverlay();
		overlay.dataset.view = viewSelect.value;
		active = true;
		if (viewSelect.value === 'panelConfig')
		{
			simulatorObserver = new MutationObserver(simulatorChanged);
			simulatorObserver.observe(view, { childList: true, subtree: true });
		}
		document.addEventListener('keydown', keydown, true);
		document.addEventListener('visibilitychange', visibilityChanged);
		window.addEventListener('scroll', requestPosition, true);
		window.addEventListener('resize', requestPosition);
		window.addEventListener('pagehide', stop);
		show(0);
		next.focus({ preventScroll: true });
	}

	launch.addEventListener('click', start);
	return { stop };
})();
