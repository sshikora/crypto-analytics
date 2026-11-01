"""Nightly job: fits the two-state HMM for each top-100 coin and stores the result in coin-metrics.

    python -m cql_batch.fit_regimes

Runs after compute-metrics, whose Markets snapshot supplies the coin list, so this job needs no CoinGecko key.
"""

import json
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

import boto3
import numpy as np

from . import hmm

HISTORY_DAYS = 365
MIN_RETURNS = 200
MIN_VOLATILITY = 1e-9
DAYS_PER_YEAR = 365.25
# A run with more failed coins than this is treated as a failed job
MAX_FAILED_FRACTION = 0.1

MARKET_KEY = "__market__"
# Coin ids have no underscores, so these rows can never collide with a coin's own
ROW_PREFIX = "__hmm__"
STATE_NAMES = ("calm", "turbulent")


@dataclass
class Summary:
    coins: int = 0
    written: int = 0
    skipped: dict[str, str] = field(default_factory=dict)
    failed: list[str] = field(default_factory=list)


def one_state_bic(returns: np.ndarray) -> float:
    n = len(returns)
    log_likelihood = -0.5 * n * (np.log(2 * np.pi * returns.var()) + 1)
    return 2 * np.log(n) - 2 * log_likelihood


def _rounded(values: np.ndarray) -> list[float]:
    return [round(float(v), 4) for v in values]


def regime_model(coin_id: str, dates: list[str], prices: np.ndarray) -> dict[str, Any] | str:
    """The stored result, or the reason this coin has none."""
    returns = np.diff(np.log(prices))
    if len(returns) < MIN_RETURNS:
        return "too little history"
    if returns.std(ddof=1) < MIN_VOLATILITY:
        return "flat price"

    fit = hmm.fit_hmm(returns)
    if not fit.converged:
        return "did not converge"

    n = len(returns)
    durations = hmm.expected_duration(fit.transition)
    stationary = hmm.stationary_distribution(fit.transition)
    next_day = fit.filtered[-1] @ fit.transition
    return {
        "coinId": coin_id,
        "asOf": dates[-1],
        "observations": n,
        "logLikelihood": fit.log_likelihood,
        "aic": fit.aic(),
        "bic": fit.bic(n),
        "oneStateBic": one_state_bic(returns),
        "supported": bool(fit.bic(n) < one_state_bic(returns)),
        "states": [
            {
                "name": STATE_NAMES[i],
                "dailyMean": float(fit.means[i]),
                "annualizedVolatility": float(np.sqrt(fit.variances[i] * DAYS_PER_YEAR)),
                "stayProbability": float(fit.transition[i, i]),
                "expectedDays": float(durations[i]),
                "longRunShare": float(stationary[i]),
            }
            for i in range(2)
        ],
        "turbulentProbability": float(fit.filtered[-1, 1]),
        "nextDayTurbulentProbability": float(next_day[1]),
        "history": {
            "dates": dates[1:],
            "filtered": _rounded(fit.filtered[:, 1]),
            "smoothed": _rounded(fit.smoothed[:, 1]),
        },
    }


def universe(metrics_table: Any) -> list[str]:
    response = metrics_table.query(
        KeyConditionExpression="coinId = :key",
        ExpressionAttributeValues={":key": MARKET_KEY},
        ScanIndexForward=False,
        Limit=1,
    )
    if not response["Items"]:
        raise RuntimeError("no Markets snapshot; compute-metrics has not run")
    return [row["coinId"] for row in response["Items"][0]["rows"]]


def load_prices(price_table: Any, coin_id: str, start: str) -> tuple[list[str], np.ndarray]:
    query = {
        "KeyConditionExpression": "coinId = :coin AND #date >= :start",
        "ExpressionAttributeNames": {"#date": "date"},
        "ExpressionAttributeValues": {":coin": coin_id, ":start": start},
        "ProjectionExpression": "#date, price",
    }
    items: list[dict] = []
    while True:
        response = price_table.query(**query)
        items.extend(response["Items"])
        if "LastEvaluatedKey" not in response:
            return [i["date"] for i in items], np.array([float(i["price"]) for i in items])
        query["ExclusiveStartKey"] = response["LastEvaluatedKey"]


def run(price_table: Any, metrics_table: Any, now: datetime) -> Summary:
    coins = universe(metrics_table)
    start = (now - timedelta(days=HISTORY_DAYS)).strftime("%Y-%m-%d")
    computed_at = now.isoformat()
    summary = Summary(coins=len(coins))

    for coin_id in coins:
        try:
            dates, prices = load_prices(price_table, coin_id, start)
            model = regime_model(coin_id, dates, prices)
            if isinstance(model, str):
                summary.skipped[coin_id] = model
                continue
            # Numbers are stored as JSON because the DynamoDB client rejects floats, and one attribute holds the
            # whole result for the API to read back; a rerun on the same day replaces the row
            metrics_table.put_item(
                Item={
                    "coinId": ROW_PREFIX + coin_id,
                    "date": model["asOf"],
                    "computedAt": computed_at,
                    "regimeModel": json.dumps(model, separators=(",", ":")),
                }
            )
            summary.written += 1
        except Exception as error:  # one coin's failure must not lose the others
            print(f"[fit-regimes] {coin_id} failed: {error}", file=sys.stderr)
            summary.failed.append(coin_id)

    return summary


def main() -> int:
    job = {"job": "fit-regimes"}
    try:
        dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        summary = run(
            dynamodb.Table(os.environ["DYNAMODB_PRICE_HISTORY_TABLE"]),
            dynamodb.Table(os.environ["DYNAMODB_COIN_METRICS_TABLE"]),
            datetime.now(timezone.utc),
        )
    except Exception as error:
        print(json.dumps({"event": "job_failed", **job, "error": repr(error)}))
        return 1

    succeeded = len(summary.failed) <= summary.coins * MAX_FAILED_FRACTION
    # The log metric filter that backs the missed-run alarm matches on this line
    print(json.dumps({"event": "job_succeeded" if succeeded else "job_failed", **job, **summary.__dict__}))
    return 0 if succeeded else 1


if __name__ == "__main__":
    sys.exit(main())
