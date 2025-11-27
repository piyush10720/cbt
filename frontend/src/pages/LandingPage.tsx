import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowRight, Shield, FileText, BarChart3, Lock, Clock, Brain } from 'lucide-react'

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-indigo-500/30">
      {/* Navbar */}
      <nav className="fixed w-full z-50 top-0 start-0 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center space-x-2 rtl:space-x-reverse">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="font-bold text-xl text-white">C</span>
            </div>
            <span className="self-center text-2xl font-semibold whitespace-nowrap text-white">CBT Platform</span>
          </Link>
          <div className="flex md:order-2 space-x-3 md:space-x-0 rtl:space-x-reverse">
            <Link to="/login">
              <Button variant="ghost" className="text-white hover:text-indigo-400 mr-2 hover:bg-white/10">
                Log in
              </Button>
            </Link>
            <Link to="/register">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 border-0">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 w-full -translate-x-1/2 h-full z-0 pointer-events-none">
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl mix-blend-screen animate-blob"></div>
            <div className="absolute top-20 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl mix-blend-screen animate-blob animation-delay-2000"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
            Next-Gen Computer Based <br /> Testing Platform
          </h1>
          <p className="mt-4 text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            A modern, full-stack assessment solution powered by AI. 
            Create exams from PDFs in seconds, ensure integrity with anti-cheating measures, and get instant, detailed analytics.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/register">
              <Button size="lg" className="h-14 px-8 text-lg bg-white text-slate-900 hover:bg-slate-100 font-semibold rounded-full border-0">
                Start for free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white rounded-full bg-transparent">
                Live Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-slate-900/50 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Powerful Features for Modern Assessment</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Everything you need to conduct secure, efficient, and insightful examinations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Brain className="h-8 w-8 text-indigo-400" />}
              title="Flexible Creation"
              description="Create exams your way. Upload PDF question papers for AI parsing or manually craft questions from scratch using our intuitive editor."
            />
            <FeatureCard 
              icon={<Shield className="h-8 w-8 text-emerald-400" />}
              title="Anti-Cheating"
              description="Ensure exam integrity with tab switch detection, fullscreen enforcement, and browser fingerprinting technologies."
            />
            <FeatureCard 
              icon={<BarChart3 className="h-8 w-8 text-amber-400" />}
              title="Advanced Analytics"
              description="Get instant grading, score breakdowns, time analysis, and strength/weakness reports immediately after submission."
            />
            <FeatureCard 
              icon={<FileText className="h-8 w-8 text-blue-400" />}
              title="Flexible Question Types"
              description="Support for Single/Multi MCQ, True/False, Numeric, and Descriptive questions with manual editing capabilities."
            />
            <FeatureCard 
              icon={<Clock className="h-8 w-8 text-rose-400" />}
              title="Smart Timer"
              description="Automated timer management with auto-submit functionality on expiry to ensure fair testing conditions."
            />
            <FeatureCard 
              icon={<Lock className="h-8 w-8 text-purple-400" />}
              title="Secure Access"
              description="Role-based access control (Student/Teacher/Admin) with public, private, or restricted exam settings."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 border-t border-white/5 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Streamlined Assessment Workflow</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              From creation to analysis, we've simplified every step of the examination process.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-indigo-500/0 via-indigo-500/50 to-indigo-500/0 z-0"></div>

            <StepCard
              number="01"
              title="Create or Upload"
              description="Start from scratch with manual question entry or simply upload existing PDF papers. Our system handles both with ease."
            />
            <StepCard
              number="02"
              title="Configure & Publish"
              description="Set strict time limits, enable anti-cheating measures, and define grading rules. Publish your exam privately or to a specific group."
            />
            <StepCard
              number="03"
              title="Track & Analyze"
              description="Monitor student progress in real-time. Access detailed performance reports and question-wise analysis immediately after completion."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
              CBT Platform
            </span>
            <p className="text-slate-500 text-sm mt-2">© 2024 CBT Platform. All rights reserved.</p>
          </div>
          <div className="flex space-x-6">
            <a href="#" className="text-slate-400 hover:text-white transition-colors">Privacy</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors">Terms</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
  <div className="p-8 rounded-2xl bg-slate-900 border border-white/10 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 group">
    <div className="mb-4 p-3 bg-slate-800 rounded-xl w-fit group-hover:scale-110 transition-transform duration-300">
      {icon}
    </div>
    <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
    <p className="text-slate-400 leading-relaxed">
      {description}
    </p>
  </div>
)

const StepCard: React.FC<{ number: string; title: string; description: string }> = ({ number, title, description }) => (
  <div className="relative z-10 bg-slate-950 border border-white/10 p-8 rounded-2xl hover:border-indigo-500/50 transition-colors duration-300">
    <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-purple-600 mb-4 font-mono">
      {number}
    </div>
    <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
    <p className="text-slate-400 leading-relaxed">
      {description}
    </p>
  </div>
)

export default LandingPage
