# MOO2 Locator

Checks whether the two human players in a Master of Orion 2 game start far apart, without either of them learning where the other is.

## How it works

1. One player opens the page and clicks **Start a new round**, then sends the link to the other player.
2. Each player clicks the approximate position of their homeworld on the galaxy map and locks it in. Each player can submit only once per round, and the position can't be changed afterwards.
3. When both have submitted, each player sees only a distance band:

   | Result | Distance between homeworlds |
   |---|---|
   | **Reroll** | under 1/3 of the galaxy width: regenerate the galaxy and start a new round |
   | **Medium** | 1/3 to 2/3 of the galaxy width: play |
   | **Far** | over 2/3 of the galaxy width: play |

4. After the game, both players can press **Reveal positions**. The positions are shown only once *both* players have asked.

The server is the only place that sees both positions. Rounds are deleted after 30 days.

The galaxy is treated as a 4:3 rectangle. Distances are measured as a fraction of its width. You can change the proportions and thresholds in `src/logic.js`.

## Run locally

```sh
npm install
npm run dev      # http://localhost:8787
npm test
```

## Deploy to Cloudflare (free plan)

```sh
npx wrangler login
npm run deploy
```

Wrangler prints the public URL (`https://moo2-locator.<your-subdomain>.workers.dev`).
