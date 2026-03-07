import React, { useState, useEffect } from 'react';
import type { Account } from './types/game';
import { AION2_SERVERS, AION2_CLASSES, INITIAL_TRACKERS } from './types/game';
import { Users, Plus, Clock } from 'lucide-react';
import { calculateCurrentStatus } from './utils/ticketCalculator';

function App() {
  console.log('App Rendering...');
  const [accounts, setAccounts] = useState<Account[]>(() => {
    try {
      const saved = localStorage.getItem('aion2_rmt_data');
      if (!saved) return [];
      const parsed = JSON.parse(saved) as Account[];
      
      // 구버전 데이터 마이그레이션 (dungeons -> trackers 및 누락된 트래커 추가)
      return (parsed || []).map(acc => ({
        ...acc,
        characters: (acc.characters || []).map(char => {
          let updatedTrackers = char.trackers || [];
          
          // 1. dungeons에서 trackers로 전환하는 경우
          if ((char as any).dungeons && !char.trackers) {
            updatedTrackers = INITIAL_TRACKERS.map(t => ({ ...t, lastUpdatedAt: Date.now() }));
          }

          // 2. 기존 trackers에 누락된 항목(초월, 악몽, 슈고페스타 등)이 있는 경우 추가
          INITIAL_TRACKERS.forEach(initialTracker => {
            if (!updatedTrackers.find(t => t.id === initialTracker.id)) {
              updatedTrackers.push({ ...initialTracker, lastUpdatedAt: Date.now() });
            }
          });
          
          return {
            ...char,
            trackers: updatedTrackers
          };
        })
      }));
    } catch (e) {
      console.error('Failed to load data from localStorage', e);
      return [];
    }
  });

  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');

  useEffect(() => {
    console.log('Accounts updated:', accounts);
    localStorage.setItem('aion2_rmt_data', JSON.stringify(accounts));
  }, [accounts]);

  const addAccount = () => {
    if (!newAccountName.trim()) return;
    const newAccount: Account = {
      id: Date.now().toString(),
      name: newAccountName,
      characters: []
    };
    setAccounts([...accounts, newAccount]);
    setNewAccountName('');
    setIsAddingAccount(false);
  };

  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'block' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>아이온2 쌀먹관리기</h1>
          <p style={{ color: '#94a3b8' }}>티켓 충전 상태를 실시간으로 확인하세요</p>
        </div>
        <button onClick={() => setIsAddingAccount(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={20} /> 계정 추가
        </button>
      </header>

      {isAddingAccount && (
        <div className="card fade-in" style={{ marginBottom: '2rem' }}>
          <h3>새 계정 등록</h3>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <input 
              type="text" 
              placeholder="계정 이름 (예: 부계정1)" 
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              style={{ flex: 1 }}
            />
            <button onClick={addAccount}>확인</button>
            <button onClick={() => setIsAddingAccount(false)} style={{ background: '#334155', color: '#f8fafc' }}>취소</button>
          </div>
        </div>
      )}

      <main>
        {accounts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Users size={48} style={{ color: '#334155', marginBottom: '1rem' }} />
            <p>등록된 계정이 없습니다. 위 버튼을 눌러 계정을 추가해주세요.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {accounts.map(account => (
              <AccountCard key={account.id} account={account} setAccounts={setAccounts} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function AccountCard({ account, setAccounts }: { account: Account, setAccounts: React.Dispatch<React.SetStateAction<Account[]>> }) {
  const [isAddingChar, setIsAddingChar] = useState(false);
  const [charName, setCharName] = useState('');
  const [charServer, setCharServer] = useState(AION2_SERVERS[0]);
  const [charClass, setCharClass] = useState(AION2_CLASSES[0]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmingDeleteCharId, setConfirmingDeleteCharId] = useState<string | null>(null);

  const addCharacter = () => {
    if (!charName.trim()) return;
    const newChar = {
      id: Date.now().toString(),
      name: charName,
      server: charServer,
      class: charClass,
      trackers: INITIAL_TRACKERS.map(t => ({ ...t, lastUpdatedAt: Date.now() }))
    };

    setAccounts(prev => prev.map(acc => 
      String(acc.id) === String(account.id) ? { ...acc, characters: [...acc.characters, newChar] } : acc
    ));
    setCharName('');
    setIsAddingChar(false);
  };

  const removeAccount = () => {
    setAccounts(prev => prev.filter(acc => String(acc.id) !== String(account.id)));
    setShowDeleteConfirm(false);
  };

  const removeCharacter = (charId: string) => {
    setAccounts(prev => prev.map(acc => {
      if (String(acc.id) !== String(account.id)) return acc;
      return {
        ...acc,
        characters: acc.characters.filter(c => String(c.id) !== String(charId))
      };
    }));
    setConfirmingDeleteCharId(null);
  };

  const moveCharacter = (charId: string, direction: 'up' | 'down') => {
    setAccounts(prev => prev.map(acc => {
      if (String(acc.id) !== String(account.id)) return acc;
      const index = acc.characters.findIndex(c => String(c.id) === String(charId));
      if (index === -1) return acc;
      if (direction === 'up' && index === 0) return acc;
      if (direction === 'down' && index === acc.characters.length - 1) return acc;

      const newChars = [...acc.characters];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newChars[index], newChars[targetIndex]] = [newChars[targetIndex], newChars[index]];

      return { ...acc, characters: newChars };
    }));
  };

  const updateTrackerCount = (charId: string, trackerId: string, newCount: number) => {
    setAccounts(prev => prev.map(acc => {
      if (String(acc.id) !== String(account.id)) return acc;
      return {
        ...acc,
        characters: acc.characters.map(char => {
          if (String(char.id) !== String(charId)) return char;
          return {
            ...char,
            trackers: char.trackers.map(t => {
              if (String(t.id) !== String(trackerId)) return t;
              return { ...t, currentCount: newCount, lastUpdatedAt: Date.now() };
            })
          };
        })
      };
    }));
  };

  return (
    <div className="card fade-in" style={{ borderColor: 'rgba(56, 189, 248, 0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={20} /> {account.name}
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!showDeleteConfirm ? (
            <>
              <button onClick={() => setIsAddingChar(true)} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>캐릭 추가</button>
              <button 
                type="button" 
                onClick={() => setShowDeleteConfirm(true)} 
                style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
              >
                삭제
              </button>
            </>
          ) : (
            <div className="fade-in" style={{ display: 'flex', gap: '4px', alignItems: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>서버전체 캐릭터를 삭제할까요?</span>
              <button onClick={removeAccount} style={{ padding: '2px 6px', fontSize: '0.7rem', background: '#ef4444', color: 'white' }}>예</button>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: '2px 6px', fontSize: '0.7rem', background: '#334155', color: 'white' }}>아니오</button>
            </div>
          )}
        </div>
      </div>

      {isAddingChar && (
        <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>캐릭터 이름</label>
            <input 
              type="text" 
              value={charName} 
              onChange={(e) => setCharName(e.target.value)} 
              placeholder="이름 입력"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>서버 선택</label>
            <select 
              value={charServer} 
              onChange={(e) => setCharServer(e.target.value)}
              style={{ width: '100%' }}
            >
              {AION2_SERVERS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>클래스 선택</label>
            <select 
              value={charClass} 
              onChange={(e) => setCharClass(e.target.value)}
              style={{ width: '100%' }}
            >
              {AION2_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addCharacter} style={{ flex: 1 }}>추가</button>
            <button onClick={() => setIsAddingChar(false)} style={{ flex: 1, background: '#334155', color: '#f8fafc' }}>취소</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {account.characters.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#64748b', textAlign: 'center' }}>캐릭터가 없습니다.</p>
        ) : (
          account.characters.map((char, index) => (
            <div key={char.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>
                  {char.name} 
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 400, marginLeft: '4px' }}>
                    ({char.server} / {char.class})
                  </span>
                </span>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    <button 
                      onClick={() => moveCharacter(char.id, 'up')} 
                      disabled={index === 0}
                      style={{ padding: '2px 6px', fontSize: '0.7rem', background: index === 0 ? 'transparent' : '#334155', opacity: index === 0 ? 0.3 : 1 }}
                    >
                      ↑
                    </button>
                    <button 
                      onClick={() => moveCharacter(char.id, 'down')} 
                      disabled={index === account.characters.length - 1}
                      style={{ padding: '2px 6px', fontSize: '0.7rem', background: index === account.characters.length - 1 ? 'transparent' : '#334155', opacity: index === account.characters.length - 1 ? 0.3 : 1 }}
                    >
                      ↓
                    </button>
                  </div>
                  {confirmingDeleteCharId === char.id ? (
                    <div className="fade-in" style={{ display: 'flex', gap: '2px', alignItems: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 4px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <span style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 600 }}>삭제?</span>
                      <button onClick={() => removeCharacter(char.id)} style={{ padding: '1px 4px', fontSize: '0.65rem', background: '#ef4444', color: 'white', border: 'none' }}>예</button>
                      <button onClick={() => setConfirmingDeleteCharId(null)} style={{ padding: '1px 4px', fontSize: '0.65rem', background: '#334155', color: 'white', border: 'none' }}>아니오</button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setConfirmingDeleteCharId(char.id)} 
                      style={{ padding: '2px 6px', fontSize: '0.7rem', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
              {char.trackers.map(tracker => (
                <TrackerRow 
                  key={tracker.id} 
                  tracker={tracker} 
                  onUpdateCount={(newCount) => updateTrackerCount(char.id, tracker.id, newCount)} 
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TrackerRow({ tracker, onUpdateCount }: { tracker: any, onUpdateCount: (count: number) => void }) {
  const [status, setStatus] = useState(() => calculateCurrentStatus(tracker));
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tracker.currentCount.toString());

  useEffect(() => {
    setStatus(calculateCurrentStatus(tracker));
    const timer = setInterval(() => {
      setStatus(calculateCurrentStatus(tracker));
    }, 60000);
    return () => clearInterval(timer);
  }, [tracker]);

  const handleSave = () => {
    const val = parseInt(editValue);
    if (!isNaN(val) && val >= 0) {
      onUpdateCount(Math.min(val, tracker.maxCount));
    }
    setIsEditing(false);
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    const hours = date.getHours();
    const ampm = hours >= 12 ? '오후' : '오전';
    const displayHours = hours % 12 || 12;
    return `${ampm} ${displayHours}시`;
  };

  const formatDateWithTime = (ts: number) => {
    const date = new Date(ts);
    const day = date.getDate();
    return `${day}일 ${formatTime(ts)}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', alignItems: 'center' }}>
        <span style={{ color: '#cbd5e1' }}>{tracker.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isEditing ? (
            <div style={{ display: 'flex', gap: '4px' }}>
              <input 
                type="number" 
                value={editValue} 
                onChange={(e) => setEditValue(e.target.value)}
                style={{ width: '60px', padding: '2px 4px', fontSize: '0.8rem' }}
                autoFocus
              />
              <button onClick={handleSave} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>저장</button>
            </div>
          ) : (
            <span 
              onClick={() => {
                setEditValue(status.currentCount.toString());
                setIsEditing(true);
              }}
              style={{ color: '#38bdf8', fontWeight: 600, cursor: 'pointer', borderBottom: '1px dashed #38bdf8' }}
            >
              {status.currentCount} / {tracker.maxCount}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1, height: '4px', background: '#334155', borderRadius: '2px', overflow: 'hidden' }}>
          <div 
            style={{ 
              width: `${(status.currentCount / tracker.maxCount) * 100}%`, 
              height: '100%', 
              background: tracker.id === 'ode' ? '#fbbf24' : '#38bdf8',
              transition: 'width 0.5s ease'
            }} 
          />
        </div>
      </div>
      {(status.remainingMinutes !== null || status.limitReachedAt !== null) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginLeft: '4px' }}>
          {status.remainingMinutes !== null && status.nextRechargeAt !== null && (
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> {status.remainingMinutes}분({formatTime(status.nextRechargeAt)})
            </div>
          )}
          {status.limitReachedAt !== null && (
            <div style={{ fontSize: '0.7rem', color: '#38bdf8', opacity: 0.8, marginLeft: '16px' }}>
              {formatDateWithTime(status.limitReachedAt)} 리밋예정
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
