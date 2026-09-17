export interface DashboardSection {
  id: string;
  code: `B${number}`;
  label: string;
  shortLabel: string;
}

export const DASHBOARD_SECTIONS: DashboardSection[] = [
{
  id: 'buller-b1-order-flow',
  code: 'B1',
  label: 'Institutional Order Flow Engine',
  shortLabel: 'Order Flow'
},
{
  id: 'buller-b2-timeframes',
  code: 'B2',
  label: 'Timeframe Trend Grid',
  shortLabel: 'Timeframes'
},
{
  id: 'buller-b3-confirmation',
  code: 'B3',
  label: 'Gold Sniper · Entry Confirmation',
  shortLabel: 'Confirmation'
},
{
  id: 'buller-b4-chart',
  code: 'B4',
  label: 'Gold Chart · M1 Execution View',
  shortLabel: 'M1 Chart'
},
{
  id: 'buller-b5-verdict',
  code: 'B5',
  label: 'Final Combined Verdict',
  shortLabel: 'Verdict'
},
{
  id: 'buller-b6-gold-master',
  code: 'B6',
  label: 'Gold Institutional Master',
  shortLabel: 'Gold Master'
},
{
  id: 'buller-b7-crypto-master',
  code: 'B7',
  label: 'Crypto Institutional Master',
  shortLabel: 'Crypto Master'
},
{
  id: 'buller-b8-traps',
  code: 'B8',
  label: 'Bull Trap & Bear Trap Detector',
  shortLabel: 'Trap Detector'
},
{
  id: 'buller-b9-unified-signal',
  code: 'B9',
  label: 'BULLER TRADING Signal · Unified Intelligence',
  shortLabel: 'BULLER Signal'
}];