# Farm Idle — Township Ad Style

Browser arcade-idle farm inspired by Township-style ads.

## Play online

https://Stepan1984.github.io/TownshipAdvertisementGame/

On push to `main`, Actions builds the game and publishes the `gh-pages` branch.
In the repo: **Settings → Pages → Deploy from a branch → `gh-pages` / root**.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173/ (or the Network URL for LAN).

## Controls

- **WASD / Arrows** or on-screen joystick
- Walk onto FIELD / WHEAT / DUMP / EGGS to pick up
- **SELL** / **SELL-B** — stock counters
- **PROCESS** — crops → jars
- **LOAD-A/B/C** — load trucks
- **DEPOT** — west goods train bay (after factory line)
- Stand on unlock pads to spend cash (only the nearest pad is charged; a pad that appears under you needs you to step off and back on)
- **Space / E** or the on-screen **DRIVE / EXIT** button — get in / out of a car (after NoRiseRing)

## Difficulty

On a new game you pick **Easy / Normal / Hard** (change it any time with the button under the money counter).
Presets live in `src/balance.ts`: unlock prices, income, crop regrow time and goal targets.

## Progression

1. **Field boost** — bigger / faster purple field  
2. **Tractor** — auto-harvest → DUMP (keeps up with field upgrades; waits if DUMP is full)  
3. **Helper** — carries to counter  
4. **Processor** — crops → jars  
5. **Cashier** — auto-sell shop 1  
6. **Barn** — strong field boost  
7. **Chickens** — eggs  
8. **Boots** — move faster  
9. **Collector** — picks up cash (shop 1)  
10. **Collector upgrade** — faster scoop for all collectors  
11. **Truck bay A** — jar orders (a full truck pays the jars' shop value plus a delivery bonus)  
12. **Auto-process** — factory bot  

### Late-game

13. **Map expand** — bigger fence / east zone  
14. **Egg runner** — eggs → shop 1  
15. **Jar loader** — jars → truck bays (one courier per jar bay; helps other bays when its truck is away)  
16. **Worker speed** — couriers move faster  
16b. **Shop expansion** — SELL: counter 96, twice faster checkout, bigger orders, more customers  
17. **Truck bay B** — second jar station  
18. **Field grow I/II** — purple FIELD regenerates faster  
19. **Wheat field** — second crop  
19b. **Wheat combine** — red combine harvests WHEAT → W-DUMP (helpers / truck C pick it up)  
20. **Wheat grow I/II** — WHEAT regenerates faster  
21. **Shop 2** — wheat counter + queue (manual SELL-B)  
22. **Shop 2 helper** — wheat → SELL-B  
23. **Collector 2** — auto-picks SELL-B cash  
24. **Collector upgrade II** — scoop rate boost  
25. **Cashier 2** — auto-sell SELL-B  
25b. **Shop 2 expansion** — same upgrade for SELL-B  
25c. **Market (repeatable)** — every level +10% to all income; price ×1.6 per level (a money sink for the late game)  
26. **Truck bay C** — jars + wheat  

### West endgame

25. **West expand** — fence / playable area opens west  
26. **Factory** — auto-spawns goods (no farm input)  
27. **Conveyor** — belt moves goods north to the train  
28. **Train** — loads goods, pays out at the depot  
29. **Train collector** — auto-picks depot cash  
30. **Collector upgrade III** — max scoop speed  
31. **Factory / conveyor / train upgrades** — faster spawn, faster belt, bigger payouts  
32. **Portals 1–3** — stack on the belt (scale + value tiers)  
33. **NoRiseRing** — builds the street circuit north of the farm (pad by the north gate, after portal 3)  

The top-left badge shows **UNLOCKS done/total**; under the goal bar a **Next:** line names the cheapest pad you can work towards, and a yellow arrow on the ground points to it.

Goals in the top-left pay cash when completed. They follow the unlock order (sell → jars → eggs → trucks → bigger sales); while the building a goal needs isn't bought yet, a "Sell items" goal stands in.

## Offline earnings

Once the shop sells by itself (Cashier), coming back after at least a minute shows **Welcome back!** with what the farm earned: 25% of your recent income rate, for up to 2 hours away.

## Sound

Coin, unlock and goal sounds are synthesized in the browser (no audio files). The 🔊 / 🔇 button next to the difficulty toggles them; the choice is remembered.

## Save

Progress (money, unlocks, goals, fields) is stored in the browser `localStorage`.
Reopening the page keeps your farm; clearing site data / cache starts from scratch.
