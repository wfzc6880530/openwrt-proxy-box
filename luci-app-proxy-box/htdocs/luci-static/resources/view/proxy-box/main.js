'use strict';
'require view';
'require form';
'require uci';
'require fs';
'require rpc';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('proxy_box'),
			fs.exec('/bin/ubus', ['call', 'system', 'board'])
		]);
	},

	render: function(data) {
		var m, s, o;

		m = new form.Map('proxy_box', _('Proxy Box'), _('Experimental management skeleton. It does not configure transparent proxying, DNS interception, or firewall rules.'));

		s = m.section(form.TypedSection, 'proxy_box', _('Basic settings'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enable service'));
		o.rmempty = false;
		o.default = '0';
		o.description = _('Disabled by default. Enable only after installing sing-box and providing a valid configuration.');

		o = s.option(form.ListValue, 'mode', _('Routing mode'));
		o.value('rule', _('Rule mode (reserved)'));
		o.value('global', _('Global proxy (reserved)'));
		o.value('direct', _('Direct (reserved)'));
		o.default = 'rule';
		o.description = _('UI placeholder only in this MVP; no routing rules are generated.');

		o = s.option(form.Value, 'core_path', _('sing-box executable path'));
		o.default = '/usr/bin/sing-box';
		o.rmempty = false;

		o = s.option(form.Value, 'config_path', _('sing-box config path'));
		o.default = '/etc/proxy-box/config.json';
		o.rmempty = false;

		s = m.section(form.TypedSection, '_status', _('Runtime notes'));
		s.anonymous = true;
		s.render = function() {
			return E('div', { 'class': 'cbi-section' }, [
				E('p', {}, _('This release is only a UI and procd service skeleton.')),
				E('p', {}, _('It does not include sing-box, subscription import, node selection, rule sets, firewall integration, or DNS split-horizon.')),
				E('p', {}, _('It will not alter OpenClash settings or firewall rules.'))
			]);
		};

		return m.render();
	}
});
