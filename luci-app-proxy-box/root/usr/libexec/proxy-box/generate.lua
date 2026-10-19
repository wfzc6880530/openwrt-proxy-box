#!/usr/bin/lua
-- OpenWrt Proxy Box share-link importer and sing-box config generator.
-- Does not modify firewall, DNS, or OpenClash settings.

local uci = require("luci.model.uci").cursor()
local json = require("luci.jsonc")
local util = require("luci.util")
local fs = require("nixio.fs")

local function trim(s)
  return (tostring(s or ""):gsub("^%s+", ""):gsub("%s+$", ""))
end

local function decode(s)
  s = tostring(s or "")
  return (s:gsub("%%(%x%x)", function(h) return string.char(tonumber(h, 16)) end))
end

local function query_parse(q)
  local out = {}
  for pair in tostring(q or ""):gmatch("[^&]+") do
    local k, v = pair:match("^([^=]*)=(.*)$")
    if not k then k, v = pair, "" end
    out[decode(k:gsub("%+", " "))] = decode(v:gsub("%+", " "))
  end
  return out
end

local function b64decode(s)
  s = tostring(s or ""):gsub("%s+", ""):gsub("-", "+"):gsub("_", "/")
  local rem = #s % 4
  if rem > 0 then s = s .. string.rep("=", 4 - rem) end
  local ok, value = pcall(util.b64decode, s)
  if ok and value then return value end
  return nil
end

local function split_uri(line)
  local scheme, rest = line:match("^([%w+.-]+)://(.+)$")
  if not scheme then return nil end
  local fragment, q
  local hash = rest:find("#", 1, true)
  if hash then
    fragment = rest:sub(hash + 1)
    rest = rest:sub(1, hash - 1)
  end
  local qm = rest:find("?", 1, true)
  if qm then
    q = rest:sub(qm + 1)
    rest = rest:sub(1, qm - 1)
  end
  return scheme:lower(), rest, query_parse(q), decode(fragment or "")
end

local function host_port(s)
  s = tostring(s or "")
  local host, port = s:match("^%[([^%]]+)%]:(%d+)$")
  if not host then host, port = s:match("^([^:]+):(%d+)$") end
  port = tonumber(port)
  if not host or not port or port < 1 or port > 65535 then return nil end
  return host, port
end

local function user_host(rest)
  local user, authority = rest:match("^(.-)@(.+)$")
  if not authority then return nil end
  return decode(user), authority
end

local function make_tls(q, forced)
  local security = tostring(q.security or ""):lower()
  local enabled = forced or security == "tls" or security == "reality" or q.tls == "tls" or q.tls == "1"
  if not enabled then return nil end
  local tls = { enabled = true }
  local sni = q.sni or q.serverName or q.peer
  if sni and sni ~= "" then tls.server_name = sni end
  if q.allowInsecure == "1" or q.insecure == "1" or q.insecure == "true" then tls.insecure = true end
  local fp = q.fp or q.fingerprint
  if fp and fp ~= "" then tls.utls = { enabled = true, fingerprint = fp } end
  if security == "reality" or q.pbk or q.public_key then
    tls.reality = { enabled = true }
    if q.pbk or q.public_key then tls.reality.public_key = q.pbk or q.public_key end
    if q.sid or q.short_id then tls.reality.short_id = q.sid or q.short_id end
  end
  return tls
end

local function make_transport(q, network, host)
  network = tostring(network or q.type or q.net or ""):lower()
  if network == "ws" or network == "websocket" then
    local t = { type = "ws" }
    if q.path and q.path ~= "" then t.path = q.path end
    local h = q.host or host
    if h and h ~= "" then t.headers = { Host = h } end
    return t
  elseif network == "grpc" then
    local t = { type = "grpc" }
    local service = q.serviceName or q.service_name or q.path
    if service and service ~= "" then t.service_name = service end
    return t
  elseif network == "httpupgrade" then
    local t = { type = "httpupgrade" }
    if q.path and q.path ~= "" then t.path = q.path end
    local h = q.host or host
    if h and h ~= "" then t.host = h end
    return t
  end
  return nil
end

