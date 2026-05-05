import React, { useState, useEffect } from 'react';
import { 
  Search, 
  LayoutDashboard, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Plus, 
  X,
  BookOpen,
  Clock,
  CheckSquare,
  StickyNote,
  BrainCircuit,
  Calculator as CalcIcon,
  Languages,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
  Activity,
  User,
  Key,
  ShieldCheck,
  Mail,
  Palette,
  Power,
  Download,
  Cpu,
  Zap,
  Box,
  Trash,
  Cookie,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TabItem, Note, Todo, VocabularyWord, ViewMode, SidebarTool, SettingsCategory } from './types';
import { summarizeText, explainConcept, generateQuiz } from './lib/gemini';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  handleFirestoreError,
  OperationType,
  User as FirebaseUser
} from './lib/firebase';

// --- Components ---

const getAuroId = (uid: string) => {
  return `AURO-${uid.substring(0, 4).toUpperCase()}-${uid.substring(uid.length - 4).toUpperCase()}`;
};

const sendToGmail = (email: string, displayName: string, uid: string) => {
  const auroId = getAuroId(uid);
  const subject = encodeURIComponent("My Auro Scholar Identity");
  const body = encodeURIComponent(
    `Hello ${displayName || 'Researcher'},\n\n` +
    `Your unique Auro Scholar ID is: ${auroId}\n\n` +
    `You can use this ID to identify your academic sessions and sync research data.\n\n` +
    `Best regards,\nAuro Study Browser`
  );
  window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`, '_blank');
};

const Sidebar = ({ 
  activeTool, 
  setActiveTool, 
  isOpen, 
  setIsOpen,
  tabs,
  user
}: { 
  activeTool: SidebarTool | null, 
  setActiveTool: (t: SidebarTool | null) => void,
  isOpen: boolean,
  setIsOpen: (o: boolean) => void,
  tabs: TabItem[],
  user: FirebaseUser | null
}) => {
  const tools: { id: SidebarTool; icon: any; label: string }[] = [
    { id: 'notes', icon: StickyNote, label: 'Notes' },
    { id: 'todo', icon: CheckSquare, label: 'To-do' },
    { id: 'ai', icon: BrainCircuit, label: 'Auro AI' },
    { id: 'vocab', icon: Languages, label: 'Vocab' },
    { id: 'calculator', icon: CalcIcon, label: 'Calculator' },
    { id: 'citations', icon: BookOpen, label: 'Citations' },
    { id: 'tasks', icon: Activity, label: 'Resources' },
    { id: 'toolkit', icon: Box, label: 'Toolkit' },
  ];

  return (
    <div className={`flex h-full border-r border-slate-200 bg-white transition-all duration-300 ${isOpen ? 'w-80' : 'w-16'}`}>
      <div className="flex w-16 flex-col items-center border-r border-slate-100 py-4">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="mb-8 p-2 text-slate-400 hover:text-slate-600"
        >
          {isOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
        </button>
        <div className="flex flex-1 flex-col gap-6">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => {
                setActiveTool(activeTool === tool.id ? null : tool.id);
                if (!isOpen) setIsOpen(true);
              }}
              className={`group relative p-2 transition-colors ${activeTool === tool.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              title={tool.label}
            >
              <tool.icon size={22} />
              {activeTool === tool.id && <div className="absolute right-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-l-full bg-blue-600" />}
            </button>
          ))}
        </div>
      </div>
      
      {isOpen && (
        <div className="flex-1 overflow-y-auto p-4">
          <ToolContent 
            tool={activeTool} 
            tabs={tabs} 
            user={user} 
          />
        </div>
      )}
    </div>
  );
};

