# luci-app-proxy-box

Experimental LuCI package skeleton for OpenWrt / ImmortalWrt 24.10 x86_64 testing.

## Included
- LuCI settings page
- UCI defaults
- procd service wrapper
- GitHub Actions IPK build

## Not included
- sing-box binary
- subscription parsing
- node management or health checks
- transparent proxy/firewall rules
- DNS interception or leak prevention
- domestic/foreign split routing

The service is disabled by default. Do not enable it until the core and configuration exist.