local function parse_link(line, index)
  line = trim(line)
  if line == "" or line:sub(1, 1) == "#" then return nil end
  local scheme, rest, q, name = split_uri(line)
  if not scheme then return nil end
  local node = { tag = "node-" .. index, name = name ~= "" and name or ("Node " .. index) }
  local user, authority, host, port

  if scheme == "vmess" then
    local raw = b64decode(rest)
    if not raw then return nil end
    local v = json.parse(raw)
    if type(v) ~= "table" or not v.add or not v.port or not v.id then return nil end
    node.type, node.server, node.server_port = "vmess", tostring(v.add), tonumber(v.port)
    node.uuid, node.alter_id = tostring(v.id), tonumber(v.aid or 0) or 0
    node.security = tostring(v.scy or v.security or "auto")
    if v.ps and v.ps ~= "" then node.name = tostring(v.ps) end
    local vmq = { sni = v.sni, host = v.host, path = v.path }
    if tostring(v.tls or ""):lower() == "tls" then node.tls = make_tls(vmq, true) end
    node.transport = make_transport(vmq, v.net, v.host)
    return node
  end

  if scheme == "ss" then
    local before, after = rest:match("^(.-)@(.+)$")
    if not after then
      local decoded = b64decode(rest)
      if decoded then before, after = decoded:match("^(.-)@(.+)$") end
    end
    if not before or not after then return nil end
    local method, password = before:match("^([^:]+):(.+)$")
    if not method then
      local decoded = b64decode(before)
      if decoded then method, password = decoded:match("^([^:]+):(.+)$") end
    end
    host, port = host_port(after)
    if not method or not password or not host or not port then return nil end
    node.type, node.server, node.server_port = "shadowsocks", host, port
    node.method, node.password = method, password
    return node
  end

  user, authority = user_host(rest)
  if not authority then host, port = host_port(rest) else host, port = host_port(authority) end
  if not host or not port then return nil end
  node.server, node.server_port = host, port

  if scheme == "vless" then
    node.type, node.uuid = "vless", user
    if q.flow and q.flow ~= "" then node.flow = q.flow end
    node.tls = make_tls(q)
    node.transport = make_transport(q, q.type, q.host)
  elseif scheme == "trojan" then
    node.type, node.password = "trojan", user
    node.tls = make_tls(q, true)
    node.transport = make_transport(q, q.type, q.host)
  elseif scheme == "hysteria2" or scheme == "hy2" then
    node.type, node.password = "hysteria2", user
    node.tls = make_tls(q, true) or { enabled = true }
    if q.obfs and q.obfs ~= "" then
      node.obfs = { type = q.obfs, password = q["obfs-password"] or q.obfsPassword or "" }
    end
    if q.upmbps then node.up_mbps = tonumber(q.upmbps) end
    if q.downmbps then node.down_mbps = tonumber(q.downmbps) end
  elseif scheme == "tuic" then
    local uuid, password = tostring(user or ""):match("^([^:]+):(.+)$")
    node.type, node.uuid, node.password = "tuic", uuid, password
    node.tls = make_tls(q, true) or { enabled = true }
    node.congestion_control = q.congestion_control or "bbr"
    node.udp_relay_mode = q.udp_relay_mode or "native"
  elseif scheme == "socks" or scheme == "socks5" then
    node.type, node.version = "socks", "5"
    if user then node.username, node.password = user:match("^([^:]+):(.+)$") end
  elseif scheme == "http" or scheme == "https" then
    node.type = "http"
    if user then node.username, node.password = user:match("^([^:]+):(.+)$") end
    if scheme == "https" then node.tls = make_tls(q, true) end
  else
    return nil
  end
  return node
end

local function outbound_from_node(n)
  local out = { type = n.type, tag = n.tag, server = n.server, server_port = n.server_port }
  local keys = {
    "uuid", "password", "method", "username", "version", "alter_id",
    "security", "flow", "congestion_control", "udp_relay_mode",
    "up_mbps", "down_mbps", "obfs"
  }
  for _, k in ipairs(keys) do if n[k] ~= nil then out[k] = n[k] end end
  if n.tls then out.tls = n.tls end
  if n.transport then out.transport = n.transport end
  return out
end

local function write_file(path, content)
  local dir = path:match("^(.*)/[^/]+$")
  if dir then fs.mkdirr(dir) end
  local f, err = io.open(path, "w")
  if not f then error(err or ("cannot open " .. path)) end
  f:write(content)
  f:close()
  fs.chmod(path, "600")
