import React, { useState, useEffect } from 'react';
import type { Account } from './types/game';
import { AION2_SERVERS, AION2_CLASSES, INITIAL_TRACKERS } from './types/game';
import { Users, Plus, Clock, Download, Upload, Save, Cloud, CloudOff, RefreshCw, Check, X, AlertTriangle } from 'lucide-react';
import { calculateCurrentStatus } from './utils/ticketCalculator';

const migrateAccountsData = (parsed: Account[] | null): Account[] => {
  return (parsed || []).map(acc => ({
    ...acc,
    characters: (acc.characters || []).map(char => {
      let updatedTrackers = char.trackers || [];
      
      // 1. dungeons에서 trackers로 전환하는 경우
      if ((char as any).dungeons && !char.trackers) {
        updatedTrackers = INITIAL_TRACKERS.map(t => ({ ...t, lastUpdatedAt: Date.now() }));
      }

      // 2. 기존 trackers에 누락된 항목(초월, 악몽, 슈고페스타 등)이 있는 경우 추가 및 스펙 업데이트
      INITIAL_TRACKERS.forEach(initialTracker => {
        const existing = updatedTrackers.find(t => t.id === initialTracker.id);
        if (!existing) {
          updatedTrackers.push({ ...initialTracker, lastUpdatedAt: Date.now() });
        } else {
          // 설명(description) 등 변경된 스펙 업데이트
          existing.description = initialTracker.description;
          existing.schedule = initialTracker.schedule;
          existing.maxCount = initialTracker.maxCount;
          existing.isCheckbox = initialTracker.isCheckbox;
        }
      });
      
      return {
        ...char,
        trackers: updatedTrackers
      };
    })
  }));
};

