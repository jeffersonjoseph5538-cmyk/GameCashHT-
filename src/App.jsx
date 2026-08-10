import React, { useState, useEffect } from 'react';
import { Gem, Home, ShoppingCart, Tag, Clock, Wallet, User, Lock, Mail, Phone, Plus, ArrowUpRight, ArrowDownRight, X, Check, Copy, ChevronRight, LogOut, Shield, Image as ImageIcon, Save, Eye, EyeOff, Settings } from 'lucide-react';
import { supabase } from './supabaseClient.js';

const DEFAULT_CATALOG = {
  brand_name: 'GameCashHT',
  logo_url: '',
  merchant_moncash: '+509 3XXX XXXX',
  merchant_natcash: '+509 3XXX XXXX',
  games: [
    {
      id: 'freefire', name: 'Free Fire', color: '#FF6A00', imgUrl: '',
      gameCode: 'freefire_latam', requiresServerId: false,
      packs: [
        { id: 'ff1', label: '110 Diamants', price: 150, g2code: '110' },
        { id: 'ff2', label: '341 Diamants', price: 450, g2code: '341' },
        { id: 'ff3', label: '572 Diamants', price: 750, g2code: '572' },
        { id: 'ff4', label: '1166 Diamants', price: 1450, g2code: '1166' },
        { id: 'ff5', label: 'Booyah Pass', price: 800, g2code: 'Booyah Pass' },
      ]
    },
    {
      id: 'mlbb', name: 'Mobile Legends', color: '#00D2FF', imgUrl: '',
      gameCode: 'mlbb', requiresServerId: true,
      packs: [
        { id: 'ml1', label: '55 Diamants', price: 140, g2code: '55' },
        { id: 'ml2', label: '172 Diamants', price: 350, g2code: '172' },
        { id: 'ml3', label: '429 Diamants', price: 850, g2code: '429' },
        { id: 'ml4', label: '878 Diamants', price: 1700, g2code: '878' },
      ]
    },
    {
      id: 'pubg', name: 'PUBG Mobile', color: '#F2A900', imgUrl: '',
      gameCode: 'pubgm', requiresServerId: false,
      packs: [
        { id: 'pb1', label: '60 UC', price: 130, g2code: '60' },
        { id: 'pb2', label: '660 UC', price: 1300, g2code: '660' },
        { id: 'pb3', label: '1800 UC', price: 3250, g2code: '1800' },
        { id: 'pb4', label: '3850 UC', price: 6500, g2code: '3850' },
      ]
    }
  ]
};

const fmt = (n) => `${Number(n || 0).toLocaleString('fr-HT')} HTG`;

