import React from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Select,
  Text,
  TextInput,
  ThemeIcon } from
'@mantine/core';
import {
  BitcoinIcon,
  Clock3Icon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon } from
'lucide-react';
import { cryptoPairLabel } from './cryptoMarketData';
import type { CryptoPanelStatus } from '../CryptoInstitutionalMaster';
interface CryptoMasterHeaderProps {
  selectedPair: string;
  activePairs: string[];
  customPair: string;
  customPairError: string | null;
  countdown: number;
  status: CryptoPanelStatus;
  loading: boolean;
  resetting: boolean;
  onPairChange: (pair: string) => void;
  onCustomPairChange: (pair: string) => void;
  onCustomPairSubmit: (event: React.FormEvent) => void;
  onRefresh: () => void;
  onReset: () => void;
}
const PRIMARY_PAIRS = [
'BTCUSDT',
'ETHUSDT',
'SOLUSDT',
'BNBUSDT',
'XRPUSDT',
'ADAUSDT',
'DOGEUSDT',
'DOTUSDT',
'LINKUSDT',
'AVAXUSDT',
'POLUSDT',
'ATOMUSDT',
'UNIUSDT',
'ARBUSDT',
'OPUSDT',
'INJUSDT',
'NEARUSDT',
'APTUSDT',
'SUIUSDT',
'TIAUSDT',
'FETUSDT',
'RENDERUSDT',
'TAOUSDT',
'SEIUSDT'];

export function CryptoMasterHeader({
  selectedPair,
  activePairs,
  customPair,
  customPairError,
  countdown,
  status,
  loading,
  resetting,
  onPairChange,
  onCustomPairChange,
  onCustomPairSubmit,
  onRefresh,
  onReset
}: CryptoMasterHeaderProps) {
  return (
    <>
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Box>
          <Group gap="xs" wrap="wrap">
            <ThemeIcon variant="light" color="yellow" size="sm">
              <BitcoinIcon size={15} aria-hidden="true" />
            </ThemeIcon>
            <Text
              component="h2"
              id="crypto-master-heading"
              fw={800}
              size="sm"
              c="#ffd700">
              
              CRYPTO Institutional Master
            </Text>
            <Badge color="yellow" variant="light" size="xs">
              {cryptoPairLabel(selectedPair)}
            </Badge>
            <StatusBadge status={status} />
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            BTC-first · active Binance USDT spot pairs · ten transparent
            weighted engines
          </Text>
        </Box>

        <Group gap="xs" wrap="wrap">
          <Select
            aria-label="Select active Binance USDT spot pair"
            size="xs"
            searchable
            value={selectedPair}
            data={buildPairOptions(activePairs, selectedPair)}
            onChange={(value) => value && onPairChange(value)}
            allowDeselect={false}
            w={175}
            nothingFoundMessage="Use custom pair validation"
            styles={{
              input: {
                backgroundColor: 'rgba(255,255,255,0.035)',
                borderColor: 'rgba(255,215,0,0.18)',
                color: '#eeeeee'
              },
              dropdown: {
                backgroundColor: '#0b0b14',
                borderColor: 'rgba(255,215,0,0.18)'
              }
            }} />
          
          <Group gap={5} className="font-mono text-ink-muted">
            <Clock3Icon size={12} aria-hidden="true" />
            <Text size="xs" c="dimmed">
              {countdown}s
            </Text>
          </Group>
          <Button
            size="compact-xs"
            color="yellow"
            variant="light"
            leftSection={
            loading ?
            <Loader2Icon size={14} className="animate-spin" /> :

            <RefreshCwIcon size={14} />

            }
            onClick={onRefresh}
            disabled={loading || resetting}>
            
            Refresh
          </Button>
          <Button
            size="compact-xs"
            color="red"
            variant="subtle"
            leftSection={<RotateCcwIcon size={14} />}
            onClick={onReset}
            disabled={resetting}>
            
            Reset
          </Button>
        </Group>
      </Group>

      <Box
        component="form"
        onSubmit={onCustomPairSubmit}
        aria-label="Analyze custom Binance pair">
        
        <Group gap="xs" align="flex-end">
          <TextInput
            label="Custom active USDT spot pair"
            description="Inputs like BTC/USDT normalize to BTCUSDT"
            placeholder="e.g. PEPE/USDT"
            value={customPair}
            error={customPairError || undefined}
            onChange={(event) => onCustomPairChange(event.currentTarget.value)}
            size="xs"
            flex={1}
            styles={{
              input: {
                backgroundColor: 'rgba(255,255,255,0.025)',
                borderColor: customPairError ?
                'rgba(255,68,68,0.65)' :
                'rgba(255,255,255,0.1)',
                color: '#eeeeee'
              }
            }} />
          
          <Button
            type="submit"
            size="xs"
            color="yellow"
            variant="outline"
            leftSection={<PlusIcon size={13} />}
            disabled={!customPair.trim() || loading || resetting}>
            
            Analyze pair
          </Button>
        </Group>
      </Box>
    </>);

}
function StatusBadge({ status }: {status: CryptoPanelStatus;}) {
  const meta: Record<
    CryptoPanelStatus,
    {
      color: string;
      label: string;
    }> =
  {
    initializing: {
      color: 'yellow',
      label: 'Initializing'
    },
    fetching: {
      color: 'yellow',
      label: 'Fetching Binance'
    },
    live: {
      color: 'green',
      label: 'Live · Binance'
    },
    error: {
      color: 'red',
      label: 'Pair / feed error'
    },
    reset: {
      color: 'gray',
      label: 'Reset'
    }
  };
  return (
    <Badge
      size="xs"
      color={meta[status].color}
      variant="light"
      leftSection={
      status === 'fetching' ?
      <Loader size={8} color="yellow" /> :

      <span className="block h-1.5 w-1.5 rounded-full bg-current" />

      }>
      
      {meta[status].label}
    </Badge>);

}
function buildPairOptions(
activePairs: string[],
selectedPair: string)
: Array<{
  value: string;
  label: string;
}> {
  const verifiedPrimary = activePairs.length ?
  PRIMARY_PAIRS.filter((pair) => activePairs.includes(pair)) :
  PRIMARY_PAIRS;
  const remaining = activePairs.filter(
    (pair) => !verifiedPrimary.includes(pair)
  );
  return Array.from(
    new Set([...verifiedPrimary, ...remaining, selectedPair])
  ).map((pair) => ({
    value: pair,
    label:
    pair === 'BTCUSDT' ?
    `${cryptoPairLabel(pair)} · PRIMARY` :
    cryptoPairLabel(pair)
  }));
}