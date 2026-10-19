# OpenWrt Proxy Box — x86_64 MVP

An independent LuCI plugin project for ImmortalWrt/OpenWrt 24.10 x86_64 testing.

## Current MVP
- LuCI settings and node import page.
- Paste common sing-box share URIs or a Base64-encoded subscription body.
- Parses VLESS, VMess, Trojan, Shadowsocks, Hysteria2, TUIC, SOCKS5 and HTTP(S) links.
- Generates sing-box config with URL-test and selector groups.
- sing-box service is disabled by default and its inbound listens on 127.0.0.1 only.
- No OpenClash, firewall, DNS, or LAN transparent-proxy changes.

## Build
GitHub Actions → `Build IPK (ImmortalWrt 24.10 x86_64)` → download `luci-app-proxy-box-ipk` artifact.

## Install
```sh
opkg install ./luci-app-proxy-box_0.2.1-1_all.ipk
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```
Open LuCI → Services → Proxy Box. Paste node share links, then click Save & Apply.

The package does not include the sing-box binary. Install a compatible core separately and review the generated config before enabling the service.

## Build target
ImmortalWrt 24.10.5 x86/64 SDK. A successful package build does not guarantee every share-link extension works; test with your actual nodes.