// ---------- Main App ----------
export default function App() {
  const [screen, setScreen] = useState('home');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // row from `users` table
  const [history, setHistory] = useState([]);
  const [pendingTx, setPendingTx] = useState([]); // toutes les transactions en attente (vue admin)
  const [catalog, setCatalog] = useState(DEFAULT_CATALOG);
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // Load catalog (public) + watch auth session
  useEffect(() => {
    loadCatalog();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id);
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      }
      if (newSession) loadProfile(newSession.user.id);
      else { setProfile(null); setHistory([]); setLoading(false); }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loadCatalog = async () => {
    const { data, error } = await supabase.from('catalog').select('*').eq('id', 1).maybeSingle();
    if (!error && data) {
      setCatalog({
        brand_name: data.brand_name || DEFAULT_CATALOG.brand_name,
        logo_url: data.logo_url || '',
        merchant_moncash: data.merchant_moncash || DEFAULT_CATALOG.merchant_moncash,
        merchant_natcash: data.merchant_natcash || DEFAULT_CATALOG.merchant_natcash,
        games: (data.games && data.games.length > 0) ? data.games : DEFAULT_CATALOG.games,
      });
    } else {
      // Aucune ligne encore: on en crée une avec les valeurs par défaut
      await supabase.from('catalog').upsert({ id: 1, ...DEFAULT_CATALOG, games: DEFAULT_CATALOG.games });
    }
  };

  const loadProfile = async (userId) => {
    const { data: userRow } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    setProfile(userRow || null);
    const { data: txs } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setHistory(txs || []);
    if (userRow?.is_admin) {
      await loadPendingTransactions();
    }
    setLoading(false);
  };

  const loadPendingTransactions = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, users:user_id(name, phone)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (!error) setPendingTx(data || []);
  };

  const refreshProfile = async () => {
    if (session) await loadProfile(session.user.id);
  };

  // ---------- Auth actions ----------
  const handleRegister = async (email, password, name, phone) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { showToast(error.message); return false; }
    if (data.user) {
      const { error: insertErr } = await supabase.from('users').insert({
        id: data.user.id, name, phone, password_hash: 'managed_by_supabase_auth', balance: 0, is_admin: false
      });
      if (insertErr) { showToast(insertErr.message); return false; }
    }
    setAuthOpen(false);
    showToast('Compte créé ! Vérifie ton email si demandé.');
    return true;
  };

  const handleLogin = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { showToast('Email ou mot de passe incorrect'); return false; }
    setAuthOpen(false);
    showToast('Bon retour !');
    return true;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setScreen('home');
  };

  // ---------- Deposits & purchases ----------
  const submitDeposit = async ({ method, amount, txId }) => {
    if (!session) return;
    const { error } = await supabase.from('transactions').insert({
      user_id: session.user.id, type: 'deposit', method, amount: Number(amount), tx_id: txId, status: 'pending'
    });
    if (error) { showToast(error.message); return; }
    setDepositOpen(false);
    showToast('Demande de dépôt envoyée. Traitement sous peu.');
    refreshProfile();
  };

  const submitPurchase = async (pack, game, playerId, serverId) => {
    if (!profile) { setAuthOpen(true); return; }
    if (profile.balance < pack.price) {
      showToast("Solde insuffisant. Fais un dépôt d'abord.");
      setBuyOpen(null);
      setDepositOpen(true);
      return;
    }
    const { data: txRow, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: session.user.id, type: 'purchase', game: game.name, pack_label: pack.label,
        amount: pack.price, status: 'pending', player_id: playerId, server_id: serverId || null
      })
      .select()
      .single();
    if (txError) { showToast(txError.message); return; }

    const { error: balError } = await supabase
      .from('users')
      .update({ balance: profile.balance - pack.price })
      .eq('id', session.user.id);
    if (balError) { showToast(balError.message); return; }

    setBuyOpen(null);
    showToast('Commande envoyée, livraison en cours...');
    refreshProfile();

    // Déclenche la livraison automatique via G2Bulk
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`https://fyxzxjlldbnftbbhiosm.supabase.co/functions/v1/place-topup-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          transactionId: txRow.id,
          gameCode: game.gameCode,
          catalogueName: pack.g2code,
          playerId,
          serverId: serverId || undefined
        })
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        showToast(`Livraison en attente: ${result.error || 'vérification manuelle nécessaire'}`);
      } else {
        showToast('Livraison en cours, tu recevras ton crédit sous peu !');
      }
    } catch (e) {
      showToast('Commande enregistrée, livraison en cours de traitement.');
    }
    refreshProfile();
  };

  // ---------- Admin: save catalog ----------
  const saveCatalog = async (c) => {
    const { error } = await supabase.from('catalog').upsert({ id: 1, ...c });
    if (error) { showToast(error.message); return; }
    setCatalog(c);
    showToast('Modifications enregistrées et visibles par tous.');
  };

  // ---------- Admin: approve/reject transactions ----------
  const approveDeposit = async (tx) => {
    const { data: userRow } = await supabase.from('users').select('balance').eq('id', tx.user_id).maybeSingle();
    if (!userRow) { showToast("Client introuvable"); return; }
    const { error: balErr } = await supabase
      .from('users')
      .update({ balance: Number(userRow.balance) + Number(tx.amount) })
      .eq('id', tx.user_id);
    if (balErr) { showToast(balErr.message); return; }
    const { error: txErr } = await supabase.from('transactions').update({ status: 'completed' }).eq('id', tx.id);
    if (txErr) { showToast(txErr.message); return; }
    showToast('Dépôt approuvé, solde crédité.');
    await loadPendingTransactions();
  };

  const rejectDeposit = async (tx) => {
    const { error } = await supabase.from('transactions').update({ status: 'rejected' }).eq('id', tx.id);
    if (error) { showToast(error.message); return; }
    showToast('Dépôt rejeté.');
    await loadPendingTransactions();
  };

  const approvePurchase = async (tx) => {
    const { error } = await supabase.from('transactions').update({ status: 'completed' }).eq('id', tx.id);
    if (error) { showToast(error.message); return; }
    showToast('Commande marquée comme livrée.');
    await loadPendingTransactions();
  };

  const rejectPurchase = async (tx) => {
    const { data: userRow } = await supabase.from('users').select('balance').eq('id', tx.user_id).maybeSingle();
    if (userRow) {
      await supabase.from('users').update({ balance: Number(userRow.balance) + Number(tx.amount) }).eq('id', tx.user_id);
    }
    const { error } = await supabase.from('transactions').update({ status: 'rejected' }).eq('id', tx.id);
    if (error) { showToast(error.message); return; }
    showToast('Commande rejetée, client remboursé.');
    await loadPendingTransactions();
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Gem size={40} color="#5B5FEF" className="animate-pulse" />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0B0E1A', color: '#F5F6FA',
      fontFamily: "'Inter', -apple-system, sans-serif", display: 'flex', flexDirection: 'column',
      maxWidth: 480, margin: '0 auto', position: 'relative'
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .animate-pulse { animation: pulse 1.5s infinite; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
        button { font-family: inherit; cursor: pointer; }
        input { font-family: inherit; }
      `}</style>

      <Header catalog={catalog} profile={profile} onAuthClick={() => setAuthOpen(true)} onLogout={handleLogout} onAdminClick={() => setScreen('admin')} onAccountClick={() => setAccountOpen(true)} />

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90 }}>
        {screen === 'home' && (
          <HomeScreen catalog={catalog} onSelectGame={(g) => { setSelectedGame(g); setScreen('boutique'); }} />
        )}
        {screen === 'boutique' && (
          <BoutiqueScreen
            catalog={catalog} selectedGame={selectedGame} setSelectedGame={setSelectedGame}
            onBuy={(pack, game) => { if (!session) { setAuthOpen(true); } else { setBuyOpen({ pack, game }); } }}
          />
        )}
        {screen === 'promos' && <PromosScreen />}
        {screen === 'historique' && <HistoriqueScreen history={history} session={session} onAuthClick={() => setAuthOpen(true)} />}
        {screen === 'wallet' && (
          <WalletScreen profile={profile} history={history} session={session} onAuthClick={() => setAuthOpen(true)} onDeposit={() => setDepositOpen(true)} />
        )}
        {screen === 'admin' && profile?.is_admin && (
          <AdminScreen
            catalog={catalog}
            onSaveCatalog={saveCatalog}
            showToast={showToast}
            pendingTx={pendingTx}
            onApproveDeposit={approveDeposit}
            onRejectDeposit={rejectDeposit}
            onApprovePurchase={approvePurchase}
            onRejectPurchase={rejectPurchase}
          />
        )}
      </div>

      <BottomNav screen={screen} setScreen={setScreen} />

      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onLogin={handleLogin}
          onRegister={handleRegister}
        />
      )}
      {depositOpen && session && (
        <DepositModal catalog={catalog} onClose={() => setDepositOpen(false)} onSubmit={submitDeposit} />
      )}
      {buyOpen && (
        <BuyModal pack={buyOpen.pack} game={buyOpen.game} profile={profile} onClose={() => setBuyOpen(null)} onConfirm={(playerId, serverId) => submitPurchase(buyOpen.pack, buyOpen.game, playerId, serverId)} />
      )}
      {accountOpen && (
        <AccountModal onClose={() => setAccountOpen(false)} showToast={showToast} />
      )}
      {recoveryMode && (
        <RecoveryModal onClose={() => setRecoveryMode(false)} showToast={showToast} />
      )}
      {toast && <Toast message={toast} />}
    </div>
  );
}

