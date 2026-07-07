import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { login } from '../services/api.js';

const features = [
  "Parsing LTM financial statements & SEC filings...",
  "Computing intrinsic value & DCF consensus targets...",
  "Synthesizing earnings call transcript sentiment...",
  "Formulating autonomous investment theses...",
  "Building audited SWOT risk matrices...",
  "Generating evidence-backed reports in parallel..."
];

function FeatureTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % features.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-8 overflow-hidden relative flex items-center justify-center text-[#5B5BF7] font-bold text-[14px]">
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -18, opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="absolute text-center tracking-wide flex items-center gap-2"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#5B5BF7] animate-pulse" />
          {features[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const data = await login(username, password);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleQuickLogin(userType) {
    setError(null);
    setUsername(userType === 'standard' ? 'user1' : 'user2');
    setPassword('password');
    // Briefly delay to let state update visually before submitting
    setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await login(userType === 'standard' ? 'user1' : 'user2', 'password');
        onLoginSuccess(data.user);
      } catch (err) {
        setError(err.response?.data?.message || 'Login failed.');
      } finally {
        setIsLoading(false);
      }
    }, 100);
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 18,
      },
    },
  };

  return (
    <main
      style={{
        backgroundImage: 'url(/login_bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      className="min-h-screen text-slate-800 flex items-center justify-center relative overflow-hidden px-6 py-12 font-sans antialiased"
    >
      {/* Dark overlay to give the backdrop contrast */}
      <div className="absolute inset-0 bg-[#F8FAFC]/90 backdrop-blur-[2px] pointer-events-none" />

      {/* Dynamic drifting gradient mesh blobs */}
      <motion.div
        animate={{
          scale: [1, 1.15, 0.95, 1.05, 1],
          x: [0, 30, -20, 15, 0],
          y: [0, -40, 20, -10, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-[-15%] left-[-15%] h-[600px] w-[600px] rounded-full bg-indigo-100/40 blur-[120px] pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1, 0.9, 1.1, 1.02, 1],
          x: [0, -30, 25, -15, 0],
          y: [0, 30, -30, 20, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute bottom-[-15%] right-[-15%] h-[650px] w-[650px] rounded-full bg-sky-100/40 blur-[120px] pointer-events-none"
      />

      {/* WIDESCREEN DUAL-PANEL WRAPPER */}
      <div className="flex flex-col lg:flex-row gap-8 items-stretch justify-center w-full max-w-[1020px] relative z-10">
        
        {/* ================= LEFT SIDE PANEL (INFO CARD) ================= */}
        <motion.div
          initial={{ opacity: 0, x: -40, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 80, damping: 15 }}
          className="w-full lg:w-1/2 rounded-[24px] border border-slate-200 bg-white/80 p-8 md:p-10 shadow-lg backdrop-blur-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#5B5BF7]" />
              <p className="text-[14px] uppercase tracking-widest text-[#5B5BF7] font-bold">System Architecture</p>
            </div>
            <h2 className="mt-4 text-[28px] font-extrabold text-slate-900 leading-snug">Intelligence Engine</h2>
            <p className="mt-3 text-slate-500 text-[15px] leading-relaxed">
              Altuni Labs is an autonomous quantitative investment intelligence platform built for modern institutional capital markets.
            </p>

            <div className="mt-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5B5BF7]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-[15px] font-bold text-slate-900">Multi-Agent Coordination</h4>
                  <p className="mt-1 text-slate-500 text-[14px] leading-relaxed">
                    Twelve parallel LLM analyst nodes cross-reference company filings, macroeconomic metrics, and competitor models.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5B5BF7]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-[15px] font-bold text-slate-900">Explainable Valuation</h4>
                  <p className="mt-1 text-slate-500 text-[14px] leading-relaxed">
                    Auditable Discounted Cash Flow (DCF), cost of capital (WACC) projections, and consensus estimates with no hidden weights.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5B5BF7]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-[15px] font-bold text-slate-900">Real-Time Sentiment Matrix</h4>
                  <p className="mt-1 text-slate-500 text-[14px] leading-relaxed">
                    Evaluates global news feeds and earnings call transcripts to project directional SWOT matrices and risk parameters.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-150/60 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-[13px] uppercase font-bold text-slate-400 block">Avg Latency</span>
              <span className="text-[16px] font-bold text-slate-800 mt-1 block">45 Secs</span>
            </div>
            <div>
              <span className="text-[13px] uppercase font-bold text-slate-400 block">Active Workers</span>
              <span className="text-[16px] font-bold text-slate-800 mt-1 block">12 Nodes</span>
            </div>
            <div>
              <span className="text-[13px] uppercase font-bold text-slate-400 block">Data Feed</span>
              <span className="text-[16px] font-bold text-[#5B5BF7] mt-1 block">SEC Realtime</span>
            </div>
          </div>
        </motion.div>

        {/* ================= RIGHT SIDE PANEL (EXISTING LOGIN CARD) ================= */}
        <motion.div
          initial={{ opacity: 0, x: 40, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 80, damping: 15, delay: 0.05 }}
          className="w-full lg:w-1/2 rounded-[24px] border border-slate-200 bg-white/80 p-8 md:p-10 shadow-lg backdrop-blur-md hover:shadow-xl transition-shadow duration-300"
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            {/* Header section */}
            <div className="text-center mb-2">
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="text-[14px] uppercase tracking-[0.5em] text-[#5B5BF7] font-bold"
              >
                InsideIIM × Altuni Labs
              </motion.p>
              
              <motion.h1
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.04,
                      delayChildren: 0.15,
                    },
                  },
                }}
                initial="hidden"
                animate="show"
                className="mt-3 text-[36px] font-extrabold tracking-tight text-slate-900 leading-tight flex justify-center flex-wrap"
              >
                {Array.from("AI Investment").map((char, index) => (
                  <motion.span
                    key={index}
                    variants={{
                      hidden: { opacity: 0, y: 15 },
                      show: { opacity: 1, y: 0 },
                    }}
                    transition={{ type: 'spring', stiffness: 120, damping: 10 }}
                    className="inline-block"
                    style={{ whiteSpace: char === ' ' ? 'pre' : 'normal' }}
                  >
                    {char}
                  </motion.span>
                ))}
              </motion.h1>

              <motion.p
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.08,
                      delayChildren: 0.6,
                    },
                  },
                }}
                initial="hidden"
                animate="show"
                className="text-slate-500 text-[16px] mt-2 font-medium flex justify-center flex-wrap gap-x-1"
              >
                {"Institutional Research Platform Login".split(" ").map((word, index) => (
                  <motion.span
                    key={index}
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      show: { opacity: 1, y: 0 },
                    }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="inline-block"
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.p>

              {/* Loop Ticker */}
              <motion.div
                variants={itemVariants}
                className="mt-6 pt-4 border-t border-slate-150/60"
              >
                <FeatureTicker />
              </motion.div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-[16px] bg-rose-50 border border-rose-100 text-rose-800 text-[14px] font-semibold shadow-sm"
              >
                {error}
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <motion.div variants={itemVariants}>
                <label className="block text-[14px] font-bold text-slate-600 mb-2 uppercase tracking-wider">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full px-5 h-[56px] rounded-[16px] border border-slate-250 bg-slate-50/50 text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#5B5BF7] focus:bg-white focus:ring-4 focus:ring-indigo-100/30 transition-all font-medium text-[16px]"
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="block text-[14px] font-bold text-slate-600 mb-2 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-5 h-[56px] rounded-[16px] border border-slate-250 bg-slate-50/50 text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#5B5BF7] focus:bg-white focus:ring-4 focus:ring-indigo-100/30 transition-all font-medium text-[16px]"
                />
              </motion.div>

              <motion.div variants={itemVariants} className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#5B5BF7] hover:bg-[#4a4ad8] text-white h-[56px] rounded-[16px] font-bold shadow-md shadow-indigo-100 hover:shadow-indigo-200 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-[16px] flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                      Signing in...
                    </span>
                  ) : (
                    <>
                      <span>Sign In to Workspace</span>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </motion.div>
            </form>

            {/* Divider */}
            <motion.div variants={itemVariants} className="relative my-4 text-center">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <span className="relative bg-white/90 px-4 text-[14px] text-slate-400 font-bold uppercase tracking-wider">
                Test Accounts
              </span>
            </motion.div>

            {/* Test Users Buttons */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4 pt-1">
              <motion.button
                type="button"
                onClick={() => handleQuickLogin('standard')}
                whileHover={{
                  y: -3,
                  scale: 1.02,
                  borderColor: '#5B5BF7',
                  boxShadow: '0 8px 25px -10px rgba(91,91,247,0.15)',
                }}
                whileTap={{ scale: 0.98 }}
                className="flex flex-col items-center justify-center p-4 border border-slate-200 rounded-[20px] bg-slate-50 hover:bg-slate-100 transition-colors text-center group cursor-pointer"
              >
                <span className="text-[14px] font-bold text-slate-800 group-hover:text-[#5B5BF7] transition">User 1 (Standard)</span>
                <span className="text-[14px] text-slate-400 mt-1">Read-Only</span>
              </motion.button>

              <motion.button
                type="button"
                onClick={() => handleQuickLogin('premium')}
                whileHover={{
                  y: -3,
                  scale: 1.02,
                  borderColor: '#5B5BF7',
                  boxShadow: '0 8px 25px -10px rgba(91,91,247,0.15)',
                }}
                whileTap={{ scale: 0.98 }}
                className="flex flex-col items-center justify-center p-4 border border-slate-200 rounded-[20px] bg-slate-50 hover:bg-slate-100 transition-colors text-center group cursor-pointer"
              >
                <span className="text-[14px] font-bold text-slate-800 group-hover:text-[#5B5BF7] transition">User 2 (Premium)</span>
                <span className="text-[14px] text-slate-400 mt-1">Full Access</span>
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>

      </div>
    </main>
  );
}
