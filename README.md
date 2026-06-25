# TreasuryBalancer ⚖️

**News-Aware DeFi Fund Manager — Powered by GenLayer AI Consensus**

TreasuryBalancer is a GenLayer intelligent contract that provides autonomous, AI-driven treasury management for DAOs holding stablecoins (USDC, USDT, DAI). The contract scans DeFi news, peg tracking sites, and forum feeds to detect depeg risks and insolvency threats. When danger is detected, GenLayer validators independently verify the threat via LLM consensus and execute automatic rebalancing of at-risk assets into safe reserves — before on-chain price feeds reflect the crash.

## How It Works

```
1. DAO deposits stablecoins into treasury → deposit()
2. Risk alert detected → scan_and_rebalance() with news & forum URLs
3. GenLayer fetches articles, peg data, and forum sentiment
4. LLM analyzes: genuine depeg risk or FUD?
5. Validators independently verify → consensus reached
6. If panic exceeds threshold → auto-rebalance to safe reserves
7. Full risk report stored on-chain with severity, panic score, recommendation
```

## Contract Methods

| Method | Type | Description |
|--------|------|-------------|
| `deposit(asset, amount_usd)` | write | Deposit stablecoins into treasury |
| `withdraw(asset, amount_usd)` | write | Withdraw from treasury |
| `scan_and_rebalance(target_asset, news_url, forum_url, description)` | write | AI-powered risk scan + auto-rebalance |
| `manual_rebalance(from_asset, to_asset, amount_usd)` | write | Manually rebalance between assets |
| `set_risk_threshold(threshold)` | write | Set panic score auto-rebalance threshold (0-100) |
| `get_allocations()` | view | Get all treasury balances and settings |
| `get_report(report_id)` | view | Get full risk report with AI analysis |
| `get_report_count()` | view | Total risk reports filed |

## AI Risk Analysis Output

When a risk scan is triggered, the AI evaluates and returns:

```json
{
  "risk_level": "HIGH",
  "panic_score": 78,
  "depeg_probability": 45,
  "recommendation": "REDUCE_EXPOSURE",
  "analysis_summary": "Multiple sources confirm USDT reserve concerns...",
  "sentiment_indicators": "whale dumping, curve pool imbalance, social media panic",
  "action_taken": "REBALANCED",
  "rebalanced_amount": 2500000
}
```

## Risk Levels

| Level | Description |
|-------|-------------|
| CRITICAL | Imminent depeg, insolvency confirmed, emergency exit required |
| HIGH | Significant risk, multiple warning signals, reduce exposure |
| MEDIUM | Elevated risk, monitor closely, potential contagion |
| LOW | Minor concerns, FUD likely, hold position |
| SAFE | No significant risk detected, normal operations |

## Recommendations

| Action | Trigger |
|--------|---------|
| EMERGENCY_EXIT | Panic ≥ threshold + CRITICAL risk → move all funds to safe reserve |
| REDUCE_EXPOSURE | Panic ≥ threshold + HIGH risk → move 50% to safe reserve |
| MONITOR | Elevated risk but below threshold → watch closely |
| HOLD | Low risk → maintain current allocation |
| INCREASE | Safe conditions → consider increasing allocation |

## Deployment

1. **Deploy Contract:** Create a `.env` file with your private key, then deploy:
   ```bash
   # In the root directory
   npm install
   node deploy.js
   ```
   *Note: `.env` must contain `PRI_KEY=your_private_key`. The `.env` file is excluded from version control.*

2. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *Uses MetaMask for all transactions. Connects to GenLayer Studionet.*

## Testing

The frontend includes **⚡ Try Example** buttons with 15 real-world stablecoin risk scenarios:
- USDT attestation delays and reserve concerns
- USDC Silicon Valley Bank exposure
- DAI MakerDAO governance risks
- Cross-chain bridge exploits
- Regulatory enforcement actions

Click Try Example to pre-fill forms, then submit to trigger AI analysis via MetaMask.

## Built On

- [GenLayer](https://genlayer.com) — Intelligent contracts with AI consensus
- [genlayer-js](https://github.com/genius-ventures/genlayer-js) — TypeScript SDK
- React & Vite — Modern frontend stack
- Deployed on GenLayer Studionet (`0xb7F9379C2B41382A8032893B11cB96329526d7c7`)

## License

This project is licensed under the MIT License.
