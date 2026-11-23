# Say & Play
A hands-free learning playroom for ages 3–6 with three games: Number Playroom, Spell It and Road Rush. "Let’s play" opens the game picker; each game has its own welcome page, colour theme and levels. Everything is spoken aloud and answered by voice (or by tapping).

## Game 1 — Number Playroom
120 levels in three sections. Meadow Trail (1–40) develops numeral recognition, Rainbow River (41–80) adds counting groups of dots, and Starlight Summit (81–120) also asks which number comes next. Number range, choices, movement and round length increase gradually. No countdown or penalty.

## Pages
Every screen has its own address, so the browser's Back button, refresh and bookmarks work:

| Address | Screen |
|---|---|
| `/` | Say & Play welcome (blue) |
| `/games` | Game picker |
| `/numbers`, `/numbers/levels`, `/numbers/level/12` | Number Playroom (purple) |
| `/spell`, `/spell/modes`, `/spell/words`, `/spell/numbers/level/5` | Spell It (orange) |
| `/road`, `/road/levels`, `/road/level/8` | Road Rush (teal) |

Every game pauses itself when you switch tabs, minimise, or click into another window.

## Run on Windows
This is the Vite + React version. The original Next.js version lives untouched in ../number-rush.

Use Node.js 24 and npm. In the project folder run:
```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```
Open http://127.0.0.1:3157 (the original uses 3156, so both can run side by side). For development with instant reload use `npm.cmd run dev`.

**Install as an app:** open the address in Chrome or Edge and choose *Install* in the address bar. The first visit caches everything (about 48 MB, including the speech model and voice clips), and the installed app then opens and plays with no internet. The built `dist` folder is plain static files, so any static web server can host it; it needs localhost or https for the microphone.

## Tech stack
- **Runtime:** React 19, React Router, PixiJS (Road Rush graphics), TypeScript, Vite (build and local server), vite-plugin-pwa (offline install), vosk-browser (offline speech recognition), lucide-react (icons), Fontsource (local fonts). Styling is plain CSS (`src/reset.css` + `src/style.css`).
- **Tools only:** kokoro-js and lamejs (record narrator clips), Playwright and the Node test runner (tests).

## Game 2 — Spell It
Two modes, 40 levels each, 3 items per level:

- **Food words:** “Spell egg!” — the child says each letter (or taps the scrambled letter tiles) and it drops into the next empty box. Words grow from 3 letters (egg, pie, nut) to longer foods (banana, pineapple).
- **Numbers:** “Make fifteen!” — say “one… five” to build 15, or simply say the whole number. Numbers grow from 10–20 up to 100.

Every 5th level, and every other level in the last stage, is a **memory level**: the word or number is hidden (the food picture stays) and must be spelled from the spoken prompt. A wrong letter gets “Hmm, G is not next. Try again!”; a second miss, or silence, gives a clue and highlights the right tile. A finished word gets a hooray sound, a thumbs up and confetti, and the next word and level follow automatically.

To keep letter recognition reliable, the offline recogniser only listens for the letters on the tiles currently on screen (letter names like “bee”, “gee” are understood), and accepts the expected letter if it is heard anywhere in what was said.


## Game 3 — Road Rush
Pip waits at the roadside. "3, 2, 1… Spell apple!" — every correct letter or digit (said or tapped) hops Pip across one lane and paints the letter on the road. A car, bus, truck or train creeps in from the left as the lane timer runs down; the guide calls "Hurry up!" when time is low. If the timer runs out the vehicle honks, Pip hops back onto the kerb, and the child simply tries that lane again — nobody loses. Words and numbers are mixed at random.

40 levels in four roads (Quiet Street, Busy Avenue, Big Highway, Railway Crossing): words get longer, lanes get shorter (11 s per lane at level 1, about 6 s at level 40), and trains join in at the end. The timer pauses while the narrator talks and during breaks; three timeouts in a row without any answer take a break automatically. The road, Pip and the traffic are drawn with PixiJS in code (no image files), with a plain fallback if the device can't draw graphics.

## Play
A grown-up taps **Let’s play**, picks a level and, the first time, chooses **Voice and tap** (the browser asks once for the microphone) or **Tap only**. From then on the game runs by itself:

- A playful narrator reads every question, hint and menu aloud, so children never need to read.
- The microphone stays on for the whole level. Saying a number answers; chatter, coughs and unclear words are ignored. Tapping always works too, and **Say my answer** restarts the microphone if needed.
- A first wrong answer gets a hint that keeps the puzzle; a second one shows the answer.
- After 5 quiet seconds the guide checks in (“Are you still there?”), then gives a clue, then pauses the game by itself.
- Correct answers earn a star and a sparkle sound; each finished level plays a fanfare and the next level starts automatically.
- Gentle background music plays and quietens while the narrator talks or the game listens.

Parents can switch off sounds, music, narration, moving tiles or voice play. Progress, stars and badges stay on the device.

## Offline
Everything runs without internet once the app is installed and the local server is running:

- **Listening** uses [Vosk](https://alphacephei.com/vosk/) in the browser with the small US-English model (`public/models/vosk-en-small.tar.gz`, ~40 MB, Apache 2.0), limited to the words one to ten. If it cannot start, the game falls back to the browser’s own recogniser (which may need internet), and then to tapping.
- **The narrator** is a set of pre-recorded MP3 clips in `public/voice/`, made with the [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) neural voice (Apache 2.0). If a clip is ever missing, the device’s speech synthesiser reads that line instead.
- Music and sound effects are generated in code.

No audio, transcripts or accounts are saved or sent.

### Re-recording the narrator
Every sentence the game can say is defined in `lines` in `src/game.ts`. After changing or adding one, run:
```powershell
npm.cmd run voice
```
This records only missing clips (the first run downloads the Kokoro model, ~90 MB, once). To try a different voice, re-record everything, for example:
```powershell
$env:VOICE='af_bella'; npm.cmd run voice -- --force
```

## Deploy to Vercel and install on a phone
`vercel.json` is included: it sends every address (like `/road/level/5`) to the app, so refreshing any page works online, and it makes sure updates to the offline cache are picked up.

1. Put the `number-rush-react` folder in a GitHub repository and import it at vercel.com, **or** run `npx vercel` inside the folder. Vercel reads the settings from `vercel.json` (build `npm run build`, output `dist`).
2. On the phone, open the Vercel link **on Wi-Fi** and wait until the footer shows **“✓ Ready to play offline”** (about 53 MB is saved the first time: the speech model and all voice clips).
3. Install it: Android Chrome → menu → **Install app**; iPhone Safari → **Share → Add to Home Screen**.
4. Open it from the home screen and allow the microphone once. From then on it works with no internet.

Notes: on iPhone, iOS may clear a home-screen app's saved files after a few weeks without use — opening it online once downloads everything again. New versions you deploy are picked up automatically the next time the app is opened online.

## Tests
```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:browser
```
The browser suite uses installed Chrome; set `$env:BROWSER_CHANNEL='msedge'` to use Edge. It covers simulated speech, silence check-ins, the automatic break, retries, automatic progression and final completion, plus a real offline-recognition test where Chrome’s fake microphone plays a recording of “one” (`tests/fixtures/say-one.wav`, made by `scripts/make-test-audio.mjs`) with internet blocked. For a hardware check, start level 1 with Voice and tap, allow the microphone, wait for the question, and say “one”.
