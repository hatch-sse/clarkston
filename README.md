# Innes Driver

A top-down browser driving game inspired by the original Grand Theft Auto camera style.

## What It Does

- Rebuilds the game as a 2D canvas arcade driver with UK-style roads and white markings.
- Loads a packaged OpenStreetMap snapshot of roads, buildings, shops and businesses for the wider Clarkston area.
- Lets you drive a chunky 4x4 jeep, get out on foot, run around, and enter another parked car.
- Adds road collision, building collision, named businesses, trees, a minimap, timer, best time and checkpoint sprint route.

## Run It Locally

Because the game uses JavaScript modules, open it through a local web server rather than double-clicking `index.html`.

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Controls

- WASD / arrow keys: drive
- Shift: boost / run
- E: exit or enter a nearby car
- R: reset
- Space: restart sprint

Map data © OpenStreetMap contributors.
