# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import typing
from dataclasses import dataclass


@allow_storage
@dataclass
class RiskReport:
    report_id: u256
    analyst: Address
    target_asset: str
    news_url: str
    forum_url: str
    description: str
    risk_level: str
    panic_score: u32
    depeg_probability: u32
    recommendation: str
    analysis_summary: str
    sentiment_indicators: str
    action_taken: str
    rebalanced_amount: u32


class TreasuryBalancer(gl.Contract):
    usdc_balance: u32
    usdt_balance: u32
    dai_balance: u32
    safe_reserve: u32
    next_report_id: u256
    reports: TreeMap[u256, RiskReport]
    risk_threshold: u32

    def __init__(self):
        self.usdc_balance = u32(0)
        self.usdt_balance = u32(0)
        self.dai_balance = u32(0)
        self.safe_reserve = u32(0)
        self.next_report_id = u256(0)
        self.risk_threshold = u32(70)

    # ──────────────────────────────────────────────
    #  TREASURY MANAGEMENT
    # ──────────────────────────────────────────────

    @gl.public.write
    def deposit(self, asset: str, amount_usd: int) -> None:
        if amount_usd <= 0:
            raise gl.vm.UserError("amount must be positive")
        asset_upper = asset.upper()
        if asset_upper == "USDC":
            self.usdc_balance = u32(int(self.usdc_balance) + amount_usd)
        elif asset_upper == "USDT":
            self.usdt_balance = u32(int(self.usdt_balance) + amount_usd)
        elif asset_upper == "DAI":
            self.dai_balance = u32(int(self.dai_balance) + amount_usd)
        else:
            raise gl.vm.UserError("asset must be USDC, USDT, or DAI")

    @gl.public.write
    def withdraw(self, asset: str, amount_usd: int) -> None:
        if amount_usd <= 0:
            raise gl.vm.UserError("amount must be positive")
        asset_upper = asset.upper()
        if asset_upper == "USDC":
            if int(self.usdc_balance) < amount_usd:
                raise gl.vm.UserError("insufficient USDC balance")
            self.usdc_balance = u32(int(self.usdc_balance) - amount_usd)
        elif asset_upper == "USDT":
            if int(self.usdt_balance) < amount_usd:
                raise gl.vm.UserError("insufficient USDT balance")
            self.usdt_balance = u32(int(self.usdt_balance) - amount_usd)
        elif asset_upper == "DAI":
            if int(self.dai_balance) < amount_usd:
                raise gl.vm.UserError("insufficient DAI balance")
            self.dai_balance = u32(int(self.dai_balance) - amount_usd)
        elif asset_upper == "SAFE_RESERVE":
            if int(self.safe_reserve) < amount_usd:
                raise gl.vm.UserError("insufficient Safe Reserve balance")
            self.safe_reserve = u32(int(self.safe_reserve) - amount_usd)
        else:
            raise gl.vm.UserError("asset must be USDC, USDT, DAI, or SAFE_RESERVE")

    @gl.public.write
    def manual_rebalance(
        self, from_asset: str, to_asset: str, amount_usd: int
    ) -> None:
        if amount_usd <= 0:
            raise gl.vm.UserError("amount must be positive")
        from_upper = from_asset.upper()
        to_upper = to_asset.upper()
        if from_upper == to_upper:
            raise gl.vm.UserError("from and to assets must be different")

        # Deduct from source
        if from_upper == "USDC":
            if int(self.usdc_balance) < amount_usd:
                raise gl.vm.UserError("insufficient USDC balance")
            self.usdc_balance = u32(int(self.usdc_balance) - amount_usd)
        elif from_upper == "USDT":
            if int(self.usdt_balance) < amount_usd:
                raise gl.vm.UserError("insufficient USDT balance")
            self.usdt_balance = u32(int(self.usdt_balance) - amount_usd)
        elif from_upper == "DAI":
            if int(self.dai_balance) < amount_usd:
                raise gl.vm.UserError("insufficient DAI balance")
            self.dai_balance = u32(int(self.dai_balance) - amount_usd)
        elif from_upper == "SAFE_RESERVE":
            if int(self.safe_reserve) < amount_usd:
                raise gl.vm.UserError("insufficient Safe Reserve balance")
            self.safe_reserve = u32(int(self.safe_reserve) - amount_usd)
        else:
            raise gl.vm.UserError("from_asset must be USDC, USDT, DAI, or SAFE_RESERVE")

        # Add to destination
        if to_upper == "USDC":
            self.usdc_balance = u32(int(self.usdc_balance) + amount_usd)
        elif to_upper == "USDT":
            self.usdt_balance = u32(int(self.usdt_balance) + amount_usd)
        elif to_upper == "DAI":
            self.dai_balance = u32(int(self.dai_balance) + amount_usd)
        elif to_upper == "SAFE_RESERVE":
            self.safe_reserve = u32(int(self.safe_reserve) + amount_usd)
        else:
            raise gl.vm.UserError("to_asset must be USDC, USDT, DAI, or SAFE_RESERVE")

    @gl.public.write
    def set_risk_threshold(self, threshold: int) -> None:
        if threshold < 0 or threshold > 100:
            raise gl.vm.UserError("threshold must be between 0 and 100")
        self.risk_threshold = u32(threshold)

    # ──────────────────────────────────────────────
    #  AI-POWERED RISK SCANNING & AUTO-REBALANCE
    # ──────────────────────────────────────────────

    @gl.public.write
    def scan_and_rebalance(
        self,
        target_asset: str,
        news_url: str,
        forum_url: str,
        description: str,
    ) -> dict[str, typing.Any]:
        asset_upper = target_asset.upper()
        if asset_upper not in ("USDC", "USDT", "DAI"):
            raise gl.vm.UserError("target_asset must be USDC, USDT, or DAI")

        report_id = self.next_report_id
        self.next_report_id = u256(int(self.next_report_id) + 1)

        # Store PENDING report before nondet block
        self.reports[report_id] = RiskReport(
            report_id=report_id,
            analyst=gl.message.sender_address,
            target_asset=asset_upper,
            news_url=news_url,
            forum_url=forum_url,
            description=description,
            risk_level="PENDING",
            panic_score=u32(0),
            depeg_probability=u32(0),
            recommendation="PENDING",
            analysis_summary="Pending AI investigation",
            sentiment_indicators="",
            action_taken="PENDING",
            rebalanced_amount=u32(0),
        )

        # Get current balance of the target asset for rebalancing decisions
        current_balance = 0
        if asset_upper == "USDC":
            current_balance = int(self.usdc_balance)
        elif asset_upper == "USDT":
            current_balance = int(self.usdt_balance)
        elif asset_upper == "DAI":
            current_balance = int(self.dai_balance)

        threshold = int(self.risk_threshold)

        def leader_fn() -> dict[str, typing.Any]:
            # 1. Fetch the news article / risk report
            news_text = "News URL unreachable"
            try:
                resp1 = gl.nondet.web.get(news_url)
                news_text = resp1.body.decode("utf-8")[:3000]
            except Exception:
                news_text = "Failed to fetch news URL"

            # 2. Fetch forum / peg tracking data
            forum_text = "Forum URL unreachable"
            try:
                resp2 = gl.nondet.web.get(forum_url)
                forum_text = resp2.body.decode("utf-8")[:3000]
            except Exception:
                forum_text = "Failed to fetch forum URL"

            # 3. LLM analysis
            prompt = f"""You are TreasuryBalancer, an autonomous AI risk analyst for a DAO treasury that holds stablecoins (USDC, USDT, DAI).

TARGET STABLECOIN UNDER ANALYSIS: {asset_upper}
CURRENT TREASURY BALANCE OF {asset_upper}: ${current_balance:,} USD
AUTO-REBALANCE PANIC THRESHOLD: {threshold}/100

RISK DESCRIPTION PROVIDED:
{description}

NEWS ARTICLE / RISK REPORT:
{news_text}

FORUM / PEG TRACKING DATA:
{forum_text}

YOUR TASK:
Analyze the risk to {asset_upper} and determine if there is a genuine depeg risk.
CRITICAL INSTRUCTION: If the NEWS or FORUM text contains Cloudflare challenges, "Access Denied", or is unreachable, IGNORE the web text and base your decision ENTIRELY on the RISK DESCRIPTION PROVIDED.

Consider these factors:
- Is there verifiable evidence of a depeg event or reserve shortfall?
- Are multiple independent sources reporting the same concerns?
- What is the sentiment across DeFi forums and social media?
- Could this be FUD, temporary volatility, or genuine systemic risk?
- What is the probability of a sustained depeg (>1% deviation for >1 hour)?
- If panic_score >= {threshold}, recommend EMERGENCY_EXIT or REDUCE_EXPOSURE

Respond ONLY as JSON with this exact shape:
{{
  "risk_level": "CRITICAL" or "HIGH" or "MEDIUM" or "LOW" or "SAFE",
  "panic_score": integer from 0 to 100 (0=calm, 100=max panic),
  "depeg_probability": integer from 0 to 100 (probability of sustained depeg),
  "recommendation": "EMERGENCY_EXIT" or "REDUCE_EXPOSURE" or "MONITOR" or "HOLD" or "INCREASE",
  "analysis_summary": "2-3 sentence explanation of the risk assessment",
  "sentiment_indicators": "comma-separated list of sentiment signals detected"
}}"""

            result = gl.nondet.exec_prompt(prompt, response_format="json")
            if isinstance(result, str):
                result = json.loads(
                    result.replace("```json", "").replace("```", "").strip()
                )

            risk_level = str(result.get("risk_level", "SAFE")).upper()
            if risk_level not in ("CRITICAL", "HIGH", "MEDIUM", "LOW", "SAFE"):
                risk_level = "SAFE"
            panic_score = int(result.get("panic_score", 0))
            if panic_score < 0:
                panic_score = 0
            if panic_score > 100:
                panic_score = 100
            depeg_probability = int(result.get("depeg_probability", 0))
            if depeg_probability < 0:
                depeg_probability = 0
            if depeg_probability > 100:
                depeg_probability = 100
            recommendation = str(result.get("recommendation", "HOLD")).upper()
            if recommendation not in (
                "EMERGENCY_EXIT",
                "REDUCE_EXPOSURE",
                "MONITOR",
                "HOLD",
                "INCREASE",
            ):
                recommendation = "HOLD"

            # Determine rebalance action
            action_taken = "NO_ACTION"
            rebalance_amount = 0

            if panic_score >= threshold:
                if recommendation in ("EMERGENCY_EXIT", "REDUCE_EXPOSURE"):
                    action_taken = "REBALANCED"
                    if recommendation == "EMERGENCY_EXIT":
                        rebalance_amount = current_balance
                    else:
                        rebalance_amount = current_balance // 2
                else:
                    action_taken = "MONITORING"
            else:
                action_taken = "MONITORING" if risk_level in ("MEDIUM", "HIGH", "CRITICAL") else "NO_ACTION"

            return {
                "risk_level": risk_level,
                "panic_score": panic_score,
                "depeg_probability": depeg_probability,
                "recommendation": recommendation,
                "analysis_summary": str(result.get("analysis_summary", "")),
                "sentiment_indicators": str(
                    result.get("sentiment_indicators", "None")
                ),
                "action_taken": action_taken,
                "rebalanced_amount": rebalance_amount,
            }

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            my_result = leader_fn()
            leader_result = leaders_res.calldata

            # Must agree on action_taken (the most critical part for state change)
            if str(my_result["action_taken"]) != str(leader_result["action_taken"]):
                return False

            # Panic score within ±30 tolerance
            if (
                abs(
                    int(my_result["panic_score"])
                    - int(leader_result["panic_score"])
                )
                > 30
            ):
                return False

            return True

        verdict = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        # Execute auto-rebalance if needed (storage write OUTSIDE nondet block)
        rebalanced_amount = int(verdict["rebalanced_amount"])
        action = str(verdict["action_taken"])

        if action == "REBALANCED" and rebalanced_amount > 0:
            actual_amount = min(rebalanced_amount, current_balance)
            if actual_amount > 0:
                if asset_upper == "USDC":
                    self.usdc_balance = u32(int(self.usdc_balance) - actual_amount)
                elif asset_upper == "USDT":
                    self.usdt_balance = u32(int(self.usdt_balance) - actual_amount)
                elif asset_upper == "DAI":
                    self.dai_balance = u32(int(self.dai_balance) - actual_amount)
                self.safe_reserve = u32(int(self.safe_reserve) + actual_amount)
                rebalanced_amount = actual_amount

        # Update report with AI verdict
        self.reports[report_id] = RiskReport(
            report_id=report_id,
            analyst=gl.message.sender_address,
            target_asset=asset_upper,
            news_url=news_url,
            forum_url=forum_url,
            description=description,
            risk_level=str(verdict["risk_level"]),
            panic_score=u32(int(verdict["panic_score"])),
            depeg_probability=u32(int(verdict["depeg_probability"])),
            recommendation=str(verdict["recommendation"]),
            analysis_summary=str(verdict["analysis_summary"]),
            sentiment_indicators=str(verdict["sentiment_indicators"]),
            action_taken=action,
            rebalanced_amount=u32(rebalanced_amount),
        )

        return verdict

    # ──────────────────────────────────────────────
    #  VIEW FUNCTIONS
    # ──────────────────────────────────────────────

    @gl.public.view
    def get_allocations(self) -> dict[str, typing.Any]:
        usdc = int(self.usdc_balance)
        usdt = int(self.usdt_balance)
        dai = int(self.dai_balance)
        safe = int(self.safe_reserve)
        total = usdc + usdt + dai + safe
        return {
            "usdc": usdc,
            "usdt": usdt,
            "dai": dai,
            "safe_reserve": safe,
            "total_value": total,
            "risk_threshold": int(self.risk_threshold),
        }

    @gl.public.view
    def get_report(self, report_id: int) -> dict[str, typing.Any]:
        report = self.reports[u256(report_id)]
        return self._report_to_dict(report)

    @gl.public.view
    def get_report_count(self) -> u256:
        return self.next_report_id

    # ──────────────────────────────────────────────
    #  HELPERS
    # ──────────────────────────────────────────────

    def _report_to_dict(self, report: RiskReport) -> dict[str, typing.Any]:
        return {
            "report_id": int(report.report_id),
            "analyst": report.analyst,
            "target_asset": report.target_asset,
            "news_url": report.news_url,
            "forum_url": report.forum_url,
            "description": report.description,
            "risk_level": report.risk_level,
            "panic_score": int(report.panic_score),
            "depeg_probability": int(report.depeg_probability),
            "recommendation": report.recommendation,
            "analysis_summary": report.analysis_summary,
            "sentiment_indicators": report.sentiment_indicators,
            "action_taken": report.action_taken,
            "rebalanced_amount": int(report.rebalanced_amount),
        }
