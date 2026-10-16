'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const methodsStart = source.indexOf('\n\ttriggerPageChange(');
const methodsEnd = source.lastIndexOf('\n\t/**', source.indexOf('\n\tasync triggerFlow(', methodsStart));
const app = vm.runInNewContext(`new (class { ${source.slice(methodsStart, methodsEnd)} })()`);
const cards = new Map();
const calls = [];
const pending = [];
const deviceOnlyCards = new Set([
	'set_config_name_led_rgb',
	'set_connector_button_top_label',
	'set_connector_led_rgb',
	'set_display_page',
	'set_info',
	'switch_button_configuration_name',
	'switch_display_configuration_name',
]);
const plain = value => JSON.parse(JSON.stringify(value));

function getCard(type, id)
{
	if (id.endsWith('_app') && !fs.existsSync(path.join(root, '.homeycompose', 'flow', type, `${id}.json`)))
	{
		throw new Error(`Invalid Flow Card ID: ${id}`);
	}
	const key = `${type}:${id}`;
	if (!cards.has(key))
	{
		cards.set(key, {
			id,
			autocomplete: {},
			registerRunListener(listener) { this.run = listener; return this; },
			registerArgumentAutocompleteListener(name, listener) { this.autocomplete[name] = listener; return this; },
			async trigger(...args) { this.fired = args; },
		});
	}
	return cards.get(key);
}

function createPanel(id, activeConfig)
{
	return new Proxy({
		getData: () => ({ id }),
		getName: () => `Panel ${id}`,
		getSetting: name => name === 'connect0Type' ? 1 : 0,
		getEffectiveConfigNo: (_type, connector) => connector === 0 ? activeConfig : null,
		getConfigPageSide: () => ({ capabilityName: 'onoff' }),
		getConfigLedButtonState: (_config, fallback) => fallback,
		page: 1,
		getCapabilityValue: name => name.includes('configuration') ? activeConfig : activeConfig === 0,
	}, {
		get(target, property)
		{
			return target[property] || ((...args) =>
			{
				calls.push({ id, method: property, args: plain(args) });
				return 'done';
			});
		},
	});
}

const panels = [createPanel('a', 0), createPanel('b', 1)];
app.homey = {
	flow: {
		getActionCard: id => getCard('actions', id),
		getConditionCard: id => getCard('conditions', id),
		getDeviceTriggerCard: id => getCard('deviceTriggers', id),
		getTriggerCard: id => getCard('triggers', id),
	},
	drivers: { getDriver: () => ({ getDevices: () => panels }) },
	__: key => key,
};
app.buttonConfigurations = [[{ name: 'Kitchen' }, {}], { name: 'Legacy' }, [], null];
app.displayConfigurations = [[{ name: 'Hall' }, {}], { name: 'Legacy display' }];
app.log = () => {};
app.updateLog = message => { throw new Error(message); };
app.triggerFlow = (trigger, device, tokens, state) => pending.push(trigger.trigger(device, tokens, state));
const registrationStart = source.indexOf('\t\tthis._triggerButtonOn =');
const registrationEnd = source.indexOf("\n\t\tthis.homey.on('memwarn'", registrationStart);
vm.runInNewContext(`(function() { ${source.slice(registrationStart, registrationEnd)} }).call(app)`, { app });

async function run()
{
	let count = 0;
	for (const type of ['triggers', 'conditions', 'actions'])
	{
		const directory = path.join(root, '.homeycompose', 'flow', type);
		for (const filename of fs.readdirSync(directory).filter(name => name.endsWith('.json') && !name.endsWith('_app.json')))
		{
			const original = JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8'));
			const id = filename.replace(/\.json$/, '');
			const appPath = path.join(directory, `${id}_app.json`);
			if (original.deprecated)
			{
				assert.strictEqual(fs.existsSync(appPath), false, `Deprecated card ${id}`);
				continue;
			}
			if (!fs.existsSync(appPath))
			{
				assert.ok(deviceOnlyCards.has(id), `Unexpected device-only card ${id}`);
				assert.strictEqual(typeof getCard(type, id).run, 'function', `${id} device run listener`);
				continue;
			}
			assert.ok(!deviceOnlyCards.has(id), `Unexpected app-level card ${id}`);
			const added = JSON.parse(fs.readFileSync(appPath, 'utf8'));
			assert.strictEqual(added.args.find(arg => arg.name === 'device').type, 'autocomplete');
			assert.deepStrictEqual(added.args.filter(arg => arg.name !== 'device'), original.args.filter(arg => arg.name !== 'device'));
			assert.deepStrictEqual(added.tokens, original.tokens);
			const card = getCard(type, `${id}_app`);
			assert.strictEqual(typeof card.run, 'function', `${id} run listener`);
			for (const argument of added.args.filter(arg => arg.type === 'autocomplete'))
			{
				assert.strictEqual(typeof card.autocomplete[argument.name], 'function', `${id}/${argument.name}`);
			}
				assert.strictEqual((await card.autocomplete.device('anyconnector'))[0].id, '*');
			assert.strictEqual((await card.autocomplete.device('PANEL B'))[0].id, 'b');
			if (card.autocomplete.config)
			{
				const display = id.includes('display');
				const args = { device: { id: 'a' }, display_button: display ? 'display' : 'button' };
				assert.strictEqual((await card.autocomplete.config(display ? 'HALL' : 'KITCHEN', args))[0].id, 0);
				assert.strictEqual((await card.autocomplete.config('legacy', args))[0].id, 1);
				await card.autocomplete.config('', args);
			}
			for (const locale of Object.keys(original.title))
			{
				assert.ok(added.titleFormatted[locale].includes('[[device]]'), `${id}/${locale}`);
			}
			assert.ok(!fs.readFileSync(appPath, 'utf8').replace(/\r\n/g, '').includes('\n'), `${id} CRLF`);
			count++;
		}
	}

	const args = { left_right: 'left', connector: 2, config: { id: 0 }, page: 1, label: 'Label', svg: '<svg/>', rgb: '#123456', front_wall: 'both', update_configuration: true, on_off: true, pageCommand: 'set', index: 2, info: 'Info' };
	for (const [key, card] of cards)
	{
		if (!key.startsWith('actions:') || !card.id.endsWith('_app'))
		{
			continue;
		}
		const original = getCard('actions', card.id.slice(0, -4));
		assert.strictEqual(await original.run({ ...args, device: panels[0] }, {}), 'done');
		const expected = calls.pop();
		assert.strictEqual(await card.run({ ...args, device: { id: 'b' } }, {}), 'done');
		assert.deepStrictEqual(calls.pop(), { ...expected, id: 'b' }, card.id);
		await assert.rejects(card.run({ ...args, device: { id: 'deleted' } }, {}), /no longer available/);
			assert.strictEqual(await card.run({ ...args, device: { id: '*' } }, {}), 'done');
			assert.deepStrictEqual(calls.splice(-2).map(call => call.id).sort(), ['a', 'b'], card.id);
	}
	for (const id of ['is_button_on', 'is_button_config_on', 'is_button_config_name', 'is_display_config_name'])
	{
		const card = getCard('conditions', `${id}_app`);
		assert.strictEqual(await card.run({ ...args, device: { id: 'a' } }, {}), true, id);
		assert.strictEqual(await card.run({ ...args, device: { id: 'b' } }, {}), false, id);
		assert.strictEqual(await card.run({ ...args, device: { id: '*' } }, {}), true, id);
		await assert.rejects(card.run({ ...args, device: { id: 'deleted' } }, {}), /no longer available/);
	}
	const buttonConfigCondition = getCard('conditions', 'is_button_config_on');
	const dimPanel = {
		page: 1,
		getSetting: name => name === 'connect0Type' ? 1 : 0,
		getEffectiveConfigNo: (_type, connector) => connector === 0 ? 3 : null,
		getConfigPageSide: () => ({ capabilityName: 'dim' }),
		getConfigLedButtonState: (config, fallback) => config.capabilityName === 'dim' ? true : fallback,
		getCapabilityValue: () => false,
	};
	assert.strictEqual(await buttonConfigCondition.run({ ...args, device: dimPanel, left_right: 'right', config: { id: 3 } }, {}), true);
	assert.strictEqual(await getCard('conditions', 'is_button_config_name_app').autocomplete.device('anyconnector').then(options => options[0].id), '*');
	const appConfigCondition = getCard('conditions', 'is_button_config_name_app');
	const anyDeviceOptions = await appConfigCondition.autocomplete.device('Any');
	assert.strictEqual(anyDeviceOptions[0].id, '*');
	const anyDeviceArgs = { ...args, device: { id: '*' }, connector: 2, config: { id: 1 } };
	assert.strictEqual(await appConfigCondition.run(anyDeviceArgs, {}), true);
	assert.strictEqual(await appConfigCondition.run({ ...anyDeviceArgs, config: { id: 2 } }, {}), false);
	assert.strictEqual(await appConfigCondition.run({ ...anyDeviceArgs, device: { id: 'b' } }, {}), true);
	assert.strictEqual(await appConfigCondition.run({ ...anyDeviceArgs, device: { id: 'a' } }, {}), false);

	app.triggerPageChange(panels[0], 2);
	app.triggerButtonEvent(panels[0], 'left', 0, 'clicked', true, '0.5', 3);
	app.triggerConfigButton(panels[0], 'left', 1, '0', 'clicked', true, '0.5', 1, 3);
	await Promise.all(pending);
	for (const id of ['page_change', 'connector_button_event', 'config_name_button_change'])
	{
		const card = getCard('triggers', `${id}_app`);
		const original = getCard('deviceTriggers', id);
		assert.strictEqual(original.fired.length, 3);
		assert.strictEqual(card.fired.length, 2);
		assert.deepStrictEqual(plain(card.fired[0]), plain(original.fired[1]));
		const eventArgs = { device: { id: 'a' }, left_right: 'left', connector: { id: 0 }, config: { id: 0 }, display_button: 'button', page: { id: 1 }, state: 'clicked' };
		assert.strictEqual(await card.run(eventArgs, card.fired[1]), true, id);
		assert.strictEqual(await card.run({ ...eventArgs, device: { id: 'b' } }, card.fired[1]), false, id);
		assert.strictEqual(await card.run({ ...eventArgs, device: { id: '*' } }, card.fired[1]), true, id);
	}
	const connector = getCard('triggers', 'connector_button_event_app');
	assert.strictEqual((await connector.autocomplete.connector('', { device: { id: 'a' } })).length, 2);
	assert.strictEqual((await connector.autocomplete.connector('', {})).length, 1);
	assert.strictEqual(await connector.run({ device: { id: 'a' }, left_right: 'left', connector: { id: -1 }, state: 'clicked' }, connector.fired[1]), true);
	assert.strictEqual(await connector.run({ device: { id: 'a' }, left_right: 'left', connector: { id: 1 }, state: 'clicked' }, connector.fired[1]), false);
	const appConfigTrigger = getCard('triggers', 'config_name_button_change_app');
	assert.strictEqual(await appConfigTrigger.run({ device: { id: '*' }, left_right: 'left', connector: { id: 0 }, config: { id: 0 }, display_button: 'button', page: { id: 1 }, state: 'clicked' }, appConfigTrigger.fired[1]), true);
	console.log(`PASS: ${count} app cards, all action routes, condition results, trigger filtering/tokens, configuration names, autocomplete dependencies, translations, and deprecated exclusions`);
}

run().catch(error =>
{
	console.error(error);
	process.exitCode = 1;
});