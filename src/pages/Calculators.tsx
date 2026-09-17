import React, { useState } from 'react';
import { Input } from '../components/ui/Input';
import { CalculatorIcon } from 'lucide-react';
type Calc = 'lot' | 'risk' | 'position' | 'rr' | 'comp' | 'profit' | 'funding';
const TABS: {
  id: Calc;
  label: string;
}[] = [
{
  id: 'lot',
  label: 'Lot Size'
},
{
  id: 'risk',
  label: 'Risk %'
},
{
  id: 'position',
  label: 'Position Size'
},
{
  id: 'rr',
  label: 'R:R'
},
{
  id: 'comp',
  label: 'Compounding'
},
{
  id: 'profit',
  label: 'Profit'
},
{
  id: 'funding',
  label: 'Funding Fee'
}];

export function Calculators() {
  const [tab, setTab] = useState<Calc>('lot');
  return (
    <div className="p-3 lg:p-4 space-y-3 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-2">
        <CalculatorIcon className="w-5 h-5 text-brand" />
        <h1 className="text-xl font-bold tracking-tight">Trader Calculators</h1>
      </div>

      <div className="bg-bg-600 border border-line rounded-md p-1 flex flex-wrap gap-1">
        {TABS.map((t) =>
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`px-2.5 py-1.5 text-2xs font-semibold rounded ${tab === t.id ? 'bg-brand text-white' : 'text-ink-muted hover:text-ink hover:bg-bg-500'}`}>
          
            {t.label}
          </button>
        )}
      </div>

      <div className="bg-bg-600 border border-line rounded-md p-5">
        {tab === 'lot' && <LotCalc />}
        {tab === 'risk' && <RiskCalc />}
        {tab === 'position' && <PositionCalc />}
        {tab === 'rr' && <RRCalc />}
        {tab === 'comp' && <CompoundCalc />}
        {tab === 'profit' && <ProfitCalc />}
        {tab === 'funding' && <FundingCalc />}
      </div>
    </div>);

}
function ResultLine({
  label,
  value,
  tone




}: {label: string;value: string;tone?: 'buy' | 'sell' | 'warn';}) {
  const c =
  tone === 'buy' ?
  'text-buy' :
  tone === 'sell' ?
  'text-sell' :
  tone === 'warn' ?
  'text-warn' :
  'text-brand';
  return (
    <div className="flex justify-between py-2 border-b border-line last:border-0">
      <span className="text-2xs uppercase tracking-wider text-ink-muted">
        {label}
      </span>
      <span className={`font-mono font-bold ${c}`}>{value}</span>
    </div>);

}
function LotCalc() {
  const [balance, setBalance] = useState('1000');
  const [riskPct, setRiskPct] = useState('1.5');
  const [slPips, setSlPips] = useState('20');
  const [pipValue, setPipValue] = useState('10');
  const risk = +balance * +riskPct / 100;
  const lotSize =
  +slPips > 0 && +pipValue > 0 ? risk / (+slPips * +pipValue) : 0;
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold">Lot Size Calculator</h2>
      <p className="text-2xs text-ink-muted">
        Lot = (Balance × Risk%) / (SL pips × Pip value)
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Account Balance ($)"
          value={balance}
          onChange={(e) => setBalance(e.target.value)} />
        
        <Input
          label="Risk per trade (%)"
          value={riskPct}
          onChange={(e) => setRiskPct(e.target.value)} />
        
        <Input
          label="Stop Loss (pips)"
          value={slPips}
          onChange={(e) => setSlPips(e.target.value)} />
        
        <Input
          label="Pip value ($/pip/lot)"
          value={pipValue}
          onChange={(e) => setPipValue(e.target.value)} />
        
      </div>
      <div className="bg-bg-700 border border-line rounded p-3 space-y-0">
        <ResultLine
          label="Risk Amount"
          value={`$${risk.toFixed(2)}`}
          tone="warn" />
        
        <ResultLine label="Lot Size" value={lotSize.toFixed(2)} />
        <ResultLine label="Micro-Lots" value={(lotSize * 100).toFixed(0)} />
      </div>
    </div>);

}
function RiskCalc() {
  const [balance, setBalance] = useState('1000');
  const [riskAmt, setRiskAmt] = useState('20');
  const pct = +riskAmt / +balance * 100 || 0;
  const safe = pct <= 2;
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold">Risk Percentage</h2>
      <p className="text-2xs text-ink-muted">
        Recommended risk per trade: 1–2% of account balance.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Account Balance ($)"
          value={balance}
          onChange={(e) => setBalance(e.target.value)} />
        
        <Input
          label="Risk Amount ($)"
          value={riskAmt}
          onChange={(e) => setRiskAmt(e.target.value)} />
        
      </div>
      <div className="bg-bg-700 border border-line rounded p-3">
        <ResultLine
          label="Risk %"
          value={`${pct.toFixed(2)}%`}
          tone={safe ? 'buy' : 'sell'} />
        
        <ResultLine
          label="Verdict"
          value={safe ? 'SAFE' : 'TOO HIGH'}
          tone={safe ? 'buy' : 'sell'} />
        
      </div>
    </div>);

}
function PositionCalc() {
  const [balance, setBalance] = useState('1000');
  const [riskPct, setRiskPct] = useState('1.5');
  const [entry, setEntry] = useState('100');
  const [sl, setSl] = useState('98');
  const risk = +balance * +riskPct / 100;
  const priceDiff = Math.abs(+entry - +sl);
  const units = priceDiff > 0 ? risk / priceDiff : 0;
  const notional = units * +entry;
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold">Position Size</h2>
      <p className="text-2xs text-ink-muted">
        For stocks / crypto where size is in units.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Balance ($)"
          value={balance}
          onChange={(e) => setBalance(e.target.value)} />
        
        <Input
          label="Risk %"
          value={riskPct}
          onChange={(e) => setRiskPct(e.target.value)} />
        
        <Input
          label="Entry Price"
          value={entry}
          onChange={(e) => setEntry(e.target.value)} />
        
        <Input
          label="Stop Loss Price"
          value={sl}
          onChange={(e) => setSl(e.target.value)} />
        
      </div>
      <div className="bg-bg-700 border border-line rounded p-3">
        <ResultLine
          label="Risk Amount"
          value={`$${risk.toFixed(2)}`}
          tone="warn" />
        
        <ResultLine label="Position Size (units)" value={units.toFixed(4)} />
        <ResultLine label="Notional Value" value={`$${notional.toFixed(2)}`} />
      </div>
    </div>);

}
function RRCalc() {
  const [entry, setEntry] = useState('100');
  const [sl, setSl] = useState('98');
  const [tp, setTp] = useState('106');
  const risk = Math.abs(+entry - +sl);
  const reward = Math.abs(+tp - +entry);
  const rr = risk > 0 ? reward / risk : 0;
  const good = rr >= 2;
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold">Risk : Reward</h2>
      <p className="text-2xs text-ink-muted">
        Institutional standard: aim for 1:2 or better. ICT preaches 1:3+.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Input
          label="Entry"
          value={entry}
          onChange={(e) => setEntry(e.target.value)} />
        
        <Input
          label="Stop Loss"
          value={sl}
          onChange={(e) => setSl(e.target.value)} />
        
        <Input
          label="Take Profit"
          value={tp}
          onChange={(e) => setTp(e.target.value)} />
        
      </div>
      <div className="bg-bg-700 border border-line rounded p-3">
        <ResultLine
          label="Risk (per unit)"
          value={risk.toFixed(4)}
          tone="sell" />
        
        <ResultLine
          label="Reward (per unit)"
          value={reward.toFixed(4)}
          tone="buy" />
        
        <ResultLine
          label="R : R"
          value={`1 : ${rr.toFixed(2)}`}
          tone={good ? 'buy' : 'warn'} />
        
      </div>
    </div>);

}
function CompoundCalc() {
  const [start, setStart] = useState('100');
  const [returnPct, setReturnPct] = useState('5');
  const [periods, setPeriods] = useState('52');
  const final =
  +start > 0 ? +start * Math.pow(1 + +returnPct / 100, +periods) : 0;
  const profit = final - (+start || 0);
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold">Compounding</h2>
      <p className="text-2xs text-ink-muted">
        Final = Start × (1 + Return%) ^ Periods
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Input
          label="Starting ($)"
          value={start}
          onChange={(e) => setStart(e.target.value)} />
        
        <Input
          label="Return per period (%)"
          value={returnPct}
          onChange={(e) => setReturnPct(e.target.value)} />
        
        <Input
          label="Periods"
          value={periods}
          onChange={(e) => setPeriods(e.target.value)} />
        
      </div>
      <div className="bg-bg-700 border border-line rounded p-3">
        <ResultLine
          label="Final Balance"
          value={`$${final.toLocaleString(undefined, {
            maximumFractionDigits: 2
          })}`}
          tone="buy" />
        
        <ResultLine
          label="Total Profit"
          value={`$${profit.toLocaleString(undefined, {
            maximumFractionDigits: 2
          })}`}
          tone="buy" />
        
        <ResultLine
          label="Multiple"
          value={+start > 0 ? `${(final / +start).toFixed(2)}x` : '—'} />
        
      </div>
    </div>);

}
function ProfitCalc() {
  const [entry, setEntry] = useState('100');
  const [exit, setExit] = useState('110');
  const [size, setSize] = useState('1');
  const [side, setSide] = useState<'long' | 'short'>('long');
  const profit = (side === 'long' ? +exit - +entry : +entry - +exit) * +size;
  const pct = +entry > 0 ? profit / (+entry * +size) * 100 : 0;
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold">Profit / Loss</h2>
      <div className="flex gap-1">
        {(['long', 'short'] as const).map((s) =>
        <button
          key={s}
          onClick={() => setSide(s)}
          className={`flex-1 py-1.5 text-2xs font-bold uppercase rounded ${side === s ? s === 'long' ? 'bg-buy text-white' : 'bg-sell text-white' : 'bg-bg-700 text-ink-muted border border-line'}`}>
          
            {s}
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input
          label="Entry"
          value={entry}
          onChange={(e) => setEntry(e.target.value)} />
        
        <Input
          label="Exit"
          value={exit}
          onChange={(e) => setExit(e.target.value)} />
        
        <Input
          label="Size (units)"
          value={size}
          onChange={(e) => setSize(e.target.value)} />
        
      </div>
      <div className="bg-bg-700 border border-line rounded p-3">
        <ResultLine
          label="P/L"
          value={`${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`}
          tone={profit >= 0 ? 'buy' : 'sell'} />
        
        <ResultLine
          label="Return %"
          value={`${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}
          tone={pct >= 0 ? 'buy' : 'sell'} />
        
      </div>
    </div>);

}
function FundingCalc() {
  const [position, setPosition] = useState('1000');
  const [rate, setRate] = useState('0.01');
  const [hours, setHours] = useState('8');
  const fee = +position * +rate / 100;
  const perDay = +hours > 0 ? fee * (24 / +hours) : 0;
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold">Funding Fee (Crypto Perps)</h2>
      <p className="text-2xs text-ink-muted">
        Fee = Position × Rate%. Charged every funding interval (typically 8h).
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Input
          label="Position Size ($)"
          value={position}
          onChange={(e) => setPosition(e.target.value)} />
        
        <Input
          label="Funding Rate (%)"
          value={rate}
          onChange={(e) => setRate(e.target.value)} />
        
        <Input
          label="Funding Interval (h)"
          value={hours}
          onChange={(e) => setHours(e.target.value)} />
        
      </div>
      <div className="bg-bg-700 border border-line rounded p-3">
        <ResultLine
          label="Fee per period"
          value={`$${fee.toFixed(4)}`}
          tone="warn" />
        
        <ResultLine
          label="Per day"
          value={`$${perDay.toFixed(4)}`}
          tone="warn" />
        
        <ResultLine
          label="Per year (est.)"
          value={`$${(perDay * 365).toFixed(2)}`}
          tone="sell" />
        
      </div>
    </div>);

}