		// General declarations
		const MAX_BUTTON_CONFIGURATIONS = 40;
		const MAX_DISPLAY_CONFIGURATIONS = 20;
		const CONFIG_DRAFT_STORAGE_KEY = 'unsavedConfigurationDraft';
		const CONFIG_DRAFT_SAVE_DEBOUNCE_MS = 500;
		var buttonDevicesArray = [];
		var buttonDevicesFetched = false;
		var variablesArray = [];
		var variablesFetched = false;
		var displayDevicesArray = [];
		var displayDevicesFetched = false;
		var autoConfigElement = document.getElementById('autoConfig');
		var configTypeElement = document.getElementById('configType');
		var saveButton = document.getElementById('save');
		var saveBlock = document.getElementById('saveBlock');

		// Declarations for the Button Bar Config page

		var buttonConfigurationNoElement = document.getElementById('ButtonPanelConfigurationNo');
		var configNameElement = document.getElementById('configName');
		var configNameRowElement = document.getElementById('configNameRow');
		var toggleConfigNameVisibilityElement = document.getElementById('toggleConfigNameVisibility');
		var panelConfigNameCollapsed = true;

		var copyButtonConfigElement = document.getElementById('copyButtonConfig');
		var pasteButtonConfigElement = document.getElementById('pasteButtonConfig');

		var buttonConfigurationsFetched = false;
		var localButtonConfigurations = [];
		var currentButtonConfigurationNo = 0;
		var customMQTTItemsElements = [];
		var customDisplayMQTTItemsElements = [];

		var openWebViewElement = document.getElementById('openwebview');
		var webViewIpElement = document.getElementById('webviewip');
		var buttonPagePopupOverlayElement = document.getElementById('buttonPagePopupOverlay');
		var buttonPagePopupCloseElement = document.getElementById('buttonPagePopupClose');
		var buttonPagePopupPrevElement = document.getElementById('buttonPagePopupPrev');
		var buttonPagePopupNextElement = document.getElementById('buttonPagePopupNext');
		var buttonPagePopupTitleElement = document.getElementById('buttonPagePopupTitle');
		var buttonPagePopupContentElement = document.getElementById('buttonPagePopupContent');
		var buttonPagePopupStateToggleElement = document.getElementById('buttonPagePopupStateToggle');
		var buttonMainCurrentPage = 0;
		var buttonFieldPopupOverlayElement = document.getElementById('buttonFieldPopupOverlay');
		var buttonFieldPopupTitleElement = document.getElementById('buttonFieldPopupTitle');
		var buttonFieldPopupBodyElement = document.getElementById('buttonFieldPopupBody');
		var buttonFieldPopupCancelElement = document.getElementById('buttonFieldPopupCancel');
		var buttonFieldPopupSaveElement = document.getElementById('buttonFieldPopupSave');
		var buttonPagePopupCurrentPage = -1;
		var buttonPagePopupLedState = 'on';
		var buttonFieldPopupBindings = [];
		var buttonFieldPopupContext = null;
		var displayFieldPopupOverlayElement = document.getElementById('displayFieldPopupOverlay');
		var displayFieldPopupTitleElement = document.getElementById('displayFieldPopupTitle');
		var displayFieldPopupBodyElement = document.getElementById('displayFieldPopupBody');
		var displayFieldPopupCancelElement = document.getElementById('displayFieldPopupCancel');
		var displayFieldPopupSaveElement = document.getElementById('displayFieldPopupSave');
		var displayFieldPopupBindings = [];
		var displayFieldPopupContext = null;
		var displayPagePopupOpenElement = document.getElementById('displayPageSimOpen');
		var displayPagePopupOverlayElement = document.getElementById('displayPagePopupOverlay');
		var displayPagePopupCloseElement = document.getElementById('displayPagePopupClose');
		var displayPagePopupPrevElement = document.getElementById('displayPagePopupPrev');
		var displayPagePopupNextElement = document.getElementById('displayPagePopupNext');
		var displayPagePopupTitleElement = document.getElementById('displayPagePopupTitle');
		var displayPagePopupStatusBarPositionElement = document.getElementById('displayPagePopupStatusBarPosition');
		var displayPagePopupSurfaceElement = document.getElementById('displayPagePopupSurface');
		var displayInlineSimPrevElement = document.getElementById('displayInlineSimPrev');
		var displayInlineSimNextElement = document.getElementById('displayInlineSimNext');
		var displayInlineSimTitleElement = document.getElementById('displayInlineSimTitle');
		var displayInlineSimStatusBarPositionElement = document.getElementById('displayInlineSimStatusBarPosition');
		var displayInlineSimShowPageZeroElement = document.getElementById('displayInlineSimShowPageZero');
		var displayInlineSimSurfaceElement = document.getElementById('displayInlineSimSurface');
		var displayInlineSimAddPageElement = document.getElementById('displayInlineSimAddPage');
		var displayInlineSimDeletePageElement = document.getElementById('displayInlineSimDeletePage');
		var displayInlineSimAddItemElement = document.getElementById('displayInlineSimAddItem');
		var displayInlineSimDeleteItemElement = document.getElementById('displayInlineSimDeleteItem');
		var displayPagePopupCurrentPage = 0;
		var displayPagePopupStatusBarPosition = null;
		var displayInlineSelectedItemNo = -1;
const DISPLAY_FONT_SIZE_LOOKUP = { 1: 18, 2: 35, 3: 45, 4: 66, 5: 100 };
		const DISPLAY_BOLD_FONT_SIZES = new Set();
		const DISPLAY_SIM_LIVE_REFRESH_MS = 12000;
		var displayPagePopupLiveValueCache = new Map();
		var displayPagePopupVariableValueCache = new Map();
		var displayPagePopupVariableValueFetchedAt = 0;
		var displayPagePopupLiveRefreshTimer = null;
		var displayInlineLiveRefreshTimer = null;
		var displayItemResizeState = null;
		var displayItemMoveState = null;
		var configDraftSaveTimer = null;
		var configDraftAutoSaveEnabled = false;
		var configDraftPendingPersist = false;
		var configDraftLoadedData = null;
		var configDraftLoaded = false;
		var configDraftRestoreDecisionMade = false;
		var restoredDraftDefaultBroker = null;
		var configDraftStoreButtonSettingsFn = null;

		function enableConfigurationDraftAutoSave()
		{
			configDraftAutoSaveEnabled = true;
			if (configDraftPendingPersist)
			{
				configDraftPendingPersist = false;
				flushConfigurationDraftPersist();
			}
		}

		function deepCloneData(data)
		{
			if (data === undefined)
			{
				return undefined;
			}

			try
			{
				return JSON.parse(JSON.stringify(data));
			}
			catch (err)
			{
				return undefined;
			}
		}

		function syncBrokerSettingsToLocalWithoutValidation()
		{
			if (!Array.isArray(localBrokerItems))
			{
				return;
			}

			for (let itemNo = 0; itemNo < localBrokerItems.length; itemNo++)
			{
				const idElement = document.getElementById(`broker${itemNo}Id`);
				const enabledElement = document.getElementById(`broker${itemNo}Enabled`);
				const addressElement = document.getElementById(`broker${itemNo}Address`);
				const portElement = document.getElementById(`broker${itemNo}Port`);
				const wsPortElement = document.getElementById(`broker${itemNo}WSPort`);
				const usernameElement = document.getElementById(`broker${itemNo}Username`);
				const passwordElement = document.getElementById(`broker${itemNo}Password`);

				if (!idElement || !enabledElement || !addressElement || !portElement || !wsPortElement || !usernameElement || !passwordElement)
				{
					continue;
				}

				localBrokerItems[itemNo].enabled = enabledElement.checked;
				localBrokerItems[itemNo].brokerid = idElement.value;
				localBrokerItems[itemNo].url = addressElement.value;
				localBrokerItems[itemNo].port = portElement.value;
				localBrokerItems[itemNo].wsport = wsPortElement.value;
				localBrokerItems[itemNo].username = usernameElement.value;
				localBrokerItems[itemNo].password = passwordElement.value;
			}
		}

		function syncCurrentButtonSettingsForDraftSnapshot()
		{
			if (!buttonConfigurationsFetched || !Array.isArray(localButtonConfigurations) || localButtonConfigurations.length === 0)
			{
				return;
			}

			const currentButtonNo = parseInt(buttonConfigurationNoElement.value, 10);
			if (Number.isNaN(currentButtonNo) || !localButtonConfigurations[currentButtonNo])
			{
				return;
			}

			if (typeof configDraftStoreButtonSettingsFn === 'function')
			{
				configDraftStoreButtonSettingsFn(localButtonConfigurations[currentButtonNo]);
				return;
			}

			const activeButtonConfiguration = localButtonConfigurations[currentButtonNo];
			if (!Array.isArray(activeButtonConfiguration) || activeButtonConfiguration.length === 0)
			{
				return;
			}

			if (activeButtonConfiguration[0] && configNameElement)
			{
				activeButtonConfiguration[0].name = configNameElement.value;
			}

			for (let page = 0; page < activeButtonConfiguration.length; page++)
			{
				const pageConfig = activeButtonConfiguration[page];
				if (!pageConfig || typeof pageConfig !== 'object')
				{
					continue;
				}

				pageConfig.PageNum = page;
				for (const side of ['left', 'right'])
				{
					const topTextElement = document.getElementById(`${side}${page}TopText`);
					const onTextElement = document.getElementById(`${side}${page}OnText`);
					const offTextElement = document.getElementById(`${side}${page}OffText`);
					const deviceElement = document.getElementById(`${side}${page}Device`);
					const capabilityElement = document.getElementById(`${side}${page}Capability`);
					const brokerIdElement = document.getElementById(`${side}${page}BrokerId`);
					const dimChangeElement = document.getElementById(`${side}${page}DimChange`);
					const frontLEDOnColorElement = document.getElementById(`${side}${page}FrontLEDOnColor`);
					const wallLEDOnColorElement = document.getElementById(`${side}${page}WallLEDOnColor`);
					const frontLEDOffColorElement = document.getElementById(`${side}${page}FrontLEDOffColor`);
					const wallLEDOffColorElement = document.getElementById(`${side}${page}WallLEDOffColor`);
					const longRepeatElement = document.getElementById(`${side}${page}DisableLongRepeat`);

					if (topTextElement) pageConfig[`${side}TopText`] = topTextElement.value;
					if (onTextElement) pageConfig[`${side}OnText`] = onTextElement.value;
					if (offTextElement) pageConfig[`${side}OffText`] = offTextElement.value;
					if (deviceElement)
					{
						pageConfig[`${side}Device`] = deviceElement.value;
						if (deviceElement.selectedIndex >= 0 && deviceElement.options && deviceElement.options[deviceElement.selectedIndex])
						{
							pageConfig[`${side}DeviceName`] = deviceElement.options[deviceElement.selectedIndex].text.trim();
						}
					}
					if (capabilityElement)
					{
						pageConfig[`${side}Capability`] = capabilityElement.value;
						if (capabilityElement.selectedIndex >= 0 && capabilityElement.options && capabilityElement.options[capabilityElement.selectedIndex])
						{
							pageConfig[`${side}CapabilityName`] = capabilityElement.options[capabilityElement.selectedIndex].text;
						}
					}
					if (brokerIdElement) pageConfig[`${side}BrokerId`] = brokerIdElement.value;
					if (dimChangeElement) pageConfig[`${side}DimChange`] = dimChangeElement.value;
					if (frontLEDOnColorElement) pageConfig[`${side}FrontLEDOnColor`] = frontLEDOnColorElement.value;
					if (wallLEDOnColorElement) pageConfig[`${side}WallLEDOnColor`] = wallLEDOnColorElement.value;
					if (frontLEDOffColorElement) pageConfig[`${side}FrontLEDOffColor`] = frontLEDOffColorElement.value;
					if (wallLEDOffColorElement) pageConfig[`${side}WallLEDOffColor`] = wallLEDOffColorElement.value;
					if (longRepeatElement) pageConfig[`${side}DisableLongRepeat`] = !!longRepeatElement.checked;
				}
			}
		}

		function buildConfigurationDraftSnapshot()
		{
			syncCurrentButtonSettingsForDraftSnapshot();

			if (displayConfigurationsFetched)
			{
				storeDisplaySettings();
			}

			syncBrokerSettingsToLocalWithoutValidation();

			return {
				version: 1,
				timestamp: Date.now(),
				buttonConfigurations: deepCloneData(localButtonConfigurations) || [],
				displayConfigurations: deepCloneData(localDisplayConfigurations) || [],
				brokerConfigurationItems: deepCloneData(localBrokerItems) || [],
				defaultBroker: defaultBrokerElement ? defaultBrokerElement.value : 'homey',
				currentButtonConfigurationNo: parseInt(buttonConfigurationNoElement?.value, 10) || 0,
				currentDisplayConfigurationNo: parseInt(displayConfigurationNoElement?.value, 10) || 0,
				configType: configTypeElement ? configTypeElement.value : 'panelConfig',
			};
		}

		function persistConfigurationDraftNow()
		{
			if (!configDraftAutoSaveEnabled)
			{
				configDraftPendingPersist = true;
				return;
			}

			const snapshot = buildConfigurationDraftSnapshot();
			Homey.set(CONFIG_DRAFT_STORAGE_KEY, snapshot);
		}

		function scheduleConfigurationDraftPersist()
		{
			if (!configDraftAutoSaveEnabled)
			{
				configDraftPendingPersist = true;
				return;
			}

			if (configDraftSaveTimer)
			{
				clearTimeout(configDraftSaveTimer);
			}

			configDraftSaveTimer = setTimeout(function ()
			{
				configDraftSaveTimer = null;
				persistConfigurationDraftNow();
			}, CONFIG_DRAFT_SAVE_DEBOUNCE_MS);
		}

		function flushConfigurationDraftPersist()
		{
			if (!configDraftAutoSaveEnabled)
			{
				configDraftPendingPersist = true;
				return;
			}

			if (configDraftSaveTimer)
			{
				clearTimeout(configDraftSaveTimer);
				configDraftSaveTimer = null;
			}

			persistConfigurationDraftNow();
		}

		function isDraftRelevantEventTarget(target)
		{
			if (!target || !target.closest)
			{
				return false;
			}

			if (target.id === 'save')
			{
				return false;
			}

			return !!target.closest('#panelConfig, #displayConfig, #brokerConfig, #buttonFieldPopupOverlay, #displayFieldPopupOverlay');
		}

		function applyConfigurationDraft(draft)
		{
			if (!draft || typeof draft !== 'object')
			{
				return;
			}

			const draftButtons = deepCloneData(draft.buttonConfigurations);
			const draftDisplays = deepCloneData(draft.displayConfigurations);
			const draftBrokers = deepCloneData(draft.brokerConfigurationItems);

			if (Array.isArray(draftButtons) && draftButtons.length > 0)
			{
				localButtonConfigurations = draftButtons;
				buttonConfigurationsFetched = true;
				fillConfigListElement(buttonConfigurationNoElement, Homey.__("settings.buttonConfig"), localButtonConfigurations, MAX_BUTTON_CONFIGURATIONS);
				const restoredButtonNo = parseInt(draft.currentButtonConfigurationNo, 10);
				currentButtonConfigurationNo = Number.isNaN(restoredButtonNo)
					? 0
					: Math.max(0, Math.min(restoredButtonNo, localButtonConfigurations.length - 1));
				buttonConfigurationNoElement.value = `${currentButtonConfigurationNo}`;
				const buttonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo] || [];
				writeButtonsections(buttonPanelConfiguration.length || 1);
				updateButtonPanelControls();
			}

			if (Array.isArray(draftDisplays) && draftDisplays.length > 0)
			{
				normalizeDisplayConfigurationsPages(draftDisplays);
				localDisplayConfigurations = draftDisplays;
				displayConfigurationsFetched = true;
				fillConfigListElement(displayConfigurationNoElement, Homey.__("settings.displayConfig"), localDisplayConfigurations, MAX_DISPLAY_CONFIGURATIONS);
				const restoredDisplayNo = parseInt(draft.currentDisplayConfigurationNo, 10);
				currentDisplayConfigurationNo = Number.isNaN(restoredDisplayNo)
					? 0
					: Math.max(0, Math.min(restoredDisplayNo, localDisplayConfigurations.length - 1));
				displayConfigurationNoElement.value = `${currentDisplayConfigurationNo}`;
				updateDisplayConfiguration();
			}

			if (Array.isArray(draftBrokers))
			{
				localBrokerItems = draftBrokers;
				brokerItemsFetched = true;
				setupButtonBrokerItems();
			}

			if (typeof draft.defaultBroker === 'string' && draft.defaultBroker)
			{
				restoredDraftDefaultBroker = draft.defaultBroker;
				if (defaultBrokerElement)
				{
					defaultBrokerElement.value = draft.defaultBroker;
				}
			}

			if (typeof draft.configType === 'string' && draft.configType)
			{
				configTypeElement.value = draft.configType;
				configTypeChanged(draft.configType);
			}
		}

		function maybeHandleLoadedConfigurationDraft()
		{
			if (configDraftRestoreDecisionMade)
			{
				return;
			}

			if (!configDraftLoaded || !buttonConfigurationsFetched || !displayConfigurationsFetched || !brokerItemsFetched)
			{
				return;
			}

			configDraftRestoreDecisionMade = true;

			if (!configDraftLoadedData || typeof configDraftLoadedData !== 'object')
			{
				enableConfigurationDraftAutoSave();
				return;
			}

			Homey.confirm('Unsaved settings have been detected, would you like to restore those now?', null, function (err, ok)
			{
				if (ok)
				{
					applyConfigurationDraft(configDraftLoadedData);
					// Homey.alert(Homey.__("settings.unsavedSettingsRestored"));
				}
				else
				{
					Homey.set(CONFIG_DRAFT_STORAGE_KEY, null);
				}

				enableConfigurationDraftAutoSave();
			});
		}

		function startDisplayInlineLiveRefresh()
		{
			if (displayInlineLiveRefreshTimer)
			{
				return;
			}

			displayInlineLiveRefreshTimer = setInterval(refreshDisplayPopupLiveValues, DISPLAY_SIM_LIVE_REFRESH_MS);
		}

		function stopDisplayInlineLiveRefresh()
		{
			if (!displayInlineLiveRefreshTimer)
			{
				return;
			}

			clearInterval(displayInlineLiveRefreshTimer);
			displayInlineLiveRefreshTimer = null;
		}

		function startDisplayItemMoveDrag(event, itemNo)
		{
			if (!event)
			{
				return;
			}

			event.preventDefault();
			event.stopPropagation();

			const handleElement = event.currentTarget;
			const itemElement = handleElement ? handleElement.closest('.display-sim-item') : null;
			const surfaceElement = itemElement ? itemElement.closest('.display-sim-surface') : null;
			if (!itemElement || !surfaceElement)
			{
				return;
			}

			const surfaceRect = surfaceElement.getBoundingClientRect();
			const itemRect = itemElement.getBoundingClientRect();
			if (!surfaceRect || !itemRect || surfaceRect.width <= 0 || surfaceRect.height <= 0)
			{
				return;
			}

			if (typeof handleElement.setPointerCapture === 'function' && event.pointerId !== undefined)
			{
				try
				{
					handleElement.setPointerCapture(event.pointerId);
				}
				catch (err)
				{
					// Ignore pointer capture errors from unsupported environments.
				}
			}

			const xInputElement = document.getElementById(`display${itemNo}X`);
			const yInputElement = document.getElementById(`display${itemNo}Y`);
			const leftFromInput = xInputElement ? parseFloat(xInputElement.value) : NaN;
			const topFromInput = yInputElement ? parseFloat(yInputElement.value) : NaN;
			const leftFromStyle = parseFloat(itemElement.dataset.leftPercent || itemElement.style.left || '0');
			const topFromStyle = parseFloat(itemElement.dataset.topPercent || itemElement.style.top || '0');
			const startLeftPercent = Number.isNaN(leftFromInput)
				? (Number.isNaN(leftFromStyle) ? 0 : leftFromStyle)
				: leftFromInput;
			const startTopPercent = Number.isNaN(topFromInput)
				? (Number.isNaN(topFromStyle) ? 0 : topFromStyle)
				: topFromInput;
			const moveTooltipElement = itemElement.querySelector('.display-sim-move-tooltip');
			if (moveTooltipElement)
			{
				moveTooltipElement.textContent = `X: ${Math.round(startLeftPercent)}% Y: ${Math.round(startTopPercent)}%`;
				const itemMidpoint = itemRect.top - surfaceRect.top + (itemRect.height / 2);
				const showTooltipBelow = itemMidpoint < (surfaceRect.height / 2);
				moveTooltipElement.classList.toggle('display-sim-resize-tooltip-below', showTooltipBelow);
			}
			itemElement.classList.add('display-sim-item-moving');

			displayItemMoveState = {
				itemNo,
				itemElement,
				surfaceElement,
				moveTooltipElement,
				xInputElement,
				yInputElement,
				startClientX: event.clientX,
				startClientY: event.clientY,
				startLeftPercent,
				startTopPercent,
				itemWidthPercent: (itemRect.width / surfaceRect.width) * 100,
				itemHeightPercent: (itemRect.height / surfaceRect.height) * 100,
				pointerId: event.pointerId,
			};

			document.body.classList.add('display-sim-moving');
			window.addEventListener('pointermove', onDisplayItemMoveDragMove);
			window.addEventListener('pointerup', stopDisplayItemMoveDrag);
			window.addEventListener('pointercancel', stopDisplayItemMoveDrag);
		}

		function onDisplayItemMoveDragMove(event)
		{
			if (!displayItemMoveState || !event)
			{
				return;
			}

			if (displayItemMoveState.pointerId !== undefined && event.pointerId !== undefined && displayItemMoveState.pointerId !== event.pointerId)
			{
				return;
			}

			event.preventDefault();

			const surfaceRect = displayItemMoveState.surfaceElement.getBoundingClientRect();
			if (!surfaceRect || surfaceRect.width <= 0 || surfaceRect.height <= 0)
			{
				return;
			}

			const deltaX = event.clientX - displayItemMoveState.startClientX;
			const deltaY = event.clientY - displayItemMoveState.startClientY;
			const deltaXPercent = (deltaX / surfaceRect.width) * 100;
			const deltaYPercent = (deltaY / surfaceRect.height) * 100;

			const maxLeftPercent = Math.max(0, Math.floor(100 - displayItemMoveState.itemWidthPercent));
			const maxTopPercent = Math.max(0, Math.floor(100 - displayItemMoveState.itemHeightPercent));
			const displayLeftPercent = Math.max(0, Math.min(maxLeftPercent, Math.round(displayItemMoveState.startLeftPercent + deltaXPercent)));
			const displayTopPercent = Math.max(0, Math.min(maxTopPercent, Math.round(displayItemMoveState.startTopPercent + deltaYPercent)));

			displayItemMoveState.itemElement.style.left = `${displayLeftPercent}%`;
			displayItemMoveState.itemElement.style.top = `${displayTopPercent}%`;
			displayItemMoveState.itemElement.dataset.leftPercent = `${displayLeftPercent}`;
			displayItemMoveState.itemElement.dataset.topPercent = `${displayTopPercent}`;

			if (displayItemMoveState.moveTooltipElement)
			{
				displayItemMoveState.moveTooltipElement.textContent = `X: ${displayLeftPercent}% Y: ${displayTopPercent}%`;
				const itemRect = displayItemMoveState.itemElement.getBoundingClientRect();
				const itemMidpoint = itemRect.top - surfaceRect.top + (itemRect.height / 2);
				const showTooltipBelow = itemMidpoint < (surfaceRect.height / 2);
				displayItemMoveState.moveTooltipElement.classList.toggle('display-sim-resize-tooltip-below', showTooltipBelow);
			}

			if (displayItemMoveState.xInputElement)
			{
				displayItemMoveState.xInputElement.value = `${displayLeftPercent}`;
			}

			if (displayItemMoveState.yInputElement)
			{
				displayItemMoveState.yInputElement.value = `${displayTopPercent}`;
			}
		}

		function stopDisplayItemMoveDrag(event)
		{
			if (!displayItemMoveState)
			{
				return;
			}

			if (event && displayItemMoveState.pointerId !== undefined && event.pointerId !== undefined && displayItemMoveState.pointerId !== event.pointerId)
			{
				return;
			}

			const state = displayItemMoveState;
			displayItemMoveState = null;

			window.removeEventListener('pointermove', onDisplayItemMoveDragMove);
			window.removeEventListener('pointerup', stopDisplayItemMoveDrag);
			window.removeEventListener('pointercancel', stopDisplayItemMoveDrag);
			document.body.classList.remove('display-sim-moving');
			state.itemElement.classList.remove('display-sim-item-moving');

			const finalLeftPercent = parseFloat(state.itemElement?.dataset?.leftPercent || state.xInputElement?.value || '0');
			const finalTopPercent = parseFloat(state.itemElement?.dataset?.topPercent || state.yInputElement?.value || '0');
			const safeLeftPercent = Number.isNaN(finalLeftPercent) ? 0 : Math.round(finalLeftPercent);
			const safeTopPercent = Number.isNaN(finalTopPercent) ? 0 : Math.round(finalTopPercent);

			if (state.xInputElement)
			{
				state.xInputElement.value = `${safeLeftPercent}`;
			}

			if (state.yInputElement)
			{
				state.yInputElement.value = `${safeTopPercent}`;
			}

			onDisplayLabelChange({ id: `display${state.itemNo}X`, value: '' }, state.itemNo);

			const displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];
			if (displayConfiguration && Array.isArray(displayConfiguration.items) && displayConfiguration.items[state.itemNo])
			{
				displayConfiguration.items[state.itemNo].xPos = `${safeLeftPercent}`;
				displayConfiguration.items[state.itemNo].yPos = `${safeTopPercent}`;
			}

			redisplayDisplyConfig(state.itemNo);
			if (displayPagePopupOverlayElement && displayPagePopupOverlayElement.classList.contains('visible'))
			{
				renderDisplayPagePopup();
			}
		}

		function startDisplayItemWidthDrag(event, itemNo)
		{
			if (!event)
			{
				return;
			}

			event.preventDefault();
			event.stopPropagation();

			const handleElement = event.currentTarget;
			const itemElement = handleElement ? handleElement.closest('.display-sim-item') : null;
			const surfaceElement = itemElement ? itemElement.closest('.display-sim-surface') : null;
			if (!itemElement || !surfaceElement)
			{
				return;
			}

			const surfaceRect = surfaceElement.getBoundingClientRect();
			if (!surfaceRect || surfaceRect.width <= 0)
			{
				return;
			}

			if (typeof handleElement.setPointerCapture === 'function' && event.pointerId !== undefined)
			{
				try
				{
					handleElement.setPointerCapture(event.pointerId);
				}
				catch (err)
				{
					// Ignore pointer capture errors from unsupported environments.
				}
			}

			const widthInputElement = document.getElementById(`display${itemNo}Width`);
			const widthFromInput = widthInputElement ? parseFloat(widthInputElement.value) : NaN;
			const widthFromStyle = parseFloat(itemElement.dataset.widthPercent || itemElement.style.width || '0');
			const leftPercent = parseFloat(itemElement.dataset.leftPercent || itemElement.style.left || '0') || 0;
			const initialWidthPercent = Number.isNaN(widthFromInput)
				? (Number.isNaN(widthFromStyle) ? 100 : widthFromStyle)
				: widthFromInput;
			const resizeTooltipElement = itemElement.querySelector('.display-sim-size-tooltip');
			if (resizeTooltipElement)
			{
				resizeTooltipElement.textContent = `W: ${Math.round(initialWidthPercent * 10) / 10}%`;
				const itemRect = itemElement.getBoundingClientRect();
				const itemMidpoint = itemRect.top - surfaceRect.top + (itemRect.height / 2);
				const showTooltipBelow = itemMidpoint < (surfaceRect.height / 2);
				resizeTooltipElement.classList.toggle('display-sim-resize-tooltip-below', showTooltipBelow);
			}
			itemElement.classList.add('display-sim-item-resizing');

			displayItemResizeState = {
				itemNo,
				handleElement,
				itemElement,
				surfaceElement,
				widthInputElement,
				resizeTooltipElement,
				startClientX: event.clientX,
				startWidthPercent: initialWidthPercent,
				leftPercent,
				pointerId: event.pointerId,
			};

			document.body.classList.add('display-sim-resizing');
			window.addEventListener('pointermove', onDisplayItemWidthDragMove);
			window.addEventListener('pointerup', stopDisplayItemWidthDrag);
			window.addEventListener('pointercancel', stopDisplayItemWidthDrag);
		}

		function onDisplayItemWidthDragMove(event)
		{
			if (!displayItemResizeState || !event)
			{
				return;
			}

			if (displayItemResizeState.pointerId !== undefined && event.pointerId !== undefined && displayItemResizeState.pointerId !== event.pointerId)
			{
				return;
			}

			event.preventDefault();

			const surfaceRect = displayItemResizeState.surfaceElement.getBoundingClientRect();
			if (!surfaceRect || surfaceRect.width <= 0)
			{
				return;
			}

			const deltaX = event.clientX - displayItemResizeState.startClientX;
			const deltaPercent = (deltaX / surfaceRect.width) * 100;
			const maxWidthPercent = Math.max(2, 100 - displayItemResizeState.leftPercent);
			const rawWidthPercent = Math.max(2, Math.min(maxWidthPercent, displayItemResizeState.startWidthPercent + deltaPercent));
			const newWidthPercent = Math.max(2, Math.min(maxWidthPercent, Math.round(rawWidthPercent)));

			displayItemResizeState.itemElement.style.width = `${newWidthPercent}%`;
			displayItemResizeState.itemElement.dataset.widthPercent = `${newWidthPercent}`;

			if (displayItemResizeState.widthInputElement)
			{
				displayItemResizeState.widthInputElement.value = `${newWidthPercent}`;
			}

			if (displayItemResizeState.resizeTooltipElement)
			{
				displayItemResizeState.resizeTooltipElement.textContent = `W: ${newWidthPercent}%`;
			}
		}

		function stopDisplayItemWidthDrag(event)
		{
			if (!displayItemResizeState)
			{
				return;
			}

			if (event && displayItemResizeState.pointerId !== undefined && event.pointerId !== undefined && displayItemResizeState.pointerId !== event.pointerId)
			{
				return;
			}

			const state = displayItemResizeState;
			displayItemResizeState = null;

			window.removeEventListener('pointermove', onDisplayItemWidthDragMove);
			window.removeEventListener('pointerup', stopDisplayItemWidthDrag);
			window.removeEventListener('pointercancel', stopDisplayItemWidthDrag);
			document.body.classList.remove('display-sim-resizing');
			state.itemElement.classList.remove('display-sim-item-resizing');

			const finalWidthPercent = parseFloat(state.itemElement?.dataset?.widthPercent || state.widthInputElement?.value || '100');
			const safeWidthPercent = Number.isNaN(finalWidthPercent) ? 100 : Math.max(2, Math.round(finalWidthPercent));

			if (state.widthInputElement)
			{
				state.widthInputElement.value = `${safeWidthPercent}`;
			}

			onDisplayLabelChange({ id: `display${state.itemNo}Width`, value: '' }, state.itemNo);

			const displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];
			if (displayConfiguration && Array.isArray(displayConfiguration.items) && displayConfiguration.items[state.itemNo])
			{
				displayConfiguration.items[state.itemNo].width = `${safeWidthPercent}`;
			}

			redisplayDisplyConfig(state.itemNo);
			if (displayPagePopupOverlayElement && displayPagePopupOverlayElement.classList.contains('visible'))
			{
				renderDisplayPagePopup();
			}
		}

		var lastSentIpElement = document.getElementById('sentip');
		var getLogElement = document.getElementById('getLog');
		var sentLogElement = document.getElementById('sentLog');

		// Declarations for the Display Config page

		var displayConfigurationNoElement = document.getElementById('displayConfigurationNo');
		var displayConfigNameElement = document.getElementById('displayConfigName');
		var displayConfigNameRowElement = document.getElementById('displayConfigNameRow');
		var toggleDisplayConfigNameVisibilityElement = document.getElementById('toggleDisplayConfigNameVisibility');
		var displayConfigNameCollapsed = true;
		var newDisplayItemButton = document.getElementById('newDisplayItem');

		var displayConfigurationsFetched = false;
		var localDisplayConfigurations = [];
		var currentDisplayConfigurationNo = 0;
		var displayCapabilityItems = new Map();
		var copyDisplayConfigElement = document.getElementById('copyDisplayConfig');
		var pasteDisplayConfigElement = document.getElementById('pasteDisplayConfig');

		// Declarations for the Broker Config page
		var defaultBrokerElement = document.getElementById('defaultBroker');
		var newBrokerItemButton = document.getElementById('newBrokerItem');
		var localBrokerItems = [];
		var brokerItemsFetched = false;

		var diagLogEnabledElement = document.getElementById('enableLog');
		var diagLogElement = document.getElementById('diagLog');
		var emailElement = document.getElementById('email');
		var descriptionElement = document.getElementById('description');
		var clearLogElement = document.getElementById('clearLog');
		var sendLogElement = document.getElementById('sendLog');
		var getListenersElement = document.getElementById('getListeners');

		var copyTextElement = document.getElementById('copyText');
		var importElement = document.getElementById('import');
		var exportElement = document.getElementById('export');

		var itemDisplyType = "flex";
		const MAX_SVG_FIELD_LENGTH = 3 * 1024;
		const BUTTON_MAIN_DIAGNOSTICS_ENABLED = false;
		let trimmedSVGFieldCount = 0;

		function clampSVGField(svgValue)
		{
			const value = (typeof svgValue === 'string') ? svgValue : '';
			if (value.length > MAX_SVG_FIELD_LENGTH)
			{
				trimmedSVGFieldCount++;
				// return value.substring(0, MAX_SVG_FIELD_LENGTH);
			}

			return value;
		}

		function isHomeyMobileAppRuntime()
		{
			const userAgent = (navigator && navigator.userAgent) ? navigator.userAgent.toLowerCase() : '';
			const isAndroidWebView = userAgent.includes('android') && userAgent.includes('wv');
			const coarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
			const noHover = !!(window.matchMedia && window.matchMedia('(hover: none)').matches);
			return isAndroidWebView && coarsePointer && noHover;
		}

		function escapeHtml(value)
		{
			return String(value)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#39;');
		}

		function getSvgPreviewMarkup(svgText)
		{
			const value = (typeof svgText === 'string') ? svgText.trim() : '';
			if (!value)
			{
				return '';
			}

			// Only treat real SVG markup as SVG; plain text like "19:49" must remain text.
			if (!/^<svg[\s>]/i.test(value))
			{
				return '';
			}

			return value;
		}

		function updateSvgPreview(textareaElement)
		{
			if (!textareaElement)
			{
				return;
			}

			const previewId = textareaElement.dataset.svgPreviewTarget;
			if (!previewId)
			{
				return;
			}

			const previewElement = document.getElementById(previewId);
			if (!previewElement)
			{
				return;
			}

			const svgMarkup = getSvgPreviewMarkup(textareaElement.value);
			if (!svgMarkup)
			{
				previewElement.innerHTML = '<div class="svg-preview-empty">No SVG</div>';
				return;
			}

			try
			{
				previewElement.innerHTML = svgMarkup;
				const importedSvg = previewElement.querySelector('svg');
				if (!importedSvg)
				{
					previewElement.innerHTML = '<div class="svg-preview-empty">Invalid SVG</div>';
					return;
				}

				if (!importedSvg.getAttribute('xmlns'))
				{
					importedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
				}
				if (!importedSvg.getAttribute('viewBox'))
				{
					importedSvg.setAttribute('viewBox', '0 0 13 13');
				}
				importedSvg.setAttribute('width', '50');
				importedSvg.setAttribute('height', '50');
				importedSvg.style.maxWidth = '100%';
				importedSvg.style.maxHeight = '100%';
			}
			catch (err)
			{
				previewElement.innerHTML = '<div class="svg-preview-empty">Invalid SVG</div>';
			}
		}

		function setupSvgPreviews(root = document)
		{
			if (!root || typeof root.querySelectorAll !== 'function')
			{
				return;
			}

			const textareas = Array.from(root.querySelectorAll('textarea[data-svg-preview-target]'));
			textareas.forEach((textareaElement) =>
			{
				if (textareaElement.dataset.svgPreviewBound === 'true')
				{
					updateSvgPreview(textareaElement);
					return;
				}

				textareaElement.addEventListener('input', () => updateSvgPreview(textareaElement));
				textareaElement.dataset.svgPreviewBound = 'true';
				updateSvgPreview(textareaElement);
			});
		}

		function applyDisplaySimulatorLocalization()
		{
			if (typeof Homey === 'undefined' || !Homey || typeof Homey.__ !== 'function')
			{
				return;
			}

			const setTextById = (id, key) =>
			{
				const element = document.getElementById(id);
				if (element)
				{
					element.textContent = Homey.__(`settings.${key}`);
				}
			};

			const setAttributeById = (id, attributeName, key) =>
			{
				const element = document.getElementById(id);
				if (element)
				{
					element.setAttribute(attributeName, Homey.__(`settings.${key}`));
				}
			};

			const setSelectOptions = (id, optionKeys) =>
			{
				const element = document.getElementById(id);
				if (!element || !Array.isArray(element.options))
				{
					return;
				}

				for (let index = 0; index < optionKeys.length && index < element.options.length; index++)
				{
					element.options[index].text = Homey.__(`settings.${optionKeys[index]}`);
				}
			};

			setAttributeById('displayInlineSimPrev', 'title', 'displaySimPreviousPage');
			setAttributeById('displayInlineSimPrev', 'aria-label', 'displaySimPreviousPage');
			setAttributeById('displayInlineSimNext', 'title', 'displaySimNextPage');
			setAttributeById('displayInlineSimNext', 'aria-label', 'displaySimNextPage');
			setAttributeById('displayInlineSimAddPage', 'title', 'displaySimAddPage');
			setAttributeById('displayInlineSimAddPage', 'aria-label', 'displaySimAddPage');
			setAttributeById('displayInlineSimDeletePage', 'title', 'displaySimDeletePage');
			setAttributeById('displayInlineSimDeletePage', 'aria-label', 'displaySimDeletePage');
			setAttributeById('displayInlineSimAddItem', 'title', 'displaySimAddItem');
			setAttributeById('displayInlineSimAddItem', 'aria-label', 'displaySimAddItem');
			setAttributeById('displayInlineSimDeleteItem', 'title', 'displaySimDeleteItem');
			setAttributeById('displayInlineSimDeleteItem', 'aria-label', 'displaySimDeleteItem');
			setAttributeById('displayInlineSimStatusBarPosition', 'aria-label', 'displaySimInlineStatusBarPosition');
			setAttributeById('displayInlineSimShowPageZero', 'title', 'displaySimShowDefaultItems');
			setAttributeById('displayInlineSimShowPageZero', 'aria-label', 'displaySimShowDefaultItems');

			setAttributeById('displayPagePopupPrev', 'title', 'displaySimPreviousPage');
			setAttributeById('displayPagePopupPrev', 'aria-label', 'displaySimPreviousPage');
			setAttributeById('displayPagePopupNext', 'title', 'displaySimNextPage');
			setAttributeById('displayPagePopupNext', 'aria-label', 'displaySimNextPage');
			setAttributeById('displayPagePopupStatusBarPosition', 'aria-label', 'displaySimStatusBarPosition');
			setAttributeById('displayPagePopupClose', 'title', 'displaySimClose');
			setAttributeById('displayPagePopupClose', 'aria-label', 'displaySimClose');
			setAttributeById('displayPageSimOpen', 'title', 'displaySimOpen');
			setAttributeById('displayPageSimOpen', 'aria-label', 'displaySimOpen');

			setTextById('displayFieldPopupTitle', 'displayFieldPopupTitle');
			setTextById('displayFieldPopupCancel', 'cancel');
			setTextById('displayFieldPopupSave', 'displayFieldPopupSave');

			setSelectOptions('displayInlineSimStatusBarPosition', ['displaySimOff', 'displaySimTop', 'displaySimBottom']);
			setSelectOptions('displayPagePopupStatusBarPosition', ['displaySimOff', 'displaySimTop', 'displaySimBottom']);
		}

		// a method named 'onHomeyReady' must be present in your code
		function onHomeyReady(Homey)
		{
			itemDisplyType = document.getElementById('ButtonPanelConfigurationNo').style.display;
			setupFilterableSelects();
			document.body.classList.toggle('homey-mobile-app', isHomeyMobileAppRuntime());
			applyDisplaySimulatorLocalization();

			Homey.get(CONFIG_DRAFT_STORAGE_KEY, function (err, loadedDraft)
			{
				if (!err && loadedDraft && typeof loadedDraft === 'object')
				{
					configDraftLoadedData = loadedDraft;
				}
				else
				{
					configDraftRestoreDecisionMade = true;
					enableConfigurationDraftAutoSave();
				}
				configDraftLoaded = true;
				maybeHandleLoadedConfigurationDraft();
			});


			// Read the button configuration from the settings and write the controls
			Homey.get('buttonConfigurations', function (err, buttonConfigurations)
			{
				if (err) return Homey.alert(err);
				localButtonConfigurations = buttonConfigurations;
				buttonConfigurationsFetched = true;
				console.log('buttonConfigurations: ' + JSON.stringify(buttonConfigurations));

				fillConfigListElement(buttonConfigurationNoElement, Homey.__("settings.buttonConfig"), localButtonConfigurations, MAX_BUTTON_CONFIGURATIONS);

				// Make sure currentButtonConfigurationNo is set and within range
				if (!currentButtonConfigurationNo || (currentButtonConfigurationNo >= localButtonConfigurations.length))
				{
					currentButtonConfigurationNo = 0;
				}

				// Get the current configuration
				var buttonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];

				writeButtonsections(buttonPanelConfiguration.length);
				updateButtonPanelControls();
				maybeHandleLoadedConfigurationDraft();
			});

			Homey.get('displayConfigurations', function (err, displayConfigurations)
			{
				if (err) return Homey.alert(err);
				localDisplayConfigurations = displayConfigurations;
				displayConfigurationsFetched = (localDisplayConfigurations.length > 0);

				fillConfigListElement(displayConfigurationNoElement, Homey.__("settings.displayConfig"), localDisplayConfigurations, MAX_DISPLAY_CONFIGURATIONS);

				// add the itemId and validate the page number to each item
				let displayVersion = 0;
				if (localDisplayConfigurations.length > 0)
				{
					displayVersion = localDisplayConfigurations[0].version | 0;
				}
				for (let i = 0; i < localDisplayConfigurations.length; i++)
				{
					if (!localDisplayConfigurations[i].version || localDisplayConfigurations[i].version < 2)
					{
						localDisplayConfigurations[i].version = 2;
						const displayConfiguration = localDisplayConfigurations[i];
						for (let j = 0; j < displayConfiguration.items.length; j++)
						{
							displayConfiguration.items[j].itemId = j;
							if (displayConfiguration.items[j].page === undefined)
							{
								displayConfiguration.items[j].page = 1;
							}
							else
							{
								displayConfiguration.items[j].page = parseInt(displayConfiguration.items[j].page, 10) + 1;
							}
						}
					}
				}
				normalizeDisplayConfigurationsPages(localDisplayConfigurations);

				updateDisplayConfiguration();
				maybeHandleLoadedConfigurationDraft();
			});

			getButtonList();

			getDevices();

			Homey.get('autoConfig', function (err, autoConfig)
			{
				if (err) return Homey.alert(err);
				autoConfigElement.checked = autoConfig;
				autoConfigChanged();
			});

			Homey.get('brokerConfigurationItems', function (err, brokerItems)
{
if (err) return Homey.alert(err);
brokerItemsFetched = true;
localBrokerItems = brokerItems;
maybeHandleLoadedConfigurationDraft();
});

