# GRIDIRON SMASH

A 3D sports game for the browser. Made by a 5 year old and his dad.

Play it here: **https://erinels.github.io/gridiron-smash/**

## Four games in one

| Game | What you do |
| --- | --- |
| **Football** | Run to the end zone. Score touchdowns. Kick the extra point. |
| **Wrestling** | WWE style. Punch, slam, and knock the other wrestler down. |
| **Soccer** | Dribble the ball and shoot past the goalkeeper. |
| **Basketball** | Run in and slam dunk it, or shoot from far back for 3 points. |

Pick your character before every match. Play alone or with a friend on the same
keyboard, or on the same phone or tablet.

## Wrestling: the belt run

Play wrestling on your own and you get two ways to fight.

**BELT RUN.** Fight all five wrestlers, one after the other. Win a fight and you
go straight to the next one. The BOSS is last. Beat him and you are the champion.
The game remembers how far you got.

**PICK YOUR RIVAL.** Choose any wrestler and fight only that one. A gold tick
shows who you have already beaten.

| Wrestler | What he is like |
| --- | --- |
| **THE ROOKIE** | New guy. Small and quick. Easy. |
| **EL TIGRE** | Masked flyer. Very fast. |
| **BIG RIG** | Huge and slow. Big hits. |
| **THE VIPER** | Sneaky. Hits very fast. |
| **KING SMASH** | THE BOSS. Gold mask. Massive. Gets up fast, and gets angry when he is hurt. |

## Basketball: dunk it or shoot it

There are two ways to score, and both are easy.

**DUNK.** Run into the gold ring on the floor under the hoop and press SHOOT.
Your player jumps up and slams the ball through. That is 2 points, every time.

**BIG SHOT.** Stand back behind the white arc and press E. The ball floats up in
a high arc and drops in. Outside the arc is 3 points.

Press SHOOT anywhere else for a normal shot. The further out you are, the more
it can wobble, so the BIG SHOT is the one to use from far back.

You get 90 seconds. The game remembers your best score.

There is a new player for this one: **HOOPER**. He is very tall and he jumps the
highest. You can pick him in any game.

## Controls

### Keyboard

| Key | What it does |
| --- | --- |
| Arrow keys or W A S D | Move. Press two at once to run diagonally. |
| SPACE | Spin (football), punch (wrestling), shoot (soccer and basketball) |
| E | Throw (football), big slam (wrestling), big kick (soccer), big shot (basketball) |
| SHIFT | Run fast |

Player 2 uses I J K L to move, G to hit, and H for the special move.

### Phone and tablet

On-screen controls appear on their own when the game sees a touch screen. Turn
the phone sideways first.

| Control | What it does |
| --- | --- |
| Left side of the screen | Hold and drag to steer. It works in every direction, so diagonals are easy. |
| Big green button | The main move. It is labelled for the game you picked: SPIN, PUNCH, or SHOOT. |
| Blue button | The special move: THROW, SLAM, BIG KICK, or BIG SHOT. |
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
