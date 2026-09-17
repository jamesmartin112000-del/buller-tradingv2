import { useState, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Text,
  Title } from
'@mantine/core';
import {
  AlertTriangleIcon,
  Clock3Icon,
  DatabaseIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  ScanSearchIcon } from
'lucide-react';
import { useSmtScanner } from '../hooks/useSmtScanner';
import { SmtDataHealth } from './dashboard/smt/SmtDataHealth';
import { SmtSignalBanner } from './dashboard/smt/SmtSignalBanner';
import { SmtTimeframeCard } from './dashboard/smt/SmtTimeframeCard';

export function SmtDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { data, isLoading, error, lastUpdated, refresh, clearCache } =
  useSmtScanner({ autoRefresh, refreshIntervalMs: 120_000 });

  const handleClearCache = () => {
    clearCache();
    void refresh();
  };

  if (isLoading && !data) return <SmtDashboardSkeleton />;

  return (
    <Box
      component="main"
      w="100%"
      mih="100%"
      px={{ base: 12, md: 16 }}
      py={{ base: 12, md: 16 }}
      style={{ background: 'var(--bg)' }}>
      
      <Stack gap="md" maw={1600} mx="auto">
        <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
          <div>
            <Group gap="xs" mb={4} wrap="wrap">
              <ScanSearchIcon size={22} color="var(--brand)" aria-hidden />
              <Title order={1} size="h3" fw={800}>
                Gold / DXY SMT Scanner
              </Title>
              <Badge variant="light" color="red">Institutional</Badge>
            </Group>
            <Text size="xs" c="dimmed" maw={720}>
              Multi-timeframe swing divergence and inverse-correlation analysis using Gold spot and the ICE U.S. Dollar Index.
            </Text>
          </div>

          <Group gap="sm" align="center" wrap="wrap">
            <Switch
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.currentTarget.checked)}
              label="Auto-refresh"
              color="red"
              size="sm"
              aria-label="Toggle automatic scan refresh" />
            
            <Button
              variant="default"
              size="xs"
              leftSection={<RotateCcwIcon size={14} aria-hidden />}
              onClick={handleClearCache}
              disabled={isLoading}>
              
              Reset cache
            </Button>
            <Button
              color="red"
              size="xs"
              leftSection={
              <RefreshCwIcon
                size={14}
                className={isLoading ? 'animate-spin motion-reduce:animate-none' : ''}
                aria-hidden />

              }
              onClick={() => void refresh()}
              loading={isLoading}>
              
              Refresh scan
            </Button>
          </Group>
        </Group>

        <Card
          padding="sm"
          radius="md"
          withBorder
          style={{ background: 'var(--bg3)', borderColor: 'var(--border)' }}>
          
          <Group justify="space-between" gap="md" wrap="wrap">
            <Group gap="lg" wrap="wrap">
              <StatusItem icon={<DatabaseIcon size={14} />} label="Gold" value="XAUUSD=X" />
              <StatusItem icon={<DatabaseIcon size={14} />} label="Dollar index" value="DX-Y.NYB" />
              <StatusItem icon={<Clock3Icon size={14} />} label="Refresh cycle" value={autoRefresh ? '2 minutes' : 'Manual'} />
            </Group>
            <Text size="xs" c="dimmed" ff="monospace">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Waiting for first scan'}
            </Text>
          </Group>
        </Card>

        {error &&
        <Alert
          role="alert"
          color="red"
          variant="light"
          title={data ? 'Feed warning' : 'Scanner unavailable'}
          icon={<AlertTriangleIcon size={18} aria-hidden />}>
          
            {error}{' '}
            {data && 'The last completed scan remains visible.'}
          </Alert>
        }

        {isLoading && data &&
        <Alert color="yellow" variant="light" role="status" aria-live="polite">
            Refreshing Gold and DXY candles. Current verified results remain visible.
          </Alert>
        }

        {data ?
        <>
            <SmtSignalBanner summary={data.summary} />
            <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="sm">
              {Object.values(data.timeframes).map((result) =>
            <SmtTimeframeCard key={result.timeframe} result={result} />
            )}
            </SimpleGrid>
            <SmtDataHealth summary={data.summary} />
            <Text size="xs" c="dimmed" ta="center">
              SMT output is probabilistic market analysis, not financial advice. Confirm with structure, liquidity, and risk controls before acting.
            </Text>
          </> :

        <Card padding="xl" withBorder style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <Stack align="center" gap="sm">
              <AlertTriangleIcon size={26} color="var(--warn)" aria-hidden />
              <Text fw={700}>No verified scan is available yet.</Text>
              <Text size="sm" c="dimmed" ta="center">Check the market-data connection and retry the scan.</Text>
              <Button color="red" onClick={() => void refresh()}>Retry scan</Button>
            </Stack>
          </Card>
        }
      </Stack>
    </Box>);

}

function StatusItem({
  icon,
  label,
  value




}: {icon: ReactNode;label: string;value: string;}) {
  return (
    <Group gap={7} wrap="nowrap">
      <span style={{ color: 'var(--text2)' }} aria-hidden>{icon}</span>
      <div>
        <Text size="xs" c="dimmed" lh={1.2}>{label}</Text>
        <Text size="xs" fw={700} ff="monospace">{value}</Text>
      </div>
    </Group>);

}

function SmtDashboardSkeleton() {
  return (
    <Box component="main" w="100%" mih="100%" p={{ base: 12, md: 16 }} style={{ background: 'var(--bg)' }}>
      <Stack gap="md" maw={1600} mx="auto" role="status" aria-label="Loading SMT scanner">
        <Group justify="space-between">
          <Stack gap={8} style={{ flex: 1 }}>
            <Skeleton height={28} width="38%" />
            <Skeleton height={12} width="62%" />
          </Stack>
          <Skeleton height={32} width={180} />
        </Group>
        <Skeleton height={104} radius="md" />
        <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="sm">
          {Array.from({ length: 6 }).map((_, index) =>
          <Skeleton key={index} height={220} radius="md" />
          )}
        </SimpleGrid>
      </Stack>
    </Box>);

}