import React from "react";
import { motion } from "framer-motion";
import { Code2, Zap, Shield, Terminal, ArrowRight, Trophy, Users, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Home = () => {
    const naviagte = useNavigate();
  return (
    <div className="min-h-screen w-full bg-[#0A0A0A] text-white">
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-[#111111]/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Code2 className="text-purple-500" size={28} />
              <span className="text-2xl font-bold">CodeLeet</span>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-gray-300 hover:text-white transition px-4 py-2">
                Problems
              </button>
              <button className="text-gray-300 hover:text-white transition px-4 py-2">
                Contests
              </button>
              <button className="text-gray-300 hover:text-white transition px-4 py-2">
                Discuss
              </button>
              <button className="bg-purple-600 hover:bg-purple-700 transition px-6 py-2 rounded-xl font-medium" onClick={()=>naviagte("/login")}>
                Sign In
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent">
            Master Coding Skills
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Practice coding problems in isolated containers. Run, test, and debug your code in a secure environment.
          </p>
          <div className="flex gap-4 justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-purple-600 hover:bg-purple-700 transition px-8 py-4 rounded-xl font-medium text-lg flex items-center gap-2" onClick={()=>naviagte("/login")}
            >
              Get Started
              <ArrowRight size={20} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-[#1A1A1A] hover:bg-[#242424] border border-white/10 transition px-8 py-4 rounded-xl font-medium text-lg"
            >
              View Problems
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-8"
        >
          {/* Feature 1 */}
          <div className="bg-[#111111] p-8 rounded-2xl border border-white/10 hover:border-purple-500/50 transition">
            <div className="bg-purple-600/20 w-14 h-14 rounded-xl flex items-center justify-center mb-4">
              <Terminal className="text-purple-400" size={28} />
            </div>
            <h3 className="text-2xl font-semibold mb-3">Isolated Containers</h3>
            <p className="text-gray-400">
              Run your code safely in Docker containers. Each execution is isolated and secure.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-[#111111] p-8 rounded-2xl border border-white/10 hover:border-purple-500/50 transition">
            <div className="bg-purple-600/20 w-14 h-14 rounded-xl flex items-center justify-center mb-4">
              <Zap className="text-purple-400" size={28} />
            </div>
            <h3 className="text-2xl font-semibold mb-3">Real-time Execution</h3>
            <p className="text-gray-400">
              Get instant feedback on your code. Test cases run in milliseconds.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-[#111111] p-8 rounded-2xl border border-white/10 hover:border-purple-500/50 transition">
            <div className="bg-purple-600/20 w-14 h-14 rounded-xl flex items-center justify-center mb-4">
              <Shield className="text-purple-400" size={28} />
            </div>
            <h3 className="text-2xl font-semibold mb-3">Secure Environment</h3>
            <p className="text-gray-400">
              Enterprise-grade security ensures your code and data remain protected.
            </p>
          </div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-3xl p-12 border border-purple-500/30"
        >
          <div className="grid md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="flex items-center justify-center mb-4">
                <Trophy className="text-purple-400" size={40} />
              </div>
              <h4 className="text-4xl font-bold mb-2">2,500+</h4>
              <p className="text-gray-400">Coding Problems</p>
            </div>
            <div>
              <div className="flex items-center justify-center mb-4">
                <Users className="text-purple-400" size={40} />
              </div>
              <h4 className="text-4xl font-bold mb-2">100K+</h4>
              <p className="text-gray-400">Active Users</p>
            </div>
            <div>
              <div className="flex items-center justify-center mb-4">
                <BookOpen className="text-purple-400" size={40} />
              </div>
              <h4 className="text-4xl font-bold mb-2">50M+</h4>
              <p className="text-gray-400">Solutions Submitted</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="bg-[#111111] rounded-3xl p-12 border border-white/10 text-center"
        >
          <h2 className="text-4xl font-bold mb-4">Ready to Level Up?</h2>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Join thousands of developers improving their coding skills every day.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-purple-600 hover:bg-purple-700 transition px-10 py-4 rounded-xl font-medium text-lg inline-flex items-center gap-2"
          >
            Start Coding Now
            <ArrowRight size={20} />
          </motion.button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#111111]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Code2 className="text-purple-500" size={24} />
              <span className="text-xl font-bold">CodeLeet</span>
            </div>
            <p className="text-gray-500 text-sm">© 2024 CodeLeet. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;