const ToolContent = ({ 
  tool, 
  tabs, 
  user
}: { 
  tool: SidebarTool | null, 
  tabs: TabItem[], 
  user: FirebaseUser | null
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [isLodingAi, setIsLoadingAi] = useState(false);

  const handleAiAction = async (type: 'summarize' | 'explain' | 'quiz' | 'solve') => {
    if (!aiInput) return;
    setIsLoadingAi(true);
    setAiOutput('');
    try {
      let result = '';
      if (type === 'summarize') result = await summarizeText(aiInput);
      else if (type === 'explain') result = await explainConcept(aiInput);
      else if (type === 'quiz') result = await generateQuiz(aiInput);
      else if (type === 'solve') {
        const response = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            text: aiInput, 
            systemPrompt: "Solve this complex research problem using the Auro Gen1 reasoning engine. Break it down into first principles."
          }),
        });
        const data = await response.json();
        result = data.result;
      }
      setAiOutput(result);
    } catch (e) {
      setAiOutput("Neural connection failed. Please restart the Auro engine.");
    } finally {
      setIsLoadingAi(false);
    }
  };

  const runGeneratedTool = (code: string) => {
    try {
      // In a real production app, we would use a sandboxed runner.
      // For this study browser environment, we simulate the execution.
      const cleanCode = code.replace(/```javascript|```typescript|```/g, '').trim();
      // Use a new Function to avoid leaks, though still privileged in this context
      const toolFunction = new Function(cleanCode);
      const result = toolFunction();
      alert(`Tool Execution Result: ${result || 'Success'}`);
    } catch (e: any) {
      alert(`Tool Error: ${e.message}`);
    }
  };

  useEffect(() => {
    if (!user) {
      setNotes(JSON.parse(localStorage.getItem('auro_notes') || '[]'));
      setTodos(JSON.parse(localStorage.getItem('auro_todos') || '[]'));
      return;
    }

    // Firestore Listeners
    const notesQuery = query(collection(db, 'notes'), where('userId', '==', user.uid));
    const unsubscribeNotes = onSnapshot(notesQuery, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setNotes(notesData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notes'));

    const todosQuery = query(collection(db, 'todos'), where('userId', '==', user.uid));
    const unsubscribeTodos = onSnapshot(todosQuery, (snapshot) => {
      const todosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setTodos(todosData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'todos'));

    return () => {
      unsubscribeNotes();
      unsubscribeTodos();
    };
  }, [user]);

  const addNote = async (content: string) => {
    if (!user) {
      const newNotes = [{ id: Date.now().toString(), content, timestamp: Date.now() }];
      setNotes(newNotes);
      localStorage.setItem('auro_notes', JSON.stringify(newNotes));
      return;
    }
    try {
      if (notes.length > 0) {
        await updateDoc(doc(db, 'notes', notes[0].id), { 
          content, 
          updatedAt: serverTimestamp() 
        });
      } else {
        await addDoc(collection(db, 'notes'), {
          content,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'notes');
    }
  };

  const addTodo = async (text: string) => {
    if (!user) {
      const newTodos = [...todos, { id: Date.now().toString(), text, completed: false }];
      setTodos(newTodos);
      localStorage.setItem('auro_todos', JSON.stringify(newTodos));
      return;
    }
    try {
      await addDoc(collection(db, 'todos'), {
        task: text,
        completed: false,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'todos');
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    if (!user) {
      const newTodos = todos.map(t => t.id === id ? { ...t, completed } : t);
      setTodos(newTodos);
      localStorage.setItem('auro_todos', JSON.stringify(newTodos));
      return;
    }
    try {
      await updateDoc(doc(db, 'todos', id), { completed });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `todos/${id}`);
    }
  };

  if (!tool) return <div className="flex h-full items-center justify-center text-slate-400">Select a tool</div>;

  switch(tool) {
    case 'notes':
      return (
        <div className="space-y-4">
          <h3 className="font-display text-lg font-bold">Study Notes</h3>
          <textarea 
            className="h-64 w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Start typing your research findings..."
            value={notes[0]?.content || ''}
            onChange={(e) => addNote(e.target.value)}
          />
        </div>
      );
    case 'todo':
      return (
        <div className="space-y-4">
          <h3 className="font-display text-lg font-bold">Goals for Today</h3>
          <div className="flex gap-2">
            <input 
              className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm"
              placeholder="Add task..."
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTodo) {
                  addTodo(newTodo);
                  setNewTodo('');
                }
              }}
            />
          </div>
          <div className="space-y-2">
            {todos.map(t => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <input 
                  type="checkbox" 
                  checked={t.completed} 
                  onChange={() => toggleTodo(t.id, !t.completed)}
                />
                <span className={t.completed ? 'text-slate-400 line-through' : ''}>{t.text || (t as any).task}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case 'ai':
      return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold flex items-center gap-2">
              <BrainCircuit size={18} className="text-blue-600" />
              Intelligence
            </h3>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
              Gen1 v2.0
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Research Context</label>
            <textarea 
              className="h-32 w-full rounded-2xl border border-slate-200 p-3 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 focus:outline-none transition-all"
              placeholder="Paste text or research notes here..."
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => handleAiAction('solve')}
              className="flex-1 rounded-xl bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-50 shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
              disabled={isLodingAi || !aiInput}
            >
              <Cpu size={14} /> Solve & Create Tool
            </button>
            <div className="flex gap-2 w-full">
              <button 
                onClick={() => handleAiAction('summarize')}
                className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95"
                disabled={isLodingAi || !aiInput}
              >
                Summarize
              </button>
              <button 
                onClick={() => handleAiAction('explain')}
                className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95"
                disabled={isLodingAi || !aiInput}
              >
                Explain
              </button>
              <button 
                onClick={() => handleAiAction('quiz')}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all active:scale-95"
                disabled={isLodingAi || !aiInput}
              >
                Quiz
              </button>
            </div>
          </div>

          {isLodingAi && (
            <div className="flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
               <Activity className="text-blue-500 animate-spin mb-2" size={24} />
               <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Auro Gen1 is Thinking...</p>
            </div>
          )}

          {aiOutput && !isLodingAi && (
            <div className="mt-4 rounded-2xl bg-white border border-slate-200 p-4 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auro Workspace Output</span>
                 </div>
                 {aiOutput.includes('TOOL_CODE') && (
                   <button 
                    onClick={() => {
                      const match = aiOutput.match(/TOOL_CODE\s*([\s\S]*?)(?:```|$)/);
                      if (match) runGeneratedTool(match[1]);
                    }}
                    className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1"
                   >
                     🚀 Run Generated Tool
                   </button>
                 )}
               </div>
               <div className="text-[13px] leading-relaxed text-slate-700">
                 <pre className="whitespace-pre-wrap font-sans">{aiOutput}</pre>
               </div>
            </div>
          )}
        </div>
      );
    case 'calculator':
        return (
            <div className="space-y-4">
                <h3 className="font-display text-lg font-bold">Quick Calculator</h3>
                <div className="grid grid-cols-4 gap-2">
                    {[7,8,9,'/', 4,5,6,'*', 1,2,3,'-', 0,'.','=','+'].map(btn => (
                        <button key={btn} className="rounded border border-slate-200 h-10 hover:bg-slate-100 text-sm">{btn}</button>
                    ))}
                    <button className="col-span-4 rounded border border-red-100 bg-red-50 text-red-600 h-10 text-sm">Clear</button>
                </div>
            </div>
        );
    case 'vocab':
        return (
            <div className="space-y-4">
                <h3 className="font-display text-lg font-bold">Vocab Builder</h3>
                <input className="w-full rounded border border-slate-200 p-2 text-sm" placeholder="New word..." />
                <div className="space-y-2">
                    <div className="rounded bg-indigo-50 p-3">
                        <p className="text-sm font-bold text-indigo-900">Ephemeral</p>
                        <p className="text-xs text-indigo-700">Lasting for a very short time.</p>
                    </div>
                </div>
            </div>
        );
    case 'toolkit':
      return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 pb-10">
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <Box size={18} className="text-blue-600" />
            Research Toolkit
          </h3>
          <p className="text-[10px] text-slate-500 font-medium">Native browser extensions powered by Auro Intelligence.</p>
          
          <div className="space-y-6 mt-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">AI Agents</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'Monica', task: 'Web Assistant' },
                  { name: 'Sider', task: 'Side panel AI' },
                  { name: 'HARPA', task: 'Automation' },
                  { name: 'Merlin', task: 'Quick Summarizer' }
                ].map(tool => (
                  <button key={tool.name} className="flex flex-col items-start p-3 rounded-xl border border-slate-100 hover:border-blue-400 hover:bg-blue-50/50 transition-all group">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700">{tool.name} AI</span>
                    <span className="text-[9px] text-slate-500 mt-1">{tool.task}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Dev & Debug</label>
              <div className="space-y-2">
                {[
                  { name: 'Testing Toolkit', desc: 'Manual testing suite' },
                  { name: 'HTTP Sniffer', desc: 'Inspect web traffic' },
                  { name: 'DevScope', desc: 'DOM & SEO Audit' }
                ].map(tool => (
                  <div key={tool.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-transparent hover:border-slate-200 transition-all cursor-pointer">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{tool.name}</p>
                      <p className="text-[10px] text-slate-500">{tool.desc}</p>
                    </div>
                    <div className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center">
                      <Settings size={12} className="text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Security & Utility</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { name: 'CSS Sentry', desc: 'Scanning for malicious styles', color: 'bg-green-50 text-green-700' },
                  { name: 'ToolsAid', desc: 'Offline JSON & JWT Toolbox', color: 'bg-orange-50 text-orange-700' }
                ].map(tool => (
                  <div key={tool.name} className={`p-3 rounded-xl ${tool.color} flex items-center justify-between group cursor-pointer transition-all hover:brightness-95`}>
                    <div>
                      <p className="text-xs font-black">{tool.name}</p>
                      <p className="text-[9px] opacity-70 font-medium">{tool.desc}</p>
                    </div>
                    <Zap size={14} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    case 'citations':
        return (
            <div className="space-y-4">
                <h3 className="font-display text-lg font-bold">Citation Helper</h3>
                <p className="text-xs text-slate-500">Quickly format your research sources (APA/MLA).</p>
                <div className="space-y-3">
                    <input className="w-full rounded border border-slate-200 p-2 text-sm" placeholder="Source Title..." />
                    <input className="w-full rounded border border-slate-200 p-2 text-sm" placeholder="URL or Book DOI..." />
                    <select className="w-full rounded border border-slate-200 p-2 text-xs">
                        <option>APA 7th Edition</option>
                        <option>MLA 9th Edition</option>
                        <option>Chicago</option>
                    </select>
                    <button className="w-full rounded bg-blue-600 py-2 text-xs text-white hover:bg-blue-700">Generate Citation</button>
                    <div className="mt-4 border-t border-slate-100 pt-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Saved Citations</p>
                        <div className="rounded border border-dashed border-slate-200 p-3 text-[10px] text-slate-400 text-center">
                            No citations saved for this session.
                        </div>
                    </div>
                </div>
            </div>
        );
    case 'tasks':
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold">Task Manager</h3>
                    <div className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">Live</div>
                </div>
                <p className="text-xs text-slate-500">System resource usage per tab.</p>
                <div className="space-y-2 mt-4">
                    {tabs.map((tab, idx) => (
                        <div key={tab.id} className="flex flex-col gap-1 p-2 rounded bg-slate-50 border border-slate-100">
                           <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold truncate max-w-[120px]">{tab.title}</span>
                                <span className="text-[9px] text-blue-600 font-mono">{(120 + Math.random() * 50).toFixed(1)} MB</span>
                           </div>
                           <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-blue-500 transition-all duration-1000" 
                                    style={{ width: `${tab.isActive ? 25 + Math.random() * 10 : 5 + Math.random() * 5}%` }}
                                ></div>
                           </div>
                        </div>
                    ))}
                    <div className="flex flex-col gap-1 p-2 rounded bg-slate-900 text-white">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                            <span>Auro Core Engine</span>
                            <span className="font-mono">{(2.4 + Math.random() * 0.5).toFixed(1)}% CPU</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    default:
      return null;
  }
};

const Dashboard = ({ onStartBrowsing, user, onLogin }: { onStartBrowsing: () => void, user: FirebaseUser | null, onLogin: () => void }) => {
    return (
        <div className="flex h-full flex-col p-8 lg:p-16 max-w-[1400px] mx-auto w-full">
            <header className="mb-14 flex justify-between items-start">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/50 text-blue-700 text-[10px] font-black uppercase tracking-widest mb-4">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                    Research Session Active
                  </div>
                  <h1 className="font-display text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
                    Hello, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">{user?.displayName?.split(' ')[0] || 'Researcher'}.</span>
                  </h1>
                  {user && (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 text-[10px] font-mono font-bold text-slate-400">
                        <ShieldCheck size={10} /> {getAuroId(user.uid)}
                      </div>
                      <button 
                        onClick={() => sendToGmail(user.email || '', user.displayName || '', user.uid)}
                        className="text-[10px] text-blue-500 hover:text-blue-700 font-bold flex items-center gap-1 transition-colors"
                      >
                        <Mail size={10} /> Send to Gmail
                      </button>
                    </div>
                  )}
                  <p className="mt-4 text-lg text-slate-500 max-w-2xl font-medium">Auro is your personal academic engine. {user ? 'Your study data is synced.' : 'Sign in to save your progress.'}</p>
                </div>
                {!user && (
                   <button 
                    onClick={onLogin}
                    className="hidden sm:flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-black text-slate-900 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                   >
                     Manage Profile
                   </button>
                )}
            </header>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                <motion.div 
                    whileHover={{ y: -8, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
                    className="flex flex-col rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 transition-all duration-300"
                >
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                        <Clock size={24} />
                    </div>
                    <h3 className="font-display text-xl font-bold">Deep Focus Stats</h3>
                    <p className="mt-2 text-sm text-slate-500 leading-relaxed">12.5 hrs studied this week. You've hit your daily goal 4 days in a row.</p>
                </motion.div>

                <motion.div 
                    whileHover={{ y: -8, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
                    className="flex flex-col rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 transition-all duration-300"
                >
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                        <CheckSquare size={24} />
                    </div>
                    <h3 className="font-display text-xl font-bold">Study Queue</h3>
                    <p className="mt-2 text-sm text-slate-500 leading-relaxed">3 priority tasks remaining for IELTS preparation. Review starts in 1 hour.</p>
                </motion.div>

                <motion.div 
                    whileHover={{ y: -8 }}
                    className="flex flex-col rounded-3xl bg-slate-900 p-8 text-white shadow-2xl relative overflow-hidden group transition-all duration-500 hover:scale-[1.02]"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-[60px] rounded-full translate-x-12 -translate-y-12"></div>
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30">
                        <BookOpen size={24} />
                    </div>
                    <h3 className="font-display text-xl font-bold relative z-10">Last Session</h3>
                    <p className="mt-2 text-sm text-white/70 leading-relaxed relative z-10 mb-6">Quantum Mechanics: Sub-atomic models and Bohr's Theory.</p>
                    <button 
                        onClick={onStartBrowsing}
                        className="mt-auto w-full rounded-2xl bg-white py-4 text-sm font-black text-slate-900 transition-all hover:bg-slate-100 hover:scale-105 active:scale-95 shadow-xl shadow-black/20"
                    >
                        Resume Research
                    </button>
                </motion.div>
            </div>

            <section className="mt-20">
                <div className="flex items-end justify-between mb-8">
                  <div>
                    <h2 className="font-display text-2xl font-black">Subject Groups</h2>
                    <p className="text-slate-500 text-sm mt-1">Organize your research by topic.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    {['Physics', 'Chemistry', 'Biology', 'History', 'IELTS', 'Computer Science'].map(sub => (
                        <button key={sub} className="px-6 py-2.5 bg-white rounded-2xl border border-slate-200 text-sm font-bold hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all shadow-sm">
                            {sub}
                        </button>
                    ))}
                    <button className="px-6 py-2.5 bg-slate-100 text-slate-500 rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-slate-200 transition-colors">
                        <Plus size={18} /> New Subject
                    </button>
                </div>
            </section>
        </div>
    );
};

const FocusOverlay = ({ onExit }: { onExit: () => void }) => {
    const [seconds, setSeconds] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        let interval: any;
        if (isActive && seconds > 0) {
            interval = setInterval(() => {
                setSeconds(s => s - 1);
            }, 1000);
        } else if (seconds === 0) {
            setIsActive(false);
            alert("Session complete! Time for a break.");
        }
        return () => clearInterval(interval);
    }, [isActive, seconds]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 text-white"
        >
            <button onClick={onExit} className="absolute top-8 right-8 text-white/50 hover:text-white flex items-center gap-2">
                <Minimize2 size={20} /> Exit Focus
            </button>
            
            <div className="text-center">
                <h2 className="text-xl text-white/60 mb-12 font-display">Pomodoro Study Session</h2>
                <div className="text-[12rem] font-bold tracking-tighter leading-none mb-8 tabular-nums">
                    {formatTime(seconds)}
                </div>
                <div className="flex justify-center gap-6">
                    <button 
                        onClick={() => setIsActive(!isActive)}
                        className={`w-40 py-4 rounded-full text-lg font-bold transition-all ${isActive ? 'bg-white/10 hover:bg-white/20' : 'bg-white text-black hover:scale-105'}`}
                    >
                        {isActive ? 'Pause' : 'Start Focus'}
                    </button>
                    <button 
                        onClick={() => { setIsActive(false); setSeconds(25 * 60); }}
                        className="p-4 rounded-full bg-white/5 hover:bg-white/10"
                    >
                        <RotateCcw size={24} />
                    </button>
                </div>
            </div>
            
            <div className="absolute bottom-12 flex gap-8 text-sm text-white/40">
                <p>Background: Deep Study Lo-fi (Auto playing...)</p>
                <div className="flex gap-4">
                    <span className="text-white/60 border-b border-white/20">Pomodoro</span>
                    <span>Short Break</span>
                    <span>Long Break</span>
                </div>
            </div>
        </motion.div>
    );
};

export default function App() {
  const [view, setView] = useState<ViewMode>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTool, setActiveTool] = useState<SidebarTool | null>('ai');
  const [url, setUrl] = useState('https://en.wikipedia.org/wiki/Quantum_mechanics');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [adBlockEnabled, setAdBlockEnabled] = useState(true);
  const [readingMode, setReadingMode] = useState(false);
  const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>('you');
  const [searchEngine, setSearchEngine] = useState('google');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [tabs, setTabs] = useState<TabItem[]>([
    { id: '1', url: 'https://en.wikipedia.org/wiki/Quantum_mechanics', title: 'Quantum Mechanics', subject: 'Physics', isActive: true }
  ]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Auth Error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout Error:', error);
    }
  };

  const [lastSearchQuery, setLastSearchQuery] = useState('');
  const [researchResult, setResearchResult] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const academicSuggestions = [
    'Quantum Mechanics foundations',
    'Machine Learning fundamentals',
    'Organic Chemistry nomenclature',
    'Civil Rights movement history',
    'Linear Algebra matrix operations',
    'Data Structures and Algorithms',
    'Evolutionary Biology principles',
    'Microeconomics supply and demand'
  ];

  useEffect(() => {
    if (url && !url.includes('.') && url.length > 2) {
      const filtered = academicSuggestions.filter(s => 
        s.toLowerCase().includes(url.toLowerCase())
      ).slice(0, 4);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [url]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    let targetUrl = url.trim();
    if (!targetUrl) return;
    
    // Robust URL detection
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    const isUrl = urlPattern.test(targetUrl) && !targetUrl.includes(' ');
    
    let isSearch = false;
    if (!isUrl) {
      setLastSearchQuery(targetUrl);
      setIsResearching(true);
      setResearchResult('');
      
      // Attempt to get a quick summary from Gemini
      explainConcept(targetUrl).then(result => {
        setResearchResult(result);
        setIsResearching(false);
      }).catch(() => {
        setIsResearching(false);
      });

      const engineUrls: Record<string, string> = {
        google: `https://www.google.com/search?q=${encodeURIComponent(targetUrl)}`,
        duckduckgo: `https://duckduckgo.com/?q=${encodeURIComponent(targetUrl)}`,
        bing: `https://www.bing.com/search?q=${encodeURIComponent(targetUrl)}`,
        brave: `https://search.brave.com/search?q=${encodeURIComponent(targetUrl)}`,
        scholar: `https://scholar.google.com/scholar?q=${encodeURIComponent(targetUrl)}`
      };
      targetUrl = engineUrls[searchEngine] || engineUrls.google;
      isSearch = true;
    } else {
      setLastSearchQuery('');
      if (!targetUrl.startsWith('http')) {
        targetUrl = `https://${targetUrl}`;
      }
    }

    setUrl(targetUrl);
    
    // Update the active tab's URL and title
    setTabs(prev => prev.map(tab => 
      tab.isActive ? { 
        ...tab, 
        url: targetUrl, 
        title: isSearch ? `Search: ${lastSearchQuery || targetUrl.split('q=')[1]?.substring(0, 15)}...` : (targetUrl.length > 30 ? targetUrl.substring(0, 30) + '...' : targetUrl) 
      } : tab
    ));
    
    if (view !== 'browser') setView('browser');
  };

  const isBlockedSite = (u: string) => {
    const blocked = ['google.com', 'wikipedia.org', 'youtube.com', 'github.com', 'facebook.com', 'twitter.com', 'brave.com', 'bing.com', 'duckduckgo.com'];
    return blocked.some(domain => u.toLowerCase().includes(domain));
  };

  const openExternal = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const addNewTab = (subject: string = 'General') => {
    const newId = Date.now().toString();
    setTabs(prev => [
      ...prev.map(t => ({ ...t, isActive: false })),
      { id: newId, url: 'https://www.google.com', title: 'New Tab', subject, isActive: true }
    ]);
    setUrl('https://www.google.com');
    setView('browser');
  };

  const switchTab = (id: string) => {
    setTabs(prev => prev.map(t => {
      if (t.id === id) {
        setUrl(t.url);
        return { ...t, isActive: true };
      }
      return { ...t, isActive: false };
    }));
    if (view !== 'browser') setView('browser');
  };

  const removeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    if (tabs.find(t => t.id === id)?.isActive) {
      newTabs[newTabs.length - 1].isActive = true;
      setUrl(newTabs[newTabs.length - 1].url);
    }
    setTabs(newTabs);
  };

  return (
    <div className={`flex h-screen w-full overflow-hidden ${darkMode ? 'bg-slate-900 text-white' : 'bg-auro-bg text-auro-dark'}`}>
      <AnimatePresence>
        {isFocusMode && <FocusOverlay onExit={() => setIsFocusMode(false)} />}
      </AnimatePresence>

      {/* --- Sidebar --- */}
      <Sidebar 
        activeTool={activeTool} 
        setActiveTool={setActiveTool} 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen} 
        tabs={tabs}
        user={user}
      />

      {/* --- Main Content --- */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* --- Top Navbar --- */}
        <nav className="flex h-[60px] items-center justify-between border-b border-slate-200 bg-white px-4 glass-morphism sticky top-0 z-50">
          <div className="flex items-center gap-4 flex-1">
            <button 
                onClick={() => setView('dashboard')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${view === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
                title="Auro Dashboard"
            >
              <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-indigo-700 rounded flex items-center justify-center text-white font-display font-bold text-[10px]">A</div>
              <span className="hidden sm:inline font-display font-bold text-sm tracking-tight">Auro</span>
            </button>
            
            <div className="h-6 w-[1px] bg-slate-200 mx-1" />
            
            <div className="flex items-center gap-0.5">
                <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft size={18} /></button>
                <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"><ChevronRight size={18} /></button>
                <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" onClick={() => window.location.reload()}><RotateCcw size={18} /></button>
            </div>
            
            <form onSubmit={handleSearch} className="flex-1 max-w-[800px] mx-4 relative">
                <div className="group relative flex items-center">
                    <div className="absolute left-4 flex items-center gap-2 z-10 pointer-events-none">
                        <Search size={16} className="text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                        <div className="h-4 w-[1px] bg-slate-300" />
                        <span className="hidden lg:inline text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          {searchEngine === 'google' ? 'Google' : searchEngine === 'bing' ? 'Bing' : searchEngine === 'duckduckgo' ? 'DuckDuckGo' : searchEngine === 'brave' ? 'Brave' : 'Scholar'} Search
                        </span>
                    </div>
                    <input 
                        className="w-full h-11 rounded-full bg-slate-100/80 border border-transparent py-1.5 pl-32 pr-20 text-sm focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400/50 transition-all font-sans search-bar-shadow placeholder:text-slate-400"
                        placeholder="Search research topics or enter site URL..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onFocus={() => { if(view !== 'browser') setView('browser') }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setShowSuggestions(false);
                        }}
                    />
                    <div className="absolute right-4 flex items-center gap-1">
                      {url && (
                        <button 
                          type="button"
                          onClick={() => setUrl('')}
                          className="p-1 text-slate-300 hover:text-slate-500 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      )}
                      <button 
                        type="button"
                        onClick={openExternal}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                        title="Open in External Tab"
                      >
                        <Maximize2 size={15} />
                      </button>
                    </div>
                </div>

                {/* Search Suggestions Dropdown */}
                {showSuggestions && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Activity size={10} className="text-blue-500" /> Research Suggestions
                      </span>
                    </div>
                    {suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setUrl(s);
                          handleSearch({ preventDefault: () => {} } as any);
                        }}
                        className="w-full text-left px-5 py-4 hover:bg-slate-50 flex items-center gap-4 transition-colors group"
                      >
                        <div className="p-2 rounded-lg bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                          <Search size={14} />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{s}</span>
                        <ChevronRight size={14} className="ml-auto text-slate-300 group-hover:text-blue-500 transition-all group-hover:translate-x-1" />
                      </button>
                    ))}
                    <div className="px-5 py-3 bg-slate-50 text-[10px] text-slate-400 font-medium text-center italic border-t border-slate-100">
                      Press Enter to search via {searchEngine}
                    </div>
                  </div>
                )}
            </form>
          </div>

          <div className="flex items-center gap-2">
            <button 
                onClick={() => setIsFocusMode(true)}
                className="hidden md:flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-all shadow-lg shadow-blue-500/10"
            >
              <Clock size={14} className="text-blue-400" /> Start Session
            </button>
            <div className="h-6 w-[1px] bg-slate-200 mx-1" />

            {/* Advanced Browser Toggles */}
            <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button 
                    onClick={() => setAdBlockEnabled(!adBlockEnabled)}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${adBlockEnabled ? 'bg-red-500 text-white' : 'text-slate-400'}`}
                    title="Toggle Ad Blocker"
                >
                    ADS
                </button>
                <button 
                    onClick={() => setReadingMode(!readingMode)}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${readingMode ? 'bg-blue-500 text-white' : 'text-slate-400'}`}
                    title="Toggle Reading Mode"
                >
                    READ
                </button>
            </div>

            <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
               {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button 
              onClick={() => setView('settings')}
              className={`p-2 rounded-lg transition-colors ${view === 'settings' ? 'text-blue-600 bg-blue-50 font-bold' : 'text-slate-500 hover:bg-slate-100'}`}
              title="Browser Settings"
            >
                <Settings size={20} />
            </button>
          </div>
        </nav>

        {/* --- Tab Bar (Only in Browser View) --- */}
        {view === 'browser' && (
            <div className="flex h-10 items-center gap-2 border-b border-slate-100 bg-slate-50 px-4">
                {tabs.map(tab => (
                    <div 
                        key={tab.id} 
                        onClick={() => switchTab(tab.id)}
                        className={`group flex items-center gap-2 rounded-t-lg px-3 py-1.5 text-xs transition-colors cursor-pointer border-x border-slate-200/50 ${tab.isActive ? 'bg-white border-t-2 border-t-blue-600 -mb-[1px]' : 'text-slate-500 hover:bg-slate-200'}`}
                    >
                        <span className="max-w-[120px] truncate font-medium">{tab.title}</span>
                        <button onClick={(e) => removeTab(e, tab.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <X size={12} className="hover:text-red-500" />
                        </button>
                    </div>
                ))}
                <button 
                  onClick={() => addNewTab()}
                  className="p-1 text-slate-400 hover:text-slate-600 transition-transform hover:scale-110"
                >
                  <Plus size={16} />
                </button>
            </div>
        )}

        {/* --- View Rendering --- */}
        <main className="flex-1 overflow-y-auto relative bg-[#F8FAFC]">
          {view === 'dashboard' ? (
            <Dashboard onStartBrowsing={() => setView('browser')} user={user} onLogin={handleLogin} />
          ) : view === 'settings' ? (
            <SettingsPanel 
                activeCategory={activeSettingsCategory} 
                onCategoryChange={setActiveSettingsCategory}
                searchEngine={searchEngine}
                onSearchEngineChange={setSearchEngine}
                syncEnabled={syncEnabled}
                onToggleSync={() => setSyncEnabled(!syncEnabled)}
                adBlock={adBlockEnabled}
                onToggleAdBlock={() => setAdBlockEnabled(!adBlockEnabled)}
                user={user}
                onLogin={handleLogin}
                onLogout={handleLogout}
            />
          ) : (
            <div className="h-full w-full bg-slate-100 p-4">
                <div className="h-full w-full rounded-xl bg-white shadow-2xl overflow-hidden relative flex flex-col">
                    {/* Simulated Iframe */}
                    {url && !isBlockedSite(url) ? (
                      <div className="relative flex-1">
                        <iframe 
                            id="auro-browser-main"
                            src={url} 
                            className={`h-full w-full border-none transition-all duration-500 ${readingMode ? 'sepia-[0.3] contrast-[1.1] grayscale-[0.2]' : ''}`}
                        />
                        {adBlockEnabled && (
                          <div className="absolute bottom-4 right-4 bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded shadow-lg pointer-events-none uppercase tracking-tighter z-10">
                            Ad-Shield Active
                          </div>
                        )}
                      </div>
                    ) : url ? (
                      <div className="flex flex-1 flex-col items-center justify-center bg-[#F8FAFC] p-12 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-50"></div>
                        <div className="mb-10 relative">
                           <div className="absolute inset-0 bg-blue-100 rounded-3xl blur-2xl opacity-50 animate-pulse"></div>
                           <div className="relative h-20 w-20 rounded-3xl bg-white shadow-xl flex items-center justify-center text-blue-600 ring-1 ring-slate-200">
                             <BookOpen size={40} />
                           </div>
                        </div>
                        
                        <h2 className="font-display text-4xl font-black mb-4 text-slate-900 tracking-tight">
                          Research Synthesis
                        </h2>
                        
                        {lastSearchQuery && (
                          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-8 mb-10 text-left shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full bg-blue-600 ${isResearching ? 'animate-ping' : ''}`} />
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                                  {isResearching ? 'Engine Researching...' : 'Auro Gen1'}
                                </span>
                              </div>
                              <div className="text-[10px] font-bold text-slate-400 px-2 py-1 bg-slate-50 rounded italic">
                                "{lastSearchQuery}"
                              </div>
                            </div>
                            <div className="text-slate-800 leading-relaxed min-h-[120px]">
                              {isResearching ? (
                                <div className="space-y-4">
                                  <div className="h-4 bg-slate-100 rounded-lg w-full animate-pulse"></div>
                                  <div className="h-4 bg-slate-100 rounded-lg w-11/12 animate-pulse"></div>
                                  <div className="h-4 bg-slate-100 rounded-lg w-3/4 animate-pulse"></div>
                                </div>
                              ) : researchResult ? (
                                <p className="text-lg font-medium leading-relaxed font-sans">{researchResult}</p>
                              ) : (
                                <div className="flex flex-col items-center justify-center p-8 opacity-40">
                                  <Activity className="animate-spin mb-4" />
                                  <p className="italic text-sm">Preparing scholarly perspective...</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col items-center gap-8">
                          <p className="text-slate-500 max-w-lg text-lg leading-relaxed font-medium">
                            To view the full external interface while maintaining privacy, Auro has isolated this connection.
                          </p>
                          
                          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                            <button 
                              onClick={openExternal}
                              className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-blue-500/10 active:scale-95 group"
                            >
                               {url.includes('search') ? 'View Search Results' : 'Launch Research Window'} <Maximize2 size={18} className="group-hover:scale-110 transition-transform" />
                            </button>
                            <button 
                              onClick={() => { setActiveTool('ai'); setSidebarOpen(true); }}
                              className="bg-white border border-slate-200 text-slate-700 px-8 py-4 rounded-2xl font-black hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm active:scale-95 group"
                            >
                               Auro Gen1 <BrainCircuit size={18} className="group-hover:rotate-12 transition-transform" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                           <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm text-left hover:border-blue-200 transition-colors">
                              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4"><StickyNote size={16}/></div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Workflow</p>
                              <p className="text-xs text-slate-600 font-medium leading-relaxed">Auto-sync your external findings into the Sidebar Notes for exam prep.</p>
                           </div>
                           <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm text-left hover:border-green-200 transition-colors">
                              <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center text-green-600 mb-4"><Clock size={16}/></div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Time Shield</p>
                              <p className="text-xs text-slate-600 font-medium leading-relaxed">Your active Pomodoro timer tracks this domain as valid study time.</p>
                           </div>
                           <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm text-left hover:border-purple-200 transition-colors">
                              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 mb-4"><Languages size={16}/></div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Context</p>
                              <p className="text-xs text-slate-600 font-medium leading-relaxed">Add words from this research to your Vocab Builder with one click.</p>
                           </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-1 flex-col items-center justify-center bg-white p-12 text-center">
                        <div className="mb-8 opacity-20">
                          <Search size={80} className="text-slate-900" />
                        </div>
                        <h2 className="font-display text-3xl font-black text-slate-900">Auro Academic Search</h2>
                        <p className="text-slate-500 mt-2 max-w-md font-medium text-lg">Use the command bar above to start your deep dive into the world of knowledge.</p>
                        <div className="mt-8 flex gap-3">
                           <span className="px-3 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-400">Ctrl + T Search</span>
                           <span className="px-3 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-400">Ctrl + N Note</span>
                        </div>
                      </div>
                    )}
                </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const SettingsPanel = ({ 
    activeCategory, 
    onCategoryChange,
    searchEngine,
    onSearchEngineChange,
    syncEnabled,
    onToggleSync,
    adBlock,
    onToggleAdBlock,
    user,
    onLogin,
    onLogout
}: { 
    activeCategory: SettingsCategory, 
    onCategoryChange: (c: SettingsCategory) => void,
    searchEngine: string,
    onSearchEngineChange: (e: string) => void,
    syncEnabled: boolean,
    onToggleSync: () => void,
    adBlock: boolean,
    onToggleAdBlock: () => void,
    user: FirebaseUser | null,
    onLogin: () => void,
    onLogout: () => void
}) => {
    const categories: { id: SettingsCategory; label: string; icon: any }[] = [
        { id: 'you', label: 'You and Auro', icon: User },
        { id: 'autofill', label: 'Autofill and passwords', icon: Key },
        { id: 'privacy', label: 'Privacy and security', icon: ShieldCheck },
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'search', label: 'Search engine', icon: Search },
        { id: 'startup', label: 'On startup', icon: Power },
        { id: 'languages', label: 'Languages', icon: Languages },
        { id: 'downloads', label: 'Downloads', icon: Download },
        { id: 'accessibility', label: 'Accessibility', icon: Activity },
        { id: 'system', label: 'System', icon: Cpu },
        { id: 'reset', label: 'Reset settings', icon: RotateCcw },
    ];

    const renderContent = () => {
        switch (activeCategory) {
            case 'you':
                return (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <section>
                            <h2 className="text-2xl font-display font-bold mb-6">You and Auro</h2>
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                <div className="p-6 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        {user ? (
                                          <>
                                            {user.photoURL ? (
                                              <img src={user.photoURL} alt={user.displayName || ''} className="h-16 w-16 rounded-full" />
                                            ) : (
                                              <div className="h-16 w-16 rounded-full bg-slate-900 flex items-center justify-center text-white text-2xl font-bold">
                                                {user.displayName?.charAt(0) || user.email?.charAt(0) || 'A'}
                                              </div>
                                            )}
                                            <div>
                                                <p className="font-bold text-lg">{user.displayName || 'Researcher'}</p>
                                                <p className="text-sm text-slate-500">{user.email}</p>
                                                <div className="mt-1 flex items-center gap-2">
                                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-[10px] font-mono font-bold text-blue-600 border border-blue-100">
                                                    ID: {getAuroId(user.uid)}
                                                  </div>
                                                  <button 
                                                    onClick={() => sendToGmail(user.email || '', user.displayName || '', user.uid)}
                                                    className="text-[10px] text-blue-500 hover:underline font-bold flex items-center gap-1"
                                                    title="Send this ID to your Gmail"
                                                  >
                                                    <Mail size={10} /> Send to Gmail
                                                  </button>
                                                </div>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                              <User size={32} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-lg">Not Signed In</p>
                                                <p className="text-sm text-slate-500">Sign in to sync your study data.</p>
                                            </div>
                                          </>
                                        )}
                                    </div>
                                    {user ? (
                                      <button 
                                        onClick={onLogout}
                                        className="px-6 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
                                      >
                                        Sign Out
                                      </button>
                                    ) : (
                                      <button 
                                        onClick={onLogin}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
                                      >
                                        Sign in with Google
                                      </button>
                                    )}
                                </div>
                                {user && (
                                  <div className="border-t border-slate-100 p-6 flex items-center justify-between bg-slate-50/50">
                                      <div className="flex items-center gap-3">
                                          <div className={`p-2 rounded-full ${syncEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                                              <RotateCcw size={20} />
                                          </div>
                                          <div>
                                              <p className="text-sm font-bold">Sync is {syncEnabled ? 'on' : 'off'}</p>
                                              <p className="text-xs text-slate-500">Syncing bookmarks, history, and research data.</p>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button 
                                            onClick={onToggleSync}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${syncEnabled ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                        >
                                            {syncEnabled ? 'Turn Off' : 'Turn On'}
                                        </button>
                                      </div>
                                  </div>
                                )}
                            </div>
                        </section>
                        <section>
                            <h3 className="font-display font-bold text-slate-800 mb-4">Academic Workspace</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div 
                                    onClick={() => window.open('https://mail.google.com', '_blank')}
                                    className="p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-400 cursor-pointer transition-colors group flex items-center justify-between shadow-sm hover:shadow-md"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white transition-all">
                                            <Mail size={18} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">Open Gmail</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Check your inbox now</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-300 group-hover:text-red-500 transition-colors" />
                                </div>
                                <div 
                                    onClick={() => user && sendToGmail(user.email || '', user.displayName || '', user.uid)}
                                    className="p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-400 cursor-pointer transition-colors group flex items-center justify-between shadow-sm hover:shadow-md"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                            <ShieldCheck size={18} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">Get Identity Email</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Draft ID to your inbox</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                </div>
                            </div>
                        </section>
                    </div>
                );
            case 'search':
                return (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <section>
                            <h2 className="text-2xl font-display font-bold mb-6">Search engine</h2>
                            <div className="space-y-4">
                                <div className="p-6 bg-white rounded-2xl border border-slate-200 flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-slate-800">Search engine used in the address bar</p>
                                        <p className="text-sm text-slate-500">Used for quick research and URL resolution.</p>
                                    </div>
                                    <select 
                                        value={searchEngine}
                                        onChange={(e) => onSearchEngineChange(e.target.value)}
                                        className="bg-slate-100 border-none outline-none rounded-lg px-4 py-2 text-sm font-bold"
                                    >
                                        <option value="google">Google</option>
                                        <option value="brave">Brave</option>
                                        <option value="duckduckgo">DuckDuckGo</option>
                                        <option value="bing">Bing</option>
                                        <option value="scholar">Google Scholar</option>
                                    </select>
                                </div>
                                <div className="p-6 bg-white rounded-2xl border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors">
                                    <p className="font-bold text-slate-800">Manage search engines and site search</p>
                                    <ChevronRight size={20} className="text-slate-400" />
                                </div>
                            </div>
                        </section>
                    </div>
                );
            case 'privacy':
                return (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <section>
                            <h2 className="text-2xl font-display font-bold mb-6">Privacy and security</h2>
                            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                                <div className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 first:rounded-t-2xl transition-colors">
                                    <div className="flex items-center gap-4">
                                        <Trash size={20} className="text-slate-400" />
                                        <div>
                                            <p className="font-bold">Clear browsing data</p>
                                            <p className="text-sm text-slate-500">Delete history, cookies, cache, and more.</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={20} className="text-slate-400" />
                                </div>
                                <div className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <Cookie size={20} className="text-slate-400" />
                                        <div>
                                            <p className="font-bold">Third-party cookies</p>
                                            <p className="text-sm text-slate-500">Manage blocking and exceptions.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Standard</span>
                                        <ChevronRight size={20} className="text-slate-400" />
                                    </div>
                                </div>
                                <div className="p-6 flex items-center justify-between transition-colors">
                                    <div className="flex items-center gap-4">
                                        <Lock size={20} className="text-red-500" />
                                        <div>
                                            <p className="font-bold">Ad-Shield Integration</p>
                                            <p className="text-sm text-slate-500">Aggressive banner and tracker blocking.</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={onToggleAdBlock}
                                        className={`w-12 h-6 rounded-full p-1 transition-all ${adBlock ? 'bg-blue-600' : 'bg-slate-300'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-all ${adBlock ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                );
            case 'system':
                return (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <section>
                            <h2 className="text-2xl font-display font-bold mb-6">System</h2>
                            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                                <div className="p-6 flex items-center justify-between">
                                    <div>
                                        <p className="font-bold">Continue running background apps when Auro is closed</p>
                                        <p className="text-sm text-slate-500">Keeps research sync active.</p>
                                    </div>
                                    <div className="w-12 h-6 bg-slate-300 rounded-full p-1">
                                        <div className="w-4 h-4 bg-white rounded-full"></div>
                                    </div>
                                </div>
                                <div className="p-6 flex items-center justify-between">
                                    <div>
                                        <p className="font-bold">Use hardware acceleration when available</p>
                                        <p className="text-sm text-slate-500">Increases rendering speed for complex research sites.</p>
                                    </div>
                                    <div className="w-12 h-6 bg-blue-600 rounded-full p-1 flex items-center justify-end">
                                        <div className="w-4 h-4 bg-white rounded-full"></div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                );
            default:
                return (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Cpu size={48} className="mb-4 opacity-20" />
                        <p className="font-medium uppercase tracking-widest text-[10px]">Section under development</p>
                        <h3 className="text-slate-900 font-bold mt-2">Auro Engine Settings</h3>
                    </div>
                );
        }
    };

    return (
        <div className="flex h-full bg-[#f1f3f4] animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Sidebar */}
            <aside className="w-72 bg-white border-r border-slate-200 p-4 space-y-1 overflow-y-auto hidden md:block">
                <div className="px-4 py-6 mb-4">
                    <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight">Settings</h1>
                </div>
                {categories.map((cat) => {
                    const Icon = cat.icon;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => onCategoryChange(cat.id)}
                            className={`w-full flex items-center gap-4 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                activeCategory === cat.id 
                                ? 'bg-blue-50 text-blue-700 font-bold' 
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <Icon size={18} className={activeCategory === cat.id ? 'text-blue-600' : 'text-slate-400'} />
                            {cat.label}
                        </button>
                    );
                })}
            </aside>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto scroll-smooth">
                <div className="max-w-4xl mx-auto py-16 px-8">
                    {/* Search Bar for Settings */}
                    <div className="mb-12 relative group">
                        <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                        <input 
                            className="w-full h-14 rounded-3xl bg-white border border-slate-200 pl-16 pr-6 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all font-medium placeholder:text-slate-400"
                            placeholder="Search settings..."
                        />
                    </div>

                    {renderContent()}

                    <div className="mt-20 border-t border-slate-200 pt-8 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <span>Auro OS v26.04.5</span>
                        <span>Built for Scholars</span>
                    </div>
                </div>
            </main>
        </div>
    );
};
