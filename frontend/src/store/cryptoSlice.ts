import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Cryptocurrency, TimeRange } from '../types/crypto';

interface CryptoState {
  cryptocurrencies: Cryptocurrency[];
  selectedCrypto: Cryptocurrency | null;
  selectedTimeRange: TimeRange;
  loading: boolean;
  error: string | null;
}

const initialState: CryptoState = {
  cryptocurrencies: [],
  selectedCrypto: null,
  selectedTimeRange: TimeRange.DAY,
  loading: false,
  error: null,
};

const cryptoSlice = createSlice({
  name: 'crypto',
  initialState,
  reducers: {
    setCryptocurrencies: (state, action: PayloadAction<Cryptocurrency[]>) => {
      state.cryptocurrencies = action.payload;
    },
    setSelectedCrypto: (state, action: PayloadAction<Cryptocurrency | null>) => {
      state.selectedCrypto = action.payload;
    },
    setSelectedTimeRange: (state, action: PayloadAction<TimeRange>) => {
      state.selectedTimeRange = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setCryptocurrencies,
  setSelectedCrypto,
  setSelectedTimeRange,
  setLoading,
  setError,
} = cryptoSlice.actions;

export default cryptoSlice.reducer;
