# Farm Idle — Township Ad Style

Browser arcade-idle farm inspired by Township-style ads.

## Run

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
- Stand on unlock pads to spend cash

## Progression

1. **Field boost** — bigger / faster purple field  
2. **Tractor** — auto-harvest → DUMP  
3. **Helper** — carries to counter  
4. **Processor** — crops → jars  
5. **Cashier** — auto-sell shop 1  
6. **Barn** — strong field boost  
7. **Chickens** — eggs  
8. **Boots** — move faster  
9. **Collector** — picks up cash (shop 1)  
10. **Collector upgrade** — faster scoop for all collectors  
11. **Truck bay A** — jar orders  
12. **Auto-process** — factory bot  

### Late-game

13. **Map expand** — bigger fence / east zone  
14. **Egg runner** — eggs → shop 1  
15. **Jar loader** — jars → truck bays  
16. **Worker speed** — couriers move faster  
17. **Truck bay B** — second jar station  
18. **Wheat field** — second crop  
19. **Shop 2** — wheat counter + queue (manual SELL-B)  
20. **Shop 2 helper** — wheat → SELL-B  
21. **Collector 2** — auto-picks SELL-B cash  
22. **Collector upgrade II** — scoop rate boost  
23. **Cashier 2** — auto-sell SELL-B  
24. **Truck bay C** — jars + wheat  

### West endgame

25. **West expand** — fence / playable area opens west  
26. **Factory** — auto-spawns goods (no farm input)  
27. **Conveyor** — belt moves goods north to the train  
28. **Train** — loads goods, pays out at the depot  
29. **Train collector** — auto-picks depot cash  
30. **Collector upgrade III** — max scoop speed  
31. **Factory / conveyor / train upgrades** — faster spawn, faster belt, bigger payouts  
32. **Portals 1–3** — stack on the belt (scale + value tiers)  

Goals in the top-left pay cash when completed.

## Save

Progress (money, unlocks, goals, fields) is stored in the browser `localStorage`.
Reopening the page keeps your farm; clearing site data / cache starts from scratch.
