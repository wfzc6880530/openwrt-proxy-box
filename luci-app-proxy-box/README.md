# luci-app-proxy-box

Experimental LuCI node-management MVP for ImmortalWrt/OpenWrt 24.10 x86_64.

## MVP features
- Paste share links or a Base64-encoded subscription body.
- Parses common sing-box share formats: VLESS, VMess, Trojan, Shadowsocks, Hysteria2, TUIC, SOCKS5 and HTTP(S).
- Generates a sing-box config, an automatic URL-test group, and a manual selector group.
- Optional sing-box service controlled by procd; disabled by default.
- Local mixed inbound listens on `127.0.0.1:17890` by default to avoid colliding with OpenClash ports.
- Does not change OpenClash, firewall, DNS, or LAN transparent-proxy settings.

## Install and use
Install the built IPK on ImmortalWrt 24.10 x86_64, then open LuCI → Services → Proxy Box.
Paste one share URI per line, or a Base64-encoded subscription body, then click Save & Apply. The generator writes the configured sing-box JSON path and `/etc/proxy-box/nodes.json`.

To actually start the proxy service, install a compatible sing-box binary, review the generated config and local port, then enable the service. This package does not bundle the sing-box core.

## Limitations
- Subscription URLs are not fetched in this MVP; paste the subscription content.
- Parsing covers common fields and common WS/gRPC/TLS/Reality parameters; uncommon vendor-specific extensions may not work.
- The proxy service is local-only. No LAN transparent proxy, firewall integration, DNS interception, or domestic/foreign split rules are enabled yet.
- Always inspect imported node data and generated config before enabling the service.
