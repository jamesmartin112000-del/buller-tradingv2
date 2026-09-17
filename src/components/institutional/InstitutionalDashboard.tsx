import { useState } from "react";
import { Alert, Box, Button, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { motion, useReducedMotion } from "framer-motion";
import { ActivityIcon, AlertTriangleIcon, Clock3Icon, DatabaseIcon, GaugeIcon, RefreshCwIcon, ScanLineIcon, ShieldCheckIcon, WavesIcon, BoxIcon } from "lucide-react";
import { useInstitutionalDashboard } from "../../hooks/useInstitutionalDashboard";
import { InstitutionalTimeframe } from "../../lib/institutional/types";
import { BigTradePanel } from "./BigTradePanel";
import { DomPanel } from "./DomPanel";
import { FootprintPanel } from "./FootprintPanel";
import { SignalPanel } from "./SignalPanel";
import { TradePlan } from "./TradePlan";
import { VolumeProfilePanel } from "./VolumeProfilePanel";
const TIMEFRAMES: InstitutionalTimeframe[] = ['15m', '1h', '4h', '1d'];
export function InstitutionalDashboard() {
  const [timeframe, setTimeframe] = useState<InstitutionalTimeframe>('1h');
  const dashboard = useInstitutionalDashboard(timeframe, true, 120_000);
  const {
    signal,
    allAnalyses
  } = dashboard;
  const alignedSniper = signal && allAnalyses.sniper?.direction === signal.direction ? allAnalyses.sniper : null;
  return <Box component="section" aria-labelledby="institutional-engine-title" className="rounded-md border border-line-strong bg-bg-800 p-2.5 sm:p-3">
      <Group justify="space-between" align="flex-start" gap="md" mb="md" wrap="wrap">
        <Group gap={9} align="flex-start">
          <Box className="rounded-md border border-gold/30 bg-gold/10 p-2">
            <ScanLineIcon size={18} className="text-gold" aria-hidden="true" />
          </Box>
          <div>
            <Text id="institutional-engine-title" component="h2" fw={800} c="white" className="text-base sm:text-lg">
              Institutional Order Flow Engine
            </Text>
            <Text size="10px" c="dimmed" mt={2}>
              Volume profile, delta footprint, modeled DOM and 15-step confluence for XAUUSD
            </Text>
          </div>
        </Group>
        <Group gap={6} wrap="wrap">
          <Group gap={3} role="group" aria-label="Analysis timeframe">
            {TIMEFRAMES.map((item) => <Button key={item} size="compact-xs" variant={timeframe === item ? 'filled' : 'subtle'} color={timeframe === item ? 'yellow' : 'gray'} onClick={() => setTimeframe(item)} aria-pressed={timeframe === item}>
                {item}
              </Button>)}
          </Group>
          <Button size="compact-sm" variant="default" leftSection={<RefreshCwIcon size={13} className={dashboard.isLoading ? 'animate-spin' : ''} />} onClick={dashboard.refresh} disabled={dashboard.isLoading}>
            {dashboard.isLoading ? 'Scanning' : 'Refresh'}
          </Button>
        </Group>
      </Group>

      {dashboard.error && <Alert mb="sm" color="red" variant="light" icon={<AlertTriangleIcon size={15} />} title="Market data warning">
          <Text size="xs">{dashboard.error}</Text>
        </Alert>}

      {!signal && dashboard.isLoading ? <LoadingGrid /> : signal ? <Stack gap="sm">
          <SignalPanel signal={signal} formula={allAnalyses.formula} />
          <TradePlan signal={signal} sniper={alignedSniper} />
          <SimpleGrid cols={{
        base: 2,
        sm: 4,
        xl: 8
      }} spacing={8}>
            <Metric icon={GaugeIcon} label="Formula" value={`${allAnalyses.formula?.totalScore ?? 0}/300`} tone="#ffab00" />
            <Metric icon={ShieldCheckIcon} label="Confidence" value={`${signal.confidence}%`} tone={signal.confidence >= 70 ? '#00c853' : '#ffab00'} />
            <Metric icon={BoxIcon} label="Profile" value={allAnalyses.volumeProfile?.sessionType ?? 'N/A'} />
            <Metric icon={ActivityIcon} label="Delta" value={allAnalyses.delta?.deltaFlip ? `Flip ${allAnalyses.delta.flipDirection}` : 'Stable'} tone={allAnalyses.delta?.deltaFlip ? '#00c853' : undefined} />
            <Metric icon={WavesIcon} label="DOM" value={allAnalyses.dom?.absorption ? 'Absorption' : allAnalyses.dom?.stackedBook ? 'Stacked' : 'Balanced'} />
            <Metric icon={DatabaseIcon} label="Whale bias" value={allAnalyses.whale?.whaleBias ?? 'Neutral'} tone={allAnalyses.whale?.whaleBias === 'bullish' ? '#00c853' : allAnalyses.whale?.whaleBias === 'bearish' ? '#ff1744' : undefined} />
            <Metric icon={ActivityIcon} label="VI absorption" value={`${allAnalyses.vi?.absorption ?? 0}%`} />
            <Metric icon={Clock3Icon} label="Sniper" value={alignedSniper ? 'Ready' : 'Waiting'} tone={alignedSniper ? '#00c853' : undefined} />
          </SimpleGrid>

          {allAnalyses.dom && allAnalyses.delta && allAnalyses.volumeProfile && allAnalyses.whale && <SimpleGrid cols={{
        base: 1,
        md: 2,
        xl: 4
      }} spacing="sm">
              <DomPanel analysis={allAnalyses.dom} />
              <FootprintPanel footprints={allAnalyses.footprints} delta={allAnalyses.delta} />
              <VolumeProfilePanel profile={allAnalyses.volumeProfile} />
              <BigTradePanel analysis={allAnalyses.whale} />
            </SimpleGrid>}

          <Box className="rounded-md border border-line bg-bg-600 p-3">
            <Group justify="space-between" mb="sm" gap="sm" wrap="wrap">
              <Text component="h3" size="10px" tt="uppercase" fw={700} lts="0.12em" c="dimmed">
                15-step analysis summary
              </Text>
              <Text ff="monospace" size="10px" c="dimmed">
                {signal.analysis.confluenceCount} weighted signals
              </Text>
            </Group>
            <SimpleGrid cols={{
          base: 1,
          sm: 2,
          lg: 4
        }} spacing={8}>
              <Summary label="Trend" value={signal.analysis.trend} />
              <Summary label="Session" value={signal.analysis.session} />
              <Summary label="Delta" value={signal.analysis.deltaStatus} />
              <Summary label="DOM" value={signal.analysis.domStatus} />
            </SimpleGrid>
            {signal.reasons.length > 0 && <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {signal.reasons.map((reason) => <Group key={reason} gap={6} wrap="nowrap" className="rounded-sm border border-line bg-bg-800 px-2 py-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                    <Text size="10px" c="dimmed">{reason}</Text>
                  </Group>)}
              </div>}
          </Box>

          {(dashboard.warnings.length > 0 || dashboard.source) && <Box className="rounded-md border border-line bg-bg-900 px-3 py-2">
              <Group justify="space-between" gap="sm" wrap="wrap">
                <Text size="9px" c="dimmed">
                  Source: {dashboard.source?.label ?? 'Unavailable'} · {dashboard.goldCandles.length} Gold candles · {dashboard.dxyCandles.length} DXY candles
                </Text>
                <Text size="9px" ff="monospace" c="dimmed">
                  Updated {dashboard.lastUpdated ? new Date(dashboard.lastUpdated).toLocaleTimeString() : 'pending'}
                </Text>
              </Group>
              {dashboard.warnings.map((warning) => <Text key={warning} size="9px" c="#ffab00" mt={3}>{warning}</Text>)}
            </Box>}
        </Stack> : dashboard.error ? null : <Alert color="yellow" icon={<AlertTriangleIcon size={15} />}>
          Verified data is not available yet. Use Refresh to retry the provider chain.
        </Alert>}
    </Box>;
}
function Metric({
  icon: Icon,
  label,
  value,
  tone = '#e8e8f0'





}: {icon: typeof GaugeIcon;label: string;value: string;tone?: string;}) {
  return <Box className="min-w-0 rounded-md border border-line bg-bg-600 p-2.5">
      <Group gap={5} wrap="nowrap">
        <Icon size={11} color={tone} className="shrink-0" aria-hidden="true" />
        <Text size="8px" c="dimmed" tt="uppercase" fw={700} lts="0.06em" truncate>{label}</Text>
      </Group>
      <Text ff="monospace" size="xs" fw={800} c={tone} mt={5} className="numeric-value">{value}</Text>
    </Box>;
}
function Summary({
  label,
  value



}: {label: string;value: string;}) {
  return <Box className="rounded-sm border border-line bg-bg-800 p-2">
      <Text size="8px" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
      <Text size="10px" fw={700} c="white" tt="capitalize" mt={2}>{value}</Text>
    </Box>;
}
const ANALYSIS_STAGES = [
{ label: 'Price structure', detail: 'Mapping swing liquidity', icon: ActivityIcon },
{ label: 'Volume footprint', detail: 'Reading delta imbalance', icon: DatabaseIcon },
{ label: 'Order-book pressure', detail: 'Tracking absorption', icon: WavesIcon },
{ label: 'Institutional flow', detail: 'Scoring confluence', icon: ShieldCheckIcon }];

function LoadingGrid() {
  const reduceMotion = useReducedMotion();
  return <Box
    role="status"
    aria-live="polite"
    aria-label="Market analyzing and tracking institutional activity"
    className="relative min-h-[360px] overflow-hidden rounded-md border border-gold/25 bg-bg-900 p-4 sm:p-6">
    
      <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden="true">
        <div className="absolute left-0 right-0 top-1/3 border-t border-gold/10" />
        <div className="absolute bottom-1/3 left-0 right-0 border-t border-gold/10" />
        <div className="absolute bottom-0 left-1/4 top-0 border-l border-gold/10" />
        <div className="absolute bottom-0 right-1/4 top-0 border-l border-gold/10" />
      </div>

      <Stack gap="xl" className="relative z-10">
        <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
          <Group gap="md" wrap="nowrap">
            <Box className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full border border-gold/40 bg-gold/10">
              <motion.div
              aria-hidden="true"
              className="absolute inset-1 rounded-full border border-dashed border-gold/50"
              animate={reduceMotion ? undefined : { rotate: 360 }}
              transition={{ duration: 8, ease: 'linear', repeat: Infinity }} />
            
              <ScanLineIcon size={20} className="text-gold" aria-hidden="true" />
            </Box>
            <div>
              <Text size="10px" tt="uppercase" fw={800} lts="0.2em" c="#ffab00">
                Live institutional scan
              </Text>
              <Text component="h3" size="xl" fw={900} c="white" mt={2}>
                MARKET ANALYZING
              </Text>
              <Text size="xs" c="dimmed" mt={2}>
                TRACKING INSTITUTIONS across price, volume and liquidity
              </Text>
            </div>
          </Group>
          <Group gap={7} className="rounded-full border border-buy/25 bg-buy/10 px-3 py-1.5">
            <motion.span
            className="h-1.5 w-1.5 rounded-full bg-buy"
            animate={reduceMotion ? undefined : { opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true" />
          
            <Text size="9px" fw={800} tt="uppercase" lts="0.12em" c="#00c853">
              Engine active
            </Text>
          </Group>
        </Group>

        <Box className="rounded-md border border-line bg-bg-800/90 p-4">
          <Group justify="space-between" mb="md">
            <Text size="9px" fw={800} tt="uppercase" lts="0.14em" c="dimmed">
              Analysis pipeline
            </Text>
            <Text ff="monospace" size="9px" c="#ffab00">
              XAUUSD · MULTI-SOURCE
            </Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
            {ANALYSIS_STAGES.map(({ label, detail, icon: Icon }, index) => <motion.div
            key={label}
            className="rounded-md border border-line bg-bg-900 p-3"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: reduceMotion ? 0 : index * 0.05 }}>
            
                <Group justify="space-between" wrap="nowrap">
                  <Box className="grid h-8 w-8 place-items-center rounded border border-gold/25 bg-gold/10">
                    <Icon size={14} className="text-gold" aria-hidden="true" />
                  </Box>
                  <Group gap={3} aria-hidden="true">
                    {[0, 1, 2, 3].map((bar) => <motion.span
                  key={bar}
                  className="h-1 w-2 rounded-full bg-gold"
                  animate={reduceMotion ? undefined : { opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.4, delay: (index + bar) * 0.12, repeat: Infinity }} />
                )}
                  </Group>
                </Group>
                <Text size="xs" fw={800} c="white" mt="sm">{label}</Text>
                <Text size="9px" c="dimmed" mt={2}>{detail}</Text>
              </motion.div>)}
          </SimpleGrid>
        </Box>

        <Group justify="space-between" gap="sm" wrap="wrap">
          <Text size="10px" c="dimmed">
            Verifying market structure before publishing a directional signal.
          </Text>
          <Group gap={6}>
            <Clock3Icon size={12} className="text-ink-dim" aria-hidden="true" />
            <Text ff="monospace" size="9px" c="dimmed">PLEASE HOLD · LIVE DATA PROCESSING</Text>
          </Group>
        </Group>
      </Stack>
    </Box>;
}