import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GameStats, Unit } from '../types';
import { UNIT_STATS } from '../constants';

interface BattleAdvisorProps {
  isOpen: boolean;
  onClose: () => void;
  stats: GameStats;
  units: Unit[];
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const BattleAdvisor: React.FC<BattleAdvisorProps> = ({ isOpen, onClose, stats, units }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'I am your Strategic Battle Advisor. The battlefield is evolving. What are your orders or questions?' }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const getGameStateSummary = () => {
    // Analyze current state for the prompt
    const redUnits = units.filter(u => u.team === 'RED');
    const blueUnits = units.filter(u => u.team === 'BLUE');
    
    const redTypes = redUnits.reduce((acc, u) => { acc[u.type] = (acc[u.type] || 0) + 1; return acc; }, {} as Record<string, number>);
    const blueTypes = blueUnits.reduce((acc, u) => { acc[u.type] = (acc[u.type] || 0) + 1; return acc; }, {} as Record<string, number>);
    
    const redHealth = redUnits.reduce((sum, u) => sum + u.health, 0) / (redUnits.length || 1);
    const blueHealth = blueUnits.reduce((sum, u) => sum + u.health, 0) / (blueUnits.length || 1);

    return JSON.stringify({
      redArmy: { count: stats.redCount, casualties: stats.redCasualties, composition: redTypes, avgHealth: redHealth.toFixed(1) },
      blueArmy: { count: stats.blueCount, casualties: stats.blueCasualties, composition: blueTypes, avgHealth: blueHealth.toFixed(1) },
      totalTime: stats.totalTime.toFixed(1) + 's',
      unitStatsRef: UNIT_STATS
    }, null, 2);
  };

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsThinking(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = getGameStateSummary();
      
      const systemPrompt = `
        You are an expert military strategist AI analyzing a real-time 2D army simulation.
        Your goal is to provide deep strategic insight, predict outcomes, and explain battlefield dynamics.
        
        CURRENT BATTLEFIELD STATE:
        ${context}
        
        Analyze the forces, composition (Tanks are distinct from Soldiers and Archers), and momentum.
        If asked for advice, give specific tactical suggestions based on the unit stats.
        Soldiers are melee swarming units. Tanks are durable heavy hitters. Archers are ranged but fragile.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [
            { role: 'user', parts: [{ text: `Context: ${context}\n\nQuestion: ${userMessage}` }] }
        ],
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingBudget: 32768 }, // High thinking budget for complex strategy
        }
      });

      const text = response.text || "I'm analyzing the battlefield but cannot formulate a response right now.";
      
      setMessages(prev => [...prev, { role: 'model', text }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Communications disrupted. I cannot reach the strategic command server." }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
      {/* Header */}
      <div className="bg-neutral-800 p-3 flex justify-between items-center border-b border-neutral-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="font-bold text-sm text-neutral-200">Gemini Strategic Advisor</span>
        </div>
        <button 
          onClick={onClose}
          className="text-neutral-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin bg-neutral-950/50"
      >
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] rounded-lg p-3 text-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600/20 text-blue-100 border border-blue-600/30' 
                  : 'bg-neutral-800 text-neutral-200 border border-neutral-700'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-neutral-800 rounded-lg p-3 text-sm border border-neutral-700 flex items-center gap-2">
              <span className="text-purple-400 font-mono text-xs">THINKING</span>
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-neutral-900 border-t border-neutral-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about strategy..."
            className="flex-1 bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-neutral-600"
            disabled={isThinking}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
        <div className="mt-2 text-[10px] text-neutral-500 text-center">
            Powered by gemini-3-pro-preview
        </div>
      </div>
    </div>
  );
};

export default BattleAdvisor;