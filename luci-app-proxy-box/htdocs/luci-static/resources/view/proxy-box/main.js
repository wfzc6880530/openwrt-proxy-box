'use strict';
'require view';
'require form';
'require uci';
'require fs';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('proxy_box'),
			fs.read('/etc/proxy-box/nodes.json').catch(function() { return '[]'; })
		]);
	},

	render: function(data) {
		var m, s, o, nodes = [];
		try {
			nodes = JSON.parse(data[1] || '[]');
			if (!Array.isArray(nodes)) nodes = [];
		} catch (e) {
			nodes = [];
		}

		m = new form.Map('proxy_box', _('Proxy Box'),
			_('Experimental sing-box node manager. It does not configure transparent proxying, DNS interception, or firewall rules.'));

		s = m.section(form.TypedSection, 'proxy_box', _('Basic settings'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enable sing-box service'));
		o.rmempty = false;
		o.default = '0';
		o.description = _('Disabled by default. The generated inbound listens on 127.0.0.1 only; this keeps it separate from OpenClash.');

		o = s.option(form.ListValue, 'mode', _('Routing mode'));
		o.value('rule', _('Rule mode (MVP default)'));
		o.value('global', _('Global proxy'));
		o.value('direct', _('Direct'));
		o.default = 'rule';
		o.description = _('The MVP routes local mixed-inbound traffic through the sing-box proxy group. LAN transparent proxy is not enabled.');

		o = s.option(form.Value, 'core_path', _('sing-box executable path'));
		o.default = '/usr/bin/sing-box';
		o.rmempty = false;

		o = s.option(form.Value, 'config_path', _('sing-box config path'));
		o.default = '/etc/proxy-box/config.json';
		o.rmempty = false;

		o = s.option(form.Value, 'mixed_port', _('Local mixed proxy port'));
		o.datatype = 'port';
		o.default = '17890';
		o.rmempty = false;
		o.description = _('Binds to 127.0.0.1 only; does not open a LAN port or alter firewall rules.');

		o = s.option(form.Value, 'test_url', _('URL-test target'));
		o.default = 'https://www.gstatic.com/generate_204';
		o.rmempty = false;

		o = s.option(form.TextValue, 'share_links', _('Node links / pasted subscription'));
		o.rows = 12;
		o.wrap = 'off';
		o.rmempty = true;
		o.description = _('Paste one share URI per line or a Base64-encoded subscription body. Supported: VLESS, VMess, Trojan, Shadowsocks, Hysteria2, TUIC, SOCKS5 and HTTP(S). Save & Apply regenerates config. Subscription URLs are not fetched in this MVP.');

		s = m.section(form.TypedSection, '_nodes', _('Imported nodes'));
		s.anonymous = true;
		s.render = function() {
			var children = [];
			children.push(E('p', {}, _('Imported node count: ') + nodes.length));
			if (!nodes.length) {
				children.push(E('p', { 'class': 'alert-message' }, _('No parsed nodes yet. Paste share links above and use Save & Apply.')));
			} else {
				var table = E('table', { 'class': 'table' });
				table.appendChild(E('tr', {}, [
					E('th', {}, _('Name')), E('th', {}, _('Protocol')),
					E('th', {}, _('Server')), E('th', {}, _('Port'))
				]));
				nodes.forEach(function(n) {
					table.appendChild(E('tr', {}, [
						E('td', {}, n.name || n.tag || '-'),
						E('td', {}, n.type || '-'),
						E('td', {}, n.server || '-'),
						E('td', {}, String(n.server_port || '-'))
					]));
				});
				children.push(table);
			}
			children.push(E('p', {}, _('Generated config: /etc/proxy-box/config.json unless a custom path is configured.')));
			children.push(E('p', {}, _('This MVP does not modify OpenClash, firewall rules, DNS settings, or LAN routing.')));
			return E('div', { 'class': 'cbi-section' }, children);
		};

		return m.render();
	}
});
