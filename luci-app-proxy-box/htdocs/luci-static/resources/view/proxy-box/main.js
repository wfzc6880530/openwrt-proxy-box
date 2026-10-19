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
		} catch (e) { nodes = []; }

		m = new form.Map('proxy_box', _('Proxy Box'),
			_('独立 sing-box 节点管理。不会修改 OpenClash、DNS、防火墙或 LAN 透明代理。'));

		s = m.section(form.TypedSection, 'proxy_box', _('运行设置'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('启用 sing-box 服务'));
		o.rmempty = false;
		o.default = '0';
		o.description = _('默认关闭。启用前请确认已安装 sing-box，并检查生成的配置。');

		o = s.option(form.Value, 'core_path', _('sing-box 程序路径'));
		o.default = '/usr/bin/sing-box';
		o.rmempty = false;

		o = s.option(form.Value, 'config_path', _('配置文件路径'));
		o.default = '/etc/proxy-box/config.json';
		o.rmempty = false;

		o = s.option(form.Value, 'mixed_port', _('本地代理端口'));
		o.datatype = 'port';
		o.default = '17890';
		o.rmempty = false;
		o.description = _('仅监听 127.0.0.1，不占用 OpenClash 常用端口。');

		o = s.option(form.Value, 'test_url', _('自动测速网址'));
		o.default = 'https://www.gstatic.com/generate_204';
		o.rmempty = false;

		s = m.section(form.TypedSection, 'proxy_box', _('① 导入订阅'));
		s.anonymous = true;
		s.addremove = false;
		o = s.option(form.Value, 'subscription_url', _('订阅地址 URL'));
		o.placeholder = 'https://example.com/subscribe?...';
		o.rmempty = true;
		o.description = _('填写 http:// 或 https:// 订阅链接，保存应用时由路由器尝试下载。需要路由器能够访问订阅服务器。');

		s = m.section(form.TypedSection, 'proxy_box', _('② 添加节点 / 粘贴分享链接'));
		s.anonymous = true;
		s.addremove = false;
		o = s.option(form.TextValue, 'manual_links', _('手动添加节点链接'));
		o.rows = 6;
		o.wrap = 'off';
		o.rmempty = true;
		o.description = _('每行一条节点分享链接，可粘贴多条：vless://、vmess://、trojan://、ss://、hysteria2://、tuic://、socks://、http://。');

		o = s.option(form.TextValue, 'share_links', _('额外订阅正文 / Base64'));
		o.rows = 8;
		o.wrap = 'off';
		o.rmempty = true;
		o.description = _('如果订阅地址无法使用，也可以将订阅返回的原始正文或 Base64 内容粘贴在这里。');

		s = m.section(form.TypedSection, '_nodes', _('③ 已导入节点'));
		s.anonymous = true;
		s.render = function() {
			var children = [];
			children.push(E('p', {}, _('当前节点数量：') + nodes.length));
			if (!nodes.length) {
				children.push(E('p', { 'class': 'alert-message' }, _('尚无已解析节点。填写订阅地址或粘贴节点链接，然后点击页面底部“保存并应用”。')));
			} else {
				var table = E('table', { 'class': 'table' });
				table.appendChild(E('tr', {}, [
					E('th', {}, _('名称')), E('th', {}, _('协议')),
					E('th', {}, _('服务器')), E('th', {}, _('端口'))
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
			children.push(E('p', {}, _('配置文件：/etc/proxy-box/config.json（除非设置了自定义路径）。')));
			return E('div', { 'class': 'cbi-section' }, children);
		};
		return m.render();
	}
});
