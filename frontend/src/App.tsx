import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Landmark, Wallet, RefreshCw, LogOut, ArrowRightLeft,
  Shield, TrendingDown, AlertTriangle, ChevronDown, ChevronUp,
  ExternalLink, CircleDollarSign, ScanSearch, PiggyBank,
  BarChart3, FileText, Loader2, Copy, CheckCircle2,
  Activity, Zap, BookOpen
} from 'lucide-react';
import { Button } from './components/Button.tsx';
import { Card, CardContent, CardHeader } from './components/Card.tsx';
import { Input } from './components/Input.tsx';
import { EXAMPLE_DEPOSITS, EXAMPLE_SCANS } from './lib/examples.ts';
import {
  connectWallet, createGenlayerClient, shortAddress, switchToGenlayer
} from './lib/genlayer.ts';

const CONTRACT_ADDRESS = "0xb7F9379C2B41382A8032893B11cB96329526d7c7";
const EXPLORER_URL = "https://explorer-studio.genlayer.com";
const ASSETS = ["USDC", "USDT", "DAI"] as const;
const ALL_ASSETS = ["USDC", "USDT", "DAI", "SAFE_RESERVE"] as const;

type TabId = 'dashboard' | 'deposit' | 'scanner' | 'rebalance';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface TxEntry {
  hash: string;
  label: string;
  time: string;
}

interface Allocations {
  usdc: number;
  usdt: number;
  dai: number;
  safe_reserve: number;
  total_value: number;
  risk_threshold: number;
}

interface RiskReport {
  risk_level: string;
  panic_score: number;
  depeg_probability: number;
  recommendation: string;
  analysis_summary: string;
  sentiment_indicators: string;
  action_taken: string;
  rebalanced_amount: number;
  target_asset?: string;
  news_url?: string;
  forum_url?: string;
}