end

local function main()
  local links = uci:get("proxy_box", "main", "share_links") or ""
  local manual_links = uci:get("proxy_box", "main", "manual_links") or ""
  local subscription_url = trim(uci:get("proxy_box", "main", "subscription_url") or "")
  local config_path = uci:get("proxy_box", "main", "config_path") or "/etc/proxy-box/config.json"
  local port = tonumber(uci:get("proxy_box", "main", "mixed_port") or "17890") or 17890
  if port < 1 or port > 65535 then error("mixed_port must be 1..65535") end
  local test_url = uci:get("proxy_box", "main", "test_url") or "https://www.gstatic.com/generate_204"

  local function decode_subscription_body(value)
    local trimmed = trim(value)
    if trimmed ~= "" and not trimmed:find("://", 1, true) and not trimmed:find("\n", 1, true) then
      local decoded = b64decode(trimmed)
      if decoded and decoded:find("://", 1, true) then return decoded end
    end
    return value
  end

  links = decode_subscription_body(links)
  if subscription_url ~= "" then
    if not subscription_url:match("^https?://") then
      error("subscription_url must start with http:// or https://")
    end
    local quoted_url = "'" .. subscription_url:gsub("'", "'\\''") .. "'"
    local pipe = io.popen("uclient-fetch -q -O - " .. quoted_url .. " 2>/dev/null")
    if pipe then
      local body = pipe:read("*a") or ""
      pipe:close()
      if body ~= "" then
        links = links .. "\n" .. decode_subscription_body(body)
      else
        io.stderr:write("proxy-box generator: subscription download returned empty content; continuing with pasted links.\n")
      end
    else
      io.stderr:write("proxy-box generator: could not start uclient-fetch; continuing with pasted links.\n")
    end
  end
  manual_links = decode_subscription_body(manual_links)
  links = links .. "\n" .. manual_links

  local nodes, outbounds, seen = {}, {}, {}
  local index = 0
  for line in tostring(links):gmatch("[^\r\n]+") do
    line = trim(line)
    if line ~= "" then
      index = index + 1
      local n = parse_link(line, index)
      if n then
        local unique = n.type .. "|" .. n.server .. "|" .. n.server_port .. "|" .. (n.name or "")
        if not seen[unique] then
          seen[unique] = true
          n.tag = "node-" .. (#nodes + 1)
          nodes[#nodes + 1] = { tag = n.tag, name = n.name, type = n.type, server = n.server, server_port = n.server_port }
          outbounds[#outbounds + 1] = outbound_from_node(n)
        end
      end
    end
  end

  local config = {
    log = { level = "info" },
    inbounds = {{ type = "mixed", tag = "proxy-box-in", listen = "127.0.0.1", listen_port = port }},
    outbounds = {},
    route = { auto_detect_interface = true, final = "direct" }
  }
  if #outbounds > 0 then
    local tags, selector_tags = {}, { "auto" }
    for _, n in ipairs(outbounds) do
      tags[#tags + 1] = n.tag
      selector_tags[#selector_tags + 1] = n.tag
    end
    config.outbounds = outbounds
    config.outbounds[#config.outbounds + 1] = {
      type = "urltest", tag = "auto", outbounds = tags,
      url = test_url, interval = "3m", tolerance = 50
    }
    config.outbounds[#config.outbounds + 1] = {
      type = "selector", tag = "proxy", outbounds = selector_tags, default = "auto"
    }
    config.route.final = "proxy"
  end
  config.outbounds[#config.outbounds + 1] = { type = "direct", tag = "direct" }
  config.outbounds[#config.outbounds + 1] = { type = "block", tag = "block" }


  -- Build configurable strategy groups and remote rule-set based routing.
  local node_tags = {}
  for _, n in ipairs(nodes) do
    if n.tag and n.tag ~= "" then node_tags[#node_tags + 1] = n.tag end
  end
  local function configured(key, fallback)
    return uci:get("proxy_box", "main", key) or fallback
  end
  local function selected_node(key)
    local wanted = configured(key, "")
    for _, tag in ipairs(node_tags) do if tag == wanted then return wanted end end
    return node_tags[1]
  end
  local function add_selector(tag, key)
    if #node_tags == 0 then return end
    local def = selected_node(key)
    local options = {}
    for _, t in ipairs(node_tags) do options[#options + 1] = t end
    config.outbounds[#config.outbounds + 1] = {
      type = "selector", tag = tag, outbounds = options, default = def
    }
  end
  if #node_tags > 0 then
    local opts = {}
    for _, t in ipairs(node_tags) do opts[#opts + 1] = t end
    config.outbounds[#config.outbounds + 1] = {
      type = "selector", tag = "select", outbounds = opts, default = selected_node("selected_node")
    }
    add_selector("AI", "ai_node")
    add_selector("TikTok", "tiktok_node")
    add_selector("YouTube", "youtube_node")
    add_selector("Netflix", "netflix_node")
    add_selector("Games", "games_node")
  end

  local function policy_tag(key, fallback)
    local value = configured(key, fallback)
    if value == "direct" then return "direct" end
    if value == "reject" then return "block" end
    if value == "auto" then return #node_tags > 0 and "auto" or "direct" end
    if value == "select" then return #node_tags > 0 and "select" or "direct" end
    if value == "AI" or value == "TikTok" or value == "YouTube" or value == "Netflix" or value == "Games" then
      local exists = #node_tags > 0
      return exists and value or "direct"
    end
    return "direct"
  end

  local rulesets = {
    "geosite-youtube",
    "geosite-tiktok", "geosite-tiktok@!cn",
    "geosite-netflix", "geoip-netflix",
    "geosite-github", "geosite-google", "geosite-microsoft", "geosite-apple",
    "geosite-steam", "geosite-sony",
    "geosite-gfw", "geoip-cloudflare", "geoip-facebook", "geoip-cloudfront",
    "geoip-fastly", "geoip-google", "geoip-telegram", "geoip-tor", "geoip-twitter",
    "geosite-cn", "geoip-cn", "geoip-private"
  }
  local rule_set_config = {}
  for _, name in ipairs(rulesets) do
    local url = "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/" .. name .. ".srs"
    rule_set_config[#rule_set_config + 1] = {
      type = "remote", tag = name, format = "binary", url = url, download_detour = "direct"
    }
  end
  config.route.rule_set = rule_set_config
  config.route.rules = {}

  local function add_rule(names, policy_key, fallback)
    local active = {}
    for _, name in ipairs(names) do active[#active + 1] = name end
    if #active > 0 then
      config.route.rules[#config.route.rules + 1] = {
        rule_set = active, outbound = policy_tag(policy_key, fallback)
      }
    end
  end

  -- Service-specific rules take priority over broader domestic/foreign sets.
  add_rule({"geosite-youtube"}, "route_youtube", "auto")
  add_rule({"geosite-tiktok", "geosite-tiktok@!cn"}, "route_tiktok", "TikTok")
  add_rule({"geosite-netflix", "geoip-netflix"}, "route_netflix", "Netflix")
  add_rule({"geosite-github"}, "route_github", "auto")
  add_rule({"geosite-google"}, "route_google", "auto")
  add_rule({"geosite-microsoft"}, "route_microsoft", "direct")
  add_rule({"geosite-apple"}, "route_apple", "direct")
  add_rule({"geosite-steam", "geosite-sony"}, "route_games", "Games")
  -- Domestic rules precede broad foreign IP categories to avoid accidental override.
  add_rule({"geosite-cn", "geoip-cn", "geoip-private"}, "route_domestic", "direct")
  add_rule({
    "geosite-gfw", "geoip-cloudflare", "geoip-facebook", "geoip-cloudfront",
    "geoip-fastly", "geoip-google", "geoip-telegram", "geoip-tor", "geoip-twitter"
  }, "route_foreign", "auto")
  config.route.final = policy_tag("route_other", "direct")

  write_file(config_path, json.stringify(config, true) .. "\n")
  write_file("/etc/proxy-box/nodes.json", json.stringify(nodes, true) .. "\n")
  io.stdout:write("Generated sing-box config; imported ", #nodes, " node(s).\n")
end

local ok, err = pcall(main)
if not ok then
  io.stderr:write("proxy-box generator: ", tostring(err), "\n")
  os.exit(1)
end
