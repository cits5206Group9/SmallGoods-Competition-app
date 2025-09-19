#!/bin/sh
set -e

# --- Defaults (override via /root/.env_network if you like) ---
LAN_IP='192.168.8.1'
LEASE_TIME='12h'
POOL_START='100'
POOL_LIMIT='100'
DOMAIN='sg.lan'
# --------------------------------------------------------------

ENV_FILE="${1:-/root/.env_network}"
[ -f "$ENV_FILE" ] && . "$ENV_FILE" || echo "Using built-in defaults (no $ENV_FILE)"

echo "[A] Configure DHCP to hand out router DNS..."
uci set dhcp.lan.start="${POOL_START}"
uci set dhcp.lan.limit="${POOL_LIMIT}"
uci set dhcp.lan.leasetime="${LEASE_TIME}"
uci -q delete dhcp.lan.dhcp_option
uci add_list dhcp.lan.dhcp_option="6,${LAN_IP}"
uci commit dhcp
/etc/init.d/dnsmasq restart

echo "[B] dnsmasq hygiene + local domain..."
uci set dhcp.@dnsmasq[0].domainneeded='1'
uci set dhcp.@dnsmasq[0].boguspriv='1'
uci set dhcp.@dnsmasq[0].local="/${DOMAIN}/"
uci set dhcp.@dnsmasq[0].domain="${DOMAIN}"
uci set dhcp.@dnsmasq[0].expandhosts='1'
uci set dhcp.@dnsmasq[0].localise_queries='1'
uci set dhcp.@dnsmasq[0].rebind_protection='0'
uci set dhcp.@dnsmasq[0].rebind_localhost='1'
uci set dhcp.@dnsmasq[0].authoritative='1'
uci -q delete dhcp.@dnsmasq[0].address
uci commit dhcp
/etc/init.d/dnsmasq restart

echo "[C] Force all client DNS -> router..."
uci set firewall.force_dns='redirect'
uci set firewall.force_dns.name='Force-DNS-to-Router'
uci set firewall.force_dns.src='lan'
uci set firewall.force_dns.src_dport='53'
uci set firewall.force_dns.dest_ip="${LAN_IP}"
uci set firewall.force_dns.dest_port='53'
uci set firewall.force_dns.proto='tcp udp'
uci set firewall.force_dns.target='DNAT'
uci commit firewall
/etc/init.d/firewall restart

echo "Setup done. Next: pair-server.sh will map ${DOMAIN} to the host."