// ─── Helpers ───
function formatUSD(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toLocaleString()}`;
}

function riskBadgeClass(level: string): string {
  const l = (level || '').toUpperCase();
  if (l === 'CRITICAL') return 'badge-critical';
  if (l === 'HIGH') return 'badge-high';
  if (l === 'MEDIUM') return 'badge-medium';
  if (l === 'LOW') return 'badge-low';
  return 'badge-safe';
}

function riskDotClass(level: string): string {
  const l = (level || '').toUpperCase();
  if (l === 'CRITICAL') return 'risk-dot-critical';
  if (l === 'HIGH') return 'risk-dot-high';
  if (l === 'MEDIUM') return 'risk-dot-medium';
  if (l === 'LOW') return 'risk-dot-low';
  return 'risk-dot-safe';
}

function panicBarClass(score: number): string {
  if (score >= 75) return 'panic-bar-critical';
  if (score >= 50) return 'panic-bar-high';
  if (score >= 25) return 'panic-bar-medium';
  return 'panic-bar-low';
}

function panicColor(score: number): string {
  if (score >= 75) return 'var(--status-critical)';
  if (score >= 50) return 'var(--status-high)';
  if (score >= 25) return 'var(--status-medium)';
  return 'var(--status-safe)';
}

function assetBadgeClass(asset: string): string {
  const a = (asset || '').toUpperCase();
  if (a === 'USDC') return 'badge-asset-usdc';
  if (a === 'USDT') return 'badge-asset-usdt';
  if (a === 'DAI') return 'badge-asset-dai';
  return 'badge-asset-safe';
}

function assetColor(asset: string): string {
  const a = (asset || '').toUpperCase();
  if (a === 'USDC') return 'var(--asset-usdc)';
  if (a === 'USDT') return 'var(--asset-usdt)';
  if (a === 'DAI') return 'var(--asset-dai)';
  return 'var(--asset-safe)';
}

// ─── Main App ───
export default function App() {
  // Wallet
  const [wallet, setWallet] = useState('');
  const [connecting, setConnecting] = useState(false);

  // UI
  const [tab, setTab] = useState<TabId>('dashboard');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [txLog, setTxLog] = useState<TxEntry[]>([]);
  const [txLogOpen, setTxLogOpen] = useState(false);
  const toastId = useRef(0);

  // Data
  const [allocations, setAllocations] = useState<Allocations | null>(null);
  const [reports, setReports] = useState<RiskReport[]>([]);
  const [reportCount, setReportCount] = useState(0);
  const [loadingData, setLoadingData] = useState(false);

  // Forms
  const [depositAsset, setDepositAsset] = useState<string>('USDC');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAsset, setWithdrawAsset] = useState<string>('USDC');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const [scanTarget, setScanTarget] = useState<string>('USDT');
  const [scanNewsUrl, setScanNewsUrl] = useState('');
  const [scanForumUrl, setScanForumUrl] = useState('');
  const [scanDescription, setScanDescription] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState('');

  const [rebalFrom, setRebalFrom] = useState<string>('USDC');
  const [rebalTo, setRebalTo] = useState<string>('SAFE_RESERVE');
  const [rebalAmount, setRebalAmount] = useState('');
  const [rebalLoading, setRebalLoading] = useState(false);

  const [thresholdInput, setThresholdInput] = useState('');
  const [thresholdLoading, setThresholdLoading] = useState(false);

  const [exampleDepositIdx, setExampleDepositIdx] = useState(0);
  const [exampleScanIdx, setExampleScanIdx] = useState(0);

  // Toast helper
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  // TX log helper
  const addTx = useCallback((hash: string, label: string) => {
    setTxLog(prev => [{ hash, label, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
  }, []);

  // Connect wallet
  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      await switchToGenlayer();
      const addr = await connectWallet();
      setWallet(addr);
      addToast('success', `Wallet connected: ${shortAddress(addr)}`);
    } catch (e: any) {
      addToast('error', e.message || 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  }, [addToast]);

  const handleDisconnect = useCallback(() => {
    setWallet('');
    setAllocations(null);
    setReports([]);
    setReportCount(0);
    addToast('info', 'Wallet disconnected');
  }, [addToast]);

  // ─── Read Data ───
  const loadData = useCallback(async () => {
    if (!wallet) return;
    const client = createGenlayerClient(wallet);
    if (!client) return;
    setLoadingData(true);
    try {
      const alloc = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'get_allocations',
        args: [],
      });
      setAllocations(alloc as unknown as Allocations);

      const count = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'get_report_count',
        args: [],
      });
      const c = Number(count);
      setReportCount(c);

      const fetchCount = Math.min(c, 5);
      const reportPromises = [];
      for (let i = c - 1; i >= c - fetchCount; i--) {
        reportPromises.push(
          client.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            functionName: 'get_report',
            args: [i],
          })
        );
      }
      const results = await Promise.all(reportPromises);
      setReports(results as unknown as RiskReport[]);
    } catch (e: any) {
      console.error('Load data error:', e);
      addToast('error', 'Failed to load contract data: ' + (e.message || ''));
    } finally {
      setLoadingData(false);
    }
  }, [wallet, addToast]);

  useEffect(() => {
    if (wallet) loadData();
  }, [wallet, loadData]);

  // ─── Deposit ───
  const handleDeposit = useCallback(async () => {
    if (!wallet || !depositAmount) return;
    const client = createGenlayerClient(wallet);
    if (!client) return;
    setDepositLoading(true);
    try {
      await switchToGenlayer();
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'deposit',
        args: [depositAsset, parseInt(depositAmount)],
        value: BigInt(0),
      });
      addTx(hash, `Deposit ${formatUSD(parseInt(depositAmount))} ${depositAsset}`);
      addToast('info', 'Deposit submitted. Waiting for confirmation...');
      await client.waitForTransactionReceipt({ hash, status: "ACCEPTED" as any, retries: 200 });
      addToast('success', `Deposited ${formatUSD(parseInt(depositAmount))} ${depositAsset}`);
      setDepositAmount('');
      await loadData();
    } catch (e: any) {
      addToast('error', 'Deposit failed: ' + (e.message || ''));
    } finally {
      setDepositLoading(false);
    }
  }, [wallet, depositAsset, depositAmount, addToast, addTx, loadData]);

  // ─── Withdraw ───
  const handleWithdraw = useCallback(async () => {
    if (!wallet || !withdrawAmount) return;
    const client = createGenlayerClient(wallet);
    if (!client) return;
    setWithdrawLoading(true);
    try {
      await switchToGenlayer();
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'withdraw',
        args: [withdrawAsset, parseInt(withdrawAmount)],
        value: BigInt(0),
      });
      addTx(hash, `Withdraw ${formatUSD(parseInt(withdrawAmount))} ${withdrawAsset}`);
      addToast('info', 'Withdrawal submitted. Waiting for confirmation...');
      await client.waitForTransactionReceipt({ hash, status: "ACCEPTED" as any, retries: 200 });
      addToast('success', `Withdrew ${formatUSD(parseInt(withdrawAmount))} ${withdrawAsset}`);
      setWithdrawAmount('');
      await loadData();
    } catch (e: any) {
      addToast('error', 'Withdrawal failed: ' + (e.message || ''));
    } finally {
      setWithdrawLoading(false);
    }
  }, [wallet, withdrawAsset, withdrawAmount, addToast, addTx, loadData]);

  // ─── Risk Scan ───
  const handleScan = useCallback(async () => {
    if (!wallet || !scanNewsUrl || !scanDescription) return;
    const client = createGenlayerClient(wallet);
    if (!client) return;
    setScanLoading(true);
    setScanStatus('Submitting scan... Approve in MetaMask. AI analysis may take 1-2 min.');
    try {
      await switchToGenlayer();
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'scan_and_rebalance',
        args: [scanTarget, scanNewsUrl, scanForumUrl, scanDescription],
        value: BigInt(0),
      });
      addTx(hash, `Risk Scan: ${scanTarget}`);
      setScanStatus('Transaction submitted. AI validators analyzing news & sentiment...');
      addToast('info', 'Risk scan submitted. AI analysis in progress...');
      await client.waitForTransactionReceipt({ hash, status: "ACCEPTED" as any, retries: 200 });
      addToast('success', 'Risk scan complete! Check dashboard for results.');
      setScanStatus('');
      setScanNewsUrl('');
      setScanForumUrl('');
      setScanDescription('');
      await loadData();
      setTab('dashboard');
    } catch (e: any) {
      addToast('error', 'Risk scan failed: ' + (e.message || ''));
      setScanStatus('');
    } finally {
      setScanLoading(false);
    }
  }, [wallet, scanTarget, scanNewsUrl, scanForumUrl, scanDescription, addToast, addTx, loadData]);

  // ─── Manual Rebalance ───
  const handleRebalance = useCallback(async () => {
    if (!wallet || !rebalAmount) return;
    const client = createGenlayerClient(wallet);
    if (!client) return;
    setRebalLoading(true);
    try {
      await switchToGenlayer();
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'manual_rebalance',
        args: [rebalFrom, rebalTo, parseInt(rebalAmount)],
        value: BigInt(0),
      });
      addTx(hash, `Rebalance ${formatUSD(parseInt(rebalAmount))} ${rebalFrom} → ${rebalTo}`);
      addToast('info', 'Rebalance submitted. Waiting for confirmation...');
      await client.waitForTransactionReceipt({ hash, status: "ACCEPTED" as any, retries: 200 });
      addToast('success', `Rebalanced ${formatUSD(parseInt(rebalAmount))} from ${rebalFrom} to ${rebalTo}`);
      setRebalAmount('');
      await loadData();
    } catch (e: any) {
      addToast('error', 'Rebalance failed: ' + (e.message || ''));
    } finally {
      setRebalLoading(false);
    }
  }, [wallet, rebalFrom, rebalTo, rebalAmount, addToast, addTx, loadData]);

  // ─── Set Threshold ───
  const handleSetThreshold = useCallback(async () => {
    if (!wallet || !thresholdInput) return;
    const val = parseInt(thresholdInput);
    if (isNaN(val) || val < 0 || val > 100) {
      addToast('error', 'Threshold must be 0-100');
      return;
    }
    const client = createGenlayerClient(wallet);
    if (!client) return;
    setThresholdLoading(true);
    try {
      await switchToGenlayer();
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'set_risk_threshold',
        args: [val],
        value: BigInt(0),
      });
      addTx(hash, `Set risk threshold → ${val}`);
      addToast('info', 'Setting threshold...');
      await client.waitForTransactionReceipt({ hash, status: "ACCEPTED" as any, retries: 200 });
      addToast('success', `Risk threshold set to ${val}`);
      setThresholdInput('');
      await loadData();
    } catch (e: any) {
      addToast('error', 'Failed to set threshold: ' + (e.message || ''));
    } finally {
      setThresholdLoading(false);
    }
  }, [wallet, thresholdInput, addToast, addTx, loadData]);

  // ─── Example helpers ───
  const fillExampleDeposit = useCallback(() => {
    const ex = EXAMPLE_DEPOSITS[exampleDepositIdx % EXAMPLE_DEPOSITS.length];
    setDepositAsset(ex.asset);
    setDepositAmount(ex.amount);
    setExampleDepositIdx(prev => prev + 1);
    addToast('info', `Loaded example: ${ex.asset} ${formatUSD(parseInt(ex.amount))}`);
  }, [exampleDepositIdx, addToast]);

  const fillExampleScan = useCallback(() => {
    const ex = EXAMPLE_SCANS[exampleScanIdx % EXAMPLE_SCANS.length];
    setScanTarget(ex.targetAsset);
    setScanNewsUrl(ex.newsUrl);
    setScanForumUrl(ex.forumUrl);
    setScanDescription(ex.description);
    setExampleScanIdx(prev => prev + 1);
    addToast('info', `Loaded scan example: ${ex.targetAsset} risk scenario`);
  }, [exampleScanIdx, addToast]);

  // ─── Allocation bar data ───
  const totalAlloc = allocations
    ? (allocations.usdc + allocations.usdt + allocations.dai + allocations.safe_reserve) || 1
    : 1;

  const allocPcts = allocations ? {
    usdc: (allocations.usdc / totalAlloc) * 100,
    usdt: (allocations.usdt / totalAlloc) * 100,
    dai: (allocations.dai / totalAlloc) * 100,
    safe: (allocations.safe_reserve / totalAlloc) * 100,
  } : { usdc: 0, usdt: 0, dai: 0, safe: 0 };

  // ─── Render ───
  return (
    <div className="app-container">
      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' && <CheckCircle2 size={16} style={{ color: 'var(--status-success)', flexShrink: 0 }} />}
            {t.type === 'error' && <AlertTriangle size={16} style={{ color: 'var(--status-error)', flexShrink: 0 }} />}
            {t.type === 'info' && <Activity size={16} style={{ color: 'var(--status-info)', flexShrink: 0 }} />}
            {t.type === 'warning' && <AlertTriangle size={16} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <div className="header-brand-icon">
            <Landmark size={22} />
          </div>
          <div>
            <div className="header-title">TreasuryBalancer</div>
            <div className="header-subtitle">News-Aware DeFi Fund Manager · GenLayer Studionet</div>
          </div>
        </div>
        <div className="header-actions">
          {wallet && (
            <Button variant="secondary" className="btn-sm btn-icon" onClick={loadData} disabled={loadingData}>
              <RefreshCw size={14} className={loadingData ? 'animate-spin' : ''} />
            </Button>
          )}
          {wallet ? (
            <>
              <Button variant="secondary" className="btn-sm" onClick={() => {
                navigator.clipboard.writeText(wallet);
                addToast('info', 'Address copied');
              }}>
                <Copy size={14} />
                {shortAddress(wallet)}
              </Button>
              <Button variant="danger" className="btn-sm btn-icon" onClick={handleDisconnect}>
                <LogOut size={14} />
              </Button>
            </>
          ) : (
            <Button onClick={handleConnect} isLoading={connecting}>
              <Wallet size={16} />
              Connect Wallet
            </Button>
          )}
        </div>
      </header>

      {/* Not Connected - Premium Landing Page */}
      {!wallet && (
        <div className="animate-fade-in" style={{ padding: '2rem 1rem 4rem' }}>
          
          {/* Hero Section */}
          <div style={{ textAlign: 'center', marginBottom: '4rem', position: 'relative' }}>
            {/* Background glow */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: '800px', height: '800px', background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 60%)',
              zIndex: -1, pointerEvents: 'none'
            }} />
            
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 90, height: 90, marginBottom: '1.5rem',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              borderRadius: '24px', boxShadow: '0 0 50px rgba(16,185,129,0.4)',
              border: '2px solid rgba(255,255,255,0.2)'
            }}>
              <Landmark size={46} color="#fff" />
            </div>
            
            <h1 style={{ 
              fontSize: '3.5rem', fontWeight: 800, marginBottom: '1rem', letterSpacing: '-0.03em',
              background: 'linear-gradient(to right, #F0FDF4, #A7C4B8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              lineHeight: 1.2
            }}>
              TreasuryBalancer
            </h1>
            
            <h2 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
              Autonomous AI Risk Management for DAOs
            </h2>
            
            <p style={{ color: 'var(--text-tertiary)', maxWidth: 680, margin: '0 auto 2.5rem', lineHeight: 1.8, fontSize: '1.1rem' }}>
              Protect your treasury from stablecoin depegs and insolvency events before they crash the market. 
              GenLayer AI validators independently scan the web, analyze threats, and auto-rebalance your assets into safe reserves.
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <Button onClick={handleConnect} isLoading={connecting} style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', borderRadius: '12px' }}>
                <Wallet size={22} />
                Connect MetaMask to Start
              </Button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid-3" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <Card hoverable className="stat-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', background: 'var(--bg-glass)' }}>
              <div style={{ margin: '0 auto 1.5rem', display: 'flex', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                <ScanSearch size={44} />
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Real-Time Scanning</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Continuously monitor DeFi news, forum feeds, and peg tracking sites for early warning signs of insolvency.
              </p>
            </Card>
            
            <Card hoverable className="stat-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', background: 'var(--bg-glass)' }}>
              <div style={{ margin: '0 auto 1.5rem', display: 'flex', justifyContent: 'center', color: 'var(--status-warning)' }}>
                <Shield size={44} />
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>AI Consensus</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                GenLayer validators run independent LLM threat analyses to verify FUD vs. systemic risk before acting.
              </p>
            </Card>
            
            <Card hoverable className="stat-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', background: 'var(--bg-glass)' }}>
              <div style={{ margin: '0 auto 1.5rem', display: 'flex', justifyContent: 'center', color: 'var(--status-info)' }}>
                <ArrowRightLeft size={44} />
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Auto-Rebalancing</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                If panic scores exceed the DAO threshold, at-risk capital is instantly moved to safe reserves.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* Connected UI */}
      {wallet && (
        <div className="animate-fade-in">
          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: '1.5rem' }}>
            {([
              { id: 'dashboard' as TabId, icon: <BarChart3 size={16} />, label: 'Dashboard' },
              { id: 'deposit' as TabId, icon: <PiggyBank size={16} />, label: 'Deposit / Withdraw' },
              { id: 'scanner' as TabId, icon: <ScanSearch size={16} />, label: 'Risk Scanner' },
              { id: 'rebalance' as TabId, icon: <ArrowRightLeft size={16} />, label: 'Manual Rebalance' },
            ]).map(t => (
              <button
                key={t.id}
                className={`tab ${tab === t.id ? 'tab-active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* ═══ Dashboard Tab ═══ */}
          {tab === 'dashboard' && (
            <div className="animate-fade-in">
              {/* Allocation Overview */}
              <div className="section-title"><CircleDollarSign size={18} style={{ color: 'var(--accent-primary)' }} /> Treasury Allocations</div>

              <div className="grid-4" style={{ marginBottom: '1rem' }}>
                {[
                  { label: 'USDC', value: allocations?.usdc ?? 0, color: 'var(--asset-usdc)', badgeClass: 'badge-asset-usdc', barClass: 'allocation-bar-usdc' },
                  { label: 'USDT', value: allocations?.usdt ?? 0, color: 'var(--asset-usdt)', badgeClass: 'badge-asset-usdt', barClass: 'allocation-bar-usdt' },
                  { label: 'DAI', value: allocations?.dai ?? 0, color: 'var(--asset-dai)', badgeClass: 'badge-asset-dai', barClass: 'allocation-bar-dai' },
                  { label: 'Safe Reserve', value: allocations?.safe_reserve ?? 0, color: 'var(--asset-safe)', badgeClass: 'badge-asset-safe', barClass: 'allocation-bar-safe' },
                ].map(item => (
                  <Card key={item.label} hoverable>
                    <div className="stat-card">
                      <div className="flex-between">
                        <span className="stat-label">{item.label}</span>
                        <span className={`badge ${item.badgeClass}`} style={{ fontSize: '0.65rem' }}>
                          {allocations ? ((item.value / totalAlloc) * 100).toFixed(1) : '0'}%
                        </span>
                      </div>
                      <div className="stat-value" style={{ color: item.color }}>
                        {formatUSD(item.value)}
                      </div>
                      <div className="allocation-bar-container">
                        <div
                          className={`allocation-bar ${item.barClass}`}
                          style={{ width: allocations ? `${(item.value / totalAlloc) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Combined Bar */}
              {allocations && (
                <Card>
                  <CardContent>
                    <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                      <span className="section-title" style={{ marginBottom: 0 }}>
                        <Landmark size={16} style={{ color: 'var(--accent-primary)' }} /> Portfolio Distribution
                      </span>
                      <span className="stat-value stat-value-sm" style={{ color: 'var(--accent-primary)' }}>
                        {formatUSD(allocations.total_value)} Total
                      </span>
                    </div>
                    <div className="allocation-combined" style={{ marginBottom: '0.75rem' }}>
                      <div className="segment" style={{ width: `${allocPcts.usdc}%`, background: 'var(--asset-usdc)' }} />
                      <div className="segment" style={{ width: `${allocPcts.usdt}%`, background: 'var(--asset-usdt)' }} />
                      <div className="segment" style={{ width: `${allocPcts.dai}%`, background: 'var(--asset-dai)' }} />
                      <div className="segment" style={{ width: `${allocPcts.safe}%`, background: 'var(--asset-safe)' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
                      {[
                        { label: 'USDC', pct: allocPcts.usdc, color: 'var(--asset-usdc)' },
                        { label: 'USDT', pct: allocPcts.usdt, color: 'var(--asset-usdt)' },
                        { label: 'DAI', pct: allocPcts.dai, color: 'var(--asset-dai)' },
                        { label: 'Safe Reserve', pct: allocPcts.safe, color: 'var(--asset-safe)' },
                      ].map(s => (
                        <div key={s.label} className="flex-center">
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                          <span style={{ fontWeight: 700, color: s.color }}>{s.pct.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Risk Threshold */}
              <div className="section-spacing">
                <div className="section-title"><Shield size={18} style={{ color: 'var(--accent-primary)' }} /> Risk Configuration</div>
                <Card>
                  <CardContent>
                    <div className="grid-2">
                      <div>
                        <div className="stat-label" style={{ marginBottom: '0.5rem' }}>Current Panic Threshold</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span className="stat-value" style={{ color: panicColor(allocations?.risk_threshold ?? 0) }}>
                            {allocations?.risk_threshold ?? '—'}
                          </span>
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>/ 100</span>
                        </div>
                        <div className="panic-bar-container" style={{ marginTop: '0.5rem', maxWidth: 200 }}>
                          <div
                            className={`panic-bar ${panicBarClass(allocations?.risk_threshold ?? 0)}`}
                            style={{ width: `${allocations?.risk_threshold ?? 0}%` }}
                          />
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                          Auto-rebalance triggers when panic score exceeds this threshold
                        </p>
                      </div>
                      <div>
                        <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                          <label className="form-label">Update Threshold (0-100)</label>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                              className="form-input"
                              type="number"
                              min={0}
                              max={100}
                              placeholder="e.g. 70"
                              value={thresholdInput}
                              onChange={e => setThresholdInput(e.target.value)}
                            />
                            <Button
                              onClick={handleSetThreshold}
                              isLoading={thresholdLoading}
                              disabled={!thresholdInput}
                              className="btn-sm"
                            >
                              Set
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Reports */}
              <div className="section-spacing">
                <div className="flex-between">
                  <div className="section-title" style={{ marginBottom: 0 }}>
                    <FileText size={18} style={{ color: 'var(--accent-primary)' }} /> Risk Reports
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                    {reportCount} total report{reportCount !== 1 ? 's' : ''}
                  </span>
                </div>

                {reports.length === 0 ? (
                  <Card>
                    <div className="empty-state">
                      <div className="empty-state-icon"><ScanSearch size={40} /></div>
                      <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No risk reports yet</p>
                      <p style={{ fontSize: '0.85rem' }}>Run a risk scan from the Scanner tab to generate AI-powered analysis</p>
                    </div>
                  </Card>
                ) : (
                  <div>
                    {reports.map((r, idx) => (
                      <Card key={idx} className="report-card" hoverable>
                        <div className="report-header">
                          <div className="flex-center">
                            <div className="risk-indicator">
                              <div className={`risk-dot ${riskDotClass(r.risk_level)}`} />
                            </div>
                            <span className={`badge ${riskBadgeClass(r.risk_level)}`}>
                              {r.risk_level}
                            </span>
                            {r.target_asset && (
                              <span className={`badge ${assetBadgeClass(r.target_asset)}`}>
                                {r.target_asset}
                              </span>
                            )}
                          </div>
                          <div className="flex-center">
                            <span className={`badge ${
                              r.action_taken === 'REBALANCED' ? 'badge-critical' :
                              r.action_taken === 'MONITORING' ? 'badge-medium' : 'badge-safe'
                            }`}>
                              {r.action_taken || 'ANALYZED'}
                            </span>
                            {r.rebalanced_amount > 0 && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--status-warning)', fontWeight: 600 }}>
                                {formatUSD(r.rebalanced_amount)} moved
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="report-metrics">
                          <div className="report-metric">
                            <div className="report-metric-label">Panic Score</div>
                            <div className="report-metric-value" style={{ color: panicColor(r.panic_score) }}>
                              {r.panic_score}%
                            </div>
                            <div className="panic-bar-container" style={{ marginTop: '0.25rem' }}>
                              <div
                                className={`panic-bar ${panicBarClass(r.panic_score)}`}
                                style={{ width: `${r.panic_score}%` }}
                              />
                            </div>
                          </div>
                          <div className="report-metric">
                            <div className="report-metric-label">Depeg Probability</div>
                            <div className="report-metric-value" style={{ color: panicColor(r.depeg_probability) }}>
                              {r.depeg_probability}%
                            </div>
                          </div>
                          <div className="report-metric">
                            <div className="report-metric-label">Recommendation</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '0.15rem' }}>
                              {r.recommendation}
                            </div>
                          </div>
                        </div>

                        {r.analysis_summary && (
                          <div className="report-summary">
                            <strong style={{ color: 'var(--text-primary)', fontSize: '0.75rem' }}>Analysis: </strong>
                            {r.analysis_summary}
                          </div>
                        )}

                        {r.sentiment_indicators && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.4rem' }}>
                            <strong style={{ color: 'var(--text-secondary)' }}>Sentiment: </strong>
                            {r.sentiment_indicators}
                          </div>
                        )}

                        {(r.news_url || r.forum_url) && (
                          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}>
                            {r.news_url && r.news_url !== "News URL unreachable" && (
                              <a href={r.news_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-secondary)' }}>
                                <ExternalLink size={12} /> News Source
                              </a>
                            )}
                            {r.forum_url && r.forum_url !== "Forum URL unreachable" && (
                              <a href={r.forum_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-secondary)' }}>
                                <ExternalLink size={12} /> Forum Source
                              </a>
                            )}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ Deposit / Withdraw Tab ═══ */}
          {tab === 'deposit' && (
            <div className="animate-fade-in">
              <div className="grid-2">
                {/* Deposit */}
                <Card>
                  <CardHeader>
                    <div className="flex-between">
                      <div className="flex-center">
                        <PiggyBank size={18} style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ fontWeight: 700 }}>Deposit Funds</span>
                      </div>
                      <Button variant="secondary" className="btn-sm" onClick={fillExampleDeposit}>
                        <Zap size={14} /> Try Example
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="form-group">
                      <label className="form-label">Asset</label>
                      <select
                        className="form-select"
                        value={depositAsset}
                        onChange={e => setDepositAsset(e.target.value)}
                      >
                        {ASSETS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <Input
                      label="Amount (USD)"
                      type="number"
                      placeholder="e.g. 1000000"
                      value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      tooltip="Amount in whole USD to deposit into the treasury"
                    />
                    {depositAmount && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
                        Depositing <strong style={{ color: assetColor(depositAsset) }}>{formatUSD(parseInt(depositAmount) || 0)} {depositAsset}</strong>
                      </p>
                    )}
                    <Button
                      onClick={handleDeposit}
                      isLoading={depositLoading}
                      disabled={!depositAmount}
                      style={{ width: '100%' }}
                    >
                      <PiggyBank size={16} /> Deposit
                    </Button>
                  </CardContent>
                </Card>

                {/* Withdraw */}
                <Card>
                  <CardHeader>
                    <div className="flex-center">
                      <TrendingDown size={18} style={{ color: 'var(--status-warning)' }} />
                      <span style={{ fontWeight: 700 }}>Withdraw Funds</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="form-group">
                      <label className="form-label">Asset</label>
                      <select
                        className="form-select"
                        value={withdrawAsset}
                        onChange={e => setWithdrawAsset(e.target.value)}
                      >
                        {ASSETS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <Input
                      label="Amount (USD)"
                      type="number"
                      placeholder="e.g. 500000"
                      value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      tooltip="Amount in whole USD to withdraw from the treasury"
                    />
                    {withdrawAmount && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
                        Withdrawing <strong style={{ color: assetColor(withdrawAsset) }}>{formatUSD(parseInt(withdrawAmount) || 0)} {withdrawAsset}</strong>
                      </p>
                    )}
                    <Button
                      variant="danger"
                      onClick={handleWithdraw}
                      isLoading={withdrawLoading}
                      disabled={!withdrawAmount}
                      style={{ width: '100%' }}
                    >
                      <TrendingDown size={16} /> Withdraw
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Current Balances Quick View */}
              {allocations && (
                <div className="section-spacing">
                  <div className="section-title"><BarChart3 size={18} style={{ color: 'var(--accent-primary)' }} /> Current Balances</div>
                  <div className="grid-3">
                    {[
                      { label: 'USDC', value: allocations.usdc, color: 'var(--asset-usdc)' },
                      { label: 'USDT', value: allocations.usdt, color: 'var(--asset-usdt)' },
                      { label: 'DAI', value: allocations.dai, color: 'var(--asset-dai)' },
                    ].map(b => (
                      <Card key={b.label} hoverable>
                        <div className="stat-card">
                          <span className="stat-label">{b.label}</span>
                          <span className="stat-value stat-value-sm" style={{ color: b.color }}>
                            {formatUSD(b.value)}
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ Risk Scanner Tab ═══ */}
          {tab === 'scanner' && (
            <div className="animate-fade-in">
              <Card>
                <CardHeader>
                  <div className="flex-between">
                    <div className="flex-center">
                      <ScanSearch size={18} style={{ color: 'var(--accent-primary)' }} />
                      <span style={{ fontWeight: 700 }}>AI Risk Scanner</span>
                    </div>
                    <Button variant="secondary" className="btn-sm" onClick={fillExampleScan}>
                      <BookOpen size={14} /> Try Example
                    </Button>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                    Submit news articles and forum data for AI-powered risk analysis. GenLayer validators will analyze sentiment,
                    assess depeg probability, and automatically rebalance if the panic score exceeds your threshold.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Target Asset</label>
                      <select
                        className="form-select"
                        value={scanTarget}
                        onChange={e => setScanTarget(e.target.value)}
                      >
                        {ASSETS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <Input
                      label="News / Article URL"
                      placeholder="https://coindesk.com/article/..."
                      value={scanNewsUrl}
                      onChange={e => setScanNewsUrl(e.target.value)}
                      tooltip="URL of news article or report about the stablecoin risk event"
                    />
                  </div>

                  <Input
                    label="Forum / Tracking URL"
                    placeholder="https://coingecko.com/en/coins/..."
                    value={scanForumUrl}
                    onChange={e => setScanForumUrl(e.target.value)}
                    tooltip="URL of community forum, CoinGecko page, or price tracker"
                  />

                  <div className="form-group">
                    <label className="form-label">Risk Description</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Describe the risk scenario, market conditions, and any observable indicators..."
                      rows={4}
                      value={scanDescription}
                      onChange={e => setScanDescription(e.target.value)}
                    />
                  </div>

                  {scanTarget && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div className="flex-center" style={{ fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>Scanning:</span>
                        <span className={`badge ${assetBadgeClass(scanTarget)}`}>{scanTarget}</span>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleScan}
                    isLoading={scanLoading}
                    disabled={!scanNewsUrl || !scanDescription}
                    style={{ width: '100%' }}
                  >
                    <ScanSearch size={16} /> Run AI Risk Scan & Auto-Rebalance
                  </Button>

                  {scanStatus && (
                    <div className="status-text">
                      <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                      {scanStatus}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* How It Works */}
              <div className="section-spacing">
                <div className="section-title"><Zap size={18} style={{ color: 'var(--accent-primary)' }} /> How AI Risk Scanning Works</div>
                <div className="grid-3">
                  {[
                    {
                      icon: <BookOpen size={20} />,
                      title: 'News Analysis',
                      desc: 'AI validators fetch and analyze news articles for risk signals, sentiment, and market impact indicators.'
                    },
                    {
                      icon: <Activity size={20} />,
                      title: 'Risk Assessment',
                      desc: 'Panic score (0-100), depeg probability, and risk level are calculated from multi-source analysis.'
                    },
                    {
                      icon: <ArrowRightLeft size={20} />,
                      title: 'Auto-Rebalance',
                      desc: 'If panic score exceeds your threshold, funds are automatically moved to Safe Reserve to protect against losses.'
                    },
                  ].map((step, i) => (
                    <Card key={i} hoverable>
                      <div className="stat-card">
                        <div style={{ color: 'var(--accent-primary)', marginBottom: '0.25rem' }}>{step.icon}</div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{step.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{step.desc}</div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ Manual Rebalance Tab ═══ */}
          {tab === 'rebalance' && (
            <div className="animate-fade-in">
              <Card>
                <CardHeader>
                  <div className="flex-center">
                    <ArrowRightLeft size={18} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontWeight: 700 }}>Manual Rebalance</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                    Manually move funds between stablecoin allocations or into the safe reserve.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid-3">
                    <div className="form-group">
                      <label className="form-label">From Asset</label>
                      <select
                        className="form-select"
                        value={rebalFrom}
                        onChange={e => setRebalFrom(e.target.value)}
                      >
                        {ALL_ASSETS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">To Asset</label>
                      <select
                        className="form-select"
                        value={rebalTo}
                        onChange={e => setRebalTo(e.target.value)}
                      >
                        {ALL_ASSETS.filter(a => a !== rebalFrom).map(a => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>
                    <Input
                      label="Amount (USD)"
                      type="number"
                      placeholder="e.g. 1000000"
                      value={rebalAmount}
                      onChange={e => setRebalAmount(e.target.value)}
                      tooltip="Amount in whole USD to move between allocations"
                    />
                  </div>

                  {rebalAmount && (
                    <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-glass-border)' }}>
                      <div className="flex-center" style={{ fontSize: '0.85rem', justifyContent: 'center', gap: '0.75rem' }}>
                        <span className={`badge ${assetBadgeClass(rebalFrom)}`}>{rebalFrom}</span>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                          {formatUSD(parseInt(rebalAmount) || 0)}
                        </span>
                        <ArrowRightLeft size={16} style={{ color: 'var(--accent-primary)' }} />
                        <span className={`badge ${assetBadgeClass(rebalTo)}`}>{rebalTo}</span>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleRebalance}
                    isLoading={rebalLoading}
                    disabled={!rebalAmount || rebalFrom === rebalTo}
                    style={{ width: '100%' }}
                  >
                    <ArrowRightLeft size={16} /> Execute Rebalance
                  </Button>
                </CardContent>
              </Card>

              {/* Current allocations for reference */}
              {allocations && (
                <div className="section-spacing">
                  <div className="section-title"><BarChart3 size={18} style={{ color: 'var(--accent-primary)' }} /> Current Allocations</div>
                  <div className="grid-4">
                    {[
                      { label: 'USDC', value: allocations.usdc, color: 'var(--asset-usdc)', barClass: 'allocation-bar-usdc' },
                      { label: 'USDT', value: allocations.usdt, color: 'var(--asset-usdt)', barClass: 'allocation-bar-usdt' },
                      { label: 'DAI', value: allocations.dai, color: 'var(--asset-dai)', barClass: 'allocation-bar-dai' },
                      { label: 'Safe Reserve', value: allocations.safe_reserve, color: 'var(--asset-safe)', barClass: 'allocation-bar-safe' },
                    ].map(item => (
                      <Card key={item.label} hoverable>
                        <div className="stat-card">
                          <span className="stat-label">{item.label}</span>
                          <span className="stat-value stat-value-sm" style={{ color: item.color }}>
                            {formatUSD(item.value)}
                          </span>
                          <div className="allocation-bar-container">
                            <div
                              className={`allocation-bar ${item.barClass}`}
                              style={{ width: `${(item.value / totalAlloc) * 100}%` }}
                            />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ Transaction Log ═══ */}
          <div className="section-spacing">
            <Card>
              <div
                style={{ padding: '0.85rem 1.25rem', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setTxLogOpen(prev => !prev)}
              >
                <div className="flex-between">
                  <div className="flex-center">
                    <Activity size={16} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Transaction Log</span>
                    {txLog.length > 0 && (
                      <span className="badge badge-safe" style={{ fontSize: '0.65rem' }}>{txLog.length}</span>
                    )}
                  </div>
                  {txLogOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>
              {txLogOpen && (
                <div style={{ padding: '0 1.25rem 1rem', borderTop: '1px solid var(--border-subtle)' }}>
                  {txLog.length === 0 ? (
                    <div className="empty-state" style={{ padding: '1.5rem 0' }}>
                      <p style={{ fontSize: '0.85rem' }}>No transactions yet</p>
                    </div>
                  ) : (
                    <div className="tx-log" style={{ marginTop: '0.5rem' }}>
                      {txLog.map((tx, i) => (
                        <div key={i} className="tx-entry">
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{tx.label}</span>
                            <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tx.time}</span>
                          </div>
                          <a
                            className="tx-hash-link"
                            href={`${EXPLORER_URL}/transactions/${tx.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {tx.hash.slice(0, 10)}…{tx.hash.slice(-6)}
                            <ExternalLink size={11} style={{ marginLeft: '0.3rem', verticalAlign: '-1px' }} />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