Homey.get('displayPagePopupStatusBarPosition', function (err, savedStatusBarPosition)
{
if (err) return;
const parsedStatusBarPosition = parseInt(savedStatusBarPosition, 10);
if (!Number.isNaN(parsedStatusBarPosition))
{
displayPagePopupStatusBarPosition = Math.max(0, Math.min(parsedStatusBarPosition, 2));
}
});

autoConfigElement.addEventListener('click', function (e)
			{
				Homey.set('autoConfig', autoConfigElement.checked);
				autoConfigChanged();
			});

			diagLogEnabledElement.addEventListener('click', function (e)
			{
				Homey.set('logEnabled', diagLogEnabledElement.checked);
			});

			configTypeElement.addEventListener('change', function (e)
			{
				configTypeChanged(configTypeElement.value);
			});

			clearLogElement.addEventListener('click', function (e)
			{
				Homey.api('POST', '/clearLog/',
					{
						notify: true
					}, function (err, result)
				{
					if (err)
					{
						return Homey.alert(err);
					}
				});
			});

			openWebViewElement.addEventListener('click', function (e)
			{
				let ip = webViewIpElement.value;
				Homey.openURL(`http://${ip}`);
			});

			sendLogElement.addEventListener('click', function (e)
			{
				if (descriptionElement.value === '')
				{
					Homey.alert(Homey.__("settings.descriptionExplanation"));
					return;
				}
				Homey.confirm(Homey.__("settings.sendLogConfirm"), null, function (e, ok)
				{
					if (ok)
					{
						Homey.api('POST', '/sendlog/',
							{
								notify: true,
								email: emailElement.value,
								description: descriptionElement.value,
							}, function (err, result)
						{
							if (err)
							{
								Homey.alert(err);
							}
							else
							{
								Homey.alert(Homey.__("settings.logSent"));
							}
						});
					}
				});
			});

			getListenersElement.addEventListener('click', function (e)
			{

				Homey.api('GET', '/get_capability_listeners/', { notify: true }, function (err, result)
				{
					if (err)
					{
						Homey.alert(err);
					}
					else
					{
						// Add the listeners to the log view
						diagLogElement.value += JSON.stringify(result, null, 2);
					}
				});
			});

			getLogElement.addEventListener('click', function (e)
			{
				if (!lastSentIpElement.value)
				{
					Homey.alert('Please select a device from the list');
					return;
				}

				Homey.api('GET', `/getLog/?ip=${lastSentIpElement.value}`, { notify: true }, function (err, result)
				{
					if (err)
					{
						Homey.alert(err);
					}
					else if (result === null || result === undefined)
					{
						sentLogElement.value = 'No configuration data available for this device.\n\nConfiguration data is stored when you save a configuration to the device.\n\nDevice IP: ' + lastSentIpElement.value;
					}
					else
					{
						// Add the log to the log view
						try
						{
							// Handle both stringified JSON and objects
							const data = typeof result === 'string' ? JSON.parse(result) : result;
							sentLogElement.value = JSON.stringify(data, null, 2);
						}
						catch (parseErr)
						{
							// If parsing fails, just display the raw result
							sentLogElement.value = result.toString();
						}
					}
				});
			});

			Homey.on('com.ady.button_plus.logupdated', function (data)
			{
				diagLogElement.value = data.log;
			});

			saveButton.addEventListener('click', async function (e)
			{
				if (autoConfigElement.checked)
				{
					try
					{
						trimmedSVGFieldCount = 0;

						if (!storeBrokerSettings())
						{
							return;
						}

						await Homey.set('brokerConfigurationItems', localBrokerItems);
						await Homey.set('defaultBroker', defaultBrokerElement.value);

						// Store the current button configuration
						var buttonPanelConfigurationNo = buttonConfigurationNoElement.value;
						var ButtonPanelConfiguration = localButtonConfigurations[buttonPanelConfigurationNo];

						if (!Array.isArray(ButtonPanelConfiguration) || ButtonPanelConfiguration.length === 0)
						{
							throw new Error('Invalid button configuration selected');
						}

						storeButtonSettings(ButtonPanelConfiguration);

						await Homey.set('buttonConfigurations', localButtonConfigurations);

						//Copy the values from the controls to the displayConfiguration
						storeDisplaySettings();
						await Homey.set('displayConfigurations', localDisplayConfigurations);
						await Homey.set(CONFIG_DRAFT_STORAGE_KEY, null);

						Homey.api('POST', '/settings_changed/', {}, function (err, variables)
						{
							if (err) return Homey.alert(err);

							if (trimmedSVGFieldCount > 0)
							{
								Homey.alert(`${Homey.__("settings.saved")}\n\nWarning: ${trimmedSVGFieldCount} SVG field(s) exceeded ${MAX_SVG_FIELD_LENGTH} characters and might be too big.`);
							}
							else
							{
								Homey.alert(Homey.__("settings.saved"));
							}
						});
					}
					catch (saveError)
					{
						Homey.alert(`Save failed: ${saveError && saveError.message ? saveError.message : saveError}`);
					}

				}
			});

			function storeButtonSettings(ButtonPanelConfiguration)
			{
				// Store the configuration name
				ButtonPanelConfiguration[0].name = configNameElement.value;

				for (page = 0; page < ButtonPanelConfiguration.length; page++)
				{
					ButtonPanelConfiguration[page].PageNum = page;

					// Copy the values from the controls for each page to the displayConfiguration page
					storeButtonSettingsSection('left', page, ButtonPanelConfiguration[page]);
					storeButtonSettingsSection('right', page, ButtonPanelConfiguration[page]);
				}
			}

			configDraftStoreButtonSettingsFn = storeButtonSettings;

			function storeButtonSettingsSection(side, page, ButtonPanelConfiguration)
			{
				var topTextElement = document.getElementById(`${side}${page}TopText`);
				var onTextElement = document.getElementById(`${side}${page}OnText`);
				var offTextElement = document.getElementById(`${side}${page}OffText`);
				var dimChangeElement = document.getElementById(`${side}${page}DimChange`);
				var pageNumElement = document.getElementById(`${side}${page}PageNum`);
				var deviceElement = document.getElementById(`${side}${page}Device`);
				var capabilityElement = document.getElementById(`${side}${page}Capability`);
				var brokerIdElement = document.getElementById(`${side}${page}BrokerId`);
				var newCustomMQTTItemButton = document.getElementById(`new${side}${page}CustomMQTTItem`);
				var frontLEDOnColorElement = document.getElementById(`${side}${page}FrontLEDOnColor`);
				var wallLEDOnColorElement = document.getElementById(`${side}${page}WallLEDOnColor`);
				var frontLEDOffColorElement = document.getElementById(`${side}${page}FrontLEDOffColor`);
				var wallLEDOffColorElement = document.getElementById(`${side}${page}WallLEDOffColor`);
				var longRepeatElement = document.getElementById(`${side}${page}DisableLongRepeat`);
				var OnSVGElement = document.getElementById(`${side}${page}OnSVG`);
				var OffSVGElement = document.getElementById(`${side}${page}OffSVG`);

				if (capabilityElement.value === 'dim')
				{
					const dimVal = parseInt(dimChangeElement.value, 10);
					if (dimVal < -100 || dimVal > 100 || dimVal === 0)
					{
						Homey.alert(Homey.__("settings.dimError", { leftRight: Homey.__(`settings.${side}Panel`) }));
						return;
					}
				}

				storeCustomMQTTItems(side, ButtonPanelConfiguration);
				storeCustomMQTTItems(side, ButtonPanelConfiguration);

				// Copy the values from the controls to the buttonConfiguration
				ButtonPanelConfiguration[`${side}TopText`] = topTextElement.value;
				ButtonPanelConfiguration[`${side}OnText`] = onTextElement.value;
				ButtonPanelConfiguration[`${side}OffText`] = offTextElement.value;
				ButtonPanelConfiguration[`${side}Device`] = deviceElement.value;

				if (deviceElement.selectedIndex >= 0)
				{
					ButtonPanelConfiguration[`${side}DeviceName`] = deviceElement.options && deviceElement.options[deviceElement.selectedIndex] ? deviceElement.options[deviceElement.selectedIndex].text : deviceElement.value;
				}
				else
				{
					ButtonPanelConfiguration[`${side}DeviceName`] = deviceElement.value;
				}

				// Remove any leading spaces from the device name
				ButtonPanelConfiguration[`${side}DeviceName`] = ButtonPanelConfiguration[`${side}DeviceName`].trim();

				// Remove all occurrences of ' (Missing Devices)' from the capability name
				ButtonPanelConfiguration[`${side}DeviceName`] = ButtonPanelConfiguration[`${side}DeviceName`].replace(/ \(Missing Devices\)/g, '');

				ButtonPanelConfiguration[`${side}Capability`] = capabilityElement.value;
				if (capabilityElement.selectedIndex >= 0)
				{
					ButtonPanelConfiguration[`${side}CapabilityName`] = capabilityElement.options && capabilityElement.options[capabilityElement.selectedIndex] ? capabilityElement.options[capabilityElement.selectedIndex].text : capabilityElement.value;
				}
				else
				{
					ButtonPanelConfiguration[`${side}CapabilityName`] = capabilityElement.value;
				}

				// Remove ' (Missing)' from the capability name
				ButtonPanelConfiguration[`${side}CapabilityName`] = ButtonPanelConfiguration[`${side}CapabilityName`].replace(/ \(Missing\)/g, '');

				ButtonPanelConfiguration[`${side}BrokerId`] = brokerIdElement.value;
				ButtonPanelConfiguration[`${side}DimChange`] = dimChangeElement.value;
				ButtonPanelConfiguration[`${side}FrontLEDOnColor`] = frontLEDOnColorElement.value;
				ButtonPanelConfiguration[`${side}WallLEDOnColor`] = wallLEDOnColorElement.value;
				ButtonPanelConfiguration[`${side}FrontLEDOffColor`] = frontLEDOffColorElement.value;
				ButtonPanelConfiguration[`${side}WallLEDOffColor`] = wallLEDOffColorElement.value;
				ButtonPanelConfiguration[`${side}DisableLongRepeat`] = !longRepeatElement.checked;
				ButtonPanelConfiguration[`${side}OnSVG`] = clampSVGField(OnSVGElement?.value || '');
				ButtonPanelConfiguration[`${side}OffSVG`] = clampSVGField(OffSVGElement?.value || '');
			};

			buttonConfigurationNoElement.addEventListener('change', function (e)
			{
				// Store the current configuration
				var buttonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];
				storeButtonSettings(buttonPanelConfiguration);

				currentButtonConfigurationNo = buttonConfigurationNoElement.value;

				// Make sure currentButtonConfigurationNo is set and within range
				if (!currentButtonConfigurationNo || (currentButtonConfigurationNo >= localButtonConfigurations.length))
				{
					currentButtonConfigurationNo = 0;
				}

				// Get the current configuration
				var buttonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];

				writeButtonsections(buttonPanelConfiguration.length);
				updateButtonPanelControls();
				updateButtonMainDiagnostics('buttonConfigurationNo:change');
			});

			if (toggleConfigNameVisibilityElement)
			{
				toggleConfigNameVisibilityElement.addEventListener('click', function ()
				{
					panelConfigNameCollapsed = !panelConfigNameCollapsed;
					if (configNameRowElement)
					{
						configNameRowElement.style.display = panelConfigNameCollapsed ? 'none' : 'block';
					}

					toggleConfigNameVisibilityElement.classList.toggle('is-open', !panelConfigNameCollapsed);
					toggleConfigNameVisibilityElement.title = panelConfigNameCollapsed ? 'Show configuration name' : 'Hide configuration name';
					toggleConfigNameVisibilityElement.setAttribute('aria-label', toggleConfigNameVisibilityElement.title);
				});

				toggleConfigNameVisibilityElement.classList.toggle('is-open', !panelConfigNameCollapsed);
				toggleConfigNameVisibilityElement.title = panelConfigNameCollapsed ? 'Show configuration name' : 'Hide configuration name';
				toggleConfigNameVisibilityElement.setAttribute('aria-label', toggleConfigNameVisibilityElement.title);
				if (configNameRowElement)
				{
					configNameRowElement.style.display = panelConfigNameCollapsed ? 'none' : 'block';
				}
			}

			if (toggleDisplayConfigNameVisibilityElement)
			{
				toggleDisplayConfigNameVisibilityElement.addEventListener('click', function ()
				{
					displayConfigNameCollapsed = !displayConfigNameCollapsed;
					if (displayConfigNameRowElement)
					{
						displayConfigNameRowElement.style.display = displayConfigNameCollapsed ? 'none' : 'block';
					}

					toggleDisplayConfigNameVisibilityElement.classList.toggle('is-open', !displayConfigNameCollapsed);
					toggleDisplayConfigNameVisibilityElement.title = displayConfigNameCollapsed ? 'Show configuration name' : 'Hide configuration name';
					toggleDisplayConfigNameVisibilityElement.setAttribute('aria-label', toggleDisplayConfigNameVisibilityElement.title);
				});

				toggleDisplayConfigNameVisibilityElement.classList.toggle('is-open', !displayConfigNameCollapsed);
				toggleDisplayConfigNameVisibilityElement.title = displayConfigNameCollapsed ? 'Show configuration name' : 'Hide configuration name';
				toggleDisplayConfigNameVisibilityElement.setAttribute('aria-label', toggleDisplayConfigNameVisibilityElement.title);
				if (displayConfigNameRowElement)
				{
					displayConfigNameRowElement.style.display = displayConfigNameCollapsed ? 'none' : 'block';
				}
			}

			displayConfigNameElement.addEventListener('change', function (e)
			{
				var DisplayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];
				DisplayConfiguration.name = displayConfigNameElement.value;

				// Update the configuration list
				let txt = Homey.__("settings.displayConfig");
				var option = displayConfigurationNoElement.options[displayConfigurationNoElement.selectedIndex];
				option.text = `${txt} ${parseInt(currentDisplayConfigurationNo, 10) + 1} - ${displayConfigNameElement.value}`
			});

			// Display Config code

			displayConfigurationNoElement.addEventListener('change', function (e)
			{
				redisplayDisplyConfig();
			});

			copyButtonConfigElement.addEventListener('click', function (e)
			{
				try
				{
					// Copy the current button configuration to the clipboard in JSON format
					var buttonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];
					var copy = {};
					copy.copySource = "ButtonPanel";
					copy.butons = buttonPanelConfiguration;
					const jsonString = JSON.stringify(copy, null, 2);

					copyTextElement.value = jsonString;

					// Notify the user
					Homey.alert(Homey.__("settings.copied"));
				}
				catch (err)
				{
					Homey.alert(Homey.__("settings.clipboardError", { error: err }));
				}
			});

			pasteButtonConfigElement.addEventListener('click', function (e)
			{
				try
				{
					// Parse the JSON string
					const copy = JSON.parse(copyTextElement.value);
					if (copy.copySource !== "ButtonPanel")
					{
						Homey.alert(Homey.__("settings.clipboardError", { error: "Invalid source" }));
						return;
					}

					let buttonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];
					let newButtonPanelConfiguration = copy.butons;

					for (let page = 0; page < newButtonPanelConfiguration.length; page++)
					{
						// if the page doesn't exist, add it
						if (!buttonPanelConfiguration[page])
						{
							buttonPanelConfiguration[page] = {};
						}

						// Copy the values from the new configuration to the current configuration
						buttonPanelConfiguration[page].PageNum = page;

						if (newButtonPanelConfiguration[page].leftTopText !== undefined) buttonPanelConfiguration[page].leftTopText = newButtonPanelConfiguration[page].leftTopText;
						if (newButtonPanelConfiguration[page].leftOnText !== undefined) buttonPanelConfiguration[page].leftOnText = newButtonPanelConfiguration[page].leftOnText;
						if (newButtonPanelConfiguration[page].leftOffText !== undefined) buttonPanelConfiguration[page].leftOffText = newButtonPanelConfiguration[page].leftOffText;
						if (newButtonPanelConfiguration[page].leftDevice !== undefined) buttonPanelConfiguration[page].leftDevice = newButtonPanelConfiguration[page].leftDevice;
						if (newButtonPanelConfiguration[page].leftDeviceName !== undefined) buttonPanelConfiguration[page].leftDeviceName = newButtonPanelConfiguration[page].leftDeviceName;
						if (newButtonPanelConfiguration[page].leftCapability !== undefined) buttonPanelConfiguration[page].leftCapability = newButtonPanelConfiguration[page].leftCapability;
						if (newButtonPanelConfiguration[page].leftCapabilityName !== undefined) buttonPanelConfiguration[page].leftCapabilityName = newButtonPanelConfiguration[page].leftCapabilityName;
						if (newButtonPanelConfiguration[page].leftBrokerId !== undefined) buttonPanelConfiguration[page].leftBrokerId = newButtonPanelConfiguration[page].leftBrokerId;
						if (newButtonPanelConfiguration[page].leftDimChange !== undefined) buttonPanelConfiguration[page].leftDimChange = newButtonPanelConfiguration[page].leftDimChange;
						if (newButtonPanelConfiguration[page].leftFrontLEDOnColor !== undefined) buttonPanelConfiguration[page].leftFrontLEDOnColor = newButtonPanelConfiguration[page].leftFrontLEDOnColor;
						if (newButtonPanelConfiguration[page].leftWallLEDOnColor !== undefined) buttonPanelConfiguration[page].leftWallLEDOnColor = newButtonPanelConfiguration[page].leftWallLEDOnColor;
						if (newButtonPanelConfiguration[page].leftFrontLEDOffColor !== undefined) buttonPanelConfiguration[page].leftFrontLEDOffColor = newButtonPanelConfiguration[page].leftFrontLEDOffColor;
						if (newButtonPanelConfiguration[page].leftWallLEDOffColor !== undefined) buttonPanelConfiguration[page].leftWallLEDOffColor = newButtonPanelConfiguration[page].leftWallLEDOffColor;
						if (newButtonPanelConfiguration[page].leftCustomMQTTTopics !== undefined) buttonPanelConfiguration[page].leftCustomMQTTTopics = newButtonPanelConfiguration[page].leftCustomMQTTTopics;
						if (newButtonPanelConfiguration[page].leftDisableLongRepeat !== undefined) buttonPanelConfiguration[page].leftDisableLongRepeat = newButtonPanelConfiguration[page].leftDisableLongRepeat;

						if (newButtonPanelConfiguration[page].rightTopText !== undefined) buttonPanelConfiguration[page].rightTopText = newButtonPanelConfiguration[page].rightTopText;
						if (newButtonPanelConfiguration[page].rightOnText !== undefined) buttonPanelConfiguration[page].rightOnText = newButtonPanelConfiguration[page].rightOnText;
						if (newButtonPanelConfiguration[page].rightOffText !== undefined) buttonPanelConfiguration[page].rightOffText = newButtonPanelConfiguration[page].rightOffText;
						if (newButtonPanelConfiguration[page].rightDevice !== undefined) buttonPanelConfiguration[page].rightDevice = newButtonPanelConfiguration[page].rightDevice;
						if (newButtonPanelConfiguration[page].rightDeviceName !== undefined) buttonPanelConfiguration[page].rightDeviceName = newButtonPanelConfiguration[page].rightDeviceName;
						if (newButtonPanelConfiguration[page].rightCapability !== undefined) buttonPanelConfiguration[page].rightCapability = newButtonPanelConfiguration[page].rightCapability;
						if (newButtonPanelConfiguration[page].rightCapabilityName !== undefined) buttonPanelConfiguration[page].rightCapabilityName = newButtonPanelConfiguration[page].rightCapabilityName;
						if (newButtonPanelConfiguration[page].rightBrokerId !== undefined) buttonPanelConfiguration[page].rightBrokerId = newButtonPanelConfiguration[page].rightBrokerId;
						if (newButtonPanelConfiguration[page].rightDimChange !== undefined) buttonPanelConfiguration[page].rightDimChange = newButtonPanelConfiguration[page].rightDimChange;
						if (newButtonPanelConfiguration[page].rightFrontLEDOnColor !== undefined) buttonPanelConfiguration[page].rightFrontLEDOnColor = newButtonPanelConfiguration[page].rightFrontLEDOnColor;
						if (newButtonPanelConfiguration[page].rightWallLEDOnColor !== undefined) buttonPanelConfiguration[page].rightWallLEDOnColor = newButtonPanelConfiguration[page].rightWallLEDOnColor;
						if (newButtonPanelConfiguration[page].rightFrontLEDOffColor !== undefined) buttonPanelConfiguration[page].rightFrontLEDOffColor = newButtonPanelConfiguration[page].rightFrontLEDOffColor;
						if (newButtonPanelConfiguration[page].rightWallLEDOffColor !== undefined) buttonPanelConfiguration[page].rightWallLEDOffColor = newButtonPanelConfiguration[page].rightWallLEDOffColor;
						if (newButtonPanelConfiguration[page].rightCustomMQTTTopics !== undefined) buttonPanelConfiguration[page].rightCustomMQTTTopics = newButtonPanelConfiguration[page].rightCustomMQTTTopics;
						if (newButtonPanelConfiguration[page].rightLongRepeat !== undefined) buttonPanelConfiguration[page].rightLongRepeat = newButtonPanelConfiguration[page].rightLongRepeat;
					}
					// Update the controls
					writeButtonsections(buttonPanelConfiguration.length);
					updateButtonPanelControls();
				}
				catch (err)
				{
					Homey.alert(Homey.__("settings.clipboardError", { error: err }));
				}
			});

			copyDisplayConfigElement.addEventListener('click', function (e)
			{
				try
				{
					// Copy the current button configuration to the clipboard in JSON format
					var displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];
					displayConfiguration.copySource = "Display";
					const jsonString = JSON.stringify(displayConfiguration, null, 2);

					copyTextElement.value = jsonString;

					// Notify the user
					Homey.alert(Homey.__("settings.copied"));
				}
				catch (err)
				{
					Homey.alert(Homey.__("settings.clipboardError", { error: err }));
				}
			});

			pasteDisplayConfigElement.addEventListener('click', function (e)
			{
				try
				{
					// Parse the JSON string
					const newDisplayConfiguration = JSON.parse(copyTextElement.value);
					if (newDisplayConfiguration.copySource !== "Display")
					{
						Homey.alert(Homey.__("settings.clipboardError", { error: "Invalid source" }));
						return;
					}

					let displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];

					// Copy the values from the new configuration to the current configuration
					displayConfiguration.items = newDisplayConfiguration.items;

					// Update the controls
					updateDisplayConfiguration();
				}
				catch (err)
				{
					Homey.alert(Homey.__("settings.clipboardError", { error: err }));
				}
			});

			// Import button click handler
			importElement.addEventListener('click', function (e)
			{
				try
				{
					// Parse the JSON string
					const newConfigurations = JSON.parse(copyTextElement.value);

					if (newConfigurations.copySource !== "Export")
					{
						Homey.alert(Homey.__("settings.clipboardError", { error: "Invalid source" }));
						return;
					}

					// Copy the values from the new configuration to the current configuration
					localButtonConfigurations = newConfigurations.buttonConfigurations;
					localDisplayConfigurations = newConfigurations.displayConfigurations;
					localBrokerItems = newConfigurations.brokerItems;

					// replace the imported Homey broker IP with the current Homey IP
					for (let i = 0; i < localBrokerItems.length; i++)
					{
						if (localBrokerItems[i].brokerid === 'homey')
						{
							// extract the ip address from the host url which is in the form '192-168-1-32.homey.homeylocal.com'
							let ip = window.location.hostname.replace(/-/g, '.').replace('.homey.homeylocal.com', '');

							// url will be 'mqtt://homeyip'
							localBrokerItems[i].url = `mqtt://${ip}`;
							break;
						}
					}

					// If the imported version is less than 2 (or doesn't exist), increment all the display page numbers by 1
					for (let i = 0; i < localDisplayConfigurations.length; i++)
					{
						if (localDisplayConfigurations[i].version < 2 || localDisplayConfigurations[i].version === undefined)
						{
							for (let j = 0; j < localDisplayConfigurations[i].items.length; j++)
							{
								let page = parseInt(localDisplayConfigurations[i].items[j].page, 10) + 1;
								localDisplayConfigurations[i].items[j].page = `${page}`;
							}

							localDisplayConfigurations[i].version = 2;
						}
					}

					// Update the controls
					// Get the current configuration
					var buttonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];

					// Make sure currentButtonConfigurationNo is an array
					if (!Array.isArray(buttonPanelConfiguration))
					{
						buttonPanelConfiguration = [buttonPanelConfiguration];
						localButtonConfigurations[currentButtonConfigurationNo] = buttonPanelConfiguration;
					}

					writeButtonsections(buttonPanelConfiguration.length);
					updateDisplayConfiguration();
					updateButtonPanelControls();
					drawBrokerItems();

					// Notify the user
					Homey.alert(Homey.__("settings.imported"));
				}
				catch (err)
				{
					Homey.alert(Homey.__("settings.clipboardError", { error: err }));
				}
			});

			// Export button click handler
			exportElement.addEventListener('click', function (e)
			{
				try
				{
					// Copy the current configurations to the clipboard in JSON format
					const jsonString = JSON.stringify(
						{
							copySource: "Export",
							buttonConfigurations: localButtonConfigurations,
							displayConfigurations: localDisplayConfigurations,
							brokerItems: localBrokerItems,
						}, null, 2);

					copyTextElement.value = jsonString;

					// Notify the user
					Homey.alert(Homey.__("settings.exported"));
				}
				catch (err)
				{
					Homey.alert(Homey.__("settings.clipboardError", { error: err }));
				}
			});

			if (newDisplayItemButton)
			{
				newDisplayItemButton.addEventListener('click', function (e)
				{
					addDisplayItem();
				});
			}

			// newLeftCustomMQTTItemButton.addEventListener('click', function (e)
			// {
			// 	var ButtonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];
			// 	if (ButtonPanelConfiguration)
			// 	{
			// 		storeCustomMQTTItems("left", ButtonPanelConfiguration);

			// 		var customMQTTItem = {
			// 			id: '',
			// 			type: 0,
			// 			topic: "",
			// 			payload: "",
			// 			brokerId: 'Default',
			// 			enable: true,
			// 		};

			// 		ButtonPanelConfiguration.leftCustomMQTTTopics.push(customMQTTItem);
			// 		drawCustomMQTTTopics("left", ButtonPanelConfiguration);
			// 	}
			// });

			// newRightCustomMQTTItemButton.addEventListener('click', function (e)
			// {
			// 	var ButtonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];
			// 	if (ButtonPanelConfiguration)
			// 	{
			// 		storeCustomMQTTItems("right", ButtonPanelConfiguration);
			// 		var customMQTTItem = {
			// 			id: '',
			// 			type: 0,
			// 			topic: "",
			// 			payload: "",
			// 			brokerId: 'Default',
			// 			enable: true,
			// 		};

			// 		ButtonPanelConfiguration.rightCustomMQTTTopics.push(customMQTTItem);
			// 		drawCustomMQTTTopics("right", ButtonPanelConfiguration);
			// 	}
			// });

			newBrokerItemButton.addEventListener('click', function (e)
			{
				// Create a new broker item
				var brokerItem = {
					brokerid: "Unnamed",
					url: "",
					port: 1883,
					wsPort: 9001,
					enabled: true,
					protected: false,
				};

				// Add the new broker to the local broker list
				localBrokerItems.push(brokerItem);

				// Add the broker to the broker lists
				addBrokerToConfig(brokerItem);

				// Redraw the broker items
				drawBrokerItems();
			});

			if (!window.tooltipHoverListenerBound)
			{
				document.addEventListener('mouseover', function (event)
				{
					const tooltipTrigger = event.target.closest('.tooltip');
					if (!tooltipTrigger)
					{
						return;
					}

					if (event.relatedTarget && tooltipTrigger.contains(event.relatedTarget))
					{
						return;
					}

					suppressNativeTooltipTitles(tooltipTrigger);
					position_tooltip.call(tooltipTrigger);
				});

				document.addEventListener('mouseout', function (event)
				{
					const tooltipTrigger = event.target.closest('.tooltip');
					if (!tooltipTrigger)
					{
						return;
					}

					if (event.relatedTarget && tooltipTrigger.contains(event.relatedTarget))
					{
						return;
					}

					restoreNativeTooltipTitles(tooltipTrigger);
				});

				window.tooltipHoverListenerBound = true;
			}

			if (buttonPagePopupCloseElement)
			{
				buttonPagePopupCloseElement.addEventListener('click', closeButtonPagePopup);
			}

			if (buttonFieldPopupCancelElement)
			{
				buttonFieldPopupCancelElement.addEventListener('click', closeButtonFieldPopup);
			}

			if (buttonFieldPopupSaveElement)
			{
				buttonFieldPopupSaveElement.addEventListener('click', saveButtonFieldPopup);
			}

			if (displayFieldPopupCancelElement)
			{
				displayFieldPopupCancelElement.addEventListener('click', closeDisplayFieldPopup);
			}

			if (displayFieldPopupSaveElement)
			{
				displayFieldPopupSaveElement.addEventListener('click', saveDisplayFieldPopup);
			}

			if (buttonPagePopupStateToggleElement)
			{
				buttonPagePopupStateToggleElement.addEventListener('click', function ()
				{
					buttonPagePopupLedState = (buttonPagePopupLedState === 'on') ? 'off' : 'on';
					renderButtonPagePopup();
				});
			}

			if (buttonPagePopupPrevElement)
			{
				buttonPagePopupPrevElement.addEventListener('click', function ()
				{
					stepButtonPagePopup(-1);
				});
			}

			if (buttonPagePopupNextElement)
			{
				buttonPagePopupNextElement.addEventListener('click', function ()
				{
					stepButtonPagePopup(1);
				});
			}

			if (displayPagePopupOpenElement)
			{
				displayPagePopupOpenElement.addEventListener('click', function ()
				{
					openDisplayPagePopup(displayPagePopupCurrentPage);
				});
			}

			if (displayPagePopupCloseElement)
			{
				displayPagePopupCloseElement.addEventListener('click', closeDisplayPagePopup);
			}

			if (displayPagePopupPrevElement)
			{
				displayPagePopupPrevElement.addEventListener('click', function ()
				{
					stepDisplayPagePopup(-1);
				});
			}

			if (displayPagePopupNextElement)
			{
				displayPagePopupNextElement.addEventListener('click', function ()
				{
					stepDisplayPagePopup(1);
				});
			}

			if (displayInlineSimPrevElement)
			{
				displayInlineSimPrevElement.addEventListener('click', function ()
				{
					stepDisplayPagePopup(-1);
					renderDisplayInlineSimulator();
				});
			}

			if (displayInlineSimNextElement)
			{
				displayInlineSimNextElement.addEventListener('click', function ()
				{
					stepDisplayPagePopup(1);
					renderDisplayInlineSimulator();
				});
			}

			if (displayInlineSimStatusBarPositionElement)
			{
				displayInlineSimStatusBarPositionElement.addEventListener('change', function ()
				{
					const selectedStatusBarPosition = parseInt(this.value, 10) || 0;
					displayPagePopupStatusBarPosition = selectedStatusBarPosition;
					Homey.set('displayPagePopupStatusBarPosition', selectedStatusBarPosition);

					const displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];
					if (displayConfiguration && Array.isArray(displayConfiguration.items))
					{
						for (const item of displayConfiguration.items)
						{
							const itemPage = parseInt(item.page, 10) || 0;
							if (itemPage === displayPagePopupCurrentPage)
							{
								item.statusBarPosition = selectedStatusBarPosition;
							}
						}
					}

					renderDisplayInlineSimulator();
					if (displayPagePopupOverlayElement && displayPagePopupOverlayElement.classList.contains('visible'))
					{
						renderDisplayPagePopup();
					}
				});
			}

			if (displayInlineSimAddPageElement)
			{
				displayInlineSimAddPageElement.addEventListener('click', function ()
				{
					addDisplayPage();
				});
			}

			if (displayInlineSimDeletePageElement)
			{
				displayInlineSimDeletePageElement.addEventListener('click', function ()
				{
					deleteCurrentDisplayPage();
				});
			}

			if (displayInlineSimAddItemElement)
			{
				displayInlineSimAddItemElement.addEventListener('click', function ()
				{
					addDisplayItem();
					renderDisplayInlineSimulator();
				});
			}

			if (displayInlineSimDeleteItemElement)
			{
				displayInlineSimDeleteItemElement.addEventListener('click', function ()
				{
					deleteSelectedInlineDisplayItem();
				});
			}

			if (displayInlineSimShowPageZeroElement)
			{
				displayInlineSimShowPageZeroElement.addEventListener('change', function ()
				{
					renderDisplayInlineSimulator();
					if (displayPagePopupOverlayElement && displayPagePopupOverlayElement.classList.contains('visible'))
					{
						renderDisplayPagePopup();
					}
					refreshDisplayPopupLiveValues();
				});
			}

			if (displayInlineSimSurfaceElement)
			{
				displayInlineSimSurfaceElement.addEventListener('click', handleDisplaySurfaceBackgroundClick);
			}

			if (displayPagePopupSurfaceElement)
			{
				displayPagePopupSurfaceElement.addEventListener('click', handleDisplaySurfaceBackgroundClick);
			}

			const refreshButtonPagePopupFromControl = function (event)
			{
				const target = event.target;
				if (!target || !target.id)
				{
					return;
				}

				const pageNumMatch = target.id.match(/^(\d+)PageNum$/);
				if (pageNumMatch)
				{
					const pageIndex = parseInt(pageNumMatch[1], 10);
					if (!Number.isNaN(pageIndex) && pageIndex !== buttonPagePopupCurrentPage)
					{
						buttonPagePopupCurrentPage = pageIndex;
					}
					renderInlineButtonPagePreview(pageIndex);
					if (buttonPagePopupOverlayElement && buttonPagePopupOverlayElement.classList.contains('visible'))
					{
						renderButtonPagePopup();
					}
					return;
				}

				const match = target.id.match(/^(left|right)(\d+)(TopText|OnText|OffText|OnSVG|OffSVG|FrontLEDOnColor|WallLEDOnColor|FrontLEDOffColor|WallLEDOffColor)$/);
				if (!match)
				{
					return;
				}

				const pageIndex = parseInt(match[2], 10);
				const fieldSuffix = match[3];
				if (/On(Text|SVG)|OnColor$/.test(fieldSuffix))
				{
					buttonPagePopupLedState = 'on';
				}
				else if (/Off(Text|SVG)|OffColor$/.test(fieldSuffix))
				{
					buttonPagePopupLedState = 'off';
				}

				if (pageIndex !== buttonPagePopupCurrentPage)
				{
					buttonPagePopupCurrentPage = pageIndex;
				}

				renderInlineButtonPagePreview(pageIndex);

				if (buttonPagePopupOverlayElement && buttonPagePopupOverlayElement.classList.contains('visible'))
				{
					renderButtonPagePopup();
				}
			};

			const refreshDisplayPagePopupFromControl = function (event)
			{
				const target = event.target;
				if (!target || !target.id)
				{
					return;
				}

				if (target.id === 'displayConfigurationNo')
				{
					renderDisplayInlineSimulator();
					renderDisplayPagePopup();
					return;
				}

				const match = target.id.match(/^display(\d+)(Label|Text|X|Y|Width|FontSize|BoxType|SVG|page|Device|Capability|Unit|Rounding)$/);
				if (!match)
				{
					return;
				}

				if (match[2] === 'page')
				{
					const pageValue = parseInt(target.value, 10);
					if (!Number.isNaN(pageValue) && pageValue >= 0)
					{
						displayPagePopupCurrentPage = pageValue;
					}
				}

				renderDisplayPagePopup();
				renderDisplayInlineSimulator();

				if (match[2] === 'Device' || match[2] === 'Capability' || match[2] === 'Unit' || match[2] === 'Rounding' || match[2] === 'page')
				{
					refreshDisplayPopupLiveValues();
				}
			};

			document.addEventListener('input', refreshButtonPagePopupFromControl);
			document.addEventListener('change', refreshButtonPagePopupFromControl);
			document.addEventListener('input', refreshDisplayPagePopupFromControl);
			document.addEventListener('change', refreshDisplayPagePopupFromControl);

			const draftEventHandler = function (event)
			{
				if (isDraftRelevantEventTarget(event.target))
				{
					if (event.type === 'input')
					{
						scheduleConfigurationDraftPersist();
					}
					else
					{
						flushConfigurationDraftPersist();
					}
				}
			};
			document.addEventListener('input', draftEventHandler);
			document.addEventListener('change', draftEventHandler);
			document.addEventListener('click', draftEventHandler);
			window.addEventListener('beforeunload', flushConfigurationDraftPersist);
			window.addEventListener('pagehide', flushConfigurationDraftPersist);
			document.addEventListener('visibilitychange', function ()
			{
				if (document.visibilityState === 'hidden')
				{
					flushConfigurationDraftPersist();
				}
			});

			document.addEventListener('focusin', function (event)
			{
				const target = event.target;
				if (!target || !target.id)
				{
					return;
				}

				const pageNumMatch = target.id.match(/^(\d+)PageNum$/);
				if (pageNumMatch)
				{
					const pageIndex = parseInt(pageNumMatch[1], 10);
					if (!Number.isNaN(pageIndex) && pageIndex !== buttonPagePopupCurrentPage)
					{
						buttonPagePopupCurrentPage = pageIndex;
					}
					if (buttonPagePopupOverlayElement && buttonPagePopupOverlayElement.classList.contains('visible'))
					{
						renderButtonPagePopup();
					}
					return;
				}

				if (!buttonPagePopupOverlayElement || !buttonPagePopupOverlayElement.classList.contains('visible'))
				{
					return;
				}

				const match = target.id.match(/^(left|right)(\d+)(TopText|OnText|OffText|OnSVG|OffSVG|FrontLEDOnColor|WallLEDOnColor|FrontLEDOffColor|WallLEDOffColor)$/);
				if (!match)
				{
					return;
				}

				const pageIndex = parseInt(match[2], 10);
				const fieldSuffix = match[3];
				if (/On(Text|SVG)|OnColor$/.test(fieldSuffix))
				{
					buttonPagePopupLedState = 'on';
				}
				else if (/Off(Text|SVG)|OffColor$/.test(fieldSuffix))
				{
					buttonPagePopupLedState = 'off';
				}

				if (pageIndex !== buttonPagePopupCurrentPage)
				{
					buttonPagePopupCurrentPage = pageIndex;
				}

				renderButtonPagePopup();
			});

			document.addEventListener('keydown', function (event)
			{
				if (event.key === 'Escape')
				{
					closeButtonFieldPopup();
					closeDisplayFieldPopup();
					closeButtonPagePopup();
					closeDisplayPagePopup();
				}
			});

			if (!window.buttonMainDiagnosticsErrorHandlersBound)
			{
				window.addEventListener('error', function (event)
				{
					console.error('[ButtonMainDiagnostics][window.error]', {
						message: event.message,
						filename: event.filename,
						lineno: event.lineno,
						colno: event.colno,
						error: event.error,
					});
					updateButtonMainDiagnostics('window:error', { message: event.message, lineno: event.lineno, colno: event.colno });
				});

				window.addEventListener('unhandledrejection', function (event)
				{
					console.error('[ButtonMainDiagnostics][unhandledrejection]', {
						reason: event.reason,
					});
					updateButtonMainDiagnostics('window:unhandledrejection', { reason: String(event.reason) });
				});

				window.buttonMainDiagnosticsErrorHandlersBound = true;
			}

			// Tell Homey we're ready to be displayed
			Homey.ready();

			configTypeChanged('settings');
			updateButtonMainDiagnostics('onHomeyReady:complete');
		}

		function position_tooltip()
		{
			// Get tooltip text in the hovered tooltip trigger.
			var tooltip = this.querySelector(".tooltiptext");
			if (!tooltip)
			{
				return;
			}

			const margin = 10;

			// Reset to the baseline position before re-measuring.
			tooltip.style.left = '-100%';

			// Get tooltip coordinates and size
			var tooltip_rect = tooltip.getBoundingClientRect();
			let correction = 0;
			const viewportWidth = document.documentElement.clientWidth;

			if (tooltip_rect.right > (viewportWidth - margin))
			{
				correction -= (tooltip_rect.right - (viewportWidth - margin));
			}

			if ((tooltip_rect.left + correction) < margin)
			{
				correction += (margin - (tooltip_rect.left + correction));
			}

			if (correction !== 0)
			{
				tooltip.style.left = `calc(-100% + ${Math.round(correction)}px)`;
			}
		}

		function suppressNativeTooltipTitles(tooltipTrigger)
		{
			if (!tooltipTrigger || tooltipTrigger._suppressedTitleElements)
			{
				return;
			}

			const suppressed = [];
			let currentElement = tooltipTrigger;

			while (currentElement && currentElement !== document.body)
			{
				if (currentElement.hasAttribute && currentElement.hasAttribute('title'))
				{
					suppressed.push({
						element: currentElement,
						title: currentElement.getAttribute('title'),
					});
					currentElement.removeAttribute('title');
				}

				currentElement = currentElement.parentElement;
			}

			tooltipTrigger._suppressedTitleElements = suppressed;
		}

		function restoreNativeTooltipTitles(tooltipTrigger)
		{
			if (!tooltipTrigger || !tooltipTrigger._suppressedTitleElements)
			{
				return;
			}

			tooltipTrigger._suppressedTitleElements.forEach((entry) =>
			{
				if (entry && entry.element && entry.title !== null)
				{
					entry.element.setAttribute('title', entry.title);
				}
			});

			delete tooltipTrigger._suppressedTitleElements;
		}

		function setupFilterableSelects()
		{
			enhanceFilterableSelects(document);

			if (window.filterableSelectsObserver)
			{
				return;
			}

			window.filterableSelectsObserver = new MutationObserver((mutations) =>
			{
				mutations.forEach((mutation) =>
				{
					mutation.addedNodes.forEach((node) =>
					{
						if (node.nodeType !== Node.ELEMENT_NODE)
						{
							return;
						}

						enhanceFilterableSelects(node);
					});
				});
			});

			window.filterableSelectsObserver.observe(document.body, { childList: true, subtree: true });
		}

		function enhanceFilterableSelects(root)
		{
			if (!root || typeof root.querySelectorAll !== 'function')
			{
				return;
			}

			const selects = root.matches && root.matches('select.homey-form-select')
				? [root]
				: Array.from(root.querySelectorAll('select.homey-form-select'));

			selects.forEach((selectElement) =>
			{
				enhanceFilterableSelect(selectElement);
			});
		}

		function enhanceFilterableSelect(selectElement)
		{
			if (selectElement && (/FontSize$/i.test(selectElement.id || '') || /page$/i.test(selectElement.id || '')))
			{
				selectElement.dataset.filterableEnhanced = 'native';
				return;
			}

			if (selectElement && (selectElement.id === 'configType' || selectElement.id === 'displayConfigurationNo' || selectElement.id === 'defaultBroker' || selectElement.id === 'sentip'))
			{
				selectElement.dataset.filterableEnhanced = 'native';
				return;
			}

			if (selectElement && selectElement.closest && selectElement.closest('#panelConfig'))
			{
				selectElement.dataset.filterableEnhanced = 'native';
				return;
			}

			if (!selectElement || selectElement.dataset.filterableEnhanced === 'true')
			{
				return;
			}

			const wrapper = document.createElement('div');
			wrapper.className = 'filterable-select-wrapper';

			const input = document.createElement('input');
			input.type = 'text';
			input.className = 'homey-form-input filterable-select-input';
			input.placeholder = 'Filter and select...';
			input.setAttribute('title', 'Type to filter this list');

			const dropdown = document.createElement('div');
			dropdown.className = 'filterable-select-dropdown';
			dropdown.style.display = 'none';

			const parent = selectElement.parentNode;
			if (!parent)
			{
				return;
			}

			parent.insertBefore(wrapper, selectElement);
			wrapper.appendChild(input);
			wrapper.appendChild(dropdown);
			wrapper.appendChild(selectElement);

			selectElement.classList.add('filterable-select-native');

			let activeIndex = -1;
			let dropdownOpen = false;

			const getSelectedText = () =>
			{
				if (selectElement.selectedIndex < 0 || !selectElement.options[selectElement.selectedIndex])
				{
					return '';
				}

				return selectElement.options[selectElement.selectedIndex].text || '';
			};

			const syncInputDisplay = () =>
			{
				const selectedText = getSelectedText();
				if (!dropdownOpen)
				{
					input.value = selectedText;
					input.placeholder = selectedText ? '' : 'Filter and select...';
					input.classList.add('filterable-select-closed');
				}
			};

			const openDropdown = () =>
			{
				dropdownOpen = true;
				input.readOnly = false;
				input.classList.remove('filterable-select-closed');
				if (input.value === getSelectedText())
				{
					input.value = '';
				}
				input.placeholder = 'Type to filter...';
				dropdown.style.display = 'block';
			};

			const closeDropdown = () =>
			{
				dropdown.style.display = 'none';
				dropdownOpen = false;
				activeIndex = -1;
				input.readOnly = true;
				syncInputDisplay();
			};

			const getFilteredOptions = () =>
			{
				const query = (input.value || '').trim().toLowerCase();
				const allOptions = Array.from(selectElement.options);
				if (query === '')
				{
					return allOptions;
				}

				return allOptions.filter((option) =>
				{
					const optionText = option.text || '';
					const optionValue = option.value || '';
					const haystack = `${optionText} ${optionValue}`.toLowerCase();
					return haystack.includes(query);
				});
			};

			const getDeviceClassIcon = (deviceClass) =>
			{
				switch ((deviceClass || '').toLowerCase())
				{
					case 'light': return '💡';
					case 'socket': return '🔌';
					case 'sensor': return '📟';
					case 'thermostat': return '🌡️';
					case 'speaker': return '🔊';
					case 'camera': return '📷';
					case 'lock': return '🔒';
					case 'windowcoverings': return '🪟';
					default: return '•';
				}
			};

			const appendOptionLabel = (optionNode, option, query) =>
			{
				const labelNode = document.createElement('span');
				labelNode.className = 'filterable-select-option-label';

				if (!option.disabled)
				{
					const iconUrl = option.dataset.iconUrl || '';
					if (iconUrl)
					{
						const iconImage = document.createElement('img');
						iconImage.className = 'filterable-select-option-icon';
						iconImage.src = iconUrl;
						iconImage.alt = '';
						iconImage.loading = 'lazy';
						iconImage.decoding = 'async';
						iconImage.addEventListener('error', function ()
						{
							const iconFallback = document.createElement('span');
							iconFallback.className = 'filterable-select-option-icon-fallback';
							iconFallback.textContent = getDeviceClassIcon(option.dataset.deviceClass || '');
							if (iconImage.parentNode)
							{
								iconImage.parentNode.replaceChild(iconFallback, iconImage);
							}
						});
						optionNode.appendChild(iconImage);
					}
					else
					{
						const iconFallback = document.createElement('span');
						iconFallback.className = 'filterable-select-option-icon-fallback';
						iconFallback.textContent = getDeviceClassIcon(option.dataset.deviceClass || '');
						optionNode.appendChild(iconFallback);
					}
				}

				appendHighlightedText(labelNode, option.text || '', query);
				optionNode.appendChild(labelNode);
			};

			const renderDropdown = () =>
			{
				dropdown.innerHTML = '';
				const query = (input.value || '').trim().toLowerCase();
				const filteredOptions = getFilteredOptions();

				if (filteredOptions.length === 0)
				{
					const noMatch = document.createElement('div');
					noMatch.className = 'filterable-select-dropdown-option filterable-select-disabled';
					noMatch.textContent = 'No matches';
					dropdown.appendChild(noMatch);
					activeIndex = -1;
					return;
				}

				filteredOptions.forEach((option, index) =>
				{
					const optionNode = document.createElement('div');
					optionNode.className = 'filterable-select-dropdown-option';
					if (option.disabled)
					{
						optionNode.classList.add('filterable-select-disabled');
					}

					if (option.value === selectElement.value)
					{
						optionNode.classList.add('filterable-select-selected');
					}

					if (index === activeIndex)
					{
						optionNode.classList.add('filterable-select-active');
					}

					appendOptionLabel(optionNode, option, query);
					optionNode.addEventListener('mousedown', function (event)
					{
						event.preventDefault();
						if (option.disabled)
						{
							return;
						}

						selectElement.value = option.value;
						selectElement.dispatchEvent(new Event('change', { bubbles: true }));
						closeDropdown();
					});

					dropdown.appendChild(optionNode);
				});
			};

			const appendHighlightedText = (container, text, query) =>
			{
				if (!query)
				{
					container.textContent = text;
					return;
				}

				let start = 0;
				const loweredText = text.toLowerCase();
				let matchIndex = loweredText.indexOf(query, start);

				if (matchIndex < 0)
				{
					container.textContent = text;
					return;
				}

				while (matchIndex >= 0)
				{
					if (matchIndex > start)
					{
						container.appendChild(document.createTextNode(text.substring(start, matchIndex)));
					}

					const matchNode = document.createElement('span');
					matchNode.className = 'filterable-select-match';
					matchNode.textContent = text.substring(matchIndex, matchIndex + query.length);
					container.appendChild(matchNode);

					start = matchIndex + query.length;
					matchIndex = loweredText.indexOf(query, start);
				}

				if (start < text.length)
				{
					container.appendChild(document.createTextNode(text.substring(start)));
				}
			};

			const setActiveIndex = (newIndex) =>
			{
				const filteredOptions = getFilteredOptions().filter((option) => !option.disabled);
				if (filteredOptions.length === 0)
				{
					activeIndex = -1;
					renderDropdown();
					return;
				}

				if (newIndex < 0)
				{
					activeIndex = filteredOptions.length - 1;
				}
				else if (newIndex >= filteredOptions.length)
				{
					activeIndex = 0;
				}
				else
				{
					activeIndex = newIndex;
				}

				renderDropdown();

				const nodes = dropdown.querySelectorAll('.filterable-select-dropdown-option:not(.filterable-select-disabled)');
				if (nodes[activeIndex])
				{
					nodes[activeIndex].scrollIntoView({ block: 'nearest' });
				}
			};

			input.addEventListener('focus', function ()
			{
				if (!dropdownOpen)
				{
					openDropdown();
					renderDropdown();
				}
			});

			input.addEventListener('click', function ()
			{
				openDropdown();
				renderDropdown();
			});

			input.addEventListener('input', function ()
			{
				if (!dropdownOpen)
				{
					openDropdown();
				}
				activeIndex = -1;
				renderDropdown();
			});

			input.addEventListener('keydown', function (event)
			{
				if (event.key === 'ArrowDown')
				{
					event.preventDefault();
					openDropdown();
					setActiveIndex(activeIndex + 1);
					return;
				}

				if (event.key === 'ArrowUp')
				{
					event.preventDefault();
					openDropdown();
					setActiveIndex(activeIndex - 1);
					return;
				}

				if (event.key === 'Enter')
				{
					event.preventDefault();
					const filteredOptions = getFilteredOptions().filter((option) => !option.disabled);
					if (filteredOptions.length === 0)
					{
						return;
					}

					const selection = filteredOptions[(activeIndex >= 0) ? activeIndex : 0];
					selectElement.value = selection.value;
					selectElement.dispatchEvent(new Event('change', { bubbles: true }));
					closeDropdown();
					return;
				}

				if (event.key === 'Escape')
				{
					event.preventDefault();
					closeDropdown();
					input.blur();
				}
			});

			wrapper.addEventListener('focusout', function ()
			{
				setTimeout(() =>
				{
					if (!wrapper.contains(document.activeElement))
					{
						closeDropdown();
					}
				}, 0);
			});

			selectElement.addEventListener('change', function ()
			{
				syncInputDisplay();
				renderDropdown();
			});

			const observer = new MutationObserver(() =>
			{
				syncInputDisplay();
				renderDropdown();
			});

			observer.observe(selectElement, { childList: true, subtree: true, characterData: true });
			selectElement.dataset.filterableEnhanced = 'true';
			selectElement._filterObserver = observer;
			input.readOnly = true;

			syncInputDisplay();
			renderDropdown();
		}

		function fillConfigListElement(element, txt, configurations, NumConfigurations)
		{
			//fill the configuration list with configuration number / names
			element.innerHTML = "";

			var option = document.createElement("option");
			for (let i = 0; i < NumConfigurations; i++)
			{
				let config = configurations[i];

				var option = document.createElement("option");
				option.value = i;
				option.text = `${txt} ${i + 1} - ${(config && config.name) ? config.name : ''}`;
				element.add(option);
			}
		}

		function fillDefaultBrokerList()
		{
			if (brokerItemsFetched)
			{
				//fill the broker lists with brokers
				defaultBrokerElement.innerHTML = "";
				for (let i = 0; i < localBrokerItems.length; i++)
				{
					const brokerItem = localBrokerItems[i];
					if (brokerItem.enabled)
					{
						var option = document.createElement("option");
						option.value = brokerItem.brokerid;
						option.text = brokerItem.brokerid;
						defaultBrokerElement.add(option);
					}
				}
			}
		}

		function onButtonPageChange(element, side)
		{

		}

		function onButtonLabelChange(element, side)
		{
			document.getElementById(`button${side}Legend`).innerHTML = `<b><em>${Homey.__(`settings.${side}Panel`)}</em></b> - ${element.value}`;
		}

		function collectButtonMainDiagnostics(source, extra = {})
		{
			const rawConfig = localButtonConfigurations[currentButtonConfigurationNo];
			const pageSections = Array.from(document.querySelectorAll('.button-main-page'));
			const activeIndex = pageSections.findIndex((section) => section.classList.contains('active'));
			const activeSection = (activeIndex >= 0) ? pageSections[activeIndex] : null;
			const activeGroup = activeSection ? activeSection.querySelector('.horizontalgroup') : null;
			const buttonItemsSection = document.getElementById('buttonItemsSection');
			const panelConfigTab = document.getElementById('panelConfig');
			const visibleCount = pageSections.filter((section) => section.style.display !== 'none').length;
			const getDisplayValue = function (element)
			{
				if (!element)
				{
					return '(missing)';
				}

				return {
					inline: element.style.display || '(css)',
					computed: window.getComputedStyle(element).display,
				};
			};

			return {
				source,
				configIndex: Number(currentButtonConfigurationNo),
				rawType: Array.isArray(rawConfig) ? 'array' : typeof rawConfig,
				rawLength: Array.isArray(rawConfig) ? rawConfig.length : (rawConfig ? 1 : 0),
				mainPageCurrent: Number(buttonMainCurrentPage),
				mainPageActiveIndex: activeIndex,
				mainPageSectionCount: pageSections.length,
				mainPageVisibleCount: visibleCount,
				mainPageActiveHeight: activeSection ? activeSection.offsetHeight : -1,
				mainPageActiveChildCount: activeSection ? activeSection.childElementCount : -1,
				mainPageActiveGroupHeight: activeGroup ? activeGroup.offsetHeight : -1,
				mainPageActiveDisplay: getDisplayValue(activeSection),
				buttonItemsSectionHeight: buttonItemsSection ? buttonItemsSection.offsetHeight : -1,
				buttonItemsSectionDisplay: getDisplayValue(buttonItemsSection),
				panelConfigTabHeight: panelConfigTab ? panelConfigTab.offsetHeight : -1,
				panelConfigTabDisplay: getDisplayValue(panelConfigTab),
				popupPageCurrent: Number(buttonPagePopupCurrentPage),
				popupVisible: Boolean(buttonPagePopupOverlayElement && buttonPagePopupOverlayElement.classList.contains('visible')),
				fieldPopupVisible: Boolean(buttonFieldPopupOverlayElement && buttonFieldPopupOverlayElement.classList.contains('visible')),
				...extra,
			};
		}

		function updateButtonMainDiagnostics(source, extra = {})
		{
			if (!BUTTON_MAIN_DIAGNOSTICS_ENABLED)
			{
				return;
			}

			const diagnostics = collectButtonMainDiagnostics(source, extra);
			console.log('[ButtonMainDiagnostics]', diagnostics);

		}

		function hidePopupManagedFieldsForSection(side, page)
		{
			const hideById = function (id)
			{
				const element = document.getElementById(id);
				if (element)
				{
					element.style.display = 'none';
				}
			};

			const hideLabelFor = function (id)
			{
				const section = document.getElementById(`${side}${page}PanelSection`);
				if (!section)
				{
					return;
				}

				const label = section.querySelector(`label[for="${id}"]`);
				if (label)
				{
					label.style.display = 'none';
				}
			};

			hideById(`${side}${page}Device`);
			hideLabelFor(`${side}${page}Device`);

			hideById(`${side}${page}CapabilityDiv`);

			hideById(`${side}${page}TopText`);
			hideLabelFor(`${side}${page}TopText`);

			hideById(`${side}${page}OnTextDiv`);
			hideById(`${side}${page}OffText`);
			hideById(`${side}${page}OffTextLabel`);

			hideById(`${side}${page}FrontLEDOnColor`);
			hideById(`${side}${page}FrontLEDOnColorLabel`);
			hideById(`${side}${page}WallLEDOnColor`);
			hideById(`${side}${page}WallLEDOnColorLabel`);
			hideById(`${side}${page}FrontLEDOffColor`);
			hideById(`${side}${page}FrontLEDOffColorLabel`);
			hideById(`${side}${page}WallLEDOffColor`);
			hideById(`${side}${page}WallLEDOffColorLabel`);

			hideById(`${side}${page}OnSVG`);
			hideLabelFor(`${side}${page}OnSVG`);
			hideById(`${side}${page}OnSVGPreview`);
			const onSvgElement = document.getElementById(`${side}${page}OnSVG`);
			if (onSvgElement)
			{
				const onSvgWrapper = onSvgElement.closest('.svg-editor-wrapper');
				if (onSvgWrapper)
				{
					onSvgWrapper.style.display = 'none';
				}
			}

			hideById(`${side}${page}OffSVG`);
			hideLabelFor(`${side}${page}OffSVG`);
			hideById(`${side}${page}OffSVGPreview`);
			const offSvgElement = document.getElementById(`${side}${page}OffSVG`);
			if (offSvgElement)
			{
				const offSvgWrapper = offSvgElement.closest('.svg-editor-wrapper');
				if (offSvgWrapper)
				{
					offSvgWrapper.style.display = 'none';
				}
			}
		}

		function hidePopupManagedFieldsForPage(page)
		{
			hidePopupManagedFieldsForSection('left', page);
			hidePopupManagedFieldsForSection('right', page);
		}

		function updateButtonAdvancedToggleState(side, page)
		{
			const detailElement = document.getElementById(`${side}${page}Details`);
			const toggleElement = document.getElementById(`${side}${page}AdvancedToggle`);
			if (!detailElement || !toggleElement)
			{
				return;
			}

			toggleElement.textContent = detailElement.open ? 'Hide Advanced' : 'Advanced';
			toggleElement.setAttribute('aria-expanded', detailElement.open ? 'true' : 'false');
		}

		function updateButtonInlineSettingsToggleState(page)
		{
			const detailElement = document.getElementById(`${page}ButtonInlineSettingsDetails`);
			const toggleElement = document.getElementById(`${page}ButtonInlineSettingsToggle`);
			if (!detailElement || !toggleElement)
			{
				return;
			}

			toggleElement.classList.toggle('is-open', detailElement.open);
			toggleElement.title = detailElement.open ? 'Collapse Repeat / Broker' : 'Expand Repeat / Broker';
			toggleElement.setAttribute('aria-label', toggleElement.title);
			toggleElement.setAttribute('aria-expanded', detailElement.open ? 'true' : 'false');
		}

		function toggleButtonInlineSettingsSection(page)
		{
			const detailElement = document.getElementById(`${page}ButtonInlineSettingsDetails`);
			if (!detailElement)
			{
				return;
			}

			detailElement.open = !detailElement.open;
			if (detailElement.open)
			{
				scrollToTop(detailElement);
			}

			updateButtonInlineSettingsToggleState(page);
		}

		function collapseAllDetails(root = document)
		{
			if (!root || typeof root.querySelectorAll !== 'function')
			{
				return;
			}

			root.querySelectorAll('details').forEach((detailElement) =>
			{
				detailElement.open = false;
			});
		}

		function getButtonInlineMainControlHtml(side, page)
		{
			const ctrlLabels = {
				longRepeat: 'Repeat',
				brokerId: Homey.__("settings.brokerId"),
			};

			const ctrlExplanations = {
				longRepeat: Homey.__("settings.longRepeatExplanation"),
				brokerId: Homey.__("settings.brokerIdExplanation"),
			};

			const panelLabel = side === 'left' ? Homey.__("settings.leftPanel") : Homey.__("settings.rightPanel");

			return `<div class="button-inline-main-control-column">
				<div class="button-inline-main-control-heading">${panelLabel}</div>
				<div class="button-inline-main-controls">
					<label class="homey-form-checkbox">
						<input class="homey-form-checkbox-input" id="${side}${page}DisableLongRepeat" type="checkbox" value="auto" />
						<span class="homey-form-checkbox-checkmark"></span>
						<span class="homey-form-checkbox-text"><span>${ctrlLabels.longRepeat}</span></span>
						<div class="tooltip"><i class="fi fi-rr-info"></i>
							<span class="tooltiptext">${ctrlExplanations.longRepeat}</span>
						</div>
					</label>

					<div id="${side}${page}BrokerIdDiv" class="button-inline-broker-control">
						<label class="homey-form-label" for="${side}${page}BrokerId"><span>${ctrlLabels.brokerId}</span>
							<div class="tooltip"><i class="fi fi-rr-info"></i>
								<span class="tooltiptext">${ctrlExplanations.brokerId}</span>
							</div>
						</label>
						<select class="homey-form-select" id="${side}${page}BrokerId">
						</select>
					</div>
				</div>
			</div>`;
		}

		function renderButtonMainPage()
		{
			const pageSections = Array.from(document.querySelectorAll('.button-main-page'));
			if (!pageSections.length)
			{
				updateButtonMainDiagnostics('renderButtonMainPage:no-sections');
				return;
			}

			buttonMainCurrentPage = Number(buttonMainCurrentPage);
			if (Number.isNaN(buttonMainCurrentPage))
			{
				buttonMainCurrentPage = 0;
			}

			if (buttonMainCurrentPage < 0)
			{
				buttonMainCurrentPage = 0;
			}
			if (buttonMainCurrentPage >= pageSections.length)
			{
				buttonMainCurrentPage = pageSections.length - 1;
			}

			let hasActiveSection = false;
			pageSections.forEach((section, index) =>
			{
				const isActive = (index === buttonMainCurrentPage);
				section.classList.toggle('active', isActive);
				if (isActive)
				{
					section.style.display = 'flex';
					section.style.flexDirection = 'column';
					section.style.width = '100%';
					section.style.minHeight = '1px';
					const activeGroup = section.querySelector('.horizontalgroup');
					if (activeGroup)
					{
						activeGroup.style.display = 'block';
						activeGroup.style.flex = '0 0 auto';
						activeGroup.style.width = '100%';
						activeGroup.style.minHeight = '1px';
					}
				}
				else
				{
					section.style.display = 'none';
				}
				hasActiveSection = hasActiveSection || isActive;
			});

			if (!hasActiveSection)
			{
				buttonMainCurrentPage = 0;
				pageSections.forEach((section, index) =>
				{
					const isActive = (index === 0);
					section.classList.toggle('active', isActive);
					if (isActive)
					{
						section.style.display = 'flex';
						section.style.flexDirection = 'column';
						section.style.width = '100%';
						section.style.minHeight = '1px';
						const activeGroup = section.querySelector('.horizontalgroup');
						if (activeGroup)
						{
							activeGroup.style.display = 'block';
							activeGroup.style.flex = '0 0 auto';
							activeGroup.style.width = '100%';
							activeGroup.style.minHeight = '1px';
						}
					}
					else
					{
						section.style.display = 'none';
					}
				});
			}

			updateButtonMainDiagnostics('renderButtonMainPage', { hasActiveSection });

			const prevButtons = document.querySelectorAll('.button-main-page-prev');
			const nextButtons = document.querySelectorAll('.button-main-page-next');
			prevButtons.forEach((button) =>
			{
				button.disabled = (buttonMainCurrentPage <= 0);
			});
			nextButtons.forEach((button) =>
			{
				button.disabled = (buttonMainCurrentPage >= (pageSections.length - 1));
			});
		}

		function ensureButtonMainContextVisible()
		{
			const panelConfigTab = document.getElementById('panelConfig');
			const buttonItemsSection = document.getElementById('buttonItemsSection');

			if (configTypeElement && configTypeElement.value === 'panelConfig' && panelConfigTab)
			{
				panelConfigTab.style.display = 'block';
			}

			if (buttonItemsSection)
			{
				buttonItemsSection.style.display = 'block';
				buttonItemsSection.style.width = '100%';
				buttonItemsSection.style.minHeight = '1px';
				buttonItemsSection.style.overflow = 'visible';
			}
		}

		function stepButtonMainPage(delta)
		{
			updateButtonMainDiagnostics('stepButtonMainPage:before', { delta });
			const step = Number(delta);
			ensureButtonMainContextVisible();
			buttonMainCurrentPage = Number(buttonMainCurrentPage) + (Number.isNaN(step) ? 0 : step);
			renderButtonMainPage();
			ensureButtonMainContextVisible();
			updateButtonMainDiagnostics('stepButtonMainPage:after', { delta, step });
		}

		function closeButtonPagePopup()
		{
			if (!buttonPagePopupOverlayElement)
			{
				return;
			}

			buttonPagePopupOverlayElement.classList.remove('visible');
			buttonPagePopupOverlayElement.setAttribute('aria-hidden', 'true');
			document.body.classList.remove('sim-panel-open');
			document.documentElement.style.setProperty('--button-sim-scroll-offset', '0px');
			buttonPagePopupCurrentPage = -1;
		}

		function updateButtonPagePopupScrollOffset()
		{
			if (!buttonPagePopupOverlayElement || !buttonPagePopupOverlayElement.classList.contains('visible'))
			{
				document.body.classList.remove('sim-panel-open');
				document.documentElement.style.setProperty('--button-sim-scroll-offset', '0px');
				return;
			}

			const fixedTopElement = document.querySelector('.fixedTop');
			const fixedTopHeight = fixedTopElement ? fixedTopElement.offsetHeight : 0;
			const simDialogElement = document.querySelector('.button-sim-overlay.visible .button-sim-dialog');
			const simBottom = simDialogElement ? Math.max(0, simDialogElement.getBoundingClientRect().bottom) : 0;
			const requiredOffset = Math.max(0, Math.round(simBottom - fixedTopHeight + 8));
			document.documentElement.style.setProperty('--button-sim-scroll-offset', `${requiredOffset}px`);
			document.body.classList.add('sim-panel-open');
		}

		function normalizeLedColor(value, fallback)
		{
			const color = (value || '').toString().trim();
			return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : fallback;
		}

		function getButtonPanelLedColor(pageConfig, side, ledType, pageIndex = buttonPagePopupCurrentPage)
		{
			const suffix = (buttonPagePopupLedState === 'on') ? 'OnColor' : 'OffColor';
			const fallback = (buttonPagePopupLedState === 'on') ? '#ffffff' : '#1f2937';
			const colorInputId = `${side}${pageIndex}${ledType}${suffix}`;
			const liveInputElement = document.getElementById(colorInputId);
			const liveColor = liveInputElement ? liveInputElement.value : undefined;
			const configColor = pageConfig[`${side}${ledType}${suffix}`];
			return normalizeLedColor(liveColor || configColor, fallback);
		}

		function getButtonPanelLedMarkup(pageConfig, side, pageIndex = buttonPagePopupCurrentPage)
		{
			const wallColor = escapeHtml(getButtonPanelLedColor(pageConfig, side, 'WallLED', pageIndex));
			const frontColor = escapeHtml(getButtonPanelLedColor(pageConfig, side, 'FrontLED', pageIndex));
			const ledColorSuffix = (buttonPagePopupLedState === 'on') ? 'OnColor' : 'OffColor';
			return `
				<div class="button-sim-led button-sim-led-wall" title="${side} wall LED (${buttonPagePopupLedState})" onclick="event.stopPropagation(); focusButtonControlFromPopup('${side}', ${pageIndex}, 'WallLED${ledColorSuffix}');" style="background-color:${wallColor}; border-color:${wallColor};"></div>
				<div class="button-sim-led button-sim-led-front" title="${side} front LED (${buttonPagePopupLedState})" onclick="event.stopPropagation(); focusButtonControlFromPopup('${side}', ${pageIndex}, 'FrontLED${ledColorSuffix}');" style="border-color:${frontColor}; box-shadow: 0 0 6px ${frontColor};"></div>`;
		}

		function getButtonPanelPreviewSvg(svgText)
		{
			if (!svgText)
			{
				return '';
			}

			const parserWrapper = document.createElement('div');
			parserWrapper.innerHTML = svgText;
			const svgElement = parserWrapper.querySelector('svg');
			if (!svgElement)
			{
				return '';
			}

			return svgElement.outerHTML;
		}

		function getLiveButtonPanelFieldValue(pageConfig, side, fieldSuffix, fallback = '', pageIndex = buttonPagePopupCurrentPage)
		{
			const fieldId = `${side}${pageIndex}${fieldSuffix}`;
			const liveElement = document.getElementById(fieldId);
			if (liveElement && typeof liveElement.value === 'string')
			{
				return liveElement.value;
			}

			const configValue = pageConfig[`${side}${fieldSuffix}`];
			if (configValue !== undefined && configValue !== null && configValue !== '')
			{
				return configValue;
			}

			return fallback;
		}

		function formatButtonPageLabel(pageIndex)
		{
			return pageIndex === 0 ? 'Default' : `${pageIndex}`;
		}

		function formatDisplayPageLabel(pageIndex)
		{
			return pageIndex === 0 ? 'Default' : `${pageIndex}`;
		}

		function renderDisplayPageHeaderTitle(titleElement, currentPage, totalPages)
		{
			if (!titleElement)
			{
				return;
			}

			const displayPageLabel = Homey.__("settings.page");
			const currentPageLabel = formatDisplayPageLabel(currentPage);
			const nonDefaultPageCount = Math.max(0, totalPages - 1);
			if (nonDefaultPageCount === 0)
			{
				titleElement.textContent = `${displayPageLabel}: ${currentPageLabel}`;
				return;
			}

			const totalPagesHint = escapeHtml(Homey.__("settings.displaySimTotalPagesHint"));
			const safeDisplayPageLabel = escapeHtml(displayPageLabel);
			const safeCurrentPageLabel = escapeHtml(currentPageLabel);
			titleElement.innerHTML = `${safeDisplayPageLabel}: ${safeCurrentPageLabel} / <span class="display-sim-total-pages">${nonDefaultPageCount}</span><span class="tooltip display-sim-total-pages-tooltip"><i class="fi fi-rr-info" aria-hidden="true"></i><span class="tooltiptext">${totalPagesHint}</span></span>`;
		}

		function getButtonPanelPreviewMarkup(pageConfig, side, pageIndex = buttonPagePopupCurrentPage)
		{
			const topText = escapeHtml(getLiveButtonPanelFieldValue(pageConfig, side, 'TopText', Homey.__(`settings.${side}Panel`), pageIndex));
			const onText = escapeHtml(getLiveButtonPanelFieldValue(pageConfig, side, 'OnText', Homey.__('settings.labelOn'), pageIndex));
			const offText = escapeHtml(getLiveButtonPanelFieldValue(pageConfig, side, 'OffText', Homey.__('settings.labelOff'), pageIndex));
			const stateText = (buttonPagePopupLedState === 'on') ? onText : offText;
			const textFieldSuffix = (buttonPagePopupLedState === 'on') ? 'OnText' : 'OffText';
			const svgFieldSuffix = (buttonPagePopupLedState === 'on') ? 'OnSVG' : 'OffSVG';
			const selectedSvgText = getLiveButtonPanelFieldValue(pageConfig, side, svgFieldSuffix, '', pageIndex);
			const svgMarkup = getButtonPanelPreviewSvg(selectedSvgText || '');
			const ledMarkup = `<div class="button-sim-leds ${side === 'right' ? 'button-sim-leds-right' : ''}">${getButtonPanelLedMarkup(pageConfig, side, pageIndex)}</div>`;
			const contentMarkup = svgMarkup
				? `
					<div class="button-sim-content button-sim-content-svg" onclick="event.stopPropagation(); focusButtonControlFromPopup('${side}', ${pageIndex}, '${svgFieldSuffix}');">
						<div class="button-sim-top" onclick="event.stopPropagation(); focusButtonControlFromPopup('${side}', ${pageIndex}, 'TopText');">${topText}</div>
						<div class="button-sim-icon" onclick="event.stopPropagation(); focusButtonControlFromPopup('${side}', ${pageIndex}, '${svgFieldSuffix}');">${svgMarkup}</div>
					</div>`
				: `
					<div class="button-sim-content">
						<div class="button-sim-top" onclick="event.stopPropagation(); focusButtonControlFromPopup('${side}', ${pageIndex}, 'TopText');">${topText}</div>
							<div class="button-sim-state-block" onclick="event.stopPropagation(); focusButtonControlFromPopup('${side}', ${pageIndex}, '${textFieldSuffix}');">
							<div class="button-sim-state-line" onclick="event.stopPropagation(); focusButtonControlFromPopup('${side}', ${pageIndex}, '${textFieldSuffix}');">${stateText}</div>
						</div>
					</div>`;

			if (side === 'left')
			{
				return `
					<div class="button-sim-shell button-sim-shell-left">
						${ledMarkup}
						${contentMarkup}
					</div>`;
			}

			return `
				<div class="button-sim-shell button-sim-shell-right">
					${contentMarkup}
					${ledMarkup}
				</div>`;
		}

		function renderInlineButtonPagePreview(page)
		{
			const config = localButtonConfigurations[currentButtonConfigurationNo];
			if (!Array.isArray(config) || page < 0 || page >= config.length)
			{
				return;
			}

			const pageConfig = config[page];
			const previewElement = document.getElementById(`${page}ButtonInlineSimContent`);
			if (previewElement)
			{
				previewElement.innerHTML =
					`<button class="button-sim-item" onclick="focusButtonPanelFromPopup('left', ${page})" title="Open left panel settings">
						${getButtonPanelPreviewMarkup(pageConfig, 'left', page)}
					</button>
					<button class="button-sim-item" onclick="focusButtonPanelFromPopup('right', ${page})" title="Open right panel settings">
						${getButtonPanelPreviewMarkup(pageConfig, 'right', page)}
					</button>`;
			}

			const stateToggleElement = document.getElementById(`${page}ButtonInlineSimState`);
			if (stateToggleElement)
			{
				stateToggleElement.textContent = (buttonPagePopupLedState === 'on') ? 'On state' : 'Off state';
			}
		}

		function renderInlineButtonPagePreviews()
		{
			let config = localButtonConfigurations[currentButtonConfigurationNo];
			if (!Array.isArray(config))
			{
				config = [config];
				localButtonConfigurations[currentButtonConfigurationNo] = config;
			}

			for (let page = 0; page < config.length; page++)
			{
				renderInlineButtonPagePreview(page);
			}
		}

		function toggleInlineButtonSimState()
		{
			buttonPagePopupLedState = (buttonPagePopupLedState === 'on') ? 'off' : 'on';
			renderInlineButtonPagePreviews();

			if (buttonPagePopupOverlayElement && buttonPagePopupOverlayElement.classList.contains('visible'))
			{
				renderButtonPagePopup();
			}
		}

		function renderButtonPagePopup()
		{
			if (!buttonPagePopupContentElement || buttonPagePopupCurrentPage < 0)
			{
				return;
			}

			const config = localButtonConfigurations[currentButtonConfigurationNo];
			if (!Array.isArray(config) || config.length === 0)
			{
				return;
			}

			buttonPagePopupCurrentPage = Math.max(0, Math.min(buttonPagePopupCurrentPage, config.length - 1));
			if (!config[buttonPagePopupCurrentPage])
			{
				return;
			}

			const pageConfig = config[buttonPagePopupCurrentPage];
			buttonPagePopupContentElement.innerHTML =
				`<div class="button-sim-bar">
					<button class="button-sim-item" onclick="focusButtonPanelFromPopup('left', ${buttonPagePopupCurrentPage})" title="Open left panel settings">
						${getButtonPanelPreviewMarkup(pageConfig, 'left')}
					</button>
					<button class="button-sim-item" onclick="focusButtonPanelFromPopup('right', ${buttonPagePopupCurrentPage})" title="Open right panel settings">
						${getButtonPanelPreviewMarkup(pageConfig, 'right')}
					</button>
				</div>`;

			if (buttonPagePopupStateToggleElement)
			{
				buttonPagePopupStateToggleElement.textContent = `${buttonPagePopupLedState === 'on' ? 'On state' : 'Off state'}`;
			}

			if (buttonPagePopupTitleElement)
			{
				buttonPagePopupTitleElement.textContent = `Page ${formatButtonPageLabel(buttonPagePopupCurrentPage)}`;
			}

			if (buttonPagePopupPrevElement)
			{
				buttonPagePopupPrevElement.disabled = (buttonPagePopupCurrentPage <= 0);
			}

			if (buttonPagePopupNextElement)
			{
				buttonPagePopupNextElement.disabled = (buttonPagePopupCurrentPage >= (config.length - 1));
			}

			updateButtonPagePopupScrollOffset();
		}

		function stepButtonPagePopup(delta)
		{
			const config = localButtonConfigurations[currentButtonConfigurationNo];
			if (!Array.isArray(config) || config.length === 0 || buttonPagePopupCurrentPage < 0)
			{
				return;
			}

			buttonPagePopupCurrentPage = Math.max(0, Math.min(buttonPagePopupCurrentPage + delta, config.length - 1));
			renderButtonPagePopup();
			focusButtonPageSectionFromPopup(buttonPagePopupCurrentPage);
		}

		function focusButtonPageSectionFromPopup(page)
		{
			if (configTypeElement && configTypeElement.value !== 'panelConfig')
			{
				configTypeElement.value = 'panelConfig';
				configTypeChanged('panelConfig');
			}

			const alignPageSectionBelowSim = function (attempt = 0)
			{
				updateButtonPagePopupScrollOffset();

				const pageSectionElement = document.getElementById(`${page}ButtonPageSection`);
				if (!pageSectionElement)
				{
					if (attempt < 6)
					{
						setTimeout(() => alignPageSectionBelowSim(attempt + 1), 60);
					}
					return;
				}

				const fixedTopElement = document.querySelector('.fixedTop');
				const fixedTopHeight = fixedTopElement ? fixedTopElement.offsetHeight : 0;
				const simDialogElement = document.querySelector('.button-sim-overlay.visible .button-sim-dialog');
				const simBottom = simDialogElement ? Math.max(0, simDialogElement.getBoundingClientRect().bottom) : 0;
				const targetViewportTop = Math.max(fixedTopHeight + 8, simBottom + 6);
				const targetTop = Math.max(0, pageSectionElement.getBoundingClientRect().top + window.scrollY - targetViewportTop);
				window.scrollTo({ top: targetTop, behavior: 'smooth' });

				if (attempt === 0)
				{
					pageSectionElement.classList.add('button-page-highlight');
					setTimeout(() =>
					{
						pageSectionElement.classList.remove('button-page-highlight');
					}, 1400);
				}
			};

			requestAnimationFrame(() =>
			{
				alignPageSectionBelowSim(0);

				const pageNumElement = document.getElementById(`${page}PageNum`);
				if (pageNumElement && typeof pageNumElement.focus === 'function')
				{
					try
					{
						pageNumElement.focus({ preventScroll: true });
					}
					catch (focusError)
					{
						pageNumElement.focus();
					}
				}

				setTimeout(() => alignPageSectionBelowSim(1), 120);
			});
		}

		function focusButtonPanelFromPopup(side, page)
		{
			focusButtonControlFromPopup(side, page, 'Device');
		}

		function getButtonFieldPopupSpec(side, fieldSuffix)
		{
			const sideLabel = Homey.__(`settings.${side}Panel`);
			const labels = {
				Device: Homey.__('settings.device'),
				Capability: Homey.__('settings.capability'),
				TopText: Homey.__('settings.topLabel'),
				OnText: Homey.__('settings.labelOn'),
				OffText: Homey.__('settings.labelOff'),
				OnSVG: 'On SVG Data',
				OffSVG: 'Off SVG Data',
				FrontLEDOnColor: Homey.__('settings.frontLEDOnColor'),
				WallLEDOnColor: Homey.__('settings.wallLEDOnColor'),
				FrontLEDOffColor: Homey.__('settings.frontLEDOffColor'),
				WallLEDOffColor: Homey.__('settings.wallLEDOffColor'),
			};

			if (fieldSuffix === 'TopText')
			{
				return {
					title: `${sideLabel} - ${labels.TopText}`,
					fields: ['TopText'],
					labels,
				};
			}

			if (fieldSuffix === 'Device' || fieldSuffix === 'Capability')
			{
				return {
					title: `${sideLabel} - ${Homey.__('settings.device')}`,
					fields: ['Device', 'Capability'],
					labels,
				};
			}

			if (fieldSuffix === 'OnText' || fieldSuffix === 'OffText')
			{
				const valueFields = (fieldSuffix === 'OnText')
					? ['Device', 'Capability', 'OnText', 'OffText', 'OnSVG', 'OffSVG']
					: ['Device', 'Capability', 'OffText', 'OnText', 'OnSVG', 'OffSVG'];

				return {
					title: `${sideLabel} - ${Homey.__('settings.text')}`,
					fields: valueFields,
					labels,
				};
			}

			if (fieldSuffix === 'OnSVG' || fieldSuffix === 'OffSVG')
			{
				const svgFields = (fieldSuffix === 'OnSVG')
					? ['Device', 'Capability', 'OnText', 'OffText', 'OnSVG', 'OffSVG']
					: ['Device', 'Capability', 'OffText', 'OnText', 'OffSVG', 'OnSVG'];

				return {
					title: `${sideLabel} - ${Homey.__('settings.text')}`,
					fields: svgFields,
					labels,
				};
			}

			if (fieldSuffix.endsWith('Color'))
			{
				return {
					title: `${sideLabel} - LEDs`,
					fields: ['FrontLEDOnColor', 'WallLEDOnColor', 'FrontLEDOffColor', 'WallLEDOffColor'],
					labels,
				};
			}

			return null;
		}

		function closeButtonFieldPopup()
		{
			if (!buttonFieldPopupOverlayElement)
			{
				return;
			}

			buttonFieldPopupOverlayElement.classList.remove('visible');
			buttonFieldPopupOverlayElement.setAttribute('aria-hidden', 'true');
			buttonFieldPopupBindings = [];
			buttonFieldPopupContext = null;
			if (buttonFieldPopupBodyElement)
			{
				buttonFieldPopupBodyElement.innerHTML = '';
			}
		}

		function syncButtonFieldPopupCapabilityOptions(side, page, popupCapabilityElement, selectedCapability = '')
		{
			if (!popupCapabilityElement)
			{
				return;
			}

			const sourceCapabilityElement = document.getElementById(`${side}${page}Capability`);
			if (!sourceCapabilityElement)
			{
				return;
			}

			popupCapabilityElement.innerHTML = sourceCapabilityElement.innerHTML;
			const wantedValue = selectedCapability || sourceCapabilityElement.value;
			if (wantedValue)
			{
				popupCapabilityElement.value = wantedValue;
			}
		}

		function saveButtonFieldPopup()
		{
			if (!buttonFieldPopupBindings || buttonFieldPopupBindings.length === 0)
			{
				closeButtonFieldPopup();
				return;
			}

			if (buttonFieldPopupContext && buttonFieldPopupContext.popupElementsBySuffix && buttonFieldPopupContext.popupElementsBySuffix.Device && buttonFieldPopupContext.popupElementsBySuffix.Capability)
			{
				const side = buttonFieldPopupContext.side;
				const page = buttonFieldPopupContext.page;
				const deviceValue = buttonFieldPopupContext.popupElementsBySuffix.Device.value;
				const capabilityValue = buttonFieldPopupContext.popupElementsBySuffix.Capability.value;

				const sourceDeviceElement = document.getElementById(`${side}${page}Device`);
				const sourceCapabilityElement = document.getElementById(`${side}${page}Capability`);

				if (sourceDeviceElement)
				{
					sourceDeviceElement.value = deviceValue;
					buttonDeviceChanged(side, page);
					sourceDeviceElement.dispatchEvent(new Event('change', { bubbles: true }));
				}

				if (sourceCapabilityElement)
				{
					const applyCapabilityValue = function (attempt = 0)
					{
						const hasOption = Array.from(sourceCapabilityElement.options || []).some((option) => option.value === capabilityValue);
						if (hasOption)
						{
							sourceCapabilityElement.value = capabilityValue;
							sourceCapabilityElement.dispatchEvent(new Event('change', { bubbles: true }));
							return;
						}

						if (attempt < 8)
						{
							setTimeout(() => applyCapabilityValue(attempt + 1), 120);
						}
					};

					applyCapabilityValue(0);
				}
			}

			for (const binding of buttonFieldPopupBindings)
			{
				if (!binding || !binding.sourceElement || !binding.popupElement)
				{
					continue;
				}

				if (binding.suffix === 'Device' || binding.suffix === 'Capability')
				{
					continue;
				}

				if (binding.sourceElement.type === 'checkbox')
				{
					binding.sourceElement.checked = binding.popupElement.checked;
					binding.sourceElement.dispatchEvent(new Event('change', { bubbles: true }));
				}
				else
				{
					binding.sourceElement.value = binding.popupElement.value;
					binding.sourceElement.dispatchEvent(new Event('input', { bubbles: true }));
					binding.sourceElement.dispatchEvent(new Event('change', { bubbles: true }));
				}
			}

			if (buttonFieldPopupContext)
			{
				renderInlineButtonPagePreview(buttonFieldPopupContext.page);
				if (buttonPagePopupOverlayElement && buttonPagePopupOverlayElement.classList.contains('visible'))
				{
					renderButtonPagePopup();
				}
			}

			closeButtonFieldPopup();
		}

		function openButtonFieldPopup(side, page, fieldSuffix, retryCount = 0)
		{
			if (!buttonFieldPopupOverlayElement || !buttonFieldPopupBodyElement || !buttonFieldPopupTitleElement)
			{
				focusButtonControlFromPopup(side, page, fieldSuffix, false);
				return;
			}

			const popupSpec = getButtonFieldPopupSpec(side, fieldSuffix);
			if (!popupSpec)
			{
				focusButtonControlFromPopup(side, page, fieldSuffix, false);
				return;
			}

			buttonFieldPopupBindings = [];
			const popupElementsBySuffix = {};
			let popupDeviceIndicatorElement = null;
			let popupCapabilityIndicatorElement = null;
			buttonFieldPopupContext = { side, page, fieldSuffix, popupElementsBySuffix };
			buttonFieldPopupBodyElement.innerHTML = '';
			buttonFieldPopupTitleElement.textContent = popupSpec.title;
			const missingSuffixes = [];

			for (const suffix of popupSpec.fields)
			{
				const sourceId = `${side}${page}${suffix}`;
				const sourceElement = document.getElementById(sourceId);
				if (!sourceElement)
				{
					missingSuffixes.push(suffix);
					continue;
				}

				const wrapper = document.createElement('div');
				wrapper.className = 'button-field-popup-field';

				const label = document.createElement('label');
				label.className = 'button-field-popup-label';
				label.textContent = popupSpec.labels[suffix] || suffix;
				wrapper.appendChild(label);

				const popupId = `buttonFieldPopup_${sourceId}`;
				let popupElement = null;

				if (sourceElement.tagName === 'SELECT')
				{
					popupElement = document.createElement('select');
					popupElement.className = 'homey-form-select';
					popupElement.id = popupId;
					popupElement.innerHTML = sourceElement.innerHTML;
					popupElement.value = sourceElement.value;
				}
				else if (sourceElement.tagName === 'TEXTAREA')
				{
					popupElement = document.createElement('textarea');
					popupElement.className = 'homey-form-textarea';
					popupElement.id = popupId;
					popupElement.value = sourceElement.value;
					popupElement.style.minHeight = '100px';
				}
				else if (sourceElement.type === 'color')
				{
					popupElement = document.createElement('input');
					popupElement.className = 'homey-form-input';
					popupElement.type = 'color';
					popupElement.id = popupId;
					popupElement.value = sourceElement.value;
				}
				else
				{
					popupElement = document.createElement('input');
					popupElement.className = 'homey-form-input';
					popupElement.type = 'text';
					popupElement.id = popupId;
					popupElement.value = sourceElement.value;
					if (sourceElement.maxLength && sourceElement.maxLength > 0)
					{
						popupElement.maxLength = sourceElement.maxLength;
					}
				}

				if (suffix === 'Device')
				{
					const popupDeviceRow = document.createElement('div');
					popupDeviceRow.className = 'button-field-popup-device-row';

					popupDeviceIndicatorElement = document.createElement('div');
					popupDeviceIndicatorElement.className = 'button-field-popup-device-icon';
					popupDeviceIndicatorElement.setAttribute('aria-hidden', 'true');

					popupDeviceRow.appendChild(popupDeviceIndicatorElement);
					popupDeviceRow.appendChild(popupElement);
					wrapper.appendChild(popupDeviceRow);
				}
				else if (suffix === 'Capability')
				{
					const popupCapabilityRow = document.createElement('div');
					popupCapabilityRow.className = 'button-field-popup-capability-row';

					popupCapabilityIndicatorElement = document.createElement('div');
					popupCapabilityIndicatorElement.className = 'button-field-popup-capability-icon';
					popupCapabilityIndicatorElement.setAttribute('aria-hidden', 'true');

					popupCapabilityRow.appendChild(popupCapabilityIndicatorElement);
					popupCapabilityRow.appendChild(popupElement);
					wrapper.appendChild(popupCapabilityRow);
				}
				else
				{
					wrapper.appendChild(popupElement);
				}
				buttonFieldPopupBodyElement.appendChild(wrapper);
				popupElementsBySuffix[suffix] = popupElement;
				buttonFieldPopupBindings.push({ sourceElement, popupElement, suffix });
			}

			if (missingSuffixes.length > 0 && retryCount < 6)
			{
				setTimeout(() => openButtonFieldPopup(side, page, fieldSuffix, retryCount + 1), 80);
				return;
			}

			if (buttonFieldPopupBindings.length === 0)
			{
				focusButtonControlFromPopup(side, page, fieldSuffix, false);
				return;
			}

			if (popupElementsBySuffix.Device && popupElementsBySuffix.Capability)
			{
				if (popupDeviceIndicatorElement)
				{
					updatePopupDeviceIndicator(popupElementsBySuffix.Device, popupDeviceIndicatorElement);
				}
				if (popupCapabilityIndicatorElement)
				{
					updatePopupCapabilityIndicator(popupElementsBySuffix.Capability, popupCapabilityIndicatorElement);
				}

				popupElementsBySuffix.Device.addEventListener('change', function ()
				{
					const sourceDeviceElement = document.getElementById(`${side}${page}Device`);
					if (sourceDeviceElement)
					{
						sourceDeviceElement.value = popupElementsBySuffix.Device.value;
						buttonDeviceChanged(side, page);
					}

					if (popupDeviceIndicatorElement)
					{
						updatePopupDeviceIndicator(popupElementsBySuffix.Device, popupDeviceIndicatorElement);
					}

					syncButtonFieldPopupCapabilityOptions(side, page, popupElementsBySuffix.Capability);
					if (popupCapabilityIndicatorElement)
					{
						updatePopupCapabilityIndicator(popupElementsBySuffix.Capability, popupCapabilityIndicatorElement);
					}

					setTimeout(() =>
					{
						syncButtonFieldPopupCapabilityOptions(side, page, popupElementsBySuffix.Capability);
						if (popupCapabilityIndicatorElement)
						{
							updatePopupCapabilityIndicator(popupElementsBySuffix.Capability, popupCapabilityIndicatorElement);
						}
					}, 120);
					setTimeout(() =>
					{
						syncButtonFieldPopupCapabilityOptions(side, page, popupElementsBySuffix.Capability);
						if (popupCapabilityIndicatorElement)
						{
							updatePopupCapabilityIndicator(popupElementsBySuffix.Capability, popupCapabilityIndicatorElement);
						}
					}, 320);
				});

				popupElementsBySuffix.Capability.addEventListener('change', function ()
				{
					if (popupCapabilityIndicatorElement)
					{
						updatePopupCapabilityIndicator(popupElementsBySuffix.Capability, popupCapabilityIndicatorElement);
					}
				});

				syncButtonFieldPopupCapabilityOptions(side, page, popupElementsBySuffix.Capability, popupElementsBySuffix.Capability.value);
				if (popupCapabilityIndicatorElement)
				{
					updatePopupCapabilityIndicator(popupElementsBySuffix.Capability, popupCapabilityIndicatorElement);
				}
			}

			buttonFieldPopupOverlayElement.classList.add('visible');
			buttonFieldPopupOverlayElement.setAttribute('aria-hidden', 'false');

			const firstField = buttonFieldPopupBindings[0].popupElement;
			if (firstField && typeof firstField.focus === 'function')
			{
				setTimeout(() => firstField.focus(), 0);
			}
		}

		function focusButtonControlFromPopup(side, page, fieldSuffix, openPopup = true)
		{
			if (openPopup)
			{
				const popupSpec = getButtonFieldPopupSpec(side, fieldSuffix);
				if (popupSpec)
				{
					openButtonFieldPopup(side, page, fieldSuffix);
					return;
				}
			}

			const detailElement = document.getElementById(`${side}${page}Details`);
			if (detailElement)
			{
				detailElement.open = true;
			}

			const sectionElement = document.getElementById(`${side}${page}PanelSection`) || detailElement;
			if (sectionElement)
			{
				scrollToTop(sectionElement);
			}

			const focusElement = document.getElementById(`${side}${page}${fieldSuffix}`)
				|| document.getElementById(`${side}${page}TopText`)
				|| document.getElementById(`${side}${page}Device`);
			if (focusElement)
			{
				setTimeout(() =>
				{
					focusElement.focus();
				}, 260);
			}
		}

		function getDisplayFieldPopupSpec(fieldSuffix)
		{
			const labels = {
				page: Homey.__('settings.page'),
				Device: Homey.__('settings.device'),
				Capability: Homey.__('settings.capability'),
				Label: Homey.__('settings.topLabel'),
				Text: Homey.__('settings.text'),
				Unit: Homey.__('settings.unit'),
				X: Homey.__('settings.xPos'),
				Y: Homey.__('settings.yPos'),
				Width: Homey.__('settings.width'),
				Rounding: Homey.__('settings.rounding'),
				FontSize: Homey.__('settings.fontSize'),
				BoxType: Homey.__('settings.boxType'),
				BrokerId: Homey.__('settings.brokerId'),
				SVG: 'SVG',
			};

			// Display item editing now uses one complete popup regardless of click target.
			return {
				title: 'Properties',
				fields: ['page', 'Device', 'Capability', 'Label', 'Text', 'Unit', 'SVG', 'X', 'Y', 'Width', 'Rounding', 'FontSize', 'BoxType', 'BrokerId'],
				labels,
			};
		}

		function closeDisplayFieldPopup()
		{
			if (!displayFieldPopupOverlayElement)
			{
				return;
			}

			if (displayFieldPopupOverlayElement.contains(document.activeElement) && typeof document.activeElement?.blur === 'function')
			{
				document.activeElement.blur();
			}

			displayFieldPopupOverlayElement.classList.remove('visible');
			displayFieldPopupOverlayElement.setAttribute('aria-hidden', 'true');
			displayFieldPopupBindings = [];
			displayFieldPopupContext = null;
			if (displayFieldPopupBodyElement)
			{
				displayFieldPopupBodyElement.innerHTML = '';
			}
		}

		function syncDisplayFieldPopupCapabilityOptions(itemNo, popupCapabilityElement, selectedCapability = '')
		{
			if (!popupCapabilityElement)
			{
				return;
			}

			const sourceCapabilityElement = document.getElementById(`display${itemNo}Capability`);
			if (!sourceCapabilityElement)
			{
				return;
			}

			popupCapabilityElement.innerHTML = sourceCapabilityElement.innerHTML;
			const wantedValue = selectedCapability || sourceCapabilityElement.value;
			if (wantedValue)
			{
				popupCapabilityElement.value = wantedValue;
			}
		}

		function updateDisplayFieldPopupCapabilityState(popupElementsBySuffix)
		{
			if (!popupElementsBySuffix || !popupElementsBySuffix.Device || !popupElementsBySuffix.Capability)
			{
				return;
			}

			const deviceValue = popupElementsBySuffix.Device.value;
			const capabilityElement = popupElementsBySuffix.Capability;
			const capabilityRowElement = capabilityElement.closest('.button-field-popup-field');
			const capabilityLabelElement = capabilityRowElement ? capabilityRowElement.querySelector('.button-field-popup-label') : null;

			const hideCapability = (deviceValue === 'none' || deviceValue === 'customMQTT');
			if (capabilityRowElement)
			{
				capabilityRowElement.style.display = hideCapability ? 'none' : '';
			}

			if (capabilityLabelElement)
			{
				capabilityLabelElement.textContent = (deviceValue === '_variable_')
					? Homey.__('settings.variable')
					: Homey.__('settings.capability');
			}
		}

		function saveDisplayFieldPopup()
		{
			if (!displayFieldPopupBindings || displayFieldPopupBindings.length === 0)
			{
				closeDisplayFieldPopup();
				return;
			}

			if (displayFieldPopupContext && displayFieldPopupContext.popupElementsBySuffix && displayFieldPopupContext.popupElementsBySuffix.Device && displayFieldPopupContext.popupElementsBySuffix.Capability)
			{
				const itemNo = displayFieldPopupContext.itemNo;
				const deviceValue = displayFieldPopupContext.popupElementsBySuffix.Device.value;
				const capabilityValue = displayFieldPopupContext.popupElementsBySuffix.Capability.value;
				const shouldApplyCapability = (deviceValue !== 'none' && deviceValue !== 'customMQTT');

				const sourceDeviceElement = document.getElementById(`display${itemNo}Device`);
				const sourceCapabilityElement = document.getElementById(`display${itemNo}Capability`);

				if (sourceDeviceElement)
				{
					sourceDeviceElement.value = deviceValue;
					sourceDeviceElement.dispatchEvent(new Event('change', { bubbles: true }));
				}

				if (sourceCapabilityElement && shouldApplyCapability)
				{
					const applyCapabilityValue = function (attempt = 0)
					{
						const hasOption = Array.from(sourceCapabilityElement.options || []).some((option) => option.value === capabilityValue);
						if (hasOption)
						{
							sourceCapabilityElement.value = capabilityValue;
							sourceCapabilityElement.dispatchEvent(new Event('change', { bubbles: true }));
							return;
						}

						if (attempt < 8)
						{
							setTimeout(() => applyCapabilityValue(attempt + 1), 120);
						}
					};

					applyCapabilityValue(0);
				}
			}

			const pendingEventDispatches = [];
			for (const binding of displayFieldPopupBindings)
			{
				if (!binding || !binding.sourceElement || !binding.popupElement)
				{
					continue;
				}

				if (binding.suffix === 'Device' || binding.suffix === 'Capability')
				{
					continue;
				}

				if (binding.sourceElement.type === 'checkbox')
				{
					binding.sourceElement.checked = binding.popupElement.checked;
					pendingEventDispatches.push({ sourceElement: binding.sourceElement, checkbox: true });
				}
				else
				{
					binding.sourceElement.value = binding.popupElement.value;
					pendingEventDispatches.push({ sourceElement: binding.sourceElement, checkbox: false });
				}
			}

			for (const pendingDispatch of pendingEventDispatches)
			{
				if (!pendingDispatch || !pendingDispatch.sourceElement)
				{
					continue;
				}

				if (!pendingDispatch.checkbox)
				{
					pendingDispatch.sourceElement.dispatchEvent(new Event('input', { bubbles: true }));
				}
				pendingDispatch.sourceElement.dispatchEvent(new Event('change', { bubbles: true }));
			}

			renderDisplayInlineSimulator();
			if (displayPagePopupOverlayElement && displayPagePopupOverlayElement.classList.contains('visible'))
			{
				renderDisplayPagePopup();
			}
			refreshDisplayPopupLiveValues();

			closeDisplayFieldPopup();
		}

		function openDisplayFieldPopup(itemNo, fieldSuffix, retryCount = 0)
		{
			displayInlineSelectedItemNo = itemNo;
			if (!displayFieldPopupOverlayElement || !displayFieldPopupBodyElement || !displayFieldPopupTitleElement)
			{
				focusDisplayControlFromPopup(itemNo, fieldSuffix);
				return;
			}

			const popupSpec = getDisplayFieldPopupSpec(fieldSuffix);
			if (!popupSpec)
			{
				focusDisplayControlFromPopup(itemNo, fieldSuffix);
				return;
			}

			displayFieldPopupBindings = [];
			const popupElementsBySuffix = {};
			displayFieldPopupBodyElement.innerHTML = '';
			displayFieldPopupTitleElement.textContent = `${Homey.__('settings.displayItemlegend', { itemNo: itemNo + 1 })} - ${popupSpec.title}`;

			const missingSourceFields = [];
			for (const suffix of popupSpec.fields)
			{
				const sourceElement = document.getElementById(`display${itemNo}${suffix}`);
				if (!sourceElement)
				{
					missingSourceFields.push(suffix);
					continue;
				}

				const rowElement = document.createElement('div');
				rowElement.className = 'button-field-popup-field';

				const labelElement = document.createElement('label');
				labelElement.className = 'button-field-popup-label';
				const sourceLabel = document.querySelector(`label[for="display${itemNo}${suffix}"]`);
				const labelText = sourceLabel
					? sourceLabel.childNodes[0].textContent.trim()
					: (popupSpec.labels[suffix] || suffix);
				labelElement.textContent = labelText;
				rowElement.appendChild(labelElement);

				let popupElement;
				if (sourceElement.tagName === 'SELECT')
				{
					popupElement = document.createElement('select');
					popupElement.className = 'homey-form-select';
					popupElement.innerHTML = sourceElement.innerHTML;
					popupElement.value = sourceElement.value;
				}
				else if (sourceElement.tagName === 'TEXTAREA')
				{
					popupElement = document.createElement('textarea');
					popupElement.className = 'homey-form-textarea';
					popupElement.value = sourceElement.value;
					if (suffix === 'SVG')
					{
						popupElement.style.minHeight = '180px';
					}
				}
				else if (sourceElement.type === 'checkbox')
				{
					popupElement = document.createElement('input');
					popupElement.type = 'checkbox';
					popupElement.className = 'homey-form-checkbox-input';
					popupElement.checked = sourceElement.checked;
				}
				else
				{
					popupElement = document.createElement('input');
					popupElement.type = sourceElement.type || 'text';
					popupElement.className = 'homey-form-input';
					popupElement.value = sourceElement.value;
				}

				popupElement.id = `displayFieldPopup${itemNo}${suffix}`;
				rowElement.appendChild(popupElement);
				displayFieldPopupBodyElement.appendChild(rowElement);

				displayFieldPopupBindings.push({ suffix, sourceElement, popupElement });
				popupElementsBySuffix[suffix] = popupElement;
			}

			if (missingSourceFields.length > 0)
			{
				if (retryCount < 6)
				{
					setTimeout(() => openDisplayFieldPopup(itemNo, fieldSuffix, retryCount + 1), 80);
					return;
				}

				focusDisplayControlFromPopup(itemNo, fieldSuffix);
				return;
			}

			displayFieldPopupContext = { itemNo, popupElementsBySuffix };
			if (popupElementsBySuffix.Device && popupElementsBySuffix.Capability)
			{
				popupElementsBySuffix.Device.addEventListener('change', function ()
				{
					const sourceDeviceElement = document.getElementById(`display${itemNo}Device`);
					if (sourceDeviceElement)
					{
						sourceDeviceElement.value = popupElementsBySuffix.Device.value;
						sourceDeviceElement.dispatchEvent(new Event('change', { bubbles: true }));
					}
					updateDisplayFieldPopupCapabilityState(popupElementsBySuffix);
					syncDisplayFieldPopupCapabilityOptions(itemNo, popupElementsBySuffix.Capability);
					setTimeout(() =>
					{
						syncDisplayFieldPopupCapabilityOptions(itemNo, popupElementsBySuffix.Capability);
						updateDisplayFieldPopupCapabilityState(popupElementsBySuffix);
					}, 140);
				});

				syncDisplayFieldPopupCapabilityOptions(itemNo, popupElementsBySuffix.Capability, popupElementsBySuffix.Capability.value);
				updateDisplayFieldPopupCapabilityState(popupElementsBySuffix);
			}

			displayFieldPopupOverlayElement.classList.add('visible');
			displayFieldPopupOverlayElement.setAttribute('aria-hidden', 'false');

			const firstField = displayFieldPopupBindings[0].popupElement;
			if (firstField && typeof firstField.focus === 'function')
			{
				setTimeout(() => firstField.focus(), 0);
			}
		}

		function openDisplayFieldPopupFromInline(itemNo, fieldSuffix)
		{
			displayInlineSelectedItemNo = itemNo;
			renderDisplayInlineSimulator();
			openDisplayFieldPopup(itemNo, fieldSuffix);
		}

		function handleDisplayInlineSimulatorClick(itemNo, fieldSuffix)
		{
			if (displayInlineSelectedItemNo !== itemNo)
			{
				displayInlineSelectedItemNo = itemNo;
				renderDisplayInlineSimulator();
				return;
			}

			openDisplayFieldPopupFromInline(itemNo, fieldSuffix);
		}

		function handleDisplayOverlaySimulatorClick(itemNo, fieldSuffix)
		{
			if (displayInlineSelectedItemNo !== itemNo)
			{
				displayInlineSelectedItemNo = itemNo;
				renderDisplayPagePopup();
				renderDisplayInlineSimulator();
				return;
			}

			openDisplayFieldPopup(itemNo, fieldSuffix);
		}
		function handleDisplaySurfaceBackgroundClick(event)
		{
			if (!event || !event.target)
			{
				return;
			}

			if (event.target.closest('.display-sim-item'))
			{
				return;
			}

			if (event.target.closest('.display-sim-status-bar'))
			{
				return;
			}

			if (displayInlineSelectedItemNo < 0)
			{
				return;
			}

			displayInlineSelectedItemNo = -1;
			renderDisplayInlineSimulator();
			if (displayPagePopupOverlayElement && displayPagePopupOverlayElement.classList.contains('visible'))
			{
				renderDisplayPagePopup();
			}
		}

		function closeDisplayPagePopup()
		{
			if (!displayPagePopupOverlayElement)
			{
				return;
			}

			if (displayPagePopupLiveRefreshTimer)
			{
				clearInterval(displayPagePopupLiveRefreshTimer);
				displayPagePopupLiveRefreshTimer = null;
			}

			displayPagePopupOverlayElement.classList.remove('visible');
			displayPagePopupOverlayElement.setAttribute('aria-hidden', 'true');
			if (configTypeElement && configTypeElement.value === 'displayConfig')
			{
				startDisplayInlineLiveRefresh();
			}
			if (!buttonPagePopupOverlayElement || !buttonPagePopupOverlayElement.classList.contains('visible'))
			{
				document.body.classList.remove('sim-panel-open');
				document.documentElement.style.setProperty('--button-sim-scroll-offset', '0px');
			}
		}

		function updateDisplayPagePopupScrollOffset()
		{
			if (!displayPagePopupOverlayElement || !displayPagePopupOverlayElement.classList.contains('visible'))
			{
				if (!buttonPagePopupOverlayElement || !buttonPagePopupOverlayElement.classList.contains('visible'))
				{
					document.body.classList.remove('sim-panel-open');
					document.documentElement.style.setProperty('--button-sim-scroll-offset', '0px');
				}
				return;
			}

			const fixedTopElement = document.querySelector('.fixedTop');
			const fixedTopHeight = fixedTopElement ? fixedTopElement.offsetHeight : 0;
			const simDialogElement = document.querySelector('.display-sim-overlay.visible .display-sim-dialog');
			const simBottom = simDialogElement ? Math.max(0, simDialogElement.getBoundingClientRect().bottom) : 0;
			const requiredOffset = Math.max(0, Math.round(simBottom - fixedTopHeight + 8));
			document.documentElement.style.setProperty('--button-sim-scroll-offset', `${requiredOffset}px`);
			document.body.classList.add('sim-panel-open');
		}

		function normalizeDisplayConfigurationPages(displayConfiguration)
		{
			if (!displayConfiguration || typeof displayConfiguration !== 'object')
			{
				return;
			}

			if (!Array.isArray(displayConfiguration.items))
			{
				displayConfiguration.items = [];
			}

			let highestItemPage = 0;
			for (const item of displayConfiguration.items)
			{
				if (!item || typeof item !== 'object')
				{
					continue;
				}

				const parsedPage = parseInt(item.page, 10);
				const normalizedPage = Number.isNaN(parsedPage) ? 0 : Math.max(0, parsedPage);
				item.page = normalizedPage;
				highestItemPage = Math.max(highestItemPage, normalizedPage);
			}

			const configuredPageCount = parseInt(displayConfiguration.pageCount, 10);
			const normalizedPageCount = Number.isNaN(configuredPageCount) ? 0 : Math.max(0, configuredPageCount);
			displayConfiguration.pageCount = Math.max(1, normalizedPageCount, highestItemPage + 1);
		}

		function normalizeDisplayConfigurationsPages(displayConfigurations)
		{
			if (!Array.isArray(displayConfigurations))
			{
				return;
			}

			for (const displayConfiguration of displayConfigurations)
			{
				normalizeDisplayConfigurationPages(displayConfiguration);
			}
		}

		function getDisplayPopupPages(displayConfiguration)
		{
			const pages = new Set();
			pages.add(0);
			if (!displayConfiguration)
			{
				return [0];
			}

			const configuredPageCount = parseInt(displayConfiguration.pageCount, 10);
			if (!Number.isNaN(configuredPageCount) && configuredPageCount > 0)
			{
				for (let pageNo = 0; pageNo < configuredPageCount; pageNo++)
				{
					pages.add(pageNo);
				}
			}

			if (Array.isArray(displayConfiguration.items))
			{
				for (const item of displayConfiguration.items)
				{
					const pageValue = parseInt(item.page, 10);
					if (!Number.isNaN(pageValue) && pageValue >= 0)
					{
						pages.add(pageValue);
					}
				}
			}

			if (!pages.size)
			{
				return [0];
			}

			return Array.from(pages).sort((a, b) => a - b);
		}

		function getDisplayPageSelectOptionsMarkup(displayConfiguration, selectedPage)
		{
			const pages = getDisplayPopupPages(displayConfiguration);
			const maxPage = pages.length ? Math.max(...pages) : 0;
			const normalizedSelected = Math.max(0, Math.min(parseInt(selectedPage, 10) || 0, maxPage));
			let options = '';

			for (let page = 0; page <= maxPage; page++)
			{
				const selectedAttr = (page === normalizedSelected) ? ' selected' : '';
				options += `<option value="${page}"${selectedAttr}>${formatDisplayPageLabel(page)}</option>`;
			}

			return options;
		}

		function getDisplayPopupFieldValue(item, itemNo, suffix, fallback = '')
		{
			const allowEmptyFieldValue = (suffix === 'Label' || suffix === 'Text' || suffix === 'Unit' || suffix === 'SVG');
			const fieldElement = document.getElementById(`display${itemNo}${suffix}`);
			if (fieldElement && typeof fieldElement.value === 'string')
			{
				const rawValue = fieldElement.value;
				if (rawValue === '')
				{
					return allowEmptyFieldValue ? '' : fallback;
				}

				if (rawValue === 'undefined' || rawValue === 'null')
				{
					return fallback;
				}
				return rawValue;
			}

			if (item && item[suffix.charAt(0).toLowerCase() + suffix.slice(1)] !== undefined)
			{
				const itemValue = item[suffix.charAt(0).toLowerCase() + suffix.slice(1)];
				if (itemValue === '' || itemValue === 'undefined' || itemValue === 'null' || itemValue === undefined || itemValue === null)
				{
					return fallback;
				}
				return itemValue;
			}

			return fallback;
		}

		function sanitizeDisplayString(value, fallback = '')
		{
			if (value === undefined || value === null)
			{
				return fallback;
			}

			const trimmed = String(value).trim();
			if (trimmed === '' || trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null')
			{
				return fallback;
			}

			return String(value);
		}

		function clampDisplayPercent(value, fallback)
		{
			const numeric = parseFloat(value);
			if (Number.isNaN(numeric))
			{
				return fallback;
			}
			return Math.max(0, Math.min(100, numeric));
		}

		function getDisplayPopupFontPx(fontSize)
		{
			const key = parseInt(fontSize, 10);
			if (DISPLAY_FONT_SIZE_LOOKUP[key])
			{
				return DISPLAY_FONT_SIZE_LOOKUP[key];
			}
			return DISPLAY_FONT_SIZE_LOOKUP[1];
		}

		function isDisplayPopupFontBold(fontSize)
		{
			const key = parseInt(fontSize, 10);
			return DISPLAY_BOLD_FONT_SIZES.has(key);
		}

		function getDisplayPopupItemRuntime(item, itemNo)
		{
			const deviceId = sanitizeDisplayString(getDisplayPopupFieldValue(item, itemNo, 'Device', item.device || ''), '');
			const capabilityId = sanitizeDisplayString(getDisplayPopupFieldValue(item, itemNo, 'Capability', item.capability || ''), '');
			const configuredUnit = sanitizeDisplayString(getDisplayPopupFieldValue(item, itemNo, 'Unit', item.unit || ''), '');
			const roundingRaw = parseInt(getDisplayPopupFieldValue(item, itemNo, 'Rounding', item.rounding || -1), 10);
			const rounding = Number.isNaN(roundingRaw) ? -1 : roundingRaw;
			const valueKey = `${deviceId}|${capabilityId}`;

			return {
				deviceId,
				capabilityId,
				configuredUnit,
				rounding,
				valueKey,
			};
		}

		function formatDisplayPopupValue(value, rounding)
		{
			if (value === undefined || value === null)
			{
				return '';
			}

			if (typeof value === 'boolean')
			{
				return value ? 'On' : 'Off';
			}

			if (typeof value === 'number')
			{
				if (rounding >= 0)
				{
					return value.toFixed(rounding);
				}
				return Number.isInteger(value) ? `${value}` : `${value}`;
			}

			return sanitizeDisplayString(value, '');
		}

		function refreshDisplayPopupLiveValues()
		{
			if (displayItemMoveState || displayItemResizeState)
			{
				// Avoid interrupting drag/resize with async refresh re-renders.
				return;
			}

			const displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];
			if (!displayConfiguration || !Array.isArray(displayConfiguration.items))
			{
				return;
			}

			const pages = getDisplayPopupPages(displayConfiguration);
			if (!pages.includes(displayPagePopupCurrentPage))
			{
				displayPagePopupCurrentPage = pages[0];
			}

			const requests = [];
			const variableIds = new Set();
			for (let itemNo = 0; itemNo < displayConfiguration.items.length; itemNo++)
			{
				const item = displayConfiguration.items[itemNo];
				const itemPage = parseInt(getDisplayPopupFieldValue(item, itemNo, 'page', item.page || 0), 10) || 0;
				if (itemPage !== displayPagePopupCurrentPage)
				{
					continue;
				}

				const runtime = getDisplayPopupItemRuntime(item, itemNo);
				if (runtime.deviceId === '_variable_' && runtime.capabilityId)
				{
					variableIds.add(runtime.capabilityId);
					continue;
				}

				if (!runtime.deviceId || !runtime.capabilityId || runtime.deviceId === 'none' || runtime.deviceId === 'customMQTT')
				{
					continue;
				}

				requests.push(new Promise((resolve) =>
				{
					Homey.api('POST', '/device_capability_value/',
						{
							deviceId: runtime.deviceId,
							capabilityId: runtime.capabilityId,
						},
						function (err, result)
						{
							if (!err && result && result.success)
							{
								displayPagePopupLiveValueCache.set(runtime.valueKey,
									{
										value: result.value,
										unit: sanitizeDisplayString(result.unit, ''),
										fetchedAt: Date.now(),
									});
							}
							resolve();
						});
				}));
			}

			if (variableIds.size > 0)
			{
				requests.push(new Promise((resolve) =>
				{
					Homey.api('POST', '/get_variables/', {}, function (err, variables)
					{
						if (!err && variables)
						{
							displayPagePopupVariableValueCache.clear();
							for (const variable of Object.values(variables))
							{
								if (variable && variable.id)
								{
									displayPagePopupVariableValueCache.set(variable.id, variable.value);
								}
							}
							displayPagePopupVariableValueFetchedAt = Date.now();
						}
						resolve();
					});
				}));
			}

			if (requests.length === 0)
			{
				renderDisplayInlineSimulator();
				if (displayPagePopupOverlayElement && displayPagePopupOverlayElement.classList.contains('visible'))
				{
					renderDisplayPagePopup();
				}
				return;
			}

			Promise.all(requests).then(() =>
			{
				if (displayItemMoveState || displayItemResizeState)
				{
					return;
				}

				renderDisplayInlineSimulator();
				if (displayPagePopupOverlayElement && displayPagePopupOverlayElement.classList.contains('visible'))
				{
					renderDisplayPagePopup();
				}
			});
		}

		function focusDisplayControlFromPopup(itemNo, fieldSuffix)
		{
			if (configTypeElement && configTypeElement.value !== 'displayConfig')
			{
				configTypeElement.value = 'displayConfig';
				configTypeChanged('displayConfig');
			}

			const alignDisplaySectionBelowSim = function (attempt = 0)
			{
				const focusCandidatesBySuffix = {
					Label: ['Label'],
					Device: ['Device'],
					Text: ['Text', 'Capability', 'Device', 'Label'],
					Unit: ['Unit', 'Capability', 'Text', 'Label'],
					SVG: ['SVG', 'Text', 'Capability', 'Device', 'Label'],
					Capability: ['Capability', 'Device', 'Label'],
				};
				const suffixCandidates = focusCandidatesBySuffix[fieldSuffix] || [fieldSuffix, 'Label'];

				const resolveFocusElement = function (preferVisible = false, allowLabelFallback = true)
				{
					for (const suffix of suffixCandidates)
					{
						const candidateElement = document.getElementById(`display${itemNo}${suffix}`);
						if (!candidateElement)
						{
							continue;
						}

						if (!preferVisible)
						{
							return candidateElement;
						}

						if (candidateElement.offsetParent !== null)
						{
							return candidateElement;
						}
					}

					return allowLabelFallback ? document.getElementById(`display${itemNo}Label`) : null;
				};

				const initialFocusElement = resolveFocusElement(false, fieldSuffix !== 'Device');
				if (!initialFocusElement)
				{
					if (attempt < 6)
					{
						setTimeout(() => alignDisplaySectionBelowSim(attempt + 1), 60);
					}
					return;
				}

				const detailsElement = initialFocusElement.closest('details');
				if (detailsElement)
				{
					const wasOpen = detailsElement.open;
					detailsElement.open = true;
					if (!wasOpen && attempt < 6)
					{
						setTimeout(() => alignDisplaySectionBelowSim(attempt + 1), 60);
						return;
					}
				}

				const currentFocusElement = resolveFocusElement(true, fieldSuffix !== 'Device') || initialFocusElement;

				updateDisplayPagePopupScrollOffset();

				const sectionElement = currentFocusElement.closest('.horizontalgroup');
				if (!sectionElement)
				{
					if (attempt < 6)
					{
						setTimeout(() => alignDisplaySectionBelowSim(attempt + 1), 60);
					}
					return;
				}

				const fixedTopElement = document.querySelector('.fixedTop');
				const fixedTopHeight = fixedTopElement ? fixedTopElement.offsetHeight : 0;
				const simDialogElement = document.querySelector('.display-sim-overlay.visible .display-sim-dialog');
				const simBottom = simDialogElement ? Math.max(0, simDialogElement.getBoundingClientRect().bottom) : 0;
				const targetViewportTop = Math.max(fixedTopHeight + 8, simBottom + 8);
				const fieldLabelElement = currentFocusElement.id
					? document.querySelector(`label[for="${currentFocusElement.id}"]`)
					: null;
				const focusAnchorElement = fieldLabelElement || currentFocusElement;
				const targetTop = Math.max(0, focusAnchorElement.getBoundingClientRect().top + window.scrollY - targetViewportTop);
				window.scrollTo({ top: targetTop, behavior: 'auto' });

				if (attempt === 0)
				{
					sectionElement.classList.add('display-item-highlight');
					setTimeout(() =>
					{
						sectionElement.classList.remove('display-item-highlight');
					}, 1400);
				}

				setTimeout(() =>
				{
					if (typeof currentFocusElement.focus === 'function')
					{
						currentFocusElement.focus();
					}
				}, 80);

				if (attempt < 1)
				{
					setTimeout(() => alignDisplaySectionBelowSim(attempt + 1), 80);
				}
			};

			requestAnimationFrame(() =>
			{
				alignDisplaySectionBelowSim(0);
			});
		}

		function renderDisplaySimulatorSurface(surfaceElement, titleElement, prevElement, nextElement, statusPositionElement, clickHandlerName, updateScrollOffset = false)
		{
			if (!surfaceElement)
			{
				return;
			}

			const displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];
			const displayMoveHandleTitle = escapeHtml(Homey.__("settings.displaySimMoveHandleTitle"));
			const displayMoveHandleAria = escapeHtml(Homey.__("settings.displaySimMoveHandleAria"));
			const displayResizeHandleTitle = escapeHtml(Homey.__("settings.displaySimResizeHandleTitle"));
			const displayResizeHandleAria = escapeHtml(Homey.__("settings.displaySimResizeHandleAria"));
			const displayTooltipX = escapeHtml(Homey.__("settings.displaySimTooltipX"));
			const displayTooltipY = escapeHtml(Homey.__("settings.displaySimTooltipY"));
			const displayTooltipW = escapeHtml(Homey.__("settings.displaySimTooltipW"));
			const displayLoadingPlaceholder = escapeHtml(Homey.__("settings.displaySimLoading"));
			const displayEmptyMessage = escapeHtml(Homey.__("settings.displaySimEmptyMessage"));
			const displayStatusLeftPlaceholder = escapeHtml(Homey.__("settings.displaySimStatusLeftPlaceholder"));
			const displayStatusRightPlaceholder = escapeHtml(Homey.__("settings.displaySimStatusRightPlaceholder"));
			if (!displayConfiguration || !Array.isArray(displayConfiguration.items))
			{
				surfaceElement.innerHTML = '';
				if (displayInlineSimDeleteItemElement)
				{
					displayInlineSimDeleteItemElement.disabled = true;
				}
				if (displayInlineSimDeletePageElement)
				{
					displayInlineSimDeletePageElement.disabled = true;
				}
				if (titleElement)
				{
					renderDisplayPageHeaderTitle(titleElement, 0, 1);
				}
				return;
			}

			const pages = getDisplayPopupPages(displayConfiguration);
			if (!pages.includes(displayPagePopupCurrentPage))
			{
				displayPagePopupCurrentPage = pages[0];
			}
			const highestPageNumber = pages.length ? Math.max(...pages) : 0;
			const totalPages = Math.max(1, highestPageNumber + 1);
			const showPageZeroEverywhere = !!(displayInlineSimShowPageZeroElement && displayInlineSimShowPageZeroElement.checked && displayPagePopupCurrentPage !== 0);

			const pageItems = [];
			for (let itemNo = 0; itemNo < displayConfiguration.items.length; itemNo++)
			{
				const item = displayConfiguration.items[itemNo];
				const itemPage = parseInt(getDisplayPopupFieldValue(item, itemNo, 'page', item.page || 0), 10) || 0;
				const isPageZeroOverlay = (showPageZeroEverywhere && itemPage === 0);
				if (itemPage === displayPagePopupCurrentPage || isPageZeroOverlay)
				{
					pageItems.push({ item, itemNo, isPageZeroOverlay });
				}
			}

			let statusBarPosition = 0;
			for (const { item, itemNo, isPageZeroOverlay } of pageItems)
			{
				if (isPageZeroOverlay)
				{
					continue;
				}
				const statusBarRaw = parseInt(getDisplayPopupFieldValue(item, itemNo, 'StatusBarPosition', item.statusBarPosition || 0), 10);
				const statusBarValue = Number.isNaN(statusBarRaw) ? 0 : Math.max(0, Math.min(statusBarRaw, 2));
				if (statusBarValue > 0)
				{
					statusBarPosition = statusBarValue;
					break;
				}
			}

			if (displayPagePopupStatusBarPosition === null)
			{
				displayPagePopupStatusBarPosition = statusBarPosition;
			}
			else
			{
				statusBarPosition = displayPagePopupStatusBarPosition;
			}

			if (statusPositionElement)
			{
				statusPositionElement.value = `${statusBarPosition}`;
			}

			const statusBarMarkup = statusBarPosition === 0
				? ''
				: `<div class="display-sim-status-bar ${statusBarPosition === 1 ? 'display-sim-status-bar-top' : 'display-sim-status-bar-bottom'}"><span class="display-sim-status-left">${displayStatusLeftPlaceholder}</span><span class="display-sim-status-right">${displayStatusRightPlaceholder}</span></div>`;

			const markup = pageItems.map(({ item, itemNo, isPageZeroOverlay }) =>
			{
				const runtime = getDisplayPopupItemRuntime(item, itemNo);
				const xPercent = clampDisplayPercent(getDisplayPopupFieldValue(item, itemNo, 'X', item.xPos || 0), 0);
				const yPercent = clampDisplayPercent(getDisplayPopupFieldValue(item, itemNo, 'Y', item.yPos || 0), 0);
				const widthPercent = Math.max(2, clampDisplayPercent(getDisplayPopupFieldValue(item, itemNo, 'Width', item.width || 100), 100));
				const explicitTopLabel = sanitizeDisplayString(getDisplayPopupFieldValue(item, itemNo, 'Label', item.label || ''), '');
				const hasExplicitLabel = !!explicitTopLabel;
				const renderedLabel = escapeHtml(explicitTopLabel);
				const staticTextFallback = sanitizeDisplayString(item.text, '');
				let displayValueRaw = '';
				let liveUnit = runtime.configuredUnit;

				if (runtime.deviceId === 'none' || runtime.deviceId === 'customMQTT' || !runtime.deviceId || !runtime.capabilityId)
				{
					displayValueRaw = getDisplayPopupFieldValue(item, itemNo, 'Text', staticTextFallback);
				}

				if (runtime.deviceId === '_variable_' && runtime.capabilityId)
				{
					const variableValue = displayPagePopupVariableValueCache.get(runtime.capabilityId);
					displayValueRaw = (variableValue !== undefined) ? variableValue : staticTextFallback;
				}
				else if (runtime.deviceId && runtime.capabilityId && runtime.deviceId !== 'none' && runtime.deviceId !== 'customMQTT')
				{
					const cacheEntry = displayPagePopupLiveValueCache.get(runtime.valueKey);
					if (cacheEntry)
					{
						displayValueRaw = (cacheEntry.value !== undefined && cacheEntry.value !== null) ? cacheEntry.value : '';
						if (!liveUnit)
						{
							liveUnit = cacheEntry.unit || '';
						}
					}
					else
					{
						displayValueRaw = '';
					}
				}

				const svgRaw = getDisplayPopupFieldValue(item, itemNo, 'SVG', item.svg || '');
				const valueSvgMarkup = getSvgPreviewMarkup((typeof displayValueRaw === 'string') ? displayValueRaw : '');
				const fieldSvgMarkup = getSvgPreviewMarkup(svgRaw || '');
				const effectiveSvgMarkup = valueSvgMarkup || fieldSvgMarkup;
				const text = escapeHtml(formatDisplayPopupValue(displayValueRaw, runtime.rounding));
				const unitText = escapeHtml(sanitizeDisplayString(liveUnit, ''));
				const configuredFontSize = getDisplayPopupFieldValue(item, itemNo, 'FontSize', item.fontSize || 1);
				const fontPx = getDisplayPopupFontPx(configuredFontSize);
				const fontWeight = isDisplayPopupFontBold(configuredFontSize) ? 700 : 400;
				const boxType = parseInt(getDisplayPopupFieldValue(item, itemNo, 'BoxType', item.boxType || 0), 10) || 0;
				const underlinedClass = (boxType === 0) ? 'display-sim-item-underlined' : '';

				const showValueSvg = !!effectiveSvgMarkup;
				const hasTextValue = !!sanitizeDisplayString(text, '');
				const isDynamicValueSource = (runtime.deviceId === '_variable_')
					|| (runtime.deviceId && runtime.deviceId !== 'none' && runtime.deviceId !== 'customMQTT' && runtime.capabilityId);
				const svgFocusSuffix = (valueSvgMarkup && isDynamicValueSource) ? 'Device' : 'SVG';
				const valueFocusSuffix = (runtime.deviceId === 'none') ? 'Text' : 'Device';
				const needsLivePlaceholder = isDynamicValueSource && !hasTextValue && !showValueSvg;
				const renderedText = needsLivePlaceholder ? displayLoadingPlaceholder : (text || '&nbsp;');
				const hasUnitValue = !(needsLivePlaceholder || showValueSvg) && !!unitText;
				const valueClass = needsLivePlaceholder ? 'display-sim-text display-sim-text-loading' : 'display-sim-text';
				const valueRowClass = hasUnitValue ? 'display-sim-value-row' : 'display-sim-value-row display-sim-value-row-no-unit';
				const valueTextPaddingTop = hasExplicitLabel ? 10 : 30;

				const isSelected = !isPageZeroOverlay && (itemNo === displayInlineSelectedItemNo);
				const selectedClass = isSelected ? ' display-sim-item-selected' : '';
				const overlayClass = isPageZeroOverlay ? ' display-sim-item-page-zero-overlay' : '';
				const labelClick = isPageZeroOverlay ? '' : ` onclick="event.stopPropagation(); ${clickHandlerName}(${itemNo}, 'Label')"`;
				const itemClick = isPageZeroOverlay ? '' : ` onclick="${clickHandlerName}(${itemNo}, 'Label')"`;
				const svgClick = isPageZeroOverlay ? '' : ` onclick="event.stopPropagation(); ${clickHandlerName}(${itemNo}, '${svgFocusSuffix}')"`;
				const valueRowClick = isPageZeroOverlay ? '' : ` onclick="event.stopPropagation(); ${clickHandlerName}(${itemNo}, '${valueFocusSuffix}')"`;
				const unitClick = isPageZeroOverlay ? '' : ` onclick="event.stopPropagation(); ${clickHandlerName}(${itemNo}, 'Unit')"`;
				return `<div class="display-sim-item ${underlinedClass}${selectedClass}${overlayClass}" style="left:${xPercent}%; top:${yPercent}%; width:${widthPercent}%;" data-item-no="${itemNo}" data-left-percent="${xPercent}" data-top-percent="${yPercent}" data-width-percent="${widthPercent}"${itemClick}>
					${hasExplicitLabel ? `<div class="display-sim-top-label"${labelClick}>${renderedLabel}</div>` : ''}
					${showValueSvg
						? `<div class="display-sim-svg"${svgClick}>${effectiveSvgMarkup}</div>`
						: `<div class="${valueRowClass}"${valueRowClick}>
							<div class="${valueClass}" style="font-size:${fontPx}px;font-weight:${fontWeight};padding-top:${valueTextPaddingTop}px;">${renderedText}</div>
								${hasUnitValue ? `<div class="display-sim-unit"${unitClick} style="font-size:${Math.max(15, Math.floor(fontPx * 0.52))}px;font-weight:${fontWeight};">${unitText}</div>` : ''}
						</div>`}
					${isSelected ? `<button type="button" class="display-sim-move-handle" title="${displayMoveHandleTitle}" onpointerdown="startDisplayItemMoveDrag(event, ${itemNo})" onclick="event.stopPropagation();" aria-label="${displayMoveHandleAria}"><span aria-hidden="true">↑↓←→</span></button><button type="button" class="display-sim-resize-handle" title="${displayResizeHandleTitle}" onpointerdown="startDisplayItemWidthDrag(event, ${itemNo})" onclick="event.stopPropagation();" aria-label="${displayResizeHandleAria}"><span aria-hidden="true">↔</span></button><div class="display-sim-resize-tooltip display-sim-move-tooltip" aria-hidden="true">${displayTooltipX}: ${Math.round(xPercent)}% ${displayTooltipY}: ${Math.round(yPercent)}%</div><div class="display-sim-resize-tooltip display-sim-size-tooltip" aria-hidden="true">${displayTooltipW}: ${Math.round(widthPercent * 10) / 10}%</div>` : ''}
				</div>`;
			}).join('');

			const emptyStateMarkup = (pageItems.length === 0)
				? `<div class="display-sim-empty-message">${displayEmptyMessage}</div>`
				: '';

			surfaceElement.innerHTML = statusBarMarkup + emptyStateMarkup + markup;

			renderDisplayPageHeaderTitle(titleElement, displayPagePopupCurrentPage, totalPages);

			if (prevElement)
			{
				prevElement.disabled = (pages.indexOf(displayPagePopupCurrentPage) <= 0);
			}

			if (nextElement)
			{
				nextElement.disabled = (pages.indexOf(displayPagePopupCurrentPage) >= pages.length - 1);
			}

			if (displayInlineSimDeleteItemElement)
			{
				const hasSelection = pageItems.some((entry) => !entry.isPageZeroOverlay && entry.itemNo === displayInlineSelectedItemNo);
				displayInlineSimDeleteItemElement.disabled = !hasSelection;
			}

			if (displayInlineSimDeletePageElement)
			{
				displayInlineSimDeletePageElement.disabled = !(displayPagePopupCurrentPage > 0);
			}

			if (updateScrollOffset)
			{
				updateDisplayPagePopupScrollOffset();
			}
		}

		function renderDisplayPagePopup()
		{
			renderDisplaySimulatorSurface(
				displayPagePopupSurfaceElement,
				displayPagePopupTitleElement,
				displayPagePopupPrevElement,
				displayPagePopupNextElement,
				displayPagePopupStatusBarPositionElement,
				'handleDisplayOverlaySimulatorClick',
				true,
			);
		}

		function renderDisplayInlineSimulator()
		{
			renderDisplaySimulatorSurface(
				displayInlineSimSurfaceElement,
				displayInlineSimTitleElement,
				displayInlineSimPrevElement,
				displayInlineSimNextElement,
				displayInlineSimStatusBarPositionElement,
				'handleDisplayInlineSimulatorClick',
				false,
			);
		}

		function openDisplayPagePopup(page)
		{
			if (!displayPagePopupOverlayElement)
			{
				return;
			}

			const displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];
			if (!displayConfiguration || !Array.isArray(displayConfiguration.items))
			{
				return;
			}

			const pages = getDisplayPopupPages(displayConfiguration);
			displayPagePopupCurrentPage = pages.includes(page) ? page : pages[0];
			if (displayPagePopupStatusBarPositionElement)
			{
				displayPagePopupStatusBarPositionElement.onchange = function ()
				{
					const selectedStatusBarPosition = parseInt(this.value, 10) || 0;
					displayPagePopupStatusBarPosition = selectedStatusBarPosition;
					Homey.set('displayPagePopupStatusBarPosition', selectedStatusBarPosition);
					for (const item of displayConfiguration.items)
					{
						const itemPage = parseInt(item.page, 10) || 0;
						if (itemPage === displayPagePopupCurrentPage)
						{
							item.statusBarPosition = selectedStatusBarPosition;
						}
					}
					renderDisplayPagePopup();
				};
			}
			displayPagePopupOverlayElement.classList.add('visible');
			displayPagePopupOverlayElement.setAttribute('aria-hidden', 'false');
			stopDisplayInlineLiveRefresh();
			if (displayPagePopupLiveRefreshTimer)
			{
				clearInterval(displayPagePopupLiveRefreshTimer);
			}
			displayPagePopupLiveRefreshTimer = setInterval(refreshDisplayPopupLiveValues, DISPLAY_SIM_LIVE_REFRESH_MS);
			renderDisplayPagePopup();
			refreshDisplayPopupLiveValues();
		}

		function stepDisplayPagePopup(delta)
		{
			const displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];
			if (!displayConfiguration || !Array.isArray(displayConfiguration.items))
			{
				return;
			}

			const pages = getDisplayPopupPages(displayConfiguration);
			const pageIndex = pages.indexOf(displayPagePopupCurrentPage);
			if (pageIndex < 0)
			{
				displayPagePopupCurrentPage = pages[0];
			}
			else
			{
				const nextIndex = Math.max(0, Math.min(pageIndex + delta, pages.length - 1));
				displayPagePopupCurrentPage = pages[nextIndex];
			}

			renderDisplayPagePopup();
			refreshDisplayPopupLiveValues();
		}

		function sortDevices(devicesArray)
		{
			return devicesArray.sort((a, b) =>
			{
				const zoneA = a.zone.name ?? a.zoneName;
				const zoneB = b.zone.name ?? b.zoneName;

				if (zoneA < zoneB)
				{
					return -1;
				}
				if (zoneA > zoneB)
				{
					return 1;
				}
				return 0;
			});
		}

		function filterButtonDevices(devices)
		{
			return devices.filter((device) =>
			{
				// Check if at least one capability has type "boolean"
				if (device.capabilitiesObj)
				{
					return Object.values(device.capabilitiesObj).some((capability) =>
					{
						return ((capability.type === "boolean") || (capability.id === "dim") || (capability.id === "windowcoverings_state"));
					});
				}
			});
		}

		// Fetch the devices and then update the displays
		function getDevices()
		{
			Homey.api('POST', '/Devices/', {}, function (err, devices)
			{
				if (err) return Homey.alert(err);

				devices = Object.values(devices);

				displayDevicesArray = sortDevices(devices);
				displayDevicesFetched = true;
				fillDisplayDevices();

				buttonDevicesArray = sortDevices(filterButtonDevices(devices));
				buttonDevicesFetched = true;

				// Get the current configuration
				var buttonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];

				writeButtonsections(buttonPanelConfiguration.length);
				updateButtonPanelControls();
			});
		}

		function fillButtonDevices()
		{
			// fill the device lists with devices
			if (buttonDevicesFetched)
			{
				// Get the number of pages in the current configuration
				var buttonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];

				// Make sure buttonPanelConfiguration is an array
				if (!Array.isArray(buttonPanelConfiguration))
				{
					buttonPanelConfiguration = [buttonPanelConfiguration];
					localButtonConfigurations[currentButtonConfigurationNo] = buttonPanelConfiguration;
				}
				var numPages = buttonPanelConfiguration.length;

				for (let i = 0; i < numPages; i++)
				{
					const leftElement = document.getElementById(`left${i}Device`);
					fillDevicesElement(leftElement, buttonDevicesArray);

					// Select the current device
					const leftDevice = buttonPanelConfiguration[i].leftDevice;
					if (leftDevice)
					{
						// If the device is not in the element options list then add it
						if (!Array.from(leftElement.options).some(option => option.value === leftDevice))
						{
							var option = document.createElement("option");
							option.text = buttonPanelConfiguration[i].leftDeviceName + " (Missing)";
							option.value = leftDevice;
							leftElement.add(option);

							leftElement.value = leftDevice;

							// As the device is missing the capability is also missing so add it to the list
							var option = document.createElement("option");
							option.text = buttonPanelConfiguration[i].leftCapabilityName + " (Missing)";
							option.value = buttonPanelConfiguration[i].leftCapability;
							document.getElementById(`left${i}Capability`).add(option);

							// Now select it
							document.getElementById(`left${i}Capability`).value = buttonPanelConfiguration[i].leftCapability;

							// Show the capability section
							document.getElementById(`left${i}Capability`).style.display = itemDisplyType;

						}
						else
						{
							leftElement.value = leftDevice;
							getCapabilities('left', i, document.getElementById(`left${i}Device`).value, buttonPanelConfiguration[i].leftCapability, buttonPanelConfiguration[i].leftCapabilityName);
						}
					}

					updateButtonDeviceIndicator('left', i);

					const rightElement = document.getElementById(`right${i}Device`);
					fillDevicesElement(rightElement, buttonDevicesArray);

					// Select the current device
					const rightDevice = buttonPanelConfiguration[i].rightDevice;
					if (rightDevice)
					{
						// If the device is not in the element options list then add it
						if (!Array.from(rightElement.options).some(option => option.value === rightDevice))
						{
							var option = document.createElement("option");
							option.text = buttonPanelConfiguration[i].rightDeviceName + " (Missing)";
							option.value = rightDevice;
							rightElement.add(option);

							rightElement.value = rightDevice;

							// As the device is missing the capability is also missing so add it to the list
							var option = document.createElement("option");
							option.text = buttonPanelConfiguration[i].rightCapabilityName + " (Missing)";
							option.value = buttonPanelConfiguration[i].rightCapability;
							document.getElementById(`right${i}Capability`).add(option);

							// Now select it
							document.getElementById(`right${i}Capability`).value = buttonPanelConfiguration[i].rightCapability;

							// Show the capability section
							document.getElementById(`right${i}Capability`).style.display = itemDisplyType;
						}
						else
						{
							rightElement.value = rightDevice;
							getCapabilities('right', i, document.getElementById(`right${i}Device`).value, buttonPanelConfiguration[i].rightCapability, buttonPanelConfiguration[i].rightCapabilityName);
						}
					}

					updateButtonDeviceIndicator('right', i);
				}
			};
		}

		function getButtonDeviceClassIcon(deviceClass)
		{
			switch ((deviceClass || '').toLowerCase())
			{
				case 'light': return '💡';
				case 'socket': return '🔌';
				case 'sensor': return '📟';
				case 'thermostat': return '🌡️';
				case 'speaker': return '🔊';
				case 'camera': return '📷';
				case 'lock': return '🔒';
				case 'windowcoverings': return '🪟';
				case 'none': return '•';
				case 'variable': return '𝑥';
				case 'custommqtt': return 'MQ';
				default: return '•';
			}
		}

		function getButtonCapabilityIcon(capabilityId)
		{
			const id = (capabilityId || '').toLowerCase();
			if (!id)
			{
				return '•';
			}

			if (id === 'dim' || id.includes('dim'))
			{
				return '◐';
			}

			if (id === 'windowcoverings_state' || id.includes('windowcoverings'))
			{
				return '🪟';
			}

			if (id === 'onoff' || id.includes('onoff'))
			{
				return '⏻';
			}

			if (id.includes('temperature'))
			{
				return '🌡️';
			}

			if (id.includes('humidity'))
			{
				return '💧';
			}

			if (id.includes('battery'))
			{
				return '🔋';
			}

			if (id.includes('lock'))
			{
				return '🔒';
			}

			return '•';
		}

		function getCapabilityIconUrl(capability)
		{
			if (!capability || typeof capability !== 'object')
			{
				return '';
			}

			const capabilityId = String(capability.id || '').trim();
			const iconObj = capability.iconObj || capability.icon_object || {};
			const rawIcon = capability.iconUrl
				|| capability.icon_url
				|| capability.icon
				|| iconObj.url
				|| iconObj.small
				|| iconObj.medium
				|| iconObj.large
				|| '';

			if (rawIcon)
			{
				const icon = String(rawIcon).trim();
				if (/^https?:\/\//i.test(icon) || icon.startsWith('data:') || icon.startsWith('blob:'))
				{
					return icon;
				}

				// Keep relative/local icon paths from Homey as-is so they resolve against current app origin.
				if (icon.startsWith('/') || icon.startsWith('./') || icon.startsWith('../'))
				{
					return icon;
				}

				// If Homey returned a bare filename-like token, prefer the standard reference icon location.
				if (/\.svg(\?.*)?$/i.test(icon) || /^[a-z0-9_.-]+$/i.test(icon))
				{
					return `https://athombv.github.io/athom-cloud-driver-reference/icons/${icon.replace(/^\/+/, '')}`;
				}

				return icon;
			}

			if (capabilityId)
			{
				return `https://athombv.github.io/athom-cloud-driver-reference/icons/${encodeURIComponent(capabilityId)}.svg`;
			}

			return '';
		}

		function updateButtonDeviceIndicator(side, page)
		{
			const indicatorElement = document.getElementById(`${side}${page}DeviceActiveIcon`);
			const deviceElement = document.getElementById(`${side}${page}Device`);
			if (!indicatorElement || !deviceElement)
			{
				return;
			}

			let iconUrl = '';
			let deviceClass = '';
			let selectedText = '';

			if (deviceElement.selectedIndex >= 0 && deviceElement.options[deviceElement.selectedIndex])
			{
				const option = deviceElement.options[deviceElement.selectedIndex];
				iconUrl = option.dataset.iconUrl || '';
				deviceClass = option.dataset.deviceClass || '';
				selectedText = option.text || '';
			}

			if (!iconUrl && !deviceClass)
			{
				if (deviceElement.value === 'none')
				{
					deviceClass = 'none';
				}
				else if (deviceElement.value === '_variable_')
				{
					deviceClass = 'variable';
				}
				else if (deviceElement.value === 'customMQTT')
				{
					deviceClass = 'custommqtt';
				}
				else
				{
					const selectedDevice = buttonDevicesArray.find((device) => device.id === deviceElement.value);
					if (selectedDevice)
					{
						const iconObj = selectedDevice.iconObj || {};
						iconUrl = iconObj.url || iconObj.small || iconObj.medium || iconObj.large || selectedDevice.icon || '';
						deviceClass = selectedDevice.class || '';
					}
				}
			}

			indicatorElement.innerHTML = '';
			indicatorElement.title = selectedText || '';

			if (iconUrl)
			{
				const iconImage = document.createElement('img');
				iconImage.className = 'button-device-active-icon-image';
				iconImage.src = iconUrl;
				iconImage.alt = '';
				iconImage.loading = 'lazy';
				iconImage.decoding = 'async';
				iconImage.addEventListener('error', function ()
				{
					const iconFallback = document.createElement('span');
					iconFallback.className = 'button-device-active-icon-fallback';
					iconFallback.textContent = getButtonDeviceClassIcon(deviceClass);
					if (iconImage.parentNode)
					{
						iconImage.parentNode.replaceChild(iconFallback, iconImage);
					}
				});
				indicatorElement.appendChild(iconImage);
			}
			else
			{
				const iconFallback = document.createElement('span');
				iconFallback.className = 'button-device-active-icon-fallback';
				iconFallback.textContent = getButtonDeviceClassIcon(deviceClass);
				indicatorElement.appendChild(iconFallback);
			}
		}

		function updateButtonCapabilityIndicator(side, page)
		{
			const indicatorElement = document.getElementById(`${side}${page}CapabilityActiveIcon`);
			const capabilityElement = document.getElementById(`${side}${page}Capability`);
			if (!indicatorElement || !capabilityElement)
			{
				return;
			}

			let selectedText = '';
			let iconUrl = '';
			if (capabilityElement.selectedIndex >= 0 && capabilityElement.options[capabilityElement.selectedIndex])
			{
				const option = capabilityElement.options[capabilityElement.selectedIndex];
				selectedText = option.text || '';
				iconUrl = option.dataset.iconUrl || '';
			}

			indicatorElement.innerHTML = '';
			if (iconUrl)
			{
				const iconImage = document.createElement('img');
				iconImage.className = 'button-capability-active-icon-image';
				iconImage.src = iconUrl;
				iconImage.alt = '';
				iconImage.loading = 'lazy';
				iconImage.decoding = 'async';
				iconImage.addEventListener('error', function ()
				{
					const iconFallback = document.createElement('span');
					iconFallback.className = 'button-capability-active-icon-fallback';
					iconFallback.textContent = getButtonCapabilityIcon(capabilityElement.value);
					if (iconImage.parentNode)
					{
						iconImage.parentNode.replaceChild(iconFallback, iconImage);
					}
				});
				indicatorElement.appendChild(iconImage);
			}
			else
			{
				const iconFallback = document.createElement('span');
				iconFallback.className = 'button-capability-active-icon-fallback';
				iconFallback.textContent = getButtonCapabilityIcon(capabilityElement.value);
				indicatorElement.appendChild(iconFallback);
			}

			indicatorElement.title = selectedText || '';
		}

		function updatePopupDeviceIndicator(deviceElement, indicatorElement)
		{
			if (!indicatorElement || !deviceElement)
			{
				return;
			}

			let iconUrl = '';
			let deviceClass = '';
			let selectedText = '';

			if (deviceElement.selectedIndex >= 0 && deviceElement.options[deviceElement.selectedIndex])
			{
				const option = deviceElement.options[deviceElement.selectedIndex];
				iconUrl = option.dataset.iconUrl || '';
				deviceClass = option.dataset.deviceClass || '';
				selectedText = option.text || '';
			}

			if (!iconUrl && !deviceClass)
			{
				if (deviceElement.value === 'none')
				{
					deviceClass = 'none';
				}
				else if (deviceElement.value === '_variable_')
				{
					deviceClass = 'variable';
				}
				else if (deviceElement.value === 'customMQTT')
				{
					deviceClass = 'custommqtt';
				}
				else
				{
					const selectedDevice = buttonDevicesArray.find((device) => device.id === deviceElement.value);
					if (selectedDevice)
					{
						const iconObj = selectedDevice.iconObj || {};
						iconUrl = iconObj.url || iconObj.small || iconObj.medium || iconObj.large || selectedDevice.icon || '';
						deviceClass = selectedDevice.class || '';
					}
				}
			}

			indicatorElement.innerHTML = '';
			indicatorElement.title = selectedText || '';

			if (iconUrl)
			{
				const iconImage = document.createElement('img');
				iconImage.className = 'button-field-popup-device-icon-image';
				iconImage.src = iconUrl;
				iconImage.alt = '';
				iconImage.loading = 'lazy';
				iconImage.decoding = 'async';
				iconImage.addEventListener('error', function ()
				{
					const iconFallback = document.createElement('span');
					iconFallback.className = 'button-field-popup-device-icon-fallback';
					iconFallback.textContent = getButtonDeviceClassIcon(deviceClass);
					if (iconImage.parentNode)
					{
						iconImage.parentNode.replaceChild(iconFallback, iconImage);
					}
				});
				indicatorElement.appendChild(iconImage);
			}
			else
			{
				const iconFallback = document.createElement('span');
				iconFallback.className = 'button-field-popup-device-icon-fallback';
				iconFallback.textContent = getButtonDeviceClassIcon(deviceClass);
				indicatorElement.appendChild(iconFallback);
			}
		}

		function updatePopupCapabilityIndicator(capabilityElement, indicatorElement)
		{
			if (!indicatorElement || !capabilityElement)
			{
				return;
			}

			let selectedText = '';
			let iconUrl = '';
			if (capabilityElement.selectedIndex >= 0 && capabilityElement.options[capabilityElement.selectedIndex])
			{
				const option = capabilityElement.options[capabilityElement.selectedIndex];
				selectedText = option.text || '';
				iconUrl = option.dataset.iconUrl || '';
			}

			indicatorElement.innerHTML = '';
			if (iconUrl)
			{
				const iconImage = document.createElement('img');
				iconImage.className = 'button-field-popup-capability-icon-image';
				iconImage.src = iconUrl;
				iconImage.alt = '';
				iconImage.loading = 'lazy';
				iconImage.decoding = 'async';
				iconImage.addEventListener('error', function ()
				{
					const iconFallback = document.createElement('span');
					iconFallback.className = 'button-field-popup-capability-icon-fallback';
					iconFallback.textContent = getButtonCapabilityIcon(capabilityElement.value);
					if (iconImage.parentNode)
					{
						iconImage.parentNode.replaceChild(iconFallback, iconImage);
					}
				});
				indicatorElement.appendChild(iconImage);
			}
			else
			{
				const iconFallback = document.createElement('span');
				iconFallback.className = 'button-field-popup-capability-icon-fallback';
				iconFallback.textContent = getButtonCapabilityIcon(capabilityElement.value);
				indicatorElement.appendChild(iconFallback);
			}

			indicatorElement.title = selectedText || '';
		}

		function fillDevicesElement(Element, DevicesArray)
		{
			if (Element && (DevicesArray.length > 0))
			{
				//fill the device lists with devices
				Element.innerHTML = "";

				var option = document.createElement("option");
				option.text = Homey.__("settings.none");
				option.value = "none";
				option.dataset.deviceClass = 'none';
				Element.add(option);

				var option = document.createElement("option");
				option.text = Homey.__("settings.variable");
				option.value = "_variable_";
				option.dataset.deviceClass = 'variable';
				Element.add(option);

				var option = document.createElement("option");
				option.text = Homey.__("settings.customMQTT");
				option.value = "customMQTT";
				option.dataset.deviceClass = 'custommqtt';
				Element.add(option);

				let deviceGroup;
				for (const device of DevicesArray)
				{
					const zoneName = device.zone.name ?? device.zoneName;
					if (deviceGroup != zoneName)
					{
						var option = document.createElement("option");
						deviceGroup = zoneName;
						option.text = deviceGroup;
						option.value = deviceGroup;
						option.disabled = true;
						Element.add(option);
					}

					var option = document.createElement("option");
					option.text = "\xA0\xA0" + device.name;
					option.value = device.id;
					const iconObj = device.iconObj || {};
					const iconUrl = iconObj.url || iconObj.small || iconObj.medium || iconObj.large || device.icon || '';
					if (iconUrl)
					{
						option.dataset.iconUrl = iconUrl;
					}
					if (device.class)
					{
						option.dataset.deviceClass = String(device.class);
					}
					Element.add(option);
				}
			}
		}

		function fillButtonVariablesElement(side, page, capabilityElement, selectedCapability, selectedCapabilityName)
		{
			// Remove the ' (Missing)' from the selectedCapabilityName
			selectedCapabilityName = selectedCapabilityName.replace(/ \(Missing\)/g, "");

			for (const variable of variablesArray)
			{
				if (variable.type === "boolean")
				{
					var option = document.createElement("option");
					option.text = variable.name;
					option.value = variable.id;
					capabilityElement.add(option);
				}
			}

			// Restore the previous variable selection
			capabilityElement.value = selectedCapability;
			if (capabilityElement.value !== selectedCapability)
			{
				// The variable must be missing, so add it to the list
				var option = document.createElement("option");
				option.text = selectedCapabilityName + " (Missing)";
				option.value = selectedCapability;
				capabilityElement.add(option);

				capabilityElement.value = selectedCapability;
			}

			capabilityChanged(side, page, selectedCapability);
			updateButtonCapabilityIndicator(side, page);
		}

		function getCapabilities(side, page, deviceId, selectedCapability, selectedCapabilityName)
		{
			// Remove any ' (Missing)' text from the selectedCapabilityName
			selectedCapabilityName = selectedCapabilityName ? selectedCapabilityName.replace(/ \(Missing\)/g, "") : selectedCapabilityName;

			// Clear the list options
			let capabilityElement = document.getElementById(`${side}${page}Capability`);
			capabilityElement.innerHTML = "";

			let capabilityDivElement = document.getElementById(`${side}${page}CapabilityDiv`);

			if ((deviceId === "none") || (deviceId === ""))
			{
				// Hide the capability element items using the div
				capabilityDivElement.style.display = "none";

				// We don't want to show Dim Change value
				document.getElementById(`${side}${page}DimChangeDiv`).style.display = "none";
				document.getElementById(`${side}${page}BrokerIdDiv`).style.display = itemDisplyType;
				document.getElementById(`${side}${page}CustomMQTTDiv`).style.display = "none";
				hidePopupManagedFieldsForSection(side, page);
				updateButtonCapabilityIndicator(side, page);
				return;
			}

			if (deviceId === "customMQTT")
			{
				// Hide the capability element items using the div
				capabilityDivElement.style.display = "none";

				// We don't want to show Dim Change value
				document.getElementById(`${side}${page}DimChangeDiv`).style.display = "none";
				document.getElementById(`${side}${page}BrokerIdDiv`).style.display = "none";

				// Show the custom MQTT section
				document.getElementById(`${side}${page}CustomMQTTDiv`).style.display = itemDisplyType;
				drawCustomMQTTTopics(side, localButtonConfigurations[currentButtonConfigurationNo]);
				hidePopupManagedFieldsForSection(side, page);
				updateButtonCapabilityIndicator(side, page);
				return;
			}

			if (deviceId === '_variable_')
			{
				if (variablesFetched)
				{
					// Add each of the variables to the item drop list
					fillButtonVariablesElement(side, page, capabilityElement, selectedCapability, selectedCapabilityName);
				}
				else
				{
					// Resquest the list of variables
					Homey.api('POST', '/get_variables/', {}, function (err, variables)
					{
						if (err) return Homey.alert(err);

						if (variables)
						{
							// Add each of the variables to the item drop list
							variablesArray = Object.values(variables);
							variablesFetched = true;
							fillButtonVariablesElement(side, page, capabilityElement, selectedCapability, selectedCapabilityName);
						}
					});
				}

				// Show the capability section
				capabilityDivElement.style.display = itemDisplyType;
				document.getElementById(`${side}${page}BrokerIdDiv`).style.display = itemDisplyType;
				document.getElementById(`${side}${page}CustomMQTTDiv`).style.display = "none";
				hidePopupManagedFieldsForSection(side, page);
				updateButtonCapabilityIndicator(side, page);
				return;
			}

			const devIdx = buttonDevicesArray.findIndex((device) => device.id === deviceId)
			if (devIdx >= 0)
			{
				const device = buttonDevicesArray[devIdx];
				const zoneName = device.zone.name ?? device.zoneName;
				if (zoneName === "Missing Devices")
				{
					// Remove ' (Missing Devices)' from the selectedCapabilityName
					selectedCapabilityName = selectedCapabilityName.replace(/ \(Missing Devices\)/g, "");

					// There won't be any capabilities defined for this device, so add the capability for the missing device from the ButtonPanelConfiguration.'side'Capability setting
					var option = document.createElement("option");
					option.text = selectedCapabilityName;
					option.value = selectedCapability;
					capabilityElement.add(option);

					capabilityDivElement.style.display = itemDisplyType;
					document.getElementById(`${side}${page}BrokerIdDiv`).style.display = itemDisplyType;
					document.getElementById(`${side}${page}CustomMQTTDiv`).style.display = "none";

					// Restore the previous capability selection
					capabilityElement.value = selectedCapability;
					capabilityChanged(side, page, selectedCapability);
					updateButtonCapabilityIndicator(side, page);
					hidePopupManagedFieldsForSection(side, page);
					return;
				}
			}

			// Request the capabilities for the selected device
			Homey.api('POST', '/device_capabilities/', { deviceId }, function (err, capabilities)
			{
				if (err) return Homey.alert(err);

				if (capabilities)
				{
					// Add each of the capabilities to the item drop list
					const capabilitiesArray = Object.values(capabilities);
					for (const capability of capabilitiesArray)
					{
						if (capability.type === "boolean" || capability.id === "dim" || capability.id === "windowcoverings_state")
						{
							var option = document.createElement("option");
							option.text = `${capability.title} (${capability.id})`;
							option.value = capability.id;
							const capabilityIconUrl = getCapabilityIconUrl(capability);
							if (capabilityIconUrl)
							{
								option.dataset.iconUrl = capabilityIconUrl;
							}
							capabilityElement.add(option);
						}
					}

					// Show the capability section
					capabilityDivElement.style.display = itemDisplyType;
					document.getElementById(`${side}${page}BrokerIdDiv`).style.display = itemDisplyType;
					document.getElementById(`${side}${page}CustomMQTTDiv`).style.display = "none";

					// Restore the previous capability selection
					capabilityElement.value = selectedCapability;
					capabilityChanged(side, page, selectedCapability);
					updateButtonCapabilityIndicator(side, page);
					hidePopupManagedFieldsForSection(side, page);
				}
			});
		}

		function capabilityChanged(side, page, value)
		{
			if (value === "dim")
			{
				// For dim type capabilities we want to show the dim change value
				document.getElementById(`${side}${page}DimChangeDiv`).style.display = itemDisplyType;

				// And we don't want to show the On or Off text
				document.getElementById(`${side}${page}OnTextDiv`).style.display = "none";
				document.getElementById(`${side}${page}OffText`).style.display = "none";
				document.getElementById(`${side}${page}OffTextLabel`).style.display = "none";
			}
			else
			{
				// For Boolean types we don't want to show Dim Change value
				document.getElementById(`${side}${page}DimChangeDiv`).style.display = "none";

				// And we want to show the On and Off text
				document.getElementById(`${side}${page}OnTextDiv`).style.display = itemDisplyType;
				document.getElementById(`${side}${page}OffText`).style.display = itemDisplyType;
				document.getElementById(`${side}${page}OffTextLabel`).style.display = itemDisplyType;
			}
			//document.getElementById(`${side}TopText`).value = document.getElementById(`${side}TopText`).value ? document.getElementById(`${side}TopText`).value : value;
			hidePopupManagedFieldsForSection(side, page);

		}

		// If the config and devices have been fetched, update all the control values
		function updateButtonPanelControls()
		{
			if ((buttonConfigurationsFetched == false) || (buttonDevicesFetched == false)) return;

			if (currentButtonConfigurationNo < 0 || currentButtonConfigurationNo >= localButtonConfigurations.length)
			{
				currentButtonConfigurationNo = 0;
				buttonConfigurationNoElement.value = currentButtonConfigurationNo;
			}

			let config = localButtonConfigurations[currentButtonConfigurationNo];

			// Makes sure the config is an array
			if (!Array.isArray(config))
			{
				config = [config];
				localButtonConfigurations[currentButtonConfigurationNo] = config;
			}

			if (config.length === 0)
			{
				config.push({ PageNum: 0 });
				localButtonConfigurations[currentButtonConfigurationNo] = config;
			}

			// let ButtonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];
			configNameElement.value = config[0].name ? config[0].name : "";

			for (let page = 0; page < config.length; page++)
			{
				updateButtonPanelControlsSection("left", page, config[page]);
				updateButtonPanelControlsSection("right", page, config[page]);
				hidePopupManagedFieldsForPage(page);
				updateButtonAdvancedToggleState('left', page);
				updateButtonAdvancedToggleState('right', page);
			}

			renderInlineButtonPagePreviews();

			fillButtonDevices();
			setupButtonBrokerItems();
			setupSvgPreviews(document);

			if (displayPagePopupOverlayElement && displayPagePopupOverlayElement.classList.contains('visible'))
			{
				renderDisplayPagePopup();
				refreshDisplayPopupLiveValues();
			}

			updateButtonMainDiagnostics('updateButtonPanelControls');
		}

		// Update the controls for the specified side and page
		function updateButtonPanelControlsSection(side, page, ButtonPanelConfiguration)
		{
			if (buttonConfigurationNoElement.value == "")
			{
				// fillButtonConfigListElement(buttonConfigurationNoElement, Homey.__("settings.buttonConfig"), localButtonConfigurations, MAX_BUTTON_CONFIGURATIONS);

				configNameElement.value = "";
				document.getElementById(`${side}${page}TopText`).value = "";
				document.getElementById(`${side}${page}OnText`).value = "";
				document.getElementById(`${side}${page}OffText`).value = "";
				document.getElementById(`${side}${page}Device`).value = "";
				document.getElementById(`${side}${page}Capability`).value = "";
				document.getElementById(`${side}${page}BrokerId`).value = 'Default';
				document.getElementById(`${side}${page}DimChange`).value = "+10";
				document.getElementById(`${side}${page}FrontLEDOnColor`).value = "#ff0000";
				document.getElementById(`${side}${page}WallLEDOnColor`).value = "#ff0000";
				document.getElementById(`${side}${page}FrontLEDOffColor`).value = "#000000";
				document.getElementById(`${side}${page}WallLEDOffColor`).value = "#000000";
				document.getElementById(`${side}${page}DisableLongRepeat`).checked = true;
				document.getElementById(`${side}${page}OnSVG`).value = "";
				document.getElementById(`${side}${page}OffSVG`).value = "";
			}
			else
			{
				currentButtonConfigurationNo = buttonConfigurationNoElement.value;

				// fillButtonConfigListElement(buttonConfigurationNoElement, Homey.__("settings.buttonConfig"), localButtonConfigurations, MAX_BUTTON_CONFIGURATIONS);

				buttonConfigurationNoElement.value = currentButtonConfigurationNo;

				// Fill button panel
				const panelText = Homey.__(`settings.${side}Panel`);
				document.getElementById(`${side}${page}TopText`).value = ButtonPanelConfiguration[`${side}TopText`];
				document.getElementById(`button${side}${page}Legend`).innerHTML = `<b><em>${panelText}</em></b> - ${document.getElementById(`${side}${page}TopText`).value}`;
				document.getElementById(`${side}${page}OnText`).value = ButtonPanelConfiguration[`${side}OnText`];
				document.getElementById(`${side}${page}OffText`).value = ButtonPanelConfiguration[`${side}OffText`];
				document.getElementById(`${side}${page}Device`).value = ButtonPanelConfiguration[`${side}Device`];
				// If the element is not in the list, add it
				if (document.getElementById(`${side}${page}Device`).value != ButtonPanelConfiguration[`${side}Device`])
				{
					if (buttonDevicesArray.findIndex((device) => device.id === ButtonPanelConfiguration[`${side}Device`]) < 0)
					{
						var name = ButtonPanelConfiguration[`${side}DeviceName`] ? ButtonPanelConfiguration[`${side}DeviceName`] : ButtonPanelConfiguration[`${side}Device`];

						// Remove any leading spaces from the device name
						name = name.trim();

						// Remove all occurrences of ' (Missing Devices)' from the name
						name = name.replace(/ \(Missing Devices\)/g, "");

						buttonDevicesArray.push({ id: ButtonPanelConfiguration[`${side}Device`], name, zone: { name: "Missing Devices" } });
						buttonDevicesArray = sortDevices(buttonDevicesArray);
						fillButtonDevices();
						// document.getElementById(`${side}${page}Device`).value = ButtonPanelConfiguration[`${side}Device`];
					}
				}

				document.getElementById(`${side}${page}BrokerId`).value = ButtonPanelConfiguration[`${side}BrokerId`];
				document.getElementById(`${side}${page}DimChange`).value = ButtonPanelConfiguration[`${side}DimChange`];
				document.getElementById(`${side}${page}FrontLEDOnColor`).value = ButtonPanelConfiguration[`${side}FrontLEDOnColor`];
				document.getElementById(`${side}${page}WallLEDOnColor`).value = ButtonPanelConfiguration[`${side}WallLEDOnColor`];
				document.getElementById(`${side}${page}FrontLEDOffColor`).value = ButtonPanelConfiguration[`${side}FrontLEDOffColor`];
				document.getElementById(`${side}${page}WallLEDOffColor`).value = ButtonPanelConfiguration[`${side}WallLEDOffColor`];
				document.getElementById(`${side}${page}DisableLongRepeat`).checked = !ButtonPanelConfiguration[`${side}DisableLongRepeat`];
				document.getElementById(`${side}${page}OnSVG`).value = ButtonPanelConfiguration[`${side}OnSVG`] || '';
				document.getElementById(`${side}${page}OffSVG`).value = ButtonPanelConfiguration[`${side}OffSVG`] || '';
			}
		}

		function autoConfigChanged()
		{
			if (!autoConfigElement.checked)
			{
				configTypeChanged("");
				document.getElementById('AutoConfigWarnOff').style.display = "block";
				document.getElementById('AutoConfigWarnOn').style.display = "none";
				saveBlock.style.display = "none";
				configTypeElement.style.display = "none";
			}
			else
			{
				configTypeChanged(configTypeElement.value);
				document.getElementById('AutoConfigWarnOff').style.display = "none";
				document.getElementById('AutoConfigWarnOn').style.display = "block";
				if (configTypeElement.value === "settings" || configTypeElement.value === "diagnosticLog")
				{
					saveBlock.style.display = "none";
				}
				else
				{
					saveBlock.style.display = "block";
				}
				configTypeElement.style.display = "block";
			}
		}

		function configTypeChanged(configSelected)
		{
			var i, tabcontent, tablinks;

			if (configSelected !== 'displayConfig')
			{
				stopDisplayInlineLiveRefresh();
			}

			// Get all elements with class="tabcontent" and hide them
			tabcontent = document.getElementsByClassName("tabcontent");
			for (i = configSelected ? 0 : 1; i < tabcontent.length; i++)
			{
				tabcontent[i].style.display = "none";
			}
			if (configSelected !== "")
			{
				// Hide the save button for the settings and diagnostics pages
				if ((configSelected === "settings") || (configSelected === "diagnosticLog") || (configSelected === "lastSentLog"))
				{
					saveBlock.style.display = "none";
				}
				else
				{
					saveBlock.style.display = "block";
				}
				document.getElementById(configSelected).style.display = "block";

				if (configSelected === 'panelConfig')
				{
					setTimeout(function ()
					{
						const panelConfigElement = document.getElementById('panelConfig');
						collapseAllDetails(panelConfigElement);
					}, 0);
				}

				if (configSelected === "diagnosticLog")
				{
					// Refresh the log data
					Homey.get('logEnabled', function (err, logLevel)
					{
						if (err) return Homey.alert(err);
						enableLog.checked = logLevel;
					});

					Homey.api('GET', '/getLog/',
						{
							notify: true
						}, function (err, result)
					{
						if (err)
						{
							return Homey.alert(err);
						}

						diagLogElement.value = result;
					});

					// Make the log text area fill the page
					diagLogElement.style.width = (emailElement.offsetWidth) + 'px';
					diagLogElement.style.height = (window.innerHeight - diagLogElement.offsetTop - 35) + 'px';
				}
				else if (configSelected === "importExport")
				{
					// Make the log text area fill the page
					copyTextElement.style.height = (window.innerHeight - copyTextElement.offsetTop - 120) + 'px';
				}
				else if (configSelected === "lastSentLog")
				{
					// Make the log text area fill the page
					sentLogElement.style.width = '100%';
					sentLogElement.style.height = (window.innerHeight - sentLogElement.offsetTop - 35) + 'px';
				}
				else if (configSelected === 'displayConfig')
				{
					refreshDisplayPopupLiveValues();
					startDisplayInlineLiveRefresh();
				}
			}
		}

		// Store the current display settings and then apply the new ones
		function redisplayDisplyConfig(activeItemNo = -1)
		{
			// Store the current configuration
			storeDisplaySettings();

			// Fetch the new configuration
			updateDisplayConfiguration(activeItemNo);
		}

		// If the config has been fetched, update all the control values
		function updateDisplayConfiguration(expandItem = -1)
		{
			if (displayConfigurationsFetched)
			{
				currentDisplayConfigurationNo = displayConfigurationNoElement.value;

				var displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];

				let expandItemId = -1;
				if (displayConfiguration == null)
				{
					displayConfiguration = {};
					displayConfiguration.items = [];
				}
				else
				{
					if (expandItem >= 0)
					{
						expandItemId = displayConfiguration.items[expandItem].itemId;
					}
				}

				drawDisplayConfiguration(displayConfiguration, expandItemId);
			}
		}

		// Create all the display items for the specified display configuration
		function drawDisplayConfiguration(displayConfiguration, expandItemId = -1)
		{
			if (!Array.isArray(displayConfiguration.items))
			{
				displayConfiguration.items = [];
			}

			if (displayInlineSelectedItemNo >= displayConfiguration.items.length)
			{
				displayInlineSelectedItemNo = displayConfiguration.items.length - 1;
			}

			// Sort the display items by page number, then by Y position and finally by X position
			displayConfiguration.items.sort((a, b) =>
			{
				if (a.page < b.page)
				{
					return -1;
				}
				if (a.page > b.page)
				{
					return 1;
				}
				if (a.yPos < b.yPos)
				{
					return -1;
				}
				if (a.yPos > b.yPos)
				{
					return 1;
				}
				if (a.xPos < b.xPos)
				{
					return -1;
				}
				if (a.xPos > b.xPos)
				{
					return 1;
				}
				return 0;
			});

			let page = -1;
			// document.getElementById('displayItemsSection').innerHTML = "";
			displayConfigNameElement.value = displayConfiguration.name
			let htmlText = "";
			for (var itemNo = 0; itemNo < displayConfiguration.items.length; itemNo++)
			{
				const item = displayConfiguration.items[itemNo];
				// const capabilities = {}
				// displayCapabilityItems.push(capabilities);

				if (page != item.page)
				{
					// Insert a page number heading
					if (page >= 0)
					{
						htmlText += `</div></div>`;
					}

					page = item.page;
					htmlText += `<div class="horizontalcontainer"><div class="horizontalgroup"><h2>${Homey.__("settings.page")} ${item.page === 0 ? Homey.__("settings.all") : item.page} <div class="tooltip"><i class="fi fi-rr-info"></i><span class="tooltiptext">${Homey.__("settings.pageExplanation")}</span></div></h2>`;
				}

				htmlText += insertDisplayItemSection(item, itemNo, (item.itemId === expandItemId));
			}
			htmlText += `</div></div>`;
			const displayItemsSectionElement = document.getElementById('displayItemsSection');
			displayItemsSectionElement.innerHTML = htmlText;
			displayItemsSectionElement.classList.add('display-items-backing-store');

			if (expandItemId >= 0)
			{
				requestAnimationFrame(() =>
				{
					const expandedElement = document.getElementById(`displayItem${expandItemId}Section`);
					if (expandedElement)
					{
						scrollToTop(expandedElement);
						expandedElement.classList.add('display-item-highlight');
						setTimeout(() =>
						{
							expandedElement.classList.remove('display-item-highlight');
						}, 1600);
					}
				});
			}

			for (var itemNo = 0; itemNo < displayConfiguration.items.length; itemNo++)
			{
				// Add a 'Default' broker entry to the lists
				var defaultText = Homey.__("settings.default");

				var option = document.createElement("option");
				option.value = 'Default';
				option.text = defaultText;
				document.getElementById(`display${itemNo}BrokerId`).add(option);

				// add the brokers to the display config broker lists
				for (let i = 0; i < localBrokerItems.length; i++)
				{
					const brokerItem = localBrokerItems[i];
					if (brokerItem.enabled)
					{
						var option = document.createElement("option");
						option.value = brokerItem.brokerid;
						option.text = brokerItem.brokerid;
						document.getElementById(`display${itemNo}BrokerId`).add(option);
					}
				}

				const item = displayConfiguration.items[itemNo];
				document.getElementById(`display${itemNo}BrokerId`).value = item.brokerId;

				document.getElementById(`display${itemNo}FontSize`).value = item.fontSize;
				document.getElementById(`display${itemNo}BrokerId`).value = item.brokerId;
				document.getElementById(`display${itemNo}BoxType`).value = item.boxType || 0;
				//				document.getElementById(`display${itemNo}CustomMQTTTopic`).value = item.customMQTTTopic || "";
			}

			fillDisplayDevices();

			for (var itemNo = 0; itemNo < displayConfiguration.items.length; itemNo++)
			{
				const item = displayConfiguration.items[itemNo];

				drawDisplayCustomMQTTTopics(itemNo, item.customMQTTTopics);
			}

			setupSvgPreviews(document);
			renderDisplayInlineSimulator();
			refreshDisplayPopupLiveValues();
		}


		function newDisplayMQTTTopic(Item)
		{
			var displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];
			if (displayConfiguration)
			{
				// Save the current settings
				storeDisplayCustomMQTTItems(Item, displayConfiguration.items[Item].customMQTTTopics);

				var customMQTTItem = {
					id: '',
					type: 0,
					topic: "",
					payload: "",
					brokerId: 'Default',
					enable: true,
				};

				// make sure the customMQTTTopics is an array
				if (!displayConfiguration.items[Item].customMQTTTopics || (Array.isArray(displayConfiguration.items[Item].customMQTTTopics) === false))
				{
					displayConfiguration.items[Item].customMQTTTopics = [];
				}


				displayConfiguration.items[Item].customMQTTTopics.push(customMQTTItem);
				drawDisplayCustomMQTTTopics(Item, displayConfiguration.items[Item].customMQTTTopics);
			}
		};

		/// Custom MQTT code
		function drawDisplayCustomMQTTTopics(Item, Topics)
		{
			if (!Topics || Topics.length === 0) return;

			document.getElementById(`display${Item}CustomMQTTTopicsSection`).innerHTML = "";
			customDisplayMQTTItemsElements = [];

			for (var itemNo = 0; itemNo < Topics.length; itemNo++)
			{
				const topic = Topics[itemNo];
				insertDisplayCustomMQTTTopicSection(topic, itemNo, Item);
			}

			// Set the value for the brokerID in each custom MQTT topics section
			for (var itemNo = 0; itemNo < Topics.length; itemNo++)
			{
				const topic = Topics[itemNo];
				document.getElementById(`display${Item}CustomMQTT${itemNo}BrokerId`).value = topic.brokerId;
			}

			var tooltips = document.querySelectorAll(".tooltip");
			tooltips.forEach(function (tooltip, index)
			{
				// Set a mouse over function for each tooltop element
				tooltip.addEventListener("mouseover", position_tooltip); // On hover, launch the function below
			})
		}

		function insertDisplayCustomMQTTTopicSection(Topic, ItemNo, Item)
		{
			const ctrlLabels = {
				brokerId: Homey.__("settings.brokerId"),
				brokerIdExplanation: Homey.__("settings.brokerIdExplanation"),
				id: Homey.__("settings.MQTTId"),
				idExplanation: Homey.__("settings.MQTTIdExplanation"),
				type: Homey.__("settings.type"),
				typeExplanation: Homey.__("settings.typeExplanation"),
				topic: Homey.__("settings.topic"),
				topicExplanation: Homey.__("settings.topicExplanation"),
				payload: Homey.__("settings.payload"),
				payloadExplanation: Homey.__("settings.payloadExplanation"),
				enabled: Homey.__("settings.enabled"),
				value: Homey.__("settings.value"),
				label: Homey.__("settings.label"),
				unit: Homey.__("settings.unit"),
			};
			const itemLegend = Homey.__("settings.customMQTTItemlegend", { itemNo: ItemNo + 1 });
			const enableOption = Topic.enabled ? "checked" : "";

			var section = document.getElementById(`display${Item}CustomMQTTTopicsSection`).innerHTML;
			section = section +
				`<div class="horizontalcontainer">
					<div class="horizontalgroup">
						<legend class="homey-subtitle">${itemLegend}</legend>

						<label class="homey-form-label" for="display${Item}CustomMQTT${ItemNo}Id">${ctrlLabels.id}
							<div class="tooltip" onmouseover="position_tooltip"><i class="fi fi-rr-info"></i>
								<span class="tooltiptext">${ctrlLabels.idExplanation}</span>
							</div>
						</label>
						<input class="homey-form-input" id="display${Item}CustomMQTT${ItemNo}Id" type="text" value="${Topic.id}"/>

						<label class="homey-form-label" for="display${Item}CustomMQTT${ItemNo}Type">${ctrlLabels.type}
							<div class="tooltip" onmouseover="position_tooltip"><i class="fi fi-rr-info"></i>
								<span class="tooltiptext">${ctrlLabels.typeExplanation}</span>
							</div>
						</label>
						<select class="homey-form-select" id="display${Item}CustomMQTT${ItemNo}Type">
							<option value=15>${ctrlLabels.value}</option>
							<option value=16>${ctrlLabels.label}</option>
							<option value=17>${ctrlLabels.unit}</option>
						</select><br>

						<label class="homey-form-label" for="display${Item}CustomMQTT${ItemNo}topic">${ctrlLabels.topic}
							<div class="tooltip" onmouseover="position_tooltip"><i class="fi fi-rr-info"></i>
								<span class="tooltiptext">${ctrlLabels.topicExplanation}</span>
							</div>
						</label>
						<input class="homey-form-input" id="display${Item}CustomMQTT${ItemNo}topic" type="text" value="${Topic.topic}" />

						<label class="homey-form-label" for="display${Item}CustomMQTT${ItemNo}payload">${ctrlLabels.payload}
							<div class="tooltip" onmouseover="position_tooltip"><i class="fi fi-rr-info"></i>
								<span class="tooltiptext">${ctrlLabels.payloadExplanation}</span>
							</div>
						</label>
						<input class="homey-form-input" id="display${Item}CustomMQTT${ItemNo}payload" type="text" value="${Topic.payload}" />

						<label class="homey-form-label" for="display${Item}CustomMQTT${ItemNo}BrokerId">${ctrlLabels.brokerId}
							<div class="tooltip" onmouseover="position_tooltip"><i class="fi fi-rr-info"></i>
								<span class="tooltiptext">${ctrlLabels.brokerIdExplanation}</span>
							</div>
						</label>
						<select class="homey-form-select" id="display${Item}CustomMQTT${ItemNo}BrokerId">
						</select><br>

						<label class="homey-form-checkbox">
							<input class="homey-form-checkbox-input" id="display${Item}CustomMQTT${ItemNo}Enabled" type="checkbox" ${enableOption}/>
							<span class="homey-form-checkbox-checkmark"></span>
							<span class="homey-form-checkbox-text">${ctrlLabels.enabled}</span>
						</label>

						<p><button class="homey-button-secondary-shadow" id="display${Item}DeleteItem${ItemNo}" onClick="deleteDisplayCustomMQTTItem(${ItemNo}, ${Item})" style="font-size: 30px;"><i class="fi fi-rr-trash"></i> </button></p>
					</div>
				</div>`;

			document.getElementById(`display${Item}CustomMQTTTopicsSection`).innerHTML = section;
			const idx = customDisplayMQTTItemsElements.push(document.getElementById(`display${Item}CustomMQTT${ItemNo}BrokerId`)) - 1;

			// Add the brokers to the broker list
			var option = document.createElement("option");
			option.text = 'Default';
			option.value = 'Default';
			customDisplayMQTTItemsElements[idx].add(option);

			for (var brokerNo = 0; brokerNo < localBrokerItems.length; brokerNo++)
			{
				const brokerItem = localBrokerItems[brokerNo];
				option = document.createElement("option");
				option.text = brokerItem.brokerid;
				option.value = brokerItem.brokerid;
				customDisplayMQTTItemsElements[idx].add(option);
			}
		}


		// Delete the specified custom item from the display panel configuration and redraw the list
		function deleteDisplayCustomMQTTItem(ItemNo, Item)
		{
			var displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];
			const customMQTTTopics = displayConfiguration.items[Item].customMQTTTopics;

			customMQTTTopics.splice(ItemNo, 1);
			drawDisplayCustomMQTTTopics(Item, customMQTTTopics);
		}

		//  Copy the contents of the specified custom item controls to the display panel configuration
		function storeDisplayCustomMQTTItem(Item, Topics, itemNo)
		{
			if (!Topics)
			{
				Topics = [];
			}

			// Fetch the item from the array or create a new one
			let item = Topics[itemNo];
			if (!item)
			{
				item = {};
				Topics.push(item);
			}

			// Update the item
			item.id = document.getElementById(`display${Item}CustomMQTT${itemNo}Id`).value;
			item.type = document.getElementById(`display${Item}CustomMQTT${itemNo}Type`).value;
			item.topic = document.getElementById(`display${Item}CustomMQTT${itemNo}topic`).value;
			item.payload = document.getElementById(`display${Item}CustomMQTT${itemNo}payload`).value;
			item.brokerId = document.getElementById(`display${Item}CustomMQTT${itemNo}BrokerId`).value;
			item.enabled = document.getElementById(`display${Item}CustomMQTT${itemNo}Enabled`).checked;
		}

		// Copy the contents of the all the custom items controls to the button panel configuration
		function storeDisplayCustomMQTTItems(Item, Topics)
		{
			if (!Topics || Topics.length === 0) return;

			for (var itemNo = 0; itemNo < Topics.length; itemNo++)
			{
				storeDisplayCustomMQTTItem(Item, Topics, itemNo);
			}
		}


		// Add the HTML for the specified display item
		function insertDisplayItemSection(item, itemNo, expanded = false)
		{
			var section = ""; // document.getElementById('displayItemsSection').innerHTML;
			const displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo] || { items: [] };
			const ctrlLabels = {
				device: Homey.__("settings.device"),
				capability: Homey.__("settings.capability"),
				label: Homey.__("settings.topLabel"),
				text: Homey.__("settings.text"),
				unit: Homey.__("settings.unit"),
				xPos: Homey.__("settings.xPos"),
				yPos: Homey.__("settings.yPos"),
				width: Homey.__("settings.width"),
				rounding: Homey.__("settings.rounding"),
				fontSize: Homey.__("settings.fontSize"),
				deleteItem: Homey.__("settings.deleteItem"),
				brokerId: Homey.__("settings.brokerId"),
				page: Homey.__("settings.page"),
				boxType: Homey.__("settings.boxType"),
				customMQTTTopic: Homey.__("settings.customMQTTTopic"),
				newCustomMQTTItem: Homey.__("settings.newCustomMQTTItem"),
			}
			const ctrlExplanations = {
				device: Homey.__("settings.deviceDExplanation"),
				capability: Homey.__("settings.capabilityDExplanation"),
				label: Homey.__("settings.toplabelDisplayExplanation"),
				text: Homey.__("settings.textExplanation"),
				unit: Homey.__("settings.unitExplanation"),
				xPos: Homey.__("settings.xPosExplanation"),
				yPos: Homey.__("settings.yPosExplanation"),
				width: Homey.__("settings.widthExplanation"),
				rounding: Homey.__("settings.roundingExplanation"),
				fontSize: Homey.__("settings.fontSizeExplanation"),
				deleteItem: Homey.__("settings.deleteItemExplanation"),
				brokerId: Homey.__("settings.brokerIdExplanation"),
				page: Homey.__("settings.pageExplanation"),
				boxType: Homey.__("settings.boxTypeExplanation"),
				customMQTTTopic: Homey.__("settings.customMQTTTopicExplanation"),
			}
			const itemLegend = Homey.__("settings.displayItemlegend", { itemNo: itemNo + 1 });
			const sanitizedLabel = sanitizeDisplayString(item.label, '');
			const sanitizedText = sanitizeDisplayString(item.text, '');
			const sanitizedCapabilityName = sanitizeDisplayString(item.capabilityName, '');
			const sanitizedUnit = sanitizeDisplayString(item.unit, '');
			const itemLegendName = sanitizedLabel ? sanitizedLabel : (item.device === 'none' ? sanitizedText : sanitizedCapabilityName);
			const itemLegendPageLabel = formatDisplayPageLabel(parseInt(item.page, 10) || 0);
			const underlined = Homey.__("settings.boxTypeUnderlined");
			const notUnderlined = Homey.__("settings.boxTypeNotUnderlined");

			if (typeof item.page === 'undefined')
			{
				item.page = 0;
			}

			const pageSelectOptions = getDisplayPageSelectOptionsMarkup(displayConfiguration, item.page);

			section = section +
				`<div class="horizontalcontainer">
					<div class="horizontalgroup" id="displayItem${item.itemId}Section">
						<details ${expanded ? 'open' : ''}>
							<summary class="summary">
								<legend class="homey-subtitle" id="display${itemNo}Legend"><b><em>${itemLegend}</em></b> - ${itemLegendName}: P:${itemLegendPageLabel}, X:${item.xPos}, Y:${item.yPos}, W:${item.width}</legend>
								<span class="icon" style='font-size:30px;'>&#8628;</span>
							</summary>
							<hr>
							<label class="homey-form-label" for="display${itemNo}page">${ctrlLabels.page}
								<div class="tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">${ctrlExplanations.page}</span>
								</div>
							</label>
							<select class="homey-form-select" id="display${itemNo}page" onChange="redisplayDisplyConfig(${itemNo})">
								${pageSelectOptions}
							</select>
							<label class="homey-form-label" for="display${itemNo}Device">${ctrlLabels.device}
								<div class="tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">${ctrlExplanations.device}</span>
								</div>
							</label>
							<select class="homey-form-select" id="display${itemNo}Device" onChange="getDisplayCapabilities(${itemNo})">
							</select>
							<div id="display${itemNo}CapabilityDiv">
								<br>
								<label class="homey-form-label" for="display${itemNo}Capability">${ctrlLabels.capability}
									<div class="tooltip"><i class="fi fi-rr-info"></i>
										<span class="tooltiptext">${ctrlExplanations.capability}</span>
									</div>
								</label>
								<select class="homey-form-select" id="display${itemNo}Capability" onChange="selectDisplayCapability(this, ${itemNo})">
								</select>
							</div>
							<div id="display${itemNo}CustomMQTTTopicDiv">
								<br>
								<div id="display${itemNo}CustomMQTTTopicsSection"></div>
								<p><button class="homey-button-secondary-shadow" id="newDisplayCustomMQTTItem" onClick="newDisplayMQTTTopic(${itemNo})">${ctrlLabels.newCustomMQTTItem}</button></p>
							</div>
							<br>
							<label class="homey-form-label" for="display${itemNo}Label">${ctrlLabels.label}
								<div class="tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">${ctrlExplanations.label}</span>
								</div>
							</label>
							<input class="homey-form-input" id="display${itemNo}Label" type="text" oninput="onDisplayLabelChange(this, ${itemNo})" value="${sanitizedLabel}" />
							<div id="display${itemNo}UnitDiv">
								<label class="homey-form-label" for="display${itemNo}Unit">${ctrlLabels.unit}
									<div class="tooltip"><i class="fi fi-rr-info"></i>
										<span class="tooltiptext">${ctrlExplanations.unit}</span>
									</div>
								</label>
								<input class="homey-form-input" id="display${itemNo}Unit" type="text" value="${sanitizedUnit}" />
							</div>
							<div id="display${itemNo}TextDiv">
								<label class="homey-form-label" for="display${itemNo}Text">${ctrlLabels.text}
									<div class="tooltip"><i class="fi fi-rr-info"></i>
										<span class="tooltiptext">${ctrlExplanations.text}</span>
									</div>
								</label>
								<input class="homey-form-input" id="display${itemNo}Text" type="text" oninput="onDisplayLabelChange(this, ${itemNo})" value="${sanitizedText}" />
							</div>
							<label class="homey-form-label" for="display${itemNo}X">${ctrlLabels.xPos}
								<div class="tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">${ctrlExplanations.xPos}</span>
								</div>
							</label>
							<input class="homey-form-input" id="display${itemNo}X" onChange="redisplayDisplyConfig(${itemNo})" type="number" value="${item.xPos}" />
							<label class="homey-form-label" for="display${itemNo}Y">${ctrlLabels.yPos}
								<div class="tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">${ctrlExplanations.yPos}</span>
								</div>
							</label>
							<input class="homey-form-input" id="display${itemNo}Y" onChange="redisplayDisplyConfig(${itemNo})" type="number" value="${item.yPos}" />
							<label class="homey-form-label" for="display${itemNo}Width">${ctrlLabels.width}
								<div class="tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">${ctrlExplanations.width}</span>
								</div>
							</label>
							<input class="homey-form-input" id="display${itemNo}Width" type="number" value="${item.width}" />
							<label class="homey-form-label" for="display${itemNo}Rounding">${ctrlLabels.rounding}
								<div class="tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">${ctrlExplanations.rounding}</span>
								</div>
							</label>
							<input class="homey-form-input" id="display${itemNo}Rounding" type="number" value="${item.rounding || 0}" />
							<label class="homey-form-label" for="display${itemNo}FontSize">${ctrlLabels.fontSize}
								<div class="tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">${ctrlExplanations.fontSize}</span>
								</div>
							</label>
							<select class="homey-form-select" id="display${itemNo}FontSize">
								<option value=1>1 - 18px</option>
								<option value=2>2 - 35px</option>
								<option value=3>3 - 45px</option>
								<option value=4>4 - 66px</option>
								<option value=5>5 - 100px</option>
							</select>
							<label class="homey-form-label" for="display${itemNo}BoxType">${ctrlLabels.boxType}
								<div class="tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">${ctrlExplanations.boxType}</span>
								</div>
							</label>
							<select class="homey-form-select" id="display${itemNo}BoxType">
								<option value=0>${underlined}</option>
								<option value=1>${notUnderlined}</option>
							</select>
							<label class="homey-form-label" for="display${itemNo}BrokerId">${ctrlLabels.brokerId}
								<div class="tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">${ctrlExplanations.brokerId}</span>
								</div>
							</label>
							<select class="homey-form-select" id="display${itemNo}BrokerId">
							</select>
							<label class="homey-form-label" for="display${itemNo}SVG">SVG Data
								<div class="tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">Raw SVG code to display as an icon/image on the display item</span>
								</div>
							</label>
							<div class="svg-editor-wrapper">
								<textarea class="homey-form-textarea svg-editor-textarea" id="display${itemNo}SVG" data-svg-preview-target="display${itemNo}SVGPreview">${escapeHtml(item.svg || '')}</textarea>
								<div class="svg-preview-box" id="display${itemNo}SVGPreview"></div>
							</div>
							<br>
							<p><button class="homey-button-secondary-shadow" id="deleteItem" onClick="deleteItem(${itemNo})" style="font-size: 30px;"><i class="fi fi-rr-trash"></i> </button></p>
						</details>
					</div>
				</div>`;

			// document.getElementById('displayItemsSection').innerHTML = section;
			return section;
		}

		function scrollToTop(element)
		{
			if (!element)
			{
				return;
			}

			const fixedTopElement = document.querySelector('.fixedTop');
			const fixedTopHeight = fixedTopElement ? fixedTopElement.offsetHeight : 0;
			let targetViewportTop = fixedTopHeight + 8;

			if (document.body.classList.contains('sim-panel-open'))
			{
				const rawOffset = getComputedStyle(document.documentElement).getPropertyValue('--button-sim-scroll-offset') || '0';
				const parsedOffset = parseFloat(rawOffset);
				const simPanelOffset = Number.isNaN(parsedOffset) ? 0 : parsedOffset;
				targetViewportTop = Math.max(targetViewportTop, fixedTopHeight + simPanelOffset + 8);

				const displaySimDialog = document.querySelector('.display-sim-overlay.visible .display-sim-dialog');
				const buttonSimDialog = document.querySelector('.button-sim-overlay.visible .button-sim-dialog');
				const activeSimDialog = displaySimDialog || buttonSimDialog;
				if (activeSimDialog)
				{
					const simBottom = Math.max(0, activeSimDialog.getBoundingClientRect().bottom);
					targetViewportTop = Math.max(targetViewportTop, simBottom + 6);
				}
			}

			const top = Math.max(0, element.getBoundingClientRect().top + window.scrollY - targetViewportTop);
			window.scrollTo({ top, behavior: 'smooth' });
		}

		// Ensure that the display item's legend is always up-to-date with the latest label, position, and size values.
		function onDisplayLabelChange(element, itemNo)
		{
			let newLabel = element.value;
			if (element.id === `display${itemNo}Text`)
			{
				// Only use the text if the label is empty
				const label = document.getElementById(`display${itemNo}Label`).value;
				const device = document.getElementById(`display${itemNo}Device`).value;

				// Only use this if the label is empty
				if ((label !== '') || (device !== 'none'))
				{
					return;
				}
			}
			else
			{
				if (element.id !== `display${itemNo}Label`)
				{
					newLabel = document.getElementById(`display${itemNo}Label`).value;
				}

				if (newLabel === '')
				{
					// As the label is now empty, set the text to the text or capability name
					const device = document.getElementById(`display${itemNo}Device`).value;
					if (device === 'none')
					{
						newLabel = document.getElementById(`display${itemNo}Text`).value;
					}
					else
					{
						const capability = document.getElementById(`display${itemNo}Capability`).value;
						const capabilityElement = document.getElementById(`display${itemNo}Capability`);
						newLabel = capabilityElement.options && capabilityElement.options.length > 0 ? capabilityElement.options[capabilityElement.selectedIndex].text : device;
					}
				}
			}

			const x = document.getElementById(`display${itemNo}X`).value;
			const y = document.getElementById(`display${itemNo}Y`).value;
			const width = document.getElementById(`display${itemNo}Width`).value;
			const pageRaw = document.getElementById(`display${itemNo}page`).value;
			const pageLabel = formatDisplayPageLabel(parseInt(pageRaw, 10) || 0);

			document.getElementById(`display${itemNo}Legend`).innerHTML = `<b><em>${Homey.__("settings.displayItemlegend", { itemNo: itemNo + 1 })}</em></b> - ${newLabel}: P:${pageLabel}, X:${x}, Y:${y}, W:${width}`;
		}

		function makeSummarySticky()
		{
			var summaries = document.querySelectorAll('.summary');
			var lastStickySummary = null;
			var lastSummary = null;
			var fixedTopHeight = document.querySelector('.fixedTop').offsetHeight; // Get the height of the fixedTop div
			var lastTop = 0;

			summaries.forEach(function (summary)
			{
				var rect = summary.getBoundingClientRect();
				if (rect.height !== 0)
				{
					if (lastTop <= fixedTopHeight && rect.top > fixedTopHeight)
					{
						lastStickySummary = lastSummary;
					}

					lastSummary = summary;
					lastTop = rect.top;
				}
			});

			if (lastStickySummary == null)
			{
				lastStickySummary = lastSummary;
			}

			summaries.forEach(function (summary)
			{
				if (summary === lastStickySummary)
				{
					summary.classList.add('summary-sticky');
					summary.style.top = fixedTopHeight + 'px'; // Set the top of the summary div to the height of the fixedTop div
				}
				else
				{
					summary.classList.remove('summary-sticky');
				}
			});
		}

		window.addEventListener("scroll", makeSummarySticky);

		// if the display configuration has been fetched, update the display controls
		function fillDisplayDevices()
		{
			if (displayDevicesFetched)
			{
				// Get the current display configuration
				var displayConfig = localDisplayConfigurations[displayConfigurationNoElement.value];

				if (displayConfig)
				{
					for (var itemNo = 0; itemNo < displayConfig.items.length; itemNo++)
					{
						fillDevicesElement(document.getElementById(`display${itemNo}Device`), displayDevicesArray);

						// If the current device is not in the list, add it
						if (displayConfig.items[itemNo].device !== 'none' && displayConfig.items[itemNo].device !== '_variable_' && displayConfig.items[itemNo].device !== 'customMQTT' && displayConfig.items[itemNo].device !== '' && !displayDevicesArray.includes(displayConfig.items[itemNo].device))
						{
							var option = document.createElement("option");
							option.text = displayConfig.items[itemNo].deviceName + " (Missing)";
							option.value = displayConfig.items[itemNo].device;
							document.getElementById(`display${itemNo}Device`).add(option);

							// Select the current device
							document.getElementById(`display${itemNo}Device`).value = displayConfig.items[itemNo].device;

							// // Add the stored capability for the device as we can't fetch the list of capabilities if the device is missing
							// var option = document.createElement("option");
							// option.text = displayConfig.items[itemNo].capabilityName + " (Missing)";
							// option.value = displayConfig.items[itemNo].capability;
							// document.getElementById(`display${itemNo}Capability`).add(option);

							// // Select the current capability
							// document.getElementById(`display${itemNo}Capability`).value = displayConfig.items[itemNo].capability;
						}
						else
						{
							// Select the current device
							document.getElementById(`display${itemNo}Device`).value = displayConfig.items[itemNo].device;
						}

						getDisplayCapabilities(itemNo);
					}
				}
			}
		}

		function fillDisplayVariablesElement(item, capabilityElement, selectedVariable, selectedVariableName)
		{
			for (const variable of variablesArray)
			{
				var option = document.createElement("option");
				option.text = variable.name;
				option.value = variable.id;
				capabilityElement.add(option);
			}

			// Restore the previous variable selection
			capabilityElement.value = selectedVariable;
			if (capabilityElement.value !== selectedVariable)
			{
				// The variable must be missing, so add it to the list
				var option = document.createElement("option");
				option.text = selectedVariableName + " (Missing)";
				option.value = selectedVariable;
				capabilityElement.add(option);

				capabilityElement.value = selectedVariable;
			}
		}

		function getDisplayCapabilities(itemNo)
		{
			var deviceId = document.getElementById(`display${itemNo}Device`).value;
			var capabilitiesElement = document.getElementById(`display${itemNo}Capability`);
			capabilitiesElement.innerHTML = "";

			if (deviceId === 'customMQTT')
			{
				document.getElementById(`display${itemNo}CustomMQTTTopicDiv`).style.display = itemDisplyType;
			}
			else
			{
				document.getElementById(`display${itemNo}CustomMQTTTopicDiv`).style.display = "none";
			}

			if (deviceId === 'customMQTT' || deviceId === 'none')
			{
				document.getElementById(`display${itemNo}CapabilityDiv`).style.display = "none";
				document.getElementById(`display${itemNo}UnitDiv`).style.display = "none";
				document.getElementById(`display${itemNo}TextDiv`).style.display = itemDisplyType;
				onDisplayLabelChange({ id: `display${itemNo}Device`, value: '' }, itemNo);
				return;
			}

			if (deviceId === '_variable_')
			{
				document.getElementById(`display${itemNo}CapabilityDiv`).style.display = itemDisplyType;
				document.getElementById(`display${itemNo}UnitDiv`).style.display = itemDisplyType;
				document.getElementById(`display${itemNo}TextDiv`).style.display = "none";

				var selectedVariable = '';
				var selectedVariableName = '';
				var displayConfig = localDisplayConfigurations[displayConfigurationNoElement.value];
				if (displayConfig)
				{
					selectedVariable = displayConfig.items[itemNo].capability;
					selectedVariableName = displayConfig.items[itemNo].capabilityName;
				}

				if (variablesFetched && variablesArray.length > 0)
				{
					// Add each of the variables to the item drop list
					fillDisplayVariablesElement(itemNo, capabilitiesElement, selectedVariable, selectedVariableName);
				}
				else
				{
					const loadingOption = document.createElement("option");
					loadingOption.text = Homey.__("settings.loadingVariables");
					loadingOption.value = "";
					loadingOption.disabled = true;
					loadingOption.selected = true;
					capabilitiesElement.add(loadingOption);

					if (displayFieldPopupContext && displayFieldPopupContext.itemNo === itemNo && displayFieldPopupContext.popupElementsBySuffix)
					{
						const popupDeviceElement = displayFieldPopupContext.popupElementsBySuffix.Device;
						const popupCapabilityElement = displayFieldPopupContext.popupElementsBySuffix.Capability;
						if (popupDeviceElement && popupCapabilityElement && popupDeviceElement.value === '_variable_')
						{
							syncDisplayFieldPopupCapabilityOptions(itemNo, popupCapabilityElement, '');
							updateDisplayFieldPopupCapabilityState(displayFieldPopupContext.popupElementsBySuffix);
						}
					}

					// Resquest the list of variables
					Homey.api('POST', '/get_variables/', {}, function (err, variables)
					{
						if (err) return Homey.alert(err);

						if (variables)
						{
							// Add each of the variables to the item drop list
							variablesArray = Object.values(variables);
							variablesFetched = true;
							fillDisplayVariablesElement(itemNo, capabilitiesElement, selectedVariable, selectedVariableName);

							// If the display popup is open for this item, refresh the popup capability list
							// now that variable options are finally available.
							if (displayFieldPopupContext && displayFieldPopupContext.itemNo === itemNo && displayFieldPopupContext.popupElementsBySuffix)
							{
								const popupDeviceElement = displayFieldPopupContext.popupElementsBySuffix.Device;
								const popupCapabilityElement = displayFieldPopupContext.popupElementsBySuffix.Capability;
								if (popupDeviceElement && popupCapabilityElement && popupDeviceElement.value === '_variable_')
								{
									syncDisplayFieldPopupCapabilityOptions(itemNo, popupCapabilityElement, popupCapabilityElement.value || selectedVariable);
									updateDisplayFieldPopupCapabilityState(displayFieldPopupContext.popupElementsBySuffix);
								}
							}
						}
					});
				}

				return;
			}

			const capabilities = displayCapabilityItems.get(deviceId);
			if (capabilities)
			{
				fillDisplayCapabilitiesElement(itemNo, capabilitiesElement, capabilities);
			}
			else
			{
				// Resquest the list of capabilities
				Homey.api('POST', '/device_capabilities/', { deviceId }, function (err, capabilities)
				{
					if (err) return Homey.alert(err);

					if (capabilities)
					{
						displayCapabilityItems.set(deviceId, capabilities);
						fillDisplayCapabilitiesElement(itemNo, capabilitiesElement, capabilities);
					}
				});
			}
		}

		function fillDisplayCapabilitiesElement(itemNo, capabilitiesElement, capabilities)
		{
			const capabilitiesArray = Object.values(capabilities);
			for (const capability of capabilitiesArray)
			{
				var option = document.createElement("option");
				option.text = `${capability.title} (${capability.id})`;
				option.value = capability.id;
				const capabilityIconUrl = getCapabilityIconUrl(capability);
				if (capabilityIconUrl)
				{
					option.dataset.iconUrl = capabilityIconUrl;
				}
				capabilitiesElement.add(option);
			}

			document.getElementById(`display${itemNo}CapabilityDiv`).style.display = itemDisplyType;
			document.getElementById(`display${itemNo}UnitDiv`).style.display = itemDisplyType;
			document.getElementById(`display${itemNo}TextDiv`).style.display = "none";

			var displayConfig = localDisplayConfigurations[displayConfigurationNoElement.value];
			if (displayConfig)
			{
				const capabilityID = displayConfig.items[itemNo].capability;
				if (capabilities[capabilityID])
				{
					if (document.getElementById(`display${itemNo}Unit`).value === '')
					{
						document.getElementById(`display${itemNo}Unit`).value = capabilities[capabilityID].unit ? capabilities[capabilityID].unit : "";
					}
				}
				else
				{
					// The capability must be missing, so add it to the list
					var option = document.createElement("option");
					option.text = capabilityID + " (Missing)";
					option.value = capabilityID;
					capabilitiesElement.add(option);
				}

				capabilitiesElement.value = capabilityID;
			}
		}

		function selectDisplayCapability(Element, itemNo)
		{
			// var capabilities = null;
			// if (displayCapabilityItems[itemNo].capabilities)
			// {
			// 	capabilities = displayCapabilityItems[itemNo].capabilities
			// }
			// else
			// {
			// 	capabilities = variablesArray
			// }

			// var capabilityID = Element.value;
			// if (capabilityID != "" && capabilities[capabilityID])
			// {
			// 	document.getElementById(`display${itemNo}Unit`).value = capabilities[capabilityID].units ? capabilities[capabilityID].units : "";
			// }

			onDisplayLabelChange({ id: Element.id, value: '' }, itemNo);
		}

		function deleteItem(itemNo)
		{
			// Save all the settings so they don't get lost when the controls are redawn
			storeDisplaySettings();

			var displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];

			if (displayConfiguration != null)
			{
				displayConfiguration.items.splice(itemNo, 1);
				drawDisplayConfiguration(displayConfiguration);
			}
		}

		function deleteSelectedInlineDisplayItem()
		{
			const displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];
			if (!displayConfiguration || !Array.isArray(displayConfiguration.items) || displayConfiguration.items.length === 0)
			{
				displayInlineSelectedItemNo = -1;
				renderDisplayInlineSimulator();
				return;
			}

			if (displayInlineSelectedItemNo < 0 || displayInlineSelectedItemNo >= displayConfiguration.items.length)
			{
				displayInlineSelectedItemNo = displayConfiguration.items.length - 1;
				renderDisplayInlineSimulator();
				return;
			}

			const deleteIndex = displayInlineSelectedItemNo;
			displayInlineSelectedItemNo = (displayConfiguration.items.length <= 1)
				? -1
				: Math.min(deleteIndex, displayConfiguration.items.length - 2);
			deleteItem(deleteIndex);
			flushConfigurationDraftPersist();
		}

		function storeDisplaySettings()
		{
			var displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];

			if (displayConfiguration != null)
			{
				displayConfiguration.version = 2;
				displayConfiguration.name = displayConfigNameElement.value;

				for (var itemNo = 0; itemNo < displayConfiguration.items.length; itemNo++)
				{
					const deviceElement = document.getElementById(`display${itemNo}Device`);

					displayConfiguration.items[itemNo].device = deviceElement.value;
					if (deviceElement.selectedIndex >= 0)
					{
						displayConfiguration.items[itemNo].deviceName = deviceElement.options[deviceElement.selectedIndex].text;

						// Remove ' (Missing Devices)' from the device name
						displayConfiguration.items[itemNo].deviceName = displayConfiguration.items[itemNo].deviceName.replace(/ \(Missing Devices\)/g, '');
					}
					else
					{
						displayConfiguration.items[itemNo].deviceName = "";
					}

					displayConfiguration.items[itemNo].capability = document.getElementById(`display${itemNo}Capability`).value;
					if (document.getElementById(`display${itemNo}Capability`).selectedIndex >= 0)
					{
						displayConfiguration.items[itemNo].capabilityName = document.getElementById(`display${itemNo}Capability`).options[document.getElementById(`display${itemNo}Capability`).selectedIndex].text;

						// Remove ' (Missing)' from the capability name
						displayConfiguration.items[itemNo].capabilityName = displayConfiguration.items[itemNo].capabilityName.replace(/ \(Missing\)/g, '');
					}
					else
					{
						displayConfiguration.items[itemNo].capabilityName = "";
					}
					displayConfiguration.items[itemNo].label = sanitizeDisplayString(document.getElementById(`display${itemNo}Label`).value, '');
					displayConfiguration.items[itemNo].unit = sanitizeDisplayString(document.getElementById(`display${itemNo}Unit`).value, '');
					displayConfiguration.items[itemNo].text = sanitizeDisplayString(document.getElementById(`display${itemNo}Text`).value, '');
					displayConfiguration.items[itemNo].xPos = document.getElementById(`display${itemNo}X`).value;
					displayConfiguration.items[itemNo].yPos = document.getElementById(`display${itemNo}Y`).value;
					displayConfiguration.items[itemNo].width = document.getElementById(`display${itemNo}Width`).value;
					displayConfiguration.items[itemNo].rounding = document.getElementById(`display${itemNo}Rounding`).value;
					displayConfiguration.items[itemNo].fontSize = document.getElementById(`display${itemNo}FontSize`).value;
					displayConfiguration.items[itemNo].brokerId = document.getElementById(`display${itemNo}BrokerId`).value;
					displayConfiguration.items[itemNo].page = document.getElementById(`display${itemNo}page`).value;
					displayConfiguration.items[itemNo].boxType = document.getElementById(`display${itemNo}BoxType`).value;
					displayConfiguration.items[itemNo].svg = clampSVGField(document.getElementById(`display${itemNo}SVG`)?.value || '');

					storeDisplayCustomMQTTItems(itemNo, displayConfiguration.items[itemNo].customMQTTTopics);
				}
			}
		}

		function addDisplayItem()
		{
			if (!displayConfigurationsFetched)
			{
				return;
			}

			storeDisplaySettings();

			displayConfigurationNo = displayConfigurationNoElement.value;
			var displayConfiguration = localDisplayConfigurations[displayConfigurationNo];
			if (displayConfiguration)
			{
				let itemId = displayConfiguration.items.length;
				const targetPage = Number.isInteger(displayPagePopupCurrentPage) ? displayPagePopupCurrentPage : 0;

				var displayItem = {
					itemId,
					device: "none",
					deviceName: "none",
					capability: "",
					capabilityName: "",
					label: "New Item",
					unit: "",
					numberRounding: -1,
					xPos: 0,
					yPos: 0,
					width: 100,
					fontSize: 1,
					brokerId: 'Default',
					page: targetPage,
					customMQTTTopics: [],
					svg: '',
				};

				displayConfiguration.items.push(displayItem) - 1;
				displayConfiguration.pageCount = Math.max(parseInt(displayConfiguration.pageCount, 10) || 1, targetPage + 1);
				localDisplayConfigurations[displayConfigurationNo] = displayConfiguration;
				displayInlineSelectedItemNo = displayConfiguration.items.length - 1;

				drawDisplayConfiguration(displayConfiguration, itemId);
				flushConfigurationDraftPersist();
			}
		}

		function addDisplayPage()
		{
			if (!displayConfigurationsFetched)
			{
				return;
			}

			storeDisplaySettings();
			const displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];
			if (!displayConfiguration)
			{
				return;
			}

			const currentPage = Number.isInteger(displayPagePopupCurrentPage) ? displayPagePopupCurrentPage : 0;
			const insertedPage = Math.max(0, currentPage + 1);

			if (Array.isArray(displayConfiguration.items))
			{
				for (const item of displayConfiguration.items)
				{
					const itemPage = parseInt(item.page, 10) || 0;
					if (itemPage >= insertedPage)
					{
						item.page = itemPage + 1;
					}
				}
			}

			const currentPageCount = Math.max(parseInt(displayConfiguration.pageCount, 10) || getDisplayPopupPages(displayConfiguration).length, 1);
			displayConfiguration.pageCount = currentPageCount + 1;
			displayPagePopupCurrentPage = insertedPage;
			displayInlineSelectedItemNo = -1;
			drawDisplayConfiguration(displayConfiguration);
			flushConfigurationDraftPersist();
		}

		function deleteCurrentDisplayPage()
		{
			if (!displayConfigurationsFetched)
			{
				return;
			}

			if (!Number.isInteger(displayPagePopupCurrentPage) || displayPagePopupCurrentPage <= 0)
			{
				return;
			}

			storeDisplaySettings();
			const displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];
			if (!displayConfiguration || !Array.isArray(displayConfiguration.items))
			{
				return;
			}

			displayConfiguration.items = displayConfiguration.items.filter((item) =>
			{
				const itemPage = parseInt(item.page, 10) || 0;
				return itemPage !== displayPagePopupCurrentPage;
			});

			for (const item of displayConfiguration.items)
			{
				const itemPage = parseInt(item.page, 10) || 0;
				if (itemPage > displayPagePopupCurrentPage)
				{
					item.page = itemPage - 1;
				}
			}

			const currentPageCount = Math.max(parseInt(displayConfiguration.pageCount, 10) || getDisplayPopupPages(displayConfiguration).length, 1);
			displayConfiguration.pageCount = Math.max(1, currentPageCount - 1);

			const remainingPages = getDisplayPopupPages(displayConfiguration);
			displayPagePopupCurrentPage = remainingPages.includes(displayPagePopupCurrentPage - 1)
				? (displayPagePopupCurrentPage - 1)
				: remainingPages[remainingPages.length - 1] || 0;
			displayInlineSelectedItemNo = -1;

			drawDisplayConfiguration(displayConfiguration);
			flushConfigurationDraftPersist();
		}

		/// Broker Config code
		function drawBrokerItems()
		{
			document.getElementById('brokerItemsSection').innerHTML = "";
			for (var itemNo = 0; itemNo < localBrokerItems.length; itemNo++)
			{
				const item = localBrokerItems[itemNo];
				insertBrokerItemSection(item, itemNo);
			}
		}

		function insertBrokerItemSection(item, itemNo, expanded = false)
		{
			const ctrlLabels = {
				id: Homey.__("settings.id"),
				address: Homey.__("settings.address"),
				port: Homey.__("settings.port"),
				wsPort: Homey.__("settings.wsPort"),
				enabled: Homey.__("settings.enabled"),
				username: Homey.__("settings.username"),
				password: Homey.__("settings.password"),
				idExplanation: Homey.__("settings.idExplanation"),
				addressExplanation: Homey.__("settings.addressExplanation"),
				portExplanation: Homey.__("settings.portExplanation"),
				wsPortExplanation: Homey.__("settings.wsPortExplanation"),
				enabledExplanation: Homey.__("settings.enabledExplanation"),
				usernameExplanation: Homey.__("settings.usernameExplanation"),
				passwordExplanation: Homey.__("settings.passwordExplanation"),
			};
			const itemLegend = Homey.__("settings.brokerItemlegend", { itemNo: itemNo + 1 });
			const protected = item.protected ? "disabled" : "";
			const enableOption = item.enabled ? "checked" : "";
			let deleteButton = "";
			if (!item.protected)
			{
				deleteButton = `<p><button class="homey-button-secondary-shadow" id="deleteBrokerItem${itemNo}" onClick="deleteBrokerItem(${itemNo})" style="font-size: 30px;"><i class="fi fi-rr-trash"></i> </button></p>`;
			}

			let brokerDescription = "";
			if (item.brokerid === "homey")
			{
				brokerDescription = Homey.__("settings.brokerHomey");
				ctrlLabels.passwordExplanation = Homey.__("settings.homeyPasswordExplanation");
				ctrlLabels.usernameExplanation = Homey.__("settings.homeyUsernameExplanation");
			}
			else if (item.brokerid === "buttonplus")
			{
				brokerDescription = Homey.__("settings.brokerButtonPlus");
			}
			else
			{
				brokerDescription = Homey.__("settings.brokerUser");
			}

			var section = document.getElementById('brokerItemsSection').innerHTML;
			section = section +
				`<div class="horizontalcontainer">
					<div class="horizontalgroup">
						<details ${expanded ? 'open' : ''}>
							<summary class="summary">
								<legend class="homey-subtitle" id="broker${itemNo}Legend"><b><em>${itemLegend}</em></b> - ${item.brokerid}</legend>
								<span class="icon" style='font-size:30px;'>&#8628;</span>
							</summary>
							<hr>
							<p>${brokerDescription}</p>

							<label class="homey-form-label" for="broker${itemNo}Id">${ctrlLabels.id}
								<div class="tooltip" onmouseover="position_tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">${ctrlLabels.idExplanation}</span>
								</div>
							</label>
							<input class="homey-form-input" id="broker${itemNo}Id" type="text" value="${item.brokerid}" ${protected} onChange="updateBrokerLists(${itemNo})" oninput="onBrokerLabelChange(this, ${itemNo})"/>

							<label class="homey-form-label" for="broker${itemNo}Address">${ctrlLabels.address}
								<div class="tooltip" onmouseover="position_tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">${ctrlLabels.addressExplanation}</span>
								</div>
							</label>
							<input class="homey-form-input" id="broker${itemNo}Address" type="text" value="${item.url}" ${protected} />

							<label class="homey-form-label" for="broker${itemNo}Port">${ctrlLabels.port}
								<div class="tooltip" onmouseover="position_tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">${ctrlLabels.portExplanation}</span>
								</div>
							</label>
							<input class="homey-form-input" id="broker${itemNo}Port" type="number" value="${item.port}" />

							<label class="homey-form-label" for="broker${itemNo}WSPort">${ctrlLabels.wsPort}
								<div class="tooltip" onmouseover="position_tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">${ctrlLabels.wsPortExplanation}</span>
								</div>
							</label>
							<input class="homey-form-input" id="broker${itemNo}WSPort" type="number" value="${item.wsport}" />

							<label class="homey-form-label" for="broker${itemNo}Username">${ctrlLabels.username}
								<div class="tooltip" onmouseover="position_tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">${ctrlLabels.usernameExplanation}</span>
								</div>
							</label>
							<input class="homey-form-input" id="broker${itemNo}Username" type="text" value="${item.username ? item.username : ""}""/>

							<label class="homey-form-label" for="broker${itemNo}Password">${ctrlLabels.password}
								<div class="tooltip" onmouseover="position_tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">${ctrlLabels.passwordExplanation}</span>
								</div>
							</label>
							<input class="homey-form-input" id="broker${itemNo}Password" type="text" value="${item.password ? item.password : ""}""/>

							<label class="homey-form-checkbox">
								<input class="homey-form-checkbox-input" id="broker${itemNo}Enabled" onClick="rebuildBrokerLists(${itemNo})" type="checkbox" ${enableOption}/>
								<span class="homey-form-checkbox-checkmark"></span>
								<span class="homey-form-checkbox-text">${ctrlLabels.enabled}</span>
								<div class="tooltip" onmouseover="position_tooltip"><i class="fi fi-rr-info"></i>
									<span class="tooltiptext">${ctrlLabels.enabledExplanation}</span>
								</div>
							</label>

							${deleteButton}
						</details>
					</div>
				</div>`;

			document.getElementById('brokerItemsSection').innerHTML = section;
		}

		function onBrokerLabelChange(element, itemNo)
		{
			document.getElementById(`broker${itemNo}Legend`).innerHTML = `<b><em>${Homey.__("settings.brokerItemlegend", { itemNo: itemNo + 1 })}</em></b> - ${element.value}`;
		}

		function updateBrokerLists(itemNo)
		{
			// Get the current button configuration
			const buttonConfig = localButtonConfigurations[currentButtonConfigurationNo];

			// if buttonConfig is and array then the number of pages is the length of the array else it is 1
			const numberOfPages = Array.isArray(buttonConfig) ? buttonConfig.length : 1;
			for (let page = 0; page < numberOfPages; page++)
			{
				updateBrokerListSection(itemNo, 'left', page);
				updateBrokerListSection(itemNo, 'right', page);
			}

			// Update the default broker list
			defaultBrokerElement.options[itemNo].text = document.getElementById(`broker${itemNo}Id`).value;

			// Update the broker in the all the custom MQTT topics in the panel config
			for (let k = 0; k < customMQTTItemsElements.length; k++)
			{
				customMQTTItemsElements[k].options[itemNo].text = document.getElementById(`broker${itemNo}Id`).value;
			}

			// Update the broker in the all the custom disply MQTT topics in the panel config
			for (let k = 0; k < customDisplayMQTTItemsElements.length; k++)
			{
				customDisplayMQTTItemsElements[k].options[itemNo].text = document.getElementById(`broker${itemNo}Id`).value;
			}

			// Update the broker lists in the display config
			const displayConfig = localDisplayConfigurations[currentDisplayConfigurationNo];
			for (var displayItemNo = 0; displayItemNo < displayConfig.items.length; displayItemNo++)
			{
				const brokerIdElement = document.getElementById(`display${displayItemNo}BrokerId`);
				brokerIdElement.options[itemNo].text = document.getElementById(`broker${itemNo}Id`).value;
			}
		}

		function updateBrokerListSection(itemNo, side, page)
		{
			// Update the broker in the left and right broker list in the panel config
			const brokerIdElement = document.getElementById(`${side}${page}BrokerId`);
			brokerIdElement.options[itemNo].text = document.getElementById(`broker${itemNo}Id`).value;
		}

		function deleteBrokerItem(itemNo)
		{
			if (localBrokerItems.length > 2 && !localBrokerItems[itemNo].protected)
			{
				localBrokerItems.splice(itemNo, 1);
				drawBrokerItems();

				// Remove from the default broker list
				defaultBrokerElement.remove(itemNo);

				// Remove the broker from the broker list in the panel and display config
				removeBrokerFromConfig(itemNo);
			}
			else
			{
				Homey.alert(Homey.__("settings.deleteBrokerItemError"));
			}
		}

		function rebuildBrokerLists(itemNo)
		{
			const enabled = document.getElementById(`broker${itemNo}Enabled`).checked;
			localBrokerItems[itemNo].enabled = enabled;

			// Fetch current settings so we can restore them after the rebuild
			// Get the current configuration
			const buttonConfig = localButtonConfigurations[currentButtonConfigurationNo];

			// if buttonConfig is and array then the number of pages is the length of the array else it is 1
			const numberOfPages = buttonConfig.length;
			for (let page = 0; page < numberOfPages; page++)
			{
				// get the broker element
				const leftBrokerIdElement = document.getElementById(`left${page}BrokerId`);
				const rightBrokerIdElement = document.getElementById(`right${page}BrokerId`);

				buttonConfig[page].leftBrokerId = leftBrokerIdElement.value;
				buttonConfig[page].rightBrokerId = rightBrokerIdElement.value;

				// reset the broker lists in all the config items
				leftBrokerIdElement.length = 0;
				rightBrokerIdElement.length = 0;
			}

			for (let k = 0; k < customMQTTItemsElements.length; k++)
			{
				customMQTTItemsElements[k].length = 0;
			}

			for (let k = 0; k < customDisplayMQTTItemsElements.length; k++)
			{
				customDisplayMQTTItemsElements[k].length = 0;
			}

			// Reset the default broker list
			const defaultBrokerItem = defaultBrokerElement.value;
			defaultBrokerElement.length = 0;

			const displayConfig = localDisplayConfigurations[currentDisplayConfigurationNo];
			for (let displayItemNo = 0; displayItemNo < displayConfig.items.length; displayItemNo++)
			{
				const displayItem = displayConfig.items[displayItemNo];
				const brokerIdElement = document.getElementById(`display${displayItemNo}BrokerId`);
				displayItem.brokerId = brokerIdElement.value;

				brokerIdElement.length = 0;
			}

			// Add a 'Default' broker entry to the lists
			var defaultText = Homey.__("settings.default");

			for (let page = 0; page < numberOfPages; page++)
			{
				// get the broker element
				const leftBrokerIdElement = document.getElementById(`left${page}BrokerId`);
				const rightBrokerIdElement = document.getElementById(`right${page}BrokerId`);

				var option = document.createElement("option");
				option.value = 'Default';
				option.text = defaultText;
				leftBrokerIdElement.add(option);

				var option = document.createElement("option");
				option.value = 'Default';
				option.text = defaultText;
				rightBrokerIdElement.add(option);
			}

			// Add the brokers to the broker list in the panel and display config
			for (var itemNo = 0; itemNo < localBrokerItems.length; itemNo++)
			{
				// Add the broker to the broker list in the panel and display config
				var brokerItem = localBrokerItems[itemNo];
				if (brokerItem.enabled)
				{
					addBrokerToConfig(brokerItem);
				}
			}

			for (let page = 0; page < numberOfPages; page++)
			{
				// get the broker element
				const leftBrokerIdElement = document.getElementById(`left${page}BrokerId`);
				const rightBrokerIdElement = document.getElementById(`right${page}BrokerId`);

				// select the broker in the broker list in the panel and display config
				leftBrokerIdElement.value = buttonConfig[page].leftBrokerId;
				rightBrokerIdElement.value = buttonConfig[page].rightBrokerId;
			}

			for (let displayItemNo = 0; displayItemNo < displayConfig.items.length; displayItemNo++)
			{
				var optionDisplay = document.createElement("option");
				optionDisplay.value = 'Default';
				optionDisplay.text = defaultText;
				document.getElementById(`display${displayItemNo}BrokerId`).add(optionDisplay);
				const displayItem = displayConfig.items[displayItemNo];
				const brokerIdElement = document.getElementById(`display${displayItemNo}BrokerId`);
				brokerIdElement.value = displayItem.brokerId;
			}
		}

		function addBrokerToConfig(brokerItem, numberOfPages)
		{
			// Add the new broker to the default broker list
			var option = document.createElement("option");
			option.value = brokerItem.brokerid;
			option.text = brokerItem.brokerid;
			defaultBrokerElement.add(option);

			for (let page = 0; page < numberOfPages; page++)
			{
				// get the broker element
				const leftBrokerIdElement = document.getElementById(`left${page}BrokerId`);
				const rightBrokerIdElement = document.getElementById(`right${page}BrokerId`);

				// Add the new broker to the panel config broker lists
				var optionLeft = document.createElement("option");
				optionLeft.value = brokerItem.brokerid;
				optionLeft.text = brokerItem.brokerid;
				leftBrokerIdElement.add(optionLeft);

				var optionRight = document.createElement("option");
				optionRight.value = brokerItem.brokerid;
				optionRight.text = brokerItem.brokerid;
				rightBrokerIdElement.add(optionRight);
			}

			// Add the new broker to the custom MQTT topic broker lists
			for (let k = 0; k < customMQTTItemsElements.length; k++)
			{
				var option = document.createElement("option");
				option.value = brokerItem.brokerid;
				option.text = brokerItem.brokerid;
				customMQTTItemsElements[k].add(option);
			}

			// Add the new broker to the custom display MQTT topic broker lists
			for (let k = 0; k < customDisplayMQTTItemsElements.length; k++)
			{
				var option = document.createElement("option");
				option.value = brokerItem.brokerid;
				option.text = brokerItem.brokerid;
				customDisplayMQTTItemsElements[k].add(option);
			}

			// Add the new broker to the display config broker lists
			const displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];
			for (let j = 0; j < displayConfiguration.items.length; j++)
			{
				const displayItem = displayConfiguration.items[j];
				var option = document.createElement("option");
				option.value = brokerItem.brokerid;
				option.text = brokerItem.brokerid;
				let brokerIdElement = document.getElementById(`display${j}BrokerId`);
				brokerIdElement.add(option);
			}
		}

		function removeBrokerFromConfig(itemNo)
		{
			// Get the current configuration
			var buttonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];

			// if localButtonConfigurations is an array, then set numPage to the length of the array otherwise set numPage to 1
			var numPages = Array.isArray(buttonPanelConfiguration) ? buttonPanelConfiguration.length : 1;

			for (page = 0; page < numPages; page++)
			{
				// Remove the broker from the left and right broker list in the panel config
				const leftBrokerIdElement = document.getElementById(`left${page}BrokerId`);
				leftBrokerIdElement.remove(itemNo);

				const rightBrokerIdElement = document.getElementById(`right${page}BrokerId`);
				rightBrokerIdElement.remove(itemNo);
			}

			// Remove the broker from the all the custom MQTT topics in the panel config
			for (let k = 0; k < customMQTTItemsElements.length; k++)
			{
				customMQTTItemsElements[k].remove(itemNo);
			}

			// Remove the broker from the all the custom display MQTT topics in the panel config
			for (let k = 0; k < customDisplayMQTTItemsElements.length; k++)
			{
				customDisplayMQTTItemsElements[k].remove(itemNo);
			}

			// Remove the broker from all the lists in the display config items
			const displayConfig = localDisplayConfigurations[currentDisplayConfigurationNo];
			for (var displayItemNo = 0; displayItemNo < displayConfig.items.length; displayItemNo++)
			{
				const item = displayConfig.items[displayItemNo];
				const brokerIdElement = document.getElementById(`display${displayItemNo}BrokerId`);
				brokerIdElement.remove(itemNo);
			}

			defaultBrokerElement.remove(itemNo);
		}

		function storeBrokerSettings()
		{
			let oneEnabled = false;
			for (var itemNo = 0; itemNo < localBrokerItems.length; itemNo++)
			{
				// Make sure there isn't already a broker with this id
				newBrokerid = document.getElementById(`broker${itemNo}Id`).value;

				for (var itemNo2 = 0; itemNo2 < itemNo; itemNo2++)
				{
					if (newBrokerid.toUpperCase() === localBrokerItems[itemNo2].brokerid.toUpperCase())
					{
						Homey.alert(Homey.__("settings.duplicateBrokerIdError", { brokerId: newBrokerid }));
						return false;
					}
				}

				const enabled = document.getElementById(`broker${itemNo}Enabled`).checked;
				if (enabled)
				{
					oneEnabled = true;
				}
				localBrokerItems[itemNo].enabled = enabled;
				localBrokerItems[itemNo].brokerid = newBrokerid;
				localBrokerItems[itemNo].url = document.getElementById(`broker${itemNo}Address`).value;
				localBrokerItems[itemNo].port = document.getElementById(`broker${itemNo}Port`).value;
				localBrokerItems[itemNo].wsport = document.getElementById(`broker${itemNo}WSPort`).value;

				const username = document.getElementById(`broker${itemNo}Username`).value;
				const password = document.getElementById(`broker${itemNo}Password`).value;
				if (!username && password)
				{
					Homey.alert(Homey.__("settings.passwordError1"));
					return false;
				}
				localBrokerItems[itemNo].username = username;
				localBrokerItems[itemNo].password = password;
			}

			if (!oneEnabled)
			{
				Homey.alert(Homey.__("settings.noEnabledBrokerError"));
				return false;
			}
			return oneEnabled;
		}

		/// Custom MQTT code
		function drawCustomMQTTTopics(side, page, buttonPanelConfiguration)
		{
			document.getElementById(`${side}${page}CustomMQTTTopicsSection`).innerHTML = "";
			customMQTTItemsElements = [];

			const customMQTTTopics = buttonPanelConfiguration[`${side}CustomMQTTTopics`];

			for (var itemNo = 0; itemNo < customMQTTTopics.length; itemNo++)
			{
				const topic = customMQTTTopics[itemNo];
				insertCustomMQTTTopicSection(topic, itemNo, side);
			}

			// Set the value for the brokerID in each custom MQTT topics section
			for (var itemNo = 0; itemNo < customMQTTTopics.length; itemNo++)
			{
				const topic = customMQTTTopics[itemNo];
				document.getElementById(`${side}${page}CustomMQTT${itemNo}BrokerId`).value = topic.brokerId;
			}

			var tooltips = document.querySelectorAll(".tooltip");
			tooltips.forEach(function (tooltip, index)
			{
				// Set a mouse over function for each tooltop element
				tooltip.addEventListener("mouseover", position_tooltip); // On hover, launch the function below
			})
		}

		function insertCustomMQTTTopicSection(Topic, ItemNo, Side)
		{
			const ctrlLabels = {
				brokerId: Homey.__("settings.brokerId"),
				brokerIdExplanation: Homey.__("settings.brokerIdExplanation"),
				id: Homey.__("settings.MQTTId"),
				idExplanation: Homey.__("settings.MQTTIdExplanation"),
				type: Homey.__("settings.type"),
				typeExplanation: Homey.__("settings.typeExplanation"),
				topic: Homey.__("settings.topic"),
				topicExplanation: Homey.__("settings.topicExplanation"),
				payload: Homey.__("settings.payload"),
				payloadExplanation: Homey.__("settings.payloadExplanation"),
				enabled: Homey.__("settings.enabled"),
				click: Homey.__("settings.click"),
				longPress: Homey.__("settings.longPress"),
				led: Homey.__("settings.led"),
			};
			const itemLegend = Homey.__("settings.customMQTTItemlegend", { itemNo: ItemNo + 1 });
			const enableOption = Topic.enabled ? "checked" : "";

			var section = document.getElementById(`${Side}CustomMQTTTopicsSection`).innerHTML;
			section = section +
				`<div class="horizontalcontainer">
					<div class="horizontalgroup">
						<legend class="homey-subtitle">${itemLegend}</legend>

						<label class="homey-form-label" for="${Side}CustomMQTT${ItemNo}Id">${ctrlLabels.id}
							<div class="tooltip" onmouseover="position_tooltip"><i class="fi fi-rr-info"></i>
								<span class="tooltiptext">${ctrlLabels.idExplanation}</span>
							</div>
						</label>
						<input class="homey-form-input" id="${Side}CustomMQTT${ItemNo}Id" type="text" value="${Topic.id}"/>

						<label class="homey-form-label" for="${Side}CustomMQTT${ItemNo}Type">${ctrlLabels.type}
							<div class="tooltip" onmouseover="position_tooltip"><i class="fi fi-rr-info"></i>
								<span class="tooltiptext">${ctrlLabels.typeExplanation}</span>
							</div>
						</label>
						<select class="homey-form-select" id="${Side}CustomMQTT${ItemNo}Type">
							<option value=0>${ctrlLabels.click}</option>
							<option value=1>${ctrlLabels.longPress}</option>
							<option value=14>${ctrlLabels.led}</option>
						</select><br>

						<label class="homey-form-label" for="${Side}CustomMQTT${ItemNo}topic">${ctrlLabels.topic}
							<div class="tooltip" onmouseover="position_tooltip"><i class="fi fi-rr-info"></i>
								<span class="tooltiptext">${ctrlLabels.topicExplanation}</span>
							</div>
						</label>
						<input class="homey-form-input" id="${Side}CustomMQTT${ItemNo}topic" type="text" value="${Topic.topic}" />

						<label class="homey-form-label" for="${Side}CustomMQTT${ItemNo}payload">${ctrlLabels.payload}
							<div class="tooltip" onmouseover="position_tooltip"><i class="fi fi-rr-info"></i>
								<span class="tooltiptext">${ctrlLabels.payloadExplanation}</span>
							</div>
						</label>
						<input class="homey-form-input" id="${Side}CustomMQTT${ItemNo}payload" type="text" value="${Topic.payload}" />

						<label class="homey-form-label" for="${Side}CustomMQTT${ItemNo}BrokerId">${ctrlLabels.brokerId}
							<div class="tooltip" onmouseover="position_tooltip"><i class="fi fi-rr-info"></i>
								<span class="tooltiptext">${ctrlLabels.brokerIdExplanation}</span>
							</div>
						</label>
						<select class="homey-form-select" id="${Side}CustomMQTT${ItemNo}BrokerId">
						</select><br>

						<label class="homey-form-checkbox">
							<input class="homey-form-checkbox-input" id="${Side}CustomMQTT${ItemNo}Enabled" type="checkbox" ${enableOption}/>
							<span class="homey-form-checkbox-checkmark"></span>
							<span class="homey-form-checkbox-text">${ctrlLabels.enabled}</span>
						</label>

						<p><button class="homey-button-secondary-shadow" id="${Side}DeleteItem${ItemNo}" onClick="deleteCustomMQTTItem(${ItemNo}, '${Side}')" style="font-size: 30px;"><i class="fi fi-rr-trash"></i> </button></p>
					</div>
				</div>`;

			document.getElementById(`${Side}CustomMQTTTopicsSection`).innerHTML = section;
			customMQTTItemsElements.push(document.getElementById(`${Side}CustomMQTT${ItemNo}BrokerId`));

			// Add the brokers to the broker list
			var option = document.createElement("option");
			option.text = 'Default';
			option.value = 'Default';
			customMQTTItemsElements[ItemNo].add(option);
			for (var brokerNo = 0; brokerNo < localBrokerItems.length; brokerNo++)
			{
				const brokerItem = localBrokerItems[brokerNo];
				var option = document.createElement("option");
				option.text = brokerItem.brokerid;
				option.value = brokerItem.brokerid;
				customMQTTItemsElements[ItemNo].add(option);
				customMQTTItemsElements[ItemNo].value = Topic.brokerId;
			}
		}

		// Delete the specified custom item from the button panel configuration and redraw the list
		function deleteCustomMQTTItem(itemNo, side)
		{
			var ButtonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];
			const customMQTTTopics = ButtonPanelConfiguration[`${side}CustomMQTTTopics`];

			customMQTTTopics.splice(itemNo, 1);
			drawCustomMQTTTopics(side, ButtonPanelConfiguration);
		}

		//  Copy the contents of the specified custom item controls to the button panel configuration
		function storeCustomMQTTItem(side, buttonPanelConfiguration, itemNo)
		{
			// Get the custom MQTT topics array
			const customMQTTTopics = buttonPanelConfiguration[`${side}CustomMQTTTopics`];

			// Check if customMQTTTopics is defined and length is not 0
			if (!customMQTTTopics || customMQTTTopics.length === 0) return;

			// Fetch the item from the array or create a new one
			let item = customMQTTTopics[itemNo];
			if (!item)
			{
				item = {};
				customMQTTTopics.push(item);
			}

			// Update the item
			item.id = document.getElementById(`${side}CustomMQTT${itemNo}Id`).value;
			item.type = document.getElementById(`${side}CustomMQTT${itemNo}Type`).value;
			item.topic = document.getElementById(`${side}CustomMQTT${itemNo}topic`).value;
			item.payload = document.getElementById(`${side}CustomMQTT${itemNo}payload`).value;
			item.brokerId = document.getElementById(`${side}CustomMQTT${itemNo}BrokerId`).value;
			item.enabled = document.getElementById(`${side}CustomMQTT${itemNo}Enabled`).checked;
		}

		// Copy the contents of the all the custom items controls to the button panel configuration
		function storeCustomMQTTItems(side, buttonPanelConfiguration)
		{
			for (var itemNo = 0; itemNo < customMQTTItemsElements.length; itemNo++)
			{
				storeCustomMQTTItem(side, buttonPanelConfiguration, itemNo);
			}
		}

		function getButtonList()
		{
			Homey.api('POST', '/buttondevices/', {}, function (err, devices)
			{
				if (err) return Homey.alert(err);

				fillButtonListElement(webViewIpElement, devices);
				fillButtonListElement(lastSentIpElement, devices);
			});
		}

		function fillButtonListElement(Element, DevicesArray)
		{
			if (Element && (DevicesArray.length > 0))
			{
				//fill the device lists with devices
				Element.innerHTML = "";

				for (const device of DevicesArray)
				{
					var option = document.createElement("option");
					option.text = device.name;
					option.value = device.ip;
					Element.add(option);
				}
			}
		}

		function setupButtonBrokerItems()
		{
			if (!brokerItemsFetched)
			{
				setTimeout(setupButtonBrokerItems, 1000);
				return;
			}

			// Add a 'Default' broker entry to the lists
			var defaultText = Homey.__("settings.default");


			// Make sure currentButtonConfigurationNo is set and within range
			if (!currentButtonConfigurationNo || (currentButtonConfigurationNo >= localButtonConfigurations.length))
			{
				currentButtonConfigurationNo = 0;
			}

			// Get the current configuration
			var buttonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];

			// if localButtonConfigurations is an array, then set numPage to the length of the array otherwise set numPage to 1
			var numPages = buttonPanelConfiguration.length;

			for (let page = 0; page < numPages; page++)
			{
				const leftBrokerIdElement = document.getElementById(`left${page}BrokerId`);
				const rightBrokerIdElement = document.getElementById(`right${page}BrokerId`);

				// Add the deafult option to the broker lists
				var option = document.createElement("option");
				option.value = 'Default';
				option.text = defaultText;
				leftBrokerIdElement.add(option);

				var option = document.createElement("option");
				option.value = 'Default';
				option.text = defaultText;
				rightBrokerIdElement.add(option);
			}

			if (displayConfigurationsFetched)
			{
				// Add the deafult option to the display config broker lists
				const displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];
				for (let j = 0; j < displayConfiguration.items.length; j++)
				{
					const displayItem = displayConfiguration.items[j];
					var optionDisplay = document.createElement("option");
					optionDisplay.value = 'Default';
					optionDisplay.text = defaultText;
					document.getElementById(`display${j}BrokerId`).add(optionDisplay);
					document.getElementById(`display${j}BrokerId`).value = displayItem.brokerId;
				}
			}

			// Setup the list items for enabled brokers in the panel config
			for (let i = 0; i < localBrokerItems.length; i++)
			{
				const brokerItem = localBrokerItems[i];
				if (brokerItem.enabled)
				{
					for (let page = 0; page < numPages; page++)
					{
						const leftBrokerIdElement = document.getElementById(`left${page}BrokerId`);
						const rightBrokerIdElement = document.getElementById(`right${page}BrokerId`);

						var option = document.createElement("option");
						option.value = brokerItem.brokerid;
						option.text = brokerItem.brokerid;
						leftBrokerIdElement.add(option);
						if (buttonConfigurationsFetched)
						{
							leftBrokerIdElement.value = buttonPanelConfiguration[page].leftBrokerId;
						}

						var option = document.createElement("option");
						option.value = brokerItem.brokerid;
						option.text = brokerItem.brokerid;
						rightBrokerIdElement.add(option);
						if (buttonConfigurationsFetched)
						{
							rightBrokerIdElement.value = buttonPanelConfiguration[page].rightBrokerId;
						}
					}

					// Add the broker to the custom MQTT topic broker lists
					for (let k = 0; k < customMQTTItemsElements.length; k++)
					{
						var option = document.createElement("option");
						option.value = brokerItem.brokerid;
						option.text = brokerItem.brokerid;
						customMQTTItemsElements[k].add(option);
					}

					// Add the broker to the custom display MQTT topic broker lists
					for (let k = 0; k < customDisplayMQTTItemsElements.length; k++)
					{
						var option = document.createElement("option");
						option.value = brokerItem.brokerid;
						option.text = brokerItem.brokerid;
						customDisplayMQTTItemsElements[k].add(option);
					}

					if (displayConfigurationsFetched)
					{
						// Add the broker to the display config broker lists
						const displayConfiguration = localDisplayConfigurations[currentDisplayConfigurationNo];
						for (let j = 0; j < displayConfiguration.items.length; j++)
						{
							const displayItem = displayConfiguration.items[j];
							var optionDisplay = document.createElement("option");
							optionDisplay.value = brokerItem.brokerid;
							optionDisplay.text = brokerItem.brokerid;
							document.getElementById(`display${j}BrokerId`).add(optionDisplay);
							document.getElementById(`display${j}BrokerId`).value = displayItem.brokerId;
						}
					}
				}
			}

			drawBrokerItems();

			// Fill the default broker list
			fillDefaultBrokerList();
			Homey.get('defaultBroker', function (err, defaultBroker)
			{
				if (err) return Homey.alert(err);

				const defaultBrokerToApply = (restoredDraftDefaultBroker !== null && restoredDraftDefaultBroker !== undefined)
					? restoredDraftDefaultBroker
					: defaultBroker;

				if (defaultBrokerToApply === "")
				{
					defaultBrokerElement.value = 'homey';
				}
				else
				{
					defaultBrokerElement.value = defaultBrokerToApply;
				}
			});
		}

		function buttonDeviceChanged(side, page)
		{
			// Get the current button configuration
			var buttonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];

			// Get the device element
			var deviceElement = document.getElementById(`${side}${page}Device`);

			// Get the config page
			var config = buttonPanelConfiguration[page];

			// Update the device in the local configuration
			config[`${side}Device`] = deviceElement.value;
			if (deviceElement.selectedIndex >= 0)
			{
				config[`${side}CapabilityName`] = deviceElement.options[deviceElement.selectedIndex].text;
			}
			else
			{
				config[`${side}CapabilityName`] = deviceElement.value;
			}

			// Remove all occurrences of ' (Missing Devices)' from the capability name
			config[`${side}CapabilityName`] = config[`${side}CapabilityName`].replace(/ \(Missing Devices\)/g, '');

			// Remove any leading spaces from the device name
			config[`${side}Device`] = config[`${side}Device`].trim();

			updateButtonDeviceIndicator(side, page);

			// Update the capabilities
			getCapabilities(side, page, deviceElement.value, config[`${side}Capability`], config[`${side}CapabilityName`]);
		}

		function buttonCapabilityChanged(side, page)
		{
			const capabilityElement = document.getElementById(`${side}${page}Capability`);
			if (!capabilityElement)
			{
				return;
			}

			capabilityChanged(side, page, capabilityElement.value);
			updateButtonCapabilityIndicator(side, page);
		}

		function deleteButtonPage(page)
		{
			const pageLabel = formatButtonPageLabel(page);
			Homey.confirm(`Delete page ${pageLabel}?`, null, function (err, ok)
			{
				if (err || !ok)
				{
					return;
				}

				// Delete the page from the current button configuration
				var buttonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];
				buttonPanelConfiguration.splice(page, 1);

				// Renumber the pages
				for (let i = 0; i < buttonPanelConfiguration.length; i++)
				{
					buttonPanelConfiguration[i].PageNum = i;
				}

				// Create and display the new page
				writeButtonsections(buttonPanelConfiguration.length);
				updateButtonPanelControls();
				updateButtonMainDiagnostics('deleteButtonPage', { page });
			});
		}

		function addButtonPage()
		{
			try
			{
				let buttonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];

				// Ensure the current config is always an array before we store/clone.
				if (!Array.isArray(buttonPanelConfiguration))
				{
					buttonPanelConfiguration = buttonPanelConfiguration ? [buttonPanelConfiguration] : [];
					localButtonConfigurations[currentButtonConfigurationNo] = buttonPanelConfiguration;
				}

				if (buttonPanelConfiguration.length === 0)
				{
					buttonPanelConfiguration.push({
						PageNum: 0,
						name: configNameElement ? configNameElement.value : '',
					});
				}

				const beforeLength = buttonPanelConfiguration.length;

				// save the controls into the local configuration
				try
				{
					storeButtonSettings(buttonPanelConfiguration);
				}
				catch (error)
				{
					console.error('[addButtonPage] storeButtonSettings failed', error);
				}

				const sourcePageIndex = (buttonMainCurrentPage >= 0 && buttonMainCurrentPage < buttonPanelConfiguration.length)
					? buttonMainCurrentPage
					: 0;

				// Add a new page to the current button configuration
				let newPage = {};
				try
				{
					newPage = JSON.parse(JSON.stringify(buttonPanelConfiguration[sourcePageIndex] || buttonPanelConfiguration[0] || {}));
				}
				catch (cloneError)
				{
					console.error('[addButtonPage] clone failed', cloneError);
					newPage = {};
				}

				newPage.PageNum = buttonPanelConfiguration.length;
				buttonPanelConfiguration.push(newPage);

				if (buttonPanelConfiguration.length <= beforeLength)
				{
					Homey.alert('Unable to add a new page.');
					return;
				}

				buttonMainCurrentPage = buttonPanelConfiguration.length - 1;

				// Create and display the new page
				writeButtonsections(buttonPanelConfiguration.length);
				updateButtonPanelControls();
				updateButtonMainDiagnostics('addButtonPage:click');
				const newPageIndex = buttonPanelConfiguration.length - 1;

				requestAnimationFrame(() =>
				{
					const newPageElement = document.getElementById(`${newPageIndex}ButtonPageSection`);
					if (newPageElement)
					{
						scrollToTop(newPageElement);
						newPageElement.classList.add('button-page-highlight');
						setTimeout(() =>
						{
							newPageElement.classList.remove('button-page-highlight');
						}, 1600);
					}
				});
			}
			catch (error)
			{
				console.error('[addButtonPage] failed', error);
				Homey.alert(`Unable to add page: ${error && error.message ? error.message : error}`);
			}
		}

		window.deleteButtonPage = deleteButtonPage;
		window.addButtonPage = addButtonPage;

		function bindButtonPageHeaderActions()
		{
			const addButtons = document.querySelectorAll('.button-page-add-btn[data-action="add-page"]');
			addButtons.forEach((button) =>
			{
				if (button.dataset.boundClick === 'true')
				{
					return;
				}

				button.addEventListener('click', function (event)
				{
					event.preventDefault();
					event.stopPropagation();
					addButtonPage();
				});

				button.dataset.boundClick = 'true';
			});

			const deleteButtons = document.querySelectorAll('.button-page-delete-btn[data-action="delete-page"]');
			deleteButtons.forEach((button) =>
			{
				if (button.dataset.boundClick === 'true')
				{
					return;
				}

				button.addEventListener('click', function (event)
				{
					event.preventDefault();
					event.stopPropagation();
					const page = Number(button.getAttribute('data-page'));
					if (!Number.isNaN(page))
					{
						deleteButtonPage(page);
					}
				});

				button.dataset.boundClick = 'true';
			});
		}

		function onButtonPageChange(Element, page)
		{
			if (Element.value === "")
			{
				return;
			}

			let newPage = parseInt(Element.value);

			// make sure the new number is > 0 and less than the number of pages
			if (newPage < 0 || newPage >= localButtonConfigurations[currentButtonConfigurationNo].length)
			{
				alert(Homey.__("settings.pageError"));
				Element.value = page;
				return;
			}

			// Now we need to move the page to the new position in the array
			var buttonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];
			var oldPage = page;

			// If the new page is less than the old page, then we need to move the old page to the new page and move all the pages between the new and old page up one
			if (newPage < oldPage)
			{
				// Move the old page to the new page
				var tempPage = buttonPanelConfiguration[oldPage];
				buttonPanelConfiguration.splice(oldPage, 1);
				buttonPanelConfiguration.splice(newPage, 0, tempPage);

				// Renumber the pages
				for (let i = 0; i < buttonPanelConfiguration.length; i++)
				{
					buttonPanelConfiguration[i].PageNum = i;
				}
			}
			else if (newPage > oldPage)
			{
				// Move the old page to the new page
				var tempPage = buttonPanelConfiguration[oldPage];
				buttonPanelConfiguration.splice(oldPage, 1);
				buttonPanelConfiguration.splice(newPage, 0, tempPage);

				// Renumber the pages
				for (let i = 0; i < buttonPanelConfiguration.length; i++)
				{
					buttonPanelConfiguration[i].PageNum = i;
				}
			}

			// Redisplay the pages
			writeButtonsections(buttonPanelConfiguration.length);
			updateButtonPanelControls();
			updateButtonMainDiagnostics('onButtonPageChange', { page, newPage });
		}

		// Create the HTML for the button sections. Note this just creates the framework, the controls values are set using updateButtonPanelControls
		function writeButtonsections(numPages)
		{
			numPages = Number(numPages);
			if (Number.isNaN(numPages) || numPages < 1)
			{
				numPages = 1;
			}

			if (buttonMainCurrentPage < 0)
			{
				buttonMainCurrentPage = 0;
			}
			if (buttonMainCurrentPage >= numPages)
			{
				buttonMainCurrentPage = Math.max(0, numPages - 1);
			}

			var html = "";
			for (page = 0; page < numPages; page++)
			{
				html += `<div class="horizontalcontainer button-main-page${page === buttonMainCurrentPage ? ' active' : ''}">
					<div class="horizontalgroup" id="${page}ButtonPageSection">
                		<div class="horizontalcontainer">
							<div class="button-page-inner">
								<div class="button-page-header">
									<div class="button-page-label-group">
										<div class="button-page-label-title">
											<span class="homey-form-label">${Homey.__("settings.page")}</span>
											<div class="tooltip"><i class="fi fi-rr-info"></i>
												<span class="tooltiptext">${Homey.__("settings.buttonPageExplanation")}</span>
											</div>
										</div>
										<div class="button-main-page-nav">
										<button class="homey-button-secondary-shadow button-sim-page-nav button-main-page-prev" type="button" onclick="stepButtonMainPage(-1); return false;" title="Previous page" aria-label="Previous page">&lt;</button>
										<span class="button-main-page-indicator">${formatButtonPageLabel(page)} / ${Math.max(0, numPages - 1)}</span>
										<button class="homey-button-secondary-shadow button-sim-page-nav button-main-page-next" type="button" onclick="stepButtonMainPage(1); return false;" title="Next page" aria-label="Next page">&gt;</button>
										</div>
									</div>
									<div class="button-page-header-actions">
										${page !== 0 ? `<button class="homey-button-secondary-shadow button-page-delete-btn" id="deletePage${page}" type="button" data-action="delete-page" data-page="${page}" title="Delete page" aria-label="Delete page"><i class="fi fi-rr-trash"></i></button>` : ''}
										<button class="homey-button-secondary-shadow button-page-add-btn" type="button" data-action="add-page" title="Add page" aria-label="Add page">+</button>
									</div>
								</div>
								<div class="button-main-canvas">
									<div class="button-main-canvas-header">
										<span class="homey-form-label button-main-canvas-title">Simulate</span>
										<button class="homey-button-secondary-shadow button-inline-state-toggle" id="${page}ButtonInlineSimState" onClick="toggleInlineButtonSimState(); return false;">On state</button>
									</div>
									<div class="button-sim-bar button-inline-sim-grid" id="${page}ButtonInlineSimContent"></div>
									</div>
									<div class="button-inline-settings-toggle-row">
										<button class="homey-button-secondary-shadow button-inline-settings-toggle" id="${page}ButtonInlineSettingsToggle" type="button" onClick="toggleButtonInlineSettingsSection(${page}); return false;" aria-expanded="false" title="Expand Repeat / Broker" aria-label="Expand Repeat / Broker"><span class="icon" style='font-size:22px;'>&#8628;</span></button>
									</div>
									<details id="${page}ButtonInlineSettingsDetails" class="button-inline-settings-details" ontoggle="updateButtonInlineSettingsToggleState(${page})">
										<summary class="button-inline-settings-summary">Repeat / Broker</summary>
										<div class="button-inline-main-control-grid">
											${getButtonInlineMainControlHtml("left", page)}
											${getButtonInlineMainControlHtml("right", page)}
										</div>
									</details>`

				html += `<div class="button-side-columns">`;
				html += getButtonHtml("left", page);
				html += getButtonHtml("right", page);
				html += `</div>`;

				html += `</div>
					</div>
				</div>
			</div>`;
			}
			document.getElementById('buttonItemsSection').innerHTML = html;
			bindButtonPageHeaderActions();
			collapseAllDetails(document.getElementById('buttonItemsSection'));
			for (let pageIndex = 0; pageIndex < numPages; pageIndex++)
			{
				updateButtonInlineSettingsToggleState(pageIndex);
			}
			renderButtonMainPage();
			updateButtonMainDiagnostics('writeButtonsections', { numPages });
		}

		// Create the HTML for the button page and side
		function getButtonHtml(side, page)
		{
			const leftPanelText = Homey.__("settings.leftPanel");
			const rightPanelText = Homey.__("settings.rightPanel");

			const ctrlLabels = {
				device: Homey.__("settings.device"),
				capability: Homey.__("settings.capability"),
				label: Homey.__("settings.topLabel"),
				text: Homey.__("settings.text"),
				unit: Homey.__("settings.unit"),
				topLabel: Homey.__("settings.topLabel"),
				labelOn: Homey.__("settings.labelOn"),
				labelOff: Homey.__("settings.labelOff"),
				dimChange: Homey.__("settings.dimChange"),
				frontLEDOnColor: Homey.__("settings.frontLEDOnColor"),
				frontLEDOffColor: Homey.__("settings.frontLEDOffColor"),
				wallLEDOffColor: Homey.__("settings.wallLEDOffColor"),
				wallLEDOnColor: Homey.__("settings.wallLEDOnColor"),
				longRepeat: 'Repeat',
				brokerId: Homey.__("settings.brokerId"),
				page: Homey.__("settings.page"),
				customMQTTTopic: Homey.__("settings.customMQTTTopic"),
				newCustomMQTTItem: Homey.__("settings.newCustomMQTTItem"),
				panel: side === 'left' ? leftPanelText : rightPanelText,
			}
			const ctrlExplanations = {
				device: Homey.__("settings.deviceDExplanation"),
				capability: Homey.__("settings.capabilityDExplanation"),
				label: Homey.__("settings.toplabelDisplayExplanation"),
				text: Homey.__("settings.textExplanation"),
				unit: Homey.__("settings.unitExplanation"),
				topLabel: Homey.__("settings.topLabelExplanation"),
				labelOn: Homey.__("settings.labelOnExplanation"),
				labelOff: Homey.__("settings.labelOffExplanation"),
				dimChange: Homey.__("settings.dimValueExplanation"),
				frontLEDOnColor: Homey.__("settings.frontLEDOnColorExplanation"),
				frontLEDOffColor: Homey.__("settings.frontLEDOffColorExplanation"),
				wallLEDOffColor: Homey.__("settings.wallLEDOffColorExplanation"),
				wallLEDOnColor: Homey.__("settings.wallLEDOnColorExplanation"),
				longRepeat: Homey.__("settings.longRepeatExplanation"),
				brokerId: Homey.__("settings.brokerIdExplanation"),
				page: Homey.__("settings.buttonPageExplanation"),
				customMQTTTopic: Homey.__("settings.customMQTTTopicExplanation"),
			}

			const html = `<div class="button-side-column">
						<div class="horizontalgroup">
						<details id="${side}${page}Details" ontoggle="this.open && scrollToTop(this)">
	                            <summary class="summary button-advanced-summary">
                                <legend class="homey-subtitle" id="button${side}${page}Legend"><b><em>><span>${ctrlLabels.panel}</span></em></b></legend><span class="icon" style='font-size:30px;'>&#8628;</span>
                            </summary >
                            <hr>
								<div id="${side}${page}PanelSection">

                                <label class="homey-form-label" for="${side}${page}Device"><span>${ctrlLabels.device}</span>
                                    <div class="tooltip"><i class="fi fi-rr-info"></i>
                                        <span class="tooltiptext">${ctrlExplanations.device}</span>
                                    </div>
                                </label>
	                                <div class="button-device-select-row">
	                                	<div class="button-device-active-icon" id="${side}${page}DeviceActiveIcon" aria-hidden="true"></div>
	                                	<select class="homey-form-select" id="${side}${page}Device" onChange="buttonDeviceChanged('${side}', ${page})">
	                                    	<option value="" selected disabled hidden>${ctrlLabels.device}</option>
	                                	</select>
	                                </div>

                                <span>
                                    <div id="${side}${page}CapabilityDiv">
                                        <label class="homey-form-label" id="${side}${page}CapabilityLabel" for="${side}${page}Capability"><span>${ctrlLabels.capability}</span>
                                            <div class="tooltip"><i class="fi fi-rr-info"></i>
                                                <span class="tooltiptext">${ctrlExplanations.capability}</span>
                                            </div>
                                        </label>
	                                        <div class="button-capability-select-row">
	                                        	<div class="button-capability-active-icon" id="${side}${page}CapabilityActiveIcon" aria-hidden="true"></div>
	                                        	<select class="homey-form-select" id="${side}${page}Capability" onChange="buttonCapabilityChanged('${side}', ${page})">
	                                            	<option value="" selected disabled hidden>${ctrlLabels.capability}</option>
	                                        	</select>
	                                        </div>
                                    </div>
                                </span>

                                <label class="homey-form-label" for="${side}${page}TopText"><span>${ctrlLabels.topLabel}</span>
                                    <div class="tooltip"><i class="fi fi-rr-info"></i>
                                        <span class="tooltiptext">${ctrlExplanations.topLabel}</span>
                                    </div>
                                </label>
                                <input class="homey-form-input" id="${side}${page}TopText" type="text" maxlength="20" oninput="onButtonLabelChange(this, '${side}${page}')" value />

                                <span>
                                    <div id="${side}${page}OnTextDiv">
                                        <label class="homey-form-label" id="${side}${page}OnTextLabel" for="${side}${page}OnText"><span>${ctrlLabels.labelOn}</span>
                                            <div class="tooltip"><i class="fi fi-rr-info"></i>
                                                <span class="tooltiptext">${ctrlExplanations.labelOn}</span>
                                            </div>
                                        </label>
                                        <input class="homey-form-input" id="${side}${page}OnText" type="text" maxlength="20" value="" value />
                                    </div>
                                </span>

                                <span>
                                    <div id="${side}${page}DimChangeDiv">
                                        <label class="homey-form-label" id="${side}${page}DimChangeLabel" for="${side}${page}DimChange"><span>${ctrlLabels.dimChange}</span>
                                            <div class="tooltip"><i class="fi fi-rr-info"></i>
                                                <span class="tooltiptext">${ctrlExplanations.dimChange}</span>
                                            </div>
                                        </label>
                                        <input class="homey-form-input" id="${side}${page}DimChange" type="text" maxlength="20" value />
                                    </div>
                                </span>

                                <label class="homey-form-label" id="${side}${page}OffTextLabel" for="${side}${page}OffText"><span>${ctrlLabels.labelOff}</span>
                                    <div class="tooltip"><i class="fi fi-rr-info"></i>
                                        <span class="tooltiptext">${ctrlExplanations.labelOff}</span>
                                    </div>
                                </label>
                                <input class="homey-form-input" id="${side}${page}OffText" type="text" maxlength="20" value />

                                <label class="homey-form-label" id="${side}${page}FrontLEDOnColorLabel" for="${side}${page}FrontLEDOnColor"><span>${ctrlLabels.frontLEDOnColor}</span>
                                    <div class="tooltip"><i class="fi fi-rr-info"></i>
                                        <span class="tooltiptext">${ctrlExplanations.frontLEDOnColor}</span>
                                    </div>
                                </label>
                                <input class="homey-form-input" id="${side}${page}FrontLEDOnColor" type="color" value=#ff0000 />

                                <label class="homey-form-label" id="${side}${page}WallLEDOnColorLabel" for="${side}${page}FrontLEDOnColor"><span>${ctrlLabels.wallLEDOnColor}</span>
                                    <div class="tooltip"><i class="fi fi-rr-info"></i>
                                        <span class="tooltiptext">${ctrlExplanations.wallLEDOnColor}</span>
                                    </div>
                                </label>
                                <input class="homey-form-input" id="${side}${page}WallLEDOnColor" type="color" value=#ff0000 />

                                <label class="homey-form-label" id="${side}${page}FrontLEDOffColorLabel" for="${side}${page}FrontLEDOffColor"><span>${ctrlLabels.frontLEDOffColor}</span>
                                    <div class="tooltip"><i class="fi fi-rr-info"></i>
                                        <span class="tooltiptext">${ctrlExplanations.frontLEDOffColor}</span>
                                    </div>
                                </label>
                                <input class="homey-form-input" id="${side}${page}FrontLEDOffColor" type="color" value=#ff0000 />

                                <label class="homey-form-label" id="${side}${page}WallLEDOffColorLabel" for="${side}${page}FrontLEDOffColor"><span>${ctrlLabels.wallLEDOffColor}</span>
                                    <div class="tooltip"><i class="fi fi-rr-info"></i>
                                        <span class="tooltiptext">${ctrlExplanations.wallLEDOffColor}</span>
                                    </div>
                                </label>
                                <input class="homey-form-input" id="${side}${page}WallLEDOffColor" type="color" value=#ff0000 />

                                <span>
                                    <div id="${side}${page}CustomMQTTDiv">
                                        <br>
                                            <div id="${side}${page}CustomMQTTTopicsSection"></div>
                                            <p><button class="homey-button-secondary-shadow" id="new${side}${page}CustomMQTTItem"><span>${ctrlLabels.newCustomMQTTItem}</span></button></p>
                                    </div>
                                </span>

                                <label class="homey-form-label" for="${side}${page}OnSVG">On SVG Data
                                    <div class="tooltip"><i class="fi fi-rr-info"></i>
                                        <span class="tooltiptext">Raw SVG code to display as an icon on the button when it is on</span>
                                    </div>
                                </label>
								<div class="svg-editor-wrapper">
									<textarea class="homey-form-textarea svg-editor-textarea" id="${side}${page}OnSVG" data-svg-preview-target="${side}${page}OnSVGPreview"></textarea>
									<div class="svg-preview-box" id="${side}${page}OnSVGPreview"></div>
								</div>

                                <label class="homey-form-label" for="${side}${page}OffSVG">Off SVG Data
                                    <div class="tooltip"><i class="fi fi-rr-info"></i>
                                        <span class="tooltiptext">Raw SVG code to display as an icon on the button when it is off</span>
                                    </div>
                                </label>
								<div class="svg-editor-wrapper">
									<textarea class="homey-form-textarea svg-editor-textarea" id="${side}${page}OffSVG" data-svg-preview-target="${side}${page}OffSVGPreview"></textarea>
									<div class="svg-preview-box" id="${side}${page}OffSVGPreview"></div>
								</div>
								</div>
						</details >
					</div>
				</div>`;
			return html;
		}







