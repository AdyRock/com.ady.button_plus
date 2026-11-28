/* global closePageHelpPopup, updateButtonPanelControlsExpander, toggleDisplayedButtonConfigName, createButtonConfigurationCountPreview, updateDisplayConfigNameVisibility, createDisplayItemSelectionPreview */

'use strict';

window.SettingsTour = (() =>
{
	const steps = {
		settings: [
			['#configTypeTabs', 'tabs', 'Use the tabs to select views where you can design buttons, displays and groups, manage MQTT brokers, view logs, or import and export configurations. Each tab has its own tour.'],
			['#settings .settings-main-note', 'assignment', 'Assign your finished configurations or a group to the physical Button+ in its Homey device settings. Select individual configurations or a group in the Button+ device\'s Advanced settings. These app pages are where you design them.'],
			['#webviewip', 'webview', 'Choose a Button+ panel by IP or Name here.'],
			['#openwebview', 'webviewOpen', 'Open Web view opens the selected Button+ panel\'s own simulation web page. The tour will not open it for you.'],
		],
		panelConfig: [
			['#panelConfig .button-global-controls .button-shared-sim-actions', 'buttonSimulate', 'Simulate previews your button labels, values, icons and LEDs. Use On state / Off state to compare their appearance. This only changes the preview, not your devices or saved configurations. The tour does not switch states.'],
			['#buttonPanelControlsExpander', 'buttonPanelExtra', 'The top Extra Settings button shows or hides configuration names, STD / ADV buttons and each card\'s additional editing controls. They are hidden for this introduction. The next steps temporarily show them; your original view is restored when the tour ends.'],
			['#panelConfig .button-global-controls .button-page-label-group', 'buttonPages', 'Use the arrows to browse Button+ pages and + to add a Button+ page.'],
			['#panelConfig .button-visible-count-label', 'buttonConfigurationsShown', 'Configurations shown lets you view several button configurations at the same time. The tour temporarily shows two here, then returns to one for the following steps. Your original selection is restored when the tour ends.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-config-select, #panelConfig .button-main-page.active .button-config-preview-card.active .button-card-editor-controls select', 'buttonConfiguration', 'Each card represents a button configuration. Use its selector to choose a configuration.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-card-editor-controls .panel-config-toggle-btn', 'buttonConfigurationNameToggle', 'The dropdown arrow beside the configuration selector shows or hides its name field. The next step temporarily opens it so you can see where to name this configuration.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-displayed-config-name-row', 'buttonConfigurationName', 'Enter a configuration name here, up to 20 characters, to make it easy to find in the selector. Renaming does not change its configuration number or device and group assignments. The tour does not rename anything and restores whether this field was shown or hidden.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-top-hit-area', 'buttonTitle', 'Click the title area at the top of either simulated button to edit its label. Use a short room, device or action name so it is easy to recognize on your panel.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-state-block, #panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-icon', 'buttonValue', 'Click the value or icon area to choose the device capability or Logic variable shown on the button. For boolean values, you can configure On/Off text or SVG icons. In advanced mode, this display source can differ from the button actions.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-leds', 'buttonLED', 'Click a front or wall LED to configure its feedback and On/Off colors. Set both colors to black to keep that LED off. The same controls are available for the other simulated button.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-mode-toggle-left', 'buttonMode', 'Use this STD / ADV button to switch between standard and advanced setup for this simulated button. STD provides simple setup for one device, its displayed value and LED colors. ADV lets you configure separate action, display and LED bindings. The tour does not change the mode.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-advanced-badge-left', 'buttonActions', 'In ADV mode, the green BUTTON pill opens advanced mappings for Click, Double Click and Long Press. Choose the device, capability and action for each event. If you are using STD mode, this pill is shown temporarily for this tour step only; your mode and settings are unchanged.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-wizard-left', 'buttonWizard', 'Use the wizard button to set up common device types. Choose a type and device to fill in suggested title, display, LED and event settings, then review the result. Each simulated button has its own wizard.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-card-settings-summary', 'buttonExtra', 'Extra Settings beside the trash icon opens additional controls for both buttons on this Button+ page. The next steps temporarily expand it to explain each control pair, then restore its original state.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active [data-button-tour-control="release"]', 'buttonExtraRelease', 'Click Release Event enables or disables click-release events separately for the left and right buttons.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active [data-button-tour-control="repeat"]', 'buttonExtraRepeat', 'Long-press repeat enables or disables repeated actions while each button is held. Set the left and right buttons independently.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active [data-button-tour-control="delay"]', 'buttonExtraDelay', 'Long-press delay sets how long each button must be held before its long-press action starts. Values are in milliseconds.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active [data-button-tour-control="interval"]', 'buttonExtraInterval', 'Repeat interval sets the time between repeated long-press actions for each button, in milliseconds. It applies when long-press repeat is enabled.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active [data-button-tour-control="broker"]', 'buttonExtraBroker', 'Choose the MQTT broker for each button. Default uses the default broker selected on the MQTT settings tab.'],
			['#panelConfig .button-main-page.active .button-config-preview-card.active .button-card-delete-configuration', 'buttonDelete', 'The trash icon beside Extra Settings clears this entire button configuration, including all Button+ pages and both buttons, after confirmation. Its configuration number stays the same, and other configurations and device or group assignments are not renumbered. The tour does not clear anything.'],
			['#copyButtonConfig', 'buttonCopy', 'Copy and Paste reuse the selected button configuration. Pasting changes the editor, so do this only when you want to replace its contents.'],
			['#save', 'save', 'Save All Configurations stores your edits. Then assign the configuration or group to your Button+ device. This tour never edits or saves settings.'],
		],
		displayConfig: [
			['#displayConfigurationNo', 'displayConfiguration', 'Choose the display configuration to edit.'],
			['#toggleDisplayConfigNameVisibility', 'displayConfigurationNameToggle', 'The arrow beside the configuration selector shows or hides the configuration name. The next step temporarily opens the name field; its original visibility is restored afterward.'],
			['#displayConfigNameRow', 'displayConfigurationName', 'Enter a name of up to 20 characters to identify this display configuration in the selector. Renaming does not change its configuration number or device/group assignments. The tour does not rename it.'],
			['#displayInlineSimNext', 'displayPages', 'Use the arrows to browse Button+ display pages.'],
			['#displayInlineSimAddPage', 'displayPageAdd', 'Use + beside the page arrows to add a Button+ display page after the current page. The tour does not add pages.'],
			['#displayInlineSimDeletePage', 'displayPageDelete', 'Delete the current Button+ display page and its items with the page trash button. Page 0 cannot be deleted. On Page 0, the tour only temporarily reveals the disabled icon. The tour does not delete anything.'],
			['#displayInlineSimAddItem', 'displayAdd', 'Use + in the item controls to add a display item. Tap or click an item once to select it, or use the trash button to remove the selected item.'],
			['#displayInlineSimSurface', 'displayEdit', 'Tap or click a display item once to select it. This shows its selection frame and editing handles without opening its properties. The next steps demonstrate a selection without changing your configuration.'],
			['#displayInlineSimSurface .display-sim-item-selected .display-sim-move-handle', 'displayMove', 'Drag the handle at the top of the selected item to move it left, right, up or down. The tour does not move anything. A temporary example is used if this Button+ page has no editable items.'],
			['#displayInlineSimSurface .display-sim-item-selected .display-sim-resize-handle', 'displayResize', 'Drag the handle on the right edge left or right to adjust the selected item\'s width. Text can wrap as the width changes. The tour does not resize anything.'],
			['#displayInlineSimSurface .display-sim-item-selected', 'displayProperties', 'Tap or click the selected item a second time to open its properties. Choose its device or Logic variable, capability, label, units and formatting there. The tour does not open the properties editor.'],
			['#displayInlineSimStatusBarPosition', 'displayStatusBar', 'Sim Status bar is a reference for the simulator only. Configure the actual status bar in the Button+ device\'s Advanced Settings; changing this preview does not change the device.'],
			['#displayConfig label[for="displayInlineSimShowPageZero"]', 'displayPageZero', 'Always show page 0 items overlays Page 0 items on other Button+ display pages in the preview, as they appear on the Button+. Turning it off only hides them in the preview, not on the device. Avoid placing other items over Page 0 items.'],
			['#copyDisplayConfig', 'displayCopy', 'Copy and Paste reuse a display configuration. Save your finished layout, then assign it directly to a panel or include it in a group.'],
			['#save', 'save', 'Save All Configurations stores your edits. Then assign the configuration or group to your Button+ device. This tour never edits or saves settings.'],
		],
		groupConfig: [
			['#groupSelect', 'groupSelect', 'Select a group representing a complete physical panel. Use the adjacent name control to show or edit its name.'],
			['#addGroupBtn', 'groupManage', 'Create a group with +, duplicate it with Copy, or delete it with the trash button. The tour does not perform any of these actions.'],
			['#groupPanelControlsExpander', 'groupPreview', 'Switch between Preview and Configure to hide or show setup controls. If controls are hidden, close the tour, select Configure, and restart it to see those steps.'],
			['#groupSimulatorSurface', 'groupModules', 'Add a display module and button bar modules here. Use each module number to assign a configuration, the edit icon to open its editor, and the trash icon to remove it from this group.'],
			['#groupSimNextPage', 'groupPages', 'Use these arrows to preview Button+ pages across the display and button bars together. A group can contain up to eight button bars.'],
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
	const stepTitles = {
		assignment: 'Assign configurations',
		webview: 'Choose a Button+ panel',
		webviewOpen: 'Open Web view',
		tabs: 'Settings tabs',
		buttonSimulate: 'Simulate',
		buttonPanelExtra: 'Top Extra Settings',
		buttonPages: 'Button+ pages',
		buttonConfigurationsShown: 'Configurations shown',
		buttonConfiguration: 'Choose a configuration',
		buttonConfigurationNameToggle: 'Show configuration name',
		buttonConfigurationName: 'Configuration name',
		buttonTitle: 'Button title',
		buttonValue: 'Button value and icon',
		buttonLED: 'LED feedback',
		buttonMode: 'STD / ADV mode',
		buttonActions: 'Button actions',
		buttonWizard: 'Setup wizard',
		buttonExtra: 'Button Extra Settings',
		buttonExtraRelease: 'Click-release events',
		buttonExtraRepeat: 'Long-press repeat',
		buttonExtraDelay: 'Long-press delay',
		buttonExtraInterval: 'Repeat interval',
		buttonExtraBroker: 'Button MQTT brokers',
		buttonDelete: 'Clear a configuration',
		buttonCopy: 'Copy and paste buttons',
		save: 'Save configurations',
		displayConfiguration: 'Choose a display configuration',
		displayConfigurationNameToggle: 'Show configuration name',
		displayConfigurationName: 'Configuration name',
		displayPages: 'Button+ display page navigation',
		displayPageAdd: 'Add a Button+ display page',
		displayPageDelete: 'Delete a Button+ display page',
		displayAdd: 'Add and remove display items',
		displayEdit: 'Select a display item',
		displayMove: 'Move a display item',
		displayResize: 'Resize a display item',
		displayProperties: 'Open item properties',
		displayStatusBar: 'Sim Status bar',
		displayPageZero: 'Always show page 0 items',
		displayCopy: 'Copy and paste displays',
		groupSelect: 'Choose a group',
		groupManage: 'Manage groups',
		groupPreview: 'Preview and configure',
		groupModules: 'Panel modules',
		groupPages: 'Grouped Button+ pages',
		brokerDefault: 'Default MQTT broker',
		brokerAdd: 'Add an MQTT broker',
		brokerEdit: 'MQTT connection settings',
		logEnable: 'Enable diagnostic logging',
		logRead: 'Read diagnostic logs',
		logClear: 'Clear diagnostic logs',
		logSend: 'Send diagnostic logs',
		logListeners: 'Device listeners',
		sentPanel: 'Choose a panel',
		sentFetch: 'Fetch sent configuration',
		sentRead: 'Inspect sent configuration',
		export: 'Export configurations',
		transfer: 'Configuration backups',
		import: 'Import configurations',
		sendExport: 'Send configuration to support',
		saveImport: 'Save imported configurations',
	};
	const launch = document.getElementById('pageTourOpen');
	const viewSelect = document.getElementById('configType');
	let overlay;
	let dialog;
	let highlight;
	let pointer;
	let message;
	let progress;
	let stepSelect;
	let back;
	let next;
	let activeSteps = [];
	let index = 0;
	let active = false;
	let frame = null;
	let returnFocus = null;
	let demonstrationButton = null;
	let simulatorObserver = null;
	let extraSettingsState = null;
	let originalPanelControlsExpanded = null;
	let configNameState = null;
	let configurationCountPreview = null;
	let displayDeleteButton = null;
	let originalDisplayConfigNameExpanded = null;
	let displayItemSelectionPreview = null;
	const actionShellSelector = '#panelConfig .button-main-page.active .button-config-preview-card.active .button-sim-shell-left';
	const extraDetailsSelector = '#panelConfig .button-main-page.active .button-config-preview-card.active .button-card-settings-details';
	const extraSummarySelector = '#panelConfig .button-main-page.active .button-config-preview-card.active .button-card-settings-summary';
	const configNameToggleSelector = '#panelConfig .button-main-page.active .button-config-preview-card.active .button-card-editor-controls .panel-config-toggle-btn';
	const configNameRowSelector = '#panelConfig .button-main-page.active .button-config-preview-card.active .button-displayed-config-name-row';

	function isDisplayItemSelectionStep(step)
	{
		return ['displayMove', 'displayResize', 'displayProperties'].includes(step[1]);
	}

	function restoreDisplayItemSelection()
	{
		if (!displayItemSelectionPreview) return;
		displayItemSelectionPreview.restore();
		displayItemSelectionPreview = null;
	}

	function restoreDisplayPageDelete()
	{
		if (!displayDeleteButton) return;
		displayDeleteButton.classList.toggle('display-inline-sim-action-hidden', true);
		displayDeleteButton = null;
	}

	function prepareDisplayPageDelete(step)
	{
		restoreDisplayPageDelete();
		if (step[1] !== 'displayPageDelete') return;
		const button = document.querySelector(step[0]);
		if (button && button.classList.contains('display-inline-sim-action-hidden'))
		{
			displayDeleteButton = button;
			button.classList.toggle('display-inline-sim-action-hidden', false);
		}
	}

	function restoreDisplayConfigName()
	{
		if (originalDisplayConfigNameExpanded === null) return;
		updateDisplayConfigNameVisibility(originalDisplayConfigNameExpanded);
		originalDisplayConfigNameExpanded = null;
	}

	function prepareDisplayConfigName(step)
	{
		if (step[1] !== 'displayConfigurationName')
		{
			restoreDisplayConfigName();
			return;
		}
		if (originalDisplayConfigNameExpanded === null)
		{
			originalDisplayConfigNameExpanded = !!visible(document.getElementById('displayConfigNameRow'));
		}
		updateDisplayConfigNameVisibility(true);
	}

	function restoreConfigName()
	{
		if (!configNameState) return;
		toggleDisplayedButtonConfigName(configNameState.button, configNameState.visible);
		configNameState = null;
	}

	function prepareConfigName(step)
	{
		if (step[1] !== 'buttonConfigurationName')
		{
			restoreConfigName();
			return;
		}
		const button = document.querySelector(configNameToggleSelector);
		const row = document.querySelector(configNameRowSelector);
		if (!button || !row) return;
		if (configNameState && configNameState.button !== button) restoreConfigName();
		if (!configNameState) configNameState = { button, visible: row.classList.contains('visible') };
		toggleDisplayedButtonConfigName(button, true);
	}

	function preparePanelControls(step)
	{
		if (originalPanelControlsExpanded === null) return;
		updateButtonPanelControlsExpander(step[1] !== 'buttonSimulate' && step[1] !== 'buttonPanelExtra');
	}

	function restorePanelControls()
	{
		if (originalPanelControlsExpanded === null) return;
		updateButtonPanelControlsExpander(originalPanelControlsExpanded);
		originalPanelControlsExpanded = null;
	}

	function isExtraSettingsStep(step)
	{
		return step[1].startsWith('buttonExtra') && step[1] !== 'buttonExtra';
	}

	function restoreExtraSettings()
	{
		if (!extraSettingsState) return;
		const { details, open, scrollX, scrollY, spacer } = extraSettingsState;
		details.open = open;
		spacer.remove();
		extraSettingsState = null;
		window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
	}

	function prepareExtraSettings(step)
	{
		if (!isExtraSettingsStep(step))
		{
			restoreExtraSettings();
			return;
		}
		const details = document.querySelector(extraDetailsSelector);
		if (!details) return;
		if (!extraSettingsState)
		{
			const spacer = document.createElement('div');
			spacer.setAttribute('aria-hidden', 'true');
			document.body.insertBefore(spacer, overlay);
			extraSettingsState = { details, open: details.open, scrollX: window.scrollX, scrollY: window.scrollY, spacer };
		}
		else if (extraSettingsState.details !== details)
		{
			extraSettingsState.details.open = extraSettingsState.open;
			extraSettingsState.details = details;
			extraSettingsState.open = details.open;
		}
		// Allow the section to reach the top even when it is near the end of the page.
		extraSettingsState.spacer.style.height = `${window.innerHeight}px`;
		details.open = true;
	}

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
		if (!active) return;
		const step = activeSteps[index];
		if (configurationCountPreview) configurationCountPreview.show(step[1] === 'buttonConfigurationsShown' ? 2 : 1);
		preparePanelControls(step);
		prepareConfigName(step);
		if (isExtraSettingsStep(step)) prepareExtraSettings(step);
		else if (step[1] === 'buttonActions') prepareDemonstrationButton(step);
		prepareDisplayPageDelete(step);
		if (displayItemSelectionPreview) displayItemSelectionPreview.show(isDisplayItemSelectionStep(step));
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

	function targets(step)
	{
		return Array.from(document.querySelectorAll(step[0]))
			.map(element => element.closest('.filterable-select-wrapper') || element)
			.filter(visible);
	}

	function target(step)
	{
		return targets(step)[0];
	}

	function contentTop(element)
	{
		let top = document.querySelector('.fixedTop').getBoundingClientRect().bottom;
		const toolbar = document.querySelector('#panelConfig .button-global-controls');
		if (viewSelect.value === 'panelConfig' && visible(toolbar) && !element.closest('.button-global-controls'))
		{
			top = Math.max(top, toolbar.getBoundingClientRect().bottom);
		}
		return top;
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
		stepSelect = document.createElement('select');
		stepSelect.className = 'settings-tour-step-select';
		stepSelect.setAttribute('aria-label', text('chooseStep', 'Jump to a step'));
		activeSteps.forEach((step, stepIndex) =>
		{
			const option = document.createElement('option');
			option.value = String(stepIndex);
			option.textContent = text(`stepTitles.${step[1]}`, stepTitles[step[1]]);
			stepSelect.append(option);
		});
		stepSelect.addEventListener('change', () => show(Number(stepSelect.value)));
		const stepLine = document.createElement('div');
		stepLine.className = 'settings-tour-step-line';
		stepLine.append(progress, stepSelect);
		message = document.createElement('p');
		message.id = 'settingsTourMessage';
		const announcement = document.createElement('div');
		announcement.setAttribute('aria-live', 'polite');
		announcement.setAttribute('aria-atomic', 'true');
		announcement.append(stepLine, message);
		const controls = document.createElement('div');
		controls.className = 'settings-tour-controls';
		back = button(text('back', 'Back'), () => show(index - 1));
		next = button('', advance);
		controls.append(back, next, button(text('close', 'Close'), stop));
		dialog.append(title, announcement, controls);
		overlay.append(highlight, pointer, dialog);
		document.body.append(overlay);
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
		const step = activeSteps[index];
		const elements = targets(step);
		const element = elements[0];
		if (!element)
		{
			advance();
			return;
		}
		const rects = (isExtraSettingsStep(step) ? elements : [element]).map(item => item.getBoundingClientRect());
		const rect = {
			top: Math.min(...rects.map(item => item.top)),
			bottom: Math.max(...rects.map(item => item.bottom)),
			left: Math.min(...rects.map(item => item.left)),
			right: Math.max(...rects.map(item => item.right)),
		};
		const margin = 12;
		const width = window.innerWidth;
		const height = window.innerHeight;
		const top = Math.max(margin, element.closest('.fixedTop') ? rect.top : contentTop(element) + 4, rect.top);
		const bottom = Math.max(top, Math.min(height - margin, rect.bottom));
		const left = Math.max(margin, rect.left);
		const right = Math.max(left, Math.min(width - margin, rect.right));
		highlight.style.top = `${top - 4}px`;
		highlight.style.left = `${left - 4}px`;
		highlight.style.width = `${right - left + 8}px`;
		highlight.style.height = `${bottom - top + 8}px`;
		const selectedItem = isDisplayItemSelectionStep(step) ? element.closest('.display-sim-item') : null;
		const selectedRect = selectedItem ? selectedItem.getBoundingClientRect() : null;
		const sectionBottom = extraSettingsState ? extraSettingsState.details.getBoundingClientRect().bottom
			: selectedRect ? Math.max(bottom, selectedRect.bottom) : bottom;
		const below = Math.max(bottom, sectionBottom) + 26;
		const availableBelow = height - margin - below;
		dialog.style.maxHeight = extraSettingsState && availableBelow >= 140 ? `${availableBelow}px` : '';
		const bubble = dialog.getBoundingClientRect();
		const above = (selectedRect ? Math.min(top, selectedRect.top) : top) - bubble.height - 26;
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
		if (configurationCountPreview) configurationCountPreview.show(activeSteps[index][1] === 'buttonConfigurationsShown' ? 2 : 1);
		preparePanelControls(activeSteps[index]);
		prepareConfigName(activeSteps[index]);
		prepareDisplayConfigName(activeSteps[index]);
		overlay.classList.toggle('settings-tour-extra', isExtraSettingsStep(activeSteps[index]));
		prepareExtraSettings(activeSteps[index]);
		prepareDemonstrationButton(activeSteps[index]);
		prepareDisplayPageDelete(activeSteps[index]);
		if (displayItemSelectionPreview) displayItemSelectionPreview.show(isDisplayItemSelectionStep(activeSteps[index]));
		message.textContent = text(activeSteps[index][1], activeSteps[index][2]);
		progress.textContent = text('step', 'Step __current__ of __total__')
			.replace('__current__', index + 1).replace('__total__', activeSteps.length);
		stepSelect.value = String(index);
		stepSelect.title = text(`stepTitles.${activeSteps[index][1]}`, stepTitles[activeSteps[index][1]]);
		back.disabled = index === 0;
		next.textContent = index === activeSteps.length - 1 ? text('finish', 'Finish') : text('next', 'Next');
		const element = target(activeSteps[index]);
		if (extraSettingsState)
		{
			const summary = document.querySelector(extraSummarySelector);
			const scrollMargin = summary.style.scrollMarginTop;
			summary.style.scrollMarginTop = `${contentTop(summary) + 8}px`;
			summary.scrollIntoView({ block: 'start', behavior: 'instant' });
			const stickyMargin = `${contentTop(summary) + 8}px`;
			if (summary.style.scrollMarginTop !== stickyMargin)
			{
				summary.style.scrollMarginTop = stickyMargin;
				summary.scrollIntoView({ block: 'start', behavior: 'instant' });
			}
			summary.style.scrollMarginTop = scrollMargin;
		}
		else if (element) element.scrollIntoView({ block: 'center', behavior: 'instant' });
		position();
	}

	function advance()
	{
		if (index === activeSteps.length - 1) stop();
		else show(index + 1);
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
			const controls = Array.from(dialog.querySelectorAll('button, select')).filter(element => !element.disabled);
			const current = controls.indexOf(document.activeElement);
			const nextIndex = (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
			event.preventDefault();
			controls[nextIndex].focus();
		}
	}

	function stop()
	{
		if (!active) return;
		active = false;
		if (simulatorObserver) simulatorObserver.disconnect();
		simulatorObserver = null;
		restoreDisplayItemSelection();
		clearDemonstrationButton();
		restoreDisplayPageDelete();
		restoreDisplayConfigName();
		restoreConfigName();
		restoreExtraSettings();
		if (configurationCountPreview) configurationCountPreview.restore();
		configurationCountPreview = null;
		restorePanelControls();
		if (frame !== null) cancelAnimationFrame(frame);
		frame = null;
		overlay.remove();
		document.removeEventListener('keydown', keydown, true);
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
		if (viewSelect.value === 'displayConfig') displayItemSelectionPreview = createDisplayItemSelectionPreview();
		const panelControlsButton = viewSelect.value === 'panelConfig' ? document.getElementById('buttonPanelControlsExpander') : null;
		if (panelControlsButton)
		{
			originalPanelControlsExpanded = panelControlsButton.getAttribute('aria-expanded') === 'true';
			configurationCountPreview = createButtonConfigurationCountPreview();
			configurationCountPreview.show(1);
			// Build the complete step list before collapsing the introductory preview.
			updateButtonPanelControlsExpander(true);
		}
		activeSteps = (steps[viewSelect.value] || []).filter(step => target(step)
			|| (isDisplayItemSelectionStep(step) && visible(document.getElementById('displayInlineSimSurface')))
			|| (step[1] === 'displayConfigurationName' && visible(document.querySelector('#toggleDisplayConfigNameVisibility'))
				&& document.getElementById('displayConfigNameRow'))
			|| (step[1] === 'displayPageDelete' && visible(document.querySelector('#displayInlineSimAddPage'))
				&& document.querySelector(step[0]))
			|| (step[1] === 'buttonConfigurationName' && visible(document.querySelector(configNameToggleSelector))
				&& document.querySelector(configNameRowSelector))
			|| (isExtraSettingsStep(step) && visible(document.querySelector(extraSummarySelector))
				&& document.querySelectorAll(step[0]).length > 0)
			|| (step[1] === 'buttonActions' && visible(document.querySelector(actionShellSelector))));
		if (!activeSteps.length)
		{
			restoreDisplayItemSelection();
			if (configurationCountPreview) configurationCountPreview.restore();
			configurationCountPreview = null;
			restorePanelControls();
			Homey.alert(text('unavailable', 'There are no visible controls to explain. Please wait for the page to load and try again.'));
			return;
		}
		returnFocus = document.activeElement;
		closePageHelpPopup();
		createOverlay();
		overlay.dataset.view = viewSelect.value;
		active = true;
		if (viewSelect.value === 'panelConfig' || viewSelect.value === 'displayConfig')
		{
			simulatorObserver = new MutationObserver(simulatorChanged);
			simulatorObserver.observe(view, { childList: true, subtree: true });
		}
		document.addEventListener('keydown', keydown, true);
		window.addEventListener('scroll', requestPosition, true);
		window.addEventListener('resize', requestPosition);
		window.addEventListener('pagehide', stop);
		show(0);
		next.focus({ preventScroll: true });
	}

	launch.addEventListener('click', start);
	return { stop };
})();
