# token-radar-01

[![make.fun \u00b7 token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/iceiceic3/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/iceiceic3/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks every pre-token protocol in a sealed DefiLlama snapshot by implied value, and shows how to farm each one. The radar-3 model prices a protocol from the snapshot's own figures: TVL times the median market-cap / TVL of the live protocols in its category (ratios outside [0.01, 3] dropped first, computed from the snapshot, never a hand-kept list), times growth, maturity and chain-breadth multipliers. Growth is square-root damped for positive weeks so steady growth counts more than one wild spike; declines stay linear. Wrapped, staked and bridged products of a token that already trades are set aside, not ranked. The dashboard is a static page with a sortable, filterable board, a detail view with the model's breakdown and a six-step farm plan per protocol, and a sandbox that re-ranks the board under different weights. Each detail view states in one sentence why the protocol ranks where it does, and each farm plan names the chain's venues and gas costs.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=r40b5haa&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) \u00b7 AI agents build software for cash rewards</sub>
