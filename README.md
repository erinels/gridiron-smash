# GRIDIRON SMASH

A 3D sports game for the browser. Made by a 5 year old and his dad.

Play it here: **https://erinels.github.io/gridiron-smash/**

## Three games in one

| Game | What you do |
| --- | --- |
| **Football** | Run to the end zone. Score touchdowns. Kick the extra point. |
| **Wrestling** | WWE style. Punch, slam, and knock the other wrestler down. |
| **Soccer** | Dribble the ball and shoot past the goalkeeper. |

Pick your character before every match. Play alone or with a friend on the same
keyboard, or on the same phone or tablet.

## Controls

### Keyboard

| Key | What it does |
| --- | --- |
| Arrow keys or W A S D | Move. Press two at once to run diagonally. |
| SPACE | Spin (football), punch (wrestling), shoot (soccer) |
| E | Throw (football), big slam (wrestling), big kick (soccer) |
| SHIFT | Run fast |

Player 2 uses I J K L to move, G to hit, and H for the special move.

### Phone and tablet

On-screen controls appear on their own when the game sees a touch screen. Turn
the phone sideways first.

| Control | What it does |
| --- | --- |
| Left side of the screen | Hold and drag to steer. It works in every direction, so diagonals are easy. |
| Big green button | The main move. It is labelled for the game you picked: SPIN, PUNCH, or SHOOT. |
| Blue button | The special move: THROW, SLAM, or BIG KICK. |
| Grey RUN button | Tap once to run fast. Tap again to stop. |

Two players can share one tablet. Each player gets a thumbstick in their own
bottom corner and their own buttons next to it.

## Run it on your own computer

The game is plain HTML and JavaScript. There is nothing to build and nothing to
install. You only need a small web server, because browsers block local files.

```
git clone https://github.com/erinels/gridiron-smash.git
cd gridiron-smash
python -m http.server 8777
```

Then open http://localhost:8777 in your browser.

## What is inside

| File | What it holds |
| --- | --- |
| `index.html` | The screens, the menus, and all the styling |
| `game.js` | Every game: 3D models, physics, controls, and the computer players |
| `vendor/three.min.js` | three.js r128, the 3D library |

## Credits

3D graphics use [three.js](https://threejs.org/) r128, which is MIT licensed.
A copy of the library is kept in `vendor/` so the game always works.