// ---------- Header ----------
function Header({ catalog, profile, onAuthClick, onLogout, onAdminClick, onAccountClick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid #1A1F33' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {catalog.logo_url ? (
          <img src={catalog.logo_url} alt="logo" style={{ width: 34, height: 34, borderRadius: 10, objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #7B2FF7, #F72585)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Gem size={18} color="#fff" />
          </div>
        )}
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: 0.3 }}>{catalog.brand_name}</div>
          <div style={{ fontSize: 9, color: '#6B7280', letterSpacing: 1, marginTop: -3 }}>HAÏTI</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {profile?.is_admin && (
          <button onClick={onAdminClick} style={{ background: '#7B2FF722', border: '1px solid #7B2FF755', borderRadius: 20, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 4, color: '#B794F6' }}>
            <Shield size={14} />
          </button>
        )}
        {profile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1A1F33', borderRadius: 20, padding: '6px 6px 6px 12px' }}>
            <button onClick={onAccountClick} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 6, color: '#F5F6FA', fontSize: 13, fontWeight: 600 }}>
              <User size={14} /> {profile.name?.split(' ')[0]}
            </button>
            <button onClick={onLogout} style={{ background: '#0F1220', border: 'none', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogOut size={12} color="#6B7280" />
            </button>
          </div>
        ) : (
          <button onClick={onAuthClick} style={{ background: 'linear-gradient(135deg, #5B5FEF, #7B2FF7)', border: 'none', borderRadius: 20, padding: '9px 16px', color: '#fff', fontSize: 13, fontWeight: 700 }}>
            Connexion
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Promo Carousel (cartes swipeables avec pagination) ----------
function PromoCarousel({ slides }) {
  const trackRef = React.useRef(null);
  const [active, setActive] = useState(0);

  const handleScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.min(idx, slides.length - 1));
  };

  const goTo = (i) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  // Défilement automatique toutes les 4.5s (s'arrête si l'utilisateur interagit puis reprend)
  useEffect(() => {
    const timer = setInterval(() => {
      const el = trackRef.current;
      if (!el) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % slides.length;
      goTo(next);
    }, 4500);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div style={{ marginBottom: 24 }}>
      <style>{`
        .promo-carousel-track {
          display: flex;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          -ms-overflow-style: none;
          border-radius: 18px;
        }
        .promo-carousel-track::-webkit-scrollbar { display: none; }
        .promo-carousel-slide {
          flex: 0 0 100%;
          scroll-snap-align: start;
        }
      `}</style>
      <div className="promo-carousel-track" ref={trackRef} onScroll={handleScroll}>
        {slides.map((s, i) => (
          <div key={i} className="promo-carousel-slide">
            <div style={{
              display: 'flex', alignItems: 'stretch', minHeight: 140, borderRadius: 18,
              background: s.bg || 'linear-gradient(135deg, #1A1040, #3A0F5F)',
              border: '1px solid #2E1F5E', overflow: 'hidden'
            }}>
              {s.image && (
                <div style={{ width: 90, flexShrink: 0, background: `url(${s.image}) center/cover` }} />
              )}
              <div style={{ padding: '18px 18px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {s.icon && (
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#0000003a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <s.icon size={20} color="#F2C94C" />
                  </div>
                )}
                <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.25, marginBottom: 6 }}>{s.title}</div>
                {s.subtitle && <div style={{ fontSize: 13, color: '#C4C9DE', marginBottom: 14 }}>{s.subtitle}</div>}
                {s.button && (
                  <a
                    href={s.href}
                    target={s.href ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    onClick={e => { if (!s.href) e.preventDefault(); }}
                    style={{
                      alignSelf: 'flex-start', background: '#2DD4EF', color: '#0B0E1A', fontWeight: 800,
                      fontSize: 13, padding: '10px 18px', borderRadius: 12, textDecoration: 'none'
                    }}
                  >
                    {s.button}
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            style={{
              width: i === active ? 18 : 6, height: 6, borderRadius: 3, border: 'none',
              background: i === active ? '#2DD4EF' : '#2E1F5E', transition: 'width 0.25s, background 0.25s', padding: 0, cursor: 'pointer'
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ---------- Home Screen ----------
function HomeScreen({ catalog, onSelectGame }) {
  const games = catalog.games;
  return (
    <div style={{ padding: 18 }}>
      <div style={{ position: 'relative', marginBottom: 18 }}>
        <input placeholder="Rechercher un jeu..." style={{ width: '100%', padding: '13px 16px 13px 42px', borderRadius: 14, background: '#141829', border: '1px solid #232842', color: '#F5F6FA', fontSize: 14, outline: 'none' }} />
        <span style={{ position: 'absolute', left: 14, top: 13, color: '#6B7280' }}>🔍</span>
      </div>

      <PromoCarousel slides={[
        {
          title: 'Diamants & UC livrés vite',
          subtitle: 'Dépose via MonCash ou NatCash, reçois ton crédit rapidement.',
          icon: Gem,
          bg: 'linear-gradient(135deg, #1A1040, #3A0F5F)',
        },
        {
          title: 'Rejoins notre canal WhatsApp',
          subtitle: 'Événements à venir, promos et annonces en avant-première.',
          icon: Phone,
          bg: 'linear-gradient(135deg, #0B3B3F, #0F5F63)',
          button: 'Canal WhatsApp',
          href: 'https://whatsapp.com/channel/0029VbD2LYq6RGJDEXUWA82j',
        },
        {
          title: 'Recharge instantanée',
          subtitle: 'Support rapide et crédit reçu en quelques minutes.',
          icon: Clock,
          bg: 'linear-gradient(135deg, #3A1040, #5F0F3A)',
        },
      ]} />

      <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 14 }}>Jeux Disponibles</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {games.map(game => (
          <button key={game.id} onClick={() => onSelectGame(game)} style={{ background: '#141829', border: '1px solid #232842', borderRadius: 16, padding: 0, overflow: 'hidden', textAlign: 'left' }}>
            <div style={{ height: 110, background: game.imgUrl ? `url(${game.imgUrl}) center 22%/cover no-repeat` : `linear-gradient(135deg, ${game.color}55, #0B0E1A)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {!game.imgUrl && <Gem size={30} color={game.color} />}
            </div>
            <div style={{ padding: '10px 12px 12px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{game.name}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>À partir de {fmt(game.packs[0]?.price)}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Boutique Screen ----------
function BoutiqueScreen({ catalog, selectedGame, setSelectedGame, onBuy }) {
  const games = catalog.games;
  const game = (selectedGame && games.find(g => g.id === selectedGame.id)) || games[0];
  if (!game) return null;
  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto' }}>
        {games.map(g => (
          <button key={g.id} onClick={() => setSelectedGame(g)} style={{
            padding: '9px 16px', borderRadius: 20, whiteSpace: 'nowrap',
            border: g.id === game.id ? 'none' : '1px solid #232842',
            background: g.id === game.id ? `linear-gradient(135deg, ${g.color}, ${g.color}99)` : '#141829',
            color: g.id === game.id ? '#0B0E1A' : '#C4C9DE', fontWeight: 700, fontSize: 13
          }}>{g.name}</button>
        ))}
      </div>

      <div style={{ borderRadius: 16, padding: 20, marginBottom: 20, background: game.imgUrl ? `linear-gradient(135deg, ${game.color}55, #141829cc), url(${game.imgUrl}) center 22%/cover no-repeat` : `linear-gradient(135deg, ${game.color}33, #141829)`, border: `1px solid ${game.color}44` }}>
        <div style={{ fontWeight: 800, fontSize: 19 }}>{game.name}</div>
        <div style={{ fontSize: 12, color: '#C4C9DE', marginTop: 4 }}>Choisis ton pack, le crédit arrive directement sur ton compte en jeu</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {game.packs.map(pack => (
          <button key={pack.id} onClick={() => onBuy(pack, game)} style={{ background: '#141829', border: '1px solid #232842', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${game.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Gem size={18} color={game.color} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{pack.label}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>Livraison rapide</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: game.color }}>{fmt(pack.price)}</div>
              <ChevronRight size={16} color="#6B7280" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Promos Screen ----------
function PromosScreen() {
  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 16 }}>Promos</div>
      <div style={{ borderRadius: 16, padding: 40, textAlign: 'center', background: '#141829', border: '1px solid #232842' }}>
        <Tag size={32} color="#6B7280" style={{ margin: '0 auto 12px' }} />
        <div style={{ color: '#9CA3AF', fontSize: 14 }}>Aucune promo active pour le moment.</div>
        <div style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>Reviens bientôt pour des offres spéciales !</div>
      </div>
    </div>
  );
}

// ---------- Historique Screen ----------
function HistoriqueScreen({ history, session, onAuthClick }) {
  if (!session) return <LoggedOutState onAuthClick={onAuthClick} text="Connecte-toi pour voir ton historique" />;
  const statusColor = { pending: '#F2A900', completed: '#22C55E', rejected: '#EF4444' };
  const statusLabel = { pending: 'En attente', completed: 'Complété', rejected: 'Rejeté' };
  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 16 }}>Historique</div>
      {history.length === 0 ? (
        <div style={{ borderRadius: 16, padding: 40, textAlign: 'center', background: '#141829', border: '1px solid #232842' }}>
          <Clock size={32} color="#6B7280" style={{ margin: '0 auto 12px' }} />
          <div style={{ color: '#9CA3AF', fontSize: 14 }}>Aucune transaction pour le moment.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {history.map(h => (
            <div key={h.id} style={{ background: '#141829', border: '1px solid #232842', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: h.type === 'deposit' ? '#22C55E22' : '#5B5FEF22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {h.type === 'deposit' ? <ArrowDownRight size={16} color="#22C55E" /> : <ArrowUpRight size={16} color="#5B5FEF" />}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{h.type === 'deposit' ? `Dépôt ${h.method}` : `${h.game} — ${h.pack_label}`}</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>{new Date(h.created_at).toLocaleString('fr-HT')}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: h.type === 'deposit' ? '#22C55E' : '#F5F6FA' }}>{h.type === 'deposit' ? '+' : '-'}{fmt(h.amount)}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: statusColor[h.status] }}>{statusLabel[h.status]}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Wallet Screen ----------
function WalletScreen({ profile, history, session, onAuthClick, onDeposit }) {
  if (!session || !profile) return <LoggedOutState onAuthClick={onAuthClick} text="Connecte-toi pour voir ton wallet" />;
  const pendingDeposits = history.filter(h => h.type === 'deposit' && h.status === 'pending');
  return (
    <div style={{ padding: 18 }}>
      <div style={{ borderRadius: 20, padding: 24, marginBottom: 20, background: 'linear-gradient(135deg, #5B5FEF, #7B2FF7)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ fontSize: 12, color: '#E0E1FF', fontWeight: 600, marginBottom: 6 }}>SOLDE DISPONIBLE</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', marginBottom: 20 }}>{fmt(profile.balance)}</div>
        <button onClick={onDeposit} style={{ background: '#fff', color: '#5B5FEF', border: 'none', borderRadius: 12, padding: '11px 20px', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Faire un dépôt
        </button>
      </div>

      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Dépôts en attente</div>
      {pendingDeposits.length === 0 ? (
        <div style={{ color: '#6B7280', fontSize: 13, padding: 8 }}>Aucun dépôt en attente.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pendingDeposits.map(h => (
            <div key={h.id} style={{ background: '#141829', border: '1px solid #232842', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{h.method} · {fmt(h.amount)}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>ID: {h.tx_id}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#F2A900' }}>En attente</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LoggedOutState({ onAuthClick, text }) {
  return (
    <div style={{ padding: 18 }}>
      <div style={{ borderRadius: 16, padding: 40, textAlign: 'center', background: '#141829', border: '1px solid #232842' }}>
        <User size={32} color="#6B7280" style={{ margin: '0 auto 12px' }} />
        <div style={{ color: '#9CA3AF', fontSize: 14, marginBottom: 16 }}>{text}</div>
        <button onClick={onAuthClick} style={{ background: 'linear-gradient(135deg, #5B5FEF, #7B2FF7)', border: 'none', borderRadius: 12, padding: '11px 20px', color: '#fff', fontWeight: 700, fontSize: 13 }}>Se connecter</button>
      </div>
    </div>
  );
}

// ---------- Admin Screen ----------
function AdminScreen({ catalog, onSaveCatalog, showToast, pendingTx, onApproveDeposit, onRejectDeposit, onApprovePurchase, onRejectPurchase }) {
  const [draft, setDraft] = useState(catalog);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setDraft(catalog); setDirty(false); }, [catalog]);

  const updateBrand = (field, value) => { setDraft(d => ({ ...d, [field]: value })); setDirty(true); };
  const updateGame = (gameId, field, value) => {
    setDraft(d => ({ ...d, games: d.games.map(g => g.id === gameId ? { ...g, [field]: value } : g) }));
    setDirty(true);
  };
  const updatePackPrice = (gameId, packId, price) => {
    setDraft(d => ({
      ...d,
      games: d.games.map(g => g.id === gameId
        ? { ...g, packs: g.packs.map(p => p.id === packId ? { ...p, price: Number(price) || 0 } : p) }
        : g)
    }));
    setDirty(true);
  };

  const handleSave = async () => { await onSaveCatalog(draft); setDirty(false); };

  const addNewGame = (newGame) => {
    setDraft(d => ({ ...d, games: [...d.games, newGame] }));
    setDirty(true);
    showToast(`${newGame.name} ajouté ! N'oublie pas d'enregistrer.`);
  };

  const removeGame = (gameId) => {
    setDraft(d => ({ ...d, games: d.games.filter(g => g.id !== gameId) }));
    setDirty(true);
  };

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Shield size={18} color="#B794F6" />
        <div style={{ fontWeight: 800, fontSize: 19 }}>Panneau Admin</div>
      </div>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>Ces changements sont visibles par tous les clients.</div>

      <SectionTitle>Transactions en attente ({pendingTx.length})</SectionTitle>
      {pendingTx.length === 0 ? (
        <div style={{ color: '#6B7280', fontSize: 13, padding: '8px 0 20px' }}>Aucune transaction en attente.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {pendingTx.map(tx => (
            <div key={tx.id} style={{ background: '#141829', border: '1px solid #232842', borderRadius: 14, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{tx.users?.name || 'Client inconnu'}</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>{tx.users?.phone}</div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 14, color: tx.type === 'deposit' ? '#22C55E' : '#5B5FEF' }}>
                  {fmt(tx.amount)}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#C4C9DE', marginBottom: 10 }}>
                {tx.type === 'deposit'
                  ? `Dépôt ${tx.method} · ID transaction: ${tx.tx_id}`
                  : `Achat: ${tx.game} — ${tx.pack_label}`}
              </div>
              <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 10 }}>{new Date(tx.created_at).toLocaleString('fr-HT')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => tx.type === 'deposit' ? onApproveDeposit(tx) : onApprovePurchase(tx)}
                  style={{ flex: 1, background: '#22C55E', border: 'none', borderRadius: 10, padding: '10px', color: '#fff', fontWeight: 700, fontSize: 13 }}
                >
                  {tx.type === 'deposit' ? 'Approuver' : 'Marquer livré'}
                </button>
                <button
                  onClick={() => tx.type === 'deposit' ? onRejectDeposit(tx) : onRejectPurchase(tx)}
                  style={{ flex: 1, background: '#EF444422', border: '1px solid #EF444455', borderRadius: 10, padding: '10px', color: '#EF4444', fontWeight: 700, fontSize: 13 }}
                >
                  Rejeter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionTitle>Identité de la marque</SectionTitle>
      <AdminField label="Nom de la marque" value={draft.brand_name} onChange={v => updateBrand('brand_name', v)} />
      <AdminField label="URL du logo" placeholder="https://..." value={draft.logo_url} onChange={v => updateBrand('logo_url', v)} icon={ImageIcon} />
      {draft.logo_url && (
        <div style={{ marginBottom: 16 }}>
          <img src={draft.logo_url} alt="preview logo" style={{ width: 50, height: 50, borderRadius: 12, objectFit: 'cover', border: '1px solid #232842' }} />
        </div>
      )}

      <SectionTitle>Numéros marchands</SectionTitle>
      <AdminField label="Numéro MonCash" value={draft.merchant_moncash} onChange={v => updateBrand('merchant_moncash', v)} />
      <AdminField label="Numéro NatCash" value={draft.merchant_natcash} onChange={v => updateBrand('merchant_natcash', v)} />

      <SectionTitle>Jeux & Prix</SectionTitle>
      {draft.games.map(game => (
        <div key={game.id} style={{ background: '#141829', border: '1px solid #232842', borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: game.imgUrl ? `url(${game.imgUrl}) center/cover` : `${game.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {!game.imgUrl && <Gem size={16} color={game.color} />}
              </div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{game.name}</div>
            </div>
            <button onClick={() => removeGame(game.id)} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 11, fontWeight: 700 }}>Retirer</button>
          </div>

          <AdminField label="URL de l'image du jeu" placeholder="https://..." value={game.imgUrl} onChange={v => updateGame(game.id, 'imgUrl', v)} icon={ImageIcon} small />

          <div style={{ fontSize: 11, color: '#6B7280', margin: '10px 0 6px', fontWeight: 700, letterSpacing: 0.5 }}>PRIX DES PACKS (HTG)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {game.packs.map(pack => (
              <div key={pack.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: 13, color: '#C4C9DE', flex: 1 }}>{pack.label}</div>
                <input type="number" value={pack.price} onChange={e => updatePackPrice(game.id, pack.id, e.target.value)} style={{ width: 100, padding: '8px 10px', borderRadius: 8, background: '#0F1220', border: '1px solid #232842', color: '#F5F6FA', fontSize: 13, textAlign: 'right', outline: 'none' }} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <AddGamePanel existingGameIds={draft.games.map(g => g.gameCode)} onAddGame={addNewGame} showToast={showToast} />

      <button onClick={handleSave} disabled={!dirty} style={{
        width: '100%', background: dirty ? 'linear-gradient(135deg, #5B5FEF, #7B2FF7)' : '#232842',
        border: 'none', borderRadius: 12, padding: '14px', color: '#fff', fontWeight: 700, fontSize: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6, marginBottom: 20
      }}>
        <Save size={16} /> {dirty ? 'Enregistrer les modifications' : 'Aucun changement'}
      </button>
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: 13, fontWeight: 800, color: '#B794F6', marginBottom: 10, marginTop: 4 }}>{children}</div>;
}

const RANDOM_COLORS = ['#FF6A00', '#00D2FF', '#F2A900', '#22C55E', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

function AddGamePanel({ existingGameIds, onAddGame, showToast }) {
  const [query, setQuery] = useState('');
  const [allGames, setAllGames] = useState(null); // null = pas encore chargé
  const [loadingGames, setLoadingGames] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [catalogue, setCatalogue] = useState(null);
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);
  const [selectedPacks, setSelectedPacks] = useState({}); // { catalogueId: { checked, price } }
  const [expanded, setExpanded] = useState(false);

  const FUNCTIONS_URL = 'https://fyxzxjlldbnftbbhiosm.supabase.co/functions/v1/g2bulk-catalog';

  const loadGamesList = async () => {
    if (allGames) return;
    setLoadingGames(true);
    try {
      const res = await fetch(`${FUNCTIONS_URL}?action=games`);
      const data = await res.json();
      setAllGames(data.games || []);
    } catch (e) {
      showToast('Erreur de chargement des jeux G2Bulk');
    }
    setLoadingGames(false);
  };

  const openPanel = () => {
    setExpanded(true);
    loadGamesList();
  };

  const selectGame = async (game) => {
    setSelectedGame(game);
    setCatalogue(null);
    setSelectedPacks({});
    setLoadingCatalogue(true);
    try {
      const res = await fetch(`${FUNCTIONS_URL}?action=catalogue&code=${game.code}`);
      const data = await res.json();
      setCatalogue(data.catalogues || []);
    } catch (e) {
      showToast('Erreur de chargement du catalogue');
    }
    setLoadingCatalogue(false);
  };

  const togglePack = (item) => {
    setSelectedPacks(prev => {
      const existing = prev[item.id];
      if (existing) {
        const { [item.id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [item.id]: { name: item.name, usdAmount: item.amount, price: Math.ceil(item.amount * 135 * 1.15 / 5) * 5 } };
    });
  };

  const updateSelectedPrice = (itemId, price) => {
    setSelectedPacks(prev => ({ ...prev, [itemId]: { ...prev[itemId], price: Number(price) || 0 } }));
  };

  const confirmAddGame = () => {
    const packs = Object.entries(selectedPacks).map(([id, val], idx) => ({
      id: `${selectedGame.code}_${idx}`,
      label: val.name,
      price: val.price,
      g2code: val.name
    }));
    if (packs.length === 0) { showToast('Sélectionne au moins un pack'); return; }

    const newGame = {
      id: selectedGame.code,
      name: selectedGame.name,
      color: RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)],
      imgUrl: '',
      gameCode: selectedGame.code,
      requiresServerId: false, // à ajuster manuellement si le jeu le nécessite
      packs
    };
    onAddGame(newGame);
    setExpanded(false);
    setSelectedGame(null);
    setCatalogue(null);
    setSelectedPacks({});
    setQuery('');
  };

  const filteredGames = allGames?.filter(g =>
    !existingGameIds.includes(g.code) &&
    g.name.toLowerCase().includes(query.toLowerCase())
  ) || [];

  return (
    <div style={{ marginBottom: 20 }}>
      <SectionTitle>Ajouter un jeu depuis G2Bulk</SectionTitle>

      {!expanded ? (
        <button onClick={openPanel} style={{
          width: '100%', background: '#141829', border: '1px dashed #3A4162', borderRadius: 14,
          padding: '16px', color: '#9CA3AF', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}>
          <Plus size={16} /> Parcourir le catalogue G2Bulk (180+ jeux)
        </button>
      ) : (
        <div style={{ background: '#141829', border: '1px solid #232842', borderRadius: 14, padding: 14 }}>
          {!selectedGame ? (
            <>
              <input
                placeholder="Rechercher un jeu (ex: valorant, mlbb...)"
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: '#0F1220', border: '1px solid #232842', color: '#F5F6FA', fontSize: 13, outline: 'none', marginBottom: 12 }}
              />
              {loadingGames ? (
                <div style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', padding: 20 }}>Chargement...</div>
              ) : (
                <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {query.length === 0 ? (
                    <div style={{ color: '#6B7280', fontSize: 12, textAlign: 'center', padding: 16 }}>Tape un nom de jeu pour chercher parmi {allGames?.length || 0} titres disponibles.</div>
                  ) : filteredGames.length === 0 ? (
                    <div style={{ color: '#6B7280', fontSize: 12, textAlign: 'center', padding: 16 }}>Aucun résultat.</div>
                  ) : (
                    filteredGames.slice(0, 20).map(g => (
                      <button
                        key={g.code}
                        onClick={() => selectGame(g)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#0F1220', border: '1px solid #232842', borderRadius: 10, color: '#F5F6FA', fontSize: 13, fontWeight: 600 }}
                      >
                        {g.name}
                        <ChevronRight size={14} color="#6B7280" />
                      </button>
                    ))
                  )}
                </div>
              )}
              <button onClick={() => setExpanded(false)} style={{ width: '100%', background: 'none', border: 'none', color: '#6B7280', fontSize: 12, marginTop: 10 }}>Fermer</button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{selectedGame.name}</div>
                <button onClick={() => { setSelectedGame(null); setCatalogue(null); }} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 12 }}>Changer</button>
              </div>

              {loadingCatalogue ? (
                <div style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', padding: 20 }}>Chargement du catalogue...</div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>Sélectionne les dénominations à vendre (prix suggéré modifiable) :</div>
                  <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {catalogue?.map(item => {
                      const isSelected = !!selectedPacks[item.id];
                      return (
                        <div key={item.id} style={{ background: isSelected ? '#5B5FEF15' : '#0F1220', border: `1px solid ${isSelected ? '#5B5FEF55' : '#232842'}`, borderRadius: 10, padding: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isSelected ? 8 : 0 }}>
                            <button onClick={() => togglePack(item)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', flex: 1, textAlign: 'left' }}>
                              <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${isSelected ? '#5B5FEF' : '#3A4162'}`, background: isSelected ? '#5B5FEF' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {isSelected && <Check size={12} color="#fff" />}
                              </div>
                              <span style={{ fontSize: 13, color: '#F5F6FA', fontWeight: 600 }}>{item.name}</span>
                            </button>
                            <span style={{ fontSize: 11, color: '#6B7280' }}>${item.amount}</span>
                          </div>
                          {isSelected && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                              <span style={{ fontSize: 11, color: '#9CA3AF' }}>Prix de vente (HTG)</span>
                              <input
                                type="number"
                                value={selectedPacks[item.id].price}
                                onChange={e => updateSelectedPrice(item.id, e.target.value)}
                                style={{ flex: 1, padding: '6px 10px', borderRadius: 8, background: '#0F1220', border: '1px solid #232842', color: '#F5F6FA', fontSize: 12, textAlign: 'right', outline: 'none' }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={confirmAddGame}
                    disabled={Object.keys(selectedPacks).length === 0}
                    style={{
                      width: '100%', background: Object.keys(selectedPacks).length > 0 ? 'linear-gradient(135deg, #5B5FEF, #7B2FF7)' : '#232842',
                      border: 'none', borderRadius: 12, padding: '12px', color: '#fff', fontWeight: 700, fontSize: 13
                    }}
                  >
                    Ajouter {selectedGame.name} ({Object.keys(selectedPacks).length} pack{Object.keys(selectedPacks).length > 1 ? 's' : ''})
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AdminField({ label, value, onChange, placeholder, icon: Icon, small }) {
  return (
    <div style={{ marginBottom: small ? 8 : 14 }}>
      <label style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 5, display: 'block' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        {Icon && <Icon size={14} color="#6B7280" style={{ position: 'absolute', left: 12, top: 12 }} />}
        <input value={value || ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: Icon ? '10px 12px 10px 34px' : '10px 12px', borderRadius: 10, background: '#0F1220', border: '1px solid #232842', color: '#F5F6FA', fontSize: 13, outline: 'none' }} />
      </div>
    </div>
  );
}

// ---------- Bottom Nav ----------
function BottomNav({ screen, setScreen }) {
  const items = [
    { id: 'home', label: 'Accueil', icon: Home },
    { id: 'boutique', label: 'Boutique', icon: ShoppingCart },
    { id: 'promos', label: 'Promos', icon: Tag },
    { id: 'historique', label: 'Historique', icon: Clock },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
  ];
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#0F1220', borderTop: '1px solid #1A1F33', display: 'flex', padding: '10px 4px 14px' }}>
      {items.map(item => {
        const Icon = item.icon;
        const active = screen === item.id;
        return (
          <button key={item.id} onClick={() => setScreen(item.id)} style={{ flex: 1, background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: active ? '#5B5FEF' : '#6B7280' }}>
            <Icon size={20} />
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Auth Modal ----------
function AuthModal({ onClose, onLogin, onRegister }) {
  const [mode, setMode] = useState('login'); // login, register, forgot
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setInfo('');
    if (mode === 'forgot') {
      if (!email) { setError('Entre ton email'); return; }
      setSubmitting(true);
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });
      setSubmitting(false);
      if (resetErr) { setError(resetErr.message); return; }
      setInfo('Email envoyé ! Vérifie ta boîte de réception pour réinitialiser ton mot de passe.');
      return;
    }
    if (!email || !password) { setError('Remplis tous les champs'); return; }
    if (mode === 'register' && (!name || !phone)) { setError('Entre ton nom et ton téléphone'); return; }
    setSubmitting(true);
    let ok;
    if (mode === 'login') ok = await onLogin(email, password);
    else ok = await onRegister(email, password, name, phone);
    setSubmitting(false);
    if (!ok) setError("Une erreur s'est produite. Vérifie tes informations.");
  };

  return (
    <ModalOverlay onClose={onClose}>
      {mode !== 'forgot' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <TabButton active={mode === 'login'} onClick={() => setMode('login')}>Connexion</TabButton>
          <TabButton active={mode === 'register'} onClick={() => setMode('register')}>Créer un compte</TabButton>
        </div>
      )}

      {mode === 'forgot' && (
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Réinitialiser le mot de passe</div>
      )}

      {mode === 'register' && (
        <>
          <FieldInput icon={User} placeholder="Ton nom" value={name} onChange={setName} />
          <FieldInput icon={Phone} placeholder="Numéro de téléphone" value={phone} onChange={setPhone} type="tel" />
        </>
      )}
      <FieldInput icon={Mail} placeholder="Email" value={email} onChange={setEmail} type="email" />
      {mode !== 'forgot' && (
        <FieldInput icon={Lock} placeholder="Mot de passe" value={password} onChange={setPassword} type="password" />
      )}

      {error && <div style={{ color: '#EF4444', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      {info && <div style={{ color: '#22C55E', fontSize: 12, marginBottom: 10 }}>{info}</div>}

      <button onClick={handleSubmit} disabled={submitting} style={{
        width: '100%', background: 'linear-gradient(135deg, #5B5FEF, #7B2FF7)',
        border: 'none', borderRadius: 12, padding: '13px', color: '#fff', fontWeight: 700, fontSize: 14, marginTop: 6, opacity: submitting ? 0.7 : 1
      }}>
        {submitting ? 'Chargement...' : mode === 'login' ? 'Se connecter' : mode === 'forgot' ? 'Envoyer le lien' : 'Créer mon compte'}
      </button>

      {mode === 'login' && (
        <button onClick={() => { setMode('forgot'); setError(''); setInfo(''); }} style={{ width: '100%', background: 'none', border: 'none', color: '#6B7280', fontSize: 12, marginTop: 14 }}>
          Mot de passe oublié ?
        </button>
      )}
      {mode === 'forgot' && (
        <button onClick={() => { setMode('login'); setError(''); setInfo(''); }} style={{ width: '100%', background: 'none', border: 'none', color: '#6B7280', fontSize: 12, marginTop: 14 }}>
          Retour à la connexion
        </button>
      )}
    </ModalOverlay>
  );
}

function FieldInput({ icon: Icon, placeholder, value, onChange, type = 'text' }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const actualType = isPassword ? (show ? 'text' : 'password') : type;
  return (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <Icon size={16} color="#6B7280" style={{ position: 'absolute', left: 14, top: 14 }} />
      <input
        type={actualType}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: isPassword ? '13px 42px 13px 40px' : '13px 14px 13px 40px', borderRadius: 12, background: '#0F1220', border: '1px solid #232842', color: '#F5F6FA', fontSize: 14, outline: 'none' }}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{ position: 'absolute', right: 12, top: 11, background: 'none', border: 'none', padding: 4 }}
        >
          {show ? <EyeOff size={16} color="#6B7280" /> : <Eye size={16} color="#6B7280" />}
        </button>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: active ? '#5B5FEF' : '#0F1220', color: active ? '#fff' : '#9CA3AF', fontWeight: 700, fontSize: 13 }}>
      {children}
    </button>
  );
}

// ---------- Deposit Modal ----------
function DepositModal({ catalog, onClose, onSubmit }) {
  const [method, setMethod] = useState('MonCash');
  const [amount, setAmount] = useState('');
  const [txId, setTxId] = useState('');
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const merchantNumber = catalog.merchant_natcash;

  const copyNumber = () => {
    navigator.clipboard?.writeText(merchantNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const canSubmitNatCash = amount && Number(amount) > 0 && txId.trim().length > 0;
  const canSubmitMonCash = amount && Number(amount) > 0;

  const handleMonCashPay = async () => {
    setError('');
    setProcessing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch('https://fyxzxjlldbnftbbhiosm.supabase.co/functions/v1/create-bazik-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount: Number(amount) })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Erreur lors de la création du paiement');
        setProcessing(false);
        return;
      }
      window.location.href = data.paymentUrl;
    } catch (e) {
      setError('Erreur de connexion. Réessaie.');
      setProcessing(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose} title="Faire un dépôt">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <TabButton active={method === 'MonCash'} onClick={() => setMethod('MonCash')}>MonCash</TabButton>
        <TabButton active={method === 'NatCash'} onClick={() => setMethod('NatCash')}>NatCash</TabButton>
      </div>

      {method === 'MonCash' ? (
        <>
          <div style={{ background: '#0F1220', border: '1px solid #232842', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>Paiement automatique — tu seras redirigé vers MonCash pour payer, ton solde sera crédité instantanément après paiement.</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6, display: 'block' }}>Montant à déposer (HTG)</label>
            <input type="number" placeholder="Ex: 500" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', padding: '13px 14px', borderRadius: 12, background: '#0F1220', border: '1px solid #232842', color: '#F5F6FA', fontSize: 14, outline: 'none' }} />
          </div>
          {error && <div style={{ color: '#EF4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <button onClick={handleMonCashPay} disabled={!canSubmitMonCash || processing} style={{ width: '100%', background: canSubmitMonCash ? 'linear-gradient(135deg, #5B5FEF, #7B2FF7)' : '#232842', border: 'none', borderRadius: 12, padding: '13px', color: '#fff', fontWeight: 700, fontSize: 14 }}>
            {processing ? 'Redirection...' : 'Payer avec MonCash'}
          </button>
        </>
      ) : (
        <>
          <div style={{ background: '#0F1220', border: '1px solid #232842', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>1. Envoie ton montant vers ce numéro NatCash :</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{merchantNumber}</div>
              <button onClick={copyNumber} style={{ background: '#1A1F33', border: 'none', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4, color: copied ? '#22C55E' : '#9CA3AF', fontSize: 11, fontWeight: 700 }}>
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 10 }}>2. Entre le montant envoyé et l'ID de transaction reçu par SMS ci-dessous.</div>
          </div>

          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6, display: 'block' }}>Montant envoyé (HTG)</label>
            <input type="number" placeholder="Ex: 500" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', padding: '13px 14px', borderRadius: 12, marginBottom: 12, background: '#0F1220', border: '1px solid #232842', color: '#F5F6FA', fontSize: 14, outline: 'none' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6, display: 'block' }}>ID de transaction</label>
            <input placeholder="Ex: TX123456789" value={txId} onChange={e => setTxId(e.target.value)} style={{ width: '100%', padding: '13px 14px', borderRadius: 12, background: '#0F1220', border: '1px solid #232842', color: '#F5F6FA', fontSize: 14, outline: 'none' }} />
          </div>

          <button onClick={() => canSubmitNatCash && onSubmit({ method: 'NatCash', amount, txId })} disabled={!canSubmitNatCash} style={{ width: '100%', background: canSubmitNatCash ? 'linear-gradient(135deg, #5B5FEF, #7B2FF7)' : '#232842', border: 'none', borderRadius: 12, padding: '13px', color: '#fff', fontWeight: 700, fontSize: 14 }}>
            Envoyer la demande de dépôt
          </button>
        </>
      )}
    </ModalOverlay>
  );
}

// ---------- Buy Modal ----------
function BuyModal({ pack, game, profile, onClose, onConfirm }) {
  const [playerId, setPlayerId] = useState('');
  const [serverId, setServerId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedName, setVerifiedName] = useState(null); // null = pas encore vérifié, '' = invalide, 'Nom' = valide
  const insufficient = profile && profile.balance < pack.price;

  const idsReady = playerId.trim().length > 0 && (!game.requiresServerId || serverId.trim().length > 0);

  const handleVerify = async () => {
    setVerifying(true);
    setVerifiedName(null);
    try {
      const res = await fetch(`https://fyxzxjlldbnftbbhiosm.supabase.co/functions/v1/verify-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameCode: game.gameCode, playerId, serverId: serverId || undefined })
      });
      const data = await res.json();
      if (data.valid) {
        setVerifiedName(data.name || 'Joueur trouvé');
      } else {
        setVerifiedName('');
      }
    } catch (e) {
      setVerifiedName('');
    }
    setVerifying(false);
  };

  const resetVerification = () => setVerifiedName(null);

  const canConfirm = !insufficient && verifiedName;

  return (
    <ModalOverlay onClose={onClose} title="Confirmer l'achat">
      <div style={{ background: '#0F1220', border: '1px solid #232842', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${game.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Gem size={20} color={game.color} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{game.name}</div>
            <div style={{ fontSize: 13, color: '#9CA3AF' }}>{pack.label}</div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid #232842', paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#9CA3AF' }}>Prix</span>
          <span style={{ fontWeight: 800, fontSize: 15 }}>{fmt(pack.price)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 13 }}>
        <span style={{ color: '#9CA3AF' }}>Ton solde</span>
        <span style={{ fontWeight: 700, color: insufficient ? '#EF4444' : '#22C55E' }}>{fmt(profile?.balance)}</span>
      </div>

      {!insufficient && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6, display: 'block' }}>ID du joueur</label>
            <input
              placeholder="Ex: 123456789"
              value={playerId}
              onChange={e => { setPlayerId(e.target.value); resetVerification(); }}
              style={{ width: '100%', padding: '13px 14px', borderRadius: 12, background: '#0F1220', border: '1px solid #232842', color: '#F5F6FA', fontSize: 14, outline: 'none' }}
            />
          </div>
          {game.requiresServerId && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6, display: 'block' }}>ID du serveur (zone)</label>
              <input
                placeholder="Ex: 2001"
                value={serverId}
                onChange={e => { setServerId(e.target.value); resetVerification(); }}
                style={{ width: '100%', padding: '13px 14px', borderRadius: 12, background: '#0F1220', border: '1px solid #232842', color: '#F5F6FA', fontSize: 14, outline: 'none' }}
              />
            </div>
          )}

          {verifiedName === null && (
            <button
              onClick={handleVerify}
              disabled={!idsReady || verifying}
              style={{
                width: '100%', background: idsReady ? '#1A1F33' : '#141829', border: '1px solid #232842',
                borderRadius: 12, padding: '12px', color: idsReady ? '#F5F6FA' : '#6B7280', fontWeight: 700, fontSize: 13, marginBottom: 16
              }}
            >
              {verifying ? 'Vérification...' : 'Vérifier le compte'}
            </button>
          )}

          {verifiedName === '' && (
            <div style={{ background: '#EF444422', border: '1px solid #EF444455', borderRadius: 10, padding: 10, marginBottom: 16, fontSize: 12, color: '#EF4444' }}>
              ID introuvable. Vérifie et réessaie.
            </div>
          )}

          {verifiedName && (
            <div style={{ background: '#22C55E22', border: '1px solid #22C55E55', borderRadius: 10, padding: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Check size={14} color="#22C55E" />
              <span style={{ fontSize: 13, color: '#22C55E', fontWeight: 700 }}>Compte trouvé : {verifiedName}</span>
            </div>
          )}
        </>
      )}

      {insufficient && <div style={{ fontSize: 12, color: '#F2A900', marginBottom: 12 }}>Solde insuffisant. Tu seras redirigé vers le dépôt.</div>}

      <button
        onClick={() => insufficient ? onConfirm() : (canConfirm && onConfirm(playerId, serverId))}
        disabled={!insufficient && !canConfirm}
        style={{
          width: '100%', background: (insufficient || canConfirm) ? 'linear-gradient(135deg, #5B5FEF, #7B2FF7)' : '#232842',
          border: 'none', borderRadius: 12, padding: '13px', color: '#fff', fontWeight: 700, fontSize: 14
        }}
      >
        {insufficient ? 'Faire un dépôt' : "Confirmer l'achat"}
      </button>
    </ModalOverlay>
  );
}

// ---------- Modal Overlay ----------
function ModalOverlay({ children, onClose, title }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#141829', borderRadius: '20px 20px 0 0', padding: 20, borderTop: '1px solid #232842', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ background: '#0F1220', border: 'none', borderRadius: 8, padding: 6 }}>
            <X size={16} color="#9CA3AF" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Account Modal (changer mot de passe) ----------
function AccountModal({ onClose, showToast }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChangePassword = async () => {
    setError('');
    if (!newPassword || newPassword.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères'); return; }
    if (newPassword !== confirmPassword) { setError('Les mots de passe ne correspondent pas'); return; }
    setSubmitting(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);
    if (updateErr) { setError(updateErr.message); return; }
    showToast('Mot de passe mis à jour !');
    onClose();
  };

  return (
    <ModalOverlay onClose={onClose} title="Mon compte">
      <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 16 }}>Changer ton mot de passe</div>
      <FieldInput icon={Lock} placeholder="Nouveau mot de passe" value={newPassword} onChange={setNewPassword} type="password" />
      <FieldInput icon={Lock} placeholder="Confirmer le mot de passe" value={confirmPassword} onChange={setConfirmPassword} type="password" />
      {error && <div style={{ color: '#EF4444', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <button onClick={handleChangePassword} disabled={submitting} style={{
        width: '100%', background: 'linear-gradient(135deg, #5B5FEF, #7B2FF7)', border: 'none',
        borderRadius: 12, padding: '13px', color: '#fff', fontWeight: 700, fontSize: 14, opacity: submitting ? 0.7 : 1
      }}>
        {submitting ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
      </button>
    </ModalOverlay>
  );
}

// ---------- Recovery Modal (après clic sur lien email "mot de passe oublié") ----------
function RecoveryModal({ onClose, showToast }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSetPassword = async () => {
    setError('');
    if (!newPassword || newPassword.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères'); return; }
    if (newPassword !== confirmPassword) { setError('Les mots de passe ne correspondent pas'); return; }
    setSubmitting(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);
    if (updateErr) { setError(updateErr.message); return; }
    showToast('Mot de passe défini ! Tu es connecté.');
    onClose();
  };

  return (
    <ModalOverlay onClose={onClose} title="Nouveau mot de passe">
      <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 16 }}>Choisis un nouveau mot de passe pour ton compte.</div>
      <FieldInput icon={Lock} placeholder="Nouveau mot de passe" value={newPassword} onChange={setNewPassword} type="password" />
      <FieldInput icon={Lock} placeholder="Confirmer le mot de passe" value={confirmPassword} onChange={setConfirmPassword} type="password" />
      {error && <div style={{ color: '#EF4444', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <button onClick={handleSetPassword} disabled={submitting} style={{
        width: '100%', background: 'linear-gradient(135deg, #5B5FEF, #7B2FF7)', border: 'none',
        borderRadius: 12, padding: '13px', color: '#fff', fontWeight: 700, fontSize: 14, opacity: submitting ? 0.7 : 1
      }}>
        {submitting ? 'Enregistrement...' : 'Définir le mot de passe'}
      </button>
    </ModalOverlay>
  );
}

function Toast({ message }) {
  return (
    <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: '#1A1F33', border: '1px solid #232842', borderRadius: 12, padding: '10px 18px', fontSize: 13, fontWeight: 600, zIndex: 100, whiteSpace: 'nowrap' }}>
      {message}
    </div>
  );
}
