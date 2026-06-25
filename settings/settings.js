		// General declarations
		const MAX_BUTTON_CONFIGURATIONS = 40;
		const MAX_DISPLAY_CONFIGURATIONS = 20;
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

		var addButtonPageElement = document.getElementById('addButtonPage');
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
		var buttonPagePopupCurrentPage = -1;
		var buttonPagePopupLedState = 'on';

		var lastSentIpElement = document.getElementById('sentip');
		var getLogElement = document.getElementById('getLog');
		var sentLogElement = document.getElementById('sentLog');

		// Declarations for the Display Config page

		var displayConfigurationNoElement = document.getElementById('displayConfigurationNo');
		var displayConfigNameElement = document.getElementById('displayConfigName');
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

		// a method named 'onHomeyReady' must be present in your code
		function onHomeyReady(Homey)
		{
			itemDisplyType = document.getElementById('ButtonPanelConfigurationNo').style.display;
			setupFilterableSelects();


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

				updateDisplayConfiguration();
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
					ButtonPanelConfiguration[page].PageNum = document.getElementById(`${page}PageNum`).value;

					// Copy the values from the controls for each page to the displayConfiguration page
					storeButtonSettingsSection('left', page, ButtonPanelConfiguration[page]);
					storeButtonSettingsSection('right', page, ButtonPanelConfiguration[page]);
				}
			}

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
			});

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

			addButtonPageElement.addEventListener('click', function (e)
			{
				var buttonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];

				// save the controls into the local configuration
				storeButtonSettings(buttonPanelConfiguration);

				// Add a new page to the current button configuration
				var newPage = JSON.parse(JSON.stringify(buttonPanelConfiguration[0]));
				newPage.PageNum = buttonPanelConfiguration.length;
				buttonPanelConfiguration.push(newPage);

				// Create and display the new page
				writeButtonsections(buttonPanelConfiguration.length);
				updateButtonPanelControls();

				const newPageIndex = buttonPanelConfiguration.length - 1;
				requestAnimationFrame(() =>
				{
					const newPageElement = document.getElementById(`${newPageIndex}ButtonPageSection`);
					if (newPageElement)
					{
						const newPageDetails = newPageElement.querySelector('details');
						if (newPageDetails)
						{
							newPageDetails.open = true;
						}

						scrollToTop(newPageElement);
						newPageElement.classList.add('button-page-highlight');
						setTimeout(() =>
						{
							newPageElement.classList.remove('button-page-highlight');
						}, 1600);
					}
				});
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

			newDisplayItemButton.addEventListener('click', function (e)
			{
				if (displayConfigurationsFetched)
				{
					// Make sure the current item is saved in the local display configuration
					storeDisplaySettings();

					// Create a new display item
					displayConfigurationNo = displayConfigurationNoElement.value;
					var displayConfiguration = localDisplayConfigurations[displayConfigurationNo];
					if (displayConfiguration)
					{
						let itemId = displayConfiguration.items.length;

						var displayItem = {
							itemId,
							device: "none",
							deviceName: "none",
							capability: "",
							capabilityName: "",
							label: "",
							unit: "",
							numberRounding: -1,
							xPos: 0,
							yPos: 0,
							width: 100,
							fontSize: 1,
							brokerId: 'Default',
							page: 0,
							customMQTTTopics: [],
							svg: '',
						};

						// Add the new display item to the local display configuration
						displayConfiguration.items.push(displayItem) - 1;
						localDisplayConfigurations[displayConfigurationNo] = displayConfiguration;

						// Redraw the display items
						drawDisplayConfiguration(displayConfiguration, itemId);
					}
				}
			});

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

					position_tooltip.call(tooltipTrigger);
				});

				window.tooltipHoverListenerBound = true;
			}

			if (buttonPagePopupCloseElement)
			{
				buttonPagePopupCloseElement.addEventListener('click', closeButtonPagePopup);
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
			};

			document.addEventListener('input', refreshButtonPagePopupFromControl);
			document.addEventListener('change', refreshButtonPagePopupFromControl);

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
					closeButtonPagePopup();
				}
			});

			// Tell Homey we're ready to be displayed
			Homey.ready();

			configTypeChanged('settings');
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

					appendHighlightedText(optionNode, option.text || '', query);
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

		function getButtonPanelLedColor(pageConfig, side, ledType)
		{
			const suffix = (buttonPagePopupLedState === 'on') ? 'OnColor' : 'OffColor';
			const fallback = (buttonPagePopupLedState === 'on') ? '#ffffff' : '#1f2937';
			const colorInputId = `${side}${buttonPagePopupCurrentPage}${ledType}${suffix}`;
			const liveInputElement = document.getElementById(colorInputId);
			const liveColor = liveInputElement ? liveInputElement.value : undefined;
			const configColor = pageConfig[`${side}${ledType}${suffix}`];
			return normalizeLedColor(liveColor || configColor, fallback);
		}

		function getButtonPanelLedMarkup(pageConfig, side)
		{
			const wallColor = escapeHtml(getButtonPanelLedColor(pageConfig, side, 'WallLED'));
			const frontColor = escapeHtml(getButtonPanelLedColor(pageConfig, side, 'FrontLED'));
			const ledColorSuffix = (buttonPagePopupLedState === 'on') ? 'OnColor' : 'OffColor';
			return `
				<div class="button-sim-led button-sim-led-wall" title="${side} wall LED (${buttonPagePopupLedState})" onclick="event.stopPropagation(); focusButtonControlFromPopup('${side}', ${buttonPagePopupCurrentPage}, 'WallLED${ledColorSuffix}');" style="background-color:${wallColor}; border-color:${wallColor};"></div>
				<div class="button-sim-led button-sim-led-front" title="${side} front LED (${buttonPagePopupLedState})" onclick="event.stopPropagation(); focusButtonControlFromPopup('${side}', ${buttonPagePopupCurrentPage}, 'FrontLED${ledColorSuffix}');" style="border-color:${frontColor}; box-shadow: 0 0 6px ${frontColor};"></div>`;
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

		function getLiveButtonPanelFieldValue(pageConfig, side, fieldSuffix, fallback = '')
		{
			const fieldId = `${side}${buttonPagePopupCurrentPage}${fieldSuffix}`;
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

		function getButtonPanelPreviewMarkup(pageConfig, side)
		{
			const topText = escapeHtml(getLiveButtonPanelFieldValue(pageConfig, side, 'TopText', Homey.__(`settings.${side}Panel`)));
			const onText = escapeHtml(getLiveButtonPanelFieldValue(pageConfig, side, 'OnText', Homey.__('settings.labelOn')));
			const offText = escapeHtml(getLiveButtonPanelFieldValue(pageConfig, side, 'OffText', Homey.__('settings.labelOff')));
			const stateText = (buttonPagePopupLedState === 'on') ? onText : offText;
			const textFieldSuffix = (buttonPagePopupLedState === 'on') ? 'OnText' : 'OffText';
			const svgFieldSuffix = (buttonPagePopupLedState === 'on') ? 'OnSVG' : 'OffSVG';
			const selectedSvgText = getLiveButtonPanelFieldValue(pageConfig, side, svgFieldSuffix, '');
			const svgMarkup = getButtonPanelPreviewSvg(selectedSvgText || '');
			const ledMarkup = `<div class="button-sim-leds ${side === 'right' ? 'button-sim-leds-right' : ''}">${getButtonPanelLedMarkup(pageConfig, side)}</div>`;
			const contentMarkup = svgMarkup
				? `
					<div class="button-sim-content button-sim-content-svg">
						<div class="button-sim-top" onclick="event.stopPropagation(); focusButtonControlFromPopup('${side}', ${buttonPagePopupCurrentPage}, 'TopText');">${topText}</div>
						<div class="button-sim-icon" onclick="event.stopPropagation(); focusButtonControlFromPopup('${side}', ${buttonPagePopupCurrentPage}, '${svgFieldSuffix}');">${svgMarkup}</div>
					</div>`
				: `
					<div class="button-sim-content">
						<div class="button-sim-top" onclick="event.stopPropagation(); focusButtonControlFromPopup('${side}', ${buttonPagePopupCurrentPage}, 'TopText');">${topText}</div>
						<div class="button-sim-state-block">
							<div class="button-sim-state-line" onclick="event.stopPropagation(); focusButtonControlFromPopup('${side}', ${buttonPagePopupCurrentPage}, '${textFieldSuffix}');">${stateText}</div>
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
				buttonPagePopupStateToggleElement.textContent = `${buttonPagePopupLedState === 'on' ? 'On' : 'Off'}`;
			}

			if (buttonPagePopupTitleElement)
			{
				buttonPagePopupTitleElement.textContent = `Page ${buttonPagePopupCurrentPage}`;
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

		function openButtonPagePopup(page)
		{
			if (!buttonPagePopupOverlayElement || !buttonPagePopupContentElement)
			{
				return;
			}

			const config = localButtonConfigurations[currentButtonConfigurationNo];
			if (!Array.isArray(config) || config.length === 0)
			{
				return;
			}

			buttonPagePopupCurrentPage = Math.max(0, Math.min(page, config.length - 1));
			buttonPagePopupOverlayElement.classList.add('visible');
			buttonPagePopupOverlayElement.setAttribute('aria-hidden', 'false');
			renderButtonPagePopup();
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
			focusButtonControlFromPopup(side, page, 'TopText');
		}

		function focusButtonControlFromPopup(side, page, fieldSuffix)
		{
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
				}
			};
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
				Element.add(option);

				var option = document.createElement("option");
				option.text = Homey.__("settings.variable");
				option.value = "_variable_";
				Element.add(option);

				var option = document.createElement("option");
				option.text = Homey.__("settings.customMQTT");
				option.value = "customMQTT";
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
					option.text += ` (${zoneName})`;
					option.value = device.id;
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
			}

			// let ButtonPanelConfiguration = localButtonConfigurations[currentButtonConfigurationNo];
			configNameElement.value = config[0].name ? config[0].name : "";

			for (let page = 0; page < config.length; page++)
			{
				document.getElementById(`${page}PageNum`).value = page === 0 ? 'Default' : config[page].PageNum;

				updateButtonPanelControlsSection("left", page, config[page]);
				updateButtonPanelControlsSection("right", page, config[page]);
			}

			fillButtonDevices();
			setupButtonBrokerItems();
			setupSvgPreviews(document);
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
					sentLogElement.style.width = (lastSentIpElement.offsetWidth) + 'px';
					sentLogElement.style.height = (window.innerHeight - sentLogElement.offsetTop - 35) + 'px';
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
					htmlText += `<div class="horizontalcontainer"><div class="horizontalgroup"><h2>${Homey.__("settings.page")} ${item.page === 0 ? 'All' : item.page} <div class="tooltip"><i class="fi fi-rr-info"></i><span class="tooltiptext">${Homey.__("settings.pageExplanation")}</span></div></h2>`;
				}

				htmlText += insertDisplayItemSection(item, itemNo, (item.itemId === expandItemId));
			}
			htmlText += `</div></div>`;
			document.getElementById('displayItemsSection').innerHTML = htmlText;

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
			const itemLegendName = item.label ? item.label : (item.device === 'none' ? item.text : item.capabilityName);
			const underlined = Homey.__("settings.boxTypeUnderlined");
			const notUnderlined = Homey.__("settings.boxTypeNotUnderlined");

			if (typeof item.page === 'undefined')
			{
				item.page = 1;
			}

			section = section +
				`<div class="horizontalcontainer">
					<div class="horizontalgroup" id="displayItem${item.itemId}Section">
						<label class="homey-form-label" for="display${itemNo}page">${ctrlLabels.page}
							<div class="tooltip"><i class="fi fi-rr-info"></i>
								<span class="tooltiptext">${ctrlExplanations.page}</span>
							</div>
						</label>
						<input class="homey-form-input" id="display${itemNo}page" onChange="redisplayDisplyConfig(${itemNo})" type="number" value="${item.page}" />
						<details ${expanded ? 'open' : ''}>
							<summary class="summary">
								<legend class="homey-subtitle" id="display${itemNo}Legend"><b><em>${itemLegend}</em></b> - ${itemLegendName}: X:${item.xPos}, Y:${item.yPos}, W:${item.width}</legend>
								<span class="icon" style='font-size:30px;'>&#8628;</span>
							</summary>
							<hr>
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
							<input class="homey-form-input" id="display${itemNo}Label" type="text" oninput="onDisplayLabelChange(this, ${itemNo})" value="${item.label}" />
							<div id="display${itemNo}UnitDiv">
								<label class="homey-form-label" for="display${itemNo}Unit">${ctrlLabels.unit}
									<div class="tooltip"><i class="fi fi-rr-info"></i>
										<span class="tooltiptext">${ctrlExplanations.unit}</span>
									</div>
								</label>
								<input class="homey-form-input" id="display${itemNo}Unit" type="text" value="${item.unit}" />
							</div>
							<div id="display${itemNo}TextDiv">
								<label class="homey-form-label" for="display${itemNo}Text">${ctrlLabels.text}
									<div class="tooltip"><i class="fi fi-rr-info"></i>
										<span class="tooltiptext">${ctrlExplanations.text}</span>
									</div>
								</label>
								<input class="homey-form-input" id="display${itemNo}Text" type="text" oninput="onDisplayLabelChange(this, ${itemNo})" value="${item.text}" />
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
								<option value=1>1</option>
								<option value=2>2</option>
								<option value=3>3</option>
								<option value=4>4</option>
								<option value=5>5</option>
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
			const top = Math.max(0, element.getBoundingClientRect().top + window.scrollY - fixedTopHeight - 8);
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

			document.getElementById(`display${itemNo}Legend`).innerHTML = `<b><em>${Homey.__("settings.displayItemlegend", { itemNo: itemNo + 1 })}</em></b> - ${newLabel}: X:${x}, Y:${y}, W:${width}`;
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
					displayConfiguration.items[itemNo].label = document.getElementById(`display${itemNo}Label`).value;
					displayConfiguration.items[itemNo].unit = document.getElementById(`display${itemNo}Unit`).value;
					displayConfiguration.items[itemNo].text = document.getElementById(`display${itemNo}Text`).value;
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

				if (defaultBroker === "")
				{
					defaultBrokerElement.value = 'homey';
				}
				else
				{
					defaultBrokerElement.value = defaultBroker;
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

			// Update the capabilities
			getCapabilities(side, page, deviceElement.value, config[`${side}Capability`], config[`${side}CapabilityName`]);
		}

		function deleteButtonPage(page)
		{
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
		}

		// Create the HTML for the button sections. Note this just creates the framework, the controls values are set using updateButtonPanelControls
		function writeButtonsections(numPages)
		{
			// Write the button sections
			const ctrlLabels = {
				page: Homey.__("settings.page"),
			}
			const ctrlExplanations = {
				page: Homey.__("settings.buttonPageExplanation"),
			}

			var html = "";
			for (page = 0; page < numPages; page++)
			{
				html += `<div class="horizontalcontainer">
					<div class="horizontalgroup" id="${page}ButtonPageSection">
                		<div class="horizontalcontainer">
							<div class="button-page-inner">
								<div class="button-page-header">
									<label class="homey-form-label" for="${page}PageNum"><span>${ctrlLabels.page}</span>
									<div class="tooltip"><i class="fi fi-rr-info"></i>
										<span class="tooltiptext">${ctrlExplanations.page}</span>
									</div>
									</label>
									<button class="homey-button-secondary-shadow button-page-sim-btn" onClick="openButtonPagePopup(${page}); return false;" title="Open page simulator"><i class="fi fi-rr-apps"></i></button>
								</div>
								<input class="homey-form-input" id="${page}PageNum" type=${page === 0 ? "text" : "number"} ${page === 0 ? "readonly" : ""} onchange="onButtonPageChange(this, '${page}')" />`

				html += getButtonHtml("left", page);
				html += getButtonHtml("right", page);

				if (page !== 0)
				{
					html += `<p><button class="homey-button-secondary-shadow" id="deletePage${page}" onClick="deleteButtonPage(${page})" style="font-size: 30px;"><i class="fi fi-rr-trash"></i> </button></p>`;
				}

				html += `</div>
					</div>
				</div>`;
			}
			document.getElementById('buttonItemsSection').innerHTML = html;
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
				longRepeat: Homey.__("settings.longRepeat"),
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

			const html = `<div class="horizontalcontainer">
                <div class="horizontal
                <div class="horizontalcontainer">
                    <div class="horizontalgroup">
						<details id="${side}${page}Details" ontoggle="this.open && scrollToTop(this)">
                            <summary class="summary">
                                <legend class="homey-subtitle" id="button${side}${page}Legend"><b><em>><span>${ctrlLabels.panel}</span></em></b></legend><span class="icon" style='font-size:30px;'>&#8628;</span>
                            </summary >
                            <hr>
								<div id="${side}${page}PanelSection">

                                <label class="homey-form-label" for="${side}${page}Device"><span>${ctrlLabels.device}</span>
                                    <div class="tooltip"><i class="fi fi-rr-info"></i>
                                        <span class="tooltiptext">${ctrlExplanations.device}</span>
                                    </div>
                                </label>
                                <select class="homey-form-select" id="${side}${page}Device" onChange="buttonDeviceChanged('${side}', ${page})"">
                                    <option value selected disabled hidden${ctrlLabels.device}"></option>
                                </select>

                                <span>
                                    <div id="${side}${page}CapabilityDiv">
                                        <label class="homey-form-label" id="${side}${page}CapabilityLabel" for="${side}${page}Capability"><span>${ctrlLabels.capability}</span>
                                            <div class="tooltip"><i class="fi fi-rr-info"></i>
                                                <span class="tooltiptext">${ctrlExplanations.capability}</span>
                                            </div>
                                        </label>
                                        <select class="homey-form-select" id="${side}${page}Capability">
                                            <option value selected disabled hidden>${ctrlLabels.Capability}</option>
                                        </select>
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

                                <label class="homey-form-checkbox">
                                    <input class="homey-form-checkbox-input" id="${side}${page}DisableLongRepeat" type="checkbox" value="auto" />
                                    <span class="homey-form-checkbox-checkmark"></span>
                                    <span class="homey-form-checkbox-text"><span>${ctrlLabels.longRepeat}</span></span>
                                    <div class="tooltip"><i class="fi fi-rr-info"></i>
                                        <span class="tooltiptext">${ctrlExplanations.longRepeat}</span>
                                    </div>
                                </label>

                                <span>
                                    <div id="${side}${page}BrokerIdDiv">
                                        <label class="homey-form-label" for="${side}${page}BrokerId"><span>${ctrlLabels.brokerId}</span>
                                            <div class="tooltip"><i class="fi fi-rr-info"></i>
                                                <span class="tooltiptext">${ctrlExplanations.brokerId}</span>
                                            </div>
                                        </label>
                                        <select class="homey-form-select" id="${side}${page}BrokerId">
                                        </select>
                                    </div>
                                </span>

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
                    </div >
                </div >
            </div >`;
			return html;
		}

