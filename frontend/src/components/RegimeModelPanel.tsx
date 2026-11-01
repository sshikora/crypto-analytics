import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import { MetricCard, MetricInfo } from './MetricCard';
import { RegimeModel } from '../types/crypto';

interface RegimeModelPanelProps {
  model: RegimeModel;
}

const percent = (x: number) => `${Math.round(x * 100)}%`;

function formatDays(days: number): string {
  return days < 10 ? `${days.toFixed(1)} days` : `${Math.round(days)} days`;
}

export const RegimeModelPanel: React.FC<RegimeModelPanelProps> = ({ model }) => {
  const [calm, turbulent] = model.states;
  const info: MetricInfo = {
    model: 'Two-state Gaussian hidden Markov model, fitted by expectation-maximization',
    methodologyHref: '/methodology#hidden-markov',
    window: `${model.observations} daily returns up to ${model.asOf}, refitted nightly.`,
    assumptions: [
      'Each day belongs to one of two states, and each state has its own normal distribution of returns',
      'The next state depends only on the current one',
      'States are labelled by volatility, and say nothing about direction',
    ],
    validation:
      'The recursions match enumerating every state path, the fitting steps match hmmlearn, and the likelihood matches statsmodels.',
  };

  const heading = (
    <div>
      <h3 className="text-lg font-semibold">Regime Model: Hidden Markov</h3>
      <p className="text-sm text-gray-500">
        From daily closes up to {format(parseISO(model.asOf), 'MMM d, yyyy')}, fitted nightly in Python
      </p>
    </div>
  );
  const diagnostics = (
    <p className="text-xs text-gray-500">
      Log-likelihood {model.logLikelihood.toFixed(1)} · AIC {model.aic.toFixed(1)} · BIC {model.bic.toFixed(1)} on{' '}
      {model.observations} days (7 parameters) · one-state BIC {model.oneStateBic.toFixed(1)}
    </p>
  );

  if (!model.supported) {
    return (
      <div className="space-y-3">
        {heading}
        <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3">
          No evidence of two regimes here. Once the extra parameters are counted, a single normal distribution fits this
          coin's past year at least as well, so no state is shown.
        </p>
        {diagnostics}
      </div>
    );
  }

  const data = model.history.dates.map((date, i) => ({
    date,
    filtered: model.history.filtered[i],
    smoothed: model.history.smoothed[i],
  }));

  return (
    <div className="space-y-4">
      {heading}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Turbulent Now"
          value={percent(model.turbulentProbability)}
          description="Chance the latest day was in the turbulent state, given the returns so far."
          info={info}
          valueClassName="text-orange-600"
        />
        <MetricCard
          label="Turbulent Tomorrow"
          value={percent(model.nextDayTurbulentProbability)}
          description="The same chance one day ahead, from today's state and how states switch."
          info={info}
        />
        <MetricCard
          label="Calm State"
          value={`${(calm.annualizedVolatility * 100).toFixed(0)}% vol`}
          description={`Lasts about ${formatDays(calm.expectedDays)} once entered. About ${percent(calm.longRunShare)} of days in the long run.`}
          info={info}
          valueClassName="text-blue-600"
        />
        <MetricCard
          label="Turbulent State"
          value={`${(turbulent.annualizedVolatility * 100).toFixed(0)}% vol`}
          description={`Lasts about ${formatDays(turbulent.expectedDays)} once entered. About ${percent(turbulent.longRunShare)} of days in the long run.`}
          info={info}
          valueClassName="text-orange-600"
        />
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">
          Chance of the turbulent state each day. The shaded area uses only returns up to that day. The thin line also
          uses later returns, so it is sharper but could not have been known at the time.
        </p>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tickFormatter={d => format(parseISO(d), 'MMM d')} stroke="#6b7280" fontSize={12} minTickGap={24} />
              <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={v => percent(v)} stroke="#6b7280" fontSize={12} />
              <Tooltip
                formatter={(value: number, name: string) => [percent(value), name === 'filtered' ? 'Known at the time' : 'With later data']}
                labelFormatter={d => format(parseISO(d as string), 'MMM d, yyyy')}
              />
              <Area type="linear" dataKey="filtered" stroke="#f97316" fill="#fed7aa" strokeWidth={1} isAnimationActive={false} />
              <Line type="linear" dataKey="smoothed" stroke="#374151" strokeWidth={1} strokeOpacity={0.6} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {diagnostics}
    </div>
  );
};
