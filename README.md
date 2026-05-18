# Clarkston Simulator — browser prototype

A simple map-based 3D browser prototype inspired by Clarkston, Glasgow.

## What it does

- Loads real roads, buildings and railway lines from OpenStreetMap via Overpass API.
- Turns the map data into a simplified low-poly 3D world.
- Lets you walk around.
- Lets you enter/exit a basic car and drive around.

## Run it locally

Because the game uses JavaScript modules, open it through a local web server rather than double-clicking `index.html`.

Option 1, using Python:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

Option 2, using VS Code:

- Install the Live Server extension.
- Right-click `index.html`.
- Choose “Open with Live Server”.

## Controls

- WASD / arrow keys: walk or drive
- Shift: run / boost
- E: enter / exit car
- R: reset
- Mouse: look around after clicking the game

## Notes

This is a prototype, not a finished GTA-style game. It uses OpenStreetMap geometry, so the road/building layout is map accurate to the source data, but the 3D heights, materials, traffic, pavements and landmarks are simplified.

Map data © OpenStreetMap contributors. OpenStreetMap data is available under the Open Database Licence.
