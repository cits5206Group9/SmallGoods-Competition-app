#!/bin/sh
# Pair the current host (most recent DHCP lease or a specified host/IP) as "the server".
# - Pins a static DHCP reservation for the host
# - Maps DOMAIN (e.g., sg.lan) -> that host's IP

set -e

DOMAIN="${1:-sg.lan}"
TARGET="${2:-}"

LEASES="/tmp/dhcp.leases"
[ -f "$LEASES" ] || { echo "No DHCP leases yet. Connect the host to LAN/Wi-Fi first."; exit 1; }

pick_lease() {
  # fields: <expiry> <mac> <ip> <hostname> <clientid>
  sort -k1,1n "$LEASES" | awk '{print $2, $3, ($4==""?"(no-hostname)":$4)}' | tail -n 1
}

# If user provided IP or hostname, find that; else pick most recent lease
if [ -n "$TARGET" ]; then
  if echo "$TARGET" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    # IP was provided
    line="$(awk -v ip="$TARGET" '$3==ip {print $0}' "$LEASES" | tail -n 1)"
  else
    # hostname was provided
    line="$(awk -v h="$TARGET" '$4==h {print $0}' "$LEASES" | tail -n 1)"
  fi
  [ -n "$line" ] || { echo "Could not find lease for '$TARGET'. Connect that host and try again."; exit 1; }
else
  # most recent lease
  line="$(sort -k1,1n "$LEASES" | tail -n 1)"
fi

set -- $line
MAC="$2"; IP="$3"; HOST="$4"
[ -n "$MAC" ] && [ -n "$IP" ] || { echo "Failed to parse lease. Got: $line"; exit 1; }
[ -n "$HOST" ] || HOST="sg-server"

echo "Pairing host:"
echo "  Hostname : $HOST"
echo "  MAC      : $MAC"
echo "  IP       : $IP"
echo "  Domain   : $DOMAIN"

# 1) Reserve the IP for this MAC
uci -q delete dhcp.sgserver
uci set dhcp.sgserver='host'
uci set dhcp.sgserver.mac="$MAC"
uci set dhcp.sgserver.ip="$IP"
uci set dhcp.sgserver.name="$HOST"

# 2) Map DOMAIN -> this IP (direct A record)
uci -q delete dhcp.@dnsmasq[0].address
uci add_list dhcp.@dnsmasq[0].address="/${DOMAIN}/${IP}"

# Ensure domain is set correctly
uci set dhcp.@dnsmasq[0].domain="${DOMAIN}"
uci set dhcp.@dnsmasq[0].local="/${DOMAIN}/"

# Add explicit DNS record
uci -q delete dhcp.sgdomain
uci set dhcp.sgdomain='domain'
uci set dhcp.sgdomain.name="${DOMAIN}"
uci set dhcp.sgdomain.ip="${IP}"

uci commit dhcp
/etc/init.d/dnsmasq restart

# Verify DNS record is added
echo "Verifying DNS configuration..."
sleep 2  # Give dnsmasq time to restart
nslookup ${DOMAIN} 127.0.0.1 || echo "Warning: DNS verification failed"

echo "Paired. Test: nslookup ${DOMAIN} 192.168.8.1 ; open http://${DOMAIN}/admin"