function App() {
  console.log('App Rendering...');
  const [accounts, setAccounts] = useState<Account[]>(() => {
    try {
      const saved = localStorage.getItem('aion2_rmt_data');
      if (!saved) return [];
      const parsed = JSON.parse(saved) as Account[];
      return migrateAccountsData(parsed);
    } catch (e) {
      console.error('Failed to load data from localStorage', e);
      return [];
    }
  });

  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountServer, setNewAccountServer] = useState(AION2_SERVERS[0]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [ghToken, setGhToken] = useState<string>(() => {
    return localStorage.getItem('aion2_gh_token') || '';
  });

  const [gistId, setGistId] = useState<string | null>(() => {
    const hashId = window.location.hash.replace('#', '');
    return hashId || localStorage.getItem('aion2_gist_id');
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [inputSyncId, setInputSyncId] = useState('');

  useEffect(() => {
    localStorage.setItem('aion2_gh_token', ghToken);
  }, [ghToken]);

  useEffect(() => {
    if (gistId && !ghToken) {
      setShowSyncModal(true);
    }
  }, [gistId, ghToken]);

  useEffect(() => {
    if (gistId) {
      localStorage.setItem('aion2_gist_id', gistId);
      window.location.hash = gistId;
    } else {
      localStorage.removeItem('aion2_gist_id');
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, [gistId]);

  const API_BASE_URL = 'https://api.github.com/gists';

  const getHeaders = () => ({
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${ghToken}`,
    'X-GitHub-Api-Version': '2022-11-28'
  });

  const saveToCloud = async (data: Account[], id: string) => {
    if (!ghToken) return;
    try {
      setSaveStatus('saving');
      const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          description: 'Aion2 Manager Data',
          files: {
            'aion2_data.json': {
              content: JSON.stringify(data, null, 2)
            }
          }
        })
      });
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      setSaveStatus('saved');
    } catch (e) {
      console.error('Gist save error:', e);
      setSaveStatus('error');
    }
  };

  // Removed automatic LocalStorage sync to allow manual saving prioritization

  const manualSave = async () => {
    // Save to LocalStorage first for immediate local persistence
    localStorage.setItem('aion2_rmt_data', JSON.stringify(accounts));

    if (gistId) {
      await saveToCloud(accounts, gistId);
    } else {
      setSaveStatus('saving');
      setTimeout(() => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }, 500);
    }
  };

  useEffect(() => {
    const initCloudData = async () => {
      // Prioritize Cloud (Gist) data if it exists
      if (gistId && ghToken) {
        setIsSyncing(true);
        try {
          const response = await fetch(`${API_BASE_URL}/${gistId}`, {
            headers: {
              'Accept': 'application/vnd.github+json',
              'Authorization': `Bearer ${ghToken}`,
              'X-GitHub-Api-Version': '2022-11-28'
            }
          });
          if (response.ok) {
            const data = await response.json();
            const file = data.files['aion2_data.json'];
            if (file && file.content) {
              const parsed = JSON.parse(file.content);
              if (Array.isArray(parsed)) {
                const migrated = migrateAccountsData(parsed);
                setAccounts(migrated);
                // Also update localStorage with the authoritative cloud data
                localStorage.setItem('aion2_rmt_data', JSON.stringify(migrated));
                console.log('Cloud data loaded and synced to LocalStorage');
              }
            }
          }
        } catch (e) {
          console.error('Initial sync failed:', e);
        } finally {
          setIsSyncing(false);
        }
      }
    };
    initCloudData();
  }, [gistId, ghToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const startCloudSync = async () => {
    if (!ghToken.trim()) {
      alert('동기화를 시작하려면 GitHub 토큰이 필요합니다.');
      return;
    }
    setIsSyncing(true);
    try {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          description: 'Aion2 Manager Data',
          public: false,
          files: {
            'aion2_data.json': {
              content: JSON.stringify(accounts, null, 2)
            }
          }
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.id) {
          setGistId(data.id);
          alert('GitHub Gist 동기화가 활성화되었습니다!');
        }
      } else {
        const errorText = await response.text();
        console.error('Gist creation failed:', response.status, errorText);
        alert(`Gist 생성 실패: ${response.status}\n토큰 권한(gist)을 확인해주세요.`);
      }
    } catch (e: any) {
      console.error('Sync process error:', e);
      alert(`연결 실패: ${e.message || '네트워크 오류'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const joinSync = async (idToJoin?: string) => {
    const id = idToJoin || inputSyncId;
    if (!id.trim() || !ghToken) return;
    setIsSyncing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, {
        headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        const file = data.files['aion2_data.json'];
        if (file && file.content) {
          const parsed = JSON.parse(file.content);
          if (Array.isArray(parsed)) {
            const migrated = migrateAccountsData(parsed);
            setAccounts(migrated);
            setGistId(id);
            setShowSyncModal(false);
            alert('동기화에 성공했습니다!');
            return;
          }
        }
        alert('Gist 데이터를 찾을 수 없습니다.');
      } else {
        alert('잘못된 Gist ID이거나 접근 권한이 없습니다.');
      }
    } catch (e) {
      alert('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  const refreshSync = async () => {
    if (!gistId || !ghToken) return;
    setIsSyncing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/${gistId}`, {
        headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        const file = data.files['aion2_data.json'];
        if (file && file.content) {
          const parsed = JSON.parse(file.content);
          if (Array.isArray(parsed)) {
            const migrated = migrateAccountsData(parsed);
            setAccounts(migrated);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
          }
        }
      }
    } catch (e) {
      setSaveStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  const getSyncUrl = () => {
    if (!gistId) return window.location.href.split('#')[0];
    const baseUrl = window.location.href.split('#')[0];
    return `${baseUrl}#${gistId}`;
  };

  const addAccount = () => {
    if (!newAccountName.trim()) return;
    const newAccount: Account = {
      id: Date.now().toString(),
      name: newAccountName,
      server: newAccountServer,
      characters: []
    };
    setAccounts([...accounts, newAccount]);
    setNewAccountName('');
    setIsAddingAccount(false);
  };

  const exportData = () => {
    const data = JSON.stringify(accounts, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aion2_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (Array.isArray(parsed)) {
          setAccounts(migrateAccountsData(parsed));
          alert('데이터를 성공적으로 불러왔습니다.');
        }
      } catch (err) {
        alert('파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'block' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>아이온2 쌀먹관리기</h1>
          <p style={{ color: '#94a3b8' }}>티켓 충전 상태를 실시간으로 확인하세요</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ 
            fontSize: '0.8rem', 
            color: saveStatus === 'error' ? '#ef4444' : saveStatus === 'saved' ? '#10b981' : '#94a3b8',
            transition: 'all 0.3s ease',
            opacity: saveStatus === 'idle' && !isSyncing ? 0 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Save size={14} className={isSyncing ? 'spin' : ''} /> {isSyncing ? '동기화 중...' : saveStatus === 'saving' ? '저장 중...' : saveStatus === 'saved' ? '저장됨' : '저장 오류'}
          </span>
          
          <button 
            onClick={() => setShowSyncModal(true)} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              background: gistId ? '#0369a1' : '#334155',
              borderColor: gistId ? '#0ea5e9' : 'transparent'
            }}
          >
            {gistId ? <Cloud size={18} /> : <CloudOff size={18} />}
            {gistId ? '동기화 중' : '클라우드 동기화'}
          </button>

          {gistId && (
            <button onClick={refreshSync} title="새로고침" style={{ padding: '10px', background: '#334155' }}>
              <RefreshCw size={18} className={isSyncing ? 'spin' : ''} />
            </button>
          )}

          <button onClick={exportData} title="백업 내보내기" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#334155' }}>
            <Download size={18} /> 백업
          </button>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: '#334155', 
            padding: '10px 16px', 
            borderRadius: '0.5rem', 
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600
          }}>
            <Upload size={18} /> 복구
            <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
          </label>
          <button onClick={() => setIsAddingAccount(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={20} /> 계정 추가
          </button>
        </div>
      </header>

      {showSyncModal && (
        <div className="modal-overlay" onClick={() => setShowSyncModal(false)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
        }}>
          <div className="card fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%', border: '1px solid #38bdf8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cloud size={24} style={{ color: '#38bdf8' }} /> 클라우드 동기화
              </h2>
              <button onClick={() => setShowSyncModal(false)} style={{ background: 'transparent', padding: '4px' }}>✕</button>
            </div>

            {gistId ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#94a3b8' }}>이 주소를 북마크하거나 폰으로 공유하세요</p>
                  
                  <div style={{ background: 'white', padding: '10px', display: 'inline-block', borderRadius: '8px', marginBottom: '15px' }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(getSyncUrl())}`} 
                      alt="Sync QR Code" 
                      style={{ display: 'block' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      readOnly 
                      value={getSyncUrl()} 
                      style={{ flex: 1, fontSize: '0.8rem', background: '#0f172a' }} 
                    />
                    <button onClick={() => {
                      navigator.clipboard.writeText(getSyncUrl());
                      alert('동기화 주소가 복사되었습니다. 다른 기기에서 이 주소로 접속하세요!');
                    }} style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>링크 복사</button>
                  </div>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <label style={{ display: 'block', margin: '0 0 10px 0', fontSize: '0.9rem', color: '#94a3b8' }}>GitHub Personal Token</label>
                  <input 
                    type="password" 
                    value={ghToken}
                    onChange={e => setGhToken(e.target.value)}
                    placeholder="ghp_... 입력" 
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={refreshSync} disabled={isSyncing} style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <RefreshCw size={18} className={isSyncing ? 'spin' : ''} /> 지금 새로고침
                  </button>
                  <button onClick={() => {
                    if (confirm('동기화를 중단하시겠습니까? Gist 연결이 해제됩니다.')) {
                      setGistId(null);
                      setShowSyncModal(false);
                    }
                  }} style={{ flex: 1, background: '#ef4444', color: 'white' }}>동기화 해제</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ textAlign: 'center', padding: '1rem 0', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: '#e0e0e0', fontSize: '1rem' }}>GitHub Gist 동기화 설정</h3>
                  {gistId && !ghToken && (
                    <div style={{ padding: '10px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: '8px', margin: '0 1rem 1rem 1rem', color: '#fbbf24', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
                      <AlertTriangle size={24} style={{ flexShrink: 0 }} /> 
                      <div>
                        <strong>Gist ID 감지됨:</strong><br/>
                        데이터를 동기화하려면 GitHub 토큰을 먼저 입력해야 합니다.
                      </div>
                    </div>
                  )}
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.5', marginBottom: '1rem' }}>
                    데이터를 안전하게 내 GitHub Gist에 저장합니다.<br/>
                    발급받은 <strong>Personal Access Token (classic)</strong>을 입력해주세요.
                  </p>
                  <input 
                    type="password" 
                    placeholder="ghp_... GitHub 토큰 입력" 
                    value={ghToken}
                    onChange={e => setGhToken(e.target.value)}
                    style={{ width: '90%', padding: '10px', textAlign: 'center' }}
                  />
                </div>

                <div style={{ textAlign: 'center' }}>
                  <button 
                    onClick={startCloudSync} 
                    disabled={isSyncing || !ghToken.trim()}
                    style={{ width: '100%', padding: '12px 24px', fontSize: '1.1rem', opacity: ghToken.trim() ? 1 : 0.5 }}
                  >
                    새 Gist 동기화 시작
                  </button>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#94a3b8' }}>기존 Gist ID로 참여하기</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="Gist ID 입력" 
                      value={inputSyncId}
                      onChange={e => setInputSyncId(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button onClick={() => joinSync()} disabled={isSyncing || !ghToken.trim()}>참여</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isAddingAccount && (
        <div className="card fade-in" style={{ marginBottom: '2rem' }}>
          <h3>새 계정 등록</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>계정 이름</label>
              <input 
                type="text" 
                placeholder="예: 부계정1" 
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ width: '150px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>기본 서버</label>
              <select 
                value={newAccountServer} 
                onChange={(e) => setNewAccountServer(e.target.value)}
                style={{ width: '100%' }}
              >
                {AION2_SERVERS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={addAccount}>확인</button>
              <button onClick={() => setIsAddingAccount(false)} style={{ background: '#334155', color: '#f8fafc' }}>취소</button>
            </div>
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
              <AccountCard key={account.id} account={account} setAccounts={setAccounts} manualSave={manualSave} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function AccountCard({ account, setAccounts, manualSave }: { account: Account, setAccounts: React.Dispatch<React.SetStateAction<Account[]>>, manualSave: () => Promise<void> }) {
  const [isAddingChar, setIsAddingChar] = useState(false);
  const [charName, setCharName] = useState('');
  const [charClass, setCharClass] = useState(AION2_CLASSES[0]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmingDeleteCharId, setConfirmingDeleteCharId] = useState<string | null>(null);
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editClass, setEditClass] = useState(AION2_CLASSES[0]);

  const addCharacter = () => {
    if (!charName.trim()) return;
    const newChar = {
      id: Date.now().toString(),
      name: charName,
      class: charClass,
      trackers: INITIAL_TRACKERS.map(t => ({ ...t, lastUpdatedAt: Date.now() }))
    };

    setAccounts(prev => prev.map(acc => 
      String(acc.id) === String(account.id) ? { ...acc, characters: [...acc.characters, newChar] } : acc
    ));
    setCharName('');
    setIsAddingChar(false);
  };

  const updateCharacter = () => {
    if (!editingCharId || !editName.trim()) return;
    setAccounts(prev => prev.map(acc => {
      if (String(acc.id) !== String(account.id)) return acc;
      return {
        ...acc,
        characters: acc.characters.map(c => 
          String(c.id) === String(editingCharId) ? { ...c, name: editName, class: editClass } : c
        )
      };
    }));
    setEditingCharId(null);
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
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} /> {account.name}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 400, marginTop: '2px', marginLeft: '28px' }}>
            {account.server}
          </div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center', minHeight: '32px' }}>
                {editingCharId === char.id ? (
                  <div style={{ display: 'flex', gap: '4px', flex: 1, marginRight: '8px' }}>
                    <input 
                      type="text" 
                      value={editName} 
                      onChange={(e) => setEditName(e.target.value)} 
                      style={{ flex: 2, padding: '2px 6px', fontSize: '0.85rem' }}
                      placeholder="이름"
                    />
                    <select 
                      value={editClass} 
                      onChange={(e) => setEditClass(e.target.value)}
                      style={{ flex: 1, padding: '2px 6px', fontSize: '0.85rem' }}
                    >
                      {AION2_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={updateCharacter} style={{ padding: '2px 6px', background: '#10b981', color: 'white' }}>
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingCharId(null)} style={{ padding: '2px 6px', background: '#334155', color: 'white' }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600 }}>
                        {char.name} 
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 400, marginLeft: '4px' }}>
                          ({char.class})
                        </span>
                      </span>
                      <button 
                        onClick={manualSave}
                        style={{ 
                          padding: '2px 8px', 
                          fontSize: '0.75rem', 
                          background: '#1e293b', 
                          color: '#38bdf8', 
                          border: '1px solid #38bdf8', 
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Save size={12} /> 저장
                      </button>
                    </div>
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
                      
                      <button 
                        onClick={() => {
                          setEditingCharId(char.id);
                          setEditName(char.name);
                          setEditClass(char.class);
                        }} 
                        style={{ padding: '2px 6px', fontSize: '0.7rem', background: 'transparent', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)' }}
                      >
                        수정
                      </button>

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
                  </>
                )}
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

  const handleCheckboxToggle = () => {
    const newCount = status.currentCount === 0 ? 1 : 0;
    onUpdateCount(newCount);
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

  if (tracker.isCheckbox) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', padding: '4px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{tracker.name}</span>
          {tracker.description && (
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 400 }}>({tracker.description})</span>
          )}
        </div>
        <div 
          onClick={handleCheckboxToggle}
          style={{ 
            width: '20px', 
            height: '20px', 
            borderRadius: '4px', 
            border: '2px solid #38bdf8', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            cursor: 'pointer',
            background: status.currentCount > 0 ? '#38bdf8' : 'transparent',
            transition: 'all 0.2s'
          }}
        >
          {status.currentCount > 0 && <Check size={14} color="white" />}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#cbd5e1' }}>{tracker.name}</span>
          {tracker.description && (
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 400 }}>({tracker.description})</span>
          )}
        </div>
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
