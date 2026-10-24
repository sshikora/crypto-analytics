export const DISCLAIMER_TEXT =
  'For information and education only. CryptoQuantLab is not investment advice and does not recommend buying or selling any asset. Models are estimates from past prices and can be wrong.';

interface DisclaimerProps {
  className?: string;
}

export const Disclaimer: React.FC<DisclaimerProps> = ({ className = '' }) => (
  <p role="note" className={`text-xs text-gray-500 ${className}`}>
    {DISCLAIMER_TEXT}
  </p>
);
