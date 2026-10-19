# OpenWrt Proxy Box — x86_64 MVP

独立开源的 LuCI 插件起步项目，目标为 ImmortalWrt/OpenWrt 24.10 x86_64 测试环境。本版本只验证 IPK 构建、安装、管理页和服务生命周期；暂不包含代理内核、订阅解析、透明代理规则、DNS 劫持或防火墙修改。

## 构建
1. 在 GitHub 仓库 Actions 中运行 `Build IPK (ImmortalWrt 24.10 x86_64)`。
2. 下载 `luci-app-proxy-box-ipk` artifact。

工作流使用 ImmortalWrt 24.10.5 x86/64 SDK。若官方 SDK URL 失效，请改成官方对应版本的 x86/64 SDK。

## 测试机安装
```sh
opkg install ./luci-app-proxy-box_*.ipk
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```
然后进入 LuCI → Services → Proxy Box。

## 安全边界
- 默认关闭服务。
- 不卸载或修改 OpenClash。
- 不修改防火墙/DNS。
- 不执行远程脚本。
- 不是完整代理客户端，后续再加订阅、节点、分流与核心管理。

检查测试设备：
```sh
cat /etc/openwrt_release
uname -m
opkg print-architecture
df -h
free -h 2>/dev/null || cat /proc/meminfo | grep -E 'MemTotal|MemAvailable'
```

原创部分采用 MIT License；后续引入的第三方组件必须保留各自许可。
