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

		s = m.section(form.TypedSection, 'proxy_box', _('④ 目标分流（测试版）'));
		s.anonymous = true;
		s.addremove = false;
		s.description = _('使用 MetaCubeX/meta-rules-dat 公开 sing-box 规则集。每类规则可绑定直连、自动优选、手动选择、丢弃或自定义策略组。规则集由 sing-box 运行时下载；首次启动需要网络。');

		var policies = [
			['direct', _('直连（DIRECT）')],
			['auto', _('自动优选（AUTO）')],
			['select', _('手动选择（SELECT）')],
			['reject', _('丢弃（REJECT）')],
			['AI', _('AI 策略组')],
			['TikTok', _('TikTok 策略组')],
			['YouTube', _('YouTube 策略组')],
			['Netflix', _('Netflix 策略组')],
			['Games', _('Games 策略组')]
		];
		function addRouteOption(key, label, def, help) {
			var opt = s.option(form.ListValue, key, label);
			policies.forEach(function(p) { opt.value(p[0], p[1]); });
			opt.default = def;
			opt.rmempty = false;
			if (help) opt.description = help;
			return opt;
		}
		addRouteOption('route_youtube', _('YouTube'), 'auto', 'geosite-youtube');
		addRouteOption('route_tiktok', _('TikTok'), 'TikTok', 'geosite-tiktok、geosite-tiktok@!cn');
		addRouteOption('route_netflix', _('Netflix'), 'Netflix', 'geosite-netflix、geoip-netflix');
		addRouteOption('route_github', _('GitHub'), 'auto', 'geosite-github');
		addRouteOption('route_google', _('Google'), 'auto', 'geosite-google');
		addRouteOption('route_microsoft', _('Microsoft'), 'direct', 'geosite-microsoft');
		addRouteOption('route_apple', _('Apple'), 'direct', 'geosite-apple');
		addRouteOption('route_games', _('Games'), 'Games', 'geosite-steam、geosite-sony');
		addRouteOption('route_foreign', _('国外'), 'auto', 'geosite-gfw + 常见国外 IP 规则集');
		addRouteOption('route_domestic', _('国内'), 'direct', 'geosite-cn、geoip-cn、geoip-private');
		addRouteOption('route_other', _('其他 / 未命中兜底'), 'direct', '未命中已配置规则的流量走这里。');

		s = m.section(form.TypedSection, 'proxy_box', _('⑤ 自定义策略组默认节点'));
		s.anonymous = true;
		s.addremove = false;
		s.description = _('这些策略组会包含当前已导入的节点。选择默认节点后点击“保存并应用”；这是生成配置时的默认值，不是实时测速切换。');
		var groups = [
			['ai_node', _('AI 策略组默认节点')],
			['tiktok_node', _('TikTok 策略组默认节点')],
			['youtube_node', _('YouTube 策略组默认节点')],
			['netflix_node', _('Netflix 策略组默认节点')],
			['games_node', _('Games 策略组默认节点')]
		];
		groups.forEach(function(g) {
			var opt = s.option(form.ListValue, g[0], g[1]);
			nodes.forEach(function(n) {
				if (n && n.tag) opt.value(n.tag, (n.name || n.tag) + ' (' + n.tag + ')');
			});
			opt.rmempty = true;
			if (nodes.length) opt.default = nodes[0].tag;
			else opt.description = _('导入节点后刷新页面即可选择。');
		});

		return m.render();
	}
});
