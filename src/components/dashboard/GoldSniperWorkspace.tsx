import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon } from
'@mantine/core';
import {
  AlertTriangleIcon,
  Clock3Icon,
  CrosshairIcon,
  TargetIcon,
  TrendingDownIcon,
  TrendingUpIcon } from
'lucide-react';
import type { GoldMarketAnalysisState } from '../../hooks/useGoldMarketAnalysis';
import type {
  GoldBiasDirection,
  GoldConfirmationStep } from
'../../lib/engine/goldMarketBias';
import { fmtPrice } from '../../lib/engine/format';
import type { MarketCandleSource } from '../../lib/trading/marketCandles';
import { TradingViewChart } from '../terminal/TradingViewChart';
import {
  GoldChartReference as ChartReference,
  GoldConfirmationStepCard as ConfirmationStepCard,
  GoldTradeMetric as TradeMetric } from
'./GoldSniperWorkspaceParts';
interface GoldSniperWorkspaceProps {
  market: GoldMarketAnalysisState;
}
export function GoldSniperWorkspace({ market }: GoldSniperWorkspaceProps) {
  const navigate = useNavigate();
  const analysis = market.analysis;
  const direction = analysis?.direction ?? 'NEUTRAL';
  const confidence = analysis?.confidence ?? 0;
  const steps = analysis?.confirmationSteps ?? unavailableSteps();
  const completed = steps.filter((step) => step.state === 'pass').length;
  const canAct =
  market.status === 'live' &&
  completed >= 4 &&
  confidence >= 80 &&
  Boolean(analysis?.tradePlan);
  const canBuy = canAct && direction === 'BUY';
  const canSell = canAct && direction === 'SELL';
  const tradePlan = analysis?.tradePlan;
  const liquidity = analysis?.liquidity;
  const fvg = analysis?.fvg;
  const bos = analysis?.bos;
  return (
    <Grid
      component="section"
      aria-label="Gold Sniper shared real-market analysis"
      gutter="sm">
      
      <Grid.Col
        id="buller-b3-confirmation"
        className="scroll-mt-[128px] lg:scroll-mt-[86px]"
        span={{
          base: 12,
          xl: 5
        }}>
        
        <Card
          radius="md"
          padding="md"
          className="h-full border border-brand/25 bg-bg-700">
          
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Group gap="xs">
                <ThemeIcon variant="light" color="yellow" size="sm">
                  <CrosshairIcon size={15} aria-hidden="true" />
                </ThemeIcon>
                <Box>
                  <Text
                    component="h2"
                    size="sm"
                    fw={900}
                    c="#ffd700"
                    tt="uppercase"
                    lts={1.1}>
                    
                    Gold Sniper · Entry Confirmation
                  </Text>
                  <Text size="xs" c="dimmed" mt={2}>
                    Same shared Gold bias as the timeframe grid · no synthetic
                    candles
                  </Text>
                </Box>
              </Group>
              <Group gap="xs">
                <Badge
                  color={statusColor(market.status)}
                  variant="light"
                  size="sm">
                  
                  {market.loading ? 'FETCHING' : market.status.toUpperCase()}
                </Badge>
                <Badge
                  color={directionColor(direction)}
                  variant="light"
                  size="sm">
                  
                  {direction === 'NEUTRAL' ? 'WAIT' : direction}
                </Badge>
              </Group>
            </Group>

            {market.error &&
            <Alert
              color="red"
              variant="light"
              icon={<AlertTriangleIcon size={15} />}
              role="alert">
              
                <Text size="xs">{market.error}</Text>
              </Alert>
            }
            {market.warnings.length > 0 &&
            <Alert
              color="yellow"
              variant="light"
              icon={<AlertTriangleIcon size={15} />}
              role="status">
              
                <Text size="xs">{market.warnings.join('. ')}</Text>
              </Alert>
            }

            <Stack gap="xs">
              {steps.map((step) =>
              <ConfirmationStepCard key={step.number} step={step} />
              )}
            </Stack>

            <Card
              radius="md"
              padding="sm"
              className={`border ${verdictPanelClass(direction, confidence)}`}>
              
              <Group justify="space-between" align="flex-start">
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                    Confirmation status
                  </Text>
                  <Text
                    size="lg"
                    fw={900}
                    c={directionTextColor(direction)}
                    mt={2}
                    className="numeric-value">
                    
                    {completed}/5 complete
                  </Text>
                </Box>
                <Box ta="right">
                  <Text
                    size="xl"
                    fw={900}
                    c={directionTextColor(direction)}
                    className="numeric-value font-mono">
                    
                    {confidence}%
                  </Text>
                  <Text size="xs" c="dimmed">
                    shared confidence
                  </Text>
                </Box>
              </Group>
              <Progress
                value={confidence}
                color={directionColor(direction)}
                size="sm"
                radius="xl"
                mt="sm"
                aria-label={`Shared Gold bias confidence ${confidence}%`} />
              
              <Text
                size="sm"
                fw={900}
                mt="sm"
                c={directionTextColor(direction)}>
                
                {verdictLabel(direction, confidence, completed)}
              </Text>
              <Text size="xs" c="dimmed" mt={3}>
                {analysis?.reasons.join(' ') ||
                'Waiting for real Gold and DXY OHLC. No direction is inferred while unavailable.'}
              </Text>

              <Group grow mt="sm">
                <Button
                  color="green"
                  variant={canBuy ? 'filled' : 'light'}
                  leftSection={<TrendingUpIcon size={16} />}
                  disabled={!canBuy}
                  onClick={() => navigate('/app/trade-entry')}>
                  
                  BUY
                </Button>
                <Button
                  color="red"
                  variant={canSell ? 'filled' : 'light'}
                  leftSection={<TrendingDownIcon size={16} />}
                  disabled={!canSell}
                  onClick={() => navigate('/app/trade-entry')}>
                  
                  SELL
                </Button>
              </Group>
              <Text size="xs" c="dimmed" ta="center" mt={5}>
                Action requires a fully live snapshot, 80%+ shared confidence
                and 4/5 real-market confirmations.
              </Text>

              <SimpleGrid cols={2} spacing="xs" mt="sm">
                <TradeMetric
                  label="Entry"
                  value={fmtPrice('XAUUSD', tradePlan?.entry)} />
                
                <TradeMetric
                  label="Stop Loss"
                  value={fmtPrice('XAUUSD', tradePlan?.stopLoss)}
                  tone="sell" />
                
                <TradeMetric
                  label="Take Profit"
                  value={fmtPrice('XAUUSD', tradePlan?.takeProfit)}
                  tone="buy" />
                
                <TradeMetric
                  label="Risk : Reward"
                  value={tradePlan ? `1:${tradePlan.riskReward}` : '—'}
                  tone="warn" />
                
              </SimpleGrid>
            </Card>
          </Stack>
        </Card>
      </Grid.Col>

      <Grid.Col
        id="buller-b4-chart"
        className="scroll-mt-[128px] lg:scroll-mt-[86px]"
        span={{
          base: 12,
          xl: 7
        }}>
        
        <Card
          radius="md"
          padding="md"
          className="h-full border border-white/10 bg-[#06060e]">
          
          <Stack gap="sm" className="h-full">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Group gap="xs">
                <ThemeIcon variant="light" color="yellow" size="sm">
                  <TargetIcon size={15} aria-hidden="true" />
                </ThemeIcon>
                <Box>
                  <Text
                    component="h2"
                    size="sm"
                    fw={900}
                    c="#f5f5f5"
                    tt="uppercase"
                    lts={1.1}>
                    
                    Gold Chart · M1 Execution View
                  </Text>
                  <Text size="xs" c="dimmed" mt={2}>
                    TradingView OANDA XAU/USD visual · reference levels use the
                    shared real-OHLC engine
                  </Text>
                </Box>
              </Group>
              <Group gap="xs">
                <Badge color="yellow" variant="light" size="sm">
                  XAU/USD
                </Badge>
                <Badge
                  color={statusColor(market.status)}
                  variant="dot"
                  size="sm">
                  
                  {market.status === 'live' ? 'Real OHLC live' : market.status}
                </Badge>
              </Group>
            </Group>

            <Box className="h-[520px] min-h-[420px] overflow-hidden rounded-md md:h-[620px] xl:h-full xl:min-h-[680px]">
              <TradingViewChart
                tvId="OANDA:XAUUSD"
                interval="1"
                height="100%" />
              
            </Box>

            <SimpleGrid
              cols={{
                base: 1,
                sm: 3
              }}
              spacing="xs">
              
              <ChartReference
                label="Liquidity sweep"
                value={
                liquidity ?
                fmtPrice('XAUUSD', liquidity.level) :
                'Not confirmed'
                }
                detail={
                liquidity ?
                `${liquidity.label} · ${liquidity.direction}` :
                'No sweep is fabricated'
                }
                tone={
                liquidity?.direction === 'BUY' ?
                'green' :
                liquidity?.direction === 'SELL' ?
                'red' :
                'gray'
                } />
              
              <ChartReference
                label="FVG zone"
                value={
                fvg ?
                `${fmtPrice('XAUUSD', fvg.low)} – ${fmtPrice('XAUUSD', fvg.high)}` :
                'No active FVG'
                }
                detail={
                fvg ?
                `${fvg.direction} three-candle imbalance` :
                'waiting for a real imbalance'
                }
                tone={
                fvg?.direction === 'BUY' ?
                'green' :
                fvg?.direction === 'SELL' ?
                'red' :
                'gray'
                } />
              
              <ChartReference
                label="Latest BOS"
                value={
                !bos || bos.direction === 'NEUTRAL' ?
                'Not confirmed' :
                bos.direction
                }
                detail={
                bos?.level ?
                `${fmtPrice('XAUUSD', bos.level)} break level` :
                'watching real M1 closes'
                }
                tone={
                bos?.direction === 'BUY' ?
                'green' :
                bos?.direction === 'SELL' ?
                'red' :
                'gray'
                } />
              
            </SimpleGrid>

            <Group
              justify="space-between"
              gap="xs"
              wrap="wrap"
              className="border-t border-white/5 pt-2">
              
              <Text size="xs" c="dimmed">
                {sourceSummary(analysis?.sources)}
              </Text>
              <Group gap={5}>
                <Clock3Icon
                  size={12}
                  className="text-gray-500"
                  aria-hidden="true" />
                
                <Text size="xs" c="dimmed">
                  Market candle {formatTimestamp(analysis?.marketTimestamp)} ·
                  refreshed {formatTimestamp(market.lastUpdated)}
                </Text>
              </Group>
            </Group>
          </Stack>
        </Card>
      </Grid.Col>
    </Grid>);

}
function unavailableSteps(): GoldConfirmationStep[] {
  return [
  'HTF bias · MN/W1/D1/H4',
  'Liquidity sweep',
  'Gold vs DXY · SMT / inverse check',
  'M1 market structure shift / BOS',
  'M1 fair value gap'].
  map((title, index) => ({
    number: index + 1,
    title,
    state: 'unavailable' as const,
    detail: 'Waiting for real OHLC; no evidence is inferred.'
  }));
}
function sourceSummary(sources: MarketCandleSource[] | undefined): string {
  if (!sources?.length) return 'Real OHLC sources unavailable';
  return sources.map((source) => source.label).join(' · ');
}
function formatTimestamp(value: number | null | undefined): string {
  return value && Number.isFinite(value) ?
  new Date(value).toLocaleString() :
  'unavailable';
}
function statusColor(status: GoldMarketAnalysisState['status']): string {
  if (status === 'live') return 'green';
  if (status === 'error') return 'red';
  return 'yellow';
}
function directionColor(direction: GoldBiasDirection): string {
  if (direction === 'BUY') return 'green';
  if (direction === 'SELL') return 'red';
  return 'yellow';
}
function directionTextColor(direction: GoldBiasDirection): string {
  if (direction === 'BUY') return '#00ff88';
  if (direction === 'SELL') return '#ff4444';
  return '#ffd43b';
}
function verdictLabel(
direction: GoldBiasDirection,
confidence: number,
completed: number)
: string {
  if (direction === 'NEUTRAL') return 'WAIT · MIXED REAL-MARKET EVIDENCE';
  if (confidence >= 80 && completed >= 4) return `${direction} SETUP READY`;
  return `WATCH ${direction} · MORE CONFIRMATION REQUIRED`;
}
function verdictPanelClass(
direction: GoldBiasDirection,
confidence: number)
: string {
  if (direction === 'BUY' && confidence >= 80)
  return 'border-[#00ff88]/30 bg-[#00ff88]/5';
  if (direction === 'SELL' && confidence >= 80)
  return 'border-[#ff4444]/30 bg-[#ff4444]/5';
  return 'border-yellow-400/20 bg-yellow-400/5';
}