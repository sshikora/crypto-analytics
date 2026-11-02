import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import numpy as np
import pytest

from cql_batch import fit_regimes

NOW = datetime(2026, 11, 1, 1, 30, tzinfo=timezone.utc)


def closes(n: int, seed: int = 0, calm: float = 0.01, turbulent: float = 0.06) -> tuple[list[str], list[float]]:
    """Alternating 40-day calm and turbulent spells, so two states clearly fit."""
    rng = np.random.default_rng(seed)
    sds = np.where((np.arange(n) // 40) % 2 == 0, calm, turbulent)
    prices = 100 * np.exp(np.cumsum(rng.normal(0, sds)))
    dates = [(NOW - timedelta(days=n - i)).strftime("%Y-%m-%d") for i in range(n)]
    return dates, [float(p) for p in prices]


class PriceTable:
    def __init__(self, coins: dict[str, tuple[list[str], list[float]]], page_size: int = 1000):
        self.coins = coins
        self.page_size = page_size
        self.queries: list[dict] = []

    def query(self, **kwargs):
        self.queries.append(kwargs)
        values = kwargs["ExpressionAttributeValues"]
        dates, prices = self.coins[values[":coin"]]
        rows = [{"date": d, "price": Decimal(str(p))} for d, p in zip(dates, prices) if d >= values[":start"]]
        offset = kwargs.get("ExclusiveStartKey", {}).get("offset", 0)
        page = {"Items": rows[offset : offset + self.page_size]}
        if offset + self.page_size < len(rows):
            page["LastEvaluatedKey"] = {"offset": offset + self.page_size}
        return page


class MetricsTable:
    def __init__(self, coins: list[str] | None):
        self.coins = coins
        self.written: list[dict] = []

    def query(self, **kwargs):
        if self.coins is None:
            return {"Items": []}
        assert kwargs["ExpressionAttributeValues"][":key"] == "__market__"
        assert kwargs["ScanIndexForward"] is False
        return {"Items": [{"rows": [{"coinId": c} for c in self.coins]}]}

    def put_item(self, Item):
        self.written.append(Item)


def model_for(n: int = 300, **kwargs) -> dict:
    dates, prices = closes(n, **kwargs)
    return fit_regimes.regime_model("bitcoin", dates, np.array(prices))


def test_stored_result_describes_both_states():
    model = model_for()

    assert model["asOf"] == closes(300)[0][-1]
    assert model["observations"] == 299
    assert [s["name"] for s in model["states"]] == ["calm", "turbulent"]
    assert model["states"][0]["annualizedVolatility"] < model["states"][1]["annualizedVolatility"]
    assert model["states"][0]["expectedDays"] == pytest.approx(1 / (1 - model["states"][0]["stayProbability"]))
    assert sum(s["longRunShare"] for s in model["states"]) == pytest.approx(1)
    assert model["supported"] is True
    assert model["bic"] < model["oneStateBic"]


def test_history_is_dated_by_return_and_uses_the_filtered_probability_for_today():
    dates, prices = closes(300)
    model = fit_regimes.regime_model("bitcoin", dates, np.array(prices))

    assert model["history"]["dates"] == dates[1:]
    assert len(model["history"]["filtered"]) == len(model["history"]["smoothed"]) == 299
    assert model["history"]["filtered"][-1] == round(model["turbulentProbability"], 4)
    assert 0 <= model["nextDayTurbulentProbability"] <= 1


def test_a_series_with_no_second_state_is_not_supported():
    dates = closes(300)[0]
    prices = 100 * np.exp(np.cumsum(np.random.default_rng(3).normal(0, 0.03, 300)))
    assert fit_regimes.regime_model("x", dates, prices)["supported"] is False


def test_one_state_bic_is_the_normal_likelihood_with_two_parameters():
    returns = np.array([0.01, -0.02, 0.03, 0.0])
    n = len(returns)
    log_likelihood = -0.5 * n * (np.log(2 * np.pi * returns.var()) + 1)
    assert fit_regimes.one_state_bic(returns) == pytest.approx(2 * np.log(n) - 2 * log_likelihood)


def test_too_little_history_and_a_flat_price_get_a_reason():
    dates, prices = closes(201)
    assert isinstance(fit_regimes.regime_model("x", dates, np.array(prices)), dict)
    assert fit_regimes.regime_model("x", dates[:200], np.array(prices[:200])) == "too little history"
    assert fit_regimes.regime_model("x", *(closes(300)[0], np.ones(300))) == "flat price"


def test_a_fit_that_did_not_converge_is_not_stored(monkeypatch):
    dates, prices = closes(300)
    fit = fit_regimes.hmm.fit_hmm(np.diff(np.log(prices)), starts=1)
    fit.converged = False
    monkeypatch.setattr(fit_regimes.hmm, "fit_hmm", lambda _: fit)
    assert fit_regimes.regime_model("x", dates, np.array(prices)) == "did not converge"


def test_run_stores_a_row_per_coin_under_its_own_key():
    prices = PriceTable({"bitcoin": closes(300), "new-coin": closes(30)})
    metrics = MetricsTable(["bitcoin", "new-coin"])

    summary = fit_regimes.run(prices, metrics, NOW)

    assert (summary.coins, summary.written, summary.skipped, summary.failed) == (2, 1, {"new-coin": "too little history"}, [])
    row = metrics.written[0]
    assert row["coinId"] == "__hmm__bitcoin"
    assert row["date"] == closes(300)[0][-1]
    assert row["computedAt"] == NOW.isoformat()
    assert json.loads(row["regimeModel"])["coinId"] == "bitcoin"


def test_only_the_last_year_is_read_and_all_pages_are_followed():
    dates, prices = closes(500)
    table = PriceTable({"bitcoin": (dates, prices)}, page_size=100)

    loaded, values = fit_regimes.load_prices(table, "bitcoin", "2025-11-01")

    assert loaded[0] == "2025-11-01"
    assert len(loaded) == len(values) == 365
    assert len(table.queries) == 4


def test_one_coin_failing_does_not_stop_the_others():
    prices = PriceTable({"bitcoin": closes(300)})  # the other coin raises KeyError
    summary = fit_regimes.run(prices, MetricsTable(["missing", "bitcoin"]), NOW)
    assert summary.failed == ["missing"]
    assert summary.written == 1


def test_a_missing_snapshot_is_an_error_rather_than_an_empty_run():
    with pytest.raises(RuntimeError, match="compute-metrics"):
        fit_regimes.run(PriceTable({}), MetricsTable(None), NOW)


def test_job_reports_failure_when_too_many_coins_fail(monkeypatch, capsys):
    summary = fit_regimes.Summary(coins=10, written=8, failed=["a", "b"])
    monkeypatch.setenv("DYNAMODB_PRICE_HISTORY_TABLE", "p")
    monkeypatch.setenv("DYNAMODB_COIN_METRICS_TABLE", "m")
    monkeypatch.setattr(fit_regimes.boto3, "resource", lambda *a, **k: type("R", (), {"Table": lambda self, n: n})())
    monkeypatch.setattr(fit_regimes, "run", lambda *a: summary)

    assert fit_regimes.main() == 1
    assert json.loads(capsys.readouterr().out)["event"] == "job_failed"

    summary.failed = ["a"]
    assert fit_regimes.main() == 0
    assert json.loads(capsys.readouterr().out) == {
        "event": "job_succeeded",
        "job": "fit-regimes",
        "coins": 10,
        "written": 8,
        "skipped": {},
        "failed": ["a"],
    }


def test_job_failure_before_any_coin_is_logged_as_failed(monkeypatch, capsys):
    monkeypatch.setenv("DYNAMODB_PRICE_HISTORY_TABLE", "p")
    monkeypatch.setenv("DYNAMODB_COIN_METRICS_TABLE", "m")

    def boom(*_args):
        raise RuntimeError("no snapshot")

    monkeypatch.setattr(fit_regimes.boto3, "resource", lambda *a, **k: type("R", (), {"Table": lambda self, n: n})())
    monkeypatch.setattr(fit_regimes, "run", boom)

    assert fit_regimes.main() == 1
    assert json.loads(capsys.readouterr().out)["event"] == "job_failed"
