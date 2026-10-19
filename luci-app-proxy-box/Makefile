include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI app for Proxy Box
LUCI_DEPENDS:=+luci-base +rpcd
LUCI_PKGARCH:=all
PKG_NAME:=luci-app-proxy-box
PKG_VERSION:=0.2.1
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=OpenWrt Proxy Box contributors

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-proxy-box
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=$(LUCI_TITLE)
  DEPENDS:=$(LUCI_DEPENDS)
  PKGARCH:=all
endef

define Package/luci-app-proxy-box/description
An experimental LuCI node manager for sing-box on OpenWrt.
No firewall or OpenClash configuration is changed.
endef

define Build/Compile
endef

define Package/luci-app-proxy-box/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./root/etc/config/proxy_box $(1)/etc/config/proxy_box
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./root/etc/init.d/proxy_box $(1)/etc/init.d/proxy_box
	$(INSTALL_DIR) $(1)/usr/libexec/proxy-box
	$(INSTALL_BIN) ./root/usr/libexec/proxy-box/generate.lua $(1)/usr/libexec/proxy-box/generate.lua
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-proxy-box.json $(1)/usr/share/luci/menu.d/luci-app-proxy-box.json
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-proxy-box.json $(1)/usr/share/rpcd/acl.d/luci-app-proxy-box.json
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/proxy-box
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/proxy-box/main.js $(1)/www/luci-static/resources/view/proxy-box/main.js
endef

define Package/luci-app-proxy-box/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/etc/init.d/proxy_box enable
	/etc/init.d/proxy_box start
}
exit 0
endef

$(eval $(call BuildPackage,luci-app-proxy-box))
