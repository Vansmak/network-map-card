# Network Map Card

A live map of every device on your network for Home Assistant. Nothing to run besides the card: it builds the map in your browser from your `device_tracker` entities and your Zigbee / Z-Wave / Lutron devices.

![Rings view](screenshots/rings.png)

- **Rings view**: router in the middle, each access point as a spoke, devices around it. Green = online, amber = gone under 24 h, red = gone 24 h+, grey = "allowed to sleep" (TVs, phones, consoles).
- **Zoom**: tap any access point or radio and its devices fan out around it, readable at a glance.
- **Link-type filters**: switch Ethernet, Wi-Fi, Zigbee, Z-Wave, Sonos and Lutron lines on and off in any combination. Ethernet is a solid line, Wi-Fi flows, radios are dotted.
- **SonosNet**: Sonos speakers that look "wired" (SonosNet is Sonos's own wireless mesh) get a hub of their own.
- **Slideshow**: one button cycles every link type, everything, then each hub zoomed in. Good for a wall tablet.
- **House view**: put your devices on **your own floor plan**. You provide the image, you drag boxes over it to mark the rooms (the room list comes from your HA areas), and devices land in their room automatically. Drag a dot to move a device. Optional: write the change back to the HA device's area.
- **Edit from the map**: tap a device to rename it, mute its "dropped off" alerts, set its room, or hide it. Purple dot = new device, dashed blue ring = "needs a name".

![Zoom](screenshots/zoom.png)

## Install (HACS)

1. HACS → ⋮ → **Custom repositories** → add `https://github.com/Vansmak/network-map-card`, type **Dashboard** (Lovelace).
2. Install **Network Map Card**, then reload the browser.
3. Edit a dashboard → **Add card** → **Network Map Card** (or use the YAML below).

Manual: copy `dist/network-map-card.js` to `/config/www/` and add `/local/network-map-card.js` as a dashboard resource (type *JavaScript module*).

## What it needs from you

The card can only draw what Home Assistant already knows, so you provide the network pieces:

1. **A router/tracker integration** that creates `device_tracker` entities with a `mac` or `ip` attribute (TP-Link Deco, UniFi, Fritz!Box, Asus, OpenWrt, Mikrotik, Nmap, Keenetic, …). Each tracked client becomes a dot.
2. **Your router's name** (`gateway_name`).
3. **Your access points / mesh nodes**, if you have any. TP-Link Deco is detected automatically. For anything else list them in `hubs` (see below) so clients group under the access point they are connected to.
4. **Zigbee / Z-Wave / Lutron** are read from the device registry (ZHA, Zigbee2MQTT, Z-Wave JS, Lutron Caséta). Nothing to configure.
5. **A floor plan**, only for House view: any picture of your home (a sketch, a Roomba map screenshot, a real plan). Save it under `/config/www/` and point `floors[].image` at `/local/<file>`. No image? You still get a plain grid, and Rings works without a plan at all.

The room-editing and renaming need an admin user (they read the device and area registries).

## Configuration

```yaml
type: custom:network-map-card
title: Network               # optional
gateway_name: Arris gateway  # your router
height: 720                  # map height in px
floors:                      # optional: one entry per floor
  - name: Downstairs
    image: /local/floor-down.png
  - name: Upstairs
    image: /local/floor-up.png
hubs:                        # optional: your access points (Deco is automatic)
  - entity: device_tracker.garage_ap
    name: Garage AP
    wired: true
  - mac: "aa:bb:cc:dd:ee:ff"
    name: Living room AP
    main: true
ignore:                      # optional: trackers to leave out
  - device_tracker.some_phone
radios: [zigbee, zwave, lutron]   # which radios to draw
sync_areas: false            # true = dropping a device in a room also sets its HA area (admin only)
storage_key: network_map     # change if you add a second card with different names/rooms
```

How clients are matched to an access point: the tracker attributes `deco_mac`, `ap_mac` or `access_point_mac` (or the AP's name in `deco_device`, `ap_name`, `access_point`). Anything unmatched hangs off the router. Wired vs Wi-Fi comes from `connection_type`, `is_wired` or `wired`.

## Where your edits are saved

Names, hidden devices, rooms, positions and the rooms you draw are saved in Home Assistant under your user (`frontend/set_user_data`, key `network_map`), so they follow you between browsers. A different HA user has their own set.

## Not included (yet)

- Push alerts when a device drops. The "it's allowed to sleep" flag is stored so a blueprint can use it later.
- Per-device ping/latency.
- Floors are separate images; there is no stacked 3D view.

## Credits

Built for a home network of ~120 devices; shared because the map turned out to be the fun part. MIT licensed. Issues and ideas welcome.
